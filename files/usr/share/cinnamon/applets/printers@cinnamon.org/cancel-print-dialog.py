#!/usr/bin/python3

import sys
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
import gettext

# i18n
gettext.install("cinnamon", "/usr/share/locale")

class CancelPrintJob:
    def __init__(self):
        self.message_dialog = Gtk.MessageDialog(
            parent=Gtk.Window(),
            type=Gtk.MessageType.QUESTION,
            title=window_title,
            message_format=message,
            buttons=Gtk.ButtonsType.NONE
            )
        self.message_dialog.add_buttons(continue_button_text, True, cancel_button_text, False)

        response = self.message_dialog.run()
        if response:
            print("Continue")
        else:
            print("Cancel")
        self.message_dialog.destroy()

if __name__ == "__main__":
    window_title = _("Cancel Job")
    message = _("Do you really want to cancel this job?")
    cancel_button_text = _("Cancel Job")
    continue_button_text = _("Keep Printing")
    if len(sys.argv) == 2 and sys.argv[1] == "all":
        message = _("Do you really want to cancel all jobs?")
        cancel_button_text = _("Cancel All Jobs")
    CancelPrintJob()
