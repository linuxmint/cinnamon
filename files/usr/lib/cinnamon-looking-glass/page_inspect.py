from pageutils import *
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib

class InspectView(BaseListView):
    def __init__(self, parent):
        self.parent = parent
        store = Gtk.ListStore(str, str, str, str, str)
        BaseListView.__init__(self, store)

        self.createTextColumn(0, "Name")
        self.createTextColumn(1, "Type")
        self.createTextColumn(2, "Value")

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

class ModulePage(WindowAndActionBars):
    def __init__(self, parent):
        self.view = InspectView(self)
        WindowAndActionBars.__init__(self, self.view)
        self.parent = parent

        self.back = ImageButton("back")
        self.back.set_tooltip_text("Go back")
        self.back.set_sensitive(False)
        self.back.connect("clicked", self.onBackButton)
        self.addToLeftBar(self.back, 1)

        self.insert = ImageButton("insert-object")
        self.insert.set_tooltip_text("Insert into results")
        self.insert.set_sensitive(False)
        self.insert.connect("clicked", self.onInsertButton)
        self.addToLeftBar(self.insert, 1)

        self.addToBottomBar(Gtk.Label("Path:"), 2)
        self.pathLabel = Gtk.Label("<No selection done yet>")
        self.addToBottomBar(self.pathLabel, 2)

        self.addToBottomBar(Gtk.Label("; Type:"), 2)
        self.typeLabel = Gtk.Label("")
        self.addToBottomBar(self.typeLabel, 2)
        self.addToBottomBar(Gtk.Label("; Name:"), 2)
        self.nameLabel = Gtk.Label("")
        self.addToBottomBar(self.nameLabel, 2)

        self.currentInspection = None
        self.stack = []
        lookingGlassProxy.addStatusChangeCallback(self.onStatusChange)

    def onStatusChange(self, online):
        if online:
            self.clear()

    def clear(self):
        self.pathLabel.set_text("<No selection done yet>")
        self.typeLabel.set_text("")
        self.nameLabel.set_text("")
        self.view.store.clear()

    def onInsertButton(self, widget):
        if len(self.stack) > 0:
            path, objType, name, value = self.currentInspection
            lookingGlassProxy.AddResult(path)

    def onBackButton(self, widget):
        self.popInspectionElement()

    def popInspectionElement(self):
        if len(self.stack) > 0:
            self.updateInspector(*self.stack.pop())

        sensitive = len(self.stack) > 0
        self.back.set_sensitive(sensitive)
        self.insert.set_sensitive(sensitive)

    def pushInspectionElement(self):
        if self.currentInspection is not None:
            self.stack.append(self.currentInspection)
            self.back.set_sensitive(True)
            self.insert.set_sensitive(True)

    def updateInspector(self, path, objType, name, value, pushToStack=False):
        if objType == "object":
            if pushToStack:
                self.pushInspectionElement()

            self.currentInspection = (path, objType, name, value)

            self.pathLabel.set_text(path)
            self.typeLabel.set_text(objType)
            self.nameLabel.set_text(name)

            cinnamonLog.activatePage("inspect")
            success, data = lookingGlassProxy.Inspect(path)
            if success:
                try:
                    self.view.setInspectionData(path, data)
                except Exception as e:
                    print e
                    self.view.store.clear()
            else:
                self.view.store.clear()
        elif objType == "undefined":
            ResultTextDialog("Value for '" + name + "'", "Value is <undefined>")
        else:
            ResultTextDialog("Value for " + objType + " '" + name + "'", value)

    def inspectElement(self, path, objType, name, value):
        del self.stack[:]
        self.currentInspection = None
        self.back.set_sensitive(False)
        self.insert.set_sensitive(False)
        self.updateInspector(path, objType, name, value)
