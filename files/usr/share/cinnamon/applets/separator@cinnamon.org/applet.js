const Applet = imports.ui.applet;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.actor.style_class = 'applet-separator'; 

        this.on_orientation_changed(orientation);
    },
//
// override getDisplayLayout to declare that this applet is suitable for both horizontal and
// vertical orientations
//
    getDisplayLayout: function() {
        return Applet.DisplayLayout.BOTH;
    },

    on_panel_height_changed: function() {
        this.on_orientation_changed(this.orientation);
    },

    on_orientation_changed: function(neworientation) {

        this.orientation = neworientation;

	if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            if (this._line) {
                this._line.destroy();
            }

            this._line = new St.BoxLayout({ style_class: 'applet-separator-line', reactive: false, track_hover: false});
            this.actor.add(this._line, { y_align: Clutter.ActorAlign.CENTER, x_align: Clutter.ActorAlign.CENTER, y_fill: true, y_expand: true});
	}
	else {		// vertical panel
            if (this._line) {
                this._line.destroy();
            }
            this._line = new St.BoxLayout({ style_class: 'applet-separator-line-vertical', reactive: false, track_hover: false });
            this._line.set_important(true);
            this.actor.add(this._line, { y_align: Clutter.ActorAlign.CENTER, x_align: Clutter.ActorAlign.CENTER});

            this._line.set_height(2);
            this._line.set_width((this._panelHeight-8));
        }
    },
}; 

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
