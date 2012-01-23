#!/usr/bin/env python

try:
    import os
    import commands
    import sys
    import string    
    import gettext
    from gi.repository import Gio, Gtk
    from gi.repository import GdkPixbuf 
    import gconf
    import json
    import dbus
    from user import home
except Exception, detail:
    print detail
    sys.exit(1)


# i18n
gettext.install("cinnamon-settings", "/usr/share/cinnamon/locale")

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
        scrolledWindow = Gtk.ScrolledWindow()                
        
        iconView = Gtk.IconView()        
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
        self.content_box.add(scrolledWindow)
        self.content_box.show_all()
    
    def load_themes_in(self, directory):
        if os.path.exists(directory) and os.path.isdir(directory):
            themes = os.listdir(directory)
            themes.sort()
            for theme in themes:
                if os.path.exists("%s/%s/cinnamon/cinnamon.css" % (directory, theme)):
                    if os.path.exists("%s/%s/cinnamon/thumbnail.png" % (directory, theme)):
                        img = GdkPixbuf.Pixbuf.new_from_file_at_size( "%s/%s/cinnamon/thumbnail.png" % (directory, theme), 64, 64 )
                    else:
                        img = GdkPixbuf.Pixbuf.new_from_file_at_size( "/usr/share/cinnamon/theme/thumbnail-generic.png", 64, 64 )
                    theme_iter = self.model.append([theme, img])
                    if theme==self.current_theme:
                        self.active_theme_iter = theme_iter
        
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
        column1.set_sort_column_id(4)
        column1.set_resizable(True)

        column2 = Gtk.TreeViewColumn(_("UUID"), Gtk.CellRendererText(), text=0)
        column2.set_sort_column_id(1)
        column2.set_resizable(True)

        column3 = Gtk.TreeViewColumn(_("Name"), Gtk.CellRendererText(), text=1)
        column3.set_sort_column_id(2)
        column3.set_resizable(True)

        column4 = Gtk.TreeViewColumn(_("Description"), Gtk.CellRendererText(), text=2)
        column4.set_sort_column_id(3)
        column4.set_resizable(True)
        
        treeview.append_column(column1)
        treeview.append_column(column2)
        treeview.append_column(column3)
        treeview.append_column(column4)
        treeview.set_headers_clickable(True)
        treeview.set_reorderable(False)
            
        self.model = Gtk.TreeStore(str, str, str, bool)
        #self.model.set_sort_column_id( 1, Gtk.SORT_ASCENDING )
        treeview.set_model(self.model)
                                
        # Find the enabled extensions
        self.settings = Gio.Settings.new("org.cinnamon")
        self.enabled_extensions = self.settings.get_strv("enabled-extensions")
                         
        self.load_extensions_in('/usr/share/cinnamon/extensions')                                                                          
        self.load_extensions_in('%s/.local/share/cinnamon/extensions' % home)
        
        scrolledWindow.add(treeview)                                       
        self.content_box.add(scrolledWindow)
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
                    self.model.set_value(iter, 1, extension_name)
                    self.model.set_value(iter, 2, extension_description)
                    self.model.set_value(iter, 3, (extension_uuid in self.enabled_extensions))
        
    def toggled(self, renderer, path, treeview):        
        iter = self.model.get_iter(path)
        if (iter != None):
            uuid = self.model.get_value(iter, 0)
            checked = self.model.get_value(iter, 3)
            if (checked):
                self.model.set_value(iter, 3, False)
                self.enabled_extensions.remove(uuid)
            else:
                self.model.set_value(iter, 3, True) 
                self.enabled_extensions.append(uuid)
            
            self.settings.set_strv("enabled-extensions", self.enabled_extensions)
                
    def celldatafunction_checkbox(self, column, cell, model, iter, data=None):
        cell.set_property("activatable", True)
        checked = model.get_value(iter, 3)
        if (checked):
            cell.set_property("active", True)
        else:
            cell.set_property("active", False)
            
