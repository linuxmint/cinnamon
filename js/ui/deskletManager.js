// -*- indent-tabs-mode: nil -*-
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
const {getModuleByIndex} = imports.misc.fileUtils;
const {queryCollection} = imports.misc.util;

// Maps uuid -> importer object (desklet directory tree)
var desklets;
// Kept for compatibility
var deskletMeta;

var rawDefinitions;
var definitions = [];

var deskletsLoaded = false;

var deskletsDragging = false;

var userDeskletsDir;

var mouseTrackEnabled = false;
var mouseTrackTimoutId = 0;
var promises = [];

const ENABLED_DESKLETS_KEY = 'enabled-desklets';
const DESKLET_SNAP_KEY = 'desklet-snap';
const DESKLET_SNAP_INTERVAL_KEY = 'desklet-snap-interval';

function initEnabledDesklets() {
    for (let i = 0; i < definitions.length; i++) {
        promises.push(Extension.loadExtension(definitions[i].uuid, Extension.Type.DESKLET))
    }
    return Promise.all(promises).then(function() {
        promises = [];
    });
}

function unloadRemovedDesklets(removedDeskletUUIDs) {
    for (let i = 0; i < removedDeskletUUIDs.length; i++) {
        promises.push(Extension.unloadExtension(removedDeskletUUIDs[i], Extension.Type.DESKLET));
    }
    return Promise.all(promises).then(function() {
        promises = [];
    });
}

/**
 * init:
 *
 * Initialize desklet manager
 */
function init(){
    let startTime = new Date().getTime();
    try {
        desklets = imports.desklets;
    } catch (e) {
        desklets = {};
    }
    deskletMeta = Extension.Type.DESKLET.legacyMeta;
    deskletsLoaded = false

    definitions = getDefinitions();

    return initEnabledDesklets().then(function() {
        global.settings.connect('changed::' + ENABLED_DESKLETS_KEY, _onEnabledDeskletsChanged);
        global.settings.connect('changed::' + DESKLET_SNAP_KEY, _onDeskletSnapChanged);
        global.settings.connect('changed::' + DESKLET_SNAP_INTERVAL_KEY, _onDeskletSnapChanged);

        deskletsLoaded = true;
        enableMouseTracking(true);
        global.log(`DeskletManager started in ${new Date().getTime() - startTime} ms`);
    });
}

function getDeskletDefinition(definition) {
    return queryCollection(definitions, definition);
}

function enableMouseTracking(enable) {
    if (enable && !mouseTrackTimoutId) {
        mouseTrackTimoutId = Mainloop.timeout_add(500, checkMouseTracking);
    } else if (!enable && mouseTrackTimoutId) {
        Mainloop.source_remove(mouseTrackTimoutId);
        mouseTrackTimoutId = 0;

        for (let i = 0; i < definitions.length; i++) {
            if (definitions[i].desklet) {
                definitions[i].desklet._untrackMouse();
            }
        }
    }
}

function hasMouseWindow(){
    let window = global.screen.get_mouse_window(null);
    return window && window.window_type !== Meta.WindowType.DESKTOP;
}

