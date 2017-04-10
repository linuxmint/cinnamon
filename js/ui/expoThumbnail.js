// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const St = imports.gi.St;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const ModalDialog = imports.ui.modalDialog;
const Tooltips = imports.ui.tooltips;
const PointerTracker = imports.misc.pointerTracker;
const SignalManager = imports.misc.signalManager;
const GridNavigator = imports.misc.gridNavigator;
const WindowUtils = imports.misc.windowUtils;

// The maximum size of a thumbnail is 1/8 the width and height of the screen
let MAX_THUMBNAIL_SCALE = 0.9;

const POINTER_LEAVE_MILLISECONDS_GRACE = 500;
const POINTER_ENTER_MILLISECONDS_GRACE = 150;
const RESCALE_ANIMATION_TIME = 0.2;
const SLIDE_ANIMATION_TIME = 0.3;
const INACTIVE_OPACITY = 120;
const REARRANGE_TIME_ON = 0.1;
const REARRANGE_TIME_OFF = 0.3;
const ICON_OPACITY = Math.round(255 * 0.9);
const ICON_SIZE = 128;
const ICON_OFFSET = -5;

const DRAGGING_WINDOW_OPACITY = Math.round(255 * 0.8);
const WINDOW_DND_SIZE = 256;

const DEMANDS_ATTENTION_CLASS_NAME = "window-list-item-demands-attention";

// persistent throughout session
var forceOverviewMode = false;

function ExpoWindowClone() {
    this._init.apply(this, arguments);
}

ExpoWindowClone.prototype = {
    _init : function(realWindow) {
        this.actor = new Clutter.Group({reactive: true});
        this.actor._delegate = this;
        this.realWindow = realWindow;
        this.metaWindow = realWindow.meta_window;
        this.refreshClone();
        this._signalManager = new SignalManager.SignalManager(this);

        this._signalManager.connect(this.realWindow, 'size-changed', this.onSizeChanged);
        this._signalManager.connect(this.metaWindow, 'workspace-changed', function(w, oldws) {
            this.emit('workspace-changed', oldws);
        })

        this.onPositionChanged();
        this.onSizeChanged();

        let lastButtonPressActor = null;
        let lastButtonPressTime = 0;
        this.actor.connect('button-press-event', Lang.bind(this, function(actor, event) {
            lastButtonPressActor = actor;
            lastButtonPressTime = event.get_time();
        }));
        this.actor.connect('button-release-event', Lang.bind(this, function(actor, event) {
            if (lastButtonPressActor===actor && (event.get_time()-lastButtonPressTime) < 500) {
                this.onButtonRelease.apply(this, arguments);
            }
            return true;
        }));

        let pointerTracker = new PointerTracker.PointerTracker();
        this.actor.connect('motion-event', Lang.bind(this, function (actor, event) {
            if (pointerTracker.hasMoved()) {
                this.emit('hovering', true);
            }
            return false;
        }));
        this.actor.connect('leave-event', Lang.bind(this, function (actor, event) {
            if (pointerTracker.hasMoved()) {
                this.emit('hovering', false);
            }
            return false;
        }));
        this.actor.connect('destroy', Lang.bind(this, this.onDestroy));

        this._draggable = DND.makeDraggable(this.actor,
                                            { restoreOnSuccess: false,
                                              dragActorMaxSize: WINDOW_DND_SIZE,
                                              dragActorOpacity: DRAGGING_WINDOW_OPACITY});
        this._draggable.connect('drag-begin', Lang.bind(this, this.onDragBegin));
        this._draggable.connect('drag-end', Lang.bind(this, this.onDragEnd));
        this._draggable.connect('drag-cancelled', Lang.bind(this, this.onDragCancelled));
        this.inDrag = false;
        this.dragCancelled = false;

        this.icon = new St.Widget();
        this.actor.add_actor(this.icon);
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
            iconActor = app.create_icon_texture(ICON_SIZE);
        }
        if (!iconActor) {
            iconActor = new St.Icon({ icon_name: 'applications-other',
                                 icon_type: St.IconType.FULLCOLOR,
                                 icon_size: ICON_SIZE });
        }
        this.icon.add_actor(iconActor);
        iconActor.opacity = ICON_OPACITY;

        let attentionId = global.display.connect('window-demands-attention', Lang.bind(this, this.onWindowDemandsAttention));
        let urgentId = global.display.connect('window-marked-urgent', Lang.bind(this, this.onWindowDemandsAttention));
        this.disconnectAttentionSignals = function() {
            global.display.disconnect(attentionId);
            global.display.disconnect(urgentId);
        };
        this.urgencyTimeout = 0;
    },

    refreshClone: function(withTransients) {
        if (this.clone) {this.clone.destroy();}
        this.clone = new St.Widget({ reactive: false });
        this.actor.add_actor(this.clone);
        let [pwidth, pheight] = [this.realWindow.width, this.realWindow.height];
        let clones = WindowUtils.createWindowClone(this.metaWindow, 0, 0, withTransients);
        for (let i in clones) {
            let clone = clones[i].actor;
            this.clone.add_actor(clone);
            let [width, height] = clone.get_size();
            clone.set_position(Math.round((pwidth - width) / 2), Math.round((pheight - height) / 2));
        }
    },

    killUrgencyTimeout: function() {
        if (this.urgencyTimeout != 0) {
            Mainloop.source_remove(this.urgencyTimeout);
            this.urgencyTimeout = 0;
        }
    },

    showUrgencyState: function(params) {
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
            this.urgencyTimeout = Mainloop.timeout_add(750, Lang.bind(this, function() {
                this.showUrgencyState({showUrgent:!force, reps: params.reps - (force ? 0 : 1)});
                this.urgencyTimeout = 0;
            }));
        }
    },

    demandAttention: function() {
        this.demanding_attention = true;
        this.showUrgencyState({showUrgent:true, reps: 50});
        this.emit('demanding-attention');
    },

    onWindowDemandsAttention: function(display, metaWindow) {
        if (metaWindow != this.metaWindow) {return;}
        this.demandAttention();
    },

    setStackAbove: function (actor) {
        if (actor.get_parent() !== this.actor.get_parent()) {
            return;
        }
        this.stackAbove = actor;
        if (this.stackAbove == null)
            this.actor.lower_bottom();
        else
            this.actor.raise(this.stackAbove);
    },

    destroy: function () {
        this.killUrgencyTimeout();
        this.disconnectAttentionSignals();
        this.actor.destroy();
        this.icon.destroy();
    },

    onPositionChanged: function() {
        this.actor.set_position(this.origX = this.realWindow.x, this.origY = this.realWindow.y);
        this.actor.set_size(this.realWindow.width, this.realWindow.height);
    },

    onSizeChanged: function() {
        this.actor.set_size(this.realWindow.width, this.realWindow.height);
    },

    onDestroy: function() {
        this._signalManager.disconnectAllSignals();
        this.actor._delegate = null;

        if (this.inDrag) {
            this.inDrag = false;
            this.emit('drag-end');
        }

        this.disconnectAll();
    },

    onButtonRelease : function (actor, event) {
        if ((Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK) ||
            (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON3_MASK))
        {
            this.emit('selected', event.get_time());
        }
        if ((Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON2_MASK))
        {
            this.emit('middle-button-release', event.get_time());
        }
        return true;
    },

    onDragBegin : function (draggable, time) {
        this.inDrag = true;
        this.dragCancelled = false;
        this.emit('drag-begin');
    },

    onDragCancelled : function (draggable, time) {
        this.dragCancelled = true;
        this.emit('drag-cancelled');
    },

    onDragEnd : function (draggable, time, snapback) {
        this.inDrag = false;
        this.emit('drag-end');
    }
};
Signals.addSignalMethods(ExpoWindowClone.prototype);


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
function ExpoWorkspaceThumbnail(metaWorkspace, box) {
    this._init(metaWorkspace, box);
}

