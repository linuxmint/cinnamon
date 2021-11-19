#!/usr/bin/python3

import gi
gi.require_version('UPowerGlib', '1.0')
from gi.repository import UPowerGlib

from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *

POWER_BUTTON_OPTIONS = [
    ("blank", _("Lock the screen")),
    ("suspend", _("Suspend")),
    ("shutdown", _("Shut down immediately")),
    ("hibernate", _("Hibernate")),
    ("interactive", _("Ask what to do")),
    ("nothing", _("Do nothing"))
]

IDLE_BRIGHTNESS_OPTIONS = [
    (5, _("5%")),
    (10, _("10%")),
    (30, _("30%")),
    (50, _("50%")),
    (75, _("75%"))
]

IDLE_DELAY_OPTIONS = [
    (30, _("30 seconds")),
    (60, _("60 seconds")),
    (90, _("90 seconds")),
    (120, _("2 minutes")),
    (300, _("5 minutes")),
    (600, _("10 minutes"))
]

SLEEP_DELAY_OPTIONS = [
    (300, _("5 minutes")),
    (600, _("10 minutes")),
    (900, _("15 minutes")),
    (1800, _("30 minutes")),
    (2700, _("45 minutes")),
    (3600, _("1 hour")),
    (7200, _("2 hours")),
    (10800, _("3 hours")),
    (0, _("Never"))
]

(UP_ID, UP_VENDOR, UP_MODEL, UP_TYPE, UP_ICON, UP_PERCENTAGE, UP_STATE, UP_BATTERY_LEVEL, UP_SECONDS) = range(9)

try:
    UPowerGlib.DeviceLevel
except AttributeError:
    class DeviceLevel:
        UNKNOWN = 1
        NONE = 1
        LOW = 3
        CRITICAL = 4
        NORMAL = 6
        HIGH = 7
        FULL = 9
    UPowerGlib.DeviceLevel = DeviceLevel


def get_timestring(time_seconds):
    minutes = int((time_seconds / 60.0) + 0.5)

    if minutes == 0:
        time_string = _("Unknown time")
        return time_string

    if minutes < 60:
        if minutes == 1:
            time_string = ("%d " % minutes) + _("minute")
        else:
            time_string = ("%d " % minutes) + _("minutes")
        return time_string

    hours = minutes / 60
    minutes = minutes % 60

    if minutes == 0:
        if hours == 1:
            time_string = ("%d " % hours) + _("hour")
            return time_string
        else:
            time_string = ("%d " % hours) + _("hours")
            return time_string

    if hours == 1:
        if minutes == 1:
            time_string = ("%d " % hours + _("hour")) + (" %d " % minutes + _("minute"))
            return time_string
        else:
            time_string = ("%d " % hours + _("hour")) + (" %d " % minutes + _("minutes"))
            return time_string

    time_string = ("%d " % hours + _("hours")) + (" %d " % minutes + _("minutes"))
    return time_string


CSD_SCHEMA = "org.cinnamon.settings-daemon.plugins.power"
CSM_SCHEMA = "org.cinnamon.SessionManager"

