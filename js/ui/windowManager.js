// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const AppSwitcher = imports.ui.appSwitcher.appSwitcher;
const CoverflowSwitcher = imports.ui.appSwitcher.coverflowSwitcher;
const TimelineSwitcher = imports.ui.appSwitcher.timelineSwitcher;
const ClassicSwitcher = imports.ui.appSwitcher.classicSwitcher;
const WindowEffects = imports.ui.windowEffects;

const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const Tweener = imports.ui.tweener;

const WINDOW_ANIMATION_TIME = 0.25;
const TILE_HUD_ANIMATION_TIME = 0.15;
const DIM_TIME = 0.500;
const DIM_DESATURATION = 0.6;
const DIM_BRIGHTNESS = -0.2;
const UNDIM_TIME = 0.250;

/* edge zones for tiling/snapping identification
   copied from muffin/src/core/window-private.h

  ___________________________
  | 4          0          5 |
  |                         |
  |                         |
  |                         |
  |                         |
  |  2                   3  |
  |                         |
  |                         |
  |                         |
  |                         |
  | 7          1          6 |
  |_________________________|

*/

const ZONE_TOP = 0;
const ZONE_BOTTOM = 1;
const ZONE_LEFT = 2;
const ZONE_RIGHT = 3;
const ZONE_TL = 4;
const ZONE_TR = 5;
const ZONE_BR = 6;
const ZONE_BL = 7;

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

        this._desaturateEffect = new Clutter.DesaturateEffect();
        this._brightnessEffect = new Clutter.BrightnessContrastEffect();
        actor.add_effect(this._desaturateEffect);
        actor.add_effect(this._brightnessEffect);

        this.actor = actor;
        this._dimFactor = 0.0;
    },

    setEnabled: function(enabled) {
        this._desaturateEffect.enabled = enabled;
        this._brightnessEffect.enabled = enabled;
    },

    set dimFactor(factor) {
        this._dimFactor = factor;
        this._desaturateEffect.set_factor(factor * DIM_DESATURATION);
        this._brightnessEffect.set_brightness(factor * DIM_BRIGHTNESS);
    },

    get dimFactor() {
       return this._dimFactor;
    }
};

function getWindowDimmer(actor) {
    if (!actor._windowDimmer)
        actor._windowDimmer = new WindowDimmer(actor);

    return actor._windowDimmer;
}

function TilePreview() {
    this._init();
}

TilePreview.prototype = {
    _init: function() {
        this.actor = new St.Bin({ style_class: 'tile-preview', important: true });
        global.window_group.add_actor(this.actor);

        this._snapQueued = 0;
        this._reset();
        this._showing = false;
    },

    show: function(window, tileRect, monitorIndex, snapQueued) {
        let windowActor = window.get_compositor_private();
        if (!windowActor)
            return;

        if (this._snapQueued != snapQueued) {
            this._updateStyle();
            this._snapQueued = snapQueued;
        }

        if (this._rect && this._rect.equal(tileRect))
            return;

        let changeMonitor = (this._monitorIndex == -1 ||
                             this._monitorIndex != monitorIndex);

        this._monitorIndex = monitorIndex;
        this._rect = tileRect;
        let monitor = Main.layoutManager.monitors[monitorIndex];

        if (!this._showing || changeMonitor) {
            let monitorRect = new Meta.Rectangle({ x: monitor.x,
                                                   y: monitor.y,
                                                   width: monitor.width,
                                                   height: monitor.height });
            let [, rect] = window.get_outer_rect().intersect(monitorRect);
            this.actor.set_size(rect.width, rect.height);
            this.actor.set_position(rect.x, rect.y);
            this.actor.opacity = 0;
        }

        this._showing = true;
        this.actor.show();
        windowActor.raise_top();

        Tweener.addTween(this.actor,
                         { x: tileRect.x,
                           y: tileRect.y,
                           width: tileRect.width,
                           height: tileRect.height,
                           opacity: 255,
                           time: WINDOW_ANIMATION_TIME,
                           transition: 'easeOutQuad' });
    },

    hide: function() {
        if (!this._showing)
            return;

        this._showing = false;
        Tweener.addTween(this.actor,
                         { opacity: 0,
                           time: WINDOW_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this, this._reset) });
    },

    _reset: function() {
        this.actor.hide();
        this._rect = null;
        this._monitorIndex = -1;
    },

    _updateStyle: function() {
        if (this.actor.has_style_class_name('snap'))
            this.actor.remove_style_class_name('snap');
        else
            this.actor.add_style_class_name('snap');
    },

    destroy: function() {
        this.actor.destroy();
    }
};

