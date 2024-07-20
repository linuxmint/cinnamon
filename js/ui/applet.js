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
const Util = imports.misc.util;
const Pango = imports.gi.Pango;
const Mainloop = imports.mainloop;
const Flashspot = imports.ui.flashspot;
const ModalDialog = imports.ui.modalDialog;
const Signals = imports.signals;
const Gettext = imports.gettext;
const Cinnamon = imports.gi.Cinnamon;
const SignalManager = imports.misc.signalManager;

var AllowedLayout = {  // the panel layout that an applet is suitable for
    VERTICAL: 'vertical',
    HORIZONTAL: 'horizontal',
    BOTH: 'both'
};

/**
 * #MenuItem
 * @short_description: Deprecated. Use #PopupMenu.PopupIconMenuItem instead.
 */
var MenuItem = class MenuItem extends PopupMenu.PopupIconMenuItem {
    _init(label, icon, callback) {
        super._init(label, icon, St.IconType.SYMBOLIC);
        this.connect('activate', callback);
    }
}

/**
 * #AppletContextMenu
 * @short_description: Applet right-click menu
 *
 * A context menu (right-click menu) to be used by an applet
 *
 * Inherits: PopupMenu.PopupMenu
 */
var AppletContextMenu = class AppletContextMenu extends PopupMenu.PopupMenu {
    _init(launcher, orientation) {
        super._init(launcher.actor, orientation);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
        this.connect("open-state-changed", Lang.bind(this, this._onOpenStateChanged, launcher.actor));
        launcher.connect("orientation-changed", Lang.bind(this, function(a, orientation) {
            this.setArrowSide(orientation);
        }));
    }

    _onOpenStateChanged(menu, open, sourceActor) {
        sourceActor.change_style_pseudo_class("checked", open);
    }
}

/**
 * #AppletPopupMenu:
 * @short_description: Applet left-click menu
 *
 * A popupmenu menu (left-click menu) to be used by an applet
 *
 * Inherits: PopupMenu.PopupMenu
 */
