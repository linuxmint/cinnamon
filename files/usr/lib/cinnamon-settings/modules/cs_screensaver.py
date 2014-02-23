#!/usr/bin/env python

import os
from SettingsWidgets import *

LOCK_DELAY_OPTIONS = [
    (0, _("When the screen turns off")),
    (30, _("30 seconds after the screen turns off")),
    (60, _("1 minute after the screen turns off")),
    (120, _("2 minutes after the screen turns off")),
    (180, _("3 minutes after the screen turns off")),
    (300, _("5 minutes after the screen turns off")),
    (600, _("10 minutes after the screen turns off")),
    (1800, _("30 minutes after the screen turns off")),
    (3600, _("1 hour after the screen turns off"))
]

class Module:
    def __init__(self, content_box):
        keywords = _("screensaver, lock, password, away, message")
        advanced = False
        sidePage = SidePage(_("Lock Screen"), "screensaver.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "screensaver"
        self.category = "prefs"
        self.comment = _("Manage screen lock settings")
       
        frame_label = Gtk.Label()
        frame_label.set_markup("<b>%s</b>" % _("Activation"))
        frame = Gtk.Frame()
        frame.set_label_widget(frame_label)
        frame.set_shadow_type(Gtk.ShadowType.NONE)
        vbox = Gtk.VBox()
        vbox.pack_start(GSettingsCheckButton(_("Lock the screen automatically"), "org.cinnamon.desktop.screensaver", "lock-enabled", None), False, False, 2)
        vbox.pack_start(GSettingsIntComboBox((""), "org.cinnamon.desktop.screensaver", "lock-delay", "org.cinnamon.desktop.screensaver/lock-enabled", LOCK_DELAY_OPTIONS, use_uint=True), False, False, 2)
        vbox.pack_start(GSettingsCheckButton(_("Lock the screen before suspending the computer"), "org.cinnamon.settings-daemon.plugins.power", "lock-on-suspend", None), False, False, 2)
        frame.add(vbox)
        self.sidePage.add_widget(frame)

        frame_label = Gtk.Label()
        frame_label.set_markup("<b>%s</b>" % _("Away message"))
        frame = Gtk.Frame()
        frame.set_label_widget(frame_label)
        frame.set_shadow_type(Gtk.ShadowType.NONE)
        vbox = Gtk.VBox()
        vbox.pack_start(GSettingsCheckButton(_("Ask for an away message when locking the screen from the menu"), "org.cinnamon.screensaver", "ask-for-away-message", None), False, False, 2)
        vbox.pack_start(GSettingsEntry(_("Default away message"), "org.cinnamon.screensaver", "default-message", None), False, False, 2)
        frame.add(vbox)
        self.sidePage.add_widget(frame)
