#!/usr/bin/env python

try:
    import os
    import commands
    import sys
    import string    
    import gettext
    from gi.repository import Gio, Gtk, GObject
    from gi.repository import GdkPixbuf 
    import gconf
    import json
    import dbus
    import tz
    import time
    from datetime import datetime
    from user import home
    import thread
except Exception, detail:
    print detail
    sys.exit(1)


# i18n
gettext.install("cinnamon", "/usr/share/cinnamon/locale")

# i18n for menu item
menuName = _("Desktop Settings")
menuGenericName = _("Desktop Configuration Tool")
menuComment = _("Fine-tune desktop settings")
                                  
class SidePage:
    def __init__(self, name, icon, content_box):        
        self.name = name
        self.icon = icon
        self.content_box = content_box
        self.widgets = []
        
    def add_widget(self, widget):
        self.widgets.append(widget)
        
    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        
        # Add our own widgets
        for widget in self.widgets:
            self.content_box.pack_start(widget, False, False, 2)            
        self.content_box.show_all()

class GConfComboBox(Gtk.HBox):    
    def __init__(self, label, key, options, init_value = ""):  
        self.key = key
        super(GConfComboBox, self).__init__()
        self.settings = gconf.client_get_default()  
        self.value = self.settings.get_string(self.key)
        if not self.value:
            self.value = init_value
                      
        self.label = Gtk.Label(label)       
        self.model = Gtk.ListStore(str, str)
        selected = None
        for option in options:
            iter = self.model.insert_before(None, None)
            self.model.set_value(iter, 0, option[0])                
            self.model.set_value(iter, 1, option[1])                        
            if (option[0] == self.value):
                selected = iter
                                
        self.content_widget = Gtk.ComboBox.new_with_model(self.model)   
        renderer_text = Gtk.CellRendererText()
        self.content_widget.pack_start(renderer_text, True)
        self.content_widget.add_attribute(renderer_text, "text", 1)     
        
        if selected is not None:
            self.content_widget.set_active_iter(selected)
        
        if (label != ""):
            self.pack_start(self.label, False, False, 2)                
        self.pack_start(self.content_widget, False, False, 2)                     
        self.content_widget.connect('changed', self.on_my_value_changed)
        # The on_my_setting_changed callback raises a segmentation fault, need to investigate that
        #self.settings.add_dir(os.path.split(key)[0], gconf.CLIENT_PRELOAD_NONE)
        #self.settings.notify_add(self.key, self.on_my_setting_changed)
        self.content_widget.show_all()
        
    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:            
            value = self.model[tree_iter][0]            
            self.settings.set_string(self.key, value)
    def on_my_setting_changed(self, client, cnxn_id, entry, args):
        print entry

def walk_directories(dirs, filter_func):
    valid = []
    try:
        for thdir in dirs:
            if os.path.isdir(thdir):
                for t in os.listdir(thdir):
                    if filter_func(os.path.join(thdir, t)):
                         valid.append(t)
    except:
        pass
        #logging.critical("Error parsing directories", exc_info=True)
    return valid

class ThemeViewSidePage (SidePage):
    def __init__(self, name, icon, content_box):   
        SidePage.__init__(self, name, icon, content_box)        
        self.icons = []
                  
    def build(self):
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
        iconView.set_columns(4)
        iconView.set_item_padding(2)  
        iconView.set_row_spacing(2)
        self.model = Gtk.ListStore(str, GdkPixbuf.Pixbuf)
                 
        img = GdkPixbuf.Pixbuf.new_from_file_at_size( "/usr/share/cinnamon/theme/thumbnail.png", 64, 64 )

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
        
        windowThemeSwitcher = GConfComboBox(_("Window theme"), "/desktop/cinnamon/windows/theme", self._load_window_themes(), "Adwaita")
        other_settings_box.pack_start(windowThemeSwitcher, False, False, 2)
        menusHaveIconsCB = GSettingsCheckButton(_("Menus Have Icons"), "org.gnome.desktop.interface", "menus-have-icons")
        other_settings_box.pack_start(menusHaveIconsCB, False, False, 2)
        buttonsHaveIconsCB = GSettingsCheckButton(_("Buttons Have Icons"), "org.gnome.desktop.interface", "buttons-have-icons")
        other_settings_box.pack_start(buttonsHaveIconsCB, False, False, 2)
        alwaysUseLocationEntryCB = GSettingsCheckButton(_("Always Use Location Entry"), "org.gnome.nautilus.preferences", "always-use-location-entry")
        other_settings_box.pack_start(alwaysUseLocationEntryCB, False, False, 2)
        cursorThemeSwitcher = GSettingsComboBox(_("Cursor theme"), "org.gnome.desktop.interface", "cursor-theme", self._load_cursor_themes())
        other_settings_box.pack_start(cursorThemeSwitcher, False, False, 2)
        keybindingThemeSwitcher = GSettingsComboBox(_("Keybinding theme"), "org.gnome.desktop.interface", "gtk-key-theme", self._load_keybinding_themes())
        other_settings_box.pack_start(keybindingThemeSwitcher, False, False, 2)
        iconThemeSwitcher = GSettingsComboBox(_("Icon theme"), "org.gnome.desktop.interface", "icon-theme", self._load_icon_themes())
        other_settings_box.pack_start(iconThemeSwitcher, False, False, 2)
        gtkThemeSwitcher = GSettingsComboBox(_("GTK+ theme"), "org.gnome.desktop.interface", "gtk-theme", self._load_gtk_themes())
        other_settings_box.pack_start(gtkThemeSwitcher, False, False, 2)
        
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
                            img = GdkPixbuf.Pixbuf.new_from_file_at_size( "%s/%s/cinnamon/thumbnail.png" % (directory, theme), 64, 64 )
                        else:
                            img = GdkPixbuf.Pixbuf.new_from_file_at_size( "/usr/share/cinnamon/theme/thumbnail-generic.png", 64, 64 )
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
            
