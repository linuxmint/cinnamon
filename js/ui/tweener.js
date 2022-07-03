// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const GObject = imports.gi.GObject;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Signals = imports.signals;
const Tweener = imports.tweener.tweener;

/**
 * FILE:tweener.js
 * @short_description: File providing tweening functions
 *
 * This is a wrapper around imports.tweener.tweener that adds a bit of
 * Clutter integration. If the tweening target is a Clutter.Actor, then
 * the tweenings will automatically be removed if the actor is destroyed.
 *
 * ActionScript Tweener methods that imports.tweener.tweener doesn't
 * currently implement: getTweens, getVersion, registerTransition,
 * setTimeScale, updateTime.
 *
 * imports.tweener.tweener methods that we don't re-export:
 * pauseAllTweens, removeAllTweens, resumeAllTweens. (It would be hard
 * to clean up properly after removeAllTweens, and also, any code that
 * calls any of these is almost certainly wrong anyway, because they
 * affect the entire application.)
 */

/**
 * init:
 *
 * Function called by main.js when Cinnamon starts
 */
function init() {
    Tweener.setFrameTicker(new ClutterFrameTicker());
}


function addCaller(target, tweeningParameters) {
    _wrapTweening(target, tweeningParameters);
    Tweener.addCaller(target, tweeningParameters);
}

/**
 * addTween:
 * @target (Object): the object to tween
 * @tweeningParameters (param): parameters
 *
 * This makes @target tween according to the parameters of @tweeningParameters.
 *
 * @tweeningParameters contains certain tweening parameters that describe the
 * tween, and the actual things to tween. Everything that is not a tweening
 * parameter is processed as follows: If you have
 * ```
 * {
 *     ...
 *     x: 7
 *     ...
 * }
 * ```
 * In your parameters, then the property @x of the @target object will
 * be animated to the value of @7.
 *
 * The tweening parameters are (shamelessly stolen from the actual Tweener
 * documentation):
 *
 *  - @time (real): The duration of the transition in seconds
 *
 *  - @delay (real): The delay (in seconds) before the transition starts. The
 *    default of this parameter (when omitted) is 0.
 *
 *  - @skipUpdates (int):  How many updates must be skipped before an actual
 *    update is made.  This is a powerful property that allows the developer to
 *    enforce a different update rate for a given tweening, as if simulating a
 *    lower frame rate. This is useful on transitions that demand a share of
 *    the CPU that's higher than average on each new update, such as filter
 *    tweenings. A value of 1, for example, means that the tweening engine will
 *    do half of the updates on this transition, since it will update then skip
 *    one update; a value of 2 means it will do one third of the normal
 *    updates, since it will update, then skip two updates. The default value
 *    for this parameter (when omitted) is 0, meaning no update is skipped at
 *    all, and the active tweenings are updated on every frame render.
 *
 *  - @transition (string/function): The type of transition to use. Different
 *    equations can be used, producing different tweening updates based on time
 *    spent. You can specify this parameter by their internal string names
 *    (which you can find by seeing what's offered in the cinnamon-settings
 *    effects page), or use any custom function to have a customized easing
 *    (see below for examples and a more in-depth description). The default
 *    transition is "easeOutExpo".
 *    \
 *    If you want to use a custom function as the transition, the function must
 *    receive four parameters: current time on the transition, starting
 *    tweening value, change needed in that value, and total easing duration
 *    (plus an optional object, which will contain any parameter passed as the
 *    transitionParams property of new tweenings). During each tweening, the
 *    transition function will be continuously called, with the first parameter
 *    increasing until it reaches the total duration; it must return the new
 *    expected value.
 *    \
 *    An example of a custom transition is as follows:
 * ```
 * let myFunc = function(t, b, c, d) {
 *     let ts = (t/=d)*t;
 *     let tc = ts*t;
 *     return b+c*(-97.1975*tc*ts + 257.5975*ts*ts + -234.4*tc + 80*ts + -5*t);
 * };
 * Tweener.addTween(this.actor, {x: 200, time: 1, transition: myFunc});
 * ```

 *
 *  - @transitionParams (array): extra parameters to pass to the custom
 *    transition function
 *
 *  - @onStart (function): A function that is called immediately before a
 *    tweening starts. It is called once regardless of the number of properties
 *    involved on the tweening. The function scope (in which the event is
 *    executed) is the target object itself, unless specified by the
 *    onStartScope parameter.
 *
 *  - @onUpdate (function): A function that is called every time a tweening
 *    updates its properties. The function scope (in which the event is
 *    executed) is the target object itself, unless specified by the
 *    @onUpdateScope parameter.
 *
 *  - @onComplete (function): A function that is called immediately after a
 *    tweening is completed. It is called once regardless of the number of
 *    properties involved on the tweening. The function scope (in which the
 *    event is executed) is the target object itself, unless specified by the
 *    @onCompleteScope parameter.
 *
 *  - @onOverwrite (function): A function that is called when tweening is
 *    overwritten. It is called once regardless of the number of properties
 *    involved on the tweening. The function scope is the target object itself,
 *    unless specified by the @onOverwriteScope parameter.
 *
 *  - @onError (function): A function that gets called when an error occurs
 *    when trying to run a tweening. This is used to handle errors more
 *    commonly thrown by other events (that is, from code not controlled by
 *    Tweener), such as onStart, onUpdate or onComplete. The function scope (in
 *    which the event is executed) is the target object itself, unless
 *    specified by the @onErrorScope parameter.
 *
 *  - @rounded (boolean): Whether or not the values for this tweening must be
 *    rounded before being applied to their respective properties. This is
 *    useful, for example, when sliding objects that must be positioned on
 *    round pixels, like labels that use pixel fonts; its x and y properties
 *    need to be rounded all the time to avoid blurring the text. This option
 *    acts on all properties for that specific tween. The default value for
 *    this parameter (when omitted) is false.
 *
 *  - @min (real): The minimum the values of this tweening can take. This is
 *    useful, for example, when you animate the opacity of an object with a
 *    bounce transition and don't want the opacity of an object to fall below
 *    0.  Leave empty for no minimum.
 *
 *  - @max (real): The maximum the values of this tweening can take. This is
 *    useful, for example, when you animate the opacity of an object with a
 *    bounce transition and don't want the opacity of an object to go above 1.
 *    Leave empty for no maximum.
 *
 *  - @onStartParams (array): A list of parameters (of any type) to be passed
 *    to the onStart function. 
 *
 *  - @onUpdateParams (array): A list of parameters (of any type) to be passed
 *    to the onUpdate function.
 *  
 *  - @onCompleteParams (array): A list of parameters (of any type) to be
 *    passed to the onComplete function. 
 *
 *  - @onOverwriteParams (array): A list of parameters (of any type) to be
 *    passed to the onOverwrite function. 
 *
 *  - @onStartScope (object): The object in which the onStart function will
 *    be executed. This is needed if you have some specialized code inside the
 *    event function; in that case, references to this. inside the function
 *    will reference to the object defined by this parameter. If omitted, the
 *    tweened object is the scope used instead.
 *
 *  - @onUpdateScope (object): The object in which the onUpdate function will
 *    be executed. This is needed if you have some specialized code inside the
 *    event function; in that case, references to this. inside the function
 *    will reference to the object defined by this parameter. If omitted, the
 *    tweened object is the scope used instead.
 *
 *  - @onCompleteScope (object): The object in which the onComplete function
 *    will be executed. This is needed if you have some specialized code inside
 *    the event function; in that case, references to this. inside the function
 *    will reference to the object defined by this parameter. If omitted, the
 *    tweened object is the scope used instead.
 *
 *  - @onOverwriteScope (object): The object in which the onOverwrite function
 *    will be executed. This is needed if you have some specialized code inside
 *    the event function; in that case, references to this. inside the function
 *    will reference to the object defined by this parameter. If omitted, the
 *    tweened object is the scope used instead.
 *
 *  - @onErrorScope (object): The object in which the onError function will
 *    be executed. This is needed if you have some specialized code inside the
 *    event function; in that case, references to this. inside the function
 *    will reference to the object defined by this parameter. If omitted, the
 *    tweened object is the scope used instead.
 *
 */
