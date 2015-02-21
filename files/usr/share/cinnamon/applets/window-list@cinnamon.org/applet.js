const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;
const Meta = imports.gi.Meta;
const Tooltips = imports.ui.tooltips;
const DND = imports.ui.dnd;
const Mainloop = imports.mainloop;
const Gdk = imports.gi.Gdk;

const PANEL_ICON_SIZE = 24; // this is for the spinner when loading
const DEFAULT_ICON_SIZE = 16; // too bad this can't be defined in theme (cinnamon-app.create_icon_texture returns a clutter actor, not a themable object -
                              // probably something that could be addressed
const SPINNER_ANIMATION_TIME = 1;
const ICON_HEIGHT_FACTOR = .64;

/* TODO: dragHelper will need to be reworked once more flexible panel configuration is merged */

function dragHelper() {
    this._init();
}

dragHelper.prototype = {
    _init: function() {
        this.dragging = false;
        this.panel_show_id = 0;
    },

    temp_show_panels: function() {
        if (Main.panel && !this.dragging)
            Main.panel._enterPanel();
        if (Main.panel2 && !this.dragging)
            Main.panel2._enterPanel();
        if (this.panel_show_id > 0) {
            Mainloop.source_remove(this.panel_show_id);
            this.panel_show_id = 0;
        }
        this.dragging = true;
        this.panel_show_id = Mainloop.timeout_add(2000, Lang.bind(this, this.temp_unshow_panels));
    },

    temp_unshow_panels: function() {
        if (Main.panel)
            Main.panel._leavePanel();
        if (Main.panel2)
            Main.panel2._leavePanel();
        this.dragging = false;
        this.panel_show_id = 0;
        return false;
    }
}

let drag_helper = new dragHelper();

function AppMenuButtonRightClickMenu(launcher, metaWindow, orientation) {
    this._init(launcher, metaWindow, orientation);
}

