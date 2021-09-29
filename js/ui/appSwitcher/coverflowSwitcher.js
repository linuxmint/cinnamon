// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Graphene = imports.gi.Graphene;
const Config = imports.misc.config;

const Tweener = imports.ui.tweener;
const AppSwitcher3D = imports.ui.appSwitcher.appSwitcher3D;

const TRANSITION_TYPE = 'easeOutQuad';
const SIDE_ANGLE = 60;
const BLEND_OUT_ANGLE = 30;

function appendParams(base, extra) {
    for (let key in extra) { base[key] = extra[key]; }
}

function CoverflowSwitcher() {
    this._init.apply(this, arguments);
}

CoverflowSwitcher.prototype = {
    __proto__: AppSwitcher3D.AppSwitcher3D.prototype,

    _init: function() {
        AppSwitcher3D.AppSwitcher3D.prototype._init.apply(this, arguments);
        
        let monitor = this._activeMonitor;
        this._yOffset = monitor.height / 2;
        this._xOffsetLeft = monitor.width * 0.1;
        this._xOffsetRight = monitor.width - this._xOffsetLeft;
        this._xOffsetCenter = monitor.width / 2;
    },

    _selectNext: function() {
        if (this._currentIndex == this._windows.length - 1) {
            this._currentIndex = 0;
            this._flipStack(Clutter.Gravity.WEST);
        } else {
            this._currentIndex = this._currentIndex + 1;
            this._updateList();
        }
    },

    _selectPrevious: function() {
        if (this._currentIndex == 0) {
            this._currentIndex = this._windows.length-1;
            this._flipStack(Clutter.Gravity.EAST);
        } else {
            this._currentIndex = this._currentIndex - 1;
            this._updateList();
        }
    },
    
    _flipStack: function(gravity) {
        this._looping = true;
        
        let xOffset, angle;
        
        if(gravity == Clutter.Gravity.WEST) {
            xOffset = -this._xOffsetLeft;
            angle = BLEND_OUT_ANGLE;
        } else {
            xOffset = this._activeMonitor.width + this._xOffsetLeft;
            angle = -BLEND_OUT_ANGLE;
        }
        
        let animation_time = AppSwitcher3D.ANIMATION_TIME * 2/3;
        
        for (let i in this._previews) {
            let preview = this._previews[i];
            preview._cfIsLast = (i == this._windows.length-1);
            this._animatePreviewToSide(preview, i, gravity, xOffset, {
                opacity: 0,
                rotation_angle_y: angle,
                time: animation_time,
                transition: TRANSITION_TYPE,
                onCompleteParams: [preview, i, gravity],
                onComplete: this._onFlipIn,
                onCompleteScope: this,
            });
        }
    },
    
    _onFlipIn: function(preview, index, gravity) {
        let xOffsetStart, xOffsetEnd, angleStart, angleEnd;
        
        if(gravity == Clutter.Gravity.WEST) {
            xOffsetStart = this._activeMonitor.width + this._xOffsetLeft;
            xOffsetEnd = this._xOffsetRight;
            angleStart = -BLEND_OUT_ANGLE;
            angleEnd = -SIDE_ANGLE;
        } else {
            xOffsetStart = -this._xOffsetLeft;
            xOffsetEnd = this._xOffsetLeft;
            angleStart = BLEND_OUT_ANGLE;
            angleEnd = SIDE_ANGLE;
        }
        
        let animation_time = AppSwitcher3D.ANIMATION_TIME * 2/3;
        
        preview.rotation_angle_y = angleStart;
        preview.x = xOffsetStart + 50 * (index - this._currentIndex);
        let lastExtraParams = {
            onCompleteParams: [],
            onComplete: this._onFlipComplete,
            onCompleteScope: this
        };
        let oppositeGravity = (gravity == Clutter.Gravity.WEST) ? Clutter.Gravity.EAST : Clutter.Gravity.WEST;
        
        if (index == this._currentIndex) {
            preview.raise_top();
            let extraParams = preview._cfIsLast ? lastExtraParams : null;
            this._animatePreviewToMid(preview, oppositeGravity, animation_time, extraParams);
        } else {
            if(gravity == Clutter.Gravity.EAST)
                preview.raise_top();
            else
                preview.lower_bottom();
                
            let extraParams = {
                opacity: 255,
                rotation_angle_y: angleEnd,
                time: animation_time,
                transition: TRANSITION_TYPE
            };
            
            if (preview._cfIsLast)
                appendParams(extraParams, lastExtraParams);
            this._animatePreviewToSide(preview, index, oppositeGravity, xOffsetEnd, extraParams);
        }
    },
    
    _onFlipComplete: function() {
        this._looping = false;
        if(this._requiresUpdate == true) {
            this._requiresUpdate = false;
            this._updateList();
        }
    },
    
    _animatePreviewToMid: function(preview, oldGravity, animation_time, extraParams) {
        let rotation_vertex_x = (oldGravity == Clutter.Gravity.EAST) ? preview.width / 2 : -preview.width / 2;
        preview.move_anchor_point_from_gravity(Clutter.Gravity.CENTER);
        preview.rotation_center_y = new Graphene.Point3D({ x: rotation_vertex_x, y: 0.0, z: 0.0 });
        preview.raise_top();
        let tweenParams = {
            opacity: 255,
            x: this._xOffsetCenter,
            y: this._yOffset,
            width: preview.target_width,
            height: preview.target_height,
            rotation_angle_y: 0.0,
            time: animation_time,
            transition: TRANSITION_TYPE
        };
        
        if(extraParams)
            appendParams(tweenParams, extraParams);
        
        Tweener.addTween(preview, tweenParams);
    },
    
    _animatePreviewToSide: function(preview, index, gravity, xOffset, extraParams) {
        preview.move_anchor_point_from_gravity(gravity);
        preview.rotation_center_y = new Graphene.Point3D({ x: 0.0, y: 0.0, z: 0.0 });

        let tweenParams = {
            x: xOffset + 50 * (index - this._currentIndex),
            y: this._yOffset,
            width: Math.max(preview.target_width_side * (10 - Math.abs(index - this._currentIndex)) / 10, 0),
            height: Math.max(preview.target_height_side * (10 - Math.abs(index - this._currentIndex)) / 10, 0),
        };
        
        appendParams(tweenParams, extraParams);
        
        Tweener.addTween(preview, tweenParams);
    },

    _updateList: function() {
        if(this._looping) {
            this._requiresUpdate = true;
            return;
        }
        
        let monitor = this._activeMonitor;
        let animation_time = AppSwitcher3D.ANIMATION_TIME;
        
        // preview windows
        for (let i in this._previews) {
            let preview = this._previews[i];

            if (i == this._currentIndex) {
                this._animatePreviewToMid(preview, preview.get_anchor_point_gravity(), animation_time);
            } else if (i < this._currentIndex) {
                preview.raise_top();
                this._animatePreviewToSide(preview, i, Clutter.Gravity.WEST, this._xOffsetLeft, {
                    opacity: 255,
                    rotation_angle_y: SIDE_ANGLE,
                    time: animation_time,
                    transition: TRANSITION_TYPE
                });
            } else if (i > this._currentIndex) {
                preview.lower_bottom();
                this._animatePreviewToSide(preview, i, Clutter.Gravity.EAST, this._xOffsetRight, {
                    opacity: 255,
                    rotation_angle_y: -SIDE_ANGLE,
                    time: animation_time,
                    transition: TRANSITION_TYPE
                });
            }
        }
    },
};
