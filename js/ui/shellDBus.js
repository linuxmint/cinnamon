// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const DBus = imports.dbus;
const Lang = imports.lang;

const Config = imports.misc.config;
const ExtensionSystem = imports.ui.extensionSystem;
const Main = imports.ui.main;

const GnomeShellIface = {
    name: 'org.gnome.Shell',
    methods: [{ name: 'Eval',
                inSignature: 's',
                outSignature: 'bs'
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
                inSignature: 'iiiis',
                outSignature: 'b'
              },
              { name: 'ScreenshotWindow',
                inSignature: 'bs',
                outSignature: 'b'
              },
              { name: 'Screenshot',
                inSignature: 's',
                outSignature: 'b'
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
                inSignature: 'sis' }],
    properties: [{ name: 'OverviewActive',
                   signature: 'b',
                   access: 'readwrite' },
                 { name: 'ApiVersion',
                   signature: 'i',
                   access: 'read' },
                 { name: 'ShellVersion',
                   signature: 's',
                   access: 'read' }]
};

function GnomeShell() {
    this._init();
}

GnomeShell.prototype = {
    _init: function() {
        DBus.session.exportObject('/org/gnome/Shell', this);
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

    /**
     * ScreenshotArea:
     * @x: The X coordinate of the area
     * @y: The Y coordinate of the area
     * @width: The width of the area
     * @height: The height of the area
     * @filename: The filename for the screenshot
     *
     * Takes a screenshot of the passed in area and saves it
     * in @filename as png image, it returns a boolean
     * indicating whether the operation was successful or not.
     *
     */
    ScreenshotAreaAsync : function (x, y, width, height, filename, callback) {
        global.screenshot_area (x, y, width, height, filename, function (obj, result) { callback(result); });
    },

    /**
     * ScreenshotWindow:
     * @include_frame: Whether to include the frame or not
     * @filename: The filename for the screenshot
     *
     * Takes a screenshot of the focused window (optionally omitting the frame)
     * and saves it in @filename as png image, it returns a boolean
     * indicating whether the operation was successful or not.
     *
     */
    ScreenshotWindow : function (include_frame, filename) {
        return global.screenshot_window (include_frame, filename);
    },

    /**
     * Screenshot:
     * @filename: The filename for the screenshot
     *
     * Takes a screenshot of the whole screen and saves it
     * in @filename as png image, it returns a boolean
     * indicating whether the operation was successful or not.
     *
     */
    ScreenshotAsync : function (filename, callback) {
        global.screenshot(filename, function (obj, result) { callback(result); });
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

    ShellVersion: Config.PACKAGE_VERSION,

    _extensionStateChanged: function(_, newState) {
        DBus.session.emit_signal('/org/gnome/Shell',
                                 'org.gnome.Shell',
                                 'ExtensionStatusChanged', 'sis',
                                 [newState.uuid, newState.state, newState.error]);
    }
};

DBus.conformExport(GnomeShell.prototype, GnomeShellIface);