AppMenuButtonRightClickMenu.prototype = {
    __proto__: Applet.AppletPopupMenu.prototype,

    _init: function(launcher, metaWindow, orientation) {
        Applet.AppletPopupMenu.prototype._init.call(this, launcher, orientation);
        
        this.window_list = launcher.actor._delegate._applet._windows;
        launcher.actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
        this.connect('open-state-changed', Lang.bind(this, this._onToggled));

        this.orientation = orientation;
        this.metaWindow = metaWindow;
    },

    _populateMenu: function(){
        let mw = this.metaWindow;
        let itemCloseWindow = new PopupMenu.PopupMenuItem(_("Close"));
        itemCloseWindow.connect('activate', Lang.bind(this, this._onCloseWindowActivate));

        let itemCloseAllWindows = new PopupMenu.PopupMenuItem(_("Close all"));
        itemCloseAllWindows.connect('activate', Lang.bind(this, this._onCloseAllActivate));

        let itemCloseOtherWindows = new PopupMenu.PopupMenuItem(_("Close others"));
        itemCloseOtherWindows.connect('activate', Lang.bind(this, this._onCloseOthersActivate));

        let itemMinimizeWindow = new PopupMenu.PopupMenuItem(mw.minimized ? _("Restore") : _("Minimize"));
        itemMinimizeWindow.connect('activate', Lang.bind(this, this._onMinimizeWindowActivate));

        let itemMaximizeWindow = new PopupMenu.PopupMenuItem(mw.get_maximized() ? _("Unmaximize") : _("Maximize"));
        itemMaximizeWindow.connect('activate', Lang.bind(this, this._onMaximizeWindowActivate));
        
        let itemMoveToLeftWorkspace = new PopupMenu.PopupMenuItem(_("Move to left workspace"));
        itemMoveToLeftWorkspace.connect('activate', Lang.bind(this, this._onMoveToLeftWorkspace));
        
        let itemMoveToRightWorkspace = new PopupMenu.PopupMenuItem(_("Move to right workspace"));
        itemMoveToRightWorkspace.connect('activate', Lang.bind(this, this._onMoveToRightWorkspace));
        
        let itemOnAllWorkspaces = new PopupMenu.PopupMenuItem(_("Visible on all workspaces"));
        itemOnAllWorkspaces.connect('activate', Lang.bind(this, this._toggleOnAllWorkspaces));

        let itemRestoreOpacity = new PopupMenu.PopupMenuItem(_("Restore to full opacity"));
        itemRestoreOpacity.connect('activate', Lang.bind(this, this._onRestoreOpacity));

        if (this.metaWindow.get_compositor_private().opacity == 255) {
            itemRestoreOpacity.actor.hide()
        }

        if (mw.is_on_all_workspaces()) {
            itemOnAllWorkspaces.label.set_text(_("Only on this workspace"));
            itemMoveToLeftWorkspace.actor.hide();
            itemMoveToRightWorkspace.actor.hide();
        } else {
            itemOnAllWorkspaces.label.set_text(_("Visible on all workspaces"));
            if (mw.get_workspace().get_neighbor(Meta.MotionDirection.LEFT) != mw.get_workspace())
                itemMoveToLeftWorkspace.actor.show();
            else
                itemMoveToLeftWorkspace.actor.hide();

            if (mw.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT) != mw.get_workspace())
                itemMoveToRightWorkspace.actor.show();
            else
                itemMoveToRightWorkspace.actor.hide();
        }

        let monitorItems = [];
        if (Main.layoutManager.monitors.length > 1) {
            Main.layoutManager.monitors.forEach(function(monitor, index) {
                if (index !== mw.get_monitor()) {
                    let itemChangeMonitor = new PopupMenu.PopupMenuItem(
                        _("Move to monitor %d").format(index + 1));
                    itemChangeMonitor.connect('activate', Lang.bind(this, function() {
                        mw.move_to_monitor(index);
                    }));
                    monitorItems.push(itemChangeMonitor);
                }
            }, this);
            monitorItems.push(new PopupMenu.PopupSeparatorMenuItem());
        }

        let items = monitorItems.concat([
            itemOnAllWorkspaces,
            itemMoveToLeftWorkspace,
            itemMoveToRightWorkspace,
            new PopupMenu.PopupSeparatorMenuItem(),
            itemCloseAllWindows,
            itemCloseOtherWindows,
            new PopupMenu.PopupSeparatorMenuItem(),
            itemRestoreOpacity,
            itemMinimizeWindow,
            itemMaximizeWindow,
            itemCloseWindow
        ]);
        (this.orientation == St.Side.BOTTOM ? items : items.reverse()).forEach(function(item) {
            this.addMenuItem(item);
        }, this);
    },

    _onRestoreOpacity: function(actor, event) {
        this.metaWindow.get_compositor_private().set_opacity(255);
    },

    _onToggled: function(actor, isOpening){
        if (!isOpening) {
            return;
        }
        this.removeAll();
        this._populateMenu();
    },
    
    _onCloseWindowActivate: function(actor, event){
        this.metaWindow.delete(global.get_current_time());
    },

    _onCloseAllActivate: function(actor, event) {
        let metas = new Array();
        for (let i = 0; i < this.window_list.length; i++) {
            if (this.window_list[i].actor.visible && !this.window_list[i]._needsAttention) {
                metas.push(this.window_list[i].metaWindow);
            }
        }
        metas.forEach(Lang.bind(this, function(window) {
            window.delete(global.get_current_time());
            }));
    },

    _onCloseOthersActivate: function(actor, event) {
        let metas = new Array();
        for (let i = 0; i < this.window_list.length; i++) {
            if (this.window_list[i].metaWindow != this.metaWindow &&
                                this.window_list[i].actor.visible &&
                                !this.window_list[i]._needsAttention) {
                metas.push(this.window_list[i].metaWindow);
            }
        }
        metas.forEach(Lang.bind(this, function(window) {
            window.delete(global.get_current_time());
            }));
    },

    _onMinimizeWindowActivate: function(actor, event){
        if (this.metaWindow.minimized) {
            this.metaWindow.unminimize(global.get_current_time());
            Main.activateWindow(this.metaWindow, global.get_current_time());
        }
        else {
            this.metaWindow.minimize(global.get_current_time());
        }
    },

    _onMaximizeWindowActivate: function(actor, event){      
        if (this.metaWindow.get_maximized()){
            this.metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }else{
            this.metaWindow.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }
    },

    _moveToWorkspace: function(direction){
        let metaWindow = this.metaWindow;
        let workspace = metaWindow.get_workspace().get_neighbor(direction);
        if (workspace) {
            // The workspace change may cause this object to be destroyed
            // in the middle of the function, so let the action be carried
            // out a bit later.
            Mainloop.timeout_add(0, function() {
                metaWindow.change_workspace(workspace);
            });
        }
    },
    
    _onMoveToLeftWorkspace: function(actor, event){
        this._moveToWorkspace(Meta.MotionDirection.LEFT);
    },

    _onMoveToRightWorkspace: function(actor, event){
        this._moveToWorkspace(Meta.MotionDirection.RIGHT);
    },

    _toggleOnAllWorkspaces: function(actor, event) {
        if (this.metaWindow.is_on_all_workspaces())
            this.metaWindow.unstick();
        else
            this.metaWindow.stick();
    },

    _onSourceKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen)
                this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;
    }

};

function AppMenuButton(applet, metaWindow, animation, orientation, panel_height, draggable) {
    this._init(applet, metaWindow, animation, orientation, panel_height, draggable);
}

