const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const PopupMenu = imports.ui.popupMenu;
const SignalManager = imports.misc.signalManager;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;
const ModalDialog = imports.ui.modalDialog;
const Pango = imports.gi.Pango;
const Cinnamon = imports.gi.Cinnamon;

const MIN_SWITCH_INTERVAL_MS = 220;

const DEFAULT_ICON_SIZES = [8, 12, 16, 18, 22, 24, 32];


function removeWorkspaceAtIndex(index) {
    if (global.workspace_manager.n_workspaces <= 1 ||
        index >= global.workspace_manager.n_workspaces) {
        return;
    }

    const removeAction = () => {
        Main._removeWorkspace(global.workspace_manager.get_workspace_by_index(index));
    };

    if (!Main.hasDefaultWorkspaceName(index)) {
        let prompt = _("Are you sure you want to remove workspace \"%s\"?\n\n").format(
            Main.getWorkspaceName(index)
        );

        let confirm = new ModalDialog.ConfirmDialog(prompt, removeAction);
        confirm.open();
    }
    else {
        removeAction();
    }
}


class WorkspaceButton {
    constructor(index, applet) {
        this.index = index;
        this.applet = applet;
        this.workspace = global.workspace_manager.get_workspace_by_index(this.index);
        this.workspace_name = Main.getWorkspaceName(index);
        this.actor = null; // defined in subclass

        this.ws_signals = new SignalManager.SignalManager(null);

        this.ws_signals.connect(this.workspace, "window-added", this.update, this);
        this.ws_signals.connect(this.workspace, "window-removed", this.update, this);

        // Connect after Main or else we'll end up with stale names.
        this.ws_signals.connect_after(Main.wmSettings, "changed::workspace-names", this.updateName, this);
    }

    show() {
        this.actor.connect('button-release-event', Lang.bind(this, this.onClicked));
        this._tooltip = new Tooltips.PanelItemTooltip(this, this.workspace_name, this.applet.orientation);
        if (this.index === global.workspace_manager.get_active_workspace_index()) {
            this.activate(true);
        }
    }

    updateName() {
        this.workspace_name = Main.getWorkspaceName(this.index);
        this._tooltip.set_text(this.workspace_name);
    }

    onClicked(actor, event) {
        if (event.get_button() == 1) {
            Main.wm.moveToWorkspace(this.workspace);
        } else if (event.get_button() == 2) {
            removeWorkspaceAtIndex(this.index);
        }
    }

    update(options = {}) {
        // defined in subclass
    }

    activate(active) {
        // Defined in subclass
    }

    destroy() {
        this.ws_signals.disconnectAllSignals();
        this._tooltip.destroy();
        this.actor.destroy();
    }
}


class SimpleButton extends WorkspaceButton {
    constructor(index, applet) {
        super(index, applet);

        this.actor = new St.Button({ name: 'workspaceButton',
                                     style_class: 'workspace-button',
                                     reactive: applet._draggable.inhibit });

        if (applet.orientation == St.Side.TOP || applet.orientation == St.Side.BOTTOM) {
            this.actor.set_height(applet._panelHeight);
        } else {
            this.actor.set_width(applet._panelHeight);
            this.actor.add_style_class_name('vertical');
        }

        let label = new St.Label({ text: (index + 1).toString() });
        label.clutter_text.set_ellipsize(Pango.EllipsizeMode.NONE);
        this.actor.set_child(label);
        this.update();
    }

    activate(active) {
        if (active) {
            this.actor.add_style_pseudo_class('outlined');
        }
        else {
            this.actor.remove_style_pseudo_class('outlined');
        }
        this.update();
    }

    shade(used) {
        if (!used) {
            this.actor.add_style_pseudo_class('shaded');
        }
        else {
            this.actor.remove_style_pseudo_class('shaded');
        }
    }

    update(options = {}) {
        let windows = this.workspace.list_windows();
        let used = windows.some(Main.isInteresting);
        this.shade(used);
    }
}


