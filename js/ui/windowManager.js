// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;
const Main = imports.ui.main;
const WindowMenu = imports.ui.windowMenu;
const GObject = imports.gi.GObject;
const AppSwitcher = imports.ui.appSwitcher.appSwitcher;
const ModalDialog = imports.ui.modalDialog;
const CloseDialog = imports.ui.closeDialog;

const {CoverflowSwitcher} = imports.ui.appSwitcher.coverflowSwitcher;
const {TimelineSwitcher} = imports.ui.appSwitcher.timelineSwitcher;
const {ClassicSwitcher} = imports.ui.appSwitcher.classicSwitcher;
const {addTween, removeTweens} = imports.ui.tweener;

const MENU_ANIMATION_TIME = 0.1;
const WORKSPACE_ANIMATION_TIME = 0.15;

const TILE_PREVIEW_ANIMATION_TIME = 0.12;
const SIZE_CHANGE_ANIMATION_TIME = 0.12;
const MAP_ANIMATION_TIME = 0.12;
const DESTROY_ANIMATION_TIME = 0.12;
const MINIMIZE_ANIMATION_TIME = 0.12;

// maps org.cinnamon window-effect-speed
const ANIMATION_TIME_MULTIPLIERS = [
    1.4, // 0 SLOW
    1.0, // 1 DEFAULT
    0.6  // 2 FAST
]

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
        this._desaturateEffect = new Clutter.DesaturateEffect();
        this._brightnessEffect = new Clutter.BrightnessContrastEffect();
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
        this.actor = new St.Bin({ style_class: 'tile-preview', important: true });
        global.window_group.add_actor(this.actor);

        this._reset();
        this._showing = false;
    }

    show(window, tileRect, monitorIndex, animate) {
        let windowActor = window.get_compositor_private();
        if (!windowActor)
            return;

        if (this._rect && this._rect.equal(tileRect))
            return;

        let changeMonitor = (this._monitorIndex === -1 ||
                             this._monitorIndex != monitorIndex);

        this._monitorIndex = monitorIndex;
        this._rect = tileRect;
        let monitor = Main.layoutManager.monitors[monitorIndex];
        let {x, y, width, height} = tileRect;

        if (!this._showing || changeMonitor) {
            let monitorRect = new Meta.Rectangle({ x: monitor.x,
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

        if (animate) {
            Object.assign(props, {
                time: TILE_PREVIEW_ANIMATION_TIME,
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
                time: TILE_PREVIEW_ANIMATION_TIME,
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

var ResizePopup = GObject.registerClass(
class ResizePopup extends St.Widget {
    _init() {
        super._init({ layout_manager: new Clutter.BinLayout() });
        this._label = new St.Label({ style_class: 'info-osd',
                                     x_align: Clutter.ActorAlign.CENTER,
                                     y_align: Clutter.ActorAlign.CENTER,
                                     x_expand: true, y_expand: true });
        this.add_child(this._label);
        Main.uiGroup.add_actor(this);
    }

    set(rect, displayW, displayH) {
        /* Translators: This represents the size of a window. The first number is
         * the width of the window and the second is the height. */
        let text = _("%d × %d").format(displayW, displayH);
        this._label.set_text(text);

        this.set_position(rect.x, rect.y);
        this.set_size(rect.width, rect.height);
    }
});

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

        this.wm_settings = new Gio.Settings({schema_id: 'org.cinnamon.muffin'});

        global.settings.connect('changed::desktop-effects', this.onSettingsChanged.bind(this));
        global.settings.connect('changed::desktop-effects-workspace', this.onSettingsChanged.bind(this));
        global.settings.connect('changed::desktop-effects-on-menus', this.onSettingsChanged.bind(this));
        global.settings.connect('changed::desktop-effects-on-dialogs', this.onSettingsChanged.bind(this));

        global.settings.connect('changed::desktop-effects-change-size', this.onSettingsChanged.bind(this));
        global.settings.connect('changed::desktop-effects-close', this.onSettingsChanged.bind(this));
        global.settings.connect('changed::desktop-effects-map', this.onSettingsChanged.bind(this));
        global.settings.connect('changed::desktop-effects-minimize', this.onSettingsChanged.bind(this));
        global.settings.connect('changed::window-effect-speed', this.onSettingsChanged.bind(this));

        this.onSettingsChanged();

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

        Meta.keybindings_set_custom_handler('move-to-workspace-left', (d, w, b) => this._moveWindowToWorkspaceLeft(d, w, b));
        Meta.keybindings_set_custom_handler('move-to-workspace-right', (d, w, b) => this._moveWindowToWorkspaceRight(d, w, b));

        Meta.keybindings_set_custom_handler('switch-to-workspace-left', (d, w, b) => this._showWorkspaceSwitcher(d, w, b));
        Meta.keybindings_set_custom_handler('switch-to-workspace-right', (d, w, b) => this._showWorkspaceSwitcher(d, w, b));
        Meta.keybindings_set_custom_handler('switch-to-workspace-up', (d, w, b) => this._showWorkspaceSwitcher(d, w, b));
        Meta.keybindings_set_custom_handler('switch-to-workspace-down', (d, w, b) => this._showWorkspaceSwitcher(d, w, b));
        Meta.keybindings_set_custom_handler('switch-windows', (d, w, b) => this._startAppSwitcher(d, w, b));
        Meta.keybindings_set_custom_handler('switch-group', (d, w, b) => this._startAppSwitcher(d, w, b));
        Meta.keybindings_set_custom_handler('switch-windows-backward', (d, w, b) => this._startAppSwitcher(d, w, b));
        Meta.keybindings_set_custom_handler('switch-group-backward', (d, w, b) => this._startAppSwitcher(d, w, b));
        Meta.keybindings_set_custom_handler('switch-panels', (d, w, b) => this._startAppSwitcher(d, w, b));
        Meta.keybindings_set_custom_handler('switch-panels-backward', (d, w, b) => this._startAppSwitcher(d, w, b));

        global.display.connect('show-resize-popup', this._showResizePopup.bind(this));
        this._cinnamonwm.connect('create-close-dialog', this._createCloseDialog.bind(this));

        /* TODO: Wacom
        global.display.connect('show-pad-osd', this._showPadOsd.bind(this));
        global.display.connect('show-osd', (display, monitorIndex, iconName, label) => {
            let icon = Gio.Icon.new_for_string(iconName);
            Main.osdWindowManager.show(monitorIndex, icon, label, null);
        });
        */

        Main.overview.connect('showing', () => {
            let {_dimmedWindows} = this;
            for (let i = 0, len = _dimmedWindows.length; i < len; i++) {
                this._undimWindow(_dimmedWindows[i], true);
            }
        });
        Main.overview.connect('hiding', () => {
            let {_dimmedWindows} = this;
            for (let i = 0, len = _dimmedWindows.length; i < len; i++) {
                this._dimWindow(_dimmedWindows[i], true);
            }
        });

        this._windowMenuManager = new WindowMenu.WindowMenuManager();
    }

    _filterKeybinding(shellwm, binding) {
        // TODO: We can use ActionModes to manage what keybindings are
        // available where. For now just disable this, things are handled
        // in Main._stageEventHandler.
        return false;
    }

    onSettingsChanged(settings, key, type) {
        this.desktop_effects_windows = global.settings.get_boolean("desktop-effects");
        this.desktop_effects_ui = global.settings.get_boolean("desktop-effects-workspace");
        this.desktop_effects_menus = global.settings.get_boolean("desktop-effects-on-menus");
        this.desktop_effects_dialogs = global.settings.get_boolean("desktop-effects-on-dialogs");
        this.desktop_effects_size_change = global.settings.get_boolean("desktop-effects-change-size");

        this.desktop_effects_close_type = global.settings.get_string("desktop-effects-close");
        this.desktop_effects_map_type = global.settings.get_string("desktop-effects-map");
        this.desktop_effects_minimize_type = global.settings.get_string("desktop-effects-minimize");

        this.window_effect_multiplier = ANIMATION_TIME_MULTIPLIERS[global.settings.get_int("window-effect-speed")];
    }

    _shouldAnimate(actor, types=null) {
        // Check if system is in modal state or in software rendering
        if (Main.modalCount || Main.software_rendering) {
            return false;
        }

        let type = actor.meta_window.get_window_type();
        
        if (types !== null) {
            return types.includes(type);
        }

        switch (type) {
            case Meta.WindowType.NORMAL:
                return true;
            case Meta.WindowType.DIALOG:
            case Meta.WindowType.MODAL_DIALOG:
                return this.desktop_effects_dialogs;
            case Meta.WindowType.MENU:
            case Meta.WindowType.DROPDOWN_MENU:
            case Meta.WindowType.POPUP_MENU:
                return this.desktop_effects_menus;
            default:
                return false;
        }
    }

    _minimizeWindow(cinnamonwm, actor) {
        Main.soundManager.play('minimize');

        if (!this.desktop_effects_windows || !this._shouldAnimate(actor)) {
            cinnamonwm.completed_minimize(actor);
            return;
        }

        switch (this.desktop_effects_minimize_type) {
            case "traditional":
            {
                let [success, geom] = actor.meta_window.get_icon_geometry();

                if (success) {
                    this._minimizing.add(actor);
                    actor.set_scale(1.0, 1.0);

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
                        time: MINIMIZE_ANIMATION_TIME * this.window_effect_multiplier,
                        transition: 'easeInQuad',
                        onComplete: () => this._minimizeWindowDone(cinnamonwm, actor),
                    });

                    return;
                }
            }
            case "fade":
            { // this fallback for 'traditional' also
                this._minimizing.add(actor);
                actor.set_scale(1.0, 1.0);
                actor.set_pivot_point(0.5, 0.5);

                addTween(actor, {
                    opacity: 0,
                    scale_x: 0.88,
                    scale_y: 0.88,
                    time: MINIMIZE_ANIMATION_TIME * this.window_effect_multiplier,
                    transition: 'easeOutQuad',
                    onComplete: () => this._minimizeWindowDone(cinnamonwm, actor),
                });

                return;
            }
            case "fly":
            {
                this._minimizing.add(actor);

                let xDest = actor.x;
                let yDest = global.stage.get_height();

                // The transition time set is the time if the animation starts/ends at the middle of the screen.
                // Scale it proportional to the actual distance so that the speed of all animations will be constant.
                let dist = Math.abs(actor.y - yDest);
                let time = MINIMIZE_ANIMATION_TIME * (dist / yDest * 2);

                addTween(actor, {
                    x: xDest,
                    y: yDest,
                    time: time * this.window_effect_multiplier,
                    transition: "easeInSine",
                    onComplete: () => this._minimizeWindowDone(cinnamonwm, actor),
                });

                return;
            }
            default:
            {
                cinnamonwm.completed_minimize(actor);
            }
        }
    }

    _minimizeWindowDone(cinnamonwm, actor) {
        if (this._minimizing.delete(actor)) {
            removeTweens(actor);
            actor.set_pivot_point(0, 0);
            actor.set_scale(1.0, 1.0);
            actor.set_opacity(255);

            cinnamonwm.completed_minimize(actor);
        }
    }

    _unminimizeWindow(cinnamonwm, actor) {
        Main.soundManager.play('minimize');

        if (!this.desktop_effects_windows || !this._shouldAnimate(actor)) {
            cinnamonwm.completed_unminimize(actor);
            return;
        }
        switch (this.desktop_effects_map_type) {
            case "fade":
            {
                this._unminimizing.add(actor);

                actor.orig_opacity = actor.opacity;
                actor.set_pivot_point(0.5, 0.5);
                actor.scale_x = 0.94;
                actor.scale_y = 0.94;
                actor.opacity = 0;
                actor.show();

                addTween(actor, {
                    opacity: actor.orig_opacity,
                    scale_x: 1,
                    scale_y: 1,
                    time: MAP_ANIMATION_TIME * this.window_effect_multiplier,
                    transition: 'easeOutQuad',
                    onComplete: () => this._unminimizeWindowDone(cinnamonwm, actor),
                });

                return;
            }
            case "fly":
            {
                this._unminimizing.add(actor);

                let [xDest, yDest] = actor.get_position();
                let ySrc = global.stage.get_height();
                actor.set_position(xDest, ySrc);
                // The transition time set is the time if the animation starts/ends at the middle of the screen.
                // Scale it proportional to the actual distance so that the speed of all animations will be constant.
                let dist = Math.abs(ySrc - yDest);
                let time = MAP_ANIMATION_TIME * (dist / ySrc * 2);
                actor.show();

                addTween(actor, {
                    x: xDest,
                    y: yDest,
                    time: time * this.window_effect_multiplier,
                    transition: "easeInSine",
                    onComplete: () => this._unminimizeWindowDone(cinnamonwm, actor),
                });

                return;
            }
            case "traditional":
            {
                this._unminimizing.add(actor);

                let [success, geom] = actor.meta_window.get_icon_geometry();
                if (success) {
                    let [xDest, yDest] = [actor.x, actor.y];

                    actor.set_position(geom.x, geom.y);
                    actor.set_scale(geom.width / actor.width,
                                    geom.height / actor.height);

                    actor.show();

                    addTween(actor, {
                        scale_x: 1.0,
                        scale_y: 1.0,
                        x: xDest,
                        y: yDest,
                        time: MAP_ANIMATION_TIME * this.window_effect_multiplier,
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
                        time: MAP_ANIMATION_TIME * this.window_effect_multiplier,
                        transition: 'easeOutQuad',
                        onComplete: () => this._unminimizeWindowDone(cinnamonwm, actor),
                    });
                }

                return;
            }
            default:
            {
                cinnamonwm.completed_minimize(actor);
            }
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
        if (!this.desktop_effects_windows || !this._shouldAnimate(actor, [Meta.WindowType.NORMAL]) || !this.desktop_effects_size_change) {
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
        let actorClone = new St.Widget({ content: actorContent });
        actorClone.set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);
        actorClone.set_position(oldFrameRect.x, oldFrameRect.y);
        actorClone.set_size(oldFrameRect.width, oldFrameRect.height);

        if (this._clearSizeAnimationInfo(actor))
            this._cinnamonwm.completed_size_change(actor);

        let destroyId = actor.connect('destroy', () => {
            this._clearSizeAnimationInfo(actor);
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
                time: SIZE_CHANGE_ANIMATION_TIME * this.window_effect_multiplier,
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
                time: SIZE_CHANGE_ANIMATION_TIME * this.window_effect_multiplier,
                transition: 'easeOutQuad',
                onComplete: () => this._sizeChangeWindowDone(cinnamonwm, actor),
        });

        // Now unfreeze actor updates, to get it to the new size.
        // It's important that we don't wait until the animation is completed to
        // do this, otherwise our scale will be applied to the old texture size.
        cinnamonwm.completed_size_change(actor);
    }

    _clearSizeAnimationInfo(actor) {
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
            this._clearSizeAnimationInfo(actor);
        }

        if (this._resizePending.delete(actor))
            this._cinnamonwm.completed_size_change(actor);
    }

    _filterKeybinding(shellwm, binding) {
        // TODO: We can use ActionModes to manage what keybindings are
        // available where. For now, this allows global keybindings in a non-
        // modal state. 

        return global.stage_input_mode !== Cinnamon.StageInputMode.NORMAL;
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
            if (!Main.overview.visible)
                this._dimWindow(window, true);
        } else if (!shouldDim && window._dimmed) {
            window._dimmed = false;
            this._dimmedWindows = Util.filter(this._dimmedWindows, function(win) {
                return win !== window;
            });
            if (!Main.overview.visible)
                this._undimWindow(window, true);
        }
    }

    _dimWindow(window, animate) {
        let actor = window.get_compositor_private();
        if (!actor)
            return;

        let dimmer = getWindowDimmer(actor);
        let enabled = Meta.prefs_get_attach_modal_dialogs();
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
        let enabled = Meta.prefs_get_attach_modal_dialogs();
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
                if (type === actor._windowType)
                    return;
                if (type === Meta.WindowType.MODAL_DIALOG ||
                    actor._windowType === Meta.WindowType.MODAL_DIALOG) {
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

        if (actor._windowType === Meta.WindowType.NORMAL) {
            Main.soundManager.play('map');
        }

        if (actor.meta_window.is_attached_dialog()) {
            this._checkDimming(actor.get_meta_window().get_transient_for());
        }

        if (!this.desktop_effects_windows || !this._shouldAnimate(actor)) {
            cinnamonwm.completed_map(actor);
            return;
        }

        // menu effects are always fade-in/out
        let overridden_types = [Meta.WindowType.MENU,
                                Meta.WindowType.DROPDOWN_MENU,
                                Meta.WindowType.POPUP_MENU    ];

        let adjusted_type = overridden_types.includes(actor._windowType) ? "fade" : this.desktop_effects_map_type;

        switch (adjusted_type) {
            case "traditional":
            {
                this._mapping.add(actor);

                let [width, height] = actor.get_size();
                let [xDest, yDest] = actor.get_position();
                let [xSrc, ySrc] = global.get_pointer();

                actor.set_position(xSrc, ySrc);
                actor.set_scale(0, 0);
                actor.show();

                addTween(actor, {
                    scale_x: 1.0,
                    scale_y: 1.0,
                    x: xDest,
                    y: yDest,
                    time: 1.0,
                    time: MAP_ANIMATION_TIME * this.window_effect_multiplier,
                    transition: 'easeOutQuad',
                    onComplete: () => this._mapWindowDone(cinnamonwm, actor),
                });

                return;
            }
            case "fly":
            {
                this._mapping.add(actor);

                let ySrc = global.stage.get_height();
                let yDest = actor.y;

                actor.set_position(actor.x, ySrc);

                // The transition time set is the time if the animation starts/ends at the middle of the screen.
                // Scale it proportional to the actual distance so that the speed of all animations will be constant.
                let dist = Math.abs(ySrc - yDest);
                let time = MAP_ANIMATION_TIME * (dist / ySrc * 2);

                actor.show();

                addTween(actor, {
                    y: yDest,
                    time: time * this.window_effect_multiplier,
                    transition: "easeInSine",
                    onComplete: () => this._mapWindowDone(cinnamonwm, actor),
                });

                return;
            }
            case "fade":
            {
                this._mapping.add(actor);

                actor.orig_opacity = actor.opacity;
                actor.set_pivot_point(0.5, 0.5);
                actor.scale_x = 0.94;
                actor.scale_y = 0.94;
                actor.opacity = 0;
                actor.show();

                let time = MAP_ANIMATION_TIME * this.window_effect_multiplier;

                // Popups shouldn't be affected by the multiplier.
                if (overridden_types.includes(actor._windowType)) {
                    time = MENU_ANIMATION_TIME;
                }

                addTween(actor, {
                    opacity: actor.orig_opacity,
                    scale_x: 1,
                    scale_y: 1,
                    time: time,
                    transition: 'easeOutQuad',
                    onComplete: () => this._mapWindowDone(cinnamonwm, actor),
                });

                return;
            }
            default:
            {
                cinnamonwm.completed_map(actor);
            }
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
        if (actor._notifyWindowTypeSignalId > 0) {
            window.disconnect(actor._notifyWindowTypeSignalId);
            actor._notifyWindowTypeSignalId = 0;
        }
        if (window._dimmed) {
            this._dimmedWindows =
                this._dimmedWindows.filter(win => win != window);
        }

        if (actor.meta_window.window_type === Meta.WindowType.NORMAL) {
            Main.soundManager.play('close');
        }

        if (window.is_attached_dialog())
            this._checkDimming(window.get_transient_for(), window);

        if (window.minimized) {
            cinnamonwm.completed_destroy(actor);
            return;
        }

        let types = [Meta.WindowType.NORMAL,
                     Meta.WindowType.DIALOG,
                     Meta.WindowType.MODAL_DIALOG];

        if (!this.desktop_effects_windows || !this._shouldAnimate(actor, types)) {
            cinnamonwm.completed_destroy(actor);
            return;
        }

        // menu effects are always traditional
        let overridden_types = [Meta.WindowType.MENU,
                                Meta.WindowType.DROPDOWN_MENU,
                                Meta.WindowType.POPUP_MENU    ];

        let adjusted_type = overridden_types.includes(actor._windowType) ? "traditional" : this.desktop_effects_close_type;

        switch (adjusted_type) {
            case "fly":
            {
                this._destroying.add(actor);

                let [xSrc, ySrc] = actor.get_position();
                let yDest = global.stage.get_height();

                // The transition time set is the time if the animation starts/ends at the middle of the screen.
                // Scale it proportional to the actual distance so that the speed of all animations will be constant.
                let dist = Math.abs(ySrc - yDest);
                let time = DESTROY_ANIMATION_TIME * (dist / yDest * 2);

                addTween(actor, {
                    y: yDest,
                    time: time * this.window_effect_multiplier,
                    transition: "easeInSine",
                    onComplete: () => this._destroyWindowDone(cinnamonwm, actor),
                });

                return;
            }
            case "traditional":
            {
                switch (actor.meta_window.window_type) {
                    case Meta.WindowType.NORMAL:
                    case Meta.WindowType.MODAL_DIALOG:
                    case Meta.WindowType.DIALOG:
                    {
                        this._destroying.add(actor);

                        actor.set_pivot_point(0.5, 0.5);

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
                            time: DESTROY_ANIMATION_TIME * this.window_effect_multiplier,
                            transition: 'easeOutQuad',
                            onComplete: () => this._destroyWindowDone(cinnamonwm, actor),
                        });

                        return;
                    }
                    case Meta.WindowType.MENU:
                    case Meta.WindowType.DROPDOWN_MENU:
                    case Meta.WindowType.POPUP_MENU:
                    // ??
                    default:
                    {
                        cinnamonwm.completed_destroy(actor);
                    }
                }
            }
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
        if (!this.desktop_effects_ui || Main.modalCount || Main.software_rendering) {
            this.showWorkspaceOSD();
            cinnamonwm.completed_switch_workspace();
            return;
        }

        Main.soundManager.play('switch');
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


        if (direction === Meta.MotionDirection.UP ||
            direction === Meta.MotionDirection.UP_LEFT ||
            direction === Meta.MotionDirection.UP_RIGHT)
            yDest = screen_height;
        else if (direction === Meta.MotionDirection.DOWN ||
            direction === Meta.MotionDirection.DOWN_LEFT ||
            direction === Meta.MotionDirection.DOWN_RIGHT)
            yDest = -screen_height;

        if (direction === Meta.MotionDirection.LEFT ||
            direction === Meta.MotionDirection.UP_LEFT ||
            direction === Meta.MotionDirection.DOWN_LEFT)
            xDest = screen_width;
        else if (direction === Meta.MotionDirection.RIGHT ||
                 direction === Meta.MotionDirection.UP_RIGHT ||
                 direction === Meta.MotionDirection.DOWN_RIGHT)
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
            if (meta_window.get_window_type() === Meta.WindowType.DESKTOP) {
                continue;
            }

            if (meta_window.is_on_all_workspaces()) {
                continue;
            }

            if ((meta_window === this._movingWindow) ||
                ((grabOp === Meta.GrabOp.MOVING ||
                  grabOp === Meta.GrabOp.KEYBOARD_MOVING)
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
                        time: WORKSPACE_ANIMATION_TIME,
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
                        time: WORKSPACE_ANIMATION_TIME,
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

        addTween(this, {time: WORKSPACE_ANIMATION_TIME, onComplete: function() {
            if (!killed) {
                finish_switch_workspace();
            }
        }});
    }

    _showTilePreview(cinnamonwm, window, tileRect, monitorIndex) {
        if (!this._tilePreview)
            this._tilePreview = new TilePreview();
        this._tilePreview.show(window, tileRect, monitorIndex, this.desktop_effects_ui);
    }

    _hideTilePreview(cinnamonwm) {
        if (!this._tilePreview)
            return;
        this._tilePreview.hide();
        this._tilePreview.destroy();
        this._tilePreview = null;
    }

    showWorkspaceOSD() {
        this._hideWorkspaceOSD();
        if (global.settings.get_boolean('workspace-osd-visible')) {
            let current_workspace_index = global.screen.get_active_workspace_index();
            if (this.wm_settings.get_boolean('workspaces-only-on-primary')) {
                this._showWorkspaceOSDOnMonitor(Main.layoutManager.primaryMonitor, current_workspace_index);
            }
            else {
                let {monitors} = Main.layoutManager;
                for (let i = 0; i < monitors.length; i++) {
                    this._showWorkspaceOSDOnMonitor(monitors[i], current_workspace_index);
                }
            }
        }
    }

    _showWorkspaceOSDOnMonitor(monitor, current_workspace_index) {
        let osd = new ModalDialog.InfoOSD();
        osd.actor.add_style_class_name('workspace-osd');
        this._workspace_osd_array.push(osd);
        osd.addText(Main.getWorkspaceName(current_workspace_index));
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
        if (AppSwitcher.getWindowsForBinding(binding).length === 0) return;

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
        if (window.window_type === Meta.WindowType.DESKTOP) {
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
        this._shiftWindowToWorkspace(window, Meta.MotionDirection.LEFT);
    }

    _moveWindowToWorkspaceRight(display, window, binding) {
        this._shiftWindowToWorkspace(window, Meta.MotionDirection.RIGHT);
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
            Main.expo.toggle();
            return;
        }
        if (bindingName === 'switch-to-workspace-down') {
            Main.overview.toggle();
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
        let neighbor = active.get_neighbor(Meta.MotionDirection.LEFT)
        if (active != neighbor) {
            this.moveToWorkspace(neighbor, Meta.MotionDirection.LEFT);
        }
    }

    actionMoveWorkspaceRight() {
        let active = global.screen.get_active_workspace();
        let neighbor = active.get_neighbor(Meta.MotionDirection.RIGHT)
        if (active != neighbor) {
            this.moveToWorkspace(neighbor, Meta.MotionDirection.RIGHT);
        }
    }

    actionMoveWorkspaceUp() {
        global.screen.get_active_workspace().get_neighbor(Meta.MotionDirection.UP).activate(global.get_current_time());
    }

    actionMoveWorkspaceDown() {
        global.screen.get_active_workspace().get_neighbor(Meta.MotionDirection.DOWN).activate(global.get_current_time());
    }

    actionFlipWorkspaceLeft() {
        let active = global.screen.get_active_workspace();
        let neighbor = active.get_neighbor(Meta.MotionDirection.LEFT);
        if (active != neighbor) {
            neighbor.activate(global.get_current_time());
            let [x, y, mods] = global.get_pointer();
            global.set_pointer(global.screen_width - 10, y);
        }
    }

    actionFlipWorkspaceRight() {
        let active = global.screen.get_active_workspace();
        let neighbor = active.get_neighbor(Meta.MotionDirection.RIGHT);
        if (active != neighbor) {
            neighbor.activate(global.get_current_time());
            let [x, y, mods] = global.get_pointer();
            global.set_pointer(10, y);
        }
    }

    _showResizePopup(display, show, rect, displayW, displayH) {
        if (show) {
            if (!this._resizePopup)
                this._resizePopup = new ResizePopup();

            this._resizePopup.set(rect, displayW, displayH);
        } else {
            if (!this._resizePopup)
                return;

            this._resizePopup.destroy();
            this._resizePopup = null;
        }
    }

    _createCloseDialog(shellwm, window) {
        return new CloseDialog.CloseDialog(window);
    }
};
