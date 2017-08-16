// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Signals = imports.signals;
const St = imports.gi.St;

const AppletManager = imports.ui.appletManager;
const Config = imports.misc.config;
const DeskletManager = imports.ui.deskletManager;
const ExtensionSystem = imports.ui.extensionSystem;
const SearchProviderManager = imports.ui.searchProviderManager;
const Main = imports.ui.main;

const State = {
    INITIALIZING: 0,
    LOADED: 1,
    ERROR: 2,
    OUT_OF_DATE: 3
};

// macro for creating extension types
function _createExtensionType(name, folder, manager, overrides){
    let type = {
        name: name,
        folder: folder,
        requiredFunctions: ["main"],
        requiredProperties: ["uuid", "name", "description"],
        niceToHaveProperties: [],
        roles: {},
        callbacks: {
            finishExtensionLoad: manager.finishExtensionLoad,
            prepareExtensionUnload: manager.prepareExtensionUnload
        },
        maps: {
            importObjects: {},
            objects: {},
            meta: {},
            dirs: {}
        }
    };

    for(let prop in overrides)
        type[prop] = overrides[prop];

    // Add signal methods
    Signals.addSignalMethods(type);

    let path = GLib.build_filenamev([global.userdatadir, folder]);
    type.userDir = path;
    // create user directories if they don't exist.
    let dir = Gio.file_new_for_path(type.userDir)
    try {
        if(!dir.query_exists(null))
            dir.make_directory_with_parents(null);
    } catch(e){
        global.logError(e);
    }

    return type;
}

/**
 * const Type:
 * @EXTENSION: Cinnamon extensions
 * @APPLET: Cinnamon panel applets
 *
 * @name: Upper case first character name for printing messages
 *        Also converted to lowercase to find the correct javascript file
 * @folder: The folder name within the system and user cinnamon folders
 * @requiredFunctions: Functions that must exist in the main javascript file
 * @requiredProperties: Properties that must be set in the metadata.json file
 * @niceToHaveProperties: Properties that are encouraged to be set in the metadata.json file
 * @roles: Roles an extension can assume. Values will be set internally, set to null.
 *         key => name of the role, value => reference to the extension object
 * @callbacks: Callbacks used to do some manual actions on load / unload
 *
 * Extension types with some attributes helping to load these extension types.
 * Properties are nested, with lowerCamelCase properties (e.g. requiredFunctions) as sub-properties of CAPITAL one (EXTENSION). Thus they are referred to as, e.g., Type.EXTENSION.requiredFunctions
 */
const Type = {
    EXTENSION: _createExtensionType("Extension", "extensions", ExtensionSystem, {
        requiredFunctions: ["init", "disable", "enable"],
        requiredProperties: ["uuid", "name", "description", "cinnamon-version"],
        niceToHaveProperties: ["url"],
    }),
    APPLET: _createExtensionType("Applet", "applets", AppletManager, {
        roles: {
            notifications: null,
            windowlist: null,
            panellauncher: null
        }
    }),
    DESKLET: _createExtensionType("Desklet", "desklets", DeskletManager, {
        roles: {
            notifications: null,
            windowlist: null
        }
    }),
    SEARCH_PROVIDER: _createExtensionType("Search provider", "search_providers", SearchProviderManager, {
        requiredFunctions: ["perform_search", "on_result_selected"]
    })
};

// Create a dummy metadata object when metadata parsing failed or was not done yet.
function createMetaDummy(uuid, path, state, type) {
    return { name: uuid, description: 'Metadata load failed', state: state, path: path, error: '', type: type };
}

// The Extension object itself
function Extension(dir, type, force, uuid) {
    this._init(dir, type, force, uuid);
}

