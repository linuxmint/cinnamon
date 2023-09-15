// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Signals = imports.signals;
const Cinnamon = imports.gi.Cinnamon;
const Util = imports.misc.util;

const FileUtils = imports.misc.fileUtils;
const Main = imports.ui.main;

const DISABLED_OPEN_SEARCH_PROVIDERS_KEY = 'disabled-open-search-providers';

// Not currently referenced by the search API, but
// this enumeration can be useful for provider
// implementations.
const MatchType = {
    NONE: 0,
    SUBSTRING: 1,
    MULTIPLE_SUBSTRING: 2,
    PREFIX: 3,
    MULTIPLE_PREFIX: 4
};

function SearchResultDisplay(provider) {
    this._init(provider);
}

SearchResultDisplay.prototype = {
    _init: function(provider) {
        this.provider = provider;
        this.actor = null;
        this.selectionIndex = -1;
    },

    /**
     * renderResults:
     * @results: List of identifier strings
     * @terms: List of search term strings
     *
     * Display the given search matches which resulted
     * from the given terms.  It's expected that not
     * all results will fit in the space for the container
     * actor; in this case, show as many as makes sense
     * for your result type.
     *
     * The terms are useful for search match highlighting.
     */
    renderResults: function(results, terms) {
        throw new Error('Not implemented');
    },

    /**
     * clear:
     * Remove all results from this display and reset the selection index.
     */
    clear: function() {
        this.actor.destroy_all_children();
        this.selectionIndex = -1;
    },

    /**
     * getSelectionIndex:
     *
     * Returns the index of the selected actor, or -1 if none.
     */
    getSelectionIndex: function() {
        return this.selectionIndex;
    },

    /**
     * getVisibleResultCount:
     *
     * Returns: The number of actors visible.
     */
    getVisibleResultCount: function() {
        throw new Error('Not implemented');
    },

    /**
     * selectIndex:
     * @index: Integer index
     *
     * Move selection to the given index.
     * Return true if successful, false if no more results
     * available.
     */
    selectIndex: function() {
        throw new Error('Not implemented');
    },

    /**
     * Activate the currently selected search result.
     */
    activateSelected: function() {
        throw new Error('Not implemented');
    }
};

/**
 * SearchProvider:
 *
 * Subclass this object to add a new result type
 * to the search system, then call registerProvider()
 * in SearchSystem with an instance.
 */
function SearchProvider(title) {
    this._init(title);
}

SearchProvider.prototype = {
    _init: function(title) {
        this.title = title;
        this.searchSystem = null;
        this.searchAsync  = false;
    },

    _asyncCancelled: function() {
    },

    startAsync: function() {
        this.searchAsync = true;
    },

    tryCancelAsync: function() {
        if (!this.searchAsync)
            return;
        this._asyncCancelled();
        this.searchAsync = false;
    },

    /**
     * addItems:
     * @items: an array of result identifier strings representing
     * items which match the last given search terms.
     *
     * This should be used for something that requires a bit more
     * logic; it's designed to be an asynchronous way to add a result
     * to the current search.
     */
    addItems: function(items) {
        if (!this.searchSystem)
            throw new Error('Search provider not registered');

        if (!items.length)
            return;

        this.tryCancelAsync();

        this.searchSystem.addProviderItems(this, items);
    },

    /**
     * getInitialResultSet:
     * @terms: Array of search terms, treated as logical AND
     *
     * Called when the user first begins a search (most likely
     * therefore a single term of length one or two), or when
     * a new term is added.
     *
     * Should return an array of result identifier strings representing
     * items which match the given search terms.  This
     * is expected to be a substring match on the metadata for a given
     * item.  Ordering of returned results is up to the discretion of the provider,
     * but you should follow these heruistics:
     *
     *  * Put items where the term matches multiple criteria (e.g. name and
     *    description) before single matches
     *  * Put items which match on a prefix before non-prefix substring matches
     *
     * This function should be fast; do not perform unindexed full-text searches
     * or network queries.
     */
    getInitialResultSet: function(terms) {
        throw new Error('Not implemented');
    },

    /**
     * getSubsearchResultSet:
     * @previousResults: Array of item identifiers
     * @newTerms: Updated search terms
     *
     * Called when a search is performed which is a "subsearch" of
     * the previous search; i.e. when every search term has exactly
     * one corresponding term in the previous search which is a prefix
     * of the new term.
     *
     * This allows search providers to only search through the previous
     * result set, rather than possibly performing a full re-query.
     */
    getSubsearchResultSet: function(previousResults, newTerms) {
        throw new Error('Not implemented');
    },

    /**
     * getResultMeta:
     * @id: Result identifier string
     *
     * Return an object with 'id', 'name', (both strings) and 'createIcon'
     * (function(size) returning a Clutter.Texture) properties which describe
     * the given search result.
     */
    getResultMeta: function(id) {
        throw new Error('Not implemented');
    },

    /**
     * createResultContainer:
     *
     * Search providers may optionally override this to render their
     * results in a custom fashion.  The default implementation
     * will create a vertical list.
     *
     * Returns: An instance of SearchResultDisplay.
     */
    createResultContainerActor: function() {
        return null;
    },

    /**
     * createResultActor:
     * @resultMeta: Object with result metadata
     * @terms: Array of search terms, should be used for highlighting
     *
     * Search providers may optionally override this to render a
     * particular search result in a custom fashion.  The default
     * implementation will show the icon next to the name.
     *
     * The actor should be an instance of St.Widget, with the style class
     * 'search-result-content'.
     */
    createResultActor: function(resultMeta, terms) {
        return null;
    },

    /**
     * activateResult:
     * @id: Result identifier string
     *
     * Called when the user chooses a given result.
     */
    activateResult: function(id) {
        throw new Error('Not implemented');
    }
};
Signals.addSignalMethods(SearchProvider.prototype);

