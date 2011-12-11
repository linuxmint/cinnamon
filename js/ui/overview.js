// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;
const Signals = imports.signals;
const Lang = imports.lang;
const St = imports.gi.St;
const Shell = imports.gi.Shell;
const Gdk = imports.gi.Gdk;

const AppDisplay = imports.ui.appDisplay;
const ContactDisplay = imports.ui.contactDisplay;
const Dash = imports.ui.dash;
const DND = imports.ui.dnd;
const DocDisplay = imports.ui.docDisplay;
const Lightbox = imports.ui.lightbox;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Panel = imports.ui.panel;
const Params = imports.misc.params;
const PlaceDisplay = imports.ui.placeDisplay;
const Tweener = imports.ui.tweener;
const ViewSelector = imports.ui.viewSelector;
const WorkspacesView = imports.ui.workspacesView;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;

// Time for initial animation going into Overview mode
const ANIMATION_TIME = 0.25;

// We split the screen vertically between the dash and the view selector.
const DASH_SPLIT_FRACTION = 0.1;

const DND_WINDOW_SWITCH_TIMEOUT = 1250;

const SwipeScrollDirection = {
    NONE: 0,
    HORIZONTAL: 1,
    VERTICAL: 2
};

const SwipeScrollResult = {
    CANCEL: 0,
    SWIPE: 1,
    CLICK: 2
};

function ShellInfo() {
    this._init();
}

ShellInfo.prototype = {
    _init: function() {
        this._source = null;
        this._undoCallback = null;
    },

    _onUndoClicked: function() {
        if (this._undoCallback)
            this._undoCallback();
        this._undoCallback = null;

        if (this._source)
            this._source.destroy();
    },

    setMessage: function(text, undoCallback, undoLabel) {
        if (this._source == null) {
            this._source = new MessageTray.SystemNotificationSource();
            this._source.connect('destroy', Lang.bind(this,
                function() {
                    this._source = null;
                }));
            Main.messageTray.add(this._source);
        }

        let notification = null;
        if (this._source.notifications.length == 0) {
            notification = new MessageTray.Notification(this._source, text, null);
        } else {
            notification = this._source.notifications[0];
            notification.update(text, null, { clear: true });
        }

        notification.setTransient(true);

        this._undoCallback = undoCallback;
        if (undoCallback) {
            notification.addButton('system-undo',
                                   undoLabel ? undoLabel : _("Undo"));
            notification.connect('action-invoked',
                                 Lang.bind(this, this._onUndoClicked));
        }

        this._source.notify(notification);
    }
};

function Overview() {
    this._init.apply(this, arguments);
}

