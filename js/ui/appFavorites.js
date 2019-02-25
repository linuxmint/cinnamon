// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Signals = imports.signals;

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
        let appSys = Cinnamon.AppSystem.get_default();
        this._favorites = ids.reduce((favorites, id) => {
            const app = appSys.lookup_app(id);
            if (app) {
                favorites[app.get_id()] = app;
            }

            return favorites;
        }, {});
    },

    _getIds: function() {
        return Object.keys(this._favorites);
    },

    getFavoriteMap: function() {
        return this._favorites;
    },

    getFavorites: function() {
        return Object.values(this._favorites);
    },

    isFavorite: function(appId) {
        return appId in this._favorites;
    },

    _addFavorite: function(appId, pos) {
        if (appId in this._favorites)
            return false;

        let appSys = Cinnamon.AppSystem.get_default();
        let app = appSys.lookup_app(appId);

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
        this._addFavorite(appId, pos);                            
    },

    addFavorite: function(appId) {
        this.addFavoriteAtPos(appId, -1);
    },

    moveFavoriteToPos: function(appId, pos) {
        this._removeFavorite(appId);
        this._addFavorite(appId, pos);
    },

    _removeFavorite: function(appId) {
        if (!(appId in this._favorites))
            return false;

        let ids = this._getIds().filter(function (id) { return id != appId; });
        global.settings.set_strv(this.FAVORITE_APPS_KEY, ids);
        return true;
    },

    removeFavorite: function(appId) {
        let app = this._favorites[appId];
        this._removeFavorite(appId);                    
    }
};
Signals.addSignalMethods(AppFavorites.prototype);

var appFavoritesInstance = null;
function getAppFavorites() {
    if (appFavoritesInstance == null)
        appFavoritesInstance = new AppFavorites();
    return appFavoritesInstance;
}
