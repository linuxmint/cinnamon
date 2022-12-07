// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const St = imports.gi.St;
const System = imports.system;
const Mainloop = imports.mainloop;

const Extension = imports.ui.extension;
const History = imports.misc.history;
const Main = imports.ui.main;

/* Imports...feel free to add here as needed */
var commandHeader = 'const Clutter = imports.gi.Clutter; ' +
                    'const GLib = imports.gi.GLib; ' +
                    'const Gtk = imports.gi.Gtk; ' +
                    'const Mainloop = imports.mainloop; ' +
                    'const Meta = imports.gi.Meta; ' +
                    'const Cinnamon = imports.gi.Cinnamon; ' +
                    'const Main = imports.ui.main; ' +
                    'const Tweener = imports.ui.tweener; ' +
                    /* Utility functions...we should probably be able to use these
                     * in Cinnamon core code too. */
                    'const stage = global.stage; ' +
                    'const color = function(pixel) { let c= new Clutter.Color(); c.from_pixel(pixel); return c; }; ' +
                    /* Special lookingGlass functions */
                    'const it = Main.lookingGlass.getIt(); ' +
                    'const a = Main.lookingGlass.getWindowApp.bind(Main.lookingGlass); '+
                    'const w = Main.lookingGlass.getWindow.bind(Main.lookingGlass); '+
                    'const r = Main.lookingGlass.getResult.bind(Main.lookingGlass); ';

/* delay/aggregation period for window list updates. without a delay, the window
 * still exists in the get_window_actor() immediately after 'MetaWindow::unmanaged',
 * even if called through an idle source. */
const WL_UPDATE_DELAY = 200;

const HISTORY_KEY = 'looking-glass-history';

// these properties throw an error even trying to use typeof on them
const KEY_BLACKLIST = ['get_abs_allocation_vertices', 'get_allocation_vertices'];

/* fake types for special cases:
 *  -"array": objects that pass Array.isArray() and should only show enumerable properties
 *  -"boxedproto": boxed prototypes throw an error on property access
 *  -"importer": objects that load modules on property access
 */

// returns [typeString, valueString] for any object
function getObjInfo(o) {
    let type, value;
    if (o === null)
        type = "null";
    else if (o === undefined)
        type = "undefined";

    if (type) {
        value = "[" + type + "]";
    } else {
        // try to detect importers via their string representation
        try {
            value = o.toString();
        } catch (e) {
            if (e.message.includes("not an object instance - cannot convert to GObject*")) {
                // work around Clutter.Actor.prototype.toString override not handling being
                // called with the prototype itself as 'this'
                value = GObject.Object.prototype.toString.call(o);
            } else {
                value = "[error getting value]";
            }
        }

        type = typeof(o);
        if (type == "object") {
            if (value.startsWith("[GjsFileImporter")
                || value.startsWith("[object GjsModule gi")) {
                type = "importer";
            } else if (value.startsWith("[boxed prototype")) {
                type = "boxedproto";
            } else if (Array.isArray(o)) {
                type = "array";
            }
        }

        // make empty strings/arrays obvious
        if (value === "")
            value = "[empty]";
    }

    return [type, value];
}

// returns an array of dictionaries conforming to the Inspect dbus schema
function getObjKeysInfo(obj) {
    let [type, ] = getObjInfo(obj);
    if (!["array", "object"].includes(type))
        return [];

    let keys = new Set();
    let curProto = obj;

    // we ignore the Object prototype
    while (curProto && curProto !== Object.prototype) {
        let ownKeys;
        if (type === "array")
            ownKeys = curProto.keys(); // index properties only
        else
            ownKeys = Reflect.ownKeys(curProto); // all own properties and symbols

        // adding to set ignores duplicates
        for (let key of ownKeys)
            keys.add(key);

        curProto = Object.getPrototypeOf(curProto);
    }


    return Array.from(keys).map((k) => {
        if (!KEY_BLACKLIST.includes(k)) {
            let [t, v] = getObjInfo(obj[k]);
            return { name: k.toString(), type: t, value: v, shortValue: "" };
        } else {
            return { name: k.toString(), type: '[inacessible]', value: '[inacessible]', shortValue: "" }; 
        }
    });
}

// always returns an object we can give back to melange.
// it may be useful to inspect Error() objects
function tryEval(js) {
    let out;
    try {
        out = eval(js);
    } catch (e) {
        out = e;
    }
    return out;
}

