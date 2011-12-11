// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const DBus = imports.dbus;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const Signals = imports.signals;

const FprintManagerIface = {
    name: 'net.reactivated.Fprint.Manager',
    methods: [{ name: 'GetDefaultDevice',
                inSignature: '',
                outSignature: 'o' }]
};

function FprintManager() {
    this._init();
};

FprintManager.prototype = {
    _init: function() {
        DBus.system.proxifyObject(this,
                                  'net.reactivated.Fprint',
                                  '/net/reactivated/Fprint/Manager');
    }
};
DBus.proxifyPrototype(FprintManager.prototype, FprintManagerIface);
