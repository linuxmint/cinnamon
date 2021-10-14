// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Pango = imports.gi.Pango;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Signals = imports.signals;

const DND = imports.ui.dnd;
const Main = imports.ui.main;
const Overview = imports.ui.overview;
const PopupMenu = imports.ui.popupMenu;
const Tweener = imports.ui.tweener;
const PointerTracker = imports.misc.pointerTracker;
const GridNavigator = imports.misc.gridNavigator;
const WindowUtils = imports.misc.windowUtils;

const WINDOW_DND_SIZE = 256;

const CLOSE_BUTTON_FADE_TIME = 0.1;

const DEMANDS_ATTENTION_CLASS_NAME = "window-list-item-demands-attention";

const DEFAULT_SLOT_FRACTION = 0.99;
const WINDOWOVERLAY_ICON_SIZE = 16;

var menuShowing = null;
var menuClone = null;
function closeContextMenu(requestor) {
    let requestorShowingMenu = menuClone && menuClone === requestor;
    if (menuShowing) {
        menuShowing.close();
    }
    return requestorShowingMenu;
}

function WindowClone() {
    this._init.apply(this, arguments);
}

WindowClone.prototype = {
    _init : function(realWindow, myContainer) {
        this.myContainer = myContainer;
        this.realWindow = realWindow;
        this.metaWindow = realWindow.meta_window;
        this.metaWindow._delegate = this;
        this.overlay = null;
        this.closedFromOverview = false;
        this._is_new_window = false; // Window opened while in the overview

        // Original position of the full-sized window
        this.origX = 0;
        this.origY = 0;

        // The MetaShapedTexture that we clone has a size that includes
        // the invisible border; this is inconvenient; rather than trying
        // to compensate all over the place we insert a ClutterGroup into
        // the hierarchy that is sized to only the visible portion.
        this.actor = new Clutter.Actor({ reactive: true });
        this.refreshClone(true);

        this.actor._delegate = this;

        this._stackAbove = null;

        let sizeChangedId = this.realWindow.connect('size-changed',
                this._onRealWindowSizeChanged.bind(this));
        let workspaceChangedId = this.metaWindow.connect('workspace-changed',
                (w, oldws) => this.emit('workspace-changed', oldws));
        let realWindowDestroyId = 0;
        this._disconnectWindowSignals = function() {
            this._disconnectWindowSignals = function() {};
            this.metaWindow.disconnect(workspaceChangedId);
            this.realWindow.disconnect(sizeChangedId);
            this.realWindow.disconnect(realWindowDestroyId);
        };
        realWindowDestroyId = this.realWindow.connect('destroy',
            this._disconnectWindowSignals.bind(this));

        this.actor.connect('button-release-event', this._onButtonRelease.bind(this));
        this.actor.connect('button-press-event', this._onButtonPress.bind(this));

        this.actor.connect('destroy', this._onDestroy.bind(this));

        this._selected = false;
    },

    refreshClone: function(withTransients) {
        this.actor.destroy_all_children();

        let {x, y, width, height} = this.metaWindow.get_outer_rect();
        let clones = WindowUtils.createWindowClone(this.metaWindow, 0, 0, withTransients);
        let leftGap, topGap;
        for (let clone of clones) {
            leftGap = x - clone.x;
            topGap = y - clone.y;
            if (clone !== clones[0]) {
                clone.actor.set_clip(leftGap, topGap, width, height);
            }
            clone.actor.set_position(-leftGap, -topGap);
            this.actor.add_actor(clone.actor);
        }
        this.actor.set_size(width, height);
        this.actor.set_position(x, y);
        this.origX = x;
        this.origY = y;

        this.realWindow.queue_redraw();
    },

    closeWindow: function() {
        let workspace = this.metaWindow.get_workspace();

        if (this._disconnectWindowAdded) {this._disconnectWindowAdded();}
        let windowAddedId = workspace.connect('window-added', (ws, win) => {
            if (this._disconnectWindowAdded) {this._disconnectWindowAdded();}
            if (win.get_transient_for() === this.metaWindow) {
                // use an idle handler to avoid mapping problems -
                // see comment in Workspace._windowAdded
                Mainloop.idle_add(() => {
                    this.emit('activated');
                    return false;
                });
            }
        });

        this._disconnectWindowAdded = () => {
            workspace.disconnect(windowAddedId);
            this._disconnectWindowAdded = 0;
        };

        this.closedFromOverview = true;

        this.metaWindow.delete(global.get_current_time());
    },

    setStackAbove: function (actor) {
        this._stackAbove = actor;
        if (this._stackAbove == null)
            this.actor.lower_bottom();
        else
            this.actor.raise(this._stackAbove);
    },

    destroy: function () {
        if (this.actor.is_finalized()) return;

        this.actor.destroy();
    },

    _onRealWindowSizeChanged: function() {
        this.refreshClone(true);
        this.emit('size-changed');
    },

    _onDestroy: function() {
        this._disconnectWindowSignals();
        if (this._disconnectWindowAdded)
            this._disconnectWindowAdded();

        this.metaWindow._delegate = null;
        this.actor._delegate = null;

        this.disconnectAll();
    },

    _onButtonPress: function(actor, event) {
        // a button-press on a clone already showing a menu should
        // not open a new-menu, only close the current menu.
        this.menuCancelled = closeContextMenu(this);
    },

    _onButtonRelease: function(actor, event) {
        switch (event.get_button()) {
            case 1:
                this._selected = true;
                this.emit('activated', global.get_current_time());
                return true;
            case 2:
                this.closedFromOverview = true;
                this.closeWindow();
                return true;
            case 3:
                if (!this.menuCancelled) {
                    this.emit('context-menu-requested');
                }
                this.menuCancelled = false;
                return true;
        }
        return false;
    }
};
Signals.addSignalMethods(WindowClone.prototype);


/**
 * @windowClone: Corresponding window clone
 * @parentActor: The actor which will be the parent of all overlay items
 *               such as app icon and window caption
 */
function WindowOverlay(windowClone, parentActor) {
    this._init(windowClone, parentActor);
}

