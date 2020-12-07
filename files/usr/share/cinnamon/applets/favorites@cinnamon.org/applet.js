const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Applet = imports.ui.applet;
const XApp = imports.gi.XApp;
const Settings = imports.ui.settings;

class FavoriteMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(info, show_full_uri, params) {
        super(params);
        this.box = new St.BoxLayout({ style_class: 'popup-combobox-item' });
        this.info = info;

        let icon = St.TextureCache.get_default().load_gicon(null, Gio.content_type_get_icon(info.cached_mimetype), 24);

        let display_text = null;

        if (show_full_uri) {
            let file = Gio.File.new_for_uri(info.uri);
            if (file.is_native() || file.get_path() != null) {
                display_text = file.get_path().replace(GLib.get_home_dir(), "~");
            } else {
                display_text = info.uri;
            }
        } else {
            display_text = info.display_name;
        }

        this.box.add(icon);

        let label = new St.Label({ text: display_text, y_align: Clutter.ActorAlign.CENTER });

        this.box.add(label);
        this.addActor(this.box);
    }
};

class NoFavoriteMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor() {
        super({});
        this.box = new St.BoxLayout({ style_class: 'popup-combobox-item' });

        let label = new St.Label({ text: _("No favorites"), y_align: Clutter.ActorAlign.CENTER });

        this.box.add(label);
        this.addActor(this.box);
        this.box.reactive = false;
    }
};

class CinnamonFavoriteApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        log("new fav app");
        this.set_applet_icon_symbolic_name("xapp-user-favorites-symbolic");
        this.set_applet_tooltip(_("Favorites"));

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.mainContainer = new St.BoxLayout({ vertical: true });
        this.menu.addActor(this.mainContainer);

        this.favoritesScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START });
        this.favoritesScrollBox.set_auto_scrolling(true);
        this.mainContainer.add(this.favoritesScrollBox);

        this.favoritesBox = new St.BoxLayout({ vertical:true });
        this.favoritesScrollBox.add_actor(this.favoritesBox);
        this.favoritesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.favoritesScrollBox.add_style_class_name("vfade");

        this.settings = new Settings.AppletSettings(this, metadata.uuid, this.instance_id);

        this.settings.bind("show-full-uri", "_show_full_uri", this.settings_changed);

        this.favorites = new XApp.Favorites();

        this._favoriteButtons = [];
        this._refreshFavorites();

        this.favorites_id = this.favorites.connect('changed', ()=>this._refreshFavorites());
    }

    settings_changed() {
        this._refreshFavorites();
    }

    on_panel_edit_mode_changed() {
        let reactive = !global.settings.get_boolean('panel-edit-mode');
        this.actor.visible = reactive;
    }

    on_applet_removed_from_panel () {
        if (this.favorites_id > 0) {
            this.favorites.disconnect(this.favorites_id);
            this.favorites_id = 0;
        }

        this.favorites = null;
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _launchFile(a, b, c, uri) {
        this.favorites.launch(uri)
    }

    destroy() {
        if (this.favorites_id > 0) {
            this.favorites.disconnect(this.favorites_id);
            this.favorites_id = 0;
        }

        this.favorites = null;
        this.actor._delegate = null;
        this.menu.destroy();
        this.emit('destroy');
    }

    _refreshFavorites() {
        // Clean content
        for (let i = 0; i < this._favoriteButtons.length; i ++) {
            this._favoriteButtons[i].destroy();
        }
        this._favoriteButtons = [];
        let infos = this.favorites.get_favorites(null);

        if (infos.length > 0) {
            for (let i = 0; i < infos.length; i++) {
                let info = infos[i];

                let button = new FavoriteMenuItem(info, this._show_full_uri);

                button.connect("activate", (button, event)=> {
                    this.favorites.launch(button.info.uri, event.get_time());
                    this.menu.toggle();
                })

                this._favoriteButtons.push(button);
                this.favoritesBox.add_child(button.actor);
            }
        } else {
            let button = new NoFavoriteMenuItem();
            this._favoriteButtons.push(button);
            this.favoritesBox.add_child(button.actor);
        }

        // Can't set a max height so limit it based on the number of favorites.
        if (infos.length < 10) {
            this.favoritesScrollBox.set_height(-1);
        } else {
            this.favoritesScrollBox.set_height(400 * global.ui_scale);
        }

        this.on_panel_edit_mode_changed();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonFavoriteApplet(metadata, orientation, panel_height, instance_id);
}
