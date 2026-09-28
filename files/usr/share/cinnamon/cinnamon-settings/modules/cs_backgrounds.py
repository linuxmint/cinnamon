#!/usr/bin/python3

import os
import gettext
import _thread as thread
import locale
import time
import hashlib
import mimetypes
from functools import cache
import pickle
from io import BytesIO
from xml.etree import ElementTree

from PIL import Image
import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gio, Gtk, Gdk, GdkPixbuf, Pango, GLib

import config

config.add_private_typelib_path()
gi.require_version("CinnamonBg", "1.0")
from gi.repository import CinnamonBg

from bin.SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

gettext.install("cinnamon", "/usr/share/locale")

BACKGROUND_COLOR_SHADING_TYPES = [
    ("solid", _("Solid color")),
    ("horizontal", _("Horizontal gradient")),
    ("vertical", _("Vertical gradient"))
]

BACKGROUND_PICTURE_OPTIONS = [
    ("none", _("No picture")),
    ("zoom", _("Zoom (default)")),
    ("wallpaper", _("Mosaic")),
    ("centered", _("Centered")),
    ("scaled", _("Scaled")),
    ("stretched", _("Stretched"))
]

BACKGROUND_ICONS_SIZE = 100

BACKGROUND_COLLECTION_TYPE_DIRECTORY = "directory"
BACKGROUND_COLLECTION_TYPE_XML = "xml"

CONFIG_FOLDER = os.path.join(GLib.get_user_config_dir(), 'cinnamon', 'backgrounds')
OLD_CONFIG_FOLDER = os.path.expanduser("~/.cinnamon/backgrounds")
USER_FOLDERS_FILE_NAME = 'user-folders.lst'

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


class AspectWidget(SettingsWidget):
    def __init__(self, size_group, module):
        super(AspectWidget, self).__init__(dep_key=None)
        self.module = module
        self._updating = False

        self.combo = Gtk.ComboBox()
        renderer_text = Gtk.CellRendererText()
        self.combo.pack_start(renderer_text, True)
        self.combo.add_attribute(renderer_text, "text", 1)
        model = Gtk.ListStore(str, str)
        self.combo.set_model(model)
        self.combo.set_id_column(0)
        for option in BACKGROUND_PICTURE_OPTIONS:
            model.append([option[0], option[1]])
        self.combo.connect('changed', self.on_combo_changed)

        self.content_widget = Gtk.Box(valign=Gtk.Align.CENTER)
        self.content_widget.pack_start(self.combo, False, False, 2)
        self.add_to_size_group(size_group)
        self.label = SettingsLabel(_("Picture aspect"))
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)
        self.show_all()
        self.set_no_show_all(True)
        self.refresh()

    def refresh(self):
        spanned = self.module.spanned()
        item = self.module.effective_item()
        if spanned or item is None:
            return
        self._updating = True
        self.combo.set_active_id(item.props.picture_options)
        self._updating = False

    def on_combo_changed(self, widget):
        if self._updating:
            return
        tree_iter = widget.get_active_iter()
        if tree_iter is not None:
            self.module.write_placement(widget.get_model()[tree_iter][0])


class ColorsWidget(SettingsWidget):
    def __init__(self, size_group, module):
        super(ColorsWidget, self).__init__(dep_key=None)
        self.module = module
        self._updating = False

        self.combo = Gtk.ComboBox()
        renderer_text = Gtk.CellRendererText()
        self.combo.pack_start(renderer_text, True)
        self.combo.add_attribute(renderer_text, "text", 1)
        model = Gtk.ListStore(str, str)
        self.combo.set_model(model)
        self.combo.set_id_column(0)
        for option in BACKGROUND_COLOR_SHADING_TYPES:
            model.append([option[0], option[1]])
        self.combo.connect('changed', self.on_combo_changed)

        self.content_widget = Gtk.Box(valign=Gtk.Align.CENTER)
        self.content_widget.pack_start(self.combo, False, False, 2)

        self.color_buttons = {}
        for key in ['primary-color', 'secondary-color']:
            color_button = Gtk.ColorButton()
            color_button.set_use_alpha(True)
            color_button.connect('color-set', self.on_color_changed, key)
            self.content_widget.pack_start(color_button, False, False, 2)
            self.color_buttons[key] = color_button

        self.color2_button = self.color_buttons['secondary-color']
        self.color2_button.set_no_show_all(True)
        self.add_to_size_group(size_group)
        self.label = SettingsLabel(_("Background color"))
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)
        self.refresh()

    def refresh(self):
        item = self.module.effective_item()
        if item is None:
            return
        shading = item.props.color_shading_type
        self._updating = True
        self.combo.set_active_id(shading)
        for key, value in (('primary-color', item.props.primary_color),
                           ('secondary-color', item.props.secondary_color)):
            rgba = Gdk.RGBA()
            rgba.parse(value)
            self.color_buttons[key].set_rgba(rgba)
        self._updating = False
        self.show_or_hide_color2(shading)

    def on_color_changed(self, widget, key):
        if self._updating:
            return
        self.module.write_color(key, widget.get_rgba().to_string())

    def on_combo_changed(self, widget):
        if self._updating:
            return
        tree_iter = widget.get_active_iter()
        if tree_iter is not None:
            nick = widget.get_model()[tree_iter][0]
            self.module.write_shading(nick)
            self.show_or_hide_color2(nick)

    def show_or_hide_color2(self, value):
        if value == 'solid':
            self.color2_button.hide()
        else:
            self.color2_button.show()


