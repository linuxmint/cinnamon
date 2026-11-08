// Run without a Cinnamon session: node tests/unit/grouped-window-list-workspace.cjs
// Exercise the checkout's Workspace implementation; only its desktop dependencies
// and actors are replaced, so refreshList/loadFavorites/windowAdded run unchanged.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Container {
    children = [];
    add_child(actor) { this.children.push(actor); }
    insert_child_at_index(actor, index) { this.children.splice(index, 0, actor); }
    set_child_at_index(actor, index) {
        this.children.splice(this.children.indexOf(actor), 1);
        this.children.splice(index, 0, actor);
    }
}

class AppGroup {
    constructor(params) {
        this.groupState = { ...params, metaWindows: [] };
        this.actor = { group: this };
    }
    windowAdded(window) {
        if (window && !this.groupState.metaWindows.includes(window)) {
            this.groupState.metaWindows.push(window);
        }
    }
    destroy() {
        const container = this.groupState.state.container;
        container.children.splice(container.children.indexOf(this.actor), 1);
        // Like the real destroy(), invalidate group state after destruction.
        this.groupState = null;
    }
}

const source = process.env.WORKSPACE_SOURCE || path.resolve(__dirname,
    '../../files/usr/share/cinnamon/applets/grouped-window-list@cinnamon.org/workspace.js');
const context = vm.createContext({
    imports: {
        gi: { Clutter: {}, GLib: {} },
        ui: { main: {}, extension: { getCurrentExtension: () => ({ imports: {
            state: {}, appGroup: { AppGroup }, scrollBox: {}, constants: {}
        } }) } },
        misc: { signalManager: {}, util: {} }
    },
    global: {}
});
vm.runInContext(fs.readFileSync(source, 'utf8'), context, { filename: source });
const Workspace = context.Workspace;

function app(id) {
    return { get_id: () => id, windows: [], get_windows() { return this.windows; } };
}
function window(app, sequence) {
    return { app, sequence, get_stable_sequence: () => sequence, get_monitor: () => 0 };
}
function workspace(favorites, windows, grouped = false) {
    const ws = Object.create(Workspace.prototype);
    ws.container = new Container();
    ws.state = {
        container: ws.container,
        monitorWatchList: [0],
        settings: { groupApps: grouped, showAllWorkspaces: false },
        trigger(name, win) {
            if (name === 'getFavorites') return favorites.map(app => ({ id: app.get_id(), app }));
            if (name === 'getAppSystem') return { lookup_app: id => favorites.find(app => app.get_id() === id) };
            if (name === 'getAppFromWindow') return win.app;
        }
    };
    ws.appGroups = [];
    ws.metaWorkspace = { list_windows: () => windows };
    ws.shouldWindowBeAdded = () => true;
    ws.scrollToLastFocusedApp = () => {};
    return ws;
}
function order(ws) {
    assert.deepEqual(ws.container.children, Array.from(ws.appGroups, group => group.actor));
    return Array.from(ws.appGroups, group => group.groupState.metaWindows[0]?.sequence
        ?? group.groupState.appId);
}
function reorder(ws, groups) {
    ws.appGroups = groups;
    ws.container.children = Array.from(groups, group => group.actor);
}

const terminal = app('terminal');
const browser = app('browser');
const empty = app('empty');
const t1 = window(terminal, 1), t2 = window(terminal, 2), t3 = window(terminal, 3);
const b1 = window(browser, 4), b2 = window(browser, 5);
terminal.windows = [t3, t1, t2]; // Deliberately MRU rather than creation order.
browser.windows = [b2, b1];
const windows = [t3, t1, t2, b2, b1];
const favorites = [terminal, empty, browser];
const ws = workspace(favorites, windows);
ws.refreshList();
assert.deepEqual(order(ws), [1, 2, 3, 'empty', 4, 5], 'initial windows use creation order');

const initial = ws.appGroups.slice();
reorder(ws, [t3, t1, t2, null, b2, b1].map(window => initial.find(group =>
    window ? group.groupState.metaWindows.includes(window) : group.groupState.appId === 'empty')));
terminal.windows = [t2, t3, t1];
browser.windows = [b1, b2];
for (let i = 0; i < 3; i++) {
    ws.refreshList();
    assert.deepEqual(order(ws), [3, 1, 2, 'empty', 5, 4], 'refresh preserves manual order despite MRU changes');
}

// A pin reorder must still move apps, while preserving each app's window order.
favorites.splice(0, favorites.length, browser, empty, terminal);
ws.refreshList();
assert.deepEqual(order(ws), [5, 4, 'empty', 3, 1, 2]);

// Removed windows disappear, and new windows follow surviving windows.
const t4 = window(terminal, 6), t5 = window(terminal, 7);
terminal.windows = [t5, t2, t4, t3];
windows.splice(0, windows.length, t5, t2, t4, t3, b1, b2);
ws.refreshList();
assert.deepEqual(order(ws), [5, 4, 'empty', 3, 2, 6, 7]);

// Unpinned applications use the same preservation path.
const unpinned = workspace([], [t2, t3, t4]);
unpinned.refreshList();
reorder(unpinned, unpinned.appGroups.slice().reverse());
const manual = order(unpinned);
unpinned.refreshList();
assert.deepEqual(order(unpinned), manual);

// Restoring one app must not move another app or an empty launcher from its slot.
const interleaved = workspace([], []);
function group(app, win) {
    const group = new AppGroup({ appId: app.get_id(), state: interleaved.state });
    group.windowAdded(win);
    return group;
}
reorder(interleaved, [group(terminal, t2), group(browser, b1), group(terminal, t1), group(empty, null)]);
interleaved.restoreWindowOrder(new Map([[t1, 0], [t2, 1], [b1, 2]]));
assert.deepEqual(order(interleaved), [1, 4, 2, 'empty']);

const grouped = workspace(favorites, windows, true);
grouped.restoreWindowOrder = () => { throw new Error('grouped mode must not restore order'); };
grouped.refreshList();
assert.equal(grouped.appGroups.length, 3);
assert.deepEqual(Array.from(grouped.appGroups.find(group => group.groupState.appId === 'terminal')
    .groupState.metaWindows), terminal.windows, 'grouped window order stays unchanged');
console.log('PASS: initial order, repeated rebuilds, pin changes, new/removed windows, unpinned apps, app slots, grouped mode');
