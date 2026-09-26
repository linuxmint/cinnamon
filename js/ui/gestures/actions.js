// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { GLib, Gio, Cinnamon, Meta, Cvc } = imports.gi;
const Main = imports.ui.main;
const { GestureType, GestureDirection } = imports.ui.gestures.gestureTypes;
const { SwipeProgress } = imports.ui.gestures.tracking;
const { getMprisPlayerManager } = imports.misc.mprisPlayer;
const Magnifier = imports.ui.magnifier;

const touchpad_settings = new  Gio.Settings({ schema_id: "org.cinnamon.desktop.peripherals.touchpad" });

const CONTINUOUS_ACTION_POLL_INTERVAL = 50; // milliseconds

// The phase of an action that follows the fingers. Every other action runs
// once, at the start or the end of the gesture.
var FOLLOW_PHASE = "follow";
var DEFAULT_PHASE = "end";

var can_follow = (action) => {
    switch (action) {
    case "WORKSPACE_NEXT":
    case "WORKSPACE_PREVIOUS":
    case "WORKSPACE_UP":
    case "WORKSPACE_DOWN":
    case "TOGGLE_EXPO":
    case "TOGGLE_OVERVIEW":
    case "SWITCH_WINDOWS":
    case "PUSH_TILE_UP":
    case "PUSH_TILE_DOWN":
    case "PUSH_TILE_LEFT":
    case "PUSH_TILE_RIGHT":
    case "MAXIMIZE":
    case "MINIMIZE":
        return true;
    default:
        return false;
    }
}

var make_action = (settings, definition, device) => {
    var threshold = 100;

    if (definition.type === GestureType.SWIPE) {
        threshold = settings.get_uint("swipe-percent-threshold");
    }
    else
    if (definition.type === GestureType.PINCH) {
        threshold = settings.get_uint("pinch-percent-threshold");
    }

    if (definition.phase === FOLLOW_PHASE && can_follow(definition.action)) {
        switch (definition.action) {
        case "WORKSPACE_NEXT":
        case "WORKSPACE_PREVIOUS":
        case "WORKSPACE_UP":
        case "WORKSPACE_DOWN":
            return new TrackedWorkspaceSwitchAction(definition, device, threshold);
        case "TOGGLE_EXPO":
        case "TOGGLE_OVERVIEW":
            return new TrackedViewAction(definition, device, threshold);
        case "SWITCH_WINDOWS":
            return new TrackedWindowSwitchAction(definition, device, threshold);
        case "PUSH_TILE_UP":
        case "PUSH_TILE_DOWN":
        case "PUSH_TILE_LEFT":
        case "PUSH_TILE_RIGHT":
            return new TrackedTileAction(definition, device, threshold);
        case "MAXIMIZE":
            return new TrackedMaximizeAction(definition, device, threshold);
        case "MINIMIZE":
            return new TrackedMinimizeAction(definition, device, threshold);
        }
    }

    // Nothing reaches this phase if the action cannot follow, so the action
    // would never run. Give it the default phase instead.
    if (definition.phase === FOLLOW_PHASE) {
        definition.phase = DEFAULT_PHASE;
    }

    switch (definition.action) {
    case "WORKSPACE_NEXT":
    case "WORKSPACE_PREVIOUS":
    case "WORKSPACE_UP":
    case "WORKSPACE_DOWN":
        return new WorkspaceSwitchAction(definition, device, threshold);
    case "TOGGLE_EXPO":
    case "TOGGLE_OVERVIEW":
    case "TOGGLE_DESKTOP":
        return new GlobalDesktopAction(definition, device, threshold);
    case "MINIMIZE":
    case "MAXIMIZE":
    case "CLOSE":
    case "WINDOW_WORKSPACE_NEXT":
    case "WINDOW_WORKSPACE_PREVIOUS":
    case "FULLSCREEN":
    case "UNFULLSCREEN":
    case "PUSH_TILE_UP":
    case "PUSH_TILE_DOWN":
    case "PUSH_TILE_LEFT":
    case "PUSH_TILE_RIGHT":
        return new WindowOpAction(definition, device, threshold);
    case "VOLUME_UP":
    case "VOLUME_DOWN":
    case "TOGGLE_MUTE":
        return new VolumeAction(definition, device, threshold);
    case "MEDIA_PLAY_PAUSE":
    case "MEDIA_NEXT":
    case "MEDIA_PREVIOUS":
        return new MediaAction(definition, device, threshold);
    case "ZOOM_IN":
    case "ZOOM_OUT":
        return new ZoomAction(definition, device, threshold);
    case "SWITCH_WINDOWS":
        return new WindowSwitchAction(definition, device, threshold);
    case "EXEC":
        return new ExecAction(definition, device, threshold);
    }
}

