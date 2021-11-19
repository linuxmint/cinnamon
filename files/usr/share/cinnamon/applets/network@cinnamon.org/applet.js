const Applet = imports.ui.applet;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Lang = imports.lang;
const NM = imports.gi.NM;
const Signals = imports.signals;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;
const ModemManager = imports.misc.modemManager;
const Util = imports.misc.util;
const Settings = imports.ui.settings;

const DEFAULT_PERIODIC_UPDATE_FREQUENCY_SECONDS = 10;
const FAST_PERIODIC_UPDATE_FREQUENCY_SECONDS = 2;

const NMConnectionCategory = {
    INVALID: 'invalid',
    WIRED: 'wired',
    WIRELESS: 'wireless',
    WWAN: 'wwan',
    VPN: 'vpn'
};

const NMAccessPointSecurity = {
    UNKNOWN: 0,
    NONE: 1,
    WEP: 2,
    WPA_PSK: 3,
    WPA2_PSK: 4,
    WPA_ENT: 5,
    WPA2_ENT: 6
};

// small optimization, to avoid using [] all the time
const NM80211Mode = NM['80211Mode'];
const NM80211ApFlags = NM['80211ApFlags'];
const NM80211ApSecurityFlags = NM['80211ApSecurityFlags'];

// number of wireless networks that should be visible
// (the remaining are placed into More...)
const NUM_VISIBLE_NETWORKS = 5;

var NMIface = '\
<node> \
  <interface name="org.freedesktop.NetworkManager"> \
    <method name="CheckConnectivity"> \
      <arg type="u" name="connectivity" direction="out"/> \
    </method> \
  </interface> \
</node>';

var NMProxy = Gio.DBusProxy.makeProxyWrapper(NMIface);
function NMDBus(initCallback, cancellable) {
    return new NMProxy(Gio.DBus.system,
                       'org.freedesktop.NetworkManager',
                       '/org/freedesktop/NetworkManager',
                       initCallback, cancellable);
}

// shared between NMNetworkMenuItem and NMDeviceWWAN
function signalToIcon(value) {
    if (value > 80)
        return 'excellent';
    if (value > 55)
        return 'good';
    if (value > 30)
        return 'ok';
    if (value > 5)
        return 'weak';
    return 'none';
}

// shared between NMNetworkMenuItem and NMDeviceWireless
function sortAccessPoints(accessPoints) {
    return accessPoints.sort(function (one, two) {
        return two.strength - one.strength;
    });
}

function ssidToLabel(ssid) {
    let label = NM.utils_ssid_to_utf8(ssid.get_data());
    if (!label)
        label = _("<unknown>");
    return label;
}

function NMNetworkMenuItem() {
    this._init.apply(this, arguments);
}

function default_to_private_connections(client) {
    let perms = client.get_permission_result (NM.ClientPermission.SETTINGS_MODIFY_SYSTEM);
    return (perms != NM.ClientPermissionResult.YES);
}

NMNetworkMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(accessPoints, title, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        accessPoints = sortAccessPoints(accessPoints);
        this.bestAP = accessPoints[0];

        if (!title) {
            let ssid = this.bestAP.get_ssid();
            title = ssidToLabel(ssid);
        }

        this._label = new St.Label({ text: title });
        this.addActor(this._label);
        let strStrengh = String(this.bestAP.strength);
        strStrengh = strStrengh + '%';
        this._labelStrength = new St.Label({ text: strStrengh });
        this.addActor(this._labelStrength, { align: St.Align.END });
        this._icons = new St.BoxLayout({ style_class: 'nm-menu-item-icons' });
        this.addActor(this._icons, { align: St.Align.END });

        this._signalIcon = new St.Icon({ icon_name: this._getIcon(),
                                         style_class: 'popup-menu-icon' });
        this._icons.add_actor(this._signalIcon);

        this._accessPoints = [ ];
        for (let i = 0; i < accessPoints.length; i++) {
            let ap = accessPoints[i];
            // need a wrapper object here, because the access points can be shared
            // between many NMNetworkMenuItems
            let apObj = {
                ap: ap,
                updateId: ap.connect('notify::strength', Lang.bind(this, this._updated))
            };
            this._accessPoints.push(apObj);
        }
    },

    _updated: function(ap) {
        if (ap.strength > this.bestAP.strength)
            this.bestAP = ap;

        this._signalIcon.icon_name = this._getIcon();
        let strStrengh = String(this.bestAP.strength);
        strStrengh = strStrengh + '%';
        this._labelStrength.set_text(strStrengh);
    },

    _getIcon: function() {
        if (this.bestAP.mode == NM80211Mode.ADHOC)
            return 'network-workgroup';
        else if (this.bestAP._secType != NMAccessPointSecurity.UNKNOWN &&
            this.bestAP._secType != NMAccessPointSecurity.NONE)
            return 'network-wireless-signal-' + signalToIcon(this.bestAP.strength) + '-secure';
        else
            return 'network-wireless-signal-' + signalToIcon(this.bestAP.strength);
    },

    updateAccessPoints: function(accessPoints) {
        for (let i = 0; i < this._accessPoints.length; i++) {
            let apObj = this._accessPoints[i];
            apObj.ap.disconnect(apObj.updateId);
            apObj.updateId = 0;
        }

        accessPoints = sortAccessPoints(accessPoints);
        this.bestAP = accessPoints[0];
        this._accessPoints = [ ];
        for (let i = 0; i < accessPoints; i++) {
            let ap = accessPoints[i];
            let apObj = {
                ap: ap,
                updateId: ap.connect('notify::strength', Lang.bind(this, this._updated))
            };
            this._accessPoints.push(apObj);
        }
    },

    destroy: function() {
        for (let i = 0; i < this._accessPoints.length; i++) {
            let apObj = this._accessPoints[i];
            apObj.ap.disconnect(apObj.updateId);
            apObj.updateId = 0;
        }

        PopupMenu.PopupBaseMenuItem.prototype.destroy.call(this);
    }
};

function NMWiredSectionTitleMenuItem() {
    this._init.apply(this, arguments);
}

NMWiredSectionTitleMenuItem.prototype = {
    __proto__: PopupMenu.PopupSwitchMenuItem.prototype,

    _init: function(label, params) {
        params = params || { };
        params.style_class = 'popup-subtitle-menu-item';
        PopupMenu.PopupSwitchMenuItem.prototype._init.call(this, label, false, params);
    },

    updateForDevice: function(device) {
        if (device) {
            this._device = device;
            this.setStatus(device.statusLabel);
            this.setToggleState(device.connected);
            // if this device is not controllable, hide the switch
            this._switch.actor.visible = device.controllable;
        } else {
            this.setStatus('');
            this._switch.actor.visible = false;
        }
    },

    activate: function(event) {
        PopupMenu.PopupSwitchMenuItem.prototype.activate.call(this, event);

        if (!this._device) {
            log('Section title activated when there is more than one device, should be non reactive');
            return;
        }

        let newState = this._switch.state;

        // Immediately reset the switch to false, it will be updated appropriately
        // by state-changed signals in devices (but fixes the VPN not being in sync
        // if the ActiveConnection object is never seen by libnm-glib)
        this._switch.setToggleState(false);

        if (newState)
            this._device.activate();
        else
            this._device.deactivate();
    }
};

function NMWirelessSectionTitleMenuItem() {
    this._init.apply(this, arguments);
}

NMWirelessSectionTitleMenuItem.prototype = {
    __proto__: PopupMenu.PopupSwitchMenuItem.prototype,

    _init: function(client, property, title, params) {
        params = params || { };
        params.style_class = 'popup-subtitle-menu-item';
        PopupMenu.PopupSwitchMenuItem.prototype._init.call(this, title, false, params);

        this._client = client;
        this._property = property + '_enabled';
        this._propertyHardware = property + '_hardware_enabled';
        this._setEnabledFunc = property + '_set_enabled';

        this._client.connect('notify::' + property + '-enabled', Lang.bind(this, this._propertyChanged));
        this._client.connect('notify::' + property + '-hardware-enabled', Lang.bind(this, this._propertyChanged));

        this._propertyChanged();
    },

    updateForDevice: function(device) {
		this._device = device;
        // we show the switch
        // - if there not just one device
        // - if the switch is off
        // - if the device is activated or disconnected
        if (device && this._softwareEnabled && this._hardwareEnabled) {
            this.setStatus(device.statusLabel);
            this._switch.actor.visible = device.controllable;
        } else {
            this.setStatus(null);
            this._switch.actor.show();
        }
    },

    activate: function(event) {
        PopupMenu.PopupSwitchMenuItem.prototype.activate.call(this, event);

        this._client[this._setEnabledFunc](this._switch.state);

        if (!this._device) {
            log('Section title activated when there is more than one device, should be non reactive');
            return;
        }

        let newState = this._switch.state;

        if (newState)
            this._device.activate();
        else
            this._device.deactivate();

        this.emit('enabled-changed', this._switch.state);
    },

    _propertyChanged: function() {
        this._softwareEnabled = this._client[this._property];
        this._hardwareEnabled = this._client[this._propertyHardware];

        let enabled = this._softwareEnabled && this._hardwareEnabled;
        this.setToggleState(enabled);
        if (!this._hardwareEnabled)
            /* Translators: this indicates that wireless or wwan is disabled by hardware killswitch */
            this.setStatus(_("disabled"));

        this.emit('enabled-changed', enabled);
    }
};

function NMDevice() {
    throw new TypeError('Instantanting abstract class NMDevice');
}

