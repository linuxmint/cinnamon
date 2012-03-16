// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Gdk = imports.gi.Gdk;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Params = imports.misc.params;
const Tweener = imports.ui.tweener;
const ExpoView = imports.ui.expoView;

// Time for initial animation going into Overview mode
const ANIMATION_TIME = 0.3;
const ADD_BUTTON_HOVER_TIME = 0.3;

const DND_WINDOW_SWITCH_TIMEOUT = 1250;

function CinnamonInfo() {
    this._init();
}

CinnamonInfo.prototype = {
    _init: function() {
        this._source = null;
        this._undoCallback = null;
    },

    _onUndoClicked: function() {
        if (this._undoCallback)
            this._undoCallback();
        this._undoCallback = null;

        if (this._source)
            this._source.destroy();
    },

    setMessage: function(text, undoCallback, undoLabel) {
        if (this._source == null) {
            this._source = new MessageTray.SystemNotificationSource();
            this._source.connect('destroy', Lang.bind(this,
                function() {
                    this._source = null;
                }));
            Main.messageTray.add(this._source);
        }

        let notification = null;
        if (this._source.notifications.length == 0) {
            notification = new MessageTray.Notification(this._source, text, null);
        } else {
            notification = this._source.notifications[0];
            notification.update(text, null, { clear: true });
        }

        notification.setTransient(true);

        this._undoCallback = undoCallback;
        if (undoCallback) {
            notification.addButton('system-undo',
                                   undoLabel ? undoLabel : _("Undo"));
            notification.connect('action-invoked',
                                 Lang.bind(this, this._onUndoClicked));
        }

        this._source.notify(notification);
    }
};

function Expo() {
    this._init.apply(this, arguments);
}

