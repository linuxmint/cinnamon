// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { Clutter, GObject, Gio } = imports.gi;
const Signals = imports.signals;

const {
    GestureType,
    GestureDirection,
    DeviceType
} = imports.ui.gestures.gestureTypes;

// Distance thresholds for gesture detection (in pixels)
const TOUCHPAD_BASE_HEIGHT = 300;
const TOUCHPAD_BASE_WIDTH = 400;
const DRAG_THRESHOLD_DISTANCE = 16;

const TouchpadState = {
    NONE: 0,
    PENDING: 1,
    HANDLING: 2,
    IGNORED: 3,
};

var TouchpadSwipeGesture = class {
    constructor(fingerCounts) {
        this._fingerCounts = fingerCounts; // Array of supported finger counts
        this._state = TouchpadState.NONE;
        this._cumulativeX = 0;
        this._cumulativeY = 0;
        this._direction = GestureDirection.UNKNOWN;
        this._fingers = 0;
        this._percentage = 0;
        this._baseDistance = 0;
        this._startTime = 0;

        this._touchpadSettings = new Gio.Settings({
            schema_id: 'org.cinnamon.desktop.peripherals.touchpad',
        });

        this._stageEventId = global.stage.connect(
            'captured-event::touchpad', this._handleEvent.bind(this));
    }

    _handleEvent(actor, event) {
        if (event.type() !== Clutter.EventType.TOUCHPAD_SWIPE)
            return Clutter.EVENT_PROPAGATE;

        const phase = event.get_gesture_phase();
        const fingers = event.get_touchpad_gesture_finger_count();

        // Reset state on gesture begin regardless of finger count
        if (phase === Clutter.TouchpadGesturePhase.BEGIN) {
            this._state = TouchpadState.NONE;
            this._direction = GestureDirection.UNKNOWN;
            this._cumulativeX = 0;
            this._cumulativeY = 0;
            this._percentage = 0;
        }

        // Only handle if finger count matches one we're listening for
        if (!this._fingerCounts.includes(fingers)) {
            return Clutter.EVENT_PROPAGATE;
        }

        if (this._state === TouchpadState.IGNORED) {
            return Clutter.EVENT_PROPAGATE;
        }

        const time = event.get_time();
        const [dx, dy] = event.get_gesture_motion_delta_unaccelerated();

        // Apply natural scroll setting
        let adjDx = dx;
        let adjDy = dy;
        if (this._touchpadSettings.get_boolean('natural-scroll')) {
            adjDx = -dx;
            adjDy = -dy;
        }

        if (this._state === TouchpadState.NONE) {
            if (dx === 0 && dy === 0) {
                return Clutter.EVENT_PROPAGATE;
            }

            this._fingers = fingers;
            this._startTime = time;
            this._state = TouchpadState.PENDING;
        }

        if (this._state === TouchpadState.PENDING) {
            this._cumulativeX += adjDx;
            this._cumulativeY += adjDy;

            const distance = Math.sqrt(this._cumulativeX ** 2 + this._cumulativeY ** 2);

            if (distance >= DRAG_THRESHOLD_DISTANCE) {
                // Determine direction
                // Note: dx/dy are inverted for horizontal to match touchegg convention
                if (Math.abs(this._cumulativeX) > Math.abs(this._cumulativeY)) {
                    this._direction = this._cumulativeX > 0 ? GestureDirection.LEFT : GestureDirection.RIGHT;
                    this._baseDistance = TOUCHPAD_BASE_WIDTH;
                } else {
                    this._direction = this._cumulativeY > 0 ? GestureDirection.DOWN : GestureDirection.UP;
                    this._baseDistance = TOUCHPAD_BASE_HEIGHT;
                }

                this._cumulativeX = 0;
                this._cumulativeY = 0;
                this._state = TouchpadState.HANDLING;

                this.emit('detected-begin',
                    GestureType.SWIPE,
                    this._direction,
                    0,
                    this._fingers,
                    DeviceType.TOUCHPAD,
                    this._startTime);
            } else {
                return Clutter.EVENT_PROPAGATE;
            }
        }

        // Calculate delta along the gesture direction
        // Note: horizontal is inverted to match touchegg convention
        let delta = 0;
        if (this._direction === GestureDirection.LEFT || this._direction === GestureDirection.RIGHT) {
            delta = -adjDx;  // Inverted for horizontal
            if (this._direction === GestureDirection.LEFT) {
                delta = -delta;
            }
        } else {
            delta = adjDy;
            if (this._direction === GestureDirection.UP) {
                delta = -delta;
            }
        }

        // Update percentage (can exceed 100%)
        this._percentage += (delta / this._baseDistance) * 100;
        this._percentage = Math.max(0, this._percentage);

        const handling = this._state === TouchpadState.HANDLING;

        switch (phase) {
        case Clutter.TouchpadGesturePhase.BEGIN:
        case Clutter.TouchpadGesturePhase.UPDATE:
            this.emit('detected-update',
                GestureType.SWIPE,
                this._direction,
                this._percentage,
                this._fingers,
                DeviceType.TOUCHPAD,
                time);
            break;

        case Clutter.TouchpadGesturePhase.END:
        case Clutter.TouchpadGesturePhase.CANCEL:
            this.emit('detected-end',
                GestureType.SWIPE,
                this._direction,
                this._percentage,
                this._fingers,
                DeviceType.TOUCHPAD,
                time);
            this._state = TouchpadState.NONE;
            break;
        }

        return handling
            ? Clutter.EVENT_STOP
            : Clutter.EVENT_PROPAGATE;
    }

    destroy() {
        if (this._stageEventId) {
            global.stage.disconnect(this._stageEventId);
            this._stageEventId = 0;
        }
    }
};
Signals.addSignalMethods(TouchpadSwipeGesture.prototype);

