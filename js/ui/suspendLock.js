// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/**
 * FILE: suspendLock.js
 * @short_description: Ensures screen is locked BEFORE suspend completes
 *
 * This module fixes a race condition where the desktop can be visible
 * briefly after resume if the system is under heavy CPU load.
 *
 * The fix works by:
 * 1. Holding a systemd "delay" inhibitor to prevent immediate suspend
 * 2. Listening to systemd-logind's PrepareForSleep signal
 * 3. When suspend is about to happen, call loginctl lock-session (universal)
 * 4. Wait for LockedHint=true via PropertiesChanged signal (works with ANY screensaver)
 * 5. Release the inhibitor to allow suspend to proceed
 *
 * This is a UNIVERSAL solution that works with:
 * - cinnamon-screensaver
 * - gnome-screensaver
 * - light-locker
 * - xscreensaver + xss-lock
 * - i3lock + xss-lock
 * - swaylock
 * - Any other compliant screensaver
 *
 * This acts as a "defense in depth" alongside cinnamon-settings-daemon's
 * lock-on-suspend functionality.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

// systemd-logind Manager D-Bus interface (system bus)
const LoginManagerIface = '\
<node> \
    <interface name="org.freedesktop.login1.Manager"> \
        <method name="Inhibit"> \
            <arg type="s" name="what" direction="in"/> \
            <arg type="s" name="who" direction="in"/> \
            <arg type="s" name="why" direction="in"/> \
            <arg type="s" name="mode" direction="in"/> \
            <arg type="h" name="fd" direction="out"/> \
        </method> \
        <method name="GetSession"> \
            <arg type="s" name="session_id" direction="in"/> \
            <arg type="o" name="session_path" direction="out"/> \
        </method> \
        <signal name="PrepareForSleep"> \
            <arg type="b" name="start" direction="out"/> \
        </signal> \
    </interface> \
</node>';

// systemd-logind Session D-Bus interface (for LockedHint)
const LoginSessionIface = '\
<node> \
    <interface name="org.freedesktop.login1.Session"> \
        <method name="Lock"/> \
        <property name="LockedHint" type="b" access="read"/> \
        <property name="Id" type="s" access="read"/> \
    </interface> \
</node>';

// GSettings schema for lock-on-suspend setting
const POWER_SETTINGS_SCHEMA = 'org.cinnamon.settings-daemon.plugins.power';
const LOCK_ON_SUSPEND_KEY = 'lock-on-suspend';

// Timeout for waiting on lock confirmation (ms)
// After this, we release inhibitor anyway to not block suspend forever
const LOCK_TIMEOUT_MS = 5000;

