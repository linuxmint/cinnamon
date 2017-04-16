// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const Gio = imports.gi.Gio;
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
                    'const color = function(pixel) { let c= new Clutter.Color(); c.from_pixel(pixel); return c; }; ' +
                    /* Special lookingGlass functions */
                    'const it = Main.lookingGlass.getIt(); ' +
                    'const a = Lang.bind(Main.lookingGlass, Main.lookingGlass.getWindowApp); '+
                    'const w = Lang.bind(Main.lookingGlass, Main.lookingGlass.getWindow); '+
                    'const r = Lang.bind(Main.lookingGlass, Main.lookingGlass.getResult); ';

const HISTORY_KEY = 'looking-glass-history';
function objectToString(o) {
    if (typeof(o) == typeof(objectToString)) {
        // special case this since the default is way, way too verbose
        return '<js function>';
    } else {
        return '' + o;
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
            if(metaWindow._lgId === id)
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
            // Avoid multiple connections
            if (!metaWindow._lookingGlassManaged) {
                metaWindow.connect('unmanaged', Lang.bind(this, this._updateWindowList));
                metaWindow._lookingGlassManaged = true;
                
                metaWindow._lgId = this.lastId;
                this.lastId++;
            }
            
            let lgInfo = { id: metaWindow._lgId.toString(), title: metaWindow.title, wmclass: metaWindow.get_wm_class(), app: ''};
            
            let app = tracker.get_window_app(metaWindow);
            if (app != null && !app.is_window_backed()) {
                lgInfo.app = app.get_id();
            } else {
                lgInfo.app = '<untracked>';
            }
            
            // Ignore menus
            let wtype = metaWindow.get_window_type();
            if(wtype != Meta.WindowType.MENU && wtype != Meta.WindowType.DROPDOWN_MENU && wtype != Meta.WindowType.POPUP_MENU)
                this.latestWindowList.push(lgInfo);
        }
        
        // Make sure the list changed before notifying listeneres
        let changed = oldWindowList.length != this.latestWindowList.length;
        if(!changed) {
            for(let i=0; i<oldWindowList.length; i++) {
                if(oldWindowList[i].id != this.latestWindowList[i].id) {
                    changed = true;
                    break;
                }
            }
        }
        if(changed)
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
        if(this.passThroughEvents)
            this._passThroughText.text = '(Press Pause or Control to disable event pass through)';
        else
            this._passThroughText.text = '(Press Pause or Control to enable event pass through)';
    },

    _onCapturedEvent: function (actor, event) {
        if(event.type() == Clutter.EventType.KEY_PRESS && (event.get_key_symbol() == Clutter.Control_L ||
                                                           event.get_key_symbol() == Clutter.Control_R ||
                                                           event.get_key_symbol() == Clutter.Pause)) {
            this.passThroughEvents = !this.passThroughEvents;
            this._updatePassthroughText();
            return true;
        }

        if(this.passThroughEvents)
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
        this.rawResults.push({command: command, type: typeof(obj), object: objectToString(obj), index: index.toString(), tooltip: tooltip});
        this.emitResultUpdate();
        
        this._results.push(result);
        this._it = obj;
    },

    inspect: function(path) {
        let fullCmd = commandHeader + path;

        let result = eval(fullCmd);
        let resultObj = [];
        for (let key in result) {
            let type = typeof(result[key]);

            //fixme: move this shortvalue stuff to python lg
            let shortValue, value;
            if (type === "undefined") {
                value = "";
                shortValue = "";
            } else if (result[key] === null) {
                value = "[null]";
                shortValue = value;
            } else {
                value = result[key].toString();
                shortValue = value;
                let i = value.indexOf('\n');
                let j = value.indexOf('\r');
                if( j != -1 && (i == -1 || i > j))
                    i = j;
                if(i != -1)
                    shortValue = value.substr(0, i) + '.. <more>';
            }
            resultObj.push({ name: key, type: type, value: value, shortValue: shortValue});
        }
        
        return resultObj;
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
        if(metaWindow) {
            let tracker = Cinnamon.WindowTracker.get_default();
            return tracker.get_window_app(metaWindow);
        }
        return null;
    },
    
    // DBus function
    Eval: function(command) {
        this._history.addItem(command);

        let fullCmd = commandHeader + command;

        let resultObj;

        let ts = new Date().getTime();

        try {
            resultObj = eval(fullCmd);
        } catch (e) {
            resultObj = '<exception ' + e + '>';
        }

        let ts2 = new Date().getTime();

        let tooltip = _("Execution time (ms): ") + (ts2 - ts);

        this._pushResult(command, resultObj, tooltip);

        return;
    },

    // DBus function
    GetResults: function() {
        return [true, this.rawResults];
    },

    // DBus function
    AddResult: function(path) {
        let fullCmd = commandHeader + path;

        let resultObj;
        try {
            resultObj = eval(fullCmd);
        } catch (e) {
            resultObj = '<exception ' + e + '>';
        }
        this._pushResult(path, resultObj, "");
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
                this._pushResult('<inspect x:' + stageX + ' y:' + stageY + '>',
                                 target, "");
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
            let extensionList = [];
            for (let type in Extension.Type) {
                type = Extension.Type[type];
                for(let uuid in type.maps.meta){
                    let meta = type.maps.meta[uuid];
                    // There can be cases where we create dummy extension metadata
                    // that's not really a proper extension. Don't bother with these.
                    if (meta.name) {
                        extensionList.push({
                            status: Extension.getMetaStateString(meta.state),
                            name: meta.name,
                            description: meta.description,
                            uuid: uuid,
                            folder: meta.path,
                            url: meta.url ? meta.url : '',
                            type: type.name,
                            error_message: meta.error ? meta.error : _("Loaded successfully"),
                            error: meta.error ? "true" : "false" // Must use string due to dbus restrictions
                        });
                    }
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
