const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;

const AppletManager = imports.ui.appletManager;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

function Effect(){
    throw new TypeError("Trying to instantiate abstract class WindowEffects.Effect");
}

Effect.prototype = {
    _init: function(wm){
        //wm is the instance of windowManger.js
        this.wm = wm;
    },

    _end: function(actor){
        actor.set_scale(1, 1);
        actor.opacity = actor.orig_opacity || 255;
        actor.move_anchor_point_from_gravity(Clutter.Gravity.NORTH_WEST);
    },

    _fadeWindow: function(cinnamonwm, actor, opacity, time, transition){
        Tweener.addTween(actor, {
            opacity: opacity,
            time: time,
            min: 0,
            max: 255,
            transition: transition,
            onComplete: this.wm._endWindowEffect,
            onCompleteScope: this.wm,
            onCompleteParams: [cinnamonwm, this.name, actor]
        });
    },

    _scaleWindow: function(cinnamonwm, actor, scale_x, scale_y, time, transition, keepAnchorPoint){
        if (!keepAnchorPoint)
            actor.move_anchor_point_from_gravity(Clutter.Gravity.CENTER);

        Tweener.addTween(actor, {
            scale_x: scale_x,
            scale_y: scale_y,
            time: time,
            min: 0,
            transition: transition,
            onComplete: this.wm._endWindowEffect,
            onCompleteScope: this.wm,
            onCompleteParams: [cinnamonwm, this.name, actor]
        });
    },

    _moveWindow: function(cinnamonwm, actor, x, y, time, transition){
        Tweener.addTween(actor, {
            x: x,
            y: y,
            time: time,
            transition: transition,
            onComplete: this.wm._endWindowEffect,
            onCompleteScope: this.wm,
            onCompleteParams: [cinnamonwm, this.name, actor]
        });
    }
};

function Map(){
    this._init.apply(this, arguments);
}

Map.prototype = {
    __proto__: Effect.prototype,
    name: "map",
    arrayName: "_mapping",
    wmCompleteName: "completed_map",

    scale: function(cinnamonwm, actor, time, transition){
        actor.set_scale(0, 0);
        this._scaleWindow(cinnamonwm, actor, 1, 1, time, transition);
    },

    fade: function(cinnamonwm, actor, time, transition){
        actor.opacity = 0;
        this._fadeWindow(cinnamonwm, actor, actor.orig_opacity, time, transition);
    },

    blend: function(cinnamonwm, actor, time, transition){
        actor.opacity = 0;
        actor.set_scale(1.5, 1.5);
        this._fadeWindow(cinnamonwm, actor, actor.orig_opacity, time, transition);
        this._scaleWindow(cinnamonwm, actor, 1, 1, time, transition);
    },

    move: function(cinnamonwm, actor, time, transition){
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
    },

    flyUp: function(cinnamonwm, actor, time, transition){
        //FIXME: somehow we need this line to get the correct position, without it will return [0, 0]
        actor.get_allocation_box().get_size();
        let [xDest, yDest] = actor.get_transformed_position();
        let ySrc = global.stage.get_height();

        actor.set_position(xDest, ySrc);

        let dist = Math.abs(ySrc - yDest);
        time *= dist / Main.layoutManager.primaryMonitor.height * 2; // The transition time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);

    },

    flyDown: function(cinnamonwm, actor, time, transition){
        //FIXME - see also flyUp
        actor.get_allocation_box().get_size();
        let [xDest, yDest] = actor.get_transformed_position();
        let ySrc = -actor.get_allocation_box().get_height();

        actor.set_position(xDest, ySrc);

        let dist = Math.abs(ySrc - yDest);
        time *= dist / Main.layoutManager.primaryMonitor.height * 2; // The time time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);
    },

    traditional: function(cinnamonwm, actor, time, transition) {
        if (!actor._windowType) {
            actor._windowType = actor.meta_window.get_window_type();
        }

        switch (actor._windowType) {
            case Meta.WindowType.NORMAL:
                actor.set_pivot_point(0, 0);
                actor.scale_x = 0.01;
                actor.scale_y = 0.05;
                actor.opacity = 0;
                this._fadeWindow(cinnamonwm, actor, actor.orig_opacity, time, transition);
                this._scaleWindow(cinnamonwm, actor, 1, 1, time, transition);
                break;
            case Meta.WindowType.MENU:
            case Meta.WindowType.DROPDOWN_MENU:
            case Meta.WindowType.POPUP_MENU:
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
            case Meta.WindowType.MODAL_DIALOG:
            case Meta.WindowType.DIALOG:
                actor.set_pivot_point(0, 0);
                actor.scale_x = 1;
                actor.scale_y = 0;
                actor.opacity = 0;
                this._fadeWindow(cinnamonwm, actor, actor.orig_opacity, time, transition);
                this._scaleWindow(cinnamonwm, actor, 1, 1, time, transition);
                break;
            default:
                this._fadeWindow(cinnamonwm, actor, actor.orig_opacity, time, transition);
        }
    }
}

function Close(){
    this._init.apply(this, arguments);
}

