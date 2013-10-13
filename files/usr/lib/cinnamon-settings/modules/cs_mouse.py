#!/usr/bin/env python

import os
from gi.repository import Gtk, Gdk, GLib
from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("mouse, touchpad, synaptic, double-click")
        advanced = False
        sidePage = MouseTouchpadSidepage(_("Mouse and Touchpad"), "mouse.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "mouse"
        self.category = "hardware"

class MouseTouchpadSidepage (SidePage):
    def __init__(self, name, icon, keywords, advanced, content_box):
        SidePage.__init__(self, name, icon, keywords, advanced, content_box, 350)
        self.tabs = []
        self.mousebox = Gtk.VBox()
        self.touchbox = Gtk.VBox()

        self.notebook = Gtk.Notebook()

        mouse = Gtk.ScrolledWindow()
        mouse.add_with_viewport(self.mousebox)

        touch = Gtk.ScrolledWindow()
        touch.add_with_viewport(self.touchbox)
        self.notebook.append_page(mouse, Gtk.Label(_("Mouse")))
        self.notebook.append_page(touch, Gtk.Label(_("Touchpad")))

        # Mouse

        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("General"))
        title.set_alignment(0,0)
        self.add_widget(title, 0, False)

        box = IndentedHBox()
        box.add(CheckButton(_("Left handed (mouse buttons inverted)"), "org.cinnamon.settings-daemon.peripherals.mouse", "left-handed", None))
        self.add_widget(box, 0)

        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Show position of pointer when the Control key is pressed"), "org.cinnamon.settings-daemon.peripherals.mouse", "locate-pointer", None))
        self.add_widget(box, 0)

        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Emulate middle click by clicking both left and right buttons"), "org.cinnamon.settings-daemon.peripherals.mouse", "middle-button-enabled", None))
        self.add_widget(box, 0, True)

        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("Pointer Speed"))
        title.set_alignment(0,0)
        self.add_widget(title, 0, None)

        box = IndentedHBox()
        slider = GSettingsRange(_("Acceleration:"), _("Slow"), _("Fast"), 1.0, 10.0, False, "double", False, "org.cinnamon.settings-daemon.peripherals.mouse", "motion-acceleration", None, adjustment_step = 1.0)
        box.add_expand(slider)
        self.add_widget(box, 0, None)

        box = IndentedHBox()
        slider = GSettingsRange(_("Sensitivity:"), _("Low"), _("High"), 1, 10, False, "int", False, "org.cinnamon.settings-daemon.peripherals.mouse", "motion-threshold", None, adjustment_step = 1)
        box.add_expand(slider)
        self.add_widget(box, 0, None) 

        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("Double-Click Timeout"))
        title.set_alignment(0,0)
        self.add_widget(title, 0, None)

        box = IndentedHBox()
        slider = GSettingsRange(_("Timeout:"), _("Short"), _("Long"), 100, 1000, False, "int", False, "org.cinnamon.settings-daemon.peripherals.mouse", "double-click", None, adjustment_step = 1)
        box.add_expand(slider)
        self.add_widget(box, 0, None)

        test_button = Gtk.Button(_("Double-click test"))
        test_button.connect("button-press-event", self.test_button_clicked)
        self.add_widget(test_button, 0, None)

        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("Drag and drop"))
        title.set_alignment(0,0)
        self.add_widget(title, 0, True)

        box = IndentedHBox()
        box.add(GSettingsSpinButton(_("Cinnamon drag threshold"), "org.cinnamon", "dnd-drag-threshold", None, 1, 400, 1, 1, _("Pixels")))
        self.add_widget(box, 0, True)

        box = IndentedHBox()
        box.add(GSettingsSpinButton(_("GTK drag threshold"), "org.cinnamon.settings-daemon.peripherals.mouse", "drag-threshold", None, 1, 400, 1, 1, _("Pixels")))
        self.add_widget(box, 0, True)

        # Touchpad

        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("General"))
        title.set_alignment(0,0)
        self.add_widget(title, 1, False)

        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Enable touchpad"), "org.cinnamon.settings-daemon.peripherals.touchpad", "touchpad-enabled", None))
        self.add_widget(box, 1)

        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Disable touchpad while typing"), "org.cinnamon.settings-daemon.peripherals.touchpad", "disable-while-typing", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled"))
        self.add_widget(box, 1)
        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Enable mouseclicks with touchpad"), "org.cinnamon.settings-daemon.peripherals.touchpad", "tap-to-click", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled"))
        self.add_widget(box, 1)

        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("Scrolling"))
        title.set_alignment(0,0)
        self.add_widget(title, 1, False)

        scroll_method = [["disabled", _("Disabled")], ["edge-scrolling", _("Edge Scrolling")], ["two-finger-scrolling", _("Two-finger scrolling")]]
        scroll_method_combo = GSettingsComboBox(_("Panel layout"), "org.cinnamon.settings-daemon.peripherals.touchpad", "scroll-method", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled", scroll_method)
        box = IndentedHBox()
        box.add(scroll_method_combo)
        self.add_widget(box, 1)
        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Enable natural scrolling"), "org.cinnamon.settings-daemon.peripherals.touchpad", "natural-scroll", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled"))
        self.add_widget(box, 1)
        box = IndentedHBox()
        box.add(GSettingsCheckButton(_("Enable horizontal scrolling"), "org.cinnamon.settings-daemon.peripherals.touchpad", "horiz-scroll-enabled", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled"))
        self.add_widget(box, 1)

        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("Pointer Speed"))
        title.set_alignment(0,0)
        self.add_widget(title, 1, False)

        slider = GSettingsRange(_("Acceleration:"), _("Slow"), _("Fast"), 1.0, 10.0, False, "double", False, "org.cinnamon.settings-daemon.peripherals.touchpad", "motion-acceleration", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled", adjustment_step = 1.0)
        box = IndentedHBox()
        box.add_expand(slider)
        self.add_widget(box, 1, None)

        slider = GSettingsRange(_("Sensitivity:"), _("Low"), _("High"), 1, 10, False, "int", False, "org.cinnamon.settings-daemon.peripherals.touchpad", "motion-threshold", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled", adjustment_step = 1)
        box = IndentedHBox()
        box.add_expand(slider)
        self.add_widget(box, 1, None) 

    def add_widget(self, widget, tab, advanced = False):
        self.widgets.append(widget)
        widget.advanced = advanced
        widget.tab = tab

    def build(self, advanced):
        for widget in self.mousebox.get_children():
            self.mousebox.remove(widget)
        for widget in self.touchbox.get_children():
            self.touchbox.remove(widget)
        for widget in self.content_box.get_children():
            self.content_box.remove(widget)

        for widget in self.widgets:
            if widget.advanced:
                if not advanced:
                    continue
            if widget.tab == 0:
                self.mousebox.pack_start(widget, False, False, 2)
            elif widget.tab == 1:
                self.touchbox.pack_start(widget, False, False, 2)

        self.content_box.pack_start(self.notebook, True, True, 2)
        self.content_box.show_all()

    def test_button_clicked(self, widget, event):
        if event.type == Gdk.EventType._2BUTTON_PRESS:
            widget.set_label(_("DOUBLE-CLICK"))
            GLib.timeout_add(1000, self.reset_test_button, widget)
        return True

    def reset_test_button(self, widget):
        widget.set_label(_("Double-click test"))
        return False

class CheckButton(Gtk.CheckButton):
    def __init__(self, label, schema, key, dep_key):
        self.key = key
        self.dep_key = dep_key
        super(CheckButton, self).__init__(label)
        self.settings = Gio.Settings.new(schema)
        self.set_active(self.settings.get_boolean(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.connectorId = self.connect('toggled', self.on_my_value_changed)
        self.connect('button-release-event', self.on_clicked)
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_setting_changed(self, settings, key):
        self.disconnect(self.connectorId)                     #  panel-edit-mode can trigger changed:: twice in certain instances,
        self.set_active(self.settings.get_boolean(self.key))  #  so disconnect temporarily when we are simply updating the widget state
        self.connectorId = self.connect('toggled', self.on_my_value_changed)

    def on_my_value_changed(self, widget):
        self.settings.set_boolean(self.key, self.get_active())

    def on_clicked(self, widget, event):
        if event.get_button()[1] == 3:
            self.set_active(not self.get_active())

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.dep_settings.get_boolean(self.dep_key))
        else:
            self.set_sensitive(not self.dep_settings.get_boolean(self.dep_key))
