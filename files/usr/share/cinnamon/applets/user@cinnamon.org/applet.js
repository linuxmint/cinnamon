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

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {
            this._session = new GnomeSession.SessionManager();
            this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();

            this.set_applet_icon_symbolic_name("avatar-default");
                    
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);                                                                    
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);      
            
            let userBox = new St.BoxLayout({ style_class: 'user-box', vertical: false });
            
            this._userIcon = new St.Icon({ style_class: 'user-icon'});
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
                                                           
            this.menu.addAction(_("Account Details"), function(event) {
                Util.spawnCommandLine("cinnamon-settings user");
            });            

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.menu.addAction(_("Lock Screen"), function(event) {
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
            });

            this.menu.addAction(_("Switch User"), function(event) {
                Util.spawnCommandLine("mdmflexiserver");
            });

            this.menu.addAction(_("Log Out..."), function(event) {
                this._session.LogoutRemote(0);
            });

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this.menu.addAction(_("Power Off..."), function(event) {
                this._session.ShutdownRemote();
            });                    

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
        }
    },
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
