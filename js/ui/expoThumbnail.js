// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const St = imports.gi.St;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Workspace = imports.ui.workspace;

// The maximum size of a thumbnail is 1/8 the width and height of the screen
let MAX_THUMBNAIL_SCALE = 0.9;

const RESCALE_ANIMATION_TIME = 0.2;
const SLIDE_ANIMATION_TIME = 0.3;
const INACTIVE_OPACITY = 120;
const REARRANGE_TIME = 0.3;

function ExpoWindowClone(realWindow) {
    this._init(realWindow);
}

ExpoWindowClone.prototype = {
    _init : function(realWindow) {
        this.actor = new Clutter.Clone({ source: realWindow.get_texture(),
                                         reactive: true });
        this.actor._delegate = this;
        this.realWindow = realWindow;
        this.metaWindow = realWindow.meta_window;

        this._positionChangedId = this.realWindow.connect('position-changed',
                                                          Lang.bind(this, this._onPositionChanged));
        this._realWindowDestroyedId = this.realWindow.connect('destroy',
                                                              Lang.bind(this, this._disconnectRealWindowSignals));
        this._onPositionChanged();

        this.actor.connect('button-release-event',
                           Lang.bind(this, this._onButtonRelease));

        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));

        this._draggable = DND.makeDraggable(this.actor,
                                            { restoreOnSuccess: true,
                                              dragActorMaxSize: Workspace.WINDOW_DND_SIZE,
                                              dragActorOpacity: Workspace.DRAGGING_WINDOW_OPACITY });
        this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));
        this.inDrag = false;

        if (!this.metaWindow.showing_on_its_workspace())
            this.actor.opacity = 0;

    },

    setStackAbove: function (actor) {
        this._stackAbove = actor;
        if (this._stackAbove == null)
            this.actor.lower_bottom();
        else
            this.actor.raise(this._stackAbove);
    },

    destroy: function () {
        this.actor.destroy();
    },

    _onPositionChanged: function() {
        let rect = this.metaWindow.get_outer_rect();
        this.actor.set_position(this.realWindow.x, this.realWindow.y);
    },

    _disconnectRealWindowSignals: function() {
        if (this._positionChangedId != 0) {
            this.realWindow.disconnect(this._positionChangedId);
            this._positionChangedId = 0;
        }

        if (this._realWindowDestroyedId != 0) {
            this.realWindow.disconnect(this._realWindowDestroyedId);
            this._realWindowDestroyedId = 0;
        }
    },

    _onDestroy: function() {
        this._disconnectRealWindowSignals();

        this.actor._delegate = null;

        if (this.inDrag) {
            this.emit('drag-end');
            this.inDrag = false;
        }

        this.disconnectAll();
    },

    _onButtonRelease : function (actor, event) {
        if ((Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK) || (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON3_MASK)){
            this.emit('selected', event.get_time());
        } else if (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON2_MASK){
            this.emit('remove-workspace', event.get_time());               
        }
        return true;
    },

    _onDragBegin : function (draggable, time) {
        Main.expo.showCloseArea();
        this.inDrag = true;
        this.emit('drag-begin');
    },

    _onDragEnd : function (draggable, time, snapback) {
        Main.expo.hideCloseArea();
        this.inDrag = false;
        // We may not have a parent if DnD completed successfully, in
        // which case our clone will shortly be destroyed and replaced
        // with a new one on the target workspace.
        if (this.actor.get_parent() != null) {
            if (this._stackAbove == null)
                this.actor.lower_bottom();
            else
                this.actor.raise(this._stackAbove);
        }

        this.emit('drag-end');
    }
};
Signals.addSignalMethods(ExpoWindowClone.prototype);


const ThumbnailState = {
    NEW   :         0,
    ANIMATING_IN :  1,
    NORMAL:         2,
    REMOVING :      3,
    ANIMATING_OUT : 4,
    ANIMATED_OUT :  5,
    COLLAPSING :    6,
    DESTROYED :     7
};

/**
 * @metaWorkspace: a #Meta.Workspace
 */
function ExpoWorkspaceThumbnail(metaWorkspace) {
    this._init(metaWorkspace);
}

