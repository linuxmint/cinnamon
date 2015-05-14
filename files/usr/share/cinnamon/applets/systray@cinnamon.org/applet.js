const Lang = imports.lang;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const SignalManager = imports.misc.signalManager;

const ICON_SCALE_FACTOR = .8; // for custom panel heights, 20 (default icon size) / 25 (default panel height)

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
    },

    on_applet_clicked: function(event) {
    },

    on_applet_removed_from_panel: function () {
        this._signalManager.disconnectAllSignals();
    },

    on_applet_added_to_panel: function() {
        Main.statusIconDispatcher.start(this.actor.get_parent().get_parent());

        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-added', this._onTrayIconAdded);
        this._signalManager.connect(Main.statusIconDispatcher, 'status-icon-removed', this._onTrayIconRemoved);
        this._signalManager.connect(Main.statusIconDispatcher, 'before-redisplay', this._onBeforeRedisplay);
        this._signalManager.connect(Main.systrayManager, "changed", Main.statusIconDispatcher.redisplay, Main.statusIconDispatcher);
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

            if (this._scaleMode) {
                let disp_size = this._panelHeight * ICON_SCALE_FACTOR;
                if (icon.get_height() != disp_size) {
                    if (icon.get_width() == 1 || icon.get_height() == 1 || buggyIcons.indexOf(role) != -1) {
                        if (icon.get_height() > disp_size) {                        
                            icon.set_height(disp_size);
                            global.log("   Changed the height of " + role + " (" + icon.get_width() + "x" + icon.get_height() + "px)");
                        }
                    }
                    else {                    
                        icon.set_size(disp_size, disp_size);
                        global.log("   Resized " + role + " (" + icon.get_width() + "x" + icon.get_height() + "px)");
                    }
                }                
            }

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
                if (this._scaleMode) {
                    let disp_size = this._panelHeight * ICON_SCALE_FACTOR;
                    let size = disp_size;
                    if (icon.width == disp_size){
                        size = disp_size - 1;
                    }
                    icon.set_size(size, size);
                }
                i++;
                if (i == 2) {
                    Mainloop.source_remove(timerId);
                }
            }));

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

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
