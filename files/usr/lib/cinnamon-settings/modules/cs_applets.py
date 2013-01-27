#!/usr/bin/env python

from SettingsWidgets import *
import os
import os.path
from gi.repository import Gio, Gtk, GObject, Gdk
import dbus

home = os.path.expanduser("~")

class Module:
    def __init__(self, content_box):
        sidePage = AppletViewSidePage(_("Applets"), "applets.svg", content_box)
        self.sidePage = sidePage
        self.name = "applets"
        self.category = "feel"

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
        self.treeview = Gtk.TreeView()
                
        cr = Gtk.CellRendererToggle()
        cr.connect("toggled", self.toggled, self.treeview)
        column1 = Gtk.TreeViewColumn(_("Enable"), cr)
        column1.set_cell_data_func(cr, self.celldatafunction_checkbox)        
        column1.set_resizable(True)

        column2 = Gtk.TreeViewColumn(_("Icon"), Gtk.CellRendererPixbuf(), pixbuf=4)        
        column2.set_resizable(True)

        column3 = Gtk.TreeViewColumn(_("Description"), Gtk.CellRendererText(), markup=1)        
        column3.set_resizable(True)      
        
        self.treeview.append_column(column1)
        self.treeview.append_column(column2)
        self.treeview.append_column(column3)        
        self.treeview.set_headers_visible(False)        
            
        self.model = Gtk.TreeStore(str, str, int, int, GdkPixbuf.Pixbuf)
        #                          uuid, name, enabled, icon        
        self.model.set_sort_column_id(1, Gtk.SortType.ASCENDING)
        self.treeview.set_model(self.model)
                                
        # Find the enabled applets
        self.settings = Gio.Settings.new("org.cinnamon")
        self.enabled_applets = self.settings.get_strv("enabled-applets")
                         
        self.load_applets_in('/usr/share/cinnamon/applets')                                                                          
        self.load_applets_in('%s/.local/share/cinnamon/applets' % home)
        
        self.settings.connect("changed::enabled-applets", lambda x,y: self._enabled_applets_changed())
        
        scrolledWindow.add(self.treeview)                                                     
        scrolledWindow.set_shadow_type(Gtk.ShadowType.IN)
        
        self.instanceButton = Gtk.Button(_("Add another instance"))       
        self.instanceButton.connect("clicked", lambda x: self._add_another_instance())
        self.instanceButton.set_tooltip_text(_("Some applets can be added multiple times.\nUse this to add another instance. Use panel edit mode to remove a single instance."))
        self.instanceButton.set_sensitive(False);
        
        restoreButton = Gtk.Button(_("Restore to default"))       
        restoreButton.connect("clicked", lambda x: self._restore_default_applets())
        
        link = Gtk.LinkButton("http://cinnamon-spices.linuxmint.com/applets")
        link.set_label(_("Get new applets"))                
                         
        self.content_box.pack_start(self.search_entry, False, False, 2)
        self.content_box.add(scrolledWindow)        
        self.content_box.pack_start(self.instanceButton, False, False, 2) 
        self.content_box.pack_start(restoreButton, False, False, 2) 
        self.content_box.pack_start(link, False, False, 2) 
        
        self.content_box.show_all()   
        self.treeview.get_selection().connect("changed", lambda x: self._selection_changed());

    def _enabled_applets_changed(self):
        last_selection = ''
        model, treeiter = self.treeview.get_selection().get_selected()
        if treeiter:
            last_selection = self.model.get_value(treeiter, 0);
        self.enabled_applets = self.settings.get_strv("enabled-applets")
        
        uuidCount = {}
        for enabled_applet in self.enabled_applets:
            try:
                panel, align, order, uuid, id = enabled_applet.split(":")
                if uuid in uuidCount:
                    uuidCount[uuid] += 1
                else:
                    uuidCount[uuid] = 1
            except:
                pass

        for row in self.model:
            uuid = self.model.get_value(row.iter, 0)
            if(uuid in uuidCount):
                self.model.set_value(row.iter, 2, uuidCount[uuid])
            else:
                self.model.set_value(row.iter, 2, 0)
        
    def _add_another_instance(self):
        model, treeiter = self.treeview.get_selection().get_selected()
        if treeiter:
            self._add_another_instance_iter(treeiter)
        
    def _add_another_instance_iter(self, treeiter):
        uuid = self.model.get_value(treeiter, 0);
        applet_id = self.settings.get_int("next-applet-id");
        self.settings.set_int("next-applet-id", (applet_id+1));
        self.enabled_applets.append("panel1:right:0:%s:%d" % (uuid, applet_id))
        self.settings.set_strv("enabled-applets", self.enabled_applets)
            
    def _selection_changed(self):
        model, treeiter = self.treeview.get_selection().get_selected()
        enabled = False;
        
        tip = _("Some applets can be added multiple times.\nUse this to add another instance. Use panel edit mode to remove a single instance.")
        if treeiter:
            checked = model.get_value(treeiter, 2);
            max_instances = model.get_value(treeiter, 3);
            enabled = (max_instances > 1) and (max_instances > checked)
            if max_instances == 1:
                tip += _("\nThis applet does not support multiple instances.")
            else:
                tip += _("\nThis applet supports max %d instances.") % max_instances
        self.instanceButton.set_sensitive(enabled);
        self.instanceButton.set_tooltip_text(tip)
    
    def _restore_default_applets(self):
        os.system('gsettings reset org.cinnamon next-applet-id')
        os.system('gsettings reset org.cinnamon enabled-applets')
        
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
                        try: applet_max_instances = int(data["max-instances"])
                        except KeyError: applet_max_instances = 1
                        except ValueError: applet_max_instances = 1
                        if applet_max_instances <= 0:
                            applet_max_instances = 1
                            
                        if self.search_entry.get_text().upper() in (applet_name + applet_description).upper():
                            iter = self.model.insert_before(None, None)
                            found = 0
                            for enabled_applet in self.enabled_applets:
                                if applet_uuid in enabled_applet:
                                    found += 1

                            self.model.set_value(iter, 0, applet_uuid)                
                            self.model.set_value(iter, 1, '<b>%s</b>\n<b><span foreground="#333333" size="xx-small">%s</span></b>\n<i><span foreground="#555555" size="x-small">%s</span></i>' % (applet_name, applet_uuid, applet_description))                                  
                            self.model.set_value(iter, 2, found)
                            self.model.set_value(iter, 3, applet_max_instances)
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
                                
                            self.model.set_value(iter, 4, img)  
                except Exception, detail:
                    print "Failed to load applet %s: %s" % (applet, detail)

    def show_prompt(self, msg):
        dialog = Gtk.MessageDialog(None,
                    Gtk.DialogFlags.DESTROY_WITH_PARENT,
                    Gtk.MessageType.QUESTION,
                    Gtk.ButtonsType.YES_NO,
                    None)
        dialog.set_default_size(400, 200)
        dialog.set_markup(msg)
        dialog.show_all()
        response = dialog.run()
        dialog.destroy()
        return response == Gtk.ResponseType.YES
                            
    def toggled(self, renderer, path, treeview):        
        iter = self.model.get_iter(path)
        if (iter != None):
            uuid = self.model.get_value(iter, 0)
            checked = self.model.get_value(iter, 2)
            if checked == 0:
                self._add_another_instance_iter(iter)
                return
            
            if (checked > 1):
                msg = _("There are multiple instances of this applet, do you want to remove them all?\n\n")
                msg += _("You can remove specific instances in panel edit mode via the context menu.")
                if self.show_prompt(msg) == False:
                    return
                    
            self.model.set_value(iter, 2, 0)
            newApplets = []
            for enabled_applet in self.enabled_applets:
                if uuid not in enabled_applet:
                    newApplets.append(enabled_applet)
            self.enabled_applets = newApplets
            self.settings.set_strv("enabled-applets", self.enabled_applets)
                
    def celldatafunction_checkbox(self, column, cell, model, iter, data=None):
        cell.set_property("activatable", True)
        checked = model.get_value(iter, 2)
        if (checked > 0):
            cell.set_property("active", True)
        else:
            cell.set_property("active", False)