Overview.prototype = {
    _init : function(params) {
        params = Params.parse(params, { isDummy: false });

        this.isDummy = params.isDummy;

        // We only have an overview in user sessions, so
        // create a dummy overview in other cases
        if (this.isDummy) {
            this.animationInProgress = false;
            this.visible = false;
            this.workspaces = null;
            return;
        }

        // The main BackgroundActor is inside global.window_group which is
        // hidden when displaying the overview, so we create a new
        // one. Instances of this class share a single CoglTexture behind the
        // scenes which allows us to show the background with different
        // rendering options without duplicating the texture data.
        this._background = Meta.BackgroundActor.new_for_screen(global.screen);
        this._background.hide();
        global.overlay_group.add_actor(this._background);

        this._desktopFade = new St.Bin();
        global.overlay_group.add_actor(this._desktopFade);

        this._spacing = 0;

        this._group = new St.Group({ name: 'overview',
                                     reactive: true });
        this._group._delegate = this;
        this._group.connect('style-changed',
            Lang.bind(this, function() {
                let node = this._group.get_theme_node();
                let spacing = node.get_length('spacing');
                if (spacing != this._spacing) {
                    this._spacing = spacing;
                    this._relayout();
                }
            }));

        this._scrollDirection = SwipeScrollDirection.NONE;
        this._scrollAdjustment = null;
        this._capturedEventId = 0;
        this._buttonPressId = 0;

        this._workspacesDisplay = null;

        this.visible = false;           // animating to overview, in overview, animating out
        this._shown = false;            // show() and not hide()
        this._shownTemporarily = false; // showTemporarily() and not hideTemporarily()
        this._modal = false;            // have a modal grab
        this.animationInProgress = false;
        this._hideInProgress = false;

        // During transitions, we raise this to the top to avoid having the overview
        // area be reactive; it causes too many issues such as double clicks on
        // Dash elements, or mouseover handlers in the workspaces.
        this._coverPane = new Clutter.Rectangle({ opacity: 0,
                                                  reactive: true });
        this._group.add_actor(this._coverPane);
        this._coverPane.connect('event', Lang.bind(this, function (actor, event) { return true; }));


        this._group.hide();
        global.overlay_group.add_actor(this._group);

        this._coverPane.hide();

        // XDND
        this._dragMonitor = {
            dragMotion: Lang.bind(this, this._onDragMotion)
        };

        Main.xdndHandler.connect('drag-begin', Lang.bind(this, this._onDragBegin));
        Main.xdndHandler.connect('drag-end', Lang.bind(this, this._onDragEnd));

        this._windowSwitchTimeoutId = 0;
        this._windowSwitchTimestamp = 0;
        this._lastActiveWorkspaceIndex = -1;
        this._lastHoveredWindow = null;
        this._needsFakePointerEvent = false;

        this.workspaces = null;
    },

    // The members we construct that are implemented in JS might
    // want to access the overview as Main.overview to connect
    // signal handlers and so forth. So we create them after
    // construction in this init() method.
    init: function() {
        if (this.isDummy)
            return;

        this._shellInfo = new ShellInfo();

        this._viewSelector = new ViewSelector.ViewSelector();
        this._group.add_actor(this._viewSelector.actor);

        this._workspacesDisplay = new WorkspacesView.WorkspacesDisplay();
        this._viewSelector.addViewTab('windows', _("Windows"), this._workspacesDisplay.actor, 'text-x-generic');

        let appView = new AppDisplay.AllAppDisplay();
        this._viewSelector.addViewTab('applications', _("Applications"), appView.actor, 'system-run');

        // Default search providers
        this.addSearchProvider(new AppDisplay.AppSearchProvider());
        this.addSearchProvider(new AppDisplay.SettingsSearchProvider());
        this.addSearchProvider(new PlaceDisplay.PlaceSearchProvider());
        this.addSearchProvider(new DocDisplay.DocSearchProvider());
        this.addSearchProvider(new ContactDisplay.ContactSearchProvider());

        // TODO - recalculate everything when desktop size changes
        this._dash = new Dash.Dash();
        this._group.add_actor(this._dash.actor);
        this._dash.actor.add_constraint(this._viewSelector.constrainY);
        this._dash.actor.add_constraint(this._viewSelector.constrainHeight);
        this.dashIconSize = this._dash.iconSize;
        this._dash.connect('icon-size-changed',
                           Lang.bind(this, function() {
                               this.dashIconSize = this._dash.iconSize;
                           }));

        // Translators: this is the name of the dock/favorites area on
        // the left of the overview
        Main.ctrlAltTabManager.addGroup(this._dash.actor, _("Dash"), 'user-bookmarks');

        Main.layoutManager.connect('monitors-changed', Lang.bind(this, this._relayout));
        this._relayout();
    },

    addSearchProvider: function(provider) {
        this._viewSelector.addSearchProvider(provider);
    },

    removeSearchProvider: function(provider) {
        this._viewSelector.removeSearchProvider(provider);
    },

    setMessage: function(text, undoCallback, undoLabel) {
        if (this.isDummy)
            return;

        this._shellInfo.setMessage(text, undoCallback, undoLabel);
    },

    _onDragBegin: function() {
        DND.addDragMonitor(this._dragMonitor);
        // Remember the workspace we started from
        this._lastActiveWorkspaceIndex = global.screen.get_active_workspace_index();
    },

    _onDragEnd: function(time) {
        // In case the drag was canceled while in the overview
        // we have to go back to where we started and hide
        // the overview
        if (this._shownTemporarily)  {
            global.screen.get_workspace_by_index(this._lastActiveWorkspaceIndex).activate(time);
            this.hideTemporarily();
        }
        this._resetWindowSwitchTimeout();
        this._lastHoveredWindow = null;
        DND.removeDragMonitor(this._dragMonitor);
        this.endItemDrag();
    },

    _resetWindowSwitchTimeout: function() {
        if (this._windowSwitchTimeoutId != 0) {
            Mainloop.source_remove(this._windowSwitchTimeoutId);
            this._windowSwitchTimeoutId = 0;
            this._needsFakePointerEvent = false;
        }
    },

    _fakePointerEvent: function() {
        let display = Gdk.Display.get_default();
        let deviceManager = display.get_device_manager();
        let pointer = deviceManager.get_client_pointer();
        let [screen, pointerX, pointerY] = pointer.get_position();

        pointer.warp(screen, pointerX, pointerY);
    },

    _onDragMotion: function(dragEvent) {
        let targetIsWindow = dragEvent.targetActor &&
                             dragEvent.targetActor._delegate &&
                             dragEvent.targetActor._delegate.metaWindow &&
                             !(dragEvent.targetActor._delegate instanceof WorkspaceThumbnail.WindowClone);

        this._windowSwitchTimestamp = global.get_current_time();

        if (targetIsWindow &&
            dragEvent.targetActor._delegate.metaWindow == this._lastHoveredWindow)
            return DND.DragMotionResult.CONTINUE;

        this._lastHoveredWindow = null;

        this._resetWindowSwitchTimeout();

        if (targetIsWindow) {
            this._lastHoveredWindow = dragEvent.targetActor._delegate.metaWindow;
            this._windowSwitchTimeoutId = Mainloop.timeout_add(DND_WINDOW_SWITCH_TIMEOUT,
                                            Lang.bind(this, function() {
                                                this._needsFakePointerEvent = true;
                                                Main.activateWindow(dragEvent.targetActor._delegate.metaWindow,
                                                                    this._windowSwitchTimestamp);
                                                this.hideTemporarily();
                                                this._lastHoveredWindow = null;
                                            }));
        }

        return DND.DragMotionResult.CONTINUE;
    },

    setScrollAdjustment: function(adjustment, direction) {
        if (this.isDummy)
            return;

        this._scrollAdjustment = adjustment;
        if (this._scrollAdjustment == null)
            this._scrollDirection = SwipeScrollDirection.NONE;
        else
            this._scrollDirection = direction;
    },

    _onButtonPress: function(actor, event) {
        if (this._scrollDirection == SwipeScrollDirection.NONE
            || event.get_button() != 1)
            return;

        let [stageX, stageY] = event.get_coords();
        this._dragStartX = this._dragX = stageX;
        this._dragStartY = this._dragY = stageY;
        this._dragStartValue = this._scrollAdjustment.value;
        this._lastMotionTime = -1; // used to track "stopping" while swipe-scrolling
        this._capturedEventId = global.stage.connect('captured-event',
            Lang.bind(this, this._onCapturedEvent));
        this.emit('swipe-scroll-begin');
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
                let noStop = Math.abs(distance / difference) > 0.5;

                // We detect if the user is stopped by comparing the
                // timestamp of the button release with the timestamp of
                // the last motion. Experimentally, a difference of 0 or 1
                // millisecond indicates that the mouse is in motion, a
                // larger difference indicates that the mouse is stopped.
                if ((this._lastMotionTime > 0 &&
                     this._lastMotionTime > event.get_time() - 2) ||
                    noStop) {
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

    _getDesktopClone: function() {
        let windows = global.get_window_actors().filter(function(w) {
            return w.meta_window.get_window_type() == Meta.WindowType.DESKTOP;
        });
        if (windows.length == 0)
            return null;

        let clone = new Clutter.Clone({ source: windows[0].get_texture() });
        clone.source.connect('destroy', Lang.bind(this, function() {
            clone.destroy();
        }));
        return clone;
    },

    _relayout: function () {
        // To avoid updating the position and size of the workspaces
        // we just hide the overview. The positions will be updated
        // when it is next shown.
        this.hide();

        let primary = Main.layoutManager.primaryMonitor;
        let rtl = (St.Widget.get_default_direction () == St.TextDirection.RTL);

        let contentY = Main.panel.actor.height;
        let contentHeight = primary.height - contentY - Main.messageTray.actor.height;

        this._group.set_position(primary.x, primary.y);
        this._group.set_size(primary.width, primary.height);

        this._coverPane.set_position(0, contentY);
        this._coverPane.set_size(primary.width, contentHeight);

        let dashWidth = Math.round(DASH_SPLIT_FRACTION * primary.width);
        let viewWidth = primary.width - dashWidth - this._spacing;
        let viewHeight = contentHeight - 2 * this._spacing;
        let viewY = contentY + this._spacing;
        let viewX = rtl ? 0 : dashWidth + this._spacing;

        // Set the dash's x position - y is handled by a constraint
        let dashX;
        if (rtl) {
            this._dash.actor.set_anchor_point_from_gravity(Clutter.Gravity.NORTH_EAST);
            dashX = primary.width;
        } else {
            dashX = 0;
        }
        this._dash.actor.set_x(dashX);

        this._viewSelector.actor.set_position(viewX, viewY);
        this._viewSelector.actor.set_size(viewWidth, viewHeight);
    },

    //// Public methods ////

    beginItemDrag: function(source) {
        this.emit('item-drag-begin');
    },

    cancelledItemDrag: function(source) {
        this.emit('item-drag-cancelled');
    },

    endItemDrag: function(source) {
        this.emit('item-drag-end');
    },

    beginWindowDrag: function(source) {
        this.emit('window-drag-begin');
    },

    cancelledWindowDrag: function(source) {
        this.emit('window-drag-cancelled');
    },

    endWindowDrag: function(source) {
        this.emit('window-drag-end');
    },

    // show:
    //
    // Animates the overview visible and grabs mouse and keyboard input
    show : function() {
        if (this.isDummy)
            return;
        if (this._shown)
            return;
        // Do this manually instead of using _syncInputMode, to handle failure
        if (!Main.pushModal(this._group))
            return;
        this._modal = true;
        this._animateVisible();
        this._shown = true;

        this._buttonPressId = this._group.connect('button-press-event',
            Lang.bind(this, this._onButtonPress));
    },

    _animateVisible: function() {
        if (this.visible || this.animationInProgress)
            return;

        this.visible = true;
        this.animationInProgress = true;

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
        this._background.show();

        this._workspacesDisplay.show();

        this.workspaces = this._workspacesDisplay.workspacesView;
        global.overlay_group.add_actor(this.workspaces.actor);

        if (!this._desktopFade.child)
            this._desktopFade.child = this._getDesktopClone();

        if (!this.workspaces.getActiveWorkspace().hasMaximizedWindows()) {
            this._desktopFade.opacity = 255;
            this._desktopFade.show();
            Tweener.addTween(this._desktopFade,
                             { opacity: 0,
                               time: ANIMATION_TIME,
                               transition: 'easeOutQuad'
                             });
        }

        this._group.opacity = 0;
        Tweener.addTween(this._group,
                         { opacity: 255,
                           transition: 'easeOutQuad',
                           time: ANIMATION_TIME,
                           onComplete: this._showDone,
                           onCompleteScope: this
                         });

        Tweener.addTween(this._background,
                         { dim_factor: 0.4,
                           time: ANIMATION_TIME,
                           transition: 'easeOutQuad'
                         });

        this._coverPane.raise_top();
        this._coverPane.show();
        this.emit('showing');
    },

    // showTemporarily:
    //
    // Animates the overview visible without grabbing mouse and keyboard input;
    // if show() has already been called, this has no immediate effect, but
    // will result in the overview not being hidden until hideTemporarily() is
    // called.
    showTemporarily: function() {
        if (this.isDummy)
            return;

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
        if (this.isDummy)
            return;

        if (!this._shown)
            return;

        if (!this._shownTemporarily)
            this._animateNotVisible();

        this._shown = false;
        this._syncInputMode();

        if (this._buttonPressId > 0)
            this._group.disconnect(this._buttonPressId);
        this._buttonPressId = 0;
    },

    // hideTemporarily:
    //
    // Reverses the effect of showTemporarily()
    hideTemporarily: function() {
        if (this.isDummy)
            return;

        if (!this._shownTemporarily)
            return;

        if (!this._shown)
            this._animateNotVisible();

        this._shownTemporarily = false;
        this._syncInputMode();
    },

    toggle: function() {
        if (this.isDummy)
            return;

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
            global.stage_input_mode = Shell.StageInputMode.FULLSCREEN;
        } else {
            if (this._modal) {
                Main.popModal(this._group);
                this._modal = false;
            }
            else if (global.stage_input_mode == Shell.StageInputMode.FULLSCREEN)
                global.stage_input_mode = Shell.StageInputMode.NORMAL;
        }
    },

    _animateNotVisible: function() {
        if (!this.visible || this.animationInProgress)
            return;

        this.animationInProgress = true;
        this._hideInProgress = true;

        if (!this.workspaces.getActiveWorkspace().hasMaximizedWindows()) {
            this._desktopFade.opacity = 0;
            this._desktopFade.show();
            Tweener.addTween(this._desktopFade,
                             { opacity: 255,
                               time: ANIMATION_TIME,
                               transition: 'easeOutQuad' });
        }

        this.workspaces.hide();

        // Make other elements fade out.
        Tweener.addTween(this._group,
                         { opacity: 0,
                           transition: 'easeOutQuad',
                           time: ANIMATION_TIME,
                           onComplete: this._hideDone,
                           onCompleteScope: this
                         });

        Tweener.addTween(this._background,
                         { dim_factor: 1.0,
                           time: ANIMATION_TIME,
                           transition: 'easeOutQuad'
                         });

        this._coverPane.raise_top();
        this._coverPane.show();
        this.emit('hiding');
    },

    _showDone: function() {
        this.animationInProgress = false;
        this._desktopFade.hide();
        this._coverPane.hide();

        this.emit('shown');
        // Handle any calls to hide* while we were showing
        if (!this._shown && !this._shownTemporarily)
            this._animateNotVisible();

        this._syncInputMode();
        global.sync_pointer();
    },

    _hideDone: function() {
        // Re-enable unredirection
        Meta.enable_unredirect_for_screen(global.screen);

        global.window_group.show();

        this.workspaces.destroy();
        this.workspaces = null;

        this._workspacesDisplay.hide();

        this._desktopFade.hide();
        this._background.hide();
        this._group.hide();

        this.visible = false;
        this.animationInProgress = false;
        this._hideInProgress = false;

        this._coverPane.hide();

        this.emit('hidden');
        // Handle any calls to show* while we were hiding
        if (this._shown || this._shownTemporarily)
            this._animateVisible();

        this._syncInputMode();

        // Fake a pointer event if requested
        if (this._needsFakePointerEvent) {
            this._fakePointerEvent();
            this._needsFakePointerEvent = false;
        }
    }
};
Signals.addSignalMethods(Overview.prototype);
