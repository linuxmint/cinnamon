// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*
/* exported WindowMenuManager */

const { Clutter, GLib, Meta, St, Gtk } = imports.gi;

const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const CheckBox = imports.ui.checkBox;
const RadioButton = imports.ui.radioButton;
const SignalManager = imports.misc.signalManager;

var BaseMnemonicMenuItem = class BaseMnemonicMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init (label, params) {
        super._init.call(this, params);

        this.mnemonicInit(label);
    }

    mnemonicInit(label) {
        this.origLabel = label;
        this.plain = null;
        this.mnemonized = null;
        this.showing_mnemonic = false;
    }

    _setLabels() {
        let markup = null;
        let plain = null;
        let mnemonic = undefined;
        let title_pieces = this.origLabel.split("_");

        if (title_pieces.length === 2) {
            this.mnemonic = title_pieces[1][0].toLowerCase();
            this.mnemonized = `${title_pieces[0]}<u>${title_pieces[1][0]}</u>${title_pieces[1].substring(1)}`;
            this.plain = `${title_pieces[0]}${title_pieces[1]}`; 
        } else {
            this.plain = this.origLabel;
            this.mnemonized = this.origLabel;
        }

        this.label.clutter_text.set_markup(this.plain);
    }

    toggleMnemonic() {
        if (!this.showing_mnemonic) {
            this.label.clutter_text.set_markup(this.mnemonized);
            this.showing_mnemonic = true;
        } else {
            this.label.clutter_text.set_markup(this.plain);
            this.showing_mnemonic = false;
        }

        this.label.clutter_text.queue_relayout();
    }
}

var MnemonicLeftOrnamentedMenuItem = class MnemonicLeftOrnamentedMenuItem extends BaseMnemonicMenuItem {
    _init (label, params) {
        super._init.call(this, label, params);

        this._ornament = new St.Bin();
        this._icon = new St.Icon({ style_class: 'popup-menu-icon', icon_type: St.IconType.SYMBOLIC });

        this._ornament.child = this._icon;
        this._ornament.child._delegate = this._ornament;
        this.addActor(this._ornament, {span: 1});

        this.label = new St.Label();
        this.addActor(this.label);
        this.actor.label_actor = this.label;

        this._setLabels();
    }

    setIcon(icon_name) {
        this._ornament.child.destroy()
        this._icon = new St.Icon({ style_class: 'popup-menu-icon', icon_name: icon_name, icon_type: St.IconType.SYMBOLIC });
        this._ornament.child = this._icon;
    }

    setOrnament(ornamentType, state) {
        switch (ornamentType) {
        case PopupMenu.OrnamentType.CHECK:
            if ((this._ornament.child)&&(!(this._ornament.child._delegate instanceof CheckBox.CheckButton))) {
                this._ornament.child.destroy();
                this._ornament.child = null;
            }
            if (!this._ornament.child) {
                let switchOrn = new CheckBox.CheckButton(state);
                this._ornament.child = switchOrn.actor;
                switchOrn.actor.reactive = false;
            } else {
                this._ornament.child._delegate.setToggleState(state);
            }
            this._icon = null;
            break;
        case PopupMenu.OrnamentType.DOT:
            if ((this._ornament.child)&&(!(this._ornament.child._delegate instanceof RadioButton.RadioBox))) {
                this._ornament.child.destroy();
                this._ornament.child = null;
            }
            if (!this._ornament.child) {
                let radioOrn = new RadioButton.RadioBox(state);
                this._ornament.child = radioOrn.actor;
                radioOrn.actor.reactive = false;
            } else {
                this._ornament.child._delegate.setToggleState(state);
            }
            this._icon = null;
            break;
        }
    }
}

