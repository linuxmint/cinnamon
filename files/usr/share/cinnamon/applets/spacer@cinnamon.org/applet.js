const Applet = imports.ui.applet;
const St = imports.gi.St;
const Settings = imports.ui.settings;

class CinnamonSpacerApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);
        this.actor.track_hover = false;

        this.bin = new St.Bin();
        this.actor.add(this.bin);

        this.settings = new Settings.AppletSettings(this, "spacer@cinnamon.org", this.instance_id);

        this.settings.bind("width", "width", this.width_changed);

        this.orientation = orientation;

        this.width_changed();
    }

    on_orientation_changed(neworientation) {
        this.orientation = neworientation;

        if (this.bin) {
            this.bin.destroy();

            this.bin = new St.Bin();
            this.actor.add(this.bin);

            this.width_changed();
        }
    }

    width_changed() {
        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM)
            this.bin.width = this.width;
        else
            this.bin.height = this.width;
    }

    on_applet_removed_from_panel() {
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instance_id) {
    return new CinnamonSpacerApplet(metadata, orientation, panelHeight, instance_id);
}
