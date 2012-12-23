
import json
import pageutils
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib

class ModulePage(pageutils.BaseListView):
    def __init__(self):
        store = Gtk.ListStore(int, str, str, str)
        pageutils.BaseListView.__init__(self, store)
        
        column = self.createTextColumn(0, "ID")
        column.set_cell_data_func(self.rendererText, self.cellDataFuncID) 
        self.createTextColumn(1, "Title")
        self.createTextColumn(2, "WMClass")
        self.createTextColumn(3, "Application")
        
        self.getUpdates()
        cinnamonDBus.connect_to_signal("lgWindowListUpdate", self.getUpdates)
    
        self.treeView.connect("row-activated", self.onRowActivated)
        self.treeView.connect("button-press-event", self.onButtonPress)

        # Popup menu
        self.popup = Gtk.Menu()
        inspectApp = Gtk.MenuItem('Inspect Application')
        inspectApp.connect("activate", self.onInspectApplication)
        self.popup.append(inspectApp)
        self.popup.show_all()

    def cellDataFuncID(self, column, cell, model, iter, data=None):
        value = model.get_value(iter, 0)
        cell.set_property("text", "w(%d) / a(%d)" %  (value, value))
        
    def onInspectApplication(self, menuItem):
        iter = self.store.get_iter(self.selectedPath)
        id = self.store.get_value(iter, 0)
        application = self.store.get_value(iter, 3)
        
        cinnamonLog.pages["inspect"].inspectElement("a(%d)" % id, "object", application, "<application>")

    def onRowActivated(self, treeview, path, view_column):
        iter = self.store.get_iter(path)
        id = self.store.get_value(iter, 0)
        title = self.store.get_value(iter, 1)
        
        cinnamonLog.pages["inspect"].inspectElement("w(%d)" % id, "object", title, "<window>")

    def onButtonPress(self, treeview, event):
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

    def getUpdates(self):
        self.store.clear()
        success, json_data = cinnamonDBus.lgGetLatestWindowList()
        if success:
            try:
                data = json.loads(json_data)
                for item in data:
                    self.store.append([int(item["id"]), item["title"], item["wmclass"], item["app"]])
            except Exception as e:
                print e
