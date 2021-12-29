// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;
const Signals = imports.signals;
const Pango = imports.gi.Pango;
const Cinnamon = imports.gi.Cinnamon;
const Settings = imports.ui.settings;
const Atk = imports.gi.Atk;
const Gtk = imports.gi.Gtk;
const CinnamonDesktop = imports.gi.CinnamonDesktop;
const Separator = imports.ui.separator;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Tweener = imports.ui.tweener;

const STATUS_UNKNOWN = 0;
const STATUS_NO_CALENDARS = 1;
const STATUS_HAS_CALENDARS = 2;

// TODO: this is duplicated from applet.js
const DATE_FORMAT_FULL = CinnamonDesktop.WallClock.lctime_format("cinnamon", _("%A, %B %-e, %Y"));
const DAY_FORMAT = CinnamonDesktop.WallClock.lctime_format("cinnamon", "%A");

// https://www.w3schools.com/charsets/ref_utf_geometric.asp
const ARROW_SEPARATOR = "  ►  "

function locale_cap(str) {
    return str.charAt(0).toLocaleUpperCase() + str.slice(1);
}

function js_date_to_gdatetime(js_date) {
    let unix = js_date.getTime() / 1000; // getTime returns ms
    return GLib.DateTime.new_from_unix_local(unix);
}

function date_only(gdatetime) {
    let date = GLib.DateTime.new_local(
        gdatetime.get_year(),
        gdatetime.get_month(),
        gdatetime.get_day_of_month(), 0, 0, 0
    );

    return date;
}

function month_year_only(gdatetime) {
    let month_year_only = GLib.DateTime.new_local(
        gdatetime.get_year(),
        gdatetime.get_month(),
        1, 0, 0, 0
    );

    return month_year_only;
}

function format_timespan(timespan) {
    let minutes = Math.floor(timespan / GLib.TIME_SPAN_MINUTE);

    if (minutes < 10) {
        return ["imminent", _("Starting in a few minutes")];
    }

    if (minutes < 60) {
        return ["soon", _("Starting in %d minutes").format(minutes)];
    }

    let hours = Math.floor(minutes / 60);

    if (hours > 6) {
        let now = GLib.DateTime.new_now_local();
        let later = now.add_hours(hours);

        if (later.get_hour() > 18) {
            return ["", _("This evening")];
        }

        return ["", _("Starting later today")];
    }

    return ["", ngettext("In %d hour", "In %d hours", hours).format(hours)];
}


// GLib.DateTime.equal is broken
function dt_equals(dt1, dt2) {
    return dt1.to_unix() === dt2.to_unix();
}

class EventData {
    constructor(data_var, last_request_timestamp) {
        const [id, color, summary, all_day, start_time, end_time, mod_time] = data_var.deep_unpack();
        this.id = id;
        this.start = GLib.DateTime.new_from_unix_local(start_time);
        this.end = GLib.DateTime.new_from_unix_local(end_time);

        this.all_day = all_day;
        if (this.all_day) {
            // An all day event can be from 00:00 to 00:00 the next day, which will end up
            // causing it to appear for two days.
            this.end = this.end.add_seconds(-1);
        }
        this.start_date = date_only(this.start);
        this.end_date = date_only(this.end);
        this.multi_day = !dt_equals(this.start_date, this.end_date);
        if (this.multi_day) {
            this.span = this.end_date.difference(this.start_date) / GLib.TIME_SPAN_DAY;
        } else {
            this.span = 1;
        }

        this.summary = summary;
        this.color = color;
        // This is the time_t for when event was last modified by e-d-s
        this.modified = mod_time;
        // This is the last monotonic time we contacted our server to update our events. This
        // is used to cull deleted events.
        this.last_request_timestamp = last_request_timestamp;
    }

    starts_on_day(date) {
        return dt_equals(date_only(date), this.start_date);
    }

    ends_on_day(date) {
        return dt_equals(date_only(date), this.end_date);
    }

    started_before_day(date) {
        return date_only(date).difference(this.start_date) > 0;
    }

    ended_before_day(date) {
        return date_only(date).difference(this.end_date) > 0;
    }

    ends_after_day(date) {
        return date_only(date).difference(this.end_date) < 0;
    }

    started_after_day(date) {
        return date_only(date).difference(this.start_date) < 0;
    }

