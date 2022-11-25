// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

/**
 * FILE:layout.js
 * @short_description: The file responsible for managing Cinnamon chrome
 */
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const St = imports.gi.St;
const Main = imports.ui.main;
const Params = imports.misc.params;
const Tweener = imports.ui.tweener;
const EdgeFlip = imports.ui.edgeFlip;
const HotCorner = imports.ui.hotCorner;
const DeskletManager = imports.ui.deskletManager;
const Panel = imports.ui.panel;
const StartupAnimation = imports.ui.startupAnimation;

function isPopupMetaWindow(actor) {
    switch(actor.meta_window.get_window_type()) {
    case Meta.WindowType.DROPDOWN_MENU:
    case Meta.WindowType.POPUP_MENU:
    case Meta.WindowType.COMBO:
        return true;
    default:
        return false;
    }
}

function Monitor(index, geometry) {
    this._init(index, geometry);
}

Monitor.prototype = {
    _init: function(index, geometry) {
        this.index = index;
        this.x = geometry.x;
        this.y = geometry.y;
        this.width = geometry.width;
        this.height = geometry.height;
    },

    get inFullscreen() {
        return global.screen.get_monitor_in_fullscreen(this.index);
    }
};

var UiActor = GObject.registerClass(
class UiActor extends St.Widget {
    _init() {
        super._init();
        this.skip_paint_actors = new Set();
    }

    set_skip_paint(child, skip) {
        var skipping = this.skip_paint_actors.has(child);

        if (skipping === !!skip) {
            return;
        }

        if (skip) {
            this.skip_paint_actors.add(child);
        } else {
            this.skip_paint_actors.delete(child);
        }

        this.queue_redraw();
    }

    get_skip_paint(child) {
        return this.skip_paint_actors.has(child);
    }

    vfunc_get_preferred_width(_forHeight) {
        let width = global.stage.width;
        return [width, width];
    }

    vfunc_get_preferred_height(_forWidth) {
        let height = global.stage.height;
        return [height, height];
    }

    vfunc_paint(context) {
        for (let child = this.get_first_child(); child != null; child = child.get_next_sibling()) {
            if (this.skip_paint_actors.has(child))
                continue;
            child.paint(context);
        }
    }

    vfunc_pick(context) {
        super.vfunc_pick(context);

        for (let child = this.get_first_child(); child != null; child = child.get_next_sibling()) {
            if (this.skip_paint_actors.has(child)) {
                continue;
            }

            child.pick(context);
        }
    }
});

/**
 * #LayoutManager
 *
 * @short_description: Manager of Cinnamon Chrome
 *
 * Creates and manages the Chrome container which holds
 * all of the Cinnamon UI actors.
 */
function LayoutManager() {
    this._init.apply(this, arguments);
}

