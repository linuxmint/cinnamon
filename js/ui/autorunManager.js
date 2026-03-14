// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported Component */

const { Clutter, Gio, GObject, Pango, St } = imports.gi;

const CheckBox = imports.ui.checkBox;
const Dialog = imports.ui.dialog;
const ModalDialog = imports.ui.modalDialog;

const hotplugSnifferIface =
' \
<node> \
  <interface name="org.Cinnamon.HotplugSniffer"> \
    <method name="SniffURI"> \
      <arg type="s" name="uri" direction="in"/> \
      <arg type="as" name="content_types" direction="out"/> \
    </method> \
  </interface> \
</node> \
';

// GSettings keys
const SETTINGS_SCHEMA = 'org.cinnamon.desktop.media-handling';
const SETTING_DISABLE_AUTORUN = 'autorun-never';
const SETTING_START_APP = 'autorun-x-content-start-app';
const SETTING_IGNORE = 'autorun-x-content-ignore';
const SETTING_OPEN_FOLDER = 'autorun-x-content-open-folder';
const SETTING_AUTOMOUNT_OPEN = 'automount-open';

var AutorunSetting = {
    RUN: 0,
    IGNORE: 1,
    FILES: 2,
    ASK: 3,
};

const AUTORUN_ITEM_APP = 0;
const AUTORUN_ITEM_OPEN_FOLDER = 1;
const AUTORUN_ITEM_DO_NOTHING = 2;

var LIST_ITEM_ICON_SIZE = 36;

function shouldAutorunMount(mount) {
    let root = mount.get_root();
    let volume = mount.get_volume();

    if (!volume || !volume.allowAutorun)
        return false;

    // Consume the flag so subsequent mounts of the same volume
    // (e.g. user manually mounting via Nemo) don't re-trigger autorun.
    volume.allowAutorun = false;

    if (root.is_native() && isMountRootHidden(root))
        return false;

    return true;
}

function isMountRootHidden(root) {
    let path = root.get_path();

    return path.includes('/.');
}

function isMountNonLocal(mount) {
    let volume = mount.get_volume();
    if (volume == null)
        return true;

    return volume.get_identifier("class") == "network";
}

function startAppForMount(app, mount) {
    let root = mount.get_root();

    try {
        return app.launch([root], global.create_app_launch_context());
    } catch (e) {
        log(`Unable to launch the app ${app.get_name()}: ${e}`);
    }

    return false;
}

function _setAutorunPreferences(contentType, startApp, ignore, openFolder) {
    let settings = new Gio.Settings({ schema_id: SETTINGS_SCHEMA });

    let startAppTypes = settings.get_strv(SETTING_START_APP).filter(t => t !== contentType);
    if (startApp)
        startAppTypes.push(contentType);
    settings.set_strv(SETTING_START_APP, startAppTypes);

    let ignoreTypes = settings.get_strv(SETTING_IGNORE).filter(t => t !== contentType);
    if (ignore)
        ignoreTypes.push(contentType);
    settings.set_strv(SETTING_IGNORE, ignoreTypes);

    let openFolderTypes = settings.get_strv(SETTING_OPEN_FOLDER).filter(t => t !== contentType);
    if (openFolder)
        openFolderTypes.push(contentType);
    settings.set_strv(SETTING_OPEN_FOLDER, openFolderTypes);
}

const HotplugSnifferProxy = Gio.DBusProxy.makeProxyWrapper(hotplugSnifferIface);
function HotplugSniffer() {
    return new HotplugSnifferProxy(Gio.DBus.session,
                                   'org.Cinnamon.HotplugSniffer',
                                   '/org/Cinnamon/HotplugSniffer');
}

var ContentTypeDiscoverer = class {
    constructor() {
        this._settings = new Gio.Settings({ schema_id: SETTINGS_SCHEMA });
    }

    guessContentTypes(mount, callback) {
        let autorunEnabled = !this._settings.get_boolean(SETTING_DISABLE_AUTORUN);
        let shouldScan = autorunEnabled && !isMountNonLocal(mount);

        if (!shouldScan) {
            callback([], []);
            return;
        }

        mount.guess_content_type(false, null, (mount, res) => {
            let contentTypes = [];

            try {
                contentTypes = mount.guess_content_type_finish(res);
            } catch (e) {
                log(`Unable to guess content types on added mount ${mount.get_name()}: ${e}`);
            }

            if (contentTypes.length === 0) {
                let root = mount.get_root();
                let hotplugSniffer = new HotplugSniffer();
                hotplugSniffer.SniffURIRemote(root.get_uri(), (result, error) => {
                    if (!error && result)
                        contentTypes = result[0] || [];

                    this._resolveApps(contentTypes, callback);
                });
                return;
            }

            this._resolveApps(contentTypes, callback);
        });
    }

    _resolveApps(contentTypes, callback) {
        contentTypes = contentTypes.filter(
            type => type !== 'x-content/win32-software');

        const apps = [];
        contentTypes.forEach(type => {
            const app = Gio.app_info_get_default_for_type(type, false);

            if (app)
                apps.push(app);
        });

        callback(apps, contentTypes);
    }
};

