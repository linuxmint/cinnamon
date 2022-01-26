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

const RUNTIME_ENTRY_SCHEMA_ID = "org.cinnamon.runtime-keybindings.runtime-keybinding"

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
        // name: gsettings
        this._bindings = {};

        this.kb_schema = Gio.Settings.new(CUSTOM_KEYS_PARENT_SCHEMA);

        // this.runtime_backend = Gio.memory_settings_backend_new();
        this.runtime_backend = Gio.SettingsBackend.get_default();
        this.runtime_schema = new Gio.Settings({ schema_id: "org.cinnamon.runtime-keybindings",
                                                 backend: this.runtime_backend });
        this.schema = this.runtime_schema.settings_schema;

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

        return this._add_keybinding(name,
                                    bindings_string.split("::"),
                                    Meta.KeyBindingFlags.PER_WINDOW,
                                    callback);
    },

    addHotKeyArray: function(name, bindings, callback) {
        return this._add_keybinding(name,
                                    bindings,
                                    Meta.KeyBindingFlags.PER_WINDOW,
                                    callback);
    },


    removeHotKey: function(name) {
        return this._remove_keybinding(name);
    },

    _add_keybinding: function(name, bindings, flags, handler) {
        let settings = this._bindings[name];

        if (settings !== undefined) {
            if (this._bindings[name] === bindings) {
              return true;
            }

            global.display.remove_keybinding(`RUNTIME-${name}`);
        }

        if (!bindings) {
            global.logError("Missing bindings array for keybinding: " + name);
            this._bindings[name] = undefined;
            return false;
        }

        let empty = true;
        for (let i = 0; empty && (i < bindings.length); i++) {
            empty = bindings[i].toString().trim() == "";
        }

        if (empty) {
            this._bindings[name] = undefined;
            return true;
        }

        if (settings === undefined) {
            name = name.replace("_", "-");

            custom_schema_path = `/org/cinnamon/runtime-keybindings/${name}/`;
            custom_schema_id = `org.cinnamon.runtime-keybindings.${name}`;

            settings = Gio.Settings.new_with_backend_and_path(RUNTIME_ENTRY_SCHEMA_ID,
                                                              this.runtime_backend,
                                                              custom_schema_path);
        }

        settings.set_strv("bindings", bindings);
        Gio.Settings.sync();

        let ret = global.display.add_keybinding(`RUNTIME-${name}`, settings, flags, handler);

        if (ret === Meta.KeyBindingAction.NONE) {
            global.logError("Warning, unable to bind hotkey with name '" + name + "'.  The selected keybinding could already be in use.");
            return false;
        }

        this._bindings[name] = settings;
        return true;
    },

    _remove_keybinding: function(name) {
        let settings = this._bindings[name];

        if (settings === undefined)
            return;

        name = name.replace("_", "-");
        tmp.reset("bindings")

        let ret = global.display.remove_keybinding(`RUNTIME-${name}`);
        this._bindings[name] = undefined;

        return ret;
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
            let bindings = schema.get_strv("binding");
            let name = list[i];
            this._add_keybinding(name, bindings, Meta.KeyBindingFlags.PER_WINDOW,
                                 Lang.bind(this, function() {
                                     Util.spawnCommandLine(command);
                                 }));
        }
    },

    remove_custom_keybindings: function() {
        let list = this.kb_schema.get_strv("custom-list");

        for (let i = 0; i < list.length; i++) {
            if (list[i] === "__dummy__") {
                continue;
            }

            this._remove_keybinding(list[i]);
        }
    },

    setup_media_keys: function() {
        for (let i = 0; i < MK.SEPARATOR; i++) {
            let bindings = this.media_key_settings.get_strv(CinnamonDesktop.desktop_get_media_key_string(i));
            this._add_keybinding("media-keys-" + i.toString(), bindings, Meta.KeyBindingFlags.PER_WINDOW,
                                 Lang.bind(this, this.on_global_media_key_pressed, i));
        }

        for (let i = MK.SEPARATOR + 1; i < MK.LAST; i++) {
            let bindings = this.media_key_settings.get_strv(CinnamonDesktop.desktop_get_media_key_string(i));
            this._add_keybinding("media-keys-" + i.toString(), bindings, Meta.KeyBindingFlags.PER_WINDOW,
                                 Lang.bind(this, this.on_media_key_pressed, i));
        }
        return true;
    },

    on_global_media_key_pressed: function(display, window, kb, action) {
        this._proxy.HandleKeybindingRemote(action);
    },

    on_media_key_pressed: function(display, window, kb, action) {
        if (Main.modalCount == 0 && !Main.overview.visible && !Main.expo.visible)
            this._proxy.HandleKeybindingRemote(action);
    }
};
Signals.addSignalMethods(KeybindingManager.prototype);

