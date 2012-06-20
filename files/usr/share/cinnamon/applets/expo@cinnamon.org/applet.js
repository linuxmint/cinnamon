const Applet = imports.ui.applet;
const Lang = imports.lang;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;

function MyApplet(metadata, orientation) {
    this._init(metadata, orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation) {
        Applet.IconApplet.prototype._init.call(this, orientation);

        try {
            Gtk.IconTheme.get_default().append_search_path(metadata.path);
            this.set_applet_icon_symbolic_name("cinnamon-expo");
            this.set_applet_tooltip(_("Expo"));
            this._hover_activates = false;
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
    }
};

function main(metadata, orientation) {
    let myApplet = new MyApplet(metadata, orientation);
    return myApplet;
}
