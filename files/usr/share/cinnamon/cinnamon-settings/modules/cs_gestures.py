#!/usr/bin/python3

import subprocess
from functools import cmp_to_key
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk

from SettingsWidgets import SidePage, SettingsWidget
from xapp.GSettingsWidgets import *

SCHEMA = "org.cinnamon.gestures"
NON_GESTURE_KEYS = [
    "enabled",
    "swipe-percent-threshold",
    "pinch-percent-threshold"
]

ACTIONS = [
    # Action, Label, Allow phase selection, extra widget type [entry|slider|none], default custom val
    ["", _("Disabled"), False, "none", ""],
    ["WORKSPACE_NEXT", _("Switch to right workspace"), True, "none", ""],
    ["WORKSPACE_PREVIOUS", _("Switch to left workspace"), True, "none", ""],
    # ["WORKSPACE_UP", _("Switch to the workspace above"), "none", ""],
    # ["WORKSPACE_DOWN", _("Switch to the workspace below"), "none", ""],
    ["TOGGLE_EXPO", _("Show the workspace selector (Expo)"), True, "none", ""],
    ["TOGGLE_OVERVIEW", _("Show the window selector (Scale)"), True, "none", ""],
    ["MINIMIZE", _("Minimize window"), True, "none", ""],
    ["MAXIMIZE", _("Maximize window"), True, "none", ""],
    ["CLOSE", _("Close window"), True, "none", ""],
    ["WINDOW_WORKSPACE_NEXT", _("Move window to right workspace"), True, "none", ""],
    ["WINDOW_WORKSPACE_PREVIOUS", _("Move window to left workspace"), True, "none", ""],
    ["FULLSCREEN", _("Make window fullscreen"), True, "none", ""],
    ["UNFULLSCREEN", _("Exit window fullscreen"), True, "none", ""],
    ["PUSH_TILE_UP", _("Push tile up"), True, "none", ""],
    ["PUSH_TILE_DOWN", _("Push tile down"), True, "none", ""],
    ["PUSH_TILE_LEFT", _("Push tile left"), True, "none", ""],
    ["PUSH_TILE_RIGHT", _("Push tile right"), True, "none", ""],
    ["TOGGLE_DESKTOP", _("Show desktop"), True, "none", ""],
    ["VOLUME_UP", _("Volume up"), False, "none", ""],
    ["VOLUME_DOWN", _("Volume down"), False, "none", ""],
    ["TOGGLE_MUTE", _("Volume mute"), True, "none", ""],
    ["MEDIA_PLAY_PAUSE", _("Toggle Play / Pause"), True, "none", ""],
    ["MEDIA_NEXT", _("Next track"), True, "none", ""],
    ["MEDIA_PREVIOUS", _("Previous track"), True, "none", ""],
    ["ZOOM_IN", _("Zoom desktop in"), False, "slider", "50"],
    ["ZOOM_OUT", _("Zoom desktop out"), False, "slider", "50"],
    ["EXEC", _("Run a command"), True, "entry", ""],
]

[ACTION_ID_COL, ACTION_LABEL_COL, ACTION_ALLOW_PHASE_SELECT_COL, ACTION_EXTRA_WIDGET_TYPE_COL, ACTION_DEFAULT_CUSTOM_VALUE_COL] = range(0, 5)

PHASES = [
    ["start", _("Trigger at gesture start")],
    ["end", _("Trigger at gesture end")]
]

[PHASE_ID_COL, PHASE_LABEL_COL] = range(0, 2)

def parse_setting(string):
    pieces = string.split("::")

    if len(pieces) == 2:
        return (pieces[0], "", pieces[1])
    elif len(pieces) == 3:
        return pieces
    else:
        return ["", "", ""]

def setting_to_string(action="", command=None, phase="end"):
    if action == "":
        return ""

    if command is not None:
        return "%s::%s::%s" % (action, command, phase)
    else:
        return "%s::%s" % (action, phase)

