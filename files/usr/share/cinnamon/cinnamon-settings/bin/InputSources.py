#!/usr/bin/python3

import gettext
import os
import subprocess
from collections import OrderedDict

import cairo
import gi
gi.require_version("Gtk", "3.0")
gi.require_version("Gdk", "3.0")
gi.require_version("CinnamonDesktop", "3.0")
from gi.repository import Gdk, GLib, Gio, Gtk, GObject, CinnamonDesktop

from SettingsWidgets import SidePage, Keybinding
from xapp.SettingsWidgets import SettingsPage
from xapp.GSettingsWidgets import PXGSettingsBackend, GSettingsSwitch

MAX_LAYOUTS_PER_GROUP = 4

class InputSourceSettingsPage(SettingsPage):
    def __init__(self):
        super().__init__()

        builder = Gtk.Builder()
        builder.set_translation_domain('cinnamon')
        builder.add_from_file("/usr/share/cinnamon/cinnamon-settings/bin/input-sources-list.ui")

        box = builder.get_object("input_sources_list_box")
        self.pack_start(box, False, False, 0)

        self.input_sources_list = builder.get_object("input_sources_list")
        self.source_activate_handler = self.input_sources_list.connect("row-activated", self.on_input_source_activated)
        self.current_input_sources_model = CurrentInputSourcesModel()
        self.current_input_sources_model.connect("items-changed", self.on_model_updated)
        self.input_sources_list.bind_model(self.current_input_sources_model, self.current_input_sources_model.create_row)
        self.input_sources_list.set_header_func(self.row_separator_func)

        self.test_layout_button = builder.get_object("test_layout")
        self.test_layout_button.connect("clicked", self.on_test_layout_clicked)
        # TODO: maybe use tecla as an alternative for wayland, if we don't roll something ourselves.
        # btw there's no plan for tecla to support different keyboard geometries than a standard pc105.
        if not GLib.find_program_in_path("gkbd-keyboard-display"):
            self.test_layout_button.set_sensitive(False)

        self.add_layout_button = builder.get_object("add_layout")
        self.add_layout_button.connect("clicked", self.on_add_layout_clicked)
        self.remove_layout_button = builder.get_object("remove_layout")
        self.remove_layout_button.connect("clicked", self.on_remove_layout_clicked)
        self.move_layout_up_button = builder.get_object("move_layout_up")
        self.move_layout_up_button.connect("clicked", self.on_move_layout_up_clicked)
        self.move_layout_down_button = builder.get_object("move_layout_down")
        self.move_layout_down_button.connect("clicked", self.on_move_layout_down_clicked)

        self.update_widgets()

        section = self.add_section(_("Options"))
        widget = GSettingsSwitch(
            _("Remember the last layout used for each window"),
            "org.cinnamon.desktop.input-sources", "per-window"
        )
        section.add_row(widget)

        widget = GSettingsSwitch(
            _("Use a country flag, if available, to represent keyboard layouts"),
            "org.cinnamon.desktop.interface", "keyboard-layout-show-flags"
        )
        section.add_row(widget)
        widget = GSettingsSwitch(
            _("Use the layout name, not the group name, to represent a layout"),
            "org.cinnamon.desktop.interface", "keyboard-layout-prefer-variant-names"
        )
        section.add_row(widget)
        widget = GSettingsSwitch(
            _("Use upper-case when using text to represent a layout"),
            "org.cinnamon.desktop.interface", "keyboard-layout-use-upper"
        )
        section.add_row(widget)

        section = self.add_section(_("Shortcuts"))
        widget = GSettingsKeybinding(
            _("Switch to next layout"),
            2,
            "org.cinnamon.desktop.keybindings.wm",
            "switch-input-source"
        )
        section.add_row(widget)
        widget = GSettingsKeybinding(
            _("Switch to previous layout"),
            2,
            "org.cinnamon.desktop.keybindings.wm",
            "switch-input-source-backward"
        )
        section.add_row(widget)

    def row_separator_func(self, row, before, data=None):
        if before is None:
            row.set_header(None)
            return

        row.set_header(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))

    def on_model_updated(self, model, position, removed, added, data=None):
        GLib.idle_add(self._update_selected_row)
        self.update_widgets()

    def _update_selected_row(self, data=None):
        self.input_sources_list.handler_block(self.source_activate_handler)

        for row in self.input_sources_list.get_children():
            source = row.get_child().input_source
            if source.active:
                self.input_sources_list.select_row(row)

        self.input_sources_list.handler_unblock(self.source_activate_handler)
        self.update_widgets()

        return GLib.SOURCE_REMOVE

    def on_input_source_activated(self, listbox, row):
        source = row.get_child().input_source
        self.current_input_sources_model.activate(source)

        self.update_widgets()

    def _get_selected_source(self):
        rows = self.input_sources_list.get_selected_rows()
        if len(rows) > 0:
            source = rows[0].get_child().input_source
        return source

    def on_add_layout_clicked(self, button, data=None):
        self.current_input_sources_model.show_add_layout_dialog()

    def on_remove_layout_clicked(self, button, data=None):
        source = self._get_selected_source()
        if source is not None:
            self.current_input_sources_model.remove_layout(source)

    def on_move_layout_up_clicked(self, button, data=None):
        source = self._get_selected_source()
        if source is not None:
            self.current_input_sources_model.move_layout_up(source)

    def on_move_layout_down_clicked(self, button, data=None):
        source = self._get_selected_source()
        if source is not None:
            self.current_input_sources_model.move_layout_down(source)

    def on_test_layout_clicked(self, button, data=None):
        source = self._get_selected_source()

        if GLib.find_program_in_path("gkbd-keyboard-display"):
            subprocess.Popen(["gkbd-keyboard-display", "-g", str(source.index + 1)])

    def update_widgets(self):
        # Don't allow removal of last remaining layout
        n_items = self.current_input_sources_model.get_n_items()
        self.remove_layout_button.set_sensitive(n_items > 1)
        self.add_layout_button.set_sensitive(n_items < MAX_LAYOUTS_PER_GROUP)

        rows = self.input_sources_list.get_selected_rows()
        if len(rows) > 0:
            source = rows[0].get_child().input_source
            index = self.current_input_sources_model.get_item_index(source)
            self.move_layout_up_button.set_sensitive(index > 0)
            self.move_layout_down_button.set_sensitive(index < self.current_input_sources_model.get_n_items() - 1)

