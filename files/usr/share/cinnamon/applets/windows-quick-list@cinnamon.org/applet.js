const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Main = imports.ui.main;
const Pango = imports.gi.Pango;

class CinnamonWindowsQuickListApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.set_applet_icon_symbolic_name('windows-quick-list');
        this.set_applet_tooltip(_('All windows'));
        this._menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menuManager.addMenu(this._menu);
        this.subMenuItemWrapper = new PopupMenu.PopupSubMenuMenuItem(null);
        this.subMenuItemWrapper.actor.set_style_class_name('');
        this.subMenuItemWrapper.menu.actor.set_style_class_name('');
        this.menu = this.subMenuItemWrapper.menu;
        this._menu.addMenuItem(this.subMenuItemWrapper);
    }

    updateMenu() {
        this.menu.removeAll();
        let empty_menu = true;
        let tracker = Cinnamon.WindowTracker.get_default();

        for (let wks = 0; wks < global.screen.n_workspaces; ++wks) {
            // construct a list with all windows
            let workspace_name = Main.getWorkspaceName(wks);
            let metaWorkspace = global.screen.get_workspace_by_index(wks);
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
                    let item = new PopupMenu.PopupMenuItem(metaWindow.get_title());
                    item.label.add_style_class_name('window-sticky');
                    item.connect(
                        'activate',
                        Lang.bind(this, function() {
                            this.activateWindow(metaWorkspace, metaWindow);
                        })
                    );
                    item._window = sticky_windows[i];
                    let app = tracker.get_window_app(item._window);
                    item._icon = app.create_icon_texture_for_window(24, item._window);
                    item.addActor(item._icon, {align: St.Align.END});
                    this.menu.addMenuItem(item);
                    empty_menu = false;
                }
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            if (windows.length) {
                if (wks > 0) {
                    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                }
                if (global.screen.n_workspaces > 1) {
                    let item = new PopupMenu.PopupMenuItem(workspace_name);
                    item.actor.reactive = false;
                    item.actor.can_focus = false;
                    item.label.add_style_class_name('popup-subtitle-menu-item');
                    if (wks == global.screen.get_active_workspace().index()) {
                        item.setShowDot(true);
                    }
                    this.menu.addMenuItem(item);
                    empty_menu = false;
                }

                for (let i = 0; i < windows.length; ++i) {
                    let metaWindow = windows[i];
                    let metaWindowTitle = metaWindow.get_title();
                    let item = new PopupMenu.PopupMenuItem(metaWindowTitle);
                    item.label.set_style("max-width:30em;");
                    item.label.ellipsize = Pango.EllipsizeMode.END;
                    item.connect(
                        'activate',
                        Lang.bind(this, function() {
                            this.activateWindow(metaWorkspace, metaWindow);
                        })
                    );
                    item._window = metaWindow;
                    let app = tracker.get_window_app(item._window);
                    item._icon = app.create_icon_texture_for_window(24, item._window);
                    item.addActor(item._icon, {align: St.Align.END});
                    this.menu.addMenuItem(item);
                    empty_menu = false;
                }
            }
        }
        if (empty_menu) {
            let item = new PopupMenu.PopupMenuItem(_('No open windows'));
            item.actor.reactive = false;
            item.actor.can_focus = false;
            item.label.add_style_class_name('popup-subtitle-menu-item');
            this.menu.addMenuItem(item);
        }
    }

    activateWindow(metaWorkspace, metaWindow) {
        if (this._menu.isOpen) {
            this._menu.toggle_with_options(false);
        }
        this.menu.toggle();
        if (!metaWindow.is_on_all_workspaces()) {
            metaWorkspace.activate(global.get_current_time());
        }
        metaWindow.unminimize();
        metaWindow.activate(global.get_current_time());
    }

    on_applet_clicked(event) {
        if (this._menu.isOpen) {
            this.menu.close(false);
            this._menu.close(false);
        } else {
            this.updateMenu();
            this._menu.open(false);
            this.menu.open(true);
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonWindowsQuickListApplet(metadata, orientation, panel_height, instance_id);
}
