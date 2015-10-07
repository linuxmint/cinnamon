#!/usr/bin/env python2

import sys, os, commands
import pwd, grp
from gi.repository import Gtk, GObject, Gio, GdkPixbuf, AccountsService
import gettext
import shutil
import PIL
from PIL import Image
from random import randint
import re
import subprocess

gettext.install("cinnamon", "/usr/share/locale")

(INDEX_USER_OBJECT, INDEX_USER_PICTURE, INDEX_USER_DESCRIPTION) = range(3)
(INDEX_GID, INDEX_GROUPNAME) = range(2)

class GroupDialog (Gtk.Dialog):
    def __init__ (self, label, value):
        super(GroupDialog, self).__init__()

        try:
            self.set_modal(True)
            self.set_skip_taskbar_hint(True)
            self.set_skip_pager_hint(True)
            self.set_title("")

            table = DimmedTable()
            table.add_labels([label])

            self.entry = Gtk.Entry()
            self.entry.set_text(value)
            self.entry.connect("changed", self._on_entry_changed)
            table.add_controls([self.entry])

            self.set_border_width(6)

            box = self.get_content_area()
            box.add(table)
            self.show_all()

            self.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL, Gtk.STOCK_OK, Gtk.ResponseType.OK, )
            self.set_response_sensitive(Gtk.ResponseType.OK, False)

        except Exception, detail:
            print detail

    def _on_entry_changed(self, entry):
        name = entry.get_text()
        if " " in name or name.lower() != name:
            entry.set_icon_from_stock(Gtk.EntryIconPosition.SECONDARY, Gtk.STOCK_DIALOG_WARNING)
            entry.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("The group name cannot contain upper-case or space characters"))
            self.set_response_sensitive(Gtk.ResponseType.OK, False)
        else:
            entry.set_icon_from_stock(Gtk.EntryIconPosition.SECONDARY, None)
            self.set_response_sensitive(Gtk.ResponseType.OK, True)

        if entry.get_text() == "":
            self.set_response_sensitive(Gtk.ResponseType.OK, False)

