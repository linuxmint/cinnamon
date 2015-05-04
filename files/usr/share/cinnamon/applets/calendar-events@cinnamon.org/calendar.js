/**
 * Create a new calendar object
 * @param name String
 * @param colour String
 * @param display Boolean
 * @param fileName String
 * @param URL String
 * @param altURL String
 * @param type String
 * @constructor
 */
function Calendar(name, colour, display, fileName, URL, altURL, type)
{
    this.name = name;
    this.colour = colour;
    this.display = display;
    this.fileName = fileName;
    this.URL = URL;
    this.altURL = altURL;
    this.calendarType = type;
};

/**
 * Create a new calendar event object
 * @param title String
 * @param startDate CalendarEventDate
 * @param endDate CalendarEventDate
 * @param content String
 * @param allDay Boolean
 * @param location String
 * @param href String
 * @param calendarColour String
 * @constructor
 */
function Event(title, startDate, endDate, content, allDay, location, href, calendarColour)
{
    this.title = title;
    // Map to ui.calendar.js date, end, summary, all day
    //Dates should be a CalendarEventDate object to allow sorting and display in locale format
    this.startDate = startDate;
    this.endDate = endDate;
    this.content = content;
    this.allDay = allDay
    this.location = location;
    this.href = href;
    this.calendarColour = calendarColour;
}

/**
 * Create a new event date object to store date time and time in milliseconds
 * @param dateTime String
 * @param timeStamp Int - Time in milliseconds
 * @constructor
 */
function EventDate(dateTime, timeStamp)
{
    this.dateTime = dateTime;
    this.timeStamp = timeStamp;
}