var cleanup = () => {
    if (mixer != null) {
        mixer.close();
        mixer = null;
    }

    mpris_manager = null;
}

var BaseAction = class {
    constructor(definition, device, threshold) {
        this.definition = definition;
        this.device = device;
        this.threshold = threshold;
    }

    begin(direction, percentage, time) {
        if (this.definition.phase === "start") {
            this.do_action(direction, percentage, time);
        };
    }

    update(direction, percentage, time) {
    }

    end(direction, percentage, time) {
        if (this.definition.phase !== "end" || percentage < this.threshold) {
            return;
        }

        this.do_action(direction, percentage, time);
    }
}

/**
 * TrackedAction:
 *
 * An action that follows the fingers, driven by percentage of a full swipe.
 * A subclass supplies _begin() (snap points and start position, or null to
 * refuse), _progress(pct), _update(progress), and _finish(target, ms).
 */
var TrackedAction = class extends BaseAction {
    constructor(definition, device, threshold) {
        super(definition, device, threshold);
        this._swipe = null;
    }

    begin(direction, percentage, time) {
        const setup = this._begin(direction);
        if (setup == null) {
            return;
        }

        this._swipe = new SwipeProgress(setup.snapPoints,
                                        setup.progress,
                                        setup.cancelProgress !== undefined
                                            ? setup.cancelProgress
                                            : setup.progress,
                                        setup.longSwipes === true);

        this._update(this._swipe.update(this._progress(percentage), time));
    }

    update(direction, percentage, time) {
        if (this._swipe == null) {
            return;
        }

        this._update(this._swipe.update(this._progress(percentage), time));
    }

    end(direction, percentage, time) {
        if (this._swipe == null) {
            return;
        }

        this._swipe.update(this._progress(percentage), time);

        const [target, duration] = this._swipe.end(time);
        this._swipe = null;

        this._finish(target, duration);
    }
}

/**
 * TrackedWorkspaceSwitchAction: moves the workspaces with the fingers. A
 * snap point is a workspace.
 */
var TrackedWorkspaceSwitchAction = class extends TrackedAction {
    _begin(direction) {
        // The direction along the workspaces. The direction of the fingers
        // is whichever gesture this action is set on.
        switch (this.definition.action) {
        case "WORKSPACE_NEXT":
        case "WORKSPACE_DOWN":
            this._direction = 1;
            break;
        default:
            this._direction = -1;
        }

        // Expo shows every workspace already. The swipe moves the
        // highlight, which needs only a direction.
        if (Main.expo.visible) {
            this._inExpo = true;
            this._base = 0;
            return { snapPoints: [-1, 0, 1], progress: 0 };
        }

        this._inExpo = false;

        // The window selector scrolls between the workspaces. The swipe
        // drives that scroll.
        if (Main.overview.visible) {
            this._scroller = Main.overview.workspacesView;
            const setup = this._scroller ? this._scroller.workspaceScrollBegin() : null;
            if (setup == null) {
                return null;
            }

            this._base = setup.progress;
            return setup;
        }

        this._scroller = null;

        const animation = Main.wm.workspaceAnimation;
        if (animation == null) {
            return null;
        }

        const setup = animation.switchBegin(global.display.get_current_monitor());
        if (setup == null) {
            return null;
        }

        this._base = setup.progress;

        return setup;
    }

    _progress(percentage) {
        return this._base + this._direction * percentage / 100;
    }

    _update(progress) {
        if (this._inExpo) {
            return;
        }

        if (this._scroller) {
            this._scroller.workspaceScrollUpdate(progress);
            return;
        }

        Main.wm.workspaceAnimation.switchUpdate(progress);
    }

    _finish(target, duration) {
        if (this._inExpo) {
            if (target !== 0) {
                Main.expo.moveSelection(target > 0 ? 1 : -1);
            }
            return;
        }

        if (this._scroller) {
            const scroller = this._scroller;
            this._scroller = null;
            scroller.workspaceScrollEnd(target, duration);
            return;
        }

        Main.wm.workspaceAnimation.switchEnd(duration, target);
    }
}

/**
 * TrackedViewAction: opens or closes Expo or the window selector. Snap
 * points are closed (0) and open (1).
 */