NMDevice.prototype = {
    _init: function(client, device, connections) {
        this.device = device;
        if (device) {
            this.device._delegate = this;
            this._stateChangedId = this.device.connect('state-changed', Lang.bind(this, this._deviceStateChanged));
        } else
            this._stateChangedId = 0;

        // protected
        this._client = client;
        this._connections = [ ];
        for (let i = 0; i < connections.length; i++) {
            if (!connections[i]._uuid)
                continue;
            if (!this.connectionValid(connections[i]))
                continue;
            // record the connection
            let obj = {
                connection: connections[i],
                name: connections[i]._name,
                uuid: connections[i]._uuid,
                timestamp: connections[i]._timestamp,
            };
            this._connections.push(obj);
        }
        this._connections.sort(this._connectionSortFunction);
        this._activeConnection = null;
        this._activeConnectionItem = null;
        this._autoConnectionItem = null;
        this._overflowItem = null;

        this._carrierChangedId = 0;
        this._firmwareChangedId = 0;
        this._firmwareMissingId = 0;

        if (this.device) {
            this.statusItem = new PopupMenu.PopupSwitchMenuItem(this._getDescription(), this.connected, { style_class: 'popup-subtitle-menu-item' });
            this._statusChanged = this.statusItem.connect('toggled', Lang.bind(this, function(item, state) {
                if (state)
                    this.activate();
                else
                    this.deactivate();
                this.emit('enabled-changed');
            }));

            this._updateStatusItem();
        }
        this.section = new PopupMenu.PopupMenuSection();

        this._createSection();
    },

    destroy: function() {
        if (this.device)
            this.device._delegate = null;

        if (this._stateChangedId) {
            // Need to go through GObject.Object.prototype because
            // nm_device_disconnect conflicts with g_signal_disconnect
            GObject.Object.prototype.disconnect.call(this.device, this._stateChangedId);
            this._stateChangedId = 0;
        }
        if (this._carrierChangedId) {
            // see above for why this is needed
            GObject.Object.prototype.disconnect.call(this.device, this._carrierChangedId);
            this._carrierChangedId = 0;
        }
        if (this._firmwareChangedId) {
            GObject.Object.prototype.disconnect.call(this.device, this._firmwareChangedId);
            this._firmwareChangedId = 0;
        }
        if (this._firmwareMissingId) {
            GObject.Object.prototype.disconnect.call(this.device, this._firmwareMissingId);
            this._firmwareMissingId = 0;
        }

        this._clearSection();
        if (this.statusItem)
            this.statusItem.destroy();
        this.section.destroy();
    },

    deactivate: function() {
        this.device.disconnect_async(null, null);
    },

    activate: function() {
        if (this._activeConnection)
            // nothing to do
            return;

        // pick the most recently used connection and connect to that
        // or if no connections ever set, create an automatic one
        if (this._connections.length > 0) {
            this._client.activate_connection_async(this._connections[0].connection, this.device, null, null, null);
        } else if (this._autoConnectionName) {
            let connection = this._createAutomaticConnection();
            if (connection)
                this._client.add_and_activate_connection_async(connection, this.device, null, null, null);
        }
    },

    get connected() {
        return this.device.state == NM.DeviceState.ACTIVATED;
    },

    setActiveConnection: function(activeConnection) {
        if (activeConnection == this._activeConnection)
            // nothing to do
            return;

        // remove any UI
        if (this._activeConnectionItem) {
            this._activeConnectionItem.destroy();
            this._activeConnectionItem = null;
        }

        this._activeConnection = activeConnection;

        this._clearSection();
        this._createSection();
    },

    checkConnection: function(connection) {
        let exists = this._findConnection(connection._uuid) != -1;
        let valid = this.connectionValid(connection);
        if (exists && !valid)
            this.removeConnection(connection);
        else if (!exists && valid)
            this.addConnection(connection);
    },

    addConnection: function(connection) {
        // record the connection
        let obj = {
            connection: connection,
            name: connection._name,
            uuid: connection._uuid,
            timestamp: connection._timestamp,
        };
        this._connections.push(obj);
        this._connections.sort(this._connectionSortFunction);

        this._clearSection();
        this._createSection();
    },

    removeConnection: function(connection) {
        if (!connection._uuid) {
            log('Cannot remove a connection without an UUID');
            return;
        }
        let pos = this._findConnection(connection._uuid);
        if (pos == -1) {
            // this connection was never added, nothing to do here
            return;
        }

        let obj = this._connections[pos];
        if (obj.item)
            obj.item.destroy();
        this._connections.splice(pos, 1);

        if (this._connections.length <= 1) {
            // We need to show the automatic connection again
            // (or in the case of NMDeviceWired, we want to hide
            // the only explicit connection)
            this._clearSection();
            this._createSection();
        }
    },

    connectionValid: function(connection) {
        return this.device.connection_valid(connection);
    },

    _connectionSortFunction: function(one, two) {
        if (one.timestamp == two.timestamp)
            return GLib.utf8_collate(one.name, two.name);

        return two.timestamp - one.timestamp;
    },

    setEnabled: function(enabled) {
        // do nothing by default, we want to keep the conneciton list visible
        // in the majority of cases (wired, wwan, vpn)
    },

    get statusLabel(){
        switch(this.device.state) {
        case NM.DeviceState.DISCONNECTED:
        case NM.DeviceState.ACTIVATED:
            return null;
        case NM.DeviceState.UNMANAGED:
            /* Translators: this is for network devices that are physically present but are not
               under NetworkManager's control (and thus cannot be used in the menu) */
            return _("unmanaged");
        case NM.DeviceState.DEACTIVATING:
            return _("disconnecting...");
        case NM.DeviceState.PREPARE:
        case NM.DeviceState.CONFIG:
        case NM.DeviceState.IP_CONFIG:
        case NM.DeviceState.IP_CHECK:
        case NM.DeviceState.SECONDARIES:
            return _("connecting...");
        case NM.DeviceState.NEED_AUTH:
            /* Translators: this is for network connections that require some kind of key or password */
            return _("authentication required");
        case NM.DeviceState.UNAVAILABLE:
            // This state is actually a compound of various states (generically unavailable,
            // firmware missing, carrier not available), that are exposed by different properties
            // (whose state may or may not updated when we receive state-changed).
            if (!this._firmwareMissingId)
                this._firmwareMissingId = this.device.connect('notify::firmware-missing', Lang.bind(this, this._substateChanged));
            if (this.device.firmware_missing) {
                /* Translators: this is for devices that require some kind of firmware or kernel
                   module, which is missing */
                return _("firmware missing");
            }
            if (this.device.capabilities & NM.DeviceCapabilities.CARRIER_DETECT) {
                if (!this._carrierChangedId)
                    this._carrierChangedId = this.device.connect('notify::carrier', Lang.bind(this, this._substateChanged));
                if (!this.carrier) {
                    /* Translators: this is for wired network devices that are physically disconnected */
                    return _("cable unplugged");
                }
            }
            /* Translators: this is for a network device that cannot be activated (for example it
               is disabled by rfkill, or it has no coverage */
            return _("unavailable");
        case NM.DeviceState.FAILED:
            return _("connection failed");
        default:
            log('Device state invalid, is %d'.format(this.device.state));
            return 'invalid';
        }
    },

    get controllable(){
        // controllable for every state except unavailable or unmanaged
        if(this.device.state === NM.DeviceState.UNAVAILABLE || this.device.state === NM.DeviceState.UNMANAGED)
            return false;

        return true;
    },

    // protected
    _createAutomaticConnection: function() {
        throw new TypeError('Invoking pure virtual function NMDevice.createAutomaticConnection');
    },

    _findConnection: function(uuid) {
        for (let i = 0; i < this._connections.length; i++) {
            let obj = this._connections[i];
            if (obj.uuid == uuid)
                return i;
        }
        return -1;
    },

    _clearSection: function() {
        // Clear everything
        this.section.removeAll();
        this._autoConnectionItem = null;
        this._activeConnectionItem = null;
        this._overflowItem = null;
        for (let i = 0; i < this._connections.length; i++) {
            this._connections[i].item = null;
        }
    },

    _shouldShowConnectionList: function() {
        return (this.device.state >= NM.DeviceState.DISCONNECTED);
    },

    _createSection: function() {
        if (!this._shouldShowConnectionList())
            return;

        if (this._activeConnection) {
            this._createActiveConnectionItem();
            this.section.addMenuItem(this._activeConnectionItem);
        }
        if (this._connections.length > 0) {
            let activeOffset = this._activeConnectionItem ? 1 : 0;

            for(let j = 0; j < this._connections.length; ++j) {
                let obj = this._connections[j];
                if (this._activeConnection &&
                    obj.connection == this._activeConnection.connection)
                    continue;
                obj.item = this._createConnectionItem(obj);

                if (j + activeOffset >= NUM_VISIBLE_NETWORKS) {
                    if (!this._overflowItem) {
                        this._overflowItem = new PopupMenu.PopupSubMenuMenuItem(_("More"));
                        this.section.addMenuItem(this._overflowItem);
                    }
                    this._overflowItem.menu.addMenuItem(obj.item);
                } else
                    this.section.addMenuItem(obj.item);
            }
        } else if (this._autoConnectionName) {
            this._autoConnectionItem = new PopupMenu.PopupMenuItem(this._autoConnectionName);
            this._autoConnectionItem.connect('activate', Lang.bind(this, function() {
                let connection = this._createAutomaticConnection();
                if (connection)
                    this._client.add_and_activate_connection_async(connection, this.device, null, null, null);
            }));
            this.section.addMenuItem(this._autoConnectionItem);
        }
    },

    _createConnectionItem: function(obj) {
        let connection = obj.connection;
        let item = new PopupMenu.PopupMenuItem(obj.name);

        item.connect('activate', Lang.bind(this, function() {
            this._client.activate_connection_async(connection, this.device, null, null, null);
        }));
        return item;
    },

    _createActiveConnectionItem: function() {
        let title;
        let active = this._activeConnection.connection;
        if (active) {
            title = active._name;
        } else {
            /* TRANSLATORS: this is the indication that a connection for another logged in user is active,
               and we cannot access its settings (including the name) */
            title = _("Connected (private)");
        }
        this._activeConnectionItem = new PopupMenu.PopupMenuItem(title, { reactive: false });
        this._activeConnectionItem.setShowDot(true);
    },

    _deviceStateChanged: function(device, newstate, oldstate, reason) {
        if (newstate == oldstate) {
            log('device emitted state-changed without actually changing state');
            return;
        }

        if (oldstate == NM.DeviceState.ACTIVATED) {
            this.emit('network-lost');
        }

        if (newstate == NM.DeviceState.FAILED) {
            this.emit('activation-failed', reason);
        }

        this._updateStatusItem();

        this._clearSection();
        this._createSection();
        this.emit('state-changed');
    },

    _updateStatusItem: function() {
        if (this._carrierChangedId) {
            // see above for why this is needed
            GObject.Object.prototype.disconnect.call(this.device, this._carrierChangedId);
            this._carrierChangedId = 0;
        }
        if (this._firmwareChangedId) {
            GObject.Object.prototype.disconnect.call(this.device, this._firmwareChangedId);
            this._firmwareChangedId = 0;
        }

        this.statusItem.setStatus(this.statusLabel);
        this.statusItem.setToggleState(this.connected);
        // if this device is not controllable, hide the switch
        this.statusItem._switch.actor.visible = this.controllable;
    },

    _substateChanged: function() {
        this.statusItem.setStatus(this.statusLabel);
        this.statusItem._switch.actor.visible = this.controllable;

        this.emit('state-changed');
    },

    _getDescription: function() {
        let dev_product = this.device.get_product();
        let dev_vendor = this.device.get_vendor();
        if (!dev_product || !dev_vendor) {
            if (this.device.name) {
                return this.device.name;
            }
            else {
                switch (this.device.get_device_type()) {
                    case NM.DeviceType.ETHERNET: return _("Ethernet");
                    case NM.DeviceType.WIFI: return _("Wifi");
                    case NM.DeviceType.MODEM: return _("Modem");
                    case NM.DeviceType.BT: return _("Bluetooth");
                    default: return "";
                }
            }
        }

        let product = Util.fixupPCIDescription(dev_product);
        let vendor = Util.fixupPCIDescription(dev_vendor);
        let out = '';

        // Another quick hack; if all of the fixed up vendor string
        // is found in product, ignore the vendor.
        if (product.indexOf(vendor) == -1)
            out += vendor + ' ';
        out += product;

        return out;
    }
};
Signals.addSignalMethods(NMDevice.prototype);