    started_before_and_ends_after(date) {
        return this.multi_day && this.started_before_day(date) && this.ends_after_day(date);
    }

    equal(other_event) {
        return this.id === other_event.id && this.modified === other_event.modified;
    }
}

class EventDataList {
    constructor(gdate_only) {
        // Timestamp gets updated any time events are added, removed of modified. The event list
        // compares this to the timestamp it recorded when it initially loaded the day's events.
        // is changed. It updates any time the events of this day are added, modified or removed.
        // This prompts the event list to completely reload the re-sorted event list.
        //
        // If the event list is updated and the timestamps haven't changed, only the variable details
        // of the events are updated - time till start, style changes, etc...
        this.timestamp = GLib.get_monotonic_time();
        this.gdate_only = gdate_only;
        this.length = 0;
        this._events = {};
    }

    add_or_update(event_data, last_request_timestamp) {
        let existing = this._events[event_data.id];

        if (existing === undefined) {
            this.length++;
        }

        if (existing !== undefined && event_data.equal(existing)) {
            existing.last_request_timestamp = last_request_timestamp;
            existing.color = event_data.color;
            return false;
        }

        this._events[event_data.id] = event_data;
        this.timestamp = GLib.get_monotonic_time();

        return true;
    }

    delete(id) {
        let existing = this._events[id];

        if (existing === undefined) {
            return false;
        }

        this.length --;
        delete this._events[id];

        this.timestamp = GLib.get_monotonic_time();
        return true;
    }

    cull_removed_events(last_request_timestamp) {
        let to_remove = [];
        for (let id in this._events) {
            if (this._events[id].last_request_timestamp < last_request_timestamp) {
                to_remove.push(id);
            }
        }

        to_remove.forEach((id) => {
            this.delete(id);
        });
    }

    get_event_list() {
        let now = GLib.DateTime.new_now_local();

        let events_as_array = [];
        for (let id in this._events) {
            events_as_array.push(this._events[id]);
        }

        // chrono order for non-current day
        events_as_array.sort((a, b) => {
            return a.start.to_unix() - b.start.to_unix();
        });

        if (!dt_equals(date_only(now), this.gdate_only)) {
            return events_as_array;
        }

        // for the current day keep all-day events just above the current or first pending event
        let all_days = [];
        let final_list = [];

        for (let i = 0; i < events_as_array.length; i++) {
            if (events_as_array[i].all_day) {
                all_days.push(events_as_array[i]);
            }
        }

        all_days.reverse();
        let all_days_inserted = false;

        for (let i = events_as_array.length - 1; i >= 0; i--) {
            let event = events_as_array[i];

            if (event.all_day && all_days_inserted) {
                break;
            }

            if (event.end.difference(now) < 0 && !all_days_inserted) {
                for (let j = 0; j < all_days.length ; j++) {
                    final_list.push(all_days[j]);
                }
                all_days_inserted = true;
            }

            final_list.push(event);
        }

        final_list.reverse();
        return final_list;
    }

    get_colors() {
        let color_set = [];

        for (let event of this.get_event_list()) {
            color_set.push(event.color);
        }

        return color_set;
    }
}

class EventsManager {
    constructor(settings, desktop_settings) {
        this.settings = settings;
        this.desktop_settings = desktop_settings;
        this._calendar_server = null;
        this.current_month_year = null;
        this.current_selected_date = GLib.DateTime.new_from_unix_local(0);

        this.last_update_timestamp = 0;
        this.events_by_date = {};

        this._inited = false;
        this._cached_state = STATUS_UNKNOWN;

        this._gc_timer_id = 0;

        this._reload_today_id = 0;

        this._force_reload_pending = false;
        this._event_list = null;
    }

    start_events() {
        if (this._calendar_server == null) {
            Cinnamon.CalendarServerProxy.new_for_bus(
                Gio.BusType.SESSION,
                // Gio.DBusProxyFlags.NONE,
                Gio.DBusProxyFlags.DO_NOT_AUTO_START_AT_CONSTRUCTION,
                "org.cinnamon.CalendarServer",
                "/org/cinnamon/CalendarServer",
                null,
                this._calendar_server_ready.bind(this)
            );
        }
    }

