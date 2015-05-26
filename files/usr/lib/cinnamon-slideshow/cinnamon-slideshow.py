#! /usr/bin/python2

from gi.repository import Gio, GLib
import dbus, dbus.service, dbus.glib
from dbus.mainloop.glib import DBusGMainLoop
import random
import os, locale
from xml.etree import ElementTree

SLIDESHOW_DBUS_NAME = "org.Cinnamon.Slideshow"
SLIDESHOW_DBUS_PATH = "/org/Cinnamon/Slideshow"

BACKGROUND_COLLECTION_TYPE_DIRECTORY = "directory"
BACKGROUND_COLLECTION_TYPE_XML = "xml"

class CinnamonSlideshow(dbus.service.Object):
    def __init__(self):
        bus_name = dbus.service.BusName(SLIDESHOW_DBUS_NAME, bus=dbus.SessionBus())
        dbus.service.Object.__init__(self, bus_name, SLIDESHOW_DBUS_PATH)

        self.slideshow_settings = Gio.Settings(schema="org.cinnamon.desktop.background.slideshow")
        self.background_settings = Gio.Settings(schema="org.cinnamon.desktop.background")

        if self.slideshow_settings.get_boolean("slideshow-paused"):
            self.slideshow_settings.set_boolean("slideshow-paused", False)

        self.image_playlist = []
        self.used_image_playlist = []
        self.images_ready = False
        self.update_in_progress = False
        self.current_image = self.background_settings.get_string("picture-uri")

        self.update_id = 0
        self.loop_counter = self.slideshow_settings.get_int("delay")

        self.folder_monitor = None
        self.folder_monitor_id = 0

    @dbus.service.method(SLIDESHOW_DBUS_NAME, in_signature='', out_signature='')
    def begin(self):
        self.setup_slideshow()

    @dbus.service.method(SLIDESHOW_DBUS_NAME, in_signature='', out_signature='')
    def end(self):
        if self.update_id > 0:
            GLib.source_remove(self.update_id)
            self.update_id = 0

        ml.quit()

    @dbus.service.method(SLIDESHOW_DBUS_NAME, in_signature='', out_signature='')
    def getNextImage(self):
        if self.update_id > 0:
            GLib.source_remove(self.update_id)
            self.update_id = 0

        self.loop_counter = self.slideshow_settings.get_int("delay")
        self.start_mainloop()        

    def setup_slideshow(self):        
        self.load_settings()
        self.connect_signals()
        self.gather_images()
        if self.collection_type == BACKGROUND_COLLECTION_TYPE_DIRECTORY:
            self.connect_folder_monitor()
        self.start_mainloop()

    def format_source(self, type, path):
        # returns 'type://path'
        return ("%s://%s" % (type, path))

    def load_settings(self):
        self.random_order = self.slideshow_settings.get_boolean("random-order")
        self.collection = self.slideshow_settings.get_string("image-source")
        self.collection_path = ""
        self.collection_type = None
        if self.collection != "" and "://" in self.collection:
            (self.collection_type, self.collection_path) = self.collection.split("://")
            self.collection_path = os.path.expanduser(self.collection_path)

    def connect_signals(self):
        self.slideshow_settings.connect("changed::image-source", self.on_slideshow_source_changed)
        self.slideshow_settings.connect("changed::random-order", self.on_random_order_changed)
        self.background_settings.connect("changed::picture-uri", self.on_picture_uri_changed)

    def connect_folder_monitor(self):
        folder_path = Gio.file_new_for_path(self.collection_path)
        self.folder_monitor = folder_path.monitor_directory(0, None)
        self.folder_monitor_id = self.folder_monitor.connect("changed", self.on_monitored_folder_changed)

    def disconnect_folder_monitor(self):
        if self.folder_monitor_id > 0:
            self.folder_monitor.disconnect(self.folder_monitor_id)
            self.folder_monitor_id = 0

    def gather_images(self):
        if self.collection_type == BACKGROUND_COLLECTION_TYPE_DIRECTORY:
            folder_at_path = Gio.file_new_for_path(self.collection_path)

            if folder_at_path.query_exists(None):
                folder_at_path.enumerate_children_async("standard::type,standard::content-type",
                                                        Gio.FileQueryInfoFlags.NONE,
                                                        GLib.PRIORITY_LOW,
                                                        None,
                                                        self.gather_images_cb,
                                                        None)
        elif self.collection_type == BACKGROUND_COLLECTION_TYPE_XML:
            pictures = self.parse_xml_backgrounds_list(self.collection_path)
            for picture in pictures:                
                filename = picture["filename"]
                self.add_image_to_playlist(filename)

    def gather_images_cb(self, obj, res, user_data):
        all_files = []
        enumerator = obj.enumerate_children_finish(res)
        def on_next_file_complete(obj, res, user_data=all_files):
            files = obj.next_files_finish(res)
            file_list = all_files
            if len(files) is not 0:
                file_list = file_list.extend(files)
                enumerator.next_files_async(100, GLib.PRIORITY_LOW, None, on_next_file_complete, None)
            else:
                enumerator.close(None)
                self.ensure_file_is_image(file_list)

        enumerator.next_files_async(100, GLib.PRIORITY_LOW, None, on_next_file_complete, all_files)

    def ensure_file_is_image(self, file_list):
        for item in file_list:
            file_type = item.get_file_type();
            if file_type is not Gio.FileType.DIRECTORY:
                file_contents = item.get_content_type();
                if file_contents.startswith("image"):
                    self.add_image_to_playlist(self.collection_path + "/" + item.get_name())

    def add_image_to_playlist(self, file_path):
        image = Gio.file_new_for_path(file_path)
        image_uri = image.get_uri();
        self.image_playlist.append(image_uri)
        if self.collection_type == BACKGROUND_COLLECTION_TYPE_DIRECTORY:
            self.image_playlist.sort()
        self.images_ready = True

    def on_slideshow_source_changed(self, settings, key):
        if self.update_id > 0:
            GLib.source_remove(self.update_id)
            self.update_id = 0
        self.disconnect_folder_monitor()
        self.image_playlist = []
        self.used_image_playlist = []
        self.images_ready = False        
        self.collection = self.slideshow_settings.get_string("image-source")
        self.collection_path = ""
        self.collection_type = None
        if self.collection != "" and "://" in self.collection:
            (self.collection_type, self.collection_path) = self.collection.split("://")
            self.collection_path = os.path.expanduser(self.collection_path)
        if self.collection_type == BACKGROUND_COLLECTION_TYPE_DIRECTORY:
            self.connect_folder_monitor()
        self.gather_images()
        self.loop_counter = self.slideshow_settings.get_int("delay")
        self.start_mainloop()

    def on_monitored_folder_changed(self, monitor, file1, file2, event_type):
        try:
            if event_type == Gio.FileMonitorEvent.DELETED:
                file_uri = file1.get_uri();
                if self.image_playlist.count(file_uri) > 0:
                    index_to_remove = self.image_playlist.index(file_uri)
                    del self.image_playlist[index_to_remove]
                elif self.used_image_playlist.count(file_uri) > 0:
                    index_to_remove = self.used_image_playlist.index(file_uri)
                    del self.used_image_playlist[index_to_remove]

            if event_type == Gio.FileMonitorEvent.CREATED:
                file_path = file1.get_path()
                file_info = file1.query_info("standard::type,standard::content-type", Gio.FileQueryInfoFlags.NONE, None)
                file_type = file_info.get_file_type()
                if file_type is not Gio.FileType.DIRECTORY:
                    file_contents = file_info.get_content_type();
                    if file_contents.startswith("image"):
                        self.add_image_to_playlist(file_path)
        except:
            pass

    def on_random_order_changed(self, settings, key):
        self.random_order = self.slideshow_settings.get_boolean("random-order")

    def on_picture_uri_changed(self, settings, key):
        if self.update_in_progress:
            return
        else:
            if self.background_settings.get_string("picture-uri") != self.current_image:
                self.slideshow_settings.set_boolean("slideshow-enabled", False)

    def start_mainloop(self):
        if self.update_id > 0:
            GLib.source_remove(self.update_id)
            self.update_id = 0

        if not self.images_ready:
            self.update_id = GLib.timeout_add_seconds(1, self.start_mainloop)
        else:
            if self.loop_counter >= self.slideshow_settings.get_int("delay") and not self.slideshow_settings.get_boolean("slideshow-paused"):
                self.loop_counter = 1
                self.update_background()
                self.update_id = GLib.timeout_add_seconds(60, self.start_mainloop)
            else:
                self.loop_counter = self.loop_counter + 1
                self.update_id = GLib.timeout_add_seconds(60, self.start_mainloop)

    def update_background(self):
        if self.update_in_progress:
            return

        self.update_in_progress = True

        if len(self.image_playlist) == 0:
            self.move_used_images_to_original_playlist()

        next_image = self.get_next_image_from_list()
        if next_image is not None:
            self.background_settings.set_string("picture-uri", next_image)
            self.current_image = next_image

        self.update_in_progress = False

    def get_next_image_from_list(self):
        if self.random_order:
            index = random.randint(0, len(self.image_playlist) - 1)
            image = self.image_playlist[index]
        else:
            index = 0
            image = self.image_playlist[index]

        self.move_image_to_used_playlist(index, image)

        return image

    def move_image_to_used_playlist(self, index, image):
        self.image_playlist.pop(index)
        self.used_image_playlist.append(image)

    def move_used_images_to_original_playlist(self):
        self.image_playlist = self.used_image_playlist
        if self.collection_type == BACKGROUND_COLLECTION_TYPE_DIRECTORY:
            self.image_playlist.sort()
        self.used_image_playlist = []


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
            loc = self.splitLocaleCode(locale.getdefaultlocale()[0])
            res = []
            subLocaleFound = False
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
                                    locName = self.splitLocaleCode(propAttr.get(locAttrName)) if propAttr.has_key(locAttrName) else ("", "")
                                    names.append((locName, wpName))
                        wallpaperData["name"] = self.getLocalWallpaperName(names, loc)
                        
                        if "filename" in wallpaperData and wallpaperData["filename"] != "" and os.path.exists(wallpaperData["filename"]) and os.access(wallpaperData["filename"], os.R_OK):
                            if wallpaperData["name"] == "":
                                wallpaperData["name"] = os.path.basename(wallpaperData["filename"])
                            res.append(wallpaperData)
            return res
        except Exception, detail:
            print detail
            return []
###############

if __name__ == "__main__":
    DBusGMainLoop(set_as_default=True)
    slideshow = CinnamonSlideshow()
    ml = GLib.MainLoop.new(None, True)
    ml.run()
