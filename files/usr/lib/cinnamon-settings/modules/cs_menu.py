#!/usr/bin/env python

from gi.repository import Gio
import settings
from settings import *

class Module:
    def __init__(self, content_box):
        sidePage = settings.SidePage(_("Menu"), "menu.svg", content_box)
        self.sidePage = sidePage
        sidePage.add_widget(settings.GSettingsEntry(_("Menu text"), "org.cinnamon", "menu-text", None))
        sidePage.add_widget(settings.GSettingsFileChooser(_("Menu icon"), "org.cinnamon", "menu-icon", None, True))
        sidePage.add_widget(settings.GSettingsSpinButton(_("Menu hover delay"), "org.cinnamon", "menu-hover-delay", None, 0, 2000, 50, 200, _("milliseconds")))
        sidePage.add_widget(settings.GSettingsCheckButton(_("Activate menu on hover"), "org.cinnamon", "activate-menu-applet-on-hover", None))
        sidePage.add_widget(settings.GSettingsCheckButton(_("Show bookmarks and places"), "org.cinnamon", "menu-show-places", None))
        sidePage.add_widget(settings.GSettingsCheckButton(_("Show recent files"), "org.cinnamon", "menu-show-recent", None))
