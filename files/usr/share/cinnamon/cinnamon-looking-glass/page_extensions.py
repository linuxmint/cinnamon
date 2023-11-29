#!/usr/bin/python3

import os
from gi.repository import Gtk, Gdk
import pageutils

class ModulePage(pageutils.BaseListView):
    def __init__(self, parent):
        store = Gtk.ListStore(str, str, str, str, str, str, str, bool, str)
        pageutils.BaseListView.__init__(self, store)
        self.parent = parent
        self.selected_path = None

        self.create_text_column(0, "Status")
        self.create_text_column(1, "Type")
        self.create_text_column(2, "Name")
        self.create_text_column(3, "Description")
        parent.lg_proxy.connect("signal::extension-list-update", self.get_updates)
        parent.lg_proxy.connect("status-changed", self.on_status_change)
        self.tree_view.set_tooltip_column(8)

        self.popup = Gtk.Menu()

        self.view_source = Gtk.MenuItem('View Source')
        self.view_source.connect("activate", self.on_view_source)
        self.popup.append(self.view_source)

        reload_code = Gtk.MenuItem('Reload Code')
        reload_code.connect("activate", self.on_reload_code)
        self.popup.append(reload_code)

        self.view_web_page = Gtk.MenuItem('View Web Page')
        self.view_web_page.connect("activate", self.on_view_web_page)
        self.popup.append(self.view_web_page)

        self.popup.show_all()

        self.tree_view.connect("button-press-event", self.on_button_press_event)

    def on_view_source(self, menu_item):
        tree_iter = self.store.get_iter(self.selected_path)
        folder = self.store.get_value(tree_iter, 5)
        os.system("xdg-open \"" + folder + "\" &")

    def on_reload_code(self, menu_item):
        tree_iter = self.store.get_iter(self.selected_path)
        uuid = self.store.get_value(tree_iter, 4)
        xlet_type = self.store.get_value(tree_iter, 1)
        self.parent.lg_proxy.ReloadExtension(uuid, xlet_type.upper())

    def on_view_web_page(self, menu_item):
        tree_iter = self.store.get_iter(self.selected_path)
        url = self.store.get_value(tree_iter, 6)
        os.system("xdg-open \"" + url + "\" &")

    def on_button_press_event(self, treeview, event):
        x = int(event.x)
        y = int(event.y)
        pthinfo = treeview.get_path_at_pos(x, y)
        if pthinfo is not None:
            path, col, cellx, celly = pthinfo
            self.selected_path = path
            treeview.grab_focus()
            treeview.set_cursor(path, col, 0)

            tree_iter = self.store.get_iter(self.selected_path)

        if event.button == 3:
            if pthinfo is not None:
                uuid = self.store.get_value(tree_iter, 4)
                url = self.store.get_value(tree_iter, 6)

                self.view_web_page.set_sensitive(url != "")
                self.view_source.set_label(uuid + " (View Source)")
                self.popup.popup(None, None, None, None, event.button, event.time)
            return True
        elif event.type == Gdk.EventType.DOUBLE_BUTTON_PRESS:
            if pthinfo is not None:
                error = self.store.get_value(tree_iter, 7)
                if error:
                    self.parent.activate_page("log")

    def on_status_change(self, proxy, online):
        if online:
            self.get_updates()

    def get_updates(self, proxy=None):
        success, data = self.parent.lg_proxy.GetExtensionList()
        if success:
            self.store.clear()
            for item in data:
                self.store.append([item["status"],
                                   item["type"],
                                   item["name"],
                                   item["description"],
                                   item["uuid"],
                                   item["folder"],
                                   item["url"],
                                   item["error"] == "true",
                                   item["error_message"]])