class WindowGraph {
    constructor(workspaceGraph, metaWindow, tracker, iconEnabled, iconSize) {
        this.workspaceGraph = workspaceGraph;
        this.metaWindow = metaWindow;
        this.tracker = tracker;
        this.iconEnabled = iconEnabled;
        this._iconSize = iconSize;
        this._iconScaledSize = this._iconSize * global.ui_scale;
        this._halvedIconScaledSize = this._iconScaledSize * 0.5;

        this.drawingArea = new St.DrawingArea({
            style_class: 'windows',
            width: this.workspaceGraph.width,
            height: this.workspaceGraph.height,
            important: true,
        });

        this.drawingArea.connect('repaint', this.onRepaint.bind(this));

        this._icon = null;
        this.positionIconOnGraph(this.intersectionRect());
    }

    get icon() {
        if (!this._icon)
            this._icon = this.createIcon();
        return this._icon;
    }

    calcIconPos(rect) {
        const x = Math.round(rect.x + rect.width / 2 - this._halvedIconScaledSize);
        const y = Math.round(rect.y + rect.height / 2 - this._halvedIconScaledSize);
        return [x, y];
    }

    positionIconOnGraph(rect) {
        if (this.iconEnabled) {
            const [x, y] = this.calcIconPos(rect);

            this.icon.set_x(x);
            this.icon.set_y(y);

            if (rect.width < this._iconScaledSize || rect.height < this._iconScaledSize) {
                this.icon.hide();
            } else {
                this.icon.show();
            }
        }
    }

    intersectionRect() {
        const windowRect = this.metaWindow.get_buffer_rect();
        const workspaceRect = this.workspaceGraph.workspace_size;
        const scaleFactor = this.workspaceGraph.scaleFactor;

        const scaledWindowX = (windowRect.x - workspaceRect.x) / scaleFactor;
        const scaledWindowY = (windowRect.y - workspaceRect.y) / scaleFactor;
        const scaledWindowWidth = windowRect.width / scaleFactor;
        const scaledWindowHeight = windowRect.height / scaleFactor;

        const graphWidth = this.workspaceGraph.width;
        const graphHeight = this.workspaceGraph.height;

        const intersectionX = Math.max(0, scaledWindowX);
        const intersectionY = Math.max(0, scaledWindowY);
        const intersectionRight = Math.min(graphWidth, scaledWindowX + scaledWindowWidth);
        const intersectionBottom = Math.min(graphHeight, scaledWindowY + scaledWindowHeight);

        const intersection = new Meta.Rectangle();

        intersection.x = Math.round(intersectionX);
        intersection.y = Math.round(intersectionY);
        intersection.width = Math.round(intersectionRight - intersectionX);
        intersection.height = Math.round(intersectionBottom - intersectionY);

        return intersection;
    }

    onRepaint(area) {
        const [winBackgroundColor, winBorderColor] = this.getWinThemeColors();
        const rect = this.intersectionRect();
        const cr = area.get_context();

        cr.setLineWidth(1);

        Clutter.cairo_set_source_color(cr, winBorderColor);
        cr.rectangle(rect.x, rect.y, rect.width, rect.height);

        cr.strokePreserve();

        Clutter.cairo_set_source_color(cr, winBackgroundColor);

        cr.fill();
        cr.$dispose();

        this.positionIconOnGraph(rect);
    }

    getWinThemeColors() {
        const graphThemeNode = this.workspaceGraph.graphArea.get_theme_node();
        let windowBackgroundColor, windowBorderColor;

        if (this.metaWindow.has_focus()) {
            windowBorderColor = graphThemeNode.get_color('-active-window-border');
            windowBackgroundColor = graphThemeNode.get_color('-active-window-background');
        } else {
            windowBorderColor = graphThemeNode.get_color('-inactive-window-border');
            windowBackgroundColor = graphThemeNode.get_color('-inactive-window-background');
        }

        return [windowBackgroundColor, windowBorderColor];
    }

