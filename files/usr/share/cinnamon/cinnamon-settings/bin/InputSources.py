#!/usr/bin/python3

import os
import subprocess

import cairo
import gi
gi.require_version("Gtk", "3.0")
gi.require_version("CinnamonDesktop", "3.0")
gi.require_version('IBus', '1.0')
from gi.repository import GLib, Gio, Gtk, GObject, CinnamonDesktop, IBus

from SettingsWidgets import GSettingsKeybinding
from xapp.SettingsWidgets import SettingsPage
from xapp.GSettingsWidgets import PXGSettingsBackend, GSettingsSwitch

import AddKeyboardLayout

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
            self.test_layout_button.set_visible(False)

        self.engine_config_button = builder.get_object("engine_config_button")
        self.engine_config_button.connect("clicked", self.on_engine_config_clicked)
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
            "org.cinnamon.desktop.keybindings.wm",
            "switch-input-source",
        )
        section.add_row(widget)
        widget = GSettingsKeybinding(
            _("Switch to previous layout"),
            "org.cinnamon.desktop.keybindings.wm",
            "switch-input-source-backward"
        )
        section.add_row(widget)
        widget = GSettingsKeybinding(
            _("Switch to first layout"),
            "org.cinnamon.desktop.keybindings.wm",
            "switch-input-source-0"
        )
        section.add_row(widget)
        widget = GSettingsKeybinding(
            _("Switch to second layout"),
            "org.cinnamon.desktop.keybindings.wm",
            "switch-input-source-1"
        )
        section.add_row(widget)
        widget = GSettingsKeybinding(
            _("Switch to third layout"),
            "org.cinnamon.desktop.keybindings.wm",
            "switch-input-source-2"
        )
        section.add_row(widget)
        widget = GSettingsKeybinding(
            _("Switch to fourth layout"),
            "org.cinnamon.desktop.keybindings.wm",
            "switch-input-source-3"
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

        self.input_sources_list.unselect_all()

        self.input_sources_list.handler_unblock(self.source_activate_handler)
        self.update_widgets()

        return GLib.SOURCE_REMOVE

    def on_input_source_activated(self, listbox, row):
        self.update_widgets()

    def _get_selected_source(self):
        source = None
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

        args = AddKeyboardLayout.make_gkbd_keyboard_args(source.xkb_layout, source.xkb_variant)
        subprocess.Popen(args)

    def on_engine_config_clicked(self, button, data=None):
        source = self._get_selected_source()
        dialog = IBusConfigDialog(source, self.current_input_sources_model.input_source_settings)
        dialog.run()
        dialog.destroy()

    def update_widgets(self):
        # Don't allow removal of last remaining layout
        n_items = self.current_input_sources_model.get_n_items()
        self.add_layout_button.set_sensitive(n_items < MAX_LAYOUTS_PER_GROUP)

        source = self._get_selected_source()
        if source is not None:
            self.test_layout_button.set_sensitive(source.type == "xkb")
            # Enable Configure button for all IBus sources (not just those with preferences)
            self.engine_config_button.set_sensitive(source.type == "ibus")
            index = self.current_input_sources_model.get_item_index(source)
            self.move_layout_up_button.set_sensitive(index > 0)
            self.move_layout_down_button.set_sensitive(index < self.current_input_sources_model.get_n_items() - 1)
            self.remove_layout_button.set_sensitive(n_items > 1)
        else:
            self.test_layout_button.set_sensitive(False)
            self.engine_config_button.set_sensitive(False)
            self.move_layout_up_button.set_sensitive(False)
            self.move_layout_down_button.set_sensitive(False)
            self.remove_layout_button.set_sensitive(False)


class IBusConfigDialog():
    def __init__(self, source, settings):
        self.source = source
        self.settings = settings
        self.xkb_info = CinnamonDesktop.XkbInfo.new_with_extras()

        # Check if this engine uses "default" layout or has a specific one
        self.engine_layout = self._get_engine_layout()
        self.allows_override = (self.engine_layout == "default")

        builder = Gtk.Builder()
        builder.set_translation_domain('cinnamon')
        builder.add_from_file("/usr/share/cinnamon/cinnamon-settings/bin/input-sources-list.ui")

        self.dialog = builder.get_object("ibus_config_dialog")

        # Set up name label
        name_label = builder.get_object("ibus_config_name_label")
        name_label.set_text(source.display_name)

        # Set up explanation label based on whether override is allowed
        explanation_label = builder.get_object("ibus_config_explanation_label")
        if not self.allows_override:
            layout_display = self._get_engine_layout_display_name()
            explanation_label.set_text(
                _("This input method requires the \"%s\" keyboard layout to function correctly. "
                  "The layout is set automatically when you switch to this input method.") % layout_display
            )

        # Set up layout label
        self.layout_label = builder.get_object("ibus_config_layout_label")

        # Set up buttons
        close_button = builder.get_object("ibus_config_close_button")
        close_button.connect("clicked", self.on_close_clicked)

        self.change_layout_button = builder.get_object("ibus_config_change_layout_button")
        self.change_layout_button.connect("clicked", self.on_change_layout_clicked)
        self.change_layout_button.set_sensitive(self.allows_override)

        self.clear_override_button = builder.get_object("ibus_config_clear_override_button")
        self.clear_override_button.connect("clicked", self.on_clear_override_clicked)

        engine_settings_button = builder.get_object("ibus_config_engine_settings_button")
        if source.preferences:
            engine_settings_button.connect("clicked", self.on_engine_settings_clicked)
        else:
            engine_settings_button.set_visible(False)

        self.update_layout_display()
        self.dialog.show_all()

    def _get_engine_layout(self):
        ibus = IBus.Bus.new()
        if ibus.is_connected():
            engines = ibus.get_engines_by_names([self.source.id])
            if engines:
                return engines[0].get_layout() or "default"
        return "default"

    def _get_engine_layout_display_name(self):
        if not self.engine_layout or self.engine_layout == "default":
            return _("Default")
        got, display_name, short_name, layout, variant = self.xkb_info.get_layout_info(self.engine_layout)
        if got:
            return f"{display_name} ({self.engine_layout})"
        return self.engine_layout

    def run(self):
        return self.dialog.run()

    def destroy(self):
        self.dialog.destroy()

    def on_close_clicked(self, button, data=None):
        self.dialog.response(Gtk.ResponseType.CLOSE)

    def get_current_override(self):
        source_layouts = self.settings.get_value("source-layouts").unpack()
        return source_layouts.get(self.source.id, None)

    def get_layout_display_name(self, layout_id):
        if layout_id is None:
            return None
        got, display_name, short_name, layout, variant = self.xkb_info.get_layout_info(layout_id)
        if got:
            return f"{display_name} ({layout_id})"
        return layout_id

    def update_layout_display(self):
        if not self.allows_override:
            # Engine has a fixed layout requirement
            self.layout_label.set_text(self._get_engine_layout_display_name())
            self.clear_override_button.set_sensitive(False)
            return

        override = self.get_current_override()
        if override:
            display_name = self.get_layout_display_name(override)
            self.layout_label.set_text(display_name)
            self.clear_override_button.set_sensitive(True)
        else:
            self.layout_label.set_text(_("Default"))
            self.clear_override_button.set_sensitive(False)

    def on_change_layout_clicked(self, button, data=None):
        # Show the layout picker in XKB-only mode
        add_dialog = AddKeyboardLayout.AddKeyboardLayoutDialog([], xkb_only=True)
        add_dialog.dialog.set_transient_for(self.dialog)
        add_dialog.dialog.show_all()
        ret = add_dialog.dialog.run()
        if ret == Gtk.ResponseType.OK:
            layout_type, layout_id = add_dialog.response
            self.set_layout_override(layout_id)
        add_dialog.dialog.destroy()

    def on_clear_override_clicked(self, button, data=None):
        self.clear_layout_override()

    def on_engine_settings_clicked(self, button, data=None):
        subprocess.Popen([self.source.preferences], shell=True)

    def set_layout_override(self, layout_id):
        source_layouts = self.settings.get_value("source-layouts").unpack()
        source_layouts[self.source.id] = layout_id
        self.settings.set_value("source-layouts", GLib.Variant("a{ss}", source_layouts))
        self.update_layout_display()

    def clear_layout_override(self):
        source_layouts = self.settings.get_value("source-layouts").unpack()
        if self.source.id in source_layouts:
            del source_layouts[self.source.id]
            self.settings.set_value("source-layouts", GLib.Variant("a{ss}", source_layouts))
        self.update_layout_display()

class LayoutIcon(Gtk.Overlay):
    def __init__(self, file, dupe_id):
        Gtk.Overlay.__init__(self)
        self.file = file
        self.dupe_id = dupe_id

        fi = Gio.FileIcon(file=file)
        flag = Gtk.Image.new_from_gicon(fi, Gtk.IconSize.DND)
        self.add(flag)
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

class CurrentInputSource(GObject.GObject):
    __gtype_name__ = "CurrentInputSource"
    def __init__(self, item):
        super().__init__()
        self.type, self.id, self.index,         \
            self.display_name, self.short_name, \
            self.flag_name, self.xkbid,         \
            self.xkb_layout, self.xkb_variant,  \
            self.preferences,                   \
            self.dupe_id, self.active           \
                 = item
        if self.preferences is None:
            self.preferences = ''

class CurrentInputSourcesModel(GObject.Object, Gio.ListModel):
    __gtype_name__ = 'CurrentInputSourcesModel'

    def __init__(self):
        super().__init__()
        self._proxy = None
        self._sources = []
        self.interface_settings = Gio.Settings(schema_id="org.cinnamon.desktop.interface")
        self.interface_settings.connect("changed", self.on_interface_settings_changed)
        self.input_source_settings = Gio.Settings(schema_id="org.cinnamon.desktop.input-sources")
        self.input_source_settings.connect("changed::source-layouts", self.on_source_layouts_changed)

        try:
            Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, None,
                                      "org.Cinnamon", "/org/Cinnamon", "org.Cinnamon", None, self._on_proxy_ready, None)
        except GLib.Error as e:
            print(e.message)
            self._proxy = None

        self.xkb_info = CinnamonDesktop.XkbInfo.new_with_extras()

        self._ibus = IBus.Bus.new()
        if not self._ibus.is_connected():
            print("Connecting to IBus")
            self._ibus.connect("connected", self._on_ibus_connected)
        else:
            print("IBus already connected")
            self._on_ibus_connected(self._ibus)

    @property
    def live(self):
        if self._proxy is None:
            return False
        if self._proxy.get_name_owner() is None:
            return False
        return True

    def _get_layout_override(self, engine_id):
        source_layouts = self.input_source_settings.get_value("source-layouts").unpack()
        return source_layouts.get(engine_id, None)

    def _get_layout_display_name(self, layout_id):
        got, display_name, short_name, layout, variant = self.xkb_info.get_layout_info(layout_id)
        if got:
            return display_name
        return layout_id

    def _on_ibus_connected(self, ibus, data=None):
        if self._proxy is None:
            self.refresh_input_source_list()

    def _on_proxy_ready(self, obj, result, data=None):
        try:
            self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
            self._proxy.connect("g-signal", self._on_proxy_signal)
            self._proxy.connect("notify::g-name-owner", self._on_cinnamon_state_changed)
            self.refresh_input_source_list()
        except GLib.Error as e:
            print(f"Keyboard module could not establish proxy for org.Cinnamon: {e}")

    def _on_proxy_signal(self, proxy, sender_name, signal_name, parameters):
        if signal_name == "InputSourcesChanged":
            self.refresh_input_source_list()

    def _on_cinnamon_state_changed(self, proxy, pspec, data=None):
        # If Cinnamon crashes, this will happen, reload our sources using xkb and ibus.
        # This isn't reliable to detect Cinnamon restarting, as it will regain a name-owner
        # before org.Cinnamon is exported, causing GetInputSources to fail.
        #
        # Fortunately, InputSourcesChanged will fire at startup, which is perfect to re-sync
        # with Cinnamon.
        if proxy.get_name_owner() is None:
            self.refresh_input_source_list()

    def on_interface_settings_changed(self, settings, key, data=None):
        if key.startswith("keyboard-layout-"):
            self.refresh_input_source_list()

    def on_source_layouts_changed(self, settings, key, data=None):
        self.refresh_input_source_list()

    def refresh_input_source_list(self):
        if self.live:
            layouts = self._proxy.GetInputSources()
        else:
            sources = self.input_source_settings.get_value("sources")
            layouts = []
            index = 0

            for type_, id_ in sources:
                if type_ == "xkb":
                    got, display_name, short_name, layout, variant = self.xkb_info.get_layout_info(id_)
                    if got:
                        layouts.append(
                            (type_, id_, index, display_name,
                             None, None, id_,
                             layout, variant, None,
                             0, False)
                        )
                else:
                    engines = self._ibus.get_engines_by_names([id_])
                    if len(engines) > 0:
                        engine = engines[0]
                        display_name = AddKeyboardLayout.make_ibus_display_name(engine)
                        layouts.append(
                            (type_, id_, index, display_name,
                             None, None, id_,
                             engine.get_layout(), engine.get_layout_variant(), engine.get_setup(),
                             0, False)
                        )

                index += 1

        old_layouts = self._sources
        new_layouts = []

        for layout in layouts:
            new_layouts.append(CurrentInputSource(layout))

        self._sources = new_layouts
        self.column_size_group = Gtk.SizeGroup(Gtk.SizeGroupMode.BOTH)
        self.items_changed(0, len(old_layouts), len(new_layouts))

    def show_add_layout_dialog(self):
        used_ids = [source.id for source in self._sources]
        add_dialog = AddKeyboardLayout.AddKeyboardLayoutDialog(used_ids)
        add_dialog.dialog.show_all()
        ret = add_dialog.dialog.run()
        if ret == Gtk.ResponseType.OK:
            self.add_layout(*add_dialog.response)
        add_dialog.dialog.destroy()

    def create_row(self, source, data=None):
        row = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=6)

        # Build display name, including layout override for IBus sources
        display_name = GLib.markup_escape_text(source.display_name)
        if source.type == "ibus":
            layout_override = self._get_layout_override(source.id)
            if layout_override:
                layout_display = GLib.markup_escape_text(self._get_layout_display_name(layout_override))
                markup = f"<b>{display_name}</b>  <small>|  {layout_display}</small>"
            else:
                markup = f"<b>{display_name}</b>"
        else:
            markup = f"<b>{display_name}</b>"
        label = Gtk.Label(label=markup, xalign=0.0, use_markup=True, margin_start=4)
        row.pack_start(label, True, True, 0)

        if self.live:
            indicator_done = False

            if self.interface_settings.get_boolean("keyboard-layout-show-flags"):
                flag_file = f"/usr/share/iso-flag-png/{source.flag_name}.png"
                if os.path.exists(flag_file):
                    file = Gio.File.new_for_path(flag_file)
                    flag = LayoutIcon(file, source.dupe_id)

                    self.column_size_group.add_widget(flag)
                    row.pack_start(flag, False, False, 0)
                    indicator_done = True

            if not indicator_done:
                markup = f"<span size='x-large' weight='bold'>{source.short_name}</span>"
                label = Gtk.Label(xalign=0.0, label=markup, use_markup=True)
                self.column_size_group.add_widget(label)
                row.pack_end(label, False, False, 0)
        else:
            dummy_markup = "<span size='x-large' weight='bold'> </span>"
            label = Gtk.Label(xalign=0.0, label=dummy_markup, use_markup=True)
            self.column_size_group.add_widget(label)
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

    def add_layout(self, type_, layout_id):
        raw_sources = self.input_source_settings.get_value("sources")
        new_sources = []

        # raw_sources is a variant, not a list.
        for source_info in raw_sources:
            new_sources.append(source_info)

        new_sources.append((type_, layout_id))
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
