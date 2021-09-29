const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;

class CinnamonOnScreenKeyboardApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);
        this.settings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.a11y.applications' });
        this.settings.connect('changed::screen-keyboard-enabled', Lang.bind(this, this.update_status));
        this.update_status();
    }

    on_applet_clicked(event) {
        Main.virtualKeyboard.toggle();
    }

    update_status() {
        if (this.settings.get_boolean("screen-keyboard-enabled")) {
            this.set_applet_icon_symbolic_name('on-screen-keyboard');
            this.set_applet_tooltip(_("Click to toggle the on-screen keyboard"));
        } else {
            this.set_applet_icon_symbolic_name('on-screen-keyboard-disabled');
            this.set_applet_tooltip(_("Click to enable the on-screen keyboard"));
        }
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new CinnamonOnScreenKeyboardApplet(metadata, orientation, panel_height, instanceId);
}
