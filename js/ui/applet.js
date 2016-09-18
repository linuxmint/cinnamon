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
const DEFAULT_ICON_HEIGHT = 22;
const FALLBACK_ICON_HEIGHT = 22;

const DisplayLayout = {  // the panel layout that an applet is suitable for
    VERTICAL: 'vertical',
    HORIZONTAL: 'horizontal',
    BOTH: 'both'
}

/**
 * #MenuItem
 * @short_description: Deprecated. Use #PopupMenu.PopupIconMenuItem instead.
 */
function MenuItem(label, icon, callback) {
    this.__proto__ = PopupMenu.PopupIconMenuItem.prototype;
    PopupMenu.PopupIconMenuItem.prototype._init.call(this, label, icon, St.IconType.SYMBOLIC);
    this.connect('activate', callback);
}

/**
 * #AppletContextMenu
 * @short_description: Applet right-click menu
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
 * @short_description: Applet left-click menu
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

    _onOrientationChanged: function(a, orientation) {
        this.setArrowSide(orientation);
    }
}

/**
 * #Applet
 * @short_description: Base applet class
 *
 * @actor (St.BoxLayout): Actor of the applet
 * @instance_id (int): Instance id of the applet
 * @_uuid (string): UUID of the applet. This is set by appletManager *after*
 * the applet is loaded.
 * @_panelLocation (St.BoxLayout): Panel sector containing the applet. This is
 * set by appletManager *after* the applet is loaded.
 * @panel (Panel.Panel): The panel object containing the applet. This is set by
 * appletManager *after* the applet is loaded.
 * @_meta (JSON): The metadata of the applet. This is set by appletManager
 * *after* the applet is loaded.
 * @_order (int): The order of the applet within a panel location This is set
 * by appletManager *after* the applet is loaded.
 * @_draggable (Dnd._Draggable): The draggable object of the applet
 * @_scaleMode (boolean): Whether the applet scales according to the panel size
 * @_applet_tooltip (Tooltips.PanelItemTooltip): The tooltip of the applet
 * @_menuManager (PopupMenu.PopupMenuManager): The menu manager of the applet
 * @_applet_context_menu (Applet.AppletContextMenu): The context menu of the applet
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

        this.actor = new St.BoxLayout({ style_class: 'applet-box',
                                        reactive: true,
                                        track_hover: true });

        this.setOrientation_internal(orientation);
    
        this._applet_tooltip = new Tooltips.PanelItemTooltip(this, "", orientation);                                        
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));  

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._applet_context_menu = new AppletContextMenu(this, orientation);
        this._menuManager.addMenu(this._applet_context_menu);     

        this.actor._applet = this; 	// Backlink to get the applet from its actor 
					//(handy when we want to know stuff about a particular applet within the panel)
        this.actor._delegate = this;
        this._order = 0; 		// Defined in gsettings, this is the order of the applet within a panel location. 
			 		// This value is set by Cinnamon when loading/listening_to gsettings.
        this._newOrder = null; 		//  Used when moving an applet
        this._panelLocation = null; 	// Backlink to the panel location our applet is in, set by Cinnamon.
        this._newPanelLocation = null; 	//  Used when moving an applet
        this._applet_enabled = true; 	// Whether the applet is enabled or not (if not it hides in the panel as if it wasn't there)
	this._orientation = orientation;  // orientation of the panel the applet is on  St.Side.TOP BOTTOM LEFT RIGHT

        this._panelHeight = panel_height ? panel_height : 25;
        this.instance_id = instance_id; // Needed by appletSettings
        this._uuid = null; 		// Defined in gsettings, set by Cinnamon.
        this._hook = null; 		// Defined in metadata.json, set by appletManager
        this._meta = null; 		// set by appletManager
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
        if (this._applet_enabled) {
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
        if (text != this._applet_tooltip_text) {
            this._applet_tooltip_text = text;
            this._applet_tooltip.set_text(text);
        }
    },

    /**
     * set_applet_enabled:
     * @enabled (boolean): whether this applet is enabled or not
     * 
     * Sets whether the applet is enabled or not. A disabled applet sets its
     * padding to 0px and doesn't react to clicks
     */
    set_applet_enabled: function (enabled) {
        if (enabled != this._applet_enabled) {
            this._applet_enabled = enabled;
            this.actor.visible = enabled;
        }
    },

    /**
     * on_applet_clicked:
     * @event (Clutter.Event): the event object
     * 
     * This function is called when the applet is clicked.
     * 
     * This is meant to be overridden in individual applets.
     */
    on_applet_clicked: function(event) {
        // Implemented by Applets        
    },


    /**
     * on_applet_instances_changed:
     *
     * This function is called when an applet *of the same uuid* is added or
     * removed from the panels. It is intended to assist in delegation of
     * responsibilities between duplicate applet instances.
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
     * setOrientation_internal:
     * @orientation (St.Side): the orientation
     *
     * Sets the orientation of the St.BoxLayout.
     *
     */
    setOrientation_internal: function (orientation) {

        if (orientation == St.Side.LEFT || orientation == St.Side.RIGHT)
        {
            this.actor.add_style_class_name('vertical');
            this.actor.set_important(true);
            this.actor.set_y_align(Clutter.ActorAlign.FILL);
            this.actor.set_y_expand(true);
            this.actor.set_x_align(Clutter.ActorAlign.CENTER);  // making this FILL also aligns to start
            this.actor.set_x_expand(true);
        }
        else {
            this.actor.remove_style_class_name('vertical');
            this.actor.set_y_align(Clutter.ActorAlign.FILL);
            this.actor.set_y_expand(true);
            this.actor.set_x_align(Clutter.ActorAlign.CENTER);
            this.actor.set_x_expand(false);
        }
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

        this.setOrientation_internal(orientation);
        this.on_orientation_changed(orientation);
        this.emit("orientation-changed", orientation);
        this.finalizeContextMenu();
    },

    /**
     * #getDisplayLayout
     * @short_description: returns the default type of panel that an applet is suitable for.
     *                     intended to be overridden in individual applets
     */
    getDisplayLayout: function() {
        return DisplayLayout.HORIZONTAL;
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
            this.context_menu_item_remove = new PopupMenu.PopupIconMenuItem(_("Remove '%s'").format(_(this._meta.name)),
                   "edit-delete",
                   St.IconType.SYMBOLIC);
            this.context_menu_item_remove.connect('activate', Lang.bind(this, function() {
                AppletManager._removeAppletFromPanel(this._uuid, this.instance_id);
            }));
        }

        if (this.context_menu_item_about == null) {
            this.context_menu_item_about = new PopupMenu.PopupIconMenuItem(_("About..."),
                    "dialog-question",
                    St.IconType.SYMBOLIC);
            this.context_menu_item_about.connect('activate', Lang.bind(this, this.openAbout));
        }

        if (this.context_menu_separator == null) {
            this.context_menu_separator = new PopupMenu.PopupSeparatorMenuItem();
        }

        if (items.indexOf(this.context_menu_item_about) == -1) {
            this._applet_context_menu.addMenuItem(this.context_menu_item_about);
        }

        if (!this._meta["hide-configuration"] && GLib.file_test(this._meta["path"] + "/settings-schema.json", GLib.FileTest.EXISTS)) {
            if (this.context_menu_item_configure == null) {            
                this.context_menu_item_configure = new PopupMenu.PopupIconMenuItem(_("Configure..."),
                        "system-run",
                        St.IconType.SYMBOLIC);
                this.context_menu_item_configure.connect('activate', Lang.bind(this, this.configureApplet));
            }
            if (items.indexOf(this.context_menu_item_configure) == -1) {
                this._applet_context_menu.addMenuItem(this.context_menu_item_configure);
            }
        }

        if (items.indexOf(this.context_menu_item_remove) == -1) {
            this._applet_context_menu.addMenuItem(this.context_menu_item_remove);
        }
    },

    /**
     * highlight:
     * @highlight (boolean): whether to turn on or off
     *
     * Turns on/off the highlight of the applet
     */
    highlight: function(highlight) {
        this.actor.change_style_pseudo_class("highlight", highlight);
    },

    openAbout: function() {
        new ModalDialog.SpicesAboutDialog(this._meta, "applets");
    },

    configureApplet: function() {
        Util.spawnCommandLine("xlet-settings applet " + this._uuid + " " + this.instance_id);
    }
};
Signals.addSignalMethods(Applet.prototype);

