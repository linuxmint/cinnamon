const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const CMenu = imports.gi.CMenu;
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const XApp = imports.gi.XApp;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Main = imports.ui.main;
const Util = imports.misc.util;
const GnomeSession = imports.misc.gnomeSession;
const AppletManager = imports.ui.appletManager;
const {ScreenSaverProxy} = imports.misc.screenSaver;
const {PopupMenuManager} = imports.ui.popupMenu;
const {getAppFavorites} = imports.ui.appFavorites;
const {TextIconApplet, AllowedLayout, AppletPopupMenu, PopupResizeHandler} = imports.ui.applet;
const {SignalManager} = imports.misc.signalManager;
const {launch_all} = imports.ui.searchProviderManager;
const {AppletSettings} = imports.ui.settings;
const Mainloop = imports.mainloop;

const {graphemeBaseChars, searchStr} = require('./utils');
const {Display} = require('./display');
const {EMOJI} = require('./emoji');
const EMOJI_CODE = 0, EMOJI_NAME = 1, EMOJI_KEYWORDS = 2;
const REMEMBER_RECENT_KEY = 'remember-recent-files';
const SEARCH_THRESHOLD = 0.45;
const SidebarPlacement = Object.freeze({TOP: 0, BOTTOM: 1, LEFT: 2, RIGHT: 3});

/* This graph shows the classes in which other classes are instantiated and how they are
 * acessed. e.g. to call the update() method in categoriesView from contextMenu class use:
 * this.appThis.display.categoriesView.update()

                                        ┌── class AppsView ───────┬── class AppButton
                                        │                         └── class Subheading
                                        │
                  ┌── class Display ────┼── class CategoriesView ──── class CategoryButton
                  │                     │
                  │                     ├── class Sidebar ────────┬── class SidebarButton
                  │                     │                         └── class Separator
class             │                     │
CinnamenuApplet ──┼                     ├── class ContextMenu ─────── class ContextMenuItem
                  │                     │
                  │                     └── class SearchView
                  │
                  ├── class Apps
                  │
                  └── class RecentApps

*/

class CinnamenuApplet extends TextIconApplet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.setAllowedLayout(AllowedLayout.BOTH);
        this.privacy_settings = new Gio.Settings({schema_id: 'org.cinnamon.desktop.privacy'});
        this.appFavorites = getAppFavorites();
        this.currentCategory = 'all';
        this.recentManagerDefault = Gtk.RecentManager.get_default();
        this.orientation = orientation;
        this.menuManager = new PopupMenuManager(this);
        this.menu = new AppletPopupMenu(this, this.orientation);
        this.menuManager.addMenu(this.menu);
        this.signals = new SignalManager(null);
        this.appSystem = Cinnamon.AppSystem.get_default();
        this._canUninstallApps = GLib.file_test("/usr/bin/cinnamon-remove-application",
                                                GLib.FileTest.EXISTS);
        this._pamacManagerAvailable = GLib.file_test("/usr/bin/pamac-manager", GLib.FileTest.EXISTS);
        this.resizer = new PopupResizeHandler(
            this.menu.actor,
            () => this.orientation,
            (w,h) => this.display.onMenuResized(w,h),
            () => this.settings.customMenuWidth * global.ui_scale,
            () => this.settings.customMenuHeight * global.ui_scale
        );
        this.signals.connect(this.privacy_settings, 'changed::' + REMEMBER_RECENT_KEY,
                                                        () => this._onEnableRecentsChange());

        const refreshDisplay = () => {
            // TBD: For some reason the onEnable* settings callbacks get called several times per
            // settings change. This is causing the start up category to reset, so throttling this
            // function to 250ms prevents excess invocation.
            if (!this.lastRenderTime) this.lastRenderTime = 0;
            const now = Date.now();
            if ((now - this.lastRenderTime) <= 250) {
                return;
            }
            this.lastRenderTime = now;
    
            this.display.destroy();
            this.menu.removeAll();
            this.display = new Display(this)
            this.display.sidebar.populate();
            this.display.categoriesView.update();
            this.display.clearFocusedActors();
        }
        
        this.signals.connect(Main.themeManager, 'theme-set', () => {
            this._updateIconAndLabel();
            Mainloop.timeout_add(0, () => {
                refreshDisplay();
                return false;
            });
        });
        this.iconTheme = Gtk.IconTheme.get_default();
        this.signals.connect(this.iconTheme, 'changed', () => this._updateIconAndLabel());
        this.signals.connect(this.appSystem, 'installed-changed', () => {
            this.apps.installedChanged();
            refreshDisplay();
        });
        this.signals.connect(this.appFavorites, 'changed', () => {
            if (this.display) {// Check if display is initialised
                this.display.sidebar.populate();
                this.display.updateMenuSize();
                if (this.currentCategory === 'favorite_apps' && !this.searchActive) {
                    this.setActiveCategory(this.currentCategory);
                }
            }
        });
        this.signals.connect(
            this.menu,
            'open-state-changed',
            this._onOpenStateToggled.bind(this)
        );
        this.signals.connect(this.menu,
            'menu-animated-closed',
            this._onMenuClosed.bind(this)
        );
        this.signals.connect(XApp.Favorites.get_default(), 'changed', () => this._onXappFavoritesChange());
        this.apps = new Apps(this.appSystem);
        this.screenSaverProxy = new ScreenSaverProxy();
        this.sessionManager = new GnomeSession.SessionManager();

        const updateKeybinding = () => {
            Main.keybindingManager.addHotKey(
                'overlay-key-' + this.instance_id,
                this.settings.overlayKey,
                () => {
                    if (Main.overview.visible || Main.expo.visible) return;
                    if (!this.menu.isOpen) {
                        this.panel.peekPanel();
                    }
                    this.menu.toggle_with_options(this.settings.enableAnimation);
                }
            );
        };

        const updateActivateOnHover = () => {
            const openMenu = () => {
                if (!this._applet_context_menu.isOpen) {
                    this.menu.open(this.settings.enableAnimation);
                }
            };
            
            if (this.signals.isConnected('enter-event', this.actor)) {
                this.signals.disconnect('enter-event', this.actor);
                this.signals.disconnect('leave-event', this.actor);
            }
            if (this.settings.activateOnHover) {
                this.signals.connect(this.actor, 'enter-event', () => {
                    if (!this.menu.isOpen && !this.openMenuTimeoutId) {
                        this.openMenuTimeoutId = Mainloop.timeout_add(this.settings.hoverDelayMs, () => openMenu());
                    }
                });
                this.signals.connect(this.actor, 'leave-event', () => {
                    if (this.openMenuTimeoutId) {
                        Mainloop.source_remove(this.openMenuTimeoutId);
                        this.openMenuTimeoutId = null;
                    }
                });
            }
        };

        this.settings = {};
        this.appletSettings = new AppletSettings(this.settings, __meta.uuid, this.instance_id);
        [
        { key: 'categories',                value: 'categories',            cb: null },
        { key: 'custom-menu-height',        value: 'customMenuHeight',      cb: null },
        { key: 'custom-menu-width',         value: 'customMenuWidth',       cb: null },
        { key: 'recent-apps',               value: 'recentApps',            cb: null },
        { key: 'folder-categories',         value: 'folderCategories',      cb: null },

        { key: 'description-placement',     value: 'descriptionPlacement',  cb: refreshDisplay },
        { key: 'show-sidebar',              value: 'showSidebar',           cb: refreshDisplay },
        { key: 'sidebar-placement',         value: 'sidebarPlacement',      cb: refreshDisplay },
        { key: 'sidebar-favorites',         value: 'sidebarFavorites',      cb: refreshDisplay },
        
        { key: 'show-categories',           value: 'showCategories',        cb: refreshDisplay},
        { key: 'show-places-category',      value: 'showPlaces',            cb: () => this.display.categoriesView.update() },
        { key: 'show-recents-category',     value: 'showRecents',           cb: this._onEnableRecentsChange },
        { key: 'show-favorite-apps-category', value: 'showFavAppsCategory', cb: () => this.display.categoriesView.update() },
        { key: 'show-home-folder-category', value: 'showHomeFolder',        cb: this._onShowHomeFolderChange},

        { key: 'overlay-key',               value: 'overlayKey',            cb: updateKeybinding },
        { key: 'activate-on-hover',         value: 'activateOnHover',       cb: updateActivateOnHover },
        { key: 'hover-delay',               value: 'hoverDelayMs',          cb: updateActivateOnHover },
        { key: 'enable-animation',          value: 'enableAnimation',       cb: null },
        { key: 'open-on-category',          value: 'openOnCategory',        cb: null },

        { key: 'category-click',            value: 'categoryClick',         cb: null },
        { key: 'enable-autoscroll',         value: 'enableAutoScroll',      cb: refreshDisplay },
        { key: 'show-hidden-files',         value: 'showHiddenFiles',       cb: null },

        { key: 'enable-emoji-search',       value: 'enableEmojiSearch',     cb: null },
        { key: 'enable-home-folder-search', value: 'searchHomeFolder',      cb: null },

        { key: 'menu-icon-custom',          value: 'menuIconCustom',        cb: this._updateIconAndLabel },
        { key: 'menu-icon',                 value: 'menuIcon',              cb: this._updateIconAndLabel },
        { key: 'menu-icon-size-custom',     value: 'menuIconSizeCustom',    cb: this._updateIconAndLabel },
        { key: 'menu-icon-size',            value: 'menuIconSize',          cb: this._updateIconAndLabel },
        { key: 'menu-label',                value: 'menuLabel',             cb: this._updateIconAndLabel },

        { key: 'category-icon-size',        value: 'categoryIconSize',      cb: refreshDisplay },
        { key: 'apps-grid-icon-size',       value: 'appsGridIconSize',      cb: refreshDisplay },
        { key: 'sidebar-icon-size',         value: 'sidebarIconSize',       cb: refreshDisplay }
        ].forEach(setting => this.appletSettings.bind(
            setting.key,
            setting.value,
            setting.cb ? setting.cb.bind(this) : null )
        );

        this.recentApps = new RecentApps(this);
        this._onEnableRecentsChange();
        updateActivateOnHover();
        updateKeybinding();
        this.display = new Display(this);
        this.display.sidebar.populate();
        this.display.categoriesView.update();
        this._updateIconAndLabel();
    }
