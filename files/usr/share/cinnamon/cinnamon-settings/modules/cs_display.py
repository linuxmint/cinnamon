#!/usr/bin/python3

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

COLOR_SCHEMA = "org.cinnamon.settings-daemon.plugins.color"
FRACTIONAL_ENABLE_OPTIONS = ["scale-monitor-framebuffer", "x11-randr-fractional-scaling"]

class Module:
    name = "display"
    comment = _("Manage display settings")
    category = "hardware"

    def __init__(self, content_box):
        keywords = _("display, screen, monitor, layout, resolution, dual, lcd")
        self.sidePage = SidePage(_("Display"), "cs-display", keywords, content_box, 650, module=self)
        self.display_c_widget = None

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Display module")

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "layout", _("Layout"))

            try:
                settings = page.add_section(_("Layout"))

                widget = SettingsWidget()
                widget.set_border_width(0)
                widget.set_margin_start(0)
                widget.set_margin_end(0)

                content = self.sidePage.content_box.c_manager.get_c_widget("display")
                widget.pack_start(content, True, True, 0)

                self.display_c_widget = content
                settings.add_row(widget)
                widget.get_parent().set_activatable(False)

            except Exception as detail:
                print(detail)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "settings", _("Settings"))
            settings = page.add_section(_("Settings"))

            switch = GSettingsSwitch(_("Disable automatic screen rotation"), "org.cinnamon.settings-daemon.peripherals.touchscreen", "orientation-lock")
            switch.set_tooltip_text(_("Select this option to disable automatic screen rotation on hardware equipped with supported accelerometers."))
            settings.add_row(switch)

            switch = Switch(_("Enable fractional scaling controls (experimental)"))
            switch.set_tooltip_text(_("Select this option to display additional layout controls for per-monitor scaling."))
            settings.add_row(switch)
            self.fractional_switch = switch.content_widget

            self.muffin_settings = Gio.Settings(schema_id="org.cinnamon.muffin")
            self.experimental_features_changed(self.muffin_settings, "x11-randr-fractional-scaling")
            self.muffin_settings.connect("changed::experimental-features", self.experimental_features_changed)
            self.fractional_switch.connect("notify::active", self.fractional_switch_toggled)

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "nightlight", _("Night Light"))

            size_group = Gtk.SizeGroup(mode=Gtk.SizeGroupMode.HORIZONTAL)
            section = page.add_section()

            section.add_row(GSettingsSwitch(_("Enable night light"), COLOR_SCHEMA, "night-light-enabled"))

            range_css = """
@define-color ORANGE_100 #ffc27d;
@define-color ORANGE_500 #f37329;
@define-color base_color white;
@define-color bg_color shade (@base_color, 0.96);

.night-light-temperature trough {
    padding-top: 2px;
    padding-bottom: 2px;
    background-image: linear-gradient(to right, mix(@bg_color, @ORANGE_100, 0.5), @ORANGE_500);
}
"""
            temp_range = GSettingsRange(_("Color temperature"), COLOR_SCHEMA, "night-light-temperature", _("Less warm"), _("Warmer"),
                                        mini=1700, maxi=4700, step=100, invert=True)
            section.add_row(temp_range)
            temp_range.content_widget.set_has_origin(False)
            temp_range.content_widget.add_mark(2700, Gtk.PositionType.TOP, None)

            context = temp_range.content_widget.get_style_context()
            context.add_class("night-light-temperature")
            provider = Gtk.CssProvider()
            provider.load_from_data(range_css)
            context.add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

            section.add_row(GSettingsSwitch(_("Schedule automatically"), COLOR_SCHEMA, "night-light-schedule-automatic"))

            section.add_row(ScheduleWidget())

            section.add_row(Button(_("Preview night light"), self.preview_night_light))

    def experimental_features_changed(self, settings, key):
        self.fractional_switch.freeze_notify()

        features = self.muffin_settings.get_strv("experimental-features")
        self.fractional_switch.set_active(set(FRACTIONAL_ENABLE_OPTIONS).issubset(features))

        self.fractional_switch.thaw_notify()

    def fractional_switch_toggled(self, switch, pspec):
        active = switch.get_active()
        features = self.muffin_settings.get_strv("experimental-features")

        for enabler in FRACTIONAL_ENABLE_OPTIONS:
            try:
                while True:
                    features.remove(enabler)
            except ValueError:
                pass

        if active:
            features.extend(FRACTIONAL_ENABLE_OPTIONS)

        self.muffin_settings.set_strv("experimental-features", features)

    def preview_night_light(self, button):
        proxy = Gio.DBusProxy.new_sync(
            Gio.bus_get_sync(Gio.BusType.SESSION, None),
            Gio.DBusProxyFlags.NONE,
            None,
            "org.cinnamon.SettingsDaemon.Color",
            "/org/cinnamon/SettingsDaemon/Color",
            "org.cinnamon.SettingsDaemon.Color",
            None)

        proxy.NightLightPreview("(u)", 10)

    def on_navigate_out_of_module(self):
        if self.display_c_widget:
            self.display_c_widget.hide()

