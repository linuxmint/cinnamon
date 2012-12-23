
import json
import pageutils
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib

class MemoryView(pageutils.BaseListView):
    def __init__(self):
        store = Gtk.ListStore(str, int)
        pageutils.BaseListView.__init__(self, store)
        
        self.createTextColumn(0, "Name")
        self.createTextColumn(1, "Size (bytes)")
        column = self.createTextColumn(1, "Size (readable)")
        column.set_cell_data_func(self.rendererText, self.cellDataFuncSize)
        
        self.getUpdates()

    def cellDataFuncSize(self, column, cell, model, iter, data=None):
        value = model.get_value(iter, 1)
        if(value < 1000):
            cell.set_property("text", "%d B" %  value)
        elif(value < 1000000):
            cell.set_property("text", "%.2f KB" %  (value/1024.0))
        elif(value < 1000000000):
            cell.set_property("text", "%.2f MB" %  (value/1024.0/1024.0))
        
    def getUpdates(self, igno=None):
        self.store.clear()
        success, json_data = cinnamonDBus.lgGetMemoryInfo()
        if success:
            try:
                data = json.loads(json_data)
                for key in data.keys():
                    self.store.append([key, int(data[key])])
            except Exception as e:
                print e

    def onFullGc(self, widget):
        cinnamonDBus.lgFullGc()
        self.getUpdates()

class ModulePage(pageutils.WindowAndActionBars):
    def __init__(self):
        self.view = MemoryView()
        pageutils.WindowAndActionBars.__init__(self, self.view)
        
        refresh = pageutils.ImageButton("view-refresh")
        refresh.set_tooltip_text("Refresh")
        refresh.connect("clicked", self.view.getUpdates)
        self.addToLeftBar(refresh, 1)
        fullGc = pageutils.ImageButton("user-trash-full")
        fullGc.set_tooltip_text("Full Garbage Collection")
        fullGc.connect ('clicked', self.view.onFullGc)
        
        self.addToLeftBar(fullGc, 1)
