// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const St = imports.gi.St;

const Util = imports.misc.util;
const Layout = imports.ui.layout;
const Main = imports.ui.main;
const Ripples = imports.ui.ripples;

const HOT_CORNER_ACTIVATION_TIMEOUT = 500; // Milliseconds
const OVERVIEW_CORNERS_KEY = 'hotcorner-layout';
const CORNERS_FULLSCREEN_KEY = 'hotcorner-fullscreen';

const CORNER_FENCE_LENGTH = 10;
const CORNER_ACTOR_SIZE = 2;

const ULC = 0;
const URC = 1;
const LLC = 2;
const LRC = 3;

// HotCorner:
//
// This class manages a "hot corner" that can toggle switching to
// overview.
var HotCorner = GObject.registerClass(
class HotCorner extends Clutter.Actor {
    _init(cornerType, isFullscreen) {
        super._init({
            name: 'hot-corner',
            width: CORNER_ACTOR_SIZE,
            height: CORNER_ACTOR_SIZE,
            opacity: 0,
            reactive: true,
        });

        this.action = null; // The action to activate when hot corner is triggered
        this.hoverDelay = 0; // Hover delay activation
        this.hoverDelayId = 0; // Hover delay timer ID
        this._hoverActivationTime = 0; // Milliseconds

        this._hleg = null;
        this._vleg = null;

        const m = Main.layoutManager.primaryMonitor;

        if(isFullscreen) {
            Main.layoutManager.addChrome(this, { visibleInFullscreen: true });
        } else {
            Main.layoutManager.addChrome(this);
        }

        switch (cornerType) {
            case ULC:
                this._hleg = new Meta.Barrier({
                    display: global.display,
                    x1: m.x, y1: m.y,
                    x2: m.x + CORNER_FENCE_LENGTH, y2: m.y,
                    directions: Meta.BarrierDirection.POSITIVE_Y
                });

                this._vleg = new Meta.Barrier({
                    display: global.display,
                    x1: m.x, y1: m.y,
                    x2: m.x, y2: m.y + CORNER_FENCE_LENGTH,
                    directions: Meta.BarrierDirection.POSITIVE_X
                });
                this.set_position(m.x, m.y);
                break;

            case URC:
                this._hleg = new Meta.Barrier({
                    display: global.display,
                    x1: m.x + m.width - CORNER_FENCE_LENGTH, y1: m.y,
                    x2: m.x + m.width, y2: m.y,
                    directions: Meta.BarrierDirection.POSITIVE_Y
                });

                this._vleg = new Meta.Barrier({
                    display: global.display,
                    x1: m.x + m.width, y1: m.y,
                    x2: m.x + m.width, y2: m.y + CORNER_FENCE_LENGTH,
                    directions: Meta.BarrierDirection.NEGATIVE_X
                });
                this.set_position(m.x + m.width - CORNER_ACTOR_SIZE, m.y);
                break;

            case LLC:
                this._hleg = new Meta.Barrier({
                    display: global.display,
                    x1: m.x, y1: m.y + m.height,
                    x2: m.x + CORNER_FENCE_LENGTH, y2: m.y + m.height,
                    directions: Meta.BarrierDirection.NEGATIVE_Y
                });

                this._vleg = new Meta.Barrier({
                    display: global.display,
                    x1: m.x, y1: m.y + m.height - CORNER_FENCE_LENGTH,
                    x2: m.x, y2: m.y + m.height,
                    directions: Meta.BarrierDirection.POSITIVE_X
                });
                this.set_position(m.x, m.y + m.height - CORNER_ACTOR_SIZE);
                break;

            case LRC:
                this._hleg = new Meta.Barrier({
                    display: global.display,
                    x1: m.x + m.width - CORNER_FENCE_LENGTH, y1: m.y + m.height,
                    x2: m.x + m.width, y2: m.y + m.height,
                    directions: Meta.BarrierDirection.NEGATIVE_Y
                });

                this._vleg = new Meta.Barrier({
                    display: global.display,
                    x1: m.x + m.width, y1: m.y + m.height - CORNER_FENCE_LENGTH,
                    x2: m.x + m.width, y2: m.y + m.height,
                    directions: Meta.BarrierDirection.POSITIVE_X
                });
                this.set_position(m.x + m.width - CORNER_ACTOR_SIZE, m.y + m.height - CORNER_ACTOR_SIZE);
                break;
        }

        // In addition to being triggered by the mouse enter event,
        // the hot corner can be triggered by clicking on it. This is
        // useful if the user wants to undo the effect of triggering
        // the hot corner once in the hot corner.
        this.connect('enter-event', () => this._onCornerEntered());
        this.connect('button-release-event', () => this._onCornerClicked());
        this.connect('leave-event', () => this._onCornerLeft());

        this._ripples = new Ripples.Ripples(0.5, 0.5, 'ripple-box');
        this._ripples.addTo(Main.uiGroup);

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onDestroy() {
        this._vleg = null;
        this._hleg = null;
        Main.layoutManager.removeChrome(this);
        this._ripples.destroy();
    }

    setProperties(properties) {
        this.action = properties[0];
        this.hoverDelay = properties[2] ? Number(properties[2]) : 0;
    }

    rippleAnimation() {
        let [x, y] = this.get_transformed_position();
        this._ripples.playAnimation(x, y);
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
                global.workspace_manager.toggle_desktop(timestamp);
                break;
            default:
                Util.spawnCommandLine(this.action);
        }
    }

    _onCornerEntered() {
        if (this.hoverDelayId > 0) {
            GLib.source_remove(this.hoverDelayId);
            this.hoverDelayId = 0;
        }

        /* Get the timestamp outside the timeout handler because
           global.get_current_time() can only be called within the
           scope of an event handler or it will return 0 */
        let timestamp = global.get_current_time() + this.hoverDelay;
        this.hoverDelayId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.hoverDelay, () => {
            if (this.shouldRunAction(timestamp, false)) {
                this._hoverActivationTime = timestamp;
                this.rippleAnimation();
                this.runAction(timestamp);
            }

            this.hoverDelayId = 0;
            return GLib.SOURCE_REMOVE;
        });

        return Clutter.EVENT_PROPAGATE;
    }

    _onCornerClicked() {
        if (this.hoverDelayId > 0) {
            GLib.source_remove(this.hoverDelayId);
            this.hoverDelayId = 0;
        }

        let timestamp = global.get_current_time();
        if (this.shouldRunAction(timestamp, true)) {
            this.rippleAnimation();
            this.runAction(timestamp);
        }

        return Clutter.EVENT_STOP;
    }

    _onCornerLeft() {
        if (this.hoverDelayId > 0) {
            GLib.source_remove(this.hoverDelayId);
            this.hoverDelayId = 0;
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
});

var HotCornerManager = class {
    constructor() {
        this.corners = {};
        global.settings.connect('changed::' + OVERVIEW_CORNERS_KEY, () => this.update());
        global.settings.connect('changed::' + CORNERS_FULLSCREEN_KEY, () => this.update());
        this.update();
    }

    update() {
        let options = global.settings.get_strv(OVERVIEW_CORNERS_KEY);
        let isFullscreen = global.settings.get_boolean(CORNERS_FULLSCREEN_KEY);

        if (options.length != 4) {
            global.logError(_("Invalid overview options: Incorrect number of corners"));
            return false;
        }

        // In order: top left; top right; bottom left; bottom right;
        for (let i = 0; i < 4; i++) {
            if (this.corners[i] !== undefined) {
                this.corners[i].destroy();
                this.corners[i] = undefined;
            }

            let elements = options[i].split(':');
            if (elements[1] === 'true') {
                if (elements.length > 3) {
                    // We've also split the command because it contained colons,
                    // so remove (splice), rejoin (join) and reinsert (unshift) it.
                    let cmd = elements.splice(0, elements.length-2).join(':');
                    elements.unshift(cmd);
                }

                if(isFullscreen === true) {
                    this.corners[i] = new HotCorner(i, true);
                } else {
                    this.corners[i] = new HotCorner(i);
                }
                this.corners[i].setProperties(elements);
            }
        }
    }
};
