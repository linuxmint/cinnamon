// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Extension = imports.ui.extension;
const {getModuleByIndex} = imports.misc.fileUtils;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

// Maps uuid -> importer object (extension directory tree)
var extensions;
// Maps uuid -> extension state object (returned from init())
const searchProviderObj = {};
// Arrays of uuids
var enabledSearchProviders;
let promises = [];
const ENABLED_SEARCH_PROVIDERS_KEY = 'enabled-search-providers';

// Callback for extension.js
function prepareExtensionUnload(extension) {
    delete searchProviderObj[extension.uuid];
}

// Callback for extension.js
function finishExtensionLoad(extensionIndex) {
    let extension = Extension.extensions[extensionIndex];
    searchProviderObj[extension.uuid] = getModuleByIndex(extension.moduleIndex);
    return true;
}

function onEnabledSearchProvidersChanged() {
    enabledSearchProviders = global.settings.get_strv(ENABLED_SEARCH_PROVIDERS_KEY);

    unloadRemovedSearchProviders().then(initEnabledSearchProviders);
}

function initEnabledSearchProviders() {
    for (let i = 0; i < enabledSearchProviders.length; i++) {
        promises.push(Extension.loadExtension(enabledSearchProviders[i], Extension.Type.SEARCH_PROVIDER))
    }
    return Promise.all(promises).then(function() {
        promises = [];
    });
}

function unloadRemovedSearchProviders() {
    let uuidList = Extension.extensions.filter(function(extension) {
        return extension.lowerType === 'search_provider';
    });
    for (let i = 0; i < enabledSearchProviders.length; i++) {
        if (enabledSearchProviders.indexOf(uuidList[i].uuid) === -1) {
            promises.push(Extension.unloadExtension(uuidList[i].uuid, Extension.Type.SEARCH_PROVIDER));
        }
    }
    return Promise.all(promises).then(function() {
        promises = [];
    });
}

function init() {
    extensions = imports.search_providers;

    enabledSearchProviders = global.settings.get_strv(ENABLED_SEARCH_PROVIDERS_KEY);

    return initEnabledSearchProviders().then(function() {
        global.settings.connect('changed::' + ENABLED_SEARCH_PROVIDERS_KEY, onEnabledSearchProvidersChanged);
    });
}

function get_object_for_uuid(uuid){
    return searchProviderObj[uuid];
}

function launch_all(pattern, callback){
    let provider, supports_locale, language_names;
    for (let i in enabledSearchProviders){
        let extension = Extension.getExtension(enabledSearchProviders[i]);
        try {
            provider = get_object_for_uuid(enabledSearchProviders[i]);
            provider.uuid = enabledSearchProviders[i];
            if (provider) {
                if (extension && extension.meta.supported_locales){
                    supports_locale = false;
                    language_names = GLib.get_language_names();
                    for (let j in language_names){
                        if (extension.meta[enabledSearchProviders[i]].supported_locales.indexOf(language_names[j]) != -1){
                            supports_locale = true;
                            break;
                        }
                    }
                } else {
                    supports_locale = true;
                }
                if (supports_locale){
                    provider.send_results = Lang.bind(this, function(results, p, cb){
                        cb(p, results);
                    }, provider, callback);
                    provider.get_locale_string = Lang.bind(this, function(key, providerData){
                        if (extension.meta[providerData] && extension.meta[providerData].locale_data && extension.meta[providerData].locale_data[key]){
                            language_names = GLib.get_language_names();
                            for (let j in language_names){
                                if (extension.meta[providerData].locale_data[key][language_names[j]]){
                                    return extension.meta[providerData].locale_data[key][language_names[j]];
                                }
                            }
                        }
                        return "";
                    }, enabledSearchProviders[i]);
                    provider.perform_search(pattern);
                }
            }
        }
        catch(e)
        {
            global.logError(e);
        }
    }
}