var AppletPopupMenu = class AppletPopupMenu extends PopupMenu.PopupMenu {

    /**
     * _init:
     * @launcher (Applet.Applet): The applet that contains the context menu
     * @orientation (St.Side): The orientation of the applet
     *
     * Constructor function
     */
    _init(launcher, orientation) {
        super._init(launcher.actor, orientation);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
        this.launcher = launcher;
        if (launcher instanceof Applet) {
            this.connect("open-state-changed", Lang.bind(this, this._onOpenStateChanged, launcher));
            launcher.connect("orientation-changed", Lang.bind(this, this._onOrientationChanged));
        } else if (launcher._applet) {
            launcher._applet.connect("orientation-changed", Lang.bind(this, this._onOrientationChanged));
        }
    }

    _onOrientationChanged(a, orientation) {
        this.setArrowSide(orientation);
    }

    _onOpenStateChanged(menu, open, sourceActor) {
        if (!sourceActor._applet_context_menu.isOpen)
            sourceActor.actor.change_style_pseudo_class("checked", open);
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
 * @_applet_tooltip (Tooltips.PanelItemTooltip): The tooltip of the applet
 * @_menuManager (PopupMenu.PopupMenuManager): The menu manager of the applet
 * @_applet_context_menu (Applet.AppletContextMenu): The context menu of the applet
 * @_applet_tooltip_text (string): Text of the tooltip
 * @_allowedLayout (Applet.AllowedLayout): The allowed layout of the applet. This
 * determines the type of panel an applet is allowed in. By default this is set
 * to Applet.AllowedLayout.HORIZONTAL
 *
 * Base applet class that other applets can inherit
 */
var Applet = class Applet {

    /**
     * _init:
     * @orientation (St.Side): orientation of the applet; Orientation of panel containing the actor
     * @panelHeight (int): height of the panel containing the applet
     * @instance_id (int): instance id of the applet
     */

    constructor() {
        return this._init.apply(this, arguments);
    }

    _init(orientation, panel_height, instance_id) {

        this.actor = new St.BoxLayout({ style_class: 'applet-box',
                                        reactive: true,
                                        track_hover: true });

        this._allowedLayout = AllowedLayout.HORIZONTAL;
        this.setOrientationInternal(orientation);

        this._applet_tooltip = new Tooltips.PanelItemTooltip(this, "", orientation);
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPressEvent));

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._applet_context_menu = new AppletContextMenu(this, orientation);
        this._menuManager.addMenu(this._applet_context_menu);

        this.actor._applet = this;  // Backlink to get the applet from its actor
                                    // (handy when we want to know stuff about a particular applet within the panel)
        this.actor._delegate = this;

        this.panel = null;
        this._order = 0;        // Defined in gsettings, this is the order of the applet within a panel location.
                                // This value is set by Cinnamon when loading/listening_to gsettings.
        this._newOrder = null;      //  Used when moving an applet
        this._panelLocation = null;     // Backlink to the panel location our applet is in, set by Cinnamon.
        this.locationLabel = 'right';
        this._newPanelId = null;  //  Used when moving an applet
        this._newPanelLocation = null;  //  Used when moving an applet
        this._applet_enabled = true;    // Whether the applet is enabled or not (if not it hides in the panel as if it wasn't there)
        this._orientation = orientation;  // orientation of the panel the applet is on  St.Side.TOP BOTTOM LEFT RIGHT
        this._lastIconType = St.IconType.FULLCOLOR;
        this._iconSize = null;

        this.instance_id = instance_id; // Needed by appletSettings
        this._uuid = null;      // Defined in gsettings, set by Cinnamon.
        this._meta = null;      // set by appletManager
        this._dragging = false;
        this._draggable = DND.makeDraggable(this.actor);
        this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
        this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));

        this._applet_tooltip_text = "";

        this.context_menu_item_remove = null;
        this.context_menu_separator = null;

        this._setAppletReactivity();
        this._panelEditModeChangedId = global.settings.connect('changed::panel-edit-mode', Lang.bind(this, function() {
            this._setAppletReactivity();
        }));

        // FIXME: Cinnamon should be providing a sandbox environment for extensions, and not depend on data passed
        // from the extension for basic state that we are already keeping track of in appletManager. Since applets
        // need icon sizes available immediately in their constructor, this has to stay for now.
        if (instance_id) {
            this._getPanelInfo(instance_id);
        } else {
            setTimeout(() => this._getPanelInfo(), 0);
        }
    }

    _addStyleClass(className){
        this.actor.add_style_class_name(className);
    }

    _getPanelInfo(instance_id) {
        if (!instance_id) instance_id = this.instance_id;
        let appletDefinition = AppletManager.getAppletDefinition({applet_id: instance_id});
        if (appletDefinition) {
            const panelIndex = Main.panelManager.panels.findIndex( panel => {
                return panel && (panel.panelId === appletDefinition.panelId);
            });
            if (panelIndex > -1) {
                let panel = Main.panelManager.panels[panelIndex];
                this.locationLabel = appletDefinition.location_label;
                this.panel = panel;
                this._uuid = appletDefinition.uuid;
            } else {
                global.logWarning(`[Applet] No panel found for ${instance_id}`);
            }
        } else {
            throw new Error(`[Applet] Unable to find definition for applet ${instance_id}`);
        }
    }

    /* FIXME:  This makes no sense - inhibit flag should = panel edit mode, right?
     *         Needs fixed in dnd.js also, it expects this backwards logic right now
     */

    _setAppletReactivity() {
        this._draggable.inhibit = !global.settings.get_boolean('panel-edit-mode');
    }

    _onDragBegin() {
        this._dragging = true;
        this._applet_tooltip.hide();
        this._applet_tooltip.preventShow = true;
        Main.panelManager.resetPanelDND();
    }

    _onDragEnd() {
        this._dragging = false;
        this._applet_tooltip.preventShow = false;
    }

    _onDragCancelled() {
        this._dragging = false;
        this._applet_tooltip.preventShow = false;
    }

    getDragActor() {
        let clone = new Clutter.Clone({ source: this.actor });
        clone.width = this.actor.width;
        clone.height = this.actor.height;
        return clone;
    }

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource() {
        return this.actor;
    }

    _onButtonPressEvent (actor, event) {
        if (!this._applet_enabled) {
            return false;
        }

        let button = event.get_button();
        if (button < 3) {
            if (!this._draggable.inhibit) {
                return false;
            } else {
                if (this._applet_context_menu.isOpen) {
                    this._applet_context_menu.toggle();
                }
            }
        }

        if (button === 1) {
            this.on_applet_clicked(event);
        } else if (button === 2) {
            this.on_applet_middle_clicked(event);
        } else if (button === 3) {
            if (this._applet_context_menu._getMenuItems().length > 0) {
                this._applet_context_menu.toggle();
            }
        }
        return true;
    }

    /**
     * set_applet_tooltip:
     * @text (string): the tooltip text to be set
     * @use_markup (boolean): parse the text as markup if true
     *
     * Sets the tooltip of the applet
     */
    set_applet_tooltip (text, use_markup=false) {
        if (text != this._applet_tooltip_text) {
            this._applet_tooltip_text = text;

            if (use_markup) {
                this._applet_tooltip.set_markup(text);
            } else {
                this._applet_tooltip.set_text(text);
            }
        }
        if (text === "") {
            this._applet_tooltip.hide();
        }
    }

    /**
     * set_applet_enabled:
     * @enabled (boolean): whether this applet is enabled or not
     *
     * Sets whether the applet is enabled or not. A disabled applet sets its
     * padding to 0px and doesn't react to clicks
     */
    set_applet_enabled (enabled) {
        if (enabled != this._applet_enabled) {
            this._applet_enabled = enabled;
            this.actor.visible = enabled;
        }
    }

    /**
     * on_applet_clicked:
     * @event (Clutter.Event): the event object
     *
     * This function is called when the applet is clicked.
     *
     * This is meant to be overridden in individual applets.
     */
    on_applet_clicked(event) {
        // Implemented by Applets
    }

    /**
     * on_applet_middle_clicked:
     * @event (Clutter.Event): the event object
     *
     * This function is called when the applet is clicked with the middle mouse button.
     *
     * This is meant to be overridden in individual applets.
     */
    on_applet_middle_clicked(event) {
        // Implemented by Applets
    }


    /**
     * on_applet_instances_changed:
     * @instance (Applet) the instance that was changed
     *
     * This function is called when an applet *of the same uuid* is added or
     * removed from the panels. It is intended to assist in delegation of
     * responsibilities between duplicate applet instances.
     *
     * Applets should not create any references to @instance, since that
     * could impede garbage collection.
     *
     * This is meant to be overridden in individual applets
     */
    on_applet_instances_changed() {

    }

    on_applet_added_to_panel_internal(userEnabled) {
        if (userEnabled) {
            Mainloop.timeout_add(300, Lang.bind(this, function() {
                let [x, y] = this.actor.get_transformed_position();
                let [w, h] = this.actor.get_transformed_size();
                let flashspot = new Flashspot.Flashspot({ x : x, y : y, width: w, height: h});
                flashspot.fire();
                return false;
            }));
        }

        this._panelSizeChangeId = this.panel.connect('size-changed', () => this.on_panel_height_changed_internal());
        this._panelIconSizeChangeId = this.panel.connect('icon-size-changed', () => this.on_panel_icon_size_changed_internal());
        this.on_applet_added_to_panel(userEnabled);

        Main.AppletManager.callAppletInstancesChanged(this._uuid, this);
    }

    /**
     * on_applet_added_to_panel:
     *
     * This function is called by appletManager when the applet is added to the panel.
     *
     * This is meant to be overridden in individual applets.
     */
    on_applet_added_to_panel(userEnabled) {
    }

    /**
     * on_applet_removed_from_panel:
     *
     * This function is called by appletManager when the applet is removed from the panel.
     *
     * This is meant to be overridden in individual applets.
     */
    on_applet_removed_from_panel(deleteConfig) {
    }

    /**
     * on_applet_reloaded:
     *
     * This function is called by appletManager when the applet is reloaded.
     *
     * This is meant to be overridden in individual applets.
     */
    on_applet_reloaded(deleteConfig) {
    }

    // should only be called by appletManager
    _onAppletRemovedFromPanel(deleteConfig) {
        global.settings.disconnect(this._panelEditModeChangedId);
        this.panel.disconnect(this._panelSizeChangeId);
        this.panel.disconnect(this._panelIconSizeChangeId);
        this.on_applet_removed_from_panel(deleteConfig);

        Main.AppletManager.callAppletInstancesChanged(this._uuid, this);
    }

    /**
     * setOrientationInternal:
     * @orientation (St.Side): the orientation
     *
     * Sets the orientation of the St.BoxLayout.
     *
     */
    setOrientationInternal (orientation) {
        if (orientation == St.Side.LEFT || orientation == St.Side.RIGHT) {
            this.actor.add_style_class_name('vertical');
            this.actor.set_important(true);
            this.actor.set_vertical(true);
            this.actor.set_x_expand(true);
        } else {
            this.actor.remove_style_class_name('vertical');
            this.actor.set_vertical(false);
        }
    }

    /**
     * setOrientation:
     * @orientation (St.Side): the orientation
     *
     * Sets the orientation of the applet.
     *
     * This function should only be called by appletManager
     */
    setOrientation (orientation) {
        this._orientation = orientation;
        this.setOrientationInternal(orientation);
        this.on_orientation_changed(orientation);
        this.emit("orientation-changed", orientation);
        this.finalizeContextMenu();

        if (typeof this.set_applet_label === 'function' && this._applet_label instanceof St.Label) {
            this.set_applet_label(this._applet_label.get_text());
        }

        // FIXME: This function will be called from AppletManager before the panel is
        // assigned. When the panel orientation changes, it becomes unavailable,
        // so we need to check for this.panel here.
        if (this.panel) this.on_panel_icon_size_changed_internal();
    }

    /**
     * setAllowedLayout:
     * @layout (AllowedLayout): the allowed layout
     *
     * Sets the layout allowed by the applet. Possible values are
     * AllowedLayout.HORIZONTAL, AllowedLayout.VERTICAL, and
     * AllowedLayout.BOTH.
     */
    setAllowedLayout (layout) {
        this._allowedLayout = layout;
    }

    /**
     * getAllowedLayout:
     *
     * Retrieves the type of layout an applet is allowed to have.
     *
     * Returns (Applet.AllowedLayout): The allowed layout of the applet
     */
    getAllowedLayout() {
        return this._allowedLayout;
    }

    /**
     * on_orientation_changed:
     * @orientation (St.Side): new orientation of the applet
     *
     * This function is called when the applet is changes orientation.
     *
     * This is meant to be overridden in individual applets.
     */
    on_orientation_changed(orientation) {
        // Implemented by Applets
    }

    getPanelIconSize(iconType = St.IconType.FULLCOLOR) {
        // If no panel, then the panel probably was added with pre-existing applet
        // definitions associated to it. This means there's no zone config, so return early.
        if (!this.panel) return;

        this._lastIconType = iconType;
        this._iconSize = this.panel.getPanelZoneIconSize(this.locationLabel, iconType);
        return this._iconSize;
    }

    /**
     * on_panel_height_changed_internal:
     *
     * This function is called when the panel containing the applet changes height
     */
    on_panel_height_changed_internal() {
        this.on_panel_height_changed();
    }

    /**
     * on_panel_height_changed:
     *
     * This function is called when the panel containing the applet changes height
     *
     * This is meant to be overridden in individual applets.
     */
    on_panel_height_changed() {
        // Implemented byApplets
    }

    on_panel_icon_size_changed_internal() {
        let size = this.panel.getPanelZoneIconSize(this.locationLabel, this._lastIconType);
        if (!this._iconSize || this._iconSize !== size) {
            this._iconSize = size;

            if (this._applet_icon) {
                this._applet_icon.set_icon_size(size);
            }

            this.on_panel_icon_size_changed(size);
        }
    }

    /**
     * on_panel_icon_size_changed:
     * @size (number): new icon size
     *
     * This function is called when the icon size preference for the panel zone
     * containing this applet is changed.
     *
     * This is meant to be overridden in individual applets.
     */
    on_panel_icon_size_changed() {
        // Implemented byApplets
    }

    confirmRemoveApplet (event) {
        if (Clutter.ModifierType.CONTROL_MASK & Cinnamon.get_event_state(event)) {
            AppletManager._removeAppletFromPanel(this._uuid, this.instance_id);
        } else {
            let dialog = new ModalDialog.ConfirmDialog(
                _("Are you sure you want to remove '%s'?").format(this._(this._meta.name)),
                () => AppletManager._removeAppletFromPanel(this._uuid, this.instance_id)
            );
            dialog.open();
        }
    }

    finalizeContextMenu () {

        // Add default context menus if we're in panel edit mode, ensure their removal if we're not
        let items = this._applet_context_menu._getMenuItems();

        if (this.context_menu_item_remove == null) {
            this.context_menu_item_remove = new PopupMenu.PopupIconMenuItem(_("Remove '%s'")
                .format(this._(this._meta.name)),
                   "edit-delete",
                   St.IconType.SYMBOLIC);
            this.context_menu_item_remove.connect('activate', (actor, event) => this.confirmRemoveApplet(event));
        }

        if (this.context_menu_item_about == null) {
            this.context_menu_item_about = new PopupMenu.PopupIconMenuItem(_("About..."),
                    "dialog-question",
                    St.IconType.SYMBOLIC);
            this.context_menu_item_about.connect('activate', Lang.bind(this, this.openAbout));
        }

        if (this.context_menu_separator == null && this._applet_context_menu._getMenuItems().length > 0) {
            this.context_menu_separator = new PopupMenu.PopupSeparatorMenuItem();
            this._applet_context_menu.addMenuItem(this.context_menu_separator);
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
    }

    // translation
    _(str) {
        // look into the text domain first
        let translated = Gettext.dgettext(this._uuid, str);

        // if it looks translated, return the translation of the domain
        if (translated !== str)
            return translated;
        // else, use the default cinnamon domain
        return _(str);
    }

    /**
     * highlight:
     * @highlight (boolean): whether to turn on or off
     *
     * Turns on/off the highlight of the applet
     */
    highlight(highlight) {
        this.actor.change_style_pseudo_class("highlight", highlight);
    }

    openAbout() {
        Util.spawnCommandLine("xlet-about-dialog applets " + this._uuid);
    }

    configureApplet(tab=0) {
        Util.spawnCommandLine("xlet-settings applet " + this._uuid + " -i " + this.instance_id + " -t " + tab);
    }

    get _panelHeight() {
        return this.panel.height;
    }

    get _scaleMode() {
        global.logWarning(`[Applet/${this._uuid}] Use of scaleMode is deprecated.`);
        return true;
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
var IconApplet = class IconApplet extends Applet {

    /**
     * _init:
     * @orientation (St.Side): orientation of the applet; Orientation of panel containing the actor
     * @panelHeight (int): height of the panel containing the applet
     * @instance_id (int): instance id of the applet
     */
    _init(orientation, panel_height, instance_id) {
        super._init(orientation, panel_height, instance_id);

        this._applet_icon_box = new St.Bin(); // https://developer.gnome.org/st/stable/StBin.htm

        this._applet_icon_box.set_fill(true,true);
        this._applet_icon_box.set_alignment(St.Align.MIDDLE,St.Align.MIDDLE);
        this.actor.add(this._applet_icon_box);
    }

    /**
     * set_applet_icon_name:
     * @icon_name (string): Name of the icon
     *
     * Sets the icon of the applet to @icon_name.
     *
     * The icon will be full color
     */
    set_applet_icon_name (icon_name) {
        this._ensureIcon();

        this._applet_icon.set_icon_name(icon_name);
        this._applet_icon.set_icon_type(St.IconType.FULLCOLOR);
        this._setStyle();
    }

    /**
     * set_applet_icon_symbolic_name:
     * @icon_name (string): Name of the icon
     *
     * Sets the icon of the applet to @icon_name.
     *
     * The icon will be symbolic
     */
    set_applet_icon_symbolic_name (icon_name) {
        this._ensureIcon();

        this._applet_icon.set_icon_name(icon_name);
        this._applet_icon.set_icon_type(St.IconType.SYMBOLIC);
        this._setStyle();
    }

    /**
     * set_applet_icon_path:
     * @icon_path (string): path of the icon
     *
     * Sets the icon of the applet to the image file at @icon_path
     *
     * The icon will be full color
     */
    set_applet_icon_path (icon_path) {
        this._ensureIcon();

        try {
            let file = Gio.file_new_for_path(icon_path);
            this._applet_icon.set_gicon(new Gio.FileIcon({ file: file }));
            this._applet_icon.set_icon_type(St.IconType.FULLCOLOR);
            this._setStyle();
        } catch (e) {
            global.log(e);
        }
    }

    /**
     * set_applet_icon_symbolic_path:
     * @icon_path (string): path of the icon
     *
     * Sets the icon of the applet to the image file at @icon_path
     *
     * The icon will be symbolic
     */
    set_applet_icon_symbolic_path(icon_path) {
        this._ensureIcon();

        try {
            let file = Gio.file_new_for_path(icon_path);
            this._applet_icon.set_gicon(new Gio.FileIcon({ file: file }));
            this._applet_icon.set_icon_type(St.IconType.SYMBOLIC);
            this._setStyle();
        } catch (e) {
            global.log(e);
        }
    }

    _ensureIcon() {
        if (!this._applet_icon || !(this._applet_icon instanceof St.Icon))
            this._applet_icon = new St.Icon({ reactive: true, track_hover: true, style_class: 'applet-icon'});

        this._applet_icon_box.set_child(this._applet_icon);
    }

    _setStyle() {
        let icon_type = this._applet_icon.get_icon_type();

        if (icon_type === St.IconType.FULLCOLOR) {
            this._applet_icon.set_icon_size(this.getPanelIconSize(St.IconType.FULLCOLOR));
            this._applet_icon.set_style_class_name('applet-icon');
        } else {
            this._applet_icon.set_icon_size(this.getPanelIconSize(St.IconType.SYMBOLIC));
            this._applet_icon.set_style_class_name('system-status-icon');
        }
    }

    on_panel_height_changed_internal() {
        if (this._applet_icon)
            this._setStyle();
        this.on_panel_height_changed();
    }
}

/**
 * #TextApplet:
 * @short_description: Applet with label
 * @_applet_label (St.Label): Label of the applet
 *
 * Applet that displays a text
 *
 * Inherits: Applet.Applet
 */
var TextApplet = class TextApplet extends Applet {

    /**
     * _init:
     * @orientation (St.Side): orientation of the applet; Orientation of panel containing the actor
     * @panelHeight (int): height of the panel containing the applet
     * @instance_id (int): instance id of the applet
     *
     * Note that suitability for display in a vertical panel is handled by having applets declare
     * they work OK, handled elsewhere
     */
    _init(orientation, panel_height, instance_id) {
        super._init(orientation, panel_height, instance_id);
        this._applet_label = new St.Label({ reactive: true,
                                            track_hover: true,
                                            style_class: 'applet-label'});
        this._applet_label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        this._layoutBin = new St.Bin();
        this._layoutBin.set_child(this._applet_label);

        this.actor.add(this._layoutBin, { y_align: St.Align.MIDDLE,
                                          y_fill: false });
        this.actor.set_label_actor(this._applet_label);
    }

    /**
     * set_applet_label:
     * @text (string): text to be displayed at the label
     *
     * Sets the text of the actor to @text
     */
    set_applet_label (text) {
        this._applet_label.set_text(text);
    }

    on_applet_added_to_panel() {
    }
}

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
var TextIconApplet = class TextIconApplet extends IconApplet {

    /**
     * _init:
     * @orientation (St.Side): orientation of the applet; Orientation of panel containing the actor
     * @panelHeight (int): height of the panel containing the applet
     * @instance_id (int): instance id of the applet
     */
    _init(orientation, panel_height, instance_id) {
        super._init(orientation, panel_height, instance_id);
        this._applet_label = new St.Label({ reactive: true,
                                            track_hover: true,
                                            style_class: 'applet-label'});
        this._applet_label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        this._layoutBin = new St.Bin();
        this._layoutBin.set_child(this._applet_label);

        this.actor.add(this._layoutBin, { y_align: St.Align.MIDDLE,
                                          y_fill: false });
        this.actor.set_label_actor(this._applet_label);

        this.show_label_in_vertical_panels = true;
    }

    /**
     * set_show_label_in_vertical_panels:
     * @show (boolean): whether to show the label in vertical panels
     *
     * Sets whether to show the label in vertical panels
     */
    set_show_label_in_vertical_panels (show) {
        this.show_label_in_vertical_panels = show;
    }

    /**
     * set_applet_label:
     * @text (string): text to be displayed at the label
     *
     * Sets the text of the actor to @text
     */
    set_applet_label (text) {
        this._applet_label.set_text(text);

        if ((this._orientation == St.Side.LEFT || this._orientation == St.Side.RIGHT) && (this.show_label_in_vertical_panels == false)) {
            // Hide the label in vertical panel for applets which don't support it
            this.hide_applet_label(true);
        }
        else {
            if (text == "") {
                // Hide empty labels
                this.hide_applet_label(true);
            }
            else {
                this.hide_applet_label(false);
            }
        }
    }

    /**
     * set_applet_enabled:
     * @enabled (boolean): whether this applet is enabled or not
     *
     * Sets whether the applet is enabled or not. A disabled applet sets its
     * padding to 0px and doesn't react to clicks
     */
    set_applet_enabled (enabled) {
        if (enabled != this._applet_enabled) {
            this._applet_enabled = enabled;
            this.actor.visible = enabled;
            if (this._applet_icon) {
                this._applet_icon.visible = enabled;
            }
        }
    }

    /**
     * hide_applet_label:
     * @hide (boolean): whether the applet label is hidden or not
     *
     * Sets whether the applets label is hidden or not. A convenience
     * function to hide applet labels when an applet is placed in a vertical
     * panel
     */
    hide_applet_label (hide) {
        if (hide) {
            this.hideLabel();
        } else {
            this.showLabel();
        }
    }
    /**
     * hideLabel:
     *
     * Hides the applet label
     */
    hideLabel () {
        this._applet_label.hide();
        this._layoutBin.hide();
    }
    /**
     * showLabel:
     *
     * Shows the applet label
     */
    showLabel () {
        this._applet_label.show();
        this._layoutBin.show();
    }
    /**
     * hide_applet_icon:
     *
     * Hides the icon of the applet
     */
    hide_applet_icon () {
        this._applet_icon_box.child = null;
    }

    on_applet_added_to_panel() {

    }
}

const ZONE_SIZE = 10;

/**
 * #PopupResizeHandler:
 * @short_description: Class that allows an applet to be resized using the mouse.
 * @inhibit_resizing (Boolean): Set to true to prevent resizing from starting.
 * @resizingInProgress (Boolean): True when resizing is in progress
 * 
 * Example usage:
 * ``` 
 *      this.menu = new Applet.AppletPopupMenu(this, this.orientation);
 *      this.settings.bind("popup-width", "popup_width");
 *      this.settings.bind("popup-height", "popup_height");
 * 
 *      this._resizer = new Applet.PopupResizeHandler(
 *              this.menu.actor,
 *              () => this.orientation,
 *              (w,h) => this._onBoxResized(w,h),
 *              () => this.popup_width * global.ui_scale,
 *              () => this.popup_height * global.ui_scale);
 *          
 *      ...
 * 
 *      _onBoxResized(width, height) {
 *          this.popup_width = Math.max(width / global.ui_scale, 300);
 *          this.popup_height = Math.max(height / global.ui_scale, 400);
 *          this.menu.actor.set_width(this.popup_width * global.ui_scale);
 *          this.menu.actor.set_height(this.popup_height * global.ui_scale);
 *      }
 * ```
 */
var PopupResizeHandler = class PopupResizeHandler {
    /**
     * constructor:
     * @actor (ClutterActor): The actor to be resized
     * @get_orientation (Function): Function that returns the current orientation of the applet. (St.Side)
     * @resized_callback (Function): Function that is called while resizing is in progress with the new
     * width and height as parameters. This function should actually change the applet size. This is
     * also called once when resizing has ended (resizingInProgress == false) so that the applet
     * can store the final size instead of doing so continuously whilst resizing is in progress.
     * @get_user_width (Function): Function that returns the current applet width. This function is not
     * called while resizing is in progress so it only has to return the correct width when resizing is
     * not in progress. Note: This value does not necessarily have to be the applet width. It could
     * be the width of a container inside the applet used for sizing the applet.
     * @get_user_height (Function): As get_user_width but for height
     */
    constructor(actor, get_orientation, resized_callback, get_user_width, get_user_height) {
        this.actor = actor;
        this._get_orientation = get_orientation;
        this._resized_callback = resized_callback;
        this._get_user_width = get_user_width;
        this._get_user_height = get_user_height;

        this._signals = new SignalManager.SignalManager(null);

        this._signals.connect(this.actor, 'motion-event', (...args) => this._motion_event(...args));
        this._signals.connect(this.actor, 'leave-event', (...args) => this._leave_event(...args));
        this._signals.connect(this.actor, 'button-press-event', (...args) => this._onButtonPress(...args));
        this._signals.connect(this.actor, 'show', (...args) => this._on_actor_show(...args));

        this._no_edges_draggable = true;
        this.inhibit_resizing = false;
        this._size_restricted = false;

        this._drag_start_position = null;
        this._drag_start_size = null;
        this._scaled_zone_size = null;

        this._edges = { top:    0,
                       bottom: 0,
                       left:   0,
                       right:  0 };

        this.resizingInProgress = false;
        this._workAreaHeight = null;
        this._workAreaWidth = null;
    }

    _onButtonPress(actor, event) {
        if (this.inhibit_resizing || this._no_edges_draggable)
            return false;

        if (event.get_button() != Clutter.BUTTON_PRIMARY)
            return false;

        //---Start drag------
        this._grabEvents(event);
        this.resizingInProgress = true;

        let [stageX, stageY] = event.get_coords();
        this._drag_start_position = {x: stageX, y: stageY};
        this._drag_start_size = {width: this.actor.width, height: this.actor.height};
        this._init_user_width = this._get_user_width();
        this._init_user_height = this._get_user_height();

        return true;
    }

    _grabEvents(event) {
        this._eventsGrabbed = true;

        this._drag_device = event.get_device();
        this._drag_device.grab(this.actor);

        this._onEventId = this.actor.connect('event', (...args) => this._onEvent(...args));
    }

    _ungrabEvents(event) {
        if (!this._eventsGrabbed)
            return;

        if (this._drag_device) {
            this._drag_device.ungrab();
            this._drag_device = null;
        } else if (event) {//this shouldn't arise
            event.get_device().ungrab();
        }
        this._eventsGrabbed = false;

        this.actor.disconnect(this._onEventId);
        this._onEventId = null;
    }

    _stop_drag(event) {
        if (!this.resizingInProgress) {
            return;
        }
        global.unset_cursor();
        this._ungrabEvents(event);

        this.actor.queue_relayout();

        this._drag_start_position = null;
        this._drag_start_size = null;
        this.resizingInProgress = false;
        //update position again while this.resizingInProgress === false so that applet can update settings
        this._resized_callback(this._new_user_width, this._new_user_height);
    }

    _onEvent(actor, event) {
        if (event.type() == Clutter.EventType.BUTTON_RELEASE) {
            this._stop_drag();
            return true;
        } else if (event.type() == Clutter.EventType.MOTION) {
            if (this.resizingInProgress) {
                this._updateDragPosition(event);
                return true;
            }
        } else if (event.type() == Clutter.EventType.KEY_RELEASE && this.resizingInProgress) {
            const symbol = event.get_key_symbol();
            if (symbol === Clutter.KEY_Escape) {
                this._stop_drag();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_STOP;
        }
        return false;
    }

    _collect_work_area_edges() {
        const monitor = Main.layoutManager.findMonitorForActor(this.actor);
        const ws = global.screen.get_active_workspace();
        const area = ws.get_work_area_for_monitor(monitor.index);

        this._edges.top = area.y;
        this._edges.bottom = area.y + area.height;
        this._edges.left = area.x;
        this._edges.right = area.x + area.width;

        this._workAreaHeight = area.height;
        this._workAreaWidth = area.width;
    }

    _motion_event(box, event) {
        if (this.inhibit_resizing) {
            return Clutter.EVENT_PROPAGATE;
        }
        this._collect_work_area_edges();
        this._scaled_zone_size = ZONE_SIZE * global.ui_scale;

        let cursor = 0;

        let [x, y] = event.get_coords();
        
        //Immediately resize actor if greater than work area. This can happen after a
        //change of resolution or monitor scaling.
        if (this.actor.height > this._workAreaHeight) {
            const overHeight = this.actor.height - this._workAreaHeight;
            this._resized_callback(this._get_user_width(), this._get_user_height() - overHeight);
            return Clutter.EVENT_PROPAGATE;
        }
        if (this.actor.width > this._workAreaWidth) {
            const overWidth = this.actor.width - this._workAreaWidth;
            this._resized_callback(this._get_user_width() - overWidth, this._get_user_height());
            return Clutter.EVENT_PROPAGATE;
        }

        this._top_edge_draggable = this._in_top_resize_zone (x, y);
        this._bottom_edge_draggable = this._in_bottom_resize_zone (x, y);
        this._left_edge_draggable = this._in_left_resize_zone (x, y,);
        this._right_edge_draggable = this._in_right_resize_zone (x, y);

        this._no_edges_draggable = false;
        if (this._top_edge_draggable && this._left_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_TOP_LEFT;
        } else if (this._top_edge_draggable && this._right_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_TOP_RIGHT;
        } else if (this._bottom_edge_draggable && this._left_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_BOTTOM_LEFT;
        } else if (this._bottom_edge_draggable && this._right_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_BOTTOM_RIGHT;
        } else if (this._top_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_TOP;
        } else if (this._bottom_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_BOTTOM;
        } else if (this._left_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_LEFT;
        } else if (this._right_edge_draggable) {
            cursor = Cinnamon.Cursor.RESIZE_RIGHT;
        } else {
            global.unset_cursor();
            this._no_edges_draggable = true;
            return Clutter.EVENT_PROPAGATE;
        }

        global.set_cursor (cursor);
        return Clutter.EVENT_PROPAGATE;
    }

    _updateDragPosition(event) {
        let [stageX, stageY] = event.get_coords();
        let delta_width = 0;
        let delta_height = 0;

        const start_w = this._drag_start_size.width;
        const start_h = this._drag_start_size.height;

        if (this._left_edge_draggable) {
            const x_diff = this._drag_start_position.x - stageX;
            const new_width = (start_w + x_diff).clamp(0, this._workAreaWidth);
            delta_width = new_width - start_w;
        } else if (this._right_edge_draggable) {
            const x_diff = stageX - this._drag_start_position.x;
            const new_width = (start_w + x_diff).clamp(0, this._workAreaWidth);
            delta_width = new_width - start_w;
        }

        if (this._top_edge_draggable) {
            const y_diff = this._drag_start_position.y - stageY;
            const new_height = (start_h + y_diff).clamp(0, this._workAreaHeight);
            delta_height = new_height - start_h;
        } else if (this._bottom_edge_draggable) {
            const y_diff = stageY - this._drag_start_position.y;
            const new_height = (start_h + y_diff).clamp(0, this._workAreaHeight);
            delta_height = new_height - start_h;
        }

        this._new_user_width = this._init_user_width + delta_width;
        this._new_user_height = this._init_user_height + delta_height;
        this._resized_callback(this._new_user_width, this._new_user_height);
        
        return true;
    }

    _leave_event(box, event) {
        if (!this.resizingInProgress) {
            global.unset_cursor();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _on_actor_show(box) {
        this._collect_work_area_edges();
        this.resizingInProgress = true;

        const cur_w = this.actor.width;
        const cur_h = this.actor.height;
        const user_w = this._get_user_width();
        const user_h = this._get_user_height();

        if (this._size_restricted) {
            if (user_w <= this._workAreaWidth && user_h <= this._workAreaHeight) {
                this._resized_callback(user_w, user_h);
                this._size_restricted = false;
            }
        } else {
            let new_w = user_w;
            let new_h = user_h;

            if (cur_w > this._workAreaWidth) {
                new_w -= cur_w - this._workAreaWidth;
            }

            if (cur_h > this._workAreaHeight) {
                new_h -= cur_h - this._workAreaHeight;
            }

            if (new_w !== user_w || new_h !== user_h) {
                this._size_restricted = true;
                this._resized_callback(new_w, new_h);
            }
        }

        this.resizingInProgress = false
    }

    _in_top_resize_zone(x, y) {
        if (x < this.actor.x || x > this.actor.x + this.actor.width || this._get_orientation() === St.Side.TOP) {
            return false;
        }

        return y <= this.actor.y + this._scaled_zone_size && y >= this.actor.y &&
               this.actor.y >= this._edges.top;
    }

    _in_bottom_resize_zone(x, y) {
        if (x < this.actor.x || x > this.actor.x + this.actor.width || this._get_orientation() === St.Side.BOTTOM) {
            return false;
        }

        return y >= this.actor.y + this.actor.height - this._scaled_zone_size &&
               y <= this.actor.y + this.actor.height && this.actor.y + this.actor.height <= this._edges.bottom;
    }

    _in_left_resize_zone(x, y) {
        if (y < this.actor.y || y > this.actor.y + this.actor.height || this._get_orientation() === St.Side.LEFT) {
            return false;
        }

        return x <= this.actor.x + this._scaled_zone_size &&
               x >= this.actor.x && this.actor.x >= this._edges.left;
    }

    _in_right_resize_zone(x, y) {
        if (y < this.actor.y || y > this.actor.y + this.actor.height || this._get_orientation() === St.Side.RIGHT) {
            return false;
        }

        return x >= this.actor.x + this.actor.width - this._scaled_zone_size &&
               x <= this.actor.x + this.actor.width && this.actor.x + this.actor.width <= this._edges.right;
    }
}