class WindowList {
    constructor() {
        this.lastId = 0;
        this.latestWindowList = [];
        this.delayedUpdateId = 0;

        let tracker = Cinnamon.WindowTracker.get_default();
        global.display.connect('window-created', () => { this._queueDelayedUpdate() });
        tracker.connect('window-app-changed', () => { this._queueDelayedUpdate() });
    }

    getWindowById(id) {
        let windows = global.get_window_actors();
        for (let i = 0; i < windows.length; i++) {
            let metaWindow = windows[i].metaWindow;
            if (metaWindow._lgId === id)
                return metaWindow;
        }
        return null;
    }

    _queueDelayedUpdate() {
        if (this.delayedUpdateId)
            Mainloop.source_remove(this.delayedUpdateId);

        this.delayedUpdateId = Mainloop.timeout_add(WL_UPDATE_DELAY, () => {
            this.delayedUpdateId = 0;
            this._updateWindowList();
            return false;
        });
    }

    _updateWindowList() {
        let windows = global.get_window_actors();
        let tracker = Cinnamon.WindowTracker.get_default();

        let oldWindowList = this.latestWindowList;
        this.latestWindowList = [];
        for (let i = 0; i < windows.length; i++) {
            let metaWindow = windows[i].metaWindow;

            // only track "interesting" windows
            if (!Main.isInteresting(metaWindow))
                continue;

            // Avoid multiple connections
            if (!metaWindow._lookingGlassManaged) {
                metaWindow.connect('unmanaged', () => { this._queueDelayedUpdate() });
                metaWindow._lookingGlassManaged = true;

                metaWindow._lgId = this.lastId;
                this.lastId++;
            }

            let lgInfo = {
                id: metaWindow._lgId.toString(),
                title: metaWindow.title + '',
                wmclass: metaWindow.get_wm_class() + '',
                app: '' };

            let app = tracker.get_window_app(metaWindow);
            if (app != null && !app.is_window_backed()) {
                lgInfo.app = app.get_id() + '';
            } else {
                lgInfo.app = '<untracked>';
            }

            this.latestWindowList.push(lgInfo);
        }

        // Make sure the list changed before notifying listeneres
        let changed = oldWindowList.length != this.latestWindowList.length;
        if (!changed) {
            for (let i = 0; i < oldWindowList.length; i++) {
                if (oldWindowList[i].id != this.latestWindowList[i].id) {
                    changed = true;
                    break;
                }
            }
        }
        if (changed)
            Main.createLookingGlass().emitWindowListUpdate();
    }
};

function addBorderPaintHook(actor) {
    let signalId = actor.connect_after('paint',
        function (actor, paint_context) {
            let framebuffer = paint_context.get_framebuffer();
            let coglContext = framebuffer.get_context();

            if (!this._pipeline) {
                let color = new Cogl.Color();
                color.init_from_4ub(0xff, 0, 0, 0xc4);

                this._pipeline = new Cogl.Pipeline(coglContext);
                this._pipeline.set_color(color);
            }

            let alloc = actor.get_allocation_box();
            let width = 2;

            // clockwise order
            framebuffer.draw_rectangle(this._pipeline,
                0, 0, alloc.get_width(), width);
            framebuffer.draw_rectangle(this._pipeline,
                alloc.get_width() - width, width,
                alloc.get_width(), alloc.get_height());
            framebuffer.draw_rectangle(this._pipeline,
                0, alloc.get_height(),
                alloc.get_width() - width, alloc.get_height() - width);
            framebuffer.draw_rectangle(this._pipeline,
                0, alloc.get_height() - width,
                width, width);
        });

    actor.queue_redraw();
    return signalId;
}

