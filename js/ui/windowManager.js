// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const AltTab = imports.ui.altTab;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const WINDOW_ANIMATION_TIME = 0.25;
const DIM_TIME = 0.500;
const UNDIM_TIME = 0.250;

var dimShader = undefined;

function getDimShaderSource() {
    if (!dimShader)
        dimShader = Cinnamon.get_file_contents_utf8_sync(global.datadir + '/shaders/dim-window.glsl');
    return dimShader;
}

function getTopInvisibleBorder(metaWindow) {
    let outerRect = metaWindow.get_outer_rect();
    let inputRect = metaWindow.get_input_rect();
    return outerRect.y - inputRect.y;
}

function WindowDimmer(actor) {
    this._init(actor);
}

WindowDimmer.prototype = {
    _init: function(actor) {
        if (Clutter.feature_available(Clutter.FeatureFlags.SHADERS_GLSL)) {
            this._effect = new Clutter.ShaderEffect({ shader_type: Clutter.ShaderType.FRAGMENT_SHADER });
            this._effect.set_shader_source(getDimShaderSource());
        } else {
            this._effect = null;
        }

        this.actor = actor;
    },

    set dimFraction(fraction) {
        this._dimFraction = fraction;

        if (this._effect == null)
            return;

        if (!Meta.prefs_get_attach_modal_dialogs()) {
            this._effect.enabled = false;
            return;
        }

        if (fraction > 0.01) {
            Cinnamon.shader_effect_set_double_uniform(this._effect, 'height', this.actor.get_height());
            Cinnamon.shader_effect_set_double_uniform(this._effect, 'fraction', fraction);

            if (!this._effect.actor)
                this.actor.add_effect(this._effect);
        } else {
            if (this._effect.actor)
                this.actor.remove_effect(this._effect);
        }
    },

    get dimFraction() {
        return this._dimFraction;
    },

    _dimFraction: 0.0
};

function getWindowDimmer(actor) {
    if (!actor._windowDimmer)
        actor._windowDimmer = new WindowDimmer(actor);

    return actor._windowDimmer;
}

function WindowManager() {
    this._init();
}

