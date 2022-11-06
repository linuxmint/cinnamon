"use strict";
// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/**
* DOCINFO
*
* DocInfo is a JS layer on top of Cinnamon's DocSystem (which is written in C).
*
* The advantages of using DocInfo (rather than Gtk.RecentManager) are:
*
*  - Results are limited to 20 (with RecentManager you can get a huge number of results)
*  - Results are sorted by timestamp (they're not sorted by RecentManager)
*  - Sorting and clamping of the results is done in C and only the 20 most recent results are stored in memory
*  - The "changed" signal sent by DocSystem is delayed via idle_timeout, so your applet doesn't rebuild immediately when Gtk.RecentManager sends its signal (which could potentially reduce the speed at which apps are launched)
*  - DocInfo provides decoded URIs and the ability to quickly create the icon so your applet doesn't need to do that itself.
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocManager = exports.getDocManager = exports.DocInfo = void 0;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Signals = imports.signals;
const Gio = imports.gi.Gio;
class DocInfo {
    constructor(recentInfo) {
        this.gicon = recentInfo.get_gicon();
        this.name = recentInfo.get_display_name();
        this.uri = recentInfo.get_uri();
        try {
            this.uriDecoded = decodeURIComponent(this.uri);
        }
        catch (e) {
            this.uriDecoded = this.uri;
            global.logError("Error while decoding URI: " + this.uri);
        }
        this.mimeType = recentInfo.get_mime_type();
    }
    createIcon(size) {
        return new St.Icon({ gicon: this.gicon, icon_size: size });
    }
}
exports.DocInfo = DocInfo;
var docManagerInstance = null;
function getDocManager() {
    if (docManagerInstance == null)
        docManagerInstance = new DocManager();
    return docManagerInstance;
}
exports.getDocManager = getDocManager;
/**
 * DocManager wraps the DocSystem, primarily to expose DocInfo objects.
 */
class DocManager {
    constructor() {
        this._docSystem = Cinnamon.DocSystem.get_default();
        this._infosByTimestamp = [];
        this._load();
        this._docSystem.connect('changed', Lang.bind(this, this._reload));
    }
    _load() {
        let docs = this._docSystem.get_all();
        this._infosByTimestamp = [];
        let i = 0;
        while (i < docs.length) {
            let recentInfo = docs[i];
            let docInfo = new DocInfo(recentInfo);
            this._infosByTimestamp.push(docInfo);
            i++;
        }
    }
    _reload() {
        this._load();
        this.emit('changed');
    }
}
exports.DocManager = DocManager;
Signals.addSignalMethods(DocManager.prototype);
