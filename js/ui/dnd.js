// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const Tweener = imports.ui.tweener;
const Main = imports.ui.main;

const Params = imports.misc.params;

const DND_ANIMATION_TIME = 0.2;
// Time to scale down to maxDragActorSize
const SCALE_ANIMATION_TIME = 0.25;
// Time to animate to original position on cancel
const SNAP_BACK_ANIMATION_TIME = 0.25;
// Time to animate to original position on success
const REVERT_ANIMATION_TIME = 0.75;

const DragMotionResult = {
    NO_DROP:   0,
    COPY_DROP: 1,
    MOVE_DROP: 2,
    CONTINUE:  3
};

const DRAG_CURSOR_MAP = {
    0: Cinnamon.Cursor.DND_UNSUPPORTED_TARGET,
    1: Cinnamon.Cursor.DND_COPY,
    2: Cinnamon.Cursor.DND_MOVE
};

const DragDropResult = {
    FAILURE:  0,
    SUCCESS:  1,
    CONTINUE: 2
};

let eventHandlerActor = null;
let currentDraggable = null;
let dragMonitors = [];
let targetMonitors = [];

function _getEventHandlerActor() {
    if (!eventHandlerActor) {
        eventHandlerActor = new Clutter.Actor({ width: 0, height: 0 });
        Main.uiGroup.add_actor(eventHandlerActor);
        // We connect to 'event' rather than 'captured-event' because the capturing phase doesn't happen
        // when you've grabbed the pointer.
        eventHandlerActor.connect('event',
                                  function(actor, event) {
                                      return currentDraggable._onEvent(actor, event);
                                  });
    }
    return eventHandlerActor;
}

function addDragMonitor(monitor) {
    dragMonitors.push(monitor);
}

function removeDragMonitor(monitor) {
    for (let i = 0; i < dragMonitors.length; i++)
        if (dragMonitors[i] == monitor) {
            dragMonitors.splice(i, 1);
            return;
        }
}

function isDragging() {
    return currentDraggable != null;
}

