const Cinnamon = imports.gi.Cinnamon;
const GLib = imports.gi.GLib;
// applet.js init() must be called before this is loaded
var Calendar = imports.calendar.Calendar;
var CalendarEvent = imports.calendar.Event;
var CalendarEventDate = imports.calendar.EventDate;
/**
 * [Class] to parse events from Calendar sources
 */
function Parser( ){

    this.format = {
        GCAL : "googleCalendar"
    };

    Object.freeze(this.format);
}

Parser.prototype = {

    /**
     * Construct the URL required to download the data we want
     * @param input String Private XML URL from google Calendar
     * @returns {string} Actual URL
     * @private
     */
    _buildGoogleURL : function ( input ) {
        let queryString = "?orderby=starttime&sortorder=ascending&futureevents=true&alt=json";

        input = input.replace("/basic", "/full")    // Make sure the full data set is downloaded

        return input + queryString;
    },

    /**
     * Parse input calendar in Google Calendar format and return a {Calendar}
     * @param address String URL to access the calendar
     * @param dir String Directory path to save the calendar
     * @param colour String Colour used to label calendar events
     * @returns {Calendar}
     */
    googleCalendar : function( address, dir, colour ) {
        let fn = 'tmp.json' // tmp filename to save the downloaded data
        let URL = this._buildGoogleURL( address )

        if (! this._fetch( dir, fn, URL) ) { return false; }

        let file = JSON.parse( Cinnamon.get_file_contents_utf8_sync( dir + '/' + fn ) )

        let calName = file.feed.title.$t;
        let fileName = calName.replace(" ", "-").toLowerCase() + '.json';       // name the file after the calendar
        let calURL = this._buildGoogleURL( file.feed.id.$t );               // If the file was moved on the server 302, this should be the new location
        let altURL = file.feed.link[0].href;                                // Link to view the calendar online

        GLib.spawn_command_line_async( 'mv '+dir + '/' + fn + ' ' + dir + '/' + fileName );

        return new Calendar( calName,
                            colour,
                            true,       // Display
                            fileName,
                            calURL,
                            altURL,
                            this.format.GCAL    // Type
                            );
    },

    /**
     * Parse events in Google Calendar format and return an array of {Events}
     * @param entries Object Source data [ Parsed JSON file ]
     * @param colour String Colour to be applied to each event
     * @param maxEvents Integer The maximum number of events to display
     * @param dateFormat ? The format used for displaying the date without time
     * @param dateFormatTime ? The format used for displaying the date with time
     * @returns {Array} Array contain Event objects
     */
    googleEntries : function ( entries, colour, maxEvents , dateFormat, dateFormatTime ) {

        let events = new Array();

        for ( let i = 0, len = entries.length;
              i < len && i < maxEvents; i++ ) {

            let title =         this._decodeEntities( entries[i].title.$t );
            let content =       entries[i].content.$t;
            let href =          entries[i].link[0].href;
            let location =      entries[i].gd$where[0].valueString;
            let when =          entries[i].gd$when;

            // Add events for each recurrence
            for (let j = 0, len = when.length;
                 j < len && j < maxEvents; j++ )
            {
                let endDate = this._parseDateTime( when[j].endTime );
                let startDate = this._parseDateTime( when[j].startTime );

                // Check for all day events
                // http://stackoverflow.com/questions/3224834/get-difference-between-2-dates-in-javascript
                var timeDiff = Math.abs(endDate.getTime() - startDate.getTime());
                var diffDays = Math.abs(timeDiff / (1000 * 3600 * 24));

                let allDay = false;
                // JSON doesn't do Date types so its easier to store as the string we want in the first place
                // Use the users preferred format
                let strEndDate = endDate.toLocaleFormat(dateFormatTime);
                let strStartDate = startDate.toLocaleFormat(dateFormatTime);

                if (diffDays == 1)
                {
                    allDay = true;
                    strEndDate = endDate.toLocaleFormat(dateFormat);
                    strStartDate = startDate.toLocaleFormat(dateFormat);
                }

                let end = new CalendarEventDate(strEndDate, endDate.getTime());
                let start = new CalendarEventDate(strStartDate, startDate.getTime());

                //title, startDate, endDate, content, allDay, location, href, calendar
                events[events.length] = new CalendarEvent( title, start, end, content, allDay, location, href, colour );
            }

        }
        return events;
    },


    /**
     * Create a Date object using locale time from a date string in ISO 8601 format
     * @param dateString String, should be in the format 2013-03-26T08:00:00.000Z
     * @returns {Date} Based on locale time
     * @private
     */
    _parseDateTime : function( dateString ) {

        // Split into component parts
        let d = dateString.split("-");

        if (d[2].length == 2 ) {   // Has Time been passed?

            //return new Date( Date.UTC( d[0], d[1] - 1, d[2] ) );
            return new Date( d[0], d[1] - 1, d[2] );

        } else { // Yes - best get the time as well then

            let t = d[2].substr(3, 5); // Update this is we need seconds...
            t = t.split(":");

            d[2] = d[2].substr(0, 2); // Update d[2] to only contain the date

            //return new Date( Date.UTC( d[0], d[1] - 1, d[2], t[0], t[1] ) );
            return new Date( d[0], d[1] - 1, d[2], t[0], t[1] );
        }
    },

    /**
     * Create a Date object using UTC time from a date string in ISO 8601 format
     * @param input String, should be in the format 2013-03-26T08:00:00.000Z
     * @private
     */
    //parseDateTimeUTC : function( input ) {
      // Only add method if feedback says it's needed
    //},

    /**
     * Decode HTML entities from strings
     * @param string String containing HTML entities to decode
     * @returns {String}
     * @private
     */
    _decodeEntities : function ( string ) {
        string = string.replace(/&#39;/, "'");
        return string;
    },

    /**
     * Use wget to download and save the requested file
     * @param dir String Path to save the file into
     * @param filename String Name to give the downloaded file
     * @param URL String URL to download
     * @returns {boolean} Success = true
     * @private
     */
    _fetch : function ( dir, filename, URL ) {
        let [res, out, err, status] = GLib.spawn_command_line_sync("/usr/bin/wget -O " + dir + "/" + filename + " " + URL);
        //global.log('Downloading calendar: \n' + err + '"');

        if( status != 0) { return false; }

        return true;
    }



}