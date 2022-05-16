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

from gi.repository import GLib, Gtk, Gdk, XApp

signal.signal(signal.SIGINT, signal.SIG_DFL)

gettext.install("cinnamon", "/usr/share/locale", names=["ngettext"])

UNSET = -1
CONFIRM = 0
CANCEL = 1

global response
response = UNSET

class DisplayChangeDialog(XApp.GtkWindow):
    def __init__(self, timeout):
        XApp.GtkWindow.__init__(self,
                                resizable=False,
                                type_hint=Gdk.WindowTypeHint.DIALOG)

        self.timeout = timeout
        self.countdown = timeout

        self.set_title("Confirm Display Configuration")
        self.set_icon_name("display")
        self.set_default_size(300, 150)
        self.set_keep_above(True)

        mainbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL,
                         margin_top=10)
        self.add(mainbox)

        content_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL,
                              halign=Gtk.Align.CENTER)
        mainbox.pack_start(content_box, True, False, 0)

        image = Gtk.Image(icon_name="preferences-desktop-display", pixel_size=48)
        content_box.pack_start(image, False, True, 0)

        text = _("Does the display look ok?")
        prompt = Gtk.Label(label="<b>%s</b>" % text, use_markup=True, wrap=True)
        content_box.pack_start(prompt, True, True, 5)

        bb = Gtk.ButtonBox(layout_style=Gtk.ButtonBoxStyle.SPREAD,
                           spacing=10)
        mainbox.pack_end(bb, False, False, 10)

        self.cancel_button = Gtk.Button(label=_("Cancel changes"))
        bb.pack_start(self.cancel_button, False, False, 0)
        self.cancel_button.connect("clicked", self.cancel_changes_clicked)

        button = Gtk.Button(label=_("Keep new configuration"))
        button.get_style_context().add_class(Gtk.STYLE_CLASS_SUGGESTED_ACTION)
        bb.pack_start(button, False, False, 0)
        button.connect("clicked", self.keep_changes_clicked)

        self.show_all()

        self.connect("delete-event", lambda w, e: self.return_response(CANCEL))
        GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, signal.SIGTERM, lambda: self.return_response(CANCEL))

        self.set_progress(100)
        self.update_cancel_label()
        GLib.timeout_add(1000, self.dialog_timer_tick)

    def update_cancel_label(self):
        self.cancel_button.set_label(_("Cancel changes... %ds") % self.countdown)

    def dialog_timer_tick(self):
        self.countdown -= 1

        if self.countdown == 0:
            self.return_response(CANCEL)
            return GLib.SOURCE_REMOVE

        self.update_cancel_label()
        self.set_progress((100 / self.timeout) * self.countdown)

        return GLib.SOURCE_CONTINUE

    def cancel_changes_clicked(self, button):
        self.return_response(CANCEL)

    def keep_changes_clicked(self, button):
        self.return_response(CONFIRM)

    def return_response(self, code):
        global response
        response = code
        Gtk.main_quit()

if __name__ == "__main__":

    parser = argparse.ArgumentParser(description="Cinnamon dialog confirming display changed.\n Returns 0 to confirm, 1 revert.")
    parser.add_argument("timeout", type=int, help="The number of seconds to wait before reverting changes")

    args = parser.parse_args()

    dialog = DisplayChangeDialog(args.timeout)
    Gtk.main()
    dialog.destroy()

    print(response)
    exit(response)

