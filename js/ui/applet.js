const St = imports.gi.St;
const Lang = imports.lang;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
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
const ModalDialog = imports.ui.modalDialog;
const Signals = imports.signals;

const COLOR_ICON_HEIGHT_FACTOR = .875;  // Panel height factor for normal color icons
const PANEL_FONT_DEFAULT_HEIGHT = 11.5; // px
const PANEL_SYMBOLIC_ICON_DEFAULT_HEIGHT = 1.14 * PANEL_FONT_DEFAULT_HEIGHT; // ems conversion
const DEFAULT_PANEL_HEIGHT = 25;
const FALLBACK_ICON_HEIGHT = 22;

/**
 * #MenuItem
 * @_text (string): Text to be displayed in the menu item
 * @_icon (string): Name of icon to be displayed in the menu item
 * @_callback (Function): Callback function when the menu item is clicked
 * @icon (St.Icon): Icon of the menu item
 * 
 * A menu item that contains an icon, a text and responds to clicks
 * 
 * Inherits: PopupMenu.PopupBaseMenuItem
 */
function MenuItem(label, icon, callback) {
    this._init(label, icon, callback);
}

MenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    /**
     * _init:
     * @text (string): text to be displayed in the menu item
     * @icon (string): name of icon to be displayed in the menu item
     * @callback (Function): callback function to be called when the menu item is clicked
     * 
     * Constructor function
     */
    _init: function(text, icon, callback) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        
        this._text = text;
        this._icon = icon;
        this._callback = callback;

        let table = new St.Table({ homogeneous: false,
                                      reactive: true });

        this.icon = new St.Icon({ icon_name: icon,
                              icon_type: St.IconType.SYMBOLIC,
                              style_class: 'popup-menu-icon' });

        table.add(this.icon,
                  {row: 0, col: 0, col_span: 1, x_expand: false, x_align: St.Align.START});

        this.label = new St.Label({ text: text });
        this.label.set_margin_left(6.0)
        table.add(this.label,
                  {row: 0, col: 1, col_span: 1, x_align: St.Align.START});

        this.addActor(table, { expand: true, span: 1, align: St.Align.START});

        this.connect('activate', callback);
    },
    
    /**
     * clone:
     * 
     * Clones the menu item
     * 
     * Returns (MenuItem): a clone of this menu item
     */
    clone: function(){
        return new MenuItem(this._text, this._icon, this._callback);
    }
};

/**
 * #AppletContextMenu
 * 
 * A context menu (right-click menu) to be used by an applet
 * 
 * Inherits: PopupMenu.PopupMenu
 */
function AppletContextMenu(launcher, orientation) {
    this._init(launcher, orientation);
}

AppletContextMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    /**
     * _init:
     * @launcher (Applet.Applet): The applet that contains the context menu
     * @orientation (St.Side): The orientation of the applet
     * 
     * Constructor function
     */
    _init: function(launcher, orientation) {    
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();                    
        launcher.connect("orientation-changed", Lang.bind(this, function(a, orientation) {
            this.setArrowSide(orientation);
        }))
    }    
};

/**
 * #AppletPopupMenu:
 * 
 * A popupmenu menu (left-click menu) to be used by an applet
 * 
 * Inherits: PopupMenu.PopupMenu
 */
function AppletPopupMenu(launcher, orientation) {
    this._init(launcher, orientation);
}

AppletPopupMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,

    /**
     * _init:
     * @launcher (Applet.Applet): The applet that contains the context menu
     * @orientation (St.Side): The orientation of the applet
     * 
     * Constructor function
     */
    _init: function(launcher, orientation) {
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
        this.launcher = launcher;
        if (launcher instanceof Applet)
            launcher.connect("orientation-changed", Lang.bind(this, this._onOrientationChanged));
        else if (launcher._applet)
            launcher._applet.connect("orientation-changed", Lang.bind(this, this._onOrientationChanged));
    },

    /**
     * setMaxHeight:
     * 
     * Sets the maximum height of the monitor so that
     * it does not expand pass the monitor when it has
     * too many children
     */
    setMaxHeight: function() {
        let [x, y] = this.launcher.actor.get_transformed_position();

        let i = 0;
        let monitor;
        for (; i < global.screen.get_n_monitors(); i++) {
            monitor = global.screen.get_monitor_geometry(i);
            if (x >= monitor.x && x < monitor.x + monitor.width &&
                x >= monitor.y && y < monitor.y + monitor.height) {
                break;
            }
        }

        let maxHeight = monitor.height - this.actor.get_theme_node().get_length('-boxpointer-gap');

        let panels = Main.panelManager.getPanelsInMonitor(i);
        for (let j in panels) {
            maxHeight -= panels[j].actor.height;
        }

        this.actor.style = ('max-height: ' + maxHeight / global.ui_scale + 'px;');
    },

    _onOrientationChanged: function(a, orientation) {
        this.setArrowSide(orientation);
    }
}

