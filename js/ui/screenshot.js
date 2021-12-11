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
const ModalDialog = imports.ui.modalDialog;
const Util = imports.misc.util;
const Cinnamon = imports.gi.Cinnamon;

const ScreenshotIface =
    '<node> \
        <interface name="org.gnome.Shell.Screenshot"> \
            <method name="ScreenshotArea"> \
                <arg type="i" direction="in" name="x"/> \
                <arg type="i" direction="in" name="y"/> \
                <arg type="i" direction="in" name="width"/> \
                <arg type="i" direction="in" name="height"/> \
                <arg type="b" direction="in" name="flash"/> \
                <arg type="s" direction="in" name="filename"/> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="s" direction="out" name="filename_used"/> \
            </method> \
            <method name="ScreenshotWindow"> \
                <arg type="b" direction="in" name="include_frame"/> \
                <arg type="b" direction="in" name="include_cursor"/> \
                <arg type="b" direction="in" name="flash"/> \
                <arg type="s" direction="in" name="filename"/> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="s" direction="out" name="filename_used"/> \
            </method> \
            <method name="Screenshot"> \
                <arg type="b" direction="in" name="include_frame"/> \
                <arg type="b" direction="in" name="flash"/> \
                <arg type="s" direction="in" name="filename"/> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="s" direction="out" name="filename_used"/> \
            </method> \
        </interface> \
    </node>';

/*
 * This interface is specifically for gnome-screenshot purposes.
 * The screenshot calls are not asynchronous to the caller but
 * it allows us to be sure the png has been written prior to
 * completing the invocation.
 * 
 * The callback argument is unused.
 */

class ScreenshotService {
    constructor() {
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(ScreenshotIface, this);
        this._dbusImpl.export(Gio.DBus.session, '/org/gnome/Shell/Screenshot');

        Gio.DBus.session.own_name('org.gnome.Shell.Screenshot', Gio.BusNameOwnerFlags.REPLACE, null, null);
    }

    _onScreenshotComplete (obj, success, area, flash, filename, invocation=null) {
        if (success) {
            if (flash) {
                let flashspot = new Flashspot.Flashspot(area);
                flashspot.fire();
            }
        }

        let retval = GLib.Variant.new('(bs)', [success, filename]);
        invocation.return_value(retval);
    }

    ScreenshotAreaAsync(params, invocation) {
        let [x, y, width, height, flash, filename, callback] = params;

        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot_area(
            false,
            x * global.ui_scale,
            y * global.ui_scale,
            width * global.ui_scale,
            height * global.ui_scale,
            filename,
            Lang.bind(this, this._onScreenshotComplete, flash, filename, invocation)
        );
    }

    ScreenshotWindowAsync(params, invocation) {
        let [include_frame, include_cursor, flash, filename, callback] = params;

        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot_window(include_frame, include_cursor, filename,
            Lang.bind(this, this._onScreenshotComplete, flash, filename, invocation));
    }

    ScreenshotAsync(params, invocation) {
        let [include_cursor, flash, filename] = params

        let screenshot = new Cinnamon.Screenshot();
        screenshot.screenshot(include_cursor, filename,
            Lang.bind(this, this._onScreenshotComplete, flash, filename, invocation));
    }
}
