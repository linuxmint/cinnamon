#!/usr/bin/env python

from SettingsWidgets import *

PRIVACY_SCHEMA = "org.cinnamon.desktop.privacy"
GTK_RECENT_ENABLE_KEY = "remember-recent-files"
GTK_RECENT_MAX_AGE = "recent-files-max-age"

class Module:
    def __init__(self, content_box):
        keywords = _("privacy, recent, gtk, private")
        sidePage = SidePage(_("Privacy"), "cs-privacy", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "privacy"
        self.comment = _("Cinnamon privacy settings")
        self.category = "prefs"
        self.settings = Gio.Settings(schema=PRIVACY_SCHEMA)

    def on_module_selected(self, switch_container):
        if not self.loaded:
            print "Loading Privacy module"
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            self.sidePage.add_widget(vbox)

            section = Section(_("Recent files"))

            section.add(GSettingsCheckButton(_("Remember recently accessed files"), PRIVACY_SCHEMA, GTK_RECENT_ENABLE_KEY, None))

            box = Gtk.HBox()
            self.rb1 = Gtk.RadioButton.new_with_label(None, _("Never forget old files"))
            box.pack_start(self.rb1, False, False, 2)
            self.settings.bind(GTK_RECENT_ENABLE_KEY, box, "sensitive", Gio.SettingsBindFlags.GET)

            spinbox = Gtk.HBox()
            self.rb2 = Gtk.RadioButton.new_with_label_from_widget(self.rb1, _("Forget a file after"))
            spinbox.pack_start(self.rb2, False, False, 2)
            self.settings.bind(GTK_RECENT_ENABLE_KEY, spinbox, "sensitive", Gio.SettingsBindFlags.GET)

            self.spinner = Gtk.SpinButton.new_with_range(1.0, 365.0, 1.0)
            self.spinner.set_digits(0)
            self.spinner.set_increments(1, 10)
            self.spinner.connect("value-changed", self.update_spinner_suffix)
            spinbox.pack_start(self.spinner, False, False, 2)

            self.suffix = Gtk.Label(label=_("days"))
            spinbox.pack_start(self.suffix, False, False, 2)

            section.add_indented(box)
            section.add_indented(spinbox)

            vbox.add(section)

            start_age = self.settings.get_int(GTK_RECENT_MAX_AGE)

            if start_age == -1:
                self.rb1.set_active(True)
                self.spinner.set_value(30)
            else:
                self.rb2.set_active(True)
                if start_age == 0: # Shouldn't happen, unless someone manually sets the value
                    self.settings.set_int(GTK_RECENT_MAX_AGE, 30)
                self.bind_spinner()

            self.rb1.connect("toggled", self.on_indefinite_toggled)
            self.rb2.connect("toggled", self.on_finite_toggled)

    def update_spinner_suffix(self, widget):
        if widget.get_value() == 1:
            self.suffix.set_label(_("day"))
        else:
            self.suffix.set_label(_("days"))

    def bind_spinner(self):
        self.settings.bind(GTK_RECENT_MAX_AGE, self.spinner, "value", Gio.SettingsBindFlags.DEFAULT)

    def unbind_spinner(self):
        Gio.Settings.unbind(hash(self.spinner), "value")

    def on_indefinite_toggled(self, widget):
        active = widget.get_active()

        if active:
            self.unbind_spinner()
            self.settings.set_int(GTK_RECENT_MAX_AGE, -1)

    def on_finite_toggled(self, widget):
        active = widget.get_active()
        cur_val = self.spinner.get_value()

        if active:
            if self.settings.get_int(GTK_RECENT_MAX_AGE) < 1:
                if cur_val > 0:
                    self.settings.set_int(GTK_RECENT_MAX_AGE, cur_val)
            self.bind_spinner()

