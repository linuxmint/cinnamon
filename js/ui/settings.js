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

const SETTING_SCHEMA_FILE = "settings-schema.json";

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
    "radiogroup" : {
        "required-fields": [
            "type",
            "default",
            "description",
            "options"
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

function _provider(xlet, uuid, instanceId, type, string) {
    this._init(xlet, uuid, instanceId, type, string);
}

/**
 * #_provider:
 * @short_description: Xlet settings object
 *
 * This is the settings object produced in the settings API.
 */
_provider.prototype = {
        _init: function (xlet, uuid, instanceId, type, string) {
            if (type && string) {
                this.ext_type = type;
                this.xlet_str = string;
            }
            if (!xlet) {
                global.logError(this.xlet_str + " constructor arguments invalid");
                global.logError("First argument MUST be a(n)" + this.xlet_str + " object (use 'this' as the first argument");
                return;
            }
            if (!uuid) {
                global.logError(this.xlet_str + "Settings constructor arguments invalid");
                global.logError("Missing required UUID as second argument - should be a string:");
                global.logError("<xlet-name>@<your-id>.org or something similar");
                return;
            }
            this.uuid = uuid;
            this.xlet = xlet;
            if (!instanceId && this.ext_type != Extension.Type.EXTENSION) {
                global.logWarning(this.xlet_str + "Settings constructor arguments warning");
                global.logWarning("Missing instance ID as third argument");
                global.logWarning("The UUID is " + this.uuid);
            }
            this.instanceId = instanceId;
            this.valid = false;
            this.applet_dir = type.maps.dirs[this.uuid];
            if (!this.applet_dir) {
                global.logError("Could not find installation directory for " + this.uuid);
                return;
            }
            this.multi_instance = this._get_is_multi_instance_xlet(this.uuid);
            if (this.multi_instance && this.instanceId == undefined) {
                global.logError(this.xlet_str + "Settings fatal error!");
                global.logError("Multi-instanciable xlet with no instance ID supplied");
                global.logError("The UUID is " + this.uuid);
                return;
            }

            let fn = this.multi_instance ? instanceId : uuid;
            let setting_path = (GLib.get_home_dir() + "/" +
                                        ".cinnamon" + "/" +
                                          "configs" + "/" +
                                          this.uuid + "/" +
                                                 fn + ".json");
            this.settings_file = Gio.file_new_for_path(setting_path);

            // Set up working settings file as ~/.cinnamon/applet_config/<uuid>/<instanceid>.json
            // If it already exists, check for updates to it (new keys, etc..)
            if (!this.settings_file.query_exists(null)) {
                if (!this._create_settings_file()) {
                    global.logError("Problem initializing settings for " + this.uuid);
                    return;
                }
            } else {
                if (!this._maybe_update_settings_file()) {
                    global.logError("Problem updating settings for " + this.uuid);
                    return;
                }
            }

            this.metaBindings = {}
            if (!this.multi_instance) {
                this.instanceId = this.uuid; 
            }
            this.settings_obj = new SettingObj(this, this.settings_file, this.uuid, this.instanceId);

            this.valid = true;
            Main.settingsManager.register(this.uuid, this.instanceId, this);
        },

        _get_is_multi_instance_xlet: function(uuid) {
            return false;
        },

        _create_settings_file: function () {
            if (!this.settings_file.get_parent().query_exists(null)) {
                this.settings_file.get_parent().make_directory_with_parents(null)
            }
            let orig_file = this.applet_dir.get_child(SETTING_SCHEMA_FILE);
            if (!orig_file.query_exists(null)) {
                global.logError("Failed to locate settings schema file for " + this.uuid);
                return false;
            }
            let init_file_contents = Cinnamon.get_file_contents_utf8_sync(orig_file.get_path());
            let checksum = global.get_md5_for_string(init_file_contents);

            let init_json
            try {
                init_json = JSON.parse(init_file_contents);
            } catch (e) {
                global.logError("Cannot parse settings schema file for %s" + this.uuid + ".  Check the structure for missing commas, etc... Error is: " + e);
                return false;
            }
            if (!this._json_validity_check(init_json)) {
                global.logError("Initial settings schema file is not valid for " + this.uuid);
                return false;
            }

            for (let key in init_json) {
                init_json[key]["value"] = init_json[key]["default"]
            }
            init_json["__md5__"] = checksum;

            let f = Gio.file_new_for_path(this.settings_file.get_path());
            let raw = f.replace(null, false, Gio.FileCreateFlags.NONE, null);
            let out_file = Gio.BufferedOutputStream.new_sized (raw, 4096);
            Cinnamon.write_string_to_stream(out_file, JSON.stringify(init_json, null, 4));
            out_file.close(null);

            return true;
        },

        _json_validity_check: function (init_json) {
            let valid = false;
            for (let primary_key in init_json) {
                valid = this._check_for_min_props(init_json[primary_key])
                if (!valid)
                    break;
            }
            return valid;
        },

        _check_for_min_props: function (node) {
            if (node["type"] in SETTINGS_TYPES) {
                for (let req_field in SETTINGS_TYPES[node["type"]]["required-fields"]) {
                    if (!(SETTINGS_TYPES[node["type"]]["required-fields"][req_field] in node)) {
                        return false;
                    }
                }
                return true;
            } else if (node["type"] in NON_SETTING_TYPES) {
                for (let req_field in NON_SETTING_TYPES[node["type"]]["required-fields"]) {
                    if (!(NON_SETTING_TYPES[node["type"]]["required-fields"][req_field] in node)) {
                        return false;
                    }
                }
                return true;
            } else {
                return false;
            }
        },

        _maybe_update_settings_file: function () {
            let orig_file = this.applet_dir.get_child(SETTING_SCHEMA_FILE);
            if (!orig_file.query_exists(null)) {
                global.logWarning("Failed to locate settings schema file to check for updates: " + this.uuid);
                global.logWarning("Something may not be right");
                return false;
            }
            let init_file_contents = Cinnamon.get_file_contents_utf8_sync(orig_file.get_path());
            let checksum = global.get_md5_for_string(init_file_contents);

            let existing_settings_file = Cinnamon.get_file_contents_utf8_sync(this.settings_file.get_path());
            let existing_json;
            let new_json;
            try {
                new_json = JSON.parse(init_file_contents);
            } catch (e) {
                global.logError("Problem parsing " + orig_file.get_path() + " while preparing to perform upgrade.");
                global.logError("Skipping upgrade for now - something may be wrong with the new settings schema file.");
                return false;
            }
            try {
                existing_json = JSON.parse(existing_settings_file);
            } catch (e) {
                global.logError("Problem parsing " + this.settings_file.get_path() + " while preparing to perform upgrade.");
                global.log("Re-creating settings file.");   
                this.settings_file.delete(null, null);
                return this._create_settings_file();
            }           
            if (existing_json["__md5__"] != checksum) {
                global.log("Updated settings file detected for " + this.uuid + ".  Beginning upgrade of existing settings");
                return this._do_upgrade(new_json, existing_json, checksum);
            } else {
                return true;
            }
        },

        _do_upgrade: function(new_json, old_json, checksum) {
            // First, check the new json for validity
            if (!this._json_validity_check(new_json)) {
                global.logError("Upgraded settings schema file is NOT valid for " + this.uuid);
                global.logError("Aborting settings upgrade.");
                return false;
            }
            /* We're going to iterate through all the keys in the new settings file
             * Where the key names and types match up, we'll check the current value against
             * the new max/mins or other factors (if applicable) and add the 'value' key to the new file.
             *
             * If the old setting-key doesn't exist in the new file, we'll drop it entirely.
             * If there are new keys, we'll assign the default value like normal.
             */
            for (let key in new_json) {
                if (key in old_json) {
                    if (new_json[key]["type"] == old_json[key]["type"]) {
                        if (this._sanity_check(old_json[key]["value"], new_json[key])) {
                            new_json[key]["value"] = old_json[key]["value"];
                        } else {
                            new_json[key]["value"] = new_json[key]["default"];
                        }
                    } else {
                        new_json[key]["value"] = new_json[key]["default"];
                    }
                } else {
                    new_json[key]["value"] = new_json[key]["default"];
                }
            }
            new_json["__md5__"] = checksum;

            if (this.settings_file.delete(null, null)) {
                let f = Gio.file_new_for_path(this.settings_file.get_path());
                let raw = f.replace(null, false, Gio.FileCreateFlags.NONE, null);
                let out_file = Gio.BufferedOutputStream.new_sized (raw, 4096);
                Cinnamon.write_string_to_stream(out_file, JSON.stringify(new_json, null, 4));
                out_file.close(null);
                global.log("Upgrade complete");
                return true;
            } else {
                global.logError("Failed to gain write access to save updated settings for " + this.uuid + "..." + this.instanceId)
                return false;
            }
        },

        _sanity_check: function(val, setting) {
            let found;
            switch (setting["type"]) {
                case "spinbutton":
                case "scale":
                    return (val < setting["max"] && val > setting["min"]);
                    break;
                case "combobox":
                    found = false;
                    for (let opt in setting["options"]) {
                        if (val == setting["options"][opt]) {
                            found = true;
                            break;
                        }
                    }
                    return found;
                    break;
                case "radiogroup":
                    found = false;
                    for (let opt in setting["options"]) {
                        if (val == setting["options"][opt] || setting["options"][opt] == "custom") {
                            found = true;
                            break
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

        remote_set: function (key, payload) {
            let node = JSON.parse(payload);
            this.settings_obj.set_node_from_dbus(key, node);
        },

        get_file_path: function() {
            return this.settings_file.get_path();
        },

        /* _settings_file_changed:  For convenience only, if you want to handle
         * updating your applet props yourself, connect to this signal on your
         * AppletSettings object to get notified when the json file changes,
         * then you can call AppletSettings.getValue(key) to update your props
         */

        _setting_file_changed_notify: function() {
            this.emit("settings-changed");
        },

        /* individual key notification, sends old and new value with signal */

        _value_changed_notify: function(key, oldval, newval) {
            this.emit("changed::" + key, key, oldval, newval);
        },

        /**
         * bindProperty:
         * @sync_type (Settings.BindingDirection): the direction of the binding
         * @key_name (string): the id of the setting
         * @applet_var (string): the applet's property that is used to hold the
         * setting (eg. `this.value` passes as `"value`")
         * @applet_callback (function): (optional) the applet method to call
         * when the setting has changed and the new values set
         * @user_data: (optional) any extra data/object you wish to pass to the callback
         *
         * Bind an applet proprety/varaible to a setting
         *
         * Returns (boolean): Whether the bind was successful
         */
        bindProperty: function (sync_type, key_name, applet_var, applet_callback, user_data) {
            if (!this.valid) {
                settings_not_initialized_error(this.uuid);
                return false;
            }
            let type = this.settings_obj.get_key_exists_and_type(key_name);
            if (!applet_callback)
                applet_callback = function() {};
            if (type) {
                if (type in SETTINGS_TYPES) {
                    this.metaBindings[key_name] = new _setting(sync_type, this.xlet, key_name, this.settings_obj, applet_var, Lang.bind (this.xlet, applet_callback), user_data);
                    return true;
                } else {
                    invalid_setting_type_error(key_name, this.uuid, type);
                    return false;
                }
            } else {
                key_not_found_error(key_name, this.uuid);
                return false;
            }
        },

        /**
         * unbindProperty:
         * @key_name (string): the id of the setting
         *
         * Reverses the effect of %bindProperty.
         *
         * Returns (boolean): Whether the unbind was successful.
         */
        unbindProperty: function (key_name) {
            if (this.metaBindings[key_name]) {
                this.metaBindings[key_name].finalize();
                this.metaBindings[key_name] = undefined;
                return true;
            }
            global.logError("unbindProperty failed for " + this.uuid + ".  Key name '" + key_name + "' did not exist.");
            return false;
        },

        /**
         * finalize:
         *
         * Destroys the setting object.
         */
        finalize: function () {
            this.settings_obj.finalize();
            for (let setting in this.metaBindings) {
                this.metaBindings[setting].finalize();
            }
            this.metaBindings = undefined;
            this.settings_obj = undefined;
            Main.settingsManager.unregister(this.uuid, this.instanceId);
        },

        /**
         * getValue:
         * @key_name (String): the key name to fetch the value for
         *
         * Returns the currently stored value of the key `key_name`
         *
         * Returns: The currently stored value of the key
         */
        getValue: function (key_name) {
            if (key_name in this.settings_obj.json) {
                return this.settings_obj.get_data(key_name)["value"];
            } else {
                key_not_found_error(key_name, this.uuid);
                return null;
            }
        },

        /**
         * setValue:
         * @key_name (string): the key name  to set the value for
         * @value: the new value
         *
         * Sets the value of @key_name to @value.
         */
        setValue: function (key_name, value) {
            if (key_name in this.settings_obj.json) {
                let oldval = this.settings_obj.get_data(key_name)["value"];
                if (oldval != value) {
                    this.settings_obj.set_value(key_name, value);
                }
            } else {
                key_not_found_error(key_name, this.uuid);
            }
        },

        /**
         * getOptions:
         * @key_name (String): the key name to fetch the options for
         *
         * Returns the current options for the key @key_name.
         *
         * Returns: The currently stored options of the key (undefined if the key does not support options)
         */
        getOptions: function (key_name) {
            if (key_name in this.settings_obj.json) {
                return this.settings_obj.get_data(key_name)["options"];
            } else {
                key_not_found_error(key_name, this.uuid);
                return null;
            }
        },

        /**
         * setOptions:
         * @key_name (string): the key name to set the options for
         * @options: the new options to set
         *
         * If @key_name is a key type that supports options, sets the options of @key_name to @options.
         */
        setOptions: function (key_name, options) {
            if (key_name in this.settings_obj.json) {
                let oldval = this.settings_obj.get_data(key_name)["options"];
                if (!oldval) {
                    global.logWarning("Could not set options for '" + key_name + "' - the key does not support options");
                    return;
                }
                if (oldval != options) {
                    this.settings_obj.set_options(key_name, options);
                }
            } else {
                key_not_found_error(key_name, this.uuid);
            }
        }
};
Signals.addSignalMethods(_provider.prototype);

function settings_not_initialized_error(uuid) {
    global.logError("Could not set up binding - settings object was not initialized successfully for " + uuid);
}

function key_not_found_error (key_name, uuid) {
    global.logError("Could not find setting key '" + key_name + "' for applet/desklet uuid " + uuid);
}

function invalid_setting_type_error (key_name, uuid, type) {
    global.logError("Invalid setting type '" + type + "'' for setting key '" + key_name + "' of applet/desklet uuid " + uuid);
}


/* SettingObj maintains the working json data, updates, writes,
 * retrieves, etc.. to the individual settings during runtime
 */

function SettingObj(provider, file, uuid, instanceId) {
    this._init(provider, file, uuid, instanceId);
}

SettingObj.prototype = {
    _init: function (provider, file, uuid, instanceId) {
        this.provider = provider;
        this.file = file;
        this.uuid = uuid;
        this.instanceId = instanceId;
        let raw_file = Cinnamon.get_file_contents_utf8_sync(this.file.get_path());
        this.json = JSON.parse(raw_file);
        this.settings_file_monitor = this.file.monitor_file(Gio.FileMonitorFlags.NONE, null);
        this.monitor_id = this.settings_file_monitor.connect('changed', Lang.bind(this, this._on_file_changed));
        this.file_changed_timeout = null;
    },

    save: function() {
        this.settings_file_monitor.disconnect(this.monitor_id);
        if (this.file.delete(null, null)) {
            let f = Gio.file_new_for_path(this.file.get_path());
            let raw = f.replace(null, false, Gio.FileCreateFlags.NONE, null);
            let out_file = Gio.BufferedOutputStream.new_sized (raw, 4096);
            Cinnamon.write_string_to_stream(out_file, JSON.stringify(this.json, null, 4));
            out_file.close(null);
        } else {
            global.logError("Failed gain write access to settings file for applet/desklet '" + this.uuid + "', instance ") + this.instanceId;
        }
        this.monitor_id = this.settings_file_monitor.connect('changed', Lang.bind(this, this._on_file_changed));
    },

    get_data: function(key) {
        return this.json[key];
    },

    get_key_exists_and_type: function(key) {
        if (key in this.json) {
            return this.json[key]["type"];
        } else {
            return null;
        }
    },

    set_value: function(key, val) {
        this.json[key]["value"] = val;
        this.save();
    },

    set_options: function(key, val) {
        this.json[key]["options"] = val;
        this.save();
    },

    set_node_from_dbus: function(key, node) {
        let different = false;
        let old_val = this.json[key]['value'];
        let new_val = node['value']
        if (old_val != new_val) {
            this.json[key] = node;
            this.provider._value_changed_notify(key, old_val, new_val);
            this.emit("setting-file-changed");
            this.provider._setting_file_changed_notify();
            this.save(); // TODO: This is probably wrong to have here....should be earlier..but i'd rather do everything else first, for responsiveness
        }
    },

    _on_file_changed: function() {
        if (this.file_changed_timeout) {
            Mainloop.source_remove(this.file_changed_timeout);
        }
        this.file_changed_timeout = Mainloop.timeout_add(300, Lang.bind(this, this._on_file_changed_timeout))
    },

    _on_file_changed_timeout: function(monitor, file, n, eventType) {
        if (this.file.query_exists(null)) {
            if (eventType !== undefined && eventType != Gio.FileMonitorEvent.CHANGES_DONE_HINT) {
                return false;
            }
            let raw_file = Cinnamon.get_file_contents_utf8_sync(this.file.get_path());
            let new_json = JSON.parse(raw_file);
            for (let key in new_json) {
                if (this.json[key]['value'] != new_json[key]['value']) {
                    let oldval = this.json[key]['value'];
                    let newval = new_json[key]['value'];
                    this.json[key]['value'] = new_json[key]['value'];
                    this.provider._value_changed_notify(key, oldval, newval);
                }
            }
            this.emit("setting-file-changed");
            this.provider._setting_file_changed_notify();
        } else {
            this.settings_file_monitor.disconnect(this.monitor_id);
        }
        this.file_changed_timeout = null;
        return false;
    },

    finalize: function() {
        if (this.file_changed_timeout) {
            Mainloop.source_remove(this.file_changed_timeout);
        }
        if (this.monitor_id > 0) {
            this.settings_file_monitor.disconnect(this.monitor_id);
        }
        this.settings_file_monitor = null;
    }
};
Signals.addSignalMethods(SettingObj.prototype);


// Individual setting types

function _setting(sync_type, obj, key_name, settings_obj, applet_var, applet_callback, user_data) {
    this._init(sync_type, obj, key_name, settings_obj, applet_var, applet_callback, user_data);
}

_setting.prototype = {
    _init: function (sync_type, obj, key_name, settings_obj, applet_var, applet_callback, user_data) {
        this.key_name = key_name;
        this.settings_obj = settings_obj;
        this.applet_var = applet_var;
        this.sync_type = sync_type;
        obj[applet_var] = this.settings_obj.get_data(this.key_name)["value"];
        this.obj = obj;
        this.cb = applet_callback;
        this.settings_obj_connection_id = null;
        if (user_data) {
            this.user_data = user_data;
        }
        if (this.sync_type != BindingDirection.OUT) {
            this.settings_obj_connection_id = this.settings_obj.connect("setting-file-changed", Lang.bind(this, this._setting_file_changed));
        }
        this._monitor_applet_var(true);
    },

    _monitor_applet_var: function (state) {
        if (this.sync_type < BindingDirection.OUT)
            return;
        state ? this.obj.watch(this.applet_var, Lang.bind(this, this._on_applet_changed_value)) :
                this.obj.unwatch(this.applet_var);

        //add a save function for objects or arrays
        if(typeof(this.obj[this.applet_var]) === "object" && !this.obj[this.applet_var].save){
            this.obj[this.applet_var].save = Lang.bind(this, this.set_val, this.obj[this.applet_var]);
        }
    },

    _on_applet_changed_value: function (obj, oldval, newval) {
        this.set_val(newval);
        return newval;
    },

    _setting_file_changed: function () {
        if (this.sync_type != BindingDirection.OUT) {
            this.set_applet_var_and_cb(this.get_val());
        }
    },

    set_applet_var_and_cb: function (new_val) {
        if (new_val != this.obj[this.applet_var]) {
            this._monitor_applet_var(false);
            this.obj[this.applet_var] = new_val;
            if (this.user_data) {
                this.cb(this.user_data);
            } else {
                this.cb();
            }
            this._monitor_applet_var(true);
        }
    },

    get_data: function() {
        return this.settings_obj.get_data(this.key_name);
    },

    get_val: function() {
        return this.settings_obj.get_data(this.key_name)["value"];
    },

    set_val: function(val) {
        this.settings_obj.set_value(this.key_name, val);
    },

    finalize: function() {
        this._monitor_applet_var(false);
        if (this.settings_obj_connection_id) {
            this.settings_obj.disconnect(this.settings_obj_connection_id);
            this.settings_obj_connection_id = null;
        }
        this.settings_obj = null;
        this.applet_var = null;
        this.sync_type = null;
        this.obj = null;
        this.cb = null;
        this.user_data = null;
    }
};


/**
 * #AppletSettings:
 * @short_description: Settings object for applets.
 *
 * Inherits: Settings._provider
 */
function AppletSettings(xlet, uuid, instanceId) {
    this._init(xlet, uuid, instanceId);
}

AppletSettings.prototype = {
    __proto__: _provider.prototype,

    /**
     * _init:
     * @xlet (Object): the object variables are binded to (usually `this`)
     * @uuid (string): uuid of the applet
     * @instanceId (int): instance id of the applet
     */
    _init: function (xlet, uuid, instanceId) {
        _provider.prototype._init.call(this, xlet, uuid, instanceId, Extension.Type.APPLET, "Applet");
    },

    _get_is_multi_instance_xlet: function(uuid) {
        return Extension.get_max_instances(uuid, this.ext_type) != 1;
    },
};

/**
 * #DeskletSettings:
 * @short_description: Settings object for desklets.
 *
 * Inherits: Settings._provider
 */
function DeskletSettings(xlet, uuid, instanceId) {
    this._init(xlet, uuid, instanceId);
}

DeskletSettings.prototype = {
    __proto__: _provider.prototype,

    /**
     * _init:
     * @xlet (Object): the object variables are binded to (usually `this`)
     * @uuid (string): uuid of the desklet
     * @instanceId (int): instance id of the desklet
     */
    _init: function (xlet, uuid, instanceId) {
        _provider.prototype._init.call(this, xlet, uuid, instanceId, Extension.Type.DESKLET, "Desklet");
    },

    _get_is_multi_instance_xlet: function(uuid) {
        return Extension.get_max_instances(uuid, this.ext_type) > 1;
    }
};

/**
 * #ExtensionSettings:
 * @short_description: Settings object for extensions.
 *
 * Inherits: Settings._provider
 */
function ExtensionSettings(xlet, uuid) {
    this._init(xlet, uuid);
}

ExtensionSettings.prototype = {
    __proto__: _provider.prototype,

    /**
     * _init:
     * @xlet (Object): the object variables are binded to (usually `this`)
     * @uuid (string): uuid of the extension
     */
    _init: function (xlet, uuid) {
        _provider.prototype._init.call(this, xlet, uuid, null, Extension.Type.EXTENSION, "Extension");
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
