#!/usr/bin/python3
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk, GLib

class MessageDialogWindow(Gtk.Window):
    counter = 0

    def __init__(self):
        super(MessageDialogWindow, self).__init__(title="Urgent MessageDialog")

    def show_urgent(self):
        self.set_urgency_hint(self.counter%2 == 0)
        self.counter = self.counter + 1
        if self.counter < 10:
            GLib.timeout_add(1000 * (self.counter % 7), self.show_urgent)
        else:
            self.set_urgency_hint(1==1)


win = MessageDialogWindow()
win.connect("delete-event", Gtk.main_quit)
win.show_all()
GLib.timeout_add(3000, win.show_urgent)
Gtk.main()
