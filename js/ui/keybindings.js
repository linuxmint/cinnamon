const Signals = imports.signals;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Util = imports.misc.util;

const CUSTOM_KEYS_PARENT_SCHEMA = "org.cinnamon.keybindings";
const CUSTOM_KEYS_BASENAME = "/org/cinnamon/keybindings/custom-keybindings";
const CUSTOM_KEYS_SCHEMA = "org.cinnamon.keybindings.custom-keybinding";


function KeybindingManager() {
    this._init();
}

KeybindingManager.prototype = {
    _init: function() {
        this.bindings = [];
        this.kb_schema = Gio.Settings.new(CUSTOM_KEYS_PARENT_SCHEMA);
        this.setup_custom_keybindings();
        this.kb_schema.connect("changed::custom-list", Lang.bind(this, this.on_customs_changed));
    },

    on_customs_changed: function(settings, key) {
        this.remove_custom_keybindings();
        this.setup_custom_keybindings();
    },

    addHotKey: function(name, binding, callback) {
        if (this.bindings[name]) {
            global.display.remove_custom_keybinding(name);
        }
        if (binding == "") {
            global.logError("Empty keybinding set for " + name + ", ignoring");
            if (this.bindings[name]) {
                this.bindings[name] = undefined;
            }
            global.display.rebuild_keybindings();
            return true;
        }
        if (!global.display.add_custom_keybinding(name, binding, callback)) {
            global.logError("Warning, unable to bind hotkey with name '" + name + "'.  The selected keybinding could already be in use.");
            global.display.rebuild_keybindings();
            return false;
        } else {
            this.bindings[name] = binding;
        }
        global.display.rebuild_keybindings();
        return true;
    },

    removeHotKey: function(name) {
        global.display.remove_custom_keybinding(name);
        global.display.rebuild_keybindings();
        this.bindings[name] = undefined;
    },

    setup_custom_keybindings: function() {
        let list = this.kb_schema.get_strv("custom-list");

        for (let i = 0; i < list.length; i++) {
            let custom_path = CUSTOM_KEYS_BASENAME + "/" + list[i] + "/";
            let schema = Gio.Settings.new_with_path(CUSTOM_KEYS_SCHEMA, custom_path);
            let command = schema.get_string("command");
            let binding = schema.get_string("binding");
            let name = list[i];
            this.addHotKey(name, binding, Lang.bind(this, function() {
                Util.spawnCommandLine(command);
            }))
        }
    },

    remove_custom_keybindings: function() {
        for (let i in this.bindings) {
            if (i.indexOf("custom") > -1) {
                this.removeHotKey(i);
            }
        }
    }


};
Signals.addSignalMethods(KeybindingManager.prototype);

