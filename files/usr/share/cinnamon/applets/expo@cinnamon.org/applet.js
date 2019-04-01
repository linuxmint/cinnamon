const {IconApplet} = imports.ui.applet;
const {expo} = imports.ui.main;
const {AppletSettings} = imports.ui.settings;

class CinnamonExpoApplet extends IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name('cinnamon-expo');
        this.set_applet_tooltip(_('Expo'));

        this.state = {hoverActivates: false};

        let settings = new AppletSettings(this.state, metadata.uuid, this.instance_id, true);
        settings.promise.then(() => {
            settings.bind('activate-on-hover', 'hoverActivates', null);

            this.actor.connect('enter-event', () => this._onEntered());
            this.settings = settings;
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
        if (!expo.animationInProgress)
            expo.toggle();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonExpoApplet(metadata, orientation, panel_height, instance_id);
}
