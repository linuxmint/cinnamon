#!/usr/bin/env python

import sys
reload(sys)
sys.setdefaultencoding('utf-8')

try:
    sys.path.append('/usr/lib/cinnamon-settings/modules')
    sys.path.append('/usr/lib/cinnamon-settings/bin')
    import os
    import glob
    import gettext
    from gi.repository import Gio, Gtk, GObject, GdkPixbuf, GLib, Pango, Gdk
    import SettingsWidgets
    import capi
    import time
    import grp
    import pwd
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
NormalMode = _("Switch to Normal Mode")
AdvancedMode = _("Switch to Advanced Mode")

ADVANCED_GSETTING = "cinnamon-settings-advanced"

WIN_WIDTH = 800
WIN_HEIGHT = 600
WIN_H_PADDING = 20

MIN_LABEL_WIDTH = 16
MAX_LABEL_WIDTH = 25
MIN_PIX_WIDTH = 100
MAX_PIX_WIDTH = 160

CATEGORIES = [
#        Display name                         ID              Show it? Always False to start              Icon
    {"label": _("Appearance"),            "id": "appear",      "show": False,                       "icon": "cat-appearance.svg"},
    {"label": _("Preferences"),           "id": "prefs",       "show": False,                       "icon": "cat-prefs.svg"},
    {"label": _("Hardware"),              "id": "hardware",    "show": False,                       "icon": "cat-hardware.svg"},
    {"label": _("Administration"),        "id": "admin",       "show": False,                       "icon": "cat-admin.svg"}
]

CONTROL_CENTER_MODULES = [
#         Label                              Module ID                Icon                         Category      Advanced?                      Keywords for filter
    [_("Networking"),                       "network",            "network.svg",                 "hardware",      False,          _("network, wireless, wifi, ethernet, broadband, internet")],
    [_("Display"),                          "display",            "display.svg",                 "hardware",      False,          _("display, screen, monitor, layout, resolution, dual, lcd")],
    [_("Bluetooth"),                        "bluetooth",          "bluetooth.svg",               "hardware",      False,          _("bluetooth, dongle, transfer, mobile")], 
    [_("Universal Access"),                 "universal-access",   "universal-access.svg",           "prefs",      False,          _("magnifier, talk, access, zoom, keys, contrast")],
    [_("Sound"),                            "sound",              "sound.svg",                   "hardware",      False,          _("sound, speakers, headphones, test")],
    [_("Color"),                            "color",              "color.svg",                   "hardware",      True,           _("color, profile, display, printer, output")],
    [_("Graphics Tablet"),                  "wacom",              "tablet.svg",                  "hardware",      True,           _("wacom, digitize, tablet, graphics, calibrate, stylus")]
]

STANDALONE_MODULES = [
#         Label                          Executable                          Icon                Category        Advanced?               Keywords for filter
    [_("Printers"),                      "system-config-printer",        "printer.svg",         "hardware",       False,          _("printers, laser, inkjet")],    
    [_("Firewall"),                      "gufw",                         "firewall.svg",        "admin",          True,           _("firewall, block, filter, programs")],
    [_("Languages"),                     "mintlocale",                   "language.svg",        "prefs",          False,          _("language, install, foreign")],
    [_("Login Screen"),                  "gksu /usr/sbin/mdmsetup",      "login.svg",           "admin",          True,           _("login, mdm, gdm, manager, user, password, startup, switch")],
    [_("Startup Programs"),              "cinnamon-session-properties",  "startup-programs.svg","prefs",          False,          _("startup, programs, boot, init, session")],
    [_("Device Drivers"),                "mintdrivers",                  "drivers.svg",         "admin",          False,          _("video, driver, wifi, card, hardware, proprietary, nvidia, radeon, nouveau, fglrx")],
    [_("Software Sources"),              "mintsources",                  "sources.svg",         "admin",          True,           _("ppa, repository, package, source, download")],
    [_("Users and Groups"),              "cinnamon-settings-users",      "user-accounts.svg",   "admin",          True,           _("user, users, account, accounts, group, groups, password")]
]

def print_timing(func):
    def wrapper(*arg):
        t1 = time.time()
        res = func(*arg)
        t2 = time.time()
        print '%s took %0.3f ms' % (func.func_name, (t2-t1)*1000.0)
        return res
    return wrapper

