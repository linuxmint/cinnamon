// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const DBus = imports.dbus;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const St = imports.gi.St;
const Signals = imports.signals;
const Pango = imports.gi.Pango;
const Gettext_gtk30 = imports.gettext.domain('gtk30');
const Cinnamon = imports.gi.Cinnamon;
const Settings = imports.ui.settings;

const MSECS_IN_DAY = 24 * 60 * 60 * 1000;
const WEEKDATE_HEADER_WIDTH_DIGITS = 3;
const SHOW_WEEKDATE_KEY = 'show-weekdate';

// in org.cinnamon.desktop.interface
const CLOCK_FORMAT_KEY        = 'clock-format';

function _sameDay(dateA, dateB) {
    return (dateA.getDate() == dateB.getDate() &&
            dateA.getMonth() == dateB.getMonth() &&
            dateA.getYear() == dateB.getYear());
}

function _sameYear(dateA, dateB) {
    return (dateA.getYear() == dateB.getYear());
}

/* TODO: maybe needs config - right now we assume that Saturday and
 * Sunday are non-work days (not true in e.g. Israel, it's Sunday and
 * Monday there)
 */
function _isWorkDay(date) {
    return date.getDay() != 0 && date.getDay() != 6;
}

function _getBeginningOfDay(date) {
    let ret = new Date(date.getTime());
    ret.setHours(0);
    ret.setMinutes(0);
    ret.setSeconds(0);
    ret.setMilliseconds(0);
    return ret;
}

function _getEndOfDay(date) {
    let ret = new Date(date.getTime());
    ret.setHours(23);
    ret.setMinutes(59);
    ret.setSeconds(59);
    ret.setMilliseconds(999);
    return ret;
}

function _formatEventTime(event, clockFormat) {
    let ret;
    if (event.allDay) {
        /* Translators: Shown in calendar event list for all day events
         * Keep it short, best if you can use less then 10 characters
         */
        ret = C_("event list time", "All Day");
    } else {
        switch (clockFormat) {
        case '24h':
            /* Translators: Shown in calendar event list, if 24h format */
            ret = event.date.toLocaleFormat(C_("event list time", "%H:%M"));
            break;

        default:
            /* explicit fall-through */
        case '12h':
            /* Transators: Shown in calendar event list, if 12h format */
            ret = event.date.toLocaleFormat(C_("event list time", "%l:%M %p"));
            break;
        }
    }
    return ret;
}

function _getCalendarWeekForDate(date) {
    // Based on the algorithms found here:
    // http://en.wikipedia.org/wiki/Talk:ISO_week_date
    let midnightDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    // Need to get Monday to be 1 ... Sunday to be 7
    let dayOfWeek = 1 + ((midnightDate.getDay() + 6) % 7);
    let nearestThursday = new Date(midnightDate.getFullYear(), midnightDate.getMonth(),
                                   midnightDate.getDate() + (4 - dayOfWeek));

    let jan1st = new Date(nearestThursday.getFullYear(), 0, 1);
    let diffDate = nearestThursday - jan1st;
    let dayNumber = Math.floor(Math.abs(diffDate) / MSECS_IN_DAY);
    let weekNumber = Math.floor(dayNumber / 7) + 1;

    return weekNumber;
}

function _getDigitWidth(actor){
    let context = actor.get_pango_context();
    let themeNode = actor.get_theme_node();
    let font = themeNode.get_font();
    let metrics = context.get_metrics(font, context.get_language());
    let width = metrics.get_approximate_digit_width();
    return width;
}

function _getCalendarDayAbbreviation(dayNumber) {
    let abbreviations = [
        /* Translators: Calendar grid abbreviation for Sunday.
         *
         * NOTE: These grid abbreviations are always shown together
         * and in order, e.g. "S M T W T F S".
         */
        C_("grid sunday", "S"),
        /* Translators: Calendar grid abbreviation for Monday */
        C_("grid monday", "M"),
        /* Translators: Calendar grid abbreviation for Tuesday */
        C_("grid tuesday", "T"),
        /* Translators: Calendar grid abbreviation for Wednesday */
        C_("grid wednesday", "W"),
        /* Translators: Calendar grid abbreviation for Thursday */
        C_("grid thursday", "T"),
        /* Translators: Calendar grid abbreviation for Friday */
        C_("grid friday", "F"),
        /* Translators: Calendar grid abbreviation for Saturday */
        C_("grid saturday", "S")
    ];
    return abbreviations[dayNumber];
}

