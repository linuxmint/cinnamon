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

function Applet(orientation, panelHeight) {
    this._init(orientation, panelHeight);
}

Applet.prototype = {

    _init: function(orientation, panelHeight) {
        this.actor = new St.BoxLayout({ style_class: 'applet-box', reactive: true, track_hover: true });
        this._appletTooltip = new Tooltips.PanelItemTooltip(this, "", orientation);
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));  

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._appletContextMenu = new AppletContextMenu(this, orientation);
        this._menuManager.addMenu(this._appletContextMenu);     

        this.actor._applet = this; // Backlink to get the applet from its actor (handy when we want to know stuff about a particular applet within the panel)
        this.actor._delegate = this;
        this._order = 0; // Defined in gsettings, this is the order of the applet within a panel location. This value is set by Cinnamon when loading/listening_to gsettings.
        this._newOrder = null; //  Used when moving an applet
        this._panelLocation = null; // Backlink to the panel location our applet is in, set by Cinnamon.
        this._newPanelLocation = null; //  Used when moving an applet
        this._panelHeight = panelHeight ? panelHeight : 25;
        this._uuid = null; // Defined in gsettings, set by Cinnamon.
        this._hook = null; // Defined in metadata.json, set by appletManager
        this._dragging = false;                
        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
        this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));        

        this._scaleMode = false;
        this._appletTooltipText = "";
        this._scaleMode = global.settings.get_boolean('panel-scale-text-icons') && global.settings.get_boolean('panel-resizable');
        this.contextMenuItemRemove = null;
        this.contextMenuSeparator = null;

        this._setAppletReactivity();
        this._panelEditModeChangedId = global.settings.connect('changed::panel-edit-mode', Lang.bind(this, function() {
            this._setAppletReactivity();
            this.finalizeContextMenu();
        }));
	// Backward compatibility
	this._applet_context_menu = this._appletContextMenu;
    },
    
    _setAppletReactivity: function() {
        this._draggable.inhibit = !global.settings.get_boolean('panel-edit-mode');
    },

    _onDragBegin: function() {
        this._dragging = true;
        this._appletTooltip.hide();
        this._appletTooltip.preventShow = true;                
    },

    _onDragEnd: function() {
        this._dragging = false;
        this._appletTooltip.preventShow = false;            
    },

    _onDragCancelled: function() {
        this._dragging = false;
        this._appletTooltip.preventShow = false;        
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
            if (this._appletContextMenu.isOpen) {
                this._appletContextMenu.toggle(); 
            }
            this.onAppletClicked(event);
        }
        if (event.get_button()==3){            
            if (this._appletContextMenu._getMenuItems().length > 0) {
                this._appletContextMenu.toggle();
            }
        }
        return true;
    },

    setAppletTooltip: function (text) {
        this._appletTooltipText = text;
        this._appletTooltip.set_text(text);
    },

    onAppletClicked: function(event) {
        // Implemented by Applets
        // Backward compatibility
        if (this.on_applet_clicked) {
            this.on_applet_clicked(event);
            global.log("on_applet_clicked is deprecated. Use onAppletClicked instead");
        }
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
    onAppletRemovedFromPanel: function() {
        // dummy, for very simple applets
        // Backward compatibility
        if (this.on_applet_removed_from_panel) {
            this.on_applet_removed_from_panel();
            global.log("on_applet_removed_from_panel is deprecated. use onAppletRemovedFromPamel instead");
            }
    },

    // should only be called by appletManager
    _onAppletRemovedFromPanel: function() {
        global.settings.disconnect(this._panelEditModeChangedId);
        this.onAppletRemovedFromPanel();
    },

    setOrientation: function (orientation) {
        let menuItems = new Array();
        let oldMenuItems = this._appletContextMenu._getMenuItems();
        for (var i in oldMenuItems){
            if (oldMenuItems[i] instanceof MenuItem) { // in case some applets don't use the standards
                if (oldMenuItems[i] !== this.contextMenuSeparator && oldMenuItems[i] !== this.contextMenuItemRemove) {
                    menuItems.push(oldMenuItems[i].clone());
                }
            }
        }
        this._menuManager.removeMenu(this._appletContextMenu);
        
        this._appletTooltip.destroy();
        this._appletTooltip = new Tooltips.PanelItemTooltip(this, this._appletTooltipText, orientation);

        this._appletContextMenu.destroy();
        this._appletContextMenu = new AppletContextMenu(this, orientation);
        this._menuManager.addMenu(this._appletContextMenu);

        this.onOrientationChanged(orientation);
        
        if (this._appletContextMenu.numMenuItems == 0){ // Do not recreate the menu if the applet already handles it in onOrientationChanged
            for (var i in menuItems) this._appletContextMenu.addMenuItem(menuItems[i]);
        }

        this.finalizeContextMenu();
    },
    
    onOrientationChanged: function(event) {
        // Backward compatibility
        if (this.on_orientation_changed) {
            global.log("on_orientation_changed is deprecated. Use onOrientationChanged instead");
            this.on_orientation_changed(event);
        }
        // Implemented by Applets        
    },

    setPanelHeight: function (panelHeight) {
        if (panelHeight && panelHeight > 0) {
            this._panelHeight = panelHeight;
        }
        this.onPanelHeightChanged(panelHeight);
    },
    
    onPanelHeightChanged: function() {
        // Backward compatibility
        if (this.on_panel_height_changed) {
            global.log("on_panel_height_changed is deprecated. Use onPanelHeightChanged instead");
            this.on_panel_height_changed();
        }
        // Implemented by Applets
    },
    
    finalizeContextMenu: function () {
        // Add default context menus if we're in panel edit mode, ensure their removal if we're not
        let isEditMode = global.settings.get_boolean('panel-edit-mode');
        let items = this._appletContextMenu._getMenuItems();
        if (isEditMode && items.indexOf(this.contextMenuItemRemove) == -1) {
            this.contextMenuItemRemove = new MenuItem(_("Remove this applet"), Gtk.STOCK_REMOVE, Lang.bind(null, AppletManager._removeAppletFromPanel, this._uuid, this._appletId));
            this.contextMenuSeparator = new PopupMenu.PopupSeparatorMenuItem();
            if (this._appletContextMenu._getMenuItems().length > 0) {
                this._appletContextMenu.addMenuItem(this.contextMenuSeparator);
            }
            this._appletContextMenu.addMenuItem(this.contextMenuItemRemove);
        } else {
            if (items.indexOf(this.contextMenuSeparator) != -1) {
                this.contextMenuSeparator.destroy();
                this.contextMenuSeparator = null;
            }
            if (items.indexOf(this.contextMenuItemRemove) != -1) {
                this.contextMenuItemRemove.destroy();
                this.contextMenuItemRemove = null;
            }
        }
    },
    // Backward compatibility
    set_applet_tooltip: function (text) {
        global.log("set_applet_tooltip is deprecated. Use setAppletTooltip instead");
        this.setAppletTooltip(text);
    }
};

