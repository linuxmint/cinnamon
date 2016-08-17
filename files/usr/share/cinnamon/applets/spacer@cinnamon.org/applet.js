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

        this.settings = new Settings.AppletSettings(this, "spacer@cinnamon.org", this.instance_id);

        this.settings.bindProperty(Settings.BindingDirection.IN,  // Setting type
                                     "width",             // The setting key
                                     "width",             // The property to manage (this.width)
                                     this.width_changed,  // Callback when value changes
                                     null);               // Optional callback data

        this.panelheight = panelHeight;

        this.on_orientation_changed(orientation);
        },

    on_orientation_changed: function(neworientation) {

        this.orientation = neworientation;
        this.width_changed();
    },

    width_changed: function() {

	if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            this.actor.width = this.width;
	}
	else {		// vertical panel
            this.actor.width = this.panelheight - 4;
            this.actor.height = this.width;
        }
    },

    on_applet_removed_from_panel: function() {
        this.settings.finalize();
    }
};

function main(metadata, orientation, panelHeight, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
    return myApplet;
}
