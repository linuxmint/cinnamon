// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

imports.gi.versions.Clutter = '1.0';
imports.gi.versions.Gio = '2.0';
imports.gi.versions.Gdk = '3.0';
imports.gi.versions.GdkPixbuf = '2.0';
imports.gi.versions.Gtk = '3.0';

const Clutter = imports.gi.Clutter;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Overrides = imports.ui.overrides;
const Mainloop = imports.mainloop;

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
        this.add_actor(actor);
        if (props)
            this.child_set(actor, props);
    };
}

function init() {
    // Add some bindings to the global JS namespace; (gjs keeps the web
    // browser convention of having that namespace be called 'window'.)
    window.global = Cinnamon.Global.get();

    window._ = Gettext.gettext;
    window.C_ = Gettext.pgettext;
    window.ngettext = Gettext.ngettext;

    // Set the default direction for St widgets (this needs to be done before any use of St)
    if (Gtk.Widget.get_default_direction() == Gtk.TextDirection.RTL) {
        St.Widget.set_default_direction(St.TextDirection.RTL);
    }

    // Miscellaneous monkeypatching
    _patchContainerClass(St.BoxLayout);
    _patchContainerClass(St.Table);

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

    function setTimeout(callable, duration) {
        var params = [].slice.call(arguments, 2);
        return Mainloop.timeout_add(duration, ((params) => {
            return () => {
                callable.apply(window, params);
            };
        })(params));
    }

    window.setTimeout = setTimeout;

    /*
    https://github.com/taylorhakes/promise-polyfill
    Lightweight ES6 Promise polyfill for the browser and node. A+ Compliant
    Copyright (c) 2014 Taylor Hakes
    Copyright (c) 2014 Forbes Lindesay

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
    */

    (function(root) {

        // Store setTimeout reference so promise-polyfill will be unaffected by
        // other code modifying setTimeout (like sinon.useFakeTimers())
        var setTimeoutFunc = setTimeout;

        function noop() {}

        // Polyfill for Function.prototype.bind
        function bind(fn, thisArg) {
            return function() {
                fn.apply(thisArg, arguments);
            };
        }

        function Promise(fn) {
            if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
            if (typeof fn !== 'function') throw new TypeError('not a function');
            this._state = 0;
            this._handled = false;
            this._value = undefined;
            this._deferreds = [];

            doResolve(fn, this);
        }

        function handle(self, deferred) {
            while (self._state === 3) {
                self = self._value;
            }
            if (self._state === 0) {
                self._deferreds.push(deferred);
                return;
            }
            self._handled = true;
            Promise._immediateFn(function() {
                var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
                if (cb === null) {
                    (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
                    return;
                }
                var ret;
                try {
                    ret = cb(self._value);
                } catch (e) {
                    reject(deferred.promise, e);
                    return;
                }
                resolve(deferred.promise, ret);
            });
        }

        function resolve(self, newValue) {
            try {
                // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
                if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.');
                if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
                    var then = newValue.then;
                    if (newValue instanceof Promise) {
                        self._state = 3;
                        self._value = newValue;
                        finale(self);
                        return;
                    } else if (typeof then === 'function') {
                        doResolve(bind(then, newValue), self);
                        return;
                    }
                }
                self._state = 1;
                self._value = newValue;
                finale(self);
            } catch (e) {
                reject(self, e);
            }
        }

        function reject(self, newValue) {
            self._state = 2;
            self._value = newValue;
            finale(self);
        }

        function finale(self) {
            if (self._state === 2 && self._deferreds.length === 0) {
                Promise._immediateFn(function() {
                    if (!self._handled) {
                        Promise._unhandledRejectionFn(self._value);
                    }
                });
            }

            for (var i = 0, len = self._deferreds.length; i < len; i++) {
                handle(self, self._deferreds[i]);
            }
            self._deferreds = null;
        }

        function Handler(onFulfilled, onRejected, promise) {
            this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
            this.onRejected = typeof onRejected === 'function' ? onRejected : null;
            this.promise = promise;
        }

        /**
         * Take a potentially misbehaving resolver function and make sure
         * onFulfilled and onRejected are only called once.
         *
         * Makes no guarantees about asynchrony.
         */
        function doResolve(fn, self) {
            var done = false;
            try {
                fn(function(value) {
                    if (done) return;
                    done = true;
                    resolve(self, value);
                }, function(reason) {
                    if (done) return;
                    done = true;
                    reject(self, reason);
                });
            } catch (ex) {
                if (done) return;
                done = true;
                reject(self, ex);
            }
        }

        Promise.prototype['catch'] = function(onRejected) {
            return this.then(null, onRejected);
        };

        Promise.prototype.then = function(onFulfilled, onRejected) {
            var prom = new(this.constructor)(noop);

            handle(this, new Handler(onFulfilled, onRejected, prom));
            return prom;
        };

        Promise.all = function(arr) {
            var args = Array.prototype.slice.call(arr);

            return new Promise(function(resolve, reject) {
                if (args.length === 0) return resolve([]);
                var remaining = args.length;

                function res(i, val) {
                    try {
                        if (val && (typeof val === 'object' || typeof val === 'function')) {
                            var then = val.then;
                            if (typeof then === 'function') {
                                then.call(val, function(val) {
                                    res(i, val);
                                }, reject);
                                return;
                            }
                        }
                        args[i] = val;
                        if (--remaining === 0) {
                            resolve(args);
                        }
                    } catch (ex) {
                        reject(ex);
                    }
                }

                for (var i = 0; i < args.length; i++) {
                    res(i, args[i]);
                }
                return true; // Added for CJS to avoid "anonymous function does not always return a value" warning.
            });
        };

        Promise.resolve = function(value) {
            if (value && typeof value === 'object' && value.constructor === Promise) {
                return value;
            }

            return new Promise(function(resolve) {
                resolve(value);
            });
        };

        Promise.reject = function(value) {
            return new Promise(function(resolve, reject) {
                reject(value);
            });
        };

        Promise.race = function(values) {
            return new Promise(function(resolve, reject) {
                for (var i = 0, len = values.length; i < len; i++) {
                    values[i].then(resolve, reject);
                }
            });
        };

        // Use polyfill for setImmediate for performance gains
        Promise._immediateFn = (typeof setImmediate === 'function' && function(fn) {
                setImmediate(fn);
            }) ||
            function(fn) {
                setTimeoutFunc(fn, 0);
            };

        Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
            throw new Error('Possible Unhandled Promise Rejection: ' + err.toString());
        };

        /**
         * Set the immediate function to execute callbacks
         * @param fn {function} Function to execute
         * @deprecated
         */
        Promise._setImmediateFn = function _setImmediateFn(fn) {
            Promise._immediateFn = fn;
        };

        /**
         * Change the function to execute on unhandled rejection
         * @param {function} fn Function to execute on unhandled rejection
         * @deprecated
         */
        Promise._setUnhandledRejectionFn = function _setUnhandledRejectionFn(fn) {
            Promise._unhandledRejectionFn = fn;
        };

        if (typeof module !== 'undefined' && module.exports) {
            module.exports = Promise;
        } else if (!root.Promise) {
            root.Promise = Promise;
        }

    })(window);

    Overrides.init();
}