Extension.prototype = {
    _init: function(dir, type, force, uuid) {
        this.uuid = uuid;
        this.dir = dir;
        this.type = type;
        this.lowerType = type.name.toLowerCase().replace(/\s/g, "_");
        this.theme = null;
        this.stylesheet = null;
        this.iconDirectory = null;
        this.meta = createMetaDummy(this.uuid, dir.get_path(), State.INITIALIZING, type);
        this.startTime = new Date().getTime();

        this.loadMetaData(dir.get_child('metadata.json'));
        if (!force)
            this.validateMetaData();

        if (this.meta.multiversion) {
            this.dir = findExtensionSubdirectory(this.dir);
            this.meta.path = this.dir.get_path();
            type.maps.dirs[this.uuid] = this.dir;
            let pathSections = this.meta.path.split('/');
            let version = pathSections[pathSections.length - 1];
            type.maps.importObjects[this.uuid] = imports[this.lowerType + 's'][this.uuid][version];
        } else {
            type.maps.importObjects[this.uuid] = imports[this.lowerType + 's'][this.uuid];
        }

        this.ensureFileExists(this.dir.get_child(this.lowerType + '.js'));
        this.loadStylesheet(this.dir.get_child('stylesheet.css'));
        
        if (this.stylesheet) {
            Main.themeManager.connect('theme-set', Lang.bind(this, function() {
                this.loadStylesheet(this.dir.get_child('stylesheet.css'));
            }));
        }
        this.loadIconDirectory(this.dir);

        try {
            this.module = type.maps.importObjects[this.uuid][this.lowerType]; // get [extension/applet/desklet].js
        } catch (e) {
            throw this.logError('Error importing ' + this.lowerType + '.js from ' + this.uuid, e);
        }

        for (let i = 0; i < this.type.requiredFunctions.length; i++) {
            let func = this.type.requiredFunctions[i];
            if (!this.module[func]) {
                throw this.logError('Function "' + func + '" is missing');
            }
        }

        type.maps.objects[this.uuid] = this;
    },

    finalize : function() {
        this.meta.state = State.LOADED;

        this.type.emit('extension-loaded', this.uuid);

        let endTime = new Date().getTime();
        global.log('Loaded %s %s in %d ms'.format(this.lowerType, this.uuid, (endTime - this.startTime)));
    },

    formatError:function(message) {
        return '[%s "%s"]: %s'.format(this.type.name, this.uuid, message);
    },

    logError: function (message, error, state) {
        this.meta.state = state || State.ERROR;
        this.meta.error += message;

        let errorMessage = this.formatError(message);
        if(error)
            global.logError(error);
        else
            error = new Error(errorMessage);

        global.logError(errorMessage);

        // An error during initialization leads to unloading the extension again.
        if(this.meta.state == State.INITIALIZING) {
            this.unlockRole();
            this.unloadStylesheet();
            this.unloadIconDirectory();
            forgetExtension(this.uuid);
        }
        error._alreadyLogged = true;
        return error;
    },

    logWarning: function (message) {
        global.logWarning(this.formatError(message));
    },

    loadMetaData: function(metadataFile) {

        let oldState = this.meta.state;
        let oldPath = this.meta.path;

        try {
            this.ensureFileExists(metadataFile);
            let metadataContents = Cinnamon.get_file_contents_utf8_sync(metadataFile.get_path());
            this.meta = JSON.parse(metadataContents);
            
            // Store some additional crap here
            this.meta.state = oldState;
            this.meta.path = oldPath;
            this.meta.type = this.type;
            this.meta.error = '';

            this.type.maps.meta[this.uuid] = this.meta;
        } catch (e) {
            this.meta = createMetaDummy(this.uuid, oldPath, State.ERROR, this.type);
            this.type.maps.meta[this.uuid] = this.meta;
            throw this.logError('Failed to load/parse metadata.json', e);
        }
    },

    validateMetaData: function() {
        // Some properties are required to run
        this.checkProperties(this.type.requiredProperties, true);

        // Others are nice to have
        this.checkProperties(this.type.niceToHaveProperties, false);

        if (this.meta.uuid != this.uuid) {
            throw this.logError('uuid "' + this.meta.uuid + '" from metadata.json does not match directory name.');
        }

        // If cinnamon or js version are set, check them
        if('cinnamon-version' in this.meta && !versionCheck(this.meta['cinnamon-version'], Config.PACKAGE_VERSION)) {
            throw this.logError('Extension is not compatible with current Cinnamon version', null, State.OUT_OF_DATE);
        }
        if('js-version' in this.meta && !versionCheck(this.meta['js-version'], Config.GJS_VERSION)) {
            throw this.logError('Extension is not compatible with current GJS version', null, State.OUT_OF_DATE);
        }

        // If a role is set, make sure it's a valid one
        let role = this.meta['role'];
        if(role) {
            if (!(role in this.type.roles)) {
                throw this.logError('Unknown role definition: ' + role + ' in metadata.json');
            }
        }
    },

    checkProperties: function(properties, fatal) {
        for (let i = 0; i < properties.length; i++) {
            let prop = properties[i];
            if (!this.meta[prop]) {
                let msg = 'Missing property "' + prop + '" in metadata.json';
                if(fatal)
                    throw this.logError(msg);
                else
                    this.logWarning(msg);
            }
        }
    },

    loadStylesheet: function (file) {
        if (file.query_exists(null)) {
            try {
                let themeContext = St.ThemeContext.get_for_stage(global.stage);
                this.theme = themeContext.get_theme();
            } catch (e) {
                throw this.logError('Error trying to get theme', e);
            }

            try {
                this.theme.load_stylesheet(file.get_path());
                this.stylesheet = file.get_path();
            } catch (e) {
                throw this.logError('Stylesheet parse error', e);
            }
        }
    },

    unloadStylesheet: function () {
        if (this.theme != null && this.stylesheet != null) {
            try {
                this.theme.unload_stylesheet(this.stylesheet);
            } catch (e) {
                global.logError('Error unloading stylesheet', e);
            }
        }
    },
    
    loadIconDirectory: function(dir) {
        let iconDir = dir.get_child("icons");
        if (iconDir.query_exists(null)) {
            let path = iconDir.get_path();
            this.iconDirectory = path;
            Gtk.IconTheme.get_default().append_search_path(path);
        }
    },
    
    unloadIconDirectory: function() {
        if (this.iconDirectory) {
            let iconTheme = Gtk.IconTheme.get_default();
            let searchPath = iconTheme.get_search_path();
            for (let i = 0; i < searchPath.length; i++) {
                if (searchPath[i] == this.iconDirectory) {
                    searchPath.splice(i,1);
                    iconTheme.set_search_path(searchPath);
                    break;
                }
            }
        }
    },

    ensureFileExists: function(file) {
        if (!file.query_exists(null)) {
            throw this.logError('File not found: ' + file.get_path());
        }
    },

    lockRole: function(roleProvider) {
        let role = this.meta['role'];
        if(role && this.type.roles[role] != this) {
            if(this.type.roles[role] != null) {
                return false;
            }

            if(roleProvider != null) {
                this.type.roles[role] = this;
                this.roleProvider = roleProvider;
                global.log("Role locked: " + role);
                return true;
            }
        }

        return true;
    },

    unlockRole: function() {
        let role = this.meta['role'];
        if(role && this.type.roles[role] == this) {
            this.type.roles[role] = null;
            this.roleProvider = null;
            global.log("Role unlocked: " + role);
        }
    }
}

