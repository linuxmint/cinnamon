
import json
import pageutils
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib

class MemoryView(pageutils.BaseListView):
    def __init__(self):
        store = Gtk.ListStore(str, int)
        pageutils.BaseListView.__init__(self, store)
        
        self.create_text_column(0, "Name")
        self.create_text_column(1, "Size (bytes)")
        column = self.create_text_column(1, "Size (readable)")
        column.set_cell_data_func(self.rendererText, self.celldatafunction_size) 
        self.getUpdates()

    def celldatafunction_size(self, column, cell, model, iter, data=None):
        value = model.get_value(iter, 1)
        if(value < 1000):
            cell.set_property("text", "%d B" %  value)
        elif(value < 1000000):
            cell.set_property("text", "%.2f KB" %  (value/1024.0))
        elif(value < 1000000000):
            cell.set_property("text", "%.2f MB" %  (value/1024.0/1024.0))
        
    def getUpdates(self, igno=None):
        success, json_data = cinnamonDBus.lgGetMemoryInfo()
        data = json.loads(json_data)
        self.store.clear()
        for key in data.keys():
            self.store.append([key, int(data[key])])

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
