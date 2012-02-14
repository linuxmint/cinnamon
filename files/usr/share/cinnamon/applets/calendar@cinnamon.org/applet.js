
const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Util = imports.misc.util;
const Main = imports.ui.main;
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

function MyMenu(launcher, orientation) {
    this._init(launcher, orientation);
}

MyMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,
    
    _init: function(launcher, orientation) {
        this._launcher = launcher;        
                
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();            
    }
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextApplet.prototype,

    _init: function(orientation) {        
        Applet.TextApplet.prototype._init.call(this, orientation);
        
        try {                 
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new MyMenu(this, orientation);
            this.menuManager.addMenu(this.menu);                         
                                                                       
            let hbox = new St.BoxLayout({name: 'calendarArea' });
            this.menu.addActor(hbox);

            // Fill up the first column

            let vbox = new St.BoxLayout({vertical: true});
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

            let item = new PopupMenu.PopupMenuItem(_("Date and Time Settings"))
            item.connect("activate", Lang.bind(this, this._onLaunchSettings));
            //this.menu.addMenuItem(item);
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
     
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();
    },
    
    _onLaunchSettings: function() {
        this.menu.close();
        Util.spawnCommandLine("cinnamon-settings calendar");
    },

    _updateClockAndDate: function() {
        let dateFormat = this._calendarSettings.get_string('date-format');       
        let dateFormatFull = this._calendarSettings.get_string('date-format-full'); 
        let displayDate = new Date();
        this.set_applet_label(displayDate.toLocaleFormat(dateFormat));
        this._date.set_text(displayDate.toLocaleFormat(dateFormatFull));

        Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateClockAndDate));
        return false;
    }
    
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
