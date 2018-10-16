// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-
// Load shell theme from ~/.themes/name/gnome-shell

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Main = imports.ui.main;
const Signals = imports.signals;

const SETTINGS_SCHEMA = 'org.cinnamon.theme';
const SETTINGS_KEY = 'name';

function ThemeManager() {
    this._init();
}

ThemeManager.prototype = {
    _init: function() {
        this._settings = new Gio.Settings({ schema_id: SETTINGS_SCHEMA });
        this._changedId = this._settings.connect('changed::'+SETTINGS_KEY, Lang.bind(this, this._changeTheme));
        this._changeTheme();
    },    
    
    _findTheme: function(themeName) {
        /* This follows the same order of precedence that Gtk uses for icon and widget themes. */

        let dirs = [GLib.build_filenamev([GLib.get_user_data_dir(), 'themes', themeName, 'cinnamon']),
                    GLib.build_filenamev([GLib.get_home_dir(), '.themes', themeName, 'cinnamon'])];

        let sys_dirs = GLib.get_system_data_dirs()

        for (let i = 0; i < sys_dirs.length; i++) {
            dirs.push(GLib.build_filenamev([sys_dirs[i], 'themes', themeName, 'cinnamon']));
        }

        let themeDirectory = null;

        for (let i = 0; i < dirs.length; i++) {
            let file = Gio.file_new_for_path(GLib.build_filenamev([dirs[i], 'cinnamon.css']));
            if (file.query_exists(null)) {
                themeDirectory = dirs[i];
                break;
            }
        }

        return themeDirectory;
    },

    _changeTheme: function() {
        let iconTheme = Gtk.IconTheme.get_default();
        if (this.themeDirectory) {
            let searchPath = iconTheme.get_search_path();
            for (let i = 0; i < searchPath.length; i++) {
                if (searchPath[i] == this.themeDirectory) {
                    searchPath.splice(i,1);
                    iconTheme.set_search_path(searchPath);
                    break;
                }
            }
        }
        let _stylesheet = null;
        let _themeName = this._settings.get_string(SETTINGS_KEY);        

        if (_themeName) {
            this.themeDirectory = this._findTheme(_themeName);
            if (this.themeDirectory) _stylesheet = GLib.build_filenamev([this.themeDirectory, 'cinnamon.css']);
        }

        if (_stylesheet)
            global.log('loading user theme: ' + _stylesheet);
        else
            global.log('loading default theme');
        Main.setThemeStylesheet(_stylesheet);
        Main.loadTheme();
        if (this.themeDirectory) {
            iconTheme.append_search_path(this.themeDirectory);
            global.log('added icon directory: ' + this.themeDirectory);
        }
        this.emit('theme-set');
    }
};
Signals.addSignalMethods(ThemeManager.prototype);