    createIcon() {
        let iconActor = null;
        let app = this.tracker.get_window_app(this.metaWindow);

        if (app) {
            iconActor = app.create_icon_texture_for_window(
                this._iconSize,
                this.metaWindow,
            );
        }

        if (!iconActor) {
            iconActor = new St.Icon({
                icon_name: 'applications-other',
                icon_type: St.IconType.FULLCOLOR,
                icon_size: this._iconSize,
            });
        }

        return iconActor;
    }

    destroy() {
        if (this.iconEnabled && this._icon) {
            this._icon.destroy();
            this._icon = null;
        }

        this.drawingArea.destroy();
        this.drawingArea = null;
    }

    update(options = {}) {
        this.drawingArea.queue_repaint();
    }

    show() {
        this.workspaceGraph.graphArea.add_child(this.drawingArea);

        if (this.iconEnabled) {
            this.workspaceGraph.graphArea.add_child(this.icon);
        }
    }
}


class WorkspaceGraph extends WorkspaceButton {
    constructor(index, applet) {
        super(index, applet);

        this.scaleFactor = 0;

        this.actor = new St.Bin({ reactive: applet._draggable.inhibit,
                                  style_class: 'workspace',
                                  y_fill: true,
                                  important: true });

        this.graphArea = new St.DrawingArea({ style_class: 'windows', important: true });
        this.actor.add_actor(this.graphArea);

        this.graphArea.set_size(1, 1);
        this.graphArea.connect('repaint', this.onRepaint.bind(this));

        this.focusGraph = null;
        this.windowsGraphs = [];

        this.height = 1;
        this.width = 1;
    }

    getSizeAdjustment(actor, vertical) {
        let themeNode = actor.get_theme_node();

        if (vertical) {
            return themeNode.get_horizontal_padding() +
                themeNode.get_border_width(St.Side.LEFT) +
                themeNode.get_border_width(St.Side.RIGHT);
        }
        else {
            return themeNode.get_vertical_padding() +
                themeNode.get_border_width(St.Side.TOP) +
                themeNode.get_border_width(St.Side.BOTTOM);
        }
    }

    getIdealIconSize() {
        const maxAllowed = (Math.min(this.width, this.height) * 0.55) / global.ui_scale;

        for (let i = DEFAULT_ICON_SIZES.length - 1; i >= 0; i--) {
            if (DEFAULT_ICON_SIZES[i] <= maxAllowed) {
                return DEFAULT_ICON_SIZES[i];
            }
        }

        return DEFAULT_ICON_SIZES[0];
    }

    setGraphSize() {
        this.workspace_size = this.workspace.get_work_area_all_monitors();

        if (this.applet.orientation == St.Side.LEFT ||
            this.applet.orientation == St.Side.RIGHT) {

            this.width = this.applet._panelHeight -
                this.getSizeAdjustment(this.applet.actor, true) -
                this.getSizeAdjustment(this.actor, true);
            this.scaleFactor = this.workspace_size.width / this.width;
            this.height = Math.round(this.workspace_size.height / this.scaleFactor);
        }
        else {
            this.height = this.applet._panelHeight -
                this.getSizeAdjustment(this.applet.actor, false) -
                this.getSizeAdjustment(this.actor, false);
            this.scaleFactor = this.workspace_size.height / this.height;
            this.width = Math.round(this.workspace_size.width / this.scaleFactor);
        }

        this.graphArea.set_size(this.width, this.height);
    }

    sortWindowsByUserTime(win1, win2) {
        let t1 = win1.get_user_time();
        let t2 = win2.get_user_time();
        return (t2 < t1) ? 1 : -1;
    }

    filterWindows(win) {
        return Main.isInteresting(win) &&
            !win.is_skip_taskbar()     &&
            !win.minimized;
    }

