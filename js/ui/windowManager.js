// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const AppletManager = imports.ui.appletManager;
const AppSwitcher = imports.ui.appSwitcher.appSwitcher;
const Connector = imports.misc.connector;
const CoverflowSwitcher = imports.ui.appSwitcher.coverflowSwitcher;
const TimelineSwitcher = imports.ui.appSwitcher.timelineSwitcher;
const ClassicSwitcher = imports.ui.appSwitcher.classicSwitcher;

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
        this._tiling = [];
        this._mapping = [];
        this._destroying = [];

        this._snap_osd = null;
        this._workspace_osd = null;

        this._dimmedWindows = [];

        this._animationBlockCount = 0;

        this._cinnamonwm.connect('kill-switch-workspace', Lang.bind(this, this._onKillSwitchWorkspace));
        this._cinnamonwm.connect('kill-window-effects', Lang.bind(this, function (cinnamonwm, actor) {
            this._minimizeWindowDone(cinnamonwm, actor);
            this._maximizeWindowDone(cinnamonwm, actor);
            this._unmaximizeWindowDone(cinnamonwm, actor);
            this._tileWindowDone(cinnamonwm, actor);
            this._mapWindowDone(cinnamonwm, actor);
            this._destroyWindowDone(cinnamonwm, actor);
        }));

        this._cinnamonwm.connect('switch-workspace', Lang.bind(this, this._switchWorkspace));
        this._cinnamonwm.connect('minimize', Lang.bind(this, this._minimizeWindow));
        this._cinnamonwm.connect('maximize', Lang.bind(this, this._maximizeWindow));
        this._cinnamonwm.connect('unmaximize', Lang.bind(this, this._unmaximizeWindow));
        this._cinnamonwm.connect('tile', Lang.bind(this, this._tileWindow));
        this._cinnamonwm.connect('map', Lang.bind(this, this._mapWindow));
        this._cinnamonwm.connect('destroy', Lang.bind(this, this._destroyWindow));

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
        let workspaceSettings = new Gio.Settings({ schema: 'org.cinnamon.muffin' });
        this.workspacesOnlyOnPrimary = workspaceSettings.get_boolean("workspaces-only-on-primary");

        global.screen.connect ("show-snap-osd", Lang.bind (this, this._showSnapOSD));
        global.screen.connect ("hide-snap-osd", Lang.bind (this, this._hideSnapOSD));
        global.screen.connect ("show-workspace-osd", Lang.bind (this, this.showWorkspaceOSD));
    },

    blockAnimations: function() {
        this._animationBlockCount++;
    },

    unblockAnimations: function() {
        this._animationBlockCount = Math.max(0, this._animationBlockCount - 1);
    },

    _shouldAnimate : function(actor) {
        if (Main.modalCount && !this.forceAnimation) {
            // system is in modal state
            return false;
        }
        if (Main.software_rendering)
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

        Main.soundManager.play('minimize');

        // reset all cached values in case "traditional" is no longer in effect
        actor.get_meta_window()._cinnamonwm_has_origin = false;
        actor.get_meta_window()._cinnamonwm_minimize_transition = undefined;
        actor.get_meta_window()._cinnamonwm_minimize_time = undefined;

        if (!this._shouldAnimate(actor)) {
            cinnamonwm.completed_minimize(actor);
            return;
        }

        let effect = global.settings.get_string("desktop-effects-minimize-effect");
        let transition = global.settings.get_string("desktop-effects-minimize-transition");
        let time = global.settings.get_int("desktop-effects-minimize-time") / 1000;

        if (effect == "traditional") {
            if (AppletManager.get_role_provider_exists(AppletManager.Roles.WINDOWLIST)) {
                let windowApplet = AppletManager.get_role_provider(AppletManager.Roles.WINDOWLIST);
                let actorOrigin = windowApplet.getOriginFromWindow(actor.get_meta_window());
                
                if (actorOrigin !== false) {
                    actor.set_scale(1.0, 1.0);
                    this._minimizing.push(actor);
                    let [xDest, yDest] = actorOrigin.get_transformed_position();
                    // Adjust horizontal destination or it'll appear to zoom
                    // down to our button's left (or right in RTL) edge.
                    // To center it, we'll add half its width.
                    // We use the allocation box because otherwise our
                    // pseudo-class ":focus" may be larger when not minimized.
                    xDest += actorOrigin.get_allocation_box().get_size()[0] / 2;
                    actor.get_meta_window()._cinnamonwm_has_origin = true;
                    actor.get_meta_window()._cinnamonwm_minimize_transition = transition;
                    actor.get_meta_window()._cinnamonwm_minimize_time = time;
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
                    return; // done
                }
            }
            effect = "scale"; // fall-back effect
        }

        if (effect == "fade") {
            this._minimizing.push(actor);
            this._fadeWindow(cinnamonwm, actor, 0, time, transition, this._minimizeWindowDone, this._minimizeWindowOverwritten);            
        } else if (effect == "scale") {                                
            this._minimizing.push(actor);
            this._scaleWindow(cinnamonwm, actor, 0.0, 0.0, time, transition, this._minimizeWindowDone, this._minimizeWindowOverwritten); 
        } else {
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

    _tileWindow : function (cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
        Main.soundManager.play('tile');
        if (!this._shouldAnimate(actor)) {
            cinnamonwm.completed_tile(actor);
            return;
        }
        let transition = "easeInSine";
        let effect = "scale";
        let time = 0.25;
        try{
            effect = global.settings.get_string("desktop-effects-tile-effect");
            transition = global.settings.get_string("desktop-effects-tile-transition");
            time = global.settings.get_int("desktop-effects-tile-time") / 1000;
        }
        catch(e) {
            log(e);
        }

        if (effect == "scale") {
            this._tiling.push(actor);

            if (targetWidth == actor.width)
                targetWidth -= 1;
            if (targetHeight == actor.height)
                targetHeight -= 1;

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
                           onComplete: this._tileWindowDone,
                           onCompleteScope: this,
                           onCompleteParams: [cinnamonwm, actor],
                           onOverwrite: this._tileWindowOverwrite,
                           onOverwriteScope: this,
                           onOverwriteParams: [cinnamonwm, actor]
                            });
        }
        else {
            cinnamonwm.completed_tile(actor);
        }
    },

    _tileWindowDone : function(cinnamonwm, actor) {
        if (this._removeEffect(this._tiling, actor)) {
            Tweener.removeTweens(actor);
            actor.set_scale(1.0, 1.0);
            actor.opacity = 255;
            actor.move_anchor_point_from_gravity(Clutter.Gravity.NORTH_WEST);
            cinnamonwm.completed_tile(actor);
        }
    },

    _tileWindowOverwrite : function(cinnamonwm, actor) {
        if (this._removeEffect(this._tiling, actor)) {
            cinnamonwm.completed_tile(actor);
        }
    },

    _maximizeWindow : function(cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
        Main.soundManager.play('maximize');
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
            
            if (targetWidth == actor.width)
                targetWidth -= 1;
            if (targetHeight == actor.height)
                targetHeight -= 1;

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
        Main.soundManager.play('unmaximize');
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

            if (targetWidth == actor.width)
                targetWidth -= 1;
            if (targetHeight == actor.height)
                targetHeight -= 1;

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
            this._completeMap(cinnamonwm, actor);
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
        else {
            if (actor.meta_window.get_window_type() == Meta.WindowType.NORMAL) {
                Main.soundManager.play('map');
            }            
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
            this._completeMap(cinnamonwm, actor);
        }
        
    },

    _completeMap : function(cinnamonwm, actor) {
        actor.move_anchor_point_from_gravity(Clutter.Gravity.NORTH_WEST);
        actor.set_scale(1.0, 1.0);
        actor.opacity = 255;
        actor.show();
        cinnamonwm.completed_map(actor);
    },

    _mapWindowDone : function(cinnamonwm, actor) {
        if (this._removeEffect(this._mapping, actor)) {
            Tweener.removeTweens(actor);
            this._completeMap(cinnamonwm, actor);
        }
    },

    _mapWindowOverwrite : function(cinnamonwm, actor) {
        if (this._removeEffect(this._mapping, actor)) {
            this._completeMap(cinnamonwm, actor);
        }
    },

    _destroyWindow : function(cinnamonwm, actor) {  
        
        if (actor.meta_window.get_window_type() == Meta.WindowType.NORMAL) {
            Main.soundManager.play('close');
        }

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
                //Fixes ghost windows bug
            Tweener.removeTweens(actor);
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
        if (this._shouldAnimate()) {
            this.showWorkspaceOSD();
        }
        else {
            cinnamonwm.completed_switch_workspace();                                
            return;
        }

        let chunks = [];

        this._finishSwitchWorkspace = Lang.bind(this, function(killed) {
            this._finishSwitchWorkspace = null;
            chunks.forEach(function(chunk) {
                chunk.windows.forEach(function(w) {
                    if (!w.window.is_destroyed()) {
                        global.reparentActor(w.window, w.parent);
                    }
                },this);
                if (killed) {
                    Tweener.removeTweens(chunk.inGroup);
                    Tweener.removeTweens(chunk.outGroup);
                }
                chunk.cover.destroy();
            }, this);
            cinnamonwm.completed_switch_workspace();
        });

        let windows = global.get_window_actors();
        let lastIndex = 0;
        // In a multi-monitor scenario, we need to work one monitor at a time,
        // protecting the other monitors from having unrelated windows swooshing by.
        this._forEachWorkspaceMonitor(function(monitor, index) {
            lastIndex = index;
            let chunk = {};
            chunks.push(chunk);
            
            chunk.cover = new Clutter.Group();
            chunk.cover.set_position(0, 0);
            chunk.cover.set_clip(monitor.x, monitor.y, monitor.width, monitor.height);

            chunk.inGroup = new Clutter.Group();
            chunk.cover.add_actor(chunk.inGroup);
            chunk.outGroup = new Clutter.Group();
            chunk.cover.add_actor(chunk.outGroup);

            let wgroup = global.window_group;
            wgroup.add_actor(chunk.cover);

            chunk.windows = [];
            for (let i = 0; i < windows.length; i++) {
                let window = windows[i];

                if (window.meta_window.get_monitor() !== index)
                    continue;

                if (!window.meta_window.showing_on_its_workspace())
                    continue;

                if (window.get_workspace() == from || window.meta_window.is_on_all_workspaces()) {
                    chunk.windows.push({ window: window,
                                              parent: window.get_parent() });
                    global.reparentActor(window, chunk.outGroup);
                } else if (window.get_workspace() == to || window.meta_window.is_on_all_workspaces()) {
                    chunk.windows.push({ window: window,
                                              parent: window.get_parent() });
                    global.reparentActor(window, chunk.inGroup);
                }
            }

            /* @direction is the direction that the "camera" moves, so the
             * screen contents have to move one screen's worth in the
             * opposite direction.
             */
            let xDest = 0, yDest = 0;

            if (direction == Meta.MotionDirection.UP ||
                direction == Meta.MotionDirection.UP_LEFT ||
                direction == Meta.MotionDirection.UP_RIGHT)
            {
                yDest = global.screen_height;
            }
            else if (direction == Meta.MotionDirection.DOWN ||
                direction == Meta.MotionDirection.DOWN_LEFT ||
                direction == Meta.MotionDirection.DOWN_RIGHT)
            {
                yDest = -global.screen_height;
            }
            
            if (direction == Meta.MotionDirection.LEFT ||
                direction == Meta.MotionDirection.UP_LEFT ||
                direction == Meta.MotionDirection.DOWN_LEFT)
            {
                xDest = global.screen_width;
            }
            else if (direction == Meta.MotionDirection.RIGHT ||
                     direction == Meta.MotionDirection.UP_RIGHT ||
                     direction == Meta.MotionDirection.DOWN_RIGHT)
            {
                xDest = -global.screen_width;
            }

            chunk.inGroup.set_position(-xDest, -yDest);
            chunk.inGroup.set_size(0, global.screen_height);
            chunk.inGroup.raise_top();

            Tweener.addTween(chunk.outGroup, {
                x: xDest,
                y: yDest,
                time: WINDOW_ANIMATION_TIME,
                transition: 'easeOutQuad',
                onComplete: Lang.bind(this, function() {
                    if (index == lastIndex && this._finishSwitchWorkspace) {
                        this._finishSwitchWorkspace(false);
                    }
                })
            });
            Tweener.addTween(chunk.inGroup, {
                x: 0,
                y: 0,
                time: WINDOW_ANIMATION_TIME,
                transition: 'easeOutQuad'
            });
        }, this);
    },

    _onKillSwitchWorkspace : function(cinnamonwm) {
        if (this._finishSwitchWorkspace) {
            this._finishSwitchWorkspace(true);
        }
    },

    showWorkspaceOSD : function() {
        this._hideSnapOSD();
        if (global.settings.get_boolean("workspace-osd-visible")) {
            let current_workspace_index = global.screen.get_active_workspace_index();
            
            let workspace_osd_x = global.settings.get_int("workspace-osd-x");
            let workspace_osd_y = global.settings.get_int("workspace-osd-y");
            let duration = global.settings.get_int("workspace-osd-duration") / 1000;
            this._forEachWorkspaceMonitor(function(monitor, mIndex) {
                this._hideWorkspaceOSD(monitor);
                monitor._workspace_osd = new St.Label({style_class:'workspace-osd'});
                monitor._workspace_osd.set_text(Main.getWorkspaceName(current_workspace_index));
                monitor._workspace_osd.set_opacity = 0;
                this._showWorkspaceGridForMonitor(mIndex, monitor._workspace_osd);
                Main.layoutManager.addChrome(monitor._workspace_osd, { visibleInFullscreen: false, affectsInputRegion: false });
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
                let x = Math.round((monitor.width * workspace_osd_x / 100) - (monitor._workspace_osd.width * delta));
                delta = (workspace_osd_y - minY) / (maxY - minY);
                let y = Math.round(monitor.y + (monitor.height * workspace_osd_y / 100) - (monitor._workspace_osd.height * delta));
                monitor._workspace_osd.set_position(x, y);
                Tweener.addTween(monitor._workspace_osd, {   opacity: 255,
                    time: duration,
                    transition: 'linear',
                    onCompleteScope: this,
                    onComplete: function() {
                        this._hideWorkspaceOSD(monitor);
                    }});
            }, this);
        }
    },

    _hideWorkspaceOSD : function(monitor) {
        if (monitor._workspace_osd != null) {
            monitor._workspace_osd.hide();
            Main.layoutManager.removeChrome(monitor._workspace_osd);
            monitor._workspace_osd.destroy();
            monitor._workspace_osd = null;
        }
    },

    _showSnapOSD : function() {
        if (!global.settings.get_boolean("hide-snap-osd")) {
            if (this._snap_osd == null) {
                this._snap_osd = new St.BoxLayout({ vertical: true, style_class: "snap-osd" });
                let snap_info = new St.Label();
                let settings = new Gio.Settings({ schema: "org.cinnamon.muffin" });
                let mod = settings.get_string("snap-modifier");
                if (mod == "Super")
                    snap_info.set_text (_("Hold <Super> to enter snap mode"));
                else if (mod == "Alt")
                    snap_info.set_text (_("Hold <Alt> to enter snap mode"));
                else if (mod == "Control")
                    snap_info.set_text (_("Hold <Ctrl> to enter snap mode"));
                else if (mod == "Shift")
                    snap_info.set_text (_("Hold <Shift> to enter snap mode"));
                let flip_info = new St.Label();
                flip_info.set_text (_("Use the arrow keys to shift workspaces"));
                if (mod != "")
                    this._snap_osd.add (snap_info, { y_align: St.Align.START });
                this._snap_osd.add (flip_info, { y_align: St.Align.END });
                Main.layoutManager.addChrome(this._snap_osd, { visibleInFullscreen: false, affectsInputRegion: false});
            }
            this._snap_osd.set_opacity = 0;
            let monitor = Main.layoutManager.primaryMonitor;
            let workspace_osd_x = global.settings.get_int("workspace-osd-x");
            let workspace_osd_y = global.settings.get_int("workspace-osd-y");
            let [minX, maxX, minY, maxY] = [5, 95, 5, 95];
            let delta = (workspace_osd_x - minX) / (maxX - minX);
            let x = Math.round((monitor.width * workspace_osd_x / 100) - (this._snap_osd.width * delta));
            delta = (workspace_osd_y - minY) / (maxY - minY);
            let y = Math.round((monitor.height * workspace_osd_y / 100) - (this._snap_osd.height * delta));
            this._snap_osd.set_position(x, y);
            this._snap_osd.show_all();
        }
    },

    _hideSnapOSD : function() {
        if (this._snap_osd != null) {
            this._snap_osd.hide();
            Main.layoutManager.removeChrome(this._snap_osd);
            this._snap_osd.destroy();
            this._snap_osd = null;
        }
    },

    _createAppSwitcher : function(binding) {
        if (AppSwitcher.getWindowsForBinding(binding).length == 0)
            return;
        let style = global.settings.get_string("alttab-switcher-style");
        if(style == 'coverflow')
            new CoverflowSwitcher.CoverflowSwitcher(binding);
        else if(style == 'timeline')
            new TimelineSwitcher.TimelineSwitcher(binding);
        else
            new ClassicSwitcher.ClassicSwitcher(binding);
    },

    _startAppSwitcher : function(display, screen, window, binding) {
        this._createAppSwitcher(binding);
    },

    _startA11ySwitcher : function(display, screen, window, binding) {
        this._createAppSwitcher(binding);
    },

    _showWorkspaceSwitcher : function(display, screen, window, binding) {
        this.switchWorkspace(binding.get_name(), true);
    },

    _forEachWorkspaceMonitor : function(callback, scope) {
        Main.layoutManager.monitors.filter(function(monitor, index) {
            return index === Main.layoutManager.primaryIndex || !this.workspacesOnlyOnPrimary;
        }, this).forEach(callback, scope);
    },

    _showWorkspaceGrid : function(guardian) {
        this._forEachWorkspaceMonitor(function(monitor, mIndex) {
            this._showWorkspaceGridForMonitor(mIndex, guardian);
        }, this);
    },

    _showWorkspaceGridForMonitor : function(mIndex, guardian) {
        let monitor = Main.layoutManager.monitors[mIndex];
        if (monitor._showingOsdGrid) { return;}

        const INACTIVE_STYLE = "border-color: rgba(127,128,127, 1); border-radius:0";
        const ACTIVE_STYLE = "border-color: rgba(0,255,0,0.9); border-radius:0";
        let activeWsIndex = global.screen.get_active_workspace_index();
        let [columnCount, rowCount] = Main.getWorkspaceGeometry();

        // Find out the correct z-order (to handle always-on-top windows)
        // Adapted from expoThumbnail.js
        let stack = global.get_window_actors();
        let stackIndices = {};
        for (let i = 0; i < stack.length; i++) {
            stackIndices[stack[i].get_meta_window()] = i;
        }

        if (true) {
            let osd = new St.Bin({reactive: false});
            Main.uiGroup.add_actor(osd);
            let dialogLayout = new St.BoxLayout({ style_class: 'modal-dialog', vertical: true});
            dialogLayout.style = "padding: 4px; border-radius:0";
            osd.add_actor(dialogLayout);

            let cells = [];
            let rows = [];
            
            // Find the right size for the workspace thumbnails. We don't want to take up
            // too much of the monitor, and we want the thumbnails to be thumbnail-sized.
            let heightAvail = monitor.height/1.1;
            let widthAvail = monitor.width/1.1;
            const MAXXOR = 16;
            let rawdims = [Math.min(widthAvail/columnCount, monitor.width/MAXXOR), Math.min(heightAvail/rowCount, monitor.height/MAXXOR)];
            let widthFirst = columnCount >= rowCount;
            let [cWidth, cHeight] = (widthFirst
                ? [rawdims[0], (rawdims[0]) * (monitor.height/monitor.width)]
                : [(rawdims[1]) / (monitor.height/monitor.width), (rawdims[1])]
                );
            
            let cellCount = 0;
            for (let r = 0; r < rowCount; ++r) {
                let row = new St.BoxLayout({});
                rows.push(row);
                for (let c = 0; c < columnCount; ++c) {
                    let isWs = cellCount < global.screen.n_workspaces;
                    let cell = new St.BoxLayout({ width: cWidth, height: cHeight, style_class: isWs ? 'modal-dialog' : null});
                    cell.isWs = isWs;
                    cell.style = cellCount == activeWsIndex ? ACTIVE_STYLE : INACTIVE_STYLE;
                    row.add_actor(cell);
                    ++cellCount;
                    cells.push(cell);
                }
            }
            (Main.getWorkspaceRowsTopDown() ? rows : rows.reverse()).forEach(function(row) {
                dialogLayout.add_actor(row);
            });
            let populateCell = function(cell) {
                cell.destroy_children();
                let windows = Main.getTabList(global.screen.get_workspace_by_index(cell.index)).filter(function(window) {
                    return window.get_monitor() == mIndex && (cell.index == activeWsIndex || !window.is_on_all_workspaces());
                }, this);
                let vBorder = cell.get_theme_node().get_border_width(St.Side.TOP);
                let [cellWidth, cellHeight] = [cell.width - vBorder*2, cell.height - vBorder*2];
                let scale_x = cellWidth/monitor.width;
                let scale_y = cellHeight/monitor.height;
                let scale = Math.min(scale_x, scale_y);

                windows.sort(function(a, b){
                    return stackIndices[a] - stackIndices[b];
                }).forEach(function(window) {
                    let actor = window.get_compositor_private();
                    let [x,y] = [actor.x - monitor.x, actor.y - monitor.y];
                    let [width,height] = [actor.width, actor.height];
                    let clone = new Clutter.Clone({
                        source: actor.get_texture(),
                        x: vBorder + x*scale,
                        y: vBorder + y*scale,
                        width:width, height:height, scale_x: scale, scale_y: scale});
                    cell.add_actor(clone);
                },this);
                let dimmer = cell.dimmer = new St.Group({x: vBorder, y:vBorder, width: cellWidth, height: cellHeight,
                    style: "background-color: rgba(0,0,0,0.3)", visible: cell.index!=activeWsIndex
                });
                cell.add_actor(dimmer);
            }
            cells.filter(function(cell) {return cell.isWs;}).forEach(function(cell, index) {
                cell.index = index;
                populateCell(cell);
            }, this);

            let switchConnection = Connector.connect(global.window_manager, 'switch-workspace', function() {
                // Both the old and the new active cell need to be repopulated, due to the possible
                // presence of windows that are displayed on all workspaces, that we only want to
                // display on the active workspace.
                let oldcell = cells[activeWsIndex];
                activeWsIndex = global.screen.get_active_workspace_index();
                oldcell.style = INACTIVE_STYLE;
                populateCell(oldcell);
                cells[activeWsIndex].style = ACTIVE_STYLE;
                populateCell(cells[activeWsIndex]);
            });
            switchConnection.tie(osd);
            osd.set_position(monitor.x + Math.floor((monitor.width - osd.width)/2), monitor.y + Math.floor((monitor.height - osd.height)/2));
            monitor._showingOsdGrid = true;

            if (guardian) {
                guardian.connect('destroy', Lang.bind(this, function() {osd.destroy(); monitor._showingOsdGrid = false;}));
            }
        }
    },

    switchWorkspace : function(bindingName, forceAnimation) {
        // We want to process workspace-switch events on key-release instead
        // of on key-press, since that leads to less disturbing behavior
        // when a key is kept pressed down for longer periods of time.
        // In order to be able to handle key-press and key-release events
        // more freely, we create a hidden window, make it modal and let
        // it process keyboard events.

        let fromModal = Main.modalCount > 0; // Important: do this before going modal!

        let actor = new St.Bin({reactive: true});
        Main.uiGroup.add_actor(actor);
        if (!Main.pushModal(actor)) {
            actor.destroy();
            return;
        }

        let cleanup = Lang.bind(this, function() {
            if (!actor) {return;}
            Main.popModal(actor);
            actor.destroy();
            actor = null;
        });

        let pressEventCount = 0;
        let done = false;
        let showing = false;
        let timestamp = global.get_current_time(); // need to grab a valid timestamp now

        let isMultiRows = Main.getWorkspaceGeometry()[1] > 1;
        let onKeyPressRelease = function(actor_unused, event, pressEvent, timeout) {
            let prolongedKeyPress = false;
            if (!timeout) {
                pressEventCount += (pressEvent ? 1 : 0);
                prolongedKeyPress = pressEventCount > 0;
            }
            else {
                prolongedKeyPress = true;
            }

            if (!done && (!pressEvent || prolongedKeyPress)) {
                done = true;
                this.forceAnimation = forceAnimation; // we are in a modal state already, so must override to have animations
                try {
                    if (!fromModal && prolongedKeyPress && !showing && global.screen.n_workspaces > 1) {
                        this._showWorkspaceGrid(actor);
                        showing = true;
                    }
                    if (bindingName == 'switch-to-workspace-up') {
                        if (!prolongedKeyPress || (!pressEvent && !isMultiRows)) {
                            cleanup();
                            if (fromModal) {
                                Main.overview.hide();
                                Main.expo.hide();
                            } else {
                                Main.expo.toggle();
                            }
                        }
                        else if (isMultiRows) {
                           this.actionMoveWorkspaceUp(timestamp);
                        }
                    }
                    if (bindingName == 'switch-to-workspace-down') {
                        if (!prolongedKeyPress || (!pressEvent && !isMultiRows)) {
                            cleanup();
                            if (fromModal) {
                                Main.overview.hide();
                                Main.expo.hide();
                            } else {
                                Main.overview.toggle();
                            }
                        }
                        else if (isMultiRows) {
                           this.actionMoveWorkspaceDown(timestamp);
                        }
                    }
                    if (bindingName == 'switch-to-workspace-left') {
                       this.actionMoveWorkspaceLeft(timestamp);
                    }
                    if (bindingName == 'switch-to-workspace-right') {
                       this.actionMoveWorkspaceRight(timestamp);
                    }
                }
                finally {
                    delete this.forceAnimation;
                }
            }
            if (done && !pressEvent && !timeout) {
                cleanup();
            }
            return true;
        };
        // We don't get the first key-press event until after 400 to 500 milliseconds,
        // so we use a timer to speed up the responsiveness.
        let timerId = Mainloop.timeout_add(150, Lang.bind(this, function() {
            (Lang.bind(this, onKeyPressRelease))(null, null, false, true);
        }));
        actor.connect('key-press-event', Lang.bind(this, onKeyPressRelease, true));
        actor.connect('key-release-event', Lang.bind(this, onKeyPressRelease, false));
    },

    actionMoveWorkspaceLeft: function(time) {
        var active = global.screen.get_active_workspace();        
        var neighbour = active.get_neighbor(Meta.MotionDirection.LEFT)
        if (active != neighbour) {
            Main.soundManager.play('switch');
            neighbour.activate(time || global.get_current_time());
        }
    },

    actionMoveWorkspaceRight: function(time) {
        var active = global.screen.get_active_workspace();        
        var neighbour = active.get_neighbor(Meta.MotionDirection.RIGHT)
        if (active != neighbour) {
            Main.soundManager.play('switch');
            neighbour.activate(time || global.get_current_time());
        }
    },

    actionMoveWorkspaceUp: function(time) {
        global.screen.get_active_workspace().get_neighbor(Meta.MotionDirection.UP).activate(time || global.get_current_time());
    },

    actionMoveWorkspaceDown: function(time) {
        global.screen.get_active_workspace().get_neighbor(Meta.MotionDirection.DOWN).activate(time || global.get_current_time());
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
