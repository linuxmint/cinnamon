// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Meta = imports.gi.Meta;

const LOGGING = false;

var BackgroundManager = class {
    constructor() {
        let schema = Gio.SettingsSchemaSource.get_default();
        if (!schema.lookup("org.gnome.desktop.background", true))
            return

        this._gnomeSettings = new Gio.Settings({ schema_id: "org.gnome.desktop.background" });
        this._cinnamonSettings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.background" });

        this.color_shading_type = this._gnomeSettings.get_string("color-shading-type");
        this._gnomeSettings.connect("changed::color-shading-type", Lang.bind(this, this._onColorShadingTypeChanged));

        this.picture_options = this._gnomeSettings.get_string("picture-options");
        this._gnomeSettings.connect("changed::picture-options", Lang.bind(this, this._onPictureOptionsChanged));

        this.picture_uri = this._gnomeSettings.get_string("picture-uri");
        this._gnomeSettings.connect("changed::picture-uri", Lang.bind(this, this._onPictureURIChanged));

        this.primary_color = this._gnomeSettings.get_string("primary-color");
        this._gnomeSettings.connect("changed::primary-color", Lang.bind(this, this._onPrimaryColorChanged));

        this.secondary_color = this._gnomeSettings.get_string("secondary-color");
        this._gnomeSettings.connect("changed::secondary-color", Lang.bind(this, this._onSecondaryColorChanged));

        this.picture_opacity = this._gnomeSettings.get_int("picture-opacity");
        this._gnomeSettings.connect("changed::picture-opacity", Lang.bind(this, this._onPictureOpacityChanged));
    }

    showBackground() {
        if (Meta.is_wayland_compositor()) {
            global.bottom_window_group.show();
        }
        else {
            global.background_actor.show();
        }
    }

    hideBackground() {
        if (Meta.is_wayland_compositor()) {
            global.bottom_window_group.hide();
        }
        else {
            global.background_actor.hide();
        }
    }

    _onColorShadingTypeChanged(schema, key) {
        let oldValue = this.color_shading_type
        let newValue = this._gnomeSettings.get_string(key);
        if (oldValue != newValue) {
            let cinnamonValue = this._cinnamonSettings.get_string(key);
            if (cinnamonValue != newValue) {
                if (LOGGING) global.log("BackgroundManager: %s changed (%s --> %s)".format(key, oldValue, newValue));
                this._cinnamonSettings.set_string(key, newValue);
            }
            this.color_shading_type = newValue;
        }
    }

    _onPictureOptionsChanged(schema, key) {
        let oldValue = this.picture_options
        let newValue = this._gnomeSettings.get_string(key);
        if (oldValue != newValue) {
            let cinnamonValue = this._cinnamonSettings.get_string(key);
            if (cinnamonValue != newValue) {
                if (LOGGING) global.log("BackgroundManager: %s changed (%s --> %s)".format(key, oldValue, newValue));
                this._cinnamonSettings.set_string(key, newValue);
            }
            this.picture_options = newValue;
        }
    }

    _onPictureURIChanged(schema, key) {
        let oldValue = this.picture_uri
        let newValue = this._gnomeSettings.get_string(key);
        if (oldValue != newValue) {
            let cinnamonValue = this._cinnamonSettings.get_string(key);
            if (cinnamonValue != newValue) {
                if (LOGGING) global.log("BackgroundManager: %s changed (%s --> %s)".format(key, oldValue, newValue));
                this._cinnamonSettings.set_string(key, newValue);
            }
            this.picture_uri = newValue;
        }
    }

    _onPrimaryColorChanged(schema, key) {
        let oldValue = this.primary_color
        let newValue = this._gnomeSettings.get_string(key);
        if (oldValue != newValue) {
            let cinnamonValue = this._cinnamonSettings.get_string(key);
            if (cinnamonValue != newValue) {
                if (LOGGING) global.log("BackgroundManager: %s changed (%s --> %s)".format(key, oldValue, newValue));
                this._cinnamonSettings.set_string(key, newValue);
            }
            this.primary_color = newValue;
        }
    }

    _onSecondaryColorChanged(schema, key) {
        let oldValue = this.secondary_color
        let newValue = this._gnomeSettings.get_string(key);
        if (oldValue != newValue) {
            let cinnamonValue = this._cinnamonSettings.get_string(key);
            if (cinnamonValue != newValue) {
                if (LOGGING) global.log("BackgroundManager: %s changed (%s --> %s)".format(key, oldValue, newValue));
                this._cinnamonSettings.set_string(key, newValue);
            }
            this.secondary_color = newValue;
        }
    }

    _onPictureOpacityChanged(schema, key) {
        let oldValue = this.picture_opacity
        let newValue = this._gnomeSettings.get_int(key);
        if (oldValue != newValue) {
            let cinnamonValue = this._cinnamonSettings.get_int(key);
            if (cinnamonValue != newValue) {
                if (LOGGING) global.log("BackgroundManager: %s changed (%s --> %s)".format(key, oldValue, newValue));
                this._cinnamonSettings.set_int(key, newValue);
            }
            this.picture_opacity = newValue;
        }
    }
};
