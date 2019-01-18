// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

// Copyright (C) 2011 Giovanni Campagna
// Copyright (C) 2013-2014 Jonas Kummerlin <rgcjonas@gmail.com>
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const GdkPixbuf = imports.gi.GdkPixbuf;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;

const Main = imports.ui.main;
const DBusMenu = imports.ui.dbusMenu;
const SignalManager = imports.misc.signalManager;
const CinnamonConfig = imports.misc.config;
const {each, map, filter, find, findIndex, tryFn, unref} = imports.misc.util;

const SNICategory = {
    APPLICATION: 'ApplicationStatus',
    COMMUNICATIONS: 'Communications',
    SYSTEM: 'SystemServices',
    HARDWARE: 'Hardware'
};

const SNIStatus = {
    PASSIVE: 'Passive',
    ACTIVE: 'Active',
    NEEDS_ATTENTION: 'NeedsAttention'
};

const LIFETIME_TIMESPAN = 5000; //5s
const GC_INTERVAL = 10000; //10s


// TODO: replace with org.freedesktop and /org/freedesktop when approved
const KDE_PREFIX = 'org.kde';
const AYATANA_PREFIX = 'org.ayatana';
const AYATANA_PATH_PREFIX = '/org/ayatana';

const WATCHER_BUS_NAME = KDE_PREFIX + '.StatusNotifierWatcher';
const WATCHER_INTERFACE = WATCHER_BUS_NAME;
const WATCHER_OBJECT = '/StatusNotifierWatcher';

const ITEM_OBJECT = '/StatusNotifierItem';

const StatusNotifierWatcherIface =
    '<node> \
        <interface name="org.kde.StatusNotifierWatcher"> \
            <method name="RegisterStatusNotifierItem"> \
                <arg type="s" direction="in" /> \
            </method> \
            <method name="RegisterNotificationHost"> \
                <arg type="s" direction="in" /> \
            </method> \
            <property name="RegisteredStatusNotifierItems" type="as" access="read" /> \
            <method name="ProtocolVersion"> \
                <arg type="s" direction="out" /> \
            </method> \
            <method name="IsNotificationHostRegistered"> \
                <arg type="b" direction="out" /> \
            </method> \
            <signal name="ServiceRegistered"> \
                <arg type="s" direction="out" /> \
            </signal> \
            <signal name="ServiceUnregistered"> \
                <arg type="s" direction="out" /> \
            </signal> \
           <property name="IsStatusNotifierHostRegistered" type="b" access="read" /> \
        </interface> \
    </node>';

/*
 * #IndicatorManager:
 * @short_description: Will get all newly added or changed indicators.
 *
 * The IndicatorManager class will get all newly added or changed indicators.
 * They will be shared in Cinnamon Main, so will be accessible for all clients.
 */

var IndicatorManager = class IndicatorManager {
    constructor() {
        this._enable = false;
        this._signalStatus = 0;
        this._signalSystray = 0;
        this.statusNotifierWatcher = null;
        this._indicators = [];
        this._blackList = [];
        this.setEnabled(global.settings.get_boolean("enable-indicators"));
        this._signalSettings = global.settings.connect('changed::enable-indicators',
                               Lang.bind(this, this._changedEnableIndicators));
    }

    _changedEnableIndicators() {
        this.setEnabled(global.settings.get_boolean("enable-indicators"));
    }

    _onSystrayManagerChanged(manager) {
        let rolesHandled = manager.getRoles();
        each(this._indicators, (indicator) => {
            this._conditionalEnable(indicator.id, rolesHandled);
        });
    }

    _onIndicatorDispatch(notifierWatcher, id) {
        if (this.statusNotifierWatcher != null) {
            let appIndicator = notifierWatcher.getItemById(id);
            let signalManager = new SignalManager.SignalManager();

            signalManager.connect(appIndicator, 'ready', this._onIndicatorReady, this);
            signalManager.connect(appIndicator, 'destroy', this._onIndicatorDestroy, this);
            signalManager.connect(appIndicator, 'status', this._onIndicatorChanged, this);
            signalManager.connect(appIndicator, 'label', this._onIndicatorChanged, this);
            signalManager.connect(appIndicator, 'reset', this._onIndicatorChanged, this);
            signalManager.connect(appIndicator, 'overlay-icon', this._onIndicatorChanged, this);
            signalManager.connect(appIndicator, 'icon', this._onIndicatorChanged, this);

            appIndicator.signalManager = signalManager;
            appIndicator.notifierId = id;

            if (appIndicator.isReady) {
                this._onIndicatorReady(appIndicator);
            }
        }
    }

    _onIndicatorReady(appIndicator) {
        this._indicators.push(appIndicator);
        let rolesHandled = Main.systrayManager.getRoles();
        if (this._conditionalEnable(appIndicator.id, rolesHandled, this._blackList)) {
            appIndicator._id = appIndicator.id;
            global.log("Adding indicator: " + appIndicator.id);
            this.emit('indicator-added', appIndicator);
        }
    }

    _onIndicatorDestroy(appIndicator) {
        let index = findIndex(this._indicators, function(indicator) {
            return indicator._id === appIndicator._id;
        });

        if (index > -1) {
            global.log(`Removing indicator: ${this._indicators[index]._id}`);
            this._indicators[index].signalManager.disconnectAllSignals();
            this._indicators[index] = null;
            this._indicators.splice(index, 1);
            this.emit('indicator-removed', appIndicator);
        }
    }

    _onIndicatorChanged(appIndicator, signal) {
        this.emit('indicator-changed', appIndicator);
    }

    _conditionalEnable(id, rolesHandled, blackList) {
        if (blackList && (blackList.indexOf(id) != -1)) {
            this._enableIndicatorId(id, false);
            global.log("Hiding indicator (blacklisted): " + id);
            return false;
        } else if (rolesHandled && (rolesHandled.indexOf(id) != -1)) {
            this._enableIndicatorId(id, false);
            global.log("Hiding indicator (role already handled): " + id);
            return false;
        }
        this._enableIndicatorId(id, true);
        return true;
    }

    _enableIndicatorId(id, enable) {
        let appIndicator = this.getIndicatorById(id);
        if (appIndicator) {
            appIndicator.setEnabled(enable);
        }
    }

    isInBlackList(id) {
        let hiddenIcons = Main.systrayManager.getRoles();
        if (hiddenIcons.indexOf(id) > -1 )
            return true;
        if (this._blackList.indexOf(id) > -1 )
            return true;
        return false;
    }

    insertInBlackList(id) {
        if (this._blackList.indexOf(id) === -1) {
            this._blackList.push(id);
            this._enableIndicatorId(id, false);
        }
    }

    removeFromBlackList(id) {
        let pos = this._blackList.indexOf(id);
        if (pos > -1) {
            this._blackList.splice(pos, 1);
            this._disableIndicatorId(id, true);
        }
    }

    getIndicatorIds() {
        return map(this._indicators, function(indicator) {
            return indicator.id;
        });
    }

    getIndicatorById(id) {
        return find(this._indicators, function(indicator) {
            return indicator.id === id;
        });
    }

    setEnabled(enable) {
        if (this._enable !== enable) {
            this._enable = enable;
            this._indicators = [];
            if (this._enable) {
                this.statusNotifierWatcher = new StatusNotifierWatcher();
                if (this._signalStatus == 0) {
                    this._signalStatus = this.statusNotifierWatcher.connect('indicator-dispatch',
                                         Lang.bind(this, this._onIndicatorDispatch));
                }
                if (this._signalSystray == 0) {
                    this._signalSystray = Main.systrayManager.connect('changed',
                                          Lang.bind(this, this._onSystrayManagerChanged));
                }
            } else {
                if (this._signalStatus != 0) {
                    this.statusNotifierWatcher.disconnect(this._signalStatus);
                    this._signalStatus = 0;
                }
                if (this._signalSystray != 0) {
                    Main.systrayManager.disconnect(this._signalSystray);
                    this._signalSystray = 0;
                }
                this.statusNotifierWatcher.destroy();
                this.statusNotifierWatcher = null;
            }
        }
    }

    destroy() {
        this.setEnabled(false);
        if (this._signalSettings != 0) {
            global.settings.disconnect(this._signalSettings);
            this._signalSettings = 0;
        }
        this.emit('indicator-destroy');
        unref(this);
    }
};
Signals.addSignalMethods(IndicatorManager.prototype);

