const {Gravity, Clone, ActorFlags} = imports.gi.Clutter;
const {Rectangle, WindowType} = imports.gi.Meta;
const Main = imports.ui.main;
const {layoutManager, panelManager} = Main;
const {addTween, removeTweens} = imports.ui.tweener;

class Effect {
    constructor() {
        this.name = '';
        this.wmCompleteName = '';
        this.originalOpacity = 0;
        this.actor = null;
        this.source = null;
    }

    setActor(source) {
        this.originalOpacity = source.opacity;

        // For the close effect, use the actual MetaWindowActor instead of the clone
        // because Clutter seems to have issues opacifying clones when the source is already destroyed.
        if (this.name === 'close' || this.name === 'minimize') {
            source.show();
            this.actor = source;

            this.originalX = source.x;
            this.originalY = source.y;
            this.originalScaleX = source.scale_x;
            this.originalScaleY = source.scale_y;
            this.originalWidth = source.width;
            this.originalHeight = source.height;
        } else {
            this.actor = new Clone({
                source,
                reactive: false,
                width: source.width,
                height: source.height,
                x: source.x,
                y: source.y,
                opacity: this.originalOpacity
            });

            global.overlay_group.add_child(this.actor);
            global.overlay_group.set_child_above_sibling(this.actor, null);
        }

        this.source = source;
    }

    _end() {
        if (this.source.is_finalized()) {
            this.actor = this.source = null;
            return;
        }

        global.window_manager[this.wmCompleteName](this.source);

        removeTweens(this.actor);

        if (this.source !== this.actor) {
            global.overlay_group.remove_child(this.actor);
            this.actor.destroy();
        } else if (this.name === 'minimize') {
            this.actor.hide();

            // The properties of the MetaWindowActor have values from the last animation tween state.
            // We need to restore the window to its original state, as muffin only handles Xorg state
            // changes for these properties.
            this.actor.opacity = this.originalOpacity;
            this.actor.x = this.originalX;
            this.actor.y = this.originalY;
            this.actor.scale_x = this.originalScaleX;
            this.actor.scale_y = this.originalScaleY;
            this.actor.width = this.originalWidth;
            this.actor.height = this.originalHeight;
        }

        panelManager.updatePanelsVisibility();

        this.actor = this.source = null;
    }

    _fadeWindow(opacity, time, transition) {
        addTween(this.actor, {
            opacity,
            time,
            min: 0,
            max: 255,
            transition,
            onComplete: () => this._end(),
        });
    }

    _scaleWindow(scale_x, scale_y, time, transition, keepAnchorPoint) {
        if (!keepAnchorPoint)
            this.actor.move_anchor_point_from_gravity(Gravity.CENTER);

        addTween(this.actor, {
            scale_x,
            scale_y,
            time,
            min: 0,
            transition,
            onComplete: () => this._end(),
        });
    }

    _moveWindow(x, y, time, transition) {
        addTween(this.actor, {
            x,
            y,
            time,
            transition,
            onComplete: () => this._end(),
        });
    }
};

var Map = class Map extends Effect {
    constructor() {
        super(...arguments);

        this.name = 'map';
        this.wmCompleteName = 'completed_map';
    }

    _end() {
        this.source.show();
        super._end();
    }

    scale(time, transition) {
        this.actor.set_scale(0, 0);
        this._scaleWindow(1, 1, time, transition);
    }

    fade(time, transition) {
        this.actor.opacity = 0;
        this._fadeWindow(this.originalOpacity, time, transition);
    }

    blend(time, transition) {
        this.actor.opacity = 0;
        this.actor.set_scale(1.5, 1.5);
        this._fadeWindow(this.originalOpacity, time, transition);
        this._scaleWindow(1, 1, time, transition);
    }

    move(time, transition) {
        let [width, height] = this.actor.get_allocation_box().get_size();
        let [xDest, yDest] = this.source.get_transformed_position();
        xDest += width /= 2;
        yDest += height /= 2;

        let [xSrc, ySrc] = global.get_pointer();
        xSrc -= width;
        ySrc -= height;
        this.actor.set_position(xSrc, ySrc);

        this.actor.set_scale(0, 0);

        this._scaleWindow(1, 1, time, transition);
        this._moveWindow(xDest, yDest, time, transition);
    }

    flyUp(time, transition) {
        // FIXME: somehow we need this line to get the correct position, without it will return [0, 0]
        this.actor.get_allocation_box().get_size();
        let [xDest, yDest] = this.source.get_transformed_position();
        let ySrc = global.stage.get_height();

        this.actor.set_position(xDest, ySrc);

        let dist = Math.abs(ySrc - yDest);
        time *= dist / layoutManager.primaryMonitor.height * 2; // The transition time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(xDest, yDest, time, transition);

    }

    flyDown(time, transition) {
        // FIXME - see also flyUp
        this.actor.get_allocation_box().get_size();
        let [xDest, yDest] = this.source.get_transformed_position();
        let ySrc = -this.source.get_allocation_box().get_height();

        this.actor.set_position(xDest, ySrc);

        let dist = Math.abs(ySrc - yDest);
        time *= dist / layoutManager.primaryMonitor.height * 2; // The time time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(xDest, yDest, time, transition);
    }

    traditional(time, transition) {
        switch (this.source.meta_window.window_type) {
            case WindowType.NORMAL:
            case WindowType.MODAL_DIALOG:
            case WindowType.DIALOG:
                this.actor.set_pivot_point(0, 0);
                this.actor.scale_x = 0.94;
                this.actor.scale_y = 0.94;
                this.actor.opacity = 0;
                this._fadeWindow(this.originalOpacity, time, transition);
                this._scaleWindow(1, 1, time, transition);
                break;
            case WindowType.MENU:
            case WindowType.DROPDOWN_MENU:
            case WindowType.POPUP_MENU:
                let [, height] = this.source.get_allocation_box().get_size();
                let [, destY] = this.source.get_transformed_position();
                let [, pointerY] = global.get_pointer();
                let top = destY + (height * 0.5);

                if (pointerY < top)
                    this.actor.set_pivot_point(0, 0);
                else
                    this.actor.set_pivot_point(0, 1);

                this.actor.scale_x = 1;
                this.actor.scale_y = 0.9;
                this.actor.opacity = 0;
                this._scaleWindow(1, 1, time, transition, true);
                this._fadeWindow(this.originalOpacity, time, transition);
                break;
            default:
                this._fadeWindow(this.originalOpacity, time, transition);
        }
    }
}

