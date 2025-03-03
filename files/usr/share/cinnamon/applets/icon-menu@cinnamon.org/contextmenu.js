const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const XApp = imports.gi.XApp;
const Main = imports.ui.main;
const {PopupBaseMenuItem, PopupMenu, PopupSeparatorMenuItem} = imports.ui.popupMenu;
const {getUserDesktopDir, changeModeGFile} = imports.misc.fileUtils;
const {SignalManager} = imports.misc.signalManager;
const {spawnCommandLine} = imports.misc.util;

const {MODABLE, MODED} = require('./emoji');

class ContextMenuItem extends PopupBaseMenuItem {
    constructor(appThis, label, iconName, action, insensitive = false) {
        super({focusOnHover: false});
        this.appThis = appThis;
        if (iconName) {
            const icon = new St.Icon({ style_class: 'popup-menu-icon', icon_name: iconName,
                                                                icon_type: St.IconType.SYMBOLIC});
            this.addActor(icon, {span: 0});
        }
        this.addActor(new St.Label({text: label}));

        this.signals = new SignalManager(null);
        this.action = action;
        if (this.action === null && !insensitive) {//"Open with" item
            this.actor.add_style_class_name('popup-subtitle-menu-item');
        } else if (insensitive) {//greyed out item
            this.actor.add_style_pseudo_class('insensitive');
        }
        this.signals.connect(this.actor, 'enter-event', this.handleEnter.bind(this));
        this.signals.connect(this.actor, 'leave-event', this.handleLeave.bind(this));
    }

    handleEnter(actor, e) {
        if (this.action === null) {
            return Clutter.EVENT_STOP;
        }
        this.has_focus = true;
        this.actor.add_style_pseudo_class('hover');
        this.actor.add_style_pseudo_class('active');
        return Clutter.EVENT_STOP;
    }

    handleLeave(actor, e) {
        this.has_focus = false;
        this.actor.remove_style_pseudo_class('hover');
        this.actor.remove_style_pseudo_class('active');
        return Clutter.EVENT_STOP;
    }

    activate(event) {
        if (!this.action || event && event.get_button() !== Clutter.BUTTON_PRIMARY) {
            return Clutter.EVENT_STOP;
        }
        this.action();
        return Clutter.EVENT_STOP;
    }

    destroy() {
        this.signals.disconnectAllSignals();
        PopupBaseMenuItem.prototype.destroy.call(this);
    }
}

class ContextMenu {
    constructor(appThis) {
        this.appThis = appThis;
        this.menu = new PopupMenu(this.appThis.actor /*,St.Side.TOP*/);
        this.menu.actor.hide();
        this.contextMenuBox = new St.BoxLayout({ style_class: '', vertical: true, reactive: true });
        this.contextMenuBox.add_actor(this.menu.actor);
        
        this.contextMenuButtons = [];
        this.isOpen = false;
    }

    openAppContextMenu(app, e, buttonActor) {
        //e is used to position context menu at mouse coords. If keypress opens menu then
        //e is undefined and buttonActor position is used instead.
        this.contextMenuButtons.forEach(button => button.destroy());
        this.contextMenuButtons = [];

        //------populate menu
        if (app.isApplication) {
            this._populateContextMenu_apps(app);
        } else if (app.isFolderviewFile || app.isDirectory ||
                   app.isRecentFile || app.isFavoriteFile) {
            if (!this._populateContextMenu_files(app)) {
                return;
            }
        } else if (app.isSearchResult && app.emoji) {
            const i = MODABLE.indexOf(app.emoji);//Find if emoji is in list of emoji that can have
                                                 //skin tone modifiers.
            if (i < 0) {
                return;
            }
            const addMenuItem = (char, text) => {
                const newEmoji = MODED[i].replace(/\u{1F3FB}/ug, char); //replace light skin tone character in
                                                                       // MODED[i] with skin tone option.
                const item = new ContextMenuItem(this.appThis, newEmoji + ' ' + text, null,
                    () => {
                        const clipboard = St.Clipboard.get_default();
                        clipboard.set_text(St.ClipboardType.CLIPBOARD, newEmoji);
                        this.appThis.menu.close();
                    }
                );
                this.menu.addMenuItem(item);
                this.contextMenuButtons.push(item);
            };
            addMenuItem('\u{1F3FB}', _('light skin tone'));
            addMenuItem('\u{1F3FC}', _('medium-light skin tone'));
            addMenuItem('\u{1F3FD}', _('medium skin tone'));
            addMenuItem('\u{1F3FE}', _('medium-dark skin tone'));
            addMenuItem('\u{1F3FF}', _('dark skin tone'));
        } else {
            return;
        }
        this._showMenu(e, buttonActor);
    }