    onRepaint(area) {
        // we need to set the size of the drawing area the first time, but we can't get
        // accurate measurements until everything is added to the stage
        if (this.scaleFactor === 0) this.setGraphSize();

        // construct a list with all windows
        let windows = this.workspace.list_windows();
        windows = windows.filter(this.filterWindows);
        windows.sort(this.sortWindowsByUserTime);

        this.graphArea.remove_all_children();

        if (this.windowsGraphs) this.windowsGraphs.forEach(e => e.destroy());

        this.windowsGraphs = [];

        const iconEnabled = this.applet.show_window_icons;
        const iconSize = this.applet.window_icon_size == -1 ? this.getIdealIconSize() : this.applet.window_icon_size;
        const tracker = Cinnamon.WindowTracker.get_default();

        this.focusGraph = null;
        for (const window of windows) {
            const graph = new WindowGraph(this, window, tracker, iconEnabled, iconSize);

            this.windowsGraphs.push(graph);

            if (window.has_focus()) {
                this.focusGraph = graph;
            } else {
                graph.show();
                graph.update();
            }
        }

        if (this.focusGraph) {
            this.focusGraph.show();
            this.focusGraph.update();
        }
    }

    update(options = {}) {
        const state = options.state;

        if ((state == "position-changed" || state == "size-changed") &&
            this.focusGraph && this.focusGraph.metaWindow.has_focus()
        ) {
            this.focusGraph.update(options);
        } else {
            this.graphArea.queue_repaint();
        }
    }

    activate(active) {
        if (active)
            this.actor.add_style_pseudo_class('active');
        else
            this.actor.remove_style_pseudo_class('active');
    }

    destroy() {
        this.focusGraph = null;
        this.windowsGraphs.forEach(e => e.destroy());
        this.windowsGraphs = [];
        super.destroy();
    }
}


