#!/usr/bin/env python

import sys

try:
    sys.path.append('/usr/lib/cinnamon-settings/modules')
    sys.path.append('/usr/lib/cinnamon-settings/bin')
    import os
    import glob
    import gettext
    import SettingsWidgets
    from gi.repository import Gio, Gtk, GObject, GdkPixbuf
# Standard setting pages... this can be expanded to include applet dirs maybe?
    mod_files = glob.glob('/usr/lib/cinnamon-settings/modules/*.py')
    mod_files.sort()
    if len(mod_files) is 0:
        raise Exception("No settings modules found!!")
    for i in range(len(mod_files)):
        mod_files[i] = mod_files[i].split('/')[5]
        mod_files[i] = mod_files[i].split('.')[0]
        if mod_files[i][0:3] != "cs_":
            raise Exception("Settings modules must have a prefix of 'cs_' !!")
    modules = map(__import__, mod_files)
except Exception, detail:
    print detail
    sys.exit(1)

# i18n
gettext.install("cinnamon", "/usr/share/cinnamon/locale")
# i18n for menu item
menuName = _("Desktop Settings")
menuGenericName = _("Desktop Configuration Tool")
menuComment = _("Fine-tune desktop settings")

CONTROL_CENTER_MODULES = [
#         Label                              Module ID                Icon                         Category
    [_("Networking"),                       "network",            "network.svg",                    "admin"],
    [_("Display"),                          "display",            "display.svg",                    "prefs"],
    [_("Region & Keyboard Layout"),         "region",             "region.svg",                     "prefs"],
    [_("Bluetooth"),                        "bluetooth",          "bluetooth.svg",                  "admin"],
    [_("System Info & Default Programs"),   "info",               "details.svg",                    "admin"],
    [_("Universal Access"),                 "universal-access",   "universal-access.svg",           "prefs"],
    [_("User Accounts"),                    "user-accounts",      "user-accounts.svg",              "admin"],
    [_("Power Management"),                 "power",              "power.svg",                      "admin"],
    [_("Sound"),                            "sound-nua",          "sound.svg",                      "admin"]
]

STANDALONE_MODULES = [
#         Label                          Executable                          Icon                         Category
    [_("Printers"),                      "system-config-printer",        "printer.svg",                   "admin"],
    [_("Firewall"),                      "gufw",                         "firewall.svg",                  "admin"],
    [_("Install/Remove Languages"),      "gnome-language-selector",      "language.svg",                  "admin"]
]

