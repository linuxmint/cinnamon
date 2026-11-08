// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const ByteArray = imports.byteArray;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;
const St = imports.gi.St;

const CinnamonMountOperation = imports.ui.cinnamonMountOperation;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Params = imports.misc.params;
const Util = imports.misc.util;

const DEBUG = false;

/**
 * Represents a place object, which is most normally a bookmark entry,
 * a mount/volume, or a special place like the Home Folder, Computer, and Network.
 *
 * @name: String title
 * @iconFactory: A JavaScript callback which will create an icon texture given a size parameter
 * @launch: A JavaScript callback to launch the entry
 */
function PlaceInfo(id, name, iconFactory, launch) {
    this._init(id, name, iconFactory, launch);
}

PlaceInfo.prototype = {
    _init: function(id, name, iconFactory, launch) {
        this.id = id;
        this.idDecoded = decodeURIComponent(this.id);
        this.name = name;
        this.iconFactory = iconFactory;
        this.launch = launch;
    },

    isRemovable: function() {
        return false;
    }
};

// Helper function to translate launch parameters into a GAppLaunchContext
function _makeLaunchContext(params)
{
    params = Params.parse(params, { workspace: -1,
                                    timestamp: 0 });

    let launchContext = global.create_app_launch_context();
    if (params.workspace != -1)
        launchContext.set_desktop(params.workspace);
    if (params.timestamp != 0)
        launchContext.set_timestamp(params.timestamp);

    return launchContext;
}

function PlaceDeviceInfo(mount) {
    this._init(mount);
}

PlaceDeviceInfo.prototype = {
    __proto__: PlaceInfo.prototype,

    _init: function(mount) {
        this._mount = mount;
        this.name = mount.get_name();
        this.id = 'mount:' + mount.get_root().get_uri();
        this.idDecoded = decodeURIComponent(this.id);

        this.busyWaitId = 0;
        this.destroySignalId = 0;
        this.busyNotification = null;
    },

    iconFactory: function(size) {
        let icon = this._mount.get_icon();
        return new St.Icon( { gicon: icon, icon_size: size });
    },

    launch: function(params) {
        Gio.app_info_launch_default_for_uri(this._mount.get_root().get_uri(),
                                            _makeLaunchContext(params));
    },

    isRemovable: function() {
        return this._mount.can_unmount();
    },

    remove: function() {
        if (this.busyWaitId > 0) {
            Mainloop.source_remove(this.busyWaitId);
            this.busyWaitId = 0;
        }

        if (this.busyNotification != null) {
            this.busyNotification.destroy();
        }

        this._tryRemove();
    },

    _tryRemove: function() {
        if (!this.isRemovable())
            return;

        let mountOp = new CinnamonMountOperation.CinnamonMountOperation();
        let drive = this._mount.get_drive();
        let volume = this._mount.get_volume();

        if (drive &&
            drive.get_start_stop_type() == Gio.DriveStartStopType.SHUTDOWN &&
            drive.can_stop()) {
            drive.stop(0, mountOp.mountOp, null, null);
        } else {
            if (drive && drive.can_eject())
                drive.eject_with_operation(0, mountOp.mountOp, null, null);
            else if (volume && volume.can_eject())
                volume.eject_with_operation(0, mountOp.mountOp, null, null);
            else if (this._mount.can_eject())
                this._mount.eject_with_operation(0, mountOp.mountOp, null, null);
            else if (this._mount.can_unmount())
                this._mount.unmount_with_operation(0, mountOp.mountOp, null, null);
        }

        this.busyWaitId = 0;
        return false;
    }
};

function PlacesManager() {
    this._init();
}

