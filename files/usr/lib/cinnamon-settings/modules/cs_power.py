#!/usr/bin/env python2

from SettingsWidgets import *
from gi.repository import CinnamonDesktop, Gdk, UPowerGlib

POWER_BUTTON_OPTIONS = [
    ("blank", _("Lock the screen")),
    ("suspend", _("Suspend")),
    ("shutdown", _("Shutdown immediately")),
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
    (0, _("Never"))
]

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
            time_sting = ("%d " % hours) + _("hours")
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
        print "Loading Power module"

        self.up_client = UPowerGlib.Client()

        self.csd_power_proxy = Gio.DBusProxy.new_sync(
                Gio.bus_get_sync(Gio.BusType.SESSION, None),
                Gio.DBusProxyFlags.NONE,
                None,
                "org.cinnamon.SettingsDaemon",
                "/org/cinnamon/SettingsDaemon/Power",
                "org.cinnamon.SettingsDaemon.Power",
                None)

        device_types = [x[1] for x in self.csd_power_proxy.GetDevices()]

        self.has_battery = UPowerGlib.DeviceKind.BATTERY in device_types or UPowerGlib.DeviceKind.UPS in device_types
        self.has_lid = self.up_client.get_lid_is_present()

        self.sidePage.stack = SettingsStack()
        self.sidePage.add_widget(self.sidePage.stack)

        # Power

        power_page = SettingsPage()

        section = power_page.add_section(_("Power Options"))

        lid_options, button_power_options, critical_options = get_available_options(self.up_client)

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
            section.add_row(GSettingsComboBox(_("Turn off the screen when inactive for"), CSD_SCHEMA, "sleep-display-ac", SLEEP_DELAY_OPTIONS, valtype="int", size_group=size_group))

            section.add_row(GSettingsComboBox(_("Suspend when inactive for"), CSD_SCHEMA, "sleep-inactive-ac-timeout", SLEEP_DELAY_OPTIONS, valtype="int", size_group=size_group))

            if self.has_lid:
                section.add_row(GSettingsComboBox(_("When the lid is closed"), CSD_SCHEMA, "lid-close-ac-action", lid_options, size_group=size_group))

        section = power_page.add_section(_("Extra options"))

        size_group = Gtk.SizeGroup(mode=Gtk.SizeGroupMode.HORIZONTAL)

        section.add_row(GSettingsComboBox(_("When the power button is pressed"), CSD_SCHEMA, "button-power", button_power_options, size_group=size_group))

        if self.has_battery and UPowerGlib.MAJOR_VERSION == 0 and UPowerGlib.MINOR_VERSION < 99:
            section.add_row(GSettingsComboBox(_("When the battery is critically low"), CSD_SCHEMA, "critical-battery-action", critical_options, size_group=size_group))

        # Batteries

        self.battery_page = SettingsPage()
        self.show_battery_page = False
        self.battery_label_size_group = Gtk.SizeGroup(Gtk.SizeGroupMode.HORIZONTAL)

        self.build_battery_page()
        self.csd_power_proxy.connect("g-properties-changed", self.build_battery_page)

        primary_output = None
        try:
            screen = CinnamonDesktop.RRScreen.new(Gdk.Screen.get_default())
            outputs = CinnamonDesktop.RRScreen.list_outputs(screen)
            for output in outputs:
                if (output.is_connected() and output.is_laptop()):
                    try:
                        # Try to get the backlight info, if it fails just move on (we used to rely on output.get_backlight_min() and output.get_backlight_max() but these aren't reliable)
                        output.get_backlight()
                        primary_output = output
                        break
                    except:
                        pass
        except Exception, detail:
            print "Failed to query backlight information in cs_power module: %s" % detail

        if primary_output is None:
            if self.show_battery_page:
                self.sidePage.stack.add_titled(power_page, "power", _("Power"))
                self.sidePage.stack.add_titled(self.battery_page, "batteries", _("Batteries"))
            else:
                self.sidePage.add_widget(power_page)
            return

        proxy = Gio.DBusProxy.new_sync(
                Gio.bus_get_sync(Gio.BusType.SESSION, None),
                Gio.DBusProxyFlags.NONE,
                None,
                "org.cinnamon.SettingsDaemon",
                "/org/cinnamon/SettingsDaemon/Power",
                "org.cinnamon.SettingsDaemon.Power.Screen",
                None)

        try:
            brightness = proxy.GetPercentage()
        except:
            if self.show_battery_page:
                self.sidePage.stack.add_titled(power_page, "power", _("Power"))
                self.sidePage.stack.add_titled(self.battery_page, "batteries", _("Batteries"))
            else:
                self.sidePage.add_widget(power_page)
        else:
            self.sidePage.stack.add_titled(power_page, "power", _("Power"))
            if self.show_battery_page:
                self.sidePage.stack.add_titled(self.battery_page, "batteries", _("Batteries"))

            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "brightness", _("Brightness"))

            size_group = Gtk.SizeGroup(mode=Gtk.SizeGroupMode.HORIZONTAL)

            section = page.add_section(_("Screen brightness"))
            section.add_row(BrightnessSlider(section, proxy))

            section.add_row(GSettingsSwitch(_("On battery, dim screen when inactive"), "org.cinnamon.settings-daemon.plugins.power", "idle-dim-battery"))

            section.add_reveal_row(GSettingsComboBox(_("Brightness level when inactive"), "org.cinnamon.settings-daemon.plugins.power", "idle-brightness", IDLE_BRIGHTNESS_OPTIONS, valtype="int", size_group=size_group), "org.cinnamon.settings-daemon.plugins.power", "idle-dim-battery")

            section.add_reveal_row(GSettingsComboBox(_("Dim screen after inactive for"), "org.cinnamon.settings-daemon.plugins.power", "idle-dim-time", IDLE_DELAY_OPTIONS, valtype="int", size_group=size_group), "org.cinnamon.settings-daemon.plugins.power", "idle-dim-battery")

    def build_battery_page(self, *args):
        #destroy all widgets in this page
        self.battery_page.foreach(Gtk.Widget.destroy, None)

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
            if device[1] == UPowerGlib.DeviceKind.UPS and device[4] == UPowerGlib.DeviceState.DISCHARGING:
                ups_as_primary = True

        for device in devices:
            if device[1] == UPowerGlib.DeviceKind.LINE_POWER:
                pass # Do nothing
            elif device[1] == UPowerGlib.DeviceKind.UPS and ups_as_primary:
                if not primary_settings:
                    primary_settings = self.battery_page.add_section(_("Batteries"))
                    primary_settings.add_row(self.set_device_ups_primary(device))
                    self.show_battery_page = True
                else:
                    primary_settings.add_row(self.set_device_ups_primary(device))
            elif device[1] == UPowerGlib.DeviceKind.BATTERY and not ups_as_primary:
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
        percentage = device[3]
        state = device[4]
        time = device[5]
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

        widget = self.create_battery_row("battery", _("UPS"), percentage, details)
        return widget

    def set_device_battery_primary(self, device):
        percentage = device[3]
        state = device[4]
        time = device[5]
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

        widget = self.create_battery_row("battery", _("Battery"), percentage, details)
        return widget

    def set_device_battery_additional(self, device):
        state = device[4]
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
        kind = device[1]
        percentage = device[3]

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

        widget = self.create_battery_row(icon_name, desc, percentage)
        return widget

    def create_battery_row(self, icon_name, desc, percentage, details=None):
        widget = SettingsWidget()

        vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        hbox = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL)
        label_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=15)

        image = Gtk.Image.new_from_icon_name(icon_name, Gtk.IconSize.DND)
        label = Gtk.Label()
        label.set_markup(desc)
        label_box.pack_start(image, False, False, 0)
        label_box.pack_start(label, False, False, 0)
        self.battery_label_size_group.add_widget(label_box)
        hbox.pack_start(label_box, False, False, 0)
        label = Gtk.Label()
        label.set_markup("%d%%" % int(percentage))
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
        vbox.pack_start(hbox, False, False, 0)

        if details:
            label = Gtk.Label()
            label.set_markup(details)
            label.get_style_context().add_class("dim-label")
            vbox.pack_end(label, False, False, 0)

        widget.pack_start(vbox, True, True, 0)

        return widget

