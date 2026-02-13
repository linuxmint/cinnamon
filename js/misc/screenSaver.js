// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;

const ScreenSaverIface =
    '<node> \
        <interface name="org.cinnamon.ScreenSaver"> \
        <method name="GetActive"> \
            <arg type="b" direction="out" /> \
        </method> \
        <method name="GetActiveTime"> \
            <arg type="u" direction="out" /> \
        </method> \
        <method name="Lock"> \
            <arg type="s" direction="in" /> \
        </method> \
        <method name="SetActive"> \
            <arg type="b" direction="in" /> \
        </method> \
        <signal name="ActiveChanged"> \
            <arg type="b" direction="out" /> \
        </signal> \
        </interface> \
    </node>';

const ScreenSaverInfo = Gio.DBusInterfaceInfo.new_for_xml(ScreenSaverIface);

/**
 * ScreenSaverService:
 *
 * Implements the org.cinnamon.ScreenSaver DBus interface.
 * Routes calls to the internal screensaver (Main.screenShield).
 *
 * Note: If internal-screensaver-enabled is false, Cinnamon must be restarted
 * to allow the external cinnamon-screensaver daemon to claim the bus name.
 */
var ScreenSaverService = class ScreenSaverService {
    constructor() {
        this._settings = new Gio.Settings({ schema_id: 'org.cinnamon' });

        if (!this._settings.get_boolean('internal-screensaver-enabled')) {
            global.log('ScreenSaverService: internal-screensaver-enabled is false, not providing DBus service');
            return;
        }

        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(ScreenSaverIface, this);
        this._dbusImpl.export(Gio.DBus.session, '/org/cinnamon/ScreenSaver');

        Gio.DBus.session.own_name('org.cinnamon.ScreenSaver',
                                   Gio.BusNameOwnerFlags.REPLACE,
                                   null, null);

        if (Main.screenShield) {
            Main.screenShield.connect('locked', this._onLocked.bind(this));
            Main.screenShield.connect('unlocked', this._onUnlocked.bind(this));
        }

        global.log('ScreenSaverService: providing org.cinnamon.ScreenSaver interface');
    }

    _onLocked() {
        this._emitActiveChanged(true);
    }

    _onUnlocked() {
        this._emitActiveChanged(false);
    }

    _emitActiveChanged(isActive) {
        if (this._dbusImpl) {
            this._dbusImpl.emit_signal('ActiveChanged',
                                        GLib.Variant.new('(b)', [isActive]));
        }
    }

    GetActiveAsync(params, invocation) {
        let isActive = Main.screenShield.isLocked();
        invocation.return_value(GLib.Variant.new('(b)', [isActive]));
    }

    GetActiveTimeAsync(params, invocation) {
        let activeTime = Main.screenShield.getActiveTime();
        invocation.return_value(GLib.Variant.new('(u)', [activeTime]));
    }

    LockAsync(params, invocation) {
        let [message] = params;

        if (!Main.lockdownSettings.get_boolean('disable-lock-screen')) {
            let awayMessage = message || null;
            Main.screenShield.lock(false, false, awayMessage);
        }

        invocation.return_value(null);
    }

    SetActiveAsync(params, invocation) {
        let [active] = params;

        if (Main.screenShield) {
            if (active) {
                // Activate (not lock) - respects lock-enabled and lock-delay settings
                Main.screenShield.activate();
            } else {
                // Can't deactivate if locked
                if (!Main.screenShield.isLocked()) {
                    Main.screenShield.deactivate();
                }
            }
        }

        invocation.return_value(null);
    }
};

/**
 * Legacy proxy for backward compatibility.
 * Creates a proxy to the DBus service (which may be internal or external).
 */
function ScreenSaverProxy() {
    var self = new Gio.DBusProxy({
        g_connection: Gio.DBus.session,
        g_interface_name: ScreenSaverInfo.name,
        g_interface_info: ScreenSaverInfo,
        g_name: 'org.cinnamon.ScreenSaver',
        g_object_path: '/org/cinnamon/ScreenSaver',
        g_flags: (Gio.DBusProxyFlags.DO_NOT_AUTO_START |
                 Gio.DBusProxyFlags.DO_NOT_LOAD_PROPERTIES)
    });
    self.init(null);
    self.screenSaverActive = false;

    self.connectSignal('ActiveChanged', function(proxy, senderName, [isActive]) {
        self.screenSaverActive = isActive;
    });
    self.connect('notify::g-name-owner', function() {
        if (self.g_name_owner) {
            self.GetActiveRemote(function(result, excp) {
                if (result) {
                    let [isActive] = result;
                    self.screenSaverActive = isActive;
                }
            });
        } else
            self.screenSaverActive = false;
    });

    return self;
}