var TouchpadPinchGesture = class {
    constructor(fingerCounts) {
        this._fingerCounts = fingerCounts;
        this._state = TouchpadState.NONE;
        this._direction = GestureDirection.UNKNOWN;
        this._fingers = 0;
        this._percentage = 0;
        this._initialScale = 1.0;
        this._startTime = 0;

        this._stageEventId = global.stage.connect(
            'captured-event::touchpad', this._handleEvent.bind(this));
    }

    _handleEvent(actor, event) {
        if (event.type() !== Clutter.EventType.TOUCHPAD_PINCH)
            return Clutter.EVENT_PROPAGATE;

        const phase = event.get_gesture_phase();
        const fingers = event.get_touchpad_gesture_finger_count();
        const scale = event.get_gesture_pinch_scale();

        // Reset state on gesture begin (but don't capture scale yet - it's 0.0 on BEGIN)
        if (phase === Clutter.TouchpadGesturePhase.BEGIN) {
            this._state = TouchpadState.NONE;
            this._direction = GestureDirection.UNKNOWN;
            this._initialScale = 0;
            this._percentage = 0;
            return Clutter.EVENT_PROPAGATE; // Wait for UPDATE events
        }

        if (!this._fingerCounts.includes(fingers)) {
            return Clutter.EVENT_PROPAGATE;
        }

        if (this._state === TouchpadState.IGNORED) {
            return Clutter.EVENT_PROPAGATE;
        }

        const time = event.get_time();

        // Capture initial scale on first UPDATE event
        if (this._state === TouchpadState.NONE && phase === Clutter.TouchpadGesturePhase.UPDATE) {
            this._fingers = fingers;
            this._startTime = time;
            this._initialScale = scale;
            this._state = TouchpadState.PENDING;
            return Clutter.EVENT_PROPAGATE; // Wait for more updates to determine direction
        }

        if (this._state === TouchpadState.PENDING) {
            const scaleDelta = scale - this._initialScale;

            // Wait for significant scale change to determine direction
            if (Math.abs(scaleDelta) >= 0.05) {
                this._direction = scaleDelta > 0 ? GestureDirection.OUT : GestureDirection.IN;
                this._state = TouchpadState.HANDLING;

                this.emit('detected-begin',
                    GestureType.PINCH,
                    this._direction,
                    0,
                    this._fingers,
                    DeviceType.TOUCHPAD,
                    this._startTime);
            } else {
                return Clutter.EVENT_PROPAGATE;
            }
        }

        // Calculate percentage based on scale change from initial
        // Scale typically ranges from ~0.5 to ~1.5, so a change of 0.5 = 100%
        if (this._direction === GestureDirection.IN) {
            // Pinching in: scale decreases from initial
            this._percentage = (this._initialScale - scale) * 200;
        } else {
            // Pinching out: scale increases from initial
            this._percentage = (scale - this._initialScale) * 200;
        }
        this._percentage = Math.max(0, this._percentage);

        const handling = this._state === TouchpadState.HANDLING;

        switch (phase) {
        case Clutter.TouchpadGesturePhase.BEGIN:
        case Clutter.TouchpadGesturePhase.UPDATE:
            this.emit('detected-update',
                GestureType.PINCH,
                this._direction,
                this._percentage,
                this._fingers,
                DeviceType.TOUCHPAD,
                time);
            break;

        case Clutter.TouchpadGesturePhase.END:
        case Clutter.TouchpadGesturePhase.CANCEL:
            this.emit('detected-end',
                GestureType.PINCH,
                this._direction,
                this._percentage,
                this._fingers,
                DeviceType.TOUCHPAD,
                time);
            this._state = TouchpadState.NONE;
            break;
        }

        return handling
            ? Clutter.EVENT_STOP
            : Clutter.EVENT_PROPAGATE;
    }

    destroy() {
        if (this._stageEventId) {
            global.stage.disconnect(this._stageEventId);
            this._stageEventId = 0;
        }
    }
};
Signals.addSignalMethods(TouchpadPinchGesture.prototype);

