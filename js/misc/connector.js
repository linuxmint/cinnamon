// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;

/* usage:
 * "let connection = connect(someObject, 'some-signal', someFunction [, ...])
 *  ///...
 *  connection.disconnect();
 *  "
 * 
 * @arg-0: target, the object you want to connect to
 * @arg-1 .. @arg-n: arguments to the target's connect function
 *
 * return value: an object that you call disconnect on
 */
var connect = function() {
    let args = [].slice.apply(arguments);
    let target = args.shift();
    let id = target.connect.apply(target, args);
    return {
        disconnect: function() {
            if (target) {
                target.disconnect(id); target = null;
                }
        },
        forget: function() {
            target = null;
        },
        getTarget: function() {
            return target;
        },
        /* Ties the connection to an object, so it is automatically destroyed with the object.
         */
        tie: function(object) {
            object.connect('destroy', Lang.bind(this, this.disconnect));
        }
    };
};

function Connector() {
    this._init.apply(this, arguments);
}

/* A class that takes care of your connections - just remember to
 * call destroy when it is time to disconnect.
 */
Connector.prototype = {
    _init: function() {
        this.connections = [];
    },

    /* usage: "addConnection(someObject, 'some-signal', someFunction [, ...])"
     * 
     * @arg-0: target, the object you want to connect to
     * @arg-1 .. @arg-n: arguments to the target's connect function
     *
     * @return aConnection, the created connection, which you can optionally disconnect or "forget" later on.
     */
    addConnection: function() {
        let connection = connect.apply(0, arguments);
        this.connections.push(connection);
        return connection;
    },

    /* Disconnects all connections.
     */
    destroy: function() {
        if (this.connections) {
            this.connections.forEach(function(connection) {
                connection.disconnect();
            }, this);
            this.connections = null;
        }
    },

    /* Ties the connector to an object, so the connector is automatically destroyed with the object.
     */
    tie: function(object) {
        object.connect('destroy', Lang.bind(this, this.destroy));
    }
};
