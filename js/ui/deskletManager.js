// -*- indent-tabs-mode: nil -*-
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;
const Lang = imports.lang;

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

var deskletChangeKey = 0;
const ENABLED_DESKLETS_KEY = 'enabled-desklets';
const DESKLET_SNAP_KEY = 'desklet-snap';
const DESKLET_SNAP_INTERVAL_KEY = 'desklet-snap-interval';
const KEYBINDING_SCHEMA = 'org.cinnamon.desktop.keybindings';
const SHOW_DESKLETS_KEY = 'show-desklets';
const LOCK_DESKLETS_KEY = "lock-desklets";

function initEnabledDesklets() {
    for (let i = 0; i < definitions.length; i++) {
        promises.push(Extension.loadExtension(definitions[i].uuid, Extension.Type.DESKLET))
    }
    return Promise.all(promises).then(function() {
        Main.cinnamonDBusService.EmitXletsLoadedComplete();
        promises = [];
    });
}

function unloadRemovedDesklets(removedDeskletUUIDs) {
    for (let i = 0; i < removedDeskletUUIDs.length; i++) {
        Extension.unloadExtension(removedDeskletUUIDs[i], Extension.Type.DESKLET);
    }
}

/**
 * init:
 *
 * Initialize desklet manager
 */
function init() {
    const startTime = new Date().getTime();
    try {
        desklets = imports.desklets;
    } catch (e) {
        desklets = {};
    }
    deskletMeta = Extension.Type.DESKLET.legacyMeta;
    deskletsLoaded = false;

    definitions = getDefinitions();

    return initEnabledDesklets().then(function() {
        deskletChangeKey = global.settings.connect('changed::' + ENABLED_DESKLETS_KEY, _onEnabledDeskletsChanged);
        global.settings.connect('changed::' + DESKLET_SNAP_KEY, _onDeskletSnapChanged);
        global.settings.connect('changed::' + DESKLET_SNAP_INTERVAL_KEY, _onDeskletSnapChanged);

        deskletsLoaded = true;
        updateMouseTracking();
        global.log(`DeskletManager started in ${new Date().getTime() - startTime} ms`);
    });
}

function getDeskletDefinition(definition) {
    return queryCollection(definitions, definition);
}

