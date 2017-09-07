// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Extension = imports.ui.extension;
const FileUtils = imports.misc.fileUtils;

// Maps uuid -> importer object (extension directory tree)
let extensions;
// Maps uuid -> metadata object
let extensionMeta;
// Lists extension uuid's that are currently active;
const runningExtensions = {};
// Arrays of uuids
let enabledExtensions;
// Maps extension.uuid -> extension objects
const extensionObj = [];
let promises = [];
const ENABLED_EXTENSIONS_KEY = 'enabled-extensions';

// Deprecated, kept for compatibility reasons
let ExtensionState;

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
        FileUtils.LoadedModules[extension.moduleIndex].module.disable();
    } catch (e) {
        extension.logError('Failed to evaluate \'disable\' function on extension: ' + extension.uuid, e);
    }
    delete runningExtensions[extension.uuid];

    if (extensionObj[extension.uuid])
        delete extensionObj[extension.uuid];
}

// Callback for extension.js
function finishExtensionLoad(extension) {
    if (!extension.lockRole(FileUtils.LoadedModules[extension.moduleIndex].module)) {
        return false;
    }

    try {
        FileUtils.LoadedModules[extension.moduleIndex].module.init(extension.meta);
    } catch (e) {
        extension.logError('Failed to evaluate \'init\' function on extension: ' + extension.uuid, e);
        return false;
    }

    let extensionCallbacks;
    try {
        extensionCallbacks = FileUtils.LoadedModules[extension.moduleIndex].module.enable();
    } catch (e) {
        extension.logError('Failed to evaluate \'enable\' function on extension: ' + extension.uuid, e);
        return false;
    }

    runningExtensions[extension.uuid] = true;

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

    unloadRemovedExtensions().then(initEnabledExtensions);
}

function initEnabledExtensions(callback = null) {
    return new Promise(function(resolve) {
        for (let i = 0; i < enabledExtensions.length; i++) {
            promises.push(Extension.loadExtension(enabledExtensions[i], Extension.Type.EXTENSION))
        }
        Promise.all(promises).then(function() {
            promises = [];
            resolve();
        });
    });
}

function unloadRemovedExtensions() {
    return new Promise(function(resolve) {
        let uuidList = Object.keys(Extension.Type.EXTENSION.maps.objects);
        for (let i = 0; i < uuidList.length; i++) {
            if (enabledExtensions.indexOf(uuidList[i]) === -1) {
                promises.push(Extension.unloadExtension(uuidList[i], Extension.Type.EXTENSION));
            }
        }
        Promise.all(promises).then(function() {
            promises = [];
            resolve();
        });
    });
}

function init() {
    return new Promise(function(resolve) {
        extensions = Extension.Type.EXTENSION.maps.importObjects;
        extensionMeta = Extension.Type.EXTENSION.maps.meta;
        ExtensionState = Extension.State;

        enabledExtensions = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);
        initEnabledExtensions().then(function() {
            global.settings.connect('changed::' + ENABLED_EXTENSIONS_KEY, onEnabledExtensionsChanged);
            resolve();
        });
    });
}
