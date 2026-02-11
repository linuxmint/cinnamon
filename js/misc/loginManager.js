// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Signals = imports.signals;

const SystemdLoginManagerIface = `
<node>
  <interface name="org.freedesktop.login1.Manager">
    <method name="Inhibit">
      <arg type="s" direction="in"/>
      <arg type="s" direction="in"/>
      <arg type="s" direction="in"/>
      <arg type="s" direction="in"/>
      <arg type="h" direction="out"/>
    </method>
    <method name="GetSession">
      <arg type="s" direction="in"/>
      <arg type="o" direction="out"/>
    </method>
    <signal name="PrepareForSleep">
      <arg type="b" direction="out"/>
    </signal>
  </interface>
</node>`;

const SystemdLoginManagerProxy = Gio.DBusProxy.makeProxyWrapper(SystemdLoginManagerIface);

const SystemdLoginSessionIface = `
<node>
  <interface name="org.freedesktop.login1.Session">
    <signal name="Lock"/>
    <signal name="Unlock"/>
    <property name="Active" type="b" access="read"/>
  </interface>
</node>`;

const SystemdLoginSessionProxy = Gio.DBusProxy.makeProxyWrapper(SystemdLoginSessionIface);

const ConsoleKitManagerIface = `
<node>
  <interface name="org.freedesktop.ConsoleKit.Manager">
    <method name="GetCurrentSession">
      <arg type="o" direction="out"/>
    </method>
  </interface>
</node>`;

const ConsoleKitManagerProxy = Gio.DBusProxy.makeProxyWrapper(ConsoleKitManagerIface);

const ConsoleKitSessionIface = `
<node>
  <interface name="org.freedesktop.ConsoleKit.Session">
    <signal name="Lock"/>
    <signal name="Unlock"/>
    <signal name="ActiveChanged">
      <arg type="b" direction="out"/>
    </signal>
  </interface>
</node>`;

const ConsoleKitSessionProxy = Gio.DBusProxy.makeProxyWrapper(ConsoleKitSessionIface);

function haveSystemd() {
    return GLib.access("/run/systemd/seats", 0) >= 0;
}

var LoginManagerSystemd = class {
    constructor() {
        this._managerProxy = null;
        this._sessionProxy = null;

        this._initSession();
    }

    _initSession() {
        global.log('LoginManager: Connecting to logind...');

        try {
            this._managerProxy = new SystemdLoginManagerProxy(
                Gio.DBus.system,
                'org.freedesktop.login1',
                '/org/freedesktop/login1'
            );

            this._getCurrentSession();
        } catch (e) {
            global.logError('LoginManager: Failed to connect to logind: ' + e.message);
        }
    }

    _getCurrentSession() {
        try {
            let username = GLib.get_user_name();
            let [result, stdout, stderr, status] = GLib.spawn_command_line_sync(
                `loginctl show-user ${username} -pDisplay --value`
            );

            if (!result || status !== 0) {
                throw new Error('loginctl command failed');
            }

            let sessionId = ByteArray.toString(stdout).trim();
            if (!sessionId) {
                throw new Error('No session ID found');
            }

            global.log(`LoginManager: Found session ID: ${sessionId}`);

            this._managerProxy.GetSessionRemote(sessionId, (result, error) => {
                if (error) {
                    global.logError('LoginManager: Failed to get session path: ' + error);
                    return;
                }

                let [sessionPath] = result;
                global.log(`LoginManager: Got session path: ${sessionPath}`);

                this._connectToSession(sessionPath);
            });
        } catch (e) {
            global.logError('LoginManager: Error getting logind session: ' + e.message);
        }
    }

    _connectToSession(sessionPath) {
        try {
            this._sessionProxy = new SystemdLoginSessionProxy(
                Gio.DBus.system,
                'org.freedesktop.login1',
                sessionPath
            );

            global.log('LoginManager: Successfully connected to logind session');

            this._sessionProxy.connectSignal('Lock', () => {
                global.log('LoginManager: Received Lock signal from logind, emitting lock');
                this.emit('lock');
            });

            this._sessionProxy.connectSignal('Unlock', () => {
                global.log('LoginManager: Received Unlock signal from logind, emitting unlock');
                this.emit('unlock');
            });

            this._sessionProxy.connect('g-properties-changed', (proxy, changed, invalidated) => {
                if ('Active' in changed.deep_unpack()) {
                    let active = this._sessionProxy.Active;
                    global.log(`LoginManager: Session Active property changed: ${active}`);
                    if (active) {
                        global.log('LoginManager: Session became active, emitting active');
                        this.emit('active');
                    }
                }
            });

            this.emit('session-ready');
        } catch (e) {
            global.logError('LoginManager: Failed to connect to logind session: ' + e.message);
        }
    }

    connectPrepareForSleep(callback) {
        if (!this._managerProxy) {
            return null;
        }

        return this._managerProxy.connectSignal('PrepareForSleep', (proxy, sender, [aboutToSuspend]) => {
            global.log(`LoginManager: PrepareForSleep signal received (aboutToSuspend=${aboutToSuspend})`);
            callback(aboutToSuspend);
        });
    }

    inhibit(reason, callback) {
        if (!this._managerProxy) {
            global.log('LoginManager: inhibit() called but no manager proxy');
            callback(null);
            return;
        }

        global.log(`LoginManager: Requesting sleep inhibitor: "${reason}"`);

        let inVariant = GLib.Variant.new('(ssss)',
            ['sleep', 'cinnamon-screensaver', reason, 'delay']);

        this._managerProxy.call_with_unix_fd_list(
            'Inhibit', inVariant, 0, -1, null, null,
            (proxy, result) => {
                try {
                    let [outVariant_, fdList] = proxy.call_with_unix_fd_list_finish(result);
                    let fd = fdList.steal_fds()[0];
                    global.log(`LoginManager: Sleep inhibitor acquired (fd=${fd})`);
                    callback(new Gio.UnixInputStream({ fd }));
                } catch (e) {
                    global.logError('LoginManager: Error getting inhibitor: ' + e.message);
                    callback(null);
                }
            });
    }
};
Signals.addSignalMethods(LoginManagerSystemd.prototype);

