// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Tweener = imports.tweener.tweener;
const TweenList = imports.tweener.tweenList;
const Signals = imports.signals;

function init() {
    overrideGio();
    overrideGObject();
    overrideMainloop();
    overrideJS();
    overrideTweener();
    overrideSignals();
}

function check_schema_and_init(obj, method, params) {
    if (!params.schema) {
        method.call(obj, params);
        return;
    }
    let listSchemas = Gio.Settings.list_schemas();
    if (listSchemas.indexOf(params.schema) != -1) {
        method.call(obj, params);
    } else {
        method.call(obj, { schema_id: "org.cinnamon.invalid-schema" });
        log("GSettings schema not found: " + params.schema);
        throw new Error("GSettings schema not found: " + params.schema);
    }
}

function key_exists (obj, key) {
    return obj.list_keys().indexOf(key) != -1;
}

function check_key_and_get (obj, method, key) {
    if (key_exists (obj, key)) {
        return method.call(obj, key);
    } else {
        log("GSettings key not found. schema: " + obj.schema + ", key: " + key);
        return null;
    }
}

function check_key_and_set (obj, method, key, val) {
    if (key_exists (obj, key)) {
        return method.call(obj, key, val);
    } else {
        log("GSettings key not found. schema: " + obj.schema + ", key: " + key);
        return false;
    }
}

function overrideGio() {
    Gio._real_init         = Gio.Settings.prototype._init;
    Gio._real_get_value    = Gio.Settings.prototype.get_value;
    Gio._real_set_value    = Gio.Settings.prototype.set_value;
    Gio._real_get_boolean  = Gio.Settings.prototype.get_boolean;
    Gio._real_set_boolean  = Gio.Settings.prototype.set_boolean;
    Gio._real_get_int      = Gio.Settings.prototype.get_int;
    Gio._real_set_int      = Gio.Settings.prototype.set_int;
    Gio._real_get_uint     = Gio.Settings.prototype.get_uint;
    Gio._real_set_uint     = Gio.Settings.prototype.set_uint;
    Gio._real_get_double   = Gio.Settings.prototype.get_double;
    Gio._real_set_double   = Gio.Settings.prototype.set_double;
    Gio._real_get_string   = Gio.Settings.prototype.get_string;
    Gio._real_set_string   = Gio.Settings.prototype.set_string;
    Gio._real_get_strv     = Gio.Settings.prototype.get_strv;
    Gio._real_set_strv     = Gio.Settings.prototype.set_strv;
    Gio._real_get_enum     = Gio.Settings.prototype.get_enum;
    Gio._real_set_enum     = Gio.Settings.prototype.set_enum;
    Gio._real_get_flags    = Gio.Settings.prototype.get_flags;
    Gio._real_set_flags    = Gio.Settings.prototype.set_flags;

    Gio.Settings.prototype._init        = function(params)   { check_schema_and_init(this, Gio._real_init, params); }
    Gio.Settings.prototype.get_value    = function(key)      { return check_key_and_get(this, Gio._real_get_value, key); }
    Gio.Settings.prototype.set_value    = function(key, val) { return check_key_and_set(this, Gio._real_set_value, key, val); }
    Gio.Settings.prototype.get_boolean  = function(key)      { return check_key_and_get(this, Gio._real_get_boolean, key); }
    Gio.Settings.prototype.set_boolean  = function(key, val) { return check_key_and_set(this, Gio._real_set_boolean, key, val); }
    Gio.Settings.prototype.get_int      = function(key)      { return check_key_and_get(this, Gio._real_get_int, key); }
    Gio.Settings.prototype.set_int      = function(key, val) { return check_key_and_set(this, Gio._real_set_int, key, val); }
    Gio.Settings.prototype.get_uint     = function(key)      { return check_key_and_get(this, Gio._real_get_uint, key); }
    Gio.Settings.prototype.set_uint     = function(key, val) { return check_key_and_set(this, Gio._real_set_uint, key, val); }
    Gio.Settings.prototype.get_double   = function(key)      { return check_key_and_get(this, Gio._real_get_double, key); }
    Gio.Settings.prototype.set_double   = function(key, val) { return check_key_and_set(this, Gio._real_set_double, key, val); }
    Gio.Settings.prototype.get_string   = function(key)      { return check_key_and_get(this, Gio._real_get_string, key); }
    Gio.Settings.prototype.set_string   = function(key, val) { return check_key_and_set(this, Gio._real_set_string, key, val); }
    Gio.Settings.prototype.get_strv     = function(key)      { return check_key_and_get(this, Gio._real_get_strv, key); }
    Gio.Settings.prototype.set_strv     = function(key, val) { return check_key_and_set(this, Gio._real_set_strv, key, val); }
    Gio.Settings.prototype.get_enum     = function(key)      { return check_key_and_get(this, Gio._real_get_enum, key); }
    Gio.Settings.prototype.set_enum     = function(key, val) { return check_key_and_set(this, Gio._real_set_enum, key, val); }
    Gio.Settings.prototype.get_flags    = function(key)      { return check_key_and_get(this, Gio._real_get_flags, key); }
    Gio.Settings.prototype.set_flags    = function(key, val) { return check_key_and_set(this, Gio._real_set_flags, key, val); }
}

