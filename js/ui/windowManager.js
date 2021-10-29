// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cinnamon = imports.gi.Cinnamon;
const {BrightnessContrastEffect, DesaturateEffect, OffscreenRedirect} = imports.gi.Clutter;
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
    ThemeContext,
    Widget
} = imports.gi.St;
const {Settings} = imports.gi.Gio;
const {getWindowsForBinding} = imports.ui.appSwitcher.appSwitcher;
const {CoverflowSwitcher} = imports.ui.appSwitcher.coverflowSwitcher;
const {TimelineSwitcher} = imports.ui.appSwitcher.timelineSwitcher;
const {ClassicSwitcher} = imports.ui.appSwitcher.classicSwitcher;
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
const WindowMenu = imports.ui.windowMenu;

const WINDOW_ANIMATION_TIME = 0.25;
const MAP_ANIMATION_TIME = 0.1;
const DESTROY_ANIMATION_TIME = 0.15;
const MINIMIZE_ANIMATION_TIME = 0.16;
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

        this._reset();
        this._showing = false;
    }

    show(window, tileRect, monitorIndex) {
        let windowActor = window.get_compositor_private();
        if (!windowActor)
            return;

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
            let [, rect] = window.get_buffer_rect().intersect(monitorRect);
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

        if (true) {
            Object.assign(props, {
                time: WINDOW_ANIMATION_TIME,
                transition: 'easeOutQuad'
            });
            addTween(this.actor, props);
            return;
        }

        Object.assign(this.actor, props);
    }

    hide() {
        if (!this._showing)
            return;

        this._showing = false;

        if (true) {
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

var WindowManager = class WindowManager {
    constructor() {
        this._cinnamonwm = global.window_manager;

        this._minimizing = new Set();
        this._unminimizing = new Set();
        this._mapping = new Set();
        this._resizing = new Set();
        this._resizePending = new Set();
        this._destroying = new Set();
        this._movingWindow = null;

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
            'desktop-effects': true//this.settings.get_boolean('desktop-effects'),
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
        // this.settings.connect('changed::desktop-effects', (s, k) => this.onSettingsChanged(s, k, 'get_boolean'));

        each(this.effects, (value, key) => {
            // if (key === 'unminimize') return;
            each(SETTINGS_EFFECTS_TYPES, (item) => {
                let [name, type] = item;
                let property = `desktop-effects-${key}-${name}`;
                settingsState[property] = global.settings[type](property);
                global.settings.connect(`changed::${property}`, (s, k) => this.onSettingsChanged(s, k, type));
            });
        });
        this.settings = new Settings({schema_id: 'org.cinnamon.muffin'});
        this.hasEffects = global.settings.get_boolean('desktop-effects');

        global.settings.connect('changed::desktop-effects', (s, k) => this.onSettingsChanged(s, k, 'get_boolean'));

        this._workspace_osd_array = [];
        this._tilePreview = null;
        this._dimmedWindows = [];
        this._animationBlockCount = 0;
        this._switchData = null;

        this._cinnamonwm.connect('kill-window-effects', (cinnamonwm, actor) => {
            this._minimizeWindowDone(cinnamonwm, actor);
            this._mapWindowDone(cinnamonwm, actor);
            this._destroyWindowDone(cinnamonwm, actor);
            this._sizeChangeWindowDone(cinnamonwm, actor);
        });

        this._cinnamonwm.connect('show-tile-preview', this._showTilePreview.bind(this));
        this._cinnamonwm.connect('hide-tile-preview', this._hideTilePreview.bind(this));
        this._cinnamonwm.connect('show-window-menu', this._showWindowMenu.bind(this));
        this._cinnamonwm.connect('minimize', this._minimizeWindow.bind(this));
        this._cinnamonwm.connect('unminimize', this._unminimizeWindow.bind(this));
        this._cinnamonwm.connect('size-change', this._sizeChangeWindow.bind(this));
        this._cinnamonwm.connect('size-changed', this._sizeChangedWindow.bind(this));
        this._cinnamonwm.connect('map', this._mapWindow.bind(this));
        this._cinnamonwm.connect('destroy', this._destroyWindow.bind(this));
        this._cinnamonwm.connect('filter-keybinding', this._filterKeybinding.bind(this));
        global.window_manager.connect('switch-workspace', (c, f, t, d) => this._switchWorkspace(c, f, t, d));

        keybindings_set_custom_handler('move-to-workspace-left', (d, w, b) => this._moveWindowToWorkspaceLeft(d, w, b));
        keybindings_set_custom_handler('move-to-workspace-right', (d, w, b) => this._moveWindowToWorkspaceRight(d, w, b));

        keybindings_set_custom_handler('switch-to-workspace-left', (d, w, b) => this._showWorkspaceSwitcher(d, w, b));
        keybindings_set_custom_handler('switch-to-workspace-right', (d, w, b) => this._showWorkspaceSwitcher(d, w, b));
        keybindings_set_custom_handler('switch-to-workspace-up', (d, w, b) => this._showWorkspaceSwitcher(d, w, b));
        keybindings_set_custom_handler('switch-to-workspace-down', (d, w, b) => this._showWorkspaceSwitcher(d, w, b));
        keybindings_set_custom_handler('switch-windows', (d, w, b) => this._startAppSwitcher(d, w, b));
        keybindings_set_custom_handler('switch-group', (d, w, b) => this._startAppSwitcher(d, w, b));
        keybindings_set_custom_handler('switch-windows-backward', (d, w, b) => this._startAppSwitcher(d, w, b));
        keybindings_set_custom_handler('switch-group-backward', (d, w, b) => this._startAppSwitcher(d, w, b));
        keybindings_set_custom_handler('switch-panels', (d, w, b) => this._startAppSwitcher(d, w, b));
        keybindings_set_custom_handler('switch-panels-backward', (d, w, b) => this._startAppSwitcher(d, w, b));

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

        this._windowMenuManager = new WindowMenu.WindowMenuManager();
    }

    onSettingsChanged(settings, key, type) {
        this.hasEffects = global.settings.get_boolean('desktop-effects');
    }

    blockAnimations() {
        this._animationBlockCount++;
    }

    unblockAnimations() {
        this._animationBlockCount = Math.max(0, this._animationBlockCount - 1);
    }

    _shouldAnimateActor(actor, types) {
        // Check if system is in modal state or in software rendering
        if (!this.hasEffects || Main.modalCount || Main.software_rendering) {
            return false;
        }

        let type = actor.meta_window.get_window_type();
        return types.includes(type);
    }

    _startWindowEffect(cinnamonwm, name, actor, args, overwriteKey) {
        let effect = this.effects[name];

        if (!this.settingsState['desktop-effects'] || !this._shouldAnimate(actor)) {
            log("BAILINGG EFFECT: "+name);
            cinnamonwm[effect.wmCompleteName](actor);
            return;
        }

        let key = "desktop-effects-" + (overwriteKey || effect.name);

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

        if (name === "maximize" && !this.settingsState["desktop-effects-maximize"]) {
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
    _minimizeWindow(cinnamonwm, actor) {
        soundManager.play('minimize');

                let types = [WindowType.NORMAL,
                     WindowType.MODAL_DIALOG,
                     WindowType.DIALOG];
        if (!this._shouldAnimateActor(actor, types)) {
            cinnamonwm.completed_minimize(actor);
            return;
        }

        actor.set_scale(1.0, 1.0);

        this._minimizing.add(actor);

        let [success, geom] = actor.meta_window.get_icon_geometry();
        if (success) {
            let xDest, yDest, xScale, yScale;
            xDest = geom.x;
            yDest = geom.y;
            xScale = geom.width / actor.width;
            yScale = geom.height / actor.height;

            addTween(actor, {
                scale_x: xScale,
                scale_y: yScale,
                x: xDest,
                y: yDest,
                time: MINIMIZE_ANIMATION_TIME,
                transition: 'easeInQuad',
                onComplete: () => this._minimizeWindowDone(cinnamonwm, actor),
            });
        } else { // fall-back effect. Same as destroy
            addTween(actor, {
                opacity: 0,
                scale_x: 0.88,
                scale_y: 0.88,
                time: DESTROY_ANIMATION_TIME,
                transition: 'easeOutQuad',
                onComplete: () => this._minimizeWindowDone(cinnamonwm, actor),
            });
        }
    }

    _minimizeWindowDone(cinnamonwm, actor) {
        if (this._minimizing.delete(actor)) {
            removeTweens(actor);
            actor.set_scale(1.0, 1.0);
            actor.set_opacity(255);
            actor.set_pivot_point(0, 0);

            cinnamonwm.completed_minimize(actor);
        }
    }

    _unminimizeWindow(cinnamonwm, actor) {
        soundManager.play('minimize');

        actor.meta_window._cinnamonwm_has_origin = false;
        this._startWindowEffect(cinnamonwm, "minimize", actor);
    }

    _tileWindow(cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
        soundManager.play('tile');

        this._startTraditionalWindowEffect(cinnamonwm, "tile", actor, [targetX, targetY, targetWidth, targetHeight]);
    }

    _maximizeWindow(cinnamonwm, actor, targetX, targetY, targetWidth, targetHeight) {
        soundManager.play('maximize');

        this._startTraditionalWindowEffect(cinnamonwm, "maximize", actor, [targetX, targetY, targetWidth, targetHeight]);
        soundManager.play('maximize');
        log("start unminimize");
        let [success, target] = actor.meta_window.get_icon_geometry()
        this._startWindowEffect(cinnamonwm, "unminimize", actor, [target.x, target.y, target.width, target.height]);
        cinnamonwm.completed_unminimize(actor);
        if (!this._shouldAnimateActor(actor, types)) {
            cinnamonwm.completed_unminimize(actor);
            return;
        }

        this._unminimizing.add(actor);

        let [success, geom] = actor.meta_window.get_icon_geometry();
        if (success) {
            actor.set_position(geom.x, geom.y);
            actor.set_scale(geom.width / actor.width,
                            geom.height / actor.height);

            let rect = actor.meta_window.get_frame_rect();
            let [xDest, yDest] = [rect.x, rect.y];

            actor.show();

            addTween(actor, {
                scale_x: 1.0,
                scale_y: 1.0,
                x: xDest,
                y: yDest,
                time: MINIMIZE_ANIMATION_TIME,
                transition: 'easeOutQuad',
                onComplete: () => this._unminimizeWindowDone(cinnamonwm, actor),
            });
        } else { // fall-back effect. Same as map
            actor.set_pivot_point(0.5, 0.5);
            actor.scale_x = 0.94;
            actor.scale_y = 0.94;
            actor.opacity = 0;
            actor.show();

            addTween(actor, {
                opacity: 255,
                scale_x: 1.0,
                scale_y: 1.0,
                time: MAP_ANIMATION_TIME,
                transition: 'easeOutQuad',
                onComplete: () => this._unminimizeWindowDone(cinnamonwm, actor),
            });
        }
    }

    _unminimizeWindowDone(cinnamonwm, actor) {
        if (this._unminimizing.delete(actor)) {
            removeTweens(actor);
            actor.set_scale(1.0, 1.0);
            actor.set_opacity(255);
            actor.set_pivot_point(0, 0);

            cinnamonwm.completed_unminimize(actor);
        }
    }

    _sizeChangeWindow(cinnamonwm, actor, whichChange, oldFrameRect, _oldBufferRect) {
        let types = [WindowType.NORMAL];
        if (!this._shouldAnimateActor(actor, types)) {
            cinnamonwm.completed_size_change(actor);
            return;
        }

        if (oldFrameRect.width > 0 && oldFrameRect.height > 0)
            this._prepareAnimationInfo(cinnamonwm, actor, oldFrameRect, whichChange);
        else
            cinnamonwm.completed_size_change(actor);
    }

    _prepareAnimationInfo(cinnamonwm, actor, oldFrameRect, _change) {
        // Position a clone of the window on top of the old position,
        // while actor updates are frozen.
        let actorContent = Cinnamon.util_get_content_for_window_actor(actor, oldFrameRect);
        let actorClone = new Widget({ content: actorContent });
        actorClone.set_offscreen_redirect(OffscreenRedirect.ALWAYS);
        actorClone.set_position(oldFrameRect.x, oldFrameRect.y);
        actorClone.set_size(oldFrameRect.width, oldFrameRect.height);

        if (this._clearAnimationInfo(actor))
            this._cinnamonwm.completed_size_change(actor);

        let destroyId = actor.connect('destroy', () => {
            this._clearAnimationInfo(actor);
        });

        this._resizePending.add(actor);
        actor.__animationInfo = { clone: actorClone,
                                  oldRect: oldFrameRect,
                                  destroyId };
    }

    _sizeChangedWindow(cinnamonwm, actor) {
        if (!actor.__animationInfo)
            return;
        if (this._resizing.has(actor))
            return;

        let actorClone = actor.__animationInfo.clone;
        let targetRect = actor.meta_window.get_frame_rect();
        let sourceRect = actor.__animationInfo.oldRect;

        let scaleX = targetRect.width / sourceRect.width;
        let scaleY = targetRect.height / sourceRect.height;

        this._resizePending.delete(actor);
        this._resizing.add(actor);

        Main.uiGroup.add_child(actorClone);

        // Now scale and fade out the clone
        addTween(actorClone, {
                x: targetRect.x,
                y: targetRect.y,
                scale_x: scaleX,
                scale_y: scaleY,
                opacity: 0,
                time: WINDOW_ANIMATION_TIME,
                transition: 'easeOutQuad',
        });

        actor.translation_x = -targetRect.x + sourceRect.x;
        actor.translation_y = -targetRect.y + sourceRect.y;

        // Now set scale the actor to size it as the clone.
        actor.scale_x = 1 / scaleX;
        actor.scale_y = 1 / scaleY;

        // Scale it to its actual new size
        addTween(actor, {
                scale_x: 1,
                scale_y: 1,
                translation_x: 0,
                translation_y: 0,
                time: WINDOW_ANIMATION_TIME,
                transition: 'easeOutQuad',
                onComplete: () => this._sizeChangeWindowDone(cinnamonwm, actor),
        });

        // Now unfreeze actor updates, to get it to the new size.
        // It's important that we don't wait until the animation is completed to
        // do this, otherwise our scale will be applied to the old texture size.
        cinnamonwm.completed_size_change(actor);
    }

    _clearAnimationInfo(actor) {
        if (actor.__animationInfo) {
            actor.__animationInfo.clone.destroy();
            actor.disconnect(actor.__animationInfo.destroyId);
            delete actor.__animationInfo;
            return true;
        }
        return false;
    }

    _sizeChangeWindowDone(cinnamonwm, actor) {
        if (this._resizing.delete(actor)) {
            removeTweens(actor);
            actor.scale_x = 1.0;
            actor.scale_y = 1.0;
            actor.translation_x = 0;
            actor.translation_y = 0;
            this._clearAnimationInfo(actor);
        }

        if (this._resizePending.delete(actor))
            this._cinnamonwm.completed_size_change(actor);
    }

    _filterKeybinding(shellwm, binding) {
        // TODO: We can use ActionModes to manage what keybindings are
        // available where. For now just disable this, things are handled
        // in Main._stageEventHandler.
        return false;
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
        actor._windowType = actor.meta_window.get_window_type();
        actor._notifyWindowTypeSignalId =
            actor.meta_window.connect('notify::window-type', () => {
                let type = actor.meta_window.get_window_type();
                if (type == actor._windowType)
                    return;
                if (type == WindowType.MODAL_DIALOG ||
                    actor._windowType == WindowType.MODAL_DIALOG) {
                    let parent = actor.get_meta_window().get_transient_for();
                    if (parent)
                        this._checkDimming(parent);
                }

                actor._windowType = type;
            });
        actor.meta_window.connect('unmanaged', window => {
            let parent = window.get_transient_for();
            if (parent)
                this._checkDimming(parent);
        });

        if (actor._windowType === WindowType.NORMAL) {
            soundManager.play('map');
        }

        if (actor.meta_window.is_attached_dialog())
            this._checkDimming(actor.get_meta_window().get_transient_for());

        let types = [WindowType.NORMAL,
                     WindowType.DIALOG,
                     WindowType.MODAL_DIALOG];
        if (!this._shouldAnimateActor(actor, types)) {
            cinnamonwm.completed_map(actor);
            return;
        }

        switch (actor._windowType) {
            case WindowType.NORMAL:
            case WindowType.MODAL_DIALOG:
            case WindowType.DIALOG:
                actor.orig_opacity = actor.opacity;
                actor.set_pivot_point(0.5, 0.5);
                actor.scale_x = 0.94;
                actor.scale_y = 0.94;
                actor.opacity = 0;
                actor.show();
                this._mapping.add(actor);

                addTween(actor, {
                    opacity: actor.orig_opacity,
                    scale_x: 1,
                    scale_y: 1,
                    time: MAP_ANIMATION_TIME,
                    transition: 'easeOutQuad',
                    onComplete: () => this._mapWindowDone(cinnamonwm, actor),
                });
                break;
            default:
                cinnamonwm.completed_map(actor);
        }
    }

    _mapWindowDone(cinnamonwm, actor) {
        if (this._mapping.delete(actor)) {
            removeTweens(actor);
            actor.opacity = 255;
            actor.set_pivot_point(0, 0);
            actor.scale_y = 1;
            actor.scale_x = 1;
            actor.translation_y = 0;
            actor.translation_x = 0;
            cinnamonwm.completed_map(actor);
        }
    }

    _destroyWindow(cinnamonwm, actor) {
        let window = actor.meta_window;
        if (actor._notifyWindowTypeSignalId) {
            window.disconnect(actor._notifyWindowTypeSignalId);
            actor._notifyWindowTypeSignalId = 0;
        }
        if (window._dimmed) {
            this._dimmedWindows =
                this._dimmedWindows.filter(win => win != window);
        }

        if (actor.meta_window.window_type === WindowType.NORMAL) {
            soundManager.play('close');
        }

        if (window.is_attached_dialog())
            this._checkDimming(window.get_transient_for(), window);

        if (window.minimized) {
            cinnamonwm.completed_destroy(actor);
            return;
        }

        let types = [WindowType.NORMAL,
                     WindowType.DIALOG,
                     WindowType.MODAL_DIALOG];
        if (!this._shouldAnimateActor(actor, types)) {
            cinnamonwm.completed_destroy(actor);
            return;
        }

        switch (actor.meta_window.window_type) {
            case WindowType.NORMAL:
            case WindowType.MODAL_DIALOG:
            case WindowType.DIALOG:
                actor.set_pivot_point(0.5, 1.0);
                this._destroying.add(actor);

                if (window.is_attached_dialog()) {
                    let parent = window.get_transient_for();
                    actor._parentDestroyId = parent.connect('unmanaged', () => {
                        removeTweens(actor);
                        this._destroyWindowDone(cinnamonwm, actor);
                    });
                }

                addTween(actor, {
                    opacity: 0,
                    scale_x: 0.88,
                    scale_y: 0.88,
                    time: DESTROY_ANIMATION_TIME,
                    transition: 'easeOutQuad',
                    onComplete: () => this._destroyWindowDone(cinnamonwm, actor),
                });
                break;
            default:
                cinnamonwm.completed_destroy(actor);
        }
    }

    _destroyWindowDone(cinnamonwm, actor) {
        if (this._destroying.delete(actor)) {
            let parent = actor.get_meta_window().get_transient_for();
            if (parent && actor._parentDestroyId) {
                parent.disconnect(actor._parentDestroyId);
                actor._parentDestroyId = 0;
            }
            cinnamonwm.completed_destroy(actor);
        }
    }

    _switchWorkspace(cinnamonwm, from, to, direction) {
        soundManager.play('switch');

        if (!this.settingsState['desktop-effects-workspace'] || Main.modalCount || Main.software_rendering) {
            this.showWorkspaceOSD();
            cinnamonwm.completed_switch_workspace();
            return;
        }

        this.showWorkspaceOSD();
        soundManager.play('switch');
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

        let from_windows = [];
        let to_windows = [];

        for (let i = 0; i < windows.length; i++) {
            let window = windows[i];
            let {meta_window} = window;

            if (!meta_window.showing_on_its_workspace())
                continue;

            // Muffin 5.2 window.showing_on_its_workspace() no longer
            // ends up filtering the desktop window (If I re-add it, it
            // breaks things elsewhere that rely on the new behavior).
            if (meta_window.get_window_type() === WindowType.DESKTOP) {
                continue;
            }

            if (meta_window.is_on_all_workspaces()) {
                continue;
            }

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

                from_windows.push(window);
                addTween(window,
                    {
                        x: window.origX + xDest,
                        y: window.origY + yDest,
                        time: WINDOW_ANIMATION_TIME,
                        transition: 'easeOutQuad'
                    });
            } else if (window.get_workspace() === to) {
                if (window.origX == undefined) {
                    window.origX = window.x;
                    window.origY = window.y;
                    window.set_position(window.origX - xDest, window.origY - yDest);
                }

                to_windows.push(window);
                addTween(window,
                    {
                        x: window.origX,
                        y: window.origY,
                        time: WINDOW_ANIMATION_TIME,
                        transition: 'easeOutQuad'
                    });
                window.show_all();
            }
        }

        let killed = false;
        let kill_id = 0;

        let finish_switch_workspace = () =>
        {
            this._cinnamonwm.disconnect(kill_id);

            removeTweens(this);

            from_windows.forEach((w) => {
                removeTweens(w);
                w.hide();
                w.set_position(w.origX, w.origY);
                w.origX = undefined;
                w.origY = undefined;
            });

            to_windows.forEach((w) => {
                removeTweens(w);
                w.origX = undefined;
                w.origY = undefined;
            });

            cinnamonwm.completed_switch_workspace();
        };

        kill_id = this._cinnamonwm.connect('kill-switch-workspace', cinnamonwm => {
            killed = true;
            finish_switch_workspace();
        });

        addTween(this, {time: WINDOW_ANIMATION_TIME, onComplete: function() {
            if (!killed) {
                finish_switch_workspace();
            }
        }});
    }

    _showTilePreview(cinnamonwm, window, tileRect, monitorIndex) {
        if (!this._tilePreview)
            this._tilePreview = new TilePreview();
        this._tilePreview.show(window, tileRect, monitorIndex, snapQueued, this.settingsState['desktop-effects-workspace']);
    }

    _hideTilePreview(cinnamonwm) {
        if (!this._tilePreview)
            return;
        this._tilePreview.hide(this.settingsState['desktop-effects-workspace']);
        this._tilePreview.hide();
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
        for (let i = 0; i < this._workspace_osd_array.length; i++) {
            let osd = this._workspace_osd_array[i];
            if (osd != null) {
                osd.actor.opacity = 255;
                addTween(osd.actor, {
                    opacity: 0,
                    time: WORKSPACE_OSD_TIMEOUT,
                    transition: 'linear',
                    onComplete: () => osd.destroy()
                });
            }
        }
        this._workspace_osd_array = [];
    }

    _showWindowMenu(cinnamonwm, window, menu, rect) {
        this._windowMenuManager.showWindowMenuForWindow(window, menu, rect);
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

    _startAppSwitcher(display, window, binding) {
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

    _moveWindowToWorkspaceLeft(display, window, binding) {
        this._shiftWindowToWorkspace(window, MotionDirection.LEFT);
    }

    _moveWindowToWorkspaceRight(display, window, binding) {
        this._shiftWindowToWorkspace(window, MotionDirection.RIGHT);
    }

    moveToWorkspace(workspace, direction_hint) {
        let active = global.screen.get_active_workspace();
        // if (workspace != active) {
            // if (direction_hint)
                // workspace.activate_with_direction_hint(direction_hint, global.get_current_time());
            // else
                workspace.activate(global.get_current_time());
        // }
    }

    _showWorkspaceSwitcher(display, window, binding) {
        let bindingName = binding.get_name();
        if (bindingName === 'switch-to-workspace-up') {
            expo.toggle();
            return;
        }
        if (bindingName === 'switch-to-workspace-down') {
            overview.toggle();
            return;
        }

        if (global.screen.n_workspaces === 1)
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
