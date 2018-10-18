// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

imports.gi.versions.Clutter = '0';
imports.gi.versions.Gio = '2.0';
imports.gi.versions.Gdk = '3.0';
imports.gi.versions.GdkPixbuf = '2.0';
imports.gi.versions.Gtk = '3.0';

const GObject = imports.gi.GObject;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Overrides = imports.ui.overrides;

// We can't import cinnamon JS modules yet, because they may have
// variable initializations, etc, that depend on init() already having
// been run.


// "monkey patch" in some varargs ClutterContainer methods; we need
// to do this per-container class since there is no representation
// of interfaces in Javascript
function _patchContainerClass(containerClass) {
    // This one is a straightforward mapping of the C method
    containerClass.prototype.child_set = function(actor, props) {
        let meta = this.get_child_meta(actor);
        for (let prop in props)
            meta[prop] = props[prop];
    };

    // clutter_container_add() actually is a an add-many-actors
    // method. We conveniently, but somewhat dubiously, take the
    // this opportunity to make it do something more useful.
    containerClass.prototype.add = function(actor, props) {
        if (actor === undefined) {
            return false;
        }
        this.add_actor(actor);
        if (props)
            this.child_set(actor, props);
    };
}

function readOnlyError(property) {
    global.logError(`The ${property} object is read-only.`);
};

function init() {
    // Add some bindings to the global JS namespace; (gjs keeps the web
    // browser convention of having that namespace be called 'window'.)
    Object.defineProperty(window, 'global', {
        get: function() {
            return Cinnamon.Global.get();
        },
        set: function() {
            readOnlyError('global');
        },
        configurable: false,
        enumerable: false
    });
    Object.defineProperty(window, '_', {
        get: function() {
            return Gettext.gettext;
        },
        set: function() {
            readOnlyError('gettext');
        },
        configurable: false,
        enumerable: false
    });
    Object.defineProperty(window, 'C_', {
        get: function() {
            return Gettext.pgettext;
        },
        set: function() {
            readOnlyError('pgettext');
        },
        configurable: false,
        enumerable: false
    });
    Object.defineProperty(window, 'ngettext', {
        get: function() {
            return Gettext.ngettext;
        },
        set: function() {
            readOnlyError('ngettext');
        },
        configurable: false,
        enumerable: false
    });
    // Prevent usage of meta_pre_exec_close_fds in the JS context
    Meta.pre_exec_close_fds = null;

    // Set the default direction for St widgets (this needs to be done before any use of St)
    if (Gtk.Widget.get_default_direction() == Gtk.TextDirection.RTL) {
        St.Widget.set_default_direction(St.TextDirection.RTL);
    }

    // Miscellaneous monkeypatching
    _patchContainerClass(St.BoxLayout);
    _patchContainerClass(St.Table);

    // Cache the original toString since it will be overriden for Clutter.Actor
    GObject.Object.prototype._toString = GObject.Object.prototype.toString;
    // Add method to determine if a GObject is finalized - needed to prevent accessing
    // objects that have been disposed in C code.
    GObject.Object.prototype.is_finalized = function is_finalized() {
        return this._toString().includes('FINALIZED');
    };
    // Override destroy so it checks if its finalized before calling the real destroy method.
    Clutter.Actor.prototype._destroy = Clutter.Actor.prototype.destroy;
    Clutter.Actor.prototype.destroy = function destroy() {
        if (!this.is_finalized()) {
            this._destroy();
        }
    };
    Clutter.Actor.prototype.toString = function() {
        return St.describe_actor(this);
    };

    let origToString = Object.prototype.toString;
    Object.prototype.toString = function() {
        let base = origToString.call(this);
        try {
            if ('actor' in this && this.actor instanceof Clutter.Actor)
                return base.replace(/\]$/, ' delegate for ' + this.actor.toString().substring(1));
            else
                return base;
        } catch(e) {
            return base;
        }
    };

    // Work around https://bugzilla.mozilla.org/show_bug.cgi?id=508783
    Date.prototype.toLocaleFormat = function(format) {
        return Cinnamon.util_format_date(format, this.getTime());
    };

    let slowdownEnv = GLib.getenv('CINNAMON_SLOWDOWN_FACTOR');
    if (slowdownEnv) {
        let factor = parseFloat(slowdownEnv);
        if (!isNaN(factor) && factor > 0.0)
            St.set_slow_down_factor(factor);
    }

    // OK, now things are initialized enough that we can import cinnamon JS
    const Format = imports.format;
    const Tweener = imports.ui.tweener;

    Tweener.init();
    String.prototype.format = Format.format;

    Overrides.init();
}
