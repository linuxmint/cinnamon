#!/usr/bin/python3
from bin import util
util.strip_syspath_locals()

from functools import cmp_to_key
import getopt
import gettext
import glob
import locale
import os
from setproctitle import setproctitle
import sys
import time
import traceback
import typing
import unicodedata
import urllib.request as urllib

import gi
gi.require_version('Gtk', '3.0')
gi.require_version('XApp', '1.0')
from gi.repository import Gio, Gtk, Pango, Gdk, XApp

import config
sys.path.append(os.path.join(config.currentPath, "bin"))
sys.path.append(os.path.join(config.currentPath, "modules"))
from bin import capi
from bin import proxygsettings
from bin import SettingsWidgets

# i18n
gettext.install("cinnamon", "/usr/share/locale", names=["ngettext"])

# i18n for menu item
menuName = _("System Settings")
menuComment = _("Control Center")


class SidePageData(typing.NamedTuple):
    sp: SettingsWidgets.SidePage
    name: str
    cat: str


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
    [_("Network"),                          "network",            "cs-network",                 "hardware",      _("network, wireless, wifi, ethernet, broadband, internet")],
    [_("Color"),                            "color",              "cs-color",                   "hardware",      _("color, profile, display, printer, output")],
    [_("Graphics Tablet"),                  "wacom",              "cs-tablet",                  "hardware",      _("wacom, digitize, tablet, graphics, calibrate, stylus")]
]

STANDALONE_MODULES = [
    # Label                              Executable                             Icon                     Category          Keywords for filter
    [_("Printers"),                      "system-config-printer",               "cs-printer",            "hardware",       _("printers, laser, inkjet")],
    [_("Firewall"),                      "gufw",                                "cs-firewall",           "admin",          _("firewall, block, filter, programs")],
    [_("Firewall"),                      "firewall-config",                     "cs-firewall",           "admin",          _("firewall, block, filter, programs")],
    [_("Languages"),                     "mintlocale",                          "cs-language",           "prefs",          _("language, install, foreign")],
    [_("Input Method"),                  "mintlocale-im",                       "cs-input-method",       "prefs",          _("language, install, foreign, input, method, chinese, korean, japanese, typing")],
    [_("Login Window"),                  "pkexec lightdm-settings",             "cs-login",              "admin",          _("login, lightdm, mdm, gdm, manager, user, password, startup, switch")],
    [_("Login Window"),                  "lightdm-gtk-greeter-settings-pkexec", "cs-login",              "admin",          _("login, lightdm, manager, settings, editor")],
    [_("Driver Manager"),                "cinnamon-driver-manager",             "cs-drivers",            "admin",          _("video, driver, wifi, card, hardware, proprietary, nvidia, radeon, nouveau, fglrx")],
    [_("Nvidia Settings"),               "nvidia-settings",                     "cs-drivers",            "admin",          _("video, driver, proprietary, nvidia, settings")],
    [_("Software Sources"),              "pkexec mintsources",                  "cs-sources",            "admin",          _("ppa, repository, package, source, download")],
    [_("Package Management"),            "dnfdragora",                          "cs-sources",            "admin",          _("update, install, repository, package, source, download")],
    [_("Package Management"),            "yumex-dnf",                           "cs-sources",            "admin",          _("update, install, repository, package, source, download")],
    [_("Users and Groups"),              "cinnamon-settings-users",             "cs-user-accounts",      "admin",          _("user, users, account, accounts, group, groups, password")],
    [_("Bluetooth"),                     "blueberry",                           "cs-bluetooth",          "hardware",       _("bluetooth, dongle, transfer, mobile")],
    [_("Bluetooth"),                     "blueman-manager",                     "cs-bluetooth",          "hardware",       _("bluetooth, dongle, transfer, mobile")],
    [_("Manage Services and Units"),     "systemd-manager-pkexec",              "cs-sources",            "admin",          _("systemd, units, services, systemctl, init")],
    [_("Disks"),                         "gnome-disks",                         "org.gnome.DiskUtility", "hardware",       _("disks, manage, hardware, management, hard, hdd, pendrive, format, erase, test, create, iso, ISO, disk, image")]
]

