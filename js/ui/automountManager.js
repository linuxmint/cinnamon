// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported Component */

const { Gio, GLib, St } = imports.gi;
const Params = imports.misc.params;

const LoginManager = imports.misc.loginManager;
const Main = imports.ui.main;
const CinnamonMountOperation = imports.ui.cinnamonMountOperation;

// GSettings keys
const SETTINGS_SCHEMA = 'org.cinnamon.desktop.media-handling';
const SETTING_ENABLE_AUTOMOUNT = 'automount';

var AUTORUN_EXPIRE_TIMEOUT_SECS = 10;

// A device with a failing connector can produce repeated connect/disconnect
// cycles, so warn at most once per device within this window.
var UNSAFE_REMOVAL_WARNING_TIMEOUT_SECS = 60;

// Reports a device that was unplugged while still mounted. This is delivered as
// a notification rather than a modal dialog: the user did not ask for it, so it
// belongs with the unmount progress notifications (CinnamonUnmountNotifier)
// rather than with the dialogs used for password or busy-device prompts.
function notifyUnsafeRemoval(driveName) {
    let body;
    if (driveName) {
        body = _("“%s” was unplugged before it was safely removed.").format(driveName);
    } else {
        body = _("A device was unplugged before it was safely removed.");
    }

    body += '\n\n';
    // Not just files being written at that moment: the kernel can hold changes
    // in the page cache long after a copy appears to be finished, and
    // interrupted metadata updates can damage the whole filesystem.
    body += _("The data on it may be lost or damaged. Even when no file seems to be in use, the system can still have changes waiting to be written to the device.");

    body += '\n\n';
    // Safe removal and eject both act on the drive, so gvfs notifies
    // "... can be safely unplugged" once either one completes. Safe removal is
    // named first because it powers the device off (what the drives applet does
    // through PlaceDeviceItem._tryRemove), while eject leaves it powered and the
    // kernel re-enumerates it, which looks to the user as if nothing happened.
    body += _("Next time, use “Safely Remove Drive” (or “Eject”) from the device menu, and unplug the device only once you are told that it can be removed.");

    let icon = new St.Icon({
        icon_name: 'xsi-media-removable',
        icon_type: St.IconType.SYMBOLIC,
        icon_size: 24,
    });

    // Not transient: the device is already gone, so the warning is only useful
    // if it waits in the tray for the user to actually read it.
    Main.criticalNotify(_("Device removed unsafely"), body, icon);
}

var AutomountManager = class {
    constructor() {
        this._settings = new Gio.Settings({ schema_id: SETTINGS_SCHEMA });
        this._activeOperations = new Map();
        this._volumeQueue = [];
        // mount root path -> drive key, for mounts that are still live
        this._mountedDrives = new Map();
        // driveKey -> timeout id, suppressing repeated warnings
        this._unsafeRemovalWarnings = new Map();

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
            'mount-added', this._onMountAdded.bind(this),
            'mount-removed', this._onMountRemoved.bind(this),
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

        this._unsafeRemovalWarnings.forEach(id => GLib.source_remove(id));
        this._unsafeRemovalWarnings.clear();
        this._mountedDrives.clear();
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
        // Mounts that already existed when we started (e.g. after a Cinnamon
        // restart) never emit mount-added, so seed the cache with them.
        this._volumeMonitor.get_mounts().forEach(mount => {
            this._trackMount(mount);
        });

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

    _onDriveDisconnected(monitor, drive) {
        if (!this._loginManager.sessionIsActive)
            return;

        let player = global.display.get_sound_player();
        player.play_from_theme('device-removed-media',
                               _("External drive disconnected"),
                               null);

        this._checkUnsafeRemoval(drive);
    }

    // A GMount has no volume left by the time mount-removed is emitted, so the
    // cache is keyed on the mount point instead.
    _mountKey(mount) {
        const root = mount.get_root();
        if (!root)
            return null;

        return root.get_path() ?? root.get_uri();
    }

    // The device node can be reassigned across a reconnect (sda -> sdb) and the
    // GObject instance is always a new one, so identify a drive by its name.
    _driveKey(drive) {
        return drive.get_name() ??
               drive.get_identifier(Gio.DRIVE_IDENTIFIER_KIND_UNIX_DEVICE);
    }

    _trackMount(mount) {
        const drive = mount.get_drive();

        // Only hotpluggable devices can be pulled out from under us.
        if (!drive || !drive.is_removable())
            return;

        const key = this._mountKey(mount);
        if (key === null)
            return;

        this._mountedDrives.set(key, this._driveKey(drive));
    }

    _onMountAdded(monitor, mount) {
        this._trackMount(mount);
    }

    _onMountRemoved(monitor, mount) {
        const key = this._mountKey(mount);
        if (key !== null)
            this._mountedDrives.delete(key);
    }

    // Detects a device that was physically unplugged while still mounted.
    //
    // This relies on the order in which GVfs emits its removal signals: in
    // gvfsudisks2volumemonitor.c, update_all() emits drive-disconnected before
    // volume-removed and mount-removed for everything that vanished in the same
    // update. So when a device is pulled out, its mounts are still in the cache
    // at this point, while a device that was unmounted or ejected first had its
    // mount-removed delivered by an earlier update and left the cache empty.
    //
    // Verified by tracing GVolumeMonitor against a USB stick on GVfs 1.54:
    // unplugging while mounted leaves the mounts in the cache here, whereas
    // eject, safe removal and a plain unmount all leave it empty.
    _checkUnsafeRemoval(drive) {
        if (!drive)
            return;

        const driveKey = this._driveKey(drive);
        let removedMounts = 0;

        for (let [mountKey, key] of this._mountedDrives) {
            if (key !== driveKey)
                continue;

            this._mountedDrives.delete(mountKey);
            removedMounts++;
        }

        if (removedMounts === 0)
            return;

        if (this._unsafeRemovalWarnings.has(driveKey))
            return;

        const id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT,
            UNSAFE_REMOVAL_WARNING_TIMEOUT_SECS, () => {
                this._unsafeRemovalWarnings.delete(driveKey);
                return GLib.SOURCE_REMOVE;
            });
        this._unsafeRemovalWarnings.set(driveKey, id);
        GLib.Source.set_name_by_id(id, '[cinnamon] unsafe removal warning');

        notifyUnsafeRemoval(drive.get_name());
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