class CinnamonWorkspaceSwitcher extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.orientation = orientation;
        this.signals = new SignalManager.SignalManager(null);
        this.buttons = [];
        this._last_switch = 0;
        this._last_switch_direction = 0;
        this.createButtonsQueued = false;

        this._focusWindow = null;
        if (global.display.focus_window)
            this._focusWindow = global.display.focus_window;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("display-type", "display_type", this.queueCreateButtons);
        this.settings.bind("scroll-behavior", "scroll_behavior");
        this.settings.bind("show-window-icons", "show_window_icons", this.updateButtons);
        this.settings.bind("window-icon-size", "window_icon_size", this.updateButtons);

        this.actor.connect('scroll-event', this.hook.bind(this));

        this.signals.connect(Main.layoutManager, 'monitors-changed', this.onWorkspacesUpdated, this);

        this.queueCreateButtons();
        global.workspace_manager.connect('notify::n-workspaces', () => { this.onWorkspacesUpdated() });
        global.workspace_manager.connect('workspaces-reordered', () => { this.onWorkspacesUpdated() });
        global.window_manager.connect('switch-workspace', this._onWorkspaceChanged.bind(this));
        global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));

        let expoMenuItem = new PopupMenu.PopupIconMenuItem(_("Manage workspaces (Expo)"), "xsi-view-grid-symbolic", St.IconType.SYMBOLIC);
        expoMenuItem.connect('activate', Lang.bind(this, function() {
            if (!Main.expo.animationInProgress)
                Main.expo.toggle();
        }));
        this._applet_context_menu.addMenuItem(expoMenuItem);

        let addWorkspaceMenuItem = new PopupMenu.PopupIconMenuItem (_("Add a new workspace"), "xsi-list-add", St.IconType.SYMBOLIC);
        addWorkspaceMenuItem.connect('activate', Lang.bind(this, function() {
            Main._addWorkspace();
        }));
        this._applet_context_menu.addMenuItem(addWorkspaceMenuItem);

        this.removeWorkspaceMenuItem = new PopupMenu.PopupIconMenuItem (_("Remove the current workspace"), "list-remove", St.IconType.SYMBOLIC);
        this.removeWorkspaceMenuItem.connect('activate', this.removeCurrentWorkspace.bind(this));
        this._applet_context_menu.addMenuItem(this.removeWorkspaceMenuItem);
        this.removeWorkspaceMenuItem.setSensitive(global.workspace_manager.n_workspaces > 1);
    }

    onWorkspacesUpdated() {
        this.removeWorkspaceMenuItem.setSensitive(global.workspace_manager.n_workspaces > 1);
        this._createButtons();
    }

    removeCurrentWorkspace() {
        if (global.workspace_manager.n_workspaces <= 1) {
            return;
        }
        this.workspace_index = global.workspace_manager.get_active_workspace_index();
        removeWorkspaceAtIndex(this.workspace_index);
    }

    _onWorkspaceChanged(wm, from, to) {
        this.buttons[from].activate(false);
        this.buttons[to].activate(true);
    }

    on_panel_edit_mode_changed() {
        let reactive = !global.settings.get_boolean('panel-edit-mode');
        for (let i = 0; i < this.buttons.length; ++i) {
            this.buttons[i].actor.reactive = reactive;
        }
    }

    on_orientation_changed(neworientation) {
        this.orientation = neworientation;

        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM)
            this.actor.set_vertical(false);
        else
            this.actor.set_vertical(true);

        this.queueCreateButtons();
    }

    on_panel_height_changed() {
        this.queueCreateButtons();
    }

    hook(actor, event) {
        if (this.scroll_behavior == "disabled")
            return;

        let now = (new Date()).getTime();
        let direction = event.get_scroll_direction();

        // Avoid fast scroll directions
        if(direction != 0 && direction != 1) return;

        // Do the switch only after a elapsed time to avoid fast
        // consecutive switches on sensible hardware, like touchpads
        if ((now - this._last_switch) > MIN_SWITCH_INTERVAL_MS ||
            direction !== this._last_switch_direction) {

            // XOR used to determine the effective direction
            if ((direction == 0) == (this.scroll_behavior == "normal"))
                Main.wm.actionMoveWorkspaceLeft();
            else
                Main.wm.actionMoveWorkspaceRight();

            this._last_switch = now;
            this._last_switch_direction = direction;
        }
    }

    queueCreateButtons() {
        if (!this.createButtonsQueued) {
            Mainloop.idle_add(Lang.bind(this, this._createButtons));
            this.createButtonsQueued = true;
        }
    }

    updateButtons() {
        this.buttons.forEach(btn => btn.update());
    }

    _createButtons() {
        this.createButtonsQueued = false;
        for (let i = 0; i < this.buttons.length; ++i) {
            this.buttons[i].destroy();
        }

        if (this.display_type == "visual")
            this.actor.set_style_class_name('workspace-graph');
        else
            this.actor.set_style_class_name('workspace-switcher');

        this.actor.set_important(true);

        this.buttons = [];
        for (let i = 0; i < global.workspace_manager.n_workspaces; ++i) {
            if (this.display_type == "visual")
                this.buttons[i] = new WorkspaceGraph(i, this);
            else
                this.buttons[i] = new SimpleButton(i, this);

            this.actor.add_actor(this.buttons[i].actor);
            this.buttons[i].show();
        }

        this.signals.disconnect("notify::focus-window");
        if (this.display_type == "visual") {
            // In visual mode, keep track of window events to represent them
            this.signals.connect(global.display, "notify::focus-window", this._onFocusChanged, this);
            this._onFocusChanged();
        }
    }

    _onFocusChanged() {
        if (global.display.focus_window &&
            this._focusWindow == global.display.focus_window)
            return;

        this.signals.disconnect("position-changed");
        this.signals.disconnect("size-changed");

        if (!global.display.focus_window)
            return;

        this._focusWindow = global.display.focus_window;
        this.signals.connect(this._focusWindow, "position-changed", () => this._onWindowsStateChanged("position-changed"), this);
        this.signals.connect(this._focusWindow, "size-changed", () => this._onWindowsStateChanged("size-changed"), this);
        this._onWindowsStateChanged("focus-changed");
    }

    _onWindowsStateChanged(state) {
        let button = this.buttons[global.workspace_manager.get_active_workspace_index()];
        button.update({ state: state });
    }

    on_applet_removed_from_panel() {
        this.signals.disconnectAllSignals();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonWorkspaceSwitcher(metadata, orientation, panel_height, instance_id);
}
