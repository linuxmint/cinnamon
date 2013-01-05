//-*- indent-tabs-mode: nil-*-
const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;
const St = imports.gi.St;

const Desklet = imports.ui.desklet;

const Lang = imports.lang;
const Mainloop = imports.mainloop;

function MyDesklet(metadata){
    this._init(metadata);
}

MyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata){
        Desklet.Desklet.prototype._init.call(this, metadata);
        this._launcherSettings = new Gio.Settings({schema: 'org.cinnamon.desklets.launcher'});
        this._id = metadata.id;
        this._app = this._getApp();
        this._icon = this._getIconActor();

        this.setContent(this._icon);
        this.setHeader(this._app.get_name());

        this.actor.connect('button-release-event', Lang.bind(this, this._onClicked));
        this._settingsSignalId = this._launcherSettings.connect('changed::launcher-list', Lang.bind(this, this._onSettingsChanged));

        this.connect('destroy', Lang.bind(this, this._destroy));
    },

    _getApp: function() {
        let settingsList = this._launcherSettings.get_strv('launcher-list');
        let appSys = Cinnamon.AppSystem.get_default();
        let desktopFile, app;
        for (let i in settingsList) {
            if (settingsList[i].indexOf(this._id) == 0){
                desktopFile = settingsList[i].split(":")[1];
                app = appSys.lookup_app(desktopFile);
                if (!app) app = appSys.lookup_settings_app(desktopFile);
                 return app;
            }
        }

        // No desktop file found; Append 'cinnamon-settings.desktop' to list
        settingsList.push(this._id + ':cinnamon-settings.desktop');
        this._launcherSettings.set_strv('launcher-list', settingsList);
        return appSys.lookup_settings_app('cinnamon-settings.desktop');
    },

    _getIconActor: function() {
        return this._app.create_icon_texture(48);
    },

    _onClicked: function(actor, event) {
        let button = event.get_button();
        if (button==1) this.launch();
    },

    _onSettingsChanged: function() {
        this._app = this._getApp();
        this._icon = this._getIconActor();
        this.setContent(this._icon);
        this.setHeader(this._app.get_name());
    },

    _destroy: function() {
        this._app = null;
        this._icon = null;
        this._launcherSettings.disconnect(this._settingsSignalId);
        this._launcherSettings = null;
    },

    launch: function() {
        this._app.open_new_window(-1);
    }
};

function main(metadata){
    let desklet = new MyDesklet(metadata);
    return desklet;
}