// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Signals = imports.signals;
const Search = imports.ui.search;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;

const THUMBNAIL_ICON_MARGIN = 2;
const MAX_RECENT_FILES = 20;

function DocInfo(recentInfo) {
    this._init(recentInfo);
}

DocInfo.prototype = {
    _init : function(recentInfo) {
        this.gicon = recentInfo.get_gicon();
        // We actually used get_modified() instead of get_visited()
        // here, as GtkRecentInfo doesn't updated get_visited()
        // correctly. See http://bugzilla.gnome.org/show_bug.cgi?id=567094
        this.timestamp = recentInfo.get_modified();
        this.name = recentInfo.get_display_name();
        this._lowerName = this.name.toLowerCase();
        this.uri = recentInfo.get_uri();
        try {
            this.uriDecoded = decodeURIComponent(this.uri);
        }
        catch (e) {
            this.uriDecoded = this.uri;
            global.logError("Error while decoding URI: " + this.uri);
        }
        this.mimeType = recentInfo.get_mime_type();
        //this.mtime = this._fetch_mtime(); // Expensive
    },

    // _fetch_mtime : function() {
    //     let ret = -1;
    //     if (GLib.str_has_prefix(this.uri, "file://")) {
    //         let file = Gio.file_new_for_uri(this.uri);
    //         let file_info;
    //         try {
    //             file_info = file.query_info(Gio.FILE_ATTRIBUTE_TIME_MODIFIED, Gio.FileQueryInfoFlags.NONE, null);
    //             if (file_info) {
    //                 ret = file_info.get_attribute_uint64(Gio.FILE_ATTRIBUTE_TIME_MODIFIED);
    //             }
    //         } catch (e) {}
    //     }

    //     return ret;
    // },

    createIcon : function(size) {
        return new St.Icon({ gicon: this.gicon, icon_size: size });
    },

    _realLaunch : function() {
        Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
    },

    // _onMountCallback: function (file, result, data) {
    //     try {
    //         this._realLaunch();
    //     } catch (e) {
    //         let q = GLib.quark_from_static_string("g-vfs-error-quark");
    //         if (e.domain == q) {/* gvfs cache invalid - not sure why... retry succeeds */
    //             this._realLaunch();
    //         } else {
    //             Main.notify(_("Problem opening file"),
    //                         _("There was a problem opening the selected file.") +
    //                         _("  Please check to see if you have the proper permissions to access this resource,") +
    //                         _(" or try manually mounting the file's enclosing volume.\n\n") +
    //                         _("The file uri is: " + file.get_uri()));
    //             global.logError("docInfo.js: Failed to mount:  " + file.get_uri());
    //             global.logError("............Error domain is:  " + GLib.quark_to_string(e.domain));
    //             global.logError("............Error code is:    " + e.code);
    //             global.logError("............Error Message is: " + e.message);
    //         }
    //     }
    // },

    launch : function() {
        // if (this.mtime == -1) {
        //     let file = Gio.File.new_for_uri(this.uri);
        //     file.mount_enclosing_volume(0, null, null, Lang.bind(this, this._onMountCallback), null);
        // } else {
            this._realLaunch();
        // }
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
        this._load();
        this._docSystem.connect('changed', Lang.bind(this, this._reload));
    },

    _load: function() {
        let docs = this._docSystem.get_all();
        this._infosByTimestamp = [];
        this._infosByUri = {};

        let valid_count = 0;
        let i = 0; 

        while (i < docs.length && valid_count < MAX_RECENT_FILES) {
            let recentInfo = docs[i];
            let docInfo = new DocInfo(recentInfo);
            this._infosByTimestamp.push(docInfo);
            this._infosByUri[docInfo.uri] = docInfo;
            valid_count++;
            i++;
        }
    },

    _reload: function() {
        this._load();
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
