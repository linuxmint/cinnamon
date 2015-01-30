// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Signals = imports.signals;

const PresenceIface = '\
<node> \
    <interface name="org.gnome.SessionManager.Presence"> \
        <method name="SetStatus"> \
            <arg type="u" direction="in"/> \
        </method> \
        <property name="status" type="u" access="readwrite"/> \
        <signal name="StatusChanged"> \
            <arg type="u" direction="out"/> \
        </signal> \
    </interface> \
</node>';

const PresenceStatus = {
    AVAILABLE: 0,
    INVISIBLE: 1,
    BUSY: 2,
    IDLE: 3
};

var PresenceProxy = Gio.DBusProxy.makeProxyWrapper(PresenceIface);
function Presence(initCallback, cancellable) {
    return new PresenceProxy(Gio.DBus.session, 'org.gnome.SessionManager',
                             '/org/gnome/SessionManager/Presence', initCallback, cancellable);
}

const InhibitorIface = ' \
<node> \
    <interface name="org.gnome.SessionManager.Inhibitor"> \
        <property name="app_id" type="s" access="read" /> \
        <property name="client_id" type="s" access="read" /> \
        <property name="reason" type="s" access="read" /> \
        <property name="flags" type="u" access="read" /> \
        <property name="toplevel_xid" type="u" access="read" /> \
        <property name="cookie" type="u" access="read" /> \
    </interface> \
</node>';

var InhibitorProxy = Gio.DBusProxy.makeProxyWrapper(InhibitorIface);
function Inhibitor(objectPath, initCallback, cancellable) {
    return new InhibitorProxy(Gio.DBus.session, 'org.gnome.SessionManager', objectPath, initCallback, cancellable);
}

const SessionManagerIface = '\
<node> \
    <interface name="org.gnome.SessionManager"> \
        <method name="Logout"> \
            <arg type="u" direction="in" /> \
        </method> \
        <method name="Shutdown" /> \
        <method name="CanShutdown"> \
            <arg type="b" direction="out" /> \
        </method> \
    </interface> \
</node>';

var SessionManagerProxy = Gio.DBusProxy.makeProxyWrapper(SessionManagerIface);
function SessionManager(initCallback, cancellable) {
    return new SessionManagerProxy(Gio.DBus.session, 'org.gnome.SessionManager', '/org/gnome/SessionManager', initCallback, cancellable);
}