function NMDeviceWired() {
    this._init.apply(this, arguments);
}

NMDeviceWired.prototype = {
    __proto__: NMDevice.prototype,

    _init: function(client, device, connections) {
        this._autoConnectionName = _("Auto Ethernet");
        this.category = NMConnectionCategory.WIRED;

        NMDevice.prototype._init.call(this, client, device, connections);
    },

    _createSection: function() {
        NMDevice.prototype._createSection.call(this);

        // if we have only one connection (normal or automatic)
        // we hide the connection list, and use the switch to control
        // the device
        // we can do it here because addConnection and removeConnection
        // both call _createSection at some point
        if (this._connections.length <= 1)
            this.section.actor.hide();
        else
            this.section.actor.show();
    },

    _createAutomaticConnection: function() {
        let connection = new NM.SimpleConnection();
        connection._uuid = NM.utils_uuid_generate();
        connection.add_setting(new NM.SettingWired());
        let setting_conn = new NM.SettingConnection({
            uuid: connection._uuid,
            id: this._autoConnectionName,
            type: NM.SETTING_WIRED_SETTING_NAME,
            autoconnect: true
        });
        setting_conn.add_permission('user', GLib.get_user_name(), null);
        connection.add_setting(setting_conn);
        return connection;
    }
};

function NMDeviceModem() {
    this._init.apply(this, arguments);
}

NMDeviceModem.prototype = {
    __proto__: NMDevice.prototype,

    _init: function(client, device, connections) {
        let is_wwan = false;

        this._enabled = true;
        this.mobileDevice = null;
        this._connectionType = 'ppp';

        this._capabilities = device.current_capabilities;
        // Support new ModemManager1 devices
        if (device.udi.indexOf('/org/freedesktop/ModemManager1/Modem') == 0) {
            try {
                is_wwan = true;
                this.mobileDevice = new ModemManager.BroadbandModem(device.udi, device.current_capabilities);
                if (this._capabilities & NM.DeviceModemCapabilities.GSM_UMTS) {
                    this._connectionType = NM.SETTING_GSM_SETTING_NAME;
                } else if (this._capabilities & NM.DeviceModemCapabilities.LTE) {
                    this._connectionType = NM.SETTING_GSM_SETTING_NAME;
                } else if (this._capabilities & NM.DeviceModemCapabilities.CDMA_EVDO) {
                    this._connectionType = NM.SETTING_CDMA_SETTING_NAME;
                }
            }
            catch (e){
                global.logError(e);
            }
        } else if (this._capabilities & NM.DeviceModemCapabilities.GSM_UMTS) {
            is_wwan = true;
            this.mobileDevice = new ModemManager.ModemGsm(device.udi);
            this._connectionType = NM.SETTING_GSM_SETTING_NAME;
        } else if (this._capabilities & NM.DeviceModemCapabilities.CDMA_EVDO) {
            is_wwan = true;
            this.mobileDevice = new ModemManager.ModemCdma(device.udi);
            this._connectionType = NM.SETTING_CDMA_SETTING_NAME;
        } else if (this._capabilities & NM.DeviceModemCapabilities.LTE) {
            is_wwan = true;
            // FIXME: support signal quality
        }

        if (is_wwan) {
            this.category = NMConnectionCategory.WWAN;
            this._autoConnectionName = _("Auto broadband");
        } else {
            this.category = NMConnectionCategory.WIRED;
            this._autoConnectionName = _("Auto dial-up");
        }

        if (this.mobileDevice) {
            this._operatorNameId = this.mobileDevice.connect('notify::operator-name', Lang.bind(this, function() {
                if (this._operatorItem) {
                    let name = this.mobileDevice.operator_name;
                    if (name) {
                        this._operatorItem.label.text = name;
                        this._operatorItem.actor.show();
                    } else
                        this._operatorItem.actor.hide();
                }
            }));
            this._signalQualityId = this.mobileDevice.connect('notify::signal-quality', Lang.bind(this, function() {
                if (this._operatorItem) {
                    this._operatorItem.setIcon(this._getSignalIcon());
                }
            }));
        }

        NMDevice.prototype._init.call(this, client, device, connections);
    },

    setEnabled: function(enabled) {
        this._enabled = enabled;
        if (this.category == NMConnectionCategory.WWAN) {
            if (enabled) {
                // prevent "network unavailable" statuses
                this.statusItem.setStatus(null);
            } else
                this.statusItem.setStatus(this.statusLabel);
        }

        NMDevice.prototype.setEnabled.call(this, enabled);
    },

    get connected() {
        return this._enabled && this.device.state == NM.DeviceState.ACTIVATED;
    },

    destroy: function() {
        if (this._operatorNameId) {
            this.mobileDevice.disconnect(this._operatorNameId);
            this._operatorNameId = 0;
        }
        if (this._signalQualityId) {
            this.mobileDevice.disconnect(this._signalQualityId);
            this._signalQualityId = 0;
        }

        NMDevice.prototype.destroy.call(this);
    },

    _getSignalIcon: function() {
        return 'network-cellular-signal-' + signalToIcon(this.mobileDevice.signal_quality);
    },

    _createSection: function() {
        if (!this._shouldShowConnectionList())
            return;

        if (this.mobileDevice) {
            // If operator_name is null, just pass the empty string, as the item is hidden anyway
            this._operatorItem = new PopupMenu.PopupImageMenuItem(this.mobileDevice.operator_name || '',
                                                                  this._getSignalIcon(),
                                                                  { reactive: false });
            if (!this.mobileDevice.operator_name)
                this._operatorItem.actor.hide();
            this.section.addMenuItem(this._operatorItem);
        }

        NMDevice.prototype._createSection.call(this);
    },

    _clearSection: function() {
        this._operatorItem = null;

        NMDevice.prototype._clearSection.call(this);
    },

    _createAutomaticConnection: function() {
        // Mobile wizard is too complex for Cinnamon UI and
        // is handled by the network panel
        Util.spawn(['cinnamon-settings', 'network',
                    'connect-3g', this.device.get_path()]);
        return null;
    }
};

function NMDeviceBluetooth() {
    this._init.apply(this, arguments);
}

NMDeviceBluetooth.prototype = {
    __proto__: NMDevice.prototype,

    _init: function(client, device, connections) {
        this._autoConnectionName = this._makeConnectionName(device);
        device.connect('notify::name', Lang.bind(this, this._updateAutoConnectionName));

        this.category = NMConnectionCategory.WWAN;

        NMDevice.prototype._init.call(this, client, device, connections);
    },

    _createAutomaticConnection: function() {
        let connection = new NM.SimpleConnection();
        connection._uuid = NM.utils_uuid_generate();
        connection.add_setting(new NM.SettingBluetooth());
        connection.add_setting(new NM.SettingConnection({
            uuid: connection._uuid,
            id: this._autoConnectionName,
            type: NM.SETTING_BLUETOOTH_SETTING_NAME,
            autoconnect: false
        }));
        return connection;
    },

    _makeConnectionName: function(device) {
        let name = device.name;
        if (name)
            return _("Auto %s").format(name);
        else
            return _("Auto bluetooth");
    },

    _updateAutoConnectionName: function() {
        this._autoConnectionName = this._makeConnectionName(this.device);

        this._clearSection();
        this._createSection();
    }
};


