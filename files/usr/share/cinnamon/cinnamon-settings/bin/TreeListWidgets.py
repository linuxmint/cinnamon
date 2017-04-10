#!/usr/bin/python

import gi
gi.require_version('Gtk', '3.0')
from gi.repository import Gtk
from SettingsWidgets import *

VARIABLE_TYPE_MAP = {
    "string"        :   str,
    "file"          :   str,
    "icon"          :   str,
    "sound"         :   str,
    "keybinding"    :   str,
    "integer"       :   int,
    "float"         :   float,
    "boolean"       :   bool
}

CLASS_TYPE_MAP = {
    "string"        :   Entry,
    "file"          :   FileChooser,
    "icon"          :   IconChooser,
    "sound"         :   SoundFileChooser,
    "keybinding"    :   Keybinding,
    "integer"       :   SpinButton,
    "float"         :   SpinButton,
    "boolean"       :   Switch
}

PROPERTIES_MAP = {
    "title"         : "label",
    "min"           : "mini",
    "max"           : "maxi",
    "step"          : "step",
    "units"         : "units",
    "select-dir"    : "dir_select",
    "expand-width"  : "expand_width"
}

def list_edit_factory(options):
    class Widget(CLASS_TYPE_MAP[options["type"]]):
        def __init__(self, **kwargs):
            super(Widget, self).__init__(**kwargs)

            if self.bind_dir is None:
                self.connect_widget_handlers()

        def get_range(self):
            return None

        def set_value(self, value):
            self.widget_value = value

        def get_value(self):
            if hasattr(self, "widget_value"):
                return self.widget_value
            else:
                return None

        def set_widget_value(self, value):
            if self.bind_dir is None:
                self.widget_value = value
                self.on_setting_changed()
            else:
                if hasattr(self, "bind_object"):
                    self.bind_object.set_property(self.bind_prop, value)
                else:
                    self.content_widget.set_property(self.bind_prop, value)

        def get_widget_value(self):
            if self.bind_dir is None:
                try:
                    return self.widget_value
                except Exception as e:
                    return None
            else:
                if hasattr(self, "bind_object"):
                    return self.bind_object.get_property(self.bind_prop)
                return self.content_widget.get_property(self.bind_prop)

    kwargs = {}
    for prop in options:
        if prop in PROPERTIES_MAP:
            kwargs[PROPERTIES_MAP[prop]] = options[prop]

    return Widget(**kwargs)