def get_available_options(up_client):
    can_suspend = False
    can_hibernate = False

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
    except:
        pass

    # New versions of upower does not have get_can_suspend function
    try:
        can_suspend = can_suspend or up_client.get_can_suspend()
        can_hibernate = can_hibernate or up_client.get_can_hibernate()
    except:
        pass

    def remove(options, item):
        for option in options:
            if option[0] == item:
                options.remove(option)
                break

    lid_options = [
        ("suspend", _("Suspend")),
        ("hibernate", _("Hibernate")),
        ("nothing", _("Do nothing"))
    ]

    button_power_options = [
        ("blank", _("Lock Screen")),
        ("suspend", _("Suspend")),
        ("shutdown", _("Shutdown immediately")),
        ("hibernate", _("Hibernate")),
        ("interactive", _("Ask")),
        ("nothing", _("Do nothing"))
    ]

    critical_options = [
        ("hibernate", _("Hibernate")),
        ("nothing", _("Do nothing"))
    ]

    if not can_suspend:
        for options in lid_options, button_power_options, critical_options:
            remove(options, "suspend")

    if not can_hibernate:
        for options in lid_options, button_power_options, critical_options:
            remove(options, "hibernate")

    return lid_options, button_power_options, critical_options

class BrightnessSlider(SettingsWidget):
    step = 5

    def __init__(self, section, proxy):
        super(BrightnessSlider, self).__init__()
        self.set_orientation(Gtk.Orientation.VERTICAL)
        self.set_spacing(0)

        self.timer = None
        self.section = section
        self.proxy = proxy

        hbox = Gtk.Box()

        self.label = Gtk.Label.new(_("Screen brightness"))
        self.label.set_halign(Gtk.Align.CENTER)

        self.min_label= Gtk.Label()
        self.max_label = Gtk.Label()
        self.min_label.set_alignment(1.0, 0.75)
        self.max_label.set_alignment(1.0, 0.75)
        self.min_label.set_margin_right(6)
        self.max_label.set_margin_left(6)
        self.min_label.set_markup("<i><small>0%</small></i>")
        self.max_label.set_markup("<i><small>100%</small></i>")

        self.content_widget = Gtk.Scale.new_with_range(Gtk.Orientation.HORIZONTAL, 1, 100, 5)
        self.content_widget.set_draw_value(False)

        hbox.pack_start(self.min_label, False, False, 0)
        hbox.pack_start(self.content_widget, True, True, 0)
        hbox.pack_start(self.max_label, False, False, 0)

        self.pack_start(self.label, False, False, 0)
        self.pack_start(hbox, True, True, 6)

        self.on_dbus_changed()

        self.proxy.connect("g-signal", self.on_dbus_changed)
        self.content_widget.connect("scroll-event", self.on_scroll_event)
        self.content_widget.connect("value-changed", self.apply_later)

    def apply_later(self, *args):
        def apply(self):
            self.proxy.SetPercentage("(u)", self.content_widget.get_value())
            self.timer = None

        if self.timer:
            GLib.source_remove(self.timer)
        self.timer = GLib.timeout_add(300, apply, self)

    def on_scroll_event(self, widget, event):
        found, delta_x, delta_y = event.get_scroll_deltas()

        # If you scroll up, delta_y < 0. This is a weird world
        widget.set_value(widget.get_value() - delta_y * self.step)

        return True

    def on_dbus_changed(self, *args):
        try:
            brightness = self.proxy.GetPercentage()
            self.content_widget.set_value(brightness)
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
