#!/usr/bin/env python
import sys
import dbus
from gi.repository import GLib, Gtk, Gdk
from SettingsWidgets import *

class Monitor:
    def __init__(self):
        self.top = -1
        self.bottom = -1

class Module:
    def __init__(self, content_box):
        keywords = _("panel, height, bottom, top, autohide, size, layout")
        sidePage = SidePage(_("Panel"), "cs-panel", keywords, content_box, 450, module=self)
        self.sidePage = sidePage
        self.name = "panel"
        self.category = "prefs"
        self.comment = _("Manage Cinnamon panel settings")

        self.settings = Gio.Settings.new("org.cinnamon");
        self.settings.connect("changed::panels-enabled", self.on_panel_list_changed)
        self.proxy = dbus.SessionBus().get_object("org.Cinnamon", "/org/Cinnamon")

        self.widgets = []
        self.panel_id = None
        try:
            if len(sys.argv) > 2 and sys.argv[1] == "panel":
                self.panel_id = int(sys.argv[2])
            else:
                self.panel_id = int(self.settings.get_strv("panels-enabled")[0].split(":")[0])
        except:
            self.panel_id = -1

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Panel module"

            self.monitor_layout = []
            self.panels = []

            self.panel_bg = SectionBg()
            self.sidePage.add_widget(self.panel_bg)
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            self.panel_bg.add(vbox)

            self.panel_content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)

            self.previous_button = Gtk.Button(_("Previous panel"))
            self.next_button = Gtk.Button(_("Next panel"))

            buttonbox = Gtk.HBox(margin=6)

            buttonbox.pack_start(self.previous_button, False, False, 2)
            buttonbox.pack_start(self.next_button, False, False, 2)

            self.panel_content.add(buttonbox)

            section = Section(_("Auto Hide Options"))

            widget = PanelCheckButton(_("Auto-hide panel"), "org.cinnamon", "panels-autohide", None, self.panel_id)
            section.add(widget)
            self.widgets.append(widget)

            widget = PanelSpinButton(_("Show delay"), "org.cinnamon", "panels-show-delay", "org.cinnamon/panels-autohide", 0, 2000, 50, 200, _("milliseconds"), self.panel_id)
            section.add_indented(widget)
            self.widgets.append(widget)
            
            widget = PanelSpinButton(_("Hide delay"), "org.cinnamon", "panels-hide-delay", "org.cinnamon/panels-autohide", 0, 2000, 50, 200, _("milliseconds"), self.panel_id)
            section.add_indented(widget)
            self.widgets.append(widget)
            self.panel_content.add(section)

            self.panel_content.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

            section = Section(_("Size Options"))

            widget = PanelCheckButton(_("Use customized panel size (otherwise it's defined by the theme)"), "org.cinnamon", "panels-resizable", None, self.panel_id)
            section.add(widget)
            self.widgets.append(widget)

            widget = PanelCheckButton(_("Allow Cinnamon to scale panel text and icons according to the panel heights"), "org.cinnamon", "panels-scale-text-icons", "org.cinnamon/panels-resizable", self.panel_id)
            section.add_indented(widget)
            self.widgets.append(widget)

            widget = PanelIntRange(_("Panel height:"), _("Smaller"), _("Larger"), 20, 50, False, False, "org.cinnamon", "panels-height", "org.cinnamon/panels-resizable", self.panel_id, adjustment_step = 1.0)
            widget.add_mark(25.0, Gtk.PositionType.TOP, None)
            section.add_indented_expand(widget)
            self.widgets.append(widget)
            self.panel_content.add(section)
            vbox.add(self.panel_content)


            bg = SectionBg()
            self.sidePage.add_widget(bg)

            section = Section(_("General Panel Options"))
            bg.add(section)

            hbox = Gtk.Box(Gtk.Orientation.HORIZONTAL)
            section.add(hbox)

            self.add_panel_button = Gtk.Button(label=_("Add new panel"))

            hbox.pack_start(self.add_panel_button, False, False, 2)
            toggle_button = Gtk.ToggleButton(label=_("Panel edit mode"))

            self.settings.bind("panel-edit-mode", toggle_button, "active", Gio.SettingsBindFlags.DEFAULT)
            hbox.pack_start(toggle_button, False, False, 2)

            section.add(GSettingsCheckButton(_("Allow the pointer to pass through the edges of adjacent panels"), "org.cinnamon", "no-adjacent-panel-barriers", None))

            self.add_panel_button.connect("clicked", self.on_add_panel)
            self.previous_button.connect("clicked", self.on_previous_panel)
            self.next_button.connect("clicked", self.on_next_panel)

            self.panel_content.connect("map", self.on_panel_list_changed)
            self.panel_content.connect("unmap", self.restore_panels)
            self.panel_content.connect("destroy", self.restore_panels)

        self.on_panel_list_changed("org.cinnamon", "panels-enabled")

    def on_add_panel(self, widget):
        self.proxy.addPanelQuery(dbus_interface='org.Cinnamon')

    def on_previous_panel(self, widget):
        if self.panel_id:
            self.proxy.highlightPanel(self.panel_id, False, dbus_interface='org.Cinnamon')

        current = self.panels.index(self.panel_id)

        if current - 1 >= 0:
            self.panel_id = self.panels[current - 1]
        else:
            self.panel_id = self.panels[len(self.panels) - 1]

        if self.panel_id:
            self.proxy.highlightPanel(self.panel_id, True, dbus_interface='org.Cinnamon')
            for widget in self.widgets:
                widget.set_panel_id(self.panel_id)

    def on_next_panel(self, widget):
        if self.panel_id:
            self.proxy.highlightPanel(self.panel_id, False, dbus_interface='org.Cinnamon')

        current = self.panels.index(self.panel_id)

        if current + 1 < len(self.panels):
            self.panel_id = self.panels[current + 1]
        else:
            self.panel_id = self.panels[0]

        if self.panel_id:
            self.proxy.highlightPanel(self.panel_id, True, dbus_interface='org.Cinnamon')
            for widget in self.widgets:
                widget.set_panel_id(self.panel_id)

    def on_panel_list_changed(self, arg1=None, arg2=None):
        panels = self.settings.get_strv("panels-enabled")

        n_mons = Gdk.Screen.get_default().get_n_monitors()

        self.monitor_layout = []
        self.panels = []

        for i in range(0, n_mons):
            self.monitor_layout.append(Monitor())

        selected = None
        for panel in panels:
            panel_id, monitor_id, position = panel.split(":")
            panel_id = int(panel_id)
            monitor_id = int(monitor_id)
            if monitor_id < n_mons:
                if "top" in position:
                    self.monitor_layout[monitor_id].top = panel_id
                else:
                    self.monitor_layout[monitor_id].bottom = panel_id

        # Index the panels for the next/previous buttons
        for i in range(0, n_mons):
            for j in (self.monitor_layout[i].top, self.monitor_layout[i].bottom):
                if j != -1:
                    self.panels.append(j)

        if len(self.panels) == 0:
            self.panel_bg.hide()
        else:
            self.panel_bg.show()

        show_add = False
        for i in range(0, n_mons):
            if self.monitor_layout[i].top == -1 or self.monitor_layout[i].bottom == -1:
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

        self.panel_id = self.panels[current_idx]

        if self.panel_id:
            self.proxy.highlightPanel(self.panel_id, True, dbus_interface='org.Cinnamon')
            for widget in self.widgets:
                widget.set_panel_id(self.panel_id)

    def restore_panels(self, widget):
        self.proxy.destroyDummyPanels(dbus_interface='org.Cinnamon')
        if self.panel_id:
            self.proxy.highlightPanel(self.panel_id, False, dbus_interface='org.Cinnamon')