var AutorunManager = class {
    constructor() {
        this._volumeMonitor = Gio.VolumeMonitor.get();
        this._settings = new Gio.Settings({ schema_id: SETTINGS_SCHEMA });

        this._dispatcher = new AutorunDispatcher(this);
        this.enable();
    }

    enable() {
        this._volumeMonitor.connectObject(
            'mount-added', this._onMountAdded.bind(this),
            'mount-removed', this._onMountRemoved.bind(this), this);
    }

    disable() {
        this._volumeMonitor.disconnectObject(this);
    }

    _onMountAdded(monitor, mount) {
        if (!shouldAutorunMount(mount))
            return;

        const discoverer = new ContentTypeDiscoverer();
        discoverer.guessContentTypes(mount, (apps, contentTypes) => {
            log(`autorunManager: mount=${mount.get_name()} contentTypes=[${contentTypes}] apps=[${apps.map(a => a.get_name())}]`);

            if (apps.length === 0) {
                if (this._settings.get_boolean(SETTING_AUTOMOUNT_OPEN))
                    this._openFolderForMount(mount);
                return;
            }

            this._dispatcher.addMount(mount, apps, contentTypes);
        });
    }

    _openFolderForMount(mount) {
        let app = Gio.app_info_get_default_for_type('inode/directory', false);
        if (app)
            startAppForMount(app, mount);
    }

    _onMountRemoved(monitor, mount) {
        this._dispatcher.removeMount(mount);
    }
};

var AutorunDispatcher = class {
    constructor(manager) {
        this._manager = manager;
        this._dialogs = [];
        this._settings = new Gio.Settings({ schema_id: SETTINGS_SCHEMA });
    }

    _getAutorunSettingForType(contentType) {
        let runApp = this._settings.get_strv(SETTING_START_APP);
        if (runApp.includes(contentType))
            return AutorunSetting.RUN;

        let ignore = this._settings.get_strv(SETTING_IGNORE);
        if (ignore.includes(contentType))
            return AutorunSetting.IGNORE;

        let openFiles = this._settings.get_strv(SETTING_OPEN_FOLDER);
        if (openFiles.includes(contentType))
            return AutorunSetting.FILES;

        return AutorunSetting.ASK;
    }

    _getDialogForMount(mount) {
        return this._dialogs.find(d => d.mount === mount) ?? null;
    }

    _showDialog(mount, apps, contentType) {
        if (this._getDialogForMount(mount))
            return;

        let dialog = new AutorunDialog(mount, apps, contentType);
        this._dialogs.push(dialog);

        dialog.connect('destroy', () => {
            this._dialogs = this._dialogs.filter(d => d !== dialog);
        });

        dialog.open();
    }

    addMount(mount, apps, contentTypes) {
        if (this._settings.get_boolean(SETTING_DISABLE_AUTORUN))
            return;

        let contentType = contentTypes.length > 0 ? contentTypes[0] : null;

        let setting;
        if (contentType)
            setting = this._getAutorunSettingForType(contentType);
        else
            setting = AutorunSetting.ASK;

        if (setting === AutorunSetting.IGNORE)
            return;

        let success = false;
        let app = null;

        if (setting === AutorunSetting.RUN && contentType)
            app = Gio.app_info_get_default_for_type(contentType, false);
        else if (setting === AutorunSetting.FILES)
            app = Gio.app_info_get_default_for_type('inode/directory', false);

        if (app)
            success = startAppForMount(app, mount);

        if (!success)
            this._showDialog(mount, apps, contentType);
    }

    removeMount(mount) {
        let dialog = this._getDialogForMount(mount);
        if (!dialog)
            return;

        dialog.close();
    }
};

