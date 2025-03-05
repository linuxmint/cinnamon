/* exported addObjectSignalMethods */
const GObject = imports.gi.GObject;

/**
 * @private
 * @param {Object} obj - an object
 * @returns {bool} - true if obj has a 'destroy' GObject signal
 */
function _hasDestroySignal(obj) {
    return obj instanceof GObject.Object &&
        GObject.signal_lookup('destroy', obj);
}

var TransientSignalHolder = GObject.registerClass(
class TransientSignalHolder extends GObject.Object {
    static [GObject.signals] = {
        'destroy': {},
    };

    constructor(owner) {
        super();

        if (_hasDestroySignal(owner))
            owner.connectObject('destroy', () => this.destroy(), this);
    }

    destroy() {
        this.emit('destroy');
    }
});

class SignalManager {
    /**
     * @returns {SignalManager} - the SignalManager singleton
     */
    static getDefault() {
        if (!this._singleton)
            this._singleton = new SignalManager();
        return this._singleton;
    }

    constructor() {
        this._signalTrackers = new Map();

        global.connect_after('shutdown', () => {
            [...this._signalTrackers.values()].forEach(
                tracker => tracker.destroy());
            this._signalTrackers.clear();
        });
    }

    /**
     * @param {Object} obj - object to get signal tracker for
     * @returns {SignalTracker} - the signal tracker for object
     */
    getSignalTracker(obj) {
        let signalTracker = this._signalTrackers.get(obj);
        if (signalTracker === undefined) {
            signalTracker = new SignalTracker(obj);
            this._signalTrackers.set(obj, signalTracker);
        }
        return signalTracker;
    }

    /**
     * @param {Object} obj - object to get signal tracker for
     * @returns {?SignalTracker} - the signal tracker for object if it exists
     */
    maybeGetSignalTracker(obj) {
        return this._signalTrackers.get(obj) ?? null;
    }

    /*
     * @param {Object} obj - object to remove signal tracker for
     * @returns {void}
     */
    removeSignalTracker(obj) {
        this._signalTrackers.delete(obj);
    }
}

class SignalTracker {
    /**
     * @param {Object=} owner - object that owns the tracker
     */
    constructor(owner) {
        if (_hasDestroySignal(owner))
            this._ownerDestroyId = owner.connect_after('destroy', () => this.clear());

        this._owner = owner;
        this._map = new Map();
    }

    /**
     * @typedef SignalData
     * @property {number[]} ownerSignals - a list of handler IDs
     * @property {number} destroyId - destroy handler ID of tracked object
     */

    /**
     * @private
     * @param {Object} obj - a tracked object
     * @returns {SignalData} - signal data for object
     */
    _getSignalData(obj) {
        let data = this._map.get(obj);
        if (data === undefined) {
            data = { ownerSignals: [], destroyId: 0 };
            this._map.set(obj, data);
        }
        return data;
    }

    /**
     * @private
     * @param {GObject.Object} obj - tracked widget
     */
    _trackDestroy(obj) {
        const signalData = this._getSignalData(obj);
        if (signalData.destroyId)
            return;
        signalData.destroyId = obj.connect_after('destroy', () => this.untrack(obj));
    }

    _disconnectSignalForProto(proto, obj, id) {
        proto['disconnect'].call(obj, id);
    }

    _getObjectProto(obj) {
        return obj instanceof GObject.Object
            ? GObject.Object.prototype
            : Object.getPrototypeOf(obj);
    }

    _disconnectSignal(obj, id) {
        this._disconnectSignalForProto(this._getObjectProto(obj), obj, id);
    }

    _removeTracker() {
        if (this._ownerDestroyId)
            this._disconnectSignal(this._owner, this._ownerDestroyId);

        SignalManager.getDefault().removeSignalTracker(this._owner);

        delete this._ownerDestroyId;
        delete this._owner;
    }

