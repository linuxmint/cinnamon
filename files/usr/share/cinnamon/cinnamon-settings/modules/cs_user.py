#!/usr/bin/python3

from random import randint
import shutil
import os
import subprocess

from PIL import Image
import gi
gi.require_version('AccountsService', '1.0')
from gi.repository import AccountsService, GLib, GdkPixbuf, Gtk

from SettingsWidgets import SidePage
from ChooserButtonWidgets import PictureChooserButton
from xapp.GSettingsWidgets import *
from ChangePasswordDialog import ChangePasswordDialog

class Module:
    name = "user"
    category = "prefs"
    comment = _("Change your user preferences and password")

    def __init__(self, content_box):
        keywords = _("user, account, information, details, password")
        sidePage = SidePage(_("Account details"), "cs-user", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.window = None

    def _setParentRef(self, window):
        self.window = window

    def on_module_selected(self):
        if not self.loaded:
            print("Loading User module")

            page = SettingsPage()
            self.sidePage.add_widget(page)

            settings = page.add_section(_("Account details"))

            self.scale = self.window.get_scale_factor()

            self.face_button = PictureChooserButton(num_cols=4, button_picture_width=64, menu_picture_width=64*self.scale, keep_square=True)
            self.face_button.set_alignment(0.0, 0.5)
            self.face_button.set_tooltip_text(_("Click to change your picture"))

            self.face_photo_menuitem = Gtk.MenuItem.new_with_label(_("Take a photo..."))
            self.face_photo_menuitem.connect('activate', self._on_face_photo_menuitem_activated)

            self.face_browse_menuitem = Gtk.MenuItem.new_with_label(_("Browse for more pictures..."))
            self.face_browse_menuitem.connect('activate', self._on_face_browse_menuitem_activated)

            face_dirs = ["/usr/share/cinnamon/faces"]
            for face_dir in face_dirs:
                if os.path.exists(face_dir):
                    pictures = sorted(os.listdir(face_dir))
                    for picture in pictures:
                        path = os.path.join(face_dir, picture)
                        self.face_button.add_picture(path, self._on_face_menuitem_activated)

            widget = SettingsWidget()
            label = Gtk.Label.new(_("Picture"))
            widget.pack_start(label, False, False, 0)
            widget.pack_end(self.face_button, False, False, 0)
            settings.add_row(widget)

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            widget = SettingsWidget()
            label = Gtk.Label.new(_("Name"))
            widget.pack_start(label, False, False, 0)
            self.realname_entry = EditableEntry()
            size_group.add_widget(self.realname_entry)
            self.realname_entry.connect("changed", self._on_realname_changed)
            self.realname_entry.set_tooltip_text(_("Click to change your name"))
            widget.pack_end(self.realname_entry, False, False, 0)
            settings.add_row(widget)

            widget = SettingsWidget()
            label = Gtk.Label.new(_("Password"))
            widget.pack_start(label, False, False, 0)
            password_mask = Gtk.Label.new('\u2022\u2022\u2022\u2022\u2022\u2022')
            password_mask.set_alignment(0.9, 0.5)
            self.password_button = Gtk.Button()
            size_group.add_widget(self.password_button)
            self.password_button.add(password_mask)
            self.password_button.set_relief(Gtk.ReliefStyle.NONE)
            self.password_button.set_tooltip_text(_("Click to change your password"))
            self.password_button.connect('activate', self._on_password_button_clicked)
            self.password_button.connect('released', self._on_password_button_clicked)
            widget.pack_end(self.password_button, False, False, 0)
            settings.add_row(widget)

            current_user = GLib.get_user_name()
            self.accountService = AccountsService.UserManager.get_default().get_user(current_user)
            self.accountService.connect('notify::is-loaded', self.load_user_info)

            self.face_button.add_separator()

            # Video devices assumed to be webcams
            import glob
            webcam_detected = len(glob.glob("/dev/video*")) > 0

            if webcam_detected:
                self.face_button.add_menuitem(self.face_photo_menuitem)

            self.face_button.add_menuitem(self.face_browse_menuitem)

    def update_preview_cb (self, dialog, preview):
        filename = dialog.get_preview_filename()
        if filename is not None:
            if os.path.isfile(filename):
                try:
                    pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(filename, 128, 128)
                    if pixbuf is not None:
                        preview.set_from_pixbuf(pixbuf)
                        self.frame.show()
                        return
                except GLib.Error as e:
                    print(f"Unable to generate preview for file '{filename}' - {e.message}\n")

        preview.clear()
        self.frame.hide()

    def _on_face_photo_menuitem_activated(self, menuitem):

        # streamer takes -t photos, uses /dev/video0
        if 0 != subprocess.call(["streamer", "-j90", "-t8", "-s800x600", "-o", "/tmp/temp-account-pic00.jpeg"]):
            print("Error: Webcam not available")
            return

        # Use the 8th frame (the webcam takes a few frames to "lighten up")
        path = "/tmp/temp-account-pic07.jpeg"

        # Crop the image to thumbnail size
        image = Image.open(path)
        width, height = image.size

        if width > height:
            new_width = height
            new_height = height
        elif height > width:
            new_width = width
            new_height = width
        else:
            new_width = width
            new_height = height

        left = (width - new_width) / 2
        top = (height - new_height) / 2
        right = (width + new_width) / 2
        bottom = (height + new_height) / 2

        image = image.crop((left, top, right, bottom))
        image.thumbnail((255, 255), Image.LANCZOS)

        face_path = os.path.join(self.accountService.get_home_dir(), ".face")

        image.save(face_path, "png")
        self.accountService.set_icon_file(face_path)
        self.face_button.set_picture_from_file(face_path)


    def _on_face_browse_menuitem_activated(self, menuitem):
        dialog = Gtk.FileChooserDialog(None, None, Gtk.FileChooserAction.OPEN, (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL, Gtk.STOCK_OPEN, Gtk.ResponseType.OK))
        dialog.set_current_folder(self.accountService.get_home_dir())
        filter = Gtk.FileFilter()
        filter.set_name(_("Images"))
        filter.add_mime_type("image/*")
        dialog.add_filter(filter)

        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.frame = Gtk.Frame(visible=False, no_show_all=True)
        preview = Gtk.Image(visible=True)

        box.pack_start(self.frame, False, False, 0)
        self.frame.add(preview)
        dialog.set_preview_widget(box)
        dialog.set_preview_widget_active(True)
        dialog.set_use_preview_label(False)

        box.set_margin_end(12)
        box.set_margin_top(12)
        box.set_size_request(128, -1)

        dialog.connect("update-preview", self.update_preview_cb, preview)

        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            string = dialog.get_filename()
            print(string)
            if string.startswith("/"):
                path = string
            else:
                theme = Gtk.IconTheme.get_default()
                icon_info = theme.lookup_icon_for_scale(string, 256, dialog.get_scale_factor(), Gtk.IconLookupFlags.FORCE_SIZE)
                path = icon_info.get_filename() if icon_info else None

            face_path = os.path.join(self.accountService.get_home_dir(), ".face")

            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(path, 255, -1)
            pixbuf.savev(face_path, "png")
            self.accountService.set_icon_file(path)
            self.face_button.set_picture_from_file(path)

        dialog.destroy()

    def _on_face_menuitem_activated(self, path):
        if os.path.exists(path):
            self.accountService.set_icon_file(path)
            shutil.copy(path, os.path.join(self.accountService.get_home_dir(), ".face"))
            return True

    def load_user_info(self, user, param):
        self.realname_entry.set_text(user.get_real_name())
        for path in [os.path.join(self.accountService.get_home_dir(), ".face"), user.get_icon_file(), "/usr/share/cinnamon/faces/user-generic.png"]:
            if os.path.exists(path):
                self.face_button.set_picture_from_file(path)
                break

    def _on_realname_changed(self, widget, text):
        self.accountService.set_real_name(text)

    def _on_password_button_clicked(self, widget):
        dialog = ChangePasswordDialog(self.accountService)
        dialog.run()