// The view an action opens and closes, or null for other actions.
var view_for_action = (action) => {
    switch (action) {
    case "TOGGLE_EXPO":
        return Main.expo;
    case "TOGGLE_OVERVIEW":
        return Main.overview;
    default:
        return null;
    }
}

var TrackedViewAction = class extends TrackedAction {
    _begin(direction) {
        const view = view_for_action(this.definition.action);

        // One view at a time. Otherwise one opens on top of the other.
        if ((Main.expo.visible && view !== Main.expo) ||
            (Main.overview.visible && view !== Main.overview)) {
            return null;
        }

        this._showing = !view.visible;

        // The physical swipe direction does not matter, only the progress.
        if (!view.gestureBegin()) {
            return null;
        }

        this._view = view;

        return { snapPoints: [0, 1], progress: this._showing ? 0 : 1 };
    }

    _progress(percentage) {
        const travelled = percentage / VIEW_SWIPE_PERCENT;

        return this._showing ? travelled : 1 - travelled;
    }

    _update(progress) {
        this._view.gestureUpdate(progress);
    }

    _finish(target, duration) {
        const view = this._view;
        this._view = null;

        view.gestureEnd(target >= 0.5 ? 1 : 0, duration);
    }
}

// How much of a swipe opens a view completely.
const VIEW_SWIPE_PERCENT = 65;

// How much of a swipe moves the window switcher on by one window.
const PERCENT_PER_WINDOW = 15;

// Opens the Alt-Tab switcher. An empty modifier tells it to stay up
// until something selects a window, since a gesture has none to release.
var open_window_switcher = () => {
    const switcher = Main.wm._createAppSwitcher({
        get_name: () => "switch-windows",
        get_mask: () => 0,
    });

    // No windows, or the grab failed. The switcher removes itself.
    if (!switcher || !switcher._haveModal) {
        return null;
    }

    if (switcher.getWindowCount() < 2) {
        switcher.finish(false);
        return null;
    }

    // Only after it is built. A switcher that fails to show removes itself.
    switcher.showNow();

    return switcher._destroyed ? null : switcher;
}

// The switcher left open by a swipe. The next swipe moves this one instead
// of opening another.
let standing_switcher = null;

/**
 * WindowSwitchAction: opens the switcher and moves it one window, same as
 * a single Alt-Tab press. It stays open for another swipe, Enter, or Escape.
 */
var WindowSwitchAction = class extends BaseAction {
    do_action(direction, percentage, time) {
        const offset = backwards(direction) ? -1 : 1;

        if (standing_switcher != null && !standing_switcher._destroyed) {
            standing_switcher.selectByOffset(offset);
            return;
        }

        standing_switcher = open_window_switcher();
        if (standing_switcher == null) {
            return;
        }

        standing_switcher.selectByOffset(offset);
    }
}

// The list is read in the direction of the swipe.
var backwards = (direction) => {
    return direction === GestureDirection.LEFT || direction === GestureDirection.UP;
}

/**
 * TrackedWindowSwitchAction: moves the switcher's selection with the
 * fingers. A snap point is a window; the switcher wraps, so one swipe can
 * reach the whole list in either direction.
 */
var TrackedWindowSwitchAction = class extends TrackedAction {
    _begin(direction) {
        const switcher = open_window_switcher();
        if (switcher == null) {
            return null;
        }

        this._switcher = switcher;
        this._step = 0;
        this._direction = backwards(direction) ? -1 : 1;

        const count = switcher.getWindowCount();
        const snapPoints = [];
        for (let i = -(count - 1); i <= count - 1; i++) {
            snapPoints.push(i);
        }

        return { snapPoints, progress: 0, longSwipes: true };
    }

    _progress(percentage) {
        return this._direction * percentage / PERCENT_PER_WINDOW;
    }

    _update(progress) {
        const step = Math.round(progress);
        if (step === this._step) {
            return;
        }

        this._switcher.selectByOffset(step - this._step);
        this._step = step;
    }

    _finish(target, duration) {
        const switcher = this._switcher;
        this._switcher = null;

        const step = Math.round(target);
        if (step !== this._step) {
            switcher.selectByOffset(step - this._step);
            this._step = step;
        }

        // The window comes forward as the fingers lift. A swipe that
        // returns to the start selects nothing.
        switcher.finish(this._step !== 0);
    }
}