//----------------TextIconApplet callbacks----------------
    on_orientation_changed(orientation) {
        this.orientation = orientation;
        if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
            this.hide_applet_label(true);
        } else {
            this.hide_applet_label(false);
        }
        this._updateIconAndLabel();
    }

    on_applet_added_to_panel() {
        this._onShowHomeFolderChange();
    }

    on_applet_removed_from_panel() {
        Main.keybindingManager.removeHotKey('overlay-key-' + this.instance_id);
        if (!this.appletSettings) {
            return;
        }
        this.appletSettings.finalize();
        this.signals.disconnectAllSignals();
        this.display.destroy();
        this.menu.destroy();
    }

    on_applet_clicked() {
        this.menu.toggle_with_options(this.settings.enableAnimation);
    }

    _setStyle() {
        // Override js/applet.js so _updateIconAndLabel doesn't have to fight with size changes
        // from the panel configuration. This gets called any time set_applet_icon() variants are
        // called.

        let icon_type = this._applet_icon.get_icon_type();
        let size;

        if (this.settings.menuIconSizeCustom) {
            size = Math.max(Math.min(this.settings.menuIconSize, this.panel.height), 1);
        } else {
            size = this.getPanelIconSize(icon_type);
        }

        if (icon_type === St.IconType.FULLCOLOR) {
            this._applet_icon.set_style_class_name('applet-icon');
        } else {
            this._applet_icon.set_style_class_name('system-status-icon');
        }

        this._applet_icon.set_icon_size(size);
    }
//------------settings callbacks-------------
    launchEditor() {
        Util.spawnCommandLine('cinnamon-menu-editor');
    }

    _onEnableRecentsChange () {
        const recentFilesEnabled = this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY);
        this.recentsEnabled = this.settings.showRecents && recentFilesEnabled;
        if (this.display) {
            this.display.categoriesView.update();
        }
    };

    _updateIconAndLabel() {
        try {
            if (this.settings.menuIconCustom) {
                if (this.settings.menuIcon === '') {
                    this.set_applet_icon_name('');
                } else if (GLib.path_is_absolute(this.settings.menuIcon) &&
                                    GLib.file_test(this.settings.menuIcon, GLib.FileTest.EXISTS)) {
                    if (this.settings.menuIcon.includes('-symbolic')) {
                        this.set_applet_icon_symbolic_path(this.settings.menuIcon);
                    } else {
                        this.set_applet_icon_path(this.settings.menuIcon);
                    }
                } else if (this.iconTheme.has_icon(this.settings.menuIcon)) {
                    if (this.settings.menuIcon.includes('-symbolic')) {
                        this.set_applet_icon_symbolic_name(this.settings.menuIcon);
                    } else {
                        this.set_applet_icon_name(this.settings.menuIcon);
                    }
                }
            } else {
                const icon_name = global.settings.get_string('app-menu-icon-name');
                if (icon_name.search("-symbolic") != -1) {
                    this.set_applet_icon_symbolic_name(icon_name);
                }
                else {
                    this.set_applet_icon_name(icon_name);
                }
            }
        } catch(e) {
            global.logWarning('Gridmenu: Could not load icon file ' + this.settings.menuIcon +
                                                                            ' for menu button');
        }
        if (this.settings.menuIconCustom && this.settings.menuIcon === '' ||
                            this.settings.menuIconSizeCustom && this.settings.menuIconSize === 0) {
            this._applet_icon_box.hide();
        } else {
            this._applet_icon_box.show();
        }

        if (this.orientation === St.Side.LEFT || this.orientation === St.Side.RIGHT) {
            this.set_applet_label('');
        } else {
            if (!this.settings.menuLabel) {
                this.settings.menuLabel = '';
            }
            const menuLabel = this.settings.menuLabel.substring(0, 45);
            this.set_applet_label(menuLabel);
            this.set_applet_tooltip(menuLabel);
        }
    }

    _onShowHomeFolderChange() {
        const homePath = GLib.get_home_dir();
        if (this.settings.showHomeFolder) {
            if (!this.getIsFolderCategory(homePath)) {
                this.addFolderCategory(homePath);
                this.display.categoriesView.update();
            }
        } else {
            if (this.getIsFolderCategory(homePath)) {
                this.removeFolderCategory(homePath);
                this.display.categoriesView.update();
            }
        }
    }
