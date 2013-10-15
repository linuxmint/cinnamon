const Lang = imports.lang;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const Main = imports.ui.main;

const ICON_SCALE_FACTOR = .88; // for custom panel heights, 22 (default icon size) / 25 (default panel height)

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation, panel_height) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height);
        this.actor.remove_style_class_name("applet-box");

        this._signals = { added: null,
                          removed: null,
                          redisplay: null };

        this.actor.style="spacing: 5px;";
    },

    on_applet_clicked: function(event) {
    },

    on_applet_removed_from_panel: function () {
        Main.statusIconDispatcher.disconnect(this._signals.added);
        Main.statusIconDispatcher.disconnect(this._signals.removed);
        Main.statusIconDispatcher.disconnect(this._signals.redisplay);
    },

    on_applet_added_to_panel: function() {
        this._signals.added = Main.statusIconDispatcher.connect('status-icon-added', Lang.bind(this, this._onTrayIconAdded));
        this._signals.removed = Main.statusIconDispatcher.connect('status-icon-removed', Lang.bind(this, this._onTrayIconRemoved));
        this._signals.redisplay = Main.statusIconDispatcher.connect('before-redisplay', Lang.bind(this, this._onBeforeRedisplay));
    },

    on_panel_height_changed: function() {
        Main.statusIconDispatcher.redisplay();
    },

    _onBeforeRedisplay: function() {
        let children = this.actor.get_children();
        for (var i = 0; i < children.length; i++) {
            children[i].destroy();
        }
    },

    _onTrayIconAdded: function(o, icon, role) {
        try {
            let hiddenIcons = ["network", "power", "keyboard", "gnome-settings-daemon", "volume", "bluetooth", "bluetooth-manager", "battery", "a11y", "banshee", "tomahawk", "clementine", "amarok"];
            let buggyIcons = ["pidgin", "thunderbird"];
            
            if (hiddenIcons.indexOf(role) != -1 ) {
                // We've got an applet for that
                return;
            }

            global.log("Adding systray: " + role + " (" + icon.get_width() + "x" + icon.get_height() + "px)");            

            let box = new St.Bin({ style_class: 'panel-status-button', reactive: true, track_hover: true});
	    let iconParent = icon.get_parent();
	    if (iconParent) iconParent.remove_actor(icon);
            box.add_actor(icon);

            this._insertStatusItem(box, -1);
            let width = 22;
            let height = 22;
            let themeNode = box.get_theme_node();
            if (themeNode.get_length('width')) {
                width = themeNode.get_length('width');
            }
            if (themeNode.get_length('height')) {
                height = themeNode.get_length('height');
            }

            if (global.settings.get_boolean('panel-scale-text-icons')) {
                width = Math.floor(this._panelHeight * ICON_SCALE_FACTOR);
                height = Math.floor(this._panelHeight * ICON_SCALE_FACTOR);
            }

            if (icon.get_width() == 1 || icon.get_height() == 1 || buggyIcons.indexOf(role) != -1) {
                icon.set_height(height);
            }
            else {
                icon.set_size(width, height);
            }
        }
        catch (e) {
            global.logError(e);
        }
    },

    _onTrayIconRemoved: function(o, icon) {
        let box = icon.get_parent();
        if (box && box instanceof St.Bin)
            box.destroy();
    },

    _insertStatusItem: function(actor, position) {
        let children = this.actor.get_children();
        let i;
        for (i = children.length - 1; i >= 0; i--) {
            let rolePosition = children[i]._rolePosition;
            if (position > rolePosition) {
                this.actor.insert_actor(actor, i + 1);
                break;
            }
        }
        if (i == -1) {
            // If we didn't find a position, we must be first
            this.actor.insert_actor(actor, 0);
        }
        actor._rolePosition = position;
    },


};

function main(metadata, orientation, panel_height) {
    let myApplet = new MyApplet(orientation, panel_height);
    return myApplet;
}
