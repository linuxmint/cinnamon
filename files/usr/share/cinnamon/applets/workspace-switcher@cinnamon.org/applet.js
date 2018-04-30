const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const PopupMenu = imports.ui.popupMenu;
const SignalManager = imports.misc.signalManager;
const Tooltips = imports.ui.tooltips;
const Settings = imports.ui.settings;
const ModalDialog = imports.ui.modalDialog;
const Pango = imports.gi.Pango;

const MIN_SWITCH_INTERVAL_MS = 220;

class WorkspaceButton {
    constructor(index, applet) {
        this.index = index;
        this.applet = applet;
        this.workspace = global.screen.get_workspace_by_index(this.index);
        this.workspace_name = Main.getWorkspaceName(index);
        this.actor = null; // defined in subclass

        this.ws_signals = new SignalManager.SignalManager(null);

        this.ws_signals.connect(this.workspace, "window-added", this.update, this);
        this.ws_signals.connect(this.workspace, "window-removed", this.update, this);
    }

    show() {
        this.actor.connect('button-release-event', Lang.bind(this, this.onClicked));
        this._tooltip = new Tooltips.PanelItemTooltip(this, this.workspace_name, this.applet.orientation);
        if (this.index === global.screen.get_active_workspace_index()) {
            this.activate(true);
        }
    }

    onClicked(actor, event) {
        if (event.get_button() == 1) {
            Main.wm.moveToWorkspace(this.workspace);
        }
    }

    update() {
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

class WorkspaceGraph extends WorkspaceButton {
    constructor(index, applet) {
        super(index, applet);

        this.actor = new St.Bin({ reactive: applet._draggable.inhibit,
                                  style_class: 'workspace',
                                  y_fill: true,
                                  important: true });

        this.graphArea = new St.DrawingArea({ style_class: 'windows', important: true });
        this.actor.child = this.graphArea;
        this.panelApplet = applet;
        this.workspace_size = new Meta.Rectangle();
        this.workspace.get_work_area_all_monitors(this.workspace_size);
        this.sizeRatio = this.workspace_size.width / this.workspace_size.height;
        let height = applet._panelHeight - 6;

        if (applet.orientation == St.Side.LEFT || applet.orientation == St.Side.RIGHT)
            height = height / this.sizeRatio;

        let width = Math.round(this.sizeRatio * height);
        this.actor.set_size(width, height);
        this.graphArea.set_size(width, height);
        this.graphArea.connect('repaint', Lang.bind(this, this.onRepaint));
    }

    scale (windows_rect, workspace_rect, area_width, area_height) {
        let scaled_rect = new Meta.Rectangle();
        let x_ratio = area_width / workspace_rect.width;
        let y_ratio = area_height / workspace_rect.height;
        scaled_rect.x = windows_rect.x * x_ratio;
        scaled_rect.y = windows_rect.y * y_ratio;
        scaled_rect.width = windows_rect.width * x_ratio;
        scaled_rect.height = windows_rect.height * y_ratio;
        return scaled_rect;
    }

    sortWindowsByUserTime (win1, win2) {
        let t1 = win1.get_user_time();
        let t2 = win2.get_user_time();
        return (t2 < t1) ? 1 : -1;
    }

    onRepaint(area) {
        let graphThemeNode = this.graphArea.get_theme_node();
        let workspaceThemeNode = this.panelApplet.actor.get_theme_node();
        let height = this.panelApplet._panelHeight - workspaceThemeNode.get_vertical_padding();
        let borderWidth = workspaceThemeNode.get_border_width(St.Side.TOP) + workspaceThemeNode.get_border_width(St.Side.BOTTOM);

        this.graphArea.set_size(this.sizeRatio * height, height - borderWidth);
        let cr = area.get_context();
        let [area_width, area_height] = area.get_surface_size();

        // construct a list with all windows
        let windows = this.workspace.list_windows();
        windows = windows.filter( Main.isInteresting );
        windows = windows.filter(
            function(w) {
                return !w.is_skip_taskbar() && !w.minimized;
            });
        windows.sort(this.sortWindowsByUserTime);

        if (windows.length) {
            let windowBackgroundColor;
            let windowBorderColor;
            for (let i = 0; i < windows.length; ++i) {
                let metaWindow = windows[i];
                let scaled_rect = this.scale(metaWindow.get_outer_rect(), this.workspace_size, area_width, area_height);

                cr.setLineWidth(1);
                if (metaWindow.has_focus()) {
                    windowBorderColor = graphThemeNode.get_color('-active-window-border');
                    Clutter.cairo_set_source_color(cr, windowBorderColor);
                }
                else {
                    windowBorderColor = graphThemeNode.get_color('-inactive-window-border');
                    Clutter.cairo_set_source_color(cr, windowBorderColor);
                }
                cr.rectangle(scaled_rect.x, scaled_rect.y, scaled_rect.width, scaled_rect.height);
                cr.strokePreserve();
                if (metaWindow.has_focus()) {
                    windowBackgroundColor = graphThemeNode.get_color('-active-window-background');
                    Clutter.cairo_set_source_color(cr, windowBackgroundColor);
                }
                else {
                    windowBackgroundColor = graphThemeNode.get_color('-inactive-window-background');
                    Clutter.cairo_set_source_color(cr, windowBackgroundColor);
                }

                cr.fill();
            }
        }

        cr.$dispose();
    }

    update() {
        this.graphArea.queue_repaint();
    }

    activate(active) {
        if (active)
            this.actor.add_style_pseudo_class('active');
        else
            this.actor.remove_style_pseudo_class('active');
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
    }

    activate(active) {
        if (active)
            this.actor.add_style_pseudo_class('outlined');
        else
            this.actor.remove_style_pseudo_class('outlined');
    }
}

class CinnamonWorkspaceSwitcher extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.orientation = orientation;
        this.panel_height = panel_height;
        this.signals = new SignalManager.SignalManager(null);
        this.buttons = [];
        this._last_switch = 0;
        this._last_switch_direction = 0;

        let manager;
        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            manager = new Clutter.BoxLayout({ spacing: 2 * global.ui_scale,
                                                homogeneous: true,
                                                orientation: Clutter.Orientation.HORIZONTAL });
        } else {
            manager = new Clutter.BoxLayout({ spacing: 2 * global.ui_scale,
                                                homogeneous: true,
                                                orientation: Clutter.Orientation.VERTICAL });
        }
        this.manager = manager;
        this.manager_container = new Clutter.Actor({ layout_manager: manager });
        this.actor.add_actor (this.manager_container);
        this.manager_container.show();

