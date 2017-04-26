// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Signals = imports.signals;

const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Workspace = imports.ui.workspace;

const WORKSPACE_SWITCH_TIME = 0.25;

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

function WorkspacesView(workspaces) {
    this._init(workspaces);
}

WorkspacesView.prototype = {
    _init: function(workspaces) {
        this.actor = new St.Widget({ style_class: 'workspaces-view' });

        // The actor itself isn't a drop target, so we don't want to pick on its area
        this.actor.set_size(0, 0);

        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));

        // does not work:
        // this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));

        this.actor.connect('style-changed', Lang.bind(this,
            function() {
                let node = this.actor.get_theme_node();
                this._spacing = node.get_length('spacing');
                this._updateWorkspaceActors(false);
            }));
        this.actor.connect('notify::mapped', Lang.bind(this, this._onMappedChanged));

        this._width = 0;
        this._height = 0;
        this._x = 0;
        this._y = 0;
        this._workspaceRatioSpacing = 0;
        this._spacing = 0;
        this._animating = false; // tweening
        this._scrolling = false; // swipe-scrolling
        this._animatingScroll = false; // programatically updating the adjustment

        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        this._workspaces = [];
        for (let i = 0; i < global.screen.n_workspaces; i++) {
            let metaWorkspace = global.screen.get_workspace_by_index(i);
            this._workspaces[i] = new Workspace.Workspace(metaWorkspace, this);
            this.actor.add_actor(this._workspaces[i].actor);
        }
        this._workspaces[activeWorkspaceIndex].actor.raise_top();

        // Position/scale the desktop windows and their children after the
        // workspaces have been created. This cannot be done first because
        // window movement depends on the Workspaces object being accessible
        // as an Overview member.
        let overviewShowingId = Main.overview.connect('showing', Lang.bind(this, function() {
            Main.overview.disconnect(overviewShowingId);
            let workspaceIndex = global.screen.get_active_workspace_index();
            this._workspaces[workspaceIndex].zoomToOverview();
        }));

        this._scrollAdjustment = new St.Adjustment({ value: activeWorkspaceIndex,
                                                     lower: 0,
                                                     page_increment: 1,
                                                     page_size: 1,
                                                     step_increment: 0,
                                                     upper: this._workspaces.length });
        this._scrollAdjustment.connect('notify::value',
                                       Lang.bind(this, this._onScroll));


        this._swipeScrollBeginId = 0;
        this._swipeScrollEndId = 0;

        let restackedNotifyId = global.screen.connect('restacked', Lang.bind(this, this._onRestacked));
        let switchWorkspaceNotifyId = global.window_manager.connect('switch-workspace',
                                          Lang.bind(this, this._activeWorkspaceChanged));

        let nWorkspacesChangedId = global.screen.connect('notify::n-workspaces', Lang.bind(this, this._workspacesChanged));

        this._disconnectHandlers = function() {
            global.window_manager.disconnect(switchWorkspaceNotifyId);
            global.screen.disconnect(nWorkspacesChangedId);
            global.screen.disconnect(restackedNotifyId);
        };

        this._onRestacked();
        this.actor.connect('key-press-event', Lang.bind(this, this._onStageKeyPress));
        global.stage.set_key_focus(this.actor);

        let primary = Main.layoutManager.primaryMonitor;
        this.setGeometry(primary.x, primary.y, primary.width, primary.height, 0);
    },

    _onStageKeyPress: function(actor, event) {
        let modifiers = Cinnamon.get_event_state(event);
        let symbol = event.get_key_symbol();

        if (symbol == Clutter.Escape)
        {
            Main.overview.hide();
            return true;
        }
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let activeWorkspace = this._workspaces[activeWorkspaceIndex];
        return activeWorkspace._onKeyPress(actor, event);
    },

    setGeometry: function(x, y, width, height, spacing) {
        this._width = width;
        this._height = height;
        this._x = x;
        this._y = y;
        this._workspaceRatioSpacing = spacing;
    },

    getActiveWorkspace: function() {
        let active = global.screen.get_active_workspace_index();
        return this._workspaces[active];
    },

    getWorkspaceByIndex: function(index) {
        return this._workspaces[index];
    },

    hide: function() {
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let activeWorkspace = this._workspaces[activeWorkspaceIndex];

        activeWorkspace.actor.raise_top();
        activeWorkspace.zoomFromOverview();
    },

    destroy: function() {
        for (let w = 0; w < this._workspaces.length; w++) {
            this._workspaces[w].disconnectAll();
            this._workspaces[w].destroy();
        }
        this.actor.destroy();
    },

    updateWindowPositions: function() {
        for (let w = 0; w < this._workspaces.length; w++)
            this._workspaces[w].positionWindows(Workspace.WindowPositionFlags.ANIMATE);
    },

    _scrollToActive: function(showAnimation) {
        let active = global.screen.get_active_workspace_index();

        this._updateWorkspaceActors(showAnimation);
        Main.wm.showWorkspaceOSD();
        this._updateScrollAdjustment(active, showAnimation);
    },

    // Update workspace actors parameters
    // @showAnimation: iff %true, transition between states
    _updateWorkspaceActors: function(showAnimation) {
        let active = global.screen.get_active_workspace_index();

        // Animation is turned off in a multi-manager scenario till we fix 
        // the animations so that they respect the monitor boundaries.
        this._animating = Main.layoutManager.monitors.length < 2 && showAnimation;

        for (let w = 0; w < this._workspaces.length; w++) {
            let workspace = this._workspaces[w];

            Tweener.removeTweens(workspace.actor);

            let x = (w - active) * (this._width + this._spacing + this._workspaceRatioSpacing);

            if (this._animating) {
                let params = { x: x,
                               time: WORKSPACE_SWITCH_TIME,
                               transition: 'easeOutQuad'
                             };
                // we have to call _updateVisibility() once before the
                // animation and once afterwards - it does not really
                // matter which tween we use, so we pick the first one ...
                if (w == 0) {
                    this._updateVisibility();
                    params.onComplete = Lang.bind(this,
                        function() {
                            this._animating = false;
                            this._updateVisibility();
                        });
                }
                Tweener.addTween(workspace.actor, params);
            } else {
                workspace.actor.set_position(x, 0);
                if (w == 0)
                    this._updateVisibility();
            }
        }
    },

    _updateVisibility: function() {
        let active = global.screen.get_active_workspace_index();

        for (let w = 0; w < this._workspaces.length; w++) {
            let workspace = this._workspaces[w];
            if (this._animating || this._scrolling) {
                workspace.hideWindowsOverlays();
                workspace.actor.show();
            } else {
                workspace.showWindowsOverlays();
                workspace.actor.visible = (w == active);
            }
        }
    },

    _updateScrollAdjustment: function(index, showAnimation) {
        if (this._scrolling)
            return;

        this._animatingScroll = true;

        if (showAnimation) {
            Tweener.addTween(this._scrollAdjustment, {
               value: index,
               time: WORKSPACE_SWITCH_TIME,
               transition: 'easeOutQuad',
               onComplete: Lang.bind(this,
                   function() {
                       this._animatingScroll = false;
                   })
            });
        } else {
            this._scrollAdjustment.value = index;
            this._animatingScroll = false;
        }
        let active = global.screen.get_active_workspace_index();
        this._workspaces[active].zoomToOverview();
    },

    _workspacesChanged: function() {
        let removedCount = 0;
        this._workspaces.slice().forEach(function(workspace, i) {
            let metaWorkspace = global.screen.get_workspace_by_index(i-removedCount);
            if (workspace.metaWorkspace != metaWorkspace) {
                Tweener.removeTweens(workspace.actor);
                workspace.destroy();
                this._workspaces.splice(i - removedCount, 1);
                ++removedCount;
            }
        }, this);

        while (global.screen.n_workspaces > this._workspaces.length) {
            let lastWs = global.screen.get_workspace_by_index(this._workspaces.length);
            let workspace = new Workspace.Workspace(lastWs, this);
            this._workspaces.push(workspace)
            this.actor.add_actor(workspace.actor);
        }
        this._animating = false;
        this._updateVisibility();
    },

    _activeWorkspaceChanged: function(wm, from, to, direction) {
        if (this._scrolling)
            return;

        this._scrollToActive(true);
    },

    _onDestroy: function() {
        this._scrollAdjustment.run_dispose();
        this._disconnectHandlers();
    },

    _onMappedChanged: function() {
        if (this.actor.mapped) {
            let direction = SwipeScrollDirection.HORIZONTAL;
            Main.overview.setScrollAdjustment(this._scrollAdjustment,
                                              direction);
            this._swipeScrollBeginId = Main.overview.connect('swipe-scroll-begin',
                                                             Lang.bind(this, this._swipeScrollBegin));
            this._swipeScrollEndId = Main.overview.connect('swipe-scroll-end',
                                                           Lang.bind(this, this._swipeScrollEnd));
        } else {
            Main.overview.disconnect(this._swipeScrollBeginId);
            Main.overview.disconnect(this._swipeScrollEndId);
        }
    },

    _swipeScrollBegin: function() {
        this._scrolling = true;
    },

    _swipeScrollEnd: function(overview, result) {
        this._scrolling = false;

        if (result == SwipeScrollResult.CLICK) {
            let [x, y, mod] = global.get_pointer();
            let actor = global.stage.get_actor_at_pos(Clutter.PickMode.ALL,
                                                      x, y);

            // Only switch to the workspace when there's no application
            // windows open. The problem is that it's too easy to miss
            // an app window and get the wrong one focused.
            let active = global.screen.get_active_workspace_index();
            if (this._workspaces[active].isEmpty() &&
                this.actor.contains(actor))
                Main.overview.hide();
        }

        // Make sure title captions etc are shown as necessary
        this._updateVisibility();
    },

    _onRestacked: function() {
        let stack = global.get_window_actors().reverse();
        let stackIndices = {};

        for (let i = 0; i < stack.length; i++) {
            // Use the stable sequence for an integer to use as a hash key
            stackIndices[stack[i].get_meta_window().get_stable_sequence()] = i;
        }

        for (let j = 0; j < this._workspaces.length; j++)
            this._workspaces[j].syncStacking(stackIndices);
    },

    // sync the workspaces' positions to the value of the scroll adjustment
    // and change the active workspace if appropriate
    _onScroll: function(adj) {
        if (this._animatingScroll)
            return;

        let active = global.screen.get_active_workspace_index();
        let current = Math.round(adj.value);

        if (active != current) {
            let metaWorkspace = this._workspaces[current].metaWorkspace;
            metaWorkspace.activate(global.get_current_time());
        }

        let last = this._workspaces.length - 1;
        let firstWorkspaceX = this._workspaces[0].actor.x;
        let lastWorkspaceX = this._workspaces[last].actor.x;
        let workspacesWidth = lastWorkspaceX - firstWorkspaceX;

        if (adj.upper == 1)
            return;

        let currentX = firstWorkspaceX;
        let newX =  - adj.value / (adj.upper - 1) * workspacesWidth;

        let dx = newX - currentX;

        for (let i = 0; i < this._workspaces.length; i++) {
            this._workspaces[i].hideWindowsOverlays();
            this._workspaces[i].actor.visible = Math.abs(i - adj.value) <= 1;
            this._workspaces[i].actor.x += dx;
        }
    },

    _onScrollEvent: function (actor, event) {
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
Signals.addSignalMethods(WorkspacesView.prototype);
