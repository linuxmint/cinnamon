const Lang = imports.lang;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

class DriveMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(place, applet) {
        super();

        this.place = place;
        this.applet = applet;

        this.label = new St.Label({ text: place.name });
        this.addActor(this.label);

        let ejectIcon = new St.Icon({ icon_name: 'media-eject',
                      icon_type: St.IconType.SYMBOLIC,
                      style_class: 'popup-menu-icon ' });
        let ejectButton = new St.Button({ child: ejectIcon });
        ejectButton.connect('clicked', Lang.bind(this, this._eject));
        this.addActor(ejectButton);
    }

    _eject() {
        this.applet.menu.toggle();
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

        this.set_applet_icon_symbolic_name("drive-removable-media");
        this.set_applet_tooltip(_("Removable drives"));

        global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._onPanelEditModeChanged));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this._contentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._contentSection);

        this._update();

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction(_("Open file manager"), function(event) {
            let homeFile = Gio.file_new_for_path(GLib.get_home_dir());
            let homeUri = homeFile.get_uri();
            Gio.app_info_launch_default_for_uri(homeUri, null);
        });

        Main.placesManager.connect('mounts-updated', Lang.bind(this, this._update));
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

        let mounts = Main.placesManager.getMounts();
        let any = false;
        for (let i = 0; i < mounts.length; i++) {
            if (mounts[i].isRemovable()) {
                this._contentSection.addMenuItem(new DriveMenuItem(mounts[i], this));
                any = true;
            }
        }

        this.actor.visible = any;
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonRemovableDrivesApplet(orientation, panel_height, instance_id);
}
