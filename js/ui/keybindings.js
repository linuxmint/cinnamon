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
        this.bindings = {};
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
        for (let key in this.bindings) {
            let entry = this.bindings[key];
            if (entry !== undefined && entry.name === name) {
                return entry;
            }
        }
    },

    addHotKeyArray: function(name, bindings, callback) {
        let entry = this._lookupEntry(name);
        if (entry !== undefined) {
            if (entry.bindings.toString() === bindings.toString()) {
              return true;
            }
            global.display.remove_keybinding(name);
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
            if (entry !== undefined) {
                this.bindings[name] = undefined;
            }
            return true;
        }

        let action_id = global.display.add_custom_keybinding(name, bindings, callback);

        if (action_id === Meta.KeyBindingAction.NONE) {
            global.logError("Warning, unable to bind hotkey with name '" + name + "'.  The selected keybinding could already be in use.");
            return false;
        } else {
            this.bindings[action_id] = {
                "name"    : name,
                "bindings": bindings,
                "callback": callback
            };
        }

        return true;
    },

    removeHotKey: function(name) {
        if (this.bindings[name] == undefined)
            return;
        global.display.remove_keybinding(name);
        this.bindings[name] = undefined;
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
        for (let i in this.bindings) {
            if (i.indexOf("custom") > -1) {
                this.removeHotKey(i);
            }
        }
    },

    setup_media_keys: function() {
        for (let i = 0; i < MK.SEPARATOR; i++) {
            let bindings = this.media_key_settings.get_strv(CinnamonDesktop.desktop_get_media_key_string(i));
            this.addHotKeyArray("media-keys-" + i.toString(),
                           bindings,
                           Lang.bind(this, this.on_global_media_key_pressed, i));
        }

        for (let i = MK.SEPARATOR + 1; i < MK.LAST; i++) {
            let bindings = this.media_key_settings.get_strv(CinnamonDesktop.desktop_get_media_key_string(i));
            this.addHotKeyArray("media-keys-" + i.toString(),
                           bindings,
                           Lang.bind(this, this.on_media_key_pressed, i));
        }
        return true;
    },

    on_global_media_key_pressed: function(display, window, kb, action) {
        // log(`${display}, ${screen}, ${event}, ${kb}, ${action}`);
        this._proxy.HandleKeybindingRemote(action);
    },

    on_media_key_pressed: function(display, window, kb, action) {
        // log(`${display}, ${screen}, ${event}, ${kb}, ${action}`);
        if (Main.modalCount == 0 && !Main.overview.visible && !Main.expo.visible)
            this._proxy.HandleKeybindingRemote(action);
    },

    invoke_keybinding_action_by_id: function(id) {
        if (this.bindings[id] !== undefined) {
            this.bindings[id].callback();
        }
    }
};
Signals.addSignalMethods(KeybindingManager.prototype);

