#!/usr/bin/env python
import sys
import dbus
from gi.repository import GLib
from SettingsWidgets import *

class Module:
    def __init__(self, content_box):
        keywords = _("panel, height, bottom, top, autohide, size, layout")
        sidePage = SidePage(_("Panel"), "cs-panel", keywords, content_box, module=self)
        self.sidePage = sidePage
        self.name = "panel"
        self.category = "prefs"
        self.comment = _("Manage Cinnamon panel settings")

        self.settings = Gio.Settings.new("org.cinnamon");
        self.settings.connect("changed::panels-enabled", self.on_panel_list_changed)
        self.model = Gtk.ListStore(str, str)
        self.proxy = dbus.SessionBus().get_object("org.Cinnamon", "/org/Cinnamon")

        self.widgets = []
        self.panel_id = None
        if len(sys.argv) > 2:
            if sys.argv[1] == "panel":
                self.panel_id = sys.argv[2]

    def on_module_selected(self):
        if not self.loaded:
            print "Loading Panel module"

            bg = SectionBg()        
            self.sidePage.add_widget(bg)
            vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            bg.add(vbox)

            self.panel_content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            self.combo_box = Gtk.ComboBox.new_with_model(self.model)
            renderer_text = Gtk.CellRendererText()
            self.combo_box.pack_start(renderer_text, True)
            self.combo_box.add_attribute(renderer_text, "text", 1)
            self.combo_box.set_id_column(0)

            self.panel_content.pack_start(self.combo_box, False, False, 2)

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

            self.panel_content.add(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL))

            vbox.add(self.panel_content)

            hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
            hbox.set_border_width(6)
            hbox.add(GSettingsCheckButton(_("Panel edit mode"), "org.cinnamon", "panel-edit-mode", None))
            vbox.add(hbox)

            add_panel_button = Gtk.Button(label=_("Add new panel"))
            vbox.add(add_panel_button)
            add_panel_button.connect("clicked", self.on_add_panel)

            self.combo_box.connect("changed", self.on_combo_box_changed)
            # Widget is only hidden when switching panels
            self.combo_box.connect("unmap", self.on_combo_box_destroy)
            self.combo_box.connect("destroy", self.on_combo_box_destroy)

            vbox.connect("show", self.update_view)
            # When the sidepage is shown, "show" is called on all widgets. We need to check again if we want to show panel_content

        self.on_panel_list_changed("org.cinnamon", "panels-enabled")
        self.on_combo_box_changed(self.combo_box)

    def on_add_panel(self, widget):
        self.proxy.addPanelQuery(dbus_interface='org.Cinnamon')

    def update_view(self, widget):
        if len(self.model) == 0:
            GLib.idle_add(self.panel_content.hide)
            # Wait for a while so that the window gets the right size
        else:
            self.panel_content.show()
        
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

        if len(panels) == 0:
            self.panel_content.hide()
        else:
            self.panel_content.show()

    def on_combo_box_changed(self, widget):
        if self.panel_id:
            self.proxy.highlightPanel(int(self.panel_id), False, dbus_interface='org.Cinnamon')

        self.panel_id = self.combo_box.get_active_id()
        if self.panel_id:
            self.proxy.highlightPanel(int(self.panel_id), True, dbus_interface='org.Cinnamon')

            for widget in self.widgets:
                widget.set_panel_id(self.panel_id)

    def on_combo_box_destroy(self, widget):
        self.proxy.destroyDummyPanels(dbus_interface='org.Cinnamon')
        if self.panel_id:
            self.proxy.highlightPanel(int(self.panel_id), False, dbus_interface='org.Cinnamon')

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

class PanelIntRange(Gtk.HBox):
    def __init__(self, label, low_label, hi_label, low_limit, hi_limit, inverted, exponential, schema, key, dep_key,panel_id, **options):
        super(PanelIntRange, self).__init__()
        self.key = key
        self.dep_key = dep_key
        self.settings = Gio.Settings.new(schema)
        self.panel_id = panel_id

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
        self.panel_id = panel_id
        self.on_my_setting_changed(None, None)
        if self.dep_key:
            self.on_dependency_setting_changed(None, None)
