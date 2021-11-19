// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;

var EdgeFlipper = class {
    constructor(side, func) {
        this.side = side;
        this.func = func;

        this.enabled = true;
        this.delay = 1000;
        this.entered = false;
        this.activated = false;

        this._checkOver();
    }

    _checkOver() {
        if (this.enabled) {
            let mask;
            [this.xMouse, this.yMouse, mask] = global.get_pointer();
            if (!(mask & Clutter.ModifierType.BUTTON1_MASK)) {
                if (this.side == St.Side.RIGHT){
                    if (this.xMouse + 2 > global.screen_width){
                        this._onMouseEnter();
                    } else {
                        this._onMouseLeave();
                    }
                } else if (this.side == St.Side.LEFT){
                    if (this.xMouse < 2 ){
                        this._onMouseEnter();
                    } else {
                        this._onMouseLeave();
                    }
                } else if (this.side == St.Side.BOTTOM){
                    if (this.yMouse + 2 > global.screen_height) {
                        this._onMouseEnter();
                    } else {
                        this._onMouseLeave();
                    }
                } else if (this.side == St.Side.TOP){
                    if (this.yMouse < 2){
                        this._onMouseEnter();
                    } else {
                        this._onMouseLeave();
                    }
                }
            }
            Mainloop.timeout_add(Math.max(this.delay, 200), Lang.bind(this, this._checkOver));
        }
    }

    _onMouseEnter() {
        this.entered = true;
        Mainloop.timeout_add(this.delay, Lang.bind(this, this._check));
    }

    _check() {
        if (this.entered && this.enabled && !this.activated){
            this.func();
            this.activated = true;
        }
    }

    _onMouseLeave() {
        this.entered = false;
        this.activated = false;
    }
};
