// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;

function BackgroundManager() {
    this._init();
}

BackgroundManager.prototype = {

    _init: function() {
        let schema = Gio.SettingsSchemaSource.get_default();
        if (!schema.lookup("org.gnome.desktop.background", true))
            return

        this._gnomeSettings = new Gio.Settings({ schema: "org.gnome.desktop.background" });
        this._cinnamonSettings = new Gio.Settings({ schema: "org.cinnamon.desktop.background" });

        this._string_keys = ["color-shading-type", "picture-options", "picture-uri", "primary-color", "secondary-color"];
        this._int_keys = ["picture-opacity"];

        // The GNOME background is set when the user presses "Set as Wallpaper" in EOG, Firefox and a few other apps
        // So we listen to the GNOME background key and set the Cinnamon background appropriately when it is changed.
        // We also use a timeout here because gsettings is super-dodgy at session-startup, it basically fires "changed" signals
        // on keys which values haven't changed.
        Mainloop.timeout_add_seconds(10, Lang.bind(this, this.listen_to_gnome_bg_changes));
    },

    listen_to_gnome_bg_changes: function() {
        let schema = Gio.SettingsSchemaSource.get_default();
        if (schema.lookup("org.gnome.desktop.background", true)) {
            this._gnomeSettings = new Gio.Settings({ schema: 'org.gnome.desktop.background' });
            this._changedId = this._gnomeSettings.connect('changed', Lang.bind(this, this._onGnomeSettingsChanged));            
        }
    },

    _onGnomeSettingsChanged: function() {
        for (var i in this._string_keys) {
            let key = this._string_keys[i];
            let gnomeValue = this._gnomeSettings.get_string(key);
            if (this._cinnamonSettings.get_string(key) != gnomeValue) {
                this._cinnamonSettings.set_string(key, gnomeValue);
            }
        }        
        for (var i in this._int_keys) {
            let key = this._int_keys[i];
            let gnomeValue = this._gnomeSettings.get_int(key);
            if (this._cinnamonSettings.get_int(key) != gnomeValue) {
                this._cinnamonSettings.set_int(key, gnomeValue);
            }
        }
    }
};