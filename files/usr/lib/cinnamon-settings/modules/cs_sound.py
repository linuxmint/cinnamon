#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import Gtk

class Module:
    def __init__(self, content_box):
        keywords =_("sound, speakers, headphones, test")
        sidePage = SidePage(_("Sound"), "cs-sound", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "sound"
        self.comment = _("Manage sound settings")
        self.category = "hardware"

    def on_module_selected(self, switch_container):
        if not self.loaded:
            print "Loading Sound module"
            
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            self.sidePage.add_widget(vbox)

            try:
                widget = self.sidePage.content_box.c_manager.get_c_widget("sound")
            except Exception, detail:
                print detail

            if widget is not None:
                switcher = self.get_switch_child(widget)
                switcher.reparent(switch_container)
                switcher.set_halign(Gtk.Align.CENTER)
                switch_container.set_child_packing(switcher, True, True, 0, 0)

                vbox.add(widget)

    def get_switch_child(self, widget):
        for child in widget.get_children():
            for next_child in child.get_children():
                if isinstance(next_child, Gtk.StackSwitcher):
                    return next_child