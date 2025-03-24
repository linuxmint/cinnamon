const Applet = imports.ui.applet;
const St = imports.gi.St;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Gio = imports.gi.Gio;
const Signals = imports.signals;
const KeyboardManager = imports.ui.keyboardManager;
const IBus = imports.gi.IBus;
const IBusManager = imports.misc.ibusManager;

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
        this._layoutItems = new Map();

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

            this._layoutSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._layoutSection);
            this._propSeparator = new PopupMenu.PopupSeparatorMenuItem();
            this.menu.addMenuItem(this._propSeparator);
            this._propSection = new PopupMenu.PopupMenuSection();
            this.menu.addMenuItem(this._propSection);
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

        this._layoutItems.forEach((v, k, m) => v.destroy());
        // this.menu.removeAll();

        this._layoutItems = new Map()

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

            this._layoutItems.set(source, menuItem);
            this._layoutSection.addMenuItem(menuItem);
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

        const item = this._layoutItems.get(selected);
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

        this._updatePropertySection(selected.properties);
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

    _updatePropertySection(properties) {
        // this._propSeparator.hide();
        this._propSection.actor.hide();
        this._propSection.removeAll();

        this._buildPropSubMenu(this._propSection, properties);
    }

    _buildPropSubMenu(menu, props) {
        if (!props)
            return;

        this._propSection.actor.show();
        let ibusManager = IBusManager.getIBusManager();
        let radioGroup = [];
        let p;
        for (let i = 0; (p = props.get(i)) != null; ++i) {
            let prop = p;

            if (!prop.get_visible())
                continue;

            if (prop.get_key() == 'InputMode') {
                let text;
                if (prop.get_symbol)
                    text = prop.get_symbol().get_text();
                else
                    text = prop.get_label().get_text();

                let currentSource = this._manager.currentSource;
                if (currentSource) {
                    let indicatorLabel = this._layoutItems.get(currentSource);
                    if (text && text.length > 0 && text.length < 3)
                        indicatorLabel.label.set_text(text);
                }
            }

            let item;
            let type = prop.get_prop_type();
            switch (type) {
            case IBus.PropType.MENU:
                item = new PopupMenu.PopupSubMenuMenuItem(prop.get_label().get_text());
                this._buildPropSubMenu(item.menu, prop.get_sub_props());
                break;

            case IBus.PropType.RADIO:
                item = new PopupMenu.PopupMenuItem(prop.get_label().get_text());
                item.prop = prop;
                radioGroup.push(item);
                item.radioGroup = radioGroup;

                item.setOrnament(PopupMenu.OrnamentType.DOT, prop.get_state() == IBus.PropState.CHECKED);
                item.connect('activate', () => {
                    if (item.prop.get_state() == IBus.PropState.CHECKED)
                        return;

                    let group = item.radioGroup;
                    for (let j = 0; j < group.length; ++j) {
                        if (group[j] == item) {
                            item.setOrnament(PopupMenu.OrnamentType.DOT, true);
                            item.prop.set_state(IBus.PropState.CHECKED);
                            ibusManager.activateProperty(item.prop.get_key(),
                                                         IBus.PropState.CHECKED);
                        } else {
                            group[j].setOrnament(PopupMenu.OrnamentType.DOT, false);
                            group[j].prop.set_state(IBus.PropState.UNCHECKED);
                            ibusManager.activateProperty(group[j].prop.get_key(),
                                                         IBus.PropState.UNCHECKED);
                        }
                    }
                });
                break;

            case IBus.PropType.TOGGLE:
                item = new PopupMenu.PopupSwitchMenuItem(prop.get_label().get_text(), prop.get_state() == IBus.PropState.CHECKED);
                item.prop = prop;
                item.connect('toggled', () => {
                    if (item.state) {
                        item.prop.set_state(IBus.PropState.CHECKED);
                        ibusManager.activateProperty(item.prop.get_key(),
                                                     IBus.PropState.CHECKED);
                    } else {
                        item.prop.set_state(IBus.PropState.UNCHECKED);
                        ibusManager.activateProperty(item.prop.get_key(),
                                                     IBus.PropState.UNCHECKED);
                    }
                });
                break;

            case IBus.PropType.NORMAL:
                item = new PopupMenu.PopupMenuItem(prop.get_label().get_text());
                item.prop = prop;
                item.connect('activate', () => {
                    ibusManager.activateProperty(item.prop.get_key(),
                                                 item.prop.get_state());
                });
                break;

            case IBus.PropType.SEPARATOR:
                item = new PopupMenu.PopupSeparatorMenuItem();
                break;

            default:
                log('IBus property %s has invalid type %d'.format(prop.get_key(), type));
                continue;
            }

            item.setSensitive(prop.get_sensitive());
            menu.addMenuItem(item);
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
