#!/usr/bin/env python

from gi.repository import Gio
import settings
from settings import *

class Module:
    def __init__(self, content_box):
        if 'org.nemo' in Gio.Settings.list_schemas():
            nemo_desktop_schema = Gio.Settings.new("org.nemo.desktop")
            nemo_desktop_keys = nemo_desktop_schema.list_keys()
            sidePage = SidePage(_("Desktop"), "desktop.svg", content_box)
            self.sidePage = sidePage
            sidePage.add_widget(GSettingsCheckButton(_("Have file manager (Nemo) handle the desktop"), "org.gnome.desktop.background", "show-desktop-icons", None))
            if "computer-icon-visible" in nemo_desktop_keys:
                box = IndentedHBox()
                box.add(GSettingsCheckButton(_("Computer icon visible on desktop"), "org.nemo.desktop", "computer-icon-visible", "org.gnome.desktop.background/show-desktop-icons"))
                sidePage.add_widget(box)
            if "home-icon-visible" in nemo_desktop_keys:
                box = IndentedHBox()
                box.add(GSettingsCheckButton(_("Home icon visible on desktop"), "org.nemo.desktop", "home-icon-visible", "org.gnome.desktop.background/show-desktop-icons"))
                sidePage.add_widget(box)
            if "network-icon-visible" in nemo_desktop_keys:
                box = IndentedHBox()
                box.add(GSettingsCheckButton(_("Network Servers icon visible on desktop"), "org.nemo.desktop", "network-icon-visible", "org.gnome.desktop.background/show-desktop-icons"))
                sidePage.add_widget(box)
            if "trash-icon-visible" in nemo_desktop_keys:
                box = IndentedHBox()
                box.add(GSettingsCheckButton(_("Trash icon visible on desktop"), "org.nemo.desktop", "trash-icon-visible", "org.gnome.desktop.background/show-desktop-icons"))
                sidePage.add_widget(box)
            if "volumes-visible" in nemo_desktop_keys:
                box = IndentedHBox()
                box.add(GSettingsCheckButton(_("Show mounted volumes on the desktop"), "org.nemo.desktop", "volumes-visible", "org.gnome.desktop.background/show-desktop-icons"))
                sidePage.add_widget(box)
