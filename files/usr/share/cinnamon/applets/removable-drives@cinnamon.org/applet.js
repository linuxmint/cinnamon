const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

function DriveMenuItem(place) {
    this._init(place);
}

DriveMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(place) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.place = place;

        this.label = new St.Label({ text: place.name });
        this.addActor(this.label);

        let ejectIcon = new St.Icon({ icon_name: 'media-eject',
				      icon_type: St.IconType.SYMBOLIC,
				      style_class: 'popup-menu-icon ' });
        let ejectButton = new St.Button({ child: ejectIcon });
        ejectButton.connect('clicked', Lang.bind(this, this._eject));
        this.addActor(ejectButton);
    },

    _eject: function() {
        this.place.remove();
    },

    activate: function(event) {
        this.place.launch({ timestamp: event.get_time() });
        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this, event);
    }
};

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height) {        
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height);
        
        try {        
            this.set_applet_icon_symbolic_name("drive-harddisk");
            this.set_applet_tooltip(_("Removable drives"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);            
                                            
            this._contentSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._contentSection);

            this._update();

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addAction(_("Open file manager"), function(event) {
                let appSystem = Cinnamon.AppSystem.get_default();
                let app = appSystem.lookup_app('nautilus.desktop');
                app.activate_full(-1, event.get_time());
            });     
            
            Main.placesManager.connect('mounts-updated', Lang.bind(this, this._update));
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },
    
    _update: function() {
        this._contentSection.removeAll();

        let mounts = Main.placesManager.getMounts();
        let any = false;
        for (let i = 0; i < mounts.length; i++) {
            if (mounts[i].isRemovable()) {
                this._contentSection.addMenuItem(new DriveMenuItem(mounts[i]));
                any = true;
            }
        }

        this.actor.visible = any;
    }
    
};

function main(metadata, orientation, panel_height) {  
    let myApplet = new MyApplet(orientation, panel_height);
    return myApplet;      
}