WindowManager.prototype = {
    _init : function() {
        this._cinnamonwm =  global.window_manager;

        this._keyBindingHandlers = [];
        this._minimizing = [];
        this._maximizing = [];
        this._unmaximizing = [];
        this._mapping = [];
        this._destroying = [];

        this._dimmedWindows = [];

        this._animationBlockCount = 0;

        this._switchData = null;
        this._cinnamonwm.connect('kill-switch-workspace', Lang.bind(this, this._switchWorkspaceDone));
        this._cinnamonwm.connect('kill-window-effects', Lang.bind(this, function (cinnamonwm, actor) {
            this._minimizeWindowDone(cinnamonwm, actor);
            this._maximizeWindowDone(cinnamonwm, actor);
            this._unmaximizeWindowDone(cinnamonwm, actor);
            this._mapWindowDone(cinnamonwm, actor);
            this._destroyWindowDone(cinnamonwm, actor);
        }));

        this._cinnamonwm.connect('switch-workspace', Lang.bind(this, this._switchWorkspace));
        this._cinnamonwm.connect('minimize', Lang.bind(this, this._minimizeWindow));
        this._cinnamonwm.connect('maximize', Lang.bind(this, this._maximizeWindow));
        this._cinnamonwm.connect('unmaximize', Lang.bind(this, this._unmaximizeWindow));
        this._cinnamonwm.connect('map', Lang.bind(this, this._mapWindow));
        this._cinnamonwm.connect('destroy', Lang.bind(this, this._destroyWindow));
        
        this.setKeybindingHandler('switch_to_workspace_left', Lang.bind(this, this._showWorkspaceSwitcher));
        this.setKeybindingHandler('switch_to_workspace_right', Lang.bind(this, this._showWorkspaceSwitcher));
        this.setKeybindingHandler('switch_to_workspace_up', Lang.bind(this, this._showWorkspaceSwitcher));
        this.setKeybindingHandler('switch_to_workspace_down', Lang.bind(this, this._showWorkspaceSwitcher));
        this.setKeybindingHandler('switch_windows', Lang.bind(this, this._startAppSwitcher));
        this.setKeybindingHandler('switch_group', Lang.bind(this, this._startAppSwitcher));
        this.setKeybindingHandler('switch_windows_backward', Lang.bind(this, this._startAppSwitcher));
        this.setKeybindingHandler('switch_group_backward', Lang.bind(this, this._startAppSwitcher));
        this.setKeybindingHandler('switch_panels', Lang.bind(this, this._startA11ySwitcher));

        Main.overview.connect('showing', Lang.bind(this, function() {
            for (let i = 0; i < this._dimmedWindows.length; i++)
                this._undimWindow(this._dimmedWindows[i], true);
        }));
        Main.overview.connect('hiding', Lang.bind(this, function() {
            for (let i = 0; i < this._dimmedWindows.length; i++)
                this._dimWindow(this._dimmedWindows[i], true);
        }));
    },

    setKeybindingHandler: function(keybinding, handler){
        if (this._keyBindingHandlers[keybinding])
            this._cinnamonwm.disconnect(this._keyBindingHandlers[keybinding]);
        else
            this._cinnamonwm.takeover_keybinding(keybinding);

        this._keyBindingHandlers[keybinding] =
            this._cinnamonwm.connect('keybinding::' + keybinding, handler);
    },

    blockAnimations: function() {
        this._animationBlockCount++;
    },

    unblockAnimations: function() {
        this._animationBlockCount = Math.max(0, this._animationBlockCount - 1);
    },

    _shouldAnimate : function(actor) {
        if (Main.overview.visible || this._animationsBlocked > 0)
            return false;
        if (actor && (actor.meta_window.get_window_type() != Meta.WindowType.NORMAL))
            return false;
        return true;
    },

    _removeEffect : function(list, actor) {
        let idx = list.indexOf(actor);
        if (idx != -1) {
            list.splice(idx, 1);
            return true;
        }
        return false;
    },

    _minimizeWindow : function(cinnamonwm, actor) {
        if (!this._shouldAnimate(actor)) {
            cinnamonwm.completed_minimize(actor);
            return;
        }

        actor.set_scale(1.0, 1.0);
        actor.move_anchor_point_from_gravity(Clutter.Gravity.CENTER);

        /* scale window down to 0x0.
         * maybe TODO: get icon geometry passed through and move the window towards it?
         */
        this._minimizing.push(actor);

        let monitor;
        let yDest;
        
        if (Main.desktop_layout == Main.LAYOUT_TRADITIONAL) {
            monitor = Main.layoutManager.bottomMonitor;
            yDest = monitor.height;
        }
        else {
            monitor = Main.layoutManager.primaryMonitor;
            yDest = 0;
        }
        
        let xDest = monitor.x + monitor.width/4;
        if (St.Widget.get_default_direction() == St.TextDirection.RTL)
            xDest = monitor.width - monitor.width/4;
        

        Tweener.addTween(actor,
                         { scale_x: 0.0,
                           scale_y: 0.0,
                           x: xDest,
                           y: yDest,
                           time: WINDOW_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onComplete: this._minimizeWindowDone,
                           onCompleteScope: this,
                           onCompleteParams: [cinnamonwm, actor],
                           onOverwrite: this._minimizeWindowOverwritten,
                           onOverwriteScope: this,
                           onOverwriteParams: [cinnamonwm, actor]
                         });
    },

    _minimizeWindowDone : function(cinnamonwm, actor) {
        if (this._removeEffect(this._minimizing, actor)) {
            Tweener.removeTweens(actor);
            actor.set_scale(1.0, 1.0);
            actor.move_anchor_point_from_gravity(Clutter.Gravity.NORTH_WEST);

            cinnamonwm.completed_minimize(actor);
        }
    },

    _minimizeWindowOverwritten : function(cinnamonwm, actor) {
        if (this._removeEffect(this._minimizing, actor)) {
            cinnamonwm.completed_minimize(actor);
        }
    },

    _maximizeWindow : function(cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
        cinnamonwm.completed_maximize(actor);
    },

    _maximizeWindowDone : function(cinnamonwm, actor) {
    },

    _maximizeWindowOverwrite : function(cinnamonwm, actor) {
    },

    _unmaximizeWindow : function(cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
        cinnamonwm.completed_unmaximize(actor);
    },

    _unmaximizeWindowDone : function(cinnamonwm, actor) {
    },

    _hasAttachedDialogs: function(window, ignoreWindow) {
        var count = 0;
        window.foreach_transient(function(win) {
            if (win != ignoreWindow && win.is_attached_dialog())
                count++;
            return false;
        });
        return count != 0;
    },

    _checkDimming: function(window, ignoreWindow) {
        let shouldDim = this._hasAttachedDialogs(window, ignoreWindow);

        if (shouldDim && !window._dimmed) {
            window._dimmed = true;
            this._dimmedWindows.push(window);
            if (!Main.overview.visible)
                this._dimWindow(window, true);
        } else if (!shouldDim && window._dimmed) {
            window._dimmed = false;
            this._dimmedWindows = this._dimmedWindows.filter(function(win) {
                                                                 return win != window;
                                                             });
            if (!Main.overview.visible)
                this._undimWindow(window, true);
        }
    },

    _dimWindow: function(window, animate) {
        let actor = window.get_compositor_private();
        if (!actor)
            return;
        if (animate)
            Tweener.addTween(getWindowDimmer(actor),
                             { dimFraction: 1.0,
                               time: DIM_TIME,
                               transition: 'linear'
                             });
        else
            getWindowDimmer(actor).dimFraction = 1.0;
    },

    _undimWindow: function(window, animate) {
        let actor = window.get_compositor_private();
        if (!actor)
            return;
        if (animate)
            Tweener.addTween(getWindowDimmer(actor),
                             { dimFraction: 0.0,
                               time: UNDIM_TIME,
                               transition: 'linear'
                             });
        else
            getWindowDimmer(actor).dimFraction = 0.0;
    },

    _mapWindow : function(cinnamonwm, actor) {
        actor._windowType = actor.meta_window.get_window_type();
        actor._notifyWindowTypeSignalId = actor.meta_window.connect('notify::window-type', Lang.bind(this, function () {
            let type = actor.meta_window.get_window_type();
            if (type == actor._windowType)
                return;
            if (type == Meta.WindowType.MODAL_DIALOG ||
                actor._windowType == Meta.WindowType.MODAL_DIALOG) {
                let parent = actor.get_meta_window().get_transient_for();
                if (parent)
                    this._checkDimming(parent);
            }

            actor._windowType = type;
        }));
        if (actor.meta_window.is_attached_dialog()) {
            this._checkDimming(actor.get_meta_window().get_transient_for());
            if (this._shouldAnimate()) {
                actor.set_scale(1.0, 0.0);
                actor.show();
                this._mapping.push(actor);

                Tweener.addTween(actor,
                                 { scale_y: 1,
                                   time: WINDOW_ANIMATION_TIME,
                                   transition: "easeOutQuad",
                                   onComplete: this._mapWindowDone,
                                   onCompleteScope: this,
                                   onCompleteParams: [cinnamonwm, actor],
                                   onOverwrite: this._mapWindowOverwrite,
                                   onOverwriteScope: this,
                                   onOverwriteParams: [cinnamonwm, actor]
                                 });
                return;
            }
            cinnamonwm.completed_map(actor);
            return;
        }
        if (!this._shouldAnimate(actor)) {
            cinnamonwm.completed_map(actor);
            return;
        }

        actor.opacity = 0;
        actor.show();

        /* Fade window in */
        this._mapping.push(actor);
        Tweener.addTween(actor,
                         { opacity: 255,
                           time: WINDOW_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onComplete: this._mapWindowDone,
                           onCompleteScope: this,
                           onCompleteParams: [cinnamonwm, actor],
                           onOverwrite: this._mapWindowOverwrite,
                           onOverwriteScope: this,
                           onOverwriteParams: [cinnamonwm, actor]
                         });
    },

    _mapWindowDone : function(cinnamonwm, actor) {
        if (this._removeEffect(this._mapping, actor)) {
            Tweener.removeTweens(actor);
            actor.opacity = 255;
            cinnamonwm.completed_map(actor);
        }
    },

    _mapWindowOverwrite : function(cinnamonwm, actor) {
        if (this._removeEffect(this._mapping, actor)) {
            cinnamonwm.completed_map(actor);
        }
    },

    _destroyWindow : function(cinnamonwm, actor) {
        let window = actor.meta_window;
        if (actor._notifyWindowTypeSignalId) {
            window.disconnect(actor._notifyWindowTypeSignalId);
            actor._notifyWindowTypeSignalId = 0;
        }
        if (window._dimmed) {
            this._dimmedWindows = this._dimmedWindows.filter(function(win) {
                                                                 return win != window;
                                                             });
        }
        if (window.is_attached_dialog()) {
            let parent = window.get_transient_for();
            this._checkDimming(parent, window);
            if (!this._shouldAnimate()) {
                cinnamonwm.completed_destroy(actor);
                return;
            }

            actor.set_scale(1.0, 1.0);
            actor.show();
            this._destroying.push(actor);

            actor._parentDestroyId = parent.connect('unmanaged', Lang.bind(this, function () {
                Tweener.removeTweens(actor);
                this._destroyWindowDone(cinnamonwm, actor);
            }));

            Tweener.addTween(actor,
                             { scale_y: 0,
                               time: WINDOW_ANIMATION_TIME,
                               transition: "easeOutQuad",
                               onComplete: this._destroyWindowDone,
                               onCompleteScope: this,
                               onCompleteParams: [cinnamonwm, actor],
                               onOverwrite: this._destroyWindowDone,
                               onOverwriteScope: this,
                               onOverwriteParams: [cinnamonwm, actor]
                             });
            return;
        }
        cinnamonwm.completed_destroy(actor);
    },

    _destroyWindowDone : function(cinnamonwm, actor) {
        if (this._removeEffect(this._destroying, actor)) {
            let parent = actor.get_meta_window().get_transient_for();
            if (parent && actor._parentDestroyId) {
                parent.disconnect(actor._parentDestroyId);
                actor._parentDestroyId = 0;
            }
            cinnamonwm.completed_destroy(actor);
        }
    },

    _switchWorkspace : function(cinnamonwm, from, to, direction) {
        if (!this._shouldAnimate()) {
            cinnamonwm.completed_switch_workspace();
            return;
        }

        let windows = global.get_window_actors();

        /* @direction is the direction that the "camera" moves, so the
         * screen contents have to move one screen's worth in the
         * opposite direction.
         */
        let xDest = 0, yDest = 0;

        if (direction == Meta.MotionDirection.UP ||
            direction == Meta.MotionDirection.UP_LEFT ||
            direction == Meta.MotionDirection.UP_RIGHT)
                yDest = global.screen_height;
        else if (direction == Meta.MotionDirection.DOWN ||
            direction == Meta.MotionDirection.DOWN_LEFT ||
            direction == Meta.MotionDirection.DOWN_RIGHT)
                yDest = -global.screen_height;

        if (direction == Meta.MotionDirection.LEFT ||
            direction == Meta.MotionDirection.UP_LEFT ||
            direction == Meta.MotionDirection.DOWN_LEFT)
                xDest = global.screen_width;
        else if (direction == Meta.MotionDirection.RIGHT ||
                 direction == Meta.MotionDirection.UP_RIGHT ||
                 direction == Meta.MotionDirection.DOWN_RIGHT)
                xDest = -global.screen_width;

        let switchData = {};
        this._switchData = switchData;
        switchData.inGroup = new Clutter.Group();
        switchData.outGroup = new Clutter.Group();
        switchData.windows = [];

        let wgroup = global.window_group;
        wgroup.add_actor(switchData.inGroup);
        wgroup.add_actor(switchData.outGroup);

        for (let i = 0; i < windows.length; i++) {
            let window = windows[i];

            if (!window.meta_window.showing_on_its_workspace())
                continue;

            if (window.get_workspace() == from) {
                switchData.windows.push({ window: window,
                                          parent: window.get_parent() });
                window.reparent(switchData.outGroup);
            } else if (window.get_workspace() == to) {
                switchData.windows.push({ window: window,
                                          parent: window.get_parent() });
                window.reparent(switchData.inGroup);
                window.show_all();
            }
        }

        switchData.inGroup.set_position(-xDest, -yDest);
        switchData.inGroup.raise_top();

        Tweener.addTween(switchData.outGroup,
                         { x: xDest,
                           y: yDest,
                           time: WINDOW_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onComplete: this._switchWorkspaceDone,
                           onCompleteScope: this,
                           onCompleteParams: [cinnamonwm]
                         });
        Tweener.addTween(switchData.inGroup,
                         { x: 0,
                           y: 0,
                           time: WINDOW_ANIMATION_TIME,
                           transition: 'easeOutQuad'
                         });
    },

    _switchWorkspaceDone : function(cinnamonwm) {
        let switchData = this._switchData;
        if (!switchData)
            return;
        this._switchData = null;

        for (let i = 0; i < switchData.windows.length; i++) {
                let w = switchData.windows[i];
                if (w.window.is_destroyed()) // Window gone
                    continue;
                if (w.window.get_parent() == switchData.outGroup) {
                    w.window.reparent(w.parent);
                    w.window.hide();
                } else
                    w.window.reparent(w.parent);
        }
        Tweener.removeTweens(switchData.inGroup);
        Tweener.removeTweens(switchData.outGroup);
        switchData.inGroup.destroy();
        switchData.outGroup.destroy();

        cinnamonwm.completed_switch_workspace();
    },

    _startAppSwitcher : function(cinnamonwm, binding, mask, window, backwards) {
        
        let tabPopup = new AltTab.AltTabPopup();

        if (!tabPopup.show(backwards, binding, mask))
            tabPopup.destroy();
    },

    _startA11ySwitcher : function(cinnamonwm, binding, mask, window, backwards) {
        
    },

    _showWorkspaceSwitcher : function(cinnamonwm, binding, mask, window, backwards) {
        if (binding == 'switch_to_workspace_up') {
        	Main.overview.toggle();
        	return;                   
        }
        if (binding == 'switch_to_workspace_down') {
            Main.overview.toggle();
            return;
        }
        
        if (global.screen.n_workspaces == 1)
            return;

        if (binding == 'switch_to_workspace_left')
           this.actionMoveWorkspaceLeft();
        else if (binding == 'switch_to_workspace_right')
           this.actionMoveWorkspaceRight();
    },

    actionMoveWorkspaceLeft: function() {
        let rtl = (St.Widget.get_default_direction() == St.TextDirection.RTL);
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let indexToActivate = activeWorkspaceIndex;
        if (rtl && activeWorkspaceIndex < global.screen.n_workspaces - 1)
            indexToActivate++;
        else if (!rtl && activeWorkspaceIndex > 0)
            indexToActivate--;

        if (indexToActivate != activeWorkspaceIndex)
            global.screen.get_workspace_by_index(indexToActivate).activate(global.get_current_time());        
    },

    actionMoveWorkspaceRight: function() {
        let rtl = (St.Widget.get_default_direction() == St.TextDirection.RTL);
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let indexToActivate = activeWorkspaceIndex;
        if (rtl && activeWorkspaceIndex > 0)
            indexToActivate--;
        else if (!rtl && activeWorkspaceIndex < global.screen.n_workspaces - 1)
            indexToActivate++;

        if (indexToActivate != activeWorkspaceIndex)
            global.screen.get_workspace_by_index(indexToActivate).activate(global.get_current_time());        
    },

    actionMoveWorkspaceUp: function() {
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let indexToActivate = activeWorkspaceIndex;
        if (activeWorkspaceIndex > 0)
            indexToActivate--;

        if (indexToActivate != activeWorkspaceIndex)
            global.screen.get_workspace_by_index(indexToActivate).activate(global.get_current_time());        
    },

    actionMoveWorkspaceDown: function() {
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let indexToActivate = activeWorkspaceIndex;
        if (activeWorkspaceIndex < global.screen.n_workspaces - 1)
            indexToActivate++;

        if (indexToActivate != activeWorkspaceIndex)
            global.screen.get_workspace_by_index(indexToActivate).activate(global.get_current_time());        
    }
};
