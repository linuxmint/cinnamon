// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Config = imports.misc.config;
const Extension = imports.ui.extension;
const Flashspot = imports.ui.flashspot;
const Main = imports.ui.main;
const AppletManager = imports.ui.appletManager;
const DeskletManager = imports.ui.deskletManager;
const ExtensionSystem = imports.ui.extensionSystem;
const SearchProviderManager = imports.ui.searchProviderManager;
const Util = imports.misc.util;
const Cinnamon = imports.gi.Cinnamon;

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
            <method name="highlightXlet"> \
                <arg type="s" direction="in" /> \
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
                <arg type="s" direction="in" /> \
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
            <method name="ReloadXlet"> \
                <arg type="s" direction="in" name="uuid" /> \
                <arg type="s" direction="in" name="type" /> \
            </method> \
            <property name="OverviewActive" type="b" access="readwrite" /> \
            <property name="ExpoActive" type="b" access="readwrite" /> \
            <property name="CinnamonVersion" type="s" access="read" /> \
            <signal name="XletAddedComplete"> \
                <arg type="b" direction="out" /> \
                <arg type="s" direction="out" /> \
            </signal> \
            <method name="PushSubprocessResult"> \
                <arg type="i" direction="in" name="process_id" /> \
                <arg type="s" direction="in" name="result" /> \
                <arg type="b" direction="in" name="success" /> \
            </method> \
            <method name="ToggleKeyboard"/> \
        </interface> \
    </node>';

function CinnamonDBus() {
    this._init();
}

CinnamonDBus.prototype = {
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

    _onScreenshotComplete: function(obj, result, area, flash) {
        if (flash) {
            let flashspot = new Flashspot.Flashspot(area);
            flashspot.fire();
        }
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
    ScreenshotArea: function(include_cursor, x, y, width, height, flash, filename) {
        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot_area(include_cursor, x, y, width, 200, filename,
            Lang.bind(this, this._onScreenshotComplete, flash));
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
    ScreenshotWindow: function(include_frame, include_cursor, flash, filename) {
        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot_window(include_frame, include_cursor, filename,
            Lang.bind(this, this._onScreenshotComplete, flash));
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
    Screenshot: function(include_cursor, flash, filename) {
        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot(include_cursor, filename,
            Lang.bind(this, this._onScreenshotComplete, flash));
    },

    ShowOSD: function(params) {
        for (let param in params)
            params[param] = params[param].deep_unpack();

        let monitorIndex = -1;
        if (params.maybeGet('monitor') >= 0) {
            monitorIndex = params['monitor'];
        }

        let icon = null;
        if (params['icon'])
            icon = Gio.Icon.new_for_string(params['icon']);

        Main.osdWindowManager.show(monitorIndex, icon, params['level'], true);
    },

    FlashArea: function(x, y, width, height) {
        let flashspot = new Flashspot.Flashspot({
            x: x,
            y: y,
            width: width,
            height: height
        });
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

    get ExpoActive() {
        return Main.expo.visible;
    },

    set ExpoActive(visible) {
        if (visible)
            Main.expo.show();
        else
            Main.expo.hide();
    },

    _getXletObject: function(uuid, instance_id) {
        var obj = null;

        obj = AppletManager.get_object_for_uuid(uuid, instance_id);

        if (!obj) {
            obj = DeskletManager.get_object_for_uuid(uuid, instance_id);
        }

        if (!obj) {
            obj = ExtensionSystem.get_object_for_uuid(uuid);
        }

        return obj;
    },

    EmitXletAddedComplete: function(success, uuid, name) {
        this._dbusImpl.emit_signal('XletAddedComplete', GLib.Variant.new('(bs)', [success, uuid]));
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

    ReloadXlet: function(uuid, type) {
        Extension.reloadExtension(uuid, Extension.Type[type]);
    },

    highlightXlet: function(uuid, instance_id, highlight) {
        let obj = this._getXletObject(uuid, instance_id);
        if (obj.highlight) obj.highlight(highlight);
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

    activateCallback: function(callback, uuid, instance_id) {
        let obj = this._getXletObject(uuid, instance_id);
        let cb = Lang.bind(obj, obj[callback]);
        cb();
    },

    updateSetting: function(uuid, instance_id, key, payload) {
        Main.settingsManager.uuids[uuid][instance_id].remoteUpdate(key, payload);
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

    PushSubprocessResult: function(process_id, result, success) {
        if (Util.subprocess_callbacks[process_id]) {
            if (success)
                Util.subprocess_callbacks[process_id](result);
            delete Util.subprocess_callbacks[process_id];
        }
    },

    ToggleKeyboard: function() {
        Main.keyboard.toggle();
    },

    CinnamonVersion: Config.PACKAGE_VERSION
};