class SlideshowSwitch(SettingsWidget):
    def __init__(self, module):
        super(SlideshowSwitch, self).__init__(dep_key=None)
        self.module = module
        self._updating = False
        self.content_widget = Gtk.Switch(valign=Gtk.Align.CENTER)
        self.content_widget.connect("notify::active", self.on_toggled)
        self.label = SettingsLabel(_("Slideshow"))
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)
        self.refresh()

    def refresh(self):
        self._updating = True
        item = self.module.effective_item()
        self.content_widget.set_active(item.props.slideshow if item is not None else False)
        self._updating = False

    def on_toggled(self, widget, param):
        if self._updating:
            return
        self.module.write_slideshow(widget.get_active())


def walk_widgets(widget):
    yield widget
    if isinstance(widget, Gtk.Container):
        for child in widget.get_children():
            yield from walk_widgets(child)


def _row_header(row, before, _data=None):
    if before is None:
        row.set_header(None)
    elif row.get_header() is None:
        row.set_header(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))


def _row_list():
    list_box = Gtk.ListBox()
    list_box.set_selection_mode(Gtk.SelectionMode.NONE)
    list_box.set_header_func(_row_header, None)
    return list_box


def _add_row(list_box, widget):
    row = Gtk.ListBoxRow(can_focus=False)
    row.add(widget)
    list_box.add(row)
    return row


class FramedSection(Gtk.Frame):
    def __init__(self):
        super().__init__(shadow_type=Gtk.ShadowType.IN)
        self.get_style_context().add_class("view")
        self.box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0)
        self.add(self.box)

    def pack(self, widget, expand=False, fill=False):
        self.box.pack_start(widget, expand, fill, 0)


