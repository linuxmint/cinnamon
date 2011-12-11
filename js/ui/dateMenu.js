// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const Params = imports.misc.params;
const Util = imports.misc.util;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Calendar = imports.ui.calendar;
const UPowerGlib = imports.gi.UPowerGlib;

// in org.gnome.desktop.interface
const CLOCK_FORMAT_KEY        = 'clock-format';

// in org.gnome.shell.clock
const CLOCK_SHOW_DATE_KEY     = 'show-date';
const CLOCK_SHOW_SECONDS_KEY  = 'show-seconds';

function _onVertSepRepaint (area)
{
    let cr = area.get_context();
    let themeNode = area.get_theme_node();
    let [width, height] = area.get_surface_size();
    let stippleColor = themeNode.get_color('-stipple-color');
    let stippleWidth = themeNode.get_length('-stipple-width');
    let x = Math.floor(width/2) + 0.5;
    cr.moveTo(x, 0);
    cr.lineTo(x, height);
    Clutter.cairo_set_source_color(cr, stippleColor);
    cr.setDash([1, 3], 1); // Hard-code for now
    cr.setLineWidth(stippleWidth);
    cr.stroke();
};

function DateMenuButton() {
    this._init.apply(this, arguments);
}

DateMenuButton.prototype = {
    __proto__: PanelMenu.Button.prototype,

    _init: function(params) {
        params = Params.parse(params, { showEvents: true });

        let item;
        let hbox;
        let vbox;

        let menuAlignment = 0.25;
        if (St.Widget.get_default_direction() == St.TextDirection.RTL)
            menuAlignment = 1.0 - menuAlignment;
        PanelMenu.Button.prototype._init.call(this, menuAlignment);

        this._clock = new St.Label();
        this.actor.add_actor(this._clock);

        hbox = new St.BoxLayout({name: 'calendarArea' });
        this.menu.addActor(hbox);

        // Fill up the first column

        vbox = new St.BoxLayout({vertical: true});
        hbox.add(vbox);

        // Date
        this._date = new St.Label();
        this._date.style_class = 'datemenu-date-label';
        vbox.add(this._date);

        if (params.showEvents) {
            this._eventSource = new Calendar.DBusEventSource();
            this._eventList = new Calendar.EventsList(this._eventSource);
        } else {
            this._eventSource = null;
            this._eventList = null;
        }

        // Calendar
        this._calendar = new Calendar.Calendar(this._eventSource);

        this._calendar.connect('selected-date-changed',
                               Lang.bind(this, function(calendar, date) {
                                  // we know this._eventList is defined here, because selected-data-changed
                                  // only gets emitted when the user clicks a date in the calendar,
                                  // and the calender makes those dates unclickable when instantiated with
                                  // a null event source
                                   this._eventList.setDate(date);
                               }));
        vbox.add(this._calendar.actor);

        item = this.menu.addSettingsAction(_("Date and Time Settings"), 'gnome-datetime-panel.desktop');
        if (item) {
            let separator = new PopupMenu.PopupSeparatorMenuItem();
            separator.setColumnWidths(1);
            vbox.add(separator.actor, {y_align: St.Align.END, expand: true, y_fill: false});

            item.actor.can_focus = false;
            item.actor.reparent(vbox);
        }

        if (params.showEvents) {
            // Add vertical separator

            item = new St.DrawingArea({ style_class: 'calendar-vertical-separator',
                                        pseudo_class: 'highlighted' });
            item.connect('repaint', Lang.bind(this, _onVertSepRepaint));
            hbox.add(item);

            // Fill up the second column
            vbox = new St.BoxLayout({name:     'calendarEventsArea',
                                     vertical: true});
            hbox.add(vbox, { expand: true });

            // Event list
            vbox.add(this._eventList.actor, { expand: true });

            item = new PopupMenu.PopupMenuItem(_("Open Calendar"));
            item.connect('activate', Lang.bind(this, this._onOpenCalendarActivate));
            item.actor.can_focus = false;
            vbox.add(item.actor, {y_align: St.Align.END, expand: true, y_fill: false});
        }

        // Whenever the menu is opened, select today
        this.menu.connect('open-state-changed', Lang.bind(this, function(menu, isOpen) {
            if (isOpen) {
                let now = new Date();
                /* Passing true to setDate() forces events to be reloaded. We
                 * want this behavior, because
                 *
                 *   o It will cause activation of the calendar server which is
                 *     useful if it has crashed
                 *
                 *   o It will cause the calendar server to reload events which
                 *     is useful if dynamic updates are not supported or not
                 *     properly working
                 *
                 * Since this only happens when the menu is opened, the cost
                 * isn't very big.
                 */
                this._calendar.setDate(now, true);
                // No need to update this._eventList as ::selected-date-changed
                // signal will fire
            }
        }));

        // Done with hbox for calendar and event list

        // Track changes to clock settings
        this._desktopSettings = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });
        this._clockSettings = new Gio.Settings({ schema: 'org.gnome.shell.clock' });
        this._desktopSettings.connect('changed', Lang.bind(this, this._updateClockAndDate));
        this._clockSettings.connect('changed', Lang.bind(this, this._updateClockAndDate));

        // https://bugzilla.gnome.org/show_bug.cgi?id=655129
        this._upClient = new UPowerGlib.Client();
        this._upClient.connect('notify-resume', Lang.bind(this, this._updateClockAndDate));

        // Start the clock
        this._updateClockAndDate();
    },

    _updateClockAndDate: function() {
        let format = this._desktopSettings.get_string(CLOCK_FORMAT_KEY);
        let showDate = this._clockSettings.get_boolean(CLOCK_SHOW_DATE_KEY);
        let showSeconds = this._clockSettings.get_boolean(CLOCK_SHOW_SECONDS_KEY);

        let clockFormat;
        let dateFormat;

        switch (format) {
            case '24h':
                if (showDate)
                    /* Translators: This is the time format with date used
                       in 24-hour mode. */
                    clockFormat = showSeconds ? _("%a %b %e, %R:%S")
                                              : _("%a %b %e, %R");
                else
                    /* Translators: This is the time format without date used
                       in 24-hour mode. */
                    clockFormat = showSeconds ? _("%a %R:%S")
                                              : _("%a %R");
                break;
            case '12h':
            default:
                if (showDate)
                    /* Translators: This is a time format with date used
                       for AM/PM. */
                    clockFormat = showSeconds ? _("%a %b %e, %l:%M:%S %p")
                                              : _("%a %b %e, %l:%M %p");
                else
                    /* Translators: This is a time format without date used
                       for AM/PM. */
                    clockFormat = showSeconds ? _("%a %l:%M:%S %p")
                                              : _("%a %l:%M %p");
                break;
        }

        let displayDate = new Date();

        this._clock.set_text(displayDate.toLocaleFormat(clockFormat));

        /* Translators: This is the date format to use when the calendar popup is
         * shown - it is shown just below the time in the shell (e.g. "Tue 9:29 AM").
         */
        dateFormat = _("%A %B %e, %Y");
        this._date.set_text(displayDate.toLocaleFormat(dateFormat));

        Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateClockAndDate));
        return false;
    },

    _onOpenCalendarActivate: function() {
        this.menu.close();
        let calendarSettings = new Gio.Settings({ schema: 'org.gnome.desktop.default-applications.office.calendar' });
        let tool = calendarSettings.get_string('exec');
        if (tool.length == 0 || tool == 'evolution') {
            // TODO: pass the selected day
            Util.spawn(['evolution', '-c', 'calendar']);
        } else {
            let needTerm = calendarSettings.get_boolean('needs-term');
            if (needTerm) {
                let terminalSettings = new Gio.Settings({ schema: 'org.gnome.desktop.default-applications.terminal' });
                let term = terminalSettings.get_string('exec');
                let arg = terminalSettings.get_string('exec-arg');
                if (arg != '')
                    Util.spawn([term, arg, tool]);
                else
                    Util.spawn([term, tool]);
            } else {
                Util.spawnCommandLine(tool)
            }
        }
    }
};