ExpoWorkspaceThumbnail.prototype = {
    _init : function(metaWorkspace) {
        this.metaWorkspace = metaWorkspace;
        this.monitorIndex = Main.layoutManager.primaryIndex;

        this.actor = new St.Group({ reactive: true,
                                    clip_to_allocation: true,
                                    style_class: 'workspace-thumbnail' });
        this.actor._delegate = this;

        this._contents = new Clutter.Group();
        this.actor.add_actor(this._contents);

        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
        this.actor.connect('button-press-event', Lang.bind(this,
            function(actor, event) {
                return true;
            }));
        this.actor.connect('button-release-event', Lang.bind(this,
            function(actor, event) {
                if ((Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK) || (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON3_MASK)){
                    this._activate();
                    return true;
                } else if (Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON2_MASK){
                    this._remove();
                    return true;                
                }
            }));

        this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
        
        this.title = new St.Entry({ style_class: 'expo-workspaces-name-entry',                                     
                                     track_hover: true,
                                     can_focus: true });                
        this.title._spacing = 0; 
        this.titleText = this.title.clutter_text;        
        this.titleText.connect('key-press-event', Lang.bind(this, this._onTitleKeyPressEvent)); 
              
        let workspace_names = global.settings.get_strv("workspace-names");
        let workspace_index = this.metaWorkspace.index();
        if (workspace_index < workspace_names.length) {
            this.title.set_text(workspace_names[workspace_index]);
        }
        
        this._background = Meta.BackgroundActor.new_for_screen(global.screen);
        this._contents.add_actor(this._background);

        let monitor = Main.layoutManager.primaryMonitor;
        this.setPorthole(monitor.x, monitor.y, monitor.width, monitor.height);
       
        this.shade = new St.Bin();
        this.shade.set_style('background-color: black;');
        this.actor.add_actor(this.shade);
        this.shade.set_size(monitor.width, monitor.height);

        this.shade.opacity = INACTIVE_OPACITY;

        this.removed = false;

        if (metaWorkspace == global.screen.get_active_workspace())
            this.shade.opacity = 0;

        let windows = global.get_window_actors().filter(this._isMyWindow, this);

        // Create clones for windows that should be visible in the Expo
        this.count = 0;
        this._windows = [];
        this._uninterestingWindows = new Clutter.Group();
        this._uninterestingWindows.hide();
        this._contents.add_actor(this._uninterestingWindows);
        this._uninterestingWindows.raise(this._background);
        for (let i = 0; i < windows.length; i++) {
            windows[i].meta_window._minimizedChangedId =
                windows[i].meta_window.connect('notify::minimized',
                                               Lang.bind(this,
                                                         this._updateMinimized));

            if (this._isExpoWindow(windows[i])) {
                this._addWindowClone(windows[i]);
            } else {
                this._addUninterestingWindowClone(windows[i]);
            }
        }

        // Track window changes
        this._windowAddedId = this.metaWorkspace.connect('window-added',
                                                          Lang.bind(this, this._windowAdded));
        this._windowRemovedId = this.metaWorkspace.connect('window-removed',
                                                           Lang.bind(this, this._windowRemoved));
        this._windowEnteredMonitorId = global.screen.connect('window-entered-monitor',
                                                           Lang.bind(this, this._windowEnteredMonitor));
        this._windowLeftMonitorId = global.screen.connect('window-left-monitor',
                                                           Lang.bind(this, this._windowLeftMonitor));

        this.state = ThumbnailState.NORMAL;
        this._slidePosition = 0; // Fully slid in
    },
    
    _onTitleKeyPressEvent: function(actor, event) {
        
        let workspace_names = global.settings.get_strv("workspace-names");
        if (this.metaWorkspace.index() < workspace_names.length && this.title.get_text() != workspace_names[this.metaWorkspace.index()]) {
            workspace_names[this.metaWorkspace.index()] = this.title.get_text();
            global.settings.set_strv("workspace-names", workspace_names);            
        }      
                 
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.Return || symbol === Clutter.Escape) {
            global.stage.set_key_focus(this.actor);
            return true;
        }
        return false;     
    },
   
    activateWorkspace: function() {
        if (this.metaWorkspace != global.screen.get_active_workspace())
            this.metaWorkspace.activate(global.get_current_time());
        this._overviewModeOff();
        Main.expo.hide();
    },
    
    showKeyboardSelectedState: function(selected) {
        this.title.name = selected ? "selected" : "";
        if (selected) {
            this._highlight();
        }
        else {
            this._shade(true);
        }
    },
    
    _onEnterEvent : function(actor, event) {
        this._overviewModeOn();
        if (this.metaWorkspace != global.screen.get_active_workspace()) 
            this._highlight(); 
    },

    setPorthole: function(x, y, width, height) {
        this._portholeX = x;
        this._portholeY = y;
        this.actor.set_size(width, height);
        this._contents.set_position(-x, -y);
    },

    _lookupIndex: function (metaWindow) {
        for (let i = 0; i < this._windows.length; i++) {
            if (this._windows[i].metaWindow == metaWindow) {
                return i;
            }
        }
        return -1;
    },

    syncStacking: function(stackIndices) {
        this._windows.sort(function (a, b) { return stackIndices[a.metaWindow.get_stable_sequence()] - stackIndices[b.metaWindow.get_stable_sequence()]; });

        for (let i = 0; i < this._windows.length; i++) {
            let clone = this._windows[i];
            let metaWindow = clone.metaWindow;
            if (i == 0) {
                clone.setStackAbove(this._background);
            } else {
                let previousClone = this._windows[i - 1];
                clone.setStackAbove(previousClone.actor);
            }
        }
    },

    set slidePosition(slidePosition) {
        this._slidePosition = slidePosition;
        this.actor.queue_relayout();
    },

    get slidePosition() {
        return this._slidePosition;
    },

    _doRemoveWindow : function(metaWin) {
        let win = metaWin.get_compositor_private();

        // find the position of the window in our list
        let index = this._lookupIndex (metaWin);

        if (index == -1)
            return;

        // Check if window still should be here
        if (win && this._isMyWindow(win) && this._isExpoWindow(win))
            return;

        let clone = this._windows[index];
        this._windows.splice(index, 1);

        if (win && this._isExpoWindow(win)) {
            if (metaWin._minimizedChangedId) {
                metaWin.disconnect(metaWin._minimizedChangedId);
                delete metaWin._minimizedChangedId;
            }
        }
        clone.destroy();
        if (this.overviewMode)
            this._overviewModeOn();
    },

    _doAddWindow : function(metaWin) {
        if (this.leavingExpo)
            return;

        let win = metaWin.get_compositor_private();
        
        if (!win) {
            // Newly-created windows are added to a workspace before
            // the compositor finds out about them...
            Mainloop.idle_add(Lang.bind(this,
                                        function () {
                                            if (this.actor &&
                                                metaWin.get_compositor_private() &&
                                                metaWin.get_workspace() == this.metaWorkspace)
                                                this._doAddWindow(metaWin);
                                            return false;
                                        }));
            return;
        }

        // We might have the window in our list already if it was on all workspaces and
        // now was moved to this workspace
        if (this._lookupIndex (metaWin) != -1)
            return;

        if (!metaWin._minimizedChangedId)
            metaWin._minimizedChangedId = metaWin.connect('notify::minimized',
                                                          Lang.bind(this,
                                                                    this._updateMinimized));

        if (!this._isMyWindow(win) || !this._isExpoWindow(win))
            return;

        let clone = this._addWindowClone(win); 

        if (!win.showing_on_its_workspace()){
            clone.actor.opacity = 0;
            clone.actor.hide();
        }
        if (this.overviewMode)
            this._overviewModeOn();
    },

    _windowAdded : function(metaWorkspace, metaWin) {
        this._doAddWindow(metaWin);
    },

    _windowRemoved : function(metaWorkspace, metaWin) {
        this._doRemoveWindow(metaWin);
    },

    _windowEnteredMonitor : function(metaScreen, monitorIndex, metaWin) {
        if (monitorIndex == this.monitorIndex) {
            this._doAddWindow(metaWin);
        }
    },

    _windowLeftMonitor : function(metaScreen, monitorIndex, metaWin) {
        if (monitorIndex == this.monitorIndex) {
            this._doRemoveWindow(metaWin);
        }
    },

    _updateMinimized: function(metaWin) {
        if (metaWin.minimized)
            this._doRemoveWindow(metaWin);
        else
            this._doAddWindow(metaWin);
    },

    destroy : function() {            
        this.title.destroy();
        this.actor.destroy();        
    },

    _onDestroy: function(actor) {
        this.metaWorkspace.disconnect(this._windowAddedId);
        this.metaWorkspace.disconnect(this._windowRemovedId);
        global.screen.disconnect(this._windowEnteredMonitorId);
        global.screen.disconnect(this._windowLeftMonitorId);

        for (let i = 0; i < this._windows.length; i++) {
            let metaWin = this._windows[i].metaWindow;
            if (metaWin._minimizedChangedId) {
                metaWin.disconnect(metaWin._minimizedChangedId);
                delete metaWin._minimizedChangedId;
            }
            this._windows[i].destroy();
        }

        this._windows = [];
        this.title = null;
        this.actor = null;        
    },

    // Tests if @win belongs to this workspace and monitor
    _isMyWindow : function (win) {
        return Main.isWindowActorDisplayedOnWorkspace(win, this.metaWorkspace.index()) &&
            (!win.get_meta_window() || win.get_meta_window().get_monitor() == this.monitorIndex);
    },

    // Tests if @win should be shown in the Expo
    _isExpoWindow : function (win) {
        let tracker = Cinnamon.WindowTracker.get_default();
        return tracker.is_window_interesting(win.get_meta_window());
    },

    // Create a clone of a (non-desktop) window and add it to the window list
    _addWindowClone : function(win) {
        let clone = new ExpoWindowClone(win);

        clone.connect('selected',
                      Lang.bind(this, this._activate));
        clone.connect('remove-workspace', 
                      Lang.bind(this, this._remove));
        clone.connect('drag-begin',
                      Lang.bind(this, function(clone) {
                          Main.expo.beginWindowDrag();
                      }));
        clone.connect('drag-end',
                      Lang.bind(this, function(clone) {
                          Main.expo.endWindowDrag();
                          this._overviewModeOff();
                      }));
        this._contents.add_actor(clone.actor);

        if (this._windows.length == 0)
            clone.setStackAbove(this._background);
        else
            clone.setStackAbove(this._windows[this._windows.length - 1].actor);

        this._windows.push(clone);

        return clone;
    },

    _fadeOutUninterestingWindows : function() {
        this._uninterestingWindows.opacity = 255;
        this._uninterestingWindows.show();
        this._uninterestingWindows.raise(this._background);
        Tweener.addTween(this._uninterestingWindows, {  opacity: 0,
                                                        time: REARRANGE_TIME,
                                                        transition: "easeOutQuad",
                                                        onComplete: function() {this.hide();}});       
    },

    _fadeInUninterestingWindows : function() {
        this._uninterestingWindows.opacity = 0;
        this._uninterestingWindows.show();
        this._uninterestingWindows.raise(this._background);
        Tweener.addTween(this._uninterestingWindows, {  opacity: 255,
                                                        time: REARRANGE_TIME,
                                                        transition: "easeOutQuad",
                                                        onComplete: function() {this.hide();}});
    },

    _addUninterestingWindowClone : function(win) {
        let clone = new ExpoWindowClone(win);
        this._uninterestingWindows.add_actor(clone.actor);
        return clone;
    },

    _overviewModeOn : function () {
        this._overviewMode = true;
        let spacing = 14;
        let nCols = Math.ceil(Math.sqrt(this._windows.length));
        let nRows = Math.round(Math.sqrt(this._windows.length));
        let maxWindowWidth = (this.actor.width - (spacing * (nCols+1))) / nCols;
        let maxWindowHeight = (this.actor.height - (spacing * (nRows+1))) / nRows;
        let col = 1;
        let row = 1;
        let lastRowCols = this._windows.length - ((nRows - 1) * nCols);
        let lastRowOffset = (this.actor.width - (maxWindowWidth * lastRowCols) - (spacing * (lastRowCols+1))) / 2;
        let offset = 0;
        let i;
        for (i = 0; i < this._windows.length; i++){
            let window = this._windows[i];
            if (!window.origX && !window.origY){
                window.origX = window.actor.x;
                window.origY = window.actor.y;
            }
            if ((window.metaWindow.maximized_horizontally &&
                window.metaWindow.maximized_vertically) || window.metaWindow.get_layer() == Meta.StackLayer.FULLSCREEN){
                window.origX = 0;
                window.origY = 0;
            }

            if (!window.metaWindow.showing_on_its_workspace()) 
                window.actor.show();          

            if (row == nRows)
                offset = lastRowOffset;

            let scale = Math.min((maxWindowWidth / window.actor.width), (maxWindowHeight / window.actor.height)); 
            scale = Math.min(1, scale);
            let x = offset + (spacing * col) + (maxWindowWidth * (col - 1)) + ((maxWindowWidth - (window.actor.width * scale)) / 2);
            let y = (spacing * row) + (maxWindowHeight * (row - 1)) + ((maxWindowHeight - (window.actor.height * scale)) / 2);   
            Tweener.addTween(window.actor, {x: x, y: y, scale_x: scale, scale_y: scale, opacity: 255, time: REARRANGE_TIME, transition: 'easeOutQuad'});
            col++;
            if (col > nCols){
                row ++;
                col = 1;
            } 
        }    
    },

    _overviewModeOff : function (){
        if (!this._overviewMode)
            return false;
        let i;
        for (i = 0; i < this._windows.length; i++){
            let window = this._windows[i];
            let opacity = 255;
            let hide = false;
            if (!window.metaWindow.showing_on_its_workspace()){
                opacity = 0;  
                hide = true;          
            }
            Tweener.addTween(window.actor, {x: window.origX, y: window.origY, scale_x: 1, scale_y: 1, opacity: opacity, time: REARRANGE_TIME, transition: 'easeOutQuad', onComplete: function () { if(hide) window.actor.hide();}, onCompleteScope: this});        
        } 
    },

    _onScrollEvent: function (actor, event) {
        switch ( event.get_scroll_direction() ) {
        case Clutter.ScrollDirection.UP:
            Main.wm.actionMoveWorkspaceLeft();
            break;
        case Clutter.ScrollDirection.DOWN:
            Main.wm.actionMoveWorkspaceRight();
            break;
        }
    },

    _activate : function (clone, time) {
        if (this.state > ThumbnailState.NORMAL)
            return;

            if (clone && clone.metaWindow != null){
                Main.activateWindow(clone.metaWindow, time, this.metaWorkspace.index());
            } else if (this._windows.length > 0) {
                Main.activateWindow(this._windows[(this._windows.length-1)].metaWindow, time, this.metaWorkspace.index());            
            }
            if (this.metaWorkspace != global.screen.get_active_workspace())
                this.metaWorkspace.activate(time);
            this._overviewModeOff();
            Main.expo.hide();
        
        this._highlight();
    },

    _shade : function (force){
        if (this.metaWorkspace != global.screen.get_active_workspace() || force)
            Tweener.addTween(this.shade, {opacity: INACTIVE_OPACITY, time: SLIDE_ANIMATION_TIME, transition: 'easeOutQuad'});    
    },

    _highlight : function (){
        Tweener.addTween(this.shade, {opacity: 0, time: SLIDE_ANIMATION_TIME, transition: 'easeOutQuad'});    
    },

    _remove : function (){
        if (global.screen.n_workspaces <= 1)
            return false;
        this.emit('remove-event');
        Main._removeWorkspace(this.metaWorkspace);
        this.removed = true;
    },

    // Draggable target interface
    handleDragOver : function(source, actor, x, y, time) {
        this.emit('drag-over');
        if (source == Main.xdndHandler) {
            return DND.DragMotionResult.CONTINUE;
        }

        if (this.state > ThumbnailState.NORMAL)
            return DND.DragMotionResult.CONTINUE;

        if (source.realWindow && !this._isMyWindow(source.realWindow))
            return DND.DragMotionResult.MOVE_DROP;
        if (source.CinnamonWorkspaceLaunch)
            return DND.DragMotionResult.COPY_DROP;

        return DND.DragMotionResult.CONTINUE;
    },

    acceptDrop : function(source, actor, x, y, time) {
        if (this.state > ThumbnailState.NORMAL)
            return false;
        this.metaWorkspace.activate(time);
        if (source.realWindow) {
            let win = source.realWindow;
            if (this._isMyWindow(win))
                return false;

            let metaWindow = win.get_meta_window();

            // We need to move the window before changing the workspace, because
            // the move itself could cause a workspace change if the window enters
            // the primary monitor
            if (metaWindow.get_monitor() != this.monitorIndex)
                metaWindow.move_to_monitor(this.monitorIndex);

            metaWindow.change_workspace_by_index(this.metaWorkspace.index(),
                                                 false, // don't create workspace
                                                 time);


            this._overviewModeOn();
            return true;
        }
        return false;
    }
};

