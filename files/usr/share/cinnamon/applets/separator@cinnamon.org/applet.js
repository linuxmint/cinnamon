const Applet = imports.ui.applet;
const St = imports.gi.St;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.actor.style_class = 'applet-separator'; 

	if (orientation == St.Side.TOP || orientation == St.Side.BOTTOM) // horizontal panels
	{
            this._line = new St.BoxLayout({ style_class: 'applet-separator-line', reactive: false, track_hover: false }); 
            this.actor.add(this._line, { y_align: St.Align.MIDDLE, y_fill: true });
	}
	else								//vertical panels
	{
            this._line = new St.BoxLayout({ style_class: 'applet-separator-line', reactive: false, track_hover: false, vertical: true }); 
            this.actor.add(this._line, { x_align: St.Align.MIDDLE, x_fill: true });
	}
    },
}; 

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
