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
const {requireModule, unloadModule, getModuleByIndex} = imports.misc.fileUtils;

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
        userDir: GLib.build_filenamev([global.userdatadir, folder])
    };

    Object.assign(type, overrides);

    // Add signal methods
    Signals.addSignalMethods(type);

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
const extensions = [];
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
function createMetaDummy(uuid, path, state) {
    return {name: uuid, description: 'Metadata load failed', state: state, path: path, error: ''};
}

function findExtensionIndex(uuid) {
    return extensions.findIndex(function(extension) {
        return extension.uuid === uuid;
    });
}

function getExtension(uuid) {
    let index = findExtensionIndex(uuid);
    if (!extensions[index]) {
        return null;
    }
    return extensions[index];
}

// The Extension object itself
function Extension(type, uuid) {
    return new Promise((resolve) => {
        let extension = getExtension(uuid);
        if (extension) {
            resolve(extension);
            return;
        }
        let dir = findExtensionDirectory(uuid, type.userDir, type.folder);

        if (dir == null) {
            forgetExtension(uuid, type, true);
            return;
        }
        this._init(dir, type, uuid).then(function(extension) {
            extensions.push(extension);

            if(!type.callbacks.finishExtensionLoad(extension)) {
                throw new Error(`${type.name} ${uuid}: Could not create applet object.`);
            }
            extension.finalize();
            Main.cinnamonDBusService.EmitXletAddedComplete(true, uuid);
            resolve(extension);
        }).catch(function(e) {
            /* Silently fail to load xlets that aren't actually installed -
               but no error, since the user can't do anything about it anyhow
               (short of editing gsettings).  Silent failure is consistent with
               other reactions in Cinnamon to missing items (e.g. panel launchers
               just don't show up if their program isn't installed, but we don't
               remove them or anything) */
            Main.cinnamonDBusService.EmitXletAddedComplete(false, uuid);
            Main.xlet_startup_error = true;
            forgetExtension(uuid, type);
            if (e._alreadyLogged) {
                e = undefined;
            }
            global.logError(`Could not load ${type.name.toLowerCase()} ${uuid}`, e);
            resolve(null);
        });
    });
}

