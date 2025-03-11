const Applet = imports.ui.applet;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const Signals = imports.signals;
const KeyboardManager = imports.ui.keyboardManager;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

const POPUP_MENU_ICON_STYLE_CLASS = "popup-menu-icon";
const APPLET_ICON_STYLE_CLASS = "applet-icon";

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

class CinnamonKeyboardApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this._panel_icon_box = new St.Bin(); // https://developer.gnome.org/st/stable/StBin.htm

        this._panel_icon_box.set_fill(true,true);
        this._panel_icon_box.set_alignment(St.Align.MIDDLE, St.Align.MIDDLE);

        this.actor.add(this._panel_icon_box, {
            y_align: St.Align.MIDDLE,
            y_fill: false
        });

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this._layoutItems = new Map();
        this._layoutIcons = new Map();

        this._selectedLayout = null;
        this._menuItems = new Map();

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

            global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, () => this._onPanelEditModeChanged());

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addAction(_("Show Keyboard Layout"), () => {
                Main.overview.hide();
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
            this._syncGroup();
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

    _createFlagIcon(source, actorClass, size) {
        let actor = null;
        let name = source.flagName;

        const file = Gio.file_new_for_path(KeyboardManager.getFlagFileName(name));
        if (file.query_exists(null)) {
            actor = new KeyboardManager.SubscriptableFlagIcon({
                style_class: actorClass,
                file: file,
                subscript: source.dupeId > 0 ? String(source.dupeId) : null,
                width: size,
                height: size,
            });
        }

        return actor;
    }

    _setMargin(actor, left, right) {
        actor.set_style(`margin-left: ${left}px; margin-right: ${right}px;`);
    }

    _syncConfig() {
        this._maxSeenWidth = this._maxSeenHeight = 0;

        this._menuItems.forEach((v, k, m) => v.destroy());
        this._menuItems = new Map()

        this._selectedLayout = null;

        if (!this._manager.multipleSources) {
            this.menu.close();
            this.actor.hide();
            return;
        }

        this.show_flags = this.desktop_settings.get_boolean("keyboard-layout-show-flags");
        this.actor.show();

        for (const sourceId of Object.keys(this._manager.inputSources)) {
            const source = this._manager.inputSources[sourceId];

            let actor = null;
            const iconSize = this.getPanelIconSize(St.IconType.FULLCOLOR);

            if (this.show_flags) {
                actor = this._createFlagIcon(source, POPUP_MENU_ICON_STYLE_CLASS, iconSize);
            }

            if (actor == null) {
                actor = new St.Label({ text: source.shortName, style_class: "applet-label" });
            }

            const menuItem = new LayoutMenuItem(
                () => source.activate(),
                actor, source.displayName
            );

            this._menuItems.set(source, menuItem);
            this.menu.addMenuItem(menuItem);
        }
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

        const item = this._menuItems.get(selected);
        item.setShowDot(true);

        this._selectedLayout = item;
        this.set_applet_tooltip(selected.displayName);

        let actor = null;
        const iconSize = this.getPanelIconSize(St.IconType.FULLCOLOR);

        if (this.show_flags) {
            actor = this._createFlagIcon(selected, APPLET_ICON_STYLE_CLASS, iconSize);
        }

        if (actor == null) {
            actor = new St.Label({
                text: selected.shortName,
                style_class: "applet-label"
            });
        }

        this._panel_icon_box.set_child(actor);

        // const _applet_label_box = this._applet_label.get_parent();
        // this._setMargin(_applet_label_box, 0, 0);
        // this._setMargin(this._applet_icon_box, 0, 0);

        // const {name, actor, isFlagIcon} = this._layoutIcons.get(selected);
        // if (isFlagIcon) {
        //     this._applet_icon = actor;
        //     this._applet_icon_box.set_child(actor);
        //     this._applet_icon_box.show();
        //     this._setStyle();
        //     this.set_applet_label("");
        // } else {
        //     this.set_applet_label(name);
        //     this._applet_icon_box.hide();
        // }

        // const box = isFlagIcon ? this._applet_icon_box : _applet_label_box;
        // const width = this.actor.get_width();
        // const height = this.actor.get_height();
        // if (width >= this._maxSeenWidth) {
        //     this._maxSeenWidth = width;
        // }
        // if (height >= this._maxSeenHeight) {
        //     this._maxSeenHeight = height;
        // } else {
        //     this.actor.set_height(this._maxSeenHeight);
        // }
        // const addedWidth = this._maxSeenWidth - width;
        // const leftOffset = parseInt(addedWidth / 2);
        // const rightOffset = addedWidth - leftOffset; 
        // this._setMargin(box, leftOffset, rightOffset);
        // if (isFlagIcon) {
        //     this._setStyle();
        // }
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
