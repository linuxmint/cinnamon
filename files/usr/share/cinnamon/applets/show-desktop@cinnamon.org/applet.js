const Applet = imports.ui.applet;
const Main = imports.ui.main;

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height) {        
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height);
        
        this.set_applet_icon_name("desktop");
        this.set_applet_tooltip(_("Show desktop"));
    },
    
    on_window_mapped: function(cinnamonwm, actor) {
        this._desktopShown = false;        
    },
    
    on_applet_clicked: function(event) {
        Main.toggleDesktop();
    }
};

function main(metadata, orientation, panel_height) {  
    let myApplet = new MyApplet(orientation, panel_height);
    return myApplet;      
}