    openCategoryContextMenu(categoryId, e, buttonActor) {
        //e is used to position context menu at mouse coords. If keypress opens menu then
        //e is undefined and buttonActor position is used instead.
        this.contextMenuButtons.forEach(button => button.destroy());
        this.contextMenuButtons = [];

        //------populate menu
        const addMenuItem = (item) => {
            this.menu.addMenuItem(item);
            this.contextMenuButtons.push(item);
        };
        if (categoryId.startsWith('/')) {
            addMenuItem(new ContextMenuItem(this.appThis, _('Remove category'), 'user-trash',
                () => {
                    if (categoryId === GLib.get_home_dir()) {
                        this.appThis.settings.showHomeFolder = false;
                        this.appThis._onShowHomeFolderChange();
                    } else {
                        this.appThis.removeFolderCategory(categoryId);
                    }
                    this.appThis.display.categoriesView.update();
                    this.close();
                }
            ));
            this.menu.addMenuItem(new PopupSeparatorMenuItem(this.appThis));
        }
        addMenuItem(new ContextMenuItem(this.appThis, _('Reset category order'), 'edit-undo-symbolic',
            () => {
                this.appThis.settings.categories = [];
                this.appThis.display.categoriesView.update();
                this.close();
            }
        ));
        
        this._showMenu(e, buttonActor);
    }

    _showMenu(e, buttonActor) {
        //----Position and open context menu----
        this.isOpen = true;
        this.appThis.resizer.inhibit_resizing = true;

        const monitor = Main.layoutManager.findMonitorForActor(this.menu.actor);
        let mx, my;
        if (e) {
            [mx, my] = e.get_coords(); //get mouse position
        } else {//activated by keypress, no e supplied
            [mx, my] = buttonActor.get_transformed_position();
            mx += 20;
            my += 20;
        }
        if (mx > monitor.x + monitor.width - this.menu.actor.width) {
            mx -= this.menu.actor.width;
        }
        if (my > monitor.y + monitor.height - this.menu.actor.height - 40/*allow for panel*/) {
            my -= this.menu.actor.height;
        }

        let [cx, cy] = this.contextMenuBox.get_transformed_position();
        
        this.menu.actor.set_anchor_point(Math.round(cx - mx), Math.round(cy - my));
        
        //This context menu doesn't have an St.Side and so produces errors in .xsession-errors.
        //Enable animation here for the sole reason that it spams .xsession-errors less. Can't add an
        //St.Side because in some themes it looks like it should be attached to a panel but isn't.
        //Ideally, a proper floating popup menu should be coded.
        this.menu.open(true);
        return;
    }

