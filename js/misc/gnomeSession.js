// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const DBus = imports.dbus;
const Lang = imports.lang;
const Signals = imports.signals;

const PresenceIface = {
    name: 'org.gnome.SessionManager.Presence',
    methods: [{ name: 'SetStatus',
                inSignature: 'u',
                outSignature: '' }],
    properties: [{ name: 'status',
                   signature: 'u',
                   access: 'readwrite' }],
    signals: [{ name: 'StatusChanged',
                inSignature: 'u' }]
};

const PresenceStatus = {
    AVAILABLE: 0,
    INVISIBLE: 1,
    BUSY: 2,
    IDLE: 3
};

function Presence() {
    this._init();
}

Presence.prototype = {
    _init: function() {
        DBus.session.proxifyObject(this, 'org.gnome.SessionManager', '/org/gnome/SessionManager/Presence', this);
    },

    getStatus: function(callback) {
        this.GetRemote('status', Lang.bind(this,
            function(status, ex) {
                if (!ex)
                    callback(this, status);
            }));
    },

    setStatus: function(status) {
        this.SetStatusRemote(status);
    }
};
DBus.proxifyPrototype(Presence.prototype, PresenceIface);

// Note inhibitors are immutable objects, so they don't
// change at runtime (changes always come in the form
// of new inhibitors)
const InhibitorIface = {
    name: 'org.gnome.SessionManager.Inhibitor',
    properties: [{ name: 'app_id',
                   signature: 's',
                   access: 'readonly' },
                 { name: 'client_id',
                   signature: 's',
                   access: 'readonly' },
                 { name: 'reason',
                   signature: 's',
                   access: 'readonly' },
                 { name: 'flags',
                   signature: 'u',
                   access: 'readonly' },
                 { name: 'toplevel_xid',
                   signature: 'u',
                   access: 'readonly' },
                 { name: 'cookie',
                   signature: 'u',
                   access: 'readonly' }],
};

function Inhibitor(objectPath) {
    this._init(objectPath);
}

Inhibitor.prototype = {
    _init: function(objectPath) {
        DBus.session.proxifyObject(this,
                                   'org.gnome.SessionManager',
                                   objectPath);
        this.isLoaded = false;
        this._loadingPropertiesCount = InhibitorIface.properties.length;
        for (let i = 0; i < InhibitorIface.properties.length; i++) {
            let propertyName = InhibitorIface.properties[i].name;
            this.GetRemote(propertyName, Lang.bind(this,
                function(value, exception) {
                    if (exception)
                        return;

                    this[propertyName] = value;
                    this._loadingPropertiesCount--;

                    if (this._loadingPropertiesCount == 0) {
                        this.isLoaded = true;
                        this.emit('is-loaded');
                    }
                }));
        }
    },
};
DBus.proxifyPrototype(Inhibitor.prototype, InhibitorIface);
Signals.addSignalMethods(Inhibitor.prototype);


// Not the full interface, only the methods we use
const SessionManagerIface = {
    name: 'org.gnome.SessionManager',
    methods: [
        { name: 'Logout', inSignature: 'u', outSignature: '' },
        { name: 'Shutdown', inSignature: '', outSignature: '' },
        { name: 'CanShutdown', inSignature: '', outSignature: 'b' }
    ]
};

function SessionManager() {
    this._init();
}

SessionManager.prototype = {
    _init: function() {
        DBus.session.proxifyObject(this, 'org.gnome.SessionManager', '/org/gnome/SessionManager');
    }
};
DBus.proxifyPrototype(SessionManager.prototype, SessionManagerIface);