var MnemonicSubMenuMenuItem = class MnemonicSubMenuMenuItem extends PopupMenu.PopupSubMenuMenuItem {
    _init (label, params) {
        super._init.call(this, label);
        BaseMnemonicMenuItem.prototype.mnemonicInit.call(this, label);

        // to help align with left side ornaments
        let filler = new St.Icon({ style_class: 'popup-menu-icon', icon_type: St.IconType.SYMBOLIC });
        this.addActor(filler, { span: 1, position: 0 });

        this._setLabels();
    }
}
MnemonicSubMenuMenuItem.prototype.toggleMnemonic = BaseMnemonicMenuItem.prototype.toggleMnemonic;
MnemonicSubMenuMenuItem.prototype._setLabels = BaseMnemonicMenuItem.prototype._setLabels;

var WindowMenu = class extends PopupMenu.PopupMenu {
    constructor(window, sourceActor) {
        super(sourceActor, 0, St.Side.TOP);

        this.actor.add_style_class_name('window-menu');

        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();

        this.actor.connect('key-press-event', this._windowMenuKeypress.bind(this));

        this._items = [];
        this._buildMenu(window);
    }

    _windowMenuKeypress(actor, event) {
        if (this._onKeyPressEvent(actor, event) === Clutter.EVENT_STOP) {
            return Clutter.EVENT_STOP;
        }

        if (event.get_key_symbol() === Clutter.KEY_Alt_R || event.get_key_symbol() === Clutter.KEY_Alt_L) {
            let items = this._getMenuItems();

            for (let item of this._items) {
                if (item.mnemonic !== undefined) {
                    item.toggleMnemonic();
                }
            }
            return Clutter.EVENT_STOP;
        }

        let items = this._getMenuItems();
        for (let item of this._items) {
            if (!item.sensitive) {
                continue;
            }

            if (item.mnemonic != undefined && item.mnemonic[0] === String.fromCharCode(event.get_key_symbol()).toLowerCase()) {
                item.activate(event);
                return Clutter.EVENT_STOP;
            }
        }

        return Clutter.EVENT_PROPAGATE;
    }

    addAction(to_menu, title, callback) {
        let menuItem = new MnemonicLeftOrnamentedMenuItem(title);
        to_menu.addMenuItem(menuItem);

        menuItem.connect('activate', (o, event) => {
            callback(event);
        });

        this._items.push(menuItem);

        return menuItem;
    }

    _buildMenu(window) {
        let type = window.get_window_type();

        let item;

        // Translators: If a language-specific mnemonic doesn't make sense, add one after the label itself:
        // i.e. <translated>(_n). See https://github.com/linuxmint/muffin/blob/b9a6f3fe43e/po .po files
        item = this.addAction(this, _("Mi_nimize"), () => {
            window.minimize();
        });
        item.setIcon("window-minimize-symbolic");

        if (!window.can_minimize())
            item.setSensitive(false);

        if (window.get_maximized()) {
            // Translators: If a language-specific mnemonic doesn't make sense, add one after the label itself:
            // i.e. <translated>(_n). See https://github.com/linuxmint/muffin/blob/b9a6f3fe43e/po .po files
            item = this.addAction(this, _("Unma_ximize"), () => {
                window.unmaximize(Meta.MaximizeFlags.BOTH);
            });
        } else {
            // Translators: If a language-specific mnemonic doesn't make sense, add one after the label itself:
            // i.e. <translated>(_n). See https://github.com/linuxmint/muffin/blob/b9a6f3fe43e/po .po files
            item = this.addAction(this, _("Ma_ximize"), () => {
                window.maximize(Meta.MaximizeFlags.BOTH);
            });
            item.setIcon("window-maximize-symbolic");
        }
        if (!window.can_maximize())
            item.setSensitive(false);

        // Translators: If a language-specific mnemonic doesn't make sense, add one after the label itself:
        // i.e. <translated>(_n). See https://github.com/linuxmint/muffin/blob/b9a6f3fe43e/po .po files
        item = this.addAction(this, _("_Move"), event => {
            this._grabAction(window, Meta.GrabOp.KEYBOARD_MOVING, event.get_time());
        });
        if (!window.allows_move())
            item.setSensitive(false);

        // Translators: If a language-specific mnemonic doesn't make sense, add one after the label itself:
        // i.e. <translated>(_n). See https://github.com/linuxmint/muffin/blob/b9a6f3fe43e/po .po files
        item = this.addAction(this, _("_Resize"), event => {
            this._grabAction(window, Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN, event.get_time());
        });
        if (!window.allows_resize())
            item.setSensitive(false);

        if (!window.titlebar_is_onscreen() && type != Meta.WindowType.DOCK && type != Meta.WindowType.DESKTOP) {
            // Translators: If a language-specific mnemonic doesn't make sense, add one after the label itself:
            // i.e. <translated>(_n). See https://github.com/linuxmint/muffin/blob/b9a6f3fe43e/po .po files
            this.addAction(this, _("Move Titlebar Onscreen"), () => {
                window.shove_titlebar_onscreen();
            });
        }

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Translators: If a language-specific mnemonic doesn't make sense, add one after the label itself:
        // i.e. <translated>(_n). See https://github.com/linuxmint/muffin/blob/b9a6f3fe43e/po .po files
        item = this.addAction(this, _("Always on _Top"), () => {
            if (window.is_above())
                window.unmake_above();
            else
                window.make_above();
        });
        if (window.is_above())
            item.setOrnament(PopupMenu.OrnamentType.CHECK, true);
        else
            item.setOrnament(PopupMenu.OrnamentType.CHECK, false);
        if (type == Meta.WindowType.DOCK ||
            type == Meta.WindowType.DESKTOP ||
            type == Meta.WindowType.SPLASHSCREEN)
            item.setSensitive(false);

        if (global.workspace_manager.get_n_workspaces() > 1 &&
            (!Meta.prefs_get_workspaces_only_on_primary() ||
             window.is_on_primary_monitor())) {
            let isSticky = window.is_on_all_workspaces();

            // Translators: If a language-specific mnemonic doesn't make sense, add one after the label itself:
            // i.e. <translated>(_n). See https://github.com/linuxmint/muffin/blob/b9a6f3fe43e/po .po files
            this.sticky_action = this.addAction(this, _("_Always on Visible Workspace"), () => {
                window.stick();
            });
            // Translators: If a language-specific mnemonic doesn't make sense, add one after the label itself:
            // i.e. <translated>(_n). See https://github.com/linuxmint/muffin/blob/b9a6f3fe43e/po .po files
            this.unsticky_action = this.addAction(this, _("_Only on This Workspace"), () => {
                window.unstick();
            });
            this.sticky_action.setOrnament(PopupMenu.OrnamentType.DOT, isSticky);
            this.unsticky_action.setOrnament(PopupMenu.OrnamentType.DOT, !isSticky);

            if (window.is_always_on_all_workspaces()) {
                this.sticky_action.setSensitive(false);
                this.unsticky_action.setSensitive(false);
            }

            // Translators: If a language-specific mnemonic doesn't make sense, add one after the label itself:
            // i.e. <translated>(_n). See https://github.com/linuxmint/muffin/blob/b9a6f3fe43e/po .po files
            let ws_sub = new MnemonicSubMenuMenuItem(_("Move to Another _Workspace"));
            this.addMenuItem(ws_sub);
            this._items.push(ws_sub);

            let curr_index = window.get_workspace().index();
            let used_nums = {};
            let name = null;

            for (let i = 0; i < global.workspace_manager.get_n_workspaces(); i++) {
                if (used_nums[i + 1]) {
                    continue;
                }

                let name = Main.workspace_names[i];

                if (name === undefined || name === '') {
                    name = Main.getWorkspaceName(i);
                }

                let end = name.substring(name.length - 2).replace("_", "");
                let number = parseInt(end);

                if (!isNaN(number) && used_nums[number] == undefined) {
                    if (number == 10) {
                        name = name.replace("10", "1_0");
                        used_nums[10] = true;
                    }
                    else
                    if (number < 10) {
                        name = name.replace(number.toString(), "_" + number.toString());
                        used_nums[number] = true;
                    }
                }
                else
                {
                    name = `${name} (_${i + 1})`
                    used_nums[i + 1] = true;
                }

                item = this.addAction(ws_sub.menu, name, () => window.change_workspace(global.workspace_manager.get_workspace_by_index(i)))

                if (i == curr_index)
                    item.setSensitive(false);
            }
        }

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Translators: If a language-specific mnemonic doesn't make sense, add one after the label itself:
        // i.e. <translated>(_n). See https://github.com/linuxmint/muffin/blob/b9a6f3fe43e/po .po files
        item = this.addAction(this, _("_Close"), event => {
            window.delete(event.get_time());
        });
        item.setIcon("window-close-symbolic");
        if (!window.can_close())
            item.setSensitive(false);
    }

    _grabAction(window, grabOp, time) {
        if (global.display.get_grab_op() == Meta.GrabOp.NONE) {
            window.begin_grab_op(grabOp, true, time);
            return;
        }

        let waitId = 0;
        let id = global.display.connect('grab-op-end', display => {
            display.disconnect(id);
            GLib.source_remove(waitId);

            window.begin_grab_op(grabOp, true, time);
        });

        waitId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            global.display.disconnect(id);
            return GLib.SOURCE_REMOVE;
        });
    }
};

