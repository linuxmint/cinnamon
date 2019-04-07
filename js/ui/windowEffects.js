const {Gravity, Clone} = imports.gi.Clutter;
const {Rectangle, WindowType} = imports.gi.Meta;
const Main = imports.ui.main;
const {layoutManager} = Main;
const {addTween, removeTweens} = imports.ui.tweener;

class Effect {
    constructor(endWindowEffect) {
        this.endWindowEffect = endWindowEffect;
        this.originalOpacity = 0;
        this.actor = null;
        this.source = null;
    }

    setActor(source) {
        if (this.actor) return;

        this.originalOpacity = source.opacity;
        this.actor = new Clone({
            source,
            reactive: false,
            width: source.width,
            height: source.height,
            x: source.x,
            y: source.y
        });

        global.overlay_group.add_child(this.actor);
        global.overlay_group.set_child_above_sibling(this.actor, null);

        this.source = source;
    }

    _end() {
        if (!this.actor) return;

        global.overlay_group.remove_child(this.actor);
        this.actor.destroy();
        this.actor = this.source = null;
    }

    _fadeWindow(cinnamonwm, opacity, time, transition) {
        addTween(this.actor, {
            opacity,
            time,
            min: 0,
            max: 255,
            transition,
            onComplete: () => this.endWindowEffect(cinnamonwm, this.name, this.source),
        });
    }

    _scaleWindow(cinnamonwm, scale_x, scale_y, time, transition, keepAnchorPoint) {
        if (!keepAnchorPoint)
            this.actor.move_anchor_point_from_gravity(Gravity.CENTER);

        addTween(this.actor, {
            scale_x,
            scale_y,
            time,
            min: 0,
            transition,
            onComplete: () => this.endWindowEffect(cinnamonwm, this.name, this.source),
        });
    }

    _moveWindow(cinnamonwm, x, y, time, transition) {
        addTween(this.actor, {
            x,
            y,
            time,
            transition,
            onComplete: () => this.endWindowEffect(cinnamonwm, this.name, this.source),
        });
    }
};

var Map = class Map extends Effect {
    constructor() {
        super(...arguments);

        this.name = 'map';
        this.arrayName = '_mapping';
        this.wmCompleteName = 'completed_map';
    }

    _end() {
        this.source.show();
        super._end();
    }

    scale(cinnamonwm, time, transition) {
        this.actor.set_scale(0, 0);
        this._scaleWindow(cinnamonwm, 1, 1, time, transition);
    }

    fade(cinnamonwm, time, transition) {
        this.actor.opacity = 0;
        this._fadeWindow(cinnamonwm, this.originalOpacity, time, transition);
    }

    blend(cinnamonwm, time, transition) {
        this.actor.opacity = 0;
        this.actor.set_scale(1.5, 1.5);
        this._fadeWindow(cinnamonwm, this.originalOpacity, time, transition);
        this._scaleWindow(cinnamonwm, 1, 1, time, transition);
    }

    move(cinnamonwm, time, transition) {
        let [width, height] = this.actor.get_allocation_box().get_size();
        let [xDest, yDest] = this.source.get_transformed_position();
        xDest += width /= 2;
        yDest += height /= 2;

        let [xSrc, ySrc] = global.get_pointer();
        xSrc -= width;
        ySrc -= height;
        this.actor.set_position(xSrc, ySrc);

        this.actor.set_scale(0, 0);

        this._scaleWindow(cinnamonwm, 1, 1, time, transition);
        this._moveWindow(cinnamonwm, xDest, yDest, time, transition);
    }

    flyUp(cinnamonwm, time, transition) {
        // FIXME: somehow we need this line to get the correct position, without it will return [0, 0]
        this.actor.get_allocation_box().get_size();
        let [xDest, yDest] = this.source.get_transformed_position();
        let ySrc = global.stage.get_height();

        this.actor.set_position(xDest, ySrc);

        let dist = Math.abs(ySrc - yDest);
        time *= dist / layoutManager.primaryMonitor.height * 2; // The transition time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(cinnamonwm, xDest, yDest, time, transition);

    }

    flyDown(cinnamonwm, time, transition) {
        // FIXME - see also flyUp
        this.actor.get_allocation_box().get_size();
        let [xDest, yDest] = this.source.get_transformed_position();
        let ySrc = -this.source.get_allocation_box().get_height();

        this.actor.set_position(xDest, ySrc);

        let dist = Math.abs(ySrc - yDest);
        time *= dist / layoutManager.primaryMonitor.height * 2; // The time time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(cinnamonwm, xDest, yDest, time, transition);
    }

    traditional(cinnamonwm, time, transition) {
        switch (this.source.meta_window.window_type) {
            case WindowType.NORMAL:
            case WindowType.MODAL_DIALOG:
            case WindowType.DIALOG:
                this.actor.set_pivot_point(0, 0);
                this.actor.scale_x = 0.94;
                this.actor.scale_y = 0.94;
                this.actor.opacity = 0;
                this._fadeWindow(cinnamonwm, this.originalOpacity, time, transition);
                this._scaleWindow(cinnamonwm, 1, 1, time, transition);
                break;
            case WindowType.MENU:
            case WindowType.DROPDOWN_MENU:
            case WindowType.POPUP_MENU:
                let [width, height] = this.source.get_allocation_box().get_size();
                let [destX, destY] = this.source.get_transformed_position();
                let [pointerX, pointerY] = global.get_pointer();
                let top = destY + (height * 0.5);

                if (pointerY < top)
                    this.actor.set_pivot_point(0, 0);
                else
                    this.actor.set_pivot_point(0, 1);

                this.actor.scale_x = 1;
                this.actor.scale_y = 0.9;
                this.actor.opacity = 0;
                this._scaleWindow(cinnamonwm, 1, 1, time, transition, true);
                this._fadeWindow(cinnamonwm, this.originalOpacity, time, transition);
                break;
            default:
                this._fadeWindow(cinnamonwm, this.originalOpacity, time, transition);
        }
    }
}

