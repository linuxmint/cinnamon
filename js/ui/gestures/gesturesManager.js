// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { Gio, GObject, Cinnamon, Meta } = imports.gi;
const Util = imports.misc.util;
const SignalManager = imports.misc.signalManager;
const ScreenSaver = imports.misc.screenSaver;

const actions = imports.ui.gestures.actions;
const { 
    GestureType,
    GestureDirection,
    DeviceType,
    GestureTypeString,
    GestureDirectionString,
    GesturePhaseString,
    DeviceTypeString
} = imports.ui.gestures.ToucheggTypes;

const SCHEMA = "org.cinnamon.gestures";
const TOUCHPAD_SCHEMA = "org.cinnamon.desktop.peripherals.touchpad"

const NON_GESTURE_KEYS = [
    "enabled",
    "swipe-percent-threshold",
    "pinch-percent-threshold"
]

const DEBUG_GESTURES=false;

var parse_type = (type_str) => {
    switch(type_str) {
    case "swipe":
        return GestureType.SWIPE;
    case "pinch":
        return GestureType.PINCH;
    case "tap":
        return GestureType.TAP;
    default:
        return GestureType.NOT_SUPPORTED;
    }
}

var parse_direction = (dir_str) => {
    switch(dir_str) {
    case "up":
        return GestureDirection.UP;
    case "down":
        return GestureDirection.DOWN;
    case "left":
        return GestureDirection.LEFT;
    case "right":
        return GestureDirection.RIGHT;
    case "in":
        return GestureDirection.IN;
    case "out":
        return GestureDirection.OUT
    default:
        return GestureDirection.UNKNOWN;
    }
}

var debug_gesture = (...args) => {
    if (DEBUG_GESTURES) {
        global.log(...args);
    }
}

var GestureDefinition = class {
    constructor(key, action, custom_value, phase) {
        this.action = action;
        this.phase = phase;
        this.custom_value = custom_value;

        const parts = key.split("-");

        if (parts.length == 2) {
            this.type = parse_type(parts[0]);
            this.fingers = parseInt(parts[1]);
        } else {
            this.type = parse_type(parts[0]);
            this.direction = parse_direction(parts[1]);
            this.fingers = parseInt(parts[2]);
        }
    }
}

