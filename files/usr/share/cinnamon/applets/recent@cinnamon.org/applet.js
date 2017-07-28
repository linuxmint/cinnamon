const DocInfo = imports.misc.docInfo;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Applet = imports.ui.applet;

const PRIVACY_SCHEMA = "org.cinnamon.desktop.privacy";
const REMEMBER_RECENT_KEY = "remember-recent-files";
const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

function MyPopupMenuItem()
{
    this._init.apply(this, arguments);
}

MyPopupMenuItem.prototype =
{
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(icon, text, uri, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
        this.box = new St.BoxLayout({ style_class: 'popup-combobox-item' });
        this.icon = icon;
        this.uri = uri;

        if (this.icon) {
            this.box.add(this.icon);
        }

        this.label = new St.Label({ text: text });
        this.box.add(this.label);
        this.addActor(this.box);
    }
};

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        try {
            this.set_applet_icon_symbolic_name("document-open-recent");
            this.set_applet_tooltip(_("Recent documents"));

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.mainContainer = new St.BoxLayout({ vertical: true });
            this.menu.addActor(this.mainContainer);

            this.recentsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START });
            this.recentsScrollBox.set_auto_scrolling(true);
            this.mainContainer.add(this.recentsScrollBox);

            this.recentsBox = new St.BoxLayout({ vertical:true });
            this.recentsScrollBox.add_actor(this.recentsBox);
            this.recentsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

            this.RecentManager = new DocInfo.DocManager();
            this.privacy_settings = new Gio.Settings( {schema_id: PRIVACY_SCHEMA} );

            this._recentButtons = [];
            this._display();

            this.recent_id = this.RecentManager.connect('changed', Lang.bind(this, this._refreshRecents));
            this.settings_id = this.privacy_settings.connect("changed::" + REMEMBER_RECENT_KEY, Lang.bind(this, this._refreshRecents));
            global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._on_panel_edit_mode_changed));
        }
        catch (e) {
            global.logError(e);
        }
    },

    _on_panel_edit_mode_changed: function () {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            if (!this.actor.visible) {
                this.actor.show();
            }
        } else {
            if (this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY) && !this.actor.visible) {
                this.actor.show();
            } else if (!this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY) && this.actor.visible) {
                this.actor.hide();
            }
        }
    },

    on_applet_removed_from_panel: function () {
        this.RecentManager.disconnect(this.recent_id);
        this.privacy_settings.disconnect(this.settings_id);
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _display: function() {
        this._refreshRecents();
    },

    _launchFile: function(a, b, c, docinfo) {
        docinfo.launch();
    },

    _clearAll: function() {
        let GtkRecent = new Gtk.RecentManager();
        GtkRecent.purge_items();
    },

    destroy: function() {
        this.RecentManager.disconnectAll();
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this._recentButtons = null;
        this.emit('destroy');
    },

    _refreshRecents: function() {
        if (this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY)) {
            let new_recents = [];
            let have_recents = false;

            if (this.RecentManager._infosByTimestamp.length > 0) {
                let id = 0;
                while (id < this.RecentManager._infosByTimestamp.length) {
                    let uri = this.RecentManager._infosByTimestamp[id].uri;

                    let new_button = null;

                    new_button = this._recentButtons.find(button => ((button.uri) && (button.uri == uri)));

                    if (new_button == undefined) {
                         let icon = this.RecentManager._infosByTimestamp[id].createIcon(22);
                         let menuItem = new MyPopupMenuItem(icon, this.RecentManager._infosByTimestamp[id].name, uri, {});
                         this.menu.addMenuItem(menuItem);
                         menuItem.connect('activate', Lang.bind(this, this._launchFile, this.RecentManager._infosByTimestamp[id]));
                         new_button = menuItem;
                    }

                    new_recents.push(new_button);

                    id++;
                }

                let recent_clear_button = null;

                recent_clear_button = this._recentButtons.find(button => ((button.uri) && (button.uri == "clear")));

                if (recent_clear_button == undefined) {
                    let icon = new St.Icon({ icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC, icon_size: 22 });
                    let menuItem = new MyPopupMenuItem(icon, _("Clear list"), "clear", {});
                    menuItem.connect('activate', Lang.bind(this, this._clearAll));

                    recent_clear_button = menuItem;
                }

                have_recents = true;
                new_recents.push(recent_clear_button);
            } else {
                let no_recents_button = null;

                no_recents_button = this._recentButtons.find(button => ((button.uri) && (button.uri == "no-recents")));

                if (no_recents_button == undefined) {
                    let menuItem = new MyPopupMenuItem(null, _("No recent documents"), "no-recents", {});

                    no_recents_button = menuItem;
                }

                new_recents.push(no_recents_button);
            }

            let to_remove = [];

            /* Remove no-longer-valid items */
            for (let i = 0; i < this._recentButtons.length; i++) {
                let button = this._recentButtons[i];

                if (button.uri == "no-recents" && have_recents) {
                    to_remove.push(button);
                } else {
                    if (new_recents.indexOf(button) == -1) {
                        to_remove.push(button);
                    }
                }
            }

            if (to_remove.length > 0) {
                for (let i in to_remove) {
                    to_remove[i].destroy();
                    this._recentButtons.splice(this._recentButtons.indexOf(to_remove[i]), 1);
                }
            }

            to_remove = [];

            /* Now, add new actors, shuffle existing actors */

            let placeholder = this.recentsBox.get_first_child();

            for (let i = 0; i < new_recents.length; i++) {
                let actor = new_recents[i].actor;

                let parent = actor.get_parent();
                if (parent != null) {
                    parent.remove_child(actor);
                }

                if (actor != placeholder) {
                    this.recentsBox.insert_child_above(actor, placeholder);
                } else {
                    this.recentsBox.add_child(actor);
                }

                placeholder = actor;
            }

            this._recentButtons = new_recents;

            this.actor.show();
        } else {
            for (let i = 0; i < this._recentButtons.length; i ++) {
                this._recentButtons[i].destroy();
            }

            this._recentButtons = [];
            this.actor.hide();
        }
        this._on_panel_edit_mode_changed();
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