AppMenuButton.prototype = {
//    __proto__ : AppMenuButton.prototype,

    
    _init: function(applet, metaWindow, animation, orientation, panel_height, draggable) {
               
        this.actor = new St.Bin({ style_class: 'window-list-item-box',
								  reactive: true,
								  can_focus: true,
								  x_fill: true,
								  y_fill: false,
								  track_hover: true });
								  
        if (orientation == St.Side.TOP) 
	        this.actor.add_style_class_name('window-list-item-box-top');
        else
	        this.actor.add_style_class_name('window-list-item-box-bottom');
      
        this.actor._delegate = this;
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
		this.metaWindow = metaWindow;	

        this._applet = applet;
        let bin = new St.Bin({ name: 'appMenu' });
        this.actor.set_child(bin);

        this._container = new Cinnamon.GenericContainer();
        bin.set_child(this._container);
        this._container.connect('get-preferred-width',
								Lang.bind(this, this._getContentPreferredWidth));
        this._container.connect('get-preferred-height',
								Lang.bind(this, this._getContentPreferredHeight));
        this._container.connect('allocate', Lang.bind(this, this._contentAllocate));

        
        this._iconBox = new Cinnamon.Slicer({ name: 'appMenuIcon' });
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClip));
        this._container.add_actor(this._iconBox);
        this._label = new St.Label();
        this._container.add_actor(this._label);

        this._iconBottomClip = 0;
    	this._visible = true;

        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
        
        this._updateCaptionId = this.metaWindow.connect('notify::title', Lang.bind(this, function () {
            let title = this.getDisplayTitle();
            this._label.set_text(title);
            if (this._tooltip) this._tooltip.set_text(title);
        }));

        this._updateTileTypeId = this.metaWindow.connect('notify::tile-type', Lang.bind(this, function () {
            let title = this.getDisplayTitle();
            this._label.set_text(title);
            if (this._tooltip) this._tooltip.set_text(title);
        }));
        

        this._spinner = new Panel.AnimatedIcon('process-working.svg', PANEL_ICON_SIZE);
        this._container.add_actor(this._spinner.actor);
        this._spinner.actor.lower_bottom();
        
        this.set_icon(panel_height);
        let title = this.getDisplayTitle();
        this._label.set_text(title);        
        
        if(animation){
			this.startAnimation(); 
			this.stopAnimation();
		}

        this._tooltip = new Tooltips.PanelItemTooltip(this, title, orientation);

        if (draggable) {
            //set up the right click menu
            this._menuManager = new PopupMenu.PopupMenuManager(this);
            this.rightClickMenu = new AppMenuButtonRightClickMenu(this, this.metaWindow, orientation);
            this._menuManager.addMenu(this.rightClickMenu);

            this._draggable = DND.makeDraggable(this.actor);
            this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
            this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
            this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));
        } else {
            this._draggable = null;
        }

        this._inEditMode = undefined;
        this.on_panel_edit_mode_changed();
        global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
        global.settings.connect('changed::window-list-applet-scroll', Lang.bind(this, this.on_scroll_mode_changed));
        this.window_list = this.actor._delegate._applet._windows;
        this.alert_list = this.actor._delegate._applet._alertWindows;
        this.scroll_connector = null;
        this.on_scroll_mode_changed();
        this._needsAttention = false;
    },
    
    on_panel_edit_mode_changed: function() {
        if (this._draggable) {
            this._inEditMode = this._draggable.inhibit = global.settings.get_boolean("panel-edit-mode");
        }
    }, 

    on_scroll_mode_changed: function() {
        let scrollable = global.settings.get_boolean("window-list-applet-scroll");
        if (scrollable) {
            this.scroll_connector = this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
        } else {
            if (this.scroll_connector) {
                this.actor.disconnect(this.scroll_connector);
                this.scroll_connector = null;
            }
        }
    },

    _onScrollEvent: function(actor, event) {
        let direction = event.get_scroll_direction();
        let current;
        let vis_windows = new Array();
        for (let i = 0; i < this.window_list.length; i++) {
            if (this.window_list[i].actor.visible) {
                vis_windows.push(i);
            }
        }
        let num_windows = vis_windows.length;
        for (let i = 0; i < num_windows; i++) {
            if (this.window_list[vis_windows[i]].metaWindow.has_focus()) {
                current = i;
                break;
            }
        }
        let target;
        if (direction == 0) {
            target = ((current - 1) >= 0) ? (current - 1) : (num_windows - 1);
        }
        if (direction == 1) {
            target = ((current + 1) <= num_windows - 1) ? (current + 1) : 0;
        }
        Main.activateWindow(this.window_list[vis_windows[target]].metaWindow, global.get_current_time());
    },

    _onDragBegin: function() {
        this._tooltip.hide();
        this._tooltip.preventShow = true;
    },

    _onDragEnd: function() {
        this._applet.myactorbox._clearDragPlaceholder();
        this._tooltip.preventShow = false;
    },

    _onDragCancelled: function() {
        this._applet.myactorbox._clearDragPlaceholder();
        this._tooltip.preventShow = false;
    },

    getDisplayTitle: function() {
        let title = this.metaWindow.get_title();
        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(this.metaWindow);
        if (!title) title = app ? app.get_name() : '?';

        if (this.metaWindow.minimized) {
            return "["+ title +"]";                        
        }                    
        else if (this.metaWindow.tile_type == Meta.WindowTileType.TILED) {
            return "|"+ title;
        }
        else if (this.metaWindow.tile_type == Meta.WindowTileType.SNAPPED) {
            return "||"+ title;
        }
        else {
            return title;
        }        
    },

    _onDestroy: function() {
        this.metaWindow.disconnect(this._updateCaptionId);
        this.metaWindow.disconnect(this._updateTileTypeId);        
        this._tooltip.destroy();
        if (this.rightClickMenu) {
            this.rightClickMenu.destroy();
        }
    },
    
    _hasFocus: function(metaWindow) {
        if (metaWindow.has_focus()) {
            return true;
        }
        let transientHasFocus = false;
        metaWindow.foreach_transient(function(transient) {
            if (transient.has_focus()) {
                transientHasFocus = true;
                return false;
            }
            return true;
        }); 
        return transientHasFocus;
    },
    
    doFocus: function() {
        if (this._hasFocus(this.metaWindow) && !this.metaWindow.minimized) {
            this.actor.add_style_pseudo_class('focus');
            this.actor.remove_style_class_name("window-list-item-demands-attention");
            this.actor.remove_style_class_name("window-list-item-demands-attention-top");
            this._needsAttention = false;
            this._removeAlerts(this.metaWindow);
        } else {
            this.actor.remove_style_pseudo_class('focus');
        }
    },

    _onButtonRelease: function(actor, event) {
        this._tooltip.hide();
        if (!this._draggable) {
            /* non-draggable = off-workspace window demanding attention
               the only action for these is activation */
            if (event.get_button() == 1) {
                this._windowHandle(false);
            }
            return false;
        }
        if (event.get_button() == 1) {
            if ( this.rightClickMenu.isOpen ) {
                this.rightClickMenu.toggle();
            }
            this._windowHandle(false);
        } else if (event.get_button() == 2)
            this.metaWindow.delete(global.get_current_time());
        return true;
    },

    _onButtonPress: function(actor, event) {
        this._tooltip.hide();
        if (!this._draggable) {
            return false;
        }
        if (event.get_button() == 3) {
            this.rightClickMenu.mouseEvent = event;
            this.rightClickMenu.toggle();
            return true;
        }
        return false;
    },

    _windowHandle: function(fromDrag){
        let has_focus = this.metaWindow.has_focus();
        if (!this.metaWindow.minimized && !has_focus) {
            this.metaWindow.foreach_transient(function(child) {
                if (!child.minimized && child.has_focus()) {
                    has_focus = true;
                }
            });
        }
        if ( has_focus ) {
            if (fromDrag){
                return;
            }
            this.metaWindow.minimize(global.get_current_time());
            this.actor.remove_style_pseudo_class('focus');
        }
        else {
            if (this.metaWindow.minimized) {
                this.metaWindow.unminimize(global.get_current_time()); 
            }
            let ws = this.metaWindow.get_workspace().index()
            if (ws != global.screen.get_active_workspace_index()) {
                global.screen.get_workspace_by_index(ws).activate(global.get_current_time());
            }
            Main.activateWindow(this.metaWindow, global.get_current_time());
            this.actor.add_style_pseudo_class('focus');
            this._removeAlerts(this.metaWindow);
        }
    },

    _removeAlerts: function(metaWindow) {
        for (let i = 0; i < this.alert_list.length; i++) {
            if (metaWindow == this.alert_list[i].metaWindow) {
                let alert = this.alert_list[i];
                if (alert.actor.get_parent()) {
                    alert.actor.get_parent().remove_actor(alert.actor);
                }
                alert.actor.destroy();
                this.alert_list.splice(i, 1);
            }
        }
    },

    handleDragOver: function(source, actor, x, y, time) {
        if (this._inEditMode) return DND.DragMotionResult.MOVE_DROP;
        if (source instanceof AppMenuButton) return DND.DragMotionResult.CONTINUE;
        drag_helper.temp_show_panels();
        if (typeof(this._applet.dragEnterTime) == 'undefined') {
            this._applet.dragEnterTime = time;
        } else {
            if (time > (this._applet.dragEnterTime + 3000))
            {
                this._applet.dragEnterTime = time;
            }
        }
        if (time > (this._applet.dragEnterTime + 300)) {
            this._windowHandle(true);
        }
        return DND.DragMotionResult.NO_DROP;
    },
    
    acceptDrop: function(source, actor, x, y, time) {
        return false;
    },
    
    show: function() {
        if (this._visible)
            return;
        this._visible = true;
        this.actor.show();
    },

    hide: function() {
        if (!this._visible)
            return;
        this._visible = false;
        this.actor.hide();
    },

    _onIconBoxStyleChanged: function() {
        let node = this._iconBox.get_theme_node();
        this._iconBottomClip = node.get_length('app-icon-bottom-clip');
        this._updateIconBoxClip();
    },

    _updateIconBoxClip: function() {
        let allocation = this._iconBox.allocation;
       if (this._iconBottomClip > 0)
           this._iconBox.set_clip(0, 0,
                                 allocation.x2 - allocation.x1,
                                   allocation.y2 - allocation.y1 - this._iconBottomClip);
        else
            this._iconBox.remove_clip();
    },

    stopAnimation: function() {
        Tweener.addTween(this._spinner.actor,
                         { opacity: 0,
                           time: SPINNER_ANIMATION_TIME,
                           transition: "easeOutQuad",
                           onCompleteScope: this,
                           onComplete: function() {
                               this._spinner.actor.opacity = 255;
                               this._spinner.actor.hide();
                           }
                         });
    },

    startAnimation: function() {
        this._spinner.actor.show();
    },

    _getContentPreferredWidth: function(actor, forHeight, alloc) {
        let [minSize, naturalSize] = this._iconBox.get_preferred_width(forHeight);
        alloc.min_size = minSize; // minimum size just enough for icon if we ever get that many apps going
        alloc.natural_size = naturalSize;
        [minSize, naturalSize] = this._label.get_preferred_width(forHeight);
	alloc.min_size = alloc.min_size + Math.max(0, minSize - Math.floor(alloc.min_size / 2));
        alloc.natural_size = 150 * global.ui_scale;
    },

    _getContentPreferredHeight: function(actor, forWidth, alloc) {
        let [minSize, naturalSize] = this._iconBox.get_preferred_height(forWidth);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
        [minSize, naturalSize] = this._label.get_preferred_height(forWidth);
        if (minSize > alloc.min_size)
            alloc.min_size = minSize;
        if (naturalSize > alloc.natural_size)
            alloc.natural_size = naturalSize;
    },

    _contentAllocate: function(actor, box, flags) {
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;
        let childBox = new Clutter.ActorBox();

        let [minWidth, minHeight, naturalWidth, naturalHeight] = this._iconBox.get_preferred_size();

        let direction = this.actor.get_text_direction();

        let yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);
        if (direction == Clutter.TextDirection.LTR) {
            childBox.x1 = 3;
            childBox.x2 = childBox.x1 + Math.min(naturalWidth, allocWidth);
        } else {
            childBox.x1 = Math.max(0, allocWidth - naturalWidth);
            childBox.x2 = allocWidth;
        }
        this._iconBox.allocate(childBox, flags);

        let iconWidth = this.iconSize * global.ui_scale;

        [minWidth, minHeight, naturalWidth, naturalHeight] = this._label.get_preferred_size();

        yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);

        if (direction == Clutter.TextDirection.LTR) {
            childBox.x1 = Math.floor(iconWidth + 5);
            childBox.x2 = Math.min(childBox.x1 + naturalWidth, allocWidth);
        } else {
            childBox.x2 = allocWidth - Math.floor(iconWidth + 3);
            childBox.x1 = Math.max(0, childBox.x2 - naturalWidth);
        }
        this._label.allocate(childBox, flags);

        if (direction == Clutter.TextDirection.LTR) {
            childBox.x1 = Math.floor(iconWidth / 2) + this._label.width;
            childBox.x2 = childBox.x1 + this._spinner.actor.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
            this._spinner.actor.allocate(childBox, flags);
        } else {
            childBox.x1 = -this._spinner.actor.width;
            childBox.x2 = childBox.x1 + this._spinner.actor.width;
            childBox.y1 = box.y1;
            childBox.y2 = box.y2 - 1;
            this._spinner.actor.allocate(childBox, flags);
        }
    },
    
    getDragActor: function() {
        let clone = new Clutter.Clone({ source: this.actor });
        clone.width = this.actor.width;
        clone.height = this.actor.height;
        return clone;
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    },

    set_icon: function(panel_height) {
      let tracker = Cinnamon.WindowTracker.get_default();
      let app = tracker.get_window_app(this.metaWindow);

      if (this._applet._scaleMode) {
        this.iconSize = Math.round(panel_height * ICON_HEIGHT_FACTOR / global.ui_scale);
      }
      else {
        this.iconSize = DEFAULT_ICON_SIZE;
      }
      let icon = app ?
                            app.create_icon_texture(this.iconSize) :
                            new St.Icon({ icon_name: 'application-default-icon',
                                         icon_type: St.IconType.FULLCOLOR,
                                         icon_size: this.iconSize });


      let old_child = this._iconBox.get_child();
      this._iconBox.set_child(icon);
      if (old_child != null) { 
        old_child.destroy();
      }      
    },

    getAttention: function() {
        if (this._needsAttention) {
            return false;
        }
        this._needsAttention = true;
        let counter = 0;
        this._flashButton(counter);
        return true;
    },

    _flashButton: function(counter) {
        if (!this._needsAttention) {
            return;
        }
        this.actor.add_style_class_name("window-list-item-demands-attention");
        if (counter < 4) {
            Mainloop.timeout_add(500, Lang.bind(this, function () {
                if (this.actor.has_style_class_name("window-list-item-demands-attention")) {
                    this.actor.remove_style_class_name("window-list-item-demands-attention");
                }
                Mainloop.timeout_add(500, Lang.bind(this, function () {
                    this._flashButton(++counter)
                }));
            }));
        }
    }
};

