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
        this._string_values = [];
        this._int_keys = ["picture-opacity"];
        this._int_values = [];

        for (var i in this._string_keys) {
            this._string_values[i] =  this._gnomeSettings.get_string(this._string_keys[i]);
        }

        for (var i in this._int_keys) {
            this._int_values[i] =  this._gnomeSettings.get_int(this._int_keys[i]);
        }

        this._gnomeSettings.connect('changed', Lang.bind(this, this._onGnomeSettingsChanged));
    },

    _onGnomeSettingsChanged: function() {
        somethingChanged = false;
        for (var i in this._string_keys) {
            key = this._string_keys[i];
            value = this._string_values[i];
            newValue = this._gnomeSettings.get_string(key);
            if (value != newValue) {
                global.log("BackgroundManager: org.gnome.desktop.background %s changed (%s -> %s)!".format(key, value, newValue));
                this._string_values[i] = newValue;
                somethingChanged = true;
            }
        }
        for (var i in this._int_keys) {
            key = this._int_keys[i];
            value = this._int_values[i];
            newValue = this._gnomeSettings.get_int(key);
            if (value != newValue) {
                global.log("BackgroundManager: org.gnome.desktop.background %s changed (%d -> %d)!".format(key, value, newValue));
                this._int_values[i] = newValue;
                somethingChanged = true;
            }
        }
        if (somethingChanged == true) {
            this._overwriteCinnamonSettings();
        }
    },

    _overwriteCinnamonSettings: function() {
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