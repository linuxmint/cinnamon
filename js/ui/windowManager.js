// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Mainloop = imports.mainloop;

const AppletManager = imports.ui.appletManager;
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
        
        Meta.keybindings_set_custom_handler('move-to-workspace-left',
                                            Lang.bind(this, this._moveWindowToWorkspaceLeft));
        Meta.keybindings_set_custom_handler('move-to-workspace-right',
                                            Lang.bind(this, this._moveWindowToWorkspaceRight));
        
        Meta.keybindings_set_custom_handler('switch-to-workspace-left',
                                            Lang.bind(this, this._showWorkspaceSwitcher));
        Meta.keybindings_set_custom_handler('switch-to-workspace-right',
                                            Lang.bind(this, this._showWorkspaceSwitcher));
        Meta.keybindings_set_custom_handler('switch-to-workspace-up',
                                            Lang.bind(this, this._showWorkspaceSwitcher));
        Meta.keybindings_set_custom_handler('switch-to-workspace-down',
                                            Lang.bind(this, this._showWorkspaceSwitcher));
        Meta.keybindings_set_custom_handler('switch-windows',
                                            Lang.bind(this, this._startAppSwitcher));
        Meta.keybindings_set_custom_handler('switch-group',
                                            Lang.bind(this, this._startAppSwitcher));
        Meta.keybindings_set_custom_handler('switch-windows-backward',
                                            Lang.bind(this, this._startAppSwitcher));
        Meta.keybindings_set_custom_handler('switch-group-backward',
                                            Lang.bind(this, this._startAppSwitcher));
        Meta.keybindings_set_custom_handler('switch-panels',
                                            Lang.bind(this, this._startA11ySwitcher));

        Main.overview.connect('showing', Lang.bind(this, function() {
            for (let i = 0; i < this._dimmedWindows.length; i++)
                this._undimWindow(this._dimmedWindows[i], true);
        }));
        Main.overview.connect('hiding', Lang.bind(this, function() {
            for (let i = 0; i < this._dimmedWindows.length; i++)
                this._dimWindow(this._dimmedWindows[i], true);
        }));
    },

    blockAnimations: function() {
        this._animationBlockCount++;
    },

    unblockAnimations: function() {
        this._animationBlockCount = Math.max(0, this._animationBlockCount - 1);
    },

    _shouldAnimate : function(actor) {
        if (Main.modalCount) {
            // system is in modal state
            return false;
        }
        if (Main.software_rendering)
            return false;
        if (this._animationsBlocked > 0)
            return false;
        if (!actor)
            return global.settings.get_boolean("desktop-effects");
        let type = actor.meta_window.get_window_type();
        if (type == Meta.WindowType.NORMAL) {
            return global.settings.get_boolean("desktop-effects");
        }
        if (type == Meta.WindowType.DIALOG || type == Meta.WindowType.MODAL_DIALOG) {
            return global.settings.get_boolean("desktop-effects-on-dialogs");
        }
        return false;
    },

    _removeEffect : function(list, actor) {
        let idx = list.indexOf(actor);
        if (idx != -1) {
            list.splice(idx, 1);
            return true;
        }
        return false;
    },
    
    
    _fadeWindow: function(cinnamonwm, actor, opacity, time, transition, callbackComplete, callbackOverwrite) {        
        actor.move_anchor_point_from_gravity(Clutter.Gravity.CENTER);        
        Tweener.addTween(actor,
                         { opacity: opacity,                               
                           time: time,
                           transition: transition,
                           onComplete: callbackComplete,
                           onCompleteScope: this,
                           onCompleteParams: [cinnamonwm, actor],
                           onOverwrite: callbackOverwrite,
                           onOverwriteScope: this,
                           onOverwriteParams: [cinnamonwm, actor]
                            });
    },
    
    _scaleWindow: function(cinnamonwm, actor, scale_x, scale_y, time, transition, callbackComplete, callbackOverwrite) {        
        actor.move_anchor_point_from_gravity(Clutter.Gravity.CENTER);        
        Tweener.addTween(actor,
                         { scale_x: scale_x,     
                           scale_y: scale_y,                          
                           time: time,
                           transition: transition,
                           onComplete: callbackComplete,
                           onCompleteScope: this,
                           onCompleteParams: [cinnamonwm, actor],
                           onOverwrite: callbackOverwrite,
                           onOverwriteScope: this,
                           onOverwriteParams: [cinnamonwm, actor]
                            });
    },

    _minimizeWindow : function(cinnamonwm, actor) {
        if (!this._shouldAnimate(actor)) {
            cinnamonwm.completed_minimize(actor);
            return;
        }

        let transition = "easeInSine";
        let effect = "traditional";
        let time = 0.25;
        try{
            effect = global.settings.get_string("desktop-effects-minimize-effect");                                                
            transition = global.settings.get_string("desktop-effects-minimize-transition");                        
            time = global.settings.get_int("desktop-effects-minimize-time") / 1000;
        }
        catch(e) {
            log(e);
        }

        if (actor.get_meta_window()._cinnamonwm_has_origin) {
            // reset all cached values in case "traditional" is no longer in effect
            actor.get_meta_window()._cinnamonwm_has_origin = false;
            actor.get_meta_window()._cinnamonwm_minimize_transition = undefined;
            actor.get_meta_window()._cinnamonwm_minimize_time = undefined;
        }

        if (effect == "traditional") {
            actor.set_scale(1.0, 1.0);
            this._minimizing.push(actor);
            let monitor;
            let yDest;            
            if (Main.desktop_layout == Main.LAYOUT_TRADITIONAL || Main.desktop_layout == Main.LAYOUT_CLASSIC) {
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

            if (AppletManager.get_role_provider_exists(AppletManager.Roles.WINDOWLIST)) {
                let windowApplet = AppletManager.get_role_provider(AppletManager.Roles.WINDOWLIST);
                let actorOrigin = windowApplet.getOriginFromWindow(actor.get_meta_window());
                
                if (actorOrigin !== false) {
                    [xDest, yDest] = actorOrigin.get_transformed_position();
                    // Adjust horizontal destination or it'll appear to zoom
                    // down to our button's left (or right in RTL) edge.
                    // To center it, we'll add half its width.
                    // We use the allocation box because otherwise our
                    // pseudo-class ":focus" may be larger when not minimized.
                    xDest += actorOrigin.get_allocation_box().get_size()[0] / 2;
                    actor.get_meta_window()._cinnamonwm_has_origin = true;
                    actor.get_meta_window()._cinnamonwm_minimize_transition = transition;
                    actor.get_meta_window()._cinnamonwm_minimize_time = time;
                }
            }
            
            Tweener.addTween(actor,
                             { scale_x: 0.0,
                               scale_y: 0.0,
                               x: xDest,
                               y: yDest,
                               time: time,
                               transition: transition,
                               onComplete: this._minimizeWindowDone,
                               onCompleteScope: this,
                               onCompleteParams: [cinnamonwm, actor],
                               onOverwrite: this._minimizeWindowOverwritten,
                               onOverwriteScope: this,
                               onOverwriteParams: [cinnamonwm, actor]
                             });
        }
        else if (effect == "fade") {
            this._minimizing.push(actor);
            this._fadeWindow(cinnamonwm, actor, 0, time, transition, this._minimizeWindowDone, this._minimizeWindowOverwritten);            
        }
        else if (effect == "scale") {                                
            this._minimizing.push(actor);
            this._scaleWindow(cinnamonwm, actor, 0.0, 0.0, time, transition, this._minimizeWindowDone, this._minimizeWindowOverwritten); 
        }
        else {
            cinnamonwm.completed_minimize(actor);
        }
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
        if (!this._shouldAnimate(actor)) {
            cinnamonwm.completed_maximize(actor);
            return;
        }

        let transition = "easeInSine";
        let effect = "scale";
        let time = 0.25;
        try{
            effect = global.settings.get_string("desktop-effects-maximize-effect");                                                
            transition = global.settings.get_string("desktop-effects-maximize-transition");                        
            time = global.settings.get_int("desktop-effects-maximize-time") / 1000;
        }
        catch(e) {
            log(e);
        }
                
        if (effect == "scale") {            
            this._maximizing.push(actor);            
            
            let scale_x = targetWidth / actor.width;
            let scale_y = targetHeight / actor.height;
            let anchor_x = (actor.x - targetX) * actor.width / (targetWidth - actor.width);
            let anchor_y = (actor.y - targetY) * actor.height / (targetHeight - actor.height);
            
            actor.move_anchor_point(anchor_x, anchor_y);   
                 
            Tweener.addTween(actor,
                         { scale_x: scale_x, 
                           scale_y: scale_y,                                            
                           time: time,
                           transition: transition,
                           onComplete: this._maximizeWindowDone,
                           onCompleteScope: this,
                           onCompleteParams: [cinnamonwm, actor],
                           onOverwrite: this._maximizeWindowOverwrite,
                           onOverwriteScope: this,
                           onOverwriteParams: [cinnamonwm, actor]
                            });
        }
        else {
            cinnamonwm.completed_maximize(actor);
        }            
    },

    _maximizeWindowDone : function(cinnamonwm, actor) {
        if (this._removeEffect(this._maximizing, actor)) {
            Tweener.removeTweens(actor);
            actor.set_scale(1.0, 1.0);
            actor.opacity = 255;
            actor.move_anchor_point_from_gravity(Clutter.Gravity.NORTH_WEST);
            cinnamonwm.completed_maximize(actor);
        }
    },

    _maximizeWindowOverwrite : function(cinnamonwm, actor) {
        if (this._removeEffect(this._maximizing, actor)) {
            cinnamonwm.completed_maximize(actor);
        }
    },

    _unmaximizeWindow : function(cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
         if (!this._shouldAnimate(actor)) {
            cinnamonwm.completed_unmaximize(actor);
            return;
        }

        let transition = "easeInSine";
        let effect = "none";
        let time = 0.25;
        try{
            effect = global.settings.get_string("desktop-effects-unmaximize-effect");
            transition = global.settings.get_string("desktop-effects-unmaximize-transition");
            time = global.settings.get_int("desktop-effects-unmaximize-time") / 1000;
        }
        catch(e) {
            log(e);
        }

        if (effect == "scale") {

            this._unmaximizing.push(actor);
            
            let scale_x = targetWidth / actor.width;
            let scale_y = targetHeight / actor.height;
            let anchor_x = (actor.x - targetX) * actor.width / (targetWidth - actor.width);
            let anchor_y = (actor.y - targetY) * actor.height / (targetHeight - actor.height);

            actor.move_anchor_point(anchor_x, anchor_y);

            Tweener.addTween(actor,
                         { scale_x: scale_x,
                           scale_y: scale_y,
                           time: time,
                           transition: transition,
                           onComplete: this._unmaximizeWindowDone,
                           onCompleteScope: this,
                           onCompleteParams: [cinnamonwm, actor],
                           onOverwrite: this._unmaximizeWindowOverwrite,
                           onOverwriteScope: this,
                           onOverwriteParams: [cinnamonwm, actor]
                            });

        }
        else {
            cinnamonwm.completed_unmaximize(actor);
        }
    },

    _unmaximizeWindowDone : function(cinnamonwm, actor) {
        if (this._removeEffect(this._unmaximizing, actor)) {
            Tweener.removeTweens(actor);
            actor.set_scale(1.0, 1.0);
            actor.opacity = 255;
            actor.move_anchor_point_from_gravity(Clutter.Gravity.NORTH_WEST);
            cinnamonwm.completed_unmaximize(actor);
        }
    },
    
    _unmaximizeWindowOverwrite : function(cinnamonwm, actor) {
        if (this._removeEffect(this._unmaximizing, actor)) {
            cinnamonwm.completed_unmaximize(actor);
        }
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
        
        
        let transition = "easeInSine";
        let effect = "scale";
        let time = 0.25;
        try{
            effect = global.settings.get_string("desktop-effects-map-effect");                                                
            transition = global.settings.get_string("desktop-effects-map-transition");                        
            time = global.settings.get_int("desktop-effects-map-time") / 1000;
        }
        catch(e) {
            log(e);
        }
        
        if (actor.get_meta_window()._cinnamonwm_has_origin === true) {
            /* "traditional" minimize mapping has been applied, do the converse un-minimize */
            let xSrc, ySrc, xDest, yDest;
            [xDest, yDest] = actor.get_transformed_position();

            if (AppletManager.get_role_provider_exists(AppletManager.Roles.WINDOWLIST))
            {
                let windowApplet = AppletManager.get_role_provider(AppletManager.Roles.WINDOWLIST);
                let actorOrigin = windowApplet.getOriginFromWindow(actor.get_meta_window());
                
                if (actorOrigin !== false) {
                    actor.set_scale(0.0, 0.0);
                    this._mapping.push(actor);
                    [xSrc, ySrc] = actorOrigin.get_transformed_position();
                    // Adjust horizontal destination or it'll appear to zoom
                    // down to our button's left (or right in RTL) edge.
                    // To center it, we'll add half its width.
                    xSrc += actorOrigin.get_allocation_box().get_size()[0] / 2;
                    actor.set_position(xSrc, ySrc);
                    actor.show();

                    let myTransition = actor.get_meta_window()._cinnamonwm_minimize_transition||transition;
                    let lastTime = actor.get_meta_window()._cinnamonwm_minimize_time;
                    let myTime = typeof(lastTime) !== "undefined" ? lastTime : time;
                    Tweener.addTween(actor,
                                     { scale_x: 1.0,
                                       scale_y: 1.0,
                                       x: xDest,
                                       y: yDest,
                                       time: myTime,
                                       transition: myTransition,
                                       onComplete: this._mapWindowDone,
                                       onCompleteScope: this,
                                       onCompleteParams: [cinnamonwm, actor],
                                       onOverwrite: this._mapWindowOverwrite,
                                       onOverwriteScope: this,
                                       onOverwriteParams: [cinnamonwm, actor]
                                     });
                    return;
                }
            } // if window list doesn't support finding an origin
        }
        
        if (effect == "fade") {            
            this._mapping.push(actor);
            actor.opacity = 0;
            actor.show();
            this._fadeWindow(cinnamonwm, actor, 255, time, transition, this._mapWindowDone, this._mapWindowOverwrite);
        }
        else if (effect == "scale") {               
            actor.set_scale(0.0, 0.0);
            actor.show();
            this._mapping.push(actor);
            this._scaleWindow(cinnamonwm, actor, 1, 1, time, transition, this._mapWindowDone, this._mapWindowOverwrite);        
        }
        else {   
            cinnamonwm.completed_map(actor);
        }
        
    },

    _mapWindowDone : function(cinnamonwm, actor) {
        if (this._removeEffect(this._mapping, actor)) {
            Tweener.removeTweens(actor);
            actor.move_anchor_point_from_gravity(Clutter.Gravity.NORTH_WEST);
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

            actor.opacity = 255;
            actor.show();
            this._destroying.push(actor);

            actor._parentDestroyId = parent.connect('unmanaged', Lang.bind(this, function () {
                Tweener.removeTweens(actor);
                this._destroyWindowDone(cinnamonwm, actor);
            }));

            Tweener.removeTweens(actor);
            Tweener.addTween(actor,
                             { opacity: 0,
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
        
        if (!this._shouldAnimate(actor)) {
            cinnamonwm.completed_destroy(actor);
            return;
        }
                                                
        let transition = "easeInSine";
        let effect = "scale";
        let time = 0.25;
        try{
            effect = global.settings.get_string("desktop-effects-close-effect");
            transition = global.settings.get_string("desktop-effects-close-transition");
            time = global.settings.get_int("desktop-effects-close-time") / 1000;
        }
        catch(e) {
            log(e);
        }
        
        if (effect == "scale") {
            this._destroying.push(actor);
            this._scaleWindow(cinnamonwm, actor, 0.0, 0.0, time, transition, this._destroyWindowDone, this._destroyWindowDone);
        }
        else if (effect == "fade") {
            this._destroying.push(actor);
            this._fadeWindow(cinnamonwm, actor, 0, time, transition, this._destroyWindowDone, this._destroyWindowDone);
        }
        else {
            cinnamonwm.completed_destroy(actor);
        }
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

    showWorkspaceOSD : function() {
        if (global.settings.get_boolean("workspace-osd-visible")) {
            let current_workspace_index = global.screen.get_active_workspace_index();
            let monitor = Main.layoutManager.primaryMonitor;
            let label = new St.Label({style_class:'workspace-osd'});
            label.set_text(Main.getWorkspaceName(current_workspace_index));
            label.set_opacity = 0;
            Main.layoutManager.addChrome(label, { visibleInFullscreen: false, affectsInputRegion: false });
            let workspace_osd_x = global.settings.get_int("workspace-osd-x");
            let workspace_osd_y = global.settings.get_int("workspace-osd-y");
            /*
             * This aligns the osd edges to the minimum/maximum values from gsettings,
             * if those are selected to be used. For values in between minimum/maximum,
             * it shifts the osd by half of the percentage used of the overall space available
             * for display (100% - (left and right 'padding')).
             * The horizontal minimum/maximum values are 5% and 95%, resulting in 90% available for positioning
             * If the user choses 50% as osd position, these calculations result the osd being centered onscreen
             */
            let [minX, maxX, minY, maxY] = [5, 95, 5, 95];
            let delta = (workspace_osd_x - minX) / (maxX - minX);
            let x = Math.round((monitor.width * workspace_osd_x / 100) - (label.width * delta));
            delta = (workspace_osd_y - minY) / (maxY - minY);
            let y = Math.round((monitor.height * workspace_osd_y / 100) - (label.height * delta));
            label.set_position(x, y);
            let duration = global.settings.get_int("workspace-osd-duration") / 1000;
            Tweener.addTween(label, {   opacity: 255,
                                        time: duration,
                                        transition: 'linear',
                                        onComplete: function() {
                                            Main.layoutManager.removeChrome(label);
                                        }});
        }
    },

    _startAppSwitcher : function(display, screen, window, binding) {
        
        let tabPopup = new AltTab.AltTabPopup();

        let modifiers = binding.get_modifiers();
        let backwards = modifiers & Meta.VirtualModifier.SHIFT_MASK;
        if (!tabPopup.show(backwards, binding.get_name(), binding.get_mask()))
            tabPopup.destroy();
    },

    _startA11ySwitcher : function(display, screen, window, binding) {
        
    },

    _shiftWindowToWorkspace : function(window, direction) {
        if (window.get_window_type() === Meta.WindowType.DESKTOP) {
            return;
        }
        let workspace = global.screen.get_active_workspace().get_neighbor(direction);
        if (workspace != global.screen.get_active_workspace()) {
            workspace.activate(global.get_current_time());
            this.showWorkspaceOSD();
            Mainloop.idle_add(Lang.bind(this, function() {
                // Unless this is done a bit later, window is sometimes not activated
                window.change_workspace(workspace);
                window.activate(global.get_current_time());
            }));
        }
    },

    _moveWindowToWorkspaceLeft : function(display, screen, window, binding) {
        this._shiftWindowToWorkspace(window, Meta.MotionDirection.LEFT);
    },

    _moveWindowToWorkspaceRight : function(display, screen, window, binding) {
        this._shiftWindowToWorkspace(window, Meta.MotionDirection.RIGHT);
    },

    _showWorkspaceSwitcher : function(display, screen, window, binding) {
        if (binding.get_name() == 'switch-to-workspace-up') {
        	Main.expo.toggle();
        	return;                   
        }
        if (binding.get_name() == 'switch-to-workspace-down') {
            Main.overview.toggle();
            return;
        }
        
        if (screen.n_workspaces == 1)
            return;

        let current_workspace_index = global.screen.get_active_workspace_index();
        if (binding.get_name() == 'switch-to-workspace-left') {
           this.actionMoveWorkspaceLeft();
           if (current_workspace_index !== global.screen.get_active_workspace_index()) {
                this.showWorkspaceOSD();
           }
        }
        else if (binding.get_name() == 'switch-to-workspace-right') {
           this.actionMoveWorkspaceRight();
           if (current_workspace_index !== global.screen.get_active_workspace_index()) {
                this.showWorkspaceOSD();
           }
        }
    },

    actionMoveWorkspaceLeft: function() {
        global.screen.get_active_workspace().get_neighbor(Meta.MotionDirection.LEFT).activate(global.get_current_time());
    },

    actionMoveWorkspaceRight: function() {
        global.screen.get_active_workspace().get_neighbor(Meta.MotionDirection.RIGHT).activate(global.get_current_time());
    },

    actionMoveWorkspaceUp: function() {
        global.screen.get_active_workspace().get_neighbor(Meta.MotionDirection.UP).activate(global.get_current_time());
    },

    actionMoveWorkspaceDown: function() {
        global.screen.get_active_workspace().get_neighbor(Meta.MotionDirection.DOWN).activate(global.get_current_time());
    },

    actionFlipWorkspaceLeft: function() {
        var active = global.screen.get_active_workspace();
        var neighbor = active.get_neighbor(Meta.MotionDirection.LEFT);
        if (active != neighbor) {
            neighbor.activate(global.get_current_time());
            let [x, y, mods] = global.get_pointer();
            global.set_pointer(global.screen_width - 10, y);
        }
    },

    actionFlipWorkspaceRight: function() {
        var active = global.screen.get_active_workspace();
        var neighbor = active.get_neighbor(Meta.MotionDirection.RIGHT);
        if (active != neighbor) {
            neighbor.activate(global.get_current_time());
            let [x, y, mods] = global.get_pointer();
            global.set_pointer(10, y);
        }
    }
};
