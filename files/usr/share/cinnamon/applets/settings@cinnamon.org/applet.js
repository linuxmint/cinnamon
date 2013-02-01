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

function ConfirmDialog(){
    this._init();
}

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height);
        
        try {        
            this.setAppletIconSymbolicName("go-up");
            this.setAppletTooltip(_("Settings"));                            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this._buildMenu(orientation);
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    onAppletClicked: function(event) {
        this.menu.toggle();
    },
    
    _buildMenu: function(orientation) {
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);        
        Panel.populateSettingsMenu(this.menu);
    },
    
    onOrientationChanged: function(orientation){
        this.menu.destroy();
        this._buildMenu(orientation);
    }
        
    
};

function main(metadata, orientation, panel_height) {  
    let myApplet = new MyApplet(orientation, panel_height);
    return myApplet;      
}
