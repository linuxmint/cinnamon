const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const ModalDialog = imports.ui.modalDialog;

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
            this.set_applet_icon_symbolic_name("go-up");
            this.set_applet_tooltip(_("Settings"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);        
                                                                
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);                    
                                                    
            this.troubleshootItem = new PopupMenu.PopupSubMenuMenuItem(_("Troubleshoot"));            
            this.troubleshootItem.menu.addAction(_("Restart Cinnamon"), function(event) {
                //GLib.spawn_command_line_async('cinnamon --replace');
                global.reexec_self();
            });
            
            this.troubleshootItem.menu.addAction(_("Looking Glass"), function(event) {
                Main.createLookingGlass().open();
            }); 
            
            this.troubleshootItem.menu.addAction(_("Restore all settings to default"), function(event) {
                this.confirm = new ConfirmDialog();
                this.confirm.open();
            });  
                       
            this.menu.addMenuItem(this.troubleshootItem);                                
                                               
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                                                
            let editMode = global.settings.get_boolean("panel-edit-mode");
            let panelEditMode = new PopupMenu.PopupSwitchMenuItem(_("Panel Edit mode"), editMode);
            panelEditMode.connect('toggled', function(item) {
                global.settings.set_boolean("panel-edit-mode", item.state);
            });
            this.menu.addMenuItem(panelEditMode);    
            global.settings.connect('changed::panel-edit-mode', function() {
                panelEditMode.setToggleState(global.settings.get_boolean("panel-edit-mode"));                            
            });

            this.menu.addAction(_("Panel settings"), function(event) {
                Util.spawnCommandLine("cinnamon-settings panel");
            });

            this.menu.addAction(_("Add/remove applets"), function(event) {
                Util.spawnCommandLine("cinnamon-settings applets");
            });

            this.menu.addAction(_("Other settings"), function(event) {
                Util.spawnCommandLine("cinnamon-settings");
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
