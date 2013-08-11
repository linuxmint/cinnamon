#!/usr/bin/env python

from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("menu, start, bookmarks, places, recent")
        advanced = False
        sidePage = SidePage(_("Menu"), "menu.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "menu"
        self.category = "prefs"
        
        
        sidePage.add_widget(GSettingsFileChooser(_("Icon"), "org.cinnamon", "menu-icon", None, True))
        sidePage.add_widget(GSettingsEntry(_("Text"), "org.cinnamon", "menu-text", None))
                
        sidePage.add_widget(GSettingsCheckButton(_("Show bookmarks and places"), "org.cinnamon", "menu-show-places", None))
        sidePage.add_widget(GSettingsCheckButton(_("Show recent files"), "org.cinnamon", "menu-show-recent", None))
        sidePage.add_widget(GSettingsCheckButton(_("Enable auto-scrolling in application list"), "org.cinnamon", "menu-enable-autoscroll", None))
                
        sidePage.add_widget(GSettingsCheckButton(_("Open menu when I move my mouse over it"), "org.cinnamon", "activate-menu-applet-on-hover", None), True)
        sidePage.add_widget(GSettingsCheckButton(_("Enable filesystem path entry in search box"), "org.cinnamon", "menu-search-filesystem", None), True)
        sidePage.add_widget(GSettingsSpinButton(_("Menu hover delay"), "org.cinnamon", "menu-hover-delay", None, 0, 2000, 50, 200, _("milliseconds")), True)