var Close = class Close extends Effect {
    constructor() {
        super(...arguments);

        this.name = 'close';
        this.wmCompleteName = 'completed_destroy';
    }

    scale(time, transition) {
        this._scaleWindow(0, 0, time, transition);
    }

    fade(time, transition) {
        removeTweens(this.actor);
        this._fadeWindow(0, time, transition);
    }

    blend(time, transition) {
        this._fadeWindow(0, time, transition);
        this._scaleWindow(1.5, 1.5, time, transition);
    }

    move(time, transition) {
        let [xDest, yDest] = global.get_pointer();

        this._scaleWindow(0, 0, time, transition);
        this._moveWindow(xDest, yDest, time, transition);
    }

    flyUp(time, transition) {
        let xDest = this.source.get_transformed_position()[0];
        let yDest = -this.source.get_allocation_box().get_height();

        let dist = Math.abs(this.source.get_transformed_position()[1] - yDest);
        time *= dist / layoutManager.primaryMonitor.height * 2; // The time time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(xDest, yDest, time, transition);
    }

    flyDown(time, transition) {
        let xDest = this.source.get_transformed_position()[0];
        let yDest = global.stage.get_height();

        let dist = Math.abs(this.source.get_transformed_position()[1] - yDest);
        time *= dist / layoutManager.primaryMonitor.height * 2; // The transition time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(xDest, yDest, time, transition);
    }

    traditional(time, transition) {
        if (!this.source.meta_window) {
            this._end();
            return;
        }

        switch (this.source.meta_window.window_type) {
            case WindowType.NORMAL:
            case WindowType.MODAL_DIALOG:
            case WindowType.DIALOG:
                this.actor.set_pivot_point(0, 0);
                this._scaleWindow(0.88, 0.88, time, transition);
                this._fadeWindow(0, time, transition);
                break;
            default:
                this.scale(time, transition);
        }
    }
}

var Minimize = class Minimize extends Close {
    constructor() {
        super(...arguments);

        this.name = 'minimize';
        this.wmCompleteName = 'completed_minimize';

         // Use Effect's _end method
        this._end = Effect.prototype._end;
    }

    traditional(time, transition) {
        let geom = this.source.meta_window.iconGeometry;

        if (!geom) {
            this.scale(time, transition); // fall-back effect
            return;
        }

        this.actor.set_scale(1, 1);
        let xDest, yDest, xScale, yScale;
        xDest = geom.x;
        yDest = geom.y;
        xScale = geom.width / this.actor.width;
        yScale = geom.height / this.actor.height;
        this._moveWindow(xDest, yDest, time, transition);
        this._scaleWindow(xScale, yScale, time, transition, true);
        this._fadeWindow(0, time, transition);
    }
}

// unminimizing is a 'map' effect but should use 'minimize' setting values
var Unminimize = class Unminimize extends Effect {
    constructor() {
        super(...arguments);

        this.name = 'unminimize';
        this.wmCompleteName = 'completed_map';

        this._end = Map.prototype._end;
    }

    traditional(time, transition) {
        let geom = this.source.meta_window.iconGeometry;

        if (!geom) return;

        this.actor.set_scale(0.1, 0.1);
        this.actor.opacity = 0;
        let xSrc = geom.x;
        let ySrc = geom.y;
        let [xDest, yDest] = this.source.get_transformed_position();
        this.actor.set_position(xSrc, ySrc);
        this._moveWindow(xDest, yDest, time, transition);
        this._scaleWindow(1, 1, time, transition, true);
        this._fadeWindow(this.originalOpacity, time, transition);
    }
}

var Tile = class Tile extends Effect {
    constructor() {
        super(...arguments);

        this.name = 'tile';
        this.wmCompleteName = 'completed_tile';
    }

    scale(time, transition, args) {
        let [targetX, targetY, targetWidth, targetHeight] = args;

        if (targetWidth === this.actor.width) targetWidth -= 1;
        if (targetHeight === this.actor.height) targetHeight -= 1;

        let scale_x = targetWidth / this.actor.width;
        let scale_y = targetHeight / this.actor.height;
        let anchor_x = (this.actor.x - targetX) * this.actor.width / (targetWidth - this.actor.width);
        let anchor_y = (this.actor.y - targetY) * this.actor.height / (targetHeight - this.actor.height);

        this.actor.move_anchor_point(anchor_x, anchor_y);

        this._scaleWindow(scale_x, scale_y, time, transition, true);
    }
}

var Maximize = class Maximize extends Tile {
    constructor() {
        super(...arguments);

        this.name = 'maximize';
        this.wmCompleteName = 'completed_maximize';
    }

}

var Unmaximize = class Unmaximize extends Tile {
    constructor() {
        super(...arguments);

        this.name = 'unmaximize';
        this.wmCompleteName = 'completed_unmaximize';
    }
}
