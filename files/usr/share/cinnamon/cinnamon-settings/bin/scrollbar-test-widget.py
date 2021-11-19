#!/usr/bin/python3

import signal
import sys

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib

class ScrollbarTestWidget:
    def __init__(self):
        self.builder = Gtk.Builder()
        self.builder.set_translation_domain('cinnamon')

        self.builder.add_from_file("/usr/share/cinnamon/cinnamon-settings/bin/scrollbar-test-widget.glade")
        self.content_box = self.builder.get_object("content_box")

        # In hidpi, the size request seems to be doubled, resulting in too high a test window.
        # Check and adjust here at runtime.
        if self.content_box.get_scale_factor() == 2:
            self.content_box.set_size_request(-1, 50)

        GLib.unix_signal_add(GLib.PRIORITY_HIGH, signal.SIGTERM, self.on_terminate)

        plug = Gtk.Plug.new(int(sys.argv[1]))
        plug.add(self.content_box)

        plug.connect("destroy", Gtk.main_quit)
        plug.show_all()

    def on_terminate(self, data=None):
        Gtk.main_quit()

if len(sys.argv) < 2:
    exit()

ScrollbarTestWidget()
Gtk.main()
