const Applet = imports.ui.applet;
const XApp = imports.gi.XApp;
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Cairo = imports.cairo;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

class EmblemedIcon {
    constructor(path, id, style_class) {
        this.path = path;
        this.id = id;

        this.actor = new St.DrawingArea({ style_class: style_class });

        this.actor.connect("style-changed", Lang.bind(this, this._style_changed));
        this.actor.connect("repaint", Lang.bind(this, this._repaint));
    }

    _style_changed(actor) {
        const icon_size = 0.5 + this.actor.get_theme_node().get_length("icon-size");

        this.actor.natural_width = this.actor.natural_height = icon_size;
    }

    _repaint(actor) {
        const cr = actor.get_context();
        const [w, h] = actor.get_surface_size();

        cr.save();

        const surf = St.TextureCache.get_default().load_file_to_cairo_surface(this.path);
        const surf_width = surf.getWidth();
        const surf_height = surf.getHeight();

        let [new_w, new_h] = [w, h];
        const aspect = surf_width / surf_height;
        if ((new_w / new_h) > aspect) {
            new_w = new_h * aspect;
        }

        const factor = new_w / surf_width;

        const render_width = surf_width * factor;
        const render_height = surf_height * factor;

        const surf_x_offset = ((w / factor) - surf_width) / 2;
        const surf_y_offset = ((h / factor) - surf_height) / 2;

        const render_x_offset = (new_w - render_width) / 2;
        const render_y_offset = (new_h - render_height) / 2;

        cr.scale(factor, factor);
        cr.setSourceSurface(surf, surf_x_offset, surf_y_offset);

        cr.getSource().setFilter(Cairo.Filter.BEST);
        cr.setOperator(Cairo.Operator.SOURCE);

        cr.paint();

        cr.restore();

        XApp.KbdLayoutController.render_cairo_subscript(cr,
                                                        render_x_offset + (render_width / 2),
                                                        render_y_offset + (render_height / 2),
                                                        render_width / 2,
                                                        render_height / 2,
                                                        this.id);

        cr.$dispose();
    }

    /* Monkey patch St.Icon functions used in js/ui/applet.js IconApplet so
       we can use its _setStyle() function for figuring out how big we should
       be
     */
    get_icon_type() {
        return St.IconType.FULLCOLOR;
    }

    set_icon_size(size) {
        this.actor.width = this.actor.height = size * global.ui_scale;
    }

    set_style_class_name(name) {
        return;
    }
}

class LayoutMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(id, indicator, long_name) {
        super();

        this._id = id;
        this.label = new St.Label({ text: long_name });
        this.indicator = indicator;
        this.addActor(this.label);
        this.addActor(this.indicator);
    }

    activate(event) {
        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this);

        Mainloop.timeout_add(100, Lang.bind(this, function() {
            Main.keyboardLayoutManager.set_current_group(this._id);
        }))
    }
}

class CinnamonKeyboardApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        try {
            this.metadata = metadata;
            Main.systrayManager.registerRole("keyboard", metadata.uuid);

            this._config = Main.keyboardLayoutManager;

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
    }

    _onPanelEditModeChanged() {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            if (!this.actor.visible) {
                this.set_applet_icon_symbolic_name("input-keyboard");
                this.actor.show();
            }
        }
        else {
            this._syncConfig();
        }
    }

    on_applet_added_to_panel() {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this._syncConfig();
            this._onPanelEditModeChanged();
        } else {
            this._syncConfig();
        }

        Main.keyboardLayoutManager.connect('layout-changed', Lang.bind(this, this._syncGroup));
        Main.keyboardLayoutManager.connect('config-changed', Lang.bind(this, this._syncConfig));
    }

    _onButtonPressEvent(actor, event) {
        // Cycle to the next layout
        if (event.get_button() === 2) {
            const selected_group = this._config.get_current_group_idx();
            const new_group = (selected_group + 1) % this._layoutItems.length;
            Main.keyboardLayoutManager.set_current_group(new_group);
        }
        return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _itemAppeared(proxy, busName, owner) {
        this.im_running = true;
        this._syncConfig();
    }

    _itemVanished(proxy, busName) {
        this.im_running = false;
        this._syncConfig();
    }

    _syncConfig() {
        for (let i = 0; i < this._layoutItems.length; i++)
            this._layoutItems[i].destroy();

        this._selectedLayout = null;
        this._layoutItems = [ ];

        if (!this._config.have_multiple_layouts()) {
            this.menu.close();
            this.actor.hide();
            return;
        }

        this.show_flags = this.desktop_settings.get_boolean("keyboard-layout-show-flags");
        this.use_upper = this.desktop_settings.get_boolean("keyboard-layout-use-upper");
        this.use_variants = this.desktop_settings.get_boolean("keyboard-layout-prefer-variant-names");

        this.actor.show();

        for (let i = 0; i < this._config.get_n_layouts(); i++) {
            let handled = false;
            let actor = null;

            if (this.show_flags) {
                const name = this._config.get_layout_name(i);

                const file = Gio.file_new_for_path("/usr/share/iso-flag-png/" + name + ".png");

                if (file.query_exists(null)) {
                    // FIXME: dedupe flag id
                    actor = new EmblemedIcon(file.get_path(), 0, "popup-menu-icon").actor;
                    handled = true;
                }
            }

            if (!handled) {
                let name;

                if (this.use_variants) {
                    name = this._config.get_group_variant_name(i);
                } else {
                    name = this._config.get_group_short_name(i);
                }

                name = this.use_upper ? name.toUpperCase() : name;
                actor = new St.Label({ text: name });
            }

            const item = new LayoutMenuItem(i, actor, this._config.get_group_display_name(i));
            this._layoutItems.push(item);
            this.menu.addMenuItem(item, i);
        }

        Mainloop.idle_add(Lang.bind(this, this._syncGroup));
    }

    _syncGroup() {
        const selected = this._config.get_current_group_idx();

        if (this._selectedLayout) {
            this._selectedLayout.setShowDot(false);
            this._selectedLayout = null;
        }

        const item = this._layoutItems[selected];
        item.setShowDot(true);

        this._selectedLayout = item;

        this.set_applet_tooltip(this._config.get_group_display_name(selected));

        let handled = false;

        if (this.show_flags) {
            const file = Gio.file_new_for_path("/usr/share/iso-flag-png/" + this._config.get_layout_name(selected) + ".png");

            if (file.query_exists(null)) {
                // FIXME: dedupe
                // this._applet_icon = new EmblemedIcon(file.get_path(), this._config.get_current_flag_id(), "applet-icon");
                this._applet_icon = new EmblemedIcon(file.get_path(), 0, "applet-icon");
                this._applet_icon_box.set_child(this._applet_icon.actor);
                this._applet_icon_box.show();

                this._setStyle();

                this.set_applet_label("");

                handled = true;
            }
        }

        if (!handled) {
            let name;

            if (this.use_variants) {
                name = "xx" // FIXME: this._config.get_current_variant_label();
            } else {
                name = this._config.get_group_short_name(selected);
                // name = this._config.get_current_short_group_label();
            }

            name = this.use_upper ? name.toUpperCase() : name;

            this.set_applet_label(name);
            this._applet_icon_box.hide();
        }

        if (this._config.get_ibus_active()) {
            this.actor.hide();
        }
    }

    on_applet_removed_from_panel() {
        Main.systrayManager.unregisterRole("keyboard", this.metadata.uuid);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonKeyboardApplet(metadata, orientation, panel_height, instance_id);
}