Signals.addSignalMethods(ExpoWorkspaceThumbnail.prototype);

function ExpoThumbnailsBox() {
    this._init();
}

ExpoThumbnailsBox.prototype = {
    _init: function() {
        this.actor = new Cinnamon.GenericContainer({ style_class: 'workspace-thumbnails',
                                                  request_mode: Clutter.RequestMode.WIDTH_FOR_HEIGHT });
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));

        // When we animate the scale, we don't animate the requested size of the thumbnails, rather
        // we ask for our final size and then animate within that size. This slightly simplifies the
        // interaction with the main workspace windows (instead of constantly reallocating them
        // to a new size, they get a new size once, then use the standard window animation code
        // allocate the windows to their new positions), however it causes problems for drawing
        // the background and border wrapped around the thumbnail as we animate - we can't just pack
        // the container into a box and set style properties on the box since that box would wrap
        // around the final size not the animating size. So instead we fake the background with
        // an actor underneath the content and adjust the allocation of our children to leave space
        // for the border and padding of the background actor.
        this._background = new St.Bin();

        this.actor.add_actor(this._background);

        this.button = new St.Button({ style_class: 'workspace-close-button' });
        this.actor.add_actor(this.button);
        this.button.connect('enter-event', Lang.bind(this, function () { this.lastHovered._highlight(); this.button.show();}));
        this.button.connect('leave-event', Lang.bind(this, function () { this.lastHovered._shade(); this.button.hide();}));
        this.button.connect('clicked', Lang.bind(this, function () { this.lastHovered._remove(); this.button.hide();}));
        this.button.hide();
                
        this._targetScale = 0;
        this._scale = 0;
        this._pendingScaleUpdate = false;
        this._stateUpdateQueued = false;
        this.bX = 0;
        this.bY = 0;

        this._stateCounts = {};
        for (let key in ThumbnailState)
            this._stateCounts[ThumbnailState[key]] = 0;

        this._thumbnails = [];
    },

    show: function() {
        this._switchWorkspaceNotifyId =
            global.window_manager.connect('switch-workspace',
                                          Lang.bind(this, this._activeWorkspaceChanged));

        this._targetScale = 0;
        this._scale = 0;
        this._pendingScaleUpdate = false;
        this._stateUpdateQueued = false;        

        this._stateCounts = {};
        for (let key in ThumbnailState)
            this._stateCounts[ThumbnailState[key]] = 0;

        // The "porthole" is the portion of the screen that we show in the workspaces
        let panelHeight = Main.panel.actor.height;
        let monitor = Main.layoutManager.primaryMonitor;
        let autohide = global.settings.get_boolean("panel-autohide");
        let desktop_layout = global.settings.get_string("desktop-layout");
        let portholeY = null;
        let portholeHeight = null;
        if (autohide){
            portholeY = 0;
            portholeHeight = monitor.height;
        } else if (desktop_layout == "traditional"){
            portholeY = 0;
            portholeHeight = monitor.height - panelHeight;        
        } else if (desktop_layout == "flipped"){
            portholeY = panelHeight;
            portholeHeight = monitor.height - panelHeight;     
        } else {
            portholeY = panelHeight;
            portholeHeight = monitor.height - (panelHeight * 2);         
        }
        this._porthole = {
            x: monitor.x,
            y: portholeY,
            width: monitor.width,
            height: portholeHeight
        };

        this.addThumbnails(0, global.screen.n_workspaces);
        this.button.raise_top();
        
        this._kbThumbnailIndex = global.screen.get_active_workspace_index();
        this._thumbnails[this._kbThumbnailIndex].showKeyboardSelectedState(true);
    },

    handleKeyPressEvent: function(actor, event) {
        let modifiers = Cinnamon.get_event_state(event);
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.Return || symbol === Clutter.KEY_space) {
            this.activateSelectedWorkspace();
            return true;
        }
        if (symbol === Clutter.Escape) {
            if (global.stage.get_key_focus() === this._thumbnails[this._kbThumbnailIndex].title) {
                // does not enter here, must find another way to detect focus ...
                return true;
            }
        }
        if ((symbol === Clutter.Delete && (modifiers & Clutter.ModifierType.MODIFIER_MASK) === 0)
            || symbol === Clutter.w && modifiers & Clutter.ModifierType.CONTROL_MASK) {
            this.removeSelectedWorkspace();
            return true;
        }
        if (symbol === Clutter.Right || symbol === Clutter.Down) {
            this.selectNextWorkspace();
            return true;
        }
        if (symbol === Clutter.Left || symbol === Clutter.Up) {
            this.selectPrevWorkspace();
            return true;
        }
        if (symbol === Clutter.Home) {
            this.selectPrevWorkspace(true);
            return true;
        }
        if (symbol === Clutter.End) {
            this.selectNextWorkspace(true);
            return true;
        }
        if (symbol === Clutter.F2) {
            this.editWorkspaceTitle();
            return true;
        }
        return false;
    },

    editWorkspaceTitle: function() {
        this._thumbnails[this._kbThumbnailIndex].title.grab_key_focus();
    },

    activateSelectedWorkspace: function() {
        this._thumbnails[this._kbThumbnailIndex].activateWorkspace();
    },

    removeSelectedWorkspace: function() {
        this._thumbnails[this._kbThumbnailIndex]._remove();
    },

    selectNextWorkspace: function(last) {
        if (this._thumbnails.length < 2) {
            return;
        }
        this._thumbnails[this._kbThumbnailIndex].showKeyboardSelectedState(false);
        this._kbThumbnailIndex = last ? this._thumbnails.length-1 : this._kbThumbnailIndex+1;
        if (this._kbThumbnailIndex >= this._thumbnails.length) {
            this._kbThumbnailIndex = 0;
        }
        this._thumbnails[this._kbThumbnailIndex].showKeyboardSelectedState(true);
        global.stage.set_key_focus(this._thumbnails[this._kbThumbnailIndex].actor);
    },

    selectPrevWorkspace: function(home) {
        if (this._thumbnails.length < 2) {
            return;
        }
        this._thumbnails[this._kbThumbnailIndex].showKeyboardSelectedState(false);
        this._kbThumbnailIndex = home ? 0 : this._kbThumbnailIndex-1;
        if (this._kbThumbnailIndex < 0 ) {
            this._kbThumbnailIndex = this._thumbnails.length - 1;
        }
        this._thumbnails[this._kbThumbnailIndex].showKeyboardSelectedState(true);
        global.stage.set_key_focus(this._thumbnails[this._kbThumbnailIndex].actor);
    },

    hide: function() {
        if (this._switchWorkspaceNotifyId > 0) {
            global.window_manager.disconnect(this._switchWorkspaceNotifyId);
            this._switchWorkspaceNotifyId = 0;
        }

        for (let w = 0; w < this._thumbnails.length; w++)
            this._thumbnails[w].destroy();
        this._thumbnails = [];
    },

    showButton: function(){
        if (global.screen.n_workspaces <= 1)
            return false;
        this.actor.queue_relayout();
        this.button.raise_top();
        this.button.show();
    },

    addThumbnails: function(start, count) {
        for (let k = start; k < start + count; k++) {
            let metaWorkspace = global.screen.get_workspace_by_index(k);
            let thumbnail = new ExpoWorkspaceThumbnail(metaWorkspace);
            thumbnail.setPorthole(this._porthole.x, this._porthole.y,
                                  this._porthole.width, this._porthole.height);
            this._thumbnails.push(thumbnail);
            if (metaWorkspace == global.screen.get_active_workspace())
                this._lastActiveWorkspace = thumbnail;
            this.actor.add_actor(thumbnail.actor);
            this.actor.add_actor(thumbnail.title);

            thumbnail.connect('drag-over', Lang.bind(this, function () { thumbnail._highlight(); if (this.lastHovered && this.lastHovered != thumbnail) this.lastHovered._shade(); this.lastHovered = thumbnail;}));

            thumbnail.actor.connect('enter-event', Lang.bind(this, function (actor, event) { this.lastHovered = thumbnail; this.showButton(); thumbnail._onEnterEvent(actor, event)}));
            thumbnail.actor.connect('leave-event', Lang.bind(this, function () { this.button.hide(); if (thumbnail.metaWorkspace != global.screen.get_active_workspace()) thumbnail._shade(); thumbnail.hovered = false; thumbnail._overviewModeOff();}));
            thumbnail.connect('remove-event', Lang.bind(this, function () { this.button.hide(); if (thumbnail.metaWorkspace != global.screen.get_active_workspace()) thumbnail._shade(); thumbnail.hovered = false; thumbnail._overviewModeOff();}));

            Main.expo.connect('hiding', Lang.bind(this, function() { this.button.hide();}));

            if (start > 0) { // not the initial fill
                thumbnail.state = ThumbnailState.NEW;
                thumbnail.slidePosition = 1; // start slid out
                this._haveNewThumbnails = true;
            } else {
                thumbnail.state = ThumbnailState.NORMAL;
            }

            this._stateCounts[thumbnail.state]++;
        }

        this._queueUpdateStates();
    },

    removeThumbnails: function(start, count) {
        let currentPos = 0;
        for (let k = 0; k < this._thumbnails.length; k++) {
            let thumbnail = this._thumbnails[k];

            if (thumbnail.state > ThumbnailState.NORMAL)
                continue;

            if (currentPos >= start && currentPos < start + count)
                this._setThumbnailState(thumbnail, ThumbnailState.REMOVING);

            currentPos++;
        }
        
        // for simplicity, assume workspaces are removed one at a time
        this._thumbnails[this._kbThumbnailIndex].showKeyboardSelectedState(false);
        if (start < this._kbThumbnailIndex) {
            --this._kbThumbnailIndex;
        }
        if (start === this._kbThumbnailIndex) {
            if (this._kbThumbnailIndex === this._thumbnails.length - 1) {
                --this._kbThumbnailIndex;
            }
        }

        this._queueUpdateStates();
    },

    syncStacking: function(stackIndices) {
        for (let i = 0; i < this._thumbnails.length; i++)
            this._thumbnails[i].syncStacking(stackIndices);
    },

    set scale(scale) {
        this._scale = scale;
        this.actor.queue_relayout();
    },

    get scale() {
        return this._scale;
    },

    _setThumbnailState: function(thumbnail, state) {
        this._stateCounts[thumbnail.state]--;
        thumbnail.state = state;
        this._stateCounts[thumbnail.state]++;
    },

    _iterateStateThumbnails: function(state, callback) {
        if (this._stateCounts[state] == 0)
            return;

        for (let i = 0; i < this._thumbnails.length; i++) {
            if (this._thumbnails[i].state == state)
                callback.call(this, this._thumbnails[i]);
        }
    },

    _tweenScale: function() {
        Tweener.addTween(this,
                         { scale: this._targetScale,
                           time: RESCALE_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onComplete: this._queueUpdateStates,
                           onCompleteScope: this });
    },

    _updateStates: function() {
        this._stateUpdateQueued = false;

        // Then slide out any thumbnails that have been destroyed
        this._iterateStateThumbnails(ThumbnailState.REMOVING,
            function(thumbnail) {
                thumbnail.title.hide();
                this._setThumbnailState(thumbnail, ThumbnailState.ANIMATING_OUT);

                Tweener.addTween(thumbnail,
                                 { slidePosition: 1,
                                   time: SLIDE_ANIMATION_TIME,
                                   transition: 'linear',
                                   onComplete: function() {
                                       this._setThumbnailState(thumbnail, ThumbnailState.ANIMATED_OUT);
                                       this._queueUpdateStates();
                                   },
                                   onCompleteScope: this
                                 });
            });

        // As long as things are sliding out, don't proceed
        if (this._stateCounts[ThumbnailState.ANIMATING_OUT] > 0)
            return;

        // Once that's complete, we can start scaling to the new size and collapse any removed thumbnails
        this._iterateStateThumbnails(ThumbnailState.ANIMATED_OUT,
            function(thumbnail) {
                this.actor.set_skip_paint(thumbnail.actor, true);
                //this.title.set_skip_paint(thumbnail.title, true);
                this._setThumbnailState(thumbnail, ThumbnailState.COLLAPSING);
                Tweener.addTween(thumbnail,
                                 { time: RESCALE_ANIMATION_TIME,
                                   transition: 'easeOutQuad',
                                   onComplete: function() {
                                       this._stateCounts[thumbnail.state]--;
                                       thumbnail.state = ThumbnailState.DESTROYED;

                                       let index = this._thumbnails.indexOf(thumbnail);
                                       this._thumbnails.splice(index, 1);
                                       thumbnail.destroy();

                                       this._queueUpdateStates();
                                   },
                                   onCompleteScope: this
                                 });
                });

        if (this._pendingScaleUpdate) {
            this._tweenScale();
            this._pendingScaleUpdate = false;
        }

        // Wait until that's done
        if (this._scale != this._targetScale || this._stateCounts[ThumbnailState.COLLAPSING] > 0)
            return;

        // And then slide in any new thumbnails
        this._iterateStateThumbnails(ThumbnailState.NEW,
            function(thumbnail) {
                this._setThumbnailState(thumbnail, ThumbnailState.ANIMATING_IN);
                Tweener.addTween(thumbnail,
                                 { slidePosition: 0,
                                   time: SLIDE_ANIMATION_TIME,
                                   transition: 'easeOutQuad',
                                   onComplete: function() {
                                       this._setThumbnailState(thumbnail, ThumbnailState.NORMAL);
                                   },
                                   onCompleteScope: this
                                 });
            });
        this._thumbnails[this._kbThumbnailIndex].showKeyboardSelectedState(true);
    },

    _queueUpdateStates: function() {
        if (this._stateUpdateQueued)
            return;

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW,
                       Lang.bind(this, this._updateStates));

        this._stateUpdateQueued = true;
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {
        // See comment about this._background in _init()
        let themeNode = this._background.get_theme_node();

        forWidth = themeNode.adjust_for_width(forWidth);

        // Note that for getPreferredWidth/Height we cheat a bit and skip propagating
        // the size request to our children because we know how big they are and know
        // that the actors aren't depending on the virtual functions being called.

        if (this._thumbnails.length == 0)
            return;

        let spacing = this.actor.get_theme_node().get_length('spacing');
        let nWorkspaces = global.screen.n_workspaces;
        let totalSpacing = (nWorkspaces - 1) * spacing;

        let avail = Main.layoutManager.primaryMonitor.width - totalSpacing;

        let scale = (avail / nWorkspaces) / this._porthole.width;

        let height = Math.round(this._porthole.height * scale);
        [alloc.min_size, alloc.natural_size] =
            themeNode.adjust_preferred_height(400,
                                              Main.layoutManager.primaryMonitor.height);
    },

    _getPreferredWidth: function(actor, forHeight, alloc) {
        // See comment about this._background in _init()
        let themeNode = this._background.get_theme_node();

        if (this._thumbnails.length == 0)
            return;

        // We don't animate our preferred width, which is always reported according
        // to the actual number of current workspaces, we just animate within that

        let spacing = this.actor.get_theme_node().get_length('spacing');
        let nWorkspaces = global.screen.n_workspaces;
        let totalSpacing = (nWorkspaces - 1) * spacing;

        let avail = Main.layoutManager.primaryMonitor.width - totalSpacing;

        let scale = (avail / nWorkspaces) / this._porthole.width;

        let width = Math.round(this._porthole.width * scale);
        let maxWidth = (width) * nWorkspaces;
        [alloc.min_size, alloc.natural_size] =
            themeNode.adjust_preferred_width(totalSpacing, Main.layoutManager.primaryMonitor.width);
    },

    _allocate: function(actor, box, flags) {
        let rtl = (St.Widget.get_default_direction () == St.TextDirection.RTL);

        if (this._thumbnails.length == 0) // not visible
            return;

        let portholeWidth = this._porthole.width;
        let portholeHeight = this._porthole.height;
        let spacing = this.actor.get_theme_node().get_length('spacing');

        // Compute the scale we'll need once everything is updated
        let nWorkspaces = this._thumbnails.length;
        let totalSpacing = (nWorkspaces - 1) * spacing;
        let avail = (box.x2 - box.x1) - totalSpacing - (spacing * 2) ;
        let screen = (box.x2 - box.x1);

        let newScale = (avail / nWorkspaces) / portholeWidth;
        newScale = Math.min(newScale, MAX_THUMBNAIL_SCALE);

        if (newScale != this._targetScale) {
            if (this._targetScale > 0) {
                // We don't do the tween immediately because we need to observe the ordering
                // in queueUpdateStates - if workspaces have been removed we need to slide them
                // out as the first thing.
                this._targetScale = newScale;
                this._pendingScaleUpdate = true;
            } else {
                this._targetScale = this._scale = newScale;
            }

            this._queueUpdateStates();
        }

        let thumbnailHeight = Math.round(portholeHeight * this._scale);
        let thumbnailWidth = Math.round(portholeWidth * this._scale);

        let childBox = new Clutter.ActorBox();
        
        let needed = (thumbnailWidth * nWorkspaces) + totalSpacing + (spacing * 2);
        let extraSpace = (box.x2 - box.x1) - needed;

        // The background is horizontally restricted to correspond to the current thumbnail size
        // but otherwise covers the entire allocation
        childBox.x1 = box.x1;
        childBox.x2 = box.x2;

        childBox.y1 = box.y1;
        childBox.y2 = box.y2;

        this._background.allocate(childBox, flags);

        let x = spacing + (extraSpace/2);
        let y = (Main.layoutManager.primaryMonitor.height - thumbnailHeight) / 2
        for (let i = 0; i < this._thumbnails.length; i++) {
            let thumbnail = this._thumbnails[i];

            // We might end up with thumbnailHeight being something like 99.33
            // pixels. To make this work and not end up with a gap at the bottom,
            // we need some thumbnails to be 99 pixels and some 100 pixels height;
            // we compute an actual scale separately for each thumbnail.
            let x1 = Math.round(x + (thumbnailWidth * thumbnail.slidePosition / 2));
            let x2 = Math.round(x + thumbnailWidth);

            let y1, y2;
            
            y1 = Math.round(y + (thumbnailHeight * thumbnail.slidePosition / 2) /*+ ((Main.layoutManager.primaryMonitor.height - y) * thumbnail.slidePosition)*/);
            y2 = Math.round(y1 + thumbnailHeight);

            // Allocating a scaled actor is funny - x1/y1 correspond to the origin
            // of the actor, but x2/y2 are increased by the *unscaled* size.
            childBox.x1 = x1;
            childBox.x2 = x1 + portholeWidth;
            childBox.y1 = y1;
            childBox.y2 = y1 + portholeHeight;

            thumbnail.actor.set_scale(this._scale * (1 - thumbnail.slidePosition), this._scale * (1 - thumbnail.slidePosition));
            thumbnail.actor.allocate(childBox, flags);  

            let thumbnailx = Math.round(x + (thumbnailWidth * thumbnail.slidePosition / 2));
            childBox.x1 = Math.max(thumbnailx, thumbnailx + Math.round(thumbnailWidth/2) - Math.round(thumbnail.title.width/2));
            childBox.x2 = Math.min(thumbnailx + thumbnailWidth, childBox.x1 + thumbnail.title.width);
            
            let thumbnaily = Math.round(y + (thumbnailHeight * thumbnail.slidePosition / 2));
            childBox.y1 = thumbnaily + thumbnailHeight + Math.round(thumbnail.title.height/2);
            childBox.y2 = childBox.y1 + thumbnail.title.height;
                        
            thumbnail.title.allocate(childBox, flags);

            // We round the collapsing portion so that we don't get thumbnails resizing
            // during an animation due to differences in rounded, but leave the uncollapsed
            // portion unrounded so that non-animating we end up with the right total
            x += thumbnailWidth + spacing;
        }
        let x = 0;
        let y = 0;

        let buttonWidth = this.button.get_theme_node().get_length('width');
        let buttonHeight = this.button.get_theme_node().get_length('height');
        let buttonOverlap = this.button.get_theme_node().get_length('-cinnamon-close-overlap');

        if (this.lastHovered && this.lastHovered.actor != null && !this.lastHovered.removed){
            x = this.lastHovered.actor.allocation.x1 + ((this.lastHovered.actor.allocation.x2 - this.lastHovered.actor.allocation.x1) * this.lastHovered.actor.get_scale()[0]) - buttonOverlap;
            y = this.lastHovered.actor.allocation.y1 - (buttonHeight - buttonOverlap);
        } else {
            this.button.hide();        
        }

        childBox.x1 = x;
        childBox.x2 = childBox.x1 + buttonWidth;
        childBox.y1 = y;
        childBox.y2 = childBox.y1 + buttonHeight;
        
        this.button.allocate(childBox, flags);
                                
        this._lastActiveWorkspace.emit('allocated');
    },

    _activeWorkspaceChanged: function(wm, from, to, direction) {
        this._thumbnails[this._kbThumbnailIndex].showKeyboardSelectedState(false);
        this._kbThumbnailIndex = global.screen.get_active_workspace_index();
        this._thumbnails[this._kbThumbnailIndex].showKeyboardSelectedState(true);
        global.stage.set_key_focus(this._thumbnails[this._kbThumbnailIndex].actor);

        let thumbnail;
        let activeWorkspace = global.screen.get_active_workspace();
        for (let i = 0; i < this._thumbnails.length; i++) {
            if (this._thumbnails[i].metaWorkspace == activeWorkspace) {
                thumbnail = this._thumbnails[i];
                break;
            }
        }

        if (this._lastActiveWorkspace)
            this._lastActiveWorkspace._shade();

        this._lastActiveWorkspace = thumbnail;
        if (thumbnail.shade.opacity > 0)
            thumbnail._highlight();
    }
};