    /**
     * @param {Object} obj - tracked object
     * @param {...number} handlerIds - tracked handler IDs
     * @returns {void}
     */
    track(obj, ...handlerIds) {
        if (_hasDestroySignal(obj))
            this._trackDestroy(obj);

        this._getSignalData(obj).ownerSignals.push(...handlerIds);
    }

    /**
     * @param {Object} obj - tracked object instance
     * @returns {void}
     */
    untrack(obj) {
        const { ownerSignals, destroyId } = this._getSignalData(obj);
        this._map.delete(obj);

        const ownerProto = this._getObjectProto(this._owner);
        ownerSignals.forEach(id =>
            this._disconnectSignalForProto(ownerProto, this._owner, id));
        if (destroyId)
            this._disconnectSignal(obj, destroyId);

        if (this._map.size === 0)
            this._removeTracker();
    }

    /**
     * @returns {void}
     */
    clear() {
        this._map.forEach((_, obj) => this.untrack(obj));
    }

    /**
     * @returns {void}
     */
    destroy() {
        this.clear();
        this._removeTracker();
    }
}

/**
 * Connect one or more signals, and associate the handlers
 * with a tracked object.
 *
 * All handlers for a particular object can be disconnected
 * by calling disconnectObject(). If object is a {Clutter.widget},
 * this is done automatically when the widget is destroyed.
 *
 * @param {object} thisObj - the emitter object
 * @param {...any} args - a sequence of signal-name/handler pairs
 * with an optional flags value, followed by an object to track
 * @returns {void}
 */
function connectObject(thisObj, ...args) {
    const getParams = argArray => {
        const [signalName, handler, arg, ...rest] = argArray;
        if (typeof arg !== 'number')
            return [signalName, handler, 0, arg, ...rest];

        const flags = arg;
        let flagsMask = 0;
        Object.values(GObject.ConnectFlags).forEach(v => (flagsMask |= v));
        if (!(flags & flagsMask))
            throw new Error(`Invalid flag value ${flags}`);
        if (flags & GObject.ConnectFlags.SWAPPED)
            throw new Error('Swapped signals are not supported');
        return [signalName, handler, flags, ...rest];
    };

    const connectSignal = (emitter, signalName, handler, flags) => {
        const isGObject = emitter instanceof GObject.Object;
        const func = (flags & GObject.ConnectFlags.AFTER) && isGObject
            ? 'connect_after'
            : 'connect';
        const emitterProto = isGObject
            ? GObject.Object.prototype
            : Object.getPrototypeOf(emitter);
        return emitterProto[func].call(emitter, signalName, handler);
    };

    const signalIds = [];
    while (args.length > 1) {
        const [signalName, handler, flags, ...rest] = getParams(args);
        signalIds.push(connectSignal(thisObj, signalName, handler, flags));
        args = rest;
    }

    const obj = args.at(0) ?? globalThis;

    const tracker = SignalManager.getDefault().getSignalTracker(thisObj);
    tracker.track(obj, ...signalIds);
}

/**
 * Disconnect all signals that were connected for
 * the specified tracked object
 *
 * @param {Object} thisObj - the emitter object
 * @param {Object} obj - the tracked object
 * @returns {void}
 */
function disconnectObject(thisObj, obj) {
    SignalManager.getDefault().maybeGetSignalTracker(thisObj)?.untrack(obj);
}

/**
 * Add connectObject()/disconnectObject() methods
 * to prototype. The prototype must have the connect()
 * and disconnect() signal methods.
 *
 * @param {prototype} proto - a prototype
 */
function addObjectSignalMethods(proto) {
    proto['connectObject'] = function (...args) {
        connectObject(this, ...args);
    };
    proto['connect_object'] = proto['connectObject'];

    proto['disconnectObject'] = function (obj) {
        disconnectObject(this, obj);
    };
    proto['disconnect_object'] = proto['disconnectObject'];
}

