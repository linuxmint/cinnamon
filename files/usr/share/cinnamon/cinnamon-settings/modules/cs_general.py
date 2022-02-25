#!/usr/bin/python3

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *


class Module:
    name = "general"
    comment = _("Miscellaneous Cinnamon preferences")
    category = "prefs"

    def __init__(self, content_box):
        keywords = _("logging, click")
        sidePage = SidePage(_("General"), "cs-general", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print("Loading General module")

            page = SettingsPage()
            self.sidePage.add_widget(page)

            settings = page.add_section(_("Compositor Options"))

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            switch = GSettingsSwitch(_("Disable compositing for full-screen windows"), "org.cinnamon.muffin", "unredirect-fullscreen-windows")
            switch.set_tooltip_text(_("Select this option to let full-screen applications skip the compositing manager and run at maximum speed. Unselect it if you're experiencing screen-tearing in full screen mode."))
            settings.add_row(switch)

            settings = page.add_section(_("Miscellaneous Options"))

            switch = GSettingsSwitch(_("Enable timer when logging out or shutting down"), "org.cinnamon.SessionManager", "quit-delay-toggle")
            settings.add_row(switch)

            spin = GSettingsSpinButton(_("Timer delay"), "org.cinnamon.SessionManager", "quit-time-delay", _("seconds"), 0, 36000, 1, 60)
            settings.add_reveal_row(spin, "org.cinnamon.SessionManager", "quit-delay-toggle")

            settings = page.add_section(_("Memory limit"))

            switch = GSettingsSwitch(_("Restart Cinnamon when it uses too much memory"), "org.cinnamon.launcher", "memory-limit-enabled")
            settings.add_row(switch)

            spin = GSettingsSpinButton(_("Memory limit"), "org.cinnamon.launcher", "memory-limit", _("MB"), 1024, 36000, 1, 100)
            settings.add_reveal_row(spin, "org.cinnamon.launcher", "memory-limit-enabled")

            spin = GSettingsSpinButton(_("Check frequency"), "org.cinnamon.launcher", "check-frequency", _("seconds"), 1, 86400, 1, 60)
            settings.add_reveal_row(spin, "org.cinnamon.launcher", "memory-limit-enabled")