/**
 * #Applet
 * @actor (St.BoxLayout): Actor of the applet
 * @_uuid (string): UUID of the applet
 * @instance_id (int): Instance id of the applet
 * @_panelLocation (St.BoxLayout): Panel sector containing the applet
 * @_order (int): The order of the applet within a panel location
 * @_draggable (DND._Draggable): The draggable object of the applet
 * @_scaleMode (boolean): Whether the applet scales according to the panel size
 * @_applet_tooltip (Tooltips.PanelItemTooltip): The tooltip of the applet
 * @_menuManager (PopupMenu.PopupMenuManager): The menu manager of the applet
 * @_applet_context_menu (AppletContextMenu): The context menu of the applet
 * @_applet_tooltip_text (string): Text of the tooltip
 * 
 * Base applet class that other applets can inherit
 */
function Applet(orientation, panelHeight, instance_id) {
    this._init(orientation, panelHeight, instance_id);
}

Applet.prototype = {

    /**
     * _init:
     * @orientation (St.Side): orientation of the applet; Orientation of panel containing the actor
     * @panelHeight (int): height of the panel containing the applet
     * @instance_id (int): instance id of the applet
     */
    _init: function(orientation, panel_height, instance_id) {
        this.actor = new St.BoxLayout({ style_class: 'applet-box', reactive: true, track_hover: true });        
        this._applet_tooltip = new Tooltips.PanelItemTooltip(this, "", orientation);                                        
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));  

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
        this._meta = null; // set by appletManager
        this._dragging = false;                
        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
    	this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));        

        try {
            this._scaleMode = AppletManager.enabledAppletDefinitions.idMap[instance_id].panel.scaleMode;
        } catch (e) {
            // Sometimes applets are naughty and don't pass us our instance_id. In that case, we just find the first non-empty panel and pretend we are on it.
            for (let i in Main.panelManager.panels) {
                this._scaleMode = true;
                if (Main.panelManager.panels[i]) {
                    this._scaleMode = Main.panelManager.panels[i].scaleMode;
                }
            }
        }
        this._applet_tooltip_text = "";

        this.context_menu_item_remove = null;
        this.context_menu_separator = null;

        this._setAppletReactivity();
        this._panelEditModeChangedId = global.settings.connect('changed::panel-edit-mode', Lang.bind(this, function() {
            this._setAppletReactivity();            
        }));
    },

    /* FIXME:  This makes no sense - inhibit flag should = panel edit mode, right?
     *         Needs fixed in dnd.js also, it expects this backwards logic right now
     */

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
        let clone = new Clutter.Clone({ source: this.actor });
        clone.width = this.actor.width;
        clone.height = this.actor.height;
        return clone;
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.actor;
    },

    _onButtonPressEvent: function (actor, event) {
        if (event.get_button() == 1) {
            if (!this._draggable.inhibit) {
                return false;
            } else {
                if (this._applet_context_menu.isOpen) {
                    this._applet_context_menu.toggle();
                }
                this.on_applet_clicked(event);
            }
        }
        if (event.get_button()==3){            
            if (this._applet_context_menu._getMenuItems().length > 0) {
                this._applet_context_menu.toggle();			
            }
        }
        return true;
    },

    /**
     * set_applet_tooltip:
     * @text (string): the tooltip text to be set
     * 
     * Sets the tooltip of the applet
     */
    set_applet_tooltip: function (text) {
        this._applet_tooltip_text = text;
        this._applet_tooltip.set_text(text);
    },

    /**
     * on_applet_clicked:
     * @event (Clutter.Event): the event object
     * 
     * This function is called when the applet is clicked.
     * 
     * This is meant to be overriden in individual applets.
     */
    on_applet_clicked: function(event) {
        // Implemented by Applets        
    },


    /**
     * on_applet_instances_changed:
     *
     * This function is called when an applet _of the same uuid_
     * is added or removed from the panels.  It is intended to
     * assist in delegation of responsibilities between duplicate
     * applet instances.
     * 
     * This is meant to be overridden in individual applets
     */
    on_applet_instances_changed: function() {

    },

    on_applet_added_to_panel_internal: function(userEnabled) {
        if (userEnabled) {
            Mainloop.timeout_add(300, Lang.bind(this, function() {
                let [x, y] = this.actor.get_transformed_position();
                let [w, h] = this.actor.get_transformed_size();
                let flashspot = new Flashspot.Flashspot({ x : x, y : y, width: w, height: h});
                flashspot.fire();
                return false;
            }));
        }

        this.on_applet_added_to_panel(userEnabled);

        Main.AppletManager.callAppletInstancesChanged(this._uuid);
    },

    /**
     * on_applet_added_to_panel:
     * 
     * This function is called by appletManager when the applet is added to the panel.
     * 
     * This is meant to be overridden in individual applets.
     */
    on_applet_added_to_panel: function(userEnabled) {
    },

    /**
     * on_applet_removed_from_panel:
     * 
     * This function is called by appletManager when the applet is removed from the panel.
     * 
     * This is meant to be overridden in individual applets.
     */
    on_applet_removed_from_panel: function() {
    },

    // should only be called by appletManager
    _onAppletRemovedFromPanel: function() {
        global.settings.disconnect(this._panelEditModeChangedId);
        this.on_applet_removed_from_panel();

        Main.AppletManager.callAppletInstancesChanged(this._uuid);
    },

    /**
     * setOrientation:
     * @orientation (St.Side): the orientation
     * 
     * Sets the orientation of the applet.
     * 
     * This function should only be called by appletManager
     */
    setOrientation: function (orientation) {
        // let menuItems = new Array();
        // let oldMenuItems = this._applet_context_menu._getMenuItems();
        // for (var i in oldMenuItems){
        //     if (oldMenuItems[i] instanceof MenuItem) { // in case some applets don't use the standards
        //         if (oldMenuItems[i] !== this.context_menu_separator && oldMenuItems[i] !== this.context_menu_item_remove) {
        //             menuItems.push(oldMenuItems[i].clone());
        //         }
        //     }
        // }
        // this._menuManager.removeMenu(this._applet_context_menu);
        
        // this._applet_tooltip.destroy();
        // this._applet_tooltip = new Tooltips.PanelItemTooltip(this, this._applet_tooltip_text, orientation);

        // this._applet_context_menu.destroy();
        // this._applet_context_menu = new AppletContextMenu(this, orientation);
        // this._menuManager.addMenu(this._applet_context_menu);

        this.on_orientation_changed(orientation);
        this.emit("orientation-changed", orientation);
        
        // if (this._applet_context_menu.numMenuItems == 0){ // Do not recreate the menu if the applet already handles it in on_orientation_changed
        //     for (var i in menuItems) this._applet_context_menu.addMenuItem(menuItems[i]);
        // }

        this.finalizeContextMenu();
    },
    
    /**
     * on_orientation_changed:
     * @orientation (St.Side): new orientation of the applet
     * 
     * This function is called when the applet is changes orientation.
     * 
     * This is meant to be overridden in individual applets.
     */    
    on_orientation_changed: function(orientation) {
        // Implemented by Applets        
    },

    /**
     * setPanelHeight:
     * @panelHeight (int): panelHeight
     * 
     * Sets the panel height property of the applet.
     */
    setPanelHeight: function (panel_height) {
        if (panel_height && panel_height > 0) {
            this._panelHeight = panel_height;
        }
        this._scaleMode = AppletManager.enabledAppletDefinitions.idMap[this.instance_id].panel.scaleMode;
        this.on_panel_height_changed();
    },
    
    /**
     * on_panel_height_changed:
     * 
     * This function is called when the panel containing the applet changes height
     * 
     * This is meant to be overridden in individual applets.
     */    
    on_panel_height_changed: function() {
        // Implemented byApplets
    },
    
    finalizeContextMenu: function () {
        // Add default context menus if we're in panel edit mode, ensure their removal if we're not       
        let items = this._applet_context_menu._getMenuItems();

        if (this.context_menu_item_remove == null) {
            this.context_menu_item_remove = new MenuItem(_("Remove this applet"), "edit-delete", Lang.bind(null, AppletManager._removeAppletFromPanel, this._uuid, this.instance_id));
        }

        if (this.context_menu_item_about == null) {
            this.context_menu_item_about = new MenuItem(_("About..."), "dialog-question", Lang.bind(this, this.openAbout));
        }

        if (this.context_menu_separator == null) {
            this.context_menu_separator = new PopupMenu.PopupSeparatorMenuItem();
        }

        if (this._applet_context_menu._getMenuItems().length > 0) {
            this._applet_context_menu.addMenuItem(this.context_menu_separator);
        }

        if (items.indexOf(this.context_menu_item_about) == -1) {
            this._applet_context_menu.addMenuItem(this.context_menu_item_about);
        }

        if (!this._meta["hide-configuration"] && GLib.file_test(this._meta["path"] + "/settings-schema.json", GLib.FileTest.EXISTS)) {     
            if (this.context_menu_item_configure == null) {            
                this.context_menu_item_configure = new MenuItem(_("Configure..."), "system-run", Lang.bind(this, function() {
                    Util.spawnCommandLine("cinnamon-settings applets " + this._uuid + " " + this.instance_id)
                }));
            }
            if (items.indexOf(this.context_menu_item_configure) == -1) {
                this._applet_context_menu.addMenuItem(this.context_menu_item_configure);
            }
        }

        if (items.indexOf(this.context_menu_item_remove) == -1) {
            this._applet_context_menu.addMenuItem(this.context_menu_item_remove);
        }
    },

    openAbout: function() {
        new ModalDialog.SpicesAboutDialog(this._meta, "applets");
    },
};
Signals.addSignalMethods(Applet.prototype);

