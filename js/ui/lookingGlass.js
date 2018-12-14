// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const Gio = imports.gi.Gio;
const Gir = imports.gi.GIRepository;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const St = imports.gi.St;
const System = imports.system;

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
                    'const Lang = imports.lang; ' +
                    'const Tweener = imports.ui.tweener; ' +
                    /* Utility functions...we should probably be able to use these
                     * in Cinnamon core code too. */
                    'const stage = global.stage; ' +
                    /* Special lookingGlass functions */
                    'const it = Main.lookingGlass.getIt(); ' +
                    'const a = Lang.bind(Main.lookingGlass, Main.lookingGlass.getWindowApp); '+
                    'const w = Lang.bind(Main.lookingGlass, Main.lookingGlass.getWindow); '+
                    'const r = Lang.bind(Main.lookingGlass, Main.lookingGlass.getResult); ';

const HISTORY_KEY = 'looking-glass-history';

/* fake types for special cases:
 *  -'array': should only show enumerable properties
 *  -'prototype': prototypes for gobject and gboxed - not inspectable
 *  -'importer': file importers - not inspectable
 *  -GTypes - inspected via GIRepository
 */

// primitive js types and certain objects to avoid inspecting
// keep in sync with page_inspect.py
const NON_INSPECTABLE_TYPES = [
    'boolean',
    'function',
    'importer',
    'null',
    'number',
    'prototype',
    'string',
    'symbol',
    'undefined'
];

// matches gi object toString values
const GI_RE = /^\[(?:boxed|object) (instance|prototype) (?:proxy|of) (?:GType|GIName):[\w.]+ [^\r\n]+\]$/;
// matches known importer toString values
const IMPORT_RE = /^\[(?:GjsFileImporter \w+|object GjsModule gi)\]$/;
const DASH_RE = /-/g;

// returns [typeString, valueString] for any object
function getObjInfo(o) {
    let type, value;

    if (o === null)
        type = 'null';
    else if (o === undefined)
        type = 'undefined';

    if (type) {
        value = `[${type}]`;
    } else {
        // try to detect detailed type by string representation
        if (o instanceof GObject.Object) {
            // work around Clutter.Actor.prototype.toString override
            value = GObject.Object.prototype.toString.call(o);
        } else {
            // toString() throws when called on ByteArray(GBytes wrapper object in cjs)
            try {
                value = o.toString();
            } catch (e) {
                value = '[error getting value]';
            }
        }

        type = typeof(o);
        if (type === 'object') {
            if (value.search(IMPORT_RE) != -1) {
                type = 'importer';
            } else if (o instanceof GIRepositoryNamespace) {
                type = 'GIRepositoryNamespace';
            } else {
                let matches = value.match(GI_RE);
                if (matches) {
                    if (matches[1] === 'prototype') {
                        type = 'prototype';
                    } else {
                        // 'instance'
                        type = GObject.type_name(o.constructor.$gtype);
                    }
                } else if ('$gtype' in o) {
                    type = GObject.type_name(o.$gtype);
                } else if (Array.isArray(o)) {
                    type = 'array';
                }
            }
        }

        // make empty strings/arrays obvious
        if (value === '')
            value = '[empty]';
    }

    return [type, value];
}

// returns an array of dictionaries conforming to the Inspect dbus schema
function getObjKeyInfos(obj) {
    let [type, ] = getObjInfo(obj);
    if (NON_INSPECTABLE_TYPES.includes(type))
        return [];

    let keys = [];
    if (['array', 'object'].includes(type))
        keys = _jsObjectGetKeys(obj, type);
    else
        keys = _giGetKeys(obj, type);
 
    let infos = [];
    for (let i = 0; i < keys.length; i++) {
        // muffin has some props that throw an error because they shouldn't be introspected
        try {
            let [t, v] = getObjInfo(obj[keys[i]]);
            infos.push({ name: keys[i].toString(),
                         type: t,
                         value: v,
                         shortValue: '' });
        } catch(e) {
        }
    }
    return infos;
}

// get list of keys for js objects
function _jsObjectGetKeys(obj, type) {
    let keys = new Set();
    let curProto = obj;

    // we ignore the Object prototype
    while (curProto && curProto !== Object.prototype) {
        let ownKeys;
        if (type === 'array') {
            // index properties only
            ownKeys = curProto.keys();
        } else {
            // all own properties and symbols
            ownKeys = Reflect.ownKeys(curProto);
        }

        // adding to set ignores duplicates
        for (let key of ownKeys)
            keys.add(key);

        curProto = Object.getPrototypeOf(curProto);
    }
    return Array.from(keys);
}