class LayoutIcon(Gtk.Overlay):
    def __init__(self, file, dupe_id):
        Gtk.Overlay.__init__(self)
        self.file = file
        self.dupe_id = dupe_id

        fi = Gio.FileIcon(file=file)
        flag = Gtk.Image.new_from_gicon(fi, Gtk.IconSize.DIALOG)
        self.add(flag)
        print(self.dupe_id)
        self.drawing = Gtk.DrawingArea(halign=Gtk.Align.FILL, valign=Gtk.Align.FILL)
        self.drawing.connect('draw', self.draw_subscript)
        self.add_overlay(self.drawing)

    def draw_subscript(self, area, cr, data=None):
        if self.dupe_id < 1:
            return

        alloc = area.get_allocation()
        ax, ay, awidth, aheight = (alloc.x, alloc.y, alloc.width, alloc.height)

        x = width = awidth / 2
        y = height = aheight / 2

        cr.set_source_rgba(0, 0, 0, 0.5)
        cr.rectangle(x, y, width, height)
        cr.fill()

        cr.set_source_rgba(1.0, 1.0, 1.0, 0.8)
        cr.rectangle(x + 1, y + 1, width - 2, height - 2)
        cr.fill()

        cr.set_source_rgba(0.0, 0.0, 0.0, 1.0)
        cr.select_font_face("sans", cairo.FontSlant.NORMAL, cairo.FontWeight.BOLD)
        cr.set_font_size(height - 2.0)

        dupe_str = str(self.dupe_id)

        ext = cr.text_extents(dupe_str)
        cr.move_to((x + (width / 2.0) - (ext.width / 2.0)),
                   (y + (height / 2.0) + (ext.height / 2.0)))
        cr.show_text(dupe_str)


