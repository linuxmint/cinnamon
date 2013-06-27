#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import AccountsService, GLib
import PAM
import pexpect
import time
from random import randint

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


class Module:
    def __init__(self, content_box):
        keywords = _("user, account, information, details")
        advanced = False
        sidePage = SidePage(_("Account details"), "user.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "user"
        self.category = "appear"        
                
        self.face_button = Gtk.Button()
        self.face_image = Gtk.Image()  
        self.face_button.set_image(self.face_image)
        if os.path.exists("/usr/share/pixmaps/faces/user-generic.png"):
            self.face_image.set_from_file("/usr/share/pixmaps/faces/user-generic.png")      
        self.face_button.set_alignment(0.0, 0.5)
        self.face_button.set_tooltip_text(_("Click to change your picture"))
       
        self.realname_entry = EditableEntry()
        self.sidePage.add_widget(self.realname_entry, False)         
        self.realname_entry.connect("changed", self._on_realname_changed)
        self.realname_entry.set_tooltip_text(_("Click to change your name"))
        
        table = Gtk.Table(3, 2)
        table.set_row_spacings(8)
        table.set_col_spacings(15)        
        self.sidePage.add_widget(table, False)
        
        label_picture = Gtk.Label(_("Picture:"))
        label_picture.set_alignment(1, 0.5)
        label_picture.get_style_context().add_class("dim-label")
        table.attach(label_picture, 0, 1, 0, 1)

        password_mask = Gtk.Label(u'\u2022\u2022\u2022\u2022\u2022\u2022')        
        password_mask.set_alignment(0.0, 0.5)
        self.password_button = Gtk.Button()
        self.password_button.add(password_mask)
        self.password_button.set_relief(Gtk.ReliefStyle.NONE)
        self.password_button.set_tooltip_text(_("Click to change your password"))
        self.password_button.connect('activate', self._on_password_button_clicked)
        self.password_button.connect('released', self._on_password_button_clicked)
        
        label_name = Gtk.Label(_("Name:"))
        label_name.set_alignment(1, 0.5)
        label_name.get_style_context().add_class("dim-label")                        
        table.attach(label_name, 0, 1, 1, 2)

        label_name = Gtk.Label(_("Password:"))
        label_name.set_alignment(1, 0.5)
        label_name.get_style_context().add_class("dim-label")                        
        table.attach(label_name, 0, 1, 2, 3)
        
        table.attach(self.face_button, 1, 2, 0, 1, xoptions=0)
        table.attach(self.realname_entry, 1, 2, 1, 2, xoptions=Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)
        table.attach(self.password_button, 1, 2, 2, 3, xoptions=Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)        

        current_user = GLib.get_user_name()
        self.accountService = AccountsService.UserManager.get_default().get_user(current_user)
        self.accountService.connect('notify::is-loaded', self.load_user_info)        
    
    def load_user_info(self, user, param):
        
        self.realname_entry.set_text(user.get_real_name())
        if os.path.exists(user.get_icon_file()):
            self.face_image.set_from_file(user.get_icon_file())        

    def _on_realname_changed(self, widget, text):
        self.accountService.set_real_name(text)       

    def _on_password_button_clicked(self, widget):        
        dialog = PasswordDialog()                
        response = dialog.run()
                            

class PasswordDialog(Gtk.Dialog):

    def __init__ (self):            
        super(PasswordDialog, self).__init__()
        
        self.correct_current_password = False # Flag to remember if the current password is correct or not        

        self.set_modal(True)
        self.set_skip_taskbar_hint(True)
        self.set_skip_pager_hint(True)
        self.set_title("")

        table = Gtk.Table(6, 3)
        table.set_border_width(6)
        table.set_row_spacings(8)
        table.set_col_spacings(15)        

        label = Gtk.Label(_("Current password"))
        label.set_alignment(1, 0.5)
        table.attach(label, 0, 1, 0, 1)

        label = Gtk.Label(_("New password"))
        label.set_alignment(1, 0.5)
        table.attach(label, 0, 1, 1, 2)

        label = Gtk.Label(_("Confirm password"))
        label.set_alignment(1, 0.5)
        table.attach(label, 0, 1, 3, 4)

        self.current_password = Gtk.Entry()
        self.current_password.set_visibility(False)
        self.current_password.connect("focus-out-event", self._on_current_password_changed)
        table.attach(self.current_password, 1, 3, 0, 1)

        self.new_password = Gtk.Entry()        
        self.new_password.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, "reload")
        self.new_password.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("Generate a password"))
        self.new_password.connect("icon-release", self._on_new_password_icon_released)
        self.new_password.connect("changed", self._on_passwords_changed)
        table.attach(self.new_password, 1, 3, 1, 2)

        self.strengh_indicator = Gtk.ProgressBar()
        self.strengh_indicator.set_tooltip_text(_("Your new password needs to be at least 8 characters long"))
        self.strengh_indicator.set_fraction(0.0)
        table.attach(self.strengh_indicator, 1, 2, 2, 3, xoptions=Gtk.AttachOptions.EXPAND|Gtk.AttachOptions.FILL)                
        self.strengh_indicator.set_size_request(-1, 1)

        self.strengh_label = Gtk.Label()
        self.strengh_label.set_tooltip_text(_("Your new password needs to be at least 8 characters long"))
        self.strengh_label.set_alignment(1, 0.5)
        table.attach(self.strengh_label, 2, 3, 2, 3)

        self.confirm_password = Gtk.Entry()
        self.confirm_password.connect("changed", self._on_passwords_changed)
        table.attach(self.confirm_password, 1, 3, 3, 4)

        self.show_password = Gtk.CheckButton(_("Show password"))
        self.show_password.connect('toggled', self._on_show_password_toggled)
        table.attach(self.show_password, 1, 3, 4, 5)

        self.infobar = Gtk.InfoBar()
        self.infobar.set_message_type(Gtk.MessageType.ERROR)
        label = Gtk.Label(_("An error occured. Your password was not changed."))
        content = self.infobar.get_content_area()
        content.add(label)        
        table.attach(self.infobar, 0, 3, 5, 6)

        self.set_border_width(6)       
        
        box = self.get_content_area()
        box.add(table)
        self.show_all()

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
        oldpass = self.current_password.get_text()
        newpass = self.new_password.get_text()
        print "Changing %s to %s" % (oldpass, newpass)
        passwd = pexpect.spawn("/usr/bin/passwd")
        time.sleep(0.5)
        passwd.sendline(oldpass)
        time.sleep(0.5)
        passwd.sendline(newpass)
        time.sleep(0.5)
        passwd.sendline(newpass)
        time.sleep(0.5)
        passwd.close()
                
        if passwd.exitstatus is None or passwd.exitstatus > 0:                            
            self.infobar.show()
        else:
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

    def _on_current_password_changed(self, widget, event):
        self.infobar.hide()
        if self.current_password.get_text() != "":
            auth = PAM.pam()
            auth.start('passwd')        
            auth.set_item(PAM.PAM_USER, GLib.get_user_name())
            auth.set_item(PAM.PAM_CONV, self.pam_conv)            
            try:
                auth.authenticate()
                auth.acct_mgmt()
            except PAM.error, resp:
                self.current_password.set_icon_from_stock(Gtk.EntryIconPosition.SECONDARY, Gtk.STOCK_DIALOG_WARNING)
                self.current_password.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("Wrong password"))
                self.correct_current_password = False
            except:
                print 'Internal error'
            else:
                self.current_password.set_icon_from_stock(Gtk.EntryIconPosition.SECONDARY, None)
                self.correct_current_password = True
                self.check_passwords()

    def _on_passwords_changed(self, widget):   
        self.infobar.hide() 
        new_password = self.new_password.get_text()
        confirm_password = self.confirm_password.get_text()
        if new_password != confirm_password:
            self.confirm_password.set_icon_from_stock(Gtk.EntryIconPosition.SECONDARY, Gtk.STOCK_DIALOG_WARNING)
            self.confirm_password.set_icon_tooltip_text(Gtk.EntryIconPosition.SECONDARY, _("Passwords do not match"))
        else:
            self.confirm_password.set_icon_from_stock(Gtk.EntryIconPosition.SECONDARY, None)
        if len(new_password) < 8:
            self.strengh_label.set_text(_("Too short"))
            self.strengh_indicator.set_fraction(0.0)
        else:
            self.strengh_label.set_text(_("OK"))
            self.strengh_indicator.set_fraction(1.0)

        self.check_passwords()

    def check_passwords(self):
        if self.correct_current_password:
            new_password = self.new_password.get_text()
            confirm_password = self.confirm_password.get_text()
            if len(new_password) >= 8 and new_password == confirm_password:
                self.set_response_sensitive(Gtk.ResponseType.OK, True)
            else:
                self.set_response_sensitive(Gtk.ResponseType.OK, False)

    def pam_conv(self, auth, query_list, userData):
        resp = []
        for i in range(len(query_list)):
            query, type = query_list[i]
            val = self.current_password.get_text()
            resp.append((val, 0))            
        return resp
