#!/usr/bin/env python

try:
    import os
    import os.path
    import commands
    import sys
    import string    
    import gettext
    from gi.repository import Gio, Gtk, GObject, Gdk
    from gi.repository import GdkPixbuf 
    import gconf
    import json
    import dbus
    import tz    
    import time
    from datetime import datetime
    import thread
    import urllib
    import lxml.etree
    import locale    
    import imtools
    import Image
    import tempfile
    import math
    import cgi
except Exception, detail:
    print detail
    sys.exit(1)

# get home directory
home = os.path.expanduser("~")

# i18n
gettext.install("cinnamon", "/usr/share/cinnamon/locale")

# i18n for menu item
menuName = _("Desktop Settings")
menuGenericName = _("Desktop Configuration Tool")
menuComment = _("Fine-tune desktop settings")


FORBIDDEN_KEYVALS = [
    Gdk.KEY_Home,
    Gdk.KEY_Left,
    Gdk.KEY_Up,
    Gdk.KEY_Right,
    Gdk.KEY_Down,
    Gdk.KEY_Page_Up,
    Gdk.KEY_Page_Down,
    Gdk.KEY_End,
    Gdk.KEY_Tab,
    Gdk.KEY_KP_Enter,
    Gdk.KEY_Return,
    Gdk.KEY_space,
    Gdk.KEY_Mode_switch
]

