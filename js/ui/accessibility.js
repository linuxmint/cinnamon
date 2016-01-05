// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Main = imports.ui.main;
const Gdk = imports.gi.Gdk;
const Keymap = Gdk.Keymap.get_default();
const SignalManager = imports.misc.signalManager;
const Gio = imports.gi.Gio;
const CDesktopEnums = imports.gi.CDesktopEnums;
const Flashspot = imports.ui.flashspot;


const CAPS = 0;
const NUM = 1;

function A11yHandler(){
    this._init();
}

A11yHandler.prototype = {
    _init: function() {
        this.a11y_keyboard_settings = new Gio.Settings( { schema_id: "org.cinnamon.desktop.a11y.keyboard" });
        this.wm_settings = new Gio.Settings( { schema_id: "org.cinnamon.desktop.wm.preferences" });

        this._signalManager = new SignalManager.SignalManager(this);

        /* Feature toggles */
        this._toggle_keys_osd = false;
        this._toggle_keys_sound = false;
        this._events_flash = false;
        this._events_sound = false

        /* Options */
        this.state_on_sound = null;
        this.state_off_sound = null;
        this.event_bell_sound = null;
        this.event_flash_type = null;

        this.caps = Keymap.get_caps_lock_state();
        this.num = Keymap.get_num_lock_state();

        this._signalManager.connect(this.a11y_keyboard_settings, "changed", this.on_settings_changed, this);
        this._signalManager.connect(this.wm_settings, "changed", this.on_settings_changed, this);

        this.on_settings_changed();
    },

    _set_keymap_listener: function(enabled) {
        if (enabled)
            this._signalManager.connect(Keymap, "state-changed", this.on_keymap_state_changed, this);
        else
            this._signalManager.disconnect("state-changed");
    },

    _set_events_listener: function(enabled) {
        if (enabled)
            this._signalManager.connect(global.display, "bell", this._on_event_bell, this);
        else
            this._signalManager.disconnect("bell");
    },

    on_settings_changed: function(settings, key) {
        this.state_on_sound = this.a11y_keyboard_settings.get_string("togglekeys-sound-on");
        this.state_off_sound = this.a11y_keyboard_settings.get_string("togglekeys-sound-off");

        this._toggle_keys_osd = this.a11y_keyboard_settings.get_boolean("togglekeys-enable-osd");
        this._toggle_keys_sound = this.a11y_keyboard_settings.get_boolean("togglekeys-enable-beep");


        if (this._toggle_keys_sound || this._toggle_keys_osd) {
            this._set_keymap_listener(true);
        } else {
            this._set_keymap_listener(false);
        }

        this._events_sound = this.wm_settings.get_boolean("audible-bell");
        this._events_flash = this.wm_settings.get_boolean("visual-bell");
        this.event_bell_sound = this.wm_settings.get_string("bell-sound");
        this.event_flash_type = this.wm_settings.get_enum("visual-bell-type");

        if (this._events_sound || this._events_flash) {
            this._set_events_listener(true);
        } else {
            this._set_events_listener(false);
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

    _on_event_bell: function(display, bell_window) {
        if (this._events_sound) {
            this.ring_bell();
        }

        if (this._events_flash) {
            switch (this.event_flash_type) {
                case CDesktopEnums.VisualBellType.FULLSCREEN_FLASH:
                    this.flash_window(display, null);
                case CDesktopEnums.VisualBellType.FRAME_FLASH:
                    this.flash_window(display, bell_window);
            }
        }
    },

    popup_state_osd: function(key, state) {
        let icon = null;

        switch (key) {
            case CAPS:
                icon = Gio.Icon.new_for_string(state ? "caps-lock-symbolic" : "caps-lock-off-symbolic")
                Main.osdWindow.setIcon(icon);
                Main.osdWindow.setLevel(undefined);
                Main.osdWindow.show();
                break;
            case NUM:
                icon = Gio.Icon.new_for_string(state ? "num-lock-symbolic" : "num-lock-off-symbolic")
                Main.osdWindow.setIcon(icon);
                Main.osdWindow.setLevel(undefined);
                Main.osdWindow.show();
                break;
        }
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

    rect_off_screen: function(display, rect) {
        let [sw, sh] = global.screen.get_size();
        return (rect.x > sw && rect.y > sh);
    },

    flash_window: function(display, bell_window) {
        if (bell_window) {
            let rect = bell_window.get_outer_rect();
            if (this.rect_off_screen(display, rect)) {
                let fw = display.get_focus_window();
                if (fw)
                    rect = fw.get_outer_rect();
            }

            if (rect) {
                this.fire_flash(rect);
                return;
            }
        }

        this.fire_flash(Main.layoutManager.focusMonitor);
    },

    fire_flash: function(rect) {
        let flashspot = new Flashspot.Flashspot({x      : rect.x,
                                                 y      : rect.y,
                                                 width  : rect.width,
                                                 height : rect.height,
                                                 time   : .05 });
        flashspot.fire()
    },

    ring_bell: function() {
        Main.soundManager.playSoundFile(0, this.event_bell_sound);
    }
}
