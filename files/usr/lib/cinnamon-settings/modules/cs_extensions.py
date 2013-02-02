#!/usr/bin/env python

from SettingsWidgets import *
import os
import os.path
import dbus
from gi.repository import Gio, Gtk, GObject, Gdk

home = os.path.expanduser("~")

class Module:
    def __init__(self, content_box):
        keywords = _("extensions, addons")
        advanced = True
        sidePage = ExtensionViewSidePage(_("Extensions"), "extensions.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "extensions"
        self.category = "prefs"

class ExtensionViewSidePage (SidePage):
    def __init__(self, name, icon, keywords, advanced, content_box):
        SidePage.__init__(self, name, icon, keywords, advanced, content_box)
        self.icons = []
                  
    def build(self, advanced):
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
            
