// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Shell = imports.gi.Shell;
const Signals = imports.signals;

const MessageTray = imports.ui.messageTray;
const NotificationDaemon = imports.ui.notificationDaemon;
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
        this._traymanager = new Shell.TrayManager();
        this._traymanager.connect('tray-icon-added', Lang.bind(this, this._onTrayIconAdded));
        this._traymanager.connect('tray-icon-removed', Lang.bind(this, this._onTrayIconRemoved));

        // Yet-another-Ubuntu-workaround - we have to kill their
        // app-indicators, so that applications fall back to normal
        // status icons
        // http://bugzilla.gnome.org/show_bug.cgi=id=621382
        Util.killall('indicator-application-service');
    },

    start: function(themeWidget) {
        this._traymanager.manage_stage(global.stage, themeWidget);
    },

    _onTrayIconAdded: function(o, icon) {
        let wmClass = (icon.wm_class || 'unknown').toLowerCase();
        let role = STANDARD_TRAY_ICON_IMPLEMENTATIONS[wmClass];
        if (role)
            this.emit('status-icon-added', icon, role);
        else
            this.emit('message-icon-added', icon);
    },

    _onTrayIconRemoved: function(o, icon) {
        let wmClass = (icon.wm_class || 'unknown').toLowerCase();
        let role = STANDARD_TRAY_ICON_IMPLEMENTATIONS[wmClass];
        if (role)
            this.emit('status-icon-removed', icon);
        else
            this.emit('message-icon-removed', icon);
    }
};
Signals.addSignalMethods(StatusIconDispatcher.prototype);
