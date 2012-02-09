const St = imports.gi.St;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const DND = imports.ui.dnd;

function MenuItem(label, icon, callback) {
    this._init(label, icon, callback);
}

MenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.icon = new St.Icon({ icon_name: icon,
                                  icon_type: St.IconType.FULLCOLOR,
                                  style_class: 'popup-menu-icon' });
        this.addActor(this.icon);
        this.label = new St.Label({ text: text });
        this.addActor(this.label);

        this.connect('activate', callback);
    }
};

function AppletContextMenu(launcher, orientation) {
    this._init(launcher, orientation);
}

AppletContextMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,
    
    _init: function(launcher, orientation) {    
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();                    
    }    
}

function Applet(orientation) {
    this._init(orientation);
}

Applet.prototype = {

    _init: function(orientation) {
        this.actor = new St.BoxLayout({ style_class: 'applet-box', reactive: true, track_hover: true });        
        this._applet_tooltip = new Tooltips.PanelItemTooltip(this, "", orientation);                                        
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));  
        
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._applet_context_menu = new AppletContextMenu(this, orientation);
        this._menuManager.addMenu(this._applet_context_menu);     
        
        this.actor._applet = this; // Backlink to get the applet from its actor (handy when we want to know stuff about a particular applet within the panel)
        this._order = 0; // Defined in gsettings, this is the order of the applet within a panel location. This value is set by Cinnamon when loading/listening_to gsettings.
        this._panelLocation = null; // Backlink to the panel location our applet is in, set by Cinnamon.
        this._uuid = null; // Defined in gsettings, set by Cinnamon.
        this._dragging = false;
        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
        this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));            
    },
            
    _onDragBegin: function() {
        this._dragging = true;
        this._applet_tooltip.hide();
        this._applet_tooltip.preventShow = true;
    },
    
    _onDragEnd: function() {
        this._dragging = false;
        this._applet_tooltip.preventShow = false;
    },
    
    _onDragCancelled: function() {
        this._dragging = false;
        this._applet_tooltip.preventShow = false;
    },
    
    getDragActor: function() {
        return this.actor;
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor; // not correct, should be a copy of the object.. 
    },
            
    _onButtonReleaseEvent: function (actor, event) {                      
        if (event.get_button()==1){
            if (this._applet_context_menu.isOpen) {
                this._applet_context_menu.toggle(); 
            }
            this.on_applet_clicked(event);
        }
        if (event.get_button()==3){            
            if (this._applet_context_menu._getMenuItems().length > 0) {
                this._applet_context_menu.toggle();			
            }
        }
        return true;
    },
    
    set_applet_tooltip: function (text) {
        this._applet_tooltip.set_text(text);
    },
      
    on_applet_clicked: function(event) {
        // Implemented by Applets        
    }    
    
};

function IconApplet(orientation) {
    this._init(orientation);
}

IconApplet.prototype = {
    __proto__: Applet.prototype,

    _init: function(orientation) {
        Applet.prototype._init.call(this, orientation);
        this._applet_icon_box = new St.Bin();
        this.actor.add(this._applet_icon_box, { y_align: St.Align.MIDDLE, y_fill: false });                            
    },
    
    set_applet_icon_name: function (icon_name) {
        this._applet_icon = new St.Icon({icon_name: icon_name, icon_size: 22, icon_type: St.IconType.FULLCOLOR});             
        this._applet_icon_box.child = this._applet_icon;
    },
    
    set_applet_icon_path: function (icon_path) {
        let file = Gio.file_new_for_path(icon_path);
        let icon_uri = file.get_uri();
        this._applet_icon = St.TextureCache.get_default().load_uri_sync(1, icon_uri, 22, 22);
        this._applet_icon_box.child = this._applet_icon;
    },
};

function TextApplet(orientation) {
    this._init(orientation);
}

TextApplet.prototype = {
    __proto__: Applet.prototype,

    _init: function(orientation) {
        Applet.prototype._init.call(this, orientation);
        this._applet_label = new St.Label({ track_hover: true, style_class: 'applet-label'});        
        this.actor.add(this._applet_label, { y_align: St.Align.MIDDLE, y_fill: false });    
    },
    
    set_applet_label: function (text) {
        this._applet_label.set_text(text);
    }
};

function TextIconApplet(orientation) {
    this._init(orientation);
}

TextIconApplet.prototype = {
    __proto__: IconApplet.prototype,

    _init: function(orientation) {
        IconApplet.prototype._init.call(this, orientation);
        this._applet_label = new St.Label({ track_hover: true, style_class: 'applet-label'});        
        this.actor.add(this._applet_label, { y_align: St.Align.MIDDLE, y_fill: false });
    },
    
    set_applet_label: function (text) {
        this._applet_label.set_text(text);
    }    
};
