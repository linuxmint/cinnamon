// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const Meta = imports.gi.Meta;

const Util = imports.misc.util;


const STANDARD_TRAY_ICON_IMPLEMENTATIONS = {
    'bluetooth-applet': 'bluetooth',
    'gnome-volume-control-applet': 'volume', // renamed to gnome-sound-applet
                                             // when moved to control center                                                
    'gnome-sound-applet': 'volume',
    'nm-applet': 'network',
    'gnome-power-manager': 'battery',
    'keyboard': 'keyboard',
    'a11y-keyboard': 'a11y',
    'kbd-scrolllock': 'keyboard',
    'kbd-numlock': 'keyboard',
    'kbd-capslock': 'keyboard',
    'ibus-ui-gtk': 'input-method'
};

function StatusIconDispatcher() {
    this._init();
}

StatusIconDispatcher.prototype = {
    _init: function() {
        if (Meta.is_wayland_compositor()) {
            return;
        }

        this._traymanager = new Cinnamon.TrayManager();
        this._traymanager.connect('tray-icon-added', Lang.bind(this, this._onTrayIconAdded));
        this._traymanager.connect('tray-icon-removed', Lang.bind(this, this._onTrayIconRemoved));

        // Yet-another-Ubuntu-workaround - we have to kill their
        // app-indicators, so that applications fall back to normal
        // status icons
        // http://bugzilla.gnome.org/show_bug.cgi=id=621382
        Util.killall('indicator-application-service');
    },
    
    redisplay: function() {
        this.emit('before-redisplay');
        this._traymanager.redisplay();
        this.emit('after-redisplay');
    },

    start: function(themeWidget) {
        this._traymanager.manage_screen(themeWidget);
    },

    set_tray_orientation: function(orientation) {
        this._traymanager.set_orientation(orientation);
    },

    _onTrayIconAdded: function(o, icon) {
        let wmClass = (icon.wm_class || 'unknown').toLowerCase();
        let role = STANDARD_TRAY_ICON_IMPLEMENTATIONS[wmClass];
        if (!role) role = wmClass;        
        this.emit('status-icon-added', icon, role);
    },

    _onTrayIconRemoved: function(o, icon) {
        this.emit('status-icon-removed', icon);
    }
};
Signals.addSignalMethods(StatusIconDispatcher.prototype);
