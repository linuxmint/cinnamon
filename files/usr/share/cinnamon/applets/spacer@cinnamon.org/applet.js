const Applet = imports.ui.applet;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Lang = imports.lang;

class CinnamonSpacerApplet extends Applet.Applet {
    constructor(metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);
        this.actor.track_hover = false;
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.actor.set_style_class_name("spacer-box");

        this.bin = new St.Bin();

        this.actor.add(this.bin);

        this.settings = new Settings.AppletSettings(this, "spacer@cinnamon.org", this.instance_id);

        this.settings.bind("width", "width", this.size_changed);

        global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_pane_edit_mode_changed));

        this.orientation = orientation;

        this.size_changed();
        this.on_pane_edit_mode_changed();
    }

    on_pane_edit_mode_changed(settings, key) {
        if (global.settings.get_boolean("panel-edit-mode")) {
            this.actor.add_style_class_name("edit-mode");
        } else {
            this.actor.remove_style_class_name("edit-mode");
        }
    }

    on_orientation_changed(neworientation) {
        this.orientation = neworientation;
        this.size_changed();
    }

    size_changed() {
        let scaled_width = this.width * global.ui_scale;

        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            this.bin.natural_width = scaled_width;
            this.bin.natural_height_set = false;
        }
        else {
            this.bin.natural_height = scaled_width;
            this.bin.natural_width_set = false
        }
    }

    on_applet_removed_from_panel() {
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instance_id) {
    return new CinnamonSpacerApplet(metadata, orientation, panelHeight, instance_id);
}
