#!/usr/bin/python3

from ChooserButtonWidgets import DateChooserButton, TimeChooserButton
from SettingsWidgets import SidePage
from xapp.GSettingsWidgets import *
import pytz
import gi
import datetime
import os
gi.require_version('TimezoneMap', '1.0')
from gi.repository import TimezoneMap

class Module:
    name = "calendar"
    comment = _("Manage date and time settings")
    category = "prefs"

    def __init__(self, content_box):
        keywords = _("time, date, calendar, format, network, sync")
        self.sidePage = SidePage(_("Date & Time"), "cs-date-time", keywords, content_box, 560, module=self)

    def on_module_selected(self):
        if not self.loaded:
            print("Loading Calendar module")

            page = SettingsPage()
            self.sidePage.add_widget(page)

            settings = page.add_section(_("Date and Time"))
            widget = SettingsWidget()
            self.tz_map = TimezoneMap.TimezoneMap.new()
            self.tz_map.set_size_request(-1, 205)
            widget.pack_start(self.tz_map, True, True, 0)
            settings.add_row(widget)

            self.tz_selector = TimeZoneSelector()
            settings.add_row(self.tz_selector)

            self.ntp_switch = Switch(_("Network time"))
            settings.add_row(self.ntp_switch)

            self.set_time_row = SettingsWidget()
            self.revealer = SettingsRevealer()
            settings.add_reveal_row(self.set_time_row, revealer=self.revealer)
            self.set_time_row.pack_start(Gtk.Label(_("Manually set date and time")), False, False, 0)
            self.date_chooser = DateChooserButton(True)
            self.time_chooser = TimeChooserButton(True)
            self.set_time_row.pack_end(self.time_chooser, False, False, 0)
            self.set_time_row.pack_end(self.date_chooser, False, False, 0)
            self.date_chooser.connect('date-changed', self.set_date_and_time)
            self.time_chooser.connect('time-changed', self.set_date_and_time)

            settings = page.add_section(_("Format"))
            settings.add_row(GSettingsSwitch(_("Use 24h clock"), "org.cinnamon.desktop.interface", "clock-use-24h"))
            settings.add_row(GSettingsSwitch(_("Display the date"), "org.cinnamon.desktop.interface", "clock-show-date"))
            settings.add_row(GSettingsSwitch(_("Display seconds"), "org.cinnamon.desktop.interface", "clock-show-seconds"))
            days = [[7, _("Use locale default")], [0, _("Sunday")], [1, _("Monday")]]
            settings.add_row(GSettingsComboBox(_("First day of week"), "org.cinnamon.desktop.interface", "first-day-of-week", days, valtype=int))

            if os.path.exists('/usr/sbin/ntpd'):
                print('using csd backend')
                self.proxy_handler = CsdDBusProxyHandler(self._on_proxy_ready)
            else:
                print('using systemd backend')
                self.proxy_handler = SytemdDBusProxyHandler(self._on_proxy_ready)

            self.sync_24h_to_gnome()

    def _on_proxy_ready(self):
        self.zone = self.proxy_handler.get_timezone()
        if self.zone is None:
            self.tz_map.set_sensitive(False)
            self.tz_selector.set_sensitive(False)
        else:
            self.tz_map.set_timezone(self.zone)
            self.tz_map.connect('location-changed', self.on_map_location_changed)
            self.tz_selector.set_timezone(self.zone)
            self.tz_selector.connect('timezone-changed', self.on_selector_location_changed)
        can_use_ntp, is_using_ntp = self.proxy_handler.get_ntp()
        self.ntp_switch.set_sensitive(can_use_ntp)
        self.ntp_switch.content_widget.set_active(is_using_ntp)
        self.ntp_switch.content_widget.connect('notify::active', self.on_ntp_changed)
        self.revealer.set_reveal_child(not is_using_ntp)

    def sync_24h_to_gnome(self):
        # Firefox (and maybe other apps?) check gnome's 24h setting only. It'd be
        # messy to change it in firefox since our setting is a boolean and their's
        # is a string, so just update the gnome preference when the user changes ours.
        self.our_settings = Gio.Settings(schema_id="org.cinnamon.desktop.interface")
        self.gnome_settings = Gio.Settings(schema_id="org.gnome.desktop.interface")

        self.our_settings.connect("changed::clock-use-24h", self.update_gnome_24h)
        self.update_gnome_24h()

    def update_gnome_24h(self, settings=None, pspec=None):
        if self.our_settings.get_boolean("clock-use-24h"):
            self.gnome_settings.set_string("clock-format", "24h")
        else:
            self.gnome_settings.set_string("clock-format", "12h")

    def on_map_location_changed(self, *args):
        zone = self.tz_map.get_location().props.zone
        if zone == self.zone:
            return

        self.tz_selector.set_timezone(zone)
        self.set_timezone(zone)

    def on_selector_location_changed(self, *args):
        zone = self.tz_selector.get_timezone()
        if zone == self.zone:
            return

        self.set_timezone(zone)
        self.tz_map.set_timezone(zone)

    def set_timezone(self, zone):
        self.zone = zone
        self.proxy_handler.set_timezone(zone)

    def on_ntp_changed(self, *args):
        active = self.ntp_switch.content_widget.get_active()
        self.revealer.set_reveal_child(not active)
        self.proxy_handler.set_ntp(active)

    def set_date_and_time(self, *args):
        unaware = datetime.datetime.combine(self.date_chooser.get_date(), self.time_chooser.get_time())
        tz = pytz.timezone(self.zone)
        self.datetime = tz.localize(unaware)

        seconds = int((self.datetime - datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)).total_seconds())
        self.proxy_handler.set_time(seconds)

