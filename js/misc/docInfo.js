// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Signals = imports.signals;
const Search = imports.ui.search;

const THUMBNAIL_ICON_MARGIN = 2;

function DocInfo(recentInfo) {
    this._init(recentInfo);
}

DocInfo.prototype = {
    _init : function(recentInfo) {
        this.recentInfo = recentInfo;
        // We actually used get_modified() instead of get_visited()
        // here, as GtkRecentInfo doesn't updated get_visited()
        // correctly. See http://bugzilla.gnome.org/show_bug.cgi?id=567094
        this.timestamp = recentInfo.get_modified();
        this.name = recentInfo.get_display_name();
        this._lowerName = this.name.toLowerCase();
        this.uri = recentInfo.get_uri();
        this.mimeType = recentInfo.get_mime_type();
    },

    createIcon : function(size) {
        let gicon = this.recentInfo.get_gicon()
        return St.TextureCache.get_default().load_gicon(null, gicon, size);
    },

    launch : function(workspaceIndex) {
        Cinnamon.DocSystem.get_default().open(this.recentInfo, workspaceIndex);
    },

    matchTerms: function(terms) {
        let mtype = Search.MatchType.NONE;
        for (let i = 0; i < terms.length; i++) {
            let term = terms[i];
            let idx = this._lowerName.indexOf(term);
            if (idx == 0) {
                mtype = Search.MatchType.PREFIX;
            } else if (idx > 0) {
                if (mtype == Search.MatchType.NONE)
                    mtype = Search.MatchType.SUBSTRING;
            } else {
                return Search.MatchType.NONE;
            }
        }
        return mtype;
    }
};

var docManagerInstance = null;

function getDocManager() {
    if (docManagerInstance == null)
        docManagerInstance = new DocManager();
    return docManagerInstance;
}

/**
 * DocManager wraps the DocSystem, primarily to expose DocInfo objects.
 */
function DocManager() {
    this._init();
}

DocManager.prototype = {
    _init: function() {
        this._docSystem = Cinnamon.DocSystem.get_default();
        this._infosByTimestamp = [];
        this._infosByUri = {};
        this._docSystem.connect('changed', Lang.bind(this, this._reload));
        this._reload();
    },

    _reload: function() {
        let docs = this._docSystem.get_all();
        this._infosByTimestamp = [];
        this._infosByUri = {};
        for (let i = 0; i < docs.length; i++) {
            let recentInfo = docs[i];

            let docInfo = new DocInfo(recentInfo);
            this._infosByTimestamp.push(docInfo);
            this._infosByUri[docInfo.uri] = docInfo;
        }
        this.emit('changed');
    },

    getTimestampOrderedInfos: function() {
        return this._infosByTimestamp;
    },

    getInfosByUri: function() {
        return this._infosByUri;
    },

    lookupByUri: function(uri) {
        return this._infosByUri[uri];
    },

    queueExistenceCheck: function(count) {
        return this._docSystem.queue_existence_check(count);
    },

    _searchDocs: function(items, terms) {
        let multiplePrefixMatches = [];
        let prefixMatches = [];
        let multipleSubtringMatches = [];
        let substringMatches = [];
        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let mtype = item.matchTerms(terms);
            if (mtype == Search.MatchType.MULTIPLE_PREFIX)
                multiplePrefixMatches.push(item.uri);
            else if (mtype == Search.MatchType.PREFIX)
                prefixMatches.push(item.uri);
            else if (mtype == Search.MatchType.MULTIPLE_SUBSTRING)
                multipleSubtringMatches.push(item.uri);
            else if (mtype == Search.MatchType.SUBSTRING)
                substringMatches.push(item.uri);
         }
        return multiplePrefixMatches.concat(prefixMatches.concat(multipleSubtringMatches.concat(substringMatches)));
    },

    initialSearch: function(terms) {
        return this._searchDocs(this._infosByTimestamp, terms);
    },

    subsearch: function(previousResults, terms) {
        return this._searchDocs(previousResults.map(Lang.bind(this,
            function(url) {
                return this._infosByUri[url];
            })), terms);
    }
};

Signals.addSignalMethods(DocManager.prototype);