PlacesManager.prototype = {
    _init: function() {
        this._defaultPlaces = [];
        this._mounts = [];
        this._bookmarks = [];

        let homeFile = Gio.file_new_for_path (GLib.get_home_dir());
        let homeUri = homeFile.get_uri();
        let homeLabel = Cinnamon.util_get_label_for_uri (homeUri);
        let homeIcon = Cinnamon.util_get_icon_for_uri (homeUri);
        this._home = new PlaceInfo('special:home', homeLabel,
            function(size) {
                return new St.Icon({ gicon: homeIcon, icon_size: size });
            },
            function(params) {
                Gio.app_info_launch_default_for_uri(homeUri, _makeLaunchContext(params));
            });

        let desktopPath = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
        let desktopFile = Gio.file_new_for_path (desktopPath);
        let desktopUri = desktopFile.get_uri();
        let desktopLabel = Cinnamon.util_get_label_for_uri (desktopUri);
        let desktopIcon = Cinnamon.util_get_icon_for_uri (desktopUri);
        this._desktopMenu = new PlaceInfo('special:desktop', desktopLabel,
            function(size) {
                return new St.Icon({ gicon: desktopIcon, icon_size: size });
            },
            function(params) {
                Gio.app_info_launch_default_for_uri(desktopUri, _makeLaunchContext(params));
            });

        this._defaultPlaces.push(this._home);
        this._defaultPlaces.push(this._desktopMenu);

        /*
        * Show devices, code more or less ported from nemo-places-sidebar.c
        */
        this._volumeMonitor = Gio.VolumeMonitor.get();
        this._volumeMonitor.connect('volume-added', Lang.bind(this, this._onVolumeAdded));
        this._volumeMonitor.connect('volume-removed',Lang.bind(this, this._onVolumeRemoved));
        this._volumeMonitor.connect('volume-changed', Lang.bind(this, this._onVolumeChanged));
        this._volumeMonitor.connect('mount-added', Lang.bind(this, this._onMountAdded));
        this._volumeMonitor.connect('mount-removed', Lang.bind(this, this._onMountRemoved));
        this._volumeMonitor.connect('mount-changed', Lang.bind(this, this._onMountChanged));
        this._volumeMonitor.connect('drive-connected', Lang.bind(this, this._onDriveConnected));
        this._volumeMonitor.connect('drive-disconnected', Lang.bind(this, this._onDriveDisconnected));
        this._volumeMonitor.connect('drive-changed', Lang.bind(this, this._onDriveChanged));

        this._deviceUpdateAwaiting = false;

        this._updateDevices();

        this._bookmarksFile = null;
        this._bookmarksCancellable = null;

        let bookmarksPath3 = GLib.build_filenamev([GLib.get_user_config_dir(), 'gtk-3.0', 'bookmarks']);
        let bookmarksFile3 = Gio.file_new_for_path(bookmarksPath3);

        if (!bookmarksFile3.query_exists(null)) {
            let bookmarksPath2 = GLib.build_filenamev([GLib.get_home_dir(), '.gtk-bookmarks']);
            let bookmarksFile2 = Gio.file_new_for_path(bookmarksPath2);

            if (bookmarksFile2.query_exists(null)) {
                this._bookmarksFile = bookmarksFile2;
            }
        }

        if (this._bookmarksFile === null) {
            this._bookmarksFile = bookmarksFile3;
        }

        this._bookmarkTimeoutId = 0;

        this.monitor = this._bookmarksFile.monitor_file(Gio.FileMonitorFlags.NONE, null);
        this.monitor.connect('changed', () => {
            if (this._bookmarkTimeoutId > 0)
                return;
            /* Defensive event compression */
            this._bookmarkTimeoutId = Mainloop.timeout_add(100, () => {
                this._bookmarkTimeoutId = 0;
                this._reloadBookmarks();
                return GLib.SOURCE_REMOVE;
            });
        });

        this._reloadBookmarks();
    },

    // Mounting a device triggers a lot of different events, wait 3 seconds and try to only call this._updateDevices() once
    _updateDevicesAsync: function() {
        if (this._deviceUpdateAwaiting == false) {
            this._deviceUpdateAwaiting = true;
            Mainloop.timeout_add(3000, Lang.bind(this, function () {
                this._updateDevices();
            }));
        }
    },

    _onVolumeAdded: function() {
        this._updateDevicesAsync();
    },

    _onVolumeRemoved: function() {
        this._updateDevicesAsync();
    },

    _onVolumeChanged: function() {
        this._updateDevicesAsync();
    },

    _onMountAdded: function() {
        this._updateDevicesAsync();
    },

    _onMountRemoved: function() {
        this._updateDevicesAsync();
    },

    _onMountChanged: function() {
        this._updateDevicesAsync();
    },

    _onDriveConnected: function() {
        Main.soundManager.play('plug');
        this._updateDevicesAsync();
    },

    _onDriveDisconnected: function() {
        Main.soundManager.play('unplug');
        this._updateDevicesAsync();
    },

    _onDriveChanged: function() {
        this._updateDevicesAsync();
    },

    _updateDevices: function() {
        this._deviceUpdateAwaiting = false;
        if (DEBUG) global.log("PlacesManager: Updating devices");
        this._mounts = [];

        /* first go through all connected drives */
        let drives = this._volumeMonitor.get_connected_drives();
        for (let i = 0; i < drives.length; i++) {
            let volumes = drives[i].get_volumes();
            for(let j = 0; j < volumes.length; j++) {
                let mount = volumes[j].get_mount();
                if(mount != null) {
                    this._addMount(mount);
                }
            }
        }

        /* add all volumes that is not associated with a drive */
        let volumes = this._volumeMonitor.get_volumes();
        for(let i = 0; i < volumes.length; i++) {
            if(volumes[i].get_drive() != null)
                continue;

            let mount = volumes[i].get_mount();
            if(mount != null) {
                this._addMount(mount);
            }
        }

        /* add mounts that have no volume (/etc/mtab mounts, ftp, sftp,...) */
        let mounts = this._volumeMonitor.get_mounts();
        for(let i = 0; i < mounts.length; i++) {
            if(mounts[i].get_volume())
                continue;

            this._addMount(mounts[i]);
        }

        /* We emit two signals, one for a generic 'all places' update
         * and the other for one specific to mounts. We do this because
         * clients like PlaceDisplay may only care about places in general
         * being updated while clients like DashPlaceDisplay care which
         * specific type of place got updated.
         */
        this.emit('mounts-updated');
        this.emit('places-updated');

    },

    _reloadBookmarks: function() {
        if (this._bookmarksCancellable)
            this._bookmarksCancellable.cancel();

        const cancellable = new Gio.Cancellable();
        this._bookmarksCancellable = cancellable;

        this._bookmarksFile.load_contents_async(cancellable, (file, res) => {
            let content = '';
            try {
                const [, bytes] = file.load_contents_finish(res);
                content = ByteArray.toString(bytes);
            } catch (e) {
                if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                    return;
                // A missing or unreadable file simply means no bookmarks.
            }

            this._resolveBookmarks(this._parseBookmarks(content), cancellable);
        });
    },

    _parseBookmarks: function(content) {
        const seen = new Set();
        const entries = [];

        for (const line of content.split('\n')) {
            const components = line.split(' ');
            const uri = components[0];
            if (uri === '' || seen.has(uri))
                continue;

            seen.add(uri);
            entries.push({
                uri,
                label: components.length > 1 ? components.slice(1).join(' ') : null
            });
        }

        return entries;
    },

    _resolveBookmarks: function(entries, cancellable) {
        const items = new Array(entries.length).fill(null);
        let remaining = entries.length;

        const finish = () => {
            this._bookmarks = items.filter(item => item !== null);

            /* See comment in _updateDevices for explanation why there are two signals. */
            this.emit('bookmarks-updated');
            this.emit('places-updated');
        };

        if (remaining === 0) {
            finish();
            return;
        }

        entries.forEach((entry, i) => {
            const file = Gio.file_new_for_uri(entry.uri);
            file.query_info_async('standard::display-name,standard::icon,metadata::custom-icon',
                                  Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, cancellable,
                                  (file, res) => {
                let info = null;
                try {
                    info = file.query_info_finish(res);
                } catch (e) {
                    if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        return;
                }

                items[i] = this._makeBookmark(file, entry.uri, entry.label, info);
                if (--remaining === 0)
                    finish();
            });
        });
    },

    _makeBookmark: function(file, uri, label, info) {
        if (label === null) {
            if (file.has_uri_scheme('file'))
                label = Cinnamon.util_get_label_for_uri(uri);
            else if (info)
                label = info.get_display_name();
            else
                label = decodeURIComponent(uri.replace(/\/+$/, '').split('/').pop());
        }

        if (!label)
            return null;

        let icon, launch;
        if (info) {
            const customIcon = info.get_attribute_string('metadata::custom-icon');
            icon = customIcon ? Gio.icon_new_for_string(customIcon) : info.get_icon();
            launch = (params) => Gio.app_info_launch_default_for_uri(uri, _makeLaunchContext(params));
        } else {
            // Assume the bookmark is an unmounted network location
            // try to mount and open by the default file manager
            icon = Gio.ThemedIcon.new('network-workgroup');
            launch = (params) => {
                const fileapp = Gio.app_info_get_default_for_type('inode/directory', true);
                if (fileapp)
                    fileapp.launch_uris([uri], _makeLaunchContext(params));
            };
        }

        return new PlaceInfo('bookmark:' + uri, label,
                             (size) => new St.Icon({ gicon: icon, icon_size: size }),
                             launch);
    },

    _addMount: function(mount) {
        if(!mount.is_shadowed()) {
            let devItem = new PlaceDeviceInfo(mount);
            this._mounts.push(devItem);
        }
    },

    getAllPlaces: function () {
        return [...this.getDefaultPlaces(), ...this.getBookmarks(), ...this.getMounts()];
    },

    getDefaultPlaces: function () {
        return this._defaultPlaces;
    },

    getBookmarks: function () {
        return this._bookmarks;
    },

    getMounts: function () {
        return this._mounts;
    },

    _lookupIndexById: function(sourceArray, id) {
        for (let i = 0; i < sourceArray.length; i++) {
            let place = sourceArray[i];
            if (place.id == id)
                return i;
        }
        return -1;
    },

    lookupPlaceById: function(id) {
        let colonIdx = id.indexOf(':');
        let type = id.substring(0, colonIdx);
        let sourceArray = null;
        if (type == 'special')
            sourceArray = this._defaultPlaces;
        else if (type == 'mount')
            sourceArray = this._mounts;
        else if (type == 'bookmark')
            sourceArray = this._bookmarks;
        return sourceArray[this._lookupIndexById(sourceArray, id)];
    },

    _removeById: function(sourceArray, id) {
        sourceArray.splice(this._lookupIndexById(sourceArray, id), 1);
    }
};
Signals.addSignalMethods(PlacesManager.prototype);