/**
* versionCheck:
* @required: an array of versions we're compatible with
* @current: the version we have
*
* Check if a component is compatible for an extension.
* @required is an array, and at least one version must match.
* @current must be in the format <major>.<minor>.<point>.<micro>
* <micro> is always ignored
* <point> is ignored if not specified (so you can target the whole release)
* <minor> and <major> must match
* Each target version must be at least <major> and <minor>
*/
function versionCheck(required, current) {
    let currentArray = current.split('.');
    let major = currentArray[0];
    let minor = currentArray[1];
    let point = currentArray[2];
    for (let i = 0; i < required.length; i++) {
        let requiredArray = required[i].split('.');
        if (requiredArray[0] == major &&
            requiredArray[1] == minor &&
            (requiredArray[2] === undefined || requiredArray[2] == point))
            return true;
    }
    return false;
}

/**
 * versionLeq:
 * @a (string): the first version
 * @b (string): the second version
 *
 * Returns: whether a <= b
 */
function versionLeq(a, b) {
    a = a.split('.');
    b = b.split('.');

    if (a.length == 2)
        a.push(0);

    if (b.length == 2)
        b.push(0);

    for (let i = 0; i < 3; i++) {
        if (a[i] == b[i])
            continue;
        else if (a[i] > b[i])
            return false;
        else
            return true;
    }
    return true;
}

// Returns a string version of a State value
function getMetaStateString(state) {
    switch (state) {
        case State.INITIALIZING:
            return _("Initializing");
        case State.LOADED:
            return _("Loaded");
        case State.ERROR:
            return _("Error");
        case State.OUT_OF_DATE:
            return _("Out of date");
    }
    return 'Unknown'; // Not translated, shouldn't appear
}

/**
 * loadExtension:
 *
 * @uuid (string): uuid of xlet
 * @type (Extension.Type): type of xlet
 */
function loadExtension(uuid, type) {
    let force = uuid.indexOf("!") == 0;
    uuid = uuid.replace(/^!/,'');

    let extension = type.maps.objects[uuid];
    if(!extension) {
        try {
            type.maps.dirs[uuid] = findExtensionDirectory(uuid, type);

            if (type.maps.dirs[uuid] == null)
                throw ("not-found");

            extension = new Extension(type.maps.dirs[uuid], type, force, uuid);

            if(!type.callbacks.finishExtensionLoad(extension))
                throw (type.name + ' ' + uuid + ': Could not create applet object.');

            extension.finalize();
            Main.cinnamonDBusService.EmitXletAddedComplete(true, uuid);
        } catch (e) {
            /* Silently fail to load xlets that aren't actually installed - 
               but no error, since the user can't do anything about it anyhow
               (short of editing gsettings).  Silent failure is consistent with
               other reactions in Cinnamon to missing items (e.g. panel launchers
               just don't show up if their program isn't installed, but we don't
               remove them or anything) */
            if (e == "not-found") {
                forgetExtension(uuid, type, true);
                return null;
            }
            Main.cinnamonDBusService.EmitXletAddedComplete(false, uuid);
            Main.xlet_startup_error = true;
            forgetExtension(uuid, type);
            if(e._alreadyLogged)
                e = undefined;
            global.logError('Could not load ' + type.name.toLowerCase() + ' ' + uuid, e);
            type.maps.meta[uuid].state = State.ERROR;
            if (!type.maps.meta[uuid].name)
                type.maps.meta[uuid].name = uuid
            return null;
        }
    }
    return extension;
}