/**
 * #IconApplet:
 * @short_description: Applet with icon
 *
 * @_applet_icon (St.Icon): Actor of the icon
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

	this._applet_icon_box = new St.Bin(); // https://developer.gnome.org/st/stable/StBin.htm

        this._applet_icon_box.set_fill(true,true);
        this._applet_icon_box.set_alignment(St.Align.MIDDLE,St.Align.MIDDLE);
        this.actor.add(this._applet_icon_box);
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
        this._ensureIcon()

        this._applet_icon.set_icon_name(icon_name);
        this._applet_icon.set_icon_type(St.IconType.FULLCOLOR);
        this._setStyle();
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
        this._ensureIcon()

        this._applet_icon.set_icon_name(icon_name);
        this._applet_icon.set_icon_type(St.IconType.SYMBOLIC);
        this._setStyle();
    },

    /**
     * set_applet_icon_path:
     * @icon_path (string): path of the icon
     * 
     * Sets the icon of the applet to the image file at @icon_path
     * 
     * The icon will be full color
     */
    set_applet_icon_path: function (icon_path) {
        this._ensureIcon()

        try {
            let file = Gio.file_new_for_path(icon_path);
            this._applet_icon.set_gicon(new Gio.FileIcon({ file: file }));
            this._applet_icon.set_icon_type(St.IconType.FULLCOLOR);
            this._setStyle();
        } catch (e) {
            global.log(e);
        }
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
        this._ensureIcon()

        try {
            let file = Gio.file_new_for_path(icon_path);
            this._applet_icon.set_gicon(new Gio.FileIcon({ file: file }));
            this._applet_icon.set_icon_type(St.IconType.SYMBOLIC);
            this._setStyle();
        } catch (e) {
            global.log(e);
        }
    },

    _ensureIcon: function() {
        if (!this._applet_icon)
            this._applet_icon = new St.Icon({ reactive: true, track_hover: true, style_class: 'applet-icon'});

        this._applet_icon_box.set_child(this._applet_icon);
    },

    _setStyle: function() {

        let symb_scaleup 	= ((this._panelHeight / DEFAULT_PANEL_HEIGHT) * PANEL_SYMBOLIC_ICON_DEFAULT_HEIGHT) / global.ui_scale;
        let fullcolor_scaleup 	= this._panelHeight * COLOR_ICON_HEIGHT_FACTOR / global.ui_scale;
        let icon_type 		= this._applet_icon.get_icon_type();

        switch (icon_type) {
            case St.IconType.FULLCOLOR:
            this._applet_icon.set_icon_size(this._scaleMode ?
                                            fullcolor_scaleup :
                                            DEFAULT_ICON_HEIGHT);
            this._applet_icon.set_style_class_name('applet-icon');
            break;
            case St.IconType.SYMBOLIC:
            this._applet_icon.set_icon_size(this._scaleMode ?
                                            symb_scaleup :
                                            -1);
            this._applet_icon.set_style_class_name('system-status-icon');
            break;
            default:
            this._applet_icon.set_icon_size(this._scaleMode ?
                                            symb_scaleup :
                                            -1);
                                            this._applet_icon.set_style_class_name('system-status-icon');
        }
//        if (this._orientation == St.Side.LEFT || this._orientation == St.Side.RIGHT)
//        {
//            let ph = this._panelHeight;   
//            this.actor.set_clip(0, 0, ph, ph);  // ensure no visible bleeding of the allocation box 
                                                  // beyond the panel,  e.g. on hover
//        }


    },

    on_panel_height_changed: function() {
        this._scaleMode = AppletManager.enabledAppletDefinitions.idMap[this.instance_id].panel.scaleMode;
        if (this._applet_icon)
            this._setStyle();
    }
};

