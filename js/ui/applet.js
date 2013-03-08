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
const Mainloop = imports.mainloop;
const Flashspot = imports.ui.flashspot;
	
const COLOR_ICON_HEIGHT_FACTOR = .875;  // Panel height factor for normal color icons
const PANEL_FONT_DEFAULT_HEIGHT = 11.5; // px
const PANEL_SYMBOLIC_ICON_DEFAULT_HEIGHT = 1.14 * PANEL_FONT_DEFAULT_HEIGHT; // ems conversion
const DEFAULT_PANEL_HEIGHT = 25;

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
};

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

function Applet(orientation, panelHeight, instance_id) {
    this._init(orientation, panelHeight, instance_id);
}

Applet.prototype = {

    _init: function(orientation, panel_height, instance_id) {
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

        this._panelHeight = panel_height ? panel_height : 25;
        this.instance_id = instance_id; // Needed by appletSettings
        this._uuid = null; // Defined in gsettings, set by Cinnamon.
        this._hook = null; // Defined in metadata.json, set by appletManager
        this._dragging = false;                
        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
    	this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));        

        this._scaleMode = false;
        this._applet_tooltip_text = "";
        this._scaleMode = global.settings.get_boolean('panel-scale-text-icons') && global.settings.get_boolean('panel-resizable');
        this.context_menu_item_remove = null;
        this.context_menu_separator = null;

        this._setAppletReactivity();
        this._panelEditModeChangedId = global.settings.connect('changed::panel-edit-mode', Lang.bind(this, function() {
            this._setAppletReactivity();
            this.finalizeContextMenu();
        }));
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

    on_applet_added_to_panel: function(userEnabled) {
        if (userEnabled) {
            let [x, y] = this.actor.get_transformed_position();
            let [w, h] = this.actor.get_transformed_size();
            h = Math.max(h, this.panelHeight);

            let flashspot = new Flashspot.Flashspot({ x : x, y : y, width: w, height: h});
            flashspot.fire();
            let timeoutId = Mainloop.timeout_add(300, Lang.bind(this, function() {
                let flashspot = new Flashspot.Flashspot({ x : x, y : y, width: w, height: h});
                flashspot.fire();
                Mainloop.source_remove(timeoutId);
                return false;
            }));
        }
    },

    // Optionally implemented by Applets,
    // to destroy UI resources and disconnect from signal handlers, etc.
    on_applet_removed_from_panel: function() {
        // dummy, for very simple applets
    },

    // should only be called by appletManager
    _onAppletRemovedFromPanel: function() {
        global.settings.disconnect(this._panelEditModeChangedId);
        this.on_applet_removed_from_panel();
    },

    setOrientation: function (orientation) {
        let menuItems = new Array();
        let oldMenuItems = this._applet_context_menu._getMenuItems();
        for (var i in oldMenuItems){
            if (oldMenuItems[i] instanceof MenuItem) { // in case some applets don't use the standards
                if (oldMenuItems[i] !== this.context_menu_separator && oldMenuItems[i] !== this.context_menu_item_remove) {
                    menuItems.push(oldMenuItems[i].clone());
                }
            }
        }
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

    setPanelHeight: function (panel_height) {
        if (panel_height && panel_height > 0) {
            this._panelHeight = panel_height;
        }
        this.on_panel_height_changed();
    },
    
    on_panel_height_changed: function() {
        // Implemented byApplets
    },
    
    finalizeContextMenu: function () {
        // Add default context menus if we're in panel edit mode, ensure their removal if we're not
        let isEditMode = global.settings.get_boolean('panel-edit-mode');
        let items = this._applet_context_menu._getMenuItems();
        if (isEditMode && items.indexOf(this.context_menu_item_remove) == -1) {
            this.context_menu_item_remove = new MenuItem(_("Remove this applet"), Gtk.STOCK_REMOVE, Lang.bind(null, AppletManager._removeAppletFromPanel, this._uuid, this.instance_id));
            this.context_menu_separator = new PopupMenu.PopupSeparatorMenuItem();
            if (this._applet_context_menu._getMenuItems().length > 0) {
                this._applet_context_menu.addMenuItem(this.context_menu_separator);
            }
            this._applet_context_menu.addMenuItem(this.context_menu_item_remove);
        } else {
            if (items.indexOf(this.context_menu_separator) != -1) {
                this.context_menu_separator.destroy();
                this.context_menu_separator = null;
            }
            if (items.indexOf(this.context_menu_item_remove) != -1) {
                this.context_menu_item_remove.destroy();
                this.context_menu_item_remove = null;
            }
        }
    }
};

function IconApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

IconApplet.prototype = {
    __proto__: Applet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        this._applet_icon_box = new St.Bin();
        this.actor.add(this._applet_icon_box, { y_align: St.Align.MIDDLE, y_fill: false });
        this.__icon_type = null;
        this.__icon_name = null;
    },

    set_applet_icon_name: function (icon_name) {
        if (this._scaleMode) {
            this._applet_icon = new St.Icon({icon_name: icon_name, icon_size: this._panelHeight * COLOR_ICON_HEIGHT_FACTOR,
                                            icon_type: St.IconType.FULLCOLOR, reactive: true, track_hover: true, style_class: 'applet-icon' });
        } else {
            this._applet_icon = new St.Icon({icon_name: icon_name, icon_size: 22, icon_type: St.IconType.FULLCOLOR, reactive: true, track_hover: true, style_class: 'applet-icon' });
        }
        this._applet_icon_box.child = this._applet_icon;
        this.__icon_type = St.IconType.FULLCOLOR;
        this.__icon_name = icon_name;
    },

    set_applet_icon_symbolic_name: function (icon_name) {
        if (this._scaleMode) {
            let height = (this._panelHeight / DEFAULT_PANEL_HEIGHT) * PANEL_SYMBOLIC_ICON_DEFAULT_HEIGHT;
            this._applet_icon = new St.Icon({icon_name: icon_name, icon_size: height, icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        } else {
            this._applet_icon = new St.Icon({icon_name: icon_name, icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        }
        this._applet_icon_box.child = this._applet_icon;
        this.__icon_type = St.IconType.SYMBOLIC;
        this.__icon_name = icon_name;
    },

    set_applet_icon_path: function (icon_path) {
        if (this._applet_icon_box.child) this._applet_icon_box.child.destroy();

        if (icon_path){
            let file = Gio.file_new_for_path(icon_path);
            let icon_uri = file.get_uri();
            let square_size = 22;
            if (this._scaleMode) {
                square_size = Math.floor(this._panelHeight * COLOR_ICON_HEIGHT_FACTOR);
            }
            this._applet_icon = St.TextureCache.get_default().load_uri_async(icon_uri, square_size, square_size);
            this._applet_icon_box.child = this._applet_icon;
        }
        this.__icon_type = -1;
        this.__icon_name = icon_path;
    },

    on_panel_height_changed: function() {
        this._scaleMode = global.settings.get_boolean('panel-scale-text-icons') && global.settings.get_boolean('panel-resizable');
        if (this._applet_icon_box.child) {
            this._applet_icon_box.child.destroy();
        }
        switch (this.__icon_type) {
            case St.IconType.FULLCOLOR:
                this.set_applet_icon_name(this.__icon_name);
                break;
            case St.IconType.SYMBOLIC:
                this.set_applet_icon_symbolic_name(this.__icon_name);
                break;
            case -1:
                this.set_applet_icon_path(this.__icon_name);
                break;
            default:
                break;
        }
    }
};

function TextApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

TextApplet.prototype = {
    __proto__: Applet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        this._applet_label = new St.Label({ reactive: true, track_hover: true, style_class: 'applet-label'});
        this._label_height = (this._panelHeight / DEFAULT_PANEL_HEIGHT) * PANEL_FONT_DEFAULT_HEIGHT;
        this._applet_label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.actor.add(this._applet_label, { y_align: St.Align.MIDDLE, y_fill: false });    
    },

    set_applet_label: function (text) {
        this._applet_label.set_text(text);
    },
    
    on_applet_added_to_panel: function() {       
                        
    }
};

function TextIconApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

TextIconApplet.prototype = {
    __proto__: IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this._applet_label = new St.Label({ reactive: true, track_hover: true, style_class: 'applet-label'});
        this._label_height = (this._panelHeight / DEFAULT_PANEL_HEIGHT) * PANEL_FONT_DEFAULT_HEIGHT;
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
