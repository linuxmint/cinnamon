#!/usr/bin/env python2

import sys
reload(sys)
sys.setdefaultencoding('utf-8')

sys.path.append('/usr/share/cinnamon/cinnamon-settings/modules')
sys.path.append('/usr/share/cinnamon/cinnamon-settings/bin')
import os
import glob
import gettext
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gio, Gtk, GObject, GdkPixbuf, GLib, Pango, Gdk, cairo
import SettingsWidgets
import capi
import time
import traceback
import locale
import urllib2
import proxygsettings
from functools import cmp_to_key

# i18n
gettext.install("cinnamon", "/usr/share/locale")

# Standard setting pages... this can be expanded to include applet dirs maybe?
mod_files = glob.glob('/usr/share/cinnamon/cinnamon-settings/modules/*.py')
mod_files.sort()
if len(mod_files) is 0:
    print "No settings modules found!!"
    sys.exit(1)

mod_files = [x.split('/')[6].split('.')[0] for x in mod_files]

for mod_file in mod_files:
    if mod_file[0:3] != "cs_":
        raise Exception("Settings modules must have a prefix of 'cs_' !!")

modules = map(__import__, mod_files)

# i18n for menu item
menuName = _("System Settings")
menuComment = _("Control Center")

WIN_WIDTH = 800
WIN_HEIGHT = 600
WIN_H_PADDING = 20

MIN_LABEL_WIDTH = 16
MAX_LABEL_WIDTH = 25
MIN_PIX_WIDTH = 100
MAX_PIX_WIDTH = 160

MOUSE_BACK_BUTTON = 8

CATEGORIES = [
#        Display name                         ID              Show it? Always False to start              Icon
    {"label": _("Appearance"),            "id": "appear",      "show": False,                       "icon": "cs-cat-appearance"},
    {"label": _("Preferences"),           "id": "prefs",       "show": False,                       "icon": "cs-cat-prefs"},
    {"label": _("Hardware"),              "id": "hardware",    "show": False,                       "icon": "cs-cat-hardware"},
    {"label": _("Administration"),        "id": "admin",       "show": False,                       "icon": "cs-cat-admin"}
]

CONTROL_CENTER_MODULES = [
#         Label                              Module ID                Icon                         Category      Keywords for filter
    [_("Networking"),                       "network",            "cs-network",                 "hardware",      _("network, wireless, wifi, ethernet, broadband, internet")],
    [_("Display"),                          "display",            "cs-display",                 "hardware",      _("display, screen, monitor, layout, resolution, dual, lcd")],
    [_("Bluetooth"),                        "bluetooth",          "cs-bluetooth",               "hardware",      _("bluetooth, dongle, transfer, mobile")],
    [_("Sound"),                            "sound",              "cs-sound",                   "hardware",      _("sound, speakers, headphones, test")],
    [_("Color"),                            "color",              "cs-color",                   "hardware",      _("color, profile, display, printer, output")],
    [_("Graphics Tablet"),                  "wacom",              "cs-tablet",                  "hardware",      _("wacom, digitize, tablet, graphics, calibrate, stylus")]
]