function MyAppletBox(applet) {
    this._init(applet);
}

MyAppletBox.prototype = {
    _init: function(applet) {
        this.actor = new St.BoxLayout({ name: 'windowList',
                                        style_class: 'window-list-box' });
        this.actor._delegate = this;
        
        this._applet = applet;
        
        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;
    },
    
    handleDragOver: function(source, actor, x, y, time) {
        if (this._inEditMode) return DND.DragMotionResult.MOVE_DROP;
        if (!(source instanceof AppMenuButton))  {
            drag_helper.temp_show_panels();
            return DND.DragMotionResult.NO_DROP;
        }

        let children = this.actor.get_children();
        let windowPos = children.indexOf(source.actor);
        
        let pos = 0;
        
        for (var i in children){
            if (x > children[i].get_allocation_box().x1 + children[i].width / 2) pos = i;
        }
        
        if (pos != this._dragPlaceholderPos) {            
            this._dragPlaceholderPos = pos;

            // Don't allow positioning before or after self
            if (windowPos != -1 && pos == windowPos) {
                if (this._dragPlaceholder) {
                    this._dragPlaceholder.animateOutAndDestroy();
                    this._animatingPlaceholdersCount++;
                    this._dragPlaceholder.actor.connect('destroy',
                        Lang.bind(this, function() {
                            this._animatingPlaceholdersCount--;
                        }));
                }
                this._dragPlaceholder = null;

                return DND.DragMotionResult.CONTINUE;
            }

            // If the placeholder already exists, we just move
            // it, but if we are adding it, expand its size in
            // an animation
            let fadeIn;
            if (this._dragPlaceholder) {
                this._dragPlaceholder.actor.destroy();
                fadeIn = false;
            } else {
                fadeIn = true;
            }

            this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
            this._dragPlaceholder.child.set_width (source.actor.width);
            this._dragPlaceholder.child.set_height (source.actor.height);
            this.actor.insert_actor(this._dragPlaceholder.actor,
                                        this._dragPlaceholderPos);
            if (fadeIn)
                this._dragPlaceholder.animateIn();
        }
        
        return DND.DragMotionResult.MOVE_DROP;
    },
    
    acceptDrop: function(source, actor, x, y, time) {  
        if (!(source instanceof AppMenuButton)) return false;
        
        this.actor.move_child(source.actor, this._dragPlaceholderPos);
        
        this._clearDragPlaceholder();
        actor.destroy();
        
        return true;
    },
    
    _clearDragPlaceholder: function() {        
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    }
}