function addTween(target, tweeningParameters) {
    _wrapTweening(target, tweeningParameters);
    Tweener.addTween(target, tweeningParameters);
}

function _wrapTweening(target, tweeningParameters) {
    let state = _getTweenState(target);

    if (!state.destroyedId) {
        if (target instanceof Clutter.Actor) {
            state.actor = target;
            state.destroyedId = target.connect('destroy', _actorDestroyed);
        } else if (target.actor && target.actor instanceof Clutter.Actor) {
            state.actor = target.actor;
            state.destroyedId = target.actor.connect('destroy', function() { _actorDestroyed(target); });
        }
    }

    _addHandler(target, tweeningParameters, 'onComplete', _tweenCompleted);
}

function _getTweenState(target) {
    // If we were paranoid, we could keep a plist mapping targets to
    // states... but we're not that paranoid.
    if (!target.__CinnamonTweenerState)
        target.__CinnamonTweenerState = {};
    return target.__CinnamonTweenerState;
}

function _resetTweenState(target) {
    if (!target || (target instanceof GObject.Object && target.is_finalized())) return;
    let state = target.__CinnamonTweenerState;

    if (state && state.actor && !state.actor.is_finalized()) {
        if (state.destroyedId)
            state.actor.disconnect(state.destroyedId);
    }

    target.__CinnamonTweenerState = {};
}

function _addHandler(target, params, name, handler) {
    if (params[name]) {
        let oldHandler = params[name];
        let oldScope = params[name + 'Scope'];
        let oldParams = params[name + 'Params'];
        let eventScope = oldScope ? oldScope : target;

        params[name] = function () {
            oldHandler.apply(eventScope, oldParams);
            handler(target);
        };
    } else
        params[name] = function () { handler(target); };
}

