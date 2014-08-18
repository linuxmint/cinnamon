// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Cogl = imports.gi.Cogl;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Meta = imports.gi.Meta;
const Pango = imports.gi.Pango;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const Lang = imports.lang;
const CinnamonJS = imports.gi.CinnamonJS;

const History = imports.misc.history;
const Extension = imports.ui.extension;
const Link = imports.ui.link;
const CinnamonEntry = imports.ui.cinnamonEntry;
const Tweener = imports.ui.tweener;
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

function Notebook() {
    this._init();
}

Notebook.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout({ vertical: true });

        this.tabControls = new St.BoxLayout({ style_class: 'labels' });

        this._selectedIndex = -1;
        this._tabs = [];
    },

    appendPage: function(name, child) {
        let labelBox = new St.BoxLayout({ style_class: 'notebook-tab',
                                          reactive: true,
                                          track_hover: true });
        let label = new St.Button({ label: name });
        label.connect('clicked', Lang.bind(this, function () {
            this.selectChild(child);
            return true;
        }));
        labelBox.add(label, { expand: true });
        this.tabControls.add(labelBox);

        let scrollview = new St.ScrollView({ x_fill: true, y_fill: true });
        scrollview.get_hscroll_bar().hide();
        scrollview.add_actor(child);

        let tabData = { child: child,
                        labelBox: labelBox,
                        label: label,
                        scrollView: scrollview,
                        _scrollToBottom: false };
        this._tabs.push(tabData);
        scrollview.hide();
        this.actor.add(scrollview, { expand: true });

        let vAdjust = scrollview.vscroll.adjustment;
        vAdjust.connect('changed', Lang.bind(this, function () { this._onAdjustScopeChanged(tabData); }));
        vAdjust.connect('notify::value', Lang.bind(this, function() { this._onAdjustValueChanged(tabData); }));

        if (this._selectedIndex == -1)
            this.selectIndex(0);
    },

    _unselect: function() {
        if (this._selectedIndex < 0)
            return;
        let tabData = this._tabs[this._selectedIndex];
        tabData.labelBox.remove_style_pseudo_class('selected');
        tabData.scrollView.hide();
        this._selectedIndex = -1;
    },

    selectIndex: function(index) {
        if (index == this._selectedIndex)
            return;
        if (index < 0) {
            this._unselect();
            this.emit('selection', null);
            return;
        }

        // Focus the new tab before unmapping the old one
        let tabData = this._tabs[index];
        if (!tabData.scrollView.navigate_focus(null, Gtk.DirectionType.TAB_FORWARD, false))
            this.actor.grab_key_focus();

        this._unselect();

        tabData.labelBox.add_style_pseudo_class('selected');
        tabData.scrollView.show();
        this._selectedIndex = index;
        this.emit('selection', tabData.child);
    },

    selectChild: function(child) {
        if (child == null)
            this.selectIndex(-1);
        else {
            for (let i = 0; i < this._tabs.length; i++) {
                let tabData = this._tabs[i];
                if (tabData.child == child) {
                    this.selectIndex(i);
                    return;
                }
            }
        }
    },

    scrollToBottom: function(index) {
        let tabData = this._tabs[index];
        tabData._scrollToBottom = true;

    },

    _onAdjustValueChanged: function (tabData) {
        let vAdjust = tabData.scrollView.vscroll.adjustment;
        if (vAdjust.value < (vAdjust.upper - vAdjust.lower - 0.5))
            tabData._scrolltoBottom = false;
    },

    _onAdjustScopeChanged: function (tabData) {
        if (!tabData._scrollToBottom)
            return;
        let vAdjust = tabData.scrollView.vscroll.adjustment;
        vAdjust.value = vAdjust.upper - vAdjust.page_size;
    }
};
Signals.addSignalMethods(Notebook.prototype);

function objectToString(o) {
    if (typeof(o) == typeof(objectToString)) {
        // special case this since the default is way, way too verbose
        return '<js function>';
    } else {
        return '' + o;
    }
}

