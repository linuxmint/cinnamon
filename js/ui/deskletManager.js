// -*- indent-tabs-mode: nil -*-
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;

const Desklet = imports.ui.desklet;
const DND = imports.ui.dnd;
const Extension = imports.ui.extension;
const Main = imports.ui.main;

// Maps uuid -> metadata object
var deskletMeta;
// Maps uuid -> importer object (desklet directory tree)
var desklets;
// Maps uuid -> desklet objects
var deskletObj = {};

var enabledDeskletDefinitions;

var deskletsLoaded = false;

var deskletsDragging = false;

let userDeskletsDir;

let mouseTrackEnabled = false;
let mouseTrackTimoutId = 0;

const ENABLED_DESKLETS_KEY = 'enabled-desklets';
const DESKLET_SNAP_KEY = 'desklet-snap';
const DESKLET_SNAP_INTERVAL_KEY = 'desklet-snap-interval';
/**
 * init:
 *
 * Initialize desklet manager
 */
function init(){
    desklets = Extension.Type.DESKLET.maps.importObjects;
    deskletMeta = Extension.Type.DESKLET.maps.meta;

    deskletsLoaded = false

    enabledDeskletDefinitions = getEnabledDeskletDefinitions();
    let hasDesklets = false;
    for (let uuid in enabledDeskletDefinitions.uuidMap) {
        if(Extension.loadExtension(uuid, Extension.Type.DESKLET))
            hasDesklets = true;
    }

    global.settings.connect('changed::' + ENABLED_DESKLETS_KEY, _onEnabledDeskletsChanged);
    global.settings.connect('changed::' + DESKLET_SNAP_KEY, _onDeskletSnapChanged);
    global.settings.connect('changed::' + DESKLET_SNAP_INTERVAL_KEY, _onDeskletSnapChanged);

    deskletsLoaded = true;
    enableMouseTracking(true);
}

function enableMouseTracking(enable) {
    if(enable && !mouseTrackTimoutId)
        mouseTrackTimoutId = Mainloop.timeout_add(500, checkMouseTracking);
    else if (!enable && mouseTrackTimoutId) {
        Mainloop.source_remove(mouseTrackTimoutId);
        mouseTrackTimoutId = 0;
        for(let desklet_id in deskletObj) {
            deskletObj[desklet_id]._untrackMouse();
        }
    }
}

function hasMouseWindow(){
    let window = global.screen.get_mouse_window(null);
    return window && window.window_type != Meta.WindowType.DESKTOP;
}

function checkMouseTracking() {
    let enable = !hasMouseWindow();
    if(mouseTrackEnabled != enable) {
        mouseTrackEnabled = enable;
        if(enable) {
            for(let desklet_id in deskletObj) {
                deskletObj[desklet_id]._trackMouse();
            }
        } else {
            for(let desklet_id in deskletObj) {
                deskletObj[desklet_id]._untrackMouse();
            }
        }
    }
    return true;
}

/**
 * removeDesklet:
 * @uuid (string): uuid of the desklet
 * @desklet_id (int): id of the desklet
 * 
 * Disable and remove the desklet @uuid:@desklet_id
 */
function removeDesklet(uuid, desklet_id){
    let list = global.settings.get_strv(ENABLED_DESKLETS_KEY);
    for (let i = 0; i < list.length; i++){
        let definition = list[i];
        let elements = definition.split(":");
        if (uuid == elements[0] && desklet_id == elements[1]) list.splice(i, 1);
    }
    global.settings.set_strv(ENABLED_DESKLETS_KEY, list);
}

/**
 * getEnabledDeskletDefinitons:
 *
 * Gets the list of enabled desklets. Returns an associative array of three items:
 * raw: the unprocessed array from gsettings
 * uuidMap: maps uuid -> list of desklet definitions
 * idMap: maps desklet_id -> single desklet definition
 *
 * Returns (dictionary): Associative array of three items
 */
