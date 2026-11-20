// Run without a Cinnamon session: node tests/unit/grouped-window-list-workspace-remove.cjs
// Regression test for https://github.com/linuxmint/cinnamon/issues/14118
// "Grouped Window List does not remove icons for windows which have closed
// when 'show windows from all workspaces' is set true"
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
    windowRemoved(metaWorkspace, metaWindow, refWindow, cb) {
        this.groupState.metaWindows.splice(refWindow, 1);
        if (this.groupState.metaWindows.length === 0 && typeof cb === 'function') {
            cb(this.groupState.appId, this.groupState.isFavoriteApp);
        }
    }
    destroy() {
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
    return { get_id: () => id };
}
function metaWorkspace(index) {
    return { index: () => index };
}
function win(app, sequence, homeWorkspace) {
    return {
        app,
        sequence,
        get_stable_sequence: () => sequence,
        get_monitor: () => 0,
        get_workspace: () => homeWorkspace,
        has_focus: () => true
    };
}

// Two workspaces sharing one piece of state, mirroring how applet.js fans a
// window-removed signal out to every Workspace instance when
// showAllWorkspaces is set.
function makeWorkspaces() {
    const state = {
        monitorWatchList: [0],
        settings: { groupApps: false, showAllWorkspaces: true },
        removingWindowFromWorkspaces: false,
        trigger(name, w) {
            if (name === 'getAppFromWindow') return w.app;
            if (name === 'getFavorites') return [];
            if (name === 'removeWindowFromAllWorkspaces') {
                workspaces.forEach(ws => ws.windowRemoved(ws.metaWorkspace, w));
                state.removingWindowFromWorkspaces = false;
            }
        }
    };
    const workspaces = [0, 1].map(index => {
        const ws = Object.create(Workspace.prototype);
        ws.state = state;
        ws.container = { add_child() {}, insert_child_at_index() {} };
        ws.appGroups = [];
        ws.metaWorkspace = metaWorkspace(index);
        ws.shouldWindowBeAdded = () => true;
        return ws;
    });
    return { state, workspaces };
}

const theApp = app('terminal');

// Window actually closing: by the time 'window-removed' fires, Meta/Muffin
// has already cleared its workspace assignment (get_workspace() => null).
// It still has focus (common when closing the window you're using), and its
// own workspace (1) isn't the active one (0) -- this used to make the old
// has_focus()+active-index heuristic abort the removal forever, leaving a
// ghost icon on every workspace.
{
    const { workspaces } = makeWorkspaces();
    const closing = win(theApp, 1, null);
    workspaces.forEach(ws => ws.windowAdded(ws.metaWorkspace, closing));
    workspaces.forEach(ws => assert.equal(ws.appGroups.length, 1, 'window registered on every workspace'));

    workspaces[1].windowRemoved(workspaces[1].metaWorkspace, closing);

    workspaces.forEach((ws, i) => assert.equal(ws.appGroups.length, 0,
        `closing window must be removed from workspace ${i}`));
}

// Window just switching workspace: get_workspace() still returns the
// (different) workspace it moved to, so the removal from its old workspace
// must be aborted -- it stays indexed everywhere since showAllWorkspaces is set.
{
    const { workspaces } = makeWorkspaces();
    const moving = win(theApp, 2, null);
    workspaces.forEach(ws => ws.windowAdded(ws.metaWorkspace, moving));

    moving.get_workspace = () => workspaces[0].metaWorkspace;
    workspaces[1].windowRemoved(workspaces[1].metaWorkspace, moving);

    workspaces.forEach((ws, i) => assert.equal(ws.appGroups.length, 1,
        `window merely changing workspace must stay indexed on workspace ${i}`));
}

console.log('PASS: showAllWorkspaces close removes ghost icons, workspace moves are preserved');
