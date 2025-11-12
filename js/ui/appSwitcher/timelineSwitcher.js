// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const AppSwitcher3D = imports.ui.appSwitcher.appSwitcher3D;

function TimelineSwitcher() {
    this._init.apply(this, arguments);
}

TimelineSwitcher.prototype = {
    __proto__: AppSwitcher3D.AppSwitcher3D.prototype,

    _init: function() {
        AppSwitcher3D.AppSwitcher3D.prototype._init.apply(this, arguments);
    },

    _adaptClones: function() {
        let monitor = this._activeMonitor;
        for (let i in this._previews) {
            let clone = this._previews[i];
            clone.anchor_gravity = Clutter.Gravity.WEST;
            clone.rotation_angle_y = 12;
            clone.target_x = Math.round(monitor.width * 0.3);
            clone.target_y = Math.round(monitor.height * 0.5);
            clone.lower_bottom();
        }
    },

    _selectNext: function() {
        this._currentIndex = (this._currentIndex + 1) % this._windows.length;
        this._updateList(1);
    },

    _selectPrevious: function() {
        this._currentIndex = (this._windows.length + this._currentIndex - 1) % this._windows.length;
        this._updateList(-1);
    },

    _updateList: function(direction) {
        if(this._previews.length == 0)
            return;

        let monitor = this._activeMonitor;

        if(this._previews.length == 1) {
            let preview = this._previews[0];

            preview.ease({
                opacity: 255,
                x: preview.target_x,
                y: preview.target_y,
                width: preview.target_width,
                height: preview.target_height,
                animationRequired: true,
                duration: AppSwitcher3D.ANIMATION_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });

            return;
        }

        // preview windows
        for (let i in this._previews) {
            let preview = this._previews[i];
            i = parseInt(i);
            let distance = (this._currentIndex > i) ? this._previews.length - this._currentIndex + i : i - this._currentIndex;

            if (distance == this._previews.length - 1 && direction > 0) {
                preview.__looping = true;

                preview.ease({
                    opacity: 0,
                    x: preview.target_x + 200,
                    y: preview.target_y + 100,
                    width: preview.target_width,
                    height: preview.target_height,
                    duration: AppSwitcher3D.ANIMATION_TIME / 2,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    animationRequired: true,
                    onComplete: () => this._onFadeForwardComplete(preview, distance, AppSwitcher3D.ANIMATION_TIME)
                });
            } else if (distance == 0 && direction < 0) {
                preview.__looping = true;
                preview.ease({
                    opacity: 0,
                    duration: AppSwitcher3D.ANIMATION_TIME / 2,
                    animationRequired: true,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => this._onFadeBackwardsComplete(preview, distance, AppSwitcher3D.ANIMATION_TIME)
                });
            } else {
                let easeParams = {
                    opacity: 255,
                    x: preview.target_x - Math.sqrt(distance) * 150,
                    y: preview.target_y - Math.sqrt(distance) * 100,
                    width: Math.max(preview.target_width * ((20 - 2 * distance) / 20), 0),
                    height: Math.max(preview.target_height * ((20 - 2 * distance) / 20), 0),
                    animationRequired: true,
                    duration: AppSwitcher3D.ANIMATION_TIME,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD
                };
                if(preview.__looping || preview.__finalEase)
                    preview.__finalEase = easeParams;
                else
                    preview.ease(easeParams);
            }
        }
    },

    _onFadeBackwardsComplete: function(preview, distance, animation_time) {
        preview.__looping = false;
        preview.raise_top();

        preview.x = preview.target_x + 200;
        preview.y =  preview.target_y + 100;
        preview.width = preview.target_width;
        preview.height = preview.target_height;

        preview.ease({
            opacity: 255,
            x: preview.target_x,
            y: preview.target_y,
            width: preview.target_width,
            height: preview.target_height,
            animationRequired: true,
            duration: animation_time / 2,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._onFinishMove(preview)
        });
    },

    _onFadeForwardComplete: function(preview, distance, animation_time) {
        preview.__looping = false;
        preview.lower_bottom();

        preview.x = preview.target_x - Math.sqrt(distance) * 150;
        preview.y = preview.target_y - Math.sqrt(distance) * 100;
        preview.width = Math.max(preview.target_width * ((20 - 2 * distance) / 20), 0);
        preview.height = Math.max(preview.target_height * ((20 - 2 * distance) / 20), 0);

        preview.ease({
            opacity: 255,
            duration: animation_time / 2,
            animationRequired: true,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._onFinishMove(preview)
        });
    },

    _onFinishMove: function(preview) {
        if(preview.__finalEase) {
            preview.ease(preview.__finalEase);
            preview.__finalEase = null;
        }
    }

};