    _populateContextMenu_apps(app) {
        const addMenuItem = (item) => {
            this.menu.addMenuItem(item);
            this.contextMenuButtons.push(item);
        };

        //Run with NVIDIA GPU
        if (Main.gpu_offload_supported) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Run with NVIDIA GPU'), 'cpu',
                () => {
                    try {
                        app.launch_offloaded(0, [], -1);
                    } catch (e) {
                        global.logError('Could not launch app with dedicated gpu: ', e);
                    }
                    this.appThis.menu.close();
                }
            ));
        }

        //Add to panel
        addMenuItem(new ContextMenuItem(this.appThis, _('Add to panel'), 'list-add',
            () => {
                if (!Main.AppletManager.get_role_provider_exists(Main.AppletManager.Roles.PANEL_LAUNCHER)) {
                    const new_applet_id = global.settings.get_int('next-applet-id');
                    global.settings.set_int('next-applet-id', (new_applet_id + 1));
                    const enabled_applets = global.settings.get_strv('enabled-applets');
                    enabled_applets.push('panel1:right:0:panel-launchers@cinnamon.org:' + new_applet_id);
                    global.settings.set_strv('enabled-applets', enabled_applets);
                }
                const launcherApplet =
                            Main.AppletManager.get_role_provider(Main.AppletManager.Roles.PANEL_LAUNCHER);
                if (launcherApplet) {
                    launcherApplet.acceptNewLauncher(app.id);
                }
                this.close();
            }
        ));

        //Add to desktop
        const userDesktopPath = getUserDesktopDir();
        if (userDesktopPath) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Add to desktop'), 'computer',
                () => {
                    const file = Gio.file_new_for_path(app.get_app_info().get_filename());
                    const destFile = Gio.file_new_for_path(userDesktopPath + '/' + file.get_basename());
                    try {
                        file.copy( destFile, 0, null, null);
                        changeModeGFile(destFile, 755);
                    } catch(e) {
                        global.logError('gridmenu: Error creating desktop file: ' + e.message);
                    }
                    this.close();
                }
            ));
        }

        //add/remove favorite
        if (this.appThis.appFavorites.isFavorite(app.id)) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Remove from favorites'), 'starred',
                () => {
                    this.appThis.appFavorites.removeFavorite(app.id);
                    this.close();
                }
            ));
        } else {
            addMenuItem( new ContextMenuItem(this.appThis, _('Add to favorites'), 'non-starred',
                () => {
                    this.appThis.appFavorites.addFavorite(app.id);
                    this.close();
                }
            ));
        }

        //uninstall (Mint only)
        if (this.appThis._canUninstallApps) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Uninstall'), 'edit-delete',
                () => {
                    spawnCommandLine("/usr/bin/cinnamon-remove-application '" +
                                                app.get_app_info().get_filename() + "'");
                    this.appThis.menu.close();
                }
            ));
        }

        //show app info 
        if (this.appThis._pamacManagerAvailable) {
            addMenuItem( new ContextMenuItem(this.appThis, _('App Info'), 'dialog-information',
                () => {
                    spawnCommandLine("/usr/bin/pamac-manager --details-id=" + app.id);
                    this.appThis.menu.close();
                }
            ));
        }

        //Properties
        addMenuItem( new ContextMenuItem(this.appThis, _('Properties'), 'document-properties-symbolic',
            () => {
                spawnCommandLine('cinnamon-desktop-editor -mlauncher -o ' + app.desktop_file_path);
                this.appThis.menu.close();
            }
        ));
    }

    _populateContextMenu_files(app) {
        const addMenuItem = (item) => {
            this.menu.addMenuItem(item);
            this.contextMenuButtons.push(item);
        };

        const hasLocalPath = (file) => (file.is_native() && file.get_path() != null);
        const file = Gio.File.new_for_uri(app.uri);
        const fileExists = file.query_exists(null);
        if (!fileExists && !app.isFavoriteFile) {
            Main.notify(_('This file is no longer available'),'');
            return false; //no context menu
        }
        //Note: a file can be an isFavoriteFile and also not exist so continue below and add option to
        //remove from favorites.

        //Open with...
        if (fileExists) {
            addMenuItem( new ContextMenuItem(this.appThis, _('Open with'), null, null));
            const defaultInfo = Gio.AppInfo.get_default_for_type(app.mimeType, !hasLocalPath(file));
            if (defaultInfo) {
                addMenuItem( new ContextMenuItem(this.appThis, defaultInfo.get_display_name(), null,
                    () => {
                        defaultInfo.launch([file], null);
                        this.appThis.menu.close();
                    }
                ));
            }
            Gio.AppInfo.get_all_for_type(app.mimeType).forEach(info => {
                if (!hasLocalPath(file) || !info.supports_uris() || info.equal(defaultInfo)) {
                    return;
                }
                addMenuItem( new ContextMenuItem(this.appThis, info.get_display_name(), null,
                    () => {
                        info.launch([file], null);
                        this.appThis.menu.close();
                    }
                ));
            });
            addMenuItem( new ContextMenuItem(this.appThis, _('Other application...'), null,
                () => {
                    spawnCommandLine('nemo-open-with ' + app.uri);
                    this.appThis.menu.close();
                }
            ));
        }

        //add/remove favorite
        this.menu.addMenuItem(new PopupSeparatorMenuItem(this.appThis));
        if (XApp.Favorites.get_default().find_by_uri(app.uri) !== null) { //favorite
            addMenuItem( new ContextMenuItem(this.appThis, _('Remove from favorites'), 'starred',
                () => {
                    XApp.Favorites.get_default().remove(app.uri);
                    this.close();
                }
            ));
        } else {
            addMenuItem( new ContextMenuItem(this.appThis, _('Add to favorites'), 'non-starred',
                () => {
                    XApp.Favorites.get_default().add(app.uri);
                    this.close();
                }
            ));
        }

        //Add folder as category
        if (app.isDirectory && this.appThis.settings.showCategories) {
            const path = Gio.file_new_for_uri(app.uri).get_path();
            if (!this.appThis.getIsFolderCategory(path)) {
                this.menu.addMenuItem(new PopupSeparatorMenuItem(this.appThis));
                addMenuItem(new ContextMenuItem(this.appThis, _('Add folder as category'), 'list-add',
                    () => {
                        if (path === GLib.get_home_dir()) {
                            this.appThis.settings.showHomeFolder = true;
                        }
                        this.appThis.addFolderCategory(path);
                        this.appThis.display.categoriesView.update();
                        this.close();
                    }
                ));
            }
        }

        //Open containing folder
        const folder = file.get_parent();
        if (app.isRecentFile || app.isFavoriteFile || app.isFolderviewFile) {
            this.menu.addMenuItem(new PopupSeparatorMenuItem(this.appThis));
            addMenuItem(new ContextMenuItem(this.appThis, _('Open containing folder'), 'go-jump',
                () => {
                    const fileBrowser = Gio.AppInfo.get_default_for_type('inode/directory', true);
                    fileBrowser.launch([folder], null);
                    this.appThis.menu.close();
                }
            ));
        }

        //Move to trash
        if (!app.isFavoriteFile) {
            this.menu.addMenuItem(new PopupSeparatorMenuItem(this.appThis));

            const fileInfo = file.query_info('access::can-trash', Gio.FileQueryInfoFlags.NONE, null);
            const canTrash = fileInfo.get_attribute_boolean('access::can-trash');
            if (canTrash) {
                addMenuItem(new ContextMenuItem(this.appThis, _('Move to trash'), 'user-trash',
                    () => {
                        const file = Gio.File.new_for_uri(app.uri);
                        try {
                            file.trash(null);
                        } catch (e) {
                            Main.notify(_('Error while moving file to trash:'), e.message);
                        }
                        this.appThis.setActiveCategory(this.appThis.currentCategory);
                        this.close();
                    }
                ));
            } else {//show insensitive item
                addMenuItem( new ContextMenuItem(this.appThis, _('Move to trash'), 'user-trash',
                                                                        null, true /*insensitive*/));
            }
        }
        return true; //success.
    }

    getCurrentlyFocusedMenuItem() {
        if (!this.isOpen) {
            return -1;
        }
        
        let focusedButton = this.contextMenuButtons.findIndex(button => button.has_focus);
        if (focusedButton < 0) {
            focusedButton = 0;
        }
        return focusedButton;
    }

    close() {
        this.menu.close();
        this.isOpen = false;
        this.appThis.resizer.inhibit_resizing = false;
    }

    destroy() {
        this.contextMenuButtons.forEach(button => button.destroy());
        this.contextMenuButtons = null;
        //this.menu.destroy(); //causes errors in .xsession-errors??
        this.contextMenuBox.destroy();
    }
}

module.exports = {ContextMenu};
