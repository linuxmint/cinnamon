// Run without a Cinnamon session: node tests/unit/message-tray-no-monitor.cjs
// Exercise the checkout's MessageTray implementation; only its desktop dependencies
// and actors are replaced, so _onNotify/_updateState/_showNotification run unchanged.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function addSignalMethods(proto) {
    proto.connect = function(name, callback) {
        this._signalHandlers ??= [];
        this._signalHandlers.push({ name, callback });
        return this._signalHandlers.length;
    };
    proto.disconnect = function() {};
    proto.emit = function(name, ...args) {
        for (const handler of this._signalHandlers ?? [])
            if (handler.name === name)
                handler.callback(this, ...args);
    };
}

class Actor {
    constructor() { this.visible = true; }
    connect() { return 1; }
    disconnect() {}
    hide() { this.visible = false; }
    show() { this.visible = true; }
    ease(params) { this.eased = params; }
    remove_all_transitions() {}
}

const layoutManager = {
    monitors: [],
    primaryMonitor: undefined,
    get currentMonitor() { return this.monitors[0]; },
    addChrome() {},
    _chrome: { modifyActorParams() {} }
};
addSignalMethods(layoutManager);

const sounds = [];
const watcher = { connect() {} };
const settings = {
    'display-notifications': true,
    'bottom-notifications': false,
    'fullscreen-notifications': false,
    'notification-screen-display': 'primary-screen',
    'notification-duration': 4
};

const source = process.env.MESSAGE_TRAY_SOURCE || path.resolve(__dirname,
    '../../js/ui/messageTray.js');
const context = vm.createContext({
    imports: {
        gi: {
            Clutter: { AnimationMode: {} }, GLib: {}, Gtk: {}, Atk: {}, Pango: {}, Cinnamon: {},
            Gio: { Settings: class { connect() {} get_boolean(key) { return settings[key]; }
                get_string(key) { return settings[key]; } get_int(key) { return settings[key]; } } },
            St: { Bin: Actor }
        },
        lang: { bind: (object, callback) => callback.bind(object) },
        mainloop: { timeout_add: () => 1, source_remove() {} },
        signals: { addSignalMethods },
        misc: {
            gnomeSession: {
                PresenceStatus: { AVAILABLE: 0, IDLE: 3, BUSY: 2 },
                Presence: class { connectSignal() {} }
            },
            params: {}, util: {}
        },
        ui: {
            main: {
                layoutManager,
                overview: watcher,
                expo: watcher,
                panelManager: { getPanel: () => null },
                soundManager: { play: name => sounds.push(name) }
            },
            popupMenu: {}, appletManager: {}
        }
    },
    global: { get_pointer: () => [0, 0, 0] }
});
vm.runInContext(fs.readFileSync(source, 'utf8'), context, { filename: source });

function notification() {
    const notification = {
        urgency: context.Urgency.NORMAL,
        silent: false,
        actor: new Actor(),
        _table: { width: 300, get_theme_node: () => ({ get_length: () => 10 }) },
        destroy() {}
    };
    addSignalMethods(notification);
    return notification;
}

const tray = new context.MessageTray();
const appSource = new context.Source('test');
tray.add(appSource);

// All monitors are gone, e.g. the only display was switched off or unplugged.
const first = notification();
appSource.notify(first);
assert.deepEqual(Array.from(tray._notificationQueue), [first], 'notification stays queued without a monitor');
assert.equal(tray._notificationState, context.State.HIDDEN);
assert.equal(tray._notification, null);
assert.deepEqual(sounds, []);

const second = notification();
appSource.notify(second);
assert.deepEqual(Array.from(tray._notificationQueue), [first, second], 'later notifications queue up too');

// The monitor comes back, the queued notifications are shown in order.
const monitor = { index: 0, x: 0, y: 0, width: 1920, height: 1080 };
layoutManager.monitors = [monitor];
layoutManager.primaryMonitor = monitor;
layoutManager.emit('monitors-changed');
assert.equal(tray._notification, first, 'queued notification is shown once a monitor is back');
assert.equal(tray._notificationState, context.State.SHOWING);
assert.deepEqual(Array.from(tray._notificationQueue), [second]);
assert.equal(tray._notificationBin.x, 1920 - 300 - 10);
assert.deepEqual(sounds, ['notification']);
console.log('PASS: notifications queue without a monitor and show once one is connected');