class Module:
    name = "gestures"
    category = "prefs"
    comment = _("Manage touch gestures")

    def __init__(self, content_box):
        keywords = _("gesture, swipe, pinch, touch")
        sidePage = SidePage(_("Gestures"), "cs-gestures", keywords, content_box, 560, module=self)
        self.sidePage = sidePage

        self.gesture_settings = None
        self.disabled_box = None

    def on_module_selected(self):
        installed = GLib.find_program_in_path("touchegg")
        alive = self.test_daemon_alive()

        if self.gesture_settings is None:
            self.gesture_settings = Gio.Settings(schema_id=SCHEMA)
            self.migrate_settings()
            self.gesture_settings.connect("changed::enabled", self.on_enabled_changed)

        enabled = self.gesture_settings.get_boolean("enabled")

        if not self.loaded:
            print("Loading Gestures module")

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            page = SettingsPage()
            self.sidePage.stack.add_named(page, "disabled")

            page.set_spacing(10)

            box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10, valign=Gtk.Align.START, margin_top=150)
            page.pack_start(box, True, True, 0)
            image = Gtk.Image(icon_name="touch-disabled-symbolic", icon_size=Gtk.IconSize.DIALOG)
            box.pack_start(image, False, False, 0)

            self.disabled_label = Gtk.Label(expand=True)
            box.pack_start(self.disabled_label, False, False, 0)

            self.disabled_page_switch = Gtk.Switch(active=self.gesture_settings.get_boolean("enabled"), no_show_all=True, halign=Gtk.Align.CENTER)
            self.disabled_page_switch.connect("notify::active", self.enabled_switch_changed)
            box.pack_start(self.disabled_page_switch, False, False, 0)

            self.disabled_retry_button = Gtk.Button(label=_("Check again"), no_show_all=True, halign=Gtk.Align.CENTER)
            self.disabled_retry_button.connect("clicked", lambda w: self.on_module_selected())
            box.pack_start(self.disabled_retry_button, False, False, 0)

            self.disabled_page_disable_button = Gtk.Button(label=_("Disable"), no_show_all=True, halign=Gtk.Align.CENTER)
            self.disabled_page_disable_button.connect("clicked", lambda w: self.gesture_settings.set_boolean("enabled", False))
            box.pack_start(self.disabled_page_disable_button, False, False, 0)

            ssource = Gio.SettingsSchemaSource.get_default()
            schema = ssource.lookup(SCHEMA, True)
            all_keys = schema.list_keys()

            order = ["left", "right", "up", "down", "in", "out"]

            def sort_by_direction(key1, key2):
                v1 = 0
                v2 = 0
                for i, k in enumerate(order):
                    if k in key1:
                        v1 = i
                    if k in key2:
                        v2 = i

                if v1 < v2:
                    return -1
                if v1 > v2:
                    return 1
                return 0

            keys = sorted([key for key in all_keys if key not in NON_GESTURE_KEYS], key=cmp_to_key(sort_by_direction))

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "swipe", _("Swipe"))
            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            section = page.add_section(_("Swipe with 2 fingers"), _("Touchscreen only"))

            for key in keys:
                label = self.get_key_label(key, "swipe", 2)
                if not label:
                    continue

                widget = GestureComboBox(label, self.gesture_settings, key, size_group=size_group)
                section.add_row(widget)

            section = page.add_section(_("Swipe with 3 fingers"))

            for key in keys:
                label = self.get_key_label(key, "swipe", 3)
                if not label:
                    continue

                widget = GestureComboBox(label, self.gesture_settings, key, size_group=size_group)
                section.add_row(widget)

            section = page.add_section(_("Swipe with 4 fingers"))

            for key in keys:
                label = self.get_key_label(key, "swipe", 4)
                if not label:
                    continue

                widget = GestureComboBox(label, self.gesture_settings, key, size_group=size_group)
                section.add_row(widget)

            section = page.add_section(_("Swipe with 5 fingers"), _("Touchscreen only"))

            for key in keys:
                label = self.get_key_label(key, "swipe", 5)
                if not label:
                    continue

                widget = GestureComboBox(label, self.gesture_settings, key, size_group=size_group)
                section.add_row(widget)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "pinch", _("Pinch"))
            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            for fingers in range(2, 5):
                section = page.add_section(_("Pinch with %d fingers") % fingers)

                for key in keys:
                    label = self.get_key_label(key, "pinch", fingers)

                    if not label:
                        continue

                    widget = GestureComboBox(label, self.gesture_settings, key, size_group=size_group)
                    section.add_row(widget)

            section = page.add_section(_("Pinch with 5 fingers"), _("Touchscreen only"))

            for key in keys:
                label = self.get_key_label(key, "pinch", 5)

                if not label:
                    continue

                widget = GestureComboBox(label, self.gesture_settings, key, size_group=size_group)
                section.add_row(widget)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "tap", _("Tap"))
            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            section = page.add_section(_("Tap"), _("Touchscreen only"))

            for fingers in range(2, 6):
                for key in keys:
                    label = self.get_key_label(key, "tap", fingers)

                    if not label:
                        continue

                    widget = GestureComboBox(label, self.gesture_settings, key, size_group=size_group)
                    section.add_row(widget)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "tweaks", _("Settings"))

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            section = page.add_section(_("General"))
            widget = GSettingsSwitch(_("Enable gestures"), "org.cinnamon.gestures", "enabled")
            section.add_row(widget)

            section = page.add_section(_("Activation thresholds"),
                                       _("In percentage of the touch surface"))

            widget = GSettingsRange(_("Swipe"), "org.cinnamon.gestures", "swipe-percent-threshold", _("20%"), _("80%"), 20, 80, step=5, show_value=True)
            widget.add_mark(60, Gtk.PositionType.TOP, None)
            section.add_row(widget)
            widget = GSettingsRange(_("Pinch"), "org.cinnamon.gestures", "pinch-percent-threshold", _("20%"), _("80%"), 20, 80, step=5, show_value=True)
            widget.add_mark(40, Gtk.PositionType.TOP, None)
            section.add_row(widget)

        self.disabled_page_switch.set_visible(False)
        self.disabled_retry_button.set_visible(False)
        self.disabled_page_disable_button.set_visible(False)

        if not installed:
            text = _("The touchegg package must be installed for gesture support.")
            self.disabled_retry_button.show()
        elif not self.gesture_settings.get_boolean("enabled"):
            self.disabled_page_switch.set_visible(True)
            text = _("Gestures are disabled")
        elif not alive:
            text = _("The Touchegg service is not running")
            if self.gesture_settings.get_boolean("enabled"):
                self.disabled_page_disable_button.set_visible(True)
            self.disabled_retry_button.show()

        self.sidePage.stack.set_transition_type(Gtk.StackTransitionType.NONE)

        if not enabled or not alive or not installed:
            self.disabled_label.set_markup(f"<big><b>{text}</b></big>")
            page = "disabled"
        else:
            page = "swipe"

        GLib.idle_add(self.set_initial_page, page)

    def set_initial_page(self, page):
        if page == "disabled":
            Gio.Application.get_default().stack_switcher.set_opacity(0)
        else:
            Gio.Application.get_default().stack_switcher.set_opacity(1.0)

        self.sidePage.stack.set_visible_child_full(page, Gtk.StackTransitionType.CROSSFADE)
        self.sidePage.stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT)

    def enabled_switch_changed(self, widget, pspec):
        self.gesture_settings.set_boolean("enabled", widget.get_active())

    def on_enabled_changed(self, settings, key):
        try:
            self.disabled_page_switch.disconnect_by_func(self.enabled_switch_changed)
        except TypeError:
            pass

        enabled = settings.get_boolean("enabled")
        self.disabled_page_switch.set_active(enabled)

        self.on_module_selected()

        self.disabled_page_switch.connect("notify::active", self.enabled_switch_changed)

    def get_key_label(self, key, gtype, fingers):
        parts = key.split("-")
        if gtype != parts[0]:
            return None

        gesture_directions = {"left": _("Left"), "right": _("Right"),
                              "up": _("Up"), "down": _("Down"),
                              "in": _("In"), "out": _("Out")}
        if gtype in ("swipe", "pinch"):
            if int(parts[2]) != fingers:
                return None
            direction = parts[1]
            return gesture_directions.get(direction, None)
        if gtype == "tap":
            if int(parts[1]) != fingers:
                return None
            return _("Tap with %d fingers") % fingers

        return None

    def test_daemon_alive(self):
        try:
            conn = Gio.DBusConnection.new_for_address_sync("unix:abstract=touchegg",
                                                           Gio.DBusConnectionFlags.AUTHENTICATION_CLIENT,
                                                           None, None)
            conn.close_sync(None)
            return True
        except GLib.Error:
            pass

        return False

    def migrate_settings(self):
        source = Gio.SettingsSchemaSource.get_default()
        if source:
            schema = source.lookup(SCHEMA, True)
            if schema:
                all_keys = schema.list_keys()
                for key in all_keys:
                    if key not in NON_GESTURE_KEYS:
                        val = self.gesture_settings.get_string(key)
                        if val == "" or "::" in val:
                            continue

                        action_string = custom_string = ""
                        if val.startswith("EXEC:"):
                            action_string, custom_string = val.split(":")
                            if custom_string == "":
                                # A RUN with no command is invalid, reset to nothing.
                                self.gesture_settings.set_string(key, "")
                                continue
                        else:
                            action_string = val

                        if custom_string == "":
                            self.gesture_settings.set_string(key, f"{action_string}::end")
                        else:
                            self.gesture_settings.set_string(key, f"{action_string}::{custom_string}::end")

