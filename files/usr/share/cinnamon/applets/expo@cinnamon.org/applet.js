const Applet = imports.ui.applet;
const Lang = imports.lang;
const Main = imports.ui.main;

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {
        Applet.TextIconApplet.prototype._init.call(this, orientation);

        try {
            let applet_dir = imports.ui.appletManager._find_applet('expo@cinnamon.org');
            this.icon_path = applet_dir.get_child('expo-symbolic.svg').get_path();
            this.set_applet_icon_path(this.icon_path);
            this._hover_activates = false;
            this._orientation = orientation;
            global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
            global.settings.connect('changed::expo-applet-hover', Lang.bind(this, this._reload_settings));
            this.actor.connect('enter-event', Lang.bind(this, this._onEntered));
            this._reload_settings();
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_panel_edit_mode_changed: function () {
        if (global.settings.get_boolean("expo-applet-hover")) {
            this._hover_activates = !global.settings.get_boolean("panel-edit-mode");
        }
    },

    on_applet_clicked: function(event) {
        if (this._hover_activates)
            return;
        this.doAction();
    },

    _onEntered: function(event) {
        if (!this._hover_activates)
            return;
        this.doAction();
    },

    doAction: function() {
        if (!Main.expo.animationInProgress)
            Main.expo.toggle();
    },

    _reload_settings: function() {
        this._hover_activates = global.settings.get_boolean("expo-applet-hover");
    },

    on_orientation_changed: function (orientation) {
        this._orientation = orientation;
        this._initContextMenu();
    }
};

function main(metadata, orientation) {
    let myApplet = new MyApplet(orientation);
    return myApplet;
}