function getEnabledDeskletDefinitions() {
    let result = {
        // the raw list from gsettings
        raw: global.settings.get_strv(ENABLED_DESKLETS_KEY),
        // maps uuid -> list of desklet definitions
        uuidMap: {},
        // maps desklet_id -> single desklet definition
        idMap: {}
    };

    // Parse all definitions
    for (let i=0; i<result.raw.length; i++) {
        let deskletDefinition = _getDeskletDefinition(result.raw[i]);
        if(deskletDefinition) {
            if(!result.uuidMap[deskletDefinition.uuid])
                result.uuidMap[deskletDefinition.uuid] = [];
            result.uuidMap[deskletDefinition.uuid].push(deskletDefinition);
            result.idMap[deskletDefinition.desklet_id] = deskletDefinition;
        }
    }

    return result;
}

// Callback for extension.js
function finishExtensionLoad(extension) {
    // Add all desklet instances for this extension
    let definitions = enabledDeskletDefinitions.uuidMap[extension.uuid];
    if (definitions) {
        for(let i=0; i<definitions.length; i++) {
            if (!_loadDesklet(extension, definitions[i]))
                return false;
        }
    }
    return true;
}

// Callback for extension.js
function prepareExtensionUnload(extension, deleteConfig) {
    // Remove all desklet instances for this extension
    for(let desklet_id in extension._loadedDefinitions) {
        _unloadDesklet(extension._loadedDefinitions[desklet_id], deleteConfig);
    }
}

function _onEnabledDeskletsChanged(){
    try{
        let newEnabledDeskletDefinitions = getEnabledDeskletDefinitions();
        // Remove all desklet instances that do not exist in the definition anymore.
        for (let desklet_id in enabledDeskletDefinitions.idMap) {
            if(!newEnabledDeskletDefinitions.idMap[desklet_id]) {
                _unloadDesklet(enabledDeskletDefinitions.idMap[desklet_id], true);
            }
        }

        // Unload all desklet extensions that do not exist in the definition anymore.
        for (let uuid in enabledDeskletDefinitions.uuidMap) {
            if(!newEnabledDeskletDefinitions.uuidMap[uuid]) {
                Extension.unloadExtension(uuid, Extension.Type.DESKLET);
            }
        }
        // Add or move desklet instances of already loaded desklet extensions
        for (let desklet_id in newEnabledDeskletDefinitions.idMap) {
            let newDef = newEnabledDeskletDefinitions.idMap[desklet_id];
            let oldDef = enabledDeskletDefinitions.idMap[desklet_id];

            if(!oldDef || !_deskletDefinitionsEqual(newDef, oldDef)) {
                let extension = Extension.Type.DESKLET.maps.objects[newDef.uuid];
                if(extension) {
                    _loadDesklet(extension, newDef);
                }
            }
        }

        enabledDeskletDefinitions = newEnabledDeskletDefinitions;

        // Make sure all desklet extensions are loaded.
        // Once loaded, the desklets will add themselves via finishExtensionLoad
        let hasDesklets = false;
        for (let uuid in enabledDeskletDefinitions.uuidMap) {
            if(Extension.loadExtension(uuid, Extension.Type.DESKLET))
                hasDesklets = true;
        }

    } catch (e) {
        global.logError('Failed to refresh list of desklets', e);
    }
}

function _unloadDesklet(deskletDefinition, deleteConfig) {
    let desklet = deskletObj[deskletDefinition.desklet_id];
    if (desklet){
        try {
            desklet.destroy(deleteConfig);
        } catch (e) {
            global.logError("Failed to destroy desket: " + deskletDefinition.uuid + "/" + deskletDefinition.desklet_id, e);
        }

        if (deleteConfig)
            _removeDeskletConfigFile(deskletDefinition.uuid, deskletDefinition.desklet_id);

        delete desklet._extension._loadedDefinitions[deskletDefinition.desklet_id];
        delete deskletObj[deskletDefinition.desklet_id];
    }
}

function _removeDeskletConfigFile(uuid, instanceId) {
    let config_path = (GLib.get_home_dir() + "/" +
                               ".cinnamon" + "/" +
                                 "configs" + "/" +
                                      uuid + "/" +
                                instanceId + ".json");
    let file = Gio.File.new_for_path(config_path);
    if (file.query_exists(null)) {
        try {
            file.delete(null);
        } catch (e) {
            global.logError("Problem removing desklet config file during cleanup.  UUID is " + uuid + " and filename is " + config_path);
        }
    }
}