class PanelCheckButton(Gtk.CheckButton):
    def __init__(self, label, schema, key, dep_key, panel_id):
        self.key = key
        self.dep_key = dep_key
        self.panel_id = str(panel_id)

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
        self.panel_id = str(panel_id)
        self.on_my_setting_changed(None, None)
        if self.dep_key:
            self.on_dependency_setting_changed(None, None)

class PanelSpinButton(Gtk.HBox):
    def __init__(self, label, schema, key, dep_key, min, max, step, page, units, panel_id):
        self.key = key
        self.min = min
        self.max = max
        self.panel_id = str(panel_id)
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
        self.panel_id = str(panel_id)
        self.on_my_setting_changed(None, None)
        if self.dep_key:
            self.on_dependency_setting_changed(None, None)

class PanelIntRange(Gtk.HBox):
    def __init__(self, label, low_label, hi_label, low_limit, hi_limit, inverted, exponential, schema, key, dep_key,panel_id, **options):
        super(PanelIntRange, self).__init__()
        self.key = key
        self.dep_key = dep_key
        self.settings = Gio.Settings.new(schema)
        self.panel_id = str(panel_id)

        self.value = self.get_int(self.settings, self.key) * 1.0
        self.label = Gtk.Label.new(label)
        self.label.set_alignment(1.0, 0.5)
        self.label.set_size_request(150, -1)
        self.low_label = Gtk.Label()
        self.low_label.set_alignment(0.5, 0.5)
        self.low_label.set_size_request(60, -1)
        self.hi_label = Gtk.Label()
        self.hi_label.set_alignment(0.5, 0.5)
        self.hi_label.set_size_request(60, -1)
        self.low_label.set_markup("<i><small>%s</small></i>" % low_label)
        self.hi_label.set_markup("<i><small>%s</small></i>" % hi_label)
        self.inverted = inverted
        self.exponential = exponential
        self._range = (hi_limit - low_limit) * 1.0
        self._step = options.get('adjustment_step', 1)
        self._min = low_limit * 1.0
        self._max = hi_limit * 1.0
        self.content_widget = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 0, 1, (self._step / self._range))
        self.content_widget.set_size_request(300, 0)
        self.content_widget.set_value(self.to_corrected(self.value))
        self.content_widget.set_draw_value(False);

        self.grid = Gtk.Grid()
        if (label != ""):
            self.grid.attach(self.label, 0, 0, 1, 1)
        if (low_label != ""):
            self.grid.attach(self.low_label, 1, 0, 1, 1)
        self.grid.attach(self.content_widget, 2, 0, 1, 1)
        if (hi_label != ""):
            self.grid.attach(self.hi_label, 3, 0, 1, 1)
        self.pack_start(self.grid, True, True, 2)
        self._dragging = False
        self.content_widget.connect('value-changed', self.on_my_value_changed)
        self.content_widget.connect('button-press-event', self.on_mouse_down)
        self.content_widget.connect('button-release-event', self.on_mouse_up)
        self.content_widget.connect("scroll-event", self.on_mouse_scroll_event)
        self.content_widget.show_all()
        self.dependency_invert = False
        self.settings.connect("changed::"+self.key, self.on_my_setting_changed)
        if self.dep_key is not None:
            if self.dep_key[0] == '!':
                self.dependency_invert = True
                self.dep_key = self.dep_key[1:]
            split = self.dep_key.split('/')
            self.dep_settings = Gio.Settings.new(split[0])
            self.dep_key = split[1]
            self.dep_settings.connect("changed::"+self.dep_key, self.on_dependency_setting_changed)
            self.on_dependency_setting_changed(self, None)

