// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
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

    copyFrom(other) {
        this.monitor = other.monitor;
        this.halign = other.halign;
        this.valign = other.valign;
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
class ScreensaverWidget extends St.Bin {
    _init(params) {
        super._init({ x_fill: false,
                      y_fill: false,
                      x_align: St.Align.MIDDLE,
                      y_align: St.Align.MIDDLE });

        this.box = new St.BoxLayout(params);
        this.box.set_pivot_point(0.5, 0.5);
        this.set_child(this.box);

        this._currentPosition = new FloatPosition();
        this._awakePosition = new FloatPosition();
        this._nextPosition = new FloatPosition();
    }

    vfunc_allocate(box) {
        this.set_allocation(box);

        let contentBox = this.get_theme_node().get_content_box(box);
        let availWidth = contentBox.x2 - contentBox.x1;
        let availHeight = contentBox.y2 - contentBox.y1;

        let [, natWidth] = this.box.get_preferred_width(-1);
        let [, natHeight] = this.box.get_preferred_height(natWidth);

        let scale = 1;
        if (natWidth > availWidth || natHeight > availHeight)
            scale = Math.min(availWidth / natWidth, availHeight / natHeight);

        let childBox = new Clutter.ActorBox();
        childBox.x1 = contentBox.x1 + (availWidth - natWidth) / 2;
        childBox.y1 = contentBox.y1 + (availHeight - natHeight) / 2;
        childBox.x2 = childBox.x1 + natWidth;
        childBox.y2 = childBox.y1 + natHeight;

        this.box.allocate(childBox);
        this.box.set_scale(scale, scale);
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

    onScreensaverActivated() {
    }

    onScreensaverDeactivated() {
    }

    onAwake() {
    }

    onSleep() {
    }
});
