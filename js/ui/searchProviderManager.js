// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Extension = imports.ui.extension;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

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

    for(let uuid in Extension.Type.SEARCH_PROVIDER.maps.objects) {
        if(enabledSearchProviders.indexOf(uuid) == -1)
            Extension.unloadExtension(uuid, Extension.Type.SEARCH_PROVIDER);
    }
    
    for(let i=0; i<enabledSearchProviders.length; i++) {
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

function get_object_for_uuid(uuid){
    return searchProviderObj[uuid];
}

function launch_all(pattern, callback){
    var provider, supports_locale, language_names;
    for (var i in enabledSearchProviders){
        try{
            provider = get_object_for_uuid(enabledSearchProviders[i]);
            provider.uuid = enabledSearchProviders[i];
            if (provider)
            {
                if (extensionMeta[enabledSearchProviders[i]] && extensionMeta[enabledSearchProviders[i]].supported_locales){
                    supports_locale = false;
                    language_names = GLib.get_language_names();
                    for (var j in language_names){
                        if (extensionMeta[enabledSearchProviders[i]].supported_locales.indexOf(language_names[j]) != -1){
                            supports_locale = true;
                            break;
                        }
                    }
                }else{
                    supports_locale = true;
                }
                if (supports_locale){
                    provider.send_results = Lang.bind(this, function(results, p, cb){
                        cb(p, results);
                    }, provider, callback);
                    provider.get_locale_string = Lang.bind(this, function(key, providerData){
                        if (extensionMeta[providerData] && extensionMeta[providerData].locale_data && extensionMeta[providerData].locale_data[key]){
                            language_names = GLib.get_language_names();
                            for (var j in language_names){
                                if (extensionMeta[providerData].locale_data[key][language_names[j]]){
                                    return extensionMeta[providerData].locale_data[key][language_names[j]];
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
