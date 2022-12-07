#!/usr/bin/python3

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("CDesktopEnums", "3.0")
from gi.repository import Gtk, Gdk, GLib, CDesktopEnums

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *


class Module:
    comment = _("Control mouse and touchpad settings")
    name = "mouse"
    category = "hardware"

    def __init__(self, content_box):
        keywords = _("mouse, touchpad, synaptic, double-click")
        sidePage = SidePage(_("Mouse and Touchpad"), "cs-mouse", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Mouse module")

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            # Mouse

            page = SettingsPage()

            settings = page.add_section(_("General"))

            switch = GSettingsSwitch(_("Left handed (mouse buttons inverted)"), "org.cinnamon.desktop.peripherals.mouse", "left-handed")
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Reverse scrolling direction"), "org.cinnamon.desktop.peripherals.mouse", "natural-scroll")
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Show position of pointer when the Control key is pressed"), "org.cinnamon.desktop.peripherals.mouse", "locate-pointer")
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Emulate middle click by clicking both left and right buttons"), "org.cinnamon.desktop.peripherals.mouse", "middle-click-emulation")
            settings.add_row(switch)

            spin = GSettingsSpinButton(_("Drag-and-drop threshold"), "org.cinnamon.desktop.peripherals.mouse", "drag-threshold", _("pixels"), 1, 400)
            settings.add_row(spin)

            settings = page.add_section(_("Pointer size and speed"))

            widget = GSettingsRange(_("Size"), "org.cinnamon.desktop.interface", "cursor-size", _("Smaller"), _("Larger"), 5, 50, show_value=False)
            widget.add_mark(24.0, Gtk.PositionType.TOP, None)
            settings.add_row(widget)

            slider = GSettingsRange(_("Speed"), "org.cinnamon.desktop.peripherals.mouse", "speed", _("Slower"), _("Faster"), -1.0, 1.0, show_value=False)
            slider.content_widget.add_mark(0.0, Gtk.PositionType.TOP, None)

            settings.add_row(slider)

            accel_profiles = [
                [CDesktopEnums.PointerAccelProfile.DEFAULT.value_nick, _("Device default")],
                [CDesktopEnums.PointerAccelProfile.FLAT.value_nick, _("Constant")],
                [CDesktopEnums.PointerAccelProfile.ADAPTIVE.value_nick, _("Adaptive")]
            ]

            combo = GSettingsComboBox(_("Acceleration"), "org.cinnamon.desktop.peripherals.mouse", "accel-profile", accel_profiles, valtype=str)
            settings.add_row(combo)

            settings = page.add_section(_("Double-Click timeout"))

            slider = GSettingsRange(_("Timeout"), "org.cinnamon.desktop.peripherals.mouse", "double-click", _("Short"), _("Long"), 100, 1000, show_value=False)
            settings.add_row(slider)

            box = SettingsWidget()
            widget = Gtk.Button.new_with_label(_("Double-click test"))
            widget.connect("button-press-event", self.test_button_clicked)
            box.pack_start(widget, True, True, 0)
            settings.add_row(box)

            self.sidePage.stack.add_titled(page, "mouse", _("Mouse"))

            # Touchpad

            page = SettingsPage()

            send_events_modes = [
                ["enabled", _("Enabled")],
                ["disabled", _("Disabled")],
                ["disabled-on-external-mouse", _("Disabled when a mouse is attached")]
            ]

            combo = GSettingsComboBox(_("Touchpad is"), "org.cinnamon.desktop.peripherals.touchpad", "send-events", send_events_modes, valtype=str)
            combo.fill_row()
            page.pack_start(combo, False, True, 0)

            revealer = SettingsRevealer("org.cinnamon.desktop.peripherals.touchpad", "send-events", values=("enabled", "disabled-on-external-mouse"))
            page.pack_start(revealer, False, True, 0)

            settings = SettingsSection(_("General"))
            revealer.add(settings)

            switch = GSettingsSwitch(_("Tap to click"), "org.cinnamon.desktop.peripherals.touchpad", "tap-to-click")
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Disable touchpad while typing"), "org.cinnamon.desktop.peripherals.touchpad", "disable-while-typing")
            settings.add_row(switch)

            clickpad_list = [
                [CDesktopEnums.TouchpadClickMethod.DEFAULT.value_nick, _("Default device behavior")],
                [CDesktopEnums.TouchpadClickMethod.NONE.value_nick, _("Disabled")],
                [CDesktopEnums.TouchpadClickMethod.AREAS.value_nick, _("Virtual button areas along bottom of touchpad")],
                [CDesktopEnums.TouchpadClickMethod.FINGERS.value_nick, _("Use multiple fingers for right and middle click")]
            ]

            combo = GSettingsComboBox(_("Click actions"), "org.cinnamon.desktop.peripherals.touchpad", "click-method", clickpad_list, valtype=str)
            settings.add_row(combo)

            settings = SettingsSection(_("Scrolling"))
            revealer.add(settings)

            switch = GSettingsSwitch(_("Reverse scrolling direction"), "org.cinnamon.desktop.peripherals.touchpad", "natural-scroll")
            settings.add_row(switch)

            combo = ScrollMethodCombo()
            settings.add_row(combo)

            settings = SettingsSection(None)
            revealer.add(settings)

            slider = GSettingsRange(_("Speed"), "org.cinnamon.desktop.peripherals.touchpad", "speed", _("Slower"), _("Faster"), -1.0, 1.0, show_value=False)
            slider.content_widget.add_mark(0.0, Gtk.PositionType.TOP, None)
            settings.add_row(slider)

            self.sidePage.stack.add_titled(page, "touchpad", _("Touchpad"))

    def test_button_clicked(self, widget, event):
        if event.type == Gdk.EventType._2BUTTON_PRESS:
            widget.set_label(_("Success!"))
            GLib.timeout_add(1000, self.reset_test_button, widget)
        return True

    def reset_test_button(self, widget):
        widget.set_label(_("Double-click test"))
        return False

class ScrollMethodCombo(ComboBox):
    def __init__(self):
        self.scrolling_list = [
            [0, _("Disabled")],
            [1, _("Two-finger scrolling")],
            [2, _("Edge scrolling")]
        ]

        super(ScrollMethodCombo, self).__init__(_("Scrolling method"), options=self.scrolling_list, valtype=int)

        self.touchpad_settings = Gio.Settings(schema_id="org.cinnamon.desktop.peripherals.touchpad")
        self.touchpad_settings.connect("changed::two-finger-scrolling-enabled", self.on_setting_changed)
        self.touchpad_settings.connect("changed::edge-scrolling-enabled", self.on_setting_changed)
        self.on_setting_changed(None, None)

        self.connect_widget_handlers()

    def on_my_value_changed(self, combo):
        tree_iter = combo.get_active_iter()
        if tree_iter is not None:
            self.value = self.model[tree_iter][0]
            self.set_value(self.value)

    def set_value(self, value):
        if value == 0:
            self.touchpad_settings.set_boolean("two-finger-scrolling-enabled", False)
            self.touchpad_settings.set_boolean("edge-scrolling-enabled", False)
        elif value == 1:
            self.touchpad_settings.set_boolean("two-finger-scrolling-enabled", True)
            self.touchpad_settings.set_boolean("edge-scrolling-enabled", False)
        elif value == 2:
            self.touchpad_settings.set_boolean("two-finger-scrolling-enabled", False)
            self.touchpad_settings.set_boolean("edge-scrolling-enabled", True)

    def on_setting_changed(self, schema, key):
            finger = self.touchpad_settings.get_boolean("two-finger-scrolling-enabled")
            edge = self.touchpad_settings.get_boolean("edge-scrolling-enabled")

            if finger and edge:
                GLib.idle_add(self.touchpad_settings.set_boolean, ("edge-scrolling-enabled", False))
                # self.touchpad_settings.set_boolean("edge-scrolling-enabled", False)
                return
            elif finger:
                self.value = 1
            elif edge:
                self.value = 2
            else:
                self.value = 0

            try:
                self.content_widget.set_active_iter(self.option_map[self.value])
            except:
                self.content_widget.set_active_iter(None)
