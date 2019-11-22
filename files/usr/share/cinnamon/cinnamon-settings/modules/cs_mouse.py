#!/usr/bin/python3

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import Gtk, Gdk, GLib

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

            switch = GSettingsSwitch(_("Left handed (mouse buttons inverted)"), "org.cinnamon.settings-daemon.peripherals.mouse", "left-handed")
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Reverse scrolling direction"), "org.cinnamon.settings-daemon.peripherals.mouse", "natural-scroll")
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Show position of pointer when the Control key is pressed"), "org.cinnamon.settings-daemon.peripherals.mouse", "locate-pointer")
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Emulate middle click by clicking both left and right buttons"), "org.cinnamon.settings-daemon.peripherals.mouse", "middle-button-enabled")
            settings.add_row(switch)

            spin = GSettingsSpinButton(_("Drag-and-drop threshold"), "org.cinnamon.settings-daemon.peripherals.mouse", "drag-threshold", _("pixels"), 1, 400)
            settings.add_row(spin)

            settings = page.add_section(_("Pointer size and speed"))

            widget = GSettingsRange(_("Size"), "org.cinnamon.desktop.interface", "cursor-size", _("Smaller"), _("Larger"), 5, 50, show_value=False)
            widget.add_mark(24.0, Gtk.PositionType.TOP, None)
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Custom Acceleration"), "org.cinnamon.settings-daemon.peripherals.mouse", "custom-acceleration")
            settings.add_row(widget)

            slider = GSettingsRange(_("Acceleration"), "org.cinnamon.settings-daemon.peripherals.mouse", "motion-acceleration", _("Slow"), _("Fast"), 1, 10, show_value=False)
            settings.add_reveal_row(slider, "org.cinnamon.settings-daemon.peripherals.mouse", "custom-acceleration")

            widget = GSettingsSwitch(_("Custom Sensitivity"), "org.cinnamon.settings-daemon.peripherals.mouse", "custom-threshold")
            settings.add_row(widget)

            slider = GSettingsRange(_("Sensitivity"), "org.cinnamon.settings-daemon.peripherals.mouse", "motion-threshold", _("Low"), _("High"), 1, 10, show_value=False, flipped=True)
            settings.add_reveal_row(slider, "org.cinnamon.settings-daemon.peripherals.mouse", "custom-threshold")

            settings = page.add_section(_("Double-Click timeout"))

            slider = GSettingsRange(_("Timeout"), "org.cinnamon.settings-daemon.peripherals.mouse", "double-click", _("Short"), _("Long"), 100, 1000, show_value=False)
            settings.add_row(slider)

            box = SettingsWidget()
            widget = Gtk.Button.new_with_label(_("Double-click test"))
            widget.connect("button-press-event", self.test_button_clicked)
            box.pack_start(widget, True, True, 0)
            settings.add_row(box)

            self.sidePage.stack.add_titled(page, "mouse", _("Mouse"))

            # Touchpad

            page = SettingsPage()

            switch = GSettingsSwitch("", "org.cinnamon.settings-daemon.peripherals.touchpad", "touchpad-enabled")
            switch.label.set_markup("<b>%s</b>" % _("Enable touchpad"))
            switch.fill_row()
            page.pack_start(switch, False, True, 0)

            revealer = SettingsRevealer("org.cinnamon.settings-daemon.peripherals.touchpad", "touchpad-enabled")
            page.pack_start(revealer, False, True, 0)

            settings = SettingsSection(_("General"))
            revealer.add(settings)

            switch = GSettingsSwitch(_("Tap to click"), "org.cinnamon.settings-daemon.peripherals.touchpad", "tap-to-click")
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Disable touchpad when a mouse is attached"), "org.cinnamon.settings-daemon.peripherals.touchpad", "disable-with-external-mouse")
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Disable touchpad while typing"), "org.cinnamon.settings-daemon.peripherals.touchpad", "disable-while-typing")
            settings.add_row(switch)

            clickpad_list = [[0, _("Left click only")], [3, _("Automatic")], [1, _("Emulate mouse buttons")], [2, _("Use multiple fingers for right and middle click")]]

            combo = GSettingsComboBox(_("Click actions"), "org.cinnamon.settings-daemon.peripherals.touchpad", "clickpad-click", clickpad_list, valtype=int)
            settings.add_row(combo)

            settings = SettingsSection(_("Scrolling"))
            revealer.add(settings)

            switch = GSettingsSwitch(_("Reverse scrolling direction"), "org.cinnamon.settings-daemon.peripherals.touchpad", "natural-scroll")
            settings.add_row(switch)

            clickpad_list = [[0, _("No scrolling")], [3, _("Automatic")], [1, _("Two-finger scrolling")], [2, _("Edge scrolling")]]
            combo = GSettingsComboBox(_("Scrolling method"), "org.cinnamon.settings-daemon.peripherals.touchpad", "scrolling-method", clickpad_list, valtype=int)
            settings.add_row(combo)
            switch = GSettingsSwitch(_("Horizontal scrolling"), "org.cinnamon.settings-daemon.peripherals.touchpad", "horizontal-scrolling")
            settings.add_row(switch)

            settings = SettingsSection(_("Pointer speed"))
            revealer.add(settings)

            switch = GSettingsSwitch(_("Custom Acceleration"), "org.cinnamon.settings-daemon.peripherals.touchpad", "custom-acceleration")
            settings.add_row(switch)

            slider = GSettingsRange(_("Acceleration"), "org.cinnamon.settings-daemon.peripherals.touchpad", "motion-acceleration", _("Slow"), _("Fast"), 1, 10, show_value=False)
            settings.add_reveal_row(slider, "org.cinnamon.settings-daemon.peripherals.touchpad", "custom-acceleration")

            switch = GSettingsSwitch(_("Custom Sensitivity"), "org.cinnamon.settings-daemon.peripherals.touchpad", "custom-threshold")
            settings.add_row(switch)

            slider = GSettingsRange(_("Sensitivity"), "org.cinnamon.settings-daemon.peripherals.touchpad", "motion-threshold", _("Low"), _("High"), 1, 10, show_value=False, flipped=True)
            settings.add_reveal_row(slider, "org.cinnamon.settings-daemon.peripherals.touchpad", "custom-threshold")

            self.sidePage.stack.add_titled(page, "touchpad", _("Touchpad"))

    def test_button_clicked(self, widget, event):
        if event.type == Gdk.EventType._2BUTTON_PRESS:
            widget.set_label(_("Success!"))
            GLib.timeout_add(1000, self.reset_test_button, widget)
        return True

    def reset_test_button(self, widget):
        widget.set_label(_("Double-click test"))
        return False