function _getEventDayAbbreviation(dayNumber) {
    let abbreviations = [
        /* Translators: Event list abbreviation for Sunday.
         *
         * NOTE: These list abbreviations are normally not shown together
         * so they need to be unique (e.g. Tuesday and Thursday cannot
         * both be 'T').
         */
        C_("list sunday", "Su"),
        /* Translators: Event list abbreviation for Monday */
        C_("list monday", "M"),
        /* Translators: Event list abbreviation for Tuesday */
        C_("list tuesday", "T"),
        /* Translators: Event list abbreviation for Wednesday */
        C_("list wednesday", "W"),
        /* Translators: Event list abbreviation for Thursday */
        C_("list thursday", "Th"),
        /* Translators: Event list abbreviation for Friday */
        C_("list friday", "F"),
        /* Translators: Event list abbreviation for Saturday */
        C_("list saturday", "S")
    ];
    return abbreviations[dayNumber];
}

// Abstraction for an appointment/event in a calendar

function CalendarEvent(date, end, summary, allDay) {
    this._init(date, end, summary, allDay);
}

CalendarEvent.prototype = {
    _init: function(date, end, summary, allDay) {
        this.date = date;
        this.end = end;
        this.summary = summary;
        this.allDay = allDay;
    }
};

// Interface for appointments/events - e.g. the contents of a calendar
//

// First, an implementation with no events
function EmptyEventSource() {
    this._init();
}

EmptyEventSource.prototype = {
    _init: function() {
    },

    requestRange: function(begin, end) {
    },

    getEvents: function(begin, end) {
        let result = [];
        return result;
    },

    hasEvents: function(day) {
        return false;
    }
};
Signals.addSignalMethods(EmptyEventSource.prototype);

const CalendarServerIface = {
    name: 'org.Cinnamon.CalendarServer',
    methods: [{ name: 'GetEvents',
                inSignature: 'xxb',
                outSignature: 'a(sssbxxa{sv})' }],
    signals: [{ name: 'Changed',
                inSignature: '' }]
};

const CalendarServer = function () {
    this._init();
};

CalendarServer.prototype = {
     _init: function() {
         DBus.session.proxifyObject(this, 'org.Cinnamon.CalendarServer', '/org/Cinnamon/CalendarServer');
     }
};

DBus.proxifyPrototype(CalendarServer.prototype, CalendarServerIface);

// an implementation that reads data from a session bus service
function DBusEventSource(owner) {
    this._init(owner);
}

function _datesEqual(a, b) {
    if (a < b)
        return false;
    else if (a > b)
        return false;
    return true;
}

function _dateIntervalsOverlap(a0, a1, b0, b1)
{
    if (a1 <= b0)
        return false;
    else if (b1 <= a0)
        return false;
    else
        return true;
}


DBusEventSource.prototype = {
    _init: function(owner) {
        this._resetCache();

        this._dbusProxy = new CalendarServer(owner);
        this._dbusProxy.connect('Changed', Lang.bind(this, this._onChanged));

        DBus.session.watch_name('org.Cinnamon.CalendarServer',
                                false, // do not launch a name-owner if none exists
                                Lang.bind(this, this._onNameAppeared),
                                Lang.bind(this, this._onNameVanished));
    },

    _resetCache: function() {
        this._events = [];
        this._lastRequestBegin = null;
        this._lastRequestEnd = null;
    },

    _onNameAppeared: function(owner) {
        this._resetCache();
        this._loadEvents(true);
    },

    _onNameVanished: function(oldOwner) {
        this._resetCache();
        this.emit('changed');
    },

    _onChanged: function() {
        this._loadEvents(false);
    },

    _onEventsReceived: function(appointments) {
        let newEvents = [];
        if (appointments != null) {
            for (let n = 0; n < appointments.length; n++) {
                let a = appointments[n];
                let date = new Date(a[4] * 1000);
                let end = new Date(a[5] * 1000);
                let summary = a[1];
                let allDay = a[3];
                let event = new CalendarEvent(date, end, summary, allDay);
                newEvents.push(event);
            }
            newEvents.sort(function(event1, event2) {
                return event1.date.getTime() - event2.date.getTime();
            });
        }

        this._events = newEvents;
        this.emit('changed');
    },

    _loadEvents: function(forceReload) {
        if (this._curRequestBegin && this._curRequestEnd){
            let callFlags = 0;
            if (forceReload)
                callFlags |= DBus.CALL_FLAG_START;
            this._dbusProxy.GetEventsRemote(this._curRequestBegin.getTime() / 1000,
                                            this._curRequestEnd.getTime() / 1000,
                                            forceReload,
                                            Lang.bind(this, this._onEventsReceived),
                                            callFlags);
        }
    },

    requestRange: function(begin, end, forceReload) {
        if (forceReload || !(_datesEqual(begin, this._lastRequestBegin) && _datesEqual(end, this._lastRequestEnd))) {
            this._lastRequestBegin = begin;
            this._lastRequestEnd = end;
            this._curRequestBegin = begin;
            this._curRequestEnd = end;
            this._loadEvents(forceReload);
        }
    },

    getEvents: function(begin, end) {
        let result = [];
        for(let n = 0; n < this._events.length; n++) {
            let event = this._events[n];
            if (_dateIntervalsOverlap (event.date, event.end, begin, end)) {
                result.push(event);
            }
        }
        return result;
    },

    hasEvents: function(day) {
        let dayBegin = _getBeginningOfDay(day);
        let dayEnd = _getEndOfDay(day);

        let events = this.getEvents(dayBegin, dayEnd);

        if (events.length == 0)
            return false;

        return true;
    }
};
Signals.addSignalMethods(DBusEventSource.prototype);