class Inspector {
    constructor() {
        let container = new Cinnamon.GenericContainer({ width: 0,
                                                        height: 0 });
        container.connect('allocate', (...args) => { this._allocate(...args) });
        Main.uiGroup.add_actor(container);

        let eventHandler = new St.BoxLayout({ name: 'LookingGlassDialog',
                                              vertical: true,
                                              reactive: true });
        this._eventHandler = eventHandler;
        Main.pushModal(this._eventHandler);
        container.add_actor(eventHandler);
        this._displayText = new St.Label();
        eventHandler.add(this._displayText, { expand: true });
        this._passThroughText = new St.Label({style: 'text-align: center;'});
        eventHandler.add(this._passThroughText, { expand: true });

        this._borderPaintTarget = null;
        this._borderPaintId = null;
        eventHandler.connect('destroy', () => { this._onDestroy() });
        this._capturedEventId = global.stage.connect('captured-event', (...args) => { this._onCapturedEvent(...args) });

        // this._target is the actor currently shown by the inspector.
        // this._pointerTarget is the actor directly under the pointer.
        // Normally these are the same, but if you use the scroll wheel
        // to drill down, they'll diverge until you either scroll back
        // out, or move the pointer outside of _pointerTarget.
        this._target = null;
        this._pointerTarget = null;
        this.passThroughEvents = false;
        this._updatePassthroughText();
    }

    _updatePassthroughText() {
        if (this.passThroughEvents)
            this._passThroughText.text = '(Press Pause or Control to disable event pass through)';
        else
            this._passThroughText.text = '(Press Pause or Control to enable event pass through)';
    }

    _onCapturedEvent(actor, event) {
        if (event.type() == Clutter.EventType.KEY_PRESS && (event.get_key_symbol() === Clutter.KEY_Control_L ||
                                                            event.get_key_symbol() === Clutter.KEY_Control_R ||
                                                            event.get_key_symbol() === Clutter.KEY_Pause)) {
            this.passThroughEvents = !this.passThroughEvents;
            this._updatePassthroughText();
            return true;
        }

        if (this.passThroughEvents)
            return false;

        switch (event.type()) {
            case Clutter.EventType.KEY_PRESS:
                return this._onKeyPressEvent(actor, event);
            case Clutter.EventType.BUTTON_PRESS:
                return this._onButtonPressEvent(actor, event);
            case Clutter.EventType.SCROLL:
                return this._onScrollEvent(actor, event);
            case Clutter.EventType.MOTION:
                return this._onMotionEvent(actor, event);
            default:
                return true;
        }
    }

    _allocate(actor, box, flags) {
        if (!this._eventHandler)
            return;

        let primary = Main.layoutManager.primaryMonitor;

        let [minWidth, minHeight, natWidth, natHeight] =
            this._eventHandler.get_preferred_size();

        let childBox = new Clutter.ActorBox();
        childBox.x1 = primary.x + Math.floor((primary.width - natWidth) / 2);
        childBox.x2 = childBox.x1 + natWidth;
        childBox.y1 = primary.y + Math.floor((primary.height - natHeight) / 2);
        childBox.y2 = childBox.y1 + natHeight;
        this._eventHandler.allocate(childBox, flags);
    }

    _close() {
        global.stage.disconnect(this._capturedEventId);
        Main.popModal(this._eventHandler);

        this._eventHandler.destroy();
        this._eventHandler = null;
        this.emit('closed');
    }

    _onDestroy() {
        if (this._borderPaintTarget != null)
            this._borderPaintTarget.disconnect(this._borderPaintId);
    }

    _onKeyPressEvent(actor, event) {
        if (event.get_key_symbol() === Clutter.KEY_Escape)
            this._close();
        return true;
    }

    _onButtonPressEvent(actor, event) {
        if (this._target) {
            let [stageX, stageY] = event.get_coords();
            this.emit('target', this._target, stageX, stageY);
        }
        this._close();
        return true;
    }

    _onScrollEvent(actor, event) {
        switch (event.get_scroll_direction()) {
            case Clutter.ScrollDirection.UP:
                // select parent
                let parent = this._target.get_parent();
                if (parent != null) {
                    this._target = parent;
                    this._update(event);
                }
                break;

            case Clutter.ScrollDirection.DOWN:
                // select child
                if (this._target != this._pointerTarget) {
                    let child = this._pointerTarget;
                    while (child) {
                        let parent = child.get_parent();
                        if (parent == this._target)
                            break;
                        child = parent;
                    }
                    if (child) {
                        this._target = child;
                        this._update(event);
                    }
                }
                break;

            default:
                break;
        }
        return true;
    }

    _onMotionEvent(actor, event) {
        this._update(event);
        return true;
    }