WindowOverlay.prototype = {
    _init : function(windowClone, parentActor) {
        let metaWindow = windowClone.metaWindow;

        this._windowClone = windowClone;
        this._parentActor = parentActor;
        this._hidden = false;
        this._isSelected = null;

        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(metaWindow);
        let icon = null;
        if (app) {
            icon = app.create_icon_texture_for_window(WINDOWOVERLAY_ICON_SIZE, metaWindow);
        }
        if (!icon) {
            icon = new St.Icon({ icon_name: 'application-default-icon',
                                 icon_type: St.IconType.FULLCOLOR,
                                 icon_size: WINDOWOVERLAY_ICON_SIZE });
        }

        // Window border
        this.border = new St.Widget({ style_class: 'window-border', important: true });
        this.borderWidth = 0;

        // Caption (icon + title)
        let caption = new St.BoxLayout({ style_class: 'window-caption' });
        caption._spacing = 0;
        let title = new St.Label({ text: metaWindow.title, y_align: Clutter.ActorAlign.CENTER });
        title.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this._updateCaptionId = metaWindow.connect('notify::title', w => {
            title.set_text(w.title);
            this._windowClone.myContainer._showWindowOverlay(this._windowClone, false);
        });
        caption.add_actor(icon);
        caption.add_actor(title);

        // Close button
        let button = new St.Button({ style_class: 'window-close' });
        button.connect('clicked', () => this._windowClone.closeWindow());
        button._overlap = 0;

        parentActor.add_actor(this.border);
        parentActor.add_actor(caption);
        parentActor.add_actor(button);

        button.hide();
        this.border.hide();

        this.caption = caption;
        this.closeButton = button;

        let styleChangedCallback = this._onStyleChanged.bind(this);
        this.border.connect('style-changed', styleChangedCallback);
        caption.connect('style-changed', styleChangedCallback);
        button.connect('style-changed', styleChangedCallback);

        this._pointerTracker = new PointerTracker.PointerTracker();
        windowClone.actor.connect('motion-event', this._onPointerMotion.bind(this));
        windowClone.actor.connect('leave-event', this._onPointerLeave.bind(this));

        this._idleToggleCloseId = 0;
        windowClone.actor.connect('destroy', this._onDestroy.bind(this));

        let demandsAttentionCallback = this._onWindowDemandsAttention.bind(this);
        let attentionId = global.display.connect('window-demands-attention', demandsAttentionCallback);
        let urgentId = global.display.connect('window-marked-urgent', demandsAttentionCallback);
        this.disconnectAttentionSignals = function() {
            global.display.disconnect(attentionId);
            global.display.disconnect(urgentId);
        };

        // force a style change if we are already on a stage - otherwise
        // the signal will be emitted normally when we are added
        if (parentActor.get_stage())
            this._onStyleChanged();
    },

    _onWindowDemandsAttention: function(display, metaWindow) {
        if (metaWindow === this._windowClone.metaWindow)
            this.caption.add_style_class_name(DEMANDS_ATTENTION_CLASS_NAME);
    },

    setSelected: function(selected, timeout) {
        if (this._isSelected === selected)
            return;
        this._isSelected = selected;

        if (selected) {
            this._showCloseButton();
        } else {
            if (timeout > 0) {
                // Monkey patch to avoid animation if we enter again from
                // the button. Once it is hidden we set this to false again.
                this._isSelected = true;
                this._idleHideCloseButton(timeout);
            } else {
                this._hideCloseButton();
            }
        }
    },

    hide: function() {
        this._hidden = true;
        this._isSelected = false;
        this.caption.hide();
        this.border.hide();
        this.closeButton.hide();
    },

    show: function() {
        this._hidden = false;
        this.caption.show();
    },

    fadeIn: function() {
        if (!this._hidden) return;
        this.show();
        this._parentActor.raise_top();
        this.caption.opacity = 0;
        Tweener.addTween(this.caption,
                       { opacity: 255,
                         time: CLOSE_BUTTON_FADE_TIME,
                         transition: 'easeOutQuad' });
    },

    _idleHideCloseButton: function(timeout) {
        if (this._idleToggleCloseId === 0)
            this._idleToggleCloseId = Mainloop.timeout_add(timeout, this._idleToggleCloseButton.bind(this));
    },

    _idleToggleCloseButton: function() {
        this._idleToggleCloseId = 0;
        if (!this._windowClone.actor.has_pointer && !this.closeButton.has_pointer) {
            this._isSelected = false;
            this._hideCloseButton();
        }
        return false;
    },

    _hideCloseButton: function() {
        if (this._idleToggleCloseId > 0) {
            Mainloop.source_remove(this._idleToggleCloseId);
            this._idleToggleCloseId = 0;
        }
        for (let item of [this.closeButton, this.border]) {
            item.opacity = 255;
            Tweener.addTween(item,
                           { opacity: 0,
                             time: CLOSE_BUTTON_FADE_TIME,
                             transition: 'easeInQuad',
                             onComplete: item.hide });
        }
        this.caption.remove_style_pseudo_class('focus');
    },

    _showCloseButton: function() {
        this._parentActor.raise_top();
        for (let item of [this.closeButton, this.border]) {
            item.show();
            item.opacity = 0;
            Tweener.addTween(item,
                           { opacity: 255,
                             time: CLOSE_BUTTON_FADE_TIME,
                             transition: 'easeInQuad' });
        }
        this.caption.add_style_pseudo_class('focus');
    },

    chromeWidths: function () {
        /* Reserve space for the close button on both sides, because we don't
           know on which side it is. Also to horizontally center the window. */
        let close_buttn = Math.max(this.borderWidth, this.closeButton.width - this.closeButton._overlap)
        return [close_buttn, close_buttn];
    },

    chromeHeights: function () {
        return [Math.max(this.closeButton.height - this.closeButton._overlap, this.borderWidth),
               this.caption.height + this.caption._spacing];
    },

    /**
     * @cloneX: x position of windowClone
     * @cloneY: y position of windowClone
     * @cloneWidth: width of windowClone
     * @cloneHeight height of windowClone
     */
    // These parameters are not the values retrieved with
    // get_transformed_position() and get_transformed_size(),
    // as windowClone might be moving.
    // See Workspace._showWindowOverlay
    updatePositions: function(cloneX, cloneY, cloneWidth, cloneHeight, maxWidth) {
        let border = this.border;
        let caption = this.caption;
        let button = this.closeButton;

        let layout = Meta.prefs_get_button_layout();
        let side = layout.left_buttons.includes(Meta.ButtonFunction.CLOSE) ? St.Side.LEFT : St.Side.RIGHT;

        let buttonX;
        let buttonY = cloneY - (button.height - button._overlap);
        if (side === St.Side.LEFT) {
            buttonX = cloneX - (button.width - button._overlap);
            button.remove_style_class_name('right');
            button.add_style_class_name('left');
        } else {
            buttonX = cloneX + (cloneWidth - button._overlap);
            button.remove_style_class_name('left');
            button.add_style_class_name('right');
        }
        button.set_position(Math.round(buttonX), Math.round(buttonY));

        let borderX = cloneX - this.borderWidth;
        let borderY = cloneY - this.borderWidth;
        let borderWidth = cloneWidth + 2 * this.borderWidth;
        let borderHeight = cloneHeight + 2 * this.borderWidth;
        border.set_position(Math.round(borderX), Math.round(borderY));
        border.set_size(Math.round(borderWidth), Math.round(borderHeight));

        let [minW, captionWidth] = caption.get_preferred_width(-1);
        captionWidth = Math.min(maxWidth, captionWidth);
        let captionX = cloneX + (cloneWidth - captionWidth) / 2;
        let captionY = cloneY + cloneHeight + caption._spacing;
        caption.set_position(Math.round(captionX), Math.round(captionY));
        caption.width = captionWidth;
    },

    _onDestroy: function() {
        if (this._disconnectWindowAdded) {this._disconnectWindowAdded();}
        if (this._idleToggleCloseId > 0) {
            Mainloop.source_remove(this._idleToggleCloseId);
            this._idleToggleCloseId = 0;
        }
        this.disconnectAttentionSignals();
        this._windowClone.metaWindow.disconnect(this._updateCaptionId);

        this.border.destroy();
        this.caption.destroy();
        this.closeButton.destroy();
        this.border = this.caption = this.closeButton = null;
    },

    _onPointerMotion: function() {
        if (!this._pointerTracker.hasMoved()) {return;}
        // We might get motion events on the clone while the overlay is
        // hidden, e.g. during animations, we ignore these events,
        // as the close button will be shown as needed when the overlays
        // are shown again
        if (this._hidden) return;
        this.emit('selected', global.get_current_time());
    },

    _onPointerLeave: function() {
        if (!this._pointerTracker.hasMoved()) {return;}

        this.setSelected(false, 750);
    },

    _onStyleChanged: function() {
        let titleNode = this.caption.get_theme_node();
        this.caption._spacing = titleNode.get_length('-cinnamon-caption-spacing');

        let closeNode = this.closeButton.get_theme_node();
        this.closeButton._overlap = closeNode.get_length('-cinnamon-close-overlap');

        let borderNode = this.border.get_theme_node();
        this.borderWidth = borderNode.get_border_width(St.Side.TOP);

        this._parentActor.queue_relayout();
    }
};
Signals.addSignalMethods(WindowOverlay.prototype);

