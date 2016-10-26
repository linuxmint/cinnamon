// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const St = imports.gi.St;

const Util = imports.misc.util;
const Layout = imports.ui.layout;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Mainloop = imports.mainloop;
const HOT_CORNER_ACTIVATION_TIMEOUT = 0.5;
const OVERVIEW_CORNERS_KEY = 'overview-corner';
const Tooltips = imports.ui.tooltips;

// Map texts to boolean value
const TF = [];
TF['true'] = true;
TF['false'] = false;

function HotCornerManager() {
    this._init();
}

HotCornerManager.prototype = {
    _init: function() {
        this.corners = [];
        for (let i = 0; i < 4; i++) { // In order: top left; top right; bottom left; bottom right;
            this.corners.push(new HotCorner());
            Main.layoutManager.addChrome(this.corners[i].actor);
            Main.layoutManager.addChrome(this.corners[i].iconActor, {
                visibleInFullscreen: false
            });
        }
        this.parseGSettings();
        global.settings.connect('changed::' + OVERVIEW_CORNERS_KEY, Lang.bind(this, this.parseGSettings));

        this.updatePosition(Main.layoutManager.primaryMonitor, Main.layoutManager.bottomMonitor);
    },

    parseGSettings: function() {
        let options = global.settings.get_strv(OVERVIEW_CORNERS_KEY);
        if (options.length != 4) {
            global.log(_("Invalid overview options: Incorrect number of corners"));
            return false;
        }

        for (let i = 0; i < 4; i++) {
            let elements = options[i].split(':');
            this.corners[i].setProperties(elements);
        }
        return true;
    },

    updatePosition: function(primaryMonitor, bottomMonitor) {
        let p_x = primaryMonitor.x;
        let p_y = primaryMonitor.y;
        let b_x = bottomMonitor.x;
        let b_y = bottomMonitor.y + bottomMonitor.height;

        // Top Left: 0
        this.corners[0].actor.set_position(p_x, p_y);
        this.corners[0].iconActor.set_position(p_x + 1, p_y + 1);

        // Top Right: 1
        this.corners[1].actor.set_position(p_x + primaryMonitor.width - 2, p_y);
        this.corners[1].iconActor.set_position(p_x + primaryMonitor.width - 33, p_y + 1);

        // Bottom Left: 2
        this.corners[2].actor.set_position(b_x, b_y - 1);
        this.corners[2].iconActor.set_position(b_x + 1, b_y - 33);

        // Bottom Right: 3
        this.corners[3].actor.set_position(b_x + bottomMonitor.width - 2, b_y - 1);
        this.corners[3].iconActor.set_position(b_x + bottomMonitor.width - 33, b_y - 33);
        return true;
    }
};

// HotCorner:
//
// This class manages a "hot corner" that can toggle switching to
// overview.
function HotCorner() {
    this._init();
}

