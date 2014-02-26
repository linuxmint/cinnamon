#!/usr/bin/env python

import os
from SettingsWidgets import *

LOCK_DELAY_OPTIONS = [
    (0, _("Immediately")),
    (30, _("After 30 seconds")),
    (60, _("After 1 minute")),
    (120, _("After 2 minutes")),
    (180, _("After 3 minutes")),
    (300, _("After 5 minutes")),
    (600, _("After 10 minutes")),
    (1800, _("After 30 minutes")),
    (3600, _("After 1 hour"))
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

        table = Gtk.Table(3, 2)
        table.set_row_spacings(8)
        table.set_col_spacings(15)        
        self.sidePage.add_widget(table, False)
        
        label = Gtk.Label()
        label.set_markup("<b>%s</b>" % _("Activation"))
        label.set_alignment(1, 0.5)
        table.attach(label, 0, 1, 0, 1)        
                   

        hbox = Gtk.HBox()

        widget = GSettingsCheckButton(_("Lock the session when Cinnamon starts the screensaver"), "org.cinnamon.desktop.screensaver", "lock-enabled", None)
        widget.set_tooltip_text(_("Enable this option to require a password when the screen turns itself off, or when Cinnamon calls the screensaver after a period of inactivity"))
        hbox.pack_start (widget, False, False, 0)
        widget = GSettingsIntComboBox("", "org.cinnamon.desktop.screensaver", "lock-delay", "org.cinnamon.desktop.screensaver/lock-enabled", LOCK_DELAY_OPTIONS, use_uint=True)
        widget.set_tooltip_text(_("This option defines the amount of time to wait before locking the screen, after showing the screensaver or after turning off the screen"))
        hbox.pack_start (widget, False, False, 6) 
        table.attach(hbox, 1, 2, 1, 2, xoptions=Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)        
        
        widget = GSettingsCheckButton(_("Lock the session when the computer suspends"), "org.cinnamon.settings-daemon.plugins.power", "lock-on-suspend", None)
        widget.set_tooltip_text(_("Enable this option to require a password when the computer wakes up from suspend"))
        table.attach(widget, 1, 2, 3, 4, xoptions=Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
               
        label = Gtk.Label()
        label.set_markup("<b>%s</b>" % _("Away Message"))
        label.set_alignment(1, 0.5)
        table.attach(label, 0, 1, 4, 5)

        widget = GSettingsEntry(_("Show this message when the screen is locked :"), "org.cinnamon.screensaver", "default-message", None)
        widget.set_tooltip_text(_("This is the default message displayed on your lock screen"))
        table.attach(widget, 1, 2, 5, 6, xoptions=Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
        
        widget = GSettingsCheckButton(_("Ask for a custom message when locking the screen from the menu"), "org.cinnamon.screensaver", "ask-for-away-message", None)
        widget.set_tooltip_text(_("This option allows you to type a message each time you lock the screen from the menu"))        
        table.attach(widget, 1, 2, 6, 7, xoptions=Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)

        

        