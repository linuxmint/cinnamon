// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const DBus = imports.dbus;
const Lang = imports.lang;

const Config = imports.misc.config;
const Flashspot = imports.ui.flashspot;
const Main = imports.ui.main;
const Extension = imports.ui.extension;
const AppletManager = imports.ui.appletManager;
const DeskletManager = imports.ui.deskletManager;

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
              { name: 'lgGetExtensionList',
                inSignature: '',
                outSignature: 'bs'
              },
              { name: 'lgReloadExtension',
                inSignature: 's',
                outSignature: ''
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
    signals: [{
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
              },
              {
                name: 'lgExtensionListUpdate',
                inSignature: ''
              }
             ],
    properties: [{ name: 'OverviewActive',
                   signature: 'b',
                   access: 'readwrite' },
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
            global.logError('Error inspecting path: ' + path, e);
            return [false, ''];
        }
    },
    
    lgGetLatestWindowList: function() {
        try {
            let windowList = Main.createLookingGlass().getLatestWindowList();
            return getJsonReturnBS(windowList);
        } catch (e) {
            global.logError('Error getting latest window list', e);
            return [false, ''];
        }
    },
    
    lgStartInspector: function() {
        try {
            Main.createLookingGlass().startInspector(true);
        } catch (e) {
            global.logError('Error starting inspector', e);
        }
    },
    
    lgGetExtensionList: function() {
        try {
            let extensionList = [];
            for (let uuid in Extension.meta) {
                let meta = Extension.meta[uuid];
                // There can be cases where we create dummy extension metadata
                // that's not really a proper extension. Don't bother with these.
                if (meta.name) {
                    extensionList.push({
                        status: Extension.getMetaStateString(meta.state),
                        name: meta.name,
                        description: meta.description,
                        uuid: uuid,
                        folder: meta.path,
                        url: meta.url ? meta.url : '',
                        type: Extension.objects[uuid].type.name
                    });
                }
            }
        
            return getJsonReturnBS(extensionList);
        } catch (e) {
            global.logError('Error getting the extension list', e);
            return [false, ''];
        }
    },
    
    lgReloadExtension: function(uuid) {
        let extension = Extension.objects[uuid];
        if (extension) {
            let type = extension.type;
            Extension.unloadExtension(uuid);
            Extension.loadExtension(uuid, type);
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
    
    notifyLgExtensionListUpdate: function() {
        DBus.session.emit_signal('/org/Cinnamon', 'org.Cinnamon', 'lgExtensionListUpdate', '', []);
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

