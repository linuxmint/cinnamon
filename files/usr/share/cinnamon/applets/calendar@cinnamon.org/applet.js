const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Util = imports.misc.util;
const PopupMenu = imports.ui.popupMenu;
const UPowerGlib = imports.gi.UPowerGlib;
const Settings = imports.ui.settings;
const Calendar = require('./calendar');
const EventView = require('./eventView');
const CinnamonDesktop = imports.gi.CinnamonDesktop;
const Main = imports.ui.main;
const Separator = imports.ui.separator;

const DAY_FORMAT = CinnamonDesktop.WallClock.lctime_format("cinnamon", "%A");
const DATE_FORMAT_SHORT = CinnamonDesktop.WallClock.lctime_format("cinnamon", _("%B %-e, %Y"));
const DATE_FORMAT_FULL = CinnamonDesktop.WallClock.lctime_format("cinnamon", _("%A, %B %-e, %Y"));

class CinnamonCalendarApplet extends Applet.TextApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        try {
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.orientation = orientation;

            this._initContextMenu();
            this.menu.setCustomStyleClass('calendar-background');

            this.settings = new Settings.AppletSettings(this, "calendar@cinnamon.org", this.instance_id);
            this.desktop_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.interface" });

            this.clock = new CinnamonDesktop.WallClock();
            this.clock_notify_id = 0;

            // Events
            this.events_manager = new EventView.EventsManager(this.settings, this.desktop_settings);
            this.events_manager.connect("events-manager-ready", this._events_manager_ready.bind(this));
            this.events_manager.connect("has-calendars-changed", this._has_calendars_changed.bind(this));

            let box = new St.BoxLayout(
                {
                    style_class: 'calendar-main-box',
                    vertical: false
                }
            );
            this.menu.addActor(box);

            this.event_list = this.events_manager.get_event_list();
            this.event_list.connect("launched-calendar", Lang.bind(this.menu, this.menu.toggle));

            // hack to allow event list scrollbar to be dragged.
            this.event_list.connect("start-pass-events", Lang.bind(this.menu, () => {
                this.menu.passEvents = true;
            }));
            this.event_list.connect("stop-pass-events", Lang.bind(this.menu, () => {
                this.menu.passEvents = false;
            }));

            box.add_actor(this.event_list.actor);

            let calbox = new St.BoxLayout(
                {
                    vertical: true
                }
            );

            this.go_home_button = new St.BoxLayout(
                {
                    style_class: "calendar-today-home-button",
                    x_align: Clutter.ActorAlign.CENTER,
                    reactive: true,
                    vertical: true
                }
            );

            this.go_home_button.connect("enter-event", Lang.bind(this, (actor, event) => {
                actor.add_style_pseudo_class("hover");
            }));

            this.go_home_button.connect("leave-event", Lang.bind(this, (actor, event) => {
                actor.remove_style_pseudo_class("hover");
            }));

            this.go_home_button.connect("button-press-event", Lang.bind(this, (actor, event) => {
                if (event.get_button() == Clutter.BUTTON_PRIMARY) {
                    return Clutter.EVENT_STOP;
                }
            }));

            this.go_home_button.connect("button-release-event", Lang.bind(this, (actor, event) => {
                if (event.get_button() == Clutter.BUTTON_PRIMARY) {
                    // button immediately becomes non-reactive, so leave-event will never fire.
                    actor.remove_style_pseudo_class("hover");
                    this._resetCalendar();
                    return Clutter.EVENT_STOP;
                }
            }));

            calbox.add_actor(this.go_home_button);

            // Calendar
            this._day = new St.Label(
                {
                    style_class: "calendar-today-day-label"
                }
            );
            this.go_home_button.add_actor(this._day);

            // Date
            this._date = new St.Label(
                {
                    style_class: "calendar-today-date-label"
                }
            );
            this.go_home_button.add_actor(this._date);

            this._calendar = new Calendar.Calendar(this.settings, this.events_manager);
            this._calendar.connect("selected-date-changed", Lang.bind(this, this._updateClockAndDate));
            calbox.add_actor(this._calendar.actor);

            box.add_actor(calbox);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let item = new PopupMenu.PopupMenuItem(_("Date and Time Settings"));
            item.connect("activate", Lang.bind(this, this._onLaunchSettings));

            this.menu.addMenuItem(item);

            this.settings.bind("show-events", "show_events", this._onSettingsChanged);
            this.settings.bind("use-custom-format", "use_custom_format", this._onSettingsChanged);
            this.settings.bind("custom-format", "custom_format", this._onSettingsChanged);
            this.settings.bind("keyOpen", "keyOpen", this._setKeybinding);
            this._setKeybinding();

            /* FIXME: Add gobject properties to the WallClock class to allow easier access from
             * its clients, and possibly a separate signal to notify of updates to these properties
             * (though GObject "changed" would be sufficient.) */
            this.desktop_settings.connect("changed::clock-use-24h", Lang.bind(this, function(key) {
                this._onSettingsChanged();
            }));
            this.desktop_settings.connect("changed::clock-show-seconds", Lang.bind(this, function(key) {
                this._onSettingsChanged();
            }));

