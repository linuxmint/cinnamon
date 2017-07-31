#!/usr/bin/python2

import os
import subprocess
import gettext
import pwd

import gi
gi.require_version("Gtk", "3.0")
gi.require_version("XApp", "1.0")
from gi.repository import Gtk, XApp

# i18n
gettext.install("cinnamon", "/usr/share/locale")


class MainWindow:

    ''' Create the UI '''

    def __init__(self):

        user_id = os.getuid()
        username = pwd.getpwuid(user_id).pw_name
        real_name = pwd.getpwuid(user_id).pw_gecos
        home_dir = pwd.getpwuid(user_id).pw_dir

        real_name = real_name.replace(",", "")
        if real_name == "":
            real_name = username

        self.builder = Gtk.Builder()
        self.builder.add_from_file("/usr/share/cinnamon/cinnamon-screensaver-lock-dialog/cinnamon-screensaver-lock-dialog.ui")

        self.window = self.builder.get_object("main_dialog")
        self.button_cancel = self.builder.get_object("button_cancel")
        self.button_ok = self.builder.get_object("button_ok")
        self.entry = self.builder.get_object("entry_away_message")
        self.image = self.builder.get_object("image_face")

        self.window.set_title(_("Screen Locker"))
        XApp.set_window_icon_name(self.window, "cs-screensaver")

        self.builder.get_object("label_description").set_markup("<i>%s</i>" % _("Please type an away message for the lock screen"))
        self.builder.get_object("label_away_message").set_markup("<b>%s: </b>" % real_name)

        if os.path.exists("%s/.face" % home_dir):
            self.image.set_from_file("%s/.face" % home_dir)
        else:
            self.image.set_from_icon_name("cs-screensaver", Gtk.IconSize.DIALOG)

        self.window.connect("destroy", Gtk.main_quit)
        self.button_cancel.connect("clicked", Gtk.main_quit)
        self.button_ok.connect('clicked', self.lock_screen)
        self.entry.connect('activate', self.lock_screen)

        self.builder.get_object("dialog-action_area1").set_focus_chain((self.button_ok, self.button_cancel))

        self.window.show()

    def lock_screen(self, data):
        message = self.entry.get_text()
        if (message != ""):
            subprocess.call(["cinnamon-screensaver-command", "--lock", "--away-message", self.entry.get_text()])
        else:
            subprocess.call(["cinnamon-screensaver-command", "--lock"])
        Gtk.main_quit()

if __name__ == "__main__":
    MainWindow()
    Gtk.main()
