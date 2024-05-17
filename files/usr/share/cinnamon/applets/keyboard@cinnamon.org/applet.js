const Applet = imports.ui.applet;
const XApp = imports.gi.XApp;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const Cairo = imports.cairo;
const Signals = imports.signals;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

const POPUP_MENU_ICON_STYLE_CLASS = "popup-menu-icon";
const APPLET_ICON_STYLE_CLASS = "applet-icon";

const getFlagFileName = name => `/usr/share/iso-flag-png/${name}.png`;

class EmblemedIcon {
    constructor(file_path, layout_dupe_id, style_class) {
        this.layout_dupe_id = layout_dupe_id;

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
            this.layout_dupe_id
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
        [this.actor.width, this.actor.height] = this._calc_natural_sizes(size * global.ui_scale);
    }

    set_style_class_name(name) { }
}

class LayoutMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(layout_setter, indicator, long_name) {
        super();

        this._layout_setter = layout_setter;
        this.label = new St.Label({ text: long_name });
        this.indicator = indicator;
        this.addActor(this.label);
        this.addActor(this.indicator);
    }

    activate(event) {
        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this);
        this._layout_setter();
    }
}

class KbdLayoutController {
    constructor() {
        this._bus_watch_id = 0;
        this._layouts = [];
        this._current_layout_idx = 0;
    }

    applet_added() {
        this._xappController = new XApp.KbdLayoutController();
        this._xappController.connect('layout-changed', () => this._on_layout_changed());
        this._xappController.connect('config-changed', () => this._on_config_changed());

        if (this._bus_watch_id === 0) {
            const on_ibus = (is_active) => {
                this._ibus_active = is_active;
                this.emit("layout-changed");
                this.emit("config-changed");
            };
            this._bus_watch_id = Gio.DBus.session.watch_name(
                "org.fcitx.Fcitx", Gio.BusNameWatcherFlags.NONE,
                () => on_ibus(true), () => on_ibus(false)
            );
        }

        this._on_config_changed();
    }

    applet_removed() {
        if (this._bus_watch_id > 0) {
            Gio.DBus.session.unwatch_name(this._bus_watch_id);
            this._bus_watch_id = 0;
        }
    }

    _retrieve_current_layout_idx() {
        let idx = this._xappController.get_enabled() ?
            this._xappController.get_current_group() : 0;
        if (idx >= this.get_layouts_count()) {
            this.set_current_layout_idx(0);
        } else {
            this._current_layout_idx = idx;
        }
    }

    _on_layout_changed() {
        this._retrieve_current_layout_idx();
        this.emit("layout-changed");
    }

    _on_config_changed() {
        if (this._xappController.get_enabled()) {
            const layouts = [];

            const groups = this._xappController.get_all_names();
            for (let i = 0; i < groups.length; i++) {
                layouts.push({
                    display_name: groups[i],
                    flag_name: this._xappController.get_icon_name_for_group(i),
                    layout_dupe_id: this._xappController.get_flag_id_for_group(i),
                    short_name: this._xappController.get_short_group_label_for_group(i),
                    variant_name: this._xappController.get_variant_label_for_group(i),
                });
            }
            this._layouts = layouts;
            this._retrieve_current_layout_idx();
        } else {
            this._layouts = [];
            this._current_layout_idx = 0;
        }

        this.emit("config-changed");
    }

    have_multiple_layouts() {
        return (this.get_layouts_count() > 1) || false;
    }

    get_layouts_count() {
        return this._layouts?.length || 0;
    }

    get_current_layout_idx() {
        return this._current_layout_idx || 0;
    }

    set_current_layout_idx(idx) {
        if (this._xappController.get_enabled()) {
            this._xappController.set_current_group(idx);
            this._current_layout_idx = idx;
        }
    }

    get_layout_data(idx) {
        const layouts = this._layouts || [];
        return layouts[idx] || {};
    }

    is_ibus_active() {
        return !!this._ibus_active;
    }
}
Signals.addSignalMethods(KbdLayoutController.prototype);

class CinnamonKeyboardApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._layoutItems = [ ];
        this._layoutIcons = [ ];

        this._maxSeenWidth = this._maxSeenHeight = 0;
        this.show_flags = this.use_upper = this.use_variants = false;

        try {
            this.metadata = metadata;
            Main.systrayManager.registerTrayIconReplacement("keyboard", metadata.uuid);

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
                Util.spawn(['gkbd-keyboard-display', '-g', String(this._controller.get_current_layout_idx() + 1)]);
            });
            this.menu.addAction(_("Show Character Table"), () => {
                Main.overview.hide();
                Util.spawn(['gucharmap']);
            });
            this.menu.addSettingsAction(_("Keyboard Settings"), 'keyboard');

            this._controller = new KbdLayoutController();
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
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this._onPanelEditModeChanged();
        }
        this._controller.connect('layout-changed', () => this._syncGroup());
        this._controller.connect('config-changed', () => this._syncConfig());
        this.connect('orientation-changed', () => this.on_orientation_changed());
        this._controller.applet_added();
    }

    on_orientation_changed() {
        this._maxSeenWidth = this._maxSeenHeight = 0;
        this._syncGroup();
    }

    _onButtonPressEvent(actor, event) {
        // Cycle to the next layout
        if (event.get_button() === 2) {
            const selected_group = this._controller.get_current_layout_idx();
            const new_group = (selected_group + 1) % this._layoutItems.length;
            this._controller.set_current_layout_idx(new_group);
        }
        return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _setLayoutItems(items) {
        this._selectedLayout = null;
        this._layoutItems.forEach(item => item.destroy());
        this._layoutItems = items || [];
    }

    _setLayoutIcons(icons) {
        this._layoutIcons = icons || [];
    }

    _createIcon(layoutIndex, actorClass) {
        const layoutInfo = this._controller.get_layout_data(layoutIndex);

        let isFlagIcon = false;
        let iconActor = null;
        let iconInstance = null;
        let name = layoutInfo.flag_name;

        if (this.show_flags) {
            const file = Gio.file_new_for_path(getFlagFileName(name));
            if (file.query_exists(null)) {
                iconInstance = new EmblemedIcon(file.get_path(), layoutInfo.layout_dupe_id, actorClass);
                iconActor = iconInstance.actor;
                isFlagIcon = true;
            }
        }

        if (!isFlagIcon) {
            name = this.use_variants ? layoutInfo.variant_name : layoutInfo.short_name;
            name = this.use_upper ? name.toUpperCase() : name;
            iconActor = new St.Label({ text: name });
        }

        return {name, iconInstance, iconActor, isFlagIcon};
    }

    _setMargin(actor, left, right) {
        actor.set_style(`margin-left: ${left}px; margin-right: ${right}px;`);
    }

    _syncConfig() {
        this._maxSeenWidth = this._maxSeenHeight = 0;

        if (!this._controller.have_multiple_layouts()) {
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

        const layoutsCount = this._controller.get_layouts_count();

        for (let i = 0; i < layoutsCount; i++) {
            const idx = i;

            const layoutInfo = this._controller.get_layout_data(idx);

            const popupIconInfo = this._createIcon(idx, POPUP_MENU_ICON_STYLE_CLASS);
            const menuItem = new LayoutMenuItem(
                () => this._controller.set_current_layout_idx(idx), 
                popupIconInfo.iconActor, layoutInfo.display_name
            );
            layoutItems.push(menuItem);

            this.menu.addMenuItem(menuItem, idx);
            const appletIconInfo = this._createIcon(idx, APPLET_ICON_STYLE_CLASS);
            layoutIcons.push(appletIconInfo);
        }

        this._setLayoutItems(layoutItems);
        this._setLayoutIcons(layoutIcons);

        this._syncGroup();
    }

    _syncGroup() {
        const selected = this._controller.get_current_layout_idx();

        if (!this._layoutItems.length) {
            this.actor.hide();
            return;
        }

        if (this._selectedLayout) {
            this._selectedLayout.setShowDot(false);
            this._selectedLayout = null;
        }

        const item = this._layoutItems[selected];
        item.setShowDot(true);

        this._selectedLayout = item;

        const layoutInfo = this._controller.get_layout_data(selected);

        this.set_applet_tooltip(layoutInfo.display_name);

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
        this._controller.applet_removed();

        Main.systrayManager.unregisterTrayIconReplacement(this.metadata.uuid);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonKeyboardApplet(metadata, orientation, panel_height, instance_id);
}
