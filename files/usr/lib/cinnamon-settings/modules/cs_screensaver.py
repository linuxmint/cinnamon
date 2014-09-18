#!/usr/bin/env python

import os
from SettingsWidgets import *

LOCK_DELAY_OPTIONS = [
    (0, _("Immediately")),
    (15, _("After 15 seconds")),
    (30, _("After 30 seconds")),
    (60, _("After 1 minute")),
    (120, _("After 2 minutes")),
    (180, _("After 3 minutes")),
    (300, _("After 5 minutes")),
    (600, _("After 10 minutes")),
    (1800, _("After 30 minutes")),
    (3600, _("After 1 hour"))
]

SYNTAX_FORMATING = _("""
        [Time Formats]
        %H - Hour of the day, 24-hour clock (00..23)
        %I - Hour of the day, 12-hour clock (01..12)
        %l - Hour of the day without extra 0 (1..12)
        %M - Minute of the hour (00..59)
        %p - Meridian indicator capitalized (AM or PM)
        %P - Meridian indicator lowercase (am or pm)
        %S - Second of the minute (00..60)
        %Z - Time zone name
        
        [Date Formats]
        %a - The abbreviated weekday name (Sun)
        %A - The full weekday name (Sunday)
        %b - The abbreviated month name (Jan)
        %B - The full month name (January)
        %d - Day of the month (01..31)
        %e - Day of the month (1..31)
        %j - Day of the year (001..366)
        %m - Month of the year (01..12)
        %w - Day of the week (Sunday is 0, 0..6)
        %y - Year without a century (00..99)
        %Y - Year with century
        %% - Literal % character
        """)

class Module:
    def __init__(self, content_box):
        keywords = _("screensaver, lock, password, away, message")
        sidePage = SidePage(_("Screen Locker"), "cs-screensaver", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "screensaver"
        self.category = "prefs"
        self.comment = _("Manage screen lock settings")        

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Screensaver module"
            schema = "org.cinnamon.desktop.screensaver"
            bg = SectionBg()        
            self.sidePage.add_widget(bg)
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            bg.add(vbox)

            section = Section(_("Lock Settings"))
            widget = GSettingsCheckButton(_("Lock the computer when put to sleep"), "org.cinnamon.settings-daemon.plugins.power", "lock-on-suspend", None)
            widget.set_tooltip_text(_("Enable this option to require a password when the computer wakes up from suspend"))
            section.add(widget)
            widget = GSettingsCheckButton(_("Lock the computer when the screen turns off"), schema, "lock-enabled", None)
            widget.set_tooltip_text(_("Enable this option to require a password when the screen turns itself off, or when the screensaver activates after a period of inactivity"))
            box = Gtk.HBox()
            box.set_spacing(6)
            box.add(widget)
            widget = GSettingsIntComboBox("", schema, "lock-delay", "%s/lock-enabled" % (schema), LOCK_DELAY_OPTIONS, use_uint=True)
            widget.set_tooltip_text(_("This option defines the amount of time to wait before locking the screen, after showing the screensaver or after turning off the screen"))
            box.add(widget)
            section.add(box)
            vbox.add(section)

            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))    
            
            section = Section(_("Date &amp; Time"))
            widget = GSettingsCheckButton(_("Use a custom date & time format"), schema, "use-custom-format", None)
            widget.set_tooltip_text(_("Enables custom date and time formats to be displayed in the lock screen"))
            section.add(widget)
            section.add_indented(GSettingsEntry(_("Time Format: "), schema, "time-format", "%s/%s" % (schema, "use-custom-format")))
            section.add_indented(GSettingsEntry(_("Date Format: "), schema, "date-format", "%s/%s" % (schema, "use-custom-format")))
            button = Gtk.Button(label = _("Show Date & Time Format Syntax"))
            button.connect("clicked", self.formats_dialog)
            section.add_indented(button)
            label = Gtk.Label()
            label.set_markup("<i><small>%s</small></i>" % _("Hint: Plain text can be used in place of date and time formats for larger messages."))        
            label.get_style_context().add_class("dim-label")
            section.add_indented(label)
            vbox.add(section)

            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))     

            section = Section(_("Away Message"))
            widget = GSettingsEntry(_("Show this message when the screen is locked: "), schema, "default-message", None)
            widget.set_tooltip_text(_("This is the default message displayed on your lock screen"))
            section.add_expand(widget)
            widget = GSettingsCheckButton(_("Ask for a custom message when locking the screen from the menu"), schema, "ask-for-away-message", None)
            widget.set_tooltip_text(_("This option allows you to type a message each time you lock the screen from the menu"))
            section.add(widget)
            vbox.add(section)

    def formats_dialog(self, widget):
        info = Gtk.MessageDialog(None, 0, Gtk.MessageType.INFO, Gtk.ButtonsType.OK, "Date & Time Format Syntax")
        info.format_secondary_text(SYNTAX_FORMATING)
        info.run()
        info.destroy()

        
