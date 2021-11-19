#!/usr/bin/python3

import os
import imtools
import gettext
import _thread as thread
import subprocess
import locale
import time
import hashlib
import mimetypes
import pickle
from io import BytesIO
from xml.etree import ElementTree

from PIL import Image
import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gio, Gtk, Gdk, GdkPixbuf, Pango, GLib

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

gettext.install("cinnamon", "/usr/share/locale")

BACKGROUND_COLOR_SHADING_TYPES = [
    ("solid", _("Solid color")),
    ("horizontal", _("Horizontal gradient")),
    ("vertical", _("Vertical gradient"))
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

BACKGROUND_COLLECTION_TYPE_DIRECTORY = "directory"
BACKGROUND_COLLECTION_TYPE_XML = "xml"

# even though pickle supports higher protocol versions, we want to version 2 because it's the latest
# version supported by python2 which (at this time) is still used by older versions of Cinnamon.
# When those versions are no longer supported, we can consider using a newer version.
PICKLE_PROTOCOL_VERSION = 2

(STORE_IS_SEPARATOR, STORE_ICON, STORE_NAME, STORE_PATH, STORE_TYPE) = range(5)

# EXIF utility functions (source: http://stackoverflow.com/questions/4228530/pil-thumbnail-is-rotating-my-image)
def flip_horizontal(im): return im.transpose(Image.FLIP_LEFT_RIGHT)
def flip_vertical(im): return im.transpose(Image.FLIP_TOP_BOTTOM)
def rotate_180(im): return im.transpose(Image.ROTATE_180)
def rotate_90(im): return im.transpose(Image.ROTATE_90)
def rotate_270(im): return im.transpose(Image.ROTATE_270)
def transpose(im): return rotate_90(flip_horizontal(im))
def transverse(im): return rotate_90(flip_vertical(im))
orientation_funcs = [None,
                     lambda x: x,
                     flip_horizontal,
                     rotate_180,
                     flip_vertical,
                     transpose,
                     rotate_270,
                     transverse,
                     rotate_90
                     ]
def apply_orientation(im):
    """
    Extract the oritentation EXIF tag from the image, which should be a PIL Image instance,
    and if there is an orientation tag that would rotate the image, apply that rotation to
    the Image instance given to do an in-place rotation.

    :param Image im: Image instance to inspect
    :return: A possibly transposed image instance
    """

    try:
        kOrientationEXIFTag = 0x0112
        if hasattr(im, '_getexif'): # only present in JPEGs
            e = im._getexif()       # returns None if no EXIF data
            if e is not None:
                #log.info('EXIF data found: %r', e)
                orientation = e[kOrientationEXIFTag]
                f = orientation_funcs[orientation]
                return f(im)
    except:
        # We'd be here with an invalid orientation value or some random error?
        pass # log.exception("Error applying EXIF Orientation tag")
    return im


class ColorsWidget(SettingsWidget):
    def __init__(self, size_group):
        super(ColorsWidget, self).__init__(dep_key=None)

        #gsettings
        self.settings = Gio.Settings("org.cinnamon.desktop.background")

        # settings widgets
        combo = Gtk.ComboBox()
        key = 'color-shading-type'
        value = self.settings.get_string(key)
        renderer_text = Gtk.CellRendererText()
        combo.pack_start(renderer_text, True)
        combo.add_attribute(renderer_text, "text", 1)
        model = Gtk.ListStore(str, str)
        combo.set_model(model)
        combo.set_id_column(0)
        for option in BACKGROUND_COLOR_SHADING_TYPES:
            iter = model.append([option[0], option[1]])
            if value == option[0]:
                combo.set_active_iter(iter)
        combo.connect('changed', self.on_combo_changed, key)

        self.content_widget = Gtk.Box(valign=Gtk.Align.CENTER)
        self.content_widget.pack_start(combo, False, False, 2)

        # Primary color
        for key in ['primary-color', 'secondary-color']:
            color_button = Gtk.ColorButton()
            color_button.set_use_alpha(True)
            rgba = Gdk.RGBA()
            rgba.parse(self.settings.get_string(key))
            color_button.set_rgba(rgba)
            color_button.connect('color-set', self.on_color_changed, key)
            self.content_widget.pack_start(color_button, False, False, 2)

        # Keep a ref on the second color button (so we can hide/show it when appropriate)
        self.color2_button = color_button
        self.color2_button.set_no_show_all(True)
        self.show_or_hide_color2(value)
        self.add_to_size_group(size_group)
        self.label = SettingsLabel(_("Background color"))
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

    def on_color_changed(self, widget, key):
        color_string = widget.get_color().to_string()
        self.settings.set_string(key, color_string)

    def on_combo_changed(self, widget, key):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            value = widget.get_model()[tree_iter][0]
            self.settings.set_string(key, value)
            self.show_or_hide_color2(value)

    def show_or_hide_color2(self, value):
        if (value == 'solid'):
            self.color2_button.hide()
        else:
            self.color2_button.show()

class Module:
    name = "backgrounds"
    category = "appear"
    comment = _("Change your desktop's background")

    def __init__(self, content_box):
        keywords = _("background, picture, slideshow")
        self.sidePage = SidePage(_("Backgrounds"), "cs-backgrounds", keywords, content_box, module=self)

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Backgrounds module")

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            self.shown_collection = None  # Which collection is displayed in the UI

            self._background_schema = Gio.Settings(schema="org.cinnamon.desktop.background")
            self._slideshow_schema = Gio.Settings(schema="org.cinnamon.desktop.background.slideshow")
            self._slideshow_schema.connect("changed::slideshow-enabled", self.on_slideshow_enabled_changed)
            self.add_folder_dialog = Gtk.FileChooserDialog(title=_("Add Folder"),
                                                           action=Gtk.FileChooserAction.SELECT_FOLDER,
                                                           buttons=(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                                                    Gtk.STOCK_OPEN, Gtk.ResponseType.OK))

            self.xdg_pictures_directory = os.path.expanduser("~/Pictures")
            xdg_config = os.path.expanduser("~/.config/user-dirs.dirs")
            if os.path.exists(xdg_config) and os.path.exists("/usr/bin/xdg-user-dir"):
                path = subprocess.check_output(["xdg-user-dir", "PICTURES"]).decode("utf-8").rstrip("\n")
                if os.path.exists(path):
                    self.xdg_pictures_directory = path

            self.get_user_backgrounds()

            # Images

            mainbox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 2)
            mainbox.expand = True
            mainbox.set_border_width(8)

            self.sidePage.stack.add_titled(mainbox, "images", _("Images"))

            left_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0)
            right_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0)

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

            right_vbox.pack_start(image_scroller, True, True, 0)
            left_vbox.pack_start(folder_scroller, True, True, 0)
            left_vbox.pack_start(button_toolbar, False, False, 0)

            mainbox.pack_start(left_vbox, False, False, 2)
            mainbox.pack_start(right_vbox, True, True, 2)

            left_vbox.set_border_width(2)
            right_vbox.set_border_width(2)

            self.collection_store = Gtk.ListStore(bool,    # is separator
                                                  str,     # Icon name
                                                  str,     # Display name
                                                  str,     # Path
                                                  str)     # Type of collection
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
            self.collection_store.append(tree_separator)

            if len(self.user_backgrounds) > 0:
                for item in self.user_backgrounds:
                    self.collection_store.append(item)

            self.folder_tree.set_model(self.collection_store)
            self.folder_tree.set_row_separator_func(self.is_row_separator, None)

            self.get_initial_path()

            # Settings

            page = SettingsPage()

            settings = page.add_section(_("Background Settings"))

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            self.sidePage.stack.add_titled(page, "settings", _("Settings"))

            widget = GSettingsSwitch(_("Play backgrounds as a slideshow"), "org.cinnamon.desktop.background.slideshow", "slideshow-enabled")
            settings.add_row(widget)

            widget = GSettingsSpinButton(_("Delay"), "org.cinnamon.desktop.background.slideshow", "delay", _("minutes"), 1, 1440)
            settings.add_reveal_row(widget, "org.cinnamon.desktop.background.slideshow", "slideshow-enabled")

            widget = GSettingsSwitch(_("Play images in random order"), "org.cinnamon.desktop.background.slideshow", "random-order")
            settings.add_reveal_row(widget, "org.cinnamon.desktop.background.slideshow", "slideshow-enabled")

            widget = GSettingsComboBox(_("Picture aspect"), "org.cinnamon.desktop.background", "picture-options", BACKGROUND_PICTURE_OPTIONS, size_group=size_group)
            settings.add_row(widget)

            widget = ColorsWidget(size_group)
            settings.add_row(widget)

    def is_row_separator(self, model, iter, data):
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
        backgrounds = []
        if os.path.exists(properties_dir):
            for i in os.listdir(properties_dir):
                if i.endswith(".xml"):
                    xml_path = os.path.join(properties_dir, i)
                    display_name = i.replace(".xml", "").replace("-", " ").replace("_", " ").split(" ")[-1].capitalize()
                    icon = "preferences-desktop-wallpaper-symbolic"
                    order = 10
                    # Special case for Linux Mint. We don't want to use 'start-here' here as it wouldn't work depending on the theme.
                    # Also, other distros should get equal treatment. If they define cinnamon-backgrounds and use their own distro name, we should add support for it.
                    if display_name == "Retro":
                        icon = "document-open-recent-symbolic"
                        order = 20 # place retro bgs at the end
                    if display_name == "Linuxmint":
                        display_name = "Linux Mint"
                        icon = "linuxmint-logo-badge-symbolic"
                        order = 0
                    backgrounds.append([[False, icon, display_name, xml_path, BACKGROUND_COLLECTION_TYPE_XML], display_name, order])

        backgrounds.sort(key=lambda x: (x[2], x[1]))
        for background in backgrounds:
            self.collection_store.append(background[0])

    def get_user_backgrounds(self):
        self.user_backgrounds = []
        path = os.path.expanduser("~/.cinnamon/backgrounds/user-folders.lst")
        if os.path.exists(path):
            with open(path) as f:
                folders = f.readlines()
            for line in folders:
                folder_path = line.strip("\n")
                folder_name = folder_path.split("/")[-1]
                if folder_path == self.xdg_pictures_directory:
                    icon = "folder-pictures-symbolic"
                else:
                    icon = "folder-symbolic"
                self.user_backgrounds.append([False, icon, folder_name, folder_path, BACKGROUND_COLLECTION_TYPE_DIRECTORY])
        else:
            # Add XDG PICTURE DIR
            self.user_backgrounds.append([False, "folder-pictures-symbolic", self.xdg_pictures_directory.split("/")[-1], self.xdg_pictures_directory, BACKGROUND_COLLECTION_TYPE_DIRECTORY])
            self.update_folder_list()

    def format_source(self, type, path):
        # returns 'type://path'
        return ("%s://%s" % (type, path))

    def get_initial_path(self):
        try:
            image_source = self._slideshow_schema.get_string("image-source")
            tree_iter = self.collection_store.get_iter_first()
            collection = self.collection_store[tree_iter]
            collection_type = collection[STORE_TYPE]
            collection_path = collection[STORE_PATH]
            collection_source = self.format_source(collection_type, collection_path)
            self.remove_folder_button.set_sensitive(True)

            if image_source != "" and "://" in image_source:
                while tree_iter != None:
                    if collection_source == image_source:
                        tree_path = self.collection_store.get_path(tree_iter)
                        self.folder_tree.set_cursor(tree_path)
                        if collection_type == BACKGROUND_COLLECTION_TYPE_XML:
                            self.remove_folder_button.set_sensitive(False)
                        self.update_icon_view(collection_path, collection_type)
                        return
                    tree_iter = self.collection_store.iter_next(tree_iter)
                    collection = self.collection_store[tree_iter]
                    collection_type = collection[STORE_TYPE]
                    collection_path = collection[STORE_PATH]
                    collection_source = self.format_source(collection_type, collection_path)
            else:
                self._slideshow_schema.set_string("image-source", collection_source)
                tree_path = self.collection_store.get_path(tree_iter)
                self.folder_tree.get_selection().select_path(tree_path)
                if collection_type == BACKGROUND_COLLECTION_TYPE_XML:
                    self.remove_folder_button.set_sensitive(False)
                self.update_icon_view(collection_path, collection_type)
        except Exception as detail:
            print(detail)

    def on_row_activated(self, tree, path, column):
        self.folder_tree.set_selection(path)

    def on_folder_source_changed(self, tree):
        self.remove_folder_button.set_sensitive(True)
        if tree.get_selection() is not None:
            folder_paths, iter = tree.get_selection().get_selected()
            if iter:
                collection_path = folder_paths[iter][STORE_PATH]
                collection_type = folder_paths[iter][STORE_TYPE]
                collection_source = self.format_source(collection_type, collection_path)
                if os.path.exists(collection_path):
                    if collection_source != self._slideshow_schema.get_string("image-source"):
                        self._slideshow_schema.set_string("image-source", collection_source)
                    if collection_type == BACKGROUND_COLLECTION_TYPE_XML:
                        self.remove_folder_button.set_sensitive(False)
                    self.update_icon_view(collection_path, collection_type)

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
            folder_name = folder_path.split("/")[-1]
            # Make sure it's not already added..
            for background in self.user_backgrounds:
                if background[STORE_PATH] == folder_path:
                    self.add_folder_dialog.hide()
                    return
            if folder_path == self.xdg_pictures_directory:
                icon = "folder-pictures-symbolic"
            else:
                icon = "folder-symbolic"
            self.user_backgrounds.append([False, icon, folder_name, folder_path, BACKGROUND_COLLECTION_TYPE_DIRECTORY])
            self.collection_store.append([False, icon, folder_name, folder_path, BACKGROUND_COLLECTION_TYPE_DIRECTORY])
            self.update_folder_list()
        self.add_folder_dialog.hide()

    def remove_folder(self):
        if self.folder_tree.get_selection() is not None:
            self.icon_view.clear()
            folder_paths, iter = self.folder_tree.get_selection().get_selected()
            if iter:
                path = folder_paths[iter][STORE_PATH]
                self.collection_store.remove(iter)
                for item in self.user_backgrounds:
                    if item[STORE_PATH] == path:
                        self.user_backgrounds.remove(item)
                        self.update_folder_list()
                        break

    def update_folder_list(self):
        path = os.path.expanduser("~/.cinnamon/backgrounds")
        if not os.path.exists(path):
            os.makedirs(path, mode=0o755, exist_ok=True)
        path = os.path.expanduser("~/.cinnamon/backgrounds/user-folders.lst")
        if len(self.user_backgrounds) == 0:
            file_data = ""
        else:
            first_path = self.user_backgrounds[0][STORE_PATH]
            file_data = first_path + "\n"
            for folder in self.user_backgrounds:
                if folder[STORE_PATH] == first_path:
                    continue
                else:
                    file_data += "%s\n" % folder[STORE_PATH]

        with open(path, "w") as f:
            f.write(file_data)

    def update_icon_view(self, path=None, type=None):
        if path != self.shown_collection:
            self.shown_collection = path
            picture_list = []
            if os.path.exists(path):
                if type == BACKGROUND_COLLECTION_TYPE_DIRECTORY:
                    files = os.listdir(path)
                    files.sort()
                    for i in files:
                        filename = os.path.join(path, i)
                        picture_list.append({"filename": filename})
                elif type == BACKGROUND_COLLECTION_TYPE_XML:
                    picture_list += self.parse_xml_backgrounds_list(path)

            self.icon_view.set_pictures_list(picture_list, path)
            if self._slideshow_schema.get_boolean("slideshow-enabled"):
                self.icon_view.set_sensitive(False)
            else:
                self.icon_view.set_sensitive(True)

    def splitLocaleCode(self, localeCode):
        try:
            loc = localeCode.partition("_")
            loc = (loc[0], loc[2])
        except:
            loc = ("en", "US")
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
                                    locName = self.splitLocaleCode(propAttr.get(locAttrName)) if locAttrName in propAttr else ("", "")
                                    names.append((locName, wpName))
                        wallpaperData["name"] = self.getLocalWallpaperName(names, loc)

                        if "filename" in wallpaperData and wallpaperData["filename"] != "" and os.path.exists(wallpaperData["filename"]) and os.access(wallpaperData["filename"], os.R_OK):
                            if wallpaperData["name"] == "":
                                wallpaperData["name"] = os.path.basename(wallpaperData["filename"])
                            res.append(wallpaperData)
            return res
        except Exception as detail:
            print("Could not parse %s!" % filename)
            print(detail)
            return []