function overrideGObject() {
    GObject.Object.prototype.disconnect = function(id) {
        if (GObject.signal_handler_is_connected (this, id))
            return GObject.signal_handler_disconnect(this, id);
        else {
            log("Invalid or null signal handler id used when attempting to .disconnect from an object.");
            global.dump_gjs_stack();
            return false;
        }
    };
}

function overrideMainloop() {
    Mainloop.__real_source_remove = Mainloop.source_remove;

    Mainloop.source_remove = function (id) {
        let dump = GLib.MainContext.default().find_source_by_id(id) == null;
        if (dump) {
            log("Invalid or null source id used when attempting to run Mainloop.source_remove()");
            global.dump_gjs_stack();
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

    String.prototype.first_cap = function() {
        return this.charAt(0).toUpperCase();
    }

    Number.prototype.clamp = function(min, max) {
        return Math.min(Math.max(this, min), max);
    };

    if (!Array.prototype.find) {
        Array.prototype.find = function(predicate) {
            if (this === null) {
                throw new TypeError('Array.prototype.find called on null or undefined');
            }
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            var list = Object(this);
            var length = list.length >>> 0;
            var thisArg = arguments[1];
            var value;

            for (var i = 0; i < length; i++) {
                value = list[i];
                if (predicate.call(thisArg, value, i, list)) {
                    return value;
                }
            }
            return undefined;
        };
        Object.defineProperty(Array.prototype, "find", {enumerable: false});
        // Or else for (let i in arr) loops will explode;
    }

    Object.prototype.maybeGet = function(prop) {
        if (this.hasOwnProperty(prop)) {
            return this[prop];
        } else {
            return undefined;
        }
    };
    Object.defineProperty(Object.prototype, "maybeGet", {enumerable: false});
}

function overrideTweener() {
    if (Tweener.restrictedWords.min != null) {
        return;
    }

    Object.assign(Tweener.restrictedWords, {
        min: true,
        max: true
    });

    const originalTweenListClone = TweenList.TweenList.prototype.clone;
    TweenList.TweenList.prototype.clone = function(omitEvents) {
        const tween = originalTweenListClone(omitEvents);
        tween.min = this.min;
        tween.max = this.max;
        return tween;
    };

    Tweener._updateTweenByIndex = function(i) {
        var tweening = Tweener._tweenList[i];

        if (tweening == null || !tweening.scope)
            return false;

        var currentTime = Tweener._getCurrentTweeningTime(tweening);

        if (currentTime < tweening.timeStart)
            return true; // Hasn't started, so return true

        var scope = tweening.scope;
        var t, b, c, d, nv;

        var isOver = false;

        if (tweening.isCaller) {
            do {
                t = ((tweening.timeComplete - tweening.timeStart)/tweening.count) *
                    (tweening.timesCalled + 1);
                b = tweening.timeStart;
                c = tweening.timeComplete - tweening.timeStart;
                d = tweening.timeComplete - tweening.timeStart;
                nv = tweening.transition(t, b, c, d);

                if (currentTime >= nv) {
                    Tweener._callOnFunction(tweening.onUpdate, "onUpdate", tweening.onUpdateScope,
                                    scope, tweening.onUpdateParams);

                    tweening.timesCalled++;
                    if (tweening.timesCalled >= tweening.count) {
                        isOver = true;
                        break;
                    }

                    if (tweening.waitFrames)
                        break;
                }
            } while (currentTime >= nv);
        } else {
            var mustUpdate, name;

            if (currentTime >= tweening.timeComplete) {
                isOver = true;
                mustUpdate = true;
            } else {
                mustUpdate = tweening.skipUpdates < 1 ||
                    !tweening.skipUpdates ||
                    tweening.updatesSkipped >= tweening.skipUpdates;
            }

            if (!tweening.hasStarted) {
                Tweener._callOnFunction(tweening.onStart, "onStart", tweening.onStartScope,
                                scope, tweening.onStartParams);

                for (name in tweening.properties) {
                    var pv;

                    if (tweening.properties[name].isSpecialProperty) {
                        // It's a special property, tunnel via the special property function
                        if (_specialPropertyList[name].preProcess != undefined) {
                            tweening.properties[name].valueComplete = Tweener._specialPropertyList[name].preProcess(scope, Tweener._specialPropertyList[name].parameters, tweening.properties[name].originalValueComplete, tweening.properties[name].extra);
                        }
                        pv = Tweener._specialPropertyList[name].getValue(scope, Tweener._specialPropertyList[name].parameters, tweening.properties[name].extra);
                    } else {
                        // Directly read property
                        pv = scope[name];
                    }
                    tweening.properties[name].valueStart = isNaN(pv) ? tweening.properties[name].valueComplete : pv;
                }

                mustUpdate = true;
                tweening.hasStarted = true;
            }

            if (mustUpdate) {
                for (name in tweening.properties) {
                    var property = tweening.properties[name];

                    if (isOver) {
                        // Tweening time has finished, just set it to the final value
                        nv = property.valueComplete;
                    } else {
                        if (property.hasModifier) {
                            // Modified
                            t = currentTime - tweening.timeStart;
                            d = tweening.timeComplete - tweening.timeStart;
                            nv = tweening.transition(t, 0, 1, d, tweening.transitionParams);
                            nv = property.modifierFunction(property.valueStart, property.valueComplete, nv, property.modifierParameters);
                        } else {
                            // Normal update
                            t = currentTime - tweening.timeStart;
                            b = property.valueStart;
                            c = property.valueComplete - property.valueStart;
                            d = tweening.timeComplete - tweening.timeStart;
                            nv = tweening.transition(t, b, c, d, tweening.transitionParams);
                        }
                    }

                    if (tweening.rounded)
                        nv = Math.round(nv);

                    if (tweening.min !== undefined && nv < tweening.min)
                        nv = tweening.min;
                    if (tweening.max !== undefined && nv > tweening.max)
                        nv = tweening.max;

                    if (property.isSpecialProperty) {
                        // It's a special property, tunnel via the special property method
                        Tweener._specialPropertyList[name].setValue(scope, nv, _specialPropertyList[name].parameters, tweening.properties[name].extra);
                    } else {
                        // Directly set property
                        scope[name] = nv;
                    }
                }

                tweening.updatesSkipped = 0;

                Tweener._callOnFunction(tweening.onUpdate, "onUpdate", tweening.onUpdateScope,
                                scope, tweening.onUpdateParams);

            } else {
                tweening.updatesSkipped++;
            }
        }

        if (isOver) {
            Tweener._callOnFunction(tweening.onComplete, "onComplete", tweening.onCompleteScope,
                            scope, tweening.onCompleteParams);
        }

        return !isOver;
    }

    Tweener._addTweenOrCaller = function(target, tweeningParameters, isCaller) {
        if (!target)
            return false;

        var scopes; // List of objects to tween
        if (target instanceof Array) {
            // The first argument is an array
            scopes = target.concat(); // XXX: To copy the array I guess
        } else {
            // The first argument(s) is(are) object(s)
            scopes = new Array(target);
        }

        var obj, istr;

        if (isCaller) {
            obj = tweeningParameters;
        } else {
            obj = TweenList.makePropertiesChain(tweeningParameters);

            var properties = Tweener._constructPropertyList(obj);

            // Verifies whether the properties exist or not, for warning messages
            for (istr in properties) {
                if (Tweener._specialPropertyList[istr] != undefined) {
                    properties[istr].isSpecialProperty = true;
                } else {
                    for (var i = 0; i < scopes.length; i++) {
                        if (scopes[i][istr] == undefined)
                            log("The property " + istr + " doesn't seem to be a normal object property of " + scopes[i] + " or a registered special property");
                    }
                    properties[istr].isSpecialProperty = false;
                }
            }
        }

        // Creates the main engine if it isn't active
        if (!Tweener._inited) Tweener._init();
        if (!Tweener._engineExists) Tweener._startEngine();

        // Creates a "safer", more strict tweening object
        var time = obj.time || 0;
        var delay = obj.delay || 0;

        var transition;

        // FIXME: Tweener allows you to use functions with an all lower-case name
        if (typeof obj.transition == "string") {
            transition = imports.tweener.equations[obj.transition];
        } else {
            transition = obj.transition;
        }

        if (!transition)
            transition = imports.tweener.equations["easeOutExpo"];

        var tween;

        for (let i = 0; i < scopes.length; i++) {
            if (!isCaller) {
                // Make a copy of the properties
                var copyProperties = new Object();
                for (istr in properties) {
                    copyProperties[istr] = new Tweener.PropertyInfo(properties[istr].valueStart,
                                                            properties[istr].valueComplete,
                                                            properties[istr].valueComplete,
                                                            properties[istr].arrayIndex || 0,
                                                            {},
                                                            properties[istr].isSpecialProperty,
                                                            properties[istr].modifierFunction || null,
                                                            properties[istr].modifierParameters || null);
                }
            }

            tween = new TweenList.TweenList(scopes[i],
                                            Tweener._ticker.getTime() + ((delay * 1000) / Tweener._timeScale),
                                            Tweener._ticker.getTime() + (((delay * 1000) + (time * 1000)) / Tweener._timeScale),
                                            false,
                                            transition,
                                            obj.transitionParams || null);

            tween.properties               =       isCaller ? null : copyProperties;
            tween.onStart                  =       obj.onStart;
            tween.onUpdate                 =       obj.onUpdate;
            tween.onComplete               =       obj.onComplete;
            tween.onOverwrite              =       obj.onOverwrite;
            tween.onError                  =       obj.onError;
            tween.onStartParams            =       obj.onStartParams;
            tween.onUpdateParams           =       obj.onUpdateParams;
            tween.onCompleteParams         =       obj.onCompleteParams;
            tween.onOverwriteParams        =       obj.onOverwriteParams;
            tween.onStartScope             =       obj.onStartScope;
            tween.onUpdateScope            =       obj.onUpdateScope;
            tween.onCompleteScope          =       obj.onCompleteScope;
            tween.onOverwriteScope         =       obj.onOverwriteScope;
            tween.onErrorScope             =       obj.onErrorScope;
            tween.rounded                  =       obj.rounded;
            tween.min                      =       obj.min;
            tween.max                      =       obj.max;
            tween.skipUpdates              =       obj.skipUpdates;
            tween.isCaller                 =       isCaller;

            if (isCaller) {
                tween.count = obj.count;
                tween.waitFrames = obj.waitFrames;
            }

            if (!isCaller) {
                // Remove other tweenings that occur at the same time
                Tweener.removeTweensByTime(tween.scope, tween.properties, tween.timeStart, tween.timeComplete);
            }

            // And finally adds it to the list
            Tweener._tweenList.push(tween);

            // Immediate update and removal if it's an immediate tween
            // If not deleted, it executes at the end of this frame execution
            if (time == 0 && delay == 0) {
                var myT = Tweener._tweenList.length-1;
                Tweener._updateTweenByIndex(myT);
                Tweener._removeTweenByIndex(myT);
            }
        }

        return true;
    };
}

function overrideSignals() {
    if (Signals._signalHandlerIsConnected != null) {
        return;
    }

    function _signalHandlerIsConnected(id) {
        if (! '_signalConnections' in this)
            return false;

        for (let connection of this._signalConnections) {
            if (connection.id == id) {
                if (connection.disconnected)
                    return false;
                else
                    return true;
            }
        }

        return false;
    }

    const originalAddSignalMethods = Signals.addSignalMethods;
    Signals.addSignalMethods = function(proto) {
        originalAddSignalMethods(proto);
        Signals._addSignalMethod(proto, 'signalHandlerIsConnected', _signalHandlerIsConnected);
    };
}