class DimmedTable (Gtk.Table):
    def __init__ (self):
        super(DimmedTable, self).__init__()
        self.set_border_width(6)
        self.set_row_spacings(8)
        self.set_col_spacings(15)

    def add_labels(self, texts):
        row = 0
        for text in texts:
            if text != None:
                label = Gtk.Label(text)
                label.set_alignment(1, 0.5)
                label.get_style_context().add_class("dim-label")
                self.attach(label, 0, 1, row, row+1, xoptions=Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
            row = row + 1

    def add_controls(self, controls):
        row = 0
        for control in controls:
            self.attach(control, 1, 2, row, row+1)
            row = row + 1


class EditableEntry (Gtk.Notebook):

    __gsignals__ = {
        'changed': (GObject.SIGNAL_RUN_FIRST, None,
                      (str,))
    }

    PAGE_BUTTON = 0
    PAGE_ENTRY = 1

    def __init__ (self):
        super(EditableEntry, self).__init__()

        self.label = Gtk.Label()
        self.entry = Gtk.Entry()
        self.button = Gtk.Button()

        self.button.set_alignment(0.0, 0.5)
        self.button.set_relief(Gtk.ReliefStyle.NONE)
        self.append_page(self.button, None);
        self.append_page(self.entry, None);
        self.set_current_page(0)
        self.set_show_tabs(False)
        self.set_show_border(False)
        self.editable = False
        self.show_all()

        self.button.connect("released", self._on_button_clicked)
        self.button.connect("activate", self._on_button_clicked)
        self.entry.connect("activate", self._on_entry_validated)
        self.entry.connect("changed", self._on_entry_changed)

    def set_text(self, text):
        self.button.set_label(text)
        self.entry.set_text(text)

    def _on_button_clicked(self, button):
        self.set_editable(True)

    def _on_entry_validated(self, entry):
        self.set_editable(False)
        self.emit("changed", entry.get_text())

    def _on_entry_changed(self, entry):
        self.button.set_label(entry.get_text())

    def set_editable(self, editable):
        if (editable):
            self.set_current_page(EditableEntry.PAGE_ENTRY)
        else:
            self.set_current_page(EditableEntry.PAGE_BUTTON)
        self.editable = editable

    def set_tooltip_text(self, tooltip):
        self.button.set_tooltip_text(tooltip)

    def get_editable(self):
        return self.editable

    def get_text(self):
        return self.entry.get_text()

class PasswordDialog(Gtk.Dialog):

    def __init__ (self, user, password_mask, group_mask):
        super(PasswordDialog, self).__init__()

        self.user = user
        self.password_mask = password_mask
        self.group_mask = group_mask

        self.set_modal(True)
        self.set_skip_taskbar_hint(True)
        self.set_skip_pager_hint(True)
        self.set_title(_("Change Password"))

        table = DimmedTable()
        table.add_labels([_("New password"), None, _("Confirm password")])

        self.new_password = Gtk.Entry()
        self.new_password.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, "reload")
        self.new_password.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("Generate a password"))
        self.new_password.connect("icon-release", self._on_new_password_icon_released)
        self.new_password.connect("changed", self._on_passwords_changed)
        table.attach(self.new_password, 1, 3, 0, 1)

        self.strengh_indicator = Gtk.ProgressBar()
        self.strengh_indicator.set_tooltip_text(_("Your new password needs to be at least 8 characters long"))
        self.strengh_indicator.set_fraction(0.0)
        table.attach(self.strengh_indicator, 1, 2, 1, 2, xoptions=Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
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
        label = Gtk.Label(_("An error occured. Your password was not changed."))
        content = self.infobar.get_content_area()
        content.add(label)
        table.attach(self.infobar, 0, 3, 4, 5)

        self.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL, _("Change"), Gtk.ResponseType.OK, )

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
        newpass = self.new_password.get_text()
        self.user.set_password(newpass, "")
        mask = self.group_mask.get_text()
        if "nopasswdlogin" in mask:
            subprocess.call(["gpasswd", "-d", self.user.get_user_name(), "nopasswdlogin"])
            mask = mask.split(", ")
            mask.remove("nopasswdlogin")
            mask = ", ".join(mask)
            self.group_mask.set_text(mask)
            self.password_mask.set_text(u'\u2022\u2022\u2022\u2022\u2022\u2022')
        self.destroy()

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
        else:
            self.confirm_password.set_icon_from_stock(Gtk.EntryIconPosition.SECONDARY, None)
        if len(new_password) < 8:
            self.strengh_label.set_text(_("Too short"))
            self.strengh_indicator.set_fraction(0.0)
        elif strength < 0.5:
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

class NewUserDialog(Gtk.Dialog):

    def __init__ (self):
        super(NewUserDialog, self).__init__()

        try:
            self.set_modal(True)
            self.set_skip_taskbar_hint(True)
            self.set_skip_pager_hint(True)
            self.set_title("")

            self.account_type_combo = Gtk.ComboBoxText()
            self.account_type_combo.append_text(_("Standard"))
            self.account_type_combo.append_text(_("Administrator"))
            self.account_type_combo.set_active(0)

            self.realname_entry = Gtk.Entry()
            self.realname_entry.connect("changed", self._on_info_changed)

            self.username_entry = Gtk.Entry()
            self.username_entry.connect("changed", self._on_info_changed)

            label = Gtk.Label()
            label.set_markup(_("The username must consist of only:\n    - lower case letters (a-z)\n    - numerals (0-9)\n    - '.', '-', and '_' characters"))

            table = DimmedTable()
            table.add_labels([_("Account Type"), _("Full Name"), _("Username")])
            table.add_controls([self.account_type_combo, self.realname_entry, self.username_entry])

            self.set_border_width(6)

            box = self.get_content_area()
            box.add(table)
            box.add(label)
            self.show_all()

            self.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL, Gtk.STOCK_ADD, Gtk.ResponseType.OK, )
            self.set_response_sensitive(Gtk.ResponseType.OK, False)

        except Exception, detail:
            print detail

    def _on_info_changed(self, widget):
        fullname = self.realname_entry.get_text()
        username = self.username_entry.get_text()
        valid = True
        if re.search('[^a-z0-9_.-]', username):
            self.username_entry.set_icon_from_stock(Gtk.EntryIconPosition.SECONDARY, Gtk.STOCK_DIALOG_WARNING)
            self.username_entry.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("Invalid username"))
            valid = False
        else:
            self.username_entry.set_icon_from_stock(Gtk.EntryIconPosition.SECONDARY, None)
        if username == "" or fullname == "":
            valid = False

        self.set_response_sensitive(Gtk.ResponseType.OK, valid)

