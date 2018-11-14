const {find, filter} = imports.misc.util;

function intersect(array1, array2, difference = false) {
    let result = [];
    for (let i = 0; i < array1.length; i++) {
        if ((!difference && array2.indexOf(array1[i]) > -1) || (difference && array2.indexOf(array1[i]) === -1)) {
            result.push(array1[i]);
        }
    }
    return result;
}

function clone(object, refs = [], cache = null) {
    if (!cache) {
        cache = object;
    }
    let copy;

    if (!object || typeof object !== 'object' || object.prototype || object.toString().indexOf('[0x') > -1) {
        return object;
    }

    if (object instanceof Date) {
        copy = new Date();
        copy.setTime(object.getTime());
        return copy;
    }

    if (Array.isArray(object) || object instanceof Array) {
        refs.push(object);
        copy = [];
        for (let i = 0; i < object.length; i++) {
            if (refs.indexOf(object[i]) >= 0) {
                // circular
                return null;
            }
            copy[i] = clone(object[i], refs, cache);
        }

        refs.pop();
        return copy;
    }

    refs.push(object);
    copy = {};

    if (object instanceof Error) {
        copy.name = object.name;
        copy.message = object.message;
        copy.stack = object.stack;
    }

    let keys = Object.keys(object);
    for (let i = 0; i < keys.length; i++) {
        if (!Object.prototype.hasOwnProperty.call(object, keys[i])) {
            continue;
        }
        if (refs.indexOf(object[keys[i]]) >= 0) {
            return null;
        }
        copy[keys[i]] = clone(object[keys[i]], refs, cache);
    }

    refs.pop();
    return copy;
}

/**
 * init:
 * @state (object): The applet that contains the context menu.
 * @listeners (array): The orientation of the applet.
 *
 * Constructor function
 *
 * Returns (object): The public API with state.
 */

/**
 * get:
 * @key (string|null): The key to get from the state object.
 *
 * Passing null or an asterisk will retrieve the entire state object.
 * Passing keys with dot notation will return the corresponding object path.
 * E.g., "bar.foo".
 *
 * Returns (object): The cloned object.
 */

/**
 * set:
 * @object (object): The object to assign into state.
 * @forceDispatch (boolean): Whether or not to force dispatching of callbacks from any
 * connected listeners on @object's keys. By default, this only occurs if the state has
 * actually changed as a result of setting.
 *
 * Copies a keyed object back into state, and calls dispatch to fire any connected callbacks.
 *
 * Returns (object): The public API for chaining.
 */

/**
 * exclude:
 * @excludeKeys (array): Array of string keys.
 *
 * Returns (object): The public API with filtered state.
 */

/**
 * trigger:
 *
 * Fires a callback event for any matching keys in the listener queue.
 * It supports passing through unlimited arguments to the callback.
 * Useful for setting up actions.
 *
 * Returns (any): Return result of the callback.
 */

/**
 * connect:
 * @actions (string|array|object): Actions
 * @callback (function): The function to be invoked on either state
 * property change, or through the trigger method.
 *
 * Returns (number): The connection ID to use for later disconnection.
 */

/**
 * disconnect:
 * @key (string): The ID to disconnect.
 *
 * Removes a callback listener from the queue.
 */

/**
 * destroy:
 *
 * Assigns undefined to all state properties and listeners. Intended
 * to be used at the end of the application life cycle.
 *
 */
