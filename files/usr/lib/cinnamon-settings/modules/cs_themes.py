#!/usr/bin/env python

from ExtensionCore import ExtensionSidePage
from gi.repository.Gtk import SizeGroup, SizeGroupMode
from SettingsWidgets import *

PICTURE_SIZE = 32

class Module:
    def __init__(self, content_box):
        keywords = _("themes, style")
        self.comment = _("Manage themes to change how your desktop looks")
        self.name = "themes"
        # for i18n replacement in ExtensionCore.py
        noun = _("theme")
        pl_noun = _("themes")
        # We do not translate Cinnamon
        target = "Cinnamon"
        sidePage = ThemesViewSidePage(_("Themes"), "cs-themes", keywords, content_box, "theme", noun, pl_noun, target, self)
        self.sidePage = sidePage
        self.category = "appear"

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Themes module"
            self.sidePage.load()

    def _setParentRef(self, window, builder):
        self.sidePage.window = window
        self.sidePage.builder = builder


class ThemesViewSidePage (ExtensionSidePage):

    def __init__(self, name, icon, keywords, content_box, collection_type, noun, pl_noun, target, module):
        self.RemoveString = ""
        ExtensionSidePage.__init__(self, name, icon, keywords, content_box, collection_type, noun, pl_noun, target, module)

    def toSettingString(self, uuid, instanceId):
        return uuid

    def fromSettingString(self, string):
        return string

    def make_group(self, group_label, widget):
        self.size_groups = getattr(self, "size_groups", [Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL) for x in range(2)])        
        box = IndentedHBox()
        label = Gtk.Label()
        label.set_markup(group_label)
        label.props.xalign = 0.0
        self.size_groups[0].add_widget(label)
        box.pack_start(label, False, False, 0)        
        self.size_groups[1].add_widget(widget)
        box.pack_start(widget, False, False, 15)        
        return box

    def getAdditionalPage(self):
                        
        self.settings = Gio.Settings.new("org.cinnamon.desktop.interface")

        self.icon_chooser = PictureChooserButton(num_cols=4, picture_size=PICTURE_SIZE)
        self.icon_chooser.set_tooltip_text(self.settings.get_string('icon-theme'))
        
        current_theme = Gtk.IconTheme.get_default()
        folder = current_theme.lookup_icon("folder", PICTURE_SIZE, 0)
        path = folder.get_filename()
        self.icon_chooser.set_picture_from_file(path)

        themes = self._load_icon_themes()
        for theme in themes:            
            icon_theme = Gtk.IconTheme()
            icon_theme.set_custom_theme(theme)
            folder = icon_theme.lookup_icon("folder", PICTURE_SIZE, Gtk.IconLookupFlags.FORCE_SVG)
            path = folder.get_filename()
            self.icon_chooser.add_picture(path, self._on_icon_theme_selected, title=theme, id=theme)

            
        scrolledWindow = Gtk.ScrolledWindow()
        scrolledWindow.label = Gtk.Label.new(_("Other settings"))      

        bg = SectionBg()        
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        bg.add(vbox)
        
        section = Section(_("Themes"))        
        section.add(self.make_group(_("Controls"), GSettingsComboBox("", "org.cinnamon.desktop.interface", "gtk-theme", None, self._load_gtk_themes())))
        section.add(self.make_group(_("Icons"), self.icon_chooser))
        section.add(self.make_group(_("Window borders"), GSettingsComboBox("", "org.cinnamon.desktop.wm.preferences", "theme", None, self._load_window_themes())))
        section.add(self.make_group(_("Mouse Pointer"), GSettingsComboBox("", "org.cinnamon.desktop.interface", "cursor-theme", None, self._load_cursor_themes())))
        section.add(self.make_group(_("Keybindings"), GSettingsComboBox("", "org.cinnamon.desktop.interface", "gtk-key-theme", None, self._load_keybinding_themes())))
        vbox.add(section)

        vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

        section = Section(_("Options"))
        section.add(GSettingsCheckButton(_("Show icons in menus"), "org.cinnamon.settings-daemon.plugins.xsettings", "menus-have-icons", None))
        section.add(GSettingsCheckButton(_("Show icons on buttons"), "org.cinnamon.settings-daemon.plugins.xsettings", "buttons-have-icons", None))
        vbox.add(section)

        scrolledWindow.add_with_viewport(bg)                                

        return scrolledWindow

    def _on_icon_theme_selected(self, path, theme):
        # Update the icon theme
        try:
            self.settings.set_string("icon-theme", theme)
            self.icon_chooser.set_tooltip_text(theme)
        except Exception, detail:
            print detail
        
        return True


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
            res.append(i)
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

