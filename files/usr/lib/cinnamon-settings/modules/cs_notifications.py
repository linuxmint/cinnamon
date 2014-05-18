#!/usr/bin/env python

from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("notifications")
        advanced = True
        sidePage = SidePage(_("Notifications"), "se_general", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "notifications"
        self.category = "prefs"

    def on_module_selected(self):
        if self.loaded:
            return
        print "Loading notifications module"

        sidePage.add_widget(GSettingsCheckButton(_("Display notifications"), "org.cinnamon", "display-notifications", None))
        sidePage.add_widget(GSettingsCheckButton(_("Notifications fade out"), "org.cinnamon.desktop.notifications", "fade-on-mouseover", None))
        sidePage.add_widget(GSettingsCheckButton(_("Remove old notifications"), "org.cinnamon.desktop.notifications", "remove-old", None))
