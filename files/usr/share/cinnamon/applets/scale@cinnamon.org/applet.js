const {IconApplet} = imports.ui.applet;
const {overview} = imports.ui.main;
const {AppletSettings} = imports.ui.settings;

class CinnamonScaleApplet extends IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name('cinnamon-scale');
        this.set_applet_tooltip(_('Scale'));

        this.state = {
            hoverActivates: false
        };

        this.settings = new AppletSettings(this.state, metadata.uuid, this.instance_id, true);
        this.settings.promise.then(() => {
            this.settings.bind('activate-on-hover', 'hoverActivates');

            this.actor.connect('enter-event', () => this._onEntered());
        });
    }

    on_applet_clicked(event) {
        if (this.state.hoverActivates)
            return;
        this.doAction();
    }

    on_applet_removed_from_panel() {
        this.settings.finalize();
    }

    _onEntered() {
        if (!this.state.hoverActivates || global.settings.get_boolean('panel-edit-mode'))
            return;
        this.doAction();
    }

    doAction() {
        if (!overview.animationInProgress)
            overview.toggle();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonScaleApplet(metadata, orientation, panel_height, instance_id);
}
