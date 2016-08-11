#!/usr/bin/env python2
#
import sys

import dbus
import gi
gi.require_version('Gtk', '3.0')
from gi.repository import GLib, Gtk, Gdk

from GSettingsWidgets import *


class Monitor:
    def __init__(self):
        self.top = -1
        self.bottom = -1
	self.right = -1
	self.left = -1


class PanelSettingsPage(SettingsPage):
    def __init__(self, panel_id):
        super(PanelSettingsPage, self).__init__()
        self.set_margin_top(0)
        self.set_margin_bottom(0)
        self.widgets = []
        self.panel_id = panel_id

        section = SettingsBox(_("Settings"))
        self.add(section)

        options = [["true", _("Auto hide panel")], ["false", _("Always show panel")], ["intel", _("Intelligently hide panel")]]
        widget = PanelComboBox(_("Auto-hide panel"), "org.cinnamon", "panels-autohide", self.panel_id, options)
        section.add_row(widget)
        self.widgets.append(widget)

        widget = PanelSpinButton(_("Show delay"), "org.cinnamon", "panels-show-delay", self.panel_id, _("milliseconds"), 0, 2000, 50, 200, "org.cinnamon/panels-autohide")
        section.add_reveal_row(widget)
        self.widgets.append(widget)

        widget = PanelSpinButton(_("Hide delay"), "org.cinnamon", "panels-hide-delay", self.panel_id, _("milliseconds"), 0, 2000, 50, 200, "org.cinnamon/panels-autohide")
        section.add_reveal_row(widget)
        self.widgets.append(widget)

        widget = PanelSwitch(_("Use customized panel size (otherwise it's defined by the theme)"), "org.cinnamon", "panels-resizable", self.panel_id)
        section.add_row(widget)
        self.widgets.append(widget)

        widget = PanelSwitch(_("Allow Cinnamon to scale panel text and icons according to the panel heights"), "org.cinnamon", "panels-scale-text-icons", self.panel_id, "org.cinnamon/panels-resizable")
        section.add_reveal_row(widget)
        self.widgets.append(widget)

        widget = PanelRange(_("Panel height:"), "org.cinnamon", "panels-height", self.panel_id, _("Smaller"), _("Larger"), mini=20, maxi=50, dep_key="org.cinnamon/panels-resizable")
        widget.add_mark(25.0, Gtk.PositionType.TOP, None)
        section.add_reveal_row(widget)
        self.widgets.append(widget)

    def set_panel_id(self, panel_id):
        self.panel_id = panel_id
        for widget in self.widgets:
            widget.set_panel_id(self.panel_id)