    _update(event) {
        let [stageX, stageY] = event.get_coords();
        let target = global.stage.get_actor_at_pos(Clutter.PickMode.ALL,
                                                   stageX,
                                                   stageY);

        if (target != this._pointerTarget)
            this._target = target;
        this._pointerTarget = target;

        let position = '[inspect x: ' + stageX + ' y: ' + stageY + ']';
        this._displayText.text = '';
        this._displayText.text = position + ' ' + this._target;

        if (this._borderPaintTarget != this._target) {
            if (this._borderPaintTarget != null)
                this._borderPaintTarget.disconnect(this._borderPaintId);
            this._borderPaintTarget = this._target;
            this._borderPaintId = addBorderPaintHook(this._target);
        }
    }
};
Signals.addSignalMethods(Inspector.prototype);


const dbusIFace =
    '<node> \
        <interface name="org.Cinnamon.Melange"> \
            <method name="show" /> \
            <method name="hide" /> \
            <method name="getVisible"> \
                <arg type="b" direction="out" name="visible"/> \
            </method> \
            <property name="_open" type="b" access="read" /> \
        </interface> \
     </node>';

const lgIFace =
    '<node> \
        <interface name="org.Cinnamon.LookingGlass"> \
            <method name="Eval"> \
                <arg type="s" direction="in" name="code"/> \
            </method> \
            <method name="GetResults"> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="aa{ss}" direction="out" name="array of dictionary containing keys: command, type, object, index"/> \
            </method> \
            <method name="AddResult"> \
                <arg type="s" direction="in" name="code"/> \
            </method> \
            <method name="GetErrorStack"> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="aa{ss}" direction="out" name="array of dictionary containing keys: timestamp, category, message"/> \
            </method> \
            <method name="GetMemoryInfo"> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="i" direction="out" name="time since last garbage collect"/> \
                <arg type="a{si}" direction="out" name="dictionary mapping name(string) to number of bytes used(int)"/> \
            </method> \
            <method name="FullGc"> \
            </method> \
            <method name="Inspect"> \
                <arg type="s" direction="in" name="code"/> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="aa{ss}" direction="out" name="array of dictionary containing keys: name, type, value, shortValue"/> \
            </method> \
            <method name="GetLatestWindowList"> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="aa{ss}" direction="out" name="array of dictionary containing keys: id, title, wmclass, app"/> \
            </method> \
            <method name="StartInspector"> \
            </method> \
            <method name="GetExtensionList"> \
                <arg type="b" direction="out" name="success"/> \
                <arg type="aa{ss}" direction="out" name="array of dictionary containing keys: status, name, description, uuid, folder, url, type"/> \
            </method> \
            <method name="ReloadExtension"> \
                <arg type="s" direction="in" name="uuid"/> \
                <arg type="s" direction="in" name="type"/> \
            </method> \
            <signal name="LogUpdate"></signal> \
            <signal name="WindowListUpdate"></signal> \
            <signal name="ResultUpdate"></signal> \
            <signal name="InspectorDone"></signal> \
            <signal name="ExtensionListUpdate"></signal> \
        </interface> \
    </node>';

const proxy = Gio.DBusProxy.makeProxyWrapper(dbusIFace);

