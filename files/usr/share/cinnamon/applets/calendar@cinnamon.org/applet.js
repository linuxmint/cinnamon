const {TextApplet, AppletPopupMenu, AllowedLayout} = imports.ui.applet;
const {Settings} = imports.gi.Gio;
const {Label, Side} = imports.gi.St;
const {spawnCommandLine} = imports.misc.util;
const {PopupMenuManager, PopupSeparatorMenuItem, PopupMenuItem} = imports.ui.popupMenu;
const {Client} = imports.gi.UPowerGlib;
const {AppletSettings} = imports.ui.settings;
const {Calendar} = require('./calendar');
const {WallClock} = imports.gi.CinnamonDesktop;

String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
}

class CinnamonCalendarApplet extends TextApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(AllowedLayout.BOTH);

        this.menuManager = new PopupMenuManager(this);
        this.orientation = orientation;

        this._initContextMenu();
        this.menu.setCustomStyleClass('calendar-background');

        // Date
        this._date = new Label();
        this._date.style_class = 'datemenu-date-label';
        this.menu.addActor(this._date);

        this.state = {};

        this.settings = new AppletSettings(this.state, "calendar@cinnamon.org", this.instance_id, true);
        this.settings.promise.then(() => {
            // Calendar
            this._calendar = new Calendar(this.settings);

            this.menu.addActor(this._calendar.actor);
            this.menu.addMenuItem(new PopupSeparatorMenuItem());

            let item = new PopupMenuItem(_("Date and Time Settings"))
            item.connect("activate", () => this._onLaunchSettings());

            this.menu.addMenuItem(item);

            this._dateFormatFull = _("%A %B %-e, %Y");

            this.settings.bind("use-custom-format", "use_custom_format", this._onSettingsChanged);
            this.settings.bind("custom-format", "custom_format", this._onSettingsChanged);

            /* FIXME: Add gobject properties to the WallClock class to allow easier access from
             * its clients, and possibly a separate signal to notify of updates to these properties
             * (though GObject "changed" would be sufficient.) */
            this.desktop_settings = new Settings({ schema_id: "org.cinnamon.desktop.interface" });
            this.desktop_settings.connect("changed::clock-use-24h", () => this._onSettingsChanged());
            this.desktop_settings.connect("changed::clock-show-seconds", () => this._onSettingsChanged());

            this.clock = new WallClock();
            this.clock_notify_id = 0;

            // https://bugzilla.gnome.org/show_bug.cgi?id=655129
            this._upClient = new Client();
            try {
                this._upClient.connect('notify-resume', () => this._updateClockAndDate());
            } catch (e) {
                this._upClient.connect('notify::resume', () => this._updateClockAndDate());
            }

            this._onSettingsChanged();

            if (this.clock_notify_id == 0) {
                this.clock_notify_id = this.clock.connect("notify::clock", () => this._clockNotify());
            }

            /* Populates the calendar so our menu allocation is correct for animation */
            this._updateCalendar();
        });
    }

    _clockNotify(obj, pspec, data) {
        this._updateClockAndDate();
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _onSettingsChanged() {
        this._updateFormatString();
        this._updateClockAndDate();
    }

    on_custom_format_button_pressed() {
        spawnCommandLine("xdg-open http://www.foragoodstrftime.com/");
    }

    _onLaunchSettings() {
        this.menu.close();
        spawnCommandLine("cinnamon-settings calendar");
    }

    _updateFormatString() {
        let in_vertical_panel = (this.orientation === Side.LEFT || this.orientation === Side.RIGHT);

        if (this.state.use_custom_format) {
            if (!this.clock.set_format_string(this.state.custom_format)) {
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

    _updateClockAndDate() {
        let label_string = this.clock.get_clock();

        if (!this.state.use_custom_format) {
            label_string = label_string.capitalize();
        }

        this.set_applet_label(label_string);

        /* Applet content - st_label_set_text and set_applet_tooltip both compare new to
         * existing strings before proceeding, so no need to check here also */
        let dateFormattedFull = this.clock.get_clock_for_format(this._dateFormatFull).capitalize();

        this._date.set_text(dateFormattedFull);
        this.set_applet_tooltip(dateFormattedFull);
    }

    on_applet_removed_from_panel() {
        if (this.clock_notify_id > 0) {
            this.clock.disconnect(this.clock_notify_id);
            this.clock_notify_id = 0;
        }
    }

    _initContextMenu () {
        this.menu = new AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);

        // Whenever the menu is opened, select today
        this.menu.connect('open-state-changed', (menu, isOpen) => {
            if (isOpen) {
                this._updateCalendar();
            }
        });
    }

    _updateCalendar () {
        let now = new Date();

        this._calendar.setDate(now, true);
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
