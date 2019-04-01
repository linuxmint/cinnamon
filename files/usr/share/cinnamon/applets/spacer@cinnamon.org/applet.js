const {IconApplet} = imports.ui.applet;
const {Bin, Side} = imports.gi.St;
const {AppletSettings} = imports.ui.settings;

class CinnamonSpacerApplet extends IconApplet {
    constructor(metadata, orientation, panelHeight, instance_id) {
        super(orientation, panelHeight, instance_id);
        this.actor.track_hover = false;

        this.bin = new Bin();
        this.actor.add(this.bin);

        this.state = {};

        this.settings = new AppletSettings(this.state, 'spacer@cinnamon.org', this.instance_id, true);
        this.settings.promise.then(() => {
            this.settings.bind('width', 'width', () => this.width_changed());

            this.orientation = orientation;

            this.width_changed();
        });
    }

    on_orientation_changed(neworientation) {
        this.orientation = neworientation;

        if (this.bin) {
            this.bin.destroy();

            this.bin = new Bin();
            this.actor.add(this.bin);

            this.width_changed();
        }
    }

    width_changed() {
        if (this.orientation == Side.TOP || this.orientation == Side.BOTTOM)
            this.bin.width = this.state.width;
        else
            this.bin.height = this.state.width;
    }

    on_applet_removed_from_panel() {
        this.settings.finalize();
    }
}

function main(metadata, orientation, panelHeight, instance_id) {
    return new CinnamonSpacerApplet(metadata, orientation, panelHeight, instance_id);
}
