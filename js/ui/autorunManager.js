// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const DBus = imports.dbus;
const Gio = imports.gi.Gio;
const St = imports.gi.St;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const CinnamonMountOperation = imports.ui.cinnamonMountOperation;

// GSettings keys
const SETTINGS_SCHEMA = 'org.gnome.desktop.media-handling';
const SETTING_DISABLE_AUTORUN = 'autorun-never';
const SETTING_START_APP = 'autorun-x-content-start-app';
const SETTING_IGNORE = 'autorun-x-content-ignore';
const SETTING_OPEN_FOLDER = 'autorun-x-content-open-folder';

const AutorunSetting = {
    RUN: 0,
    IGNORE: 1,
    FILES: 2,
    ASK: 3
};

// misc utils
function ignoreAutorunForMount(mount) {
    let root = mount.get_root();
    let volume = mount.get_volume();

    if ((root.is_native() && !isMountRootHidden(root)) ||
        (volume && volume.allowAutorun && volume.should_automount()))
        return false;

    return true;
}

function isMountRootHidden(root) {
    let path = root.get_path();

    // skip any mounts in hidden directory hierarchies
    return (path.indexOf('/.') != -1);
}

function startAppForMount(app, mount) {
    let files = [];
    let root = mount.get_root();
    let retval = false;

    files.push(root);

    try {
        retval = app.launch(files, 
                            global.create_app_launch_context())
    } catch (e) {
        global.logError('Unable to launch the application ' + app.get_name(), e);
    }

    return retval;
}

/******************************************/

const HotplugSnifferIface = {
    name: 'org.Cinnamon.HotplugSniffer',
    methods: [{ name: 'SniffURI',
                inSignature: 's',
                outSignature: 'as' }]
};

const HotplugSniffer = function() {
    this._init();
};

HotplugSniffer.prototype = {
    _init: function() {
        DBus.session.proxifyObject(this,
                                   'org.Cinnamon.HotplugSniffer',
                                   '/org/Cinnamon/HotplugSniffer');
    },
};
DBus.proxifyPrototype(HotplugSniffer.prototype, HotplugSnifferIface);

function ContentTypeDiscoverer(callback) {
    this._init(callback);
}

ContentTypeDiscoverer.prototype = {
    _init: function(callback) {
        this._callback = callback;
    },

    guessContentTypes: function(mount) {
        // guess mount's content types using GIO
        mount.guess_content_type(false, null,
                                 Lang.bind(this,
                                           this._onContentTypeGuessed));
    },

    _onContentTypeGuessed: function(mount, res) {
        let contentTypes = [];

        try {
            contentTypes = mount.guess_content_type_finish(res);
        } catch (e) {
            global.logError('Unable to guess content types on added mount ' + mount.get_name(), e);
        }

        if (contentTypes.length) {
            this._emitCallback(mount, contentTypes);
        } else {
            let root = mount.get_root();

            let hotplugSniffer = new HotplugSniffer();
            hotplugSniffer.SniffURIRemote
                (root.get_uri(), DBus.CALL_FLAG_START,
                 Lang.bind(this, function(contentTypes) {
                     this._emitCallback(mount, contentTypes);
                 }));
        }
    },

    _emitCallback: function(mount, contentTypes) {
        if (!contentTypes)
            contentTypes = [];

        // we're not interested in win32 software content types here
        contentTypes = contentTypes.filter(function(type) {
            return (type != 'x-content/win32-software');
        });

        let apps = [];
        contentTypes.forEach(function(type) {
            let app = Gio.app_info_get_default_for_type(type, false);

            if (app)
                apps.push(app);
        });

        if (apps.length == 0)
            apps.push(Gio.app_info_get_default_for_type('inode/directory', false));

        this._callback(mount, apps, contentTypes);
    }
}

function AutorunManager() {
    this._init();
}

