// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const GObject = imports.gi.GObject;
const St = imports.gi.St;

/**
 * FloatPosition:
 * Structure representing a position in the screensaver's 3x3 grid system.
 * Uses St.Align values (START, MIDDLE, END) for alignment.
 * Used for current, awake, and next positions of floating widgets.
 */
var FloatPosition = class FloatPosition {
    constructor(monitor = 0, halign = St.Align.MIDDLE, valign = St.Align.MIDDLE) {
        this.monitor = monitor;
        this.halign = halign;
        this.valign = valign;
    }

    copy() {
        return new FloatPosition(this.monitor, this.halign, this.valign);
    }

    copyFrom(other) {
        this.monitor = other.monitor;
        this.halign = other.halign;
        this.valign = other.valign;
    }

    equals(other) {
        return this.monitor === other.monitor &&
               this.halign === other.halign &&
               this.valign === other.valign;
    }

    toKey() {
        return `${this.monitor}:${this.halign}:${this.valign}`;
    }

    toAlignKey() {
        return `${this.halign}:${this.valign}`;
    }
};

/**
 * ScreensaverWidget:
 *
 * Base class for screensaver widgets that float on the lock screen.
 * All ScreensaverWidgets participate in the floating system - they are
 * randomly repositioned periodically in a 3x3 grid per monitor.
 *
 * When the unlock dialog is visible ("awake"), widgets move to
 * their designated awake positions.
 *
 * Non-floating widgets (like PowerWidget) should not subclass this.
 */
var ScreensaverWidget = GObject.registerClass(
class ScreensaverWidget extends St.BoxLayout {
    _init(params) {
        super._init(params);

        this._currentPosition = new FloatPosition();
        this._awakePosition = new FloatPosition();
        this._nextPosition = new FloatPosition();
    }

    setAwakePosition(monitor, halign, valign) {
        this._awakePosition.monitor = monitor;
        this._awakePosition.halign = halign;
        this._awakePosition.valign = valign;
    }

    setNextPosition(monitor, halign, valign) {
        this._nextPosition.monitor = monitor;
        this._nextPosition.halign = halign;
        this._nextPosition.valign = valign;
    }

    applyNextPosition() {
        this._currentPosition.copyFrom(this._nextPosition);
    }

    applyAwakePosition(currentMonitor) {
        this._awakePosition.monitor = currentMonitor;
        this._nextPosition.copyFrom(this._awakePosition);
        this.applyNextPosition();
    }

    getCurrentPosition() {
        return this._currentPosition;
    }

    getAwakePosition() {
        return this._awakePosition;
    }

    getNextPosition() {
        return this._nextPosition;
    }

    onScreensaverActivated() {
        // Override in subclasses
    }

    onScreensaverDeactivated() {
        // Override in subclasses
    }

    onAwake() {
        // Override in subclasses
    }

    onSleep() {
        // Override in subclasses
    }
});
