#!/usr/bin/env python

from ExtensionCore import ExtensionSidePage
from gi.repository.Gtk import SizeGroup, SizeGroupMode
from SettingsWidgets import *

ICON_SIZE = 48

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
         
    def create_button_chooser(self, settings, key, path_prefix, path_suffix, themes, callback, button_picture_size, menu_pictures_size, num_cols):        
        chooser = PictureChooserButton(num_cols=num_cols, button_picture_size=button_picture_size, menu_pictures_size=menu_pictures_size)
        theme = settings.get_string(key)
        chooser.set_tooltip_text(theme)
        if path_suffix == "cinnamon" and theme == "cinnamon":
            chooser.set_picture_from_file("/usr/share/cinnamon/theme/thumbnail.png")
        else:
            for path in ["/usr/share/%s/%s/%s/thumbnail.png" % (path_prefix, theme, path_suffix), 
                         os.path.expanduser("~/.%s/%s/%s/thumbnail.png" % (path_prefix, theme, path_suffix)), 
                         "/usr/share/cinnamon/thumbnails/%s/%s.png" % (path_suffix, theme), 
                         "/usr/share/cinnamon/thumbnails/%s/unknown.png" % path_suffix]:                        
                if os.path.exists(path):
                    chooser.set_picture_from_file(path)
                    break    
        if path_suffix == "cinnamon":
            chooser.add_picture("/usr/share/cinnamon/theme/thumbnail.png", callback, title="cinnamon", id="cinnamon")
        for theme in themes:
            theme_name = theme[0]
            theme_path = theme[1]
            for path in ["%s/%s/%s/thumbnail.png" % (theme_path, theme_name, path_suffix), 
                         "/usr/share/cinnamon/thumbnails/%s/%s.png" % (path_suffix, theme_name), 
                         "/usr/share/cinnamon/thumbnails/%s/unknown.png" % path_suffix]:
                if os.path.exists(path):                    
                    chooser.add_picture(path, callback, title=theme_name, id=theme_name)
                    break
        return chooser

    def getAdditionalPage(self):
                        
        self.settings = Gio.Settings.new("org.cinnamon.desktop.interface")
        self.wm_settings = Gio.Settings.new("org.cinnamon.desktop.wm.preferences")
        self.cinnamon_settings = Gio.Settings.new("org.cinnamon.theme")

        # Icon chooser
        self.icon_chooser = PictureChooserButton(num_cols=4, button_picture_size=ICON_SIZE)
        self.icon_chooser.set_tooltip_text(self.settings.get_string('icon-theme'))        
        current_theme = Gtk.IconTheme.get_default()
        folder = current_theme.lookup_icon("folder", ICON_SIZE, 0)
        path = folder.get_filename()
        self.icon_chooser.set_picture_from_file(path)
        themes = self._load_icon_themes()
        for theme in themes:            
            icon_theme = Gtk.IconTheme()
            icon_theme.set_custom_theme(theme)
            folder = icon_theme.lookup_icon("folder", ICON_SIZE, Gtk.IconLookupFlags.FORCE_SVG)
            path = folder.get_filename()
            self.icon_chooser.add_picture(path, self._on_icon_theme_selected, title=theme, id=theme)

        self.cursor_chooser = self.create_button_chooser(self.settings, 'cursor-theme', 'icons', 'cursors', self._load_cursor_themes(), self._on_cursor_theme_selected, button_picture_size=32, menu_pictures_size=32, num_cols=4)
        self.theme_chooser = self.create_button_chooser(self.settings, 'gtk-theme', 'themes', 'gtk-3.0', self._load_gtk_themes(), self._on_gtk_theme_selected, button_picture_size=35, menu_pictures_size=120, num_cols=3)
        self.metacity_chooser = self.create_button_chooser(self.wm_settings, 'theme', 'themes', 'metacity-1', self._load_metacity_themes(), self._on_metacity_theme_selected, button_picture_size=32, menu_pictures_size=100, num_cols=3)
        self.cinnamon_chooser = self.create_button_chooser(self.cinnamon_settings, 'name', 'themes', 'cinnamon', self._load_cinnamon_themes(), self._on_cinnamon_theme_selected, button_picture_size=60, menu_pictures_size=100, num_cols=3)

        scrolledWindow = Gtk.ScrolledWindow()
        scrolledWindow.label = Gtk.Label.new(_("Other settings")) 

        bg = SectionBg()        
        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        bg.add(vbox)
        
        section = Section(_("Themes"))        
        section.add(self.make_group(_("Controls"), self.theme_chooser))
        section.add(self.make_group(_("Icons"), self.icon_chooser))
        section.add(self.make_group(_("Window borders"), self.metacity_chooser))
        section.add(self.make_group(_("Mouse Pointer"), self.cursor_chooser))
        section.add(self.make_group(_("Desktop"), self.cinnamon_chooser))
        vbox.add(section)

        vbox.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

        section = Section(_("Options"))
        section.add(GSettingsCheckButton(_("Show icons in menus"), "org.cinnamon.settings-daemon.plugins.xsettings", "menus-have-icons", None))
        section.add(GSettingsCheckButton(_("Show icons on buttons"), "org.cinnamon.settings-daemon.plugins.xsettings", "buttons-have-icons", None))
        vbox.add(section)

        scrolledWindow.add_with_viewport(bg)                                

        return scrolledWindow

    def _on_icon_theme_selected(self, path, theme):
        try:
            self.settings.set_string("icon-theme", theme)
            self.icon_chooser.set_tooltip_text(theme)
        except Exception, detail:
            print detail      
        return True

    def _on_metacity_theme_selected(self, path, theme):
        try:
            self.wm_settings.set_string("theme", theme)
            self.metacity_chooser.set_tooltip_text(theme)
        except Exception, detail:
            print detail        
        return True

    def _on_gtk_theme_selected(self, path, theme):
        try:
            self.settings.set_string("gtk-theme", theme)
            self.theme_chooser.set_tooltip_text(theme)
        except Exception, detail:
            print detail        
        return True

    def _on_cursor_theme_selected(self, path, theme):
        try:
            self.settings.set_string("cursor-theme", theme)
            self.cursor_chooser.set_tooltip_text(theme)
        except Exception, detail:
            print detail        
        return True

    def _on_cinnamon_theme_selected(self, path, theme):
        try:
            self.cinnamon_settings.set_string("name", theme)
            self.cinnamon_chooser.set_tooltip_text(theme)
        except Exception, detail:
            print detail      
        return True

    def _load_gtk_themes(self):
        """ Only shows themes that have variations for gtk+-3 and gtk+-2 """
        dirs = ("/usr/share/themes", os.path.join(os.path.expanduser("~"), ".themes"))
        valid = walk_directories(dirs, lambda d: os.path.exists(os.path.join(d, "gtk-2.0")) and os.path.exists(os.path.join(d, "gtk-3.0")), return_directories=True)
        valid.sort(lambda a,b: cmp(a[0].lower(), b[0].lower()))
        res = []
        for i in valid:
            res.append((i[0], i[1]))
        return res
    
    def _load_icon_themes(self):
        dirs = ("/usr/share/icons", os.path.join(os.path.expanduser("~"), ".icons"))
        valid = walk_directories(dirs, lambda d: os.path.isdir(d) and not os.path.exists(os.path.join(d, "cursors")) and os.path.exists(os.path.join(d, "index.theme")))
        valid.sort(lambda a,b: cmp(a.lower(), b.lower()))
        res = []
        for i in valid:
            res.append(i)
        return res
        
    def _load_cursor_themes(self):
        dirs = ("/usr/share/icons", os.path.join(os.path.expanduser("~"), ".icons"))
        valid = walk_directories(dirs, lambda d: os.path.isdir(d) and os.path.exists(os.path.join(d, "cursors")), return_directories=True)
        valid.sort(lambda a,b: cmp(a[0].lower(), b[0].lower()))
        res = []
        for i in valid:
            res.append((i[0], i[1]))
        return res
        
    def _load_metacity_themes(self):
        dirs = ("/usr/share/themes", os.path.join(os.path.expanduser("~"), ".themes"))
        valid = walk_directories(dirs, lambda d: os.path.exists(os.path.join(d, "metacity-1")), return_directories=True)
        valid.sort(lambda a,b: cmp(a[0].lower(), b[0].lower()))
        res = []
        for i in valid:
            res.append((i[0], i[1]))
        return res

    def _load_cinnamon_themes(self):
        dirs = ("/usr/share/themes", os.path.join(os.path.expanduser("~"), ".themes"))
        valid = walk_directories(dirs, lambda d: os.path.exists(os.path.join(d, "cinnamon")), return_directories=True)
        valid.sort(lambda a,b: cmp(a[0].lower(), b[0].lower()))
        res = []        
        for i in valid:
            res.append((i[0], i[1]))
        return res