Close.prototype = {
    __proto__: Effect.prototype,
    name: "close",
    arrayName: "_destroying",
    wmCompleteName: "completed_destroy",

    _end: function(actor){
        let parent = actor.get_meta_window().get_transient_for();
        if(parent && actor._parentDestroyId){
            parent.disconnect(actor._parentDestroyId);
            actor._parentDestroyId = 0;
        }
    },

    scale: function(cinnamonwm, actor, time, transition){
        this._scaleWindow(cinnamonwm, actor, 0, 0, time, transition);
    },

    fade: function(cinnamonwm, actor, time, transition){
        Tweener.removeTweens(actor);
        this._fadeWindow(cinnamonwm, actor, 0, time, transition);
    },

    blend: function(cinnamonwm, actor, time, transition){
        this._fadeWindow(cinnamonwm, actor, 0, time, transition);
        this._scaleWindow(cinnamonwm, actor, 1.5, 1.5, time, transition);
    },

    move: function(cinnamonwm, actor, time, transition){
        let [xDest, yDest] = global.get_pointer();

        this._scaleWindow(cinnamonwm, actor, 0, 0, time, transition);
        this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);
    },

    flyUp: function(cinnamonwm, actor, time, transition){
        let xDest = actor.get_transformed_position()[0];
        let yDest = -actor.get_allocation_box().get_height();

        let dist = Math.abs(actor.get_transformed_position()[1] - yDest);
        time *= dist / Main.layoutManager.primaryMonitor.height * 2; // The time time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);
    },

    flyDown: function(cinnamonwm, actor, time, transition){
        let xDest = actor.get_transformed_position()[0];
        let yDest = global.stage.get_height();

        let dist = Math.abs(actor.get_transformed_position()[1] - yDest);
        time *= dist / Main.layoutManager.primaryMonitor.height * 2; // The transition time set is the time if the animation starts/ends at the middle of the screen. Scale it proportional to the actual distance so that the speed of all animations will be constant.

        this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);
    },

    traditional: function(cinnamonwm, actor, time, transition) {
        if (!actor._windowType) {
            actor._windowType = actor.meta_window.get_window_type();
        }

        switch (actor._windowType) {
            case Meta.WindowType.NORMAL:
                actor.set_pivot_point(0, 0);
                this._scaleWindow(cinnamonwm, actor, 0.8, 0.8, time, transition);
                this._fadeWindow(cinnamonwm, actor, 0, time, transition);
                break;
            case Meta.WindowType.MODAL_DIALOG:
            case Meta.WindowType.DIALOG:
                actor.set_pivot_point(0, 0);
                this._fadeWindow(cinnamonwm, actor, 0.5, time, transition);
                this._scaleWindow(cinnamonwm, actor, 1.0, 0, time, transition);
                break;
            default:
                this.scale(cinnamonwm, actor, time, transition);
        }
    }
}

function Minimize(){
    this._init.apply(this, arguments);
}

Minimize.prototype = {
    __proto__: Close.prototype,
    name: "minimize",
    arrayName: "_minimizing",
    wmCompleteName: "completed_minimize",

    //use default _end method
    _end: Effect.prototype._end,

    traditional: function(cinnamonwm, actor, time, transition) {
        let success;
        let geom = new Meta.Rectangle();
        success = actor.meta_window.get_icon_geometry(geom);
        if (success) {
            actor.set_scale(1, 1);
            let xDest, yDest, xScale, yScale;
            xDest = geom.x;
            yDest = geom.y;
            xScale = geom.width / actor.width;
            yScale = geom.height / actor.height;
            actor.get_meta_window()._cinnamonwm_has_origin = true;
            this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);
            this._scaleWindow(cinnamonwm, actor, xScale, yScale, time, transition, true);
            this._fadeWindow(cinnamonwm, actor, 0, time, transition);
        } else {
            this.scale(cinnamonwm, actor, time, transition); // fall-back effect
        }
    }
}

function Unminimize(){
    this._init.apply(this, arguments);
}

Unminimize.prototype = {
    //unminimizing is a "map" effect but should use "minimize" setting values
    __proto__: Effect.prototype,
    name: "unminimize",
    arrayName: "_mapping",
    wmCompleteName: "completed_map",

    _end: Map.prototype._end,

    traditional: function(cinnamonwm, actor, time, transition) {
        let success;
        let geom = new Meta.Rectangle();
        success = actor.meta_window.get_icon_geometry(geom);
        if (success) {
            actor.set_scale(0.1, 0.1);
            actor.opacity = 0;
            let xSrc = geom.x;
            let ySrc = geom.y;
            let [xDest, yDest] = actor.get_transformed_position();
            actor.set_position(xSrc, ySrc);
            this._moveWindow(cinnamonwm, actor, xDest, yDest, time, transition);
            this._scaleWindow(cinnamonwm, actor, 1, 1, time, transition, true);
            this._fadeWindow(cinnamonwm, actor, actor.orig_opacity, time, transition);
        } else {
            throw "No origin found";
        }
    }
}

function Tile(){
    this._init.apply(this, arguments);
}

Tile.prototype = {
    __proto__: Effect.prototype,
    name: "tile",
    arrayName: "_tiling",
    wmCompleteName: "completed_tile",

    scale: function(cinnamonwm, actor, time, transition, args){
        let [targetX, targetY, targetWidth, targetHeight] = args;
        if(targetWidth == actor.width)
            targetWidth -= 1;
        if(targetHeight == actor.height)
            targetHeight -= 1;

        let scale_x = targetWidth / actor.width;
        let scale_y = targetHeight / actor.height;
        let anchor_x = (actor.x - targetX) * actor.width / (targetWidth - actor.width);
        let anchor_y = (actor.y - targetY) * actor.height / (targetHeight - actor.height);

        actor.move_anchor_point(anchor_x, anchor_y);

        this._scaleWindow(cinnamonwm, actor, scale_x, scale_y, time, transition, true);
    }
}

function Maximize(){
    this._init.apply(this, arguments);
}

Maximize.prototype = {
    __proto__: Tile.prototype,
    name: "maximize",
    arrayName: "_maximizing",
    wmCompleteName: "completed_maximize",
}

function Unmaximize(){
    this._init.apply(this, arguments);
}

Unmaximize.prototype = {
    __proto__: Tile.prototype,
    name: "unmaximize",
    arrayName: "_unmaximizing",
    wmCompleteName: "completed_unmaximize"
}
