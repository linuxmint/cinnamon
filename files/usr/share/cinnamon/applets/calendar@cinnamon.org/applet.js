const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const UPowerGlib = imports.gi.UPowerGlib;
const Settings = imports.ui.settings;
const Calendar = imports.applet.calendar;
const CinnamonDesktop = imports.gi.CinnamonDesktop;

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

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

    cr.$dispose();
};

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {        
        Applet.TextApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        try {    

            this.clock = new CinnamonDesktop.WallClock();

            this.settings = new Settings.AppletSettings(this, "calendar@cinnamon.org", this.instance_id);

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            
            this.orientation = orientation;
            
            this._initContextMenu();
                                     
            this._calendarArea = new St.BoxLayout({name: 'calendarArea' });
            this.menu.addActor(this._calendarArea);

            // Fill up the first column

            let vbox = new St.BoxLayout({vertical: true});
            this._calendarArea.add(vbox);

            // Date
            this._date = new St.Label();
            this._date.style_class = 'datemenu-date-label';
            vbox.add(this._date);
           
            this._eventList = null;

            // Calendar
            this._calendar = new Calendar.Calendar(this.settings);
            vbox.add(this._calendar.actor);

            let item = new PopupMenu.PopupMenuItem(_("Date and Time Settings"))
            item.connect("activate", Lang.bind(this, this._onLaunchSettings));
            //this.menu.addMenuItem(item);
            if (item) {
                let separator = new PopupMenu.PopupSeparatorMenuItem();
                separator.setColumnWidths(1);
                vbox.add(separator.actor, {y_align: St.Align.END, expand: true, y_fill: false});

                item.actor.can_focus = false;
                global.reparentActor(item.actor, vbox);
            }

            // Track changes to clock settings
            this._dateFormatFull = _("%A %B %e, %Y");

            this.settings.bindProperty(Settings.BindingDirection.IN, "use-custom-format", "use_custom_format", this.on_settings_changed, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "custom-format", "custom_format", this.on_settings_changed, null);        

            // Track changes to date&time settings
            this.datetime_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.interface" });
            this.datetime_settings.connect('changed::clock-show-seconds', Lang.bind(this, this.on_settings_changed));
            this.datetime_settings.connect('changed::clock-use-24h', Lang.bind(this, this.on_settings_changed));
            this.datetime_settings.connect('changed::clock-show-date', Lang.bind(this, this.on_settings_changed));

            // https://bugzilla.gnome.org/show_bug.cgi?id=655129
            this._upClient = new UPowerGlib.Client();
            try {
                this._upClient.connect('notify-resume', Lang.bind(this, this._updateClockAndDate));
            } catch (e) {
                this._upClient.connect('notify::resume', Lang.bind(this, this._updateClockAndDate));
            }

            // Start the clock
            this.on_settings_changed();
            this._updateClockAndDatePeriodic();
     
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    on_settings_changed: function() {        
        if (this._periodicTimeoutId){
            Mainloop.source_remove(this._periodicTimeoutId);
        }
        this._updateClockAndDatePeriodic();
    },

    on_custom_format_button_pressed: function() {
        Util.spawnCommandLine("xdg-open http://www.foragoodstrftime.com/");
    },
    
    _onLaunchSettings: function() {
        this.menu.close();
        Util.spawnCommandLine("cinnamon-settings calendar");
    },

    _updateClockAndDate: function() {
        let now = new Date();        
        let nextUpdate = 60 - now.getSeconds() + 1;
        let in_vertical_panel = (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);
        let label_string;

        // Applet label
        if (this.use_custom_format || in_vertical_panel) {
            if (in_vertical_panel)
                label_string = now.toLocaleFormat("%H%n%M"); // this is all that will fit in a vertical panel with a typical default font
            else
                label_string = now.toLocaleFormat(this.custom_format);

            if (!label_string) {
                global.logError("Calendar applet: bad time format string - check your string.");
                label_string = "~CLOCK FORMAT ERROR~ " + now.toLocaleFormat("%l:%M %p");
            }          
            this.set_applet_label(label_string);   
            if(this.custom_format.search("%S") > 0 || this.custom_format.search("%c") > 0 || this.custom_format.search("%T") > 0 || this.custom_format.search("%X") > 0) {
                nextUpdate = 1;
            }
        }
        else {
            if (this.clock) { // We lose cinnamon-desktop temporarily during suspend
                let label_string = this.clock.get_clock().capitalize();
                this.set_applet_label(label_string);

                if(this.datetime_settings.get_boolean("clock-show-seconds")) {
                    nextUpdate = 1;
                }
            }
        }

        // Applet content
        let dateFormattedFull = now.toLocaleFormat(this._dateFormatFull).capitalize();
        if (dateFormattedFull !== this._lastDateFormattedFull) {
            this._date.set_text(dateFormattedFull);
            this.set_applet_tooltip(dateFormattedFull);
            this._lastDateFormattedFull = dateFormattedFull;
        }

        return nextUpdate;
    },

    _updateClockAndDatePeriodic: function() {
        let nextUpdate = this._updateClockAndDate();
        this._periodicTimeoutId = Mainloop.timeout_add_seconds(nextUpdate, Lang.bind(this, this._updateClockAndDatePeriodic));
    },
    
    on_applet_removed_from_panel: function() {
        if (this._periodicTimeoutId){
            Mainloop.source_remove(this._periodicTimeoutId);
        }
    },

    _initContextMenu: function () {
        if (this._calendarArea) this._calendarArea.unparent();
        if (this.menu) this.menuManager.removeMenu(this.menu);
        
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);
        
        if (this._calendarArea){
            this.menu.addActor(this._calendarArea);
            this._calendarArea.show_all();
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
    },
//
//override getDisplayLayout to declare that this applet is suitable for both horizontal and
// vertical orientations
//
    getDisplayLayout: function() {
        return Applet.DisplayLayout.BOTH;
    },

    on_orientation_changed: function (orientation) {
        this.orientation = orientation;
        this._initContextMenu();
        this.on_settings_changed();
    }

};

function main(metadata, orientation, panel_height, instance_id) {  
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;      
}
