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

            settings = page.add_section(_("Desktop Effects"))

            widget = GSettingsSwitch(_("Session startup animation"), "org.cinnamon", "startup-animation")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Fade effect on Cinnamon scrollboxes (like the Menu application list)"), "org.cinnamon", "enable-vfade")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Desktop effects"), "org.cinnamon", "desktop-effects-workspace")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Window effects"), "org.cinnamon", "desktop-effects")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Effects on dialog boxes"), "org.cinnamon", "desktop-effects-on-dialogs")
            settings.add_reveal_row(widget, "org.cinnamon", "desktop-effects")

            widget = GSettingsSwitch(_("Effects on menus"), "org.cinnamon", "desktop-effects-on-menus")
            settings.add_reveal_row(widget, "org.cinnamon", "desktop-effects")

            self.schema.connect("changed::desktop-effects", self.on_desktop_effects_enabled_changed)

            settings = page.add_reveal_section(_("Window Effects"), "org.cinnamon", "desktop-effects")

            self.size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)


            # MAPPING WINDOWS
            options = ["none", _("None")], \
                      ["traditional", _("Traditional")], \
                      ["fly", _("Fly")], \
                      ["fade", _("Fade")]
            widget = GSettingsComboBox(_("New windows or unminimizing existing ones"), "org.cinnamon", "desktop-effects-map", options)
            settings.add_row(widget)

            # CLOSING WINDOWS
            options = ["none", _("None")], \
                      ["traditional", _("Traditional")], \
                      ["fly", _("Fly")]
            widget = GSettingsComboBox(_("Closing windows"), "org.cinnamon", "desktop-effects-close", options)
            settings.add_row(widget)

            # MINIMIZING WINDOWS
            options = ["none", _("None")], \
                      ["traditional", _("Traditional")], \
                      ["fly", _("Fly")], \
                      ["fade", _("Fade")]
            widget = GSettingsComboBox(_("Minimizing windows"), "org.cinnamon", "desktop-effects-minimize", options)
            settings.add_row(widget)

            # MAXIMIZING/TILING WINDOWS
            widget = GSettingsSwitch(_("Resizing and tiling windows"), "org.cinnamon", "desktop-effects-change-size")
            settings.add_row(widget)

            slider = GSettingsRange(_("Window animation speed"), "org.cinnamon", "window-effect-speed", _("Slower"), _("Faster"),
                                    mini=0, maxi=2, step=1, show_value=False)
            slider.content_widget.set_has_origin(False)
            slider.content_widget.add_mark(1, Gtk.PositionType.TOP, None)

            settings.add_row(slider)


    def on_desktop_effects_enabled_changed(self, schema, key):
        active = schema.get_boolean(key)

        if not active and schema.get_boolean("desktop-effects-on-dialogs"):
            schema.set_boolean("desktop-effects-on-dialogs", False)

        if not active and schema.get_boolean("desktop-effects-on-menus"):
            schema.set_boolean("desktop-effects-on-menus", False)