AutorunManager.prototype = {
    _init: function() {
        this._volumeMonitor = Gio.VolumeMonitor.get();

        this._volumeMonitor.connect('mount-added',
                                    Lang.bind(this,
                                              this._onMountAdded));
        this._volumeMonitor.connect('mount-removed',
                                    Lang.bind(this,
                                              this._onMountRemoved));

        this._transDispatcher = new AutorunTransientDispatcher();
        this._createResidentSource();

        let mounts = this._volumeMonitor.get_mounts();

        mounts.forEach(Lang.bind(this, function (mount) {
            let discoverer = new ContentTypeDiscoverer(Lang.bind (this, 
                function (mount, apps) {
                    this._residentSource.addMount(mount, apps);
                }));

            discoverer.guessContentTypes(mount);
        }));
    },

    _createResidentSource: function() {
        this._residentSource = new AutorunResidentSource();
        this._residentSource.connect('destroy',
                                     Lang.bind(this,
                                               this._createResidentSource));
    },

    _onMountAdded: function(monitor, mount) {
        // don't do anything if our session is not the currently
        // active one
        if (!Main.automountManager.ckListener.sessionActive)
            return;

        let discoverer = new ContentTypeDiscoverer(Lang.bind (this,
            function (mount, apps, contentTypes) {
                this._transDispatcher.addMount(mount, apps, contentTypes);
                this._residentSource.addMount(mount, apps);
            }));

        discoverer.guessContentTypes(mount);
    },

    _onMountRemoved: function(monitor, mount) {
        this._transDispatcher.removeMount(mount);
        this._residentSource.removeMount(mount);
    },

    ejectMount: function(mount) {
        let mountOp = new CinnamonMountOperation.CinnamonMountOperation(mount);

        // first, see if we have a drive
        let drive = mount.get_drive();
        let volume = mount.get_volume();

        if (drive &&
            drive.get_start_stop_type() == Gio.DriveStartStopType.SHUTDOWN &&
            drive.can_stop()) {
            drive.stop(0, mountOp.mountOp, null,
                       Lang.bind(this, this._onStop));
        } else {
            if (mount.can_eject()) {
                mount.eject_with_operation(0, mountOp.mountOp, null,
                                           Lang.bind(this, this._onEject));
            } else if (volume && volume.can_eject()) {
                volume.eject_with_operation(0, mountOp.mountOp, null,
                                            Lang.bind(this, this._onEject));
            } else if (drive && drive.can_eject()) {
                drive.eject_with_operation(0, mountOp.mountOp, null,
                                           Lang.bind(this, this._onEject));
            } else if (mount.can_unmount()) {
                mount.unmount_with_operation(0, mountOp.mountOp, null,
                                             Lang.bind(this, this._onUnmount));
            }
        }
    },

    _onUnmount: function(mount, res) {
        try {
            mount.unmount_with_operation_finish(res);
        } catch (e) {
            // FIXME: we need to ignore G_IO_ERROR_FAILED_HANDLED errors here
            // but we can't access the error code from JS.
            // See https://bugzilla.gnome.org/show_bug.cgi?id=591480
            global.logError('Unable to eject the mount ' + mount.get_name() , e);
        }
    },

    _onEject: function(source, res) {
        try {
            source.eject_with_operation_finish(res);
        } catch (e) {
            // FIXME: we need to ignore G_IO_ERROR_FAILED_HANDLED errors here
            // but we can't access the error code from JS.
            // See https://bugzilla.gnome.org/show_bug.cgi?id=591480
            global.logError('Unable to eject the drive ' + source.get_name(), e);
        }
    },

    _onStop: function(drive, res) {
        try {
            drive.stop_finish(res);
        } catch (e) {
            // FIXME: we need to ignore G_IO_ERROR_FAILED_HANDLED errors here
            // but we can't access the error code from JS.
            // See https://bugzilla.gnome.org/show_bug.cgi?id=591480
            global.logError('Unable to stop the drive ' + drive.get_name(), e);
        }
    },
}

function AutorunResidentSource() {
    this._init();
}

AutorunResidentSource.prototype = {
    __proto__: MessageTray.Source.prototype,

    _init: function() {
        MessageTray.Source.prototype._init.call(this, _("Removable Devices"));

        this._mounts = [];

        this._notification = new AutorunResidentNotification(this);
        this._setSummaryIcon(this.createNotificationIcon());
    },

    addMount: function(mount, apps) {
        if (ignoreAutorunForMount(mount))
            return;

        let filtered = this._mounts.filter(function (element) {
            return (element.mount == mount);
        });

        if (filtered.length != 0)
            return;

        let element = { mount: mount, apps: apps };
        this._mounts.push(element);
        this._redisplay();
    },

    removeMount: function(mount) {
        this._mounts =
            this._mounts.filter(function (element) {
                return (element.mount != mount);
            });

        this._redisplay();
    },

    _redisplay: function() {
        if (this._mounts.length == 0) {
            this._notification.destroy();
            this.destroy();

            return;
        }

        this._notification.updateForMounts(this._mounts);

        // add ourselves as a source, and push the notification
        if (Main.messageTray && !Main.messageTray.contains(this)) {
            Main.messageTray.add(this);
            this.pushNotification(this._notification);
        }
    },

    createNotificationIcon: function() {
        return new St.Icon ({ icon_name: 'media-removable',
                              icon_type: St.IconType.FULLCOLOR,
                              icon_size: this.ICON_SIZE });
    }
}

