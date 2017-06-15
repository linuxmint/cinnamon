#!/usr/bin/python2

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
    def __init__(self, panel_id, settings, position):
        super(PanelSettingsPage, self).__init__()
        self.set_margin_top(0)
        self.set_margin_bottom(0)
        self.panel_id = panel_id
        self.settings = settings

        if position in ("top", "bottom"):
            dimension_text = _("Panel height:")
            scale_dimension_text = _("Allow Cinnamon to scale panel text and icons according to the panel height")
        else:
            dimension_text = _("Panel width:")
            scale_dimension_text = _("Allow Cinnamon to scale panel text and icons according to the panel width")

        def can_show(vlist, possible):
            for item in vlist:
                if item.split(":")[0] == panel_id:
                    return item.split(":")[1] != "false"

        section = SettingsBox(_("Settings"))
        self.add(section)

        options = [["true", _("Auto hide panel")], ["false", _("Always show panel")], ["intel", _("Intelligently hide panel")]]
        widget = PanelComboBox(_("Auto-hide panel"), "org.cinnamon", "panels-autohide", self.panel_id, options)
        section.add_row(widget)

        widget = PanelSpinButton(_("Show delay"), "org.cinnamon", "panels-show-delay", self.panel_id, _("milliseconds"), 0, 2000, 50, 200)#, dep_key="org.cinnamon/panels-autohide")
        section.add_reveal_row(widget, "org.cinnamon", "panels-autohide", check_func=can_show)

        widget = PanelSpinButton(_("Hide delay"), "org.cinnamon", "panels-hide-delay", self.panel_id, _("milliseconds"), 0, 2000, 50, 200)#, dep_key="org.cinnamon/panels-autohide")
        section.add_reveal_row(widget, "org.cinnamon", "panels-autohide", check_func=can_show)

        widget = PanelSwitch(_("Use customized panel size (otherwise it's defined by the theme)"), "org.cinnamon", "panels-resizable", self.panel_id)
        section.add_row(widget)

        widget = PanelSwitch(scale_dimension_text, "org.cinnamon", "panels-scale-text-icons", self.panel_id)#, "org.cinnamon/panels-resizable")
        section.add_reveal_row(widget, "org.cinnamon", "panels-resizable", check_func=can_show)

        widget = PanelRange(dimension_text, "org.cinnamon", "panels-height", self.panel_id, _("Smaller"), _("Larger"), mini=20, maxi=50, show_value=False)#, dep_key="org.cinnamon/panels-resizable")
        widget.add_mark(25.0, Gtk.PositionType.TOP, None)
        widget.set_rounding(0)
        section.add_reveal_row(widget, "org.cinnamon", "panels-resizable", check_func=can_show)

        self.show_all()

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

            self.settings = Gio.Settings.new("org.cinnamon")

            try:
                if len(sys.argv) > 2 and sys.argv[1] == "panel":
                    self.panel_id = sys.argv[2]
                else:
                    self.panel_id = self.settings.get_strv("panels-enabled")[0].split(":")[0]
            except:
                self.panel_id = ""

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

            if self.panel_id is not None:
                self.proxy.highlightPanel('(ib)', int(self.panel_id), True)

    def on_add_panel(self, widget):
        if self.proxy:
            self.proxy.addPanelQuery()

    def on_previous_panel(self, widget):
        if self.panel_id and self.proxy:
            self.proxy.highlightPanel('(ib)', int(self.panel_id), False)

        current = self.panels.index(self.current_panel)

        if current - 1 >= 0:
            self.current_panel = self.panels[current - 1]
            self.panel_id = self.current_panel.panel_id
        else:
            self.current_panel = self.panels[len(self.panels) - 1]
            self.panel_id = self.current_panel.panel_id

        self.config_stack.set_transition_type(Gtk.StackTransitionType.SLIDE_RIGHT)

        if self.proxy:
            self.proxy.highlightPanel('(ib)', int(self.panel_id), True)

        self.config_stack.set_visible_child(self.current_panel)

    def on_next_panel(self, widget):
        if self.panel_id and self.proxy:
            self.proxy.highlightPanel('(ib)', int(self.panel_id), False)

        current = self.panels.index(self.current_panel)

        if current + 1 < len(self.panels):
            self.current_panel = self.panels[current + 1]
            self.panel_id = self.current_panel.panel_id
        else:
            self.current_panel = self.panels[0]
            self.panel_id = self.current_panel.panel_id

        self.config_stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT)

        if self.proxy:
            self.proxy.highlightPanel('(ib)', int(self.panel_id), True)

        self.config_stack.set_visible_child(self.current_panel)

    def on_panel_list_changed(self, *args):
        if len(self.panels) > 0:
            for panel in self.panels:
                panel.destroy()

        self.panels = []
        monitor_layout = []

        panels = self.settings.get_strv("panels-enabled")
        n_mons = Gdk.Screen.get_default().get_n_monitors()

        for i in range(n_mons):
            monitor_layout.append(Monitor())

        current_found = False
        for panel in panels:
            panel_id, monitor_id, position = panel.split(":")
            monitor_id = int(monitor_id)
            panel_page = PanelSettingsPage(panel_id, self.settings, position)
            self.config_stack.add_named(panel_page, panel_id)

            # we may already have a current panel id from the command line or if
            # if the panels-enabled key changed since everything was loaded
            if panel_id == self.panel_id:
                current_found = True
                self.current_panel = panel_page
                self.config_stack.set_visible_child(panel_page)

            # we don't currently show panels on monitors that aren't attached
            # if we decide to change this behavior, we should probably give some visual indication
            # that the panel is on a detached monitor
            if monitor_id < n_mons:
                if "top" in position:
                    monitor_layout[monitor_id].top = panel_page
                elif "bottom" in position:
                    monitor_layout[monitor_id].bottom = panel_page
                elif "left" in position:
                    monitor_layout[monitor_id].left = panel_page
                else:
                    monitor_layout[monitor_id].right = panel_page

        # Index the panels for the next/previous buttons
        for monitor in monitor_layout:
            for panel_page in (monitor.top, monitor.bottom, monitor.left, monitor.right):
                if panel_page != -1:
                    self.panels.append(panel_page)

        # if there are no panels, there's no point in showing the stack
        if len(self.panels) == 0:
            self.next_button.hide()
            self.previous_button.hide()
            self.config_stack.hide()
            self.add_panel_button.set_sensitive(True)
            self.current_panel = None
            self.panel_id = None
            return

        self.config_stack.show()
        self.next_button.show()
        self.previous_button.show()

        # Disable the panel switch buttons if there's only one panel
        if len(self.panels) == 1:
            self.next_button.set_sensitive(False)
            self.previous_button.set_sensitive(False)
        else:
            self.next_button.set_sensitive(True)
            self.previous_button.set_sensitive(True)

        if not current_found:
            self.current_panel = self.panels[0]
            self.panel_id = self.current_panel.panel_id
            self.config_stack.set_visible_child(self.current_panel)

        self.revealer.set_reveal_child(len(self.panels) != 0)

        # If all panel positions are full, we want to disable the add button
        can_add = False
        for monitor in monitor_layout:
            if -1 in (monitor.top, monitor.bottom, monitor.left, monitor.right):
                can_add = True
                break

        self.add_panel_button.set_sensitive(can_add)

        try:
            current_idx = self.panels.index(self.panel_id)
        except:
            current_idx = 0

        if self.proxy:
            self.proxy.highlightPanel('(ib)', int(self.panel_id), True)

    def restore_panels(self, widget):
        self.proxy.destroyDummyPanels()
        if self.panel_id:
            self.proxy.highlightPanel('(ib)', int(self.panel_id), False)

