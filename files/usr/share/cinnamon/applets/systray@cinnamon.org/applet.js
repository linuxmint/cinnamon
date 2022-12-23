const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const SignalManager = imports.misc.signalManager;
const {findIndex} = imports.misc.util;
const Meta = imports.gi.Meta;

const NO_RESIZE_ROLES = ['shutter', 'filezilla'];

class CinnamonSystrayApplet extends Applet.Applet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.actor.remove_style_class_name('applet-box');
        this.actor.set_style_class_name('systray');
        this.actor.set_important(true);  // ensure we get class details from the default theme if not present

        this._signalManager = new SignalManager.SignalManager(null);
        this._scaleUpdateId = 0;

        this.orientation = orientation;
        this.icon_size = this.getPanelIconSize(St.IconType.FULLCOLOR) * global.ui_scale;

        this.button_box = new St.BoxLayout({ vertical: [St.Side.LEFT, St.Side.RIGHT].includes(this.orientation) });

        this.actor.add_actor (this.button_box);
        this.button_box.show();
    }

    on_applet_clicked(event) {
    }

    on_orientation_changed(neworientation) {
        if (neworientation == St.Side.TOP || neworientation == St.Side.BOTTOM) {
            this.button_box.set_vertical(false);
        } else {
            this.button_box.set_vertical(true);
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

        this._clearIcons();
    }

    on_applet_added_to_panel() {
        if (!global.trayReloading) {
            Main.statusIconDispatcher.start(this.actor.get_parent().get_parent());
        }

        this.update_na_tray_orientation();

        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-added', this._onTrayIconAdded, this);
        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-removed', this._onTrayIconRemoved, this);
        this._signalManager.connect(Main.statusIconDispatcher, 'before-redisplay', this._onBeforeRedisplay, this);
        this._signalManager.connect(Main.systrayManager, "changed", Main.statusIconDispatcher.redisplay, Main.statusIconDispatcher);
        this._signalManager.connect(global, "scale-changed", this.uiScaleChanged, this);
        this._signalManager.connect(global.settings, 'changed::panel-edit-mode', this.on_panel_edit_mode_changed, this);

        if (global.trayReloading) {
            global.trayReloading = false;
            Main.statusIconDispatcher.redisplay();
        }
    }

    _clearIcons() {
        this.button_box.get_children().forEach((button) => {
            // button.set_size(-1, -1);
            button.remove_actor(button.child);
            button.destroy();
        });
    }

    resizeIcons() {
        this.icon_size = this.getPanelIconSize() * global.ui_scale;
        Main.statusIconDispatcher.redisplay();
    }

    on_panel_icon_size_changed(size) {
        this.resizeIcons();
    }

    on_panel_edit_mode_changed() {
        this.resizeIcons();
    }

    uiScaleChanged() {
        if (this._scaleUpdateId > 0) {
            Mainloop.source_remove(this._scaleUpdateId);
        }

        this._scaleUpdateId = Mainloop.timeout_add(1500, () => {
            this.resizeIcons();

            this._scaleUpdateId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _onBeforeRedisplay() {
        // Mark all icons as obsolete
        // There might still be pending delayed operations to insert/resize of them
        // And that would crash Cinnamon
        this._clearIcons();
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

            let button = new St.Bin(
            {
                style_class: "applet-box",
                child: icon
            })

            icon.set_x_align(Clutter.ActorAlign.CENTER);
            icon.set_y_align(Clutter.ActorAlign.FILL);
            button.set_y_align(Clutter.ActorAlign.FILL);

            icon.visible = false;
            icon.opacity = 0;
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
                if (icon.is_finalized()) {
                    button.destroy();
                    return GLib.SOURCE_REMOVE;
                }

                icon.reactive = true;
                icon.visible = true;
                icon.set_size(this.icon_size, this.icon_size);
                icon.ease({
                    opacity: 255,
                    duration: 400,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                });

                icon.connect("event", (actor, event) => this._onEvent(actor, event));
                return GLib.SOURCE_REMOVE;
            });

            this.button_box.insert_child_at_index(button, 0);
        } catch (e) {
            global.logError(e);
        }
    }

    _onEvent(icon, event) {
        let etype = event.type();
        const button = icon.get_parent();

        if (button == null) {
            return GLib.SOURCE_REMOVE;
        }

        if (etype === Clutter.EventType.BUTTON_PRESS) {
            global.begin_modal(Meta.ModalOptions.POINTER_ALREADY_GRABBED, event.time);
        }
        else
        if (etype === Clutter.EventType.ENTER) {
            button.add_style_pseudo_class("hover");
        }
        else
        if (etype === Clutter.EventType.LEAVE) {
            button.remove_style_pseudo_class("hover");
        }

        let ret = icon.handle_event(etype, event);

        if (etype === Clutter.EventType.BUTTON_PRESS) {
            global.end_modal(event.time);
        }

        return ret;
    }

    _onTrayIconRemoved(o, icon) {
        const parent = icon.get_parent();

        parent.remove_actor(icon);
        parent.destroy()
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonSystrayApplet(orientation, panel_height, instance_id);
}