class AddLayoutDialog():
    def __init__(self, used_ids):
        self.input_source_settings = Gio.Settings(schema_id="org.cinnamon.desktop.input-sources")
        self.used_ids = used_ids

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
        self.layouts_listbox = builder.get_object("layouts_listbox")
        self.layouts_listbox.connect("row-activated", self._on_row_activated)
        self.layouts_listbox.connect("selected-rows-changed", self._on_row_selected)

        self.layouts_listbox.set_header_func(self.row_separator_func)
        self.layouts_listbox.set_sort_func(self.row_sort_func)
        self.layouts_listbox.set_filter_func(self.row_filter_func)

        self._locales_by_language = {}
        self._locales = {}
        self._row_items = []

        self.response_id = None

        self.xkb_info = CinnamonDesktop.XkbInfo()

        self._load_layouts()
        self._update_widgets()

    def _on_row_activated(self, listbox, row, data=None):
        self._on_add_button_clicked(None)

    def _on_row_selected(self, listbox, data=None):
        self._update_widgets()

    def _on_search_entry_changed(self, entry, data=None):
        self.layouts_listbox.invalidate_filter()

    def _on_preview_button_clicked(self, button, data=None):
        selection = self.layouts_listbox.get_selected_rows()
        if len(selection) > 0:
            row = selection[0]
            if GLib.find_program_in_path("gkbd-keyboard-display"):
                subprocess.Popen(["gkbd-keyboard-display", "-l", row.layout_id])

    def _on_cancel_button_clicked(self, button, data=None):
        self.dialog.response(Gtk.ResponseType.CANCEL)

    def _on_add_button_clicked(self, button, data=None):
        selection = self.layouts_listbox.get_selected_rows()
        if len(selection) > 0:
            row = selection[0]
            self.response = row.layout_id
            print("Response:", self.response)
            self.dialog.response(Gtk.ResponseType.OK)

    def row_separator_func(self, row, before, data=None):
        if before is None:
            row.set_header(None)
            return

        row.set_header(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))

    def row_sort_func(self, row1, row2):
        return GLib.utf8_collate(row1.unaccented_name, row2.unaccented_name)

    def row_filter_func(self, row, data=None):
        search_entry_text = self.search_entry.get_text()
        normalized = GLib.utf8_normalize(search_entry_text, -1, GLib.NormalizeMode.DEFAULT)
        search_text = GLib.utf8_casefold(normalized, -1)

        return search_text in row.unaccented_name

    def _update_widgets(self):
        selection = self.layouts_listbox.get_selected_rows()
        self.preview_button.set_sensitive(len(selection) > 0)
        self.add_button.set_sensitive(len(selection) > 0)

    def _load_layouts(self):
        layouts_with_locale = set()

        locales = CinnamonDesktop.get_all_locales()

        for locale in locales:
            parsed, lang, country, codeset, mod = CinnamonDesktop.parse_locale(locale)
            if not parsed:
                continue

            if country is not None:
                simple_locale = f"{lang}_{country}.UTF-8"
            else:
                simple_locale = f"{lang}.UTF-8"

            if simple_locale in self._locales:
                continue

            info = LocaleInfo(simple_locale)
            self._locales[simple_locale] = info

            language = CinnamonDesktop.get_language_from_code(lang, None)
            try:
                self._locales_by_language[language][info] = info
            except KeyError:
                self._locales_by_language[language] = { info: info }

            got, type_, id_ = CinnamonDesktop.get_input_source_from_locale(simple_locale)
            if got and type_ == "xkb":
                if id_ not in layouts_with_locale:
                    layouts_with_locale.add(id_)

            language_layouts = self.xkb_info.get_layouts_for_language(lang)
            for layout in language_layouts:
                if layout in layouts_with_locale:
                    continue
                layouts_with_locale.add(layout)
                self.add_row(info, layout)

        # FIXME: This is probably all we need for xkb...
        for layout in self.xkb_info.get_all_layouts():
            if layout in layouts_with_locale:
                continue
            self.add_row(None, layout)

    def add_row(self, lang_info, layout_id):
        if layout_id in self.used_ids:
            return

        got, display_name, short_name, layout, variant = self.xkb_info.get_layout_info(layout_id)
        if got:
            row = LayoutRow(lang_info, layout_id, display_name, short_name, layout, variant)
            self.layouts_listbox.insert(row, -1)

