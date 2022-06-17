// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Main = imports.ui.main;
const Gdk = imports.gi.Gdk;
const Keymap = Gdk.Keymap.get_default();
const SignalManager = imports.misc.signalManager;
const Gio = imports.gi.Gio;
const CDesktopEnums = imports.gi.CDesktopEnums;
const Flashspot = imports.ui.flashspot;
const Clutter = imports.gi.Clutter;
const Dialogs = imports.ui.wmGtkDialogs;

const CAPS = 0;
const NUM = 1;

const HOVERKEY_ACTIONS = {
    "single": Clutter.PointerA11yDwellClickType.PRIMARY,
    "double": Clutter.PointerA11yDwellClickType.DOUBLE,
    "drag": Clutter.PointerA11yDwellClickType.DRAG,
    "secondary": Clutter.PointerA11yDwellClickType.SECONDARY
}

function A11yHandler(){
    this._init();
}

A11yHandler.prototype = {
    _init: function() {
        this.a11y_keyboard_settings = new Gio.Settings( { schema_id: "org.cinnamon.desktop.a11y.keyboard" });
        this.a11y_mouse_settings = new Gio.Settings( { schema_id: "org.cinnamon.desktop.a11y.mouse" });
        this.wm_settings = new Gio.Settings( { schema_id: "org.cinnamon.desktop.wm.preferences" });

        this._signalManager = new SignalManager.SignalManager(null);

        this._hoverclick_helper = new Dialogs.HoverClickHelper();

        /* Feature toggles */
        this._toggle_keys_osd = false;
        this._toggle_keys_sound = false;
        this._events_flash = false;
        this._events_sound = false
        this._hoverclick_enabled = false;

        /* Options */
        this.state_on_sound = null;
        this.state_off_sound = null;
        this.event_bell_sound = null;
        this.event_flash_type = null;

        this.caps = Keymap.get_caps_lock_state();
        this.num = Keymap.get_num_lock_state();

        this._signalManager.connect(this.a11y_keyboard_settings, "changed", this.on_settings_changed, this);
        this._signalManager.connect(this.a11y_mouse_settings, "changed", this.on_settings_changed, this);
        this._signalManager.connect(global.settings, "changed::hoverclick-action", this.hoverkey_action_changed, this);

        this.on_settings_changed();
        this.hoverkey_action_changed();
    },

    _set_keymap_listener: function(enabled) {
        if (enabled)
            this._signalManager.connect(Keymap, "state-changed", this.on_keymap_state_changed, this);
        else
            this._signalManager.disconnect("state-changed");
    },

    on_settings_changed: function(settings, key) {
        this.state_on_sound = this.a11y_keyboard_settings.get_string("togglekeys-sound-on");
        this.state_off_sound = this.a11y_keyboard_settings.get_string("togglekeys-sound-off");

        this._toggle_keys_osd = this.a11y_keyboard_settings.get_boolean("togglekeys-enable-osd");
        this._toggle_keys_sound = this.a11y_keyboard_settings.get_boolean("togglekeys-enable-beep");

        if (key === "dwell-click-enabled") {
            this._hoverclick_enabled = this.a11y_mouse_settings.get_boolean("dwell-click-enabled");
            this._hoverclick_helper.set_active(this._hoverclick_enabled);
        }

        if (this._toggle_keys_sound || this._toggle_keys_osd) {
            this._set_keymap_listener(true);
        } else {
            this._set_keymap_listener(false);
        }
    },

    hoverkey_action_changed: function(settings, key) {
        let action = global.settings.get_string("hoverclick-action");

        seat = Clutter.get_default_backend().get_default_seat();

        try {
            seat.set_pointer_a11y_dwell_click_type(HOVERKEY_ACTIONS[action]);
        } catch (e) {
            global.logError("Attempted to use invalid action name for hoverclick")
        }
    },

    on_keymap_state_changed: function(keymap) {
        let new_caps = Keymap.get_caps_lock_state();
        let new_num = Keymap.get_num_lock_state();

        if (this._toggle_keys_osd) {
            if (new_caps != this.caps) {
                this.popup_state_osd(CAPS, new_caps);
            }

            if (new_num != this.num) {
                this.popup_state_osd(NUM, new_num);
            }
        }

        if (this._toggle_keys_sound) {
            if (new_caps != this.caps) {
                this.play_state_sound(CAPS, new_caps);
            }

            if (new_num != this.num) {
                this.play_state_sound(NUM, new_num);
            }
        }

        this.caps = new_caps;
        this.num = new_num;
    },

    popup_state_osd: function(key, state) {
        let icon = null;

        switch (key) {
            case CAPS:
                icon = Gio.ThemedIcon.new(state ? "cinnamon-caps-lock-symbolic" :
                                                  "cinnamon-caps-lock-off-symbolic");
                break;
            case NUM:
                icon = Gio.ThemedIcon.new(state ? "cinnamon-num-lock-symbolic" :
                                                  "cinnamon-num-lock-off-symbolic");
                break;
        }

        Main.osdWindowManager.show(-1, icon, undefined);        
    },

    play_state_sound: function(key, state) {
        switch (key) {
            /* Do we need different sounds for different keys?  Seems excessive... */
            case CAPS:
            case NUM:
                Main.soundManager.playSoundFile(0, state ? this.state_on_sound : this.state_off_sound);
                break;
        }
    },
}
