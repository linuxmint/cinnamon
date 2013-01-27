#!/usr/bin/env python

import os
from gi.repository import Gtk
from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        sidePage = SidePage(_("Mouse and Touchpad"), "mouse.svg", content_box)
        self.sidePage = sidePage
        self.name = "mouse"
        self.category = "prefs"
        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("General"))
        title.set_alignment(0,0)
        sidePage.add_widget(title)    
        sidePage.add_widget(GSettingsCheckButton(_("Left handed (mouse buttons inverted)"), "org.gnome.settings-daemon.peripherals.mouse", "left-handed", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show position of pointer when the Control key is pressed"), "org.gnome.settings-daemon.peripherals.mouse", "locate-pointer", None))        

        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("Pointer Speed"))
        title.set_alignment(0,0)
        sidePage.add_widget(title)    
        
        slider = GSettingsRange(_("Acceleration:"), _("Slow"), _("Fast"), 1.0, 10.0, False, "double", False, "org.gnome.settings-daemon.peripherals.mouse", "motion-acceleration", None, adjustment_step = 1.0)
        sidePage.add_widget(slider) 
        
        slider = GSettingsRange(_("Sensitivity:"), _("Low"), _("High"), 1, 10, False, "int", False, "org.gnome.settings-daemon.peripherals.mouse", "motion-threshold", None, adjustment_step = 1)
        sidePage.add_widget(slider) 
        
        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("Drag and Drop"))
        title.set_alignment(0,0)
        sidePage.add_widget(title)    
        
        slider = GSettingsRange(_("Treshold:"), _("Small"), _("Large"), 1, 10, False, "int", False, "org.gnome.settings-daemon.peripherals.mouse", "drag-threshold", None, adjustment_step = 1)
        sidePage.add_widget(slider) 
        
        title = Gtk.Label()
        title.set_markup("<b>%s</b>" % _("Double-Click Timeout"))
        title.set_alignment(0,0)
        sidePage.add_widget(title)  
        
        slider = GSettingsRange(_("Timeout:"), _("Short"), _("Long"), 100, 1000, False, "int", False, "org.gnome.settings-daemon.peripherals.mouse", "double-click", None, adjustment_step = 1)
        sidePage.add_widget(slider)   


