#!/usr/bin/env python

import os
from SettingsWidgets import *
import gi
from gi.repository import CinnamonDesktop, Gdk

POWER_BUTTON_OPTIONS = [
    ("blank", _("Lock the screen")),
    ("suspend", _("Suspend")),
    ("shutdown", _("Shutdown immediately")),
    ("hibernate", _("Hibernate")),
    ("interactive", _("Ask what to do")),
    ("nothing", _("Do nothing"))
]

IDLE_BRIGHTNESS_OPTIONS = [
    (0, _("0%")),
    (5, _("5%")),
    (10, _("10%")),
    (30, _("30%")),
    (50, _("50%")),
    (75, _("75%"))
]

IDLE_DELAY_OPTIONS = [
    (30, _("30 seconds")),
    (60, _("60 seconds")),
    (90, _("90 seconds")),
    (120, _("2 minutes")),
    (300, _("5 minutes")),
    (600, _("10 minutes"))
]

class Module:
    def __init__(self, content_box):
        keywords = _("power, suspend, hibernate, laptop, desktop, brightness, screensaver")
        advanced = False
        sidePage = SidePage(_("Power Management"), "power.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "power"
        self.category = "hardware"
        self.comment = _("Manage power settings")
        
        frame_label = Gtk.Label()
        frame_label.set_markup("<b>%s</b>" % _("Power options"))
        frame = Gtk.Frame()
        frame.set_label_widget(frame_label)
        frame.set_shadow_type(Gtk.ShadowType.NONE)
        vbox = Gtk.VBox()
        frame.add(vbox) 
        

        try:
            widget = content_box.c_manager.get_c_widget("power")
        except:
            widget = None

        if widget is not None:
            vbox.pack_start(widget, False, False, 2)
            vbox.set_vexpand(False)           
            widget.set_no_show_all(True)
            widget.show()
            self.sidePage.add_widget(frame)

        try:
            widget = content_box.c_manager.get_c_widget("screen")
        except:
            widget = None
        if widget is not None:
            cheat_box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
            cheat_box.pack_start(widget, False, False, 2)
            cheat_box.set_vexpand(False)
            widget.set_no_show_all(True)
            widget.show()
            self.sidePage.add_widget(cheat_box)
    
            max_backlight = 0
            try:              
                screen = CinnamonDesktop.RRScreen.new(Gdk.Screen.get_default())
                outputs = CinnamonDesktop.RRScreen.list_outputs(screen)
                for output in outputs:
                    max_backlight = max_backlight + CinnamonDesktop.RROutput.get_backlight_max(output)
            except Exception, detail:
                print "Failed to query backlight information in cs_power module: %s" % detail

            if max_backlight > 0:
                cheat_box.pack_start(GSettingsCheckButton(_("Dim screen to save power"), "org.cinnamon.settings-daemon.plugins.power", "idle-dim-battery", None), False, False, 2)
                cheat_box.pack_start(GSettingsIntComboBox(_("Idle brightness"), "org.cinnamon.settings-daemon.plugins.power", "idle-brightness", "org.cinnamon.settings-daemon.plugins.power/idle-dim-battery", IDLE_BRIGHTNESS_OPTIONS), False, False, 2)
                cheat_box.pack_start(GSettingsIntComboBox(_("Idle delay"), "org.cinnamon.settings-daemon.plugins.power", "idle-dim-time", "org.cinnamon.settings-daemon.plugins.power/idle-dim-battery", IDLE_DELAY_OPTIONS), False, False, 2)
    