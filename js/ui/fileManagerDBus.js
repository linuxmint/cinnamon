// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
const Signals = imports.signals;
const DBus = imports.dbus;
const Main = imports.ui.main;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;

const FILEMAN_BUS_NAME = 'org.gnome.Nautilus.WindowInfo';
const FILEMAN_INTERFACE_NAME = 'org.gnome.Nautilus.WindowInfo.posix'; // interface
const FILEMAN_SERVICE_PATH_PREFIX = '/org/gnome/Nautilus/windows/';

const FileManagerIface = {
    name: FILEMAN_INTERFACE_NAME,
    methods: [
                { name: 'getCwd', inSignature: '', outSignature: 's' },
                { name: 'getSelection', inSignature: '', outSignature: 'as' }
             ],
    signals: [],
    properties: []
};

function CinnamonFileManager(windowId) {
    this._init(windowId);
}

CinnamonFileManager.prototype = {
    _init: function(windowId) {
        let WINDOW_SERVICE_PATH = FILEMAN_SERVICE_PATH_PREFIX + windowId;
        DBus.session.exportObject(WINDOW_SERVICE_PATH, this);
        DBus.session.proxifyObject(this, FILEMAN_BUS_NAME, WINDOW_SERVICE_PATH);
    }
};

DBus.proxifyPrototype(CinnamonFileManager.prototype, FileManagerIface);

function FileManager(windowId) {
    this._init(windowId);
}

FileManager.prototype = {
    _init: function(windowId) {
        this._fm = new CinnamonFileManager(windowId);
    },
    getCwd: function(fn) {
        if (!fn) fn = function(v) {
            global.log(v);
        }
        
        this._fm.getCwdRemote(fn);
    },
    getSelection: function(fn) {
        if (!fn) fn = function(v) {
            global.log(v);
        }
        
        this._fm.getSelectionRemote(fn);
    }
};
Signals.addSignalMethods(FileManager.prototype);

DBus.conformExport(FileManager.prototype, FileManagerIface);

let fileManagerBusses = {};

function GetForWindow(windowId) {
    if (!fileManagerBusses[windowId]) {
        fileManagerBusses[windowId] = new FileManager(windowId);
    }
    
    return fileManagerBusses[windowId];
}

function Copy(sourceFile, destFile) {
    sourceFile.copy(destFile, 0, null, function(){});
}

function MakeExecutable(filePath) {
    Util.spawnCommandLine("chmod +x \""+filePath+"\"");
}
