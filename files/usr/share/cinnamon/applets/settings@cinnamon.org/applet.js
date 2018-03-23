const Applet = imports.ui.applet;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;

class CinnamonSettingsApplet extends Applet.IconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name("go-up");
        this.set_applet_tooltip(_("Settings"));
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this._buildMenu(orientation);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _buildMenu(orientation) {
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        Panel.populateSettingsMenu(this.menu);
    }

    on_orientation_changed(orientation) {
        this.menu.destroy();
        this._buildMenu(orientation);
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonSettingsApplet(orientation, panel_height, instance_id);
}
