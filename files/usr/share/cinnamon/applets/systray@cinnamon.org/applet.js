const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const SignalManager = imports.misc.signalManager;

const ICON_SCALE_FACTOR = .8; // for custom panel heights, 20 (default icon size) / 25 (default panel height)

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

        let manager = new Clutter.BoxLayout( { spacing: 2 * global.ui_scale,
                                               homogeneous: true,
                                               orientation: Clutter.Orientation.HORIZONTAL });

        this.manager_container = new Clutter.Actor( { layout_manager: manager } );

        this.actor.add_actor (this.manager_container);

        this.manager_container.show();

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
            let iconActor = appIndicator.getIconActor(this._getIndicatorSize(appIndicator));
            iconActor._applet = this;

            this._shellIndicators[appIndicator.id] = iconActor;

            this.actor.add_actor(iconActor.actor);
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
            return this._panelHeight * ICON_SCALE_FACTOR;
        return 16;
    },

    _onIndicatorRemoved: function(indicator) {
        if (indicator.id in this._shellIndicators) {
            let iconActor = this._shellIndicators[indicator.id];
            delete this._shellIndicators[indicator.id];
            iconActor.destroy();
        }
    },

    on_applet_clicked: function(event) {
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
        let children = this.manager_container.get_children();
        for (var i = 0; i < children.length; i++) {
            children[i].destroy();
        }
    },

    _onTrayIconAdded: function(o, icon, role) {
        try {
            let hiddenIcons = Main.systrayManager.getRoles();

            if (hiddenIcons.indexOf(role) != -1 ) {
                // We've got an applet for that
                return;
            }

            global.log("Adding systray: " + role + " (" + icon.get_width() + "x" + icon.get_height() + "px)");

            if (icon.get_parent())
                icon.get_parent().remove_child(icon);

            this.resize_icon(icon, role);

            /* dropbox, for some reason, refuses to provide a correct size icon in our new situation.
             * Tried even with stalonetray, same results - all systray icons I tested work fine but dropbox.  I'm
             * assuming for now it's their problem.  For us, just scale it up.
             */
            if (["dropbox"].indexOf(role) != -1) {
                icon.set_scale_full(global.ui_scale, global.ui_scale, icon.get_width() / 2.0, icon.get_width() / 2.0);
                global.log("   Full-scaled " + role + " (" + icon.get_width() + "x" + icon.get_height() + "px)");
            }

            this._insertStatusItem(icon, -1);

            let timerId = 0;
            let i = 0;
            timerId = Mainloop.timeout_add(500, Lang.bind(this, function() {
                this.resize_icon(icon, role);
                i++;
                if (i == 2) {
                    Mainloop.source_remove(timerId);
                }
            }));

        } catch (e) {
            global.logError(e);
        }
    },

    resize_icon: function(icon, role) {
        if (this._scaleMode) {
            let disp_size = this._panelHeight * ICON_SCALE_FACTOR;
            let size;
            if (icon.get_height() != disp_size) {
                size = disp_size;
            }
            else {
                // Force a resize with a slightly different size
                size = disp_size - 1;
            }

            // Don't try to scale buggy icons, give them predefined sizes
            // This, in the case of pidgin, fixes the icon being cropped in the systray
            if (["pidgin", "thunderbird"].indexOf(role) != -1) {
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
            }

            icon.set_size(size, size);

            global.log("Resized " + role + " (" + icon.get_width() + "x" + icon.get_height() + "px)");
        }
        else {
            // Force buggy icon size when not in scale mode
            if (["pidgin", "thunderbird"].indexOf(role) != -1) {
                icon.set_size(16, 16);
                global.log("Resized " + role + " (" + icon.get_width() + "x" + icon.get_height() + "px)");
            }
        }
    },

    _onTrayIconRemoved: function(o, icon) {
        this.manager_container.remove_child(icon);
        icon.destroy();
    },

    _insertStatusItem: function(actor, position) {
        let children = this.manager_container.get_children();
        let i;
        for (i = children.length - 1; i >= 0; i--) {
            let rolePosition = children[i]._rolePosition;
            if (position > rolePosition) {
                this.manager_container.insert_child_at_index(actor, i + 1);
                break;
            }
        }
        if (i == -1) {
            // If we didn't find a position, we must be first
            this.manager_container.insert_child_at_index(actor, 0);
        }
        actor._rolePosition = position;
    },


};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
