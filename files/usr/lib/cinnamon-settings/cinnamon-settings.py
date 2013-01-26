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
#         Label                  Module ID              Icon
    [_("Networking"),        "cinnamon-network",   "network.svg"],
    [_("Display"),           "cinnamon-display",   "display.svg"],
    [_("Region & Language"), "cinnamon-region",    "region.svg"],
    [_("Bluetooth"),         "cinnamon-bluetooth", "bluetooth.svg"]
]

class MainWindow:

    # Change pages
    def side_view_nav(self, side_view):
        selected_items = side_view.get_selected_items()
        if len(selected_items) > 0:
            self.side_view_sw.hide()
            path = selected_items[0]
            iterator = self.store.get_iter(path)
            sidePage = self.store.get_value(iterator,2)
            self.window.set_title(_("Cinnamon Settings") + " - " + sidePage.name)
            sidePage.build()
            self.content_box_sw.show_all()
            self.top_button_box.show_all()


    ''' Create the UI '''
    def __init__(self):

        self.builder = Gtk.Builder()
        self.builder.add_from_file("/usr/lib/cinnamon-settings/cinnamon-settings.ui")
        self.window = self.builder.get_object("main_window")
        self.side_view = self.builder.get_object("side_view")
        self.side_view_sw = self.builder.get_object("side_view_sw")
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
                self.sidePages.append((mod.sidePage, mod.name))

        for item in CONTROL_CENTER_MODULES:
            ccmodule = SettingsWidgets.CCModule(item[0], item[1], item[2], self.content_box)
            if ccmodule.process():
                self.sidePages.append((ccmodule.sidePage, ccmodule.name))

        # create the backing store for the side nav-view.
        self.store = Gtk.ListStore(str, GdkPixbuf.Pixbuf, object)
        sidePagesIters = {}
        for sidePage, sidePageID in self.sidePages:
            iconFile = "/usr/lib/cinnamon-settings/data/icons/%s" % sidePage.icon
            if os.path.exists(iconFile):
                img = GdkPixbuf.Pixbuf.new_from_file_at_size( iconFile, 48, 48)
            else:
                img = None
            sidePagesIters[sidePageID] = self.store.append([sidePage.name, img, sidePage])

        # set up the side view - navigation.
        self.side_view.set_text_column(0)
        self.side_view.set_pixbuf_column(1)
        self.side_view.set_model(self.store)
        self.side_view.connect("selection_changed", self.side_view_nav )

        # set up larger components.
        self.window.set_title(_("Cinnamon Settings"))
        self.window.connect("destroy", Gtk.main_quit)
        self.button_cancel.connect("clicked", Gtk.main_quit)
        self.button_back.connect('clicked', self.back_to_icon_view)

        # Select the first sidePage
        if len(sys.argv)==2 and sys.argv[1] in sidePagesIters.keys():
            first_page_iter = sidePagesIters[sys.argv[1]]
            path = self.store.get_path(first_page_iter)
            self.side_view.select_path(path)

        self.window.show()

    def loadCheck (self, mod):
        try:
            return mod._loadCheck()
        except:
            return True

    def back_to_icon_view(self, widget):
        self.window.set_title(_("Cinnamon Settings"))
        self.content_box_sw.hide()
        self.top_button_box.hide()
        self.side_view_sw.show_all()

if __name__ == "__main__":
    GObject.threads_init()
    MainWindow()
    Gtk.main()
