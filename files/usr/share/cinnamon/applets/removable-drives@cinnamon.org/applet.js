const Lang = imports.lang;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

function DriveMenuItem(place) {
    this._init(place);
}

DriveMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(place) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.place = place;

        this.label = new St.Label({ text: place.name });
        this.addActor(this.label);

        let ejectIcon = new St.Icon({ icon_name: 'media-eject',
                      icon_type: St.IconType.SYMBOLIC,
                      style_class: 'popup-menu-icon ' });
        let ejectButton = new St.Button({ child: ejectIcon });
        ejectButton.connect('clicked', Lang.bind(this, this._eject));
        this.addActor(ejectButton);
    },

    _eject: function() {
        this.place.remove();
    },

    activate: function(event) {
        this.place.launch({ timestamp: event.get_time() });
        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this, event);
    }
};

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.set_applet_icon_symbolic_name("drive-harddisk");
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
        catch (e) {
            global.logError(e);
        }
    },

    _onPanelEditModeChanged: function() {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this.actor.show();
        }
        else {
            this._update();
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _update: function() {
        this._contentSection.removeAll();

        let mounts = Main.placesManager.getMounts();
        let any = false;
        for (let i = 0; i < mounts.length; i++) {
            if (mounts[i].isRemovable()) {
                this._contentSection.addMenuItem(new DriveMenuItem(mounts[i]));
                any = true;
            }
        }

        this.actor.visible = any;
    }

};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
