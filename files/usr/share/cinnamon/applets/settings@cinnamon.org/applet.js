const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Gettext = imports.gettext.domain('cinnamon-extensions');
const _ = Gettext.gettext;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;

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
                Util.spawnCommandLine("gsettings reset-recursively org.cinnamon");
                global.reexec_self();
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
            
            this.menu.addAction(_("Cinnamon Settings"), function(event) {
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
