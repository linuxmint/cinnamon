const Applet = imports.ui.applet;
const St = imports.gi.St;
const Settings = imports.ui.settings;

function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);
        this.actor.track_hover = false;

        this.bin = new St.Bin();
        this.actor.add(this.bin);

        this.settings = new Settings.AppletSettings(this, "spacer@cinnamon.org", this.instance_id);

        this.settings.bind("width", "width", this.width_changed);

        this.orientation = orientation;

        this.width_changed();
    },

    on_orientation_changed: function(neworientation) {
        this.orientation = neworientation;

        if (this.bin) {
            this.bin.destroy();

            this.bin = new St.Bin;
            this.actor.add(this.bin);

            this.width_changed();
        }
    },

    width_changed: function() {
        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM)
            this.bin.width = this.width;
        else
            this.bin.height = this.width;
    },

    on_applet_removed_from_panel: function() {
        this.settings.finalize();
    }
};

function main(metadata, orientation, panelHeight, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
    return myApplet;
}