class Module:
    name = "panel"
    category = "prefs"
    comment = _("Manage Cinnamon panel settings")

    def __init__(self, content_box):
        keywords = _("panel, height, bottom, top, autohide, size, layout")
        self.sidePage = SidePage(_("Panel"), "cs-panel", keywords, content_box, module=self)

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Panel module"

            self.settings = Gio.Settings.new("org.cinnamon");

            try:
                if len(sys.argv) > 2 and sys.argv[1] == "panel":
                    self.panel_id = int(sys.argv[2])
                else:
                    self.panel_id = int(self.settings.get_strv("panels-enabled")[0].split(":")[0])
            except:
                self.panel_id = -1

            self.monitor_layout = []
            self.panels = []

            self.previous_button = Gtk.Button(_("Previous panel"))
            self.next_button = Gtk.Button(_("Next panel"))

            controller = SettingsWidget()
            controller.fill_row()
            controller.pack_start(self.previous_button, False, False, 0)
            controller.pack_end(self.next_button, False, False, 0)
            self.previous_button.connect("clicked", self.on_previous_panel)
            self.next_button.connect("clicked", self.on_next_panel)

            self.revealer = SettingsRevealer()

            page = SettingsPage()
            page.add(controller)
            page.set_margin_bottom(0)
            self.revealer.add(page)
            self.sidePage.add_widget(self.revealer)

            self.config_stack = Gtk.Stack()
            self.config_stack.set_transition_duration(150)
            self.revealer.add(self.config_stack)

            self.pages = [PanelSettingsPage(self.panel_id) for i in range(2)]
            self.config_stack.add_named(self.pages[0], "0")
            self.config_stack.add_named(self.pages[1], "1")

            self.current_visible = self.pages[0]
            self.pending_visible = self.pages[1]
            self.config_stack.set_visible_child(self.current_visible)
            self.current_visible.set_panel_id(self.panel_id)

            page = SettingsPage()
            self.sidePage.add_widget(page)
            section = page.add_section(_("General Panel Options"))

            buttons = SettingsWidget()
            self.add_panel_button = Gtk.Button(label=_("Add new panel"))

            buttons.pack_start(self.add_panel_button, False, False, 2)
            toggle_button = Gtk.ToggleButton(label=_("Panel edit mode"))

            self.settings.bind("panel-edit-mode", toggle_button, "active", Gio.SettingsBindFlags.DEFAULT)
            buttons.pack_end(toggle_button, False, False, 2)
            section.add_row(buttons)

            section.add_row(GSettingsSwitch(_("Allow the pointer to pass through the edges of panels"), "org.cinnamon", "no-adjacent-panel-barriers"))

            self.add_panel_button.set_sensitive(False)

            self.revealer.connect("map", self.on_panel_list_changed)
            self.settings.connect("changed::panels-enabled", self.on_panel_list_changed)

            self.proxy = None

            try:
                Gio.DBusProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE, None,
                                          "org.Cinnamon", "/org/Cinnamon", "org.Cinnamon", None, self._on_proxy_ready, None)
            except dbus.exceptions.DBusException as e:
                print(e)
                self.proxy = None

        self.on_panel_list_changed()

    def _on_proxy_ready (self, object, result, data=None):
        self.proxy = Gio.DBusProxy.new_for_bus_finish(result)

        if not self.proxy.get_name_owner():
            self.proxy = None

        if self.proxy:
            self.revealer.connect("unmap", self.restore_panels)
            self.revealer.connect("destroy", self.restore_panels)

            self.add_panel_button.connect("clicked", self.on_add_panel)
            self.add_panel_button.set_sensitive(True)

            self.proxy.highlightPanel('(ib)', self.panel_id, True)

    def on_add_panel(self, widget):
        self.proxy.addPanelQuery()

    def on_previous_panel(self, widget):
        if self.panel_id and self.proxy:
            self.proxy.highlightPanel('(ib)', self.panel_id, False)

        current = self.panels.index(self.panel_id)

        if current - 1 >= 0:
            self.panel_id = self.panels[current - 1]
        else:
            self.panel_id = self.panels[len(self.panels) - 1]

        self.config_stack.set_transition_type(Gtk.StackTransitionType.SLIDE_RIGHT)

        if self.proxy:
            self.proxy.highlightPanel('(ib)', self.panel_id, True)
        self.pending_visible.set_panel_id(self.panel_id)

        self.pending_visible, self.current_visible = self.current_visible, self.pending_visible
        self.config_stack.set_visible_child(self.current_visible)

    def on_next_panel(self, widget):
        if self.panel_id and self.proxy:
            self.proxy.highlightPanel('(ib)', self.panel_id, False)

        current = self.panels.index(self.panel_id)

        if current + 1 < len(self.panels):
            self.panel_id = self.panels[current + 1]
        else:
            self.panel_id = self.panels[0]

        self.config_stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT)

        if self.proxy:
            self.proxy.highlightPanel('(ib)', self.panel_id, True)
        self.pending_visible.set_panel_id(self.panel_id)

        self.pending_visible, self.current_visible = self.current_visible, self.pending_visible
        self.config_stack.set_visible_child(self.current_visible)

    def on_panel_list_changed(self, *args):
        panels = self.settings.get_strv("panels-enabled")

        n_mons = Gdk.Screen.get_default().get_n_monitors()

        self.monitor_layout = []
        self.panels = []

        for i in range(n_mons):
            self.monitor_layout.append(Monitor())

        for panel in panels:
            panel_id, monitor_id, position = panel.split(":")
            panel_id = int(panel_id)
            monitor_id = int(monitor_id)
            if monitor_id < n_mons:
                if "top" in position:
                    self.monitor_layout[monitor_id].top = panel_id
                elif "bottom" in position:
                    self.monitor_layout[monitor_id].bottom = panel_id
		elif "left" in position:
                    self.monitor_layout[monitor_id].left = panel_id
		else:
                    self.monitor_layout[monitor_id].right = panel_id

        # Index the panels for the next/previous buttons
        for i in range(0, n_mons):
            for j in (self.monitor_layout[i].top, self.monitor_layout[i].bottom, self.monitor_layout[i].left, self.monitor_layout[i].right):
                if j != -1:
                    self.panels.append(j)

        self.revealer.set_reveal_child(len(self.panels) != 0)

        show_add = False
        for i in range(0, n_mons):
            if self.monitor_layout[i].top == -1 or self.monitor_layout[i].bottom == -1 or self.monitor_layout[i].left == -1 or self.monitor_layout[i].right == -1:
                show_add = True
                break
            i += 1

        self.add_panel_button.set_sensitive(show_add)
        self.next_button.set_sensitive(len(self.panels) > 1)
        self.previous_button.set_sensitive(len(self.panels) > 1)

        try:
            current_idx = self.panels.index(self.panel_id)
        except:
            current_idx = 0

        if len(self.panels) == 0:
            return

        if self.panel_id != self.panels[current_idx]:
            if self.proxy:
                self.proxy.highlightPanel('(ib)', self.panel_id, False)
            self.panel_id = self.panels[current_idx]

            self.pending_visible.set_panel_id(self.panel_id)

            self.pending_visible, self.current_visible = self.current_visible, self.pending_visible
            self.config_stack.set_visible_child(self.current_visible)

        if self.proxy:
            self.proxy.highlightPanel('(ib)', self.panel_id, True)

    def restore_panels(self, widget):
        self.proxy.destroyDummyPanels()
        if self.panel_id:
            self.proxy.highlightPanel('(ib)', self.panel_id, False)