function _loadDesklet(extension, deskletDefinition) {
    // Try to lock the desklets role
    if(!extension.lockRole(null))
        return false;
    
    try {
        let desklet = _createDesklets(extension, deskletDefinition);
        if (!desklet)
            return false;
        
        // Now actually lock the desklets role and set the provider
        if(!extension.lockRole(desklet))
            return false;

        desklet._extension = extension;

        if (!Main.deskletContainer.contains(desklet.actor)) Main.deskletContainer.addDesklet(desklet.actor);
        desklet.actor.set_position(deskletDefinition.x, deskletDefinition.y);

        if(!extension._loadedDefinitions) {
            extension._loadedDefinitions = {};
        }
        extension._loadedDefinitions[deskletDefinition.desklet_id] = deskletDefinition;

        desklet.on_desklet_added_to_desktop_internal(deskletsLoaded && !deskletsDragging);

        deskletsDragging = false;

        return true;
    } catch (e) {
        extension.logError('Failed to load desklet: ' + deskletDefinition.uuid + "/" + deskletDefinition.desklet_id, e);
        return false;
    }
}

function _createDesklets(extension, deskletDefinition) {
    let desklet_id = deskletDefinition.desklet_id;

    if (deskletObj[desklet_id]) {
        global.log(desklet_id + ' desklet already loaded');
        return deskletObj[desklet_id];
    }

    let desklet;
    try {
        desklet = extension.module.main(extension.meta, desklet_id);
    } catch (e) {
        extension.logError('Failed to evaluate \'main\' function on desklet: ' + deskletDefinition.uuid + "/" + deskletDefinition.desklet_id, e);
        return null;
    }

    deskletObj[desklet_id] = desklet;
    desklet._uuid = extension.uuid;
    desklet._meta = extension.meta; 
    desklet.instance_id = desklet_id;  // In case desklet constructor didn't set this
    
    desklet.finalizeContextMenu();
    
    return desklet;
}

function _getDeskletDefinition(definition) {
    let elements = definition.split(":");
    if (elements.length == 4) {
        return {
            uuid: elements[0],
            desklet_id: elements[1],
            x: elements[2],
            y: elements[3]
        };
    } else {
        global.logError("Bad desklet definition: " + definition);
        return null;
    }
}

function _deskletDefinitionsEqual(a, b) {
    return (a.uuid == b.uuid && a.x == b.x && a.y == b.y);
}

function get_object_for_instance (deskletId) {
    if (deskletId in deskletObj) {
        return deskletObj[deskletId];
    } else {
        return null;
    }
}

function get_object_for_uuid (uuid, instanceId) {
    for (let thisInstanceId in deskletObj) {
        if (deskletObj[thisInstanceId]._uuid == uuid) {
            if (instanceId == uuid || thisInstanceId == instanceId) {
                return deskletObj[thisInstanceId]
            }
        }
    }
    return null;
}

function _onDeskletSnapChanged(){
    if (!global.settings.get_boolean(DESKLET_SNAP_KEY))
        return;

    let enabledDesklets = global.settings.get_strv(ENABLED_DESKLETS_KEY);

    for (let i = 0; i < enabledDesklets.length; i++){
        let elements = enabledDesklets[i].split(":");
        let interval = global.settings.get_int(DESKLET_SNAP_INTERVAL_KEY);

        elements[2] = Math.floor(elements[2]/interval)*interval;
        elements[3] = Math.floor(elements[3]/interval)*interval;

        enabledDesklets[i] = elements.join(":");
    }

    global.settings.set_strv(ENABLED_DESKLETS_KEY, enabledDesklets);
    return;
}

/**
 * #DeskletContainer
 * 
 * Container that contains manages all desklets actors
 */
function DeskletContainer(){
    this._init();
}

