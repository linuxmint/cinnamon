#!/usr/bin/python3

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

SCHEMA = "org.cinnamon"
DEP_PATH = "org.cinnamon/desktop-effects"

class Module:
    name = "effects"
    category = "appear"
    comment = _("Control Cinnamon visual effects.")

    def __init__(self, content_box):
        keywords = _("effects, fancy, window")
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

            widget = GSettingsSwitch(_("Window effects"), "org.cinnamon.muffin", "desktop-effects")
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Effects on dialog boxes"), "org.cinnamon", "desktop-effects-on-dialogs")
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

            widget = GSettingsSwitch(_("Effects on menus"), "org.cinnamon", "desktop-effects-on-menus")
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

            self.schema.connect("changed::desktop-effects", self.on_desktop_effects_enabled_changed)

            settings = page.add_reveal_section(_("Window Effects"), "org.cinnamon.muffin", "desktop-effects")

            self.size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)


            # MAPPING WINDOWS
            options = ["none", _("None")], \
                      ["traditional", _("Traditional")], \
                      ["fly", _("Fly")], \
                      ["move", _("Move")]
            widget = GSettingsComboBox(_("Mapping windows"), "org.cinnamon", "desktop-effects-map", options)
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

            # CLOSING WINDOWS
            options = ["none", _("None")], \
                      ["traditional", _("Traditional")], \
                      ["fly", _("Fly")]
            widget = GSettingsComboBox(_("Closing windows"), "org.cinnamon", "desktop-effects-close", options)
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

            # MINIMIZING WINDOWS
            options = ["none", _("None")], \
                      ["traditional", _("Traditional")], \
                      ["fly", _("Fly")]
            widget = GSettingsComboBox(_("Minimizing windows"), "org.cinnamon", "desktop-effects-minimize", options)
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

            # MAXIMIZING/TILING WINDOWS
            widget = GSettingsSwitch(_("Maximizing windows"), "org.cinnamon", "desktop-effects-maximize")
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")
            widget = GSettingsSwitch(_("Unmaximizing and tiling windows"), "org.cinnamon", "desktop-effects-change-size")
            settings.add_reveal_row(widget, "org.cinnamon.muffin", "desktop-effects")

    def on_desktop_effects_enabled_changed(self, schema, key):
        active = schema.get_boolean(key)

        if not active and schema.get_boolean("desktop-effects-on-dialogs"):
            schema.set_boolean("desktop-effects-on-dialogs", False)

        if not active and schema.get_boolean("desktop-effects-on-menus"):
            schema.set_boolean("desktop-effects-on-menus", False)
