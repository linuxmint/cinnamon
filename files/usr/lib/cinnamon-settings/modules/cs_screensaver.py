#!/usr/bin/env python2

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
    name = "screensaver"
    category = "prefs"
    comment = _("Manage screen lock settings")

    def __init__(self, content_box):
        keywords = _("screensaver, lock, password, away, message")
        sidePage = SidePage(_("Screen Locker"), "cs-screensaver", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Screensaver module"

            schema = "org.cinnamon.desktop.screensaver"

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            # Settings

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "settings", _("Settings"))

            settings = page.add_section(_("Lock settings"))

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            widget = GSettingsSwitch(_("Lock the computer when put to sleep"), "org.cinnamon.settings-daemon.plugins.power", "lock-on-suspend")
            widget.set_tooltip_text(_("Enable this option to require a password when the computer wakes up from suspend"))
            settings.add_row(widget)

            widget = GSettingsSwitch(_("Lock the computer when the screen turns off"), schema, "lock-enabled")
            widget.set_tooltip_text(_("Enable this option to require a password when the screen turns itself off, or when the screensaver activates after a period of inactivity"))
            settings.add_row(widget)

            widget = GSettingsComboBox(_("Delay before locking the screen"), schema, "lock-delay", LOCK_DELAY_OPTIONS, valtype="uint", size_group=size_group)
            widget.set_tooltip_text(_("This option defines the amount of time to wait before locking the screen, after showing the screensaver or after turning off the screen"))
            settings.add_reveal_row(widget, schema, "lock-enabled")

            widget = GSettingsComboBox(_("Lock the computer when inactive"), "org.cinnamon.desktop.session", "idle-delay", LOCK_INACTIVE_OPTIONS, valtype="uint", size_group=size_group)
            widget.set_tooltip_text(_("This option defines the amount of time to wait before locking the screen, when the computer is not being used"))
            settings.add_row(widget)

            settings = page.add_section(_("Away message"))

            widget = GSettingsEntry(_("Show this message when the screen is locked"), schema, "default-message")
            widget.set_child_packing(widget.content_widget, True, True, 0, Gtk.PackType.START)
            widget.set_tooltip_text(_("This is the default message displayed on your lock screen"))
            settings.add_row(widget)

            settings.add_row(GSettingsFontButton(_("Font"), "org.cinnamon.desktop.screensaver", "font-message"))
            
            widget = GSettingsSwitch(_("Ask for a custom message when locking the screen from the menu"), schema, "ask-for-away-message")
            widget.set_tooltip_text(_("This option allows you to type a message each time you lock the screen from the menu"))
            settings.add_row(widget)

            # Date

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "date", _("Date"))

            settings = page.add_section(_("Date and Time"))

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            widget = GSettingsSwitch(_("Use a custom date and time format"), schema, "use-custom-format")
            settings.add_row(widget)

            widget = GSettingsEntry(_("Time Format"), schema, "time-format", size_group=size_group)
            settings.add_reveal_row(widget, schema, "use-custom-format")

            widget = GSettingsEntry(_("Date Format: "), schema, "date-format", size_group=size_group)
            settings.add_reveal_row(widget, schema, "use-custom-format")

            widget = GSettingsFontButton(_("Time Font"), "org.cinnamon.desktop.screensaver", "font-time", size_group=size_group)
            settings.add_row(widget)

            widget = GSettingsFontButton(_("Date Font"), "org.cinnamon.desktop.screensaver", "font-date", size_group=size_group)
            settings.add_row(widget)
