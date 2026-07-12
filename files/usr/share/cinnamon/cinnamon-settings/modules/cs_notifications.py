#!/usr/bin/python3

import gi
gi.require_version('Notify', '0.7')
from gi.repository import Gio, Notify, Gtk, Pango
import re

from bin.SettingsWidgets import SidePage
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

        settings = page.add_section()

        switch = GSettingsSwitch(_("Enable notifications"), "org.cinnamon.desktop.notifications", "display-notifications")
        settings.add_row(switch)

        button = Button(_("Application notifications"), self.open_app_settings)
        settings.add_reveal_row(button, "org.cinnamon.desktop.notifications", "display-notifications")

        settings = page.add_reveal_section(_("Notification settings"), "org.cinnamon.desktop.notifications", "display-notifications")

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
        n = Notify.Notification.new(_("This is a test notification"), content, "dialog-warning")
        n.show()

    def open_app_settings(self, widget):
        win = AppNotificationsWindow(widget.get_toplevel())

PER_APP_SCHEMA = "org.cinnamon.desktop.notifications.application"
PER_APP_BASE_PATH = "/org/cinnamon/desktop/notifications/application/"

class AppNotificationRow(Gtk.ListBoxRow):
    def __init__(self, app_info, parent_settings):
        super().__init__()
        self.parent_settings = parent_settings
        self.set_activatable(True)
        self.set_selectable(False)
        self.set_can_focus(True)

        self.app_name = app_info.get_name().lower()

        # Sanitise app ID for GSettings path (this should remain the same as in ui/messageTray.js)
        # 1. Convert to lower case.
        # 2. Replace any one or more consecutive characters that is not a lowercase letter or a digit with a hyphen.
        # 3. Trim any leading or trailing hyphens.
        app_id = app_info.get_id().lower().replace(".desktop", "")
        self.settings_id = re.sub(r'[^a-z0-9]+', '-', app_id).strip('-')
        path = f"{PER_APP_BASE_PATH}{self.settings_id}/"

        self.settings = Gio.Settings.new_with_path(PER_APP_SCHEMA, path)

        hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=12)
        hbox.set_margin_start(8)
        hbox.set_margin_end(8)
        hbox.set_margin_top(4)
        hbox.set_margin_bottom(4)

        # Icon
        gicon = app_info.get_icon()
        if not gicon:
            gicon = Gio.ThemedIcon.new("application-x-executable")
        icon = Gtk.Image.new_from_gicon(gicon, Gtk.IconSize.DND)
        icon.set_pixel_size(32)
        hbox.pack_start(icon, False, False, 0)

        # Labels
        name_label = Gtk.Label(label=app_info.get_name(), xalign=0)
        name_label.set_ellipsize(Pango.EllipsizeMode.END)
        hbox.pack_start(name_label, True, True, 0)

        # Switch
        self.switch = Gtk.Switch()
        self.switch.set_active(self.settings.get_boolean("enabled"))
        self.settings.bind("enabled", self.switch, "active", Gio.SettingsBindFlags.DEFAULT)
        self.settings.connect("changed::enabled", self.update_index)
        hbox.pack_start(self.switch, False, False, 0)

        self.add(hbox)

    def update_index(self, settings, key):
        current_children = list(self.parent_settings.get_strv("application-children"))

        if self.settings.get_boolean("enabled"):
            # Since 'true' is the default, we can remove the custom setting from dconf
            if self.settings_id in current_children:
                current_children.remove(self.settings_id)
                self.parent_settings.set_strv("application-children", current_children)
                self.settings.reset("enabled")
        else:
            if self.settings_id not in current_children:
                current_children.append(self.settings_id)
                self.parent_settings.set_strv("application-children", current_children)

    def toggle_switch(self):
        self.switch.set_active(not self.switch.get_active())

class AppNotificationsWindow(Gtk.Dialog):
    def __init__(self, parent):
        super().__init__(title=_("Application Notifications"), transient_for=parent)
        self.set_modal(True)
        self.set_destroy_with_parent(True)
        self.set_default_size(430, 480)
        self.set_border_width(10)

        frame = Gtk.Frame()
        frame.set_border_width(6)
        frame.set_shadow_type(Gtk.ShadowType.IN)
        inner_vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.search_entry = Gtk.SearchEntry()
        self.search_entry.set_margin_start(16)
        self.search_entry.set_margin_end(16)
        self.search_entry.connect("search-changed", self.on_search_changed)
        scrolled = Gtk.ScrolledWindow()
        scrolled.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)

        self.listbox = Gtk.ListBox()
        self.listbox.set_selection_mode(Gtk.SelectionMode.NONE)
        self.listbox.connect("row-activated", self.on_row_activated)
        self.listbox.set_filter_func(self.filter_func)

        self.parent_settings = Gio.Settings.new("org.cinnamon.desktop.notifications")
        apps = Gio.AppInfo.get_all()
        # Filter for unique apps that are not hidden
        seen_ids = set()
        for app in sorted(apps, key=lambda x: x.get_name()):
            app_id = app.get_id()
            if app.should_show() and app_id not in seen_ids and not app_id.startswith("cinnamon-settings-"):
                row = AppNotificationRow(app, self.parent_settings)
                self.listbox.add(row)
                seen_ids.add(app_id)

        scrolled.add(self.listbox)
        inner_vbox.pack_start(self.search_entry, False, False, 6)
        inner_vbox.pack_start(scrolled, True, True, 0)
        frame.add(inner_vbox)
        content_area = self.get_content_area()
        content_area.pack_start(frame, True, True, 0)

        reset_button = Gtk.Button(label=_("Reset All"))
        reset_button.connect("clicked", self.on_reset_all_clicked)
        self.add_action_widget(reset_button, Gtk.ResponseType.NONE)

        self.show_all()

    def on_row_activated(self, listbox, row):
        row.toggle_switch()

    def filter_func(self, row):
        search_text = self.search_entry.get_text().lower()
        if not search_text:
            return True
        return search_text in row.app_name

    def on_search_changed(self, entry):
        self.listbox.invalidate_filter()

    def on_reset_all_clicked(self, button):
        overridden_apps = self.parent_settings.get_strv("application-children")
        if not overridden_apps:
            return

        for app_id in overridden_apps:
            path = f"{PER_APP_BASE_PATH}{app_id}/"
            app_settings = Gio.Settings.new_with_path(PER_APP_SCHEMA, path)
            app_settings.reset("enabled")

        self.parent_settings.set_strv("application-children", [])
