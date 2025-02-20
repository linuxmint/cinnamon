#!/usr/bin/python3

from gi.repository import Gtk
import pageutils

class ModulePage(pageutils.BaseListView):
    def __init__(self, parent):
        store = Gtk.ListStore(int, str, str, str, str, str)
        pageutils.BaseListView.__init__(self, store)

        self.parent = parent
        self.adjust = self.get_vadjustment()

        column = self.create_text_column(0, "ID")
        column.set_cell_data_func(self.renderer_text, self.cell_data_func_id)
        self.create_text_column(1, "Name")
        self.create_text_column(2, "Type")
        self.create_text_column(3, "Value")
        self.tree_view.set_tooltip_column(4)

        self.tree_view.connect("row-activated", self.on_row_activated)

        self.parent.lg_proxy.connect("signal::result-update", self.get_updates)
        self.parent.lg_proxy.connect("signal::inspector-done", self.on_inspector_done)
        self.parent.lg_proxy.connect("status-changed", self.on_status_change)

        self._changed = False
        self.tree_view.connect("size-allocate", self.scroll_to_bottom)

    def scroll_to_bottom(self, widget, data):
        if self._changed:
            self.adjust.set_value(self.adjust.get_upper() - self.adjust.get_page_size())
            self._changed = False

    def cell_data_func_id(self, column, cell, model, tree_iter, data=None):
        cell.set_property("text", "r(%d)" %  model.get_value(tree_iter, 0))

    def on_row_activated(self, treeview, path, view_column):
        tree_iter = self.store.get_iter(path)
        result_id = self.store.get_value(tree_iter, 0)
        name = self.store.get_value(tree_iter, 1)
        obj_type = self.store.get_value(tree_iter, 2)
        value = self.store.get_value(tree_iter, 5)

        self.parent.pages["inspect"].inspect_element("r(%d)" % result_id, obj_type, name, value)

    def on_status_change(self, proxy, online):
        if online:
            self.get_updates()

    def get_updates(self, proxy=None):
        self.store.clear()
        success, data = self.parent.lg_proxy.GetResults()
        if success:
            try:
                for item in data:
                    self.store.append([int(item["index"]),
                                       item["command"],
                                       item["type"],
                                       pageutils.shorten_value(item["object"]),
                                       item["tooltip"],
                                       item["object"]])
                self._changed = True
            except Exception as exc:
                print(exc)

    def on_inspector_done(self, proxy=None):
        self.parent.show()
        self.parent.activate_page("results")
        self.get_updates()
