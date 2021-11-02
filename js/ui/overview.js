// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;
const Signals = imports.signals;
const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Gdk = imports.gi.Gdk;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Tweener = imports.ui.tweener;
const WorkspacesView = imports.ui.workspacesView;

// Time for initial animation going into Overview mode
var ANIMATION_TIME = 0.2;

const SwipeScrollDirection = WorkspacesView.SwipeScrollDirection;

const SwipeScrollResult = WorkspacesView.SwipeScrollResult;

function Overview() {
    this._init.apply(this, arguments);
}

Overview.prototype = {
    _init : function() {
        this._spacing = 0;

        this._group = new St.Widget({ name: 'overview',
                                      reactive: true });
        this._group._delegate = this;
        this._group.connect('style-changed',
            Lang.bind(this, function() {
                let node = this._group.get_theme_node();
                let spacing = node.get_length('spacing');
                if (spacing != this._spacing) {
                    this._spacing = spacing;
                }
            }));
        this._group.hide();
        global.overlay_group.add_actor(this._group);

        this._scrollDirection = SwipeScrollDirection.NONE;
        this._scrollAdjustment = null;
        this._capturedEventId = 0;
        this._buttonPressId = 0;

        this.visible = false;           // animating to overview, in overview, animating out
        this._shown = false;            // show() and not hide()
        this._shownTemporarily = false; // showTemporarily() and not hideTemporarily()
        this._modal = false;            // have a modal grab
        this.animationInProgress = false;
        this._hideInProgress = false;

        this._windowSwitchTimeoutId = 0;
        this._windowSwitchTimestamp = 0;
        this._lastActiveWorkspaceIndex = -1;
        this._lastHoveredWindow = null;
    },

    // The members we construct that are implemented in JS might
    // want to access the overview as Main.overview to connect
    // signal handlers and so forth. So we create them after
    // construction in this init() method.
    init: function() {
        Main.layoutManager.connect('monitors-changed', Lang.bind(this, this.hide));
    },

    setScrollAdjustment: function(adjustment, direction) {
        this._scrollAdjustment = adjustment;
        if (this._scrollAdjustment == null)
            this._scrollDirection = SwipeScrollDirection.NONE;
        else
            this._scrollDirection = direction;
    },

    _onButtonPress: function(actor, event) {
        this.emit('overview-background-button-press', actor, event);
        if (this._scrollDirection == SwipeScrollDirection.NONE
            || event.get_button() != 1)
            return false;

        let [stageX, stageY] = event.get_coords();
        this._dragStartX = this._dragX = stageX;
        this._dragStartY = this._dragY = stageY;
        this._dragStartValue = this._scrollAdjustment.value;
        this._lastMotionTime = -1; // used to track "stopping" while swipe-scrolling
        this._capturedEventId = global.stage.connect('captured-event',
            Lang.bind(this, this._onCapturedEvent));
        this.emit('swipe-scroll-begin');
        return true;
    },

    _onCapturedEvent: function(actor, event) {
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

                /* Switch to the next page if the scroll ammount is more
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

                    Tweener.addTween(this._scrollAdjustment,
                                     { value: newValue,
                                       time: ANIMATION_TIME,
                                       transition: 'easeOutQuad',
                                       onCompleteScope: this,
                                       onComplete: function() {
                                          this._coverPane.hide();
                                          this.emit('swipe-scroll-end',
                                                    result);
                                       }
                                     });
                }

                global.stage.disconnect(this._capturedEventId);
                this._capturedEventId = 0;

                return result != SwipeScrollResult.CLICK;

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
                    return true;

                if (this._scrollDirection == SwipeScrollDirection.HORIZONTAL) {
                    if (St.Widget.get_default_direction() == St.TextDirection.RTL)
                        this._scrollAdjustment.value -= (dx / primary.width) * this._scrollAdjustment.page_size;
                    else
                        this._scrollAdjustment.value += (dx / primary.width) * this._scrollAdjustment.page_size;
                } else {
                    this._scrollAdjustment.value += (dy / primary.height) * this._scrollAdjustment.page_size;
                }

                return true;

            // Block enter/leave events to avoid prelights
            // during swipe-scroll
            case Clutter.EventType.ENTER:
            case Clutter.EventType.LEAVE:
                return true;
        }

        return false;
    },

    //// Public methods ////

    // show:
    //
    // Animates the overview visible and grabs mouse and keyboard input
    show : function() {
        if (this._shown)
            return;
        // Do this manually instead of using _syncInputMode, to handle failure
        if (!Main.pushModal(this._group))
            return;
        this._modal = true;
        this._shown = true;
        this._animateVisible();

        this._buttonPressId = this._group.connect('button-press-event',
            Lang.bind(this, this._onButtonPress));
    },

    _animateVisible: function() {
        if (this.visible || this.animationInProgress)
            return;

        // The main BackgroundActor is inside global.window_group which is
        // hidden when displaying the overview, so we create a new
        // one. Instances of this class share a single CoglTexture behind the
        // scenes which allows us to show the background with different
        // rendering options without duplicating the texture data.
        this._background = new Clutter.Actor();
        this._background.set_position(0, 0);
        this._group.add_actor(this._background);

        let desktopBackground = Meta.BackgroundActor.new_for_screen(global.screen);
        this._background.add_actor(desktopBackground);

        let backgroundShade = new St.Bin({style_class: 'workspace-overview-background-shade'});
        backgroundShade.set_size(global.screen_width, global.screen_height);
        this._background.add_actor(backgroundShade);

        this.visible = true;
        this.animationInProgress = true;

        // During transitions, we raise this to the top to avoid having the overview
        // area be reactive; it causes too many issues such as mouseover handlers in the workspaces.
        this._coverPane = new Clutter.Rectangle({ opacity: 0,
                                                  reactive: true });
        this._group.add_actor(this._coverPane);
        this._coverPane.set_position(0, 0);
        this._coverPane.set_size(global.screen_width, global.screen_height);
        this._coverPane.connect('event', () => true);
        this._coverPane.hide();

        // All the the actors in the window group are completely obscured,
        // hiding the group holding them while the Overview is displayed greatly
        // increases performance of the Overview especially when there are many
        // windows visible.
        //
        // If we switched to displaying the actors in the Overview rather than
        // clones of them, this would obviously no longer be necessary.
        //
        // Disable unredirection while in the overview
        Meta.disable_unredirect_for_screen(global.screen);
        global.window_group.hide();
        this._group.show();

        this.workspacesView = new WorkspacesView.WorkspacesView();
        global.overlay_group.add_actor(this.workspacesView.actor);
        Main.panelManager.disablePanels();

        let animate = Main.wm.settingsState['desktop-effects-workspace'];
        if (animate) {
            this._group.opacity = 0;
            Tweener.addTween(this._group, {
                opacity: 255,
                transition: 'easeOutQuad',
                time: ANIMATION_TIME,
                onComplete: this._showDone,
                onCompleteScope: this
            });
        }


        this._coverPane.raise_top();
        this._coverPane.show();
        this.emit('showing');

        if (!animate) {
            this._group.opacity = 255;
            this._showDone();
        }
    },

    // showTemporarily:
    //
    // Animates the overview visible without grabbing mouse and keyboard input;
    // if show() has already been called, this has no immediate effect, but
    // will result in the overview not being hidden until hideTemporarily() is
    // called.
    showTemporarily: function() {
        if (this._shownTemporarily)
            return;

        this._syncInputMode();
        this._animateVisible();
        this._shownTemporarily = true;
    },

    // hide:
    //
    // Reverses the effect of show()
    hide: function() {
        if (!this._shown)
            return;

        this._shown = false;
        if (!this._shownTemporarily)
            this._animateNotVisible();

        this._syncInputMode();

        if (this._buttonPressId > 0)
            this._group.disconnect(this._buttonPressId);
        this._buttonPressId = 0;
    },

    // hideTemporarily:
    //
    // Reverses the effect of showTemporarily()
    hideTemporarily: function() {
        if (!this._shownTemporarily)
            return;

        if (!this._shown)
            this._animateNotVisible();

        this._shownTemporarily = false;
        this._syncInputMode();
    },

    toggle: function() {
        if (this._shown)
            this.hide();
        else
            this.show();
    },

    //// Private methods ////

    _syncInputMode: function() {
        // We delay input mode changes during animation so that when removing the
        // overview we don't have a problem with the release of a press/release
        // going to an application.
        if (this.animationInProgress)
            return;

        if (this._shown) {
            if (!this._modal) {
                if (Main.pushModal(this._group))
                    this._modal = true;
                else
                    this.hide();
            }
        } else if (this._shownTemporarily) {
            if (this._modal) {
                Main.popModal(this._group);
                this._modal = false;
            }
            global.stage_input_mode = Cinnamon.StageInputMode.FULLSCREEN;
        } else {
            if (this._modal) {
                Main.popModal(this._group);
                this._modal = false;
            }
            else if (global.stage_input_mode == Cinnamon.StageInputMode.FULLSCREEN)
                global.stage_input_mode = Cinnamon.StageInputMode.NORMAL;
        }
    },

    _animateNotVisible: function() {
        if (!this.visible || this.animationInProgress)
            return;

        this.animationInProgress = true;
        this._hideInProgress = true;
        Main.panelManager.enablePanels();

        this.workspacesView.hide();

        let animate = Main.wm.settingsState['desktop-effects-workspace'];
        if (animate) {
            // Make other elements fade out.
            Tweener.addTween(this._group, {
                opacity: 0,
                transition: 'easeOutQuad',
                time: ANIMATION_TIME,
                onComplete: this._hideDone,
                onCompleteScope: this
            });
        }

        this._coverPane.raise_top();
        this._coverPane.show();
        this.emit('hiding');

        if (!animate)
            this._hideDone();
    },

    _showDone: function() {
        this.animationInProgress = false;
        this._coverPane.hide();

        this.emit('shown');
        // Handle any calls to hide* while we were showing
        if (!this._shown && !this._shownTemporarily)
            this._animateNotVisible();

        this._syncInputMode();
        global.sync_pointer();
    },

    _hideDone: function() {
        this._group.remove_actor(this._coverPane);
        this._coverPane.destroy();
        this._coverPane = null;

        this._group.remove_actor(this._background);
        this._background.destroy();
        this._background = null;

        // Re-enable unredirection
        Meta.enable_unredirect_for_screen(global.screen);

        global.window_group.show();

        this.workspacesView.destroy();
        this.workspacesView = null;

        this._group.hide();

        this.visible = false;
        this.animationInProgress = false;
        this._hideInProgress = false;


        this.emit('hidden');
        // Handle any calls to show* while we were hiding
        if (this._shown || this._shownTemporarily)
            this._animateVisible();

        this._syncInputMode();
        Main.layoutManager._chrome.updateRegions();
    }
};
Signals.addSignalMethods(Overview.prototype);
