#!/usr/bin/env python

from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("logging, click, notifications")
        advanced = True
        sidePage = SidePage(_("General"), "cs-general", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "general"
        self.comment = _("Miscellaneous Cinnamon preferences")
        self.category = "prefs"
        sidePage.add_widget(GSettingsCheckButton(_("Log LookingGlass output to ~/.cinnamon/glass.log (Requires Cinnamon restart)"), "org.cinnamon", "enable-looking-glass-logs", None), True)
        sidePage.add_widget(GSettingsCheckButton(_("Display notifications"), "org.cinnamon", "display-notifications", None))

        ui_scales = [[0, _("Auto")], [1, _("Normal")], [2, _("Double (Hi-DPI)")]]        
        combo = GSettingsUIntComboBox(_("User interface scaling:"), "org.cinnamon.desktop.interface", "scaling-factor", ui_scales)
        sidePage.add_widget(combo) 