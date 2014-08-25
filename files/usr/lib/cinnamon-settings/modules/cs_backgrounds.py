#!/usr/bin/env python

import sys
sys.path.append('/usr/lib/cinnamon-settings/bin')
from SettingsWidgets import *
import os
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib
import dbus
import imtools
import gettext
import subprocess
import tempfile

gettext.install("cinnamon", "/usr/share/cinnamon/locale")

BACKGROUND_MODES = [
    ("wallpaper", _("Wallpaper")),
    ("slideshow", _("Slideshow"))
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

BACKGROUND_ICONS_SIZE = 100

class Module:
    
    def __init__(self, content_box):
        keywords = _("background, picture, screenshot, slideshow")
        self.sidePage = SidePage(_("Backgrounds"), "cs-backgrounds", keywords, content_box, 500, module=self)        
        self.name = "backgrounds"
        self.category = "appear"
        self.comment = _("Change your desktop's background")

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Backgrounds module"

            self._gnome_background_schema = Gio.Settings(schema = "org.cinnamon.desktop.background")
            self._cinnamon_background_schema = Gio.Settings(schema = "org.cinnamon.background")
            self._add_wallpapers_dialog = AddWallpapersDialog()

            self._check_initial_mode()

            self._cinnamon_background_schema.connect("changed::mode", self._on_mode_changed)

            self.mainbox = Gtk.EventBox()
            self.mainbox.set_visible_window(False)
            self.sidePage.add_widget(self.mainbox)
            self.mainbox.expand = True

            bg = SectionBg()
            self.mainbox.add(bg)

            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            vbox.set_border_width(10)
            bg.add(vbox)
            
            image_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=10)
            vbox.pack_start(image_box, True, True, 0)
            self.thumbnail_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            image_box.pack_start(self.thumbnail_box, True, True, 0)

            self.wallpaper_view = BackgroundWallpaperPane(self, self._gnome_background_schema)
            self.slideshow_view = BackgroundSlideshowPane(self, self._gnome_background_schema, self._cinnamon_background_schema)
            if self._cinnamon_background_schema["mode"] == "slideshow":
                self.thumbnail_box.pack_start(self.slideshow_view, True, True, 0)
            else:
                self.thumbnail_box.pack_start(self.wallpaper_view, True, True, 0)

            self.image_options_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=5)
            image_box.pack_start(self.image_options_box, False, False, 0)

            self.label = Gtk.Label()
            self.label.set_markup("<b>%s</b>" % _("Mode"))
            self.label.set_alignment(0.5, 0)
            self.image_options_box.pack_start(self.label, False, True, 0)

            self.background_mode = GSettingsComboBox("", "org.cinnamon.background", "mode", None, BACKGROUND_MODES).content_widget
            self.background_mode.unparent()
            self.image_options_box.pack_start(self.background_mode, False, True, 0)

            separator = Gtk.Separator.new(Gtk.Orientation.HORIZONTAL)
            self.image_options_box.pack_start(separator, False, True, 0)

            self.label = Gtk.Label()
            self.label.set_markup("<b>%s</b>" % _("Images"))
            self.label.set_alignment(0.5, 0)
            self.image_options_box.pack_start(self.label, False, True, 0)

            self.add_wallpaper_button = Gtk.Button.new_with_label(_("Add Image"))
            self.add_wallpaper_button.connect("clicked", lambda w: self._add_wallpapers())
            self.image_options_box.pack_start(self.add_wallpaper_button, False, True, 0)

            self.remove_wallpaper_button = Gtk.Button.new_with_label(_("Remove Image"))
            self.remove_wallpaper_button.set_sensitive(False)
            self.remove_wallpaper_button.connect("clicked", lambda w: self._remove_selected_wallpaper())
            self.image_options_box.pack_start(self.remove_wallpaper_button, False, True, 0)
            self.remove_wallpaper_button.set_sensitive(False)

            separator = Gtk.Separator.new(Gtk.Orientation.HORIZONTAL)
            self.image_options_box.pack_start(separator, False, True, 0)

            self.label = Gtk.Label()
            self.label.set_markup("<b>%s</b>" % _("Aspect"))
            self.label.set_alignment(0.5, 0)
            self.image_options_box.pack_start(self.label, False, True, 0)

            self.picture_options = GSettingsComboBox("", "org.cinnamon.desktop.background", "picture-options", None, BACKGROUND_PICTURE_OPTIONS)
            self.image_options_box.pack_start(self.picture_options, False, True, 0)

            separator = Gtk.Separator.new(Gtk.Orientation.HORIZONTAL)
            self.image_options_box.pack_start(separator, False, True, 0)

            self.gradient_label = Gtk.Label()
            self.gradient_label.set_markup("<b>%s</b>" % _("Gradient"))
            self.gradient_label.set_alignment(0.5, 0)

            self.color_shading_type = GSettingsComboBox("", "org.cinnamon.desktop.background", "color-shading-type", None, BACKGROUND_COLOR_SHADING_TYPES)

            self.primary_color = GSettingsColorChooser("org.cinnamon.desktop.background", "primary-color", None)
            self.secondary_color = GSettingsColorChooser("org.cinnamon.desktop.background", "secondary-color", None)

            if self._cinnamon_background_schema["mode"] == "wallpaper":
                self.image_options_box.pack_start(self.gradient_label, False, True, 0)
                self.image_options_box.pack_start(self.color_shading_type, False, True, 0)
                self.image_options_box.pack_start(self.primary_color, False, True, 0)
                self.image_options_box.pack_start(self.secondary_color, False, True, 0)

            self.delay_label = Gtk.Label()
            self.delay_label.set_markup("<b>%s</b>" % _("Delay"))
            self.delay_label.set_alignment(0.5, 0)

            self.delay_button = Gtk.SpinButton()
            self.delay_button.set_increments(1, 10)
            self.delay_button.set_range(1, 120)
            self.delay_button.set_value(self._cinnamon_background_schema.get_int("slideshow-delay"))
            self.delay_button.connect("value-changed", self._on_delay_changed)
            if self._cinnamon_background_schema["mode"] == "slideshow":
                self.image_options_box.pack_start(self.delay_label, False, True, 0)
                self.image_options_box.pack_start(self.delay_button, False, True, 0)

            self.mainbox.show_all()

    def _check_initial_mode(self):
        if self._gnome_background_schema.get_string("picture-uri").endswith(".xml"):
            self._cinnamon_background_schema.set_string("mode", "slideshow")
        else:
            self._cinnamon_background_schema.set_string("mode", "wallpaper")

    def _on_mode_changed(self, settings, key):
        for i in self.thumbnail_box.get_children():
            self.thumbnail_box.remove(i)
        if self._cinnamon_background_schema["mode"] == "slideshow":
            self.thumbnail_box.pack_start(self.slideshow_view, True, True, 0)
            self.slideshow_view.show_all()
            self.image_options_box.remove(self.gradient_label)
            self.image_options_box.remove(self.color_shading_type)
            self.image_options_box.remove(self.primary_color)
            self.image_options_box.remove(self.secondary_color)
            self.image_options_box.pack_start(self.delay_label, False, True, 0)
            self.image_options_box.pack_start(self.delay_button, False, True, 0)
            self.slideshow_view.update_list()
        else:
            self._gnome_background_schema.reset("picture-uri")
            self.thumbnail_box.pack_start(self.wallpaper_view, True, True, 0)
            self.wallpaper_view.show_all()
            self.image_options_box.pack_start(self.gradient_label, False, True, 0)
            self.image_options_box.pack_start(self.color_shading_type, False, True, 0)
            self.image_options_box.pack_start(self.primary_color, False, True, 0)
            self.image_options_box.pack_start(self.secondary_color, False, True, 0)
            self.image_options_box.remove(self.delay_label)
            self.image_options_box.remove(self.delay_button)
        self.mainbox.show_all()        

    def _add_wallpapers(self):
        if self._cinnamon_background_schema["mode"] == "slideshow":
            self.slideshow_view._add_wallpapers()
        else:
            self.wallpaper_view._add_wallpapers()
    
    def _remove_selected_wallpaper(self):
        if self._cinnamon_background_schema["mode"] == "slideshow":
            self.slideshow_view._remove_selected_wallpaper()
        else:
            self.wallpaper_view._remove_selected_wallpaper()

    def _on_delay_changed(self, button):
        self.slideshow_view._on_delay_changed(button)