/**
 * #AppIndicator:
 * @short_description: This is a generic container for indicator information and common functions.
 *
 * The AppIndicator class serves as a generic container for indicator information and functions common
 * for every displaying implementation (IndicatorMessageSource and IndicatorStatusIcon)
 */

var AppIndicator = class AppIndicator {

    constructor(busName, object, id) {
        this._id = id;
        this._busName = busName;
        this._object = object;
        this._proxy = null;
        this._isEnabled = true;
        this._initialize();
    }

    _initialize() {
        if ((!this._proxy) && (this._isEnabled)) {
            this._proxy = new XmlLessDBusProxy({
                connection: Gio.DBus.session,
                name: this._busName,
                path: this._object,
                interface: 'org.kde.StatusNotifierItem',
                propertyWhitelist: [ //keep sorted alphabetically, please
                    'AttentionIconName',
                    'AttentionIconPixmap',
                    'Category',
                    'IconName',
                    'IconPixmap',
                    'IconThemePath',
                    'Id',
                    'Menu',
                    'OverlayIconName',
                    'OverlayIconPixmap',
                    'Status',
                    'Title',
                    'ToolTip',
                    'XAyatanaLabel',
                    'XAyatanaLabelGuide',
                    'XAyatanaOrderingIndex',
                ],
                onReady: Lang.bind(this, function() {
                    this.isReady = true;
                    this.emit('ready');
                })
            });
            this._proxy.connect('-property-changed', Lang.bind(this, this._onPropertyChanged));
            this._proxy.connect('-signal', Lang.bind(this, this._translateNewSignals));
        }
    }

    _finalize() {
        if (this._proxy) {
            this._proxy.destroy();
            this._proxy = null;
            this.isReady = false;
            this.emit('finalized');
        }
    }

    // The Author of the spec didn't like the PropertiesChanged signal, so he invented his own
    _translateNewSignals(proxy, signal, params) {
        if (this._proxy) {
            if (signal.substr(0, 3) == 'New') {
                let prop = signal.substr(3);

                if (this._proxy.propertyWhitelist.indexOf(prop) > -1)
                    this._proxy.invalidateProperty(prop);

                if (this._proxy.propertyWhitelist.indexOf(prop + 'Pixmap') > -1)
                    this._proxy.invalidateProperty(prop + 'Pixmap');

                if (this._proxy.propertyWhitelist.indexOf(prop + 'Name') > -1)
                    this._proxy.invalidateProperty(prop + 'Name');
            // and the ayatana guys made sure to invent yet another way of composing these signals...
            } else if (signal == 'XAyatanaNewLabel') {
                this._proxy.invalidateProperty('XAyatanaLabel');
            } else if (signal == 'XAyatanaNewLabelGuide') {
                this._proxy.invalidateProperty('XAyatanaNewLabelGuide');
            } else if (signal == 'XAyatanaOrderingIndex') {
                this._proxy.invalidateProperty('XAyatanaNewOrderingIndex');
            }
        }
    }

    //public property getters
    get title() {
        if (!this._proxy) return null;
        return this._proxy.cachedProperties.Title;
    }

    get id() {
        if (!this._proxy) return null;
        return this._proxy.cachedProperties.Id;
    }

    get status() {
        if (!this._proxy) return null;
        return this._proxy.cachedProperties.Status;
    }

    get label() {
        if (!this._proxy || !this._proxy.cachedProperties.XAyatanaLabel) return null;
        return this._proxy.cachedProperties.XAyatanaLabel;
    }

    get labelGuide() {
        if (!this._proxy) return null;
        return this._proxy.cachedProperties.XAyatanaLabelGuide;
    }

    get toolTip() {
        if (!this._proxy) return null;
        return this._proxy.cachedProperties.ToolTip;
    }

    get orderingIndex() {
        if (!this._proxy) return null;
        return this._proxy.cachedProperties.XAyatanaOrderingIndex;
    }

    get attentionIcon() {
        if (!this._proxy) return null;
        return [
            this._proxy.cachedProperties.AttentionIconName,
            this._proxy.cachedProperties.AttentionIconPixmap,
            this._proxy.cachedProperties.IconThemePath
        ];
    }

    get icon() {
        if (!this._proxy) return null;
        return [
            this._proxy.cachedProperties.IconName,
            this._proxy.cachedProperties.IconPixmap,
            this._proxy.cachedProperties.IconThemePath
        ];
    }

    get overlayIcon() {
        if (!this._proxy) return null;
        return [
            this._proxy.cachedProperties.OverlayIconName,
            this._proxy.cachedProperties.OverlayIconPixmap,
            this._proxy.cachedProperties.IconThemePath
        ];
    }

    getNotifierId() {
        return this._busName + this._object;
    }

    isEnabled() {
        return this._isEnabled;
    }

    setEnabled(enable) {
        if (this._isEnabled != enable) {
            this._isEnabled = enable;
            if (this._isEnabled)
                this._initialize();
            else
                this._finalize();
        }
    }

    getActor(size, orientation) {
        return new IndicatorActor(this, size, orientation);
    }

    //async because we may need to check the presence of a menubar object as well as the creation is async.
    createMenuClientAsync(clb) {
        if (this._proxy) {
            let path = this._proxy.cachedProperties.Menu || "/MenuBar";
            this._validateMenu(this._busName, path, function(correctly, name, path) {
                if (correctly) {
                    // global.log("creating menu on "+[name, path]);
                    clb(new DBusMenu.DBusClient(name, path));
                } else {
                    clb(null);
                }
            });
        }
    }

    _validateMenu(bus, path, callback) {
        Gio.DBus.session.call(
            bus, path, "org.freedesktop.DBus.Properties", "Get",
            GLib.Variant.new("(ss)", ["com.canonical.dbusmenu", "Version"]),
            GLib.VariantType.new("(v)"), Gio.DBusCallFlags.NONE, -1, null, function(conn, result) {
                return tryFn(
                    function() {
                        let val = conn.call_finish(result);
                        let version = val.deep_unpack()[0].deep_unpack();

                        // FIXME: what do we implement?
                        if (version >= 2) {
                            return callback(true, bus, path);
                        } else {
                            global.logWarning(`Incompatible dbusmenu version: ${version}`);
                            return callback(false);
                        }
                    },
                    function(e) {
                        global.dump_gjs_stack(`Invalid menu: ${e.message}`);
                        return callback(false);
                    }
                );
            }
        );
    }

    _onPropertyChanged(proxy, property, newValue) {
        // some property changes require updates on our part,
        // a few need to be passed down to the displaying code

        // all these can mean that the icon has to be changed
        if (property == 'Status' || property.substr(0, 4) == 'Icon' || property.substr(0, 13) == 'AttentionIcon')
            this.emit('icon');

        // same for overlays
        if (property.substr(0, 11) == 'OverlayIcon')
            this.emit('overlay-icon');

        // this may make all of our icons invalid
        if (property == 'IconThemePath') {
            this.emit('icon');
            this.emit('overlay-icon');
        }

        // the label will be handled elsewhere
        if (property == 'XAyatanaLabel')
            this.emit('label');

        // status updates are important for the StatusNotifierDispatcher
        if (property == 'Status')
            this.emit('status');
    }

    // triggers a reload of all properties
    reset(triggerReady) {
        if (this._proxy) {
            this._proxy.invalidateAllProperties(Lang.bind(this, function() {
                this.emit('reset');
            }));
        }
    }

    destroy() {
        if (this._proxy) {
            this._proxy.destroy();
            this._proxy = null;
            this.isReady = false;
        }
        this.emit('destroy');
        unref(this);
    }

    open() {
        // FIXME: The original implementation don't use WindowID, because is not able to get
        // the x11 window id from a MetaWindow nor can we call any X11 functions, but is
        // possible on cinnamon. Luckily for Gnome Shell, the Activate method usually works fine.
        // parameters are "an hint to the item where to show eventual windows" [sic]
        // ... and don't seem to have any effect.
        if (this._proxy) {
            this._proxy.call({
                name: 'Activate',
                paramTypes: 'ii',
                paramValues: [0, 0]
                // we don't care about the result
            });
        }
    }

    secondaryActivate() {
        if (this._proxy) {
            this._proxy.call({
                name: 'SecondaryActivate',
                paramTypes: 'ii',
                paramValues: [0, 0]
            });
        }
    }

    scroll(dx, dy) {
        if (this._proxy) {
            if (dx != 0) {
                this._proxy.call({
                    name: 'Scroll',
                    paramTypes: 'is',
                    paramValues: [ Math.floor(dx), 'horizontal' ]
                });
            }
            if (dy != 0) {
                this._proxy.call({
                    name: 'Scroll',
                    paramTypes: 'is',
                    paramValues: [ Math.floor(dy), 'vertical' ]
                });
            }
        }
    }
};
Signals.addSignalMethods(AppIndicator.prototype);