KEYBINDINGS = [
    #   KB Label                        Schema                  Key name               Array?  Category
    # Cinnamon stuff
    [_("Toggle Scale"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-down", True, "cinnamon"],
    [_("Toggle Expo"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-up", True, "cinnamon"],
    [_("Cycle through open windows"), "org.gnome.desktop.wm.keybindings", "switch-windows", True, "cinnamon"],
    [_("Cycle backwards though open windows"), "org.gnome.desktop.wm.keybindings", "switch-windows-backward", True, "cinnamon"],
    [_("Run dialog (must restart Cinnamon)"), "org.gnome.desktop.wm.keybindings", "panel-run-dialog", True, "cinnamon"],
    [_("Menu button (must restart Cinnamon)"), "org.cinnamon.muffin", "overlay-key", False, "cinnamon"],

    # Windows - General
    [_("Maximize window"), "org.gnome.desktop.wm.keybindings", "maximize", True, "windows"],
    [_("Unmaximize window"), "org.gnome.desktop.wm.keybindings", "unmaximize", True, "windows"],
    [_("Minimize window"), "org.gnome.desktop.wm.keybindings", "minimize", True, "windows"],
    [_("Toggle tiled left (must restart Cinnamon)"), "org.cinnamon.muffin.keybindings", "toggle-tiled-left", True, "windows"],
    [_("Toggle tiled right (must restart Cinnamon)"), "org.cinnamon.muffin.keybindings", "toggle-tiled-right", True, "windows"],
    [_("Close window"), "org.gnome.desktop.wm.keybindings", "close", True, "windows"],
    [_("Show desktop"), "org.gnome.desktop.wm.keybindings", "show-desktop", True, "windows"],
    [_("Activate window menu"), "org.gnome.desktop.wm.keybindings", "activate-window-menu", True, "windows"],
    [_("Toggle maximization state"), "org.gnome.desktop.wm.keybindings", "toggle-maximized", True, "windows"],
    [_("Toggle fullscreen state"), "org.gnome.desktop.wm.keybindings", "toggle-fullscreen", True, "windows"],
    [_("Toggle shaded state"), "org.gnome.desktop.wm.keybindings", "toggle-shaded", True, "windows"],
    [_("Maximize vertically"), "org.gnome.desktop.wm.keybindings", "maximize-vertically", True, "windows"],
    [_("Maximize horizontally"), "org.gnome.desktop.wm.keybindings", "maximize-horizontally", True, "windows"],
    [_("Resize window"), "org.gnome.desktop.wm.keybindings", "begin-resize", True, "windows"],
    [_("Move window"), "org.gnome.desktop.wm.keybindings", "begin-move", True, "windows"],
    [_("Center window in screen"), "org.gnome.desktop.wm.keybindings", "move-to-center", True, "windows"],
    [_("Move window to upper-right"), "org.gnome.desktop.wm.keybindings", "move-to-corner-ne", True, "windows"],
    [_("Move window to upper-left"), "org.gnome.desktop.wm.keybindings", "move-to-corner-nw", True, "windows"],
    [_("Move window to lower-right"), "org.gnome.desktop.wm.keybindings", "move-to-corner-se", True, "windows"],
    [_("Move window to lower-left"), "org.gnome.desktop.wm.keybindings", "move-to-corner-sw", True, "windows"],
    [_("Move window to right edge"), "org.gnome.desktop.wm.keybindings", "move-to-side-e", True, "windows"],
    [_("Move window to top edge"), "org.gnome.desktop.wm.keybindings", "move-to-side-n", True, "windows"],
    [_("Move window to bottom edge"), "org.gnome.desktop.wm.keybindings", "move-to-side-s", True, "windows"],
    [_("Move window to left edge"), "org.gnome.desktop.wm.keybindings", "move-to-side-w", True, "windows"],

    # Workspace management
    [_("Toggle showing window on all workspaces"), "org.gnome.desktop.wm.keybindings", "toggle-on-all-workspaces", True, "ws-manage"],
    [_("Switch to left workspace"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-left", True, "ws-manage"],
    [_("Switch to right workspace"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-right", True, "ws-manage"],
    [_("Switch to workspace 1"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-1", True, "ws-manage"],
    [_("Switch to workspace 2"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-2", True, "ws-manage"],
    [_("Switch to workspace 3"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-3", True, "ws-manage"],
    [_("Switch to workspace 4"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-4", True, "ws-manage"],
    [_("Switch to workspace 5"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-5", True, "ws-manage"],
    [_("Switch to workspace 6"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-6", True, "ws-manage"],
    [_("Switch to workspace 7"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-7", True, "ws-manage"],
    [_("Switch to workspace 8"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-8", True, "ws-manage"],
    [_("Switch to workspace 9"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-9", True, "ws-manage"],
    [_("Switch to workspace 10"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-10", True, "ws-manage"],
    [_("Switch to workspace 11"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-11", True, "ws-manage"],
    [_("Switch to workspace 12"), "org.gnome.desktop.wm.keybindings", "switch-to-workspace-12", True, "ws-manage"],
    [_("Move window to left workspace"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-left", True, "ws-manage"],
    [_("Move window to right workspace"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-right", True, "ws-manage"],
    [_("Move window to workspace 1"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-1", True, "ws-manage"],
    [_("Move window to workspace 2"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-2", True, "ws-manage"],
    [_("Move window to workspace 3"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-3", True, "ws-manage"],
    [_("Move window to workspace 4"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-4", True, "ws-manage"],
    [_("Move window to workspace 5"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-5", True, "ws-manage"],
    [_("Move window to workspace 6"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-6", True, "ws-manage"],
    [_("Move window to workspace 7"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-7", True, "ws-manage"],
    [_("Move window to workspace 8"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-8", True, "ws-manage"],
    [_("Move window to workspace 9"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-9", True, "ws-manage"],
    [_("Move window to workspace 10"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-10", True, "ws-manage"],
    [_("Move window to workspace 11"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-11", True, "ws-manage"],
    [_("Move window to workspace 12"), "org.gnome.desktop.wm.keybindings", "move-to-workspace-12", True, "ws-manage"],

    # System
    [_("Log out"), "org.gnome.settings-daemon.plugins.media-keys", "logout", False, "system"],
    [_("Lock screen"), "org.gnome.settings-daemon.plugins.media-keys", "screensaver", False, "system"],
    [_("Toggle recording desktop (must restart Cinnamon)"), "org.cinnamon.muffin.keybindings", "toggle-recording", True, "system"],

    # Launchers
    [_("Launch help browser"), "org.gnome.settings-daemon.plugins.media-keys", "help", False, "launchers"],
    [_("Launch calculator"), "org.gnome.settings-daemon.plugins.media-keys", "calculator", False, "launchers"],
    [_("Launch email client"), "org.gnome.settings-daemon.plugins.media-keys", "email", False, "launchers"],
    [_("Launch web browser"), "org.gnome.settings-daemon.plugins.media-keys", "www", False, "launchers"],
    [_("Home folder"), "org.gnome.settings-daemon.plugins.media-keys", "home", False, "launchers"],
    [_("Search"), "org.gnome.settings-daemon.plugins.media-keys", "search", False, "launchers"],

    # Sound and Media
    [_("Volume mute"), "org.gnome.settings-daemon.plugins.media-keys", "volume-mute", False, "media"],
    [_("Volume down"), "org.gnome.settings-daemon.plugins.media-keys", "volume-down", False, "media"],
    [_("Volume up"), "org.gnome.settings-daemon.plugins.media-keys", "volume-up", False, "media"],
    [_("Launch media player"), "org.gnome.settings-daemon.plugins.media-keys", "media", False, "media"],
    [_("Play"), "org.gnome.settings-daemon.plugins.media-keys", "play", False, "media"],
    [_("Pause playback"), "org.gnome.settings-daemon.plugins.media-keys", "pause", False, "media"],
    [_("Stop playback"), "org.gnome.settings-daemon.plugins.media-keys", "stop", False, "media"],
    [_("Previous track"), "org.gnome.settings-daemon.plugins.media-keys", "previous", False, "media"],
    [_("Next track"), "org.gnome.settings-daemon.plugins.media-keys", "next", False, "media"],
    [_("Eject"), "org.gnome.settings-daemon.plugins.media-keys", "eject", False, "media"],

    # Universal Access
    [_("Turn zoom on or off"), "org.gnome.settings-daemon.plugins.media-keys", "magnifier", False, "accessibility"],
    [_("Zoom in"), "org.gnome.settings-daemon.plugins.media-keys", "magnifier-zoom-in", False, "accessibility"],
    [_("Zoom out"), "org.gnome.settings-daemon.plugins.media-keys", "magnifier-zoom-out", False, "accessibility"],
    [_("Turn screen reader on or off"), "org.gnome.settings-daemon.plugins.media-keys", "screenreader", False, "accessibility"],
    [_("Turn on-screen keyboard on or off"), "org.gnome.settings-daemon.plugins.media-keys", "on-screen-keyboard", False, "accessibility"],
    [_("Increase text size"), "org.gnome.settings-daemon.plugins.media-keys", "increase-text-size", False, "accessibility"],
    [_("Decrease text size"), "org.gnome.settings-daemon.plugins.media-keys", "decrease-text-size", False, "accessibility"],
    [_("High contrast on or off"), "org.gnome.settings-daemon.plugins.media-keys", "toggle-contrast", False, "accessibility"]
]

BACKGROUND_MODES = [
    ("wallpaper", _("Wallpaper")),
    #("slideshow", _("Slideshow")),
    #("flickr", _("Flickr"))
]

BACKGROUND_COLOR_SHADING_TYPES = [
    ("solid", _("None")),
    ("horizontal", _("Horizontal")),
    ("vertical", _("Vertical"))
]

BACKGROUND_PICTURE_OPTIONS = [
    ("none", _("No picture")),
    ("wallpaper", _("Mosaic")),
    ("centered", _("Centered")),
    ("scaled", _("Scaled")),
    ("stretched", _("Stretched")),
    ("zoom", _("Zoom")),
    ("spanned", _("Spanned"))
]

BACKGROUND_ICONS_SIZE = 115

class PixCache(object):
    def __init__(self):
        self._data = {}
    def get_pix(self, filename, size = None):
        if not filename in self._data:
            self._data[filename] = {}
        if size in self._data[filename]:
            pix = self._data[filename][size]
        else:
            if size:
                try:
                    pix = GdkPixbuf.Pixbuf.new_from_file_at_size(filename, size, size)
                except:
                    pix = None
            else:
                try:
                    pix = GdkPixbuf.Pixbuf.new_from_file(filename)
                except:
                    pix = None
            if pix:
                self._data[filename][size] = pix
        return pix

PIX_CACHE = PixCache()

# wrapper for timedated or gnome-settings-daemons DateTimeMechanism
class DateTimeWrapper:
    def __init__(self):
        try:
            proxy = dbus.SystemBus().get_object("org.freedesktop.timedate1", "/org/freedesktop/timedate1")
            self.dbus_iface = dbus.Interface(proxy, dbus_interface="org.freedesktop.timedate1")
            self.properties_iface = dbus.Interface(proxy, dbus_interface=dbus.PROPERTIES_IFACE)
            self.timedated = True
        except dbus.exceptions.DBusException:
            proxy = dbus.SystemBus().get_object("org.gnome.SettingsDaemon.DateTimeMechanism", "/")
            self.dbus_iface = dbus.Interface(proxy, dbus_interface="org.gnome.SettingsDaemon.DateTimeMechanism")
            self.timedated = False

    def set_time(self, seconds_since_epoch):
        if self.timedated:
            # timedated expects microseconds
            return self.dbus_iface.SetTime(seconds_since_epoch * 1000000, False, True)
        else:
            return self.dbus_iface.SetTime(seconds_since_epoch)

    def get_timezone(self):
        if self.timedated:
            return self.properties_iface.Get("org.freedesktop.timedate1", "Timezone")
        else:
            return self.dbus_iface.GetTimezone()

    def set_timezone(self, tz):
        if self.timedated:
            return self.dbus_iface.SetTimezone(tz, True)
        else:
            return self.dbus_iface.SetTimezone(tz)

    def get_using_ntp(self):
        if self.timedated:
            return self.properties_iface.Get("org.freedesktop.timedate1", "NTP")
        else:
            return self.dbus_iface.GetUsingNtp()

    def set_using_ntp(self, usingNtp):
        if self.timedated:
            return self.dbus_iface.SetNTP(usingNtp, True)
        else:
            return self.dbus_iface.SetUsingNtp(usingNtp)

class SidePage:
    def __init__(self, name, icon, content_box):        
        self.name = name
        self.icon = icon
        self.content_box = content_box
        self.widgets = []
        
    def add_widget(self, widget):
        self.widgets.append(widget)
        
    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        
        # Add our own widgets
        for widget in self.widgets:
            self.content_box.pack_start(widget, False, False, 2)            
        self.content_box.show_all()

class GConfComboBox(Gtk.HBox):    
    def __init__(self, label, key, options, init_value = ""):  
        self.key = key
        super(GConfComboBox, self).__init__()
        self.settings = gconf.client_get_default()  
        self.value = self.settings.get_string(self.key)
        if not self.value:
            self.value = init_value
                      
        self.label = Gtk.Label(label)       
        self.model = Gtk.ListStore(str, str)
        selected = None
        for option in options:
            iter = self.model.insert_before(None, None)
            self.model.set_value(iter, 0, option[0])                
            self.model.set_value(iter, 1, option[1])                        
            if (option[0] == self.value):
                selected = iter
                                
        self.content_widget = Gtk.ComboBox.new_with_model(self.model)   
        renderer_text = Gtk.CellRendererText()
        self.content_widget.pack_start(renderer_text, True)
        self.content_widget.add_attribute(renderer_text, "text", 1)     
        
        if selected is not None:
            self.content_widget.set_active_iter(selected)
        
        if (label != ""):
            self.pack_start(self.label, False, False, 2)                
        self.pack_start(self.content_widget, False, False, 2)                     
        self.content_widget.connect('changed', self.on_my_value_changed)
        # The on_my_setting_changed callback raises a segmentation fault, need to investigate that
        #self.settings.add_dir(os.path.split(key)[0], gconf.CLIENT_PRELOAD_NONE)
        #self.settings.notify_add(self.key, self.on_my_setting_changed)
        self.content_widget.show_all()
        
    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:            
            value = self.model[tree_iter][0]            
            self.settings.set_string(self.key, value)
    def on_my_setting_changed(self, client, cnxn_id, entry, args):
        print entry

def walk_directories(dirs, filter_func):
    valid = []
    try:
        for thdir in dirs:
            if os.path.isdir(thdir):
                for t in os.listdir(thdir):
                    if filter_func(os.path.join(thdir, t)):
                         valid.append(t)
    except:
        pass
        #logging.critical("Error parsing directories", exc_info=True)
    return valid

def rec_mkdir(path):
    if os.path.exists(path):
        return
    
    rec_mkdir(os.path.split(path)[0])
    os.mkdir(path)

class GSettingsColorChooser(Gtk.ColorButton):
    def __init__(self, schema, key, dep_key):
        Gtk.ColorButton.__init__(self)
        self._schema = Gio.Settings(schema)
        self._key = key
        self.dep_key = dep_key
        self.set_value(self._schema[self._key])
        self.connect("color-set", self._on_color_set)
        self._schema.connect("changed::"+key, self._on_settings_value_changed)
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def _on_settings_value_changed(self, schema, key):
        self.set_value(schema[key])
    def _on_color_set(self, *args):
        self._schema.set_string(self._key, self.get_value())
    def get_value(self):
        return self.get_color().to_string()
    def set_value(self, value):
        self.set_color(Gdk.color_parse(value))

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class ThreadedIconView(Gtk.IconView):
    def __init__(self):
        Gtk.IconView.__init__(self)
        self.set_item_width(BACKGROUND_ICONS_SIZE * 1.1)
        self._model = Gtk.ListStore(object, GdkPixbuf.Pixbuf, str)
        self.set_model(self._model)
        self.set_pixbuf_column(1)
        self.set_markup_column(2)
        
        self._loading_queue = []
        self._loading_queue_lock = thread.allocate_lock()
        
        self._loading_lock = thread.allocate_lock()
        self._loading = False
        
        self._loaded_data = []
        self._loaded_data_lock = thread.allocate_lock()
    
    def set_pictures_list(self, pictures_list):
        self.clear()
        for i in pictures_list:
            self.add_picture(i)
    
    def clear(self):
        self._loading_queue_lock.acquire()
        self._loading_queue = []
        self._loading_queue_lock.release()
        
        self._loading_lock.acquire()
        is_loading = self._loading
        self._loading_lock.release()
        while is_loading:
            time.sleep(0.1)
            self._loading_lock.acquire()
            is_loading = self._loading
            self._loading_lock.release()
        
        self._model.clear()
    
    def add_picture(self, picture):
        self._loading_queue_lock.acquire()
        self._loading_queue.append(picture)
        self._loading_queue_lock.release()
        
        start_loading = False
        self._loading_lock.acquire()
        if not self._loading:
            self._loading = True
            start_loading = True
        self._loading_lock.release()
        
        if start_loading:
            GObject.timeout_add(100, self._check_loading_progress)
            thread.start_new_thread(self._do_load, ())
    
    def _check_loading_progress(self):
        self._loading_lock.acquire()
        self._loaded_data_lock.acquire()
        res = self._loading
        to_load = []
        while len(self._loaded_data) > 0:
            to_load.append(self._loaded_data[0])
            self._loaded_data = self._loaded_data[1:]
        self._loading_lock.release()
        self._loaded_data_lock.release()
        
        for i in to_load:
            self._model.append(i)
        
        return res
    
    def _do_load(self):
        finished = False
        while not finished:
            self._loading_queue_lock.acquire()
            if len(self._loading_queue) == 0:
                finished = True
            else:
                to_load = self._loading_queue[0]
                self._loading_queue = self._loading_queue[1:]
            self._loading_queue_lock.release()
            if not finished:
                pix = PIX_CACHE.get_pix(to_load["filename"], BACKGROUND_ICONS_SIZE)
                if pix != None:                    
                    try:
                        img = Image.open(to_load["filename"])                        
                        if img.mode != 'RGB':
                            img = img.convert('RGB')
                        img.thumbnail((115, 115), Image.ANTIALIAS)                                                                                                    
                        img = imtools.round_image(img, {}, False, None, 5, 255)  
                        img = imtools.drop_shadow(img, 5, 5, background_color=(255, 255, 255, 0), shadow_color=0x444444, border=8, shadow_blur=3, force_background_color=False, cache=None)        
                        # Convert Image -> Pixbuf (save to file, GTK3 is not reliable for that)
                        f = tempfile.NamedTemporaryFile(delete=False)
                        filename = f.name
                        f.close()        
                        img.save(filename, "png")
                        pix = PIX_CACHE.get_pix(filename, BACKGROUND_ICONS_SIZE)                     
                    except Exception, detail:
                        print "Failed to convert %s: %s" % (to_load["filename"], detail)
                        pass
                    if "name" in to_load:
                        label = to_load["name"]
                    else:
                        label = os.path.split(to_load["filename"])[1]
                    self._loaded_data_lock.acquire()
                    self._loaded_data.append((to_load, pix, "<sub>%s</sub>" % label))
                    self._loaded_data_lock.release()
                
        self._loading_lock.acquire()
        self._loading = False
        self._loading_lock.release()                 

class BackgroundWallpaperPane (Gtk.VBox):
    def __init__(self, sidepage, gnome_background_schema):
        Gtk.VBox.__init__(self)
        self.set_spacing(5)
        
        self._gnome_background_schema = gnome_background_schema
        self._sidepage = sidepage
        
        scw = Gtk.ScrolledWindow()
        scw.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        self.pack_start(scw, True, True, 0)
        
        self.icon_view = ThreadedIconView()
        scw.add(self.icon_view)
        self.icon_view.connect("selection-changed", self._on_selection_changed)
        
        self.update_icon_view()
        
    def get_selected_wallpaper(self):
        selected_items = self.icon_view.get_selected_items()
        if len(selected_items) == 1:
            path = selected_items[0]
            iter = self.icon_view.get_model().get_iter(path)
            return self.icon_view.get_model().get(iter, 0)[0]
        return None
        
    def _on_selection_changed(self, iconview):
        self._sidepage.remove_wallpaper_button.set_sensitive(False)
        wallpaper = self.get_selected_wallpaper()
        if wallpaper:
            for key in wallpaper:
                if key == "filename":
                    self._gnome_background_schema.set_string("picture-uri", "file://" + wallpaper[key])
                elif key == "pcolor":
                    self._gnome_background_schema.set_string("primary-color", wallpaper[key])
                elif key == "scolor":
                    self._gnome_background_schema.set_string("secondary-color", wallpaper[key])
                elif key == "shade_type":
                    self._gnome_background_schema.set_string("color-shading-type", wallpaper[key])
                elif key == "options":
                    self._gnome_background_schema.set_string("picture-options", wallpaper[key])
            if (not "metadataFile" in wallpaper) or (wallpaper["metadataFile"] == ""):
                self._sidepage.remove_wallpaper_button.set_sensitive(True)
    
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
            rootNode = lxml.etree.fromstring(f.read())
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
        except:
            return []
    
    def update_icon_view(self):
        pictures_list = []
        for i in os.listdir("/usr/share/gnome-background-properties"):
            if i.endswith(".xml"):
                pictures_list += self.parse_xml_backgrounds_list(os.path.join("/usr/share/gnome-background-properties", i))
        
        path = os.path.join(os.getenv("HOME"), ".cinnamon", "backgrounds")
        if os.path.exists(path):
            for i in os.listdir(path):
                filename = os.path.join(path, i)
                if commands.getoutput("file -bi \"%s\"" % filename).startswith("image/"):
                    pictures_list.append({"filename": filename})
        self.icon_view.set_pictures_list(pictures_list)

class AddWallpapersDialog(Gtk.FileChooserDialog):
    def __init__(self, parent = None):
        Gtk.FileChooserDialog.__init__(self, _("Add wallpapers"), parent, Gtk.FileChooserAction.OPEN)
        self.add_button(Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
        self.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL)
        self.set_select_multiple(True)
    
    def run(self):
        self.show_all()
        resp = Gtk.FileChooserDialog.run(self)
        self.hide()
        if resp == Gtk.ResponseType.OK:
            res = self.get_filenames()
        else:
            res = []
        return res

class BackgroundSlideshowPane(Gtk.Table):
    def __init__(self, sidepage, gnome_background_schema, cinnamon_background_schema):
        Gtk.Table.__init__(self)
        self.set_col_spacings(5)
        self.set_row_spacings(5)
        
        self._cinnamon_background_schema = cinnamon_background_schema
        
        l = Gtk.Label(_("Folder"))
        l.set_alignment(0, 0.5)
        self.attach(l, 0, 1, 0, 1, xoptions = Gtk.AttachOptions.FILL, yoptions = 0)
        self.folder_selector = Gtk.FileChooserButton()
        self.folder_selector.set_action(Gtk.FileChooserAction.SELECT_FOLDER)
        self.folder_selector.connect("file-set", self._on_folder_selected)
        self.folder_selector.set_filename(self._cinnamon_background_schema["slideshow-folder"])
        self.attach(self.folder_selector, 1, 2, 0, 1, xoptions = Gtk.AttachOptions.FILL | Gtk.AttachOptions.EXPAND, yoptions = 0)
        self.recursive_cb = Gtk.CheckButton(_("Recursive listing"))
        self.recursive_cb.set_active(self._cinnamon_background_schema.get_boolean("slideshow-recursive"))
        self.recursive_cb.connect("toggled", self._on_recursive_toggled)
        self.attach(self.recursive_cb, 2, 3, 0, 1, xoptions = Gtk.AttachOptions.FILL, yoptions = 0)
        
        l = Gtk.Label(_("Delay"))
        l.set_alignment(0, 0.5)
        self.attach(l, 0, 1, 1, 2, xoptions = Gtk.AttachOptions.FILL, yoptions = 0)
        self.delay_button = Gtk.SpinButton()
        self.attach(self.delay_button, 1, 3, 1, 2, xoptions = Gtk.AttachOptions.FILL | Gtk.AttachOptions.EXPAND, yoptions = 0)
        self.delay_button.set_increments(1, 10)
        self.delay_button.set_range(1, 120)
        self.delay_button.set_value(self._cinnamon_background_schema.get_int("slideshow-delay"))
        self.delay_button.connect("value-changed", self._on_delay_changed)
    
    def _on_recursive_toggled(self, button):
        self._cinnamon_background_schema.set_boolean("slideshow-recursive", button.get_active())
        self.update_list()
    
    def _on_delay_changed(self, button):
        self._cinnamon_background_schema.set_int("slideshow-delay", int(button.get_value()))
        self.update_list()
    
    def _on_folder_selected(self, button):
        self._cinnamon_background_schema.set_string("slideshow-folder", button.get_filename())
        self.update_list()
    
    def update_list(self):
        thread.start_new_thread(self._do_update_list, (self.folder_selector.get_filename(), self.recursive_cb.get_active(), int(self.delay_button.get_value())))
    
    def _list_pictures(self, res, path, files):
        for i in files:
            filename = os.path.join(path, i)
            if commands.getoutput("file -bi \"%s\"" % filename).startswith("image/"):
                res.append(filename)
    
    def _do_update_list(self, folder, recursive, delay, transition_duration = 0):
        if os.path.exists(folder) and os.path.isdir(folder):
            files = []
            if recursive:
                os.path.walk(folder, self._list_pictures, files)
            else:
                for i in os.listdir(folder):
                    filename = os.path.join(folder, i)
                    if commands.getoutput("file -bi \"%s\"" % filename).startswith("image/"):
                        files.append(filename)
            xml_data = "<background>\n"
            prev_file = None
            first_file = None
            for filename in files:
                if prev_file:
                    xml_data += "<transition>\n<duration>%.1f</duration>\n<from>%s</from>\n<to>%s</to>\n</transition>\n" % (transition_duration, prev_file, filename)
                else:
                    first_file = filename
                xml_data += "<static>\n<duration>%.1f</duration>\n<file>%s</file>\n</static>\n" % (60 * delay, filename)
                prev_file = filename
            if first_file and prev_file and first_file != prev_file:
                xml_data += "<transition>\n<duration>%.1f</duration>\n<from>%s</from>\n<to>%s</to>\n</transition>\n" % (transition_duration, prev_file, first_file)
            xml_data += "</background>"
            
            if not os.path.exists(os.path.join(os.getenv("HOME"), ".cinnamon", "backgrounds")):
                rec_mkdir(os.path.join(os.getenv("HOME"), ".cinnamon", "backgrounds"))
            filename = os.path.join(os.getenv("HOME"), ".cinnamon", "backgrounds", "slideshow.xml")
            f = open(filename, "w")
            f.write(xml_data)
            f.close()
            Gio.Settings("org.gnome.desktop.background").set_string("picture-uri", "file://" + filename)

class BackgroundSidePage (SidePage):
    def __init__(self, name, icon, content_box):   
        SidePage.__init__(self, name, icon, content_box)
        self._gnome_background_schema = Gio.Settings("org.gnome.desktop.background")
        self._cinnamon_background_schema = Gio.Settings("org.cinnamon.background")
        self._add_wallpapers_dialog = AddWallpapersDialog()
        
        self._cinnamon_background_schema.connect("changed::mode", self._on_mode_changed)
    
    def _on_mode_changed(self, settings, key):
        for i in self.mainbox.get_children():
            self.mainbox.remove(i)
        if self._cinnamon_background_schema["mode"] == "slideshow":
            self.mainbox.add(self.slideshow_pane)
            self.add_wallpaper_button.hide()
            self.remove_wallpaper_button.hide()
            self.slideshow_pane.update_list()
        else:
            self.mainbox.add(self.wallpaper_pane)
            self.add_wallpaper_button.show()
            self.remove_wallpaper_button.show()
        self.mainbox.show_all()
    
    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        
        topbox = Gtk.HBox()
        self.content_box.pack_start(topbox, False, False, 0)
        topbox.set_spacing(5)
        
        l = Gtk.Label(_("Mode"))
        topbox.pack_start(l, False, False, 0)
        self.background_mode = GSettingsComboBox("", "org.cinnamon.background", "mode", None, BACKGROUND_MODES).content_widget
        self.background_mode.unparent()
        topbox.pack_start(self.background_mode, False, False, 0)
        
        self.remove_wallpaper_button = Gtk.Button("-")
        self.remove_wallpaper_button.set_no_show_all(True)
        self.remove_wallpaper_button.set_tooltip_text(_("Remove wallpaper"))
        self.remove_wallpaper_button.connect("clicked", lambda w: self._remove_selected_wallpaper())
        self.remove_wallpaper_button.set_sensitive(False)
        topbox.pack_end(self.remove_wallpaper_button, False, False, 0)
        self.add_wallpaper_button = Gtk.Button("+")
        self.add_wallpaper_button.set_tooltip_text(_("Add wallpapers"))
        self.add_wallpaper_button.connect("clicked", lambda w: self._add_wallpapers())
        self.add_wallpaper_button.set_no_show_all(True)
        topbox.pack_end(self.add_wallpaper_button, False, False, 0)
        
        self.content_box.pack_start(Gtk.HSeparator(), False, False, 2)
        
        self.mainbox = Gtk.EventBox()
        self.mainbox.set_visible_window(False)
        self.content_box.pack_start(self.mainbox, True, True, 0)
        
        self.wallpaper_pane = BackgroundWallpaperPane(self, self._gnome_background_schema)
        self.slideshow_pane = BackgroundSlideshowPane(self, self._gnome_background_schema, self._cinnamon_background_schema)
        if self._cinnamon_background_schema["mode"] == "slideshow":
            self.mainbox.add(self.slideshow_pane)
        else:
            self.mainbox.add(self.wallpaper_pane)
            self.add_wallpaper_button.show()
            self.remove_wallpaper_button.show()
        
        self.content_box.pack_start(Gtk.HSeparator(), False, False, 2)
        
        scrolled_window = Gtk.ScrolledWindow()
        scrolled_window.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.NEVER)

        expander = Gtk.Expander()
        expander.set_label(_("Advanced options"))
        
        self.content_box.pack_start(scrolled_window, False, True, 0)
        self.content_box.pack_start(expander, False, True, 0)
        
        advanced_options_box = Gtk.HBox()
        expander.add(advanced_options_box)
        advanced_options_box.set_spacing(10)
        
        l = Gtk.Label(_("Picture aspect"))
        l.set_alignment(0, 0.5)
        advanced_options_box.pack_start(l, False, False, 0)
        self.picture_options = GSettingsComboBox("", "org.gnome.desktop.background", "picture-options", None, BACKGROUND_PICTURE_OPTIONS)
        advanced_options_box.pack_start(self.picture_options, False, False, 0)
        
        l = Gtk.Label(_("Gradient"))
        l.set_alignment(0, 0.5)
        advanced_options_box.pack_start(l, False, False, 0)
        self.color_shading_type = GSettingsComboBox("", "org.gnome.desktop.background", "color-shading-type", None, BACKGROUND_COLOR_SHADING_TYPES)
        advanced_options_box.pack_start(self.color_shading_type, False, False, 0)
        
        hbox = Gtk.HBox()
        l = Gtk.Label(_("Colors"))
        hbox.pack_start(l, False, False, 2)
        self.primary_color = GSettingsColorChooser("org.gnome.desktop.background", "primary-color", None)
        hbox.pack_start(self.primary_color, False, False, 2)
        self.secondary_color = GSettingsColorChooser("org.gnome.desktop.background", "secondary-color", None)
        hbox.pack_start(self.secondary_color, False, False, 2)
        advanced_options_box.pack_start(hbox, False, False, 0)
    
    def _add_wallpapers(self):
        filenames = self._add_wallpapers_dialog.run()
        if filenames:
            dest_dir = os.path.join(os.getenv("HOME"), ".cinnamon", "backgrounds")
            if not os.path.exists(dest_dir):
                rec_mkdir(dest_dir)
            for filename in filenames:
                dest_filename = os.path.join(dest_dir, os.path.split(filename)[1])
                fs = open(filename)
                fd = open(dest_filename, "w")
                fd.write(fs.read())
                fs.close()
                fd.close()
            
            self.wallpaper_pane.update_icon_view()
    
    def _remove_selected_wallpaper(self):
        wallpaper = self.wallpaper_pane.get_selected_wallpaper()
        os.unlink(wallpaper["filename"])
        self.wallpaper_pane.update_icon_view()

class ThemeViewSidePage (SidePage):
    def __init__(self, name, icon, content_box):   
        SidePage.__init__(self, name, icon, content_box)        
        self.icons = []
                  
    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        
        # Find the current theme name
        self.settings = Gio.Settings.new("org.cinnamon.theme")
        self.current_theme = self.settings.get_string("name")
        
        # Add our own widgets
        notebook = Gtk.Notebook()
        
        cinnamon_theme_vbox = Gtk.VBox()
        
        scrolledWindow = Gtk.ScrolledWindow()   
        cinnamon_theme_vbox.pack_start(scrolledWindow, True, True, 2)
        
        iconView = Gtk.IconView()    
        iconView.set_columns(4)
        iconView.set_item_padding(2)  
        iconView.set_row_spacing(2)
        self.model = Gtk.ListStore(str, GdkPixbuf.Pixbuf)
                 
        img = GdkPixbuf.Pixbuf.new_from_file_at_size( "/usr/share/cinnamon/theme/thumbnail.png", 64, 64 )

        self.active_theme_iter = self.model.append(["Cinnamon", img])
                     
        self.load_themes_in('/usr/share/themes')
        self.load_themes_in('%s/.themes' % home)
        
        iconView.set_text_column(0)
        iconView.set_pixbuf_column(1)
        iconView.set_model(self.model)    
        if (self.active_theme_iter is not None):
            iconView.select_path(self.model.get_path(self.active_theme_iter))
        iconView.connect("selection_changed", self.apply_theme )
        scrolledWindow.add(iconView)
        scrolledWindow.set_shadow_type(Gtk.ShadowType.IN)
        link = Gtk.LinkButton("http://cinnamon-spices.linuxmint.com/themes")
        link.set_label(_("Get new themes"))    
        cinnamon_theme_vbox.pack_start(link, False, False, 2)
        
        notebook.append_page(cinnamon_theme_vbox, Gtk.Label(_("Cinnamon themes")))
        
        scrolledWindow = Gtk.ScrolledWindow()
        other_settings_box = Gtk.VBox()
        scrolledWindow.add_with_viewport(other_settings_box)
        other_settings_box.set_border_width(5)
        
        windowThemeSwitcher = GSettingsComboBox(_("Window theme"), "org.gnome.desktop.wm.preferences", "theme", None, self._load_window_themes())
        other_settings_box.pack_start(windowThemeSwitcher, False, False, 2)
        menusHaveIconsCB = GSettingsCheckButton(_("Menus Have Icons"), "org.gnome.desktop.interface", "menus-have-icons", None)
        other_settings_box.pack_start(menusHaveIconsCB, False, False, 2)
        buttonsHaveIconsCB = GSettingsCheckButton(_("Buttons Have Icons"), "org.gnome.desktop.interface", "buttons-have-icons", None)
        other_settings_box.pack_start(buttonsHaveIconsCB, False, False, 2)
        if 'org.nemo' in Gio.Settings.list_schemas():
            alwaysUseLocationEntryCB = GSettingsCheckButton(_("Always Use Location Entry In Nemo"), "org.nemo.preferences", "show-location-entry", None)
            other_settings_box.pack_start(alwaysUseLocationEntryCB, False, False, 2)
        cursorThemeSwitcher = GSettingsComboBox(_("Cursor theme"), "org.gnome.desktop.interface", "cursor-theme", None, self._load_cursor_themes())
        other_settings_box.pack_start(cursorThemeSwitcher, False, False, 2)
        keybindingThemeSwitcher = GSettingsComboBox(_("Keybinding theme"), "org.gnome.desktop.interface", "gtk-key-theme", None, self._load_keybinding_themes())
        other_settings_box.pack_start(keybindingThemeSwitcher, False, False, 2)
        iconThemeSwitcher = GSettingsComboBox(_("Icon theme"), "org.gnome.desktop.interface", "icon-theme", None, self._load_icon_themes())
        other_settings_box.pack_start(iconThemeSwitcher, False, False, 2)
        gtkThemeSwitcher = GSettingsComboBox(_("GTK+ theme"), "org.gnome.desktop.interface", "gtk-theme", None, self._load_gtk_themes())
        other_settings_box.pack_start(gtkThemeSwitcher, False, False, 2)
        
        notebook.append_page(scrolledWindow, Gtk.Label(_("Other settings")))
                    
        self.content_box.add(notebook)
        self.content_box.show_all()
        
    def _load_gtk_themes(self):
        """ Only shows themes that have variations for gtk+-3 and gtk+-2 """
        dirs = ("/usr/share/themes", os.path.join(os.path.expanduser("~"), ".themes"))
        valid = walk_directories(dirs, lambda d: os.path.exists(os.path.join(d, "gtk-2.0")) and os.path.exists(os.path.join(d, "gtk-3.0")))
        valid.sort(lambda a,b: cmp(a.lower(), b.lower()))
        res = []
        for i in valid:
            res.append((i, i))
        return res
    
    def _load_icon_themes(self):
        dirs = ("/usr/share/icons", os.path.join(os.path.expanduser("~"), ".icons"))
        valid = walk_directories(dirs, lambda d: os.path.isdir(d) and not os.path.exists(os.path.join(d, "cursors")))
        valid.sort(lambda a,b: cmp(a.lower(), b.lower()))
        res = []
        for i in valid:
            res.append((i, i))
        return res
        
    def _load_keybinding_themes(self):
        dirs = ("/usr/share/themes", os.path.join(os.path.expanduser("~"), ".themes"))
        valid = walk_directories(dirs, lambda d: os.path.isfile(os.path.join(d, "gtk-3.0", "gtk-keys.css")) and os.path.isfile(os.path.join(d, "gtk-2.0-key", "gtkrc")))
        valid.sort(lambda a,b: cmp(a.lower(), b.lower()))
        res = []
        for i in valid:
            res.append((i, i))
        return res
        
    def _load_cursor_themes(self):
        dirs = ("/usr/share/icons", os.path.join(os.path.expanduser("~"), ".icons"))
        valid = walk_directories(dirs, lambda d: os.path.isdir(d) and os.path.exists(os.path.join(d, "cursors")))
        valid.sort(lambda a,b: cmp(a.lower(), b.lower()))
        res = []
        for i in valid:
            res.append((i, i))
        return res
        
    def _load_window_themes(self):
        dirs = ("/usr/share/themes", os.path.join(os.path.expanduser("~"), ".themes"))
        valid = walk_directories(dirs, lambda d: os.path.exists(os.path.join(d, "metacity-1")))
        valid.sort(lambda a,b: cmp(a.lower(), b.lower()))
        res = []
        for i in valid:
            res.append((i, i))
        return res
    
    def load_themes_in(self, directory):
        if os.path.exists(directory) and os.path.isdir(directory):
            themes = os.listdir(directory)
            themes.sort()
            for theme in themes:
                try:
                    if os.path.exists("%s/%s/cinnamon/cinnamon.css" % (directory, theme)):
                        if os.path.exists("%s/%s/cinnamon/thumbnail.png" % (directory, theme)):
                            img = GdkPixbuf.Pixbuf.new_from_file_at_size( "%s/%s/cinnamon/thumbnail.png" % (directory, theme), 64, 64 )
                        else:
                            img = GdkPixbuf.Pixbuf.new_from_file_at_size( "/usr/share/cinnamon/theme/thumbnail-generic.png", 64, 64 )
                        theme_iter = self.model.append([theme, img])
                        if theme==self.current_theme:
                            self.active_theme_iter = theme_iter
                except Exception, detail:
                    print detail
        
    def apply_theme(self, iconView):
        selected_items = iconView.get_selected_items()
        if len(selected_items) > 0:
            path = selected_items[0]                  
            iterator = self.model.get_iter(path)
            theme_name = self.model.get_value(iterator, 0)
            if theme_name == "Cinnamon":
                theme_name = ""            
            self.settings.set_string("name", theme_name)
            
class ExtensionViewSidePage (SidePage):
    def __init__(self, name, icon, content_box):   
        SidePage.__init__(self, name, icon, content_box)        
        self.icons = []
                  
    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        
        scrolledWindow = Gtk.ScrolledWindow()    
        treeview = Gtk.TreeView()
                
        cr = Gtk.CellRendererToggle()
        cr.connect("toggled", self.toggled, treeview)
        column1 = Gtk.TreeViewColumn(_("Enable"), cr)
        column1.set_cell_data_func(cr, self.celldatafunction_checkbox)
        column1.set_resizable(True)

        column2 = Gtk.TreeViewColumn(_("Description"), Gtk.CellRendererText(), markup=1)
        column2.set_resizable(True)
        
        treeview.append_column(column1)
        treeview.append_column(column2)
        treeview.set_headers_visible(False)
            
        self.model = Gtk.TreeStore(str, str, bool)        
        self.model.set_sort_column_id( 1, Gtk.SortType.ASCENDING )
        treeview.set_model(self.model)
                                
        # Find the enabled extensions
        self.settings = Gio.Settings.new("org.cinnamon")
        self.enabled_extensions = self.settings.get_strv("enabled-extensions")
                         
        self.load_extensions_in('/usr/share/cinnamon/extensions')                                                                          
        self.load_extensions_in('%s/.local/share/cinnamon/extensions' % home)
        
        scrolledWindow.add(treeview)    
        
        scrolledWindow.set_shadow_type(Gtk.ShadowType.IN)
        link = Gtk.LinkButton("http://cinnamon-spices.linuxmint.com/extensions")
        link.set_label(_("Get new extensions"))                
        self.content_box.add(scrolledWindow)
        self.content_box.pack_start(link, False, False, 2) 
                                                        
        self.content_box.show_all()   
        
    def load_extensions_in(self, directory):
        if os.path.exists(directory) and os.path.isdir(directory):
            extensions = os.listdir(directory)
            extensions.sort()
            for extension in extensions:            
                if os.path.exists("%s/%s/metadata.json" % (directory, extension)):
                    json_data=open("%s/%s/metadata.json" % (directory, extension)).read()
                    data = json.loads(json_data)  
                    extension_uuid = data["uuid"]
                    extension_name = data["name"]                
                    extension_description = data["description"]
                    iter = self.model.insert_before(None, None)
                    self.model.set_value(iter, 0, extension_uuid)         
                    self.model.set_value(iter, 1, '<b>%s</b>\n<b><span foreground="#333333" size="xx-small">%s</span></b>\n<i><span foreground="#555555" size="x-small">%s</span></i>' % (extension_name, extension_uuid, extension_description))
                    self.model.set_value(iter, 2, (extension_uuid in self.enabled_extensions))
        
    def toggled(self, renderer, path, treeview):        
        iter = self.model.get_iter(path)
        if (iter != None):
            uuid = self.model.get_value(iter, 0)
            checked = self.model.get_value(iter, 2)
            if (checked):
                self.model.set_value(iter, 2, False)
                self.enabled_extensions.remove(uuid)
            else:
                self.model.set_value(iter, 2, True) 
                self.enabled_extensions.append(uuid)
            
            self.settings.set_strv("enabled-extensions", self.enabled_extensions)
                
    def celldatafunction_checkbox(self, column, cell, model, iter, data=None):
        cell.set_property("activatable", True)
        checked = model.get_value(iter, 2)
        if (checked):
            cell.set_property("active", True)
        else:
            cell.set_property("active", False)
            
class AppletViewSidePage (SidePage):
    def __init__(self, name, icon, content_box):   
        SidePage.__init__(self, name, icon, content_box)        
        self.icons = []
        
        self.search_entry = Gtk.Entry()
        self.search_entry.connect('changed', lambda y: self.model.clear() 
                                  or self.load_applets_in('/usr/share/cinnamon/applets') 
                                  or self.load_applets_in('%s/.local/share/cinnamon/applets' % home) )
                  
    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        
        scrolledWindow = Gtk.ScrolledWindow()    
        treeview = Gtk.TreeView()
                
        cr = Gtk.CellRendererToggle()
        cr.connect("toggled", self.toggled, treeview)
        column1 = Gtk.TreeViewColumn(_("Enable"), cr)
        column1.set_cell_data_func(cr, self.celldatafunction_checkbox)        
        column1.set_resizable(True)

        column2 = Gtk.TreeViewColumn(_("Icon"), Gtk.CellRendererPixbuf(), pixbuf=3)        
        column2.set_resizable(True)

        column3 = Gtk.TreeViewColumn(_("Description"), Gtk.CellRendererText(), markup=1)        
        column3.set_resizable(True)      
        
        treeview.append_column(column1)
        treeview.append_column(column2)
        treeview.append_column(column3)        
        treeview.set_headers_visible(False)        
            
        self.model = Gtk.TreeStore(str, str, bool, GdkPixbuf.Pixbuf)
        #                          uuid, name, enabled, icon        
        self.model.set_sort_column_id(1, Gtk.SortType.ASCENDING)
        treeview.set_model(self.model)
                                
        # Find the enabled applets
        self.settings = Gio.Settings.new("org.cinnamon")
        self.enabled_applets = self.settings.get_strv("enabled-applets")
                         
        self.load_applets_in('/usr/share/cinnamon/applets')                                                                          
        self.load_applets_in('%s/.local/share/cinnamon/applets' % home)
        
        scrolledWindow.add(treeview)                                                     
        scrolledWindow.set_shadow_type(Gtk.ShadowType.IN)
        
        button = Gtk.Button(_("Restore to default"))       
        button.connect("clicked", lambda x: self._restore_default_applets())
        
        link = Gtk.LinkButton("http://cinnamon-spices.linuxmint.com/applets")
        link.set_label(_("Get new applets"))                
                         
        self.content_box.pack_start(self.search_entry, False, False, 2)
        self.content_box.add(scrolledWindow)        
        self.content_box.pack_start(button, False, False, 2) 
        self.content_box.pack_start(link, False, False, 2) 
        
        self.content_box.show_all()   
    
    def _restore_default_applets(self):
        os.system('gsettings reset org.cinnamon enabled-applets')
        self.enabled_applets = self.settings.get_strv("enabled-applets")
        
        self.model.clear()
                         
        self.load_applets_in('/usr/share/cinnamon/applets')                                                                          
        self.load_applets_in('%s/.local/share/cinnamon/applets' % home)
        
    def load_applets_in(self, directory):
        if os.path.exists(directory) and os.path.isdir(directory):
            applets = os.listdir(directory)
            applets.sort()
            for applet in applets:
                try:           
                    if os.path.exists("%s/%s/metadata.json" % (directory, applet)):
                        json_data=open("%s/%s/metadata.json" % (directory, applet)).read()
                        data = json.loads(json_data)  
                        applet_uuid = data["uuid"]
                        applet_name = data["name"]                                        
                        applet_description = data["description"]                                                                    
                        
                        if self.search_entry.get_text().upper() in (applet_name + applet_description).upper():
                            iter = self.model.insert_before(None, None)
                            found = False
                            for enabled_applet in self.enabled_applets:
                                if applet_uuid in enabled_applet:
                                    found = True                            
                                    break       
                        
                            self.model.set_value(iter, 0, applet_uuid)                
                            self.model.set_value(iter, 1, '<b>%s</b>\n<b><span foreground="#333333" size="xx-small">%s</span></b>\n<i><span foreground="#555555" size="x-small">%s</span></i>' % (applet_name, applet_uuid, applet_description))                                  
                            self.model.set_value(iter, 2, found)                            
                            img = None                            
                            if "icon" in data:
                                applet_icon = data["icon"]
                                theme = Gtk.IconTheme.get_default()                                                    
                                if theme.has_icon(applet_icon):
                                    img = theme.load_icon(applet_icon, 32, 0)
                            elif os.path.exists("%s/%s/icon.png" % (directory, applet)):
                                img = GdkPixbuf.Pixbuf.new_from_file_at_size("%s/%s/icon.png" % (directory, applet), 32, 32)                            
                            
                            if img is None:                                                
                                img = GdkPixbuf.Pixbuf.new_from_file_at_size( "/usr/lib/cinnamon-settings/data/icons/applets.svg", 32, 32)
                                
                            self.model.set_value(iter, 3, img)                
                except Exception, detail:
                    print "Failed to load applet %s: %s" % (applet, detail)
        
    def toggled(self, renderer, path, treeview):        
        iter = self.model.get_iter(path)
        if (iter != None):
            uuid = self.model.get_value(iter, 0)
            checked = self.model.get_value(iter, 2)
            if (checked):
                self.model.set_value(iter, 2, False)
                for enabled_applet in self.enabled_applets:
                    if uuid in enabled_applet:
                        self.enabled_applets.remove(enabled_applet)
            else:
                self.model.set_value(iter, 2, True) 
                self.enabled_applets.append("panel1:right:0:%s" % uuid)
            
            self.settings.set_strv("enabled-applets", self.enabled_applets)
                
    def celldatafunction_checkbox(self, column, cell, model, iter, data=None):
        cell.set_property("activatable", True)
        checked = model.get_value(iter, 2)
        if (checked):
            cell.set_property("active", True)
        else:
            cell.set_property("active", False)

class KeyBindingCategory():
    def __init__(self, label, int_name):
        self.label = label
        self.int_name = int_name
        self.keybindings = []

    def add(self, keybinding):
        self.keybindings.append(keybinding)

    def clear(self):
        del self.keybindings[:]

class KeyBinding():
    def __init__(self, label, schema, key, is_array, category):
        self.key = key
        self.label = label
        self.is_array = is_array
        self.entries = [ ]
        self.settings = Gio.Settings.new(schema)
        self.loadSettings()

    def loadSettings(self):
        del self.entries[:]
        if self.is_array:
            self.entries = self.get_array(self.settings.get_strv(self.key))
        else:
            self.entries = self.get_array(self.settings.get_string(self.key))

    def get_array(self, raw_array):
        result = []
        if self.is_array:
            for entry in raw_array:
                result.append(entry)
            while (len(result) < 3):
                result.append("")
        else:
            result.append(raw_array)
            while (len(result) < 3):
                result.append("_invalid_")
        return result

    def setBinding(self, index, val):
        if val is not None:
            self.entries[index] = val
        else:
            self.entries[index] = ""
        self.writeSettings()

    def writeSettings(self):
        if self.is_array:
            array = []
            for entry in self.entries:
                if entry is not "":
                    array.append(entry)
            self.settings.set_strv(self.key, array)
        else:
            self.settings.set_string(self.key, self.entries[0])

    def resetDefaults(self):
        self.settings.reset(self.key)
        self.loadSettings()

class CustomKeyBinding():
    def __init__(self, path, label, action, binding):
        self.path = path
        self.label = label
        self.action = action
        self.entries = []
        self.entries.append(binding)

    def setBinding(self, index, val):
        if val is not None:
            self.entries[index] = val
        else:
            self.entries[index] = ""
        self.writeSettings()

    def writeSettings(self):
        gclient = gconf.client_get_default()
        gclient.set_string(self.path + "/name", self.label)
        gclient.set_string(self.path + "/action", self.action)
        gclient.set_string(self.path + "/binding", self.entries[0])

# Utility to convert key modifier codes to something more friendly
def clean_kb(keybinding):
    if keybinding is "":
        return cgi.escape(_("unassigned"))
    keybinding = keybinding.replace("<Super>", _("Super-"))
    keybinding = keybinding.replace("<Primary>", _("Ctrl-"))
    keybinding = keybinding.replace("<Shift>", _("Shift-"))
    keybinding = keybinding.replace("<Alt>", _("Alt-"))
    keybinding = keybinding.replace("<Control>", _("Ctrl-"))
    return cgi.escape(keybinding)

class KeyboardRange(Gtk.HBox):
    def __init__(self, label, low_label, hi_label, low_limit, hi_limit, inverted, valtype, exponential, schema, key, dep_key, **options):
        super(KeyboardRange, self).__init__()
        self.key = key
        self.dep_key = dep_key
        self.settings = Gio.Settings.new(schema)
        self.valtype = valtype
        if self.valtype == "int":
            self.value = self.settings.get_int(self.key) * 1.0
        elif self.valtype == "uint":
            self.value = self.settings.get_uint(self.key) * 1.0
        elif self.valtype == "double":
            self.value = self.settings.get_double(self.key) * 1.0
        self.label = Gtk.Label(label)
        self.low_label = Gtk.Label()
        self.hi_label = Gtk.Label()
        self.low_label.set_markup("<i><small>%s</small></i>" % low_label)
        self.hi_label.set_markup("<i><small>%s</small></i>" % hi_label)
        self.inverted = inverted
        self.exponential = exponential
        self._range = (hi_limit - low_limit) * 1.0
        self._step = options.get('adjustment_step', 1)
        self._min = low_limit * 1.0
        self._max = hi_limit * 1.0
        self.content_widget = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 0, 1, (self._step / self._range))
        self.content_widget.set_value(self.to_corrected(self.value))
        self.content_widget.set_draw_value(False);
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        if (low_label != ""):
            self.pack_start(self.low_label, False, False, 2)
        self.pack_start(self.content_widget, True, True, 2)
        if (hi_label != ""):
            self.pack_start(self.hi_label, False, False, 2)
        self._dragging = False
        self.content_widget.connect('value-changed', self.on_my_value_changed)
        self.content_widget.connect('button-press-event', self.on_mouse_down)
        self.content_widget.connect('button-release-event', self.on_mouse_up)
        self.content_widget.show_all()
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

# halt writing gsettings during dragging
# it can take a long time to process all
# those updates, and the system can crash

    def on_mouse_down(self, widget, event):
        self._dragging = True

    def on_mouse_up(self, widget, event):
        self._dragging = False
        self.on_my_value_changed(widget)

    def on_my_value_changed(self, widget):
        if self._dragging:
            return
        corrected = self.from_corrected(widget.get_value())
        if self.valtype == "int":
            self.settings.set_int(self.key, corrected)
        elif self.valtype == "uint":
            self.settings.set_uint(self.key, corrected)
        elif self.valtype == "double":
            self.settings.set_double(self.key, corrected)

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

    def to_corrected(self, value):
        result = 0.0
        if self.exponential:
            k = (math.log(self._max) - math.log(self._min)) / (self._range / self._step)
            a = self._max / math.exp(k * self._range)
            cur_val_step = (1 / (k / math.log(value / a))) / self._range
            if self.inverted:
                result = 1 - cur_val_step
            else:
                result = cur_val_step
        else:
            if self.inverted:
                result = 1 - ((value - self._min) / self._range)
            else:
                result = (value - self._min) / self._range
        return result

    def from_corrected(self, value):
        result = 0.0
        if self.exponential:
            k = (math.log(self._max)-math.log(self._min))/(self._range / self._step)
            a = self._max / math.exp(k * self._range)
            if self.inverted:
                cur_val_step = (1 - value) * self._range
                result = a * math.exp(k * cur_val_step)
            else:
                cur_val_step = value * self._range
                result =  a * math.exp(k * cur_val_step)
        else:
            if self.inverted:
                result = ((1 - value) * self._range) + self._min
            else:
                result =  (value * self._range) + self._min
        return round(result)

class AddCustomDialog(Gtk.Dialog):
    def __init__(self, edit_mode):
        if edit_mode:
            ok_button_label = _("Update")
        else:
            ok_button_label = _("Add")
        super(AddCustomDialog, self).__init__(_("Add custom shortcut"),
                                                None,
                                                0,
                                                (ok_button_label, Gtk.ResponseType.OK,
                                                _("Cancel"), Gtk.ResponseType.CANCEL))
        self.set_default_size(350, 100)
        name_box = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 2)
        command_box = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 2)
        name_box.pack_start(Gtk.Label(_("Name:")), False, False, 2)
        command_box.pack_start(Gtk.Label(_("Command:")), False, False, 2)
        self.name_entry = Gtk.Entry()
        self.name_entry.connect('changed', self.onEntriesChanged)
        self.command_entry  = Gtk.Entry()
        self.command_entry.connect('changed', self.onEntriesChanged)
        name_box.pack_start(self.name_entry, True, True, 2)
        command_box.pack_start(self.command_entry, True, True, 2)

        self.file_picker = Gtk.FileChooserButton(_("Select a file"), Gtk.FileChooserAction.OPEN)
        self.file_picker.connect('file-set', self.onFilePicked)
        command_box.pack_start(self.file_picker, False, False, 2)

        self.vbox.pack_start(name_box, True, True, 2)
        self.vbox.pack_start(command_box, True, True, 2)

        self.onEntriesChanged(self)

    def onFilePicked(self, widget):
        path = self.file_picker.get_uri()[7:]
        self.command_entry.set_text(path)

    def onEntriesChanged(self, widget):
        ok_enabled = self.name_entry.get_text().strip() is not "" and self.command_entry.get_text().strip() is not ""
        self.set_response_sensitive(Gtk.ResponseType.OK, ok_enabled)

class NotebookPage:
    def __init__(self, name):
        self.name = name
        self.widgets = []
        self.tab = Gtk.ScrolledWindow()
        self.content_box = Gtk.VBox()

    def add_widget(self, widget):
        self.widgets.append(widget)

    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        for widget in self.widgets:
            self.content_box.pack_start(widget, True, True, 2)
        self.tab.add_with_viewport(self.content_box)
        self.content_box.set_border_width(5)
        self.content_box.show_all()

class KeyboardSidePage (SidePage):
    def __init__(self, name, icon, content_box):
        SidePage.__init__(self, name, icon, content_box)
        self.tabs = []

    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        self.notebook = Gtk.Notebook()

        tab = NotebookPage(_("Typing"))
        tab.add_widget(GSettingsCheckButton(_("Enable key repeat"), "org.gnome.settings-daemon.peripherals.keyboard", "repeat", None))
        box = IndentedHBox()
        slider = KeyboardRange(_("Repeat delay:"), _("Short"), _("Long"), 100, 2000, False, "uint", False, "org.gnome.settings-daemon.peripherals.keyboard", "delay",
                                                                        "org.gnome.settings-daemon.peripherals.keyboard/repeat", adjustment_step = 10)
        box.pack_start(slider, True, True, 0)
        tab.add_widget(box)
        box = IndentedHBox()
        slider = KeyboardRange(_("Repeat speed:"), _("Slow"), _("Fast"), 20, 2000, True, "uint", True, "org.gnome.settings-daemon.peripherals.keyboard", "repeat-interval",
                                                                        "org.gnome.settings-daemon.peripherals.keyboard/repeat", adjustment_step = 1)
        box.pack_start(slider, True, True, 0)
        tab.add_widget(box)
        tab.add_widget(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
        
        tab.add_widget(GSettingsCheckButton(_("Text cursor blinks"), "org.gnome.desktop.interface", "cursor-blink", None))
        box = IndentedHBox()
        slider = KeyboardRange(_("Blink speed:"), _("Slow"), _("Fast"), 100, 2500, True, "int", False, "org.gnome.desktop.interface", "cursor-blink-time",
                                                                        "org.gnome.desktop.interface/cursor-blink", adjustment_step = 10)
        box.pack_start(slider, True, True, 0)
        tab.add_widget(box)
        tab.add_widget(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
        tab.add_widget(Gtk.Label(_("Test Box")))
        tab.add_widget(Gtk.Entry())
        self.addNotebookTab(tab)

        tab = NotebookPage(_("Keyboard shortcuts"))

        headingbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
        mainbox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 2)
        headingbox.pack_start(mainbox, True, True, 2)
        headingbox.pack_end(Gtk.Label(_("To edit a keyboard binding, click it and press the new keys, or press backspace to clear it.")), False, False, 1)

        left_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
        right_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
        
        category_scroller = Gtk.ScrolledWindow.new(None, None)
        category_scroller.set_shadow_type(Gtk.ShadowType.IN)
        
        kb_name_scroller = Gtk.ScrolledWindow.new(None, None)
        kb_name_scroller.set_shadow_type(Gtk.ShadowType.IN)
        
        entry_scroller = Gtk.ScrolledWindow.new(None, None)
        entry_scroller.set_shadow_type(Gtk.ShadowType.IN)
        
        right_vbox.pack_start(kb_name_scroller, False, False, 2)
        right_vbox.pack_start(entry_scroller, False, False, 2)
        kb_name_scroller.set_property('min-content-height', 150)
        entry_scroller.set_property('min-content-height', 100)
        self.cat_tree = Gtk.TreeView.new()        
        self.kb_tree = Gtk.TreeView.new()
        self.entry_tree = Gtk.TreeView.new()

        self.kb_tree.connect('row-activated', self.onCustomKeyBindingEdited)
        self.kb_tree.connect('button-press-event', self.onContextMenuPopup)
        self.kb_tree.connect('popup-menu', self.onContextMenuPopup)

        left_vbox.pack_start(category_scroller, True, True, 2)
                
        category_scroller.add(self.cat_tree)
        category_scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER)
        kb_name_scroller.add(self.kb_tree)
        kb_name_scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
        entry_scroller.add(self.entry_tree)
        entry_scroller.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER)

        buttonbox = Gtk.ButtonBox.new(Gtk.Orientation.HORIZONTAL)
        self.add_custom_button = Gtk.Button(_("Add custom shortcut"))
        self.add_custom_button.connect('clicked', self.onAddCustomButtonClicked)
        self.remove_custom_button = Gtk.Button(_("Remove custom shortcut"))
        self.remove_custom_button.connect('clicked', self.onRemoveCustomButtonClicked)
        self.remove_custom_button.set_property('sensitive', False)
        buttonbox.pack_start(self.add_custom_button, False, False, 2)
        buttonbox.pack_start(self.remove_custom_button, False, False, 2)

        right_vbox.pack_end(buttonbox, False, False, 2)

        mainbox.pack_start(left_vbox, False, False, 2)
        mainbox.pack_start(right_vbox, True, True, 2)

        left_vbox.set_border_width(2)
        right_vbox.set_border_width(2)

        self.cat_store = Gtk.ListStore(str,     # The category name
                                       object)  # The category object

        self.kb_store = Gtk.ListStore( str,   # Keybinding name
                                       object)# The keybinding object

        self.entry_store = Gtk.ListStore( str, # Keybinding entry
                                          object) # Keybinding object

        cell = Gtk.CellRendererText()
        cell.set_alignment(.5,0)
        cat_column = Gtk.TreeViewColumn(_("Categories"), cell, text=0)
        cat_column.set_alignment(.5)
        cat_column.set_property('min-width', 200)

        self.cat_tree.append_column(cat_column)
        self.cat_tree.connect("cursor-changed", self.onCategoryChanged)

        kb_name_cell = Gtk.CellRendererText()
        kb_name_cell.set_alignment(.5,.5)
        kb_column = Gtk.TreeViewColumn(_("Keyboard shortcuts"), kb_name_cell, text=0)
        kb_column.set_alignment(.5)
        self.kb_tree.append_column(kb_column)
        self.kb_tree.connect("cursor-changed", self.onKeyBindingChanged)

        entry_cell = Gtk.CellRendererAccel()
        entry_cell.set_alignment(.5,.5)
        entry_cell.connect('accel-edited', self.onEntryChanged, self.entry_store)
        entry_cell.connect('accel-cleared', self.onEntryCleared, self.entry_store)
        entry_cell.set_property('editable', True)

        try:  # Only Ubuntu allows MODIFIER_TAP - using a single modifier as a keybinding
            entry_cell.set_property('accel-mode', Gtk.CellRendererAccelMode.MODIFIER_TAP)
        except Exception:  # Pure GTK does not, so use OTHER
            entry_cell.set_property('accel-mode', Gtk.CellRendererAccelMode.OTHER)

        entry_column = Gtk.TreeViewColumn(_("Keyboard bindings"), entry_cell, text=0)
        entry_column.set_alignment(.5)
        self.entry_tree.append_column(entry_column)

        self.main_store = []

        # categories                                Display name        internal category
        self.main_store.append(KeyBindingCategory("Cinnamon", "cinnamon"))
        self.main_store.append(KeyBindingCategory(_("Windows"), "windows"))
        self.main_store.append(KeyBindingCategory(_("Workspace Management"), "ws-manage"))
        self.main_store.append(KeyBindingCategory(_("System"), "system"))
        self.main_store.append(KeyBindingCategory(_("Launchers"), "launchers"))
        self.main_store.append(KeyBindingCategory(_("Sound and Media"), "media"))
        self.main_store.append(KeyBindingCategory(_("Universal Access"), "accessibility"))
        self.main_store.append(KeyBindingCategory(_("Custom Shortcuts"), "custom"))

        for binding in KEYBINDINGS:
            for category in self.main_store:
                if category.int_name == binding[4]:
                    category.add(KeyBinding(binding[0], binding[1], binding[2], binding[3], binding[4]))
      #              print bindings.index(binding)  # remove, only for catching segfaults when adding bindings

        for category in self.main_store:
            self.cat_store.append((category.label, category))

        self.loadCustoms()
        self.cat_tree.set_model(self.cat_store)
        self.kb_tree.set_model(self.kb_store)
        self.entry_tree.set_model(self.entry_store)

        tab.add_widget(headingbox)
        self.addNotebookTab(tab)

        self.content_box.add(self.notebook)
        for tab in self.tabs:
            tab.build()
        self.content_box.show_all()

    def addNotebookTab(self, tab):
        self.notebook.append_page(tab.tab, Gtk.Label(tab.name))
        self.tabs.append(tab)

    def onCategoryChanged(self, tree):
        self.kb_store.clear()
        if tree.get_selection() is not None:
            categories, iter = tree.get_selection().get_selected()
            if iter:
                category = categories[iter][1]
                if category.int_name is not "custom":
                    for keybinding in category.keybindings:
                        self.kb_store.append((keybinding.label, keybinding))
                else:
                    self.loadCustoms()
            self.remove_custom_button.set_property('sensitive', False)

    def loadCustoms(self):
        for category in self.main_store:
            if category.int_name is "custom":
                category.clear()
        gclient = gconf.client_get_default()
        path = "/desktop/gnome/keybindings"
        subdirs = gclient.all_dirs(path)
        for subdir in subdirs:
            custom_kb = CustomKeyBinding(subdir,
                                         gclient.get_string(subdir+"/name"),
                                         gclient.get_string(subdir+"/action"),
                                         gclient.get_string(subdir+"/binding"))
            self.kb_store.append((custom_kb.label, custom_kb))
            for category in self.main_store:
                if category.int_name is "custom":
                    category.add(custom_kb)

    def onKeyBindingChanged(self, tree):
        self.entry_store.clear()
        if tree.get_selection() is not None:
            keybindings, iter = tree.get_selection().get_selected()
            if iter:
                keybinding = keybindings[iter][1]
                if isinstance(keybinding, KeyBinding):
                    for entry in keybinding.entries:
                        if entry is not "_invalid_":
                            self.entry_store.append((clean_kb(entry), entry))
                    self.remove_custom_button.set_property('sensitive', False)
                else:
                    self.entry_store.append((clean_kb(keybinding.entries[0]), keybinding))
                    self.remove_custom_button.set_property('sensitive', True)


    def onEntryChanged(self, cell, path, keyval, mask, keycode, entry_store):
        accel_string = Gtk.accelerator_name(keyval, mask)
        accel_string = accel_string.replace("<Mod2>", "")
        iter = entry_store.get_iter(path)
        keybindings, kb_iter = self.kb_tree.get_selection().get_selected()
        if kb_iter:
            current_keybinding = keybindings[kb_iter][1]
        # Check for bad keys or modifiers
        if (mask == 0 or mask == Gdk.ModifierType.SHIFT_MASK) and keycode != 0:
            if ((keyval >= Gdk.KEY_a and keyval <= Gdk.KEY_z)
            or (keyval >= Gdk.KEY_A and keyval <= Gdk.KEY_Z)
            or (keyval >= Gdk.KEY_0 and keyval <= Gdk.KEY_9)
            or (keyval >= Gdk.KEY_kana_fullstop and keyval <= Gdk.KEY_semivoicedsound)
            or (keyval >= Gdk.KEY_Arabic_comma and keyval <= Gdk.KEY_Arabic_sukun)
            or (keyval >= Gdk.KEY_Serbian_dje and keyval <= Gdk.KEY_Cyrillic_HARDSIGN)
            or (keyval >= Gdk.KEY_Greek_ALPHAaccent and keyval <= Gdk.KEY_Greek_omega)
            or (keyval >= Gdk.KEY_hebrew_doublelowline and keyval <= Gdk.KEY_hebrew_taf)
            or (keyval >= Gdk.KEY_Thai_kokai and keyval <= Gdk.KEY_Thai_lekkao)
            or (keyval >= Gdk.KEY_Hangul and keyval <= Gdk.KEY_Hangul_Special)
            or (keyval >= Gdk.KEY_Hangul_Kiyeog and keyval <= Gdk.KEY_Hangul_J_YeorinHieuh)
            or keyval in FORBIDDEN_KEYVALS):
                dialog = Gtk.MessageDialog(None,
                                    Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                    Gtk.MessageType.ERROR,
                                    Gtk.ButtonsType.OK,
                                    None)
                dialog.set_default_size(400, 200)
                msg = _("\nThis key combination, \'<b>%s</b>\' cannot be used because it would become impossible to type using this key.\n\n")
                msg += _("Please try again with a modifier key such as Control, Alt or Super (Windows key) at the same time.\n")
                dialog.set_markup(msg % clean_kb(accel_string))
                dialog.show_all()
                response = dialog.run()
                dialog.destroy()
                return

        # Check for duplicates
        for category in self.main_store:
            for keybinding in category.keybindings:
                for entry in keybinding.entries:
                    if accel_string == entry and keybinding.label != current_keybinding.label:
                        dialog = Gtk.MessageDialog(None,
                                    Gtk.DialogFlags.DESTROY_WITH_PARENT,
                                    Gtk.MessageType.QUESTION,
                                    Gtk.ButtonsType.YES_NO,
                                    None)
                        dialog.set_default_size(400, 200)
                        msg = _("This key combination, \'<b>%s</b>\' is currently in use by \'<b>%s</b>\'.  ")
                        msg += _("If you continue, the combination will be reassigned to \'<b>%s</b>.\'\n\n")
                        msg += _("Do you want to continue with this operation?")
                        dialog.set_markup(msg % (clean_kb(accel_string), cgi.escape(keybinding.label), cgi.escape(current_keybinding.label)))
                        dialog.show_all()
                        response = dialog.run()
                        dialog.destroy()
                        if response == Gtk.ResponseType.YES:
                            keybinding.setBinding(keybinding.entries.index(accel_string), None)
                        elif response == Gtk.ResponseType.NO:
                            return
        current_keybinding.setBinding(int(path), accel_string)
        self.onKeyBindingChanged(self.kb_tree)
        self.entry_tree.get_selection().select_path(path)

    def onEntryCleared(self, cell, path, entry_store):
        iter = entry_store.get_iter(path)
        keybindings, kb_iter = self.kb_tree.get_selection().get_selected()
        if kb_iter:
            current_keybinding = keybindings[kb_iter][1]
        current_keybinding.setBinding(int(path), None)
        self.onKeyBindingChanged(self.kb_tree)
        self.entry_tree.get_selection().select_path(path)

    def onAddCustomButtonClicked(self, button):
        dialog = AddCustomDialog(False)

        dialog.show_all()
        response = dialog.run()
        if response == Gtk.ResponseType.CANCEL:
            dialog.destroy()
            return

        gclient = gconf.client_get_default()
        path = "/desktop/gnome/keybindings/custom"
        i = 0
        while gclient.dir_exists(path + str(i)):
            i += 1
        new_path = path + str(i)
        gclient.set_string(new_path + "/name", dialog.name_entry.get_text())
        gclient.set_string(new_path + "/action", dialog.command_entry.get_text())
        gclient.set_string(new_path + "/binding", "")
        i = 0
        for cat in self.cat_store:
            if cat[1].int_name is "custom":
                self.cat_tree.set_cursor(str(i), self.cat_tree.get_column(0), False)
            i += 1
        i = 0
        for keybinding in self.kb_store:
            if keybinding[0] == dialog.name_entry.get_text():
                self.kb_tree.set_cursor(str(i), self.kb_tree.get_column(0), False)
            i += 1
        dialog.destroy()

    def onRemoveCustomButtonClicked(self, button):
        keybindings, iter = self.kb_tree.get_selection().get_selected()
        if iter:
            keybinding = keybindings[iter][1]
            gclient = gconf.client_get_default()
            if gclient.dir_exists(keybinding.path):
                gclient.unset(keybinding.path + "/name")
                gclient.unset(keybinding.path + "/action")
                gclient.unset(keybinding.path + "/binding")
        i = 0
        for cat in self.cat_store:
            if cat[1].int_name is "custom":
                self.cat_tree.set_cursor(str(i), self.cat_tree.get_column(0), False)
            i += 1

    def onCustomKeyBindingEdited(self, kb_treeview, column, kb_column):
        keybindings, iter = kb_treeview.get_selection().get_selected()
        if iter:
            keybinding = keybindings[iter][1]
            if isinstance(keybinding, KeyBinding):
                return
            else:
                dialog = AddCustomDialog(True)
                dialog.name_entry.set_text(keybinding.label)
                dialog.command_entry.set_text(keybinding.action)
                dialog.show_all()
                response = dialog.run()
                if response == Gtk.ResponseType.CANCEL:
                    dialog.destroy()
                    return
                gclient = gconf.client_get_default()
                gclient.set_string(keybinding.path + "/name", dialog.name_entry.get_text())
                gclient.set_string(keybinding.path + "/action", dialog.command_entry.get_text())
                i = 0
                for cat in self.cat_store:
                    if cat[1].int_name is "custom":
                        self.cat_tree.set_cursor(str(i), self.cat_tree.get_column(0), False)
                    i += 1
                i = 0
                for keybinding in self.kb_store:
                    if keybinding[0] == dialog.name_entry.get_text():
                        self.kb_tree.set_cursor(str(i), self.kb_tree.get_column(0), False)
                    i += 1
                dialog.destroy()

    def onContextMenuPopup(self, tree, event = None):
        model, iter = tree.get_selection().get_selected()
        if iter:
            keybinding = model[iter][1]
            if isinstance(keybinding, CustomKeyBinding):
                return
            if event:
                if event.button != 3:
                    return
                button = event.button
                event_time = event.time
                info = tree.get_path_at_pos(int(event.x), int(event.y))
                if info is not None:
                    path, col, cellx, celly = info
                    tree.grab_focus()
                    tree.set_cursor(path, col, 0)
            else: 
                path = model.get_path(iter)
                button = 0
                event_time = 0
                tree.grab_focus()
            popup = Gtk.Menu()
            popup.attach_to_widget(tree, None)
            popup_reset_item = Gtk.MenuItem(_("Reset to default"))
            popup_reset_item.show()
            popup.append(popup_reset_item)
            popup_reset_item.connect('activate', self.onResetToDefault, keybinding)
            popup.popup(None, None, None, None, button, event_time)
            return True

    def onResetToDefault(self, popup, keybinding):
        keybinding.resetDefaults()
        self.onKeyBindingChanged(self.kb_tree)

class HotCornerViewSidePage(SidePage):
    def __init__(self, name, icon, content_box):   
        SidePage.__init__(self, name, icon, content_box)

        self.hc_list = Gtk.ListStore(int, str)

        self.hc_list.append([0, _("Top Left")])
        self.hc_list.append([1, _("Top Right")])
        self.hc_list.append([2, _("Bottom Left")])
        self.hc_list.append([3, _("Bottom Right")])

        self.function_list = Gtk.ListStore(str, str)
        self.function_list.append(['expo', "Expo"])
        self.function_list.append(['scale', "Scale"])
        self.function_list.append(['custom', _("Custom")])

        self.hc_selected = 0

        self.custom_command = ""
        
        self.settings = Gio.Settings.new('org.cinnamon')
        self.settings.connect('changed::overview-corner', self.on_settings_changed)
        oc_list = self.settings.get_strv("overview-corner")
        self.properties = []
        for item in oc_list:
            props = item.split(":")
            self.properties.append(props)

        self.enabled_check_button = None
        self.visible_check_button = None

    def on_settings_changed(self, settings, key):
        oc_list = self.settings.get_strv("overview-corner")
        del self.properties[:]
        for item in oc_list:
            props = item.split(":")
            self.properties.append(props)
        self.update()

    def update(self):
        if self.enabled_check_button != None:
            self.enabled_check_button.set_active(self.properties[self.hc_selected][1] == "true")
            self.visible_check_button.set_active(self.properties[self.hc_selected][2] == "true")
            action_no = 2
            action = self.properties[self.hc_selected][0]
            if action == "expo":
                action_no = 0
            elif action == "scale":
                action_no = 1
            self.func_combo.set_active(action_no)

    def build(self):
        # Clear all existing widgets
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)

        # Hot corner position
        pos_box = Gtk.Box(Gtk.Orientation.HORIZONTAL)
        self.content_box.pack_start(pos_box, False, False, 0)

        pos_label = Gtk.Label(_("Hot corner position:"))
        pos_box.pack_start(pos_label, False, False, 0)

        pos_combo = Gtk.ComboBox.new_with_model(self.hc_list)
        renderer_text= Gtk.CellRendererText()
        pos_combo.pack_start(renderer_text, True)
        pos_combo.add_attribute(renderer_text, "text", 1)
        pos_combo.set_active(0)
        pos_combo.connect('changed', self.on_pos_changed)
        pos_box.pack_start(pos_combo, True, True, 0)

        label = Gtk.Label()
        label.set_markup("<i><small>Select the hot corner you wish to configure</small></i>")
        self.content_box.pack_start(label, False, False, 0)

        # Hot corner enabled
        box = IndentedHBox()
        self.enabled_check_button = Gtk.CheckButton(_("Hot corner enabled"))
        box.add(self.enabled_check_button)
        self.content_box.pack_start(box, False, False, 0)

        # Hot corner icon visible
        box = IndentedHBox()
        self.visible_check_button = Gtk.CheckButton(_("Hot corner icon visible"))
        box.add(self.visible_check_button)
        self.content_box.pack_start(box, False, False, 0)

        # Hot corner function
        box = IndentedHBox()
        box.add(Gtk.Label(_("Hot corner function:")))
        self.func_combo = Gtk.ComboBox.new_with_model(self.function_list)
        renderer_text = Gtk.CellRendererText()
        self.func_combo.pack_start(renderer_text, True)
        self.func_combo.add_attribute(renderer_text, "text", 1)
        box.add(self.func_combo)
        self.content_box.pack_start(box, False, False, 0)

        # Hot corner custom function
        box = IndentedHBox()
        box2 = IndentedHBox() # Indent by two levels
        box2.add(box)
        self.content_box.pack_start(box2, False, False, 0)

        box2.add(Gtk.Label(_("Enter custom command: ")))
        self.custom_command_entry = Gtk.Entry()
        box2.add(self.custom_command_entry)

        # Signals
        self.enabled_check_button.connect('toggled', self.on_enabled_changed)
        self.visible_check_button.connect('toggled', self.on_visible_changed)
        self.func_combo.connect('changed', self.on_func_combo_changed)
        self.custom_command_entry.connect('changed', self.on_search_entry_changed)
        self.on_settings_changed(self.settings, "overview-corner")

    def on_pos_changed(self, widget):
        titer = widget.get_active_iter()
        if titer != None:
            self.hc_selected = self.hc_list[titer][0]
            self.update()

    def on_enabled_changed(self, widget):
        value = "false"
        if widget.get_active():
            value = "true"
        self.properties[self.hc_selected][1] = value
        self.write_settings()

    def on_visible_changed(self, widget):
        value = "false"
        if widget.get_active():
            value = "true"
        self.properties[self.hc_selected][2] = value
        self.write_settings()

    def on_func_combo_changed(self, widget):
        value = widget.get_active()
        if value == 2:
            self.custom_command_entry.set_sensitive(True)
            value = self.properties[self.hc_selected][0]
            if value == "expo" or value == "scale":
                value = ""
            self.custom_command_entry.set_text(value)
        else:
            self.custom_command_entry.set_sensitive(False)
            self.custom_command_entry.set_text("")
            titer = widget.get_active_iter()
            self.properties[self.hc_selected][0] = self.function_list[titer][0]
            self.write_settings()

    def on_search_entry_changed(self, widget):
        if self.func_combo.get_active() == 2:
            self.properties[self.hc_selected][0] = widget.get_text()
            self.write_settings()

    def write_settings(self):
        oc_list = []
        for prop in self.properties:
            oc_list.append(":".join(prop))
        self.settings.set_strv("overview-corner", oc_list)

class GConfCheckButton(Gtk.CheckButton):    
    def __init__(self, label, key):        
        self.key = key
        super(GConfCheckButton, self).__init__(label)       
        self.settings = gconf.client_get_default()
        self.set_active(self.settings.get_bool(self.key))
        self.settings.notify_add(self.key, self.on_my_setting_changed)
        self.connect('toggled', self.on_my_value_changed)            
    
    def on_my_setting_changed(self, client, cnxn_id, entry):
        value = entry.value.get_bool()
        self.set_active(value)
        
    def on_my_value_changed(self, widget):
        self.settings.set_bool(self.key, self.get_active())


class GSettingsCheckButton(Gtk.CheckButton):    
    def __init__(self, label, schema, key, dep_key):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsCheckButton, self).__init__(label)
        self.settings = Gio.Settings.new(schema)        
        self.set_active(self.settings.get_boolean(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.connectorId = self.connect('toggled', self.on_my_value_changed)
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_setting_changed(self, settings, key):
        self.disconnect(self.connectorId)                     #  panel-edit-mode can trigger changed:: twice in certain instances,
        self.set_active(self.settings.get_boolean(self.key))  #  so disconnect temporarily when we are simply updating the widget state
        self.connectorId = self.connect('toggled', self.on_my_value_changed)

    def on_my_value_changed(self, widget):
        self.settings.set_boolean(self.key, self.get_active())

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class DBusCheckButton(Gtk.CheckButton):    
    def __init__(self, label, service, path, get_method, set_method):        
        super(DBusCheckButton, self).__init__(label)     
        proxy = dbus.SystemBus().get_object(service, path)
        self.dbus_iface = dbus.Interface(proxy, dbus_interface=service)
        self.dbus_get_method = get_method
        self.dbus_set_method = set_method
        self.set_active(getattr(self.dbus_iface, get_method)()[1])
        self.connect('toggled', self.on_my_value_changed)
        
    def on_my_value_changed(self, widget):
        getattr(self.dbus_iface, self.dbus_set_method)(self.get_active())

class NtpCheckButton(Gtk.CheckButton):
    def __init__(self, label):
        super(NtpCheckButton, self).__init__(label)
        self.date_time_wrapper = DateTimeWrapper()
        self.set_active(self.date_time_wrapper.get_using_ntp())
        self.connect('toggled', self.on_my_value_changed)

    def on_my_value_changed(self, widget):
        self.date_time_wrapper.set_using_ntp(self.get_active())

class GSettingsSpinButton(Gtk.HBox):    
    def __init__(self, label, schema, key, dep_key, min, max, step, page, units):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsSpinButton, self).__init__()        
        self.label = Gtk.Label(label)       
        self.content_widget = Gtk.SpinButton()
        self.units = Gtk.Label(units)        
        if (label != ""):       
            self.pack_start(self.label, False, False, 2)                
        self.pack_start(self.content_widget, False, False, 2)              
        if (units != ""):
            self.pack_start(self.units, False, False, 2)              
        
        self.content_widget.set_range(min, max)
        self.content_widget.set_increments(step, page)
        #self.content_widget.set_editable(False)
        self.settings = Gio.Settings.new(schema)        
        self.content_widget.set_value(self.settings.get_int(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.content_widget.connect('focus-out-event', self.on_my_value_changed)
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_setting_changed(self, settings, key):
        self.content_widget.set_value(self.settings.get_int(self.key))

    def on_my_value_changed(self, widget, data):
        self.settings.set_int(self.key, self.content_widget.get_value())

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class GSettingsEntry(Gtk.HBox):    
    def __init__(self, label, schema, key, dep_key):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsEntry, self).__init__()
        self.label = Gtk.Label(label)       
        self.content_widget = Gtk.Entry()
        self.pack_start(self.label, False, False, 5)        
        self.add(self.content_widget)     
        self.settings = Gio.Settings.new(schema)        
        self.content_widget.set_text(self.settings.get_string(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.content_widget.connect('focus-out-event', self.on_my_value_changed)     
        self.content_widget.show_all()
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_setting_changed(self, settings, key):
        self.content_widget.set_text(self.settings.get_string(self.key))

    def on_my_value_changed(self, event, widget):        
        self.settings.set_string(self.key, self.content_widget.get_text())

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))


class GSettingsFileChooser(Gtk.HBox):
    def __init__(self, label, schema, key, dep_key, show_none_cb = False):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsFileChooser, self).__init__()
        self.label = Gtk.Label(label)       
        self.content_widget = Gtk.FileChooserButton()
        self.pack_start(self.label, False, False, 2)
        self.add(self.content_widget)
        self.settings = Gio.Settings.new(schema)
        value = self.settings.get_string(self.key)     
        if show_none_cb:
            self.show_none_cb = Gtk.CheckButton(_("None"))
            self.show_none_cb.set_active(value=="")
            self.pack_start(self.show_none_cb, False, False, 5)
        else:
            self.show_none_cb = None
        if value=="":
            self.content_widget.set_sensitive(False)
        else:
            self.content_widget.set_filename(value)
        self.content_widget.connect('file-set', self.on_my_value_changed)
        self.show_none_cb.connect('toggled', self.on_my_value_changed)
        self.content_widget.show_all()
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_value_changed(self, widget):
        if self.show_none_cb.get_active():
            value = ""
            self.content_widget.set_sensitive(False)
        else:
            value = self.content_widget.get_filename()
            if value==None:
                value = ""
            self.content_widget.set_sensitive(True)
        self.settings.set_string(self.key, value)

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class GSettingsFontButton(Gtk.HBox):
    def __init__(self, label, schema, key, dep_key):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsFontButton, self).__init__()
        self.settings = Gio.Settings.new(schema)
        self.value = self.settings.get_string(key)
        
        self.label = Gtk.Label(label)

        self.content_widget = Gtk.FontButton()
        self.content_widget.set_font_name(self.value)
        
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, False, False, 2)
        self.content_widget.connect('font-set', self.on_my_value_changed)
        self.content_widget.show_all()
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_value_changed(self, widget):
        self.settings.set_string(self.key, widget.get_font_name())

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class GConfFontButton(Gtk.HBox):
    def __init__(self, label, key):
        self.key = key
        super(GConfFontButton, self).__init__()
        self.settings = gconf.client_get_default()
        self.value = self.settings.get_string(key)
        
        self.label = Gtk.Label(label)

        self.content_widget = Gtk.FontButton()
        self.content_widget.set_font_name(self.value)
        
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, False, False, 2)
        self.content_widget.connect('font-set', self.on_my_value_changed)
        self.content_widget.show_all()
    def on_my_value_changed(self, widget):
        self.settings.set_string(self.key, widget.get_font_name())

class GSettingsRange(Gtk.HBox):
    def __init__(self, label, schema, key, dep_key, **options):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsRange, self).__init__()
        self.settings = Gio.Settings.new(schema)
        self.value = self.settings.get_double(self.key)
        
        self.label = Gtk.Label(label)

        #returned variant is range:(min, max)
        _min, _max = self.settings.get_range(self.key)[1]

        self.content_widget = Gtk.HScale.new_with_range(_min, _max, options.get('adjustment_step', 1))
        self.content_widget.set_value(self.value)
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, True, True, 2)
        self.content_widget.connect('value-changed', self.on_my_value_changed)
        self.content_widget.show_all()
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_value_changed(self, widget):
        self.settings.set_double(self.key, widget.get_value())

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class GSettingsRangeSpin(Gtk.HBox):
    def __init__(self, label, schema, key, dep_key, **options):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsRangeSpin, self).__init__()
        self.label = Gtk.Label(label)
        self.content_widget = Gtk.SpinButton()

        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, False, False, 2)

        self.settings = Gio.Settings.new(schema)

        _min, _max = self.settings.get_range(self.key)[1]
        _increment = options.get('adjustment_step', 1)

        self.content_widget.set_range(_min, _max)
        self.content_widget.set_increments(_increment, _increment)
        #self.content_widget.set_editable(False)
        self.content_widget.set_digits(1)
        self.content_widget.set_value(self.settings.get_double(self.key))

        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.content_widget.connect('value-changed', self.on_my_value_changed)
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_setting_changed(self, settings, key):
        self.content_widget.set_value(self.settings.get_double(self.key))

    def on_my_value_changed(self, widget):
        self.settings.set_double(self.key, self.content_widget.get_value())

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class GSettingsComboBox(Gtk.HBox):    
    def __init__(self, label, schema, key, dep_key, options):
        self.key = key
        self.dep_key = dep_key
        super(GSettingsComboBox, self).__init__()
        self.settings = Gio.Settings.new(schema)        
        self.value = self.settings.get_string(self.key)
                      
        self.label = Gtk.Label(label)       
        self.model = Gtk.ListStore(str, str)
        selected = None
        for option in options:
            iter = self.model.insert_before(None, None)
            self.model.set_value(iter, 0, option[0])                
            self.model.set_value(iter, 1, option[1])                        
            if (option[0] == self.value):
                selected = iter
                                
        self.content_widget = Gtk.ComboBox.new_with_model(self.model)   
        renderer_text = Gtk.CellRendererText()
        self.content_widget.pack_start(renderer_text, True)
        self.content_widget.add_attribute(renderer_text, "text", 1)     
        
        if selected is not None:
            self.content_widget.set_active_iter(selected)
        
        if (label != ""):
            self.pack_start(self.label, False, False, 2)                
        self.pack_start(self.content_widget, False, False, 2)                     
        self.content_widget.connect('changed', self.on_my_value_changed)
        self.content_widget.show_all()
        self.dependency_invert = False
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:            
            value = self.model[tree_iter][0]            
            self.settings.set_string(self.key, value)

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))

class TimeZoneSelectorWidget(Gtk.HBox):
    def __init__(self):
        super(TimeZoneSelectorWidget, self).__init__()
        
        self.date_time_wrapper = DateTimeWrapper()
        
        self.timezones = tz.load_db()
        
        self.selected_region, self.selected_city = self.get_selected_zone()
        
        region_label = Gtk.Label(_("Region"))
        self.pack_start(region_label, False, False, 2)
        
        regions = self.timezones.keys()
        regions.sort()
        self.region_model = Gtk.ListStore(str, str)
        selected_region_iter = None
        for region in regions:
            iter = self.region_model.insert_before(None, None)
            self.region_model.set_value(iter, 0, region)                
            self.region_model.set_value(iter, 1, region.replace("_", " "))                        
            if (region == self.selected_region):
                selected_region_iter = iter
                                
        self.region_widget = Gtk.ComboBox.new_with_model(self.region_model)   
        renderer_text = Gtk.CellRendererText()
        self.region_widget.pack_start(renderer_text, True)
        self.region_widget.add_attribute(renderer_text, "text", 1)
        if selected_region_iter is not None:
            self.region_widget.set_active_iter(selected_region_iter)
        self.pack_start(self.region_widget, False, False, 2)
        
        city_label = Gtk.Label(_("City"))
        self.pack_start(city_label, False, False, 2)
        
        self.city_model = Gtk.ListStore(str, str)
        self.city_widget = Gtk.ComboBox.new_with_model(self.city_model)   
        renderer_text = Gtk.CellRendererText()
        self.city_widget.pack_start(renderer_text, True)
        self.city_widget.add_attribute(renderer_text, "text", 1)
        self.pack_start(self.city_widget, False, False, 2)
        
        self.update_cities_list()
        
        self.region_widget.connect("changed", self.on_region_changed)
        self.city_widget.connect("changed", self.on_city_changed)
    def on_city_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            self.selected_city = self.city_model[tree_iter][0]
            self.date_time_wrapper.set_timezone(self.selected_region+"/"+self.selected_city)
    def on_region_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:            
            self.selected_region = self.region_model[tree_iter][0]
            self.update_cities_list()
    def update_cities_list(self):
        self.city_model.clear()
        if self.selected_region and self.selected_region in self.timezones.keys():
            cities = self.timezones[self.selected_region]
            cities.sort()
            selected_city_iter = None
            for city in cities:
                iter = self.city_model.insert_before(None, None)
                self.city_model.set_value(iter, 0, city)                
                self.city_model.set_value(iter, 1, city.replace("_", " "))                        
                if (city == self.selected_city):
                    selected_city_iter = iter
            if selected_city_iter is not None:
                self.city_widget.set_active_iter(selected_city_iter)
    def get_selected_zone(self):
        tz = self.date_time_wrapper.get_timezone()
        if "/" in tz:
            i = tz.index("/")
            region = tz[:i]
            city = tz[i+1:]
            return region, city
        else:
            return "", ""
            
class ChangeTimeWidget(Gtk.HBox):
    def __init__(self):
        super(ChangeTimeWidget, self).__init__()
        self.date_time_wrapper = DateTimeWrapper()
        
        # Ensures we are setting the system time only when the user changes it
        self.changedOnTimeout = False
        
        # Ensures we do not update the values in the date/time fields during the DBus call to set the time
        self._setting_time = False
        self._setting_time_lock = thread.allocate()
        self._time_to_set = None
        
        self.thirtyDays = [3, 5, 8, 10]
        months = ['January','February','March','April','May','June','July','August','September','October','November','December']
        
        # Boxes
        timeBox = Gtk.HBox()
        dateBox = Gtk.HBox()
        
        # Combo Boxes
        self.monthBox = Gtk.ComboBoxText()
        
        for month in months:
            self.monthBox.append_text(month)
        
        # Adjustments
        hourAdj = Gtk.Adjustment(0, 0, 23, 1, 1)
        minAdj = Gtk.Adjustment(0, 0, 59, 1, 1)
        yearAdj = Gtk.Adjustment(0, 0, 9999, 1, 5)
        dayAdj = Gtk.Adjustment(0, 1, 31, 1, 1)
        
        # Spin buttons
        self.hourSpin = Gtk.SpinButton()
        self.minSpin = Gtk.SpinButton()
        self.yearSpin = Gtk.SpinButton()
        self.daySpin = Gtk.SpinButton()
        
        self.hourSpin.configure(hourAdj, 0.5, 0)
        self.minSpin.configure(minAdj, 0.5, 0)
        self.yearSpin.configure(yearAdj, 0.5, 0)
        self.daySpin.configure(dayAdj, 0.5, 0)
        #self.hourSpin.set_editable(False)
        #self.minSpin.set_editable(False)
        #self.yearSpin.set_editable(False)
        #self.daySpin.set_editable(False)
        
        self.update_time()
        GObject.timeout_add(1000, self.update_time)
        
        # Connect to callback
        self.hourSpin.connect('changed', self._change_system_time)
        self.minSpin.connect('changed', self._change_system_time)
        self.monthBox.connect('changed', self._change_system_time)
        self.yearSpin.connect('changed', self._change_system_time)
        self.daySpin.connect('changed', self._change_system_time)
        
        timeBox.pack_start(self.hourSpin, False, False, 2)
        timeBox.pack_start(Gtk.Label(_(":")), False, False, 2)
        timeBox.pack_start(self.minSpin, False, False, 2)
        
        dateBox.pack_start(self.monthBox, False, False, 2)
        dateBox.pack_start(self.daySpin, False, False, 2)
        dateBox.pack_start(self.yearSpin, False, False, 2)
        
        self.pack_start(Gtk.Label(_("Date : ")), False, False, 2)
        self.pack_start(dateBox, True, True, 2)
        self.pack_start(Gtk.Label(_("Time : ")), False, False, 2)
        self.pack_start(timeBox, True, True, 2)
        
    def update_time(self):
        self._setting_time_lock.acquire()
        do_update = not self._setting_time
        self._setting_time_lock.release()
        
        if not do_update:
            return True
        
        dt = datetime.now()
        
        self.changedOnTimeout = True
        
        # Time
        self.hourSpin.set_value( dt.hour )
        self.minSpin.set_value( dt.minute )
        
        # Date
        self.monthBox.set_active( dt.month-1 )
        self.daySpin.set_value( dt.day )
        self.yearSpin.set_value( dt.year )
        
        self.changedOnTimeout = False
        
        # Update the max of the day spin box
        maxDay = 31
        if dt.month == 2:
            if dt.year % 4 == 0:
                maxDay = 29
            else:
                maxDay = 28
        elif dt.month-1 in self.thirtyDays:
            maxDay = 30
            
        self.daySpin.get_adjustment().set_upper(maxDay)
        
        return True
        
    def change_using_ntp(self, usingNtp):
        # Check if we were using Ntp by seeing if the spin button
        # is sensitive
        self.set_sensitive(not usingNtp)
    
    def _do_change_system_time(self):
        self._setting_time_lock.acquire()
        do_set = not self._setting_time
        self._setting_time = True
        self._setting_time_lock.release()
        
        # If there is already another thread updating the time, we let it do the job
        if not do_set:
            return
        
        done = False
        while not done:
            self._setting_time_lock.acquire()
            time_to_set = self._time_to_set
            self._time_to_set = None
            self._setting_time_lock.release()
            
            self.date_time_wrapper.set_time(time_to_set)
            
            # Check whether another request to set the time was done since this thread started
            self._setting_time_lock.acquire()
            if self._time_to_set==None:
                done = True
            self._setting_time_lock.release()
        
        self._setting_time_lock.acquire()
        self._setting_time = False
        self._setting_time_lock.release()
                
    def _change_system_time(self, widget):
        if not self.changedOnTimeout:
            hour = int( self.hourSpin.get_value() )
            minute = int( self.minSpin.get_value() )
            month = self.monthBox.get_active() + 1
            day = int( self.daySpin.get_value() )
            year = int( self.yearSpin.get_value() )
            
            newDt = datetime(year, month, day, hour, minute)
            
            self._setting_time_lock.acquire()
            self._time_to_set = time.mktime(newDt.utctimetuple())
            self._setting_time_lock.release()
            
            thread.start_new_thread(self._do_change_system_time, ())

class TitleBarButtonsOrderSelector(Gtk.Table):
    def __init__(self):        
        self.schema = "org.cinnamon.overrides"
        self.key = "button-layout"
        
        super(TitleBarButtonsOrderSelector, self).__init__()
        
        self.settings = Gio.Settings.new(self.schema)        
        self.value = self.settings.get_string(self.key)
                
        try:
            left_items, right_items = self.value.split(":")
        except:
            left_items = right_items = ""
        if len(left_items) > 0:
            left_items = left_items.split(",")
        else:
            left_items = []
        if len(right_items) > 0:
            right_items = right_items.split(",")
        else:
            right_items = []
        
        label = Gtk.Label(_("Left side title bar buttons"))
        label.set_alignment(0, 0.5)
        self.attach(label, 0, 1, 0, 1, xoptions = Gtk.AttachOptions.FILL, yoptions=0, xpadding=2)
        left_side_box = Gtk.HBox()
        self.attach(left_side_box, 1, 2, 0, 1, yoptions=0, xpadding=2)
        
        label = Gtk.Label(_("Right side title bar buttons"))
        label.set_alignment(0, 0.5)
        self.attach(label, 0, 1, 1, 2, xoptions = Gtk.AttachOptions.FILL, yoptions=0, xpadding=2)
        right_side_box = Gtk.HBox()
        self.attach(right_side_box, 1, 2, 1, 2, yoptions=0, xpadding=2)
        
        self.left_side_widgets = []
        self.right_side_widgets = []
        for i in range(3):
            self.left_side_widgets.append(Gtk.ComboBox())
            self.right_side_widgets.append(Gtk.ComboBox())
        
        buttons = [
            ("", ""),
            ("close", _("Close")),
            ("minimize", _("Minimize")),
            ("maximize", _("Maximize"))
        ]
        
        for i in self.left_side_widgets + self.right_side_widgets:
            if i in self.left_side_widgets:
                ref_list = left_items
                index = self.left_side_widgets.index(i)
            else:
                ref_list = right_items
                index = self.right_side_widgets.index(i)
            model = Gtk.ListStore(str, str)
            selected_iter = None
            for button in buttons:
                iter = model.insert_before(None, None)
                model.set_value(iter, 0, button[0])                
                model.set_value(iter, 1, button[1])
                if index < len(ref_list) and ref_list[index] == button[0]:
                    selected_iter = iter
            i.set_model(model)
            renderer_text = Gtk.CellRendererText()
            i.pack_start(renderer_text, True)
            i.add_attribute(renderer_text, "text", 1)
            if selected_iter is not None:
                i.set_active_iter(selected_iter)
            i.connect("changed", self.on_my_value_changed)
        
        for i in self.left_side_widgets:
            left_side_box.pack_start(i, False, False, 2)
        for i in self.right_side_widgets:
            right_side_box.pack_start(i, False, False, 2)
    
    def on_my_value_changed(self, widget):
        active_iter = widget.get_active_iter()
        if active_iter:
            new_value = widget.get_model()[active_iter][0]
        else:
            new_value = None
        left_items = []
        right_items = []
        for i in self.left_side_widgets + self.right_side_widgets:
            active_iter = i.get_active_iter()
            if active_iter:
                value = i.get_model()[i.get_active_iter()][0]
                if i != widget and value == new_value:
                    i.set_active_iter(None)
                elif value != "":
                    if i in self.left_side_widgets:
                        left_items.append(value)
                    else:
                        right_items.append(value)
        self.settings.set_string(self.key, ','.join(str(item) for item in left_items) + ':' + ','.join(str(item) for item in right_items))


class IndentedHBox(Gtk.HBox):
    def __init__(self):
        super(IndentedHBox, self).__init__()
        indent = Gtk.Label('\t')
        self.pack_start(indent, False, False, 0)

    def add(self, item):
        self.pack_start(item, False, False, 0)

class MainWindow:
  
    # Change pages
    def side_view_nav(self, side_view):
        selected_items = side_view.get_selected_items()
        if len(selected_items) > 0:
            self.side_view_sw.hide()
            path = selected_items[0]            
            iterator = self.store.get_iter(path)
            sidePage = self.store.get_value(iterator,2)
            self.window.set_title(_("Cinnamon Settings") + " - " + sidePage.name)
            sidePage.build()
            self.content_box_sw.show_all()
            self.top_button_box.show_all()
            
    ''' Create the UI '''
    def __init__(self):        
        
        self.builder = Gtk.Builder()
        self.builder.add_from_file("/usr/lib/cinnamon-settings/cinnamon-settings.ui")
        self.window = self.builder.get_object("main_window")
        self.side_view = self.builder.get_object("side_view")
        self.side_view_sw = self.builder.get_object("side_view_sw")
        self.content_box = self.builder.get_object("content_box")
        self.content_box_sw = self.builder.get_object("content_box_sw")
        self.button_cancel = self.builder.get_object("button_cancel")
        self.button_back = self.builder.get_object("button_back")
        self.button_back.set_label(_("All Settings"))
        self.top_button_box = self.builder.get_object("top_button_box")
        
        self.window.connect("destroy", Gtk.main_quit)

        self.sidePages = []
                               
        sidePage = SidePage(_("Menu"), "menu.svg", self.content_box)
        self.sidePages.append((sidePage, "menu"))
        sidePage.add_widget(GSettingsEntry(_("Menu text"), "org.cinnamon", "menu-text", None))
        sidePage.add_widget(GSettingsFileChooser(_("Menu icon"), "org.cinnamon", "menu-icon", None, True))
        sidePage.add_widget(GSettingsSpinButton(_("Menu hover delay"), "org.cinnamon", "menu-hover-delay", None, 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(GSettingsCheckButton(_("Activate menu on hover"), "org.cinnamon", "activate-menu-applet-on-hover", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show bookmarks and places"), "org.cinnamon", "menu-show-places", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show recent files"), "org.cinnamon", "menu-show-recent", None))

        sidePage = SidePage(_("Panel"), "panel.svg", self.content_box)
        self.sidePages.append((sidePage, "panel"))

        desktop_layouts = [["traditional", _("Traditional (panel at the bottom)")], ["flipped", _("Flipped (panel at the top)")], ["classic", _("Classic (panels at the top and at the bottom)")]]        
        desktop_layouts_combo = GSettingsComboBox(_("Panel layout"), "org.cinnamon", "desktop-layout", None, desktop_layouts)
        sidePage.add_widget(desktop_layouts_combo) 
        label = Gtk.Label()
        label.set_markup("<i><small>%s</small></i>" % _("Note: If you change the layout you will need to restart Cinnamon and Cinnamon Settings."))
        sidePage.add_widget(label)

        settings = Gio.Settings.new("org.cinnamon")
        layout_type = settings.get_string("desktop-layout")
        if layout_type != "classic":
            sidePage.add_widget(GSettingsCheckButton(_("Auto-hide panel"), "org.cinnamon", "panel-autohide", None))
            box = IndentedHBox()
            box.add(GSettingsSpinButton(_("Show delay"), "org.cinnamon", "panel-show-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds")))
            sidePage.add_widget(box)
            box = IndentedHBox()
            box.add(GSettingsSpinButton(_("Hide delay"), "org.cinnamon", "panel-hide-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds")))
            sidePage.add_widget(box)
        else:
            sidePage.add_widget(GSettingsCheckButton(_("Auto-hide top panel"), "org.cinnamon", "panel-autohide", None))
            box = IndentedHBox()
            box.add(GSettingsSpinButton(_("Show delay"), "org.cinnamon", "panel-show-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds")))
            sidePage.add_widget(box)
            box = IndentedHBox()
            box.add(GSettingsSpinButton(_("Hide delay"), "org.cinnamon", "panel-hide-delay", "org.cinnamon/panel-autohide", 0, 2000, 50, 200, _("milliseconds")))
            sidePage.add_widget(box)
            sidePage.add_widget(GSettingsCheckButton(_("Auto-hide bottom panel"), "org.cinnamon", "panel2-autohide", None))
            box = IndentedHBox()
            box.add(GSettingsSpinButton(_("Show delay"), "org.cinnamon", "panel2-show-delay", "org.cinnamon/panel2-autohide", 0, 2000, 50, 200, _("milliseconds")))
            sidePage.add_widget(box)
            box = IndentedHBox()
            box.add(GSettingsSpinButton(_("Hide delay"), "org.cinnamon", "panel2-hide-delay", "org.cinnamon/panel2-autohide", 0, 2000, 50, 200, _("milliseconds")))
            sidePage.add_widget(box)

        sidePage.add_widget(GSettingsCheckButton(_("Use customized panel size (otherwise it's defined by the theme)"), "org.cinnamon", "panel-resizable", None))

        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Allow Cinnamon to scale panel text and icons according to the panel heights"), "org.cinnamon", "panel-scale-text-icons", "org.cinnamon/panel-resizable"))
        sidePage.add_widget(box)

        box = IndentedHBox()
        box.add(GSettingsSpinButton(_("Top panel height"), "org.cinnamon", "panel-top-height", "org.cinnamon/panel-resizable", 0, 2000, 1, 5, _("Pixels")))
        sidePage.add_widget(box)

        box = IndentedHBox()
        box.add(GSettingsSpinButton(_("Bottom panel height"), "org.cinnamon", "panel-bottom-height", "org.cinnamon/panel-resizable",  0, 2000, 1, 5, _("Pixels")))
        sidePage.add_widget(box)

        sidePage.add_widget(GSettingsCheckButton(_("Panel edit mode"), "org.cinnamon", "panel-edit-mode", None))
        sidePage = SidePage(_("Calendar"), "clock.svg", self.content_box)
        self.sidePages.append((sidePage, "calendar"))        
        sidePage.add_widget(GSettingsCheckButton(_("Show week dates in calendar"), "org.cinnamon.calendar", "show-weekdate", None))
        sidePage.add_widget(GSettingsEntry(_("Date format for the panel"), "org.cinnamon.calendar", "date-format", None))
        sidePage.add_widget(GSettingsEntry(_("Date format inside the date applet"), "org.cinnamon.calendar", "date-format-full", None))
        sidePage.add_widget(Gtk.LinkButton.new_with_label("http://www.foragoodstrftime.com/", _("Generate your own date formats")))
        
        try:
            self.changeTimeWidget = ChangeTimeWidget()  
            self.ntpCheckButton = None 
            try:
                self.ntpCheckButton = NtpCheckButton(_("Use network time"))
                sidePage.add_widget(self.ntpCheckButton)
            except:
                pass
            sidePage.add_widget(self.changeTimeWidget)
            try:
                sidePage.add_widget(TimeZoneSelectorWidget())
            except:
                pass
            
            if self.ntpCheckButton != None:
                self.ntpCheckButton.connect('toggled', self._ntp_toggled)
                self.changeTimeWidget.change_using_ntp( self.ntpCheckButton.get_active() )
        except Exception, detail:
            print detail
        
        sidePage = HotCornerViewSidePage(_("Hot corner"), "overview.svg", self.content_box)
        self.sidePages.append((sidePage, "hotcorner"))

        sidePage = ThemeViewSidePage(_("Themes"), "themes.svg", self.content_box)
        self.sidePages.append((sidePage, "themes"))

        sidePage = SidePage(_("Effects"), "desktop-effects.svg", self.content_box)
        self.sidePages.append((sidePage, "effects"))
        sidePage.add_widget(GSettingsCheckButton(_("Enable desktop effects"), "org.cinnamon", "desktop-effects", None))

        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Enable desktop effects on dialog boxes"), "org.cinnamon", "desktop-effects-on-dialogs", "org.cinnamon/desktop-effects"))
        sidePage.add_widget(box)

        # Destroy window effects
        transition_effects = []
        transition_effects.append(["easeInQuad", "easeInQuad"])
        transition_effects.append(["easeOutQuad", "easeOutQuad"])
        transition_effects.append(["easeInOutQuad", "easeInOutQuad"])        
        transition_effects.append(["easeInCubic", "easeInCubic"])
        transition_effects.append(["easeOutCubic", "easeOutCubic"])
        transition_effects.append(["easeInOutCubic", "easeInOutCubic"])        
        transition_effects.append(["easeInQuart", "easeInQuart"])
        transition_effects.append(["easeOutQuart", "easeOutQuart"])
        transition_effects.append(["easeInOutQuart", "easeInOutQuart"])        
        transition_effects.append(["easeInQuint", "easeInQuint"])
        transition_effects.append(["easeOutQuint", "easeOutQuint"])
        transition_effects.append(["easeInOutQuint", "easeInOutQuint"])        
        transition_effects.append(["easeInSine", "easeInSine"])
        transition_effects.append(["easeOutSine", "easeOutSine"])
        transition_effects.append(["easeInOutSine", "easeInOutSine"])        
        transition_effects.append(["easeInExpo", "easeInExpo"])
        transition_effects.append(["easeOutEXpo", "easeOutExpo"])
        transition_effects.append(["easeInOutExpo", "easeInOutExpo"])        
        transition_effects.append(["easeInCirc", "easeInCirc"])
        transition_effects.append(["easeOutCirc", "easeOutCirc"])
        transition_effects.append(["easeInOutCirc", "easeInOutCirc"])        
        transition_effects.append(["easeInElastic", "easeInElastic"])
        transition_effects.append(["easeOutElastic", "easeOutElastic"])
        transition_effects.append(["easeInOutElastic", "easeInOutElastic"])        
        transition_effects.append(["easeInBack", "easeInBack"])
        transition_effects.append(["easeOutBack", "easeOutBack"])
        transition_effects.append(["easeInOutBack", "easeInOutBack"])        
        transition_effects.append(["easeInBounce", "easeInBounce"])
        transition_effects.append(["easeOutBounce", "easeOutBounce"])
        transition_effects.append(["easeInOutBounce", "easeInOutBounce"])
        
        #CLOSING WINDOWS
        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup("%s" % _("Closing windows:"))
        box.add(label)
        effects = [["none", _("None")], ["scale", _("Scale")], ["fade", _("Fade")]]        
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-close-effect", "org.cinnamon/desktop-effects", effects))
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-close-transition", "org.cinnamon/desktop-effects", transition_effects))
        box.add(GSettingsSpinButton("", "org.cinnamon", "desktop-effects-close-time", "org.cinnamon/desktop-effects", 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(box) 
        
        #MAPPING WINDOWS
        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup("%s" % _("Mapping windows:"))
        box.add(label)
        effects = [["none", _("None")], ["scale", _("Scale")], ["fade", _("Fade")]]        
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-map-effect", "org.cinnamon/desktop-effects", effects))
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-map-transition", "org.cinnamon/desktop-effects", transition_effects))
        box.add(GSettingsSpinButton("", "org.cinnamon", "desktop-effects-map-time", "org.cinnamon/desktop-effects", 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(box)
        
        #MINIMIZING WINDOWS
        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup("%s" % _("Minimizing windows:"))
        box.add(label)
        effects = [["none", _("None")], ["traditional", _("Traditional")], ["scale", _("Scale")], ["fade", _("Fade")]]
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-minimize-effect", "org.cinnamon/desktop-effects", effects))
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-minimize-transition", "org.cinnamon/desktop-effects", transition_effects))
        box.add(GSettingsSpinButton("", "org.cinnamon", "desktop-effects-minimize-time", "org.cinnamon/desktop-effects", 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(box)
        
        #MAXIMIZING WINDOWS
        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup("%s" % _("Maximizing windows:"))
        box.add(label)
        effects = [["none", _("None")], ["scale", _("Scale")]]        
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-maximize-effect", "org.cinnamon/desktop-effects", effects))
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-maximize-transition", "org.cinnamon/desktop-effects", transition_effects))
        box.add(GSettingsSpinButton("", "org.cinnamon", "desktop-effects-maximize-time", "org.cinnamon/desktop-effects", 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(box)
        
        #UNMAXIMIZING WINDOWS
        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup("%s" % _("Unmaximizing windows:"))
        box.add(label)
        effects = [["none", _("None")], ["scale", _("Scale")]]
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-unmaximize-effect", "org.cinnamon/desktop-effects", effects))
        box.add(GSettingsComboBox("", "org.cinnamon", "desktop-effects-unmaximize-transition", "org.cinnamon/desktop-effects", transition_effects))
        box.add(GSettingsSpinButton("", "org.cinnamon", "desktop-effects-unmaximize-time", "org.cinnamon/desktop-effects", 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(box)
        
        sidePage = AppletViewSidePage(_("Applets"), "applets.svg", self.content_box)
        self.sidePages.append((sidePage, "applets"))
        
        sidePage = ExtensionViewSidePage(_("Extensions"), "extensions.svg", self.content_box)
        self.sidePages.append((sidePage, "extensions"))
        
        if 'org.nemo' in Gio.Settings.list_schemas():
            nemo_desktop_schema = Gio.Settings.new("org.nemo.desktop")
            nemo_desktop_keys = nemo_desktop_schema.list_keys()
                            
            sidePage = SidePage(_("Desktop"), "desktop.svg", self.content_box)
            self.sidePages.append((sidePage, "desktop"))
            #sidePage.add_widget(GSettingsCheckButton(_("Have file manager (Nemo) handle the desktop"), "org.gnome.desktop.background", "show-desktop-icons", None))
            if "computer-icon-visible" in nemo_desktop_keys:
                sidePage.add_widget(GSettingsCheckButton(_("Computer icon visible on desktop"), "org.nemo.desktop", "computer-icon-visible", None))
            if "home-icon-visible" in nemo_desktop_keys:
                sidePage.add_widget(GSettingsCheckButton(_("Home icon visible on desktop"), "org.nemo.desktop", "home-icon-visible", None))
            if "network-icon-visible" in nemo_desktop_keys:
                sidePage.add_widget(GSettingsCheckButton(_("Network Servers icon visible on desktop"), "org.nemo.desktop", "network-icon-visible", None))
            if "trash-icon-visible" in nemo_desktop_keys:
                sidePage.add_widget(GSettingsCheckButton(_("Trash icon visible on desktop"), "org.nemo.desktop", "trash-icon-visible", None))
            if "volumes-visible" in nemo_desktop_keys:
                sidePage.add_widget(GSettingsCheckButton(_("Show mounted volumes on the desktop"), "org.nemo.desktop", "volumes-visible", None))

        sidePage = SidePage(_("Windows"), "windows.svg", self.content_box)
        self.sidePages.append((sidePage, "windows"))
        sidePage.add_widget(GSettingsComboBox(_("Action on title bar double-click"),
                                            "org.gnome.desktop.wm.preferences", "action-double-click-titlebar", None,
                                            [(i, i.replace("-", " ").title()) for i in ('toggle-shade', 'toggle-maximize', 'toggle-maximize-horizontally', 'toggle-maximize-vertically', 'minimize', 'shade', 'menu', 'lower', 'none')]))
        sidePage.add_widget(GSettingsComboBox(_("Action on title bar middle-click"),
                                            "org.gnome.desktop.wm.preferences", "action-middle-click-titlebar", None,
                                            [(i, i.replace("-", " ").title()) for i in ('toggle-shade', 'toggle-maximize', 'toggle-maximize-horizontally', 'toggle-maximize-vertically', 'minimize', 'shade', 'menu', 'lower', 'none')]))
        sidePage.add_widget(GSettingsComboBox(_("Action on title bar right-click"),
                                            "org.gnome.desktop.wm.preferences", "action-right-click-titlebar", None,
                                            [(i, i.replace("-", " ").title()) for i in ('toggle-shade', 'toggle-maximize', 'toggle-maximize-horizontally', 'toggle-maximize-vertically', 'minimize', 'shade', 'menu', 'lower', 'none')]))
        sidePage.add_widget(GSettingsComboBox(_("Window focus mode"),
                                            "org.gnome.desktop.wm.preferences", "focus-mode", None,
                                            [(i, i.title()) for i in ("click","sloppy","mouse")]))

        sidePage.add_widget(TitleBarButtonsOrderSelector())        
        sidePage.add_widget(GSettingsCheckButton(_("Enable Edge Tiling (\"Aero Snap\")"), "org.cinnamon.overrides", "edge-tiling", None))
        sidePage.add_widget(GSettingsCheckButton(_("Enable Edge Flip"), "org.cinnamon", "enable-edge-flip", None))
        sidePage.add_widget(GSettingsCheckButton(_("Attach dialog windows to their parent window's titlebar"), "org.cinnamon.overrides", "attach-modal-dialogs", None))
        alttab_styles = [["icons", _("Icons only")],["icons+thumbnails", _("Icons and thumbnails")],["icons+preview", _("Icons and window preview")],["preview", _("Window preview (no icons)")]]
        alttab_styles_combo = GSettingsComboBox(_("ALT-tab switcher style"), "org.cinnamon", "alttab-switcher-style", None, alttab_styles)
        sidePage.add_widget(alttab_styles_combo)
        sidePage.add_widget(GSettingsCheckButton(_("Enable mouse-wheel scrolling in Window List applet"), "org.cinnamon", "window-list-applet-scroll", None))
        sidePage.add_widget(GSettingsCheckButton(_("Bring windows which require attention to the current workspace (instead of switching to the window's workspace)"), "org.cinnamon", "bring-windows-to-current-workspace", None))
        
        sidePage = SidePage(_("Workspaces"), "workspaces.svg", self.content_box)
        self.sidePages.append((sidePage, "workspaces"))        
        sidePage.add_widget(GSettingsCheckButton(_("Enable workspace OSD"), "org.cinnamon", "workspace-osd-visible", None))

        box = IndentedHBox()
        box.add(GSettingsSpinButton(_("Workspace OSD duration"), "org.cinnamon", "workspace-osd-duration", "org.cinnamon/workspace-osd-visible", 0, 2000, 50, 400, _("milliseconds")))
        sidePage.add_widget(box)

        box = IndentedHBox()
        box.add(GSettingsSpinButton(_("Workspace OSD horizontal position"), "org.cinnamon", "workspace-osd-x", "org.cinnamon/workspace-osd-visible", 0, 100, 5, 50, _("percent of the monitor's width")))
        sidePage.add_widget(box)

        box = IndentedHBox()
        box.add(GSettingsSpinButton(_("Workspace OSD vertical position"), "org.cinnamon", "workspace-osd-y", "org.cinnamon/workspace-osd-visible", 0, 100, 5, 50, _("percent of the monitor's height")))
        sidePage.add_widget(box)

        sidePage.add_widget(GSettingsCheckButton(_("Allow cycling through workspaces"), "org.cinnamon.overrides", "workspace-cycle", None))
        sidePage.add_widget(GSettingsCheckButton(_("Only use workspaces on primary monitor (requires Cinnamon restart)"), "org.cinnamon.overrides", "workspaces-only-on-primary", None))
        sidePage.add_widget(GSettingsCheckButton(_("Display Expo view as a grid"), "org.cinnamon", "workspace-expo-view-as-grid", None))
        
        sidePage = SidePage(_("Fonts"), "fonts.svg", self.content_box)
        self.sidePages.append((sidePage, "fonts"))
        sidePage.add_widget(GSettingsRangeSpin(_("Text scaling factor"), "org.gnome.desktop.interface", "text-scaling-factor", None, adjustment_step = 0.1))
        sidePage.add_widget(GSettingsFontButton(_("Default font"), "org.gnome.desktop.interface", "font-name", None))
        sidePage.add_widget(GSettingsFontButton(_("Document font"), "org.gnome.desktop.interface", "document-font-name", None))
        sidePage.add_widget(GSettingsFontButton(_("Monospace font"), "org.gnome.desktop.interface", "monospace-font-name", None))
        sidePage.add_widget(GSettingsFontButton(_("Window title font"), "org.gnome.desktop.wm.preferences", "titlebar-font", None))
        sidePage.add_widget(GSettingsComboBox(_("Hinting"), "org.gnome.settings-daemon.plugins.xsettings", "hinting", None, [(i, i.title()) for i in ("none", "slight", "medium", "full")]))
        sidePage.add_widget(GSettingsComboBox(_("Antialiasing"), "org.gnome.settings-daemon.plugins.xsettings", "antialiasing", None, [(i, i.title()) for i in ("none", "grayscale", "rgba")]))
        
        sidePage = SidePage(_("General"), "general.svg", self.content_box)
        self.sidePages.append((sidePage, "general"))
        sidePage.add_widget(GSettingsCheckButton(_("Log LookingGlass output to ~/.cinnamon/glass.log (Requires Cinnamon restart)"), "org.cinnamon", "enable-looking-glass-logs", None))
        sidePage.add_widget(GSettingsCheckButton(_("Emulate middle click by clicking both left and right buttons"), "org.gnome.settings-daemon.peripherals.mouse", "middle-button-enabled", None))
        sidePage.add_widget(GSettingsCheckButton(_("Display notifications"), "org.cinnamon", "display-notifications", None))
        

        sidePage = KeyboardSidePage(_("Keyboard"), "keyboard.svg", self.content_box)
        self.sidePages.append((sidePage, "keyboard"))

        #sidePage = SidePage(_("Terminal"), "terminal", self.content_box)
        #self.sidePages.append(sidePage)
        #sidePage.add_widget(GConfCheckButton(_("Show fortune cookies"), "/desktop/linuxmint/terminal/show_fortunes"))
        
        sidePage = BackgroundSidePage(_("Backgrounds"), "backgrounds.svg", self.content_box)
        self.sidePages.append((sidePage, "backgrounds"))
        
                                
        # create the backing store for the side nav-view.                            
        self.store = Gtk.ListStore(str, GdkPixbuf.Pixbuf, object)
        sidePagesIters = {}
        for sidePage, sidePageID in self.sidePages:
            iconFile = "/usr/lib/cinnamon-settings/data/icons/%s" % sidePage.icon
            if os.path.exists(iconFile):
                img = GdkPixbuf.Pixbuf.new_from_file_at_size( iconFile, 48, 48)
            else:
                img = None
            sidePagesIters[sidePageID] = self.store.append([sidePage.name, img, sidePage])     
                      
        # set up the side view - navigation.
        self.side_view.set_text_column(0)
        self.side_view.set_pixbuf_column(1)
        self.side_view.set_model(self.store)        
        self.side_view.connect("selection_changed", self.side_view_nav )

        # set up larger components.
        self.window.set_title(_("Cinnamon Settings"))       
        self.window.connect("destroy", Gtk.main_quit)
        self.button_cancel.connect("clicked", Gtk.main_quit)      
        self.button_back.connect('clicked', self.back_to_icon_view)     
        
        # Select the first sidePage
        if len(sys.argv)==2 and sys.argv[1] in sidePagesIters.keys():
            first_page_iter = sidePagesIters[sys.argv[1]]
            path = self.store.get_path(first_page_iter)
            self.side_view.select_path(path)
                                     
        self.window.show()
    
    def back_to_icon_view(self, widget):
        self.window.set_title(_("Cinnamon Settings"))
        self.content_box_sw.hide()
        self.top_button_box.hide()
        self.side_view_sw.show_all()
        
    def _ntp_toggled(self, widget):
        self.changeTimeWidget.change_using_ntp( self.ntpCheckButton.get_active() )
                
                
if __name__ == "__main__":
    GObject.threads_init()
    MainWindow()
    Gtk.main()
