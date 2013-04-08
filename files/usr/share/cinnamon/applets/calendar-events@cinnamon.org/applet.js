const Applet = imports.ui.applet;		                        // Import code for applet class
const AppletManager = imports.ui.appletManager;
const PopupMenu = imports.ui.popupMenu;		                    // Import code for popupMenu class
const Tooltips = imports.ui.tooltips;

const Gettext = imports.gettext.domain('cinnamon-extensions');
const _ = Gettext.gettext;
const Lang = imports.lang;

const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const CalendarWidget = imports.ui.calendar;
const UPowerGlib = imports.gi.UPowerGlib;
const Mainloop = imports.mainloop;

const cinnamonVersion = imports.misc.config.PACKAGE_VERSION; //@TODO - Convert x.x.z values into a parse able number

var Calendar, CalendarEvent, CalendarEventDate, Parser, parse;
// Autarkper - trick to load imports without hard coding UUID
var init = function( metadata )
{
    imports.searchPath.push(metadata.path);

    Calendar = imports.calendar.Calendar;
    CalendarEvent = imports.calendar.Event;
    CalendarEventDate = imports.calendar.EventDate;

    Parser = imports.parser.Parser;
    parse = new Parser();

    // Object.freeze( Calendar ); - Makes the object immutable, way to make constant?
}


/**
 * Create a new settings object
 * @constructor
 */
function Settings()
{
    this.firstRun = true;
    this.displayEvents = 5;
    this.localeCalendar = {};
    this.userCalendars = [];
    //this.qString = "?orderby=starttime&sortorder=ascending&futureevents=true&alt=json";
}

/**
 * Create a new events object
 * @constructor
 */
function Events()
{
    this.events = [];
}

