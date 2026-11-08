#!/usr/bin/python3

import signal
import sys
import os, locale
from functools import cache
from xml.etree import ElementTree
from setproctitle import setproctitle

import gi
gi.require_version('GLibUnix', '2.0')
gi.require_version('GdkPixbuf', '2.0')
from gi.repository import Gio, GLib, GLibUnix, GdkPixbuf

sys.path.insert(0, '/usr/share/cinnamon/cinnamon-settings')
import config

config.add_private_typelib_path()
gi.require_version('CinnamonBg', '1.0')
from gi.repository import CinnamonBg

from slideshow_rotation import PerMonitorRotation, parse_source, list_directory_images

SLIDESHOW_DBUS_NAME = "org.Cinnamon.Slideshow"
SLIDESHOW_DBUS_PATH = "/org/Cinnamon/Slideshow"

BACKGROUND_COLLECTION_TYPE_DIRECTORY = "directory"
BACKGROUND_COLLECTION_TYPE_XML = "xml"

# Spelled out rather than read off the enum value: pygobject does not reliably
# expose value_nick (see cinnamon a8aca115a). Indexed by CinnamonBg.Mode.
MODE_NAMES = ("independent", "mirror", "spanned")


def mode_name(mode):
    try:
        return MODE_NAMES[int(mode)]
    except (IndexError, TypeError, ValueError):
        return str(mode)

VERBOSE = False


def set_verbose(value):
    global VERBOSE
    VERBOSE = value


def log(message):
    if VERBOSE:
        print("slideshow: " + message, flush=True)

# D-Bus interface XML definition
DBUS_INTERFACE_XML = '''
<node>
    <interface name="org.Cinnamon.Slideshow">
        <method name="begin" />
        <method name="end" />
        <method name="getNextImage" />
    </interface>
</node>
'''

@cache
def decodable_mime_types():
    mimes = set()
    for fmt in GdkPixbuf.Pixbuf.get_formats():
        mimes.update(fmt.get_mime_types())

    return mimes


