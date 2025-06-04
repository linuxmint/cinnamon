const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Settings = imports.ui.settings;

class DateTimeDisplayApplet extends Applet.TextApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.settings = new Settings.AppletSettings(this, "datetime_display@cinnamon.org", instance_id);
        this.settings.bindProperty(Settings.BindingDirection.IN, "dateFormat", "dateFormat", this.on_settings_changed, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "timeFormat", "timeFormat", this.on_settings_changed, null);

        this.update_ui();
        this.update_loop_id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, Lang.bind(this, this.update_ui));
    }

    on_applet_removed_from_panel() {
        if (this.update_loop_id) {
            GLib.source_remove(this.update_loop_id);
            this.update_loop_id = 0;
        }
    }

    on_settings_changed() {
        this.update_ui();
    }

    update_ui() {
        let displayDate = "";
        if (this.dateFormat) {
            displayDate = GLib.DateTime.new_now_local().format(this.dateFormat);
        }

        let displayTime = "";
        if (this.timeFormat) {
            displayTime = GLib.DateTime.new_now_local().format(this.timeFormat);
        }

        let displayText = displayDate;
        if (displayDate && displayTime) {
            displayText += " " + displayTime;
        } else if (displayTime) {
            displayText = displayTime;
        }

        this.set_applet_label(displayText);
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new DateTimeDisplayApplet(orientation, panel_height, instance_id);
}
