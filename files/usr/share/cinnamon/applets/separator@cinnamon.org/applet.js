const Applet = imports.ui.applet;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

class CinnamonSeparatorApplet extends Applet.Applet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.actor.style_class = 'applet-separator';

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.on_orientation_changed(orientation);
    }

    on_panel_height_changed() {
        this.on_orientation_changed(this.orientation);
    }

    on_orientation_changed(neworientation) {
        this.orientation = neworientation;

        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            if (this._line) {
                this._line.destroy();
            }

            this.actor.remove_style_class_name('vertical');

            this._line = new St.BoxLayout({ style_class: 'applet-separator-line', reactive: false, track_hover: false});
            this.actor.add(this._line, { y_align: Clutter.ActorAlign.CENTER, x_align: Clutter.ActorAlign.CENTER, y_fill: true, y_expand: true});
        } else {
            if (this._line) {
                this._line.destroy();
            }

            this.actor.add_style_class_name('vertical');

            this._line = new St.BoxLayout({ style_class: 'applet-separator-line-vertical', reactive: false, track_hover: false });
            this._line.set_important(true);
            this.actor.add(this._line, { y_align: Clutter.ActorAlign.CENTER, x_align: Clutter.ActorAlign.CENTER});
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonSeparatorApplet(orientation, panel_height, instance_id);
}
