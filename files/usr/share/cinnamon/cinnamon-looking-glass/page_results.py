import pageutils
from gi.repository import Gtk

class ModulePage(pageutils.BaseListView):
    def __init__(self, parent):
        store = Gtk.ListStore(int, str, str, str, str)
        pageutils.BaseListView.__init__(self, store)

        self.parent = parent
        self.adjust = self.get_vadjustment()

        column = self.createTextColumn(0, "ID")
        column.set_cell_data_func(self.rendererText, self.cellDataFuncID)
        self.createTextColumn(1, "Name")
        self.createTextColumn(2, "Type")
        self.createTextColumn(3, "Value")
        self.treeView.set_tooltip_column(4)

        self.treeView.connect("row-activated", self.onRowActivated)

        self.getUpdates()
        lookingGlassProxy.connect("ResultUpdate", self.getUpdates)
        lookingGlassProxy.connect("InspectorDone", self.onInspectorDone)
        lookingGlassProxy.addStatusChangeCallback(self.onStatusChange)

        self._changed = False
        self.treeView.connect("size-allocate", self.scrollToBottom)

    def scrollToBottom (self, widget, data):
        if self._changed:
            self.adjust.set_value(self.adjust.get_upper() - self.adjust.get_page_size())
            self._changed = False

    def cellDataFuncID(self, column, cell, model, iter, data=None):
        cell.set_property("text", "r(%d)" %  model.get_value(iter, 0))

    def onRowActivated(self, treeview, path, view_column):
        treeIter = self.store.get_iter(path)
        resultId = self.store.get_value(treeIter, 0)
        name = self.store.get_value(treeIter, 1)
        objType = self.store.get_value(treeIter, 2)
        value = self.store.get_value(treeIter, 3)

        melangeApp.pages["inspect"].inspectElement("r(%d)" % resultId, objType, name, value)

    def onStatusChange(self, online):
        if online:
            self.getUpdates()

    def getUpdates(self):
        self.store.clear()
        success, data = lookingGlassProxy.GetResults()
        if success:
            try:
                for item in data:
                    self.store.append([int(item["index"]), item["command"], item["type"], item["object"], item["tooltip"]])
                self._changed = True
                self.parent.activatePage("results")
            except Exception as e:
                print e

    def onInspectorDone(self):
        melangeApp.show()
        melangeApp.activatePage("results")
        self.getUpdates()
