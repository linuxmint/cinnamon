const Applet = imports.ui.applet;
const Lang = imports.lang;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;
const Settings = imports.ui.settings;

function MyApplet(metadata, orientation, panel_height) {
    this._init(metadata, orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height);

        try {            
            Gtk.IconTheme.get_default().append_search_path(metadata.path);
            this.set_applet_icon_symbolic_name("cinnamon-scale");
            this.set_applet_tooltip(_("Scale"));            
            this._hover_activates = false;            

            this.settings = new Settings.AppletSettings(this, metadata["uuid"], this.instance_id);

            this.settings.bindProperty(Settings.BindingDirection.IN,
                                       "activate-on-hover",
                                       "_hover_activates",
                                       function () {});

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
        if (!Main.overview.animationInProgress)
            Main.overview.toggle();
    }
};

function main(metadata, orientation, panel_height) {
    let myApplet = new MyApplet(metadata, orientation, panel_height);
    return myApplet;
}
