const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const SignalManager = imports.misc.signalManager;

const ICON_SCALE_FACTOR = 0.8; // for custom panel heights, 20 (default icon size) / 25 (default panel height)

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

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.actor.remove_style_class_name('applet-box');
        this.actor.set_style_class_name('systray');
        this.actor.set_important(true);  // ensure we get class details from the default theme if not present

        this._signalManager = new SignalManager.SignalManager(null);
        let manager;

        this.orientation = orientation;

        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            manager = new Clutter.BoxLayout( { spacing: 2,
                                               orientation: Clutter.Orientation.HORIZONTAL });
        } else {
            manager = new Clutter.BoxLayout( { spacing: 2,
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
        this._signalAdded = 0;
        this._signalRemoved = 0;
    },

    _addIndicatorSupport: function() {
        let manager = Main.indicatorManager;

        // Blacklist some of the icons
        // quassel: The proper icon in Quassel is "QuasselIRC",
        // this is a fallback icon which Quassel launches when it fails to detect
        // our indicator support (i.e. when Cinnamon is restarted for instance)
        // The problem is.. Quassel doesn't kill that icon when it creates QuasselIRC again..
        manager.insertInBlackList("quassel");

        let currentIndicators = manager.getIndicatorIds();
        for (let pos in currentIndicators) {
            if (!manager.isInBlackList(currentIndicators[pos])) {
                let appIndicator = manager.getIndicatorById(currentIndicators[pos]);
                this._onIndicatorAdded(manager, appIndicator);
            }
        }
        if (this._signalAdded == 0)
            this._signalAdded = manager.connect('indicator-added', Lang.bind(this, this._onIndicatorAdded));
        if (this._signalRemoved == 0)
            this._signalRemoved = manager.connect('indicator-removed', Lang.bind(this, this._onIndicatorRemoved));
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

        for (let id in this._shellIndicators) {
            this._shellIndicators[id].destroy();
        }

        this._shellIndicators = {};

    },

    _onIndicatorAdded: function(manager, appIndicator) {
        if (!(appIndicator.id in this._shellIndicators)) {
            let size = null;
            size = this._getIconSize(this._panelHeight/global.ui_scale);

            let indicatorActor = appIndicator.getActor(size);
            indicatorActor._applet = this;

            this._shellIndicators[appIndicator.id] = indicatorActor;
            this._signalManager.connect(indicatorActor.actor, 'destroy', this._onIndicatorIconDestroy, this);
            this._signalManager.connect(indicatorActor.actor, 'enter-event', this._onEnterEvent, this);
            this._signalManager.connect(indicatorActor.actor, 'leave-event', this._onLeaveEvent, this);

            this.manager_container.add_actor(indicatorActor.actor);

            appIndicator.createMenuClientAsync(Lang.bind(this, function(client) {
                if (client != null) {
                    let newMenu = client.getShellMenu();
                    if (!newMenu) {
                        newMenu = this.menuFactory.buildShellMenu(client, indicatorActor, this.orientation);
                        this.menuManager.addMenu(newMenu);
                    }
                    indicatorActor.setMenu(newMenu);
                }
            }));
        }
    },

    _onEnterEvent: function(actor, event) {
       this.set_applet_tooltip(actor._delegate.getToolTip());
    },

    _onLeaveEvent: function(actor, event) {
        this.set_applet_tooltip("");
    },

    _onIndicatorIconDestroy: function(actor) {
        for (let id in this._shellIndicators) {
            if (this._shellIndicators[id].actor == actor) {
                delete this._shellIndicators[id];
                break;
            }
        }
    },

    _getIconSize: function(ht) {
        let size;
        let disp_size = ht * ICON_SCALE_FACTOR;  // hidpi with largest panel, gets up to 80

        if (disp_size < 22) {
            size = 16;
        } else if (disp_size < 32) {
            size = 22;
        } else if (disp_size < 48) {
            size = 32;
        } else if (disp_size < 64) {
            size = 48;
        } else if (disp_size < 96) {
            size = 64;
        } else if (disp_size < 128) {
            size = 96;
        } else {
            size = 48;
        }
        return size;
    },

    _onIndicatorRemoved: function(manager, appIndicator) {
        if (appIndicator.id in this._shellIndicators) {
            let indicatorActor = this._shellIndicators[appIndicator.id];
            delete this._shellIndicators[appIndicator.id];
            indicatorActor.destroy();
        }
    },

    on_applet_clicked: function(event) {
    },

    on_orientation_changed: function(neworientation) {
        if (neworientation == St.Side.TOP || neworientation == St.Side.BOTTOM) {
            this.manager.set_vertical(false);
        } else {
            this.manager.set_vertical(true);
        }
    },

    on_applet_removed_from_panel: function () {
        this._signalManager.disconnectAllSignals();
        this._removeIndicatorSupport();
    },

    on_applet_added_to_panel: function() {
        Main.statusIconDispatcher.start(this.actor.get_parent().get_parent());

        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-added', this._onTrayIconAdded, this);
        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-removed', this._onTrayIconRemoved, this);
        this._signalManager.connect(Main.statusIconDispatcher, 'before-redisplay', this._onBeforeRedisplay, this);
        this._signalManager.connect(Main.systrayManager, "changed", Main.statusIconDispatcher.redisplay, Main.statusIconDispatcher);
        this._addIndicatorSupport();
    },

    on_panel_height_changed: function() {
        Main.statusIconDispatcher.redisplay();
        let size = null;
        size = this._getIconSize(this._panelHeight/global.ui_scale);
        for (let id in this._shellIndicators) {
            let indicator = Main.indicatorManager.getIndicatorById(id);
            if (indicator) {
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
        for (let i = 0; i < children.length; i++) {
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
            } else if (["shutter", "filezilla", "dropbox", "thunderbird", "unknown", "blueberry-tray.py", "mintupdate.py"].indexOf(role) != -1) {
                // Delay insertion by 1 second
                // This fixes an invisible icon in the absence of disk cache for : shutter
                // filezilla, dropbox, thunderbird, blueberry, mintupdate are known to show up in the wrong size or position, this should fix them as well
                // Note: as of Oct 2015, the dropbox systray is calling itself "unknown"
                this._insertStatusItemLater(role, icon, -1, 1000);
            } else {
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

        if (icon.get_parent() == this.manager_container) {
            this.manager_container.remove_child(icon);
        }

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
        } else {
            let size = this._getIconSize(this._panelHeight);
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