/*
 * #StatusNotifierWatcher:
 * @short_description: The class implements the StatusNotifierWatcher dbus object.
 */

var StatusNotifierWatcher = class StatusNotifierWatcher {
    constructor() {
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(StatusNotifierWatcherIface, this);
        this._dbusImpl.export(Gio.DBus.session, WATCHER_OBJECT);
        this._everAcquiredName = false;
        this._ownName = Gio.DBus.session.own_name(WATCHER_BUS_NAME,
                                  Gio.BusNameOwnerFlags.NONE,
                                  Lang.bind(this, this._acquiredName),
                                  Lang.bind(this, this._lostName));
        this._items = [];
        this._nameWatchers = [];
    }

    _acquiredName() {
        this._everAcquiredName = true;
    }

    _lostName() {
        if (this._everAcquiredName) {
            global.log('Lost name' + WATCHER_BUS_NAME);
        } else {
            global.logWarning('Failed to acquire ' + WATCHER_BUS_NAME);
        }
    }

    // create a unique index for the _items dictionary
    _getItemId(busName, objPath) {
        return busName + objPath;
    }

    getItemById(id) {
        return find(this._items, function(item) {
            return item._id === id;
        });
    }

    RegisterStatusNotifierItemAsync(params, invocation) {
        // it would be too easy if all application behaved the same
        // instead, ayatana patched gnome apps to send a path
        // while kde apps send a bus name
        let service = params[0];
        let busName, objPath;
        if (service.charAt(0) == '/') { // looks like a path
            busName = invocation.get_sender();
            objPath = service;
        } else { // we hope it is a bus name
            busName = service;
            objPath = ITEM_OBJECT;
        }

        let id = this._getItemId(busName, objPath);
        let appIndicator = find(this._items, function(item) {
            return item._id === id;
        });

        if (appIndicator) {
            // Delete the old one and add the new indicator
            appIndicator.reset();
        } else {
            let appIndicator = new AppIndicator(busName, objPath, id);
            this._items.push(appIndicator);
            this._dbusImpl.emit_signal('ServiceRegistered', GLib.Variant.new('(s)', service));
            this._nameWatchers.push({
                id: appIndicator._id,
                obj: Gio.DBus.session.watch_name(
                    busName, Gio.BusNameWatcherFlags.NONE,
                    null,
                    () => this._remove(appIndicator._id)
                )
            });
            this.emit('indicator-dispatch', id);
            this._dbusImpl.emit_property_changed('RegisteredStatusNotifierItems',
                GLib.Variant.new('as', this.RegisteredStatusNotifierItems));
        }
        invocation.return_value(null);
    }

    _remove(id) {
        let index = findIndex(this._items, function(item) {
            return item._id === id;
        });
        if (index > -1) {
            id = this._items[index].getNotifierId();
            this._items[index].destroy();
            this._items[index] = null;
            this._items.splice(index, 1);
        }

        index = findIndex(this._nameWatchers, function(item) {
            return item.id === id;
        });
        if (index > -1) {
            Gio.DBus.session.unwatch_name(this._nameWatchers[index].obj);
            this._nameWatchers[index] = null;
            this._nameWatchers.splice(index, 1);
        }

        this._dbusImpl.emit_signal('ServiceUnregistered', GLib.Variant.new('(s)', id));
        this._dbusImpl.emit_property_changed('RegisteredStatusNotifierItems',
                         GLib.Variant.new('as', this.RegisteredStatusNotifierItems));
    }

    RegisterNotificationHost(service) {
        throw new Gio.DBusError('org.gnome.Shell.UnsupportedMethod',
                        'Registering additional notification hosts is not supported');
    }

    IsNotificationHostRegistered() {
        return true;
    }

    ProtocolVersion() {
        // "The version of the protocol the StatusNotifierWatcher instance implements." [sic]
        // in what syntax?
        let message = "%s/%s (KDE; compatible; mostly) Cinnamon/%s";
        return message.format("systray-indicator@cinnamon.org", "0.1", CinnamonConfig.PACKAGE_VERSION);
    }

    get RegisteredStatusNotifierItems() {
        return map(this._items, function(item) {
            return item._id;
        });
    }

    get IsStatusNotifierHostRegistered() {
        return true;
    }

    destroy() {
        if (this._isDestroyed) return;

        // this doesn't do any sync operation and doesn't allow us to hook up the event of being finished
        // which results in our unholy debounce hack (see extension.js)
        Gio.DBus.session.unown_name(this._ownName);
        this._dbusImpl.unexport();

        each(this._nameWatchers, function(item) {
            Gio.DBus.session.unwatch_name(item.obj);
        });

        each(this._items, function(item) {
            item.destroy();
        });

        this._isDestroyed = true;
        unref(this, ['_isDestroyed']);
    }
};
Signals.addSignalMethods(StatusNotifierWatcher.prototype);