var WorkspaceSwitchAction = class extends BaseAction {
    constructor(definition, device, threshold) {
        super(definition, device, threshold);
    }

    do_action(direction, percentage, time) {
        const current = global.workspace_manager.get_active_workspace();

        let motion_dir = Meta.MotionDirection.RIGHT;
        let reverse = touchpad_settings.get_boolean("natural-scroll");

        switch (this.definition.action) {
        case "WORKSPACE_NEXT":
            motion_dir = reverse ? Meta.MotionDirection.RIGHT : Meta.MotionDirection.LEFT;
            break;
        case "WORKSPACE_PREVIOUS":
            motion_dir = reverse ? Meta.MotionDirection.LEFT : Meta.MotionDirection.RIGHT;
            break;
        case "WORKSPACE_UP":
            motion_dir = Meta.MotionDirection.UP;
            break;
        case "WORKSPACE_DOWN":
            motion_dir = Meta.MotionDirection.DOWN;
            break;
        }

        const neighbor = current.get_neighbor(motion_dir);
        neighbor.activate(global.get_current_time());
    }
}

const actionable_window_types = [
    Meta.WindowType.NORMAL,
    Meta.WindowType.DIALOG,
    Meta.WindowType.MODAL_DIALOG
]

var WindowOpAction = class extends BaseAction {
    constructor(definition, device, threshold) {
        super(definition, device, threshold);
    }

    do_action(direction, percentage, time) {
        const window = global.display.get_focus_window();

        if (window == null) {
            global.logWarning("WindowOpAction: no focus window");
            return
        }

        if (!actionable_window_types.includes(window.window_type)) {
            return;
        }

        switch (this.definition.action) {
        case "MINIMIZE":
            if (window.can_minimize()) {
                window.minimize();
            }
            break
        case "MAXIMIZE":
            if (window.maximized_horizontally && window.maximized_vertically) {
                window.unmaximize(Meta.MaximizeFlags.BOTH);
            } 
            else {
                if (window.can_maximize()) {
                    window.maximize(Meta.MaximizeFlags.BOTH);
                }
            }
            break
        case "CLOSE":
            window.delete(global.get_current_time());
            break
        case "FULLSCREEN":
            if (window.can_maximize()) {
                window.make_fullscreen();
            }
            break
        case "UNFULLSCREEN":
            window.unmake_fullscreen();
            break
        case "PUSH_TILE_UP":
        case "PUSH_TILE_DOWN":
        case "PUSH_TILE_LEFT":
        case "PUSH_TILE_RIGHT":
            this._handle_tile(this.definition.action, window);
            break;
        case "WINDOW_WORKSPACE_NEXT":
        case "WINDOW_WORKSPACE_PREVIOUS":
            this._handle_window_workspace_move(this.definition.action, window);
            break;
        }
    }

    _handle_tile(action, window) {
        switch (action) {
        case "PUSH_TILE_LEFT":
            global.display.push_tile(window, Meta.MotionDirection.LEFT);
            return;
        case "PUSH_TILE_RIGHT":
            global.display.push_tile(window, Meta.MotionDirection.RIGHT);
            return;
        case "PUSH_TILE_UP":
            global.display.push_tile(window, Meta.MotionDirection.UP);
            return;
        case "PUSH_TILE_DOWN":
            global.display.push_tile(window, Meta.MotionDirection.DOWN);
            return;
        }
    }

    _handle_window_workspace_move(action, window) {
        if (window.is_on_all_workspaces()) {
            return;
        }

        const workspace = window.get_workspace();
        const cur_index = workspace.index();
        const max_index = global.workspace_manager.get_n_workspaces() - 1;
        var new_workspace = null;

        // Don't use workspace.get_neighbor() here - just do nothing if we swipe right
        // from the last workspace or left from the first.
        switch (action) {
        case "WINDOW_WORKSPACE_NEXT":
            if (cur_index === max_index) {
                return;
            }

            new_workspace = global.workspace_manager.get_workspace_by_index(cur_index + 1)
            if (new_workspace != null) {
                window.change_workspace(new_workspace);
            } else {
                global.logWarning("Gesture - move window to next workspace failed, workspace doesn't exist");
            }
            return;
        case "WINDOW_WORKSPACE_PREVIOUS":
            if (cur_index === 0) {
                return;
            }

            new_workspace = global.workspace_manager.get_workspace_by_index(cur_index - 1)
            if (new_workspace != null) {
                window.change_workspace(new_workspace);
            } else {
                global.logWarning("Gesture - move window to next workspace failed, workspace doesn't exist");
            }
            return;
        }
    }
}

function lerp_rect(a, b, t) {
    return {
        x: Math.round(a.x + (b.x - a.x) * t),
        y: Math.round(a.y + (b.y - a.y) * t),
        width: Math.round(a.width + (b.width - a.width) * t),
        height: Math.round(a.height + (b.height - a.height) * t),
    };
}

