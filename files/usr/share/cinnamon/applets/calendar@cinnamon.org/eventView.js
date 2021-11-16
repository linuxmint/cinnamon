// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Goa = imports.gi.Goa;
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

// TODO: this is duplicated from applet.js
const DATE_FORMAT_FULL = CinnamonDesktop.WallClock.lctime_format("cinnamon", "%A, %B %-e, %Y");

function js_date_to_gdatetime(js_date) {
    let unix = js_date.getTime() / 1000; // getTime returns ms
    return GLib.DateTime.new_from_unix_local(unix);
}

function get_date_only_from_datetime(gdatetime) {
    let date_only = GLib.DateTime.new_local(
        gdatetime.get_year(),
        gdatetime.get_month(),
        gdatetime.get_day_of_month(), 0, 0, 0
    )

    return date_only;
}

function get_month_year_only_from_datetime(gdatetime) {
    let month_year_only = GLib.DateTime.new_local(
        gdatetime.get_year(),
        gdatetime.get_month(),
        1, 0, 0, 0
    )

    return month_year_only;
}

function format_timespan(timespan) {
    let minutes = Math.floor(timespan / GLib.TIME_SPAN_MINUTE)

    if (minutes < 10) {
        return ["imminent", _("Starting in a few minutes")];
    }

    if (minutes < 60) {
        return ["soon", _(`Starting in ${minutes} minutes`)];
    }

    let hours = Math.floor(minutes / 60);

    if (hours > 6) {
        let now = GLib.DateTime.new_now_local();
        let later = now.add_hours(hours);

        if (later.get_hour() > 18) {
            return ["", _("This evening")]
        }

        return ["", _("Starting later today")];
    }

    return ["", ngettext("In %d hour", "In %d hours", hours).format(hours)];
}


// GLib.DateTime.equal is broken
function gdate_time_equals(dt1, dt2) {
    return dt1.to_unix() === dt2.to_unix();
}

class EventData {
    constructor(data_var) {
        const [id, color, summary, all_day, start_time, end_time] = data_var.deep_unpack();
        this.id = id;
        this.start = GLib.DateTime.new_from_unix_local(start_time);
        this.end = GLib.DateTime.new_from_unix_local(end_time);
        this.all_day = all_day;
        this.duration = all_day ? -1 : this.end.difference(this.start);

        let date_only_start = get_date_only_from_datetime(this.start)
        let date_only_today = get_date_only_from_datetime(GLib.DateTime.new_now_local())

        this.is_today = gdate_time_equals(date_only_start, date_only_today);
        this.summary = summary
        this.color = color;
    }

    equal(other_event) {
        return (this.start.to_unix() === other_event.start.to_unix() &&
                this.end.to_unix() === other_event.end.to_unix() &&
                this.all_day === other_event.all_day &&
                this.summary === other_event.summary &&
                this.color === other_event.color);
    }
}

class EventDataList {
    constructor(gdate_only) {
        // a system timestamp, to let the event list know if the array it received
        // is changed.
        this.gdate_only = gdate_only
        this.timestamp = 0;
        this.length = 0;
        this._events = {}
    }

