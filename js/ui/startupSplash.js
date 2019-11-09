// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const FileUtils = imports.misc.fileUtils;


const SETTINGS_SCHEMA = 'org.cinnamon';
const SETTINGS_KEY = 'startup-splash-name';

function StartupSplash(primaryMonitor, onComplete) {
    this._init(primaryMonitor, onComplete);
}

StartupSplash.prototype = {
    _init: function(primaryMonitor, onComplete) {
        this.onCompleteFunc = onComplete;
        this.primaryMonitor = primaryMonitor;

        this._settings = new Gio.Settings({ schema_id: SETTINGS_SCHEMA });

        this.scriptObj = null;
        this._loadScript();
    },

    _loadScript: function() {
        let settings = new Gio.Settings({ schema_id: SETTINGS_SCHEMA });

        try {
            const LoadableModule = eval('imports.splash.' + settings.get_string(SETTINGS_KEY) + '.script;');
            this.scriptObj = new LoadableModule.Splash(this.primaryMonitor, this.onCompleteFunc);
        } catch (e) {
            global.logError("Could not load splash: " + e);

            const FallbackModule = imports.splash.cinnamon.script;
            this.scriptObj = new FallbackModule.Splash(this.primaryMonitor, this.onCompleteFunc);
        }
    },

    prepareSplash: function() {
        try {
            this.scriptObj.setup();
        } catch (e) {
            global.logError("Could not prepare splash: " + e);
        }
    },

    runSplash: function() {
        try {
            this.scriptObj.run();
        } catch (e) {
            global.logError("Could not run splash: " + e);
        }
    }
};
