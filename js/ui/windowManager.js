// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const {BrightnessContrastEffect, DesaturateEffect} = imports.gi.Clutter;
const Lang = imports.lang;
const {
    GrabOp,
    Rectangle,
    MotionDirection,
    WindowType,
    keybindings_set_custom_handler,
    prefs_get_attach_modal_dialogs
} = imports.gi.Meta;
const {
    Bin,
    Label,
    ThemeContext
} = imports.gi.St;
const {Settings} = imports.gi.Gio;
const {getWindowsForBinding} = imports.ui.appSwitcher.appSwitcher;
const {CoverflowSwitcher} = imports.ui.appSwitcher.coverflowSwitcher;
const {TimelineSwitcher} = imports.ui.appSwitcher.timelineSwitcher;
const {ClassicSwitcher} = imports.ui.appSwitcher.classicSwitcher;
const {
    Map,
    Close,
    Minimize,
    Unminimize,
    Tile,
    Maximize,
    Unmaximize
} = imports.ui.windowEffects;
const {each, filter, tryFn} = imports.misc.util;
const Main = imports.ui.main;
const {
    expo,
    getWorkspaceName,
    layoutManager,
    overview,
    panelManager,
    soundManager,
} = Main;
const {InfoOSD} = imports.ui.modalDialog;
const {
    addTween,
    removeTweens
} = imports.ui.tweener;

const WINDOW_ANIMATION_TIME = 0.25;
const TILE_HUD_ANIMATION_TIME = 0.15;
const DIM_TIME = 0.500;
const DIM_DESATURATION = 0.6;
const DIM_BRIGHTNESS = -0.2;
const UNDIM_TIME = 0.250;
const WORKSPACE_OSD_TIMEOUT = 0.4;

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

class WindowDimmer {
    constructor(actor) {
        this._desaturateEffect = new DesaturateEffect();
        this._brightnessEffect = new BrightnessContrastEffect();
        actor.add_effect(this._desaturateEffect);
        actor.add_effect(this._brightnessEffect);

        this.actor = actor;
        this._dimFactor = 0.0;
    }

    setEnabled(enabled) {
        this._desaturateEffect.enabled = enabled;
        this._brightnessEffect.enabled = enabled;
    }

    set dimFactor(factor) {
        this._dimFactor = factor;
        this._desaturateEffect.set_factor(factor * DIM_DESATURATION);
        this._brightnessEffect.set_brightness(factor * DIM_BRIGHTNESS);
    }

    get dimFactor() {
        return this._dimFactor;
    }
};

function getWindowDimmer(actor) {
    if (!actor._windowDimmer)
        actor._windowDimmer = new WindowDimmer(actor);

    return actor._windowDimmer;
}

class TilePreview {
    constructor() {
        this.actor = new Bin({ style_class: 'tile-preview', important: true });
        global.window_group.add_actor(this.actor);

        this._snapQueued = 0;
        this._reset();
        this._showing = false;
    }

