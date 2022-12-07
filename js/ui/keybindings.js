const Signals = imports.signals;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Util = imports.misc.util;
const Meta = imports.gi.Meta;

const MK = imports.gi.CDesktopEnums.MediaKeyType;
const CinnamonDesktop = imports.gi.CinnamonDesktop;

const CUSTOM_KEYS_PARENT_SCHEMA = "org.cinnamon.desktop.keybindings";
const CUSTOM_KEYS_BASENAME = "/org/cinnamon/desktop/keybindings/custom-keybindings";
const CUSTOM_KEYS_SCHEMA = "org.cinnamon.desktop.keybindings.custom-keybinding";

const MEDIA_KEYS_SCHEMA = "org.cinnamon.desktop.keybindings.media-keys";

const OBSOLETE_MEDIA_KEYS = [
    MK.VIDEO_OUT,
    MK.ROTATE_VIDEO
]

function is_obsolete_mk(key_enum) {
    return OBSOLETE_MEDIA_KEYS.includes(key_enum);
};

const iface = "\
    <node> \
      <interface name='org.cinnamon.SettingsDaemon.KeybindingHandler'> \
        <annotation name='org.freedesktop.DBus.GLib.CSymbol' value='csd_media_keys_manager'/> \
        <method name='HandleKeybinding'> \
          <arg name='type' direction='in' type='u'/> \
        </method> \
      </interface> \
    </node>";

const proxy = Gio.DBusProxy.makeProxyWrapper(iface);

function KeybindingManager() {
    this._init();
}

KeybindingManager.prototype = {
    _init: function() {
        this._proxy = new proxy(Gio.DBus.session,
                                'org.cinnamon.SettingsDaemon.KeybindingHandler',
                                '/org/cinnamon/SettingsDaemon/KeybindingHandler');

        /* Keep track of bindings so we can a) check if they've change (and avoid the work
         * if the haven't), b) handle the callbacks when the keystrokes are captured by
         * Main._stageEventHandler.
         *
         * This dict will contain [name, bindings, callback] and keyed on the id returned by
         * add_custom_keybinding. */
        this.bindings = new Map();
        this.kb_schema = Gio.Settings.new(CUSTOM_KEYS_PARENT_SCHEMA);
        this.setup_custom_keybindings();
        this.kb_schema.connect("changed::custom-list", Lang.bind(this, this.on_customs_changed));

        this.media_key_settings = new Gio.Settings({ schema_id: MEDIA_KEYS_SCHEMA });
        this.media_key_settings.connect("changed", Lang.bind(this, this.setup_media_keys));
        this.setup_media_keys();
    },

    on_customs_changed: function(settings, key) {
        this.remove_custom_keybindings();
        this.setup_custom_keybindings();
    },

    addHotKey: function(name, bindings_string, callback) {
        if (!bindings_string)
            return false;
        return this.addHotKeyArray(name, bindings_string.split("::"), callback);
    },

    _lookupEntry: function(name) {
        let found = 0;
        for (const action_id of this.bindings.keys()) {
            let entry = this.bindings.get(action_id);
            if (entry !== undefined && entry.name === name) {
                return [action_id, entry];
            }
        }

        return [Meta.KeyBindingAction.NONE, undefined];
    },

    addHotKeyArray: function(name, bindings, callback) {
        let [existing_action_id, entry] = this._lookupEntry(name);

        if (entry !== undefined) {
            if (entry.bindings.toString() === bindings.toString()) {
                return true;
            }
            global.display.remove_keybinding(name);
            this.bindings.delete(existing_action_id);
        }

        if (!bindings) {
            global.logError("Missing bindings array for keybinding: " + name);
            return false;
        }

        let empty = true;
        for (let i = 0; empty && (i < bindings.length); i++) {
            empty = bindings[i].toString().trim() == "";
        }

        if (empty) {
            return true;
        }

        action_id = global.display.add_custom_keybinding(name, bindings, callback);
        // log(`set keybinding: ${name}, bindings: ${bindings} - action id: ${action_id}`);

        if (action_id === Meta.KeyBindingAction.NONE) {
            global.logError("Warning, unable to bind hotkey with name '" + name + "'.  The selected keybinding could already be in use.");
            return false;
        }
        this.bindings.set(action_id, {
            "name"    : name,
            "bindings": bindings,
            "callback": callback
        });

        return true;
    },

    removeHotKey: function(name) {
        let [action_id, entry] = this._lookupEntry(name);

        if (entry === undefined) {
            return;
        }

        global.display.remove_keybinding(name);
        this.bindings.delete(action_id);
    },

    setup_custom_keybindings: function() {
        let list = this.kb_schema.get_strv("custom-list");

        for (let i = 0; i < list.length; i++) {
            if (list[i] === "__dummy__") {
                continue;
            }

            let custom_path = CUSTOM_KEYS_BASENAME + "/" + list[i] + "/";
            let schema = Gio.Settings.new_with_path(CUSTOM_KEYS_SCHEMA, custom_path);
            let command = schema.get_string("command");
            let binding = schema.get_strv("binding");
            let name = list[i];
            this.addHotKeyArray(name, binding, Lang.bind(this, function() {
                Util.spawnCommandLine(command);
            }))
        }
    },

    remove_custom_keybindings: function() {
        for (const action_id of this.bindings.keys()) {
            name = this.bindings.get(action_id).name;
            if (name && name.indexOf("custom") > -1) {
                global.display.remove_keybinding(name);
                this.bindings.delete(action_id);
            }
        }
    },

    setup_media_keys: function() {
        for (let i = 0; i < MK.SEPARATOR; i++) {
            if (is_obsolete_mk(i)) {
                continue;
            }

            let bindings = this.media_key_settings.get_strv(CinnamonDesktop.desktop_get_media_key_string(i));
            this.addHotKeyArray("media-keys-" + i.toString(),
                           bindings,
                           Lang.bind(this, this.on_global_media_key_pressed, i));
        }

        for (let i = MK.SEPARATOR + 1; i < MK.LAST; i++) {
            if (is_obsolete_mk(i)) {
                continue;
            }

            let bindings = this.media_key_settings.get_strv(CinnamonDesktop.desktop_get_media_key_string(i));
            this.addHotKeyArray("media-keys-" + i.toString(),
                           bindings,
                           Lang.bind(this, this.on_media_key_pressed, i));
        }
        return true;
    },

    on_global_media_key_pressed: function(display, window, kb, action) {
        // log(`global media key ${display}, ${window}, ${kb}, ${action}`);
        this._proxy.HandleKeybindingRemote(action);
    },

    on_media_key_pressed: function(display, window, kb, action) {
        // log(`media key ${display}, ${window}, ${kb}, ${action}`);
        if (Main.modalCount == 0 && !Main.overview.visible && !Main.expo.visible)
            this._proxy.HandleKeybindingRemote(action);
    },

    invoke_keybinding_action_by_id: function(id) {
        const binding = this.bindings.get(id);
        if (binding !== undefined) {
            // log(`invoke_keybinding_action_by_id: ${binding.name}, bindings: ${binding.bindings} - action id: ${id}`);
            binding.callback(null, null, null);
        }
    }
};
Signals.addSignalMethods(KeybindingManager.prototype);