function ObjLink(o, title) {
    this._init(o, title);
}

ObjLink.prototype = {
    __proto__: Link.Link,

    _init: function(o, title) {
        let text;
        if (title)
            text = title;
        else
            text = objectToString(o);
        text = GLib.markup_escape_text(text, -1);
        this._obj = o;
        Link.Link.prototype._init.call(this, { label: text });
        this.actor.get_child().single_line_mode = true;
        this.actor.connect('clicked', Lang.bind(this, this._onClicked));
    },

    _onClicked: function (link) {
        Main.lookingGlass.inspectObject(this._obj);
    }
};

function Result(command, o, index) {
    this._init(command, o, index);
}

Result.prototype = {
    _init : function(command, o, index) {
        this.index = index;
        this.o = o;

        this.actor = new St.BoxLayout({ vertical: true });

        let cmdTxt = new St.Label({ text: command });
        cmdTxt.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.actor.add(cmdTxt);
        let box = new St.BoxLayout({});
        this.actor.add(box);
        let resultTxt = new St.Label({ text: 'r(' + index + ') = ' });
        resultTxt.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        box.add(resultTxt);
        let objLink = new ObjLink(o);
        box.add(objLink.actor);
        let line = new Clutter.Rectangle({ name: 'Separator' });
        let padBin = new St.Bin({ name: 'Separator', x_fill: true, y_fill: true });
        padBin.add_actor(line);
        this.actor.add(padBin);
    }
};

function WindowList() {
    this._init();
}