    _calendar_server_ready(obj, res) {
        try {
            this._calendar_server = Cinnamon.CalendarServerProxy.new_for_bus_finish(res);

            this._calendar_server.connect(
                "events-added-or-updated",
                this._handle_added_or_updated_events.bind(this)
            );

            this._calendar_server.connect(
                "events-removed",
                this._handle_removed_events.bind(this)
            );

            this._calendar_server.connect(
                "client-disappeared",
                this._handle_client_disappeared.bind(this)
            );

            this._calendar_server.connect(
                "notify::status",
                this._handle_status_notify.bind(this)
            );

            this._inited = true;

            this.emit("events-manager-ready");
        } catch (e) {
            log("could not connect to calendar server process: " + e);
            return;
        }
    }

    _stop_gc_timer() {
        if (this._gc_timer_id > 0) {
            Mainloop.source_remove(this._gc_timer_id);
            this._gc_timer_id = 0;
        }
    }

    _start_gc_timer() {
        this._stop_gc_timer();

        if (!this.is_active()) {
            return;
        }

        this._gc_timer_id = Mainloop.timeout_add_seconds(
            3, Lang.bind(this, this._perform_gc)
        );
    }

    _perform_gc() {
        let any_removed = false;
        for (let date in this.events_by_date) {
            if (this.events_by_date[date].cull_removed_events(this.last_request_timestamp)) {
                any_removed = true;
            }
        }

        if (any_removed) {
            this._event_list.set_events(this.events_by_date[this.current_selected_date.to_unix()]);
            this.emit("events-updated");
        }

        this._gc_timer_id = 0;
        return GLib.SOURCE_REMOVE;
    }

    _handle_added_or_updated_events(server, varray) {
        let changed = false;

        let events = varray.unpack();
        for (let n = 0; n < events.length; n++) {
            let data = new EventData(events[n], this.last_update_timestamp);
            // don't loop endlessly in case of a bugged event
            let escape = 0;
            let date_iter = date_only(data.start);
            do {
                let hash = date_iter.to_unix();

                if (this.events_by_date[hash] === undefined) {
                    this.events_by_date[hash] = new EventDataList(date_iter);
                }

                if (this.events_by_date[hash].add_or_update(data, this.last_request_timestamp)) {
                    if (dt_equals(date_iter, this.current_selected_date)) {
                        changed = true;
                    }
                }

                if (data.ends_on_day(date_iter) || escape == 50) {
                    break;
                }

                escape++;
                date_iter = date_iter.add_days(1);
            } while (true);
        }

        if (changed) {
            this._event_list.set_events(this.events_by_date[this.current_selected_date.to_unix()]);
        }

        this._start_gc_timer();
        this.emit("events-updated");
    }

    _handle_removed_events(server, uids_string) {
        let uids = uids_string.split("::");
        for (let hash in this.events_by_date) {
            let event_data_list = this.events_by_date[hash];

            for (let uid of uids) {
                event_data_list.delete(uid);
            }
        }

        this.queue_reload_today(false);

        this.emit("events-updated");
    }

    _handle_client_disappeared(server, uid) {
        // A calendar was removed/disabled. Instead of picking
        // specific matching events to remove, just rebuild the
        // entire list.
        this.events_by_date = {};
        this.queue_reload_today(true);
    }

    _handle_status_notify(server, pspec) {
        if (this._calendar_server.status === this._cached_state) {
            return;
        }

        // Never reload when the new status is STATUS_UNKNOWN - this
        // means the server name-owner disappeared, it doesn't mean
        // there are no calendars.
        if (this._calendar_server.status === STATUS_UNKNOWN) {
            return;
        }

        this._cached_state = this._calendar_server.status;
        this.queue_reload_today(true);
        this.emit("has-calendars-changed");
    }

    get_event_list() {
        if (this._event_list !== null) {
            return this._event_list;
        }

        this._event_list = new EventList(this.settings, this.desktop_settings);

        return this._event_list;
    }

    fetch_month_events(month_year, force) {
        let changed_month = this.current_month_year === null || !dt_equals(month_year, this.current_month_year);

        if (!changed_month && !force) {
            return;
        }
        this.current_month_year = month_year;

        if (changed_month) {
            this.events_by_date = {};
        }

        // get first day of month
        let day_one = month_year_only(month_year);
        let week_day = day_one.get_day_of_week();
        let week_start = Cinnamon.util_get_week_start();

        // back up to the start of the week preceeding day 1
        let start = day_one.add_days( -(week_day - week_start) );
        // The calendar has 42 boxes
        let end = start.add_days(42).add_seconds(-1);

        this._calendar_server.call_set_time_range(start.to_unix(), end.to_unix(), force, null, this.call_finished.bind(this));

        this.last_update_timestamp = GLib.get_monotonic_time();
    }