function HudPreview() {
    this._init();
}

HudPreview.prototype = {
    _init: function() {
        this.actor = new St.Bin({ style_class: 'tile-hud', important: true });
        global.window_group.add_actor(this.actor);

        this._tileHudSettings = new Gio.Settings({ schema_id: "org.cinnamon.muffin" });
        this._tileHudSettings.connect("changed::tile-hud-threshold", Lang.bind(this, this._onTileHudSettingsChanged));

        this._onTileHudSettingsChanged();
        this._snapQueued = 0;

        this._reset();
        this._showing = false;
    },

    show: function(currentProximityZone, workArea, snapQueued) {
        let changeZone = (this._zone != currentProximityZone);

        if (this._snapQueued != snapQueued) {
            this._updateSnapStyle();
            this._snapQueued = snapQueued;
        }

        let pseudoClass = null;

        if (!this._showing || changeZone) {
            this._zone = currentProximityZone;

            let monitorRect = workArea;
            let tileGap = this._hudSize + 10;

            switch(this._zone) {
                case ZONE_TOP:
                    this._x = monitorRect.x + tileGap;
                    this._y = monitorRect.y;
                    this._w = monitorRect.width - (tileGap * 2);
                    this._h = 0;
                    this._animatedX = this._x;
                    this._animatedY = this._y;
                    this._animatedW = this._w;
                    this._animatedH = this._h + this._hudSize;
                    this.actor.set_size(this._w, this._h);
                    this.actor.set_position(this._x, this._y);
                    pseudoClass = 'top';
                    break;
                case ZONE_BOTTOM:
                    this._x = monitorRect.x + tileGap;
                    this._y = monitorRect.y + monitorRect.height;
                    this._w = monitorRect.width - (tileGap * 2);
                    this._h = 0;
                    this._animatedX = this._x;
                    this._animatedY = this._y - this._hudSize;
                    this._animatedW = this._w;
                    this._animatedH = this._h + this._hudSize;
                    this.actor.set_size(this._w, this._h);
                    this.actor.set_position(this._x, this._y);
                    pseudoClass = 'bottom';
                    break;
                case ZONE_LEFT:
                    this._x = monitorRect.x;
                    this._y = monitorRect.y + tileGap;
                    this._w = 0;
                    this._h = monitorRect.height - (tileGap * 2);
                    this._animatedX = this._x;
                    this._animatedY = this._y;
                    this._animatedW = this._w + this._hudSize;
                    this._animatedH = this._h;
                    this.actor.set_size(this._w, this._h);
                    this.actor.set_position(this._x, this._y);
                    pseudoClass = 'left';
                    break;
                case ZONE_RIGHT:
                    this._x = monitorRect.x + monitorRect.width;
                    this._y = monitorRect.y + tileGap;
                    this._w = 0;
                    this._h = monitorRect.height - (tileGap * 2);
                    this._animatedX = this._x - this._hudSize;
                    this._animatedY = this._y;
                    this._animatedW = this._w + this._hudSize;
                    this._animatedH = this._h;
                    this.actor.set_size(this._w, this._h);
                    this.actor.set_position(this._x, this._y);
                    pseudoClass = 'right';
                    break;
                case ZONE_TL:
                    this._x = monitorRect.x;
                    this._y = monitorRect.y;
                    this._w = 0;
                    this._h = 0;
                    this._animatedX = this._x;
                    this._animatedY = this._y;
                    this._animatedW = this._w + this._hudSize;
                    this._animatedH = this._h + this._hudSize;
                    this.actor.set_size(this._w, this._h);
                    this.actor.set_position(this._x, this._y);
                    pseudoClass = 'top-left';
                    break;
                case ZONE_TR:
                    this._x = monitorRect.x + monitorRect.width;
                    this._y = monitorRect.y;
                    this._w = 0;
                    this._h = 0;
                    this._animatedX = this._x - this._hudSize;
                    this._animatedY = this._y;
                    this._animatedW = this._w + this._hudSize;
                    this._animatedH = this._h + this._hudSize;
                    this.actor.set_size(this._w, this._h);
                    this.actor.set_position(this._x, this._y);
                    pseudoClass = 'top-right';
                    break;
                case ZONE_BL:
                    this._x = monitorRect.x;
                    this._y = monitorRect.y + monitorRect.height;
                    this._w = 0;
                    this._h = 0;
                    this._animatedX = this._x;
                    this._animatedY = this._y - this._hudSize;
                    this._animatedW = this._w + this._hudSize;
                    this._animatedH = this._h + this._hudSize;
                    this.actor.set_size(this._w, this._h);
                    this.actor.set_position(this._x, this._y);
                    pseudoClass = 'bottom-left';
                    break;
                case ZONE_BR:
                    this._x = monitorRect.x + monitorRect.width;
                    this._y = monitorRect.y + monitorRect.height;
                    this._w = 0;
                    this._h = 0;
                    this._animatedX = this._x - this._hudSize;
                    this._animatedY = this._y - this._hudSize;
                    this._animatedW = this._w + this._hudSize;
                    this._animatedH = this._h + this._hudSize;
                    this.actor.set_size(this._w, this._h);
                    this.actor.set_position(this._x, this._y);
                    pseudoClass = 'bottom-right';
                    break;
                default:
                    this.hide();
                    return;

            }
            this._updateStyle(pseudoClass);

            this._showing = true;
            this.actor.show();
            this.actor.raise_top();
            this.actor.opacity = 0;

            Tweener.addTween(this.actor,
                         { x: this._animatedX,
                           y: this._animatedY,
                           width: this._animatedW,
                           height: this._animatedH,
                           opacity: 255,
                           time: TILE_HUD_ANIMATION_TIME,
                           transition: 'easeOutQuad' });
        }
    },

    hide: function() {
        if (!this._showing)
            return;
        this._showing = false;
        Tweener.addTween(this.actor,
                         { x: this._x,
                           y: this._y,
                           width: this._w,
                           height: this._h,
                           opacity: 0,
                           time: TILE_HUD_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this, this._reset) });
    },

    _reset: function () {
        this.actor.hide();
        this._zone = -1;
    },

    _onTileHudSettingsChanged: function() {
        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this._hudSize = this._tileHudSettings.get_int("tile-hud-threshold") * scaleFactor;

    },

    _updateStyle: function(pseudoClass) {
        let currentStyle = this.actor.get_style_pseudo_class();
        if (currentStyle)
            this.actor.remove_style_pseudo_class(currentStyle);
        if (pseudoClass) {
            this.actor.set_style_pseudo_class(pseudoClass);
        }
    },

    _updateSnapStyle: function() {
        if (this.actor.has_style_class_name('snap'))
            this.actor.remove_style_class_name('snap');
        else
            this.actor.add_style_class_name('snap');
    },

    destroy: function() {
        this.actor.destroy();
    }
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

        this.effects = {
            map: new WindowEffects.Map(this),
            close: new WindowEffects.Close(this),
            minimize: new WindowEffects.Minimize(this),
            unminimize: new WindowEffects.Unminimize(this),
            tile: new WindowEffects.Tile(this),
            maximize: new WindowEffects.Maximize(this),
            unmaximize: new WindowEffects.Unmaximize(this)
        };

        this._snapOsd = null;
        this._workspace_osd_array = [];

        this._tilePreview = null;
        this._hudPreview = null;

        this._dimmedWindows = [];

        this._animationBlockCount = 0;

        this._switchData = null;
        this._cinnamonwm.connect('kill-window-effects', Lang.bind(this, this._killWindowEffects));
        this._cinnamonwm.connect('switch-workspace', Lang.bind(this, this._switchWorkspace));
        this._cinnamonwm.connect('minimize', Lang.bind(this, this._minimizeWindow));
        this._cinnamonwm.connect('maximize', Lang.bind(this, this._maximizeWindow));
        this._cinnamonwm.connect('unmaximize', Lang.bind(this, this._unmaximizeWindow));
        this._cinnamonwm.connect('tile', Lang.bind(this, this._tileWindow));
        this._cinnamonwm.connect('show-tile-preview', Lang.bind(this, this._showTilePreview));
        this._cinnamonwm.connect('hide-tile-preview', Lang.bind(this, this._hideTilePreview));
        this._cinnamonwm.connect('show-hud-preview', Lang.bind(this, this._showHudPreview));
        this._cinnamonwm.connect('hide-hud-preview', Lang.bind(this, this._hideHudPreview));
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
                                            Lang.bind(this, this._startAppSwitcher));
        Meta.keybindings_set_custom_handler('switch-panels-backward',
                                            Lang.bind(this, this._startAppSwitcher));

        Main.overview.connect('showing', Lang.bind(this, function() {
            for (let i = 0; i < this._dimmedWindows.length; i++)
                this._undimWindow(this._dimmedWindows[i], true);
        }));
        Main.overview.connect('hiding', Lang.bind(this, function() {
            for (let i = 0; i < this._dimmedWindows.length; i++)
                this._dimWindow(this._dimmedWindows[i], true);
        }));

        global.screen.connect ("show-snap-osd", Lang.bind (this, this._showSnapOSD));
        global.screen.connect ("hide-snap-osd", Lang.bind (this, this._hideSnapOSD));
        global.screen.connect ("show-workspace-osd", Lang.bind (this, this.showWorkspaceOSD));

        this.settings = new Gio.Settings({schema_id: "org.cinnamon.muffin"});
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
        if (!actor)
            return global.settings.get_boolean("desktop-effects");
        let type = actor.meta_window.get_window_type();
        if (type == Meta.WindowType.NORMAL) {
            return global.settings.get_boolean("desktop-effects");
        }
        if (type == Meta.WindowType.DIALOG || type == Meta.WindowType.MODAL_DIALOG) {
            return global.settings.get_boolean("desktop-effects-on-dialogs");
        }
        if (type == Meta.WindowType.MENU ||
            type == Meta.WindowType.DROPDOWN_MENU ||
            type == Meta.WindowType.POPUP_MENU) {
            return global.settings.get_boolean("desktop-effects-on-menus");
        }
        return false;
    },

    _startWindowEffect: function(cinnamonwm, name, actor, args, overwriteKey){
        let effect = this.effects[name];
        if(!this._shouldAnimate(actor)){
            cinnamonwm[effect.wmCompleteName](actor);
            return;
        }

        let key = "desktop-effects-" + (overwriteKey || effect.name);
        let type = global.settings.get_string(key + "-effect");

        //make sure to end a running effect
        if(actor.current_effect_name){
            this._endWindowEffect(cinnamonwm, actor.current_effect_name, actor);
        }
        this[effect.arrayName].push(actor);
        actor.current_effect_name = name;
        actor.orig_opacity = actor.opacity;
        actor.show();

        if(effect[type]){
            let time = global.settings.get_int(key + "-time") / 1000;
            let transition = global.settings.get_string(key + "-transition");

            effect[type](cinnamonwm, actor, time, transition, args);
        } else if(!overwriteKey) //when not unminimizing, but the effect was not found, end it
            this._endWindowEffect(cinnamonwm, name, actor);
    },

    _endWindowEffect: function(cinnamonwm, name, actor){
        let effect = this.effects[name];
        //effect will be an instance of WindowEffects.Effect
        let idx = this[effect.arrayName].indexOf(actor);
        if(idx !== -1){
            this[effect.arrayName].splice(idx, 1);
            Tweener.removeTweens(actor);
            delete actor.current_effect_name;
            effect._end(actor);
            cinnamonwm[effect.wmCompleteName](actor);
            Main.panelManager.updatePanelsVisibility();
        }
    },

    _killWindowEffects: function (cinnamonwm, actor) {
        for(let i in this._effects){
            this._endWindowEffect(cinnamonwm, i, actor);
        }
    },

    _minimizeWindow : function(cinnamonwm, actor) {
        Main.soundManager.play('minimize');

        // reset all cached values in case "traditional" is no longer in effect
        actor.get_meta_window()._cinnamonwm_has_origin = false;
        this._startWindowEffect(cinnamonwm, "minimize", actor);
    },

    _tileWindow : function (cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
        Main.soundManager.play('tile');

        this._startWindowEffect(cinnamonwm, "tile", actor, [targetX, targetY, targetWidth, targetHeight]);
    },

    _maximizeWindow : function(cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
        Main.soundManager.play('maximize');

        this._startWindowEffect(cinnamonwm, "maximize", actor, [targetX, targetY, targetWidth, targetHeight]);
    },

    _unmaximizeWindow : function(cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
        Main.soundManager.play('unmaximize');

        this._startWindowEffect(cinnamonwm, "unmaximize", actor, [targetX, targetY, targetWidth, targetHeight]);
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

        let dimmer = getWindowDimmer(actor);
        let enabled = Meta.prefs_get_attach_modal_dialogs();
        dimmer.setEnabled(enabled);
        if (!enabled)
            return;

        if (animate) {
            Tweener.addTween(dimmer,
                             { dimFactor: 1.0,
                               time: DIM_TIME,
                               transition: 'linear'
                             });
        } else {
            getWindowDimmer(actor).dimFactor = 1.0;
        }
    },

    _undimWindow: function(window, animate) {
        let actor = window.get_compositor_private();
        if (!actor)
            return;

        let dimmer = getWindowDimmer(actor);
        let enabled = Meta.prefs_get_attach_modal_dialogs();
        dimmer.setEnabled(enabled);
        if (!enabled)
            return;

        if (animate) {
            Tweener.addTween(dimmer,
                             { dimFactor: 0.0,
                               time: UNDIM_TIME,
                               transition: 'linear'
                             });
        } else {
            getWindowDimmer(actor).dimFactor = 0.0;
        }
    },

    _mapWindow : function(cinnamonwm, actor) {
        actor._windowType = actor.meta_window.get_window_type();
        actor._notifyWindowTypeSignalId = actor.meta_window.connect('notify::window-type', Lang.bind(this, function () {
            let type = actor.meta_window.get_window_type();
            actor._windowType = type;
        }));

        if (actor.meta_window.is_attached_dialog()) {
            this._checkDimming(actor.get_meta_window().get_transient_for());
        }

        if (actor.get_meta_window()._cinnamonwm_has_origin === true) {
            Main.soundManager.play('minimize');
            try {
                this._startWindowEffect(cinnamonwm, "unminimize", actor, null, "minimize")
                return;
            } catch(e) {
                //catch "no origin found"
            }
        } else if (actor.meta_window.get_window_type() == Meta.WindowType.NORMAL) {
            Main.soundManager.play('map');
        }
        this._startWindowEffect(cinnamonwm, "map", actor);
    },

    _destroyWindow : function(cinnamonwm, actor) {

        if (actor.meta_window.get_window_type() == Meta.WindowType.NORMAL) {
            Main.soundManager.play('close');
        }

        actor.orig_opacity = actor.opacity;

        let window = actor.meta_window;

        if (window.is_attached_dialog()) {
            let parent = window.get_transient_for();
            this._checkDimming(parent, window);
        }

        if (actor._notifyWindowTypeSignalId) {
            window.disconnect(actor._notifyWindowTypeSignalId);
            actor._notifyWindowTypeSignalId = 0;
        }
        if (window._dimmed) {
            this._dimmedWindows = this._dimmedWindows.filter(function(win) {
                                                                 return win != window;
                                                             });
        }

        if (window.minimized) {
            cinnamonwm.completed_destroy(actor);
            return;
        }

        this._startWindowEffect(cinnamonwm, "close", actor);
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

        for (let i = 0; i < windows.length; i++) {
            let window = windows[i];

            if (!window.meta_window.showing_on_its_workspace())
                continue;

            if ((window.meta_window == this._movingWindow) ||
                ((global.display.get_grab_op() == Meta.GrabOp.MOVING ||
                  global.display.get_grab_op() == Meta.GrabOp.KEYBOARD_MOVING)
                 && window.meta_window == global.display.get_focus_window())) {
                /* We are moving this window to the other workspace. In fact,
                 * it is already on the other workspace, so it is hidden. We
                 * force it to show and then don't animate it, so it stays
                 * there while other windows move. */
                window.show_all();
                this._movingWindow = undefined;
            } else if (window.get_workspace() == from) {
                if (window.origX == undefined) {
                    window.origX = window.x;
                    window.origY = window.y;
                }
                Tweener.addTween(window,
                        { x: window.origX + xDest,
                          y: window.origY + yDest,
                          time: WINDOW_ANIMATION_TIME,
                          transition: 'easeOutQuad',
                          onComplete: function() {
                              window.hide();
                              window.set_position(window.origX, window.origY);
                              window.origX = undefined;
                              window.origY = undefined;
                          }
                        });
            } else if (window.get_workspace() == to) {
                if (window.origX == undefined) {
                    window.origX = window.x;
                    window.origY = window.y;
                    window.set_position(window.origX - xDest, window.origY - yDest);
                }
                Tweener.addTween(window,
                        { x: window.origX,
                          y: window.origY,
                          time: WINDOW_ANIMATION_TIME,
                          transition: 'easeOutQuad',
                          onComplete: Lang.bind(window, function() {
                              window.origX = undefined;
                              window.origY = undefined;
                          })
                        });
                window.show_all();
            }
        }

        Tweener.addTween(this, {time: WINDOW_ANIMATION_TIME, onComplete: function() {
            cinnamonwm.completed_switch_workspace();
        }});
    },

    _showTilePreview: function(cinnamonwm, window, tileRect, monitorIndex, snapQueued) {
        if (!this._tilePreview)
            this._tilePreview = new TilePreview();
        this._tilePreview.show(window, tileRect, monitorIndex, snapQueued);
    },

    _hideTilePreview: function(cinnamonwm) {
        if (!this._tilePreview)
            return;
        this._tilePreview.hide();
        this._tilePreview.destroy();
        this._tilePreview = null;
    },

    _showHudPreview: function(cinnamonwm, currentProximityZone, workArea, snapQueued) {
        if (global.settings.get_boolean("show-tile-hud")) {
            if (!this._hudPreview)
                this._hudPreview = new HudPreview();
            this._hudPreview.show(currentProximityZone, workArea, snapQueued);
        }
    },

    _hideHudPreview: function(cinnamonwm) {
        if (!this._hudPreview)
            return;
        this._hudPreview.hide();
        this._hudPreview.destroy();
        this._hudPreview = null;
    },

    showWorkspaceOSD : function() {
        this._hideSnapOSD();
        this._hideWorkspaceOSD();
        if (global.settings.get_boolean("workspace-osd-visible")) {
            let osd_x = global.settings.get_int("workspace-osd-x");
            let osd_y = global.settings.get_int("workspace-osd-y");
            let duration = global.settings.get_int("workspace-osd-duration") / 1000;
            let current_workspace_index = global.screen.get_active_workspace_index();
            if (this.settings.get_boolean("workspaces-only-on-primary")) {
                this._showWorkspaceOSDOnMonitor(Main.layoutManager.primaryMonitor, osd_x, osd_y, duration, current_workspace_index);
            }
            else {
                for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
                    let monitor = Main.layoutManager.monitors[i];
                    this._showWorkspaceOSDOnMonitor(monitor, osd_x, osd_y, duration, current_workspace_index);
                }
            }
        }
    },

    _showWorkspaceOSDOnMonitor : function(monitor, osd_x, osd_y, duration, current_workspace_index) {
        let osd = new St.Label({style_class:'workspace-osd', important: true});
        this._workspace_osd_array.push(osd);
        osd.set_text(Main.getWorkspaceName(current_workspace_index));
        osd.set_opacity = 0;
        Main.layoutManager.addChrome(osd, { visibleInFullscreen: false, affectsInputRegion: false });
        /*
         * This aligns the osd edges to the minimum/maximum values from gsettings,
         * if those are selected to be used. For values in between minimum/maximum,
         * it shifts the osd by half of the percentage used of the overall space available
         * for display (100% - (left and right 'padding')).
         * The horizontal minimum/maximum values are 5% and 95%, resulting in 90% available for positioning
         * If the user choses 50% as osd position, these calculations result the osd being centered onscreen
         */
        let [minX, maxX, minY, maxY] = [5, 95, 5, 95];
        let delta = (osd_x - minX) / (maxX - minX);
        let x = monitor.x + Math.round((monitor.width * osd_x / 100) - (osd.width * delta));
        delta = (osd_y - minY) / (maxY - minY);
        let y = monitor.y + Math.round((monitor.height * osd_y / 100) - (osd.height * delta));
        osd.set_position(x, y);
        Tweener.addTween(osd, { opacity: 255,
                                time: duration,
                                transition: 'linear',
                                onComplete: this._hideWorkspaceOSD,
                                onCompleteScope: this });
    },

    _hideWorkspaceOSD : function() {
        for (let i = 0; i < this._workspace_osd_array.length; i++) {
            let osd = this._workspace_osd_array[i];
            if (osd != null) {
                osd.hide();
                Main.layoutManager.removeChrome(osd);
                osd.destroy();
            }
        }
        this._workspace_osd_array = []
    },

    _showSnapOSD : function(metaScreen, monitorIndex) {
        if (global.settings.get_boolean("show-snap-osd")) {
            if (this._snapOsd == null) {
                this._snapOsd = new ModalDialog.InfoOSD();

                let mod = this.settings.get_string("snap-modifier");
                if (mod == "Super")
                    this._snapOsd.addText(_("Hold <Super> to enter snap mode"));
                else if (mod == "Alt")
                    this._snapOsd.addText(_("Hold <Alt> to enter snap mode"));
                else if (mod == "Control")
                    this._snapOsd.addText(_("Hold <Ctrl> to enter snap mode"));
                else if (mod == "Shift")
                    this._snapOsd.addText(_("Hold <Shift> to enter snap mode"));
                this._snapOsd.addText(_("Use the arrow keys to shift workspaces"));
            }
            this._snapOsd.show(monitorIndex);
        }
    },

    _hideSnapOSD : function() {
        if (this._snapOsd != null) {
            this._snapOsd.hide();
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

    _shiftWindowToWorkspace : function(window, direction) {
        if (window.get_window_type() === Meta.WindowType.DESKTOP) {
            return;
        }
        this._movingWindow = window;
        let workspace = global.screen.get_active_workspace().get_neighbor(direction);
        if (workspace != global.screen.get_active_workspace()) {
            window.change_workspace(workspace);
            workspace.activate_with_focus(window, global.get_current_time());
            this.showWorkspaceOSD();
        }
    },

    _moveWindowToWorkspaceLeft : function(display, screen, window, binding) {
        this._shiftWindowToWorkspace(window, Meta.MotionDirection.LEFT);
    },

    _moveWindowToWorkspaceRight : function(display, screen, window, binding) {
        this._shiftWindowToWorkspace(window, Meta.MotionDirection.RIGHT);
    },

    moveToWorkspace: function(workspace, direction_hint) {
        let active = global.screen.get_active_workspace();
        if (workspace != active) {
            Main.soundManager.play('switch');
            if (direction_hint)
                workspace.activate_with_direction_hint(direction_hint, global.get_current_time());
            else
                workspace.activate(global.get_current_time());
            this.showWorkspaceOSD();
        }
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

        if (binding.get_name() == 'switch-to-workspace-left') {
           this.actionMoveWorkspaceLeft();
        } else if (binding.get_name() == 'switch-to-workspace-right') {
           this.actionMoveWorkspaceRight();
        }
    },

    actionMoveWorkspaceLeft: function() {
        let active = global.screen.get_active_workspace();
        let neighbor = active.get_neighbor(Meta.MotionDirection.LEFT)
        if (active != neighbor) {
            this.moveToWorkspace(neighbor, Meta.MotionDirection.LEFT);
        }
    },

    actionMoveWorkspaceRight: function() {
        let active = global.screen.get_active_workspace();
        let neighbor = active.get_neighbor(Meta.MotionDirection.RIGHT)
        if (active != neighbor) {
            this.moveToWorkspace(neighbor, Meta.MotionDirection.RIGHT);
        }
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
