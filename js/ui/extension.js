// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const ByteArray = imports.byteArray;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Signals = imports.signals;
const St = imports.gi.St;
const Meta = imports.gi.Meta;

const AppletManager = imports.ui.appletManager;
const Config = imports.misc.config;
const DeskletManager = imports.ui.deskletManager;
const ExtensionSystem = imports.ui.extensionSystem;
const SearchProviderManager = imports.ui.searchProviderManager;
const Main = imports.ui.main;
const {queryCollection} = imports.misc.util;

var State = {
    INITIALIZING: 0,
    LOADED: 1,
    ERROR: 2,
    OUT_OF_DATE: 3,
    X11_ONLY: 4
};

var x11Only = [
        "systray@cinnamon.org"
    ]

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

// Track the currently loading extension for require() calls during module initialization
var currentlyLoadingExtension = null;
// UUIDs that have already been warned about using deprecated require()
var requireWarned = new Set();

// Stack-based module.exports compatibility for Node.js-style modules
var moduleStack = [];
// Cache of module.exports overrides, keyed by module path
var moduleExportsCache = {};

Object.defineProperty(globalThis, 'module', {
    get: function() {
        if (moduleStack.length > 0) {
            return moduleStack[moduleStack.length - 1];
        }
        return undefined;
    },
    configurable: true
});

// Also provide 'exports' as a shorthand (some code uses it directly)
Object.defineProperty(globalThis, 'exports', {
    get: function() {
        if (moduleStack.length > 0) {
            return moduleStack[moduleStack.length - 1].exports;
        }
        return undefined;
    },
    configurable: true
});

/**
 * getXletFromStack:
 *
 * Get the calling xlet by examining the stack trace.
 *
 * Returns: The Extension object if found, null otherwise
 */
function getXletFromStack() {
    let stack = new Error().stack.split('\n');
    for (let i = 1; i < stack.length; i++) {
        for (let folder of ['applets', 'desklets', 'extensions', 'search_providers']) {
            let match = stack[i].match(new RegExp(`/${folder}/([^/]+)/`));
            if (match) {
                return getExtension(match[1]) || getExtension(match[1].replace('!', ''));
            }
        }
    }
    return null;
}

/**
 * getCurrentExtension:
 *
 * Get the current xlet's Extension object. Can be called during module
 * initialization or at runtime.
 *
 * Usage in xlets:
 *   const Extension = imports.ui.extension;
 *   const Me = Extension.getCurrentExtension();
 *   const MyModule = Me.imports.myModule;
 *
 * Returns: The Extension object for the calling xlet
 */
function getCurrentExtension() {
    return currentlyLoadingExtension || getXletFromStack();
}

/**
 * xletRequire:
 * @path (string): The module path to require
 *
 * ********************* DEPRECATED ************************
 * *** Use getCurrentExtension() to import local modules ***
 * *********************************************************
 *
 * Global require function for xlets. Supports:
 * - Relative paths: './calendar' -> extension.imports.calendar
 * - GI imports: 'gi.St' -> imports.gi.St
 * - Cinnamon imports: 'ui.main' -> imports.ui.main
 *
 * Returns: The required module
 */
var _FunctionConstructor = (0).constructor.constructor;