//==================================================================
    getAppIconSize() {
        return this.settings.appsGridIconSize;
    }

    addFavoriteAppToPos(add_id, pos_id) {
        const pos = this.appFavorites._getIds().indexOf(pos_id);
        if (pos >= 0) { //move
            this.appFavorites.moveFavoriteToPos(add_id, pos);
        } else {
            this.appFavorites.addFavoriteAtPos(add_id, pos);
        }
    }

    _onXappFavoritesChange() {
        this.display.sidebar.populate();
        this.display.categoriesView.update(); //in case fav files category needs adding/removing
        
        if (this.menu.isOpen) {
            this.display.updateMenuSize();
            if (this.currentCategory === 'favorite_files') {
                this.setActiveCategory(this.currentCategory);
            }
        }
    }

    getIsFolderCategory(path) {
        const index = this.settings.folderCategories.indexOf(path);
        return index > -1;
    }

    addFolderCategory(path) {
        const folderCategories = this.settings.folderCategories.slice();
        folderCategories.push(path);
        this.settings.folderCategories = folderCategories;
    }

    removeFolderCategory(path) {
        const folderCategories = this.settings.folderCategories.slice();
        const index = folderCategories.indexOf(path);
        if (index != -1) {
            folderCategories.splice(index, 1);
        }
        this.settings.folderCategories = folderCategories;
    }

    _onOpenStateToggled(menu, open) {
        if (global.settings.get_boolean('panel-edit-mode')) {
            return;
        }
        if (!open) {
            return; // this._onMenuClosed() is called on 'menu-animated-closed' signal to handle closing.
        }

        if (this.openMenuTimeoutId) {
            Mainloop.source_remove(this.openMenuTimeoutId);
            this.openMenuTimeoutId = null;
        }

        if (this.settings.showSidebar) {
            this.display.sidebar.scrollToQuitButton();//ensure quit button is visible
        }

        global.stage.set_key_focus(this.display.searchView.searchEntry);
        if (this.currentCategory === 'places' && !this.settings.showPlaces ||
                this.currentCategory === 'recents' && !this.recentsEnabled ||
                this.currentCategory === 'favorite_apps' && !this.settings.showFavAppsCategory) {
            this.currentCategory = 'all';
        }
        let openOnCategory = this.currentCategory;
        if (this.settings.openOnCategory === 4 || !this.settings.showCategories) {
            openOnCategory = 'all';
        } else if (this.settings.openOnCategory === 1 && this.settings.showFavAppsCategory) {
            openOnCategory = 'favorite_apps';
        } else if (this.settings.openOnCategory === 2 && this.recentsEnabled) {
            openOnCategory = 'recents';
        } else if (this.settings.openOnCategory === 3 && this.settings.showPlaces) {
            openOnCategory = 'places';
        }

        if (!this.resizer._size_restricted) {
            this.display.updateMenuSize();
        }
        this.setActiveCategory(openOnCategory);

        //Show panel when auto hide is on.
        //this.panel.peekPanel(); //no longer works on cinnamon 5.4.x

        //center menu if applet in center zone of top or bottom panel
        const appletDefinition = AppletManager.getAppletDefinition({applet_id: this.instance_id});
        if ((this.orientation === St.Side.BOTTOM || this.orientation === St.Side.TOP) &&
                                                    appletDefinition.location_label === 'center') {
            const monitor = Main.layoutManager.findMonitorForActor(this.menu.actor);
            this.menu.shiftToPosition(Math.floor(monitor.width / 2) + monitor.x);
        }

        //By default, current active category button will have focus. If categories are
        //hidden, give focus to first app item.
        if (!this.settings.showCategories) {
            this.display.appsView.focusFirstItem();
        }

        return;
    }

    _onMenuClosed() {
        if (this.searchActive) {
            this._endSearchMode();
        }
        this.display.clearFocusedActors();
        this.display.appsView.clearApps();//for quicker reopening of menu
    }

    _onMenuKeyPress(actor, event) {
        if (this.resizer.resizingInProgress) {
            return Clutter.EVENT_STOP;
        }

        const symbol = event.get_key_symbol();
        const keyCode = event.get_key_code();
        const modifierState = Cinnamon.get_event_state(event);

        /* check for a keybinding and quit early, otherwise we get a double hit
           of the keybinding callback */
        const action = global.display.get_keybinding_action(keyCode, modifierState);
        if (action === Meta.KeyBindingAction.CUSTOM) {
            return Clutter.EVENT_PROPAGATE;
        }

        const ctrlKey = modifierState === 4;
        const shiftKey = modifierState === 1;
        const altKey = modifierState === 8;
        //const altgrKey = modifierState === 128;
        const noModifiers = modifierState === 0;

        //Because Clutter.EVENT_PROPAGATE is returned on KEY_Left and KEY_Right, ignore duplicate
        //event emitted by ibus. https://github.com/linuxmint/cinnamon-spices-applets/issues/3294
        if (!this.lastKeyEventTime) this.lastKeyEventTime = 0;
        const now = Date.now();
        if ((symbol === Clutter.KEY_Left || symbol === Clutter.KEY_KP_Left
                    || symbol === Clutter.KEY_Right || symbol === Clutter.KEY_KP_Right)
                    && noModifiers && (now - this.lastKeyEventTime) <= 80) {
            return Clutter.EVENT_PROPAGATE;
        }
        this.lastKeyEventTime = now;

        const contextMenuButtons = this.display.contextMenu.contextMenuButtons;
        const appButtons = this.display.appsView.getActiveButtons();
        const sidebarButtons = this.display.sidebar.getButtons();
        const categoryButtons = this.display.categoriesView.buttons;

        const focusedContextMenuItemIndex = this.display.contextMenu.getCurrentlyFocusedMenuItem();
        let focusedAppItemIndex = appButtons.findIndex(button => button.has_focus);
        const focusedSidebarItemIndex = sidebarButtons.findIndex(button => button.has_focus);
        //When "activate categories on click" option is set, currentlyActiveCategoryIndex and
        //focusedCategoryIndex may not be the same.
        const focusedCategoryIndex = categoryButtons.findIndex(button => button.has_focus);

        let currentlyActiveCategoryIndex = categoryButtons.findIndex(button =>
                                                this.currentCategory === button.id);
        if (currentlyActiveCategoryIndex < 0) {
            currentlyActiveCategoryIndex = 0;
        }

        const focusedContextMenuItemExists = focusedContextMenuItemIndex > -1;
        let focusedAppItemExists = focusedAppItemIndex > -1;
        const focusedSidebarItemExists = focusedSidebarItemIndex > -1;
        const focusedCategoryExists = focusedCategoryIndex > -1;

        if (!focusedContextMenuItemExists && !focusedAppItemExists &&
            !focusedSidebarItemExists && !focusedCategoryExists) {
            //todo: No focused item, ideally this shouldn't happen
            if (appButtons[0]) {
                appButtons[0].handleEnter();
                focusedAppItemIndex = 0;
                focusedAppItemExists = true;
            }
        }

        const leaveCurrentlyFocusedItem = () => {
            if (focusedContextMenuItemExists) {
                contextMenuButtons[focusedContextMenuItemIndex].handleLeave();
            } else if (focusedAppItemExists) {
                appButtons[focusedAppItemIndex].handleLeave();
            } else if (focusedSidebarItemExists) {
                sidebarButtons[focusedSidebarItemIndex].handleLeave();
            } else if (focusedCategoryExists) {
                categoryButtons[focusedCategoryIndex].removeFocusAndHover();
            }
        };

        let tabRight = () => {
            if (focusedContextMenuItemExists) {
                //effectively ignore keypress
                contextMenuButtons[focusedContextMenuItemIndex].handleEnter();
            } else if (!this.searchActive && this.settings.showCategories && 
                (focusedSidebarItemExists ||
                focusedAppItemExists && !this.settings.showSidebar)) {
                categoryButtons[currentlyActiveCategoryIndex].handleEnter();
            } else if (focusedAppItemExists && this.settings.showSidebar) {
                sidebarButtons[0].handleEnter();
            } else {
                appButtons[0].handleEnter();
            }
        }
        
        let tabLeft = () => {
            if (focusedContextMenuItemExists) {
                //effectively ignore keypress
                contextMenuButtons[focusedContextMenuItemIndex].handleEnter();
            } else if (focusedAppItemExists && !this.searchActive &&
                this.settings.showCategories) {
                categoryButtons[currentlyActiveCategoryIndex].handleEnter();
            } else if (this.settings.showSidebar && (focusedCategoryExists ||
                focusedAppItemExists && (this.searchActive || !this.settings.showCategories))) {
                sidebarButtons[0].handleEnter();
            } else {
                appButtons[0].handleEnter();
            }
        }

        if (St.Widget.get_default_direction() === St.TextDirection.RTL) {
            [tabRight, tabLeft] = [tabLeft, tabRight];
        }

        const getNextSidebarItemIndex = () => {
            if (focusedSidebarItemIndex < sidebarButtons.length - 1) {
                return focusedSidebarItemIndex + 1;
            } else {
                return 0;
            }
        };

        const getPreviousSidebarItemIndex = () => {
            if (focusedSidebarItemIndex === 0) {
                return sidebarButtons.length -1;
            } else {
                return focusedSidebarItemIndex - 1;
            }
        };

        const leftNavigation = () => {
            if (focusedContextMenuItemExists) {
                contextMenuButtons[focusedContextMenuItemIndex].handleEnter();//effectively ignore
            } else if (focusedAppItemExists) {
                if (focusedAppItemIndex > 0) {
                    appButtons[focusedAppItemIndex - 1].handleEnter();
                } else {
                    appButtons[appButtons.length - 1].handleEnter();
                }
            } else if (focusedSidebarItemExists) {
                if (this.settings.sidebarPlacement === SidebarPlacement.LEFT ||
                                        this.settings.sidebarPlacement === SidebarPlacement.RIGHT) {
                    tabLeft();
                } else {
                    sidebarButtons[getPreviousSidebarItemIndex()].handleEnter();
                }
            } else if (focusedCategoryExists) {
                tabLeft();
            }
        };

        const rightNavigation = () => {
            if (focusedContextMenuItemExists) {
                contextMenuButtons[focusedContextMenuItemIndex].handleEnter();//effectively ignore keypress
            } else if (focusedAppItemExists) {
                if (appButtons[focusedAppItemIndex + 1]) {
                    appButtons[focusedAppItemIndex + 1].handleEnter();
                } else {
                    appButtons[0].handleEnter();
                }
            } else if (focusedSidebarItemExists) {
                if (this.settings.sidebarPlacement === SidebarPlacement.LEFT ||
                                this.settings.sidebarPlacement === SidebarPlacement.RIGHT) {
                    tabRight();;
                } else {
                    sidebarButtons[getNextSidebarItemIndex()].handleEnter();
                }
            } else if (focusedCategoryExists) {
                tabRight();
            }
        };

        const downNavigation = () => {
            if (focusedContextMenuItemExists) {
                let nextContextMenuItem = focusedContextMenuItemIndex + 1;
                while (!contextMenuButtons[nextContextMenuItem] ||
                                    contextMenuButtons[nextContextMenuItem].action === null) {
                    nextContextMenuItem++;
                    if (nextContextMenuItem >= contextMenuButtons.length) {
                        nextContextMenuItem = 0;
                    }
                }
                contextMenuButtons[nextContextMenuItem].handleEnter();
            } else if (focusedAppItemExists) {
                if (appButtons[focusedAppItemIndex + 1]) {
                    const column = appButtons[focusedAppItemIndex].actor.layout_column;
                    let next = focusedAppItemIndex + 1;
                    while (appButtons[next].actor.layout_column != column && appButtons[next + 1]) {
                        next++;
                    }
                    appButtons[next].handleEnter();
                } else {
                    appButtons[focusedAppItemIndex].handleEnter();//effectively no change
                }
            } else if (focusedSidebarItemExists) {
                if (this.settings.sidebarPlacement === SidebarPlacement.TOP) {
                    tabRight();
                } else if (this.settings.sidebarPlacement === SidebarPlacement.BOTTOM) {
                    tabLeft();
                } else {
                    sidebarButtons[getNextSidebarItemIndex()].handleEnter();
                }
            } else if (focusedCategoryExists) {
                if (categoryButtons[focusedCategoryIndex + 1]) {
                    categoryButtons[focusedCategoryIndex + 1].handleEnter();
                } else {
                    categoryButtons[0].handleEnter();
                }
            }
        };

        const upNavigation = () => {
            if (focusedContextMenuItemExists) {
                let previousContextMenuItem = focusedContextMenuItemIndex - 1;
                while (!contextMenuButtons[previousContextMenuItem] ||
                                    contextMenuButtons[previousContextMenuItem].action === null) {
                    previousContextMenuItem--;
                    if (previousContextMenuItem < 0) {
                        previousContextMenuItem = contextMenuButtons.length -1;
                    }
                }
                contextMenuButtons[previousContextMenuItem].handleEnter();
            } else if (focusedAppItemExists) {
                if (focusedAppItemIndex > 0) {
                    const column = appButtons[focusedAppItemIndex].actor.layout_column;
                    let previous = focusedAppItemIndex - 1;
                    while (appButtons[previous].actor.layout_column != column && previous > 0) {
                        previous--;
                    }
                    appButtons[previous].handleEnter();
                } else {
                    appButtons[0].handleEnter();//effectively no change
                }
            } else if (focusedSidebarItemExists) {
                if (this.settings.sidebarPlacement === SidebarPlacement.TOP) {
                    tabLeft();
                } else if (this.settings.sidebarPlacement === SidebarPlacement.BOTTOM) {
                    tabRight();
                } else {
                    sidebarButtons[getPreviousSidebarItemIndex()].handleEnter();
                }
            } else if (focusedCategoryExists) {
                if (focusedCategoryIndex > 0) {
                    categoryButtons[focusedCategoryIndex - 1].handleEnter();
                } else {
                    categoryButtons[categoryButtons.length - 1].handleEnter();
                }
            }
        };

        switch (true) {
        case (symbol === Clutter.KEY_KP_Enter || symbol === Clutter.KP_Enter ||
                                            symbol === Clutter.KEY_Return) && ctrlKey:
        case symbol === Clutter.KEY_Menu && noModifiers:
            if (this.display.contextMenu.isOpen) {
                this.display.contextMenu.close();
            } else if (focusedAppItemExists) {
                appButtons[focusedAppItemIndex].openContextMenu();
            } else if (focusedSidebarItemExists) {
                sidebarButtons[focusedSidebarItemIndex].openContextMenu();
            } else if (focusedCategoryExists) {
                categoryButtons[focusedCategoryIndex].openContextMenu();
            }
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.KP_Enter || symbol === Clutter.KEY_KP_Enter ||
                                        symbol === Clutter.KEY_Return) && noModifiers:
            if (focusedContextMenuItemExists) {
                contextMenuButtons[focusedContextMenuItemIndex].activate();
            } else if (focusedAppItemExists) {
                appButtons[focusedAppItemIndex].activate();
            } else if (focusedSidebarItemExists) {
                sidebarButtons[focusedSidebarItemIndex].activate();
            } else if (focusedCategoryExists) {
                categoryButtons[focusedCategoryIndex].selectCategory();
            }
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.KEY_Up || symbol === Clutter.KEY_KP_Up) && noModifiers:
            leaveCurrentlyFocusedItem();
            upNavigation();
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.KEY_Down || symbol === Clutter.KEY_KP_Down) && noModifiers:
            leaveCurrentlyFocusedItem();
            downNavigation();
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.KEY_Right || symbol === Clutter.KEY_KP_Right) && noModifiers:
            leaveCurrentlyFocusedItem();
            rightNavigation();
            return Clutter.EVENT_PROPAGATE; // so that left/right can also be used to
                                            // navigate search entry
        case (symbol === Clutter.KEY_Left || symbol === Clutter.KEY_KP_Left) && noModifiers:
            leaveCurrentlyFocusedItem();
            leftNavigation();
            return Clutter.EVENT_PROPAGATE; // so that left/right can also be used to
                                            // navigate search entry
        case (symbol === Clutter.Tab || symbol === Clutter.KEY_Tab) && noModifiers:
            leaveCurrentlyFocusedItem();
            if (St.Widget.get_default_direction() === St.TextDirection.RTL) {
                //If direction is RTL then tabLeft() and tabRight() have already been swapped to
                //account for layout change and so that arrow keys work correctly. But tab key is
                //expected move to the left in RTL languages so swap again here.
                tabLeft();
            } else {
                tabRight();
            }
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.KEY_ISO_Left_Tab || symbol === Clutter.ISO_Left_Tab ||
                            (symbol === Clutter.Tab || symbol === Clutter.KEY_Tab) && shiftKey):
            leaveCurrentlyFocusedItem();
            if (St.Widget.get_default_direction() === St.TextDirection.RTL) {
                tabRight();
            } else {
                tabLeft()
            }
            return Clutter.EVENT_STOP;
        case symbol === Clutter.Tab && altKey:
            this.menu.close();//Close menu as alt-tab is used for app-switcher in cinnamon
            return Clutter.EVENT_STOP;
        case (symbol === Clutter.Escape || symbol === Clutter.KEY_Escape) && noModifiers:
            if (this.display.contextMenu.isOpen) {
                this.display.contextMenu.close();
            } else {
                this.menu.close();
            }
            return Clutter.EVENT_STOP;
        case symbol === Clutter.KEY_Page_Up && noModifiers:
            leaveCurrentlyFocusedItem();
            if (focusedAppItemExists) {
                appButtons[0].handleEnter();
            } else if (focusedSidebarItemExists) {
                sidebarButtons[0].handleEnter();
            } else {
                categoryButtons[0].handleEnter();
            }
            return Clutter.EVENT_STOP;
        case symbol === Clutter.KEY_Page_Down && noModifiers:
            leaveCurrentlyFocusedItem();
            if (focusedAppItemExists) {
                appButtons[appButtons.length - 1].handleEnter();
            } else if (focusedSidebarItemExists) {
                sidebarButtons[sidebarButtons.length - 1].handleEnter();
            } else {
                categoryButtons[categoryButtons.length - 1].handleEnter();
            }
            return Clutter.EVENT_STOP;
        default:
            return Clutter.EVENT_PROPAGATE;
        }
    }

    getNumberOfItemsToFitColumns(minimumItems) {
        //adjust number of items according to number of columns to make
        //best use of available space.
        const columns = this.display.appsView.getGridValues().columns;
        return Math.ceil(minimumItems / columns) * columns;
    }
    
    setActiveCategory(categoryId) {
        // categoryId is one of 3 things: a special category (one of 'places', 'recents',
        // 'favorite_files' or 'favorite_apps'), an application category id, 
        // or an absolute path used in folderview (must begin with a /)
        this.currentCategory = categoryId;
        this.display.categoriesView.setSelectedCategoryStyle(categoryId);
        this.display.categoriesView.setCategoryFocus(categoryId);
        this.display.appsView.buttonStoreCleanup();

        switch (categoryId) {
        case 'places':
            this.display.appsView.populate(this.listPlaces());
            break;
        case 'recents':
            const maxItems = this.getNumberOfItemsToFitColumns(6);
            const maxRecentApps = this.getNumberOfItemsToFitColumns(4);
            
            this.display.appsView.populate_init();
            const recentApps = this.listRecent_apps(maxRecentApps);
            if (recentApps.length > 0) {
                this.display.appsView.populate_add(recentApps,_('Applications'));
            }
            const recentDocs = this.listRecentByType('documents', maxItems);
            if (recentDocs.length > 0) {
                this.display.appsView.populate_add(recentDocs,_('Documents'));
            }
            const recentVids = this.listRecentByType('video', maxItems);
            if (recentVids.length > 0) {
                this.display.appsView.populate_add(recentVids,_('Videos'));
            }
            const recentPics = this.listRecentByType('image', maxItems);
            if (recentPics.length > 0) {
                this.display.appsView.populate_add(recentPics,_('Images'));
            }
            const recentAudio = this.listRecentByType('audio', maxItems);
            if (recentAudio.length > 0) {
                this.display.appsView.populate_add(recentAudio,_('Music'));
            }
            const totalItems = recentApps.length + recentDocs.length + recentVids.length +
                                                        recentPics.length + recentAudio.length;
            if (totalItems > 0) {
                this.display.appsView.populate_add(this.getClearRecentsButton());
            }
            this.display.appsView.populate_finish();
            if (totalItems == 0) {
                this.display.appsView.populate([], _('No recent Items'));
            }
            break;
        case 'favorite_files':
            this.display.appsView.populate(this.listFavoriteFiles());
            break;
        case 'favorite_apps':
            this.display.appsView.populate(this.listFavoriteApps());
            break;
        default:
            if (categoryId.startsWith('/')) {//folder view
                const folderContents = this.listFolder(categoryId);
                const headerText = folderContents.errorMsg? folderContents.errorMsg : categoryId;
                this.display.appsView.populate(folderContents.results, headerText);
            } else if (categoryId === 'all') {
                this.display.appsView.populate_init();
                this.display.appsView.populate_add(this.apps.listApplications('allApps'));
                this.display.appsView.populate_add(
                                this.apps.listApplications('allSettings'), _("Settings"));
                this.display.appsView.populate_finish();
            } else {//other applications categories
                this.display.appsView.populate(this.apps.listApplications(categoryId));
            }
        }
    }
