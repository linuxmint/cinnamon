// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;

function SoundManager() {
    this._init();
}

SoundManager.prototype = {

    _init : function() {
        this.keys = ["switch", "close", "map", "minimize", "maximize", "unmaximize", "tile", "login", "plug", "unplug"];
        this.desktop_keys = ["volume"];
        this.enabled = {};
        this.file = {};
        this.settings = new Gio.Settings({ schema: 'org.cinnamon.sounds' });
        this.desktop_settings = new Gio.Settings({ schema: 'org.cinnamon.desktop.sound' });
        this._cacheSettings();                
        this._cacheDesktopSettings();   
        this.settings.connect("changed", Lang.bind(this, this._cacheSettings));
        this.settings.connect("changed", Lang.bind(this, this._cacheDesktopSettings));
    },    

    _cacheSettings: function() {
        for (var i in this.keys) {
            let key = this.keys[i];
            this.enabled[key] = this.settings.get_boolean(key + "-enabled");
            this.file[key] = this.settings.get_string(key + "-file");
        }        
    },

    _cacheDesktopSettings: function() {
        for (var i in this.desktop_keys) {
            let key = this.desktop_keys[i];
            this.enabled[key] = this.desktop_settings.get_boolean(key + "-sound-enabled");
            this.file[key] = this.desktop_settings.get_string(key + "-sound-file");
        }        
    },

    play: function(sound) {
        if (this.enabled[sound] && this.file[sound] != "") {
            global.play_sound_file(0, this.file[sound]);
        }
    }
    
};