Expo.prototype = {
    _init : function(params) {
        params = Params.parse(params, { isDummy: false });

        this.isDummy = params.isDummy;

        // We only have an overview in user sessions, so
        // create a dummy overview in other cases
        if (this.isDummy) {
            this.animationInProgress = false;
            this.visible = false;
            return;
        }

        // The main BackgroundActor is inside global.window_group which is
        // hidden when displaying the overview, so we create a new
        // one. Instances of this class share a single CoglTexture behind the
        // scenes which allows us to show the background with different
        // rendering options without duplicating the texture data.
        this._background = Meta.BackgroundActor.new_for_screen(global.screen);
        this._background.hide();
        global.overlay_group.add_actor(this._background);

        this._spacing = 0;

        this._group = new St.Group({ name: 'expo',
                                     reactive: true });
        this._group._delegate = this;
        this._group.connect('style-changed',
            Lang.bind(this, function() {
                let node = this._group.get_theme_node();
                let spacing = node.get_length('spacing');
                if (spacing != this._spacing) {
                    this._spacing = spacing;
                    this._relayout();
                }
            }));

        this._workspacesDisplay = null;
        this._expo = null;

        this.visible = false;           // animating to overview, in overview, animating out
        this._shown = false;            // show() and not hide()
        this._shownTemporarily = false; // showTemporarily() and not hideTemporarily()
        this._modal = false;            // have a modal grab
        this.animationInProgress = false;
        this._hideInProgress = false;

        // During transitions, we raise this to the top to avoid having the overview
        // area be reactive; it causes too many issues such as double clicks on
        // Dash elements, or mouseover handlers in the workspaces.

        this._gradient = new St.Button({reactive: false});
        this._gradient.set_style("background-gradient-end: #AAA;background-gradient-start: #000;background-gradient-direction: vertical;");
        this._group.add_actor(this._gradient);
        this._coverPane = new Clutter.Rectangle({ opacity: 0,
                                                  reactive: true });
        this._group.add_actor(this._coverPane);
        this._coverPane.connect('event', Lang.bind(this, function (actor, event) { return true; }));

        this._addWorkspaceButton = new St.Button({style_class: 'workspace-add-button'});
        this._group.add_actor(this._addWorkspaceButton);
        this._addWorkspaceButton.opacity = 160;
        this._addWorkspaceButton.connect('clicked', Lang.bind(this, function () { Main._addWorkspace();}));
        this._addWorkspaceButton.connect('enter-event', Lang.bind(this, function () { 
                Tweener.addTween(this._addWorkspaceButton, { opacity: 255,
                                                             time: ADD_BUTTON_HOVER_TIME,
                                                             transition: 'easeOutQuad'});
                                                                                        }));
        this._addWorkspaceButton.connect('leave-event', Lang.bind(this, function () { 
                Tweener.addTween(this._addWorkspaceButton, { opacity: 160,
                                                             time: ADD_BUTTON_HOVER_TIME,
                                                             transition: 'easeOutQuad'});
                                                                                        }));

        this._group.hide();
        global.overlay_group.add_actor(this._group);

        this._gradient.hide();
        this._coverPane.hide();
        this._addWorkspaceButton.hide();

        this._windowSwitchTimeoutId = 0;
        this._windowSwitchTimestamp = 0;
        this._lastActiveWorkspaceIndex = -1;
        this._lastHoveredWindow = null;
        this._needsFakePointerEvent = false;
        this._globalKeyPressHandler = 0;
    },

    // The members we construct that are implemented in JS might
    // want to access the overview as Main.overview to connect
    // signal handlers and so forth. So we create them after
    // construction in this init() method.
    init: function() {
        if (this.isDummy)
            return;

        this._CinnamonInfo = new CinnamonInfo();
    
        this._expo = new ExpoView.ExpoView();
        this._group.add_actor(this._expo.actor);

        Main.layoutManager.connect('monitors-changed', Lang.bind(this, this._relayout));
        this._relayout();
    },

    setMessage: function(text, undoCallback, undoLabel) {
        if (this.isDummy)
            return;

        this._CinnamonInfo.setMessage(text, undoCallback, undoLabel);
    },

    _fakePointerEvent: function() {
        let display = Gdk.Display.get_default();
        let deviceManager = display.get_device_manager();
        let pointer = deviceManager.get_client_pointer();
        let [screen, pointerX, pointerY] = pointer.get_position();

        pointer.warp(screen, pointerX, pointerY);
    },

    _relayout: function () {
        // To avoid updating the position and size of the workspaces
        // we just hide the overview. The positions will be updated
        // when it is next shown.
        this.hide();

        let primary = Main.layoutManager.primaryMonitor;
        let rtl = (St.Widget.get_default_direction () == St.TextDirection.RTL);

        let contentY = Main.panel.actor.height;
        let contentHeight = primary.height - contentY - Main.panel.actor.height;

        this._group.set_position(primary.x, primary.y);
        this._group.set_size(primary.width, primary.height);

        this._gradient.set_position(0, 0);
        this._gradient.set_size(primary.width, primary.height);

        this._coverPane.set_position(0, 0);
        this._coverPane.set_size(primary.width, contentHeight);

        let viewWidth = primary.width - this._spacing;
        let viewHeight = contentHeight - 2 * this._spacing;
        let viewY = contentY + this._spacing;
        let viewX = rtl ? 0 : this._spacing;

        let node = this._addWorkspaceButton.get_theme_node();
        let buttonWidth = node.get_length('width');
        let buttonHeight = node.get_length('height');

        this._expo.actor.set_position(0, 0);
        this._expo.actor.set_size((primary.width - buttonWidth), primary.height);

        let buttonY = (primary.height - buttonHeight) / 2;

        this._addWorkspaceButton.set_position((primary.width - buttonWidth), buttonY);
        this._addWorkspaceButton.set_size(buttonWidth, buttonHeight); 
        if (this._addWorkspaceButton.get_theme_node().get_background_image() == null)
            this._addWorkspaceButton.set_style('background-image: url("/usr/share/cinnamon/theme/add-workspace.png");'); 
    },

    //// Public methods ////

    beginWindowDrag: function(source) {
        this.emit('window-drag-begin');
    },

    cancelledWindowDrag: function(source) {
        this.emit('window-drag-cancelled');
    },

    endWindowDrag: function(source) {
        this.emit('window-drag-end');
    },

    // show:
    //
    // Animates the overview visible and grabs mouse and keyboard input
    show : function() {
        if (this.isDummy)
            return;
        if (this._shown)
            return;
        // Do this manually instead of using _syncInputMode, to handle failure
        if (!Main.pushModal(this._group))
            return;
        this._modal = true;
        this._animateVisible();
        this._shown = true;

    },

    _animateVisible: function() {
        if (this.visible || this.animationInProgress)
            return;

        this.visible = true;
        this.animationInProgress = true;

        // All the the actors in the window group are completely obscured,
        // hiding the group holding them while the Overview is displayed greatly
        // increases performance of the Overview especially when there are many
        // windows visible.
        //
        // If we switched to displaying the actors in the Overview rather than
        // clones of them, this would obviously no longer be necessary.
        //
        // Disable unredirection while in the overview
        Meta.disable_unredirect_for_screen(global.screen);
        global.window_group.hide();
        this._group.show();
        this._background.show();
        this._addWorkspaceButton.show();
        this._expo.show();

        this.activeWorkspace = this._expo._thumbnailsBox._lastActiveWorkspace;
        let activeWorkspaceActor = this.activeWorkspace.actor;
        this._expo._thumbnailsBox._lastActiveWorkspace._fadeOutUninterestingWindows();

        this.allocateID = this.activeWorkspace.connect('allocated', Lang.bind(this, this._animateVisible2));

        this.clone = new Clutter.Clone({source: activeWorkspaceActor});
        if (global.settings.get_string("desktop-layout") != 'traditional' && !global.settings.get_boolean("panel-autohide"))
            this.clone.set_position(0, Main.panel.actor.height); 

        this.clone.show();
        this._group.add_actor(this.clone);

        this._gradient.show();
        
        if (Main.panel)
            Tweener.addTween(Main.panel.actor, {    opacity: 0, 
                                                    time: ANIMATION_TIME, 
                                                    transition: 'easeOutQuad', 
                                                    onComplete: function(){Main.panel.actor.hide();}});
        if (Main.panel2)
            Tweener.addTween(Main.panel2.actor, {   opacity: 0, 
                                                    time: ANIMATION_TIME, 
                                                    transition: 'easeOutQuad', 
                                                    onComplete: function(){Main.panel2.actor.hide();}});
        
        this._background.dim_factor = 1;
        Tweener.addTween(this._background,
                            { dim_factor: 0.4,
                              transition: 'easeOutQuad',
                              time: ANIMATION_TIME});

        /*Tweener.addTween(this,
                            { time: 0.4,
                              onComplete: this._animateVisible2,
                              onCompleteScope: this});*/

        this._coverPane.raise_top();
        this._coverPane.show();
        this.emit('showing');
    },

    //We need to allocate activeWorkspace before we begin it's clone animation
    _animateVisible2: function() {
        this.activeWorkspace.disconnect(this.allocateID);
        let activeWorkspaceActor = this._expo._thumbnailsBox._lastActiveWorkspace.actor;
        Tweener.addTween(this.clone, {  x: activeWorkspaceActor.allocation.x1, 
                                        y: activeWorkspaceActor.allocation.y1, 
                                        scale_x: activeWorkspaceActor.get_scale()[0] , 
                                        scale_y: activeWorkspaceActor.get_scale()[1], 
                                        time: ANIMATION_TIME, transition: 'easeOutQuad', 
                                        onComplete: function() { this.clone.hide(); this._showDone()}, 
                                        onCompleteScope: this});        
    },

    // showTemporarily:
    //
    // Animates the overview visible without grabbing mouse and keyboard input;
    // if show() has already been called, this has no immediate effect, but
    // will result in the overview not being hidden until hideTemporarily() is
    // called.
    showTemporarily: function() {
        if (this.isDummy)
            return;

        if (this._shownTemporarily)
            return;

        this._syncInputMode();
        this._animateVisible();
        this._shownTemporarily = true;
    },

    // hide:
    //
    // Reverses the effect of show()
    hide: function() {
        if (this.isDummy)
            return;

        if (!this._shown)
            return;

        if (!this._shownTemporarily)
            this._animateNotVisible();

        this._shown = false;
        this._syncInputMode();
    },

    // hideTemporarily:
    //
    // Reverses the effect of showTemporarily()
    hideTemporarily: function() {
        if (this.isDummy)
            return;

        if (!this._shownTemporarily)
            return;

        if (!this._shown)
            this._animateNotVisible();

        this._shownTemporarily = false;
        this._syncInputMode();
    },

    toggle: function() {
        if (this.isDummy)
            return;

        if (this._shown)
            this.hide();
        else
            this.show();
    },

    //// Private methods ////

    _syncInputMode: function() {
        // We delay input mode changes during animation so that when removing the
        // overview we don't have a problem with the release of a press/release
        // going to an application.
        if (this.animationInProgress)
            return;

        if (this._shown) {
            if (!this._modal) {
                if (Main.pushModal(this._group))
                    this._modal = true;
                else
                    this.hide();
            }
        } else if (this._shownTemporarily) {
            if (this._modal) {
                Main.popModal(this._group);
                this._modal = false;
            }
            global.stage_input_mode = Cinnamon.StageInputMode.FULLSCREEN;
        } else {
            if (this._modal) {
                Main.popModal(this._group);
                this._modal = false;
            }
            else if (global.stage_input_mode == Cinnamon.StageInputMode.FULLSCREEN)
                global.stage_input_mode = Cinnamon.StageInputMode.NORMAL;
        }
    },

    _animateNotVisible: function() {
        if (!this.visible || this.animationInProgress)
            return;

        this.animationInProgress = true;
        this._hideInProgress = true;
        let maximizedWindow = false;
        let windows = global.screen.get_active_workspace().list_windows();
        for (let i = 0; i < windows.length; i++) {
            let metaWindow = windows[i];
            if (metaWindow.showing_on_its_workspace() &&
                metaWindow.maximized_horizontally &&
                metaWindow.maximized_vertically)
                maximizedWindow = true;
        }

        if (Main.panel){
            Main.panel.actor.show();
            Tweener.addTween(Main.panel.actor, {opacity: 255, time: ANIMATION_TIME, transition: 'easeOutQuad'});
        }
        if (Main.panel2){
            Main.panel2.actor.show();
            Tweener.addTween(Main.panel2.actor, {opacity: 255, time: ANIMATION_TIME, transition: 'easeOutQuad'});
        }

        Tweener.addTween(this._background,
                         { dim_factor: 1,
                           time: ANIMATION_TIME,
                           transition: 'linear',
                           onComplete: this._hideDone,
                           onCompleteScope: this
                         });

        this.activeWorkspace = this._expo._thumbnailsBox._lastActiveWorkspace;
        let activeWorkspaceActor = this.activeWorkspace.actor;
        //this.activeWorkspace._fadeInUninterestingWindows();
        this.activeWorkspace._overviewModeOff();
        this.clone = new Clutter.Clone({source: activeWorkspaceActor});
        this._group.add_actor(this.clone);
        this.clone.set_position(activeWorkspaceActor.allocation.x1, activeWorkspaceActor.allocation.y1);
        this.clone.set_scale(activeWorkspaceActor.get_scale()[0], activeWorkspaceActor.get_scale()[1]);
        this.clone.show();
        let y = 0;
        if (global.settings.get_string("desktop-layout") != 'traditional' && !global.settings.get_boolean("panel-autohide"))
            y = Main.panel.actor.height; 
        Tweener.addTween(this.clone, {  x: 0, 
                                        y: y, 
                                        scale_x: 1 , 
                                        scale_y: 1, 
                                        time: ANIMATION_TIME, 
                                        transition: 'easeOutQuad', 
                                        onComplete: this.hide});

        this._coverPane.raise_top();
        this._coverPane.show();
        this.emit('hiding');
    },

    _showDone: function() {
        this.animationInProgress = false;
        this._coverPane.hide();

        this.emit('shown');
        // Handle any calls to hide* while we were showing
        if (!this._shown && !this._shownTemporarily)
            this._animateNotVisible();

        this._syncInputMode();
        global.sync_pointer();
    },

    _hideDone: function() {
        // Re-enable unredirection
        Meta.enable_unredirect_for_screen(global.screen);

        global.window_group.show();

        this._expo.hide();
        this._addWorkspaceButton.hide();

        this._background.hide();
        this._group.hide();
        this.clone.hide();
        this._gradient.hide();

        this.visible = false;
        this.animationInProgress = false;
        this._hideInProgress = false;

        this._coverPane.hide();

        this.emit('hidden');
        // Handle any calls to show* while we were hiding
        if (this._shown || this._shownTemporarily)
            this._animateVisible();

        this._syncInputMode();

        // Fake a pointer event if requested
        if (this._needsFakePointerEvent) {
            this._fakePointerEvent();
            this._needsFakePointerEvent = false;
        }

        Main.layoutManager._chrome.updateRegions();
    }
};
Signals.addSignalMethods(Expo.prototype);