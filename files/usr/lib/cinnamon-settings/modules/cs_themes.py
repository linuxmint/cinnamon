#!/usr/bin/env python

from ExtensionCore import ExtensionSidePage
from gi.repository import Gtk
from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("themes, style")
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

    def getAdditionalPage(self):
        scrolledWindow = Gtk.ScrolledWindow()
        scrolledWindow.label = Gtk.Label(_("Other settings"))

        other_settings_box = Gtk.VBox()
        scrolledWindow.add_with_viewport(other_settings_box)
        other_settings_box.set_border_width(5)
        
        gtkThemeSwitcher = GSettingsComboBox(_("Controls"), "org.cinnamon.desktop.interface", "gtk-theme", None, self._load_gtk_themes())
        other_settings_box.pack_start(gtkThemeSwitcher, False, False, 2)
        
        iconThemeSwitcher = GSettingsComboBox(_("Icons"), "org.cinnamon.desktop.interface", "icon-theme", None, self._load_icon_themes())
        other_settings_box.pack_start(iconThemeSwitcher, False, False, 2)            
        
        windowThemeSwitcher = GSettingsComboBox(_("Window borders"), "org.cinnamon.desktop.wm.preferences", "theme", None, self._load_window_themes())
        other_settings_box.pack_start(windowThemeSwitcher, False, False, 2)
                
        cursorThemeSwitcher = GSettingsComboBox(_("Mouse pointer"), "org.cinnamon.desktop.interface", "cursor-theme", None, self._load_cursor_themes())
        other_settings_box.pack_start(cursorThemeSwitcher, False, False, 2)
        
        keybindingThemeSwitcher = GSettingsComboBox(_("Keybindings"), "org.cinnamon.desktop.interface", "gtk-key-theme", None, self._load_keybinding_themes())
        other_settings_box.pack_start(keybindingThemeSwitcher, False, False, 2)            

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
        valid = walk_directories(dirs, lambda d: os.path.isdir(d) and not os.path.exists(os.path.join(d, "cursors")))
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

