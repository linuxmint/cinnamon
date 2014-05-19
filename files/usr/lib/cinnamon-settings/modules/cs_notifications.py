#!/usr/bin/env python

from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("notifications")
        sidePage = SidePage(_("Notifications"), "cs-notifications", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "notifications"
        self.comment = _("Notification preferences")
        self.category = "prefs"

    def on_module_selected(self):
        if self.loaded:
            return

        print "Loading notifications module"

        bg = SectionBg()
        self.sidePage.add_widget(bg)

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        bg.add(vbox)
            
        section = Section(_("Behaviour"))
        section.add(GSettingsCheckButton(_("Display notifications"), "org.cinnamon", "display-notifications", None))
        section.add(GSettingsCheckButton(_("Notifications fade out"), "org.cinnamon.desktop.notifications", "fade-on-mouseover", None))
        section.add(GSettingsCheckButton(_("Remove old notifications"), "org.cinnamon.desktop.notifications", "remove-old", None))
        vbox.add(section)