class LayoutRow(Gtk.ListBoxRow):
    def __init__(self, info, layout_id, display_name, short_name, layout, variant):
        super().__init__()
        self.display_name = display_name
        self.layout_id = layout_id #  us+dvorak ... 

        normalized = GLib.utf8_normalize(self.display_name, -1, GLib.NormalizeMode.DEFAULT)
        self.unaccented_name = GLib.utf8_casefold(normalized, -1)
        self.short_name = short_name
        self.layout = layout
        self.variant = variant
        self.box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        self.label = Gtk.Label(label=self.display_name, xalign=0.0, use_markup=True, margin_start=4)

        self.box.pack_start(self.label, True, True, 0)
        self.add(self.box)
        self.show_all()

class GSettingsKeybinding(Keybinding, PXGSettingsBackend):
    def __init__(self, label, num_bind, schema, key, *args, **kwargs):
        self.key = key
        self.settings = Gio.Settings.new(schema_id=schema)

        Keybinding.__init__(self, label, num_bind, *args, **kwargs)
        PXGSettingsBackend.__init__(self, *args, **kwargs)
        self.bind_settings()

class CurrentInputSource(GObject.GObject):
    __gtype_name__ = "CurrentInputSource"
    def __init__(self, item):
        super().__init__()
        print(item)
        self.type, self.id, self.index, self.display_name, self.short_name, self.flag_name, self.xkbid, self.dupe_id, self.active = item

