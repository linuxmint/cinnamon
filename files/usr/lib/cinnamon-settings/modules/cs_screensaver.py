#!/usr/bin/env python

import os
from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        sidePage = SidePage(_("Screensaver"), "screensaver.svg", content_box)
        self.sidePage = sidePage
        self.name = "screensaver"
        self.category = "prefs"
        if os.path.exists("/usr/bin/cinnamon-screensaver-command"):
            sidePage.add_widget(GSettingsCheckButton(_("Ask for an away message when locking the screen from the menu"), "org.cinnamon.screensaver", "ask-for-away-message", None))
            sidePage.add_widget(GSettingsEntry(_("Default message"), "org.cinnamon.screensaver", "default-message", None))