function _actorDestroyed(target) {
    _resetTweenState(target);
    Tweener.removeTweens(target);
}


function _tweenCompleted(target) {

    if (!isTweening(target))
        _resetTweenState(target);
}

/**
 * getTweenCount:
 * @scope (Object): the object we are interested in
 *
 * Returns the number of tweens @scope currently has.
 */
function getTweenCount(scope) {
    return Tweener.getTweenCount(scope);
}

/**
 * isTweening:
 * @scope (Object): the object we are interested in
 *
 * Returns whether @scope is animating
 */
function isTweening(scope) {
    return Tweener.getTweenCount(scope) != 0;
}

/**
 * removeTween:
 * @scope (Object): the object we are interested in
 *
 * Removes all tweens running on the object.
 *
 * FIXME: removeTweens should be much more powerful, but I have no idea how it
 * works
 */
function removeTweens(scope) {
    if (Tweener.removeTweens.apply(null, arguments)) {
        // If we just removed the last active tween, clean up
        if (Tweener.getTweenCount(scope) == 0)
            _tweenCompleted(scope);
        return true;
    } else
        return false;
}

/**
 * pauseTweens:
 * @scope (Object): the object we are interested in
 *
 * Pauses all the tweens running on the object. Can be resumed with
 * Tweener.resumeTweens
 *
 * FIXME: removeTweens should be much more powerful, but I have no idea how it
 * works
 */
function pauseTweens() {
    return Tweener.pauseTweens.apply(null, arguments);
}

/**
 * resumeTweens:
 * @scope (Object): the object we are interested in
 *
 * Resumes all the tweens running on the object paused by Tweener.pauseTweens
 *
 * FIXME: removeTweens should be much more powerful, but I have no idea how it
 * works
 */
function resumeTweens() {
    return Tweener.resumeTweens.apply(null, arguments);
}


function registerSpecialProperty(name, getFunction, setFunction,
                                 parameters, preProcessFunction) {
    Tweener.registerSpecialProperty(name, getFunction, setFunction,
                                    parameters, preProcessFunction);
}

function registerSpecialPropertyModifier(name, modifyFunction, getFunction) {
    Tweener.registerSpecialPropertyModifier(name, modifyFunction, getFunction);
}

function registerSpecialPropertySplitter(name, splitFunction, parameters) {
    Tweener.registerSpecialPropertySplitter(name, splitFunction, parameters);
}


/**
 * #ClutterFrameTicker:
 * @short_description: Object used internally for clutter animations
 *
 * The 'FrameTicker' object is an object used to feed new frames to
 * Tweener so it can update values and redraw. The default frame
 * ticker for Tweener just uses a simple timeout at a fixed frame rate
 * and has no idea of "catching up" by dropping frames.
 *
 * We substitute it with custom frame ticker here that connects
 * Tweener to a Clutter.TimeLine. Now, Clutter.Timeline itself isn't a
 * whole lot more sophisticated than a simple timeout at a fixed frame
 * rate, but at least it knows how to drop frames. (See
 * HippoAnimationManager for a more sophisticated view of continuous
 * time updates; even better is to pay attention to the vertical
 * vblank and sync to that when possible.)
 */
function ClutterFrameTicker() {
    this._init();
}

ClutterFrameTicker.prototype = {
    FRAME_RATE : 60,

    _init : function() {
        // We don't have a finite duration; tweener will tell us to stop
        // when we need to stop, so use 1000 seconds as "infinity"
        this._timeline = new Clutter.Timeline({ duration: 1000*1000 });
        this._startTime = -1;

        this._timeline.connect('new-frame', Lang.bind(this,
            function(timeline, frame) {
                this._onNewFrame(frame);
            }));

        let perf_log = Cinnamon.PerfLog.get_default();
        perf_log.define_event("tweener.framePrepareStart",
                              "Start of a new animation frame",
                              "");
        perf_log.define_event("tweener.framePrepareDone",
                              "Finished preparing frame",
                              "");
    },

    _onNewFrame : function(frame) {
        // If there is a lot of setup to start the animation, then
        // first frame number we get from clutter might be a long ways
        // into the animation (or the animation might even be done).
        // That looks bad, so we always start at the first frame of the
        // animation then only do frame dropping from there.
        if (this._startTime < 0)
            this._startTime = this._timeline.get_elapsed_time();

        // currentTime is in milliseconds
        let perf_log = Cinnamon.PerfLog.get_default();
        perf_log.event("tweener.framePrepareStart");
        this.emit('prepare-frame');
        perf_log.event("tweener.framePrepareDone");
    },

    getTime : function() {
        return this._timeline.get_elapsed_time();
    },

    start : function() {
        let settings = St.Settings.get();
        if (settings.slow_down_factor > 0)
            Tweener.setTimeScale(1 / settings.slow_down_factor);
        this._timeline.start();
        global.begin_work();
    },

    stop : function() {
        this._timeline.stop();
        this._startTime = -1;
        global.end_work();
    }
};

Signals.addSignalMethods(ClutterFrameTicker.prototype);
