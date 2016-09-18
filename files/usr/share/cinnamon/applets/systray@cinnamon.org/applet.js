const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const SignalManager = imports.misc.signalManager;

const ICON_SCALE_FACTOR = .8; // for custom panel heights, 20 (default icon size) / 25 (default panel height)

const DEFAULT_ICON_SIZE = 20;

// Override the factory and create an AppletPopupMenu instead of a PopupMenu
function IndicatorMenuFactory() {
   this._init.apply(this, arguments);
}

IndicatorMenuFactory.prototype = {
    __proto__: PopupMenu.PopupMenuFactory.prototype,

    _init: function() {
        PopupMenu.PopupMenuFactory.prototype._init.call(this);
    },

    _createShellItem: function(factoryItem, launcher, orientation) {
        // Decide whether it's a submenu or not
        let shellItem = null;
        let item_type = factoryItem.getFactoryType();
        if (item_type == PopupMenu.FactoryClassTypes.RootMenuClass)
            shellItem = new Applet.AppletPopupMenu(launcher, orientation);
        if (item_type == PopupMenu.FactoryClassTypes.SubMenuMenuItemClass)
            shellItem = new PopupMenu.PopupSubMenuMenuItem("FIXME");
        else if (item_type == PopupMenu.FactoryClassTypes.MenuSectionMenuItemClass)
            shellItem = new PopupMenu.PopupMenuSection();
        else if (item_type == PopupMenu.FactoryClassTypes.SeparatorMenuItemClass)
            shellItem = new PopupMenu.PopupSeparatorMenuItem('');
        else if (item_type == PopupMenu.FactoryClassTypes.MenuItemClass)
            shellItem = new PopupMenu.PopupIndicatorMenuItem("FIXME");
        return shellItem;
    }
};

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.actor.remove_style_class_name("applet-box");
        this.actor.style="spacing: 5px;";

        this._signalManager = new SignalManager.SignalManager(this);
	let manager;

	this.orientation = orientation;

	if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM)
	{
		manager = new Clutter.BoxLayout( { spacing: 2 * global.ui_scale,
		                                   orientation: Clutter.Orientation.HORIZONTAL });
	}
	else
	{
		manager = new Clutter.BoxLayout( { spacing: 2 * global.ui_scale,
		                                   orientation: Clutter.Orientation.VERTICAL });
	}
        this.manager = manager;
        this.manager_container = new Clutter.Actor( { layout_manager: manager } );
        this.actor.add_actor (this.manager_container);
        this.manager_container.show();

        this._statusItems = [];
        this._shellIndicators = {};
        this.menuFactory = new IndicatorMenuFactory();
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.signalAdded = 0;
        this.signalRemoved = 0;
    },

    _addIndicatorSupport: function() {
        let currentIndicators = Main.indicatorManager.getIndicatorIds();
        for (let pos in currentIndicators) {
            let appIndicator = Main.indicatorManager.getIndicatorById(currentIndicators[pos]);
            this._onIndicatorAdded(Main.indicatorManager, appIndicator);
        }
        if (this.signalAdded == 0)
            this.signalAdded = Main.indicatorManager.connect('indicator-added', Lang.bind(this, this._onIndicatorAdded));
        if (this.signalRemoved == 0)
            this.signalRemoved = Main.indicatorManager.connect('indicator-removed', Lang.bind(this, this._onIndicatorRemoved));
    },

    _removeIndicatorSupport: function() {
        if (this.signalAdded) {
            Main.indicatorManager.disconnect(this.signalAdded);
            this.signalAdded = 0;
        }
        if (this.signalRemoved) {
            Main.indicatorManager.disconnect(this.signalRemoved);
            this.signalRemoved = 0;
        }

        this._shellIndicators.forEach(function(iconActor) {
            iconActor.destroy();
        });
        this._shellIndicators = {};

    },

    _onIndicatorAdded: function(manager, appIndicator) {

        if (!(appIndicator.id in this._shellIndicators)) {
            let hiddenIcons = Main.systrayManager.getRoles();

            if (hiddenIcons.indexOf(appIndicator.id) != -1 ) {
                // We've got an applet for that
                global.log("Hiding indicator (role already handled): " + appIndicator.id);
                return;
            }
            else if (["quassel"].indexOf(appIndicator.id) != -1) {
                // Blacklist some of the icons
                // quassel: The proper icon in Quassel is "QuasselIRC", this is a fallback icon which Quassel launches when it fails to detect
                // our indicator support (i.e. when Cinnamon is restarted for instance)
                // The problem is.. Quassel doesn't kill that icon when it creates QuasselIRC again..
                global.log("Hiding indicator (blacklisted): " + appIndicator.id);
                return;
            }
            else {
                global.log("Adding indicator: " + appIndicator.id);
            }

            let iconActor = appIndicator.getIconActor(this._getIndicatorSize(appIndicator));
            iconActor._applet = this;

            this._shellIndicators[appIndicator.id] = iconActor;

            this.manager_container.add_actor(iconActor.actor);
            appIndicator.createMenuClientAsync(Lang.bind(this, function(client) {
                if (client != null) {
                    let newMenu = client.getShellMenu();
                    if (!newMenu) {
                        newMenu = this.menuFactory.buildShellMenu(client, iconActor, this._applet_context_menu._arrowSide);
                        this.menuManager.addMenu(newMenu);
                    }
                    iconActor.setMenu(newMenu);
                }
            }));
        }
    },

    _getIndicatorSize: function(appIndicator) {
        if (this._scaleMode)
            return this._panelHeight * ICON_SCALE_FACTOR / global.ui_scale;
        return 16;
    },

    _getIconSize: function() {
        let size;
        let disp_size = this._panelHeight * ICON_SCALE_FACTOR;
        if (disp_size < 22) {
            size = 16;
        }
        else if (disp_size < 32) {
            size = 22;
        }
        else if (disp_size < 48) {
            size = 32;
        }
        else {
            size = 48;
        }
        return size;
    },

    _onIndicatorRemoved: function(manager, appIndicator) {
        if (appIndicator.id in this._shellIndicators) {
            global.log("Removing indicator: " + appIndicator.id);
            let iconActor = this._shellIndicators[appIndicator.id];
            delete this._shellIndicators[appIndicator.id];
            iconActor.destroy();
        }
    },

    on_applet_clicked: function(event) {
    },