//==============search==============
    _onSearchTextChanged() {
        const searchText = this.display.searchView.searchEntryText.get_text();

        if (searchText.length === 0) {//search text deleted, cancel search mode
            if (!this.searchActive) {//search mode already ended
                return;
            }
            this._endSearchMode();
            this.setActiveCategory(this.currentCategory);

            //By default, current active category button will have focus. If categories are
            //hidden, give focus to first app item.
            if (!this.settings.showCategories) {
                this.display.appsView.focusFirstItem();
            }
            return;
        }
        
        //---start search---

        //Set a new search ID so that async search functions
        //from a previous search can be aborted.
        this.currentSearchId = Math.floor(Math.random() * 100000000);

        this.display.clearFocusedActors();
        if (!this.searchActive) {//set search mode
            this.searchActive = true;
            this.display.searchView.showAndConnectSecondaryIcon();//show edit-delete icon
            this.display.categoriesView.buttons.forEach(button => button.disable());
        }

        // When doSearch() below is called by Meta.later_add, this.currentSearchId may have changed
        // so store its current value in a const as the current lexical scope is preserved.
        const currentSearchId = this.currentSearchId;
        Meta.later_add(Meta.LaterType.IDLE, () => this._doSearch(searchText, currentSearchId));
    }

    _endSearchMode() {
        this.searchActive = false;
        this.display.searchView.hideAndDisconnectSecondaryIcon();//hide edit-delete icon
        this.display.categoriesView.buttons.forEach(button => button.enable());
        this.display.searchView.searchEntry.set_text('');
        this.previousSearchPattern = '';
    }

    _doSearch(pattern_raw, thisSearchId) {
        //this function has been called asynchronously meaning that a keypress may have changed the
        //search query before this function is called. Check that this search is still valid.
        if (!this.searchActive || thisSearchId !== this.currentSearchId) {
            return;
        }

        const pattern = graphemeBaseChars(pattern_raw).toLocaleUpperCase().trim();
        
        //Don't repeat the same search. This can happen if a key and backspace are pressed in quick
        //succession while a previous search is being carried out.
        if (pattern_raw === this.previousSearchPattern) {
            return;
        }
        this.previousSearchPattern = pattern_raw;

        let EMOJI_PREFIX = false;
        let FILE_PREFIX = false;
        if (pattern.length > 2) {
            if (pattern.startsWith('E ')) {
                EMOJI_PREFIX = true;
            }
            if (pattern.startsWith('F ')) {
                FILE_PREFIX = true;
            }
        }
        const PREFIX_USED = EMOJI_PREFIX || FILE_PREFIX;

        //======Begin search===========
        let applicationResults = [];
        let fileResults = [];
        let otherResults = [];
        if (!PREFIX_USED) {
            applicationResults = this.apps.searchApplications(pattern);
            fileResults = this.searchFavoriteFiles(pattern)
                        .concat(this.recentsEnabled ? this.searchRecent(pattern) : []);
            otherResults = this.settings.showPlaces ? this.searchPlaces(pattern) : [];
        }
        const emojiResults = [];

        //-----
        
        const showResults = () => {//sort and display all search results
            if (!this.searchActive || thisSearchId != this.currentSearchId){
                return; //Search mode has ended or search string has changed
            }

            // sort applicationResults[]
            applicationResults.sort((a, b) =>  b.score - a.score);
            
            // sort fileResults[]
            fileResults.sort((a, b) =>  b.score - a.score); // items with equal score are left in
                                                            // existing order

            if (fileResults.length > 25) { // remove poor results to save time.
                fileResults.length = 25;
            }
            // Remove duplicate fileResults[]. eg. a fav file, a recent file and a folderfile might all
            // be the same file. Prefer from highest to lowest: isFavoriteFile, isRecentFile,
            // isFolderviewFile which is easy because fileResults[] should already be in this order.
            for (let i = 0; i < fileResults.length -1; i++) {
                const app = fileResults[i];
                if (app.isFavoriteFile || app.isRecentFile) {
                    for (let r = i + 1; r < fileResults.length; r++) {
                        const compareApp = fileResults[r];
                        if ((compareApp.isRecentFile || compareApp.isFolderviewFile)
                                                        && compareApp.uri === app.uri) {
                            fileResults.splice(r, 1);
                            r--;
                        }
                    }
                }
            }

            // Limit applicationResults to 6
            applicationResults.length = Math.min(applicationResults.length, this.getNumberOfItemsToFitColumns(6));
            // Limit fileResults to 10
            fileResults.length = Math.min(fileResults.length, this.getNumberOfItemsToFitColumns(10));
            
            // Display results
            this.display.appsView.populate_init(calculatorResult);
            if (applicationResults.length > 0) {
                this.display.appsView.populate_add(applicationResults, _('Applications'));
            }
            if (fileResults.length > 0) {
                this.display.appsView.populate_add(fileResults, _('Files'));
            }
            if (otherResults.length > 0) {
                this.display.appsView.populate_add(otherResults, _('Other search results'));
            }
            if (emojiResults.length > 0) {
                this.display.appsView.populate_add(emojiResults, _('Emoji'));
            }
            this.display.appsView.populate_finish();

            //In case mouse is hovering a different item (thus selecting it) ensure first result
            //is highlighted after drawing so that pressing return selects top result.
            Meta.later_add(Meta.LaterType.IDLE, () => this.display.appsView.focusFirstItem());
        };

        //=======search providers==========
        //---calculator---
        let calculatorResult = null;
        let ans = null;
        const exp = pattern_raw.replace(/([a-zA-Z][a-zA-Z0-9_]*)/g, (match) => `Math.${match}`);
        
        try {
            ans = eval?.(`"use strict"; ${exp}`);
        } catch(e) {
            const probablyMath = /[\(\)\+=/\*]/.test(exp);
            if (probablyMath) {
                calculatorResult = _("Calculator: ") + e.message;
            }
        }

        if ((typeof ans === 'number' || typeof ans === 'boolean' || typeof ans === 'bigint')
                                                                    && ans != pattern_raw ) {
            
            let ans_str = ans.toString();
            //remove rounding error
            if (typeof ans === 'number') {
                if (ans > Number.MAX_SAFE_INTEGER || ans < Number.MIN_SAFE_INTEGER) {
                    // JS will show up to 21 digits of an integer (inaccurately) even though
                    // only 16 are significant, so show in exponential form instead.
                    ans_str = Number(ans.toPrecision(16)).toExponential();
                } else {
                    ans_str = Number(ans.toPrecision(16)).toString();
                }
            }
            
            otherResults.push({
                isSearchResult: true,
                name: ans_str,
                description: _('Click to copy'),
                deleteAfterUse: true,
                icon: new St.Icon({
                    icon_name: 'accessories-calculator',
                    icon_type: St.IconType.FULLCOLOR,
                    icon_size: this.getAppIconSize()
                }),
                activate: () => {
                    const clipboard = St.Clipboard.get_default();
                    clipboard.set_text(St.ClipboardType.CLIPBOARD, ans_str);
                }
            });
            calculatorResult = pattern_raw + " = " + ans_str;
        }

        //---emoji search------
        if (pattern.length > 2 && this.settings.enableEmojiSearch && !PREFIX_USED ||
                                                    EMOJI_PREFIX && pattern.length >= 4) {
            let epattern = pattern;
            if (EMOJI_PREFIX) {
                epattern = pattern.substring(2);
            }

            EMOJI.forEach(emoji => {
                const nameScore = searchStr(epattern, emoji[EMOJI_NAME], true);
                let keywordScore = searchStr(epattern, emoji[EMOJI_KEYWORDS], true);
                keywordScore *= 0.95; //slightly lower priority for keyword match
                const bestScore = Math.max(nameScore, keywordScore);
                if (bestScore > SEARCH_THRESHOLD) {
                    emojiResults.push({
                        name: emoji[EMOJI_NAME],
                        score: bestScore,
                        description: _('Click to copy'),
                        isSearchResult: true,
                        deleteAfterUse: true,
                        emoji: emoji[EMOJI_CODE],
                        activate: () => {
                            const clipboard = St.Clipboard.get_default();
                            clipboard.set_text(St.ClipboardType.CLIPBOARD, emoji[EMOJI_CODE]);
                        }
                    });
                }
            });

            emojiResults.sort((a, b) =>  a.score < b.score);
            if (emojiResults.length > 36) {
                emojiResults.length = 36;
            }
        }

        //----home folder search--------
        Meta.later_add(Meta.LaterType.IDLE, () => {
            if (!(pattern.length > 1 && this.settings.searchHomeFolder && !PREFIX_USED ||
                                                FILE_PREFIX && pattern.length >= 3)) {
                return;
            }
            if (!this.searchActive || thisSearchId !== this.currentSearchId) {
                return;
            }

            let fpattern = pattern;
            if (FILE_PREFIX) {
                fpattern = pattern.substring(2);
            }
            // Call function searchNextDir() consecutively and asynchronously on each folder to be searched so
            // that search can be interupted at any time. Starting with home folder, all folders to be
            // searched are added to foldersToDo[]. Searching is cancelled when the search string has
            // changed (thisSearchId !== this.currentSearchId).

            let updateInterval = 100;//update the results after the first 100ms even if search hasn't finished
            const MAX_FOLDERS_TO_SEARCH = 50000;
            const FOLLOW_SYMLINKS = false;
            const FILE_SEARCH_DEBUG = false;
            const results = [];
            const foldersToDo = [];
            foldersToDo.push(GLib.get_home_dir());// start search in home directory
            let foldersSearched = 0;
            let lastUpdateTime = Date.now();
            const total_timer=Date.now();

            const searchNextDir = (thisSearchId) => {
                const folder = foldersToDo.pop();
                
                const dir = Gio.file_new_for_path(folder);
                let enumerator;
                let timer=Date.now();
                if (FILE_SEARCH_DEBUG) {
                    log("searching: " + folder);
                }

                dir.enumerate_children_async('standard::name,standard::type,standard::is-symlink',
                            Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, null, (source, result) => {
                    try {
                        enumerator = source.enumerate_children_finish(result);
                    } catch(e) {
                        global.logWarning('gridmenu file search:' + e.message);
                    }
                    if (!this.searchActive || thisSearchId !== this.currentSearchId) {
                        if (enumerator) {
                            enumerator.close(null);
                        }
                        return;
                    }

                    //find matching files and folders in directory
                    if (enumerator) {
                        enumerator.next_files_async(1000, GLib.PRIORITY_DEFAULT, null, (source, result) => {
                            let fileInfos;
                            try {
                                fileInfos = source.next_files_finish(result);
                            } catch(e) {
                                global.logWarning('Cinnamenu file search:' + e.message);
                            }
                            if (!this.searchActive || thisSearchId !== this.currentSearchId) return;
                            if (fileInfos) {
                                fileInfos.forEach((fileInfo) => {
                                    const filename = fileInfo.get_name();
                                    if (filename.startsWith(".")) {
                                        return; // skip hidden files
                                    }
                                    const isDirectory = fileInfo.get_file_type() === Gio.FileType.DIRECTORY;
                                    const filePath = folder + (folder === '/' ? '' : '/') + filename;
                                    let matchScore = searchStr(fpattern, filename, true, true);
                                    if (matchScore > 1) { //any word boundary match
                                        const file = Gio.file_new_for_path(filePath);
                                        const extraFileInfo = file.query_info('standard::icon,standard::content-type',
                                                                            Gio.FileQueryInfoFlags.NONE, null);
                                        matchScore -= 0.01;
                                        //if file then treat as isFolderviewFile and if directory then treat as isPlace
                                        const foundFile = {
                                            name: filename,
                                            score: matchScore * (fpattern.length > 2 ? 1 : 0.9),
                                            gicon: extraFileInfo.get_icon(),
                                            uri: file.get_uri(),
                                            mimeType: extraFileInfo.get_content_type(),
                                            description: filePath,
                                            isPlace: isDirectory,
                                            isDirectory: isDirectory,
                                            isFolderviewFile: !isDirectory,
                                            deleteAfterUse: true
                                        };
                                        if (isDirectory) {
                                            const defaultInfo =
                                                        Gio.AppInfo.get_default_for_type('inode/directory', false);
                                            if (defaultInfo) {
                                                foundFile.activate = () => { defaultInfo.launch([file], null); };
                                            }
                                        }
                                        results.push(foundFile);
                                    }

                                    //Add subdirectories to foldersToDo[]
                                    if (isDirectory && (!fileInfo.get_is_symlink() || FOLLOW_SYMLINKS) &&
                                                                foldersSearched < MAX_FOLDERS_TO_SEARCH) {
                                        foldersToDo.push(filePath);
                                    }
                                });//end forEach
                            }//end if

                            if (FILE_SEARCH_DEBUG) {
                                log("todo: " + foldersToDo.length + " done: " + foldersSearched + " time: " + (Date.now() - timer) + " : total " + (Date.now() - total_timer));
                            }
                            //update display of results at intervals or when search completed
                            if (foldersToDo.length === 0 || Date.now() - lastUpdateTime > updateInterval) {
                                if (results.length > 0 && this.searchActive &&
                                                                        thisSearchId === this.currentSearchId) {
                                    fileResults = fileResults.concat(results);
                                    showResults();
                                    results.length = 0;
                                }
                                lastUpdateTime = Date.now();
                                updateInterval *= 2;//progressively longer update intervals
                            }
        
                            //continue search if not completed
                            if (foldersToDo.length > 0) {
                                foldersSearched++;
                                Meta.later_add(Meta.LaterType.IDLE, () => { searchNextDir(thisSearchId); });
                            }
                            if (enumerator) {
                                enumerator.close(null);
                            }
                        }); //end of next_files_async
                    }//end if
                });//end of enumerate_children_async
            };// end searchNextDir()

            searchNextDir(this.currentSearchId);
        });

        ///----search providers--------
        Meta.later_add(Meta.LaterType.IDLE, () => {
            if (!this.searchActive || thisSearchId !== this.currentSearchId) {
                return;
            }
            launch_all(pattern, (provider, providerResults) => {
                providerResults.forEach(providerResult => {
                    if (!providerResult) {
                        return;
                    }
                    providerResult.isSearchResult = true;
                    providerResult.name = providerResult.label.replace(/ : /g, ': ');
                    providerResult.activate = provider.on_result_selected;
                    providerResult.deleteAfterUse = true;
                    //providerResult.score = 0.2;
                    if (providerResult.icon) {
                        providerResult.icon.icon_size = this.getAppIconSize();
                    } else if (providerResult.icon_app) {
                        providerResult.icon = providerResult.icon_app.create_icon_texture(
                                                            this.getAppIconSize());
                    } else if (providerResult.icon_filename) {
                        providerResult.icon = new St.Icon({
                            gicon: new Gio.FileIcon({
                                    file: Gio.file_new_for_path(providerResult.icon_filename)}),
                            icon_size: this.getAppIconSize()
                        });
                    }
                });
                if (!this.searchActive || thisSearchId !== this.currentSearchId ||
                                            !providerResults || providerResults.length === 0) {
                    return;
                }
                otherResults = otherResults.concat(providerResults);
                showResults();
            });
        });

        showResults();
        return;
    }

