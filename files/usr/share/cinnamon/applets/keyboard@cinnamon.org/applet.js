const Applet = imports.ui.applet;
const XApp = imports.gi.XApp;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const Cairo = imports.cairo;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

const getFlagFileName = name => `/usr/share/iso-flag-png/${name}.png`;

class EmblemedIcon {
    constructor(path, id, style_class) {
        this.path = path;
        this.id = id;

        this.actor = new St.DrawingArea({ style_class: style_class });

        this.actor.connect("style-changed", (...args) => this._style_changed(...args));
        this.actor.connect("repaint", (...args) => this._repaint(...args));
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

        XApp.KbdLayoutController.render_cairo_subscript(
            cr,
            render_x_offset + (render_width / 2), render_y_offset + (render_height / 2),
            render_width / 2,                     render_height / 2,
            this.id
        );

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
    constructor(config, id, indicator, long_name) {
        super();

        this._config = config;
        this._id = id;
        this.label = new St.Label({ text: long_name });
        this.indicator = indicator;
        this.addActor(this.label);
        this.addActor(this.indicator);
    }

    activate(event) {
        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this);
        this._config.set_current_group(this._id);
    }
}

class CinnamonKeyboardApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        try {
            this.metadata = metadata;
            Main.systrayManager.registerRole("keyboard", metadata.uuid);

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.actor.add_style_class_name('panel-status-button');

            this._layoutItems = [ ];

            this._maxSeenWidth = 0;
            this._maxSeenHeight = 0;

            this.im_running = false;

            this.show_flags = false;
            this.use_upper = false;
            this.use_variants = false;

            this.desktop_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.interface" });

            const _syncConfig = () => this._syncConfig();