class CinnamonSlideshowApplication(Gio.Application):
    def __init__(self):
        super().__init__(
            application_id=SLIDESHOW_DBUS_NAME,
            flags=Gio.ApplicationFlags.IS_SERVICE
        )

        self.slideshow_settings = Gio.Settings(schema="org.cinnamon.desktop.background.slideshow")
        self.background_settings = Gio.Settings(schema="org.cinnamon.desktop.background")

        self.bg_list = CinnamonBg.List.new()
        self.rotation = None
        self._n_streams = 0
        self.active = False
        self._last_mode = None
        self._rotating = {}      # stream id -> folder, as of the last setup
        self._reeval_id = 0
        self._folder_monitors = {}   # directory path -> (Gio.FileMonitor, handler id)
        self._folder_reload_id = 0

        # config-changed is everything except a wallpaper advancing, so our own
        # rotation writes never come back to us as though they were edits.
        self.bg_list.connect("config-changed", self.on_config_changed)
        self.slideshow_settings.connect("changed::random-order", self.on_random_order_changed)

        if self.slideshow_settings.get_boolean("slideshow-paused"):
            self.slideshow_settings.set_boolean("slideshow-paused", False)

        self.update_id = 0
        self.random_order = self.slideshow_settings.get_boolean("random-order")

        self.connection = None
        self.registration_id = 0

        self.cinnamon_seen = False
        self.cinnamon_watch_id = Gio.bus_watch_name(
            Gio.BusType.SESSION,
            "org.Cinnamon",
            Gio.BusNameWatcherFlags.NONE,
            self.on_cinnamon_appeared,
            self.on_cinnamon_vanished
        )

        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                GLibUnix.signal_add(GLib.PRIORITY_DEFAULT, sig, self.end)
            except AttributeError:
                GLibUnix.signal_add_full(GLib.PRIORITY_DEFAULT, sig, self.end, None)

    def on_cinnamon_appeared(self, connection, name, name_owner):
        self.cinnamon_seen = True

    def on_cinnamon_vanished(self, connection, name):
        # Cinnamon owns org.Cinnamon; if it goes away (logout, crash, replace)
        # this orphaned service should exit too, since nothing else will stop it.
        log("cinnamon vanished (seen=%s)" % self.cinnamon_seen)
        if self.cinnamon_seen:
            self.end()

    def do_startup(self):
        Gio.Application.do_startup(self)
        self.hold()
        log("do_startup (mode=%s, active=%s)" % (
            mode_name(self.bg_list.props.mode), self.should_be_active()))
        if self.should_be_active():
            log("slideshow work present — self-starting")
            GLib.idle_add(self.begin)

    def do_dbus_register(self, connection, object_path):
        try:
            self.connection = connection
            iface_info = Gio.DBusNodeInfo.new_for_xml(DBUS_INTERFACE_XML)
            try:
                register = connection.register_object_with_closures2
            except AttributeError:
                register = connection.register_object
            self.registration_id = register(
                SLIDESHOW_DBUS_PATH,
                iface_info.interfaces[0],
                self.handle_method_call,
                None,  # get_property
                None   # set_property
            )
        except Exception as e:
            print(f"Failed to export slideshow service: {e}")
            return False

        return Gio.Application.do_dbus_register(self, connection, object_path)

    def do_dbus_unregister(self, connection, path):
        if self.registration_id > 0:
            connection.unregister_object(self.registration_id)
            self.registration_id = 0

        Gio.Application.do_dbus_unregister(self, connection, path)

    def do_activate(self):
        log("do_activate")
        self.setup_slideshow()

    def handle_method_call(self, connection, sender, object_path, interface_name, method_name, parameters, invocation):
        try:
            if method_name == "begin":
                self.begin()
                invocation.return_value(None)
            elif method_name == "end":
                self.end()
                invocation.return_value(None)
            elif method_name == "getNextImage":
                self.get_next_image()
                invocation.return_value(None)
            else:
                invocation.return_error_literal(
                    Gio.dbus_error_quark(),
                    Gio.DBusError.UNKNOWN_METHOD,
                    f"Unknown method: {method_name}"
                )
        except Exception as e:
            invocation.return_error_literal(
                Gio.dbus_error_quark(),
                Gio.DBusError.FAILED,
                str(e)
            )

    def begin(self):
        log("begin")
        if self.active:
            log("begin: already active, ignoring")
            return
        if not self.should_be_active():
            log("begin: nothing to slideshow; staying idle")
            return
        self.setup_slideshow()
        self.active = True

    def end(self):
        log("end")
        self.active = False
        if self.update_id > 0:
            GLib.source_remove(self.update_id)
            self.update_id = 0
        if self._reeval_id > 0:
            GLib.source_remove(self._reeval_id)
            self._reeval_id = 0
        if self._folder_reload_id > 0:
            GLib.source_remove(self._folder_reload_id)
            self._folder_reload_id = 0
        self._sync_folder_monitors([])
        self.rotation = None
        self._rotating = {}
        if self.cinnamon_watch_id > 0:
            Gio.bus_unwatch_name(self.cinnamon_watch_id)
            self.cinnamon_watch_id = 0
        self.quit()

    def get_next_image(self):
        log("getNextImage (mode=%s)" % mode_name(self.bg_list.props.mode))
        self.begin()
        self.advance_all()

    def setup_slideshow(self):
        self.load_settings()
        self._last_mode = self.bg_list.props.mode
        log("setup_slideshow: mode=%s" % mode_name(self._last_mode))

        if self.update_id > 0:
            GLib.source_remove(self.update_id)
            self.update_id = 0

        descriptors = self._build_streams()
        self._n_streams = len(descriptors)
        self._sync_folder_monitors(descriptors)

        streams = {d["id"]: d["folder"] for d in descriptors}
        restarted = {mid for mid, folder in streams.items()
                     if mid in self._rotating and self._rotating[mid] != folder}
        self._rotating = streams
        if restarted:
            log("  new folder, cycling now: %s" % ", ".join(sorted(restarted)))

        self.rotation = PerMonitorRotation(descriptors, self.random_order)
        for mid, uri in self.rotation.initial(restarted):
            log("  initial assign %s -> %s" % (mid, uri))
            self._apply(mid, uri)
        self.bg_list.save_pictures()

        self.start_timer()

    def _build_streams(self):
        # One stream per rotating item. The model is already what is on screen,
        # so there is no mode to branch on and nothing to materialise.
        descriptors = []
        for item in self.bg_list:
            name = item.props.connector or "all"
            if not item.props.slideshow:
                log("  %s: static (no rotation)" % name)
                continue
            source = item.props.slideshow_source
            images = self.gather_source_images(source)
            current = item.props.picture_uri or None
            log("  %s: source=%s (%d images) current=%s"
                % (name, source, len(images), current))
            if not images:
                print("slideshow: %s: no usable images in '%s'; not rotating"
                      % (name, source), flush=True)
            descriptors.append({"id": name, "folder": source,
                                "images": images, "current": current})
        return descriptors

    def _sync_folder_monitors(self, descriptors):
        wanted = set()
        for d in descriptors:
            stype, path = parse_source(d["folder"])
            if stype == BACKGROUND_COLLECTION_TYPE_DIRECTORY and path:
                wanted.add(path)

        for path in [p for p in self._folder_monitors if p not in wanted]:
            monitor, handler = self._folder_monitors.pop(path)
            monitor.disconnect(handler)
            monitor.cancel()

        for path in wanted - set(self._folder_monitors):
            try:
                monitor = Gio.file_new_for_path(path).monitor_directory(
                    Gio.FileMonitorFlags.NONE, None)
            except GLib.Error as e:
                print("slideshow: cannot watch '%s' for changes: %s"
                      % (path, e.message), file=sys.stderr, flush=True)
                continue
            self._folder_monitors[path] = (monitor,
                                           monitor.connect("changed", self.on_folder_changed))
            log("  watching %s" % path)

    def on_folder_changed(self, monitor, changed_file, other_file, event_type):
        if self._folder_reload_id > 0:
            GLib.source_remove(self._folder_reload_id)
        self._folder_reload_id = GLib.timeout_add(500, self.reload_folders)

    def reload_folders(self):
        self._folder_reload_id = 0
        if self.rotation is None:
            return GLib.SOURCE_REMOVE
        for source in self.rotation.folders():
            images = self.gather_source_images(source)
            log("folder changed: %s now has %d images" % (source, len(images)))
            self.rotation.set_folder_images(source, images)
        return GLib.SOURCE_REMOVE

    def _item_for_id(self, mid):
        for item in self.bg_list:
            if (item.props.connector or "all") == mid:
                return item
        return None

    def _apply(self, mid, uri):
        item = self._item_for_id(mid)
        if item is None:
            return
        item.props.picture_uri = uri

        if item.props.picture_options == "none":
            item.props.picture_options = "zoom"

    def load_settings(self):
        self.random_order = self.slideshow_settings.get_boolean("random-order")

    def on_random_order_changed(self, settings, key):
        self.random_order = self.slideshow_settings.get_boolean("random-order")

        if self.rotation is not None:
            self.rotation.random_order = self.random_order

    def gather_source_images(self, source):
        stype, path = parse_source(source)
        if stype == BACKGROUND_COLLECTION_TYPE_DIRECTORY:
            return [Gio.file_new_for_path(p).get_uri()
                    for p in list_directory_images(path, decodable_mime_types())]
        if stype == BACKGROUND_COLLECTION_TYPE_XML:
            return [Gio.file_new_for_path(pic["filename"]).get_uri()
                    for pic in self.parse_xml_backgrounds_list(path)]
        return []

    def should_be_active(self):
        return any(item.props.slideshow for item in self.bg_list)

    def on_config_changed(self, bg_list):
        self._schedule_reevaluate()

    def _schedule_reevaluate(self):
        if self._reeval_id > 0:
            GLib.source_remove(self._reeval_id)
        self._reeval_id = GLib.timeout_add(150, self._reevaluate)

    def _reevaluate(self):
        self._reeval_id = 0
        if not self.should_be_active():
            if self.bg_list.get_n_items() == 0:
                log("reevaluate: monitor list not loaded yet; staying put")
                return GLib.SOURCE_REMOVE

            log("reevaluate: no slideshow monitors; exiting")
            self.end()
            return GLib.SOURCE_REMOVE
        if not self.active:
            log("reevaluate: a slideshow monitor is present; starting")
            self.begin()
            return GLib.SOURCE_REMOVE

        log("reevaluate: config changed; re-setup")
        self.setup_slideshow()
        return GLib.SOURCE_REMOVE

    def start_timer(self):
        if self.update_id > 0:
            GLib.source_remove(self.update_id)
            self.update_id = 0
        n = max(1, self._n_streams)
        delay = self.slideshow_settings.get_int("delay")
        interval = max(1, int(delay * 60 / n))
        log("start_timer: interval=%ds (delay=%dm / %d streams)" % (interval, delay, n))
        self.update_id = GLib.timeout_add_seconds(interval, self.tick)

    def tick(self):
        if self.slideshow_settings.get_boolean("slideshow-paused"):
            log("tick: paused")
            return True
        result = self.rotation.tick()
        if result is not None:
            mid, uri = result
            log("tick: advance %s -> %s" % (mid, uri))
            self._apply(mid, uri)
            self.bg_list.save_pictures()
        else:
            log("tick: no advance")
        return True

    def advance_all(self):
        if self.rotation is None:
            self.setup_slideshow()
            return
        changed = self.rotation.advance_all()
        for mid, uri in changed:
            log("getNextImage: advance %s -> %s" % (mid, uri))
            self._apply(mid, uri)
        if changed:
            self.bg_list.save_pictures()
        self.start_timer()

