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
const Panel = imports.ui.panel;
const Tweener = imports.ui.tweener;
const EdgeFlip = imports.ui.edgeFlip;
const HotCorner = imports.ui.hotCorner;
const DeskletManager = imports.ui.deskletManager;

const STARTUP_ANIMATION_TIME = 0.2;
const KEYBOARD_ANIMATION_TIME = 0.5;

const LAYOUT_TRADITIONAL = "traditional";
const LAYOUT_FLIPPED = "flipped";
const LAYOUT_CLASSIC = "classic";
const LAYOUT_CLASSIC_FLIPPED = "classic-flipped";

function LayoutManager() {
    this._init.apply(this, arguments);
}

LayoutManager.prototype = {
    _init: function () {
        this._rtl = (St.Widget.get_default_direction() == St.TextDirection.RTL);
        this.monitors = [];
        this._panels = [];
        this._panelBoxes = [];
        this.primaryMonitor = null;
        this.primaryIndex = -1;
        this.hotCornerManager = null;
        this.edgeRight = null;
        this.edgeLeft = null;
        this._chrome = new Chrome(this);
        this.enabledEdgeFlip = global.settings.get_boolean("enable-edge-flip");

        this.keyboardBox = new St.BoxLayout({ name: 'keyboardBox',
                                              reactive: true,
                                              track_hover: true });
        this.addChrome(this.keyboardBox, { visibleInFullscreen: true });
        this._keyboardHeightNotifyId = 0;

        this.setupDesktopLayout();
        this._monitorsChanged();
        this._processPanelSettings();

        global.settings.connect("changed::enable-edge-flip", Lang.bind(this, this._onEnableEdgeFlipChanged));
        global.settings.connect("changed::panel-scale-text-icons", Lang.bind(this, this._processPanelSettings))
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

    setupDesktopLayout: function() {
        this.setupDesktopLayout = null; // don't call again

        this._applet_side = St.Side.BOTTOM;
        this._desktop_layout = global.settings.get_string("desktop-panel-layout");
        let newLayoutString = "";
        
        if (this._desktop_layout == LAYOUT_FLIPPED) {
            newLayoutString = "top,top";
        }
        else if (this._desktop_layout == LAYOUT_TRADITIONAL) {
            newLayoutString = "bottom,bottom";
        }
        else if (this._desktop_layout == LAYOUT_CLASSIC) {
            newLayoutString = "top,top+bottom,bottom";
        }
        else if (this._desktop_layout == LAYOUT_CLASSIC_FLIPPED) {
            newLayoutString = "bottom,bottom+top,top";
        }
        else {
            newLayoutString = this._desktop_layout; // could be a data string
        }
        
        let panelData = [];
        let parse = Lang.bind(this, function(layoutString) {
            layoutString.trim().split('+').forEach(function(panelString, index) {
                let panelOpts = panelString.trim().split(',');
                let isBottom = !panelOpts[0] || panelOpts[0] != 'top';
                // we use strings to designate monitors, since the actual index may
                // change if monitors are rearranged during a session
                let monitorIndex = isBottom ? "bottomIndex" : "topIndex"
                let monitor = panelOpts.length > 1 ? panelOpts[1] : null;
                if (monitor) {
                    switch (monitor) {
                        case "top": monitorIndex = "topIndex";
                            break;
                        case "bottom": monitorIndex = "bottomIndex";
                            break;
                        case "left": monitorIndex = "leftIndex";
                            break;
                        case "right": monitorIndex = "rightIndex";
                            break;
                        default:
                            global.logError("Unknown monitor identifier: '" + monitor + "'");
                    }
                }
                panelData.push({
                    isBottom: isBottom,
                    monitorIndex: monitorIndex
                });
            }, this);
            return panelData.length > 0;
        });

        if (!parse(newLayoutString)) {
            parse("bottom,bottom"); // this should work if all else fails
        }

        panelData.forEach(function(data, index) {
            let isPrimary = index == 0;
            if (isPrimary) {
                this._applet_side = data.isBottom ? St.Side.BOTTOM : St.Side.TOP;
            }
            let box = new St.BoxLayout({ name: 'panelBox', vertical: true });
            this.addChrome(box, { addToWindowgroup: false });
            this._panelBoxes.push(box);

            let panel = new Panel.Panel(this, data.isBottom, isPrimary);
            box.add(panel.actor);
            box._panelData = data;
            panel.connect('height-changed', Lang.bind(this, this._processPanelSettings));
            this._panels.push(panel);
        }, this);
    },

    get desktop_layout() {
        return this._desktop_layout;
    },

    get applet_side() {
        return this._applet_side;
    },

    get panel() {
        return this._panels[0];
    },

    get panel2() {
        return this._panels[1];
    },

    get panelBox() {
        return this._panelBoxes[0];
    },

    enablePanels: function() {
        if (this._panels[0]) this._panels[0].enable();
        if (this._panels[1]) this._panels[1].enable();
    },

    disablePanels: function() {
        if (this._panels[0]) this._panels[0].disable();
        if (this._panels[1]) this._panels[1].disable();
    },

    _onEnableEdgeFlipChanged: function(){
        this.enabledEdgeFlip = global.settings.get_boolean("enable-edge-flip");
        this.edgeRight.enabled = this.enabledEdgeFlip;
        this.edgeLeft.enabled = this.enabledEdgeFlip;
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
        this.edgeRight = new EdgeFlip.EdgeFlipper(St.Side.RIGHT, Main.wm.actionMoveWorkspaceRight);
        this.edgeLeft = new EdgeFlip.EdgeFlipper(St.Side.LEFT, Main.wm.actionMoveWorkspaceLeft);

        this.edgeRight.enabled = this.enabledEdgeFlip;
        this.edgeLeft.enabled = this.enabledEdgeFlip;

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
        let panelResizable = global.settings.get_boolean("panel-resizable");
        let panelScalable = panelResizable && global.settings.get_boolean("panel-scale-text-icons");
        this._panels.forEach(function(panel, index) {
            let panelHeight = null;
            if (panelResizable) {
                if (panel.bottomPosition) {
                    panelHeight = global.settings.get_int("panel-bottom-height");
                }
                else {
                    panelHeight = global.settings.get_int("panel-top-height");
                }
            }
            panel._setPanelHeight(panelHeight, panelScalable);
            panel._hideable = global.settings.get_boolean(index == 0 ? "panel-autohide" : "panel2-autohide");
            // Show a glimpse of the panel irrespectively of the new setting,
            // in order to force a region update.
            // Techically, this should not be necessary if the function is called
            // when auto-hide is in effect and is not changing, but experience
            // shows that not flashing the panels may lead to "phantom panels"
            // where the panels should be if auto-hide was on.
            panel._hidePanel(true); // force hide
            panel._showPanel();
            if (panel._hideable) {
                panel._hidePanel();
            }
        }, this);
        this._updateBoxes();
    },
    
    _updateMonitors: function() {
        let screen = global.screen;

        this.monitors = [];
        let nMonitors = screen.get_n_monitors();
        for (let i = 0; i < nMonitors; i++)
            this.monitors.push(screen.get_monitor_geometry(i));

        this.primaryIndex = this.bottomIndex = this.topIndex = this.leftIndex = this.rightIndex = screen.get_primary_monitor();
        // If there are monitors below the primary, then we need
        // to split primary from bottom.
        for (let i = 0; i < this.monitors.length; i++) {
            let monitor = this.monitors[i];
            if (this._isAboveOrBelowPrimary(monitor)) {
                if (monitor.y > this.monitors[this.bottomIndex].y)
                    this.bottomIndex = i;
                if (monitor.y < this.monitors[this.topIndex].y)
                    this.topIndex = i;
            }
            else {
                if (monitor.x > this.monitors[this.rightIndex].x)
                    this.rightIndex = i;
                if (monitor.x < this.monitors[this.leftIndex].x)
                    this.leftIndex = i;
            }
        }
        this.primaryMonitor = this.monitors[this.primaryIndex];
        this.bottomMonitor = this.monitors[this.bottomIndex];
        this.topMonitor = this.monitors[this.topIndex];
    },

    _updateHotCorners: function() {
        if (this.hotCornerManager)
            this.hotCornerManager.updatePosition(this.topMonitor, this.bottomMonitor);
    },

    _getMonitor: function(index) {
        return this.monitors[this[index]];
    },

    _updateBoxes: function() {
        this._updateHotCorners();

        this._panelBoxes.forEach(function(box, index) {
            let panel = this._panels[index];
            let height = panel.actor.get_height();
            let monitor = this._getMonitor(box._panelData.monitorIndex);
            panel.setCurrentMonitor(monitor);
            box.set_size(monitor.width, height);
            if (box._panelData.isBottom) {
                box.set_position(monitor.x, monitor.y + monitor.height - height);
            }
            else {
                box.set_position(monitor.x, monitor.y);
            }
            this._updatePanelBarriers(box);
            this._chrome.modifyActorParams(box, { affectsStruts: !panel.isHideable() });
        }, this);

        this.keyboardBox.set_position(this.bottomMonitor.x,
                                      this.bottomMonitor.y + this.bottomMonitor.height);
        this.keyboardBox.set_size(this.bottomMonitor.width, -1);
        this._chrome._queueUpdateRegions();
    },

    _updatePanelBarriers: function(panelBox) {
        let leftPanelBarrier = panelBox._panelData.leftPanelBarrier;
        let rightPanelBarrier = panelBox._panelData.rightPanelBarrier;
        if (leftPanelBarrier) {
            global.destroy_pointer_barrier(leftPanelBarrier);
            global.destroy_pointer_barrier(rightPanelBarrier);
        }

        if (panelBox.height) {
            let monitor = this._getMonitor(panelBox._panelData.monitorIndex);
            if (panelBox._panelData.isBottom)
            {
                leftPanelBarrier = global.create_pointer_barrier(monitor.x, monitor.y + monitor.height - panelBox.height,
                                                                 monitor.x, monitor.y + monitor.height,
                                                                 1 /* BarrierPositiveX */);
                rightPanelBarrier = global.create_pointer_barrier(monitor.x + monitor.width, monitor.y + monitor.height - panelBox.height,
                                                                  monitor.x + monitor.width, monitor.y + monitor.height,
                                                                  4 /* BarrierNegativeX */);
            }
            else {
                leftPanelBarrier = global.create_pointer_barrier(monitor.x, monitor.y,
                                                                 monitor.x, monitor.y + panelBox.height,
                                                                 1 /* BarrierPositiveX */);
                rightPanelBarrier = global.create_pointer_barrier(monitor.x + monitor.width, monitor.y,
                                                                  monitor.x + monitor.width, monitor.y + panelBox.height,
                                                                  4 /* BarrierNegativeX */);
            }
        }
        panelBox._panelData.leftPanelBarrier = leftPanelBarrier;
        panelBox._panelData.rightPanelBarrier = rightPanelBarrier;
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

        this._panelBoxes.forEach(function(box) {
            box.anchor_y = box._panelData.isBottom ? -box.height : box.height;
            Tweener.addTween(box, params);
        }, this);
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

        for (i = 0; i < this._trackedActors.length; i++) {
            let actorData = this._trackedActors[i];
            if ((!actorData.affectsInputRegion && !actorData.affectsStruts) ||
                 primary.inFullscreen)
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