            this.desktop_settings.connect("changed::keyboard-layout-show-flags", _syncConfig);
            this.desktop_settings.connect("changed::keyboard-layout-use-upper", _syncConfig);
            this.desktop_settings.connect("changed::keyboard-layout-prefer-variant-names", _syncConfig);
            global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, () => this._onPanelEditModeChanged());

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addAction(_("Show Keyboard Layout"), () => {
                Main.overview.hide();
                Util.spawn(['gkbd-keyboard-display', '-g', String(this._config.get_current_group() + 1)]);
            });
            this.menu.addAction(_("Show Character Table"), () => {
                Main.overview.hide();
                Util.spawn(['gucharmap']);
            });
            this.menu.addSettingsAction(_("Keyboard Settings"), 'keyboard');

            Gio.DBus.session.watch_name(
                "org.fcitx.Fcitx", Gio.BusNameWatcherFlags.NONE, 
                (...args) => this._itemAppeared(...args), (...args) => this._itemVanished(...args)
            );
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
        this._config = new XApp.KbdLayoutController();

        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this._syncConfig();
            this._onPanelEditModeChanged();
        } else {
            this._syncConfig();
        }

        this._config.connect('layout-changed', () => this._syncGroup());
        this._config.connect('config-changed', () => this._syncConfig());
    }

    _onButtonPressEvent(actor, event) {
        // Cycle to the next layout
        if (event.get_button() === 2) {
            const selected_group = this._config.get_current_group();
            const new_group = (selected_group + 1) % this._layoutItems.length;
            this._config.set_current_group(new_group);
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

    _setLayoutItems(items, selectedItem) {
        this._selectedLayout = selectedItem;
        for (let i = 0; i < this._layoutItems.length; i++)
            this._layoutItems[i].destroy();
        this._layoutItems = items || [];
    }

    _getIcon(layoutIndex, actorClass) {
        const cfg = this._config;

        let isFlagIcon = false;
        let iconActor = null;
        let iconObject = null;
        let name = cfg.get_icon_name_for_group(layoutIndex);

        if (this.show_flags) {
            const file = Gio.file_new_for_path(getFlagFileName(name));
            if (file.query_exists(null)) {
                iconObject = new EmblemedIcon(file.get_path(), cfg.get_flag_id_for_group(layoutIndex), actorClass);
                iconActor = iconObject.actor;
                isFlagIcon = true;
            }
        }

        if (!isFlagIcon) {
            name = this.use_variants ? cfg.get_variant_label_for_group(layoutIndex) : cfg.get_short_group_label_for_group(layoutIndex);
            name = this.use_upper ? name.toUpperCase() : name;
            iconActor = new St.Label({ text: name });
        }

        return {name, iconObject, iconActor, isFlagIcon};
    }

    _syncConfig() {
        if (!this._config.get_enabled()) {
            this._setLayoutItems([], null);
            this.menu.close();
            this.actor.hide();
            return;
        }

        const layoutItems = [];

        this.show_flags = this.desktop_settings.get_boolean("keyboard-layout-show-flags");
        this.use_upper = this.desktop_settings.get_boolean("keyboard-layout-use-upper");
        this.use_variants = this.desktop_settings.get_boolean("keyboard-layout-prefer-variant-names");

        if (this.show_flags) {
            this._maxSeenWidth = 0;
            this._maxSeenHeight = 0;
        }

        this.actor.show();

        const groups = this._config.get_all_names();

        for (let i = 0; i < groups.length; i++) {
            const {name, iconActor} = this._getIcon(i, "popup-menu-icon");
            const item = new LayoutMenuItem(this._config, i, iconActor, groups[i]);
            layoutItems.push(item);
            this.menu.addMenuItem(item, i);
        }

        this._setLayoutItems(layoutItems, null);

        Mainloop.idle_add(() => this._syncGroup());
    }

    _syncGroup() {
        const selected = this._config.get_current_group();

        if (!this._layoutItems.length) {
            global.logError(new Error('Layouts list is empty'));
            this.actor.hide();
            return;
        }

        if (selected >= this._layoutItems.length) {
            global.logError(new Error(
                `Number of layouts: ${this._layoutItems.length}, selected layout: ${selected}`
            ));
            selected = 0;
            Mainloop.idle_add(() => this._config.set_current_group(0));
            return;
        }

        if (this._selectedLayout) {
            this._selectedLayout.setShowDot(false);
            this._selectedLayout = null;
        }

        const item = this._layoutItems[selected];
        item.setShowDot(true);

        this._selectedLayout = item;

        this.set_applet_tooltip(this._config.get_current_name());

        const _applet_label_box = this._applet_label.get_parent();
        this._applet_icon_box.set_margin_left(0);
        this._applet_icon_box.set_margin_right(0);
        _applet_label_box.set_margin_left(0);
        _applet_label_box.set_margin_right(0);

        const {name, iconActor, iconObject, isFlagIcon} = this._getIcon(selected, "applet-icon");
        if (isFlagIcon) {
            this._applet_icon = iconObject;
            this._applet_icon_box.set_child(iconActor);
            this._applet_icon_box.show();
            this._setStyle();
            this.set_applet_label("");
        } else {
            this.set_applet_label(name);
            this._applet_icon_box.hide();
        }

        const width = this.actor.get_width();
        const height = this.actor.get_height();
        if (width >= this._maxSeenWidth) {
            this._maxSeenWidth = width;
        }
        if (height >= this._maxSeenHeight) {
            this._maxSeenHeight = height;
        } else {
            this.actor.set_height(this._maxSeenHeight);
        }
        const addedWidth = this._maxSeenWidth - width;
        const leftOffset = parseInt(addedWidth / 2);
        const rightOffset = addedWidth - leftOffset; 
        const box = isFlagIcon ? this._applet_icon_box : _applet_label_box;
        box.set_margin_left(leftOffset); box.set_margin_right(rightOffset);

        if (this.im_running) {
        	this.actor.hide();
        } else {
            this.actor.show();
        }
    }

    on_applet_removed_from_panel() {
        Main.systrayManager.unregisterRole("keyboard", this.metadata.uuid);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonKeyboardApplet(metadata, orientation, panel_height, instance_id);
}
