//Cinnamon Settings Applet for quick acsess to items


const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const ModalDialog = imports.ui.modalDialog;

const AppletMeta = imports.ui.appletManager.applets["settings@cinnamon"];
const AppletDir = imports.ui.appletManager.appletMeta["settings@cinnamon"].path;

function ConfirmDialog(){
    this._init();
}

ConfirmDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(){
    ModalDialog.ModalDialog.prototype._init.call(this);
	let label = new St.Label({text: "Are you sure you want to restore all settings to default?\n\n"});
	this.contentLayout.add(label);

	this.setButtons([
	    {
		label: _("Yes"),
		action: Lang.bind(this, function(){
                    Util.spawnCommandLine("gsettings reset-recursively org.cinnamon");
                    global.reexec_self();
		})
	    },
	    {
		label: _("No"),
		action: Lang.bind(this, function(){
		    this.close();
		})
	    }
	]);
    },	
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {        
            this.set_applet_icon_symbolic_name("system-run");
            this.set_applet_tooltip(_("Settings"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);        
                                                                
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);                    
                                                    
            this.troubleshootItem = new PopupMenu.PopupSubMenuMenuItem(_("Troubleshoot"));            
            this.troubleshootItem.menu.addAction(_("Restart Cinnamon"), function(event) {
                global.reexec_self();
            });

	    //Reload Theme
		 this.troubleshootItem.menu.addAction(_("Reload Theme"), function(event) {
                Main.loadTheme();
		Util.spawnCommandLine("notify-send --icon=gtk-add Reloaded \"The theme has been reloaded.\"");
            }); 
            
            this.troubleshootItem.menu.addAction(_("Looking Glass"), function(event) {
                Main.createLookingGlass().open();
            }); 
            
            this.troubleshootItem.menu.addAction(_("Restore all settings to Default"), function(event) {
                this.confirm = new ConfirmDialog();
                this.confirm.open();
            });  
	    
	      this.troubleshootItem.menu.addAction(_("Force Quit Application"), function(event) {
                Util.spawnCommandLine(AppletDir + "/xkill.py");
		Util.spawnCommandLine("notify-send --icon=gtk-add XKILL \"Click on the window/process you want to force close.\"");
            });
                       
            this.menu.addMenuItem(this.troubleshootItem);  
	
  	    this.menu.addAction(_("Screenshot"), function(event) {
                Util.spawnCommandLine("gnome-screenshot -a");
            });

	     this.menu.addAction(_("Terminal"), function(event) {
                Util.spawnCommandLine("gnome-terminal");
            });
                              
         
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                                                
            let editMode = global.settings.get_boolean("panel-edit-mode");
            let panelEditMode = new PopupMenu.PopupSwitchMenuItem(_("Panel Edit Mode"), editMode);
            panelEditMode.connect('toggled', function(item) {
                global.settings.set_boolean("panel-edit-mode", item.state);
            });
            this.menu.addMenuItem(panelEditMode);    
            global.settings.connect('changed::panel-edit-mode', function() {
                panelEditMode.setToggleState(global.settings.get_boolean("panel-edit-mode"));                            
            });
	 
            this.menu.addAction(_("Add/Remove Applets"), function(event) {
                Util.spawnCommandLine("cinnamon-settings applets");
            });

	    this.menu.addAction(_("Start up Applications"), function(event) {
                Util.spawnCommandLine("gnome-session-properties");
            });

            this.menu.addAction(_("Cinnamon Settings"), function(event) {
                Util.spawnCommandLine("cinnamon-settings");
            });
	
	     this.menu.addAction(_("System Settings"), function(event) {
                Util.spawnCommandLine("gnome-control-center");
            });
                        
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },
        
    
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
