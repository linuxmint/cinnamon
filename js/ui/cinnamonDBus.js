// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const DBus = imports.dbus;
const Lang = imports.lang;

const Config = imports.misc.config;
const ExtensionSystem = imports.ui.extensionSystem;
const Flashspot = imports.ui.flashspot;
const Main = imports.ui.main;

const CinnamonIface = {
    name: 'org.Cinnamon',
    methods: [{ name: 'Eval',
                inSignature: 's',
                outSignature: 'bs'
              },
              { name: 'lgEval',
                inSignature: 's',
                outSignature: ''
              },
              { name: 'lgGetResults',
                inSignature: '',
                outSignature: 'bs'
              },
              { name: 'lgAddResult',
                inSignature: 's',
                outSignature: ''
              },
              { name: 'lgGetErrorStack',
                inSignature: '',
                outSignature: 'bs'
              },
              { name: 'lgGetMemoryInfo',
                inSignature: '',
                outSignature: 'bs'
              },
              { name: 'lgFullGc',
                inSignature: '',
                outSignature: ''
              },
              { name: 'lgInspect',
                inSignature: 's',
                outSignature: 'bs'
              },
              { name: 'lgGetLatestWindowList',
                inSignature: '',
                outSignature: 'bs'
              },
              { name: 'lgStartInspector',
                inSignature: '',
                outSignature: ''
              },
              { name: 'ListExtensions',
                inSignature: '',
                outSignature: 'a{sa{sv}}'
              },
              { name: 'GetExtensionInfo',
                inSignature: 's',
                outSignature: 'a{sv}'
              },
              { name: 'GetExtensionErrors',
                inSignature: 's',
                outSignature: 'as'
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
              { name: 'EnableExtension',
                inSignature: 's',
                outSignature: ''
              },
              { name: 'DisableExtension',
                inSignature: 's',
                outSignature: ''
              },
              { name: 'InstallRemoteExtension',
                inSignature: 'ss',
                outSignature: ''
              },
              { name: 'UninstallExtension',
                inSignature: 's',
                outSignature: 'b'
              }
             ],
    signals: [{ name: 'ExtensionStatusChanged',
                inSignature: 'sis' },
              {
                name: 'lgLogUpdate',
                inSignature: ''
              },
              {
                name: 'lgWindowListUpdate',
                inSignature: ''
              },
              {
                name: 'lgResultUpdate',
                inSignature: ''
              },
              {
                name: 'lgInspectorDone',
                inSignature: ''
              }],
    properties: [{ name: 'OverviewActive',
                   signature: 'b',
                   access: 'readwrite' },
                 { name: 'ApiVersion',
                   signature: 'i',
                   access: 'read' },
                 { name: 'CinnamonVersion',
                   signature: 's',
                   access: 'read' }]
};

function getJsonReturnBS(object) {
    let returnValue;
    let success;
    try {
        returnValue = JSON.stringify(object);
        // A hack; DBus doesn't have null/undefined
        if (returnValue == undefined)
            returnValue = '';
        success = true;
    } catch (e) {
        returnValue = JSON.stringify(e);
        success = false;
    }
    return [success, returnValue];
}

function Cinnamon() {
    this._init();
}

Cinnamon.prototype = {
    _init: function() {
        DBus.session.exportObject('/org/Cinnamon', this);
        ExtensionSystem.connect('extension-state-changed',
                                Lang.bind(this, this._extensionStateChanged));
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
    
    lgEval: function(code) {
        Main.createLookingGlass()._evaluate(code);
    },
    
    lgGetResults: function() {
        return getJsonReturnBS(Main.createLookingGlass().rawResults);
    },
    
    lgAddResult: function(path) {
        Main.createLookingGlass().addResult(path);
    },
    
    lgGetErrorStack: function() {
        return getJsonReturnBS(Main._errorLogStack);
    },
    
    lgGetMemoryInfo: function() {
        // can't use it raw, need to store it again
        let memInfo = global.get_memory_info();
        let memdata = {
            'glibc_uordblks': (memInfo.glibc_uordblks),
            'js_bytes': (memInfo.js_bytes),
            'gjs_boxed': (memInfo.gjs_boxed),
            'gjs_gobject': (memInfo.gjs_gobject),
            'gjs_function': (memInfo.gjs_function),
            'gjs_closure': (memInfo.gjs_closure),
            'last_gc_seconds_ago': (memInfo.last_gc_seconds_ago)
        };
        return getJsonReturnBS(memdata);
    },
    
    lgFullGc: function() {
        global.gc();
    },
    
    lgInspect: function(path) {
        try {
            let result = Main.createLookingGlass().inspect(path);
            return getJsonReturnBS(result);
        } catch (e) {
            global.log('inspect exception: ' + e);
            return [false, ''];
        }
    },
    
    lgGetLatestWindowList: function() {
        try {
            let windowList = Main.createLookingGlass().getLatestWindowList();
            return getJsonReturnBS(windowList);
        } catch (e) {
            global.log('window list exception: ' + e);
            return [false, ''];
        }
    },
    
    lgStartInspector: function() {
        try {
            Main.createLookingGlass().startInspector(true);
        } catch (e) {
            global.log('starting inspector exception: ' + e);
        }
    },
    
    notifyLgLogUpdate: function() {
        DBus.session.emit_signal('/org/Cinnamon', 'org.Cinnamon', 'lgLogUpdate', '', []);
    },
    
    notifyLgWindowListUpdate: function() {
        DBus.session.emit_signal('/org/Cinnamon', 'org.Cinnamon', 'lgWindowListUpdate', '', []);
    },
    
    notifyLgResultUpdate: function() {
        DBus.session.emit_signal('/org/Cinnamon', 'org.Cinnamon', 'lgResultUpdate', '', []);
    },
    
    notifyLgInspectorDone: function() {
        DBus.session.emit_signal('/org/Cinnamon', 'org.Cinnamon', 'lgInspectorDone', '', []);
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

    ListExtensions: function() {
        return ExtensionSystem.extensionMeta;
    },

    GetExtensionInfo: function(uuid) {
        return ExtensionSystem.extensionMeta[uuid] || {};
    },

    GetExtensionErrors: function(uuid) {
        return ExtensionSystem.errors[uuid] || [];
    },

    EnableExtension: function(uuid) {
        let enabledExtensions = global.settings.get_strv(ExtensionSystem.ENABLED_EXTENSIONS_KEY);
        if (enabledExtensions.indexOf(uuid) == -1)
            enabledExtensions.push(uuid);
        global.settings.set_strv(ExtensionSystem.ENABLED_EXTENSIONS_KEY, enabledExtensions);
    },

    DisableExtension: function(uuid) {
        let enabledExtensions = global.settings.get_strv(ExtensionSystem.ENABLED_EXTENSIONS_KEY);
        while (enabledExtensions.indexOf(uuid) != -1)
            enabledExtensions.splice(enabledExtensions.indexOf(uuid), 1);
        global.settings.set_strv(ExtensionSystem.ENABLED_EXTENSIONS_KEY, enabledExtensions);
    },

    InstallRemoteExtension: function(uuid, version_tag) {
        ExtensionSystem.installExtensionFromUUID(uuid, version_tag);
    },

    UninstallExtension: function(uuid) {
        return ExtensionSystem.uninstallExtensionFromUUID(uuid);
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

    ApiVersion: ExtensionSystem.API_VERSION,

    CinnamonVersion: Config.PACKAGE_VERSION,

    _extensionStateChanged: function(_, newState) {
        DBus.session.emit_signal('/org/Cinnamon',
                                 'org.Cinnamon',
                                 'ExtensionStatusChanged', 'sis',
                                 [newState.uuid, newState.state, newState.error]);
    }
};

DBus.conformExport(Cinnamon.prototype, CinnamonIface);

