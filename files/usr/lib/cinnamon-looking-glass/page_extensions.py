import json
import pageutils
import os
from gi.repository import Gio, Gtk, GObject, Gdk, Pango, GLib

class ModulePage(pageutils.BaseListView):
    def __init__(self):
        store = Gtk.ListStore(str, str, str, str, str, str, str)
        pageutils.BaseListView.__init__(self, store)

        column = self.createTextColumn(0, "Status")
        self.createTextColumn(1, "Type")
        self.createTextColumn(2, "Name")
        self.createTextColumn(3, "Description")
        self.getUpdates()
        dbusManager.connectToCinnamonSignal("lgExtensionListUpdate", self.getUpdates)
        dbusManager.addReconnectCallback(self.getUpdates)

        self.popup = Gtk.Menu()

        self.viewSource = Gtk.MenuItem('View Source')
        self.viewSource.connect("activate", self.onViewSource)
        self.popup.append(self.viewSource)

        reloadCode = Gtk.MenuItem('Reload Code')
        reloadCode.connect("activate", self.onReloadCode)
        self.popup.append(reloadCode)

        self.viewWebPage = Gtk.MenuItem('View Web Page')
        self.viewWebPage.connect("activate", self.onViewWebPage)
        self.popup.append(self.viewWebPage)

        self.popup.show_all()

        self.treeView.connect("button-press-event", self.on_button_press_event)

    def onViewSource(self, menuItem):
        iter = self.store.get_iter(self.selectedPath)
        folder = self.store.get_value(iter, 5)
        os.system("gnome-open \"" + folder + "\" &")

    def onReloadCode(self, menuItem):
        iter = self.store.get_iter(self.selectedPath)
        uuid = self.store.get_value(iter, 4)
        dbusManager.cinnamonDBus.lgReloadExtension(uuid)

    def onViewWebPage(self, menuItem):
        iter = self.store.get_iter(self.selectedPath)
        url = self.store.get_value(iter, 6)
        os.system("gnome-open \"" + url + "\" &")


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

                iter = self.store.get_iter(self.selectedPath)
                uuid = self.store.get_value(iter, 4)
                url = self.store.get_value(iter, 6)

                self.viewWebPage.set_sensitive(url != "")
                self.viewSource.set_label(uuid + " (View Source)")
                self.popup.popup( None, None, None, None, event.button, event.time)
            return True

    def getUpdates(self):
        success, json_data = dbusManager.cinnamonDBus.lgGetExtensionList()
        data = json.loads(json_data)
        self.store.clear()
        for item in data:
            self.store.append([item["status"], item["type"], item["name"], item["description"], item["uuid"], item["folder"], item["url"]])