    call_finished(server, res) {
        try {
            this._calendar_server.call_set_time_range_finish(res);
        } catch (e) {
            log(e);
        }
    }

    _cancel_reload_today() {
        if (this._reload_today_id > 0) {
            Mainloop.source_remove(this._reload_today_id);
            this._reload_today_id = 0;
        }
    }

    queue_reload_today(force) {
        this._cancel_reload_today();

        if (force) {
            this._force_reload_pending = true;
        }

        this._reload_today_id = Mainloop.idle_add(Lang.bind(this, this._idle_do_reload_today));
    }

    _idle_do_reload_today() {
        this._reload_today_id = 0;

        this.select_date(new Date(), this._force_reload_pending);
        this._force_reload_pending = false;

        return GLib.SOURCE_REMOVE;
    }

    select_date(date, force) {
        if (!this.is_active()) {
            return;
        }

        // date is a js Date(). Eventually the calendar side should use
        // GDateTime, but for now we'll convert it here - it's a bit more
        // useful for dealing with events.
        let gdate = js_date_to_gdatetime(date);

        let gdate_only = date_only(gdate);
        let month_year = month_year_only(gdate_only);
        this.fetch_month_events(month_year, force);

        this._event_list.set_date(gdate_only);

        let delay_no_events_box = this.current_selected_date === null;
        if (this.current_selected_date !== null) {
            let new_month = !dt_equals(month_year_only(this.current_selected_date),
                                       month_year_only(gdate_only));
            delay_no_events_box = new_month;
        }

        this.current_selected_date = gdate_only;

        let existing_event_list = this.events_by_date[gdate_only.to_unix()];
        if (existing_event_list !== undefined) {
            // log("---------------cache hit");
            this._event_list.set_events(existing_event_list, delay_no_events_box);
        } else {
            this._event_list.set_events(null, delay_no_events_box);
        }
    }

    get_colors_for_date(js_date) {
        let gdate = js_date_to_gdatetime(js_date);
        let gdate_only = date_only(gdate);

        let event_data_list = this.events_by_date[gdate_only.to_unix()];

        return event_data_list !== undefined ? event_data_list.get_colors() : null;
    }

    is_active() {
        return this._inited &&
               this.settings.getValue("show-events") &&
               this._calendar_server !== null &&
               // Not blocking STATUS_UNKNOWN allows our calendar to remain
               // populated while the server is 'unowned' (sleeping), since
               // its cached property is set to 0 when its current owner exits.
               this._calendar_server.status !== STATUS_NO_CALENDARS;
    }
}
Signals.addSignalMethods(EventsManager.prototype);

