#!/usr/bin/python3

import datetime
import os
import pytz
import gi
gi.require_version('TimezoneMap', '1.0')
from SettingsWidgets import SidePage, SettingsWidget, SettingsLabel, GSettingsKeybinding, TwoColumnLabelRow
from xapp.GSettingsWidgets import *
from ChooserButtonWidgets import DateChooserButton, TimeChooserButton
from gi.repository import Gio, Gtk, GObject, TimezoneMap

# Requires python3-tz (debian)
try:
    import dbus  # Optional, only used for catching specific DBus exceptions
except Exception:
    dbus = None

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

            # Główny stack z 3 sekcjami
            self.sidePage.stack = SettingsStack()
            self.sidePage.add_widget(self.sidePage.stack)

            # ========================================
            # SEKCJA 1: DATA I CZAS (tylko ogólne ustawienia systemowe)
            # ========================================
            datetime_page = SettingsPage()
            self.sidePage.stack.add_titled(datetime_page, "datetime", _("Date & Time"))

            # Oryginalna sekcja timezone
            settings = datetime_page.add_section(_("Date and Time"))
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

            # ========================================
            # SEKCJA 2: KALENDARZ (ustawienia + formatowanie kalendarza)
            # ========================================
            calendar_page = SettingsPage()
            self.sidePage.stack.add_titled(calendar_page, "calendar", _("Calendar"))
            
            # Sekcja 1: Podstawowe ustawienia kalendarza
            # Calendar settings section
            calendar_settings = calendar_page.add_section(_("Calendar Settings"))
            calendar_settings.add_row(GSettingsSwitch(_("Show calendar events"), "org.cinnamon.applets.calendar", "show-events"))
            calendar_settings.add_row(GSettingsSwitch(_("Show week numbers in calendar"), "org.cinnamon.applets.calendar", "show-week-numbers"))
            calendar_settings.add_row(GSettingsSwitch(_("Show weekday headers in calendar"), "org.cinnamon.applets.calendar", "show-weekday-headers"))
            calendar_settings.add_row(GSettingsKeybinding(_("Show calendar"), "org.cinnamon.applets.calendar", "key-open"))
            days = [[7, _("Use locale default")], [0, _("Sunday")], [1, _("Monday")]]
            calendar_settings.add_row(GSettingsComboBox(_("First day of week"), "org.cinnamon.desktop.interface", "first-day-of-week", days, valtype=int))
            
            # Sekcja 2: Formatowanie appletu (główny przełącznik + opcje)
            applet_format = calendar_page.add_section(_("Time Applet"))
            
            # Główny przełącznik
            use_custom_switch = GSettingsSwitch(_("Use custom date format"), "org.cinnamon.applets.calendar", "use-custom-format")
            applet_format.add_row(use_custom_switch)
            
            # === OPCJE SYSTEMOWE (widoczne gdy use-custom-format = false) ===
            # GSettingsComboBox expects [value, label]
            format_style_options = [
                ("Linux Mint", _("Linux Mint Style (Mon Jan 15 14:30)")),
                ("macOS", _("macOS Style (Mon Jan 15 14:30)")), 
                ("Windows 10", _("Windows 10 Style (14:30 Mon Jan 15)")),
                ("Windows 11", _("Windows 11 Style (14:30 Mon, Jan 15)")),
                ("Ubuntu", _("Ubuntu Style (Mon 15 Jan 2024 14:30)")),
                ("Windows 7", _("Windows 7 Style (14:30 01/15/2024)")),
                ("GNOME", _("GNOME Style (Mon 15 Jan 14:30)")),
                ("KDE", _("KDE Style (Mon 15 Jan 2024 14:30)"))
            ]
            
            # === OPCJE SYSTEMOWE (bez wcięcia - widoczne gdy use-custom-format = false) ===
            self.format_combo = GSettingsComboBox(_("Date format style"), "org.cinnamon.applets.calendar", "os-format-type", format_style_options)
            applet_format.add_row(self.format_combo)
            
            self.time_format_switch = GSettingsSwitch(_("Use 24-hour time format"), "org.cinnamon.applets.calendar", "use-24h-format")
            applet_format.add_row(self.time_format_switch)
            
            self.seconds_switch = GSettingsSwitch(_("Show seconds"), "org.cinnamon.applets.calendar", "show-seconds")
            applet_format.add_row(self.seconds_switch)
            
            separator_options = [
                ("/", _("Slash (/)")),
                ("-", _("Dash (-)")),
                (".", _("Dot (.)"))
            ]
            self.separator_combo = GSettingsComboBox(_("Date separator"), "org.cinnamon.applets.calendar", "date-separator", separator_options)
            applet_format.add_row(self.separator_combo)
            
            # === OPCJE CUSTOM (bez wcięcia - widoczne gdy use-custom-format = true) ===
            self.custom_format_entry = GSettingsEntry(_("Custom applet format"), "org.cinnamon.applets.calendar", "applet-format")
            applet_format.add_row(self.custom_format_entry)
            
            # Live preview for custom applet format
            custom_preview_widget = SettingsWidget()
            custom_preview_widget.pack_start(Gtk.Label(_("Preview")), False, False, 0)
            
            # Custom preview label
            self.custom_preview_label = Gtk.Label()
            self.custom_preview_label.set_halign(Gtk.Align.START)
            self.custom_preview_label.set_line_wrap(True)
            self.custom_preview_label.set_selectable(True)
            custom_preview_widget.pack_end(self.custom_preview_label, False, False, 0)
            
            applet_format.add_row(custom_preview_widget)
            
            # Format help switch
            self.help_switch = GSettingsSwitch(_("Show format reference"), "org.cinnamon.applets.calendar", "format-help-visible")
            applet_format.add_row(self.help_switch)
            
            # Format help content
            help_widget = SettingsWidget()
            help_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
            
            # Header
            help_header = Gtk.Label()
            help_header.set_markup("<b>" + _("Date Format Reference") + "</b>")
            help_header.set_halign(Gtk.Align.START)
            help_box.pack_start(help_header, False, False, 0)
            
            # All format codes arranged in proper two-column pairs
            format_pairs = [
                # Time formats (left) and Date formats (right)
                (("<tt>%S</tt>", _("Second of the minute (00..60)")), ("<tt>%a</tt>", _("Abbreviated weekday name (\"Sun\")"))),
                (("<tt>%M</tt>", _("Minute of the hour (00..59)")), ("<tt>%A</tt>", _("Full weekday name (Sunday)"))),
                (("<tt>%H</tt>", _("Hour of the day, 24-hour clock (00..23)")), ("<tt>%w</tt>", _("Day of the week (Sunday is 0, 0..6)"))),
                (("<tt>%I</tt>", _("Hour of the day, 12-hour clock (01..12)")), ("<tt>%u</tt>", _("Day of the week (Monday is 1, 1..7)"))),
                (("<tt>%k</tt>", _("Hour of the day, 24-hour clock, blank-padded ( 0..23)")), ("<tt>%d</tt>", _("Day of the month (01..31)"))),
                (("<tt>%l</tt>", _("Hour of the day, 12-hour clock, blank-padded ( 0..12)")), ("<tt>%e</tt>", _("Day of the month (1..31)"))),
                (("<tt>%p</tt>", _("Meridian indicator (AM or PM)")), ("<tt>%j</tt>", _("Day of the year (001..366)"))),
                (("<tt>%P</tt>", _("Meridian indicator (\"am\" or \"pm\")")), ("<tt>%U</tt>", _("Week number, starting with first Sunday (00..53)"))),
                
                # Month formats (left) and Year formats (right)
                (("<tt>%b</tt>", _("Abbreviated month name (Jan)")), ("<tt>%V</tt>", _("Week number according to ISO 8601 (01..53)"))),
                (("<tt>%B</tt>", _("Full month name (January)")), ("<tt>%y</tt>", _("Year without a century (00..99)"))),
                (("<tt>%m</tt>", _("Month of the year (01..12)")), ("<tt>%Y</tt>", _("Year with century"))),
                
                # Special formats (left) and Advanced formats (right)
                (("<tt>%c</tt>", _("Preferred local date and time representation")), ("<tt>%C</tt>", _("Century (20 in 2009)"))),
                (("<tt>%Z</tt>", _("Time zone name")), ("<tt>%L</tt>", _("Millisecond of the second (000..999)"))),
                (("<tt>%D</tt>", _("U.S. Date (%m/%d/%y)")), ("<tt>%s</tt>", _("Number of seconds since 1970-01-01 00:00:00 UTC"))),
                (("<tt>%%</tt>", _("Literal % character")), ("", "")),
                (("<tt>%n</tt>", _("Newline (\\n)")), ("", "")),
                (("<tt>%t</tt>", _("Tab character (\\t)")), ("", ""))
            ]
            
            # Create two-column layout with proper pairing
            for left_pair, right_pair in format_pairs:
                left_code, left_desc = left_pair
                right_code, right_desc = right_pair
                
                # Format left column
                left_text = left_code + " - " + left_desc if left_code else ""
                # Format right column  
                right_text = right_code + " - " + right_desc if right_code else ""
                
                row = TwoColumnLabelRow(left_text, right_text)
                help_box.pack_start(row, False, False, 0)
            
            # Footer
            footer_label = Gtk.Label(_("Type 'man strftime' in terminal for complete reference"))
            footer_label.set_halign(Gtk.Align.START)
            help_box.pack_start(footer_label, False, False, 6)
            help_widget.pack_start(help_box, True, True, 0)
            
            # Używamy SettingsRevealer dla help content
            help_revealer = SettingsRevealer()
            applet_format.add_reveal_row(help_widget, revealer=help_revealer)
            
            # Kontrola widoczności opcji z płynnymi animacjami
            def update_visibility():
                is_custom = use_custom_switch.content_widget.get_active()
                is_help_visible = self.help_switch.content_widget.get_active()
                
                # Opcje systemowe aktywne gdy NIE custom
                self.format_combo.set_sensitive(not is_custom)
                self.time_format_switch.set_sensitive(not is_custom)
                self.seconds_switch.set_sensitive(not is_custom)
                self.separator_combo.set_sensitive(not is_custom)
                
                # Opcje custom aktywne gdy custom
                self.custom_format_entry.set_sensitive(is_custom)
                self.custom_preview_label.set_sensitive(is_custom)
                self.help_switch.set_sensitive(is_custom)
                
                # Help revealer widoczny gdy custom I help włączony
                help_revealer.set_reveal_child(is_custom and is_help_visible)
            
            # Połącz revealery z przełącznikami
            use_custom_switch.content_widget.connect("notify::active", lambda *args: update_visibility())
            self.help_switch.content_widget.connect("notify::active", lambda *args: help_revealer.set_reveal_child(self.help_switch.content_widget.get_active()))
            
            # Ustaw początkowy stan
            update_visibility()
            help_revealer.set_reveal_child(self.help_switch.content_widget.get_active())
            
            # Sekcja 3: Formatowanie tooltip (w zakładce Calendar)
            tooltip_format = calendar_page.add_section(_("Tooltip"))
            
            # Własny format tooltip
            tooltip_format.add_row(GSettingsEntry(_("Tooltip format"), "org.cinnamon.applets.calendar", "tooltip-format"))
            
            # Live preview for tooltip format
            tooltip_preview_widget = SettingsWidget()
            tooltip_preview_widget.pack_start(Gtk.Label(_("Preview")), False, False, 0)
            
            # Tooltip preview label
            self.tooltip_preview_label = Gtk.Label()
            self.tooltip_preview_label.set_halign(Gtk.Align.START)
            self.tooltip_preview_label.set_line_wrap(True)
            self.tooltip_preview_label.set_selectable(True)
            tooltip_preview_widget.pack_end(self.tooltip_preview_label, False, False, 0)
            
            tooltip_format.add_row(tooltip_preview_widget)
            
            # Tooltip format help switch
            tooltip_help_switch = GSettingsSwitch(_("Show tooltip format reference"), "org.cinnamon.applets.calendar", "tooltip-format-help-visible")
            tooltip_format.add_row(tooltip_help_switch)
            
            # Tooltip format help content
            tooltip_help_widget = SettingsWidget()
            tooltip_help_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
            
            # Header
            tooltip_help_header = Gtk.Label()
            tooltip_help_header.set_markup("<b>" + _("Tooltip Format Reference") + "</b>")
            tooltip_help_header.set_halign(Gtk.Align.START)
            tooltip_help_box.pack_start(tooltip_help_header, False, False, 0)
            
            # Użyj tej samej listy format_pairs co wcześniej
            for left_pair, right_pair in format_pairs:
                left_code, left_desc = left_pair
                right_code, right_desc = right_pair
                
                # Format left column
                left_text = left_code + " - " + left_desc if left_code else ""
                # Format right column  
                right_text = right_code + " - " + right_desc if right_code else ""
                
                row = TwoColumnLabelRow(left_text, right_text)
                tooltip_help_box.pack_start(row, False, False, 0)
            
            # Footer
            tooltip_footer_label = Gtk.Label(_("Type 'man strftime' in terminal for complete reference"))
            tooltip_footer_label.set_halign(Gtk.Align.START)
            tooltip_help_box.pack_start(tooltip_footer_label, False, False, 6)
            tooltip_help_widget.pack_start(tooltip_help_box, True, True, 0)
            tooltip_format.add_reveal_row(tooltip_help_widget, "org.cinnamon.applets.calendar", "tooltip-format-help-visible")

            # ========================================
            # SEKCJA 3: WYGASZACZ (osobna zakładka dla ustawień wygaszacza)
            # ========================================
            screensaver_page = SettingsPage()
            self.sidePage.stack.add_titled(screensaver_page, "screensaver", _("Screensaver"))
            
            # Sekcja 1: Zegar na wygaszaczu
            screensaver_clock = screensaver_page.add_section(_("Clock on Screensaver"))
            
            # Switch do włączania/wyłączania zegara na wygaszaczu
            show_clock_switch = GSettingsSwitch(_("Always show the clock"), "org.cinnamon.desktop.screensaver", "show-clock")
            show_clock_switch.set_tooltip_text(_("Show the clock on the wallpaper instead of just on the unlock screen"))
            screensaver_clock.add_row(show_clock_switch)
            
            # Ustawienia czcionek dla zegara na wygaszaczu
            size_group = Gtk.SizeGroup.new(Gtk.SizeGroupMode.HORIZONTAL)
            
            widget = GSettingsFontButton(_("Time Font"), "org.cinnamon.desktop.screensaver", "font-time", size_group=size_group)
            screensaver_clock.add_reveal_row(widget, "org.cinnamon.desktop.screensaver", "show-clock")
            
            widget = GSettingsFontButton(_("Date Font"), "org.cinnamon.desktop.screensaver", "font-date", size_group=size_group)
            screensaver_clock.add_reveal_row(widget, "org.cinnamon.desktop.screensaver", "show-clock")
            
            # Sekcja 2: Formatowanie i pozycja zegara na wygaszaczu
            screensaver_format = screensaver_page.add_section(_("Screensaver Format & Position"))
            
            # Ustawienia formatowania zegara na wygaszaczu
            widget = GSettingsSwitch(_("Use custom screensaver format"), "org.cinnamon.applets.calendar", "use-screensaver-custom-format")
            screensaver_format.add_row(widget)
            
            widget = GSettingsEntry(_("Screensaver format"), "org.cinnamon.applets.calendar", "screensaver-format")
            screensaver_format.add_reveal_row(widget, "org.cinnamon.applets.calendar", "use-screensaver-custom-format")
            
            # Screensaver position
            position_options = [
                ("top-left", _("Top Left")),
                ("top-right", _("Top Right")),
                ("bottom-left", _("Bottom Left")),
                ("bottom-right", _("Bottom Right")),
                ("center", _("Center"))
            ]
            position_combo = GSettingsComboBox(_("Screensaver position"), "org.cinnamon.applets.calendar", "screensaver-position", position_options)
            screensaver_format.add_reveal_row(position_combo, "org.cinnamon.applets.calendar", "use-screensaver-custom-format")
            
            # Live preview for screensaver format
            preview_widget = SettingsWidget()
            preview_widget.pack_start(Gtk.Label(_("Preview")), False, False, 0)
            
            # Preview label
            self.screensaver_preview_label = Gtk.Label()
            self.screensaver_preview_label.set_halign(Gtk.Align.START)
            self.screensaver_preview_label.set_line_wrap(True)
            self.screensaver_preview_label.set_selectable(True)
            preview_widget.pack_end(self.screensaver_preview_label, False, False, 0)
            
            screensaver_format.add_reveal_row(preview_widget, "org.cinnamon.applets.calendar", "use-screensaver-custom-format")
            
            # Connect to format changes for live preview
            self.screensaver_settings = Gio.Settings(schema_id="org.cinnamon.applets.calendar")
            self.screensaver_settings.connect("changed::screensaver-format", self.update_screensaver_preview)
            self.screensaver_settings.connect("changed::tooltip-format", self.update_tooltip_preview)
            self.screensaver_settings.connect("changed::applet-format", self.update_custom_preview)
            
            # Initial preview update
            self.update_screensaver_preview()
            self.update_tooltip_preview()
            self.update_custom_preview()
            
            # Screensaver format help switch
            screensaver_help_switch = GSettingsSwitch(_("Show screensaver format reference"), "org.cinnamon.applets.calendar", "screensaver-format-help-visible")
            screensaver_format.add_reveal_row(screensaver_help_switch, "org.cinnamon.applets.calendar", "use-screensaver-custom-format")
            
            # Screensaver format help content
            screensaver_help_widget = SettingsWidget()
            screensaver_help_box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
            
            # Header
            screensaver_help_header = Gtk.Label()
            screensaver_help_header.set_markup("<b>" + _("Screensaver Format Reference") + "</b>")
            screensaver_help_header.set_halign(Gtk.Align.START)
            screensaver_help_box.pack_start(screensaver_help_header, False, False, 0)
            
            # Użyj tej samej listy format_pairs co wcześniej
            for left_pair, right_pair in format_pairs:
                left_code, left_desc = left_pair
                right_code, right_desc = right_pair
                
                # Format left column
                left_text = left_code + " - " + left_desc if left_code else ""
                # Format right column  
                right_text = right_code + " - " + right_desc if right_code else ""
                
                row = TwoColumnLabelRow(left_text, right_text)
                screensaver_help_box.pack_start(row, False, False, 0)
            
            # Footer
            screensaver_footer_label = Gtk.Label(_("Type 'man strftime' in terminal for complete reference"))
            screensaver_footer_label.set_halign(Gtk.Align.START)
            screensaver_help_box.pack_start(screensaver_footer_label, False, False, 6)
            screensaver_help_widget.pack_start(screensaver_help_box, True, True, 0)
            screensaver_format.add_reveal_row(screensaver_help_widget, "org.cinnamon.applets.calendar", "screensaver-format-help-visible")

            # ORYGINALNA INICJALIZACJA PROXY
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

    def update_screensaver_preview(self, *args):
        format_string = self.screensaver_settings.get_string("screensaver-format")
        try:
            # Get current date and time
            now = datetime.datetime.now()
            formatted_date = now.strftime(format_string)
            
            # Show the formatted date
            self.screensaver_preview_label.set_text(formatted_date)
            
        except ValueError as e:
            # Invalid format string
            error_text = _("Invalid format:") + " " + str(e)
            self.screensaver_preview_label.set_text(error_text)
        except Exception as e:
            # Other error
            error_text = _("Error:") + " " + str(e)
            self.screensaver_preview_label.set_text(error_text)

    def update_tooltip_preview(self, *args):
        format_string = self.screensaver_settings.get_string("tooltip-format")
        try:
            # Get current date and time
            now = datetime.datetime.now()
            formatted_date = now.strftime(format_string)
            
            # Show the formatted date
            self.tooltip_preview_label.set_text(formatted_date)
            
        except ValueError as e:
            # Invalid format string
            error_text = _("Invalid format:") + " " + str(e)
            self.tooltip_preview_label.set_text(error_text)
        except Exception as e:
            # Other error
            error_text = _("Error:") + " " + str(e)
            self.tooltip_preview_label.set_text(error_text)

    def update_custom_preview(self, *args):
        format_string = self.screensaver_settings.get_string("applet-format")
        try:
            # Get current date and time
            now = datetime.datetime.now()
            formatted_date = now.strftime(format_string)
            
            # Show the formatted date
            self.custom_preview_label.set_text(formatted_date)
            
        except ValueError as e:
            # Invalid format string
            error_text = _("Invalid format:") + " " + str(e)
            self.custom_preview_label.set_text(error_text)
        except Exception as e:
            # Other error
            error_text = _("Error:") + " " + str(e)
            self.custom_preview_label.set_text(error_text)


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
            def async_empty_callback(*args, **kwargs):
                pass
            self._proxy.SetTimezone('(sb)', zone, True, result_handler=async_empty_callback)

    def set_ntp(self, active):
        if self._proxy:
            # not passing a callback to the dbus function will cause it to run synchronously and freeze the ui
            def async_empty_callback(*args, **kwargs):
                pass
            self._proxy.SetNTP('(bb)', active, True, result_handler=async_empty_callback)

    def set_time(self, seconds):
        if self._proxy:
            def async_empty_callback(*args, **kwargs):
                pass
            self._proxy.SetTime('(xbb)', seconds * 1000000, False, True, result_handler=async_empty_callback)


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
        # not passing a callback to the dbus function will cause it to run synchronously and freeze the ui
        def async_empty_callback(*args, **kwargs):
            pass
        self._proxy.SetTimezone('(s)', zone, result_handler=async_empty_callback)

    def set_ntp(self, active):
        # not passing a callback to the dbus function will cause it to run synchronously and freeze the ui
        def async_empty_callback(*args, **kwargs):
            pass
        self._proxy.SetUsingNtp('(b)', active, result_handler=async_empty_callback)

    def set_time(self, seconds):
        # not passing a callback to the dbus function will cause it to run synchronously and freeze the ui
        def async_empty_callback(*args, **kwargs):
            pass
        self._proxy.SetTime('(x)', seconds, result_handler=async_empty_callback)


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