/**
 * #XmlLessDBusProxy:
 * @short_description: This is a proxy for org.freedesktop.DBus.Properties and org.kde.StatusNotifierItem.
 *
 * This proxy works completely without an interface xml, making it both flexible
 * and mistake-prone. It will cache properties and emit events, and provides
 * shortcuts for calling methods.
 */

var XmlLessDBusProxy = class XmlLessDBusProxy {
    constructor(params) {
        if (!params.connection || !params.name || !params.path || !params.interface)
            throw new Error("XmlLessDBusProxy: please provide connection, name, path and interface");

        this.connection = params.connection;
        this.name = params.name;
        this.path = params.path;
        this.interface = params.interface;
        this.propertyWhitelist = params.propertyWhitelist || [];
        this.cachedProperties = {};

        this.invalidateAllProperties(params.onReady);
        this._signalId = this.connection.signal_subscribe(
            this.name,
            this.interface,
            null,
            this.path,
            null,
            Gio.DBusSignalFlags.NONE,
            this._onSignal.bind(this)
        );
        this._propChangedId = this.connection.signal_subscribe(
            this.name,
            'org.freedesktop.DBus.Properties',
            'PropertiesChanged',
            this.path,
            null,
            Gio.DBusSignalFlags.NONE,
            this._onPropertyChanged.bind(this)
        );
    }

    setProperty(propertyName, valueVariant) {
        //TODO: implement
    }

    // Initiates recaching the given property.
    //
    // This is useful if the interface notifies the consumer of changed properties
    // in unorthodox ways or if you changed the whitelist
    invalidateProperty(propertyName, callback) {
        this.connection.call(
            this.name,
            this.path,
            'org.freedesktop.DBus.Properties',
            'Get',
            GLib.Variant.new('(ss)', [ this.interface, propertyName ]),
            GLib.VariantType.new('(v)'),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            Lang.bind(this, this._getPropertyCallback, propertyName, callback)
        );
    }

    _getPropertyCallback(conn, result, propertyName, callback) {
        if (this.propertyWhitelist.indexOf(propertyName) === -1) return;

        tryFn(() => {
            let newValue = conn.call_finish(result).deep_unpack()[0].deep_unpack();
            this.cachedProperties[propertyName] = newValue;
            this.emit('-property-changed', propertyName, newValue);
            this.emit('-property-changed::' + propertyName, newValue);
        });

        if (callback) callback();
    }

    invalidateAllProperties(callback) {
        let waitFor = 0;

        each(this.propertyWhitelist, (prop) => {
            waitFor += 1;
            this.invalidateProperty(prop, maybeFinished);
        });

        function maybeFinished() {
            waitFor -= 1;
            if (waitFor == 0 && callback)
                callback();
        }
    }

    _onPropertyChanged(conn, sender, path, iface, signal, params) {
        let [ , changed, invalidated ] = params.deep_unpack();

        for (let key in changed) {
            if (this.propertyWhitelist.indexOf(key) > -1) {
                this.cachedProperties[key] = changed[key].deep_unpack();
                this.emit('-property-changed', key, this.cachedProperties[key]);
                this.emit('-property-changed::' + key, this.cachedProperties[key]);
            }
        }

        for (let i = 0; i < invalidated.length; ++i) {
            if (this.propertyWhitelist.indexOf(invalidated[i]) > -1)
                this.invalidateProperty(invalidated[i]);
        }
    }

    _onSignal(conn, sender, path, iface, signal, params) {
        this.emit("-signal", signal, params);
        this.emit(signal, params.deep_unpack());
    }

    call(params) {
        if (!params)
            throw new Error("XmlLessDBusProxy::call: need params argument");

        if (!params.name)
            throw new Error("XmlLessDBusProxy::call: missing name");

        if (params.params instanceof GLib.Variant) {
            // good!
        } else if (params.paramTypes && params.paramValues) {
            params.params = GLib.Variant.new('(' + params.paramTypes + ')', params.paramValues);
        } else {
            throw new Error("XmlLessDBusProxy::call: provide either paramType (string) and \
                             paramValues (array) or params (GLib.Variant)");
        }

        if (!params.returnTypes)
            params.returnTypes = '';

        if (!params.onSuccess)
            params.onSuccess = function() {};

        if (!params.onError)
            params.onError = function(error) {
                global.logWarning("XmlLessDBusProxy::call: DBus error: "+error);
            };

        this.connection.call(
            this.name,
            this.path,
            this.interface,
            params.name,
            params.params,
            GLib.VariantType.new('(' + params.returnTypes + ')'),
            Gio.DBusCallFlags.NONE,
            -1,
            null,
            function(conn, result) {
                try {
                    let returnVariant = conn.call_finish(result);
                    params.onSuccess(returnVariant.deep_unpack());
                } catch (e) {
                    params.onError(e);
                }
            }
        );

    }

    destroy() {
        this.connection.signal_unsubscribe(this._signalId);
        this.connection.signal_unsubscribe(this._propChangedId);
        this.emit('-destroy');
        unref(this.cachedProperties);
        unref(this);
    }
};
Signals.addSignalMethods(XmlLessDBusProxy.prototype);

