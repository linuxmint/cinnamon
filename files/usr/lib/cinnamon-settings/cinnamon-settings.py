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
#         Label                  Module ID                       Icon                         Category
    [_("Networking"),        "cinnamon-network",            "network.svg",                    "admin"],
    [_("Display"),           "cinnamon-display",            "display.svg",                    "prefs"],
    [_("Region & Language"), "cinnamon-region",             "region.svg",                     "prefs"],
    [_("Bluetooth"),         "cinnamon-bluetooth",          "bluetooth.svg",                  "admin"],
    [_("Printers"),          "cinnamon-printers",           "printer.svg",                    "admin"],
    [_("Details"),           "cinnamon-info",               "details.svg",                    "admin"],
    [_("Universal Access"),  "cinnamon-universal-access",   "universal-access.svg",           "prefs"],
    [_("User Accounts"),     "cinnamon-user-accounts",      "user-accounts.svg",              "admin"],
    [_("Power Management"),  "cinnamon-power",              "power.svg",                      "admin"],
    [_("Sound"),             "cinnamon-sound-nua",          "sound.svg",                      "admin"]
]

class MainWindow:

    # Change pages
    def side_view_nav(self, side_view, cat):
        selected_items = side_view.get_selected_items()
        if len(selected_items) > 0:
            self.deselect(cat)
            self.side_view_sw.hide()
            path = selected_items[0]
            iterator = self.store[cat].get_iter(path)
            sidePage = self.store[cat].get_value(iterator,2)
            self.window.set_title(_("Cinnamon Settings") + " - " + sidePage.name)
            sidePage.build()
            self.content_box_sw.show()
            self.top_button_box.show_all()

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
        self.side_view["feel"] = self.builder.get_object("side_view_look_and_feel")
        self.side_view["prefs"] = self.builder.get_object("side_view_user_prefs")
        self.side_view["admin"] = self.builder.get_object("side_view_admin")
        self.side_view_sw = self.builder.get_object("side_view_sw")
        self.side_view_sw.show_all()
        self.content_box = self.builder.get_object("content_box")
        self.content_box_sw = self.builder.get_object("content_box_sw")
        self.button_cancel = self.builder.get_object("button_cancel")
        self.button_back = self.builder.get_object("button_back")
        self.button_back.set_label(_("All Settings"))
        self.top_button_box = self.builder.get_object("top_button_box")

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

        # create the backing store for the side nav-view.
        self.store = {}
        self.store["feel"] = Gtk.ListStore(str, GdkPixbuf.Pixbuf, object)
        self.store["prefs"] = Gtk.ListStore(str, GdkPixbuf.Pixbuf, object)
        self.store["admin"] = Gtk.ListStore(str, GdkPixbuf.Pixbuf, object)

        sidePagesIters = {}
        for sidePage, sidePageID, sidePageCategory in self.sidePages:
            iconFile = "/usr/lib/cinnamon-settings/data/icons/%s" % sidePage.icon
            if os.path.exists(iconFile):
                img = GdkPixbuf.Pixbuf.new_from_file_at_size( iconFile, 48, 48)
            else:
                img = None
            sidePagesIters[sidePageID] = self.store[sidePageCategory].append([sidePage.name, img, sidePage])

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
        self.side_view_sw.show_all()

if __name__ == "__main__":
    GObject.threads_init()
    MainWindow()
    Gtk.main()