/**
 * #IconApplet:
 * @_applet_icon (St.Icon): Actor of the icon
 * @__icon_type (St.IconType): Type of the icon (FULLCOLOR/SYMBOLIC)
 * @__icon_name (string): Name of icon
 * 
 * Applet that contains an icon
 * 
 * Inherits: Applet.Applet
 */
function IconApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

IconApplet.prototype = {
    __proto__: Applet.prototype,

    /**
     * _init:
     * @orientation (St.Side): orientation of the applet; Orientation of panel containing the actor
     * @panelHeight (int): height of the panel containing the applet
     * @instance_id (int): instance id of the applet
     */
    _init: function(orientation, panel_height, instance_id) {
        Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        this._applet_icon_box = new St.Bin();
        this.actor.add(this._applet_icon_box, { y_align: St.Align.MIDDLE, y_fill: false });
        this.__icon_type = null;
        this.__icon_name = null;
    },

    /**
     * set_applet_icon_name:
     * @icon_name (string): Name of the icon
     * 
     * Sets the icon of the applet to @icon_name.
     * 
     * The icon will be full color
     */
    set_applet_icon_name: function (icon_name) {
        if (this._applet_icon_box.child) this._applet_icon_box.child.destroy();
        this._applet_icon_box.child = null;
        if (this._scaleMode) {
            this._applet_icon = new St.Icon({icon_name: icon_name, icon_size: this._panelHeight * COLOR_ICON_HEIGHT_FACTOR / global.ui_scale,
                                            icon_type: St.IconType.FULLCOLOR, reactive: true, track_hover: true, style_class: 'applet-icon' });
        } else {
            this._applet_icon = new St.Icon({icon_name: icon_name, icon_size: FALLBACK_ICON_HEIGHT, icon_type: St.IconType.FULLCOLOR, reactive: true, track_hover: true, style_class: 'applet-icon' });
        }
        this._applet_icon_box.child = this._applet_icon;
        this.__icon_type = St.IconType.FULLCOLOR;
        this.__icon_name = icon_name;
    },

    /**
     * set_applet_icon_symbolic_name:
     * @icon_name (string): Name of the icon
     * 
     * Sets the icon of the applet to @icon_name.
     * 
     * The icon will be symbolic
     */
    set_applet_icon_symbolic_name: function (icon_name) {
        if (this._applet_icon_box.child) this._applet_icon_box.child.destroy();
        this._applet_icon_box.child = null;
        if (this._scaleMode) {
            let height = (this._panelHeight / DEFAULT_PANEL_HEIGHT) * PANEL_SYMBOLIC_ICON_DEFAULT_HEIGHT / global.ui_scale;
            this._applet_icon = new St.Icon({icon_name: icon_name, icon_size: height, icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        } else {
            this._applet_icon = new St.Icon({icon_name: icon_name, icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        }
        this._applet_icon_box.child = this._applet_icon;
        this.__icon_type = St.IconType.SYMBOLIC;
        this.__icon_name = icon_name;
    },

    /**
     * set_applet_icon:path:
     * @icon_path (string): path of the icon
     * 
     * Sets the icon of the applet to the image file at @icon_path
     * 
     * The icon will be full color
     */
    set_applet_icon_path: function (icon_path) {
        if (this._applet_icon_box.child) this._applet_icon_box.child.destroy();
        this._applet_icon_box.child = null;
        if (icon_path){
            let file = Gio.file_new_for_path(icon_path);
            let gicon = new Gio.FileIcon({ file: file });
            if (this._scaleMode) {
                this._applet_icon = new St.Icon({gicon: gicon, icon_size: this._panelHeight * COLOR_ICON_HEIGHT_FACTOR / global.ui_scale,
                                                icon_type: St.IconType.FULLCOLOR, reactive: true, track_hover: true, style_class: 'applet-icon' });
            } else {
                this._applet_icon = new St.Icon({gicon: gicon, icon_size: FALLBACK_ICON_HEIGHT, icon_type: St.IconType.FULLCOLOR, reactive: true, track_hover: true, style_class: 'applet-icon' });
            }
            this._applet_icon_box.child = this._applet_icon;
        }
        this.__icon_type = -1;
        this.__icon_name = icon_path;
    },

    /**
     * set_applet_icon_symbolic_path:
     * @icon_path (string): path of the icon
     * 
     * Sets the icon of the applet to the image file at @icon_path
     * 
     * The icon will be symbolic
     */
    set_applet_icon_symbolic_path: function(icon_path) {
        if (this._applet_icon_box.child) this._applet_icon_box.child.destroy();
        this._applet_icon_box.child = null;
        if (icon_path){
            let file = Gio.file_new_for_path(icon_path);
            let gicon = new Gio.FileIcon({ file: file });
            if (this._scaleMode) {
                let height = (this._panelHeight / DEFAULT_PANEL_HEIGHT) * PANEL_SYMBOLIC_ICON_DEFAULT_HEIGHT / global.ui_scale;
                this._applet_icon = new St.Icon({gicon: gicon, icon_size: height,
                                                icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
            } else {
                this._applet_icon = new St.Icon({gicon: gicon, icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
            }
            this._applet_icon_box.child = this._applet_icon;
        }
        this.__icon_type = -1;
        this.__icon_name = icon_path;
    },

    on_panel_height_changed: function() {
        this._scaleMode = AppletManager.enabledAppletDefinitions.idMap[this.instance_id].panel.scaleMode;
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

/**
 * #TextApplet:
 * @_applet_label (St.Label): Label of the applet
 *
 * Applet that displays a text
 * 
 * Inherits: Applet.Applet
 */
function TextApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

TextApplet.prototype = {
    __proto__: Applet.prototype,

    /**
     * _init:
     * @orientation (St.Side): orientation of the applet; Orientation of panel containing the actor
     * @panelHeight (int): height of the panel containing the applet
     * @instance_id (int): instance id of the applet
     */
    _init: function(orientation, panel_height, instance_id) {
        Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        this._applet_label = new St.Label({ reactive: true, track_hover: true, style_class: 'applet-label'});
        this._applet_label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.actor.add(this._applet_label, { y_align: St.Align.MIDDLE, y_fill: false });
        this.actor.set_label_actor(this._applet_label);
    },

    /**
     * set_applet_label:
     * @text (string): text to be displayed at the label
     * 
     * Sets the text of the actor to @text
     */
    set_applet_label: function (text) {
        this._applet_label.set_text(text);
    },
    
    on_applet_added_to_panel: function() {       
                        
    }
};

/**
 * #TextIconApplet:
 * @_applet_label (St.Label): Label of the applet
 *
 * Applet that displays an icon and a text. The icon is on the left of the text
 * 
 * Inherits: Applet.IconApplet
 */
function TextIconApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

TextIconApplet.prototype = {
    __proto__: IconApplet.prototype,

    /**
     * _init:
     * @orientation (St.Side): orientation of the applet; Orientation of panel containing the actor
     * @panelHeight (int): height of the panel containing the applet
     * @instance_id (int): instance id of the applet
     */
    _init: function(orientation, panel_height, instance_id) {
        IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this._applet_label = new St.Label({ reactive: true, track_hover: true, style_class: 'applet-label'});
        this._applet_label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.actor.add(this._applet_label, { y_align: St.Align.MIDDLE, y_fill: false });
        this.actor.set_label_actor(this._applet_label);
    },

    /**
     * set_applet_label:
     * @text (string): text to be displayed at the label
     * 
     * Sets the text of the actor to @text
     */
    set_applet_label: function (text) {
        this._applet_label.set_text(text);
        if ((text && text != "") && this._applet_icon_box.child) {
            this._applet_label.set_margin_left(6.0);
        }
        else {
            this._applet_label.set_margin_left(0);
        }
    },

    /**
     * hide_applet_icon:
     * 
     * Hides the icon of the applet
     */
    hide_applet_icon: function () {
        this._applet_icon_box.child = null;
    },
    
    on_applet_added_to_panel: function() {       
                                
    }
};
