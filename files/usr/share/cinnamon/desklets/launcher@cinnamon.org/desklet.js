//-*- indent-tabs-mode: nil-*-
const Cinnamon = imports.gi.Cinnamon;
const CMenu = imports.gi.CMenu;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const St = imports.gi.St;
const Tweener = imports.ui.tweener;

const Desklet = imports.ui.desklet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

const CUSTOM_LAUNCHERS_PATH = GLib.get_user_data_dir() + "/cinnamon/panel-launchers/";
const OLD_CUSTOM_LAUNCHERS_PATH = GLib.get_home_dir() + '/.cinnamon/panel-launchers/';

const ICON_SIZE = 48;
const ANIM_ICON_SIZE = 40;

class CinnamonLauncherDesklet extends Desklet.Desklet {
    constructor(metadata, desklet_id) {
        super(metadata, desklet_id);
        this._launcherSettings = new Gio.Settings({schema_id: 'org.cinnamon.desklets.launcher'});

        this._onSettingsChanged();
        this._removing = false;

        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._menu.addAction(
            _('Edit launcher'),
            Lang.bind(this, function() {
                Util.spawnCommandLine('/usr/share/cinnamon/desklets/launcher@cinnamon.org/editorDialog.py ' + this.instance_id);
            })
        );

        this._settingsSignalId = this._launcherSettings.connect('changed::launcher-list', Lang.bind(this, this._onSettingsChanged));

        this.connect('destroy', Lang.bind(this, this._destroy));
    }

    _getApp() {
        let settingsList = this._launcherSettings.get_strv('launcher-list');
        let appSys = Cinnamon.AppSystem.get_default();
        let desktopFile, app;
        for (let i in settingsList) {
            if (settingsList[i].split(':')[0] == this.instance_id) {
                desktopFile = settingsList[i].split(':')[1];
                app = appSys.lookup_app(desktopFile);
                if (!app) {
                    app = CMenu.DesktopAppInfo.new_from_filename(CUSTOM_LAUNCHERS_PATH + desktopFile);
                }
                // Fallback to old launcher folder
                if (!app) {
                    app = CMenu.DesktopAppInfo.new_from_filename(OLD_CUSTOM_LAUNCHERS_PATH + desktopFile);
                }
                return app;
            }
        }

        // No desktop file found; Default to 'cinnamon-settings.desktop'
        return appSys.lookup_app('cinnamon-settings.desktop');
    }

    _getIconActor() {
        if (this._app.create_icon_texture) {
            // Test for the existence of the FUNCTION
            return this._app.create_icon_texture(ICON_SIZE);
        } else {
            return St.TextureCache.get_default().load_gicon(null, this._app.get_icon(), ICON_SIZE);
        }
    }

    on_desklet_clicked() {
        this._launch();
    }

    on_desklet_removed() {
        this._removing = true;
        let settingsList = this._launcherSettings.get_strv('launcher-list');
        let found = false;
        let i;
        for (i = 0; i < settingsList.length; i++) {
            if (settingsList[i].split(':')[0] == this.instance_id) {
                found = true;
                break;
            }
        }
        if (found) {
            let item = settingsList.splice(i, 1);
            this._launcherSettings.set_strv('launcher-list', settingsList);

            // We try to remove custom launchers if they exist
            let fileName = item[0].split(':')[1];
            let file = Gio.file_new_for_path(CUSTOM_LAUNCHERS_PATH + fileName);
            if (file.query_exists(null)) file.delete(null);
            let old_file = Gio.file_new_for_path(OLD_CUSTOM_LAUNCHERS_PATH + fileName);
            if (old_file.query_exists(null)) old_file.delete(null);
        }

        this._launcherSettings.disconnect(this._settingsSignalId);
        this._launcherSettings = null;
    }

    _onSettingsChanged() {
        if (!this._removing) {
            this._app = this._getApp();
            this._icon = this._getIconActor();
            this.setContent(this._icon);
            this.setHeader(this._app.get_name());
        }
    }

    _destroy() {
        this._app = null;
        this._icon = null;
    }

    _animateIcon(step) {
        if (step >= 3) return;
        Tweener.addTween(this._icon, {
            width: ANIM_ICON_SIZE * global.ui_scale,
            height: ANIM_ICON_SIZE * global.ui_scale,
            time: 0.2,
            transition: 'easeOutQuad',
            onComplete() {
                Tweener.addTween(this._icon, {
                    width: ICON_SIZE * global.ui_scale,
                    height: ICON_SIZE * global.ui_scale,
                    time: 0.2,
                    transition: 'easeOutQuad',
                    onComplete() {
                        this._animateIcon(step + 1);
                    },
                    onCompleteScope: this
                });
            },
            onCompleteScope: this
        });
    }

    _launch() {
        let allocation = this.content.get_allocation_box();
        this.content.width = allocation.x2 - allocation.x1;
        this.content.height = allocation.y2 - allocation.y1;
        this._animateIcon(0);
        if (this._app.open_new_window) {
            this._app.open_new_window(-1);
        } else {
            this._app.launch([], null);
        }
    }
}

function main(metadata, desklet_id) {
    return new CinnamonLauncherDesklet(metadata, desklet_id);
}