var Melange = class {
    constructor() {
        this.proxy = null;
        this._it = null;
        this._open = false;
        this._settings = new Gio.Settings({schema_id: "org.cinnamon.desktop.keybindings"});
        this._settings.connect("changed::looking-glass-keybinding", () => { this._update_keybinding() });
        this._update_keybinding();

        this._results = [];
        this.rawResults = [];

        this._windowList = new WindowList();
        this._history = new History.HistoryManager({ gsettingsKey: HISTORY_KEY });

        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(lgIFace, this);
        this._dbusImpl.export(Gio.DBus.session, '/org/Cinnamon/LookingGlass');

        Gio.DBus.session.own_name('org.Cinnamon.LookingGlass', Gio.BusNameOwnerFlags.REPLACE, null, null);
    }

    _update_keybinding() {
        let kb = this._settings.get_strv("looking-glass-keybinding");
        Main.keybindingManager.addHotKeyArray("looking-glass-toggle", kb, () => { this.open() });
    }

    ensureProxy() {
        if (!this.proxy)
            this.proxy = new proxy(Gio.DBus.session, 'org.Cinnamon.Melange', '/org/Cinnamon/Melange');
    }

    open() {
        this.ensureProxy()
        this.proxy.showRemote();
        this.updateVisible();
    }

    close() {
        this.ensureProxy()
        this.proxy.hideRemote();
        this.updateVisible();
    }

    updateVisible() {
        this.proxy.getVisibleRemote((visible) => { this._open = visible });
    }

    _pushResult(command, obj, tooltip) {
        let index = this._results.length;
        let result = {"o": obj, "index": index};
        let [type, value] = getObjInfo(obj);
        this.rawResults.push({command: command, type: type, object: value, index: index.toString(), tooltip: tooltip});
        this.emitResultUpdate();

        this._results.push(result);
        this._it = obj;
    }

    inspect(path) {
        let fullCmd = commandHeader + path;
        let result = tryEval(fullCmd);
        return getObjKeysInfo(result);
    }

    getIt() {
        return this._it;
    }

    getResult(idx) {
        return this._results[idx].o;
    }

    getWindow(idx) {
        return this._windowList.getWindowById(idx);
    }

    getWindowApp(idx) {
        let metaWindow = this._windowList.getWindowById(idx)
        if (metaWindow) {
            let tracker = Cinnamon.WindowTracker.get_default();
            return tracker.get_window_app(metaWindow);
        }
        return null;
    }

    // DBus function
    Eval(command) {
        this._history.addItem(command);

        let fullCmd = commandHeader + command;
        let ts = GLib.get_monotonic_time();

        let resultObj = tryEval(fullCmd);

        let ts2 = GLib.get_monotonic_time();
        let tooltip = _("Execution time (ms): ") + (ts2 - ts) / 1000;

        this._pushResult(command, resultObj, tooltip);
    }

    // DBus function
    GetResults() {
        return [true, this.rawResults];
    }

    // DBus function
    AddResult(path) {
        let fullCmd = commandHeader + path;
        this._pushResult(path, tryEval(fullCmd), "");
    }

    // DBus function
    GetErrorStack() {
        return [true, Main._errorLogStack];
    }

    // DBus function
    GetMemoryInfo() {
        return null;
    }

    // DBus function
    FullGc() {
        System.gc();
    }

    // DBus function
    Inspect(path) {
        try {
            let result = this.inspect(path);
            return [true, result];
        } catch (e) {
            global.logError('Error inspecting path: ' + path, e);
            return [false, []];
        }
    }

    // DBus function
    GetLatestWindowList() {
        try {
            return [true, this._windowList.latestWindowList];
        } catch (e) {
            global.logError('Error getting latest window list', e);
            return [false, []];
        }
    }

    // DBus function
    StartInspector() {
        try {
            let inspector = new Inspector();
            inspector.connect('target', (i, target, stageX, stageY) => {
                let name = '<inspect x:' + stageX + ' y:' + stageY + '>';
                this._pushResult(name, target, "Inspected actor");
            });
            inspector.connect('closed', () => { this.emitInspectorDone() });
        } catch (e) {
            global.logError('Error starting inspector', e);
        }
    }

    // DBus function
    GetExtensionList() {
        try {
            let extensionList = Array(Extension.extensions.length);
            for (let i = 0; i < extensionList.length; i++) {
                let meta = Extension.extensions[i].meta;
                // There can be cases where we create dummy extension metadata
                // that's not really a proper extension. Don't bother with these.
                if (meta.name) {
                    extensionList[i] = {
                        status: Extension.getMetaStateString(meta.state),
                        name: meta.name,
                        description: meta.description,
                        uuid: Extension.extensions[i].uuid,
                        folder: meta.path,
                        url: meta.url ? meta.url : '',
                        type: Extension.extensions[i].name,
                        error_message: meta.error ? meta.error : _("Loaded successfully"),
                        error: meta.error ? "true" : "false" // Must use string due to dbus restrictions
                    };
                }
            }
            return [true, extensionList];
        } catch (e) {
            global.logError('Error getting the extension list', e);
            return [false, []];
        }
    }

    // DBus function
    ReloadExtension(uuid, type) {
        Extension.reloadExtension(uuid, Extension.Type[type]);
    }

    emitLogUpdate() {
        this._dbusImpl.emit_signal('LogUpdate', null);
    }

    emitWindowListUpdate() {
        this._dbusImpl.emit_signal('WindowListUpdate', null);
    }

    emitResultUpdate() {
        this._dbusImpl.emit_signal('ResultUpdate', null);
    }

    emitInspectorDone() {
        this._dbusImpl.emit_signal('InspectorDone', null);
    }

    emitExtensionListUpdate() {
        this._dbusImpl.emit_signal('ExtensionListUpdate', null);
    }
}