/**
 * #TextApplet:
 * @short_description: Applet with label
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
     *
     * Note that suitability for display in a vertical panel is handled by having applets declare
     * they work OK, handled elsewhere
     */
    _init: function(orientation, panel_height, instance_id) {
        Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        this._applet_label = new St.Label({ reactive: true, 
                                            track_hover: true, 
                                            style_class: 'applet-label'});
        this._applet_label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.actor.add(this._applet_label, { y_align: St.Align.MIDDLE, 
                                             y_fill: false });
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
 * @short_description: Applet with icon and label
 * @_applet_label (St.Label): Label of the applet
 *
 * Applet that displays an icon and a text. The icon is on the left of the text
 * 
 * Inherits: Applet.IconApplet
 * Note that suitability for display in a vertical panel is handled by having applets declare
 * they work OK, handled elsewhere
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
        this._applet_label = new St.Label({ reactive: true, 
                                            track_hover: true, 
                                            style_class: 'applet-label'});
        this._applet_label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this.actor.add(this._applet_label, { y_align: St.Align.MIDDLE, 
                                             y_fill: false });
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
     * set_applet_enabled:
     * @enabled (boolean): whether this applet is enabled or not
     * 
     * Sets whether the applet is enabled or not. A disabled applet sets its
     * padding to 0px and doesn't react to clicks
     */
    set_applet_enabled: function (enabled) {
        if (enabled != this._applet_enabled) {
            this._applet_enabled = enabled;
            this.actor.visible = enabled;
            if (this._applet_icon) {
                this._applet_icon.visible = enabled;
            }
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