STANDALONE_MODULES = [
#         Label                          Executable                          Icon                Category        Keywords for filter
    [_("Printers"),                      "system-config-printer",        "cs-printer",         "hardware",       _("printers, laser, inkjet")],
    [_("Firewall"),                      "gufw",                         "cs-firewall",        "admin",          _("firewall, block, filter, programs")],
    [_("Languages"),                     "mintlocale",                   "cs-language",        "prefs",          _("language, install, foreign")],
    [_("Input Method"),                  "mintlocale im",                "cs-input-method",    "prefs",          _("language, install, foreign, input, method, chinese, korean, japanese, typing")],
    [_("Login Window"),                  "gksu /usr/sbin/mdmsetup",      "cs-login",           "admin",          _("login, mdm, gdm, manager, user, password, startup, switch")],
    [_("Driver Manager"),                "mintdrivers",                  "cs-drivers",         "admin",          _("video, driver, wifi, card, hardware, proprietary, nvidia, radeon, nouveau, fglrx")],
    [_("Software Sources"),              "mintsources",                  "cs-sources",         "admin",          _("ppa, repository, package, source, download")],
    [_("Users and Groups"),              "cinnamon-settings-users",      "cs-user-accounts",   "admin",          _("user, users, account, accounts, group, groups, password")],
    [_("Bluetooth"),                     "blueberry",                    "cs-bluetooth",       "hardware",       _("bluetooth, dongle, transfer, mobile")]
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
    
    def _on_sidepage_hide_stack(self):
        self.stack_switcher.set_opacity(0)
        
    def _on_sidepage_show_stack(self):
        self.stack_switcher.set_opacity(1)

    def go_to_sidepage(self, cat, path):
        iterator = self.store[cat].get_iter(path)
        sidePage = self.store[cat].get_value(iterator,2)
        if not sidePage.is_standalone:
            self.window.set_title(sidePage.name)
            sidePage.build()
            if sidePage.stack:
                current_page = sidePage.stack.get_visible_child_name()
                self.stack_switcher.set_stack(sidePage.stack)
                l = sidePage.stack.get_children()
                if len(l) > 0:
                    sidePage.stack.set_visible_child(l[0])
                    if sidePage.stack.get_visible():
                        self.stack_switcher.set_opacity(1)
                    else:
                        self.stack_switcher.set_opacity(0)
                    if hasattr(sidePage, "connect_proxy"):
                        sidePage.connect_proxy("hide_stack", self._on_sidepage_hide_stack)
                        sidePage.connect_proxy("show_stack", self._on_sidepage_show_stack)
                else:
                    self.stack_switcher.set_opacity(0)
            else:
                self.stack_switcher.set_opacity(0)
            self.main_stack.set_visible_child_name("content_box_page")
            self.header_stack.set_visible_child_name("content_box")
            self.current_sidepage = sidePage
            width = 0
            for widget in self.top_bar:
                m, n = widget.get_preferred_width()
                width += n
            self.top_bar.set_size_request(width + 20, -1)
            self.maybe_resize(sidePage)
        else:
            sidePage.build()

    def maybe_resize(self, sidePage):
        m, n = self.content_box.get_preferred_size()

        # Resize horizontally if the module is wider than the window
        use_width = WIN_WIDTH
        if n.width > WIN_WIDTH:
            use_width = n.width

        # Resize vertically depending on the height requested by the module
        use_height = WIN_HEIGHT
        if not sidePage.size:
            # No height requested, resize vertically if the module is taller than the window
            if n.height > WIN_HEIGHT:
                use_height = n.height + self.bar_heights + WIN_H_PADDING
            #self.window.resize(use_width, n.height + self.bar_heights + WIN_H_PADDING)
        elif sidePage.size > 0:
            # Height hardcoded by the module
            use_height = sidePage.size + self.bar_heights + WIN_H_PADDING
        elif sidePage.size == -1:
            # Module requested the window to fit it (i.e. shrink the window if necessary)
            use_height = n.height + self.bar_heights + WIN_H_PADDING

        self.window.resize(use_width, use_height)

    def deselect(self, cat):
        for key in self.side_view.keys():
            if key is not cat:
                self.side_view[key].unselect_all()

    ''' Create the UI '''
    @print_timing
    def __init__(self):
        self.builder = Gtk.Builder()
        self.builder.add_from_file("/usr/share/cinnamon/cinnamon-settings/cinnamon-settings.ui")
        self.window = self.builder.get_object("main_window")
        self.top_bar = self.builder.get_object("top_bar")
        self.side_view = {}
        self.main_stack = self.builder.get_object("main_stack")
        self.main_stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
        self.main_stack.set_transition_duration(150)
        self.header_stack = self.builder.get_object("header_stack")
        self.header_stack.set_transition_type(Gtk.StackTransitionType.CROSSFADE)
        self.header_stack.set_transition_duration(150)
        self.side_view_container = self.builder.get_object("category_box")
        self.side_view_sw = self.builder.get_object("side_view_sw")
        self.side_view_sw.show_all()
        self.content_box = self.builder.get_object("content_box")
        self.content_box_sw = self.builder.get_object("content_box_sw")
        self.content_box_sw.show_all()
        self.button_back = self.builder.get_object("button_back")
        self.button_back.set_tooltip_text(_("Back to all settings"))
        button_image = self.builder.get_object("image1")
        button_image.props.icon_size = Gtk.IconSize.MENU

        self.stack_switcher = self.builder.get_object("stack_switcher")
        # Set stack to random thing and make opacity 0 so that the heading bar
        # does not resize when switching between pages
        self.stack_switcher.set_stack(self.main_stack)

        m, n = self.button_back.get_preferred_width()
        self.stack_switcher.set_margin_right(n)

        self.search_entry = self.builder.get_object("search_box")
        self.search_entry.connect("changed", self.onSearchTextChanged)
        self.search_entry.connect("icon-press", self.onClearSearchBox)

        self.window.connect("destroy", self.quit)
        self.window.connect("key-press-event", self.on_keypress)
        self.window.connect("button-press-event", self.on_buttonpress)
        self.window.show()

        self.builder.connect_signals(self)
        self.window.set_has_resize_grip(False)
        self.unsortedSidePages = []
        self.sidePages = []
        self.settings = Gio.Settings.new("org.cinnamon")
        self.current_cat_widget = None

        self.current_sidepage = None
        self.c_manager = capi.CManager()
        self.content_box.c_manager = self.c_manager
        self.bar_heights = 0

        for module in modules:
            try:
                mod = module.Module(self.content_box)
                if self.loadCheck(mod) and self.setParentRefs(mod):
                    self.unsortedSidePages.append((mod.sidePage, mod.name, mod.category))
            except:
                print "Failed to load module %s" % module
                traceback.print_exc()

        for item in CONTROL_CENTER_MODULES:
            ccmodule = SettingsWidgets.CCModule(item[0], item[1], item[2], item[3], item[4], self.content_box)
            if ccmodule.process(self.c_manager):
                self.unsortedSidePages.append((ccmodule.sidePage, ccmodule.name, ccmodule.category))

        for item in STANDALONE_MODULES:
            samodule = SettingsWidgets.SAModule(item[0], item[1], item[2], item[3], item[4], self.content_box)
            if samodule.process():
                self.unsortedSidePages.append((samodule.sidePage, samodule.name, samodule.category))

        # sort the modules alphabetically according to the current locale
        sidePageNamesToSort = map(lambda m: m[0].name, self.unsortedSidePages)
        sortedSidePageNames = sorted(sidePageNamesToSort, key=cmp_to_key(locale.strcoll))
        for sidePageName in sortedSidePageNames:
            nextSidePage = None
            for trySidePage in self.unsortedSidePages:
                if(trySidePage[0].name == sidePageName):
                    nextSidePage = trySidePage

            self.sidePages.append(nextSidePage);


        # create the backing stores for the side nav-view.
        sidePagesIters = {}
        self.store = {}
        self.storeFilter = {}
        for sidepage in self.sidePages:
            sp, sp_id, sp_cat = sidepage
            if not self.store.has_key(sp_cat):  #       Label         Icon          sidePage     Category
                self.store[sidepage[2]] = Gtk.ListStore(str,          str,    object,     str)
                for category in CATEGORIES:
                    if category["id"] == sp_cat:
                        category["show"] = True

            # Don't allow item names (and their translations) to be more than 30 chars long. It looks ugly and it creates huge gaps in the icon views
            name = unicode(sp.name,'utf-8')
            if len(name) > 30:
                name = "%s..." % name[:30]
            sidePagesIters[sp_id] = (self.store[sp_cat].append([name, sp.icon, sp, sp_cat]), sp_cat)

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
        self.button_back.connect('clicked', self.back_to_icon_view)

        self.calculate_bar_heights()

        # Select the first sidePage
        if len(sys.argv) > 1 and sys.argv[1] in sidePagesIters.keys():
            (iter, cat) = sidePagesIters[sys.argv[1]]
            path = self.store[cat].get_path(iter)
            if path:
                self.go_to_sidepage(cat, path)
            else:
                self.search_entry.grab_focus()
        else:
            self.search_entry.grab_focus()

    def on_keypress(self, widget, event):
        grab = False
        device = Gtk.get_current_event_device()
        if device.get_source() == Gdk.InputSource.KEYBOARD:
            grab = Gdk.Display.get_default().device_is_grabbed(device)
        if not grab and event.keyval == Gdk.KEY_BackSpace and (type(self.window.get_focus()) not in
                    (Gtk.TreeView, Gtk.Entry, Gtk.SpinButton, Gtk.TextView)):
            self.back_to_icon_view(None)
            return True
        return False

    def on_buttonpress(self, widget, event):
        if event.button == MOUSE_BACK_BUTTON:
            self.back_to_icon_view(None)
            return True
        return False

    def calculate_bar_heights(self):
        h = 0
        m, n = self.top_bar.get_preferred_size()
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

    def pixbuf_data_func(self, column, cell, model, iter, data=None):
        wrapper = model.get_value(iter, 1)
        if wrapper:
            cell.set_property('surface', wrapper.surface)

    def prepCategory(self, category):
        self.storeFilter[category["id"]].refilter()
        if not self.anyVisibleInCategory(category):
            return
        if self.first_category_done:
            widget = Gtk.Separator.new(Gtk.Orientation.HORIZONTAL)
            self.side_view_container.pack_start(widget, False, False, 10)

        box = Gtk.Box.new(Gtk.Orientation.HORIZONTAL, 4)
        img = Gtk.Image.new_from_icon_name(category["icon"], Gtk.IconSize.BUTTON)
        box.pack_start(img, False, False, 4)

        widget = Gtk.Label()
        widget.set_use_markup(True)
        widget.set_markup('<span size="12000">%s</span>' % category["label"])
        widget.set_alignment(.5, .5)
        box.pack_start(widget, False, False, 1)
        self.side_view_container.pack_start(box, False, False, 0)
        widget = Gtk.IconView.new_with_model(self.storeFilter[category["id"]])

        area = widget.get_area()

        widget.set_item_width(self.min_pix_length)
        widget.set_item_padding(0)
        widget.set_column_spacing(18)
        widget.set_row_spacing(18)
        widget.set_margin(20)

        pixbuf_renderer = Gtk.CellRendererPixbuf()
        text_renderer = Gtk.CellRendererText(ellipsize=Pango.EllipsizeMode.NONE, wrap_mode=Pango.WrapMode.WORD_CHAR, wrap_width=0, width_chars=self.min_label_length, alignment=Pango.Alignment.CENTER)

        text_renderer.set_alignment(.5, 0)
        area.pack_start(pixbuf_renderer, True, True, False)
        area.pack_start(text_renderer, True, True, False)
        area.add_attribute(pixbuf_renderer, "icon-name", 1)
        pixbuf_renderer.set_property("stock-size", Gtk.IconSize.DIALOG)
        pixbuf_renderer.set_property("follow-state", True)

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

    def setParentRefs (self, mod):
        try:
            mod._setParentRef(self.window)
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
        children = self.content_box.get_children()
        for child in children:
            child.hide()
            if child.get_name() == "c_box":
                c_widgets = child.get_children()
                for c_widget in c_widgets:
                    c_widget.hide()
        self.main_stack.set_visible_child_name("side_view_page")
        self.header_stack.set_visible_child_name("side_view")
        self.search_entry.grab_focus()
        self.current_sidepage = None

    def quit(self, *args):
        self.window.destroy()
        Gtk.main_quit()

if __name__ == "__main__":
    import signal

    ps = proxygsettings.get_proxy_settings()
    if ps:
        proxy = urllib2.ProxyHandler(ps)
    else:
        proxy = urllib2.ProxyHandler()
    urllib2.install_opener(urllib2.build_opener(proxy))

    window = MainWindow()
    signal.signal(signal.SIGINT, window.quit)
    Gtk.main()