class GroupsDialog(Gtk.Dialog):

    def __init__ (self, username):
        super(GroupsDialog, self).__init__()

        try:
            self.set_modal(True)
            self.set_skip_taskbar_hint(True)
            self.set_skip_pager_hint(True)
            self.set_title("")
            self.set_default_size(200, 480)

            scrolled = Gtk.ScrolledWindow()
            viewport = Gtk.Viewport()
            vbox = Gtk.VBox()
            self.checkboxes = []
            groups = sorted(grp.getgrall(), key=lambda x: x[0], reverse=False)
            for group in groups:
                checkbox = Gtk.CheckButton(group[0])
                self.checkboxes.append(checkbox)
                vbox.add(checkbox)
                if username in group[3]:
                    checkbox.set_active(True)

            viewport.add(vbox)
            scrolled.add(viewport)
            self.set_border_width(6)

            box = self.get_content_area()
            box.pack_start(scrolled, True, True, 0)
            self.show_all()

            self.add_buttons(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL, Gtk.STOCK_OK, Gtk.ResponseType.OK, )

        except Exception, detail:
            print detail

    def get_selected_groups(self):
        groups = []
        for checkbox in self.checkboxes:
            if checkbox.get_active():
                groups.append(checkbox.get_label())
        return groups

class Module:
    def __init__(self):
        try:
            self.builder = Gtk.Builder()
            self.builder.add_from_file("/usr/lib/cinnamon-settings-users/cinnamon-settings-users.ui")
            self.window = self.builder.get_object("main_window")
            self.window.connect("destroy", Gtk.main_quit)

            self.window.set_title(_("Users and Groups"))
            self.builder.get_object("label_users").set_label(_("Users"))
            self.builder.get_object("label_groups").set_label(_("Groups"))

            self.builder.get_object("button_add_user").connect("clicked", self.on_user_addition)
            self.builder.get_object("button_delete_user").connect("clicked", self.on_user_deletion)
            self.builder.get_object("button_add_group").connect("clicked", self.on_group_addition)
            self.builder.get_object("button_edit_group").connect("clicked", self.on_group_edition)
            self.builder.get_object("button_delete_group").connect("clicked", self.on_group_deletion)

            self.users = Gtk.TreeStore(object, GdkPixbuf.Pixbuf, str)
            self.users.set_sort_column_id(2, Gtk.SortType.ASCENDING)

            self.groups = Gtk.TreeStore(int, str)
            self.groups.set_sort_column_id(1, Gtk.SortType.ASCENDING)

            self.users_treeview = self.builder.get_object("treeview_users")
            self.users_treeview.set_rules_hint(True)

            self.groups_treeview = self.builder.get_object("treeview_groups")

            self.users_treeview.get_selection().connect("changed", self.on_user_selection)
            self.groups_treeview.get_selection().connect("changed", self.on_group_selection)

            column = Gtk.TreeViewColumn()
            cell = Gtk.CellRendererPixbuf()
            column.pack_start(cell, True)
            column.add_attribute(cell, 'pixbuf', INDEX_USER_PICTURE)
            cell.set_property('ypad', 1)
            self.users_treeview.append_column(column)

            column = Gtk.TreeViewColumn()
            cell = Gtk.CellRendererText()
            column.pack_start(cell, True)
            column.add_attribute(cell, 'markup', INDEX_USER_DESCRIPTION)
            self.users_treeview.append_column(column)

            column = Gtk.TreeViewColumn()
            cell = Gtk.CellRendererText()
            column.pack_start(cell, True)
            column.add_attribute(cell, 'text', INDEX_GROUPNAME)
            column.set_sort_column_id(1)
            self.groups_treeview.append_column(column)

            self.builder.get_object("button_delete_user").set_sensitive(False)
            self.builder.get_object("button_edit_group").set_sensitive(False)
            self.builder.get_object("button_delete_group").set_sensitive(False)

            self.face_button = Gtk.Button()
            self.face_image = Gtk.Image()
            self.face_button.set_image(self.face_image)
            self.face_image.set_from_file("/usr/share/cinnamon/faces/user-generic.png")
            self.face_button.set_alignment(0.0, 0.5)
            self.face_button.set_tooltip_text(_("Click to change the picture"))

            self.menu = Gtk.Menu()

            separator = Gtk.SeparatorMenuItem()
            face_browse_menuitem = Gtk.MenuItem(_("Browse for more pictures..."))
            face_browse_menuitem.connect('activate', self._on_face_browse_menuitem_activated)
            self.face_button.connect("button-release-event", self.menu_display)

            row = 0
            col = 0
            num_cols = 4
            face_dirs = ["/usr/share/cinnamon/faces"]
            for face_dir in face_dirs:
                if os.path.exists(face_dir):
                    pictures = sorted(os.listdir(face_dir))
                    for picture in pictures:
                        path = os.path.join(face_dir, picture)
                        file = Gio.File.new_for_path(path)
                        file_icon = Gio.FileIcon.new(file)
                        image = Gtk.Image.new_from_gicon (file_icon, Gtk.IconSize.DIALOG)
                        menuitem = Gtk.MenuItem()
                        menuitem.add(image)
                        menuitem.connect('activate', self._on_face_menuitem_activated, path)
                        self.menu.attach(menuitem, col, col+1, row, row+1)
                        col = (col+1) % num_cols
                        if (col == 0):
                            row = row + 1

            row = row + 1

            self.menu.attach(separator, 0, 4, row, row+1)
            self.menu.attach(face_browse_menuitem, 0, 4, row+2, row+3)

            self.account_type_combo = Gtk.ComboBoxText()
            self.account_type_combo.append_text(_("Standard"))
            self.account_type_combo.append_text(_("Administrator"))
            self.account_type_combo.connect("changed", self._on_accounttype_changed)

            self.realname_entry = EditableEntry()
            self.realname_entry.connect("changed", self._on_realname_changed)
            self.realname_entry.set_tooltip_text(_("Click to change the name"))

            self.password_mask = Gtk.Label()
            self.password_mask.set_alignment(0.0, 0.5)
            self.password_button = Gtk.Button()
            self.password_button.add(self.password_mask)
            self.password_button.set_relief(Gtk.ReliefStyle.NONE)
            self.password_button.set_tooltip_text(_("Click to change the password"))
            self.password_button.connect('activate', self._on_password_button_clicked)
            self.password_button.connect('released', self._on_password_button_clicked)

            self.groups_label = Gtk.Label()
            self.groups_label.set_line_wrap(True)
            self.groups_label.set_alignment(0, 0.5)
            self.groups_button = Gtk.Button()
            self.groups_button.add(self.groups_label)
            self.groups_button.set_relief(Gtk.ReliefStyle.NONE)
            self.groups_button.set_tooltip_text(_("Click to change the groups"))
            self.groups_button.connect("clicked", self._on_groups_button_clicked)

            box = Gtk.Box()
            box.pack_start(self.face_button, False, False, 0)

            table = DimmedTable()
            table.add_labels([_("Picture"), _("Account Type"), _("Name"), _("Password"), _("Groups")])
            table.add_controls([box, self.account_type_combo, self.realname_entry, self.password_button, self.groups_button])

            self.builder.get_object("box_users").add(table)

            self.accountService = AccountsService.UserManager.get_default()
            self.accountService.connect('notify::is-loaded', self.on_accounts_service_loaded)

            self.load_groups()

            self.window.show_all()

            self.builder.get_object("box_users").hide()

        except Exception, detail:
            print detail

    def _on_password_button_clicked(self, widget):
        model, treeiter = self.users_treeview.get_selection().get_selected()
        if treeiter != None:
            user = model[treeiter][INDEX_USER_OBJECT]
            dialog = PasswordDialog(user, self.password_mask, self.groups_label)
            response = dialog.run()

    def _on_groups_button_clicked(self, widget):
        model, treeiter = self.users_treeview.get_selection().get_selected()
        if treeiter != None:
            user = model[treeiter][INDEX_USER_OBJECT]
            dialog = GroupsDialog(user.get_user_name())
            response = dialog.run()
            if response == Gtk.ResponseType.OK:
                groups = dialog.get_selected_groups()
                subprocess.call(["usermod", user.get_user_name(), "-G", ",".join(groups)])
                groups.sort()
                self.groups_label.set_text(", ".join(groups))
            dialog.destroy()

    def _on_accounttype_changed(self, combobox):
        model, treeiter = self.users_treeview.get_selection().get_selected()
        if treeiter != None:
            user = model[treeiter][INDEX_USER_OBJECT]
            if self.account_type_combo.get_active() == 1:
                user.set_account_type(AccountsService.UserAccountType.ADMINISTRATOR)
            else:
                user.set_account_type(AccountsService.UserAccountType.STANDARD)

            groups = []
            for group in grp.getgrall():
                if user.get_user_name() in group[3]:
                    groups.append(group[0])
            groups.sort()
            self.groups_label.set_text(", ".join(groups))

    def _on_realname_changed(self, widget, text):
        model, treeiter = self.users_treeview.get_selection().get_selected()
        if treeiter != None:
            user = model[treeiter][INDEX_USER_OBJECT]
            user.set_real_name(text)
            description = "<b>%s</b>\n%s" % (text, user.get_user_name())
            model.set_value(treeiter, INDEX_USER_DESCRIPTION, description)

    def _on_face_browse_menuitem_activated(self, menuitem):
        model, treeiter = self.users_treeview.get_selection().get_selected()
        if treeiter != None:
            user = model[treeiter][INDEX_USER_OBJECT]
            dialog = Gtk.FileChooserDialog(None, None, Gtk.FileChooserAction.OPEN, (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL, Gtk.STOCK_OPEN, Gtk.ResponseType.OK))
            filter = Gtk.FileFilter()
            filter.set_name(_("Images"))
            filter.add_mime_type("image/*")
            dialog.add_filter(filter)

            preview = Gtk.Image()
            dialog.set_preview_widget(preview);
            dialog.connect("update-preview", self.update_preview_cb, preview)
            dialog.set_use_preview_label(False)

            response = dialog.run()
            if response == Gtk.ResponseType.OK:
                path = dialog.get_filename()
                image = PIL.Image.open(path)
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
                left = (width - new_width)/2
                top = (height - new_height)/2
                right = (width + new_width)/2
                bottom = (height + new_height)/2
                image = image.crop((left, top, right, bottom))
                image.thumbnail((96, 96), Image.ANTIALIAS)
                face_path = os.path.join(user.get_home_dir(), ".face")
                image.save(face_path, "png")
                user.set_icon_file(face_path)
                self.face_image.set_from_file(face_path)
                model.set_value(treeiter, INDEX_USER_PICTURE, GdkPixbuf.Pixbuf.new_from_file_at_size(face_path, 48, 48))
                model.row_changed(model.get_path(treeiter), treeiter)

            dialog.destroy()

    def update_preview_cb (self, dialog, preview):
        filename = dialog.get_preview_filename()
        if filename is None:
            return
        dialog.set_preview_widget_active(False)
        if os.path.isfile(filename):
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(filename, 128, 128)
            if pixbuf is not None:
                preview.set_from_pixbuf (pixbuf)
                dialog.set_preview_widget_active(True)

    def _on_face_menuitem_activated(self, menuitem, path):
        if os.path.exists(path):
            model, treeiter = self.users_treeview.get_selection().get_selected()
            if treeiter != None:
                user = model[treeiter][INDEX_USER_OBJECT]
                user.set_icon_file(path)
                self.face_image.set_from_file(path)
                shutil.copy(path, os.path.join(user.get_home_dir(), ".face"))
                model.set_value(treeiter, INDEX_USER_PICTURE, GdkPixbuf.Pixbuf.new_from_file_at_size(path, 48, 48))
                model.row_changed(model.get_path(treeiter), treeiter)


    def menu_display(self, widget, event):
        if event.button == 1:
            self.menu.popup(None, None, self.popup_menu_below_button, self.face_button, event.button, event.time)
            self.menu.show_all()

    def popup_menu_below_button (self, *args):
        # the introspection for GtkMenuPositionFunc seems to change with each Gtk version,
        # this is a workaround to make sure we get the menu and the widget
        menu = args[0]
        widget = args[-1]

        # here I get the coordinates of the button relative to
        # window (self.window)
        button_x, button_y = widget.get_allocation().x, widget.get_allocation().y

        # now convert them to X11-relative
        unused_var, window_x, window_y = widget.get_window().get_origin()
        x = window_x + button_x
        y = window_y + button_y

        # now move the menu below the button
        y += widget.get_allocation().height

        push_in = True # push_in is True so all menu is always inside screen
        return (x, y, push_in)

    def on_accounts_service_loaded(self, user, param):
        self.load_users()

    def load_users(self):
        self.users.clear()
        users = self.accountService.list_users()
        for user in users:
            if os.path.exists(user.get_icon_file()):
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size(user.get_icon_file(), 48, 48)
            else:
                pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/share/cinnamon/faces/user-generic.png", 48, 48)
            description = "<b>%s</b>\n%s" % (user.get_real_name(), user.get_user_name())
            piter = self.users.append(None, [user, pixbuf, description])
        self.users_treeview.set_model(self.users)

    def load_groups(self):
        self.groups.clear()
        groups = sorted(grp.getgrall(), key=lambda x: x[0], reverse=False)
        for group in groups:
            (gr_name, gr_passwd, gr_gid, gr_mem) = group
            piter = self.groups.append(None, [gr_gid, gr_name])
        self.groups_treeview.set_model(self.groups)