HotCorner.prototype = {
    _init: function() {
        // We use this flag to mark the case where the user has entered the
        // hot corner and has not left both the hot corner and a surrounding
        // guard area (the "environs"). This avoids triggering the hot corner
        // multiple times due to an accidental jitter.
        this._entered = false;

        this.action = null; // The action to activate when hot corner is triggered
        this.hover = false; // Whether the hot corners responds to hover
        this.icon = false; // Whether the overview corner icon is shown
        this.hover_delay = 0; // Hover delay activation
        this.hover_delay_id = 0; // Hover delay timer ID

        // Construct the hot corner 'ripples'
        this.actor = new Clutter.Group({
            name: 'hot-corner-environs',
            width: 3,
            height: 3,
            reactive: true
        });

        this._corner = new Clutter.Rectangle({
            name: 'hot-corner',
            width: 2,
            height: 1,
            opacity: 0,
            reactive: true
        });
        this._corner._delegate = this;

        this.actor.add_actor(this._corner);

        if (St.Widget.get_default_direction() == St.TextDirection.RTL) {
            this._corner.set_position(this.actor.width - this._corner.width, 0);
            this.actor.set_anchor_point_from_gravity(Clutter.Gravity.NORTH_EAST);
        } else {
            this._corner.set_position(0, 0);
        }

        this._activationTime = 0;

        this.actor.connect('leave-event',
            Lang.bind(this, this._onEnvironsLeft));

        // Clicking on the hot corner environs should result in the
        // same behavior as clicking on the hot corner.
        this.actor.connect('button-release-event',
            Lang.bind(this, this._onCornerClicked));

        // In addition to being triggered by the mouse enter event,
        // the hot corner can be triggered by clicking on it. This is
        // useful if the user wants to undo the effect of triggering
        // the hot corner once in the hot corner.
        this._corner.connect('enter-event',
            Lang.bind(this, this._onCornerEntered));
        this._corner.connect('button-release-event',
            Lang.bind(this, this._onCornerClicked));
        this._corner.connect('leave-event',
            Lang.bind(this, this._onCornerLeft));

        this.tile_delay = false;
        global.window_manager.connect('tile', Lang.bind(this, this._tilePerformed));

        // Cache the three ripples instead of dynamically creating and destroying them.
        this._ripple1 = new St.BoxLayout({
            style_class: 'ripple-box',
            opacity: 0
        });
        this._ripple2 = new St.BoxLayout({
            style_class: 'ripple-box',
            opacity: 0
        });
        this._ripple3 = new St.BoxLayout({
            style_class: 'ripple-box',
            opacity: 0
        });

        Main.uiGroup.add_actor(this._ripple1);
        Main.uiGroup.add_actor(this._ripple2);
        Main.uiGroup.add_actor(this._ripple3);

        this._ripple1.hide();
        this._ripple2.hide();
        this._ripple3.hide();

        // Construct the overview corner icon
        this.iconActor = new St.Button({
            name: 'overview-corner',
            reactive: true,
            track_hover: true
        });

        this.iconActor.tooltip = new Tooltips.Tooltip(this.iconActor);

        this.iconActor.connect('button-release-event', Lang.bind(this, this.runAction));

        this.iconActor.set_size(32, 32);
    },

    destroy: function() {
        this.actor.destroy();
    },

    _tile_delay_cb: function() {
        this.tile_delay = false;
        return false;
    },

    _tilePerformed: function(cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
        this.tile_delay = true;
        Mainloop.timeout_add(250, Lang.bind(this, this._tile_delay_cb));
    },

    _animRipple: function(ripple, delay, time, startScale, startOpacity, finalScale) {
        // We draw a ripple by using a source image and animating it scaling
        // outwards and fading away. We want the ripples to move linearly
        // or it looks unrealistic, but if the opacity of the ripple goes
        // linearly to zero it fades away too quickly, so we use Tweener's
        // 'onUpdate' to give a non-linear curve to the fade-away and make
        // it more visible in the middle section.

        ripple._opacity = startOpacity;

        ripple.set_anchor_point_from_gravity(Clutter.Gravity.CENTER);
        ripple.visible = true;
        ripple.opacity = 255 * Math.sqrt(startOpacity);
        ripple.scale_x = ripple.scale_y = startScale;

        let [x, y] = this._corner.get_transformed_position();
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
    },

    setProperties: function(properties) {
        this.action = properties[0];
        this.hover = TF[properties[1]];
        this.icon = TF[properties[2]];
        this.hover_delay = properties[3] ? Number(properties[3]) : 0;

        if (this.hover)
            this.actor.show();
        else
            this.actor.hide();

        if (this.icon) {
            this.iconActor.show();
            this.iconActor.tooltip.set_text(this.getIconTooltip());
        } else
            this.iconActor.hide();
    },

    getIconTooltip: function() {
        switch (this.action) {
            case 'expo':
                return _("Show all workspaces");
            case 'scale':
                return _("Show all windows");
            case 'desktop':
                return _("Show the desktop");
            default:
                return _("Run a command") + ": %s".format(this.action);
        }
    },

    rippleAnimation: function() {
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
    },

    runAction: function() {
        this._activationTime = Date.now() / 1000;

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
                global.screen.toggle_desktop(global.get_current_time());
                break;
            default:
                Util.spawnCommandLine(this.action);
        }
    },

    _onCornerEntered: function() {
        if (this.hover_delay_id > 0) {
            Mainloop.source_remove(this.hover_delay_id);
            this.hover_delay_id = 0;
        }

        this.hover_delay_id = Mainloop.timeout_add(this.hover_delay, Lang.bind(this, function() {
            if (!this._entered && !this.tile_delay) {
                this._entered = true;
                let run = false;
                if (!(Main.expo.visible || Main.overview.visible)) {
                    run = true;
                }
                if ((Main.expo.visible && this.action == 'expo') ||
                    (Main.overview.visible && this.action == 'scale')) {
                    run = true;
                }
                if (run) {
                    this.rippleAnimation();
                    this.runAction();
                }
            }
        }));
        return false;
    },

    _onCornerClicked: function() {
        if (this.hover_delay_id > 0) {
            Mainloop.source_remove(this.hover_delay_id);
            this.hover_delay_id = 0;
        }

        if (this.shouldToggleOverviewOnClick())
            this.rippleAnimation();
        this.runAction();
        return true;
    },

    _onCornerLeft: function(actor, event) {
        if (this.hover_delay_id > 0) {
            Mainloop.source_remove(this.hover_delay_id);
            this.hover_delay_id = 0;
        }

        if (event.get_related() != this.actor)
            this._entered = false;
        // Consume event, otherwise this will confuse onEnvironsLeft
        return true;
    },

    _onEnvironsLeft: function(actor, event) {
        if (event.get_related() != this._corner)
            this._entered = false;
        return false;
    },

    // Checks if the Activities button is currently sensitive to
    // clicks. The first call to this function within the
    // HOT_CORNER_ACTIVATION_TIMEOUT time of the hot corner being
    // triggered will return false. This avoids opening and closing
    // the overview if the user both triggered the hot corner and
    // clicked the Activities button.
    shouldToggleOverviewOnClick: function() {
        if (Main.overview.animationInProgress)
            return false;
        if (this._activationTime == 0 || Date.now() / 1000 - this._activationTime > HOT_CORNER_ACTIVATION_TIMEOUT)
            return true;
        return false;
    }
};