# halt writing gsettings during dragging
# it can take a long time to process all
# those updates, and the system can crash
    def on_my_setting_changed(self, settings, key):
        self.value = self.get_int(self.settings, self.key) * 1.0
        self.content_widget.set_value(self.to_corrected(self.value))

    def on_mouse_down(self, widget, event):
        self._dragging = True

    def on_mouse_up(self, widget, event):
        self._dragging = False
        self.on_my_value_changed(widget)

    def on_mouse_scroll_event(self, widget, event):
        found, delta_x, delta_y = event.get_scroll_deltas()
        if found:
            add = delta_y < 0
            uncorrected = self.from_corrected(widget.get_value())
            if add:
                corrected = self.to_corrected(uncorrected + self._step)
            else:
                corrected = self.to_corrected(uncorrected - self._step)
            widget.set_value(corrected)
        return True

    def on_my_value_changed(self, widget):
        if self._dragging:
            return
        corrected = self.from_corrected(widget.get_value())
        self.set_int(self.settings, self.key, corrected)

    def on_dependency_setting_changed(self, settings, dep_key):
        if not self.dependency_invert:
            self.set_sensitive(self.get_boolean(self.settings, self.dep_key))
        else:
            self.set_sensitive(not self.get_boolean(self.settings, self.dep_key))

    def to_corrected(self, value):
        result = 0.0
        if self.exponential:
            k = (math.log(self._max) - math.log(self._min)) / (self._range / self._step)
            a = self._max / math.exp(k * self._range)
            cur_val_step = (1 / (k / math.log(value / a))) / self._range
            if self.inverted:
                result = 1 - cur_val_step
            else:
                result = cur_val_step
        else:
            if self.inverted:
                result = 1 - ((value - self._min) / self._range)
            else:
                result = (value - self._min) / self._range
        return result

    def from_corrected(self, value):
        result = 0.0
        if self.exponential:
            k = (math.log(self._max)-math.log(self._min))/(self._range / self._step)
            a = self._max / math.exp(k * self._range)
            if self.inverted:
                cur_val_step = (1 - value) * self._range
                result = a * math.exp(k * cur_val_step)
            else:
                cur_val_step = value * self._range
                result =  a * math.exp(k * cur_val_step)
        else:
            if self.inverted:
                result = ((1 - value) * self._range) + self._min
            else:
                result =  (value * self._range) + self._min
        return round(result)

    def add_mark(self, value, position, markup):
        self.content_widget.add_mark((value - self._min) / self._range, position, markup)

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
        self.panel_id = str(panel_id)
        self.on_my_setting_changed(None, None)
        if self.dep_key:
            self.on_dependency_setting_changed(None, None)