class ExtensionViewSidePage (SidePage):
    def __init__(self, name, icon, content_box):   
        SidePage.__init__(self, name, icon, content_box)        
        self.icons = []
                  
    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        
        scrolledWindow = Gtk.ScrolledWindow()    
        treeview = Gtk.TreeView()
                
        cr = Gtk.CellRendererToggle()
        cr.connect("toggled", self.toggled, treeview)
        column1 = Gtk.TreeViewColumn(_("Enable"), cr)
        column1.set_cell_data_func(cr, self.celldatafunction_checkbox)
        column1.set_resizable(True)

        column2 = Gtk.TreeViewColumn(_("Description"), Gtk.CellRendererText(), markup=1)
        column2.set_resizable(True)
        
        treeview.append_column(column1)
        treeview.append_column(column2)
        treeview.set_headers_visible(False)
            
        self.model = Gtk.TreeStore(str, str, bool)        
        self.model.set_sort_column_id( 1, Gtk.SortType.ASCENDING )
        treeview.set_model(self.model)
                                
        # Find the enabled extensions
        self.settings = Gio.Settings.new("org.cinnamon")
        self.enabled_extensions = self.settings.get_strv("enabled-extensions")
                         
        self.load_extensions_in('/usr/share/cinnamon/extensions')                                                                          
        self.load_extensions_in('%s/.local/share/cinnamon/extensions' % home)
        
        scrolledWindow.add(treeview)    
        
        scrolledWindow.set_shadow_type(Gtk.ShadowType.IN)
        link = Gtk.LinkButton("http://cinnamon-spices.linuxmint.com/extensions")
        link.set_label(_("Get new extensions"))                
        self.content_box.add(scrolledWindow)
        self.content_box.pack_start(link, False, False, 2) 
                                                        
        self.content_box.show_all()   
        
    def load_extensions_in(self, directory):
        if os.path.exists(directory) and os.path.isdir(directory):
            extensions = os.listdir(directory)
            extensions.sort()
            for extension in extensions:            
                if os.path.exists("%s/%s/metadata.json" % (directory, extension)):
                    json_data=open("%s/%s/metadata.json" % (directory, extension)).read()
                    data = json.loads(json_data)  
                    extension_uuid = data["uuid"]
                    extension_name = data["name"]                
                    extension_description = data["description"]
                    iter = self.model.insert_before(None, None)
                    self.model.set_value(iter, 0, extension_uuid)         
                    self.model.set_value(iter, 1, '<b>%s</b>\n<b><span foreground="#333333" size="xx-small">%s</span></b>\n<i><span foreground="#555555" size="x-small">%s</span></i>' % (extension_name, extension_uuid, extension_description))
                    self.model.set_value(iter, 2, (extension_uuid in self.enabled_extensions))
        
    def toggled(self, renderer, path, treeview):        
        iter = self.model.get_iter(path)
        if (iter != None):
            uuid = self.model.get_value(iter, 0)
            checked = self.model.get_value(iter, 2)
            if (checked):
                self.model.set_value(iter, 2, False)
                self.enabled_extensions.remove(uuid)
            else:
                self.model.set_value(iter, 2, True) 
                self.enabled_extensions.append(uuid)
            
            self.settings.set_strv("enabled-extensions", self.enabled_extensions)
                
    def celldatafunction_checkbox(self, column, cell, model, iter, data=None):
        cell.set_property("activatable", True)
        checked = model.get_value(iter, 2)
        if (checked):
            cell.set_property("active", True)
        else:
            cell.set_property("active", False)
            
class AppletViewSidePage (SidePage):
    def __init__(self, name, icon, content_box):   
        SidePage.__init__(self, name, icon, content_box)        
        self.icons = []
        
        self.search_entry = Gtk.Entry()
        self.search_entry.connect('changed', lambda y: self.model.clear() 
                                  or self.load_applets_in('/usr/share/cinnamon/applets') 
                                  or self.load_applets_in('%s/.local/share/cinnamon/applets' % home) )
                  
    def build(self):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)
        
        scrolledWindow = Gtk.ScrolledWindow()    
        treeview = Gtk.TreeView()
                
        cr = Gtk.CellRendererToggle()
        cr.connect("toggled", self.toggled, treeview)
        column1 = Gtk.TreeViewColumn(_("Enable"), cr)
        column1.set_cell_data_func(cr, self.celldatafunction_checkbox)        
        column1.set_resizable(True)

        column2 = Gtk.TreeViewColumn(_("Icon"), Gtk.CellRendererPixbuf(), pixbuf=3)        
        column2.set_resizable(True)

        column3 = Gtk.TreeViewColumn(_("Description"), Gtk.CellRendererText(), markup=1)        
        column3.set_resizable(True)      
        
        treeview.append_column(column1)
        treeview.append_column(column2)
        treeview.append_column(column3)        
        treeview.set_headers_visible(False)        
            
        self.model = Gtk.TreeStore(str, str, bool, GdkPixbuf.Pixbuf)
        #                          uuid, name, enabled, icon        
        self.model.set_sort_column_id(1, Gtk.SortType.ASCENDING)
        treeview.set_model(self.model)
                                
        # Find the enabled applets
        self.settings = Gio.Settings.new("org.cinnamon")
        self.enabled_applets = self.settings.get_strv("enabled-applets")
                         
        self.load_applets_in('/usr/share/cinnamon/applets')                                                                          
        self.load_applets_in('%s/.local/share/cinnamon/applets' % home)
        
        scrolledWindow.add(treeview)                                                     
        scrolledWindow.set_shadow_type(Gtk.ShadowType.IN)
        
        button = Gtk.Button(_("Restore to default"))       
        button.connect("clicked", lambda x: self._restore_default_applets())
        
        link = Gtk.LinkButton("http://cinnamon-spices.linuxmint.com/applets")
        link.set_label(_("Get new applets"))                
                         
        self.content_box.pack_start(self.search_entry, False, False, 2)
        self.content_box.add(scrolledWindow)        
        self.content_box.pack_start(button, False, False, 2) 
        self.content_box.pack_start(link, False, False, 2) 
        
        self.content_box.show_all()   
    
    def _restore_default_applets(self):
        os.system('gsettings reset org.cinnamon enabled-applets')
        self.enabled_applets = self.settings.get_strv("enabled-applets")
        
        self.model.clear()
                         
        self.load_applets_in('/usr/share/cinnamon/applets')                                                                          
        self.load_applets_in('%s/.local/share/cinnamon/applets' % home)
        
    def load_applets_in(self, directory):
        if os.path.exists(directory) and os.path.isdir(directory):
            applets = os.listdir(directory)
            applets.sort()
            for applet in applets:
                try:           
                    if os.path.exists("%s/%s/metadata.json" % (directory, applet)):
                        json_data=open("%s/%s/metadata.json" % (directory, applet)).read()
                        data = json.loads(json_data)  
                        applet_uuid = data["uuid"]
                        applet_name = data["name"]                                        
                        applet_description = data["description"]                                                                    
                        
                        if self.search_entry.get_text().upper() in (applet_name + applet_description).upper():
                            iter = self.model.insert_before(None, None)
                            found = False
                            for enabled_applet in self.enabled_applets:
                                if applet_uuid in enabled_applet:
                                    found = True                            
                                    break       
                        
                            self.model.set_value(iter, 0, applet_uuid)                
                            self.model.set_value(iter, 1, '<b>%s</b>\n<b><span foreground="#333333" size="xx-small">%s</span></b>\n<i><span foreground="#555555" size="x-small">%s</span></i>' % (applet_name, applet_uuid, applet_description))                                  
                            self.model.set_value(iter, 2, found)                            
                            img = None                            
                            if "icon" in data:
                                applet_icon = data["icon"]
                                theme = Gtk.IconTheme.get_default()                                                    
                                if theme.has_icon(applet_icon):
                                    img = theme.load_icon(applet_icon, 32, 0)
                            elif os.path.exists("%s/%s/icon.png" % (directory, applet)):
                                img = GdkPixbuf.Pixbuf.new_from_file_at_size("%s/%s/icon.png" % (directory, applet), 32, 32)                            
                            
                            if img is None:                                                
                                img = GdkPixbuf.Pixbuf.new_from_file_at_size( "/usr/lib/cinnamon-settings/data/icons/applets.svg", 32, 32)
                                
                            self.model.set_value(iter, 3, img)                
                except Exception, detail:
                    print "Failed to load applet %s: %s" % (applet, detail)
        
    def toggled(self, renderer, path, treeview):        
        iter = self.model.get_iter(path)
        if (iter != None):
            uuid = self.model.get_value(iter, 0)
            checked = self.model.get_value(iter, 2)
            if (checked):
                self.model.set_value(iter, 2, False)
                for enabled_applet in self.enabled_applets:
                    if uuid in enabled_applet:
                        self.enabled_applets.remove(enabled_applet)
            else:
                self.model.set_value(iter, 2, True) 
                self.enabled_applets.append("panel1:right:0:%s" % uuid)
            
            self.settings.set_strv("enabled-applets", self.enabled_applets)
                
    def celldatafunction_checkbox(self, column, cell, model, iter, data=None):
        cell.set_property("activatable", True)
        checked = model.get_value(iter, 2)
        if (checked):
            cell.set_property("active", True)
        else:
            cell.set_property("active", False)