class Module:
    name = "power"
    category = "hardware"
    comment = _("Manage power settings")

    def __init__(self, content_box):
        keywords = _("power, suspend, hibernate, laptop, desktop, brightness, screensaver")
        self.sidePage = SidePage(_("Power Management"), "cs-power", keywords, content_box, -1, module=self)

    def on_module_selected(self):
        if self.loaded:
            # self.loaded = False
            return
        print("Loading Power module")

        self.up_client = UPowerGlib.Client.new()

        self.csd_power_proxy = Gio.DBusProxy.new_sync(
            Gio.bus_get_sync(Gio.BusType.SESSION, None),
            Gio.DBusProxyFlags.NONE,
            None,
            "org.cinnamon.SettingsDaemon.Power",
            "/org/cinnamon/SettingsDaemon/Power",
            "org.cinnamon.SettingsDaemon.Power",
            None)

        self.settings = Gio.Settings.new("org.cinnamon")

        device_types = [x[UP_TYPE] for x in self.csd_power_proxy.GetDevices()]

        self.has_battery = UPowerGlib.DeviceKind.BATTERY in device_types or UPowerGlib.DeviceKind.UPS in device_types
        self.has_lid = self.up_client.get_lid_is_present()

        self.sidePage.stack = SettingsStack()

        # Power

        power_page = SettingsPage()

        section = power_page.add_section(_("Power Options"))

        lid_options, button_power_options, critical_options, can_suspend, can_hybrid_sleep, can_hibernate = get_available_options(self.up_client)

        size_group = Gtk.SizeGroup(mode=Gtk.SizeGroupMode.HORIZONTAL)

        if self.has_battery:
            header = SettingsWidget()
            label_ac = Gtk.Label()
            label_ac.set_markup("<b>%s</b>" % _("On A/C power"))
            size_group.add_widget(label_ac)
            label_battery = Gtk.Label()
            label_battery.set_markup("<b>%s</b>" % _("On battery power"))
            size_group.add_widget(label_battery)
            header.pack_end(label_battery, False, False, 0)
            header.pack_end(label_ac, False, False, 0)

            section.add_row(header)

            section.add_row(GSettings2ComboBox(_("Turn off the screen when inactive for"), CSD_SCHEMA, "sleep-display-ac", "sleep-display-battery", SLEEP_DELAY_OPTIONS, valtype="int", size_group=size_group))

            section.add_row(GSettings2ComboBox(_("Suspend when inactive for"), CSD_SCHEMA, "sleep-inactive-ac-timeout", "sleep-inactive-battery-timeout", SLEEP_DELAY_OPTIONS, valtype="int", size_group=size_group))

            if self.has_lid:
                section.add_row(GSettings2ComboBox(_("When the lid is closed"), CSD_SCHEMA, "lid-close-ac-action", "lid-close-battery-action", lid_options, size_group=size_group))

        else:
            section.add_row(GSettingsComboBox(_("Turn off the screen when inactive for"), CSD_SCHEMA, "sleep-display-ac", SLEEP_DELAY_OPTIONS, valtype=int, size_group=size_group))

            section.add_row(GSettingsComboBox(_("Suspend when inactive for"), CSD_SCHEMA, "sleep-inactive-ac-timeout", SLEEP_DELAY_OPTIONS, valtype=int, size_group=size_group))

            if self.has_lid:
                section.add_row(GSettingsComboBox(_("When the lid is closed"), CSD_SCHEMA, "lid-close-ac-action", lid_options, size_group=size_group))

        section = power_page.add_section(_("Extra options"))

        size_group = Gtk.SizeGroup(mode=Gtk.SizeGroupMode.HORIZONTAL)

        section.add_row(GSettingsComboBox(_("When the power button is pressed"), CSD_SCHEMA, "button-power", button_power_options, size_group=size_group))

        if self.has_lid:
            section.add_row(GSettingsSwitch(_("Perform lid-closed action even with external monitors attached"), CSD_SCHEMA, "lid-close-suspend-with-external-monitor"))

        if self.has_battery and UPowerGlib.MAJOR_VERSION == 0 and UPowerGlib.MINOR_VERSION <= 99:
            section.add_row(GSettingsComboBox(_("When the battery is critically low"), CSD_SCHEMA, "critical-battery-action", critical_options, size_group=size_group))

        if can_suspend and can_hybrid_sleep:
            self.hybrid_switch = GSettingsSwitch(_("Enable Hybrid Sleep"), CSM_SCHEMA, "prefer-hybrid-sleep")
            self.hybrid_switch.set_tooltip_text(_("Replaces Suspend with Hybrid Sleep"))
            self.hybrid_switch.content_widget.connect("notify::active", self.on_hybrid_toggled)
            section.add_row(self.hybrid_switch)

        if can_suspend and can_hibernate:
            self.sth_switch = GSettingsSwitch(_("Enable Hibernate after suspend"), CSM_SCHEMA, "suspend-then-hibernate")
            self.sth_switch.set_tooltip_text(_("First suspend the machine and hibernate it after a certain amount of time."))
            self.sth_switch.content_widget.connect("notify::active", self.on_sth_toggled)
            section.add_row(self.sth_switch)

        # Batteries

        self.battery_page = SettingsPage()
        self.show_battery_page = False
        self.battery_label_size_group = Gtk.SizeGroup(Gtk.SizeGroupMode.HORIZONTAL)

        self.build_battery_page()
        self.csd_power_proxy.connect("g-properties-changed", self.build_battery_page)

        proxy = Gio.DBusProxy.new_sync(
            Gio.bus_get_sync(Gio.BusType.SESSION, None),
            Gio.DBusProxyFlags.NONE,
            None,
            "org.cinnamon.SettingsDaemon.Power",
            "/org/cinnamon/SettingsDaemon/Power",
            "org.cinnamon.SettingsDaemon.Power.Screen",
            None)

        try:
            brightness = proxy.GetPercentage()
        except GLib.Error as e:
            print("Power module brightness page not available: %s" % e.message)

            if self.show_battery_page:
                self.sidePage.add_widget(self.sidePage.stack)
                self.sidePage.stack.add_titled(power_page, "power", _("Power"))
                self.sidePage.stack.add_titled(self.battery_page, "batteries", _("Batteries"))
            else:
                self.sidePage.add_widget(power_page)
        else:
            self.sidePage.add_widget(self.sidePage.stack)
            self.sidePage.stack.add_titled(power_page, "power", _("Power"))
            if self.show_battery_page:
                self.sidePage.stack.add_titled(self.battery_page, "batteries", _("Batteries"))

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "brightness", _("Brightness"))

            size_group = Gtk.SizeGroup(mode=Gtk.SizeGroupMode.HORIZONTAL)

            section = page.add_section(_("Screen brightness"))
            section.add_row(BrightnessSlider(section, proxy, _("Screen brightness")))

            section.add_row(GSettingsSwitch(_("On battery, dim screen when inactive"), CSD_SCHEMA, "idle-dim-battery"))

            section.add_reveal_row(GSettingsComboBox(_("Brightness level when inactive"), CSD_SCHEMA, "idle-brightness", IDLE_BRIGHTNESS_OPTIONS, valtype=int, size_group=size_group), CSD_SCHEMA, "idle-dim-battery")

            section.add_reveal_row(GSettingsComboBox(_("Dim screen after inactive for"), CSD_SCHEMA, "idle-dim-time", IDLE_DELAY_OPTIONS, valtype=int, size_group=size_group), CSD_SCHEMA, "idle-dim-battery")

            proxy = Gio.DBusProxy.new_sync(Gio.bus_get_sync(Gio.BusType.SESSION, None),
                                           Gio.DBusProxyFlags.NONE,
                                           None,
                                           "org.cinnamon.SettingsDaemon.Power",
                                           "/org/cinnamon/SettingsDaemon/Power",
                                           "org.cinnamon.SettingsDaemon.Power.Keyboard",
                                           None)

            try:
                brightness = proxy.GetPercentage()
            except GLib.Error as e:
                print("Power module no keyboard backlight: %s" % e.message)
            else:
                section = page.add_section(_("Keyboard backlight"))
                section.add_row(BrightnessSlider(section, proxy, _("Backlight brightness")))

    def on_sth_toggled(self, widget, gparam):
        active = widget.get_active()
        if active and hasattr(self, "hybrid_switch"):
            self.hybrid_switch.set_value(False)

    def on_hybrid_toggled(self, widget, gparam):
        active = widget.get_active()
        if active and hasattr(self, "sth_switch"):
            self.sth_switch.set_value(False)

    def build_battery_page(self, *args):

        self.aliases = {}
        device_aliases = self.settings.get_strv("device-aliases")
        for alias in device_aliases:
            try:
                (device_id, device_nickname) = alias.split(":=")
                self.aliases[device_id] = device_nickname
            except:
                pass # ignore malformed aliases

        #destroy all widgets in this page
        for widget in self.battery_page.get_children():
            widget.destroy()

        secondary_settings = None
        primary_settings = None

        # UPowerGlib segfaults when trying to get device. Use CSD instead
        devices = self.csd_power_proxy.GetDevices()

        have_primary = False
        ups_as_primary = False

        # first we look for a discharging UPS, which is promoted to the
        # primary device if it's discharging. Otherwise we use the first
        # listed laptop battery as the primary device

        for device in devices:
            if device[UP_TYPE] == UPowerGlib.DeviceKind.UPS and device[UP_STATE] == UPowerGlib.DeviceState.DISCHARGING:
                ups_as_primary = True

        for device in devices:
            if device[UP_TYPE] == UPowerGlib.DeviceKind.LINE_POWER:
                pass # Do nothing
            elif device[UP_TYPE] == UPowerGlib.DeviceKind.UPS and ups_as_primary:
                if not primary_settings:
                    primary_settings = self.battery_page.add_section(_("Batteries"))
                    primary_settings.add_row(self.set_device_ups_primary(device))
                    self.show_battery_page = True
                else:
                    primary_settings.add_row(self.set_device_ups_primary(device))
            elif device[UP_TYPE] == UPowerGlib.DeviceKind.BATTERY and not ups_as_primary:
                if not have_primary:
                    if not primary_settings:
                        primary_settings = self.battery_page.add_section(_("Batteries"))
                        primary_settings.add_row(self.set_device_battery_primary(device))
                        self.show_battery_page = True
                    have_primary = True
                else:
                    widget = self.set_device_battery_additional(device)
                    if widget:
                        primary_settings.add_row(widget)
            else:
                if not secondary_settings:
                    secondary_settings = self.battery_page.add_section(_("Devices"))
                    secondary_settings.add_row(self.add_battery_device_secondary(device))
                    self.show_battery_page = True
                else:
                    secondary_settings.add_row(self.add_battery_device_secondary(device))

        #show all the widgets in this page, but not the page itself
        visible = self.battery_page.get_visible()
        self.battery_page.show_all()
        self.battery_page.set_visible(visible)

    def set_device_ups_primary(self, device):
        device_id = device[UP_ID]
        percentage = device[UP_PERCENTAGE]
        battery_level = device[UP_BATTERY_LEVEL]
        state = device[UP_STATE]
        time = device[UP_SECONDS]
        vendor = device[UP_VENDOR]
        model = device[UP_MODEL]
        details = None

        if time > 0:
            time_string = get_timestring(time)

            if state == UPowerGlib.DeviceState.DISCHARGING:
                if percentage < 20:
                    details = _("Caution low UPS, %s remaining") % time_string
                else:
                    details = _("Using UPS power - %s remaining") % time_string
            else:
                details = UPowerGlib.Device.state_to_string(state)
        else:
            if state == UPowerGlib.DeviceState.DISCHARGING:
                if percentage < 20:
                    details = _("Caution low UPS")
                else:
                    details = _("Using UPS power")
            else:
                details = UPowerGlib.Device.state_to_string(state)

        desc = _("UPS")
        if (model != "" or vendor != ""):
            desc = "%s %s" % (vendor, model)

        widget = self.create_battery_row(device_id, "battery", desc, percentage, battery_level, details)
        return widget

    def set_device_battery_primary(self, device):
        device_id = device[UP_ID]
        percentage = device[UP_PERCENTAGE]
        battery_level = device[UP_BATTERY_LEVEL]
        state = device[UP_STATE]
        time = device[UP_SECONDS]
        vendor = device[UP_VENDOR]
        model = device[UP_MODEL]
        details = None

        if time > 0:
            time_string = get_timestring(time)

            if state == UPowerGlib.DeviceState.CHARGING or state == UPowerGlib.DeviceState.PENDING_CHARGE:
                details = _("Charging - %s until fully charged") % time_string
            elif state == UPowerGlib.DeviceState.DISCHARGING or state == UPowerGlib.DeviceState.PENDING_DISCHARGE:
                if percentage < 20:
                    details = _("Caution low battery, %s remaining") % time_string
                else:
                    details = _("Using battery power - %s remaining") % time_string
            else:
                details = UPowerGlib.Device.state_to_string(state)
        else:
            if state == UPowerGlib.DeviceState.CHARGING or state == UPowerGlib.DeviceState.PENDING_CHARGE:
                details = _("Charging")
            elif state == UPowerGlib.DeviceState.DISCHARGING or state == UPowerGlib.DeviceState.PENDING_DISCHARGE:
                details = _("Using battery power")
            elif state == UPowerGlib.DeviceState.FULLY_CHARGED:
                details = _("Charging - fully charged")
            elif state == UPowerGlib.DeviceState.EMPTY:
                details = _("Empty")
            else:
                details = UPowerGlib.Device.state_to_string(state)

        desc = _("Battery")
        if (model != "" or vendor != ""):
            desc = "%s %s" % (vendor, model)

        widget = self.create_battery_row(device_id, "battery", desc, percentage, battery_level, details)
        return widget

    def set_device_battery_additional(self, device):
        state = device[UP_STATE]
        details = None

        if state == UPowerGlib.DeviceState.FULLY_CHARGED:
            details = _("Fully charged")
        elif state == UPowerGlib.DeviceState.EMPTY:
            details = _("Empty")

        if details:
            widget = SettingsWidget()
            icon = Gtk.Image.new_from_icon_name("battery", Gtk.IconSize.DND)
            widget.pack_start(icon, False, False, 0)
            label = Gtk.Label(_("Secondary battery"))
            widget.pack_start(label, False, False, 0)
            label = Gtk.Label()
            label.set_markup(details)
            label.get_style_context().add_class("dim-label")
            widget.pack_end(label, False, False, 0)

            return widget
        else:
            return None

    def add_battery_device_secondary(self, device):
        device_id = device[UP_ID]
        kind = device[UP_TYPE]
        percentage = device[UP_PERCENTAGE]
        battery_level = device[UP_BATTERY_LEVEL]
        vendor = device[UP_VENDOR]
        model = device[UP_MODEL]

        if kind == UPowerGlib.DeviceKind.UPS:
            icon_name = "uninterruptible-power-supply"
            desc = _("Uninterruptible power supply")
        elif kind == UPowerGlib.DeviceKind.MOUSE:
            icon_name = "input-mouse"
            desc = _("Wireless mouse")
        elif kind == UPowerGlib.DeviceKind.KEYBOARD:
            icon_name = "input-keyboard"
            desc = _("Wireless Keyboard")
        elif kind == UPowerGlib.DeviceKind.TABLET:
            icon_name = "input-tablet"
            desc = _("Tablet")
        elif kind == UPowerGlib.DeviceKind.PDA:
            icon_name = "pda"
            desc = _("Personal digital assistant")
        elif kind == UPowerGlib.DeviceKind.PHONE:
            icon_name = "phone"
            desc = _("Cellphone")
        elif kind == UPowerGlib.DeviceKind.MEDIA_PLAYER:
            icon_name = "multimedia-player"
            desc = _("Media player")
        elif kind == UPowerGlib.DeviceKind.COMPUTER:
            icon_name = "computer"
            desc = _("Computer")
        else:
            icon_name = "battery"
            desc = (_("Battery"))

        if (model != "" or vendor != ""):
            desc = "%s %s" % (vendor, model)

        widget = self.create_battery_row(device_id, icon_name, desc, percentage, battery_level)
        return widget

    def create_battery_row(self, device_id, icon_name, desc, percentage, battery_level, details=None):

        if device_id in self.aliases:
            desc = self.aliases[device_id]

        widget = SettingsWidget()

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        label_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=15)

        image = Gtk.Image.new_from_icon_name(icon_name, Gtk.IconSize.DND)
        entry = Gtk.Entry()
        entry.set_text(desc)
        entry.connect('focus-out-event', self.on_alias_changed, device_id)
        label_box.pack_start(image, False, False, 0)
        label_box.pack_start(entry, False, False, 0)
        self.battery_label_size_group.add_widget(label_box)
        hbox.pack_start(label_box, False, False, 0)

        if battery_level == UPowerGlib.DeviceLevel.NONE:
            label = Gtk.Label()
            label.set_markup("%d%%" % int(percentage))
            label.set_size_request(30, -1)
            hbox.pack_start(label, False, False, 15)

            level_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
            level_bar = Gtk.LevelBar()
            level_bar.set_mode(Gtk.LevelBarMode.DISCRETE)
            level_bar.set_min_value(0)
            level_bar.set_max_value(10)
            level_bar.add_offset_value("high", 5)
            level_bar.add_offset_value("low", 2)
            level_box.set_valign(Gtk.Align.CENTER)
            level_bar.set_value(round(percentage / 10))
            level_box.pack_start(level_bar, True, True, 0)
            hbox.pack_start(level_box, True, True, 0)
        else:
            status_label = Gtk.Label(self.bat_level_to_label(battery_level))
            hbox.pack_end(status_label, False, False, 0)

        vbox.pack_start(hbox, False, False, 0)

        if details:
            label = Gtk.Label()
            label.set_markup(details)
            label.get_style_context().add_class("dim-label")
            label.set_halign(Gtk.Align.END)
            vbox.pack_end(label, False, False, 0)

        widget.pack_start(vbox, True, True, 0)

        return widget

    def bat_level_to_label(self, level):
        if level == UPowerGlib.DeviceLevel.FULL:
            return _("Battery full")
        elif level == UPowerGlib.DeviceLevel.HIGH:
            return _("Battery almost full")
        elif level == UPowerGlib.DeviceLevel.NORMAL:
            return _("Battery good")
        elif level == UPowerGlib.DeviceLevel.LOW:
            return _("Low battery")
        elif level == UPowerGlib.DeviceLevel.CRITICAL:
            return _("Critically low battery")

    def on_alias_changed(self, entry, event, device_id):
        self.aliases[device_id] = entry.get_text()
        aliases = []
        for alias in self.aliases:
            aliases.append("%s:=%s" % (alias, self.aliases[alias]))
        self.settings.set_strv("device-aliases", aliases)


