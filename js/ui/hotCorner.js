// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const Util = imports.misc.util;
const Layout = imports.ui.layout;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Mainloop = imports.mainloop;

const HOT_CORNER_ACTIVATION_TIMEOUT = 500; // Milliseconds
const OVERVIEW_CORNERS_KEY = 'hotcorner-layout';

// HotCorner:
//
// This class manages a "hot corner" that can toggle switching to
// overview.
class HotCorner {
    constructor() {
        this.action = null; // The action to activate when hot corner is triggered
        this.hover_delay = 0; // Hover delay activation
        this.hover_delay_id = 0; // Hover delay timer ID
        this._hoverActivationTime = 0; // Milliseconds

        // Construct the hot corner 'ripples'
        this.actor = new Clutter.Actor({
            name: 'hot-corner',
            width: 2,
            height: 2,
            opacity: 0,
            reactive: true
        });

        // In addition to being triggered by the mouse enter event,
        // the hot corner can be triggered by clicking on it. This is
        // useful if the user wants to undo the effect of triggering
        // the hot corner once in the hot corner.
        this.actor.connect('enter-event', () => this._onCornerEntered());
        this.actor.connect('button-release-event', () => this._onCornerClicked());
        this.actor.connect('leave-event', () => this._onCornerLeft());

        this.tile_delay = false;
        global.window_manager.connect('tile', () => {
            this.tile_delay = true;
            Mainloop.timeout_add(250, () => this.tile_delay = false);
        });

        // Cache the three ripples instead of dynamically creating and destroying them.
        this._ripple1 = new St.Widget({
            style_class: 'ripple-box',
            opacity: 0
        });
        this._ripple2 = new St.Widget({
            style_class: 'ripple-box',
            opacity: 0
        });
        this._ripple3 = new St.Widget({
            style_class: 'ripple-box',
            opacity: 0
        });

        Main.uiGroup.add_actor(this._ripple1);
        Main.uiGroup.add_actor(this._ripple2);
        Main.uiGroup.add_actor(this._ripple3);

        this._ripple1.hide();
        this._ripple2.hide();
        this._ripple3.hide();
    }

    destroy() {
        this._ripple1.destroy();
        this._ripple2.destroy();
        this._ripple3.destroy();
        this.actor.destroy();
    }

    _animRipple(ripple, delay, time, startScale, startOpacity, finalScale) {
        Tweener.removeTweens(ripple);
        // We draw a ripple by using a source image and animating it scaling
        // outwards and fading away. We want the ripples to move linearly
        // or it looks unrealistic, but if the opacity of the ripple goes
        // linearly to zero it fades away too quickly, so we use Tweener's
        // 'onUpdate' to give a non-linear curve to the fade-away and make
        // it more visible in the middle section.

        ripple._opacity = startOpacity;

        // Set anchor point on the center of the ripples
        ripple.set_pivot_point(0.5, 0.5);
        ripple.set_translation(-ripple.width/2, -ripple.height/2, 0);

        ripple.visible = true;
        ripple.opacity = 255 * Math.sqrt(startOpacity);
        ripple.scale_x = ripple.scale_y = startScale;

        let [x, y] = this.actor.get_transformed_position();
        ripple.x = x;
        ripple.y = y;

        Tweener.addTween(ripple, {
            _opacity: 0,
            scale_x: finalScale,
            scale_y: finalScale,
            delay: delay,
            time: time,
            transition: 'linear',
            onUpdate: function() {
                ripple.opacity = 255 * Math.sqrt(ripple._opacity);
            },
            onComplete: function() {
                ripple.visible = false;
            }
        });
    }

    setProperties(properties) {
        this.action = properties[0];
        this.hover_delay = properties[2] ? Number(properties[2]) : 0;
    }

    rippleAnimation() {
        // Show three concentric ripples expanding outwards; the exact
        // parameters were found by trial and error, so don't look
        // for them to make perfect sense mathematically

        this._ripple1.show();
        this._ripple2.show();
        this._ripple3.show();

        //                              delay  time  scale opacity => scale
        this._animRipple(this._ripple1, 0.0, 0.83, 0.25, 1.0, 1.5);
        this._animRipple(this._ripple2, 0.05, 1.0, 0.0, 0.7, 1.25);
        this._animRipple(this._ripple3, 0.35, 1.0, 0.0, 0.3, 1);
    }

