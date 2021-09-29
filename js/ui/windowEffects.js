const {Gravity} = imports.gi.Clutter;
const {Rectangle, WindowType} = imports.gi.Meta;
const {layoutManager} = imports.ui.main;
const {addTween, removeTweens} = imports.ui.tweener;

class Effect {
    constructor(endWindowEffect) {
        this.endWindowEffect = endWindowEffect;
    }

    _end(actor) {
        actor.set_scale(1, 1);
        actor.opacity = actor.orig_opacity || 255;
        actor.move_anchor_point_from_gravity(Gravity.NORTH_WEST);
    }

    _fadeWindow(cinnamonwm, actor, opacity, time, transition) {
        addTween(actor, {
            opacity,
            time,
            min: 0,
            max: 255,
            transition,
            onComplete: () => this.endWindowEffect(cinnamonwm, this.name, actor),
        });
    }

    _scaleWindow(cinnamonwm, actor, scale_x, scale_y, time, transition, keepAnchorPoint) {
        if (!keepAnchorPoint)
            actor.move_anchor_point_from_gravity(Gravity.CENTER);

        addTween(actor, {
            scale_x,
            scale_y,
            time,
            min: 0,
            transition,
            onComplete: () => this.endWindowEffect(cinnamonwm, this.name, actor),
        });
    }