#USER CALLBACKS

    def on_user_selection(self, selection):
        self.password_button.set_sensitive(True)
        self.password_button.set_tooltip_text("")

        model, treeiter = selection.get_selected()
        if treeiter != None:
            user = model[treeiter][INDEX_USER_OBJECT]
            self.builder.get_object("button_delete_user").set_sensitive(True)
            self.realname_entry.set_text(user.get_real_name())

            if user.get_password_mode() == AccountsService.UserPasswordMode.REGULAR:
                self.password_mask.set_text(u'\u2022\u2022\u2022\u2022\u2022\u2022')
            elif user.get_password_mode() == AccountsService.UserPasswordMode.NONE:
                self.password_mask.set_markup("<b>%s</b>" % _("No password set"))
            else:
                self.password_mask.set_text(_("Set at login"))

            if user.get_account_type() == AccountsService.UserAccountType.ADMINISTRATOR:
                self.account_type_combo.set_active(1)
            else:
                self.account_type_combo.set_active(0)

            if os.path.exists(user.get_icon_file()):
                self.face_image.set_from_file(user.get_icon_file())
            else:
                self.face_image.set_from_file("/usr/share/cinnamon/faces/user-generic.png")

            groups = []
            for group in grp.getgrall():
                if user.get_user_name() in group[3]:
                    groups.append(group[0])
            groups.sort()
            self.groups_label.set_text(", ".join(groups))
            self.builder.get_object("box_users").show()

            connections = int(commands.getoutput("w -hs %s | wc -l" % user.get_user_name()))
            if connections > 0:
                self.builder.get_object("button_delete_user").set_sensitive(False)
                self.builder.get_object("button_delete_user").set_tooltip_text(_("This user is currently logged in"))
            else:
                self.builder.get_object("button_delete_user").set_sensitive(True)
                self.builder.get_object("button_delete_user").set_tooltip_text("")

            if os.path.exists("/home/.ecryptfs/%s" % user.get_user_name()):
                self.password_button.set_sensitive(False)
                self.password_button.set_tooltip_text(_("The user's home directory is encrypted. To preserve access to the encrypted directory, only the user should change this password."))

        else:
            self.builder.get_object("button_delete_user").set_sensitive(False)
            self.builder.get_object("box_users").hide()

    def on_user_deletion(self, event):
        model, treeiter = self.users_treeview.get_selection().get_selected()
        if treeiter != None:
            user = model[treeiter][INDEX_USER_OBJECT]
            message = _("Are you sure you want to permanently delete %s and all the files associated with this user?") % user.get_user_name()
            d = Gtk.MessageDialog(self.window,
                              Gtk.DialogFlags.MODAL | Gtk.DialogFlags.DESTROY_WITH_PARENT,
                              Gtk.MessageType.QUESTION,
                              Gtk.ButtonsType.YES_NO,
                              message)
            d.set_markup(message)
            d.set_default_response(Gtk.ResponseType.NO)
            r = d.run()
            d.destroy()
            if r == Gtk.ResponseType.YES:
                result = self.accountService.delete_user(user, True)
                if result:
                    model.remove(treeiter)
                    self.load_groups()

    def on_user_addition(self, event):
        dialog = NewUserDialog()
        response = dialog.run()
        if response == Gtk.ResponseType.OK:
            if dialog.account_type_combo.get_active() == 1:
                account_type = AccountsService.UserAccountType.ADMINISTRATOR
            else:
                account_type = AccountsService.UserAccountType.STANDARD
            fullname = dialog.realname_entry.get_text()
            username = dialog.username_entry.get_text()
            new_user = self.accountService.create_user(username, fullname, account_type)
            new_user.set_password_mode(AccountsService.UserPasswordMode.NONE)
            pixbuf = GdkPixbuf.Pixbuf.new_from_file_at_size("/usr/share/cinnamon/faces/user-generic.png", 48, 48)
            description = "<b>%s</b>\n%s" % (fullname, username)
            piter = self.users.append(None, [new_user, pixbuf, description])
            # Add the user to his/her own group and sudo if Administrator was selected
            if dialog.account_type_combo.get_active() == 1:
                subprocess.call(["usermod", username, "-G", "%s,sudo,nopasswdlogin" % username])
            else:
                subprocess.call(["usermod", username, "-G", "%s,nopasswdlogin" % username])
            self.load_groups()
        dialog.destroy()

    def on_user_edition(self, event):
        model, treeiter = self.users_treeview.get_selection().get_selected()
        if treeiter != None:
            print "Editing user %s" % model[treeiter][INDEX_USER_OBJECT].get_user_name()

