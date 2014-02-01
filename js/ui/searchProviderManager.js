// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Extension = imports.ui.extension;

// Maps uuid -> importer object (extension directory tree)
var extensions;
// Maps uuid -> metadata object
var extensionMeta;
// Maps uuid -> extension state object (returned from init())
const searchProviderObj = {};
// Arrays of uuids
var enabledSearchProviders;

const ENABLED_SEARCH_PROVIDERS_KEY = 'enabled-search-providers';

// Callback for extension.js
function prepareExtensionUnload(extension) {
    delete searchProviderObj[extension.uuid];
}

// Callback for extension.js
function finishExtensionLoad(extension) {
    searchProviderObj[extension.uuid] = extension.module;
    return true;
}

function onEnabledSearchProvidersChanged() {
    enabledSearchProviders = global.settings.get_strv(ENABLED_SEARCH_PROVIDERS_KEY);

    for(let uuid in Extension.objects) {
        if(Extension.objects[uuid].type == Extension.Type.SEARCH_PROVIDER && enabledSearchProviders.indexOf(uuid) == -1)
            Extension.unloadExtension(uuid);
    }
    
    for(let i=0; i<enabledSearchProviders.length; i++) {
        Extension.loadExtension(enabledSearchProviders[i], Extension.Type.SEARCH_PROVIDER);
    }
}

function init() {
    extensions = imports.ui.extension.importObjects;
    extensionMeta = imports.ui.extension.meta;
    
    global.settings.connect('changed::' + ENABLED_SEARCH_PROVIDERS_KEY, onEnabledSearchProvidersChanged);
    
    enabledSearchProviders = global.settings.get_strv(ENABLED_SEARCH_PROVIDERS_KEY);
    for (let i = 0; i < enabledSearchProviders.length; i++) {
        Extension.loadExtension(enabledSearchProviders[i], Extension.Type.SEARCH_PROVIDER);
    }
}

function get_object_for_uuid(uuid){
    return searchProviderObj[uuid];
}

function launch_all(pattern, callback){
    var provider;
    for (var i in enabledSearchProviders){
        provider = get_object_for_uuid(enabledSearchProviders[i]);
        if (provider)
        {
            provider.send_results = function(results){
                callback(provider, results);
            };
            provider.perform_search(pattern);
        }
    }
}
