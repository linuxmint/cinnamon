// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Util = imports.misc.util;

function BackgroundManager() {
    this._init();
}

BackgroundManager.prototype = {

    _init: function() {
        this.screen_signal_timeout_id = 0;                    
        let display;
        let n_screens;

        display = Gdk.Display.get_default();
        n_screens = display.get_n_screens()

        for (let i = 0; i < n_screens; ++i) {
            let screen = display.get_screen(i);
            screen.connect("monitors-changed", Lang.bind(this, function() {
                if (this.screen_signal_timeout_id != 0)
                    Mainloop.source_remove(this.screen_signal_timeout_id);
                this.screen_signal_timeout_id = Mainloop.timeout_add(1000, Lang.bind(this, this.screen_signal_timeout_cb));
            }));
            screen.connect("size-changed", Lang.bind(this, function() {
                if (this.screen_signal_timeout_id != 0)
                    Mainloop.source_remove(this.screen_signal_timeout_id);
                this.screen_signal_timeout_id = Mainloop.timeout_add(1000, Lang.bind(this, this.screen_signal_timeout_cb))
            }));
        }    
    },
    
    screen_signal_timeout_cb: function() {
        this.screen_signal_timeout_id = 0
        Util.spawnCommandLine("killall cinnamon-background-worker");
        return false;
    }   
    
};
