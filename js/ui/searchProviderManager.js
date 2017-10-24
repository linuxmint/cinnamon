// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Extension = imports.ui.extension;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

// Maps uuid -> importer object (extension directory tree)
let extensions;
// Maps uuid -> metadata object
let extensionMeta;
// Maps uuid -> extension state object (returned from init())
const searchProviderObj = {};

// Arrays of uuids
let enabledSearchProviders = [];
let registeredSearchProviders = {};
let idMap = {};

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

    for (let uuid in Extension.Type.SEARCH_PROVIDER.maps.objects) {
        if (enabledSearchProviders.indexOf(uuid) == -1 && registeredSearchProviders.indexOf(uuid) == -1) {
            Extension.unloadExtension(uuid, Extension.Type.SEARCH_PROVIDER);
        }
    }

    for (let i = 0; i < enabledSearchProviders.length; i++) {
        Extension.loadExtension(enabledSearchProviders[i], Extension.Type.SEARCH_PROVIDER);
    }
}

function init() {
    extensions = Extension.Type.SEARCH_PROVIDER.maps.importObjects;
    extensionMeta = Extension.Type.SEARCH_PROVIDER.maps.meta;

    global.settings.connect('changed::' + ENABLED_SEARCH_PROVIDERS_KEY, onEnabledSearchProvidersChanged);

    enabledSearchProviders = global.settings.get_strv(ENABLED_SEARCH_PROVIDERS_KEY);
    for (let i = 0; i < enabledSearchProviders.length; i++){
        Extension.loadExtension(enabledSearchProviders[i], Extension.Type.SEARCH_PROVIDER);
    }
}

function register(id, list) {
    if (id in idMap) {
        // if there are any providers registered to id that are not in the new list, we unregister them now
        for (let i = 0; i < idMap[id].length; i++) {
            let uuid = idMap[id][i];
            if (list.indexOf(uuid) == -1) {
                let index = registeredSearchProviders[uuid].indexOf(id);
                registeredSearchProviders[uuid].splice(index, 1);
                // if nothing else is using it, unload the extension
                if (registeredSearchProviders[uuid].length == 0) {
                    delete registeredSearchProviders[uuid];
                    if (enabledSearchProviders.indexOf(uuid) == -1) {
                        Extension.unloadExtension(uuid, Extension.Type.SEARCH_PROVIDER);
                    }
                }
            }
        }
        
        // restister any items in the list that aren't already registered to id
        for (let i = 0; i < list.length; i++) {
            let uuid = list[i];
            if (idMap[id].indexOf(uuid) == -1) {
                // if the uuid is alread registered, we don't need to load the extension
                if (uuid in registeredSearchProviders) {
                    registeredSearchProviders[uuid].push(id);
                }
                else {
                    registeredSearchProviders[uuid] = [id];
                    // we don't need to load the extension if it's already enabled
                    if (enabledSearchProviders.indexOf(uuid) == -1) {
                        Extension.loadExtension(uuid, Extension.Type.SEARCH_PROVIDER);
                    }
                }
            }
        }
    }
    else {
        for (let i = 0; i < list.length; i++) {
            let uuid = list[i];
            if (uuid in registeredSearchProviders) {
                registeredSearchProviders[uuid].push(id);
            }
            else {
                registeredSearchProviders[uuid] = [id];
                if (enabledSearchProviders.indexOf(uuid) == -1) {
                    Extension.loadExtension(uuid, Extension.Type.SEARCH_PROVIDER);
                }
            }
        }
    }
    idMap[id] = list;
}

function unregister(id) {
    for (let i = 0; i < idMap[id].length; i++) {
        let uuid = idMap[id][i];
        let index = registeredSearchProviders[uuid].indexOf(id);
        registeredSearchProviders[uuid].splice(index, 1);
        if (registeredSearchProviders[uuid].length == 0) {
            delete registeredSearchProviders[uuid];
            Extension.unloadExtension(uuid, Extension.Type.SEARCH_PROVIDER);
        }
    }

    delete idMap[id];
}

function get_object_for_uuid(uuid){
    return searchProviderObj[uuid];
}

function launch(uuid, pattern, callback) {
    try {
        let provider = get_object_for_uuid(uuid);
        provider.uuid = uuid;
        if (provider) {
            let supports_locale, language_names;
            if (extensionMeta[uuid] && extensionMeta[uuid].supported_locales) {
                supports_locale = false;
                language_names = GLib.get_language_names();
                for (var j in language_names){
                    if (extensionMeta[uuid].supported_locales.indexOf(language_names[j]) != -1){
                        supports_locale = true;
                        break;
                    }
                }
            } else {
                supports_locale = true;
            }
            if (supports_locale){
                provider.send_results = Lang.bind(this, function(results, p, cb) {
                    cb(p, results);
                }, provider, callback);
                provider.get_locale_string = Lang.bind(this, function(key, providerData){
                    if (extensionMeta[providerData] && extensionMeta[providerData].locale_data && extensionMeta[providerData].locale_data[key]){
                        language_names = GLib.get_language_names();
                        for (let j in language_names){
                            if (extensionMeta[providerData].locale_data[key][language_names[j]]) {
                                return extensionMeta[providerData].locale_data[key][language_names[j]];
                            }
                        }
                    }
                    return "";
                }, uuid);
                provider.perform_search(pattern);
            }
        }
    } catch(e) {
        global.logError(e);
    }
}

function launch_enabled(pattern, callback){
    for (let i = 0; i < enabledSearchProviders.length; i++) {
        launch(enabledSearchProviders[i], pattern, callback);
    }
}

function launch_from_list(list, pattern, callback) {
    for (let i = 0; i < list.length; i++) {
        launch(list[i], pattern, callback);
    }
}

function launch_from_id(id, pattern, callback) {
    for (let i = 0; i < idMap[id].length; i++) {
        launch(idMap[id][i], pattern, callback);
    }
}
