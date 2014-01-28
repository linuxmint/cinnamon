#!/usr/bin/env python
import sys
import dbus
from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("panel")
        advanced = False
        sidePage = PanelViewSidePage(_("Panels"), "panel.svg", keywords, advanced, content_box)
        self.sidePage = sidePage
        self.name = "panel"
        self.category = "prefs"
        self.comment = _("Manage Cinnamon panel settings")


class PanelViewSidePage (SidePage):
    def __init__(self, name, icon, keywords, advanced, content_box):
        SidePage.__init__(self, name, icon, keywords, advanced, content_box)
        self.icons = []
        self.settings = Gio.Settings.new("org.cinnamon");
        self.settings.connect("changed::panels-enabled", self.on_panel_list_changed)
        self.model = Gtk.ListStore(str, str)
        self.highlight_function = dbus.SessionBus().get_object("org.Cinnamon", "/org/Cinnamon").get_dbus_method("highlightPanel", "org.Cinnamon")

    def build(self, advanced):
        # Clear all the widgets from the content box
        widgets = self.content_box.get_children()
        for widget in widgets:
            self.content_box.remove(widget)

        self.panel_id = None
        if len(sys.argv) > 2:
            self.panel_id = sys.argv[2]

        self.combo_box = Gtk.ComboBox.new_with_model(self.model)
        renderer_text = Gtk.CellRendererText()
        self.combo_box.pack_start(renderer_text, True)
        self.combo_box.add_attribute(renderer_text, "text", 1)
        self.combo_box.set_id_column(0)
        frame = Gtk.Frame.new("")
        self.content_box.pack_start(self.combo_box, False, False, 2)
        self.content_box.pack_start(frame, True, True, 2)

        self.widget_box = Gtk.Box.new(Gtk.Orientation.VERTICAL, 2)
        frame.add(self.widget_box)

        self.widgets = []
        widget = PanelCheckButton(_("Auto-hide panel"), "org.cinnamon", "panels-autohide", None, self.panel_id)
        self.widgets.append(widget)
        self.widget_box.pack_start(widget, False, False, 2)


        box = IndentedHBox()
        widget = PanelSpinButton(_("Show delay"), "org.cinnamon", "panels-show-delay", "org.cinnamon/panels-autohide", 0, 2000, 50, 200, _("milliseconds"), self.panel_id)
        box.add(widget)
        self.widget_box.pack_start(box, False, False, 2)
        self.widgets.append(widget)

        box = IndentedHBox()
        widget = PanelSpinButton(_("Hide delay"), "org.cinnamon", "panels-hide-delay", "org.cinnamon/panels-autohide", 0, 2000, 50, 200, _("milliseconds"), self.panel_id)
        box.add(widget)
        self.widget_box.pack_start(box, False, False, 2)
        self.widgets.append(widget)

        widget = PanelCheckButton(_("Use customized panel size (otherwise it's defined by the theme)"), "org.cinnamon", "panels-resizable", None, self.panel_id)
        self.widgets.append(widget)
        self.widget_box.pack_start(widget, False, False, 2)

        box = IndentedHBox()
        widget = PanelCheckButton(_("Allow Cinnamon to scale panel text and icons according to the panel heights"), "org.cinnamon", "panels-scale-text-icons", "org.cinnamon/panels-resizable", self.panel_id)
        box.add(widget)
        self.widgets.append(widget)
        self.widget_box.pack_start(box, False, False, 2)

        box = IndentedHBox()
        widget = PanelSpinButton(_("Panel height"), "org.cinnamon", "panels-height", "org.cinnamon/panels-resizable", 0, 2000, 1, 5, _("Pixels"), self.panel_id)
        box.add(widget)
        self.widgets.append(widget)
        self.widget_box.pack_start(box, False, False, 2)

        self.content_box.show_all()

        self.combo_box.connect("changed", self.on_combo_box_changed)
        # Widget is only hidden when switching panels
        self.combo_box.connect("hide", self.on_combo_box_destroy)
        self.combo_box.connect("destroy", self.on_combo_box_destroy)

        self.on_panel_list_changed("org.cinnamon", "panels-enabled")

    def on_panel_list_changed(self, schema, key):
        self.model.clear()
        panels = self.settings.get_strv("panels-enabled")

        selected = None
        for panel in panels:
            titer = self.model.insert_before(None, None)
            panel_id = panel.split(":")[0]
            self.model.set_value(titer, 0, panel_id)
            self.model.set_value(titer, 1, "Panel " + panel_id)
            if panel_id == self.panel_id:
                selected = titer

        if not selected:
            selected = self.model.get_iter_first()

        self.combo_box.set_active_iter(selected)
        # Settings active iter will trigger on_combo_box_changed and highlight/set panel_id

    def on_combo_box_changed(self, widget):
        if self.panel_id:
            self.highlight_function(int(self.panel_id), False)
        self.panel_id = self.combo_box.get_active_id()
        if self.panel_id:
            self.highlight_function(int(self.panel_id), True)

        for widget in self.widgets:
            widget.set_panel_id(self.panel_id)

    def on_combo_box_destroy(self, widget):
        if self.panel_id:
            self.highlight_function(int(self.panel_id), False)

    def get_property(self, key, value_type):
        values = self.settings.get_strv(key)
        prop = None
        for value in values:
            if value.split(":")[0] == self.panel_id:
                prop = value.split(":")[1]

        if prop:
            if value_type == "b":
                return prop=="true"
            elif value_type == "i":
                return int(prop)
            else:
                return prop

        return None


