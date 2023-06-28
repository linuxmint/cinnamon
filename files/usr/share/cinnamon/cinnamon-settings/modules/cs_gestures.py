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

DEBUG_SHOW_ALL = False


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
        have_touchpad = DEBUG_SHOW_ALL
        have_touchscreen = DEBUG_SHOW_ALL

        # Detect devices.
        out = subprocess.getoutput("csd-input-helper").replace("\t", " ").split("\n")[:4]
        for line in out:
            if "touchpad" in line and line.endswith("yes"):
                have_touchpad = True
            if "touchscreen" in line and line.endswith("yes"):
                have_touchscreen = True

        installed = GLib.find_program_in_path("touchegg")
        alive = self.test_daemon_alive()

        if self.gesture_settings is None:
            self.gesture_settings = Gio.Settings(schema_id=SCHEMA)
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

            self.disabled_page_switch = Gtk.Switch(active=self.gesture_settings.get_boolean("enabled"), no_show_all=True)
            self.disabled_page_switch.connect("notify::active", self.enabled_switch_changed)
            box.pack_start(self.disabled_page_switch, False, False, 0)

            self.disabled_retry_button = Gtk.Button(label=_("Check again"), no_show_all=True, halign=Gtk.Align.CENTER)
            self.disabled_retry_button.connect("clicked", lambda w: self.on_module_selected())
            box.pack_start(self.disabled_retry_button, False, False, 0)

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

            actions = [
                ["", _("Disabled")],
                ["WORKSPACE_NEXT", _("Switch to right workspace")],
                ["WORKSPACE_PREVIOUS", _("Switch to left workspace")],
                # ["WORKSPACE_UP", _("Switch to the workspace above")],
                # ["WORKSPACE_DOWN", _("Switch to the workspace below")],
                ["TOGGLE_EXPO", _("Show the workspace selector (Expo)")],
                ["TOGGLE_OVERVIEW", _("Show the window selector (Scale)")],
                ["MINIMIZE", _("Minimize window")],
                ["MAXIMIZE", _("Maximize window")],
                ["CLOSE", _("Close window")],
                ["WINDOW_WORKSPACE_NEXT", _("Move window to right workspace")],
                ["WINDOW_WORKSPACE_PREVIOUS", _("Move window to left workspace")],
                ["FULLSCREEN", _("Make window fullscreen")],
                ["UNFULLSCREEN", _("Exit window fullscreen")],
                ["PUSH_TILE_UP", _("Push tile up")],
                ["PUSH_TILE_DOWN", _("Push tile down")],
                ["PUSH_TILE_LEFT", _("Push tile left")],
                ["PUSH_TILE_RIGHT", _("Push tile right")],
                ["TOGGLE_DESKTOP", _("Show desktop")],
                ["VOLUME_UP", _("Volume up")],
                ["VOLUME_DOWN", _("Volume down")],
                ["TOGGLE_MUTE", _("Volume mute")],
                ["MEDIA_PLAY_PAUSE", _("Toggle Play / Pause")],
                ["MEDIA_NEXT", _("Next track")],
                ["MEDIA_PREVIOUS", _("Previous track")],
                ["EXEC", _("Run a command")],
            ]

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "swipe", _("Swipe"))
            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            if have_touchscreen:
                size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

                section = page.add_section(_("Swipe with 2 fingers"), _("Touchscreen only"))

                for key in keys:
                    label = self.get_key_label(key, "swipe", 2)
                    if not label:
                        continue

                    widget = GestureComboBox(label, self.gesture_settings, key, actions, size_group=size_group)
                    section.add_row(widget)

            if have_touchpad or have_touchscreen:
                section = page.add_section(_("Swipe with 3 fingers"))

                for key in keys:
                    label = self.get_key_label(key, "swipe", 3)
                    if not label:
                        continue

                    widget = GestureComboBox(label, self.gesture_settings, key, actions, size_group=size_group)
                    section.add_row(widget)

                section = page.add_section(_("Swipe with 4 fingers"))

                for key in keys:
                    label = self.get_key_label(key, "swipe", 4)
                    if not label:
                        continue

                    widget = GestureComboBox(label, self.gesture_settings, key, actions, size_group=size_group)
                    section.add_row(widget)

            if have_touchscreen:
                section = page.add_section(_("Swipe with 5 fingers"), _("Touchscreen only"))

                for key in keys:
                    label = self.get_key_label(key, "swipe", 5)
                    if not label:
                        continue

                    widget = GestureComboBox(label, self.gesture_settings, key, actions, size_group=size_group)
                    section.add_row(widget)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "pinch", _("Pinch"))
            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            if have_touchpad or have_touchscreen:
                for fingers in range(2, 5):
                    section = page.add_section(_(f"Pinch with {fingers} fingers"))

                    for key in keys:
                        label = self.get_key_label(key, "pinch", fingers)

                        if not label:
                            continue

                        widget = GestureComboBox(label, self.gesture_settings, key, actions, size_group=size_group)
                        section.add_row(widget)

            if have_touchscreen:
                section = page.add_section(_("Pinch with 5 fingers"), _("Touchscreen only"))

                for key in keys:
                    label = self.get_key_label(key, "pinch", 5)

                    if not label:
                        continue

                    widget = GestureComboBox(label, self.gesture_settings, key, actions, size_group=size_group)
                    section.add_row(widget)

            if have_touchscreen:
                page = SettingsPage()
                self.sidePage.stack.add_titled(page, "tap", _("Tap"))
                size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

                section = page.add_section(_("Tap"), _("Touchscreen only"))

                for fingers in range(2, 6):
                    for key in keys:
                        label = self.get_key_label(key, "tap", fingers)

                        if not label:
                            continue

                        widget = GestureComboBox(label, self.gesture_settings, key, actions, size_group=size_group)
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

        if not installed:
            text = _("The touchegg package must be installed for gesture support.")
            self.disabled_retry_button.show()
        elif not alive:
            text = _("The Touchegg service is not running")
            self.disabled_retry_button.show()
        elif not have_touchpad and not have_touchscreen:
            text = _("No compatible devices found")
            self.disabled_retry_button.show()
        else:
            self.disabled_page_switch.set_visible(True)
            text = _("Gestures are disabled")

        self.disabled_label.set_markup(f"<big><b>{text}</b></big>")

        self.sidePage.stack.set_transition_type(Gtk.StackTransitionType.NONE)

        if not enabled or not (have_touchpad or have_touchscreen) or not alive or not installed:
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

        if enabled:
            Gio.Application.get_default().stack_switcher.set_opacity(1.0)
            self.sidePage.stack.set_visible_child_full("swipe", Gtk.StackTransitionType.CROSSFADE)
        else:
            Gio.Application.get_default().stack_switcher.set_opacity(0)
            self.sidePage.stack.set_visible_child_full("disabled", Gtk.StackTransitionType.CROSSFADE)

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
            return _(f"Tap with {fingers} fingers")

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