def get_available_options(up_client):
    can_suspend = False
    can_hibernate = False
    can_hybrid_sleep = False

    # Try logind first
    try:
        connection = Gio.bus_get_sync(Gio.BusType.SYSTEM, None)
        proxy = Gio.DBusProxy.new_sync(
            connection,
            Gio.DBusProxyFlags.NONE,
            None,
            "org.freedesktop.login1",
            "/org/freedesktop/login1",
            "org.freedesktop.login1.Manager",
            None)

        can_suspend = proxy.CanSuspend() == "yes"
        can_hibernate = proxy.CanHibernate() == "yes"
        can_hybrid_sleep = proxy.CanHybridSleep() == "yes"
    except:
        pass

    # Next try ConsoleKit
    try:
        connection = Gio.bus_get_sync(Gio.BusType.SYSTEM, None)
        proxy = Gio.DBusProxy.new_sync(
            connection,
            Gio.DBusProxyFlags.NONE,
            None,
            "org.freedesktop.ConsoleKit",
            "/org/freedesktop/ConsoleKit/Manager",
            "org.freedesktop.ConsoleKit.Manager",
            None)

        can_suspend = can_suspend or (proxy.CanSuspend() == "yes")
        can_hibernate = can_hibernate or (proxy.CanHybridSleep() == "yes")
        can_hybrid_sleep = can_hybrid_sleep or (proxy.CanHybridSleep() == "yes")
    except:
        pass

    def remove(options, item):
        for option in options:
            if option[0] == item:
                options.remove(option)
                break

    lid_options = [
        ("suspend", _("Suspend")),
        ("shutdown", _("Shut down immediately")),
        ("hibernate", _("Hibernate")),
        ("blank", _("Lock Screen")),
        ("nothing", _("Do nothing"))
    ]

    button_power_options = [
        ("blank", _("Lock Screen")),
        ("suspend", _("Suspend")),
        ("shutdown", _("Shut down immediately")),
        ("hibernate", _("Hibernate")),
        ("interactive", _("Ask")),
        ("nothing", _("Do nothing"))
    ]

    critical_options = [
        ("shutdown", _("Shut down immediately")),
        ("hibernate", _("Hibernate")),
        ("nothing", _("Do nothing"))
    ]

    if not can_suspend:
        for options in lid_options, button_power_options, critical_options:
            remove(options, "suspend")

    if not can_hibernate:
        for options in lid_options, button_power_options, critical_options:
            remove(options, "hibernate")

    return lid_options, button_power_options, critical_options, can_suspend, can_hybrid_sleep, can_hibernate

