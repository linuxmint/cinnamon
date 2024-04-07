const Applet = imports.ui.applet;
const Lang = imports.lang;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const AccountsService = imports.gi.AccountsService;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const Settings = imports.ui.settings;
const UserWidget = imports.ui.userWidget;

const DIALOG_ICON_SIZE = 64;
const USER_DEFAULT_PIC_PATH = "/usr/share/cinnamon/faces/user-generic.png"

class CinnamonUserApplet extends Applet.TextIconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._session = new GnomeSession.SessionManager();
        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
        this.settings = new Settings.AppletSettings(this, "user@cinnamon.org", instance_id);

        this.settings.bind("display-picture", "display_picture", this._setIcon.bind(this));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._contentSection = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._contentSection);

        this._user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());
        this._userLoadedId = this._user.connect('notify::is-loaded', Lang.bind(this, this._onUserChanged));
        this._userChangedId = this._user.connect('changed', Lang.bind(this, this._onUserChanged));

        let userBox = new St.BoxLayout({ style_class: 'user-box', reactive: true, vertical: false });

        this._userIcon = new UserWidget.Avatar(this._user, { iconSize: DIALOG_ICON_SIZE });

        this.settings.bind("display-name", "disp_name", this._updateLabel);

        userBox.connect('button-press-event', Lang.bind(this, function() {
            this.menu.toggle();
            Util.spawnCommandLine("cinnamon-settings user");
        }));

        this._userIcon.hide();
        userBox.add(this._userIcon,
                    { x_fill:  true,
                      y_fill:  false,
                      x_align: St.Align.END,
                      y_align: St.Align.START });
        this.userLabel = new St.Label(({ style_class: 'user-label'}));
        userBox.add(this.userLabel,
                    { x_fill:  true,
                      y_fill:  false,
                      x_align: St.Align.END,
                      y_align: St.Align.MIDDLE });

        this.menu.addActor(userBox);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let item = new PopupMenu.PopupIconMenuItem(_("System Settings"), "preferences-system", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, function() {
            Util.spawnCommandLine("cinnamon-settings");
        }));
        this.menu.addMenuItem(item);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        item = new PopupMenu.PopupIconMenuItem(_("Lock Screen"), "system-lock-screen", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, function() {
            let screensaver_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.screensaver" });
            let screensaver_dialog = Gio.file_new_for_path("/usr/bin/cinnamon-screensaver-command");
            if (screensaver_dialog.query_exists(null)) {
                if (screensaver_settings.get_boolean("ask-for-away-message")) {
                    Util.spawnCommandLine("cinnamon-screensaver-lock-dialog");
                }
                else {
                    Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                }
            }
            else {
                this._screenSaverProxy.LockRemote();
            }
        }));
        this.menu.addMenuItem(item);

        let lockdown_settings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.lockdown' });
        if (!lockdown_settings.get_boolean('disable-user-switching')) {
            if (GLib.getenv("XDG_SEAT_PATH")) {
                // LightDM
                item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "system-switch-user", St.IconType.SYMBOLIC);
                item.connect('activate', Lang.bind(this, function() {
                    Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                    Util.spawnCommandLine("dm-tool switch-to-greeter");
                }));
                this.menu.addMenuItem(item);
            }
            else if (GLib.file_test("/usr/bin/mdmflexiserver", GLib.FileTest.EXISTS)) {
                // MDM
                item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "system-switch-user", St.IconType.SYMBOLIC);
                item.connect('activate', Lang.bind(this, function() {
                    Util.spawnCommandLine("mdmflexiserver");
                }));
                this.menu.addMenuItem(item);
            }
            else if (GLib.file_test("/usr/bin/gdmflexiserver", GLib.FileTest.EXISTS)) {
                // GDM
                item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "system-switch-user", St.IconType.SYMBOLIC);
                item.connect('activate', Lang.bind(this, function() {
                    Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                    Util.spawnCommandLine("gdmflexiserver");
                }));
                this.menu.addMenuItem(item);
            }
        }

        item = new PopupMenu.PopupIconMenuItem(_("Log Out..."), "logout", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, function() {
            this._session.LogoutRemote(0);
        }));
        this.menu.addMenuItem(item);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        item = new PopupMenu.PopupIconMenuItem(_("Power Off..."), "system-shutdown", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, function() {
            this._session.ShutdownRemote();
        }));
        this.menu.addMenuItem(item);

        this._onUserChanged();
        this.set_show_label_in_vertical_panels(false);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _updateLabel() {
        if (this.disp_name) {
            this.set_applet_label(this._user.get_real_name());
        } else {
            this.set_applet_label("");
        }
    }

    _onUserChanged() {
        this._setIcon();
        if (this._user.is_loaded) {
            this.set_applet_tooltip(this._user.get_real_name());
            this.userLabel.set_text (this._user.get_real_name());
            if (this._userIcon) {
                this._userIcon.update();
                this._userIcon.show();
            }
            this._updateLabel();
        }
    }

    _setIcon() {
        if (this.display_picture && this._user.is_loaded) {
            let iconFileName = this._user.get_icon_file();
            if (GLib.file_test(iconFileName, GLib.FileTest.EXISTS)) {
                this.set_applet_icon_path(iconFileName);
                return;
            } else if (GLib.file_test(USER_DEFAULT_PIC_PATH, GLib.FileTest.EXISTS)) {
                this.set_applet_icon_path(USER_DEFAULT_PIC_PATH);
                return;
            }
        }

        this.set_applet_icon_symbolic_name("avatar-default");
    }

    on_applet_removed_from_panel() {
        this.settings.finalize();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonUserApplet(orientation, panel_height, instance_id);
}