class SytemdDBusProxyHandler(object):
    def __init__(self, proxy_ready_callback):
        self.proxy_ready_callback = proxy_ready_callback
        try:
            Gio.DBusProxy.new_for_bus(Gio.BusType.SYSTEM, Gio.DBusProxyFlags.NONE, None,
                                      'org.freedesktop.timedate1',
                                      '/org/freedesktop/timedate1',
                                      'org.freedesktop.timedate1',
                                      None, self._on_proxy_ready, None)
        except dbus.exceptions.DBusException as e:
            print(e)
            self._proxy = None

    def _on_proxy_ready(self, object, result, data=None):
        self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
        self.proxy_ready_callback()

    def get_timezone(self):
        if not self._proxy:
            return None
        return str(self._proxy.get_cached_property('Timezone')).lstrip('\'').rstrip('\'')

    def get_ntp(self):
        if not self._proxy:
            return False, False
        can_use_ntp = self._proxy.get_cached_property('CanNTP')
        using_ntp = self._proxy.get_cached_property('NTP')
        return can_use_ntp, using_ntp

    def set_timezone(self, zone):
        if self._proxy:
            self._proxy.SetTimezone('(sb)', zone, True)

    def set_ntp(self, active):
        if self._proxy:
            # not passing a callback to the dbus function will cause it to run synchronously and freeze the ui
            def async_empty_callback(*args, **kwargs):
                pass
            self._proxy.SetNTP('(bb)', active, True, result_handler=async_empty_callback)

    def set_time(self, seconds):
        if self._proxy:
            self._proxy.SetTime('(xbb)', seconds * 1000000, False, True)


class CsdDBusProxyHandler(object):
    def __init__(self, proxy_ready_callback):
        self.proxy_ready_callback = proxy_ready_callback
        try:
            Gio.DBusProxy.new_for_bus(Gio.BusType.SYSTEM, Gio.DBusProxyFlags.NONE, None,
                                      'org.cinnamon.SettingsDaemon.DateTimeMechanism',
                                      '/org/cinnamon/SettingsDaemon/DateTimeMechanism',
                                      'org.cinnamon.SettingsDaemon.DateTimeMechanism',
                                      None, self._on_proxy_ready, None)
        except dbus.exceptions.DBusException as e:
            print(e)
            self._proxy = None

    def _on_proxy_ready(self, object, result, data=None):
        self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
        self.proxy_ready_callback()

    def get_timezone(self):
        return self._proxy.GetTimezone()

    def get_ntp(self):
        return self._proxy.GetUsingNtp()

    def set_timezone(self, zone):
        self._proxy.SetTimezone('(s)', zone)

    def set_ntp(self, active):
        # not passing a callback to the dbus function will cause it to run synchronously and freeze the ui
        def async_empty_callback(*args, **kwargs):
            pass
        self._proxy.SetUsingNtp('(b)', active, result_handler=async_empty_callback)

    def set_time(self, seconds):
        self._proxy.SetTime('(x)', seconds)


class TimeZoneSelector(SettingsWidget):
    __gsignals__ = {
        'timezone-changed': (GObject.SignalFlags.RUN_FIRST, None, (str,))
    }

    def __init__(self):
        super(TimeZoneSelector, self).__init__()

        self.pack_start(Gtk.Label(_("Region")), False, False, 0)
        self.region_combo = Gtk.ComboBox()
        self.pack_start(self.region_combo, False, False, 0)
        self.pack_start(Gtk.Label(_("City")), False, False, 0)
        self.city_combo = Gtk.ComboBox()
        self.pack_start(self.city_combo, False, False, 0)
        self.region_combo.connect('changed', self.on_region_changed)
        self.city_combo.connect('changed', self.on_city_changed)

        self.region_list = Gtk.ListStore(str, str)
        self.region_combo.set_model(self.region_list)
        renderer_text = Gtk.CellRendererText()
        self.region_combo.pack_start(renderer_text, True)
        self.region_combo.add_attribute(renderer_text, "text", 1)
        self.region_combo.set_id_column(0)

        renderer_text = Gtk.CellRendererText()
        self.city_combo.pack_start(renderer_text, True)
        self.city_combo.add_attribute(renderer_text, "text", 1)
        self.city_combo.set_id_column(0)

        self.region_map = {}
        for tz in pytz.common_timezones:
            try:
                region, city = tz.split('/', maxsplit=1)
                city_display_name = city.replace("_"," ")
            except:
                continue

            if region not in self.region_map:
                self.region_map[region] = Gtk.ListStore(str, str)
                self.region_list.append([region, _(region)])
            self.region_map[region].append([city, _(city_display_name)])

    def set_timezone(self, timezone):
        if timezone == "Etc/UTC" or timezone == "Universal":
            return

        self.timezone = timezone
        region, city = timezone.split('/', maxsplit=1)
        self.region_combo.set_active_id(region)
        self.city_combo.set_model(self.region_map[region])
        self.city_combo.set_active_id(city)

    def on_region_changed(self, *args):
        region = self.region_combo.get_active_id()
        self.city_combo.set_model(self.region_map[region])

    def on_city_changed(self, *args):
        self.timezone = '/'.join([self.region_combo.get_active_id(), self.city_combo.get_active_id()])
        self.emit('timezone-changed', self.timezone)

    def get_timezone(self):
        return self.timezone
