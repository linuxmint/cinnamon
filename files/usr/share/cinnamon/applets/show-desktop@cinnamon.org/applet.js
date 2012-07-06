const Applet = imports.ui.applet;
const Lang = imports.lang;

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation) {        
        Applet.IconApplet.prototype._init.call(this, orientation);
        
        try {        
            this.set_applet_icon_name("desktop");
            this.set_applet_tooltip(_("Show desktop"));                                                                                               
            this._desktopShown = false;                    
            
            global.window_manager.connect('map', Lang.bind(this, this.on_window_mapped));
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_window_mapped: function(cinnamonwm, actor) {
        this._desktopShown = false;        
    },
    
    on_applet_clicked: function(event) {
        try {            
            if (this._desktopShown) {
                global.screen.unshow_desktop();                
            }
            else {
                global.screen.show_desktop(global.get_current_time());                
            }
            this._desktopShown = !this._desktopShown;
        }
        catch (e) {
            global.logError(e);
        }                
    }
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
