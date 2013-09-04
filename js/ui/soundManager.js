// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;

function SoundManager() {
    this._init();
}

SoundManager.prototype = {

    _init : function() {
        this.keys = ["switch", "close", "map", "minimize", "maximize", "unmaximize", "tile", "login", "logout"];
        this.enabled = {};
        this.file = {};
        this.settings = new Gio.Settings({ schema: 'org.cinnamon.sounds' });
        this._cacheSettings();                
        this.settings.connect("changed", Lang.bind(this, this._cacheSettings));
    },    

    _cacheSettings: function() {
        for (var i in this.keys) {
            let key = this.keys[i];
            this.enabled[key] = this.settings.get_boolean(key + "-enabled");
            this.file[key] = this.settings.get_string(key + "-file");
        }        
    },

    play: function(sound) {
        if (this.enabled[sound] && this.file[sound] != "") {
            global.play_sound_file(0, this.file[sound]);
        }
    }
    
};
