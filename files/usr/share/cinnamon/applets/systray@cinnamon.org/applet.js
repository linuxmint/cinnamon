const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const SignalManager = imports.misc.signalManager;
const {findIndex} = imports.misc.util;

const NO_RESIZE_ROLES = ['shutter', 'filezilla'];

// Override the factory and create an AppletPopupMenu instead of a PopupMenu
class IndicatorMenuFactory extends PopupMenu.PopupMenuFactory {
    constructor() {
        super();
    }

    _createShellItem(factoryItem, launcher, orientation) {
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
}

class CinnamonSystrayApplet extends Applet.Applet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.actor.remove_style_class_name('applet-box');
        this.actor.set_style_class_name('systray');
        this.actor.set_important(true);  // ensure we get class details from the default theme if not present

        this._signalManager = new SignalManager.SignalManager(null);
        let manager;

        this.orientation = orientation;
        this.icon_size = this.getPanelIconSize(St.IconType.FULLCOLOR) * global.ui_scale;

        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            manager = new Clutter.BoxLayout( { spacing: 4,
                                               orientation: Clutter.Orientation.HORIZONTAL });
        } else {
            manager = new Clutter.BoxLayout( { spacing: 4,
                                               orientation: Clutter.Orientation.VERTICAL });
        }

        this.update_na_tray_orientation();

        this.manager = manager;
        this.manager_container = new Clutter.Actor( { layout_manager: manager } );
        this.actor.add_actor (this.manager_container);
        this.manager_container.show();

        this._shellIndicators = [];
        this.menuFactory = new IndicatorMenuFactory();
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this._signalAdded = 0;
        this._signalRemoved = 0;
    }

    _addIndicatorSupport() {
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
    }

    _removeIndicatorSupport() {
        if (this.signalAdded) {
            Main.indicatorManager.disconnect(this.signalAdded);
            this.signalAdded = 0;
        }
        if (this.signalRemoved) {
            Main.indicatorManager.disconnect(this.signalRemoved);
            this.signalRemoved = 0;
        }

        for (let i = 0; i < this._shellIndicators.length; i++) {
            this._shellIndicators[i].instance.destroy();
        }

        this._shellIndicators = [];

    }

    _onIndicatorAdded(manager, appIndicator) {
        if (!(appIndicator.id in this._shellIndicators)) {
            let indicatorActor = appIndicator.getActor(this.icon_size / global.ui_scale, this.orientation);

            this._shellIndicators.push({
                id: appIndicator.id,
                instance: indicatorActor
            });
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
    }

    _onEnterEvent(actor, event) {
        this.set_applet_tooltip(actor._delegate.getToolTip());
    }

    _onLeaveEvent(actor, event) {
        this.set_applet_tooltip("");
    }

    _onIndicatorIconDestroy(actor) {
        for (let i = 0; i < this._shellIndicators.length; i++) {
            if (this._shellIndicators[i].instance.actor == actor) {
                this._shellIndicators.splice(this._shellIndicators.indexOf(this._shellIndicators[i]), 1);
                break;
            }
        }
    }

    _onIndicatorRemoved(manager, appIndicator) {
        for (let i = 0; i < this._shellIndicators.length; i++) {
            if (this._shellIndicators[i].id === appIndicator.id) {
                this._shellIndicators[i].instance.destroy();
                this._shellIndicators.splice(this._shellIndicators.indexOf(this._shellIndicators[i]), 1);
                break;
            }
        }
    }

    on_applet_clicked(event) {
    }

    on_orientation_changed(neworientation) {
        if (neworientation == St.Side.TOP || neworientation == St.Side.BOTTOM) {
            this.manager.set_vertical(false);
        } else {
            this.manager.set_vertical(true);
        }

        this.update_na_tray_orientation();
    }

    update_na_tray_orientation() {
        switch (this.orientation) {
            case St.Side.LEFT:
            case St.Side.RIGHT:
                Main.statusIconDispatcher.set_tray_orientation(Clutter.Orientation.VERTICAL);
                break;
            case St.Side.TOP:
            case St.Side.BOTTOM:
            default:
                Main.statusIconDispatcher.set_tray_orientation(Clutter.Orientation.HORIZONTAL);
                break;
        }
    }

    on_applet_reloaded() {
        global.trayReloading = true;
    }

    on_applet_removed_from_panel() {
        this._signalManager.disconnectAllSignals();
        this._removeIndicatorSupport();
    }

    on_applet_added_to_panel() {
        if (!global.trayReloading) {
            Main.statusIconDispatcher.start(this.actor.get_parent().get_parent());
        }

        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-added', this._onTrayIconAdded, this);
        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-removed', this._onTrayIconRemoved, this);
        this._signalManager.connect(Main.statusIconDispatcher, 'before-redisplay', this._onBeforeRedisplay, this);
        this._signalManager.connect(Main.systrayManager, "changed", Main.statusIconDispatcher.redisplay, Main.statusIconDispatcher);
        this._addIndicatorSupport();

        if (global.trayReloading) {
            global.trayReloading = false;
            Main.statusIconDispatcher.redisplay();
        }
    }

    on_panel_icon_size_changed(size) {
        this.icon_size = size * global.ui_scale;
        Main.statusIconDispatcher.redisplay();

        for (let i = 0; i < this._shellIndicators.length; i++) {
            let indicator = Main.indicatorManager.getIndicatorById(this._shellIndicators[i].id);
            if (indicator) {
                this._shellIndicators[i].instance.setSize(this.icon_size);
            }
        }
    }

    _onBeforeRedisplay() {
        // Mark all icons as obsolete
        // There might still be pending delayed operations to insert/resize of them
        // And that would crash Cinnamon

        let children = this.manager_container.get_children().filter(function(child) {
            // We are only interested in the status icons and apparently we can not ask for
            // child instanceof CinnamonTrayIcon.
            return (child.toString().indexOf("CinnamonTrayIcon") != -1);
        });
        for (let i = 0; i < children.length; i++) {
            children[i].destroy();
        }
    }

    _onTrayIconAdded(o, icon, role) {
        try {
            let hiddenIcons = Main.systrayManager.getRoles();

            if (hiddenIcons.indexOf(role) != -1 ) {
                // We've got an applet for that
                global.log("Hiding systray: " + role);
                return;
            }

            global.log("Adding systray: " + role + " (" + icon.get_width() + "x" + icon.get_height() + "px)");

            let parent = icon.get_parent();
            if (parent) parent.remove_child(icon);

            this._insertStatusItem(role, icon);

        } catch (e) {
            global.logError(e);
        }
    }

    _onTrayIconRemoved(o, icon) {
        if (icon.get_parent() === this.manager_container) {
            this.manager_container.remove_child(icon);
        }

        icon.destroy();
    }

    _insertStatusItem(role, icon) {
        if (icon.is_finalized()) {
            return;
        }
        this.manager_container.insert_child_at_index(icon, 0);

        if (["skypeforlinux"].indexOf(role) != -1) {
            let size = 16 * global.ui_scale;
            icon.set_size(size, size);
            global.log("Resize " + role + " with hardcoded size (" + icon.get_width() + "x" + icon.get_height() + "px)");
        }
        else {
            this._resizeStatusItem(role, icon);
        }
    }

    _resizeStatusItem(role, icon) {
        if (NO_RESIZE_ROLES.indexOf(role) > -1) {
            global.log("Not resizing " + role + " as it's known to be buggy (" + icon.get_width() + "x" + icon.get_height() + "px)");
        } else {
            icon.set_size(this.icon_size, this.icon_size);
            global.log("Resized " + role + " with normalized size (" + icon.get_width() + "x" + icon.get_height() + "px)");
            //Note: dropbox doesn't scale, even though we resize it...
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonSystrayApplet(orientation, panel_height, instance_id);
}