function AutorunResidentNotification(source) {
    this._init(source);
}

AutorunResidentNotification.prototype = {
    __proto__: MessageTray.Notification.prototype,

    _init: function(source) {
        MessageTray.Notification.prototype._init.call(this, source,
                                                      source.title, null,
                                                      { customContent: true });

        // set the notification as resident
        this.setResident(true);

        this._layout = new St.BoxLayout ({ style_class: 'hotplug-resident-box',
                                           vertical: true });

        this.addActor(this._layout,
                      { x_expand: true,
                        x_fill: true });
    },

    updateForMounts: function(mounts) {
        // remove all the layout content
        this._layout.destroy_children();

        for (let idx = 0; idx < mounts.length; idx++) {
            let element = mounts[idx];

            let actor = this._itemForMount(element.mount, element.apps);
            this._layout.add(actor, { x_fill: true,
                                      expand: true });
        }
    },

    _itemForMount: function(mount, apps) {
        let item = new St.BoxLayout();

        // prepare the mount button content
        let mountLayout = new St.BoxLayout();

        let mountIcon = new St.Icon({ gicon: mount.get_icon(),
                                      style_class: 'hotplug-resident-mount-icon' });
        mountLayout.add_actor(mountIcon);

        let labelBin = new St.Bin({ y_align: St.Align.MIDDLE });
        let mountLabel =
            new St.Label({ text: mount.get_name(),
                           style_class: 'hotplug-resident-mount-label',
                           track_hover: true,
                           reactive: true });
        labelBin.add_actor(mountLabel);
        mountLayout.add_actor(labelBin);

        let mountButton = new St.Button({ child: mountLayout,
                                          x_align: St.Align.START,
                                          x_fill: true,
                                          style_class: 'hotplug-resident-mount',
                                          button_mask: St.ButtonMask.ONE });
        item.add(mountButton, { x_align: St.Align.START,
                                expand: true });

        let ejectIcon = 
            new St.Icon({ icon_name: 'media-eject',
                          style_class: 'hotplug-resident-eject-icon' });

        let ejectButton =
            new St.Button({ style_class: 'hotplug-resident-eject-button',
                            button_mask: St.ButtonMask.ONE,
                            child: ejectIcon });
        item.add(ejectButton, { x_align: St.Align.END });

        // now connect signals
        mountButton.connect('clicked', Lang.bind(this, function(actor, event) {
            startAppForMount(apps[0], mount);
        }));

        ejectButton.connect('clicked', Lang.bind(this, function() {
            Main.autorunManager.ejectMount(mount);
        }));

        return item;
    },
}

function AutorunTransientDispatcher() {
    this._init();
}

AutorunTransientDispatcher.prototype = {
    _init: function() {
        this._sources = [];
        this._settings = new Gio.Settings({ schema: SETTINGS_SCHEMA });
    },

    _getAutorunSettingForType: function(contentType) {
        let runApp = this._settings.get_strv(SETTING_START_APP);
        if (runApp.indexOf(contentType) != -1)
            return AutorunSetting.RUN;

        let ignore = this._settings.get_strv(SETTING_IGNORE);
        if (ignore.indexOf(contentType) != -1)
            return AutorunSetting.IGNORE;

        let openFiles = this._settings.get_strv(SETTING_OPEN_FOLDER);
        if (openFiles.indexOf(contentType) != -1)
            return AutorunSetting.FILES;

        return AutorunSetting.ASK;
    },

    _getSourceForMount: function(mount) {
        let filtered =
            this._sources.filter(function (source) {
                return (source.mount == mount);
            });

        // we always make sure not to add two sources for the same
        // mount in addMount(), so it's safe to assume filtered.length
        // is always either 1 or 0.
        if (filtered.length == 1)
            return filtered[0];

        return null;
    },

    _addSource: function(mount, apps) {
        // if we already have a source showing for this 
        // mount, return
        if (this._getSourceForMount(mount))
            return;
     
        // add a new source
        this._sources.push(new AutorunTransientSource(mount, apps));
    },

    addMount: function(mount, apps, contentTypes) {
        // if autorun is disabled globally, return
        if (this._settings.get_boolean(SETTING_DISABLE_AUTORUN))
            return;

        // if the mount doesn't want to be autorun, return
        if (ignoreAutorunForMount(mount))
            return;

        let setting = this._getAutorunSettingForType(contentTypes[0]);

        // check at the settings for the first content type
        // to see whether we should ask
        if (setting == AutorunSetting.IGNORE)
            return; // return right away

        let success = false;
        let app = null;

        if (setting == AutorunSetting.RUN) {
            app = Gio.app_info_get_default_for_type(contentTypes[0], false);
        } else if (setting == AutorunSetting.FILES) {
            app = Gio.app_info_get_default_for_type('inode/directory', false);
        }

        if (app)
            success = startAppForMount(app, mount);

        // we fallback here also in case the settings did not specify 'ask',
        // but we failed launching the default app or the default file manager
        if (!success)
            this._addSource(mount, apps);
    },

    removeMount: function(mount) {
        let source = this._getSourceForMount(mount);
        
        // if we aren't tracking this mount, don't do anything
        if (!source)
            return;

        // destroy the notification source
        source.destroy();
    }
}

