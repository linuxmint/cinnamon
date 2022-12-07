// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;

function XdndHandler() {
    this._init();
}

XdndHandler.prototype = {
    _init: function() {
        // Used to display a clone of the cursor window when the
        // window group is hidden (like it happens in the overview)
        this._cursorWindowClone = null;

        // Used as a drag actor in case we don't have a cursor window clone
        this._dummy = new Clutter.Rectangle({ width: 1, height: 1, opacity: 0, name: 'xdnd-proxy-actor' });
        global.stage.add_actor(this._dummy);
        this._dummy.hide();

        var dnd = Meta.get_backend().get_dnd();
        dnd.connect('dnd-enter', Lang.bind(this, this._onEnter));
        dnd.connect('dnd-position-change', Lang.bind(this, this._onPositionChanged));
        dnd.connect('dnd-leave', Lang.bind(this, this._onLeave));

        this._windowGroupVisibilityHandlerId = 0;
    },

    // Called when the user cancels the drag (i.e release the button)
    _onLeave: function() {
        if (this._windowGroupVisibilityHandlerId != 0) {
            global.window_group.disconnect(this._windowGroupVisibilityHandlerId);
            this._windowGroupVisibilityHandlerId = 0;
        }
        if (this._cursorWindowClone) {
            this._cursorWindowClone.destroy();
            this._cursorWindowClone = null;
        }

        this.emit('drag-end');
    },

    _onEnter: function() {
        this._windowGroupVisibilityHandlerId  =
                global.window_group.connect('notify::visible',
                    Lang.bind(this, this._onWindowGroupVisibilityChanged));

        this.emit('drag-begin', global.get_current_time());
    },

    _onWindowGroupVisibilityChanged: function() {
        if (!global.window_group.visible) {
            if (this._cursorWindowClone)
                return;

            let windows = global.get_window_actors();
            let cursorWindow = windows[windows.length - 1];

            // FIXME: more reliable way?
            if (!cursorWindow.is_override_redirect())
                return;

            let constraint_position = new Clutter.BindConstraint({ coordinate : Clutter.BindCoordinate.POSITION,
                                                                   source: cursorWindow});

            this._cursorWindowClone = new Clutter.Clone({ source: cursorWindow });
            global.overlay_group.add_actor(this._cursorWindowClone);
            Cinnamon.util_set_hidden_from_pick(this._cursorWindowClone, true);

            // Make sure that the clone has the same position as the source
            this._cursorWindowClone.add_constraint(constraint_position);
        } else {
            if (this._cursorWindowClone) {
                this._cursorWindowClone.destroy();
                this._cursorWindowClone = null;
            }
        }
    },

    _onPositionChanged: function(obj, x, y) {
        let pickedActor = global.stage.get_actor_at_pos(Clutter.PickMode.NONE, x, y);

        // Make sure that the cursor window is on top
        if (this._cursorWindowClone)
             this._cursorWindowClone.raise_top();

        let dragEvent = {
            x: x,
            y: y,
            dragActor: this._cursorWindowClone ? this._cursorWindowClone : this._dummy,
            source: this,
            targetActor: pickedActor
        };

        for (let i = 0; i < DND.dragMonitors.length; i++) {
            let motionFunc = DND.dragMonitors[i].dragMotion;
            if (motionFunc) {
                let result = motionFunc(dragEvent);
                if (result != DND.DragMotionResult.CONTINUE)
                    return;
            }
        }

        while (pickedActor) {
                if (pickedActor._delegate && pickedActor._delegate.handleDragOver) {
                    let result = pickedActor._delegate.handleDragOver(this,
                                                                      dragEvent.dragActor,
                                                                      x,
                                                                      y,
                                                                      global.get_current_time());
                    if (result != DND.DragMotionResult.CONTINUE)
                        return;
                }
                pickedActor = pickedActor.get_parent();
        }
    }
}

Signals.addSignalMethods(XdndHandler.prototype);