/* Below are all functions creating arrays of app objects excluding _doSearch() and
 * listApplications() which is in Apps class. Arrays of app objs are then passed
 * to AppsView.populate() which creates AppButtons with .app as a property.
 * 
 * app obj properties used:
 *  .name
 *  .description
 *  .id
 *  .uri
 *  .mimeType
 *  .icon
 *  .gicon
 *  .iconFactory()
 *  .score
 *  .desktop_file_path
 *  .isApplication
 *  .isPlace
 *  .isRecentFile
 *  .isClearRecentsButton
 *  .isFavoriteFile             //Nemo favorites
 *  .isFolderviewFile
 *  .isDirectory
 *  .isBackButton
 *  .isSearchResult
 *  .deleteAfterUse
 *  .emoji
 *  .activate()
 */

    listFavoriteApps() {
        const res = this.appFavorites.getFavorites();
        res.forEach(favApp => {
            favApp.name = favApp.get_name();
            favApp.description = favApp.get_description();
            favApp.isApplication = true;
        });
        return res;
    }

    searchRecent(pattern) {
        const res = [];

        this.listRecentByType('all', 100).forEach(recentItem => {
            const score = searchStr(pattern, recentItem.name);
            if (recentItem.name && score > SEARCH_THRESHOLD) {
                recentItem.score = score;
                res.push(recentItem);
            }
        });

        return res;
    }

    listRecent_apps(maxRecentItems) {
        const res = [];

        this.recentApps.getApps(maxRecentItems).forEach(recentId => {
            const app = this.apps.listApplications('all').find(app => app.id === recentId);
            if (app) {//Check because app may have been uninstalled
                res.push(app);
            }
        });

        return res;
    }

    listRecentByType(type, maxItems) {
        //param "type" is one of all|documents|video|image|audio.
        const res = [];
        this.recentManagerDefault.get_items().forEach(recentInfo => {
            if (type === 'documents' && (   recentInfo.get_mime_type().startsWith('video') ||
                                            recentInfo.get_mime_type().startsWith('image') ||
                                            recentInfo.get_mime_type().startsWith('audio') )) {
                return;
            }
            if ((type === 'video' || type === 'image' || type === 'audio') &&
                                                    !recentInfo.get_mime_type().startsWith(type)) {
                return;
            }

            const new_recent = {
                name: recentInfo.get_display_name(),
                gicon: recentInfo.get_gicon(),
                uri: recentInfo.get_uri(),
                mimeType: recentInfo.get_mime_type(),
                description: recentInfo.get_uri_display(),
                modifiedTime: recentInfo.get_modified(),//only used for sorting below
                isRecentFile: true,
                deleteAfterUse: true
            };
            res.push(new_recent);
        });
        res.sort((a, b) =>  a.modifiedTime < b.modifiedTime);
        if (res.length > maxItems) {
            res.length = maxItems;
        }
        return res;
    }

    getClearRecentsButton() {
        const res = [];

        const clearRecentsButton =
                this.display.appsView.buttonStore.find(button => button.app.isClearRecentsButton);
        if (clearRecentsButton) {
            res.push(clearRecentsButton.app);
        } else {
            res.push({
                name: _('Clear List'),
                description: '',
                icon: new St.Icon({
                    icon_name: 'edit-clear',
                    icon_type: St.IconType.SYMBOLIC,
                    icon_size: this.getAppIconSize()
                }),
                isClearRecentsButton: true
            });
        }

        return res;
    }

    listPlaces() {
        const res = [];
        Main.placesManager.getAllPlaces().forEach(place => {
            let selectedAppId = place.idDecoded.substr(place.idDecoded.indexOf(':') + 1);
            const fileIndex = selectedAppId.indexOf('file:///');
            if (fileIndex !== -1) {
                selectedAppId = selectedAppId.substr(fileIndex + 7);
            }
            if (selectedAppId === 'home' || selectedAppId === 'desktop' || selectedAppId === 'connect') {
                selectedAppId = place.name;
            }
            place.isPlace = true;
            place.description = selectedAppId;
            place.activate = () => place.launch();//don't pass any params to launch()
            if (place.id.startsWith('bookmark:')) {
                place.uri = place.id.substr(9);
                place.mimeType = 'inode/directory';
                place.isDirectory = true;
            }
            res.push(place);
        });
        res.splice(2, 0, {
            id: 'special:trash',
            name: _('Trash'),
            description: _('Trash'),
            isPlace: true,
            activate: () => Util.spawnCommandLine('xdg-open trash:'),
            iconFactory: (size) => new St.Icon({
                icon_name: 'user-trash',
                icon_type: St.IconType.FULLCOLOR,
                icon_size: size
            })
        });
        res.splice(2, 0, {
            id: 'special:computer',
            name: _('Computer'),
            description: _('Computer'),
            isPlace: true,
            activate: () => Util.spawnCommandLine('xdg-open computer:'),
            iconFactory: (size) => new St.Icon({
                icon_name: 'computer',
                icon_type: St.IconType.FULLCOLOR,
                icon_size: size
            })
        });

        return res;
    }

    searchPlaces(pattern){
        const places = this.listPlaces();
        const res = [];
        places.forEach(place => {
            const score = searchStr(pattern, place.name);
            if (score > SEARCH_THRESHOLD) {
                place.score = score;
                res.push(place);
            }
        });

        return res;
    }

    listFavoriteFiles() {
        const res = [];
        const favorite_infos = XApp.Favorites.get_default().get_favorites(null);
        favorite_infos.forEach(info => {
            const found = this.display.appsView.buttonStore.find(button =>
                                        button.app.isFavoriteFile && button.app.uri === info.uri);
            if (found) {
                res.push(found.app);
            } else {
                res.push({
                    name: info.display_name,
                    description: Gio.File.new_for_uri(info.uri).get_path(),
                    gicon: Gio.content_type_get_icon(info.cached_mimetype),
                    isFavoriteFile: true,
                    mimeType: info.cached_mimetype,
                    uri: info.uri
                });
            }
        });

        res.sort( (a, b) => a.name.localeCompare(b.name,
                                                 undefined,
                                                 {sensitivity: "base", ignorePunctuation: true}));
        return res;
    }

    searchFavoriteFiles(pattern) {
        const favs = this.listFavoriteFiles();
        const res = [];

        favs.forEach(item => {
            const score = searchStr(pattern, item.name);
            if (item.name && score > SEARCH_THRESHOLD) {
                item.score = score;
                res.push(item);
            }
        });

        return res;
    }

    listFolder(folder) {
        const res = [];
        const dir = Gio.file_new_for_path(folder);
        let enumerator;
        let errorMsg = null;
        try {
            enumerator = dir.enumerate_children(
                'standard::name,standard::type,standard::icon,standard::content-type,standard::is-hidden',
                                                                            0, null);
        } catch(e) {//folder access permission denied probably
            errorMsg = e.message;
        }
        let next;
        if (enumerator) {
            next = enumerator.next_file(null);
        }
        while (next) {
            const filename = next.get_name();
            if (this.settings.showHiddenFiles || !next.get_is_hidden()) {
                let file = Gio.file_new_for_path(folder + (folder === '/' ? '' : '/') + filename);
                const isDirectory = next.get_file_type() === Gio.FileType.DIRECTORY;
                res.push({
                    name: next.get_name(),
                    gicon: next.get_icon(),
                    uri: file.get_uri(),
                    mimeType: next.get_content_type(),
                    isDirectory: isDirectory,
                    description: '',
                    isFolderviewFile: !isDirectory,
                    deleteAfterUse: true
                });
                file = null;
            }
            next = enumerator.next_file(null);
        }
        if (enumerator) {
            enumerator.close(null);
        }

        res.sort((a, b) => {    
            if (!a.isDirectory && b.isDirectory) return 1;
            else if (a.isDirectory && !b.isDirectory) return -1;
            else if (a.isDirectory && b.isDirectory &&
                        a.name.startsWith('.') && !b.name.startsWith('.')) return 1;
            else if (a.isDirectory && b.isDirectory &&
                        !a.name.startsWith('.') && b.name.startsWith('.')) return -1;
            else {
                const nameA = a.name.toUpperCase();
                const nameB = b.name.toUpperCase();
                return (nameA > nameB) ? 1 : ( (nameA < nameB) ? -1 : 0 );
            }
        });
        const parent = dir.get_parent();
        if (parent) {// Add back button
            res.unshift({
                name: 'Back',
                uri: parent.get_uri(),
                icon: new St.Icon({
                    icon_name: 'edit-undo-symbolic',
                    icon_type: St.IconType.SYMBOLIC,
                    icon_size: this.getAppIconSize()
                }),
                mimeType: 'inode/directory',
                isBackButton: true,
                description: '',
                deleteAfterUse: true
            });
        }

        return {results: res, errorMsg: errorMsg};
    }
}