// The real MotionDirection push_tile() needs for each tile action, so the
// commit below is the exact call the classic (untracked) action makes.
const TILE_DIRECTION = {
    PUSH_TILE_LEFT: Meta.MotionDirection.LEFT,
    PUSH_TILE_RIGHT: Meta.MotionDirection.RIGHT,
    PUSH_TILE_UP: Meta.MotionDirection.UP,
    PUSH_TILE_DOWN: Meta.MotionDirection.DOWN,
};

// The same push, as a Meta.TileMode, for working out where push_tile()
// will actually land (see next_tile_mode() below).
const TILE_MODE_DIRECTION = {
    PUSH_TILE_LEFT: Meta.TileMode.LEFT,
    PUSH_TILE_RIGHT: Meta.TileMode.RIGHT,
    PUSH_TILE_UP: Meta.TileMode.TOP,
    PUSH_TILE_DOWN: Meta.TileMode.BOTTOM,
};

// A window's floating size is not readable back from Meta, so a restore
// (untile or unmaximize) is previewed as a centered box at this fraction
// of the work area rather than the window's real pre-tile size.
const RESTORE_PREVIEW_SCALE = 0.7;

function restore_preview_rect(work) {
    const w = Math.round(work.width * RESTORE_PREVIEW_SCALE);
    const h = Math.round(work.height * RESTORE_PREVIEW_SCALE);
    return {
        x: work.x + Math.round((work.width - w) / 2),
        y: work.y + Math.round((work.height - h) / 2),
        width: w,
        height: h,
    };
}

// Mirrors muffin's get_new_tile_mode() (keybindings.c): where push_tile()
// lands given the current tile mode and a push in @direction. Keeping this
// in step with muffin is what lets the preview show a restore instead of
// sliding to the opposite half.
function next_tile_mode(direction, current) {
    const { NONE, MAXIMIZED, LEFT, RIGHT, TOP, BOTTOM, ULC, LLC, URC, LRC } = Meta.TileMode;
    switch (current) {
    case NONE:
        return direction;
    case MAXIMIZED:
        if (direction === LEFT) return LEFT;
        if (direction === RIGHT) return RIGHT;
        if (direction === TOP) return TOP;
        return TOP; // BOTTOM
    case LEFT:
        if (direction === LEFT) return LEFT;
        if (direction === RIGHT) return NONE;
        if (direction === TOP) return ULC;
        return LLC; // BOTTOM
    case RIGHT:
        if (direction === LEFT) return NONE;
        if (direction === RIGHT) return RIGHT;
        if (direction === TOP) return URC;
        return LRC; // BOTTOM
    case TOP:
        if (direction === LEFT) return ULC;
        if (direction === RIGHT) return URC;
        if (direction === TOP) return MAXIMIZED;
        return NONE; // BOTTOM
    case BOTTOM:
        if (direction === LEFT) return LLC;
        if (direction === RIGHT) return LRC;
        if (direction === TOP) return NONE;
        return BOTTOM; // BOTTOM
    case ULC:
        if (direction === LEFT) return ULC;
        if (direction === RIGHT) return TOP;
        if (direction === TOP) return ULC;
        return LEFT; // BOTTOM
    case LLC:
        if (direction === LEFT) return LLC;
        if (direction === RIGHT) return BOTTOM;
        if (direction === TOP) return LEFT;
        return LLC; // BOTTOM
    case URC:
        if (direction === LEFT) return TOP;
        if (direction === RIGHT) return URC;
        if (direction === TOP) return URC;
        return RIGHT; // BOTTOM
    case LRC:
        if (direction === LEFT) return BOTTOM;
        if (direction === RIGHT) return LRC;
        if (direction === TOP) return RIGHT;
        return LRC; // BOTTOM
    default:
        return current;
    }
}

