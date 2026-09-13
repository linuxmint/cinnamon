// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

// Ported from GNOME Shell. Each monitor gets a MonitorGroup holding one
// WorkspaceGroup per workspace, side by side; a gesture sets the group's
// offset so the windows follow the fingers (see switchBegin() and its
// caller, TrackedWorkspaceSwitchAction in ui/gestures/actions.js). Only
// gestures use this; keybindings and applets use windowManager.js instead.
//
// Differences from upstream: the wallpaper comes from
// Meta.create_background_for_monitor(); global.window_group is hidden
// throughout, so live windows cannot show through the gap; and there is no
// panel offset for vertical layouts, since Cinnamon uses one row.

const { Clutter, GObject, Meta, St } = imports.gi;

const Main = imports.ui.main;
const Layout = imports.ui.layout;

var WORKSPACE_SPACING = 100;

/**
 * WorkspaceGroup: one workspace's window copies, for one monitor. A group
 * with no workspace holds the windows on all of them, and stays put.
 */
var WorkspaceGroup = GObject.registerClass(
class WorkspaceGroup extends Clutter.Actor {
    _init(workspace, monitor) {
        super._init({
            width: monitor.width,
            height: monitor.height,
            clip_to_allocation: true,
        });

        this._workspace = workspace;
        this._monitor = monitor;
        this._windowRecords = [];

        if (this._workspace) {
            this._background = new Clutter.Actor();
            this.add_child(this._background);

            const wallpaper =
                Meta.create_background_for_monitor(global.display, this._monitor.index);
            if (wallpaper) {
                wallpaper.set_size(this._monitor.width, this._monitor.height);
                this._background.add_child(wallpaper);
            }

            this._createDesktopWindows();
        }

        this._createWindows();

        this.connect('destroy', this._onDestroy.bind(this));
        global.display.connectObject('restacked',
            this._syncStacking.bind(this), this);
    }

    get workspace() {
        return this._workspace;
    }

    _shouldShowWindow(window) {
        if (!window.showing_on_its_workspace() || this._isDesktopWindow(window))
            return false;

        if (window.is_override_redirect() ||
            window.get_window_type() === Meta.WindowType.OVERRIDE_OTHER)
            return false;

        if (!this._windowIsOnThisMonitor(window))
            return false;

        const isSticky = window.is_on_all_workspaces();

        // No workspace means we should show windows that are on all workspaces
        if (!this._workspace)
            return isSticky;

        // Otherwise only show windows that are (only) on that workspace
        return !isSticky && window.located_on_workspace(this._workspace);
    }

    _syncStacking() {
        const windowActors = global.get_window_actors().filter(w =>
            this._shouldShowWindow(w.meta_window));

        let lastRecord;
        const bottomActor = this._background ? this._background : null;

        for (const windowActor of windowActors) {
            const record = this._windowRecords.find(r => r.windowActor === windowActor);
            if (!record)
                continue;

            this.set_child_above_sibling(record.clone,
                lastRecord ? lastRecord.clone : bottomActor);
            lastRecord = record;
        }
    }

    _isDesktopWindow(metaWindow) {
        return metaWindow.get_window_type() === Meta.WindowType.DESKTOP;
    }

    _windowIsOnThisMonitor(metaWindow) {
        const geometry = global.display.get_monitor_geometry(this._monitor.index);
        const [intersects] = metaWindow.get_frame_rect().intersect(geometry);
        return intersects;
    }

    _createDesktopWindows() {
        // The desktop window (nemo-desktop and friends) is sticky, so every
        // workspace gets its own copy of it on top of the wallpaper.
        const desktopActors = global.get_window_actors().filter(w =>
            this._isDesktopWindow(w.meta_window) && this._windowIsOnThisMonitor(w.meta_window));

        desktopActors.map(a => this._createClone(a)).forEach(
            clone => this._background.add_child(clone));
    }

    _createWindows() {
        const windowActors = global.get_window_actors().filter(w =>
            this._shouldShowWindow(w.meta_window));

        windowActors.map(a => this._createClone(a)).forEach(
            clone => this.add_child(clone));
    }

    _createClone(windowActor) {
        const clone = new Clutter.Clone({
            source: windowActor,
            x: windowActor.x - this._monitor.x,
            y: windowActor.y - this._monitor.y,
        });

        const record = { windowActor, clone };

        windowActor.connectObject('destroy', () => {
            clone.destroy();
            this._windowRecords.splice(this._windowRecords.indexOf(record), 1);
        }, this);

        this._windowRecords.push(record);
        return clone;
    }

    _removeWindows() {
        for (const record of this._windowRecords)
            record.clone.destroy();

        this._windowRecords = [];
    }

    _onDestroy() {
        this._removeWindows();
    }
});