# GROUPS CALLBACKS

    def on_group_selection(self, selection):
        model, treeiter = selection.get_selected()
        if treeiter != None:
            self.builder.get_object("button_edit_group").set_sensitive(True)
            self.builder.get_object("button_delete_group").set_sensitive(True)
            self.builder.get_object("button_delete_group").set_tooltip_text("")
            group = model[treeiter][INDEX_GROUPNAME]
            for p in pwd.getpwall():
                username = p[0]
                primary_group = grp.getgrgid(p[3])[0]
                if primary_group == group:
                    self.builder.get_object("button_delete_group").set_sensitive(False)
                    self.builder.get_object("button_delete_group").set_tooltip_text(_("This group is set as %s's primary group") % username)
                    break

        else:
            self.builder.get_object("button_edit_group").set_sensitive(False)
            self.builder.get_object("button_delete_group").set_sensitive(False)
            self.builder.get_object("button_delete_group").set_tooltip_text("")

    def on_group_deletion(self, event):
        model, treeiter = self.groups_treeview.get_selection().get_selected()
        if treeiter != None:
            group = model[treeiter][INDEX_GROUPNAME]
            message = _("Are you sure you want to permanently delete %s?") % group
            d = Gtk.MessageDialog(self.window,
                              Gtk.DialogFlags.MODAL | Gtk.DialogFlags.DESTROY_WITH_PARENT,
                              Gtk.MessageType.QUESTION,
                              Gtk.ButtonsType.YES_NO,
                              message)
            d.set_markup(message)
            d.set_default_response(Gtk.ResponseType.NO)
            r = d.run()
            if r == Gtk.ResponseType.YES:
                subprocess.call(["groupdel", group])
                self.load_groups()
            d.destroy()

    def on_group_addition(self, event):
        dialog = GroupDialog(_("Group Name"), "")
        response = dialog.run()
        if response == Gtk.ResponseType.OK:
            subprocess.call(["groupadd", dialog.entry.get_text().lower()])
            self.load_groups()
        dialog.destroy()

    def on_group_edition(self, event):
        model, treeiter = self.groups_treeview.get_selection().get_selected()
        if treeiter != None:
            group = model[treeiter][INDEX_GROUPNAME]
            dialog = GroupDialog(_("Group Name"), group)
            response = dialog.run()
            if response == Gtk.ResponseType.OK:
                subprocess.call(["groupmod", group, "-n", dialog.entry.get_text().lower()])
                self.load_groups()
            dialog.destroy()


if __name__ == "__main__":
    module = Module()
    Gtk.main()




