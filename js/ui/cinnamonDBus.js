// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Config = imports.misc.config;
const Flashspot = imports.ui.flashspot;
const Main = imports.ui.main;
const AppletManager = imports.ui.appletManager;
const DeskletManager = imports.ui.deskletManager;
const ExtensionSystem = imports.ui.extensionSystem;
const SearchProviderManager = imports.ui.searchProviderManager;
const Util = imports.misc.util;

const CinnamonIface =
    '<node> \
        <interface name="org.Cinnamon"> \
            <method name="Eval"> \
                <arg type="s" direction="in" name="script" /> \
                <arg type="b" direction="out" name="success" /> \
                <arg type="s" direction="out" name="result" /> \
            </method> \
            <method name="ScreenshotArea"> \
                <arg type="b" direction="in" name="include_cursor"/> \
                <arg type="i" direction="in" name="x"/> \
                <arg type="i" direction="in" name="y"/> \
                <arg type="i" direction="in" name="width"/> \
                <arg type="i" direction="in" name="height"/> \
                <arg type="b" direction="in" name="flash"/> \
                <arg type="s" direction="in" name="filename"/> \
            </method> \
            <method name="ScreenshotWindow"> \
                <arg type="b" direction="in" name="include_frame"/> \
                <arg type="b" direction="in" name="include_cursor"/> \
                <arg type="b" direction="in" name="flash"/> \
                <arg type="s" direction="in" name="filename"/> \
            </method> \
            <method name="Screenshot"> \
                <arg type="b" direction="in" name="include_frame"/> \
                <arg type="b" direction="in" name="flash"/> \
                <arg type="s" direction="in" name="filename"/> \
            </method> \
            <method name="ShowOSD"> \
                <arg type="a{sv}" direction="in" name="params"/> \
            </method> \
            <method name="FlashArea"> \
                <arg type="i" direction="in" name="x"/> \
                <arg type="i" direction="in" name="y"/> \
                <arg type="i" direction="in" name="width"/> \
                <arg type="i" direction="in" name="height"/> \
            </method> \
            <method name="highlightApplet"> \
                <arg type="s" direction="in" /> \
                <arg type="b" direction="in" /> \
            </method> \
            <method name="highlightPanel"> \
                <arg type="i" direction="in" /> \
                <arg type="b" direction="in" /> \
            </method> \
            <method name="addPanelQuery"> \
            </method> \
            <method name="destroyDummyPanels"> \
            </method> \
            <method name="activateCallback"> \
                <arg type="s" direction="in" /> \
                <arg type="s" direction="in" /> \
                <arg type="b" direction="in" /> \
            </method> \
            <method name="updateSetting"> \
                <arg type="s" direction="in" /> \
                <arg type="s" direction="in" /> \
                <arg type="s" direction="in" /> \
                <arg type="s" direction="in" /> \
            </method> \
            <method name="switchWorkspaceRight" /> \
            <method name="switchWorkspaceLeft" /> \
            <method name="switchWorkspaceUp" /> \
            <method name="switchWorkspaceDown" /> \
            <method name="JumpToNewWorkspace" /> \
            <method name="RemoveCurrentWorkspace" /> \
            <method name="ShowExpo" /> \
            <method name="GetRunningXletUUIDs"> \
                <arg type="s" direction="in" /> \
                <arg type="as" direction="out" /> \
            </method> \
            <property name="OverviewActive" type="b" access="readwrite" /> \
            <property name="CinnamonVersion" type="s" access="read" /> \
            <signal name="XletAddedComplete"> \
                <arg type="b" direction="out" /> \
                <arg type="s" direction="out" /> \
            </signal> \
            <method name="PushSubprocessResult"> \
                <arg type="i" direction="in" name="process_id" /> \
                <arg type="s" direction="in" name="result" /> \
            </method> \
        </interface> \
    </node>';

function Cinnamon() {
    this._init();
}

Cinnamon.prototype = {
    _init: function() {
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(CinnamonIface, this);
        this._dbusImpl.export(Gio.DBus.session, '/org/Cinnamon');
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

    ShowOSD: function(params) {
        for (let param in params)
            params[param] = params[param].deep_unpack();

        let icon = null;
        if (params['icon'])
            icon = Gio.Icon.new_for_string(params['icon']);

        Main.osdWindow.setIcon(icon);
        Main.osdWindow.setLevel(params['level']);
        if (params)
            Main.osdWindow.show();
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

    EmitXletAddedComplete: function(success, uuid, name) {
        this._dbusImpl.emit_signal('XletAddedComplete', GLib.Variant.new('(bs)', [success,uuid]));
    },

    GetRunningXletUUIDs: function(type) {
        let list = null;
        let res = [];

        if (type == "applet") {
            list = AppletManager.appletObj;
            for (let key in list) {
                res.push(list[key]._uuid);
            }
        } else if (type == "desklet") {
            list = DeskletManager.deskletObj;
            for (let key in list) {
                res.push(list[key]._uuid);
            }
        } else {
            list = ExtensionSystem.runningExtensions;
            for (let uuid in list) {
                res.push(uuid);
            }
        }

        return res;
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

    highlightPanel: function(id, highlight) {
        if (Main.panelManager.panels[id])
            Main.panelManager.panels[id].highlight(highlight);
    },

    addPanelQuery: function() {
        Main.panelManager.addPanelQuery();
    },

    destroyDummyPanels: function() {
        Main.panelManager._destroyDummyPanels();
    },

    activateCallback: function(callback, id, id_is_instance) {
        let obj = this._getXletObject(id, id_is_instance);
        let cb = Lang.bind(obj, obj[callback]);
        cb();
    },

    updateSetting: function(uuid, instance_id, key, payload) {
        Main.settingsManager.uuids[uuid][instance_id].remote_set(key, payload);
    },

    switchWorkspaceLeft: function() {
        Main.wm.actionMoveWorkspaceLeft();
    },

    switchWorkspaceRight: function() {
        Main.wm.actionMoveWorkspaceRight();
    },

    switchWorkspaceUp: function() {
        Main.overview.toggle();
    },

    switchWorkspaceDown: function() {
        Main.expo.toggle();
    },

    JumpToNewWorkspace: function() {
        Main._addWorkspace();
        let num = global.screen.get_n_workspaces();
        if (global.screen.get_workspace_by_index(num - 1) != null) {
            global.screen.get_workspace_by_index(num - 1).activate(global.get_current_time());
        }
    },

    RemoveCurrentWorkspace: function() {
        let index = global.screen.get_active_workspace_index();
        if (global.screen.get_workspace_by_index(index) != null) {
            Main._removeWorkspace(global.screen.get_workspace_by_index(index));
        }
    },

    ShowExpo: function() {
        if (!Main.expo.animationInProgress)
            Main.expo.toggle();
    },
    
    PushSubprocessResult: function(process_id, result)
    {
        if (Util.subprocess_callbacks[process_id])
        {
            Util.subprocess_callbacks[process_id](result);
        }
    },

    CinnamonVersion: Config.PACKAGE_VERSION
};
