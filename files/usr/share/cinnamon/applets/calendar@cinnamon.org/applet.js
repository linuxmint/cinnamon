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
const Mainloop = imports.mainloop;

const DAY_FORMAT = CinnamonDesktop.WallClock.lctime_format("cinnamon", "%A");
const DATE_FORMAT_SHORT = CinnamonDesktop.WallClock.lctime_format("cinnamon", _("%B %-e, %Y"));
const DATE_FORMAT_FULL = CinnamonDesktop.WallClock.lctime_format("cinnamon", _("%A, %B %-e, %Y"));

// OS-specific base formats with configurable options (bliżej realnych domyślnych układów)
const OS_BASE_FORMATS = {
    "Linux Mint": {
        // Przykład: Tue Aug 6 14:30
        "panel": "%a %b %-e %H:%M",
        "tooltip": "%A, %B %-e, %Y",
        "date_format": "%d/%m/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "Windows 10": {
        // Przykład: 14:30\n8/06/2024
        "panel": "%H:%M%n%m/%d/%Y",
        "tooltip": "%A, %B %-e, %Y",
        "date_format": "%m/%d/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "Windows 11": {
        // Przykład: 14:30\nTue, Aug 6
        "panel": "%H:%M%n%a, %b %-e",
        "tooltip": "%A, %B %-e, %Y",
        "date_format": "%m/%d/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "Windows 7": {
        // Przykład: 14:30 08/06/2024
        "panel": "%H:%M %m/%d/%Y",
        "tooltip": "%A, %B %-e, %Y",
        "date_format": "%m/%d/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "Ubuntu": {
        // Przykład: Tue 6 Aug 2024 14:30 (często rok jest widoczny w panelu)
        "panel": "%a %-d %b %Y %H:%M",
        "tooltip": "%A, %B %-e, %Y",
        "date_format": "%d/%m/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "GNOME": {
        // Przykład: Tue 6 Aug 14:30 (bez roku)
        "panel": "%a %-d %b %H:%M",
        "tooltip": "%A, %B %-e, %Y",
        "date_format": "%d/%m/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "KDE": {
        // Przykład: Tue 6 Aug 2024 14:30
        "panel": "%a %-d %b %Y %H:%M",
        "tooltip": "%A, %B %-e, %Y",
        "date_format": "%d.%m.%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    },
    "macOS": {
        // Przykład: Tue Aug 6 14:30
        "panel": "%a %b %-e %H:%M",
        "tooltip": "%A, %B %-e, %Y",
        "date_format": "%m/%d/%Y",
        "time_format_24h": "%H:%M",
        "time_format_12h": "%I:%M %p"
    }
};

// Mapowanie z pełnych opisów na krótkie klucze
const OS_NAME_MAPPING = {
    "Linux Mint Style (Mon Jan 15 14:30)": "Linux Mint",
    "macOS Style (Mon Jan 15 14:30)": "macOS",
    "Windows 10 Style (14:30 Mon Jan 15)": "Windows 10",
    "Windows 11 Style (14:30 Mon, Jan 15)": "Windows 11",
    "Ubuntu Style (Mon 15 Jan 2024 14:30)": "Ubuntu",
    "Windows 7 Style (14:30 01/15/2024)": "Windows 7",
    "GNOME Style (Mon 15 Jan 14:30)": "GNOME",
    "KDE Style (Mon 15 Jan 2024 14:30)": "KDE"
};

// Generate dynamic format based on OS type and user preferences
function generateFormat(osType, use24h, showSeconds, dateSeparator, useCustomTime, customTimeFormat) {
    debugLog("generateFormat called with osType: '" + osType + "', use24h: " + use24h + ", showSeconds: " + showSeconds + ", dateSeparator: '" + dateSeparator + "'");
    
    // Map full description to short key if needed
    if (OS_NAME_MAPPING[osType]) {
        osType = OS_NAME_MAPPING[osType];
        debugLog("Mapped full description to short key: '" + osType + "'");
    }
    
    if (!OS_BASE_FORMATS[osType]) {
        debugLog("OS type '" + osType + "' not found in OS_BASE_FORMATS, using fallback 'Linux Mint'");
        osType = "Linux Mint"; // fallback
    }
    
    let baseFormat = OS_BASE_FORMATS[osType];
    debugLog("Using base format for '" + osType + "': " + JSON.stringify(baseFormat));
    
    let timeFormat = use24h ? baseFormat.time_format_24h : baseFormat.time_format_12h;

    // If user provided a custom time format (while using presets), use it
    if (useCustomTime && customTimeFormat && customTimeFormat.length > 0) {
        timeFormat = customTimeFormat;
    }
    
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
    
    // Sanitize dateSeparator (incoming values might be labeled like "Dash (-)")
    const sanitizeSeparator = (sep) => {
        if (!sep) return "/";
        if (sep.includes("/")) return "/";
        if (sep.includes("-")) return "-";
        if (sep.includes(".")) return ".";
        if (["/", "-", "."].includes(sep)) return sep;
        return "/";
    };
    const safeSep = sanitizeSeparator(dateSeparator);

    if (safeSep !== "/") {
        dateFormat = dateFormat.replace(/\//g, safeSep);
        panelFormat = panelFormat.replace(/\//g, safeSep);
        tooltipFormat = tooltipFormat.replace(/\//g, safeSep);
    }
    
    // Apply time format to panel format (replace both 24h and 12h tokens wherever they appear)
    panelFormat = panelFormat.replace(/%H:%M(:%S)?/g, timeFormat);
    panelFormat = panelFormat.replace(/%I:%M(:%S)? %p/g, timeFormat);
    
    debugLog("Generated panel format: " + panelFormat);
    return panelFormat;
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

            // GSettings jako główne źródło ustawień
            this.gsettings = new Gio.Settings({ schema_id: "org.cinnamon.applets.calendar" });
            debugLog("GSettings created successfully");
            
            // Lokalne ustawienia tylko dla rzeczy specyficznych dla apletu
            this.settings = new Settings.AppletSettings(this, "calendar@cinnamon.org", this.instance_id);
            debugLog("Settings created successfully");

            // AppletSettings: propagate first-day-of-week override to system setting
            try {
                this.settings.bind('first-day-of-week-override', 'first_day_of_week_override', () => {
                    try {
                        if (typeof this.first_day_of_week_override !== 'undefined') {
                            let sys = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.interface' });
                            // 7 = locale default (used by Cinnamon); 0 = Sunday, 1 = Monday
                            sys.set_int('first-day-of-week', this.first_day_of_week_override);
                            debugLog('Applied first-day-of-week: ' + this.first_day_of_week_override);
                        }
                    } catch (e) {
                        debugLog('Failed applying first-day-of-week: ' + e.message);
                    }
                });
            } catch (e) {
                debugLog('Binding first-day-of-week override failed: ' + e.message);
            }
            
            this.desktop_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.interface" });
            debugLog("Desktop settings created successfully");
            
            // Initialize sync flag
            this._syncing_settings = false;
            
            // Listen for changes in GSettings (from system settings)
            this.gsettings.connect("changed", this._onGSettingsChanged.bind(this));

            this.clock = new CinnamonDesktop.WallClock();
            this.clock_notify_id = 0;

            // Events
            this.events_manager = new EventView.EventsManager(this.settings, this.desktop_settings);
            this.events_manager.connect("events-manager-ready", this._events_manager_ready.bind(this));
            this.events_manager.connect("has-calendars-changed", this._has_calendars_changed.bind(this));
            // Start EDS event fetching (required to see calendar events)
            try {
                this.events_manager.start_events();
                debugLog("Events manager started");
            } catch (e) {
                debugLog("Error starting events manager: " + e.message);
            }

            let box = new St.BoxLayout(
                {
                    style_class: 'calendar-main-box',
                    vertical: false
                }
            );
            this.menu.addActor(box);

            // Safely obtain event list from manager
            try {
                this.event_list = this.events_manager.get_event_list();
            } catch (e) {
                debugLog("Error getting event list: " + e.message);
                this.event_list = null;
            }

            if (this.event_list && this.event_list.actor) {
                this.event_list.connect("launched-calendar", this.menu.toggle.bind(this.menu));
            }

            // hack to allow event list scrollbar to be dragged.
            this.event_list.connect("start-pass-events", () => {
                this.menu.passEvents = true;
            });
            this.event_list.connect("stop-pass-events", () => {
                this.menu.passEvents = false;
            });

            if (this.event_list && this.event_list.actor) {
                box.add_actor(this.event_list.actor);
            }

            let calbox = new St.BoxLayout(
                {
                    style_class: 'calendar-box',
                    vertical: true
                }
            );

            this._buildHeader(calbox);

            this._calendar = new Calendar.Calendar(this.settings, this.events_manager);
            this._calendar.connect("selected-date-changed", this._updateClockAndDate.bind(this));
            // Ensure calendar actor is visible and reactive
            this._calendar.actor.reactive = true;
            this._calendar.actor.visible = true;
            calbox.add_actor(this._calendar.actor);

            box.add_actor(calbox);

            // Bind GSettings directly to properties (no local storage)
            this._bindGSettingsToProperties();

            /* FIXME: Add gobject properties to the WallClock class to allow easier access from
             * its clients, and possibly a separate signal to notify of updates to these properties
             * (though GObject "changed" would be sufficient.) */
            this.desktop_settings.connect("changed::clock-use-24h", () => {
                this._onSettingsChanged();
            });
            this.desktop_settings.connect("changed::clock-show-seconds", () => {
                this._onSettingsChanged();
            });

            // https://bugzilla.gnome.org/show_bug.cgi?id=655129
            this._upClient = new UPowerGlib.Client();
            try {
                this._upClient.connect('notify-resume', this._updateClockAndDate.bind(this));
            } catch (e) {
                this._upClient.connect('notify::resume', this._updateClockAndDate.bind(this));
            }

            debugLog("Constructor completed successfully");
        }
        catch (e) {
            debugLog("Constructor error: " + e.message);
            global.logError(e);
        }
    }

    _bindGSettingsToProperties() {
        // Load initial values from GSettings
        this.show_events = this.gsettings.get_boolean("show-events");
        this.show_week_numbers = this.gsettings.get_boolean("show-week-numbers");
        this.show_weekday_headers = this.gsettings.get_boolean("show-weekday-headers");
        this.use_custom_format = this.gsettings.get_boolean("use-custom-format");
        this.os_format_type = this.gsettings.get_string("os-format-type");
        this.use_24h_format = this.gsettings.get_boolean("use-24h-format");
        this.show_seconds = this.gsettings.get_boolean("show-seconds");
        this.date_separator = this.gsettings.get_string("date-separator");
        this.applet_format = this.gsettings.get_string("applet-format");
        this.tooltip_format = this.gsettings.get_string("tooltip-format");
        this.format_help_visible = this.gsettings.get_boolean("format-help-visible");
        this.tooltip_format_help_visible = this.gsettings.get_boolean("tooltip-format-help-visible");
        this.custom_format = this.gsettings.get_string("custom-format");
        this.use_custom_time_format = this.gsettings.get_boolean("use-custom-time-format");
        this.time_format = this.gsettings.get_string("time-format");
        this.screensaver_format = this.gsettings.get_string("screensaver-format");
        this.use_screensaver_custom_format = this.gsettings.get_boolean("use-screensaver-custom-format");
        this.screensaver_position = this.gsettings.get_string("screensaver-position");
        this.screensaver_format_help_visible = this.gsettings.get_boolean("screensaver-format-help-visible");
        
        // Special handling for key-open (convert string to array)
        this.key_open_string = this.gsettings.get_string("key-open");
        this._updateKeyOpenFromString();
        
        // Bind GSettings directly to properties without local storage
        this.gsettings.bind("show-events", this, "show_events", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("show-week-numbers", this, "show_week_numbers", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("show-weekday-headers", this, "show_weekday_headers", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("use-custom-format", this, "use_custom_format", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("os-format-type", this, "os_format_type", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("use-24h-format", this, "use_24h_format", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("show-seconds", this, "show_seconds", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("date-separator", this, "date_separator", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("applet-format", this, "applet_format", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("tooltip-format", this, "tooltip_format", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("format-help-visible", this, "format_help_visible", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("tooltip-format-help-visible", this, "tooltip_format_help_visible", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("custom-format", this, "custom_format", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("use-custom-time-format", this, "use_custom_time_format", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("time-format", this, "time_format", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("screensaver-format", this, "screensaver_format", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("use-screensaver-custom-format", this, "use_screensaver_custom_format", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("screensaver-position", this, "screensaver_position", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("screensaver-format-help-visible", this, "screensaver_format_help_visible", Gio.SettingsBindFlags.DEFAULT);
        this.gsettings.bind("key-open", this, "key_open_string", Gio.SettingsBindFlags.DEFAULT);
        
        // Connect property change notifications
        this.connect("notify::show-events", this._onSettingsChanged.bind(this));
        this.connect("notify::show-week-numbers", this._onSettingsChanged.bind(this));
        this.connect("notify::show-weekday-headers", this._onSettingsChanged.bind(this));
        this.connect("notify::use-custom-format", this._onSettingsChanged.bind(this));
        this.connect("notify::os-format-type", this._onSettingsChanged.bind(this));
        this.connect("notify::use-24h-format", this._onSettingsChanged.bind(this));
        this.connect("notify::show-seconds", this._onSettingsChanged.bind(this));
        this.connect("notify::date-separator", this._onSettingsChanged.bind(this));
        this.connect("notify::applet-format", this._onSettingsChanged.bind(this));
        this.connect("notify::tooltip-format", this._onSettingsChanged.bind(this));
        this.connect("notify::custom-format", this._onSettingsChanged.bind(this));
        this.connect("notify::use-custom-time-format", this._onSettingsChanged.bind(this));
        this.connect("notify::time-format", this._onSettingsChanged.bind(this));
        this.connect("notify::screensaver-format", this._onSettingsChanged.bind(this));
        this.connect("notify::use-screensaver-custom-format", this._onSettingsChanged.bind(this));
        this.connect("notify::screensaver-position", this._onSettingsChanged.bind(this));
        this.connect("notify::key-open-string", this._updateKeyOpenFromString.bind(this));
        
        debugLog("Initial settings loaded from GSettings");

        // Keep AppletSettings (JSON) in sync for keys that EventView expects there
        this._syncAppletSettingsVisibilityOptions();
    }

    _syncAppletSettingsVisibilityOptions() {
        try {
            if (this.settings && typeof this.settings.setValue === 'function') {
                // Event view checks these with this.settings.getValue(...)
                this.settings.setValue("show-events", !!this.show_events);
                this.settings.setValue("show-week-numbers", !!this.show_week_numbers);
                this.settings.setValue("show-weekday-headers", !!this.show_weekday_headers);
                debugLog("AppletSettings visibility options synced from GSettings");
            }
        } catch (e) {
            debugLog("Error syncing AppletSettings visibility options: " + e.message);
        }
    }

    _updateKeyOpenFromString() {
        if (this.key_open_string) {
            this.key_open = this.key_open_string.split("::");
            this._setKeybinding();
        }
    }

    _setKeybinding() {
        debugLog("_setKeybinding called with key_open: " + JSON.stringify(this.key_open) + " (type: " + typeof this.key_open + ")");
        if (this.key_open && Array.isArray(this.key_open)) {
            Main.keybindingManager.addHotKey("calendar-open-" + this.instance_id, this.key_open, this._openMenu.bind(this));
        }
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
        debugLog("_onSettingsChanged called");

        // Always refresh from GSettings to ensure Python-side changes apply immediately
        try {
            this.show_events = this.gsettings.get_boolean("show-events");
            this.show_week_numbers = this.gsettings.get_boolean("show-week-numbers");
            this.show_weekday_headers = this.gsettings.get_boolean("show-weekday-headers");
            this.use_custom_format = this.gsettings.get_boolean("use-custom-format");
            this.os_format_type = this.gsettings.get_string("os-format-type");
            this.use_24h_format = this.gsettings.get_boolean("use-24h-format");
            this.show_seconds = this.gsettings.get_boolean("show-seconds");
            this.date_separator = this.gsettings.get_string("date-separator");
            this.applet_format = this.gsettings.get_string("applet-format");
            this.tooltip_format = this.gsettings.get_string("tooltip-format");
            this.format_help_visible = this.gsettings.get_boolean("format-help-visible");
            this.tooltip_format_help_visible = this.gsettings.get_boolean("tooltip-format-help-visible");
            this.custom_format = this.gsettings.get_string("custom-format");
            this.use_custom_time_format = this.gsettings.get_boolean("use-custom-time-format");
            this.time_format = this.gsettings.get_string("time-format");
            this.screensaver_format = this.gsettings.get_string("screensaver-format");
            this.use_screensaver_custom_format = this.gsettings.get_boolean("use-screensaver-custom-format");
            this.screensaver_position = this.gsettings.get_string("screensaver-position");
            this.screensaver_format_help_visible = this.gsettings.get_boolean("screensaver-format-help-visible");
            this.key_open_string = this.gsettings.get_string("key-open");
            this._updateKeyOpenFromString();
        } catch (e) {
            debugLog("Error reloading settings from GSettings: " + e.message);
        }

        // Ensure EventView sees updated visibility flags via AppletSettings
        this._syncAppletSettingsVisibilityOptions();

        this._updateFormatString();
        this._updateClockAndDate();
        this.event_list.actor.visible = this.events_manager.is_active();
        this.events_manager.select_date(this._calendar.getSelectedDate(), true);
        
        // Debug settings state after changes
        this._debugSettingsState();
    }
    
    _onGSettingsChanged(settings, key) {
        try {
            debugLog("GSettings changed: " + key + " - value: " + settings.get_value(key).print(true));
            // Settings are automatically updated via property bindings
            // Just trigger UI update
            this._onSettingsChanged();
        } catch (e) {
            debugLog("Error handling GSettings change: " + e.message);
        }
    }

    // Dodatkowa metoda do debugowania synchronizacji
    _debugSettingsState() {
        debugLog("=== Current Settings State ===");
        debugLog("show_events: " + this.show_events);
        debugLog("show_week_numbers: " + this.show_week_numbers);
        debugLog("show_weekday_headers: " + this.show_weekday_headers);
        debugLog("use_custom_format: " + this.use_custom_format);
        debugLog("os_format_type: " + this.os_format_type);
        debugLog("use_24h_format: " + this.use_24h_format);
        debugLog("show_seconds: " + this.show_seconds);
        debugLog("date_separator: " + this.date_separator);
        debugLog("applet_format: " + this.applet_format);
        debugLog("tooltip_format: " + this.tooltip_format);
        debugLog("custom_format: " + this.custom_format);
        debugLog("use_custom_time_format: " + this.use_custom_time_format);
        debugLog("time_format: " + this.time_format);
        debugLog("screensaver_format: " + this.screensaver_format);
        debugLog("use_screensaver_custom_format: " + this.use_screensaver_custom_format);
        debugLog("screensaver_position: " + this.screensaver_position);
        debugLog("key_open_string: " + this.key_open_string);
        debugLog("format_string: " + this.format_string);
        debugLog("=== End Settings State ===");
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
            // Use custom format directly
            this.format_string = this.applet_format;
        } else {
            // Generate format based on OS type and preferences
            this.format_string = generateFormat(
                this.os_format_type,
                this.use_24h_format,
                this.show_seconds,
                this.date_separator,
                this.use_custom_time_format,
                this.time_format
            );
        }
        
        debugLog("Format string updated to: " + this.format_string);
    }

    _events_manager_ready(em) {
        this.event_list.actor.visible = this.events_manager.is_active();
    }

    _has_calendars_changed(em) {
        this.event_list.actor.visible = this.events_manager.is_active();
    }

    _updateClockAndDate() {
        if (!this.clock) return;
        
        let time_string = "";
        
        try {
            if (this.use_custom_format && this.applet_format) {
                // Use custom format
                time_string = this.clock.get_clock_for_format(this.applet_format);
            } else if (this.format_string) {
                // Use generated format
                time_string = this.clock.get_clock_for_format(this.format_string);
            } else {
                // Fallback to basic format
                time_string = this.clock.get_clock_for_format("%H:%M");
            }
        } catch (e) {
            debugLog("Error formatting time: " + e.message);
            // Fallback to basic format
            time_string = this.clock.get_clock_for_format("%H:%M");
        }
        
        this.set_applet_label(time_string);
        
        // Update tooltip
        let tooltip_text = "";
        if (this.tooltip_format) {
            try {
                tooltip_text = this.clock.get_clock_for_format(this.tooltip_format);
            } catch (e) {
                debugLog("Error formatting tooltip: " + e.message);
                tooltip_text = this.clock.get_clock_for_format("%A, %B %e, %Y");
            }
        } else {
            tooltip_text = this.clock.get_clock_for_format("%A, %B %e, %Y");
        }
        
        this.set_applet_tooltip(tooltip_text);
    }

    on_applet_added_to_panel() {
        this.clock_notify_id = this.clock.connect("notify::clock", this._clockNotify.bind(this));
        this._updateClockAndDate();
        this._updateFormatString();
        
        // Initial settings sync
        this._onSettingsChanged();
        
        debugLog("Applet added to panel - initial settings state:");
        this._debugSettingsState();
    }

    on_applet_removed_from_panel() {
        if (this.clock_notify_id) {
            this.clock.disconnect(this.clock_notify_id);
            this.clock_notify_id = 0;
        }
        
        if (this.key_open && Array.isArray(this.key_open)) {
            Main.keybindingManager.removeHotKey("calendar-open-" + this.instance_id);
        }
    }

    _initContextMenu() {
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);
    }

    _resetCalendar() {
        this._calendar.reset();
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;
        this._updateFormatString();
        this._updateClockAndDate();
    }

    _buildHeader(calbox) {
        let header = new St.BoxLayout({
            style_class: 'calendar-header',
            vertical: false
        });

        let date_label = new St.Label({
            style_class: 'calendar-date-label'
        });
        header.add_actor(date_label);

        let time_label = new St.Label({
            style_class: 'calendar-time-label'
        });
        header.add_actor(time_label);

        calbox.add_actor(header);

        // Compute proper time format (respect seconds and 12/24h)
        const computeHeaderTimeFormat = () => {
            const showSecs = !!this.show_seconds;
            const is24h = !!this.use_24h_format;
            if (is24h) return showSecs ? "%H:%M:%S" : "%H:%M";
            return showSecs ? "%I:%M:%S %p" : "%I:%M %p";
        };

        const updateHeader = () => {
            try {
                const dateStr = this.clock.get_clock_for_format(DATE_FORMAT_FULL);
                date_label.set_text(dateStr);
                const tf = computeHeaderTimeFormat();
                const timeStr = this.clock.get_clock_for_format(tf);
                time_label.set_text(timeStr);
            } catch (e) {
                debugLog("Header update error: " + e.message);
            }
        };

        // Update on clock tick and immediately
        this.clock.connect("notify::clock", updateHeader);
        updateHeader();

        // While menu is open and seconds are enabled, update every second (independent of system setting)
        this._headerTimerId = 0;
        this.menu.connect('open-state-changed', (m, isOpen) => {
            if (this._headerTimerId) {
                Mainloop.source_remove(this._headerTimerId);
                this._headerTimerId = 0;
            }
            if (isOpen && this.show_seconds) {
                updateHeader();
                this._headerTimerId = Mainloop.timeout_add_seconds(1, () => {
                    updateHeader();
                    return true; // keep
                });
            }
        });
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