var MonitorGroup = GObject.registerClass({
    Properties: {
        'progress': GObject.ParamSpec.double(
            'progress', 'progress', 'progress',
            GObject.ParamFlags.READWRITE,
            -Infinity, Infinity, 0),
    },
}, class MonitorGroup extends St.Widget {
    _init(monitor, workspaceIndices) {
        super._init({
            clip_to_allocation: true,
            // Painted directly rather than by theme, to guarantee the gap
            // between workspaces does not show whatever sits below.
            style: 'background-color: black;',
        });

        this._monitor = monitor;

        this.add_constraint(new Layout.MonitorConstraint({ index: monitor.index }));

        this._container = new Clutter.Actor();
        this.add_child(this._container);

        this.add_child(new WorkspaceGroup(null, monitor));

        this._workspaceGroups = [];

        const workspaceManager = global.workspace_manager;
        const activeWorkspace = workspaceManager.get_active_workspace();

        let x = 0;
        let y = 0;

        for (const i of workspaceIndices) {
            const ws = workspaceManager.get_workspace_by_index(i);
            const group = new WorkspaceGroup(ws, monitor);

            this._workspaceGroups.push(group);
            this._container.add_child(group);
            group.set_position(x, y);

            if (this._isVertical)
                y += this.baseDistance;
            else if (Clutter.get_default_text_direction() === Clutter.TextDirection.RTL)
                x -= this.baseDistance;
            else
                x += this.baseDistance;
        }

        this.progress = this.getWorkspaceProgress(activeWorkspace);
    }

    get _isVertical() {
        return global.workspace_manager.layout_rows === -1;
    }

    /**
     * baseDistance: how far one whole workspace travels: the monitor plus
     * the gap between them.
     */
    get baseDistance() {
        const spacing =
            WORKSPACE_SPACING * St.ThemeContext.get_for_stage(global.stage).scale_factor;

        if (this._isVertical)
            return this._monitor.height + spacing;
        else
            return this._monitor.width + spacing;
    }

    get progress() {
        if (this._isVertical)
            return -this._container.y / this.baseDistance;
        else if (this.get_text_direction() === Clutter.TextDirection.RTL)
            return this._container.x / this.baseDistance;
        else
            return -this._container.x / this.baseDistance;
    }

    set progress(p) {
        if (this._isVertical)
            this._container.y = -Math.round(p * this.baseDistance);
        else if (this.get_text_direction() === Clutter.TextDirection.RTL)
            this._container.x = Math.round(p * this.baseDistance);
        else
            this._container.x = -Math.round(p * this.baseDistance);

        this.notify('progress');
    }

    get index() {
        return this._monitor.index;
    }

    getWorkspaceProgress(workspace) {
        const group = this._workspaceGroups.find(g =>
            g.workspace.index() === workspace.index());
        return this._getWorkspaceGroupProgress(group);
    }

    _getWorkspaceGroupProgress(group) {
        if (this._isVertical)
            return group.y / this.baseDistance;
        else if (this.get_text_direction() === Clutter.TextDirection.RTL)
            return -group.x / this.baseDistance;
        else
            return group.x / this.baseDistance;
    }

    /**
     * getSnapPoints: the progress value of every workspace, ascending.
     */
    getSnapPoints() {
        return this._workspaceGroups.map(g => this._getWorkspaceGroupProgress(g));
    }

    findClosestWorkspace(progress) {
        const distances = this.getSnapPoints().map(p => Math.abs(p - progress));
        const index = distances.indexOf(Math.min(...distances));
        return this._workspaceGroups[index].workspace;
    }

    /**
     * _interpolateProgress: maps @progress from @monitorGroup's terms to
     * this group's, since monitors of different sizes travel different
     * distances for the same workspace.
     */
    _interpolateProgress(progress, monitorGroup) {
        if (this.index === monitorGroup.index)
            return progress;

        const points1 = monitorGroup.getSnapPoints();
        const points2 = this.getSnapPoints();

        const upper = points1.indexOf(points1.find(p => p >= progress));
        const lower = points1.indexOf(points1.slice().reverse().find(p => p <= progress));

        if (points1[upper] === points1[lower])
            return points2[upper];

        const t = (progress - points1[lower]) / (points1[upper] - points1[lower]);

        return points2[lower] + (points2[upper] - points2[lower]) * t;
    }

    updateSwipeForMonitor(progress, monitorGroup) {
        this.progress = this._interpolateProgress(progress, monitorGroup);
    }
});