// Not a real device, but I save a lot code this way
function NMDeviceVPN() {
    this._init.apply(this, arguments);
}

NMDeviceVPN.prototype = {
    __proto__: NMDevice.prototype,

    _init: function(client) {
        // Disable autoconnections
        this._autoConnectionName = null;
        this.category = NMConnectionCategory.VPN;

        NMDevice.prototype._init.call(this, client, null, [ ]);
    },

    connectionValid: function(connection) {
        return connection._type == NM.SETTING_VPN_SETTING_NAME;
    },

    get empty() {
        return this._connections.length == 0;
    },

    get connected() {
        return !!this._activeConnection;
    },

    setActiveConnection: function(activeConnection) {
        NMDevice.prototype.setActiveConnection.call(this, activeConnection);

        this.emit('active-connection-changed');
    },

    _shouldShowConnectionList: function() {
        return true;
    },

    deactivate: function() {
        if (this._activeConnection)
            this._client.deactivate_connection(this._activeConnection, null);
    },

    statusLabel: null,
    controllable: true
};

function NMDeviceWireless() {
    this._init.apply(this, arguments);
}

NMDeviceWireless.prototype = {
    __proto__: NMDevice.prototype,

    _init: function(client, device, connections) {
        this.category = NMConnectionCategory.WIRELESS;

        this._overflowItem = null;
        this._networks = [ ];

        this._client = client;

        // breaking the layers with this, but cannot call
        // this.connectionValid until I have a device
        this.device = device;

        let validConnections = connections.filter(Lang.bind(this, function(connection) {
            return this.connectionValid(connection);
        }));
        let accessPoints = device.get_access_points() || [ ];
        for (let i = 0; i < accessPoints.length; i++) {
            // Access points are grouped by network
            let ap = accessPoints[i];

            if (ap.get_ssid() == null) {
                // hidden access point cannot be added, we need to know
                // the SSID and security details to connect
                // nevertheless, the access point can acquire a SSID when
                // NetworkManager connects to it (via nmcli or cinnamon-settings)
                ap._notifySsidId = ap.connect('notify::ssid', Lang.bind(this, this._notifySsidCb));
                continue;
            }

            let pos = this._findNetwork(ap);
            let obj;
            if (pos != -1) {
                obj = this._networks[pos];
                obj.accessPoints.push(ap);
            } else {
                obj = { ssid: ap.get_ssid(),
                        mode: ap.mode,
                        security: this._getApSecurityType(ap),
                        connections: [ ],
                        item: null,
                        accessPoints: [ ap ]
                      };
                obj.ssidText = ssidToLabel(obj.ssid);
                this._networks.push(obj);
            }

            // Check if some connection is valid for this AP
            for (let j = 0; j < validConnections.length; j++) {
                let connection = validConnections[j];
                if (ap.connection_valid(connection) &&
                    obj.connections.indexOf(connection) == -1) {
                    obj.connections.push(connection);
                }
            }
        }

        if (this.device.active_access_point) {
            let networkPos = this._findNetwork(this.device.active_access_point);

            if (networkPos == -1) // the connected access point is invisible
                this._activeNetwork = null;
            else
                this._activeNetwork = this._networks[networkPos];
        } else {
            this._activeNetwork = null;
        }
        this._networks.sort(this._networkSortFunction);

        this._apChangedId = device.connect('notify::active-access-point', Lang.bind(this, this._activeApChanged));
        this._apAddedId = device.connect('access-point-added', Lang.bind(this, this._accessPointAdded));
        this._apRemovedId = device.connect('access-point-removed', Lang.bind(this, this._accessPointRemoved));

        NMDevice.prototype._init.call(this, client, device, validConnections);
    },

    destroy: function() {
        if (this._apChangedId) {
            // see above for this HACK
            GObject.Object.prototype.disconnect.call(this.device, this._apChangedId);
            this._apChangedId = 0;
        }

        if (this._apAddedId) {
            GObject.Object.prototype.disconnect.call(this.device, this._apAddedId);
            this._apAddedId = 0;
        }

        if (this._apRemovedId) {
            GObject.Object.prototype.disconnect.call(this.device, this._apRemovedId);
            this._apRemovedId = 0;
        }

        NMDevice.prototype.destroy.call(this);
    },

    setEnabled: function(enabled) {
        if (enabled) {
            this.statusItem.actor.show();
            this.section.actor.show();
        } else {
            this.statusItem.actor.hide();
            this.section.actor.hide();
        }
    },

    activate: function() {
        if (this._activeConnection)
            // nothing to do
            return;

        // among all visible networks, pick the last recently used connection
        let best = null;
        let bestApObj = null;
        let bestTime = 0;
        for (let i = 0; i < this._networks.length; i++) {
            let apObj = this._networks[i];
            for (let j = 0; j < apObj.connections.length; j++) {
                let connection = apObj.connections[j];
                if (connection._timestamp > bestTime) {
                    best = connection;
                    bestTime = connection._timestamp;
                    bestApObj = apObj;
                }
            }
        }

        if (best) {
            for (let i = 0; i < bestApObj.accessPoints.length; i++) {
                let ap = bestApObj.accessPoints[i];
                if (ap.connection_valid(best)) {
                    this._client.activate_connection_async(best, this.device, ap.path, null, null);
                    break;
                }
            }
            return;
        }

        // XXX: what else to do?
        // for now, just pick a random network
        // (this function is called in a corner case anyway, that is, only when
        // the user toggles the switch and has more than one wireless device)
        if (this._networks.length > 0) {
            let connection = this._createAutomaticConnection(this._networks[0]);
            let accessPoints = sortAccessPoints(this._networks[0].accessPoints);
            this._client.add_and_activate_connection_async(connection, this.device, accessPoints[0].path, null, null);
        }
    },

    _notifySsidCb: function(accessPoint) {
        if (accessPoint.get_ssid() != null) {
            accessPoint.disconnect(accessPoint._notifySsidId);
            accessPoint._notifySsidId = 0;
            this._accessPointAdded(this.device, accessPoint);
        }
    },

    _activeApChanged: function() {
        this._activeNetwork = null;

        let activeAp = this.device.active_access_point;

        if (activeAp) {
            let res = this._findExistingNetwork(activeAp);

            if (res != null)
                this._activeNetwork = this._networks[res.network];
        }

        // we don't refresh the view here, setActiveConnection will
    },

    _getApSecurityType: function(accessPoint) {
        if (accessPoint._secType)
            return accessPoint._secType;

        let flags = accessPoint.flags;
        let wpa_flags = accessPoint.wpa_flags;
        let rsn_flags = accessPoint.rsn_flags;
        let type;
        if (rsn_flags != NM80211ApSecurityFlags.NONE) {
            /* RSN check first so that WPA+WPA2 APs are treated as RSN/WPA2 */
            if (rsn_flags & NM80211ApSecurityFlags.KEY_MGMT_802_1X)
                type = NMAccessPointSecurity.WPA2_ENT;
            else if (rsn_flags & NM80211ApSecurityFlags.KEY_MGMT_PSK)
                type = NMAccessPointSecurity.WPA2_PSK;
        } else if (wpa_flags != NM80211ApSecurityFlags.NONE) {
            if (wpa_flags & NM80211ApSecurityFlags.KEY_MGMT_802_1X)
                type = NMAccessPointSecurity.WPA_ENT;
            else if (wpa_flags & NM80211ApSecurityFlags.KEY_MGMT_PSK)
                type = NMAccessPointSecurity.WPA_PSK;
        } else {
            if (flags & NM80211ApFlags.PRIVACY)
                type = NMAccessPointSecurity.WEP;
            else
                type = NMAccessPointSecurity.NONE;
        }

        // cache the found value to avoid checking flags all the time
        accessPoint._secType = type;
        return type;
    },

    _networkSortFunction: function(one, two) {
        let oneHasConnection = one.connections.length != 0;
        let twoHasConnection = two.connections.length != 0;
        // place known connections first
        // (-1 = good order, 1 = wrong order)
        if (oneHasConnection && !twoHasConnection)
            return -1;
        else if (!oneHasConnection && twoHasConnection)
            return 1;

        return two.accessPoints[0].strength - one.accessPoints[0].strength;
/**
        let oneHasSecurity = one.security != NMAccessPointSecurity.NONE;
        let twoHasSecurity = two.security != NMAccessPointSecurity.NONE;

        // place secure connections first
        // (we treat WEP/WPA/WPA2 the same as there is no way to
        // take them apart from the UI)
        if (oneHasSecurity && !twoHasSecurity)
            return -1;
        else if (!oneHasSecurity && twoHasSecurity)
            return 1;

        // sort alphabetically
        return GLib.utf8_collate(one.ssidText, two.ssidText);
**/
    },

    _networkCompare: function(network, accessPoint) {
        if (!network.ssid.equal (accessPoint.get_ssid()))
            return false;
        if (network.mode != accessPoint.mode)
            return false;
        if (network.security != this._getApSecurityType(accessPoint))
            return false;

        return true;
    },

    _findExistingNetwork: function(accessPoint) {
        for (let i = 0; i < this._networks.length; i++) {
            let apObj = this._networks[i];
            for (let j = 0; j < apObj.accessPoints.length; j++) {
                if (apObj.accessPoints[j] == accessPoint)
                    return { network: i, ap: j };
            }
        }

        return null;
    },

    _findNetwork: function(accessPoint) {
        if (accessPoint.get_ssid() == null)
            return -1;

        for (let i = 0; i < this._networks.length; i++) {
            if (this._networkCompare(this._networks[i], accessPoint))
                return i;
        }
        return -1;
    },

    _accessPointAdded: function(device, accessPoint) {
        if (accessPoint.get_ssid() == null) {
            // This access point is not visible yet
            // Wait for it to get a ssid
            accessPoint._notifySsidId = accessPoint.connect('notify::ssid', Lang.bind(this, this._notifySsidCb));
            return;
        }

        let pos = this._findNetwork(accessPoint);
        let apObj;
        let needsupdate = false;

        if (pos != -1) {
            apObj = this._networks[pos];
            if (apObj.accessPoints.indexOf(accessPoint) != -1) {
                log('Access point was already seen, not adding again');
                return;
            }

            apObj.accessPoints.push(accessPoint);
            if (apObj.item)
                apObj.item.updateAccessPoints(apObj.accessPoints);
        } else {
            apObj = { ssid: accessPoint.get_ssid(),
                      mode: accessPoint.mode,
                      security: this._getApSecurityType(accessPoint),
                      connections: [ ],
                      item: null,
                      accessPoints: [ accessPoint ]
                    };
            apObj.ssidText = ssidToLabel(apObj.ssid);
            needsupdate = true;
        }

        // check if this enables new connections for this group
        for (let i = 0; i < this._connections.length; i++) {
            let connection = this._connections[i].connection;
            if (accessPoint.connection_valid(connection) &&
                apObj.connections.indexOf(connection) == -1) {
                apObj.connections.push(connection);

                // this potentially changes the order
                needsupdate = true;
            }
        }

        if (needsupdate) {
            if (apObj.item)
                apObj.item.destroy();

            if (pos != -1)
                this._networks.splice(pos, 1);

            if (this._networks.length == 0) {
                // only network in the list
                this._networks.push(apObj);
                this._clearSection();
                this._createSection();
                return;
            }

            // skip networks that should appear earlier
            let menuPos = 0;
            for (pos = 0;
                 pos < this._networks.length &&
                 this._networkSortFunction(this._networks[pos], apObj) < 0; ++pos) {
                if (this._networks[pos] != this._activeNetwork)
                    menuPos++;
            }

            // (re-)add the network
            this._networks.splice(pos, 0, apObj);

            if (this._shouldShowConnectionList()) {
                menuPos += (this._activeConnectionItem ? 1 : 0);
                this._createNetworkItem(apObj, menuPos);
            }
        }
    },

    _accessPointRemoved: function(device, accessPoint) {
        let res = this._findExistingNetwork(accessPoint);

        if (res == null) {
            return;
        }

        let apObj = this._networks[res.network];
        apObj.accessPoints.splice(res.ap, 1);

        if (apObj.accessPoints.length == 0) {
            if (this._activeNetwork == apObj)
                this._activeNetwork = null;

            if (apObj.item)
                apObj.item.destroy();

            if (this._overflowItem) {
                if (!apObj.isMore) {
                    // we removed an item in the main menu, and we have a more submenu
                    // we need to extract the first item in more and move it to the submenu

                    let item = this._overflowItem.menu.firstMenuItem;
                    if (item && item._apObj) {
                        item.destroy();
                        // clear the cycle, and allow the construction of the new item
                        item._apObj.item = null;

                        this._createNetworkItem(item._apObj, NUM_VISIBLE_NETWORKS-1);
                    } else {
                        log('The more... menu was existing and empty! This should not happen');
                    }
                }

                // This can happen if the removed connection is from the overflow
                // menu, or if we just moved the last connection out from the menu
                if (this._overflowItem.menu.numMenuItems == 0) {
                    this._overflowItem.destroy();
                    this._overflowItem = null;
                }
            }
            this._networks.splice(res.network, 1);

        } else if (apObj.item)
            apObj.item.updateAccessPoints(apObj.accessPoints);
    },

    _createAPItem: function(connection, accessPointObj, useConnectionName) {
        let item = new NMNetworkMenuItem(accessPointObj.accessPoints, useConnectionName ? connection._name : undefined);
        item._connection = connection;
        item.connect('activate', Lang.bind(this, function() {
            let accessPoints = sortAccessPoints(accessPointObj.accessPoints);
            for (let i = 0; i < accessPoints.length; i++) {
                if (accessPoints[i].connection_valid(connection)) {
                    this._client.activate_connection_async(connection, this.device, accessPoints[i].path, null, null);
                    break;
                }
            }
        }));
        return item;
    },

    _clearSection: function() {
        NMDevice.prototype._clearSection.call(this);

        for (let i = 0; i < this._networks.length; i++)
            this._networks[i].item = null;
        this._overflowItem = null;
    },

    removeConnection: function(connection) {
        if (!connection._uuid)
            return;
        let pos = this._findConnection(connection._uuid);
        if (pos == -1) {
            // removing connection that was never added
            return;
        }

        this._connections.splice(pos, 1);

        let anyauto = false, forceupdate = false;
        for (let i = 0; i < this._networks.length; i++) {
            let apObj = this._networks[i];
            let connections = apObj.connections;
            for (let k = 0; k < connections.length; k++) {
                if (connections[k]._uuid == connection._uuid) {
                    // remove the connection from the access point group
                    connections.splice(k);
                    anyauto = connections.length == 0;

                    if (anyauto) {
                        // this potentially changes the sorting order
                        forceupdate = true;
                        break;
                    }
                    if (apObj.item) {
                        if (apObj.item instanceof PopupMenu.PopupSubMenuMenuItem) {
                            let items = apObj.item.menu.getMenuItems();
                            if (items.length == 2) {
                                // we need to update the connection list to convert this to a normal item
                                forceupdate = true;
                            } else {
                                for (let j = 0; j < items.length; j++) {
                                    if (items[j]._connection._uuid == connection._uuid) {
                                        items[j].destroy();
                                        break;
                                    }
                                }
                            }
                        } else {
                            apObj.item.destroy();
                            apObj.item = null;
                        }
                    }
                    break;
                }
            }
        }

        if (forceupdate || anyauto) {
            this._networks.sort(this._networkSortFunction);
            this._clearSection();
            this._createSection();
        }
    },

    addConnection: function(connection) {
        // record the connection
        let obj = {
            connection: connection,
            name: connection._name,
            uuid: connection._uuid,
        };
        this._connections.push(obj);

        // find an appropriate access point
        let forceupdate = false;
        for (let i = 0; i < this._networks.length; i++) {
            let apObj = this._networks[i];

            // Check if connection is valid for any of these access points
            for (let k = 0; k < apObj.accessPoints.length; k++) {
                let ap = apObj.accessPoints[k];
                if (ap.connection_valid(connection)) {
                    apObj.connections.push(connection);
                    // this potentially changes the sorting order
                    forceupdate = true;
                    break;
                }
            }
        }

        if (forceupdate) {
            this._networks.sort(this._networkSortFunction);
            this._clearSection();
            this._createSection();
        }
    },

    _createActiveConnectionItem: function() {
        if (this._activeConnection.connection) {
            if (!this._activeNetwork) {
                if (this.device.active_access_point) {
                    let networkPos = this._findNetwork(this.device.active_access_point);
                    if (networkPos == -1) // the connected access point is invisible
                        this._activeNetwork = null;
                    else
                        this._activeNetwork = this._networks[networkPos];
                } else {
                    this._activeNetwork = null;
                }
            }

            if (this._activeNetwork)
                this._activeConnectionItem = new NMNetworkMenuItem(this._activeNetwork.accessPoints, undefined, { reactive: false });
            else
                this._activeConnectionItem = new PopupMenu.PopupImageMenuItem(this._activeConnection.connection._name, 'network-wireless-connected', { reactive: false });
        } else {
            // We cannot read the connection (due to ACL, or API incompatibility), but we still show signal if we have it
            if (this._activeNetwork)
                this._activeConnectionItem = new NMNetworkMenuItem(this._activeNetwork.accessPoints, undefined,
                                                                   { reactive: false });
            else
                this._activeConnectionItem = new PopupMenu.PopupImageMenuItem(_("Connected (private)"),
                                                                              'network-wireless-connected',
                                                                              { reactive: false });
        }
        this._activeConnectionItem.setShowDot(true);
    },

    _createAutomaticConnection: function(apObj) {
        let name;
        let ssid = NM.utils_ssid_to_utf8(apObj.ssid.get_data());
        if (ssid) {
            /* TRANSLATORS: this the automatic wireless connection name (including the network name) */
            name = _("Auto %s").format(ssid);
        } else
            name = _("Auto wireless");

        let connection = new NM.SimpleConnection();
        connection.add_setting(new NM.SettingWireless());
        let setting_conn = new NM.SettingConnection({
            id: name,
            autoconnect: true, // NetworkManager will know to ignore this if appropriate
            uuid: NM.utils_uuid_generate(),
            type: NM.SETTING_WIRELESS_SETTING_NAME
        });
        if (default_to_private_connections(this._client)) {
            setting_conn.add_permission('user', GLib.get_user_name(), null);
            if (apObj.security == NMAccessPointSecurity.WPA2_PSK ||
                apObj.security == NMAccessPointSecurity.WPA_PSK) {
                connection.add_setting(new NM.SettingWirelessSecurity({
                    psk_flags: NM.SettingSecretFlags.AGENT_OWNED
                }));
            }
            if (apObj.security == NMAccessPointSecurity.WEP) {
                connection.add_setting(new NM.SettingWirelessSecurity({
                    wep_key_flags: NM.SettingSecretFlags.AGENT_OWNED
                }));
            }
        }
        connection.add_setting(setting_conn);
        return connection;
    },

    _createNetworkItem: function(apObj, position) {

        if(!apObj.accessPoints || apObj.accessPoints.length == 0) {
            // this should not happen, but I have no idea why it happens
            return;
        }

        if(apObj.connections.length > 0) {
            if (apObj.connections.length == 1) {
                apObj.item = this._createAPItem(apObj.connections[0], apObj, false);
            } else {
                let title = apObj.ssidText;
                apObj.item = new PopupMenu.PopupSubMenuMenuItem(title);
                for (let i = 0; i < apObj.connections.length; i++)
                    apObj.item.menu.addMenuItem(this._createAPItem(apObj.connections[i], apObj, true));
            }
        } else {
            apObj.item = new NMNetworkMenuItem(apObj.accessPoints);
            apObj.item.connect('activate', Lang.bind(this, function() {
                let accessPoints = sortAccessPoints(apObj.accessPoints);
                if ((accessPoints[0]._secType == NMAccessPointSecurity.WPA2_ENT) ||
                    (accessPoints[0]._secType == NMAccessPointSecurity.WPA_ENT)) {
                    // 802.1x-enabled APs require further configuration, so they're
                    // handled in cinnamon-settings
                    Util.spawn(['cinnamon-settings', 'network', 'connect-8021x-wifi',
                                this.device.get_path(), accessPoints[0].path]);
                } else {
                    let connection = this._createAutomaticConnection(apObj);
                    this._client.add_and_activate_connection_async(connection, this.device, accessPoints[0].path, null, null);
                }
            }));
        }
        apObj.item._apObj = apObj;

        if (position < NUM_VISIBLE_NETWORKS) {
            apObj.isMore = false;
            this.section.addMenuItem(apObj.item, position);
        } else {
            if (!this._overflowItem) {
                this._overflowItem = new PopupMenu.PopupSubMenuMenuItem(_("More"));
                this.section.addMenuItem(this._overflowItem);
            }
            this._overflowItem.menu.addMenuItem(apObj.item, position - NUM_VISIBLE_NETWORKS);
            apObj.isMore = true;
        }
    },

    _createSection: function() {
        if (!this._shouldShowConnectionList())
            return;

        if(this._activeConnection) {
            this._createActiveConnectionItem();
            this.section.addMenuItem(this._activeConnectionItem);
        }

        let activeOffset = this._activeConnectionItem ? 1 : 0;

        for(let j = 0; j < this._networks.length; j++) {
            let apObj = this._networks[j];
            if (apObj == this._activeNetwork)
                continue;

            this._createNetworkItem(apObj, j + activeOffset);
        }
    },
};

