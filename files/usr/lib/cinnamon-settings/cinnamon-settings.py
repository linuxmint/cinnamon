#!/usr/bin/env python

import sys

try:
    sys.path.append('/usr/lib/cinnamon-settings/modules')
    sys.path.append('/usr/lib/cinnamon-settings/bin')
    import os
    import glob
    import gettext
    from gi.repository import Gio, Gtk, GObject, GdkPixbuf, GtkClutter, Gst
    import SettingsWidgets
    import capi
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
menuName = _("System Settings")
menuComment = _("Control Center")

ADVANCED_GSETTING = "cinnamon-settings-advanced"

CATEGORIES = [
#        Display name                         ID              Show it? Always False to start              Icon
    {"label": _("Appearance"),            "id": "appear",      "show": False,                       "icon": "cat-appearance.svg"},
    {"label": _("Preferences"),           "id": "prefs",       "show": False,                       "icon": "cat-prefs.svg"},
    {"label": _("Hardware"),              "id": "hardware",    "show": False,                       "icon": "cat-hardware.svg"}
]

CONTROL_CENTER_MODULES = [
#         Label                              Module ID                Icon                         Category      Advanced?                      Keywords for filter
    [_("Networking"),                       "network",            "network.svg",                 "hardware",      False,          _("network, wireless, wifi, ethernet, broadband, internet")],
    [_("Display"),                          "display",            "display.svg",                 "hardware",      True,           _("display, screen, monitor, layout, resolution, dual, lcd")],
    [_("Keyboard Layout"),                  "region",             "region.svg",                     "prefs",      False,          _("region, layout, keyboard, language")],
    [_("Bluetooth"),                        "bluetooth",          "bluetooth.svg",               "hardware",      False,          _("bluetooth, dongle, transfer, mobile")],
    [_("Default Programs"),                 "info",               "details.svg",                    "prefs",      False,          _("defaults, programs, info, details, version, cd, autostart")],
    [_("Universal Access"),                 "universal-access",   "universal-access.svg",           "prefs",      False,          _("magnifier, talk, access, zoom, keys, contrast")],
    [_("User Accounts"),                    "user-accounts",      "user-accounts.svg",              "prefs",      True,           _("users, accounts, add, password, picture")],
    [_("Power Management"),                 "power",              "power.svg",                   "hardware",      False,          _("power, suspend, hibernate, laptop, desktop")],
    [_("Sound"),                            "sound",              "sound.svg",                   "hardware",      False,          _("sound, speakers, headphones, test")],
    [_("Color"),                            "color",              "color.svg",                   "hardware",      True,           _("color, profile, display, printer, output")]
]