    add_or_update(event_data) {
        let existing = this._events[event_data.id];

        if (existing === undefined) {
            this.length++;
        }

        if (existing !== undefined && event_data.equal(existing)) {
            return false;;
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

    get_event_list() {
        let now = GLib.DateTime.new_now_local();

        let events_as_array = [];
        for (let id in this._events) {
            events_as_array.push(this._events[id])
        }

        // chrono order for non-current day
        events_as_array.sort((a, b) => {
            return a.start.to_unix() - b.start.to_unix();
        });

        if (!gdate_time_equals(get_date_only_from_datetime(now), this.gdate_only)) {
            return events_as_array;
        }

        // for the current day keep all-day events just above the current or first pending event
        let all_days = []
        let final_list = []

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
        this.current_selected_date = null;
        this.events_by_date = {};

        this._inited = false;
        this._has_calendars = false;

        this._periodic_update_timer_id = 0;

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

        Goa.Client.new(null, this._goa_client_new_finished.bind(this));
    }

    _goa_client_new_finished(source, res) {
        try {
            this.goa_client = Goa.Client.new_finish(res);
            this.goa_client.connect("account-added", this._update_goa_client_has_calendars.bind(this));
            this.goa_client.connect("account-changed", this._update_goa_client_has_calendars.bind(this));
            this.goa_client.connect("account-removed", this._update_goa_client_has_calendars.bind(this));
        } catch (e) {
            log("could not connect to calendar server process: " + e);
        }
    }

    _update_goa_client_has_calendars(client, changed_objects) {
        // goa can tell us if there are any accounts with enabled
        // calendars. Asking our calendar server ("has-calenders")
        // is useless if the server is only on periodic updates, as
        // we'd need to wait to ask it once it was 'initialized'.
        // This prevents having to start another process at all, if
        // there's no reason to.

        let objects = this.goa_client.get_accounts();
        let any_calendars = false;

        for (let obj of objects) {
            let account = obj.get_account()
            if (!account.calendar_disabled) {
                any_calendars = true;
            }
        }

        if (any_calendars !== this._has_calendars) {
            // log("has calendars: "+any_calendars)
            this._has_calendars = any_calendars;
            this.emit("has-calendars-changed");
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

            global.settings.connect("changed::calendar-server-keep-active", this._start_periodic_timer.bind(this));
            global.settings.connect("changed::calendar-server-update-interval", this._start_periodic_timer.bind(this));

            this._start_periodic_timer(null, null);
            this._update_goa_client_has_calendars(null, null);
            this._inited = true;

            this.emit("events-manager-ready");
        } catch (e) {
            log("could not connect to calendar server process: " + e);
            return;
        }
    }

    _stop_periodic_timer() {
        if (this._periodic_update_timer_id > 0) {
            Mainloop.source_remove(this._periodic_update_timer_id);
            this._periodic_update_timer_id = 0;
        }
    }

    _start_periodic_timer(settings, key) {
        this._stop_periodic_timer();

        if (!global.settings.get_boolean("calendar-server-keep-active")) {
            this._periodic_update_timer_id = Mainloop.timeout_add_seconds(
                global.settings.get_int("calendar-server-update-interval") * 60,
                this._perform_periodic_update.bind(this)
            );
        }
    }

    _perform_periodic_update() {
        this.emit("run-periodic-update");

        return GLib.SOURCE_CONTINUE;
    }

    _handle_added_or_updated_events(server, varray) {
        let changed = false;

        let events = varray.unpack()
        for (let n = 0; n < events.length; n++) {
            let data = new EventData(events[n]);
            let gdate_only = get_date_only_from_datetime(data.start);
            let hash = gdate_only.to_unix();

            if (this.events_by_date[hash] === undefined) {
                this.events_by_date[hash] = new EventDataList(gdate_only);
            }

            if (this.events_by_date[hash].add_or_update(data)) {
                if (gdate_time_equals(gdate_only, this.current_selected_date)) {
                    changed = true;
                }
            }
        }
        // log("handle added : "+changed);
        if (changed) {
            this._event_list.set_events(this.events_by_date[this.current_selected_date.to_unix()]);
        }

        this.emit("events-updated");
    }

    _handle_removed_events(server, uids_string) {
        let uids = uids_string.split("::")
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
        this.queue_reload_today(true);
    }

    get_event_list() {
        if (this._event_list !== null) {
            return this._event_list;
        }

        this._event_list = new EventList(this.settings, this.desktop_settings);

        return this._event_list;
    }

    fetch_month_events(month_year, force) {
        if (!force && this.current_month_year !== null && gdate_time_equals(month_year, this.current_month_year)) {
            return;
        }
        // global.logTrace("fetch");
        this.current_month_year = month_year;
        this.events_by_date = {};

        // get first day of month
        let day_one = get_month_year_only_from_datetime(month_year)
        let week_day = day_one.get_day_of_week()
        let week_start = Cinnamon.util_get_week_start();

        // back up to the start of the week preceeding day 1
        let start = day_one.add_days( -(week_day - week_start) )
        // The calendar has 42 boxes
        let end = start.add_days(42).add_seconds(-1)

        this._calendar_server.call_set_time_range(start.to_unix(), end.to_unix(), force, null, this.call_finished.bind(this));

        // If we just started the server and asked for events here, the timer can be reset.
        this._start_periodic_timer();
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
        this._cancel_reload_today()

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

        let gdate_only = get_date_only_from_datetime(gdate);
        let month_year = get_month_year_only_from_datetime(gdate_only);
        this.fetch_month_events(month_year, force);

        this._event_list.set_date(gdate);

        let delay_no_events_label = this.current_selected_date === null;
        if (this.current_selected_date !== null) {
            let new_month = !gdate_time_equals(get_month_year_only_from_datetime(this.current_selected_date),
                                               get_month_year_only_from_datetime(gdate_only))
            delay_no_events_label = new_month;
        }

        this.current_selected_date = gdate_only;

        let existing_event_list = this.events_by_date[gdate_only.to_unix()];
        if (existing_event_list !== undefined) {
            // log("---------------cache hit");
            this._event_list.set_events(existing_event_list, delay_no_events_label);
        } else {
            this._event_list.set_events(null, delay_no_events_label);
        }
    }

    get_colors_for_date(js_date) {
        let gdate = js_date_to_gdatetime(js_date);
        let date_only = get_date_only_from_datetime(gdate);

        let event_data_list = this.events_by_date[date_only.to_unix()];

        return event_data_list !== undefined ? event_data_list.get_colors() : null;
    }

    is_active() {
        return this._inited &&
               this.settings.getValue("show-events") &&
               this._calendar_server !== null &&
               this._has_calendars;
    }
}
Signals.addSignalMethods(EventsManager.prototype);

class EventList {
    constructor(settings, desktop_settings) {
        this.settings = settings;
        this.desktop_settings = desktop_settings;
        this._no_events_timeout_id = 0;
        this._rows = []
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
                style_class: "calendar-events-date-label"
            }
        )
        this.actor.add_actor(this.selected_date_label);

        this.no_events_label = new St.Label(
            {
                style_class: "calendar-events-no-events-label",
                text: _("Nothing scheduled!"),
                visible: false,
                y_align: Clutter.ActorAlign.CENTER,
                y_expand: true
            }
        );
        this.actor.add_actor(this.no_events_label);

        this.events_box = new St.BoxLayout(
            {
                style_class: 'calendar-events-event-container',
                vertical: true,
                accessible_role: Atk.Role.LIST
            }
        );
        this.events_scroll_box = new St.ScrollView(
            { 
                style_class: 'vfade calendar-events-scrollbox',
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC
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

    set_date(gdate) {
        this.selected_date_label.set_text(gdate.format(DATE_FORMAT_FULL));
    }

    set_events(event_data_list, delay_no_events_label) {
        if (event_data_list !== null && event_data_list.timestamp === this._current_event_data_list_timestamp) {
            this._rows.forEach((row) => {
                row.update_variations();
            });
            return;
        }

        this.events_box.get_children().forEach((actor) => {
            actor.destroy();
        })

        this._rows = [];

        if (this._no_events_timeout_id > 0) {
            Mainloop.source_remove(this._no_events_timeout_id);
            this._no_events_timeout_id = 0;
        }

        if (event_data_list === null) {
            // Show the 'no events' label, but wait a little bit to give the calendar server
            // to deliver some events if there are any.
            if (delay_no_events_label) {
                this._no_events_timeout_id = Mainloop.timeout_add(600, Lang.bind(this, function() {
                    this._no_events_timeout_id = 0
                    this.no_events_label.show();
                    return GLib.SOURCE_REMOVE;
                }));
            } else {
                this.no_events_label.show();
            }

            this._current_event_data_list_timestamp = 0;
            return;
        }

        this.no_events_label.hide();
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
                {
                    use_24h: this.desktop_settings.get_boolean("clock-use-24h")
                }
            );

            row.connect("view-event", Lang.bind(this, (row, uuid) => {
                this.emit("launched-calendar");
                Util.trySpawn(["gnome-calendar", "--uuid", uuid], false);
            }))

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
    constructor(event, params) {
        this.event = event;
        this.is_current_or_next = false;

        this.actor = new St.BoxLayout(
            {
                style_class: "calendar-event-button",
                reactive: true
            }
        );

        this.actor.connect("enter-event", Lang.bind(this, () => {
            this.actor.add_style_pseudo_class("hover");
        }))

        this.actor.connect("leave-event", Lang.bind(this, () => {
            this.actor.remove_style_pseudo_class("hover");
        }))

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
        )

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
            });
        vbox.add_actor(label_box);

        let time_format = "%l:%M %p"

        if (params.use_24h) {
            time_format = "%H:%M"
        }

        let text = null;

        if (this.event.all_day) {
            text = _("All day");
        } else {
            text = `${this.event.start.format(time_format)}`;
        }

        this.event_time = new St.Label(
            {
                x_align: Clutter.ActorAlign.START,
                text: text,
                style_class: "calendar-event-time"
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
        let time_until_start = this.event.start.difference(GLib.DateTime.new_now_local())
        let time_until_finish = this.event.end.difference(GLib.DateTime.new_now_local())

        if (time_until_finish < 0) {
            this.actor.set_style_pseudo_class("past");
            this.event_time.set_style_pseudo_class("past");

            this.countdown_label.set_text("");
        } else if (time_until_start > 0) {
            this.actor.set_style_pseudo_class("future");
            this.event_time.set_style_pseudo_class("future");

            if (this.event.is_today) {
                let [countdown_pclass, text] = format_timespan(time_until_start);
                this.countdown_label.set_text(text);
                this.countdown_label.add_style_pseudo_class(countdown_pclass);
                this.is_current_or_next = !this.event.all_day;
            } else {
                this.countdown_label.set_text("");
            }
        } else {
            this.actor.set_style_pseudo_class("present");
            this.event_time.set_style_pseudo_class("");

            if (this.event.all_day) {
                this.countdown_label.set_text("");
                this.event_time.set_style_pseudo_class("all-day");
            } else {
                this.countdown_label.set_text(_("In progress"));
                this.countdown_label.set_style_pseudo_class("current");
            } 

            this.is_current_or_next = this.event.is_today && !this.event.all_day;
        }
    }
}
Signals.addSignalMethods(EventRow.prototype);