class EventList {
    constructor(settings, desktop_settings) {
        this.settings = settings;
        this.selected_date = GLib.DateTime.new_now_local();
        this.desktop_settings = desktop_settings;
        this._no_events_timeout_id = 0;
        this._rows = [];
        this._current_event_data_list_timestamp = 0;

        this.actor = new St.BoxLayout(
            {
                style_class: "calendar-events-main-box",
                vertical: true,
                visible: false
            }
        );

        this.selected_date_label = new St.Label(
            {
                style_class: "calendar-events-date-label",
                reactive: true
            }
        );

        this.selected_date_label.connect("button-press-event", Lang.bind(this, (actor, event) => {
            if (event.get_button() == Clutter.BUTTON_PRIMARY) {
                this.launch_calendar(this.selected_date);
                return Clutter.EVENT_STOP;
            }
        }));

        this.actor.add_actor(this.selected_date_label);

        this.no_events_box = new St.BoxLayout(
            {
                style_class: "calendar-events-no-events-box",
                vertical: true,
                visible: false,
                x_align: Clutter.ActorAlign.CENTER,
                y_align: Clutter.ActorAlign.CENTER,
                y_expand: true
            }
        );

        this.no_events_button = new St.Button(
            {
                style_class: "calendar-events-no-events-button",
                reactive: GLib.find_program_in_path("gnome-calendar")
            }
        );

        this.no_events_button.connect('clicked', Lang.bind(this, () => {
            this.launch_calendar(this.selected_date);
        }));

        let button_inner_box = new St.BoxLayout(
            {
                vertical: true
            }
        );

        let no_events_icon = new St.Icon(
            {
                style_class: "calendar-events-no-events-icon",
                icon_name: 'x-office-calendar',
                icon_type: St.IconType.SYMBOLIC,
                icon_size: 48
            }
        );

        let no_events_label = new St.Label(
            {
                style_class: "calendar-events-no-events-label",
                text: _("No Events"),
                y_align: Clutter.ActorAlign.CENTER
            }
        );
        button_inner_box.add_actor(no_events_icon);
        button_inner_box.add_actor(no_events_label);
        this.no_events_button.add_actor(button_inner_box);
        this.no_events_box.add_actor(this.no_events_button);
        this.actor.add_actor(this.no_events_box);

        this.events_box = new St.BoxLayout(
            {
                style_class: 'calendar-events-event-container',
                vertical: true,
                accessible_role: Atk.Role.LIST
            }
        );
        this.events_scroll_box = new St.ScrollView(
            {
                style_class: 'calendar-events-scrollbox vfade',
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                enable_auto_scrolling: true
            }
        );

        let vscroll = this.events_scroll_box.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, () => {
            this.emit("start-pass-events");
        }));
        vscroll.connect('scroll-stop', Lang.bind(this, () => {
            this.emit("stop-pass-events");
        }));

        this.events_scroll_box.add_actor(this.events_box);
        this.actor.add_actor(this.events_scroll_box);
    }

    launch_calendar(gdate) {
        // --date will be broken anywhere but Mint 20.3 and upstream releases > 41.2
        // (unless some fixes are backported). Maintainer can patch this to comment
        // out either line here.

        // Util.trySpawn(["gnome-calendar"], false);
        Util.trySpawn(["gnome-calendar", "--date", gdate.format("%x")], false);

        this.emit("launched-calendar");
    }

    set_date(gdate) {
        this.selected_date_label.set_text(locale_cap(gdate.format(DATE_FORMAT_FULL)));
        this.selected_date = gdate;
    }

    set_events(event_data_list, delay_no_events_box) {
        if (event_data_list !== null && event_data_list.timestamp === this._current_event_data_list_timestamp) {
            this._rows.forEach((row) => {
                row.update_variations();
            });
            return;
        }

        this.events_box.get_children().forEach((actor) => {
            actor.destroy();
        });

        this._rows = [];

        if (this._no_events_timeout_id > 0) {
            Mainloop.source_remove(this._no_events_timeout_id);
            this._no_events_timeout_id = 0;
        }

        if (event_data_list === null) {
            // Show the 'no events' label, but wait a little bit to give the calendar server
            // to deliver some events if there are any.
            if (delay_no_events_box) {
                this._no_events_timeout_id = Mainloop.timeout_add(600, Lang.bind(this, function() {
                    this._no_events_timeout_id = 0;
                    this.no_events_box.show();
                    return GLib.SOURCE_REMOVE;
                }));
            } else {
                this.no_events_box.show();
            }

            this._current_event_data_list_timestamp = 0;
            return;
        }

        this.no_events_box.hide();
        this._current_event_data_list_timestamp = event_data_list.timestamp;

        let events = event_data_list.get_event_list();

        let scroll_to_row = null;
        let first_row_done = false;

        for (let event_data of events) {
            if (first_row_done) {
                this.events_box.add_actor(new Separator.Separator().actor);
            }

            let row = new EventRow(
                event_data,
                this.selected_date,
                {
                    use_24h: this.desktop_settings.get_boolean("clock-use-24h")
                }
            );

            row.connect("view-event", Lang.bind(this, (row, uuid) => {
                this.emit("launched-calendar");
                Util.trySpawn(["gnome-calendar", "--uuid", uuid], false);
            }));

            this.events_box.add_actor(row.actor);

            first_row_done = true;
            if (row.is_current_or_next && scroll_to_row === null) {
                scroll_to_row = row;
            }

            this._rows.push(row);
        }

        Mainloop.idle_add(Lang.bind(this, function(row) {
            let vscroll = this.events_scroll_box.get_vscroll_bar();

            if (row != null) {
                let mid_position = row.actor.y + (row.actor.height / 2) - (this.events_box.height / 2);
                vscroll.get_adjustment().set_value(mid_position);
            } else {
                vscroll.get_adjustment().set_value(0);
            }
        }, scroll_to_row));
    }
}
Signals.addSignalMethods(EventList.prototype);