class GestureComboBox(SettingsWidget):
    def __init__(self, label, settings=None, key=None, options=[], size_group=None):
        super(GestureComboBox, self).__init__()

        self.option_map = {}

        self.settings = settings
        self.key = key

        self.label = SettingsLabel(label)

        self.content_widget = Gtk.ComboBox()
        renderer_text = Gtk.CellRendererText()

        self.custom_entry = Gtk.Entry(placeholder_text=_("Enter a command"), no_show_all=True)
        self.content_widget.pack_start(renderer_text, True)
        self.content_widget.add_attribute(renderer_text, "text", 1)

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)
        self.content_widget.set_valign(Gtk.Align.CENTER)
        self.pack_end(self.custom_entry, True, True, 0)

        self.set_options(options)

        self.settings.connect("changed::" + key, self.on_setting_changed)
        self.on_setting_changed(settings, key)
        self.content_widget.connect("changed", self.on_my_value_changed)
        # Very easy to change combo selections by accidentally scrolling here - disable these events.
        self.content_widget.connect("scroll-event", lambda w, e: Gdk.EVENT_STOP)
        self.custom_entry.connect("changed", self.on_custom_entry_changed)

        if size_group:
            self.add_to_size_group(size_group)

    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter is not None:
            self.value = self.model[tree_iter][0]

            if self.value not in list(self.option_map)[0:-1]:
                self.custom_entry.show()
                self.settings.set_string(self.key, "EXEC:" + self.custom_entry.get_text())
            else:
                self.custom_entry.hide()
                self.settings.set_string(self.key, self.value)

    def on_custom_entry_changed(self, entry):
        if self.updating_from_setting:
            return
        self.settings.set_string(self.key, "EXEC:" + entry.get_text())

    def on_setting_changed(self, settings, key):
        self.updating_from_setting = True

        self.value = settings.get_string(key)
        try:
            self.content_widget.set_active_iter(self.option_map[self.value])
            self.custom_entry.hide()
        except:
            self.content_widget.set_active_iter(self.option_map["EXEC"])
            self.custom_entry.show()
            self.custom_entry.set_text(self.value.replace("EXEC:", ""))

        self.updating_from_setting = False

    def set_options(self, options):
        self.model = Gtk.ListStore(str, str)

        for option in options:
            self.option_map[option[0]] = self.model.append([option[0], option[1]])

        self.content_widget.set_model(self.model)
        self.content_widget.set_id_column(0)
