const St = imports.gi.St;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;

function ShowDesktopButton() {
    this._init();
}

ShowDesktopButton.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function() {
        Applet.IconApplet.prototype._init.call(this);
        this.set_icon_name("desktop");        
                        
        this._tracker = Cinnamon.WindowTracker.get_default();        
        this._desktopShown = false;        
        this._alreadyMinimizedWindows = [];
    },
      
    clicked: function(event) {
        log ("INSTANCE CLICKED");
        let metaWorkspace = global.screen.get_active_workspace();
        let windows = metaWorkspace.list_windows();
        
        if (this._desktopShown) {
            for ( let i = 0; i < windows.length; ++i ) {
                if (this._tracker.is_window_interesting(windows[i])){                   
                    let shouldrestore = true;
                    for (let j = 0; j < this._alreadyMinimizedWindows.length; j++) {
                        if (windows[i] == this._alreadyMinimizedWindows[j]) {
                            shouldrestore = false;
                            break;
                        }                        
                    }    
                    if (shouldrestore) {
                        windows[i].unminimize();                                  
                    }
                }
            }            
            this._alreadyMinimizedWindows.length = []; //Apparently this is better than this._alreadyMinimizedWindows = [];            
        }
        else {
            for ( let i = 0; i < windows.length; ++i ) {
                if (this._tracker.is_window_interesting(windows[i])){                   
                    if (!windows[i].minimized) {
                        windows[i].minimize();
                    }
                    else {
                        this._alreadyMinimizedWindows.push(windows[i]);
                    }                    
                }
            }
        }
        this._desktopShown = !this._desktopShown;
    }
};