// get list of keys for introspected c types by gType name string
function _giGetKeys(obj, gTypeName) {
    if (gTypeName === 'GIRepositoryNamespace')
        return _giNamespaceGetKeys(obj)

    let gType = GObject.type_from_name(gTypeName);
    let info = Gir.Repository.get_default().find_by_gtype(gType);
    if (!info)
        return [];

    let type = info.get_type();
    switch (type) {
        case Gir.InfoType.STRUCT:
            return _giStructInfoGetKeys(info);
        case Gir.InfoType.OBJECT:
            return _giObjectInfoGetKeys(info);
        case Gir.InfoType.ENUM:
        case Gir.InfoType.FLAGS:
            return _giEnumInfoGetKeys(info);
        default:
            // FIXME: remove log
            log(`unhandled type ${type}`);
            return [];
    }
}

// grab the "useful" key names for a GirNamespace
function _giNamespaceGetKeys(obj) {
    let repo = Gir.Repository.get_default();
    let keys = [];
    // the "__name__" property is set in ns.cpp in cjs
    let n = repo.get_n_infos(obj.__name__);
    for (let i = 0; i < n; i++) {
        let info = repo.get_info(obj.__name__, i);
        let name = info.get_name();
        switch (info.get_type()) {
            case Gir.InfoType.ENUM:
            case Gir.InfoType.FLAGS:
            case Gir.InfoType.FUNCTION:
            case Gir.InfoType.OBJECT:
                keys.push(name);
                break;
            default:
                // FIXME: remove
                log(`not accepting namespace property type ${info.get_type()}`);
        }
    }
    return keys;
}

// grabs methods for a GIBaseInfo using the GIInfoType as a string:
// "enum", "object", "struct"
// skips any constructor or virtual functions
function _giInfoGetMethods(info, typeString) {
    let keys = [];
    let n = Gir[`${typeString}_info_get_n_methods`](info);
    for (let i = 0; i < n; i++) {
        let funcInfo = Gir[`${typeString}_info_get_method`](info, i);
        let flags = Gir.function_info_get_flags(funcInfo);

        if (!(flags & Gir.FunctionInfoFlags.WRAPS_VFUNC)
            && !(flags & Gir.FunctionInfoFlags.IS_CONSTRUCTOR))
            keys.push(funcInfo.get_name()
                              .replace(DASH_RE, '_'));
    }
    return keys;
}


// grab constants, readable properties, and methods of a GI_INFO_TYPE_OBJECT
// and its ancestors
// do we get duplicate keys here ever?
function _giObjectInfoGetKeys(info) {
    let keys = [];
    while(info) {
        // skip object/initially unowned typelibs
        let gType = Gir.registered_type_info_get_g_type(info);
        if (gType === GObject.Object.$gtype || gType === GObject.InitiallyUnowned.$gtype)
            break;

        let n = Gir.object_info_get_n_constants(info);
        for (let i = 0; i < n; i++)
            keys.push(Gir.object_info_get_constant(info, i)
                         .get_name()
                         .replace(DASH_RE, '_'));

        n = Gir.object_info_get_n_properties(info);
        for (let i = 0; i < n; i++) {
            let propInfo = Gir.object_info_get_property(info, i);
            let flags = Gir.property_info_get_flags(propInfo);
            if (flags & GObject.ParamFlags.READABLE)
                keys.push(propInfo.get_name()
                                  .replace(DASH_RE, '_'));
        }

        keys = keys.concat(_giInfoGetMethods(info, 'object'));

        info = Gir.object_info_get_parent(info);
    }
    return keys;
}

// grab fields and methods for a GI_INFO_TYPE_STRUCT
function _giStructInfoGetKeys(info) {
    let keys = [];
    let n = Gir.struct_info_get_n_fields(info);
    for (let i = 0; i < n; i++)
        keys.push(Gir.struct_info_get_field(info, i)
                     .get_name()
                     .replace(DASH_RE, '_'));

    return keys.concat(_giInfoGetMethods(info, 'struct'));
}

// grab values for a GI_INFO_TYPE_ENUM or GI_INFO_TYPE_FLAGS
// enum/flags object key names are always uppercase
function _giEnumInfoGetKeys(info) {
    let keys = [];
    let n = Gir.enum_info_get_n_values(info);
    for (let i = 0; i < n; i++)
        keys.push(Gir.enum_info_get_value(info, i)
                     .get_name()
                     .replace(DASH_RE, '_')
                     .toUpperCase());

    return keys.concat(_giInfoGetMethods(info, 'enum'));
}

// always returns an object we can give back to melange.
// it may be useful to inspect Error() objects
function tryEval(js) {
    try {
        return eval(js);
    } catch (e) {
        return e;
    }
}

