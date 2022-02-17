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

const POPUP_MENU_ICON_STYLE_CLASS = "popup-menu-icon";
const APPLET_ICON_STYLE_CLASS = "applet-icon";

const getFlagFileName = name => `/usr/share/iso-flag-png/${name}.png`;

class EmblemedIcon {
    constructor(file_path, dupe_id, style_class) {
        this.dupe_id = dupe_id;

        this.img = { surface: St.TextureCache.get_default().load_file_to_cairo_surface(file_path) };
        this.img.width = this.img.surface.getWidth();
        this.img.height = this.img.surface.getHeight();
        this.img.sizes = [this.img.width, this.img.height];
        const aspect = this.img.width / this.img.height;

        this.HORIZONTAL_SCALE = aspect;
        this.STYLE_CLASS_SCALE = (style_class == POPUP_MENU_ICON_STYLE_CLASS) ? aspect : 1;  

        this.actor = new St.DrawingArea({ style_class });
        this.actor.connect("style-changed", () => this._style_changed());
        this.actor.connect("repaint", (...args) => this._repaint(...args));
    }

    _calc_natural_sizes(base_size) {
        const height = base_size * this.STYLE_CLASS_SCALE;
        const width = height * this.HORIZONTAL_SCALE;
        return [width, height];
    }

    _style_changed() {
        const base_size = Math.round(this.actor.get_theme_node().get_length("icon-size"));
        [this.actor.natural_width, this.actor.natural_height] = this._calc_natural_sizes(base_size);
    }

    _repaint(actor) {
        const cr = actor.get_context();
        const [w, h] = actor.get_surface_size();

        cr.save();

        const factor = Math.min(w / this.img.width, h / this.img.height);

        const img_offset_x = ((w / factor) - this.img.width) / 2;
        const img_offset_y = ((h / factor) - this.img.height) / 2;

        const render_sizes = this.img.sizes.map(x => x * factor);

        const render_offset_x = (w - render_sizes[0]) / 2;
        const render_offset_y = (h - render_sizes[1]) / 2;

        cr.scale(factor, factor);
        cr.setSourceSurface(this.img.surface, img_offset_x, img_offset_y);
        cr.getSource().setFilter(Cairo.Filter.BEST);
        cr.setOperator(Cairo.Operator.SOURCE);

        cr.paint();
        cr.restore();

        const [render_center_x, render_center_y] = render_sizes.map(x => x / 2);

        XApp.KbdLayoutController.render_cairo_subscript(
            cr,
            render_offset_x + render_center_x, render_offset_y + render_center_y,
            render_center_x,                   render_center_y,
            this.dupe_id
        );

        cr.$dispose();
    }

    destroy() {
        const actor = this.actor;
        Mainloop.idle_add(() => actor.destroy());
    }

    /* Monkey patch St.Icon functions used in js/ui/applet.js IconApplet so
       we can use its _setStyle() function for figuring out how big we should
       be
     */
    get_icon_type() {
        return St.IconType.FULLCOLOR;
    }

    set_icon_size(size) {
        [this.actor.width, this.actor.height] = this._calc_natural_sizes(size * global.ui_scale);
    }

    set_style_class_name(name) { }
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

        this._layoutItems = [ ];
        this._layoutIcons = [ ];

        this._maxSeenWidth = this._maxSeenHeight = 0;
        this.im_running = false;
        this.show_flags = this.use_upper = this.use_variants = false;

