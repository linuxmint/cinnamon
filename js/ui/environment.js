// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

imports.gi.versions.Clutter = '0';
imports.gi.versions.Gio = '2.0';
imports.gi.versions.Gdk = '3.0';
imports.gi.versions.GdkPixbuf = '2.0';
imports.gi.versions.Gtk = '3.0';
imports.gi.versions.Soup = '3.0';

const GObject = imports.gi.GObject;
const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext;
const Signals = imports.signals;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Overrides = imports.ui.overrides;
const Params = imports.misc.params;
const SignalTracker = imports.misc.signalTracker;

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

function _patchLayoutClass(layoutClass, styleProps) {
    if (styleProps)
        layoutClass.prototype.hookup_style = function(container) {
            container.connect('style-changed', () => {
                let node = container.get_theme_node();
                for (let prop in styleProps) {
                    let [found, length] = node.lookup_length(styleProps[prop], false);
                    if (found)
                        this[prop] = length;
                }
            });
        };
}

function readOnlyError(property) {
    global.logError(`The ${property} object is read-only.`);
};


function _makeEaseCallback(params, cleanup) {
    let onComplete = params.onComplete;
    delete params.onComplete;

    let onStopped = params.onStopped;
    delete params.onStopped;

    return isFinished => {
        cleanup();

        if (onStopped)
            onStopped(isFinished);
        if (onComplete && isFinished)
            onComplete();
    };
}

function _makeFrameCallback(params) {
    let onUpdate = params.onUpdate;
    delete params.onUpdate;

    return (transition, timeIndex) => {
        if (onUpdate)
            onUpdate(transition, timeIndex);
    };
}

function _getPropertyTarget(actor, propName) {
    if (!propName.startsWith('@'))
        return [actor, propName];

    let [type, name, prop] = propName.split('.');
    switch (type) {
    case '@layout':
        return [actor.layout_manager, name];
    case '@actions':
        return [actor.get_action(name), prop];
    case '@constraints':
        return [actor.get_constraint(name), prop];
    case '@content':
        return [actor.content, name];
    case '@effects':
        return [actor.get_effect(name), prop];
    }

    throw new Error(`Invalid property name ${propName}`);
}

function _easeActor(actor, params) {
    params = {
        repeatCount: 0,
        autoReverse: false,
        animationRequired: false,
        ...params,
    };

    actor.save_easing_state();

    const animationRequired = params.animationRequired;
    delete params.animationRequired;

    if (params.duration !== undefined)
        actor.set_easing_duration(params.duration, {animationRequired});
    delete params.duration;

    if (params.delay !== undefined)
        actor.set_easing_delay(params.delay, {animationRequired});
    delete params.delay;

    const repeatCount = params.repeatCount;
    delete params.repeatCount;

    const autoReverse = params.autoReverse;
    delete params.autoReverse;

    // repeatCount doesn't include the initial iteration
    const numIterations = repeatCount + 1;
    // whether the transition should finish where it started
    const isReversed = autoReverse && numIterations % 2 === 0;

    if (params.mode !== undefined)
        actor.set_easing_mode(params.mode);
    delete params.mode;

    const prepare = () => {
        Meta.disable_unredirect_for_display(global.display);
        global.begin_work();
    };
    const cleanup = () => {
        Meta.enable_unredirect_for_display(global.display);
        global.end_work();
    };
    let callback = _makeEaseCallback(params, cleanup);
    let updateCallback = _makeFrameCallback(params);

    // cancel overwritten transitions
    let animatedProps = Object.keys(params).map(p => p.replace('_', '-', 'g'));
    animatedProps.forEach(p => actor.remove_transition(p));

    if (actor.get_easing_duration() > 0 || !isReversed)
        actor.set(params);
    actor.restore_easing_state();

    const transitions = animatedProps
        .map(p => actor.get_transition(p))
        .filter(t => t !== null);

    transitions.forEach(t => t.set({repeatCount, autoReverse}));

    const [transition] = transitions;

    if (transition && transition.delay)
        transition.connect('started', () => prepare());
    else
        prepare();

    if (transition) {
        transition.connect('stopped', (t, finished) => callback(finished));
        transition.connect('new-frame', (t, timeIndex) => updateCallback(t, timeIndex));
    } else {
        callback(true);
    }
}

