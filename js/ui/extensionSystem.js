// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Extension = imports.ui.extension;

// Maps uuid -> importer object (extension directory tree)
var extensions;
// Maps uuid -> metadata object
var extensionMeta;
// Lists extension uuid's that are currently active;
const runningExtensions = {};
// Arrays of uuids
var enabledExtensions;
// Maps extension.uuid -> extension objects
const extensionObj = [];

const ENABLED_EXTENSIONS_KEY = 'enabled-extensions';

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
        extension.module.disable();
    } catch (e) {
        extension.logError('Failed to evaluate \'disable\' function on extension: ' + extension.uuid, e);
    }
    delete runningExtensions[extension.uuid];

    if (extensionObj[extension.uuid])
        delete extensionObj[extension.uuid];
}

// Callback for extension.js
function finishExtensionLoad(extension) {
    if (!extension.lockRole(extension.module)) {
        return false;
    }

    try {
        extension.module.init(extension.meta);
    } catch (e) {
        extension.logError('Failed to evaluate \'init\' function on extension: ' + extension.uuid, e);
        return false;
    }

    let extensionCallbacks;
    try {
        extensionCallbacks = extension.module.enable();
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
        return null;
    }
}

function onEnabledExtensionsChanged() {
    enabledExtensions = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);

    for (let uuid in Extension.Type.EXTENSION.maps.objects) {
        if (enabledExtensions.indexOf(uuid) == -1)
            Extension.unloadExtension(uuid, Extension.Type.EXTENSION);
    }

    for (let i = 0; i < enabledExtensions.length; i++) {
        Extension.loadExtension(enabledExtensions[i], Extension.Type.EXTENSION);
    }
}

function init() {
    extensions = Extension.Type.EXTENSION.maps.importObjects;
    extensionMeta = Extension.Type.EXTENSION.maps.meta;
    ExtensionState = Extension.State;

    global.settings.connect('changed::' + ENABLED_EXTENSIONS_KEY, onEnabledExtensionsChanged);

    enabledExtensions = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);
    for (let i = 0; i < enabledExtensions.length; i++) {
        Extension.loadExtension(enabledExtensions[i], Extension.Type.EXTENSION);
    }
}
