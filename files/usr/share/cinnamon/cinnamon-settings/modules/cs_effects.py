#!/usr/bin/python3

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

SCHEMA = "org.cinnamon"

class Module:
    name = "effects"
    category = "appear"
    comment = _("Control Cinnamon visual effects.")

    def __init__(self, content_box):
        keywords = _("effects, window")
        sidePage = SidePage(_("Effects"), "cs-desktop-effects", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Effects module")

            page = SettingsPage()
            self.sidePage.add_widget(page)

            self.schema = Gio.Settings(SCHEMA)

            settings = page.add_section(_("Enable Effects"))

            widget = GSettingsSwitch(_("Window effects"), "org.cinnamon", "desktop-effects")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Fade effect on Cinnamon scrollboxes (like the Menu application list)"), "org.cinnamon", "enable-vfade")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Session startup animation"), "org.cinnamon", "startup-animation")
            settings.add_row(widget)
