
import json
import pageutils
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib

class InspectView(pageutils.BaseListView):
    def __init__(self, parent):
        self.parent = parent
        store = Gtk.ListStore(str, str, str, str, str)
        pageutils.BaseListView.__init__(self, store)
        
        self.create_text_column(0, "Name")
        self.create_text_column(1, "Type")
        self.create_text_column(2, "Value")
        self.treeView.connect("row-activated", self.onRowActivated)
        
    def onRowActivated(self, treeview, path, view_column):
        iter = self.store.get_iter(path)
        name = self.store.get_value(iter, 0)
        type = self.store.get_value(iter, 1)
        value = self.store.get_value(iter, 3)
        path = self.store.get_value(iter, 4)
        
        self.parent.updateInspector(path, type, name, value, True)
        
    def setInspectionData(self, path, data):
        self.store.clear()
        for item in data:
            self.store.append([item["name"], item["type"], item["shortValue"], item["value"], path + "." + item["name"]])
        
class ModulePage(pageutils.WindowAndActionBars):
    def __init__(self):
        self.statusBar = Gtk.Statusbar()
        context_id = self.statusBar.get_context_id("Statusbar example")
        message_id = self.statusBar.push(context_id, "Mama")
        
        self.view = InspectView(self)
        pageutils.WindowAndActionBars.__init__(self, self.view)
        
        
        back = pageutils.ImageButton("back")
        back.set_tooltip_text("Go back")
        back.connect("clicked", self.onBackButton)
        self.addToLeftBar(back, 1)
        
        insert = pageutils.ImageButton("insert-object")
        insert.set_tooltip_text("Insert into results")
        insert.connect("clicked", self.onInsertButton)
        self.addToLeftBar(insert, 1)
        
        
        self.addToBottomBar(Gtk.Label("Path:"), 1)
        self.pathLabel = Gtk.Label("<No selection done yet>")
        self.addToBottomBar(self.pathLabel, 1)
        
        self.addToBottomBar(Gtk.Label("; Type:"), 1)
        self.typeLabel = Gtk.Label("")
        self.addToBottomBar(self.typeLabel, 1)
        self.addToBottomBar(Gtk.Label("; Name:"), 1)
        self.nameLabel = Gtk.Label("")
        self.addToBottomBar(self.nameLabel, 1)
        
        self.currentInspection = None
        self.stack = []

    def onInsertButton(self, widget):
        if len(self.stack) == 0:
            pass # message: already available via r(%d), etc.
        else:
            path, objType, name, value = self.currentInspection
            cinnamonDBus.lgAddResult(path)
        
    def onBackButton(self, widget):
        self.popInspectionElement()

    def popInspectionElement(self):
        if len(self.stack) > 0:
            self.updateInspector(*self.stack.pop())
            
    def pushInspectionElement(self):
        if self.currentInspection is not None:
            self.stack.append(self.currentInspection)
        
    def updateInspector(self, path, objType, name, value, pushToStack=False):
        if objType == "object":
            if pushToStack:
                self.pushInspectionElement()
            self.currentInspection = (path, objType, name, value)
            
            self.pathLabel.set_text(path)
            self.typeLabel.set_text(objType)
            self.nameLabel.set_text(name)
        
            cinnamonLog.activatePage("inspect")
            success, json_data = cinnamonDBus.lgInspect(path)
            if success:
                data = json.loads(json_data)
                self.view.setInspectionData(path, data)
            else:
                self.view.store.clear()
        elif objType == "undefined":
            pageutils.ResultTextDialog("Value for '" + name + "'", "Value is <undefined>")
        else:
            pageutils.ResultTextDialog("Value for " + objType + " '" + name + "'", value)

    def inspectElement(self, path, objType, name, value):
        del self.stack[:]
        self.currentInspection = None
        self.updateInspector(path, objType, name, value)
