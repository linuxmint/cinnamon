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

function WorkspaceButton(index, applet) {
    this._init(index, applet);
}

WorkspaceButton.prototype = {
    _init : function(index, applet) {
        this.index = index;
        this.applet = applet;
        this.workspace = global.screen.get_workspace_by_index(this.index);
        this.workspace_name = Main.getWorkspaceName(index);
        this.actor = null; // defined in subclass

        this.ws_signals = new SignalManager.SignalManager(this);

        this.ws_signals.connect(this.workspace, "window-added", this.update);
        this.ws_signals.connect(this.workspace, "window-removed", this.update);
    },

    show : function() {
        this.actor.connect('button-release-event', Lang.bind(this, this.onClicked));
        this._tooltip = new Tooltips.PanelItemTooltip(this, this.workspace_name, this.applet.orientation);
    },

    onClicked: function(actor, event) {
        if (event.get_button() == 1) {
            Main.wm.moveToWorkspace(this.workspace);
        }
    },

    update: function() {
        // defined in subclass
    },

    destroy: function() {
        this.ws_signals.disconnectAllSignals();
        this._tooltip.destroy();
        this.actor.destroy();
    }
};

function WorkspaceGraph(index, applet) {
    this._init(index, applet);
}

WorkspaceGraph.prototype = {
    __proto__: WorkspaceButton.prototype,
    _init: function(index, applet) {
        WorkspaceButton.prototype._init.call(this, index, applet);

        this.actor = new St.Bin({ reactive: true,
                                  style_class: 'workspace',
                                  y_fill: true,
                                  important: true });

        this.graphArea = new St.DrawingArea({ style_class: 'windows', important: true });
        this.actor.child = this.graphArea;
        this.panelApplet = applet;
        this.workspace_size = new Meta.Rectangle();
        this.workspace.get_work_area_all_monitors(this.workspace_size);
        this.sizeRatio = this.workspace_size.width / this.workspace_size.height;
        let height = applet._panelHeight - 6;;

	if (applet.orientation == St.Side.LEFT || applet.orientation == St.Side.RIGHT)
	{
            height = height / this.sizeRatio;
	}

        this.actor.set_size(this.sizeRatio * height, height);
        this.graphArea.set_size(this.sizeRatio * height, height);
        this.graphArea.connect('repaint', Lang.bind(this, this.onRepaint));
        if (index == global.screen.get_active_workspace_index()) {
            this.actor.add_style_pseudo_class('active');
        }
    },

    scale: function (windows_rect, workspace_rect, area_width, area_height) {
        let scaled_rect    = new Meta.Rectangle();
        let x_ratio        = area_width / workspace_rect.width;
        let y_ratio        = area_height / workspace_rect.height;
        scaled_rect.x      = windows_rect.x * x_ratio;
        scaled_rect.y      = windows_rect.y * y_ratio;
        scaled_rect.width  = windows_rect.width * x_ratio;
        scaled_rect.height = windows_rect.height * y_ratio;
        return scaled_rect;
    },

    sortWindowsByUserTime: function (win1, win2) {
        let t1 = win1.get_user_time();
        let t2 = win2.get_user_time();
        return (t2 < t1) ? 1 : -1;
    },

    onRepaint: function(area) {
        try {
            let graphThemeNode     = this.graphArea.get_theme_node();
            let workspaceThemeNode = this.panelApplet.actor.get_theme_node();
            let height             = this.panelApplet._panelHeight - workspaceThemeNode.get_vertical_padding();
            let borderWidth        = workspaceThemeNode.get_border_width(St.Side.TOP) + workspaceThemeNode.get_border_width(St.Side.BOTTOM);

            this.graphArea.set_size(this.sizeRatio * height, height - borderWidth);
            let cr = area.get_context();
            let [area_width, area_height] = area.get_surface_size();

            let workspace_is_active = false;
            if (this.index == global.screen.get_active_workspace_index()) {
                workspace_is_active = true;
            }

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
                    let metaWindow  = windows[i];
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
        catch(e)
        {
            global.logError(e);
        }
    },

    update: function() {
        this.graphArea.queue_repaint();
    }
};

function SimpleButton(index, applet) {
    this._init(index, applet);
}

SimpleButton.prototype = {
    __proto__: WorkspaceButton.prototype,
    _init : function(index, applet) {
        WorkspaceButton.prototype._init.call(this, index, applet);

        this.actor = new St.Button({ name: 'workspaceButton',
                                     style_class: 'workspace-button',
                                     reactive: true });

        if ( index == global.screen.get_active_workspace_index() ) {
            this.actor.add_style_pseudo_class('outlined');
        }

        if (applet._scaleMode) {
            if (applet.orientation == St.Side.TOP || applet.orientation == St.Side.BOTTOM) {
                this.actor.set_height(applet._panelHeight);
            } else {
                this.actor.set_height(0.6*applet._panelHeight);  // factors are completely empirical
                this.actor.set_width(0.9*applet._panelHeight);
            }
        }
        let label = new St.Label({ text: (index + 1).toString() });
        this.actor.set_child(label);
    },

    update: function() {

    }
};

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.orientation = orientation;
            this.panel_height = panel_height;
            this.signals = new SignalManager.SignalManager(this);
            this.buttons = [];

            let manager;
            if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
                manager = new Clutter.BoxLayout( { spacing: 2 * global.ui_scale,
		                                   homogeneous: true,
		                                   orientation: Clutter.Orientation.HORIZONTAL });
            }
	    else {
                manager = new Clutter.BoxLayout( { spacing: 2 * global.ui_scale,
		                                   homogeneous: true,
		                                   orientation: Clutter.Orientation.VERTICAL });
            }
            this.manager = manager;
            this.manager_container = new Clutter.Actor( { layout_manager: manager } );
            this.actor.add_actor (this.manager_container);
            this.manager_container.show();

            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
            this.settings.bindProperty(Settings.BindingDirection.IN, "display_type", "display_type", Lang.bind(this, this._createButtons), null);

            this.actor.connect('scroll-event', this.hook.bind(this));

            this._createButtons();
            global.screen.connect('notify::n-workspaces', Lang.bind(this, this.onNumberOfWorkspacesChanged));
            global.window_manager.connect('switch-workspace', Lang.bind(this, this._createButtons));
            this.on_panel_edit_mode_changed();
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
        catch (e) {
            global.logError(e);
        }
    },

    onNumberOfWorkspacesChanged: function() {
        this.removeWorkspaceMenuItem.setSensitive(global.screen.n_workspaces > 1);
        this._createButtons();
    },

    removeWorkspace : function (){
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
    },

    on_panel_edit_mode_changed: function() {
        let reactive = !global.settings.get_boolean('panel-edit-mode');
        for (let i = 0; i < this.buttons.length; ++i) {
            this.buttons[i].reactive = reactive;
        }
    },

