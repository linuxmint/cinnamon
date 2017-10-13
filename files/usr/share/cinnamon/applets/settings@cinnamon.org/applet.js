const Applet = imports.ui.applet;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.set_applet_icon_symbolic_name("go-up");
            this.set_applet_tooltip(_("Settings"));
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._buildMenu(orientation);

        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _buildMenu: function(orientation) {
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        Panel.populateSettingsMenu(this.menu);
    },

    on_orientation_changed: function(orientation){
        this.menu.destroy();
        this._buildMenu(orientation);
    }


};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
