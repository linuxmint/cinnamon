#!/usr/bin/env python

from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("notifications")
        advanced = True
        sidePage = SidePage(_("Notifications"), "general.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "notifications"
        self.category = "prefs"
        sidePage.add_widget(GSettingsCheckButton(_("Display notifications"), "org.cinnamon", "display-notifications", None))
        sidePage.add_widget(GSettingsCheckButton(_("Notifications fade out"), "org.cinnamon.desktop.notifications", "fade-on-mouseover", None))
