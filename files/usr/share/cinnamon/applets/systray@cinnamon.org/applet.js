const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Applet = imports.ui.applet;
const Main = imports.ui.main;

const ICON_SCALE_FACTOR = .8; // for custom panel heights, 20 (default icon size) / 25 (default panel height)

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation, panel_height) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height);

        this.actor.remove_style_class_name("applet-box");
        this.actor.style="spacing: 5px;";

        this._signals = { added: null,
                          removed: null,
                          redisplay: null,
                          registered: null };

        let manager = new Clutter.BoxLayout( { spacing: 2 * global.ui_scale,
                                               homogeneous: true,
                                               orientation: Clutter.Orientation.HORIZONTAL });

        this.manager_container = new Clutter.Actor( { layout_manager: manager } );

        this.actor.add_actor (this.manager_container);

        this.manager_container.show();
    },

    on_applet_clicked: function(event) {
    },

    on_applet_removed_from_panel: function () {
        Main.statusIconDispatcher.disconnect(this._signals.added);
        Main.statusIconDispatcher.disconnect(this._signals.removed);
        Main.statusIconDispatcher.disconnect(this._signals.redisplay);
        Main.systrayManager.disconnect(this._signals.registered);
    },

    on_applet_added_to_panel: function() {
        this._signals.added = Main.statusIconDispatcher.connect('status-icon-added', Lang.bind(this, this._onTrayIconAdded));
        this._signals.removed = Main.statusIconDispatcher.connect('status-icon-removed', Lang.bind(this, this._onTrayIconRemoved));
        this._signals.redisplay = Main.statusIconDispatcher.connect('before-redisplay', Lang.bind(this, this._onBeforeRedisplay));
        this._signals.registered = Main.systrayManager.connect("changed", Lang.bind(Main.statusIconDispatcher, Main.statusIconDispatcher.redisplay));
    },

    on_panel_height_changed: function() {
        Main.statusIconDispatcher.redisplay();
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

            let buggyIcons = ["pidgin", "thunderbird"];

            global.log("Adding systray: " + role + " (" + icon.get_width() + "x" + icon.get_height() + "px)");            

            if (icon.get_parent())
                icon.get_parent().remove_child(icon);

            if (global.settings.get_boolean('panel-scale-text-icons')) {
                let disp_size = this._panelHeight * ICON_SCALE_FACTOR;
                if (icon.get_width() == 1 || icon.get_height() == 1 || buggyIcons.indexOf(role) != -1) {
                    icon.set_height(disp_size);
                }
                else {
                    icon.set_size(disp_size, disp_size);
                }
            }

            /* dropbox, for some reason, refuses to provide a correct size icon in our new situation.
             * Tried even with stalonetray, same results - all systray icons I tested work fine but dropbox.  I'm
             * assuming for now it's their problem.  For us, just scale it up.
             */
            if (["dropbox"].indexOf(role) != -1) {
                icon.set_scale_full(global.ui_scale, global.ui_scale, icon.get_width() / 2.0, icon.get_width() / 2.0);
            }

            this._insertStatusItem(icon, -1);
        } catch (e) {
            global.logError(e);
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

function main(metadata, orientation, panel_height) {
    let myApplet = new MyApplet(orientation, panel_height);
    return myApplet;
}
