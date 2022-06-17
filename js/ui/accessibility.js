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
const Cairo = imports.cairo;
const St = imports.gi.St;
const GObject = imports.gi.GObject;

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
        new PointerA11yTimeout();

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


/* exported PointerA11yTimeout */


const SUCCESS_ZOOM_OUT_DURATION = 150;

var PieTimer = GObject.registerClass({
    Properties: {
        'angle': GObject.ParamSpec.double(
            'angle', 'angle', 'angle',
            GObject.ParamFlags.READWRITE,
            0, 2 * Math.PI, 0),
    },
}, class PieTimer extends St.DrawingArea {
    _init() {
        this._angle = 0;
        super._init({
            style_class: 'pie-timer',
            opacity: 0,
            important: true,
            visible: false,
            can_focus: false,
            reactive: false,
        });

        this.set_pivot_point(0.5, 0.5);
    }

    get angle() {
        return this._angle;
    }

    set angle(angle) {
        if (this._angle == angle)
            return;

        this._angle = angle;
        this.notify('angle');
        this.queue_repaint();
    }

    vfunc_repaint() {
        let node = this.get_theme_node();
        let backgroundColor = node.get_color('-pie-background-color');
        let borderColor = node.get_color('-pie-border-color');
        let borderWidth = node.get_length('-pie-border-width');
        let [width, height] = this.get_surface_size();
        let radius = Math.min(width / 2, height / 2);

        let startAngle = 3 * Math.PI / 2;
        let endAngle = startAngle + this._angle;

        let cr = this.get_context();
        cr.setLineCap(Cairo.LineCap.ROUND);
        cr.setLineJoin(Cairo.LineJoin.ROUND);
        cr.translate(width / 2, height / 2);

        if (this._angle < 2 * Math.PI)
            cr.moveTo(0, 0);

        cr.arc(0, 0, radius - borderWidth, startAngle, endAngle);

        if (this._angle < 2 * Math.PI)
            cr.lineTo(0, 0);

        cr.closePath();

        cr.setLineWidth(0);
        Clutter.cairo_set_source_color(cr, backgroundColor);
        cr.fillPreserve();

        cr.setLineWidth(borderWidth);
        Clutter.cairo_set_source_color(cr, borderColor);
        cr.stroke();

        cr.$dispose();
    }

    start(x, y, duration) {
        this.x = x - this.width / 2;
        this.y = y - this.height / 2;
        this.show();

        this.ease({
            opacity: 255,
            duration: duration / 4,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
        });

        this.ease_property('angle', 2 * Math.PI, {
            duration,
            mode: Clutter.AnimationMode.LINEAR,
            onComplete: this._onTransitionComplete.bind(this),
        });
    }

    _onTransitionComplete() {
        this.ease({
            scale_x: 2,
            scale_y: 2,
            opacity: 0,
            duration: SUCCESS_ZOOM_OUT_DURATION,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => this.destroy(),
        });
    }
});

var PointerA11yTimeout = class PointerA11yTimeout {
    constructor() {
        let seat = Clutter.get_default_backend().get_default_seat();

        seat.connect('ptr-a11y-timeout-started', (o, device, type, timeout) => {
            let [x, y] = global.get_pointer();

            this._pieTimer = new PieTimer();
            Main.uiGroup.add_actor(this._pieTimer);
            Main.uiGroup.set_child_above_sibling(this._pieTimer, null);

            this._pieTimer.start(x, y, timeout);

            if (type == Clutter.PointerA11yTimeoutType.GESTURE)
                global.display.set_cursor(Meta.Cursor.CROSSHAIR);
        });

        seat.connect('ptr-a11y-timeout-stopped', (o, device, type, clicked) => {
            if (!clicked)
                this._pieTimer.destroy();

            if (type == Clutter.PointerA11yTimeoutType.GESTURE)
                global.display.set_cursor(Meta.Cursor.DEFAULT);
        });
    }
};