function MyAppletAlertBox(applet) {
    this._init(applet);
}

MyAppletAlertBox.prototype = {
    _init: function(applet) {
        this.actor = new St.BoxLayout({ name: 'windowList',
                                        style_class: 'window-list-box' });
        this.actor._delegate = this;
        this._applet = applet;
    },
}

function AppletSignals(appletObj) {
    this._init(appletObj);
}

AppletSignals.prototype = {
    _init: function(appletObj) {
        this.appletObj = appletObj;
        this.storage = {};
    },

    connect: function(obj, sig_name, callback) {
        let id = obj.connect(sig_name, Lang.bind(this.appletObj, callback));
        this.storage[sig_name] = [obj, id];
    },

    disconnect: function(sig_name) {
        let [obj, id] = this.storage[sig_name];
        obj.disconnect(id);
        delete this.storage[sig_name];
    },

    disconnect_all_signals: function() {
        for (let sig_name in this.storage) {
            this.disconnect(sig_name);
        }
    }
}

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation, panel_height, instance_id) {        
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.actor.set_track_hover(false);
        try {                    
            this.orientation = orientation;
            this.dragInProgress = false;

            this.myactorbox = new MyAppletBox(this);
            this.leftAlertBox = new MyAppletAlertBox(this);
            this.rightAlertBox = new MyAppletAlertBox(this);

            this.myactor = this.myactorbox.actor;

            this.actor.add(this.leftAlertBox.actor);
            this.actor.add(this.myactor);
            this.actor.add(this.rightAlertBox.actor);

            this.actor.reactive = global.settings.get_boolean("panel-edit-mode");
            this.on_orientation_changed(orientation);

            this._windows = new Array();
            this._alertWindows = new Array();

            this.signals = new AppletSignals(this);

            let tracker = Cinnamon.WindowTracker.get_default();

            this.monitor_watch_list = []

            this.signals.connect(tracker, "notify::focus-app", this._onFocus);
            this.signals.connect(global.screen.get_display(), "notify::focus-window", this._onFocusWindow);
            this.signals.connect(global.screen, 'window-entered-monitor', this._windowEnteredMonitor);
            this.signals.connect(global.screen, 'window-left-monitor', this._windowLeftMonitor);
            this.signals.connect(global.screen, 'notify::n-workspaces', this._changeWorkspaces);
            this.signals.connect(global.screen, 'monitors-changed', this._monitorLayoutChanged);
            this.signals.connect(global.window_manager, 'switch-workspace',this._refreshItems);
            this.signals.connect(global.window_manager, 'minimize', this._onWindowStateChange);
            this.signals.connect(global.window_manager, 'maximize', this._onWindowStateChange);
            this.signals.connect(global.window_manager, 'unmaximize', this._onWindowStateChange);
            this.signals.connect(global.window_manager, 'map', this._onWindowStateChange);
            this.signals.connect(global.window_manager, 'tile', this._onWindowStateChange);
            this.signals.connect(global.settings, "changed::window-list-applet-alert", this._updateAttentionGrabber);
            this.signals.connect(global.settings, "changed::panel-edit-mode", this.on_panel_edit_mode_changed);

            this._workspaces = [];
            this._changeWorkspaces();

            this._urgent_signal = null;
            this._updateAttentionGrabber();
            // this._container.connect('allocate', Lang.bind(Main.panel, this._allocateBoxes)); 
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_removed_from_panel: function() {
        this.signals.disconnect_all_signals();
    },

    on_applet_added_to_panel: function() {
        this._updateMonitorsWatched();
    },

    on_applet_instances_changed: function() {
        this.monitor_watch_list = this._updateMonitorsWatched();

        this._update_watched_windows();
    },

    _monitorLayoutChanged: function() {
        this.monitor_watch_list = this._updateMonitorsWatched();

        this._update_watched_windows();
    },

    _update_watched_windows: function() {
        let windows = global.display.list_windows(0);

        for (let i in windows) {
            if (this._shouldAdd(windows[i]))
                this._addWindow(windows[i]);
            else
                this._removeWindow(windows[i]);
        }
    },

    on_orientation_changed: function(orientation) {
        let box_list = this.actor.get_children();
        if (orientation == St.Side.TOP) {
            for (let i = 0; i < box_list.length; i++) {
                box_list[i].add_style_class_name('window-list-box-top');
                box_list[i].set_style('margin-top: 0px;');
                box_list[i].set_style('padding-top: 0px;');
            }
            this.actor.set_style('margin-top: 0px;');
            this.actor.set_style('padding-top: 0px;');
        }
        else {
            for (let i = 0; i < box_list.length; i++) {
                box_list[i].add_style_class_name('window-list-box-bottom');
                box_list[i].set_style('margin-bottom: 0px;');
                box_list[i].set_style('padding-bottom: 0px;');
            }
            this.actor.set_style('margin-bottom: 0px;');
            this.actor.set_style('padding-bottom: 0px;');
        }
    },

    _updateAttentionGrabber: function() {
        let active = global.settings.get_boolean('window-list-applet-alert');
        if (active) {
            this._urgent_signal = global.display.connect('window-marked-urgent', Lang.bind(this, this._onWindowDemandsAttention));
        } else {
            if (this._urgent_signal) {
                global.display.disconnect(this._urgent_signal);
            }
        }
    },

    on_applet_clicked: function(event) {
    },

    on_panel_edit_mode_changed: function() {
        this.actor.reactive = global.settings.get_boolean("panel-edit-mode");
    }, 

    _onWindowDemandsAttention : function(display, window) {
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == window ) {
                if (this._windows[i].actor._delegate.getAttention()) {
                    this._alertWindows = this._alertWindows.filter(function(alertWindow) {
                        return alertWindow.metaWindow != window; // we don't want duplicates
                    }, this);
                    let alertButton = new AppMenuButton(this, window, true, this.orientation, this._panelHeight, false);
                    this._alertWindows.push(alertButton);
                    this.calculate_alert_positions();
                }
                return;
            }
        }
    },

    _clean_alert_boxes: function() {
        let left_box_items = this.leftAlertBox.actor.get_children();
        for (let i = 0; i < left_box_items.length; i++) {
            this.leftAlertBox.actor.remove_actor(left_box_items[i]);
        }
        let right_box_items = this.rightAlertBox.actor.get_children();
        for (let i = 0; i < right_box_items.length; i++) {
            this.rightAlertBox.actor.remove_actor(right_box_items[i]);
        }
    },

    calculate_alert_positions: function() {
        this._clean_alert_boxes();

        // purge destroyed alert windows
        this._alertWindows = this._alertWindows.filter(function(alertWindow) {
            return alertWindow.metaWindow.get_workspace() != null;
        }, this);

        let cur_ws_index = global.screen.get_active_workspace_index();

        for (let i = 0; i < this._alertWindows.length; i++ ) {
            let window_ws_index = this._alertWindows[i].metaWindow.get_workspace().index();
            if (window_ws_index < cur_ws_index) {
                this.leftAlertBox.actor.add(this._alertWindows[i].actor);
            } else if (window_ws_index > cur_ws_index) {
                this.rightAlertBox.actor.add(this._alertWindows[i].actor);
            }
            if (!this._alertWindows[i]._needsAttention) {
                this._alertWindows[i].getAttention();
            }
        }
    },

    _onFocus: function() {        
        for ( let i = 0; i < this._windows.length; ++i ) {
            let window = this._windows[i];                        
            window.set_icon(this._panelHeight);
            window.doFocus();
        }
    },

    _onFocusWindow: function(display) {
        let currentWindow = display.focus_window;
        if (currentWindow && this._alertWindows.length) {
            this._alertWindows = this._alertWindows.filter(function(alertWindow) {
                return alertWindow.metaWindow != currentWindow;
            }, this);
            this.calculate_alert_positions();
        }
    },

    on_panel_height_changed: function() {
        this._refreshItems();
    },
    
    _refreshItems: function() {
        for ( let i = 0; i < this._windows.length; ++i ) {
            let metaWindow = this._windows[i].metaWindow;
            if (metaWindow.get_workspace().index() == global.screen.get_active_workspace_index()
                      || metaWindow.is_on_all_workspaces())
                this._windows[i].actor.show();
            else
                this._windows[i].actor.hide();
        }
        this.calculate_alert_positions();
        this._onFocus();
    },

    _onWindowStateChange: function(cinnamonwm, actor) {
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == actor.get_meta_window() ) {
                let windowReference = this._windows[i];
                let title = windowReference.getDisplayTitle();
                windowReference._label.set_text(title);                
            }
        }
    },
       
    getOriginFromWindow: function(metaWindow) {
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == metaWindow ) {
                return this._windows[i].actor;
            }
        }

        return false;
    },

    _updateMonitorsWatched: function() {
        let n_mons = Gdk.Screen.get_default().get_n_monitors();
        let on_primary = this.panel.monitorIndex == Main.layoutManager.primaryIndex;
        let instances = Main.AppletManager.getRunningInstancesForUuid(this._uuid);

        let watch_list = [];

        /* Simple cases */
        if (n_mons == 1) {
            return [Main.layoutManager.primaryIndex];
        }

        if (instances.length > 1 && !on_primary)
            return [this.panel.monitorIndex];

        /* Only an instance on the primary monitor should get this far -
         * it will be responsible for any monitors not covered individually */

        for (let i = 0; i < n_mons; i++) {
            watch_list.push(i);
        }

        /* If we're the only instance, watch all monitors */

        if (instances.length == 1)
            return watch_list;

        /* Otherwise, subtract the monitors that are individually covered */

        for (let i in instances) {
            if (instances[i] == this)
                continue;
            let i_monitor = instances[i].panel.monitorIndex;
            let idx = watch_list.indexOf(i_monitor);
            if (idx != -1) {
                watch_list.splice(idx, 1);
            }
        }

        return watch_list;

    },

    _addWindow: function(metaWindow) {
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == metaWindow ) {
                return;
            }
        }

        let appbutton = new AppMenuButton(this, metaWindow, true, this.orientation, this._panelHeight, true);
        this._windows.push(appbutton);
        this.myactor.add(appbutton.actor);
        if (global.screen.get_active_workspace() != metaWindow.get_workspace())
            appbutton.actor.hide();
    },

    _removeWindow: function(metaWindow) {
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == metaWindow ) {
                this.myactor.remove_actor(this._windows[i].actor);
                this._windows[i].actor.destroy();
                this._windows.splice(i, 1);
                break;
            }
        }
    },

    _shouldAdd: function(metaWindow) {
        if (!Main.isInteresting(metaWindow))
            return false;

        if (this.monitor_watch_list.indexOf(metaWindow.get_monitor()) == -1)
            return false;

        return true;
    },

    _windowAdded: function(metaWorkspace, metaWindow) {
        if (this._shouldAdd(metaWindow))
            this._addWindow(metaWindow);

        this.calculate_alert_positions();
    },

    _windowRemoved: function(metaWorkspace, metaWindow) {
        this._removeWindow(metaWindow);

        this.calculate_alert_positions();
    },

    _windowEnteredMonitor: function(screen, monitor, metaWindow) {
        if (this._shouldAdd(metaWindow))
            this._addWindow(metaWindow);

        this.calculate_alert_positions();
    },

    _windowLeftMonitor: function(screen, monitor, metaWindow) {
        this._removeWindow(metaWindow);

        this.calculate_alert_positions();
    },

    _changeWorkspaces: function() {
        for ( let i=0; i<this._workspaces.length; ++i ) {
            let ws = this._workspaces[i];
            ws.disconnect(ws._windowAddedId);
            ws.disconnect(ws._windowRemovedId);
        }

        this._workspaces = [];
        for ( let i=0; i<global.screen.n_workspaces; ++i ) {
            let ws = global.screen.get_workspace_by_index(i);
            this._workspaces[i] = ws;
            ws._windowAddedId = ws.connect('window-added',
                                    Lang.bind(this, this._windowAdded));
            ws._windowRemovedId = ws.connect('window-removed',
                                    Lang.bind(this, this._windowRemoved));
        }
    },
    
    _allocateBoxes: function(container, box, flags) {	
		let allocWidth = box.x2 - box.x1;
		let allocHeight = box.y2 - box.y1;
		let [leftMinWidth, leftNaturalWidth] = this._leftBox.get_preferred_width(-1);
		let [centerMinWidth, centerNaturalWidth] = this._centerBox.get_preferred_width(-1);
		let [rightMinWidth, rightNaturalWidth] = this._rightBox.get_preferred_width(-1);

		let sideWidth, centerWidth;
		centerWidth = centerNaturalWidth;
		sideWidth = (allocWidth - centerWidth) / 2;

		let childBox = new Clutter.ActorBox();

		childBox.y1 = 0;
		childBox.y2 = allocHeight;
		if (this.myactor.get_text_direction() == Clutter.TextDirection.RTL) {
			childBox.x1 = allocWidth - Math.min(allocWidth - rightNaturalWidth,
												leftNaturalWidth);
			childBox.x2 = allocWidth;
		} else {
			childBox.x1 = 0;
			childBox.x2 = Math.min(allocWidth - rightNaturalWidth, leftNaturalWidth);
		}
		this._leftBox.allocate(childBox, flags);

		childBox.x1 = Math.ceil(sideWidth);
		childBox.y1 = 0;
		childBox.x2 = childBox.x1 + centerWidth;
		childBox.y2 = allocHeight;
		this._centerBox.allocate(childBox, flags);

		childBox.y1 = 0;
		childBox.y2 = allocHeight;
		if (this.myactor.get_text_direction() == Clutter.TextDirection.RTL) {
			childBox.x1 = 0;
			childBox.x2 = Math.min(Math.floor(sideWidth),
								   rightNaturalWidth);
		} else {
			childBox.x1 = allocWidth - Math.min(Math.floor(sideWidth),
												rightNaturalWidth);
			childBox.x2 = allocWidth;
		}
		this._rightBox.allocate(childBox, flags);
    }
};

function main(metadata, orientation, panel_height, instance_id) {  
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;      
}
