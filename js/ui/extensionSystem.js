// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Extension = imports.ui.extension;

// Maps uuid -> importer object (extension directory tree)
var extensions;
// Maps uuid -> metadata object
var extensionMeta;
// Maps uuid -> extension state object (returned from init())
const extensionStateObjs = {};
// Arrays of uuids
var enabledExtensions;

const ENABLED_EXTENSIONS_KEY = 'enabled-extensions';

// Deprecated, kept for compatibility reasons
var ExtensionState;

// Deprecated, kept for compatibility reasons
function disableExtension(uuid) {
    Extension.unloadExtension(uuid);
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
    delete extensionStateObjs[extension.uuid];
}

// Callback for extension.js
function finishExtensionLoad(extension) {
    if(!extension.lockRole(extension.module)) {
        return false;
    }
    
    let stateObj;
    try {
        stateObj = extension.module.init(extension.meta);
    } catch (e) {
        extension.logError('Failed to evaluate \'init\' function on extension: ' + extension.uuid, e);
        return false;
    }
    try {
        extension.module.enable();
    } catch (e) {
        extension.logError('Failed to evaluate \'enable\' function on extension: ' + extension.uuid, e);
        return false;
    }
    
    extensionStateObjs[extension.uuid] = stateObj;

    return true;
}

function onEnabledExtensionsChanged() {
    enabledExtensions = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);

    for(let uuid in Extension.objects) {
        if(Extension.objects[uuid].type == Extension.Type.EXTENSION && enabledExtensions.indexOf(uuid) == -1)
            Extension.unloadExtension(uuid);
    }
    
    for(let i=0; i<enabledExtensions.length; i++) {
        Extension.loadExtension(enabledExtensions[i], Extension.Type.EXTENSION);
    }
}

function init() {
    extensions = imports.ui.extension.importObjects;
    extensionMeta = imports.ui.extension.meta;
    ExtensionState = Extension.State;
    
    global.settings.connect('changed::' + ENABLED_EXTENSIONS_KEY, onEnabledExtensionsChanged);
    
    enabledExtensions = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);
    for (let i = 0; i < enabledExtensions.length; i++) {
        Extension.loadExtension(enabledExtensions[i], Extension.Type.EXTENSION);
    }
}