ExpoWorkspaceThumbnail.prototype = {
    _init : function(metaWorkspace, box) {
        this.box = box;
        this.metaWorkspace = metaWorkspace;

        this.overviewMode = false;

        this.frame = new St.Widget({ clip_to_allocation: true,
                                     style_class: 'expo-workspace-thumbnail-frame' });
        this.actor = new St.Widget({ reactive: true,
                                     clip_to_allocation: true,
                                     style_class: 'workspace-thumbnail' });
        this.actor._delegate = this;
        this.actor.set_size(global.screen_width, global.screen_height);

        this.contents = new Clutter.Group();
        this.actor.add_actor(this.contents);

        this.actor.connect('destroy', Lang.bind(this, this.onDestroy));

        let lastButtonPressTimeStamp = 0;
        let lastButtonPressActor = null;
        this.actor.connect('button-press-event', Lang.bind(this, function(actor, event) {
                lastButtonPressTimeStamp = event.get_time();
                lastButtonPressActor = actor;
                return true;
            }));
        this.actor.connect('button-release-event', Lang.bind(this,
            function(actor, event) {
                if (lastButtonPressActor !== actor) {
                    return true;
                }
                let timeElapsed = event.get_time() - lastButtonPressTimeStamp;
                // A long time elapsed is probably due to a failed dnd attempt,
                // or some other mishap, so we'll ignore those.
                if (timeElapsed > 500) {
                    return true;
                }
                let evstate = Cinnamon.get_event_state(event);
                if ((evstate & Clutter.ModifierType.BUTTON1_MASK) ||
                        (evstate & Clutter.ModifierType.BUTTON3_MASK))
                {
                   this.activate(null, event.get_time());
                    return true;
                } else if (evstate & Clutter.ModifierType.BUTTON2_MASK) {
                    this.remove();
                    return true;                
                }
                return false;
            }));

        this.actor.connect('scroll-event', Lang.bind(this, this.onScrollEvent));
        
        this.title = new St.Entry({ style_class: 'expo-workspaces-name-entry',                                     
                                     track_hover: true,
                                     can_focus: true });                
        this.title._spacing = 0; 
        this.titleText = this.title.clutter_text;        
        this.titleText.connect('key-press-event', Lang.bind(this, this.onTitleKeyPressEvent)); 
        this.titleText.connect('key-focus-in', Lang.bind(this, function() {
            this.origTitle = Main.getWorkspaceName(this.metaWorkspace.index());
        })); 
        this.titleText.connect('key-focus-out', Lang.bind(this, function() {
            if (this.doomed) {
                // user probably deleted workspace while editing
                global.stage.set_key_focus(this.box.actor);
                return;
            }
            if (!this.undoTitleEdit) {
                let newName = this.title.get_text().trim();
                if (newName != this.origTitle) {
                    Main.setWorkspaceName(this.metaWorkspace.index(), newName);
                }
            }
            this.title.set_text(Main.getWorkspaceName(this.metaWorkspace.index()));
        })); 
                      
        this.title.set_text(Main.getWorkspaceName(this.metaWorkspace.index()));
        
        this.background = new Clutter.Group();
        this.contents.add_actor(this.background);

        let desktopBackground = Meta.BackgroundActor.new_for_screen(global.screen);
        this.background.add_actor(desktopBackground);

        let backgroundShade = new St.Bin({style_class: 'workspace-overview-background-shade'});
        this.background.add_actor(backgroundShade);
        backgroundShade.set_size(global.screen_width, global.screen_height);

        this.shader = new St.Bin();
        this.shader.set_style('background-color: black;');
        this.actor.add_actor(this.shader);
        this.shader.set_size(global.screen_width, global.screen_height);

        this.shader.opacity = INACTIVE_OPACITY;

        if (metaWorkspace == global.screen.get_active_workspace())
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

        let windowAddedId = this.metaWorkspace.connect('window-added',
                                                          Lang.bind(this, this.windowAdded));
        let windowRemovedId = this.metaWorkspace.connect('window-removed',
                                                           Lang.bind(this, this.windowRemoved));
        let windowEnteredMonitorId = global.screen.connect('window-entered-monitor',
            Lang.bind(this, this.windowEnteredMonitor));
        let windowLeftMonitorId = global.screen.connect('window-left-monitor',
            Lang.bind(this, this.windowLeftMonitor));

        let setOverviewModeId = box.connect('set-overview-mode', Lang.bind(this, function(box, turnOn) {
            this.setOverviewMode(turnOn);
            this.hovering = false;
        }));
        let stickyAddedId = box.connect('sticky-detected', Lang.bind(this, function(box, metaWindow) {
            this.doAddWindow(metaWindow);
        }));
        let restackedNotifyId = global.screen.connect('restacked', Lang.bind(this, this.onRestack));

        this.disconnectOtherSignals = function() {
            global.screen.disconnect(restackedNotifyId);
            this.box.disconnect(setOverviewModeId);
            this.box.disconnect(stickyAddedId);
            this.metaWorkspace.disconnect(windowAddedId);
            this.metaWorkspace.disconnect(windowRemovedId);
            global.screen.disconnect(windowEnteredMonitorId);
            global.screen.disconnect(windowLeftMonitorId);
        };
        
        this.isActive = false;
        this.state = ThumbnailState.NORMAL;
        this.restack();
        this._slidePosition = 0; // Fully slid in
        this.setOverviewMode(forceOverviewMode);
    },

    setOverviewMode: function(turnOn) {
        if (turnOn) {this.overviewModeOn();}
        else {this.overviewModeOff();}
    },

    refresh: function() {
        this.refreshTitle();
        this.resetCloneHover();
        this.setOverviewMode(this.overviewMode);
    },

    onRestack: function() {
        this.restack();
        this.refresh();
    },

    restack: function(force) {
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
        }

        this.syncStacking(this.stackIndices);
    },

    setActive: function(isActive) {
        this.isActive = isActive;
        this.frame.name = isActive ? 'active' : '';
    },

    refreshTitle: function() {
        if (!this.doomed) { // better safe than sorry
            this.title.set_text(Main.getWorkspaceName(this.metaWorkspace.index()));
        }
    },
    
    onTitleKeyPressEvent: function(actor, event) {
        this.undoTitleEdit = false;
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.Return || symbol === Clutter.Escape) {
            if (symbol === Clutter.Escape) {
                this.undoTitleEdit = true;
            }
            global.stage.set_key_focus(this.actor);
            return true;
        }
        return false;     
    },
   
    activateWorkspace: function() {
        if (this.metaWorkspace != global.screen.get_active_workspace())
            this.metaWorkspace.activate(global.get_current_time());
        Main.expo.hide();
    },
    
    showKeyboardSelectedState: function(selected) {
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
    },
    
    lookupIndex: function (metaWindow) {
        for (let i = 0; i < this.windows.length; i++) {
            if (this.windows[i].metaWindow == metaWindow) {
                return i;
            }
        }
        return -1;
    },

    syncStacking: function(stackIndices) {
        this.windows.sort(Lang.bind(this, function (a, b) {
            let minimizedDiff = function(a, b) {
                let minimizedA = a.metaWindow.minimized ? -1 : 0;
                let minimizedB = b.metaWindow.minimized ? -1 : 0;
                return minimizedA - minimizedB;
            };
            let noOverviewDiff = Lang.bind(this, function(a, b) {
                let noOverviewA = !this.isOverviewWindow(a.metaWindow) ? -1 : 0;
                let noOverviewB = !this.isOverviewWindow(b.metaWindow) ? -1 : 0;
                return noOverviewA - noOverviewB;
            });
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
        }));

        for (let i = 0; i < this.windows.length; i++) {
            let clone = this.windows[i];
            let metaWindow = clone.metaWindow;
            if (i == 0) {
                clone.setStackAbove(this.background);
            } else {
                let previousClone = this.windows[i - 1];
                clone.setStackAbove(previousClone.actor);
            }
        }
    },

    set slidePosition(slidePosition) {
        this._slidePosition = slidePosition;
        this.actor.queue_relayout();
    },

    get slidePosition() {
        return this._slidePosition;
    },

    doRemoveWindow : function(metaWin) {
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
    },

    doAddWindow : function(metaWin) {
        let win = metaWin.get_compositor_private();
        if (!win) {
            // Newly-created windows are added to a workspace before
            // the compositor finds out about them...
            Mainloop.idle_add(Lang.bind(this, function () {
                if (this.windows /*will be null if we're closing down*/ &&
                    metaWin.get_compositor_private())
                {
                    this.doAddWindow(metaWin);
                }
                return false;
            }));
            return;
        }

        // We might have the window in our list already if it was on all workspaces and
        // now was moved to this workspace
        if (this.lookupIndex (metaWin) != -1)
            return;

        if (!this.isMyWindow(win) || !this.isExpoWindow(win))
            return;

        let clone = this.addWindowClone(win); 

        this.overviewModeOn();
    },

    windowAdded : function(metaWorkspace, metaWin) {
        this.doAddWindow(metaWin);
        this.restack();
    },

    windowRemoved : function(metaWorkspace, metaWin) {
        this.doRemoveWindow(metaWin);
    },

    windowEnteredMonitor : function(metaScreen, monitorIndex, metaWin) {
        // important if workspaces-only-on-primary is in effect
        this.doAddWindow(metaWin);
    },

    windowLeftMonitor : function(metaScreen, monitorIndex, metaWin) {
        // important if workspaces-only-on-primary is in effect
        this.doRemoveWindow(metaWin);
    },

    destroy : function() {            
        this.actor.destroy();        
        this.frame.destroy();
    },

    onDestroy: function(actor) {
        this.disconnectOtherSignals();
        this.resetCloneHover();
        for (let i = 0; i < this.windows.length; i++) {
            this.windows[i].destroy();
        }
        this.windows = null;
    },

    // Tests if @win belongs to this workspace and monitor
    isMyWindow : function (win) {
        return Main.isWindowActorDisplayedOnWorkspace(win, this.metaWorkspace.index());
    },

    // Tests if @win should be shown in the Expo
    isExpoWindow : function (win) {
        let metaWindow = win.get_meta_window();
        if (metaWindow.is_override_redirect()) {
            return false;
        }
        let type = metaWindow.get_window_type();
        return type !== Meta.WindowType.DESKTOP && type !== Meta.WindowType.DOCK;
    },

    // Tests if @win should be shown in overview mode
    isOverviewWindow : function (metaWindow) {
        return Main.isInteresting(metaWindow);
    },

    // Create a clone of a (non-desktop) window and add it to the window list
    addWindowClone : function(win) {
        let clone = new ExpoWindowClone(win);

        clone.connect('workspace-changed', Lang.bind(this, function() {
            this.doRemoveWindow(clone.metaWindow);
            if (clone.metaWindow.is_on_all_workspaces()) {
                // Muffin appears not to broadcast when a window turns sticky
                this.box.emit('sticky-detected', clone.metaWindow);
            }
        }));
        clone.connect('middle-button-release', Lang.bind(this, function(sender, time) {
            clone.metaWindow.delete(time);
        }));
        clone.connect('hovering', Lang.bind(this, this.onCloneHover));
        clone.connect('demanding-attention', Lang.bind(this, function() {this.overviewModeOn();}));
        clone.connect('selected', Lang.bind(this, this.activate));
        clone.connect('remove-workspace',  Lang.bind(this, this.remove));
        clone.connect('drag-begin', Lang.bind(this, function(clone) {
            this.box.emit('drag-begin');
            this.resetCloneHover();
        }));
        clone.connect('drag-end', Lang.bind(this, function(clone) {
            this.box.emit('drag-end');
            if (clone.dragCancelled) {
                // stacking order may have been disturbed
                this.restack();
            }
            this.overviewModeOn();
        }));
        this.contents.add_actor(clone.actor);

        if (this.windows.length == 0)
            clone.setStackAbove(this.background);
        else
            clone.setStackAbove(this.windows[this.windows.length - 1].actor);

        this.windows.push(clone);

        return clone;
    },

    resetCloneHover : function () {
        this.lastHoveredClone = null;
        if (this.tooltip) {
            this.tooltip.destroy();
            this.tooltip = null;
        }
    },

    onCloneHover : function (clone, hovering) {
        if (!this.overviewMode) {
            this.resetCloneHover();
            return;
        }
        if (hovering && clone !== this.lastHoveredClone) {
            if (this.buttonTimeoutId) {Mainloop.source_remove(this.buttonTimeoutId);}
            this.buttonTimeoutId = Mainloop.idle_add(Lang.bind(this,function() {
                this.buttonTimeoutId = null;
                if (!this.windows) {return;} /* being destroyed */
                let [x, y, mask] = global.get_pointer();
                let target = this.contents.get_stage().get_actor_at_pos(Clutter.PickMode.REACTIVE, x, y);
                if (target !== clone.actor) {
                    this.resetCloneHover();
                    return;
                }
                if (this.tooltip) {
                    this.tooltip.destroy();
                }
                this.tooltip = new Tooltips.Tooltip(clone.actor, clone.metaWindow.title);
            }));
            this.lastHoveredClone = clone;
        }
    },

    overviewModeOn : function () {
        if (!this.box.scale) {return;}
        this.overviewMode = true;
        this.resetCloneHover();

        let windows = [];
        this.windows.forEach(function(window) {
            if (this.isOverviewWindow(window.metaWindow)) {
                windows.push(window);
            }
            else {
                Tweener.addTween(window.actor, {scale_x: 0, scale_y: 0, time: REARRANGE_TIME_ON, transition: 'easeOutQuad', onComplete: window.actor.hide});
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
                let iconScale = (0.25/this.box.scale/scale);
                window.icon.set_scale(iconScale, iconScale);
                let [iconX, iconY] = [ICON_OFFSET / this.box.scale/scale, ICON_OFFSET / this.box.scale/scale];
                window.icon.set_position(iconX, iconY);
                Tweener.addTween(window.actor, {
                    x: x, y: y, scale_x: scale, scale_y: scale,
                    opacity: 255,
                    time: REARRANGE_TIME_ON, transition: 'easeOutQuad',
                    onComplete: function() {
                        window.actor.show();
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
    },

    overviewModeOff : function(force, override) {
        if (!this.box.scale) {return;}
        this.resetCloneHover();
        if (this.overviewMode === false && !force) {return;}
        if (forceOverviewMode && !override) {return;}
        
        this.overviewMode = false;
        const iconSpacing = ICON_SIZE/4;
        let rearrangeTime = force ? REARRANGE_TIME_OFF/2 : REARRANGE_TIME_OFF;

        Main.layoutManager.monitors.forEach(function(monitor, monitorIndex) {
            let iconCount = 0;
            this.windows.filter(function(window) {
                return monitorIndex === window.metaWindow.get_monitor();
            },this).forEach(function(window) {
                if (window.inDrag) {return;}
                
                window.refreshClone(false);
                window.showUrgencyState();
                window.icon.hide();
                window.actor.show();
                Tweener.addTween(window.actor, {
                    x: window.origX,
                    y: window.origY,
                    scale_x: 1, scale_y: 1,
                    opacity: window.metaWindow.showing_on_its_workspace() ? 255 : 127,
                    time: rearrangeTime, transition: 'easeOutQuad'
                });
            }, this);
        }, this);
    },

    onScrollEvent: function (actor, event) {
        if (Main.expo.animationInProgress)
            return;

        switch ( event.get_scroll_direction() ) {
        case Clutter.ScrollDirection.UP:
            Main.wm.actionMoveWorkspaceLeft();
            break;
        case Clutter.ScrollDirection.DOWN:
            Main.wm.actionMoveWorkspaceRight();
            break;
        }
    },

    activate : function (clone, time) {
        if (this.state > ThumbnailState.NORMAL)
            return;

        if (clone && clone.metaWindow != null){
            Main.activateWindow(clone.metaWindow, time, this.metaWorkspace.index());
        }
        if (this.metaWorkspace != global.screen.get_active_workspace())
            this.metaWorkspace.activate(time);
        Main.expo.hide();
    },

    shade : function (force){
        if (!this.isSelected || force)
            Tweener.addTween(this.shader, {opacity: INACTIVE_OPACITY, time: SLIDE_ANIMATION_TIME, transition: 'easeOutQuad'});    
    },

    highlight : function (){
        Tweener.addTween(this.shader, {opacity: 0, time: SLIDE_ANIMATION_TIME, transition: 'easeOutQuad'});    
    },

    remove : function (){
        if (this.doomed) {
            // this workspace is already being removed
            return;
        }
        if (global.screen.n_workspaces <= 1) {
            return;
        }
        let removeAction = Lang.bind(this, function() {
            this.doomed = true;
            Main._removeWorkspace(this.metaWorkspace);
        });
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
    },

    coordinateToMonitor : function(x, y) {
        let indexOne = 0;
        Main.layoutManager.monitors.forEach(function(monitor, mindex) {
            let [xX, yY] = [x - monitor.x, y - monitor.y];
            indexOne = indexOne || (xX >= 0 && xX < monitor.width && yY > 0 && yY < monitor.height ? mindex + 1 : 0);
        }, this);
        return indexOne - 1;
    },

    // Draggable target interface
    handleDragOver : function(source, actor, x, y, time) {
        this.emit('drag-over');
        if (!this.overviewMode) {
            this.overviewModeOn();
        }
        return this.handleDragOverOrDrop(false, source, actor, x, y, time);
    },

    handleDragOverOrDrop : function(dropping, source, actor, x, y, time) {
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
                    metaWindow.change_workspace(this.metaWorkspace, false, time);
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
                    metaWindow.change_workspace(this.metaWorkspace, false, time);
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
    },

    acceptDrop : function(source, actor, x, y, time) {
        if (this.handleDragOverOrDrop(false, source, actor, x, y, time) != DND.DragMotionResult.CONTINUE) {
            if (this.handleDragOverOrDrop(true, source, actor, x, y, time) != DND.DragMotionResult.CONTINUE) {
                this.restack(true);
                this.overviewModeOn();
                return true;
            }
        }
        return false;
    }
};

Signals.addSignalMethods(ExpoWorkspaceThumbnail.prototype);

function ExpoThumbnailsBox() {
    this._init();
}

ExpoThumbnailsBox.prototype = {
    _init: function() {
        this.actor = new Cinnamon.GenericContainer({ style_class: 'workspace-thumbnails',
                                                   reactive: true,
                                                  request_mode: Clutter.RequestMode.WIDTH_FOR_HEIGHT });
        this.actor.connect('get-preferred-width', Lang.bind(this, this.getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this.getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this.allocate));

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
        this.actor.add_actor(this.background);
        this.background.handleDragOver = function(source, actor, x, y, time) {
            return source.metaWindow && !source.metaWindow.is_on_all_workspaces() ?
                DND.DragMotionResult.MOVE_DROP : DND.DragMotionResult.CONTINUE;
        };
        this.background.acceptDrop = Lang.bind(this, function(source, actor, x, y, time) {
            if (this.background.handleDragOver.apply(this, arguments) ===  DND.DragMotionResult.MOVE_DROP) {
                let draggable = source._draggable;
                actor.get_parent().remove_actor(actor);
                draggable._dragOrigParent.add_actor(actor);
                actor.opacity = draggable._dragOrigOpacity;
                source.metaWindow.stick();
                return true;
            }
            return false;
        });
        this.background._delegate = this.background;

        this.button = new St.Button({ style_class: 'workspace-close-button' });
        this.actor.add_actor(this.button);
        
        this.button.connect('enter-event', Lang.bind(this, function () {this.button.show();}));
        this.button.connect('leave-event', Lang.bind(this, function () {this.button.hide();}));
        this.button.connect('clicked', Lang.bind(this, function () { this.lastHovered.remove(); this.button.hide();}));
        this.button.hide();
                
        this.actor.connect('scroll-event', this.onScrollEvent);

        this.targetScale = 0;
        this._scale = 0;
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

        this.kbThumbnailIndex = global.screen.get_active_workspace_index();
        
        // apparently we get no direct call to show the initial
        // view, so we must force an explicit overviewMode On/Off display
        // after it has been allocated
        let allocId = this.connect('allocated', Lang.bind(this, function() {
            this.disconnect(allocId);
            Mainloop.timeout_add(0, Lang.bind(this, function() {
                this.emit('set-overview-mode', forceOverviewMode === 1);
                this.thumbnails[this.kbThumbnailIndex].showKeyboardSelectedState(true);
            }));
        }));

        this.toggleGlobalOverviewMode = function() {
            forceOverviewMode = (forceOverviewMode + 1) % 2;
            this.emit('set-overview-mode', forceOverviewMode === 1);
        };
        this.actor.connect('button-release-event', Lang.bind(this, function(actor, event) {
            if (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON2_MASK) {
                this.toggleGlobalOverviewMode();
            }
        }));
    },

    show: function() {
        this.switchWorkspaceNotifyId =
            global.window_manager.connect('switch-workspace',
                                          Lang.bind(this, this.activeWorkspaceChanged));

        this.workspaceAddedId = global.screen.connect('workspace-added', Lang.bind(this, function(screen, index) {
            this.addThumbnails(index, 1);
        }));
        this.workspaceRemovedId = global.screen.connect('workspace-removed', Lang.bind(this, function() {
            this.button.hide();

            // just handling the single workspace removed is not enough
            let removedCount = 0;
            this.thumbnails.forEach(function(thumbnail, i) {
                let metaWorkspace = global.screen.get_workspace_by_index(i-removedCount);
                if (thumbnail.metaWorkspace != metaWorkspace) {
                    ++removedCount;
                    if (thumbnail.state <= ThumbnailState.NORMAL) {
                        this.setThumbnailState(thumbnail, ThumbnailState.REMOVING);
                    }
                }
            }, this);
            this.updateStates();
        }));

        this.stateCounts = {};
        for (let key in ThumbnailState)
            this.stateCounts[ThumbnailState[key]] = 0;

        this.addThumbnails(0, global.screen.n_workspaces);
        this.button.raise_top();

        global.stage.set_key_focus(this.actor);
    },

    handleKeyPressEvent: function(actor, event) {
        let modifiers = Cinnamon.get_event_state(event);
        let ctrlAltMask = Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD1_MASK;
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.Return || symbol === Clutter.KEY_space 
            || symbol === Clutter.KP_Enter)
        {
            this.activateSelectedWorkspace();
            return true;
        }
        if (symbol === Clutter.F2) {
            this.editWorkspaceTitle();
            return true;
        }

        if ((symbol === Clutter.o || symbol === Clutter.O) && modifiers & Clutter.ModifierType.CONTROL_MASK) {
            this.toggleGlobalOverviewMode();
            return true;
        }
        if (modifiers & ctrlAltMask) {
            return false;
        }
        return this.selectNextWorkspace(symbol);
    },

    editWorkspaceTitle: function() {
        this.thumbnails[this.kbThumbnailIndex].title.grab_key_focus();
    },

    activateSelectedWorkspace: function() {
        this.thumbnails[this.kbThumbnailIndex].activateWorkspace();
    },

    removeSelectedWorkspace: function() {
        this.thumbnails[this.kbThumbnailIndex].remove();
    },

    // returns true if symbol was understood, false otherwise
    selectNextWorkspace: function(symbol) {
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
                index = symbol - Clutter.KP_1; // convert Num-pad '1' to index 0, etc
                if (index < 0 || index > 9) {
                    return false; // not handled
                }
            }
            if (index > lastIndex) {
                return true; // handled, but out of range
            }
            this.kbThumbnailIndex = index;
            this.activateSelectedWorkspace();
            Main.wm.showWorkspaceOSD();
            return true; // handled
        }

        if (prevIndex != this.kbThumbnailIndex) {
            this.thumbnails[prevIndex].showKeyboardSelectedState(false);
            this.thumbnails[this.kbThumbnailIndex].showKeyboardSelectedState(true);
        }
        return true; // handled
    },

    hide: function() {
        global.window_manager.disconnect(this.switchWorkspaceNotifyId);
        global.screen.disconnect(this.workspaceAddedId);
        global.screen.disconnect(this.workspaceRemovedId);

        for (let w = 0; w < this.thumbnails.length; w++) {
            this.thumbnails[w].destroy();
        }
        this.thumbnails = [];
    },

    showButton: function(){
        if (global.screen.n_workspaces <= 1)
            return false;
        this.actor.queue_relayout();
        this.button.raise_top();
        this.button.show();
        return true;
    },

    addThumbnails: function(start, count) {
        function isInternalEvent(thumbnail, actor, event) {
            return actor === event.get_related() ||
                thumbnail.actor.contains(event.get_related());
        }
        for (let k = start; k < start + count; k++) {
            let metaWorkspace = global.screen.get_workspace_by_index(k);
            let thumbnail = new ExpoWorkspaceThumbnail(metaWorkspace, this);
                                  
            this.thumbnails.push(thumbnail);
            if (metaWorkspace == global.screen.get_active_workspace()) {
                this.lastActiveWorkspace = thumbnail;
                thumbnail.setActive(true);
            }
            let overviewTimeoutId = null;
            let setOverviewTimeout = function(timeout, func) {
                if (overviewTimeoutId) Mainloop.source_remove(overviewTimeoutId);
                overviewTimeoutId = null;
                if (timeout && func) {
                    overviewTimeoutId = Mainloop.timeout_add(timeout, func);
                }
            };
            thumbnail.actor.connect('destroy', Lang.bind(this, function(actor) {
                setOverviewTimeout(0, function() {
                    overviewTimeoutId = 0;
                });
                this.actor.remove_actor(thumbnail.frame);
                this.actor.remove_actor(actor);
                this.actor.remove_actor(thumbnail.title);
                thumbnail.title.destroy();
                }));
            this.actor.add_actor(thumbnail.frame);
            this.actor.add_actor(thumbnail.actor);
            this.actor.add_actor(thumbnail.title);

            // We use this as a flag to minimize the number of enter and leave events we really
            // have to deal with, since we get many spurious events when the mouse moves
            // over the windows in the thumbnails. Handling each and every event leads to
            // jumping icons if there are minimized windows in a thumbnail.
            thumbnail.hovering = false;

            thumbnail.connect('drag-over', Lang.bind(this, function () {
                thumbnail.highlight();
                if (this.lastHovered && this.lastHovered != thumbnail) {
                    this.lastHovered.shade();
                }
                this.lastHovered = thumbnail;
            }));

            // We want to ignore spurious events caused by animations
            // (when the contents are moving and not the pointer).
            let pointerTracker = new PointerTracker.PointerTracker();
            thumbnail.actor.connect('motion-event', Lang.bind(this, function (actor, event) {
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
                    });
                }
            }));
             
            thumbnail.actor.connect('leave-event', Lang.bind(this, function (actor, event) {
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
                    });
                }
            }));

            if (start > 0) { // not the initial fill
                thumbnail.state = ThumbnailState.NEW;
                thumbnail.slidePosition = 1; // start slid out
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
    },

    set scale(scale) {
        this._scale = scale;
        this.actor.queue_relayout();
    },

    get scale() {
        return this._scale;
    },

    setThumbnailState: function(thumbnail, state) {
        this.stateCounts[thumbnail.state]--;
        thumbnail.state = state;
        this.stateCounts[thumbnail.state]++;
    },

    iterateStateThumbnails: function(state, callback) {
        if (this.stateCounts[state] == 0)
            return;

        for (let i = 0; i < this.thumbnails.length; i++) {
            if (this.thumbnails[i].state == state)
                callback.call(this, this.thumbnails[i]);
        }
    },

    tweenScale: function() {
        Tweener.addTween(this,
                         { scale: this.targetScale,
                           time: RESCALE_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onComplete: this.queueUpdateStates,
                           onCompleteScope: this });
    },

    updateStates: function() {
        this.stateUpdateQueued = false;

        // Then slide out any thumbnails that have been destroyed
        this.iterateStateThumbnails(ThumbnailState.REMOVING,
            function(thumbnail) {
                thumbnail.title.hide();
                this.setThumbnailState(thumbnail, ThumbnailState.ANIMATING_OUT);

                Tweener.addTween(thumbnail,
                                 { slidePosition: 1,
                                   time: SLIDE_ANIMATION_TIME,
                                   transition: 'linear',
                                   onComplete: function() {
                                       this.setThumbnailState(thumbnail, ThumbnailState.ANIMATED_OUT);
                                       this.queueUpdateStates();
                                   },
                                   onCompleteScope: this
                                 });
            });

        // As long as things are sliding out, don't proceed
        if (this.stateCounts[ThumbnailState.ANIMATING_OUT] > 0)
            return;

        // Once that's complete, we can start scaling to the new size and collapse any removed thumbnails
        this.iterateStateThumbnails(ThumbnailState.ANIMATED_OUT,
            function(thumbnail) {
                this.actor.set_skip_paint(thumbnail.actor, true);
                //this.title.set_skip_paint(thumbnail.title, true);
                this.setThumbnailState(thumbnail, ThumbnailState.COLLAPSING);
                Tweener.addTween(thumbnail,
                                 { time: RESCALE_ANIMATION_TIME,
                                   transition: 'easeOutQuad',
                                   onComplete: function() {
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
                                   },
                                   onCompleteScope: this
                                 });
                });

        if (this.pendingScaleUpdate) {
            this.tweenScale();
            this.pendingScaleUpdate = false;
        }

        // Wait until that's done
        if (this._scale != this.targetScale || this.stateCounts[ThumbnailState.COLLAPSING] > 0)
            return;

        // And then slide in any new thumbnails
        this.iterateStateThumbnails(ThumbnailState.NEW,
            function(thumbnail) {
                this.setThumbnailState(thumbnail, ThumbnailState.ANIMATING_IN);
                Tweener.addTween(thumbnail,
                                 { slidePosition: 0,
                                   time: SLIDE_ANIMATION_TIME,
                                   transition: 'easeOutQuad',
                                   onComplete: function() {
                                       this.setThumbnailState(thumbnail, ThumbnailState.NORMAL);
                                   },
                                   onCompleteScope: this
                                 });
            });

        this.iterateStateThumbnails(ThumbnailState.NORMAL, function(thumbnail) {
            thumbnail.refresh();
        });
        this.thumbnails[this.kbThumbnailIndex].showKeyboardSelectedState(true);
        if (!this.isShowingModalDialog()) {
            // we may inadvertently have lost keyboard focus during the reshuffling
            global.stage.set_key_focus(this.actor);
        }
    },

    isShowingModalDialog: function() {
        // the normal value is 1 while Expo is active
        return Main.modalCount > 1;
    },

    queueUpdateStates: function() {
        if (this.stateUpdateQueued)
            return;

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW,
                       Lang.bind(this, this.updateStates));

        this.stateUpdateQueued = true;
    },

    getNumberOfColumnsAndRows: function(nWorkspaces) {
        let asGrid  = global.settings.get_boolean("workspace-expo-view-as-grid");
        let nColumns = asGrid ? Math.ceil(Math.sqrt(nWorkspaces)) : nWorkspaces;
        let nRows = Math.ceil(nWorkspaces/nColumns);
        
        // in case of a very wide screen, we can try and optimize the screen 
        // utilization by switching the columns and rows, but only if there's a
        // big difference. If the user doesn't want a grid we are even more conservative.
        let divisor = 1.25;
        let screenRatio = global.screen_width / global.screen_height;
        let boxRatio = this.box ? (this.box.x2 - this.box.x1) / (this.box.y2 - this.box.y1) : 1.6;

        if (nWorkspaces <= Math.floor(screenRatio)) {
            return [1, nWorkspaces];
        } else if (!asGrid || (screenRatio / divisor) <= boxRatio) {
            return [nColumns, nRows];
        } else {
            return [nRows, nColumns];
        }
    },

    getPreferredHeight: function(actor, forWidth, alloc) {
        // See comment about this.background in _init()
        let themeNode = this.background.get_theme_node();

        forWidth = themeNode.adjust_for_width(forWidth);

        // Note that for getPreferredWidth/Height we cheat a bit and skip propagating
        // the size request to our children because we know how big they are and know
        // that the actors aren't depending on the virtual functions being called.

        if (this.thumbnails.length == 0)
            return;

        let spacing = this.actor.get_theme_node().get_length('spacing');
        let nWorkspaces = global.screen.n_workspaces;
        let totalSpacing = (nWorkspaces - 1) * spacing;

        let avail = Main.layoutManager.primaryMonitor.width - totalSpacing;

        let [nColumns, nRows] = this.getNumberOfColumnsAndRows(nWorkspaces);
        let scale = (avail / nColumns) / this.porthole.width;

        let height = Math.round(this.porthole.height * scale);
        [alloc.min_size, alloc.natural_size] =
            themeNode.adjust_preferred_height(400,
                                              Main.layoutManager.primaryMonitor.height);
    },

    getPreferredWidth: function(actor, forHeight, alloc) {
        // See comment about this.background in _init()
        let themeNode = this.background.get_theme_node();

        if (this.thumbnails.length == 0)
            return;

        // We don't animate our preferred width, which is always reported according
        // to the actual number of current workspaces, we just animate within that

        let spacing = this.actor.get_theme_node().get_length('spacing');
        let nWorkspaces = global.screen.n_workspaces;
        let totalSpacing = (nWorkspaces - 1) * spacing;

        let avail = Main.layoutManager.primaryMonitor.width - totalSpacing;

        let [nColumns, nRows] = this.getNumberOfColumnsAndRows(nWorkspaces);
        let scale = (avail / nColumns) / this.porthole.width;

        let width = Math.round(this.porthole.width * scale);
        let maxWidth = (width) * nWorkspaces;
        [alloc.min_size, alloc.natural_size] =
            themeNode.adjust_preferred_width(totalSpacing, Main.layoutManager.primaryMonitor.width);
    },

    allocate: function(actor, box, flags) {
        this.box = box;
        let rtl = (St.Widget.get_default_direction () == St.TextDirection.RTL);

        if (this.thumbnails.length == 0) // not visible
            return;

        let portholeWidth = this.porthole.width;
        let portholeHeight = this.porthole.height;
        let spacing = this.actor.get_theme_node().get_length('spacing');

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
                // We don't do the tween immediately because we need to observe the ordering
                // in queueUpdateStates - if workspaces have been removed we need to slide them
                // out as the first thing.
                this.targetScale = newScale;
                this.pendingScaleUpdate = true;
            } else {
                this.targetScale = this._scale = newScale;
            }

            this.queueUpdateStates();
        }

        let thumbnailHeight = Math.round(portholeHeight * this._scale);
        let thumbnailWidth = Math.round(portholeWidth * this._scale);

        let childBox = new Clutter.ActorBox();
        
        let calcPaddingX = function(nCols) {
            let neededX = (thumbnailWidth * nCols) + totalSpacingX + (spacing * 2);
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
            let x1 = Math.round(x + (thumbnailWidth * thumbnail.slidePosition / 2));
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

            let scale = this._scale * (1 - thumbnail.slidePosition);
            thumbnail.actor.set_scale(scale, scale);
            thumbnail.actor.allocate(childBox, flags);  

            let framethemeNode = thumbnail.frame.get_theme_node();
            let borderWidth = framethemeNode.get_border_width(St.Side.BOTTOM);
            childBox.x1 = x1 - borderWidth;
            childBox.x2 = x2 + borderWidth;
            childBox.y1 = y1 - borderWidth;
            childBox.y2 = y2 + borderWidth;
            thumbnail.frame.set_scale((1 - thumbnail.slidePosition), (1 - thumbnail.slidePosition));
            thumbnail.frame.allocate(childBox, flags);

            let thumbnailx = Math.round(x + (thumbnailWidth * thumbnail.slidePosition / 2));
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

        if (this.lastHovered && this.lastHovered.actor != null && !this.lastHovered.doomed){
            x = this.lastHovered.actor.allocation.x1 + ((this.lastHovered.actor.allocation.x2 - this.lastHovered.actor.allocation.x1) * this.lastHovered.actor.get_scale()[0]) - buttonOverlap;
            y = this.lastHovered.actor.allocation.y1 - (buttonHeight - buttonOverlap);
        } else {
            this.button.hide();        
        }

        childBox.x1 = x;
        childBox.x2 = childBox.x1 + buttonWidth;
        childBox.y1 = y;
        childBox.y2 = childBox.y1 + buttonHeight;
        
        this.button.allocate(childBox, flags);
        this.emit('allocated');
    },

    activeWorkspaceChanged: function(wm, from, to, direction) {
        this.thumbnails[this.kbThumbnailIndex].showKeyboardSelectedState(false);
        this.kbThumbnailIndex = global.screen.get_active_workspace_index();
        this.thumbnails[this.kbThumbnailIndex].showKeyboardSelectedState(true);

        let thumbnail;
        let activeWorkspace = global.screen.get_active_workspace();
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
    },

    onScrollEvent: function (actor, event) {
        if (Main.expo.animationInProgress)
            return;

        switch ( event.get_scroll_direction() ) {
        case Clutter.ScrollDirection.UP:
            Main.wm.actionMoveWorkspaceUp();
            break;
        case Clutter.ScrollDirection.DOWN:
            Main.wm.actionMoveWorkspaceDown();
            break;
        }
    }
};
Signals.addSignalMethods(ExpoThumbnailsBox.prototype);