class GConfCheckButton(Gtk.CheckButton):    
    def __init__(self, label, key):        
        self.key = key
        super(GConfCheckButton, self).__init__(label)       
        self.settings = gconf.client_get_default()
        self.set_active(self.settings.get_bool(self.key))
        self.settings.notify_add(self.key, self.on_my_setting_changed)
        self.connect('toggled', self.on_my_value_changed)            
    
    def on_my_setting_changed(self, client, cnxn_id, entry):
        value = entry.value.get_bool()
        self.set_active(value)
        
    def on_my_value_changed(self, widget):
        self.settings.set_bool(self.key, self.get_active())

            
class GSettingsCheckButton(Gtk.CheckButton):    
    def __init__(self, label, schema, key):        
        self.key = key
        super(GSettingsCheckButton, self).__init__(label)
        self.settings = Gio.Settings.new(schema)        
        self.set_active(self.settings.get_boolean(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.connect('toggled', self.on_my_value_changed)            
    
    def on_my_setting_changed(self, settings, key):
        self.set_active(self.settings.get_boolean(self.key))
        
    def on_my_value_changed(self, widget):
        self.settings.set_boolean(self.key, self.get_active())
        
class DBusCheckButton(Gtk.CheckButton):    
    def __init__(self, label, service, path, get_method, set_method):        
        super(DBusCheckButton, self).__init__(label)     
        proxy = dbus.SystemBus().get_object(service, path)
        self.dbus_iface = dbus.Interface(proxy, dbus_interface=service)
        self.dbus_get_method = get_method
        self.dbus_set_method = set_method
        self.set_active(getattr(self.dbus_iface, get_method)()[1])
        self.connect('toggled', self.on_my_value_changed)
        
    def on_my_value_changed(self, widget):
        getattr(self.dbus_iface, self.dbus_set_method)(self.get_active())
        
class GSettingsSpinButton(Gtk.HBox):    
    def __init__(self, label, schema, key, min, max, step, page, units):        
        self.key = key
        super(GSettingsSpinButton, self).__init__()        
        self.label = Gtk.Label(label)       
        self.content_widget = Gtk.SpinButton()
        self.units = Gtk.Label(units)        
        if (label != ""):       
            self.pack_start(self.label, False, False, 2)                
        self.pack_start(self.content_widget, False, False, 2)              
        if (units != ""):
            self.pack_start(self.units, False, False, 2)              
        
        self.content_widget.set_range(min, max)
        self.content_widget.set_increments(step, page)
        #self.content_widget.set_editable(False)
        
        self.settings = Gio.Settings.new(schema)        
        self.content_widget.set_value(self.settings.get_int(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.content_widget.connect('focus-out-event', self.on_my_value_changed)
    
    def on_my_setting_changed(self, settings, key):
        self.content_widget.set_value(self.settings.get_int(self.key))
        
    def on_my_value_changed(self, widget, data):
        print self.content_widget.get_value()
        self.settings.set_int(self.key, self.content_widget.get_value())

class GSettingsEntry(Gtk.HBox):    
    def __init__(self, label, schema, key):        
        self.key = key
        super(GSettingsEntry, self).__init__()
        self.label = Gtk.Label(label)       
        self.content_widget = Gtk.Entry()
        self.pack_start(self.label, False, False, 5)        
        self.add(self.content_widget)     
        self.settings = Gio.Settings.new(schema)        
        self.content_widget.set_text(self.settings.get_string(self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.content_widget.connect('changed', self.on_my_value_changed)     
        
        self.content_widget.show_all()       
    
    def on_my_setting_changed(self, settings, key):
        self.content_widget.set_text(self.settings.get_string(self.key))
        
    def on_my_value_changed(self, widget):        
        self.settings.set_string(self.key, self.content_widget.get_text())

class GSettingsFileChooser(Gtk.HBox):
    def __init__(self, label, schema, key, show_none_cb = False):        
        self.key = key
        super(GSettingsFileChooser, self).__init__()
        self.label = Gtk.Label(label)       
        self.content_widget = Gtk.FileChooserButton()
        self.pack_start(self.label, False, False, 2)
        self.add(self.content_widget)
        self.settings = Gio.Settings.new(schema)
        value = self.settings.get_string(self.key)     
        if show_none_cb:
            self.show_none_cb = Gtk.CheckButton(_("None"))
            self.show_none_cb.set_active(value=="")
            self.pack_start(self.show_none_cb, False, False, 5)
        else:
            self.show_none_cb = None
        if value=="":
            self.content_widget.set_sensitive(False)
        else:
            self.content_widget.set_filename(value)
        self.content_widget.connect('file-set', self.on_my_value_changed)
        self.show_none_cb.connect('toggled', self.on_my_value_changed)
        
        self.content_widget.show_all()
    def on_my_value_changed(self, widget):
        if self.show_none_cb.get_active():
            value = ""
            self.content_widget.set_sensitive(False)
        else:
            value = self.content_widget.get_filename()
            if value==None:
                value = ""
            self.content_widget.set_sensitive(True)
        self.settings.set_string(self.key, value)

class GSettingsFontButton(Gtk.HBox):
    def __init__(self, label, schema, key):
        self.key = key
        super(GSettingsFontButton, self).__init__()
        self.settings = Gio.Settings.new(schema)
        self.value = self.settings.get_string(key)
        
        self.label = Gtk.Label(label)

        self.content_widget = Gtk.FontButton()
        self.content_widget.set_font_name(self.value)
        
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, False, False, 2)
        self.content_widget.connect('font-set', self.on_my_value_changed)
        self.content_widget.show_all()
    def on_my_value_changed(self, widget):
        self.settings.set_string(self.key, widget.get_font_name())

class GConfFontButton(Gtk.HBox):
    def __init__(self, label, key):
        self.key = key
        super(GConfFontButton, self).__init__()
        self.settings = gconf.client_get_default()
        self.value = self.settings.get_string(key)
        
        self.label = Gtk.Label(label)

        self.content_widget = Gtk.FontButton()
        self.content_widget.set_font_name(self.value)
        
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, False, False, 2)
        self.content_widget.connect('font-set', self.on_my_value_changed)
        self.content_widget.show_all()
    def on_my_value_changed(self, widget):
        self.settings.set_string(self.key, widget.get_font_name())

class GSettingsRange(Gtk.HBox):
    def __init__(self, label, schema, key, **options):
        self.key = key
        super(GSettingsRange, self).__init__()
        self.settings = Gio.Settings.new(schema)
        self.value = self.settings.get_double(self.key)
        
        self.label = Gtk.Label(label)

        #returned variant is range:(min, max)
        _min, _max = self.settings.get_range(self.key)[1]

        self.content_widget = Gtk.HScale.new_with_range(_min, _max, options.get('adjustment_step', 1))
        self.content_widget.set_value(self.value)
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, True, True, 2)
        self.content_widget.connect('value-changed', self.on_my_value_changed)
        self.content_widget.show_all()
    def on_my_value_changed(self, widget):
        self.settings.set_double(self.key, widget.get_value())

class GSettingsRangeSpin(Gtk.HBox):
    def __init__(self, label, schema, key, **options):
        self.key = key
        super(GSettingsRangeSpin, self).__init__()
        self.label = Gtk.Label(label)
        self.content_widget = Gtk.SpinButton()

        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, False, False, 2)

        self.settings = Gio.Settings.new(schema)

        _min, _max = self.settings.get_range(self.key)[1]
        _increment = options.get('adjustment_step', 1)

        self.content_widget.set_range(_min, _max)
        self.content_widget.set_increments(_increment, _increment)
        #self.content_widget.set_editable(False)
        self.content_widget.set_digits(1)
        self.content_widget.set_value(self.settings.get_double(self.key))

        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.content_widget.connect('value-changed', self.on_my_value_changed)

    def on_my_setting_changed(self, settings, key):
        self.content_widget.set_value(self.settings.get_double(self.key))

    def on_my_value_changed(self, widget):
        self.settings.set_double(self.key, self.content_widget.get_value())

class GSettingsComboBox(Gtk.HBox):    
    def __init__(self, label, schema, key, options):        
        self.key = key
        super(GSettingsComboBox, self).__init__()
        self.settings = Gio.Settings.new(schema)        
        self.value = self.settings.get_string(self.key)
                      
        self.label = Gtk.Label(label)       
        self.model = Gtk.ListStore(str, str)
        selected = None
        for option in options:
            iter = self.model.insert_before(None, None)
            self.model.set_value(iter, 0, option[0])                
            self.model.set_value(iter, 1, option[1])                        
            if (option[0] == self.value):
                selected = iter
                                
        self.content_widget = Gtk.ComboBox.new_with_model(self.model)   
        renderer_text = Gtk.CellRendererText()
        self.content_widget.pack_start(renderer_text, True)
        self.content_widget.add_attribute(renderer_text, "text", 1)     
        
        if selected is not None:
            self.content_widget.set_active_iter(selected)
        
        if (label != ""):
            self.pack_start(self.label, False, False, 2)                
        self.pack_start(self.content_widget, False, False, 2)                     
        self.content_widget.connect('changed', self.on_my_value_changed)
        self.content_widget.show_all()
                            
        
    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:            
            value = self.model[tree_iter][0]            
            self.settings.set_string(self.key, value)                       

class TimeZoneSelectorWidget(Gtk.HBox):
    def __init__(self):
        super(TimeZoneSelectorWidget, self).__init__()
        
        proxy = dbus.SystemBus().get_object("org.gnome.SettingsDaemon.DateTimeMechanism", "/")
        self.dbus_iface = dbus.Interface(proxy, dbus_interface="org.gnome.SettingsDaemon.DateTimeMechanism")
        
        self.timezones = tz.load_db()
        
        self.selected_region, self.selected_city = self.get_selected_zone()
        
        region_label = Gtk.Label(_("Region"))
        self.pack_start(region_label, False, False, 2)
        
        regions = self.timezones.keys()
        regions.sort()
        self.region_model = Gtk.ListStore(str, str)
        selected_region_iter = None
        for region in regions:
            iter = self.region_model.insert_before(None, None)
            self.region_model.set_value(iter, 0, region)                
            self.region_model.set_value(iter, 1, region.replace("_", " "))                        
            if (region == self.selected_region):
                selected_region_iter = iter
                                
        self.region_widget = Gtk.ComboBox.new_with_model(self.region_model)   
        renderer_text = Gtk.CellRendererText()
        self.region_widget.pack_start(renderer_text, True)
        self.region_widget.add_attribute(renderer_text, "text", 1)
        if selected_region_iter is not None:
            self.region_widget.set_active_iter(selected_region_iter)
        self.pack_start(self.region_widget, False, False, 2)
        
        city_label = Gtk.Label(_("City"))
        self.pack_start(city_label, False, False, 2)
        
        self.city_model = Gtk.ListStore(str, str)
        self.city_widget = Gtk.ComboBox.new_with_model(self.city_model)   
        renderer_text = Gtk.CellRendererText()
        self.city_widget.pack_start(renderer_text, True)
        self.city_widget.add_attribute(renderer_text, "text", 1)
        self.pack_start(self.city_widget, False, False, 2)
        
        self.update_cities_list()
        
        self.region_widget.connect("changed", self.on_region_changed)
        self.city_widget.connect("changed", self.on_city_changed)
    def on_city_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            self.selected_city = self.city_model[tree_iter][0]
            self.dbus_iface.SetTimezone(self.selected_region+"/"+self.selected_city)
    def on_region_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:            
            self.selected_region = self.region_model[tree_iter][0]
            self.update_cities_list()
    def update_cities_list(self):
        self.city_model.clear()
        if self.selected_region and self.selected_region in self.timezones.keys():
            cities = self.timezones[self.selected_region]
            cities.sort()
            selected_city_iter = None
            for city in cities:
                iter = self.city_model.insert_before(None, None)
                self.city_model.set_value(iter, 0, city)                
                self.city_model.set_value(iter, 1, city.replace("_", " "))                        
                if (city == self.selected_city):
                    selected_city_iter = iter
            if selected_city_iter is not None:
                self.city_widget.set_active_iter(selected_city_iter)
    def get_selected_zone(self):
        tz = self.dbus_iface.GetTimezone()
        if "/" in tz:
            i = tz.index("/")
            region = tz[:i]
            city = tz[i+1:]
            return region, city
        else:
            return "", ""
            
class ChangeTimeWidget(Gtk.HBox):
    def __init__(self):
        super(ChangeTimeWidget, self).__init__()
        proxy = dbus.SystemBus().get_object("org.gnome.SettingsDaemon.DateTimeMechanism", "/")
        self.dbus_iface = dbus.Interface(proxy, dbus_interface="org.gnome.SettingsDaemon.DateTimeMechanism")
        
        # Ensures we are setting the system time only when the user changes it
        self.changedOnTimeout = False
        
        # Ensures we do not update the values in the date/time fields during the DBus call to set the time
        self._setting_time = False
        self._setting_time_lock = thread.allocate()
        self._time_to_set = None
        
        self.thirtyDays = [3, 5, 8, 10]
        months = ['January','February','March','April','May','June','July','August','September','October','November','December']
        
        # Boxes
        timeBox = Gtk.HBox()
        dateBox = Gtk.HBox()
        
        # Combo Boxes
        self.monthBox = Gtk.ComboBoxText()
        
        for month in months:
            self.monthBox.append_text(month)
        
        # Adjustments
        hourAdj = Gtk.Adjustment(0, 0, 23, 1, 1)
        minAdj = Gtk.Adjustment(0, 0, 59, 1, 1)
        yearAdj = Gtk.Adjustment(0, 0, 9999, 1, 5)
        dayAdj = Gtk.Adjustment(0, 1, 31, 1, 1)
        
        # Spin buttons
        self.hourSpin = Gtk.SpinButton()
        self.minSpin = Gtk.SpinButton()
        self.yearSpin = Gtk.SpinButton()
        self.daySpin = Gtk.SpinButton()
        
        self.hourSpin.configure(hourAdj, 0.5, 0)
        self.minSpin.configure(minAdj, 0.5, 0)
        self.yearSpin.configure(yearAdj, 0.5, 0)
        self.daySpin.configure(dayAdj, 0.5, 0)
        #self.hourSpin.set_editable(False)
        #self.minSpin.set_editable(False)
        #self.yearSpin.set_editable(False)
        #self.daySpin.set_editable(False)
        
        self.update_time()
        GObject.timeout_add(1000, self.update_time)
        
        # Connect to callback
        self.hourSpin.connect('changed', self._change_system_time)
        self.minSpin.connect('changed', self._change_system_time)
        self.monthBox.connect('changed', self._change_system_time)
        self.yearSpin.connect('changed', self._change_system_time)
        self.daySpin.connect('changed', self._change_system_time)
        
        timeBox.pack_start(self.hourSpin, False, False, 2)
        timeBox.pack_start(Gtk.Label(_(":")), False, False, 2)
        timeBox.pack_start(self.minSpin, False, False, 2)
        
        dateBox.pack_start(self.monthBox, False, False, 2)
        dateBox.pack_start(self.daySpin, False, False, 2)
        dateBox.pack_start(self.yearSpin, False, False, 2)
        
        self.pack_start(Gtk.Label(_("Date : ")), False, False, 2)
        self.pack_start(dateBox, True, True, 2)
        self.pack_start(Gtk.Label(_("Time : ")), False, False, 2)
        self.pack_start(timeBox, True, True, 2)
        
    def update_time(self):
        self._setting_time_lock.acquire()
        do_update = not self._setting_time
        self._setting_time_lock.release()
        
        if not do_update:
            return True
        
        dt = datetime.now()
        
        self.changedOnTimeout = True
        
        # Time
        self.hourSpin.set_value( dt.hour )
        self.minSpin.set_value( dt.minute )
        
        # Date
        self.monthBox.set_active( dt.month-1 )
        self.daySpin.set_value( dt.day )
        self.yearSpin.set_value( dt.year )
        
        self.changedOnTimeout = False
        
        # Update the max of the day spin box
        maxDay = 31
        if dt.month == 2:
            if dt.year % 4 == 0:
                maxDay = 29
            else:
                maxDay = 28
        elif dt.month-1 in self.thirtyDays:
            maxDay = 30
            
        self.daySpin.get_adjustment().set_upper(maxDay)
        
        return True
        
    def change_using_ntp(self, usingNtp):
        # Check if we were using Ntp by seeing if the spin button
        # is sensitive
        self.set_sensitive(not usingNtp)
    
    def _do_change_system_time(self):
        self._setting_time_lock.acquire()
        do_set = not self._setting_time
        self._setting_time = True
        self._setting_time_lock.release()
        
        # If there is already another thread updating the time, we let it do the job
        if not do_set:
            return
        
        done = False
        while not done:
            self._setting_time_lock.acquire()
            time_to_set = self._time_to_set
            self._time_to_set = None
            self._setting_time_lock.release()
            
            self.dbus_iface.SetTime(time_to_set)
            
            # Check whether another request to set the time was done since this thread started
            self._setting_time_lock.acquire()
            if self._time_to_set==None:
                done = True
            self._setting_time_lock.release()
        
        self._setting_time_lock.acquire()
        self._setting_time = False
        self._setting_time_lock.release()
                
    def _change_system_time(self, widget):
        if not self.changedOnTimeout:
            hour = int( self.hourSpin.get_value() )
            minute = int( self.minSpin.get_value() )
            month = self.monthBox.get_active() + 1
            day = int( self.daySpin.get_value() )
            year = int( self.yearSpin.get_value() )
            
            newDt = datetime(year, month, day, hour, minute)
            
            self._setting_time_lock.acquire()
            self._time_to_set = time.mktime(newDt.utctimetuple())
            self._setting_time_lock.release()
            
            thread.start_new_thread(self._do_change_system_time, ())

class TitleBarButtonsOrderSelector(Gtk.Table):
    def __init__(self):
        self.key = "/desktop/cinnamon/windows/button_layout"
        super(TitleBarButtonsOrderSelector, self).__init__()
        self.settings = gconf.client_get_default()
        self.value = self.settings.get_string(self.key)
        try:
            left_items, right_items = self.value.split(":")
        except:
            left_items = right_items = ""
        if len(left_items) > 0:
            left_items = left_items.split(",")
        else:
            left_items = []
        if len(right_items) > 0:
            right_items = right_items.split(",")
        else:
            right_items = []
        
        label = Gtk.Label(_("Left side title bar buttons"))
        label.set_alignment(0, 0.5)
        self.attach(label, 0, 1, 0, 1, xoptions = Gtk.AttachOptions.FILL, yoptions=0, xpadding=2)
        left_side_box = Gtk.HBox()
        self.attach(left_side_box, 1, 2, 0, 1, yoptions=0, xpadding=2)
        
        label = Gtk.Label(_("Right side title bar buttons"))
        label.set_alignment(0, 0.5)
        self.attach(label, 0, 1, 1, 2, xoptions = Gtk.AttachOptions.FILL, yoptions=0, xpadding=2)
        right_side_box = Gtk.HBox()
        self.attach(right_side_box, 1, 2, 1, 2, yoptions=0, xpadding=2)
        
        self.left_side_widgets = []
        self.right_side_widgets = []
        for i in range(3):
            self.left_side_widgets.append(Gtk.ComboBox())
            self.right_side_widgets.append(Gtk.ComboBox())
        
        buttons = [
            ("", ""),
            ("close", _("Close")),
            ("minimize", _("Minimize")),
            ("maximize", _("Maximize"))
        ]
        
        for i in self.left_side_widgets + self.right_side_widgets:
            if i in self.left_side_widgets:
                ref_list = left_items
                index = self.left_side_widgets.index(i)
            else:
                ref_list = right_items
                index = self.right_side_widgets.index(i)
            model = Gtk.ListStore(str, str)
            selected_iter = None
            for button in buttons:
                iter = model.insert_before(None, None)
                model.set_value(iter, 0, button[0])                
                model.set_value(iter, 1, button[1])
                if index < len(ref_list) and ref_list[index] == button[0]:
                    selected_iter = iter
            i.set_model(model)
            renderer_text = Gtk.CellRendererText()
            i.pack_start(renderer_text, True)
            i.add_attribute(renderer_text, "text", 1)
            i.connect("changed", self.on_my_value_changed)
            if selected_iter is not None:
                i.set_active_iter(selected_iter)
        
        for i in self.left_side_widgets:
            left_side_box.pack_start(i, False, False, 2)
        for i in self.right_side_widgets:
            right_side_box.pack_start(i, False, False, 2)
    
    def on_my_value_changed(self, widget):
        active_iter = widget.get_active_iter()
        if active_iter:
            new_value = widget.get_model()[active_iter][0]
        else:
            new_value = None
        left_items = []
        right_items = []
        for i in self.left_side_widgets + self.right_side_widgets:
            active_iter = i.get_active_iter()
            if active_iter:
                value = i.get_model()[i.get_active_iter()][0]
                if i != widget and value == new_value:
                    i.set_active_iter(None)
                elif value != "":
                    if i in self.left_side_widgets:
                        left_items.append(value)
                    else:
                        right_items.append(value)
        self.settings.set_string(self.key, ','.join(str(item) for item in left_items) + ':' + ','.join(str(item) for item in right_items))
        
class MainWindow:
  
    # Change pages
    def side_view_nav(self, side_view):
        selected_items = side_view.get_selected_items()
        if len(selected_items) > 0:
            self.side_view_sw.hide()
            path = selected_items[0]            
            iterator = self.store.get_iter(path)
            sidePage = self.store.get_value(iterator,2)
            self.window.set_title(_("Cinnamon Settings") + " - " + sidePage.name)
            sidePage.build()
            self.content_box_sw.show_all()
            self.top_button_box.show_all()
            
    ''' Create the UI '''
    def __init__(self):        
        
        self.builder = Gtk.Builder()
        self.builder.add_from_file("/usr/lib/cinnamon-settings/cinnamon-settings.ui")
        self.window = self.builder.get_object("main_window")
        self.side_view = self.builder.get_object("side_view")
        self.side_view_sw = self.builder.get_object("side_view_sw")
        self.content_box = self.builder.get_object("content_box")
        self.content_box_sw = self.builder.get_object("content_box_sw")
        self.button_cancel = self.builder.get_object("button_cancel")
        self.button_back = self.builder.get_object("button_back")
        self.button_back.set_label(_("All Settings"))
        self.top_button_box = self.builder.get_object("top_button_box")
        
        self.window.connect("destroy", Gtk.main_quit)

        self.sidePages = []
                               
        sidePage = SidePage(_("Menu"), "menu.svg", self.content_box)
        self.sidePages.append((sidePage, "menu"))
        sidePage.add_widget(GSettingsEntry(_("Menu text"), "org.cinnamon", "menu-text")) 
        sidePage.add_widget(GSettingsFileChooser(_("Menu icon"), "org.cinnamon", "menu-icon", True))
        sidePage.add_widget(GSettingsSpinButton(_("Menu hover delay"), "org.cinnamon", "menu-hover-delay", 0, 2000, 50, 200, _("milliseconds")))                        
        sidePage.add_widget(GSettingsCheckButton(_("Activate menu on hover"), "org.cinnamon", "activate-menu-applet-on-hover"))                        
                                                      
        sidePage = SidePage(_("Panel"), "panel.svg", self.content_box)
        self.sidePages.append((sidePage, "panel"))                
        sidePage.add_widget(GSettingsCheckButton(_("Auto-hide panel"), "org.cinnamon", "panel-autohide"))
        desktop_layouts = [["traditional", _("Traditional (panel at the bottom)")], ["flipped", _("Flipped (panel at the top)")], ["classic", _("Classic (panels at the top and at the bottom)")]]        
        desktop_layouts_combo = GSettingsComboBox(_("Panel layout"), "org.cinnamon", "desktop-layout", desktop_layouts)
        sidePage.add_widget(desktop_layouts_combo) 
        label = Gtk.Label()
        label.set_markup("<i><small>%s</small></i>" % _("Note: If you change the layout you will need to restart Cinnamon."))
        sidePage.add_widget(label)
        sidePage.add_widget(GSettingsCheckButton(_("Use customized panel size (otherwise it's defined by the theme)"), "org.cinnamon", "panel-resizable"))
        sidePage.add_widget(GSettingsSpinButton(_("Panel size"), "org.cinnamon", "panel-size", 0, 2000, 1, 5, _("Pixels")))
        sidePage.add_widget(GSettingsCheckButton(_("Panel edit mode"), "org.cinnamon", "panel-edit-mode"))
        sidePage.add_widget(GSettingsCheckButton(_("Panel Launchers draggable"), "org.cinnamon", "panel-launchers-draggable"))       
        
        sidePage = SidePage(_("Calendar"), "clock.svg", self.content_box)
        self.sidePages.append((sidePage, "calendar"))
        self.changeTimeWidget = ChangeTimeWidget()     
        sidePage.add_widget(GSettingsCheckButton(_("Show week dates in calendar"), "org.cinnamon.calendar", "show-weekdate"))         
        sidePage.add_widget(GSettingsEntry(_("Date format for the panel"), "org.cinnamon.calendar", "date-format"))                                 
        sidePage.add_widget(GSettingsEntry(_("Date format inside the date applet"), "org.cinnamon.calendar", "date-format-full"))                                 
        sidePage.add_widget(Gtk.LinkButton.new_with_label("http://www.foragoodstrftime.com/", _("Generate your own date formats")))
        self.ntpCheckButton = None 
        try:
            self.ntpCheckButton = DBusCheckButton(_("Use network time"), "org.gnome.SettingsDaemon.DateTimeMechanism", "/", "GetUsingNtp", "SetUsingNtp")
            sidePage.add_widget(self.ntpCheckButton)
        except:
            pass
        sidePage.add_widget(self.changeTimeWidget)
        try:
            sidePage.add_widget(TimeZoneSelectorWidget())
        except:
            pass
        
        if self.ntpCheckButton != None:
            self.ntpCheckButton.connect('toggled', self._ntp_toggled)
            self.changeTimeWidget.change_using_ntp( self.ntpCheckButton.get_active() )
        
        sidePage = SidePage(_("Hot corner"), "overview.svg", self.content_box)
        self.sidePages.append((sidePage, "hotcorner"))
        sidePage.add_widget(GSettingsCheckButton(_("Hot corner icon visible"), "org.cinnamon", "overview-corner-visible")) 
        sidePage.add_widget(GSettingsCheckButton(_("Hot corner enabled"), "org.cinnamon", "overview-corner-hover")) 
        box = Gtk.HBox()        
        label = Gtk.Label()
        label.set_markup("%s" % _("Hot corner position:"))
        box.pack_start(label, False, False, 0)         
        positions = [["topLeft", _("Top left")], ["topRight", _("Top right")], ["bottomLeft", _("Bottom left")], ["bottomRight", _("Bottom right")]]        
        combo = GSettingsComboBox("", "org.cinnamon", "overview-corner-position", positions)        
        box.pack_start(combo, False, False, 0)               
        sidePage.add_widget(box)
        
        box = Gtk.HBox()        
        label = Gtk.Label()
        label.set_markup("%s" % _("Hot corner function:"))
        box.pack_start(label, False, False, 0)         
        cornerfunctions = [["expo", _("Workspace selection (ala Compiz Expo)")], ["scale", _("Window selection (ala Compiz Scale)")]]     
        combo = GSettingsComboBox("", "org.cinnamon", "overview-corner-functionality", cornerfunctions)        
        box.pack_start(combo, False, False, 0)               
        sidePage.add_widget(box)
        
        sidePage.add_widget(GSettingsCheckButton(_("Expo applet: activate on hover"), "org.cinnamon", "expo-applet-hover"))
        sidePage.add_widget(GSettingsCheckButton(_("Scale applet: activate on hover"), "org.cinnamon", "scale-applet-hover"))

        sidePage = ThemeViewSidePage(_("Themes"), "themes.svg", self.content_box)
        self.sidePages.append((sidePage, "themes"))
        
        sidePage = SidePage(_("Effects"), "desktop-effects.svg", self.content_box)
        self.sidePages.append((sidePage, "effects"))
        sidePage.add_widget(GSettingsCheckButton(_("Enable desktop effects"), "org.cinnamon", "desktop-effects"))
        sidePage.add_widget(GSettingsCheckButton(_("Enable desktop effects on dialog boxes"), "org.cinnamon", "desktop-effects-on-dialogs"))
        
        # Destroy window effects
        transition_effects = []
        transition_effects.append(["easeInQuad", "easeInQuad"])
        transition_effects.append(["easeOutQuad", "easeOutQuad"])
        transition_effects.append(["easeInOutQuad", "easeInOutQuad"])        
        transition_effects.append(["easeInCubic", "easeInCubic"])
        transition_effects.append(["easeOutCubic", "easeOutCubic"])
        transition_effects.append(["easeInOutCubic", "easeInOutCubic"])        
        transition_effects.append(["easeInQuart", "easeInQuart"])
        transition_effects.append(["easeOutQuart", "easeOutQuart"])
        transition_effects.append(["easeInOutQuart", "easeInOutQuart"])        
        transition_effects.append(["easeInQuint", "easeInQuint"])
        transition_effects.append(["easeOutQuint", "easeOutQuint"])
        transition_effects.append(["easeInOutQuint", "easeInOutQuint"])        
        transition_effects.append(["easeInSine", "easeInSine"])
        transition_effects.append(["easeOutSine", "easeOutSine"])
        transition_effects.append(["easeInOutSine", "easeInOutSine"])        
        transition_effects.append(["easeInExpo", "easeInExpo"])
        transition_effects.append(["easeOutEXpo", "easeOutExpo"])
        transition_effects.append(["easeInOutExpo", "easeInOutExpo"])        
        transition_effects.append(["easeInCirc", "easeInCirc"])
        transition_effects.append(["easeOutCirc", "easeOutCirc"])
        transition_effects.append(["easeInOutCirc", "easeInOutCirc"])        
        transition_effects.append(["easeInElastic", "easeInElastic"])
        transition_effects.append(["easeOutElastic", "easeOutElastic"])
        transition_effects.append(["easeInOutElastic", "easeInOutElastic"])        
        transition_effects.append(["easeInBack", "easeInBack"])
        transition_effects.append(["easeOutBack", "easeOutBack"])
        transition_effects.append(["easeInOutBack", "easeInOutBack"])        
        transition_effects.append(["easeInBounce", "easeInBounce"])
        transition_effects.append(["easeOutBounce", "easeOutBounce"])
        transition_effects.append(["easeInOutBounce", "easeInOutBounce"])
        
        #CLOSING WINDOWS
        box = Gtk.HBox()        
        label = Gtk.Label()
        label.set_markup("%s" % _("Closing windows:"))
        box.pack_start(label, False, False, 0)         
        effects = [["none", _("None")], ["scale", _("Scale")], ["fade", _("Fade")]]        
        combo = GSettingsComboBox("", "org.cinnamon", "desktop-effects-close-effect", effects)        
        box.pack_start(combo, False, False, 0)         
        combo = GSettingsComboBox("", "org.cinnamon", "desktop-effects-close-transition", transition_effects)
        box.pack_start(combo, False, False, 0)         
        spin = GSettingsSpinButton("", "org.cinnamon", "desktop-effects-close-time", 0, 2000, 50, 200, _("milliseconds"))
        box.pack_start(spin, False, False, 0)         
        sidePage.add_widget(box) 
        
        #MAPPING WINDOWS
        box = Gtk.HBox()        
        label = Gtk.Label()
        label.set_markup("%s" % _("Mapping windows:"))
        box.pack_start(label, False, False, 0)         
        effects = [["none", _("None")], ["scale", _("Scale")], ["fade", _("Fade")]]        
        combo = GSettingsComboBox("", "org.cinnamon", "desktop-effects-map-effect", effects)        
        box.pack_start(combo, False, False, 0)         
        combo = GSettingsComboBox("", "org.cinnamon", "desktop-effects-map-transition", transition_effects)
        box.pack_start(combo, False, False, 0)         
        spin = GSettingsSpinButton("", "org.cinnamon", "desktop-effects-map-time", 0, 2000, 50, 200, _("milliseconds"))
        box.pack_start(spin, False, False, 0)         
        sidePage.add_widget(box)
        
        #MINIMIZING WINDOWS
        box = Gtk.HBox()        
        label = Gtk.Label()
        label.set_markup("%s" % _("Minimizing windows:"))
        box.pack_start(label, False, False, 0)         
        effects = [["none", _("None")], ["traditional", _("Traditional")], ["scale", _("Scale")], ["fade", _("Fade")]]        
        combo = GSettingsComboBox("", "org.cinnamon", "desktop-effects-minimize-effect", effects)        
        box.pack_start(combo, False, False, 0)         
        combo = GSettingsComboBox("", "org.cinnamon", "desktop-effects-minimize-transition", transition_effects)
        box.pack_start(combo, False, False, 0)         
        spin = GSettingsSpinButton("", "org.cinnamon", "desktop-effects-minimize-time", 0, 2000, 50, 200, _("milliseconds"))
        box.pack_start(spin, False, False, 0)         
        sidePage.add_widget(box)
        
        #MAXIMIZING WINDOWS
        box = Gtk.HBox()        
        label = Gtk.Label()
        label.set_markup("%s" % _("Maximizing windows:"))
        box.pack_start(label, False, False, 0)         
        effects = [["none", _("None")], ["scale", _("Scale")]]        
        combo = GSettingsComboBox("", "org.cinnamon", "desktop-effects-maximize-effect", effects)        
        box.pack_start(combo, False, False, 0)         
        combo = GSettingsComboBox("", "org.cinnamon", "desktop-effects-maximize-transition", transition_effects)
        box.pack_start(combo, False, False, 0)         
        spin = GSettingsSpinButton("", "org.cinnamon", "desktop-effects-maximize-time", 0, 2000, 50, 200, _("milliseconds"))
        box.pack_start(spin, False, False, 0)         
        sidePage.add_widget(box)
        
        #UNMAXIMIZING WINDOWS
        box = Gtk.HBox()        
        label = Gtk.Label()
        label.set_markup("%s" % _("Unmaximizing windows:"))
        box.pack_start(label, False, False, 0)         
        effects = [["none", _("None")]]        
        combo = GSettingsComboBox("", "org.cinnamon", "desktop-effects-unmaximize-effect", effects)        
        box.pack_start(combo, False, False, 0)         
        combo = GSettingsComboBox("", "org.cinnamon", "desktop-effects-unmaximize-transition", transition_effects)
        box.pack_start(combo, False, False, 0)         
        spin = GSettingsSpinButton("", "org.cinnamon", "desktop-effects-unmaximize-time", 0, 2000, 50, 200, _("milliseconds"))
        box.pack_start(spin, False, False, 0)         
        sidePage.add_widget(box)
        
        sidePage = AppletViewSidePage(_("Applets"), "applets.svg", self.content_box)
        self.sidePages.append((sidePage, "applets"))
        
        sidePage = ExtensionViewSidePage(_("Extensions"), "extensions.svg", self.content_box)
        self.sidePages.append((sidePage, "extensions"))
        
        nautilus_desktop_schema = Gio.Settings.new("org.gnome.nautilus.desktop")
        nautilus_desktop_keys = nautilus_desktop_schema.list_keys()
                        
        sidePage = SidePage(_("Desktop"), "desktop.svg", self.content_box)
        self.sidePages.append((sidePage, "desktop"))
        sidePage.add_widget(GSettingsCheckButton(_("Have file manager handle the desktop"), "org.gnome.desktop.background", "show-desktop-icons"))
        if "computer-icon-visible" in nautilus_desktop_keys:
            sidePage.add_widget(GSettingsCheckButton(_("Computer icon visible on desktop"), "org.gnome.nautilus.desktop", "computer-icon-visible"))
        if "home-icon-visible" in nautilus_desktop_keys:
            sidePage.add_widget(GSettingsCheckButton(_("Home icon visible on desktop"), "org.gnome.nautilus.desktop", "home-icon-visible"))
        if "network-icon-visible" in nautilus_desktop_keys:
            sidePage.add_widget(GSettingsCheckButton(_("Network Servers icon visible on desktop"), "org.gnome.nautilus.desktop", "network-icon-visible"))
        if "trash-icon-visible" in nautilus_desktop_keys:
            sidePage.add_widget(GSettingsCheckButton(_("Trash icon visible on desktop"), "org.gnome.nautilus.desktop", "trash-icon-visible"))
        if "volumes-visible" in nautilus_desktop_keys:
            sidePage.add_widget(GSettingsCheckButton(_("Show mounted volumes on the desktop"), "org.gnome.nautilus.desktop", "volumes-visible"))        
        
        sidePage = SidePage(_("Windows"), "windows.svg", self.content_box)
        self.sidePages.append((sidePage, "windows"))
        sidePage.add_widget(GConfComboBox(_("Action on title bar double-click"),
                                            "/apps/metacity/general/action_double_click_titlebar",
                                            [(i, i.replace("_", " ").title()) for i in ('toggle_shade', 'toggle_maximize', 'toggle_maximize_horizontally', 'toggle_maximize_vertically', 'minimize', 'shade', 'menu', 'lower', 'none')]))
        sidePage.add_widget(GConfComboBox(_("Action on title bar middle-click"),
                                            "/apps/metacity/general/action_middle_click_titlebar",
                                            [(i, i.replace("_", " ").title()) for i in ('toggle_shade', 'toggle_maximize', 'toggle_maximize_horizontally', 'toggle_maximize_vertically', 'minimize', 'shade', 'menu', 'lower', 'none')]))
        sidePage.add_widget(GConfComboBox(_("Action on title bar right-click"),
                                            "/apps/metacity/general/action_right_click_titlebar",
                                            [(i, i.replace("_", " ").title()) for i in ('toggle_shade', 'toggle_maximize', 'toggle_maximize_horizontally', 'toggle_maximize_vertically', 'minimize', 'shade', 'menu', 'lower', 'none')]))
        sidePage.add_widget(GConfComboBox(_("Window focus mode"),
                                            "/apps/metacity/general/focus_mode",
                                            [(i, i.title()) for i in ("click","sloppy","mouse")]))
        sidePage.add_widget(TitleBarButtonsOrderSelector())
        label = Gtk.Label()
        label.set_markup("<i><small>%s</small></i>" % _("Note: If you change the title bar buttons order you will need to restart Cinnamon."))
        sidePage.add_widget(label)
        
        sidePage = SidePage(_("Workspaces"), "workspaces.svg", self.content_box)
        self.sidePages.append((sidePage, "workspaces"))        
        sidePage.add_widget(GSettingsCheckButton(_("Enable workspace OSD"), "org.cinnamon", "workspace-osd-visible"))
        sidePage.add_widget(GSettingsSpinButton(_("Workspace OSD duration"), "org.cinnamon", "workspace-osd-duration", 0, 2000, 50, 400, _("milliseconds")))
        sidePage.add_widget(GSettingsSpinButton(_("Workspace OSD horizontal position"), "org.cinnamon", "workspace-osd-x", 0, 100, 5, 50, _("percent of the monitor's width")))
        sidePage.add_widget(GSettingsSpinButton(_("Workspace OSD vertical position"), "org.cinnamon", "workspace-osd-y", 0, 100, 5, 50, _("percent of the monitor's height")))
        sidePage.add_widget(GSettingsCheckButton(_("Only use workspaces on primary monitor (requires Cinnamon restart)"), "org.cinnamon.muffin", "workspaces-only-on-primary"))
        
        sidePage = SidePage(_("Fonts"), "fonts.svg", self.content_box)
        self.sidePages.append((sidePage, "fonts"))
        sidePage.add_widget(GSettingsRangeSpin(_("Text scaling factor"), "org.gnome.desktop.interface", "text-scaling-factor", adjustment_step = 0.1))
        sidePage.add_widget(GSettingsFontButton(_("Default font"), "org.gnome.desktop.interface", "font-name"))
        sidePage.add_widget(GSettingsFontButton(_("Document font"), "org.gnome.desktop.interface", "document-font-name"))
        sidePage.add_widget(GSettingsFontButton(_("Monospace font"), "org.gnome.desktop.interface", "monospace-font-name"))
        sidePage.add_widget(GConfFontButton(_("Window title font"), "/apps/metacity/general/titlebar_font"))
        sidePage.add_widget(GSettingsComboBox(_("Hinting"), "org.gnome.settings-daemon.plugins.xsettings", "hinting", [(i, i.title()) for i in ("none", "slight", "medium", "full")]))
        sidePage.add_widget(GSettingsComboBox(_("Antialiasing"), "org.gnome.settings-daemon.plugins.xsettings", "antialiasing", [(i, i.title()) for i in ("none", "grayscale", "rgba")]))
        
        sidePage = SidePage(_("General"), "general.svg", self.content_box)
        self.sidePages.append((sidePage, "general"))
        sidePage.add_widget(GSettingsCheckButton(_("Log LookingGlass output to ~/.cinnamon/glass.log (Requires Cinnamon restart)"), "org.cinnamon", "enable-looking-glass-logs"))
        
        #sidePage = SidePage(_("Terminal"), "terminal", self.content_box)
        #self.sidePages.append(sidePage)
        #sidePage.add_widget(GConfCheckButton(_("Show fortune cookies"), "/desktop/linuxmint/terminal/show_fortunes"))
        
                                
        # create the backing store for the side nav-view.                            
        self.store = Gtk.ListStore(str, GdkPixbuf.Pixbuf, object)
        sidePagesIters = {}
        for sidePage, sidePageID in self.sidePages:
            img = GdkPixbuf.Pixbuf.new_from_file_at_size( "/usr/lib/cinnamon-settings/data/icons/%s" % sidePage.icon, 48, 48)
            sidePagesIters[sidePageID] = self.store.append([sidePage.name, img, sidePage])     
                      
        # set up the side view - navigation.
        self.side_view.set_text_column(0)
        self.side_view.set_pixbuf_column(1)
        self.side_view.set_model(self.store)        
        self.side_view.connect("selection_changed", self.side_view_nav )

        # set up larger components.
        self.window.set_title(_("Cinnamon Settings"))       
        self.window.connect("destroy", Gtk.main_quit)
        self.button_cancel.connect("clicked", Gtk.main_quit)      
        self.button_back.connect('clicked', self.back_to_icon_view)     
        
        # Select the first sidePage
        if len(sys.argv)==2 and sys.argv[1] in sidePagesIters.keys():
            first_page_iter = sidePagesIters[sys.argv[1]]
            path = self.store.get_path(first_page_iter)
            self.side_view.select_path(path)
                                     
        self.window.show()
    
    def back_to_icon_view(self, widget):
        self.window.set_title(_("Cinnamon Settings"))
        self.content_box_sw.hide()
        self.top_button_box.hide()
        self.side_view_sw.show_all()
        
    def _ntp_toggled(self, widget):
        self.changeTimeWidget.change_using_ntp( self.ntpCheckButton.get_active() )
                
                
if __name__ == "__main__":
    GObject.threads_init()
    MainWindow()
    Gtk.main()