class Apps {//This obj provides the .app objects for all the applications categories
    constructor(appSystem) {
        this._appsByCategory = {};
        this._dirs = [];
        this._knownApps = [];
        this._appsNeedRefresh = false;
        this._newInstance = true;
        this.appSystem = appSystem;
        this._initAppCategories();
    }

    installedChanged() {
        this._appsNeedRefresh = true;
    }

    _initAppCategories() {
        const apps_sort = arr => arr.sort((a, b) => a.name.localeCompare(b.name, undefined,
                                                {sensitivity: "base", ignorePunctuation: true}));
        this._dirs = [];
        this._appsByCategory = {};
        const iter = this.appSystem.get_tree().get_root_directory().iter();
        let nextType;
        while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
            if (nextType === CMenu.TreeItemType.DIRECTORY) {
                const dir = iter.get_directory();
                if (dir.get_is_nodisplay()) {
                    continue;
                }
                const dirId = dir.get_menu_id();
                const foundApps = this._loadDirectory(dir);
                if (foundApps.length > 0) {
                    apps_sort(foundApps);
                    this._appsByCategory[dirId] = foundApps;
                    dir.dirId = dirId;
                    this._dirs.push(dir);
                }
            }
        }

        this._dirs.sort((a, b) => {
            const prefCats = ['ADMINISTRATION', 'PREFERENCES'];
            const prefIdA = prefCats.indexOf(a.dirId.toUpperCase());
            const prefIdB = prefCats.indexOf(b.dirId.toUpperCase());
            if (prefIdA < 0 && prefIdB >= 0) return -1;
            if (prefIdA >= 0 && prefIdB < 0) return 1;
            return a.get_name().localeCompare(b.get_name(), undefined,
                                              {sensitivity: "base", ignorePunctuation: true});
        });