class MonitorPage(Gtk.Box):
    """Everything one monitor's background is configured with: the folder and
    thumbnail picker, and the appearance rows beneath it.
    """

    def __init__(self, module, item):
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.module = module
        self.item = None
        self._notify_ids = []
        self._loading = False

        self._browsing_source = None
        self.shown_collection = None

        self.mainbox = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 2)
        self.mainbox.expand = True
        self.mainbox.set_border_width(2)

        left_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0)
        right_vbox = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0)
        left_vbox.set_border_width(2)
        right_vbox.set_border_width(2)

        folder_scroller = Gtk.ScrolledWindow.new(None, None)
        folder_scroller.set_shadow_type(Gtk.ShadowType.IN)
        folder_scroller.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        folder_scroller.set_property("min-content-width", 150)

        self.folder_tree = Gtk.TreeView.new()
        self.folder_tree.set_headers_visible(False)
        cell = Gtk.CellRendererText()
        cell.set_alignment(0, 0)
        pb_cell = Gtk.CellRendererPixbuf()
        column = Gtk.TreeViewColumn()
        column.pack_start(pb_cell, False)
        column.pack_start(cell, True)
        column.add_attribute(pb_cell, "icon-name", 1)
        column.add_attribute(cell, "text", 2)
        column.set_cell_data_func(cell, self._style_collection_name)
        column.set_alignment(0)
        self.folder_tree.append_column(column)
        self.folder_tree.set_model(module.collection_store)
        self.folder_tree.set_row_separator_func(module.is_row_separator, None)
        self.folder_tree.connect("cursor-changed", self.on_folder_source_changed)
        folder_scroller.add(self.folder_tree)

        button_toolbar = Gtk.Toolbar.new()
        button_toolbar.set_icon_size(1)
        Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(button_toolbar), "inline-toolbar")
        self.add_folder_button = Gtk.ToolButton.new(None, None)
        self.add_folder_button.set_icon_name("xsi-list-add-symbolic")
        self.add_folder_button.set_tooltip_text(_("Add new folder"))
        self.add_folder_button.connect("clicked", lambda w: self.add_new_folder())
        self.remove_folder_button = Gtk.ToolButton.new(None, None)
        self.remove_folder_button.set_icon_name("xsi-list-remove-symbolic")
        self.remove_folder_button.set_tooltip_text(_("Remove selected folder"))
        self.remove_folder_button.connect("clicked", lambda w: self.remove_folder())
        button_toolbar.insert(self.add_folder_button, 0)
        button_toolbar.insert(self.remove_folder_button, 1)

        image_scroller = Gtk.ScrolledWindow.new(None, None)
        image_scroller.set_shadow_type(Gtk.ShadowType.IN)
        image_scroller.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        self.icon_view = ThreadedIconView()
        self.icon_view.connect("selection-changed", self.on_wallpaper_selection_changed)
        image_scroller.add(self.icon_view)

        left_vbox.pack_start(folder_scroller, True, True, 0)
        left_vbox.pack_start(button_toolbar, False, False, 0)
        right_vbox.pack_start(image_scroller, True, True, 0)
        self.mainbox.pack_start(left_vbox, False, False, 2)
        self.mainbox.pack_start(right_vbox, True, True, 2)

        size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
        self._aspect_widget = AspectWidget(size_group, self)
        self._colors_widget = ColorsWidget(size_group, self)
        self._slideshow_switch = SlideshowSwitch(self)

        self.pack_start(self.mainbox, True, True, 0)

        self._picker_separator = Gtk.Separator.new(Gtk.Orientation.HORIZONTAL)
        self.pack_start(self._picker_separator, False, False, 0)

        rows = _row_list()
        self._aspect_row = _add_row(rows, self._aspect_widget)
        _add_row(rows, self._colors_widget)
        self._slideshow_row = _add_row(rows, self._slideshow_switch)
        self.pack_start(rows, False, False, 0)

        self.show_all()
        for gated in (self.mainbox, self._picker_separator,
                      self._aspect_row, self._slideshow_row):
            gated.set_no_show_all(True)

        self.set_item(item)

    def set_item(self, item):
        for handler in self._notify_ids:
            self.item.disconnect(handler)
        self._notify_ids = []
        self.item = item

        if item is None:
            return

        for signal, callback in (("notify::picture-options", self._on_placement_notify),
                                 ("notify::color-shading-type", self._on_colors_notify),
                                 ("notify::primary-color", self._on_colors_notify),
                                 ("notify::secondary-color", self._on_colors_notify),
                                 ("notify::slideshow", self._on_slideshow_notify),
                                 ("notify::slideshow-source", self._on_source_notify),
                                 ("notify::picture-uri", self._on_uri_notify)):
            self._notify_ids.append(item.connect(signal, callback))

        self.refresh()

    def teardown(self):
        self.set_item(None)
        self.icon_view.stop_loading()

    def _on_placement_notify(self, item, pspec):
        self._aspect_row.set_visible(not self.spanned())
        self._aspect_widget.refresh()
        self.update_picker_visibility()

    def _on_colors_notify(self, item, pspec):
        self._colors_widget.refresh()

    def _on_slideshow_notify(self, item, pspec):
        self._slideshow_switch.refresh()
        self.update_grid_sensitivity()

    def _on_source_notify(self, item, pspec):
        self.refresh_picker()

    def _on_uri_notify(self, item, pspec):
        if item.props.slideshow:
            return
        self.icon_view.set_pending_selection(self.current_uri())

    def refresh(self):
        self._aspect_row.set_visible(not self.spanned())
        self._aspect_widget.refresh()
        self._colors_widget.refresh()
        self._slideshow_switch.refresh()
        self.update_picker_visibility()
        self.update_grid_sensitivity()
        self.refresh_picker()

    def effective_item(self):
        return self.item

    def spanned(self):
        return self.module.spanned()

    def write_entries(self, apply):
        if self.item is None:
            return
        apply(self.item)
        self.module.bg_list.save()

    def write_placement(self, nick):
        self.write_entries(lambda item: setattr(item.props, "picture_options", nick))

        if nick != "none" and not self.current_source():
            self.select_default_source()

    def write_shading(self, nick):
        self.write_entries(lambda item: setattr(item.props, "color_shading_type", nick))

    def write_color(self, key, color_str):
        field = "primary_color" if key == "primary-color" else "secondary_color"
        self.write_entries(lambda item: setattr(item.props, field, color_str))

    def write_slideshow(self, enabled):
        # Switching the slideshow on is the moment a folder becomes the user's
        # choice, the same way picking an image is, so commit one now.
        if enabled:
            source = self._browsing_source or self.current_source()
            if source is None:
                self.select_default_source()
                source = self._browsing_source or self.current_source()
            if source and self.item is not None and self.item.props.slideshow_source != source:
                self.write_entries(lambda item: setattr(item.props, "slideshow_source", source))
            elif not source:
                print("cs_backgrounds: enabling the slideshow with no source: "
                      "no usable background collection was found")
        self.write_entries(lambda item: setattr(item.props, "slideshow", enabled))

    def update_grid_sensitivity(self):
        slideshow = self.item is not None and self.item.props.slideshow
        self.icon_view.set_sensitive(not slideshow)
        self.icon_view.set_selection_mode(Gtk.SelectionMode.NONE if slideshow
                                          else Gtk.SelectionMode.SINGLE)

    def update_picker_visibility(self):
        has_picture = (self.item is not None
                       and self.item.props.picture_options != "none")
        self.mainbox.set_visible(has_picture)
        self._picker_separator.set_visible(has_picture)
        self._slideshow_row.set_visible(has_picture)

    def current_uri(self):
        return self.item.props.picture_uri if self.item is not None else ""

    def current_source(self):
        if self.item is None:
            return None
        source = self.item.props.slideshow_source
        if source:
            return source
        uri = self.item.props.picture_uri
        if uri:
            parent = Gio.File.new_for_uri(uri).get_parent()
            if parent is not None:
                return self.module.format_source(BACKGROUND_COLLECTION_TYPE_DIRECTORY,
                                                 parent.get_path())
        return None

    def select_folder_source(self, source):
        if not source:
            return False
        store = self.module.collection_store
        tree_iter = store.get_iter_first()
        while tree_iter is not None:
            row = store[tree_iter]
            if not row[STORE_IS_SEPARATOR]:
                if self.module.format_source(row[STORE_TYPE], row[STORE_PATH]) == source:
                    self.folder_tree.set_cursor(store.get_path(tree_iter))
                    self.remove_folder_button.set_sensitive(row[STORE_TYPE] != BACKGROUND_COLLECTION_TYPE_XML)
                    self.update_icon_view(row[STORE_PATH], row[STORE_TYPE])
                    return True
            tree_iter = store.iter_next(tree_iter)
        return False

    def select_default_source(self):
        store = self.module.collection_store
        tree_iter = store.get_iter_first()
        while tree_iter is not None:
            row = store[tree_iter]
            if not row[STORE_IS_SEPARATOR] and os.path.exists(row[STORE_PATH]):
                self.folder_tree.set_cursor(store.get_path(tree_iter))
                return
            tree_iter = store.iter_next(tree_iter)

    def show_first_collection(self):
        # Display-only fallback for a monitor with nothing stored yet: the first
        # collection, shown without becoming its choice.
        store = self.module.collection_store
        tree_iter = store.get_iter_first()
        while tree_iter is not None:
            row = store[tree_iter]
            if not row[STORE_IS_SEPARATOR]:
                self.folder_tree.get_selection().select_path(store.get_path(tree_iter))
                self.remove_folder_button.set_sensitive(row[STORE_TYPE] != BACKGROUND_COLLECTION_TYPE_XML)
                self.update_icon_view(row[STORE_PATH], row[STORE_TYPE])
                return
            tree_iter = store.iter_next(tree_iter)

    def refresh_picker(self):
        # Point the folder tree and thumbnail grid at this monitor's stored
        # source, and queue a highlight of its picture. With nothing stored,
        # or a source naming a collection the sidebar no longer lists, fall
        # back to the first collection rather than showing an empty grid.
        self._browsing_source = None
        self._loading = True
        try:
            if not self.select_folder_source(self.current_source()):
                self.show_first_collection()
        finally:
            self._loading = False
        self.icon_view.set_pending_selection(self.current_uri())

    def update_icon_view(self, path=None, type=None):
        if path != self.shown_collection:
            self.shown_collection = path
            picture_list = []
            if path is not None and os.path.exists(path):
                if type == BACKGROUND_COLLECTION_TYPE_DIRECTORY:
                    files = os.listdir(path)
                    files.sort()
                    for i in files:
                        picture_list.append({"filename": os.path.join(path, i)})
                elif type == BACKGROUND_COLLECTION_TYPE_XML:
                    picture_list += self.module.parse_xml_backgrounds_list(path)

            self.icon_view.set_pictures_list(picture_list, path)
            self.update_grid_sensitivity()

    def _style_collection_name(self, column, cell, model, tree_iter, data=None):
        path = model[tree_iter][STORE_PATH]

        cell.props.style = (Pango.Style.ITALIC if path in self.module.transient_backgrounds
                            else Pango.Style.NORMAL)

    def on_folder_source_changed(self, tree):
        if self._loading:
            return
        self.remove_folder_button.set_sensitive(True)
        if tree.get_selection() is None:
            return
        folder_paths, tree_iter = tree.get_selection().get_selected()
        if not tree_iter:
            return
        collection_path = folder_paths[tree_iter][STORE_PATH]
        collection_type = folder_paths[tree_iter][STORE_TYPE]
        collection_source = self.module.format_source(collection_type, collection_path)
        if not os.path.exists(collection_path):
            return
        # Browsing is not a choice: remember what is on screen and persist it
        # only if the user actually picks an image from it.
        self._browsing_source = collection_source
        # Unless a slideshow is running, then the grid is insensitive and there
        # is no image to pick, so choosing the folder is the choice. The daemon
        # rotates onto it at once.
        if (self.item is not None and self.item.props.slideshow and
                self.item.props.slideshow_source != collection_source):
            self.write_entries(lambda item: setattr(item.props, "slideshow_source", collection_source))
        if collection_type == BACKGROUND_COLLECTION_TYPE_XML:
            self.remove_folder_button.set_sensitive(False)
        self.update_icon_view(collection_path, collection_type)

    def get_selected_wallpaper(self):
        selected_items = self.icon_view.get_selected_items()
        if len(selected_items) == 1:
            path = selected_items[0]
            tree_iter = self.icon_view.get_model().get_iter(path)
            return self.icon_view.get_model().get(tree_iter, 0)[0]
        return None

    def on_wallpaper_selection_changed(self, iconview):
        if self._loading or self.item is None:
            return
        wallpaper = self.get_selected_wallpaper()
        if not wallpaper or "filename" not in wallpaper:
            return
        uri = Gio.File.new_for_path(wallpaper["filename"]).get_uri()

        if uri == self.current_uri():
            return

        if (self._browsing_source is not None and
                self.item.props.slideshow_source != self._browsing_source):
            source = self._browsing_source
            self.write_entries(lambda item: setattr(item.props, "slideshow_source", source))

        self.write_entries(lambda item: setattr(item.props, "picture_uri", uri))

        if self.item.props.picture_options == "none":
            self.write_entries(lambda item: setattr(item.props, "picture_options", "zoom"))

    def add_new_folder(self):
        self.module.add_new_folder()

    def remove_folder(self):
        if self.folder_tree.get_selection() is None:
            return
        self.icon_view.clear()
        self.shown_collection = None
        folder_paths, tree_iter = self.folder_tree.get_selection().get_selected()
        if tree_iter:
            self.module.remove_collection(tree_iter, folder_paths[tree_iter][STORE_PATH])


