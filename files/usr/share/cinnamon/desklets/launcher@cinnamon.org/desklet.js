//-*- indent-tabs-mode: nil-*-
const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;

const Desklet = imports.ui.desklet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

const CUSTOM_LAUNCHERS_PATH = GLib.get_home_dir() + '/.cinnamon/panel-launchers/';

const ICON_SIZE = 48;
const ANIM_ICON_SIZE = 40;

function MyDesklet(metadata, desklet_id){
    this._init(metadata, desklet_id);
}

MyDesklet.prototype = {
    __proto__: Desklet.Desklet.prototype,

    _init: function(metadata, desklet_id){
        Desklet.Desklet.prototype._init.call(this, metadata, desklet_id);
        this._launcherSettings = new Gio.Settings({schema_id: 'org.cinnamon.desklets.launcher'});

        this._onSettingsChanged();
        this._removing = false;

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._menu.addAction(_("Add new launcher"), function() {
                                 Util.spawnCommandLine("/usr/share/cinnamon/desklets/launcher@cinnamon.org/editorDialog.py");
                             });
        this._menu.addAction(_("Edit launcher"), Lang.bind(this, function() {
                                                               Util.spawnCommandLine("/usr/share/cinnamon/desklets/launcher@cinnamon.org/editorDialog.py " + this.instance_id);
                                                           }));

        this._settingsSignalId = this._launcherSettings.connect('changed::launcher-list', Lang.bind(this, this._onSettingsChanged));

        this.connect('destroy', Lang.bind(this, this._destroy));
    },

    _getApp: function() {
        let settingsList = this._launcherSettings.get_strv('launcher-list');
        let appSys = Cinnamon.AppSystem.get_default();
        let desktopFile, app;
        for (let i in settingsList) {
            if (settingsList[i].split(":")[0] == this.instance_id){
                desktopFile = settingsList[i].split(":")[1];
                app = appSys.lookup_app(desktopFile);
                if (!app) app = appSys.lookup_settings_app(desktopFile);
                if (!app) app = Gio.DesktopAppInfo.new_from_filename(CUSTOM_LAUNCHERS_PATH + desktopFile);
                return app;
            }
        }

        // No desktop file found; Default to 'cinnamon-settings.desktop'
        return appSys.lookup_app('cinnamon-settings.desktop');
    },

    _getIconActor: function() {
        if (this._app.create_icon_texture) // Test for the existence of the FUNCTION
            return this._app.create_icon_texture(ICON_SIZE);
        else
            return St.TextureCache.get_default().load_gicon(null, this._app.get_icon(), ICON_SIZE);
    },

    on_desklet_clicked: function() {
        this._launch();
    },

    on_desklet_removed: function() {
        this._removing = true;
        let settingsList = this._launcherSettings.get_strv('launcher-list');
        let found = false;
        let i;
        for (i = 0; i < settingsList.length; i++) {
            if (settingsList[i].split(":")[0] == this.instance_id) {
                found = true;
                break;
            }
        }
        if (found) {
            settingsList.splice(i, 1);
            this._launcherSettings.set_strv('launcher-list', settingsList);
        }

        this._launcherSettings.disconnect(this._settingsSignalId);
        this._launcherSettings = null;
    },

    _onSettingsChanged: function() {
        if (!this._removing) {
            this._app = this._getApp();
            this._icon = this._getIconActor();
            this.setContent(this._icon);
            this.setHeader(this._app.get_name());
        }
    },

    _destroy: function() {
        this._app = null;
        this._icon = null;
    },

    _animateIcon: function(step){
        if (step>=3) return;
        Tweener.addTween(this._icon,
                         { width: ANIM_ICON_SIZE * global.ui_scale,
                           height: ANIM_ICON_SIZE * global.ui_scale,
                           time: 0.2,
                           transition: 'easeOutQuad',
                           onComplete: function(){
                               Tweener.addTween(this._icon,
                                                { width: ICON_SIZE * global.ui_scale,
                                                  height: ICON_SIZE * global.ui_scale,
                                                  time: 0.2,
                                                  transition: 'easeOutQuad',
                                                  onComplete: function(){
                                                      this._animateIcon(step+1);
                                                  },
                                                  onCompleteScope: this
                                                });
                           },
                           onCompleteScope: this
                         });
    },

    _launch: function() {
        let allocation = this.content.get_allocation_box();
        this.content.width = allocation.x2 - allocation.x1;
        this.content.height = allocation.y2 - allocation.y1;
        this._animateIcon(0);
        if (this._app.open_new_window)
            this._app.open_new_window(-1);
        else
            this._app.launch([], null);
    }
};

function main(metadata, desklet_id){
    let desklet = new MyDesklet(metadata, desklet_id);
    return desklet;
}