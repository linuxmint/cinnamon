#!/usr/bin/env python

from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        sidePage = SidePage(_("General"), "general.svg", content_box)
        self.sidePage = sidePage
        self.name = "general"
        self.category = "prefs"
        sidePage.add_widget(GSettingsCheckButton(_("Log LookingGlass output to ~/.cinnamon/glass.log (Requires Cinnamon restart)"), "org.cinnamon", "enable-looking-glass-logs", None))
        sidePage.add_widget(GSettingsCheckButton(_("Emulate middle click by clicking both left and right buttons"), "org.gnome.settings-daemon.peripherals.mouse", "middle-button-enabled", None))
        sidePage.add_widget(GSettingsCheckButton(_("Display notifications"), "org.cinnamon", "display-notifications", None))

