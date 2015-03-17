#!/usr/bin/env python

from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("logging, click")
        sidePage = SidePage(_("General"), "cs-general", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "general"
        self.comment = _("Miscellaneous Cinnamon preferences")
        self.category = "prefs"        

    def on_module_selected(self, switch_container):
        if not self.loaded:
            print "Loading General module"
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            self.sidePage.add_widget(vbox)

            section = Section(_("Desktop Scaling"))
            ui_scales = [[0, _("Auto")], [1, _("Normal")], [2, _("Double (Hi-DPI)")]]        
            combo = GSettingsUIntComboBox(_("User interface scaling:"), "org.cinnamon.desktop.interface", "scaling-factor", ui_scales)
            section.add(combo)
            vbox.add(section)

            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))       

            section = Section(_("Miscellaneous Options"))
            button = GSettingsCheckButton(_("Disable compositing for full-screen windows"), "org.cinnamon.muffin", "unredirect-fullscreen-windows", None)
            button.set_tooltip_text(_("Select this option to let full-screen applications skip the compositing manager and run at maximum speed. Unselect it if you're experiencing screen-tearing in full screen mode."))
            section.add(button)
            section.add(GSettingsCheckButton(_("Enable timer when logging out or shutting down"), "org.cinnamon.SessionManager", "quit-delay-toggle", None))
            spin = GSettingsSpinButton(_("Timer delay:"), "org.cinnamon.SessionManager", "quit-time-delay", "org.cinnamon.SessionManager/quit-delay-toggle", 0, 36000, 1, 60, _("seconds"))
            section.add_indented(spin)
            section.add(GSettingsCheckButton(_("Log LookingGlass output to ~/.cinnamon/glass.log (Requires Cinnamon restart)"), "org.cinnamon", "enable-looking-glass-logs", None))
            vbox.add(section)
