const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Panel = imports.ui.panel;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

function ConfirmDialog(){
    this._init();
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
            
	    Gtk.IconTheme.get_default().append_search_path("/usr/lib/cinnamon-settings/data/icons/");	    
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._buildMenu(orientation);
                        
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },
    
    _buildMenu: function(orientation) {
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);        
        Panel.populateSettingsMenu(this.menu);
    },
    
    on_orientation_changed: function(orientation){
        this.menu.destroy();
        this._buildMenu(orientation);
    }
        
    
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
