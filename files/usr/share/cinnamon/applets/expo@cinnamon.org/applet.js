const Applet = imports.ui.applet;
const Lang = imports.lang;
const Main = imports.ui.main;
const Settings = imports.ui.settings;

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.set_applet_icon_symbolic_name("cinnamon-expo");
            this.set_applet_tooltip(_("Expo"));
            this._hover_activates = false;

            this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);

            this.settings.bind("activate-on-hover", "_hover_activates");

            this.actor.connect('enter-event', Lang.bind(this, this._onEntered));
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        if (this._hover_activates)
            return;
        this.doAction();
    },

    _onEntered: function(event) {
        if (!this._hover_activates || global.settings.get_boolean("panel-edit-mode"))
            return;
        this.doAction();
    },

    doAction: function() {
        if (!Main.expo.animationInProgress)
            Main.expo.toggle();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