########### TAKEN FROM CS_BACKGROUND
    def splitLocaleCode(self, localeCode):
        loc = localeCode.partition("_")
        loc = (loc[0], loc[2])
        return loc

    def getLocalWallpaperName(self, names, loc):
        result = ""
        mainLocFound = False
        for wp in names:
            wpLoc = wp[0]
            wpName = wp[1]
            if wpLoc == ("", ""):
                if not mainLocFound:
                    result = wpName
            elif wpLoc[0] == loc[0]:
                if wpLoc[1] == loc[1]:
                    return wpName
                elif wpLoc[1] == "":
                    result = wpName
                    mainLocFound = True
        return result

    def parse_xml_backgrounds_list(self, filename):
        try:
            locAttrName = "{http://www.w3.org/XML/1998/namespace}lang"
            loc = self.splitLocaleCode(locale.getlocale()[0])
            res = []
            f = open(filename)
            rootNode = ElementTree.fromstring(f.read())
            f.close()
            if rootNode.tag == "wallpapers":
                for wallpaperNode in rootNode:
                    if wallpaperNode.tag == "wallpaper" and wallpaperNode.get("deleted") != "true":
                        wallpaperData = {"metadataFile": filename}
                        names = []
                        for prop in wallpaperNode:
                            if type(prop.tag) == str:
                                if prop.tag != "name":
                                    wallpaperData[prop.tag] = prop.text
                                else:
                                    propAttr = prop.attrib
                                    wpName = prop.text
                                    locName = self.splitLocaleCode(propAttr.get(locAttrName)) if locAttrName in propAttr else ("", "")
                                    names.append((locName, wpName))
                        wallpaperData["name"] = self.getLocalWallpaperName(names, loc)

                        if "filename" in wallpaperData and wallpaperData["filename"] != "" and os.path.exists(wallpaperData["filename"]) and os.access(wallpaperData["filename"], os.R_OK):
                            if wallpaperData["name"] == "":
                                wallpaperData["name"] = os.path.basename(wallpaperData["filename"])
                            res.append(wallpaperData)
            return res
        except Exception as detail:
            print("slideshow: failed to parse background list '%s': %s" % (filename, detail), flush=True)
            return []

if __name__ == "__main__":
    setproctitle("cinnamon-slideshow")

    if "--verbose" in sys.argv or "-v" in sys.argv:
        set_verbose(True)

    app = CinnamonSlideshowApplication()
    app.run([a for a in sys.argv if a not in ("--verbose", "-v")])