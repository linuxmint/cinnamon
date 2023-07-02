#! /usr/bin/python3

"""
Close dialog spawned by cinnamon (closeDialog.js) that prompts the user to kill a hung window.
"""
import signal
import gettext
import argparse

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('XApp', '1.0')

from gi.repository import GLib, Gtk, GdkX11, Gdk, XApp

signal.signal(signal.SIGINT, signal.SIG_DFL)

gettext.install("cinnamon", "/usr/share/locale", names=["ngettext"])

UNSET = -1
KILL = 0
WAIT = 1

global response
response = UNSET

class CloseDialog(XApp.GtkWindow):
    def __init__(self, parent_xid, title):
        XApp.GtkWindow.__init__(self,
                                resizable=False,
                                modal=True,
                                type_hint=Gdk.WindowTypeHint.DIALOG)

        self.set_title("")
        self.set_default_size(300, -1)
        self.set_skip_taskbar_hint(True)

        mainbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.add(mainbox)

        content_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL,
                              halign=Gtk.Align.CENTER,
                              margin_left=10, margin_right=10)
        mainbox.pack_start(content_box, True, False, 0)

        image = Gtk.Image(icon_name="window-close-symbolic", pixel_size=48)
        content_box.pack_start(image, False, True, 0)

        text = _("%s is not responding.") % title
        prompt = Gtk.Label(label="<b>%s</b>" % text, use_markup=True, wrap=True)
        content_box.pack_start(prompt, True, True, 5)

        bb = Gtk.ButtonBox(layout_style=Gtk.ButtonBoxStyle.SPREAD,
                           spacing=10)
        mainbox.pack_end(bb, False, False, 10)

        button = Gtk.Button(label=_("Force quit"))
        button.get_style_context().add_class(Gtk.STYLE_CLASS_DESTRUCTIVE_ACTION)
        bb.pack_start(button, False, False, 0)
        button.connect("clicked", self.force_quit_clicked)

        button = Gtk.Button(label=_("Wait"))
        bb.pack_start(button, False, False, 0)
        button.connect("clicked", self.wait_clicked)

        self.show_all()

        self.connect("delete-event", lambda w, e: self.return_response(WAIT))
        GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, signal.SIGTERM, lambda: self.return_response(WAIT))

        self.realize()

        try:
            parent = GdkX11.X11Window.foreign_new_for_display(Gdk.Display.get_default(), parent_xid)
            self.get_window().set_transient_for(parent)
        except TypeError:
            parent = None

    def force_quit_clicked(self, button):
        self.return_response(KILL)

    def wait_clicked(self, button):
        self.return_response(WAIT)

    def return_response(self, code):
        global response
        response = code
        Gtk.main_quit()

if __name__ == "__main__":

    parser = argparse.ArgumentParser(description="Cinnamon dialog for force-closing stuck windows.\n Returns 0 to confirm, 1 to wait, 2 this window was terminated.")
    parser.add_argument("xid", type=int, help="The parent window's xid")
    parser.add_argument("message", type=str, help="The program title")

    args = parser.parse_args()

    dialog = CloseDialog(args.xid, args.message)
    Gtk.main()
    dialog.destroy()

    print(response)
    exit(response)