const WindowPositionFlags = {
    INITIAL: 1 << 0,
    ANIMATE: 1 << 1
};

function WorkspaceMonitor() {
    this._init.apply(this, arguments);
}

WorkspaceMonitor.prototype = {
    _init : function(metaWorkspace, monitorIndex, workspace) {
        this._myWorkspace = workspace;

        this.metaWorkspace = metaWorkspace;
        this._x = 0;
        this._y = 0;
        this._width = 0;
        this._height = 0;
        this._margin = 0;
        this._slotWidth = 0;

        this.monitorIndex = monitorIndex;
        this._monitor = Main.layoutManager.monitors[this.monitorIndex];
        this._windowOverlaysGroup = new Clutter.Group();
        // Without this the drop area will be overlapped.
        this._windowOverlaysGroup.set_size(0, 0);

        this.actor = new Clutter.Group();
        this.actor.set_size(0, 0);

        this._dropRect = new Clutter.Rectangle({ opacity: 0 });
        this._dropRect._delegate = this;

        this.actor.add_actor(this._dropRect);
        this.actor.add_actor(this._windowOverlaysGroup);

        this.actor.connect('destroy', this._onDestroy.bind(this));
        Main.overview.connect('overview-background-button-press', closeContextMenu);

        this.stickyCallbackId = workspace.myView.connect('sticky-detected', (box, metaWindow) => {
            this._doAddWindow(metaWindow);
        });
        let windows = global.get_window_actors().filter(this._isMyWindow, this);

        // Create clones for windows that should be
        // visible in the Overview
        this._windows = [];
        for (let i = 0; i < windows.length; i++) {
            if (this._isOverviewWindow(windows[i])) {
                this._addWindowClone(windows[i]);
            }
        }

        this._emptyPlaceHolder = new St.Bin({
            style_class: 'overview-empty-placeholder',
            child: new St.Label({ text: _("No open windows") }),
            important: true
        });
        this.actor.insert_child_below(this._emptyPlaceHolder, null);

        // Track window changes
        if (this.metaWorkspace) {
            this._windowAddedId = this.metaWorkspace.connect('window-added',
                                                  this._windowAdded.bind(this));
            this._windowRemovedId = this.metaWorkspace.connect('window-removed',
                                                  this._windowRemoved.bind(this));
        }
        this._windowEnteredMonitorId = global.screen.connect('window-entered-monitor',
                                              this._windowEnteredMonitor.bind(this));
        this._windowLeftMonitorId = global.screen.connect('window-left-monitor',
                                              this._windowLeftMonitor.bind(this));

        this._animating = false; // Indicate if windows are being repositioned
        this.leavingOverview = false;

        this._kbWindowIndex = 0; // index of the current keyboard-selected window
    },

    selectAnotherWindow: function(symbol) {
        let numWindows = this._windows.length;
        if (numWindows === 0) {
            return false;
        }
        let currentIndex = this._kbWindowIndex;
        let numCols = Math.ceil(Math.sqrt(numWindows));
        let nextIndex = GridNavigator.nextIndex(numWindows, numCols, currentIndex, symbol);
        if (nextIndex < 0) {
            return false; // not handled
        }

        this.selectIndex(nextIndex);
        return true;
    },

    showActiveSelection: function() {
        this.selectIndex(this._kbWindowIndex);
    },

    selectIndex: function(index) {
        this._kbWindowIndex = index;
        let activeClone = null;
        if (index > -1 && index < this._windows.length) {
            activeClone = this._windows[this._kbWindowIndex];
        }
        this._myWorkspace.selectActiveClone(activeClone, this);
    },

    selectClone: function(clone) {
        this.selectIndex(this._windows.indexOf(clone));
    },

    _onCloneContextMenuRequested: function(clone) {
        menuShowing = new WindowContextMenu(clone.actor, clone.metaWindow, () => {
            menuShowing = null; menuClone = null;
            this._myWorkspace.emit('focus-refresh-required');
        });
        menuClone = clone;
        menuShowing.toggle();
    },

    showMenuForSelectedWindow: function() {
        if (this._kbWindowIndex > -1 && this._kbWindowIndex < this._windows.length) {
            let window = this._windows[this._kbWindowIndex];
            this._onCloneContextMenuRequested(window);
        }
        return false;
    },

    activateSelectedWindow: function() {
        if (this._kbWindowIndex > -1 && this._kbWindowIndex < this._windows.length) {
            this._onCloneActivated(this._windows[this._kbWindowIndex], global.get_current_time());
            return true;
        }
        return false;
    },

    closeSelectedWindow: function() {
        if (this._kbWindowIndex > -1 && this._kbWindowIndex < this._windows.length) {
            this._windows[this._kbWindowIndex].closeWindow();
        }
    },

    moveSelectedWindowToNextMonitor: function() {
        if (this._kbWindowIndex > -1 && this._kbWindowIndex < this._windows.length) {
            let monitorCount = Main.layoutManager.monitors.length;
            if (monitorCount < 2) return;
            let nextIndex = (this._windows[this._kbWindowIndex].metaWindow.get_monitor() + monitorCount + 1) % monitorCount;
            this._windows[this._kbWindowIndex].metaWindow.move_to_monitor(nextIndex);
        }
    },

    setGeometry: function(x, y, width, height, margin) {
        this._x = x;
        this._y = y;
        this._width = width;
        this._height = height;
        this._margin = margin;
    },

    _lookupIndex: function (metaWindow) {
        for (let i = 0; i < this._windows.length; i++) {
            if (this._windows[i].metaWindow == metaWindow) {
                return i;
            }
        }
        return -1;
    },

    isEmpty: function() {
        return this._windows.length === 0;
    },

    /**
     * _getSlotGeometry:
     * @slot: A layout slot
     *
     * Returns: the screen-relative [x, y, width, height]
     * of a given window layout slot.
     */
    _getSlotGeometry: function(slot) {
        let [xCenter, yCenter, xFraction, yFraction] = slot;

        let width = (this._width - this._margin * 2) * xFraction;
        let height = (this._height - this._margin * 2) * yFraction;

        let x = this._x + this._margin + xCenter * (this._width - this._margin * 2) - width / 2 ;
        let y = this._y + this._margin + yCenter * (this._height - this._margin * 2) - height / 2;

        return [x, y, width, height];
    },

    /**
     * _computeWindowLayout:
     * @metaWindow: A #MetaWindow
     * @slot: A layout slot
     *
     * Given a window and slot to fit it in, compute its
     * screen-relative [x, y, scale] where scale applies
     * to both X and Y directions.
     */
    _computeWindowLayout: function(metaWindow, slot) {
        let [x, y, width, height] = this._getSlotGeometry(slot);
        let rect = metaWindow.get_outer_rect();
        let topBorder = 0, bottomBorder = 0, leftBorder = 0, rightBorder = 0;

        if (this._windows.length) {
            [topBorder, bottomBorder] = this._windows[0].overlay.chromeHeights();
            [leftBorder, rightBorder]  = this._windows[0].overlay.chromeWidths();
        }
        let scale = Math.min((width - leftBorder - rightBorder) / rect.width,
                            (height - topBorder - bottomBorder) / rect.height,
                             1.0);
        // This is magic
        x = Math.floor(x + (width - scale * rect.width - rightBorder + leftBorder) / 2);
        y = Math.floor(y + (height - scale * rect.height - bottomBorder + topBorder) / 2);
        return [x, y, scale];
    },

    /**
     * positionWindows:
     * @flags:
     *  INITIAL - this is the initial positioning of the windows.
     *  ANIMATE - Indicates that we need animate changing position.
     */
    positionWindows : function(flags) {
        if (Main.expo.visible)
            return;

        closeContextMenu();

        let initialPositioning = flags & WindowPositionFlags.INITIAL;
        let animate = flags & WindowPositionFlags.ANIMATE;

        let clones = this._windows;
        // Start the animations
        let slots = this._computeAllWindowSlots(clones.length);

        let currentWorkspace = global.screen.get_active_workspace();
        let isOnCurrentWorkspace = this.metaWorkspace == null || this.metaWorkspace == currentWorkspace;

        if (clones.length > 0 && animate && isOnCurrentWorkspace) {
            this._animating = true;
        }

        for (let i = clones.length - 1; i >= 0; --i) {
            let clone = clones[i];
            let metaWindow = clone.metaWindow;
            let overlay = clone.overlay;

            let [x, y, scale] = this._computeWindowLayout(metaWindow, slots[i]);

            if (overlay)
                overlay.hide();
            if (animate && isOnCurrentWorkspace) {
                if (!metaWindow.showing_on_its_workspace() || clone._is_new_window) {
                    /* Hidden windows should fade in and grow
                     * therefore we need to resize them now so they
                     * can be scaled up later */
                    if (initialPositioning) {
                        clone.actor.opacity = 0;
                        clone.actor.scale_x = 0;
                        clone.actor.scale_y = 0;
                        clone.actor.x = this._width / 2;
                        clone.actor.y = this._height / 2;
                    } else if (clone._is_new_window) {
                        clone.actor.opacity = 0;
                        clone.actor.scale_x = 0;
                        clone.actor.scale_y = 0;
                        clone.actor.x = x + clone.actor.width * scale / 2;
                        clone.actor.y = y + clone.actor.height * scale / 2;
                    }


                     // Make the window slightly transparent to indicate it's hidden
                     Tweener.addTween(clone.actor,
                                      { opacity: 255,
                                        time: Overview.ANIMATION_TIME,
                                        transition: 'easeInQuad'
                                      });
                }

                Tweener.addTween(clone.actor,
                                 { x: x,
                                   y: y,
                                   scale_x: scale,
                                   scale_y: scale,
                                   time: Overview.ANIMATION_TIME,
                                   transition: 'easeOutQuad',
                                   onComplete: () => {
                                       this._animating = false
                                       this._showWindowOverlay(clone, true);
                                   }
                                 });
            } else {
                clone.actor.set_position(x, y);
                clone.actor.set_scale(scale, scale);
                this._showWindowOverlay(clone, isOnCurrentWorkspace);
            }

            clone._is_new_window = false;
        }
    },

    syncStacking: function(stackIndices) {
        // Only on the first invocation do we want to affect the
        // permanent sort order. After that, we don't want major
        // upheavals to the sort order.
        let clones = !this._stackedOnce ? this._windows : this._windows.slice();
        this._stackedOnce = true;

        clones.sort(function (a, b) {
            let minimizedA = a.metaWindow.minimized ? 1 : 0;
            let minimizedB = b.metaWindow.minimized ? 1 : 0;
            let minimizedDiff = minimizedA - minimizedB;
            return minimizedDiff || stackIndices[a.metaWindow.get_stable_sequence()] - stackIndices[b.metaWindow.get_stable_sequence()];
        });

        let below = this._dropRect;
        for (let i = clones.length - 1; i >= 0; i--) {
            let clone = clones[i];
            clone.setStackAbove(below);
            below = clone.actor;
        }
    },

    _showWindowOverlay: function(clone, fade) {
        // Prevent showing overlay now. Sometimes called during animations
        if (this._animating)
            return;

        if (this._slotWidth) {
            // This is a little messy and complicated because when we
            // start the fade-in we may not have done the final positioning
            // of the workspaces. (Tweener doesn't necessarily finish
            // all animations before calling onComplete callbacks.)
            // So we need to manually compute where the window will
            // be after the workspace animation finishes.
            let [cloneX, cloneY] = clone.actor.get_position();
            let [cloneWidth, cloneHeight] = clone.actor.get_size();
            cloneWidth = clone.actor.scale_x * cloneWidth;
            cloneHeight = clone.actor.scale_y * cloneHeight;

            clone.overlay.updatePositions(cloneX, cloneY, cloneWidth, cloneHeight, this._slotWidth);
            if (fade)
                clone.overlay.fadeIn();
            else
                clone.overlay.show();
            this._myWorkspace.emit('focus-refresh-required');
        }
    },

    _showAllOverlays: function() {
        let currentWorkspace = global.screen.get_active_workspace();
        let fade = this.metaWorkspace == null || this.metaWorkspace === currentWorkspace;
        for (let clone of this._windows) {
            this._showWindowOverlay(clone, fade);
        }
    },

    showWindowsOverlays: function() {
        if (this.leavingOverview || this._windowOverlaysGroup.is_finalized())
            return;

        this._windowOverlaysGroup.show();
        this._showAllOverlays();
    },

    hideWindowsOverlays: function() {
        this._windowOverlaysGroup.hide();
    },

    _updateEmptyPlaceholder: function() {
        let placeholder = this._emptyPlaceHolder;
        if (this._windows.length > 0) {
            placeholder.hide();
        } else {
            let x = this._monitor.x + Math.floor((this._monitor.width - placeholder.width)/2);
            let y = this._monitor.y + Math.floor((this._monitor.height - placeholder.height)/2);
            placeholder.set_position(x, y);
            placeholder.show();
        }
    },

    _doRemoveWindow : function(metaWin) {
        let win = metaWin.get_compositor_private();

        // find the position of the window in our list
        let index = this._lookupIndex (metaWin);

        if (index == -1)
            return;

        // Check if window still should be here
        if (win && this._isMyWindow(win))
            return;

        let clone = this._windows[index];

        this._windows.splice(index, 1);

        if (this._kbWindowIndex >= this._windows.length) {
            this._kbWindowIndex = this._windows.length - 1;
        }

        this.showActiveSelection();

        let closedFromOverview = clone.closedFromOverview;
        clone.destroy();

        if (this.isEmpty()) {
            if(closedFromOverview)
                Main.overview.hide();
            else
                this._updateEmptyPlaceholder();
        } else {
            let animate = Main.wm.settingsState['desktop-effects-workspace'];
            this.positionWindows(animate ? WindowPositionFlags.ANIMATE : 0);
        }

    },

    _doAddWindow : function(metaWin) {
        if (this.leavingOverview)
            return;

        let win = metaWin.get_compositor_private();
        if (!win) {
            // Newly-created windows are added to a workspace before
            // the compositor finds out about them...
            Mainloop.idle_add(() => {
                if (this.actor &&
                    metaWin.get_compositor_private() &&
                    metaWin.get_workspace() === this.metaWorkspace)
                    this._doAddWindow(metaWin);
                return false;
            });
            return;
        }

        // We might have the window in our list already if it was on all workspaces and
        // now was moved to this workspace
        if (this._lookupIndex (metaWin) != -1) {
            return;
        }

        if (!this._isMyWindow(win) || !this._isOverviewWindow(win)){
            return;
        }
        let clone = this._addWindowClone(win);

        this._updateEmptyPlaceholder();

        if (this.actor.get_stage()) {
            clone._is_new_window = true;
            let animate = Main.wm.settingsState['desktop-effects-workspace'];
            this.positionWindows(animate ? WindowPositionFlags.ANIMATE : 0);
        }
    },

    _windowAdded : function(metaWorkspace, metaWin) {
        this._doAddWindow(metaWin);
    },

    _windowRemoved : function(metaWorkspace, metaWin) {
        this._doRemoveWindow(metaWin);
    },

    _windowEnteredMonitor : function(metaScreen, monitorIndex, metaWin) {
        if (monitorIndex === this.monitorIndex) {
            this._doAddWindow(metaWin);
        }
    },

    _windowLeftMonitor : function(metaScreen, monitorIndex, metaWin) {
        if (monitorIndex === this.monitorIndex) {
            this._doRemoveWindow(metaWin);
        }
    },

    // check for maximized windows on the workspace
    hasMaximizedWindows: function() {
        for (let i = 0; i < this._windows.length; i++) {
            let metaWindow = this._windows[i].metaWindow;
            if (metaWindow.showing_on_its_workspace() &&
                metaWindow.maximized_horizontally &&
                metaWindow.maximized_vertically)
                return true;
        }
        return false;
    },

    // Animate the full-screen to Overview transition.
    zoomToOverview : function() {
        let animate = Main.wm.settingsState['desktop-effects-workspace'];
        // Position and scale the windows.
        if (Main.overview.animationInProgress && animate)
            this.positionWindows(WindowPositionFlags.ANIMATE | WindowPositionFlags.INITIAL);
        else
            this.positionWindows(WindowPositionFlags.INITIAL);

        this._updateEmptyPlaceholder();
    },

    // Animates the return from Overview mode
    zoomFromOverview : function() {
        let currentWorkspace = global.screen.get_active_workspace();

        this.leavingOverview = true;

        this.hideWindowsOverlays();

        this._overviewHiddenId = Main.overview.connect('hidden',
                this._doneLeavingOverview.bind(this));

        if (this.metaWorkspace != null && this.metaWorkspace != currentWorkspace)
            return;

        let animate = Main.wm.settingsState['desktop-effects-workspace'];
        if (!animate)
            return;

        // Position and scale the windows.
        for (let i = 0; i < this._windows.length; i++) {
            let clone = this._windows[i];

            if (clone.metaWindow.showing_on_its_workspace()) {
                Tweener.addTween(clone.actor,
                                 { x: clone.origX,
                                   y: clone.origY,
                                   scale_x: 1.0,
                                   scale_y: 1.0,
                                   time: Overview.ANIMATION_TIME,
                                   opacity: 255,
                                   transition: 'easeOutQuad'
                                 });
            } else {
                // The window is hidden, make it shrink and fade it out
                Tweener.addTween(clone.actor,
                                 { scale_x: 0,
                                   scale_y: 0,
                                   x: this._width / 2,
                                   y: this._height / 2,
                                   opacity: 0,
                                   time: Overview.ANIMATION_TIME,
                                   transition: 'easeOutQuad'
                                 });
            }
        }

        if (this._emptyPlaceHolder.visible) {
            Tweener.addTween(this._emptyPlaceHolder, {
                opacity: 0,
                time: Overview.ANIMATION_TIME,
                transition: 'easeOutQuad'
            });
        }
    },

    destroy : function() {
        this.actor.destroy();
    },

    _onDestroy: function(actor) {
        closeContextMenu();
        if (this._overviewHiddenId) {
            Main.overview.disconnect(this._overviewHiddenId);
            this._overviewHiddenId = 0;
        }
        Tweener.removeTweens(actor);

        this._myWorkspace.myView.disconnect(this.stickyCallbackId);
        if (this.metaWorkspace) {
            this.metaWorkspace.disconnect(this._windowAddedId);
            this.metaWorkspace.disconnect(this._windowRemovedId);
        }
        global.screen.disconnect(this._windowEnteredMonitorId);
        global.screen.disconnect(this._windowLeftMonitorId);

        // Usually, the windows will be destroyed automatically with
        // their parent (this.actor), but we might have a zoomed window
        // which has been reparented to the stage - _windows[0] holds
        // the desktop window, which is never reparented
        for (let w = 0; w < this._windows.length; w++)
            this._windows[w].destroy();
        this._windows = [];
    },

    // Sets this.leavingOverview flag to false.
    _doneLeavingOverview : function() {
        this.leavingOverview = false;
    },

    // Tests if @win belongs to this workspace
    _isMyWindow : function (win) {
        return (this.metaWorkspace == null || Main.isWindowActorDisplayedOnWorkspace(win, this.metaWorkspace.index()) && (!win.get_meta_window() || win.get_meta_window().get_monitor() == this.monitorIndex));
    },

    // Tests if @win should be shown in the Overview
    _isOverviewWindow : function (win) {
        let tracker = Cinnamon.WindowTracker.get_default();
        return Main.isInteresting(win.get_meta_window());
    },

    // Create a clone of a (non-desktop) window and add it to the window list
    _addWindowClone : function(win) {
        let clone = new WindowClone(win, this);
        let overlay = new WindowOverlay(clone, this._windowOverlaysGroup);

        clone.connect('workspace-changed', () => {
            this._doRemoveWindow(clone.metaWindow);
            if (clone.metaWindow.is_on_all_workspaces()) {
                // Muffin appears not to broadcast when a window turns sticky
                this._myWorkspace.myView.emit('sticky-detected', clone.metaWindow);
            }
        });

        clone.connect('activated', this._onCloneActivated.bind(this));
        clone.connect('context-menu-requested', this._onCloneContextMenuRequested.bind(this));
        clone.connect('size-changed', () => { this.positionWindows(0) });

        this.actor.add_actor(clone.actor);

        overlay.connect('selected', this.selectClone.bind(this, clone));

        this._windows.push(clone);
        clone.overlay = overlay;

        return clone;
    },

    _computeAllWindowSlots: function(numberOfWindows) {
        if (numberOfWindows <= 0) return [];

        let gridWidth = Math.ceil(Math.sqrt(numberOfWindows));
        let gridHeight = Math.ceil(numberOfWindows / gridWidth);
        let xFraction = DEFAULT_SLOT_FRACTION / gridWidth;
        let yFraction = DEFAULT_SLOT_FRACTION / gridHeight;
        this._slotWidth = Math.floor(xFraction * (this._width - this._margin * 2));

        // Arrange the windows in a grid pattern.
        let slots = [];
        for (let i = 0; i < numberOfWindows; i++) {
            let xCenter = (0.5 + i % gridWidth) / gridWidth;
            let yCenter = (0.5 + Math.floor(i / gridWidth)) / gridHeight;
            slots[i] = [xCenter, yCenter, xFraction, yFraction];
        }

        /* Shift last row to the center by adding half the unused space to
           the x-coordinate (this usually does just 0, 1 or 2 iterations) */
        let slots_last_row = numberOfWindows % gridWidth;
        let remaining_space = 1 - slots_last_row / gridWidth;
        for (let i = slots.length - slots_last_row; i < slots.length; i++) {
            slots[i][0] += remaining_space / 2;
        }

        return slots;
    },

    _onCloneActivated : function (clone, time) {
        let wsIndex = undefined;
        if (this.metaWorkspace)
            wsIndex = this.metaWorkspace.index();
        Main.activateWindow(clone.metaWindow, time, wsIndex);
    }
};