        this._focusWindow = 0;
        if (global.display.focus_window)
            this._focusWindow = global.display.focus_window.get_compositor_private();

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("display_type", "display_type", this._createButtons);

        this.actor.connect('scroll-event', this.hook.bind(this));

        this._createButtons();
        global.screen.connect('notify::n-workspaces', Lang.bind(this, this.onNumberOfWorkspacesChanged));
        global.window_manager.connect('switch-workspace', this._onWorkspaceChanged.bind(this));
        global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));

        let expoMenuItem = new PopupMenu.PopupIconMenuItem(_("Manage workspaces (Expo)"), "view-grid-symbolic", St.IconType.SYMBOLIC);
        expoMenuItem.connect('activate', Lang.bind(this, function() {
            if (!Main.expo.animationInProgress)
                Main.expo.toggle();
        }));
        this._applet_context_menu.addMenuItem(expoMenuItem);

        let addWorkspaceMenuItem = new PopupMenu.PopupIconMenuItem (_("Add a new workspace"), "list-add", St.IconType.SYMBOLIC);
        addWorkspaceMenuItem.connect('activate', Lang.bind(this, function() {
            Main._addWorkspace();
        }));
        this._applet_context_menu.addMenuItem(addWorkspaceMenuItem);

        this.removeWorkspaceMenuItem = new PopupMenu.PopupIconMenuItem (_("Remove the current workspace"), "list-remove", St.IconType.SYMBOLIC);
        this.removeWorkspaceMenuItem.connect('activate', Lang.bind(this, function() {
            this.removeWorkspace();
        }));
        this._applet_context_menu.addMenuItem(this.removeWorkspaceMenuItem);
        this.removeWorkspaceMenuItem.setSensitive(global.screen.n_workspaces > 1);
    }

    onNumberOfWorkspacesChanged() {
        this.removeWorkspaceMenuItem.setSensitive(global.screen.n_workspaces > 1);
        this._createButtons();
    }

    removeWorkspace  (){
        if (global.screen.n_workspaces <= 1) {
            return;
        }
        this.workspace_index = global.screen.get_active_workspace_index();
        let removeAction = Lang.bind(this, function() {
            Main._removeWorkspace(global.screen.get_active_workspace());
        });
        if (!Main.hasDefaultWorkspaceName(this.workspace_index)) {
            let prompt = _("Are you sure you want to remove workspace \"%s\"?\n\n").format(
                Main.getWorkspaceName(this.workspace_index));
            let confirm = new ModalDialog.ConfirmDialog(prompt, removeAction);
            confirm.open();
        }
        else {
            removeAction();
        }
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
            this.manager.set_vertical(false);
        else
            this.manager.set_vertical(true);

        this._createButtons();
    }

    on_panel_height_changed() {
        this._createButtons();
    }

    hook(actor, event) {
        let now = (new Date()).getTime();
        let direction = event.get_scroll_direction();

        // Avoid fast scroll directions
        if(direction != 0 && direction != 1) return;

        // Do the switch only after a ellapsed time to avoid fast
        // consecutive switches on sensible hardware, like touchpads
        if ((now - this._last_switch) > MIN_SWITCH_INTERVAL_MS ||
            direction !== this._last_switch_direction) {

            if (direction == 0) Main.wm.actionMoveWorkspaceLeft();
            else if (direction == 1) Main.wm.actionMoveWorkspaceRight();

            this._last_switch = now;
            this._last_switch_direction = direction;
        }
    }

    _createButtons() {
        for (let i = 0; i < this.buttons.length; ++i) {
            this.buttons[i].destroy();
        }

        let suppress_graph = false; // suppress the graph and replace by buttons if size ratio
                                    // would be unworkable in a vertical panel
        if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {
            let workspace_size = new Meta.Rectangle();
            global.screen.get_workspace_by_index(0).get_work_area_all_monitors(workspace_size);
            let sizeRatio = workspace_size.width / workspace_size.height;
            if (sizeRatio >= 2.35) {  // completely empirical, other than the widest
                                    // ratio single screen I know is 21*9 = 2.33
                suppress_graph = true;
            }
        }

        if (this.display_type == "visual" && !suppress_graph)
            this.actor.set_style_class_name('workspace-graph');
        else
            this.actor.set_style_class_name('workspace-switcher');

        this.actor.set_important(true);

        this.buttons = [];
        for (let i = 0; i < global.screen.n_workspaces; ++i) {
            if (this.display_type == "visual" && !suppress_graph)
                this.buttons[i] = new WorkspaceGraph(i, this);
            else
                this.buttons[i] = new SimpleButton(i, this);

            this.manager_container.add_actor(this.buttons[i].actor);
            this.buttons[i].show();
        }

        this.signals.disconnectAllSignals();
        if (this.display_type == "visual" && !suppress_graph) {
            // In visual mode, keep track of window events to represent them
            this.signals.connect(global.display, "notify::focus-window", this._onFocusChanged, this);
            this._onFocusChanged();
        }
    }

    _onFocusChanged() {
        if (global.display.focus_window &&
            this._focusWindow == global.display.focus_window.get_compositor_private())
            return;

        this.signals.disconnect("position-changed");
        this.signals.disconnect("size-changed");

        if (!global.display.focus_window)
            return;

        this._focusWindow = global.display.focus_window.get_compositor_private();
        this.signals.connect(this._focusWindow, "position-changed", Lang.bind(this, this._onPositionChanged), this);
        this.signals.connect(this._focusWindow, "size-changed", Lang.bind(this, this._onPositionChanged), this);
        this._onPositionChanged();
    }

    _onPositionChanged() {
        let button = this.buttons[global.screen.get_active_workspace_index()];
        button.update();
    }

    on_applet_removed_from_panel() {
        this.signals.disconnectAllSignals();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonWorkspaceSwitcher(metadata, orientation, panel_height, instance_id);
}
