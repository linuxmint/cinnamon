// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;
const Desktop = imports.gi.CinnamonDesktop;
const Mainloop = imports.mainloop;

function BackgroundManager() {
    this._init();
}

BackgroundManager.prototype = {

    _init: function() {
        this.screen_signal_timeout_id = 0;
        this._string_keys = ["color-shading-type", "picture-options", "picture-uri", "primary-color", "secondary-color"];
        this._int_keys = ["picture-opacity"];

        let schema = Gio.SettingsSchemaSource.get_default();
        if (schema.lookup("org.gnome.desktop.background", true)) {
            this._gnomeSettings = new Gio.Settings({ schema: 'org.gnome.desktop.background' });
            this._changedId = this._gnomeSettings.connect('changed', Lang.bind(this, this._onGnomeSettingsChanged));
        }

        this._cinnamonSettings = new Gio.Settings({ schema: 'org.cinnamon.desktop.background' }); 

        this.bg = new Desktop.BG();
        this.bg.connect("changed", Lang.bind(this, this.draw_background));
        this.bg.connect("transitioned", Lang.bind(this, this.draw_background));

        this.connect_screen_signals();

        this._cinnamonSettings.connect("changed", Lang.bind(this, this.on_settings_changed_event_cb));

        this.bg.load_from_preferences(this._cinnamonSettings);
        this.draw_background();
    },

    draw_background: function() {
        let display;
        let n_screens;
        display = Gdk.Display.get_default();
        n_screens = display.get_n_screens();

        for (let i = 0; i < n_screens; ++i) {
            let screen = display.get_screen(i);
            let root_window = screen.get_root_window();
            this.bg.create_and_set_surface_as_root(root_window, screen);
        }
    },

    on_settings_changed_event_cb: function() {
        this.bg.load_from_preferences(this._cinnamonSettings);
        this.bg.set_accountsservice_background(this.bg.get_filename());
    },

    screen_signal_timeout_cb: function() {
        this.screen_signal_timeout_id = 0
        this.draw_background();
        return false;
    },

    connect_screen_signals: function() {
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
    
    _onGnomeSettingsChanged: function() {
        for (var i in this._string_keys) {
            let key = this._string_keys[i];
            let gnomeValue = this._gnomeSettings.get_string(key);
            if (this._cinnamonSettings.get_string(key) != gnomeValue) {
                this._cinnamonSettings.set_string(key, gnomeValue);
            }
        }        
        for (var i in this._int_keys) {
            let key = this._int_keys[i];
            let gnomeValue = this._gnomeSettings.get_int(key);
            if (this._cinnamonSettings.get_int(key) != gnomeValue) {
                this._cinnamonSettings.set_int(key, gnomeValue);
            }
        }
    }
};
