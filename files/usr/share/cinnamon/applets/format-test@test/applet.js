const Applet = imports.ui.applet;
const Settings = imports.ui.settings;

class FormatTestApplet extends Applet.TextApplet {
    constructor(metadata, orientation, panelHeight, instanceId) {
        super(orientation, panelHeight, instanceId);
        
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        this.set_applet_label("Format Test");
        this.set_applet_tooltip("Test formatów - jednokolumnowy vs dwukolumnowy");
        
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        
        // Bind dummy settings
        this.settings.bind("test-setting", "test_setting", this.on_settings_changed);
    }
    
    on_settings_changed() {
        // Dummy callback
    }
    
    on_applet_clicked(event) {
        // Show settings when clicked
        imports.misc.util.spawnCommandLine("cinnamon-settings applets format-test@test");
    }
}

function main(metadata, orientation, panelHeight, instanceId) {
    return new FormatTestApplet(metadata, orientation, panelHeight, instanceId);
} 