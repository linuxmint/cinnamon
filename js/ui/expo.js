// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const DND = imports.ui.dnd;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const ExpoThumbnail = imports.ui.expoThumbnail;

// Time for initial animation going into Overview mode
const ANIMATION_TIME = 0.3;

function Expo() {
    this._init.apply(this, arguments);
}

Expo.prototype = {
    _init : function() {
        this.visible = false;           // animating to overview, in overview, animating out
        this._shown = false;            // show() and not hide()
        this._modal = false;            // have a modal grab

        Main.layoutManager.connect('monitors-changed', Lang.bind(this, this._relayout));
    },

    beforeShow: function() {
        // The main BackgroundActor is inside global.window_group which is
        // hidden when displaying the overview, so we create a new
        // one. Instances of this class share a single CoglTexture behind the
        // scenes which allows us to show the background with different
        // rendering options without duplicating the texture data.
        this._background = Meta.BackgroundActor.new_for_screen(global.screen);
        this._background.hide();
        global.overlay_group.add_actor(this._background);

        this._spacing = 0;

        this._group = new St.Widget({ name: 'expo',
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

        this.visible = false;           // animating to overview, in overview, animating out
        this._shown = false;            // show() and not hide()
        this._modal = false;            // have a modal grab
        this.animationInProgress = false;
        this._hideInProgress = false;

        // During transitions, we raise this to the top to avoid having the overview
        // area be reactive; it causes too many issues such as double clicks on
        // Dash elements, or mouseover handlers in the workspaces.

        this._gradient = new St.Button({reactive: false});
        this._gradient.set_style_class_name("expo-background");
        this._group.add_actor(this._gradient);
        this._coverPane = new Clutter.Rectangle({ opacity: 0,
                                                  reactive: true });
        this._group.add_actor(this._coverPane);
        this._coverPane.connect('event', Lang.bind(this, function (actor, event) { return true; }));

        this._addWorkspaceButton = new St.Button({style_class: 'workspace-add-button'});
        this._group.add_actor(this._addWorkspaceButton);
        this._addWorkspaceButton.connect('clicked', Lang.bind(this, function () { Main._addWorkspace();}));
        this._addWorkspaceButton.handleDragOver = function(source, actor, x, y, time) {
                return source.metaWindow ? DND.DragMotionResult.MOVE_DROP : DND.DragMotionResult.CONTINUE;
            };
        this._addWorkspaceButton.acceptDrop = function(source, actor, x, y, time) {
            if (source.metaWindow) {
                let draggable = source._draggable;
                actor.get_parent().remove_actor(actor);
                draggable._dragOrigParent.add_actor(actor);
                actor.opacity = draggable._dragOrigOpacity;
                Main.moveWindowToNewWorkspace(source.metaWindow);
            }
            return true;
        };
        this._addWorkspaceButton._delegate = this._addWorkspaceButton;


        this._windowCloseArea = new St.Button({style_class: 'window-close-area'});
        this._windowCloseArea.handleDragOver = function(source, actor, x, y, time) {
                return source.metaWindow ? DND.DragMotionResult.MOVE_DROP : DND.DragMotionResult.CONTINUE;
            };
        this._windowCloseArea.acceptDrop = function(source, actor, x, y, time) {
            if (source.metaWindow) {
                let draggable = source._draggable;
                actor.get_parent().remove_actor(actor);
                draggable._dragOrigParent.add_actor(actor);
                actor.opacity = draggable._dragOrigOpacity;
                source.metaWindow.delete(global.get_current_time());
            }
            return true;
        };

        this._windowCloseArea._delegate = this._windowCloseArea;
        this._group.add_actor(this._windowCloseArea);

        this._group.hide();
        global.overlay_group.add_actor(this._group);

        this._gradient.hide();
        this._coverPane.hide();
        this._addWorkspaceButton.hide();
        this._windowCloseArea.hide();

        let ctrlAltMask = Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD1_MASK;
        this._group.connect('key-press-event',
            Lang.bind(this, function(actor, event) {
                if (this._shown) {
                    if (this._expo.handleKeyPressEvent(actor, event)) {
                        return true;
                    }
                    let symbol = event.get_key_symbol();
                    if (symbol === Clutter.plus || symbol === Clutter.Insert) {
                        this._workspaceOperationPending = true;
                    }
                    let modifiers = Cinnamon.get_event_state(event);
                    if ((symbol === Clutter.Delete && (modifiers & ctrlAltMask) !== ctrlAltMask)
                        || symbol === Clutter.w && modifiers & Clutter.ModifierType.CONTROL_MASK)
                    {
                        this._workspaceOperationPending = true;
                    }
                    if (symbol === Clutter.Escape) {
                        if (!this._workspaceOperationPending) {
                            this.hide();
                        }
                        this._workspaceOperationPending = false;
                        return true;
                    }
                }
                return false;
            }));
        this._group.connect('key-release-event',
            Lang.bind(this, function(actor, event) {
                if (this._shown) {
                    let symbol = event.get_key_symbol();
                    if (symbol === Clutter.plus || symbol === Clutter.Insert) {
                        if (this._workspaceOperationPending) {
                            this._workspaceOperationPending = false;
                            Main._addWorkspace();
                        }
                        return true;
                    }
                    let modifiers = Cinnamon.get_event_state(event);
                    if ((symbol === Clutter.Delete && (modifiers & ctrlAltMask) !== ctrlAltMask)
                        || symbol === Clutter.w && modifiers & Clutter.ModifierType.CONTROL_MASK)
                    {
                        if (this._workspaceOperationPending) {
                            this._workspaceOperationPending = false;
                            this._expo.removeSelectedWorkspace();
                        }
                        return true;
                    }
                }
                return false;
            }));
        this._expo = new ExpoThumbnail.ExpoThumbnailsBox();
        this._group.add_actor(this._expo.actor);
        this._relayout();
    },

    init: function() {
    },

    _relayout: function () {
        if (!this._expo) {
            // This function can be called as a response to the monitors-changed event,
            // when we're not showing.
            return;
        }
        // To avoid updating the position and size of the workspaces
        // we just hide the overview. The positions will be updated
        // when it is next shown.
        this.hide();

        let primary = Main.layoutManager.primaryMonitor;
        let rtl = (St.Widget.get_default_direction () == St.TextDirection.RTL);

        let contentY = 0;
        let contentHeight = primary.height;

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

        node = this._windowCloseArea.get_theme_node();
        this._windowCloseArea.height = node.get_length('height');
        this._windowCloseArea.width = node.get_length('width');

        this._expo.actor.set_position(0, 0);
        this._expo.actor.set_size((primary.width - buttonWidth), primary.height);

        let buttonY = (primary.height - buttonHeight) / 2;

        this._addWorkspaceButton.set_position((primary.width - buttonWidth), buttonY);
        this._addWorkspaceButton.set_size(buttonWidth, buttonHeight); 
        if (this._addWorkspaceButton.get_theme_node().get_background_image() == null)
            this._addWorkspaceButton.set_style('background-image: url("/usr/share/cinnamon/theme/add-workspace.png");'); 

        this._windowCloseArea.set_position((primary.width - this._windowCloseArea.width) / 2 , primary.height);
        this._windowCloseArea.set_size(this._windowCloseArea.width, this._windowCloseArea.height);
        this._windowCloseArea.raise_top();
    },

    _showCloseArea : function() {
        let primary = Main.layoutManager.primaryMonitor;
        this._windowCloseArea.show();
        Tweener.addTween(this._windowCloseArea, {   y: primary.height - this._windowCloseArea.height,
                                                    time: ANIMATION_TIME,
                                                    transition: 'easeOutQuad'});
    },

    _hideCloseArea : function() {
        let primary = Main.layoutManager.primaryMonitor;
        Tweener.addTween(this._windowCloseArea, {   y: primary.height,
                                                    time: ANIMATION_TIME,
                                                    transition: 'easeOutQuad',
                                                    onComplete: this.hide});
    },

    //// Public methods ////

    // show:
    //
    // Animates the overview visible and grabs mouse and keyboard input
    show : function() {
        if (this._shown)
            return;
        this.beforeShow();
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

        this._expo.connect('drag-begin', Lang.bind(this, this._showCloseArea));
        this._expo.connect('drag-end', Lang.bind(this, this._hideCloseArea));
        
        let activeWorkspace = this._expo.lastActiveWorkspace;
        let activeWorkspaceActor = activeWorkspace.actor;

        // should not create new actors and work with them within an allocation cycle
        let clones = [];
        Main.layoutManager.monitors.forEach(function(monitor,index) {
            let clone = new Clutter.Clone({source: activeWorkspaceActor});
            global.overlay_group.add_actor(clone);
            clone.set_clip(monitor.x, monitor.y, monitor.width, monitor.height);
            clones.push(clone);
        }, this);
        //We need to allocate activeWorkspace before we begin its clone animation
        let allocateID = this._expo.connect('allocated', Lang.bind(this, function() {
            this._expo.disconnect(allocateID);
            Main.layoutManager.monitors.forEach(function(monitor,index) {
                let clone = clones[index];
                Tweener.addTween(clone, {
                    x: Main.layoutManager.primaryMonitor.x + activeWorkspaceActor.allocation.x1,
                    y: Main.layoutManager.primaryMonitor.y + activeWorkspaceActor.allocation.y1,
                    scale_x: activeWorkspaceActor.get_scale()[0] , 
                    scale_y: activeWorkspaceActor.get_scale()[1], 
                    time: ANIMATION_TIME,
                    transition: 'easeOutQuad', 
                    onComplete: function() {
                        global.overlay_group.remove_actor(clone);
                        clone.destroy();
                        if (index == Main.layoutManager.monitors.length < 1) {
                            this._showDone();
                        }
                    }, 
                    onCompleteScope: this
                });
            }, this);
        }));

        this._gradient.show();
        Main.panelManager.disablePanels();

        this._background.dim_factor = 1;
        Tweener.addTween(this._background,
                            { dim_factor: 0.4,
                              transition: 'easeOutQuad',
                              time: ANIMATION_TIME});

        this._coverPane.raise_top();
        this._coverPane.show();
        this.emit('showing');
    },

    // hide:
    //
    // Reverses the effect of show()
    hide: function(options) {
        if (!this._shown)
            return;

        this._animateNotVisible(options);
        this._shown = false;
        this._syncInputMode();
    },

    toggle: function() {
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
        } else {
            if (this._modal) {
                Main.popModal(this._group);
                this._modal = false;
            }
            else if (global.stage_input_mode == Cinnamon.StageInputMode.FULLSCREEN)
                global.stage_input_mode = Cinnamon.StageInputMode.NORMAL;
        }
    },

    _animateNotVisible: function(options) {
        if (!this.visible || this.animationInProgress)
            return;

        let animationTime = ANIMATION_TIME;
        this.animationInProgress = true;
        this._hideInProgress = true;

        let activeWorkspace = this._expo.lastActiveWorkspace;

        if (!options || !options.toScale ) {
            Main.panelManager.enablePanels();
            activeWorkspace.overviewModeOff(true, true);
        }

        let activeWorkspaceActor = activeWorkspace.actor;
        Main.layoutManager.monitors.forEach(function(monitor,index) {
            let cover = new Clutter.Group();
            global.overlay_group.add_actor(cover);
            cover.set_position(0, 0);
            cover.set_clip(monitor.x, monitor.y, monitor.width, monitor.height);

            let clone = new Clutter.Clone({source: activeWorkspaceActor});
            cover.add_actor(clone);
            clone.set_position(Main.layoutManager.primaryMonitor.x + activeWorkspaceActor.allocation.x1, Main.layoutManager.primaryMonitor.y + activeWorkspaceActor.allocation.y1);
            clone.set_clip(monitor.x, monitor.y, monitor.width, monitor.height);
            clone.set_scale(activeWorkspaceActor.get_scale()[0], activeWorkspaceActor.get_scale()[1]);

            Tweener.addTween(clone, {
                x: 0,
                y: 0,
                scale_x: 1,
                scale_y: 1,
                time: animationTime,
                transition: 'easeOutQuad',
                onCompleteScope: this,
                onComplete: function() {
                    global.overlay_group.remove_actor(cover);
                    cover.destroy();
                    if (index == Main.layoutManager.monitors.length < 1) {
                        this._group.hide();
                        this._hideDone();
                    }
                }
            });
        }, this);

        this.emit('hiding');
    },

    _showDone: function() {
        this.animationInProgress = false;
        this._coverPane.hide();

        this.emit('shown');
        // Handle any calls to hide* while we were showing
        if (!this._shown)
            this._animateNotVisible();

        this._syncInputMode();
        global.sync_pointer();
    },

    _hideDone: function() {
        // Re-enable unredirection
        Meta.enable_unredirect_for_screen(global.screen);

        global.window_group.show();

        this._expo.hide();
        this._expo = null;
        this._addWorkspaceButton.hide();
        this._windowCloseArea.hide();

        this._background.hide();
        this._gradient.hide();

        this.visible = false;
        this.animationInProgress = false;
        this._hideInProgress = false;

        this._coverPane.hide();

        this.emit('hidden');
        // Handle any calls to show* while we were hiding
        if (this._shown)
            this._animateVisible();

        this._syncInputMode();
        global.overlay_group.remove_actor(this._group);
        this._group.destroy();
        global.overlay_group.remove_actor(this._background);
        this._background.destroy();

        Main.layoutManager._chrome.updateRegions();
    }
};
Signals.addSignalMethods(Expo.prototype);
