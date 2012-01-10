// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;

const Params = imports.misc.params;
const Util = imports.misc.util;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Calendar = imports.ui.calendar;
const UPowerGlib = imports.gi.UPowerGlib;

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
       
        this._eventSource = null;
        this._eventList = null;

        // Calendar
        this._calendar = new Calendar.Calendar(this._eventSource);       
        vbox.add(this._calendar.actor);

        item = this.menu.addSettingsAction(_("Date and Time Settings"), 'gnome-datetime-panel.desktop');
        if (item) {
            let separator = new PopupMenu.PopupSeparatorMenuItem();
            separator.setColumnWidths(1);
            vbox.add(separator.actor, {y_align: St.Align.END, expand: true, y_fill: false});

            item.actor.can_focus = false;
            item.actor.reparent(vbox);
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
        this._calendarSettings = new Gio.Settings({ schema: 'org.cinnamon.calendar' });
        this._calendarSettings.connect('changed', Lang.bind(this, this._updateClockAndDate));

        // https://bugzilla.gnome.org/show_bug.cgi?id=655129
        this._upClient = new UPowerGlib.Client();
        this._upClient.connect('notify-resume', Lang.bind(this, this._updateClockAndDate));

        // Start the clock
        this._updateClockAndDate();
    },

    _updateClockAndDate: function() {
        let dateFormat = this._calendarSettings.get_string('date-format');       
        let dateFormatFull = this._calendarSettings.get_string('date-format-full'); 
        let displayDate = new Date();
        this._clock.set_text(displayDate.toLocaleFormat(dateFormat));
        this._date.set_text(displayDate.toLocaleFormat(dateFormatFull));

        Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateClockAndDate));
        return false;
    },

};
