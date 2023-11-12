#!/usr/bin/python3

from gi.repository import Gtk
import pageutils

class ModulePage(pageutils.BaseListView):
    def __init__(self, parent):
        store = Gtk.ListStore(int, str, str, str)
        pageutils.BaseListView.__init__(self, store)
        self.parent = parent
        self.selected_path = None

        column = self.create_text_column(0, "ID")
        column.set_cell_data_func(self.renderer_text, self.cell_data_func_id)
        self.create_text_column(1, "Title")
        self.create_text_column(2, "WMClass")
        self.create_text_column(3, "Application")

        self.parent.lg_proxy.connect("signal::window-list-update", self.get_updates)
        self.parent.lg_proxy.connect("status-changed", self.on_status_change)

        self.tree_view.connect("row-activated", self.on_row_activated)
        self.tree_view.connect("button-press-event", self.on_button_press)

        # Popup menu
        self.popup = Gtk.Menu()

        inspect_window = Gtk.MenuItem('Inspect Window')
        label = inspect_window.get_children()[0]
        label.set_markup("<b>" + inspect_window.get_label() + "</b>")
        inspect_window.connect("activate", self.on_inspect_window)
        self.popup.append(inspect_window)

        self.inspect_app = Gtk.MenuItem('Inspect Application')
        self.inspect_app.connect("activate", self.on_inspect_application)
        self.popup.append(self.inspect_app)
        self.popup.show_all()

    def cell_data_func_id(self, column, cell, model, tree_iter, data=None):
        value = model.get_value(tree_iter, 0)
        cell.set_property("text", "w(%d) / a(%d)" %  (value, value))

    def on_row_activated(self, treeview, path, view_column):
        tree_iter = self.store.get_iter(path)
        obj_id = self.store.get_value(tree_iter, 0)
        title = self.store.get_value(tree_iter, 1)

        self.parent.pages["inspect"].inspect_element("w(%d)" % obj_id, "object", title, "<window>")

    def on_inspect_window(self, menu_item):
        tree_iter = self.store.get_iter(self.selected_path)
        obj_id = self.store.get_value(tree_iter, 0)
        title = self.store.get_value(tree_iter, 1)

        self.parent.pages["inspect"].inspect_element("w(%d)" % obj_id, "object", title, "<window>")

    def on_inspect_application(self, menu_item):
        tree_iter = self.store.get_iter(self.selected_path)
        obj_id = self.store.get_value(tree_iter, 0)
        application = self.store.get_value(tree_iter, 3)

        self.parent.pages["inspect"].inspect_element("a(%d)" % obj_id,
                                                     "object",
                                                     application,
                                                     "<application>")

    def on_button_press(self, treeview, event):
        if event.button == 3:
            x = int(event.x)
            y = int(event.y)
            pthinfo = treeview.get_path_at_pos(x, y)
            if pthinfo is not None:
                path, col, cellx, celly = pthinfo
                self.selected_path = path
                treeview.grab_focus()
                treeview.set_cursor(path, col, 0)

                tree_iter = self.store.get_iter(self.selected_path)
                app = self.store.get_value(tree_iter, 3)

                self.inspect_app.set_sensitive(app != "<untracked>")
                self.popup.popup(None, None, None, None, event.button, event.time)
            return True

    def on_status_change(self, proxy, online):
        if online:
            self.get_updates()

    def get_updates(self, proxy=None):
        self.store.clear()
        success, data = self.parent.lg_proxy.GetLatestWindowList()
        if success:
            try:
                for item in data:
                    self.store.append([int(item["id"]),
                                       item["title"],
                                       item["wmclass"],
                                       item["app"]])
            except Exception as exc:
                print(exc)
