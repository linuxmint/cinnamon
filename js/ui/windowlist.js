const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Main = imports.ui.main;
const Layout = imports.ui.layout;
const Tweener = imports.ui.tweener;
const Overview = imports.ui.overview;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const Signals = imports.signals;
const Meta = imports.gi.Meta;
const AppDisplay = imports.ui.appDisplay;
const AltTab = imports.ui.altTab;
const Gio = imports.gi.Gio;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const PANEL_ICON_SIZE = 24;
const SPINNER_ANIMATION_TIME = 1;


function AppMenuButtonRightClickMenu(actor, app, metaWindow) {
    this._init(actor, app, metaWindow);
}

AppMenuButtonRightClickMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(actor, app, metaWindow) {
        //take care of menu initialization
        if (bottomPosition)
            PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.0, St.Side.BOTTOM, 0);
        else
            PopupMenu.PopupMenu.prototype._init.call(this, actor, 0.0, St.Side.TOP, 0);
        Main.uiGroup.add_actor(this.actor);
        //Main.chrome.addActor(this.actor, { visibleInOverview: true,
        //                                   affectsStruts: false });
        this.actor.hide();

        actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
        this.connect('open-state-changed', Lang.bind(this, this._onToggled));
        
        this.metaWindow = metaWindow;
        this.app = app;

        this.itemCloseWindow = new PopupMenu.PopupMenuItem('Close');
        this.itemCloseWindow.connect('activate', Lang.bind(this, this._onCloseWindowActivate));        

        if (metaWindow.minimized)
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem('Restore');
        else
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem('Minimize');
        this.itemMinimizeWindow.connect('activate', Lang.bind(this, this._onMinimizeWindowActivate));        
        
        if (metaWindow.maximized_horizontally && metaWindow.maximized_vertically)
            this.itemMaximizeWindow = new PopupMenu.PopupMenuItem(_("Unmaximize"));
        else
            this.itemMaximizeWindow = new PopupMenu.PopupMenuItem(_('Maximize'));
        this.itemMaximizeWindow.connect('activate', Lang.bind(this, this._onMaximizeWindowActivate));        
        
        if (bottomPosition) {
            this.addMenuItem(this.itemMinimizeWindow);
            this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemCloseWindow);                        
        }
        else {
            this.addMenuItem(this.itemCloseWindow);
            this.addMenuItem(this.itemMaximizeWindow);
            this.addMenuItem(this.itemMinimizeWindow);
        }
    },
    
    _onToggled: function(actor, state){        
        if (state) {
            if (Main.panel._windowList.actor != null) {
                let coord = this.mouseEvent.get_coords();
                let panelOffset = Main.panel._windowList.actor.get_geometry().x
                let buttonOffset = actor.sourceActor.get_geometry().x;
               let buttonWidth = (actor.sourceActor.get_geometry().width / 2);
                
                this.actor.set_position((0 - buttonOffset - buttonWidth - panelOffset) + coord[0], 0);
            }
        }
    },
    
    _onWindowMinimized: function(actor, event){
    },

    _onCloseWindowActivate: function(actor, event){
        this.metaWindow.delete(global.get_current_time());
        this.destroy();
    },

    _onMinimizeWindowActivate: function(actor, event){
        if (this.metaWindow.minimized)
            this.metaWindow.unminimize(global.get_current_time());
        else
            this.metaWindow.minimize(global.get_current_time());
    },

    _onMaximizeWindowActivate: function(actor, event){      
        // 3 = 1 | 2 for both horizontally and vertically (didn't find where the META_MAXIMIZE_HORIZONTAL and META_MAXIMIZE_VERTICAL constants were defined for the JS wrappers)
        if (this.metaWindow.get_maximized()){
            this.metaWindow.unmaximize(3);
            this.itemMaximizeWindow.label.set_text(_("Maximize"));
        }else{
            this.metaWindow.maximize(3);
            this.itemMaximizeWindow.label.set_text(_("Unmaximize"));
        }
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

function AppMenuButtonTooltip(appButton) {
    this._init(appButton);
}

AppMenuButtonTooltip.prototype = {
    _init: function(appButton) {
        this._tooltip = new St.Tooltip();
        this._tooltip.set_label(appButton.metaWindow.get_title());
        Main.uiGroup.add_actor(this._tooltip);
        
        appButton.actor.connect('enter-event', Lang.bind(this, this._onEnterEvent));
        appButton.actor.connect('leave-event', Lang.bind(this, this._onLeaveEvent));
        appButton.actor.connect('motion-event', Lang.bind(this, this._onMotionEvent));
        
        this._showTimer = null;
        this._visible = false;
        this._appButton = appButton;
    },
    
    _onMotionEvent: function(actor, event) {
        Tweener.removeTweens(this);
        if (!this._visible){
            Tweener.addTween(this, {time: 0.3, onComplete: Lang.bind(this, this._onTimerComplete)});
            this._mousePosition = event.get_coords();
        }
    },
    
    _onEnterEvent: function(actor, event) {
        Tweener.addTween(this, {time: 0.3, onComplete: Lang.bind(this, this._onTimerComplete)});
        this._mousePosition = event.get_coords();
    },
    
    _onTimerComplete: function(){
        this.show();
    },
    
    _onLeaveEvent: function(actor, event) {
        this.hide();
    },
    
    hide: function() {
        Tweener.removeTweens(this);
        this._tooltip.hide();
        this._visible = false;
    },
    
    show: function() {
        if (this._appButton.rightClickMenu.isOpen) return;
        
        Tweener.removeTweens(this);
        
        let tooltipHeight = this._tooltip.get_allocation_box().y2-this._tooltip.get_allocation_box().y1;
        let tooltipWidth = this._tooltip.get_allocation_box().x2-this._tooltip.get_allocation_box().x1;
        
        let monitor = Main.layoutManager.primaryMonitor;
        
        let tooltipTop = monitor.height-tooltipHeight-this._appButton.actor.get_allocation_box().y2+this._appButton.actor.get_allocation_box().y1;
        
        var tooltipLeft = this._mousePosition[0]-(tooltipWidth/2);
        if (tooltipLeft<0) tooltipLeft = 0;
        if (tooltipLeft+tooltipWidth>monitor.width) tooltipLeft = monitor.width-tooltipWidth;
        
        this._tooltip.set_position(tooltipLeft, tooltipTop);
        
        this._tooltip.show();
        this._visible = true;
    },
    
    set_text: function(text) {
        this._tooltip.set_label(text);
    },
    
    destroy: function() {
       this._tooltip.destroy();
    }
}

function AppMenuButton(app, metaWindow, animation) {
    this._init(app, metaWindow, animation);
}

AppMenuButton.prototype = {
//    __proto__ : AppMenuButton.prototype,

    
    _init: function(app, metaWindow, animation) {

        if (bottomPosition) {        
            this.actor = new St.Bin({ style_class: 'window-list-item-box-bottom',
                                      reactive: true,
                                      can_focus: true,
                                      x_fill: true,
                                      y_fill: false,
                                      track_hover: true });
        }
        else {
            this.actor = new St.Bin({ style_class: 'window-list-item-box',
                                      reactive: true,
                                      can_focus: true,
                                      x_fill: true,
                                      y_fill: false,
                                      track_hover: true });
        }
        
        this.actor._delegate = this;
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));

		this.metaWindow = metaWindow;
		this.app = app;
		
        let bin = new St.Bin({ name: 'appMenu' });
        this.actor.set_child(bin);

        this._container = new Shell.GenericContainer();
        bin.set_child(this._container);
        this._container.connect('get-preferred-width',
								Lang.bind(this, this._getContentPreferredWidth));
        this._container.connect('get-preferred-height',
								Lang.bind(this, this._getContentPreferredHeight));
        this._container.connect('allocate', Lang.bind(this, this._contentAllocate));

        
        this._iconBox = new Shell.Slicer({ name: 'appMenuIcon' });
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClip));
        this._container.add_actor(this._iconBox);
        this._label = new St.Label();
        this._container.add_actor(this._label);

        this._iconBottomClip = 0;

        this._visible = !Main.overview.visible;
        if (!this._visible)
            this.actor.hide();
        Main.overview.connect('hiding', Lang.bind(this, function () {
            this.show();
        }));
        Main.overview.connect('showing', Lang.bind(this, function () {
            this.hide();
        }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
        
        this._updateCaptionId = this.metaWindow.connect('notify::title', Lang.bind(this, function () {
            this._label.set_text(this.metaWindow.get_title());
            if (this._tooltip) this._tooltip.set_text(this.metaWindow.get_title());
        }));
                
        this._spinner = new Panel.AnimatedIcon('process-working.svg', PANEL_ICON_SIZE);
        this._container.add_actor(this._spinner.actor);
        this._spinner.actor.lower_bottom();

		let icon = this.app.create_icon_texture(16);
		//let icon = this.app.get_faded_icon(1.15 * PANEL_ICON_SIZE);		        
        if (metaWindow.minimized)
            this._label.set_text("[" + this.metaWindow.get_title() + "]");
        else
            this._label.set_text(this.metaWindow.get_title());
        this._iconBox.set_child(icon);
        
        if(animation){
			this.startAnimation(); 
			this.stopAnimation();
		}
		
        //set up the right click menu
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this.rightClickMenu = new AppMenuButtonRightClickMenu(this.actor, this.app, this.metaWindow);
        this._menuManager.addMenu(this.rightClickMenu);
        
        this._tooltip = new AppMenuButtonTooltip(this);
    },
    
    _onDestroy: function() {
        this.metaWindow.disconnect(this._updateCaptionId);
        this._tooltip.destroy();
    },
    
    doFocus: function() {
        //let tracker = Shell.WindowTracker.get_default();
        //let focusedApp = tracker.focus_app;    
        if (this.metaWindow.has_focus()) {
            this.actor.add_style_pseudo_class('focus');
	    let icon = this.app.create_icon_texture(16);
	    this._iconBox.set_child(icon);
        }
        else {
            this.actor.remove_style_pseudo_class('focus');
	    let icon = this.app.create_icon_texture(16);
	    this._iconBox.set_child(icon);
        }
    },
    
    _onButtonRelease: function(actor, event) {
        this._tooltip.hide();
        if ( Shell.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK ) {
            if ( this.rightClickMenu.isOpen ) {
                this.rightClickMenu.toggle();                
            }
            this._windowHandle(false);
        } else if (Shell.get_event_state(event) & Clutter.ModifierType.BUTTON2_MASK) {
            this.metaWindow.delete(global.get_current_time());
            this.rightClickMenu.destroy();
        } else if (Shell.get_event_state(event) & Clutter.ModifierType.BUTTON3_MASK) {
            if (!this.rightClickMenu.isOpen) {
                // Setting the max-height won't do any good if the minimum height of the
                // menu is higher then the screen; it's useful if part of the menu is
                // scrollable so the minimum height is smaller than the natural height
                //let monitor = global.get_primary_monitor();
                //this.rightClickMenu.actor.style = ('max-height: ' +
                //                         Math.round(200) +
                //                         'px;');
            }
            this.rightClickMenu.mouseEvent = event;
            this.rightClickMenu.toggle();   
        }   
    },

    _windowHandle: function(fromDrag){
        if ( this.metaWindow.has_focus() ) {
            if (fromDrag){
                return;
            }
            
            this.metaWindow.minimize(global.get_current_time());
            this.actor.remove_style_pseudo_class('focus');
        }
        else {
            this.metaWindow.activate(global.get_current_time());
            this.actor.add_style_pseudo_class('focus');
        }
    },

    handleDragOver: function(source, actor, x, y, time) {
        if (typeof(WindowList.dragEnterTime) == 'undefined') {
            WindowList.dragEnterTime = time;
        } else {
            if (time > (WindowList.dragEnterTime + 3000))
            {
                WindowList.dragEnterTime = time;
            }
        }
                
        if (time > (WindowList.dragEnterTime + 300)) {
            this._windowHandle(true);
        }
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
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
        [minSize, naturalSize] = this._label.get_preferred_width(forHeight);
//        alloc.min_size = alloc.min_size + Math.max(0, minSize - Math.floor(alloc.min_size / 2));
        alloc.min_size = alloc.min_size + Math.max(0, minSize);
//        alloc.natural_size = alloc.natural_size + Math.max(0, naturalSize - Math.floor(alloc.natural_size / 2));
        alloc.natural_size = 150; // FIX ME --> This was set to 75 originally, we need some calculation.. we want this to be as big as possible for the window list to take all available space
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

        let direction = this.actor.get_direction();

        let yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);
        if (direction == St.TextDirection.LTR) {
            childBox.x1 = 3;
            childBox.x2 = childBox.x1 + Math.min(naturalWidth, allocWidth);
        } else {
            childBox.x1 = Math.max(0, allocWidth - naturalWidth);
            childBox.x2 = allocWidth;
        }
        this._iconBox.allocate(childBox, flags);

        let iconWidth = 16;

        [minWidth, minHeight, naturalWidth, naturalHeight] = this._label.get_preferred_size();

        yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);

        if (direction == St.TextDirection.LTR) {
            childBox.x1 = Math.floor(iconWidth + 5);
            childBox.x2 = Math.min(childBox.x1 + naturalWidth, allocWidth);
        } else {
            childBox.x2 = allocWidth - Math.floor(iconWidth + 3);
            childBox.x1 = Math.max(0, childBox.x2 - naturalWidth);
        }
        this._label.allocate(childBox, flags);

        if (direction == St.TextDirection.LTR) {
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
    }
};