const _Draggable = new Lang.Class({
    Name: 'Draggable',

    _init : function(actor, params, target) {
        params = Params.parse(params, { manualMode: false,
                                        restoreOnSuccess: false,
                                        overrideX: undefined,
                                        overrideY: undefined,
                                        dragActorMaxSize: undefined,
                                        dragActorOpacity: undefined });

        this.inhibit = false; // Use the inhibit flag to temporarily disable an object from being draggable

        this.actor = actor;
        this.target = null;

        if (target) {
            this.target = target;
        }

        this.buttonPressEventId = 0;
        this.destroyEventId = 0;

        if (!params.manualMode)
            this.buttonPressEventId = this.actor.connect('button-press-event',
                                                    Lang.bind(this, this._onButtonPress));

        this.destroyEventId = this.actor.connect('destroy', Lang.bind(this, function() {
            this._actorDestroyed = true;

            if (this._dragInProgress && this._dragCancellable)
                this._cancelDrag(global.get_current_time());
            this.disconnectAll();
        }));
        this._onEventId = null;

        this._restoreOnSuccess = params.restoreOnSuccess;
        this._dragActorMaxSize = params.dragActorMaxSize;
        this._dragActorOpacity = params.dragActorOpacity;
        this._overrideX = params.overrideX;
        this._overrideY = params.overrideY;

        this._buttonDown = false; // The mouse button has been pressed and has not yet been released.
        this._dragInProgress = false; // The drag has been started, and has not been dropped or cancelled yet.
        this._animationInProgress = false; // The drag is over and the item is in the process of animating to its original position (snapping back or reverting).
        this._dragCancellable = true;

        this._eventsGrabbed = false;
    },

    _onButtonPress : function (actor, event) {
        if (this.inhibit)
            return false;

        if (event.get_button() != 1)
            return false;

        if (Tweener.getTweenCount(actor))
            return false;

        this._buttonDown = true;
        this._grabActor();

        let [stageX, stageY] = event.get_coords();
        this._dragStartX = stageX;
        this._dragStartY = stageY;

        return false;
    },

    _grabActor: function() {
        Clutter.grab_pointer(this.actor);
        this._onEventId = this.actor.connect('event',
                                             Lang.bind(this, this._onEvent));
    },

    _ungrabActor: function() {
        if (!this._onEventId)
            return;

        Clutter.ungrab_pointer();
        this.actor.disconnect(this._onEventId);
        this._onEventId = null;
    },

    _grabEvents: function() {
        if (!this._eventsGrabbed) {
            this._eventsGrabbed = Main.pushModal(_getEventHandlerActor());
            if (this._eventsGrabbed)
                Clutter.grab_pointer(_getEventHandlerActor());
        }
    },

    _ungrabEvents: function() {
        if (this._eventsGrabbed) {
            Clutter.ungrab_pointer();
            Main.popModal(_getEventHandlerActor());
            this._eventsGrabbed = false;
        }
    },

    _onEvent: function(actor, event) {
        // We intercept BUTTON_RELEASE event to know that the button was released in case we
        // didn't start the drag, to drop the draggable in case the drag was in progress, and
        // to complete the drag and ensure that whatever happens to be under the pointer does
        // not get triggered if the drag was cancelled with Esc.
        if (event.type() == Clutter.EventType.BUTTON_RELEASE) {
            this._buttonDown = false;
            if (this._dragInProgress) {
                return this._dragActorDropped(event);
            } else if (this._dragActor != null && !this._animationInProgress) {
                // Drag must have been cancelled with Esc.
                this._dragComplete();
                return true;
            } else {
                // Drag has never started.
                this._ungrabActor();
                return false;
            }
        // We intercept MOTION event to figure out if the drag has started and to draw
        // this._dragActor under the pointer when dragging is in progress
        } else if (event.type() == Clutter.EventType.MOTION) {
            if (this._dragInProgress) {
                return this._updateDragPosition(event);
            } else if (this._dragActor == null) {
                return this._maybeStartDrag(event);
            }
        // We intercept KEY_PRESS event so that we can process Esc key press to cancel
        // dragging and ignore all other key presses.
        } else if (event.type() == Clutter.EventType.KEY_PRESS && this._dragInProgress) {
            let symbol = event.get_key_symbol();
            if (symbol == Clutter.Escape) {
                this._cancelDrag(event.get_time());
                return true;
            }
        }

        return false;
    },

    /**
     * fakeRelease:
     *
     * Fake a release event.
     * Must be called if you want to intercept release events on draggable
     * actors for other purposes (for example if you're using
     * PopupMenu.ignoreRelease())
     */
    fakeRelease: function() {
        this._buttonDown = false;
        this._ungrabActor();
    },

    /**
     * startDrag:
     * @stageX: X coordinate of event
     * @stageY: Y coordinate of event
     * @time: Event timestamp
     *
     * Directly initiate a drag and drop operation from the given actor.
     * This function is useful to call if you've specified manualMode
     * for the draggable.
     */
    startDrag: function (stageX, stageY, time) {
        currentDraggable = this;
        this._dragInProgress = true;

        // Special-case St.Button: the pointer grab messes with the internal
        // state, so force a reset to a reasonable state here
        if (this.actor instanceof St.Button) {
            this.actor.fake_release();
            this.actor.hover = false;
        }

        this.emit('drag-begin', time);
        if (this._onEventId)
            this._ungrabActor();
        this._grabEvents();
        global.set_cursor(Cinnamon.Cursor.DND_IN_DRAG);

        this._dragX = this._dragStartX = stageX;
        this._dragY = this._dragStartY = stageY;

        if (this.actor._delegate && this.actor._delegate.getDragActor) {
            this._dragActor = this.actor._delegate.getDragActor();
            this._dragActor.reparent(Main.uiGroup);
            this._dragActor.raise_top();
            Cinnamon.util_set_hidden_from_pick(this._dragActor, true);

            // Drag actor does not always have to be the same as actor. For example drag actor
            // can be an image that's part of the actor. So to perform "snap back" correctly we need
            // to know what was the drag actor source.
            if (this.actor._delegate.getDragActorSource) {
                this._dragActorSource = this.actor._delegate.getDragActorSource();
                // If the user dragged from the source, then position
                // the dragActor over it. Otherwise, center it
                // around the pointer
                let [sourceX, sourceY] = this._dragActorSource.get_transformed_position();
                let x, y;
                if (stageX > sourceX && stageX <= sourceX + this._dragActor.width &&
                    stageY > sourceY && stageY <= sourceY + this._dragActor.height) {
                    x = sourceX;
                    y = sourceY;
                } else {
                    x = stageX - this._dragActor.width / 2;
                    y = stageY - this._dragActor.height / 2;
                }
                this._dragActor.set_position(x, y);
            } else {
                this._dragActorSource = this.actor;
            }
            this._dragOrigParent = undefined;

            this._dragOffsetX = this._dragActor.x - this._dragStartX;
            this._dragOffsetY = this._dragActor.y - this._dragStartY;
        } else {
            this._dragActor = this.actor;

            this._dragActorSource = undefined;
            this._dragOrigParent = this.actor.get_parent();
            this._dragOrigX = this._dragActor.x;
            this._dragOrigY = this._dragActor.y;
            this._dragOrigScale = this._dragActor.scale_x;

            // Set the actor's scale such that it will keep the same
            // transformed size when it's reparented to the uiGroup
            let [scaledWidth, scaledHeight] = this.actor.get_transformed_size();
            this._dragActor.set_scale(scaledWidth / this.actor.width,
                                      scaledHeight / this.actor.height);

            let [actorStageX, actorStageY] = this.actor.get_transformed_position();
            this._dragOffsetX = actorStageX - this._dragStartX;
            this._dragOffsetY = actorStageY - this._dragStartY;

            this._dragActor.reparent(Main.uiGroup);
            this._dragActor.raise_top();
            Cinnamon.util_set_hidden_from_pick(this._dragActor, true);
        }

        this._dragOrigOpacity = this._dragActor.opacity;
        if (this._dragActorOpacity != undefined)
            this._dragActor.opacity = this._dragActorOpacity;

        this._snapBackX = this._dragStartX + this._dragOffsetX;
        this._snapBackY = this._dragStartY + this._dragOffsetY;
        this._snapBackScale = this._dragActor.scale_x;

        if (this._dragActorMaxSize != undefined) {
            let [scaledWidth, scaledHeight] = this._dragActor.get_transformed_size();
            let currentSize = Math.max(scaledWidth, scaledHeight);
            if (currentSize > this._dragActorMaxSize) {
                let scale = this._dragActorMaxSize / currentSize;
                let origScale =  this._dragActor.scale_x;
                let origDragOffsetX = this._dragOffsetX;
                let origDragOffsetY = this._dragOffsetY;

                // The position of the actor changes as we scale
                // around the drag position, but we can't just tween
                // to the final position because that tween would
                // fight with updates as the user continues dragging
                // the mouse; instead we do the position computations in
                // an onUpdate() function.
                Tweener.addTween(this._dragActor,
                                 { scale_x: scale * origScale,
                                   scale_y: scale * origScale,
                                   time: SCALE_ANIMATION_TIME,
                                   transition: 'easeOutQuad',
                                   onUpdate: function() {
                                       let currentScale = this._dragActor.scale_x / origScale;
                                       this._dragOffsetX = currentScale * origDragOffsetX;
                                       this._dragOffsetY = currentScale * origDragOffsetY;
                                       this._setDragActorPosition();
                                   },
                                   onUpdateScope: this });
            }
        }
    },

    _maybeStartDrag:  function(event) {
        let [stageX, stageY] = event.get_coords();

        // See if the user has moved the mouse enough to trigger a drag
        let threshold = Gtk.Settings.get_default().gtk_dnd_drag_threshold;
        if ((Math.abs(stageX - this._dragStartX) > threshold ||
             Math.abs(stageY - this._dragStartY) > threshold)) {
                this.startDrag(stageX, stageY, event.get_time());
                this._updateDragPosition(event);
        }

        return true;
    },

    _updateDragHover : function () {
        this._updateHoverId = 0;
        let target = null;

        let x = this._overrideX == undefined ? this._dragX : this._overrideX;
        let y = this._overrideY == undefined ? this._dragY : this._overrideY;

        if (this.target)
            target = this.target;
        else
            target = this._dragActor.get_stage().get_actor_at_pos(Clutter.PickMode.ALL, x, y);

        let dragEvent = {
            x: this._dragX,
            y: this._dragY,
            dragActor: this._dragActor,
            source: this.actor._delegate,
            targetActor: target
        };
        for (let i = 0; i < dragMonitors.length; i++) {
            let motionFunc = dragMonitors[i].dragMotion;
            if (motionFunc) {
                let result = motionFunc(dragEvent);
                if (result != DragMotionResult.CONTINUE) {
                    global.set_cursor(DRAG_CURSOR_MAP[result]);
                    return false;
                }
            }
        }

        while (target) {
            if (target._delegate && target._delegate.handleDragOver) {
                let [r, targX, targY] = target.transform_stage_point(x, y);
                // We currently loop through all parents on drag-over even if one of the children has handled it.
                // We can check the return value of the function and break the loop if it's true if we don't want
                // to continue checking the parents.
                let result = target._delegate.handleDragOver(this.actor._delegate,
                                                             this._dragActor,
                                                             targX,
                                                             targY,
                                                             0);
                if (result != DragMotionResult.CONTINUE) {
                    global.set_cursor(DRAG_CURSOR_MAP[result]);
                    return false;
                }
            }
            target = target.get_parent();
        }
        global.set_cursor(Cinnamon.Cursor.DND_IN_DRAG);
        return false;
    },

    _queueUpdateDragHover: function() {
        if (this._updateHoverId) {
            GLib.source_remove(this._updateHoverId);
            this._updateHoverId = 0;
        }

        this._updateHoverId = GLib.idle_add(GLib.PRIORITY_DEFAULT,
                                            Lang.bind(this, this._updateDragHover));
    },

    _updateDragPosition : function (event) {
        let [stageX, stageY] = event.get_coords();
        this._dragX = stageX;
        this._dragY = stageY;

        this._setDragActorPosition();

        this._queueUpdateDragHover();
        return true;
    },

    _setDragActorPosition: function() {
        this._dragActor.x = this._overrideX == undefined ?
            this._dragX + this._dragOffsetX : this._overrideX;

        this._dragActor.y = this._overrideY == undefined ?
            this._dragY + this._dragOffsetY : this._overrideY;
    },

    _dragActorDropped: function(event) {
        let [dropX, dropY] = event.get_coords();
        let target = null;

        if (this._overrideX != undefined) dropX = this._overrideX;
        if (this._overrideY != undefined) dropY = this._overrideY;

        if (this.target)
            target = this.target;
        else
            target = this._dragActor.get_stage().get_actor_at_pos(Clutter.PickMode.ALL,
                                                                  dropX, dropY);

        // We call observers only once per motion with the innermost
        // target actor. If necessary, the observer can walk the
        // parent itself.
        let dropEvent = {
            dropActor: this._dragActor,
            targetActor: target,
            clutterEvent: event
        };
        for (let i = 0; i < dragMonitors.length; i++) {
            let dropFunc = dragMonitors[i].dragDrop;
            if (dropFunc)
                switch (dropFunc(dropEvent)) {
                    case DragDropResult.FAILURE:
                    case DragDropResult.SUCCESS:
                        return true;
                    case DragDropResult.CONTINUE:
                        continue;
                }
        }

        // At this point it is too late to cancel a drag by destroying
        // the actor, the fate of which is decided by acceptDrop and its
        // side-effects
        this._dragCancellable = false;

        while (target) {
            if (target._delegate && target._delegate.acceptDrop) {
                let [r, targX, targY] = target.transform_stage_point(dropX, dropY);
                if (target._delegate.acceptDrop(this.actor._delegate,
                                                this._dragActor,
                                                targX,
                                                targY,
                                                event.get_time())) {
                    // If it accepted the drop without taking the actor,
                    // handle it ourselves.
                    if (this._dragActor.get_parent() == Main.uiGroup) {
                        if (this._restoreOnSuccess) {
                            this._restoreDragActor(event.get_time());
                            return true;
                        } else
                            this._dragActor.destroy();
                    }

                    this._dragInProgress = false;
                    global.unset_cursor();
                    this.emit('drag-end', event.get_time(), true);
                    this._dragComplete();
                    return true;
                }
            }
            target = target.get_parent();
        }

        this._cancelDrag(event.get_time());

        return true;
    },

    _getRestoreLocation: function() {
        let x, y, scale;

        if (this._dragActorSource && this._dragActorSource.visible) {
            // Snap the clone back to its source
            [x, y] = this._dragActorSource.get_transformed_position();
            let [sourceScaledWidth, sourceScaledHeight] = this._dragActorSource.get_transformed_size();
            scale = this._dragActor.width / sourceScaledWidth;
        } else if (this._dragOrigParent) {
            // Snap the actor back to its original position within
            // its parent, adjusting for the fact that the parent
            // may have been moved or scaled
            let [parentX, parentY] = this._dragOrigParent.get_transformed_position();
            let [parentWidth, parentHeight] = this._dragOrigParent.get_size();
            let [parentScaledWidth, parentScaledHeight] = this._dragOrigParent.get_transformed_size();
            let parentScale = 1.0;
            if (parentWidth != 0)
                parentScale = parentScaledWidth / parentWidth;

            x = parentX + parentScale * this._dragOrigX;
            y = parentY + parentScale * this._dragOrigY;
            scale = this._dragOrigScale * parentScale;
        } else {
            // Snap back actor to its original stage position
            x = this._snapBackX;
            y = this._snapBackY;
            scale = this._snapBackScale;
        }

        return [x, y, scale];
    },

    _cancelDrag: function(eventTime) {
        this.emit('drag-cancelled', eventTime);
        this._dragInProgress = false;
        let [snapBackX, snapBackY, snapBackScale] = this._getRestoreLocation();

        if (this._actorDestroyed) {
            global.unset_cursor();
            if (!this._buttonDown)
                this._dragComplete();
            this.emit('drag-end', eventTime, false);
            if (!this._dragOrigParent)
                this._dragActor.destroy();

            return;
        }

        this._animationInProgress = true;
        // No target, so snap back
        Tweener.addTween(this._dragActor,
                         { x: snapBackX,
                           y: snapBackY,
                           scale_x: snapBackScale,
                           scale_y: snapBackScale,
                           opacity: this._dragOrigOpacity,
                           time: SNAP_BACK_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onComplete: this._onAnimationComplete,
                           onCompleteScope: this,
                           onCompleteParams: [this._dragActor, eventTime]
                         });
    },

    _restoreDragActor: function(eventTime) {
        this._dragInProgress = false;
        [restoreX, restoreY, restoreScale] = this._getRestoreLocation();

        // fade the actor back in at its original location
        this._dragActor.set_position(restoreX, restoreY);
        this._dragActor.set_scale(restoreScale, restoreScale);
        this._dragActor.opacity = 0;

        this._animationInProgress = true;
        Tweener.addTween(this._dragActor,
                         { opacity: this._dragOrigOpacity,
                           time: REVERT_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onComplete: this._onAnimationComplete,
                           onCompleteScope: this,
                           onCompleteParams: [this._dragActor, eventTime]
                         });
    },

    _onAnimationComplete : function (dragActor, eventTime) {
        if (this._dragOrigParent) {
            dragActor.reparent(this._dragOrigParent);
            dragActor.set_scale(this._dragOrigScale, this._dragOrigScale);
            dragActor.set_position(this._dragOrigX, this._dragOrigY);
        } else {
            dragActor.destroy();
        }
        global.unset_cursor();
        this.emit('drag-end', eventTime, false);

        this._animationInProgress = false;
        if (!this._buttonDown)
            this._dragComplete();
    },

    _dragComplete: function() {
        if (!this._actorDestroyed)
            Cinnamon.util_set_hidden_from_pick(this._dragActor, false);

        this._ungrabEvents();
        global.sync_pointer();

        if (this._updateHoverId) {
            GLib.source_remove(this._updateHoverId);
            this._updateHoverId = 0;
        }

        this._dragActor = undefined;
        currentDraggable = null;
    }
});

