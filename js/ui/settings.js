/**
 * FILE:settings.js
 * @short_description: File providing settings objects for xlets.
 *
 * This file provides the settings API for applets, desklets and extensions.
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const Signals = imports.signals;
const Extension = imports.ui.extension;
const Mainloop = imports.mainloop;

/**
 * ENUM:BindingDirection
 * @IN: Set the property at binding time, and automatically update the property
 * and execute the callback when the setting file changes.  This is probably
 * the most common mode.
 *
 * @OUT: Set the property at binding time, and automatically update the setting
 * file when the property changes.  The callback can be omitted when using this
 * mode, as it will not be used.
 *
 * @BIDIRECTIONAL: Combines the effects of `IN` and `OUT`.
 *
 * The direction of binding settings
 */
const BindingDirection = {
    IN : 1,
    OUT : 2,
    BIDIRECTIONAL : 3
};

var SETTINGS_TYPES = {
    "checkbox" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "switch" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "entry" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "textview" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "colorchooser" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "radiogroup" : {
        "required-fields": [
            "type",
            "default",
            "description",
            "options"
        ]
    },
    "filechooser" : {
        "required-fields": [
            "type",
            "description",
            "default"
        ]
    },
    "iconfilechooser" : {
        "required-fields": [
            "type",
            "description",
            "default"
        ]
    },
    "soundfilechooser" : {
        "required-fields": [
            "type",
            "description",
            "default"
        ]
    },
    "fontchooser" : {
        "required-fields": [
            "type",
            "description",
            "default"
        ]
    },
    "combobox" : {
        "required-fields": [
            "type",
            "default",
            "description",
            "options"
        ]
    },
    "tween" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "effect" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "keybinding" : {
        "required-fields": [
            "type",
            "default",
            "description"
        ]
    },
    "spinbutton" : {
        "required-fields": [
            "type",
            "default",
            "min",
            "max",
            "units",
            "step",
            "description"
        ]
    },
    "scale" : {
        "required-fields": [
            "type",
            "default",
            "min",
            "max",
            "step",
            "description"
        ]
    },
    "generic" : {
        "required-fields": [
            "type",
            "default"
        ]
    }
};

var NON_SETTING_TYPES = {
    "header" : {
        "required-fields": [
            "type",
            "description"
        ]
    },
    "separator" : {
        "required-fields": [
            "type"
        ]
    },
    "button" : {
        "required-fields": [
            "type",
            "description",
            "callback"
        ]
    },
    "label" : {
        "required-fields": [
            "type",
            "description"
        ]
    }
};

function settings_not_initialized_error(uuid) {
    global.logError("Could not set up binding - settings object was not initialized successfully for " + uuid);
}

function key_not_found_error (key_name, uuid) {
    global.logError("Could not find setting key '" + key_name + "' for applet/desklet uuid " + uuid);
}

function invalid_setting_type_error (key_name, uuid, type) {
    global.logError("Invalid setting type '" + type + "' for setting key '" + key_name + "' of applet/desklet uuid " + uuid);
}

function options_not_supported_error(key_name, uuid, type) {
    global.logError("Invalid request for key '" + key_name + "' of applet/desklet uuid '" + uuid + "': type '" + type + "' doesn't support options");
}

function has_required_fields(props, key) {
    let type = props.type;
    let typeDef;

    if (type in SETTINGS_TYPES) typeDef = SETTINGS_TYPES[type];
    else if (type in NON_SETTING_TYPES) typeDef = NON_SETTING_TYPES[type];
    else return true;

    for (let field of typeDef["required-fields"]) {
        if (!(field in props)) {
            global.logError("Settings key " + key + " is missing property " + field);
            return false;
        }
    }

    return true;
}

function XletSettingsBase(bindObject, uuid, instanceId) {
    this._init(bindObject, uuid, instanceId);
}

/**
 * #XletSettingsBase:
 * @short_description: Object for handling xlet settings updates
 *
 * This object provides methods for binding settings to object properties, connecting
 * to signal change events, and getting and setting values. This class should not be
 * directly, but rather through one of the wrapper classes (#AppletSettings,
 * #DeskletSettings, or #ExtensionSettings)
 */