    runAction(timestamp) {
        switch (this.action) {
            case 'expo':
                if (!Main.expo.animationInProgress)
                    Main.expo.toggle();
                break;
            case 'scale':
                if (!Main.overview.animationInProgress)
                    Main.overview.toggle();
                break;
            case 'desktop':
                global.screen.toggle_desktop(timestamp);
                break;
            default:
                Util.spawnCommandLine(this.action);
        }
    }

    _onCornerEntered() {
        if (this.hover_delay_id > 0) {
            Mainloop.source_remove(this.hover_delay_id);
            this.hover_delay_id = 0;
        }

        /* Get the timestamp outside the timeout handler because
           global.get_current_time() can only be called within the
           scope of an event handler or it will return 0 */
        let timestamp = global.get_current_time() + this.hover_delay;
        this.hover_delay_id = Mainloop.timeout_add(this.hover_delay, () => {
            if (!this.tile_delay) {
                if (this.shouldRunAction(timestamp, false)) {
                    this._hoverActivationTime = timestamp;
                    this.rippleAnimation();
                    this.runAction(timestamp);
                }
            }

            this.hover_delay_id = 0;
            return false;
        });

        return Clutter.EVENT_PROPAGATE;
    }

    _onCornerClicked() {
        if (this.hover_delay_id > 0) {
            Mainloop.source_remove(this.hover_delay_id);
            this.hover_delay_id = 0;
        }

        let timestamp = global.get_current_time();
        if (this.shouldRunAction(timestamp, true)) {
            this.rippleAnimation();
            this.runAction(timestamp);
        }

        return Clutter.EVENT_STOP;
    }

    _onCornerLeft() {
        if (this.hover_delay_id > 0) {
            Mainloop.source_remove(this.hover_delay_id);
            this.hover_delay_id = 0;
        }
        // Consume event
        return Clutter.EVENT_STOP;
    }

    shouldRunAction(timestamp, click) {
        /* Expo and scale disable hot corners except theirs */
        if ((Main.expo.visible && this.action != 'expo') ||
            (Main.overview.visible && this.action != 'scale'))
            return false;

        if (Main.overview.animationInProgress)
            return false;

        /* This avoids launching the action twice if the user both hovered
           and clicked the corner actor at the same time */
        if (click && timestamp - this._hoverActivationTime < HOT_CORNER_ACTIVATION_TIMEOUT)
            return false;

        return true;
    }
};

var HotCornerManager = class {
    constructor() {
        this.corners = [null, null, null, null];
        global.settings.connect('changed::' + OVERVIEW_CORNERS_KEY, () => this.update());
        this.update();
    }

    parseGSettings() {
        let options = global.settings.get_strv(OVERVIEW_CORNERS_KEY);
        if (options.length != 4) {
            global.logError(_("Invalid overview options: Incorrect number of corners"));
            return false;
        }

        // In order: top left; top right; bottom left; bottom right;
        for (let i = 0; i < 4; i++) {
            let elements = options[i].split(':');
            if (elements[1] === 'true') {
                if (elements.length > 3) {
                    // We've also split the command because it contained colons,
                    // so remove (splice), rejoin (join) and reinsert (unshift) it.
                    let cmd = elements.splice(0, elements.length-2).join(':');
                    elements.unshift(cmd);
                }
                if (!this.corners[i]) {
                    this.corners[i] = new HotCorner();
                    Main.layoutManager.addChrome(this.corners[i].actor);
                }
                this.corners[i].setProperties(elements);
            } else if (this.corners[i]) {
                this.corners[i].destroy();
                this.corners[i] = null;
            }
        }
    }

    update() {
        this.parseGSettings();
        this.updatePosition(Main.layoutManager.primaryMonitor);
    }

    updatePosition(monitor) {
        let left   = monitor.x;
        let right  = monitor.x + monitor.width - 2;
        let top    = monitor.y;
        let bottom = monitor.y + monitor.height - 2;

        let fn = (i, x, y) => {
            if (this.corners[i] !== null) {
                this.corners[i].actor.set_position(x, y);
            }
        }

        // Top Left: 0
        fn(0, left, top);

        // Top Right: 1
        fn(1, right, top);

        // Bottom Left: 2
        fn(2, left, bottom);

        // Bottom Right: 3
        fn(3, right, bottom);
    }
};