class PixCache(object):

    def __init__(self):
        self._data = {}

    def get_pix(self, filename, size=None):
        if filename is None:
            return None
        mimetype = mimetypes.guess_type(filename)[0]
        if mimetype is None or not mimetype.startswith("image/"):
            return None

        if filename not in self._data:
            self._data[filename] = {}
        if size in self._data[filename]:
            pix = self._data[filename][size]
        else:
            try:
                h = hashlib.sha1(('%f%s' % (os.path.getmtime(filename), filename)).encode()).hexdigest()
                tmp_cache_path = GLib.get_user_cache_dir() + '/cs_backgrounds/'
                if not os.path.exists(tmp_cache_path):
                    os.mkdir(tmp_cache_path)
                cache_filename = tmp_cache_path + h + "v2"

                loaded = False
                if os.path.exists(cache_filename):
                    # load from disk cache
                    try:
                        with open(cache_filename, "rb") as cache_file:
                            pix = pickle.load(cache_file)
                        tmp_img = Image.open(BytesIO(pix[0]))
                        pix[0] = self._image_to_pixbuf(tmp_img)
                        loaded = True
                    except Exception as detail:
                        # most likely either the file is corrupted, or the file was pickled using the
                        # python2 version of cinnamon settings. Either way, we want to ditch the current
                        # cache file and generate a new one. This is still backward compatible with older
                        # Cinnamon versions
                        os.remove(cache_filename)

                if not loaded:
                    if mimetype == "image/svg+xml":
                        # rasterize svg with Gdk-Pixbuf and convert to PIL Image
                        tmp_pix = GdkPixbuf.Pixbuf.new_from_file(filename)
                        mode = "RGBA" if tmp_pix.props.has_alpha else "RGB"
                        img = Image.frombytes(mode, (tmp_pix.props.width, tmp_pix.props.height),
                                              tmp_pix.read_pixel_bytes().get_data(), "raw",
                                              mode, tmp_pix.props.rowstride)
                    else:
                        img = Image.open(filename)
                        img = apply_orientation(img)

                    # generate thumbnail
                    (width, height) = img.size
                    if img.mode != "RGB":
                        if img.mode == "RGBA":
                            bg_img = Image.new("RGBA", img.size, (255,255,255,255))
                            img = Image.alpha_composite(bg_img, img)
                        img = img.convert("RGB")
                    if size:
                        img.thumbnail((size, size), Image.ANTIALIAS)
                    img = imtools.round_image(img, {}, False, None, 3, 255)
                    img = imtools.drop_shadow(img, 4, 4, background_color=(255, 255, 255, 0),
                                              shadow_color=0x444444, border=8, shadow_blur=3,
                                              force_background_color=False, cache=None)

                    # save to disk cache
                    try:
                        png_bytes = BytesIO()
                        img.save(png_bytes, "png")
                        with open(cache_filename, "wb") as cache_file:
                            pickle.dump([png_bytes.getvalue(), width, height], cache_file, PICKLE_PROTOCOL_VERSION)
                    except Exception as detail:
                        print("Failed to save cache file: %s: %s" % (cache_filename, detail))

                    pix = [self._image_to_pixbuf(img), width, height]
            except Exception as detail:
                print("Failed to convert %s: %s" % (filename, detail))
                pix = None
            if pix:
                self._data[filename][size] = pix
        return pix

    # Convert RGBA PIL Image to Pixbuf
    def _image_to_pixbuf(self, img):
        [w, h] = img.size
        return GdkPixbuf.Pixbuf.new_from_bytes(GLib.Bytes.new(img.tobytes()),
                                               GdkPixbuf.Colorspace.RGB,
                                               True, 8, w, h,
                                               w * 4)