class PixCache(object):
    
    def __init__(self):
        self._data = {}
    
    def get_pix(self, filename, size = None):
        try:
            mimetype = subprocess.check_output(["file", "-bi", filename]).split(";")[0]
            if not mimetype.startswith("image/"):
                print "Not trying to convert %s : not a recognized image file" % filename
                return None
        except Exception, detail:
            print "Failed to detect mimetype for %s: %s" % (filename, detail)
            return None
        if not filename in self._data:
            self._data[filename] = {}
        if size in self._data[filename]:
            pix = self._data[filename][size]
        else:
            try:
                if mimetype == "image/svg+xml":
                    tmp_pix = GdkPixbuf.Pixbuf.new_from_file(filename)
                    tmp_fp, tmp_filename = tempfile.mkstemp()
                    os.close(tmp_fp)
                    tmp_pix.savev(tmp_filename, "png", [], [])
                    img = Image.open(tmp_filename)
                    os.unlink(tmp_filename)
                else:
                    img = Image.open(filename)             
                (width, height) = img.size
                if img.mode != 'RGB':
                    img = img.convert('RGB')                
                if size:
                    img.thumbnail((size, size), Image.ANTIALIAS)                                                                                                    
                img = imtools.round_image(img, {}, False, None, 3, 255)  
                img = imtools.drop_shadow(img, 4, 4, background_color=(255, 255, 255, 0), shadow_color=0x444444, border=8, shadow_blur=3, force_background_color=False, cache=None)        
                # Convert Image -> Pixbuf (save to file, GTK3 is not reliable for that)
                f = tempfile.NamedTemporaryFile(delete=False)
                temp_filename = f.name
                f.close()        
                img.save(temp_filename, "png")
                pix = [GdkPixbuf.Pixbuf.new_from_file(temp_filename), width, height]
                os.unlink(temp_filename)
            except Exception, detail:
                print "Failed to convert %s: %s" % (filename, detail)
                pix = None
            if pix:
                self._data[filename][size] = pix
        return pix

