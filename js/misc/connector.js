// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;

function _createConnection() {
    if (!('_connectionManager' in this))
        this._connectionManager = new Connector();
    return this._connectionManager.createConnection.apply(this._connectionManager, arguments);
}

function _destroyConnections() {
    if ('_connectionManager' in this)
        this._connectionManager.destroyConnections();
}

function _setConnectionMaster(master, signal) {
    if (!('_connectionManager' in this))
        this._connectionManager = new Connector();
    this._connectionManager.setMaster(master, signal);
}

function addConnectorMethods(proto) {
    proto.createConnection = _createConnection;
    proto.destroyConnections = _destroyConnections;
    proto.setConnectionMaster = _setConnectionMaster;
}

/* A class that takes care of a connection.
 * Just remember to call disconnect on it when you don't need it anymore.
 */
function Connection() {
    this._init.apply(this, arguments);
}

Connection.prototype = {
    _init: function(target, args) {
        this._target = target;
        this._id = target.connect.apply(target, args);
    },
    
    disconnect: function() {
        if (this._target) {
            this._target.disconnect(this._id);
            this._target = null;
        }
    },
    
    forget: function() {
        this._target = null;
    },
    
    getTarget: function() {
        return this._target;
    }
}

/* usage:
 * "let connection = createConnection(target, 'signal', callback [, ...])
 *  ///...
 *  connection.disconnect();
 *  "
 * 
 * @arg-0: target, the object you want to connect to
 * @arg-1: the signal name
 * @arg-2: the callback
 * @arg-3 .. @arg-n: optional arguments (i.e. user data)
 *
 * return a Connection object that you can later disconnect from
 */
function createConnection() {
    let args = [].slice.apply(arguments);
    let target = args.shift();
    return new Connection(target, args);
}

/* A class that takes care of your connections.
 * Just remember to call destroyConnections when it is time to disconnect.
 * Alternatively you can watch an object for a destruction signal (setMaster)
 */
function Connector() {
    this._init.apply(this, arguments);
}

Connector.prototype = {
    _init: function() {
        this.connections = [];
        this.master = null;
    },

    /* usage: "createConnection(target, 'signal', callback [, ...])"
     * 
     * @arg-0: target, the object you want to connect to
     * @arg-1: the signal name
     * @arg-2: the callback
     * @arg-3 .. @arg-n: optional arguments (i.e. user data)
     *
     * @return a Connection, which you can optionally disconnect or "forget" later on.
     */
    createConnection: function() {
        let connection = createConnection.apply(0, arguments);
        this.connections.push(connection);
        return connection;
    },

    /* Disconnects and remove all connections.
     */
    destroyConnections: function() {
        this.connections.forEach(function(connection) {
            connection.disconnect();
        }, this);
        this.connections = [];
    },
    
    /* Watch an object for a destruction signal and when it happens, destroy all connections.
     * Any previously set master will be disconnected from.
     * 
     * @master the object to watch for a destruction signal
     * @signal the destruction signal to watch for (default value is 'destroy')
     */
    setMaster: function(master, signal) {
        if(!signal)
            signal = 'destroy';
        if(this.master) {
            this.master.disconnect();
            this.master = null;
        }
        if(master)
            this.master = createConnection(master, signal, Lang.bind(this, this._onMasterDestroyed));
    },
    
    _onMasterDestroyed: function() {
        this.destroyConnections();
        this.setMaster(null);
    }
};
