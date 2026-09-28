const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Main = imports.ui.main;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

class CinnamonSlideshowApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        this._slideshowSettings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.background.slideshow" });

        this._pausedId = this._slideshowSettings.connect("changed::slideshow-paused",
                                                         () => this._update_icon());
        this._backgroundChangedId = Main.backgroundManager.connect("changed",
                                                                   () => this._update_icon());

        this._background_section = new PopupMenu.PopupMenuSection();
        this._applet_context_menu.addMenuItem(this._background_section);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.next_image_context_menu_item = new PopupMenu.PopupIconMenuItem(_("Next Background"),
                "xsi-media-seek-forward",
                St.IconType.SYMBOLIC);
        this.next_image_context_menu_item.connect('activate', () => this.get_next_image());
        this._applet_context_menu.addMenuItem(this.next_image_context_menu_item);

        this._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.open_settings_context_menu_item = new PopupMenu.PopupIconMenuItem(_("Background Settings"),
                "xsi-wallpaper",
                St.IconType.SYMBOLIC);
        this.open_settings_context_menu_item.connect('activate', () => {
            Util.spawnCommandLine("cinnamon-settings backgrounds");
        });
        this._applet_context_menu.addMenuItem(this.open_settings_context_menu_item);

        this._applet_context_menu.connect('open-state-changed', () => this._update_background_names());

        this._update_icon();
    }

    _summary() {
        return Main.backgroundManager.getBackgroundSummary();
    }

    on_applet_clicked(event) {
        if (!this._summary().slideshowActive)
            return;
        let paused = this._slideshowSettings.get_boolean("slideshow-paused");
        this._slideshowSettings.set_boolean("slideshow-paused", !paused);
        this._update_icon();
    }

    _update_icon() {
        if (!this._summary().slideshowActive) {
            this.set_applet_icon_symbolic_name('slideshow-disabled');
            this.set_applet_tooltip(_("The slideshow is off"));
        } else if (this._slideshowSettings.get_boolean("slideshow-paused")) {
            this.set_applet_icon_symbolic_name('slideshow-pause');
            this.set_applet_tooltip(_("Click to resume the slideshow"));
        } else {
            this.set_applet_icon_symbolic_name('slideshow-play');
            this.set_applet_tooltip(_("Click to pause the slideshow"));
        }
    }

    _update_background_names() {
        this._background_section.removeAll();
        let summary = this._summary();

        if (summary.multi) {
            for (let e of summary.entries) {
                this._background_section.addMenuItem(
                    new PopupMenu.PopupMenuItem("%s: %s".format(e.monitor, e.name), { reactive: false }));
            }
        } else {
            let name = summary.entries.length ? summary.entries[0].name : _("(none)");
            this._background_section.addMenuItem(
                new PopupMenu.PopupMenuItem(_("Current background: ") + name, { reactive: false }));
        }
    }

    get_next_image() {
        Main.slideshowManager.getNextImage();
    }

    on_applet_removed_from_panel() {
        if (this._backgroundChangedId) {
            Main.backgroundManager.disconnect(this._backgroundChangedId);
            this._backgroundChangedId = 0;
        }
        if (this._pausedId) {
            this._slideshowSettings.disconnect(this._pausedId);
            this._pausedId = 0;
        }
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new CinnamonSlideshowApplet(metadata, orientation, panel_height, instanceId);
}