var AutorunDialog = GObject.registerClass(
class AutorunDialog extends ModalDialog.ModalDialog {
    _init(mount, apps, contentType) {
        super._init({ styleClass: 'autorun-dialog' });

        this.mount = mount;
        this._apps = apps;
        this._contentType = contentType;

        let mountName = mount.get_name();
        let contentDescription = contentType
            ? Gio.content_type_get_description(contentType)
            : null;

        let heading = new St.Label({
            style_class: 'autorun-dialog-heading',
            text: _("New media detected"),
            x_align: Clutter.ActorAlign.CENTER,
        });
        this.contentLayout.add_child(heading);

        let descriptionText;
        descriptionText = _("Select how to open '%s' and whether to perform this action in the future.")
                .format(mountName, contentDescription);

        let description = new St.Label({
            style_class: 'autorun-dialog-description',
            text: descriptionText,
        });
        description.clutter_text.line_wrap = true;
        description.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        description.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.contentLayout.add_child(description);

        this._appSection = new Dialog.ListSection({ selectable: true });
        this.contentLayout.add_child(this._appSection);

        this._populateAppList();
        this._appSection.selectIndex(0);

        if (contentDescription) {
            this._alwaysCheckBox = new CheckBox.CheckBox(_("Always perform this action for type '%s'").format(contentDescription));
            this.contentLayout.add_child(this._alwaysCheckBox);
        }

        let canEject = mount.can_eject();
        let ejectLabel = canEject ? _("Eject") : _("Unmount");

        this.setButtons([
            {
                label: _("Cancel"),
                action: () => this.close(),
                key: Clutter.KEY_Escape,
            },
            {
                label: ejectLabel,
                action: () => this._onEject(),
            },
            {
                label: _("OK"),
                action: () => this._onOk(),
                default: true,
            },
        ]);

        this._unmountedId = mount.connect('unmounted', () => this.close());
    }

    _populateAppList() {
        this._apps.forEach((app, idx) => {
            let icon = app.get_icon();
            let iconActor = icon
                ? new St.Icon({ gicon: icon, icon_size: LIST_ITEM_ICON_SIZE })
                : new St.Icon({ icon_name: 'application-x-executable', icon_size: LIST_ITEM_ICON_SIZE });

            let item = new Dialog.ListSectionItem({
                icon_actor: iconActor,
                title: app.get_name(),
            });
            item._autorunType = AUTORUN_ITEM_APP;
            item._appIndex = idx;
            this._appSection.addItem(item);
        });

        let openFolderItem = new Dialog.ListSectionItem({
            icon_actor: new St.Icon({ icon_name: 'folder-open', icon_size: LIST_ITEM_ICON_SIZE, icon_type: St.IconType.FULLCOLOR }),
            title: _("Open Folder"),
        });
        openFolderItem._autorunType = AUTORUN_ITEM_OPEN_FOLDER;
        this._appSection.addItem(openFolderItem);

        let doNothingItem = new Dialog.ListSectionItem({
            icon_actor: new St.Icon({ icon_name: 'window-close', icon_size: LIST_ITEM_ICON_SIZE }),
            title: _("Do Nothing"),
        });
        doNothingItem._autorunType = AUTORUN_ITEM_DO_NOTHING;
        this._appSection.addItem(doNothingItem);
    }

    _onOk() {
        let selected = this._appSection.selectedItem;
        if (!selected)
            return;

        let remember = this._alwaysCheckBox.checked;

        if (selected._autorunType === AUTORUN_ITEM_DO_NOTHING) {
            if (remember && this._contentType)
                _setAutorunPreferences(this._contentType, false, true, false);
            else if (this._contentType)
                _setAutorunPreferences(this._contentType, false, false, false);

            this.close();
            return;
        }

        if (selected._autorunType === AUTORUN_ITEM_OPEN_FOLDER) {
            if (remember && this._contentType)
                _setAutorunPreferences(this._contentType, false, false, true);
            else if (this._contentType)
                _setAutorunPreferences(this._contentType, false, false, false);

            let app = Gio.app_info_get_default_for_type('inode/directory', false);
            if (app)
                startAppForMount(app, this.mount);

            this.close();
            return;
        }

        // App selected
        let app = this._apps[selected._appIndex];
        if (remember && this._contentType) {
            _setAutorunPreferences(this._contentType, true, false, false);
            if (app)
                app.set_as_default_for_type(this._contentType);
        } else if (this._contentType) {
            _setAutorunPreferences(this._contentType, false, false, false);
        }

        if (app)
            startAppForMount(app, this.mount);

        this.close();
    }

    _onEject() {
        if (this.mount.can_eject()) {
            this.mount.eject_with_operation(
                Gio.MountUnmountFlags.NONE, null, null,
                (mount, res) => {
                    try {
                        mount.eject_with_operation_finish(res);
                    } catch (e) {
                        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.FAILED_HANDLED))
                            log(`Failed to eject: ${e}`);
                    }
                }
            );
        } else {
            this.mount.unmount_with_operation(
                Gio.MountUnmountFlags.NONE, null, null,
                (mount, res) => {
                    try {
                        mount.unmount_with_operation_finish(res);
                    } catch (e) {
                        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.FAILED_HANDLED))
                            log(`Failed to unmount: ${e}`);
                    }
                }
            );
        }

        this.close();
    }

    close() {
        if (this._unmountedId) {
            this.mount.disconnect(this._unmountedId);
            this._unmountedId = 0;
        }

        super.close();
    }
});