PIX_CACHE = PixCache()

class ThreadedIconView(Gtk.IconView):
    def __init__(self):
        Gtk.IconView.__init__(self)
        self.set_item_width(BACKGROUND_ICONS_SIZE * 1.1)
        self._model = Gtk.ListStore(object, GdkPixbuf.Pixbuf, str)
        self.set_model(self._model)

        area = self.get_area()

        pixbuf_renderer = Gtk.CellRendererPixbuf()
        text_renderer = Gtk.CellRendererText(ellipsize=Pango.EllipsizeMode.END)

        text_renderer.set_alignment(.5, .5)
        area.pack_start(pixbuf_renderer, True, False, False)
        area.pack_start(text_renderer, True, False, False)
        self.add_attribute (pixbuf_renderer, "pixbuf", 1)
        self.add_attribute (text_renderer, "markup", 2)
        text_renderer.set_property("alignment", Pango.Alignment.CENTER)        

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
            GLib.timeout_add(100, self._check_loading_progress)
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
                filename = to_load["filename"]
                if filename.endswith(".xml"):
                    filename = self.getFirstFileFromBackgroundXml(filename)
                pix = PIX_CACHE.get_pix(filename, BACKGROUND_ICONS_SIZE)
                if pix != None:
                    if "name" in to_load:
                        label = to_load["name"]
                    else:
                        label = os.path.split(to_load["filename"])[1]
                    if "artist" in to_load:
                        artist = "%s\n" % to_load["artist"]
                    else:
                        artist = ""
                    dimensions = "%dx%d" % (pix[1], pix[2])
                    
                    self._loaded_data_lock.acquire()
                    self._loaded_data.append((to_load, pix[0], "<b>%s</b>\n<sub>%s<span foreground='#555555'>%s</span></sub>" % (label, artist, dimensions)))                    
                    self._loaded_data_lock.release()
                
        self._loading_lock.acquire()
        self._loading = False
        self._loading_lock.release()                 
        
    def getFirstFileFromBackgroundXml(self, filename):
        try:
            f = open(filename)
            rootNode = lxml.etree.fromstring(f.read())
            f.close()
            if rootNode.tag == "background":
                for backgroundNode in rootNode:
                    if backgroundNode.tag == "static":
                        for staticNode in backgroundNode:
                            if staticNode.tag == "file":
                                return staticNode.text
            print "Could not find filename in %s" % filename
            return None
        except Exception, detail:
            print "Failed to read filename from %s: %s" % (filename, detail)
            return None