    show(window, tileRect, monitorIndex, snapQueued, effectsEnabled) {
        let windowActor = window.get_compositor_private();
        if (!windowActor)
            return;

        if (this._snapQueued != snapQueued) {
            this._updateStyle();
            this._snapQueued = snapQueued;
        }

        if (this._rect && this._rect.equal(tileRect))
            return;

        let changeMonitor = (this._monitorIndex === -1 ||
                             this._monitorIndex != monitorIndex);

        this._monitorIndex = monitorIndex;
        this._rect = tileRect;
        let monitor = layoutManager.monitors[monitorIndex];
        let {x, y, width, height} = tileRect;

        if (!this._showing || changeMonitor) {
            let monitorRect = new Rectangle({ x: monitor.x,
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
        windowActor.get_parent().set_child_above_sibling(windowActor, null);

        let props = {
            x,
            y,
            width,
            height,
            opacity: 255,
        };

        if (effectsEnabled) {
            Object.assign(props, {
                time: WINDOW_ANIMATION_TIME,
                transition: 'easeOutQuad'
            });
            addTween(this.actor, props);
            return;
        }

        Object.assign(this.actor, props);
    }

    hide(effectsEnabled) {
        if (!this._showing)
            return;

        this._showing = false;

        if (effectsEnabled) {
            addTween(this.actor, {
                opacity: 0,
                time: WINDOW_ANIMATION_TIME,
                transition: 'easeOutQuad',
                onComplete: () => this._reset()
            });
            return;
        }
        this.actor.opacity = 0;

    }

    _reset() {
        this.actor.hide();
        this._rect = null;
        this._monitorIndex = -1;
    }

    _updateStyle() {
        if (this.actor.has_style_class_name('snap'))
            this.actor.remove_style_class_name('snap');
        else
            this.actor.add_style_class_name('snap');
    }

    destroy() {
        this.actor.destroy();
    }
};

class HudPreview {
    constructor() {
        this.actor = new Bin({ style_class: 'tile-hud', important: true });
        global.window_group.add_actor(this.actor);

        this._tileHudSettings = new Settings({ schema_id: "org.cinnamon.muffin" });
        this._tileHudSettings.connect("changed::tile-hud-threshold", () => this._onTileHudSettingsChanged());

        this._onTileHudSettingsChanged();
        this._snapQueued = 0;

        this._reset();
        this._showing = false;
    }

    show(currentProximityZone, workArea, snapQueued, effectsEnabled) {
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
            this.actor.get_parent().set_child_above_sibling(this.actor, null);
            this.actor.opacity = 0;

            let props = {
                x: this._animatedX,
                y: this._animatedY,
                width: this._animatedW,
                height: this._animatedH,
                opacity: 255,
            };

            if (effectsEnabled) {
                Object.assign(props, {
                    time: TILE_HUD_ANIMATION_TIME,
                    transition: 'easeOutQuad'
                })
                addTween(this.actor, props);
                return;
            }

            Object.assign(this.actor, props);
        }
    }

    hide(effectsEnabled) {
        if (!this._showing)
            return;
        this._showing = false;
        let props = {
            x: this._x,
            y: this._y,
            width: this._w,
            height: this._h,
            opacity: 0,
        };

        if (effectsEnabled) {
            Object.assign(props, {
                time: TILE_HUD_ANIMATION_TIME,
                transition: 'easeOutQuad',
                onComplete: () => this._reset()
            });
            addTween(this.actor, props);
            return;
        }

        Object.assign(this.actor, props);
    }

    _reset() {
        this.actor.hide();
        this._zone = -1;
    }

    _onTileHudSettingsChanged() {
        let scaleFactor = global.ui_scale;
        this._hudSize = this._tileHudSettings.get_int("tile-hud-threshold") * scaleFactor;

    }

    _updateStyle(pseudoClass) {
        let currentStyle = this.actor.get_style_pseudo_class();
        if (currentStyle)
            this.actor.remove_style_pseudo_class(currentStyle);
        if (pseudoClass) {
            this.actor.set_style_pseudo_class(pseudoClass);
        }
    }

    _updateSnapStyle() {
        if (this.actor.has_style_class_name('snap'))
            this.actor.remove_style_class_name('snap');
        else
            this.actor.add_style_class_name('snap');
    }

    destroy() {
        this.actor.destroy();
    }
}

var WindowManager = class WindowManager {
    constructor() {
        this._minimizing = [];
        this._maximizing = [];
        this._unmaximizing = [];
        this._tiling = [];
        this._mapping = [];
        this._destroying = [];

        const _endWindowEffect = (c, n, a) => this._endWindowEffect(c, n, a);

        this.effects = {
            map: new Map(_endWindowEffect),
            close: new Close(_endWindowEffect),
            minimize: new Minimize(_endWindowEffect),
            unminimize: new Unminimize(_endWindowEffect),
            tile: new Tile(_endWindowEffect),
            maximize: new Maximize(_endWindowEffect),
            unmaximize: new Unmaximize(_endWindowEffect)
        };

        this.settings = new Settings({schema_id: 'org.cinnamon.muffin'});

        this.settingsState = {
            'desktop-effects-on-dialogs': global.settings.get_boolean('desktop-effects-on-dialogs'),
            'desktop-effects-on-menus': global.settings.get_boolean('desktop-effects-on-menus'),
            'desktop-effects-workspace': global.settings.get_boolean('desktop-effects-workspace'),
            'desktop-effects': this.settings.get_boolean('desktop-effects'),
            'desktop-effects-map': global.settings.get_string('desktop-effects-map'),
            'desktop-effects-close': global.settings.get_string('desktop-effects-close'),
            'desktop-effects-minimize': global.settings.get_string('desktop-effects-minimize'),
            'desktop-effects-maximize': global.settings.get_boolean('desktop-effects-maximize'),
            'desktop-effects-change-size': global.settings.get_boolean('desktop-effects-change-size')
        };

        global.settings.connect('changed::desktop-effects-on-dialogs', (s, k) => this.onSettingsChanged(s, k, 'get_boolean'));
        global.settings.connect('changed::desktop-effects-on-menus', (s, k) => this.onSettingsChanged(s, k, 'get_boolean'));
        global.settings.connect('changed::desktop-effects-workspace', (s, k) => this.onSettingsChanged(s, k, 'get_boolean'));
        this.settings.connect('changed::desktop-effects', (s, k) => this.onSettingsChanged(s, k, 'get_boolean'));
        global.settings.connect('changed::desktop-effects-map', (s, k) => this.onSettingsChanged(s, k, 'get_string'));
        global.settings.connect('changed::desktop-effects-close', (s, k) => this.onSettingsChanged(s, k, 'get_string'));
        global.settings.connect('changed::desktop-effects-minimize', (s, k) => this.onSettingsChanged(s, k, 'get_string'));
        global.settings.connect('changed::desktop-effects-maximize', (s, k) => this.onSettingsChanged(s, k, 'get_boolean'));
        global.settings.connect('changed::desktop-effects-change-size', (s, k) => this.onSettingsChanged(s, k, 'get_boolean'));

        this._snapOsd = null;
        this._workspace_osd_array = [];

        this._tilePreview = null;
        this._hudPreview = null;

        this._dimmedWindows = [];

        this._animationBlockCount = 0;

        this._switchData = null;
        global.window_manager.connect('kill-window-effects', (c, a) => this._killWindowEffects(c, a));
        global.window_manager.connect('switch-workspace', (c, f, t, d) => this._switchWorkspace(c, f, t, d));
        global.window_manager.connect('minimize', (c, a) => this._minimizeWindow(c, a));
        global.window_manager.connect('maximize', (c, a, x, y, w, h) => this._maximizeWindow(c, a, x, y, w, h));
        global.window_manager.connect('unmaximize', (c, a, x, y, w, h) => this._unmaximizeWindow(c, a, x, y, w, h));
        global.window_manager.connect('tile', (c, a, x, y, w, h) => this._tileWindow(c, a, x, y, w, h));
        global.window_manager.connect('show-tile-preview', (c, w, t, m, s) => this._showTilePreview(c, w, t, m, s));
        global.window_manager.connect('hide-tile-preview', (c) => this._hideTilePreview(c));
        global.window_manager.connect('show-hud-preview', (c, p, w, s) => this._showHudPreview(c, p, w, s));
        global.window_manager.connect('hide-hud-preview', (c) => this._hideHudPreview(c));
        global.window_manager.connect('map', (c, a) => this._mapWindow(c, a));
        global.window_manager.connect('destroy', (c, a) => this._destroyWindow(c, a));

        keybindings_set_custom_handler('move-to-workspace-left', (d, s, w, b) => this._moveWindowToWorkspaceLeft(d, s, w, b));
        keybindings_set_custom_handler('move-to-workspace-right', (d, s, w, b) => this._moveWindowToWorkspaceRight(d, s, w, b));

        keybindings_set_custom_handler('switch-to-workspace-left', (d, s, w, b) => this._showWorkspaceSwitcher(d, s, w, b));
        keybindings_set_custom_handler('switch-to-workspace-right', (d, s, w, b) => this._showWorkspaceSwitcher(d, s, w, b));
        keybindings_set_custom_handler('switch-to-workspace-up', (d, s, w, b) => this._showWorkspaceSwitcher(d, s, w, b));
        keybindings_set_custom_handler('switch-to-workspace-down', (d, s, w, b) => this._showWorkspaceSwitcher(d, s, w, b));
        keybindings_set_custom_handler('switch-windows', (d, s, w, b) => this._startAppSwitcher(d, s, w, b));
        keybindings_set_custom_handler('switch-group', (d, s, w, b) => this._startAppSwitcher(d, s, w, b));
        keybindings_set_custom_handler('switch-windows-backward', (d, s, w, b) => this._startAppSwitcher(d, s, w, b));
        keybindings_set_custom_handler('switch-group-backward', (d, s, w, b) => this._startAppSwitcher(d, s, w, b));
        keybindings_set_custom_handler('switch-panels', (d, s, w, b) => this._startAppSwitcher(d, s, w, b));
        keybindings_set_custom_handler('switch-panels-backward', (d, s, w, b) => this._startAppSwitcher(d, s, w, b));

        overview.connect('showing', () => {
            let {_dimmedWindows} = this;
            for (let i = 0, len = _dimmedWindows.length; i < len; i++) {
                this._undimWindow(_dimmedWindows[i], true);
            }
        });
        overview.connect('hiding', () => {
            let {_dimmedWindows} = this;
            for (let i = 0, len = _dimmedWindows.length; i < len; i++) {
                this._dimWindow(_dimmedWindows[i], true);
            }
        });

        global.screen.connect ('show-snap-osd', (m, i) => this._showSnapOSD(m, i));
        global.screen.connect ('hide-snap-osd', () => this._hideSnapOSD());
        global.screen.connect ('show-workspace-osd', () => this.showWorkspaceOSD());
    }

    onSettingsChanged(settings, key, type) {
        switch (settings.schema) {
            case 'org.cinnamon':
                this.settingsState[key] = global.settings[type](key);
                break;
            case 'org.cinnamon.muffin':
                this.settingsState[key] = this.settings[type](key);
                break;
        }
    }

    blockAnimations() {
        this._animationBlockCount++;
    }

    unblockAnimations() {
        this._animationBlockCount = Math.max(0, this._animationBlockCount - 1);
    }

    _shouldAnimate(actor) {
        // Check if system is in modal state or in software rendering
        if (Main.modalCount || Main.software_rendering) {
            return false;
        }

        switch (actor.meta_window.window_type) {
            case WindowType.NORMAL:
                return true;
            case WindowType.DIALOG:
            case WindowType.MODAL_DIALOG:
                return this.settingsState['desktop-effects-on-dialogs'];
            case WindowType.MENU:
            case WindowType.DROPDOWN_MENU:
            case WindowType.POPUP_MENU:
                return this.settingsState['desktop-effects-on-menus'];
            default:
                return false;
        }
    }

    _startWindowEffect(cinnamonwm, name, actor, args, overwriteKey) {
        let effect = this.effects[name];

        if (!this.settingsState['desktop-effects'] || !this._shouldAnimate(actor)) {
            cinnamonwm[effect.wmCompleteName](actor);
            return;
        }

        let key = "desktop-effects-" + (overwriteKey || effect.name);
        if (key == null || key == 'none') {
            cinnamonwm[effect.wmCompleteName](actor);
            return;
        }

        let type = this.settingsState[key];

        // menu effects should always be traditional
        if (actor.meta_window.window_type == WindowType.MENU ||
            actor.meta_window.window_type == WindowType.DROPDOWN_MENU ||
            actor.meta_window.window_type == WindowType.POPUP_MENU) {
            type = 'traditional';
        }

        // make sure to end a running effect
        if (actor.current_effect_name) {
            this._endWindowEffect(cinnamonwm, actor.current_effect_name, actor);
        }
        this[effect.arrayName].push(actor);
        actor.current_effect_name = name;
        actor.orig_opacity = actor.opacity;
        actor.show();

        if (effect[type]) {
            effect[type](cinnamonwm, actor, args);
        } else if (!overwriteKey) // when not unminimizing, but the effect was not found, end it
            this._endWindowEffect(cinnamonwm, name, actor);
    }

    _startTraditionalWindowEffect(cinnamonwm, name, actor, args) {
        let effect = this.effects[name];

        if (!this.settingsState['desktop-effects'] || !this._shouldAnimate(actor) || !this.settingsState["desktop-effects-change-size"]) {
            cinnamonwm[effect.wmCompleteName](actor);
            return;
        }

        let type = "traditional";

        // make sure to end a running effect
        if (actor.current_effect_name) {
            this._endWindowEffect(cinnamonwm, actor.current_effect_name, actor);
        }
        this[effect.arrayName].push(actor);
        actor.current_effect_name = name;
        actor.orig_opacity = actor.opacity;
        actor.show();

        if (effect[type]) {
            effect[type](cinnamonwm, actor, args);
        }
    }

    _endWindowEffect(cinnamonwm, name, actor) {
        let effect = this.effects[name];
        // effect will be an instance of Effect
        let idx = this[effect.arrayName].indexOf(actor);
        if (idx !== -1) {
            this[effect.arrayName].splice(idx, 1);
            removeTweens(actor);
            delete actor.current_effect_name;
            effect._end(actor);
            cinnamonwm[effect.wmCompleteName](actor);
            panelManager.updatePanelsVisibility();
        }
    }

    _killWindowEffects(cinnamonwm, actor) {
        for (let i in this.effects) {
            this._endWindowEffect(cinnamonwm, i, actor);
        }
    }

    _minimizeWindow(cinnamonwm, actor) {
        soundManager.play('minimize');

        // reset all cached values in case the minimize effect is no longer in effect
        actor.meta_window._cinnamonwm_has_origin = false;
        this._startWindowEffect(cinnamonwm, "minimize", actor);
    }

    _tileWindow(cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
        soundManager.play('tile');

        this._startTraditionalWindowEffect(cinnamonwm, "tile", actor, [targetX, targetY, targetWidth, targetHeight]);
    }

    _maximizeWindow(cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
        soundManager.play('maximize');

        this._startWindowEffect(cinnamonwm, "maximize", actor, [targetX, targetY, targetWidth, targetHeight]);
    }

    _unmaximizeWindow(cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
        soundManager.play('unmaximize');

        this._startTraditionalWindowEffect(cinnamonwm, "unmaximize", actor, [targetX, targetY, targetWidth, targetHeight]);
    }

    _hasAttachedDialogs(window, ignoreWindow) {
        let count = 0;
        window.foreach_transient(function(win) {
            if (win != ignoreWindow && win.is_attached_dialog())
                count++;
            return false;
        });
        return count != 0;
    }

    _checkDimming(window, ignoreWindow) {
        let shouldDim = this._hasAttachedDialogs(window, ignoreWindow);

        if (shouldDim && !window._dimmed) {
            window._dimmed = true;
            this._dimmedWindows.push(window);
            if (!overview.visible)
                this._dimWindow(window, true);
        } else if (!shouldDim && window._dimmed) {
            window._dimmed = false;
            this._dimmedWindows = filter(this._dimmedWindows, function(win) {
                return win !== window;
            });
            if (!overview.visible)
                this._undimWindow(window, true);
        }
    }

    _dimWindow(window, animate) {
        let actor = window.get_compositor_private();
        if (!actor)
            return;

        let dimmer = getWindowDimmer(actor);
        let enabled = prefs_get_attach_modal_dialogs();
        dimmer.setEnabled(enabled);
        if (!enabled)
            return;

        if (animate) {
            addTween(dimmer,
                             { dimFactor: 1.0,
                               time: DIM_TIME,
                               transition: 'linear'
                             });
        } else {
            getWindowDimmer(actor).dimFactor = 1.0;
        }
    }

    _undimWindow(window, animate) {
        let actor = window.get_compositor_private();
        if (!actor)
            return;

        let dimmer = getWindowDimmer(actor);
        let enabled = prefs_get_attach_modal_dialogs();
        dimmer.setEnabled(enabled);
        if (!enabled)
            return;

        if (animate) {
            addTween(dimmer,
                             { dimFactor: 0.0,
                               time: UNDIM_TIME,
                               transition: 'linear'
                             });
        } else {
            getWindowDimmer(actor).dimFactor = 0.0;
        }
    }

    _mapWindow(cinnamonwm, actor) {
        let {meta_window} = actor;
        if (meta_window.is_attached_dialog()) {
            this._checkDimming(meta_window.get_transient_for());
        }

        if (meta_window._cinnamonwm_has_origin && meta_window._cinnamonwm_has_origin === true) {
            soundManager.play('minimize');
            this._startWindowEffect(cinnamonwm, 'unminimize', actor, null, 'minimize');
            return;
        } else if (meta_window.window_type === WindowType.NORMAL) {
            soundManager.play('map');
        }
        this._startWindowEffect(cinnamonwm, "map", actor);
    }

    _destroyWindow(cinnamonwm, actor) {
        let {meta_window} = actor;

        if (actor.meta_window.window_type === WindowType.NORMAL) {
            soundManager.play('close');
        }

        actor.orig_opacity = actor.opacity;
        actor.orig_opacity = actor.opacity;

        if (meta_window.is_attached_dialog()) {
            let parent = meta_window.get_transient_for();
            this._checkDimming(parent, meta_window);
        }

        if (actor._notifyWindowTypeSignalId) {
            meta_window.disconnect(actor._notifyWindowTypeSignalId);
            actor._notifyWindowTypeSignalId = 0;
        }
        if (meta_window._dimmed) {
            this._dimmedWindows = filter(this._dimmedWindows, function(win) {
                return win !== meta_window;
            });
        }

        if (meta_window.minimized) {
            cinnamonwm.completed_destroy(actor);
            return;
        }

        this._startWindowEffect(cinnamonwm, "close", actor);
    }

    _switchWorkspace(cinnamonwm, from, to, direction) {
        soundManager.play('switch');

        if (!this.settingsState['desktop-effects-workspace'] || Main.modalCount || Main.software_rendering) {
            this.showWorkspaceOSD();
            cinnamonwm.completed_switch_workspace();
            return;
        }

        this.showWorkspaceOSD();

        let windows = global.get_window_actors();

        /* @direction is the direction that the "camera" moves, so the
         * screen contents have to move one screen's worth in the
         * opposite direction.
         */
        let xDest = 0, yDest = 0;
        let {display, screen_width, screen_height} = global;
        let {focus_window} = display;
        let grabOp = display.get_grab_op();


        if (direction === MotionDirection.UP ||
            direction === MotionDirection.UP_LEFT ||
            direction === MotionDirection.UP_RIGHT)
            yDest = screen_height;
        else if (direction === MotionDirection.DOWN ||
            direction === MotionDirection.DOWN_LEFT ||
            direction === MotionDirection.DOWN_RIGHT)
            yDest = -screen_height;

        if (direction === MotionDirection.LEFT ||
            direction === MotionDirection.UP_LEFT ||
            direction === MotionDirection.DOWN_LEFT)
            xDest = screen_width;
        else if (direction === MotionDirection.RIGHT ||
                 direction === MotionDirection.UP_RIGHT ||
                 direction === MotionDirection.DOWN_RIGHT)
            xDest = -screen_width;

        for (let i = 0; i < windows.length; i++) {
            let window = windows[i];
            let {meta_window} = window;

            if (!meta_window.showing_on_its_workspace())
                continue;

            if ((meta_window === this._movingWindow) ||
                ((grabOp === GrabOp.MOVING ||
                  grabOp === GrabOp.KEYBOARD_MOVING)
                 && meta_window === focus_window)) {
                /* We are moving this window to the other workspace. In fact,
                 * it is already on the other workspace, so it is hidden. We
                 * force it to show and then don't animate it, so it stays
                 * there while other windows move. */
                window.show_all();
                this._movingWindow = undefined;
            } else if (window.get_workspace() === from) {
                if (window.origX == undefined) {
                    window.origX = window.x;
                    window.origY = window.y;
                }
                addTween(window,
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
            } else if (window.get_workspace() === to) {
                if (window.origX == undefined) {
                    window.origX = window.x;
                    window.origY = window.y;
                    window.set_position(window.origX - xDest, window.origY - yDest);
                }
                addTween(window, {
                    x: window.origX,
                    y: window.origY,
                    time: WINDOW_ANIMATION_TIME,
                    transition: 'easeOutQuad',
                    onComplete: function() {
                        window.origX = undefined;
                        window.origY = undefined;
                    }
                });
                window.show_all();
            }
        }

        addTween(this, {time: WINDOW_ANIMATION_TIME, onComplete: function() {
            cinnamonwm.completed_switch_workspace();
        }});
    }

    _showTilePreview(cinnamonwm, window, tileRect, monitorIndex, snapQueued) {
        if (!this._tilePreview)
            this._tilePreview = new TilePreview();
        this._tilePreview.show(window, tileRect, monitorIndex, snapQueued, this.settingsState['desktop-effects-workspace']);
    }

    _hideTilePreview(cinnamonwm) {
        if (!this._tilePreview)
            return;
        this._tilePreview.hide(this.settingsState['desktop-effects-workspace']);
        this._tilePreview.destroy();
        this._tilePreview = null;
    }

    _showHudPreview(cinnamonwm, currentProximityZone, workArea, snapQueued) {
        if (global.settings.get_boolean('show-tile-hud')) {
            if (!this._hudPreview)
                this._hudPreview = new HudPreview();
            this._hudPreview.show(currentProximityZone, workArea, snapQueued, this.settingsState['desktop-effects-workspace']);
        }
    }

    _hideHudPreview(cinnamonwm) {
        if (!this._hudPreview)
            return;
        this._hudPreview.hide(this.settingsState['desktop-effects-workspace']);
        this._hudPreview.destroy();
        this._hudPreview = null;
    }

    showWorkspaceOSD() {
        this._hideSnapOSD();
        this._hideWorkspaceOSD();
        if (global.settings.get_boolean('workspace-osd-visible')) {
            let current_workspace_index = global.screen.get_active_workspace_index();
            if (this.settings.get_boolean('workspaces-only-on-primary')) {
                this._showWorkspaceOSDOnMonitor(layoutManager.primaryMonitor, current_workspace_index);
            }
            else {
                let {monitors} = layoutManager;
                for (let i = 0; i < monitors.length; i++) {
                    this._showWorkspaceOSDOnMonitor(monitors[i], current_workspace_index);
                }
            }
        }
    }

    _showWorkspaceOSDOnMonitor(monitor, current_workspace_index) {
        let osd = new InfoOSD();
        osd.actor.add_style_class_name('workspace-osd');
        this._workspace_osd_array.push(osd);
        osd.addText(getWorkspaceName(current_workspace_index));
        osd.show();

        setTimeout(() => this._hideWorkspaceOSD(), WORKSPACE_OSD_TIMEOUT * 1000);
    }

    _hideWorkspaceOSD() {
        let effectsEnabled = this.settingsState['desktop-effects-workspace'];

        for (let i = 0; i < this._workspace_osd_array.length; i++) {
            let osd = this._workspace_osd_array[i];
            if (osd != null) {
                if (effectsEnabled) {
                    osd.actor.opacity = 255;
                    addTween(osd.actor, {
                        opacity: 0,
                        time: WORKSPACE_OSD_TIMEOUT,
                        transition: 'linear',
                        onComplete: () => osd.destroy()
                    });
                } else {
                    osd.destroy();
                }
            }
        }
        this._workspace_osd_array = [];
    }

    _showSnapOSD(metaScreen, monitorIndex) {
        if (global.settings.get_boolean('show-snap-osd')) {
            if (this._snapOsd == null) {
                this._snapOsd = new InfoOSD();

                let mod = this.settings.get_string('snap-modifier');
                if (mod === 'Super')
                    this._snapOsd.addText(_("Hold <Super> to enter snap mode"));
                else if (mod === 'Alt')
                    this._snapOsd.addText(_("Hold <Alt> to enter snap mode"));
                else if (mod === 'Control')
                    this._snapOsd.addText(_("Hold <Ctrl> to enter snap mode"));
                else if (mod === 'Shift')
                    this._snapOsd.addText(_("Hold <Shift> to enter snap mode"));
                this._snapOsd.addText(_("Use the arrow or numeric keys to switch workspaces while dragging"));
            }
            this._snapOsd.show(monitorIndex);
        }
    }

    _hideSnapOSD() {
        if (this._snapOsd != null) {
            this._snapOsd.hide();
        }
    }

    _createAppSwitcher(binding) {
        if (getWindowsForBinding(binding).length === 0) return;

        switch (global.settings.get_string('alttab-switcher-style')) {
            case 'coverflow':
                new CoverflowSwitcher(binding);
                break;
            case 'timeline':
                new TimelineSwitcher(binding);
                break;
            default:
                new ClassicSwitcher(binding);
        }
    }

    _startAppSwitcher(display, screen, window, binding) {
        this._createAppSwitcher(binding);
    }

    _shiftWindowToWorkspace(window, direction) {
        if (window.window_type === WindowType.DESKTOP) {
            return;
        }
        this._movingWindow = window;
        let workspace = global.screen.get_active_workspace().get_neighbor(direction);
        if (workspace != global.screen.get_active_workspace()) {
            window.change_workspace(workspace);
            workspace.activate_with_focus(window, global.get_current_time());
        }
    }

    _moveWindowToWorkspaceLeft(display, screen, window, binding) {
        this._shiftWindowToWorkspace(window, MotionDirection.LEFT);
    }

    _moveWindowToWorkspaceRight(display, screen, window, binding) {
        this._shiftWindowToWorkspace(window, MotionDirection.RIGHT);
    }

    moveToWorkspace(workspace, direction_hint) {
        let active = global.screen.get_active_workspace();
        if (workspace != active) {
            if (direction_hint)
                workspace.activate_with_direction_hint(direction_hint, global.get_current_time());
            else
                workspace.activate(global.get_current_time());
        }
    }

    _showWorkspaceSwitcher(display, screen, window, binding) {
        let bindingName = binding.get_name();
        if (bindingName === 'switch-to-workspace-up') {
            expo.toggle();
            return;
        }
        if (bindingName === 'switch-to-workspace-down') {
            overview.toggle();
            return;
        }

        if (screen.n_workspaces === 1)
            return;

        if (bindingName === 'switch-to-workspace-left') {
            this.actionMoveWorkspaceLeft();
        } else if (bindingName === 'switch-to-workspace-right') {
            this.actionMoveWorkspaceRight();
        }
    }

    actionMoveWorkspaceLeft() {
        let active = global.screen.get_active_workspace();
        let neighbor = active.get_neighbor(MotionDirection.LEFT)
        if (active != neighbor) {
            this.moveToWorkspace(neighbor, MotionDirection.LEFT);
        }
    }

    actionMoveWorkspaceRight() {
        let active = global.screen.get_active_workspace();
        let neighbor = active.get_neighbor(MotionDirection.RIGHT)
        if (active != neighbor) {
            this.moveToWorkspace(neighbor, MotionDirection.RIGHT);
        }
    }

    actionMoveWorkspaceUp() {
        global.screen.get_active_workspace().get_neighbor(MotionDirection.UP).activate(global.get_current_time());
    }

    actionMoveWorkspaceDown() {
        global.screen.get_active_workspace().get_neighbor(MotionDirection.DOWN).activate(global.get_current_time());
    }

    actionFlipWorkspaceLeft() {
        let active = global.screen.get_active_workspace();
        let neighbor = active.get_neighbor(MotionDirection.LEFT);
        if (active != neighbor) {
            neighbor.activate(global.get_current_time());
            let [x, y, mods] = global.get_pointer();
            global.set_pointer(global.screen_width - 10, y);
        }
    }

    actionFlipWorkspaceRight() {
        let active = global.screen.get_active_workspace();
        let neighbor = active.get_neighbor(MotionDirection.RIGHT);
        if (active != neighbor) {
            neighbor.activate(global.get_current_time());
            let [x, y, mods] = global.get_pointer();
            global.set_pointer(10, y);
        }
    }
};