function _evalModule(extension, resolvedPath) {
    let filePath = `${extension.meta.path}/${resolvedPath}.js`;
    let file = Gio.File.new_for_path(filePath);
    let [success, contents] = file.load_contents(null);
    if (!success) {
        throw new Error(`Failed to load ${filePath}`);
    }

    let source = ByteArray.toString(contents);
    let exports = {};
    let module = { exports: exports };

    // Regex matches top level declarations and appends them to exports,
    // mimicking how the native CJS importer handles var/function.
    let re = /^(?:const|var|let|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm;
    let match;
    let exportLines = '';
    while ((match = re.exec(source)) !== null) {
        exportLines += `if(typeof ${match[1]}!=='undefined')exports.${match[1]}=${match[1]};`;
    }

    source = `'use strict';${source};${exportLines}return module.exports;//# sourceURL=${filePath}`;

    _FunctionConstructor(
        'require', 'exports', 'module', source
    ).call(
        exports,
        function require(path) { return xletRequire(path); },
        exports,
        module
    );

    return module.exports;
}

function _requireLocal(extension, path) {
    let parts = path.replace(/^\.\//, '').replace(/\.js$/, '').split('/');
    let resolvedPath = parts.filter(p => p !== '..').join('/');
    let cacheKey = `${extension.meta.path}/${resolvedPath}`;

    if (cacheKey in moduleExportsCache) {
        return moduleExportsCache[cacheKey];
    }

    let moduleObj = { exports: {} };
    moduleObj._originalExports = moduleObj.exports;
    moduleStack.push(moduleObj);

    let nativeModule;
    try {
        nativeModule = extension.imports;
        for (let part of parts) {
            if (part === '..') continue;
            nativeModule = nativeModule[part];
        }
    } finally {
        moduleStack.pop();
    }

    let result;

    let exportsReplaced = moduleObj.exports !== moduleObj._originalExports;
    let exportsMutated = Object.getOwnPropertyNames(moduleObj._originalExports).length > 0;

    if (exportsReplaced) {
        result = moduleObj.exports;
    } else if (exportsMutated) {
        result = moduleObj._originalExports;
    } else {
        // CJS only exports var/function declarations as module properties.
        // let/const/class values are inaccessible via the native module object.
        // Fall back to evaluating the source with module/exports in scope.
        result = _evalModule(extension, resolvedPath);
    }

    moduleExportsCache[cacheKey] = result;
    return result;
}

function xletRequire(path) {
    let extension = currentlyLoadingExtension || getXletFromStack();
    if (!extension) {
        throw new Error(`require() called outside of xlet context: ${path}`);
    }

    if (!requireWarned.has(extension.uuid)) {
        requireWarned.add(extension.uuid);
        global.logWarning(`${extension.uuid}: require() and module.exports are deprecated. Define exportable symbols with 'var' and use Extension.getCurrentExtension().imports to access local modules.`);
    }

    // Relative paths: './foo' or '../foo' -> extension local module
    if (path.startsWith('./') || path.startsWith('../')) {
        return _requireLocal(extension, path);
    }

    // GI imports: 'gi.St' -> imports.gi.St
    if (path.startsWith('gi.')) {
        return imports.gi[path.slice(3)];
    }

    // Cinnamon imports: 'ui.main', 'misc.util', etc.
    let prefixes = ['ui', 'misc', 'perf'];
    for (let prefix of prefixes) {
        if (path.startsWith(prefix + '.')) {
            return imports[prefix][path.slice(prefix.length + 1)];
        }
    }

    // Bare name: try as a local module first, fall back to global
    try {
        return _requireLocal(extension, path);
    } catch (e) {
        return imports[path];
    }
}

/**
 * installXletImporter:
 * @extension (Extension): The extension object
 *
 * Install native importer for xlet by temporarily modifying
 * the search path.
 */
function installXletImporter(extension) {
    // extension.dir is the actual directory containing the JS files,
    // which might be a versioned subdirectory (e.g., .../uuid/6.0/)
    // or the uuid directory itself for non-versioned xlets.
    let parentPath = extension.dir.get_parent().get_path();
    let dirName = extension.dir.get_basename();

    let oldSearchPath = imports.searchPath.slice();
    imports.searchPath = [parentPath];

    try {
        extension.imports = imports[dirName];
    } catch (e) {
        imports.searchPath = oldSearchPath;
        throw new Error(`Failed to create importer for ${extension.uuid} at ${parentPath}/${dirName}: ${e.message}`);
    }

    imports.searchPath = oldSearchPath;

    if (!extension.imports) {
        throw new Error(`Importer is null for ${extension.uuid} at ${parentPath}/${dirName}`);
    }
}

/**
 * clearXletImportCache:
 * @extension (Extension): The extension object
 *
 * Clear import cache to allow reloading of the xlet.
 * Clears all cached module properties from the xlet's sub-importer.
 */
function clearXletImportCache(extension) {
    if (!extension) return;

    // Clear all cached modules from the xlet's importer
    if (!extension.imports) return;

    // Meta properties that should not be cleared
    const metaProps = ['searchPath', '__moduleName__', '__parentModule__',
                      '__modulePath__', '__file__', '__init__', 'toString',
                      'clearCache'];

    try {
        let props = Object.getOwnPropertyNames(extension.imports);
        for (let prop of props) {
            if (!metaProps.includes(prop)) {
                extension.imports.clearCache(prop);
            }
        }
    } catch (e) {
        // clearCache may not be available if cjs is not updated
    }
}

globalThis.require = xletRequire;

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
            windowattentionhandler: null,
            panellauncher: null,
            tray: null
        }
    }),
    DESKLET: _createExtensionType("Desklet", "desklets", DeskletManager, {
        roles: {
            notifications: null,
            windowlist: null,
            windowattentionhandler: null
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
        error = new Error(errorMessage, { cause: state });
    } else {
        error.message = `\n${formatError(uuid, error.message)}`;
        error.message += `\n${errorMessage}`;
    }

    if (state !== State.X11_ONLY) {
        global.logError(error);
    } else {
        global.logWarning(error.message);
    }

    // An error during initialization leads to unloading the extension again.
    let extension = getExtension(uuid);
    if (extension) {
        extension.meta.state = state || State.ERROR;
        extension.meta.error += message;
        if (extension.meta.state === State.INITIALIZING) {
            extension.unlockRoles();
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
    if (extension) return Promise.resolve(true);

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
    _init: async function(dir, type, uuid, force) {
        this.name = type.name;
        this.uuid = uuid;
        this.dir = dir;
        this.upperType = type.name.toUpperCase().replace(/\s/g, "_");
        this.lowerType = type.name.toLowerCase().replace(/\s/g, "_");
        this.theme = null;
        this.stylesheet = null;
        this.iconDirectory = null;
        this.meta = createMetaDummy(uuid, dir.get_path(), State.INITIALIZING);

        try {
            this.meta = await loadMetaData({
                state: this.meta.state,
                path: this.meta.path,
                uuid: uuid,
                userDir: type.userDir,
                folder: type.folder,
                force: force
            });

            // Timer needs to start after the first initial I/O
            startTime = new Date().getTime();

            if (!force) {
                this.validateMetaData();
            }

            this.dir = await findExtensionSubdirectory(this.dir);
            this.meta.path = this.dir.get_path();

            this._finishLoad(type, uuid);
        } catch (e) {
            this._handleLoadError(type, uuid, e);
        }
    },

    _finishLoad: function(type, uuid) {
        try {
            type.legacyMeta[uuid] = {path: this.meta.path};

            ensureFileExists(this.dir.get_child(`${this.lowerType}.js`));
            this.loadStylesheet(this.dir.get_child('stylesheet.css'));

            if (this.stylesheet) {
                Main.themeManager.connect('theme-set', () => {
                    this.loadStylesheet(this.dir.get_child('stylesheet.css'));
                });
            }
            this.loadIconDirectory(this.dir);

            installXletImporter(this);
            currentlyLoadingExtension = this;

            try {
                this.module = this.imports[this.lowerType];
            } finally {
                currentlyLoadingExtension = null;
            }

            if (this.module == null) {
                throw new Error(`Could not load module for ${uuid}`);
            }

            for (let func of type.requiredFunctions) {
                if (!this.module[func]) {
                    throw new Error(`Function "${func}" is missing`);
                }
            }

            extensions.push(this);

            if (!type.callbacks.finishExtensionLoad(extensions.length - 1)) {
                throw new Error(`Could not create ${this.lowerType} object.`);
            }

            this.finalize();
            Main.cinnamonDBusService.EmitXletAddedComplete(true, uuid);

        } catch (e) {
            this._handleLoadError(type, uuid, e);
        }
    },

    _handleLoadError: function(type, uuid, error) {
        Main.cinnamonDBusService.EmitXletAddedComplete(false, uuid);

        if (error.cause == null || error.cause !== State.X11_ONLY) {
            Main.xlet_startup_error = true;
        }

        forgetExtension(uuid, type);

        if (!error._alreadyLogged) {
            logError(`Error importing ${this.lowerType}.js from ${uuid}`, uuid, error);
        }
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
        if (x11Only.includes(this.meta.uuid) && Meta.is_wayland_compositor()) {
            throw logError("Extension not compatible with Wayland", this.uuid, null, State.X11_ONLY);
        }

        this.checkProperties(Type[this.upperType].requiredProperties, true);

        // Others are nice to have
        this.checkProperties(Type[this.upperType].niceToHaveProperties, false);

        if (this.meta.uuid != this.uuid) {
            throw logError(`uuid "${this.meta.uuid}" from metadata.json does not match directory name.`, this.uuid);
        }

        // If cinnamon versions are set check them
        if ('cinnamon-version' in this.meta && !versionCheck(this.meta['cinnamon-version'], Config.PACKAGE_VERSION)) {
            throw logError('Extension is not compatible with current Cinnamon version', this.uuid, null, State.OUT_OF_DATE);
        }

        // If a role is set, make sure it's a valid one
        let meta_role_list_str = this.meta['role'];
        if (meta_role_list_str) {
            let meta_roles = meta_role_list_str.replaceAll(" ", "").split(",");
            for (let role of meta_roles) {
                if (!(role in Type[this.upperType].roles)) {
                    throw logError(`Unknown role definition: ${role} in metadata.json`, this.uuid);
                }
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
        if (this.meta && this.meta.role) {
            let meta_role_list_str = this.meta.role;
            let meta_roles = meta_role_list_str.replaceAll(" ", "").split(",");

            let avail_roles = [];

            for (let role of meta_roles) {
                if (Type[this.upperType].roles[role] !== this.uuid) {
                    if (Type[this.upperType].roles[role] != null) {
                        continue;
                    }

                    avail_roles.push(role);
                }
            }

            if (avail_roles.length == 0) {
                return false;
            }

            if (roleProvider != null) {
                for (let role of avail_roles) {
                    Type[this.upperType].roles[role] = this.uuid;
                    this.roleProvider = roleProvider;
                    global.log(`Role locked: ${role}`);
                }
            }
        }

        return true;
    },

    unlockRoles: function() {
        if (this.meta.role) {
            let meta_role_list_str = this.meta.role;
            let meta_roles = meta_role_list_str.replaceAll(" ", "").split(",");

            for (let role of meta_roles) {
                if (Type[this.upperType].roles[role] === this.uuid) {
                    Type[this.upperType].roles[role] = null;
                    this.roleProvider = null;
                    global.log(`Role unlocked: ${role}`);
                }
            }
        }
    }
}

/**
* versionCheck:
* @required: an array of minimum versions we are compatible with
* @current: the version we have
*
* Check if a component is compatible for an extension.
* @required is an array, and at least one version must be lower than the current version.
* @current must be in the format <major>.<minor>.<point>.<micro>
* <micro> is always ignored
* <point> is ignored if not specified (so you can target the whole release)
* <minor> and <major> must match
* Each target version must be at least <major> and <minor>
*/
function versionCheck(required, current) {
    let currentArray = current.split('.');
    let currentMajor = parseInt(currentArray[0]);
    let currentMinor = parseInt(currentArray[1]);
    for (let i = 0; i < required.length; i++) {
        let requiredArray = required[i].split('.');
        requiredMajor = parseInt(requiredArray[0]);
        requiredMinor = parseInt(requiredArray[1]);
        if (currentMajor > requiredMajor || (currentMajor == requiredMajor  && currentMinor >= requiredMinor)) {
            return true;
        }
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
        case State.X11_ONLY:
            return _("Not compatible with Wayland");
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
        extension.unlockRoles();

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
        let extension = extensions[extensionIndex];

        // Clear module.exports cache entries for this extension
        let pathPrefix = extension.meta.path + '/';
        for (let key in moduleExportsCache) {
            if (key.startsWith(pathPrefix)) {
                delete moduleExportsCache[key];
            }
        }

        // Clear the import cache to allow reloading (must be done before nulling references)
        clearXletImportCache(extension);

        // Clear the module reference
        extension.module = null;
        extension.imports = null;

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
    let extension = getExtension(uuid);

    if (extension) {
        unloadExtension(uuid, type, false, true);
        Main._addXletDirectoriesToSearchPath();

        if (extension.meta.force_loaded) {
            uuid = "!" + uuid;
        }
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

function maybeAddWindowAttentionHandlerRole(meta) {
    const keywords = ['window-list', 'windowlist', 'taskbar'];

    keywords.some(element => {
        if (meta.uuid.includes(element)) {
            if (!meta.role) {
                meta.role = "windowattentionhandler";
            } else {
                if (!meta.role.includes("windowattentionhandler")) {
                    meta.role += ",windowattentionhandler";
                }
            }
        }
    });
}

function loadMetaData({state, path, uuid, userDir, folder, force}) {
    return new Promise((resolve) => {
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
                    throw new Error('Failed to load metadata');
                }
                meta = JSON.parse(ByteArray.toString(json));
                maybeAddWindowAttentionHandlerRole(meta);
            } catch (e) {
                logError(`Failed to load/parse metadata.json`, uuid, e);
                meta = createMetaDummy(uuid, oldPath, State.ERROR);
            }

            meta.state = oldState;
            meta.path = oldPath;
            meta.error = '';
            meta.force_loaded = force;
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
 * Returns: Promise that resolves to the directory
 */
function findExtensionSubdirectory(dir) {
    return new Promise((resolve) => {
        dir.enumerate_children_async(
            'standard::*',
            Gio.FileQueryInfoFlags.NONE,
            GLib.PRIORITY_DEFAULT,
            null,
            (obj, res) => {
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
                    logError(`Error looking for extension version for ${dir.get_basename()}`,
                             'findExtensionSubdirectory', e);
                    resolve(dir);  // Fall back to original dir
                }
            }
        );
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
