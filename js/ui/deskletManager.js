// -*- indent-tabs-mode: nil -*-
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;

const Desklet = imports.ui.desklet;
const Main = imports.ui.main;

let deskletMeta = {}; // Maps uuid -> metadata object
let deskletObj = {}; // Maps uuid -> desklet objects
let desklets = {}; // Maps uuid -> importer object (desklet directory tree)

let enabledDesklets;

const REQUIRED_METADATA_PROPERTIES = ['uuid', 'name', 'description' ];

let deskletContainer = null;
let userDeskletsDir;

const ENABLED_DESKLETS_KEY = 'enabled-desklets';
// Initialize
function init(){
    let userDeskletsPath = GLib.build_filenamev([global.userdatadir, 'desklets']);
    userDeskletsDir = Gio.file_new_for_path(userDeskletsPath);
    try {
        if (!userDeskletsDir.query_exists(null))
            userDeskletsDir.make_directory_with_parents(null);
    } catch (e){
        global.logError('' + e);
    }

    deskletContainer = new DeskletContainer();

    enabledDesklets = global.settings.get_strv(ENABLED_DESKLETS_KEY);
    global.settings.connect('changed::enabled-desklets', onEnabledDeskletsChanged);
}

// Desklet Container prototype
function DeskletContainer(){
    this._init();
}

