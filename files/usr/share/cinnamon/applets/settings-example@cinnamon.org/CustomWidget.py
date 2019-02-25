#!/usr/bin/python3

import random
from JsonSettingsWidgets import *
from gi.repository import Gio, Gtk

class MyWidget(SettingsWidget):
    def __init__(self, info, key, settings):
        SettingsWidget.__init__(self)
        self.key = key
        self.settings = settings
        self.info = info

        self.pack_start(Gtk.Label(_(info['description']), halign=Gtk.Align.START), True, True, 0)
        self.entry = Gtk.Entry()
        self.settings.bind('custom-widget', self.entry, 'text', Gio.SettingsBindFlags.DEFAULT)
        self.button = Gtk.Button(_("Random"))
        self.button.connect('clicked', self.button_pressed)
        self.pack_end(self.button, False, False, 0)
        self.pack_end(self.entry, False, False, 0)

    def button_pressed(self, *args):
        self.entry.set_text(str(random.randint(0, 9)))
