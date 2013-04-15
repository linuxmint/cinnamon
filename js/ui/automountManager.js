// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Params = imports.misc.params;

const CinnamonMountOperation = imports.ui.cinnamonMountOperation;
const ScreenSaver = imports.misc.screenSaver;

// GSettings keys
const SETTINGS_SCHEMA = 'org.gnome.desktop.media-handling';
const SETTING_ENABLE_AUTOMOUNT = 'automount';

const AUTORUN_EXPIRE_TIMEOUT_SECS = 10;

const ConsoleKitSessionIface = <interface name="org.freedesktop.ConsoleKit.Session">
<method name="isActive">
    <arg type="b" direction="out" />
</method>
<method name="ActiveChanged">
    <arg type="b" direction="in" />
</method>
</interface>;

const ConsoleKitSessionProxy = Gio.DBusProxy.makeProxyWrapper(ConsoleKitSessionIface);

const ConsoleKitManagerIface = <interface name="org.freedesktop.ConsoleKit.Manager">
<method name="GetCurrentSession">
    <arg type="o" direction="out" />
</method>
</interface>;

const ConsoleKitManagerInfo = Gio.DBusInterfaceInfo.new_for_xml(ConsoleKitManagerIface);

function ConsoleKitManager() {
    var self = new Gio.DBusProxy({ g_connection: Gio.DBus.system,
                                  g_interface_name: ConsoleKitManagerInfo.name,
                                  g_interface_info: ConsoleKitManagerInfo,
                                  g_name: 'org.freedesktop.ConsoleKit',
                                  g_object_path: '/org/freedesktop/ConsoleKit/Manager',
                                   g_flags: (Gio.DBusProxyFlags.DO_NOT_AUTO_START |
                                             Gio.DBusProxyFlags.DO_NOT_LOAD_PROPERTIES) });
    
    self._updateSessionActive = function() {
        if (self.g_name_owner) {
            self.GetCurrentSessionRemote(function([session]) {
                self._ckSession = new ConsoleKitSessionProxy(Gio.DBus.system, 'org.freedesktop.ConsoleKit', session);

                self._ckSession.connectSignal('ActiveChanged', function(object, senderName, [isActive]) {
                    self.sessionActive = isActive;
                });
                self._ckSession.IsActiveRemote(function([isActive]) {
                    self.sessionActive = isActive;
                });
            });
        } else {
            self.sessionActive = true;
        }
    }
    self.connect('notify::g-name-owner',
                 Lang.bind(self, self._updateSessionActive));
 
    self._updateSessionActive();
    self.init(null);
    return self;
}

function AutomountManager() {
    this._init();
}