PIX_CACHE = PixCache()


class ThreadedIconView(Gtk.IconView):

    def __init__(self):
        Gtk.IconView.__init__(self)
        self.set_item_width(BACKGROUND_ICONS_SIZE * 1.1)
        self._model = Gtk.ListStore(object, GdkPixbuf.Pixbuf, str, str)
        self._model_filter = self._model.filter_new()
        self._model_filter.set_visible_func(self.visible_func)
        self.set_model(self._model_filter)

        area = self.get_area()

        self.current_path = None

        pixbuf_renderer = Gtk.CellRendererPixbuf()
        text_renderer = Gtk.CellRendererText(ellipsize=Pango.EllipsizeMode.END)

        text_renderer.set_alignment(.5, .5)
        area.pack_start(pixbuf_renderer, True, False, False)
        area.pack_start(text_renderer, True, False, False)
        self.add_attribute(pixbuf_renderer, "pixbuf", 1)
        self.add_attribute(text_renderer, "markup", 2)
        text_renderer.set_property("alignment", Pango.Alignment.CENTER)

        self._loading_queue = []
        self._loading_queue_lock = thread.allocate_lock()

        self._loading_lock = thread.allocate_lock()
        self._loading = False

        self._loaded_data = []
        self._loaded_data_lock = thread.allocate_lock()

    def visible_func(self, model, iter, data=None):
        item_path = model.get_value(iter, 3)
        return item_path == self.current_path

    def set_pictures_list(self, pictures_list, path=None):
        self.clear()
        self.current_path = path
        for i in pictures_list:
            self.add_picture(i, path)

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

    def add_picture(self, picture, path):
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
            thread.start_new_thread(self._do_load, (path,))

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

    def _do_load(self, path):
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
                    self._loaded_data.append((to_load, pix[0], "<b>%s</b>\n<sub>%s%s</sub>" % (label, artist, dimensions), path))
                    self._loaded_data_lock.release()

        self._loading_lock.acquire()
        self._loading = False
        self._loading_lock.release()

    def getFirstFileFromBackgroundXml(self, filename):
        try:
            f = open(filename)
            rootNode = ElementTree.fromstring(f.read())
            f.close()
            if rootNode.tag == "background":
                for backgroundNode in rootNode:
                    if backgroundNode.tag == "static":
                        for staticNode in backgroundNode:
                            if staticNode.tag == "file":
                                if len(staticNode) > 0 and staticNode[-1].tag == "size":
                                    return staticNode[-1].text
                                return staticNode.text
            print("Could not find filename in %s" % filename)
            return None
        except Exception as detail:
            print("Failed to read filename from %s: %s" % (filename, detail))
            return None
