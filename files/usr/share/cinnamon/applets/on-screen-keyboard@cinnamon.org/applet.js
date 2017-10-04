const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;

function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instanceId);
        this.settings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.a11y.applications' });
        this.settings.connect('changed::screen-keyboard-enabled', Lang.bind(this, this.update_status));
        this.update_status();
    },

    on_applet_clicked: function(event) {
        Main.keyboard.toggle();
     },

    update_status: function() {
        if (this.settings.get_boolean("screen-keyboard-enabled")) {
            this.set_applet_icon_symbolic_name('on-screen-keyboard');
            this.set_applet_tooltip(_("Click to toggle the on-screen keyboard"));
        } else {
            this.set_applet_icon_symbolic_name('on-screen-keyboard-disabled');
            this.set_applet_tooltip(_("Click to enable the on-screen keyboard"));
        }
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;
}
