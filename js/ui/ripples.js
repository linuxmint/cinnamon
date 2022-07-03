// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { Clutter, St } = imports.gi;

// Shamelessly copied from the layout "hotcorner" ripples implementation
var Ripples = class Ripples {
    constructor(px, py, styleClass) {
        this._x = 0;
        this._y = 0;

        this._px = px;
        this._py = py;

        this._ripple1 = new St.BoxLayout({
            style_class: styleClass,
            important: true,
            opacity: 0,
            can_focus: false,
            reactive: false,
            visible: false,
        });
        this._ripple1.set_pivot_point(px, py);

        this._ripple2 = new St.BoxLayout({
            style_class: styleClass,
            important: true,
            opacity: 0,
            can_focus: false,
            reactive: false,
            visible: false,
        });
        this._ripple2.set_pivot_point(px, py);

        this._ripple3 = new St.BoxLayout({
            style_class: styleClass,
            important: true,
            opacity: 0,
            can_focus: false,
            reactive: false,
            visible: false,
        });
        this._ripple3.set_pivot_point(px, py);
    }

    destroy() {
        this._ripple1.destroy();
        this._ripple2.destroy();
        this._ripple3.destroy();
    }

    _animRipple(ripple, delay, duration, startScale, startOpacity, finalScale) {
        // We draw a ripple by using a source image and animating it scaling
        // outwards and fading away. We want the ripples to move linearly
        // or it looks unrealistic, but if the opacity of the ripple goes
        // linearly to zero it fades away too quickly, so we use a separate
        // tween to give a non-linear curve to the fade-away and make
        // it more visible in the middle section.

        ripple.x = this._x;
        ripple.y = this._y;
        ripple.visible = true;
        ripple.opacity = 255 * Math.sqrt(startOpacity);
        ripple.scale_x = ripple.scale_y = startScale;
        ripple.set_translation(-this._px * ripple.width, -this._py * ripple.height, 0.0);

        ripple.ease({
            opacity: 0,
            delay,
            duration,
            mode: Clutter.AnimationMode.EASE_IN_QUAD,
        });
        ripple.ease({
            scale_x: finalScale,
            scale_y: finalScale,
            delay,
            duration,
            mode: Clutter.AnimationMode.LINEAR,
            onComplete: () => (ripple.visible = false),
        });
    }

    addTo(stage) {
        if (this._stage !== undefined)
            throw new Error('Ripples already added');

        this._stage = stage;
        this._stage.add_actor(this._ripple1);
        this._stage.add_actor(this._ripple2);
        this._stage.add_actor(this._ripple3);
    }

    playAnimation(x, y) {
        if (this._stage === undefined)
            throw new Error('Ripples not added');

        this._x = x;
        this._y = y;

        this._stage.set_child_above_sibling(this._ripple1, null);
        this._stage.set_child_above_sibling(this._ripple2, this._ripple1);
        this._stage.set_child_above_sibling(this._ripple3, this._ripple2);

        // Show three concentric ripples expanding outwards; the exact
        // parameters were found by trial and error, so don't look
        // for them to make perfect sense mathematically

        //                              delay  time   scale opacity => scale
        this._animRipple(this._ripple1,   0,    830,   0.25,  1.0,     1.5);
        this._animRipple(this._ripple2,  50,   1000,   0.0,   0.7,     1.25);
        this._animRipple(this._ripple3, 350,   1000,   0.0,   0.3,     1);
    }
};
