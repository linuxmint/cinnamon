const Signals = imports.signals;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Util = imports.misc.util;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const AppletManager = imports.ui.appletManager;
const DeskletManager = imports.ui.deskletManager;

const MK = imports.gi.CDesktopEnums.MediaKeyType;
const CinnamonDesktop = imports.gi.CinnamonDesktop;

const CUSTOM_KEYS_PARENT_SCHEMA = "org.cinnamon.desktop.keybindings";
const CUSTOM_KEYS_BASENAME = "/org/cinnamon/desktop/keybindings/custom-keybindings";
const CUSTOM_KEYS_SCHEMA = "org.cinnamon.desktop.keybindings.custom-keybinding";

const MEDIA_KEYS_SCHEMA = "org.cinnamon.desktop.keybindings.media-keys";

const REPEATABLE_MEDIA_KEYS = [
    MK.VOLUME_UP,
    MK.VOLUME_UP_QUIET,
    MK.VOLUME_DOWN,
    MK.VOLUME_DOWN_QUIET,
    MK.SCREEN_BRIGHTNESS_UP,
    MK.SCREEN_BRIGHTNESS_DOWN,
    MK.KEYBOARD_BRIGHTNESS_UP,
    MK.KEYBOARD_BRIGHTNESS_DOWN,
    MK.REWIND,
    MK.FORWARD,
];

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
        this.applet_bindings = new Map();
        this.kb_schema = Gio.Settings.new(CUSTOM_KEYS_PARENT_SCHEMA);
        this.setup_custom_keybindings();
        this.kb_schema.connect("changed::custom-list", Lang.bind(this, this.on_customs_changed));

        this.media_key_settings = new Gio.Settings({ schema_id: MEDIA_KEYS_SCHEMA });
        this.media_key_settings.connect("changed", Lang.bind(this, this.setup_media_keys));

        this.cinnamon_settings = new Gio.Settings({ schema_id: "org.cinnamon" });

        this.setup_media_keys();
    },

    on_customs_changed: function(settings, key) {
        this.remove_custom_keybindings();
        this.setup_custom_keybindings();
    },

    addHotKey: function(name, bindings_string, callback, flags, allowedModes) {
        if (!bindings_string)
            return false;
        return this.addHotKeyArray(name, bindings_string.split("::"), callback, flags, allowedModes);
    },

    _makeXletKey: function(xlet, name, binding) {
        return `${xlet._uuid}::${name}::${binding}`;
    },

    _uuidFromXletKey: function(xlet_key) {
        return xlet_key.split("::")[0];
    },

    /*  Menu applet example
     *
     *  uuid: menu@cinnamon.org
     *  binding name: overlay-key
     *    instances:
     *      49: super-l, super-r
     *      52: super-l, ctrl-shift-f7
     *
     *  is in applet_bindings as:
     *
     *  {
     *      "menu@cinnamon.org::overlay-key:super-l" : {
     *          "49": callback49,
     *          "52": callback52
     *      },
     *      "menu@cinnamon.org::overlay-key:super-r" : {
     *          "49": callback49
     *      },
     *      "menu@cinnamon.org::overlay-key:ctrl-shift-f7" : {
     *          "52": callback52
     *      }
     *  }
     */

    addXletHotKey: function(xlet, name, bindings_string, callback, flags, allowedModes) {
        this._removeMatchingXletBindings(xlet, name);

        if (!bindings_string)
            return false;

        let xlet_set = null;
        const instanceId = xlet.instance_id || 0; // extensions == undefined
        const binding_array = bindings_string.split("::");

        for (const binding of binding_array) {
            const xlet_key = this._makeXletKey(xlet, name, binding);
            xlet_set = this.applet_bindings.get(xlet_key);

            if (xlet_set === undefined) {
                xlet_set = new Map([
                    ["commitTimeoutId", 0]
                ]);
                this.applet_bindings.set(xlet_key, xlet_set);
            }

            xlet_set.set(instanceId, callback);

            this._queueCommitXletHotKey(xlet_key, binding, xlet_set, flags, allowedModes);
        }
    },

    _removeMatchingXletBindings: function(xlet, name) {
        // This sucks, but since the individual binding string is part of the name
        // name we send to muffin, we can't just call display.remove_keybinding(name),
        // and need to iterate thru the list finding our matching uuid and instance ids.
        const key_prefix = `${xlet._uuid}::${name}::`;
        const instanceId = xlet.instance_id || 0;
        const iter = this.applet_bindings.keys();

        for (const xlet_key of iter) {
            if (xlet_key.startsWith(key_prefix)) {
                const xlet_set = this.applet_bindings.get(xlet_key);
                if (xlet_set.has(instanceId)) {
                    xlet_set.delete(instanceId);
                    if (xlet_set.size === 1) { // only commitTimeoutId left
                        this.applet_bindings.delete(xlet_key);
                        this.removeHotKey(xlet_key);
                    }
                }
            }
        }
    },

    _xletCallback: function(lookup_key, display, window, kb, action) {
        const xlet_set = this.applet_bindings.get(lookup_key);
        if (!xlet_set) {
            return;
        }

        /* This should catch extensions also. The minimum size is 2 - 1 will be a
         * binding, plus the commitTimeoutId. */
        if (xlet_set.size === 2) {
            const iter = xlet_set.keys();
            for (const instanceId of iter) {
                if (instanceId === "commitTimeoutId") {
                    continue;
                }
                const callback = xlet_set.get(instanceId);
                callback(display, window, kb, action);
                break;
            }
            return;
        }

        const iter = xlet_set.keys();
        const uuid = this._uuidFromXletKey(lookup_key);
        const currentMonitor = Main.layoutManager.currentMonitor.index;

        let xlet = null
        let xletMonitor = 0;
        let primary_callback = null;
        let current_callback = null;

        for (instanceId of iter) {
            current_callback = xlet_set.get(instanceId);

            xlet = AppletManager.get_object_for_uuid(uuid, instanceId);

            if (!xlet) {
                xlet = DeskletManager.get_object_for_uuid(uuid, instanceId);
            }

            if (xlet) {
                const actor = xlet.actor;
                if (actor) {
                    xletMonitor = Main.layoutManager.findMonitorIndexForActor(actor);

                    if (xletMonitor === Main.layoutManager.primaryMonitor.index) {
                        primary_callback = current_callback;
                    }
                    if (xletMonitor == currentMonitor) {
                        current_callback(display, window, kb, action);
                        return;
                    }
                }
            }
        }

        // No match... more monitors than instances? Prefer the primary monitor's if we encountered it.
        if (primary_callback) {
            primary_callback(display, window, kb, action);
        } else {
            // Fallback to the last one we looked at otherwise.
            current_callback(display, window, kb, action);
        }
    },

    removeXletHotKey: function(xlet, name) {
        this._removeMatchingXletBindings(xlet, name);
    },

    _queueCommitXletHotKey: function(xlet_key, binding, xlet_set, flags, allowedModes) {
        let id = xlet_set.get("commitTimeoutId") ?? 0;

        if (id > 0) {
            GLib.source_remove(id);
        }

        id = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this.addHotKeyArray(xlet_key, [binding], this._xletCallback.bind(this, xlet_key), flags, allowedModes);
            xlet_set.set("commitTimeoutId", 0);
            return GLib.SOURCE_REMOVE;
        });

        xlet_set.set("commitTimeoutId", id);
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

    getBindingById: function(action_id) {
        return this.bindings.get(action_id);
    },

    addHotKeyArray: function(name, bindings, callback,
                             flags=Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
                             allowedModes=Cinnamon.ActionMode.NORMAL) {
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

        action_id = global.display.add_custom_keybinding_full(name, bindings, flags, callback);
        // log(`set keybinding: ${name}, bindings: ${bindings}, flags: ${flags}, allowedModes: ${allowedModes} - action id: ${action_id}`);

        if (action_id === Meta.KeyBindingAction.NONE) {
            global.logError("Warning, unable to bind hotkey with name '" + name + "'.  The selected keybinding could already be in use.");
            return false;
        }
        this.bindings.set(action_id, {
            "name"        : name,
            "bindings"    : bindings,
            "callback"    : callback,
            "allowedModes": allowedModes
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
        // Media keys before SEPARATOR work in all modes (global keys)
        // These should work during lock screen, unlock dialog, etc.
        let globalModes = Cinnamon.ActionMode.NORMAL | Cinnamon.ActionMode.OVERVIEW |
                         Cinnamon.ActionMode.LOCK_SCREEN | Cinnamon.ActionMode.UNLOCK_SCREEN |
                         Cinnamon.ActionMode.SYSTEM_MODAL | Cinnamon.ActionMode.LOOKING_GLASS |
                         Cinnamon.ActionMode.POPUP;

        for (let i = 0; i < MK.SEPARATOR; i++) {
            if (is_obsolete_mk(i)) {
                continue;
            }

            let flags = REPEATABLE_MEDIA_KEYS.includes(i)
                ? Meta.KeyBindingFlags.NONE
                : Meta.KeyBindingFlags.IGNORE_AUTOREPEAT;

            let bindings = this.media_key_settings.get_strv(CinnamonDesktop.desktop_get_media_key_string(i));
            this.addHotKeyArray("media-keys-" + i.toString(),
                           bindings,
                           Lang.bind(this, this.on_media_key_pressed, i),
                           flags,
                           globalModes);
        }

        // Media keys after SEPARATOR only work in normal mode
        for (let i = MK.SEPARATOR + 1; i < MK.LAST; i++) {
            if (is_obsolete_mk(i)) {
                continue;
            }

            let flags = REPEATABLE_MEDIA_KEYS.includes(i)
                ? Meta.KeyBindingFlags.NONE
                : Meta.KeyBindingFlags.IGNORE_AUTOREPEAT;

            let bindings = this.media_key_settings.get_strv(CinnamonDesktop.desktop_get_media_key_string(i));
            this.addHotKeyArray("media-keys-" + i.toString(),
                           bindings,
                           Lang.bind(this, this.on_media_key_pressed, i),
                           flags,
                           Cinnamon.ActionMode.NORMAL);
        }
        return true;
    },

    on_media_key_pressed: function(display, window, kb, action) {
        let [, entry] = this._lookupEntry("media-keys-" + action.toString());
        if (Main._shouldFilterKeybinding(entry))
            return;

        // Check if this is the screensaver key and internal screensaver is enabled
        if (action === MK.SCREENSAVER && this.cinnamon_settings.get_boolean('internal-screensaver-enabled')) {
            // Use internal screensaver (unless locked down)
            if (!Main.lockdownSettings.get_boolean('disable-lock-screen')) {
                Main.screenShield.lock();
            }
            return;
        }

        // Otherwise, forward to csd-media-keys (or other handler)
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

