const GObject = imports.gi.GObject;
const Lang = imports.lang;

/**
 * #SignalManager:
 * @short_description: A convenience object for managing signals
 * @_object (Object): The object owning the SignalManager. All callbacks are
 * binded to %_object unless otherwise specified.
 * @_storage (Map): A map that stores all the connected signals. %_storage is
 * indexed by the name of the signal, and each item in %_storage is an array of
 * signals connected, and each signal is represented by an `[object, signalId,
 * callback]` triplet.
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
        this._storage = new Map();
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
        if (!this._storage.has(sigName))
            this._storage.set(sigName, []);

        if (!force && this.isConnected(sigName, obj, callback))
            return

        let id;

        if (bind)
            id = obj.connect(sigName, Lang.bind(bind, callback));
        else
            id = obj.connect(sigName, Lang.bind(this._object, callback));

        this._storage.get(sigName).push([obj, id, callback]);
    },

    _signalIsConnected: function (signal) {
        if (!signal[0])
            return false;
        else if ('_signalConnects' in signal[0]) // JS Object
            return signal[0].signalHandlerIsConnected(signal[1]);
        else // GObject
            return GObject.signal_handler_is_connected(signal[0], signal[1]);
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
     * Returns: Whether the signal is connected
     */
    isConnected: function(sigName, obj, callback) {
        if (!this._storage.has(sigName))
            return false;

        for (let signal of this._storage.get(sigName))
            if ((!obj || signal[0] == obj) &&
                    (!callback || signal[2] == callback) &&
                    this._signalIsConnected(signal))
                return true;

        return false;
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
    disconnect: function(sigName, obj, callback) {
        if (!this._storage.has(sigName))
            return;

        this._storage.get(sigName).forEach(Lang.bind(this, function (signal, i) {
            if ((!obj || signal[0] == obj) &&
                (!callback || signal[2] == callback)) {
                if (this._signalIsConnected(signal))
                    signal[0].disconnect(signal[1]);

                this._storage.get(sigName).splice(i, 1);
            }
        }));

        if (this._storage.get(sigName).length == 0)
            this._storage.delete(sigName);
    },

    /**
     * disconnectAllSignals:
     *
     * Disconnects *all signals* managed by the #SignalManager. This is useful
     * in the @destroy function of objects.
     */
    disconnectAllSignals: function() {
        for (let signals of this._storage.values())
            for (let signal of signals)
                if (this._signalIsConnected(signal))
                    signal[0].disconnect(signal[1]);

        this._storage.clear();
    }
}
