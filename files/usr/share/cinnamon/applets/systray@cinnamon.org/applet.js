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
    }

    on_applet_added_to_panel() {
        if (!global.trayReloading) {
            Main.statusIconDispatcher.start(this.actor.get_parent().get_parent());
        }

        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-added', this._onTrayIconAdded, this);
        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-removed', this._onTrayIconRemoved, this);
        this._signalManager.connect(Main.statusIconDispatcher, 'before-redisplay', this._onBeforeRedisplay, this);
        this._signalManager.connect(Main.systrayManager, "changed", Main.statusIconDispatcher.redisplay, Main.statusIconDispatcher);

        if (global.trayReloading) {
            global.trayReloading = false;
            Main.statusIconDispatcher.redisplay();
        }
    }

    on_panel_icon_size_changed(size) {
        this.icon_size = size * global.ui_scale;
        Main.statusIconDispatcher.redisplay();
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

            if (hiddenIcons.indexOf(role.toLowerCase()) != -1 ) {
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
