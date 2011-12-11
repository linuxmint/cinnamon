// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const DBus = imports.dbus;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const Signals = imports.signals;

// The following are not the complete interfaces, just the methods we need
// (or may need in the future)

const ModemGsmNetworkInterface = {
    name: 'org.freedesktop.ModemManager.Modem.Gsm.Network',
    methods: [
        { name: 'GetRegistrationInfo', inSignature: '', outSignature: 'uss' },
        { name: 'GetSignalQuality', inSignature: '', outSignature: 'u' }
    ],
    properties: [
        { name: 'AccessTechnology', signature: 'u', access: 'read' }
    ],
    signals: [
        { name: 'SignalQuality', inSignature: 'u' },
        { name: 'RegistrationInfo', inSignature: 'uss' }
    ]
};
const ModemGsmNetworkProxy = DBus.makeProxyClass(ModemGsmNetworkInterface);

const ModemCdmaInterface = {
    name: 'org.freedesktop.ModemManager.Modem.Cdma',
    methods: [
        { name: 'GetSignalQuality', inSignature: '', outSignature: 'u' },
        { name: 'GetServingSystem', inSignature: '', outSignature: 'usu' }
    ],
    signals: [
        { name: 'SignalQuality', inSignature: 'u' }
    ]
};
const ModemCdmaProxy = DBus.makeProxyClass(ModemCdmaInterface);

let _providersTable;
function _getProvidersTable() {
    if (_providersTable)
        return _providersTable;
    let [providers, countryCodes] = Shell.mobile_providers_parse();
    return _providersTable = providers;
}

function ModemGsm() {
    this._init.apply(this, arguments);
}

ModemGsm.prototype = {
    _init: function(path) {
        this._proxy = new ModemGsmNetworkProxy(DBus.system, 'org.freedesktop.ModemManager', path);

        this.signal_quality = 0;
        this.operator_name = null;

        // Code is duplicated because the function have different signatures
        this._proxy.connect('SignalQuality', Lang.bind(this, function(proxy, quality) {
            this.signal_quality = quality;
            this.emit('notify::signal-quality');
        }));
        this._proxy.connect('RegistrationInfo', Lang.bind(this, function(proxy, status, code, name) {
            this.operator_name = this._findOperatorName(name, code);
            this.emit('notify::operator-name');
        }));
        this._proxy.GetRegistrationInfoRemote(Lang.bind(this, function(result, err) {
            if (err) {
                log(err);
                return;
            }

            let [status, code, name] = result;
            this.operator_name = this._findOperatorName(name, code);
            this.emit('notify::operator-name');
        }));
        this._proxy.GetSignalQualityRemote(Lang.bind(this, function(result, err) {
            if (err) {
                // it will return an error if the device is not connected
                this.signal_quality = 0;
            } else {
                let [quality] = result;
                this.signal_quality = quality;
            }
            this.emit('notify::signal-quality');
        }));
    },

    _findOperatorName: function(name, opCode) {
        if (name.length != 0 && (name.length > 6 || name.length < 5)) {
            // this looks like a valid name, i.e. not an MCCMNC (that some
            // devices return when not yet connected
            return name;
        }
        if (isNaN(parseInt(name))) {
            // name is definitely not a MCCMNC, so it may be a name
            // after all; return that
            return name;
        }

        let needle;
        if (name.length == 0 && opCode)
            needle = opCode;
        else if (name.length == 6 || name.length == 5)
            needle = name;
        else // nothing to search
            return null;

        return this._findProviderForMCCMNC(needle);
    },

    _findProviderForMCCMNC: function(needle) {
        let table = _getProvidersTable();
        let needlemcc = needle.substring(0, 3);
        let needlemnc = needle.substring(3, needle.length);

        let name2, name3;
        for (let iter in table) {
            let providers = table[iter];

            // Search through each country's providers
            for (let i = 0; i < providers.length; i++) {
                let provider = providers[i];

                // Search through MCC/MNC list
                let list = provider.get_gsm_mcc_mnc();
                for (let j = 0; j < list.length; j++) {
                    let mccmnc = list[j];

                    // Match both 2-digit and 3-digit MNC; prefer a
                    // 3-digit match if found, otherwise a 2-digit one.
                    if (mccmnc.mcc != needlemcc)
                        continue;  // MCC was wrong

                    if (!name3 && needle.length == 6 && needlemnc == mccmnc.mnc)
                        name3 = provider.name;

                    if (!name2 && needlemnc.substring(0, 2) == mccmnc.mnc.substring(0, 2))
                        name2 = provider.name;

                    if (name2 && name3)
                        break;
                }
            }
        }

        return name3 || name2 || null;
    }
}
Signals.addSignalMethods(ModemGsm.prototype);

function ModemCdma() {
    this._init.apply(this, arguments);
}

ModemCdma.prototype = {
    _init: function(path) {
        this._proxy = new ModemCdmaProxy(DBus.system, 'org.freedesktop.ModemManager', path);

        this.signal_quality = 0;
        this.operator_name = null;
        this._proxy.connect('SignalQuality', Lang.bind(this, function(proxy, quality) {
            this.signal_quality = quality;
            this.emit('notify::signal-quality');

            // receiving this signal means the device got activated
            // and we can finally call GetServingSystem
            if (this.operator_name == null)
                this._refreshServingSystem();
        }));
        this._proxy.GetSignalQualityRemote(Lang.bind(this, function(result, err) {
            if (err) {
                // it will return an error if the device is not connected
                this.signal_quality = 0;
            } else {
                let [quality] = result;
                this.signal_quality = quality;
            }
            this.emit('notify::signal-quality');
        }));
    },

    _refreshServingSystem: function() {
        this._proxy.GetServingSystemRemote(Lang.bind(this, function(result, err) {
            if (err) {
                // it will return an error if the device is not connected
                this.operator_name = null;
            } else {
                let [bandClass, band, id] = result;
                if (name.length > 0)
                    this.operator_name = this._findProviderForSid(id);
                else
                    this.operator_name = null;
            }
            this.emit('notify::operator-name');
        }));
    },

    _findProviderForSid: function(sid) {
        if (sid == 0)
            return null;

        let table = _getProvidersTable();

        // Search through each country
        for (let iter in table) {
            let providers = table[iter];

            // Search through each country's providers
            for (let i = 0; i < providers.length; i++) {
                let provider = providers[i];
                let cdma_sid = provider.get_cdma_sid();

                // Search through CDMA SID list
                for (let j = 0; j < cdma_sid.length; j++) {
                    if (cdma_sid[j] == sid)
                        return provider.name;
                }
            }
        }

        return null;
    }
};
Signals.addSignalMethods(ModemCdma.prototype);
