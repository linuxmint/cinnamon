// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;

function SoundManager() {
    this._init();
}

SoundManager.prototype = {
    _init : function() {
        this.keys = ["switch", "close", "map", "minimize", "maximize", "unmaximize", "tile", "login", "plug", "unplug", "notification"];
        this.desktop_keys = ["volume"];
        this.startup_delay = true;
        this.enabled = {};
        this.file = {};
        this.settings = new Gio.Settings({ schema_id: 'org.cinnamon.sounds' });
        this.desktop_settings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.sound' });
        this._cacheSettings();                
        this._cacheDesktopSettings();   
        this.settings.connect("changed", Lang.bind(this, this._cacheSettings));
        this.desktop_settings.connect("changed", Lang.bind(this, this._cacheDesktopSettings));
        Mainloop.timeout_add_seconds(10, Lang.bind(this, function() {
            this.startup_delay = false;
        }));
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
        if (this.startup_delay && sound !== "login")
            return;
        if (this.enabled[sound] && this.file[sound] != "") {
            this.playSoundFile(0, this.file[sound]);
        }
    },

    // Deprecated - this was only used by sound applets for volume notification,
    // but had no effect, as decibal levels were < 0 and always rejected
    // as a result.
    playVolume: function(sound, volume) {
        this.play(sound);
    },

    /* Public methods. */

    playSoundFile: function(id, filename) {
        global.display.get_sound_player().play_from_file
        (
            Gio.File.new_for_path(filename),
            id.toString(),
            null
        );
    },

    playSound: function(id, name) {
        global.display.get_sound_player().play_from_theme
        (
            name,
            id.toString(),
            null
        );
    },
};