WindowList.prototype = {
    _init : function () {
        this.lastId = 0;
        this.latestWindowList = [];
        
        this.actor = new St.BoxLayout({ name: 'Windows', vertical: true, style: 'spacing: 8px' });
        let tracker = Cinnamon.WindowTracker.get_default();
        this._updateId = Main.initializeDeferredWork(this.actor, Lang.bind(this, this._updateWindowList));
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
        this.actor.get_children().forEach(function (actor) { actor.destroy(); });
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
            
            let box = new St.BoxLayout({ vertical: true });
            this.actor.add(box);
            let windowLink = new ObjLink(metaWindow, metaWindow.title);
            box.add(windowLink.actor, { x_align: St.Align.START, x_fill: false });
            let propsBox = new St.BoxLayout({ vertical: true, style: 'padding-left: 6px;' });
            box.add(propsBox);
            propsBox.add(new St.Label({ text: 'wmclass: ' + metaWindow.get_wm_class() }));
            let app = tracker.get_window_app(metaWindow);
            if (app != null && !app.is_window_backed()) {
                let icon = app.create_icon_texture(22);
                let propBox = new St.BoxLayout({ style: 'spacing: 6px; ' });
                propsBox.add(propBox);
                propBox.add(new St.Label({ text: 'app: ' }), { y_fill: false });
                let appLink = new ObjLink(app, app.get_id());
                propBox.add(appLink.actor, { y_fill: false });
                propBox.add(icon, { y_fill: false });
                
                lgInfo.app = app.get_id();
            } else {
                propsBox.add(new St.Label({ text: '<untracked>' }));
                
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
            Main.lookingGlassDBusService.emitWindowListUpdate();
    }
};
Signals.addSignalMethods(WindowList.prototype);

function ObjInspector() {
    this._init();
}

ObjInspector.prototype = {
    _init : function () {
        this._obj = null;
        this._previousObj = null;

        this._parentList = [];

        this.actor = new St.ScrollView({ x_fill: true, y_fill: true });
        this.actor.get_hscroll_bar().hide();
        this._container = new St.BoxLayout({ name: 'LookingGlassPropertyInspector',
                                             style_class: 'lg-dialog',
                                             vertical: true });
        this.actor.add_actor(this._container);
    },

    selectObject: function(obj, skipPrevious) {
        if (!skipPrevious)
            this._previousObj = this._obj;
        else
            this._previousObj = null;
        this._obj = obj;

        this._container.get_children().forEach(function (child) { child.destroy(); });

        let hbox = new St.BoxLayout({ style_class: 'lg-obj-inspector-title' });
        this._container.add_actor(hbox);
        let label = new St.Label({ text: 'Inspecting: %s: %s'.format(typeof(obj),
                                                                     objectToString(obj)) });
        label.single_line_mode = true;
        hbox.add(label, { expand: true, y_fill: false });
        let button = new St.Button({ label: 'Insert', style_class: 'lg-obj-inspector-button' });
        button.connect('clicked', Lang.bind(this, this._onInsert));
        hbox.add(button);

        if (this._previousObj != null) {
            button = new St.Button({ label: 'Back', style_class: 'lg-obj-inspector-button' });
            button.connect('clicked', Lang.bind(this, this._onBack));
            hbox.add(button);
        }

        button = new St.Button({ style_class: 'window-close' });
        button.connect('clicked', Lang.bind(this, this.close));
        hbox.add(button);
        if (typeof(obj) == typeof({})) {
            for (let propName in obj) {
                let valueStr;
                let link;
                try {
                    let prop = obj[propName];
                    link = new ObjLink(prop).actor;
                } catch (e) {
                    link = new St.Label({ text: '<error>' });
                }
                let hbox = new St.BoxLayout();
                let propText = propName + ': ' + valueStr;
                hbox.add(new St.Label({ text: propName + ': ' }));
                hbox.add(link);
                this._container.add_actor(hbox);
            }
        }
    },

    open: function(sourceActor) {
        if (this._open)
            return;
        this._previousObj = null;
        this._open = true;
        this.actor.show();
    },

    close: function() {
        if (!this._open)
            return;
        this._open = false;
        this.actor.hide();
        this._previousObj = null;
        this._obj = null;
    },

    _onInsert: function() {
        let obj = this._obj;
        this.close();
        Main.lookingGlass.insertObject(obj);
    },

    _onBack: function() {
        this.selectObject(this._previousObj, true);
    }
};

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

function ErrorLog() {
    this._init();
}

ErrorLog.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout();
        this.text = new St.Label();
        this.actor.add(this.text);
        // We need to override StLabel's default ellipsization when
        // using line_wrap; otherwise ClutterText's layout is going
        // to constrain both the width and height, which prevents
        // scrolling.
        this.text.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.text.clutter_text.line_wrap = true;
        this.actor.connect('notify::mapped', Lang.bind(this, this._renderText));
        this.addedErrors = 0;
    },

    _formatTime: function(d){
        function pad(n) { return n < 10 ? '0' + n : n; }
        return d.getUTCFullYear()+'-'
            + pad(d.getUTCMonth()+1)+'-'
            + pad(d.getUTCDate())+'T'
            + pad(d.getUTCHours())+':'
            + pad(d.getUTCMinutes())+':'
            + pad(d.getUTCSeconds())+'Z';
    },

    _renderText: function() {
        if (!this.actor.mapped)
            return;

        let stack = Main._errorLogStack;
        if(stack.length > this.addedErrors) {
            for (var text = this.text.text; this.addedErrors < stack.length; 
                 this.addedErrors++) {
                let logItem = stack[this.addedErrors];
                text += logItem.category + ' t=' + this._formatTime(new Date(parseInt(logItem.timestamp))) + ' ' + logItem.message + '\n';
            }
            this.text.text = text;
        }
    }
};

function Memory() {
    this._init();
}