var GesturesManager = class {
    constructor(wm) {
        if (Meta.is_wayland_compositor()) {
            global.log("Gestures disabled on Wayland");
            return;
        }

        this.signalManager = new SignalManager.SignalManager(null);
        this.settings = new Gio.Settings({ schema_id: SCHEMA })

        this.migrate_settings();

        this.signalManager.connect(this.settings, "changed", this.settings_or_devices_changed, this);
        this.screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
        this.client = null;
        this.current_gesture = null;

        this.settings_or_devices_changed()
    }

    migrate_settings() {
        const ssource = Gio.SettingsSchemaSource.get_default();
        const schema = ssource.lookup(SCHEMA, true);
        const keys = schema.list_keys();

        for (let key of keys) {
            if (NON_GESTURE_KEYS.includes(key)) {
                continue;
            }

            const val = this.settings.get_string(key);
            if (val === '' || val.includes("::")) {
                continue;
            }

            let custom_string;
            let action_string = custom_string = "";

            if (val.startsWith("EXEC:")) {
                [action_string, custom_string] = val.split(":");
                if (custom_string === "") {
                    this.settings.set_string(key, "");
                    continue;
                }
            } else {
                action_string = val;
            }

            if (custom_string === "") {
                this.settings.set_string(key, `${action_string}::end`);
            }
            else
            {
                this.settings.set_string(key, `${action_string}::${custom_string}::end`);
            }
        }
    }

    setup_client() {
        if (this.client == null) {
            global.log('Set up Touchegg client');
            actions.init_mixer();
            actions.init_mpris_controller();

            this.client = new Cinnamon.ToucheggClient();

            this.signalManager.connect(this.client, "gesture-begin", this.gesture_begin, this);
            this.signalManager.connect(this.client, "gesture-update", this.gesture_update, this);
            this.signalManager.connect(this.client, "gesture-end", this.gesture_end, this);
        }
    }

    shutdown_client() {
        if (this.client == null) {
            return;
        }

        global.log('Shutdown Touchegg client');
        this.signalManager.disconnect("gesture-begin");
        this.signalManager.disconnect("gesture-update");
        this.signalManager.disconnect("gesture-end");
        this.client = null;

        actions.cleanup();
    }

    settings_or_devices_changed(settings, key) {
        if (this.settings.get_boolean("enabled")) {
            this.setup_actions();
            return;
        }

        this.shutdown_client();
    }

    gesture_active() {
        return this.current_gesture != null;
    }

    setup_actions() {
        // Make sure the client is setup
        this.setup_client();

        this.live_actions = new Map();

        const ssource = Gio.SettingsSchemaSource.get_default();
        const schema = ssource.lookup(SCHEMA, true);
        const keys = schema.list_keys();

        for (let key of keys) {
            if (NON_GESTURE_KEYS.includes(key)) {
                continue;
            }

            const action_string = this.settings.get_string(key);
            if (action_string === '') {
                continue;
            }

            let phase, action, custom_value;

            if (action_string.includes("::")) {
                let parts = action_string.split("::");
                if (parts.length == 2) {
                    [action, phase] = parts;
                    custom_value = "";
                }
                else
                if (parts.length == 3) {
                    [action, custom_value, phase] = parts;
                }
            } else {
                continue;
            }

            this.live_actions.set(key, new GestureDefinition(key, action, custom_value, phase));
        }
    }

    construct_map_key(type, direction, fingers) {
        if (type === GestureType.TAP) {
            return `tap-${fingers}`;
        } else
        if (type === GestureType.SWIPE) {
            return `swipe-${GestureDirectionString[direction]}-${fingers}`;
        } else
        if (type === GestureType.PINCH) {
            return `pinch-${GestureDirectionString[direction]}-${fingers}`;
        } else
        {
            return null;
        }
    }

    lookup_definition(type, direction, fingers) {
        const key = this.construct_map_key(type, direction, fingers);
        const definition = this.live_actions.get(key);

        if (definition === undefined) {
            // no action set for this gesture
            return null;
        }

        return definition;
    }

    gesture_begin(client, type, direction, percentage, fingers, device, elapsed_time) {
        if (this.current_gesture != null) {
            global.logWarning("New gesture started before another was completed. Clearing the old one");
            this.current_gesture = null;
        }

        if (this.screenSaverProxy.screenSaverActive) {
            debug_gesture(`Ignoring 'gesture-begin', screensaver is active`);
            return;
        }

        const definition_match = this.lookup_definition(type, direction, fingers);

        if (definition_match == null) {
            debug_gesture(`No definition for (${DeviceTypeString[device]}) ${GestureTypeString[type]}, ${GestureDirectionString[direction]}, fingers: ${fingers}`);
            return;
        }

        debug_gesture(`Gesture started: (${DeviceTypeString[device]}) ${GestureTypeString[type]} ` +
                      `${GestureDirectionString[direction]}, fingers: ${fingers}, phase:${definition_match.phase} ` +
                      `[${definition_match.action}${definition_match.custom_value ?
                          ' (' + definition_match.custom_value + ')' : ""}]`);

        this.current_gesture = actions.make_action(this.settings, definition_match, device);
        this.current_gesture.begin(direction, percentage, elapsed_time);
    }

    gesture_update(client, type, direction, percentage, fingers, device, elapsed_time) {
        if (this.current_gesture == null) {
            debug_gesture("Gesture update but there's no current one.");
            return;
        }

        const def  = this.lookup_definition(type, direction, fingers);
        if (def == null || def !== this.current_gesture.definition) {
            this.current_gesture = null;
            global.logWarning("Invalid gesture update received, clearing current gesture");
            return;
        }

        debug_gesture(`Gesture update: ${GestureDirectionString[direction]}, progress: ${parseInt(percentage)}`);
        this.current_gesture.update(direction, percentage, elapsed_time);
    }

    gesture_end(client, type, direction, percentage, fingers, device, elapsed_time) {
        if (this.current_gesture == null) {
            debug_gesture("Gesture end but there's no current one.");
            return;
        }

        const def  = this.lookup_definition(type, direction, fingers);
        if (def == null || def !== this.current_gesture.definition) {
            this.current_gesture = null;
            global.logWarning("Invalid gesture end received, clearing current gesture");
            return;
        }

        debug_gesture(`${GestureTypeString[type]} end: progress: ${parseInt(percentage)} (threshold: ${this.current_gesture.threshold}) [${def.action}]`);

        if (percentage < this.current_gesture.threshold) {
            debug_gesture(`Gesture threshold not met`);
        }

        this.current_gesture.end(direction, percentage, elapsed_time);
        this.current_gesture = null;
    }
}


