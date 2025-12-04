#!/usr/bin/python3

from random import randint
import subprocess

import gi
gi.require_version('AccountsService', '1.0')
from gi.repository import AccountsService, GLib, Gtk

class ChangePasswordDialog(Gtk.Dialog):

    def __init__ (self, accountsUser, password_mask_label=None, group_mask_label=None, parent = None):
        super(ChangePasswordDialog, self).__init__()

        self.accountsUser = accountsUser
        self.password_mask = password_mask_label
        self.group_mask = group_mask_label

        self.set_modal(True)
        self.set_skip_taskbar_hint(True)
        self.set_skip_pager_hint(True)
        self.set_title(_("Change Password"))
        self.set_default_size(400, -1)

        table = Gtk.Table(5, 3)
        table.set_border_width(6)
        table.set_row_spacings(8)
        table.set_col_spacings(8)

        label = Gtk.Label(label=_("New password"), halign=Gtk.Align.END)
        label.set_alignment(1, 0.5)
        table.attach(label, 0, 1, 0, 1, xoptions=Gtk.AttachOptions.FILL)

        label = Gtk.Label(label=_("Confirm password"), halign=Gtk.Align.END)
        label.set_alignment(1, 0.5)
        table.attach(label, 0, 1, 2, 3, xoptions=Gtk.AttachOptions.FILL)

        self.new_password = Gtk.Entry()
        self.new_password.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, "view-refresh-symbolic")
        self.new_password.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("Generate a password"))
        self.new_password.set_tooltip_text(_("Generate a password"))
        self.new_password.connect("icon-release", self._on_new_password_icon_released)
        self.new_password.connect("changed", self._on_passwords_changed)
        table.attach(self.new_password, 1, 3, 0, 1)

        self.strengh_indicator = Gtk.ProgressBar(valign=Gtk.Align.CENTER)
        self.strengh_indicator.set_tooltip_text(_("Your new password needs to be at least 8 characters long"))
        self.strengh_indicator.set_fraction(0.0)
        table.attach(self.strengh_indicator, 1, 2, 1, 2)
        self.strengh_indicator.set_size_request(-1, 1)

        self.strengh_label = Gtk.Label()
        self.strengh_label.set_tooltip_text(_("Your new password needs to be at least 8 characters long"))
        self.strengh_label.set_alignment(1, 0.5)
        table.attach(self.strengh_label, 2, 3, 1, 2)

        self.confirm_password = Gtk.Entry()
        self.confirm_password.connect("changed", self._on_passwords_changed)
        table.attach(self.confirm_password, 1, 3, 2, 3)

        self.show_password = Gtk.CheckButton(_("Show password"))
        self.show_password.connect('toggled', self._on_show_password_toggled)
        table.attach(self.show_password, 1, 3, 3, 4)

        self.set_border_width(6)

        box = self.get_content_area()
        box.add(table)
        self.show_all()

        self.infobar = Gtk.InfoBar()
        self.infobar.set_message_type(Gtk.MessageType.ERROR)
        self.infobar_label = Gtk.Label.new(_("An error occurred. Your password was not changed."))
        content = self.infobar.get_content_area()
        content.add(self.infobar_label)
        table.attach(self.infobar, 0, 3, 4, 5)

        self.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL, _("Change"), Gtk.ResponseType.OK)

        self.set_passwords_visibility()
        self.set_response_sensitive(Gtk.ResponseType.OK, False)
        self.infobar.hide()

        self.connect("response", self._on_response)

    def _on_response(self, dialog, response_id):
        if response_id == Gtk.ResponseType.OK:
            self.change_password()
        else:
            self.destroy()

    def change_password(self):
        self.hide()
        GLib.timeout_add(500, self._do_change_password)

    def _do_change_password(self):
        newpass = self.new_password.get_text()

        # AccountsService will automatically trigger polkit authentication
        self.accountsUser.set_password(newpass, "")

        if self.group_mask is not None:
            mask = self.group_mask.get_text()
            if "nopasswdlogin" in mask:
                subprocess.call(["gpasswd", "-d", self.accountsUser.get_user_name(), "nopasswdlogin"])
                mask = mask.split(", ")
                mask.remove("nopasswdlogin")
                mask = ", ".join(mask)
                self.group_mask.set_text(mask)
                self.password_mask.set_text('\u2022\u2022\u2022\u2022\u2022\u2022')

        self.destroy()
        return GLib.SOURCE_REMOVE

    def set_passwords_visibility(self):
        visible = self.show_password.get_active()
        self.new_password.set_visibility(visible)
        self.confirm_password.set_visibility(visible)

    def _on_new_password_icon_released(self, widget, icon_pos, event):
        self.infobar.hide()
        self.show_password.set_active(True)
        characters = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-"
        newpass = ""
        for i in range (8):
            index = randint(0, len(characters) -1)
            newpass = newpass + characters[index]

        self.new_password.set_text(newpass)
        self.confirm_password.set_text(newpass)
        self.check_passwords()

    def _on_show_password_toggled(self, widget):
        self.set_passwords_visibility()

    # Based on setPasswordStrength() in Mozilla Seamonkey, which is tri-licensed under MPL 1.1, GPL 2.0, and LGPL 2.1.
    # Forked from Ubiquity validation.py
    def password_strength(self, password):
        upper = lower = digit = symbol = 0
        for char in password:
            if char.isdigit():
                digit += 1
            elif char.islower():
                lower += 1
            elif char.isupper():
                upper += 1
            else:
                symbol += 1
        length = len(password)

        length = min(length,4)
        digit = min(digit,3)
        upper = min(upper,3)
        symbol = min(symbol,3)
        strength = (
            ((length * 0.1) - 0.2) +
            (digit * 0.1) +
            (symbol * 0.15) +
            (upper * 0.1))
        if strength > 1:
            strength = 1
        if strength < 0:
            strength = 0
        return strength

    def _on_passwords_changed(self, widget):
        self.infobar.hide()
        new_password = self.new_password.get_text()
        confirm_password = self.confirm_password.get_text()
        strength = self.password_strength(new_password)
        if new_password != confirm_password:
            self.confirm_password.set_icon_from_stock(Gtk.EntryIconPosition.SECONDARY, Gtk.STOCK_DIALOG_WARNING)
            self.confirm_password.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("Passwords do not match"))
            self.confirm_password.set_tooltip_text(_("Passwords do not match"))
        else:
            self.confirm_password.set_icon_from_stock(Gtk.EntryIconPosition.SECONDARY, None)
            self.confirm_password.set_tooltip_text("")
        if len(new_password) < 8:
            self.strengh_label.set_text(_("Too short"))
            self.strengh_indicator.set_fraction(0.0)
        elif strength < 0.6:
            self.strengh_label.set_text(_("Weak"))
            self.strengh_indicator.set_fraction(0.2)
        elif strength < 0.75:
            self.strengh_label.set_text(_("Fair"))
            self.strengh_indicator.set_fraction(0.4)
        elif strength < 0.9:
            self.strengh_label.set_text(_("Good"))
            self.strengh_indicator.set_fraction(0.6)
        else:
            self.strengh_label.set_text(_("Strong"))
            self.strengh_indicator.set_fraction(1.0)

        self.check_passwords()

    def check_passwords(self):
        new_password = self.new_password.get_text()
        confirm_password = self.confirm_password.get_text()
        if len(new_password) >= 8 and new_password == confirm_password:
            self.set_response_sensitive(Gtk.ResponseType.OK, True)
        else:
            self.set_response_sensitive(Gtk.ResponseType.OK, False)
