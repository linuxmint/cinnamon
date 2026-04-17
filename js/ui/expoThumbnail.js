// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const Tooltips = imports.ui.tooltips;
const PointerTracker = imports.misc.pointerTracker;

const GridNavigator = imports.misc.gridNavigator;
const WindowUtils = imports.misc.windowUtils;

// The maximum size of a thumbnail is 1/8 the width and height of the screen
let MAX_THUMBNAIL_SCALE = 0.9;

const POINTER_LEAVE_MILLISECONDS_GRACE = 500;
const POINTER_ENTER_MILLISECONDS_GRACE = 150;
const RESCALE_ANIMATION_TIME = 200;
const SLIDE_ANIMATION_TIME = 300;
const INACTIVE_OPACITY = 120;
const REARRANGE_TIME_ON = 100;
const REARRANGE_TIME_OFF = 300;
const ICON_OPACITY = Math.round(255 * 0.9);
const ICON_SIZE = 128;
const ICON_OFFSET = -5;

const DRAGGING_WINDOW_OPACITY = Math.round(255 * 0.8);
const WINDOW_DND_SIZE = 256;

const DEMANDS_ATTENTION_CLASS_NAME = "window-list-item-demands-attention";

// persistent throughout session
var forceOverviewMode = false;

var ExpoWindowClone = GObject.registerClass({
    Signals: {
        'hovering': { param_types: [GObject.TYPE_BOOLEAN] },
        'selected': { param_types: [GObject.TYPE_UINT] },
        'middle-button-release': { param_types: [GObject.TYPE_UINT] },
        'demanding-attention': {},
        'drag-begin': {},
        'drag-end': {},
        'drag-cancelled': {},
    },
}, class ExpoWindowClone extends Clutter.Actor {
    _init(realWindow) {
        super._init({ reactive: true, layout_manager: new Clutter.FixedLayout() });
        this._delegate = this;
        this.realWindow = realWindow;
        this.metaWindow = realWindow.meta_window;
        this.refreshClone();

        this.realWindow.connectObject(
            'notify::size', this.onSizeChanged.bind(this), this);

        this.onPositionChanged();
        this.onSizeChanged();

        this._lastButtonPressTime = 0;
        this._pointerTracker = new PointerTracker.PointerTracker();

        this.connect('destroy', this.onDestroy.bind(this));

        this._draggable = DND.makeDraggable(this,
                                            { restoreOnSuccess: false,
                                              dragActorMaxSize: WINDOW_DND_SIZE,
                                              dragActorOpacity: DRAGGING_WINDOW_OPACITY});
        this._draggable.connect('drag-begin', this.onDragBegin.bind(this));
        this._draggable.connect('drag-end', this.onDragEnd.bind(this));
        this._draggable.connect('drag-cancelled', this.onDragCancelled.bind(this));
        this.inDrag = false;
        this.dragCancelled = false;

        this.icon = new St.Widget();
        this.add_child(this.icon);
        this.icon.hide();

        let iconActor = null;
        let app = this.metaWindow._expoApp; // will be non-null if the window comes from another ws
        if (!app) {
            let tracker = Cinnamon.WindowTracker.get_default();
            app = tracker.get_window_app(this.metaWindow);
            // Cache the app, as the tracker has difficulty in finding the app for windows
            // that come from recently removed workspaces.
            this.metaWindow._expoApp = app;
        }
        if (app) {
            iconActor = app.create_icon_texture_for_window(ICON_SIZE, this.metaWindow);
        }
        if (!iconActor) {
            iconActor = new St.Icon({ icon_name: 'applications-other',
                                 icon_type: St.IconType.FULLCOLOR,
                                 icon_size: ICON_SIZE });
        }
        this.icon.add_actor(iconActor);
        iconActor.opacity = ICON_OPACITY;

        global.display.connectObject(
            'window-demands-attention', this.onWindowDemandsAttention.bind(this),
            'window-marked-urgent', this.onWindowDemandsAttention.bind(this), this);
        this.urgencyTimeout = 0;
    }

    refreshClone(withTransients) {
        if (this.clone) {this.clone.destroy();}
        this.clone = new St.Widget({ reactive: false });
        this.add_child(this.clone);
        let [pwidth, pheight] = [this.realWindow.width, this.realWindow.height];
        let clones = WindowUtils.createWindowClone(this.metaWindow, 0, 0, withTransients);
        for (let i in clones) {
            let clone = clones[i].actor;
            this.clone.add_actor(clone);
            let [width, height] = clone.get_size();
            clone.set_position(Math.round((pwidth - width) / 2), Math.round((pheight - height) / 2));
        }
    }

    killUrgencyTimeout() {
        if (this.urgencyTimeout != 0) {
            GLib.source_remove(this.urgencyTimeout);
            this.urgencyTimeout = 0;
        }
    }

    showUrgencyState(params) {
        if (params && params.reps === 0) {
            // probably the easiest way to just show the current state and stop repeating
            this.showUrgencyState();
            return;
        }
        let mw = this.metaWindow;
        // Until urgency-query support is generally available in muffin,
        // this is more than a little complicated to get right.
        let isUrgent = mw.is_urgent && (mw.is_demanding_attention() || mw.is_urgent());
        if (isUrgent && !this.demanding_attention) {
            this.demandAttention();
            return;
        }
        let isNotUrgent = mw.is_urgent && !(mw.is_demanding_attention() || mw.is_urgent());

        let actor = this.icon;
        let hasStyle = actor.has_style_class_name(DEMANDS_ATTENTION_CLASS_NAME);
        if (!hasStyle && isNotUrgent) {
            this.demanding_attention = false;
            return; // window is no longer urgent, so stop alerting
        }

        let force = params && params.showUrgent;
        if (!hasStyle && (force || isUrgent)) {
            actor.add_style_class_name(DEMANDS_ATTENTION_CLASS_NAME);
        }
        if (hasStyle && (isNotUrgent || params && !params.showUrgent)) {
            actor.remove_style_class_name(DEMANDS_ATTENTION_CLASS_NAME);
        }

        if (params && params.reps > 0)
        {
            this.killUrgencyTimeout();
            this.urgencyTimeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 750, () => {
                // Null the id before the recursive call: the callback might
                // schedule a new timer, and we must not clobber its id when
                // this scope returns.
                this.urgencyTimeout = 0;
                this.showUrgencyState({showUrgent:!force, reps: params.reps - (force ? 0 : 1)});
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    demandAttention() {
        this.demanding_attention = true;
        this.showUrgencyState({showUrgent:true, reps: 50});
        this.emit('demanding-attention');
    }

    onWindowDemandsAttention(display, metaWindow) {
        if (metaWindow != this.metaWindow) {return;}
        this.demandAttention();
    }

    setStackAbove(actor) {
        if (actor.get_parent() !== this.get_parent()) {
            return;
        }
        this.stackAbove = actor;
        if (this.stackAbove == null)
            this.lower_bottom();
        else
            this.raise(this.stackAbove);
    }

    onPositionChanged() {
        this.set_position(this.origX = this.realWindow.x, this.origY = this.realWindow.y);
        this.set_size(this.realWindow.width, this.realWindow.height);
    }

    onSizeChanged() {
        this.set_size(this.realWindow.width, this.realWindow.height);
    }

    onDestroy() {
        this.killUrgencyTimeout();
        this.icon = null;
        this._delegate = null;

        if (this.inDrag) {
            this.inDrag = false;
            this.emit('drag-end');
        }
    }

    vfunc_button_press_event(event) {
        this._lastButtonPressTime = event.time;
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_button_release_event(event) {
        if ((event.time - this._lastButtonPressTime) < 500)
            this.onButtonRelease(event);
        return Clutter.EVENT_STOP;
    }

    vfunc_motion_event(event) {
        if (this._pointerTracker.hasMoved())
            this.emit('hovering', true);
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_leave_event(event) {
        if (this._pointerTracker.hasMoved())
            this.emit('hovering', false);
        return Clutter.EVENT_PROPAGATE;
    }

    onButtonRelease(event) {
        if (Cinnamon.get_event_state(event) !== 0)
            return Clutter.EVENT_STOP;

        const button = event.button;

        if ([Clutter.BUTTON_PRIMARY, Clutter.BUTTON_SECONDARY].includes(button))
        {
            this.emit('selected', event.time);
        }
        else if (button == Clutter.BUTTON_MIDDLE)
        {
            this.emit('middle-button-release', event.time);
        }
        return Clutter.EVENT_STOP;
    }

    onDragBegin(draggable, time) {
        this.inDrag = true;
        this.dragCancelled = false;
        this.emit('drag-begin');
    }

    onDragCancelled(draggable, time) {
        this.dragCancelled = true;
        this.emit('drag-cancelled');
    }

    onDragEnd(draggable, time, snapback) {
        this.inDrag = false;
        this.emit('drag-end');
    }
});


const ThumbnailState = {
    NEW   :         0,
    ANIMATING_IN :  1,
    NORMAL:         2,
    REMOVING :      3,
    ANIMATING_OUT : 4,
    ANIMATED_OUT :  5,
    COLLAPSING :    6,
    DESTROYED :     7
};

/**
 * @metaWorkspace: a #Meta.Workspace
 */
var ExpoWorkspaceThumbnail = GObject.registerClass({
    Properties: {
        'slide-position': GObject.ParamSpec.double(
            'slide-position', 'slide-position', 'slide-position',
            GObject.ParamFlags.READWRITE,
            0, 1, 0),
    },
    Signals: {
        'drag-over': {},
        'drag-end': {},
        'drag-begin': {},
    },
}, class ExpoWorkspaceThumbnail extends St.Widget {
    _init(metaWorkspace, box) {
        super._init({ reactive: true,
                      clip_to_allocation: true,
                      style_class: 'workspace-thumbnail' });
        this._delegate = this;
        this.box = box;
        this.metaWorkspace = metaWorkspace;
        this._addWindowIdleIds = new Set();

        this.overviewMode = false;

        this.frame = new St.Widget({ clip_to_allocation: true,
                                     style_class: 'expo-workspace-thumbnail-frame' });
        this.set_size(global.screen_width, global.screen_height);

        this.contents = new Clutter.Group();
        this.add_child(this.contents);

        this.connect('destroy', this.onDestroy.bind(this));

        this._lastButtonPressTimeStamp = 0;

        this.title = new St.Entry({ style_class: 'expo-workspaces-name-entry',
                                     track_hover: true,
                                     can_focus: true });
        this.title._spacing = 0;
        this.titleText = this.title.clutter_text;
        this.titleText.editable = false;
        this.titleText.connect('key-press-event', this.onTitleKeyPressEvent.bind(this));
        this.titleText.connect('key-focus-in', () => {
            this.titleText.editable = true;
            this.origTitle = Main.getWorkspaceName(this.metaWorkspace.index());
        });
        this.titleText.connect('key-focus-out', () => {
            if (this.doomed) {
                // user probably deleted workspace while editing
                global.stage.set_key_focus(this.box);
                return;
            }
            if (!this.undoTitleEdit) {
                let newName = this.title.get_text().trim();
                if (newName != this.origTitle) {
                    Main.setWorkspaceName(this.metaWorkspace.index(), newName);
                }
            }
            this.title.set_text(Main.getWorkspaceName(this.metaWorkspace.index()));
        });

        this.title.set_text(Main.getWorkspaceName(this.metaWorkspace.index()));

        this.background = new Clutter.Group();
        this.contents.add_actor(this.background);

        let desktopBackground = Main.createFullScreenBackground();
        this.background.add_actor(desktopBackground);

        let backgroundShade = new St.Bin({style_class: 'workspace-overview-background-shade'});
        this.background.add_actor(backgroundShade);
        backgroundShade.set_size(global.screen_width, global.screen_height);

        this.shader = new St.Bin();
        this.shader.set_style('background-color: black;');
        this.add_child(this.shader);
        this.shader.set_size(global.screen_width, global.screen_height);

        this.shader.opacity = INACTIVE_OPACITY;

        if (metaWorkspace == global.workspace_manager.get_active_workspace())
            this.shader.opacity = 0;

        let windows = global.get_window_actors().filter(this.isMyWindow, this);

        // Create clones for windows that should be visible in the Expo
        this.count = 0;
        this.windows = [];
        for (let i = 0; i < windows.length; i++) {
            if (this.isExpoWindow(windows[i])) {
                this.addWindowClone(windows[i]);
            }
        }

        this.metaWorkspace.connectObject(
            'window-added', this.windowAdded.bind(this),
            'window-removed', this.windowRemoved.bind(this), this);
        global.display.connectObject(
            'window-entered-monitor', this.windowEnteredMonitor.bind(this),
            'window-left-monitor', this.windowLeftMonitor.bind(this),
            'restacked', this.onRestack.bind(this), this);
        box.connectObject(
            'set-overview-mode', (box, turnOn) => {
                this.setOverviewMode(turnOn);
                this.hovering = false;
            }, this);

        this.isActive = false;
        this.state = ThumbnailState.NORMAL;
        this.restack();
        this.setOverviewMode(forceOverviewMode);
    }

    set slide_position(slidePosition) {
        if (this._slidePosition === slidePosition)
            return;
        this._slidePosition = slidePosition;
        this.notify('slide-position');
        this.queue_relayout();
    }

    get slide_position() {
        return this._slidePosition || 0;
    }

    setOverviewMode(turnOn) {
        if (turnOn) {this.overviewModeOn();}
        else {this.overviewModeOff();}
    }

    refresh() {
        this.refreshTitle();
        this.resetCloneHover();
        this.setOverviewMode(this.overviewMode);
    }

    onRestack() {
        this.restack();
        this.refresh();
    }

    restack(force) {
        if (this.state > ThumbnailState.NORMAL) {
            return;
        }
        if (this.isActive || !this.stackIndices || force) {
            let stack = global.get_window_actors().filter(this.isMyWindow, this);
            this.stackIndices = {};

            for (let i = 0; i < stack.length; i++) {
                // Use the stable sequence for an integer to use as a hash key
                this.stackIndices[stack[i].get_meta_window().get_stable_sequence()] = i;
            }
            this.syncStacking(this.stackIndices);
        }
    }

    setActive(isActive) {
        this.isActive = isActive;
        this.frame.name = isActive ? 'active' : '';
    }

    refreshTitle() {
        if (!this.doomed) { // better safe than sorry
            this.title.set_text(Main.getWorkspaceName(this.metaWorkspace.index()));
        }
    }

    onTitleKeyPressEvent(actor, event) {
        this.undoTitleEdit = false;
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Return ||
            symbol === Clutter.KEY_KP_Enter ||
            symbol === Clutter.KEY_Escape) {
            if (symbol === Clutter.KEY_Escape) {
                this.undoTitleEdit = true;
            }
            global.stage.set_key_focus(this);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    activateWorkspace() {
        if (this.metaWorkspace != global.workspace_manager.get_active_workspace())
            this.metaWorkspace.activate(global.get_current_time());
        Main.expo.hide();
    }

    showKeyboardSelectedState(selected) {
        this.isSelected = selected;
        this.title.name = selected ? "selected" : "";
        if (selected) {
            this.highlight();
            this.overviewModeOn();
        }
        else {
            this.hovering = false;
            this.overviewModeOff();
            this.shade();
        }
    }

    lookupIndex(metaWindow) {
        for (let i = 0; i < this.windows.length; i++) {
            if (this.windows[i].metaWindow == metaWindow) {
                return i;
            }
        }
        return -1;
    }

    syncStacking(stackIndices) {
        this.windows.sort((a, b) => {
            let minimizedDiff = function(a, b) {
                let minimizedA = a.metaWindow.minimized ? -1 : 0;
                let minimizedB = b.metaWindow.minimized ? -1 : 0;
                return minimizedA - minimizedB;
            };
            let noOverviewDiff = (a, b) => {
                let noOverviewA = !this.isOverviewWindow(a.metaWindow) ? -1 : 0;
                let noOverviewB = !this.isOverviewWindow(b.metaWindow) ? -1 : 0;
                return noOverviewA - noOverviewB;
            };
            let transientRelation = function(a, b) {
                let overviewDifference = noOverviewDiff(a,b);
                if (overviewDifference) {
                    let transientA = a.metaWindow.get_transient_for() === b.metaWindow ? 1 : 0;
                    let transientB = !transientA && b.metaWindow.get_transient_for() === a.metaWindow ? 1 : 0;
                    return transientA - transientB || overviewDifference;
                }
                return 0;
            };

            return transientRelation(a,b) || minimizedDiff(a,b) ||
                    stackIndices[a.metaWindow.get_stable_sequence()] - stackIndices[b.metaWindow.get_stable_sequence()];
        });

        for (let i = 0; i < this.windows.length; i++) {
            let clone = this.windows[i];
            let metaWindow = clone.metaWindow;
            if (i == 0) {
                clone.setStackAbove(this.background);
            } else {
                let previousClone = this.windows[i - 1];
                clone.setStackAbove(previousClone);
            }
        }
    }

    doRemoveWindow(metaWin) {
        let win = metaWin.get_compositor_private();

        // find the position of the window in our list
        let index = this.lookupIndex (metaWin);

        if (index == -1)
            return;

        // Check if window still should be here
        if (win && this.isMyWindow(win) && this.isExpoWindow(win))
            return;

        let clone = this.windows[index];
        this.windows.splice(index, 1);

        clone.destroy();
        if (this.overviewMode)
            this.overviewModeOn();
    }

    doAddWindow(metaWin) {
        let win = metaWin.get_compositor_private();
        if (!win) {
            // Newly-created windows are added to a workspace before
            // the compositor finds out about them...
            let id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this._addWindowIdleIds.delete(id);
                if (this.windows &&
                    metaWin.get_compositor_private())
                {
                    this.doAddWindow(metaWin);
                }
                return GLib.SOURCE_REMOVE;
            });
            this._addWindowIdleIds.add(id);
            return;
        }

        // We might have the window in our list already if it was on all workspaces and
        // now was moved to this workspace
        let winCloneIndex = this.lookupIndex(metaWin);
        if (winCloneIndex !== -1) {
            // the window's position on the workspace may have changed (dragging to a different monitor)
            // update its original location so overview on/off position correctly.
            this.windows[winCloneIndex].origX = win.x;
            this.windows[winCloneIndex].origY = win.y;
            return;
        }

        if (!this.isMyWindow(win) || !this.isExpoWindow(win))
            return;

        let clone = this.addWindowClone(win);

        this.overviewModeOn();
    }

    windowAdded(metaWorkspace, metaWin) {
        this.doAddWindow(metaWin);
        this.restack();
    }

    windowRemoved(metaWorkspace, metaWin) {
        this.doRemoveWindow(metaWin);
    }

    windowEnteredMonitor(metaDisplay, monitorIndex, metaWin) {
        // important if workspaces-only-on-primary is in effect
        this.doAddWindow(metaWin);
    }

    windowLeftMonitor(metaDisplay, monitorIndex, metaWin) {
        // important if workspaces-only-on-primary is in effect
        this.doRemoveWindow(metaWin);
    }

    onDestroy(actor) {
        actor.remove_all_transitions();
        if (this._collapseId) {
            GLib.source_remove(this._collapseId);
            this._collapseId = 0;
        }
        if (this.buttonTimeoutId) {
            GLib.source_remove(this.buttonTimeoutId);
            this.buttonTimeoutId = 0;
        }
        if (this._addWindowIdleIds) {
            this._addWindowIdleIds.forEach(id => GLib.source_remove(id));
            this._addWindowIdleIds.clear();
        }
        this.resetCloneHover();
        for (let i = 0; i < this.windows.length; i++) {
            this.windows[i].destroy();
        }
        this.windows = null;
    }

    // Tests if @win belongs to this workspace and monitor
    isMyWindow(win) {
        return Main.isWindowActorDisplayedOnWorkspace(win, this.metaWorkspace.index());
    }

    // Tests if @win should be shown in the Expo
    isExpoWindow(win) {
        let metaWindow = win.get_meta_window();
        if (metaWindow.is_override_redirect()) {
            return false;
        }
        let type = metaWindow.get_window_type();
        return type !== Meta.WindowType.DESKTOP && type !== Meta.WindowType.DOCK;
    }

    // Tests if @win should be shown in overview mode
    isOverviewWindow(metaWindow) {
        return Main.isInteresting(metaWindow);
    }

    // Create a clone of a (non-desktop) window and add it to the window list
    addWindowClone(win) {
        let clone = new ExpoWindowClone(win);

        clone.connect('middle-button-release', (sender, time) => {
            clone.metaWindow.delete(time);
        });
        clone.connect('hovering', this.onCloneHover.bind(this));
        clone.connect('demanding-attention', () => { this.overviewModeOn(); });
        clone.connect('selected', this.activate.bind(this));
        clone.connect('drag-begin', (clone) => {
            this.box.emit('drag-begin');
            this.resetCloneHover();
        });
        clone.connect('drag-end', (clone) => {
            this.box.emit('drag-end');
            if (clone.dragCancelled) {
                // stacking order may have been disturbed
                this.restack();
            }
            this.overviewModeOn();
        });
        this.contents.add_actor(clone);

        if (this.windows.length == 0)
            clone.setStackAbove(this.background);
        else
            clone.setStackAbove(this.windows[this.windows.length - 1]);

        this.windows.push(clone);

        return clone;
    }

    resetCloneHover() {
        this.lastHoveredClone = null;
        if (this.tooltip) {
            this.tooltip.destroy();
            this.tooltip = null;
        }
    }

    onCloneHover(clone, hovering) {
        if (!this.overviewMode) {
            this.resetCloneHover();
            return;
        }
        if (hovering && clone !== this.lastHoveredClone) {
            if (this.buttonTimeoutId) {GLib.source_remove(this.buttonTimeoutId);}
            this.buttonTimeoutId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this.buttonTimeoutId = 0;
                if (!this.windows) {return GLib.SOURCE_REMOVE;} /* being destroyed */
                let [x, y, mask] = global.get_pointer();
                let target = this.contents.get_stage().get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);
                if (target !== clone) {
                    this.resetCloneHover();
                    return GLib.SOURCE_REMOVE;
                }
                if (this.tooltip) {
                    this.tooltip.destroy();
                }
                this.tooltip = new Tooltips.Tooltip(clone, clone.metaWindow.title);
                return GLib.SOURCE_REMOVE;
            });
            this.lastHoveredClone = clone;
        }
    }

    overviewModeOn() {
        if (!this.box.thumbnail_scale) {return;}
        this.overviewMode = true;
        this.resetCloneHover();

        let windows = [];
        this.windows.forEach(function(window) {
            if (this.isOverviewWindow(window.metaWindow)) {
                windows.push(window);
            }
            else {
                window.ease({
                    scale_x: 0,
                    scale_y: 0,
                    duration: Main.animations_enabled ? REARRANGE_TIME_ON : 0,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => window.hide()
                });
            }
        }, this);

        windows.reverse(); // top-to-bottom order
        Main.layoutManager.monitors.forEach(function(monitor, monitorIndex) {
            let monitorWindows = windows.filter(function(window) {
                return window.metaWindow.get_monitor() === monitorIndex;
            }, this);

            let spacing = 14;
            let nWindows = monitorWindows.length;
            let [nCols, nRows]  = [Math.ceil(Math.sqrt(nWindows)), Math.round(Math.sqrt(nWindows))]
            let maxWindowWidth = (monitor.width - (spacing * (nCols+1))) / nCols;
            let maxWindowHeight = (monitor.height - (spacing * (nRows+1))) / nRows;
            let [col, row] = [1, 1];
            let lastRowCols = nWindows - ((nRows - 1) * nCols);
            let lastRowOffset = (monitor.width - (maxWindowWidth * lastRowCols) - (spacing * (lastRowCols+1))) / 2;
            let offset = 0;

            monitorWindows.forEach(function(window, i) {
                if (window.inDrag) {return;}

                window.refreshClone(true);
                window.showUrgencyState();
                if (row == nRows)
                    offset = lastRowOffset;
                let [wWidth, wHeight] = [window.realWindow.width, window.realWindow.height];
                let scale = Math.min(1, maxWindowWidth / wWidth, maxWindowHeight / wHeight);
                let x = monitor.x + offset + (spacing * col) + (maxWindowWidth * (col - 1)) + ((maxWindowWidth - (wWidth * scale)) / 2);
                let y = monitor.y + (spacing * row) + (maxWindowHeight * (row - 1)) + ((maxWindowHeight - (wHeight * scale)) / 2);

                window.icon.raise_top();
                // all icons should be the same size!
                let iconScale = (0.25/this.box.thumbnail_scale/scale);
                window.icon.set_scale(iconScale, iconScale);
                let [iconX, iconY] = [ICON_OFFSET / this.box.thumbnail_scale/scale, ICON_OFFSET / this.box.thumbnail_scale/scale];
                window.icon.set_position(iconX, iconY);
                window.ease({
                    x: x,
                    y: y,
                    scale_x: scale,
                    scale_y: scale,
                    opacity: 255,
                    duration: Main.animations_enabled ? REARRANGE_TIME_ON : 0,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => {
                        window.show();
                        window.icon.show();
                    }
                });
                col++;
                if (col > nCols){
                    row ++;
                    col = 1;
                }
            }, this);
        }, this);
    }

    overviewModeOff(force, override) {
        if (!this.box.thumbnail_scale) {return;}
        this.resetCloneHover();
        if (this.overviewMode === false && !force) {return;}
        if (forceOverviewMode && !override) {return;}

        this.overviewMode = false;
        const iconSpacing = ICON_SIZE/4;
        let rearrangeTime = force ? REARRANGE_TIME_OFF/2 : REARRANGE_TIME_OFF;

        Main.layoutManager.monitors.forEach(function(monitor, monitorIndex) {
            this.windows.forEach(function(window) {
                if (window.inDrag) {return;}

                if (monitorIndex !== window.metaWindow.get_monitor()) {
                    return;
                }

                window.refreshClone(false);
                window.showUrgencyState();
                window.icon.hide();
                window.show();
                window.ease({
                    x: window.origX,
                    y: window.origY,
                    scale_x: 1, scale_y: 1,
                    opacity: window.metaWindow.showing_on_its_workspace() ? 255 : 127,
                    duration: Main.animations_enabled ? rearrangeTime : 0,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD
                });
            }, this);
        }, this);
    }

    vfunc_button_press_event(event) {
        this._lastButtonPressTimeStamp = event.time;
        return Clutter.EVENT_STOP;
    }

    vfunc_button_release_event(event) {
        // A long time elapsed is probably due to a failed dnd attempt,
        // or some other mishap, so we'll ignore those.
        let timeElapsed = event.time - this._lastButtonPressTimeStamp;
        if (timeElapsed > 500)
            return Clutter.EVENT_STOP;

        if (Cinnamon.get_event_state(event) !== 0)
            return Clutter.EVENT_PROPAGATE;

        const button = event.button;
        if ([Clutter.BUTTON_PRIMARY, Clutter.BUTTON_SECONDARY].includes(button)) {
            this.activate(null, event.time);
            return Clutter.EVENT_STOP;
        } else if (button === Clutter.BUTTON_MIDDLE) {
            this.removeWorkspace();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_scroll_event(event) {
        if (Main.expo.animationInProgress)
            return Clutter.EVENT_PROPAGATE;

        switch (event.direction) {
        case Clutter.ScrollDirection.UP:
            Main.wm.actionMoveWorkspaceLeft();
            break;
        case Clutter.ScrollDirection.DOWN:
            Main.wm.actionMoveWorkspaceRight();
            break;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    activate(clone, time) {
        if (this.state > ThumbnailState.NORMAL)
            return;

        if (clone && clone.metaWindow != null){
            Main.activateWindow(clone.metaWindow, time, this.metaWorkspace.index());
        }
        if (this.metaWorkspace != global.workspace_manager.get_active_workspace())
            this.metaWorkspace.activate(time);
        Main.expo.hide();
    }

    shade(force) {
        if (!this.isSelected || force) {
            this.shader.ease({
                opacity: INACTIVE_OPACITY,
                duration: Main.animations_enabled ? SLIDE_ANIMATION_TIME : 0,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD
            });
        }
    }

    highlight() {
        this.shader.ease({
            opacity: 0,
            duration: Main.animations_enabled ? SLIDE_ANIMATION_TIME : 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }

    removeWorkspace() {
        if (this.doomed) {
            // this workspace is already being removed
            return;
        }
        if (global.workspace_manager.n_workspaces <= 1) {
            return;
        }
        let removeAction = () => {
            this.doomed = true;
            Main._removeWorkspace(this.metaWorkspace);
        };
        if (!Main.hasDefaultWorkspaceName(this.metaWorkspace.index())) {
            this.overviewModeOn();
            this.highlight();
            let prompt = _("Are you sure you want to remove workspace \"%s\"?\n\n").format(
                Main.getWorkspaceName(this.metaWorkspace.index()));
            let confirm = new ModalDialog.ConfirmDialog(prompt, removeAction);
            confirm.open();
        }
        else {
            removeAction();
        }
    }

    coordinateToMonitor(x, y) {
        let indexOne = 0;
        Main.layoutManager.monitors.forEach(function(monitor, mindex) {
            let [xX, yY] = [x - monitor.x, y - monitor.y];
            indexOne = indexOne || (xX >= 0 && xX < monitor.width && yY > 0 && yY < monitor.height ? mindex + 1 : 0);
        }, this);
        return indexOne - 1;
    }

    // Draggable target interface
    handleDragOver(source, actor, x, y, time) {
        this.emit('drag-over');
        if (!this.overviewMode) {
            this.overviewModeOn();
        }
        return this.handleDragOverOrDrop(false, source, actor, x, y, time);
    }

    handleDragOverOrDrop(dropping, source, actor, x, y, time) {
        this.hovering = false; // normal hover logic is off during dnd
        if (dropping) {
            let draggable = source._draggable;
            actor.opacity = draggable._dragOrigOpacity;
            global.reparentActor(actor, draggable._dragOrigParent);
        }

        if (source == Main.xdndHandler) {
            return DND.DragMotionResult.CONTINUE;
        }

        if (this.state > ThumbnailState.NORMAL)
            return DND.DragMotionResult.CONTINUE;

        if (!source.metaWindow)
            return DND.DragMotionResult.CONTINUE;

        let win = source.realWindow;
        let metaWindow = source.metaWindow;

        let targetMonitor = this.coordinateToMonitor(x, y);
        let fromMonitor = metaWindow.get_monitor();

        let movingMonitors = targetMonitor >= 0 && fromMonitor !== targetMonitor;
        let movingWorkspaces = !Main.isWindowActorDisplayedOnWorkspace(win, this.metaWorkspace.index());

        let canDrop = false;
        if (movingMonitors && Main.wm.workspacesOnlyOnPrimary &&
            (fromMonitor === Main.layoutManager.primaryIndex || targetMonitor === Main.layoutManager.primaryIndex))
        {
            canDrop = true;
            if (dropping) {
                metaWindow.move_to_monitor(targetMonitor);
                if (targetMonitor === Main.layoutManager.primaryIndex) {
                    metaWindow.change_workspace(this.metaWorkspace);
                }
            }
        }
        else {
            if (movingWorkspaces ||
                (metaWindow.is_on_all_workspaces() &&
                    !movingMonitors &&
                    (Main.layoutManager.monitors.length === 1 ||
                        !(Main.wm.workspacesOnlyOnPrimary && fromMonitor !== Main.layoutManager.primaryIndex)
                )))
            {
                canDrop = true;
                if (dropping) {
                    metaWindow.change_workspace(this.metaWorkspace);
                }
            }
            if (movingMonitors) {
                canDrop = true;
                if (dropping) {
                    metaWindow.move_to_monitor(targetMonitor);
                }
            }
        }

        return canDrop ? DND.DragMotionResult.MOVE_DROP : DND.DragMotionResult.CONTINUE;
    }

    acceptDrop(source, actor, x, y, time) {
        if (this.handleDragOverOrDrop(false, source, actor, x, y, time) != DND.DragMotionResult.CONTINUE) {
            if (this.handleDragOverOrDrop(true, source, actor, x, y, time) != DND.DragMotionResult.CONTINUE) {
                this.restack(true);
                this.overviewModeOn();
                return true;
            }
        }
        return false;
    }
});


var ExpoThumbnailsBox = GObject.registerClass({
    Properties: {
        'thumbnail-scale': GObject.ParamSpec.double(
            'thumbnail-scale', 'thumbnail-scale', 'thumbnail-scale',
            GObject.ParamFlags.READWRITE,
            0, MAX_THUMBNAIL_SCALE, 0),
    },
    Signals: {
        'set-overview-mode': { param_types: [GObject.TYPE_BOOLEAN] },
        'allocated': {},
        'drag-begin': {},
        'drag-end': {},
    },
}, class ExpoThumbnailsBox extends St.Widget {
    _init() {
        super._init({
            style_class: 'workspace-thumbnails',
            reactive: true,
            request_mode: Clutter.RequestMode.WIDTH_FOR_HEIGHT,
        });

        // When we animate the scale, we don't animate the requested size of the thumbnails, rather
        // we ask for our final size and then animate within that size. This slightly simplifies the
        // interaction with the main workspace windows (instead of constantly reallocating them
        // to a new size, they get a new size once, then use the standard window animation code
        // allocate the windows to their new positions), however it causes problems for drawing
        // the background and border wrapped around the thumbnail as we animate - we can't just pack
        // the container into a box and set style properties on the box since that box would wrap
        // around the final size not the animating size. So instead we fake the background with
        // an actor underneath the content and adjust the allocation of our children to leave space
        // for the border and padding of the background actor.
        this.background = new St.Bin({reactive:true});
        this.add_child(this.background);
        this.background.handleDragOver = function(source, actor, x, y, time) {
            return source.metaWindow && !source.metaWindow.is_on_all_workspaces() ?
                DND.DragMotionResult.MOVE_DROP : DND.DragMotionResult.CONTINUE;
        };
        this.background.acceptDrop = (source, actor, x, y, time) => {
            if (this.background.handleDragOver(source, actor, x, y, time) ===  DND.DragMotionResult.MOVE_DROP) {
                let draggable = source._draggable;
                actor.get_parent().remove_actor(actor);
                draggable._dragOrigParent.add_actor(actor);
                actor.opacity = draggable._dragOrigOpacity;
                source.metaWindow.stick();
                return true;
            }
            return false;
        };
        this.background._delegate = this.background;

        this.button = new St.Button({ style_class: 'workspace-close-button' });
        this.add_child(this.button);

        this.button.connect('enter-event', () => { this.button.show(); });
        this.button.connect('leave-event', () => { this.button.hide(); });
        this.button.connect('clicked', () => { this.lastHovered.removeWorkspace(); this.button.hide(); });
        this.button.hide();

        this.targetScale = 0;
        this.pendingScaleUpdate = false;
        this.stateUpdateQueued = false;

        this.stateCounts = {};
        for (let key in ThumbnailState)
            this.stateCounts[ThumbnailState[key]] = 0;

        this.thumbnails = [];
        // The "porthole" is the portion of the screen that we show in the workspaces
        this.porthole = {
            x: 0,
            y: 0,
            width: global.screen_width,
            height: global.screen_height
            };

        this.kbThumbnailIndex = global.workspace_manager.get_active_workspace_index();

        this._initialAllocTimeoutId = 0;
        this._updateStatesLaterId = 0;

        let allocId = this.connect('notify::allocation', () => {
            this.disconnect(allocId);
            this._initialAllocTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                this._initialAllocTimeoutId = 0;
                if (this.thumbnails.length) {
                    this.emit('set-overview-mode', forceOverviewMode);
                    this.thumbnails[this.kbThumbnailIndex].showKeyboardSelectedState(true);
                }
                return GLib.SOURCE_REMOVE;
            });
        });

        this.connect('destroy', () => {
            if (this._initialAllocTimeoutId) {
                GLib.source_remove(this._initialAllocTimeoutId);
                this._initialAllocTimeoutId = 0;
            }
            if (this._updateStatesLaterId) {
                Meta.later_remove(this._updateStatesLaterId);
                this._updateStatesLaterId = 0;
            }
        });

        this.toggleGlobalOverviewMode = function() {
            forceOverviewMode = !forceOverviewMode;
            this.emit('set-overview-mode', forceOverviewMode);
        };
    }

    vfunc_button_release_event(event) {
        if (Cinnamon.get_event_state(event) === 0 &&
                event.button == Clutter.BUTTON_MIDDLE) {
            this.toggleGlobalOverviewMode();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_scroll_event(event) {
        if (Main.expo.animationInProgress)
            return Clutter.EVENT_PROPAGATE;

        switch (event.direction) {
        case Clutter.ScrollDirection.UP:
            Main.wm.actionMoveWorkspaceUp();
            break;
        case Clutter.ScrollDirection.DOWN:
            Main.wm.actionMoveWorkspaceDown();
            break;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    show() {
        global.window_manager.connectObject(
            'switch-workspace', this.activeWorkspaceChanged.bind(this), this);
        global.workspace_manager.connectObject(
            'workspace-added', (ws_manager, index) => {
                this.addThumbnails(index, 1);
            },
            'workspace-removed', () => {
                this.button.hide();

                let removedCount = 0;
                this.thumbnails.forEach((thumbnail, i) => {
                    let metaWorkspace = global.workspace_manager.get_workspace_by_index(i-removedCount);
                    if (thumbnail.metaWorkspace != metaWorkspace) {
                        ++removedCount;
                        if (thumbnail.state <= ThumbnailState.NORMAL) {
                            this.setThumbnailState(thumbnail, ThumbnailState.REMOVING);
                        }
                    }
                });
                this.updateStates();
            }, this);

        this.stateCounts = {};
        for (let key in ThumbnailState)
            this.stateCounts[ThumbnailState[key]] = 0;

        this.addThumbnails(0, global.workspace_manager.n_workspaces);

        this.button.raise_top();

        global.stage.set_key_focus(this);
    }

    handleKeyPressEvent(actor, event) {
        let modifiers = Cinnamon.get_event_state(event);
        let ctrlAltMask = Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD1_MASK;
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Return ||
            symbol === Clutter.KEY_KP_Enter ||
            symbol === Clutter.KEY_space)
        {
            this.activateSelectedWorkspace();
            return Clutter.EVENT_STOP;
        }
        if (symbol === Clutter.KEY_F2) {
            this.editWorkspaceTitle();
            return Clutter.EVENT_STOP;
        }

        if ((symbol === Clutter.KEY_o || symbol === Clutter.KEY_O) && modifiers & Clutter.ModifierType.CONTROL_MASK) {
            this.toggleGlobalOverviewMode();
            return Clutter.EVENT_STOP;
        }
        if (modifiers & ctrlAltMask) {
            return Clutter.EVENT_PROPAGATE;
        }
        return this.selectNextWorkspace(symbol);
    }

    editWorkspaceTitle() {
        this.thumbnails[this.kbThumbnailIndex].title.grab_key_focus();
    }

    activateSelectedWorkspace() {
        this.thumbnails[this.kbThumbnailIndex].activateWorkspace();
    }

    removeSelectedWorkspace() {
        this.thumbnails[this.kbThumbnailIndex].removeWorkspace();
    }

    // returns true if symbol was understood, false otherwise
    selectNextWorkspace(symbol) {
        let prevIndex = this.kbThumbnailIndex;
        let lastIndex = this.thumbnails.length - 1;

        let [nColumns, nRows] = this.getNumberOfColumnsAndRows(this.thumbnails.length);
        let nextIndex = GridNavigator.nextIndex(this.thumbnails.length, nColumns, prevIndex, symbol);
        if (nextIndex >= 0) {
            this.kbThumbnailIndex = nextIndex;
        }
        else {
            let index = symbol - 48 - 1; // convert '1' to index 0, etc
            if (index >= 0 && index < 10) {
                // OK
            }
            else {
                index = symbol - Clutter.KEY_KP_1; // convert Num-pad '1' to index 0, etc
                if (index < 0 || index > 9) {
                    return Clutter.EVENT_PROPAGATE; // not handled
                }
            }
            if (index > lastIndex) {
                return Clutter.EVENT_STOP; // handled, but out of range
            }
            this.kbThumbnailIndex = index;
            this.activateSelectedWorkspace();
            Main.wm.showWorkspaceOSD();
            return Clutter.EVENT_STOP; // handled
        }

        if (prevIndex != this.kbThumbnailIndex) {
            this.thumbnails[prevIndex].showKeyboardSelectedState(false);
            this.thumbnails[this.kbThumbnailIndex].showKeyboardSelectedState(true);
        }
        return Clutter.EVENT_STOP; // handled
    }

    hide() {
        global.window_manager.disconnectObject(this);
        global.workspace_manager.disconnectObject(this);

        for (let w = 0; w < this.thumbnails.length; w++) {
            this.thumbnails[w].destroy();
        }
        this.thumbnails = [];
    }

    showButton() {
        if (global.workspace_manager.n_workspaces <= 1)
            return false;
        this.queue_relayout();
        this.button.raise_top();
        this.button.show();
        return true;
    }

    addThumbnails(start, count) {
        function isInternalEvent(thumbnail, actor, event) {
            return actor === event.get_related() ||
                thumbnail.contains(event.get_related());
        }
        for (let k = start; k < start + count; k++) {
            let metaWorkspace = global.workspace_manager.get_workspace_by_index(k);
            let thumbnail = new ExpoWorkspaceThumbnail(metaWorkspace, this);

            this.thumbnails.push(thumbnail);
            if (metaWorkspace == global.workspace_manager.get_active_workspace()) {
                this.lastActiveWorkspace = thumbnail;
                thumbnail.setActive(true);
            }
            let overviewTimeoutId = null;
            let setOverviewTimeout = (timeout, func) => {
                if (overviewTimeoutId) GLib.source_remove(overviewTimeoutId);
                overviewTimeoutId = null;
                if (timeout && func) {
                    overviewTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout, func);
                }
            };
            thumbnail.connect('destroy', () => {
                setOverviewTimeout(0);
                if (this.lastHovered === thumbnail)
                    this.lastHovered = null;
                this.remove_child(thumbnail.title);
                this.remove_child(thumbnail.frame);
                thumbnail.title.destroy();
                thumbnail.frame.destroy();
            });
            this.add_child(thumbnail.title);
            this.add_child(thumbnail.frame);
            this.add_child(thumbnail);

            // We use this as a flag to minimize the number of enter and leave events we really
            // have to deal with, since we get many spurious events when the mouse moves
            // over the windows in the thumbnails. Handling each and every event leads to
            // jumping icons if there are minimized windows in a thumbnail.
            thumbnail.hovering = false;

            thumbnail.connect('drag-over', () => {
                thumbnail.highlight();
                if (this.lastHovered && this.lastHovered != thumbnail) {
                    this.lastHovered.shade();
                }
                this.lastHovered = thumbnail;
            });

            // We want to ignore spurious events caused by animations
            // (when the contents are moving and not the pointer).
            let pointerTracker = new PointerTracker.PointerTracker();
            thumbnail.connect('motion-event', (actor, event) => {
                if (!pointerTracker.hasMoved()) {return;}
                if (!thumbnail.hovering) {
                    thumbnail.hovering = true;
                    this.lastHovered = thumbnail;
                    this.showButton();
                    thumbnail.highlight();
                    setOverviewTimeout(POINTER_ENTER_MILLISECONDS_GRACE, function() {
                        if (thumbnail.hovering) {
                            thumbnail.overviewModeOn();
                        }
                        overviewTimeoutId = 0;
                        return GLib.SOURCE_REMOVE;
                    });
                }
            });

            thumbnail.connect('leave-event', (actor, event) => {
                if (!pointerTracker.hasMoved()) {return;}
                if (this.isShowingModalDialog()) {return;}
                if (thumbnail.hovering && !isInternalEvent(thumbnail, actor, event)) {
                    thumbnail.hovering = false;
                    this.button.hide();
                    thumbnail.shade();
                    setOverviewTimeout(POINTER_LEAVE_MILLISECONDS_GRACE, function() {
                        if (!thumbnail.hovering) {
                            thumbnail.overviewModeOff();
                        }
                        overviewTimeoutId = 0;
                        return GLib.SOURCE_REMOVE;
                    });
                }
            });

            if (start > 0) { // not the initial fill
                thumbnail.state = ThumbnailState.NEW;
                thumbnail.slide_position = 1;
            } else {
                thumbnail.state = ThumbnailState.NORMAL;
            }

            this.stateCounts[thumbnail.state]++;
        }

        if (start > 0) {
            this.updateStates();
        }
        else {
            this.queueUpdateStates();
        }
    }

    set thumbnail_scale(scale) {
        if (this._thumbnailScale === scale)
            return;
        this._thumbnailScale = scale;
        this.notify('thumbnail-scale');
        this.queue_relayout();
    }

    get thumbnail_scale() {
        return this._thumbnailScale || 0;
    }

    setThumbnailState(thumbnail, state) {
        this.stateCounts[thumbnail.state]--;
        thumbnail.state = state;
        this.stateCounts[thumbnail.state]++;
    }

    iterateStateThumbnails(state, callback) {
        if (this.stateCounts[state] == 0)
            return;

        for (let i = 0; i < this.thumbnails.length; i++) {
            if (this.thumbnails[i].state == state)
                callback.call(this, this.thumbnails[i]);
        }
    }

    _animateThumbnailScale() {
        this.ease_property('thumbnail-scale', this.targetScale, {
            duration: RESCALE_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this.queueUpdateStates(),
        });
    }

    updateStates() {
        this.stateUpdateQueued = false;

        if (!this.thumbnails.length)
            return;

        // Then slide out any thumbnails that have been destroyed
        this.iterateStateThumbnails(ThumbnailState.REMOVING,
            function(thumbnail) {
                thumbnail.title.hide();
                this.setThumbnailState(thumbnail, ThumbnailState.ANIMATING_OUT);

                thumbnail.ease_property('slide-position', 1, {
                    duration: SLIDE_ANIMATION_TIME,
                    mode: Clutter.AnimationMode.LINEAR,
                    onComplete: () => {
                        this.setThumbnailState(thumbnail, ThumbnailState.ANIMATED_OUT);
                        this.queueUpdateStates();
                    },
                });
            });

        // As long as things are sliding out, don't proceed
        if (this.stateCounts[ThumbnailState.ANIMATING_OUT] > 0)
            return;

        // Once that's complete, we can start scaling to the new size and collapse any removed thumbnails
        this.iterateStateThumbnails(ThumbnailState.ANIMATED_OUT,
            function(thumbnail) {
                thumbnail.hide();
                this.setThumbnailState(thumbnail, ThumbnailState.COLLAPSING);
                thumbnail._collapseId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, RESCALE_ANIMATION_TIME, () => {
                    thumbnail._collapseId = 0;
                    this.stateCounts[thumbnail.state]--;
                    thumbnail.state = ThumbnailState.DESTROYED;

                    let index = this.thumbnails.indexOf(thumbnail);
                    this.thumbnails.splice(index, 1);
                    thumbnail.destroy();

                    if (index < this.kbThumbnailIndex ||
                        (index === this.kbThumbnailIndex &&
                            index === this.thumbnails.length))
                    {
                        --this.kbThumbnailIndex;
                    }

                    this.queueUpdateStates();
                    return GLib.SOURCE_REMOVE;
                });
            });

        if (this.pendingScaleUpdate) {
            this._animateThumbnailScale();
            this.pendingScaleUpdate = false;
        }

        // Wait until that's done
        if (this.thumbnail_scale != this.targetScale || this.stateCounts[ThumbnailState.COLLAPSING] > 0)
            return;

        // And then slide in any new thumbnails
        this.iterateStateThumbnails(ThumbnailState.NEW,
            function(thumbnail) {
                this.setThumbnailState(thumbnail, ThumbnailState.ANIMATING_IN);
                thumbnail.ease_property('slide-position', 0, {
                    duration: SLIDE_ANIMATION_TIME,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    onComplete: () => {
                        this.setThumbnailState(thumbnail, ThumbnailState.NORMAL);
                    },
                });
            });

        this.iterateStateThumbnails(ThumbnailState.NORMAL, function(thumbnail) {
            thumbnail.refresh();
        });
        // Skip the keyboard-selected-state update (which triggers
        // overviewModeOn on the active thumbnail) if expo is hiding or
        // being cancelled mid-show. Otherwise this deferred later_add
        // callback can reapply the spread layout right before tear-down.
        if (!Main.expo._hideInProgress) {
            this.thumbnails[this.kbThumbnailIndex].showKeyboardSelectedState(true);
            if (!this.isShowingModalDialog()) {
                // we may inadvertently have lost keyboard focus during the reshuffling
                global.stage.set_key_focus(this);
            }
        }
    }

    isShowingModalDialog() {
        // the normal value is 1 while Expo is active
        return Main.modalCount > 1;
    }

    queueUpdateStates() {
        if (this.stateUpdateQueued)
            return;

        this._updateStatesLaterId = Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
            this._updateStatesLaterId = 0;
            this.updateStates();
            return GLib.SOURCE_REMOVE;
        });

        this.stateUpdateQueued = true;
    }

    getNumberOfColumnsAndRows(nWorkspaces) {
        let asGrid  = global.settings.get_boolean("workspace-expo-view-as-grid");
        let nColumns = asGrid ? Math.ceil(Math.sqrt(nWorkspaces)) : nWorkspaces;
        let nRows = Math.ceil(nWorkspaces/nColumns);

        // in case of a very wide screen, we can try and optimize the screen
        // utilization by switching the columns and rows, but only if there's a
        // big difference. If the user doesn't want a grid we are even more conservative.
        let divisor = 1.25;
        let screenRatio = global.screen_width / global.screen_height;
        let boxRatio = this._allocBox ? (this._allocBox.x2 - this._allocBox.x1) / (this._allocBox.y2 - this._allocBox.y1) : 1.6;

        if (nWorkspaces <= Math.floor(screenRatio)) {
            return [1, nWorkspaces];
        } else if (!asGrid || (screenRatio / divisor) <= boxRatio) {
            return [nColumns, nRows];
        } else {
            return [nRows, nColumns];
        }
    }

    vfunc_get_preferred_height(forWidth) {
        // See comment about this.background in _init()
        let themeNode = this.background.get_theme_node();

        // Note that for getPreferredWidth/Height we cheat a bit and skip propagating
        // the size request to our children because we know how big they are and know
        // that the actors aren't depending on the virtual functions being called.

        if (this.thumbnails.length == 0)
            return [0, 0];

        return themeNode.adjust_preferred_height(400,
                                              Main.layoutManager.primaryMonitor.height);
    }

    vfunc_get_preferred_width(forHeight) {
        // See comment about this.background in _init()
        let themeNode = this.background.get_theme_node();

        if (this.thumbnails.length == 0)
            return [0, 0];

        // We don't animate our preferred width, which is always reported according
        // to the actual number of current workspaces, we just animate within that

        let spacing = this.get_theme_node().get_length('spacing');
        let nWorkspaces = global.workspace_manager.n_workspaces;
        let totalSpacing = (nWorkspaces - 1) * spacing;

        return themeNode.adjust_preferred_width(totalSpacing, Main.layoutManager.primaryMonitor.width);
    }

    vfunc_allocate(box, flags) {
        this.set_allocation(box, flags);
        this._allocBox = box;
        let rtl = (St.Widget.get_default_direction () == St.TextDirection.RTL);

        if (this.thumbnails.length == 0)
            return;

        let portholeWidth = this.porthole.width;
        let portholeHeight = this.porthole.height;
        let spacing = this.get_theme_node().get_length('spacing');

        // We must find out every setting that may affect the height of
        // the workspace title:
        let firstThumbnailTitleThemeNode = this.thumbnails[0].title.get_theme_node();
        let thTitleHeight = firstThumbnailTitleThemeNode.get_length('height');
        let thTitleTopPadding = firstThumbnailTitleThemeNode.get_padding(St.Side.TOP);
        let thTitleBottomPadding = firstThumbnailTitleThemeNode.get_padding(St.Side.BOTTOM);
        let thTitleMargin = thTitleBottomPadding;
        let thTitleBorderHeight = firstThumbnailTitleThemeNode.get_border_width(St.Side.BOTTOM) * 2;
        let extraHeight = thTitleHeight + thTitleTopPadding + thTitleBottomPadding + thTitleMargin + thTitleBorderHeight;

        // Compute the scale we'll need once everything is updated
        let nWorkspaces = this.thumbnails.length;
        let [nColumns, nRows] = this.getNumberOfColumnsAndRows(nWorkspaces);
        let totalSpacingX = (nColumns - 1) * spacing;
        let availX = (box.x2 - box.x1) - totalSpacingX - (spacing * 2) ;
        let availY = (box.y2 - box.y1) - 2 * spacing - nRows * extraHeight - (nRows - 1) * thTitleMargin;
        let screen = (box.x2 - box.x1);

        let newScaleX = (availX / nColumns) / portholeWidth;
        let newScaleY = (availY / nRows) / portholeHeight;
        let newScale = Math.min(newScaleX, newScaleY, MAX_THUMBNAIL_SCALE);

        if (newScale != this.targetScale) {
            if (this.targetScale > 0) {
                // We defer the scale animation because we need to observe the ordering
                // in queueUpdateStates - if workspaces have been removed we need to slide them
                // out as the first thing.
                this.targetScale = newScale;
                this.pendingScaleUpdate = true;
            } else {
                this.targetScale = newScale;
                this.thumbnail_scale = newScale;
            }

            this.queueUpdateStates();
        }

        let thumbnailHeight = Math.round(portholeHeight * this.thumbnail_scale);
        let thumbnailWidth = Math.round(portholeWidth * this.thumbnail_scale);

        let childBox = new Clutter.ActorBox();

        let calcPaddingX = function(nCols) {
            let neededX = (thumbnailWidth * nCols) + (spacing * (nCols + 1));
            let extraSpaceX = (box.x2 - box.x1) - neededX;
            return spacing + extraSpaceX/2;
        };

        // The background is horizontally restricted to correspond to the current thumbnail size
        // but otherwise covers the entire allocation
        childBox.x1 = box.x1;
        childBox.x2 = box.x2;

        childBox.y1 = box.y1;
        childBox.y2 = box.y2 + this.thumbnails[0].title.height;

        this.background.allocate(childBox, flags);

        let x;
        let y = spacing + Math.floor((availY - nRows * thumbnailHeight) / 2);
        for (let i = 0; i < this.thumbnails.length; i++) {
            let column = i % nColumns;
            let row = Math.floor(i / nColumns);
            let cItemsInRow = Math.min(this.thumbnails.length - (row * nColumns), nColumns);
            x = column > 0 ? x : calcPaddingX(cItemsInRow);
            let rowMultiplier = row + 1;

            let thumbnail = this.thumbnails[i];

            // We might end up with thumbnailHeight being something like 99.33
            // pixels. To make this work and not end up with a gap at the bottom,
            // we need some thumbnails to be 99 pixels and some 100 pixels height;
            // we compute an actual scale separately for each thumbnail.
            let x1 = Math.round(x + (thumbnailWidth * thumbnail.slide_position / 2));
            let x2 = Math.round(x + thumbnailWidth);

            let y1, y2;

            y1 = y;
            y2 = y1 + thumbnailHeight;

            // Allocating a scaled actor is funny - x1/y1 correspond to the origin
            // of the actor, but x2/y2 are increased by the *unscaled* size.
            childBox.x1 = x1;
            childBox.x2 = x1 + portholeWidth;
            childBox.y1 = y1;
            childBox.y2 = y1 + portholeHeight;

            let scale = this.thumbnail_scale * (1 - thumbnail.slide_position);
            thumbnail.set_scale(scale, scale);
            thumbnail.allocate(childBox, flags);

            let framethemeNode = thumbnail.frame.get_theme_node();
            let borderWidth = framethemeNode.get_border_width(St.Side.BOTTOM);
            childBox.x1 = x1 - borderWidth;
            childBox.x2 = x2 + borderWidth;
            childBox.y1 = y1 - borderWidth;
            childBox.y2 = y2 + borderWidth;
            thumbnail.frame.set_scale((1 - thumbnail.slide_position), (1 - thumbnail.slide_position));
            thumbnail.frame.allocate(childBox, flags);

            let thumbnailx = Math.round(x + (thumbnailWidth * thumbnail.slide_position / 2));
            childBox.x1 = Math.max(thumbnailx, thumbnailx + Math.round(thumbnailWidth/2) - Math.round(thumbnail.title.width/2));
            childBox.x2 = Math.min(thumbnailx + thumbnailWidth, childBox.x1 + thumbnail.title.width);
            childBox.y1 = y + thumbnailHeight + thTitleMargin;
            childBox.y2 = childBox.y1 + thumbnail.title.height;
            thumbnail.title.allocate(childBox, flags);

            x += thumbnailWidth + spacing;
            y += (i + 1) % nColumns > 0 ? 0 : thumbnailHeight + extraHeight + thTitleMargin;
        }
        x = 0;
        y = 0;

        let buttonWidth = this.button.get_theme_node().get_length('width');
        let buttonHeight = this.button.get_theme_node().get_length('height');
        let buttonOverlap = this.button.get_theme_node().get_length('-cinnamon-close-overlap');

        if (this.lastHovered && !this.lastHovered.doomed){
            x = this.lastHovered.allocation.x1 + ((this.lastHovered.allocation.x2 - this.lastHovered.allocation.x1) * this.lastHovered.get_scale()[0]) - buttonOverlap;
            y = this.lastHovered.allocation.y1 - (buttonHeight - buttonOverlap);
        } else {
            this.button.hide();
        }

        childBox.x1 = x;
        childBox.x2 = childBox.x1 + buttonWidth;
        childBox.y1 = y;
        childBox.y2 = childBox.y1 + buttonHeight;

        this.button.allocate(childBox, flags);

        this.emit('allocated');
    }

    activeWorkspaceChanged(wm, from, to, direction) {
        this.thumbnails[this.kbThumbnailIndex].showKeyboardSelectedState(false);
        this.kbThumbnailIndex = global.workspace_manager.get_active_workspace_index();
        this.thumbnails[this.kbThumbnailIndex].showKeyboardSelectedState(true);

        let thumbnail;
        let activeWorkspace = global.workspace_manager.get_active_workspace();
        for (let i = 0; i < this.thumbnails.length; i++) {
            if (this.thumbnails[i].metaWorkspace == activeWorkspace) {
                thumbnail = this.thumbnails[i];
                break;
            }
        }

        if (this.lastActiveWorkspace) {
            this.lastActiveWorkspace.setActive(false);
        }
        thumbnail.setActive(true);
        this.lastActiveWorkspace = thumbnail;
    }

});
