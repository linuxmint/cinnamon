#!/usr/bin/env python

import os
from gi.repository import Gtk
from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("mouse, touchpad, synaptic, double-click")
        advanced = False
        sidePage = SidePage(_("Mouse and Touchpad"), "mouse.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "mouse"
        self.category = "hardware"
        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("General"))
        title.set_alignment(0,0)
        sidePage.add_widget(title)
        sidePage.add_widget(CheckButton(_("Left handed (mouse buttons inverted)"), "org.gnome.settings-daemon.peripherals.mouse", "left-handed", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show position of pointer when the Control key is pressed"), "org.gnome.settings-daemon.peripherals.mouse", "locate-pointer", None))
        sidePage.add_widget(GSettingsCheckButton(_("Emulate middle click by clicking both left and right buttons"), "org.gnome.settings-daemon.peripherals.mouse", "middle-button-enabled", None), True)

        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("Pointer Speed"))
        title.set_alignment(0,0)
        sidePage.add_widget(title, None)

        slider = GSettingsRange(_("Acceleration:"), _("Slow"), _("Fast"), 1.0, 10.0, False, "double", False, "org.gnome.settings-daemon.peripherals.mouse", "motion-acceleration", None, adjustment_step = 1.0)
        sidePage.add_widget(slider, None)

        slider = GSettingsRange(_("Sensitivity:"), _("Low"), _("High"), 1, 10, False, "int", False, "org.gnome.settings-daemon.peripherals.mouse", "motion-threshold", None, adjustment_step = 1)
        sidePage.add_widget(slider, None) 

        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("Double-Click Timeout"))
        title.set_alignment(0,0)
        sidePage.add_widget(title, None)

        slider = GSettingsRange(_("Timeout:"), _("Short"), _("Long"), 100, 1000, False, "int", False, "org.gnome.settings-daemon.peripherals.mouse", "double-click", None, adjustment_step = 1)
        sidePage.add_widget(slider, None)

        sidePage.add_widget(GSettingsSpinButton(_("Cinnamon drag threshold"), "org.cinnamon", "dnd-drag-threshold", None, 1, 400, 1, 1, _("Pixels")), True)
        sidePage.add_widget(GSettingsSpinButton(_("GTK drag threshold"), "org.gnome.settings-daemon.peripherals.mouse", "drag-threshold", None, 1, 400, 1, 1, _("Pixels")), True)

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