// Calendar:
// @eventSource: is an object implementing the EventSource API, e.g. the
// requestRange(), getEvents(), hasEvents() methods and the ::changed signal.
function Calendar(eventSource, settings) {
    this._init(eventSource, settings);
}

Calendar.prototype = {
    _init: function(eventSource, settings) {
        if (eventSource) {
            this._eventSource = eventSource;

            this._eventSource.connect('changed', Lang.bind(this,
                                                           function() {
                                                               this._update(false);
                                                           }));
        }

        this._weekStart = Cinnamon.util_get_week_start();
        this._weekdate = NaN;
        this._digitWidth = NaN;
        this.settings = settings;

        this.settings.connect("changed::show-week-numbers", Lang.bind(this, this._onSettingsChange));
        this.show_week_numbers = this.settings.getValue("show-week-numbers");

        // Find the ordering for month/year in the calendar heading

        switch (Gettext_gtk30.gettext('calendar:MY')) {
        case 'calendar:MY':
            this._headerMonthFirst = true;
            break;
        case 'calendar:YM':
            this._headerMonthFirst = false;
            break;
        default:
            log('Translation of "calendar:MY" in GTK+ is not correct');
            this._headerMonthFirst = true;
            break;
        }

        // Start off with the current date
        this._selectedDate = new Date();

        this.actor = new St.Table({ homogeneous: false,
                                    style_class: 'calendar',
                                    reactive: true });

        this.actor.connect('scroll-event',
                           Lang.bind(this, this._onScroll));

        this._buildHeader ();
    },

    _onSettingsChange: function(object, key, old_val, new_val) {
        this.show_week_numbers = new_val;
        this._buildHeader();
        this._update(false);
    },

    // Sets the calendar to show a specific date
    setDate: function(date, forceReload) {
        if (!_sameDay(date, this._selectedDate)) {
            this._selectedDate = date;
            this._update(forceReload);
            this.emit('selected-date-changed', new Date(this._selectedDate));
        } else {
            if (forceReload)
                this._update(forceReload);
        }
    },

    _buildHeader: function() {
        let offsetCols = this.show_week_numbers ? 1 : 0;
        this.actor.destroy_children();

        // Top line of the calendar '<| September |> <| 2009 |>'
        this._topBoxMonth = new St.BoxLayout();
        this._topBoxYear = new St.BoxLayout();

        if (this._headerMonthFirst) {
            this.actor.add(this._topBoxMonth,
                       {row: 0, col: 0, col_span: offsetCols + 4});
            this.actor.add(this._topBoxYear,
                       {row: 0, col: offsetCols + 4, col_span: 3});
        } else {
            this.actor.add(this._topBoxMonth,
                       {row: 0, col: offsetCols + 3, col_span: 4});
            this.actor.add(this._topBoxYear,
                       {row: 0, col: 0, col_span: offsetCols + 3});
        }

        this.actor.connect('style-changed', Lang.bind(this, this._onStyleChange));

        let back = new St.Button({ style_class: 'calendar-change-month-back' });
        this._topBoxMonth.add(back);
        back.connect('clicked', Lang.bind(this, this._onPrevMonthButtonClicked));

        this._monthLabel = new St.Label({style_class: 'calendar-month-label'});
        this._topBoxMonth.add(this._monthLabel, { expand: true, x_fill: false, x_align: St.Align.MIDDLE });

        let forward = new St.Button({ style_class: 'calendar-change-month-forward' });
        this._topBoxMonth.add(forward);
        forward.connect('clicked', Lang.bind(this, this._onNextMonthButtonClicked));

        back = new St.Button({style_class: 'calendar-change-month-back'});
        this._topBoxYear.add(back);
        back.connect('clicked', Lang.bind(this, this._onPrevYearButtonClicked));

        this._yearLabel = new St.Label({style_class: 'calendar-month-label'});
        this._topBoxYear.add(this._yearLabel, {expand: true, x_fill: false, x_align: St.Align.MIDDLE});

        forward = new St.Button({style_class: 'calendar-change-month-forward'});
        this._topBoxYear.add(forward);
        forward.connect('clicked', Lang.bind(this, this._onNextYearButtonClicked));

        // Add weekday labels...
        //
        // We need to figure out the abbreviated localized names for the days of the week;
        // we do this by just getting the next 7 days starting from right now and then putting
        // them in the right cell in the table. It doesn't matter if we add them in order
        let iter = new Date(this._selectedDate);
        iter.setSeconds(0); // Leap second protection. Hah!
        iter.setHours(12);
        for (let i = 0; i < 7; i++) {
            // Could use iter.toLocaleFormat('%a') but that normally gives three characters
            // and we want, ideally, a single character for e.g. S M T W T F S
            let customDayAbbrev = _getCalendarDayAbbreviation(iter.getDay());
            let label = new St.Label({ style_class: 'calendar-day-base calendar-day-heading',
                                       text: customDayAbbrev });
            this.actor.add(label,
                           { row: 1,
                             col: offsetCols + (7 + iter.getDay() - this._weekStart) % 7,
                             x_fill: false, x_align: St.Align.MIDDLE });
            iter.setTime(iter.getTime() + MSECS_IN_DAY);
        }

        // All the children after this are days, and get removed when we update the calendar
        this._firstDayIndex = this.actor.get_children().length;
    },

    _onStyleChange: function(actor, event) {
        // width of a digit in pango units
        this._digitWidth = _getDigitWidth(this.actor) / Pango.SCALE;
        this._setWeekdateHeaderWidth();
    },

    _setWeekdateHeaderWidth: function() {
        if (this.digitWidth != NaN && this.show_week_numbers && this._weekdateHeader) {
            this._weekdateHeader.set_width (this._digitWidth * WEEKDATE_HEADER_WIDTH_DIGITS);
        }
    },

    _onScroll : function(actor, event) {
        switch (event.get_scroll_direction()) {
        case Clutter.ScrollDirection.UP:
        case Clutter.ScrollDirection.LEFT:
            this._onPrevMonthButtonClicked();
            break;
        case Clutter.ScrollDirection.DOWN:
        case Clutter.ScrollDirection.RIGHT:
            this._onNextMonthButtonClicked();
            break;
        }
    },

    _applyDateBrowseAction: function(yearChange, monthChange) {
        let oldDate = this._selectedDate;
        let newMonth = oldDate.getMonth() + monthChange;

        if (newMonth> 11) {
            yearChange = yearChange + 1;
            newMonth = 0;
        } else if (newMonth < 0) {
            yearChange = yearChange - 1;
            newMonth = 11;
        }
        let newYear = oldDate.getFullYear() + yearChange;

        let newDayOfMonth = oldDate.getDate();
        let daysInMonth = 32 - new Date(newYear, newMonth, 32).getDate();
        if (newDayOfMonth > daysInMonth) {
            newDayOfMonth = daysInMonth;
        }

        let newDate = new Date();
        newDate.setFullYear(newYear, newMonth, newDayOfMonth);
        this.setDate(newDate, false);
    },

    _onPrevYearButtonClicked: function() {
        this._applyDateBrowseAction(-1, 0);
    },

    _onNextYearButtonClicked: function() {
        this._applyDateBrowseAction(+1, 0);
    },

    _onPrevMonthButtonClicked: function() {
        this._applyDateBrowseAction(0, -1);
    },

    _onNextMonthButtonClicked: function() {
        this._applyDateBrowseAction(0, +1);
    },

    _update: function(forceReload) {
        let now = new Date();

        this._monthLabel.text = this._selectedDate.toLocaleFormat('%B');
        this._yearLabel.text = this._selectedDate.toLocaleFormat('%Y');

        // Remove everything but the topBox and the weekday labels
        let children = this.actor.get_children();
        for (let i = this._firstDayIndex; i < children.length; i++)
            children[i].destroy();

        // Start at the beginning of the week before the start of the month
        let beginDate = new Date(this._selectedDate);
        beginDate.setDate(1);
        beginDate.setSeconds(0);
        beginDate.setHours(12);
        let daysToWeekStart = (7 + beginDate.getDay() - this._weekStart) % 7;
        beginDate.setTime(beginDate.getTime() - daysToWeekStart * MSECS_IN_DAY);

        let iter = new Date(beginDate);
        let row = 2;
        while (true) {
            let button = new St.Button({ label: iter.getDate().toString() });

            if (!this._eventSource)
                button.reactive = false;

            let iterStr = iter.toUTCString();
            button.connect('clicked', Lang.bind(this, function() {
                let newlySelectedDate = new Date(iterStr);
                this.setDate(newlySelectedDate, false);
            }));

            let hasEvents = this._eventSource && this._eventSource.hasEvents(iter);
            let styleClass = 'calendar-day-base calendar-day';
            if (_isWorkDay(iter))
                styleClass += ' calendar-work-day'
            else
                styleClass += ' calendar-nonwork-day'

            // Hack used in lieu of border-collapse - see cinnamon.css
            if (row == 2)
                styleClass = 'calendar-day-top ' + styleClass;
            if (iter.getDay() == this._weekStart)
                styleClass = 'calendar-day-left ' + styleClass;

            if (_sameDay(now, iter))
                styleClass += ' calendar-today';
            else if (iter.getMonth() != this._selectedDate.getMonth())
                styleClass += ' calendar-other-month-day';

            if (_sameDay(this._selectedDate, iter))
                button.add_style_pseudo_class('active');

            if (hasEvents)
                styleClass += ' calendar-day-with-events'

            button.style_class = styleClass;

            let offsetCols = this.show_week_numbers ? 1 : 0;
            this.actor.add(button,
                           { row: row, col: offsetCols + (7 + iter.getDay() - this._weekStart) % 7 });

            if (this.show_week_numbers && iter.getDay() == 4) {
                let label = new St.Label({ text: _getCalendarWeekForDate(iter).toString(),
                                           style_class: 'calendar-day-base calendar-week-number'});
                this.actor.add(label,
                               { row: row, col: 0, y_align: St.Align.MIDDLE });
            }

            iter.setTime(iter.getTime() + MSECS_IN_DAY);
            if (iter.getDay() == this._weekStart) {
                row++;
                // We always stop after placing 6 rows, even if month fits in 4 
                // to prevent issues with jumping controls, see #226
                if (row > 7) {
                    break;
                }
            }
        }
        // Signal to the event source that we are interested in events
        // only from this date range
        if (this._eventSource)
            this._eventSource.requestRange(beginDate, iter, forceReload);
    }
};