class AppletViewSidePage (SidePage):
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

        column2 = Gtk.TreeViewColumn(_("Icon"), Gtk.CellRendererPixbuf(), pixbuf=3)        
        column2.set_resizable(True)

        column3 = Gtk.TreeViewColumn(_("Description"), Gtk.CellRendererText(), markup=1)
        column3.set_sort_column_id(2)
        column3.set_resizable(True)      
        
        treeview.append_column(column1)
        treeview.append_column(column2)
        treeview.append_column(column3)        
        treeview.set_headers_visible(False)        
            
        self.model = Gtk.TreeStore(str, str, bool, GdkPixbuf.Pixbuf)
        #                          uuid, name, enabled, icon        
        treeview.set_model(self.model)
                                
        # Find the enabled applets
        self.settings = Gio.Settings.new("org.cinnamon")
        self.enabled_applets = self.settings.get_strv("enabled-applets")
                         
        self.load_applets_in('/usr/share/cinnamon/applets')                                                                          
        self.load_applets_in('%s/.local/share/cinnamon/applets' % home)
        
        scrolledWindow.add(treeview)                                       
        self.content_box.add(scrolledWindow)
        self.content_box.show_all()   
        
    def load_applets_in(self, directory):
        if os.path.exists(directory) and os.path.isdir(directory):
            applets = os.listdir(directory)
            applets.sort()
            for applet in applets:            
                if os.path.exists("%s/%s/metadata.json" % (directory, applet)):
                    json_data=open("%s/%s/metadata.json" % (directory, applet)).read()
                    data = json.loads(json_data)  
                    applet_uuid = data["uuid"]
                    applet_name = data["name"]                
                    applet_description = data["description"]
                    applet_icon = data["icon"]
                    iter = self.model.insert_before(None, None)
                    self.model.set_value(iter, 0, applet_uuid)                
                    self.model.set_value(iter, 1, '<b>%s</b>\n<i><span foreground="#555555" size="x-small">%s</span></i>' % (applet_name, applet_description))                    
                    self.model.set_value(iter, 2, (applet_uuid in self.enabled_applets))
                    theme = Gtk.IconTheme.get_default()
                    if theme.has_icon(applet_icon):
                        img = theme.load_icon(applet_icon, 36, 0)
                    else:
                        img = theme.load_icon("/usr/lib/cinnamon-settings/data/icons/applets.svg", 36, 36)
                    self.model.set_value(iter, 3, img)
        
    def toggled(self, renderer, path, treeview):        
        iter = self.model.get_iter(path)
        if (iter != None):
            uuid = self.model.get_value(iter, 0)
            checked = self.model.get_value(iter, 2)
            if (checked):
                self.model.set_value(iter, 2, False)
                self.enabled_applets.remove(uuid)
            else:
                self.model.set_value(iter, 2, True) 
                self.enabled_applets.append(uuid)
            
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
        self.content_widget.set_editable(False)
        
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
    
    def on_my_setting_changed(self, settings, key):
        self.content_widget.set_text(self.settings.get_string(self.key))
        
    def on_my_value_changed(self, widget):        
        self.settings.set_string(self.key, self.content_widget.get_text())

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