function MyApplet (metadata, orientation, panel_height, instanceId ) {
    this.uuid = metadata.uuid;
    this.path = metadata.path;
    this.orientation = orientation;

    this.outputPath = GLib.build_filenamev( [GLib.get_home_dir() , '/.cinnamon/' , metadata.uuid] );
    //Does the output dir exisit or do we need to build it?
    let directory = Gio.file_new_for_path( this.outputPath );
    if( ! directory.query_exists(null) ) {
        directory.make_directory_with_parents(null);
    }

    this.settingsFile = this.outputPath + '/settings.json';
    this.eventsFile = this.outputPath + '/events.json';

    // Call the _init method
    this._init( orientation, panel_height, instanceId );
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    // _init function is called whenever the applet is created
    _init: function ( orientation, panel_height, instanceId ) {
        // @note First param must be this to display context menu
        Applet.TextIconApplet.prototype._init.call( this, orientation, panel_height );

        // Set basic properties
        this.set_applet_icon_name('appointment-soon');
        // These are set later with dynamic content
            //this.set_applet_label( );
            //this.set_applet_tooltip( );
    },

    // Function called when the applet is added to a panel
    on_applet_added_to_panel : function() {
            // Code from calendar@cinnamon
            // Track changes to clock settings
            this.dateTimeSettings = new Gio.Settings({ schema: 'org.cinnamon.calendar' });
            this.dateFormat = null;
            this.dateFormatFull = null;

            let getDateTimeSettings = Lang.bind(this, function() {
                this.dateFormat = this.dateTimeSettings.get_string('date-format');
                this.dateFormatFull = this.dateTimeSettings.get_string('date-format-full');
                this._updateClockAndDate();
            });
            this.dateTimeSettings.connect('changed', getDateTimeSettings);

            // Start the clock
            getDateTimeSettings();
            this._updateClockAndDatePeriodic();

            // https://bugzilla.gnome.org/show_bug.cgi?id=655129
            this.upClient = new UPowerGlib.Client();
            this.upClient.connect('notify-resume', getDateTimeSettings);

        // Read settings file
        this._loadSettings();

        this._loadEvents();
        this._updateEvents();

        this._buildContextMenu();

        // Create a new menu to be displayed on left click
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);

        this._buildMenu();

            // Code from calendar@cinnamon
            this.menu.connect('open-state-changed', Lang.bind(this, function(menu, isOpen) {
                if (isOpen) {
                    let now = new Date();
                    // Passing true to setDate() forces events to be reloaded
                    this._calendar.setDate(now, true);
                    // No need to update this._eventList as ::selected-date-changed
                    // signal will fire
                    this._date.set_text(now.toLocaleFormat(this.dateFormatFull))
                }
            }));
    },

    // Function called when the applet is clicked on
    on_applet_clicked: function( event ) {
        this.menu.toggle();
    },

    // Function called when the applet is removed from the panel
    on_applet_removed_from_panel: function() {
        if (this._periodicTimeoutId){
            Mainloop.source_remove(this._periodicTimeoutId);
        }
    },

    // Code from calendar@cinnamon
    _updateClockAndDate: function() {
        let displayDate = new Date();
        let dateFormattedFull = displayDate.toLocaleFormat(this.dateFormatFull);
        this.set_applet_label(displayDate.toLocaleFormat(this.dateFormat));
        if (dateFormattedFull !== this._lastDateFormattedFull) {
            /* Legacy code, no longer needed?
            this._date.set_text(dateFormattedFull);
            this.set_applet_tooltip(dateFormattedFull);*/
            this._lastDateFormattedFull = dateFormattedFull;
        }
    },
    // Code from calendar@cinnamon
    _updateClockAndDatePeriodic: function() {
        this._updateClockAndDate();
        this._periodicTimeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this._updateClockAndDatePeriodic));
    },

    /**
     * Add menu items to the applets context menu
     * @private
     */
    _buildContextMenu: function() {
        // Helper Functions ============================================================================================

        /**
         * Download latest version of the calendars, update available events and rebuild the menu
         */
        //@TODO - I dont like how there is no validation that the update has worked...
        var onUpdateEvents = function()
        {
            this._updateCalendars();
            this._updateEvents();
            this._buildMenu();
            // We shouldn't need to rebuild the context menu
            Main.Util.spawnCommandLine('notify-send "'+ _("Applet events updated") + '"');
        };

        /**
         * Open the Applets settings
         * Requires Cinnamon 1.7.3
         */
        var onLaunchEventSettings = function()
        {
            this.menu.close();
            Main.Util.spawnCommandLine('notify-send "Open Applet Settings"');
        };

        /**
         * Open Cinnamon's Date Time ( Calendar ) settings
         */
        var onLaunchDateTimeSettings = function()
        {
            this.menu.close();
            Main.Util.spawnCommandLine("cinnamon-settings calendar");
        };

        /**
         * Update this.settings to show / hide the selected calendars events
         * @param actor The St object calling the function
         * @param event
         * @param calendar Index key for accessing the calendar within this.settings.calendars
         */
        var onDisplayToggle = Lang.bind(this, function(actor, event, calendar )
        {
            if( !this._toggleCalendar( actor.state, calendar)  )
            {
                return;
            }

            let output = "hidden"; //By default events are shown
            if(actor.state){ output = "visible" }

            this._updateEvents();
            this._buildMenu();
            // We shouldn't need to rebuild the context menu in this case

            Main.Util.spawnCommandLine('notify-send "' + _('Events from '+ calendar.name +' are now '+ output) +'"');
        } );

        /**
         * Remove selected calendar source from this.settings and update applet
         * @param actor The St object calling the function
         * @param event
         * @param calendar Calendar:
         */
                                // Dalcde
        var onRemoveCalendar = Lang.bind(this, function(actor, event, calendar )
        {
            if ( this._removeCalendar( calendar ) ) {
                Main.Util.spawnCommandLine('notify-send "'+ _(calendar.name +' calendar removed') +'"');

                this._updateEvents();
                this._buildMenu();
                this._buildContextMenu();
            }
            else {
                Main.Util.spawnCommandLine('notify-send "' + _('There was a problem removing '+ calendar.name) +'"');
            }

        } );

        /**
         * Add a new calendar source to the applet by URL
         * @param actor The St object calling the function
         * @param event
         * @returns {boolean}
         */
        var onAddCalendar = function(actor, event)
        {
            let key = event.get_key_symbol();
            if (key == "65293")     // Clutter.KEY_Return
            {
                let errorMsg = "Unable to add new calendar";
                if( actor.text.match(/\ [\w-]|['"]/g ) !== null ) {
                    Main.Util.spawnCommandLine('notify-send "' + _(errorMsg) + '"');
                    return false;
                }
               // For now assume all calendars are Google Calendars
               if ( this._addCalendar( actor.text, parse.format.GCAL, "", "", false ) ) {
                    Main.Util.spawnCommandLine('notify-send "'+ _("Successfully added your calendar") +'"');
                    return true;
                } else {
                   Main.Util.spawnCommandLine('notify-send "' + _(errorMsg) + '"');
                }
            }
            return false;
        };

        /**
         * Validate the input is a valid colour name | css code and update the applet to reflect the new
         * setting
         * @type {*}
         */
        var onChangeColour = Lang.bind(this, function(actor, event, calendar )
        {
            let key = event.get_key_symbol();
            if (key == "65293")     // Clutter.KEY_Return
            {
                let errorMsg = "Please enter a valid HTML colour name or CSS colour value";

                // 16 HTML 4 colour names: http://en.wikipedia.org/wiki/Web_colors
                // "" - remove colour value
                let colours = ["white", "silver", "gray", "black", "red", "maroon", "yellow", "olive", "lime",
                                "green", "aqua", "teal", "blue", "navy", "fuchsia", "purple", ""];
                let value = actor.text.trim().toLowerCase();

                let flag = false;
                for( let i = 0, len = colours.length; i < len; i++ ) {
                    if (value == colours[i]) flag = true;
                }

                if( flag == false &&
                    value.match(/^#?[0-9A-Fa-f]{6}$|^rgb\([0-9]{1,3},[0-9]{1,3},[0-9]{1,3}\)$|^rgba\([0-9]{1,3},[0-9]{1,3},[0-9]{1,3},((0|1)|(0.[1-9]))\)$/) === null ) {
                    Main.Util.spawnCommandLine('notify-send "' + _(errorMsg) + '"');
                    actor.text = "";
                    this._applet_context_menu.close();
                }

                calendar.colour = value;
                this._writeToFile(this.settingsFile, this.settings, 'Settings');    // Save changes for next reload
                this._updateEvents();
                this._buildMenu();
                Main.Util.spawnCommandLine('notify-send "'+ _("Calendar updated") +'"');
                this._applet_context_menu.close();
            }
        });

        var onChangeDisplayEventNum = function (actor, event)
        {
            let key = event.get_key_symbol();
            if (key == "65293")     // Clutter.KEY_Return
            {
                let currentValue = this.settings.displayEvents.toString()
                let value = parseInt( actor.text );
                if( isNaN( value ) )
                {
                    Main.Util.spawnCommandLine('notify-send "' + _("Please enter a number") + '"');
                    actor.text = currentValue;
                    this._applet_context_menu.close();
                }

                if(value > 20)
                {
                    value = 20;
                }

                this.settings.displayEvents = value;
                this._writeToFile(this.settingsFile, this.settings, 'Settings');    // Save changes for next reload
                //this._updateAll();
                this._updateEvents();
                this._buildMenu();

                actor.text = "";
                actor.hint_text = value.toString();
                this._applet_context_menu.close();

                Main.Util.spawnCommandLine('notify-send "' + _("Now displaying the next "+value+" events") + '"');
            }
        };

        /**
         * Create a new sub menu to provide basic UI options for calendars
         * @param calendar Calendar: The calendar for the menu to be created
         * @param menu PopupMenuSubMenuMenuItem: Parent menu to add the sub menu to
         * @param localeCalendar Boolean
         * @return void
         */
        var createManageCalendarSubMenu = function( calendar, menu, localeCalendar)
        {
            let calendarSubMenu = new PopupMenu.PopupSubMenuMenuItem( calendar.name );
            menu.menu.addMenuItem( calendarSubMenu );

            if(!localeCalendar) {
                let remove = new PopupMenu.PopupMenuItem( _( "Remove Calendar" ) );
                remove.connect('activate', Lang.bind( this, onRemoveCalendar, calendar ) );
                calendarSubMenu.menu.addMenuItem( remove );
            }

            let colour = new PopupMenu.PopupMenuItem(_("Colour"), {reactive:false}  );
            let colourValue = new St.Entry({
                name: 'colourValue',
                can_focus: true,
                track_hover: false,
                hint_text: calendar.colour || "none"
            });
            colourValue.connect('key-release-event', Lang.bind( this, onChangeColour, calendar));
            colour.addActor(colourValue);
            calendarSubMenu.menu.addMenuItem( colour );

            let display = new PopupMenu.PopupSwitchMenuItem( _( 'Display Calendar Events' ) );
            display.setToggleState(calendar.display);
            display.connect('toggled', Lang.bind( this, onDisplayToggle, calendar ) );
            calendarSubMenu.menu.addMenuItem( display );
        };

        /**
         * Create a new menu item which links to the full version of the calendar
         * @param calendar Calendar: The calendar for the menu item to be created
         * @param menu PopupMenuSubMenuMenuItem: Parent menu to add the menu item to
         * @return void
         */
        var createViewCalendarSubMenu = function ( calendar, menu )
        {
            let subMenuItem = new PopupMenu.PopupMenuItem( calendar.name );
            subMenuItem.connect('activate', Lang.bind( this, function() {Main.Util.spawnCommandLine('xdg-open "'+ calendar.altURL +'"');} ) );
            menu.menu.addMenuItem( subMenuItem );
        };

        // Code to handle the Context menu =============================================================================

            //Clear all items from menu - makes life simple when re-creating the menu
            this._applet_context_menu.removeAll();

            //Section 1 - Refresh Events  ==============================================================================

            let updateEvents = new PopupMenu.PopupImageMenuItem( _('Update Events'), 'view-refresh' );
            updateEvents.connect('activate', Lang.bind( this, onUpdateEvents ) );

            this._applet_context_menu.addMenuItem( updateEvents );
            this._applet_context_menu.addMenuItem( new PopupMenu.PopupSeparatorMenuItem() );

            //Section 2 - Settings Panels ==============================================================================

                let editCalendarSubMenu = new PopupMenu.PopupSubMenuMenuItem( _("Edit Calendars") );   // SubMenuMenuItem is a Menu object so has method .menu
                this._applet_context_menu.addMenuItem( editCalendarSubMenu );

                let calendar = this.settings.localeCalendar;
                createManageCalendarSubMenu( calendar, editCalendarSubMenu, true )
                for( let i = 0, len = this.settings.userCalendars.length ;
                    i < len; i++) {

                    calendar = this.settings.userCalendars[i];
                    createManageCalendarSubMenu( calendar, editCalendarSubMenu, false )
                }

                editCalendarSubMenu.menu.addMenuItem( new PopupMenu.PopupSeparatorMenuItem() );

                let calendarEntryLabel = new PopupMenu.PopupMenuItem( _('Add New Calendar:'), {reactive: false} );
                editCalendarSubMenu.menu.addMenuItem(calendarEntryLabel);
                let calendarEntryContainer = new PopupMenu.PopupBaseMenuItem( {reactive: false} );
                let calendarEntry = new St.Entry({ name: 'calendarAddress',
                                                    can_focus: true,
                                                    track_hover: false,
                                                    hint_text: _("Paste calendar address")
                                                    });
                calendarEntry.connect('key-release-event', Lang.bind( this, onAddCalendar ));
                calendarEntry.set_style("max-width: 200px; font-style: italic");
                calendarEntryContainer.addActor(calendarEntry, {span: -1, align: St.Align.LEFT});
                editCalendarSubMenu.menu.addMenuItem(calendarEntryContainer);

                let  editAppletSubMenu = new  PopupMenu.PopupSubMenuMenuItem( _("Edit Applet"));
                this._applet_context_menu.addMenuItem( editAppletSubMenu );

                let displayEventsNum = new PopupMenu.PopupMenuItem(_("# Events to display"), {reactive:false}  );
                let displayEventsNumValue = new St.Entry({
                    name: 'displayEvents',
                    can_focus: true,
                    track_hover: false,
                    hint_text: this.settings.displayEvents.toString()
                });
                displayEventsNumValue.connect('key-release-event', Lang.bind( this, onChangeDisplayEventNum ));
                displayEventsNum.addActor(displayEventsNumValue);

                editAppletSubMenu.menu.addMenuItem(displayEventsNum);



            let datetimeSettings = new PopupMenu.PopupImageMenuItem( _('Date and Time Settings'), 'preferences-system-time' );
            datetimeSettings.connect("activate", Lang.bind(this, onLaunchDateTimeSettings ));
            this._applet_context_menu.addMenuItem( datetimeSettings );

            this._applet_context_menu.addMenuItem( new PopupMenu.PopupSeparatorMenuItem() );

            //Section 3 - Open Calendars in browser ====================================================================

            let calendarsSubMenu = new PopupMenu.PopupSubMenuMenuItem( _("View Calendars") );   // SubMenuMenuItem is a Menu object so has method .menu
            this._applet_context_menu.addMenuItem( calendarsSubMenu );

            let calendar = this.settings.localeCalendar;
            createViewCalendarSubMenu( calendar, calendarsSubMenu )
            for( let i = 0, len = this.settings.userCalendars.length; i < len; i++) {
                calendar = this.settings.userCalendars[i];
                createViewCalendarSubMenu( calendar, calendarsSubMenu )
            }

            this._applet_context_menu.addMenuItem( new PopupMenu.PopupSeparatorMenuItem() );
    },

    /**
     * Build the menu to be displayed when the user left-clicks on the applet
     * @note - Must be called after updateEvents
     * @private
     */
    _buildMenu: function () {
        this.menu.removeAll();  // Makes life simple when re-building the menu

        this._date = new St.Label();
        this._date.style_class = 'datemenu-date-label';

        let dateItem = new PopupMenu.PopupBaseMenuItem({reactive: false});
        dateItem.addActor(this._date, {span: -1, align: St.Align.MIDDLE});
        this.menu.addMenuItem(dateItem);

        this._calendar = new CalendarWidget.Calendar( null )
        let calendarItem = new PopupMenu.PopupBaseMenuItem({reactive: false});
        calendarItem.addActor(this._calendar.actor, {span: -1, align: St.Align.MIDDLE});
        this.menu.addMenuItem(calendarItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if( this.events.events.length == 0 )
        {
            let item = new PopupMenu.PopupMenuItem( _("You have no upcoming events") );
            this.menu.addMenuItem( item );
        }
        let max = this.settings.displayEvents;
        for(let i = 0, len = this.events.events.length; i < len && i < max ; i++)
        {
            let currentEvent = this.events.events[i];
            let subMenu = new PopupMenu.PopupSubMenuMenuItem( _(currentEvent.title) );   // SubMenuMenuItem is a Menu object so has method .menu

            if(currentEvent.calendarColour != "")
            {
                subMenu.setShowDot(true);
                subMenu._dot.set_style('color: '+currentEvent.calendarColour+';');
            }

            let container = new PopupMenu.PopupBaseMenuItem();

            // Create a custom St.Boxlayout to display event details
            let eventBox = new St.BoxLayout({vertical:true});
            eventBox.add_actor(new St.Label({text: currentEvent.startDate.dateTime}));
            if(!currentEvent.allDay) {
                eventBox.add_actor(new St.Label({text: currentEvent.endDate.dateTime}))
            }
            if (currentEvent.location !== undefined || currentEvent.location == "" ) {
                eventBox.add_actor(new St.Label({text: currentEvent.location}))
            }

            container.addActor(eventBox);
            container.connect('activate', Lang.bind( this, function() {Main.Util.spawnCommandLine('xdg-open "'+ currentEvent.href +'"');} ) );

            subMenu.menu.addMenuItem(container);


            this.menu.addMenuItem( subMenu )
        }

    },

    /**
     * Load the users settings for the applet
     * @private
     */
    _loadSettings: function () {
        try {   // Parse the settings file
            this.settings = JSON.parse( Cinnamon.get_file_contents_utf8_sync( this.settingsFile ) );
        } catch (e) {   // Create a new one
            this.settings = new Settings();
        }

        if ( this.settings.firstRun ) {
            this._addLocaleEventsCalendar();
        }

    },

    /**
     * Add details for calendar containing public events, relevant to the user, based on the systems
     * default locale
     */
    _addLocaleEventsCalendar: function () {
       try {
           let publicCalendars = JSON.parse( Cinnamon.get_file_contents_utf8_sync( this.path + '/public-calendars.json' ) );
           let calendarsList = publicCalendars.locales;

           // Ideally we would open the locale.conf file but it doesn't seem to exist anymore
           // http://www.freedesktop.org/software/systemd/man/locale.conf.html
           // Instead call it from the command line and get the results
                // Can't use async as we need the output ( @out )
           let [res, out, err, status] = GLib.spawn_command_line_sync("locale");
           let values = out.toString().split("\n");
           values = values[4].split("=");
           values = values[1].split(".");
           values = values[0].replace('"', '');     // Remove speech marks - en_GB
           let systemLocale = values.toLowerCase();

           /* Original imp. if LC_TIME is found to be unreliable
           let locale = new String( GLib.get_language_names()).toLowerCase();
           let arrayLocale = locale.split(".");
           let systemLocale = arrayLocale[0];
           */

           // Caching the CalendarList.length as len should improve performance
           // http://robertnyman.com/2008/04/11/javascript-loop-performance/
           let match = false;
           for( let i = 0, len = calendarsList.length; i < len; i++ )
           {
               if(calendarsList[i].locale == systemLocale )
               {
                   match = true;    // Flag there as been a match

                   // Build the URL for the JSON file
                   let urlPrefix = publicCalendars.base;
                   let urlSuffix = calendarsList[i].country + publicCalendars.generic;
                   let lang = systemLocale.substring(0, 2) + ".";

                   let fallback = "en_gb.";
                   if( calendarsList[i].enOnly ) { // See if the URL includes the full locale or just "en"
                       fallback = "en.";    // Spanish is better than Spain so use en_gb
                       lang = "en."
                   }

                   if ( ! this._addCalendar(urlPrefix + lang + urlSuffix, parse.format.GCAL, "", "", true) )
                   {
                       if ( ! this._addCalendar(urlPrefix + fallback + urlSuffix, parse.format.GCAL, "", "", true) ) // Fall back to the english version
                       {
                           this.settings.firstRun = false;
                       }
                   }
                   else
                   {
                       this.settings.firstRun = false;
                   }

                   // Update applet settings store - probably a more efficient way to do this?
                   this._writeToFile(this.settingsFile, this.settings, "Settings");
               }

               if (match) {
                    break;
               }
           }

       } catch (e) {
           global.logError( e );
           let msg = 'Unable to find events based on your current locale';
           global.logError( msg );
           Main.Util.spawnCommandLine( 'notify-send "'+_(msg)+'"' );
       }
    },

    /**
     * Add a calendar to the applet based on the provided URL
     * @param address String - the address for the file to download
     * @param type
     * @param name String - the friendly name to be given to the calendar
     * @param colour - The CSS colour value to be applied to the calendar
     * @param localeCalendar Bool - Should the calendar be added as the locale calendar (true) or a user calendar (false / null)
     * @return Boolean successfully added the calendar (true) | failure (false)
     * @private
     */
     //@ Todo - prevent adding duplicate calendars
    _addCalendar: function( address, type, name, colour, localeCalendar ) {
        var newCalendar = null;
        // Eventually multiple sources should be supported
        // Test for a valid calendar type
        if (type == parse.format.GCAL) {
                                                // URL, where to save, colour
            newCalendar = parse.googleCalendar( address, this.outputPath, colour );

            if ( localeCalendar )
            {
                this.settings.localeCalendar = newCalendar;
                return true;
            }

            // Supposedly this is quicker than calling the .push() function
            // http://www.developer.nokia.com/Community/Wiki/JavaScript_Performance_Best_Practices#Primitive_operations_can_be_faster_than_function_calls
            this.settings.userCalendars[this.settings.userCalendars.length] = newCalendar;
            this._writeToFile(this.settingsFile, this.settings, "Settings");

            // Update the events and UI
            // Move back into a sep function?
            this._updateEvents();
            this._buildMenu()
            this._buildContextMenu();

        return true;

        }
        else {  // If there is no matching parse function for the input then return false
            return false;
        }

    },

    /**
     * Update the source files containing calendar events
     * @private
     */
    //@TODO Escape the function if it was run recently, unless the user forces an update
    _updateCalendars: function() {
        // Download localeCalendar
        this._wgetCalendar( this.settings.localeCalendar.URL,
            this.settings.localeCalendar.fileName,
            this.settings.localeCalendar.name )
        // Download userCalendars
        for ( let i = 0, len = this.settings.userCalendars.length;
              i < len; i++ )
        {
            let calendar = this.settings.userCalendars[i];
            if( (calendar.calendarType == parse.format.GCAL) && calendar.display ) {
                // Download current userCalendar
                this._wgetCalendar( calendar.URL,
                    calendar.fileName,
                    calendar.name )
            }
        }
    },

    /**
     * Remove the specified calendar from the applet and cleanup JSON files
     * Note: This function Does not rebuild the list of events / applet menu to reflect changes
     * @param calendar
     * @return Boolean
     * @private
     */
    _removeCalendar: function( calendar ) {
        var removeIndex;
        for ( let i = 0, len = this.settings.userCalendars.length; i < len; i++) {

            let thisCalendar = this.settings.userCalendars[i];
            // URL should be unique
            if ( thisCalendar.URL == calendar.URL ) {

                removeIndex = i;
            }
        }
        let result = this.settings.userCalendars.splice(removeIndex, 1);

        if(result.length == 1)
        {
            this._writeToFile(this.settingsFile, this.settings, 'Settings');
            this._deleteFile( calendar.fileName );

            return true
        }

        return false;
    },

    /**
     *
     * @param show Boolean
     * @param calendar
     * @return Boolean
     * @private
     */
    _toggleCalendar: function( show, calendar) {

        if ( this.settings.localeCalendar.URL == calendar.URL ) {
            this.settings.localeCalendar.display = show
            this._writeToFile(this.settingsFile, this.settings, 'Settings');
            return true;
        }

        for ( let i = 0, len = this.settings.userCalendars.length; i < len; i++) {

            let thisCalendar = this.settings.userCalendars[i];
            // URL should be unique
            if ( thisCalendar.URL == calendar.URL ) {
                thisCalendar.display = show
                this._writeToFile(this.settingsFile, this.settings, 'Settings');
                return true;
            }
        }

        return false;
    },

    /**
     *
     * @param URL
     * @param fileName
     * @param name
     * @returns {boolean}
     * @private
     */
    _wgetCalendar: function( URL, fileName, name) {
        let [res, out, err, status] = GLib.spawn_command_line_sync("/usr/bin/wget -O " + this.outputPath + "/" + fileName + " " + URL);
        global.log('Downloading calendar: \n' + err + '"');

        let output = true;
        if( status != 0)
        {
            let msg = "There was a problem downloading the " + name + " calendar"
            global.logError( "There was a problem downloading the " + name + " calendar" );
            output = false;
        }

        return output;
    },

    /**
     * Load the existing events | create a blank file
     * @private
     */
    _loadEvents: function() {
        try {   // Parse the settings file
            this.events = JSON.parse( Cinnamon.get_file_contents_utf8_sync( this.eventsFile ) );
        } catch (e) {  // Create a new one
            this.events = new Events();
        }
    },

    /**
     * Build a sorted array of events to display in the applet
     * @private
     */
    _updateEvents: function () {
        // Create a new array to store the events
        let allEvents = new Array();

        // The local calendar always exists at this point
        // Additionally the calendar feed should have been downloaded

        // Get events from localeCalendar
        let source = this.outputPath + '/' + this.settings.localeCalendar.fileName;
        source = JSON.parse( Cinnamon.get_file_contents_utf8_sync( source ) );

        if( this.settings.localeCalendar.display ) {
            try {
                allEvents = parse.googleEntries( source.feed.entry,
                    this.settings.localeCalendar.colour,
                    this.settings.displayEvents,
                    this.dateFormatFull,
                    this.dateFormatFull );     }
            catch(e){global.logError(e)}
        }

        // Get events from each calendar
        for ( let i = 0, len = this.settings.userCalendars.length;
              i < len; i++ )
        {

            let calendar = this.settings.userCalendars[i];
            if( (calendar.calendarType == parse.format.GCAL) && calendar.display ) {
                // Get events from userCalendars
                let source = this.outputPath + '/' + this.settings.userCalendars[i].fileName;
                source = JSON.parse( Cinnamon.get_file_contents_utf8_sync( source ) );

                let events = parse.googleEntries( source.feed.entry,
                    this.settings.userCalendars[i].colour,
                    this.settings.displayEvents,
                    this.dateFormatFull,
                    this.dateFormatFull );
                allEvents = allEvents.concat(events);
            }
            // Eventually we want to be able to parse multiple calendar types

        }
        // Sort allEvents
        function compare(a,b) {
            if (new Date(a.startDate.timeStamp) < new Date(b.startDate.timeStamp) ) { return -1; }
            if (new Date (a.startDate.timeStamp) > new Date(b.startDate.timeStamp) )  { return 1; }
            return 0;
        }
        allEvents.sort(compare);

        this.events.events = allEvents;

        this._writeToFile(this.eventsFile, this.events, "Events" );

        //Update the tool tip to show total event count
        if ( allEvents[0] !== undefined ) {
            this.set_applet_tooltip('Next Event ['+ allEvents[0].title +']');
        } else {
            this.set_applet_tooltip('You have no upcoming events');
        }

    },

    /**
     *
     * @param location
     * @param data
     * @param name
     * @private
     */
    _writeToFile: function(location, data, name) {
        try
        {
            // Adapted from vboxlauncher@adec
            let file = Gio.file_new_for_path( location );
            let outputFile = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
            let out = Gio.BufferedOutputStream.new_sized(outputFile, 1024);
            Cinnamon.write_string_to_stream(out, JSON.stringify(data));
            out.close(null);
            global.log( name+" file has been updated" );
        }
        catch (e)
        {
            global.logError(e);
            global.logError( "Error writing "+name+" to disk" );
        }
    },

    /**
     * Delete the downloaded copy of the calendar data
     * @private
     */
    _deleteFile: function( fileName ) {
        let file = Gio.file_new_for_path( this.outputPath + '/' + fileName );

        if( file.query_exists(null) ) {
            file.trash(null);
        } else {
            global.logError (this.uuid + ": Unable to delete the file " + fileName);
        }
    }
}

// Load the applet
function main(metadata, orientation, panel_height, instanceId)
{
    init( metadata );
    return new MyApplet(metadata, orientation, panel_height, instanceId);
}