class NonScrollingComboBox(Gtk.ComboBox):
    def __init__(self, *args, **kwargs):
        Gtk.ComboBox.__init__(self, *args, **kwargs)

    def do_scroll_event(self, event, data=None):
        # Skip Gtk.ComboBox's default handler.
        #
        # Connecting to a Gtk.ComboBox and stopping a scroll-event
        # prevents unintentional combobox changes, but also breaks
        # any scrollable parents when passing over the combobox.
        Gtk.Widget.do_scroll_event(self, event)

class GestureComboBox(SettingsWidget):
    def __init__(self, label, settings=None, key=None, size_group=None):
        super(GestureComboBox, self).__init__()
        self.props.margin = 0
        self.action_map = {}
        self.phase_map = {}

        self.action_value = None
        self.custom_value = None
        self.phase_value = None

        self.updating_from_setting = False
        self.updating_settings = False

        self.settings = settings
        self.key = key

        hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=4)
        self.pack_start(hbox, True, True, 0)
        self.label = SettingsLabel(label)
        self.label.props.xalign = 0.0
        self.label.props.yalign = 0.0

        label_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        label_vbox.pack_start(self.label, False, False, 0)
        hbox.pack_start(label_vbox, False, False, 6)

        controls_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        hbox.pack_end(controls_vbox, False, False, 6)

        # always visible
        self.action_combo = NonScrollingComboBox(visible=True)
        renderer_text = Gtk.CellRendererText()
        self.action_combo.pack_start(renderer_text, True)
        self.action_combo.add_attribute(renderer_text, "text", ACTION_LABEL_COL)

        controls_vbox.pack_start(self.action_combo, False, False, 0)

        self.custom_entry = Gtk.Entry(placeholder_text=_("Enter a command"), visible=True)
        self.custom_revealer = Gtk.Revealer(child=self.custom_entry,
                                            transition_type=Gtk.RevealerTransitionType.SLIDE_DOWN,
                                            transition_duration=150,
                                            no_show_all=True)

        controls_vbox.pack_start(self.custom_revealer, False, False, 0)

        self.phase_combo = NonScrollingComboBox(visible=True)
        renderer_text = Gtk.CellRendererText()
        self.phase_combo.pack_start(renderer_text, True)
        self.phase_combo.add_attribute(renderer_text, "text", PHASE_LABEL_COL)

        self.phase_revealer = Gtk.Revealer(child=self.phase_combo,
                                           transition_type=Gtk.RevealerTransitionType.SLIDE_DOWN,
                                           transition_duration=150,
                                           no_show_all=True)

        controls_vbox.pack_start(self.phase_revealer, False, False, 0)

        self.adjust_range = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, -50, 50, 2)
        self.adjust_range.add_mark(0, Gtk.PositionType.TOP, None)
        self.adjust_range.set_properties(visible=True,
                                         inverted=True,
                                         digits=0,
                                         has_origin=False,
                                         draw_value=False,
                                         value_pos=Gtk.PositionType.BOTTOM)

        range_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        range_label = Gtk.Label(label=_("Sensitivity"))
        range_box.pack_start(range_label, False, False, 0)

        range_hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        less_label = Gtk.Label(label=_("Less"))
        less_label.get_style_context().add_class("dim-label")
        more_label = Gtk.Label(label=_("More"))
        more_label.get_style_context().add_class("dim-label")
        range_hbox.pack_start(less_label, False, False, 0)
        range_hbox.pack_start(self.adjust_range, True, True, 0)
        range_hbox.pack_start(more_label, False, False, 0)
        range_box.pack_start(range_hbox, False, False, 0)
        range_box.show_all()

        self.range_revealer = Gtk.Revealer(child=range_box,
                                           transition_type=Gtk.RevealerTransitionType.SLIDE_DOWN,
                                           transition_duration=150,
                                           no_show_all=True)

        controls_vbox.pack_start(self.range_revealer, False, False, 0)

        self.set_options()

        self.settings.connect("changed::" + key, self.on_setting_changed)
        self.on_setting_changed(settings, key)
        self.action_combo.connect("changed", self.on_my_value_changed)
        self.phase_combo.connect("changed", self.on_my_value_changed)
        self.custom_entry.connect("changed", self.on_custom_entry_changed)
        self.adjust_range.connect("value-changed", self.on_range_value_changed)

        if size_group:
            size_group.add_widget(self.action_combo)
            size_group.add_widget(self.phase_combo)

    def on_my_value_changed(self, widget):
        if self.updating_from_setting:
            return

        tree_iter = widget.get_active_iter()
        if tree_iter is not None:
            if widget == self.action_combo:
                self.action_value = self.action_model[tree_iter][ACTION_ID_COL]
                custom_type = self.action_model[self.action_combo.get_active_iter()][ACTION_EXTRA_WIDGET_TYPE_COL]
                default_val = self.action_model[self.action_combo.get_active_iter()][ACTION_DEFAULT_CUSTOM_VALUE_COL]
                if custom_type == "slider":
                    self.adjust_range.set_value(int(default_val))
                elif custom_type == "entry":
                    self.custom_entry.set_text("")

            elif widget == self.phase_combo:
                self.phase_value = self.phase_model[tree_iter][PHASE_ID_COL]

            self.update_control_visibilities()
            self.store_action_settings()

    def update_control_visibilities(self):
        if self.action_value == "":
            self.phase_revealer.set_reveal_child(False)
            self.phase_revealer.hide()
            self.custom_revealer.set_reveal_child(False)
            self.custom_revealer.hide()
            self.range_revealer.set_reveal_child(False)
            self.range_revealer.hide()
            return

        phase_combo_visible = self.action_model[self.action_combo.get_active_iter()][ACTION_ALLOW_PHASE_SELECT_COL]
        self.phase_revealer.set_visible(phase_combo_visible)
        self.phase_revealer.set_reveal_child(phase_combo_visible)

        custom_entry_visible = self.action_value == "EXEC"
        self.custom_revealer.set_visible(custom_entry_visible)
        self.custom_revealer.set_reveal_child(custom_entry_visible)

        range_visible = self.action_model[self.action_combo.get_active_iter()][ACTION_EXTRA_WIDGET_TYPE_COL] == "slider"
        self.range_revealer.set_visible(range_visible)
        self.range_revealer.set_reveal_child(range_visible)

    def on_custom_entry_changed(self, entry):
        if self.updating_from_setting:
            return

        self.custom_value = entry.get_text()

        self.store_action_settings()

    def on_range_value_changed(self, range):
        if self.updating_from_setting:
            return

        self.custom_value = int(self.adjust_range.get_value())

        self.store_action_settings()

    def store_action_settings(self):
        self.updating_settings = True

        if self.action_value == "EXEC" and self.custom_value == "":
            return

        val = setting_to_string(self.action_value, self.custom_value, self.phase_value)

        self.settings.set_string(self.key, val)

        self.updating_settings = False

    def on_setting_changed(self, settings, key):
        if self.updating_settings:
            return

        self.updating_from_setting = True

        self.action_value, self.custom_value, self.phase_value = parse_setting(settings.get_string(key))

        if self.action_value == "EXEC":
            if self.custom_value != "":
                self.action_combo.set_active_iter(self.action_map["EXEC"])
            else:
                self.action_value = ""
                self.action_combo.set_active_iter(self.action_map[""])
        else:
            try:
                self.action_combo.set_active_iter(self.action_map[self.action_value])
            except KeyError:
                self.action_combo.set_active_iter(self.action_map[""])

        try:
            self.phase_combo.set_active_iter(self.phase_map[self.phase_value])
        except:
            self.phase_combo.set_active_iter(self.phase_map["end"])

        custom_type = self.action_model[self.action_combo.get_active_iter()][ACTION_EXTRA_WIDGET_TYPE_COL]

        if custom_type == "entry":
            self.custom_entry.set_text(self.custom_value)
        elif custom_type == "slider":
            if self.custom_value == "":
                default_value = self.action_model[self.action_combo.get_active_iter()][ACTION_DEFAULT_CUSTOM_VALUE_COL]
                val = int(default_value)
            else:
                val = int(self.custom_value)

            self.adjust_range.set_value(val)

        self.update_control_visibilities()
        self.updating_from_setting = False

    def set_options(self):
        self.action_model = Gtk.ListStore(str, str, bool, str, str)

        for option in ACTIONS:
            self.action_map[option[0]] = self.action_model.append(option)

        self.action_combo.set_model(self.action_model)
        self.action_combo.set_id_column(0)

        self.phase_model = Gtk.ListStore(str, str)

        for phase in PHASES:
            self.phase_map[phase[0]] = self.phase_model.append([phase[0], phase[1]])

        self.phase_combo.set_model(self.phase_model)
        self.phase_combo.set_id_column(0)
