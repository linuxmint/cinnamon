// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

// Progress arithmetic for gestures that follow the fingers: a percentage
// of a full swipe becomes a position on a line of snap points, and lands on
// one when the fingers lift, further on if thrown. A reduced port of the
// swipe tracker in GNOME Shell, reading no events, so it serves both
// gesture sources.

// Progress per millisecond. Above this speed, a release is a throw.
const FLICK_VELOCITY = 0.001;

// How far a throw carries, in milliseconds at the speed it left at.
const PROJECTION = 450;

// Limits for the settle, which is timed from the speed of the release.
const DURATION_MULTIPLIER = 3;
const MIN_DURATION = 100;
const MAX_DURATION = 300;

// Velocity is measured over the end of the swipe only.
const VELOCITY_WINDOW = 150;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * SwipeProgress:
 * @snapPoints: the positions the transition can rest at, in ascending order
 * @initial: the position the gesture starts at
 * @cancel: the position to return to if the gesture is cancelled
 * @longSwipes: true if one swipe can cross more than one snap point. False
 *   by default, which keeps one swipe to one workspace.
 *
 * Holds the position of a swipe, and finds where it lands.
 */
var SwipeProgress = class {
    constructor(snapPoints, initial, cancel, longSwipes = false) {
        this.snapPoints = snapPoints;
        this.progress = initial;
        this.cancelProgress = cancel;
        this.longSwipes = longSwipes;

        this._initial = initial;
        this._history = [];
    }

    /**
     * update:
     * @progress: the position the fingers have reached
     * @time: the time of the report, in milliseconds
     *
     * Returns: the position, held inside the bounds of the swipe.
     */
    update(progress, time) {
        const [lower, upper] = this._bounds();
        this.progress = clamp(progress, lower, upper);

        this._history.push([time, this.progress]);
        while (this._history.length > 2 &&
               time - this._history[0][0] > VELOCITY_WINDOW)
            this._history.shift();

        return this.progress;
    }

    /**
     * end:
     * @time: the time the fingers lifted, in milliseconds
     *
     * Returns: [target, duration]. The target is the snap point the gesture
     * lands on. A duration of 0 means there is nothing left to animate.
     */
    end(time) {
        const velocity = this._velocity(time);
        const [lower, upper] = this._bounds();

        let target;
        if (Math.abs(velocity) < FLICK_VELOCITY) {
            target = this._closest(this.progress);
        } else {
            target = this._closest(clamp(this.progress + velocity * PROJECTION,
                lower, upper));

            // A throw always moves on, even a short one.
            if (velocity > 0 && target <= this.progress)
                target = this._next(this.progress);
            else if (velocity < 0 && target >= this.progress)
                target = this._previous(this.progress);
        }

        const distance = Math.abs(target - this.progress);
        if (distance === 0)
            return [target, 0];

        const duration = velocity === 0
            ? MAX_DURATION
            : Math.abs(distance / velocity * DURATION_MULTIPLIER);

        return [target, clamp(duration, MIN_DURATION, MAX_DURATION)];
    }

    /**
     * cancel:
     *
     * Returns: [target, duration] for a gesture that was interrupted.
     */
    cancel() {
        return [this.cancelProgress, MIN_DURATION];
    }

    // The range the swipe can travel: one snap point each side of the start,
    // or the whole line for a long swipe.
    _bounds() {
        const first = this.snapPoints[0];
        const last = this.snapPoints[this.snapPoints.length - 1];

        if (this.longSwipes)
            return [first, last];

        return [Math.max(this._previous(this._initial), first),
                Math.min(this._next(this._initial), last)];
    }

    _closest(position) {
        return this.snapPoints.reduce((best, point) =>
            Math.abs(point - position) < Math.abs(best - position) ? point : best,
            this.snapPoints[0]);
    }

    _next(position) {
        const point = this.snapPoints.find(p => p > position + Number.EPSILON);
        return point === undefined ? this.snapPoints[this.snapPoints.length - 1] : point;
    }

    _previous(position) {
        const points = this.snapPoints.filter(p => p < position - Number.EPSILON);
        return points.length === 0 ? this.snapPoints[0] : points[points.length - 1];
    }

    // Only the end of the swipe says where the fingers were going.
    _velocity(time) {
        if (this._history.length < 2)
            return 0;

        const recent = this._history.filter(([t]) => time - t <= VELOCITY_WINDOW);
        if (recent.length < 2)
            return 0;

        const [firstTime, firstProgress] = recent[0];
        const [lastTime, lastProgress] = recent[recent.length - 1];
        const elapsed = lastTime - firstTime;

        return elapsed > 0 ? (lastProgress - firstProgress) / elapsed : 0;
    }
};