function checkMouseTracking() {
    let enable = !hasMouseWindow();
    if (mouseTrackEnabled !== enable) {
        mouseTrackEnabled = enable;
        for (let i = 0; i < definitions.length; i++) {
            if (!definitions[i].desklet) {
                continue;
            }
            if (enable) {
                definitions[i].desklet._trackMouse();
            } else {
                definitions[i].desklet._untrackMouse();
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
 * getDefinitons:
 *
 * Gets the list of enabled desklets. Returns an associative array of three items:
 * raw: the unprocessed array from gsettings
 * definitions: Array(Object)
 *
 * Returns (dictionary): Associative array of three items
 */
function getDefinitions() {
    let _definitions = [];
    rawDefinitions = global.settings.get_strv(ENABLED_DESKLETS_KEY);

    // Parse all definitions
    for (let i=0; i < rawDefinitions.length; i++) {
        let deskletDefinition = createDeskletDefinition(rawDefinitions[i]);
        if (deskletDefinition) {
            _definitions.push(deskletDefinition);
        }
    }

    return _definitions;
}

// Callback for extension.js
function finishExtensionLoad(extensionIndex) {
    // Add all desklet instances for this extension
    let extension = Extension.extensions[extensionIndex];
    for (let i = 0; i < definitions.length; i++) {
        if (definitions[i].uuid !== extension.uuid) {
            continue;
        }
        if (!_loadDesklet(extension, definitions[i])) {
            return false;
        }
    }
    return true;
}

// Callback for extension.js
function prepareExtensionUnload(extension, deleteConfig) {
    // Remove all desklet instances for this extension
    for (let i = 0; i < definitions.length; i++) {
        definitions[i]
        if (extension.uuid !== definitions[i].uuid) {
            continue;
        }
        _unloadDesklet(definitions[i], deleteConfig);
    }
}

function _onEnabledDeskletsChanged() {
    try {
        let oldDefinitions = definitions;
        definitions = getDefinitions();
        let removedDeskletUUIDs = [];
        // Remove all desklet instances that do not exist in the definition anymore.
        for (let i = 0; i < oldDefinitions.length; i++) {
            let deskletDefinition = getDeskletDefinition({desklet_id: oldDefinitions[i].desklet_id});
            if (!deskletDefinition) {
                removedDeskletUUIDs.push(oldDefinitions[i].uuid);
                _unloadDesklet(oldDefinitions[i], true);
            }
        }
        // Make a unique array of removed UUIDs
        let uniqueSet = new Set();
        let uniqueRemovedUUIDs = [];
        for (let i = 0; i < removedDeskletUUIDs.length; i++) {
          if (uniqueSet.has(removedDeskletUUIDs[i]) === false) {
            uniqueRemovedUUIDs.push(removedDeskletUUIDs[i]);
            uniqueSet.add(removedDeskletUUIDs[i]);
          }
        }
        // Unload all desklet extensions that do not exist in the definition anymore.
        unloadRemovedDesklets(uniqueRemovedUUIDs).then(function() {
            // Add or move desklet instances of already loaded desklet extensions
            const getOlddeskletDefinition = function(desklet_id) {
                let index = oldDefinitions.findIndex(function(definition) {
                    return definition.desklet_id === desklet_id;
                });
                if (index === -1) {
                    return null;
                }
                return oldDefinitions[index];
            };
            for (let i = 0; i < definitions.length; i++) {
                let newDefinition = getDeskletDefinition({desklet_id: definitions[i].desklet_id});
                let oldDefinition = getOlddeskletDefinition(definitions[i].desklet_id);

                if (!oldDefinition || !_deskletDefinitionsEqual(newDefinition, oldDefinition)) {
                    let extension = Extension.getExtension(newDefinition.uuid);
                    if (extension) {
                        _loadDesklet(extension, newDefinition);
                    }
                }
            }

            // Make sure all desklet extensions are loaded.
            // Once loaded, the desklets will add themselves via finishExtensionLoad
            initEnabledDesklets();
        });
    } catch(e) {
        global.logError('Failed to refresh list of desklets', e);
    }
}

function _unloadDesklet(deskletDefinition, deleteConfig) {
    let {uuid, desklet_id} = deskletDefinition;
    if (deskletDefinition.desklet) {
        try {
            deskletDefinition.desklet.destroy(deleteConfig);
        } catch (e) {
            global.logError("Failed to destroy desket: " + uuid + "/" + desklet_id, e);
        }

        if (deleteConfig) {
            _removeDeskletConfigFile(uuid, desklet_id);
        }

        deskletDefinition.desklet = null;
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

        if (!Main.deskletContainer.contains(desklet.actor)) Main.deskletContainer.addDesklet(desklet.actor);
        desklet.actor.set_position(deskletDefinition.x, deskletDefinition.y);

        desklet.on_desklet_added_to_desktop_internal(deskletsLoaded && !deskletsDragging);

        deskletsDragging = false;

        return true;
    } catch (e) {
        Extension.logError('Failed to load desklet: ' + deskletDefinition.uuid + "/" + deskletDefinition.desklet_id, e);
        return false;
    }
}

function _createDesklets(extension, deskletDefinition) {
    let {uuid, desklet_id} = deskletDefinition;

    if (deskletDefinition.desklet) {
        global.log(desklet_id + ' desklet already loaded');
        return deskletDefinition.desklet;
    }

    let desklet;
    try {
        desklet = getModuleByIndex(extension.moduleIndex).main(extension.meta, desklet_id);
    } catch (e) {
        Extension.logError('Failed to evaluate \'main\' function on desklet: ' + uuid + "/" + desklet_id, e);
        return null;
    }

    deskletDefinition.desklet = desklet;
    desklet._uuid = extension.uuid;
    desklet._meta = extension.meta;
    desklet.instance_id = desklet_id;  // In case desklet constructor didn't set this

    desklet.finalizeContextMenu();

    return desklet;
}

function createDeskletDefinition(definition) {
    let elements = definition.split(":");
    if (elements.length == 4) {
        return {
            uuid: elements[0],
            desklet_id: elements[1],
            x: elements[2],
            y: elements[3],
            desklet: null
        };
    } else {
        global.logError("Bad desklet definition: " + definition);
        return null;
    }
}

function _deskletDefinitionsEqual(a, b) {
    return (a && b && (a.uuid === b.uuid && a.x === b.x && a.y === b.y));
}

function get_object_for_instance (deskletId) {
    let {desklet} = getDeskletDefinition({desklet_id: deskletId});
    if (!desklet) {
        return null;
    }
    return desklet;
}

function get_object_for_uuid (uuid, instanceId) {
    let index = definitions.findIndex(function(definition) {
        return (definition
            && definition.desklet
            && definition.desklet._uuid === uuid
            && (definition.desklet_id === instanceId || instanceId === uuid));
    });
    if (index === -1) {
        return null;
    }
    return definitions[index].desklet;
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
