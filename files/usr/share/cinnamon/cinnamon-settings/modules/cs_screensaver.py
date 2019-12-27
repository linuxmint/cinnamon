#!/usr/bin/python3

import subprocess

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

LOCK_DELAY_OPTIONS = [
    (0, _("Lock immediately")),
    (2, _("2 seconds")),
    (15, _("15 seconds")),
    (30, _("30 seconds")),
    (60, _("1 minute")),
    (120, _("2 minutes")),
    (180, _("3 minutes")),
    (300, _("5 minutes")),
    (600, _("10 minutes")),
    (1800, _("30 minutes")),
    (3600, _("1 hour"))
]

LOCK_INACTIVE_OPTIONS = [
    (0,    _("Never")),
    (60,   _("1 minute")),
    (300,  _("5 minutes")),
    (600,  _("10 minutes")),
    (900,  _("15 minutes")),
    (1800, _("30 minutes")),
    (2700, _("45 minutes")),
    (3600, _("1 hour"))
]

XSCREENSAVER_PATH = "/usr/share/xscreensaver/config/"


def list_header_func(row, before, user_data):
    if before and not row.get_header():
        row.set_header(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))

class Module:
    name = "screensaver"
    category = "prefs"
    comment = _("Manage screen lock settings")

    def __init__(self, content_box):
        keywords = _("screensaver, lock, away, message")
        sidePage = SidePage(_("Screensaver"), "cs-screensaver", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_show_custom_format_info_button_clicked(self, button):
        subprocess.Popen(['xdg-open', 'http://www.foragoodstrftime.com/'])

    def on_module_selected(self):
        if self.loaded:
            return

        print("Loading Screensaver module")

        schema = "org.cinnamon.desktop.screensaver"
        self.settings = Gio.Settings.new(schema)

        self.sidePage.stack = SettingsStack()
        self.sidePage.add_widget(self.sidePage.stack)

        # Settings
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "settings", _("Settings"))

        settings = page.add_section(_("Screensaver settings"))

        size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

        widget = GSettingsComboBox(_("Delay before starting the screensaver"), "org.cinnamon.desktop.session", "idle-delay", LOCK_INACTIVE_OPTIONS, valtype=int, size_group=size_group)
        widget.set_tooltip_text(_("This option defines the amount of time to wait before starting the screensaver, when the computer is not being used"))
        settings.add_row(widget)

        settings = page.add_section(_("Lock settings"))

        widget = GSettingsSwitch(_("Lock the computer when put to sleep"), "org.cinnamon.settings-daemon.plugins.power", "lock-on-suspend")
        widget.set_tooltip_text(_("Enable this option to require a password when the computer wakes up from suspend"))
        settings.add_row(widget)

        widget = GSettingsSwitch(_("Lock the computer after the screensaver starts"), schema, "lock-enabled")
        widget.set_tooltip_text(_("Enable this option to require a password when the screen turns itself off, or when the screensaver activates after a period of inactivity"))
        settings.add_row(widget)

        widget = GSettingsComboBox(_("Delay before locking"), schema, "lock-delay", LOCK_DELAY_OPTIONS, valtype=int, size_group=size_group)
        widget.set_tooltip_text(_("This option defines the amount of time to wait before locking the screen, after showing the screensaver or after turning off the screen"))
        settings.add_reveal_row(widget, schema, "lock-enabled")

        # Customize
        page = SettingsPage()
        self.sidePage.stack.add_titled(page, "customize", _("Customize"))

        settings = page.add_section(_("Date and Time"))

        size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

        widget = GSettingsSwitch(_("Always show the clock"), schema, "show-clock")
        widget.set_tooltip_text(_("Show the clock on the wallpaper instead of just on the unlock screen"))
        settings.add_row(widget)

        widget = GSettingsSwitch(_("Use a custom date and time format"), schema, "use-custom-format")
        settings.add_row(widget)

        widget = GSettingsEntry(_("Time Format"), schema, "time-format", size_group=size_group)
        settings.add_reveal_row(widget, schema, "use-custom-format")

        widget = GSettingsEntry(_("Date Format: "), schema, "date-format", size_group=size_group)
        settings.add_reveal_row(widget, schema, "use-custom-format")

        widget = SettingsWidget()
        button = Gtk.Button(_("Show information on date format syntax"))
        button.connect("clicked", self.on_show_custom_format_info_button_clicked)
        widget.pack_start(button, True, True, 0)
        settings.add_reveal_row(widget, schema, "use-custom-format")

        widget = GSettingsFontButton(_("Time Font"), "org.cinnamon.desktop.screensaver", "font-time", size_group=size_group)
        settings.add_row(widget)

        widget = GSettingsFontButton(_("Date Font"), "org.cinnamon.desktop.screensaver", "font-date", size_group=size_group)
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

        settings = page.add_section(_("General"))

        widget = GSettingsSwitch(_("Allow keyboard shortcuts"), schema, "allow-keyboard-shortcuts")
        widget.set_tooltip_text(_("Allow shortcuts like volume-control and media keys to be used on the lock screen"))
        settings.add_row(widget)

        widget = GSettingsSwitch(_("Show media player controls"), schema, "allow-media-control")
        widget.set_tooltip_text(_("For compatible players, show playback controls while media is playing"))
        settings.add_row(widget)

        widget = GSettingsSwitch(_("Show album art"), schema, "show-album-art")
        widget.set_tooltip_text(_("If available, show album art while media is playing"))
        settings.add_row(widget)

        widget = GSettingsSwitch(_("Show info panel"), schema, "show-info-panel")
        widget.set_tooltip_text(_("Show the number of missed notifications and the battery status"))
        settings.add_row(widget)

        widget = GSettingsSwitch(_("Allow floating clock and album art widgets"), schema, "floating-widgets")
        widget.set_tooltip_text(_("When the default screensaver is active, allow the clock and album art widgets to float around randomly"))
        settings.add_row(widget)