TABS = {
    # KEY (cs_KEY.py) : {"tab_name": tab_number, ... }
    "accessibility":    {"visual": 0, "keyboard": 1, "typing": 2, "mouse": 3},
    "applets":          {"installed": 0, "more": 1, "download": 1},
    "backgrounds":      {"images": 0, "settings": 1},
    "default":          {"preferred": 0, "removable": 1},
    "desklets":         {"installed": 0, "more": 1, "download": 1, "general": 2},
    "display":          {"layout": 0, "settings": 1},
    "effects":          {"effects": 0, "customize": 1},
    "extensions":       {"installed": 0, "more": 1, "download": 1},
    "keyboard":         {"typing": 0, "shortcuts": 1, "layouts": 2},
    "mouse":            {"mouse": 0, "touchpad": 1},
    "power":            {"power": 0, "batteries": 1, "brightness": 2},
    "screensaver":      {"settings": 0, "customize": 1},
    "sound":            {"output": 0, "input": 1, "sounds": 2, "applications": 3, "settings": 4},
    "themes":           {"themes": 0, "download": 1, "options": 2},
    "windows":          {"titlebar": 0, "behavior": 1, "alttab": 2},
    "workspaces":       {"osd": 0, "settings": 1}
}

ARG_REWRITE = {
    'universal-access': 'accessibility',
    'screen':           'display',
    'screens':          'display',
    'bluetooth':        'blueberry',
    'hotcorners':       'hotcorner',
    'accounts':         'online-accounts',
    'colors':           'color',
    'me':               'user',
    'lightdm-settings': 'pkexec lightdm-settings',
    'login-screen':     'pkexec lightdm-settings',
    'window':           'windows',
    'background':       'backgrounds',
    'driver-manager':   'cinnamon-driver-manager',
    'drivers':          'cinnamon-driver-manager',
    'printers':         'system-config-printer',
    'printer':          'system-config-printer',
    'infos':            'info',
    'locale':           'mintlocale',
    'language':         'mintlocale',
    'input-method':     'mintlocale-im',
    'nvidia':           'nvidia-settings',
    'firewall':         'gufw',
    'networks':         'network',
    'sources':          'pkexec mintsources',
    'mintsources':      'pkexec mintsources',
    'panels':           'panel',
    'tablet':           'wacom',
    'users':            'cinnamon-settings-users'
}


def print_timing(func):
    # decorate functions with @print_timing to output how long they take to run.
    def wrapper(*args, **kwargs):
        t1 = time.time()
        res = func(*args, **kwargs)
        t2 = time.time()
        print('%s took %0.3f ms' % (func.__name__, (t2-t1)*1000.0))
        return res
    return wrapper


