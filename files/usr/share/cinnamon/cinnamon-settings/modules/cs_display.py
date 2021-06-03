#!/usr/bin/python3

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

class Module:
    name = "display"
    comment = _("Manage display settings")
    category = "hardware"

    def __init__(self, content_box):
        keywords = _("display, screen, monitor, layout, resolution, dual, lcd")
        self.sidePage = SidePage(_("Display"), "cs-display", keywords, content_box, 570, module=self)
        self.display_c_widget = None

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
                widget.set_border_width(0)
                widget.set_margin_start(0)
                widget.set_margin_end(0)

                content = self.sidePage.content_box.c_manager.get_c_widget("display")
                widget.pack_start(content, True, True, 0)

                self.display_c_widget = content
                settings.add_row(widget)

            except Exception as detail:
                print(detail)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "settings", _("Settings"))
            settings = page.add_section(_("Settings"))

            switch = GSettingsSwitch(_("Disable automatic screen rotation"), "org.cinnamon.settings-daemon.peripherals.touchscreen", "orientation-lock")
            switch.set_tooltip_text(_("Select this option to disable automatic screen rotation on hardware equipped with supported accelerometers."))
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Enable fractional scaling controls (experimental)"), "org.cinnamon.control-center.display", "show-fractional-scaling-controls")
            switch.set_tooltip_text(_("Select this option to display additional layout controls for per-monitor scaling."))
            settings.add_row(switch)

    def on_navigate_out_of_module(self):
        if self.display_c_widget:
            self.display_c_widget.hide()