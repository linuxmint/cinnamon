
import json
import pageutils
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib

class ModulePage(pageutils.BaseListView):
    def __init__(self):
        store = Gtk.ListStore(int, str, str, str)
        pageutils.BaseListView.__init__(self, store)
        
        column = self.create_text_column(0, "ID")
        column.set_cell_data_func(self.rendererText, self.celldatafunction_id) 
        self.create_text_column(1, "Command")
        self.create_text_column(2, "Type")
        self.create_text_column(3, "Object")

        self.popup = Gtk.Menu()
        clear = Gtk.MenuItem('Clear all results')
        self.popup.append(clear)
        self.popup.show_all()
    
        self.treeView.connect("button-press-event", self.on_button_press_event)
        self.treeView.connect("row-activated", self.onRowActivated)
        
        self.getUpdates()
        cinnamonDBus.connect_to_signal("lgResultUpdate", self.getUpdates)
        cinnamonDBus.connect_to_signal("lgInspectorDone", self.onInspectorDone)
        
    def onInspectorDone(self):
        cinnamonLog.activatePage("results")
        self.getUpdates()
        
    def onRowActivated(self, treeview, path, view_column):
        iter = self.store.get_iter(path)
        id = self.store.get_value(iter, 0)
        name = self.store.get_value(iter, 1)
        objType = self.store.get_value(iter, 2)
        value = self.store.get_value(iter, 3)
        
        cinnamonLog.pages["inspect"].inspectElement("r(%d)" % id, objType, name, value)
        
    def on_button_press_event(self, treeview, event):
        if event.button == 3:
            treeview.grab_focus()
            self.popup.popup( None, None, None, None, event.button, event.time)
            return True
        
    def getUpdates(self):
        success, json_data = cinnamonDBus.lgGetResults()
        data = json.loads(json_data)
        self.store.clear()
        for item in data:
            self.store.append([int(item["index"]), item["command"], item["type"], item["object"]])

    def celldatafunction_id(self, column, cell, model, iter, data=None):
        cell.set_property("text", "r(%d)" %  model.get_value(iter, 0))
