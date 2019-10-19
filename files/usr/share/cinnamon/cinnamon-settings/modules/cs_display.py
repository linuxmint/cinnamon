#!/usr/bin/python3

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

class Module:
    name = "display"
    comment = _("Manage display settings")
    category = "hardware"

    def __init__(self, content_box):
        keywords = _("display, screen, monitor, layout, resolution, dual, lcd")
        self.sidePage = SidePage(_("Display"), "cs-display", keywords, content_box, module=self)

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Display module")

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "layout", _("Layout"))

            try:
                settings = page.add_section(_("Layout"))
                widget = SettingsWidget()
                content = self.sidePage.content_box.c_manager.get_c_widget("display")
                widget.pack_start(content, True, True, 0)
                settings.add_row(widget)

            except Exception as detail:
                print(detail)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "settings", _("Settings"))
            settings = page.add_section(_("Settings"))

            ui_scales = [[0, _("Auto")], [1, _("Normal")], [2, _("Double (Hi-DPI)")]]
            combo = GSettingsComboBox(_("User interface scaling:"), "org.cinnamon.desktop.interface", "scaling-factor", ui_scales, valtype=int)
            settings.add_row(combo)

            switch = GSettingsSwitch(_("Disable automatic screen rotation"), "org.cinnamon.settings-daemon.peripherals.touchscreen", "orientation-lock")
            switch.set_tooltip_text(_("Select this option to disable automatic screen rotation on hardware equipped with supported accelerometers."))
            settings.add_row(switch)
