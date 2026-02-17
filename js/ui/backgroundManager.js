// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;

const LOGGING = false;

var BackgroundManager = class {
    constructor() {
        let schema = Gio.SettingsSchemaSource.get_default();
        if (!schema.lookup("org.gnome.desktop.background", true))
            return

        this._gnomeSettings = new Gio.Settings({ schema_id: "org.gnome.desktop.background" });
        this._cinnamonSettings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.background" });

        this.colorShadingType = this._gnomeSettings.get_string("color-shading-type");
        this._gnomeSettings.connect("changed::color-shading-type", this._onColorShadingTypeChanged.bind(this));

        this.pictureOptions = this._gnomeSettings.get_string("picture-options");
        this._gnomeSettings.connect("changed::picture-options", this._onPictureOptionsChanged.bind(this));

        this.pictureUri = this._gnomeSettings.get_string("picture-uri");
        this._gnomeSettings.connect("changed::picture-uri", this._onPictureURIChanged.bind(this));

        this.primaryColor = this._gnomeSettings.get_string("primary-color");
        this._gnomeSettings.connect("changed::primary-color", this._onPrimaryColorChanged.bind(this));

        this.secondaryColor = this._gnomeSettings.get_string("secondary-color");
        this._gnomeSettings.connect("changed::secondary-color", this._onSecondaryColorChanged.bind(this));

        this.pictureOpacity = this._gnomeSettings.get_int("picture-opacity");
        this._gnomeSettings.connect("changed::picture-opacity", this._onPictureOpacityChanged.bind(this));
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
        let oldValue = this.colorShadingType
        let newValue = this._gnomeSettings.get_string(key);
        if (oldValue != newValue) {
            let cinnamonValue = this._cinnamonSettings.get_string(key);
            if (cinnamonValue != newValue) {
                if (LOGGING) global.log("BackgroundManager: %s changed (%s --> %s)".format(key, oldValue, newValue));
                this._cinnamonSettings.set_string(key, newValue);
            }
            this.colorShadingType = newValue;
        }
    }

    _onPictureOptionsChanged(schema, key) {
        let oldValue = this.pictureOptions
        let newValue = this._gnomeSettings.get_string(key);
        if (oldValue != newValue) {
            let cinnamonValue = this._cinnamonSettings.get_string(key);
            if (cinnamonValue != newValue) {
                if (LOGGING) global.log("BackgroundManager: %s changed (%s --> %s)".format(key, oldValue, newValue));
                this._cinnamonSettings.set_string(key, newValue);
            }
            this.pictureOptions = newValue;
        }
    }

    _onPictureURIChanged(schema, key) {
        let oldValue = this.pictureUri
        let newValue = this._gnomeSettings.get_string(key);
        if (oldValue != newValue) {
            let cinnamonValue = this._cinnamonSettings.get_string(key);
            if (cinnamonValue != newValue) {
                if (LOGGING) global.log("BackgroundManager: %s changed (%s --> %s)".format(key, oldValue, newValue));
                this._cinnamonSettings.set_string(key, newValue);
            }
            this.pictureUri = newValue;
        }
    }

    _onPrimaryColorChanged(schema, key) {
        let oldValue = this.primaryColor
        let newValue = this._gnomeSettings.get_string(key);
        if (oldValue != newValue) {
            let cinnamonValue = this._cinnamonSettings.get_string(key);
            if (cinnamonValue != newValue) {
                if (LOGGING) global.log("BackgroundManager: %s changed (%s --> %s)".format(key, oldValue, newValue));
                this._cinnamonSettings.set_string(key, newValue);
            }
            this.primaryColor = newValue;
        }
    }

    _onSecondaryColorChanged(schema, key) {
        let oldValue = this.secondaryColor
        let newValue = this._gnomeSettings.get_string(key);
        if (oldValue != newValue) {
            let cinnamonValue = this._cinnamonSettings.get_string(key);
            if (cinnamonValue != newValue) {
                if (LOGGING) global.log("BackgroundManager: %s changed (%s --> %s)".format(key, oldValue, newValue));
                this._cinnamonSettings.set_string(key, newValue);
            }
            this.secondaryColor = newValue;
        }
    }

    _onPictureOpacityChanged(schema, key) {
        let oldValue = this.pictureOpacity
        let newValue = this._gnomeSettings.get_int(key);
        if (oldValue != newValue) {
            let cinnamonValue = this._cinnamonSettings.get_int(key);
            if (cinnamonValue != newValue) {
                if (LOGGING) global.log("BackgroundManager: %s changed (%s --> %s)".format(key, oldValue, newValue));
                this._cinnamonSettings.set_int(key, newValue);
            }
            this.pictureOpacity = newValue;
        }
    }
};
