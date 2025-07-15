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
const ModalDialog = imports.ui.modalDialog;

const DAY_FORMAT = CinnamonDesktop.WallClock.lctime_format("cinnamon", "%A");
const DATE_FORMAT_SHORT = CinnamonDesktop.WallClock.lctime_format("cinnamon", _("%B %-e, %Y"));
const DATE_FORMAT_FULL = CinnamonDesktop.WallClock.lctime_format("cinnamon", _("%A, %B %-e, %Y"));

// OS-specific base formats with configurable options
const OS_BASE_FORMATS = {
    "linuxmint": {
        "panel": "%a %b %d %H:%M",
        "tooltip": "%A, %B %d, %Y",
        "date_format": "%d/%m/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "windows10": {
        "panel": "%H:%M%n%a %b %d",
        "tooltip": "%A, %B %d, %Y",
        "date_format": "%m/%d/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "windows11": {
        "panel": "%H:%M%n%a, %b %d",
        "tooltip": "%A, %B %d, %Y",
        "date_format": "%m/%d/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "windows7": {
        "panel": "%H:%M%n%m/%d/%Y",
        "tooltip": "%A, %B %d, %Y",
        "date_format": "%m/%d/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "ubuntu": {
        "panel": "%a %d %b %Y %H:%M",
        "tooltip": "%A, %B %d, %Y",
        "date_format": "%d/%m/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "gnome": {
        "panel": "%a %d %b %H:%M",
        "tooltip": "%A, %B %d, %Y",
        "date_format": "%d/%m/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "kde": {
        "panel": "%a %d %b %Y %H:%M",
        "tooltip": "%A, %B %d, %Y",
        "date_format": "%d.%m.%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "macos": {
        "panel": "%a %b %d %H:%M",
        "tooltip": "%A, %B %d, %Y",
        "date_format": "%m/%d/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    }
};

// Generate dynamic format based on OS type and user preferences
function generateFormat(osType, use24h, showSeconds, dateSeparator) {
    if (!OS_BASE_FORMATS[osType]) {
        osType = "linuxmint"; // fallback
    }
    
    let baseFormat = OS_BASE_FORMATS[osType];
    let timeFormat = use24h ? baseFormat.time_format_24h : baseFormat.time_format_12h;
    
    // Add seconds if requested
    if (showSeconds) {
        if (use24h) {
            timeFormat = timeFormat.replace("%H:%M", "%H:%M:%S");
        } else {
            timeFormat = timeFormat.replace("%I:%M", "%I:%M:%S");
        }
    }
    
    // Replace date separator in all formats
    let dateFormat = baseFormat.date_format;
    let panelFormat = baseFormat.panel;
    let tooltipFormat = baseFormat.tooltip;
    
    if (dateSeparator !== "/") {
        dateFormat = dateFormat.replace(/\//g, dateSeparator);
        panelFormat = panelFormat.replace(/\//g, dateSeparator);
        tooltipFormat = tooltipFormat.replace(/\//g, dateSeparator);
    }
    
    // Apply time format to panel format
    panelFormat = panelFormat.replace(/%H:%M/g, timeFormat);
    panelFormat = panelFormat.replace(/%I:%M %p/g, timeFormat);
    
    return {
        panel: panelFormat,
        tooltip: tooltipFormat,
        date: dateFormat,
        time: timeFormat
    };
}





// Tymczasowe logowanie do debugowania
function debugLog(message) {
    try {
        let timestamp = new Date().toISOString();
        let logMessage = timestamp + " [CALENDAR DEBUG] " + message + "\n";
        global.log(logMessage); // Najpierw spróbujmy z global.log
        
        // Spróbuj też zapisać do pliku
        let file = Gio.File.new_for_path("/tmp/calendar-debug.log");
        let stream = file.append_to(Gio.FileCreateFlags.NONE, null);
        stream.write(logMessage, null);
        stream.close(null);
    } catch (e) {
        global.log("Debug log error: " + e.message);
        global.log("Original message was: " + message);
    }
}

class CinnamonCalendarApplet extends Applet.TextApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        
        debugLog("Calendar applet constructor started");
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        try {
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.orientation = orientation;

            this._initContextMenu();
            this.menu.setCustomStyleClass('calendar-background');

            this.settings = new Settings.AppletSettings(this, "calendar@cinnamon.org", this.instance_id);
            debugLog("Settings created successfully");
            this.desktop_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.interface" });
            debugLog("Desktop settings created successfully");
            
            // GSettings for synchronization with system settings
            this.gsettings = new Gio.Settings({ schema_id: "org.cinnamon.applets.calendar" });
            debugLog("GSettings created successfully");
            
            // Initialize sync flag
            this._syncing_settings = false;
            
            // Synchronize GSettings with applet settings on startup
            this._syncSettingsFromGSettings();
            
            // Listen for changes in GSettings (from system settings)
            this.gsettings.connect("changed", Lang.bind(this, this._onGSettingsChanged));

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
                    style_class: 'calendar-box',
                    vertical: true
                }
            );

            this._buildHeader(calbox);

            this._calendar = new Calendar.Calendar(this.settings, this.events_manager);
            this._calendar.connect("selected-date-changed", Lang.bind(this, this._updateClockAndDate));
            calbox.add_actor(this._calendar.actor);

            box.add_actor(calbox);



            this.settings.bind("show-events", "show_events", this._onSettingsChanged);
            this.settings.bind("use-custom-format", "use_custom_format", this._onSettingsChanged);
            this.settings.bind("os-format-type", "os_format_type", this._onSettingsChanged);
            this.settings.bind("use-24h-format", "use_24h_format", this._onSettingsChanged);
            this.settings.bind("show-seconds", "show_seconds", this._onSettingsChanged);
            this.settings.bind("date-separator", "date_separator", this._onSettingsChanged);
            this.settings.bind("custom-format", "custom_format", this._onSettingsChanged);
            this.settings.bind("custom-tooltip-format", "custom_tooltip_format", this._onSettingsChanged);
            this.settings.bind("applet-format", "applet_format", this._onSettingsChanged);
            this.settings.bind("tooltip-format", "tooltip_format", this._onSettingsChanged);
            this.settings.bind("screensaver-format", "screensaver_format", this._onSettingsChanged);
            this.settings.bind("show-week-numbers", "show_week_numbers", this._onSettingsChanged);
        this.settings.bind("show-weekday-headers", "show_weekday_headers", this._onSettingsChanged);
            this.settings.bind("format-help-visible", "format_help_visible");
            this.settings.bind("key-open", "key_open", this._setKeybinding);
            debugLog("key_open value after binding: " + JSON.stringify(this.key_open) + " (type: " + typeof this.key_open + ")");
            this._setKeybinding();

            /* FIXME: Add gobject properties to the WallClock class to allow easier access from
             * its clients, and possibly a separate signal to notify of updates to these properties
             * (though GObject "changed" would be sufficient.) */
            this.desktop_settings.connect("changed::clock-use-24h", Lang.bind(this, function (key) {
                this._onSettingsChanged();
            }));
            this.desktop_settings.connect("changed::clock-show-seconds", Lang.bind(this, function (key) {
                this._onSettingsChanged();
            }));

            // https://bugzilla.gnome.org/show_bug.cgi?id=655129
            this._upClient = new UPowerGlib.Client();
            try {
                this._upClient.connect('notify-resume', Lang.bind(this, this._updateClockAndDate));
            } catch (e) {
                this._upClient.connect('notify::resume', Lang.bind(this, this._updateClockAndDate));
            }

            debugLog("Constructor completed successfully");
        }
        catch (e) {
            debugLog("Constructor error: " + e.message);
            global.logError(e);
        }
    }

    _setKeybinding() {
        debugLog("_setKeybinding called with key_open: " + JSON.stringify(this.key_open) + " (type: " + typeof this.key_open + ")");
        Main.keybindingManager.addHotKey("calendar-open-" + this.instance_id, this.key_open, Lang.bind(this, this._openMenu));
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
        
        // Synchronize applet settings to GSettings (only if not already syncing)
        if (!this._syncing_settings) {
            this._syncSettingsToGSettings();
        }
    }
    
    _syncSettingsFromGSettings() {
        try {
            // Sync from GSettings to applet settings
            this.settings.setValue("os-format-type", this.gsettings.get_string("os-format-type"));
            this.settings.setValue("use-24h-format", this.gsettings.get_boolean("use-24h-format"));
            this.settings.setValue("show-seconds", this.gsettings.get_boolean("show-seconds"));
            this.settings.setValue("date-separator", this.gsettings.get_string("date-separator"));
            this.settings.setValue("use-custom-format", this.gsettings.get_boolean("use-custom-format"));
            this.settings.setValue("custom-format", this.gsettings.get_string("custom-format"));
            this.settings.setValue("custom-tooltip-format", this.gsettings.get_string("custom-tooltip-format"));
            this.settings.setValue("applet-format", this.gsettings.get_string("applet-format"));
            this.settings.setValue("tooltip-format", this.gsettings.get_string("tooltip-format"));
            this.settings.setValue("screensaver-format", this.gsettings.get_string("screensaver-format"));
            this.settings.setValue("show-events", this.gsettings.get_boolean("show-events"));
            this.settings.setValue("show-week-numbers", this.gsettings.get_boolean("show-week-numbers"));
        this.settings.setValue("show-weekday-headers", this.gsettings.get_boolean("show-weekday-headers"));
            // Convert GSettings string back to keybinding format
            let keyValue = this.gsettings.get_string("key-open");
            this.settings.setValue("key-open", keyValue);
            debugLog("Settings synchronized from GSettings");
        } catch (e) {
            debugLog("Error syncing from GSettings: " + e.message);
        }
    }
    
    _syncSettingsToGSettings() {
        try {
            // Sync from applet settings to GSettings
            if (this.os_format_type !== undefined) {
                this.gsettings.set_string("os-format-type", this.os_format_type);
            }
            if (this.use_24h_format !== undefined) {
                this.gsettings.set_boolean("use-24h-format", this.use_24h_format);
            }
            if (this.show_seconds !== undefined) {
                this.gsettings.set_boolean("show-seconds", this.show_seconds);
            }
            if (this.date_separator !== undefined) {
                this.gsettings.set_string("date-separator", this.date_separator);
            }
            if (this.use_custom_format !== undefined) {
                this.gsettings.set_boolean("use-custom-format", this.use_custom_format);
            }
            if (this.custom_format !== undefined) {
                this.gsettings.set_string("custom-format", this.custom_format);
            }
            if (this.custom_tooltip_format !== undefined) {
                this.gsettings.set_string("custom-tooltip-format", this.custom_tooltip_format);
            }
            if (this.applet_format !== undefined) {
                this.gsettings.set_string("applet-format", this.applet_format);
            }
            if (this.tooltip_format !== undefined) {
                this.gsettings.set_string("tooltip-format", this.tooltip_format);
            }
            if (this.screensaver_format !== undefined) {
                this.gsettings.set_string("screensaver-format", this.screensaver_format);
            }
            if (this.show_events !== undefined) {
                this.gsettings.set_boolean("show-events", this.show_events);
            }
            if (this.show_week_numbers !== undefined) {
                this.gsettings.set_boolean("show-week-numbers", this.show_week_numbers);
        this.gsettings.set_boolean("show-weekday-headers", this.show_weekday_headers);
            }
            if (this.key_open !== undefined) {
                // Convert keybinding array to string for GSettings
                let keyString = Array.isArray(this.key_open) ? this.key_open.join("::") : this.key_open;
                this.gsettings.set_string("key-open", keyString);
            }
            debugLog("Settings synchronized to GSettings");
        } catch (e) {
            debugLog("Error syncing to GSettings: " + e.message);
        }
    }
    
    _onGSettingsChanged(settings, key) {
        try {
            debugLog("GSettings changed: " + key);
            // Prevent infinite loop by temporarily setting sync flag
            this._syncing_settings = true;
            
            switch (key) {
                case "os-format-type":
                    this.settings.setValue("os-format-type", settings.get_string(key));
                    break;
                case "use-24h-format":
                    this.settings.setValue("use-24h-format", settings.get_boolean(key));
                    break;
                case "show-seconds":
                    this.settings.setValue("show-seconds", settings.get_boolean(key));
                    break;
                case "date-separator":
                    this.settings.setValue("date-separator", settings.get_string(key));
                    break;
                case "use-custom-format":
                    this.settings.setValue("use-custom-format", settings.get_boolean(key));
                    break;
                case "custom-format":
                    this.settings.setValue("custom-format", settings.get_string(key));
                    break;
                case "custom-tooltip-format":
                    this.settings.setValue("custom-tooltip-format", settings.get_string(key));
                    break;
                case "applet-format":
                    this.settings.setValue("applet-format", settings.get_string(key));
                    break;
                case "tooltip-format":
                    this.settings.setValue("tooltip-format", settings.get_string(key));
                    break;
                case "screensaver-format":
                    this.settings.setValue("screensaver-format", settings.get_string(key));
                    break;
                case "show-events":
                    this.settings.setValue("show-events", settings.get_boolean(key));
                    break;
                            case "show-week-numbers":
                this.settings.setValue("show-week-numbers", settings.get_boolean(key));
                break;
            case "show-weekday-headers":
                this.settings.setValue("show-weekday-headers", settings.get_boolean(key));
                break;
                case "key-open":
                    let keyValue = settings.get_string(key);
                    this.settings.setValue("key-open", keyValue);
                    break;
            }
            
            this._syncing_settings = false;
            this._onSettingsChanged();
        } catch (e) {
            debugLog("Error handling GSettings change: " + e.message);
            this._syncing_settings = false;
        }
    }

    configureApplet() {
        debugLog("configureApplet called - attempting to open settings");
        try {
            // Wywołaj oryginalną metodę
            Applet.TextApplet.prototype.configureApplet.call(this);
            debugLog("configureApplet parent method called successfully");
        } catch (e) {
            debugLog("configureApplet error: " + e.message);
            global.logError("Calendar configureApplet error: " + e);
        }
    }



    _updateFormatString() {
        let in_vertical_panel = (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);

        if (this.use_custom_format) {
            // Używamy własnego formatu dla appletu
            let format = this.applet_format || this.custom_format;
            
            if (!this.clock.set_format_string(format)) {
                global.logError("Calendar applet: bad time format string - check your string.");
                this.clock.set_format_string("~CLOCK FORMAT ERROR~ %l:%M %p");
            }
        } else {
            // Generate format based on OS type and user preferences
            let formats = generateFormat(
                this.os_format_type || "linuxmint",
                this.use_24h_format !== undefined ? this.use_24h_format : true,
                this.show_seconds !== undefined ? this.show_seconds : false,
                this.date_separator || "/"
            );
            
            let format;
            if (in_vertical_panel) {
                // For vertical panels, use simplified format
                format = formats.time;
                if (this.show_seconds) {
                    format = format.replace("%H:%M", "%H%n%M%n%S").replace("%I:%M", "%I%n%M%n%S");
                } else {
                    format = format.replace("%H:%M", "%H%n%M").replace("%I:%M", "%I%n%M");
                }
            } else {
                format = formats.panel;
            }
            
            debugLog("Using format: " + format + " for OS: " + this.os_format_type);
            
            if (!this.clock.set_format_string(format)) {
                global.logError("Calendar applet: bad time format string - check your string: " + format);
                this.clock.set_format_string("~CLOCK FORMAT ERROR~ %l:%M %p");
            }
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

        let dateFormattedTooltip;
        if (this.use_custom_format) {
            // Używamy osobnego formatu dla tooltipa
            let tooltipFormat = this.tooltip_format || this.custom_tooltip_format;
            dateFormattedTooltip = this.clock.get_clock_for_format(tooltipFormat).capitalize();
            if (!dateFormattedTooltip) {
                global.logError("Calendar applet: bad tooltip time format string - check your string.");
                dateFormattedTooltip = this.clock.get_clock_for_format("~CLOCK FORMAT ERROR~ %l:%M %p");
            }
        } else {
            // Generate tooltip format based on OS type and user preferences
            let formats = generateFormat(
                this.os_format_type || "linuxmint",
                this.use_24h_format !== undefined ? this.use_24h_format : true,
                this.show_seconds !== undefined ? this.show_seconds : false,
                this.date_separator || "/"
            );
            dateFormattedTooltip = this.clock.get_clock_for_format(formats.tooltip).capitalize();
        }

        let dateFormattedShort = this.clock.get_clock_for_format(DATE_FORMAT_SHORT).capitalize();
        let dayFormatted = this.clock.get_clock_for_format(DAY_FORMAT).capitalize();

        this._day.set_text(dayFormatted);
        this._date.set_text(dateFormattedShort);
        this.set_applet_tooltip(dateFormattedTooltip);

        this.events_manager.select_date(this._calendar.getSelectedDate());
    }

    on_applet_added_to_panel() {
        debugLog("on_applet_added_to_panel called");
        this._onSettingsChanged();

        if (this.clock_notify_id == 0) {
            this.clock_notify_id = this.clock.connect("notify::clock", () => this._clockNotify());
        }

        /* Populates the calendar so our menu allocation is correct for animation */
        this.events_manager.start_events();
        this._resetCalendar();
        debugLog("on_applet_added_to_panel completed");
    }

    on_applet_removed_from_panel() {
        Main.keybindingManager.removeHotKey("calendar-open-" + this.instance_id);
        if (this.clock_notify_id > 0) {
            this.clock.disconnect(this.clock_notify_id);
            this.clock_notify_id = 0;
        }
    }

    _initContextMenu() {
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);

        // Whenever the menu is opened, select today
        this.menu.connect('open-state-changed', Lang.bind(this, function (menu, isOpen) {
            if (isOpen) {
                this._resetCalendar();
                this.events_manager.select_date(this._calendar.getSelectedDate(), true);
            }
        }));
    }

    _resetCalendar() {
        this._calendar.setDate(new Date(), true);
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;
        this.menu.setOrientation(orientation);
        this._onSettingsChanged();
    }

    _buildHeader(calbox) {
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
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    debugLog("=== MAIN FUNCTION CALLED ===");
    debugLog("metadata: " + JSON.stringify(metadata));
    debugLog("orientation: " + orientation + ", panel_height: " + panel_height + ", instance_id: " + instance_id);
    
    let applet = new CinnamonCalendarApplet(orientation, panel_height, instance_id);
    debugLog("Applet created, setting _meta");
    applet._meta = metadata;
    debugLog("_meta set: " + JSON.stringify(applet._meta));
    
    return applet;
}
