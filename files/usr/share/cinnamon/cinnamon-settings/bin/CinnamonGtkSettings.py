#!/usr/bin/python2

import os.path

import gi
gi.require_version("Gtk", "3.0")
from gi.repository import GLib, Gtk

from  SettingsWidgets import SettingsWidget

SETTINGS_GROUP_NAME = "Settings"

instance = None

def get_editor():
    global instance

    if instance == None:
        instance = GtkSettingsEditor()

    return instance

class GtkSettingsEditor:
    def __init__(self):
        self._path = os.path.join(GLib.get_user_config_dir(),
                                  "gtk-3.0",
                                  "settings.ini")
    def _get_keyfile(self):
        keyfile = None
        try:
            keyfile = GLib.KeyFile()
            keyfile.load_from_file(self._path, 0)
        except:
            pass
        finally:
            return keyfile

    def get_boolean(self, key):
        keyfile = self._get_keyfile()
        try:
            result = keyfile.get_boolean(SETTINGS_GROUP_NAME, key)
        except:
            result = False

        return result

    def set_boolean(self, key, value):
        print "set", value
        keyfile = self._get_keyfile()
        keyfile.set_boolean(SETTINGS_GROUP_NAME, key, value)

        try:
            data = keyfile.to_data()
            GLib.file_set_contents(self._path, data[0])
        except:
            raise

class GtkSettingsSwitch(SettingsWidget):
    def __init__(self, markup, setting_name=None):
        self.setting_name = setting_name
        super(GtkSettingsSwitch, self).__init__(dep_key=None)

        self.content_widget = Gtk.Switch()
        self.content_widget.set_valign(Gtk.Align.CENTER)
        self.label = Gtk.Label()
        self.label.set_markup(markup)
        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.settings = get_editor()
        self.content_widget.set_active(self.settings.get_boolean(self.setting_name))

        self.content_widget.connect("notify::active", self.clicked)

    def clicked(self, widget, data=None):
        self.settings.set_boolean(self.setting_name, self.content_widget.get_active())
