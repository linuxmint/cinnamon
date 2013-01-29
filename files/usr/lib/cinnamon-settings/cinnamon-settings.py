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

CATEGORIES = [
#        Display name                         ID              Show it? Always False to start
    {"label": _("Look and Feel"),         "id": "feel",        "show": False},
    {"label": _("User Preferences"),      "id": "prefs",       "show": False},
    {"label": _("System Settings"),       "id": "admin",       "show": False},
    {"label": _("Hardware"),              "id": "hardware",    "show": False}
]

CONTROL_CENTER_MODULES = [
#         Label                              Module ID                Icon                         Category                         Keywords for filter
    [_("Networking"),                       "network",            "network.svg",                 "hardware",    _("network, wireless, wifi, ethernet, broadband, internet")],
    [_("Display"),                          "display",            "display.svg",                 "hardware",    _("display, screen, monitor, layout, resolution, dual, lcd")],
    [_("Region & Keyboard Layout"),         "region",             "region.svg",                     "prefs",    _("region, layout, keyboard, language")],
    [_("Bluetooth"),                        "bluetooth",          "bluetooth.svg",               "hardware",    _("bluetooth, dongle, transfer, mobile")],
    [_("System Info & Default Programs"),   "info",               "details.svg",                    "admin",    _("defaults, programs, info, details, version, cd, autostart")],
    [_("Universal Access"),                 "universal-access",   "universal-access.svg",           "prefs",    _("magnifier, talk, access, zoom, keys, contrast")],
    [_("User Accounts"),                    "user-accounts",      "user-accounts.svg",              "admin",    _("users, accounts, add, password, picture")],
    [_("Power Management"),                 "power",              "power.svg",                      "admin",    _("power, suspend, hibernate, laptop, desktop")],
    [_("Sound"),                            "sound-nua",          "sound.svg",                   "hardware",    _("sound, speakers, headphones, test")]
]

STANDALONE_MODULES = [
#         Label                          Executable                          Icon                         Category
    [_("Printers"),                      "system-config-printer",        "printer.svg",                "hardware",      _("printers, laser, inkjet")],
    [_("Firewall"),                      "gufw",                         "firewall.svg",                  "admin",      _("firewall, block, filter, programs")],
    [_("Install/Remove Languages"),      "gnome-language-selector",      "language.svg",                  "admin",      _("language, install, foreign")]
]

