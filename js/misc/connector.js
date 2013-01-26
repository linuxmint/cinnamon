// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

/* usage: "makeConnection(someObject, 'some-signal', someFunction [, ...])"
 * 
 * @arg-0: target, the object you want to connect to
 * @arg-1 .. @arg-n: arguments to the target's connect function
 *
 * return value: an object that you call disconnect on
 */
var makeConnection = function() {
    let args = [].slice.apply(arguments);
    let target = args.shift();
    let id = target.connect.apply(target, args);
    return {
        disconnect: function() {target.disconnect(id);}
    };
};

function Connector() {
    this._init(arguments);
}

/* A class that takes care of your connections - just remember to
 * call destroy when it is time to disconnect.
 */
Connector.prototype = {
_init: function() {
    this.connections = [];

    /* usage: "addConnection(someObject, 'some-signal', someFunction [, ...])"
     * 
     * @arg-0: target, the object you want to connect to
     * @arg-1 .. @arg-n: arguments to the target's connect function
     */
    this.addConnection = function() {
        let connection = makeConnection.apply(0, arguments);
        this.connections.push(connection);
    };

    /* Disconnects all connections.
     */
    this.destroy = function() {
        this.connections.forEach(function(connection) {
            connection.disconnect();
        }, this);
        this.connections = null;
    };
}
};
