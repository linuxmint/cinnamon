const Applet = imports.ui.applet;
const Panel = imports.ui.panel;
const Main = imports.ui.main;

// ES2015 class syntax can be used for Cinnamon 3.8+
class CinnamonShowDeskletsApplet extends Applet.IconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.set_applet_icon_name('cs-desklets');
        this.set_applet_tooltip(_('Show Desklets'));
        this._applet_context_menu.addMenuItem(
            new Panel.SettingsLauncher(_('Add Desklets'), 'desklets', 'list-add')
        );
    }

    on_applet_clicked() {
        Main.deskletContainer.toggle();
    }

    on_applet_removed_from_panel() {
        if (Main.deskletContainer.isModal) {
            Main.deskletContainer.lower();
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonShowDeskletsApplet(orientation, panel_height, instance_id);
}