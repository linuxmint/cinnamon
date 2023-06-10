// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Tweener = imports.ui.tweener;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Main = imports.ui.main;

const SETTINGS_SCHEMA = 'org.cinnamon';
const SETTINGS_KEY = 'startup-icon-name';

function Animation(primaryMonitorInfo, onComplete) {
    this._init(primaryMonitorInfo, onComplete);
}

Animation.prototype = {
    _init: function(primaryMonitorInfo, onComplete) {
        this.onCompleteFunc = onComplete;
        this.primaryMonitorInfo = primaryMonitorInfo;

        this._icon_name = global.settings.get_string(SETTINGS_KEY);

        this.failed = false;

        this.shroud = null;
        this.logo = null;

        this.prepare()
    },

    prepare: function() {
        try {
            this.shroud = new Clutter.Actor({
                reactive: false,
                background_color: new Clutter.Color( { red: 0, green: 0, blue: 0, alpha: 255} )
            });

            let constraint = new Clutter.BindConstraint({ source: global.stage, coordinate: Clutter.BindCoordinate.ALL });
            this.shroud.add_constraint(constraint);

            Main.layoutManager.addChrome(this.shroud);

            let icon_size = 128 * global.ui_scale;
            let x = this.primaryMonitorInfo.x + this.primaryMonitorInfo.width / 2.0;
            let y = this.primaryMonitorInfo.y + this.primaryMonitorInfo.height / 2.0;

            if (this._icon_name) {
                let gicon = null;

                if (this._icon_name.includes("/")) {
                    if (GLib.file_test(this._icon_name, GLib.FileTest.EXISTS)) {
                        let file = Gio.File.new_for_path(this._icon_name);
                        gicon = new Gio.FileIcon({file: file});
                    } else {
                        global.logError("Startup logo image path invalid or file does not exist (%s)".format(this._icon_name));
                    }
                } else {
                    if (Gtk.IconTheme.get_default().has_icon(this._icon_name)) {
                        gicon = new Gio.ThemedIcon({ name: this._icon_name });
                    } else {
                        global.logError("Startup logo icon name invalid or does not exist in current theme (%s)".format(this._icon_name));
                    }
                }

                if (gicon) {
                    this.logo = St.TextureCache.get_default().load_gicon(null, gicon, icon_size);
                    this.logo.x = x - (icon_size / 2);
                    this.logo.y = y - (icon_size / 2);
                    Main.layoutManager.addChrome(this.logo);
                } else {
                    global.logError("Startup logo could not be loaded");
                }
            }
        } catch (e) {
            global.logError("Could not prepare startup animation: %s".format(e));

            this.failed = true;
        }
    },

    run: function() {
        if (this.failed) {
            this._finished();
            return;
        }

        if (!this.logo) {
            this._fade_shroud();
            return;
        }

        try {
            Tweener.addTween(this.logo,
                             { time: .75,
                               opacity: 0,
                               transition: 'easeInExpo',
                               onComplete: this._fade_shroud,
                               onCompleteScope: this });
        } catch (e) {
            this._onError(e);
        }
    },

    _fade_shroud: function() {
        try {
            Tweener.addTween(this.shroud,
                             { time: .75,
                               transition: 'easeNone',
                               opacity: 0,
                               onComplete: this._finished,
                               onCompleteScope: this });
        } catch (e) {
            this._onError(e);
        }
    },

    _onError: function(e) {
        global.logError("Could not run startup animation: %s".format(e));
        this._finished();
    },

    _finished: function() {
        if (this.shroud) {
            Main.layoutManager.removeChrome(this.shroud);
            this.shroud = null;
        }

        if (this.logo) {
            Main.layoutManager.removeChrome(this.logo);
            this.logo = null;
        }

        this.onCompleteFunc();
    }
};
