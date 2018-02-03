#!/usr/bin/python2

from GSettingsWidgets import *

class Module:
    name = "online-accounts"
    comment = _("Connect to your online accounts")
    category = "prefs"

    def __init__(self, content_box):
        keywords = _("google, facebook, twitter, yahoo, web, online, chat, calendar, mail, contact, owncloud, kerberos, imap, smtp, pocket, readitlater, account")
        self.sidePage = SidePage(_("Online Accounts"), "cs-online-accounts", keywords, content_box, 560, module=self)

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Online Account module"

            page = SettingsPage()
            self.sidePage.add_widget(page)

            image = Gtk.Image.new_from_icon_name("help-contents-symbolic", Gtk.IconSize.BUTTON)

            button = Gtk.Button(_("Information about GNOME Online Accounts"))
            button.set_image(image)
            button.set_always_show_image(True)
            button.connect("clicked", self.on_button_clicked)
            page.pack_start(button, False, True, 0)

            try:
                content = self.sidePage.content_box.c_manager.get_c_widget("online-accounts")
                content.set_no_show_all(True)
                page.pack_start(content, True, True, 0)
            except Exception, detail:
                print detail

            page.expand = True

    def on_button_clicked(self, button):
        gladefile = "/usr/share/cinnamon/cinnamon-settings/cinnamon-online-accounts-info.ui"
        self.builder = Gtk.Builder()
        self.builder.set_translation_domain('cinnamon')
        self.builder.add_from_file(gladefile)
        self.window = self.builder.get_object("main_window")
        self.window.set_title(_("Online Accounts"))
        self.window.set_icon_name("cs-online-accounts")
        self.window.show()
