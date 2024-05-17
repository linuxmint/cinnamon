// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Cinnamon = imports.gi.Cinnamon;

const XdgAppState = {
    BACKGROUND: 0, // window.is_hidden
    RUNNING:    1, // window visible
    ACTIVE:     2  // window focused
}

const CinnamonPortalIface =
    '<node> \
        <interface name="org.cinnamon.PortalHandlers"> \
            <method name="GetAppStates"> \
                <arg type="a{sv}" direction="out" name="apps" /> \
            </method> \
            <signal name="RunningAppsChanged"/> \
        </interface> \
    </node>';


var CinnamonPortalHandler = class CinnamonPortalHandler {
    constructor() {
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(CinnamonPortalIface, this);
        this._dbusImpl.export(Gio.DBus.session, '/org/Cinnamon');

        this.running_apps = {}
        Cinnamon.AppSystem.get_default().connect("app-state-changed", () => this.EmitRunningAppsChanged());
        Cinnamon.WindowTracker.get_default().connect("notify::focus-app", () => this.EmitRunningAppsChanged());
    }

    EmitRunningAppsChanged() {
        this._dbusImpl.emit_signal('RunningAppsChanged', null);
    }

    has_focus(app) {
        const fwin = global.display.get_focus_window();
        if (fwin == null) {
            return false;
        }

        const app_windows = app.get_windows();
        for (let w of app_windows) {
            if (w == fwin) {
                return true;
            }
        }

        return false;
    }

    /* org.freedesktop.impl.portal.Background.GetAppState:
     * A big issue right now is that in X11, CinnamonAppSystem stops caring
     * about an app if its windows are closed or *hidden* to tray, so our list
     * here won't contain any background apps until this behavior is addressed. */
    GetAppStates() {
        const appsys = Cinnamon.AppSystem.get_default();
        const running = appsys.get_running();
        const apps = {}

        for (let app of running) {
            var id = null;

            if (app.get_is_flatpak()) {
                id = app.get_flatpak_app_id();
            }
            else
            {
                id = app.get_id();
            }
            if (app.get_n_windows() === 0) {
                apps[id] = GLib.Variant.new_uint32(XdgAppState.BACKGROUND); // Can't happen currently.
            } else {
                if (this.has_focus(app)) {
                    apps[id] = GLib.Variant.new_uint32(XdgAppState.ACTIVE);
                }
                else
                {
                    apps[id] = GLib.Variant.new_uint32(XdgAppState.RUNNING);
                }
            }
        }

        return new GLib.Variant("(a{sv})", [apps]);
    }
}