class MainWindow:
    # Change pages
    def side_view_nav(self, side_view, cat):
        selected_items = side_view.get_selected_items()
        if len(selected_items) > 0:
            self.deselect(cat)
            path = selected_items[0]
            iterator = self.store[cat].get_iter(path)
            sidePage = self.store[cat].get_value(iterator,2)
            if not sidePage.is_standalone:
                self.side_view_sw.hide()
                self.window.set_title(_("Cinnamon Settings") + " - " + sidePage.name)
                sidePage.build()
                self.content_box_sw.show()
                self.top_button_box.show_all()
            else:
                sidePage.build()

    def side_view_nav_feel(self, side_view):
        self.side_view_nav(side_view, "feel")

    def side_view_nav_prefs(self, side_view):
        self.side_view_nav(side_view, "prefs")

    def side_view_nav_admin(self, side_view):
        self.side_view_nav(side_view, "admin")

    def deselect(self, cat):
        if cat is not "feel":
            self.side_view["feel"].unselect_all()
        if cat is not "prefs":
            self.side_view["prefs"].unselect_all()
        if cat is not "admin":
            self.side_view["admin"].unselect_all()

    ''' Create the UI '''
    def __init__(self):

        self.builder = Gtk.Builder()
        self.builder.add_from_file("/usr/lib/cinnamon-settings/cinnamon-settings.ui")
        self.window = self.builder.get_object("main_window")
        self.side_view = {}
        self.side_view["feel"] = self.builder.get_object("side_view_feel")
        self.side_view["prefs"] = self.builder.get_object("side_view_prefs")
        self.side_view["admin"] = self.builder.get_object("side_view_admin")
        self.side_view_sw = self.builder.get_object("side_view_sw")
        self.side_view_sw.show_all()
        self.content_box = self.builder.get_object("content_box")
        self.content_box_sw = self.builder.get_object("content_box_sw")
        self.button_cancel = self.builder.get_object("button_cancel")
        self.button_back = self.builder.get_object("button_back")
        self.button_back.set_label(_("All Settings"))
        self.top_button_box = self.builder.get_object("top_button_box")

        # Translations for categories
        label = self.builder.get_object("label_feel")
        label.set_label(_("Look and Feel"))
        label = self.builder.get_object("label_prefs")
        label.set_label(_("User Preferences"))
        label = self.builder.get_object("label_admin")
        label.set_label(_("System Settings"))

        self.window.connect("destroy", Gtk.main_quit)

        self.sidePages = []

        for i in range(len(modules)):
            mod = modules[i].Module(self.content_box)
            if self.loadCheck(mod):
                self.sidePages.append((mod.sidePage, mod.name, mod.category))

        for item in CONTROL_CENTER_MODULES:
            ccmodule = SettingsWidgets.CCModule(item[0], item[1], item[2], item[3], self.content_box)
            if ccmodule.process():
                self.sidePages.append((ccmodule.sidePage, ccmodule.name, ccmodule.category))

        for item in STANDALONE_MODULES:
            samodule = SettingsWidgets.SAModule(item[0], item[1], item[2], item[3], self.content_box)
            if samodule.process():
                self.sidePages.append((samodule.sidePage, samodule.name, samodule.category))


        # create the backing store for the side nav-view.
        self.store = {}
        self.store["feel"] = Gtk.ListStore(str, GdkPixbuf.Pixbuf, object)
        self.store["prefs"] = Gtk.ListStore(str, GdkPixbuf.Pixbuf, object)
        self.store["admin"] = Gtk.ListStore(str, GdkPixbuf.Pixbuf, object)

        self.show_cat = {"feel": False, "prefs": False, "admin": False}

        sidePagesIters = {}
        for sidePage, sidePageID, sidePageCategory in self.sidePages:
            iconFile = "/usr/lib/cinnamon-settings/data/icons/%s" % sidePage.icon
            if os.path.exists(iconFile):
                img = GdkPixbuf.Pixbuf.new_from_file_at_size( iconFile, 48, 48)
            else:
                img = None
            sidePagesIters[sidePageID] = self.store[sidePageCategory].append([sidePage.name, img, sidePage])
            self.show_cat[sidePageCategory] = True

        # set up the side view - navigation.
        self.prepSideView("feel")
        self.prepSideView("prefs")
        self.prepSideView("admin")

        self.side_view["feel"].connect("selection_changed", self.side_view_nav_feel )
        self.side_view["prefs"].connect("selection_changed", self.side_view_nav_prefs )
        self.side_view["admin"].connect("selection_changed", self.side_view_nav_admin )

        # set up larger components.
        self.window.set_title(_("Cinnamon Settings"))
        self.window.connect("destroy", Gtk.main_quit)
        self.button_cancel.connect("clicked", Gtk.main_quit)
        self.button_back.connect('clicked', self.back_to_icon_view)

        # Select the first sidePage
        if len(sys.argv)==2 and sys.argv[1] in sidePagesIters.keys():
            first_page_iter = sidePagesIters[sys.argv[1]]
            self.findPath(first_page_iter)

        self.window.show()

    def findPath (self, name):
        path = self.store["feel"].get_path(name)
        if path is not None:
            self.side_view["feel"].select_path(path)
            return
        path = self.store["prefs"].get_path(name)
        if path is not None:
            self.side_view["prefs"].select_path(path)
            return
        path = self.store["admin"].get_path(name)
        if path is not None:
            self.side_view["admin"].select_path(path)
            return

    def prepSideView (self, cat):
        self.side_view[cat].set_text_column(0)
        self.side_view[cat].set_pixbuf_column(1)
        self.side_view[cat].set_model(self.store[cat])
        label = self.builder.get_object("label_" + cat)
        pre_sep = self.builder.get_object("pre_sep_" + cat)
        post_sep = self.builder.get_object("post_sep_" + cat)
        if self.show_cat[cat]:
            self.side_view[cat].show()
            label.show()
            if cat is "feel":
                pre_sep.hide()
            else:
                pre_sep.show()
            post_sep.show()
        else:
            self.side_view[cat].hide()
            label.hide()
            pre_sep.hide()
            post_sep.hide()

    def loadCheck (self, mod):
        try:
            return mod._loadCheck()
        except:
            return True

    def back_to_icon_view(self, widget):
        self.window.set_title(_("Cinnamon Settings"))
        self.content_box_sw.hide()
        widgets = self.content_box.get_children()
        for widget in widgets:
            widget.hide()
        self.top_button_box.hide()
        self.side_view_sw.show()

if __name__ == "__main__":
    GObject.threads_init()
    MainWindow()
    Gtk.main()
