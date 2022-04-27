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

class MyPopupMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(icon, text, uri, params) {
        super(params);
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

class CinnamonRecentApplet extends Applet.IconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

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
        this.recentsScrollBox.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);

        this.RecentManager = DocInfo.getDocManager();
        this.privacy_settings = new Gio.Settings( {schema_id: PRIVACY_SCHEMA} );

        this._recentButtons = [];
        this._refreshRecents();

        this.recent_id = this.RecentManager.connect('changed', Lang.bind(this, this._refreshRecents));
        this.settings_id = this.privacy_settings.connect("changed::" + REMEMBER_RECENT_KEY, Lang.bind(this, this._refreshRecents));
        global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._on_panel_edit_mode_changed));
    }

    _on_panel_edit_mode_changed () {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this.actor.show();
        } else {
            this.actor.visible = this._recentButtons.length > 0;
        }
    }

    on_applet_removed_from_panel () {
        this.RecentManager.disconnect(this.recent_id);
        this.privacy_settings.disconnect(this.settings_id);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _launchFile(a, b, c, uri) {
        this.menu.toggle();
        Gio.app_info_launch_default_for_uri(uri, global.create_app_launch_context());
    }

    _clearAll() {
        let GtkRecent = new Gtk.RecentManager();
        GtkRecent.purge_items();
    }

    destroy() {
        this.RecentManager.disconnectAll();
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this._recentButtons = null;
        this.emit('destroy');
    }

    _refreshRecents() {
        // Clean content
        for (let i = 0; i < this._recentButtons.length; i ++) {
            this._recentButtons[i].destroy();
        }
        this._recentButtons = [];

        if (this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY)) {
            if (this.RecentManager._infosByTimestamp.length > 0) {
                let id = 0;
                while (id < this.RecentManager._infosByTimestamp.length) {
                    let recent = this.RecentManager._infosByTimestamp[id];
                    let button = new MyPopupMenuItem(recent.createIcon(22), recent.name, recent.uri, {});
                    button.connect('activate', Lang.bind(this, this._launchFile, recent.uri));
                    this._recentButtons.push(button);
                    this.recentsBox.add_child(button.actor);
                    id++;
                }
                let separator = new PopupMenu.PopupSeparatorMenuItem();
                this._recentButtons.push(separator);
                this.recentsBox.add_child(separator.actor);
                let icon = new St.Icon({ icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC, icon_size: 22 });
                let clear_button = new MyPopupMenuItem(icon, _("Clear list"), "clear", {});
                clear_button.connect('activate', Lang.bind(this, this._clearAll));
                this._recentButtons.push(clear_button);
                this.recentsBox.add_child(clear_button.actor);
            } else {
                let no_recents_button = new MyPopupMenuItem(null, _("No recent documents"), "no-recents", {});
                this._recentButtons.push(no_recents_button);
                this.recentsBox.add_child(no_recents_button.actor);
            }
            this.actor.show();
        } else {
            this.actor.hide();
        }
        this._on_panel_edit_mode_changed();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonRecentApplet(orientation, panel_height, instance_id);
}
