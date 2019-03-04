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
const {util_format_date} = Cinnamon;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Overrides = imports.ui.overrides;

const BRACKET_REPLACE_REGEX = /\]$/;

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
    const {toString} = GObject.Object.prototype
    // Add method to determine if a GObject is finalized - needed to prevent accessing
    // objects that have been disposed in C code.
    window.isFinalized = function isFinalized(gObject) {
        return toString.call(gObject).indexOf('FINALIZED') > -1;
    };
    // External destroy helper that checks if the instance is finalized.
    const _destroy = Clutter.Actor.prototype.destroy;
    window.destroy = function destroy(actor) {
        if (!isFinalized(actor)) {
            _destroy.call(actor);
        }
    };
    Clutter.Actor.prototype.toString = function() {
        return St.describe_actor(this);
    };

    // Safe wrapper for theme inspection
    window.styleLength = function styleLength(stWidget, property) {
        if (isFinalized(stWidget) || !stWidget.realized) return 0;
        if (!stWidget.themeNode) {
            stWidget.themeNode = stWidget.peek_theme_node();
        }
        if (!stWidget.themeNode) return 0;
        return stWidget.themeNode.get_length(property);
    }

    window.toDelegateString = function toDelegateString(obj) {
        let base = obj.toString();
        if ('actor' in obj && obj.actor instanceof Clutter.Actor && !isFinalized(obj.actor)) {
            return base.replace(BRACKET_REPLACE_REGEX, ' delegate for ' + obj.actor.toString().substring(1));
        }
        return base;
    };

    // Work around https://bugzilla.mozilla.org/show_bug.cgi?id=508783
    window.toLocaleFormat = function toLocaleFormat(date, format) {
        return util_format_date(format, date.getTime());
    };

    window.capitalize = function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    window.clamp = function clamp(number, min, max) {
        return Math.min(Math.max(number, min), max);
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
