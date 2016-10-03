//System Shutdown and Restart Applet by Shelley
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Lang = imports.lang;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio
const AccountsService = imports.gi.AccountsService;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const Main = imports.ui.main;
const Panel = imports.ui.panel;
const Settings = imports.ui.settings;


function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        
        try {
            this._session = new GnomeSession.SessionManager();
            this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();
            this.settings = new Settings.AppletSettings(this, "user@cinnamon.org", instance_id);

            this.set_applet_icon_symbolic_name("avatar-default");
                    
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);                                                                    
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);      
            
            let userBox = new St.BoxLayout({ style_class: 'user-box', reactive: true, vertical: false });

            this._userIcon = new St.Bin({ style_class: 'user-icon'});
            
            this.settings.bindProperty(Settings.BindingDirection.IN, "display-name", "disp_name", this._updateLabel, null);

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

            item = new PopupMenu.PopupIconMenuItem(_("Lock Screen"), "lock-screen", St.IconType.SYMBOLIC);
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

            if (GLib.getenv("XDG_SEAT_PATH")) {
                // LightDM
                item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "switch-user", St.IconType.SYMBOLIC);
                item.connect('activate', Lang.bind(this, function() {
                    Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                    Util.spawnCommandLine("dm-tool switch-to-greeter");
                }));
                this.menu.addMenuItem(item);

                item = new PopupMenu.PopupIconMenuItem(_("Guest Session"), "guest-session", St.IconType.SYMBOLIC);
                item.connect('activate', Lang.bind(this, function() {
                    Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                    Util.spawnCommandLine("dm-tool switch-to-guest");
                }));
                this.menu.addMenuItem(item);
            }
            else if (GLib.file_test("/usr/bin/mdmflexiserver", GLib.FileTest.EXISTS)) {
                // MDM
                item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "switch-user", St.IconType.SYMBOLIC);
                item.connect('activate', Lang.bind(this, function() {
                    Util.spawnCommandLine("mdmflexiserver");
                }));
                this.menu.addMenuItem(item);
            }
            else if (GLib.file_test("/usr/bin/gdmflexiserver", GLib.FileTest.EXISTS)) {
                // GDM
                item = new PopupMenu.PopupIconMenuItem(_("Switch User"), "switch-user", St.IconType.SYMBOLIC);
                item.connect('activate', Lang.bind(this, function() {
                    Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                    Util.spawnCommandLine("gdmflexiserver");
                }));
                this.menu.addMenuItem(item);
            }

            item = new PopupMenu.PopupIconMenuItem(_("Log Out..."), "logout", St.IconType.SYMBOLIC);
            item.connect('activate', Lang.bind(this, function() {
                this._session.LogoutRemote(0);
            }));
            this.menu.addMenuItem(item);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            item = new PopupMenu.PopupIconMenuItem(_("Power Off..."), "shutdown", St.IconType.SYMBOLIC);
            item.connect('activate', Lang.bind(this, function() {
                this._session.ShutdownRemote();
            }));
            this.menu.addMenuItem(item);

            this._user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());
            this._userLoadedId = this._user.connect('notify::is_loaded', Lang.bind(this, this._onUserChanged));
            this._userChangedId = this._user.connect('changed', Lang.bind(this, this._onUserChanged));
            this._onUserChanged();
            this.on_orientation_changed(orientation);
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();        
    }, 
    
    _updateLabel: function() {
        if (this.disp_name) {
            this.set_applet_label(this._user.get_real_name());
        } else {
            this.set_applet_label("");
        }
    },

    _onUserChanged: function() {
        if (this._user.is_loaded) {
            this.set_applet_tooltip(this._user.get_real_name());   
            this.userLabel.set_text (this._user.get_real_name());
            if (this._userIcon) {
                let iconFileName = this._user.get_icon_file();
                let iconFile = Gio.file_new_for_path(iconFileName);
                let icon;
                if (iconFile.query_exists(null)) {
                    icon = new Gio.FileIcon({file: iconFile});
                } else {
                    icon = new Gio.ThemedIcon({name: 'avatar-default'});
                }
                let img = St.TextureCache.get_default().load_gicon(null, icon, 48);
                this._userIcon.set_child (img);
                this._userIcon.show();               
            }
            this._updateLabel();
        }
    },
    
    on_applet_removed_from_panel: function() {
        this.settings.finalize();
    },

    on_orientation_changed: function(orientation) {
        if (orientation == St.Side.LEFT || orientation == St.Side.RIGHT)
            this.hide_applet_label(true);
        else
            this.hide_applet_label(false);
    },
};

function main(metadata, orientation, panel_height, instance_id) {  
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;      
}
