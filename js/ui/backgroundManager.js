// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const Cinnamon = imports.gi.Cinnamon;
const CinnamonBg = imports.gi.CinnamonBg;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;
const Signals = imports.signals;

const LOGGING = false;

// cinnamon-background-daemon draws the wallpaper (per-monitor, via layer-shell
// on Wayland, root window on x11). It is D-Bus activatable; we start it, watch
// its readiness so the startup reveal can wait for the wallpaper, and restart it
// if it dies.
const DAEMON_NAME = 'org.Cinnamon.Background';
const DAEMON_PATH = '/org/Cinnamon/Background';
const DAEMON_STATE_READY = 1;
const READY_FALLBACK_MS = 4000;

const RESTART_LIMIT = 1;
const RESTART_WINDOW_US = 60 * GLib.USEC_PER_SEC;

var BackgroundManager = class {
    constructor() {
        this._daemonProxy = null;
        this._daemonReady = false;
        this._onDaemonReady = null;
        this._daemonHadOwner = false;
        this._daemonExitTimes = [];

        this._startDaemon();
        Gio.bus_watch_name(Gio.BusType.SESSION, DAEMON_NAME,
                           Gio.BusNameWatcherFlags.NONE,
                           () => { this._daemonHadOwner = true; },
                           this._onDaemonVanished.bind(this));

        this._cinnamonSettings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.background" });

        this._cinnamonPictureUri = this._cinnamonSettings.get_string("picture-uri");
        this._cinnamonSettings.connect("changed::picture-uri",
                                       this._onCinnamonPictureURIChanged.bind(this));

        let schema = Gio.SettingsSchemaSource.get_default();
        if (!schema.lookup("org.gnome.desktop.background", true))
            return;

        this._gnomeSettings = new Gio.Settings({ schema_id: "org.gnome.desktop.background" });
        this._pictureUri = this._gnomeSettings.get_string("picture-uri");
        this._gnomeSettings.connect("changed::picture-uri", this._onPictureURIChanged.bind(this));
    }

    showBackground() {
        for (let actor of global.get_background_actors()) {
            actor.show();
        }
    }

    hideBackground() {
        for (let actor of global.get_background_actors()) {
            actor.hide();
        }
    }

    _startDaemon() {
        if (this._daemonProxy) {
            this._daemonProxy.call_start(null, (proxy, res) => {
                try {
                    proxy.call_start_finish(res);
                } catch (e) {
                    global.logWarning('BackgroundManager: could not restart cinnamon-background-daemon: ' + e.message);
                }
            });
            return;
        }

        Cinnamon.BackgroundProxy.new_for_bus(Gio.BusType.SESSION, Gio.DBusProxyFlags.NONE,
            DAEMON_NAME, DAEMON_PATH, null,
            (src, res) => {
                try {
                    this._daemonProxy = Cinnamon.BackgroundProxy.new_for_bus_finish(res);
                } catch (e) {
                    global.logWarning('BackgroundManager: background daemon proxy failed: ' + e.message);
                    return;
                }

                const checkState = () => {
                    if (this._daemonProxy.state === DAEMON_STATE_READY)
                        this._markDaemonReady();
                };
                this._daemonProxy.connect('notify::state', checkState);
                checkState();   // it may already be READY by the time we connect

                this._daemonProxy.connect('notify::rendered-layout',
                                          () => this.emit("changed"));

                this.emit("changed");
            });
    }

    _markDaemonReady() {
        if (this._daemonReady)
            return;
        this._daemonReady = true;
        if (this._onDaemonReady) {
            const cb = this._onDaemonReady;
            this._onDaemonReady = null;
            cb();
        }
    }

    whenReady(callback) {
        if (this._daemonReady) {
            callback();
            return;
        }

        let done = false;
        const fire = () => {
            if (done)
                return;
            done = true;
            callback();
        };

        // Chain rather than replace: dropping a pending callback would strand
        // whoever is waiting on it.
        const previous = this._onDaemonReady;
        this._onDaemonReady = previous ? () => { previous(); fire(); } : fire;

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, READY_FALLBACK_MS, () => {
            if (!done)
                global.logWarning('BackgroundManager: background not ready in time; revealing anyway');
            fire();
            return GLib.SOURCE_REMOVE;
        });
    }

    _onDaemonVanished() {
        if (!this._daemonHadOwner)
            return;

        const now = GLib.get_monotonic_time();
        this._daemonExitTimes = this._daemonExitTimes.filter(t => now - t < RESTART_WINDOW_US);
        if (this._daemonExitTimes.length >= RESTART_LIMIT) {
            global.logError('BackgroundManager: cinnamon-background-daemon keeps exiting; giving up on restarting it');
            return;
        }
        this._daemonExitTimes.push(now);

        global.logWarning('BackgroundManager: cinnamon-background-daemon exited; restarting it');
        this._startDaemon();
    }

    _applyExternalUri(uri, source) {
        if (uri == "")
            return;
        // set_single_uri() replaces the list with one zoomed entry, discarding
        // any per-monitor layout.
        if (LOGGING) {
            global.log("BackgroundManager: %s picture-uri -> single background (%s)".format(source, uri));
        }
        CinnamonBg.List.set_single_uri(uri);
    }

    _onCinnamonPictureURIChanged(settings, key) {
        this._cinnamonPictureUri = this._cinnamonSettings.get_string(key);
        this._applyExternalUri(this._cinnamonPictureUri, "Cinnamon");
    }

    _onPictureURIChanged(settings, key) {
        this._pictureUri = this._gnomeSettings.get_string(key);
        this._applyExternalUri(this._pictureUri, "GNOME");
    }

    _basename(uri) {
        if (!uri)
            return _("(none)");
        return decodeURIComponent(uri).split("/").pop();
    }

    // (mode, [(connector, display-name, picture-uri, slideshow)]).
    getBackgroundSummary() {
        let variant = this._daemonProxy ? this._daemonProxy.rendered_layout : null;
        let [mode, layout] = variant ? variant.deepUnpack() : ["", []];

        if (layout.length == 0)
            return { slideshowActive: false, multi: false, entries: [] };

        let multi = mode == "independent";
        let entries = [];
        let active = false;

        for (let [connector, label, uri, slideshow] of layout) {
            if (slideshow)
                active = true;
            entries.push({ monitor: multi ? (label || connector) : "",
                           name: this._basename(uri) });
        }

        if (!multi)
            entries.length = 1;

        return { slideshowActive: active, multi: multi, entries: entries };
    }
};
Signals.addSignalMethods(BackgroundManager.prototype);