function IconApplet(orientation, panelHeight) {
    this._init(orientation, panelHeight);
}

IconApplet.prototype = {
    __proto__: Applet.prototype,

    _init: function(orientation, panelHeight) {
        Applet.prototype._init.call(this, orientation, panelHeight);
        this._appletIconBox = new St.Bin();
        this.actor.add(this._appletIconBox, { y_align: St.Align.MIDDLE, y_fill: false });
        this.__iconType = null;
        this.__iconName = null;
    },

    setAppletIconName: function (iconName) {
        if (this._scaleMode) {
            this._appletIcon = new St.Icon({icon_name: iconName, icon_size: this._panelHeight * COLOR_ICON_HEIGHT_FACTOR,
                                            icon_type: St.IconType.FULLCOLOR, reactive: true, track_hover: true, style_class: 'applet-icon' });
        } else {
            this._appletIcon = new St.Icon({icon_name: iconName, icon_size: 22, icon_type: St.IconType.FULLCOLOR, reactive: true, track_hover: true, style_class: 'applet-icon' });
        }
        this._appletIconBox.child = this._appletIcon;
        this.__iconType = St.IconType.FULLCOLOR;
        this.__iconName = iconName;
    },

    setAppletIconSymbolicName: function (iconName) {
        if (this._scaleMode) {
            let height = (this._panelHeight / DEFAULT_PANEL_HEIGHT) * PANEL_SYMBOLIC_ICON_DEFAULT_HEIGHT;
            this._appletIcon = new St.Icon({icon_name: iconName, icon_size: height, icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        } else {
            this._appletIcon = new St.Icon({icon_name: iconName, icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        }
        this._appletIconBox.child = this._appletIcon;
        this.__iconType = St.IconType.SYMBOLIC;
        this.__iconName = iconName;
    },

    setAppletIconPath: function (iconPath) {
        if (this._appletIconBox.child) this._appletIconBox.child.destroy();

        if (iconPath){
            let file = Gio.file_new_for_path(iconPath);
            let icon_uri = file.get_uri();
            let square_size = 22;
            if (this._scaleMode) {
                square_size = Math.floor(this._panelHeight * COLOR_ICON_HEIGHT_FACTOR);
            }
            this._appletIcon = St.TextureCache.get_default().load_uri_async(icon_uri, square_size, square_size);
            this._appletIconBox.child = this._appletIcon;
        }
        this.__iconType = -1;
        this.__iconName = iconPath;
    },

    onPanelHeightChanged: function() {
        this._scaleMode = global.settings.get_boolean('panel-scale-text-icons') && global.settings.get_boolean('panel-resizable');
        if (this._appletIconBox.child) {
            this._appletIconBox.child.destroy();
        }
        switch (this.__iconType) {
            case St.IconType.FULLCOLOR:
                this.setAppletIconName(this.__iconName);
                break;
            case St.IconType.SYMBOLIC:
                this.setAppletIconSymbolicName(this.__iconName);
                break;
            case -1:
                this.setAppletIconPath(this.__iconName);
                break;
            default:
                break;
        }
    },

    // Backward compatibility
    set_applet_icon_name: function(icon_name) {
        global.log("set_applet_icon_name is deprecated. Use setAppletIconName instead");
        this.setAppletIconName(icon_name);
    },

    set_applet_icon_symbolic_name: function (icon_name) {
        global.log("set_applet_icon_symbolic_name is deprecated. Use setAppletIconSymbolicName instead");
        this.setAppletIconSymbolicName(icon_name);
    },

    set_applet_icon_path: function (icon_path) {
        global.log("set_applet_icon_path is deprecated. Use setAppletIconPath instead");
        this.setAppletIconPath(icon_path);
    }
};

function TextApplet(orientation, panelHeight) {
    this._init(orientation, panelHeight);
}

TextApplet.prototype = {
    __proto__: Applet.prototype,

    _init: function(orientation, panelHeight) {
        Applet.prototype._init.call(this, orientation, panelHeight);
        this._appletLabel = new St.Label({ reactive: true, track_hover: true, style_class: 'applet-label'});
        this._label_height = (this._panelHeight / DEFAULT_PANEL_HEIGHT) * PANEL_FONT_DEFAULT_HEIGHT;
        this._appletLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.actor.add(this._appletLabel, { y_align: St.Align.MIDDLE, y_fill: false });    
    },

    setAppletLabel: function (text) {
        this._appletLabel.clutter_text.set_text(text);
    },

    // Backward compatibility
    set_applet_label: function(text){
	global.log("set_applet_label is depreacted. Use setAppletIcon instead");
	this.setAppletLabel(text);
    }
};

function TextIconApplet(orientation, panelHeight) {
    this._init(orientation, panelHeight);
}

TextIconApplet.prototype = {
    __proto__: IconApplet.prototype,

    _init: function(orientation, panelHeight) {
        IconApplet.prototype._init.call(this, orientation, panelHeight);
        this._appletLabel = new St.Label({ reactive: true, track_hover: true, style_class: 'applet-label'});
        this._label_height = (this._panelHeight / DEFAULT_PANEL_HEIGHT) * PANEL_FONT_DEFAULT_HEIGHT;
        this._appletLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;     
        this.actor.add(this._appletLabel, { y_align: St.Align.MIDDLE, y_fill: false });
    },

    setAppletLabel: function (text) {
        this._appletLabel.clutter_text.set_text(text);
    },

    hideAppletIcon: function () {
        this._appletIconBox.child = null;
    },

    // Backward compatibility
    hide_applet_icon: function () {
	global.log("hide_applet_icon is deprecated. Use hideAppletIcon instead");
	this.hideAppletIcon();
    },
    set_applet_label: function(text){
	global.log("set_applet_label is depreacted. Use setAppletIcon instead");
	this.setAppletLabel(text);
    }
};
