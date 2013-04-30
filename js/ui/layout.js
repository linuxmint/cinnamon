// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const St = imports.gi.St;
const Main = imports.ui.main;
const Params = imports.misc.params;
const ScreenSaver = imports.misc.screenSaver;
const Tweener = imports.ui.tweener;
const EdgeFlip = imports.ui.edgeFlip;
const HotCorner = imports.ui.hotCorner;
const DeskletManager = imports.ui.deskletManager;

const STARTUP_ANIMATION_TIME = 0.2;
const KEYBOARD_ANIMATION_TIME = 0.5;

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
        this._leftPanelBarrier = 0;
        this._rightPanelBarrier = 0;
        this._leftPanelBarrier2 = 0;
        this._rightPanelBarrier2 = 0;
        this.edgeRight = null;
        this.edgeLeft = null;
        this._chrome = new Chrome(this);
        this.enabledEdgeFlip = global.settings.get_boolean("enable-edge-flip");
        this.edgeFlipDelay = global.settings.get_int("edge-flip-delay");

        this.panelBox = new St.BoxLayout({ name: 'panelBox',
                                           vertical: true });

        this.panelBox2 = new St.BoxLayout({ name: 'panelBox',
                                            vertical: true });        

        this.addChrome(this.panelBox, { addToWindowgroup: false });
        this.addChrome(this.panelBox2, { addToWindowgroup: false });
        this.panelBox.connect('allocation-changed',
                              Lang.bind(this, this._updatePanelBarriers));
        this.panelBox2.connect('allocation-changed',
                               Lang.bind(this, this._updatePanelBarriers));

        this.keyboardBox = new St.BoxLayout({ name: 'keyboardBox',
                                              reactive: true,
                                              track_hover: true });
        this.addChrome(this.keyboardBox, { visibleInFullscreen: true });
        this._keyboardHeightNotifyId = 0;

        this._processPanelSettings();
        this._monitorsChanged();

        global.settings.connect("changed::enable-edge-flip", Lang.bind(this, this._onEdgeFlipChanged));
        global.settings.connect("changed::edge-flip-delay", Lang.bind(this, this._onEdgeFlipChanged));
        global.settings.connect("changed::panel-autohide", Lang.bind(this, this._processPanelSettings));
        global.settings.connect("changed::panel2-autohide", Lang.bind(this, this._processPanelSettings));
        global.settings.connect("changed::panel-resizable", Lang.bind(this, this._processPanelSettings));
        global.settings.connect("changed::panel-bottom-height", Lang.bind(this, this._processPanelSettings));
        global.settings.connect("changed::panel-top-height", Lang.bind(this, this._processPanelSettings));
        global.screen.connect('restacked', Lang.bind(this, this._windowsRestacked));
        global.screen.connect('monitors-changed',
                              Lang.bind(this, this._monitorsChanged));
        global.window_manager.connect('switch-workspace',
                                      Lang.bind(this, this._windowsRestacked));
    },

    _onEdgeFlipChanged: function(){
        this.enabledEdgeFlip = global.settings.get_boolean("enable-edge-flip");
        this.edgeFlipDelay = global.settings.get_int("edge-flip-delay");
        this.edgeRight.enabled = this.enabledEdgeFlip;
        this.edgeRight.delay = this.edgeFlipDelay;
        this.edgeLeft.enabled = this.enabledEdgeFlip;
        this.edgeLeft.delay = this.edgeFlipDelay;
    },

    _windowsRestacked: function() {
        this._chrome.updateRegions();
    },

    // This is called by Main after everything else is constructed;
    // Certain functions need to access other Main elements that do
    // not exist yet when the LayoutManager was constructed.
    init: function() {
        this._chrome.init();

        this._startupAnimation();
        this.edgeRight = new EdgeFlip.EdgeFlipper(St.Side.RIGHT, Main.wm.actionFlipWorkspaceRight);
        this.edgeLeft = new EdgeFlip.EdgeFlipper(St.Side.LEFT, Main.wm.actionFlipWorkspaceLeft);

        this.edgeRight.enabled = this.enabledEdgeFlip;
        this.edgeRight.delay = this.edgeFlipDelay;
        this.edgeLeft.enabled = this.enabledEdgeFlip;
        this.edgeLeft.delay = this.edgeFlipDelay;

        this.hotCornerManager = new HotCorner.HotCornerManager();
    },
    
    _toggleExpo: function() {
        if (!Main.expo.animationInProgress) {
            if (Main.overview.visible) {
                this._activationTime = Date.now() / 1000;
                Main.overview.hide();
                Main.expo.toggle();
            } else {
                Main.expo.toggle();
            }
        }
    },
    
    _processPanelSettings: function() {
        if (this._processPanelSettingsTimeout) {
            Mainloop.source_remove(this._processPanelSettingsTimeout);
        }
        // delay this action somewhat, to let others do their thing before us
        this._processPanelSettingsTimeout = Mainloop.timeout_add(0, Lang.bind(this, function() {
            this._processPanelSettingsTimeout = 0;
            this._updateBoxes();
            this._chrome.modifyActorParams(this.panelBox, { affectsStruts: Main.panel && !Main.panel.isHideable() });
            this._chrome.modifyActorParams(this.panelBox2, { affectsStruts: Main.panel2 && !Main.panel2.isHideable() });
        }));
    },
    
    _updateMonitors: function() {
        let screen = global.screen;

        this.monitors = [];
        let nMonitors = screen.get_n_monitors();
        for (let i = 0; i < nMonitors; i++)
            this.monitors.push(screen.get_monitor_geometry(i));

        if (nMonitors == 1) {
            this.primaryIndex = this.bottomIndex = 0;
        } else {
            // If there are monitors below the primary, then we need
            // to split primary from bottom.
            this.primaryIndex = this.bottomIndex = screen.get_primary_monitor();
            for (let i = 0; i < this.monitors.length; i++) {
                let monitor = this.monitors[i];
                if (this._isAboveOrBelowPrimary(monitor)) {
                    if (monitor.y > this.monitors[this.bottomIndex].y)
                        this.bottomIndex = i;
                }
            }
        }
        this.primaryMonitor = this.monitors[this.primaryIndex];
        this.bottomMonitor = this.monitors[this.bottomIndex];
    },

    _updateHotCorners: function() {
        if (this.hotCornerManager)
            this.hotCornerManager.updatePosition(this.primaryMonitor, this.bottomMonitor);
    },

    _updateBoxes: function() {
        this._updateHotCorners();

        let getPanelHeight = function(panel) {
            let panelHeight = 0;
            if (panel) {
                panelHeight = panel.actor.get_height();
            }
            return panelHeight;
        };

        let p1height = getPanelHeight(Main.panel);

        if (Main.desktop_layout == Main.LAYOUT_TRADITIONAL) {
            this.panelBox.set_size(this.bottomMonitor.width, p1height);
            this.panelBox.set_position(this.bottomMonitor.x, this.bottomMonitor.y + this.bottomMonitor.height - p1height);
        }
        else if (Main.desktop_layout == Main.LAYOUT_FLIPPED) {
            this.panelBox.set_size(this.primaryMonitor.width, p1height);
            this.panelBox.set_position(this.primaryMonitor.x, this.primaryMonitor.y);
        }
        else if (Main.desktop_layout == Main.LAYOUT_CLASSIC) { 
            let p2height = getPanelHeight(Main.panel2);

            this.panelBox.set_size(this.primaryMonitor.width, p1height);
            this.panelBox.set_position(this.primaryMonitor.x, this.primaryMonitor.y);

            this.panelBox2.set_size(this.bottomMonitor.width, p2height);
            this.panelBox2.set_position(this.bottomMonitor.x, this.bottomMonitor.y + this.bottomMonitor.height - p2height);
        }

        this.keyboardBox.set_position(this.bottomMonitor.x,
                                      this.bottomMonitor.y + this.bottomMonitor.height);
        this.keyboardBox.set_size(this.bottomMonitor.width, -1);
        this._chrome._queueUpdateRegions();
    },

    getPorthole: function() {
        let porthole = {};
        let screen = {x: 0, y: 0, width: global.screen_width, height: global.screen_height};
        
        let getPanelHeight = function(panel) {
            let panelHeight = 0;
            let hideable = true;
            if (panel) {
                panelHeight = panel.actor.get_height();
                hideable = panel.isHideable();
            }
            return hideable ? 0 : panelHeight;
        };
        let p1height = getPanelHeight(Main.panel);
        if (Main.desktop_layout == Main.LAYOUT_TRADITIONAL) {       
            porthole.x = screen.x; porthole.y = screen.y;
            porthole.width = screen.width; porthole.height = screen.height - p1height;
        }
        else if (Main.desktop_layout == Main.LAYOUT_FLIPPED) {         
            porthole.x = screen.x; porthole.y = screen.y + p1height;
            porthole.width = screen.width; porthole.height = screen.height - p1height;
        }
        else if (Main.desktop_layout == Main.LAYOUT_CLASSIC) {
            let p2height = getPanelHeight(Main.panel2);
            porthole.x = screen.x; porthole.y = screen.y + p1height;
            porthole.width = screen.width; porthole.height = screen.height - p1height - p2height;
        }
        return porthole;
    },

    _updatePanelBarriers: function(panelBox) {
        let leftPanelBarrier;
        let rightPanelBarrier;
        if (panelBox==this.panelBox){
            leftPanelBarrier = this._leftPanelBarrier;
            rightPanelBarrier = this._rightPanelBarrier;
        }else{
            leftPanelBarrier = this._leftPanelBarrier2;
            rightPanelBarrier = this._rightPanelBarrier2;
        }
        if (leftPanelBarrier)
            global.destroy_pointer_barrier(leftPanelBarrier);
        if (rightPanelBarrier)
            global.destroy_pointer_barrier(rightPanelBarrier);

        if (panelBox.height) {                        
            if ((Main.desktop_layout == Main.LAYOUT_TRADITIONAL && panelBox==this.panelBox) || (Main.desktop_layout == Main.LAYOUT_CLASSIC && panelBox==this.panelBox2)) {
                let monitor = this.bottomMonitor;
                leftPanelBarrier = global.create_pointer_barrier(monitor.x, monitor.y + monitor.height - panelBox.height,
                                                                 monitor.x, monitor.y + monitor.height,
                                                                 1 /* BarrierPositiveX */);
                rightPanelBarrier = global.create_pointer_barrier(monitor.x + monitor.width, monitor.y + monitor.height - panelBox.height,
                                                                  monitor.x + monitor.width, monitor.y + monitor.height,
                                                                  4 /* BarrierNegativeX */);
            }
            else {
                let primary = this.primaryMonitor;
                leftPanelBarrier = global.create_pointer_barrier(primary.x, primary.y,
                                                                 primary.x, primary.y + panelBox.height,
                                                                 1 /* BarrierPositiveX */);
                rightPanelBarrier = global.create_pointer_barrier(primary.x + primary.width, primary.y,
                                                                  primary.x + primary.width, primary.y + panelBox.height,
                                                                  4 /* BarrierNegativeX */);
            }
        } else {
            leftPanelBarrier = 0;
            rightPanelBarrier = 0;
        }
        if (panelBox==this.panelBox){
            this._leftPanelBarrier = leftPanelBarrier;
            this._rightPanelBarrier = rightPanelBarrier;
        }else{
            this._leftPanelBarrier2 = leftPanelBarrier;
            this._rightPanelBarrier2 = rightPanelBarrier;
        }
    },

    _monitorsChanged: function() {
        this._updateMonitors();
        this._updateBoxes();
        this._updateHotCorners();
        this.emit('monitors-changed');
    },

    _isAboveOrBelowPrimary: function(monitor) {
        let primary = this.monitors[this.primaryIndex];
        let monitorLeft = monitor.x, monitorRight = monitor.x + monitor.width;
        let primaryLeft = primary.x, primaryRight = primary.x + primary.width;

        if ((monitorLeft >= primaryLeft && monitorLeft < primaryRight) ||
            (monitorRight > primaryLeft && monitorRight <= primaryRight) ||
            (primaryLeft >= monitorLeft && primaryLeft < monitorRight) ||
            (primaryRight > monitorLeft && primaryRight <= monitorRight))
            return true;

        return false;
    },

    get focusIndex() {
        let focusWindow = global.display.focus_window;

        if (focusWindow) {
            let wrect = focusWindow.get_outer_rect();
            for (let i = 0; i < this.monitors.length; i++) {
                let monitor = this.monitors[i];

                if (monitor.x <= wrect.x && monitor.y <= wrect.y &&
                    monitor.x + monitor.width > wrect.x &&
                    monitor.y + monitor.height > wrect.y)
                    return i;
            }
        }

        return this.primaryIndex;
    },

    get focusMonitor() {
        return this.monitors[this.focusIndex];
    },

    _startupAnimation: function() {
        // Don't animate the strut
        this._chrome.freezeUpdateRegions();

        let params = { anchor_y: 0,
                       time: STARTUP_ANIMATION_TIME,
                       transition: 'easeOutQuad',
                       onComplete: this._startupAnimationComplete,
                       onCompleteScope: this
                     };
        
        if (Main.desktop_layout == Main.LAYOUT_TRADITIONAL) {
          this.panelBox.anchor_y  = -(this.panelBox.height);
        }
        else if (Main.desktop_layout == Main.LAYOUT_FLIPPED) {
          this.panelBox.anchor_y  =   this.panelBox.height;
        }
        else if (Main.desktop_layout == Main.LAYOUT_CLASSIC) {
          this.panelBox.anchor_y  =   this.panelBox.height;
          this.panelBox2.anchor_y = -(this.panelBox2.height);
        }
        Tweener.addTween(this.panelBox, params);
        Tweener.addTween(this.panelBox2, params);
    },

    _startupAnimationComplete: function() {
        this._chrome.thawUpdateRegions();
    },

    showKeyboard: function () {
        if (Main.messageTray) Main.messageTray.hide();
        this.keyboardBox.raise_top();
        Tweener.addTween(this.keyboardBox,
                         { anchor_y: this.keyboardBox.height,
                           time: KEYBOARD_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onComplete: this._showKeyboardComplete,
                           onCompleteScope: this
                         });
    },

    _showKeyboardComplete: function() {
        // Poke Chrome to update the input shape; it doesn't notice
        // anchor point changes
        this._chrome.updateRegions();

        this._keyboardHeightNotifyId = this.keyboardBox.connect('notify::height', Lang.bind(this, function () {
            this.keyboardBox.anchor_y = this.keyboardBox.height;
        }));
    },

    hideKeyboard: function (immediate) {
        if (Main.messageTray) Main.messageTray.hide();
        if (this._keyboardHeightNotifyId) {
            this.keyboardBox.disconnect(this._keyboardHeightNotifyId);
            this._keyboardHeightNotifyId = 0;
        }
        Tweener.addTween(this.keyboardBox,
                         { anchor_y: 0,
                           time: immediate ? 0 : KEYBOARD_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onComplete: this._hideKeyboardComplete,
                           onCompleteScope: this
                         });
    },

    _hideKeyboardComplete: function() {
        this._chrome.updateRegions();
    },

    // addChrome:
    // @actor: an actor to add to the chrome
    // @params: (optional) additional params
    //
    // Adds @actor to the chrome, and (unless %affectsInputRegion in
    // @params is %false) extends the input region to include it.
    // Changes in @actor's size, position, and visibility will
    // automatically result in appropriate changes to the input
    // region.
    //
    // If %affectsStruts in @params is %true (and @actor is along a
    // screen edge), then @actor's size and position will also affect
    // the window manager struts. Changes to @actor's visibility will
    // NOT affect whether or not the strut is present, however.
    //
    // If %visibleInFullscreen in @params is %true, the actor will be
    // visible even when a fullscreen window should be covering it.
    addChrome: function(actor, params) {
        this._chrome.addActor(actor, params);
    },

    // trackChrome:
    // @actor: a descendant of the chrome to begin tracking
    // @params: parameters describing how to track @actor
    //
    // Tells the chrome to track @actor, which must be a descendant
    // of an actor added via addChrome(). This can be used to extend the
    // struts or input region to cover specific children.
    //
    // @params can have any of the same values as in addChrome(),
    // though some possibilities don't make sense (eg, trying to have
    // a %visibleInFullscreen child of a non-%visibleInFullscreen
    // parent). By default, @actor has the same params as its chrome
    // ancestor.
    trackChrome: function(actor, params) {
        this._chrome.trackActor(actor, params);
    },

    // untrackChrome:
    // @actor: an actor previously tracked via trackChrome()
    //
    // Undoes the effect of trackChrome()
    untrackChrome: function(actor) {
        this._chrome.untrackActor(actor);
    },

    // removeChrome:
    // @actor: a chrome actor
    //
    // Removes @actor from the chrome
    removeChrome: function(actor) {
        this._chrome.removeActor(actor);
    },

    findMonitorForActor: function(actor) {
        return this._chrome.findMonitorForActor(actor);
    },

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
        this._updateRegionIdle = 0;
        this._freezeUpdateCount = 0;

        this._trackedActors = [];

        this._layoutManager.connect('monitors-changed',
                                    Lang.bind(this, this._relayout));
        global.screen.connect('restacked',
                              Lang.bind(this, this._windowsRestacked));

        // Need to update struts on new workspaces when they are added
        global.screen.connect('notify::n-workspaces',
                              Lang.bind(this, this._queueUpdateRegions));

        this._screenSaverActive = false;
        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
        this._screenSaverProxy.connect('ActiveChanged', Lang.bind(this, this._onScreenSaverActiveChanged));
        this._screenSaverProxy.GetActiveRemote(Lang.bind(this,
            function(result, err) {
                if (!err)
                    this._onScreenSaverActiveChanged(this._screenSaverProxy, result);
            }));

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

        if (actorData.addToWindowgroup) global.window_group.remove_actor(actor);
        else Main.uiGroup.remove_actor(actor);
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
        // Note that destroying actor will unset its parent, so we don't
        // need to connect to 'destroy' too.

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

            if (this._screenSaverActive)
                visible = false;
            else if (this._inOverview)
                visible = true;
            else if (!actorData.visibleInFullscreen &&
                     this.findMonitorForActor(actorData.actor).inFullscreen)
                visible = false;
            else
                visible = true;
            Main.uiGroup.set_skip_paint(actorData.actor, !visible);
        }
    },

    _overviewShowing: function() {
        this._inOverview = true;
        this._updateVisibility();
        this._queueUpdateRegions();
    },

    _overviewHidden: function() {
        this._inOverview = false;
        this._updateVisibility();
        this._queueUpdateRegions();
    },

    _relayout: function() {
        this._monitors = this._layoutManager.monitors;
        this._primaryMonitor = this._layoutManager.primaryMonitor;
        this._updateFullscreen();
        this._updateVisibility();
        this._queueUpdateRegions();
    },

    _onScreenSaverActiveChanged: function(proxy, screenSaverActive) {
        this._screenSaverActive = screenSaverActive;
        this._updateVisibility();
        this._queueUpdateRegions();
    },

    _findMonitorForRect: function(x, y, w, h) {
        // First look at what monitor the center of the rectangle is at
        let cx = x + w/2;
        let cy = y + h/2;
        for (let i = 0; i < this._monitors.length; i++) {
            let monitor = this._monitors[i];
            if (cx >= monitor.x && cx < monitor.x + monitor.width &&
                cy >= monitor.y && cy < monitor.y + monitor.height)
                return monitor;
        }
        // If the center is not on a monitor, return the first overlapping monitor
        for (let i = 0; i < this._monitors.length; i++) {
            let monitor = this._monitors[i];
            if (x + w > monitor.x && x < monitor.x + monitor.width &&
                y + h > monitor.y && y < monitor.y + monitor.height)
                return monitor;
        }
        // otherwise on no monitor
        return null;
    },

    _findMonitorForWindow: function(window) {
        return this._findMonitorForRect(window.x, window.y, window.width, window.height);
    },

    // This call guarantees that we return some monitor to simplify usage of it
    // In practice all tracked actors should be visible on some monitor anyway
    findMonitorForActor: function(actor) {
        let [x, y] = actor.get_transformed_position();
        let [w, h] = actor.get_transformed_size();
        let monitor = this._findMonitorForRect(x, y, w, h);
        if (monitor)
            return monitor;
        return this._primaryMonitor; // Not on any monitor, pretend its on the primary
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
        this._freezeUpdateCount = --this._freezeUpdateCount >= 0 ? this.freezeUpdateCount : 0;
        this._queueUpdateRegions();
    },

    _updateFullscreen: function() {
        let windows = Main.getWindowActorsForWorkspace(global.screen.get_active_workspace_index());

        // Reset all monitors to not fullscreen
        for (let i = 0; i < this._monitors.length; i++)
            this._monitors[i].inFullscreen = false;

        // Ordinary chrome should be visible unless there is a window
        // with layer FULLSCREEN, or a window with layer
        // OVERRIDE_REDIRECT that covers the whole screen.
        // ('override_redirect' is not actually a layer above all
        // other windows, but this seems to be how muffin treats it
        // currently...) If we wanted to be extra clever, we could
        // figure out when an OVERRIDE_REDIRECT window was trying to
        // partially overlap us, and then adjust the input region and
        // our clip region accordingly...

        // @windows is sorted bottom to top.

        for (let i = windows.length - 1; i > -1; i--) {
            let window = windows[i];
            let metaWindow = window.get_meta_window();

            // Skip minimized windows
            if (!window.showing_on_its_workspace())
                continue;

            if (metaWindow.get_layer() == Meta.StackLayer.FULLSCREEN || metaWindow.is_fullscreen()) {
                let monitor = this._findMonitorForWindow(window);
                if (monitor)
                    monitor.inFullscreen = true;
            }
            if (metaWindow.is_override_redirect()) {
                // Check whether the window is screen sized
                let isScreenSized =
                    (window.x == 0 && window.y == 0 &&
                     window.width == global.screen_width &&
                     window.height == global.screen_height);

                if (isScreenSized) {
                    for (let i = 0; i < this._monitors.length; i++)
                        this._monitors[i].inFullscreen = true;
                }

                // Or whether it is monitor sized
                let monitor = this._findMonitorForWindow(window);
                if (monitor &&
                    window.x <= monitor.x &&
                    window.x + window.width >= monitor.x + monitor.width &&
                    window.y <= monitor.y &&
                    window.y + window.height >= monitor.y + monitor.height)
                    monitor.inFullscreen = true;
            } else
                break;
        }
    },

    _windowsRestacked: function() {
        let wasInFullscreen = [];
        for (let i = 0; i < this._monitors.length; i++)
            wasInFullscreen[i] = this._monitors[i].inFullscreen;

        this._updateFullscreen();

        let changed = false;
        for (let i = 0; i < wasInFullscreen.length; i++) {
            if (wasInFullscreen[i] != this._monitors[i].inFullscreen) {
                changed = true;
                break;
            }
        }
        if (changed) {
            this._updateVisibility();
            this._queueUpdateRegions();
        }
    },

    updateRegions: function() {
        let primary = this._primaryMonitor;
        if (!primary) return false;

        let rects = [], struts = [], i;

        if (this._updateRegionIdle) {
            Mainloop.source_remove(this._updateRegionIdle);
            this._updateRegionIdle = 0;
        }

        if (!primary.inFullscreen) {
            for (i = 0; i < this._trackedActors.length; i++) {
                let actorData = this._trackedActors[i];
                if (!actorData.affectsInputRegion && !actorData.affectsStruts)
                    continue;

                let [x, y] = actorData.actor.get_transformed_position();
                let [w, h] = actorData.actor.get_transformed_size();
                x = Math.round(x);
                y = Math.round(y);
                w = Math.round(w);
                h = Math.round(h);
                let rect = new Meta.Rectangle({ x: x, y: y, width: w, height: h});

                if (actorData.affectsInputRegion &&
                    actorData.actor.get_paint_visibility() &&
                    !Main.uiGroup.get_skip_paint(actorData.actor))
                    rects.push(rect);

                if (!actorData.affectsStruts)
                    continue;

                // Limit struts to the size of the screen
                let x1 = Math.max(x, 0);
                let x2 = Math.min(x + w, global.screen_width);
                let y1 = Math.max(y, 0);
                let y2 = Math.min(y + h, global.screen_height);

                // NetWM struts are not really powerful enought to handle
                // a multi-monitor scenario, they only describe what happens
                // around the outer sides of the full display region. However
                // it can describe a partial region along each side, so
                // we can support having the struts only affect the
                // primary monitor. This should be enough as we only have
                // chrome affecting the struts on the primary monitor so
                // far.
                //
                // Metacity wants to know what side of the screen the
                // strut is considered to be attached to. If the actor is
                // only touching one edge, or is touching the entire
                // border of the primary monitor, then it's obvious which
                // side to call it. If it's in a corner, we pick a side
                // arbitrarily. If it doesn't touch any edges, or it spans
                // the width/height across the middle of the screen, then
                // we don't create a strut for it at all.
                let side;
                if (x1 <= primary.x && x2 >= primary.x + primary.width) {
                    if (y1 <= primary.y)
                        side = Meta.Side.TOP;
                    else if (y2 >= primary.y + primary.height)
                        side = Meta.Side.BOTTOM;
                    else
                        continue;
                } else if (y1 <= primary.y && y2 >= primary.y + primary.height) {
                    if (x1 <= 0)
                        side = Meta.Side.LEFT;
                    else if (x2 >= global.screen_width)
                        side = Meta.Side.RIGHT;
                    else
                        continue;
                } else if (x1 <= 0)
                    side = Meta.Side.LEFT;
                else if (y1 <= 0)
                    side = Meta.Side.TOP;
                else if (x2 >= global.screen_width)
                    side = Meta.Side.RIGHT;
                else if (y2 >= global.screen_height)
                    side = Meta.Side.BOTTOM;
                else
                    continue;

                // Ensure that the strut rects goes all the way to the screen edge,
                // as this really what muffin expects.
                switch (side) {
                case Meta.Side.TOP:
                    y1 = 0;
                    break;
                case Meta.Side.BOTTOM:
                    y2 = global.screen_height;
                    break;
                case Meta.Side.LEFT:
                    x1 = 0;
                    break;
                case Meta.Side.RIGHT:
                    x2 = global.screen_width;
                    break;
                }

                let strutRect = new Meta.Rectangle({ x: x1, y: y1, width: x2 - x1, height: y2 - y1});
                let strut = new Meta.Strut({ rect: strutRect, side: side });
                struts.push(strut);
            }
        }

        let enable_stage = true;
        let top_windows = global.top_window_group.get_children();
        for (var i in top_windows){
            if (top_windows[i]._windowType != Meta.WindowType.TOOLTIP){
                enable_stage = false;
                break;
            }
        }
        if (enable_stage)
            global.set_stage_input_region(rects);
        else
            global.set_stage_input_region([]);

        let screen = global.screen;
        for (let w = 0; w < screen.n_workspaces; w++) {
            let workspace = screen.get_workspace_by_index(w);
            workspace.set_builtin_struts(struts);
        }

        return false;
    }
};