// The rect push_tile() will give a window in @mode, mirroring muffin's
// meta_window_get_tile_area() (halves and quarters of the work area).
function tile_area_for_mode(work, mode) {
    const half_w = Math.round(work.width / 2);
    const half_h = Math.round(work.height / 2);

    switch (mode) {
    case Meta.TileMode.LEFT:
        return { x: work.x, y: work.y, width: half_w, height: work.height };
    case Meta.TileMode.RIGHT:
        return { x: work.x + work.width - half_w, y: work.y, width: half_w, height: work.height };
    case Meta.TileMode.TOP:
        return { x: work.x, y: work.y, width: work.width, height: half_h };
    case Meta.TileMode.BOTTOM:
        return { x: work.x, y: work.y + work.height - half_h, width: work.width, height: half_h };
    case Meta.TileMode.ULC:
        return { x: work.x, y: work.y, width: half_w, height: half_h };
    case Meta.TileMode.URC:
        return { x: work.x + work.width - half_w, y: work.y, width: half_w, height: half_h };
    case Meta.TileMode.LLC:
        return { x: work.x, y: work.y + work.height - half_h, width: half_w, height: half_h };
    case Meta.TileMode.LRC:
        return { x: work.x + work.width - half_w, y: work.y + work.height - half_h, width: half_w, height: half_h };
    default: // MAXIMIZED
        return { x: work.x, y: work.y, width: work.width, height: work.height };
    }
}

/**
 * TrackedTileAction: previews the tile push_tile() will actually make,
 * following muffin's own tile-navigation state (see next_tile_mode()),
 * so an inverse push previews a restore rather than the opposite half.
 */
var TrackedTileAction = class extends TrackedAction {
    _begin(direction) {
        const window = global.display.get_focus_window();
        if (window == null || !actionable_window_types.includes(window.window_type)) {
            return null;
        }

        const actor = window.get_compositor_private();
        if (actor == null) {
            return null;
        }

        const work = window.get_work_area_current_monitor();
        if (work == null) {
            return null;
        }

        const current_mode = (window.maximized_horizontally && window.maximized_vertically)
            ? Meta.TileMode.MAXIMIZED : window.tile_mode;
        const new_mode = next_tile_mode(TILE_MODE_DIRECTION[this.definition.action], current_mode);

        // Matches do_tile_move()'s own no-op check: nothing will happen.
        if (new_mode === current_mode) {
            return null;
        }

        this._target = new_mode === Meta.TileMode.NONE
            ? restore_preview_rect(work) : tile_area_for_mode(work, new_mode);

        this._window = window;
        this._start = window.get_frame_rect();
        this._monitor = window.get_monitor();

        Main.wm._showTilePreview(null, window, new Meta.Rectangle(this._start), this._monitor);

        return { snapPoints: [0, 1], progress: 0 };
    }

    _progress(percentage) {
        return percentage / VIEW_SWIPE_PERCENT;
    }

    _update(progress) {
        const rect = lerp_rect(this._start, this._target, Math.min(1, Math.max(0, progress)));
        Main.wm._tilePreview.show(this._window, new Meta.Rectangle(rect), this._monitor, false, 0);
    }

    _finish(target, duration) {
        Main.wm._hideTilePreview();

        if (target >= 0.5) {
            global.display.push_tile(this._window, TILE_DIRECTION[this.definition.action]);
        }

        this._window = null;
    }
}

/**
 * TrackedMaximizeAction: maximizes or restores with the fingers, using the
 * same tile preview as TrackedTileAction. An already-maximized window is
 * the "open" end, so the swipe restores it; the commit always calls the
 * real maximize/unmaximize, so it lands at the right size either way.
 */

var TrackedMaximizeAction = class extends TrackedAction {
    _begin(direction) {
        const window = global.display.get_focus_window();
        if (window == null || !actionable_window_types.includes(window.window_type) ||
            !window.can_maximize()) {
            return null;
        }

        const actor = window.get_compositor_private();
        if (actor == null) {
            return null;
        }

        const work = window.get_work_area_current_monitor();
        if (work == null) {
            return null;
        }

        this._window = window;
        this._monitor = window.get_monitor();
        this._maximized = window.maximized_horizontally && window.maximized_vertically;

        this._openRect = { x: work.x, y: work.y, width: work.width, height: work.height };

        if (this._maximized) {
            this._closedRect = restore_preview_rect(work);
        } else {
            this._closedRect = window.get_frame_rect();
        }

        const startRect = this._maximized ? this._openRect : this._closedRect;
        Main.wm._showTilePreview(null, window, new Meta.Rectangle(startRect), this._monitor);

        return { snapPoints: [0, 1], progress: this._maximized ? 1 : 0 };
    }

    _progress(percentage) {
        const travelled = percentage / VIEW_SWIPE_PERCENT;
        return this._maximized ? 1 - travelled : travelled;
    }

    _update(progress) {
        const rect = lerp_rect(this._closedRect, this._openRect, Math.min(1, Math.max(0, progress)));
        Main.wm._tilePreview.show(this._window, new Meta.Rectangle(rect), this._monitor, false, 0);
    }

    _finish(target, duration) {
        Main.wm._hideTilePreview();

        if (target >= 0.5 && !this._maximized) {
            this._window.maximize(Meta.MaximizeFlags.BOTH);
        } else if (target < 0.5 && this._maximized) {
            this._window.unmaximize(Meta.MaximizeFlags.BOTH);
        }

        this._window = null;
    }
}

