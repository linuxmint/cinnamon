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
const DESKLET_SNAP_KEY = 'desklet-snap';
const DESKLET_SNAP_INTERVAL_KEY = 'desklet-snap-interval';
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
    global.settings.connect('changed::' + DESKLET_SNAP_KEY, _onDeskletSnapChanged);
    global.settings.connect('changed::' + DESKLET_SNAP_INTERVAL_KEY, _onDeskletSnapChanged);
}

/**
 * removeDesklet:
 * @uuid: uuid of the desklet
 * @deskletId: id of the desklet
 *
 * Disable and remove the desklet @uuid:@deskletId
 */
function removeDesklet(uuid, deskletId){
    let list = global.settings.get_strv(ENABLED_DESKLETS_KEY);
    for (let i = 0; i < list.length; i++){
        let definition = list[i];
        let elements = definition.split(":");
        if (uuid == elements[0] && deskletId == elements[1]) list.splice(i, 1);
    }
    global.settings.set_strv(ENABLED_DESKLETS_KEY, list);
}

/**
 * getEnabledDeskletDefinitons:
 *
 * Gets the list of enabled desklets. Returns an associative array of three items:
 * raw: the unprocessed array from gsettings
 * uuidMap: maps uuid -> list of desklet definitions
 * idMap: maps deskletId -> single desklet definition
 */
function getEnabledDeskletDefinitions() {
    let result = {
        // the raw list from gsettings
        raw: global.settings.get_strv(ENABLED_DESKLETS_KEY),
        // maps uuid -> list of desklet definitions
        uuidMap: {},
        // maps deskletId -> single desklet definition
        idMap: {}
    };

    // Parse all definitions
    for (let i=0; i<result.raw.length; i++) {
        let deskletDefinition = _getDeskletDefinition(result.raw[i]);
        if(deskletDefinition) {
            if(!result.uuidMap[deskletDefinition.uuid])
                result.uuidMap[deskletDefinition.uuid] = [];
            result.uuidMap[deskletDefinition.uuid].push(deskletDefinition);
            result.idMap[deskletDefinition.deskletId] = deskletDefinition;
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
    for(let deskletId in extension._loadedDefinitions) {
        _unloadDesklet(extension._loadedDefinitions[deskletId]);
    }
}

function _onEnabledDeskletsChanged(){
    try{
        let newEnabledDeskletDefinitions = getEnabledDeskletDefinitions();
        // Remove all desklet instances that do not exist in the definition anymore.
        for (let deskletId in enabledDeskletDefinitions.idMap) {
            if(!newEnabledDeskletDefinitions.idMap[deskletId]) {
                _unloadDesklet(enabledDeskletDefinitions.idMap[deskletId]);
            }
        }

        // Unload all desklet extensions that do not exist in the definition anymore.
        for (let uuid in enabledDeskletDefinitions.uuidMap) {
            if(!newEnabledDeskletDefinitions.uuidMap[uuid]) {
                Extension.unloadExtension(uuid);
            }
        }
        // Add or move desklet instances of already loaded desklet extensions
        for (let deskletId in newEnabledDeskletDefinitions.idMap) {
            let newDef = newEnabledDeskletDefinitions.idMap[deskletId];
            let oldDef = enabledDeskletDefinitions.idMap[deskletId];

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
    let desklet = deskletObj[deskletDefinition.deskletId];
    if (desklet){
        try {
            desklet.destroy();
        } catch (e) {
            global.logError("Failed to destroy desklet: " + deskletDefinition.uuid + "/" + deskletDefinition.deskletId, e);
        }

        delete desklet._extension._loadedDefinitions[deskletDefinition.deskletId];
        delete deskletObj[deskletDefinition.deskletId];
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

        if (!Main.deskletContainer.contains(desklet.actor))
            Main.deskletContainer.add_actor(desklet.actor);

        desklet.actor.set_position(deskletDefinition.x, deskletDefinition.y);

        if(!extension._loadedDefinitions) {
            extension._loadedDefinitions = {};
        }
        extension._loadedDefinitions[deskletDefinition.deskletId] = deskletDefinition;
    } catch (e) {
        extension.logError('Failed to load desklet: ' + deskletDefinition.uuid + "/" + deskletDefinition.deskletId, e);
    }
}

function _createDesklets(extension, deskletDefinition) {
    let deskletId = deskletDefinition.deskletId;

    if (deskletObj[deskletId]) {
        global.log(deskletId + ' desklet already loaded');
        return deskletObj[deskletId];
    }

    let desklet;
    try {
        desklet = extension.module.main(extension.meta, deskletId);
    } catch (e) {
        extension.logError('Failed to evaluate \'main\' function on desklet: ' + deskletDefinition.uuid + "/" + deskletDefinition.desklet_id, e);
        return null;
    }

    deskletObj[deskletId] = desklet;
    desklet._uuid = extension.uuid;
    desklet._deskletId = deskletId;

    return desklet;
}

function _getDeskletDefinition(definition) {
    let elements = definition.split(":");
    if (elements.length == 4) {
        return {
            uuid: elements[0],
            deskletId: elements[1],
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