class EventRow {
    constructor(event, date, params) {
        this.event = event;
        this.is_current_or_next = false;
        this.selected_date = date;
        this.use_24h = params.use_24h;

        this.actor = new St.BoxLayout(
            {
                style_class: "calendar-event-button",
                reactive: true
            }
        );

        this.actor.connect("enter-event", Lang.bind(this, () => {
            this.actor.add_style_pseudo_class("hover");
        }));

        this.actor.connect("leave-event", Lang.bind(this, () => {
            this.actor.remove_style_pseudo_class("hover");
        }));

        if (GLib.find_program_in_path("gnome-calendar")) {
            this.actor.connect("button-press-event", Lang.bind(this, (actor, event) => {
                if (event.get_button() == Clutter.BUTTON_PRIMARY) {
                    this.emit("view-event", this.event.id);
                    return Clutter.EVENT_STOP;
                }
            }));
        }

        let color_strip = new St.Bin(
            {
                style_class: "calendar-event-color-strip",
                style: `background-color: ${event.color};`
            }
        );

        this.actor.add(color_strip);

        let vbox = new St.BoxLayout(
            {
                style_class: "calendar-event-row-content",
                x_expand: true,
                vertical: true
            }
        );
        this.actor.add_actor(vbox);

        let label_box = new St.BoxLayout(
            {
                name: "label-box",
                x_expand: true
            }
        );
        vbox.add_actor(label_box);

        this.event_time = new St.Label(
            {
                x_align: Clutter.ActorAlign.START,
                text: "",
                style_class: "calendar-event-time-present"
            }
        );
        label_box.add(this.event_time, { expand: true, x_fill: true });

        this.countdown_label = new St.Label(
            {
                /// text set below
                x_align: Clutter.ActorAlign.END,
                style_class: "calendar-event-countdown",
            }
        );

        label_box.add(this.countdown_label, { expand: true, x_fill: true });

        let event_summary = new St.Label(
            {
                text: this.event.summary,
                y_expand: true,
                style_class: "calendar-event-summary"
            }
        );

        event_summary.get_clutter_text().line_wrap = true;
        event_summary.get_clutter_text().ellipsize = Pango.EllipsizeMode.NEVER;
        vbox.add(event_summary, { expand: true });

        this.update_variations();
    }

