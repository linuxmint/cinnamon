// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;

const BLOCKED_NAMES = [
    'org.gnome.ScreenSaver',
    'org.mate.ScreenSaver',
];

var NameBlocker = class NameBlocker {
    constructor() {
        this._watchIds = [];

        for (let name of BLOCKED_NAMES) {
            if (global.settings.get_boolean('debug-screensaver'))
                global.log(`Screensaver blocker: Watching for name: '${name}'`);

            let id = Gio.bus_watch_name(
                Gio.BusType.SESSION,
                name,
                Gio.BusNameWatcherFlags.NONE,
                (connection, busName, nameOwner) => this._onNameAppeared(connection, busName, nameOwner),
                null
            );
            this._watchIds.push(id);
        }
    }

    _onNameAppeared(connection, busName, nameOwner) {
        if (global.settings.get_boolean('debug-screensaver'))
            global.log(`Screensaver blocker: killing competing screensaver '${busName}' (owner: ${nameOwner})`);

        connection.call(
            busName,
            '/' + busName.replace(/\./g, '/'),
            busName,
            'Quit',
            null,
            null,
            Gio.DBusCallFlags.NO_AUTO_START,
            -1,
            null,
            null
        );
    }

    destroy() {
        for (let id of this._watchIds) {
            Gio.bus_unwatch_name(id);
        }
        this._watchIds = [];
    }
};