class PanelCheckButton(Gtk.CheckButton):
    def __init__(self, label, schema, key, dep_key, panel_id):
        self.key = key
        self.dep_key = dep_key
        self.panel_id = panel_id

        super(PanelCheckButton, self).__init__(label)
        self.settings = Gio.Settings.new(schema)
        self.set_active(self.get_boolean(self.settings, self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.connectorId = self.connect('toggled', self.on_my_value_changed)
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

    def on_my_setting_changed(self, settings, key):
        self.disconnect(self.connectorId)                     #  panel-edit-mode can trigger changed:: twice in certain instances,
        self.set_active(self.get_boolean(self.settings, self.key))  #  so disconnect temporarily when we are simply updating the widget state
        self.connectorId = self.connect('toggled', self.on_my_value_changed)

    def on_my_value_changed(self, widget):
        self.set_boolean(self.settings, self.key, self.get_active())

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.get_boolean(self.dep_settings, self.dep_key))
        else:
            self.set_sensitive(not self.get_boolean(self.dep_settings, self.dep_key))

    def get_boolean(self, settings, key):
        values = settings.get_strv(key)
        prop = None
        for value in values:
            if value.split(":")[0] == self.panel_id:
                prop = value.split(":")[1]

        return prop=="true"

    def set_boolean(self, settings, key, value):
        value = "true" if value else "false" # Convert to text

        values = settings.get_strv(key)
        _set = False
        for i in range(len(values)):
            if values[i].split(":")[0] == self.panel_id:
                values[i] = values[i].split(":")[0] + ":" + value
                _set = True
        if not _set:
            values.append(self.panel_id + ":" + value)

        settings.set_strv(key, values)

    def set_panel_id(self, panel_id):
        self.panel_id = panel_id
        self.on_my_setting_changed(None, None)
        if self.dep_key:
            self.on_dependency_setting_changed(None, None)

class PanelSpinButton(Gtk.HBox):
    def __init__(self, label, schema, key, dep_key, min, max, step, page, units, panel_id):
        self.key = key
        self.min = min
        self.max = max
        self.panel_id = panel_id
        self.dep_key = dep_key
        super(PanelSpinButton, self).__init__()
        self.label = Gtk.Label(label)
        self.content_widget = Gtk.SpinButton()
        self.units = Gtk.Label(units)
        if (label != ""):
            self.pack_start(self.label, False, False, 2)
        self.pack_start(self.content_widget, False, False, 2)
        if (units != ""):
            self.pack_start(self.units, False, False, 2)

        self.settings = Gio.Settings.new(schema)

        self.content_widget.set_range(self.min, self.max)
        self.content_widget.set_increments(step, page)
        self.content_widget.set_value(self.get_int(self.settings, self.key))
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        self.content_widget.connect('value-changed', self.on_my_value_changed)
        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)
        self._value_changed_timer = None

    def on_my_setting_changed(self, settings, key):
        self.content_widget.set_value(self.get_int(self.settings, self.key))

    def on_my_value_changed(self, widget):
        if self._value_changed_timer:
            GObject.source_remove(self._value_changed_timer)
        self._value_changed_timer = GObject.timeout_add(300, self.update_settings_value)

    def update_settings_value(self):
        self.set_int(self.settings, self.key, self.content_widget.get_value())
        self._value_changed_timer = None
        return False

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.get_boolean(self.dep_settings, self.dep_key))
        else:
            self.set_sensitive(not self.get_boolean(self.dep_settings, self.dep_key))

    def get_boolean(self, settings, key):
        values = settings.get_strv(key)
        prop = None
        for value in values:
            if value.split(":")[0] == self.panel_id:
                prop = value.split(":")[1]

        return prop=="true"

    def get_int(self, settings, key):
        values = settings.get_strv(key)
        prop = None
        for value in values:
            if value.split(":")[0] == self.panel_id:
                prop = value.split(":")[1]

        if prop:
            return int(prop)

        return 0

    def set_int(self, settings, key, value):
        values = settings.get_strv(key)
        _set = False
        for i in range(len(values)):
            if values[i].split(":")[0] == self.panel_id:
                values[i] = values[i].split(":")[0] + ":" + str(int(value))
                _set = True
        if not _set:
            values.append(self.panel_id + ":" + str(int(value)))

        settings.set_strv(key, values)

    def set_panel_id(self, panel_id):
        self.panel_id = panel_id
        self.on_my_setting_changed(None, None)
        if self.dep_key:
            self.on_dependency_setting_changed(None, None)