function AutorunTransientSource(mount, apps) {
    this._init(mount, apps);
}

AutorunTransientSource.prototype = {
    __proto__: MessageTray.Source.prototype,

    _init: function(mount, apps) {
        MessageTray.Source.prototype._init.call(this, mount.get_name());

        this.mount = mount;
        this.apps = apps;

        this._notification = new AutorunTransientNotification(this);
        this._setSummaryIcon(this.createNotificationIcon());

        // add ourselves as a source, and popup the notification
        if (Main.messageTray) Main.messageTray.add(this);
        this.notify(this._notification);
    },

    createNotificationIcon: function() {
        return new St.Icon({ gicon: this.mount.get_icon(),
                             icon_size: this.ICON_SIZE });
    }
}

function AutorunTransientNotification(source) {
    this._init(source);
}

AutorunTransientNotification.prototype = {
    __proto__: MessageTray.Notification.prototype,

    _init: function(source) {
        MessageTray.Notification.prototype._init.call(this, source,
                                                      source.title, null,
                                                      { customContent: true });

        this._box = new St.BoxLayout({ style_class: 'hotplug-transient-box',
                                       vertical: true });
        this.addActor(this._box);

        this._mount = source.mount;

        source.apps.forEach(Lang.bind(this, function (app) {
            let actor = this._buttonForApp(app);

            if (actor)
                this._box.add(actor, { x_fill: true,
                                       x_align: St.Align.START });
        }));

        this._box.add(this._buttonForEject(), { x_fill: true,
                                                x_align: St.Align.START });

        // set the notification to transient and urgent, so that it
        // expands out
        this.setTransient(true);
        this.setUrgency(MessageTray.Urgency.CRITICAL);
    },

    _buttonForApp: function(app) {
        let box = new St.BoxLayout();
        let icon = new St.Icon({ gicon: app.get_icon(),
                                 style_class: 'hotplug-notification-item-icon' });
        box.add(icon);

        let label = new St.Bin({ y_align: St.Align.MIDDLE,
                                 child: new St.Label
                                 ({ text: _("Open with %s").format(app.get_display_name()) })
                               });
        box.add(label);

        let button = new St.Button({ child: box,
                                     x_fill: true,
                                     x_align: St.Align.START,
                                     button_mask: St.ButtonMask.ONE,
                                     style_class: 'hotplug-notification-item' });

        button.connect('clicked', Lang.bind(this, function() {
            startAppForMount(app, this._mount);
            this.destroy();
        }));

        return button;
    },

    _buttonForEject: function() {
        let box = new St.BoxLayout();
        let icon = new St.Icon({ icon_name: 'media-eject',
                                 style_class: 'hotplug-notification-item-icon' });
        box.add(icon);

        let label = new St.Bin({ y_align: St.Align.MIDDLE,
                                 child: new St.Label
                                 ({ text: _("Eject") })
                               });
        box.add(label);

        let button = new St.Button({ child: box,
                                     x_fill: true,
                                     x_align: St.Align.START,
                                     button_mask: St.ButtonMask.ONE,
                                     style_class: 'hotplug-notification-item' });

        button.connect('clicked', Lang.bind(this, function() {
            Main.autorunManager.ejectMount(this._mount);
        }));

        return button;
    }
}

