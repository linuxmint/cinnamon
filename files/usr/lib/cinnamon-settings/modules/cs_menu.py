#!/usr/bin/env python

from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        sidePage = SidePage(_("Menu"), "menu.svg", content_box)
        self.sidePage = sidePage
        self.name = "menu"
        sidePage.add_widget(GSettingsEntry(_("Menu text"), "org.cinnamon", "menu-text", None))
        sidePage.add_widget(GSettingsFileChooser(_("Menu icon"), "org.cinnamon", "menu-icon", None, True))
        sidePage.add_widget(GSettingsSpinButton(_("Menu hover delay"), "org.cinnamon", "menu-hover-delay", None, 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(GSettingsCheckButton(_("Activate menu on hover"), "org.cinnamon", "activate-menu-applet-on-hover", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show bookmarks and places"), "org.cinnamon", "menu-show-places", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show recent files"), "org.cinnamon", "menu-show-recent", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show favorites"), "org.cinnamon", "menu-show-favorites", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show system buttons"), "org.cinnamon", "menu-show-system-buttons", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show app-info title"), "org.cinnamon", "menu-show-appinfo-title", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show app-info description"), "org.cinnamon", "menu-show-appinfo-description", None))
        sidePage.add_widget(GSettingsCheckButton(_("Use multiple lines for app-info description"), "org.cinnamon", "menu-use-multiline-appinfo", None))
        sidePage.add_widget(GSettingsCheckButton(_("Align app-info right"), "org.cinnamon", "menu-align-appinfo-right", None))
        sidePage.add_widget(GSettingsCheckButton(_("Flip searchbox and app-info"), "org.cinnamon", "menu-flip-search-appinfo", None))