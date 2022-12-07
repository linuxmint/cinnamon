#!/usr/bin/python3

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *


class Module:
    name = "tiling"
    comment = _("Manage window tiling preferences")
    category = "prefs"

    def __init__(self, content_box):
        keywords = _("window, tile, flip, tiling, snap, snapping")
        sidePage = SidePage(_("Window Tiling"), "cs-tiling", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Tiling module")

            page = SettingsPage()
            self.sidePage.add_widget(page)

            switch = GSettingsSwitch("", "org.cinnamon.muffin", "edge-tiling")
            switch.fill_row()
            switch.label.set_markup("<b>%s</b>" % _("Enable Window Tiling and Snapping"))
            page.add(switch)

            settings = page.add_reveal_section(_("Preferences"), "org.cinnamon.muffin", "edge-tiling")

            settings.add_row(GSettingsSwitch(_("Maximize, instead of tile, when dragging a window to the top edge"), "org.cinnamon.muffin", "tile-maximize"))

