const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Main = imports.ui.main;
const Pango = imports.gi.Pango;
const Gtk = imports.gi.Gtk;
const Clutter = imports.gi.Clutter;

class WindowMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(icon, label, params) {
        super(params);
        this.box = new St.BoxLayout({ style_class: 'popup-combobox-item', style: 'padding: 0px;' });
        this.icon = icon;

        if (icon) {
            this.box.add(this.icon);
        }

        this.label = new St.Label({ text: label, y_align: Clutter.ActorAlign.CENTER });
        this.box.add(this.label);
        this.addActor(this.box);
    }
};

class CinnamonWindowsQuickListApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name('windows-quick-list');
        this.set_applet_tooltip(_('All windows'));

        this.items = [];

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.mainContainer = new St.BoxLayout({ vertical: true });
        this.menu.addActor(this.mainContainer);

        this.scrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START });
        this.scrollBox.set_auto_scrolling(true);
        this.mainContainer.add(this.scrollBox);

        this.windowsBox = new St.BoxLayout({ vertical:true });
        this.scrollBox.add_actor(this.windowsBox);
        this.scrollBox.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
    }

    _addItem(item) {
        this.windowsBox.add_child(item.actor);
        this.items.push(item);
    }

    updateMenu() {
        for (let i = 0; i < this.items.length; i++) {
            this.items[i].destroy();
        }

        let empty_menu = true;
        let tracker = Cinnamon.WindowTracker.get_default();

        for (let wks = 0; wks < global.workspace_manager.n_workspaces; ++wks) {
            // construct a list with all windows
            let workspace_name = Main.getWorkspaceName(wks);
            let metaWorkspace = global.workspace_manager.get_workspace_by_index(wks);
            let windows = metaWorkspace.list_windows();
            let sticky_windows = windows.filter(function(w) {
                return !w.is_skip_taskbar() && w.is_on_all_workspaces();
            });
            windows = windows.filter(function(w) {
                return !w.is_skip_taskbar() && !w.is_on_all_workspaces();
            });

            windows = windows.filter(Main.isInteresting);

            if (sticky_windows.length && wks == 0) {
                for (let i = 0; i < sticky_windows.length; ++i) {
                    let metaWindow = sticky_windows[i];

                    let app = tracker.get_window_app(metaWindow);
                    let icon = app.create_icon_texture_for_window(24, metaWindow);
                    let item = new WindowMenuItem(icon, metaWindow.get_title());
                    item.label.add_style_class_name('window-sticky');
                    item.label.set_style("max-width:30em;");

                    item.connect(
                        'activate',
                        Lang.bind(this, function() {
                            this.activateWindow(metaWorkspace, metaWindow);
                        })
                    );

                    this._addItem(item);
                    empty_menu = false;
                }
                this._addItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            if (windows.length) {
                if (wks > 0) {
                    this._addItem(new PopupMenu.PopupSeparatorMenuItem());
                }
                if (global.workspace_manager.n_workspaces > 1) {
                    let item = new WindowMenuItem(null, workspace_name);
                    item.actor.reactive = false;
                    item.actor.can_focus = false;
                    item.label.add_style_class_name('popup-subtitle-menu-item');
                    if (wks == global.workspace_manager.get_active_workspace().index()) {
                        item.setShowDot(true);
                    }
                    this._addItem(item);
                    empty_menu = false;
                }

                for (let i = 0; i < windows.length; ++i) {
                    let metaWindow = windows[i];

                    let app = tracker.get_window_app(metaWindow);
                    let icon = app.create_icon_texture_for_window(24, metaWindow);
                    let item = new WindowMenuItem(icon, metaWindow.get_title());
                    item.label.add_style_class_name('window-sticky');
                    item.label.set_style("max-width:30em;");
                    item.label.ellipsize = Pango.EllipsizeMode.END;

                    item.connect(
                        'activate',
                        Lang.bind(this, function() {
                            this.activateWindow(metaWorkspace, metaWindow);
                        })
                    );

                    this._addItem(item);
                    empty_menu = false;
                }
            }
        }
        if (empty_menu) {
            let item = new PopupMenu.PopupMenuItem(_('No open windows'));
            item.actor.reactive = false;
            item.actor.can_focus = false;
            item.label.add_style_class_name('popup-subtitle-menu-item');
            this._addItem(item);
        }
    }

    activateWindow(metaWorkspace, metaWindow) {
        if (this.menu.isOpen) {
            this.menu.toggle_with_options(false);
        }

        if (!metaWindow.is_on_all_workspaces()) {
            metaWorkspace.activate(global.get_current_time());
        }

        metaWindow.unminimize();
        metaWindow.activate(global.get_current_time());
    }

    on_applet_clicked(event) {
        if (this.menu.isOpen) {
            this.menu.close(false);
        } else {
            this.updateMenu();
            this.menu.open(true);
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonWindowsQuickListApplet(metadata, orientation, panel_height, instance_id);
}
