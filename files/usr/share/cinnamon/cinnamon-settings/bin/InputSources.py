#!/usr/bin/python3

import gettext
import os
import subprocess

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gdk, GLib, Gio, Gtk, GObject

from SettingsWidgets import SidePage, Keybinding
from xapp.SettingsWidgets import SettingsPage
from xapp.GSettingsWidgets import PXGSettingsBackend, GSettingsSwitch

MAX_LAYOUTS_PER_GROUP = 4

class InputSourceSettingsPage(SettingsPage):
    def __init__(self):
        super().__init__()

        self.input_sources_list = Gtk.ListBox(visible=True)
        self.source_activate_handler = self.input_sources_list.connect("row-activated", self.on_input_source_activated)
        self.input_sources_model = InputSourceModel()
        self.input_sources_model.connect("items-changed", self.on_model_updated)
        self.input_sources_list.bind_model(self.input_sources_model, self.input_sources_model.create_row)
        self.input_sources_list.set_header_func(self.input_source_row_header_func)

        builder = Gtk.Builder()
        builder.set_translation_domain('cinnamon')
        builder.add_from_file("/usr/share/cinnamon/cinnamon-settings/bin/input-sources-list.ui")

        box = builder.get_object("input_sources_list_box")
        builder.get_object("input-sources-placeholder").add(self.input_sources_list)

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

        self.pack_start(box, False, False, 0)

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
            "org.cinnamon.desktop.interface", "keyboard-layout-prefer-variant-names"
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

    def input_source_row_header_func(self, row, before, data=None):
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
            print(source.active)
            if source.active:
                self.input_sources_list.select_row(row)

        self.input_sources_list.handler_unblock(self.source_activate_handler)
        self.update_widgets()

        return GLib.SOURCE_REMOVE

    def on_input_source_activated(self, listbox, row):
        source = row.get_child().input_source
        self.input_sources_model.activate(source)

        self.update_widgets()

    def _get_selected_source(self):
        rows = self.input_sources_list.get_selected_rows()
        if len(rows) > 0:
            source = rows[0].get_child().input_source
        return source

    def on_add_layout_clicked(self, button, data=None):
        pass

    def on_remove_layout_clicked(self, button, data=None):
        source = self._get_selected_source()
        if source is not None:
            self.input_sources_model.remove_layout(source)

    def on_move_layout_up_clicked(self, button, data=None):
        source = self._get_selected_source()
        if source is not None:
            self.input_sources_model.move_layout_up(source)

    def on_move_layout_down_clicked(self, button, data=None):
        source = self._get_selected_source()
        if source is not None:
            self.input_sources_model.move_layout_down(source)

    def on_test_layout_clicked(self, button, data=None):
        source = self._get_selected_source()

        if GLib.find_program_in_path("gkbd-keyboard-display"):
            subprocess.Popen(["gkbd-keyboard-display", "-l", source.xkbid])

    def update_widgets(self):
        # Don't allow removal of last remaining layout
        n_items = self.input_sources_model.get_n_items()
        self.remove_layout_button.set_sensitive(n_items > 1)
        self.add_layout_button.set_sensitive(n_items < MAX_LAYOUTS_PER_GROUP)

        rows = self.input_sources_list.get_selected_rows()
        if len(rows) > 0:
            source = rows[0].get_child().input_source
            index = self.input_sources_model.get_item_index(source)
            self.move_layout_up_button.set_sensitive(index > 0)
            self.move_layout_down_button.set_sensitive(index < self.input_sources_model.get_n_items() - 1)

class GSettingsKeybinding(Keybinding, PXGSettingsBackend):
    def __init__(self, label, num_bind, schema, key, *args, **kwargs):
        self.key = key
        self.settings = Gio.Settings.new(schema_id=schema)

        Keybinding.__init__(self, label, num_bind, *args, **kwargs)
        PXGSettingsBackend.__init__(self, *args, **kwargs)
        self.bind_settings()

class InputSource(GObject.GObject):
    __gtype_name__ = "InputSource"
    def __init__(self, item):
        super().__init__()
        print(item)
        self.type, self.id, self.display_name, self.short_name, self.xkbid, self.active = item

class InputSourceModel(GObject.Object, Gio.ListModel):
    __gtype_name__ = 'InputSourceModel'

    def __init__(self):
        super().__init__()
        self._proxy = None
        self._sources = []
        self.interface_settings = Gio.Settings(schema_id="org.cinnamon.desktop.interface")
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

    def refresh_input_source_list(self):
        remote_layouts = self._proxy.GetInputSources()
        old_layouts = self._sources
        new_layouts = []

        for layout in remote_layouts:
            new_layouts.append(InputSource(layout))

        self._sources = new_layouts
        print("ITEMS")
        self.items_changed(0, len(old_layouts), len(new_layouts))

    def create_row(self, source, data=None):
        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)
        markup = f"<b>{source.display_name}</b>"
        label = Gtk.Label(label=markup, xalign=0.0, use_markup=True, margin_start=4)
        row.pack_start(label, True, True, 0)

        indicator_done = False

        if self.interface_settings.get_boolean("keyboard-layout-show-flags"):
            flag_file = f"/usr/share/iso-flag-png/{source.id}.png"
            print(flag_file)
            if os.path.exists(flag_file):
                flag = Gio.FileIcon(file=Gio.File.new_for_path(flag_file))
                flag = Gtk.Image.new_from_gicon(flag, Gtk.IconSize.DIALOG)
                row.pack_start(flag, False, False, 0)
                indicator_done = True

        if not indicator_done:
            use_caps = self.interface_settings.get_boolean("keyboard-layout-prefer-variant-names")

            if self.interface_settings.get_boolean("keyboard-layout-prefer-variant-names"):
                label = Gtk.Label(label=source.short_name.upper() if use_caps else source.short_name)
            else:
                label = Gtk.Label(label=source.id.upper() if use_caps else source.id)

            row.pack_end(label, False, False, 0)

        row.show_all()
        row.input_source = source
        return row

    def do_get_item(self, position):
        return self._sources[position]

    def do_get_item_type(self):
        return InputSource

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
        self._proxy.ActivateInputSourceIndex("(d)", idx)

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