var TouchSwipeGesture = GObject.registerClass({
    Signals: {
        'detected-begin': { param_types: [GObject.TYPE_UINT, GObject.TYPE_UINT, GObject.TYPE_DOUBLE, GObject.TYPE_INT, GObject.TYPE_UINT, GObject.TYPE_INT64] },
        'detected-update': { param_types: [GObject.TYPE_UINT, GObject.TYPE_UINT, GObject.TYPE_DOUBLE, GObject.TYPE_INT, GObject.TYPE_UINT, GObject.TYPE_INT64] },
        'detected-end': { param_types: [GObject.TYPE_UINT, GObject.TYPE_UINT, GObject.TYPE_DOUBLE, GObject.TYPE_INT, GObject.TYPE_UINT, GObject.TYPE_INT64] },
    },
}, class TouchSwipeGesture extends Clutter.GestureAction {
    _init(nTouchPoints) {
        super._init();
        this.set_n_touch_points(nTouchPoints);
        this.set_threshold_trigger_edge(Clutter.GestureTriggerEdge.AFTER);

        this._direction = GestureDirection.UNKNOWN;
        this._lastPosition = { x: 0, y: 0 };
        this._startPosition = { x: 0, y: 0 };
        this._percentage = 0;
        this._distance = global.screen_height;
        this._nTouchPoints = nTouchPoints;
    }

    vfunc_gesture_prepare(actor) {
        if (!super.vfunc_gesture_prepare(actor)) {
            return false;
        }

        const [xPress, yPress] = this.get_press_coords(0);
        const [x, y] = this.get_motion_coords(0);
        const xDelta = x - xPress;
        const yDelta = y - yPress;

        // Determine direction
        if (Math.abs(xDelta) > Math.abs(yDelta)) {
            this._direction = xDelta > 0 ? GestureDirection.RIGHT : GestureDirection.LEFT;
            this._distance = global.screen_width;
        } else {
            this._direction = yDelta > 0 ? GestureDirection.DOWN : GestureDirection.UP;
            this._distance = global.screen_height;
        }

        this._startPosition = { x: xPress, y: yPress };
        this._lastPosition = { x, y };
        this._percentage = 0;

        const time = this.get_last_event(0).get_time();
        this.emit('detected-begin',
            GestureType.SWIPE,
            this._direction,
            0,
            this._nTouchPoints,
            DeviceType.TOUCHSCREEN,
            time);

        return true;
    }

    vfunc_gesture_progress(_actor) {
        const [x, y] = this.get_motion_coords(0);
        const time = this.get_last_event(0).get_time();

        let delta = 0;
        if (this._direction === GestureDirection.LEFT || this._direction === GestureDirection.RIGHT) {
            delta = x - this._lastPosition.x;
            if (this._direction === GestureDirection.LEFT) {
                delta = -delta;
            }
        } else {
            delta = y - this._lastPosition.y;
            if (this._direction === GestureDirection.UP) {
                delta = -delta;
            }
        }

        this._percentage += (delta / this._distance) * 100;
        this._percentage = Math.max(0, this._percentage);

        this._lastPosition = { x, y };

        this.emit('detected-update',
            GestureType.SWIPE,
            this._direction,
            this._percentage,
            this._nTouchPoints,
            DeviceType.TOUCHSCREEN,
            time);

        return true;
    }

    vfunc_gesture_end(_actor) {
        const time = this.get_last_event(0).get_time();
        this.emit('detected-end',
            GestureType.SWIPE,
            this._direction,
            this._percentage,
            this._nTouchPoints,
            DeviceType.TOUCHSCREEN,
            time);
    }

    vfunc_gesture_cancel(_actor) {
        const time = Clutter.get_current_event_time();
        this.emit('detected-end',
            GestureType.SWIPE,
            this._direction,
            0,
            this._nTouchPoints,
            DeviceType.TOUCHSCREEN,
            time);
    }
});

