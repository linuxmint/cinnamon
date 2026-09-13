// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const Gio = imports.gi.Gio;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const WorkspacesView = imports.ui.workspacesView;

// ***************
// This shows all of the windows on the current workspace
// ***************

// Time for initial animation going into Overview mode
var ANIMATION_TIME = 200;
var BG_SHADE_BRIGHTNESS = -0.4;

const SHADE_NEUTRAL = 127;
const SHADE_DIMMED = Math.round(SHADE_NEUTRAL * (1 + BG_SHADE_BRIGHTNESS));

function shadeColor(value) {
    return Clutter.Color.new(value, value, value, 255);
}

const SwipeScrollDirection = WorkspacesView.SwipeScrollDirection;

const SwipeScrollResult = WorkspacesView.SwipeScrollResult;

var Overview = GObject.registerClass({
    Signals: {
        'overview-background-button-press': {},
        'swipe-scroll-begin': {},
        'swipe-scroll-end': { param_types: [GObject.TYPE_INT] },
        'showing': {},
        'shown': {},
        'hiding': {},
        'hidden': {},
    },
}, class Overview extends GObject.Object {
    _init() {
        super._init();
        this._spacing = 0;

        this._group = new St.Widget({ name: 'overview',
                                      reactive: true });
        this._shadeEffect = new Clutter.BrightnessContrastEffect({ name: 'shade' });
        this._shadeEffect.brightness = shadeColor(SHADE_NEUTRAL);
        this._group.add_effect(this._shadeEffect);
        this._group._delegate = this;
        this._group.connect('style-changed', () => {
            let node = this._group.get_theme_node();
            let spacing = node.get_length('spacing');
            if (spacing != this._spacing) {
                this._spacing = spacing;
            }
        });
        this._group.hide();
        Main.switcherGroup.add_actor(this._group);

        this._scrollDirection = SwipeScrollDirection.NONE;
        this._scrollAdjustment = null;
        this._capturedEventId = 0;
        this._buttonPressId = 0;

        this.visible = false;           // animating to overview, in overview, animating out
        this._shown = false;            // show() and not hide()
        this._modal = false;            // have a modal grab
        this.animationInProgress = false;
        this._hideInProgress = false;

        this._windowSwitchTimeoutId = 0;
        this._windowSwitchTimestamp = 0;
        this._lastActiveWorkspaceIndex = -1;
        this._lastHoveredWindow = null;

        Main.layoutManager.connect('monitors-changed', this.hide.bind(this));
    }

    setScrollAdjustment(adjustment, direction) {
        this._scrollAdjustment = adjustment;
        if (this._scrollAdjustment == null)
            this._scrollDirection = SwipeScrollDirection.NONE;
        else
            this._scrollDirection = direction;
    }

    _onButtonPress(actor, event) {
        this.emit('overview-background-button-press');
        if (this._scrollDirection == SwipeScrollDirection.NONE
            || event.get_button() != 1)
            return Clutter.EVENT_PROPAGATE;

        let [stageX, stageY] = event.get_coords();
        this._dragStartX = this._dragX = stageX;
        this._dragStartY = this._dragY = stageY;
        this._dragStartValue = this._scrollAdjustment.value;
        this._lastMotionTime = -1; // used to track "stopping" while swipe-scrolling
        this._capturedEventId = global.stage.connect('captured-event',
            this._onCapturedEvent.bind(this));
        this.emit('swipe-scroll-begin');
        return Clutter.EVENT_STOP;
    }

    _onCapturedEvent(actor, event) {
        let stageX, stageY;
        let threshold = Gtk.Settings.get_default().gtk_dnd_drag_threshold;

        switch(event.type()) {
            case Clutter.EventType.BUTTON_RELEASE:
                [stageX, stageY] = event.get_coords();

                // default to snapping back to the original value
                let newValue = this._dragStartValue;

                let minValue = this._scrollAdjustment.lower;
                let maxValue = this._scrollAdjustment.upper - this._scrollAdjustment.page_size;

                let direction;
                if (this._scrollDirection == SwipeScrollDirection.HORIZONTAL) {
                    direction = stageX > this._dragStartX ? -1 : 1;
                    if (St.Widget.get_default_direction() == St.TextDirection.RTL)
                        direction *= -1;
                } else {
                    direction = stageY > this._dragStartY ? -1 : 1;
                }

                // We default to scroll a full page size; both the first
                // and the last page may be smaller though, so we need to
                // adjust difference in those cases.
                let difference = direction * this._scrollAdjustment.page_size;
                if (this._dragStartValue + difference > maxValue)
                    difference = maxValue - this._dragStartValue;
                else if (this._dragStartValue + difference < minValue)
                    difference = minValue - this._dragStartValue;

                // If the user has moved more than half the scroll
                // difference, we want to "settle" to the new value
                // even if the user stops dragging rather "throws" by
                // releasing during the drag.
                let distance = this._dragStartValue - this._scrollAdjustment.value;
                let dt = (event.get_time() - this._lastMotionTime) / 1000;
                let passedHalf = Math.abs(distance / difference) > 0.5;

                /* Switch to the next page if the scroll amount is more
                   than half the page width or is faster than 25px/s.
                   This number comes from experimental tests. */
                if (Math.abs(distance) > dt * 25 || passedHalf) {
                    if (this._dragStartValue + difference >= minValue &&
                        this._dragStartValue + difference <= maxValue)
                        newValue += difference;
                }

                let result;

                // See if the user has moved the mouse enough to trigger
                // a drag
                if (Math.abs(stageX - this._dragStartX) < threshold &&
                    Math.abs(stageY - this._dragStartY) < threshold) {
                    // no motion? It's a click!
                    result = SwipeScrollResult.CLICK;
                    this.emit('swipe-scroll-end', result);
                } else {
                    if (newValue == this._dragStartValue)
                        result = SwipeScrollResult.CANCEL;
                    else
                        result = SwipeScrollResult.SWIPE;

                    // The event capture handler is disconnected
                    // while scrolling to the final position, so
                    // to avoid undesired prelights we raise
                    // the cover pane.
                    this._coverPane.raise_top();
                    this._coverPane.show();

                    this._scrollAdjustment.ease(newValue, {
                        duration: ANIMATION_TIME,
                        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                        onComplete: () => {
                            this._coverPane.hide();
                            this.emit('swipe-scroll-end', result);
                        }
                    });
                }

                global.stage.disconnect(this._capturedEventId);
                this._capturedEventId = 0;

                return result != SwipeScrollResult.CLICK
                    ? Clutter.EVENT_STOP
                    : Clutter.EVENT_PROPAGATE;

            case Clutter.EventType.MOTION:
                [stageX, stageY] = event.get_coords();
                let dx = this._dragX - stageX;
                let dy = this._dragY - stageY;
                let primary = Main.layoutManager.primaryMonitor;

                this._dragX = stageX;
                this._dragY = stageY;
                this._lastMotionTime = event.get_time();

                // See if the user has moved the mouse enough to trigger
                // a drag
                if (Math.abs(stageX - this._dragStartX) < threshold &&
                    Math.abs(stageY - this._dragStartY) < threshold)
                    return Clutter.EVENT_STOP;

                if (this._scrollDirection == SwipeScrollDirection.HORIZONTAL) {
                    if (St.Widget.get_default_direction() == St.TextDirection.RTL)
                        this._scrollAdjustment.value -= (dx / primary.width) * this._scrollAdjustment.page_size;
                    else
                        this._scrollAdjustment.value += (dx / primary.width) * this._scrollAdjustment.page_size;
                } else {
                    this._scrollAdjustment.value += (dy / primary.height) * this._scrollAdjustment.page_size;
                }

                return Clutter.EVENT_STOP;

            // Block enter/leave events to avoid prelights
            // during swipe-scroll
            case Clutter.EventType.ENTER:
            case Clutter.EventType.LEAVE:
                return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    show() {
        if (this._shown || this.animationInProgress)
            return;
        // Do this manually instead of using _syncInputMode, to handle failure
        if (!Main.pushModal(this._group, undefined, undefined, Cinnamon.ActionMode.OVERVIEW,
                            () => this._dismissGrab()))
            return;
        this._modal = true;
        this._shown = true;
        this._animateVisible();

        this._buttonPressId = this._group.connect('button-press-event',
            this._onButtonPress.bind(this));
    }

    _animateVisible() {
        if (this.visible || this.animationInProgress)
            return;

        this._prepareVisible();

        this._shadeEffect.brightness = shadeColor(SHADE_NEUTRAL);
        this._group.ease_property('@effects.shade.brightness', shadeColor(SHADE_DIMMED), {
            duration: ANIMATION_TIME * 0.45,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._showDone()
        });
    }

    /**
     * _prepareVisible: puts everything the window selector needs on screen
     * with no animation, so both _animateVisible() and gestureBegin() can
     * start from here.
     */
    _prepareVisible() {
        // The live background is inside global.window_group, which is hidden
        // below, so build a separate one for the overview.
        this._background = Main.createFullScreenBackground();
        this._background.set_position(0, 0);
        this._group.add_actor(this._background);

        this.visible = true;
        this.animationInProgress = true;

        // During transitions, we raise this to the top to avoid having the overview
        // area be reactive; it causes too many issues such as mouseover handlers in the workspaces.
        this._coverPane = new Clutter.Rectangle({ opacity: 0,
                                                  reactive: true });
        this._group.add_actor(this._coverPane);
        this._coverPane.set_position(0, 0);
        this._coverPane.set_size(global.screen_width, global.screen_height);
        this._coverPane.connect('event', () => Clutter.EVENT_STOP);
        this._coverPane.hide();

        Meta.disable_unredirect_for_display(global.display);

        global.window_group.hide();
        this._group.show();

        this.workspacesView = new WorkspacesView.WorkspacesView();
        Main.switcherGroup.add_actor(this.workspacesView);
        Main.panelManager.disablePanels();

        this._coverPane.raise_top();
        this._coverPane.show();

        this.emit('showing');
    }

    // --- gestures that follow the fingers ---------------------------------
    //
    // Opening the selector shades the desktop and moves every window into
    // its grid slot. The caller is TrackedViewAction in
    // ui/gestures/actions.js: begin, any number of update, then one end.
    //
    // Workspace.zoomToOverview() checks gestureInProgress to skip its own
    // animation; the first update moves the windows from there instead.

    get gestureInProgress() {
        return this._gestureAdjustment != null;
    }

    /**
     * _setGestureProgress: holds the shade and every window at @progress
     * between its real position and its grid slot.
     */
    _setGestureProgress(progress) {
        const shade = SHADE_NEUTRAL + (SHADE_DIMMED - SHADE_NEUTRAL) * progress;
        this._shadeEffect.brightness = shadeColor(Math.round(shade));

        if (this.workspacesView)
            this.workspacesView.setGestureProgress(progress);
    }

    /**
     * gestureBegin: starts a swipe, opening a closed selector or closing
     * an open one. The progress must exist before _prepareVisible() runs,
     * since building the workspaces view reads gestureInProgress.
     *
     * Returns: false if the swipe cannot start, in which case do not call
     * gestureUpdate() or gestureEnd().
     */
    gestureBegin() {
        if (this.animationInProgress || this.gestureInProgress || !Main.animations_enabled)
            return false;

        const showing = !this._shown;

        if (showing) {
            if (!Main.pushModal(this._group, undefined, undefined, Cinnamon.ActionMode.OVERVIEW,
                                () => this._dismissGrab()))
                return false;

            this._modal = true;
            this._shown = true;
            this._gestureAdjustment = new St.Adjustment({ value: 0, lower: 0, upper: 1 });
            this._prepareVisible();
        } else {
            this._gestureAdjustment = new St.Adjustment({ value: 1, lower: 0, upper: 1 });
        }

        this._gestureAdjustment.connect('notify::value',
            () => this._setGestureProgress(this._gestureAdjustment.value));

        this.workspacesView.prepareGesture();
        this._setGestureProgress(showing ? 0 : 1);
        this.animationInProgress = true;

        return true;
    }

    /**
     * gestureUpdate: clamps @progress (0 closed to 1 open) so the windows
     * cannot overshoot either end.
     */
    gestureUpdate(progress) {
        if (!this.gestureInProgress)
            return;

        this._gestureAdjustment.value = Math.min(1, Math.max(0, progress));
    }

    /**
     * gestureEnd: animates to @target over @duration ms and commits. Uses
     * ::stopped rather than a completion handler, so an interrupted settle
     * still cleans up.
     */
    gestureEnd(target, duration) {
        if (!this.gestureInProgress)
            return;

        this._gestureAdjustment.ease(target, {
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            onStopped: () => this._gestureDone(target),
        });
    }

    /**
     * _gestureDone: commits @target. 1 is the tail of a normal show; 0
     * undoes what gestureBegin() prepared, the same work a finished hide
     * does.
     */
    _gestureDone(target) {
        this._gestureAdjustment = null;

        // A click or a key can hide the selector while the settle runs. The
        // hide has then undone everything this would commit.
        if (!this.visible || this._hideInProgress)
            return;

        if (target >= 0.5) {
            if (this.workspacesView)
                this.workspacesView.endGesture(true);

            this._showDone();
            return;
        }

        // Only pixels moved while the fingers were down, so undo the rest
        // here.
        this._shown = false;
        Main.panelManager.enablePanels();

        if (this.workspacesView) {
            this.workspacesView.endGesture(false);
            this.workspacesView.hide();
        }

        this.emit('hiding');
        this._hideDone();
    }

    hide() {
        if (!this._shown)
            return;

        this._shown = false;
        this._animateNotVisible();

        this._syncInputMode();

        if (this._buttonPressId > 0)
            this._group.disconnect(this._buttonPressId);
        this._buttonPressId = 0;
    }

    // onDismiss handler for Main.dismissInternalModals().
    _dismissGrab() {
        this.hide();
        if (this._modal) {
            Main.popModal(this._group);
            this._modal = false;
        }
    }

    toggle() {
        if (this._shown)
            this.hide();
        else
            this.show();
    }

    _syncInputMode() {
        // We delay input mode changes during animation so that when removing the
        // overview we don't have a problem with the release of a press/release
        // going to an application.
        if (this.animationInProgress)
            return;

        if (this._shown) {
            if (!this._modal) {
                if (Main.pushModal(this._group, undefined, undefined, Cinnamon.ActionMode.OVERVIEW,
                                   () => this._dismissGrab()))
                    this._modal = true;
                else
                    this.hide();
            }
        } else {
            if (this._modal) {
                Main.popModal(this._group);
                this._modal = false;
            }
            else if (global.stage_input_mode == Cinnamon.StageInputMode.FULLSCREEN)
                global.stage_input_mode = Cinnamon.StageInputMode.NORMAL;
        }
    }

    _animateNotVisible() {
        if (this.animationInProgress && !this._hideInProgress) {
            this._hideInProgress = true;
            Main.panelManager.enablePanels();
            this.workspacesView.hide();
            this._coverPane.raise_top();
            this._coverPane.show();
            this.emit('hiding');
            let faded = (SHADE_NEUTRAL - this._shadeEffect.brightness.red) /
                        (SHADE_NEUTRAL - SHADE_DIMMED);
            let progress = 1 - Math.sqrt(1 - faded);
            this._group.ease_property('@effects.shade.brightness', shadeColor(SHADE_NEUTRAL), {
                duration: Math.max(1, ANIMATION_TIME * 0.45 * progress),
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => this._hideDone()
            });
            return;
        }

        if (!this.visible || this.animationInProgress)
            return;

        this.animationInProgress = true;
        this._hideInProgress = true;
        Main.panelManager.enablePanels();

        this.workspacesView.hide();

        this._coverPane.raise_top();
        this._coverPane.show();
        this.emit('hiding');

        this._group.ease_property('@effects.shade.brightness', shadeColor(SHADE_NEUTRAL), {
            duration: ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._hideDone()
        });
    }

    _showDone() {
        this.animationInProgress = false;
        this._coverPane.hide();

        this.emit('shown');

        this._syncInputMode();
        global.sync_pointer();
    }

    _hideDone() {
        this._group.remove_actor(this._coverPane);
        this._coverPane.destroy();
        this._coverPane = null;

        this._group.remove_actor(this._background);
        this._background.destroy();
        this._background = null;

        Meta.enable_unredirect_for_display(global.display);

        global.window_group.show();

        this.workspacesView.destroy();
        this.workspacesView = null;

        this._group.hide();

        this.visible = false;
        this.animationInProgress = false;
        this._hideInProgress = false;

        this.emit('hidden');

        this._syncInputMode();
        Main.layoutManager._chrome.updateRegions();
    }
});
