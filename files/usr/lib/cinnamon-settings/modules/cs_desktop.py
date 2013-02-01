#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import Gio

class Module:
    def __init__(self, content_box):
        keywords = _("desktop, home, button, trash")
        advanced = False
        sidePage = SidePage(_("Desktop"), "desktop.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "desktop"
        self.category = "prefs"

    def _loadCheck(self):
        if 'org.nemo' in Gio.Settings.list_schemas():
            nemo_desktop_schema = Gio.Settings.new("org.nemo.desktop")
            nemo_desktop_keys = nemo_desktop_schema.list_keys()
            if "computer-icon-visible" in nemo_desktop_keys:
                self.sidePage.add_widget(GSettingsCheckButton(_("Computer icon visible on desktop"), "org.nemo.desktop", "computer-icon-visible", None))
            if "home-icon-visible" in nemo_desktop_keys:
                self.sidePage.add_widget(GSettingsCheckButton(_("Home icon visible on desktop"), "org.nemo.desktop", "home-icon-visible", None))
            if "network-icon-visible" in nemo_desktop_keys:
                self.sidePage.add_widget(GSettingsCheckButton(_("Network Servers icon visible on desktop"), "org.nemo.desktop", "network-icon-visible", None))
            if "trash-icon-visible" in nemo_desktop_keys:
                self.sidePage.add_widget(GSettingsCheckButton(_("Trash icon visible on desktop"), "org.nemo.desktop", "trash-icon-visible", None))
            if "volumes-visible" in nemo_desktop_keys:
                self.sidePage.add_widget(GSettingsCheckButton(_("Show mounted volumes on the desktop"), "org.nemo.desktop", "volumes-visible", None))
            return True
        else:
            return False

