#!/usr/bin/env python

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

LOCK_INACTIVE_OPTIONS = [
    (0,    _("Never")),
    (60,   _("After 1 minute")),
    (300,  _("After 5 minutes")),
    (600,  _("After 10 minutes")),
    (900,  _("After 15 minutes")),
    (1800, _("After 30 minutes")),
    (2700, _("After 45 minutes")),
    (3600, _("After 1 hour"))
]

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
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            self.sidePage.add_widget(vbox)

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
            widget = GSettingsIntComboBox(_("Lock the computer when inactive"), "org.cinnamon.desktop.session", "idle-delay", None, LOCK_INACTIVE_OPTIONS, use_uint=True)
            widget.set_tooltip_text(_("This option defines the amount of time to wait before locking the screen, when the computer is not being used"))
            section.add(widget)
            vbox.add(section)

            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))    
            
            section = Section(_("Date &amp; Time"))
            widget = GSettingsCheckButton(_("Use a custom date and time format"), schema, "use-custom-format", None)
            widget.set_tooltip_text(_("Enables custom date and time formats to be displayed in the lock screen"))
            section.add(widget)
            section.add_indented(GSettingsEntry(_("Time Format: "), schema, "time-format", "%s/%s" % (schema, "use-custom-format")))
            section.add_indented(GSettingsEntry(_("Date Format: "), schema, "date-format", "%s/%s" % (schema, "use-custom-format")))
            label = Gtk.Label()
            label.set_markup("<i><small>%s</small></i>" % _("Hint: Plain text can also be used in place of the date and time format for custom messages."))
            label.get_style_context().add_class("dim-label")
            section.add_indented(label)
            blank_line = Gtk.Label("")
            section.add(GSettingsFontButton(_("Time Font: "), "org.cinnamon.desktop.screensaver", "font-time", None))
            section.add(GSettingsFontButton(_("Date Font: "), "org.cinnamon.desktop.screensaver", "font-date", None))
            vbox.add(section)

            vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))     

            section = Section(_("Away Message"))
            widget = GSettingsEntry(_("Show this message when the screen is locked: "), schema, "default-message", None)
            widget.set_tooltip_text(_("This is the default message displayed on your lock screen"))
            section.add_expand(widget)
            section.add(GSettingsFontButton(_("Font: "), "org.cinnamon.desktop.screensaver", "font-message", None))
            widget = GSettingsCheckButton(_("Ask for a custom message when locking the screen from the menu"), schema, "ask-for-away-message", None)
            widget.set_tooltip_text(_("This option allows you to type a message each time you lock the screen from the menu"))
            section.add(widget)
            vbox.add(section)


        
