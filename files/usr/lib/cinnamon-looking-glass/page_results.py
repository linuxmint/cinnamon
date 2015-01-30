from pageutils import *
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib

class ModulePage(BaseListView):
    def __init__(self):
        store = Gtk.ListStore(int, str, str, str)
        BaseListView.__init__(self, store)

        column = self.createTextColumn(0, "ID")
        column.set_cell_data_func(self.rendererText, self.cellDataFuncID)
        self.createTextColumn(1, "Name")
        self.createTextColumn(2, "Type")
        self.createTextColumn(3, "Value")

        self.treeView.connect("row-activated", self.onRowActivated)
        self.treeView.connect("button-press-event", self.onButtonPress)

        self.getUpdates()
        lookingGlassProxy.connect("ResultUpdate", self.getUpdates)
        lookingGlassProxy.connect("InspectorDone", self.onInspectorDone)
        lookingGlassProxy.addStatusChangeCallback(self.onStatusChange)

        #Popup menu
        self.popup = Gtk.Menu()
        clear = Gtk.MenuItem('Clear all results')
        self.popup.append(clear)
        self.popup.show_all()

    def cellDataFuncID(self, column, cell, model, iter, data=None):
        cell.set_property("text", "r(%d)" %  model.get_value(iter, 0))

    def onRowActivated(self, treeview, path, view_column):
        iter = self.store.get_iter(path)
        id = self.store.get_value(iter, 0)
        name = self.store.get_value(iter, 1)
        objType = self.store.get_value(iter, 2)
        value = self.store.get_value(iter, 3)

        cinnamonLog.pages["inspect"].inspectElement("r(%d)" % id, objType, name, value)

    def onButtonPress(self, treeview, event):
        if event.button == 3:
            treeview.grab_focus()
            self.popup.popup( None, None, None, None, event.button, event.time)
            return True

    def onStatusChange(self, online):
        if online:
            self.getUpdates()

    def getUpdates(self):
        self.store.clear()
        success, data = lookingGlassProxy.GetResults()
        if success:
            try:
                for item in data:
                    self.store.append([int(item["index"]), item["command"], item["type"], item["object"]])
            except Exception as e:
                print e

    def onInspectorDone(self):
        cinnamonLog.show()
        cinnamonLog.activatePage("results")
        self.getUpdates()