class MainWindow:
  
    # Change pages
    def side_view_nav(self, side_view):
        selected_items = side_view.get_selected_items()
        if len(selected_items) > 0:
            path = selected_items[0]            
            iterator = self.store.get_iter(path)
            print self.store.get_value(iterator, 0)
            self.store.get_value(iterator,2).build()
            
    ''' Create the UI '''
    def __init__(self):        
        
        self.builder = Gtk.Builder()
        self.builder.add_from_file("/usr/lib/cinnamon-settings/cinnamon-settings.ui")
        self.window = self.builder.get_object("main_window")
        self.side_view = self.builder.get_object("side_view")
        self.content_box = self.builder.get_object("content_box")
        self.button_cancel = self.builder.get_object("button_cancel")
        
        self.window.connect("destroy", Gtk.main_quit)

        self.sidePages = []
                                                      
        sidePage = SidePage(_("Panel"), "panel.svg", self.content_box)
        self.sidePages.append(sidePage)
        sidePage.add_widget(GSettingsEntry(_("Menu text"), "org.cinnamon", "menu-text")) 
        sidePage.add_widget(GSettingsCheckButton(_("Auto-hide panel"), "org.cinnamon", "panel-autohide"))
        desktop_layouts = [["traditional", _("Traditional (panel at the bottom)")], ["flipped", _("Flipped (panel at the top)")], ["classic", _("Classic (panels at the top and at the bottom)")]]        
        desktop_layouts_combo = GSettingsComboBox(_("Desktop layout"), "org.cinnamon", "desktop-layout", desktop_layouts)
        sidePage.add_widget(desktop_layouts_combo) 
        label = Gtk.Label()
        label.set_markup("<i><small>%s</small></i>" % _("Note: If you change the layout you will need to restart Cinnamon."))
        sidePage.add_widget(label)         
        
        sidePage = SidePage(_("Calendar"), "clock.svg", self.content_box)
        self.sidePages.append(sidePage)     
        sidePage.add_widget(GSettingsCheckButton(_("Show week dates in calendar"), "org.cinnamon.calendar", "show-weekdate"))         
        sidePage.add_widget(GSettingsEntry(_("Date format for the panel"), "org.cinnamon.calendar", "date-format"))                                 
        sidePage.add_widget(GSettingsEntry(_("Date format inside the date applet"), "org.cinnamon.calendar", "date-format-full"))                                 
        sidePage.add_widget(Gtk.LinkButton.new_with_label("http://www.foragoodstrftime.com/", _("Generate your own date formats"))) 
        sidePage.add_widget(DBusCheckButton(_("Use network time"), "org.gnome.SettingsDaemon.DateTimeMechanism", "/", "GetUsingNtp", "SetUsingNtp"))
        
        sidePage = SidePage(_("Overview"), "overview.svg", self.content_box)
        self.sidePages.append(sidePage)
        sidePage.add_widget(GSettingsCheckButton(_("Overview icon visible"), "org.cinnamon", "overview-corner-visible")) 
        sidePage.add_widget(GSettingsCheckButton(_("Overview hot corner enabled"), "org.cinnamon", "overview-corner-hover")) 
        
        sidePage = ThemeViewSidePage(_("Themes"), "themes.svg", self.content_box)
        self.sidePages.append(sidePage)
        
        sidePage = SidePage(_("Effects"), "desktop-effects.svg", self.content_box)
        self.sidePages.append(sidePage)
        sidePage.add_widget(GSettingsCheckButton(_("Enable desktop effects"), "org.cinnamon", "desktop-effects"))
        
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
        combo = GSettingsComboBox(_(""), "org.cinnamon", "desktop-effects-close-effect", effects)        
        box.pack_start(combo, False, False, 0)         
        combo = GSettingsComboBox(_(""), "org.cinnamon", "desktop-effects-close-transition", transition_effects)
        box.pack_start(combo, False, False, 0)         
        spin = GSettingsSpinButton(_(""), "org.cinnamon", "desktop-effects-close-time", 0, 2000, 50, 200, _("milliseconds"))
        box.pack_start(spin, False, False, 0)         
        sidePage.add_widget(box) 
        
        #MAPPING WINDOWS
        box = Gtk.HBox()        
        label = Gtk.Label()
        label.set_markup("%s" % _("Mapping windows:"))
        box.pack_start(label, False, False, 0)         
        effects = [["none", _("None")], ["scale", _("Scale")], ["fade", _("Fade")]]        
        combo = GSettingsComboBox(_(""), "org.cinnamon", "desktop-effects-map-effect", effects)        
        box.pack_start(combo, False, False, 0)         
        combo = GSettingsComboBox(_(""), "org.cinnamon", "desktop-effects-map-transition", transition_effects)
        box.pack_start(combo, False, False, 0)         
        spin = GSettingsSpinButton(_(""), "org.cinnamon", "desktop-effects-map-time", 0, 2000, 50, 200, _("milliseconds"))
        box.pack_start(spin, False, False, 0)         
        sidePage.add_widget(box)
        
        #MINIMIZING WINDOWS
        box = Gtk.HBox()        
        label = Gtk.Label()
        label.set_markup("%s" % _("Minimizing windows:"))
        box.pack_start(label, False, False, 0)         
        effects = [["none", _("None")], ["traditional", _("Traditional")], ["scale", _("Scale")], ["fade", _("Fade")]]        
        combo = GSettingsComboBox(_(""), "org.cinnamon", "desktop-effects-minimize-effect", effects)        
        box.pack_start(combo, False, False, 0)         
        combo = GSettingsComboBox(_(""), "org.cinnamon", "desktop-effects-minimize-transition", transition_effects)
        box.pack_start(combo, False, False, 0)         
        spin = GSettingsSpinButton(_(""), "org.cinnamon", "desktop-effects-minimize-time", 0, 2000, 50, 200, _("milliseconds"))
        box.pack_start(spin, False, False, 0)         
        sidePage.add_widget(box)
        
        #MAXIMIZING WINDOWS
        box = Gtk.HBox()        
        label = Gtk.Label()
        label.set_markup("%s" % _("Maximizing windows:"))
        box.pack_start(label, False, False, 0)         
        effects = [["none", _("None")], ["scale", _("Scale")]]        
        combo = GSettingsComboBox(_(""), "org.cinnamon", "desktop-effects-maximize-effect", effects)        
        box.pack_start(combo, False, False, 0)         
        combo = GSettingsComboBox(_(""), "org.cinnamon", "desktop-effects-maximize-transition", transition_effects)
        box.pack_start(combo, False, False, 0)         
        spin = GSettingsSpinButton(_(""), "org.cinnamon", "desktop-effects-maximize-time", 0, 2000, 50, 200, _("milliseconds"))
        box.pack_start(spin, False, False, 0)         
        sidePage.add_widget(box)
        
        #UNMAXIMIZING WINDOWS
        box = Gtk.HBox()        
        label = Gtk.Label()
        label.set_markup("%s" % _("Unmaximizing windows:"))
        box.pack_start(label, False, False, 0)         
        effects = [["none", _("None")]]        
        combo = GSettingsComboBox(_(""), "org.cinnamon", "desktop-effects-unmaximize-effect", effects)        
        box.pack_start(combo, False, False, 0)         
        combo = GSettingsComboBox(_(""), "org.cinnamon", "desktop-effects-unmaximize-transition", transition_effects)
        box.pack_start(combo, False, False, 0)         
        spin = GSettingsSpinButton(_(""), "org.cinnamon", "desktop-effects-unmaximize-time", 0, 2000, 50, 200, _("milliseconds"))
        box.pack_start(spin, False, False, 0)         
        sidePage.add_widget(box)
        
        sidePage = AppletViewSidePage(_("Applets"), "applets.svg", self.content_box)
        self.sidePages.append(sidePage)
        
        sidePage = ExtensionViewSidePage(_("Extensions"), "extensions.svg", self.content_box)
        self.sidePages.append(sidePage)
                        
        #sidePage = SidePage(_("Terminal"), "terminal", self.content_box)
        #self.sidePages.append(sidePage)
        #sidePage.add_widget(GConfCheckButton(_("Show fortune cookies"), "/desktop/linuxmint/terminal/show_fortunes"))
        
                                
        # create the backing store for the side nav-view.                            
        self.store = Gtk.ListStore(str, GdkPixbuf.Pixbuf, object)
        for sidePage in self.sidePages:
            img = GdkPixbuf.Pixbuf.new_from_file_at_size( "/usr/lib/cinnamon-settings/data/icons/%s" % sidePage.icon, 48, 48)
            self.store.append([sidePage.name, img, sidePage])     
                      
        # set up the side view - navigation.
        self.side_view.set_text_column(0)
        self.side_view.set_pixbuf_column(1)
        self.side_view.set_model(self.store)        
        self.side_view.connect("selection_changed", self.side_view_nav )

        # Select the first sidePage
        first_page_iter = self.store.get_iter_first()        
        path = self.store.get_path(first_page_iter)
        self.side_view.select_path(path)

        # set up larger components.
        self.window.set_title(_("Cinnamon Settings"))       
        self.window.connect("destroy", Gtk.main_quit)
        self.button_cancel.connect("clicked", Gtk.main_quit)                                    
        self.window.show()
                
                
if __name__ == "__main__":
    MainWindow()
    Gtk.main()
