// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { Cinnamon } = imports.gi;
const Signals = imports.signals;
const SignalManager = imports.misc.signalManager;

/**
 * ToucheggGestureSource - Gesture source using touchegg daemon
 */
var ToucheggGestureSource = class {
    constructor() {
        this._client = null;
        this._signalManager = new SignalManager.SignalManager(null);
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

    _onGestureBegin(client, type, direction, percentage, fingers, device, time) {
        this.emit('gesture-begin', type, direction, percentage, fingers, device, time);
    }

    _onGestureUpdate(client, type, direction, percentage, fingers, device, time) {
        this.emit('gesture-update', type, direction, percentage, fingers, device, time);
    }

    _onGestureEnd(client, type, direction, percentage, fingers, device, time) {
        this.emit('gesture-end', type, direction, percentage, fingers, device, time);
    }
};
Signals.addSignalMethods(ToucheggGestureSource.prototype);