var SuspendLockManager = class SuspendLockManager {
    constructor() {
        this._logindManagerProxy = null;
        this._logindSessionProxy = null;
        this._sessionPath = null;
        this._powerSettings = null;
        this._propertiesChangedId = 0;
        this._lockTimeoutId = 0;

        // Inhibitor file descriptor - when closed, inhibitor is released
        this._inhibitFd = -1;

        this._init();
    }

    _init() {
        // Get power settings to check lock-on-suspend
        try {
            this._powerSettings = new Gio.Settings({ schema_id: POWER_SETTINGS_SCHEMA });
        } catch (e) {
            global.logWarning('SuspendLockManager: Could not load power settings: ' + e.message);
            return;
        }

        // Connect to systemd-logind on the SYSTEM bus
        this._connectToLogind();

        global.log('SuspendLockManager: Initialized - universal lock support enabled');
    }

    _connectToLogind() {
        try {
            // Create proxy for logind Manager
            let LoginManagerProxy = Gio.DBusProxy.makeProxyWrapper(LoginManagerIface);
            this._logindManagerProxy = new LoginManagerProxy(
                Gio.DBus.system,
                'org.freedesktop.login1',
                '/org/freedesktop/login1'
            );

            // Listen for PrepareForSleep signal
            this._logindManagerProxy.connectSignal('PrepareForSleep',
                this._onPrepareForSleep.bind(this));

            // Get current session path
            this._getCurrentSession();

            // Take a delay inhibitor immediately
            this._takeInhibitor();

            global.log('SuspendLockManager: Connected to systemd-logind');
        } catch (e) {
            global.logWarning('SuspendLockManager: Could not connect to logind: ' + e.message);
        }
    }

    _getCurrentSession() {
        try {
            // Get XDG_SESSION_ID from environment
            let sessionId = GLib.getenv('XDG_SESSION_ID');

            if (!sessionId) {
                // Fallback: use "auto" which refers to the caller's session
                sessionId = 'auto';
            }

            // Get the D-Bus object path for this session
            let [sessionPath] = this._logindManagerProxy.GetSessionSync(sessionId);
            this._sessionPath = sessionPath;

            global.log('SuspendLockManager: Session path: ' + this._sessionPath);

            // Create proxy for the session (to monitor LockedHint)
            let LoginSessionProxy = Gio.DBusProxy.makeProxyWrapper(LoginSessionIface);
            this._logindSessionProxy = new LoginSessionProxy(
                Gio.DBus.system,
                'org.freedesktop.login1',
                this._sessionPath
            );

        } catch (e) {
            global.logWarning('SuspendLockManager: Could not get session: ' + e.message);
            // We can still work without session proxy, just no LockedHint confirmation
        }
    }

    _takeInhibitor() {
        if (this._inhibitFd >= 0) {
            global.log('SuspendLockManager: Already holding inhibitor');
            return;
        }

        try {
            // Request a "delay" inhibitor - this delays suspend until we release it
            let result = this._logindManagerProxy.call_with_unix_fd_list_sync(
                'Inhibit',
                new GLib.Variant('(ssss)', [
                    'sleep',                              // what: inhibit sleep/suspend
                    'Cinnamon',                           // who: application name
                    'Locking screen before suspend',      // why: reason
                    'delay'                               // mode: delay (not block)
                ]),
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                null
            );

            // Extract the file descriptor from the result
            let [fdList] = result.slice(-1);
            if (fdList && fdList.get_length() > 0) {
                this._inhibitFd = fdList.get(0);
                global.log('SuspendLockManager: Acquired suspend delay inhibitor (fd=' + this._inhibitFd + ')');
            }
        } catch (e) {
            global.logWarning('SuspendLockManager: Failed to acquire inhibitor: ' + e.message);
        }
    }

    _releaseInhibitor() {
        if (this._inhibitFd < 0) {
            return;
        }

        try {
            let fdStream = new Gio.UnixInputStream({ fd: this._inhibitFd, close_fd: true });
            fdStream.close(null);
            global.log('SuspendLockManager: Released suspend delay inhibitor');
        } catch (e) {
            global.logWarning('SuspendLockManager: Error releasing inhibitor: ' + e.message);
        }

        this._inhibitFd = -1;
    }

    _onPrepareForSleep(proxy, senderName, [isAboutToSuspend]) {
        if (isAboutToSuspend) {
            global.log('SuspendLockManager: PrepareForSleep(true) - system going to sleep');
            this._lockScreenBeforeSuspend();
        } else {
            global.log('SuspendLockManager: PrepareForSleep(false) - system resumed');
            // Re-acquire inhibitor for next suspend
            this._takeInhibitor();
        }
    }

    _lockScreenBeforeSuspend() {
        // Check if lock-on-suspend is enabled
        if (!this._powerSettings.get_boolean(LOCK_ON_SUSPEND_KEY)) {
            global.log('SuspendLockManager: lock-on-suspend is disabled, skipping');
            this._releaseInhibitor();
            return;
        }

        // Check if already locked (via LockedHint)
        if (this._isSessionLocked()) {
            global.log('SuspendLockManager: Session already locked, no action needed');
            this._releaseInhibitor();
            return;
        }

        global.log('SuspendLockManager: Locking screen via loginctl...');

        // Clear any existing timeout
        this._clearLockTimeout();

        // Set up listener for LockedHint change (PropertiesChanged signal)
        this._setupLockedHintListener();

        // Set timeout in case lock confirmation never comes
        this._lockTimeoutId = GLib.timeout_add(GLib.PRIORITY_HIGH, LOCK_TIMEOUT_MS, () => {
            global.logWarning('SuspendLockManager: Lock timeout after ' + LOCK_TIMEOUT_MS + 'ms');
            this._onLockComplete();
            return GLib.SOURCE_REMOVE;
        });

        // Lock the session using loginctl (universal - works with ANY screensaver)
        this._lockViaLoginctl();
    }

    _isSessionLocked() {
        if (!this._logindSessionProxy) {
            return false;
        }

        try {
            // Read LockedHint property
            let lockedHint = this._logindSessionProxy.get_cached_property('LockedHint');
            if (lockedHint) {
                return lockedHint.get_boolean();
            }
        } catch (e) {
            global.logWarning('SuspendLockManager: Could not read LockedHint: ' + e.message);
        }

        return false;
    }

    _setupLockedHintListener() {
        if (!this._logindSessionProxy || this._propertiesChangedId > 0) {
            return;
        }

        // Listen for PropertiesChanged on the session object
        // This is emitted when LockedHint changes (any screensaver sets this!)
        this._propertiesChangedId = this._logindSessionProxy.connect(
            'g-properties-changed',
            (proxy, changedProperties, invalidatedProperties) => {
                let lockedHint = changedProperties.lookup_value('LockedHint', null);
                if (lockedHint && lockedHint.get_boolean() === true) {
                    global.log('SuspendLockManager: LockedHint=true confirmed via D-Bus');
                    this._onLockComplete();
                }
            }
        );
    }

    _lockViaLoginctl() {
        // Method 1: Direct D-Bus call to session Lock() method
        if (this._logindSessionProxy) {
            try {
                global.log('SuspendLockManager: Calling Session.Lock() via D-Bus');
                this._logindSessionProxy.LockSync();
                global.log('SuspendLockManager: Session.Lock() call completed');
                return;
            } catch (e) {
                global.logWarning('SuspendLockManager: D-Bus Lock() failed: ' + e.message);
            }
        }

        // Method 2: Fallback to loginctl command
        try {
            global.log('SuspendLockManager: Falling back to loginctl lock-session');
            let [success, stdout, stderr, exitCode] = GLib.spawn_command_line_sync(
                'loginctl lock-session'
            );
            if (success && exitCode === 0) {
                global.log('SuspendLockManager: loginctl lock-session succeeded');
            } else {
                global.logWarning('SuspendLockManager: loginctl failed: ' +
                    (stderr ? new TextDecoder().decode(stderr) : 'exit code ' + exitCode));
                this._lockFallback();
            }
        } catch (e) {
            global.logWarning('SuspendLockManager: loginctl error: ' + e.message);
            this._lockFallback();
        }
    }

    _lockFallback() {
        // Last resort fallbacks for edge cases
        global.log('SuspendLockManager: Trying fallback lock methods');

        // Try xdg-screensaver
        try {
            GLib.spawn_command_line_sync('xdg-screensaver lock');
            global.log('SuspendLockManager: xdg-screensaver lock succeeded');
            return;
        } catch (e) {
            // Ignore
        }

        // Try cinnamon-screensaver-command
        try {
            GLib.spawn_command_line_sync('cinnamon-screensaver-command --lock');
            global.log('SuspendLockManager: cinnamon-screensaver-command succeeded');
            return;
        } catch (e) {
            // Ignore
        }

        global.logError('SuspendLockManager: All lock methods failed!');
    }

    _clearLockTimeout() {
        if (this._lockTimeoutId > 0) {
            GLib.source_remove(this._lockTimeoutId);
            this._lockTimeoutId = 0;
        }
    }

    _onLockComplete() {
        // Clean up timeout
        this._clearLockTimeout();

        // Disconnect PropertiesChanged listener
        if (this._propertiesChangedId > 0 && this._logindSessionProxy) {
            this._logindSessionProxy.disconnect(this._propertiesChangedId);
            this._propertiesChangedId = 0;
        }

        global.log('SuspendLockManager: Lock complete, releasing inhibitor - suspend can proceed');

        // Release the inhibitor - this allows suspend to proceed
        this._releaseInhibitor();
    }

    destroy() {
        this._clearLockTimeout();

        if (this._propertiesChangedId > 0 && this._logindSessionProxy) {
            this._logindSessionProxy.disconnect(this._propertiesChangedId);
            this._propertiesChangedId = 0;
        }

        this._releaseInhibitor();

        this._logindManagerProxy = null;
        this._logindSessionProxy = null;
        this._powerSettings = null;
    }
};

// Singleton instance
var _suspendLockManager = null;

/**
 * init:
 * Initialize the SuspendLockManager. Should be called once during Cinnamon startup.
 */
function init() {
    if (_suspendLockManager === null) {
        _suspendLockManager = new SuspendLockManager();
    }
}

/**
 * destroy:
 * Clean up the SuspendLockManager. Called during Cinnamon shutdown.
 */
function destroy() {
    if (_suspendLockManager !== null) {
        _suspendLockManager.destroy();
        _suspendLockManager = null;
    }
}
