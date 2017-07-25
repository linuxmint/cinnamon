const GObject = imports.gi.GObject;
const Lang = imports.lang;

/**
 * #SignalManager:
 * @short_description: A convenience object for managing signals
 * @_object (Object): The object owning the SignalManager. All callbacks are
 * binded to %_object unless otherwise specified.
 * @_storage (Array): An array that stores all the connected signals. Each
 * signal is stored as an array in the form `[signalName, object, callback,
 * signalId]`.
 *
 * The #SignalManager is a convenience object for managing signals. If you use
 * this to connect signals, you can later disconnect them by signal name or
 * just disconnect everything! No need to keep track of those annoying
 * @signalIds by yourself anymore!
 *
 * A common use case is to use the #SignalManager to connect to signals and then
 * use the @disconnectAllSignals function when the object is destroyed, to
 * avoid keeping track of all the signals manually.
 *
 * However, this is not always needed. If you are connecting to a signal of
 * your actor, the signals are automatically disconnected when you destroy the
 * actor. Using the #SignalManager to disconnect all signals is only needed when
 * connecting to objects that persists after the object disappears.
 *
 * Every Javascript object should have its own @SignalManager, and use it to
 * connect signals of all objects it takes care of. For example, the panel will
 * have one #SignalManger object, which manages all signals from #GSettings,
 * `global.screen` etc.
 *
 * An example usage is as follows:
 * ```
 * MyApplet.prototype = {
 *     __proto__: Applet.Applet.prototype,
 *
 *     _init: function(orientation, panelHeight, instanceId) {
 *         Applet.Applet.prototype._init.call(this, orientation, panelHeight, instanceId);
 *
 *         this._signalManager = new SignalManager.SignalManager(this);
 *         this._signalManager.connect(global.settings, "changed::foo", this._onChanged);
 *     },
 *
 *     _onChanged: function() {
 *         // Do something
 *     },
 *
 *     on_applet_removed_from_panel: function() {
 *         this._signalManager.disconnectAllSignals();
 *     }
 * }
 * ```
 */
function SignalManager(object) {
    this._init(object);
}

SignalManager.prototype = {
    /**
     * _init:
     * @object (Object): the object owning the #SignalManager (usually @this)
     */
    _init: function(object) {
        this._object = object;
        this._storage = [];
    },

    /**
     * connect:
     * @obj (Object): the object whose signal we are listening to
     * @sigName (string): the name of the signal we are listening to
     * @callback (function): the callback function
     * @bind (Object): (optional) the object to bind the function to. Leave
     * empty for the owner of the #SignalManager (which has no side effects if
     * you don't need to bind at all).
     * @force (boolean): whether to connect again even if it is connected
     *
     * This listens to the signal @sigName from @obj and calls @callback when
     * the signal is emitted. @callback is automatically binded to
     * %this._object, unless the @bind argument is set to something else, in
     * which case the function will be binded to @bind.
     *
     * This checks whether the signal is already connected and will not connect
     * again if it is already connected. This behaviour can be overridden by
     * settings @force to be @true.
     *
     * For example, what you would normally write as
     * ```
     * global.settings.connect("changed::foo", Lang.bind(this, this._bar))
     * ```
     * would become
     * ```
     * this._signalManager.connect(global.settings, "changed::foo", this._bar)
     * ```
     *
     * Note that in this function, the first argument is the object, while the
     * second is the signal name. In all other methods, you first pass the
     * signal name, then the object (since the object is rarely passed in other
     * functions).
     */
    connect: function(obj, sigName, callback, bind, force) {
        if (!force && this.isConnected(sigName, obj, callback))
            return

        let id;

        if (bind)
            id = obj.connect(sigName, Lang.bind(bind, callback));
        else
            id = obj.connect(sigName, Lang.bind(this._object, callback));

        this._storage.push([sigName, obj, callback, id]);
    },

    connect_after: function(obj, sigName, callback, bind, force) {
        if (!force && this.isConnected(sigName, obj, callback))
            return

        let id;

        if (bind)
            id = obj.connect_after(sigName, Lang.bind(bind, callback));
        else
            id = obj.connect_after(sigName, Lang.bind(this._object, callback));

        this._storage.push([sigName, obj, callback, id]);
    },

    _signalIsConnected: function (signal) {
        if (!signal[1])
            return false;
        else if (signal[1] instanceof GObject.Object)// GObject
            return GObject.signal_handler_is_connected(signal[1], signal[3]);
        else if ('signalHandlerIsConnected' in signal[1]) // JS Object
            return signal[1].signalHandlerIsConnected(signal[3]);
        else
            return false;
    },

    /**
     * isConnected:
     * @sigName (string): the signal we care about
     * @obj (Object): (optional) the object we care about, or leave empty if we
     * don't care about which object it is
     * @callback (function): (optional) the callback function we care about, or
     * leave empty if we don't care about what callback is connected
     *
     * This checks whether the signal @sigName is connected. The optional
     * arguments @obj and @callback can be used to specify what signals in
     * particular we want to know. Note that when you supply @callBack, you
     * usually want to supply @obj as well, since two different objects can
     * connect to the same signal with the same callback.
     *
     * This is functionally equivalent to (and implemented as)
     * ```
     * this.getSignals(arguments).length > 0);
     * ```
     *
     * Returns: Whether the signal is connected
     */
    isConnected: function() {
        return (this.getSignals.apply(this, arguments).length > 0);
    },

    /**
     * getSignals:
     * @sigName (string): the signal we care about
     * @obj (Object): (optional) the object we care about, or leave empty if we
     * don't care about which object it is
     * @callback (function): (optional) the callback function we care about, or
     * leave empty if we don't care about what callback is connected
     *
     * This returns the list of all signals that matches the description
     * provided. Each signal is represented by an array in the form
     * `[signalName, object, callback, signalId]`.
     *
     * Returns (Array): The list of signals
     */
    getSignals: function(sigName, obj, callback) {
        let results = this._storage;

        if (sigName)
            results = results.filter(x => x[0] == sigName);
        if (obj)
            results = results.filter(x => x[1] == obj);
        if (callback)
            results = results.filter(x => x[2] == callback);

        return results;
    },

    /**
     * disconnect:
     * @sigName (string): the signal we care about
     * @obj (Object): (optional) the object we care about, or leave empty if we
     * don't care about which object it is
     * @callback (function): (optional) the callback function we care about, or
     * leave empty if we don't care about what callback is connected
     *
     * This disconnects all *signals* named @sigName. By default, it
     * disconnects the signal on all objects, but can be fine-tuned with the
     * optional @obj and @callback arguments.
     *
     * This function will do nothing if no such signal is connected, the object
     * no longer exists, or the signal is somehow already disconnected. So
     * checks need not be performed before calling this function.
     */
    disconnect: function() {
        let results = this.getSignals.apply(this, arguments);
        results.filter(this._signalIsConnected).forEach(x => x[1].disconnect(x[3]));

        this._storage = this._storage.filter(x => results.indexOf(x) == -1);
    },

    /**
     * disconnectAllSignals:
     *
     * Disconnects *all signals* managed by the #SignalManager. This is useful
     * in the @destroy function of objects.
     */
    disconnectAllSignals: function() {
        this._storage.filter(this._signalIsConnected).forEach(x => x[1].disconnect(x[3]));

        this._storage = [];
    }
}
