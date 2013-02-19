// -*- indent-tabs-mode: nil -*-
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

const Desklet = imports.ui.desklet;
const Extension = imports.ui.extension;
const Main = imports.ui.main;

// Maps uuid -> metadata object
var deskletMeta;
// Maps uuid -> importer object (desklet directory tree)
var desklets;
// Maps uuid -> desklet objects
var deskletObj = {};

var enabledDeskletDefinitions;

let userDeskletsDir;

const ENABLED_DESKLETS_KEY = 'enabled-desklets';

/**
 * init:
 * 
 * Initialize desklet manager
 */
function init(){
    deskletMeta = Extension.meta;
    desklets = Extension.importObjects;

    enabledDeskletDefinitions = getEnabledDeskletDefinitions();
    for (let uuid in enabledDeskletDefinitions.uuidMap) {
        Extension.loadExtension(uuid, Extension.Type.DESKLET);
    }
    
    global.settings.connect('changed::' + ENABLED_DESKLETS_KEY, _onEnabledDeskletsChanged);
}

/**
 * removeDesklet:
 * @uuid: uuid of the desklet
 * @desklet_id: id of the desklet
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
            _loadDesklet(extension, definitions[i]);
        }
    }
    return true;
}

// Callback for extension.js
function prepareExtensionUnload(extension) {
    // Remove all desklet instances for this extension
    for(let desklet_id in extension._loadedDefinitions) {
        _unloadDesklet(extension._loadedDefinitions[desklet_id]);
    }
}

function _onEnabledDeskletsChanged(){
    try{
        let newEnabledDeskletDefinitions = getEnabledDeskletDefinitions();
        // Remove all desklet instances that do not exist in the definition anymore.
        for (let desklet_id in enabledDeskletDefinitions.idMap) {
            if(!newEnabledDeskletDefinitions.idMap[desklet_id]) {
                _unloadDesklet(enabledDeskletDefinitions.idMap[desklet_id]);
            }
        }

        // Unload all desklet extensions that do not exist in the definition anymore.
        for (let uuid in enabledDeskletDefinitions.uuidMap) {
            if(!newEnabledDeskletDefinitions.uuidMap[uuid]) {
                Extension.unloadExtension(uuid);
            }
        }
        // Add or move desklet instances of already loaded desklet extensions
        for (let desklet_id in newEnabledDeskletDefinitions.idMap) {
            let newDef = newEnabledDeskletDefinitions.idMap[desklet_id];
            let oldDef = enabledDeskletDefinitions.idMap[desklet_id];
            
            if(!oldDef || !_deskletDefinitionsEqual(newDef, oldDef)) {
                let extension = Extension.objects[newDef.uuid];
                if(extension) {
                    _loadDesklet(extension, newDef);
                }
            }
        }

        enabledDeskletDefinitions = newEnabledDeskletDefinitions;
        
        // Make sure all desklet extensions are loaded.
        // Once loaded, the desklets will add themselves via finishExtensionLoad
        for (let uuid in enabledDeskletDefinitions.uuidMap) {
            Extension.loadExtension(uuid, Extension.Type.DESKLET);
        }
    } catch (e) {
        global.logError('Failed to refresh list of desklets', e);
    }
}

function _unloadDesklet(deskletDefinition) {
    let desklet = deskletObj[deskletDefinition.desklet_id];
    if (desklet){
        try {
            desklet.destroy();
        } catch (e) {
            global.logError("Failed to destroy desket: " + deskletDefinition.uuid + "/" + deskletDefinition.desklet_id, e);
        }
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
            file.delete(null, null);
        } catch (e) {
            global.logError("Problem removing desklet config file during cleanup.  UUID is " + uuid + " and filename is " + config_path);
        }
    }
}

function _loadDesklet(extension, deskletDefinition) {
    // Try to lock the desklets role
    if(!extension.lockRole(null))
        return;
    
    try {
        let desklet = _createDesklets(extension, deskletDefinition);
        if (!desklet)
            return;
        
        // Now actually lock the desklets role and set the provider
        if(!extension.lockRole(desklet))
            return;

        desklet._extension = extension;

        if (!Main.deskletContainer.contains(desklet.actor)) Main.deskletContainer.addDesklet(desklet.actor);
        desklet.actor.set_position(deskletDefinition.x, deskletDefinition.y);

        if(!extension._loadedDefinitions) {
            extension._loadedDefinitions = {};
        }
        extension._loadedDefinitions[deskletDefinition.desklet_id] = deskletDefinition;
    } catch (e) {
        extension.logError('Failed to load desklet: ' + deskletDefinition.uuid + "/" + deskletDefinition.desklet_id, e);
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
    desklet.instance_id = desklet_id;  // In case desklet constructor didn't set this

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

function get_object_for_uuid (uuid) {
    for (let instanceid in deskletObj) {
        if (deskletObj[instanceid]._uuid == uuid) {
            return deskletObj[instanceid];
        }
    }
    return null;
}

function get_num_instances_for_desklet (uuid) {
    if (uuid in deskletMeta) {
        if ("max-instances" in deskletMeta[uuid]) {
            return parseInt(deskletMeta[uuid]["max-instances"]);
        }
    }
    return 1;
}

/**
 * DeskletContainer
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
    },

    /**
     * addDesklet:
     * @actor: actor of desklet to be added
     * 
     * Adds @actor to the desklet container
     */
    addDesklet: function(actor){
        this.actor.add_actor(actor);
    },

    /**
     * contains:
     * @actor
     * 
     * Whether the desklet container contains @actor
     */
    contains: function(actor){
        return this.actor.contains(actor);
    },


    acceptDrop: function(source, actor, x, y, time) {
        if (!(source instanceof Desklet.Desklet)) return false;

        Main.uiGroup.remove_actor(actor);
        this.actor.add_actor(actor);
        Main.layoutManager.addChrome(actor, {doNotAdd: true});

        // Update GSettings
        let enabledDesklets = global.settings.get_strv(ENABLED_DESKLETS_KEY);
        for (let i = 0; i < enabledDesklets.length; i++){
            let definition = enabledDesklets[i];
            if (definition.indexOf(source._uuid + ":" + source.instanceId) == 0){
                let elements = definition.split(":");
                elements[2] = actor.get_x();
                elements[3] = actor.get_y();
                definition = elements.join(":");
                enabledDesklets[i] = definition;
            }
        }

        global.settings.set_strv(ENABLED_DESKLETS_KEY, enabledDesklets);

        return true;
    }
};