    _moveWindow(cinnamonwm, actor, x, y, time, transition) {
        addTween(actor, {
            x,
            y,
            time,
            transition,
            onComplete: () => this.endWindowEffect(cinnamonwm, this.name, actor),
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

    move(cinnamonwm, actor) {
        let transition = 'easeOutQuad';
        let time = 0.12;
        let [width, height] = actor.get_allocation_box().get_size();
        let [xDest, yDest] = actor.get_transformed_position();
        xDest += width /= 2;
        yDest += height /= 2;

        let [xSrc, ySrc] = global.get_pointer();
        xSrc -= width;
        ySrc -= height;
        actor.set_position(xSrc, ySrc);

        actor.set_scale(0, 0);

        this._scaleWindow(cinnamonwm, actor, 1, 1, time, transition);
        this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);
    }

    fly(cinnamonwm, actor) {
        let transition = 'easeInSine';
        let time = 0.1;
        // FIXME: somehow we need this line to get the correct position, without it will return [0, 0]
        actor.get_allocation_box().get_size();
        let [xDest, yDest] = actor.get_transformed_position();
        let ySrc = global.stage.get_height();

        actor.set_position(xDest, ySrc);

        let dist = Math.abs(ySrc - yDest);
        time *= dist / layoutManager.primaryMonitor.height * 2; // The transition time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);

    }

    traditional(cinnamonwm, actor) {
        let transition = 'easeOutQuad';
        let time = 0.1;
        switch (actor.meta_window.window_type) {
            case WindowType.NORMAL:
            case WindowType.MODAL_DIALOG:
            case WindowType.DIALOG:
                actor.set_pivot_point(0, 0);
                actor.scale_x = 0.94;
                actor.scale_y = 0.94;
                actor.opacity = 0;
                this._fadeWindow(cinnamonwm, actor, actor.orig_opacity, time, transition);
                this._scaleWindow(cinnamonwm, actor, 1, 1, time, transition);
                break;
            case WindowType.MENU:
            case WindowType.DROPDOWN_MENU:
            case WindowType.POPUP_MENU:
                let [width, height] = actor.get_allocation_box().get_size();
                let [destX, destY] = actor.get_transformed_position();
                let [pointerX, pointerY] = global.get_pointer();
                let top = destY + (height * 0.5);

                if (pointerY < top)
                    actor.set_pivot_point(0, 0);
                else
                    actor.set_pivot_point(0, 1);

                actor.scale_x = 1;
                actor.scale_y = 0.9;
                actor.opacity = 0;
                this._scaleWindow(cinnamonwm, actor, 1, 1, time, transition, true);
                this._fadeWindow(cinnamonwm, actor, actor.orig_opacity, time, transition);
                break;
            default:
                this._fadeWindow(cinnamonwm, actor, actor.orig_opacity, time, transition);
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

    _end(actor) {
        let parent = actor.get_meta_window().get_transient_for();
        if (parent && actor._parentDestroyId) {
            parent.disconnect(actor._parentDestroyId);
            actor._parentDestroyId = 0;
        }
    }

    fly(cinnamonwm, actor) {
        let transition = 'easeInSine';
        let time = 0.1;
        let xDest = actor.get_transformed_position()[0];
        let yDest = global.stage.get_height();

        let dist = Math.abs(actor.get_transformed_position()[1] - yDest);
        time *= dist / layoutManager.primaryMonitor.height * 2; // The transition time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);
    }

    traditional(cinnamonwm, actor) {
        let transition = 'easeOutQuad';
        let time = 0.12;
        switch (actor.meta_window.window_type) {
            case WindowType.NORMAL:
            case WindowType.MODAL_DIALOG:
            case WindowType.DIALOG:
                actor.set_pivot_point(0, 0);
                this._scaleWindow(cinnamonwm, actor, 0.88, 0.88, time, transition);
                this._fadeWindow(cinnamonwm, actor, 0, time, transition);
                break;
            default:
                this._scaleWindow(cinnamonwm, actor, 0, 0, time, transition);
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

<<<<<<< HEAD
    fly(cinnamonwm, actor) {
        let transition = 'easeInSine';
        let time = 0.1;
        let xDest = actor.get_transformed_position()[0];
        let yDest = global.stage.get_height();

        let dist = Math.abs(actor.get_transformed_position()[1] - yDest);
        time *= dist / layoutManager.primaryMonitor.height * 2; // The transition time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        actor.meta_window._cinnamonwm_has_origin = true;
        this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);
    }

    traditional(cinnamonwm, actor) {
        let transition = 'easeInExpo';
        let time = 0.2;
        let success;
        let geom = new Rectangle();
        success = actor.meta_window.get_icon_geometry(geom);
        if (success) {
            actor.set_scale(1, 1);
            let xDest, yDest, xScale, yScale;
            xDest = geom.x;
            yDest = geom.y;
            xScale = geom.width / actor.width;
            yScale = geom.height / actor.height;
            actor.meta_window._cinnamonwm_has_origin = true;
            this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);
            this._scaleWindow(cinnamonwm, actor, xScale, yScale, time, transition, true);
            this._fadeWindow(cinnamonwm, actor, 0, time, transition);
        } else {
            this._scaleWindow(cinnamonwm, actor, 0, 0, time, transition); // fall-back effect
        }
    }
}

// unminimizing is a 'map' effect but should use 'minimize' setting values
var Unminimize = class Unminimize extends Minimize {
    constructor() {
        super(...arguments);

        this.name = 'unminimize';
        this.arrayName = '_unminimizing';
        this.wmCompleteName = 'completed_unminimize';
    }

<<<<<<< HEAD
    fly(cinnamonwm, actor) {
        let transition = 'easeInSine';
        let time = 0.1;
        // FIXME: somehow we need this line to get the correct position, without it will return [0, 0]
        actor.get_allocation_box().get_size();
        let [xDest, yDest] = actor.get_transformed_position();
        let ySrc = global.stage.get_height();

        actor.set_position(xDest, ySrc);

        let dist = Math.abs(ySrc - yDest);
        time *= dist / layoutManager.primaryMonitor.height * 2; // The transition time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);
    }

    traditional(cinnamonwm, actor) {
        let transition = 'easeOutQuad';
        let time = 0.16;
        let success;
        let geom = new Rectangle();

        let [xDest, yDest] = actor.get_transformed_position();
        actor.opacity = 0;

        success = actor.meta_window.get_icon_geometry(geom);

        // let success;
        // let geom = new Rectangle();
        let [success, geom] = actor.meta_window.get_icon_geometry();
        if (success) {
            actor.set_scale(0.1, 0.1);
            let xSrc = geom.x;
            let ySrc = geom.y;
            actor.set_position(xSrc, ySrc);
            this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);
            this._scaleWindow(cinnamonwm, actor, 1, 1, time, transition, true);
            this._fadeWindow(cinnamonwm, actor, actor.orig_opacity, time, transition);
        } else {
            actor.set_scale(1.0, 1.0);
            actor.set_position(xDest, yDest)
            this._fadeWindow(cinnamonwm, actor, actor.orig_opacity, time, transition);
        }
    }
}

var SizeChange = class SizeChange extends Effect {
    constructor() {
        super(...arguments);

        this.name = 'sizechange';
        this.arrayName = '_size_changing';
        this.wmCompleteName = 'completed_size_change';
    }

    traditional(cinnamonwm, actor, args) {
        let transition = 'easeNone';
        let time = 0.1;
        let [targetX, targetY, targetWidth, targetHeight] = args;
        let [old_rect, new_rect] = args;

        if (new_rect.width === old_rect.width) new_rect.width -= 1;
        if (new_rect.height === old_rect.height) new_rect.height -= 1;

        let scale_x = new_rect.width / old_rect.width;
        let scale_y = new_rect.height / old_rect.height;
        let anchor_x = (old_rect.x - new_rect.x) * old_rect.width / (new_rect.width - old_rect.width);
        let anchor_y = (old_rect.y - new_rect.y) * old_rect.height / (new_rect.height - old_rect.height);

        actor.move_anchor_point(anchor_x, anchor_y);

        this._scaleWindow(cinnamonwm, actor, scale_x, scale_y, time, transition, true);
        this.name = 'maximize';
        this.arrayName = '_maximizing';
        this.wmCompleteName = 'completed_maximize';
    }
}
//         this.name = 'maximize';
//         this.arrayName = '_maximizing';
//         this.wmCompleteName = 'completed_maximize';
//     }

// }