class ThreadedSlideshowIconView(Gtk.IconView):
    def __init__(self):
        Gtk.IconView.__init__(self)
        self.set_item_width(BACKGROUND_ICONS_SIZE * 1.1)
        self._model = Gtk.ListStore(object, GdkPixbuf.Pixbuf, str)
        self.set_model(self._model)

        area = self.get_area()

        pixbuf_renderer = Gtk.CellRendererPixbuf()
        #text_renderer = Gtk.CellRendererText(ellipsize=Pango.EllipsizeMode.END)

        #text_renderer.set_alignment(.5, .5)
        area.pack_start(pixbuf_renderer, True, False, False)
        #area.pack_start(text_renderer, True, False, False)
        self.add_attribute (pixbuf_renderer, "pixbuf", 1)
        #self.add_attribute (text_renderer, "markup", 2)
        #text_renderer.set_property("alignment", Pango.Alignment.CENTER)        

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
            GLib.timeout_add(100, self._check_loading_progress)
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
                filename = to_load["filename"]
                #if filename.endswith(".xml"):
                #    filename = self.getFirstFileFromBackgroundXml(filename)
                pix = PIX_CACHE.get_pix(filename, BACKGROUND_ICONS_SIZE)
                if pix != None:
                    if "name" in to_load:
                        label = to_load["name"]
                    else:
                        label = os.path.split(to_load["filename"])[1]
                    if "artist" in to_load:
                        artist = "%s\n" % to_load["artist"]
                    else:
                        artist = ""
                    dimensions = "%dx%d" % (pix[1], pix[2])
                    
                    self._loaded_data_lock.acquire()
                    self._loaded_data.append((to_load, pix[0], "<b>%s</b>\n<sub>%s<span foreground='#555555'>%s</span></sub>" % (label, artist, dimensions)))                    
                    self._loaded_data_lock.release()
                
        self._loading_lock.acquire()
        self._loading = False
        self._loading_lock.release()                 
        
    def getFirstFileFromBackgroundXml(self, filename):
        try:
            f = open(filename)
            rootNode = lxml.etree.fromstring(f.read())
            f.close()
            if rootNode.tag == "background":
                for backgroundNode in rootNode:
                    if backgroundNode.tag == "static":
                        for staticNode in backgroundNode:
                            if staticNode.tag == "file":
                                return staticNode.text
            print "Could not find filename in %s" % filename
            return None
        except Exception, detail:
            print "Failed to read filename from %s: %s" % (filename, detail)
            return None
    

class BackgroundWallpaperPane (Gtk.ScrolledWindow):
    def __init__(self, sidepage, gnome_background_schema):
        Gtk.ScrolledWindow.__init__(self)
        
        self._gnome_background_schema = gnome_background_schema
        self._sidepage = sidepage

        self.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        self.set_shadow_type(Gtk.ShadowType.ETCHED_IN)
        
        self.icon_view = ThreadedIconView()
        self.add(self.icon_view)
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
        if os.path.exists("/usr/share/cinnamon-background-properties"):
            for i in os.listdir("/usr/share/cinnamon-background-properties"):
                if i.endswith(".xml"):
                    pictures_list += self.parse_xml_backgrounds_list(os.path.join("/usr/share/cinnamon-background-properties", i))
        
        path = os.path.join(os.getenv("HOME"), ".cinnamon", "backgrounds")
        if os.path.exists(path):
            for i in os.listdir(path):
                filename = os.path.join(path, i)
                if commands.getoutput("file -bi \"%s\"" % filename).startswith("image/"):
                    pictures_list.append({"filename": filename})
        self.icon_view.set_pictures_list(pictures_list)

    def _add_wallpapers(self):
        filenames = self._sidepage._add_wallpapers_dialog.run()
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
            
            self.update_icon_view()

    def _remove_selected_wallpaper(self):
        wallpaper = self.get_selected_wallpaper()
        os.unlink(wallpaper["filename"])
        self.update_icon_view()