var Close = class Close extends Effect {
    constructor() {
        super(...arguments);

        this.name = 'close';
        this.arrayName = '_destroying';
        this.wmCompleteName = 'completed_destroy';
    }

    scale(cinnamonwm, time, transition) {
        this._scaleWindow(cinnamonwm, 0, 0, time, transition);
    }

    fade(cinnamonwm, time, transition) {
        removeTweens(this.actor);
        this._fadeWindow(cinnamonwm, 0, time, transition);
    }

    blend(cinnamonwm, time, transition) {
        this._fadeWindow(cinnamonwm, 0, time, transition);
        this._scaleWindow(cinnamonwm, 1.5, 1.5, time, transition);
    }

    move(cinnamonwm, time, transition) {
        let [xDest, yDest] = global.get_pointer();

        this._scaleWindow(cinnamonwm, 0, 0, time, transition);
        this._moveWindow(cinnamonwm, xDest, yDest, time, transition);
    }

    flyUp(cinnamonwm, time, transition) {
        let xDest = this.source.get_transformed_position()[0];
        let yDest = -this.source.get_allocation_box().get_height();

        let dist = Math.abs(this.source.get_transformed_position()[1] - yDest);
        time *= dist / layoutManager.primaryMonitor.height * 2; // The time time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(cinnamonwm, xDest, yDest, time, transition);
    }

    flyDown(cinnamonwm, time, transition) {
        let xDest = this.source.get_transformed_position()[0];
        let yDest = global.stage.get_height();

        let dist = Math.abs(this.source.get_transformed_position()[1] - yDest);
        time *= dist / layoutManager.primaryMonitor.height * 2; // The transition time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(cinnamonwm, xDest, yDest, time, transition);
    }

    traditional(cinnamonwm, time, transition) {
        switch (this.source.meta_window.window_type) {
            case WindowType.NORMAL:
            case WindowType.MODAL_DIALOG:
            case WindowType.DIALOG:
                this.actor.set_pivot_point(0, 0);
                this._scaleWindow(cinnamonwm, 0.88, 0.88, time, transition);
                this._fadeWindow(cinnamonwm, 0, time, transition);
                break;
            default:
                this.scale(cinnamonwm, time, transition);
        }
    }
}

var Minimize = class Minimize extends Close {
    constructor() {
        super(...arguments);

        this.name = 'minimize';
        this.arrayName = '_minimizing';
        this.wmCompleteName = 'completed_minimize';

         // Use Effect's _end method
        this._end = Effect.prototype._end;
    }

    traditional(cinnamonwm, time, transition) {
        let geom = this.source.meta_window.iconGeometry;
        this.actor.set_scale(1, 1);
        let xDest, yDest, xScale, yScale;
        xDest = geom.x;
        yDest = geom.y;
        xScale = geom.width / this.actor.width;
        yScale = geom.height / this.actor.height;
        this.source.meta_window._cinnamonwm_has_origin = true;
        this._moveWindow(cinnamonwm, xDest, yDest, time, transition);
        this._scaleWindow(cinnamonwm, xScale, yScale, time, transition, true);
        this._fadeWindow(cinnamonwm, 0, time, transition);
    }
}

// unminimizing is a 'map' effect but should use 'minimize' setting values
var Unminimize = class Unminimize extends Effect {
    constructor() {
        super(...arguments);

        this.name = 'unminimize';
        this.arrayName = '_mapping';
        this.wmCompleteName = 'completed_map';

        this._end = Map.prototype._end;
    }

    traditional(cinnamonwm, time, transition) {
        let geom = this.source.meta_window.iconGeometry;

        this.actor.set_scale(0.1, 0.1);
        this.actor.opacity = 0;
        let xSrc = geom.x;
        let ySrc = geom.y;
        let [xDest, yDest] = this.source.get_transformed_position();
        this.actor.set_position(xSrc, ySrc);
        this._moveWindow(cinnamonwm, xDest, yDest, time, transition);
        this._scaleWindow(cinnamonwm, 1, 1, time, transition, true);
        this._fadeWindow(cinnamonwm, this.originalOpacity, time, transition);
    }
}

var Tile = class Tile extends Effect {
    constructor() {
        super(...arguments);

        this.name = 'tile';
        this.arrayName = '_tiling';
        this.wmCompleteName = 'completed_tile';
    }

    scale(cinnamonwm, time, transition, args) {
        let [targetX, targetY, targetWidth, targetHeight] = args;

        if (targetWidth === this.actor.width) targetWidth -= 1;
        if (targetHeight === this.actor.height) targetHeight -= 1;

        let scale_x = targetWidth / this.actor.width;
        let scale_y = targetHeight / this.actor.height;
        let anchor_x = (this.actor.x - targetX) * this.actor.width / (targetWidth - this.actor.width);
        let anchor_y = (this.actor.y - targetY) * this.actor.height / (targetHeight - this.actor.height);

        this.actor.move_anchor_point(anchor_x, anchor_y);

        this._scaleWindow(cinnamonwm, scale_x, scale_y, time, transition, true);
    }
}

var Maximize = class Maximize extends Tile {
    constructor() {
        super(...arguments);

        this.name = 'maximize';
        this.arrayName = '_maximizing';
        this.wmCompleteName = 'completed_maximize';
    }

}

var Unmaximize = class Unmaximize extends Tile {
    constructor() {
        super(...arguments);

        this.name = 'unmaximize';
        this.arrayName = '_unmaximizing';
        this.wmCompleteName = 'completed_unmaximize';
    }
}
