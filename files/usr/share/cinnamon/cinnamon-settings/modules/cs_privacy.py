#!/usr/bin/python3
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import GSettingsSwitch, SettingsLabel, SettingsPage, SettingsRevealer, SettingsWidget, Switch

PRIVACY_SCHEMA = "org.cinnamon.desktop.privacy"
GTK_RECENT_ENABLE_KEY = "remember-recent-files"
GTK_RECENT_MAX_AGE = "recent-files-max-age"


class Module:
    name = "privacy"
    comment = _("Cinnamon privacy settings")
    category = "prefs"

    def __init__(self, content_box):
        keywords = _("privacy, recent, gtk, private")
        sidePage = SidePage(_("Privacy"), "cs-privacy", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.settings = Gio.Settings(schema=PRIVACY_SCHEMA)
        self.nm_client = None

    def _init_nm_client(self):
        try:
            gi.require_version('NM', '1.0')
            from gi.repository import NM
            nm_client = NM.Client.new()

            # we need libnm >=1.10
            if hasattr(nm_client, 'connectivity_check_get_available'):
                self.nm_client = nm_client
        except ValueError:
            pass

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Privacy module")

            page = SettingsPage()
            self.sidePage.add_widget(page)

            switch = GSettingsSwitch("", PRIVACY_SCHEMA, GTK_RECENT_ENABLE_KEY)
            switch.label.set_markup("<b>%s</b>" % _("Remember recently accessed files"))
            switch.fill_row()
            page.add(switch)

            settings = page.add_reveal_section(_("Recent files"), PRIVACY_SCHEMA, GTK_RECENT_ENABLE_KEY)

            self.indefinite_switch = Switch(_("Never forget old files"))
            self.indefinite_switch.content_widget.connect("notify::active", self.on_indefinite_toggled)
            settings.add_row(self.indefinite_switch)

            widget = SettingsWidget()
            label = SettingsLabel(_("Number of days to remember old files"))
            widget.pack_start(label, False, False, 0)
            self.spinner = Gtk.SpinButton.new_with_range(1.0, 365.0, 1.0)
            self.spinner.set_digits(0)
            self.spinner.set_increments(1, 10)
            widget.pack_end(self.spinner, False, False, 0)
            self.revealer = SettingsRevealer()
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            vbox.add(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))
            list_box = Gtk.ListBox()
            row = Gtk.ListBoxRow()
            row.add(widget)
            list_box.add(row)
            vbox.add(list_box)
            self.revealer.add(vbox)
            settings.box.add(self.revealer)

            start_age = self.settings.get_int(GTK_RECENT_MAX_AGE)

            if start_age == -1:
                self.indefinite_switch.content_widget.set_active(True)
                self.revealer.set_reveal_child(False)
                self.spinner.set_value(30)
            else:
                self.indefinite_switch.content_widget.set_active(False)
                self.revealer.set_reveal_child(True)
                if start_age == 0:  # Shouldn't happen, unless someone manually sets the value
                    self.settings.set_int(GTK_RECENT_MAX_AGE, 30)
                self.bind_spinner()

            self._init_nm_client()

            if self.nm_client is not None and self.nm_client.connectivity_check_get_available():
                section = page.add_section(_("Internet connectivity"))
                connectivity_switch = Switch(_("Check connectivity"))
                connectivity_switch.content_widget.set_active(self.nm_client.connectivity_check_get_enabled())
                connectivity_switch.content_widget.connect("notify::active", self.on_connectivity_toggled)
                section.add_row(connectivity_switch)
                section.add_note(_("Check that network connections can reach the Internet. This makes it possible to detect captive portals, but also generates periodic network traffic."))

    def bind_spinner(self):
        self.settings.bind(GTK_RECENT_MAX_AGE, self.spinner, "value", Gio.SettingsBindFlags.DEFAULT)

    def unbind_spinner(self):
        # This should have self.settings.unbind or something.. but unbind is broken via introspection
        # in more than one glib version.  This achieves the same thing (preventing updates to the spinner)
        # by overwriting the .DEFAULT binding with a .GET_NO_CHANGES which only fetches the settings value
        # once at binding time.
        self.settings.bind(GTK_RECENT_MAX_AGE, self.spinner, "value",
                           Gio.SettingsBindFlags.GET | Gio.SettingsBindFlags.GET_NO_CHANGES)

    def on_indefinite_toggled(self, widget, gparam):
        active = widget.get_active()
        cur_val = self.spinner.get_value()

        if active:
            self.revealer.set_reveal_child(False)
            self.unbind_spinner()
            self.settings.set_int(GTK_RECENT_MAX_AGE, -1)
        else:
            self.revealer.set_reveal_child(True)
            if self.settings.get_int(GTK_RECENT_MAX_AGE) < 1:
                if cur_val > 0:
                    self.settings.set_int(GTK_RECENT_MAX_AGE, cur_val)
            self.bind_spinner()

    def on_connectivity_toggled(self, widget, gparam):
        active = widget.get_active()
        self.nm_client.connectivity_check_set_enabled(active)