class PanelWidgetBackend(object):
    def connect_to_settings(self, schema, key):
        self.key = key
        self.settings = Gio.Settings.new(schema)
        self.settings_changed_id = self.settings.connect("changed::"+self.key, self.on_setting_changed)
        self.connect("destroy", self.on_destroy)
        self.on_setting_changed()

        # unless we have a binding direction get, we need to connect the handlers after hooking up the settings
        # this is different from the GSettingsBackend because we cant use a bind here due to the complicated nature
        # of the getting and setting
        if self.bind_dir is None or (self.bind_dir & Gio.SettingsBindFlags.GET == 0):
            self.connect_widget_handlers()

    def set_value(self, value):
        vals = self.settings[self.key]
        newvals = []
        for val in vals:
            if val.split(":")[0] == self.panel_id:
                newvals.append(self.panel_id + ":" + self.stringify(value))
            else:
                newvals.append(val)
        self.settings[self.key] = newvals

    def get_value(self):
        vals = self.settings[self.key]
        for val in vals:
            [pid, value] = val.split(":")
            if pid == self.panel_id:
                return self.unstringify(value)

    def stringify(self, value):
        return str(value)

    def on_destroy(self, *args):
        self.settings.disconnect(self.settings_changed_id)

class PanelSwitch(Switch, PanelWidgetBackend):
    def __init__(self, label, schema, key, panel_id, *args, **kwargs):
        self.panel_id = panel_id
        super(PanelSwitch, self).__init__(label, *args, **kwargs)

        self.connect_to_settings(schema, key)

    def stringify(self, value):
        return "true" if value else "false"

    def unstringify(self, value):
        return value != "false"

    def on_setting_changed(self, *args):
        value = self.get_value()
        if value != self.content_widget.get_active():
            self.content_widget.set_active(value)

    def connect_widget_handlers(self, *args):
        self.content_widget.connect("notify::active", self.on_my_value_changed)

    def on_my_value_changed(self, *args):
        active = self.content_widget.get_active()
        if self.get_value() != active:
            self.set_value(active)

class PanelSpinButton(SpinButton, PanelWidgetBackend):
    def __init__(self, label, schema, key, panel_id, *args, **kwargs):
        self.panel_id = panel_id
        super(PanelSpinButton, self).__init__(label, *args, **kwargs)

        self.content_widget.set_value(0)

        self.connect_to_settings(schema, key)

    def get_range(self):
        return None

    # We use integer directly here because that is all the panel currently uses.
    # If that changes in the future, we will need to fix this.
    def stringify(self, value):
        return str(int(value))

    def unstringify(self, value):
        return int(value)

    def on_setting_changed(self, *args):
        value = self.get_value()
        if value != int(self.content_widget.get_value()):
            self.content_widget.set_value(value)

class PanelComboBox(ComboBox, PanelWidgetBackend):
    def __init__(self, label, schema, key, panel_id, *args, **kwargs):
        self.panel_id = panel_id
        super(PanelComboBox, self).__init__(label, *args, **kwargs)

        self.connect_to_settings(schema, key)

    def stringify(self, value):
        return value

    def unstringify(self, value):
        return value

class PanelRange(Range, PanelWidgetBackend):
    def __init__(self, label, schema, key, panel_id, *args, **kwargs):
        self.panel_id = panel_id
        super(PanelRange, self).__init__(label, *args, **kwargs)

        self.connect_to_settings(schema, key)

    def get_range(self):
        return None

    # We use integer directly here because that is all the panel currently uses.
    # If that changes in the future, we will need to fix this.
    def stringify(self, value):
        return str(int(value))

    def unstringify(self, value):
        return int(value)

    def on_setting_changed(self, *args):
        value = self.get_value()
        if value != int(self.bind_object.get_value()):
            self.bind_object.set_value(value)
