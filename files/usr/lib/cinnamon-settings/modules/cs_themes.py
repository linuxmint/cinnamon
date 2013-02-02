#!/usr/bin/env python

from SettingsWidgets import *
from gi.repository import Gio, Gtk, GObject, Gdk
import dbus
import os
import os.path

home = os.path.expanduser("~")

THUMB_SIZE = 88

class Module:
    def __init__(self, content_box):
         keywords = _("themes, style")
         advanced = False
         sidePage = ThemeViewSidePage(_("Themes"), "themes.svg", keywords, advanced, content_box)
         self.sidePage = sidePage
         self.name = "themes"
         self.category = "appear"

class ThemeViewSidePage (SidePage):
    def __init__(self, name, icon, keywords, advanced, content_box):
        SidePage.__init__(self, name, icon, keywords, advanced, content_box)
        self.icons = []
                  
    def build(self, advanced):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        
        # Find the current theme name
        self.settings = Gio.Settings.new("org.cinnamon.theme")
        self.current_theme = self.settings.get_string("name")
        
        # Add our own widgets
        notebook = Gtk.Notebook()
        
        cinnamon_theme_vbox = Gtk.VBox()
        
        scrolledWindow = Gtk.ScrolledWindow()
        cinnamon_theme_vbox.pack_start(scrolledWindow, True, True, 2)
        
        iconView = Gtk.IconView()    
        iconView.set_item_padding(2)  
        iconView.set_row_spacing(0)
        self.model = Gtk.ListStore(str, GdkPixbuf.Pixbuf)
                 
        img = GdkPixbuf.Pixbuf.new_from_file_at_size( "/usr/share/cinnamon/theme/thumbnail.png", THUMB_SIZE, THUMB_SIZE)

        self.active_theme_iter = self.model.append(["Cinnamon", img])
                     
        self.load_themes_in('/usr/share/themes')
        self.load_themes_in('%s/.themes' % home)
        
        iconView.set_text_column(0)
        iconView.set_pixbuf_column(1)
        iconView.set_model(self.model)    
        if (self.active_theme_iter is not None):
            iconView.select_path(self.model.get_path(self.active_theme_iter))
        iconView.connect("selection_changed", self.apply_theme )
        scrolledWindow.add(iconView)
        scrolledWindow.set_shadow_type(Gtk.ShadowType.IN)
        link = Gtk.LinkButton("http://cinnamon-spices.linuxmint.com/themes")
        link.set_label(_("Get new themes"))    
        cinnamon_theme_vbox.pack_start(link, False, False, 2)
        
        notebook.append_page(cinnamon_theme_vbox, Gtk.Label(_("Cinnamon themes")))
        
        scrolledWindow = Gtk.ScrolledWindow()
        other_settings_box = Gtk.VBox()
        scrolledWindow.add_with_viewport(other_settings_box)
        other_settings_box.set_border_width(5)
        
        gtkThemeSwitcher = GSettingsComboBox(_("Controls"), "org.gnome.desktop.interface", "gtk-theme", None, self._load_gtk_themes())
        other_settings_box.pack_start(gtkThemeSwitcher, False, False, 2)
        
        iconThemeSwitcher = GSettingsComboBox(_("Icons"), "org.gnome.desktop.interface", "icon-theme", None, self._load_icon_themes())
        other_settings_box.pack_start(iconThemeSwitcher, False, False, 2)            
        
        windowThemeSwitcher = GSettingsComboBox(_("Window borders"), "org.gnome.desktop.wm.preferences", "theme", None, self._load_window_themes())
        other_settings_box.pack_start(windowThemeSwitcher, False, False, 2)
                
        cursorThemeSwitcher = GSettingsComboBox(_("Mouse pointer"), "org.gnome.desktop.interface", "cursor-theme", None, self._load_cursor_themes())
        other_settings_box.pack_start(cursorThemeSwitcher, False, False, 2)
        
        keybindingThemeSwitcher = GSettingsComboBox(_("Keybindings"), "org.gnome.desktop.interface", "gtk-key-theme", None, self._load_keybinding_themes())
        other_settings_box.pack_start(keybindingThemeSwitcher, False, False, 2)            
        
        menusHaveIconsCB = GSettingsCheckButton(_("Show icons in menus"), "org.gnome.desktop.interface", "menus-have-icons", None)
        other_settings_box.pack_start(menusHaveIconsCB, False, False, 2)
        
        buttonsHaveIconsCB = GSettingsCheckButton(_("Show icons on buttons"), "org.gnome.desktop.interface", "buttons-have-icons", None)
        other_settings_box.pack_start(buttonsHaveIconsCB, False, False, 2)
        
        notebook.append_page(scrolledWindow, Gtk.Label(_("Other settings")))
                    
        self.content_box.add(notebook)
        self.content_box.show_all()
        
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
    
    def load_themes_in(self, directory):
        if os.path.exists(directory) and os.path.isdir(directory):
            themes = os.listdir(directory)
            themes.sort()
            for theme in themes:
                try:
                    if os.path.exists("%s/%s/cinnamon/cinnamon.css" % (directory, theme)):
                        if os.path.exists("%s/%s/cinnamon/thumbnail.png" % (directory, theme)):
                            img = GdkPixbuf.Pixbuf.new_from_file_at_size( "%s/%s/cinnamon/thumbnail.png" % (directory, theme), THUMB_SIZE, THUMB_SIZE )
                        else:
                            img = GdkPixbuf.Pixbuf.new_from_file_at_size( "/usr/share/cinnamon/theme/thumbnail-generic.png", THUMB_SIZE, THUMB_SIZE )
                        theme_iter = self.model.append([theme, img])
                        if theme==self.current_theme:
                            self.active_theme_iter = theme_iter
                except Exception, detail:
                    print detail
        
    def apply_theme(self, iconView):
        selected_items = iconView.get_selected_items()
        if len(selected_items) > 0:
            path = selected_items[0]                  
            iterator = self.model.get_iter(path)
            theme_name = self.model.get_value(iterator, 0)
            if theme_name == "Cinnamon":
                theme_name = ""            
            self.settings.set_string("name", theme_name)
