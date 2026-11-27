// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { Cinnamon, Meta } = imports.gi;
const Signals = imports.signals;
const SignalManager = imports.misc.signalManager;
const { GestureType, GestureDirection, DeviceType } = imports.ui.gestures.gestureTypes;

const { UP, DOWN, LEFT, RIGHT } = GestureDirection;

// Touchegg reports a touchscreen swipe as the panel saw it. On a rotated
// screen that is not the way the fingers moved across the picture.
const ROTATED_SWIPE = {
    [Meta.XrandrRotation.LEFT]: { [UP]: RIGHT, [DOWN]: LEFT, [LEFT]: UP, [RIGHT]: DOWN },
    [Meta.XrandrRotation.FLIPPED]: { [UP]: DOWN, [DOWN]: UP, [LEFT]: RIGHT, [RIGHT]: LEFT },
    [Meta.XrandrRotation.RIGHT]: { [UP]: LEFT, [DOWN]: RIGHT, [LEFT]: DOWN, [RIGHT]: UP },
};

/**
 * ToucheggGestureSource - Gesture source using touchegg daemon
 */
var ToucheggGestureSource = class {
    constructor() {
        this._client = null;
        this._signalManager = new SignalManager.SignalManager(null);
        this._swipeRotation = Meta.XrandrRotation.NORMAL;
    }

    setup() {
        if (this._client !== null) {
            return;
        }

        global.log('Setting up touchegg gesture source');

        this._client = new Cinnamon.ToucheggClient();

        // Touchegg client already emits 'gesture-begin/update/end' signals
        // Just forward them
        this._signalManager.connect(this._client, "gesture-begin", this._onGestureBegin, this);
        this._signalManager.connect(this._client, "gesture-update", this._onGestureUpdate, this);
        this._signalManager.connect(this._client, "gesture-end", this._onGestureEnd, this);
    }

    shutdown() {
        if (this._client === null) {
            return;
        }

        global.log('Shutting down touchegg gesture source');
        this._signalManager.disconnect("gesture-begin");
        this._signalManager.disconnect("gesture-update");
        this._signalManager.disconnect("gesture-end");
        this._client = null;
    }

    isActive() {
        return this._client !== null;
    }

    _onScreen(type, direction, device, begin = false) {
        if (type !== GestureType.SWIPE || device !== DeviceType.TOUCHSCREEN) {
            return direction;
        }

        // The pointer is on the touched monitor. Looked up once, so the
        // direction cannot change mid-gesture.
        if (begin) {
            const monitor = global.display.get_current_monitor();
            [, this._swipeRotation] = Meta.MonitorManager.get().get_monitor_rotation(monitor);
        }

        return ROTATED_SWIPE[this._swipeRotation]?.[direction] ?? direction;
    }

    _onGestureBegin(client, type, direction, percentage, fingers, device, time) {
        this.emit('gesture-begin', type, this._onScreen(type, direction, device, true), percentage, fingers, device, time);
    }

    _onGestureUpdate(client, type, direction, percentage, fingers, device, time) {
        this.emit('gesture-update', type, this._onScreen(type, direction, device), percentage, fingers, device, time);
    }

    _onGestureEnd(client, type, direction, percentage, fingers, device, time) {
        this.emit('gesture-end', type, this._onScreen(type, direction, device), percentage, fingers, device, time);
    }
};
Signals.addSignalMethods(ToucheggGestureSource.prototype);
