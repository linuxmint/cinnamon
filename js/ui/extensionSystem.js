// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Main = imports.ui.main;
const Extension = imports.ui.extension;
const {getModuleByIndex} = imports.misc.fileUtils;

// Maps uuid -> importer object (extension directory tree)
var extensions;
// Kept for compatibility
var extensionMeta;
// Lists extension uuid's that are currently active;
var runningExtensions = [];
// Arrays of uuids
var enabledExtensions;
// Maps extension.uuid -> extension objects
var extensionObj = [];
var promises = [];
var ENABLED_EXTENSIONS_KEY = 'enabled-extensions';

// Deprecated, kept for compatibility reasons
var ExtensionState;

// Deprecated, kept for compatibility reasons
function disableExtension(uuid) {
    Extension.unloadExtension(uuid, Extension.Type.EXTENSION);
}

// Deprecated, kept for compatibility reasons
function enableExtension(uuid) {
    Extension.loadExtension(uuid, Extension.Type.EXTENSION);
}

// Callback for extension.js
function prepareExtensionUnload(extension) {
    try {
        getModuleByIndex(extension.moduleIndex).disable();
    } catch (e) {
        Extension.logError('Failed to evaluate \'disable\' function on extension: ' + extension.uuid, e);
    }
    let runningExtensionIndex = runningExtensions.findIndex(function(uuid) {
        return extension.uuid === uuid;
    });
    runningExtensions.splice(runningExtensionIndex, 1);

    if (extensionObj[extension.uuid])
        delete extensionObj[extension.uuid];
}


// Callback for extension.js
function prepareExtensionReload(extension) {
    try {
        let on_extension_reloaded = getModuleByIndex(extension.moduleIndex).on_extension_reloaded;
        if (on_extension_reloaded) on_extension_reloaded();
    } catch (e) {
        Extension.logError('Failed to evaluate \'on_extension_reloaded\' function on extension: ' + extension.uuid, e);
    }
}

// Callback for extension.js
function finishExtensionLoad(extensionIndex) {
    let extension = Extension.extensions[extensionIndex];
    if (!extension.lockRole(getModuleByIndex(extension.moduleIndex))) {
        return false;
    }

    try {
        getModuleByIndex(extension.moduleIndex).init(extension.meta);
    } catch (e) {
        Extension.logError('Failed to evaluate \'init\' function on extension: ' + extension.uuid, e);
        return false;
    }

    let extensionCallbacks;
    try {
        extensionCallbacks = getModuleByIndex(extension.moduleIndex).enable();
    } catch (e) {
        Extension.logError('Failed to evaluate \'enable\' function on extension: ' + extension.uuid, e);
        return false;
    }

    runningExtensions.push(extension.uuid);

    // extensionCallbacks is an object returned by the enable() function defined in extension.js.
    // The extensionCallbacks object should contain functions that can be used by the "callback" key
    // of "button" elements defined in the extension's settings file (settings-schema.json).
    if (extensionCallbacks) {
        extensionObj[extension.uuid] = extensionCallbacks;
        extensionCallbacks._uuid = extension.uuid;
    }

    return true;
}

function get_object_for_uuid(uuid) {
    for (let thisExtensionUUID in extensionObj) {
        if (extensionObj[thisExtensionUUID]._uuid == uuid)
            return extensionObj[thisExtensionUUID];
    }
    return null;
}

function onEnabledExtensionsChanged() {
    enabledExtensions = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);

    unloadRemovedExtensions();
    initEnabledExtensions();
}

function initEnabledExtensions() {
    for (let i = 0; i < enabledExtensions.length; i++) {
        promises.push(Extension.loadExtension(enabledExtensions[i], Extension.Type.EXTENSION))
    }
    return Promise.all(promises).then(function() {
        Main.cinnamonDBusService.EmitXletsLoadedComplete();
        promises = [];
    });
}

function unloadRemovedExtensions() {
    let uuidList = Extension.extensions.filter(function(extension) {
        return extension.lowerType === 'extension';
    });
    for (let i = 0; i < uuidList.length; i++) {
        if (enabledExtensions.indexOf(uuidList[i].uuid) === -1) {
            Extension.unloadExtension(uuidList[i].uuid, Extension.Type.EXTENSION);
        }
    }
}

function init() {
    let startTime = new Date().getTime();
    try {
        extensions = imports.extensions;
    } catch (e) {
        extensions = {};
    }
    extensionMeta = Extension.Type.EXTENSION.legacyMeta;
    ExtensionState = Extension.State;

    enabledExtensions = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);
    return initEnabledExtensions().then(function() {
        global.settings.connect('changed::' + ENABLED_EXTENSIONS_KEY, onEnabledExtensionsChanged);
        global.log(`ExtensionSystem started in ${new Date().getTime() - startTime} ms`);
    });
}