Signals.addSignalMethods(Calendar.prototype);

function EventsList(eventSource) {
    this._init(eventSource);
}

EventsList.prototype = {
    _init: function(eventSource) {
        this.actor = new St.BoxLayout({ vertical: true, style_class: 'events-header-vbox'});
        this._date = new Date();
        this._eventSource = eventSource;
        this._eventSource.connect('changed', Lang.bind(this, this._update));
        this._desktopSettings = new Gio.Settings({ schema: 'org.cinnamon.desktop.interface' });
        this._desktopSettings.connect('changed', Lang.bind(this, this._update));
        this._weekStart = Cinnamon.util_get_week_start();

        this._update();
    },

    _addEvent: function(dayNameBox, timeBox, eventTitleBox, includeDayName, day, time, desc) {
        if (includeDayName) {
            dayNameBox.add(new St.Label( { style_class: 'events-day-dayname',
                                           text: day } ),
                           { x_fill: true } );
        }
        timeBox.add(new St.Label( { style_class: 'events-day-time',
                                    text: time} ),
                    { x_fill: true } );
        eventTitleBox.add(new St.Label( { style_class: 'events-day-task',
                                          text: desc} ));
    },

    _addPeriod: function(header, begin, end, includeDayName, showNothingScheduled) {
        if (!this._eventSource)
            return;

        let events = this._eventSource.getEvents(begin, end);

        let clockFormat = this._desktopSettings.get_string(CLOCK_FORMAT_KEY);;

        if (events.length == 0 && !showNothingScheduled)
            return;

        let vbox = new St.BoxLayout( {vertical: true} );
        this.actor.add(vbox);

        vbox.add(new St.Label({ style_class: 'events-day-header', text: header }));
        let box = new St.BoxLayout({style_class: 'events-header-hbox'});
        let dayNameBox = new St.BoxLayout({ vertical: true, style_class: 'events-day-name-box' });
        let timeBox = new St.BoxLayout({ vertical: true, style_class: 'events-time-box' });
        let eventTitleBox = new St.BoxLayout({ vertical: true, style_class: 'events-event-box' });
        box.add(dayNameBox, {x_fill: false});
        box.add(timeBox, {x_fill: false});
        box.add(eventTitleBox, {expand: true});
        vbox.add(box);

        for (let n = 0; n < events.length; n++) {
            let event = events[n];
            let dayString = _getEventDayAbbreviation(event.date.getDay());
            let timeString = _formatEventTime(event, clockFormat);
            let summaryString = event.summary;
            this._addEvent(dayNameBox, timeBox, eventTitleBox, includeDayName, dayString, timeString, summaryString);
        }

        if (events.length == 0 && showNothingScheduled) {
            let now = new Date();
            /* Translators: Text to show if there are no events */
            let nothingEvent = new CalendarEvent(now, now, _("Nothing Scheduled"), true);
            let timeString = _formatEventTime(nothingEvent, clockFormat);
            this._addEvent(dayNameBox, timeBox, eventTitleBox, false, "", timeString, nothingEvent.summary);
        }
    },

    _showOtherDay: function(day) {
        this.actor.destroy_children();

        let dayBegin = _getBeginningOfDay(day);
        let dayEnd = _getEndOfDay(day);

        let dayString;
        let now = new Date();
        if (_sameYear(day, now))
            /* Translators: Shown on calendar heading when selected day occurs on current year */
            dayString = day.toLocaleFormat(C_("calendar heading", "%A, %B %d"));
        else
            /* Translators: Shown on calendar heading when selected day occurs on different year */
            dayString = day.toLocaleFormat(C_("calendar heading", "%A, %B %d, %Y"));
        this._addPeriod(dayString, dayBegin, dayEnd, false, true);
    },

    _showToday: function() {
        this.actor.destroy_children();

        let now = new Date();
        let dayBegin = _getBeginningOfDay(now);
        let dayEnd = _getEndOfDay(now);
        this._addPeriod(_("Today"), dayBegin, dayEnd, false, true);

        let tomorrowBegin = new Date(dayBegin.getTime() + 86400 * 1000);
        let tomorrowEnd = new Date(dayEnd.getTime() + 86400 * 1000);
        this._addPeriod(_("Tomorrow"), tomorrowBegin, tomorrowEnd, false, true);

        if (dayEnd.getDay() <= 4 + this._weekStart) {
            /* If now is within the first 5 days we show "This week" and
             * include events up until and including Saturday/Sunday
             * (depending on whether a week starts on Sunday/Monday).
             */
            let thisWeekBegin = new Date(dayBegin.getTime() + 2 * 86400 * 1000);
            let thisWeekEnd = new Date(dayEnd.getTime() + (6 + this._weekStart - dayEnd.getDay()) * 86400 * 1000);
            this._addPeriod(_("This week"), thisWeekBegin, thisWeekEnd, true, false);
        } else {
            /* otherwise it's one of the two last days of the week ... show
             * "Next week" and include events up until and including *next*
             * Saturday/Sunday
             */
            let nextWeekBegin = new Date(dayBegin.getTime() + 2 * 86400 * 1000);
            let nextWeekEnd = new Date(dayEnd.getTime() + (13 + this._weekStart - dayEnd.getDay()) * 86400 * 1000);
            this._addPeriod(_("Next week"), nextWeekBegin, nextWeekEnd, true, false);
        }
    },

    // Sets the event list to show events from a specific date
    setDate: function(date) {
        if (!_sameDay(date, this._date)) {
            this._date = date;
            this._update();
        }
    },

    _update: function() {
        let today = new Date();
        if (_sameDay (this._date, today)) {
            this._showToday();
        } else {
            this._showOtherDay(this._date);
        }
    }
};
