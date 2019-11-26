const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

const translated_id = (s1, s2) => {
    // In some languages, parentheses are replaced by other characters.
    return _("%s (%s)").format(s1, s2)
}

class DriveMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(place) {
        super();

        this.place = place;

        let unixDevice = place._mount.get_drive().get_identifier('unix-device');
        this.label = new St.Label({ text: translated_id(place.name, unixDevice) });
        this.addActor(this.label);

        let ejectIcon = new St.Icon({ icon_name: 'media-eject',
                      icon_type: St.IconType.SYMBOLIC,
                      style_class: 'popup-menu-icon' });
        let ejectButton = new St.Button({ child: ejectIcon });
        ejectButton.connect('clicked', () => this._eject());
        this.addActor(ejectButton);
    }

    _eject() {
        this.place.remove();
    }

    activate(event) {
        this.place.launch({ timestamp: event.get_time() });
        super.activate(event);
    }
}

class CinnamonRemovableDrivesApplet extends Applet.IconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name("drive-harddisk");
        this.set_applet_tooltip(_("Removable drives"));

        global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, () => this._onPanelEditModeChanged());

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._oldMounts = new Map();
        this._oldLabels = new Array();
        this._labels = new Array();
        this._contentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._contentSection);

        this._update();

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction(_("Open file manager"), function(event) {
            let homeFile = Gio.file_new_for_path(GLib.get_home_dir());
            let homeUri = homeFile.get_uri();
            Gio.app_info_launch_default_for_uri(homeUri, null);
        });

        Main.placesManager.connect('mounts-updated', () => this._update());
        this._onPanelEditModeChanged();
    }

    _onPanelEditModeChanged() {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this.actor.show();
        }
        else {
            this._update();
        }
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _update() {
        this._contentSection.removeAll();

        this._labels = new Array();
        let mounts = Main.placesManager.getMounts();
        let any = false;
        let name;
        let driveName;  // Ex: USB Flash Drive
        let unixDevice; // Ex: /dev/sdc
        let uId; // unique Id

        for (let i = 0; i < mounts.length; i++) {
            if (mounts[i].isRemovable()) {
                this._contentSection.addMenuItem(new DriveMenuItem(mounts[i]));
                name = mounts[i].name.toString();
                driveName = mounts[i]._mount.get_drive().get_name().toString();
                unixDevice = mounts[i]._mount.get_drive().get_identifier('unix-device').toString();
                uId = translated_id(name, unixDevice);
                this._labels.push(uId);
                if (!this._oldMounts.has(uId)) {
                    this._oldMounts.set(uId, translated_id(driveName, unixDevice));
                }
                any = true;
            }
        }

        for (let old of this._oldLabels) {
            if (!this._labels.includes(old.toString())) {
                uId = this._oldMounts.get(old.toString());
                this._oldMounts.delete(old.toString());

                let source = new MessageTray.SystemNotificationSource();
                Main.messageTray.add(source);
                let notification = new MessageTray.Notification(
                    source,
                    _("%s can be safely unplugged").format(uId),
                    _("Device can be removed")
                );
                notification.setTransient(true);
                notification.setUrgency(MessageTray.Urgency.NORMAL);
                source.notify(notification);
                }
        }
        this._oldLabels = this._labels.slice();
        this.actor.visible = any;
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonRemovableDrivesApplet(orientation, panel_height, instance_id);
}