DeskletContainer.prototype = {
    _init: function(){
        this.actor = new Clutter.Group();
        this.actor._delegate = this;

        this.last_x = -1;
        this.last_y = -1;

        this._dragPlaceholder = new St.Bin({style_class: 'desklet-drag-placeholder'});
        this._dragPlaceholder.hide();
    },

    /**
     * addDesklet:
     * @actor (Clutter.Actor): actor of desklet to be added
     * 
     * Adds @actor to the desklet container
     */
    addDesklet: function(actor){
        this.actor.add_actor(actor);
    },

    /**
     * contains:
     * @actor (Clutter.Actor): actor to be tested
     * 
     * Whether the desklet container contains @actor
     *
     * Returns (boolean): whether the desklet container contains the actor
     */
    contains: function(actor){
        return this.actor.contains(actor);
    },

    handleDragOver: function(source, actor, x, y, time) {
        deskletsDragging = true;

        if (!global.settings.get_boolean(DESKLET_SNAP_KEY))
            return DND.DragMotionResult.MOVE_DROP;

        if (!this._dragPlaceholder.get_parent())
            Main.uiGroup.add_actor(this._dragPlaceholder);

        this._dragPlaceholder.show();
        let interval = global.settings.get_int(DESKLET_SNAP_INTERVAL_KEY);

        if (this.last_x == -1 && this.last_y == -1) {
            this.last_x = actor.get_x();
            this.last_y = actor.get_y();
        }

        let x_next = Math.abs(actor.get_x() - this.last_x) > interval / 2;
        let y_next = Math.abs(actor.get_y() - this.last_y) > interval / 2;

        if (actor.get_x() < this.last_x) {
            if (x_next) {
                x = Math.floor(actor.get_x()/interval) * interval;
            } else {
                x = Math.ceil(actor.get_x()/interval) * interval;
            }
        } else {
            if (x_next) {
                x = Math.ceil(actor.get_x()/interval) * interval;
            } else {
                x = Math.floor(actor.get_x()/interval) * interval;
            }
        }

        if (actor.get_y() < this.last_y) {
            if (y_next) {
                y = Math.floor(actor.get_y()/interval) * interval;
            } else {
                y = Math.ceil(actor.get_y()/interval) * interval;
            }
        } else {
            if (y_next) {
                y = Math.ceil(actor.get_y()/interval) * interval;
            } else {
                y = Math.floor(actor.get_y()/interval) * interval;
            }
        }

        this._dragPlaceholder.set_position(x,y);
        this._dragPlaceholder.set_size(actor.get_width(), actor.get_height());
        this.last_x = x;
        this.last_y = y;
        return DND.DragMotionResult.MOVE_DROP;
    },

    acceptDrop: function(source, actor, x, y, time) {
        if (!(source instanceof Desklet.Desklet)) return false;
        Main.uiGroup.remove_actor(actor);
        this.actor.add_actor(actor);
        mouseTrackEnabled = -1; // forces an update of all desklet mouse tracks
        checkMouseTracking();

        // Update GSettings
        let enabledDesklets = global.settings.get_strv(ENABLED_DESKLETS_KEY);
        for (let i = 0; i < enabledDesklets.length; i++){
            let definition = enabledDesklets[i];
            if (definition.indexOf(source._uuid + ":" + source.instance_id) == 0){
                let elements = definition.split(":");
                elements[2] = actor.get_x();
                elements[3] = actor.get_y();
                if (global.settings.get_boolean(DESKLET_SNAP_KEY)){
                    elements[2] = this._dragPlaceholder.x
                    elements[3] = this._dragPlaceholder.y;
                }
                definition = elements.join(":");
                enabledDesklets[i] = definition;
            }
        }

        global.settings.set_strv(ENABLED_DESKLETS_KEY, enabledDesklets);

        this._dragPlaceholder.hide();
        this.last_x = -1;
        this.last_y = -1;
        return true;
    },

    cancelDrag: function(source, actor) {
        if (!(source instanceof Desklet.Desklet)) return false;
        Main.uiGroup.remove_actor(actor);
        this.actor.add_actor(actor);
        mouseTrackEnabled = -1;
        checkMouseTracking();
        this._dragPlaceholder.hide();
        this.last_x = -1;
        this.last_y = -1;
        return true;
    },

    hideDragPlaceholder: function() {
        this._dragPlaceholder.hide();
    }
};