//
//override getDisplayLayout to declare that this applet is suitable for both horizontal and
// vertical orientations
//
    getDisplayLayout: function() {
        return Applet.DisplayLayout.BOTH;
    },

    on_orientation_changed: function(neworientation) { 

	if (neworientation == St.Side.TOP || neworientation == St.Side.BOTTOM)
	{
            this.manager.set_vertical(false);
	}
	else		// vertical panels
	{
            this.manager.set_vertical(true);
 	}
    },

    on_applet_removed_from_panel: function () {
        this._signalManager.disconnectAllSignals();
        this._removeIndicatorSupport();
    },

    on_applet_added_to_panel: function() {
        Main.statusIconDispatcher.start(this.actor.get_parent().get_parent());

        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-added', this._onTrayIconAdded);
        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-removed', this._onTrayIconRemoved);
        this._signalManager.connect(Main.statusIconDispatcher, 'before-redisplay', this._onBeforeRedisplay);
        this._signalManager.connect(Main.systrayManager, "changed", Main.statusIconDispatcher.redisplay, Main.statusIconDispatcher);
        this._addIndicatorSupport();
    },

    on_panel_height_changed: function() {
        Main.statusIconDispatcher.redisplay();
        for (let id in this._shellIndicators) {
            let indicator = Main.indicatorManager.getIndicatorById(id);
            if (indicator) {
                let size = this._getIndicatorSize(indicator);
                this._shellIndicators[id].setSize(size);
            }
        }
    },

    _onBeforeRedisplay: function() {
        // Mark all icons as obsolete
        // There might still be pending delayed operations to insert/resize of them
        // And that would crash Cinnamon
        for (var i = 0; i < this._statusItems.length; i++) {
            this._statusItems[i].obsolete = true;
        }
        this._statusItems = [];

        let children = this.manager_container.get_children().filter(function(child) {
            // We are only interested in the status icons and apparently we can not ask for 
            // child instanceof CinnamonTrayIcon.
            return (child.toString().indexOf("CinnamonTrayIcon") != -1);
        });
        for (var i = 0; i < children.length; i++) {
            children[i].destroy();
        }
    },

    _onTrayIconAdded: function(o, icon, role) {
        try {
            let hiddenIcons = Main.systrayManager.getRoles();

            if (hiddenIcons.indexOf(role) != -1 ) {
                // We've got an applet for that
                global.log("Hiding systray: " + role);
                return;
            }

            global.log("Adding systray: " + role + " (" + icon.get_width() + "x" + icon.get_height() + "px)");

            if (icon.get_parent())
                icon.get_parent().remove_child(icon);

            icon.obsolete = false;
            this._statusItems.push(icon);

            if (["pidgin"].indexOf(role) != -1) {
                // Delay pidgin insertion by 10 seconds
                // Pidgin is very weird.. it starts with a small icon
                // Then replaces that icon with a bigger one when the connection is established
                // Pidgin can be fixed by inserting or resizing after a delay
                // The delay is big because resizing/inserting too early
                // makes pidgin invisible (in absence of disk cache).. even if we resize/insert again later
                this._insertStatusItemLater(role, icon, -1, 10000);
            }
            else if (["shutter", "filezilla", "dropbox", "thunderbird", "unknown", "blueberry-tray.py", "mintupdate.py"].indexOf(role) != -1) {
                // Delay insertion by 1 second
                // This fixes an invisible icon in the absence of disk cache for : shutter
                // filezilla, dropbox, thunderbird, blueberry, mintupdate are known to show up in the wrong size or position, this should fix them as well
                // Note: as of Oct 2015, the dropbox systray is calling itself "unknown"
                this._insertStatusItemLater(role, icon, -1, 1000);
            }
            else {
                // Delay all other apps by 1 second...
                // For many of them, we don't need to do that,
                // It's a small delay though and that fixes most buggy apps
                // And we're far from having an exhaustive list of them..
                this._insertStatusItemLater(role, icon, -1, 1000);
            }

        } catch (e) {
            global.logError(e);
        }
    },

    _insertStatusItemLater: function(role, icon, position, delay) {
        // Inserts an icon in the systray after a delay (useful for buggy icons)
        // Delaying the insertion of pidgin by 10 seconds for instance is known to fix it on empty disk cache
        let timerId = Mainloop.timeout_add(delay, Lang.bind(this, function() {
            this._insertStatusItem(role, icon, position);
            Mainloop.source_remove(timerId);
        }));
    },

    _onTrayIconRemoved: function(o, icon) {
        icon.obsolete = true;
        for (var i = 0; i < this._statusItems.length; i++) {
            if (this._statusItems[i] == icon) {
                this._statusItems.splice(i, 1);
            }
        }
        this.manager_container.remove_child(icon);
        icon.destroy();
    },

    _insertStatusItem: function(role, icon, position) {
        if (icon.obsolete == true) {
            return;
        }
        let children = this.manager_container.get_children().filter(function(child) {
            // We are only interested in the status icons and apparently we can not ask for 
            // child instanceof CinnamonTrayIcon.
            return (child.toString().indexOf("CinnamonTrayIcon") != -1);
        });
        let i;
        for (i = children.length - 1; i >= 0; i--) {
            let rolePosition = children[i]._rolePosition;
            if (position > rolePosition) {
                this.manager_container.insert_child_at_index(icon, i + 1);
                break;
            }
        }
        if (i == -1) {
            // If we didn't find a position, we must be first
            this.manager_container.insert_child_at_index(icon, 0);
        }
        icon._rolePosition = position;

        if (this._scaleMode) {
            let timerId = Mainloop.timeout_add(500, Lang.bind(this, function() {
                this._resizeStatusItem(role, icon);
                Mainloop.source_remove(timerId);
            }));
        } else {
            icon.set_pivot_point(0.5, 0.5);
            icon.set_scale((DEFAULT_ICON_SIZE * global.ui_scale) / icon.width,
                           (DEFAULT_ICON_SIZE * global.ui_scale) / icon.height);
        }
    },

    _resizeStatusItem: function(role, icon) {
        if (icon.obsolete == true) {
            return;
        }

        if (["shutter", "filezilla"].indexOf(role) != -1) {
            global.log("Not resizing " + role + " as it's known to be buggy (" + icon.get_width() + "x" + icon.get_height() + "px)");
        }
        else {
            let size = this._getIconSize();
            icon.set_size(size, size);
            global.log("Resized " + role + " with normalized size (" + icon.get_width() + "x" + icon.get_height() + "px)");
            //Note: dropbox doesn't scale, even though we resize it...
        }
    },


};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