Signals.addSignalMethods(WorkspaceMonitor.prototype);

function WindowContextMenu(actor, metaWindow, onClose) {
    this._init(actor, metaWindow, onClose);
}

WindowContextMenu.prototype = {
    __proto__: PopupMenu.PopupComboMenu.prototype,

    _init: function(actor, metaWindow, onClose) {
        PopupMenu.PopupComboMenu.prototype._init.call(this, actor);
        this.name = 'scale-window-context-menu';
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
        let orientation = St.Side.TOP;
        this.onClose = onClose;
        actor.connect('key-press-event', this._onSourceKeyPress.bind(this));
        this.connect('open-state-changed', this._onToggled.bind(this));

        this.metaWindow = metaWindow;

        this.itemCloseWindow = new PopupMenu.PopupMenuItem(_("Close"));
        this.itemCloseWindow.connect('activate', this._onCloseWindowActivate.bind(this));

        if (metaWindow.minimized)
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem(_("Restore"));
        else
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem(_("Minimize"));
        this.itemMinimizeWindow.connect('activate', this._onMinimizeWindowActivate.bind(this));

        this.itemMaximizeWindow = new PopupMenu.PopupMenuItem(_("Maximize"));
        this.itemMaximizeWindow.connect('activate', this._onMaximizeWindowActivate.bind(this));

        this.itemMoveToLeftWorkspace = new PopupMenu.PopupMenuItem(_("Move to left workspace"));
        this.itemMoveToLeftWorkspace.connect('activate', this._onMoveToLeftWorkspace.bind(this));

        this.itemMoveToRightWorkspace = new PopupMenu.PopupMenuItem(_("Move to right workspace"));
        this.itemMoveToRightWorkspace.connect('activate', this._onMoveToRightWorkspace.bind(this));

        this.itemOnAllWorkspaces = new PopupMenu.PopupMenuItem(_("Visible on all workspaces"));
        this.itemOnAllWorkspaces.connect('activate', this._toggleOnAllWorkspaces.bind(this));

        let itemMoveToNewWorkspace = new PopupMenu.PopupMenuItem(_("Move to a new workspace"));
        itemMoveToNewWorkspace.connect('activate', () => {
            Main.moveWindowToNewWorkspace(metaWindow, true);
        });

        let monitorItems = [];
        if (Main.layoutManager.monitors.length > 1) {
            Main.layoutManager.monitors.forEach((monitor, index) => {
                if (index !== metaWindow.get_monitor()) {
                    let itemChangeMonitor = new PopupMenu.PopupMenuItem(
                        _("Move to monitor %d").format(index + 1));
                    itemChangeMonitor.connect('activate', () => {
                        metaWindow.move_to_monitor(index);
                    });
                    monitorItems.push(itemChangeMonitor);
                }
            });
            monitorItems.push(new PopupMenu.PopupSeparatorMenuItem());
        }

        let items = [
            ...monitorItems,
            itemMoveToNewWorkspace,
            this.itemOnAllWorkspaces,
            this.itemMoveToLeftWorkspace,
            this.itemMoveToRightWorkspace,
            new PopupMenu.PopupSeparatorMenuItem(),
            this.itemMinimizeWindow,
            this.itemMaximizeWindow,
            this.itemCloseWindow
        ];
        (orientation == St.Side.BOTTOM ? items : items.reverse()).forEach(item => {
            this.addMenuItem(item);
        });
        this.setActiveItem(0);
     },

     _onToggled: function(actor, opening){
         if (!opening) {
            this.onClose();
            this.destroy();
            return;
         }

        if (this.metaWindow.is_on_all_workspaces()) {
            this.itemOnAllWorkspaces.label.set_text(_("Only on this workspace"));
        } else {
            this.itemOnAllWorkspaces.label.set_text(_("Visible on all workspaces"));
        }
        if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT) != this.metaWindow.get_workspace())
            this.itemMoveToLeftWorkspace.actor.show();
        else
            this.itemMoveToLeftWorkspace.actor.hide();

        if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT) != this.metaWindow.get_workspace())
            this.itemMoveToRightWorkspace.actor.show();
        else
            this.itemMoveToRightWorkspace.actor.hide();

        if (this.metaWindow.get_maximized()) {
            this.itemMaximizeWindow.label.set_text(_("Unmaximize"));
        }else{
            this.itemMaximizeWindow.label.set_text(_("Maximize"));
        }
    },

    _onCloseWindowActivate: function(actor, event){
        this.metaWindow.delete(global.get_current_time());
    },

    _onMinimizeWindowActivate: function(actor, event){
        if (this.metaWindow.minimized) {
            this.metaWindow.unminimize(global.get_current_time());
        }
        else {
            this.metaWindow.minimize(global.get_current_time());
        }
    },

    _onMaximizeWindowActivate: function(actor, event){
        if (this.metaWindow.get_maximized()){
            this.metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }else{
            this.metaWindow.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }
    },

    _onMoveToLeftWorkspace: function(actor, event){
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT);
        if (workspace) {
            this.metaWindow.change_workspace(workspace);
        }
    },

    _onMoveToRightWorkspace: function(actor, event){
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT);
        if (workspace) {
            this.metaWindow.change_workspace(workspace);
        }
    },

    _toggleOnAllWorkspaces: function(actor, event) {
        if (this.metaWindow.is_on_all_workspaces())
            this.metaWindow.unstick();
        else
            this.metaWindow.stick();
    },

    _onSourceKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_space ||
            symbol === Clutter.KEY_Return ||
            symbol === Clutter.KEY_KP_Enter) {
            this.menu.toggle();
            return true;
        } else if (symbol === Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol === Clutter.KEY_Down) {
            if (!this.menu.isOpen)
                this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;
    }

};

