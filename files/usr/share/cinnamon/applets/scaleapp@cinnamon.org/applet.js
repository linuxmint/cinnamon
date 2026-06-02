const Applet = imports.ui.applet;
const Lang = imports.lang;
const Main = imports.ui.main;
const Settings = imports.ui.settings;

class CinnamonScaleAppApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        try {
            this.set_applet_icon_symbolic_name("cinnamon-scaleapp");
            this.set_applet_tooltip(_("Scale App"));
            this._hover_activates = false;

            this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);

            this.settings.bind("activate-on-hover", "_hover_activates");

            this.actor.connect('enter-event', Lang.bind(this, this._onEntered));
        }
        catch (e) {
            global.logError(e);
        }
    }

    on_applet_clicked(event) {
        if (this._hover_activates)
            return;
        this.doAction();
    }

    _onEntered(event) {
        if (!this._hover_activates || global.settings.get_boolean("panel-edit-mode"))
            return;
        this.doAction();
    }

    doAction() {
        if (!Main.overview.animationInProgress)
            Main.overview.toggle("scaleapp");
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonScaleAppApplet(metadata, orientation, panel_height, instance_id);
}
