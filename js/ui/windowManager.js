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
        this._cinnamonwm.connect('minimize', this._minimizeWindow.bind(this));
        this._cinnamonwm.connect('size-change', this._sizeChangeWindow.bind(this));
        this._cinnamonwm.connect('size-changed', this._sizeChangedWindow.bind(this));
        this._cinnamonwm.connect('map', this._mapWindow.bind(this));
        this._cinnamonwm.connect('destroy', this._destroyWindow.bind(this));
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

        global.screen.connect ('show-workspace-osd', () => this.showWorkspaceOSD());

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

    _shouldAnimate(actor) {
        // Check if system is in modal state or in software rendering
        if (Main.modalCount || Main.software_rendering) {
            return false;
        }

        switch (actor.meta_window.window_type) {
            case WindowType.NORMAL:
            case WindowType.DIALOG:
            case WindowType.MODAL_DIALOG:
                return true;
            case WindowType.MENU:
            case WindowType.DROPDOWN_MENU:
            case WindowType.POPUP_MENU:
                return false;
            default:
                return false;
        }
    }

    _minimizeWindow(cinnamonwm, actor) {
        soundManager.play('minimize');

        cinnamonwm.completed_minimize(actor);
    }

    _minimizeWindowDone(cinnamonwm, actor) {
        cinnamonwm.completed_minimize(actor);
    }

    _unminimizeWindow(cinnamonwm, actor) {
        soundManager.play('maximize');

        cinnamonwm.completed_unminimize(actor);
    }

    _unminimizeWindowDone(shellwm, actor) {
        cinnamonwm.completed_unminimize(actor);
    }

    _sizeChangeWindow(cinnamonwm, actor, whichChange, oldFrameRect, _oldBufferRect) {
        cinnamonwm.completed_size_change(actor);
    }

    _sizeChangedWindow(cinnamonwm, actor) {
        return;
    }

    _sizeChangeWindowDone(cinnamonwm, actor) {
        this._cinnamonwm.completed_size_change(actor);
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
        log("map");
        let {meta_window} = actor;
        if (meta_window.is_attached_dialog()) {
            this._checkDimming(meta_window.get_transient_for());
        }

        cinnamonwm.completed_map(actor);
    }

    _mapWindowDone(cinnamonwm, actor) {
        cinnamonwm.completed_map(actor);
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

        cinnamonwm.completed_destroy(actor);
    }

    _destroyWindowDone(cinnamonwm, actor) {
        cinnamonwm.completed_destroy(actor);
    }

    _switchWorkspace(cinnamonwm, from, to, direction) {
        if (Main.modalCount || Main.software_rendering) {
            this.showWorkspaceOSD();
            cinnamonwm.completed_switch_workspace();
            return;
        }

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
            } else if (meta_window.get_workspace() === from) {
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
            } else if (meta_window.get_workspace() === to) {
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

    _showTilePreview(cinnamonwm, window, tileRect, monitorIndex) {
        if (!this._tilePreview)
            this._tilePreview = new TilePreview();
        this._tilePreview.show(window, tileRect, monitorIndex);
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
