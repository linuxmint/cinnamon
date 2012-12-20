
import json
import pageutils
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib

class ModulePage(pageutils.BaseListView):
    def __init__(self):
        store = Gtk.ListStore(int, str, str, str)
        pageutils.BaseListView.__init__(self, store)
        
        column = self.create_text_column(0, "ID")
        column.set_cell_data_func(self.rendererText, self.celldatafunction_id) 
        self.create_text_column(1, "Title")
        self.create_text_column(2, "WMClass")
        self.create_text_column(3, "Application")
        self.getUpdates()
        cinnamonDBus.connect_to_signal("lgWindowListUpdate", self.getUpdates)
    
        self.popup = Gtk.Menu()
        inspectApp = Gtk.MenuItem('Inspect Application')
        inspectApp.connect("activate", self.onInspectApplication)
        self.popup.append(inspectApp)
        self.popup.show_all()
    
        self.treeView.connect("button-press-event", self.on_button_press_event)
        self.treeView.connect("row-activated", self.onRowActivated)

    def onInspectApplication(self, menuItem):
        iter = self.store.get_iter(self.selectedPath)
        id = self.store.get_value(iter, 0)
        application = self.store.get_value(iter, 3)
        
        cinnamonLog.pages["inspect"].inspectElement("a(%d)" % id, "object", application, "<application>")
        
        
    def on_button_press_event(self, treeview, event):
        if event.button == 3:
            x = int(event.x)
            y = int(event.y)
            time = event.time
            pthinfo = treeview.get_path_at_pos(x, y)
            if pthinfo is not None:
                path, col, cellx, celly = pthinfo
                self.selectedPath = path
                treeview.grab_focus()
                treeview.set_cursor( path, col, 0)
                self.popup.popup( None, None, None, None, event.button, event.time)
            return True
            
    def onRowActivated(self, treeview, path, view_column):
        iter = self.store.get_iter(path)
        id = self.store.get_value(iter, 0)
        title = self.store.get_value(iter, 1)
        
        cinnamonLog.pages["inspect"].inspectElement("w(%d)" % id, "object", title, "<window>")

    def getUpdates(self):
        success, json_data = cinnamonDBus.lgGetLatestWindowList()
        data = json.loads(json_data)
        self.store.clear()
        for item in data:
            self.store.append([int(item["id"]), item["title"], item["wmclass"], item["app"]])

    def celldatafunction_id(self, column, cell, model, iter, data=None):
        value = model.get_value(iter, 0)
        cell.set_property("text", "w(%d) / a(%d)" %  (value, value))
