#!/usr/bin/env python

import os
from gi.repository import Gtk, Gdk, GLib
from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("mouse, touchpad, synaptic, double-click")
        sidePage = SidePage(_("Mouse and Touchpad"), "cs-mouse", keywords, content_box, 500, module=self)
        self.sidePage = sidePage
        self.comment = _("Control mouse and touchpad settings")
        self.name = "mouse"
        self.category = "hardware"

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Mouse module"

            self.tabs = []
            self.mousebox = Gtk.VBox()
            self.touchbox = Gtk.VBox()

            self.notebook = Gtk.Notebook()

            mouse = Gtk.ScrolledWindow()
            mouse.add_with_viewport(self.mousebox)

            touch = Gtk.ScrolledWindow()
            touch.add_with_viewport(self.touchbox)
            
            self.notebook.append_page(mouse, Gtk.Label.new(_("Mouse")))
            self.notebook.append_page(touch, Gtk.Label.new(_("Touchpad")))
            self.notebook.expand = True

            # Mouse

            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)

            section = Section(_("General"))  
            section.add(GSettingsCheckButton(_("Left handed (mouse buttons inverted)"), "org.cinnamon.settings-daemon.peripherals.mouse", "left-handed", None))
            section.add(GSettingsCheckButton(_("Show position of pointer when the Control key is pressed"), "org.cinnamon.settings-daemon.peripherals.mouse", "locate-pointer", None))
            section.add(GSettingsCheckButton(_("Emulate middle click by clicking both left and right buttons"), "org.cinnamon.settings-daemon.peripherals.mouse", "middle-button-enabled", None))            
            vbox.add(section)
            
            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

            section = Section(_("Pointer Size"))  
            widget = Gtk.Label()
            widget.set_markup("<i><small>%s</small></i>" % _("Note: All sizes may not be available on certain icon themes"))            
            section.add(widget)
            widget = GSettingsRange(_("Size:"), _("Smaller"), _("Larger"), 5, 50, False, "int", False, "org.cinnamon.desktop.interface", "cursor-size", None, adjustment_step = 1.0)
            widget.add_mark(24.0, Gtk.PositionType.TOP, None)
            section.add_expand(widget)            
            vbox.add(section)
            
            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))         
            
            section = Section(_("Pointer Speed"))  
            section.add_expand(GSettingsRange(_("Acceleration:"), _("Slow"), _("Fast"), 1.0, 10.0, False, "double", False, "org.cinnamon.settings-daemon.peripherals.mouse", "motion-acceleration", None, adjustment_step = 1.0))            
            section.add_expand(GSettingsRange(_("Sensitivity:"), _("Low"), _("High"), 1, 10, False, "int", False, "org.cinnamon.settings-daemon.peripherals.mouse", "motion-threshold", None, adjustment_step = 1))
            vbox.add(section)

            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))         

            section = Section(_("Double-Click Timeout"))  
            section.add_expand(GSettingsRange(_("Timeout:"), _("Short"), _("Long"), 100, 1000, False, "int", False, "org.cinnamon.settings-daemon.peripherals.mouse", "double-click", None, adjustment_step = 1))
            widget = Gtk.Button.new_with_label(_("Double-click test"))
            widget.connect("button-press-event", self.test_button_clicked)
            section.add(widget)
            vbox.add(section)

            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))         

            section = Section(_("Drag and drop"))  
            section.add(GSettingsSpinButton(_("Cinnamon drag threshold"), "org.cinnamon", "dnd-drag-threshold", None, 1, 400, 1, 1, _("Pixels")))
            section.add(GSettingsSpinButton(_("GTK drag threshold"), "org.cinnamon.settings-daemon.peripherals.mouse", "drag-threshold", None, 1, 400, 1, 1, _("Pixels")))
            vbox.add(section)            
    
            self.mousebox.pack_start(vbox, False, False, 2)

            # Touchpad

            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)

            section = Section(_("General"))  
            section.add(GSettingsCheckButton(_("Enable touchpad"), "org.cinnamon.settings-daemon.peripherals.touchpad", "touchpad-enabled", None))
            section.add(GSettingsCheckButton(_("Disable touchpad while typing"), "org.cinnamon.settings-daemon.peripherals.touchpad", "disable-while-typing", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled"))
            section.add(GSettingsCheckButton(_("Enable mouseclicks with touchpad"), "org.cinnamon.settings-daemon.peripherals.touchpad", "tap-to-click", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled"))   
            vbox.add(section)
            
            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

            section = Section(_("Scrolling"))  
            scroll_method = [["disabled", _("Disabled")], ["edge-scrolling", _("Edge Scrolling")], ["two-finger-scrolling", _("Two-finger scrolling")]]
            scroll_method_combo = GSettingsComboBox(_("Panel layout"), "org.cinnamon.settings-daemon.peripherals.touchpad", "scroll-method", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled", scroll_method)
            section.add(scroll_method_combo)
            section.add(GSettingsCheckButton(_("Enable natural scrolling"), "org.cinnamon.settings-daemon.peripherals.touchpad", "natural-scroll", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled"))
            section.add(GSettingsCheckButton(_("Enable horizontal scrolling"), "org.cinnamon.settings-daemon.peripherals.touchpad", "horiz-scroll-enabled", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled"))            
            vbox.add(section)
            
            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

            section = Section(_("Pointer Speed"))  
            section.add_expand(GSettingsRange(_("Acceleration:"), _("Slow"), _("Fast"), 1.0, 10.0, False, "double", False, "org.cinnamon.settings-daemon.peripherals.touchpad", "motion-acceleration", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled", adjustment_step = 1.0))
            section.add_expand(GSettingsRange(_("Sensitivity:"), _("Low"), _("High"), 1, 10, False, "int", False, "org.cinnamon.settings-daemon.peripherals.touchpad", "motion-threshold", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled", adjustment_step = 1))
            vbox.add(section)                            
            
            self.touchbox.pack_start(vbox, False, False, 2)                

            self.sidePage.add_widget(self.notebook)            

    def test_button_clicked(self, widget, event):
        if event.type == Gdk.EventType._2BUTTON_PRESS:
            widget.set_label(_("Clicked!"))
            GLib.timeout_add(1000, self.reset_test_button, widget)
        return True

    def reset_test_button(self, widget):
        widget.set_label(_("Double-click test"))
        return False