class PanelWidget(SettingsWidget):
    def __init__(self, dep_key, panel_id):
        super(PanelWidget, self).__init__()

        self.panel_id = str(panel_id)
        self.dep_key = dep_key

        self.dependency_invert = False
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)

    def get_boolean(self, settings, key):
        values = settings.get_strv(key)
        prop = None
        for value in values:
            if value.split(":")[0] == self.panel_id:
                prop = value.split(":")[1]

        return prop != "false"

    def set_boolean(self, settings, key, value):
        value = "true" if value else "false" # Convert to text

        values = settings.get_strv(key)
        _set = False

        for i, val in enumerate(values):
            if val.split(":")[0] == self.panel_id:
                values[i] = self.panel_id + ":" + value
                _set = True
        if not _set:
            values.append(self.panel_id + ":" + value)

        settings.set_strv(key, values)

    def set_panel_id(self, panel_id):
        self.panel_id = str(panel_id)
        self.on_my_setting_changed(None, None)
        if self.dep_key:
            self.on_dependency_setting_changed()

    def on_dependency_setting_changed(self, *args):
        if not self.dependency_invert:
            self.revealer.set_reveal_child(self.get_boolean(self.dep_settings, self.dep_key))
        else:
            self.revealer.set_reveal_child(not self.get_boolean(self.dep_settings, self.dep_key))

    def get_int(self, settings, key):
        values = settings.get_strv(key)
        prop = 0
        for value in values:
            if value.split(":")[0] == self.panel_id:
                prop = value.split(":")[1]

        return int(prop)

    def set_int(self, settings, key, value):
        values = settings.get_strv(key)
        _set = False
        for i, val in enumerate(values):
            if val.split(":")[0] == self.panel_id:
                values[i] = self.panel_id + ":" + str(int(value))
                _set = True
        if not _set:
            values.append(self.panel_id + ":" + str(int(value)))

        settings.set_strv(key, values)

    def get_string(self, settings, key):
        values = settings.get_strv(key)
        prop = ""
        for value in values:
            if value.split(":")[0] == self.panel_id:
                prop = value.split(":")[1]

        return prop

    def set_string(self, settings, key, value):
        values = settings.get_strv(key)
        _set = False
        for i, val in enumerate(values):
            if val.split(":")[0] == self.panel_id:
                values[i] = self.panel_id + ":" + value
                _set = True
        if not _set:
            values.append(self.panel_id + ":" + value)

        settings.set_strv(key, values)

class PanelSwitch(PanelWidget):
    def __init__(self, label, schema, key, panel_id, dep_key=None):
        super(PanelSwitch, self).__init__(dep_key, panel_id)
        self.key = key

        self.content_widget = Gtk.Switch()
        self.label = Gtk.Label(label)

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.settings = Gio.Settings.new(schema)
        self.connectorId = None

        self.on_my_setting_changed()

    def on_my_setting_changed(self, *args):
        if self.connectorId:
            self.content_widget.disconnect(self.connectorId)                     #  panel-edit-mode can trigger changed:: twice in certain instances,
        self.content_widget.set_active(self.get_boolean(self.settings, self.key))  #  so disconnect temporarily when we are simply updating the widget state
        self.connectorId = self.content_widget.connect("notify::active", self.on_my_value_changed)

    def on_my_value_changed(self, *args):
        self.set_boolean(self.settings, self.key, self.content_widget.get_active())

class PanelSpinButton(PanelWidget):
    def __init__(self, label, schema, key, panel_id, units="", mini=None, maxi=None, step=1, page=None, dep_key=None):
        super(PanelSpinButton, self).__init__(dep_key, panel_id)
        self.key = key
        self._changed_timer = None

        if units:
            label += " (%s)" % units

        self.label = Gtk.Label.new(label)
        self.content_widget = Gtk.SpinButton()

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget, False, False, 0)

        self.settings = Gio.Settings.new(schema)

        if not page:
            page = step

        self.content_widget.set_range(mini, maxi)
        self.content_widget.set_increments(step, page)

        self.settings.connect("changed::" + self.key, self.on_my_setting_changed)
        self.content_widget.connect('value-changed', self.on_my_value_changed)

        self.on_my_setting_changed()

    def on_my_setting_changed(self, *args):
        def apply(self):
            self.content_widget.set_value(self.get_int(self.settings, self.key))
            self._changed_timer = None

        if self._changed_timer:
            GLib.source_remove(self._changed_timer)
        self._changed_timer = GLib.timeout_add(300, apply, self)

    def on_my_value_changed(self, widget):
        def apply(self):
            self.set_int(self.settings, self.key, self.content_widget.get_value())
            self._changed_timer = None

        if self._changed_timer:
            GLib.source_remove(self._changed_timer)
        self._changed_timer = GLib.timeout_add(300, apply, self)

    def update_widget_value(self):
        return False

    def update_settings_value(self):
        return False

