// Run with: node tests/unit/notificationDaemon.js
// Exercise the real daemon module with GI/UI boundaries stubbed; no desktop
// session, installed Cinnamon libraries, or D-Bus ownership is required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let pidApp = null;
let nativeApps = {};
let flatpakApps = {};
let runningApps = [];
let trayApp = null;
let lookups = [];
const appSystem = {
    lookup_app(id) {
        lookups.push(id);
        return nativeApps[id] || null;
    },
    lookup_flatpak_app_id(id) { return flatpakApps[id] || null; },
    get_running() { return runningApps; },
    lookup_wmclass() { return trayApp; }
};
function BaseSource() {}
BaseSource.prototype._init = function(title) {
    this.title = title;
    this.ICON_SIZE = 24;
};
BaseSource.prototype._setSummaryIcon = function(icon) { this.summaryIcon = icon; };

const context = vm.createContext({
    imports: {
        gi: {
            Clutter: {}, GLib: {},
            Gio: { DBusProxy: { makeProxyWrapper() {} } },
            Cinnamon: {
                WindowTracker: { get_default: () => ({ get_app_from_pid: () => pidApp }) },
                AppSystem: { get_default: () => appSystem }
            },
            St: {
                Icon: function(properties) { Object.assign(this, properties); },
                IconType: { FULLCOLOR: 1, SYMBOLIC: 2 },
                TextureCache: { get_default: () => ({}) }
            }
        },
        lang: {}, mainloop: {}, misc: { config: {}, params: {} },
        ui: { main: {}, messageTray: { Source: BaseSource } }
    },
    log() {}
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../js/ui/notificationDaemon.js'), 'utf8'), context);

function makeApp(name) {
    const icon = { name };
    return { get_name: () => name, get_app_info: () => ({ get_icon: () => icon }) };
}
function source(hint, title = 'Notification sender', trayIcon = null) {
    return new context.Source(title, 123, null, hint, trayIcon);
}
const native = makeApp('Native application');
const flatpak = makeApp('Flatpak application');
const daemon = context.NotificationDaemon.prototype;

// No PID/window match and a title different from the application's name:
// the desktop-entry hint must identify the native app and supply its icon.
nativeApps = { 'org.gnome.Geary.desktop': native };
for (const hint of ['org.gnome.Geary', 'org.gnome.Geary.desktop']) {
    const s = source(hint);
    assert.equal(s.app, native);
    assert.equal(s.summaryIcon.gicon, native.get_app_info().get_icon());
    assert.equal(s.useNotificationIcon, false);
    assert.equal(daemon._notificationIcon(s, '', {}).gicon, native.get_app_info().get_icon());
    assert.equal(daemon._notificationIcon(s, 'explicit-icon', {}).icon_name, 'explicit-icon');
}
assert.deepEqual(lookups, ['org.gnome.Geary.desktop', 'org.gnome.Geary.desktop']);

// A tracked PID retains priority over a conflicting hint.
pidApp = flatpak;
lookups = [];
assert.equal(source('org.gnome.Geary').app, flatpak);
assert.deepEqual(lookups, []);
pidApp = null;

// Existing Flatpak lookup, browser aliases, and unique-name fallback survive.
flatpakApps = { 'org.example.Flatpak': flatpak, 'com.brave.Browser': flatpak };
assert.equal(source('org.example.Flatpak').app, flatpak);
assert.equal(source('brave-browser').app, flatpak);
runningApps = [flatpak];
assert.equal(source('unknown', flatpak.get_name()).app, flatpak);
runningApps = [flatpak, makeApp(flatpak.get_name())];
assert.equal(source('unknown', flatpak.get_name()).app, null);
runningApps = [];

// Unknown/missing hints retain generic urgency icons and tray lookup.
for (const hint of ['unknown', null, '']) {
    const s = source(hint);
    assert.equal(s.app, null);
    assert.equal(daemon._notificationIcon(s, '', { urgency: 1 }).icon_name,
        'xsi-dialog-information-symbolic');
    assert.equal(daemon._notificationIcon(s, '', { urgency: 2 }).icon_name,
        'xsi-dialog-error-symbolic');
}
trayApp = flatpak;
const traySource = source('unknown', 'Tray sender', { wmclass: 'example' });
assert.equal(traySource._getApp(), flatpak);
console.log('notificationDaemon: native desktop-entry icons and fallback checks passed');
