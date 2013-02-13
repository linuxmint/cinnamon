// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Extension = imports.ui.extension;

const LG_SERVICE_NAME = 'org.Cinnamon.LookingGlass';
const LG_SERVICE_PATH = '/org/Cinnamon/LookingGlass';
const LookingGlassIface = <interface name={LG_SERVICE_NAME}>
<method name="Eval">
    <arg type="s" direction="in" name="code"/>
</method>
<method name="GetResults">
    <arg type="b" direction="out" name="success"/>
    <arg type="s" direction="out" name="json object"/>
</method>
<method name="AddResult">
    <arg type="s" direction="in" name="code"/>
</method>
<method name="GetErrorStack">
    <arg type="b" direction="out" name="success"/>
    <arg type="s" direction="out" name="json object"/>
</method>
<method name="GetMemoryInfo">
    <!-- bi{si} -->
    <arg type="b" direction="out" name="success"/>
    <arg type="s" direction="out" name="json object"/>
</method>
<method name="FullGc">
</method>
<method name="Inspect">
    <arg type="s" direction="in" name="code"/>
    <arg type="b" direction="out" name="success"/>
    <arg type="s" direction="out" name="json object"/>
</method>
<method name="GetLatestWindowList">
    <arg type="b" direction="out" name="success"/>
    <arg type="s" direction="out" name="json object"/>
</method>
<method name="StartInspector">
</method>
<method name="GetExtensionList">
    <arg type="b" direction="out" name="success"/>
    <arg type="s" direction="out" name="json object"/>
</method>
<method name="ReloadExtension">
    <arg type="s" direction="in" name="uuid"/>
</method>
<signal name="LogUpdate"></signal>
<signal name="WindowListUpdate"></signal>
<signal name="ResultUpdate"></signal>
<signal name="InspectorDone"></signal>
<signal name="ExtensionListUpdate"></signal>
</interface>;

function getJsonReturnBS(object) {
    let returnValue;
    let success;
    try {
        returnValue = JSON.stringify(object);
        // A hack; DBus doesn't have null/undefined
        if (returnValue == undefined)
            returnValue = '';
        success = true;
    } catch (e) {
        returnValue = JSON.stringify(e);
        success = false;
    }
    return [success, returnValue];
}

function CinnamonLookingGlass() {
    this._init();
}

CinnamonLookingGlass.prototype = {
    _init: function() {
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(LookingGlassIface, this);
        this._dbusImpl.export(Gio.DBus.session, LG_SERVICE_PATH);

        Gio.DBus.session.own_name(LG_SERVICE_NAME, Gio.BusNameOwnerFlags.REPLACE, null, null);
    },

    Eval: function(code) {
        Main.createLookingGlass()._evaluate(code);
    },
    
    GetResults: function() {
        return getJsonReturnBS(Main.createLookingGlass().rawResults);
    },
    
    AddResult: function(path) {
        Main.createLookingGlass().addResult(path);
    },
    
    GetErrorStack: function() {
        return getJsonReturnBS(Main._errorLogStack);
    },
    
    GetMemoryInfo: function() {
        // can't use it raw, need to store it again
        let memInfo = global.get_memory_info();
        let memdata = {
            'glibc_uordblks': (memInfo.glibc_uordblks),
            'js_bytes': (memInfo.js_bytes),
            'gjs_boxed': (memInfo.gjs_boxed),
            'gjs_gobject': (memInfo.gjs_gobject),
            'gjs_function': (memInfo.gjs_function),
            'gjs_closure': (memInfo.gjs_closure),
            'last_gc_seconds_ago': (memInfo.last_gc_seconds_ago)
        };
        return getJsonReturnBS(memdata);
    },
    
    FullGc: function() {
        global.gc();
    },
    
    Inspect: function(path) {
        try {
            let result = Main.createLookingGlass().inspect(path);
            return getJsonReturnBS(result);
        } catch (e) {
            global.logError('Error inspecting path: ' + path, e);
            return [false, ''];
        }
    },
    
    GetLatestWindowList: function() {
        try {
            let windowList = Main.createLookingGlass().getLatestWindowList();
            return getJsonReturnBS(windowList);
        } catch (e) {
            global.logError('Error getting latest window list', e);
            return [false, ''];
        }
    },
    
    StartInspector: function() {
        try {
            Main.createLookingGlass().startInspector(true);
        } catch (e) {
            global.logError('Error starting inspector', e);
        }
    },
    
    GetExtensionList: function() {
        try {
            let extensionList = [];
            for (let uuid in Extension.meta) {
                let meta = Extension.meta[uuid];
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
                        type: Extension.objects[uuid].type.name
                    });
                }
            }
        
            return getJsonReturnBS(extensionList);
        } catch (e) {
            global.logError('Error getting the extension list', e);
            return [false, ''];
        }
    },
    
    ReloadExtension: function(uuid) {
        let extension = Extension.objects[uuid];
        if (extension) {
            let type = extension.type;
            Extension.unloadExtension(uuid);
            Extension.loadExtension(uuid, type);
        }
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
};
