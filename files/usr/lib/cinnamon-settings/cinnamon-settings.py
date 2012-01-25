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
            
class ChangeTimeWidget(Gtk.VBox):
    def __init__(self):
        super(ChangeTimeWidget, self).__init__()
        proxy = dbus.SystemBus().get_object("org.gnome.SettingsDaemon.DateTimeMechanism", "/")
        self.dbus_iface = dbus.Interface(proxy, dbus_interface="org.gnome.SettingsDaemon.DateTimeMechanism")
        
        # Ensures we're setting the system time only when the user changes it
        self.changedOnTimeout = False
        
        # Ensures we don't update the values in the date/time fields during the DBus call to set the time
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
        self.hourSpin.set_editable(False)
        self.minSpin.set_editable(False)
        self.yearSpin.set_editable(False)
        self.daySpin.set_editable(False)
        
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
        
        self.pack_start(timeBox, False, False, 2)
        self.pack_start(dateBox, False, False, 2)
        
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
        
        # If there's already another thread updating the time, we let it do the job
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
        
    def _ntp_toggled(self, widget):
        self.changeTimeWidget.change_using_ntp( self.ntpCheckButton.get_active() )
                
                
if __name__ == "__main__":
    GObject.threads_init()
    MainWindow()
    Gtk.main()