function createStore(state = {}, listeners = [], connections = 0) {
    const publicAPI = Object.freeze({
        get,
        set,
        exclude,
        trigger,
        connect,
        disconnect,
        destroy
    });

    function getAPIWithObject(object) {
        return Object.assign(object, publicAPI);
    }

    function dispatch(object) {
        let keys = Object.keys(object);

        for (let i = 0; i < listeners.length; i++) {
            let commonKeys = intersect(keys, listeners[i].keys);
            if (commonKeys.length === 0) {
                continue;
            }
            if (listeners[i].callback) {
                let partialState = {};
                for (let z = 0; z < listeners[i].keys.length; z++) {
                    partialState[listeners[i].keys[z]] = state[listeners[i].keys[z]];
                }
                listeners[i].callback(partialState);
            }
        }
    }

    function storeError(method, key, message) {
        global.log(new Error('[store -> ' + method + ' -> ' + key + '] ' + message));
    }

    function getByPath(key, state) {
        const path = key.split('.');
        let object = clone(state);
        for (let i = 0; i < path.length; i++) {
            object = object[path[i]];
            if (!object) {
                return object;
            }
        }
        return object;
    }

    function get(key = null) {
        if (!key || key === '*') {
            return state;
        }
        if (key.indexOf('.') > -1) {
            return getByPath(key, state);
        }
        return clone(state[key]);
    }

    function set(object, forceDispatch) {
        let keys = Object.keys(object);
        let changed = false;
        for (let i = 0; i < keys.length; i++) {
            if (state[keys[i]] !== object[keys[i]]) {
                changed = true;
                state[keys[i]] = object[keys[i]];
            }
        }

        if ((changed || forceDispatch) && listeners.length > 0) {
            dispatch(object);
        }

        return publicAPI;
    }

    function exclude(excludeKeys) {
        let object = {};
        let keys = Object.keys(state);
        for (let i = 0; i < keys.length; i++) {
            if (excludeKeys.indexOf(keys[i]) === -1) {
                object[keys[i]] = state[keys[i]];
            }
        }

        return getAPIWithObject(object);
    }

    function trigger() {
        const [key, ...args] = Array.from(arguments);
        let matchedListeners = filter(listeners, function(listener) {
            return listener.keys.indexOf(key) > -1 && listener.callback;
        });
        if (matchedListeners.length === 0) {
            storeError('trigger', key, 'Action not found.');
        }
        for (let i = 0, len = matchedListeners.length; i < len; i++) {
            if (len > 1) {
                matchedListeners[i].callback(...args);
            } else {
                return matchedListeners[i].callback(...args);
            }
        }
    }

    function _connect(keys, callback, id) {
        let listener;

        if (callback) {
            listener = find(listeners, function(listener) {
                return listener.callback === callback;
            });
        }
        if (listener) {
            let newKeys = intersect(keys, listener.keys, true);
            listener.keys.concat(newKeys);
        } else {
            listeners.push({keys, callback, id});
        }
    }

    function connect(actions, callback) {
        const id = connections++;
        if (Array.isArray(actions)) {
            _connect(actions, callback, id);
        } else if (typeof actions === 'string') {
            _connect([actions], callback, id);
        } else if (typeof actions === 'object') {
            let keys = Object.keys(actions);
            for (let i = 0; i < keys.length; i++) {
                _connect([keys[i]], actions[keys[i]], id);
            }
        }

        return id;
    }

    function disconnectByKey(key) {
        let listener = filter(listeners, function(listener) {
            return listener.keys.indexOf(key) > -1;
        });
        let listenerIndex = listeners.indexOf(listener);
        if (listenerIndex === -1) {
            storeError('disconnect', key, 'Invalid disconnect key.');
        }
        listeners[listenerIndex] = undefined;
        listeners.splice(listenerIndex, 1);
    }

    function disconnect(key) {
        if (typeof key === 'string') {
            disconnectByKey(key);
        } else if (Array.isArray(key)) {
            for (let i = 0; i < key.length; i++) {
                disconnectByKey(key[i]);
            }
        } else if (typeof key === 'number') {
            let len = listeners.slice().length;
            for (let i = 0; i < len; i++) {
                if (!listeners[i] || listeners[i].id !== key) {
                    continue;
                }
                listeners[i] = undefined;
                listeners.splice(i, 1);
            }
        }
    }

    function destroy() {
        let keys = Object.keys(state);
        for (let i = 0; i < keys.length; i++) {
            state[keys[i]] = undefined;
        }
        for (let i = 0; i < listeners.length; i++) {
            listeners[i] = undefined;
        }
    }

    return getAPIWithObject(state);
}