class List(SettingsWidget):
    bind_dir = None

    def __init__(self, label=None, columns=None, height=200, size_group=None, dep_key=None, tooltip=""):
        super(List, self).__init__(dep_key=dep_key)
        self.columns = columns

        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(0)
        self.set_margin_left(0)
        self.set_margin_right(0)
        self.set_border_width(0)

        if label is not None:
            self.label = Gtk.Label(label)

        self.content_widget = Gtk.TreeView()

        scrollbox = Gtk.ScrolledWindow()
        scrollbox.set_size_request(-1, height)
        scrollbox.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
        self.pack_start(scrollbox, True, True, 0)
        scrollbox.add(self.content_widget)

        types = []
        tv_columns = []
        for i in range(len(columns)):
            types.append(VARIABLE_TYPE_MAP[columns[i]["type"]])
            renderer = Gtk.CellRendererText()
            column = Gtk.TreeViewColumn(columns[i]["title"], renderer, text=i)
            column.set_resizable(True)
            self.content_widget.append_column(column)
        self.model = Gtk.ListStore(*types)
        self.content_widget.set_model(self.model)

        button_toolbar = Gtk.Toolbar()
        button_toolbar.set_icon_size(1)
        Gtk.StyleContext.add_class(Gtk.Widget.get_style_context(button_toolbar), "inline-toolbar")
        self.pack_start(button_toolbar, False, False, 0)

        self.add_button = Gtk.ToolButton(None, None)
        self.add_button.set_icon_name("list-add-symbolic")
        self.add_button.set_tooltip_text(_("Add new entry"))
        self.add_button.connect("clicked", self.add_item)
        self.remove_button = Gtk.ToolButton(None, None)
        self.remove_button.set_icon_name("list-remove-symbolic")
        self.remove_button.set_tooltip_text(_("Remove selected entry"))
        self.remove_button.connect("clicked", self.remove_item)
        self.remove_button.set_sensitive(False)
        self.edit_button = Gtk.ToolButton(None, None)
        self.edit_button.set_icon_name("list-edit-symbolic")
        self.edit_button.set_tooltip_text(_("Edit selected entry"))
        self.edit_button.connect("clicked", self.edit_item)
        self.edit_button.set_sensitive(False)
        self.move_up_button = Gtk.ToolButton(None, None)
        self.move_up_button.set_icon_name("go-up-symbolic")
        self.move_up_button.set_tooltip_text(_("Move selected entry up"))
        self.move_up_button.connect("clicked", self.move_item_up)
        self.move_up_button.set_sensitive(False)
        self.move_down_button = Gtk.ToolButton(None, None)
        self.move_down_button.set_icon_name("go-down-symbolic")
        self.move_down_button.set_tooltip_text(_("Move selected entry down"))
        self.move_down_button.connect("clicked", self.move_item_down)
        self.move_down_button.set_sensitive(False)
        button_toolbar.insert(self.add_button, 0)
        button_toolbar.insert(self.remove_button, 1)
        button_toolbar.insert(self.edit_button, 2)
        button_toolbar.insert(self.move_up_button, 3)
        button_toolbar.insert(self.move_down_button, 4)

        self.content_widget.get_selection().connect("changed", self.update_button_sensitivity)

        self.set_tooltip_text(tooltip)

    def update_button_sensitivity(self, *args):
        model, selected = self.content_widget.get_selection().get_selected()
        if selected is None:
            self.remove_button.set_sensitive(False)
            self.edit_button.set_sensitive(False)
        else:
            self.remove_button.set_sensitive(True)
            self.edit_button.set_sensitive(True)

        if selected is None or model.iter_previous(selected) is None:
            self.move_up_button.set_sensitive(False)
        else:
            self.move_up_button.set_sensitive(True)

        if selected is None or model.iter_next(selected) is None:
            self.move_down_button.set_sensitive(False)
        else:
            self.move_down_button.set_sensitive(True)

    def add_item(self, *args):
        data = self.open_add_edit_dialog()
        if data is not None:
            self.model.append(data)
            self.list_changed()

    def remove_item(self, *args):
        model, t_iter = self.content_widget.get_selection().get_selected()
        model.remove(t_iter)

        self.list_changed()

    def edit_item(self, *args):
        model, t_iter = self.content_widget.get_selection().get_selected()
        data = self.open_add_edit_dialog(model[t_iter])
        if data is not None:
            for i in range(len(data)):
                self.model[t_iter][i] = data[i]
            self.list_changed()

    def move_item_up(self, *args):
        model, t_iter = self.content_widget.get_selection().get_selected()
        model.swap(t_iter, model.iter_previous(t_iter))
        self.list_changed()

    def move_item_down(self, *args):
        model, t_iter = self.content_widget.get_selection().get_selected()
        model.swap(t_iter, model.iter_next(t_iter))
        self.list_changed()

    def open_add_edit_dialog(self, info=None):
        if info is None:
            title = _("Add new entry")
        else:
            title = _("Edit entry")
        dialog = Gtk.Dialog(title, self.get_toplevel(), Gtk.DialogFlags.MODAL,
                            (Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL,
                             Gtk.STOCK_OK, Gtk.ResponseType.OK))

        content_area = dialog.get_content_area()
        content_area.set_margin_right(30)
        content_area.set_margin_left(30)
        content_area.set_margin_top(20)
        content_area.set_margin_bottom(20)

        frame = Gtk.Frame()
        frame.set_shadow_type(Gtk.ShadowType.IN)
        frame_style = frame.get_style_context()
        frame_style.add_class("view")
        content_area.add(frame)

        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        frame.add(content)

        widgets = []
        for i in range(len(self.columns)):
            if len(widgets) != 0:
                content.add(Gtk.Separator(orientation=Gtk.Orientation.HORIZONTAL))

            widget = list_edit_factory(self.columns[i])
            widgets.append(widget)

            settings_box = Gtk.ListBox()
            settings_box.set_selection_mode(Gtk.SelectionMode.NONE)

            content.pack_start(settings_box, True, True, 0)
            settings_box.add(widget)

            if info is not None and info[i] is not None:
                widget.set_widget_value(info[i])
            elif "default" in self.columns[i]:
                widget.set_widget_value(self.columns[i]["default"])

        content_area.show_all()
        response = dialog.run()

        if response == Gtk.ResponseType.OK:
            values = []
            for widget in widgets:
                values.append(widget.get_widget_value())

            dialog.destroy()
            return values

        dialog.destroy()
        return None

    def list_changed(self, *args):
        data = []
        for row in self.model:
            i = 0
            row_info = {}
            for column in self.columns:
                row_info[column["id"]] = row[i]
                i += 1
            data.append(row_info)

        self.set_value(data)
        self.update_button_sensitivity()

    def on_setting_changed(self, *args):
        self.model.clear()
        rows = self.get_value()
        for row in rows:
            row_info = []
            for column in self.columns:
                cid = column["id"]
                if cid in row:
                    row_info.append(row[column["id"]])
                elif "default" in column:
                    row_info.append(column["default"])
                else:
                    row_info.append(None)
            self.model.append(row_info)

        self.content_widget.columns_autosize()

    def connect_widget_handlers(self, *args):
        pass

