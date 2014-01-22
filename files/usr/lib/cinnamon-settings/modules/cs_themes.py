#!/usr/bin/env python

from ExtensionCore import ExtensionSidePage
from gi.repository.Gtk import SizeGroup, SizeGroupMode
from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("themes, style")
        self.comment = _("Manage themes to change how your desktop looks")
        advanced = False
        self.name = "themes"
        # for i18n replacement in ExtensionCore.py
        noun = _("theme")
        pl_noun = _("themes")
        # We do not translate Cinnamon
        target = "Cinnamon"
        sidePage = ThemesViewSidePage(_("Themes"), "themes.svg", keywords, advanced, content_box, "theme", noun, pl_noun, target)
        self.sidePage = sidePage

        self.category = "appear"

    def _setParentRef(self, window, builder):
        self.sidePage.window = window
        self.sidePage.builder = builder

class ThemesViewSidePage (ExtensionSidePage):

    def __init__(self, name, icon, keywords, advanced, content_box, collection_type, noun, pl_noun, target):
        self.RemoveString = ""
        ExtensionSidePage.__init__(self, name, icon, keywords, advanced, content_box, collection_type, noun, pl_noun, target)

    def toSettingString(self, uuid, instanceId):
        return uuid

    def fromSettingString(self, string):
        return string
        
    def _make_group(self, group_label, root, key, schema):
        self.size_groups = getattr(self, "size_groups", [SizeGroup(SizeGroupMode.HORIZONTAL) for x in range(2)])
        
        box = Gtk.HBox()
        label = Gtk.Label()
        label.set_markup(group_label)
        label.props.xalign = 0.0
        self.size_groups[0].add_widget(label)
        box.pack_start(label, False, False, 4)

        w = GSettingsComboBox("", root, key, None, schema)
        self.size_groups[1].add_widget(w)
        box.add(w)
        
        return box

    def getAdditionalPage(self):
        scrolledWindow = Gtk.ScrolledWindow()
        scrolledWindow.label = Gtk.Label(_("Other settings"))

        other_settings_box = Gtk.VBox()
        
        scrolledWindow.add_with_viewport(other_settings_box)
        
        other_settings_box.pack_start(self._make_group(_("Controls"), "org.cinnamon.desktop.interface", "gtk-theme", self._load_gtk_themes()), False, False, 2)
        other_settings_box.pack_start(self._make_group(_("Icons"), "org.cinnamon.desktop.interface", "icon-theme", self._load_icon_themes()), False, False, 2)
        other_settings_box.pack_start(self._make_group(_("Window borders"), "org.cinnamon.desktop.wm.preferences", "theme", self._load_window_themes()), False, False, 2)
        other_settings_box.pack_start(self._make_group(_("Mouse Pointer"), "org.cinnamon.desktop.interface", "cursor-theme", self._load_cursor_themes()), False, False, 2)
        other_settings_box.pack_start(self._make_group(_("Keybindings"), "org.cinnamon.desktop.interface", "gtk-key-theme", self._load_keybinding_themes()), False, False, 2)

        menusHaveIconsCB = GSettingsCheckButton(_("Show icons in menus"), "org.cinnamon.settings-daemon.plugins.xsettings", "menus-have-icons", None)
        other_settings_box.pack_start(menusHaveIconsCB, False, False, 2)

        buttonsHaveIconsCB = GSettingsCheckButton(_("Show icons on buttons"), "org.cinnamon.settings-daemon.plugins.xsettings", "buttons-have-icons", None)
        other_settings_box.pack_start(buttonsHaveIconsCB, False, False, 2)

        return scrolledWindow

    def _load_gtk_themes(self):
        """ Only shows themes that have variations for gtk+-3 and gtk+-2 """
        dirs = ("/usr/share/themes", os.path.join(os.path.expanduser("~"), ".themes"))
        valid = walk_directories(dirs, lambda d: os.path.exists(os.path.join(d, "gtk-2.0")) and os.path.exists(os.path.join(d, "gtk-3.0")))
        valid.sort(lambda a,b: cmp(a.lower(), b.lower()))
        res = []
        for i in valid:
            res.append((i, i))
        return res
    
    def _load_icon_themes(self):
        dirs = ("/usr/share/icons", os.path.join(os.path.expanduser("~"), ".icons"))
        valid = walk_directories(dirs, lambda d: os.path.isdir(d) and not os.path.exists(os.path.join(d, "cursors")) and os.path.exists(os.path.join(d, "index.theme")))
        valid.sort(lambda a,b: cmp(a.lower(), b.lower()))
        res = []
        for i in valid:
            res.append((i, i))
        return res
        
    def _load_keybinding_themes(self):
        dirs = ("/usr/share/themes", os.path.join(os.path.expanduser("~"), ".themes"))
        valid = walk_directories(dirs, lambda d: os.path.isfile(os.path.join(d, "gtk-3.0", "gtk-keys.css")) and os.path.isfile(os.path.join(d, "gtk-2.0-key", "gtkrc")))
        valid.sort(lambda a,b: cmp(a.lower(), b.lower()))
        res = []
        for i in valid:
            res.append((i, i))
        return res
        
    def _load_cursor_themes(self):
        dirs = ("/usr/share/icons", os.path.join(os.path.expanduser("~"), ".icons"))
        valid = walk_directories(dirs, lambda d: os.path.isdir(d) and os.path.exists(os.path.join(d, "cursors")))
        valid.sort(lambda a,b: cmp(a.lower(), b.lower()))
        res = []
        for i in valid:
            res.append((i, i))
        return res
        
    def _load_window_themes(self):
        dirs = ("/usr/share/themes", os.path.join(os.path.expanduser("~"), ".themes"))
        valid = walk_directories(dirs, lambda d: os.path.exists(os.path.join(d, "metacity-1")))
        valid.sort(lambda a,b: cmp(a.lower(), b.lower()))
        res = []
        for i in valid:
            res.append((i, i))
        return res