//
//override getDisplayLayout to declare that this applet is suitable for both horizontal and
// vertical orientations
//
    getDisplayLayout: function() {
        return Applet.DisplayLayout.BOTH;
    },

    on_orientation_changed: function(neworientation) {
        this.orientation = neworientation;

        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM)
            this.manager.set_vertical(false);
        else
            this.manager.set_vertical(true);

        this._createButtons();
    },

    on_panel_height_changed: function() {
        this._createButtons();
    },

    hook: function(actor, event){
        var direction = event.get_scroll_direction();
        if (direction == 0) this.switch_workspace(-1);
        if (direction == 1) this.switch_workspace(1);
    },

    switch_workspace: function(incremental){
        var index = global.screen.get_active_workspace_index();
        index += incremental;
        if(global.screen.get_workspace_by_index(index) != null) {
            global.screen.get_workspace_by_index(index).activate(global.get_current_time());
        }
    },

    _createButtons: function() {
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

            this.manager_container.add_actor(this.buttons[i].actor);
            this.buttons[i].show();
        }

        this.signals.disconnectAllSignals();
        if (this.display_type == "visual") {
            // In visual mode, keep track of window events to represent them
            this.signals.connect(global.display, "notify::focus-window", this._onFocusChanged);
            this._onFocusChanged();
        }
    },

    _onFocusChanged: function() {
        if (global.display.focus_window &&
            this._focusWindow == global.display.focus_window.get_compositor_private())
            return;

        this.signals.disconnect("position-changed");
        this.signals.disconnect("size-changed");

        if (!global.display.focus_window)
            return;

        this._focusWindow = global.display.focus_window.get_compositor_private();
        this.signals.connect(this._focusWindow, "position-changed", Lang.bind(this, this._onPositionChanged));
        this.signals.connect(this._focusWindow, "size-changed", Lang.bind(this, this._onPositionChanged));
        this._onPositionChanged();
    },

    _onPositionChanged: function() {
        let button = this.buttons[global.screen.get_active_workspace_index()];
        button.update();
    },

    on_applet_removed_from_panel: function() {
        this.signals.disconnectAllSignals();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
