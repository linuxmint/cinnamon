// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-
// Load shell theme from ~/.themes/name/gnome-shell

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
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
        this._settings = new Gio.Settings({ schema: SETTINGS_SCHEMA });
        this._changedId = this._settings.connect('changed::'+SETTINGS_KEY, Lang.bind(this, this._changeTheme));
        this._changeTheme();
    },    
    
    _findTheme: function(themeName, cssPath) {
        let stylesheet = null;
        let _userCssStylesheet = GLib.get_home_dir() + '/.themes/' + themeName + cssPath;
        let file = Gio.file_new_for_path(_userCssStylesheet);
        if (file.query_exists(null))
            stylesheet = _userCssStylesheet;
        else {
            let sysdirs = GLib.get_system_data_dirs();
            for (let i = 0; i < sysdirs.length; i++) {
                _userCssStylesheet = sysdirs[i] + '/themes/' + themeName + cssPath;
                let file = Gio.file_new_for_path(_userCssStylesheet);
                if (file.query_exists(null)) {
                    stylesheet = _userCssStylesheet;
                    break;
                }
            }
        }        
        return stylesheet;
    },

    _changeTheme: function() {
        let _stylesheet = null;
        let _themeName = this._settings.get_string(SETTINGS_KEY);        
    
        if (_themeName) {
            _stylesheet = this._findTheme(_themeName, '/cinnamon/cinnamon.css');
        }

        if (_stylesheet)
            global.log('loading user theme: ' + _stylesheet);
        else
            global.log('loading default theme');
        Main.setThemeStylesheet(_stylesheet);
        Main.loadTheme();
        this.emit("theme-set");
    }
};
Signals.addSignalMethods(ThemeManager.prototype);