Signals.addSignalMethods(_Draggable.prototype);

/**
 * makeDraggable:
 * @actor: Source actor
 * @params: (optional) Additional parameters
 *
 * Create an object which controls drag and drop for the given actor.
 *
 * If %manualMode is %true in @params, do not automatically start
 * drag and drop on click
 *
 * If %dragActorMaxSize is present in @params, the drag actor will
 * be scaled down to be no larger than that size in pixels.
 *
 * If %dragActorOpacity is present in @params, the drag actor will
 * will be set to have that opacity during the drag.
 *
 * Note that when the drag actor is the source actor and the drop
 * succeeds, the actor scale and opacity aren't reset; if the drop
 * target wants to reuse the actor, it's up to the drop target to
 * reset these values.
 */
function makeDraggable(actor, params, target) {
    return new _Draggable(actor, params, target);
}

function GenericDragItemContainer() {
    this._init();
}

GenericDragItemContainer.prototype = {
    _init: function() {
        this.actor = new Cinnamon.GenericContainer({ style_class: 'drag-item-container' });
        this.actor.connect('get-preferred-width',
                           Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height',
                           Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate',
                           Lang.bind(this, this._allocate));
        this.actor._delegate = this;

        this.child = null;
        this._childScale = 1;
        this._childOpacity = 255;
        this.animatingOut = false;
    },

    _allocate: function(actor, box, flags) {
        if (this.child == null)
            return;

        let availWidth = box.x2 - box.x1;
        let availHeight = box.y2 - box.y1;
        let [minChildWidth, minChildHeight, natChildWidth, natChildHeight] =
            this.child.get_preferred_size();
        let [childScaleX, childScaleY] = this.child.get_scale();

        let childWidth = Math.min(natChildWidth * childScaleX, availWidth);
        let childHeight = Math.min(natChildHeight * childScaleY, availHeight);

        let childBox = new Clutter.ActorBox();
        childBox.x1 = (availWidth - childWidth) / 2;
        childBox.y1 = (availHeight - childHeight) / 2;
        childBox.x2 = childBox.x1 + childWidth;
        childBox.y2 = childBox.y1 + childHeight;

        this.child.allocate(childBox, flags);
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {
        alloc.min_size = 0;
        alloc.natural_size = 0;

        if (this.child == null)
            return;

        let [minHeight, natHeight] = this.child.get_preferred_height(forWidth);
        alloc.min_size += minHeight * this.child.scale_y;
        alloc.natural_size += natHeight * this.child.scale_y;
    },

    _getPreferredWidth: function(actor, forHeight, alloc) {
        alloc.min_size = 0;
        alloc.natural_size = 0;

        if (this.child == null)
            return;

        let [minWidth, natWidth] = this.child.get_preferred_width(forHeight);
        alloc.min_size = minWidth * this.child.scale_y;
        alloc.natural_size = natWidth * this.child.scale_y;
    },

    setChild: function(actor) {
        if (this.child == actor)
            return;

        this.actor.destroy_all_children();

        this.child = actor;
        this.actor.add_actor(this.child);
    },

    animateIn: function() {
        if (this.child == null)
            return;

        this.childScale = 0;
        this.childOpacity = 0;
        Tweener.addTween(this,
                         { childScale: 1.0,
                           childOpacity: 255,
                           time: DND_ANIMATION_TIME,
                           transition: 'easeOutQuad'
                         });
    },

    animateOutAndDestroy: function() {
        if (this.child == null) {
            this.actor.destroy();
            return;
        }

        this.animatingOut = true;
        this.childScale = 1.0;
        Tweener.addTween(this,
                         { childScale: 0.0,
                           childOpacity: 0,
                           time: DND_ANIMATION_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this, function() {
                               this.actor.destroy();
                           })
                         });
    },

    set childScale(scale) {
        this._childScale = scale;

        if (this.child == null)
            return;

        this.child.set_scale_with_gravity(scale, scale,
                                          Clutter.Gravity.CENTER);
        this.actor.queue_relayout();
    },

    get childScale() {
        return this._childScale;
    },

    set childOpacity(opacity) {
        this._childOpacity = opacity;

        if (this.child == null)
            return;

        this.child.set_opacity(opacity);
        this.actor.queue_redraw();
    },

    get childOpacity() {
        return this._childOpacity;
    }
};

function GenericDragPlaceholderItem() {
    this._init();
}

GenericDragPlaceholderItem.prototype = {
    __proto__: GenericDragItemContainer.prototype,

    _init: function() {
        GenericDragItemContainer.prototype._init.call(this);
        this.setChild(new St.Bin({ style_class: 'drag-placeholder' }));
    }
};

function LauncherDraggable() {
    this._init();
}

LauncherDraggable.prototype = {
    _init: function() {
        this.launchersBox = null;
    },

    getId: function() {
        /* Implemented by draggable launchers */
        global.logError("Could not complete drag-and-drop.  Launcher does not implement LauncherDraggable");
    }
};
