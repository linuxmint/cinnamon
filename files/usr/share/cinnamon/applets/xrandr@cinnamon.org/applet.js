/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Interfaces = imports.misc.interfaces;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const CinnamonDesktop = imports.gi.CinnamonDesktop;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Meta = imports.gi.Meta;

const N_ = function(e) { return e; };

let ROTATIONS = [
    [Meta.XrandrRotation.NORMAL, N_("Normal")],
    [Meta.XrandrRotation.LEFT, N_("Left")],
    [Meta.XrandrRotation.RIGHT, N_("Right")],
    [Meta.XrandrRotation.FLIPPED, N_("Upside-down")]
];

class CinnamonXrandrApplet extends Applet.IconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name("preferences-desktop-display");
        this.set_applet_tooltip(_("Display"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.monitor_manager = Meta.MonitorManager.get();

        this.monitor_manager.connect("monitors-changed", () => this._monitors_changed());
        this._generate_menu();
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _update_visible() {
        this.actor.visible = global.settings.get_boolean("panel-edit-mode") ||
                             this._get_allowed_rotations().length > 0;
    }

    on_applet_added_to_panel(userEnabled) {
        this._update_visible();
        this._generate_menu();
    }

    _monitors_changed(manager) {
        this._update_visible();
        this._generate_menu();

    }

    _generate_menu() {
        this.menu.removeAll();

        if (!this.actor.visible) {
            return;
        }

        const allowed_rotations = this._get_allowed_rotations();

        for (let i = 0; i < allowed_rotations.length; i++) {
            let [rotval, name] = allowed_rotations[i];

            let item = new PopupMenu.PopupMenuItem(_(name));
            let [got, current] = this.monitor_manager.get_current_rotation();

            if (got &&  current === rotval) {
                item.setShowDot(true);
            }

            item.connect('activate', (item, event) => {
                if (!this.monitor_manager.apply_temporary_rotation(rotval)) {
                    global.logError('Unable to rotate the laptop display', e);
                }
            });

            this.menu.addMenuItem(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction(_("Configure display settings..."), function() {
            GLib.spawn_command_line_async('cinnamon-settings display');
        });
    }

    _get_allowed_rotations() {
        let retval = [];

        for (let i = 0; i < ROTATIONS.length; i++) {
            let rotation = ROTATIONS[i];

            if (this.monitor_manager.can_apply_rotation(rotation[0])) {
                retval.push(rotation);
            }
        }

        return retval;
    }

};

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonXrandrApplet(orientation, panel_height, instance_id);
}
