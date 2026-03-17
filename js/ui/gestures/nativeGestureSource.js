// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Signals = imports.signals;

const {
    TouchpadSwipeGesture,
    TouchpadPinchGesture,
    TouchSwipeGesture,
    TouchPinchGesture,
    TouchTapGesture
} = imports.ui.gestures.nativeGestures;

const TOUCHPAD_SWIPE_FINGER_COUNTS = [3, 4];
const TOUCHPAD_PINCH_FINGER_COUNTS = [2, 3, 4];
const TOUCHSCREEN_FINGER_COUNTS = [2, 3, 4, 5];

/**
 * NativeGestureSource - Gesture source using native Clutter touchpad events
 */
var NativeGestureSource = class {
    constructor() {
        this._touchpadSwipeGesture = null;
        this._touchpadPinchGesture = null;
        this._touchSwipeGestures = [];
        this._touchPinchGestures = [];
        this._touchTapGestures = [];
    }

    setup() {
        global.log('Setting up native gesture source');

        this._touchpadSwipeGesture = new TouchpadSwipeGesture(TOUCHPAD_SWIPE_FINGER_COUNTS);
        this._touchpadSwipeGesture.connect('detected-begin', this._onGestureBegin.bind(this));
        this._touchpadSwipeGesture.connect('detected-update', this._onGestureUpdate.bind(this));
        this._touchpadSwipeGesture.connect('detected-end', this._onGestureEnd.bind(this));

        this._touchpadPinchGesture = new TouchpadPinchGesture(TOUCHPAD_PINCH_FINGER_COUNTS);
        this._touchpadPinchGesture.connect('detected-begin', this._onGestureBegin.bind(this));
        this._touchpadPinchGesture.connect('detected-update', this._onGestureUpdate.bind(this));
        this._touchpadPinchGesture.connect('detected-end', this._onGestureEnd.bind(this));

        for (let fingers of TOUCHSCREEN_FINGER_COUNTS) {
            const swipeGesture = new TouchSwipeGesture(fingers);
            swipeGesture.connect('detected-begin', this._onGestureBegin.bind(this));
            swipeGesture.connect('detected-update', this._onGestureUpdate.bind(this));
            swipeGesture.connect('detected-end', this._onGestureEnd.bind(this));
            global.stage.add_action_with_name(`touch-swipe-${fingers}`, swipeGesture);
            this._touchSwipeGestures.push(swipeGesture);

            const pinchGesture = new TouchPinchGesture(fingers);
            pinchGesture.connect('detected-begin', this._onGestureBegin.bind(this));
            pinchGesture.connect('detected-update', this._onGestureUpdate.bind(this));
            pinchGesture.connect('detected-end', this._onGestureEnd.bind(this));
            global.stage.add_action_with_name(`touch-pinch-${fingers}`, pinchGesture);
            this._touchPinchGestures.push(pinchGesture);

            const tapGesture = new TouchTapGesture(fingers);
            tapGesture.connect('detected-begin', this._onGestureBegin.bind(this));
            tapGesture.connect('detected-end', this._onGestureEnd.bind(this));
            global.stage.add_action_with_name(`touch-tap-${fingers}`, tapGesture);
            this._touchTapGestures.push(tapGesture);
        }
    }

    shutdown() {
        global.log('Shutting down native gesture source');

        if (this._touchpadSwipeGesture) {
            this._touchpadSwipeGesture.destroy();
            this._touchpadSwipeGesture = null;
        }

        if (this._touchpadPinchGesture) {
            this._touchpadPinchGesture.destroy();
            this._touchpadPinchGesture = null;
        }

        for (let gesture of this._touchSwipeGestures) {
            global.stage.remove_action(gesture);
        }
        this._touchSwipeGestures = [];

        for (let gesture of this._touchPinchGestures) {
            global.stage.remove_action(gesture);
        }
        this._touchPinchGestures = [];

        for (let gesture of this._touchTapGestures) {
            global.stage.remove_action(gesture);
        }
        this._touchTapGestures = [];
    }

    isActive() {
        return this._touchpadSwipeGesture !== null;
    }

    _onGestureBegin(source, type, direction, percentage, fingers, device, time) {
        this.emit('gesture-begin', type, direction, percentage, fingers, device, time);
    }

    _onGestureUpdate(source, type, direction, percentage, fingers, device, time) {
        this.emit('gesture-update', type, direction, percentage, fingers, device, time);
    }

    _onGestureEnd(source, type, direction, percentage, fingers, device, time) {
        this.emit('gesture-end', type, direction, percentage, fingers, device, time);
    }
};
Signals.addSignalMethods(NativeGestureSource.prototype);
