#!/usr/bin/env python2

from GSettingsWidgets import *


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
            print "Loading General module"

            page = SettingsPage()
            self.sidePage.add_widget(page)

            settings = page.add_section(_("Desktop Scaling"))

            ui_scales = [[0, _("Auto")], [1, _("Normal")], [2, _("Double (Hi-DPI)")]]
            combo = GSettingsComboBox(_("User interface scaling:"), "org.cinnamon.desktop.interface", "scaling-factor", ui_scales, valtype="uint")
            settings.add_row(combo)

            # Some applications hard code the GNOME path for HiDPI settings,
            # which is stupid, but we'll be nice and supply them with the right
            # values.
            schema = Gio.SettingsSchemaSource.get_default().lookup("org.gnome.desktop.interface", False)
            if schema is not None:
                gnome_settings = Gio.Settings("org.gnome.desktop.interface")

                def on_changed(widget):
                    tree_iter = widget.get_active_iter()
                    if tree_iter is not None:
                        gnome_settings["scaling-factor"] = combo.model[tree_iter][0]

                combo.content_widget.connect('changed', on_changed)

            settings = page.add_section(_("Miscellaneous Options"))

            switch = GSettingsSwitch(_("Disable compositing for full-screen windows"), "org.cinnamon.muffin", "unredirect-fullscreen-windows")
            switch.set_tooltip_text(_("Select this option to let full-screen applications skip the compositing manager and run at maximum speed. Unselect it if you're experiencing screen-tearing in full screen mode."))
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Enable timer when logging out or shutting down"), "org.cinnamon.SessionManager", "quit-delay-toggle")
            settings.add_row(switch)

            spin = GSettingsSpinButton(_("Timer delay"), "org.cinnamon.SessionManager", "quit-time-delay", _("seconds"), 0, 36000, 1, 60)
            settings.add_reveal_row(spin, "org.cinnamon.SessionManager", "quit-delay-toggle")

            switch = GSettingsSwitch(_("Enable support for indicators (Requires Cinnamon restart)"), "org.cinnamon", "enable-indicators")
            settings.add_row(switch)

            switch = GSettingsSwitch(_("Log LookingGlass output to ~/.cinnamon/glass.log (Requires Cinnamon restart)"), "org.cinnamon", "enable-looking-glass-logs")
            settings.add_row(switch)
