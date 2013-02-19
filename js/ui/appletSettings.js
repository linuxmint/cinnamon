
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const Signals = imports.signals;
const AppletManager = imports.ui.appletManager;
const Extension = imports.ui.extension;

const SETTING_SCHEMA_FILE = "settings-schema.json"

const BindingDirection = {
    SYNC_ONCE : 1,  // Applet property set at initialization only, manual updating required
    ONE_WAY : 2,  // Applet property is updated automatically from settings.json
    BIDIRECTIONAL : 3 // Applet property updated automatically from settings.json, and vise-versa
};

var BOOLEAN_TYPES = {
    "checkbox" : {
        "required-fields": [
            "type",
            "default",
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

var STRING_TYPES = {
    "entry" : {
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
    "generic" : {
        "required-fields": [
            "type",
            "default"
        ]
    }
};

var NUMBER_TYPES = {
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
    "combobox" : {
        "required-fields": [
            "type",
            "default",
            "description",
            "options"
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

var GENERIC_TYPES = {
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
    }
};


function AppletSettings(xlet, uuid, instanceId) {
    this._init(xlet, uuid, instanceId, Extension.Type.APPLET, "Applet");
}

AppletSettings.prototype = {
        _init: function (xlet, uuid, instanceId, type, string) {
            if (type && string) {
                this.ext_type = type;
                this.xlet_str = string;
            }
            if (!xlet) {
                global.logError(_("%s constructor arguments invalid").format(this.xlet_str));
                global.logError(_("First argument MUST be a(n) %s object (use 'this' as the first argument").format(this.xlet_str));
                return;
            }
            if (!uuid) {
                global.logError(_("%sSettings constructor arguments invalid").format(this.xlet_str));
                global.logError(_("Missing required UUID as second argument - should be a string:"));
                global.logError(_("<%s-name>@<your-id>.org or something similar").format(this.xlet_str));
                return;
            }
            this.uuid = uuid;
            this.xlet = xlet;
            if (!instanceId && this.ext_type != Extension.Type.EXTENSION) {
                global.logWarning(_("%sSettings constructor arguments warning").format(this.xlet_str));
                global.logWarning(_("Missing instance ID as third argument"));
                global.logWarning(_("The %s UUID is %s").format(this.xlet_str, this.uuid));
            }
            this.instanceId = instanceId;
            this.valid = false;
            this.applet_dir = Extension.findExtensionDirectory(this.uuid, this.ext_type);
            if (!this.applet_dir) {
                global.logError(_("Could not find %s installation directory for %s.").format(this.xlet_str, this.uuid));
                return;
            }
            this.multi_instance = this._get_is_multi_instance_xlet(this.uuid);
            if (this.multi_instance && !this.instanceId) {
                global.logError(_("%sSettings fatal error!").format(this.xlet_str));
                global.logError(_("Multi-instanciable %s with no instance ID supplied").format(this.xlet_str));
                global.logError(_("The %s UUID is %s").format(this.xlet_str, this.uuid));
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
                    global.logError(_("Problem initializing settings for %s").format(this.uuid));
                    return;
                }
            } else {
                if (!this._maybe_update_settings_file()) {
                    global.logError(_("Problem updating settings for %s").format(this.uuid));
                    return;
                }
            }

            this.metaBindings = {}
            if (!this.instanceId) {
                this.instanceId = 0; 
            }
            this.settings_obj = new SettingObj(this.settings_file, this.uuid, this.instanceId);
            this.settings_obj.connect("setting-file-changed", Lang.bind(this, this._setting_file_changed));

            this.valid = true;
        },

        _get_is_multi_instance_xlet: function(uuid) {
            let num = -1;
            num = AppletManager.get_num_instances_for_applet(uuid);
            return num > 1 || num == -1;
        },

        _create_settings_file: function () {
            if (!this.settings_file.get_parent().query_exists(null)) {
                this.settings_file.get_parent().make_directory_with_parents(null)
            }
            let orig_file = this.applet_dir.get_child(SETTING_SCHEMA_FILE);
            if (!orig_file.query_exists(null)) {
                global.logError(_("Failed to locate %s for %s %s").format(SETTING_SCHEMA_FILE, this.xlet_str, this.uuid));
                return false;
            }
            let init_file_contents = Cinnamon.get_file_contents_utf8_sync(orig_file.get_path());
            let checksum = global.get_md5_for_string(init_file_contents);

            let init_json
            try {
                init_json = JSON.parse(init_file_contents);
            } catch (e) {
                global.logError(_("Cannot parse %s file for %s %s.  Check the structure for missing commas, etc... Error is: %s").format(SETTING_SCHEMA_FILE, this.xlet_str, this.uuid, e));
                return false;
            }
            if (!this._json_validity_check(init_json)) {
                global.logError(_("Initial %s file is not valid for %s %s").format(SETTING_SCHEMA_FILE, this.xlet_str, this.uuid));
                return false;
            }

            for (let key in init_json) {
                init_json[key]["value"] = init_json[key]["default"]
            }
            init_json["__md5__"] = checksum;
            let out_file = JSON.stringify(init_json, null, 4);

            let fp = this.settings_file.create(0, null);
            fp.write(out_file, null);
            fp.close(null);

            return true;
        },

        _json_validity_check: function (init_json) {
            let primary_key;
            let valid = false;
            for (primary_key in init_json) {
                valid = this._check_for_min_props(init_json[primary_key])
                if (!valid)
                    break;
            }
            return valid;
        },

        _check_for_min_props: function (node) {
            if (node["type"] in BOOLEAN_TYPES) {
                for (let req_field in BOOLEAN_TYPES[node["type"]]["required-fields"]) {
                    if (BOOLEAN_TYPES[node["type"]]["required-fields"][req_field] in node) {
                        continue;
                    } else {
                        return false;
                    }
                }
                return true;
            } else if (node["type"] in STRING_TYPES) {
                for (let req_field in STRING_TYPES[node["type"]]["required-fields"]) {
                    if (STRING_TYPES[node["type"]]["required-fields"][req_field] in node) {
                        continue;
                    } else {
                        return false;
                    }
                }
                return true;
            } else if (node["type"] in NUMBER_TYPES) {
                for (let req_field in NUMBER_TYPES[node["type"]]["required-fields"]) {
                    if (NUMBER_TYPES[node["type"]]["required-fields"][req_field] in node) {
                        continue;
                    } else {
                        return false;
                    }
                }
                return true;
            } else if (node["type"] in GENERIC_TYPES) {
                for (let req_field in GENERIC_TYPES[node["type"]]["required-fields"]) {
                    if (GENERIC_TYPES[node["type"]]["required-fields"][req_field] in node) {
                        continue;
                    } else {
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
                global.logWarning(_("Failed to locate %s for %s %s to check for updates").format(SETTING_SCHEMA_FILE, this.xlet_str, this.uuid));
                global.logWarning(_("Something may not be right"));
                return false;
            }
            let init_file_contents = Cinnamon.get_file_contents_utf8_sync(orig_file.get_path());
            let checksum = global.get_md5_for_string(init_file_contents);

            let existing_settings_file = Cinnamon.get_file_contents_utf8_sync(this.settings_file.get_path());
            let existing_json;
            let new_json;
            try {
                existing_json = JSON.parse(existing_settings_file);
                new_json = JSON.parse(init_file_contents);
            } catch (e) {
                global.logError(_("Problem parsing settings files for %s %s while preparing to perform upgrade").format(this.xlet_str, this.uuid));
                global.logError(_("Skipping upgrade for now - something may be wrong with the new %s file.").format(SETTING_SCHEMA_FILE));
                return false;
            }
            if (existing_json["__md5__"] != checksum) {
                global.log(_("Updated settings file detected for %s %s.  Beginning upgrade of existing settings").format(this.xlet_str, this.uuid));
                return this._do_upgrade(new_json, existing_json, checksum);
            } else {
                return true;
            }
        },

        _do_upgrade: function(new_json, old_json, checksum) {
            // First, check the new json for validity
            if (!this._json_validity_check(new_json)) {
                global.logError(_("Upgraded %s file is NOT valid for %s %s.").format(SETTING_SCHEMA_FILE, this.xlet_str, this.uuid));
                global.logError(_("Aborting settings upgrade."));
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

            let out_file = JSON.stringify(new_json, null, 4);

            if (this.settings_file.delete(null, null)) {
                let fp = this.settings_file.create(0, null);
                fp.write(out_file, null);
                fp.close;
                global.log(_("Upgrade complete"));
                return true;
            } else {
                global.logError(_("Failed to gain write access to save updated settings for %s %s, instance %s").format(this.xlet_str, this.uuid, this.instanceId));
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


/* _settings_file_changed:  For convenience only, if you want to handle updating your applet props yourself,
 * connect to this signal on your AppletSettings object to get notified when the json file changes, then
 * you can call AppletSettings.getValue(key) to update your props
 */

        _setting_file_changed: function() {
            this.emit("settings-changed");
        },

/* Public api:  bind an applet property/variable to a setting
 *
 *        sync_type:  BindingDirection.SYNC_ONCE, .ONE_WAY, or .BIDIRECTIONAL (see declaration at top of file)
 *         key_name:  The id of the setting
 *       applet_var:  The applet's property that is used to hold the setting, passed as a string
 *                    (i.e. your applet's this.value passes as simply "value")
 *  applet_callback:  The applet method to call when the setting has changed and the new value set (or null)
 *        user_data:  Any extra data/object you wish to pass to the callback (or null)
 */

        bindProperty: function (sync_type, key_name, applet_var, applet_callback, user_data) {
            if (!this.valid) {
                settings_not_initialized_error(this.uuid);
                return false;
            }
            let type = this.settings_obj.get_key_exists_and_type(key_name);
            if (type) {
                if (type in BOOLEAN_TYPES || type in STRING_TYPES || type in NUMBER_TYPES) {
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

        getValue: function (key_name) {
            if (key_name in this.settings_obj.json) {
                return this.settings_obj.get_data(key_name)["value"];
            } else {
                key_not_found_error(key_name, this.uuid);
                return null;
            }
        },

        setValue: function (key_name, value) {
            if (key_name in this.settings_obj.json) {
                let oldval = this.settings_obj.get_data(key_name)["value"];
                if (oldval != value) {
                    this.settings_obj.set_value(key_name, value);
                }
            } else {
                key_not_found_error(key_name, this.uuid);
                return null;
            }
        }
};
Signals.addSignalMethods(AppletSettings.prototype);

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

function SettingObj(file, uuid, instanceId) {
    this._init(file, uuid, instanceId);
}

SettingObj.prototype = {
    _init: function (file, uuid, instanceId) {
        this.file = file;
        this.uuid = uuid;
        this.instanceId = instanceId;
        let raw_file = Cinnamon.get_file_contents_utf8_sync(this.file.get_path());
        this.json = JSON.parse(raw_file);
        this.settings_file_monitor = this.file.monitor_file(Gio.FileMonitorFlags.NONE, null);
        this.monitor_id = this.settings_file_monitor.connect('changed', Lang.bind(this, this._on_file_changed));
    },

    save: function() {
        this.settings_file_monitor.disconnect(this.monitor_id);
        let raw_file = JSON.stringify(this.json, null, 4);
        if (this.file.delete(null, null)) {
            let fp = this.file.create(0, null);
            fp.write(raw_file, null);
            fp.close;
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

    _on_file_changed: function() {
        if (this.file.query_exists(null)) {
            let raw_file = Cinnamon.get_file_contents_utf8_sync(this.file.get_path());
            let new_json = JSON.parse(raw_file);
            for (let key in new_json) {
                this.json[key]['value'] = new_json[key]['value'];
            }
            this.emit("setting-file-changed")
        } else {
            this.settings_file_monitor.disconnect(this.monitor_id);
        }
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
        if (user_data) {
            this.user_data = user_data;
        }
        if (this.sync_type == BindingDirection.ONE_WAY) {
            this.settings_obj.connect("setting-file-changed", Lang.bind(this, this._setting_file_changed));
        } else if (this.sync_type == BindingDirection.BIDIRECTIONAL) {
            this.settings_obj.connect("setting-file-changed", Lang.bind(this, this._setting_file_changed));
            this._monitor_applet_var(true);
        }
    },

    _monitor_applet_var: function (state) {
        if (this.sync_type != BindingDirection.BIDIRECTIONAL)
            return;
        state ? this.obj.watch(this.applet_var, Lang.bind(this, this._on_applet_changed_value)) :
                this.obj.unwatch(this.applet_var);
    },

    _on_applet_changed_value: function (obj, oldval, newval) {
        this.set_val(newval);
        return newval;
    },

    _setting_file_changed: function () {
        if (this.sync_type > BindingDirection.SYNC_ONCE) {
            let new_val = this.get_val();
            if (new_val != this.obj[this.applet_var]) {
                this._monitor_applet_var(false);
                this.obj[this.applet_var] = this.get_val();
                if (this.user_data) {
                    this.cb(user_data);
                } else {
                    this.cb();
                }
                this._monitor_applet_var(true);
            }
        }
    },

    get_data: function() {
        return this.settings_obj.get_data(this.key_name);
    },

    get_val: function() {
        return this.settings_obj.get_data(this.key_name)["value"];
    },

    get_min: function() {
        return this.settings_obj.get_data(this.key_name)["min"];
    },

    get_max: function() {
        return this.settings_obj.get_data(this.key_name)["max"];
    },

    set_val: function(val) {
        this.settings_obj.set_value(this.key_name, val);
    }
};
Signals.addSignalMethods(_setting.prototype);