function _easeActorProperty(actor, propName, target, params) {
    params = {
        repeatCount: 0,
        autoReverse: false,
        animationRequired: false,
        ...params,
    };

    // Avoid pointless difference with ease()
    if (params.mode)
        params.progress_mode = params.mode;
    delete params.mode;

    const animationRequired = params.animationRequired;
    delete params.animationRequired;

    if (params.duration)
        params.duration = adjustAnimationTime(params.duration, {animationRequired});
    let duration = Math.floor(params.duration || 0);

    if (params.delay)
        params.delay = adjustAnimationTime(params.delay, {animationRequired});

    const repeatCount = params.repeatCount;
    delete params.repeatCount;

    const autoReverse = params.autoReverse;
    delete params.autoReverse;

    // repeatCount doesn't include the initial iteration
    const numIterations = repeatCount + 1;
    // whether the transition should finish where it started
    const isReversed = autoReverse && numIterations % 2 === 0;

    // Copy Clutter's behavior for implicit animations, see
    // should_skip_implicit_transition()
    if (actor instanceof Clutter.Actor && !actor.mapped)
        duration = 0;

    const prepare = () => {
        Meta.disable_unredirect_for_display(global.display);
        global.begin_work();
    };
    const cleanup = () => {
        Meta.enable_unredirect_for_display(global.display);
        global.end_work();
    };
    let callback = _makeEaseCallback(params, cleanup);
    let updateCallback = _makeFrameCallback(params);

    // cancel overwritten transition
    actor.remove_transition(propName);

    if (duration === 0) {
        let [obj, prop] = _getPropertyTarget(actor, propName);

        if (!isReversed)
            obj[prop] = target;

        prepare();
        callback(true);

        return;
    }

    let pspec = actor.find_property(propName);
    let transition = new Clutter.PropertyTransition({
        property_name: propName,
        interval: new Clutter.Interval({value_type: pspec.value_type}),
        remove_on_complete: true,
        repeat_count: repeatCount,
        auto_reverse: autoReverse,
        ...params,
    });
    actor.add_transition(propName, transition);

    transition.set_to(target);

    if (transition.delay)
        transition.connect('started', () => prepare());
    else
        prepare();

    transition.connect('stopped', (t, finished) => callback(finished));
    transition.connect('new-frame', (t, timeIndex) => updateCallback(t, timeIndex));
}

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

    GObject.gtypeNameBasedOnJSPath = true;

    GObject.Object.prototype.connectObject = function (...args) {
        SignalTracker.connectObject(this, ...args);
    };
    GObject.Object.prototype.connect_object = function (...args) {
        SignalTracker.connectObject(this, ...args);
    };
    GObject.Object.prototype.disconnectObject = function (...args) {
        SignalTracker.disconnectObject(this, ...args);
    };
    GObject.Object.prototype.disconnect_object = function (...args) {
        SignalTracker.disconnectObject(this, ...args);
    };
    const _addSignalMethods = Signals.addSignalMethods;
    Signals.addSignalMethods = function (prototype) {
        _addSignalMethods(prototype);
        SignalTracker.addObjectSignalMethods(prototype);
    };

    // Miscellaneous monkeypatching
    _patchContainerClass(St.BoxLayout);
    _patchContainerClass(St.Table);

    _patchLayoutClass(Clutter.GridLayout, { row_spacing: 'spacing-rows',
                                            column_spacing: 'spacing-columns' });
    _patchLayoutClass(Clutter.BoxLayout, { spacing: 'spacing' });

    // Cache the original toString since it will be overridden for Clutter.Actor
    GObject.Object.prototype._toString = GObject.Object.prototype.toString;
    // Add method to determine if a GObject is finalized - needed to prevent accessing
    // objects that have been disposed in C code.
    GObject.Object.prototype.is_finalized = function is_finalized() {
        return this._toString().includes('DISPOSED');
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

    // Safe wrapper for theme inspection
    St.Widget.prototype.style_length = function(property) {
        if (this.is_finalized() || !this.realized) return 0;
        if (!this.themeNode) {
            this.themeNode = this.peek_theme_node();
            this.connect('destroy', () => this.themeNode = null);
        }
        if (!this.themeNode) return 0;
        return this.themeNode.get_length(property);
    };

    St.set_slow_down_factor = function(factor) {
        let { stack } = new Error();
        log(`St.set_slow_down_factor() is deprecated, use St.Settings.slow_down_factor\n${stack}`);
        St.Settings.get().slow_down_factor = factor;
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

    const origSetEasingDuration = Clutter.Actor.prototype.set_easing_duration;
    Clutter.Actor.prototype.set_easing_duration = function (msecs, params = {}) {
        origSetEasingDuration.call(this, adjustAnimationTime(msecs, params));
    };
    const origSetEasingDelay = Clutter.Actor.prototype.set_easing_delay;
    Clutter.Actor.prototype.set_easing_delay = function (msecs, params = {}) {
        origSetEasingDelay.call(this, adjustAnimationTime(msecs, params));
    };

    Clutter.Actor.prototype.ease = function (props) {
        _easeActor(this, props);
    };
    Clutter.Actor.prototype.ease_property = function (propName, target, params) {
        _easeActorProperty(this, propName, target, params);
    };
    St.Adjustment.prototype.ease = function (target, params) {
        // we're not an actor of course, but we implement the same
        // transition API as Clutter.Actor, so this works anyway
        _easeActorProperty(this, 'value', target, params);
    };

    // Work around https://bugzilla.mozilla.org/show_bug.cgi?id=508783
    Date.prototype.toLocaleFormat = function(format) {
        return Cinnamon.util_format_date(format, this.getTime());
    };
    Gtk.IconTheme.get_default = () => St.TextureCache.get_default().get_icon_theme();

    let slowdownEnv = GLib.getenv('CINNAMON_SLOWDOWN_FACTOR');
    if (slowdownEnv) {
        let factor = parseFloat(slowdownEnv);
        if (!isNaN(factor) && factor > 0.0)
            St.Settings.get().slow_down_factor = factor;
    }

    // OK, now things are initialized enough that we can import cinnamon JS
    const Format = imports.format;
    const Tweener = imports.ui.tweener;

    Tweener.init();
    String.prototype.format = Format.format;

    Overrides.init();
}


// adjustAnimationTime:
// @msecs - time in milliseconds
// @params - optional parameters (currently just 'animationRequired' - whether to ignore the enable-animations setting
// Adjust @msecs to account for St's enable-animations
// and slow-down-factor settings
function adjustAnimationTime(msecs, params) {
    params = Params.parse(params, {
        animationRequired: false,
    });

    const settings = St.Settings.get();
    if (!settings.animations_enabled && !params.animationRequired)
        return 0;
    return settings.slow_down_factor * msecs;
}
