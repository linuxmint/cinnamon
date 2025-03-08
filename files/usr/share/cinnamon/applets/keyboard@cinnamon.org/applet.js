const Applet = imports.ui.applet;
const XApp = imports.gi.XApp;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const Cairo = imports.cairo;
const Signals = imports.signals;
const KeyboardManager = imports.ui.keyboardManager;

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

class CinnamonKeyboardApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._layoutItems = new Map();
        this._layoutIcons = new Map();

        this._maxSeenWidth = this._maxSeenHeight = 0;
        this.show_flags = this.use_upper = this.use_variants = false;
        this._bus_watch_id = 0

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
            global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, () => this._onPanelEditModeChanged());

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addAction(_("Show Keyboard Layout"), () => {
                Main.overview.hide();
                global.log
                Util.spawn(['gkbd-keyboard-display', '-g', String(this._manager.currentSource.index + 1)]);
            });
            this.menu.addAction(_("Show Character Table"), () => {
                Main.overview.hide();
                Util.spawn(['gucharmap']);
            });
            this.menu.addSettingsAction(_("Keyboard Settings"), 'keyboard');

            this._manager = KeyboardManager.getInputSourceManager();
            this._manager.connect("sources-changed", this._onSourcesChanged.bind(this));
            this._manager.connect("current-source-changed", this._onCurrentSourceChanged.bind(this));
            this._syncConfig();
        }
        catch (e) {
            global.logError(e);
        }
    }

    _onCurrentSourceChanged() {
        this._syncGroup();
    }

    _onSourcesChanged() {
        this._syncConfig();
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
        this.connect('orientation-changed', () => this.on_orientation_changed());

        if (this._bus_watch_id === 0) {
            const on_ibus = (is_active) => {
                this.actor.visible = !is_active;
            };
            this._bus_watch_id = Gio.DBus.session.watch_name(
                "org.fcitx.Fcitx", Gio.BusNameWatcherFlags.NONE,
                () => on_ibus(true), () => on_ibus(false)
            );
        }
    }

    on_orientation_changed() {
        this._maxSeenWidth = this._maxSeenHeight = 0;
        this._syncGroup();
    }

    _onButtonPressEvent(actor, event) {
        // Cycle to the next layout
        if (event.get_button() === 2) {
            let new_index = this._manager.currentSource.index + 1;
            if (new_index == this._manager.numInputSources) {
                new_index = 0;
            }

            this._manager.activateInputSourceIndex(new_index);
        }

        return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _setLayoutItems(items) {
        this._selectedLayout = null;

        this._layoutItems.forEach((v, k, m) => v.destroy());
        this._layoutItems = items || new Map();
    }

    _setLayoutIcons(icons) {
        this._layoutIcons = icons || new Map();
    }

    _createIcon(source, actorClass) {
        let isFlagIcon = false;
        let iconActor = null;
        let iconInstance = null;
        let name = source.flagName;

        if (this.show_flags) {
            const file = Gio.file_new_for_path(getFlagFileName(name));
            if (file.query_exists(null)) {
                iconInstance = new EmblemedIcon(file.get_path(), source.dupeId, actorClass);
                iconActor = iconInstance.actor;
                isFlagIcon = true;
            }
        }

        if (!isFlagIcon) {

            name = source.shortName;
            iconActor = new St.Label({ text: name });
        }

        return {name, iconInstance, iconActor, isFlagIcon};
    }

    _setMargin(actor, left, right) {
        actor.set_style(`margin-left: ${left}px; margin-right: ${right}px;`);
    }

    _syncConfig() {
        this._maxSeenWidth = this._maxSeenHeight = 0;

        if (!this._manager.multipleSources) {
            this._setLayoutItems([]);
            this.menu.close();
            this.actor.hide();
            return;
        }

        const layoutItems = new Map();
        const layoutIcons = new Map();

        this.show_flags = this.desktop_settings.get_boolean("keyboard-layout-show-flags");

        if (this.show_flags) {
            this._maxSeenWidth = this._maxSeenHeight = 0;
        }

        this.actor.show();

        for (const sourceId of Object.keys(this._manager.inputSources)) {
            const source = this._manager.inputSources[sourceId];

            const popupIconInfo = this._createIcon(source, POPUP_MENU_ICON_STYLE_CLASS);
            const menuItem = new LayoutMenuItem(
                () => source.activate(),
                popupIconInfo.iconActor, source.displayName
            );
            layoutItems.set(source, menuItem);
            this.menu.addMenuItem(menuItem);
            const appletIconInfo = this._createIcon(source, APPLET_ICON_STYLE_CLASS);
            layoutIcons.set(source, appletIconInfo);
        }

        this._setLayoutItems(layoutItems);
        this._setLayoutIcons(layoutIcons);

        this._syncGroup();
    }

    _syncGroup() {
        const selected = this._manager.currentSource;

        if (!this._manager.multipleSources) {
            this.actor.hide();
            return;
        }

        if (this._selectedLayout) {
            this._selectedLayout.setShowDot(false);
            this._selectedLayout = null;
        }

        const item = this._layoutItems.get(selected);
        item.setShowDot(true);

        this._selectedLayout = item;
        this.set_applet_tooltip(selected.displayName);

        const _applet_label_box = this._applet_label.get_parent();
        this._setMargin(_applet_label_box, 0, 0);
        this._setMargin(this._applet_icon_box, 0, 0);

        const {name, iconActor, iconInstance, isFlagIcon} = this._layoutIcons.get(selected);
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
    }

    on_applet_removed_from_panel() {
        if (this._bus_watch_id > 0) {
            Gio.DBus.session.unwatch_name(this._bus_watch_id);
            this._bus_watch_id = 0;
        }

        // TODO disconnect ISM signals.

        Main.systrayManager.unregisterTrayIconReplacement(this.metadata.uuid);
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonKeyboardApplet(metadata, orientation, panel_height, instance_id);
}
