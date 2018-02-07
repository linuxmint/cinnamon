// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Extension = imports.ui.extension;
const {getModuleByIndex} = imports.misc.fileUtils;
const GLib = imports.gi.GLib;

// Maps uuid -> importer object (extension directory tree)
var extensions;
// Kept for compatibility
var extensionMeta;
// Maps uuid -> extension state object (returned from init())
var searchProviderObj = {};
// Arrays of uuids
var enabledSearchProviders;
var promises = [];
var ENABLED_SEARCH_PROVIDERS_KEY = 'enabled-search-providers';

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

    unloadRemovedSearchProviders();
    initEnabledSearchProviders();
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
    let extensions = Extension.extensions.filter(function(extension) {
        return extension.lowerType === 'search_provider';
    });
    for (let i = 0; i < extensions.length; i++) {
        if (enabledSearchProviders.indexOf(extensions[i].uuid) === -1) {
            Extension.unloadExtension(extensions[i].uuid, Extension.Type.SEARCH_PROVIDER);
        }
    }
}

function init() {
    let startTime = new Date().getTime();
    try {
        extensions = imports.search_providers;
    } catch (e) {
        extensions = {};
    }
    extensionMeta = Extension.Type.SEARCH_PROVIDER.legacyMeta;

    enabledSearchProviders = global.settings.get_strv(ENABLED_SEARCH_PROVIDERS_KEY);

    return initEnabledSearchProviders().then(function() {
        global.settings.connect('changed::' + ENABLED_SEARCH_PROVIDERS_KEY, onEnabledSearchProvidersChanged);
        global.log(`SearchProviderManager started in ${new Date().getTime() - startTime} ms`);
    });
}

function get_object_for_uuid(uuid){
    return searchProviderObj[uuid];
}

function checkLocaleSupport(meta, language_names) {
    for (let i = 0; i < language_names.length; i++) {
        if (!meta.supported_locales
            || meta.supported_locales.indexOf(language_names[i]) > -1) {
            return true;
        }
    }
    return false;
}

function override_send_results(provider, callback) {
    return function send_results(results) {
        callback(provider, results);
    };
}

function override_get_locale_string(meta, language_names) {
    return function get_locale_string(key) {
        if (meta && meta.locale_data && meta.locale_data[key]) {
            for (let i = 0; i < language_names.length; i++) {
                if (meta.locale_data[key][language_names[i]]){
                    return meta.locale_data[key][language_names[i]];
                }
            }
        }
        return "";
    };
}

function launch_all(pattern, callback){
    let provider;
    let language_names = GLib.get_language_names();
    for (let i = 0; i < enabledSearchProviders.length; i++) {
        let extension = Extension.getExtension(enabledSearchProviders[i]);
        if (!extension || !extension.meta) {
            continue;
        }

        if (!checkLocaleSupport(extension.meta, language_names)) {
            global.logError('[' + enabledSearchProviders[i] + '] No locale support found for '
                + language_names.join(', '))
            continue;
        }

        try {
            provider = get_object_for_uuid(enabledSearchProviders[i]);
            provider.uuid = enabledSearchProviders[i];
            provider.send_results = override_send_results(provider, callback);
            provider.get_locale_string = override_get_locale_string(extension.meta, language_names);
            provider.perform_search(pattern);
        } catch (e) {
            global.logError(e);
        }
    }
}
