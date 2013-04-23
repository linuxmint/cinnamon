// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const DBus = imports.dbus;
const Lang = imports.lang;

const Config = imports.misc.config;
const Flashspot = imports.ui.flashspot;
const Main = imports.ui.main;
const AppletManager = imports.ui.appletManager;
const DeskletManager = imports.ui.deskletManager;

const CinnamonIface = {
    name: 'org.Cinnamon',
    methods: [{ name: 'Eval',
                inSignature: 's',
                outSignature: 'bs'
              },
              { name: 'ScreenshotArea',
                inSignature: 'biiiibs',
                outSignature: ''
              },
              { name: 'ScreenshotWindow',
                inSignature: 'bbbs',
                outSignature: ''
              },
              { name: 'Screenshot',
                inSignature: 'bbs',
                outSignature: ''
              },
              {
                name: 'FlashArea',
                inSignature: 'iiii',
                outSignature: ''
              },
              {
                name: 'highlightApplet',
                inSignature: 'sb',
                outSignature: ''
              },
              {
                name: 'activateCallback',
                inSignature: 'ssb',
                outSignature: ''
              }
             ],
    signals: [],
    properties: [{ name: 'OverviewActive',
                   signature: 'b',
                   access: 'readwrite' },
                 { name: 'CinnamonVersion',
                   signature: 's',
                   access: 'read' }]
};

function Cinnamon() {
    this._init();
}

Cinnamon.prototype = {
    _init: function() {
        DBus.session.exportObject('/org/Cinnamon', this);
    },

    /**
     * Eval:
     * @code: A string containing JavaScript code
     *
     * This function executes arbitrary code in the main
     * loop, and returns a boolean success and
     * JSON representation of the object as a string.
     *
     * If evaluation completes without throwing an exception,
     * then the return value will be [true, JSON.stringify(result)].
     * If evaluation fails, then the return value will be
     * [false, JSON.stringify(exception)];
     *
     */
    Eval: function(code) {
        let returnValue;
        let success;
        try {
            returnValue = JSON.stringify(eval(code));
            // A hack; DBus doesn't have null/undefined
            if (returnValue == undefined)
                returnValue = '';
            success = true;
        } catch (e) {
            returnValue = JSON.stringify(e);
            success = false;
        }
        return [success, returnValue];
    },

    _onScreenshotComplete: function(obj, result, area, flash, invocation) {
        if (flash) {
            let flashspot = new Flashspot.Flashspot(area);
            flashspot.fire();
        }

        let retval = GLib.Variant.new('(b)', [result]);
        invocation.return_value(retval);
    },

    /**
     * ScreenshotArea:
     * @include_cursor: Whether to include the mouse cursor
     * @x: The X coordinate of the area
     * @y: The Y coordinate of the area
     * @width: The width of the area
     * @height: The height of the area
     * @flash: Whether to flash the edges of area
     * @filename: The filename for the screenshot
     *
     * Takes a screenshot of the passed in area and saves it
     * in @filename as png image, it returns a boolean
     * indicating whether the operation was successful or not.
     *
     */
    ScreenshotAreaAsync : function (params, invocation) {
        let [include_cursor, x, y, width, height, flash, filename, callback] = params;
        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot_area (include_cursor, x, y, width, height, filename,
                                Lang.bind(this, this._onScreenshotComplete,
                                          flash, invocation));
    },

    /**
     * ScreenshotWindow:
     * @include_frame: Whether to include the frame or not
     * @include_cursor: Whether to include the mouse cursor
     * @flash: Whether to flash the edges of the window
     * @filename: The filename for the screenshot
     *
     * Takes a screenshot of the focused window (optionally omitting the frame)
     * and saves it in @filename as png image, it returns a boolean
     * indicating whether the operation was successful or not.
     *
     */
    ScreenshotWindowAsync : function (params, invocation) {
        let [include_frame, include_cursor, flash, filename] = params;
        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot_window (include_frame, include_cursor, filename,
                                      Lang.bind(this, this._onScreenshotComplete,
                                                flash, invocation));
    },

    /**
     * Screenshot:
     * @include_cursor: Whether to include the mouse cursor
     * @flash: Whether to flash the edges of the screen
     * @filename: The filename for the screenshot
     *
     * Takes a screenshot of the whole screen and saves it
     * in @filename as png image, it returns a boolean
     * indicating whether the operation was successful or not.
     *
     */
    ScreenshotAsync : function (params, invocation) {
        let [include_cursor, flash, filename] = params;
        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot(include_cursor, filename,
                          Lang.bind(this, this._onScreenshotComplete,
                                    flash, invocation));
    },

    FlashArea: function(x, y, width, height) {
        let flashspot = new Flashspot.Flashspot({ x : x, y : y, width: width, height: height});
        flashspot.fire();
    },

    get OverviewActive() {
        return Main.overview.visible;
    },

    set OverviewActive(visible) {
        if (visible)
            Main.overview.show();
        else
            Main.overview.hide();
    },

    _getXletObject: function(id, id_is_instance) {
        let obj = null;
        if (id_is_instance) {
            obj = AppletManager.get_object_for_instance(id)
            if (!obj)
                obj = DeskletManager.get_object_for_instance(id)
        } else {
            obj = AppletManager.get_object_for_uuid(id)
            if (!obj)
                obj = DeskletManager.get_object_for_uuid(id)
        }
        return obj
    },

    highlightApplet: function(id, id_is_instance) {
        let obj = this._getXletObject(id, id_is_instance);
        if (!obj)
            return;
        let actor = obj.actor;

        if (actor) {
            let [x, y] = actor.get_transformed_position();
            let [w, h] = actor.get_transformed_size();
            this.FlashArea(x, y, w, h)
        }
    },

    activateCallback: function(callback, id, id_is_instance) {
        let obj = this._getXletObject(id, id_is_instance);
        let cb = Lang.bind(obj, obj[callback]);
        cb();
    },

    CinnamonVersion: Config.PACKAGE_VERSION
};

DBus.conformExport(Cinnamon.prototype, CinnamonIface);