function NMMessageTraySource() {
    this._init();
}

NMMessageTraySource.prototype = {
    __proto__: MessageTray.Source.prototype,

    _init: function() {
        MessageTray.Source.prototype._init.call(this, _("Network Manager"));

        let icon = new St.Icon({ icon_name: 'network-transmit-receive',
                                 icon_type: St.IconType.SYMBOLIC,
                                 icon_size: this.ICON_SIZE
                               });
        this._setSummaryIcon(icon);
    }
};

function CinnamonNetworkApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

CinnamonNetworkApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.metadata = metadata;
            Main.systrayManager.registerRole("network", metadata.uuid);
            Main.systrayManager.registerRole("nm-applet", metadata.uuid);

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this._currentIconName = undefined;
            this._setIcon('network-offline');

            this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);
            this.settings.bind("keyOpen", "keyOpen", this._setKeybinding);
            this._setKeybinding();

            NM.Client.new_async(null, Lang.bind(this, this._clientGot));
        }
        catch (e) {
            global.logError(e);
        }
    },

    _setKeybinding() {
        Main.keybindingManager.addHotKey("network-open-" + this.instance_id, this.keyOpen, Lang.bind(this, this._openMenu));
    },

    _clientGot: function(obj, result) {
        try {
            this._client = NM.Client.new_finish(result);
            this._v1_28_0 = Util.version_exceeds(this._client.get_version(), "1.28.0");

            this._nm_proxy = null;

            if (!this._v1_28_0) {
                new NMDBus(Lang.bind(this, function(proxy, error) {
                    this._nm_proxy = proxy;
                }));
            }

            this._statusSection = new PopupMenu.PopupMenuSection();
            this._statusItem = new PopupMenu.PopupMenuItem('', { style_class: 'popup-inactive-menu-item', reactive: false });
            this._statusSection.addMenuItem(this._statusItem);
            this._statusSection.addAction(_("Enable networking"), Lang.bind(this, function() {
                this._client.networking_enabled = true;
            }));
            this._statusSection.actor.hide();
            this.menu.addMenuItem(this._statusSection);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this._devices = { };

            this._devices.wired = {
                section: new PopupMenu.PopupMenuSection(),
                devices: [ ],
                item: new NMWiredSectionTitleMenuItem(_("Wired"))
            };

            this._devices.wired.section.addMenuItem(this._devices.wired.item);
            this._devices.wired.section.actor.hide();
            this.menu.addMenuItem(this._devices.wired.section);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this._devices.wireless = {
                section: new PopupMenu.PopupMenuSection(),
                devices: [ ],
                item: this._makeToggleItem('wireless', _("Wireless"))
            };
            this._devices.wireless.section.addMenuItem(this._devices.wireless.item);
            this._devices.wireless.section.actor.hide();
            this.menu.addMenuItem(this._devices.wireless.section);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this._devices.wwan = {
                section: new PopupMenu.PopupMenuSection(),
                devices: [ ],
                item: this._makeToggleItem('wwan', _("Mobile broadband"))
            };
            this._devices.wwan.section.addMenuItem(this._devices.wwan.item);
            this._devices.wwan.section.actor.hide();
            this.menu.addMenuItem(this._devices.wwan.section);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this._devices.vpn = {
                section: new PopupMenu.PopupMenuSection(),
                device: new NMDeviceVPN(this._client),
                item: new NMWiredSectionTitleMenuItem(_("VPN Connections"))
            };
            this._devices.vpn.device.connect('active-connection-changed', Lang.bind(this, function() {
                this._devices.vpn.item.updateForDevice(this._devices.vpn.device);
            }));
            this._devices.vpn.item.updateForDevice(this._devices.vpn.device);
            this._devices.vpn.section.addMenuItem(this._devices.vpn.item);
            this._devices.vpn.section.addMenuItem(this._devices.vpn.device.section);
            this._devices.vpn.section.actor.hide();
            this.menu.addMenuItem(this._devices.vpn.section);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.menu.addSettingsAction(_("Network Settings"), 'network');
            this.menu.addAction(_("Network Connections"), Lang.bind(this, function() {
				Util.spawnCommandLine("nm-connection-editor");
            }));

            this.menu.connect("open-state-changed", Lang.bind(this, this._onMenuOpenStateChanged));

            this._periodicTimeoutId = 0;
            this._updateFrequencySeconds = 0;
            this._checkingConnectivity = false;
            this._lastConnectivityState = NM.ConnectivityState.UNKNOWN;

            this._activeConnections = [ ];
            this._connections = [ ];

            this._mainConnection = null;

            // Device types
            this._dtypes = { };
            this._dtypes[NM.DeviceType.ETHERNET] = NMDeviceWired;
            this._dtypes[NM.DeviceType.WIFI] = NMDeviceWireless;
            this._dtypes[NM.DeviceType.MODEM] = NMDeviceModem;
            this._dtypes[NM.DeviceType.BT] = NMDeviceBluetooth;

            // Connection types
            this._ctypes = { };
            this._ctypes[NM.SETTING_WIRELESS_SETTING_NAME] = NMConnectionCategory.WIRELESS;
            this._ctypes[NM.SETTING_WIRED_SETTING_NAME] = NMConnectionCategory.WIRED;
            this._ctypes[NM.SETTING_PPPOE_SETTING_NAME] = NMConnectionCategory.WIRED;
            this._ctypes[NM.SETTING_PPP_SETTING_NAME] = NMConnectionCategory.WIRED;
            this._ctypes[NM.SETTING_BLUETOOTH_SETTING_NAME] = NMConnectionCategory.WWAN;
            this._ctypes[NM.SETTING_CDMA_SETTING_NAME] = NMConnectionCategory.WWAN;
            this._ctypes[NM.SETTING_GSM_SETTING_NAME] = NMConnectionCategory.WWAN;
            this._ctypes[NM.SETTING_VPN_SETTING_NAME] = NMConnectionCategory.VPN;

            this._readConnections();
            this._readDevices();
            this._syncNMState();

            this._client.connect('notify::nm-running', Lang.bind(this, this._syncNMState));
            this._client.connect('notify::networking-enabled', Lang.bind(this, this._syncNMState));
            this._client.connect('notify::state', Lang.bind(this, this._syncNMState));
            this._client.connect('notify::active-connections', Lang.bind(this, this._updateIcon));
            this._client.connect('device-added', Lang.bind(this, this._deviceAdded));
            this._client.connect('device-removed', Lang.bind(this, this._deviceRemoved));
            this._client.connect('connection-added', Lang.bind(this, this._connectionAdded));
            this._client.connect('connection-removed', Lang.bind(this, this._connectionRemoved));

            this._inited = true;

            this._periodicUpdateIcon();

        }
        catch (e) {
            global.logError(e);
        }
    },

    _setIcon: function(name) {
        if (this._currentIconName !== name) {
            this.set_applet_icon_symbolic_name(name);
            this._currentIconName = name;
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _openMenu: function () {
        this.menu.toggle();
    },

    _ensureSource: function() {
        if (!this._source) {
            this._source = new NMMessageTraySource();
            this._source.connect('destroy', Lang.bind(this, function() {
                this._source = null;
            }));
            if (Main.messageTray) Main.messageTray.add(this._source);
        }
    },

    _makeToggleItem: function(type, title) {
        let item = new NMWirelessSectionTitleMenuItem(this._client, type, title);
        item.connect('enabled-changed', Lang.bind(this, function(item, enabled) {
            let devices = this._devices[type].devices;
            devices.forEach(function(dev) {
                dev.setEnabled(enabled);
            });
            this._syncSectionTitle(type);
        }));
        return item;
    },

    _syncSectionTitle: function(category) {
        let devices = this._devices[category].devices;
        let vis_devices = [];

        let item = this._devices[category].item;
        let section = this._devices[category].section;

        /* We don't want unmanaged entries to clutter the list, but we do need to
         * keep them around in case they become manageable and need to be made visible
         * later (some valid wifi hardware starts out initially unmanaged, for instance.)
         * We'll only count managed devices for evaluating what entries to display, and
         * when to show or hide section titles. */
        for (let i = 0; i < devices.length; i++) {
            if (devices[i].device.state == NM.DeviceState.UNMANAGED) {
                continue;
            }

            vis_devices.push(devices[i]);
        }

        if (vis_devices.length == 0) {
            section.actor.hide();
        } else {
            section.actor.show();
            if (vis_devices.length == 1) {
                devices.forEach(function(dev) {
                    dev.statusItem.actor.hide();
                });

                let dev = vis_devices[0];
                item.updateForDevice(dev);
            } else {
                devices.forEach(function(dev) {
                    dev.statusItem.actor.visible = (dev.device.state != NM.DeviceState.UNMANAGED);
                });
                // remove status text from the section title item
                item.updateForDevice(null);
            }
        }
    },

    _readDevices: function() {
        let devices = this._client.get_devices() || [ ];
        for (let i = 0; i < devices.length; ++i) {
            this._deviceAdded(this._client, devices[i]);
        }
    },

    _notifyForDevice: function(device, iconName, title, text, urgency) {
        if (device._notification)
            device._notification.destroy();

        /* must call after destroying previous notification,
           or this._source will be cleared */
        this._ensureSource();

        let icon = new St.Icon({ icon_name: iconName,
                                 icon_type: St.IconType.SYMBOLIC,
                                 icon_size: this._source.ICON_SIZE
                               });
        device._notification = new MessageTray.Notification(this._source, title, text,
                                                            { icon: icon });
        device._notification.setUrgency(urgency);
        device._notification.setTransient(true);
        device._notification.connect('destroy', function() {
            device._notification = null;
        });
        this._source.notify(device._notification);
    },

    _deviceAdded: function(client, device) {
        if (device._delegate) {
            // already seen, not adding again
            return;
        }
        let wrapperClass = this._dtypes[device.get_device_type()];
        if (wrapperClass) {
            let wrapper = new wrapperClass(this._client, device, this._connections);

            wrapper._activationFailedId = wrapper.connect('activation-failed', Lang.bind(this, function(device, reason) {
                // XXX: nm-applet has no special text depending on reason
                // but I'm not sure of this generic message
                this._notifyForDevice(device, 'network-error',
                                      _("Connection failed"),
                                      _("Activation of network connection failed"),
                                     MessageTray.Urgency.HIGH);
            }));
            wrapper._deviceStateChangedId = wrapper.connect('state-changed', Lang.bind(this, function(dev) {
                this._syncSectionTitle(dev.category);
            }));
            wrapper._destroyId = wrapper.connect('destroy', function(wrapper) {
                wrapper.disconnect(wrapper._activationFailedId);
                wrapper.disconnect(wrapper._deviceStateChangedId);
                wrapper.disconnect(wrapper._destroyId);
            });
            let section = this._devices[wrapper.category].section;
            let devices = this._devices[wrapper.category].devices;

            section.addMenuItem(wrapper.section, 1);
            section.addMenuItem(wrapper.statusItem, 1);
            devices.push(wrapper);

            this._syncSectionTitle(wrapper.category);
        } else
            log('Unknown network device type, is ' + device.get_device_type());
    },

    _deviceRemoved: function(client, device) {
        if (!device._delegate) {
            log('Removing a network device that was not added');
            return;
        }

        let wrapper = device._delegate;
        wrapper.destroy();

        let devices = this._devices[wrapper.category].devices;
        let pos = devices.indexOf(wrapper);
        devices.splice(pos, 1);

        this._syncSectionTitle(wrapper.category);
    },

    _syncActiveConnections: function() {
        let closedConnections = [ ];
        let newActiveConnections = this._client.get_active_connections() || [ ];
        for (let i = 0; i < this._activeConnections.length; i++) {
            let a = this._activeConnections[i];
            if (newActiveConnections.indexOf(a) == -1) // connection is removed
                closedConnections.push(a);
        }

        for (let i = 0; i < closedConnections.length; i++) {
            let active = closedConnections[i];
            if (active._primaryDevice) {
                active._primaryDevice.setActiveConnection(null);
                active._primaryDevice = null;
            }
            if (active._inited) {
                active.disconnect(active._notifyStateId);
                //active.disconnect(active._notifyDefaultId);
                //active.disconnect(active._notifyDefault6Id);
                active._inited = false;
            }
        }

        this._activeConnections = newActiveConnections;
        this._mainConnection = null;
        let activating = null;
        let activated = null;
        let default_ip4 = null;
        let default_ip6 = null;
        for (let i = 0; i < this._activeConnections.length; i++) {
            let a = this._activeConnections[i];
            if (!a._inited) {
                //a._notifyDefaultId = a.connect('notify::default', Lang.bind(this, this._updateIcon));
                //a._notifyDefault6Id = a.connect('notify::default6', Lang.bind(this, this._updateIcon));
                a._notifyStateId = a.connect('notify::state', Lang.bind(this, this._notifyActivated));

                a._inited = true;
            }

            if (!a._type) {
                a._type = a.connection._type;
                a._section = this._ctypes[a._type];
                if (a._errorLogged) {
                    log('network applet: Found connection for active');
                    a._errorLogged = false;
                }
            }

            if (!a._section){
                // Do not take connections which section is undefined into account
                // For instance, in Mint 18, when the "vpn" is "activated", we sometimes see a "tun" act as the default ipv4 connection.
                continue;
            }

            if (a.state == NM.ActiveConnectionState.ACTIVATED) {
                if (!default_ip4) {
                    // We didn't find the default IPV4 device yet..
                    if (!default_ip6) {
                        // We didn't find the default IPV6 device either so consider this one.
                        activated = a;
                    }
                    else {
                        // We already found the default IPV6 device, so only use this one if it's the default IPV4 device
                        if (a['default']) {
                            activated = a;
                        }
                    }
                }
            }
            if (a.state == NM.ActiveConnectionState.ACTIVATING) {
                activating = a;
            }

            if (a['default']) {
                default_ip4 = a;
            }
            if (a.default6) {
                default_ip6 = a;
            }

            if (!a._primaryDevice) {
                if (a._type != NM.SETTING_VPN_SETTING_NAME) {
                    // find a good device to be considered primary
                    a._primaryDevice = null;
                    let devices = a.get_devices() || [ ];
                    for (let j = 0; j < devices.length; j++) {
                        let d = devices[j];
                        if (d._delegate) {
                            a._primaryDevice = d._delegate;
                            break;
                        }
                    }
                } else
                    a._primaryDevice = this._devices.vpn.device;

                if (a.state == NM.ActiveConnectionState.ACTIVATED &&
                    a._primaryDevice && a._primaryDevice._notification) {
                        a._primaryDevice._notification.destroy();
                        a._primaryDevice._notification = null;
                }
            }

            if (a._primaryDevice) {
                a._primaryDevice.setActiveConnection(a);
            }
        }

        this._mainConnection = activated || activating || default_ip4 || default_ip6 || null;
    },

    _notifyActivated: function(activeConnection) {
        if (activeConnection.state == NM.ActiveConnectionState.ACTIVATED &&
            activeConnection._primaryDevice && activeConnection._primaryDevice._notification) {
                activeConnection._primaryDevice._notification.destroy();
                activeConnection._primaryDevice._notification = null;
        }

        this._updateIcon();
    },

    _readConnections: function() {
        let connections = this._client.get_connections();
        for (let i = 0; i < connections.length; i++) {
            let connection = connections[i];
            if (connection._uuid) {
                // connection was already seen (for example because NetworkManager was restarted)
                continue;
            }
            connection._updatedId = connection.connect('changed', Lang.bind(this, this._updateConnection));

            this._updateConnection(connection);
            this._connections.push(connection);
        }
    },

    _connectionAdded: function(client, connection) {
        if (connection._uuid) {
            // connection was already seen
            return;
        }

        connection._updatedId = connection.connect('changed', Lang.bind(this, this._updateConnection));

        this._updateConnection(connection);
        this._connections.push(connection);

        this._updateIcon();
    },

    _connectionRemoved: function(client, connection) {
        let pos = this._connections.indexOf(connection);
        if (pos != -1)
            this._connections.splice(pos);

        let section = connection._section;

        if (section == NMConnectionCategory.VPN) {
            this._devices.vpn.device.removeConnection(connection);
            if (this._devices.vpn.device.empty)
                this._devices.vpn.section.actor.hide();
        } else if (section != NMConnectionCategory.INVALID) {
            let devices = this._devices[section].devices;
            for (let i = 0; i < devices.length; i++)
                devices[i].removeConnection(connection);
        }

        connection._uuid = null;
        connection.disconnect(connection._updatedId);
    },

    _updateConnection: function(connection) {
        let connectionSettings = connection.get_setting_by_name(NM.SETTING_CONNECTION_SETTING_NAME);
        connection._type = connectionSettings.type;

        connection._section = this._ctypes[connection._type] || NMConnectionCategory.INVALID;
        connection._name = connectionSettings.id;
        connection._uuid = connectionSettings.uuid;
        connection._timestamp = connectionSettings.timestamp;

        let section = connection._section;

        if (connection._section == NMConnectionCategory.INVALID)
            return;
        if (section == NMConnectionCategory.VPN) {
            this._devices.vpn.device.checkConnection(connection);
            this._devices.vpn.section.actor.show();
        } else {
            let devices = this._devices[section].devices;
            for (let i = 0; i < devices.length; i++) {
                devices[i].checkConnection(connection);
            }
        }
    },

    _hideDevices: function() {
        this._devicesHidden = true;

        for (let category in this._devices)
            this._devices[category].section.actor.hide();
    },

    _showNormal: function() {
        if (!this._devicesHidden) // nothing to do
            return;
        this._devicesHidden = false;

        this._statusSection.actor.hide();

        this._syncSectionTitle('wired');
        this._syncSectionTitle('wireless');
        this._syncSectionTitle('wwan');

        if (!this._devices.vpn.device.empty)
            this._devices.vpn.section.actor.show();
    },

    _syncNMState: function() {
        if (!this._client.nm_running) {
            log('NetworkManager is not running, hiding...');
            this.menu.close();
            this.actor.hide();
            return;
        } else
            this.actor.show();

        if (!this._client.networking_enabled) {
            this._setIcon('network-offline');
            this._hideDevices();
            this._statusItem.label.text = _("Networking is disabled");
            this._statusSection.actor.show();
            return;
        }

        this._showNormal();
        this._updateIcon();
    },

    _updateIcon: function() {
        let new_delay = DEFAULT_PERIODIC_UPDATE_FREQUENCY_SECONDS;

        try {
            this._syncActiveConnections();
            let mc = this._mainConnection;

            if (!mc) {
                this._setIcon('network-offline');
                this.set_applet_tooltip(_("No connection"));
            } else if (mc.state == NM.ActiveConnectionState.ACTIVATING) {
                new_delay = FAST_PERIODIC_UPDATE_FREQUENCY_SECONDS;
                switch (mc._section) {
                case NMConnectionCategory.WWAN:
                    this._setIcon('network-cellular-acquiring');
                    this.set_applet_tooltip(_("Connecting to the cellular network..."));
                    break;
                case NMConnectionCategory.WIRELESS:
                    this._setIcon('network-wireless-acquiring');
                    this.set_applet_tooltip(_("Connecting to the wireless network..."));
                    break;
                case NMConnectionCategory.WIRED:
                    this._setIcon('network-wired-acquiring');
                    this.set_applet_tooltip(_("Connecting to the wired network..."));
                    break;
                case NMConnectionCategory.VPN:
                    this._setIcon('network-vpn-acquiring');
                    this.set_applet_tooltip(_("Connecting to the VPN..."));
                    break;
                default:
                    // fallback to a generic connected icon
                    // (it could be a private connection of some other user)
                    this._setIcon('network-wired-acquiring');
                    this.set_applet_tooltip(_("Connecting to the network..."));
                }
            } else {
                let dev;
                let limited_conn = false;
                // let limited_conn = this._correctStateForTunnel(this._client.get_connectivity()) !== NM.ConnectivityState.FULL;

                switch (mc._section) {
                case NMConnectionCategory.WIRELESS:
                    dev = mc._primaryDevice;
                    if (dev) {
                        let ap = dev.device.active_access_point;
                        let mode = dev.device.mode;
                        if (!ap) {
                            if (mode != NM80211Mode.ADHOC) {
                                log('An active wireless connection, in infrastructure mode, involves no access point?');
                                break;
                            }
                            this._setIcon('network-wireless-connected');
                            this.set_applet_tooltip(_("Connected to the wireless network"));
                        } else {
                            if (limited_conn) {
                                this._setIcon('network-wireless-no-route');
                                this.set_applet_tooltip(_("Wireless connection") + ": " + ssidToLabel(ap.get_ssid()) + " " + _("(Limited connectivity)"));
                            } else {
                                this._setIcon('network-wireless-signal-' + signalToIcon(ap.strength));
                                this.set_applet_tooltip(_("Wireless connection") + ": " + ssidToLabel(ap.get_ssid()) + " ("+ ap.strength +"%)");
                            }
                        }
                    } else {
                        log('Active connection with no primary device?');
                    }
                    break;
                case NMConnectionCategory.WIRED:
                    if (limited_conn) {
                        this._setIcon('network-wired-no-route');
                        this.set_applet_tooltip(_("Connected to the wired network") + " " + _("(Limited connectivity)"));

                    } else {
                        this._setIcon('network-wired');
                        this.set_applet_tooltip(_("Connected to the wired network"));
                    }
                    break;
                case NMConnectionCategory.WWAN:
                    dev = mc._primaryDevice;
                    if (!dev) {
                        log('Active connection with no primary device?');
                        break;
                    }
                    if (!dev.mobileDevice) {
                        // this can happen for bluetooth in PAN mode
                        this._setIcon('network-cellular-connected');
                        this.set_applet_tooltip(_("Connected to the cellular network"));
                        break;
                    }

                    if (limited_conn) {
                        this._setIcon('network-cellular-no-route');
                        this.set_applet_tooltip(_("Connected to the cellular network") + " " + _("(Limited connectivity)"));
                    } else {
                        this._setIcon('network-cellular-signal-' + signalToIcon(dev.mobileDevice.signal_quality));
                        this.set_applet_tooltip(_("Connected to the cellular network"));
                    }

                    break;
                case NMConnectionCategory.VPN:
                    // Should we indicate limited connectivity for VPNs like we do above? What if the connection is to
                    // a local machine? Need to test.
                    this._setIcon('network-vpn');
                    this.set_applet_tooltip(_("Connected to the VPN"));
                    break;
                default:
                    // fallback to a generic connected icon
                    // (it could be a private connection of some other user)
                    this._setIcon('network-wired');
                    this.set_applet_tooltip(_("Connected to the network"));
                    break;
                }
            }
        }
        catch (e) {
            global.logError(e);
        }

        if (this.menu.isOpen) {
            return FAST_PERIODIC_UPDATE_FREQUENCY_SECONDS;
        }

        return new_delay;
    },

    _periodicUpdateIcon: function() {
        let new_delay = this._updateIcon();
        this._lastConnectivityState = this._client.get_connectivity();

        // TODO: This can be unreliable with multiple interfaces, and libnm
        // can be flaky with its connectivity state - on one machine of mine,
        // I observed regular switching between full and limited connectivity,
        // when no noticeable change in my actual ability to reach the internet.
        // We might re-implement to be independent of libnm. For now just disable it.
        //
        // if (!this._checkingConnectivity) {
        //     // https://gitlab.freedesktop.org/NetworkManager/NetworkManager/-/issues/476
        //     if (this._v1_28_0) {
        //         this._checkingConnectivity = true;
        //         this._client.check_connectivity_async(null, Lang.bind(this, this._connectivityCheckCallback));
        //     } else
        //     if (this._nm_proxy != null) {
        //         this._checkingConnectivity = true;
        //         this._nm_proxy.CheckConnectivityRemote(Lang.bind(this, this._proxyConnectivityCheckCallback));
        //     }
        // }

        if (this._updateFrequencySeconds != new_delay) {
            this._restartPeriodicUpdateTimer(new_delay);
        } else {
            return GLib.SOURCE_CONTINUE;
        }

        return GLib.SOURCE_REMOVE;
    },

    _correctStateForTunnel(state) {
        if (state !== NM.ConnectivityState.LIMITED) {
            return state;
        }

        // if our primary connection state is 'limited', check if there's a tunnel
        // connection active, and assume 'full' if so - this prevents reporting limited
        // connectivity when something like PIA vpn is active. This could end up reporting
        // a full connection when there isn't one, depending on what the tunnel is for,
        // but NM doesn't seem to provide any way to discern a relationship between a virtual
        // device (tunnel) and the physical device in use. The physical device is always returned
        // as the primary.

        if (this._activeConnections.some(con => con.get_connection_type() === "tun")) {
            return NM.ConnectivityState.FULL;
        }
    },

    _proxyConnectivityCheckCallback(new_state) {
        let state = this._correctStateForTunnel(new_state[0]);

        if (state !== this._lastConnectivityState) {
            this._updateIcon();
        }

        this._checkingConnectivity = false;
    },

    _connectivityCheckCallback(source, result) {
        let new_state = NM.ConnectivityState.UNKNOWN;

        try {
            new_state = source.check_connectivity_finish(result);
        } catch (e) {
            log(e);
        }

        let state = this._correctStateForTunnel(new_state);

        if (state !== this._lastConnectivityState) {
            this._updateIcon();
        }

        this._checkingConnectivity = false;
    },

    _restartPeriodicUpdateTimer: function(new_delay) {
        if (this._periodicTimeoutId > 0) {
            Mainloop.source_remove(this._periodicTimeoutId);
        }

        this._updateFrequencySeconds = new_delay;

        this._periodicTimeoutId = Mainloop.timeout_add_seconds(this._updateFrequencySeconds, Lang.bind(this, this._periodicUpdateIcon));
    },

    _rescanAccessPoints: function() {
        try {
            let devices = this._devices.wireless.devices;

            for (let i = 0; i < devices.length; i++) {
                if (devices[i]._client.wireless_get_enabled()) {
                    devices[i].device.request_scan(null);
                }
            }
        } catch (gerror) {
            if (gerror.code == NM.DeviceError.NOTALLOWED) {
                // NM only allows a rescan every 10 seconds
                return;
            } else {
                log(gerror);
            }
        }
    },

    _onMenuOpenStateChanged: function(popup, open) {
        this._periodicUpdateIcon();

        if (open) {
            this._rescanAccessPoints();
        }
    },

    on_applet_removed_from_panel: function() {
        Main.systrayManager.unregisterRole("network", this.metadata.uuid);
        Main.systrayManager.unregisterRole("nm-applet", this.metadata.uuid);
        Main.keybindingManager.removeHotKey("network-open-" + this.instance_id);
        if (this._periodicTimeoutId){
            Mainloop.source_remove(this._periodicTimeoutId);
        }
    },

};

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonNetworkApplet(metadata, orientation, panel_height, instance_id);
}
