#!/usr/bin/python3

from gi.repository import Gtk
import pageutils

class InspectView(pageutils.BaseListView):
    def __init__(self, module):
        self.module = module
        store = Gtk.ListStore(str, str, str, str, str)
        pageutils.BaseListView.__init__(self, store)

        self.selected_path = None

        self.create_text_column(0, "Name")
        self.create_text_column(1, "Type")
        self.create_text_column(2, "Value")

        self.popup = Gtk.Menu()
        self.insert_command = Gtk.MenuItem("Insert into command entry")
        self.insert_command.connect("activate", self.on_insert_command)
        self.popup.append(self.insert_command)
        self.popup.show_all()

        self.tree_view.connect("button-press-event", self.on_button_press_event)
        self.tree_view.connect("row-activated", self.on_row_activated)

    def on_button_press_event(self, treeview, event):
        x = int(event.x)
        y = int(event.y)
        pthinfo = treeview.get_path_at_pos(x, y)
        if pthinfo is not None and event.button == 3:
            path, col, cellx, celly = pthinfo
            self.selected_path = path
            treeview.grab_focus()
            treeview.set_cursor(path, col, 0)
            self.popup.popup(None, None, None, None, event.button, event.time)
            return True

    def on_insert_command(self, widget):
        tree_iter = self.store.get_iter(self.selected_path)
        obj_type = self.store.get_value(tree_iter, 1)
        obj_path = self.store.get_value(tree_iter, 4)
        if obj_type == "function":
            obj_path += "()"
        Gtk.Entry.do_insert_at_cursor(self.module.parent.command_line, obj_path)
        self.module.parent.command_line.grab_focus_without_selecting()

    def on_row_activated(self, treeview, path, view_column):
        tree_iter = self.store.get_iter(path)
        name = self.store.get_value(tree_iter, 0)
        obj_type = self.store.get_value(tree_iter, 1)
        value = self.store.get_value(tree_iter, 3)
        path = self.store.get_value(tree_iter, 4)

        self.module.update_inspector(path, obj_type, name, value, True)

    def set_inspection_data(self, path, data):
        self.store.clear()
        data.sort(key=lambda item: item["name"])
        for item in data:
            self.store.append([item["name"],
                               item["type"],
                               pageutils.shorten_value(item["value"]),
                               item["value"],
                               path + "['" + item["name"] + "']"])

class ModulePage(pageutils.WindowAndActionBars):
    def __init__(self, parent):
        self.view = InspectView(self)
        pageutils.WindowAndActionBars.__init__(self, self.view)
        self.parent = parent

        self.back = pageutils.ImageButton("go-previous-symbolic")
        self.back.set_tooltip_text("Go back")
        self.back.connect("clicked", self.on_back_button)
        self.add_to_left_bar(self.back, 1)

        self.insert = pageutils.ImageButton("insert-object-symbolic")
        self.insert.set_tooltip_text("Insert into results")
        self.insert.set_sensitive(False)
        self.insert.connect("clicked", self.on_insert_button)
        self.add_to_left_bar(self.insert, 1)

        self.add_to_bottom_bar(Gtk.Label("Path:"), 2)
        self.path_label = Gtk.Label("<No selection done yet>")
        self.add_to_bottom_bar(self.path_label, 2)

        self.add_to_bottom_bar(Gtk.Label("; Type:"), 2)
        self.type_label = Gtk.Label("")
        self.add_to_bottom_bar(self.type_label, 2)
        self.add_to_bottom_bar(Gtk.Label("; Name:"), 2)
        self.name_label = Gtk.Label("")
        self.add_to_bottom_bar(self.name_label, 2)

        self.current_inspection = None
        self.stack = []
        self.parent.lg_proxy.connect("status-changed", self.on_status_change)

    def on_status_change(self, proxy, online):
        if online:
            self.clear()

    def clear(self):
        self.path_label.set_text("<No selection done yet>")
        self.type_label.set_text("")
        self.name_label.set_text("")
        self.view.store.clear()

    def on_insert_button(self, widget):
        if len(self.stack) > 0:
            path, obj_type, name, value = self.current_inspection
            self.parent.lg_proxy.AddResult(path)

    def on_back_button(self, widget):
        if len(self.stack) > 0:
            self.pop_inspection_element()
        else:
            self.parent.activate_page("results")


    def pop_inspection_element(self):
        if len(self.stack) > 0:
            self.update_inspector(*self.stack.pop())

        sensitive = len(self.stack) > 0
        self.insert.set_sensitive(sensitive)

    def push_inspection_element(self):
        if self.current_inspection is not None:
            self.stack.append(self.current_inspection)
            self.insert.set_sensitive(True)

    def update_inspector(self, path, obj_type, name, value, push_to_stack=False):
        if obj_type in ("array", "object"):
            if push_to_stack:
                self.push_inspection_element()

            self.current_inspection = (path, obj_type, name, value)

            self.path_label.set_text(path)
            self.type_label.set_text(obj_type)
            self.name_label.set_text(name)

            self.parent.activate_page("inspect")
            self.parent.lg_proxy.Inspect(path, result_cb=self.inspect_finish_cb, user_data=path)
        elif obj_type in ("undefined", "null"):
            pageutils.ResultTextDialog("Value for '" + name + "'", "Value is <" + obj_type + ">")
        else:
            pageutils.ResultTextDialog("Value for " + obj_type + " '" + name + "'", value)

    def inspect_finish_cb(self, proxy, result, path):
        [success, data] = result
        if success:
            try:
                self.view.set_inspection_data(path, data)
            except Exception as e:
                print("Inspect:", e)
                self.view.store.clear()
        else:
            self.view.store.clear()

    def inspect_element(self, path, obj_type, name, value):
        del self.stack[:]
        self.current_inspection = None
        self.insert.set_sensitive(False)
        self.update_inspector(path, obj_type, name, value)