class AddWallpapersDialog(Gtk.FileChooserDialog):
    def __init__(self, parent = None):
        Gtk.FileChooserDialog.__init__(self, title = _("Add wallpapers"), transient_for = parent, action = Gtk.FileChooserAction.OPEN)
        self.add_button(Gtk.STOCK_OPEN, Gtk.ResponseType.OK)
        self.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL)
        self.set_select_multiple(True)
        filter = Gtk.FileFilter();
        filter.add_pixbuf_formats ();
        self.set_filter(filter);

        preview = Gtk.Image()
        self.set_preview_widget(preview)
        self.connect("update-preview", self.update_icon_preview_cb, preview)

    def run(self):
        self.show_all()
        resp = Gtk.FileChooserDialog.run(self)
        self.hide()
        if resp == Gtk.ResponseType.OK:
            res = self.get_filenames()
        else:
            res = []
        return res

    def update_icon_preview_cb(self, chooser, preview):
        filename = chooser.get_preview_filename()
        if filename is None:
            return
        chooser.set_preview_widget_active(False)
        if os.path.isfile(filename):
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(filename, 128, 128)
            if pixbuf is not None:
                preview.set_from_pixbuf(pixbuf)
                chooser.set_preview_widget_active(True)

class BackgroundSlideshowPane(Gtk.ScrolledWindow):
    def __init__(self, sidepage, gnome_background_schema, cinnamon_background_schema):
        Gtk.ScrolledWindow.__init__(self)
        
        self._cinnamon_background_schema = cinnamon_background_schema
        self._sidepage = sidepage

        self.images_folder = os.path.join(os.getenv("HOME"), ".cinnamon", "backgrounds", "slideshow-backgrounds")

        self.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        self.set_shadow_type(Gtk.ShadowType.ETCHED_IN)

        self.icon_view = ThreadedIconView()
        self.add(self.icon_view)
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
        wallpaper = self.get_selected_wallpaper()
        self._sidepage.remove_wallpaper_button.set_sensitive(True)

    def update_icon_view(self):
        pictures_list = []
        path = os.path.join(os.getenv("HOME"), ".cinnamon", "backgrounds", "slideshow-backgrounds")
        if os.path.exists(path):
            for i in os.listdir(path):
                filename = os.path.join(path, i)
                if commands.getoutput("file -bi \"%s\"" % filename).startswith("image/"):
                    pictures_list.append({"filename": filename})
        self.icon_view.set_pictures_list(pictures_list)

    def _add_wallpapers(self):
        filenames = self._sidepage._add_wallpapers_dialog.run()
        if filenames:
            dest_dir = os.path.join(os.getenv("HOME"), ".cinnamon", "backgrounds", "slideshow-backgrounds")
            if not os.path.exists(dest_dir):
                rec_mkdir(dest_dir)
            for filename in filenames:
                dest_filename = os.path.join(dest_dir, os.path.split(filename)[1])
                fs = open(filename)
                fd = open(dest_filename, "w")
                fd.write(fs.read())
                fs.close()
                fd.close()
            self.update_icon_view()
            self.update_list()

    def _remove_selected_wallpaper(self):
        wallpaper = self.get_selected_wallpaper()
        os.unlink(wallpaper["filename"])
        self.update_icon_view()
        self.update_list()
    
    def _on_delay_changed(self, button):
        self._cinnamon_background_schema.set_int("slideshow-delay", int(button.get_value()))
        self.update_list()
    
    def update_list(self):
        thread.start_new_thread(self._do_update_list, (self.images_folder, int(self._sidepage.delay_button.get_value())))
    
    def _list_pictures(self, res, path, files):
        for i in files:
            filename = os.path.join(path, i)
            if commands.getoutput("file -bi \"%s\"" % filename).startswith("image/"):
                res.append(filename)
    
    def _do_update_list(self, folder, delay, transition_duration = 0):
        if os.path.exists(folder) and os.path.isdir(folder):
            files = []
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
            Gio.Settings("org.cinnamon.desktop.background").set_string("picture-uri", "file://" + filename)


