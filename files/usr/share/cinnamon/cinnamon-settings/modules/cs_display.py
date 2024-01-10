#!/usr/bin/python3

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

FRACTIONAL_ENABLE_OPTIONS = ["scale-monitor-framebuffer", "x11-randr-fractional-scaling"]

class Module:
    name = "display"
    comment = _("Manage display settings")
    category = "hardware"

    def __init__(self, content_box):
        keywords = _("display, screen, monitor, layout, resolution, dual, lcd")
        self.sidePage = SidePage(_("Display"), "cs-display", keywords, content_box, 650, module=self)
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
                widget.get_parent().set_activatable(False)

            except Exception as detail:
                print(detail)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "settings", _("Settings"))
            settings = page.add_section(_("Settings"))

            switch = GSettingsSwitch(_("Disable automatic screen rotation"), "org.cinnamon.settings-daemon.peripherals.touchscreen", "orientation-lock")
            switch.set_tooltip_text(_("Select this option to disable automatic screen rotation on hardware equipped with supported accelerometers."))
            settings.add_row(switch)

            switch = Switch(_("Enable fractional scaling controls (experimental)"))
            switch.set_tooltip_text(_("Select this option to display additional layout controls for per-monitor scaling."))
            settings.add_row(switch)
            self.fractional_switch = switch.content_widget

            self.muffin_settings = Gio.Settings(schema_id="org.cinnamon.muffin")
            self.experimental_features_changed(self.muffin_settings, "x11-randr-fractional-scaling")
            self.muffin_settings.connect("changed::experimental-features", self.experimental_features_changed)
            self.fractional_switch.connect("notify::active", self.fractional_switch_toggled)

    def experimental_features_changed(self, settings, key):
        self.fractional_switch.freeze_notify()

        features = self.muffin_settings.get_strv("experimental-features")
        self.fractional_switch.set_active(set(FRACTIONAL_ENABLE_OPTIONS).issubset(features))

        self.fractional_switch.thaw_notify()

    def fractional_switch_toggled(self, switch, pspec):
        active = switch.get_active()
        features = self.muffin_settings.get_strv("experimental-features")

        for enabler in FRACTIONAL_ENABLE_OPTIONS:
            try:
                while True:
                    features.remove(enabler)
            except ValueError:
                pass

        if active:
            features.extend(FRACTIONAL_ENABLE_OPTIONS)

        self.muffin_settings.set_strv("experimental-features", features)

    def on_navigate_out_of_module(self):
        if self.display_c_widget:
            self.display_c_widget.hide()