Extension.prototype = {
    _init: function(dir, type, uuid) {
        return new Promise((resolve, reject) => {
            this.name = type.name;
            this.uuid = uuid;
            this.dir = dir;
            this.upperType = type.name.toUpperCase().replace(/\s/g, "_");
            this.lowerType = type.name.toLowerCase().replace(/\s/g, "_");
            this.theme = null;
            this.stylesheet = null;
            this.iconDirectory = null;
            this.meta = createMetaDummy(this.uuid, dir.get_path(), State.INITIALIZING);
            this.startTime = new Date().getTime();

            this.loadMetaData(dir.get_child('metadata.json')).then(() => {
                if (uuid.indexOf('!') !== 0) {
                    this.uuid = uuid.replace(/^!/, '');
                    this.validateMetaData();
                }

                if (this.meta.multiversion) {
                    this.dir = findExtensionSubdirectory(this.dir);
                    this.meta.path = this.dir.get_path();
                    let pathSections = this.meta.path.split('/');
                    let version = pathSections[pathSections.length - 1];
                    try {
                        imports[type.folder][this.uuid] = imports[type.folder][this.uuid][version];
                    } catch (e) {/* Extension was reloaded */}
                }

                this.ensureFileExists(this.dir.get_child(`${this.lowerType}.js`));
                this.loadStylesheet(this.dir.get_child('stylesheet.css'));

                if (this.stylesheet) {
                    Main.themeManager.connect('theme-set', () => {
                        this.loadStylesheet(this.dir.get_child('stylesheet.css'));
                    });
                }
                this.loadIconDirectory(this.dir);

                // get [extension/applet/desklet].js
                return requireModule(
                    `${this.meta.path}/${this.lowerType}.js`, // path
                    this.meta.path, // dir
                    true, // async
                    true // returnIndex
                );
            }).then((moduleIndex) => {
                if (moduleIndex == null) {
                    throw new Error(`Could not find module index: ${moduleIndex}`);
                }
                this.moduleIndex = moduleIndex;
                let module = getModuleByIndex(moduleIndex);
                for (let i = 0; i < type.requiredFunctions.length; i++) {
                    let func = type.requiredFunctions[i];
                    if (!module[func]) {
                        reject(this.logError(`Function "${func}" is missing`));
                    }
                }
                resolve(this);
            }).catch((e) => {
                reject(this.logError(`Error importing ${this.lowerType}.js from ${this.uuid}`, e));
            });
        });
    },

    finalize : function() {
        this.meta.state = State.LOADED;

        Type[this.upperType].emit('extension-loaded', this.uuid);

        let endTime = new Date().getTime();
        global.log(`Loaded ${this.lowerType} ${this.uuid} in ${endTime - this.startTime} ms`);
    },

    formatError:function(message) {
        return `[${this.name} "${this.uuid}"]: ${message}`;
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
        if (this.meta.state == State.INITIALIZING) {
            this.unlockRole();
            this.unloadStylesheet();
            this.unloadIconDirectory();
            forgetExtension(this.uuid, Type[this.upperType]);
        }
        error._alreadyLogged = true;
        return error;
    },

    logWarning: function (message) {
        global.logWarning(this.formatError(message));
    },

    loadMetaData: function(metadataFile) {
        return new Promise((resolve, reject) => {
            let oldState = this.meta.state;
            let oldPath = this.meta.path;
            this.ensureFileExists(metadataFile);
            metadataFile.load_contents_async(null, (object, result) => {
                try {
                    let [success, json] = metadataFile.load_contents_finish(result);
                    if (!success) {
                        reject();
                        return;
                    }
                    this.meta = JSON.parse(json);

                    // Store some additional crap here
                    this.meta.state = oldState;
                    this.meta.path = oldPath;
                    this.meta.error = '';
                    resolve();
                } catch (e) {
                    this.meta = createMetaDummy(this.uuid, oldPath, State.ERROR);
                    reject(this.logError('Failed to load/parse metadata.json', e));
                }
            });
        });
    },

    validateMetaData: function() {
        // Some properties are required to run
        this.checkProperties(Type[this.upperType].requiredProperties, true);

        // Others are nice to have
        this.checkProperties(Type[this.upperType].niceToHaveProperties, false);

        if (this.meta.uuid != this.uuid) {
            throw this.logError(`uuid "${this.meta.uuid}" from metadata.json does not match directory name.`);
        }

        // If cinnamon or js version are set, check them
        if ('cinnamon-version' in this.meta && !versionCheck(this.meta['cinnamon-version'], Config.PACKAGE_VERSION)) {
            throw this.logError('Extension is not compatible with current Cinnamon version', null, State.OUT_OF_DATE);
        }
        if ('js-version' in this.meta && !versionCheck(this.meta['js-version'], Config.GJS_VERSION)) {
            throw this.logError('Extension is not compatible with current GJS version', null, State.OUT_OF_DATE);
        }

        // If a role is set, make sure it's a valid one
        let role = this.meta['role'];
        if (role) {
            if (!(role in Type[this.upperType].roles)) {
                throw this.logError(`Unknown role definition: ${role} in metadata.json`);
            }
        }
    },

    checkProperties: function(properties, fatal) {
        for (let i = 0; i < properties.length; i++) {
            let prop = properties[i];
            if (!this.meta[prop]) {
                let msg = `Missing property "${prop}" in metadata.json`;
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
                let path = file.get_path();
                this.theme.load_stylesheet(path);
                this.stylesheet = path;
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
            throw this.logError(`File not found: ${file.get_path()}`);
        }
    },

    lockRole: function(roleProvider) {
        if (this.meta
            && this.meta.role
            && Type[this.upperType].roles[this.meta.role] !== this.uuid) {
            if (Type[this.upperType].roles[this.meta.role] != null) {
                return false;
            }

            if (roleProvider != null) {
                Type[this.upperType].roles[this.meta.role] = this.uuid;
                this.roleProvider = roleProvider;
                global.log(`Role locked: ${this.meta.role}`);
            }
        }

        return true;
    },

    unlockRole: function() {
        if (this.meta.role && Type[this.upperType].roles[this.meta.role] === this.uuid) {
            Type[this.upperType].roles[this.meta.role] = null;
            this.roleProvider = null;
            global.log(`Role unlocked: ${this.meta.role}`);
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
    return new Extension(type, uuid);
}

/**
 * unloadExtension:
 *
 * @uuid (string): uuid of xlet
 * @type (Extension.Type): type of xlet
 * @deleteConfig (bool): delete also config files, defaults to true
 */
function unloadExtension(uuid, type, deleteConfig = true) {
    return new Promise(function(resolve, reject) {
        let extensionIndex = findExtensionIndex(uuid);
        if (extensionIndex > -1) {
            let extension = extensions[extensionIndex];
            extension.unlockRole();

            // Try to disable it -- if it's ERROR'd, we can't guarantee that,
            // but it will be removed on next reboot, and hopefully nothing
            // broke too much.
            try {
                Type[extension.upperType].callbacks.prepareExtensionUnload(extension, deleteConfig);
            } catch(e) {
                global.logError(`Error disabling ${extension.lowerType} ${extension.uuid}`, e);
            }
            extension.unloadStylesheet();
            extension.unloadIconDirectory();

            Type[extension.upperType].emit('extension-unloaded', extension.uuid);

            forgetExtension(extensionIndex, uuid, type, true);
            resolve();
        }
    });
}

function forgetExtension(extensionIndex, uuid, type, forgetMeta) {
    /*if (typeof type.maps.importObjects[uuid] !== 'undefined') {
        delete type.maps.importObjects[uuid];
    }*/
    if (typeof extensions[extensionIndex] !== 'undefined') {
        unloadModule(extensions[extensionIndex].moduleIndex);
        if (typeof imports[type.folder][uuid] !== 'undefined') {
            delete imports[type.folder][uuid];
        }
        if (forgetMeta) {
            extensions[extensionIndex] = undefined;
            extensions.splice(extensionIndex, 1);
        }
    }
    /*if (forgetMeta && typeof type.maps.meta[uuid] !== 'undefined') {
        delete type.maps.meta[uuid];
    }*/
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
    if (findExtensionIndex(uuid) > -1) {
        unloadExtension(uuid, type, false).then(function() {
            Main._addXletDirectoriesToSearchPath();
            loadExtension(uuid, type);
        });
        return;
    }

    loadExtension(uuid, type);
}

function findExtensionDirectory(uuid, userDir, folder) {
    let dirPath = `${userDir}/${uuid}`;
    let dir = Gio.file_new_for_path(dirPath);
    if (dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null)
            == Gio.FileType.DIRECTORY)
        return dir;

    let systemDataDirs = GLib.get_system_data_dirs();
    for (let datadir of systemDataDirs) {
        dirPath = `${datadir}/cinnamon/${folder}/${uuid}`;
        dir = Gio.file_new_for_path(dirPath);
        if (dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null)
                == Gio.FileType.DIRECTORY)
            return dir;
    }
    return null;
}

function getMetadata(uuid, type) {
    let dir = findExtensionDirectory(uuid, type.userDir, type.folder);
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
        global.logError(`Error looking for extension version for ${dir.get_basename()} in directory ${dir}`, e);
        return dir;
    }
}

function get_max_instances (uuid, type) {
    let extension = getExtension(uuid);

    if (extension && extension.uuid) {
        if (extension.meta['max-instances']) {
            let i = extension.meta['max-instances'];
            return parseInt(i);
        }
    }
    return 1;
}
