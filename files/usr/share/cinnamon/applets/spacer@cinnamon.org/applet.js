const Applet = imports.ui.applet;
const Settings = imports.ui.settings;

function MyApplet(metadata, orientation, panelHeight, instance_id) {
    this._init(metadata, orientation, panelHeight, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panelHeight, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panelHeight, instance_id);

        this.settings = new Settings.AppletSettings(this, "spacer@cinnamon.org", this.instance_id);

        this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,  // Setting type
                                 "width",             // The setting key
                                 "width",             // The property to manage (this.width)
                                 this.width_changed,  // Callback when value changes
                                 null);               // Optional callback data
        this.width_changed();
        },

    width_changed: function() {
        this.actor.style = "width:" + this.width + "px";
    }
};

function main(metadata, orientation, panelHeight, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panelHeight, instance_id);
    return myApplet;
}
