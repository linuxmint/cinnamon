#!/usr/bin/python3
import os
import sys
import setproctitle
import locale
import gettext
import functools
import logging
import time
from setproctitle import setproctitle
import signal

import gi
gi.require_version('EDataServer', '1.2')
gi.require_version('ECal', '2.0')
gi.require_version('ICal', '3.0')
gi.require_version('Cinnamon', '0.1')
from gi.repository import GLib, Gio, GObject
from gi.repository import EDataServer, ECal, ICal, ICalGLib
from gi.repository import Cinnamon

BUS_NAME = "org.cinnamon.CalendarServer"
BUS_PATH = "/org/cinnamon/CalendarServer"

STATUS_UNKNOWN = 0
STATUS_NO_CALENDARS = 1
STATUS_HAS_CALENDARS = 2

class CalendarInfo(GObject.Object):
    __gsignals__ = {
        "color-changed": (GObject.SignalFlags.RUN_LAST, None, ()),
    }
    def __init__(self, source, client):
        super(CalendarInfo, self).__init__()
        # print(source, client)
        self.source = source
        self.client = client

        self.syncing = False

        self.extension = source.get_extension(EDataServer.SOURCE_EXTENSION_CALENDAR)
        self.color = self.extension.get_color()
        self.color_prop_listener_id = self.extension.connect("notify::color", self.ext_color_prop_changed)

        # This process generally won't stay running for more than 30 seconds or so,
        # but enabling refresh lets us force a timeout and re-poll.
        if self.client.check_capability(ECal.STATIC_CAPABILITY_REFRESH_SUPPORTED):
            self.refresh = self.source.get_extension(EDataServer.SOURCE_EXTENSION_REFRESH)
            self.refresh.set_enabled(True)
            self.refresh.set_interval_minutes(1)
            self.source.refresh_add_timeout(None, self.on_refresh_timeout)

        self.start = None
        self.end = None

        self.view = None
        self.view_cancellable = None
        self.events = []

    def try_sync(self):
        if self.syncing:
            return

        if self.client.check_capability(ECal.STATIC_CAPABILITY_REFRESH_SUPPORTED):
            self.source.refresh_force_timeout()

    def on_refresh_timeout(self, source, data=None):
        self.client.refresh(None, self.on_sync_complete)

    def on_sync_complete(self, client, result, data=None):
        try:
            self.client.refresh_finish(result)
        except GLib.Error as e:
            print(f"Error refreshing calendar '{self.source.get_display_name()}':", e.message)

        self.syncing = False

    def destroy(self):
        self.extension.disconnect(self.color_prop_listener_id)
        self.extension = None

        self.disconnect(self.owner_color_signal_id)

        if self.view_cancellable is not None:
            self.view_cancellable.cancel()

        if self.view is not None:
            self.view.stop()
        self.view = None

    def ext_color_prop_changed(self, extension, pspect, data=None):
        self.color = self.extension.get_color()
        self.emit("color-changed")

class Event:
    def __init__(self, uid, color, summary, all_day, start_timet, end_timet, mod_timet):
        self.__dict__.update(locals())