        try {
            this.metadata = metadata;
            Main.systrayManager.registerRole("keyboard", metadata.uuid);

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.actor.add_style_class_name('panel-status-button');

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
        } else {
            this._syncConfig();
        }
    }

    on_applet_added_to_panel() {
        this._config = new XApp.KbdLayoutController();
        this._syncConfig();
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this._onPanelEditModeChanged();
        }
        this._config.connect('layout-changed', () => this._syncGroup());
        this._config.connect('config-changed', () => this._syncConfig());
        this.connect('orientation-changed', () => this.on_orientation_changed());
    }

    on_orientation_changed() {
        this._maxSeenWidth = this._maxSeenHeight = 0;
        this._syncGroup();
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

    _setLayoutItems(items) {
        this._selectedLayout = null;
        this._layoutItems.forEach(item => item.destroy());
        this._layoutItems = items || [];
    }

    _setLayoutIcons(icons) {
        this._layoutIcons.forEach(icon => 
            icon.isFlagIcon ? icon.iconInstance.destroy() : icon.iconActor.destroy()
        );
        this._layoutIcons = icons || [];
    }

    _createIcon(layoutIndex, actorClass) {
        const cfg = this._config;

        let isFlagIcon = false;
        let iconActor = null;
        let iconInstance = null;
        let name = cfg.get_icon_name_for_group(layoutIndex);

        if (this.show_flags) {
            const file = Gio.file_new_for_path(getFlagFileName(name));
            if (file.query_exists(null)) {
                iconInstance = new EmblemedIcon(file.get_path(), cfg.get_flag_id_for_group(layoutIndex), actorClass);
                iconActor = iconInstance.actor;
                isFlagIcon = true;
            }
        }

        if (!isFlagIcon) {
            name = this.use_variants ? cfg.get_variant_label_for_group(layoutIndex) : cfg.get_short_group_label_for_group(layoutIndex);
            name = this.use_upper ? name.toUpperCase() : name;
            iconActor = new St.Label({ text: name });
        }

        return {name, iconInstance, iconActor, isFlagIcon};
    }

    _setMargin(actor, left, right) {
        actor.set_style(`margin-left: ${left}px; margin-right: ${right}px;`);
    }

    _syncConfig() {
        if (!this._config.get_enabled()) {
            this._setLayoutItems([]);
            this.menu.close();
            this.actor.hide();
            return;
        }

        const layoutItems = [];
        const layoutIcons = [];

        this.show_flags = this.desktop_settings.get_boolean("keyboard-layout-show-flags");
        this.use_upper = this.desktop_settings.get_boolean("keyboard-layout-use-upper");
        this.use_variants = this.desktop_settings.get_boolean("keyboard-layout-prefer-variant-names");

        if (this.show_flags) {
            this._maxSeenWidth = this._maxSeenHeight = 0;
        }

        this.actor.show();

        const groups = this._config.get_all_names();

        for (let i = 0; i < groups.length; i++) {
            const popupIconInfo = this._createIcon(i, POPUP_MENU_ICON_STYLE_CLASS);
            const menuItem = new LayoutMenuItem(this._config, i, popupIconInfo.iconActor, groups[i]);
            layoutItems.push(menuItem);
            this.menu.addMenuItem(menuItem, i);
            const appletIconInfo = this._createIcon(i, APPLET_ICON_STYLE_CLASS);
            layoutIcons.push(appletIconInfo);
        }

        this._setLayoutItems(layoutItems);
        this._setLayoutIcons(layoutIcons);

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
        this._setMargin(_applet_label_box, 0, 0);
        this._setMargin(this._applet_icon_box, 0, 0);

        const {name, iconActor, iconInstance, isFlagIcon} = this._layoutIcons[selected];
        if (isFlagIcon) {
            this._applet_icon = iconInstance;
            this._applet_icon_box.set_child(iconActor);
            this._applet_icon_box.show();
            this._setStyle();
            this.set_applet_label("");
        } else {
            this.set_applet_label(name);
            this._applet_icon_box.hide();
        }

        const box = isFlagIcon ? this._applet_icon_box : _applet_label_box;
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
        this._setMargin(box, leftOffset, rightOffset);
        if (isFlagIcon) {
            this._setStyle();
        }

        this.im_running ? this.actor.hide() : this.actor.show();
    }

    on_applet_removed_from_panel() {
        Main.systrayManager.unregisterRole("keyboard", this.metadata.uuid);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonKeyboardApplet(metadata, orientation, panel_height, instance_id);
}