class BrightnessSlider(SettingsWidget):
    step = 5

    def __init__(self, section, proxy, label):
        super(BrightnessSlider, self).__init__()
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(0)

        self.timer = None
        self.section = section
        self.proxy = proxy

        hbox = Gtk.Box()

        self.label = Gtk.Label.new(label)
        self.label.set_halign(Gtk.Align.CENTER)

        self.min_label= Gtk.Label()
        self.max_label = Gtk.Label()
        self.min_label.set_alignment(1.0, 0.75)
        self.max_label.set_alignment(1.0, 0.75)
        self.min_label.set_margin_right(6)
        self.max_label.set_margin_left(6)
        self.min_label.set_markup("<i><small>0%</small></i>")
        self.max_label.set_markup("<i><small>100%</small></i>")

        step = 5

        try:
            # Keyboard backlight
            step = proxy.GetStep()
            self.content_widget = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 0, 100, step)
            val = 0

            while val < 100 - step:
                val += step

                self.content_widget.add_mark(val, Gtk.PositionType.BOTTOM, None)

        except GLib.Error:
            self.content_widget = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 1, 100, step)

        self.step = step

        self.content_widget.set_draw_value(False)
        self.content_widget.set_digits(0)

        hbox.pack_start(self.min_label, False, False, 0)
        hbox.pack_start(self.content_widget, True, True, 0)
        hbox.pack_start(self.max_label, False, False, 0)

        self.pack_start(self.label, False, False, 0)
        self.pack_start(hbox, True, True, 6)

        self.proxy.connect("g-signal", self.on_dbus_changed)
        self.content_widget.connect("scroll-event", self.on_scroll_event)
        self.content_widget.connect("change-value", self.on_change_value)

        self.value_changed_id = self.content_widget.connect("value-changed", self.apply_later)

        self.on_dbus_changed()

    def apply_later(self, *args):
        def apply(self):
            self.proxy.SetPercentage("(u)", self.content_widget.get_value())
            self.timer = None

        if self.timer:
            GLib.source_remove(self.timer)
        self.timer = GLib.timeout_add(300, apply, self)

    def on_change_value(self, range, scroll_type, value, data=None):
        # Keyboard backlights can have very few adjustment steps (for instance,
        # 0, 50% and 100% in the case of a lenovo p51 laptop.)  It's desirable
        # to have the adjustment ratchet to these values, otherwise you can
        # have the slider misrepresenting the actual value.
        #
        # This intermediate step (change-value signal) lets us clamp the new
        # value to an actual valid position before sending it to the proxy.
        i = 0
        v = round(value)
        step = self.step

        while i < 100:
            if v > i + step:
                i += step
                continue

            if ((i + step) - v) < (v - i):
                v = i + step
            else:
                v = i

            break

        self.content_widget.set_value(v)

        return True

    def on_scroll_event(self, widget, event):
        found, delta_x, delta_y = event.get_scroll_deltas()

        # If you scroll up, delta_y < 0. This is a weird world
        self.content_widget.set_value(widget.get_value() - delta_y * self.step)

        return True

    def on_dbus_changed(self, *args):
        try:
            brightness = self.proxy.GetPercentage()

            self.content_widget.handler_block(self.value_changed_id)
            self.content_widget.set_value(brightness)
            self.content_widget.handler_unblock(self.value_changed_id)
        except:
            self.section.hide()

