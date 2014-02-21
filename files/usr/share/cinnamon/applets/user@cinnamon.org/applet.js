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


function MyApplet(orientation, instance_id) {
    this._init(orientation, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, instance_id) {        
        Applet.TextIconApplet.prototype._init.call(this, orientation, instance_id);
        
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

            this._userIcon = new St.Icon({ style_class: 'user-icon'});
            
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

            this.notificationsSwitch = new PopupMenu.PopupSwitchMenuItem(_("Notifications"), this._toggleNotifications);
            global.settings.connect('changed::display-notifications', Lang.bind(this, function() {
                this.notificationsSwitch.setToggleState(global.settings.get_boolean("display-notifications"));
            }));
            this.notificationsSwitch.connect('toggled', Lang.bind(this, function() {
                global.settings.set_boolean("display-notifications", this.notificationsSwitch.state);
            }));

            this.notificationsSwitch.setToggleState(global.settings.get_boolean("display-notifications"));

            this.menu.addMenuItem(this.notificationsSwitch);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                                                           
            this.menu.addAction(_("Account Details"), Lang.bind(this, function() {
                Util.spawnCommandLine("cinnamon-settings user");
            }));

            this.menu.addAction(_("All Settings"), Lang.bind(this, function() {
                Util.spawnCommandLine("cinnamon-settings");
            }));

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.menu.addAction(_("Lock Screen"), Lang.bind(this, function() {
                let screensaver_settings = new Gio.Settings({ schema: "org.cinnamon.screensaver" });                        
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

            if (GLib.getenv("XDG_SEAT_PATH")) {
                // LightDM
                this.menu.addAction(_("Switch User"), Lang.bind(this, function() {
                    Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                    Util.spawnCommandLine("dm-tool switch-to-greeter");
                }));

                this.menu.addAction(_("Guest Session"), Lang.bind(this, function() {
                    Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                    Util.spawnCommandLine("dm-tool switch-to-guest");
                }));
            }
            else if (GLib.file_test("/usr/bin/mdmflexiserver", GLib.FileTest.EXISTS)) {
                // MDM                
                this.menu.addAction(_("Switch User"), Lang.bind(this, function() {
                    Util.spawnCommandLine("mdmflexiserver");
                }));
            }
            else if (GLib.file_test("/usr/bin/gdmflexiserver", GLib.FileTest.EXISTS)) {
                // GDM
                this.menu.addAction(_("Switch User"), Lang.bind(this, function() {
                    Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                    Util.spawnCommandLine("gdmflexiserver");
                }));
            }

            this.menu.addAction(_("Log Out..."), Lang.bind(this, function() {
                this._session.LogoutRemote(0);
            }));

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.menu.addAction(_("Power Off..."), Lang.bind(this, function() {
                this._session.ShutdownRemote();
            }));

            this._user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());
            this._userLoadedId = this._user.connect('notify::is_loaded', Lang.bind(this, this._onUserChanged));
            this._userChangedId = this._user.connect('changed', Lang.bind(this, this._onUserChanged));
            this._onUserChanged();

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
                this._userIcon.set_gicon (icon);
                this._userIcon.show();               
            }
            this._updateLabel();
        }
    },
    
    on_applet_removed_from_panel: function() {
        this.settings.finalize();
    },
};

function main(metadata, orientation, instance_id) {  
    let myApplet = new MyApplet(orientation, instance_id);
    return myApplet;      
}