class PaddedIntSpinButton(Gtk.SpinButton):
    def __init__(self, *args, **kwargs):
        super(PaddedIntSpinButton, self).__init__(*args, **kwargs)
        self.connect("output", self.adjust_label)

    def adjust_label(self, data=None):
        adjustment = self.get_adjustment()
        value = adjustment.get_value()
        text = str(int(value)).zfill(2)
        self.set_text(text)
        return True

class ScheduleWidget(SettingsWidget):
    def __init__(self):
        super(ScheduleWidget, self).__init__(dep_key=f"!{COLOR_SCHEMA}/night-light-schedule-automatic")

        self.color_settings = Gio.Settings(schema_id=COLOR_SCHEMA)

        label = Gtk.Label(label=_("Manual Schedule"))
        self.pack_start(label, False, False, 0)

        self.content_widget = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        self.pack_end(self.content_widget, False, False, 0)

        label = Gtk.Label(label=_("Active from"))
        self.content_widget.pack_start(label, False, False, 2)

        start_frac = self.color_settings.get_double("night-light-schedule-from")
        end_frac = self.color_settings.get_double("night-light-schedule-to")

        start_h, start_m = self.frac_to_h_m(start_frac)
        end_h, end_m = self.frac_to_h_m(end_frac)

        adjust = Gtk.Adjustment(value=start_h, lower=0, upper=23, step_increment=1)
        self.start_hr = PaddedIntSpinButton(adjustment=adjust, orientation=Gtk.Orientation.VERTICAL)
        self.start_hr.connect("value-changed", self.from_spinner_values_changed)
        self.content_widget.pack_start(self.start_hr, False, False, 0)

        label = Gtk.Label(label=":")
        self.content_widget.pack_start(label, False, False, 0)

        adjust = Gtk.Adjustment(value=start_m, lower=0, upper=59, step_increment=1)
        self.start_min = PaddedIntSpinButton(adjustment=adjust, orientation=Gtk.Orientation.VERTICAL, digits=0)
        self.start_min.connect("value-changed", self.from_spinner_values_changed)
        self.content_widget.pack_start(self.start_min, False, False, 0)

        label = Gtk.Label(label=_("to"))
        self.content_widget.pack_start(label, False, False, 4)

        adjust = Gtk.Adjustment(value=end_h, lower=0, upper=23, step_increment=1)
        self.end_hr = PaddedIntSpinButton(adjustment=adjust, orientation=Gtk.Orientation.VERTICAL)
        self.end_hr.connect("value-changed", self.to_spinner_values_changed)
        self.content_widget.pack_start(self.end_hr, False, False, 0)

        label = Gtk.Label(label=":")
        self.content_widget.pack_start(label, False, False, 0)

        adjust = Gtk.Adjustment(value=end_m, lower=0, upper=59, step_increment=1)
        self.end_min = PaddedIntSpinButton(adjustment=adjust, orientation=Gtk.Orientation.VERTICAL)
        self.end_min.connect("value-changed", self.to_spinner_values_changed)
        self.content_widget.pack_start(self.end_min, False, False, 0)

        self.show_all()

    def from_spinner_values_changed(self, data=None):
        start_h = self.start_hr.get_value_as_int()
        start_m = self.start_min.get_value_as_int()
        self.color_settings.set_double("night-light-schedule-from", self.h_m_to_frac(start_h, start_m))

    def to_spinner_values_changed(self, data=None):
        end_h = self.end_hr.get_value_as_int()
        end_m = self.end_min.get_value_as_int()
        self.color_settings.set_double("night-light-schedule-to", self.h_m_to_frac(end_h, end_m))

    def frac_to_h_m(self, fraction):
        hours = int(fraction)
        minutes = int((fraction - hours) * 60)
        return hours, minutes

    def h_m_to_frac(self, hours, minutes):
        return hours + minutes / 60