var WindowMenuManager = class {
    constructor() {
        this._manager = null;
        this._wmsignals = null;

        this._sourceActor = new St.Widget({ reactive: true, visible: false });
        this._sourceActor.connect('button-press-event', () => {
            this._manager._activeMenu.toggle();
        });
        Main.uiGroup.add_actor(this._sourceActor);
        this.dummyCursor = new St.Widget({ width: 0, height: 0, opacity: 0 });
        Main.uiGroup.add_actor(this.dummyCursor);
        this.actor = this.dummyCursor;

        this.current_menu = null;
        this.current_window = null;
    }

    showWindowMenuForWindow(window, type, rect) {
        if (type != Meta.WindowMenuType.WM)
            throw new Error('Unsupported window menu type');

        if (window.window_type === Meta.WindowType.DESKTOP) {
            return;
        }

        this.destroyMenu();
        this._manager = new PopupMenu.PopupMenuManager(this);
        this._wmsignals = new SignalManager.SignalManager(null);

        let menu = new WindowMenu(window, this._sourceActor);

        this._manager.addMenu(menu);

        this._wmsignals.connect(menu, 'activate', () => {
            window.check_alive(global.get_current_time());
        });
        this._wmsignals.connect(menu, 'menu-animated-closed', () => {
            this.destroyMenu();
        });

        this._wmsignals.connect(window, 'unmanaged', () => {
            this.destroyMenu();
        });

        this._sourceActor.set_size(Math.max(1, rect.width), Math.max(1, rect.height));
        this._sourceActor.set_position(rect.x, rect.y);
        this._sourceActor.show();

        let [minWidth, minHeight, natWidth, natHeight] = menu.actor.get_preferred_size();

        menu.shiftToPosition((rect.x + natWidth / 2) + 5); // +5 for appearances

        menu.open();
        menu.actor.navigate_focus(null, Gtk.DirectionType.TAB_FORWARD, false);
        this._wmsignals.connect(menu, 'open-state-changed', () => {
            this.destroyMenu();
        });

        this.current_menu = menu;
        this.current_window = window;
    }

    destroyMenu() {
        if (this._wmsignals != null) {
            this._wmsignals.disconnectAllSignals();
            this._wmsignals = null;

            this._sourceActor.hide();

            if (this.current_menu) {
                this.current_menu.close(false)
                this._manager.destroy()
                this._manager = null
            }
        }
    }
};
