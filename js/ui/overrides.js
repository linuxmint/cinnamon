// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const Graphene = imports.gi.Graphene;

function init() {
    overrideDumpStack();
    overrideGObject();
    overrideMainloop();
    overrideJS();
    overrideClutter();
    overrideMeta();
}

function overrideDumpStack() {
    global._dump_gjs_stack = global.dump_gjs_stack;
    global.dump_gjs_stack = function(message = 'global.dump_gjs_stack():') {
        global.logWarning(`${message}\n${new Error().stack}`);
    }
}

function overrideGObject() {
    const {toFastProperties} = imports.misc.util;

    const originalInit = GObject.Object.prototype._init;
    GObject.Object.prototype._init = function _init() {
        originalInit.call(this, ...arguments);
        Object.values(this).forEach( value => {
            if (value && !Array.isArray(value)) toFastProperties(value);
        });
    }

    GObject.Object.prototype.disconnect = function(id) {
        if (this.is_finalized()) {
            return true;
        }
        if (GObject.signal_handler_is_connected (this, id)) {
            return GObject.signal_handler_disconnect(this, id);
        } else {
            global.dump_gjs_stack('Invalid or null signal handler id used when attempting to .disconnect from an object.');
            return false;
        }
    };
}

function overrideClutter() {
    Clutter.Point = Graphene.Point;
    Clutter.Vertex = Graphene.Point3D;

    // ClutterGroups are broken - ClutterActor with a FixedLayoutManager is
    // its drop-in replacement.
    const oldClutterGroup = Clutter.Group;

    const fake_group = GObject.registerClass(
    class fake_group extends Clutter.Actor {
        _init(params) {
            super._init(params);
            this.layout_manager = new Clutter.FixedLayout();
        }
    });

    Clutter.Group = fake_group;

    Clutter.Actor.prototype.raise = function(below) {
        let self_parent = this.get_parent();
        let below_parent = below.get_parent();

        if (self_parent === null) {
            logError("Clutter.Actor.raise() actor has no parent!");
            return
        }

        if (self_parent !== below_parent) {
            logError("Clutter.Actor.raise() both actors must share the same parent!");
            return;
        }

        self_parent.set_child_above_sibling(this, below);
    }

    Clutter.Actor.prototype.lower = function(above) {
        let self_parent = this.get_parent();
        let above_parent = above.get_parent();

        if (self_parent === null) {
            logError("Clutter.Actor.lower() actor has no parent!");
            return
        }

        if (self_parent !== above_parent) {
            logError("Clutter.Actor.lower() both actors must share the same parent!");
            return;
        }

        self_parent.set_child_below_sibling(this, above);
    }

    Clutter.Actor.prototype.raise_top = function() {

        let self_parent = this.get_parent();

        if (self_parent === null) {
            logError("Clutter.Actor.raise_top() actor has no parent!");
            return
        }

        self_parent.set_child_above_sibling(this, null);
    }

    Clutter.Actor.prototype.lower_bottom = function() {

        let self_parent = this.get_parent();

        if (self_parent === null) {
            logError("Clutter.Actor.lower_bottom() actor has no parent!");
            return
        }

        self_parent.set_child_below_sibling(this, null);
    }
}

function overrideMeta() {
    Meta.BackgroundActor.new_for_screen = function(screen) {
        if (!Meta.is_wayland_compositor()) {
            return Meta.X11BackgroundActor.new_for_display(global.display);
        } else {
            return new Clutter.Actor();
        }
    }

    Meta.disable_unredirect_for_screen = function(screen) {
        Meta.disable_unredirect_for_display(global.display);
    }

    Meta.enable_unredirect_for_screen = function(screen) {
        Meta.enable_unredirect_for_display(global.display);
    }

    Meta.WindowActor.prototype.get_workspace = function() {
        if (!this.meta_window) {
            return -1;
        }

        const ws = this.meta_window.get_workspace();
        if (ws == null) {
            return -1;
        }

        return ws.workspace_index;
    }
}


function overrideMainloop() {
    Mainloop.__real_source_remove = Mainloop.source_remove;

    Mainloop.source_remove = function (id) {
        let dump = GLib.MainContext.default().find_source_by_id(id) == null;
        if (dump) {
            global.dump_gjs_stack('Invalid or null source id used when attempting to run Mainloop.source_remove()');
        } else {
            Mainloop.__real_source_remove(id);
        }
    }

    /* This should be added in cjs/mainloop.js instead probably... */

    Mainloop.PRIORITY_HIGH = -100;  /* G_PRIORITY_HIGH */
    Mainloop.PRIORITY_DEFAULT = 0;  /* G_PRIORITY_DEFAULT */
    Mainloop.PRIORITY_HIGH_IDLE = 100;  /* etc.. */
    Mainloop.PRIORITY_DEFAULT_IDLE = 200;
    Mainloop.PRIORITY_LOW = 300;

    Mainloop.idle_add_full = function(priority, handler) {
        let s = GLib.idle_source_new();
        GObject.source_set_closure(s, handler);
        s.set_priority(priority);
        return s.attach(null);
    }
}

function overrideJS() {
    String.prototype.capitalize = function() {
        return this.charAt(0).toUpperCase() + this.slice(1);
    }

    if (!String.prototype.includes) {
        String.prototype.includes = String.prototype.contains;
    }

    Number.prototype.clamp = function(min, max) {
        return Math.min(Math.max(this, min), max);
    };

    Object.prototype.maybeGet = function(prop) {
        if (this.hasOwnProperty(prop)) {
            return this[prop];
        } else {
            return undefined;
        }
    };
    Object.defineProperty(Object.prototype, "maybeGet", {enumerable: false});
}