STANDALONE_MODULES = [
#         Label                          Executable                          Icon                Category        Advanced?               Keywords for filter
    [_("Printers"),                      "system-config-printer",        "printer.svg",         "hardware",       False,          _("printers, laser, inkjet")],
    [_("Firewall"),                      "gufw",                         "firewall.svg",        "prefs",          True,           _("firewall, block, filter, programs")],
    [_("Languages"),                     "gnome-language-selector",      "language.svg",        "prefs",          False,          _("language, install, foreign")],
    [_("Login Screen"),                  "gksu /usr/sbin/mdmsetup",      "login.svg",           "prefs",          True,           _("login, mdm, gdm, manager, user, password, startup, switch")]
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
                self.window.set_title(sidePage.name)
                sidePage.build(self.advanced_mode)
                self.content_box_sw.show()
                self.button_back.show()
                self.current_sidepage = sidePage
            else:
                sidePage.build(self.advanced_mode)

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
        self.button_back.hide()
        self.search_entry = self.builder.get_object("search_box")
        self.search_entry.connect("changed", self.onSearchTextChanged)
        self.search_entry.connect("icon-press", self.onClearSearchBox)

        self.window.connect("destroy", Gtk.main_quit)

        self.builder.connect_signals(self)
        self.window.set_has_resize_grip(False)
        self.sidePages = []
        self.settings = Gio.Settings.new("org.cinnamon")
        self.advanced_mode = self.settings.get_boolean(ADVANCED_GSETTING)
        self.current_sidepage = None
        self.c_manager = capi.CManager()
        self.content_box.c_manager = self.c_manager

        for i in range(len(modules)):
            mod = modules[i].Module(self.content_box)
            if self.loadCheck(mod) and self.setParentRefs(mod):
                self.sidePages.append((mod.sidePage, mod.name, mod.category))

        for item in CONTROL_CENTER_MODULES:
            ccmodule = SettingsWidgets.CCModule(item[0], item[1], item[2], item[3], item[4], item[5], self.content_box)
            if ccmodule.process(self.c_manager):
                self.sidePages.append((ccmodule.sidePage, ccmodule.name, ccmodule.category))

        for item in STANDALONE_MODULES:
            samodule = SettingsWidgets.SAModule(item[0], item[1], item[2], item[3], item[4], item[5], self.content_box)
            if samodule.process():
                self.sidePages.append((samodule.sidePage, samodule.name, samodule.category))


        # create the backing stores for the side nav-view.
        sidePagesIters = {}
        self.store = {}
        self.storeFilter = {}
        for sidepage in self.sidePages:
            sp, sp_id, sp_cat = sidepage
            if not self.store.has_key(sp_cat):  #       Label         Icon          sidePage     Category
                self.store[sidepage[2]] = Gtk.ListStore(str,    GdkPixbuf.Pixbuf,    object,     str)
                for category in CATEGORIES:
                    if category["id"] == sp_cat:
                        category["show"] = True
            iconFile = "/usr/lib/cinnamon-settings/data/icons/%s" % sp.icon
            if os.path.exists(iconFile):
                img = GdkPixbuf.Pixbuf.new_from_file_at_size( iconFile, 48, 48)
            else:
                img = None
            sidePagesIters[sp_id] = self.store[sp_cat].append([sp.name, img, sp, sp_cat])

        for key in self.store.keys():
            self.storeFilter[key] = self.store[key].filter_new()
            self.storeFilter[key].set_visible_func(self.filter_visible_function)

        self.displayCategories()

        # set up larger components.
        self.window.set_title(_("System Settings"))
        self.window.connect("destroy", Gtk.main_quit)
        self.button_cancel.connect("clicked", Gtk.main_quit)
        self.button_back.connect('clicked', self.back_to_icon_view)

        # Select the first sidePage
        if len(sys.argv) > 1 and sys.argv[1] in sidePagesIters.keys():
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

    def filter_visible_function(self, model, iter, user_data = None):
        sidePage = model.get_value(iter, 2)
        text = self.search_entry.get_text().lower()
        if sidePage.advanced:
            if not self.advanced_mode:
                return False
        if sidePage.name.lower().find(text) > -1 or \
           sidePage.keywords.lower().find(text) > -1:
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
            self.side_view_container.pack_start(widget, False, False, 10)
        box = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 4)
        iconFile = "/usr/lib/cinnamon-settings/data/icons/%s" % category["icon"]
        if os.path.exists(iconFile):
            img = GdkPixbuf.Pixbuf.new_from_file_at_size( iconFile, 30, 30)
            box.pack_start(Gtk.Image.new_from_pixbuf(img), False, False, 4)
        else:
            img = None

        widget = Gtk.Label()
        widget.set_use_markup(True)
        widget.set_markup('<span size="12000">%s</span>' % category["label"])
        widget.set_alignment(.5, .5)
        box.pack_start(widget, False, False, 1)
        self.side_view_container.pack_start(box, False, False, 0)
        widget = Gtk.IconView.new_with_model(self.storeFilter[category["id"]])
        widget.set_text_column(0)
        widget.set_pixbuf_column(1)
        widget.set_item_width(110)
        widget.set_row_spacing(0)
        widget.set_column_spacing(0)
        widget.set_row_spacing(0)
        widget.set_hexpand(True)
        widget.set_vexpand(False)
        css_provider = Gtk.CssProvider()
        css_provider.load_from_data("GtkIconView {background-color: @bg_color;}")
        c = widget.get_style_context()
        c.add_provider(css_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
        self.side_view[category["id"]] = widget
        self.side_view_container.pack_start(self.side_view[category["id"]], False, False, 0)
        self.first_category_done = True
        self.side_view[category["id"]].connect("selection_changed", self.side_view_nav, category["id"])

    def anyVisibleInCategory(self, category):
        id = category["id"]
        iter = self.storeFilter[id].get_iter_first()
        visible = False
        while iter is not None:
            cat = self.storeFilter[id].get_value(iter, 3)
            visible = cat == category["id"]
            iter = self.storeFilter[id].iter_next(iter)
        return visible

    def findPath (self, name):
        for key in self.store.keys():
            path = self.store[key].get_path(name)
            if path is not None:
                filtered_path = self.side_view[key].get_model().convert_child_path_to_path(path)
                if filtered_path is not None:
                    self.side_view[key].select_path(filtered_path)
                    return

    def setParentRefs (self, mod):
        try:
            mod._setParentRef(self.window, self.builder)
        except AttributeError:
            pass
        return True

    def loadCheck (self, mod):
        try:
            return mod._loadCheck()
        except:
            return True

    def back_to_icon_view(self, widget):
        self.window.set_title(_("System Settings"))
        self.content_box_sw.hide()
        children = self.content_box.get_children()
        for child in children:
            child.hide()
            if child.get_name() == "c_box":
                c_widgets = child.get_children()
                for c_widget in c_widgets:
                    c_widget.hide()
        self.button_back.hide()
        self.side_view_sw.show()
        self.search_entry.show()
        self.search_entry.grab_focus()
        self.current_sidepage = None

    def on_menu_button_clicked(self, widget):
        popup = Gtk.Menu()
        popup.attach_to_widget(widget, None)
        popup_normal_mode = Gtk.CheckMenuItem(_("Normal Mode"))
        popup_normal_mode.set_draw_as_radio(True)
        popup_normal_mode.set_active(not self.advanced_mode)
        popup_normal_mode.show()
        popup.append(popup_normal_mode)
        popup_advanced_mode = Gtk.CheckMenuItem(_("Advanced Mode"))
        popup_advanced_mode.set_draw_as_radio(True)
        popup_advanced_mode.set_active(self.advanced_mode)
        popup_advanced_mode.show()
        popup.append(popup_advanced_mode)

        popup_normal_mode.connect('activate', self.on_normal_mode)
        popup_advanced_mode.connect('activate', self.on_advanced_mode)
        popup.popup(None, None, None, None, 0, 0)

    def on_advanced_mode(self, popup):
        self.advanced_mode = True
        self.settings.set_boolean(ADVANCED_GSETTING, True)
        if self.current_sidepage is not None:
            self.current_sidepage.build(self.advanced_mode)
        self.displayCategories()

    def on_normal_mode(self, popup):
        self.advanced_mode = False
        self.settings.set_boolean(ADVANCED_GSETTING, False)
        if self.current_sidepage is not None:
            self.current_sidepage.build(self.advanced_mode)
        self.displayCategories()

if __name__ == "__main__":
    GObject.threads_init()
    GtkClutter.init(None)
    Gst.init(None)
    MainWindow()
    Gtk.main()