function OpenSearchSystem() {
    this._init();
}

OpenSearchSystem.prototype = {
    _init: function() {
        this._providers = [];
        global.settings.connect('changed::' + DISABLED_OPEN_SEARCH_PROVIDERS_KEY, Lang.bind(this, this._refresh));
        this._refresh();
    },

    getProviders: function() {
        let res = [];
        for (let i = 0; i < this._providers.length; i++)
            res.push({ id: i, name: this._providers[i].name });

        return res;
    },

    setSearchTerms: function(terms) {
        this._terms = terms;
    },

    _checkSupportedProviderLanguage: function(provider) {
        if (!provider.url.includes('{language}'))
            return true;

        let langs = GLib.get_language_names();

        langs.push('en');
        provider.lang = null;
        for (let i = 0; i < langs.length; i++) {
            if (provider.langs.includes(langs[i])) {
                provider.lang = langs[i];
                return true;
            }
        }

        return false;
    },

    activateResult: function(id, params) {
        let searchTerms = this._terms.join(' ');

        let url = this._providers[id].url.replace(/{searchTerms}/g, encodeURIComponent(searchTerms));
        url = url.replace(/{language}/g, this._providers[id].lang);

        try {
            Gio.app_info_launch_default_for_uri(url, global.create_app_launch_context());
        } catch (e) {
            // TODO: remove this after glib will be removed from moduleset
            // In the default build gio is in our prefix but gvfs is not
            Util.spawn(['gio', 'open', url])
        }

        Main.overview.hide();
    },

    _addProvider: function(fileName) {
        let path = global.datadir + '/search_providers/' + fileName;
        let source = Cinnamon.get_file_contents_utf8_sync(path);
        let [success, name, url, langs, icon_uri] = Cinnamon.parse_search_provider(source);
        let provider ={ name: name,
                        url: url,
                        id: this._providers.length,
                        icon_uri: icon_uri,
                        langs: langs };
        if (this._checkSupportedProviderLanguage(provider)) {
            this._providers.push(provider);
            this.emit('changed');
        }
    },

    _refresh: function() {
        this._providers = [];
        let names = global.settings.get_strv(DISABLED_OPEN_SEARCH_PROVIDERS_KEY);
        let file = Gio.file_new_for_path(global.datadir + '/search_providers');
        FileUtils.listDirAsync(file, Lang.bind(this, function(files) {
            for (let i = 0; i < files.length; i++) {
                let name = files[i].get_name();
                if (!names.includes(name)) {
                    this._addProvider(name);
                }
            }
        }));
    }
}
Signals.addSignalMethods(OpenSearchSystem.prototype);

function SearchSystem() {
    this._init();
}

SearchSystem.prototype = {
    _init: function() {
        this._providers = [];
        this.reset();
    },

    registerProvider: function (provider) {
        provider.searchSystem = this;
        this._providers.push(provider);
    },

    unregisterProvider: function (provider) {
        let index = this._providers.indexOf(provider);
        if (index == -1)
            return;
        provider.searchSystem = null;
        this._providers.splice(index, 1);
    },

    getProviders: function() {
        return this._providers;
    },

    getTerms: function() {
        return this._previousTerms;
    },

    reset: function() {
        this._previousTerms = [];
        this._previousResults = [];
    },

    addProviderItems: function(provider, items) {
        this.emit('search-updated', provider, items);
    },

    updateSearch: function(searchString) {
        searchString = searchString.trim();
        if (searchString == '')
            return;

        let terms = searchString.split(/\s+/);
        this.updateSearchResults(terms);
    },

    updateSearchResults: function(terms) {
        if (!terms)
            return;

        let isSubSearch = terms.length == this._previousTerms.length;
        if (isSubSearch) {
            for (let i = 0; i < terms.length; i++) {
                if (terms[i].indexOf(this._previousTerms[i]) != 0) {
                    isSubSearch = false;
                    break;
                }
            }
        }

        let results = [];
        if (isSubSearch) {
            for (let i = 0; i < this._providers.length; i++) {
                let [provider, previousResults] = this._previousResults[i];
                provider.tryCancelAsync();
                try {
                    let providerResults = provider.getSubsearchResultSet(previousResults, terms);
                    results.push([provider, providerResults]);
                } catch (error) {
                    global.logError('A ' + error.name + ' has occurred in ' + provider.title, error);
                }
            }
        } else {
            for (let i = 0; i < this._providers.length; i++) {
                let provider = this._providers[i];
                provider.tryCancelAsync();
                try {
                    let providerResults = provider.getInitialResultSet(terms);
                    results.push([provider, providerResults]);
                } catch (error) {
                    global.logError('A ' + error.name + ' has occurred in ' + provider.title, error);
                }
            }
        }

        this._previousTerms = terms;
        this._previousResults = results;
        this.emit('search-completed', results);
    },
};
Signals.addSignalMethods(SearchSystem.prototype);