var TouchPinchGesture = GObject.registerClass({
    Signals: {
        'detected-begin': { param_types: [GObject.TYPE_UINT, GObject.TYPE_UINT, GObject.TYPE_DOUBLE, GObject.TYPE_INT, GObject.TYPE_UINT, GObject.TYPE_INT64] },
        'detected-update': { param_types: [GObject.TYPE_UINT, GObject.TYPE_UINT, GObject.TYPE_DOUBLE, GObject.TYPE_INT, GObject.TYPE_UINT, GObject.TYPE_INT64] },
        'detected-end': { param_types: [GObject.TYPE_UINT, GObject.TYPE_UINT, GObject.TYPE_DOUBLE, GObject.TYPE_INT, GObject.TYPE_UINT, GObject.TYPE_INT64] },
    },
}, class TouchPinchGesture extends Clutter.GestureAction {
    _init(nTouchPoints) {
        super._init();
        // Pinch requires at least 2 touch points
        this.set_n_touch_points(Math.max(2, nTouchPoints));
        this.set_threshold_trigger_edge(Clutter.GestureTriggerEdge.AFTER);

        this._direction = GestureDirection.UNKNOWN;
        this._initialDistance = 0;
        this._percentage = 0;
        this._nTouchPoints = nTouchPoints;
    }

    _getPointsDistance() {
        // Calculate distance between first two touch points
        if (this.get_n_current_points() < 2) {
            return 0;
        }

        const [x1, y1] = this.get_motion_coords(0);
        const [x2, y2] = this.get_motion_coords(1);
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }

    vfunc_gesture_prepare(actor) {
        if (!super.vfunc_gesture_prepare(actor)) {
            return false;
        }

        this._initialDistance = this._getPointsDistance();
        if (this._initialDistance === 0) {
            return false;
        }

        this._direction = GestureDirection.UNKNOWN;
        this._percentage = 0;

        return true;
    }

    vfunc_gesture_progress(_actor) {
        const currentDistance = this._getPointsDistance();
        if (this._initialDistance === 0) {
            return true;
        }

        const time = this.get_last_event(0).get_time();
        const scale = currentDistance / this._initialDistance;

        // Determine direction on first significant change
        if (this._direction === GestureDirection.UNKNOWN) {
            if (Math.abs(scale - 1.0) >= 0.05) {
                this._direction = scale > 1.0 ? GestureDirection.OUT : GestureDirection.IN;

                this.emit('detected-begin',
                    GestureType.PINCH,
                    this._direction,
                    0,
                    this._nTouchPoints,
                    DeviceType.TOUCHSCREEN,
                    time);
            } else {
                return true;
            }
        }

        // Calculate percentage
        if (this._direction === GestureDirection.IN) {
            this._percentage = (1.0 - scale) * 200;
        } else {
            this._percentage = (scale - 1.0) * 200;
        }
        this._percentage = Math.max(0, this._percentage);

        this.emit('detected-update',
            GestureType.PINCH,
            this._direction,
            this._percentage,
            this._nTouchPoints,
            DeviceType.TOUCHSCREEN,
            time);

        return true;
    }

    vfunc_gesture_end(_actor) {
        if (this._direction === GestureDirection.UNKNOWN) {
            return;
        }

        const time = this.get_last_event(0).get_time();
        this.emit('detected-end',
            GestureType.PINCH,
            this._direction,
            this._percentage,
            this._nTouchPoints,
            DeviceType.TOUCHSCREEN,
            time);
    }

    vfunc_gesture_cancel(_actor) {
        if (this._direction === GestureDirection.UNKNOWN) {
            return;
        }

        const time = Clutter.get_current_event_time();
        this.emit('detected-end',
            GestureType.PINCH,
            this._direction,
            0,
            this._nTouchPoints,
            DeviceType.TOUCHSCREEN,
            time);
    }
});

var TouchTapGesture = GObject.registerClass({
    Signals: {
        'detected-begin': { param_types: [GObject.TYPE_UINT, GObject.TYPE_UINT, GObject.TYPE_DOUBLE, GObject.TYPE_INT, GObject.TYPE_UINT, GObject.TYPE_INT64] },
        'detected-update': { param_types: [GObject.TYPE_UINT, GObject.TYPE_UINT, GObject.TYPE_DOUBLE, GObject.TYPE_INT, GObject.TYPE_UINT, GObject.TYPE_INT64] },
        'detected-end': { param_types: [GObject.TYPE_UINT, GObject.TYPE_UINT, GObject.TYPE_DOUBLE, GObject.TYPE_INT, GObject.TYPE_UINT, GObject.TYPE_INT64] },
    },
}, class TouchTapGesture extends Clutter.TapAction {
    _init(nTouchPoints) {
        super._init();
        this.set_n_touch_points(nTouchPoints);

        this._nTouchPoints = nTouchPoints;
    }

    vfunc_tap(actor) {
        const time = Clutter.get_current_event_time();

        // For tap gestures, we emit begin and end immediately with 100% completion
        this.emit('detected-begin',
            GestureType.TAP,
            GestureDirection.UNKNOWN,
            100,
            this._nTouchPoints,
            DeviceType.TOUCHSCREEN,
            time);

        this.emit('detected-end',
            GestureType.TAP,
            GestureDirection.UNKNOWN,
            100,
            this._nTouchPoints,
            DeviceType.TOUCHSCREEN,
            time);

        return true;
    }
});