AutomountManager.prototype = {
    _init: function() {
        this._settings = new Gio.Settings({ schema: SETTINGS_SCHEMA });
        this._volumeQueue = [];

        this.ckListener = new ConsoleKitManager();

        this._ssProxy = new ScreenSaver.ScreenSaverProxy();
        this._ssProxy.connectSignal('ActiveChanged',
                                    Lang.bind(this, this._screenSaverActiveChanged));

        this._volumeMonitor = Gio.VolumeMonitor.get();

        this._volumeMonitor.connect('volume-added',
                                    Lang.bind(this,
                                              this._onVolumeAdded));
        this._volumeMonitor.connect('volume-removed',
                                    Lang.bind(this,
                                              this._onVolumeRemoved));
        this._volumeMonitor.connect('drive-connected',
                                    Lang.bind(this,
                                              this._onDriveConnected));
        this._volumeMonitor.connect('drive-disconnected',
                                    Lang.bind(this,
                                              this._onDriveDisconnected));
        this._volumeMonitor.connect('drive-eject-button',
                                    Lang.bind(this,
                                              this._onDriveEjectButton));

        Mainloop.idle_add(Lang.bind(this, this._startupMountAll));
    },

    _screenSaverActiveChanged: function(object, senderName, [isActive]) {
        if (!isActive) {
            this._volumeQueue.forEach(Lang.bind(this, function(volume) {
                this._checkAndMountVolume(volume);
            }));
        }

        // clear the queue anyway
        this._volumeQueue = [];
    },

    _startupMountAll: function() {
        let volumes = this._volumeMonitor.get_volumes();
        volumes.forEach(Lang.bind(this, function(volume) {
            this._checkAndMountVolume(volume, { checkSession: false,
                                                useMountOp: false });
        }));

        return false;
    },

    _onDriveConnected: function() {
        // if we're not in the current ConsoleKit session,
        // or screensaver is active, don't play sounds
        if (!this.ckListener.sessionActive)
            return;        

        if (this._ssProxy.screenSaverActive)
            return;

        global.play_theme_sound(0, 'device-added-media');
    },

    _onDriveDisconnected: function() {
        // if we're not in the current ConsoleKit session,
        // or screensaver is active, don't play sounds
        if (!this.ckListener.sessionActive)
            return;        

        if (this._ssProxy.screenSaverActive)
            return;

        global.play_theme_sound(0, 'device-removed-media');        
    },

    _onDriveEjectButton: function(monitor, drive) {
        // TODO: this code path is not tested, as the GVfs volume monitor
        // doesn't emit this signal just yet.
        if (!this.ckListener.sessionActive)
            return;

        // we force stop/eject in this case, so we don't have to pass a
        // mount operation object
        if (drive.can_stop()) {
            drive.stop
                (Gio.MountUnmountFlags.FORCE, null, null,
                 Lang.bind(this, function(drive, res) {
                     try {
                         drive.stop_finish(res);
                     } catch (e) {
                         global.logError("Unable to stop the drive after drive-eject-button",  e);
                     }
                 }));
        } else if (drive.can_eject()) {
            drive.eject_with_operation 
                (Gio.MountUnmountFlags.FORCE, null, null,
                 Lang.bind(this, function(drive, res) {
                     try {
                         drive.eject_with_operation_finish(res);
                     } catch (e) {
                         global.logError("Unable to eject the drive after drive-eject-button", e);
                     }
                 }));
        }
    },

    _onVolumeAdded: function(monitor, volume) {
        this._checkAndMountVolume(volume);
    },

    _checkAndMountVolume: function(volume, params) {
        params = Params.parse(params, { checkSession: true,
                                        useMountOp: true });

        if (params.checkSession) {
            // if we're not in the current ConsoleKit session,
            // don't attempt automount
            if (!this.ckListener.sessionActive)
                return;

            if (this._ssProxy.screenSaverActive) {
                if (this._volumeQueue.indexOf(volume) == -1)
                    this._volumeQueue.push(volume);

                return;
            }
        }

        // Volume is already mounted, don't bother.
        if (volume.get_mount())
            return;

        if (!this._settings.get_boolean(SETTING_ENABLE_AUTOMOUNT) ||
            !volume.should_automount() ||
            !volume.can_mount()) {
            // allow the autorun to run anyway; this can happen if the
            // mount gets added programmatically later, even if 
            // should_automount() or can_mount() are false, like for
            // blank optical media.
            this._allowAutorun(volume);
            this._allowAutorunExpire(volume);

            return;
        }

        if (params.useMountOp) {
            let operation = new CinnamonMountOperation.CinnamonMountOperation(volume);
            this._mountVolume(volume, operation.mountOp);
        } else {
            this._mountVolume(volume, null);
        }
    },

    _mountVolume: function(volume, operation) {
        this._allowAutorun(volume);
        volume.mount(0, operation, null,
                     Lang.bind(this, this._onVolumeMounted));
    },

    _onVolumeMounted: function(volume, res) {
        this._allowAutorunExpire(volume);

        try {
            volume.mount_finish(res);
        } catch (e) {
            let string = e.toString();

            // FIXME: needs proper error code handling instead of this
            // See https://bugzilla.gnome.org/show_bug.cgi?id=591480
            if (string.indexOf('No key available with this passphrase') != -1)
                this._reaskPassword(volume);
            else
                log('Unable to mount volume ' + volume.get_name() + ': ' + string);
        }
    },

    _onVolumeRemoved: function(monitor, volume) {
        this._volumeQueue = 
            this._volumeQueue.filter(function(element) {
                return (element != volume);
            });
    },

    _reaskPassword: function(volume) {
        let operation = new CinnamonMountOperation.CinnamonMountOperation(volume, { reaskPassword: true });
        this._mountVolume(volume, operation.mountOp);        
    },

    _allowAutorun: function(volume) {
        volume.allowAutorun = true;
    },

    _allowAutorunExpire: function(volume) {
        Mainloop.timeout_add_seconds(AUTORUN_EXPIRE_TIMEOUT_SECS, function() {
            volume.allowAutorun = false;
            return false;
        });
    }
}