/**
 * TrackedMinimizeAction: shrinks towards a box at the bottom of the work
 * area. Forward only: a minimized window has no frame left to gesture on.
 */
const MINIMIZE_PREVIEW_SIZE = 40;

var TrackedMinimizeAction = class extends TrackedAction {
    _begin(direction) {
        const window = global.display.get_focus_window();
        if (window == null || !actionable_window_types.includes(window.window_type) ||
            !window.can_minimize()) {
            return null;
        }

        const actor = window.get_compositor_private();
        if (actor == null) {
            return null;
        }

        const work = window.get_work_area_current_monitor();
        if (work == null) {
            return null;
        }

        this._window = window;
        this._monitor = window.get_monitor();
        this._start = window.get_frame_rect();
        this._target = {
            x: work.x + Math.round((work.width - MINIMIZE_PREVIEW_SIZE) / 2),
            y: work.y + work.height - MINIMIZE_PREVIEW_SIZE,
            width: MINIMIZE_PREVIEW_SIZE,
            height: MINIMIZE_PREVIEW_SIZE,
        };

        Main.wm._showTilePreview(null, window, new Meta.Rectangle(this._start), this._monitor);

        return { snapPoints: [0, 1], progress: 0 };
    }

    _progress(percentage) {
        return percentage / VIEW_SWIPE_PERCENT;
    }

    _update(progress) {
        const rect = lerp_rect(this._start, this._target, Math.min(1, Math.max(0, progress)));
        Main.wm._tilePreview.show(this._window, new Meta.Rectangle(rect), this._monitor, false, 0);
    }

    _finish(target, duration) {
        Main.wm._hideTilePreview();

        if (target >= 0.5) {
            this._window.minimize();
        }

        this._window = null;
    }
}

var GlobalDesktopAction = class extends BaseAction {
    constructor(definition, device, threshold) {
        super(definition, device, threshold);
    }

    _cancel_current_mode() {
        if (global.stage_input_mode === Cinnamon.StageInputMode.FULLSCREEN) {
            Main.expo.hide()
            Main.overview.hide();
            return true;
        }

        return false;
    }

    do_action(direction, percentage, time) {
        if (this._cancel_current_mode()) {
            return;
        }

        switch (this.definition.action) {
        case "TOGGLE_EXPO":
            Main.expo.toggle();
            break
        case "TOGGLE_OVERVIEW":
            Main.overview.toggle();
            break;
        case "TOGGLE_DESKTOP":
            global.workspace_manager.toggle_desktop(global.get_current_time());
            break;
        }
    }
}

var ExecAction = class extends BaseAction {
    constructor(definition, device, threshold) {
        super(definition, device, threshold);
    }

    do_action(direction, percentage, time) {
        try {
            GLib.spawn_command_line_async(this.definition.custom_value);
        } catch (e) {
            global.logError(`Failed to execute custom gesture action: ${e}`);
        }
    }
};

// Make a single mixer control, the first time there's a VolumeAction,
// and reuse it for subsequent ones.
var mixer = null;
var init_mixer = () => {
    if (mixer != null) {
        return;
    }

    mixer = new Cvc.MixerControl({ name: "cinnamon-gestures" });
    mixer.open();
}

