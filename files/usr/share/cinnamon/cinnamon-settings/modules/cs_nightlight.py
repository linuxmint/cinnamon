#!/usr/bin/python3

from SettingsWidgets import SidePage
from bin import util
from xapp.GSettingsWidgets import *

COLOR_SCHEMA = "org.cinnamon.settings-daemon.plugins.color"

class Module:
    name = "nightlight"
    comment = _("Reduce exposure to blue light")
    category = "prefs"

    def __init__(self, content_box):
        keywords = _("redshift, color, blue, light, filter, temperature")
        sidePage = SidePage(_("Night Light"), "cs-nightlight", keywords, content_box, module=self)
        self.sidePage = sidePage

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Night Light module")

            page = SettingsPage()
            self.sidePage.add_widget(page)
            section = page.add_section()

            switch = GSettingsSwitch(_("Enable night light"), COLOR_SCHEMA, "night-light-enabled")
            switch.set_tooltip_text(_("This feature makes the screen color warmer in the evening and during the night. By reducing blue light, it can prevent eye strain, headaches and improve sleep quality."))
            section.add_row(switch)

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
            temp_range = GSettingsRange(_("Color temperature"), COLOR_SCHEMA, "night-light-temperature", "", "",
                                        mini=1700, maxi=4700, step=100, invert=True, show_value=False)
            section.add_row(temp_range)
            temp_range.content_widget.set_has_origin(False)
            temp_range.content_widget.add_mark(2700, Gtk.PositionType.TOP, None)

            context = temp_range.content_widget.get_style_context()
            context.add_class("night-light-temperature")
            provider = Gtk.CssProvider()
            provider.load_from_data(range_css.encode("utf-8"))
            context.add_provider(provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)

            section.add_row(Button(_("Click to preview"), self.preview_night_light))

            section = page.add_section()

            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)

            options = ["auto", _("Automatic")], ["manual", _("Specify start and end times")]
            widget = GSettingsComboBox(_("Schedule"), COLOR_SCHEMA, "night-light-schedule-mode", options, size_group=size_group)
            section.add_row(widget)
            section.need_separator = False
            section.add_reveal_row(ScheduleWidget(size_group), COLOR_SCHEMA, "night-light-schedule-mode", values=["manual"])

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


class TimeSpinButton(Gtk.SpinButton):
    def __init__(self, *args, **kwargs):
        super(TimeSpinButton, self).__init__(*args, **kwargs)
        self.set_wrap(True)
        self.set_digits(2)
        self.props.width_chars = 10
        self.props.update_policy=Gtk.SpinButtonUpdatePolicy.IF_VALID

        interface_settings = Gio.Settings(schema_id="org.cinnamon.desktop.interface")
        self.locale_format = "%R" if interface_settings.get_boolean("clock-use-24h") else "%I:%M %p"

        self.formatter_handle = self.connect("output", self.value_to_label)

    def value_to_label(self, spinbutton, data=None):
        adjustment = self.get_adjustment()
        value = adjustment.get_value()

        hours, minutes = self.frac_to_h_m(value)
        t = GLib.DateTime.new_local(2000, 1, 1, hours, minutes, 0)

        self.set_text(t.format(self.locale_format))
        return True

    def frac_to_h_m(self, fraction):
        hours = int(fraction)
        minutes = int((fraction - hours) * 60)
        return hours, minutes

    def get_time_fraction(self):
        adjustment = self.get_adjustment()
        return adjustment.get_value()

class ScheduleWidget(SettingsWidget):
    def __init__(self, size_group):
        super(ScheduleWidget, self).__init__()

        self.color_settings = Gio.Settings(schema_id=COLOR_SCHEMA)

        self.content_widget = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=2)
        self.pack_end(self.content_widget, False, False, 0)

        size_group.add_widget(self.content_widget)

        start_frac = self.color_settings.get_double("night-light-schedule-from")
        end_frac = self.color_settings.get_double("night-light-schedule-to")

        adjust = Gtk.Adjustment(value=start_frac, lower=0, upper=23.75, step_increment=.25)
        self.start_hr = TimeSpinButton(adjustment=adjust, orientation=Gtk.Orientation.VERTICAL)
        adjust.connect("value-changed", self.from_spinner_values_changed, self.start_hr)
        self.content_widget.pack_start(self.start_hr, True, True, 0)

        label = Gtk.Label(label=_("to"))
        self.content_widget.pack_start(label, False, False, 4)

        adjust = Gtk.Adjustment(value=end_frac, lower=0, upper=23.75, step_increment=.25)
        self.end_hr = TimeSpinButton(adjustment=adjust, orientation=Gtk.Orientation.VERTICAL)
        adjust.connect("value-changed", self.to_spinner_values_changed, self.end_hr)
        self.content_widget.pack_start(self.end_hr, True, True, 0)

        self.show_all()

    def from_spinner_values_changed(self, adjustment, spinner):
        self.color_settings.set_double("night-light-schedule-from", spinner.get_time_fraction())

    def to_spinner_values_changed(self, adjustment, spinner):
        self.color_settings.set_double("night-light-schedule-to", spinner.get_time_fraction())