DeskletContainer.prototype = {
    _init: function(){
        this.actor = new Clutter.Group();
        this.actor._delegate = this;
    },

    addDesklet: function(actor){
        this.actor.add_actor(actor);
    },

    // Wrapper
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
            if (definition.indexOf(source._uuid + ":" + source._id) == 0){
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
}

function onEnabledDeskletsChanged(){
    let newEnabledDesklets = global.settings.get_strv(ENABLED_DESKLETS_KEY);

    for (let i = 0; i < newEnabledDesklets.length; i ++) {
        let deskletDefinition = newEnabledDesklets[i];
        // New desklet or changed position
        if (enabledDesklets.indexOf(deskletDefinition) == -1) loadDesklet(deskletDefinition);
    }

    for (let i = 0; i < enabledDesklets.length; i ++){
        let deskletDefinition = enabledDesklets[i];
        if (newEnabledDesklets.indexOf(deskletDefinition) == -1){
            // Removed desklet or changed position 
            let elements = deskletDefinition.split(':');
            if (elements.length == 4) {
                let uuid = elements[0];
                let id = elements[1];

                // Check if it was moved - if so, then we have already handled it
                let deskletMoved = false;

                for (let j = 0; j < newEnabledDesklets.length; j++) {
                    let newdef = newEnabledDesklets[j].split(':');
                    if (newdef[0] == uuid && newdef[1] == id){
                        deskletMoved = true;
                        break;
                    }
                }

                if (!deskletMoved){
                    deskletObj[uuid][id].destroy();

                    desklets[uuid][id] = null;
                    deskletMeta[uuid][id] = null;
                    deskletObj[uuid][id] = null;
                }
            }
        }
    }

    enabledDesklets = newEnabledDesklets;
}

// Loads all desklets in the enabledDesklets
function loadDesklets(){
    for (let i = 0; i < enabledDesklets.length; i++){
        loadDesklet(enabledDesklets[i]);
    }
}

// Loads the desklet of a particular definition
function loadDesklet(definition){
    let elements = definition.split(":");
    try{
        if (elements.length == 4){
            let uuid = elements[0];
            let id = elements[1];
            let x = elements[2];
            let y = elements[3];
            let directory = _findDesklet(uuid);
            if (directory){
                let desklet = loadDeskletFile(id, uuid, directory);
                if (desklet){
                    if (!deskletContainer.contains(desklet.actor)) deskletContainer.addDesklet(desklet.actor);
                    desklet.actor.set_position(x, y);
                    desklets[uuid][id] = desklet;
                }
            } else{
                global.logError('Could not find desklet ' + uuid + ', make sure its directory is present and matches its UUID');
            }
        } else {
            global.logError('Invalid desklet definition: ' + definition);
        }
    } catch (e) {
        global.logError('Failed to load desklet ' + definition + e);
    }
}

// Recurses through all possible desklet directories to find for needed desklet
function _findDesklet(uuid){
    let directory = null;
    directory = _findDeskletIn(uuid, userDeskletsDir);
    if (directory == null) {
        let systemDataDirs = GLib.get_system_data_dirs();
        for (let i = 0; i < systemDataDirs.length; i++) {
            let dirPath = systemDataDirs[i] + '/cinnamon/desklets';
            let dir = Gio.file_new_for_path(dirPath);
            if (dir.query_exists(null)) directory = _findDeskletIn(uuid, dir);
            if (directory) break;
        }
    }

    return directory;
}

// Checks if the desklet exists in the directory
function _findDeskletIn(uuid, dir) {
    let directory = null;
    let info;
    let fileEnum;
    let file, infl;
    try {
        fileEnum = dir.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
    } catch (e) {
        global.logError('' + e);
        return null;
    }

    while ((info = fileEnum.next_file(null)) != null) {
        let fileType = info.get_file_type();
        if (fileType != Gio.FileType.DIRECTORY) continue;
        let name = info.get_name();
        if (name == uuid){
            let child = dir.get_child(name);
            directory = child;
            break;
        }
    }

    fileEnum.close(null);
    return directory;
}

// Loads desklets from a particular file
function loadDeskletFile(id, uuid, dir){
    let info;
    let desklet = null;

    if (!desklets[uuid]){
        desklets[uuid] = {};
        deskletMeta[uuid] = {};
        deskletObj[uuid] = {};
    }

    let meta;
    let metadataFile = dir.get_child('metadata.json');
    if (!metadataFile.query_exists(null)){
        global.logError(uuid + ' missing metadata.json');
        return null;
    }
    let metadataContents;
    try {
         metadataContents = Cinnamon.get_file_contents_utf8_sync(metadataFile.get_path());
    } catch (e) {
        global.logError(uuid + ' failed to load metatada.json' + e);
        return null;
    }

    try {
        meta = JSON.parse(metadataContents);
    } catch (e) {
        global.logError(uuid + ' failed to parse metadata.json ' + e);
        return null;
    }

    for (let i = 0; i < REQUIRED_METADATA_PROPERTIES.length; i ++){
        let prop = REQUIRED_METADATA_PROPERTIES[i];
        if (!meta[prop]) {
            global.logError(uuid + ' missing "' + prop + '" property in metadata.json');
            return null;
        }
    }

    if (desklets[uuid][id] != undefined){
        global.logError(uuid + ' desklet already loaded');
        return deskletObj[uuid][id];
    }

    if (uuid != meta.uuid) {
        global.logError(uuid + ' uuid "' + meta.uuid + '" from metadata.json does not match directory name "' + uuid + '"');
        return null;
    }

    deskletMeta[uuid][id] = meta;
    meta.path = dir.get_path();
    meta.error = '';
    meta.id = id;

    let deskletJs = dir.get_child('desklet.js');
    if (!deskletJs.query_exists(null)){
        global.logError(uuid + ' missing desklet.js');
        return null;
    }

    let stylesheetPath = null;
    let themeContext = St.ThemeContext.get_for_stage(global.stage);
    let theme = themeContext.get_theme();
    let stylesheetFile = dir.get_child('stylesheet.css');
    if (stylesheetFile.query_exists(null)) {
        try {
            theme.load_stylesheet(stylesheetFile.get_path());
        } catch (e) {
            global.logError(uuid + ' stylesheet parse error: ' + e);
            return null;
        }
    }

    let deskletModule;
    try {
        global.add_extension_importer('imports.ui.deskletManager.desklets[\'' + meta.uuid + '\']', meta.id, dir.get_path());
        deskletModule = desklets[meta.uuid][id].desklet;
    } catch (e) {
        if (stylesheetPath) theme.unload_stylesheet(stylesheetPath);
        global.logError(uuid + ' ' + e);
        return null;
    }

    if (!deskletModule.main) {
        global.logError(uuid + ' missing \'main\' function');
        return null;
    }

    try {
        desklet = deskletModule.main(meta);
        global.log('Loaded desklet ' + meta.uuid);
    } catch (e) {
        if (stylesheetPath) theme.unload_stylesheet(stylesheetPath);
        global.logError(uuid + ' failed to evaluate main function:' + e);
        return null;
    }

    deskletObj[uuid][id] = desklet;
    desklet._uuid = uuid;
    desklet._id = id;

    return desklet;
}

function removeDesklet(uuid, id){
    let list = global.settings.get_strv(ENABLED_DESKLETS_KEY);
    for (let i = 0; i < list.length; i++){
        let definition = list[i];
        let elements = definition.split(":");
        if (uuid == elements[0] && id == elements[1]) list.splice(i, 1);
    }
    global.settings.set_strv(ENABLED_DESKLETS_KEY, list);
}
