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
    },

    createIcon : function(size) {
        return new St.Icon({ gicon: this.gicon, icon_size: size });
    },

    launch : function() {
        Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
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
        this._load();
        this._docSystem.connect('changed', Lang.bind(this, this._reload));
    },

    _load: function() {
        let docs = this._docSystem.get_all();
        this._infosByTimestamp = [];
        let i = 0;
        while (i < docs.length) {
            let recentInfo = docs[i];
            let docInfo = new DocInfo(recentInfo);
            this._infosByTimestamp.push(docInfo);
            i++;
        }
    },

    _reload: function() {
        this._load();
        this.emit('changed');
    }
};

Signals.addSignalMethods(DocManager.prototype);
