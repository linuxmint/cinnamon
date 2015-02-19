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
        sidePage = SidePage(_("Power Management"), "cs-power", keywords, content_box, is_c_mod=True, module=self)
        self.sidePage = sidePage
        self.name = "power"
        self.category = "hardware"
        self.comment = _("Manage power settings")

    def on_module_selected(self, switch_container):
        if not self.loaded:
            print "Loading Power module"
            try:
                widget = self.sidePage.content_box.c_manager.get_c_widget("power")
            except:
                widget = None

            if widget is not None:  
                widget.set_no_show_all(True)
                widget.show()
                self.sidePage.add_widget(widget)
            
            primary_output = None
            try:              
                screen = CinnamonDesktop.RRScreen.new(Gdk.Screen.get_default())
                outputs = CinnamonDesktop.RRScreen.list_outputs(screen)
                for output in outputs:
                    if (output.is_connected() and output.is_laptop() and output.get_backlight_min() >= 0 and output.get_backlight_max() > 0):
                        primary_output = output
                        break
            except Exception, detail:
                print "Failed to query backlight information in cs_power module: %s" % detail

            if primary_output is not None:
                try:
                    widget = self.sidePage.content_box.c_manager.get_c_widget("screen")
                except:
                    widget = None
                if widget is not None:
                    frame_label = Gtk.Label()
                    frame_label.set_markup("<b>%s</b>" % _("Screen Brightness"))
                    frame = Gtk.Frame()
                    frame.set_label_widget(frame_label)
                    frame.set_shadow_type(Gtk.ShadowType.NONE)
                    frame.set_border_width(6)

                    vbox = Gtk.VBox()
                    vbox.set_spacing(8)
                    vbox.set_margin_top(6)
                    vbox.set_margin_left(53)
                    vbox.set_margin_right(60)

                    alignment = Gtk.Alignment()
                    alignment.set_margin_left(12)

                    alignment.add(vbox)
                    frame.add(alignment)
                    self.sidePage.add_widget(frame)

                    widget.set_tooltip_text(_("Sets the brightness level of the screen"))
                    vbox.pack_start(widget, False, False, 0)
                    widget.show()
                
                    box = Gtk.HBox()
                    box.set_spacing(6)

                    widget = GSettingsCheckButton(_("On battery, dim screen to"), "org.cinnamon.settings-daemon.plugins.power", "idle-dim-battery", None)
                    widget.set_tooltip_text(_("Save battery power by reducing the brightness of the screen when inactive"))
                    box.pack_start(widget, False, False, 0)

                    widget = GSettingsIntComboBox("", "org.cinnamon.settings-daemon.plugins.power", "idle-brightness", "org.cinnamon.settings-daemon.plugins.power/idle-dim-battery", IDLE_BRIGHTNESS_OPTIONS)
                    widget.set_tooltip_text(_("Save battery power by reducing the brightness of the screen when inactive"))
                    box.pack_start(widget, False, False, 0)

                    widget = Gtk.Label.new(_("after"))
                    widget.set_tooltip_text(_("Save battery power by reducing the brightness of the screen when inactive"))
                    box.pack_start(widget, False, False, 0)

                    widget = GSettingsIntComboBox("", "org.cinnamon.settings-daemon.plugins.power", "idle-dim-time", "org.cinnamon.settings-daemon.plugins.power/idle-dim-battery", IDLE_DELAY_OPTIONS)
                    widget.set_tooltip_text(_("Save battery power by reducing the brightness of the screen when inactive"))
                    box.pack_start(widget, False, False, 0)

                    vbox.pack_start(box, False, False, 0)
                    frame.show_all()

                