class PanelRange(PanelWidget):
    def __init__(self, label, schema, key, panel_id, min_label, max_label, mini=None, maxi=None, step=None, dep_key=None):
        # We do not implement invert and log here since it is not needed
        super(PanelRange, self).__init__(dep_key, panel_id)
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(0)

        self.key = key
        self.settings = Gio.Settings.new(schema)
        self.panel_id = str(panel_id)
        self._changed_timer = None

        hbox = Gtk.Box()

        self.label = Gtk.Label.new(label)
        self.label.set_halign(Gtk.Align.CENTER)

        self.min_label= Gtk.Label()
        self.max_label = Gtk.Label()
        self.min_label.set_alignment(1.0, 0.75)
        self.max_label.set_alignment(1.0, 0.75)
        self.min_label.set_margin_right(6)
        self.max_label.set_margin_left(6)
        self.min_label.set_markup("<i><small>%s</small></i>" % min_label)
        self.max_label.set_markup("<i><small>%s</small></i>" % max_label)

        if step is None:
            self.step = (maxi - mini) * 0.02

        self.content_widget = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, mini, maxi, self.step)
        self.content_widget.set_draw_value(False)

        hbox.pack_start(self.min_label, False, False, 0)
        hbox.pack_start(self.content_widget, True, True, 0)
        hbox.pack_start(self.max_label, False, False, 0)

        self.pack_start(self.label, False, False, 0)
        self.pack_start(hbox, True, True, 6)

        self.content_widget.connect("scroll-event", self.on_scroll_event)

        self.content_widget.connect('value-changed', self.on_my_value_changed)
        self.content_widget.show_all()

    def on_scroll_event(self, widget, event):
        found, delta_x, delta_y = event.get_scroll_deltas()

        # If you scroll up, delta_y < 0. This is a weird world
        widget.set_value(widget.get_value() - delta_y * self.step)

        return True

    def on_my_setting_changed(self, *args):
        def apply(self):
            self.content_widget.set_value(self.get_int(self.settings, self.key))
            self._changed_timer = None

        if self._changed_timer:
            GLib.source_remove(self._changed_timer)
        self._changed_timer = GLib.timeout_add(300, apply, self)

    def on_my_value_changed(self, widget):
        def apply(self):
            self.set_int(self.settings, self.key, self.content_widget.get_value())
            self._changed_timer = None

        if self._changed_timer:
            GLib.source_remove(self._changed_timer)
        self._changed_timer = GLib.timeout_add(300, apply, self)

    def add_mark(self, value, position, markup):
        self.content_widget.add_mark(value, position, markup)

class PanelComboBox(PanelWidget):
    def __init__(self, label, schema, key, panel_id, options, dep_key=None):
        super(PanelComboBox, self).__init__(dep_key, panel_id)

        self.settings = Gio.Settings.new(schema)
        self.key = key
        self.option_map = {}

        self.label = Gtk.Label.new(label)
        self.model = Gtk.ListStore(str, str)

        for option in options:
            iter = self.model.insert_before(None, None)
            option.append(iter)
            self.model.set_value(iter, 0, option[0])
            self.model.set_value(iter, 1, option[1])
            self.option_map[option[0]] = iter

        self.content_widget = Gtk.ComboBox.new_with_model(self.model)
        renderer_text = Gtk.CellRendererText()
        self.content_widget.pack_start(renderer_text, True)
        self.content_widget.add_attribute(renderer_text, "text", 1)

        self.pack_start(self.label, False, False, 2)
        self.pack_end(self.content_widget, False, False, 2)
        self.content_widget.show_all()

        self.content_widget.connect('changed', self.on_my_value_changed)
        self.settings.connect("changed::" + self.key, self.on_my_setting_changed)

        self.on_my_setting_changed()

    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            value = self.model[tree_iter][0]
            self.set_string(self.settings, self.key, value)

    def on_my_setting_changed(self, *args):
        try:
            self.value = self.get_string(self.settings, self.key)
            self.content_widget.set_active_iter(self.option_map[self.value])
        except:
            pass