class CurrentInputSourcesModel(GObject.Object, Gio.ListModel):
    __gtype_name__ = 'CurrentInputSourcesModel'

    def __init__(self):
        super().__init__()
        self._proxy = None
        self._sources = []
        self.interface_settings = Gio.Settings(schema_id="org.cinnamon.desktop.interface")
        self.interface_settings.connect("changed", self.on_interface_settings_changed)
        self.input_source_settings = Gio.Settings(schema_id="org.cinnamon.desktop.input-sources")

        try:
            Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, None,
                                      "org.Cinnamon", "/org/Cinnamon", "org.Cinnamon", None, self._on_proxy_ready, None)
        except GLib.Error as e:
            print(e.message)
            self._proxy = None

    def _on_proxy_ready(self, obj, result, data=None):
        try:
            self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
            self._proxy.connect("g-signal", self._on_proxy_signal)
            self.refresh_input_source_list()
        except GLib.Error as e:
            print(f"Keyboard module could not establish proxy for org.Cinnamon: {e}")

    def _on_proxy_signal(self, proxy, sender_name, signal_name, parameters):
        if signal_name == "InputSourcesChanged":
            self.refresh_input_source_list()

    def on_interface_settings_changed(self, settings, key, data=None):
        if key.startswith("keyboard-layout-"):
            self.refresh_input_source_list()

    def refresh_input_source_list(self):
        remote_layouts = self._proxy.GetInputSources()
        old_layouts = self._sources
        new_layouts = []

        for layout in remote_layouts:
            new_layouts.append(CurrentInputSource(layout))

        self._sources = new_layouts
        self.items_changed(0, len(old_layouts), len(new_layouts))

    def show_add_layout_dialog(self):
        used_ids = [source.xkbid for source in self._sources]
        add_dialog = AddLayoutDialog(used_ids)
        add_dialog.dialog.show_all()
        ret = add_dialog.dialog.run()
        if ret == Gtk.ResponseType.OK:
            self.add_layout(add_dialog.response)
        add_dialog.dialog.destroy()

    def create_row(self, source, data=None):
        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        markup = f"<b>{source.display_name}</b>"
        label = Gtk.Label(label=markup, xalign=0.0, use_markup=True, margin_start=4)
        row.pack_start(label, True, True, 0)

        indicator_done = False

        if self.interface_settings.get_boolean("keyboard-layout-show-flags"):
            flag_file = f"/usr/share/iso-flag-png/{source.flag_name}.png"
            print(flag_file)
            if os.path.exists(flag_file):
                file = Gio.File.new_for_path(flag_file)
                flag = LayoutIcon(file, source.dupe_id)
                # flag = Gtk.Image.new_from_gicon(flag, Gtk.IconSize.DND)
                row.pack_start(flag, False, False, 0)
                indicator_done = True

        if not indicator_done:
            label = Gtk.Label(label=source.short_name)
            row.pack_end(label, False, False, 0)

        row.show_all()
        row.input_source = source
        return row

    def do_get_item(self, position):
        return self._sources[position]

    def do_get_item_type(self):
        return CurrentInputSource

    def do_get_n_items(self):
        return len(self._sources)

    def get_item_index(self, item):
        if item not in self._sources:
            return -1
        return self._sources.index(item)

    def activate(self, source):
        if self._proxy is None:
            return
        idx = self._sources.index(source)
        self._proxy.ActivateInputSourceIndex("(i)", idx)

    def add_layout(self, layout_id):
        raw_sources = self.input_source_settings.get_value("sources")
        new_sources = []

        # raw_sources is a variant, not a list.
        for source_info in raw_sources:
            new_sources.append(source_info)

        new_sources.append(("xkb", layout_id))
        self.input_source_settings.set_value("sources", GLib.Variant("a(ss)", new_sources))

    def remove_layout(self, source):
        raw_sources = self.input_source_settings.get_value("sources")
        new_sources = []

        # shouldn't happen but here we're not relying on cinnamon, but dconf.
        if len(raw_sources) == 1:
            print("Cannot remove the only remaining layout!!")
            return

        for source_info in raw_sources:
            type_, id_ = source_info
            if source.id == id_ and source.type == type_:
                continue
            new_sources.append(source_info)

        self.input_source_settings.set_value("sources", GLib.Variant("a(ss)", new_sources))

    def move_layout_up(self, source):
        raw_sources = self.input_source_settings.get_value("sources")
        new_sources = []

        # raw_sources is a variant, not a list.
        for source_info in raw_sources:
            new_sources.append(source_info)

        t = (source.type, source.id)
        try:
            idx = new_sources.index(t)
            if idx == 0:
                return
            element = new_sources.pop(idx)
            new_sources.insert(idx - 1, element)
            self.input_source_settings.set_value("sources", GLib.Variant("a(ss)", new_sources))
        except Exception as e:
            print("Could not move layout", e)

    def move_layout_down(self, source):
        raw_sources = self.input_source_settings.get_value("sources")
        new_sources = []

        # raw_sources is a variant, not a list.
        for source_info in raw_sources:
            new_sources.append(source_info)

        t = (source.type, source.id)
        try:
            idx = new_sources.index(t)
            if idx == len(new_sources) - 1:
                return
            element = new_sources.pop(idx)
            new_sources.insert(idx + 1, element)
            self.input_source_settings.set_value("sources", GLib.Variant("a(ss)", new_sources))
        except Exception as e:
            print("Could not move layout", e)

class LocaleInfo:
    def __init__(self, simple_locale):
        self.id = simple_locale
        self.name = CinnamonDesktop.get_language_from_locale(simple_locale, None)
        normalized = GLib.utf8_normalize(self.name, -1, GLib.NormalizeMode.DEFAULT)
        self.unaccented_name = GLib.utf8_casefold(normalized, -1)
        tmp = CinnamonDesktop.get_language_from_locale(simple_locale, "C")
        normalized = GLib.utf8_normalize(tmp, -1, GLib.NormalizeMode.DEFAULT)
        self.untranslated_name = GLib.utf8_casefold(normalized, -1)

        self.layout_rows_by_id = {}
        self.engine_rows_by_id = {}