function updateMouseTracking() {
    let enable = definitions.length > 0;
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
    let window = global.display.get_pointer_window(null);
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

// Callback for extension.js
function prepareExtensionReload(extension) {
    for (var i = 0; i < definitions.length; i++) {
        if (extension.uuid === definitions[i].uuid) {
            let {desklet, desklet_id} = definitions[i];
            if (!desklet) continue;
            global.log("Reloading desklet: " + extension.uuid + "/" + desklet_id);
            desklet.on_desklet_reloaded();
            return;
        }
    }
}

function _onEnabledDeskletsChanged() {
    let oldDefinitions = definitions.slice();
    definitions = getDefinitions();
    let addedDesklets = [];
    let removedDesklets = [];
    let unChangedDesklets = [];

    for (let i = 0; i < definitions.length; i++) {
        let {uuid, desklet_id} = definitions[i];
        let oldDefinition = queryCollection(oldDefinitions, {uuid, desklet_id});

        let isEqualToOldDefinition = _deskletDefinitionsEqual(definitions[i], oldDefinition);

        if (oldDefinition && !isEqualToOldDefinition) {
            removedDesklets.push({changed: true, definition: oldDefinition});
        }

        if (!oldDefinition || !isEqualToOldDefinition) {
            let extension = Extension.getExtension(uuid);
            addedDesklets.push({extension, definition: definitions[i]});
            continue;
        }

        unChangedDesklets.push(desklet_id);
    }
    for (let i = 0; i < oldDefinitions.length; i++) {
        if (unChangedDesklets.indexOf(oldDefinitions[i].desklet_id) === -1) {
            removedDesklets.push({changed: false, definition: oldDefinitions[i]});
        }
    }
    for (let i = 0; i < removedDesklets.length; i++) {
        let {uuid} = removedDesklets[i].definition;
        _unloadDesklet(
            removedDesklets[i].definition,
            Extension.get_max_instances(uuid, Extension.Type.DESKLET) !== 1 && !removedDesklets[i].changed
        );
    }
    for (let i = 0; i < addedDesklets.length; i++) {
        let {extension, definition} = addedDesklets[i];
        if (!extension) {
            continue;
        }
        _loadDesklet(extension, definition);
    }

    // Make sure all desklet extensions are loaded.
    // Once loaded, the desklets will add themselves via finishExtensionLoad
    initEnabledDesklets().then(updateMouseTracking);
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
    let config_paths = [
        [GLib.get_home_dir(), ".cinnamon", "configs", uuid, instanceId + ".json"].join("/"),
        [GLib.get_user_config_dir(), "cinnamon", "spices", uuid, instanceId + ".json"].join("/")
    ];

    for (let i = 0; i < config_paths.length; i++) {
        const config_path = config_paths[i];
        let file = Gio.File.new_for_path(config_path);
        if (file.query_exists(null)) {
            try {
                file.delete(null);
            } catch (e) {
                global.logError("Problem removing desklet config file during cleanup.  UUID is " + uuid + " and filename is " + config_path);
            }
        }
    }
}

function _loadDesklet(extension, deskletDefinition) {
    // Try to lock the desklets role
    if (!extension || !extension.lockRole(null))
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
    if (elements.length !== 4) {
        global.logError("Bad desklet definition: " + definition);
        return null;
    }
    let deskletDefinition = {
        uuid: elements[0],
        desklet_id: elements[1],
        x: elements[2],
        y: elements[3]
    };

    let existingDefinition = getDeskletDefinition(deskletDefinition);

    if (existingDefinition) {
        return existingDefinition;
    }

    deskletDefinition.desklet = null;

    return deskletDefinition;
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
    global.settings.disconnect(deskletChangeKey);
    global.settings.set_strv(ENABLED_DESKLETS_KEY, enabledDesklets);
    deskletChangeKey = global.settings.connect('changed::' + ENABLED_DESKLETS_KEY, _onEnabledDeskletsChanged);
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
        this.actor = global.desklet_container;
        this.actor._delegate = this;

        this.last_x = -1;
        this.last_y = -1;

        this._dragPlaceholder = new St.Bin({style_class: 'desklet-drag-placeholder'});
        this._dragPlaceholder.hide();

        this.isModal = false;
        this.stageEventIds = [];

        this.keyBindingSettings = new Gio.Settings({ schema_id: KEYBINDING_SCHEMA });
        this.keyBindingSettings.connect('changed::show-desklets', () => this.applyKeyBindings());
        this.applyKeyBindings();
        global.settings.connect('changed::panel-edit-mode', () => {
            if (this.isModal) {
                this.lower();
            }
        });

        global.settings.connect('changed::' + LOCK_DESKLETS_KEY, () => this.onDeskletsLockedChanged());
    },

    applyKeyBindings: function() {
        Main.keybindingManager.addHotKeyArray(
            SHOW_DESKLETS_KEY,
            this.keyBindingSettings.get_strv(SHOW_DESKLETS_KEY),
            () => this.toggle()
        );
    },

    /**
     * addDesklet:
     * @actor (Clutter.Actor): actor of desklet to be added
     *
     * Adds @actor to the desklet container
     */
    addDesklet: function(actor){
        this.actor.add_actor(actor);
        actor._delegate._draggable.inhibit = global.settings.get_boolean(LOCK_DESKLETS_KEY);
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

    onDeskletsLockedChanged: function(settings, key) {
        this.actor.get_children().forEach((deskletActor) => {
            deskletActor._delegate._draggable.inhibit = global.settings.get_boolean(LOCK_DESKLETS_KEY);
        });
    },

    handleDragOver: function(source, actor, x, y, time) {
        if (!(source instanceof Desklet.Desklet)) return false;

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
                    actor.set_x(this._dragPlaceholder.x);
                    actor.set_y(this._dragPlaceholder.y);
                }
                definition = elements.join(":");
                enabledDesklets[i] = definition;
            }
        }

        // We already moved this desklet, so skipping _onEnabledDeskletsChanged
        global.settings.disconnect(deskletChangeKey);
        global.settings.set_strv(ENABLED_DESKLETS_KEY, enabledDesklets);
        deskletChangeKey = global.settings.connect('changed::' + ENABLED_DESKLETS_KEY, _onEnabledDeskletsChanged);

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
    },

    setModal: function() {
        if (this.isModal) {
            return;
        }

        this.stageEventIds = [
            global.stage.connect('captured-event', Lang.bind(this, this.handleStageEvent)),
            global.stage.connect('enter-event', Lang.bind(this, this.handleStageEvent)),
            global.stage.connect('leave-event', Lang.bind(this, this.handleStageEvent))
        ];

        if (Main.pushModal(this.actor)) {
            this.isModal = true;
        }
    },

    unsetModal: function() {
        if (!this.isModal) {
            return;
        }

        for (let i = 0; i < this.stageEventIds.length; i++) {
            global.stage.disconnect(this.stageEventIds[i]);
        }
        this.stageEventIds = [];

        Main.popModal(this.actor);
        this.isModal = false;
    },

    handleStageEvent: function(actor, event) {
        let target = event.get_source();
        let type = event.type();
        if ((type === Clutter.EventType.BUTTON_PRESS || type === Clutter.EventType.BUTTON_RELEASE)
            && target.get_parent() instanceof Meta.WindowActor) {
            this.lower();
        }

        return false;
    },

    raise: function() {
        if (this.actor.get_children().length === 0) {
            return;
        }
        global.display.set_desklets_above(true);
        this.setModal();
    },

    lower: function() {
        global.display.set_desklets_above(false);
        this.unsetModal();
    },

    toggle: function() {
        if (this.isModal) {
            this.lower();
        } else {
            this.raise();
        }
    }
};
