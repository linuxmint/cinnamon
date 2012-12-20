
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
        
class ModulePage(pageutils.TableWindowAndActionBar):
    def __init__(self):
        self.view = InspectView(self)
        pageutils.TableWindowAndActionBar.__init__(self, self.view, 8, 3, 1)
        
        refresh = Gtk.Button("Back")
        refresh.set_tooltip_text("Go back")
        refresh.connect("clicked", self.onBackButton)
        self.addToActionBar(refresh)
        
        self.addToActionBar(Gtk.Label("Path:"))
        self.pathLabel = Gtk.Label("<No selection done yet>")
        self.addToActionBar(self.pathLabel)
        
        self.addToActionBar(Gtk.Label("; Type:"))
        self.typeLabel = Gtk.Label("")
        self.addToActionBar(self.typeLabel)
        self.addToActionBar(Gtk.Label("; Name:"))
        self.nameLabel = Gtk.Label("")
        self.addToActionBar(self.nameLabel)
        
        insert = Gtk.Button("Insert")
        insert.set_tooltip_text("Insert into results")
        insert.connect("clicked", self.onInsertButton)
        self.addToActionBar(insert)
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