Memory.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout({ vertical: true });
        this._glibc_uordblks = new St.Label();
        this.actor.add(this._glibc_uordblks);

        this._js_bytes = new St.Label();
        this.actor.add(this._js_bytes);

        this._gjs_boxed = new St.Label();
        this.actor.add(this._gjs_boxed);

        this._gjs_gobject = new St.Label();
        this.actor.add(this._gjs_gobject);

        this._gjs_function = new St.Label();
        this.actor.add(this._gjs_function);

        this._gjs_closure = new St.Label();
        this.actor.add(this._gjs_closure);

        this._last_gc_seconds_ago = new St.Label();
        this.actor.add(this._last_gc_seconds_ago);

        this._gcbutton = new St.Button({ label: 'Full GC',
                                         style_class: 'lg-obj-inspector-button' });
        this._gcbutton.connect('clicked', Lang.bind(this, function () { global.gc(); this._renderText(); }));
        this.actor.add(this._gcbutton, { x_align: St.Align.START,
                                         x_fill: false });

        this.actor.connect('notify::mapped', Lang.bind(this, this._renderText));
    },

    _renderText: function() {
        if (!this.actor.mapped)
            return;
        let memInfo = global.get_memory_info();
        this._glibc_uordblks.text = 'glibc_uordblks: ' + memInfo.glibc_uordblks;
        this._js_bytes.text = 'js bytes: ' + memInfo.js_bytes;
        this._gjs_boxed.text = 'gjs_boxed: ' + memInfo.gjs_boxed;
        this._gjs_gobject.text = 'gjs_gobject: ' + memInfo.gjs_gobject;
        this._gjs_function.text = 'gjs_function: ' + memInfo.gjs_function;
        this._gjs_closure.text = 'gjs_closure: ' + memInfo.gjs_closure;
        this._last_gc_seconds_ago.text = 'last_gc_seconds_ago: ' + memInfo.last_gc_seconds_ago;
    }
};

function Extensions(type) {
    this._init(type);
}

Extensions.prototype = {
    _init: function(type) {
        this.type = type;
        this.actor = new St.BoxLayout({ vertical: true,
                                        name: 'lookingGlass' + type.name });
        this._noExtensions = new St.Label({ style_class: 'lg-extensions-none',
                                             text: _("No extensions installed") });
        this._numExtensions = 0;
        this._extensionsList = new St.BoxLayout({ vertical: true,
                                                  style_class: 'lg-extensions-list' });
        this._extensionsList.add(this._noExtensions);
        this.actor.add(this._extensionsList);
        
        this.uuidMap = {};
        for (let uuid in Extension.meta) {
            this._loadExtension(null, uuid);
        }

        type.connect('extension-loaded', Lang.bind(this, this._loadExtension));
        type.connect('extension-unloaded', Lang.bind(this, this._unloadExtension));
    },

    _loadExtension: function(o, uuid) {
        let meta = Extension.meta[uuid];
        // There can be cases where we create dummy extension metadata
        // that's not really a proper extension. Don't bother with these.
        if (!meta.name)
            return;

        // If extension is broken
        if (!Extension.objects[uuid])
            return;

        // Only load extensions
        if(Extension.objects[uuid].type.name != this.type.name)
            return;

        let extensionDisplay = this._createExtensionDisplay(meta);
        if (this._numExtensions == 0)
            this._extensionsList.remove_actor(this._noExtensions);

        this._numExtensions ++;
        this._extensionsList.add(extensionDisplay);
        this.uuidMap[uuid] = extensionDisplay;

        Main.lookingGlassDBusService.emitExtensionListUpdate();
    },

    _unloadExtension: function(o, uuid) {
        //Fixme: not optimal, since extensions added later will only show if no error happens
        // and extensions failing to reload will be removed.
        let extensionDisplay = this.uuidMap[uuid];
        this._extensionsList.remove_actor(extensionDisplay);
        delete this.uuidMap[uuid];
        
        this._numExtensions--;
        if (this._numExtensions == 0)
            this._extensionsList.add(this._noExtensions);

        Main.lookingGlassDBusService.emitExtensionListUpdate();
    },

    _onViewSource: function (actor) {
        let meta = actor._extensionMeta;
        let file = Gio.file_new_for_path(meta.path);
        let uri = file.get_uri();
        Gio.app_info_launch_default_for_uri(uri, global.create_app_launch_context());
        Main.lookingGlass.close();
    },

    _onReload: function (actor) {
        let meta = actor._extensionMeta;
        Extension.unloadExtension(meta.uuid);
        Extension.loadExtension(meta.uuid, this.type);
        Main.lookingGlass.close();
    },
    
    _onWebPage: function (actor) {
        let meta = actor._extensionMeta;
        Gio.app_info_launch_default_for_uri(meta.url, global.create_app_launch_context());
        Main.lookingGlass.close();
    },

    _createExtensionDisplay: function(meta) {
        let box = new St.BoxLayout({ style_class: 'lg-extension', vertical: true });
        let name = new St.Label({ style_class: 'lg-extension-name',
                                   text: meta.name });
        box.add(name, { expand: true });
        let description = new St.Label({ style_class: 'lg-extension-description',
                                         text: meta.description || 'No description' });
        box.add(description, { expand: true });

        let metaBox = new St.BoxLayout({ style_class: 'lg-extension-meta' });
        box.add(metaBox);
        let state = new St.Label({ style_class: 'lg-extension-state',
                                   text: Extension.getMetaStateString(meta.state) + " "});
        metaBox.add(state);
        
        let viewsource = new Link.Link({ label: _("View Source") });
        viewsource.actor._extensionMeta = meta;
        viewsource.actor.connect('clicked', Lang.bind(this, this._onViewSource));
        metaBox.add(viewsource.actor);
        
        let space = new St.Label({text: " "});
        metaBox.add(space);

        if (meta.url) {
            let webpage = new Link.Link({ label: _("Web Page") });
            webpage.actor._extensionMeta = meta;
            webpage.actor.connect('clicked', Lang.bind(this, this._onWebPage));
            metaBox.add(webpage.actor);
        
            let space = new St.Label({text: " "});
            metaBox.add(space);
        }
        
        let reload = new Link.Link({ label: _("Reload Code") });
        reload.actor._extensionMeta = meta;
        reload.actor.connect('clicked', Lang.bind(this, this._onReload));
        metaBox.add(reload.actor);

        return box;
    }
};

