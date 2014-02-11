const Signals = imports.signals;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Util = imports.misc.util;
const Meta = imports.gi.Meta;
const DBus = imports.dbus;

const CSD_DBUS_NAME = "org.cinnamon.SettingsDaemon";
const CSD_DBUS_PATH = "/org/cinnamon/SettingsDaemon/KeybindingHandler";

const CUSTOM_KEYS_PARENT_SCHEMA = "org.cinnamon.keybindings";
const CUSTOM_KEYS_BASENAME = "/org/cinnamon/keybindings/custom-keybindings";
const CUSTOM_KEYS_SCHEMA = "org.cinnamon.keybindings.custom-keybinding";

const MEDIA_KEYS_SCHEMA = "org.cinnamon.settings-daemon.plugins.media-keys"

/* Enums and gsettings key names - enums for ref, to match up with
   cinnamon-settings-daemon shortcuts-list.h

   value: enum value, of MediaKeyType
   key: gsettings key (in media-keys schema)
   kb: hardcoded keybinding

   key and kb are mutually exclusive, as in shortcuts-list.h
   Eventually maybe hardcoded bindings should be configurable

   We don't need everything here, just items we may want to access
   while a modal cinnamon dialog is open, otherwise we're better off
   just having c-s-d handling it.
*/

var MediaKeyTypes = {
  MUTE_KEY                    : {value: 3,  key: "volume-mute",             kb: null                    },
  VOLUME_DOWN_KEY             : {value: 4,  key: "volume-down",             kb: null                    },
  VOLUME_UP_KEY               : {value: 5,  key: "volume-up",               kb: null                    },
  EJECT_KEY                   : {value: 11, key: "eject",                   kb: null                    },
  MEDIA_KEY                   : {value: 13, key: "media",                   kb: null                    },
  SCREENSHOT_KEY              : {value: 19, key: "screenshot",              kb: null                    },
  WINDOW_SCREENSHOT_KEY       : {value: 20, key: "window-screenshot",       kb: null                    },
  PLAY_KEY                    : {value: 27, key: "play",                    kb: null                    },
  PAUSE_KEY                   : {value: 28, key: "pause",                   kb: null                    },
  STOP_KEY                    : {value: 29, key: "stop",                    kb: null                    },
  PREVIOUS_KEY                : {value: 30, key: "previous",                kb: null                    },
  NEXT_KEY                    : {value: 31, key: "next",                    kb: null                    },
  REWIND_KEY                  : {value: 32, key: null,                      kb: "XF86AudioRewind"       },
  FORWARD_KEY                 : {value: 33, key: null,                      kb: "XF86AudioForward"      },
  REPEAT_KEY                  : {value: 34, key: null,                      kb: "XF86AudioRepeat"       },
  RANDOM_KEY                  : {value: 35, key: null,                      kb: "XF86AudioRandomPlay"   }
};

const MediaKeysManagerInterface = {
    name: 'org.cinnamon.SettingsDaemon.KeybindingHandler',
    methods:
        [
            { name: 'HandleKeybinding', inSignature: 'u', outSignature: '' }
        ],
    signals: []
};

let MediaKeysManagerProxy = DBus.makeProxyClass(MediaKeysManagerInterface);

function KeybindingManager() {
    this._init();
}

KeybindingManager.prototype = {
    _init: function() {
        this._proxy = new MediaKeysManagerProxy(DBus.session, CSD_DBUS_NAME, CSD_DBUS_PATH);
        this.bindings = [];
        this.kb_schema = Gio.Settings.new(CUSTOM_KEYS_PARENT_SCHEMA);
        this.setup_custom_keybindings();
        this.kb_schema.connect("changed::custom-list", Lang.bind(this, this.on_customs_changed));

        this.csd_kb_settings = new Gio.Settings({ schema: MEDIA_KEYS_SCHEMA });
        this.csd_kb_settings.connect("changed", Lang.bind(this, this.setup_media_keys));
        this.setup_media_keys();

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
    },

    setup_media_keys: function() {
        for (let type in MediaKeyTypes) {
            if (MediaKeyTypes[type].key) {
                let keybinding = this.csd_kb_settings.get_string(MediaKeyTypes[type].key);
                this.addHotKey("settings-daemon-" + type.toString(),
                               keybinding,
                               Lang.bind(this, this.on_media_key_pressed, MediaKeyTypes[type].value));
            } else if (MediaKeyTypes[type].kb) {
                let keybinding = MediaKeyTypes[type].kb;
                this.addHotKey("settings-daemon-" + type.toString(),
                               keybinding,
                               Lang.bind(this, this.on_media_key_pressed, MediaKeyTypes[type].value));
            } else {
                global.logError("Invalid media-keys keybinding: " + type.toString());
            }
        }
    },

    on_media_key_pressed: function(display, screen, event, kb, action) {
        this._proxy.HandleKeybindingRemote(action);
    }
};
Signals.addSignalMethods(KeybindingManager.prototype);