/**
 * #IndicatorActor:
 * @short_description: This is a container for the indicator icon with some advaced features.
 */

var IndicatorActor = class IndicatorActor {
    constructor(indicator, size, orientation) {
        this.actor = new St.BoxLayout({
            style_class: 'system-status-icon',
            reactive: true,
            track_hover: true,
            // The systray use a layout manager, we need to fill the space of the actor
            // or otherwise the menu will be displayed inside the panel.
            x_expand: true,
            y_expand: true
        });

        this.actor._delegate = this;
        if (orientation == St.Side.LEFT || orientation == St.Side.RIGHT) {
            this.actor.set_x_align(Clutter.ActorAlign.FILL);
            this.actor.set_y_align(Clutter.ActorAlign.END);
            this.actor.set_vertical(true);
        }
        this.menu = null;
        this._menuSignal = 0;
        // FIXME: This could be in settings:
        this._showInPassiveMode = false;
        // FIXME: This could be in settings (left, right, both):
        this.openMenuOnRightClick = false;

        this._indicator = indicator;
        this._iconSize = size;
        this._iconCache = new IconCache();
        this._mainIcon = new St.Bin();
        this._overlayIcon = new St.Bin();
        this._label = new St.Label({'y-align': St.Align.END }); // FIXME: We need a style class for the label.

        this.actor.add_actor(this._mainIcon);
        this.actor.add_actor(this._overlayIcon);
        this.actor.add_actor(this._label);

        this._updatedLabel();
        this._updatedStatus();

        this._signalManager = new SignalManager.SignalManager();
        this._signalManager.connect(this.actor, 'scroll-event', this._handleScrollEvent, this);
        this._signalManager.connect(Gtk.IconTheme.get_default(), 'changed', this._invalidateIcon, this);
        this._signalManager.connect(this._indicator, 'icon', this._updateIcon, this);
        this._signalManager.connect(this._indicator, 'overlay-icon', this._updateOverlayIcon, this);
        this._signalManager.connect(this._indicator, 'ready', this._invalidateIcon, this);
        this._signalManager.connect(this._indicator, 'status', this._updatedStatus, this);
        this._signalManager.connect(this._indicator, 'finalized', this.destroy, this);
        this._signalManager.connect(this._indicator, 'destroy', this.destroy, this);

        if (indicator.isReady)
            this._invalidateIcon();
    }

    setShowInPassiveMode(show) {
        this._showInPassiveMode = show;
        this._updatedStatus();
    }

    setMenu(menu) {
        if (this._menuSignal > 0) {
            this.actor.disconnect(this._menuSignal);
            this._menuSignal = 0;
        }
        if (menu) {
            this._menuSignal = this.actor.connect('button-press-event', Lang.bind(this, this._onIconButtonPressEvent));
            this.menu = menu;
        }
    }

    setSize(size) {
        if (this._iconSize != size) {
            this._iconSize = size;
            this._invalidateIcon();
        }
    }

    // FIXME: The Tooltips are an object and render in html format. To show the real tooltips
    // (this._indicator.toolTip), we will need a good html parser.
    // In the tooltips implementation, maybe imports.gi.WebKit and use Webkit.WebView and then loadData.
    // So instead we will used the title as a tooltip.
    getToolTip() {
        return this._indicator.title;
    }

    _updatedLabel() {
        if (this._indicator.label != null) {
            this._label.set_text(this._indicator.label);
            this._label.show();
        } else {
            this._label.set_text("");
            this._label.hide(); // blanking out a label is not enough, its presence may trigger
                                // unwanted 'spacing' CSS.
        }
    }

    // FIXME: When an indicator is in passive state, the recommended behavior is hide his actor,
    // but this involve for example, to never display the update notifier on ubuntu.
    _updatedStatus() {
        if (this._indicator.status === SNIStatus.PASSIVE) {
            this.actor.visible = this._showInPassiveMode;
        } else if (this._indicator.status === SNIStatus.ACTIVE || this._indicator.status === SNIStatus.NEEDS_ATTENTION) {
            this.actor.visible = true;
        }

        if (this.menu && !this.actor.visible) this.menu.close(false);
    }

    // Will look the icon up in the cache, if it's found
    // it will return it. Otherwise, it will create it and cache it.
    // We also check the creation time of the icon, if there are a new time
    // for an icon with the same id, we remove the old icon from the cache and
    // then we set the new icon as our current one.
    // The .inUse flag will be set to true. So when you don't need
    // the returned icon anymore, make sure to check the .inUse property
    // and set it to false if needed so that it can be picked up by the garbage
    // collector.
    _cacheOrCreateIconByName(iconName, themePath, iconSize) {
        let id = iconName + '@' + (themePath ? '##' + themePath : '');
        if (iconSize)
            id += iconSize;
        let icon = null;
        let [path, realSize] = this._getIconInfo(iconName, themePath, iconSize);
        if (path) {
            let time = this._getIconTvTime(path);
            let oldIcon = this._iconCache.get(id);
            if (!oldIcon || (oldIcon.time < time)) {
                this._iconCache.remove(id);
                icon = this._createIconByName(path, iconSize);
                icon.time = time;
                this._iconCache.add(id, icon);
            } else if (oldIcon) {
                icon = oldIcon;
            }
            if (icon) {
                icon.inUse = true;
            }
        }
        return icon;
    }

    _onIconButtonPressEvent(actor, event) {
        let draggableParent = this._getDragable();
        if (draggableParent && !draggableParent.inhibit) return false;

        let button = event.get_button();

        if (this.openMenuOnRightClick) {
            if ((event.get_button() == 3) && this.menu) {
                this.menu.toggle();
                return true;
            } else if (button === 1) {
                this.menu.close();
                this._indicator.open();
            } else if (button === 2) {
                this._indicator.secondaryActivate();
            }
        } else if (button === 1 && this.menu) {
            this.menu.toggle();
        } else if (button=== 2 && this.menu) {
            this._indicator.secondaryActivate();
        }
        return false;
    }

    // TODO: Why is this draggable?
    // FIXME: We can move this outside the applet, or otherwise, the user of the api
    // needs to provide an actor._delegate Object for the draggable parent actor.
    _getDragable() {
        let actorDraggable = this.actor.get_parent();
        while (actorDraggable) {
            if (actorDraggable._delegate && actorDraggable._delegate._draggable)
                return actorDraggable._delegate._draggable;
            actorDraggable = actorDraggable.get_parent();
        }
        return null;
    }

    _getIconTvTime(path) {
        try {
            let file = Gio.file_new_for_path(path);
            let fileInfo = file.query_info(Gio.FILE_ATTRIBUTE_TIME_MODIFIED, Gio.FileQueryInfoFlags.NONE, null);
            if (fileInfo) {
                return fileInfo.get_attribute_uint64(Gio.FILE_ATTRIBUTE_TIME_MODIFIED);
            }
        } catch (e) {}
        return -1;
    }

    _getIconInfo(name, themePath, size) {
        // assume as a default size 16px if not set.
        if (!size) size = 16;
        // realSize will contain the actual icon size in contrast to the requested icon size.
        let realSize = size;
        let path = null;
        if (name && name[0] == "/") {
            //HACK: icon is a path name. This is not specified by the api but at least inidcator-sensors uses it.
            let [ format, width, height ] = GdkPixbuf.Pixbuf.get_file_info(name);
            if (!format) {
                global.logError("invalid image format: "+name);
            } else {
                // if the actual icon size is smaller, save that for later.
                // scaled icons look ugly.
                if (Math.max(width, height) < size)
                    realSize = Math.max(width, height);
                path = name;
            }
        } else if (name) {
            // we manually look up the icon instead of letting st.icon do it for us
            // this allows us to sneak in an indicator provided search path and to avoid ugly upscaled icons

            // indicator-application looks up a special "panel" variant, we just replicate that here
            name = name + "-panel";

            // icon info as returned by the lookup
            let iconInfo = null;

            // we try to avoid messing with the default icon theme, so we'll create a new one if needed
            let icon_theme = null;
            if (themePath) {
                icon_theme = new Gtk.IconTheme();
                each(Gtk.IconTheme.get_default().get_search_path(), function(path) {
                    icon_theme.append_search_path(path);
                });
                icon_theme.append_search_path(themePath);
                icon_theme.set_screen(imports.gi.Gdk.Screen.get_default());
            } else {
                icon_theme = Gtk.IconTheme.get_default();
            }
            if (icon_theme) {
                // try to look up the icon in the icon theme
                iconInfo = icon_theme.lookup_icon(name, size,
                                                  Gtk.IconLookupFlags.GENERIC_FALLBACK);
                // no icon? that's bad!
                if (iconInfo == null) {
                    global.logError(`[IndicatorActor] Unable to lookup icon for ${name}`);
                } else { // we have an icon
                    // the icon size may not match the requested size, especially with custom themes
                    if (iconInfo.get_base_size() < size) {
                        // stretched icons look very ugly, we avoid that and just show the smaller icon
                        realSize = iconInfo.get_base_size();
                    }
                    // get the icon path
                    path = iconInfo.get_filename();
                }
            }
        }
        return [path, realSize];
    }

    _createIconByName(path, iconSize) {
        try {
            let pixbuf = GdkPixbuf.Pixbuf.new_from_file(path);
            let icon = new St.Icon({
                name: 'CinnamonTrayIcon',
                style_class: 'system-status-icon',
                gicon: pixbuf,
            });
            if (iconSize)
                icon.set_icon_size(iconSize);
            // Connect this always, because the user can enable/disable the panel scale mode
            // when he want, otherwise we need to control the scale mode internally.
            icon.connect('notify::mapped', Lang.bind(this, this._onIconMapped));
            return icon;
        } catch (e) {
            // the image data was probably bogus. We don't really know why, but it _does_ happen.
            // we could log it here, but that doesn't really help in tracking it down.
        }
        return null;
    }

    _createIconFromPixmap(iconPixmapArray, iconSize) {
        // the pixmap actually is an array of pixmaps with different sizes
        // we use the one that is smaller or equal the iconSize

        // maybe it's empty? that's bad.
        if (!iconPixmapArray || iconPixmapArray.length < 1) return null;

        let sortedIconPixmapArray = iconPixmapArray.sort(function(pixmapA, pixmapB) {
            // we sort biggest to smallest
            let areaA = pixmapA[0] * pixmapA[1];
            let areaB = pixmapB[0] * pixmapB[1];

            return areaB - areaA;
        });

        let qualifiedIconPixmapArray = filter(sortedIconPixmapArray, function(pixmap) {
            // we disqualify any pixmap that is bigger than our requested size
            return pixmap[0] <= iconSize && pixmap[1] <= iconSize;
        });

        // if no one got qualified, we use the smallest one available
        let iconPixmap = qualifiedIconPixmapArray.length > 0 ? qualifiedIconPixmapArray[0] : sortedIconPixmapArray.pop();

        let [ width, height, bytes ] = iconPixmap;
        let rowstride = width * 4;

        try {
            let image = new Clutter.Image();
            image.set_bytes(
                bytes,
                Cogl.PixelFormat.ARGB_8888,
                width,
                height,
                rowstride
            );

            return new St.Icon({
                width: Math.min(width, iconSize),
                height: Math.min(height, iconSize),
                content: image,
                scale_x: global.ui_scale,
                scale_y: global.ui_scale,
                pivot_point: new Clutter.Point({ x: .5, y: .5 })
            });
        } catch (e) {
            global.logWarning(`[IndicatorManager] Failed to create indicator icon\n${e.message}`);
            return null;
        }
    }

    _onIconMapped(actor, event) {
        if (!this._iconSize) {
            let themeNode = actor.get_theme_node();
            let [found, size] = themeNode.lookup_length('icon-size', false);
            if (!found)
                actor.set_icon_size(16);
        }
    }

    // updates the base icon
    _updateIcon() {
        // remove old icon
        if (this._mainIcon.get_child()) {
            let child = this._mainIcon.get_child();

            if (child.inUse)
                child.inUse = false;
            else if (child.destroy)
                child.destroy();

            this._mainIcon.set_child(null);
        }

        // place to save the new icon
        let newIcon = null;

        // we might need to use the AttentionIcon*, which have precedence over the normal icons
        if (this._indicator.status == SNIStatus.NEEDS_ATTENTION) {
            let [ name, pixmap, theme ] = this._indicator.attentionIcon;

            if (name && name.length)
                newIcon = this._cacheOrCreateIconByName(name, theme, this._iconSize);

            if (!newIcon && pixmap)
                newIcon = this._createIconFromPixmap(pixmap, this._iconSize);
        }

        if (!newIcon) {
            let [ name, pixmap, theme ] = this._indicator.icon;

            if (name && name.length)
                newIcon = this._cacheOrCreateIconByName(name, theme, this._iconSize);

            if (!newIcon && pixmap)
                newIcon = this._createIconFromPixmap(pixmap, this._iconSize);
        }

        this._mainIcon.set_child(newIcon);
    }

    _updateOverlayIcon() {
        // remove old icon
        if (this._overlayIcon.get_child()) {
            let child = this._overlayIcon.get_child();

            if (child.inUse)
                child.inUse = false;
            else if (child.destroy)
                child.destroy();

            this._overlayIcon.set_child(null);
        }

        // KDE hardcodes the overlay icon size to 10px (normal icon size 16px)
        // we approximate that ratio for other sizes, too.
        // our algorithms will always pick a smaller one instead of stretching it.
        let iconSize = 10;
        if (this._iconSize)
            iconSize = Math.floor(this._iconSize / 1.6);

        let newIcon = null;

        // create new
        let [ name, pixmap, theme ] = this._indicator.overlayIcon;

        if (name && name.length)
            newIcon = this._cacheOrCreateIconByName(name, theme, iconSize);

        if (!newIcon && pixmap)
            newIcon = this._createIconFromPixmap(pixmap, iconSize);

        this._overlayIcon.set_child(newIcon);
    }

    _handleScrollEvent(actor, event) {
        if (actor != this)
            return Clutter.EVENT_PROPAGATE;

        if (event.get_source() != this)
            return Clutter.EVENT_PROPAGATE;

        if (event.type() != Clutter.EventType.SCROLL)
            return Clutter.EVENT_PROPAGATE;

        // Since Clutter 1.10, clutter will always send a smooth scrolling event
        // with explicit deltas, no matter what input device is used
        // In fact, for every scroll there will be a smooth and non-smooth scroll
        // event, and we can choose which one we interpret.
        if (event.get_scroll_direction() == Clutter.ScrollDirection.SMOOTH) {
            let [ dx, dy ] = event.get_scroll_delta();

            this._indicator.scroll(dx, dy);
        }

        return Clutter.EVENT_STOP;
    }

    // called when the icon theme changes
    _invalidateIcon() {
        if (this._iconCache)
            this._iconCache.clear();

        this._updateIcon();
        this._updateOverlayIcon();
    }

    destroy() {
        this._signalManager.disconnectAllSignals();
        if (this._menuSignal > 0)
            this.actor.disconnect(this._menuSignal);
        if (this.menu) {
            this.menu.close(false);
            this.menu.destroy();
        }
        this.menu = null;

        this._iconCache.destroy();
        this.actor.destroy();
        unref(this);
    }
};

