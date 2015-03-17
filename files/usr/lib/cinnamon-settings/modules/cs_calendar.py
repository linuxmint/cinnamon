#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import Gtk

class Module:
    def __init__(self, content_box):
        keywords = _("time, date, calendar, format, network, sync")
        sidePage = SidePage(_("Date & Time"), "cs-date-time", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "calendar"
        self.comment = _("Manage date and time settings")
        self.category = "prefs"        
                
    def on_module_selected(self, switch_container):
        if not self.loaded:
            print "Loading Calendar module"
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            self.sidePage.add_widget(vbox)

            try:
                section = Section(_("Date Settings"))
                widget = self.sidePage.content_box.c_manager.get_c_widget("datetime")
                section.add_expand(widget)            
                vbox.add(section)
                vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))
            except Exception, detail:
                print detail            

            section = Section(_("Date Format"))
            section.add(GSettingsCheckButton(_("Use 24h clock"), "org.cinnamon.desktop.interface", "clock-use-24h", None))
            section.add(GSettingsCheckButton(_("Display the date"), "org.cinnamon.desktop.interface", "clock-show-date", None))
            section.add(GSettingsCheckButton(_("Display seconds"), "org.cinnamon.desktop.interface", "clock-show-seconds", None))        
            vbox.add(section)