XletSettingsBase.prototype = {
    _init: function(bindObject, uuid, instanceId) {
        this.isReady = false;
        this.bindObject = bindObject;
        this.uuid = uuid;
        if (this._get_is_multi_instance_xlet(this.uuid)) this.instanceId = instanceId;
        else this.instanceId = this.uuid; 
        this.bindings = {};

        if (!this._ensureSettingsFiles()) return;

        Main.settingsManager.register(this.uuid, this.instanceId, this);

        this.isReady = true;
    },

    /**
     * bindProperty:
     * @direction (Settings.BindingDirection): the direction of the binding
     * @key (string): the id of the setting
     * @applet_prop (string): the variable name that is used to hold the
     * setting (eg. `this.value` passes as `"value`")
     * @callback (function): (optional) the function to call when the setting changes
     * @user_data: (optional) any extra data/object you wish to pass to the callback
     *
     * Bind a setting to a property on the object @bindObject passed to %_init
     *
     * Returns (boolean): Whether the bind was successful
     */
    bindProperty: function(direction, key, applet_prop, callback, user_data) {
        if (!this.isReady) {
            settings_not_initialized_error(this.uuid);
            return false;
        }
        if (!(key in this.settingsData)){
            key_not_found_error(key, this.uuid);
            return false;
        }
        if (!(this.settingsData[key].type in SETTINGS_TYPES)) {
            invalid_setting_type_error(key, this.uuid, this.settingsData[key].type);
            return false;
        }

        let info = {direction: direction, propertyName: applet_prop, data: user_data};
        if (callback && direction != BindingDirection.OUT) info.callback = Lang.bind(this.bindObject, callback, user_data);

        let propDef = {
            get: Lang.bind(this, this._getValue, key),
            set: Lang.bind(this, this._setValue, key),
            enumerable: true,
            configurable: true
        }
        Object.defineProperty(this.bindObject, applet_prop, propDef);

        this.bindings[key] = info;

        // add a save function for objects or arrays
        if (typeof(this.settingsData[key].value) === "object" && !this.settingsData[key].value.save) {
            info.isObject = true;
            this.settingsData[key].value.save = Lang.bind(this, this._saveToFile);
        }
        return true;
    },

    /**
     * unbindProperty:
     * @key (string): the previously bound key to remove
     *
     * Removes the binding of a key that was bound using %bindProperty.
     *
     * Returns (boolean): Whether the unbind was successful.
     */
    unbindProperty: function (key) {
        if (!(key in this.bindings)) {
            global.logError("could not unbind " + key + " for " + this.uuid + ": the key binding did not exist");
            return false;
        }

        delete this.bindObject[this.bindings[key].propertyName];
        delete this.bindings[key];
        return true;
    },

    _getValue: function(key) {
        let value = this.settingsData[key].value;
        return value;
    },

    _setValue: function(value, key) {
        if (this.settingsData[key].value != value || typeof(value) == "object") {
            this.settingsData[key].value = value;
            this._saveToFile();
        }
    },

    /**
     * getValue:
     * @key (string): the name of the settings key
     *
     * Gets the value of the setting @key.
     *
     * Returns: The current value of the setting
     */
    getValue: function(key) {
        if (key in this.settingsData) return this._getValue(key);
        else {
            key_not_found_error(key, this.uuid);
            return null;
        }
    },

    /**
     * setValue:
     * @key (string): the name of the settings key
     * @value: the new value
     *
     * Sets the value of the setting @key to @value.
     */
    setValue: function(key, value) {
        if (!(key in this.settingsData)) {
            key_not_found_error(key, this.uuid);
            return;
        }
        this._setValue(value, key);
    },

    /**
     * getOptions:
     * @key (String): the name of the settings key
     *
     * Gets the current available options for the setting @key.
     *
     * Returns: The currently stored options of the key (or undefined if the key does
     * not support options)
     */
    getOptions: function (key) {
        if (!(key in this.settingsData)) {
            key_not_found_error(key, this.uuid);
            return null;
        }

        if (!("options" in this.settingsData[key])) {
            options_not_supported_error(key, this.uuid, this.settingsData[key].type);
            return null;
        }

        return this.settingsData[key].options;
    },

    /**
     * setOptions:
     * @key (string): the name of the settings key
     * @options: the new options to set
     *
     * Sets the available options of @key to @options. An error is given if the setting
     * does not support options.
     */
    setOptions: function (key, options) {
        if (!(key in this.settingsData)) {
            key_not_found_error(key, this.uuid);
            return;
        }

        if (!("options" in this.settingsData[key])) {
            options_not_supported_error(key, this.uuid, this.settingsData[key].type);
            return;
        }

        if (this.settingsData[key].options != options) {
            this.settingsData[key].options = options;
            this._saveToFile();
        }
    },

    _checkSettings: function() {
        let oldSettings = this.settingsData;
        this.settingsData = this._loadFromFile();

        let changed = false;
        for (let key in this.settingsData) {
            if (this.settingsData[key].value === undefined) continue;

            let oldValue = oldSettings[key].value;
            let value = this.settingsData[key].value;
            if (value == oldValue) continue;

            changed = true;
            let info = this.bindings[key];
            if (info && info.direction != BindingDirection.OUT && info.callback) {
                // if the property had a save function, it is gone now and we need to re-add it
                if (info.isObject && !this.settingsData[key].value.save) {
                    this.settingsData[key].value.save = Lang.bind(this, this._saveToFile);
                }
                info.callback(value);
            }

            /**
             * SIGNAL: changed::'key'
             * @key (string): The settings key who's value changed
             * @oldValue: The value of the key before the setting changed
             * @newValue: The value of the key after the setting changed
             *
             * Emitted when the value of the setting changes
             */
            this.emit("changed::" + key, key, oldValue, value);
        }

        /**
         * SIGNAL: settings-changed
         *
         * Emitted when any of the settings changes
         */
        if (changed) {
            this.emit("settings-changed");
        }
    },

    _ensureSettingsFiles: function() {
        let configPath = [GLib.get_home_dir(), ".cinnamon", "configs", this.uuid].join("/");
        let configDir = Gio.file_new_for_path(configPath);
        if (!configDir.query_exists(null)) configDir.make_directory_with_parents(null);
        this.file = configDir.get_child(this.instanceId + ".json");
        let xletDir = this.ext_type.maps.dirs[this.uuid];
        let templateFile = xletDir.get_child("settings-schema.json");
        let needsSave = false;

        // If the settings have already been installed previously we need to check if the schema
        // has changed and if so, do an upgrade
        if (this.file.query_exists(null)) {
            this.settingsData = this._loadFromFile();
            if (templateFile.query_exists(null)) {
                let templateData = Cinnamon.get_file_contents_utf8_sync(templateFile.get_path());
                let checksum = global.get_md5_for_string(templateData);

                try {
                    if (checksum != this.settingsData.__md5__) this._doUpgrade(templateData, checksum);
                    needsSave = true;
                } catch(e) {
                    if (e) global.logError(e);
                    global.logWarning("upgrade failed for " + this.uuid + ": falling back to previous settings");
                }
            }
            // if settings-schema.json is missing, we can still load the settings from data, so we
            // will merely skip the upgrade test
            else global.logWarning("Couldn't find file settings-schema.json for " + this.uuid + ": skipping upgrade");
        }
        else {
            // If the settings haven't already been installed, we need to do that now
            if (!templateFile.query_exists(null)) {
                global.logError("Unable to load settings for " + this.uuid + ": settings-schema.json could not be found");
                return false;
            }

            let templateData = Cinnamon.get_file_contents_utf8_sync(templateFile.get_path());

            try {
                if (!this._doInstall(templateData)) return false;
            } catch(e) {
                global.logError("Unable to install settings for " + this.uuid + ": there is a problem with settings-schema.json");
                global.logError(e);
                return false;
            }

            needsSave = true;
        }

        this.monitor = this.file.monitor_file(Gio.FileMonitorFlags.NONE, null);
        if (needsSave) this._saveToFile();
        else this.monitorId = this.monitor.connect("changed", Lang.bind(this, this._checkSettings));

        return true;
    },

    _doInstall: function(templateData) {
        global.log("Installing settings for " + this.uuid);
        let checksum = global.get_md5_for_string(templateData);
        this.settingsData = JSON.parse(templateData);
        for (let key in this.settingsData) {
            let props = this.settingsData[key];
            if (!has_required_fields(props, key)) return false;
            if (props.type in SETTINGS_TYPES)
                props.value = props.default;
        }
        this.settingsData.__md5__ = checksum;

        global.log("Settings successfully installed for " + this.uuid);
        return true;
    },

    _doUpgrade: function(templateData, checksum) {
        global.log("Upgrading settings for " + this.uuid);
        let newSettings = JSON.parse(templateData);
        for (let key in newSettings) {
            let props = newSettings[key];

            // if (!has_required_fields(props, key)) throw null;

            if (!("type" in props) || !(props.type in SETTINGS_TYPES)) continue;
            let type = SETTINGS_TYPES[props.type];

            // If the setting already exists, we want to use the old value. If not we use the default.
            let oldValue = null;
            if (this.settingsData[key] && this.settingsData[key].value != undefined)
                oldValue = this.settingsData[key].value;
            if (key in this.settingsData && this._checkSanity(oldValue, newSettings[key])) newSettings[key].value = oldValue;
            else newSettings[key].value = newSettings[key].default;
        }

        newSettings.__md5__ = checksum;

        this.settingsData = newSettings;
        global.log("Settings successfully upgraded for " + this.uuid);
    },

    _checkSanity: function(val, setting) {
        let found;
        switch (setting["type"]) {
            case "spinbutton":
            case "scale":
                return (val < setting["max"] && val > setting["min"]);
                break;
            case "combobox":
            case "radiogroup":
                found = false;
                for (let opt in setting["options"]) {
                    if (val == setting["options"][opt]) {
                        found = true;
                        break;
                    }
                }
                return found;
                break;
            default:
                return true;
                break;
        }
        return true;
    },

    _loadFromFile: function() {
        let rawData = Cinnamon.get_file_contents_utf8_sync(this.file.get_path());
        let json = JSON.parse(rawData);
        return json;
    },

    _saveToFile: function() {
        if (this.monitorId) this.monitor.disconnect(this.monitorId);
        let rawData = JSON.stringify(this.settingsData, null, 4);
        let raw = this.file.replace(null, false, Gio.FileCreateFlags.NONE, null);
        let out_file = Gio.BufferedOutputStream.new_sized(raw, 4096);
        Cinnamon.write_string_to_stream(out_file, rawData);
        out_file.close(null);
        this.monitorId = this.monitor.connect("changed", Lang.bind(this, this._checkSettings));
    },

    // called by cinnamonDBus.js to when the setting is changed remotely. This is to expedite the
    // update due to settings changes, as the file monitor has a significant delay.
    remoteUpdate: function(key, payload) {
        this._checkSettings();
    },

    /**
     * finalize:
     *
     * Removes all bindings and disconnects all signals. This function should be called prior
     * to deleting the object.
     */
    finalize: function() {
        Main.settingsManager.unregister(this.uuid, this.instanceId);
        for (let key in this.bindings) {
            this.unbindProperty(key);
        }
        if (this.monitorId) this.monitor.disconnect(this.monitorId);
        this.disconnectAll();
    }
}
Signals.addSignalMethods(XletSettingsBase.prototype);