var WorkspaceAnimationController = class {
    constructor() {
        this._switchData = null;
    }

    // The gesture manager calls these three when a gesture is set to switch
    // workspaces. Only one swipe runs at a time.

    /**
     * _prepareWorkspaceSwitch: builds the copies the swipe slides and
     * hides the live windows; _finishWorkspaceSwitch() undoes it.
     */
    _prepareWorkspaceSwitch() {
        if (this._switchData)
            return;

        const nWorkspaces = global.workspace_manager.get_n_workspaces();
        const workspaceIndices = [...Array(nWorkspaces).keys()];

        const switchData = {};

        this._switchData = switchData;
        // Every monitor gets a group since the live windows are hidden, but
        // with workspaces-only-on-primary only one follows the swipe.
        switchData.monitors = [];
        switchData.animatedMonitors = [];
        switchData.gestureActivated = false;

        const onlyOnPrimary = Meta.prefs_get_workspaces_only_on_primary();

        for (const monitor of Main.layoutManager.monitors) {
            const group = new MonitorGroup(monitor, workspaceIndices);

            Main.switcherGroup.add_actor(group);
            switchData.monitors.push(group);

            if (!onlyOnPrimary || monitor.index === Main.layoutManager.primaryIndex)
                switchData.animatedMonitors.push(group);
        }

        Meta.disable_unredirect_for_display(global.display);
        global.window_group.hide();
    }

    _finishWorkspaceSwitch(switchData) {
        this._switchData = null;

        // The overview and expo hide the window group themselves; leave it
        // alone if one of them took over while we were animating.
        if (!Main.overview.visible && !Main.expo.visible)
            global.window_group.show();

        Meta.enable_unredirect_for_display(global.display);

        switchData.monitors.forEach(m => m.destroy());
    }

    _findMonitorGroup(monitorIndex) {
        return this._switchData.animatedMonitors.find(m => m.index === monitorIndex);
    }

    /**
     * switchBegin: prepares the workspaces on @monitor for a gesture,
     * hiding the live windows.
     *
     * Returns: { snapPoints, progress, cancelProgress } (a snap point is a
     * workspace), or null if unswipeable, in which case nothing was
     * prepared and the other two methods must not be called.
     */
    switchBegin(monitor) {
        if (Meta.prefs_get_workspaces_only_on_primary() &&
            monitor !== Main.layoutManager.primaryIndex)
            return null;

        if (!Main.animations_enabled || Main.modalCount > 0)
            return null;

        if (global.workspace_manager.get_n_workspaces() < 2)
            return null;

        if (this._switchData && this._switchData.gestureActivated) {
            for (const group of this._switchData.animatedMonitors)
                group.remove_all_transitions();
        } else {
            this._prepareWorkspaceSwitch();
        }

        const monitorGroup = this._findMonitorGroup(monitor);
        if (!monitorGroup) {
            // Nothing to swipe here. Undo the preparation, or the window
            // group stays hidden.
            if (!this._switchData.gestureActivated)
                this._finishWorkspaceSwitch(this._switchData);
            return null;
        }

        const progress = monitorGroup.progress;
        const closestWs = monitorGroup.findClosestWorkspace(progress);
        const cancelProgress = monitorGroup.getWorkspaceProgress(closestWs);

        this._switchData.baseMonitorGroup = monitorGroup;

        return {
            snapPoints: monitorGroup.getSnapPoints(),
            baseDistance: monitorGroup.baseDistance,
            progress,
            cancelProgress,
        };
    }

    switchUpdate(progress) {
        if (!this._switchData)
            return;

        for (const monitorGroup of this._switchData.animatedMonitors)
            monitorGroup.updateSwipeForMonitor(progress, this._switchData.baseMonitorGroup);
    }

    /**
     * switchEnd: slides to @endProgress over @duration ms, then activates
     * that workspace once settled, since activating early would animate
     * the same change a second time.
     */
    switchEnd(duration, endProgress) {
        if (!this._switchData)
            return;

        const switchData = this._switchData;
        switchData.gestureActivated = true;

        const newWs = switchData.baseMonitorGroup.findClosestWorkspace(endProgress);
        const endTime = Clutter.get_current_event_time();

        const params = {
            duration,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
        };

        // Animate the primary monitor last: a duration of 0 completes
        // immediately, which would destroy the groups mid-loop.
        const primaryGroup =
            switchData.animatedMonitors.find(m => m.index === Main.layoutManager.primaryIndex);

        for (const monitorGroup of switchData.animatedMonitors) {
            if (monitorGroup === primaryGroup)
                continue;

            monitorGroup.ease_property('progress',
                monitorGroup.getWorkspaceProgress(newWs), params);
        }

        const lastGroup = primaryGroup ? primaryGroup : switchData.animatedMonitors[0];
        if (!lastGroup) {
            this._finishWorkspaceSwitch(switchData);
            return;
        }

        lastGroup.ease_property('progress', lastGroup.getWorkspaceProgress(newWs), {
            ...params,
            onComplete: () => {
                if (!newWs.active)
                    newWs.activate(endTime);
                this._finishWorkspaceSwitch(switchData);
            },
        });
    }

    /**
     * gestureActive: true from the moment a swipe commits until it has
     * settled. windowManager checks this to skip animating a switch twice.
     */
    get gestureActive() {
        return this._switchData !== null && this._switchData.gestureActivated;
    }

    /**
     * cancelSwitchAnimation: drops a swipe still following the fingers, for
     * when something else switches workspaces mid-gesture. Leaves a swipe
     * that has already committed to finish.
     */
    cancelSwitchAnimation() {
        if (!this._switchData)
            return;

        if (this._switchData.gestureActivated)
            return;

        this._finishWorkspaceSwitch(this._switchData);
    }
};