    update_variations() {
        let time_until_start = this.event.start.difference(GLib.DateTime.new_now_local());
        let time_until_finish = this.event.end.difference(GLib.DateTime.new_now_local());

        let today = date_only(GLib.DateTime.new_now_local());
        let selected_is_today = dt_equals(today, this.selected_date);
        let starts_today = dt_equals(today, this.event.start_date);

        if (time_until_finish < 0) {
            this.event_time.set_style_class_name("calendar-event-time-past");

            this.countdown_label.set_text("");
        } else if (time_until_start > 0) {
            this.event_time.set_style_class_name("calendar-event-time-future");

            if (starts_today) {
                let [countdown_pclass, text] = format_timespan(time_until_start);
                this.countdown_label.set_text(text);
                this.countdown_label.add_style_pseudo_class(countdown_pclass);
                this.is_current_or_next = !this.event.all_day;
            } else {
                this.countdown_label.set_text("");
            }
        } else {
            this.event_time.set_style_class_name("calendar-event-time-present");

            if (this.event.all_day || this.event.multi_day) {
                this.countdown_label.set_text("");
                this.event_time.set_style_pseudo_class("all-day");
            } else {
                this.countdown_label.set_text(_("In progress"));
                this.countdown_label.set_style_pseudo_class("current");
            } 

            this.is_current_or_next = this.event.is_today && !this.event.all_day;
        }

        let time_format;

        if (this.use_24h) {
            time_format = "%H:%M";
        } else {
            time_format = "%l:%M %p";
        }

        let final_str = "";

        // Simple, single-day events
        if (this.event.starts_on_day(this.selected_date) && !this.event.multi_day) {
            if (this.event.all_day) {
                // an all day event: "All day"
                final_str += _("All day");
            } else {
                // a timed event: "12:00 pm"
                final_str += this.event.start.format(time_format);
            }

            this.event_time.set_text(final_str);
            return;
        }

        // Past multi-day events (all-day or timed)
        // "12/04/2011 -> 12/08/2011"
        if (this.event.multi_day && this.event.ended_before_day(today)) {
            final_str += this.event.start_date.format("%x");
            final_str += ARROW_SEPARATOR;
            final_str += this.event.end_date.format("%x");
            this.event_time.set_text(final_str);
            return;
        }

        if (selected_is_today) {
            // prefix for current day selected
            if (this.event.starts_on_day(this.selected_date)) {
                if (this.event.all_day) {
                    // all day event that starts today: "Today -> ..."
                    final_str += _("Today")
                } else {
                    // timed: "12:00 pm -> ..."
                    final_str += this.event.start.format(time_format);
                }
            } else
            // event started prior to today
            if (this.event.started_before_day(this.selected_date)) {
                // If it started within the last few days, show the day of week: "Wednesday -> ..."
                if (this.event.started_after_day(this.selected_date.add_days(-4))) {
                    final_str += locale_cap(this.event.start_date.format(DAY_FORMAT));
                } else {
                    // otherwise the date: "12/04/2011 ->"
                    final_str += this.event.start_date.format("%x");
                }
            }

            final_str += ARROW_SEPARATOR;

            // suffix for current day selected
            if (this.event.ends_on_day(this.selected_date)) {
                if (this.event.all_day) {
                    // All-day event started previously, ends today: "-> Today"
                    final_str += _("Today")
                } else {
                    // Timed event started previously, ends today: "-> 12:00 pm"
                    final_str += this.event.end.format(time_format);
                }
            } else
            if (this.event.ends_after_day(this.selected_date.add_days(4))) {
                // ends more than a few days after today: "-> 04/15/2011"
                final_str += this.event.end_date.format("%x");
            } else {
                // ends only a few days after today: "-> Wednesday"
                final_str += locale_cap(this.event.end_date.format(DAY_FORMAT));
            }
        } else {
            // Prefix for non-current day selected
            if (this.event.started_before_day(today)) {
                if (this.event.started_after_day(today.add_days(-4))) {
                    // started in the last couple of days: "Wednesday -> ..."
                    final_str += locale_cap(this.event.start_date.format(DAY_FORMAT));
                } else {
                    // Started on the selected day (but not today): "12:00 pm -> ..."
                    if (this.event.starts_on_day(this.selected_date) && !this.event.all_day) {
                        final_str += this.event.start.format(time_format);
                    } else {
                        // just the date if it's all day or started on an earlier day than selected: "04-16-2011 -> ..."
                        final_str += this.event.start_date.format("%x");
                    }
                }
            } else {
                // We're viewing some future day, an event that started today: "4:00 pm Today"
                if (this.event.starts_on_day(today)) {

                    // Just "Today" if it's an all-day event
                    if (!this.event.all_day) {
                        final_str += this.event.start.format(time_format);
                        final_str += " ";
                    }

                    final_str += _("Today");
                } else {
                    // Event starts in the next few days: "Wednesday -> ..."
                    if (this.event.started_before_day(today.add_days(4))) {
                        final_str += this.event.start_date.format(DAY_FORMAT);
                    } else {
                        // Any other start date, show that date: "04/16/2011 -> ..."
                        final_str += this.event.start_date.format("%x");
                    }
                }
            }

            final_str += ARROW_SEPARATOR;

            if (this.event.ends_on_day(today)) {
                // Event ends today (but we're viewing some interim day)
                if (!this.event.all_day) {
                    // not all day: "-> 4:30 pm Today"
                    final_str += this.event.end.format(time_format);
                    final_str += " ";
                }
                // all day ends today: "-> Today"
                final_str += _("Today");
            } else
            if (this.event.ends_on_day(this.selected_date) && !this.event.all_day) {
                // Ends on the selected date, not all day: "-> 12:00 pm"
                final_str += this.event.end.format(time_format);
            } else
            // Ends more than a few days after today: "-> 4/16/2021"
            if (this.event.ends_after_day(today.add_days(4))) {
                final_str += this.event.end_date.format("%x");
            } else {
                // less than a few days after today: "-> Wednesday"
                final_str += locale_cap(this.event.end_date.format(DAY_FORMAT));
            }
        }

        this.event_time.set_text(final_str);
    }
}
Signals.addSignalMethods(EventRow.prototype);
