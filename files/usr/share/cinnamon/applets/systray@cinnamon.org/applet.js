const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const Lang = imports.lang;

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation) {        
        Applet.Applet.prototype._init.call(this, orientation);
        this.actor.remove_style_class_name("applet-box");
        try {                   
            Main.statusIconDispatcher.connect('status-icon-added', Lang.bind(this, this._onTrayIconAdded));
            Main.statusIconDispatcher.connect('status-icon-removed', Lang.bind(this, this._onTrayIconRemoved));    
            Main.statusIconDispatcher.connect('before-redisplay', Lang.bind(this, this._onBeforeRedisplay));    
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
    
    },
    
    _onBeforeRedisplay: function() {
        let children = this.actor.get_children();
        for (var i = 0; i < children.length; i++) {
            children[i].destroy();
        }
    },
    
    _onTrayIconAdded: function(o, icon, role) {
        try {                          
            let hiddenIcons = ["network", "power", "keyboard", "gnome-settings-daemon", "volume", "bluetooth", "bluetooth-manager", "battery", "a11y"];
            
            if (hiddenIcons.indexOf(role) != -1 ) {  
                // We've got an applet for that          
                return;
            }
            
            global.log("Adding systray: " + role);
            
            let buttonBox = new PanelMenu.ButtonBox({ style_class: 'panel-status-button', reactive: true, track_hover: true  });
            let box = buttonBox.actor;
            box.add_actor(icon);

            this._insertStatusItem(box, -1);
            
            let themeNode = buttonBox.actor.get_theme_node();
            if (!themeNode.get_length('width')) icon.width = 22;
            else icon.width = themeNode.get_length('width');
            if (!themeNode.get_length('height')) icon.height = 22;
            else icon.height = themeNode.get_length('height');
        }
        catch (e) {
            global.logError(e);
        }
    },

    _onTrayIconRemoved: function(o, icon) {
        let box = icon.get_parent();
        if (box && box._delegate instanceof PanelMenu.ButtonBox)
            box.destroy();
    },
    
    _insertStatusItem: function(actor, position) {
        let children = this.actor.get_children();
        let i;
        for (i = children.length - 1; i >= 0; i--) {
            let rolePosition = children[i]._rolePosition;
            if (position > rolePosition) {
                this.actor.insert_actor(actor, i + 1);
                break;
            }
        }
        if (i == -1) {
            // If we didn't find a position, we must be first
            this.actor.insert_actor(actor, 0);
        }
        actor._rolePosition = position;
    },
    
    
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