            // https://bugzilla.gnome.org/show_bug.cgi?id=655129
            this._upClient = new UPowerGlib.Client();
            try {
                this._upClient.connect('notify-resume', Lang.bind(this, this._updateClockAndDate));
            } catch (e) {
                this._upClient.connect('notify::resume', Lang.bind(this, this._updateClockAndDate));
            }
        }
        catch (e) {
            global.logError(e);
        }
    }
    
    _setKeybinding() {
        Main.keybindingManager.addHotKey("calendar-open-" + this.instance_id, this.keyOpen, Lang.bind(this, this._openMenu));
    }

    _clockNotify(obj, pspec, data) {
        this._updateClockAndDate();
    }

    on_applet_clicked(event) {
        this._openMenu();
    }
    
    _openMenu() {
        this.menu.toggle();
    }

    _onSettingsChanged() {
        this._updateFormatString();
        this._updateClockAndDate();
        this.event_list.actor.visible = this.events_manager.is_active();
        this.events_manager.select_date(this._calendar.getSelectedDate(), true);
    }

    on_custom_format_button_pressed() {
        Util.spawnCommandLine("xdg-open http://www.foragoodstrftime.com/");
    }

    _onLaunchSettings() {
        this.menu.close();
        Util.spawnCommandLine("cinnamon-settings calendar");
    }

    _updateFormatString() {
        let in_vertical_panel = (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);

        if (this.use_custom_format) {
            if (!this.clock.set_format_string(this.custom_format)) {
                global.logError("Calendar applet: bad time format string - check your string.");
                this.clock.set_format_string("~CLOCK FORMAT ERROR~ %l:%M %p");
            }
        } else if (in_vertical_panel) {
            let use_24h = this.desktop_settings.get_boolean("clock-use-24h");
            let show_seconds = this.desktop_settings.get_boolean("clock-show-seconds");

            if (use_24h) {
                if (show_seconds) {
                    this.clock.set_format_string("%H%n%M%n%S");
                } else {
                    this.clock.set_format_string("%H%n%M%");
                }
            } else {
                if (show_seconds) {
                    this.clock.set_format_string("%l%n%M%n%S");
                } else {
                    this.clock.set_format_string("%l%n%M%");
                }
            }
        } else {
            this.clock.set_format_string(null);
        }
    }

    _events_manager_ready(em) {
        this.event_list.actor.visible = this.events_manager.is_active();
        this.events_manager.select_date(this._calendar.getSelectedDate(), true);
    }

    _has_calendars_changed(em) {
        this.event_list.actor.visible = this.events_manager.is_active();
    }

    _updateClockAndDate() {
        let label_string = this.clock.get_clock();

        if (!this.use_custom_format) {
            label_string = label_string.capitalize();
        }

        this.go_home_button.reactive = !this._calendar.todaySelected();
        if (this._calendar.todaySelected()) {
            this.go_home_button.reactive = false;
            this.go_home_button.set_style_class_name("calendar-today-home-button");
        } else {
            this.go_home_button.reactive = true;
            this.go_home_button.set_style_class_name("calendar-today-home-button-enabled");
        }

        this.set_applet_label(label_string);

        let dateFormattedFull = this.clock.get_clock_for_format(DATE_FORMAT_FULL).capitalize();
        let dateFormattedShort = this.clock.get_clock_for_format(DATE_FORMAT_SHORT).capitalize();
        let dayFormatted = this.clock.get_clock_for_format(DAY_FORMAT).capitalize();

        this._day.set_text(dayFormatted);
        this._date.set_text(dateFormattedShort);
        this.set_applet_tooltip(dateFormattedFull);

        this.events_manager.select_date(this._calendar.getSelectedDate());
    }

    on_applet_added_to_panel() {
        this._onSettingsChanged();

        if (this.clock_notify_id == 0) {
            this.clock_notify_id = this.clock.connect("notify::clock", () => this._clockNotify());
        }

        /* Populates the calendar so our menu allocation is correct for animation */
        this.events_manager.start_events();
        this._resetCalendar();
    }

    on_applet_removed_from_panel() {
        Main.keybindingManager.removeHotKey("calendar-open-" + this.instance_id);
        if (this.clock_notify_id > 0) {
            this.clock.disconnect(this.clock_notify_id);
            this.clock_notify_id = 0;
        }
    }

    _initContextMenu () {
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);

        // Whenever the menu is opened, select today
        this.menu.connect('open-state-changed', Lang.bind(this, function(menu, isOpen) {
            if (isOpen) {
                this._resetCalendar();
                this.events_manager.select_date(this._calendar.getSelectedDate(), true);
            }
        }));
    }

    _resetCalendar () {
        this._calendar.setDate(new Date(), true);
    }

    on_orientation_changed (orientation) {
        this.orientation = orientation;
        this.menu.setOrientation(orientation);
        this._onSettingsChanged();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonCalendarApplet(orientation, panel_height, instance_id);
}