LayoutManager.prototype = {
    _init: function () {
        this._rtl = (St.Widget.get_default_direction() == St.TextDirection.RTL);
        this.monitors = [];
        this.primaryMonitor = null;
        this.primaryIndex = -1;
        this.hotCornerManager = null;
        this.edgeRight = null;
        this.edgeLeft = null;
        this.hideIdleId = 0;
        this._chrome = new Chrome(this);

        this.enabledEdgeFlip = global.settings.get_boolean("enable-edge-flip");
        this.edgeFlipDelay = global.settings.get_int("edge-flip-delay");

        this.keyboardBox = new St.BoxLayout({ name: 'keyboardBox',
                                              reactive: true,
                                              track_hover: true });
        this.keyboardBox.hide();

        this.addChrome(this.keyboardBox, { visibleInFullscreen: true, affectsStruts: false });

        this._keyboardHeightNotifyId = 0;

        this._monitorsChanged();

        global.settings.connect("changed::enable-edge-flip", Lang.bind(this, this._onEdgeFlipChanged));
        global.settings.connect("changed::edge-flip-delay", Lang.bind(this, this._onEdgeFlipChanged));
        Meta.MonitorManager.get().connect('monitors-changed', Lang.bind(this, this._monitorsChanged));
    },

    _onEdgeFlipChanged: function(){
        this.enabledEdgeFlip = global.settings.get_boolean("enable-edge-flip");
        this.edgeFlipDelay = global.settings.get_int("edge-flip-delay");
        this.edgeRight.enabled = this.enabledEdgeFlip;
        this.edgeRight.delay = this.edgeFlipDelay;
        this.edgeLeft.enabled = this.enabledEdgeFlip;
        this.edgeLeft.delay = this.edgeFlipDelay;
    },

    // This is called by Main after everything else is constructed;
    // Certain functions need to access other Main elements that do
    // not exist yet when the LayoutManager was constructed.
    init: function() {
        this._chrome.init();

        this.edgeRight = new EdgeFlip.EdgeFlipper(St.Side.RIGHT, Main.wm.actionFlipWorkspaceRight);
        this.edgeLeft = new EdgeFlip.EdgeFlipper(St.Side.LEFT, Main.wm.actionFlipWorkspaceLeft);

        this.edgeRight.enabled = this.enabledEdgeFlip;
        this.edgeRight.delay = this.edgeFlipDelay;
        this.edgeLeft.enabled = this.enabledEdgeFlip;
        this.edgeLeft.delay = this.edgeFlipDelay;

        this.hotCornerManager = new HotCorner.HotCornerManager();
    },

    _toggleExpo: function() {
        if (Main.expo.animationInProgress)
            return;

        if (Main.overview.visible) {
            this._activationTime = Date.now() / 1000;
            Main.overview.hide();
        }
        Main.expo.toggle();
    },

    _updateMonitors: function() {
        this.monitors = [];
        let nMonitors = global.display.get_n_monitors();
        for (let i = 0; i < nMonitors; i++) {
            let rect = global.display.get_monitor_geometry(i);
            let lmon = global.display.get_monitor_index_for_rect(rect);

            this.monitors.push(new Monitor(lmon, rect));
        }

        this.primaryIndex = global.display.get_primary_monitor();
        this.primaryMonitor = this.monitors[this.primaryIndex];
    },

    _updateBoxes: function() {
        if (this.hotCornerManager)
            this.hotCornerManager.update();
        this._chrome._queueUpdateRegions();
    },

    _monitorsChanged: function() {
        this._updateMonitors();
        this._updateBoxes();
        this.emit('monitors-changed');
    },

    get focusIndex() {
        let i = 0;
        if (global.stage.key_focus != null)
            i = this.findMonitorIndexForActor(global.stage.key_focus);
        else if (global.display.focus_window != null)
            i = global.display.focus_window.get_monitor();
        return i;
    },

    get focusMonitor() {
        return this.monitors[this.focusIndex];
    },

    get currentMonitor() {
        let index = global.screen.get_current_monitor();
        return Main.layoutManager.monitors[index];
    },

    _prepareStartupAnimation: function() {
        // During the initial transition, add a simple actor to block all events,
        // so they don't get delivered to X11 windows that have been transformed.
        this._coverPane = new Clutter.Actor({ opacity: 0,
                                              width: global.screen_width,
                                              height: global.screen_height,
                                              reactive: true });
        this.addChrome(this._coverPane);

        // We need to force an update of the regions now before we scale
        // the UI group to get the correct allocation for the struts.
        this._chrome.updateRegions();

        this.keyboardBox.hide();

        global.stage.hide_cursor();
        global.background_actor.show();

        this.startupAnimation = new StartupAnimation.Animation(this.primaryMonitor,
                                                               ()=>this._startupAnimationComplete());
        this._chrome.updateRegions();
    },

    _doStartupAnimation: function() {
        // Don't animate the strut
        this._chrome.freezeUpdateRegions();
        this.startupAnimation.run();
    },

    _startupAnimationComplete: function() {
        global.stage.show_cursor();
        this.removeChrome(this._coverPane);
        this._coverPane = null;
        this._chrome.thawUpdateRegions();

        Main.setRunState(Main.RunState.RUNNING);
    },

    showKeyboard: function () {
        if (this.hideIdleId > 0) {
            Mainloop.source_remove(this.hideIdleId);
            this.hideIdleId = 0;
        }

        if (!this.keyboardBox.visible) {
            this.keyboardBox.show();
        }

        // this.keyboardBox.raise_top();
        Main.panelManager.lowerActorBelowPanels(this.keyboardBox);

        // Poke Chrome to update the input shape; it doesn't notice
        // anchor point changes
        this._chrome.modifyActorParams(this.keyboardBox, { affectsStruts: true });
        this._chrome.updateRegions();

        this._keyboardHeightNotifyId = this.keyboardBox.connect('notify::height', Lang.bind(this, function () {
            if (this.keyboardBox.y != 0) {
                this.keyboardBox.y = this.focusMonitor.y + this.focusMonitor.height - this.keyboardBox.height;
            }
        }));

    },

    queueHideKeyboard: function() {
        if (this.hideIdleId != 0) {
            Mainloop.source_remove(this.hideIdleId);
            this.hideIdleId = 0;
        }

        if (this._keyboardHeightNotifyId) {
            this.keyboardBox.disconnect(this._keyboardHeightNotifyId);
            this._keyboardHeightNotifyId = 0;
        }

        this.hideIdleId = Mainloop.idle_add(Lang.bind(this, this.hideKeyboard));
    },

    hideKeyboard: function (immediate) {
        this.keyboardBox.hide();
        this._chrome.modifyActorParams(this.keyboardBox, { affectsStruts: false });
        this._chrome.updateRegions();

        this.hideIdleId = 0;
        return false;
    },

    /**
     * updateChrome:
     * @doVisibility (boolean): (optional) whether to recalculate visibility.
     *
     * Updates input region and struts for all chrome actors. If @doVisibility is true,
     * then the visibility state of all chrome actors is recalculated first.
     *
     * Use with care as this is already frequently updated, and can reduce performance
     * if called unnecessarily.
     */
    updateChrome: function(doVisibility) {
        if (doVisibility === true)
            this._chrome._updateVisibility();
        else
            this._chrome._queueUpdateRegions();
    },

    /**
     * addChrome:
     * @actor (Clutter.Actor): an actor to add to the chrome
     * @params (object): (optional) additional params
     *      - visibleInFullcreen (boolean): The actor should be hidden when a window on the same monitor is fullscreen. Default %false.
     *      - affectsStruts (boolean): The actor's allocation should be used to add window manager struts. Default %false.
     *      - affectsInputRegion (boolean): The actor should be added to the stage input region. Default %true.
     *      - addToWindowgroup (boolean): The actor should be added as a top-level window. Default %false.
     *      - doNotAdd (boolean): The actor should not be added to the uiGroup. This has no effect if %addToWindowgroup is %true. Default %false.
     *
     * Adds @actor to the chrome, and (unless %affectsInputRegion in
     * @params is %false) extends the input region to include it.
     * Changes in @actor's size, position, and visibility will
     * automatically result in appropriate changes to the input
     * region.
     *
     * If %affectsStruts in @params is %true (and @actor is along a
     * screen edge), then @actor's size and position will also affect
     * the window manager struts. Changes to @actor's visibility will
     * NOT affect whether or not the strut is present, however.
     *
     * If %visibleInFullscreen in @params is %true, the actor will be
     * visible even when a fullscreen window should be covering it.
     */
    addChrome: function(actor, params) {
        this._chrome.addActor(actor, params);
    },

    /**
     * trackChrome:
     * @actor (Clutter.Actor): a descendant of the chrome to begin tracking
     * @params (object): (optional) additional params - defaults to same as chrome ancestor
     *      - visibleInFullcreen (boolean): The actor should be hidden when a window on the same monitor is fullscreen.
     *      - affectsStruts (boolean): The actor's allocation should be used to add window manager struts.
     *      - affectsInputRegion (boolean): The actor should be added to the stage input region.
     *      - addToWindowgroup (boolean): The actor should be added as a top-level window.
     *      - doNotAdd (boolean): The actor should not be added to the uiGroup. This has no effect if %addToWindowgroup is %true.
     *
     * Tells the chrome to track @actor, which must be a descendant
     * of an actor added via addChrome(). This can be used to extend the
     * struts or input region to cover specific children.
     *
     * @params can have any of the same values as in addChrome(),
     * though some possibilities don't make sense (eg, trying to have
     * a %visibleInFullscreen child of a non-%visibleInFullscreen
     * parent).
     */
    trackChrome: function(actor, params) {
        this._chrome.trackActor(actor, params);
    },

    /**
     * untrackChrome:
     * @actor (Clutter.Actor): an actor previously tracked via trackChrome()
     *
     * Undoes the effect of trackChrome()
     */
    untrackChrome: function(actor) {
        this._chrome.untrackActor(actor);
    },

    /**
     * removeChrome:
     * @actor (Clutter.Actor): a chrome actor
     *
     * Removes the actor from the chrome
     */
    removeChrome: function(actor) {
        this._chrome.removeActor(actor);
    },

    /**
     * findMonitorForActor:
     * @actor (Clutter.Actor): the actor to locate
     *
     * Finds the monitor the actor is currently located on.
     * If the actor is not found the primary monitor is returned.
     *
     * Returns (Layout.Monitor): the monitor
     */
    findMonitorForActor: function(actor) {
        return this._chrome.findMonitorForActor(actor);
    },

    /**
     * findMonitorIndexForActor
     * @actor (Clutter.Actor): the actor to locate
     *
     * Finds the index of the monitor the actor is currently
     * located on. If the actor is not found the primary monitor
     * index is returned.
     *
     * Returns (number): the monitor index
     */
    findMonitorIndexForActor: function(actor) {
        return this._chrome.findMonitorIndexForActor(actor);
    },

    findMonitorIndexAt: function(x, y) {
        let [index, monitor] = this._chrome._findMonitorForRect(x, y, 1, 1)
        return index;
    },

    /**
     * isTrackingChrome:
     * @actor (Clutter.Actor): the actor to check
     *
     * Determines whether the actor is currently tracked or not.
     *
     * Returns (boolean): whether the actor is currently tracked
     */
    isTrackingChrome: function(actor) {
        return this._chrome._findActor(actor) != -1;
    }
};
Signals.addSignalMethods(LayoutManager.prototype);



