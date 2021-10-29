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

        this.scaleFactor = 0;

        this.actor = new St.Bin({ reactive: applet._draggable.inhibit,
                                  style_class: 'workspace',
                                  y_fill: true,
                                  important: true });

        this.graphArea = new St.DrawingArea({ style_class: 'windows', important: true });
        this.actor.add_actor(this.graphArea);
        this.panelApplet = applet;

        this.graphArea.set_size(1, 1);
        this.graphArea.connect('repaint', Lang.bind(this, this.onRepaint));
    }

    getSizeAdjustment (actor, vertical) {
        let themeNode = actor.get_theme_node()
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

    setGraphSize () {
        this.workspace_size = new Meta.Rectangle();
        this.workspace.get_work_area_all_monitors(this.workspace_size);

        let height, width;
        if (this.panelApplet.orientation == St.Side.LEFT ||
            this.panelApplet.orientation == St.Side.RIGHT) {

            width = this.panelApplet._panelHeight -
                this.getSizeAdjustment(this.panelApplet.actor, true) -
                this.getSizeAdjustment(this.actor, true);
            this.scaleFactor = this.workspace_size.width / width;
            height = Math.round(this.workspace_size.height / this.scaleFactor);
        }
        else {
            height = this.panelApplet._panelHeight -
                this.getSizeAdjustment(this.panelApplet.actor, false) -
                this.getSizeAdjustment(this.actor, false);
            this.scaleFactor = this.workspace_size.height / height;
            width = Math.round(this.workspace_size.width / this.scaleFactor);
        }

        this.graphArea.set_size(width, height);
    }

    scale (windows_rect, workspace_rect) {
        let scaled_rect = new Meta.Rectangle();
        scaled_rect.x = Math.round((windows_rect.x - workspace_rect.x) / this.scaleFactor);
        scaled_rect.y = Math.round((windows_rect.y - workspace_rect.y) / this.scaleFactor);
        scaled_rect.width = Math.round(windows_rect.width / this.scaleFactor);
        scaled_rect.height = Math.round(windows_rect.height / this.scaleFactor);
        return scaled_rect;
    }

    sortWindowsByUserTime (win1, win2) {
        let t1 = win1.get_user_time();
        let t2 = win2.get_user_time();
        return (t2 < t1) ? 1 : -1;
    }

    paintWindow(metaWindow, themeNode, cr) {
        let windowBackgroundColor;
        let windowBorderColor;

        let scaled_rect = this.scale(metaWindow.get_outer_rect(), this.workspace_size);

        if (metaWindow.has_focus()) {
            windowBorderColor = themeNode.get_color('-active-window-border');
            windowBackgroundColor = themeNode.get_color('-active-window-background');
        } else {
            windowBorderColor = themeNode.get_color('-inactive-window-border');
            windowBackgroundColor = themeNode.get_color('-inactive-window-background');
        }

        Clutter.cairo_set_source_color(cr, windowBorderColor);
        cr.rectangle(scaled_rect.x, scaled_rect.y, scaled_rect.width, scaled_rect.height);
        cr.strokePreserve();

        Clutter.cairo_set_source_color(cr, windowBackgroundColor);
        cr.fill();
    }

    onRepaint(area) {
        // we need to set the size of the drawing area the first time, but we can't get
        // accurate measurements until everything is added to the stage
        if (this.scaleFactor === 0) this.setGraphSize();

        let graphThemeNode = this.graphArea.get_theme_node();
        let cr = area.get_context();
        cr.setLineWidth(1);

        // construct a list with all windows
        let windows = this.workspace.list_windows();
        windows = windows.filter( Main.isInteresting );
        windows = windows.filter(
            function(w) {
                return !w.is_skip_taskbar() && !w.minimized;
            });

        windows.sort(this.sortWindowsByUserTime);

        if (windows.length) {
            let focusWindow = null;

            for (let i = 0; i < windows.length; ++i) {
                let metaWindow = windows[i];

                if (metaWindow.has_focus()) {
                    focusWindow = metaWindow;
                    continue;
                }

                this.paintWindow(metaWindow, graphThemeNode, cr);
            }

            if (focusWindow) {
                this.paintWindow(focusWindow, graphThemeNode, cr);
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
        this.update();
    }

    activate(active) {
        if (active) {
            this.actor.add_style_pseudo_class('outlined');
        }
        else {
            this.actor.remove_style_pseudo_class('outlined');
            this.update();
        }
    }

    shade(used) {
        if (!used) {
            this.actor.add_style_pseudo_class('shaded');
        }
        else {
            this.actor.remove_style_pseudo_class('shaded');
        }
    }
    
    update() {
        let windows = this.workspace.list_windows();
        let used = windows.some(Main.isInteresting);
        this.shade(used);
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

        this._focusWindow = 0;
        if (global.display.focus_window)
            this._focusWindow = global.display.focus_window.get_compositor_private();

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("display-type", "display_type", this.queueCreateButtons);
        this.settings.bind("scroll-behavior", "scroll_behavior");

        this.actor.connect('scroll-event', this.hook.bind(this));

        this.queueCreateButtons();
        global.screen.connect('notify::n-workspaces', Lang.bind(this, this.onNumberOfWorkspacesChanged));
        global.screen.connect('workareas-changed', Lang.bind(this, this.queueCreateButtons));
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
        this.queueCreateButtons();
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

        // Do the switch only after a ellapsed time to avoid fast
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
        for (let i = 0; i < global.screen.n_workspaces; ++i) {
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