/**
 * #IconCache:
 * @short_description: The class caches icon objects in case they're reused shortly aftwerwards.
 *
 * The icon cache caches icon objects in case they're reused shortly aftwerwards.
 * This is necessary for some indicators like skype which rapidly switch between serveral icons.
 * Without caching, the garbage collection would never be able to handle the amount of new icon data.
 * If the lifetime of an icon is over, the cache will destroy the icon. (!)
 * The presence of an inUse property set to true on the icon will extend the lifetime.
 *
 * how to use: see IconCache.add, IconCache.get
 */

var IconCache = class IconCache {
    constructor() {
        this._cache = {};
        this._lifetime = {}; //we don't want to attach lifetime to the object
        this._gc();
    }

    add(id, o) {
        // global.log("IconCache: adding "+id);
        if (!(o && id)) return null;
        if (id in this._cache && this._cache[id] !== o)
            this.remove(id);
        this._cache[id] = o;
        this._lifetime[id] = new Date().getTime() + LIFETIME_TIMESPAN;
        return o;
    }

    remove(id) {
        if (id in this._cache) {
            // global.log('IconCache: removing '+id);
            if ('destroy' in this._cache[id]) this._cache[id].destroy();
            delete this._cache[id];
            delete this._lifetime[id];
        }
    }

    // removes everything from the cache
    clear() {
        for (let id in this._cache)
            this.remove(id);
    }

    // returns an object from the cache, or null if it can't be found.
    get(id) {
        if (id in this._cache) {
            // global.log('IconCache: retrieving '+id);
            this._lifetime[id] = new Date().getTime() + LIFETIME_TIMESPAN; //renew lifetime
            return this._cache[id];
        }
        else return null;
    }

    _gc() {
        let time = new Date().getTime();
        for (let id in this._cache) {
            if (this._cache[id].inUse) {
                continue;
            } else if (this._lifetime[id] < time) {
                this.remove(id);
            } else {
                //global.log("IconCache: " + id + " survived this round.");
            }
        }
        if (!this._stopGc) Mainloop.timeout_add(GC_INTERVAL, Lang.bind(this, this._gc));
        return false; //we just added our timeout again.
    }

    destroy() {
        this._stopGc = true;
        this.clear();
    }
};