function LookingGlass() {
    this._init();
}

LookingGlass.prototype = {
    _init : function() {
        this._borderPaintTarget = null;
        this._borderPaintId = 0;
        this._borderDestroyId = 0;

        this._open = false;

        this._offset = 0;
        this._results = [];
        this.rawResults = [];

        // Sort of magic, but...eh.
        this._maxItems = 150;

        this.actor = new St.BoxLayout({ name: 'LookingGlassDialog',
                                        style_class: 'lg-dialog',
                                        vertical: true,
                                        visible: false });
        this.actor.connect('key-press-event', Lang.bind(this, this._globalKeyPressEvent));

        this._interfaceSettings = new Gio.Settings({ schema: 'org.gnome.desktop.interface' });
        this._interfaceSettings.connect('changed::monospace-font-name',
                                        Lang.bind(this, this._updateFont));
        this._updateFont();

        // We want it to appear to slide out from underneath the panel
        Main.layoutManager.panelBox.add_actor(this.actor);
        this.actor.lower_bottom();
        Main.layoutManager.panelBox.connect('allocation-changed',
                                            Lang.bind(this, this._queueResize));
        Main.layoutManager.keyboardBox.connect('allocation-changed',
                                               Lang.bind(this, this._queueResize));

        this._objInspector = new ObjInspector();
        Main.uiGroup.add_actor(this._objInspector.actor);
        this._objInspector.actor.hide();

        let toolbar = new St.BoxLayout({ name: 'Toolbar' });
        this.actor.add_actor(toolbar);
        let inspectIcon = new St.Icon({ icon_name: 'gtk-color-picker',
                                        icon_type: St.IconType.FULLCOLOR,
                                        icon_size: 24 });
        toolbar.add_actor(inspectIcon);
        inspectIcon.reactive = true;
        inspectIcon.connect('button-press-event', Lang.bind(this, this.startInspector));

        let notebook = new Notebook();
        this._notebook = notebook;
        this.actor.add(notebook.actor, { expand: true });

        let emptyBox = new St.Bin();
        toolbar.add(emptyBox, { expand: true });
        toolbar.add_actor(notebook.tabControls);

        this._evalBox = new St.BoxLayout({ name: 'EvalBox', vertical: true });
        notebook.appendPage('Evaluator', this._evalBox);

        this._resultsArea = new St.BoxLayout({ name: 'ResultsArea', vertical: true });
        this._evalBox.add(this._resultsArea, { expand: true });

        let entryArea = new St.BoxLayout({ name: 'EntryArea' });
        this._evalBox.add_actor(entryArea);

        let label = new St.Label({ text: 'js>>> ' });
        entryArea.add(label);

        this._entry = new St.Entry({ can_focus: true });
        CinnamonEntry.addContextMenu(this._entry);
        entryArea.add(this._entry, { expand: true });

        this._windowList = new WindowList();
        this._windowList.connect('selected', Lang.bind(this, function(list, window) {
            notebook.selectIndex(0);
            this._pushResult('<window selection>', window);
        }));
        notebook.appendPage('Windows', this._windowList.actor);

        this._errorLog = new ErrorLog();
        notebook.appendPage('Errors', this._errorLog.actor);

        this._memory = new Memory();
        notebook.appendPage('Memory', this._memory.actor);

        this._applets = new Extensions(Extension.Type.APPLET);
        notebook.appendPage('Applets', this._applets.actor);

        this._extensions = new Extensions(Extension.Type.EXTENSION);
        notebook.appendPage('Extensions', this._extensions.actor);

        this._desklets = new Extensions(Extension.Type.DESKLET);
        notebook.appendPage('Desklets', this._desklets.actor);

        this._entry.clutter_text.connect('activate', Lang.bind(this, function (o, e) {
            let text = o.get_text();
            // Ensure we don't get newlines in the command; the history file is
            // newline-separated.
            text.replace('\n', ' ');
            // Strip leading and trailing whitespace
            text = text.replace(/^\s+/g, '').replace(/\s+$/g, '');
            if (text == '')
                return true;
            this._evaluate(text);
            return true;
        }));

        this._history = new History.HistoryManager({ gsettingsKey: HISTORY_KEY, 
                                                     entry: this._entry.clutter_text });

        this._resize();
    },
    
    startInspector: function(closeAfter) {
        if (!this._open)
            this.open();
            
        let inspector = new Inspector();
        inspector.connect('target', Lang.bind(this, function(i, target, stageX, stageY) {
            this._pushResult('<inspect x:' + stageX + ' y:' + stageY + '>',
                             target);
        }));
        inspector.connect('closed', Lang.bind(this, function() {
            if(closeAfter === true) {
                this.actor.hide();
                this.close();
                Main.lookingGlassDBusService.emitInspectorDone();
            } else {
                this.actor.show();
                global.stage.set_key_focus(this._entry);
            }
        }));
        this.actor.hide();
        return true;
    },

    _updateFont: function() {
        let fontName = this._interfaceSettings.get_string('monospace-font-name');
        // This is mishandled by the scanner - should by Pango.FontDescription_from_string(fontName);
        // https://bugzilla.gnome.org/show_bug.cgi?id=595889
        let fontDesc = Pango.font_description_from_string(fontName);
        // We ignore everything but size and style; you'd be crazy to set your system-wide
        // monospace font to be bold/oblique/etc. Could easily be added here.
        this.actor.style =
            'font-size: ' + fontDesc.get_size() / 1024. + (fontDesc.get_size_is_absolute() ? 'px' : 'pt') + ';'
            + 'font-family: "' + fontDesc.get_family() + '";';
    },

    _pushResult: function(command, obj) {
        let index = this._results.length + this._offset;
        let result = new Result('>>> ' + command, obj, index);
        this.rawResults.push({command: command, type: typeof(obj), object: objectToString(obj), index: index.toString()});
        Main.lookingGlassDBusService.emitResultUpdate();
        
        this._results.push(result);
        this._resultsArea.add(result.actor);
        if (this._borderPaintTarget != null) {
            this._borderPaintTarget.disconnect(this._borderPaintId);
            this._borderPaintTarget = null;
        }
        if (obj instanceof Clutter.Actor) {
            this._borderPaintTarget = obj;
            this._borderPaintId = addBorderPaintHook(obj);
            this._borderDestroyId = obj.connect('destroy', Lang.bind(this, function () {
                this._borderDestroyId = 0;
                this._borderPaintTarget = null;
            }));
        }
        let children = this._resultsArea.get_children();
        if (children.length > this._maxItems) {
            this._results.shift();
            children[0].destroy();
            this._offset++;
        }
        this._it = obj;

        // Scroll to bottom
        this._notebook.scrollToBottom(0);
    },

    _evaluate : function(command) {
        this._history.addItem(command);

        let fullCmd = commandHeader + command;

        let resultObj;

        /*  Set up for some reporting about memory impact and execution speed.
            The performance impact of CinnamonJS.get_memory_info should be 
            very small, whereas getting a timestamp might involve some 
            memory allocation, so we grab the timestamp first.
        */
        let ts = new Date().getTime();
        let memInfo = global.get_memory_info();
        
        try {
            resultObj = eval(fullCmd);
        } catch (e) {
            resultObj = '<exception ' + e + '>';
        }
        let memInfo2 = global.get_memory_info();
        let ts2 = new Date().getTime();

        this._pushResult(command, resultObj);

        let memdata = [
            'uordblks: ' + (memInfo2.glibc_uordblks),
            'js_bytes: ' + (memInfo2.js_bytes),
            'gjs_boxed: ' + (memInfo2.gjs_boxed),
            'gjs_gobject: ' + (memInfo2.gjs_gobject),
            'gjs_function: ' + (memInfo2.gjs_function),
            'gjs_closure: ' + (memInfo2.gjs_closure)
        ];
        this._pushResult("<memstate>", memdata.join('; '));
        let memdataDiff = [
            'uordblks: ' + (memInfo2.glibc_uordblks - memInfo.glibc_uordblks),
            'js_bytes: ' + (memInfo2.js_bytes - memInfo.js_bytes),
            'gjs_boxed: ' + (memInfo2.gjs_boxed - memInfo.gjs_boxed),
            'gjs_gobject: ' + (memInfo2.gjs_gobject - memInfo.gjs_gobject),
            'gjs_function: ' + (memInfo2.gjs_function - memInfo.gjs_function),
            'gjs_closure: ' + (memInfo2.gjs_closure - memInfo.gjs_closure)
        ];
        this._pushResult("<memdiff>", memdataDiff.join('; '));
        this._pushResult("<execution time (ms)>", ts2 - ts);
        this._entry.text = '';
    },

    inspect : function(path) {
        let fullCmd = commandHeader + path;

        let result = eval(fullCmd);
        let resultObj = [];
        for(let key in result) {
            let type = typeof(result[key]);
            let value = result[key].toString();
            
            //fixme: move this shortvalue stuff to python lg
            let shortValue = value;
            if (value === undefined) {
                value = "";
                shortValue = "";
            } else {
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
        return this._results[idx - this._offset].o;
    },

    addResult: function(path) {
        let fullCmd = commandHeader + path;

        let resultObj;
        try {
            resultObj = eval(fullCmd);
        } catch (e) {
            resultObj = '<exception ' + e + '>';
        }
        this._pushResult(path, resultObj);
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
    
    getLatestWindowList: function() {
        return this._windowList.latestWindowList;
    },

    toggle: function() {
        if (this._open)
            this.close();
        else
            this.open();
    },

    _queueResize: function() {
        Meta.later_add(Meta.LaterType.BEFORE_REDRAW,
                       Lang.bind(this, function () { this._resize(); }));
    },

    _resize: function() {
        let primary = Main.layoutManager.primaryMonitor;
        let myWidth = primary.width * 0.7;
        let availableHeight = primary.height - Main.layoutManager.keyboardBox.height;
        let myHeight = Math.min(primary.height * 0.7, availableHeight * 0.9);
        this.actor.x = (primary.width - myWidth) / 2;
        
        let yOffset;
        if (Main.desktop_layout == Main.LAYOUT_TRADITIONAL) {
            this._targetY = -myHeight;
            this._hiddenY = -this.actor.get_parent().height;
            yOffset = this._hiddenY;
        } else {       
            this._hiddenY = this.actor.get_parent().height - myHeight - 4; // -4 to hide the top corners
            this._targetY = this._hiddenY + myHeight;
            yOffset = this._targetY;
        }
        
        this.actor.y = this._hiddenY;
        this.actor.width = myWidth;
        this.actor.height = myHeight;
        this._objInspector.actor.set_size(Math.floor(myWidth * 0.8), Math.floor(myHeight * 0.8));
        
        // Use the position of primary.x, y to reposition the
        // objInspector with respect to multiple monitors.
        this._objInspector.actor.set_anchor_point(0, 0); // reset anchor point
        this._objInspector.actor.set_position(
                    primary.x + this.actor.x + Math.floor(myWidth * 0.1),
                    primary.y + yOffset + Math.floor(myHeight * 0.1)
        );
    },

    insertObject: function(obj) {
        this._pushResult('<insert>', obj);
    },

    inspectObject: function(obj) {
        this._objInspector.open();
        this._objInspector.selectObject(obj);
    },

    // Handle key events which are relevant for all tabs of the LookingGlass
    _globalKeyPressEvent : function(actor, event) {
        let symbol = event.get_key_symbol();
        let newIndex;

        if (symbol == Clutter.Escape) {
            if (this._objInspector.actor.visible) {
                this._objInspector.close();
            } else {
                this.close();
            }
            return true;
        } else if (symbol == Clutter.Page_Down) {
            newIndex = this._notebook._selectedIndex + 1;
            if (newIndex == this._notebook._tabs.length) {
                newIndex = 0;
            }
        } else if (symbol == Clutter.Page_Up) {
            newIndex = this._notebook._selectedIndex - 1;
            if (newIndex == -1){
                newIndex = this._notebook._tabs.length - 1;
            }
        }

        if(newIndex) {
            this._notebook.selectIndex(newIndex);
            return true;
        }

        return false;
    },

    open : function() {
        if (this._open)
            return;

        if (!Main.pushModal(this._entry))
            return;

        this._notebook.selectIndex(0);
        this.actor.show();
        this._open = true;
        this._history.lastItem();

        Tweener.removeTweens(this.actor);

        // We inverse compensate for the slow-down so you can change the factor
        // through LookingGlass without long waits.
        Tweener.addTween(this.actor, { time: 0.5 / St.get_slow_down_factor(),
                                       transition: 'easeOutQuad',
                                       y: this._targetY
                                     });
    },

    close : function() {
        if (!this._open)
            return;

        this._objInspector.actor.hide();

        this._open = false;
        Tweener.removeTweens(this.actor);

        if (this._borderPaintTarget != null) {
            this._borderPaintTarget.disconnect(this._borderPaintId);
            this._borderPaintTarget.disconnect(this._borderDestroyId);
            this._borderPaintTarget = null;
        }

        Main.popModal(this._entry);

        Tweener.addTween(this.actor, { time: 0.5 / St.get_slow_down_factor(),
                                       transition: 'easeOutQuad',
                                       y: this._hiddenY,
                                       onComplete: Lang.bind(this, function () {
                                           this.actor.hide();
                                       })
                                     });
    }
};
Signals.addSignalMethods(LookingGlass.prototype);

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

const proxy = Gio.DBusProxy.makeProxyWrapper(dbusIFace);

function Melange() {
    this._init.apply(this, arguments);
}

Melange.prototype = {
    _init: function() {
        this.proxy = null;
        this._open = false;
        this._settings = new Gio.Settings({schema: "org.cinnamon.desktop.keybindings"});
        this._settings.connect("changed::looking-glass-keybinding", Lang.bind(this, this._update_keybinding));
        this._update_keybinding();
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
    }
}
