#!/usr/bin/env python

from gi.repository import Gtk, Gdk, GLib
from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("mouse, touchpad, synaptic, double-click")
        sidePage = SidePage(_("Mouse and Touchpad"), "cs-mouse", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.comment = _("Control mouse and touchpad settings")
        self.name = "mouse"
        self.category = "hardware"

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Mouse module"

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            # Mouse

            page = SettingsPage()

            settings = SettingsBox(_("General"))
            page.pack_start(settings, False, True, 0)

            box = SettingsRow()
            label = Gtk.Label(_("Left handed (mouse buttons inverted)"))
            box.pack_start(label, False, False, 0)
            switch = GSettingsSwitch("org.cinnamon.settings-daemon.peripherals.mouse", "left-handed", None)
            box.pack_end(switch, False, False, 0)
            settings.add_row(box)

            box = SettingsRow()
            label = Gtk.Label(_("Show position of pointer when the Control key is pressed"))
            box.pack_start(label, False, False, 0)
            switch = GSettingsSwitch("org.cinnamon.settings-daemon.peripherals.mouse", "locate-pointer", None)
            box.pack_end(switch, False, False, 0)
            settings.add_row(box)

            box = SettingsRow()
            label = Gtk.Label(_("Emulate middle click by clicking both left and right buttons"))
            box.pack_start(label, False, False, 0)
            switch = GSettingsSwitch("org.cinnamon.settings-daemon.peripherals.mouse", "middle-button-enabled", None)
            box.pack_end(switch, False, False, 0)
            settings.add_row(box)

            box = SettingsRow()
            label = Gtk.Label(_("Drag-and-drop threshold (pixels)"))
            box.pack_start(label, False, False, 0)
            switch = GSettingsSpinButton("", "org.cinnamon.settings-daemon.peripherals.mouse", "drag-threshold", None, 1, 400, 1, 1, "")
            box.pack_end(switch, False, False, 0)
            settings.add_row(box)

            settings = SettingsBox(_("Pointer Size"))
            page.pack_start(settings, False, True, 0)

            box = SettingsRow()
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            box.pack_start(vbox, True, True, 0)
            widget = Gtk.Label()
            widget.set_markup("<i><small>%s</small></i>" % _("Note: All sizes may not be available on certain icon themes"))
            vbox.pack_start(widget, False, False, 0)
            widget.set_halign(Gtk.Align.CENTER)
            widget = GSettingsRange("", _("Smaller"), _("Larger"), 5, 50, False, "int", False, "org.cinnamon.desktop.interface", "cursor-size", None, adjustment_step = 1.0)
            widget.add_mark(24.0, Gtk.PositionType.TOP, None)
            vbox.pack_start(widget, True, True, 6)
            settings.add_row(box)

            settings = SettingsBox(_("Pointer Speed"))
            page.pack_start(settings, False, True, 0)

            box = SettingsRow()
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            box.pack_start(vbox, True, True, 0)
            widget = Gtk.Label()
            widget.set_markup("%s" % _("Acceleration"))
            vbox.pack_start(widget, False, False, 0)
            widget.set_halign(Gtk.Align.CENTER)
            widget = GSettingsRange("", _("Slow"), _("Fast"), 1.0, 10.0, False, "double", False, "org.cinnamon.settings-daemon.peripherals.mouse", "motion-acceleration", None, adjustment_step = 1.0)
            vbox.pack_start(widget, True, True, 6)
            settings.add_row(box)

            box = SettingsRow()
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            box.pack_start(vbox, True, True, 0)
            widget = Gtk.Label()
            widget.set_markup("%s" % _("Sensitivity"))
            vbox.pack_start(widget, False, False, 0)
            widget.set_halign(Gtk.Align.CENTER)
            widget = GSettingsRange("", _("Low"), _("High"), 1, 10, False, "int", False, "org.cinnamon.settings-daemon.peripherals.mouse", "motion-threshold", None, adjustment_step = 1)
            vbox.pack_start(widget, True, True, 6)
            settings.add_row(box)

            settings = SettingsBox(_("Double-Click timeout"))
            page.pack_start(settings, False, True, 0)

            box = SettingsRow()
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            box.pack_start(vbox, True, True, 0)
            widget = Gtk.Label(_("Timeout"))
            vbox.pack_start(widget, False, False, 0)
            widget.set_halign(Gtk.Align.CENTER)
            widget = GSettingsRange("", _("Short"), _("Long"), 100, 1000, False, "int", False, "org.cinnamon.settings-daemon.peripherals.mouse", "double-click", None, adjustment_step = 1)
            vbox.pack_start(widget, True, True, 6)
            settings.add_row(box)

            box = SettingsRow()
            widget = Gtk.Button.new_with_label(_("Double-click test"))
            widget.connect("button-press-event", self.test_button_clicked)
            box.pack_start(widget, True, True, 0)
            settings.add_row(box)

            self.sidePage.stack.add_titled(page, "mouse", _("Mouse"))

            # Touchpad

            page = SettingsPage()

            revealer = SettingsRevealer("org.cinnamon.settings-daemon.peripherals.touchpad", "touchpad-enabled")

            box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
            label = Gtk.Label()
            label.set_markup("<b>%s</b>" % _("Enable touchpad"))
            box.pack_start(label, False, False, 0)
            switch = GSettingsSwitch("org.cinnamon.settings-daemon.peripherals.touchpad", "touchpad-enabled", None)
            box.pack_end(switch, False, False, 0)
            page.pack_start(box, False, True, 0)

            reveal_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=15)
            revealer.add(reveal_box)
            page.pack_start(revealer, False, True, 0)

            settings = SettingsBox(_("General"))
            reveal_box.pack_start(settings, False, True, 0)

            box = SettingsRow()
            label = Gtk.Label(_("Tap to click"))
            box.pack_start(label, False, False, 0)
            switch = GSettingsSwitch("org.cinnamon.settings-daemon.peripherals.touchpad", "tap-to-click", None)
            box.pack_end(switch, False, False, 0)
            settings.add_row(box)

            box = SettingsRow()
            label = Gtk.Label(_("Disable touchpad while typing"))
            box.pack_start(label, False, False, 0)
            switch = GSettingsSwitch("org.cinnamon.settings-daemon.peripherals.touchpad", "disable-while-typing", None)
            box.pack_end(switch, False, False, 0)
            settings.add_row(box)

            settings = SettingsBox(_("Scrolling"))
            reveal_box.pack_start(settings, False, True, 0)

            box = SettingsRow()
            label = Gtk.Label(_("Panel layout"))
            box.pack_start(label, False, False, 0)
            scroll_method = [["disabled", _("Disabled")], ["edge-scrolling", _("Edge Scrolling")], ["two-finger-scrolling", _("Two-finger scrolling")]]
            scroll_method_combo = GSettingsComboBox("", "org.cinnamon.settings-daemon.peripherals.touchpad", "scroll-method", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled", scroll_method)
            box.pack_end(scroll_method_combo, False, False, 0)
            settings.add_row(box)

            box = SettingsRow()
            label = Gtk.Label(_("Natural scrolling"))
            box.pack_start(label, False, False, 0)
            switch = GSettingsSwitch("org.cinnamon.settings-daemon.peripherals.touchpad", "natural-scroll", None)
            box.pack_end(switch, False, False, 0)
            settings.add_row(box)

            box = SettingsRow()
            label = Gtk.Label(_("Horizontal scrolling"))
            box.pack_start(label, False, False, 0)
            switch = GSettingsSwitch("org.cinnamon.settings-daemon.peripherals.touchpad", "horiz-scroll-enabled", None)
            box.pack_end(switch, False, False, 0)
            settings.add_row(box)


            settings = SettingsBox(_("Pointer speed"))
            reveal_box.pack_start(settings, False, True, 0)

            box = SettingsRow()
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            box.pack_start(vbox, True, True, 0)
            widget = Gtk.Label()
            widget.set_markup("%s" % _("Acceleration"))
            vbox.pack_start(widget, False, False, 0)
            widget.set_halign(Gtk.Align.CENTER)
            widget = GSettingsRange("", _("Slow"), _("Fast"), 1.0, 10.0, False, "double", False, "org.cinnamon.settings-daemon.peripherals.touchpad", "motion-acceleration", None, adjustment_step = 1.0)
            vbox.pack_start(widget, True, True, 6)
            settings.add_row(box)

            box = SettingsRow()
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            box.pack_start(vbox, True, True, 0)
            widget = Gtk.Label()
            widget.set_markup("%s" % _("Sensitivity"))
            vbox.pack_start(widget, False, False, 0)
            widget.set_halign(Gtk.Align.CENTER)
            widget = GSettingsRange("",  _("Low"), _("High"), 1, 10, False, "int", False, "org.cinnamon.settings-daemon.peripherals.touchpad", "motion-threshold", None, adjustment_step = 1)
            vbox.pack_start(widget, True, True, 6)
            settings.add_row(box)

            settings = SettingsBox(_("Button emulation"))
            reveal_box.pack_start(settings, False, True, 0)

            button_list = [[0, _("Disabled")], [1, _("Left button")], [2, _("Middle button")], [3, _("Right button")]]

            box = SettingsRow()
            widget = Gtk.Label(_("Two-finger click emulation:"))
            box.pack_start(widget, False, False, 0)
            combo = GSettingsIntComboBox("", "org.cinnamon.settings-daemon.peripherals.touchpad", "two-finger-click", None, button_list, False)
            box.pack_end(combo, False, False, 0)
            settings.add_row(box)

            box = SettingsRow()
            widget = Gtk.Label(_("Three-finger click emulation:"))
            box.pack_start(widget, False, False, 0)
            combo = GSettingsIntComboBox("", "org.cinnamon.settings-daemon.peripherals.touchpad", "three-finger-click", None, button_list, False)
            box.pack_end(combo, False, False, 0)
            settings.add_row(box)

            self.sidePage.stack.add_titled(page, "touchpad", _("Touchpad"))

    def test_button_clicked(self, widget, event):
        if event.type == Gdk.EventType._2BUTTON_PRESS:
            widget.set_label(_("Success!"))
            GLib.timeout_add(1000, self.reset_test_button, widget)
        return True

    def reset_test_button(self, widget):
        widget.set_label(_("Double-click test"))
        return False
