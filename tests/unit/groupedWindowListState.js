// State subscriptions must not outlive grouped-window-list objects.
const GLib = imports.gi.GLib;
const System = imports.system;
const JsUnit = imports.jsUnit;
const root = GLib.path_get_dirname(GLib.path_get_dirname(GLib.path_get_dirname(System.programPath)));
imports.searchPath.unshift(root + '/files/usr/share/cinnamon/applets/grouped-window-list@cinnamon.org');
const {createStore} = imports.state;

let calls = [];
let store = createStore({first: 0, second: 0, third: 0});
const id = store.connect({
    first: () => calls.push('first'),
    second: () => calls.push('second'),
    third: () => calls.push('third')
});
store.connect('second', () => calls.push('unrelated'));
store.disconnect(id);
store.set({first: 1, second: 1, third: 1});
JsUnit.assertEquals('unrelated', calls.join(','));

calls = [];
store = createStore({first: 0, second: 0});
store.connect(['first', 'second'], () => calls.push('shared'));
store.connect('first', () => calls.push('first'));
store.connect('second', () => calls.push('second'));
store.disconnect('first');
store.set({first: 1});
JsUnit.assertEquals(0, calls.length);
store.disconnect('missing');
store.set({second: 1});
JsUnit.assertEquals('shared,second', calls.join(','));
store.disconnect(['first', 'second']);
calls = [];
store.set({first: 2, second: 2});
JsUnit.assertEquals(0, calls.length);

store.connect('first', () => calls.push('destroyed'));
const set = store.set;
store.destroy();
set({first: 3});
JsUnit.assertEquals(0, calls.length);
print('Grouped window list state cleanup checks passed');
