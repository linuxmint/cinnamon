// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*
/* exported WindowMenuManager */

const { GLib, Meta, St, Gtk } = imports.gi;

const BoxPointer = imports.ui.boxpointer;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const CheckBox = imports.ui.checkBox;
const RadioButton = imports.ui.radioButton;

var LeftOrnamentedMenuItem = class LeftOrnamentedMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init (text, params) {
        super._init.call(this, params);

        this._ornament = new St.Bin();
        this._icon = new St.Icon({ style_class: 'popup-menu-icon', icon_type: St.IconType.SYMBOLIC });

        this._ornament.child = this._icon;
        this._ornament.child._delegate = this._ornament;
        this.addActor(this._ornament, {span: 1});

        this.label = new St.Label({ text: text });
        this.addActor(this.label);
        this.actor.label_actor = this.label;

    }

    setLabel(label) {
        this.label.set_text(label);
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


var WindowMenu = class extends PopupMenu.PopupMenu {
    constructor(window, sourceActor) {
        super(sourceActor, 0, St.Side.TOP);

        this.actor.add_style_class_name('window-menu');

        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();

        this._buildMenu(window);
    }

    addAction(to_menu, title, callback) {
        let menuItem = new LeftOrnamentedMenuItem(title);
        to_menu.addMenuItem(menuItem);

        menuItem.connect('activate', (o, event) => {
            callback(event);
        });

        return menuItem;
    }

    _buildMenu(window) {
        let type = window.get_window_type();

        let item;

        item = this.addAction(this, _("Minimize"), () => {
            window.minimize();
        });
        item.setIcon("window-minimize-symbolic");

        if (!window.can_minimize())
            item.setSensitive(false);

        if (window.get_maximized()) {
            item = this.addAction(this, _("Unmaximize"), () => {
                window.unmaximize(Meta.MaximizeFlags.BOTH);
            });
        } else {
            item = this.addAction(this, _("Maximize"), () => {
                window.maximize(Meta.MaximizeFlags.BOTH);
            });
            item.setIcon("window-maximize-symbolic");
        }
        if (!window.can_maximize())
            item.setSensitive(false);

        item = this.addAction(this, _("Move"), event => {
            this._grabAction(window, Meta.GrabOp.KEYBOARD_MOVING, event.get_time());
        });
        if (!window.allows_move())
            item.setSensitive(false);

        item = this.addAction(this, _("Resize"), event => {
            this._grabAction(window, Meta.GrabOp.KEYBOARD_RESIZING_UNKNOWN, event.get_time());
        });
        if (!window.allows_resize())
            item.setSensitive(false);

        if (!window.titlebar_is_onscreen() && type != Meta.WindowType.DOCK && type != Meta.WindowType.DESKTOP) {
            this.addAction(this, _("Move Titlebar Onscreen"), () => {
                window.shove_titlebar_onscreen();
            });
        }

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        item = this.addAction(this, _("Always on Top"), () => {
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

            this.sticky_action = this.addAction(this, _("Always on Visible Workspace"), () => {
                log("stick");
                window.stick();
            });
            this.unsticky_action = this.addAction(this, _("Only on This Workspace"), () => {
                log("unstick");
                window.unstick();
            });
            this.sticky_action.setOrnament(PopupMenu.OrnamentType.DOT, isSticky);
            this.unsticky_action.setOrnament(PopupMenu.OrnamentType.DOT, !isSticky);

            if (window.is_always_on_all_workspaces()) {
                this.sticky_action.setSensitive(false);
                this.unsticky_action.setSensitive(false);
            }

            let ws_sub = new PopupMenu.PopupSubMenuMenuItem(_("Move to Another Workspace"));
            let filler = new St.Icon({ style_class: 'popup-menu-icon', icon_type: St.IconType.SYMBOLIC });
            ws_sub.addActor(filler, { span: 1, position: 0 });

            this.addMenuItem(ws_sub);

            let curr_index = window.get_workspace().index();
            for (let i = 0; i < global.workspace_manager.get_n_workspaces(); i++) {
                let j = i;
                let name = Main.workspace_names[i] ? Main.workspace_names[i] : Main._makeDefaultWorkspaceName(i);
                item = this.addAction(ws_sub.menu, name, () => window.change_workspace(global.workspace_manager.get_workspace_by_index(j)))

                if (i == curr_index)
                    item.setSensitive(false);
            }
        }

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        item = this.addAction(this, _("Close"), event => {
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
        this._manager = new PopupMenu.PopupMenuManager(this);

        this._sourceActor = new St.Widget({ reactive: true, visible: false });
        this._sourceActor.connect('button-press-event', () => {
            this._manager._activeMenu.toggle();
        });
        Main.uiGroup.add_actor(this._sourceActor);
        this.dummyCursor = new St.Widget({ width: 0, height: 0, opacity: 0 });
        Main.uiGroup.add_actor(this.dummyCursor);
        this.actor = this.dummyCursor;
    }

    showWindowMenuForWindow(window, type, rect) {
        if (type != Meta.WindowMenuType.WM)
            throw new Error('Unsupported window menu type');
        let menu = new WindowMenu(window, this._sourceActor);

        this._manager.addMenu(menu);

        menu.connect('activate', () => {
            window.check_alive(global.get_current_time());
        });
        menu.connect('menu-animated-closed', () => {
            menu.destroy()
        });

        let destroyId = window.connect('unmanaged', () => {
            menu.close();
        });

        this._sourceActor.set_size(Math.max(1, rect.width), Math.max(1, rect.height));
        this._sourceActor.set_position(rect.x, rect.y);
        this._sourceActor.show();

        let [minWidth, minHeight, natWidth, natHeight] = menu.actor.get_preferred_size();

        menu.shiftToPosition((rect.x + natWidth / 2) + 5); // +5 for appearances

        menu.open();
        menu.actor.navigate_focus(null, Gtk.DirectionType.TAB_FORWARD, false);
        menu.connect('open-state-changed', (menu_, isOpen) => {
            if (isOpen)
                return;

            this._sourceActor.hide();
            window.disconnect(destroyId);
        });
    }
};