class CalendarServer(Gio.Application):
    def __init__(self, hold=False):
        Gio.Application.__init__(self,
                                 application_id=BUS_NAME,
                                 inactivity_timeout=20000,
                                 flags=Gio.ApplicationFlags.REPLACE |
                                       Gio.ApplicationFlags.ALLOW_REPLACEMENT |
                                       Gio.ApplicationFlags.IS_SERVICE)
        self._hold = hold
        self.bus_connection = None
        self.interface = None
        self.registry = None
        self.registry_watcher = None
        self.client_appeared_id = 0
        self.client_disappeared_id = 0

        self.calendars = {}

        self.current_month_start = 0
        self.current_month_end = 0

        self.zone = None
        self.update_timezone()

        try:
            self.session_bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        except:
            print("Unable to get session connection, fatal!")
            exit(1)

        self.interface = Cinnamon.CalendarServerSkeleton.new()
        self.interface.connect("handle-set-time-range", self.handle_set_time_range)
        self.interface.connect("handle-exit", self.handle_exit)
        self.interface.export(self.session_bus, BUS_PATH)

        try:
            self.register(None)
        except GLib.Error as e:
            print("couldn't register on bus: ", e.message)

    def update_timezone(self):
        location = ECal.system_timezone_get_location()

        if location is None:
            self.zone = ICalGLib.Timezone.get_utc_timezone().copy()
        else:
            self.zone = ICalGLib.Timezone.get_builtin_timezone(location).copy()

    def do_startup(self):
        Gio.Application.do_startup(self)

        self.hold()

        EDataServer.SourceRegistry.new(None, self.got_registry_callback)

    def do_activate(self):
        pass

    def got_registry_callback(self, source, res):
        try:
            self.registry = EDataServer.SourceRegistry.new_finish(res)
        except GLib.Error as e:
            print(e)
            self.quit()
            return

        self.update_status()

        self.registry_watcher = EDataServer.SourceRegistryWatcher.new(self.registry, None)

        self.client_appeared_id = self.registry_watcher.connect("appeared", self.source_appeared)
        self.client_disappeared_id = self.registry_watcher.connect("disappeared", self.source_disappeared)
        self.registry_watcher.connect("filter", self.is_relevant_source)

        # This forces the watcher to notify about all pre-existing sources (so
        # the callbacks can process them)
        self.registry_watcher.reclaim()

        if not self._hold:
            self.release()

    def source_appeared(self, watcher, source):
        print("Discovered calendar: ", source.get_display_name())

        self.hold()
        ECal.Client.connect(source, ECal.ClientSourceType.EVENTS, 10, None, self.ecal_client_connected, source)

        # ??? should be (self, source, res) but we get the client instead
    def ecal_client_connected(self, c, res, source):
        self.release()

        try:
            client = ECal.Client.connect_finish(res)
            client.set_default_timezone(self.zone)

            calendar = CalendarInfo(source, client)
            calendar.owner_color_signal_id = calendar.connect("color-changed", self.source_color_changed)
            self.calendars[source.get_uid()] = calendar

            self.update_status()

            if self.current_month_start != 0 and self.current_month_end != 0:
                self.create_view_for_calendar(calendar)
        except GLib.Error as e:
            # what to do
            print("couldn't connect to source", e.message)
            return

    def source_color_changed(self, calendar):
        self.create_view_for_calendar(calendar)

    def source_disappeared(self, watcher, source):
        try:
            calendar = self.calendars[source.get_uid()]
        except KeyError:
            # We had a source but it wasn't for a calendar.
            return

        self.interface.emit_client_disappeared(source.get_uid())
        calendar.destroy()

        del self.calendars[source.get_uid()]

        self.update_status()

    def update_status(self):
        status = STATUS_NO_CALENDARS

        enabled_sources = self.registry.list_enabled(EDataServer.SOURCE_EXTENSION_CALENDAR)
        for source in enabled_sources:
            if self.is_relevant_source(None, source):
                status = STATUS_HAS_CALENDARS

        self.interface.set_property("status", status)

        if status == STATUS_NO_CALENDARS:
            self.exit()

    def is_relevant_source(self, watcher, source):
        relevant = source.has_extension(EDataServer.SOURCE_EXTENSION_CALENDAR) and \
                   source.get_extension(EDataServer.SOURCE_EXTENSION_CALENDAR).get_selected()
        return relevant

    def handle_set_time_range(self, iface, inv, time_since, time_until, force_reload):
        print("SET TIME: from %s to %s" % (GLib.DateTime.new_from_unix_local(time_since).format_iso8601(),
                            GLib.DateTime.new_from_unix_local(time_until).format_iso8601()))

        self.hold()
        self.release()

        if time_since == self.current_month_start and time_until == self.current_month_end:
            if not force_reload:
                self.interface.complete_set_time_range(inv)
                return True

        for calendar in self.calendars.values():
            calendar.try_sync()

        self.current_month_start = time_since
        self.current_month_end = time_until

        self.interface.set_property("since", time_since)
        self.interface.set_property("until", time_until)

        for uid in self.calendars.keys():
            calendar = self.calendars[uid]
            self.create_view_for_calendar(calendar)

        self.interface.complete_set_time_range(inv)
        return True

    def handle_exit(self, iface, inv):
        self.exit()
        self.interface.complete_exit(inv)

    def create_view_for_calendar(self, calendar):
        self.hold()

        if calendar.view_cancellable is not None:
            calendar.view_cancellable.cancel()
        calendar.view_cancellable = Gio.Cancellable()

        if calendar.view is not None:
            calendar.view.stop()
        calendar.view = None

        from_iso = ECal.isodate_from_time_t(self.current_month_start)
        to_iso = ECal.isodate_from_time_t(self.current_month_end)

        calendar.start = self.current_month_start
        calendar.end = self.current_month_end

        query = "occur-in-time-range? (make-time \"%s\") (make-time \"%s\") \"%s\"" %\
                 (from_iso, to_iso, self.zone.get_location())

        calendar.client.get_view(query, calendar.view_cancellable, self.got_calendar_view, calendar)

    def got_calendar_view(self, client, res, calendar):
        self.release()

        if calendar.view_cancellable.is_cancelled():
            return

        try:
            success, view = client.get_view_finish(res)
            calendar.view = view
        except GLib.Error as e:
            print("get view failed: ", e.message)
            return

        view.set_flags(ECal.ClientViewFlags.NOTIFY_INITIAL)
        view.connect("objects-added", self.view_objects_added, calendar)
        view.connect("objects-modified", self.view_objects_modified, calendar)
        view.connect("objects-removed", self.view_objects_removed, calendar)
        view.start()

    def view_objects_added(self, view, objects, calendar):
        self.handle_new_or_modified_objects(view, objects, calendar)

    def view_objects_modified(self, view, objects, calendar):
        self.handle_new_or_modified_objects(view, objects, calendar)

    def view_objects_removed(self, view, component_ids, calendar):
        print("objects removed: ", component_ids)

        self.handle_removed_objects(view, component_ids, calendar)

    def handle_new_or_modified_objects(self, view, objects, calendar):
        if calendar.view_cancellable.is_cancelled():
            return

        self.hold()

        events = []

        for ical_comp in objects:

            if ical_comp.get_uid() is None:
                continue

            if (not ECal.util_component_is_instance (ical_comp)) and \
              ECal.util_component_has_recurrences(ical_comp):
                calendar.client.generate_instances_for_object(
                    ical_comp,
                    calendar.start,
                    calendar.end,
                    calendar.view_cancellable,
                    self.recurrence_generated,
                    calendar
                )
            else:
                comp = ECal.Component.new_from_icalcomponent(ical_comp)
                comptext = comp.get_summary()
                if comptext is not None:
                    summary = comptext.get_value()
                else:
                    summary = ""

                dts_prop = ical_comp.get_first_property(ICalGLib.PropertyKind.DTSTART_PROPERTY)
                ical_time_start = dts_prop.get_dtstart()
                start_timet = self.ical_time_get_timet(calendar.client, ical_time_start, dts_prop)
                all_day = ical_time_start.is_date()

                dte_prop = ical_comp.get_first_property(ICalGLib.PropertyKind.DTEND_PROPERTY)

                if dte_prop is not None:
                    ical_time_end = dte_prop.get_dtend()
                    end_timet = self.ical_time_get_timet(calendar.client, ical_time_end, dte_prop)
                else:
                    end_timet = start_timet + (60 * 30) # Default to 30m if the end time is bad.

                mod_timet = self.get_mod_timet(ical_comp)

                event = Event(
                    self.create_uid(calendar, comp),
                    calendar.color,
                    summary,
                    all_day,
                    start_timet,
                    end_timet,
                    mod_timet
                )

                events.append(event)
        if len(events) > 0:
            self.emit_events_added_or_updated(calendar, events)

        self.release()

    def recurrence_generated(self, ical_comp, instance_start, instance_end, calendar, cancellable):
        if calendar.view_cancellable.is_cancelled():
            return False

        comp = ECal.Component.new_from_icalcomponent(ical_comp)
        all_objects = GLib.VariantBuilder(GLib.VariantType.new("a(sssbxx)"))

        comptext = comp.get_summary()
        if comptext is not None:
            summary = comptext.get_value()
        else:
            summary = ""

        default_zone = calendar.client.get_default_timezone()

        dts_timezone = instance_start.get_timezone()
        if dts_timezone is None:
            dts_timezone = default_zone

        dte_timezone = instance_end.get_timezone()
        if dte_timezone is None:
            dte_timezone = default_zone

        all_day = instance_start.is_date()
        start_timet = instance_start.as_timet_with_zone(dts_timezone)
        end_timet = instance_end.as_timet_with_zone(dte_timezone)
        mod_timet = self.get_mod_timet(ical_comp)

        event = Event(
            self.create_uid(calendar, comp),
            calendar.color,
            summary,
            all_day,
            start_timet,
            end_timet,
            mod_timet
        )

        self.emit_events_added_or_updated(calendar, [event])

        return True

    def emit_events_added_or_updated(self, calendar, events):
        # print("package: ",len(events))
        all_events = GLib.VariantBuilder(GLib.VariantType.new("a(sssbxxx)"))

        for event in events:
            if event.end_timet <= (calendar.start - 1) and event.start_timet >= calendar.end:
                continue

            event_var = GLib.Variant(
                "(sssbxxx)",
                [
                    event.uid,
                    event.color,
                    event.summary,
                    event.all_day,
                    event.start_timet,
                    event.end_timet,
                    event.mod_timet
                ]
            )

            all_events.add_value(event_var)

        self.interface.emit_events_added_or_updated(all_events.end())

    def get_mod_timet(self, ical_comp):
        # Both last-modified and created are optional. Try one, then the other,
        # then just return 0. The value isn't used except for comparison, when
        # checking if a received event is an update for an already existing one
        # in the applet.
        mod_timet = 0

        mod_prop = ical_comp.get_first_property(ICalGLib.PropertyKind.LASTMODIFIED_PROPERTY)
        if mod_prop is not None:
            ical_time_modified = mod_prop.get_lastmodified()
            mod_timet = ical_time_modified.as_timet()
        else:
            created_prop = ical_comp.get_first_property(ICalGLib.PropertyKind.CREATED_PROPERTY)
            if created_prop is not None:
                ical_time_created = created_prop.get_created()
                mod_timet = ical_time_created.as_timet()

        return mod_timet

    def ical_time_get_timet(self, client, ical_time, prop):
        tzid  = prop.get_first_parameter(ICalGLib.ParameterKind.TZID_PARAMETER)
        if tzid:
            timezone = ECal.TimezoneCache.get_timezone(client, tzid.get_tzid())
        elif ical_time.is_utc():
            timezone = ICalGLib.Timezone.get_utc_timezone()
        else:
            timezone = client.get_default_timezone()

        ical_time.set_timezone(timezone)
        return ical_time.as_timet_with_zone(timezone)

    def create_uid(self, calendar, ecal_comp):
        # format from gcal-event.c (gnome-calendar)

        source_id = calendar.source.get_uid()
        comp_id = ecal_comp.get_id()
        return self.get_id_from_comp_id(comp_id, source_id)

    def get_id_from_comp_id(self, comp_id, source_id):
        if comp_id.get_rid() is not None:
            return "%s:%s:%s" % (source_id, comp_id.get_uid(), comp_id.get_rid())
        else:
            return "%s:%s" % (source_id, comp_id.get_uid())

    def handle_removed_objects(self, view, component_ids, calendar):
        # what else?
        # print("handle: ", uuid_list)
        source_id = calendar.source.get_uid()

        uids = []

        for comp_id in component_ids:
            uid = self.get_id_from_comp_id(comp_id, source_id)
            uids.append(uid)

        uids_string = "::".join(uids)

        if uids_string != "":
            self.interface.emit_events_removed(uids_string)

    def exit(self):
        if self.registry_watcher is not None:
            self.registry_watcher.disconnect(self.client_appeared_id)
            self.registry_watcher.disconnect(self.client_disappeared_id)

        for uid in self.calendars.keys():
            self.calendars[uid].destroy()

        GLib.idle_add(self.quit)

def main():
    setproctitle("cinnamon-calendar-server")

    # For debugging, this will keep the process alive instead of exiting after 10s
    hold = False
    if len(sys.argv) > 1 and sys.argv[1] == "hold":
        print("idle exit disabled...")
        hold = True

    server = CalendarServer(hold)
    signal.signal(signal.SIGINT, lambda s, f: server.exit())
    signal.signal(signal.SIGTERM, lambda s, f: server.exit())

    # Only pass the first argument to the GApplication - or it will
    # complain the IS_SERVICE flag doesn't support arguments.
    server.run([sys.argv[0]])
    return 0

if __name__ == "__main__":
    main()
