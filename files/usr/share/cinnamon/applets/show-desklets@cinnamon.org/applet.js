const Applet = imports.ui.applet;
const Panel = imports.ui.panel;
const Main = imports.ui.main;
const Settings = imports.ui.settings;

// ES2015 class syntax can be used for Cinnamon 3.8+
class CinnamonShowDeskletsApplet extends Applet.IconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.set_applet_icon_name('cs-desklets');
        this.set_applet_tooltip(_('Show Desklets'));
        this._applet_context_menu.addMenuItem(
            new Panel.SettingsLauncher(_('Add Desklets'), 'desklets', 'list-add')
        )

        this.state = {};
        this.settings = new Settings.AppletSettings(this.state, __meta.uuid, instance_id);
        this.settings.bind('showKey', 'showKey', () => {
            this.unbindShowKey();
            this.bindShowKey();
        });

        global.settings.connect('changed::panel-edit-mode', () => this.onPanelEditModeChanged());
        this.bindShowKey();
    }

    bindShowKey() {
        Main.keybindingManager.addHotKey('show-desklet-key', this.state.showKey, () => this.on_applet_clicked());
    }

    unbindShowKey() {
        Main.keybindingManager.removeHotKey('show-desklet-key');
    }

    onPanelEditModeChanged() {
        if (global.settings.get_boolean('panel-edit-mode')
            && Main.deskletContainer.isModal) {
            Main.deskletContainer.lower();
        }
    }

    on_applet_clicked() {
        if (Main.deskletContainer.isModal) {
            Main.deskletContainer.lower();
        } else {
            Main.deskletContainer.raise();
        }
    }

    on_applet_removed_from_panel() {
        if (Main.deskletContainer.isModal) {
            Main.deskletContainer.lower();
        }
        this.unbindShowKey();
        this.settings.finalize();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonShowDeskletsApplet(orientation, panel_height, instance_id);
}