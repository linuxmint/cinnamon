// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

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
const SHOW_WEEKDATE_KEY = 'show-week-numbers';
const FIRST_WEEKDAY_KEY = 'first-day-of-week';
const DESKTOP_SCHEMA = 'org.cinnamon.desktop.interface';

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

function _getDigitWidth(actor){
    let context = actor.get_pango_context();
    let themeNode = actor.get_theme_node();
    let font = themeNode.get_font();
    let metrics = context.get_metrics(font, context.get_language());
    let width = metrics.get_approximate_digit_width();
    return width;
}

function _getCalendarDayAbbreviation(dayNumber) {

    // This returns an array of abbreviated day names, starting with Sunday.
    // We use 2014/03/02 (months are zero-based in JS) because it was a Sunday

    let abbreviations = [
        new Date(2014, 2, 2).toLocaleFormat('%a'),
        new Date(2014, 2, 3).toLocaleFormat('%a'),
        new Date(2014, 2, 4).toLocaleFormat('%a'),
        new Date(2014, 2, 5).toLocaleFormat('%a'),
        new Date(2014, 2, 6).toLocaleFormat('%a'),
        new Date(2014, 2, 7).toLocaleFormat('%a'),
        new Date(2014, 2, 8).toLocaleFormat('%a')
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

function Calendar(settings) {
    this._init(settings);
}

Calendar.prototype = {
    _init: function(settings) {
        this._weekStart = Cinnamon.util_get_week_start();
        this._weekdate = NaN;
        this._digitWidth = NaN;
        this.settings = settings;

        this.settings.connect("changed::show-week-numbers", Lang.bind(this, this._onSettingsChange));
        this.desktop_settings = new Gio.Settings({ schema_id: DESKTOP_SCHEMA });
        this.desktop_settings.connect("changed::" + FIRST_WEEKDAY_KEY, Lang.bind(this, this._onSettingsChange));
        this.show_week_numbers = this.settings.getValue("show-week-numbers");

        // Find the ordering for month/year in the calendar heading

        let var_name = 'calendar:MY';
        switch (Gettext_gtk30.gettext(var_name)) {
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
        switch (key) {
	    case SHOW_WEEKDATE_KEY:
		this.show_week_numbers = new_val;
		break;
	    case FIRST_WEEKDAY_KEY:
		this._weekStart = Cinnamon.util_get_week_start();
		break;
	}
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
        this.actor.destroy_all_children();

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
        this._firstDayIndex = this.actor.get_n_children();
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

        this._monthLabel.text = this._selectedDate.toLocaleFormat('%B').capitalize();
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

            button.reactive = false;

            let iterStr = iter.toUTCString();
            button.connect('clicked', Lang.bind(this, function() {
                let newlySelectedDate = new Date(iterStr);
                this.setDate(newlySelectedDate, false);
            }));

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

            button.style_class = styleClass;

            let offsetCols = this.show_week_numbers ? 1 : 0;
            this.actor.add(button,
                           { row: row, col: offsetCols + (7 + iter.getDay() - this._weekStart) % 7 });

            if (this.show_week_numbers && iter.getDay() == 4) {
                let label = new St.Label({ text: iter.toLocaleFormat('%V'),
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
    }
};

Signals.addSignalMethods(Calendar.prototype);