        //create "All applications" categories
        let all = [];
        let allApps = [];
        let allSettings = [];
        Object.keys(this._appsByCategory).forEach(key => {
            all = all.concat(this._appsByCategory[key]);
            if (['Preferences','Administration'].includes(key)) {
                allSettings = allSettings.concat(this._appsByCategory[key]);
            } else {
                allApps = allApps.concat(this._appsByCategory[key]);
            }
        });
        this._appsByCategory.all = Array.from(new Set(all));//remove duplicates
        apps_sort(this._appsByCategory.all);
        this._appsByCategory.allApps = Array.from(new Set(allApps));//remove duplicates
        apps_sort(this._appsByCategory.allApps);
        this._appsByCategory.allSettings = Array.from(new Set(allSettings));//remove duplicates
        apps_sort(this._appsByCategory.allSettings);
        //remove apps from allSettings if they're also in allApps
        this._appsByCategory.allApps.forEach( app => {
            const i = this._appsByCategory.allSettings.findIndex( a => a === app );
            if (i > -1) {
                this._appsByCategory.allSettings.splice(i, 1);
            }
        })
        
        this._appsNeedRefresh = false;
        this._newInstance = false;
    }

    _loadDirectory(dir) {
        let foundApps = [];
        const iter = dir.iter();
        let nextType;
        while ((nextType = iter.next()) !== CMenu.TreeItemType.INVALID) {
            if (nextType === CMenu.TreeItemType.ENTRY) {
                const entry = iter.get_entry();
                const id = entry.get_desktop_file_id();
                const app = this.appSystem.lookup_app(id);
                if  (!app || app.get_nodisplay()) {
                    continue;
                }

                foundApps.push(app);
                app.name = app.get_name();
                app.description = app.get_description();
                app.isApplication = true;
                app.id = id;
                app.desktop_file_path = entry.get_desktop_file_path();

                if (this._knownApps.indexOf(id) < 0) {//unknown app
                    if (!this._newInstance) {
                        app.newAppShouldHighlight = true;
                    }
                    this._knownApps.push(id);
                }
            } else if (nextType === CMenu.TreeItemType.DIRECTORY) {
                const subDir = iter.get_directory();
                if (!subDir.get_is_nodisplay()) {
                    foundApps = foundApps.concat(this._loadDirectory(subDir));
                }
            }
        }
        return foundApps;
    }

    getDirs() {
        if (this._appsNeedRefresh) {
            this._initAppCategories();
        }

        return this._dirs;
    }

    dirHasNewApp(dirId) {
        const apps = this.listApplications(dirId);
        const newAppIndex = apps.findIndex(app => !!app.newAppShouldHighlight);
        return (newAppIndex >= 0);
    }

    listApplications(categoryMenuId) {
        if (this._appsNeedRefresh) {
            this._initAppCategories();
        }

        return this._appsByCategory[categoryMenuId];
    }

    searchApplications(pattern) {
        if (!pattern) {
            return [];
        }

        const res = [];
        this.listApplications('all').forEach(app => {
            const keywords = app.get_keywords() || '';
            //get and clean up the app ids.
            let id = app.id.replace('.desktop', '');
            const idLastDot = id.lastIndexOf('.');
            if (idLastDot >= 0) {
                id = id.substring(idLastDot + 1);
            }
            id = id.replace('cinnamon-settings-', '');

            const nameScore = searchStr(pattern, app.name);
            let desScore = searchStr(pattern, app.description);
            desScore *= 0.95; //slightly lower priority for description match
            let keywordScore = searchStr(pattern, keywords);
            keywordScore *= 0.8; //lower priority for keyword match
            const idScore = searchStr(pattern, id);
            const bestMatchScore = Math.max(nameScore, desScore, keywordScore, idScore);
            if (bestMatchScore > SEARCH_THRESHOLD) {
                app.score = bestMatchScore;
                res.push(app);
            }
        });

        return res;
    }
}

class RecentApps {// Simple class to remember the last 20 used apps which are shown in the
                  // "recent" category
    constructor(appThis) {
        this.appThis = appThis;
    }

    add(appId) {
        const recentApps = this.appThis.settings.recentApps.slice();
        const duplicate = recentApps.indexOf(appId);
        if (duplicate > -1) {
            recentApps.splice(duplicate, 1);
        }
        recentApps.unshift(appId);
        if (recentApps.length > 20) {
            recentApps.length = 20;
        }
        this.appThis.settings.recentApps = recentApps;
    }

    clear() {
        this.appThis.settings.recentApps = [];
    }

    getApps(max_count) {
        return this.appThis.settings.recentApps.slice(0, max_count);
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamenuApplet(metadata, orientation, panel_height, instance_id);
}
