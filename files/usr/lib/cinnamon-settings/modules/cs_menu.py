#!/usr/bin/env python

from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("menu, start, bookmarks, places, recent")
        tooltip = _("Configure menu applet behavior")
        advanced = False
        sidePage = SidePage(_("Menu"), "menu.svg", keywords, tooltip, advanced, content_box)
        self.sidePage = sidePage
        self.name = "menu"
        self.category = "prefs"
        sidePage.add_widget(GSettingsEntry(_("Menu text"), "org.cinnamon", "menu-text", None))
        sidePage.add_widget(GSettingsFileChooser(_("Menu icon"), "org.cinnamon", "menu-icon", None, True))
        sidePage.add_widget(GSettingsSpinButton(_("Menu hover delay"), "org.cinnamon", "menu-hover-delay", None, 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(GSettingsCheckButton(_("Activate menu on hover"), "org.cinnamon", "activate-menu-applet-on-hover", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show bookmarks and places"), "org.cinnamon", "menu-show-places", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show recent files"), "org.cinnamon", "menu-show-recent", None))
        sidePage.add_widget(GSettingsCheckButton(_("Enable filesystem path entry in search box"), "org.cinnamon", "menu-search-filesystem", None))
