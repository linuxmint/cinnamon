const St = imports.gi.St;
const Lang = imports.lang;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const DND = imports.ui.dnd;
const Clutter = imports.gi.Clutter;
const AppletManager = imports.ui.appletManager;
const Gtk = imports.gi.Gtk;
const Util = imports.misc.util;
const Pango = imports.gi.Pango;

function MenuItem(label, icon, callback) {
    this._init(label, icon, callback);
}

MenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        
        this._text = text;
        this._icon = icon;
        this._callback = callback;

        this.icon = new St.Icon({ icon_name: icon,
                                  icon_type: St.IconType.FULLCOLOR,
                                  style_class: 'popup-menu-icon' });
        this.addActor(this.icon);
        this.label = new St.Label({ text: text });
        this.addActor(this.label);

        this.connect('activate', callback);
    },
    
    clone: function(){
        return new MenuItem(this._text, this._icon, this._callback);
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

function AppletPopupMenu(launcher, orientation) {
    this._init(launcher, orientation);
}

AppletPopupMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    _init: function(launcher, orientation) {    
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();                    
    },

    setMaxHeight: function() {
        let monitor = Main.layoutManager.primaryMonitor;
        this.actor.style = ('max-height: ' +
                            Math.round(monitor.height - Main.panel.actor.height) +
                            'px;');
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
        this.actor._delegate = this;
        this._order = 0; // Defined in gsettings, this is the order of the applet within a panel location. This value is set by Cinnamon when loading/listening_to gsettings.
        this._newOrder = null; //  Used when moving an applet
        this._panelLocation = null; // Backlink to the panel location our applet is in, set by Cinnamon.
        this._newPanelLocation = null; //  Used when moving an applet
        this._uuid = null; // Defined in gsettings, set by Cinnamon.
        this._hook = null; // Defined in metadata.json, set by appletManager
        this._dragging = false;                
        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
    	this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));        

        this._applet_tooltip_text = "";      
        
        this._setAppletReactivity();                
        global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this._setAppletReactivity));        
    },
    
    _setAppletReactivity: function() {
        this._draggable.inhibit = !global.settings.get_boolean('panel-edit-mode');
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
        return new Clutter.Clone({ source: this.actor });
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
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
        this._applet_tooltip_text = text;
        this._applet_tooltip.set_text(text);
    },

    on_applet_clicked: function(event) {
        // Implemented by Applets        
    },
    
    on_applet_added_to_panel: function() {       
    },

    setOrientation: function (orientation) {
        let menuItems = new Array();
        let oldMenuItems = this._applet_context_menu._getMenuItems();
        for (var i in oldMenuItems) menuItems.push(oldMenuItems[i].clone())
        this._menuManager.removeMenu(this._applet_context_menu);
        
        this._applet_tooltip.destroy();
        this._applet_tooltip = new Tooltips.PanelItemTooltip(this, this._applet_tooltip_text, orientation);

        this._applet_context_menu.destroy();
        this._applet_context_menu = new AppletContextMenu(this, orientation);
        this._menuManager.addMenu(this._applet_context_menu);

        this.on_orientation_changed(orientation);
        
        if (this._applet_context_menu.numMenuItems == 0){ // Do not recreate the menu if the applet already handles it in on_orientation_changed
            for (var i in menuItems) this._applet_context_menu.addMenuItem(menuItems[i]);
        }

        this.finalizeContextMenu();
    },
    
    on_orientation_changed: function(event) {
        // Implemented by Applets        
    },
    
    finalizeContextMenu: function () {
        // Add default context menus
        if (this._applet_context_menu._getMenuItems().length > 0) {
            this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }
        let context_menu_item_remove = new MenuItem(_("Remove this applet"), Gtk.STOCK_REMOVE, Lang.bind(null, AppletManager._removeAppletFromPanel, this._uuid));
        this._applet_context_menu.addMenuItem(context_menu_item_remove);        
    },
   
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
        this._applet_icon = new St.Icon({icon_name: icon_name, icon_size: 22, icon_type: St.IconType.FULLCOLOR, reactive: true, track_hover: true, style_class: 'applet-icon' });             
        this._applet_icon_box.child = this._applet_icon;
    },

    set_applet_icon_symbolic_name: function (icon_name) {
        this._applet_icon = new St.Icon({icon_name: icon_name, icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });             
        this._applet_icon_box.child = this._applet_icon;
    },

    set_applet_icon_path: function (icon_path) {
        if (this._applet_icon_box.child) this._applet_icon_box.child.destroy();

        if (icon_path){
            let file = Gio.file_new_for_path(icon_path);
            let icon_uri = file.get_uri();
            this._applet_icon = St.TextureCache.get_default().load_uri_async(icon_uri, 22, 22);
            this._applet_icon_box.child = this._applet_icon;
        }
    },
};

function TextApplet(orientation) {
    this._init(orientation);
}

TextApplet.prototype = {
    __proto__: Applet.prototype,

    _init: function(orientation) {
        Applet.prototype._init.call(this, orientation);        
        this._applet_label = new St.Label({ reactive: true, track_hover: true, style_class: 'applet-label'});       
        this._applet_label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE; 
        this.actor.add(this._applet_label, { y_align: St.Align.MIDDLE, y_fill: false });    
    },

    set_applet_label: function (text) {
        this._applet_label.set_text(text);
    },
    
    on_applet_added_to_panel: function() {       
                        
    }
};

function TextIconApplet(orientation) {
    this._init(orientation);
}

TextIconApplet.prototype = {
    __proto__: IconApplet.prototype,

    _init: function(orientation) {
        IconApplet.prototype._init.call(this, orientation);
        this._applet_label = new St.Label({ reactive: true, track_hover: true, style_class: 'applet-label'});    
        this._applet_label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;     
        this.actor.add(this._applet_label, { y_align: St.Align.MIDDLE, y_fill: false });
    },

    set_applet_label: function (text) {
        this._applet_label.set_text(text);
    },

    hide_applet_icon: function () {
        this._applet_icon_box.child = null;
    },
    
    on_applet_added_to_panel: function() {       
                                
    }  
};