function WindowList() {
    this._init();
}

WindowList.prototype = {
    _init : function () {
        this.lastId = 0;
        this.latestWindowList = [];

        let tracker = Cinnamon.WindowTracker.get_default();
        global.display.connect('window-created', Lang.bind(this, this._updateWindowList));
        tracker.connect('tracked-windows-changed', Lang.bind(this, this._updateWindowList));
    },

    getWindowById: function(id) {
        let windows = global.get_window_actors();
        for (let i = 0; i < windows.length; i++) {
            let metaWindow = windows[i].metaWindow;
            if (metaWindow._lgId === id)
                return metaWindow;
        }
        return null;
    },

    _updateWindowList: function() {
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
                metaWindow.connect('unmanaged', Lang.bind(this, this._updateWindowList));
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
Signals.addSignalMethods(WindowList.prototype);

function addBorderPaintHook(actor) {
    let signalId = actor.connect_after('paint',
        function () {
            let color = new Cogl.Color();
            color.init_from_4ub(0xff, 0, 0, 0xc4);
            Cogl.set_source_color(color);

            let geom = actor.get_allocation_geometry();
            let width = 2;

            // clockwise order
            Cogl.rectangle(0, 0, geom.width, width);
            Cogl.rectangle(geom.width - width, width,
                           geom.width, geom.height);
            Cogl.rectangle(0, geom.height,
                           geom.width - width, geom.height - width);
            Cogl.rectangle(0, geom.height - width,
                           width, width);
        });

    actor.queue_redraw();
    return signalId;
}

function Inspector() {
    this._init();
}

Inspector.prototype = {
    _init: function() {
        let container = new Cinnamon.GenericContainer({ width: 0,
                                                     height: 0 });
        container.connect('allocate', Lang.bind(this, this._allocate));
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
        eventHandler.connect('destroy', Lang.bind(this, this._onDestroy));
        this._capturedEventId = global.stage.connect('captured-event', Lang.bind(this, this._onCapturedEvent));

        // this._target is the actor currently shown by the inspector.
        // this._pointerTarget is the actor directly under the pointer.
        // Normally these are the same, but if you use the scroll wheel
        // to drill down, they'll diverge until you either scroll back
        // out, or move the pointer outside of _pointerTarget.
        this._target = null;
        this._pointerTarget = null;
        this.passThroughEvents = false;
        this._updatePassthroughText();
    },

    _updatePassthroughText: function() {
        if (this.passThroughEvents)
            this._passThroughText.text = '(Press Pause or Control to disable event pass through)';
        else
            this._passThroughText.text = '(Press Pause or Control to enable event pass through)';
    },

    _onCapturedEvent: function (actor, event) {
        if (event.type() == Clutter.EventType.KEY_PRESS && (event.get_key_symbol() == Clutter.Control_L ||
                                                            event.get_key_symbol() == Clutter.Control_R ||
                                                            event.get_key_symbol() == Clutter.Pause)) {
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
    },

    _allocate: function(actor, box, flags) {
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
    },

    _close: function() {
        global.stage.disconnect(this._capturedEventId);
        Main.popModal(this._eventHandler);

        this._eventHandler.destroy();
        this._eventHandler = null;
        this.emit('closed');
    },

    _onDestroy: function() {
        if (this._borderPaintTarget != null)
            this._borderPaintTarget.disconnect(this._borderPaintId);
    },

    _onKeyPressEvent: function (actor, event) {
        if (event.get_key_symbol() == Clutter.Escape)
            this._close();
        return true;
    },

    _onButtonPressEvent: function (actor, event) {
        if (this._target) {
            let [stageX, stageY] = event.get_coords();
            this.emit('target', this._target, stageX, stageY);
        }
        this._close();
        return true;
    },

    _onScrollEvent: function (actor, event) {
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
    },

    _onMotionEvent: function (actor, event) {
        this._update(event);
        return true;
    },

    _update: function(event) {
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

function Melange() {
    this._init.apply(this, arguments);
}

Melange.prototype = {
    _init: function() {
        this.proxy = null;
        this._it = null;
        this._open = false;
        this._settings = new Gio.Settings({schema_id: "org.cinnamon.desktop.keybindings"});
        this._settings.connect("changed::looking-glass-keybinding", Lang.bind(this, this._update_keybinding));
        this._update_keybinding();

        this._results = [];
        this.rawResults = [];

        this._windowList = new WindowList();
        this._history = new History.HistoryManager({ gsettingsKey: HISTORY_KEY });

        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(lgIFace, this);
        this._dbusImpl.export(Gio.DBus.session, '/org/Cinnamon/LookingGlass');

        Gio.DBus.session.own_name('org.Cinnamon.LookingGlass', Gio.BusNameOwnerFlags.REPLACE, null, null);
    },

    _update_keybinding: function() {
        let kb = this._settings.get_strv("looking-glass-keybinding");
        Main.keybindingManager.addHotKeyArray("looking-glass-toggle", kb, Lang.bind(this, this._key_callback));
    },

    _key_callback: function() {
        this.open();
    },

    ensureProxy: function() {
        if (!this.proxy)
            this.proxy = new proxy(Gio.DBus.session, 'org.Cinnamon.Melange', '/org/Cinnamon/Melange');
    },

    open: function() {
        this.ensureProxy()
        this.proxy.showRemote();
        this.updateVisible();
    },

    close: function() {
        this.ensureProxy()
        this.proxy.hideRemote();
        this.updateVisible();
    },

    updateVisible: function() {
        this.proxy.getVisibleRemote(Lang.bind(this, function(visible) {
            this._open = visible;
        }));
    },

    _pushResult: function(command, obj, tooltip) {
        let index = this._results.length;
        let result = {"o": obj, "index": index};
        let [type, value] = getObjInfo(obj);
        this.rawResults.push({command: command, type: type, object: value, index: index.toString(), tooltip: tooltip});
        this.emitResultUpdate();

        this._results.push(result);
        this._it = obj;
    },

    inspect: function(path) {
        let fullCmd = commandHeader + path;
        let result = tryEval(fullCmd);
        return getObjKeyInfos(result);
    },

    getIt: function () {
        return this._it;
    },

    getResult: function(idx) {
        return this._results[idx].o;
    },

    getWindow: function(idx) {
        return this._windowList.getWindowById(idx);
    },

    getWindowApp: function(idx) {
        let metaWindow = this._windowList.getWindowById(idx)
        if (metaWindow) {
            let tracker = Cinnamon.WindowTracker.get_default();
            return tracker.get_window_app(metaWindow);
        }
        return null;
    },

    // DBus function
    Eval: function(command) {
        this._history.addItem(command);

        let fullCmd = commandHeader + command;
        let ts = GLib.get_monotonic_time();

        let resultObj = tryEval(fullCmd);

        let ts2 = GLib.get_monotonic_time();
        let tooltip = _("Execution time (ms): ") + (ts2 - ts) / 1000;

        this._pushResult(command, resultObj, tooltip);
    },

    // DBus function
    GetResults: function() {
        return [true, this.rawResults];
    },

    // DBus function
    AddResult: function(path) {
        let fullCmd = commandHeader + path;
        this._pushResult(path, tryEval(fullCmd), "");
    },

    // DBus function
    GetErrorStack: function() {
        return [true, Main._errorLogStack];
    },

    // DBus function
    GetMemoryInfo: function() {
        return null;
    },

    // DBus function
    FullGc: function() {
        System.gc();
    },

    // DBus function
    Inspect: function(path) {
        try {
            let result = this.inspect(path);
            return [true, result];
        } catch (e) {
            global.logError('Error inspecting path: ' + path, e);
            return [false, []];
        }
    },

    // DBus function
    GetLatestWindowList: function() {
        try {
            return [true, this._windowList.latestWindowList];
        } catch (e) {
            global.logError('Error getting latest window list', e);
            return [false, []];
        }
    },

    // DBus function
    StartInspector: function() {
        try {
            let inspector = new Inspector();
            inspector.connect('target', Lang.bind(this, function(i, target, stageX, stageY) {
                let name = '<inspect x:' + stageX + ' y:' + stageY + '>';
                this._pushResult(name, target, "Inspected actor");
            }));
            inspector.connect('closed', Lang.bind(this, function() {
                this.emitInspectorDone();
            }));
        } catch (e) {
            global.logError('Error starting inspector', e);
        }
    },

    // DBus function
    GetExtensionList: function() {
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
    },

    // DBus function
    ReloadExtension: function(uuid, type) {
        Extension.reloadExtension(uuid, Extension.Type[type]);
    },

    emitLogUpdate: function() {
        this._dbusImpl.emit_signal('LogUpdate', null);
    },

    emitWindowListUpdate: function() {
        this._dbusImpl.emit_signal('WindowListUpdate', null);
    },

    emitResultUpdate: function() {
        this._dbusImpl.emit_signal('ResultUpdate', null);
    },

    emitInspectorDone: function() {
        this._dbusImpl.emit_signal('InspectorDone', null);
    },

    emitExtensionListUpdate: function() {
        this._dbusImpl.emit_signal('ExtensionListUpdate', null);
    },
}