// This manages Cinnamon "chrome"; the UI that's visible in the
// normal mode (ie, outside the Overview), that surrounds the main
// workspace content.
const defaultParams = {
    visibleInFullscreen: false,
    affectsStruts: false,
    affectsInputRegion: true,
    addToWindowgroup: false,
    doNotAdd: false
};

function Chrome() {
    this._init.apply(this, arguments);
}

Chrome.prototype = {
    _init: function(layoutManager) {
        this._layoutManager = layoutManager;

        this._monitors = [];
        this._inOverview = false;
        this._isPopupWindowVisible = false;
        this._primaryMonitor = null;
        this._primaryIndex = -1;
        this._updateRegionIdle = 0;
        this._freezeUpdateCount = 0;

        this._trackedActors = [];

        this._layoutManager.connect('monitors-changed',
                                    Lang.bind(this, this._relayout));
        global.screen.connect('restacked',
                              Lang.bind(this, this._windowsRestacked));
        global.screen.connect('in-fullscreen-changed', Lang.bind(this, this._updateVisibility));
        global.window_manager.connect('switch-workspace', Lang.bind(this, this._queueUpdateRegions));

        // Need to update struts on new workspaces when they are added
        global.screen.connect('notify::n-workspaces',
                              Lang.bind(this, this._queueUpdateRegions));

        this._relayout();
    },

    init: function() {
        Main.overview.connect('showing',
                              Lang.bind(this, this._overviewShowing));
        Main.overview.connect('hidden',
                              Lang.bind(this, this._overviewHidden));
    },

    addActor: function(actor, params) {
        let actorData = Params.parse(params, defaultParams);
        if (actorData.addToWindowgroup) global.window_group.add_actor(actor);
        else if (!actorData.doNotAdd) Main.uiGroup.add_actor(actor);
        this._trackActor(actor, params);
    },

    trackActor: function(actor, params) {
        let ancestor = actor.get_parent();
        let index = this._findActor(ancestor);
        while (ancestor && index == -1) {
            ancestor = ancestor.get_parent();
            index = this._findActor(ancestor);
        }
        if (!ancestor)
            throw new Error('actor is not a descendent of a chrome actor');

        let ancestorData = this._trackedActors[index];
        if (!params)
            params = {};
        // We can't use Params.parse here because we want to drop
        // the extra values like ancestorData.actor
        for (let prop in defaultParams) {
            if (!params.hasOwnProperty(prop))
                params[prop] = ancestorData[prop];
        }

        this._trackActor(actor, params);
    },

    untrackActor: function(actor) {
        this._untrackActor(actor);
    },

    removeActor: function(actor) {
        let i = this._findActor(actor);

        if (i == -1)
            return;
        let actorData = this._trackedActors[i];

        if (actorData.addToWindowgroup) global.window_group.remove_child(actor);
        else Main.uiGroup.remove_child(actor);
        this._untrackActor(actor);
    },

    _findActor: function(actor) {
        for (let i = 0; i < this._trackedActors.length; i++) {
            let actorData = this._trackedActors[i];
            if (actorData.actor == actor)
                return i;
        }
        return -1;
    },

    modifyActorParams: function(actor, params) {
        let index = this._findActor(actor);
        if (index == -1)
            throw new Error('could not find actor in chrome');
        for (var i in params){
            this._trackedActors[index][i] = params[i];
        }
        this._queueUpdateRegions();
    },

    _trackActor: function(actor, params) {
        if (this._findActor(actor) != -1)
            throw new Error('trying to re-track existing chrome actor');

        let actorData = Params.parse(params, defaultParams);
        actorData.actor = actor;
        if (actorData.addToWindowgroup) actorData.isToplevel = actor.get_parent() == global.window_group;
        else actorData.isToplevel = actor.get_parent() == Main.uiGroup;
        actorData.visibleId = actor.connect('notify::visible',
                                            Lang.bind(this, this._queueUpdateRegions));
        actorData.allocationId = actor.connect('notify::allocation',
                                               Lang.bind(this, this._queueUpdateRegions));
        actorData.parentSetId = actor.connect('parent-set',
                                              Lang.bind(this, this._actorReparented));
        // Note that destroying actor unsets its parent, but does not emit
        // parent-set during destruction.
        // https://gitlab.gnome.org/GNOME/mutter/-/commit/f376a318ba90fc29d3d661df4f55698459f31cfa
        actorData.destroyId = actor.connect('destroy',
                                            Lang.bind(this, this._untrackActor));

        this._trackedActors.push(actorData);
        this._queueUpdateRegions();
    },

    _untrackActor: function(actor) {
        let i = this._findActor(actor);

        if (i == -1)
            return;
        let actorData = this._trackedActors[i];

        this._trackedActors.splice(i, 1);
        actor.disconnect(actorData.visibleId);
        actor.disconnect(actorData.allocationId);
        actor.disconnect(actorData.parentSetId);
        actor.disconnect(actorData.destroyId);

        this._queueUpdateRegions();
    },

    _actorReparented: function(actor, oldParent) {
        let i = this._findActor(actor);
        if (i == -1)
            return;
        let actorData = this._trackedActors[i];

        let newParent = actor.get_parent();
        if (!newParent)
            this._untrackActor(actor);
        else{
            if (actorData.addToWindowgroup) actorData.isToplevel = (newParent == global.window_group);
            else actorData.isToplevel = (newParent == Main.uiGroup);
        }
    },

    _updateVisibility: function() {
        for (let i = 0; i < this._trackedActors.length; i++) {
            let actorData = this._trackedActors[i], visible;
            if (!actorData.isToplevel)
                continue;
            else if (global.stage_input_mode == Cinnamon.StageInputMode.FULLSCREEN) {
                let monitor = this.findMonitorForActor(actorData.actor);

                if (global.screen.get_n_monitors() == 1 || !monitor.inFullscreen) {
                    visible = true;
                } else {
                    if (Main.modalActorFocusStack.length > 0) {
                        let modalActor = Main.modalActorFocusStack[Main.modalActorFocusStack.length - 1].actor;

                        if (this.findMonitorForActor(modalActor) == monitor) {
                            visible = true;
                        }
                    }
                }
            } else if (this._inOverview)
                visible = true;
            else if (!actorData.visibleInFullscreen &&
                     this.findMonitorForActor(actorData.actor).inFullscreen)
                visible = false;
            else
                visible = true;
            Main.uiGroup.set_skip_paint(actorData.actor, !visible);
        }
        this._queueUpdateRegions();
    },

    _overviewShowing: function() {
        this._inOverview = true;
        this._updateVisibility();
    },

    _overviewHidden: function() {
        this._inOverview = false;
        this._updateVisibility();
    },

    _relayout: function() {
        this._monitors = this._layoutManager.monitors;
        this._primaryMonitor = this._layoutManager.primaryMonitor;
        this._primaryIndex = this._layoutManager.primaryIndex
        this._updateVisibility();
    },

    _findMonitorForRect: function(x, y, w, h) {
        // First look at what monitor the center of the rectangle is at
        let cx = x + w/2;
        let cy = y + h/2;
        for (let i = 0; i < this._monitors.length; i++) {
            let monitor = this._monitors[i];
            if (cx >= monitor.x && cx < monitor.x + monitor.width &&
                cy >= monitor.y && cy < monitor.y + monitor.height)
                return [i, monitor];
        }
        // If the center is not on a monitor, return the first overlapping monitor
        for (let i = 0; i < this._monitors.length; i++) {
            let monitor = this._monitors[i];
            if (x + w > monitor.x && x < monitor.x + monitor.width &&
                y + h > monitor.y && y < monitor.y + monitor.height)
                return [i, monitor];
        }
        // otherwise on no monitor
        return [0, null];
    },

    _findMonitorForWindow: function(window) {
        return this._findMonitorForRect(window.x, window.y, window.width, window.height);
    },

    getMonitorInfoForActor: function(actor) {
        // special case for hideable panel actors:
        // due to position and clip they may appear originate on an adjacent monitor
        if (actor.maybeGet("_delegate") instanceof Panel.Panel
            && actor._delegate.isHideable())
            return [actor._delegate.monitorIndex, this._monitors[actor._delegate.monitorIndex]];

        let [x, y] = actor.get_transformed_position();
        let [w, h] = actor.get_transformed_size();
        let [index, monitor] = this._findMonitorForRect(x, y, w, h);
        return [index, monitor];
    },

    // This call guarantees that we return some monitor to simplify usage of it
    // In practice all tracked actors should be visible on some monitor anyway
    findMonitorForActor: function(actor) {
        let [index, monitor] = this.getMonitorInfoForActor(actor);
        if (monitor)
            return monitor;
        return this._primaryMonitor; // Not on any monitor, pretend its on the primary
    },

    findMonitorIndexForActor: function(actor) {
        let [index, monitor] = this.getMonitorInfoForActor(actor);
        if (monitor)
            return index;
        return this._primaryIndex; // Not on any monitor, pretend its on the primary
    },

    _queueUpdateRegions: function() {
        if (!this._updateRegionIdle && !this._freezeUpdateCount)
            this._updateRegionIdle = Mainloop.idle_add(Lang.bind(this, this.updateRegions),
                                                       Meta.PRIORITY_BEFORE_REDRAW);
    },

    freezeUpdateRegions: function() {
        if (this._updateRegionIdle)
            this.updateRegions();
        this._freezeUpdateCount++;
    },

    thawUpdateRegions: function() {
        this._freezeUpdateCount = --this._freezeUpdateCount >= 0 ? this._freezeUpdateCount : 0;
        this._queueUpdateRegions();
    },

    _windowsRestacked: function() {
        // Figure out where the pointer is in case we lost track of
        // it during a grab.
        global.sync_pointer();

        let isPopupWindowVisible = global.top_window_group.get_children().some(isPopupMetaWindow);
        let popupVisibilityChanged = this._isPopupWindowVisible !== isPopupWindowVisible;
        this._isPopupWindowVisible = isPopupWindowVisible;
        if (popupVisibilityChanged)
            this._updateVisibility();
        else
            this._queueUpdateRegions();
    },

    updateRegions: function() {
        let rects = [], struts = [], i;

        if (this._updateRegionIdle) {
            Mainloop.source_remove(this._updateRegionIdle);
            this._updateRegionIdle = 0;
        }

        let wantsInputRegion = !this._isPopupWindowVisible;

        for (let i = 0; i < this._trackedActors.length; i++) {
            let actorData = this._trackedActors[i];
            if (!(actorData.affectsInputRegion && wantsInputRegion) && !actorData.affectsStruts)
                continue;

            let [x, y] = actorData.actor.get_transformed_position();
            let [w, h] = actorData.actor.get_transformed_size();

            if (isNaN(x) || isNaN(y) || isNaN(w) || isNaN(h)) {
                // If the actor isn't giving us a valid size/position, skip it
                // It would make the loop fail with an exception and affect the
                // other actors
                continue;
            }

            x = Math.round(x);
            y = Math.round(y);
            w = Math.round(w);
            h = Math.round(h);

            if (wantsInputRegion
                && actorData.affectsInputRegion
                && actorData.actor.get_paint_visibility()
                && !Main.uiGroup.get_skip_paint(actorData.actor)) {

                let rect = new Meta.Rectangle({ x: x, y: y, width: w, height: h});

                // special case for hideable panel actors:
                // clip any off-monitor input region
                if (actorData.actor.maybeGet("_delegate") instanceof Panel.Panel
                    && actorData.actor._delegate.isHideable()) {
                    let m = this._monitors[actorData.actor._delegate.monitorIndex];
                    if (m) {
                        let mr = {x: m.x, y: m.y, width: m.width, height: m.height};
                        [, rect] = rect.intersect(new Meta.Rectangle(mr));
                    }
                }

                rects.push(rect);
            }

            if (actorData.affectsStruts) {
                // Limit struts to the size of the screen
                let x1 = Math.max(x, 0);
                let x2 = Math.min(x + w, global.screen_width);
                let y1 = Math.max(y, 0);
                let y2 = Math.min(y + h, global.screen_height);

                // Metacity wants to know what side of the monitor the
                // strut is considered to be attached to. First, we find
                // the monitor that contains the strut. If the actor is
                // only touching one edge, or is touching the entire
                // border of that monitor, then it's obvious which side
                // to call it. If it's in a corner, we pick a side
                // arbitrarily. If it doesn't touch any edges, or it
                // spans the width/height across the middle of the
                // screen, then we don't create a strut for it at all.

                let monitor = this.findMonitorForActor(actorData.actor);
                let side;
                if (x1 <= monitor.x && x2 >= monitor.x + monitor.width) {
                    if (y1 <= monitor.y)
                        side = Meta.Side.TOP;
                    else if (y2 >= monitor.y + monitor.height)
                        side = Meta.Side.BOTTOM;
                    else
                        continue;
                } else if (y1 <= monitor.y && y2 >= monitor.y + monitor.height) {
                    if (x1 <= monitor.x)
                        side = Meta.Side.LEFT;
                    else if (x2 >= monitor.x + monitor.width)
                        side = Meta.Side.RIGHT;
                    else
                        continue;
                } else if (x1 <= monitor.x)
                    side = Meta.Side.LEFT;
                else if (y1 <= monitor.y)
                    side = Meta.Side.TOP;
                else if (x2 >= monitor.x + monitor.width)
                    side = Meta.Side.RIGHT;
                else if (y2 >= monitor.y + monitor.height)
                    side = Meta.Side.BOTTOM;
                else
                    continue;

                let strutRect = new Meta.Rectangle({ x: x1, y: y1, width: x2 - x1, height: y2 - y1});
                let strut = new Meta.Strut({ rect: strutRect, side: side });
                struts.push(strut);
            }
        }

        global.set_stage_input_region(rects);

        let screen = global.screen;
        for (let w = 0; w < screen.n_workspaces; w++) {
            let workspace = screen.get_workspace_by_index(w);
            workspace.set_builtin_struts(struts);
        }

        return false;
    }
};
