// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported Component */

const { Gio, GLib } = imports.gi;
const Params = imports.misc.params;

const LoginManager = imports.misc.loginManager;
const Main = imports.ui.main;
const CinnamonMountOperation = imports.ui.cinnamonMountOperation;

// GSettings keys
const SETTINGS_SCHEMA = 'org.cinnamon.desktop.media-handling';
const SETTING_ENABLE_AUTOMOUNT = 'automount';

var AUTORUN_EXPIRE_TIMEOUT_SECS = 10;

var AutomountManager = class {
    constructor() {
        this._settings = new Gio.Settings({ schema_id: SETTINGS_SCHEMA });
        this._activeOperations = new Map();
        this._volumeQueue = [];

        this._loginManager = LoginManager.getLoginManager();
        this._loginManager.connect('active-changed', (lm, active) => {
            if (active)
                this._drainVolumeQueue();
        });

        Main.screensaverController.connect('locked-changed', (ctrl, locked) => {
            if (!locked)
                this._drainVolumeQueue();
        });

        this._volumeMonitor = Gio.VolumeMonitor.get();
        this.enable();
    }

    enable() {
        this._volumeMonitor.connectObject(
            'volume-added', this._onVolumeAdded.bind(this),
            'volume-removed', this._onVolumeRemoved.bind(this),
            'drive-connected', this._onDriveConnected.bind(this),
            'drive-disconnected', this._onDriveDisconnected.bind(this),
            'drive-eject-button', this._onDriveEjectButton.bind(this), this);

        this._mountAllId = GLib.idle_add(GLib.PRIORITY_DEFAULT, this._startupMountAll.bind(this));
        GLib.Source.set_name_by_id(this._mountAllId, '[cinnamon] this._startupMountAll');
    }

    disable() {
        this._volumeMonitor.disconnectObject(this);

        if (this._mountAllId > 0) {
            GLib.source_remove(this._mountAllId);
            this._mountAllId = 0;
        }
    }

    _drainVolumeQueue() {
        while (this._volumeQueue.length > 0) {
            let volume = this._volumeQueue.shift();
            this._checkAndMountVolume(volume, {
                checkSession: false,
            });
        }
    }

    _startupMountAll() {
        let volumes = this._volumeMonitor.get_volumes();
        volumes.forEach(volume => {
            this._checkAndMountVolume(volume, {
                checkSession: false,
                useMountOp: false,
                allowAutorun: false,
            });
        });

        this._mountAllId = 0;
        return GLib.SOURCE_REMOVE;
    }

    _onDriveConnected() {
        if (!this._loginManager.sessionIsActive)
            return;

        let player = global.display.get_sound_player();
        player.play_from_theme('device-added-media',
                               _("External drive connected"),
                               null);
    }

    _onDriveDisconnected() {
        if (!this._loginManager.sessionIsActive)
            return;

        let player = global.display.get_sound_player();
        player.play_from_theme('device-removed-media',
                               _("External drive disconnected"),
                               null);
    }

    _onDriveEjectButton(monitor, drive) {
        if (!this._loginManager.sessionIsActive)
            return;

        if (drive.can_stop()) {
            drive.stop(Gio.MountUnmountFlags.FORCE, null, null,
                (o, res) => {
                    try {
                        drive.stop_finish(res);
                    } catch (e) {
                        log(`Unable to stop the drive after drive-eject-button ${e.toString()}`);
                    }
                });
        } else if (drive.can_eject()) {
            drive.eject_with_operation(Gio.MountUnmountFlags.FORCE, null, null,
                (o, res) => {
                    try {
                        drive.eject_with_operation_finish(res);
                    } catch (e) {
                        log(`Unable to eject the drive after drive-eject-button ${e.toString()}`);
                    }
                });
        }
    }

    _onVolumeAdded(monitor, volume) {
        this._checkAndMountVolume(volume);
    }

    _checkAndMountVolume(volume, params) {
        params = Params.parse(params, {
            checkSession: true,
            useMountOp: true,
            allowAutorun: true,
        });

        if (params.checkSession) {
            if (!this._loginManager.sessionIsActive)
                return;

            if (Main.screensaverController.locked) {
                this._volumeQueue.push(volume);
                return;
            }
        }

        if (volume.get_mount())
            return;

        if (!this._settings.get_boolean(SETTING_ENABLE_AUTOMOUNT) ||
            !volume.should_automount() ||
            !volume.can_mount()) {
            this._allowAutorun(volume);
            this._allowAutorunExpire(volume);

            return;
        }

        if (params.useMountOp) {
            let operation = new CinnamonMountOperation.CinnamonMountOperation(volume);
            this._mountVolume(volume, operation, params.allowAutorun);
        } else {
            this._mountVolume(volume, null, params.allowAutorun);
        }
    }

    _mountVolume(volume, operation, allowAutorun) {
        if (allowAutorun)
            this._allowAutorun(volume);

        const mountOp = operation?.mountOp ?? null;
        this._activeOperations.set(volume, operation);

        volume.mount(0, mountOp, null,
                     this._onVolumeMounted.bind(this));
    }

    _onVolumeMounted(volume, res) {
        this._allowAutorunExpire(volume);

        try {
            volume.mount_finish(res);
            this._closeOperation(volume);
        } catch (e) {
            // Errors here do not have any specific codes we can parse, but the error message
            // comes from udisks and will not be translated, so should be reliable (used this way
            // in other projects as well).
            if (e.message.includes('No key available with this passphrase') ||
                e.message.includes('No key available to unlock device') ||
                e.message.includes('Failed to activate device: Incorrect passphrase') ||
                e.message.includes('Failed to load device\'s parameters: Invalid argument')) {
                this._reaskPassword(volume);
            } else {
                if (e.message.includes('Compiled against a version of libcryptsetup that does not support the VeraCrypt PIM setting')) {
                    Main.notifyError(_("Unable to unlock volume"),
                        _("The installed udisks version does not support the PIM setting"));
                }

                if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.FAILED_HANDLED))
                    log(`Unable to mount volume ${volume.get_name()}: ${e.toString()}`);
                this._closeOperation(volume);
            }
        }
    }

    _onVolumeRemoved(monitor, volume) {
        if (volume._allowAutorunExpireId && volume._allowAutorunExpireId > 0) {
            GLib.source_remove(volume._allowAutorunExpireId);
            delete volume._allowAutorunExpireId;
        }

        this._volumeQueue = this._volumeQueue.filter(v => v !== volume);
    }

    _reaskPassword(volume) {
        let prevOperation = this._activeOperations.get(volume);
        const existingDialog = prevOperation?.borrowDialog();
        let operation =
            new CinnamonMountOperation.CinnamonMountOperation(volume, { existingDialog });
        this._mountVolume(volume, operation);
    }

    _closeOperation(volume) {
        let operation = this._activeOperations.get(volume);
        if (!operation)
            return;
        operation.close();
        this._activeOperations.delete(volume);
    }

    _allowAutorun(volume) {
        volume.allowAutorun = true;
    }

    _allowAutorunExpire(volume) {
        if (volume._allowAutorunExpireId && volume._allowAutorunExpireId > 0) {
            GLib.source_remove(volume._allowAutorunExpireId);
            delete volume._allowAutorunExpireId;
        }

        let id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, AUTORUN_EXPIRE_TIMEOUT_SECS, () => {
            volume.allowAutorun = false;
            delete volume._allowAutorunExpireId;
            return GLib.SOURCE_REMOVE;
        });
        volume._allowAutorunExpireId = id;
        GLib.Source.set_name_by_id(id, '[cinnamon] volume.allowAutorun');
    }
};
