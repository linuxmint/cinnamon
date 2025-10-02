#!/usr/bin/python3

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('XApp', '1.0')
from gi.repository import Gio, GLib, GObject, Gtk
import sys
import signal
import json
from pathlib import Path

signal.signal(signal.SIGINT, signal.SIG_DFL)


DBUS_NAME = "org.x.StatusIcon"
DBUS_PATH = "/org/x/StatusIcon"

class LayoutRow(GObject.Object):
    def __init__(self, shortname, json_info):
        super(LayoutRow, self).__init__()

        self.shortname = shortname
        self.name = json_info["name"]
        self.locale = json_info["locale"]

class OskLayoutTester():
    def __init__(self):
        self.window = None
        self.window = Gtk.Window()
        self.window.set_default_size(300, 400)
        self.window.connect("destroy", self.on_window_destroy)
        self.window_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.main_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL,
                                margin=6,
                                spacing=0)

        self.window_box.pack_start(self.main_box, True, True, 0)

        # list stuff
        sw_frame = Gtk.Frame()
        sw = Gtk.ScrolledWindow(hadjustment=None, vadjustment=None)
        sw_frame.add(sw)

        self.store = Gio.ListStore(item_type=LayoutRow)

        self.list_box = Gtk.ListBox(activate_on_single_click=True)
        self.list_box.connect("row-activated", self.on_row_activated)
        self.list_box.bind_model(self.store, self.new_row_widget)

        sw.add(self.list_box)

        self.main_box.pack_start(sw_frame, True, True, 6)
        self.window.add(self.window_box)

        self.window.show_all()

        self.input_source_settings = Gio.Settings.new("org.cinnamon.desktop.input-sources")
        print("Saving original sources")
        self.orig_sources = self.input_source_settings.get_value("sources")

        self.shortname_size_group = Gtk.SizeGroup(mode=Gtk.SizeGroupMode.HORIZONTAL)
        self.load_layouts()

    def load_layouts(self):
        for file in Path.cwd().iterdir():
            if file.suffix != ".json":
                continue

            with open(file, "r") as f:
                json_info = json.load(f)
            self.store.append(LayoutRow(file.stem, json_info))

        self.store.sort(self.sort_rows)

    def sort_rows(self, a, b, data=None):
        if a.shortname < b.shortname:
            return -1
        elif a.shortname > b.shortname:
            return 1
        else:
            return 0

    def new_row_widget(self, item, data=None):
        box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)

        label = Gtk.Label(label=f"<b>{item.shortname}</b>", visible=True, xalign=0, use_markup=True)
        self.shortname_size_group.add_widget(label)
        box.pack_start(label, False, False, 6)
        label = Gtk.Label(label=item.name, visible=True, xalign=0)
        box.pack_start(label, True, True, 0)
        label = Gtk.Label(label=f"<b>{item.locale}</b>", visible=True, xalign=0, use_markup=True)
        box.pack_end(label, False, False, 6)

        row = Gtk.ListBoxRow()
        row.add(box)
        row.name = item.shortname
        row.show_all()
        return row

    def on_row_activated(self, box, row, data=None):
        self.input_source_settings.set_value("sources", GLib.Variant("a(ss)", [("xkb", row.name)]))

    def on_window_destroy(self, widget, data=None):
        self.quit()

    def quit(self):
        if self.orig_sources is not None:
            print("Restoring original sources")
            self.input_source_settings.set_value("sources", self.orig_sources)

        Gtk.main_quit()

if __name__ == '__main__':
    test = OskLayoutTester()
    Gtk.main()
