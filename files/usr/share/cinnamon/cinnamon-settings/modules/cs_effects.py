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

            self.schema = Gio.Settings(SCHEMA)

            page = SettingsPage()
            self.sidePage.add_widget(page)

            switch = GSettingsSwitch("", "org.cinnamon", "desktop-effects-workspace")
            switch.label.set_markup("<b>%s</b>" % _("Desktop and window effects"))
            switch.fill_row()
            page.add(switch)

            settings = page.add_reveal_section("", "org.cinnamon", "desktop-effects-workspace")

            widget = GSettingsSwitch(_("Effects on dialog boxes"), "org.cinnamon", "desktop-effects-on-dialogs")
            settings.add_reveal_row(widget, "org.cinnamon", "desktop-effects-workspace")

            widget = GSettingsSwitch(_("Effects on menus"), "org.cinnamon", "desktop-effects-on-menus")
            settings.add_reveal_row(widget, "org.cinnamon", "desktop-effects-workspace")

            widget = GSettingsSwitch(_("Session startup animation"), "org.cinnamon", "startup-animation")
            settings.add_reveal_row(widget, "org.cinnamon", "desktop-effects-workspace")

            widget = GSettingsSwitch(_("Fade effect on Cinnamon scrollboxes (like the Menu application list)"), "org.cinnamon", "enable-vfade")
            settings.add_reveal_row(widget, "org.cinnamon", "desktop-effects-workspace")


            widget = GSettingsSwitch(_("Window effects"), "org.cinnamon", "desktop-effects")
            settings.add_reveal_row(widget, "org.cinnamon", "desktop-effects-workspace")

            # MAPPING WINDOWS
            options = ["none", _("None")], \
                      ["traditional", _("Traditional")], \
                      ["fly", _("Fly")], \
                      ["move", _("Move")]
            widget = GSettingsComboBox(_("New windows or unminimizing existing ones"), "org.cinnamon", "desktop-effects-map", options)
            settings.add_reveal_row(widget, "org.cinnamon", "desktop-effects")

            # CLOSING WINDOWS
            options = ["none", _("None")], \
                      ["traditional", _("Traditional")], \
                      ["fly", _("Fly")]
            widget = GSettingsComboBox(_("Closing windows"), "org.cinnamon", "desktop-effects-close", options)
            settings.add_reveal_row(widget, "org.cinnamon", "desktop-effects")

            # MINIMIZING WINDOWS
            options = ["none", _("None")], \
                      ["traditional", _("Traditional")], \
                      ["fly", _("Fly")], \
                      ["fade", _("Fade")]
            widget = GSettingsComboBox(_("Minimizing windows"), "org.cinnamon", "desktop-effects-minimize", options)
            settings.add_reveal_row(widget, "org.cinnamon", "desktop-effects")

            # MAXIMIZING/TILING WINDOWS
            widget = GSettingsSwitch(_("Resizing and tiling windows"), "org.cinnamon", "desktop-effects-change-size")
            settings.add_reveal_row(widget, "org.cinnamon", "desktop-effects")

            slider = GSettingsRange(_("Window animation speed"), "org.cinnamon", "window-effect-speed", _("Slower"), _("Faster"),
                                    mini=0, maxi=2, step=1, show_value=False)
            slider.content_widget.set_has_origin(False)
            slider.content_widget.add_mark(1, Gtk.PositionType.TOP, None)

            settings.add_reveal_row(slider, "org.cinnamon", "desktop-effects")