function WindowList() {
    this._init();
}

WindowList.prototype = {
//    __proto__ : WindowList.prototype,

    _init: function() {
        this.actor = new St.BoxLayout({ name: 'windowList',
                                        style_class: 'window-list-box' });
        this.actor._delegate = this;
        this._windows = new Array();
                
        let tracker = Shell.WindowTracker.get_default();
        tracker.connect('notify::focus-app', Lang.bind(this, this._onFocus));

        global.window_manager.connect('switch-workspace',
                                        Lang.bind(this, this._refreshItems));
        global.window_manager.connect('minimize',
                                        Lang.bind(this, this._onMinimize));
        global.window_manager.connect('maximize',
                                        Lang.bind(this, this._onMaximize));
        global.window_manager.connect('unmaximize',
                                        Lang.bind(this, this._onMaximize));
        global.window_manager.connect('map',
                                        Lang.bind(this, this._onMap));
        
        this._workspaces = [];
        this._changeWorkspaces();
        global.screen.connect('notify::n-workspaces',
                                Lang.bind(this, this._changeWorkspaces));
                                
//        this._container.connect('allocate', Lang.bind(Main.panel, this._allocateBoxes));
    },

    _onFocus: function() {
        for ( let i = 0; i < this._windows.length; ++i ) {
            this._windows[i].doFocus();
        }
    },
    
    _refreshItems: function() {
        this.actor.destroy_children();
        this._windows = new Array();

        let metaWorkspace = global.screen.get_active_workspace();
        let windows = metaWorkspace.list_windows();
        windows.sort(function(w1, w2) {
            return w1.get_stable_sequence() - w2.get_stable_sequence();
        });
                
        // Create list items for each window
        let tracker = Shell.WindowTracker.get_default();
        for ( let i = 0; i < windows.length; ++i ) {
            let metaWindow = windows[i];
            if ( metaWindow && tracker.is_window_interesting(metaWindow) ) {
                let app = tracker.get_window_app(metaWindow);
                if ( app ) {
                    let appbutton = new AppMenuButton(app, metaWindow, false);
                    this._windows.push(appbutton);
                    this.actor.add(appbutton.actor);
                }
            }
        }

        this._onFocus();
    },

    _onWindowStateChange: function(state, actor) {
        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == actor.get_meta_window() ) {
                let windowReference = this._windows[i];
                let menuReference = this._windows[i].rightClickMenu;
                
                if (state == 'minimize') {
                    windowReference._label.set_text("["+ actor.get_meta_window().get_title() +"]");
                    menuReference.itemMinimizeWindow.label.set_text(_("Restore"));
                    
                    return;
                } else if (state == 'map') {
                    windowReference._label.set_text(actor.get_meta_window().get_title());
                    menuReference.itemMinimizeWindow.label.set_text(_("Minimize"));
                    
                    return;
                } else if (state == 'maximize') {
                    if (actor.get_meta_window().get_maximized()) {
                        menuReference.itemMaximizeWindow.label.set_text(_("Unmaximize"));
                    } else {
                        menuReference.itemMaximizeWindow.label.set_text(_("Maximize"));
                    }
                    
                    return;
                }
            }
        }
    },
    
    _onMinimize: function(shellwm, actor) {
        this._onWindowStateChange('minimize', actor);
    },
    
    _onMaximize: function(shellwm, actor) {
        this._onWindowStateChange('maximize', actor);
    },
    
    _onMap: function(shellwm, actor) {
        this._refreshItems();
        this._onWindowStateChange('map', actor);
    },
  
    _windowAdded: function(metaWorkspace, metaWindow) {
        if ( metaWorkspace.index() != global.screen.get_active_workspace_index() ) {
            return;
        }

        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == metaWindow ) {
                return;
            }
        }

        let tracker = Shell.WindowTracker.get_default();
        let app = tracker.get_window_app(metaWindow);
        if ( app && tracker.is_window_interesting(metaWindow) ) {
            let appbutton = new AppMenuButton(app, metaWindow, true);
            this._windows.push(appbutton);
            this.actor.add(appbutton.actor);
            appbutton.actor.show();
        }
    },

    _windowRemoved: function(metaWorkspace, metaWindow) {
        if ( metaWorkspace.index() != global.screen.get_active_workspace_index() ) {
            return;
        }

        for ( let i=0; i<this._windows.length; ++i ) {
            if ( this._windows[i].metaWindow == metaWindow ) {
                this.actor.remove_actor(this._windows[i].actor);
                this._windows[i].actor.destroy();
                this._windows.splice(i, 1);
                break;
            }
        }
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
		if (this.actor.get_direction() == St.TextDirection.RTL) {
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
		if (this.actor.get_direction() == St.TextDirection.RTL) {
			childBox.x1 = 0;
			childBox.x2 = Math.min(Math.floor(sideWidth),
								   rightNaturalWidth);
		} else {
			childBox.x1 = allocWidth - Math.min(Math.floor(sideWidth),
												rightNaturalWidth);
			childBox.x2 = allocWidth;
		}
		this._rightBox.allocate(childBox, flags);
    },
     
    setBottomPosition: function(value){
        bottomPosition = value;
        this._refreshItems();
    }
};

let bottomPosition = true;