var LoginManagerConsoleKit = class {
    constructor() {
        this._managerProxy = null;
        this._sessionProxy = null;

        this._initSession();
    }

    _initSession() {
        global.log('LoginManager: Connecting to ConsoleKit...');

        try {
            this._managerProxy = new ConsoleKitManagerProxy(
                Gio.DBus.system,
                'org.freedesktop.ConsoleKit',
                '/org/freedesktop/ConsoleKit/Manager'
            );

            this._managerProxy.GetCurrentSessionRemote((result, error) => {
                if (error) {
                    global.logError('LoginManager: Failed to get ConsoleKit session: ' + error);
                    global.logError('LoginManager: Automatic unlocking from greeter will not work');
                    return;
                }

                let [sessionPath] = result;
                global.log(`LoginManager: Got ConsoleKit session path: ${sessionPath}`);

                this._connectToSession(sessionPath);
            });
        } catch (e) {
            global.logError('LoginManager: Failed to connect to ConsoleKit: ' + e.message);
            global.logError('LoginManager: Automatic unlocking from greeter will not work');
        }
    }

    _connectToSession(sessionPath) {
        try {
            this._sessionProxy = new ConsoleKitSessionProxy(
                Gio.DBus.system,
                'org.freedesktop.ConsoleKit',
                sessionPath
            );

            global.log('LoginManager: Successfully connected to ConsoleKit session');

            this._sessionProxy.connectSignal('Lock', () => {
                global.log('LoginManager: Received Lock signal from ConsoleKit, emitting lock');
                this.emit('lock');
            });

            this._sessionProxy.connectSignal('Unlock', () => {
                global.log('LoginManager: Received Unlock signal from ConsoleKit, emitting unlock');
                this.emit('unlock');
            });

            this._sessionProxy.connectSignal('ActiveChanged', (proxy, sender, [active]) => {
                global.log(`LoginManager: ConsoleKit ActiveChanged: ${active}`);
                if (active) {
                    global.log('LoginManager: Session became active, emitting active');
                    this.emit('active');
                }
            });

            this.emit('session-ready');
        } catch (e) {
            global.logError('LoginManager: Failed to connect to ConsoleKit session: ' + e.message);
            global.logError('LoginManager: Automatic unlocking from greeter will not work');
        }
    }

    connectPrepareForSleep(callback) {
        // ConsoleKit doesn't have PrepareForSleep
        return null;
    }

    inhibit(reason, callback) {
        // ConsoleKit doesn't have inhibitors
        callback(null);
    }
};
Signals.addSignalMethods(LoginManagerConsoleKit.prototype);

let _loginManager = null;

function getLoginManager() {
    if (_loginManager == null) {
        if (haveSystemd()) {
            _loginManager = new LoginManagerSystemd();
        } else {
            _loginManager = new LoginManagerConsoleKit();
        }
    }

    return _loginManager;
}
