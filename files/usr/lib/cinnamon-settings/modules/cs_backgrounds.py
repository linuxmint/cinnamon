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
import commands

gettext.install("cinnamon", "/usr/share/cinnamon/locale")

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

            self._background_schema = Gio.Settings(schema = "org.cinnamon.desktop.background")
            self._slideshow_schema = Gio.Settings(schema = "org.cinnamon.desktop.background.slideshow")
            self._slideshow_schema.connect("changed::slideshow-enabled", self.on_slideshow_enabled_changed)
            self.add_folder_dialog = Gtk.FileChooserDialog(title=_("Add Folder"),
                                                           action=Gtk.FileChooserAction.SELECT_FOLDER,
                                                           buttons=(Gtk.STOCK_OPEN, Gtk.ResponseType.OK,
                                                                   Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL))

            self.default_directory = os.path.expanduser("~/Pictures")
            xdg_config = os.path.expanduser("~/.config/user-dirs.dirs")
            if os.path.exists(xdg_config) and os.path.exists("/usr/bin/xdg-user-dir"):
                path = commands.getoutput("xdg-user-dir PICTURES")
                if os.path.exists(path):
                    self.default_directory = path

            self.user_backgrounds = self.get_user_backgrounds()

            bg = SectionBg()
            self.sidePage.add_widget(bg)

            mainbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
            mainbox.set_border_width(8)
            bg.add(mainbox)

            top_hbox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 2)
            left_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0)
            right_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0)
            bottom_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)

            folder_scroller = Gtk.ScrolledWindow.new(None, None)
            folder_scroller.set_shadow_type(Gtk.ShadowType.IN)
            folder_scroller.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
            folder_scroller.set_property("min-content-width", 150)

            self.folder_tree = Gtk.TreeView.new()
            self.folder_tree.set_headers_visible(False)
            folder_scroller.add(self.folder_tree)

            button_toolbar = Gtk.Toolbar.new()
            button_toolbar.set_icon_size(1)
            Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(button_toolbar), "inline-toolbar")
            self.add_folder_button = Gtk.ToolButton.new(None, None)
            self.add_folder_button.set_icon_name("list-add-symbolic")
            self.add_folder_button.set_tooltip_text(_("Add new folder"))
            self.add_folder_button.connect("clicked", lambda w: self.add_new_folder())
            self.remove_folder_button = Gtk.ToolButton.new(None, None)
            self.remove_folder_button.set_icon_name("list-remove-symbolic")
            self.remove_folder_button.set_tooltip_text(_("Remove selected folder"))
            self.remove_folder_button.connect("clicked", lambda w: self.remove_folder())
            button_toolbar.insert(self.add_folder_button, 0)
            button_toolbar.insert(self.remove_folder_button, 1)

            image_scroller = Gtk.ScrolledWindow.new(None, None)
            image_scroller.set_shadow_type(Gtk.ShadowType.IN)
            image_scroller.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)

            self.icon_view = ThreadedIconView()
            image_scroller.add(self.icon_view)
            self.icon_view.connect("selection-changed", self.on_wallpaper_selection_changed)

            hbox = IndentedHBox()
            slideshow_checkbox = GSettingsCheckButton(_("Change background every "), "org.cinnamon.desktop.background.slideshow", "slideshow-enabled", None)
            delay_button = GSettingsSpinButton("", "org.cinnamon.desktop.background.slideshow", "delay", None, 1, 120, 1, 1, _(" minutes"))
            hbox.add(slideshow_checkbox)
            hbox.add(delay_button)
            bottom_vbox.pack_start(hbox, False, False, 2)

            hbox = IndentedHBox()
            hbox.add(GSettingsCheckButton(_("Play background images in random order"), "org.cinnamon.desktop.background.slideshow", "random-order", None))
            bottom_vbox.pack_start(hbox, False, False, 2)

            hbox = IndentedHBox()
            hbox.add(GSettingsComboBox(_("Picture aspect"), "org.cinnamon.desktop.background", "picture-options", None, BACKGROUND_PICTURE_OPTIONS))
            bottom_vbox.pack_start(hbox, False, False, 2)

            hbox = IndentedHBox()
            color_shading_type = GSettingsComboBox(_("Gradient"), "org.cinnamon.desktop.background", "color-shading-type", None, BACKGROUND_COLOR_SHADING_TYPES)
            label1 = Gtk.Label.new(_("Start color"))
            primary_color = GSettingsColorChooser("org.cinnamon.desktop.background", "primary-color", None)
            label2 = Gtk.Label.new(_("End color"))
            secondary_color = GSettingsColorChooser("org.cinnamon.desktop.background", "secondary-color", None)
            hbox.pack_start(color_shading_type, False, False, 2)
            hbox.pack_start(label1, False, False, 2)
            hbox.pack_start(primary_color, False, False, 2)
            hbox.pack_start(label2, False, False, 2)
            hbox.pack_start(secondary_color, False, False, 2)
            bottom_vbox.pack_start(hbox, False, False, 2)

            right_vbox.pack_start(image_scroller, True, True, 0)
            left_vbox.pack_start(folder_scroller, True, True, 0)
            left_vbox.pack_start(button_toolbar, False, False, 0)

            mainbox.pack_start(top_hbox, True, True, 2)
            top_hbox.pack_start(left_vbox, False, False, 2)
            top_hbox.pack_start(right_vbox, True, True, 2)
            mainbox.pack_start(bottom_vbox, False, False, 2)

            left_vbox.set_border_width(2)
            right_vbox.set_border_width(2)

            self.folder_store = Gtk.ListStore(bool,    # is separator
                                              str,     # Icon name
                                              str,     # Folder display name
                                              str,     # Folder path
                                              str)     # Name of background properties file or None
            cell = Gtk.CellRendererText()
            cell.set_alignment(0, 0)
            pb_cell = Gtk.CellRendererPixbuf()
            self.folder_column = Gtk.TreeViewColumn()
            self.folder_column.pack_start(pb_cell, False)
            self.folder_column.pack_start(cell, True)
            self.folder_column.add_attribute(pb_cell, "icon-name", 1)
            self.folder_column.add_attribute(cell, "text", 2)

            self.folder_column.set_alignment(0)

            self.folder_tree.append_column(self.folder_column)
            self.folder_tree.connect("cursor-changed", self.on_folder_source_changed)

            self.get_system_backgrounds()

            tree_separator = [True, None, None, None, None]
            self.folder_store.append(tree_separator)

            self.folder_store.append([False, "folder-pictures", self.default_directory.split("/")[-1], self.default_directory, None])

            if len(self.user_backgrounds) > 0:
                for item in self.user_backgrounds:
                    self.folder_store.append(item)

            self.folder_tree.set_model(self.folder_store)
            self.folder_tree.set_row_separator_func(self.is_row_separator)

            self.get_initial_path()

    def is_row_separator(self, model, iter):
        return model.get_value(iter, 0)

    def on_slideshow_enabled_changed(self, settings, key):
        if self._slideshow_schema.get_boolean("slideshow-enabled"):
            self.icon_view.set_sensitive(False)
            self.icon_view.set_selection_mode(Gtk.SelectionMode.NONE)
        else:
            self.icon_view.set_sensitive(True)
            self.icon_view.set_selection_mode(Gtk.SelectionMode.SINGLE)

    def get_system_backgrounds(self):
        picture_list = []
        folder_list = []
        properties_dir = "/usr/share/cinnamon-background-properties"
        if os.path.exists(properties_dir):
            for i in os.listdir(properties_dir):
                if i.endswith(".xml"):
                    picture_list += self.parse_xml_backgrounds_list(os.path.join(properties_dir, i))
                    for picture in picture_list:
                        folder_name = os.path.dirname(picture["filename"])
                        if not folder_list.count(folder_name):
                            folder_list.append(folder_name)
                            display_name = os.path.basename(folder_name).split("-")[-1]
                            self.folder_store.append([False, "start-here", display_name.capitalize(), folder_name, os.path.join(properties_dir, i)])

    def get_user_backgrounds(self):
        folder_list = []
        directory = os.path.join(os.getenv("HOME"), ".cinnamon", "backgrounds", "user-folders.lst")
        if os.path.isfile(directory):
            with open(directory) as f:
                folders = f.readlines()
            for line in folders:
                folder_path = line.strip("\n")
                folder_name = folder_path.split("/")[-1]
                folder_list.append([False, "folder", folder_name, folder_path, None])
        return folder_list

    def get_initial_path(self):
        initial_folder = self._slideshow_schema.get_string("image-source")
        tree_iter = self.folder_store.get_iter_first()
        if initial_folder != "":
            while tree_iter != None:
                if self.folder_store[tree_iter][3] == initial_folder:
                    tree_path = self.folder_store.get_path(tree_iter)
                    self.folder_tree.set_cursor(tree_path)
                    if self.folder_store[tree_iter][4] is not None:
                        self.remove_folder_button.set_sensitive(False)
                        self.update_icon_view(props=self.folder_store[tree_iter][4])
                    elif self.folder_store[tree_iter][3] == self.default_directory:
                        self.remove_folder_button.set_sensitive(False)
                        self.update_icon_view(path=self.folder_store[tree_iter][3])
                    else:
                        self.remove_folder_button.set_sensitive(True)
                        self.update_icon_view(path=self.folder_store[tree_iter][3])
                    return
                tree_iter = self.folder_store.iter_next(tree_iter)
        else:
            self._slideshow_schema.set_string("image-source", self.folder_store[tree_iter][3])
            tree_path = self.folder_store.get_path(tree_iter)
            self.folder_tree.get_selection().select_path(tree_path)
            if self.folder_store[tree_iter][4] is not None:
                self.remove_folder_button.set_sensitive(False)
                self.update_icon_view(props=self.folder_store[tree_iter][4])
            elif self.folder_store[tree_iter][3] == self.default_directory:
                        self.remove_folder_button.set_sensitive(False)
                        self.update_icon_view(path=self.folder_store[tree_iter][3])
            else:
                self.remove_folder_button.set_sensitive(True)
                self.update_icon_view(path=self.folder_store[tree_iter][3])

    def on_row_activated(self, tree, path, column):
        self.folder_tree.set_selection(path)

    def on_folder_source_changed(self, tree):
        if tree.get_selection() is not None:
            folder_paths, iter = tree.get_selection().get_selected()
            if iter :
                path = folder_paths[iter][3]
                if path and path != self._slideshow_schema.get_string("image-source"):
                    self._slideshow_schema.set_string("image-source", path)
                    if folder_paths[iter][4] is not None:
                        self.remove_folder_button.set_sensitive(False)
                        self.update_icon_view(props=folder_paths[iter][4])
                    elif self.folder_store[iter][3] == self.default_directory:
                        self.remove_folder_button.set_sensitive(False)
                        self.update_icon_view(path=path)
                    else:
                        self.remove_folder_button.set_sensitive(True)
                        self.update_icon_view(path=path)

    def get_selected_wallpaper(self):
        selected_items = self.icon_view.get_selected_items()
        if len(selected_items) == 1:
            path = selected_items[0]
            iter = self.icon_view.get_model().get_iter(path)
            return self.icon_view.get_model().get(iter, 0)[0]
        return None

    def on_wallpaper_selection_changed(self, iconview):
        wallpaper = self.get_selected_wallpaper()
        if wallpaper:
            for key in wallpaper:
                if key == "filename":
                    self._background_schema.set_string("picture-uri", "file://" + wallpaper[key])
                elif key == "options":
                    self._background_schema.set_string("picture-options", wallpaper[key])

    def add_new_folder(self):
        res = self.add_folder_dialog.run()
        if res == Gtk.ResponseType.OK:
            folder_path = self.add_folder_dialog.get_filename()
            if folder_path != self.default_directory:
                folder_name = folder_path.split("/")[-1]
                self.user_backgrounds.append([False, "folder", folder_name, folder_path, None])
                self.folder_store.append([False, "folder", folder_name, folder_path, None])
                self.update_folder_list()
        self.add_folder_dialog.hide()

    def remove_folder(self):
        if self.folder_tree.get_selection() is not None:
            self.icon_view.clear()
            folder_paths, iter = self.folder_tree.get_selection().get_selected()
            if iter:
                path = folder_paths[iter][3]
                self.folder_store.remove(iter)
                for item in self.user_backgrounds:
                    if item[3] == path:
                        self.user_backgrounds.remove(item)
                        self.update_folder_list()
                        break

    def update_folder_list(self):
        dest_dir = os.path.join(os.getenv("HOME"), ".cinnamon", "backgrounds")
        if not os.path.exists(dest_dir):
            rec_mkdir(dest_dir)
        dest_filename = os.path.join(dest_dir, "user-folders.lst")
        if len(self.user_backgrounds) == 0:
            file_data = ""
        else:
            first_path = self.user_backgrounds[0][3]
            file_data = first_path + "\n"
            for folder in self.user_backgrounds:
                if folder[3] == first_path:
                    continue
                else:
                    file_data += "%s\n" % folder[3]

        with open(dest_filename, "w") as f:
            f.write(file_data)

    def update_icon_view(self, path=None, props=None):
        picture_list = []
        if path:
            if os.path.exists(path):
                for i in os.listdir(path):
                    filename = os.path.join(path, i)
                    if commands.getoutput("file -bi \"%s\"" % filename).startswith("image/"):
                        picture_list.append({"filename": filename})
        else:
            if os.path.exists(props):
                picture_list += self.parse_xml_backgrounds_list(props)

        self.icon_view.set_pictures_list(picture_list)
        if self._slideshow_schema.get_boolean("slideshow-enabled"):
            self.icon_view.set_sensitive(False)
        else:
            self.icon_view.set_sensitive(True)

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