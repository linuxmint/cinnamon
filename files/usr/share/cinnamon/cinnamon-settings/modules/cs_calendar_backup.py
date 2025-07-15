#!/usr/bin/python3

from ChooserButtonWidgets import DateChooserButton, TimeChooserButton
from SettingsWidgets import SidePage, GSettingsKeybinding
from xapp.GSettingsWidgets import *
import pytz
import gi
import datetime
import os
gi.require_version('TimezoneMap', '1.0')
gi.require_version('Gtk', '3.0')
from gi.repository import TimezoneMap, Gtk

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

            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            # Timezone
            page = SettingsPage()
            self.sidePage.stack.add_titled(page, "timezone", _("Date and Time"))
            
            settings = page.add_section(_("Date and Time"))

            widget = SettingsWidget()
            settings.add_row(widget)

            self.tz_map = TimezoneMap.TimezoneMap()
            widget.pack_start(self.tz_map, True, True, 0)

            self.tz_selector = TimeZoneSelector()
            widget.pack_start(self.tz_selector, False, False, 0)

            self.revealer = SettingsRevealer()
            widget.pack_start(self.revealer, False, False, 0)

            self.revealer_widget = SettingsWidget()
            self.revealer.add(self.revealer_widget)

            self.ntp_switch = GSettingsSwitch(_("Network time"), "org.cinnamon.desktop.datetime", "automatic-timezone")
            self.revealer_widget.pack_start(self.ntp_switch, False, False, 0)

            self.date_chooser = DateChooserButton()
            self.revealer_widget.pack_start(self.date_chooser, False, False, 0)

            self.time_chooser = TimeChooserButton()
            self.revealer_widget.pack_start(self.time_chooser, False, False, 0)

            self.time_chooser.connect('time-changed', self.set_date_and_time)

            # Podstawowe ustawienia formatowania
            settings = page.add_section(_("Format"))
            settings.add_row(GSettingsSwitch(_("Use 24h clock"), "org.cinnamon.desktop.interface", "clock-use-24h"))
            settings.add_row(GSettingsSwitch(_("Display the date"), "org.cinnamon.desktop.interface", "clock-show-date"))
            settings.add_row(GSettingsSwitch(_("Display seconds"), "org.cinnamon.desktop.interface", "clock-show-seconds"))
            days = [[7, _("Use locale default")], [0, _("Sunday")], [1, _("Monday")]]
            settings.add_row(GSettingsComboBox(_("First day of week"), "org.cinnamon.desktop.interface", "first-day-of-week", days, valtype=int))

            # ========================================
            # SEKCJA 1: KALENDARZ
            # ========================================
            calendar_page = SettingsPage()
            self.sidePage.stack.add_titled(calendar_page, "calendar", _("Calendar"))
            
            # Ustawienia kalendarza
            calendar_settings = calendar_page.add_section(_("Calendar Settings"))
            calendar_settings.add_row(GSettingsSwitch(_("Show calendar events"), "org.cinnamon.applets.calendar", "show-events"))
            calendar_settings.add_row(GSettingsSwitch(_("Show week numbers in calendar"), "org.cinnamon.applets.calendar", "show-week-numbers"))
            
            # Format daty w kalendarzu
            calendar_format_settings = calendar_page.add_section(_("Calendar Date Format"))
            
            # Advanced Date Format section
            advanced_settings = calendar_format_settings.add_section(_("Advanced Date Format"))
            
            # OS Format type selection
            os_format_options = [
                (_("Linux Mint"), "linuxmint"),
                (_("macOS"), "macos"),
                (_("Windows 10"), "windows10"),
                (_("Windows 11"), "windows11"),
                (_("Ubuntu"), "ubuntu"),
                (_("Windows 7"), "windows7"),
                (_("GNOME"), "gnome"),
                (_("KDE"), "kde")
            ]
            
            self.calendar_os_format_combo = GSettingsComboBox(_("Operating system style"), "org.cinnamon.applets.calendar", "os-format-type", os_format_options)
            advanced_settings.add_row(self.calendar_os_format_combo)
            
            # Time format options
            self.calendar_24h_switch = GSettingsSwitch(_("Use 24-hour time format"), "org.cinnamon.applets.calendar", "use-24h-format")
            advanced_settings.add_row(self.calendar_24h_switch)
            
            self.calendar_seconds_switch = GSettingsSwitch(_("Show seconds in time"), "org.cinnamon.applets.calendar", "show-seconds")
            advanced_settings.add_row(self.calendar_seconds_switch)
            
            # Date separator options
            separator_options = [
                (_("Slash (/)"), "/"),
                (_("Dash (-)"), "-"),
                (_("Dot (.)"), ".")
            ]
            
            self.calendar_separator_combo = GSettingsComboBox(_("Date separator"), "org.cinnamon.applets.calendar", "date-separator", separator_options)
            advanced_settings.add_row(self.calendar_separator_combo)
            
            # Custom format switch
            self.calendar_custom_switch = GSettingsSwitch(_("Use custom date format"), "org.cinnamon.applets.calendar", "use-custom-format")
            advanced_settings.add_row(self.calendar_custom_switch)
            
            # Custom format entry
            self.calendar_custom_entry = GSettingsEntry(_("Custom format"), "org.cinnamon.applets.calendar", "custom-format")
            advanced_settings.add_row(self.calendar_custom_entry)
            
            # Format reference button
            self.format_button = Button(_("Show/Hide format reference"))
            self.format_button.content_widget.connect("clicked", self.on_format_button_clicked)
            advanced_settings.add_row(self.format_button)
            
            # Format help revealer
            self.format_help_revealer = SettingsRevealer()
            self.format_help_widget = SettingsWidget()
            advanced_settings.add_reveal_row(self.format_help_widget, revealer=self.format_help_revealer)
            
            # Format help content
            help_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
            
            # Header
            header_label = Gtk.Label()
            header_label.set_markup("<b>" + _("Date Format Reference") + "</b>")
            help_box.pack_start(header_label, False, False, 0)
            
            # Two column layout
            columns_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=20)
            
            # Left column - Date codes
            left_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
            left_header = Gtk.Label()
            left_header.set_markup("<b>" + _("Date codes") + "</b>")
            left_box.pack_start(left_header, False, False, 0)
            
            date_codes = [
                ("%Y", "2024 (Year)"),
                ("%m", "01 (Month number)"),
                ("%d", "15 (Day of month)"),
                ("%A", "Monday (Full weekday)"),
                ("%a", "Mon (Short weekday)"),
                ("%B", "January (Full month)"),
                ("%b", "Jan (Short month)")
            ]
            
            for code, desc in date_codes:
                label = Gtk.Label()
                label.set_markup(f"<tt>{code}</tt> → {desc}")
                label.set_halign(Gtk.Align.START)
                left_box.pack_start(label, False, False, 0)
            
            # Right column - Time codes
            right_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
            right_header = Gtk.Label()
            right_header.set_markup("<b>" + _("Time codes") + "</b>")
            right_box.pack_start(right_header, False, False, 0)
            
            time_codes = [
                ("%H", "13 (Hour 24h)"),
                ("%I", "01 (Hour 12h)"),
                ("%M", "30 (Minutes)"),
                ("%S", "45 (Seconds)"),
                ("%p", "AM/PM"),
                ("%n", "New line")
            ]
            
            for code, desc in time_codes:
                label = Gtk.Label()
                label.set_markup(f"<tt>{code}</tt> → {desc}")
                label.set_halign(Gtk.Align.START)
                right_box.pack_start(label, False, False, 0)
            
            columns_box.pack_start(left_box, True, True, 0)
            columns_box.pack_start(right_box, True, True, 0)
            help_box.pack_start(columns_box, False, False, 0)
            
            # Footer
            footer_label = Gtk.Label()
            footer_label.set_markup("<i>" + _("Type 'man strftime' in terminal for complete reference") + "</i>")
            help_box.pack_start(footer_label, False, False, 0)
            
            self.format_help_widget.pack_start(help_box, True, True, 0)
            
            # Tooltip format
            self.tooltip_format_entry = GSettingsEntry(_("Date format for tooltip"), "org.cinnamon.applets.calendar", "custom-tooltip-format")
            advanced_settings.add_row(self.tooltip_format_entry)
            
            # Display locations section
            locations_settings = calendar_page.add_section(_("Display Locations"))
            
            # Applet display format
            self.applet_format_entry = GSettingsEntry(_("Date format in applet"), "org.cinnamon.applets.calendar", "applet-format")
            locations_settings.add_row(self.applet_format_entry)
            
            # Tooltip display format  
            self.tooltip_display_entry = GSettingsEntry(_("Date format in tooltip"), "org.cinnamon.applets.calendar", "tooltip-format")
            locations_settings.add_row(self.tooltip_display_entry)
            
            # Screensaver display format
            self.screensaver_format_entry = GSettingsEntry(_("Date format on screensaver"), "org.cinnamon.applets.calendar", "screensaver-format")
            locations_settings.add_row(self.screensaver_format_entry)
            
            # Calendar display options
            display_settings = calendar_page.add_section(_("Calendar Display"))
            display_settings.add_row(GSettingsSwitch(_("Show calendar events"), "org.cinnamon.applets.calendar", "show-events"))
            display_settings.add_row(GSettingsSwitch(_("Show week numbers in calendar"), "org.cinnamon.applets.calendar", "show-week-numbers"))
            
            # Keyboard shortcuts
            shortcuts_settings = calendar_page.add_section(_("Keyboard Shortcuts"))
            shortcuts_settings.add_row(GSettingsKeybinding(_("Show calendar"), "org.cinnamon.applets.calendar", "key-open"))

            # ========================================
            # SEKCJA 2: GODZINA SYSTEMOWA
            # ========================================
            system_time_page = SettingsPage()
            self.sidePage.stack.add_titled(system_time_page, "system-time", _("System Time"))
            
            # Format godziny systemowej
            system_time_settings = system_time_page.add_section(_("System Time Format"))
            
            # Własny format dla godziny systemowej
            self.system_time_custom_switch = GSettingsSwitch(_("Use custom time format"), "org.cinnamon.applets.calendar", "use-system-custom-format")
            system_time_settings.add_row(self.system_time_custom_switch)
            
            self.system_time_format_entry = GSettingsEntry(_("System time format"), "org.cinnamon.applets.calendar", "system-time-format")
            system_time_settings.add_row(self.system_time_format_entry)
            
            # Tooltip godziny systemowej
            system_tooltip_settings = system_time_page.add_section(_("System Time Tooltip"))
            self.system_tooltip_format_entry = GSettingsEntry(_("Tooltip format"), "org.cinnamon.applets.calendar", "system-tooltip-format")
            system_tooltip_settings.add_row(self.system_tooltip_format_entry)

            # ========================================
            # SEKCJA 3: WYGASZACZ EKRANU
            # ========================================
            screensaver_page = SettingsPage()
            self.sidePage.stack.add_titled(screensaver_page, "screensaver", _("Screensaver"))
            
            # Format daty/czasu na wygaszaczu
            screensaver_settings = screensaver_page.add_section(_("Screensaver Date & Time"))
            
            self.screensaver_custom_switch = GSettingsSwitch(_("Use custom screensaver format"), "org.cinnamon.applets.calendar", "use-screensaver-custom-format")
            screensaver_settings.add_row(self.screensaver_custom_switch)
            
            self.screensaver_format_entry = GSettingsEntry(_("Screensaver format"), "org.cinnamon.applets.calendar", "screensaver-format")
            screensaver_settings.add_row(self.screensaver_format_entry)
            
            # Pozycja na wygaszaczu
            screensaver_position_settings = screensaver_page.add_section(_("Screensaver Position"))
            
            position_options = [
                (_("Top Left"), "top-left"),
                (_("Top Center"), "top-center"),
                (_("Top Right"), "top-right"),
                (_("Center Left"), "center-left"),
                (_("Center"), "center"),
                (_("Center Right"), "center-right"),
                (_("Bottom Left"), "bottom-left"),
                (_("Bottom Center"), "bottom-center"),
                (_("Bottom Right"), "bottom-right")
            ]
            
            self.screensaver_position_combo = GSettingsComboBox(_("Date position on screensaver"), "org.cinnamon.applets.calendar", "screensaver-position", position_options)
            screensaver_position_settings.add_row(self.screensaver_position_combo)

            # ========================================
            # POMOC Z FORMATAMI (wspólna dla wszystkich)
            # ========================================
            help_page = SettingsPage()
            self.sidePage.stack.add_titled(help_page, "format-help", _("Format Help"))
            
            # Format help content
            help_settings = help_page.add_section(_("Date Format Reference"))
            
            help_widget = SettingsWidget()
            help_settings.add_row(help_widget)
            
            help_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
            
            # Two column layout
            columns_box = Gtk.Box(orientation=Gtk.Orientation.HORIZONTAL, spacing=20)
            
            # Left column - Date codes
            left_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
            left_header = Gtk.Label()
            left_header.set_markup("<b>" + _("Date codes") + "</b>")
            left_box.pack_start(left_header, False, False, 0)
            
            date_codes = [
                ("%Y", "2024 (Year)"),
                ("%m", "01 (Month number)"),
                ("%d", "15 (Day of month)"),
                ("%A", "Monday (Full weekday)"),
                ("%a", "Mon (Short weekday)"),
                ("%B", "January (Full month)"),
                ("%b", "Jan (Short month)")
            ]
            
            for code, desc in date_codes:
                label = Gtk.Label()
                label.set_markup(f"<tt>{code}</tt> → {desc}")
                label.set_halign(Gtk.Align.START)
                left_box.pack_start(label, False, False, 0)
            
            # Right column - Time codes
            right_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=3)
            right_header = Gtk.Label()
            right_header.set_markup("<b>" + _("Time codes") + "</b>")
            right_box.pack_start(right_header, False, False, 0)
            
            time_codes = [
                ("%H", "13 (Hour 24h)"),
                ("%I", "01 (Hour 12h)"),
                ("%M", "30 (Minutes)"),
                ("%S", "45 (Seconds)"),
                ("%p", "AM/PM"),
                ("%n", "New line")
            ]
            
            for code, desc in time_codes:
                label = Gtk.Label()
                label.set_markup(f"<tt>{code}</tt> → {desc}")
                label.set_halign(Gtk.Align.START)
                right_box.pack_start(label, False, False, 0)
            
            columns_box.pack_start(left_box, True, True, 0)
            columns_box.pack_start(right_box, True, True, 0)
            help_box.pack_start(columns_box, False, False, 0)
            
            # Footer
            footer_label = Gtk.Label()
            footer_label.set_markup("<i>" + _("Type 'man strftime' in terminal for complete reference") + "</i>")
            help_box.pack_start(footer_label, False, False, 0)
            
            help_widget.pack_start(help_box, True, True, 0)

            # Connect signals for dependency management
            self.calendar_custom_switch.content_widget.connect("notify::active", self.on_calendar_custom_toggled)
            self.system_time_custom_switch.content_widget.connect("notify::active", self.on_system_time_custom_toggled)
            self.screensaver_custom_switch.content_widget.connect("notify::active", self.on_screensaver_custom_toggled)
            
            # Set initial states
            self.on_calendar_custom_toggled()
            self.on_system_time_custom_toggled()
            self.on_screensaver_custom_toggled()

            if os.path.exists('/usr/sbin/ntpd'):
                print('using csd backend')
                self.proxy_handler = CsdDBusProxyHandler(self._on_proxy_ready)
            else:
                print('using systemd backend')
                self.proxy_handler = SytemdDBusProxyHandler(self._on_proxy_ready)

            self.sync_24h_to_gnome()

    def on_format_button_clicked(self, widget):
        """Toggle format help visibility"""
        self.format_help_visible = not self.format_help_visible
        self.format_help_revealer.set_reveal_child(self.format_help_visible)
        
        if self.format_help_visible:
            self.format_button.set_label(_("Hide format reference"))
        else:
            self.format_button.set_label(_("Show format reference"))

    def on_custom_format_toggled(self, *args):
        """Handle custom format switch toggle to show/hide dependent widgets"""
        use_custom = self.custom_format_switch.content_widget.get_active()
        
        # Enable/disable OS format options (opposite of custom)
        self.os_format_combo.set_sensitive(not use_custom)
        self.time_24h_switch.set_sensitive(not use_custom)
        self.show_seconds_switch.set_sensitive(not use_custom)
        self.date_separator_combo.set_sensitive(not use_custom)
        
        # Enable/disable custom format widgets
        self.custom_format_entry.set_sensitive(use_custom)
        self.format_button.set_sensitive(use_custom)
        self.tooltip_format_entry.set_sensitive(use_custom)
        self.applet_format_entry.set_sensitive(use_custom)
        self.tooltip_display_entry.set_sensitive(use_custom)
        self.screensaver_format_entry.set_sensitive(use_custom)
        
        # Hide format help if switching away from custom
        if not use_custom and self.format_help_visible:
            self.format_help_visible = False
            self.format_help_revealer.set_reveal_child(False)
            self.format_button.set_label(_("Show format reference"))

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

    def on_calendar_custom_toggled(self, *args):
        """Handle calendar custom format switch toggle"""
        use_custom = self.calendar_custom_switch.content_widget.get_active()
        
        # Enable/disable OS format options for calendar
        self.calendar_os_format_combo.set_sensitive(not use_custom)
        self.calendar_24h_switch.set_sensitive(not use_custom)
        self.calendar_seconds_switch.set_sensitive(not use_custom)
        self.calendar_separator_combo.set_sensitive(not use_custom)
        
        # Enable/disable custom format entry for calendar
        self.calendar_custom_entry.set_sensitive(use_custom)

    def on_system_time_custom_toggled(self, *args):
        """Handle system time custom format switch toggle"""
        use_custom = self.system_time_custom_switch.content_widget.get_active()
        
        # Enable/disable custom format entries
        self.system_time_format_entry.set_sensitive(use_custom)
        self.system_tooltip_format_entry.set_sensitive(use_custom)

    def on_screensaver_custom_toggled(self, *args):
        """Handle screensaver custom format switch toggle"""
        use_custom = self.screensaver_custom_switch.content_widget.get_active()
        
        # Enable/disable custom format entry for screensaver
        self.screensaver_format_entry.set_sensitive(use_custom)

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