/**
 * unloadExtension:
 *
 * @uuid (string): uuid of xlet
 * @type (Extension.Type): type of xlet
 * @deleteConfig (bool): delete also config files, defaults to true
 */
function unloadExtension(uuid, type, deleteConfig = true) {
    let extension = type.maps.objects[uuid];
    if (extension) {
        extension.unlockRole();

        // Try to disable it -- if it's ERROR'd, we can't guarantee that,
        // but it will be removed on next reboot, and hopefully nothing
        // broke too much.
        try {
            extension.type.callbacks.prepareExtensionUnload(extension, deleteConfig);
        } catch(e) {
            global.logError('Error disabling ' + extension.lowerType + ' ' + extension.uuid, e);
        }
        extension.unloadStylesheet();
        extension.unloadIconDirectory();

        extension.type.emit('extension-unloaded', extension.uuid);

        forgetExtension(extension.uuid, type, true);
    }
}

function forgetExtension(uuid, type, forgetMeta) {
    delete imports[type.maps.objects[uuid].lowerType + 's'][uuid];
    delete type.maps.importObjects[uuid];
    delete type.maps.objects[uuid];
    if(forgetMeta)
        delete type.maps.meta[uuid];
}

/**
 * reloadExtension:
 *
 * @uuid (string): uuid of xlet
 * @type (Extension.Type): type of xlet
 *
 * Reloads an xlet. Useful when the source has changed.
 */
function reloadExtension(uuid, type) {
    let extension = type.maps.objects[uuid];

    if (extension) {
        unloadExtension(uuid, type, false);
        Main._addXletDirectoriesToSearchPath();
    }

    loadExtension(uuid, type);
}

function findExtensionDirectory(uuid, type) {
    let dirPath = type.userDir + "/" + uuid;
    let dir = Gio.file_new_for_path(dirPath);
    if (dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null)
            == Gio.FileType.DIRECTORY)
        return dir;

    let systemDataDirs = GLib.get_system_data_dirs();
    for (let datadir of systemDataDirs) {
        dirPath = datadir + '/cinnamon/' + type.folder + '/' + uuid;
        dir = Gio.file_new_for_path(dirPath);
        if (dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null)
                == Gio.FileType.DIRECTORY)
            return dir;
    }
    return null;
}

function getMetadata(uuid, type) {
    let dir = findExtensionDirectory(uuid, type);
    let metadataFile = dir.get_child('metadata.json');

    let metadataContents = Cinnamon.get_file_contents_utf8_sync(metadataFile.get_path());
    let metadata = JSON.parse(metadataContents);
    metadata.path = dir.get_path();

    return metadata;
}

/**
 * findExtensionSubdirectory:
 * @dir (Gio.File): directory to search in
 *
 * For extensions that are shipped with multiple versions in different
 * directories, look for the largest available version that is less than or
 * equal to the current running version. If no such version is found, the
 * original directory is returned.
 *
 * Returns (Gio.File): directory object of the desired directory.
 */
function findExtensionSubdirectory(dir) {
    try {
        let fileEnum = dir.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);

        let info;
        let largest = null;
        while ((info = fileEnum.next_file(null)) != null) {
            let fileType = info.get_file_type();
            if (fileType != Gio.FileType.DIRECTORY)
                continue;

            let name = info.get_name();
            if (!name.match(/^[1-9][0-9]*\.[0-9]+(\.[0-9]+)?$/))
                continue;

            if (versionLeq(name, Config.PACKAGE_VERSION) &&
                (!largest || versionLeq(largest[0], name))) {
                largest = [name, fileEnum.get_child(info)];
            }
        }

        fileEnum.close(null);
        if (largest)
            return largest[1];
        else
            return dir;
    } catch (e) {
        global.logError('Error looking for extension version for ' + dir.get_basename() + ' in directory ' + dir, e);
        return dir;
    }
}

function get_max_instances (uuid, type) {
    if (uuid in type.maps.meta) {
        if ("max-instances" in type.maps.meta[uuid]) {
            let i = type.maps.meta[uuid]["max-instances"];
            return parseInt(i);
        }
    }
    return 1;
}
