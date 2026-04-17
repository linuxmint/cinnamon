// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const DND = imports.ui.dnd;
const Main = imports.ui.main;
const ExpoThumbnail = imports.ui.expoThumbnail;

// ***************
// This shows all of the workspaces
// ***************

// Time for initial animation going into Overview mode
const ANIMATION_TIME = 200;

var Expo = GObject.registerClass({
    Signals: {
        'showing': {},
        'shown': {},
        'hiding': {},
        'hidden': {},
    },
}, class Expo extends GObject.Object {
    _init() {
        super._init();
        this.visible = false;           // animating to overview, in overview, animating out
        this._shown = false;            // show() and not hide()
        this._modal = false;            // have a modal grab
        this.animationInProgress = false;
        this._hideInProgress = false;
        this._activeAnim = null;        // { items, direction } when animating clones

        Main.layoutManager.connect('monitors-changed', this._relayout.bind(this));
    }

    beforeShow() {
        // The main BackgroundActor is inside global.window_group which is
        // hidden when displaying the overview, so we create a new
        // one. Instances of this class share a single CoglTexture behind the
        // scenes which allows us to show the background with different
        // rendering options without duplicating the texture data.
        this._background = Main.createFullScreenBackground();
        this._background.hide();
        global.overlay_group.add_actor(this._background);

        this._spacing = 0;

        this._group = new St.Widget({ name: 'expo',
                                      reactive: true });
        this._group._delegate = this;
        this._group.connect('style-changed', () => {
            let node = this._group.get_theme_node();
            let spacing = node.get_length('spacing');
            if (spacing != this._spacing) {
                this._spacing = spacing;
                this._relayout();
            }
        });

        this.visible = false;
        this._shown = false;
        this._modal = false;
        this.animationInProgress = false;
        this._hideInProgress = false;
        this._activeAnim = null;

        // During transitions, we raise this to the top to avoid having the overview
        // area be reactive; it causes too many issues such as double clicks on
        // Dash elements, or mouseover handlers in the workspaces.

        this._gradient = new St.Button({reactive: false});
        this._gradient.set_style_class_name("expo-background");
        this._group.add_actor(this._gradient);
        this._coverPane = new Clutter.Rectangle({ opacity: 0,
                                                  reactive: true });
        this._group.add_actor(this._coverPane);
        this._coverPane.connect('event', (actor, event) => Clutter.EVENT_STOP);

        this._addWorkspaceButton = new St.Button({style_class: 'workspace-add-button'});
        this._group.add_actor(this._addWorkspaceButton);
        this._addWorkspaceButton.connect('clicked', () => { Main._addWorkspace(); });
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
        this._group.connect('key-press-event', (actor, event) => {
            if (this._shown) {
                if (this._expo.handleKeyPressEvent(actor, event)) {
                    return Clutter.EVENT_STOP;
                }
                let symbol = event.get_key_symbol();
                if (symbol === Clutter.KEY_plus || symbol === Clutter.KEY_Insert) {
                    this._workspaceOperationPending = true;
                }
                let modifiers = Cinnamon.get_event_state(event);
                if ((symbol === Clutter.KEY_Delete && (modifiers & ctrlAltMask) !== ctrlAltMask)
                    || symbol === Clutter.KEY_w && modifiers & Clutter.ModifierType.CONTROL_MASK)
                {
                    this._workspaceOperationPending = true;
                }
                if (symbol === Clutter.KEY_Escape) {
                    if (!this._workspaceOperationPending) {
                        this.hide();
                    }
                    this._workspaceOperationPending = false;
                    return Clutter.EVENT_STOP;
                }
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this._group.connect('key-release-event', (actor, event) => {
            if (this._shown) {
                let symbol = event.get_key_symbol();
                if (symbol === Clutter.KEY_plus || symbol === Clutter.KEY_Insert) {
                    if (this._workspaceOperationPending) {
                        this._workspaceOperationPending = false;
                        Main._addWorkspace();
                    }
                    return Clutter.EVENT_STOP;
                }
                let modifiers = Cinnamon.get_event_state(event);
                if ((symbol === Clutter.KEY_Delete && (modifiers & ctrlAltMask) !== ctrlAltMask)
                    || symbol === Clutter.KEY_w && modifiers & Clutter.ModifierType.CONTROL_MASK)
                {
                    if (this._workspaceOperationPending) {
                        this._workspaceOperationPending = false;
                        this._expo.removeSelectedWorkspace();
                    }
                    return Clutter.EVENT_STOP;
                }
                if (symbol === Clutter.KEY_Super_L || symbol === Clutter.KEY_Super_R) {
                    this.hide();
                    return Clutter.EVENT_STOP;
                }
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this._expo = new ExpoThumbnail.ExpoThumbnailsBox();
        this._group.add_actor(this._expo);
        this._relayout();
    }

    _relayout() {
        if (!this._expo) {
            // This function can be called as a response to the monitors-changed event,
            // when we're not showing.
            return;
        }
        // To avoid updating the position and size of the workspaces
        // we just hide the overview. The positions will be updated
        // when it is next shown.
        this.hide();

        let monitorSetting = global.settings.get_boolean('workspace-expo-primary-monitor') ? Main.layoutManager.primaryMonitor : Main.layoutManager.currentMonitor;
        let rtl = (St.Widget.get_default_direction () == St.TextDirection.RTL);

        let contentY = 0;
        let contentHeight = monitorSetting.height;

        this._group.set_position(monitorSetting.x, monitorSetting.y);
        this._group.set_size(monitorSetting.width, monitorSetting.height);

        this._gradient.set_position(0, 0);
        this._gradient.set_size(monitorSetting.width, monitorSetting.height);

        this._coverPane.set_position(0, 0);
        this._coverPane.set_size(monitorSetting.width, contentHeight);

        let viewWidth = monitorSetting.width - this._spacing;
        let viewHeight = contentHeight - 2 * this._spacing;
        let viewY = contentY + this._spacing;
        let viewX = rtl ? 0 : this._spacing;

        let node = this._addWorkspaceButton.get_theme_node();
        let buttonWidth = node.get_length('width');
        let buttonHeight = node.get_length('height');

        node = this._windowCloseArea.get_theme_node();
        this._windowCloseArea.height = node.get_length('height');
        this._windowCloseArea.width = node.get_length('width');

        this._expo.set_position(0, 0);
        this._expo.set_size((monitorSetting.width - buttonWidth), monitorSetting.height);

        let buttonY = (monitorSetting.height - buttonHeight) / 2;

        this._addWorkspaceButton.set_position((monitorSetting.width - buttonWidth), buttonY);
        this._addWorkspaceButton.set_size(buttonWidth, buttonHeight);
        if (this._addWorkspaceButton.get_theme_node().get_background_image() == null)
            this._addWorkspaceButton.set_style('background-image: url("/usr/share/cinnamon/theme/add-workspace.png");');

        this._windowCloseArea.set_position((monitorSetting.width - this._windowCloseArea.width) / 2 , monitorSetting.height);
        this._windowCloseArea.set_size(this._windowCloseArea.width, this._windowCloseArea.height);
        this._windowCloseArea.raise_top();
    }

    _showCloseArea() {
        let monitorSetting = global.settings.get_boolean('workspace-expo-primary-monitor') ? Main.layoutManager.primaryMonitor : Main.layoutManager.currentMonitor;
        this._windowCloseArea.show();
        this._windowCloseArea.ease({
            y: monitorSetting.height - this._windowCloseArea.height,
            duration: Main.animations_enabled ? ANIMATION_TIME : 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }

    _hideCloseArea() {
        let monitorSetting = global.settings.get_boolean('workspace-expo-primary-monitor') ? Main.layoutManager.primaryMonitor : Main.layoutManager.currentMonitor;
        this._windowCloseArea.ease({
            y: monitorSetting.height,
            duration: Main.animations_enabled ? ANIMATION_TIME : 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });
    }

    show() {
        if (this._shown || this.animationInProgress)
            return;
        this.beforeShow();
        // Do this manually instead of using _syncInputMode, to handle failure
        if (!Main.pushModal(this._group, undefined, undefined, Cinnamon.ActionMode.EXPO))
            return;
        this._modal = true;
        this._shown = true;
        this._animateVisible();
    }

    _animateVisible() {
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
        Meta.disable_unredirect_for_display(global.display);
        global.window_group.hide();
        this._group.show();
        this._background.show();
        this._addWorkspaceButton.show();
        this._expo.show();

        this._expo.connectObject(
            'drag-begin', this._showCloseArea.bind(this),
            'drag-end', this._hideCloseArea.bind(this), this);

        let activeWorkspace = this._expo.lastActiveWorkspace;
        let monitorSetting = global.settings.get_boolean('workspace-expo-primary-monitor') ? Main.layoutManager.primaryMonitor : Main.layoutManager.currentMonitor;

        this._gradient.show();
        Main.panelManager.disablePanels();

        activeWorkspace.setOverviewMode(true);

        this._coverPane.raise_top();
        this._coverPane.show();
        this.emit('showing');

        if (!Main.animations_enabled) {
            this._showDone();
            return;
        }

        //We need to allocate activeWorkspace before we begin its clone animation
        this._allocateID = this._expo.connect('allocated', () => {
            this._expo.disconnect(this._allocateID);
            this._allocateID = 0;

            let items = Main.layoutManager.monitors.map(monitor => {
                let clone = new Clutter.Clone({source: activeWorkspace});
                global.overlay_group.add_actor(clone);
                clone.set_clip(monitor.x, monitor.y, monitor.width, monitor.height);
                return { cleanupActor: clone, clone };
            });

            this._activeAnim = { items, direction: 'show' };
            this._runAnimation(true);
        });
    }

    // Return a 0..1 progress value for the currently-running transition on
    // one of the active clones, or 1 if nothing is running. Progress is
    // unitless so it's invariant to slow-down-factor (which would double-
    // scale an elapsed-ms value).
    _sampleAnimProgress() {
        for (let {clone} of this._activeAnim.items) {
            let t = clone.get_transition('x');
            if (t) {
                let total = t.get_duration();
                return total > 0 ? Math.min(1, t.get_elapsed_time() / total) : 1;
            }
        }
        return 1;
    }

    hide(options) {
        if (!this._shown)
            return;

        this._shown = false;
        this._animateNotVisible(options);
        this._syncInputMode();
    }

    toggle() {
        if (this._shown)
            this.hide();
        else
            this.show();
    }

    _syncInputMode() {
        // We delay input mode changes during animation so that when removing the
        // overview we don't have a problem with the release of a press/release
        // going to an application.
        if (this.animationInProgress)
            return;

        if (this._shown) {
            if (!this._modal) {
                if (Main.pushModal(this._group, undefined, undefined, Cinnamon.ActionMode.EXPO))
                    this._modal = true;
                else
                    this.hide();
            }
        } else {
            if (this._modal) {
                if (this._group != null)
                    Main.popModal(this._group);
                this._modal = false;
            }
            else if (global.stage_input_mode == Cinnamon.StageInputMode.FULLSCREEN)
                global.stage_input_mode = Cinnamon.StageInputMode.NORMAL;
        }
    }

    _animateNotVisible(options) {
        // Cancel-before-allocated: _animateVisible set up the expo but is still
        // waiting on _expo::allocated to build clones. Disconnect the pending
        // handler and fall through to the snap-hide path below — we can't run
        // a hide animation because the workspace actor isn't allocated yet.
        let snapToHidden = false;
        if (this._allocateID) {
            this._expo.disconnect(this._allocateID);
            this._allocateID = 0;
            this.animationInProgress = false;
            snapToHidden = true;
        }

        // Cancel-during-show: reverse the in-progress show instead of bailing.
        if (this.animationInProgress && !this._hideInProgress && this._activeAnim) {
            this._reverseShowToHide(options);
            return;
        }

        if (!this.visible || this.animationInProgress)
            return;

        let activeWorkspace = this._expo.lastActiveWorkspace;

        if (!options || !options.toScale ) {
            Main.panelManager.enablePanels();
            activeWorkspace.overviewModeOff(true, true);
        }

        if (snapToHidden || !Main.animations_enabled) {
            this._group.hide();
            this._hideDone();
            return;
        }

        this.animationInProgress = true;
        this._hideInProgress = true;

        let monitorSetting = global.settings.get_boolean('workspace-expo-primary-monitor') ? Main.layoutManager.primaryMonitor : Main.layoutManager.currentMonitor;

        let items = Main.layoutManager.monitors.map(monitor => {
            let cover = new Clutter.Group();
            global.overlay_group.add_actor(cover);
            cover.set_position(0, 0);
            cover.set_clip(monitor.x, monitor.y, monitor.width, monitor.height);

            let clone = new Clutter.Clone({source: activeWorkspace});
            cover.add_actor(clone);
            clone.set_position(monitorSetting.x + activeWorkspace.allocation.x1, monitorSetting.y + activeWorkspace.allocation.y1);
            clone.set_clip(monitor.x, monitor.y, monitor.width, monitor.height);
            clone.set_scale(activeWorkspace.get_scale()[0], activeWorkspace.get_scale()[1]);

            return { cleanupActor: cover, clone };
        });

        this._activeAnim = { items, direction: 'hide' };
        this._runAnimation(false);

        this.emit('hiding');
    }

    _reverseShowToHide(options) {
        let activeWorkspace = this._expo.lastActiveWorkspace;

        // Sample the current show's progress so the reversed hide unwinds
        // in proportion to how far the show actually got.
        let progress = this._sampleAnimProgress();

        if (!options || !options.toScale) {
            Main.panelManager.enablePanels();
            activeWorkspace.overviewModeOff(true, true);
        }

        this._hideInProgress = true;
        this._activeAnim = { items: this._activeAnim.items, direction: 'hide' };

        this.emit('hiding');

        this._runAnimation(false, progress);
    }

    _runAnimation(toShow, reverseProgress = null) {
        let activeWorkspace = this._expo.lastActiveWorkspace;
        let monitorSetting = global.settings.get_boolean('workspace-expo-primary-monitor') ? Main.layoutManager.primaryMonitor : Main.layoutManager.currentMonitor;

        // On reversal, drop any items whose cleanupActor was already destroyed
        // by a previously-completed ease — re-easing a destroyed clone would
        // crash or no-op silently.
        this._activeAnim.items = this._activeAnim.items.filter(
            ({cleanupActor}) => cleanupActor.get_parent() !== null);

        let myAnim = this._activeAnim;
        let items = myAnim.items;
        let total = items.length;
        let completed = 0;

        const finalize = () => {
            if (this._activeAnim !== myAnim)
                return;
            this._activeAnim = null;
            if (toShow) {
                this._showDone();
            } else {
                this._group.hide();
                this._hideDone();
            }
        };

        if (total === 0) {
            finalize();
            return;
        }

        let duration = reverseProgress !== null
            ? Math.max(1, ANIMATION_TIME * reverseProgress)
            : ANIMATION_TIME;

        items.forEach(({cleanupActor, clone}) => {
            let easeParams = {
                duration,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                // onStopped (not onComplete) so an interrupted transition still
                // advances the counter.
                onStopped: (isFinished) => {
                    if (!isFinished && this._activeAnim !== myAnim)
                        return;
                    if (cleanupActor.get_parent() !== null) {
                        global.overlay_group.remove_actor(cleanupActor);
                        cleanupActor.destroy();
                    }
                    completed++;
                    if (completed === total)
                        finalize();
                }
            };

            if (toShow) {
                easeParams.x = monitorSetting.x + activeWorkspace.allocation.x1;
                easeParams.y = monitorSetting.y + activeWorkspace.allocation.y1;
                easeParams.scale_x = activeWorkspace.get_scale()[0];
                easeParams.scale_y = activeWorkspace.get_scale()[1];
                easeParams.onUpdate = () => {
                    clone.get_transition("x")?.set_to(monitorSetting.x + activeWorkspace.allocation.x1);
                    clone.get_transition("y")?.set_to(monitorSetting.y + activeWorkspace.allocation.y1);
                    clone.get_transition("scale-x")?.set_to(activeWorkspace.get_scale()[0]);
                    clone.get_transition("scale-y")?.set_to(activeWorkspace.get_scale()[1]);
                };
            } else {
                easeParams.x = 0;
                easeParams.y = 0;
                easeParams.scale_x = 1;
                easeParams.scale_y = 1;
            }

            clone.ease(easeParams);
        });
    }

    _showDone() {
        this.animationInProgress = false;
        this._coverPane.hide();

        this.emit('shown');

        this._syncInputMode();
        global.sync_pointer();
    }

    _hideDone() {
        Meta.enable_unredirect_for_display(global.display);

        global.window_group.show();

        this._expo.hide();
        this._addWorkspaceButton.hide();
        this._windowCloseArea.hide();

        this._background.hide();
        this._gradient.hide();

        this.visible = false;
        this.animationInProgress = false;
        this._hideInProgress = false;

        this._coverPane.hide();

        this.emit('hidden');

        this._syncInputMode();

        global.overlay_group.remove_actor(this._group);
        this._group.destroy();
        this._group = null;
        this._expo = null;

        global.overlay_group.remove_actor(this._background);
        this._background.destroy();
        this._background = null;

        Main.layoutManager._chrome.updateRegions();
    }
});
