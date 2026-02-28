// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported Component */

const { Gio, GLib } = imports.gi;
const Params = imports.misc.params;

const GnomeSession = imports.misc.gnomeSession;
const Main = imports.ui.main;
const CinnamonMountOperation = imports.ui.cinnamonMountOperation;

var GNOME_SESSION_AUTOMOUNT_INHIBIT = 16;

// GSettings keys
const SETTINGS_SCHEMA = 'org.cinnamon.desktop.media-handling';
const SETTING_ENABLE_AUTOMOUNT = 'automount';

var AUTORUN_EXPIRE_TIMEOUT_SECS = 10;

var AutomountManager = class {
    constructor() {
        this._settings = new Gio.Settings({ schema_id: SETTINGS_SCHEMA });
        this._activeOperations = new Map();
        
        GnomeSession.SessionManager((proxy, error) => {
            if (error)
                return;

            this._session = proxy;
            this.actor.show();
            this.updateStatus();

            this._session.connectSignal(
                "InhibitorAdded",
                this._InhibitorsChanged.bind(this)
            );

            this._session.connectSignal(
                "InhibitorRemoved",
                this._InhibitorsChanged.bind(this)
            );
        });

        this._inhibited = false;

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

    async _InhibitorsChanged(_object, _senderName, [_inhibitor]) {
        try {
            const [inhibited] =
                await this._session.IsInhibitedAsync(GNOME_SESSION_AUTOMOUNT_INHIBIT);
            this._inhibited = inhibited;
        } catch (e) {}
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
        // if we're not in the current ConsoleKit session,
        // or screensaver is active, don't play sounds
        // if (!this._session.SessionIsActive)
        //     return;

        let player = global.display.get_sound_player();
        player.play_from_theme('device-added-media',
                               _("External drive connected"),
                               null);
    }

    _onDriveDisconnected() {
        // if we're not in the current ConsoleKit session,
        // or screensaver is active, don't play sounds
        // if (!this._session.SessionIsActive)
        //     return;

        let player = global.display.get_sound_player();
        player.play_from_theme('device-removed-media',
                               _("External drive disconnected"),
                               null);
    }

    _onDriveEjectButton(monitor, drive) {
        // TODO: this code path is not tested, as the GVfs volume monitor
        // doesn't emit this signal just yet.
        // if (!this._session.SessionIsActive)
        //     return;

        // we force stop/eject in this case, so we don't have to pass a
        // mount operation object
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
        global.log("check and mount");
        params = Params.parse(params, {
            checkSession: true,
            useMountOp: true,
            allowAutorun: true,
        });

        if (params.checkSession) {
            // if we're not in the current ConsoleKit session,
            // don't attempt automount
            // if (!this._session.SessionIsActive)
            //     return;
        }

        if (this._inhibited)
            return;

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
        global.log("on volume mounted");
        this._allowAutorunExpire(volume);

        try {
            volume.mount_finish(res);
            this._closeOperation(volume);
        } catch (e) {
            // FIXME: we will always get G_IO_ERROR_FAILED from the gvfs udisks
            // backend, see https://bugs.freedesktop.org/show_bug.cgi?id=51271
            // To reask the password if the user input was empty or wrong, we
            // will check for corresponding error messages. However, these
            // error strings are not unique for the cases in the comments below.
            if (e.message.includes('No key available with this passphrase') || // cryptsetup
                e.message.includes('No key available to unlock device') ||     // udisks (no password)
                // libblockdev wrong password opening LUKS device
                e.message.includes('Failed to activate device: Incorrect passphrase') ||
                // cryptsetup returns EINVAL in many cases, including wrong TCRYPT password/parameters
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
        let id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, AUTORUN_EXPIRE_TIMEOUT_SECS, () => {
            volume.allowAutorun = false;
            delete volume._allowAutorunExpireId;
            return GLib.SOURCE_REMOVE;
        });
        volume._allowAutorunExpireId = id;
        GLib.Source.set_name_by_id(id, '[cinnamon] volume.allowAutorun');
    }
};
