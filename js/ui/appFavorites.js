// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Shell = imports.gi.Shell;
const Lang = imports.lang;
const Signals = imports.signals;

const Main = imports.ui.main;

function AppFavorites() {
    this._init();
}

AppFavorites.prototype = {
    FAVORITE_APPS_KEY: 'favorite-apps',

    _init: function() {
        this._favorites = {};
        global.settings.connect('changed::' + this.FAVORITE_APPS_KEY, Lang.bind(this, this._onFavsChanged));
        this._reload();
    },

    _onFavsChanged: function() {
        this._reload();
        this.emit('changed');
    },

    _reload: function() {
        let ids = global.settings.get_strv(this.FAVORITE_APPS_KEY);
        let appSys = Shell.AppSystem.get_default();
        let apps = ids.map(function (id) {
                return appSys.lookup_app(id);
            }).filter(function (app) {
                return app != null;
            });
        this._favorites = {};
        for (let i = 0; i < apps.length; i++) {
            let app = apps[i];
            this._favorites[app.get_id()] = app;
        }
    },

    _getIds: function() {
        let ret = [];
        for (let id in this._favorites)
            ret.push(id);
        return ret;
    },

    getFavoriteMap: function() {
        return this._favorites;
    },

    getFavorites: function() {
        let ret = [];
        for (let id in this._favorites)
            ret.push(this._favorites[id]);
        return ret;
    },

    isFavorite: function(appId) {
        return appId in this._favorites;
    },

    _addFavorite: function(appId, pos) {
        if (appId in this._favorites)
            return false;

        let app = Shell.AppSystem.get_default().lookup_app(appId);

        if (!app)
            return false;

        let ids = this._getIds();
        if (pos == -1)
            ids.push(appId);
        else
            ids.splice(pos, 0, appId);
        global.settings.set_strv(this.FAVORITE_APPS_KEY, ids);
        this._favorites[appId] = app;
        return true;
    },

    addFavoriteAtPos: function(appId, pos) {
        if (!this._addFavorite(appId, pos))
            return;

        let app = Shell.AppSystem.get_default().lookup_app(appId);

        Main.overview.setMessage(_("%s has been added to your favorites.").format(app.get_name()), Lang.bind(this, function () {
            this._removeFavorite(appId);
        }));
    },

    addFavorite: function(appId) {
        this.addFavoriteAtPos(appId, -1);
    },

    moveFavoriteToPos: function(appId, pos) {
        this._removeFavorite(appId);
        this._addFavorite(appId, pos);
    },

    _removeFavorite: function(appId) {
        if (!appId in this._favorites)
            return false;

        let ids = this._getIds().filter(function (id) { return id != appId; });
        global.settings.set_strv(this.FAVORITE_APPS_KEY, ids);
        return true;
    },

    removeFavorite: function(appId) {
        let ids = this._getIds();
        let pos = ids.indexOf(appId);

        let app = this._favorites[appId];
        if (!this._removeFavorite(appId))
            return;

        Main.overview.setMessage(_("%s has been removed from your favorites.").format(app.get_name()),
                                 Lang.bind(this, function () {
            this._addFavorite(appId, pos);
        }));
    }
};
Signals.addSignalMethods(AppFavorites.prototype);

var appFavoritesInstance = null;
function getAppFavorites() {
    if (appFavoritesInstance == null)
        appFavoritesInstance = new AppFavorites();
    return appFavoritesInstance;
}
