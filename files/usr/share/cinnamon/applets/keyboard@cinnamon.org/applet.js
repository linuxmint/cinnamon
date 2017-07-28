const Applet = imports.ui.applet;
const XApp = imports.gi.XApp;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Cairo = imports.cairo;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

function EmblemedIcon() {
    this._init.apply(this, arguments);
}

EmblemedIcon.prototype = {
    _init: function(path, id, style_class) {
        this.path = path;
        this.id = id;

        this.actor = new St.DrawingArea({ style_class: style_class });

        this.actor.connect("style-changed", Lang.bind(this, this._style_changed));
        this.actor.connect("repaint", Lang.bind(this, this._repaint));
    },

    _style_changed: function(actor) {
        let icon_size = 0.5 + this.actor.get_theme_node().get_length("icon-size");

        this.actor.natural_width = this.actor.natural_height = icon_size;
    },

    _repaint: function(actor) {
        let cr = actor.get_context();
        let [w, h] = actor.get_surface_size();

        cr.save()

        let surf = St.TextureCache.get_default().load_file_to_cairo_surface(this.path);

        let factor = w / surf.getWidth();

        let true_width = surf.getWidth() * factor;
        let true_height = surf.getHeight() * factor;

        let y_offset = 0;
        let x_offset = 0;

        if (surf.getWidth() >= surf.getHeight()) {
            x_offset = 0;
            y_offset = ((h * (1 / factor)) - surf.getHeight()) / 2;
        } else {
            x_offset = ((w * (1 / factor)) - surf.getWidth()) / 2;
            y_offset = 0;
        }

        let true_x_offset = (w - true_width) / 2;
        let true_y_offset = (h - true_height) / 2;

        cr.scale(factor, factor);
        cr.setSourceSurface(surf, x_offset, y_offset);

        cr.getSource().setFilter(Cairo.Filter.BEST);
        cr.setOperator(Cairo.Operator.SOURCE);

        cr.paint();

        cr.restore()

        XApp.KbdLayoutController.render_cairo_subscript(cr,
                                                        true_x_offset + (true_width / 2),
                                                        true_y_offset + (true_height / 2),
                                                        true_width / 2,
                                                        true_height / 2,
                                                        this.id);

        cr.$dispose();
    },

    /* Monkey patch St.Icon functions used in js/ui/applet.js IconApplet so
       we can use its _setStyle() function for figuring out how big we should
       be
     */
    get_icon_type: function() {
        return St.IconType.FULLCOLOR;
    },

    set_icon_size: function(size) {
        this.actor.width = this.actor.height = size;
    },

    set_style_class_name: function(name) {
        return;
    }
}

function LayoutMenuItem() {
    this._init.apply(this, arguments);
}

LayoutMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(config, id, indicator, long_name) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this._config = config;
        this._id = id;
        this.label = new St.Label({ text: long_name });
        this.indicator = indicator;
        this.addActor(this.label);
        this.addActor(this.indicator);
    },

    activate: function(event) {
        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this);
        this._config.set_current_group(this._id);
    }
};

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        try {
            this.metadata = metadata;
            Main.systrayManager.registerRole("keyboard", metadata.uuid);

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.actor.add_style_class_name('panel-status-button');

            this._layoutItems = [ ];

            this.show_flags = false;
            this.use_upper = false;
            this.use_variants = false;

            this.desktop_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.interface" });

            this.desktop_settings.connect("changed::keyboard-layout-show-flags", Lang.bind(this, this._syncConfig));
            this.desktop_settings.connect("changed::keyboard-layout-use-upper", Lang.bind(this, this._syncConfig));
            this.desktop_settings.connect("changed::keyboard-layout-prefer-variant-names", Lang.bind(this, this._syncConfig));
            global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._onPanelEditModeChanged));

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addAction(_("Show Keyboard Layout"), Lang.bind(this, function() {
                Main.overview.hide();
                Util.spawn(['gkbd-keyboard-display', '-g', String(this._config.get_current_group() + 1)]);
            }));
            this.menu.addAction(_("Show Character Table"), Lang.bind(this, function() {
                Main.overview.hide();
                Util.spawn(['gucharmap']);
            }));
            this.menu.addSettingsAction(_("Keyboard Settings"), 'keyboard');
        }
        catch (e) {
            global.logError(e);
        }
    },

    _onPanelEditModeChanged: function() {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            if (!this.actor.visible) {
                this.set_applet_icon_symbolic_name("input-keyboard");
                this.actor.show();
            }
        }
        else {
            this._syncConfig();
        }
    },

    on_applet_added_to_panel: function() {
        this._config = new XApp.KbdLayoutController();

        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this._syncConfig();
            this._onPanelEditModeChanged();
        } else {
            this._syncConfig();
        }

        this._config.connect('layout-changed', Lang.bind(this, this._syncGroup));
        this._config.connect('config-changed', Lang.bind(this, this._syncConfig));
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _syncConfig: function() {
        for (let i = 0; i < this._layoutItems.length; i++)
            this._layoutItems[i].destroy();

        this._selectedLayout = null;
        this._layoutItems = [ ];

        if (!this._config.get_enabled()) {
            this.menu.close();
            this.actor.hide();
            return;
        }

        this.show_flags = this.desktop_settings.get_boolean("keyboard-layout-show-flags");
        this.use_upper = this.desktop_settings.get_boolean("keyboard-layout-use-upper");
        this.use_variants = this.desktop_settings.get_boolean("keyboard-layout-prefer-variant-names");

        this.actor.show();

        let groups = this._config.get_all_names();

        for (let i = 0; i < groups.length; i++) {
            let handled = false;
            let actor = null;

            if (this.show_flags) {
                let name = this._config.get_icon_name_for_group(i);

                let file = Gio.file_new_for_path("/usr/share/iso-flag-png/" + name + ".png");

                if (file.query_exists(null)) {
                    actor = new EmblemedIcon(file.get_path(), this._config.get_flag_id_for_group(i), "popup-menu-icon").actor;
                    handled = true;
                }
            }

            if (!handled) {
                let name;

                if (this.use_variants) {
                    name = this._config.get_variant_label_for_group(i);
                } else {
                    name = this._config.get_short_group_label_for_group(i);
                }

                name = this.use_upper ? name.toUpperCase() : name;
                actor = new St.Label({ text: name })
            }

            let item = new LayoutMenuItem(this._config, i, actor, groups[i]);
            this._layoutItems.push(item);
            this.menu.addMenuItem(item, i);
        }

        Mainloop.idle_add(Lang.bind(this, this._syncGroup));
    },

    _syncGroup: function() {
        let selected = this._config.get_current_group();

        if (this._selectedLayout) {
            this._selectedLayout.setShowDot(false);
            this._selectedLayout = null;
        }

        let item = this._layoutItems[selected];
        item.setShowDot(true);

        this._selectedLayout = item;

        this.set_applet_tooltip(this._config.get_current_name());

        let handled = false;

        if (this.show_flags) {
            let name = this._config.get_current_icon_name();

            let file = Gio.file_new_for_path("/usr/share/iso-flag-png/" + name + ".png");

            if (file.query_exists(null)) {
                this._applet_icon = new EmblemedIcon(file.get_path(), this._config.get_current_flag_id(), "applet-icon");
                this._applet_icon_box.set_child(this._applet_icon.actor);

                this._setStyle();

                this.set_applet_label("");

                handled = true;
            }
        }

        if (!handled) {
            let name;

            if (this.use_variants) {
                name = this._config.get_current_variant_label();
            } else {
                name = this._config.get_current_short_group_label();
            }

            name = this.use_upper ? name.toUpperCase() : name;

            this.set_applet_label(name)
            this.hide_applet_icon()
        }
    },

    on_applet_removed_from_panel: function() {
        Main.systrayManager.unregisterRole("keyboard", this.metadata.uuid);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