class Module:
    name = "backgrounds"
    category = "appear"
    comment = _("Change your desktop's background")

    def __init__(self, content_box):
        keywords = _("background, picture, slideshow, wallpaper")
        self.sidePage = SidePage(_("Backgrounds"), "cs-backgrounds", keywords, content_box, module=self)

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Backgrounds module")

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            self.bg_list = CinnamonBg.List.new()
            self.bg_list.connect("config-changed", self.on_config_changed)
            self.bg_list.connect("notify::mode", self.on_mode_changed)
            self.bg_list.connect("monitors-changed", self.on_monitors_changed)
            # connector -> MonitorPage. Keyed the way the library keys items, so
            # a page outlives a rebuild that leaves its monitor alone.
            self._pages = {}

            self.add_folder_dialog = Gtk.FileChooserDialog(title=_("Add Folder"),
                                                           action=Gtk.FileChooserAction.SELECT_FOLDER,
                                                           buttons=(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                                                                    Gtk.STOCK_OPEN, Gtk.ResponseType.OK))

            self.xdg_pictures_directory = (GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES)
                                           or os.path.expanduser("~/Pictures"))

            # Folders shown for this session only.
            self.transient_backgrounds = []
            self._located_current_wallpapers = False

            self.get_user_backgrounds()

            # The collections sidebar is the same for every monitor, so one model
            # is shared by every page's folder tree; only the cursor is per-page.
            self.collection_store = Gtk.ListStore(bool,    # is separator
                                                  str,     # Icon name
                                                  str,     # Display name
                                                  str,     # Path
                                                  str)     # Type of collection
            self.get_system_backgrounds()
            self.collection_store.append([True, None, None, None, None])
            for item in self.user_backgrounds:
                self.collection_store.append(item)

            # The Images page: mode selector, then the monitor switcher over the
            # per-monitor pages.
            images_page = Gtk.Box.new(Gtk.Orientation.VERTICAL, 0)
            images_page.set_border_width(15)
            self.sidePage.stack.add_titled(images_page, "images", _("Images"))

            self.mode_section = SettingsSection()
            mode_combo = GSettingsComboBox(_("Background mode"), "org.cinnamon.desktop.background",
                                           "background-mode",
                                           [("independent", _("Configure monitors individually")),
                                            ("mirror", _("Use the same background on all monitors")),
                                            ("spanned", _("Span a single background across all monitors"))])
            self.mode_section.add_row(mode_combo)
            self.mode_section.set_no_show_all(True)

            images_page.pack_start(self.mode_section, False, False, 0)

            self.monitor_stack = Gtk.Stack()
            self.monitor_stack.set_no_show_all(True)
            self.monitor_switcher = Gtk.StackSwitcher(homogeneous=True, halign=Gtk.Align.FILL, margin_top=3, margin_bottom=3)
            self.monitor_switcher.set_stack(self.monitor_stack)
            self.monitor_revealer = Gtk.Revealer(margin_top=3, margin_bottom=3)
            self.monitor_revealer.set_transition_type(Gtk.RevealerTransitionType.SLIDE_DOWN)
            self.monitor_revealer.set_transition_duration(150)
            self.monitor_revealer.add(self.monitor_switcher)
            images_page.pack_start(self.monitor_revealer, False, False, 0)

            # Section 2: the selected monitor's configuration, and nothing else.
            picker_section = FramedSection()

            # Shown until the monitor layout lands, which is what an empty model
            # means; the stack takes its place once there is something to show.
            self.spinner = Gtk.Spinner(halign=Gtk.Align.CENTER,
                                       valign=Gtk.Align.CENTER,
                                       height_request=48,
                                       width_request=48)
            self.spinner.start()
            self.spinner.show()
            self.spinner.set_no_show_all(True)

            picker_section.pack(self.spinner, True, True)
            picker_section.pack(self.monitor_stack, True, True)

            images_page.pack_start(picker_section, True, True, 0)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "settings", _("Settings"))

            slideshow = page.add_section(_("Slideshow"))

            widget = GSettingsSpinButton(_("Delay"), "org.cinnamon.desktop.background.slideshow", "delay", _("minutes"), 1, 1440)
            slideshow.add_row(widget)

            widget = GSettingsSwitch(_("Play images in random order"), "org.cinnamon.desktop.background.slideshow", "random-order")
            slideshow.add_row(widget)

            self.on_config_changed()
            self.update_mode_visibility()

    def items(self):
        return list(self.bg_list)

    def spanned(self):
        return self.bg_list.props.mode == CinnamonBg.Mode.SPANNED

    def on_monitors_changed(self, bg_list):
        self.update_mode_visibility()

    def update_mode_visibility(self):
        # We don't need a mode combo if there is only one monitor.
        n_monitors = len(self.bg_list.get_monitor_infos())
        self.mode_section.set_visible(n_monitors > 1)

    def on_config_changed(self, bg_list=None):
        count = self.bg_list.get_n_items()
        populated = count > 0

        self.spinner.set_visible(not populated)
        self.monitor_stack.set_visible(populated)
        self.monitor_revealer.set_reveal_child(count > 1)
        if populated:
            if not self._located_current_wallpapers:
                self._located_current_wallpapers = True
                self.add_current_wallpaper_locations()
            self.sync_pages()

    def on_mode_changed(self, bg_list, pspec):
        self.bg_list.save()

    def ellipsize_switcher_labels(self):
        for button in self.monitor_switcher.get_children():
            for widget in walk_widgets(button):
                if isinstance(widget, Gtk.Label):
                    widget.set_ellipsize(Pango.EllipsizeMode.MIDDLE)

    def page_title(self, item):
        connector = item.props.connector
        name = item.props.monitor_label or _("All monitors")
        return "%s  %s" % (name, connector) if connector else name

    def sync_pages(self):
        items = self.items()
        keys = [item.props.connector or "all" for item in items]
        current = [self.monitor_stack.child_get_property(child, "name")
                   for child in self.monitor_stack.get_children()]

        if keys == current:
            for item, key in zip(items, keys):
                page = self._pages[key]
                if page.item is not item:
                    page.set_item(item)
                self.monitor_stack.child_set_property(page, "title", self.page_title(item))
            self.ellipsize_switcher_labels()
            return

        previous = self.monitor_stack.get_visible_child_name()

        for page in self._pages.values():
            page.teardown()
            page.destroy()
        self._pages = {}

        for item, key in zip(items, keys):
            page = MonitorPage(self, item)
            self._pages[key] = page
            self.monitor_stack.add_titled(page, key, self.page_title(item))

        if previous in keys:
            self.monitor_stack.set_visible_child_name(previous)

        self.ellipsize_switcher_labels()

    def remove_collection(self, tree_iter, path):
        self.collection_store.remove(tree_iter)
        for item in self.user_backgrounds:
            if item[STORE_PATH] == path:
                self.user_backgrounds.remove(item)
                self.update_folder_list()
                break

    def is_row_separator(self, model, iter, data):
        return model.get_value(iter, 0)

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
                    icon = "xsi-wallpaper-symbolic"
                    order = 10
                    # Special case for Linux Mint. We don't want to use 'start-here' here as it wouldn't work depending on the theme.
                    # Also, other distros should get equal treatment. If they define cinnamon-backgrounds and use their own distro name, we should add support for it.
                    if display_name == "Retro":
                        icon = "xsi-document-open-recent-symbolic"
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
        path = os.path.join(CONFIG_FOLDER, USER_FOLDERS_FILE_NAME)
        old_path = os.path.join(OLD_CONFIG_FOLDER, USER_FOLDERS_FILE_NAME)
        path = path if os.path.exists(path) else old_path
        if os.path.exists(path):
            with open(path) as f:
                folders = f.readlines()
            for line in folders:
                folder_path = line.strip("\n")
                folder_name = folder_path.split("/")[-1]
                if folder_path == self.xdg_pictures_directory:
                    icon = "xsi-folder-pictures-symbolic"
                else:
                    icon = "xsi-folder-symbolic"
                self.user_backgrounds.append([False, icon, folder_name, folder_path, BACKGROUND_COLLECTION_TYPE_DIRECTORY])
        else:
            # Add XDG PICTURE DIR
            self.user_backgrounds.append([False, "xsi-folder-pictures-symbolic", self.xdg_pictures_directory.split("/")[-1], self.xdg_pictures_directory, BACKGROUND_COLLECTION_TYPE_DIRECTORY])
            self.update_folder_list()

    def add_current_wallpaper_locations(self):
        # Show the folder the current wallpaper resides in if it's not included
        # in the existing sets/folders.  This is temporary, only so the user can
        # modify options on the actual current wallpaper.
        listed_folders = set()
        collection_files = []

        for row in self.collection_store:
            if row[STORE_IS_SEPARATOR]:
                continue
            if row[STORE_TYPE] == BACKGROUND_COLLECTION_TYPE_DIRECTORY:
                listed_folders.add(row[STORE_PATH])
            else:
                collection_files.append(row[STORE_PATH])

        # A picture belonging to one of the xml collections is already reachable
        # under that collection's name, so its folder is not wanted.
        listed_pictures = set()
        for xml_path in collection_files:
            for picture in self.parse_xml_backgrounds_list(xml_path):
                listed_pictures.add(picture["filename"])

        for item in self.items():
            uri = item.props.picture_uri
            if not uri:
                continue

            path = Gio.File.new_for_uri(uri).get_path()
            if path is None or path in listed_pictures:
                continue

            folder = os.path.dirname(path)
            if folder in listed_folders or folder in self.transient_backgrounds:
                continue
            if not os.path.isdir(folder):
                continue

            self.transient_backgrounds.append(folder)
            self.collection_store.append([False, "xsi-folder-symbolic",
                                          os.path.basename(folder), folder,
                                          BACKGROUND_COLLECTION_TYPE_DIRECTORY])

    def format_source(self, type, path):
        # returns 'type://path'
        return f"{type}://{path}"

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

            if folder_path in self.transient_backgrounds:
                self.transient_backgrounds.remove(folder_path)
                icon = ("xsi-folder-pictures-symbolic" if folder_path == self.xdg_pictures_directory
                        else "xsi-folder-symbolic")
                self.user_backgrounds.append([False, icon, folder_name, folder_path,
                                              BACKGROUND_COLLECTION_TYPE_DIRECTORY])
                self.update_folder_list()
                # Repaint the row it already has, so it stops being italic.
                for row in self.collection_store:
                    if row[STORE_PATH] == folder_path:
                        self.collection_store.row_changed(row.path, row.iter)
                        break
                self.add_folder_dialog.hide()
                return
            if folder_path == self.xdg_pictures_directory:
                icon = "xsi-folder-pictures-symbolic"
            else:
                icon = "xsi-folder-symbolic"
            self.user_backgrounds.append([False, icon, folder_name, folder_path, BACKGROUND_COLLECTION_TYPE_DIRECTORY])
            self.collection_store.append([False, icon, folder_name, folder_path, BACKGROUND_COLLECTION_TYPE_DIRECTORY])
            self.update_folder_list()
        self.add_folder_dialog.hide()

    def update_folder_list(self):
        path = CONFIG_FOLDER
        if not os.path.exists(path):
            os.makedirs(path, mode=0o755, exist_ok=True)
        path = os.path.join(CONFIG_FOLDER, USER_FOLDERS_FILE_NAME)
        if len(self.user_backgrounds) == 0:
            file_data = ""
        else:
            first_path = self.user_backgrounds[0][STORE_PATH]
            file_data = first_path + "\n"
            for folder in self.user_backgrounds:
                if folder[STORE_PATH] == first_path:
                    continue
                else:
                    file_data += f"{folder[STORE_PATH]}\n"

        with open(path, "w") as f:
            f.write(file_data)

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
            loc = self.splitLocaleCode(locale.getlocale()[0])
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
            print(f"Could not parse {filename}!")
            print(detail)
            return []