var VolumeAction = class extends BaseAction {
    constructor(definition, device, threshold) {
        super(definition, device, threshold);

        this.ignoring = true;

        const soundSettings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.sound" });

        if(soundSettings.get_boolean("allow-amplified-volume"))
            this.max_volume = mixer.get_vol_max_amplified();
        else
            this.max_volume = mixer.get_vol_max_norm();

        this.pct_step = Math.ceil(this.max_volume / 100);

        this.last_time = 0;
        this.poll_interval = CONTINUOUS_ACTION_POLL_INTERVAL;
    }

    _set_volume(up, percentage, time) {
        const sink = mixer.get_default_sink();

        if (sink == null) {
            return;
        }

        var new_volume = sink.volume;
        var int_pct = Math.ceil(percentage)

        if (this.ignoring) {
            if (up) {
                if (int_pct * this.pct_step < sink.volume - 2 * this.pct_step) {
                    return;
                }
            } else {
                if (int_pct * this.pct_step >= sink.volume + 2 * this.pct_step) {
                    return;
                }
            }

            this.ignoring = false;
        }

        new_volume = int_pct * this.pct_step;
        new_volume = new_volume.clamp(0, this.max_volume);

        sink.set_volume(new_volume);
        sink.push_volume();

        if (sink.is_muted) {
            sink.change_is_muted(false);
        }

        if (time < (this.last_time + this.poll_interval)) {
            return;
        }

        Main.osdWindowManager.show(-1, this._get_volume_icon(int_pct, false), null, int_pct);
        this.last_time = time;
    }

    _toggle_muted() {
        const sink = mixer.get_default_sink();

        if (sink == null) {
            return;
        }

        const is_muted = sink.is_muted;
        sink.change_is_muted(!is_muted);

        const percent = !is_muted ? 0 : (sink.volume / this.pct_step).clamp(0, 100);
        Main.osdWindowManager.show(-1, this._get_volume_icon(percent), null, percent);
    }

    _get_volume_icon(volume_pct) {
        let icon;
        if (volume_pct < 1)
            icon = "muted";
        else
        if (volume_pct < 33)
            icon = "low";
        else
        if (volume_pct < 66)
            icon = "medium";
        else
            icon = "high";

        return new Gio.ThemedIcon({ name: `audio-volume-${icon}-symbolic` });
    }

    begin(direction, percentage, time) {
        if (this.definition.action === "TOGGLE_MUTE" && this.definition.phase === "start") {
            this._toggle_muted();
            return;
        };

        this.last_time = 0;
        this.update(direction, percentage, time);
    }

    update(direction, percentage, time) {
        if (this.definition.action === "VOLUME_UP") {
            this._set_volume(true, percentage, time);
        }
        else
        if (this.definition.action === "VOLUME_DOWN") {
            this._set_volume(false, 100 - percentage, time);
        }
    }

    end(direction, percentage, time) {
        if (this.definition.action === "TOGGLE_MUTE" && this.definition.phase === "end") {
            this._toggle_muted();
            return;
        };

        if (percentage < this.threshold) {
            return;
        }

        var int_pct = Math.ceil(percentage);
        if (this.definition.action === "VOLUME_DOWN") {
            int_pct = 100 - int_pct;
        }

        Main.osdWindowManager.show(-1, this._get_volume_icon(int_pct), null, int_pct);
    }
}

var mpris_manager = null;
var init_mpris_controller = () => {
    if (mpris_manager != null) {
        return;
    }

    mpris_manager = getMprisPlayerManager();
}

var MediaAction = class extends BaseAction {
    constructor(definition, device, threshold) {
        super(definition, device, threshold);
    }

    do_action(direction, percentage, time) {
        const player = mpris_manager.getBestPlayer();

        if (player == null) {
            return;
        }

        if (this.definition.action === "MEDIA_PLAY_PAUSE") {
            player.playPause();
        }
        else
        if (this.definition.action === "MEDIA_NEXT") {
            player.next();
        }
        else
        if (this.definition.action === "MEDIA_PREVIOUS") {
            player.previous();
        }
    }
}

var ZoomAction = class extends BaseAction {
    constructor(definition, device, threshold) {
        super(definition, device, threshold);
        this.last_percentage = 0;
        this.last_time = 0;
        this.poll_interval = CONTINUOUS_ACTION_POLL_INTERVAL;

        if (definition.custom_value !== "") {
            try {
                let adjust = parseInt(definition.custom_value);
                this.poll_interval = this.poll_interval + adjust;
            } catch (e) {}
        }
    }

    begin(direction, percentage, time) {
        this.last_percentage = 0;
        this.last_time = 0;

        this.do_action(direction, percentage, time);
    }

    update(direction, percentage, time) {
        this.do_action(direction, percentage, time);
    }

    do_action(direction, percentage, time) {
        let zoom_in = true;

        if (time < (this.last_time + this.poll_interval)) {
            return;
        }

        if (percentage == this.last_percentage) {
            return;
        }

        switch (this.definition.action) {
        case "ZOOM_IN":
            zoom_in = percentage > this.last_percentage;
            break;
        case "ZOOM_OUT":
            zoom_in = percentage < this.last_percentage;
            break;
        }

        if (zoom_in) {
            Magnifier.magInputHandler._zoomIn();
        }
        else
        {
            Magnifier.magInputHandler._zoomOut();
        }

        this.last_time = time;
        this.last_percentage = percentage;
    }
}