function Workspace() {
    this._init.apply(this, arguments);
}

Workspace.prototype = {
    _init : function(metaWorkspace, view) {
        this.metaWorkspace = metaWorkspace;
        this.myView = view;
        this.actor = new Clutter.Group();
        this.actor.set_size(0, 0);
        this._monitors = [];
        this._activeClone = null;
        this.currentMonitorIndex = Main.layoutManager.primaryIndex;
        Main.layoutManager.monitors.forEach((monitor, ix) => {
            let m = new WorkspaceMonitor(metaWorkspace, ix, this);
            m.setGeometry(monitor.x, monitor.y, monitor.width, monitor.height, monitor.width * .01);
            this._monitors.push(m);
            this.actor.add_actor(m.actor);
        });
        this.connect('focus-refresh-required', () => {
            this.selectNextNonEmptyMonitor(this.currentMonitorIndex - 1, 1);
        });
    },

    findNextNonEmptyMonitor: function(start, increment) {
        let pos = start;
        for (let i = 0; i < this._monitors.length; ++i) {
            pos = (this._monitors.length + pos + increment) % this._monitors.length;
            if (!this._monitors[pos].isEmpty()) {
                return pos;
            }
        }
        return this.currentMonitorIndex || 0;
    },

    selectNextNonEmptyMonitor: function(start, increment) {
        this.selectMonitor(this.findNextNonEmptyMonitor(start || 0, increment));
    },

    selectMonitor: function(index) {
        this.currentMonitorIndex = index;
        this._monitors[this.currentMonitorIndex].showActiveSelection();
    },

    selectActiveClone: function(clone, wsMonitor) {
        let current = this._activeClone;
        if (clone) {
            this.currentMonitorIndex = wsMonitor.monitorIndex;
        }
        this._activeClone = clone;

        if (current !== this._activeClone) {
            if (current) {
                current.overlay.setSelected(false);
            }
            wsMonitor.emit('selection-changed');
        }

        // We might have left the focused clone, hiding the overlay,
        // and entered it again to show it.
        if (this._activeClone) {
            this._activeClone.overlay.setSelected(true);
        }
    },

    _onKeyPress: function(actor, event) {
        let modifiers = Cinnamon.get_event_state(event);
        let symbol = event.get_key_symbol();
        let keycode = event.get_key_code();
        let ctrlAltMask = Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD1_MASK;
        // This relies on the fact that Clutter.ModifierType is the same as Gdk.ModifierType
        let action = global.display.get_keybinding_action(keycode, modifiers);

        if ((symbol === Clutter.KEY_ISO_Left_Tab || symbol === Clutter.KEY_Tab)  && !(modifiers & ctrlAltMask)) {
            let increment = symbol === Clutter.KEY_ISO_Left_Tab ? -1 : 1;
            this.selectNextNonEmptyMonitor(this.currentMonitorIndex, increment);
            return true;
        }

        let activeMonitor = this._monitors[this.currentMonitorIndex];

        if ((symbol === Clutter.KEY_m  || symbol === Clutter.KEY_M || symbol === Clutter.KEY_space) &&
            (modifiers & Clutter.ModifierType.MOD1_MASK) && !(modifiers & Clutter.ModifierType.CONTROL_MASK))
        {
            activeMonitor.showMenuForSelectedWindow();
            return true;
        }

        if (action === Meta.KeyBindingAction.CLOSE ||
            symbol === Clutter.KEY_w && modifiers & Clutter.ModifierType.CONTROL_MASK) {
            activeMonitor.closeSelectedWindow();
            return true;
        }

        if ((symbol === Clutter.KEY_m || symbol === Clutter.KEY_M) && modifiers & Clutter.ModifierType.CONTROL_MASK) {
            activeMonitor.moveSelectedWindowToNextMonitor();
            return true;
        }

        if (symbol === Clutter.KEY_Return ||
            symbol === Clutter.KEY_KP_Enter ||
            symbol === Clutter.KEY_space) {
            if (activeMonitor.activateSelectedWindow()) {
                return true;
            }
            Main.overview.hide();
            return true;
        }

        if (modifiers & ctrlAltMask) {
            return false;
        }
        return activeMonitor.selectAnotherWindow(symbol);
    },

    destroy: function() {
        this._monitors.forEach(monitor => monitor.destroy());
        this.actor.destroy();
    },

    selectAnotherWindow: function(symbol) {
        this._monitors[this.currentMonitorIndex].selectAnotherWindow(symbol);
    },

    zoomFromOverview: function() {
        this._monitors.forEach(monitor => monitor.zoomFromOverview());
    },

    zoomToOverview: function() {
        this._monitors.forEach(monitor => monitor.zoomToOverview());
    },

    hasMaximizedWindows: function() {
        for(let monitor of this._monitors) {
            if (monitor.hasMaximizedWindows())
                return true;
        }
        return false;
    },

    isEmpty: function() {
        for(let monitor of this._monitors) {
            if (!monitor.isEmpty())
                return false;
        }
        return true;
    },

    showWindowsOverlays: function() {
        this._monitors.forEach(monitor => monitor.showWindowsOverlays());
    },

    hideWindowsOverlays: function() {
        this._monitors.forEach(monitor =>  monitor.hideWindowsOverlays());
    },

    syncStacking: function(arg1) {
        this._monitors.forEach(monitor => monitor.syncStacking(arg1));
    }
};
Signals.addSignalMethods(Workspace.prototype);
