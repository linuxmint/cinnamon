const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;

class CinnamonOnScreenKeyboardApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);
        this.settings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.a11y.applications' });
        this.settings.connect('changed::screen-keyboard-enabled', Lang.bind(this, this.update_status));

        this.keyboard_switch = new PopupMenu.PopupSwitchMenuItem(
            _("Enable on-screen keyboard"),
            this.settings.get_boolean("screen-keyboard-enabled"),
            null);
        this._applet_context_menu.addMenuItem(this.keyboard_switch);
        this.keyboard_switch.connect(
            "toggled",
            Lang.bind(this,
                function(item, state) {this.settings.set_boolean("screen-keyboard-enabled", state)}));
        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.update_status();
    }

    on_applet_clicked(event) {
        Main.virtualKeyboard.toggle();
        this.keyboard_switch.setToggleState(true);
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
