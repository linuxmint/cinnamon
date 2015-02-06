// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const Tweener = imports.ui.tweener;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Desklet = imports.ui.desklet;
const Meta = imports.gi.Meta
const Params = imports.misc.params;

// Time to scale down to maxDragActorSize
const SCALE_ANIMATION_TIME = 0.25;
// Time to animate to original position on cancel
const SNAP_BACK_ANIMATION_TIME = 0.25;
// Time to animate to original position on success
const REVERT_ANIMATION_TIME = 0.75;

// Time to wait patiently for events while dragging
const DRAG_EVENT_TIMEOUT_MS = 5000;

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

const DND_ANIMATION_TIME = 0.2;

let eventHandlerActor = null;
let currentDraggable = null;
let dragMonitors = [];

function isDragging() {
    return currentDraggable != null;
}

function _getEventHandlerActor() {
    if (!eventHandlerActor) {
        eventHandlerActor = new Clutter.Rectangle();
        eventHandlerActor.width = 0;
        eventHandlerActor.height = 0;
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

function _Draggable(actor, params, target) {
    this._init(actor, params, target);
}

_Draggable.prototype = {
    _init : function(actor, params, target) {
        
        this.inhibit = false; // Use the inhibit flag to temporarily disable an object from being draggable
        
        params = Params.parse(params, { manualMode: false,
                                        restoreOnSuccess: false,
                                        dragActorMaxSize: undefined,
                                        dragActorOpacity: undefined });

        this.actor = actor;
        this.target = target;

        if (!params.manualMode)
            this.actor.connect('button-press-event',
                               Lang.bind(this, this._onButtonPress));

        this.actor.connect('destroy', Lang.bind(this, function() {
            this._actorDestroyed = true;
            // If the drag actor is destroyed and we were going to fix
            // up its hover state, fix up the parent hover state instead
            if (this.actor == this._firstLeaveActor)
                this._firstLeaveActor = this._dragOrigParent;
            if (this._dragInProgress)
                this._cancelDrag(global.get_current_time());
            this.disconnectAll();
        }));
        this._onEventId = null;

        this._restoreOnSuccess = params.restoreOnSuccess;
        this._dragActorMaxSize = params.dragActorMaxSize;
        this._dragActorOpacity = params.dragActorOpacity;

        this._buttonDown = false; // The mouse button has been pressed and has not yet been released.
        this._dragInProgress = false; // The drag has been started, and has not been dropped or cancelled yet.
        this._animationInProgress = false; // The drag is over and the item is in the process of animating to its original position (snapping back or reverting).

        // During the drag, we eat enter/leave events so that actors don't prelight or show
        // tooltips. But we remember the actors that we first left/last entered so we can
        // fix up the hover state after the drag ends.
        this._firstLeaveActor = null;
        this._lastEnterActor = null;

        this._eventsGrabbed = false;

        this._dragCheckId = null;
    },

    _onButtonPress : function (actor, event) {
        if (!this.inhibit) {
            if (event.get_button() != 1)
                return false;

            if (Tweener.getTweenCount(actor))
                return false;

            this._buttonDown = true;
            // special case St.Button: grabbing the pointer would mess up the
            // internal state, so we start the drag manually on hover change
            if (this.actor instanceof St.Button)
                this.actor.connect('notify::hover',
                                   Lang.bind(this, this._onButtonHoverChanged));
            else
                this._grabActor();

            let [stageX, stageY] = event.get_coords();
            this._dragStartX = stageX;
            this._dragStartY = stageY;
        }

        return false;
    },

    _onButtonHoverChanged: function(button) {        
        if (button.hover || !button.pressed)
            return;

        button.fake_release();
        this.startDrag(this._dragStartX, this._dragStartY,
                       global.get_current_time());        
    },

    _grabActor: function() {
        Clutter.grab_pointer(this.actor);
        this._onEventId = this.actor.connect('event',
                                             Lang.bind(this, this._onEvent));
    },

    _ungrabActor: function() {
        Clutter.ungrab_pointer();
        if (!this._onEventId)
            return;
        this.actor.disconnect(this._onEventId);
        this._onEventId = null;
    },

    _grabEvents: function() {
        if (!this._eventsGrabbed) {
            let eha = _getEventHandlerActor();
            Clutter.grab_pointer(eha);
            this.previousKeyFocusActor = global.stage.get_key_focus();
            eha.grab_key_focus();
            this._eventsGrabbed = true;
        }
    },

    _ungrabEvents: function() {
        if (this._eventsGrabbed) {
            if (this.previousKeyFocusActor) {
                this.previousKeyFocusActor.grab_key_focus();
            }
            Clutter.ungrab_pointer();
            this._eventsGrabbed = false;
        }
    },

    _onEvent: function(actor, event) {
        // prevent the watchdog timer from firing, for a while
        this._setTimer(true);
        
        // Intercept BUTTON_PRESS to try to address a drag in progress condition 'dragging'
        // on interminably - you started dragging, went off the panels, released the mouse
        // button (which we can't track when you're not over a panel) then went back
        // over a panel - you're in an in between state, no longer wanting to drag, but
        // we still think you are.  This will cancel the drag if it senses a button press,
        // assuming we'd never complete a drag with a press, only a release.
        //
        // We intercept BUTTON_RELEASE event to know that the button was released in case we
        // didn't start the drag, to drop the draggable in case the drag was in progress, and
        // to complete the drag and ensure that whatever happens to be under the pointer does
        // not get triggered if the drag was cancelled with Esc.
        if (event.type() == Clutter.EventType.BUTTON_PRESS && this._dragInProgress) {
            this._cancelDrag(event.get_time());
        } else if (event.type() == Clutter.EventType.BUTTON_RELEASE) {
            this._buttonDown = false;
            if (this._dragInProgress) {
                if (this.actor._delegate._isTracked || !(this.actor._delegate instanceof Desklet.Desklet))
                    return this._dragActorDropped(event);
                else {
                    this._cancelDrag();
                    return true;
                }
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
                if (this._buttonDown)
                    return this._maybeStartDrag(event);
                else {
                    this._dragComplete()
                    return true;
                }
            }
        } else if (event.type() == Clutter.EventType.LEAVE) {
            if (this._firstLeaveActor == null)
                this._firstLeaveActor = event.get_source();
        } else if (event.type() == Clutter.EventType.ENTER) {
            this._lastEnterActor = event.get_source();
        } else if (event.type() == Clutter.EventType.KEY_PRESS) {
            if (event.get_key_symbol() === Clutter.Escape) {
                this._cancelDrag(event.get_time());
            }
            return true; // swallow all keyboard input during drag
        }

        return false;
    },

    _setTimer: function(renew) {
        if (this._dragEventTimeoutId) {
            Mainloop.source_remove(this._dragEventTimeoutId);
            this._dragEventTimeoutId = 0;
        }
        if (renew) {
            this._dragEventTimeoutId = Mainloop.timeout_add(DRAG_EVENT_TIMEOUT_MS, 
                Lang.bind(this, function() {
                    if (this._dragInProgress) {
                        this._cancelDrag();
                        // _dragComplete is not always called by _cancelDrag.
                        this._dragComplete();
                    }
                    this._dragEventTimeoutId = 0;
                    return false;
                }));
        }
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
        this._setTimer(true); // activate the watchdog timer

        currentDraggable = this;
        this._dragInProgress = true;

        this.emit('drag-begin', time);
        if (this._onEventId)
            this._ungrabActor();
        this._grabEvents();
        global.set_cursor(Cinnamon.Cursor.DND_IN_DRAG);

        this._dragX = this._dragStartX = stageX;
        this._dragY = this._dragStartY = stageY;

        if (this.actor._delegate && this.actor._delegate.getDragActor) {
            this._dragActor = this.actor._delegate.getDragActor(this._dragStartX, this._dragStartY);
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

            let [actorStageX, actorStageY] = this.actor.get_transformed_position();
            this._dragOffsetX = actorStageX - this._dragStartX;
            this._dragOffsetY = actorStageY - this._dragStartY;

            // Set the actor's scale such that it will keep the same
            // transformed size when it's reparented to the uiGroup
            let [scaledWidth, scaledHeight] = this.actor.get_transformed_size();
            this.actor.set_scale(scaledWidth / this.actor.width,
                                 scaledHeight / this.actor.height);
        }

        global.reparentActor(this._dragActor, Main.uiGroup);
        this._dragActor.raise_top();
        Cinnamon.util_set_hidden_from_pick(this._dragActor, true);

        Main.pushModal(this._dragActor, global.get_current_time());

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
                                       this._dragActor.set_position(this._dragX + this._dragOffsetX,
                                                                    this._dragY + this._dragOffsetY);
                                   },
                                   onUpdateScope: this });
            }
        }
    },

    _checkThreshold: function(x, y) {
        if (!this._buttonDown) {
            this._dragCheckId = null;
            return false;
        }
        let threshold = Gtk.Settings.get_default().gtk_dnd_drag_threshold;
        if ((Math.abs(x - this._dragStartX) > threshold ||
             Math.abs(y - this._dragStartY) > threshold)) {
            this.startDrag(x, y, global.get_current_time());
            this._updateDragPosition(null, x, y);
            this._dragCheckId = null;
            return false;
        }

        return true;
    },

    _maybeStartDrag:  function(event) {
        if (this._dragCheckId)
            return true;

        this._dragCheckId = Mainloop.timeout_add(10, Lang.bind(this, this._dragCheckCallback));

        return true;
    },

    _dragCheckCallback: function() {
        let [x, y, mask] = global.get_pointer();
        return this._checkThreshold(x, y);
    },

    _setCursor:  function(result) {
        if (result !== DragMotionResult.CONTINUE) {
            try {
                let cursor = DRAG_CURSOR_MAP[result];
                global.set_cursor(cursor);
            }
            catch (e) {
                global.logError("bad DragMotionResult: " + result, e);
            }
            return true;
        }
        return false;
    },
    
    _updateDragPosition : function (event, x, y) {
        let stageX, stageY;
        let time;
        if (event) {
            [stageX, stageY] = event.get_coords();
            time = event.get_time();
        }
        else {
            stageX = x;
            stageY = y;
            time = global.get_current_time();
        }

        this._dragX = stageX;
        this._dragY = stageY;

        // If we are dragging, update the position
        if (this._dragActor) {
            this._dragActor.set_position(stageX + this._dragOffsetX,
                                         stageY + this._dragOffsetY);

            let target = this._dragActor.get_stage().get_actor_at_pos(Clutter.PickMode.ALL,
                                                                      stageX, stageY);

            // We call observers only once per motion with the innermost
            // target actor. If necessary, the observer can walk the
            // parent itself.
            let dragEvent = {
                x: stageX,
                y: stageY,
                dragActor: this._dragActor,
                source: this.actor._delegate,
                targetActor: target
            };
            for (let i = 0; i < dragMonitors.length; i++) {
                let motionFunc = dragMonitors[i].dragMotion;
                if (motionFunc) {
                    let result = motionFunc(dragEvent);
                    if (this._setCursor(result)) {
                        return true;
                    }
                }
            }

            if (target instanceof Clutter.Stage || target instanceof Meta.WindowActor) {
                let result = DragMotionResult.NO_DROP;
                if (this._setCursor(result)) {
                    return true;
                }
            }

            if (this.target) {
                if (this.target._delegate && this.target._delegate.handleDragOver){
                    let [r, targX, targY] = this.target.transform_stage_point(stageX, stageY);
                    let result = this.target._delegate.handleDragOver(this.actor._delegate,
                                                                      this._dragActor,
                                                                      targX,
                                                                      targY,
                                                                      time);
                    if (this._setCursor(result)) {
                        return true;
                    }
                }
            }

            while (target) {
                if (target._delegate && target._delegate.handleDragOver) {
                    let [r, targX, targY] = target.transform_stage_point(stageX, stageY);
                    // We currently loop through all parents on drag-over even if one of the children has handled it.
                    // We can check the return value of the function and break the loop if it's true if we don't want
                    // to continue checking the parents.
                    let result = target._delegate.handleDragOver(this.actor._delegate,
                                                                 this._dragActor,
                                                                 targX,
                                                                 targY,
                                                                 time);
                    if (this._setCursor(result)) {
                        return true;
                    }
                }
                target = target.get_parent();
            }
            global.set_cursor(Cinnamon.Cursor.DND_IN_DRAG);
        }

        return true;
    },

    _dragActorDropped: function(event) {
        let [dropX, dropY] = event.get_coords();
        let target = this._dragActor.get_stage().get_actor_at_pos(Clutter.PickMode.ALL,
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

        if (this.target && this._dropOnTarget(this.target, event, dropX, dropY))
            return true;

        while (target) {
            if(this._dropOnTarget(target, event, dropX, dropY))
                return true;
            target = target.get_parent();
        }

        this._cancelDrag(event.get_time());

        return true;
    },
    
    _dropOnTarget: function(target, event, dropX, dropY) {
        if (target._delegate && target._delegate.acceptDrop){
            let [r, targX, targY] = target.transform_stage_point(dropX, dropY);
            if (target._delegate.acceptDrop(this.actor._delegate,
                                                 this._dragActor,
                                                 targX,
                                                 targY,
                                                 event.get_time())) {
                if (this._actorDestroyed)
                    return true;
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
        
        return false;
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

    _cancelDrag: function(eventTimeOpt) {
        this._setTimer(false);
        let eventTime = eventTimeOpt || global.get_current_time();
        this.emit('drag-cancelled', eventTime);
        this._dragInProgress = false;
        let [snapBackX, snapBackY, snapBackScale] = this._getRestoreLocation();

        if (this._actorDestroyed) {
            if (this.target && this.target._delegate.cancelDrag)
                this.target._delegate.cancelDrag(this.actor._delegate, this._dragActor);
            global.unset_cursor();
            if (!this._buttonDown)
                this._dragComplete();
            this.emit('drag-end', eventTime, false);
            if (!this._dragOrigParent && this._dragActor)
                this._dragActor.destroy();

            return;
        }

       if (this.target && this.target._delegate.hideDragPlaceholder)
           this.target._delegate.hideDragPlaceholder();

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
        if (this.target && this.target._delegate.cancelDrag)
            this.target._delegate.cancelDrag(this.actor._delegate, this._dragActor);

        if (this._dragOrigParent) {
            global.reparentActor(dragActor, this._dragOrigParent);
            dragActor.set_scale(this._dragOrigScale, this._dragOrigScale);
            dragActor.set_position(this._dragOrigX, this._dragOrigY);
        } else {
            dragActor.destroy();
        }
        global.unset_cursor();
        this.emit('drag-end', eventTime, false);

        this._animationInProgress = false;
        this._dragComplete();
    },

    // Actor is an actor we have entered or left during the drag; call
    // st_widget_sync_hover on all StWidget ancestors
    _syncHover: function(actor) {
        while (actor) {
            let parent = actor.get_parent();
            if (actor instanceof St.Widget)
                actor.sync_hover();

            actor = parent;
        }
    },

    _dragComplete: function() {
        this._setTimer(false);
        if (!this._actorDestroyed && this._dragActor)
            Cinnamon.util_set_hidden_from_pick(this._dragActor, false);

        this._ungrabEvents();

        if (this._firstLeaveActor) {
            this._syncHover(this._firstLeaveActor);
            this._firstLeaveActor = null;
        }

        if (this._lastEnterActor) {
            this._syncHover(this._lastEnterActor);
            this._lastEnterActor = null;
        }

        this._dragActor = undefined;
        currentDraggable = null;
    }
};

Signals.addSignalMethods(_Draggable.prototype);

/**
 * makeDraggable:
 * @actor: Source actor
 * @params: (optional) Additional parameters
 * @target: (optional) Actor that has priority as an accepting target
 *
 * Create an object which controls drag and drop for the given actor.
 * @target has priority when finding a target to accept the drag
 * actor. This can be used when the target cannot be reached.
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

        this.actor.destroy_children();

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
