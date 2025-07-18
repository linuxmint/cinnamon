#!/usr/bin/python3

import gettext
import os
import subprocess

import cairo
import gi
gi.require_version("Gtk", "3.0")
gi.require_version("CinnamonDesktop", "3.0")
gi.require_version('IBus', '1.0')
gi.require_version('Pango', '1.0')
from gi.repository import GLib, Gio, Gtk, GObject, CinnamonDesktop, IBus, Pango

from SettingsWidgets import Keybinding
from xapp.SettingsWidgets import SettingsPage
from xapp.GSettingsWidgets import PXGSettingsBackend, GSettingsSwitch

MAX_LAYOUTS_PER_GROUP = 4

def make_gkbd_keyboard_args(layout, variant):
    if variant:
        return ["gkbd-keyboard-display", "-l", f"{layout}\t{variant}"]
    else:
        return ["gkbd-keyboard-display", "-l", layout]

def make_ibus_display_name(engine):
    name = engine.get_longname()
    language_code = engine.get_language()
    language = IBus.get_language_name(language_code)
    textdomain = engine.get_textdomain()
    if textdomain != "" and name != "":
        name = gettext.dgettext(textdomain, name)
    display_name = f"{language} ({name})"
    return display_name

LAYOUT_ID_COLUMN = 0
LAYOUT_DISPLAY_NAME_COLUMN = 1
LAYOUT_TYPE_COLUMN = 2
LAYOUT_LAYOUT_COLUMN = 3
LAYOUT_VARIANT_COLUMN = 4

