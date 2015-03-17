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

    def on_module_selected(self, switch_container):
        if not self.loaded:
            print "Loading Mouse module"

            stack = SettingsStack()
            self.sidePage.add_widget(stack)

            self.stack_switcher = Gtk.StackSwitcher()
            self.stack_switcher.set_halign(Gtk.Align.CENTER)
            self.stack_switcher.set_stack(stack)
            switch_container.pack_start(self.stack_switcher, True, True, 0)

            # Mouse
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            stack.add_titled(vbox, "mouse", _("Mouse"))

            section = Section(_("General"))  
            section.add(GSettingsCheckButton(_("Left handed (mouse buttons inverted)"), "org.cinnamon.settings-daemon.peripherals.mouse", "left-handed", None))
            section.add(GSettingsCheckButton(_("Show position of pointer when the Control key is pressed"), "org.cinnamon.settings-daemon.peripherals.mouse", "locate-pointer", None))
            section.add(GSettingsCheckButton(_("Emulate middle click by clicking both left and right buttons"), "org.cinnamon.settings-daemon.peripherals.mouse", "middle-button-enabled", None))            
            section.add(GSettingsSpinButton(_("Drag-and-drop threshold"), "org.cinnamon.settings-daemon.peripherals.mouse", "drag-threshold", None, 1, 400, 1, 1, _("Pixels")))

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
            section.add_expand(widget)
            vbox.add(section)

            # Touchpad

            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            stack.add_titled(vbox, "touchpad", _("Touchpad"))

            section = Section(_("General"))  
            section.add(GSettingsCheckButton(_("Enable touchpad"), "org.cinnamon.settings-daemon.peripherals.touchpad", "touchpad-enabled", None))
            section.add(GSettingsCheckButton(_("Tap to click"), "org.cinnamon.settings-daemon.peripherals.touchpad", "tap-to-click", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled"))   
            section.add(GSettingsCheckButton(_("Disable touchpad while typing"), "org.cinnamon.settings-daemon.peripherals.touchpad", "disable-while-typing", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled"))
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

            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
                           
            section = Section(_("Advanced"))
            section.add(Gtk.Label(_("Options for single-button touchpads:")))


            button_list = [[0, _("Disabled")], [1, _("Left button")], [2, _("Middle button")], [3, _("Right button")]]

            section.add_indented(GSettingsIntComboBox(_("Two-finger click emulation:"), "org.cinnamon.settings-daemon.peripherals.touchpad", "two-finger-click", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled", button_list, False))
            section.add_indented(GSettingsIntComboBox(_("Three-finger click emulation:"), "org.cinnamon.settings-daemon.peripherals.touchpad", "three-finger-click", "org.cinnamon.settings-daemon.peripherals.touchpad/touchpad-enabled", button_list, False))

        self.stack_switcher.show()            

    def test_button_clicked(self, widget, event):
        if event.type == Gdk.EventType._2BUTTON_PRESS:
            widget.set_label(_("Success!"))
            GLib.timeout_add(1000, self.reset_test_button, widget)
        return True

    def reset_test_button(self, widget):
        widget.set_label(_("Double-click test"))
        return False