def touch(fname, times=None):
    with file(fname, 'a'):
        os.utime(fname, times)


class MainWindow:

    # Change pages
    def side_view_nav(self, side_view, path, cat):
        selected_items = side_view.get_selected_items()
        if len(selected_items) > 0:
            self.deselect(cat)
            filtered_path = side_view.get_model().convert_path_to_child_path(selected_items[0])
            if filtered_path is not None:
                self.go_to_sidepage(cat, filtered_path)

    def go_to_sidepage(self, cat, path):        
        iterator = self.store[cat].get_iter(path)
        sidePage = self.store[cat].get_value(iterator,2)
        if not sidePage.is_standalone:
            self.side_view_sw.hide()
            self.search_entry.hide()
            self.window.set_title(sidePage.name)
            sidePage.build(self.advanced_mode)
            self.content_box_sw.show()
            self.button_back.show()
            self.current_sidepage = sidePage
            self.maybe_resize(sidePage)
            GObject.timeout_add(250, self.fade_in)
        else:
            sidePage.build(self.advanced_mode)

    def maybe_resize(self, sidePage):
        if not sidePage.size:
            m, n = self.content_box.get_preferred_size()
            self.window.resize(WIN_WIDTH, n.height + self.bar_heights + WIN_H_PADDING)
        elif sidePage.size > -1:
            self.window.resize(WIN_WIDTH, sidePage.size + self.bar_heights + WIN_H_PADDING)

    def deselect(self, cat):
        for key in self.side_view.keys():
            if key is not cat:
                self.side_view[key].unselect_all()

    ''' Create the UI '''
    @print_timing
    def __init__(self):

        self.builder = Gtk.Builder()
        self.builder.add_from_file("/usr/lib/cinnamon-settings/cinnamon-settings.ui")
        self.window = self.builder.get_object("main_window")
        self.top_bar = self.builder.get_object("top_bar")
        self.bottom_bar = self.builder.get_object("bottom_bar")
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
        self.window.connect("destroy", self.quit)
        self.window.connect("key-press-event", self.on_keypress)

        self.builder.connect_signals(self)
        self.window.set_has_resize_grip(False)
        self.sidePages = []
        self.settings = Gio.Settings.new("org.cinnamon")
        self.current_cat_widget = None

        self.advanced_mode = self.force_advanced() or self.settings.get_boolean(ADVANCED_GSETTING)
        self.mode_button = self.builder.get_object("mode_button")
        self.mode_button.set_size_request(self.get_mode_size(), -1)
        if self.advanced_mode:
            self.mode_button.set_label(NormalMode)
        else:
            self.mode_button.set_label(AdvancedMode)

        self.current_sidepage = None
        self.c_manager = capi.CManager()
        self.content_box.c_manager = self.c_manager
        self.bar_heights = 0

        for i in range(len(modules)):
            try:
                mod = modules[i].Module(self.content_box)
                if self.loadCheck(mod) and self.setParentRefs(mod):
                    self.sidePages.append((mod.sidePage, mod.name, mod.category))
            except:
                print "Failed to load module %s" % modules[i]
                import traceback
                traceback.print_exc()

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

        self.min_label_length = 0
        self.min_pix_length = 0

        for key in self.store.keys():
            char, pix = self.get_label_min_width(self.store[key])
            self.min_label_length = max(char, self.min_label_length)
            self.min_pix_length = max(pix, self.min_pix_length)
            self.storeFilter[key] = self.store[key].filter_new()
            self.storeFilter[key].set_visible_func(self.filter_visible_function)

        self.min_label_length += 2
        self.min_pix_length += 4

        self.min_label_length = max(self.min_label_length, MIN_LABEL_WIDTH)
        self.min_pix_length = max(self.min_pix_length, MIN_PIX_WIDTH)

        self.min_label_length = min(self.min_label_length, MAX_LABEL_WIDTH)
        self.min_pix_length = min(self.min_pix_length, MAX_PIX_WIDTH)

        self.displayCategories()

        # set up larger components.
        self.window.set_title(_("System Settings"))
        self.window.connect("destroy", self.quit)
        self.button_cancel.connect("clicked", self.quit)
        self.button_back.connect('clicked', self.back_to_icon_view)
        self.window.set_opacity(0)
        self.window.show()
        self.calculate_bar_heights()

        # Select the first sidePage
        if len(sys.argv) > 1 and sys.argv[1] in sidePagesIters.keys():
            first_page_iter = sidePagesIters[sys.argv[1]]
            self.findPath(first_page_iter)
        else:
            self.search_entry.grab_focus()
            self.fade_in()

    def on_keypress(self, widget, event):
        if event.keyval == Gdk.KEY_BackSpace and type(self.window.get_focus()) != Gtk.Entry and \
                                                 type(self.window.get_focus()) != Gtk.TreeView:
            self.back_to_icon_view(None)
            return True
        return False

    def fade_in(self):
        self.window.set_opacity(1.0)

    def force_advanced(self):
        ret = False
        user_name = pwd.getpwuid(os.getuid()).pw_name

        groups = grp.getgrall()
        for group in groups:
            (name, pw, gid, mem) = group
            if name in ("adm", "sudo"):
                for user in mem:
                    if user_name == user:
                        ret = True

        if os.path.exists(os.path.join(GLib.get_user_config_dir(), ".cs_no_default")):
            ret = False

        return ret

    def get_mode_size(self):
        self.mode_button.set_label(AdvancedMode)
        amw, apw = self.mode_button.get_preferred_width()
        self.mode_button.set_label(NormalMode)
        nmw, npw = self.mode_button.get_preferred_width()
        return max(apw, npw)

    def calculate_bar_heights(self):
        h = 0
        m, n = self.top_bar.get_preferred_size()
        h += n.height
        m, n = self.bottom_bar.get_preferred_size()
        h += n.height
        self.bar_heights = h

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

    def get_label_min_width(self, model):
        min_width_chars = 0
        min_width_pixels = 0
        icon_view = Gtk.IconView()
        iter = model.get_iter_first()
        while iter != None:
            string = model.get_value(iter, 0)
            split_by_word = string.split(" ")
            for word in split_by_word:
                layout = icon_view.create_pango_layout(word)
                item_width, item_height = layout.get_pixel_size()
                if item_width > min_width_pixels:
                    min_width_pixels = item_width
                if len(word) > min_width_chars:
                    min_width_chars = len(word)
            iter = model.iter_next(iter)
        return min_width_chars, min_width_pixels

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

        area = widget.get_area()

        widget.set_item_width(self.min_pix_length)
        pixbuf_renderer = Gtk.CellRendererPixbuf()
        text_renderer = Gtk.CellRendererText(ellipsize=Pango.EllipsizeMode.NONE, wrap_mode=Pango.WrapMode.WORD_CHAR, wrap_width=0, width_chars=self.min_label_length, alignment=Pango.Alignment.CENTER)

        text_renderer.set_alignment(.5, 0)
        area.pack_start(pixbuf_renderer, True, True, False)
        area.pack_start(text_renderer, True, True, False)
        area.add_attribute(pixbuf_renderer, "pixbuf", 1)
        area.add_attribute(text_renderer, "text", 0)

        css_provider = Gtk.CssProvider()
        css_provider.load_from_data("GtkIconView {                             \
                                         background-color: transparent;        \
                                     }                                         \
                                     GtkIconView.view.cell:selected {          \
                                         background-color: @selected_bg_color; \
                                     }")
        c = widget.get_style_context()
        c.add_provider(css_provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
        self.side_view[category["id"]] = widget
        self.side_view_container.pack_start(self.side_view[category["id"]], False, False, 0)
        self.first_category_done = True
        self.side_view[category["id"]].connect("item-activated", self.side_view_nav, category["id"])
        self.side_view[category["id"]].connect("button-release-event", self.button_press, category["id"])
        self.side_view[category["id"]].connect("keynav-failed", self.on_keynav_failed, category["id"])
        self.side_view[category["id"]].connect("selection-changed", self.on_selection_changed, category["id"])

    def bring_selection_into_view(self, iconview):
        sel = iconview.get_selected_items()

        if sel:
            path = sel[0]
            found, rect = iconview.get_cell_rect(path, None)

            cw = self.side_view_container.get_window()
            cw_x, cw_y = cw.get_position()

            ivw = iconview.get_window()
            iv_x, iv_y = ivw.get_position()

            final_y = rect.y + (rect.height / 2) + cw_y + iv_y

            adj = self.side_view_sw.get_vadjustment()
            page = adj.get_page_size()
            current_pos = adj.get_value()

            if final_y > current_pos + page:
                adj.set_value(iv_y + rect.y)
            elif final_y < current_pos:
                adj.set_value(iv_y + rect.y)

    def on_selection_changed(self, widget, category):
        sel = widget.get_selected_items()
        if len(sel) > 0:
            self.current_cat_widget = widget
            self.bring_selection_into_view(widget)
        for iv in self.side_view:
            if self.side_view[iv] == self.current_cat_widget:
                continue
            self.side_view[iv].unselect_all()

    def get_cur_cat_index(self, category):
        i = 0
        for cat in CATEGORIES:
            if category == cat["id"]:
                return i
            i += 1

    def get_cur_column(self, iconview):
        s, path, cell = iconview.get_cursor()
        if path:
            col = iconview.get_item_column(path)
            return col

    def reposition_new_cat(self, sel, iconview):
        iconview.set_cursor(sel, None, False)
        iconview.select_path(sel)
        iconview.grab_focus()

    def on_keynav_failed(self, widget, direction, category):
        num_cats = len(CATEGORIES)
        current_idx = self.get_cur_cat_index(category)
        new_cat = CATEGORIES[current_idx]
        ret = False
        dist = 1000
        sel = None

        if direction == Gtk.DirectionType.DOWN and current_idx < num_cats - 1:
            new_cat = CATEGORIES[current_idx + 1]
            col = self.get_cur_column(widget)
            new_cat_view = self.side_view[new_cat["id"]]
            model = new_cat_view.get_model()
            iter = model.get_iter_first()
            while iter is not None:
                path = model.get_path(iter)
                c = new_cat_view.get_item_column(path)
                d = abs(c - col)
                if d < dist:
                    sel = path
                    dist = d
                iter = model.iter_next(iter)
            self.reposition_new_cat(sel, new_cat_view)
            ret = True
        elif direction == Gtk.DirectionType.UP and current_idx > 0:
            new_cat = CATEGORIES[current_idx - 1]
            col = self.get_cur_column(widget)
            new_cat_view = self.side_view[new_cat["id"]]
            model = new_cat_view.get_model()
            iter = model.get_iter_first()
            while iter is not None:
                path = model.get_path(iter)
                c = new_cat_view.get_item_column(path)
                d = abs(c - col)
                if d <= dist:
                    sel = path
                    dist = d
                iter = model.iter_next(iter)
            self.reposition_new_cat(sel, new_cat_view)
            ret = True
        return ret

    def button_press(self, widget, event, category):
        if event.button == 1:
            self.side_view_nav(widget, None, category)

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
                GObject.idle_add(self.do_side_view, key, path)

    def do_side_view(self, key, path):
        self.go_to_sidepage(key, path)

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
        self.window.resize(WIN_WIDTH, WIN_HEIGHT)
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
        if self.advanced_mode:
            self.mode_button.set_label(AdvancedMode)
            self.on_normal_mode()
        else:
            self.mode_button.set_label(NormalMode)
            self.on_advanced_mode()
        touch(os.path.join(GLib.get_user_config_dir(), ".cs_no_default"))
        return True

    def on_advanced_mode(self):
        self.advanced_mode = True
        self.settings.set_boolean(ADVANCED_GSETTING, True)
        if self.current_sidepage is not None:
            self.current_sidepage.build(self.advanced_mode)
            self.maybe_resize(self.current_sidepage)
        self.displayCategories()

    def on_normal_mode(self):
        self.advanced_mode = False
        self.settings.set_boolean(ADVANCED_GSETTING, False)
        if self.current_sidepage is not None:
            self.current_sidepage.build(self.advanced_mode)
            self.maybe_resize(self.current_sidepage)
        self.displayCategories()
    
    def quit(self, *args):
        Gtk.main_quit()


if __name__ == "__main__":
    import signal
    GObject.threads_init()
    signal.signal(signal.SIGINT, MainWindow().quit)
    Gtk.main()

