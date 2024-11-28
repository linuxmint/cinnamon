#!/usr/bin/python3

import gi
gi.require_version('Notify', '0.7')
from gi.repository import Gio, Notify

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

content = """
Lorem ipsum dolor sit amet, consectetur adipiscing elit. \
Suspendisse eleifend, lacus ut tempor vehicula, lorem tortor \
suscipit libero, sit amet congue odio libero vitae lacus. \
Sed est nibh, lacinia ac magna non, blandit aliquet est. \
Mauris volutpat est vel lacinia faucibus. Pellentesque \
pulvinar eros at dolor pretium, eget hendrerit leo rhoncus. \
Sed nisl leo, posuere eget risus vel, euismod egestas metus. \
Praesent interdum, dui sit amet convallis rutrum, velit nunc \
sollicitudin erat, ac viverra leo eros in nulla. Morbi feugiat \
feugiat est. Nam non libero dolor. Duis egestas sodales massa \
sit amet lobortis. Donec sit amet nisi turpis. Morbi aliquet \
aliquam ullamcorper.
"""

NOTIFICATION_DISPLAY_SCREENS = [
    ("primary-screen", _("Primary monitor")),
    ("active-screen", _("Active monitor")),
    ("fixed-screen", _("The monitor specified below"))
]


class Module:
    name = "notifications"
    comment = _("Notification preferences")
    category = "prefs"

    def __init__(self, content_box):
        keywords = _("notifications")
        sidePage = SidePage(_("Notifications"), "cs-notifications", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if self.loaded:
            return

        print("Loading Notifications module")

        Notify.init("cinnamon-settings-notifications-test")

        page = SettingsPage()
        self.sidePage.add_widget(page)

        settings = page.add_section(_("Notification settings"))

        switch = GSettingsSwitch(_("Enable notifications"), "org.cinnamon.desktop.notifications", "display-notifications")
        settings.add_row(switch)

        switch = GSettingsSwitch(_("Remove notifications after their timeout is reached"), "org.cinnamon.desktop.notifications", "remove-old")
        settings.add_reveal_row(switch, "org.cinnamon.desktop.notifications", "display-notifications")

        switch = GSettingsSwitch(_("Show notifications on the bottom side of the screen"), "org.cinnamon.desktop.notifications", "bottom-notifications")
        settings.add_reveal_row(switch, "org.cinnamon.desktop.notifications", "display-notifications")

        combo = GSettingsComboBox(_("Monitor to use for displaying notifications"), "org.cinnamon.desktop.notifications", "notification-screen-display", NOTIFICATION_DISPLAY_SCREENS)
        settings.add_reveal_row(combo, "org.cinnamon.desktop.notifications", "display-notifications")

        spin = GSettingsSpinButton(_("Monitor"), "org.cinnamon.desktop.notifications", "notification-fixed-screen", None, 1, 13, 1)
        settings.add_reveal_row(spin)
        spin.revealer.settings = Gio.Settings("org.cinnamon.desktop.notifications")
        spin.revealer.settings.bind_with_mapping("notification-screen-display", spin.revealer, "reveal-child", Gio.SettingsBindFlags.GET, lambda option: option == "fixed-screen", None)

        switch = GSettingsSwitch(_("Display notifications over fullscreen windows"), "org.cinnamon.desktop.notifications", "fullscreen-notifications")
        settings.add_reveal_row(switch, "org.cinnamon.desktop.notifications", "display-notifications")

        spin = GSettingsSpinButton(_("Notification duration"), "org.cinnamon.desktop.notifications", "notification-duration", _("seconds"), 1, 60, 1, 1)
        settings.add_reveal_row(spin, "org.cinnamon.desktop.notifications", "display-notifications")

        button = Button(_("Display a test notification"), self.send_test)
        settings.add_reveal_row(button, "org.cinnamon.desktop.notifications", "display-notifications")

        settings = page.add_section(_("Media keys OSD"))

        switch = GSettingsSwitch(_("Show media keys OSD"), "org.cinnamon", "show-media-keys-osd")
        settings.add_row(switch)

    def send_test(self, widget):
        n = Notify.Notification.new("This is a test notification", content, "dialog-warning")
        n.show()