class GSettings2ComboBox(SettingsWidget):
    def __init__(self, label, schema, key1, key2, options, valtype="string", dep_key=None, size_group=None):
        super(GSettings2ComboBox, self).__init__(dep_key=dep_key)

        self.settings = Gio.Settings.new(schema)
        self.key1 = key1
        self.key2 = key2
        self.option_map = {}

        self.label = Gtk.Label.new(label)
        if valtype == "string":
            self.model = Gtk.ListStore(str, str)
        else:
            self.model = Gtk.ListStore(int, str)

        selected = None
        for option in options:
            iter = self.model.insert_before(None, None)
            self.model.set_value(iter, 0, option[0])
            self.model.set_value(iter, 1, option[1])
            self.option_map[option[0]] = iter

        self.content_widget1 = Gtk.ComboBox.new_with_model(self.model)
        renderer_text = Gtk.CellRendererText()
        self.content_widget1.pack_start(renderer_text, True)
        self.content_widget1.add_attribute(renderer_text, "text", 1)
        self.content_widget1.key = key1

        self.content_widget2 = Gtk.ComboBox.new_with_model(self.model)
        renderer_text = Gtk.CellRendererText()
        self.content_widget2.pack_start(renderer_text, True)
        self.content_widget2.add_attribute(renderer_text, "text", 1)
        self.content_widget2.key = key2

        self.pack_start(self.label, False, False, 0)
        self.pack_end(self.content_widget2, False, True, 0)
        self.pack_end(self.content_widget1, False, True, 0)

        self.content_widget1.connect('changed', self.on_my_value_changed)
        self.content_widget2.connect('changed', self.on_my_value_changed)
        self.settings.connect("changed::" + self.key1, self.on_my_setting_changed1)
        self.settings.connect("changed::" + self.key2, self.on_my_setting_changed2)
        self.on_my_setting_changed1()
        self.on_my_setting_changed2()

        if size_group:
            self.add_to_size_group(size_group)

    def on_my_value_changed(self, widget):
        tree_iter = widget.get_active_iter()
        if tree_iter != None:
            self.settings[widget.key] = self.model[tree_iter][0]

    def on_my_setting_changed1(self, *args):
        try:
            self.content_widget1.set_active_iter(self.option_map[self.settings[self.key1]])
        except:
            self.content_widget1.set_active_iter(None)

    def on_my_setting_changed2(self, *args):
        try:
            self.content_widget2.set_active_iter(self.option_map[self.settings[self.key2]])
        except:
            self.content_widget2.set_active_iter(None)

    def add_to_size_group(self, group):
        group.add_widget(self.content_widget1)
        group.add_widget(self.content_widget2)