class AddKeyboardLayoutDialog():
    def __init__(self, used_ids):
        self.input_source_settings = Gio.Settings(schema_id="org.cinnamon.desktop.input-sources")
        self.used_ids = set(used_ids)

        builder = Gtk.Builder()
        builder.set_translation_domain('cinnamon')
        builder.add_from_file("/usr/share/cinnamon/cinnamon-settings/bin/input-sources-list.ui")

        self.dialog = builder.get_object("add_layout_dialog")
        self.add_button = builder.get_object("add_button")
        self.add_button.connect("clicked", self._on_add_button_clicked)
        self.cancel_button = builder.get_object("cancel_button")
        self.cancel_button.connect("clicked", self._on_cancel_button_clicked)
        self.preview_button = builder.get_object("preview_button")
        self.preview_button.connect("clicked", self._on_preview_button_clicked)
        self.search_entry = builder.get_object("search_entry")
        self.search_entry.connect("search-changed", self._on_search_entry_changed)
        self.layouts_view = builder.get_object("layouts_view")
        self.layouts_view.connect("row-activated", self._on_row_activated)
        self.layouts_view.get_selection().connect("changed", self._on_row_selected)

        #                                 (layout_id, layout_display_name, layout_type, layout_layout, layout_variant)
        self.layouts_store = Gtk.ListStore(str,       str,                 str,         str,           str)
        self.layouts_filter_store = Gtk.TreeModelFilter(child_model=self.layouts_store)
        self.layouts_filter_store.set_visible_func(self.search_filter_func)
        self.layouts_sort_store = Gtk.TreeModelSort(model=self.layouts_filter_store)
        self.layouts_sort_store.set_sort_column_id(LAYOUT_DISPLAY_NAME_COLUMN, Gtk.SortType.ASCENDING)
        self.layouts_view.set_model(self.layouts_sort_store)

        column = Gtk.TreeViewColumn(title=_("Name"))
        column.set_expand(True)
        column.set_sort_column_id(LAYOUT_DISPLAY_NAME_COLUMN)
        self.layouts_view.append_column(column)
        cell = Gtk.CellRendererText(ellipsize=Pango.EllipsizeMode.MIDDLE)
        column.pack_start(cell, True)
        column.add_attribute(cell, "text", LAYOUT_DISPLAY_NAME_COLUMN)

        column = Gtk.TreeViewColumn(title=_("Input method"))
        column.set_sort_column_id(LAYOUT_TYPE_COLUMN)
        self.layouts_view.append_column(column)
        cell = Gtk.CellRendererText(xpad=10)
        column.pack_start(cell, False)
        column.set_cell_data_func(cell, self.layout_type_data_func)

        self._locales_by_language = {}
        self._locales = {}
        self._row_items = []

        self.response_id = None

        if not GLib.find_program_in_path("gkbd-keyboard-display"):
            self.preview_button.set_visible(False)

        self.xkb_info = CinnamonDesktop.XkbInfo()

        self._load_layouts()
        self._update_widgets()

        self._ibus = IBus.Bus.new_async()
        if not self._ibus.is_connected():
            print("Connecting to IBus")
            self._ibus.connect("connected", self._on_ibus_connected)
        else:
            print("IBus already connected")
            self._on_ibus_connected(self._ibus)

    def _on_ibus_connected(self, ibus, data=None):
        ibus.list_engines_async(5000, None, self._list_ibus_engines_completed)

    def _list_ibus_engines_completed(self, ibus, res, data=None):
        try:
            engines = ibus.list_engines_async_finish(res)
        except GLib.Error as e:
            print("Error getting list of ibus engines: %s" % e.message)
            return

        for engine in engines:
            self.add_ibus_row(engine)

    def get_selected_iter(self):
        model, paths = self.layouts_view.get_selection().get_selected_rows()
        if paths is not None and len(paths) > 0:
            path = paths[0]
            return model.get_iter(path)

        return None

    def _on_row_activated(self, view, path, column, data=None):
        self._on_add_button_clicked(None)

    def _on_row_selected(self, selection, data=None):
        self._update_widgets()

    def _on_search_entry_changed(self, entry, data=None):
        self.layouts_filter_store.refilter()

    def _on_preview_button_clicked(self, button, data=None):
        iter = self.get_selected_iter()
        assert iter is not None

        display_name = self.layouts_sort_store.get_value(iter, LAYOUT_DISPLAY_NAME_COLUMN)
        layout_layout = self.layouts_sort_store.get_value(iter, LAYOUT_LAYOUT_COLUMN)
        layout_variant = self.layouts_sort_store.get_value(iter, LAYOUT_VARIANT_COLUMN)
        args = make_gkbd_keyboard_args(layout_layout, layout_variant)
        subprocess.Popen(args)

    def _on_cancel_button_clicked(self, button, data=None):
        self.dialog.response(Gtk.ResponseType.CANCEL)

    def _on_add_button_clicked(self, button, data=None):
        iter = self.get_selected_iter()

        assert iter is not None

        layout_type = self.layouts_sort_store.get_value(iter, LAYOUT_TYPE_COLUMN)
        layout_id = self.layouts_sort_store.get_value(iter, LAYOUT_ID_COLUMN)
        self.response = (layout_type, layout_id)
        print("Response:", self.response)
        self.dialog.response(Gtk.ResponseType.OK)

    def search_filter_func(self, model, tree_iter, data=None):
        search_entry_text = self.search_entry.get_text()

        if search_entry_text == "":
            return True

        display_name = model.get_value(tree_iter, LAYOUT_DISPLAY_NAME_COLUMN)
        layout_type = model.get_value(tree_iter, LAYOUT_TYPE_COLUMN)
        normalized = GLib.utf8_normalize(display_name, -1, GLib.NormalizeMode.DEFAULT)
        row_text = GLib.utf8_casefold(normalized, -1)

        normalized = GLib.utf8_normalize(search_entry_text, -1, GLib.NormalizeMode.DEFAULT)
        search_text = GLib.utf8_casefold(normalized, -1)

        return search_text in row_text or search_text in layout_type

    def _update_widgets(self):
        iter = self.get_selected_iter()

        if iter is not None:
            self.add_button.set_sensitive(True)
            type_ = self.layouts_sort_store.get_value(iter, LAYOUT_TYPE_COLUMN)
            self.preview_button.set_sensitive(type_ == "xkb")
        else:
            self.add_button.set_sensitive(False)
            self.preview_button.set_sensitive(False)

    def layout_type_data_func(self, column, cell, model, iter, data=None):
        type_ = model.get_value(iter, LAYOUT_TYPE_COLUMN)
        if type_ == "ibus":
            cell.set_property("text", _("IBus"))
        else:
            cell.set_property("text", "")

    def _load_layouts(self):
        for layout in self.xkb_info.get_all_layouts():
            self.add_xkb_row(None, layout)

    def add_xkb_row(self, lang_info, layout_id):
        if layout_id in self.used_ids:
            return

        self.used_ids.add(layout_id)

        got, display_name, short_name, layout, variant = self.xkb_info.get_layout_info(layout_id)
        if got:
            self.layouts_store.append((layout_id, display_name, "xkb", layout, variant))

    def add_ibus_row(self, ibus_info):
        layout_id = ibus_info.get_name()

        if layout_id.startswith("xkb:"):
            return
        if layout_id in self.used_ids:
            return

        self.used_ids.add(layout_id)

        display_name = make_ibus_display_name(ibus_info)
        self.layouts_store.append((layout_id, display_name, "ibus", ibus_info.get_layout(), ibus_info.get_layout_variant()))
