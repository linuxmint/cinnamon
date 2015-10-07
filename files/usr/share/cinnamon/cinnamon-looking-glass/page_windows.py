from pageutils import *
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib

class ModulePage(BaseListView):
    def __init__(self, parent):
        store = Gtk.ListStore(int, str, str, str)
        BaseListView.__init__(self, store)
        self.parent = parent

        column = self.createTextColumn(0, "ID")
        column.set_cell_data_func(self.rendererText, self.cellDataFuncID)
        self.createTextColumn(1, "Title")
        self.createTextColumn(2, "WMClass")
        self.createTextColumn(3, "Application")

        self.getUpdates()
        lookingGlassProxy.connect("WindowListUpdate", self.getUpdates)
        lookingGlassProxy.addStatusChangeCallback(self.onStatusChange)

        self.treeView.connect("row-activated", self.onRowActivated)
        self.treeView.connect("button-press-event", self.onButtonPress)

        # Popup menu
        self.popup = Gtk.Menu()

        inspectWindow = Gtk.MenuItem('Inspect Window')
        label = inspectWindow.get_children()[0]
        label.set_markup("<b>" + inspectWindow.get_label() + "</b>")
        inspectWindow.connect("activate", self.onInspectWindow)
        self.popup.append(inspectWindow)

        self.inspectApp = Gtk.MenuItem('Inspect Application')
        self.inspectApp.connect("activate", self.onInspectApplication)
        self.popup.append(self.inspectApp)
        self.popup.show_all()

    def cellDataFuncID(self, column, cell, model, iter, data=None):
        value = model.get_value(iter, 0)
        cell.set_property("text", "w(%d) / a(%d)" %  (value, value))

    def onRowActivated(self, treeview, path, view_column):
        iter = self.store.get_iter(path)
        id = self.store.get_value(iter, 0)
        title = self.store.get_value(iter, 1)

        cinnamonLog.pages["inspect"].inspectElement("w(%d)" % id, "object", title, "<window>")

    def onInspectWindow(self, menuItem):
        iter = self.store.get_iter(self.selectedPath)
        id = self.store.get_value(iter, 0)
        title = self.store.get_value(iter, 1)

        cinnamonLog.pages["inspect"].inspectElement("w(%d)" % id, "object", title, "<window>")

    def onInspectApplication(self, menuItem):
        iter = self.store.get_iter(self.selectedPath)
        id = self.store.get_value(iter, 0)
        application = self.store.get_value(iter, 3)

        cinnamonLog.pages["inspect"].inspectElement("a(%d)" % id, "object", application, "<application>")

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

                iter = self.store.get_iter(self.selectedPath)
                app = self.store.get_value(iter, 3)

                self.inspectApp.set_sensitive(app != "<untracked>")
                self.popup.popup( None, None, None, None, event.button, event.time)
            return True

    def onStatusChange(self, online):
        if online:
            self.getUpdates()

    def getUpdates(self):
        self.store.clear()
        success, data = lookingGlassProxy.GetLatestWindowList()
        if success:
            try:
                for item in data:
                    self.store.append([int(item["id"]), item["title"], item["wmclass"], item["app"]])
            except Exception as e:
                print e