@cache
def _pil_mime_types():
    Image.init()
    return {Image.MIME[f] for f in Image.OPEN if f in Image.MIME}


@cache
def _gdk_pixbuf_mime_types():
    gdk = set()
    for fmt in GdkPixbuf.Pixbuf.get_formats():
        gdk.update(fmt.get_mime_types())

    return gdk


@cache
def decodable_mime_types():
    # An image one of the two loaders can actually open. Both halves matter:
    # mimetypes.guess_type() calls a GIMP .xcf image/x-xcf, which neither loader
    # can decode, and PIL registers a few types (postscript, mpeg) that are not
    # images at all.
    return {mime for mime in _gdk_pixbuf_mime_types() | _pil_mime_types()
            if mime.startswith("image/")}


@cache
def gdk_pixbuf_only_mime_types():
    # The types gdk-pixbuf can decode but PIL cannot, which therefore have to be
    # rasterized with gdk-pixbuf. We don't just use gdk-pixbuf for everything because
    # PIL is *much* more efficient at processing large images.
    return _gdk_pixbuf_mime_types() - _pil_mime_types()


class PixCache(object):

    def __init__(self):
        self._data = {}

    def get_pix(self, filename, size=None):
        if filename is None:
            return None
        mimetype = mimetypes.guess_type(filename)[0]
        if mimetype not in decodable_mime_types():
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
                    if mimetype in gdk_pixbuf_only_mime_types():
                        # Rasterize with gdk-pixbuf and convert to a PIL Image.
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
                        img.thumbnail((size, size), Image.LANCZOS)


                    from bin import imtools
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
                        print(f"Failed to save cache file: {cache_filename}: {detail}")

                    pix = [self._image_to_pixbuf(img), width, height]
            except Exception as detail:
                print(f"Failed to convert {filename}: {detail}")
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

        self._pending_uri = None
        self._progress_id = 0

    def set_pending_selection(self, uri):
        # Remember the picture to highlight, and try now in case its folder is
        # already loaded; otherwise _check_loading_progress retries as thumbs
        # arrive.
        self._pending_uri = uri or None
        self._try_pending_selection()

    def _try_pending_selection(self):
        if not self._pending_uri:
            return
        model = self.get_model()
        iter = model.get_iter_first()
        while iter is not None:
            data = model.get_value(iter, 0)
            filename = data.get("filename") if isinstance(data, dict) else None
            if filename and Gio.File.new_for_path(filename).get_uri() == self._pending_uri:
                path = model.get_path(iter)
                self.select_path(path)
                self.scroll_to_path(path, False, 0, 0)
                self._pending_uri = None
                return
            iter = model.iter_next(iter)

    def visible_func(self, model, iter, data=None):
        item_path = model.get_value(iter, 3)
        return item_path == self.current_path

    def set_pictures_list(self, pictures_list, path=None):
        self.clear()
        self.current_path = path
        for i in pictures_list:
            self.add_picture(i, path)

    def stop_loading(self):
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

        self._loaded_data_lock.acquire()
        self._loaded_data = []
        self._loaded_data_lock.release()

        if self._progress_id > 0:
            GLib.source_remove(self._progress_id)
            self._progress_id = 0

        self._pending_uri = None

    def clear(self):
        self.stop_loading()
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
            if self._progress_id == 0:
                self._progress_id = GLib.timeout_add(100, self._check_loading_progress)
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

        if to_load:
            self._try_pending_selection()

        if not res:
            self._progress_id = 0

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
                if pix is not None:
                    if "name" in to_load:
                        label = to_load["name"]
                    else:
                        label = os.path.split(to_load["filename"])[1]
                    if "artist" in to_load:
                        artist = f"{to_load['artist']}\n"
                    else:
                        artist = ""
                    dimensions = f"{pix[1]}x{pix[2]}"

                    self._loaded_data_lock.acquire()
                    self._loaded_data.append((to_load, pix[0], f"<b>{label}</b>\n<small>{artist}{dimensions}</small>", path))
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
            print(f"Could not find filename in {filename}")
            return None
        except Exception as detail:
            print(f"Failed to read filename from {filename}: {detail}")
            return None