/**
 * #AppletSettings:
 * @short_description: Settings object for applets.
 *
 * Inherits: Settings.XletSettingsBase
 */
function AppletSettings(xlet, uuid, instanceId) {
    this._init(xlet, uuid, instanceId);
}

AppletSettings.prototype = {
    __proto__: XletSettingsBase.prototype,

    /**
     * _init:
     * @xlet (Object): the object variables are binded to (usually `this`)
     * @uuid (string): uuid of the applet
     * @instanceId (int): instance id of the applet
     */
    _init: function (xlet, uuid, instanceId) {
        this.ext_type = Extension.Type.APPLET;
        XletSettingsBase.prototype._init.call(this, xlet, uuid, instanceId, "Applet");
    },

    _get_is_multi_instance_xlet: function(uuid) {
        return Extension.get_max_instances(uuid, this.ext_type) != 1;
    },
};

/**
 * #DeskletSettings:
 * @short_description: Settings object for desklets.
 *
 * Inherits: Settings.XletSettingsBase
 */
function DeskletSettings(xlet, uuid, instanceId) {
    this._init(xlet, uuid, instanceId);
}

DeskletSettings.prototype = {
    __proto__: XletSettingsBase.prototype,

    /**
     * _init:
     * @xlet (Object): the object variables are binded to (usually `this`)
     * @uuid (string): uuid of the desklet
     * @instanceId (int): instance id of the desklet
     */
    _init: function (xlet, uuid, instanceId) {
        this.ext_type = Extension.Type.DESKLET;
        XletSettingsBase.prototype._init.call(this, xlet, uuid, instanceId, "Desklet");
    },

    _get_is_multi_instance_xlet: function(uuid) {
        return Extension.get_max_instances(uuid, this.ext_type) > 1;
    }
};

/**
 * #ExtensionSettings:
 * @short_description: Settings object for extensions.
 *
 * Inherits: Settings.XletSettingsBase
 */
function ExtensionSettings(xlet, uuid) {
    this._init(xlet, uuid);
}

ExtensionSettings.prototype = {
    __proto__: XletSettingsBase.prototype,

    /**
     * _init:
     * @xlet (Object): the object variables are binded to (usually `this`)
     * @uuid (string): uuid of the extension
     */
    _init: function (xlet, uuid) {
        this.ext_type = Extension.Type.EXTENSION;
        XletSettingsBase.prototype._init.call(this, xlet, uuid, null, "Extension");
    },

    _get_is_multi_instance_xlet: function(uuid) {
        return false;
    }
};

function SettingsManager() {
    this._init();
}

SettingsManager.prototype = {
    _init: function () {
        this.uuids = {};
    },

    register: function (uuid, instance_id, obj) {
        if (!(uuid in this.uuids))
            this.uuids[uuid] = {}
        this.uuids[uuid][instance_id] = obj;
    },

    unregister: function (uuid, instance_id) {
        this.uuids[uuid][instance_id] = null;
    }
};
