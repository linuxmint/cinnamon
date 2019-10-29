// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Signals = imports.signals;
const St = imports.gi.St;

const AppletManager = imports.ui.appletManager;
const Config = imports.misc.config;
const DeskletManager = imports.ui.deskletManager;
const ExtensionSystem = imports.ui.extensionSystem;
const SearchProviderManager = imports.ui.searchProviderManager;
const Main = imports.ui.main;
const {requireModule, unloadModule, getModuleByIndex} = imports.misc.fileUtils;
const {queryCollection} = imports.misc.util;

var State = {
    INITIALIZING: 0,
    LOADED: 1,
    ERROR: 2,
    OUT_OF_DATE: 3
};

// Xlets using imports.gi.NMClient. This should be removed in Cinnamon 4.2+,
// after these applets have been updated on Spices.
var knownCinnamon4Conflicts = [
    // Applets
    'turbonote@iksws.com.b',
    'vnstat@linuxmint.com',
    'netusagemonitor@pdcurtis',
    'multicore-sys-monitor@ccadeptic23',
    // Desklets
    'netusage@30yavash.com',
    'simple-system-monitor@ariel'
];

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
            prepareExtensionUnload: manager.prepareExtensionUnload,
            prepareExtensionReload: manager.prepareExtensionReload
        },
        userDir: GLib.build_filenamev([global.userdatadir, folder]),
        legacyMeta: {}
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
var startTime;
var extensions = [];
var Type = {
    EXTENSION: _createExtensionType("Extension", "extensions", ExtensionSystem, {
        requiredFunctions: ["init", "disable", "enable"],
        requiredProperties: ["uuid", "name", "description", "cinnamon-version"],
        niceToHaveProperties: ["url"],
    }),
    APPLET: _createExtensionType("Applet", "applets", AppletManager, {
        roles: {
            notifications: null,
            windowlist: null,
            panellauncher: null,
            tray: null
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

function getExtension(uuid) {
    return queryCollection(extensions, {uuid});
}

function formatError(uuid, message) {
    return `[${uuid}]: ${message}`;
}

function logError(message, uuid, error, state) {
    let errorMessage = formatError(uuid, message);
    if (!error) {
        error = new Error(errorMessage);
    } else {
        error.message = `\n${formatError(uuid, error.message)}`;
        error.message += `\n${errorMessage}`;
    }

    error.stack = error.stack.split('\n')
        .filter(function(line) {
            return !line.match(/<Promise>|wrapPromise/);
        })
        .join('\n');

    global.logError(error);

    // An error during initialization leads to unloading the extension again.
    let extension = getExtension(uuid);
    if (extension) {
        extension.meta.state = state || State.ERROR;
        extension.meta.error += message;
        if (extension.meta.state === State.INITIALIZING) {
            extension.unlockRole();
            extension.unloadStylesheet();
            extension.unloadIconDirectory();
            forgetExtension(uuid, Type[extension.upperType]);
        }
    }
    error._alreadyLogged = true;
    return error;
}

function ensureFileExists(file) {
    if (!file.query_exists(null)) {
        throw logError(`File not found: ${file.get_path()}`);
    }
}

// The Extension object itself
function Extension(type, uuid) {
    let extension = getExtension(uuid);
    if (extension) {
        return Promise.resolve(true);
    }
    let force = false;
    if (uuid.substr(0, 1) === '!') {
        uuid = uuid.replace(/^!/, '');
        force = true;
    }
    let dir = findExtensionDirectory(uuid, type.userDir, type.folder);

    if (dir == null) {
        forgetExtension(uuid, type, true);
        return Promise.resolve(null);
    }
    return this._init(dir, type, uuid, force);
}

Extension.prototype = {
    _init: function(dir, type, uuid, force) {
        this.name = type.name;
        this.uuid = uuid;
        this.dir = dir;
        this.upperType = type.name.toUpperCase().replace(/\s/g, "_");
        this.lowerType = type.name.toLowerCase().replace(/\s/g, "_");
        this.theme = null;
        this.stylesheet = null;
        this.iconDirectory = null;
        this.meta = createMetaDummy(uuid, dir.get_path(), State.INITIALIZING);

        let isPotentialNMClientConflict = knownCinnamon4Conflicts.indexOf(uuid) > -1;

        const finishLoad = () => {
            // Many xlets still use appletMeta/deskletMeta to get the path
            type.legacyMeta[uuid] = {path: this.meta.path};

            ensureFileExists(this.dir.get_child(`${this.lowerType}.js`));
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
                this.meta.path, // dir,
                this.meta, // meta
                this.lowerType, // type
                true, // async
                true // returnIndex
            );
        };

        return loadMetaData({
            state: this.meta.state,
            path: this.meta.path,
            uuid: uuid,
            userDir: type.userDir,
            folder: type.folder
        }).then((meta) => {
            // Timer needs to start after the first initial I/O, otherwise every applet shows as taking 1-2 seconds to load.
            // Maybe because of how promises are wired up in CJS?
            // https://github.com/linuxmint/cjs/blob/055da399c794b0b4d76ecd7b5fabf7f960f77518/modules/_lie.js#L9
            startTime = new Date().getTime();
            this.meta = meta;

            if (!force) {
                this.validateMetaData();
            }

            if (this.meta.multiversion) {
                return findExtensionSubdirectory(this.dir).then((dir) => {
                    this.dir = dir;
                    this.meta.path = this.dir.get_path();

                    // If an xlet has known usage of imports.gi.NMClient, we require them to have a
                    // 4.0 directory. It is the only way to assume they are patched for Cinnamon 4 from here.
                    if (isPotentialNMClientConflict && this.meta.path.indexOf(`/4.0`) === -1) {
                        throw new Error(`Found unpatched usage of imports.gi.NMClient for ${this.lowerType} ${uuid}`);
                    }

                    return finishLoad();
                });
            } else if (isPotentialNMClientConflict) {
                throw new Error(`Found un-versioned ${this.lowerType} ${uuid} with known usage of imports.gi.NMClient`);
            }
            return finishLoad();
        }).then((moduleIndex) => {
            if (moduleIndex == null) {
                throw new Error(`Could not find module index: ${moduleIndex}`);
            }
            this.moduleIndex = moduleIndex;
            for (let i = 0; i < type.requiredFunctions.length; i++) {
                let func = type.requiredFunctions[i];
                if (!getModuleByIndex(moduleIndex)[func]) {
                    throw new Error(`Function "${func}" is missing`);
                }
            }

            // Add the extension to the global collection
            extensions.push(this);

            if(!type.callbacks.finishExtensionLoad(extensions.length - 1)) {
                throw new Error(`${type.name} ${uuid}: Could not create ${this.lowerType} object.`);
            }
            this.finalize();
            Main.cinnamonDBusService.EmitXletAddedComplete(true, uuid);
        }).catch((e) => {
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
                return;
            }
            logError(`Error importing ${this.lowerType}.js from ${uuid}`, uuid, e);
        });
    },

    finalize: function() {
        this.meta.state = State.LOADED;

        Type[this.upperType].emit('extension-loaded', this.uuid);

        let endTime = new Date().getTime();
        global.log(`Loaded ${this.lowerType} ${this.uuid} in ${endTime - startTime} ms`);
        startTime = new Date().getTime();
    },

    validateMetaData: function() {
        // Some properties are required to run
        this.checkProperties(Type[this.upperType].requiredProperties, true);

        // Others are nice to have
        this.checkProperties(Type[this.upperType].niceToHaveProperties, false);

        if (this.meta.uuid != this.uuid) {
            throw logError(`uuid "${this.meta.uuid}" from metadata.json does not match directory name.`, this.uuid);
        }

        // If cinnamon or js version are set, check them
        if ('cinnamon-version' in this.meta && !versionCheck(this.meta['cinnamon-version'], Config.PACKAGE_VERSION)) {
            throw logError('Extension is not compatible with current Cinnamon version', this.uuid, null, State.OUT_OF_DATE);
        }
        if ('js-version' in this.meta && !versionCheck(this.meta['js-version'], Config.GJS_VERSION)) {
            throw logError('Extension is not compatible with current GJS version', this.uuid, null, State.OUT_OF_DATE);
        }

        // If a role is set, make sure it's a valid one
        let role = this.meta['role'];
        if (role) {
            if (!(role in Type[this.upperType].roles)) {
                throw logError(`Unknown role definition: ${role} in metadata.json`, this.uuid);
            }
        }
    },

    checkProperties: function(properties, fatal) {
        for (let i = 0; i < properties.length; i++) {
            if (!this.meta[properties[i]]) {
                let msg = `Missing property "${properties[i]}" in metadata.json`;
                if(fatal)
                    throw logError(msg, this.uuid);
                else
                    global.logWarning(formatError(this.uuid, msg));
            }
        }
    },

    loadStylesheet: function (file) {
        if (file.query_exists(null)) {
            try {
                let themeContext = St.ThemeContext.get_for_stage(global.stage);
                this.theme = themeContext.get_theme();
            } catch (e) {
                throw logError('Error trying to get theme', this.uuid, e);
            }

            try {
                let path = file.get_path();
                this.theme.load_stylesheet(path);
                this.stylesheet = path;
            } catch (e) {
                throw logError('Stylesheet parse error', this.uuid, e);
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
function unloadExtension(uuid, type, deleteConfig = true, reload = false) {
    let extensionIndex = queryCollection(extensions, {uuid}, true);
    if (extensionIndex > -1) {
        let extension = extensions[extensionIndex];
        extension.unlockRole();

        // Try to disable it -- if it's ERROR'd, we can't guarantee that,
        // but it will be removed on next reboot, and hopefully nothing
        // broke too much.
        try {
            if (reload) {
                Type[extension.upperType].callbacks.prepareExtensionReload(extension);
            }
            Type[extension.upperType].callbacks.prepareExtensionUnload(extension, deleteConfig);
        } catch (e) {
            logError(`Error disabling ${extension.lowerType} ${extension.uuid}`, extension.uuid, e);
        }
        extension.unloadStylesheet();
        extension.unloadIconDirectory();

        Type[extension.upperType].emit('extension-unloaded', extension.uuid);

        forgetExtension(extensionIndex, uuid, type, true);
    }
}

function forgetExtension(extensionIndex, uuid, type, forgetMeta) {
    if (typeof extensions[extensionIndex] !== 'undefined') {
        unloadModule(extensions[extensionIndex].moduleIndex);
        try {
           delete imports[type.folder][uuid];
        } catch (e) {}
        if (forgetMeta) {
            extensions[extensionIndex] = undefined;
            extensions.splice(extensionIndex, 1);
        }
    }
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
    if (getExtension(uuid)) {
        unloadExtension(uuid, type, false, true);
        Main._addXletDirectoriesToSearchPath();
        loadExtension(uuid, type);
        return;
    }

    loadExtension(uuid, type);
}

function findExtensionDirectory(uuid, userDir, folder) {
    let dir, dirPath;
    if (!GLib.getenv('CINNAMON_TROUBLESHOOT')) {
        dirPath = `${userDir}/${uuid}`;
        dir = Gio.file_new_for_path(dirPath);
        if (dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null) === Gio.FileType.DIRECTORY) {
            return dir;
        }
    }

    let systemDataDirs = GLib.get_system_data_dirs();
    for (let i = 0; i < systemDataDirs.length; i++) {
        dirPath = `${systemDataDirs[i]}/cinnamon/${folder}/${uuid}`;
        dir = Gio.file_new_for_path(dirPath);
        if (dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null) === Gio.FileType.DIRECTORY) {
            return dir;
        }
    }
    return null;
}

function getMetadata(uuid, type) {
    return loadMetaData({
        uuid,
        userDir: type.userDir,
        folder: type.folder
    });
}

function loadMetaData({state, path, uuid, userDir, folder}) {
    return new Promise((resolve, reject) => {
        let dir = findExtensionDirectory(uuid, userDir, folder);
        let meta;
        let metadataFile = dir.get_child('metadata.json');
        let oldState = state ? state : State.INITIALIZING;
        let oldPath = path ? path : dir.get_path();
        ensureFileExists(metadataFile);
        metadataFile.load_contents_async(null, (object, result) => {
            try {
                let [success, json] = metadataFile.load_contents_finish(result);
                if (!success) {
                    reject();
                    return;
                }
                meta = JSON.parse(json);
            } catch (e) {
                logError(`Failed to load/parse metadata.json`, uuid, e);
                meta = createMetaDummy(uuid, oldPath, State.ERROR);

            }
            // Store some additional crap here
            meta.state = oldState;
            meta.path = oldPath;
            meta.error = '';
            resolve(meta);
        });
    });
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
    return new Promise(function(resolve, reject) {
        dir.enumerate_children_async(
            'standard::*',
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            function(obj, res) {
            try {
                let fileEnum = obj.enumerate_children_finish(res);
                let info;
                let largest = null;
                while ((info = fileEnum.next_file(null)) != null) {
                    let fileType = info.get_file_type();
                    if (fileType !== Gio.FileType.DIRECTORY) {
                        continue;
                    }

                    let name = info.get_name();
                    if (!name.match(/^[1-9][0-9]*\.[0-9]+(\.[0-9]+)?$/)) {
                        continue;
                    }

                    if (versionLeq(name, Config.PACKAGE_VERSION) &&
                        (!largest || versionLeq(largest[0], name))) {
                        largest = [name, fileEnum.get_child(info)];
                    }
                }

                fileEnum.close(null);
                resolve(largest ? largest[1] : dir);
            } catch (e) {
                logError(`Error looking for extension version for ${dir.get_basename()} in directory ${dir}`, 'findExtensionSubdirectory', e);
                resolve(dir)
            }

        });
    });
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