class MainWindow(Gio.Application):
    # Change pages
    def side_view_nav(self, side_view, path, cat):
        selected_items = side_view.get_selected_items()
        if len(selected_items) > 0:
            self.deselect(cat)
            filtered_path = side_view.get_model().convert_path_to_child_path(selected_items[0])
            if filtered_path is not None:
                iterator = self.store_by_cat[cat].get_iter(filtered_path)
                sidePage = self.store_by_cat[cat].get_value(iterator, 2)
                self.go_to_sidepage(sidePage, user_action=True)

    def _on_sidepage_hide_stack(self):
        self.stack_switcher.set_opacity(0)

    def _on_sidepage_show_stack(self):
        self.stack_switcher.set_opacity(1)

    def go_to_sidepage(self, sidePage: SettingsWidgets.SidePage, user_action=True):
        sidePage.build()
        
        if sidePage.is_standalone:
            return  # we're done

        if not user_action:
            self.window.set_title(sidePage.name)
            self.window.set_icon_name(sidePage.icon)

        if sidePage.stack:
            self.stack_switcher.set_stack(sidePage.stack)
            l = sidePage.stack.get_children()
            if len(l) > 0:
                if self.tab in range(len(l)):
                    sidePage.stack.set_visible_child(l[self.tab])
                    visible_child = sidePage.stack.get_visible_child()
                    if self.tab == 1 \
                            and hasattr(visible_child, 'sort_combo') \
                            and self.sort in range(5):
                        visible_child.sort_combo.set_active(self.sort)
                        visible_child.sort_changed()
                else:
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

        if user_action:
            self.main_stack.set_visible_child_name("content_box_page")
            self.header_stack.set_visible_child_name("content_box")
        else:
            self.main_stack.set_visible_child_full("content_box_page", Gtk.StackTransitionType.NONE)
            self.header_stack.set_visible_child_full("content_box", Gtk.StackTransitionType.NONE)

        self.current_sidepage = sidePage
        width = 0
        for widget in self.top_bar:
            m, n = widget.get_preferred_width()
            width += n
        self.top_bar.set_size_request(width + 20, -1)
        self.maybe_resize(sidePage)

    def maybe_resize(self, sidePage):
        m, n = self.content_box.get_preferred_size()

        # Resize vertically depending on the height requested by the module
        use_height = WIN_HEIGHT
        total_height = n.height + self.bar_heights + WIN_H_PADDING
        if not sidePage.size:
            # No height requested, resize vertically if the module is taller than the window
            if total_height > WIN_HEIGHT:
                use_height = total_height
        elif sidePage.size > 0:
            # Height hardcoded by the module
            use_height = sidePage.size + self.bar_heights + WIN_H_PADDING
        elif sidePage.size == -1:
            # Module requested the window to fit it (i.e. shrink the window if necessary)
            use_height = total_height

        self.window.resize(WIN_WIDTH, use_height)

    def deselect(self, cat):
        for key in self.side_view:
            if key is not cat:
                self.side_view[key].unselect_all()

    # Create the UI
    def __init__(self):
        Gio.Application.__init__(self,
                                 application_id="org.cinnamon.Settings_%d" % os.getpid(),
                                 flags=Gio.ApplicationFlags.NON_UNIQUE | Gio.ApplicationFlags.HANDLES_OPEN)
        self.builder = Gtk.Builder()
        self.builder.set_translation_domain('cinnamon')  # let it translate!
        self.builder.add_from_file(os.path.join(config.currentPath, "cinnamon-settings.ui"))
        self.window = XApp.GtkWindow(window_position=Gtk.WindowPosition.CENTER,
                                     default_width=800, default_height=600)

        main_box = self.builder.get_object("main_box")
        self.window.add(main_box)
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
        context = self.side_view_sw.get_style_context()
        context.add_class("cs-category-view")
        context.add_class("view")
        self.side_view_sw.show_all()
        self.content_box = self.builder.get_object("content_box")
        self.content_box_sw = self.builder.get_object("content_box_sw")
        self.content_box_sw.show_all()
        self.button_back = self.builder.get_object("button_back")
        self.button_back.set_tooltip_text(_("Back to all settings"))
        button_image = self.builder.get_object("image1")
        button_image.props.icon_size = Gtk.IconSize.MENU

        self.stack_switcher = self.builder.get_object("stack_switcher")

        self.search_entry = self.builder.get_object("search_box")
        self.search_entry.set_placeholder_text(_("Search"))
        self.search_entry.connect("changed", self.onSearchTextChanged)
        self.search_entry.connect("icon-press", self.onClearSearchBox)

        self.window.connect("destroy", self._quit)

        self.builder.connect_signals(self)
        self.sidePages: typing.List[SidePageData] = []
        self.settings = Gio.Settings.new("org.cinnamon")
        self.current_cat_widget = None

        self.current_sidepage = None
        self.c_manager = capi.CManager()
        self.content_box.c_manager = self.c_manager
        self.bar_heights = 0

        self.tab = 0  # open 'manage' tab by default
        self.sort = 1  # sorted by 'score' by default

        self.store_by_cat: typing.Dict[str, Gtk.ListStore] = {}
        self.storeFilter = {}

        # load CCC and standalone modules, but not python modules yet
        self.load_ccc_modules()
        self.load_standalone_modules()

        # if a certain sidepage is given via arguments, try to load only it
        if len(sys.argv) > 1:
            if self.load_sidepage_as_standalone():
                return
        
        self.init_settings_overview()

    def init_settings_overview(self):
        """Load the system settings overview (default)
        
        This requires to initialize all settings modules.
        """
        # 1. load all python modules
        self.load_python_modules()

        # 2. sort the modules alphabetically according to the current locale
        localeStrKey = cmp_to_key(locale.strcoll)
        # Apply locale key to the field name of each side page.
        sidePagesKey = lambda m: localeStrKey(m[0].name)
        self.sidePages = sorted(self.sidePages, key=sidePagesKey)

        # 3. create the backing stores for the side nav-view.
        for sidepage in self.sidePages:
            sp, sp_id, sp_cat = sidepage
            if sidepage.cat not in self.store_by_cat:
                self.store_by_cat[sidepage.cat] = Gtk.ListStore(str, str, object, str) # Label, Icon, sidePage, Category
                for category in CATEGORIES:
                    if category["id"] == sidepage.cat:
                        category["show"] = True

            # Don't allow item names (and their translations) to be more than 30 chars long. It looks ugly and it creates huge gaps in the icon views
            name = sp.name
            if len(name) > 30:
                name = "%s..." % name[:30]
            self.store_by_cat[sp_cat].append([name, sp.icon, sp, sp_cat])

        self.min_label_length = 0
        self.min_pix_length = 0

        for cat in self.store_by_cat:
            char, pix = self.get_label_min_width(self.store_by_cat[cat])
            self.min_label_length = max(char, self.min_label_length)
            self.min_pix_length = max(pix, self.min_pix_length)
            self.storeFilter[cat] = self.store_by_cat[cat].filter_new()
            self.storeFilter[cat].set_visible_func(self.filter_visible_function)

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

        self.search_entry.grab_focus()
        self.window.connect("key-press-event", self.on_keypress)
        self.window.connect("button-press-event", self.on_buttonpress)

        self.window.show()

    def load_sidepage_as_standalone(self) -> bool:
        """
        When an explicit sidepage is given as an argument,
        try load only this module to save much startup time.

        Analyses arguments to know the tab to open
        and the sort to apply if the tab is the 'more' one.

        Examples:
        ```
          cinnamon-settings.py applets --tab=more --sort=date
          cinnamon-settings.py applets --tab=1 --sort=2
          cinnamon-settings.py applets --tab=more --sort=date
          cinnamon-settings.py applets --tab=1 -s 2
          cinnamon-settings.py applets -t 1 -s installed
          cinnamon-settings.py desklets -t 2
        ```
        Please note that useless or wrong arguments are ignored.

        :return: True if sidepage was loaded successfully, False otherwise
        """
        if sys.argv == 1:
            return False

        # (1) get the settings sidepage name and rewrite it if necessary
        sidepage_name = ARG_REWRITE.get(sys.argv[1], sys.argv[1])
        # pop the arg once we consume it so we don't pass it go Gio.application.run
        sys.argv.pop(1)

        # (2) Try to load a matching python module.
        # Note: the requested module could also be a CCC or SA module (which are always loaded by __init__())
        self.load_python_modules(only_module=sidepage_name)

        # (3) set tab to show and/or spices sorting if specified via args
        if len(sys.argv) > 1:
            opts = []
            sorts_literal = {"name":0, "score":1, "date":2, "installed":3, "update":4}
            tabs_literal = TABS.get(sidepage_name, {"default": 0})

            try:
                opts = getopt.getopt(sys.argv[1:], "t:s:", ["tab=", "sort="])[0]
            except getopt.GetoptError:
                pass  # ignore unknown args

            for opt, arg in opts:
                if opt in ("-t", "--tab"):
                    if arg.isdecimal():
                        self.tab = int(arg)
                    elif arg in tabs_literal.keys():
                        self.tab = tabs_literal[arg]
                if opt in ("-s", "--sort"):
                    if arg.isdecimal():
                        self.sort = int(arg)
                    elif arg in sorts_literal.keys():
                        self.sort = sorts_literal[arg]
                # remove the args we consume
                sys.argv.remove(opt)
                sys.argv.remove(arg)

        # (4) set the WM class so GWL can consider it as a standalone app and give it its own group.
        wm_class = f"cinnamon-settings {sidepage_name}"
        self.window.set_wmclass(wm_class, wm_class)
        self.button_back.hide()

        # (5) find and show it
        for sp_data in self.sidePages:
            if sp_data.name == sidepage_name:
                self.go_to_sidepage(sp_data.sp, user_action=False)
                if sp_data.sp.is_standalone:
                    # These modules do not need to leave the System Settings window open,
                    # when selected by command line argument.
                    self.window.close()
                else:
                    self.window.show()
                return True
        print(f"warning: settings module {sidepage_name} not found.")
        return False

    def load_ccc_modules(self):
        """Loads all Cinnamon Control Center settings modules."""
        for item in CONTROL_CENTER_MODULES:
            ccmodule = SettingsWidgets.CCModule(item[0], item[1], item[2], item[3], item[4], self.content_box)
            if ccmodule.process(self.c_manager):
                self.sidePages.append(SidePageData(ccmodule.sidePage, ccmodule.name, ccmodule.category))
            else:
                print("warning: failed to process CCC module", item[1])

    def load_standalone_modules(self):
        """Loads all standalone settings modules."""
        for item in STANDALONE_MODULES:
            samodule = SettingsWidgets.SAModule(item[0], item[1], item[2], item[3], item[4], self.content_box)
            if samodule.process():
                self.sidePages.append(SidePageData(samodule.sidePage, samodule.name, samodule.category))
            # else:
            #    print(f"note: skipped standalone module {samodule.name} (not found in PATH).")

    def load_python_modules(self, only_module: str = None) -> bool:
        """Loads all or only a given settings module(s) written in python.

        :param only_module: (optional) module name to be loaded exclusively
        :return: True if successful, False otherwise
        """
        # Standard setting pages... this can be expanded to include applet dirs maybe?
        mod_files = glob.glob(os.path.join(config.currentPath, 'modules', 'cs_*.py'))
        if len(mod_files) == 0:
            print("warning: no python settings modules found!!", file=sys.stderr)
            return False

        to_import = [os.path.splitext(os.path.basename(x))[0] for x in mod_files]
        
        if only_module is not None:
            to_import = filter(lambda mod: only_module.replace("-", "_") in mod, to_import)

        for module in map(__import__, to_import):
            try:
                mod = module.Module(self.content_box)
                if self.loadCheck(mod) and self.setParentRefs(mod):
                    self.sidePages.append(SidePageData(mod.sidePage, mod.name, mod.category))
            except:
                print(f"failed to load python module {module}", file=sys.stderr)
                traceback.print_exc()
        return True

    # If there are no arguments, do_active() is called, otherwise do_open().
    def do_activate(self):
        self.hold()

    def do_open(self, files, n_files, hint):
        self.hold()

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

    def strip_accents(self, text):
        text = unicodedata.normalize('NFKD', text)
        return ''.join([c for c in text if not unicodedata.combining(c)])

    def filter_visible_function(self, model, iter, user_data = None):
        sidePage = model.get_value(iter, 2)
        text = self.strip_accents(self.search_entry.get_text().lower())
        if self.strip_accents(sidePage.name.lower()).find(text) > -1 or \
           self.strip_accents(sidePage.keywords.lower()).find(text) > -1:
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
        while iter is not None:
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

        widget = Gtk.Label(yalign=0.5)
        widget.set_use_markup(True)
        widget.set_markup('<span size="12000">%s</span>' % category["label"])
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
        text_renderer = Gtk.CellRendererText(ellipsize=Pango.EllipsizeMode.NONE, wrap_mode=Pango.WrapMode.WORD_CHAR, wrap_width=0, width_chars=self.min_label_length, alignment=Pango.Alignment.CENTER, xalign=0.5)

        area.pack_start(pixbuf_renderer, True, True, False)
        area.pack_start(text_renderer, True, True, False)
        area.add_attribute(pixbuf_renderer, "icon-name", 1)
        pixbuf_renderer.set_property("stock-size", Gtk.IconSize.DIALOG)
        pixbuf_renderer.set_property("follow-state", True)

        area.add_attribute(text_renderer, "text", 0)

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

            final_y = rect.y + cw_y + iv_y

            adj = self.side_view_sw.get_vadjustment()
            page = adj.get_page_size()
            current_pos = adj.get_value()

            if (final_y > 0) and ((final_y + rect.height) < page):
                return

            if (final_y + rect.height) > page:
                adj.set_value(current_pos + final_y + rect.height - page + 10)
            elif final_y < 0:
                # We can just add a negative here (since final_y < 0), but it's less
                # confusing to be explicit that we're decreasing current_pos.
                adj.set_value(current_pos - abs(final_y) - 10)

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
        self.window.set_icon_name("preferences-desktop")
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

        if self.current_sidepage.module and hasattr(self.current_sidepage.module, "on_navigate_out_of_module"):
            self.current_sidepage.module.on_navigate_out_of_module()

        self.current_sidepage = None

    def _quit(self, *args):
        self.window.destroy()
        self.quit()

if __name__ == "__main__":
    setproctitle("cinnamon-settings")
    import signal

    ps = proxygsettings.get_proxy_settings()
    if ps:
        proxy = urllib.ProxyHandler(ps)
    else:
        proxy = urllib.ProxyHandler()
    urllib.install_opener(urllib.build_opener(proxy))

    window = MainWindow()
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    window.run(sys.argv)