class MainWindow:
    # Change pages
    def side_view_nav(self, side_view, cat):
        selected_items = side_view.get_selected_items()
        if len(selected_items) > 0:
            self.deselect(cat)
            path = selected_items[0]
            iterator = self.storeFilter[cat].get_iter(path)
            sidePage = self.storeFilter[cat].get_value(iterator,2)
            if not sidePage.is_standalone:
                self.side_view_sw.hide()
                self.search_entry.hide()
                self.window.set_title(_("Cinnamon Settings") + " - " + sidePage.name)
                sidePage.build()
                self.content_box_sw.show()
                self.button_sub.show()
                self.button_sub.set_label(sidePage.name)
                self.button_back.get_style_context().set_junction_sides(Gtk.JunctionSides.RIGHT)
            else:
                sidePage.build()

    def deselect(self, cat):
        for key in self.side_view.keys():
            if key is not cat:
                self.side_view[key].unselect_all()

    ''' Create the UI '''
    def __init__(self):

        self.builder = Gtk.Builder()
        self.builder.add_from_file("/usr/lib/cinnamon-settings/cinnamon-settings.ui")
        self.window = self.builder.get_object("main_window")
        self.side_view = {}
        self.side_view_container = self.builder.get_object("category_box")
        self.side_view_sw = self.builder.get_object("side_view_sw")
        self.side_view_sw.show_all()
        self.content_box = self.builder.get_object("content_box")
        self.content_box_sw = self.builder.get_object("content_box_sw")
        self.button_cancel = self.builder.get_object("button_cancel")
        self.button_back = self.builder.get_object("button_back")
        self.button_back.set_label(_("All Settings"))
        self.button_back.show()
        self.button_back.get_style_context().set_junction_sides(Gtk.JunctionSides.NONE)
        self.button_sub = self.builder.get_object("button_sub")
        self.button_sub.hide()
        self.button_sub.get_style_context().set_junction_sides(Gtk.JunctionSides.LEFT)
        self.search_entry = self.builder.get_object("search_box")
        self.search_entry.connect("changed", self.onSearchTextChanged)
        self.search_entry.connect("icon-press", self.onClearSearchBox)
        self.window.connect("destroy", Gtk.main_quit)

        self.sidePages = []

        for i in range(len(modules)):
            mod = modules[i].Module(self.content_box)
            if self.loadCheck(mod):
                self.sidePages.append((mod.sidePage, mod.name, mod.category))

        for item in CONTROL_CENTER_MODULES:
            ccmodule = SettingsWidgets.CCModule(item[0], item[1], item[2], item[3], item[4], self.content_box)
            if ccmodule.process():
                self.sidePages.append((ccmodule.sidePage, ccmodule.name, ccmodule.category))

        for item in STANDALONE_MODULES:
            samodule = SettingsWidgets.SAModule(item[0], item[1], item[2], item[3], item[4], self.content_box)
            if samodule.process():
                self.sidePages.append((samodule.sidePage, samodule.name, samodule.category))


        # create the backing stores for the side nav-view.
        sidePagesIters = {}
        self.store = {}
        self.storeFilter = {}
        for sidepage in self.sidePages:
            sp, sp_id, sp_cat = sidepage
            if not self.store.has_key(sp_cat):
                self.store[sidepage[2]] = Gtk.ListStore(str, GdkPixbuf.Pixbuf, object, bool)
                self.storeFilter[sidepage[2]] = self.store[sidepage[2]].filter_new()
                self.storeFilter[sidepage[2]].set_visible_func(self.filter_visible_function, None)
                self.storeFilter[sidepage[2]].set_visible_column(3)
                for category in CATEGORIES:
                    if category["id"] == sp_cat:
                        category["show"] = True
            iconFile = "/usr/lib/cinnamon-settings/data/icons/%s" % sp.icon
            if os.path.exists(iconFile):
                img = GdkPixbuf.Pixbuf.new_from_file_at_size( iconFile, 48, 48)
            else:
                img = None
            sidePagesIters[sp_id] = self.store[sp_cat].append([sp.name, img, sp, True])

        self.displayCategories()

        # set up larger components.
        self.window.set_title(_("Cinnamon Settings"))
        self.window.connect("destroy", Gtk.main_quit)
        self.button_cancel.connect("clicked", Gtk.main_quit)
        self.button_back.connect('clicked', self.back_to_icon_view)

        # Select the first sidePage
        if len(sys.argv)==2 and sys.argv[1] in sidePagesIters.keys():
            first_page_iter = sidePagesIters[sys.argv[1]]
            self.findPath(first_page_iter)
        else:
            self.search_entry.grab_focus()

        self.window.show()

    def onSearchTextChanged(self, widget):
        self.displayCategories()

    def onClearSearchBox(self, widget, position, event):
        if position == Gtk.EntryIconPosition.SECONDARY:
            self.search_entry.set_text("")

    def filter_visible_function(self, model, iter, user_data):
        sidePage = model.get_value(iter, 2)
        text = self.search_entry.get_text().lower()
        if sidePage.name.lower().find(text) > -1 or sidePage.keywords.lower().find(text) > -1:
            return True
        else:
            return False

    def displayCategories(self):
        widgets = self.side_view_container.get_children()
        for widget in widgets:
            widget.destroy()
        self.first_category_done = False # This is just to prevent an extra separator showing up before the first category
        for category in CATEGORIES:
            if category["show"] is True:
                self.prepCategory(category)
        self.side_view_container.show_all()

    def prepCategory(self, category):
        self.storeFilter[category["id"]].refilter()
        if not self.anyVisibleInCategory(category):
            return

        if self.first_category_done:
            widget = Gtk.Separator.new(Gtk.Orientation.HORIZONTAL)
            self.side_view_container.pack_start(widget, False, False, 0)
        widget = Gtk.Label(category["label"])
        widget.set_padding(10, 0)
        widget.set_alignment(0, .5)
        self.side_view_container.pack_start(widget, False, True, 4)
        widget = Gtk.Separator.new(Gtk.Orientation.HORIZONTAL)
        self.side_view_container.pack_start(widget, False, True, 0)
        widget = Gtk.IconView.new_with_model(self.storeFilter[category["id"]])
        widget.set_text_column(0)
        widget.set_pixbuf_column(1)
        widget.set_item_width(110)
        widget.set_row_spacing(0)
        widget.set_column_spacing(0)
        widget.set_hexpand(True)
        widget.set_vexpand(False)
        c = widget.get_style_context()
        c.add_class("button")
        self.side_view[category["id"]] = widget

        self.side_view_container.pack_start(self.side_view[category["id"]], False, False, 0)
        self.first_category_done = True
        self.side_view[category["id"]].connect("selection_changed", self.side_view_nav, category["id"])

    def anyVisibleInCategory(self, category):
        id = category["id"]
        iter = self.storeFilter[id].get_iter_first()
        visible = False
        while iter is not None:
            visible = self.storeFilter[id].get_value(iter, 3)
            iter = self.storeFilter[id].iter_next(iter)
        return visible


    def findPath (self, name):
        for key in self.store.keys():
            path = self.store[key].get_path(name)
            if path is not None:
                self.side_view[key].select_path(path)
                return

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
        self.button_back.get_style_context().set_junction_sides(Gtk.JunctionSides.NONE)
        self.button_sub.hide()
        self.side_view_sw.show()
        self.search_entry.show()
        self.search_entry.grab_focus()

if __name__ == "__main__":
    GObject.threads_init()
    MainWindow()
    Gtk.main()
