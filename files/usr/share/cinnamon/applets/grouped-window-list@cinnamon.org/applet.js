const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Gdk = imports.gi.Gdk;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Gettext = imports.gettext;
const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const DND = imports.ui.dnd;
const {AppletSettings} = imports.ui.settings;
const {SignalManager} = imports.misc.signalManager;
const {each, find, findIndex, filter, throttle, unref, trySpawnCommandLine} = imports.misc.util;
const {createStore} = imports.misc.state;

const AppList = require('./appList');
const {
  RESERVE_KEYS,
  TitleDisplay,
  autoStartStrDir
}  = require('./constants');

class PinnedFavs {
    constructor(params) {
        this.params = params;
        this.favoriteSettingKey = 'favorite-apps';
        this.reload();
    }

    reload() {
        const {state, signals, settings} = this.params;
        const appSystem = state.trigger('getAppSystem');
        if (signals.isConnected('changed::favorite-apps', global.settings)) {
            signals.disconnect('changed::favorite-apps', global.settings);
        }
        if (signals.isConnected('changed::pinned-apps', settings)) {
            signals.disconnect('changed::pinned-apps', settings);
        }
        let cb = () => this.onFavoritesChange();
        if (state.settings.systemFavorites) {
            signals.connect(global.settings, 'changed::favorite-apps',  cb);
        } else {
            signals.connect(settings, 'changed::pinned-apps', cb);
        }
        this._favorites = [];
        let ids = [];
        if (state.settings.systemFavorites) {
            ids = global.settings.get_strv(this.favoriteSettingKey);
        } else {
            ids = settings.getValue('pinned-apps');
        }
        for (let i = 0, len = ids.length; i < len; i++) {
            let refFav = findIndex(this._favorites, (item) => item.id === ids[i]);
            if (refFav === -1) {
                let app = appSystem.lookup_app(ids[i]);
                this._favorites.push({
                    id: ids[i],
                    app: app
                });
            }
        }
    }

    triggerUpdate(appId, isFavoriteApp) {
        let currentAppList = this.params.state.trigger('getCurrentAppList');
        if (!currentAppList) return;

        let refApp = findIndex(currentAppList.appList, (appGroup) => appGroup.groupState.appId === appId);
        if (refApp === -1) return;

        // A pinned app with no windows open was unpinned - remove it
        if (!isFavoriteApp
            && currentAppList.appList[refApp]
            && currentAppList.appList[refApp].groupState.metaWindows.length === 0) {
            currentAppList.appList[refApp].destroy(true);
            currentAppList.appList[refApp] = undefined;
            currentAppList.appList.splice(refApp, 1);
        } else {
            // Otherwise, synchronize its pinned state
            currentAppList.appList[refApp].groupState.set({isFavoriteApp});
        }
    }

    saveFavorites() {
        let uniqueSet = new Set();
        let ids = [];
        for (let i = 0; i < this._favorites.length; i++) {
            if (uniqueSet.has(this._favorites[i].id) === false) {
                ids.push(this._favorites[i].id);
                uniqueSet.add(this._favorites[i].id);
            }
        }

        if (this.params.state.settings.systemFavorites) {
            global.settings.set_strv(this.favoriteSettingKey, ids);
        } else {
            this.params.settings.setValue('pinned-apps', ids);
        }
    }

    onFavoritesChange() {
        let currentAppList = this.params.state.trigger('getCurrentAppList');
        if (!this.params.state.settings.groupApps) {
            setTimeout(() => currentAppList.refreshList(), 0);
            return;
        }
        let oldFavoritesIds = [];
        let newFavoritesIds = [];
        for (let i = 0; i < this._favorites.length; i++) {
            oldFavoritesIds.push(this._favorites[i].id);
        }
        this.reload();
        for (let i = 0; i < this._favorites.length; i++) {
            newFavoritesIds.push(this._favorites[i].id);
        }
        for (let i = 0; i < oldFavoritesIds.length; i++) {
            if (newFavoritesIds.indexOf(oldFavoritesIds[i]) < 0) {
                this.triggerUpdate(oldFavoritesIds[i], false);
            }
        }
        for (let i = 0; i < this._favorites.length; i++) {
            this.triggerUpdate(newFavoritesIds[i], true);
        }
    }

    addFavorite(opts = {appId: null, app: null, pos: -1}) {
        const appSystem = this.params.state.trigger('getAppSystem');
        let oldIndex = -1;
        if (!opts.app) {
            opts.app = appSystem.lookup_app(opts.appId);
        }
        if (!opts.app) {
            opts.app = appSystem.lookup_settings_app(opts.appId);
        }
        if (!opts.app) {
            opts.app = appSystem.lookup_desktop_wmclass(opts.appId);
        }
        if (!opts.app) {
            return false;
        }
        if (!opts.pos) {
            opts.pos = -1;
        }
        let newFavorite = {
            id: opts.appId,
            app: opts.app
        };
        let refFavorite = findIndex(this._favorites, function(favorite) {
            return favorite.id === opts.appId;
        });

        if (refFavorite === -1) {
            // Iterates the app groups in the order they are added as children, this
            // ensures we always get the correct favorites order regardless of whether
            // or not pin on drag is enabled.
            let currentAppList = this.params.state.trigger('getCurrentAppList');
            let children = currentAppList.actor.get_children();
            let newFavorites = [];
            let refActorFound = false;
            each(children, (actor, i) => {
                let appGroup = find(currentAppList.appList, function(appGroup) {
                    return appGroup.actor === actor;
                });
                if (!appGroup) return;
                let {app, appId, isFavoriteApp} = appGroup.groupState;
                let isFavorite = isFavoriteApp;

                if (appId === opts.appId) {
                    refActorFound = true;
                    isFavorite = true;
                    oldIndex = i;
                }

                if (isFavorite) newFavorites.push({app, id: appId});
            });
            if (refActorFound) {
                this._favorites = newFavorites;
            } else {
                // Actor doesn't exist, probably being dragged to GWL from the menu
                this._favorites.push(newFavorite);
            }

        } else {
            oldIndex = refFavorite;
        }
        if (opts.pos > -1) {
            this.moveFavoriteToPos(opts, oldIndex);
            return true;
        }

        this.saveFavorites();
        return true;
    }

    moveFavoriteToPos(opts, oldIndex) {
        if (!oldIndex || !this.params.state.settings.groupApps) {
            oldIndex = findIndex(this._favorites, function(favorite) {
                return favorite.id === opts.appId;
            });
        }
        let newIndex = opts.pos;
        if (oldIndex > -1 && newIndex > oldIndex) {
            newIndex = newIndex - 1;
        }
        this._favorites.splice(newIndex, 0, this._favorites.splice(oldIndex, 1)[0]);
        this._favorites = filter(this._favorites, function(favorite) {
            return favorite && favorite.app != null;
        });
        this.saveFavorites();
    }

    removeFavorite(appId) {
        let refFav = findIndex(this._favorites, (favorite) => favorite.id === appId);
        this.triggerUpdate(appId, false);
        this._favorites.splice(refFav, 1);
        this.saveFavorites();
        return true;
    }
}

class GroupedWindowListApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.tracker = Cinnamon.WindowTracker.get_default();
        this.recentManager = Gtk.RecentManager.get_default();
        this.appLists = [];
        // Initialize the default state. Any values passed through store.set must be declared here
        // first, or an error will be thrown.
        this.state = createStore({
            uuid: metadata.uuid,
            orientation,
            isHorizontal: orientation === St.Side.TOP || orientation === St.Side.BOTTOM,
            panel_height,
            instance_id,
            monitorWatchList: [],
            autoStartApps: [],
            currentWs: global.screen.get_active_workspace_index(),
            panelEditMode: global.settings.get_boolean('panel-edit-mode'),
            menuOpen: false,
            dragPlaceholder: null,
            dragPlaceholderPos: -1,
            animatingPlaceholdersCount: 0,
            appletReady: false,
            willUnmount: false,
            settings: {},
            homeDir: GLib.get_home_dir(),
            overlayPreview: null,
            lastCycled: -1,
            lastTitleDisplay: null,
            scrollActive: false,
            thumbnailMenuOpen: false,
            thumbnailCloseButtonOffset: global.ui_scale > 1 ? -10 : 0
        });

        // key-function pairs of actions that can be triggered from the store's callback queue. This allows the
        // applet to avoid passing down the parent class down the constructor chain and creating circular references.
        // In addition to manual event emitting, store.js can emit updates on property changes when set through
        // store.set. Any keys emitted through store.trigger that are not declared here first will throw an error.
        this.state.connect({
            setSettingsValue: (k, v) => this.settings.setValue(k, v),
            getPanel: () => (this.panel ? this.panel : null),
            getPanelHeight: () => this._panelHeight,
            getPanelIconSize: () => this.getPanelIconSize(),
            getPanelMonitor: () => this.panel ? Main.layoutManager.monitors[this.panel.monitorIndex] : null,
            getAppSystem: () => Cinnamon.AppSystem.get_default(),
            getAppFromWMClass: (specialApps, metaWindow) => this.getAppFromWMClass(specialApps, metaWindow),
            getTracker: () => this.tracker,
            addWindowToAllWorkspaces: (win, app, isFavoriteApp) => {
                each(this.appLists, function(appList) {
                    appList.windowAdded(appList.metaWorkspace, win, app, isFavoriteApp);
                });
            },
            removeWindowFromAllWorkspaces: (win) => {
                each(this.appLists, function(appList) {
                    appList.windowRemoved(appList.metaWorkspace, win);
                });
            },
            removeWindowFromOtherWorkspaces: (win) => {
                each(this.appLists, (appList) => {
                    if (appList.listState.workspaceIndex === this.state.currentWs) {
                        return;
                    }
                    appList.windowRemoved(appList.metaWorkspace, win);
                });
            },
            refreshCurrentAppList: () => this.refreshCurrentAppList(),
            getCurrentAppList: () => this.getCurrentAppList(),
            clearDragPlaceholder: () => this.clearDragPlaceholder(),
            getAutoStartApps: () => this.getAutoStartApps(),
            getRecentItems: () =>
                Gtk.RecentManager.get_default()
                .get_items()
                .sort(function(a, b) {
                    return a.get_modified() - b.get_modified();
                })
                .reverse(),
            addFavorite: (obj) => this.pinnedFavorites.addFavorite(obj),
            removeFavorite: (id) => this.pinnedFavorites.removeFavorite(id),
            getFavorites: () => this.pinnedFavorites._favorites,
            cycleWindows: (e, source) => this.handleScroll(e, source),
            openAbout: () => this.openAbout(),
            configureApplet: () => this.configureApplet(),
            updateThumbnailsStyle: () => null // Silence missing key warnings
        });

        this.settings = new AppletSettings(this.state.settings, metadata.uuid, instance_id);
        this.bindSettings();
        // Passing an empty object instead of `this` because its only used by SignalManager to bind the callback, which
        // we already do here. Otherwise, it creates more circular references.
        this.signals = new SignalManager(null);
        this.appSystem = this.state.trigger('getAppSystem');
        this.pinnedFavorites = new PinnedFavs({
            signals: this.signals,
            settings: this.settings,
            state: this.state
        });
        this.actor.set_track_hover(false);
        // Declare vertical panel compatibility
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        Gettext.bindtextdomain(metadata.uuid, GLib.get_home_dir() + '/.local/share/locale');

        this.getAutoStartApps();
        this.onSwitchWorkspace = throttle(this.onSwitchWorkspace, 100, true);
        this.signals.connect(this.actor, 'scroll-event', (c, e) => this.handleScroll(e));
        this.signals.connect(global, 'scale-changed', (...args) => this.onUIScaleChange(...args));
        this.signals.connect(global.window_manager, 'switch-workspace', (...args) => this.onSwitchWorkspace(...args));
        this.signals.connect(global.screen, 'workspace-removed', (...args) => this.onWorkspaceRemoved(...args));
        this.signals.connect(global.screen, 'window-monitor-changed', (...args) => this.onWindowMonitorChanged(...args));
        this.signals.connect(global.screen, 'monitors-changed', (...args) => this.on_applet_instances_changed(...args));
        this.signals.connect(global.screen, 'window-skip-taskbar-changed', (...args) => this.onWindowSkipTaskbarChanged(...args));
        this.signals.connect(global.display, 'window-marked-urgent', (...args) => this.updateAttentionState(...args));
        this.signals.connect(global.display, 'window-demands-attention', (...args) => this.updateAttentionState(...args));
        this.signals.connect(global.settings, 'changed::panel-edit-mode', (...args) => this.on_panel_edit_mode_changed(...args));
        this.signals.connect(Main.overview, 'showing', (...args) => this.onOverviewShow(...args));
        this.signals.connect(Main.overview, 'hiding', (...args) => this.onOverviewHide(...args));
        this.signals.connect(Main.expo, 'showing', (...args) => this.onOverviewShow(...args));
        this.signals.connect(Main.expo, 'hiding', (...args) => this.onOverviewHide(...args));
        this.signals.connect(Main.themeManager, 'theme-set', (...args) => this.refreshCurrentAppList(...args));
    }

    bindSettings() {
        let settingsProps = [
            {key: 'show-pinned', value: 'showPinned', cb: this.refreshCurrentAppList},
            {key: 'show-alerts', value: 'showAlerts', cb: this.updateAttentionState},
            {key: 'group-apps', value: 'groupApps', cb: this.refreshCurrentAppList},
            {key: 'enable-app-button-dragging', value: 'enableDragging', cb: null},
            {key: 'launcher-animation-effect', value: 'launcherAnimationEffect', cb: null},
            {key: 'pinned-apps', value: 'pinnedApps', cb: null},
            {key: 'middle-click-action', value: 'middleClickAction', cb: null},
            {key: 'left-click-action', value: 'leftClickAction', cb: null},
            {key: 'show-apps-order-hotkey', value: 'showAppsOrderHotkey', cb: this.bindAppKeys},
            {key: 'show-apps-order-timeout', value: 'showAppsOrderTimeout', cb: null},
            {key: 'cycleMenusHotkey', value: 'cycleMenusHotkey', cb: this.bindAppKeys},
            {key: 'enable-hover-peek', value: 'enablePeek', cb: null},
            {key: 'onclick-thumbnails', value: 'onClickThumbs', cb: null},
            {key: 'hover-peek-opacity', value: 'peekOpacity', cb: null},
            {key: 'hover-peek-time-in', value: 'peekTimeIn', cb: null},
            {key: 'hover-peek-time-out', value: 'peekTimeOut', cb: null},
            {key: 'thumbnail-timeout', value: 'thumbTimeout', cb: null},
            {key: 'thumbnail-size', value: 'thumbSize', cb: this.updateThumbnailSize},
            {key: 'thumbnail-scroll-behavior', value: 'thumbnailScrollBehavior', cb: null},
            {key: 'sort-thumbnails', value: 'sortThumbs', cb: this.updateVerticalThumbnailState},
            {
                key: 'highlight-last-focused-thumbnail',
                value: 'highlightLastFocusedThumbnail',
                cb: this.updateVerticalThumbnailState
            },
            {key: 'vertical-thumbnails', value: 'verticalThumbs', cb: this.updateVerticalThumbnailState},
            {key: 'show-thumbnails', value: 'showThumbs', cb: this.updateVerticalThumbnailState},
            {key: 'animate-thumbnails', value: 'animateThumbs', cb: null},
            {key: 'number-display', value: 'numDisplay', cb: this.updateWindowNumberState},
            {key: 'title-display', value: 'titleDisplay', cb: this.updateTitleDisplay},
            {key: 'scroll-behavior', value: 'scrollBehavior', cb: null},
            {key: 'icon-spacing', value: 'iconSpacing', cb: this.updateSpacing},
            {key: 'show-recent', value: 'showRecent', cb: null},
            {key: 'autostart-menu-item', value: 'autoStart', cb: null},
            {key: 'launch-new-instance-menu-item', value: 'launchNewInstance', cb: null},
            {key: 'monitor-move-all-windows', value: 'monitorMoveAllWindows', cb: null},
            {key: 'system-favorites', value: 'systemFavorites', cb: this.updateFavorites},
            {key: 'show-all-workspaces', value: 'showAllWorkspaces', cb: this.refreshAllAppLists},
            {key: 'list-monitor-windows', value: 'listMonitorWindows', cb: this.handleMonitorWindowsPrefsChange}
        ];

        for (let i = 0, len = settingsProps.length; i < len; i++) {
            this.settings.bind(
                settingsProps[i].key,
                settingsProps[i].value,
                settingsProps[i].cb ? (...args) => settingsProps[i].cb.call(this, ...args) : null
            );
        }

        this.state.set({lastTitleDisplay: this.state.settings.titleDisplay});
    }

    on_applet_added_to_panel() {
        if (this.state.appletReady && this.state.panelEditMode) {
            return;
        }
        this.bindAppKeys();
        this.updateSpacing();
        this.state.set({appletReady: true});
    }

    on_applet_instances_changed(instance) {
        if (!this.state.appletReady) {
            return;
        }

        if (this.state.settings.listMonitorWindows) {
            this.numberOfMonitors = null;
            this.updateMonitorWatchlist();
        }

        if (instance && instance.instance_id === this.instance_id) {
            this.onSwitchWorkspace();
        } else {
            this.refreshCurrentAppList();
        }
    }

    on_panel_edit_mode_changed() {
        this.state.set({panelEditMode: !this.state.panelEditMode});
        each(this.appLists, (workspace) => {
            each(workspace.appList, (appGroup) => {
                if (appGroup.hoverMenu) appGroup.hoverMenu.actor.reactive = !this.state.panelEditMode;
                if (appGroup.rightClickMenu) appGroup.rightClickMenu.actor.reactive = !this.state.panelEditMode;
                appGroup.actor.reactive = !this.state.panelEditMode;
            });
        });
    }

    on_panel_height_changed() {
        this.updateActorAttributes();
    }

    on_orientation_changed(orientation) {
        this.state.set({
            orientation: orientation,
            isHorizontal: orientation === St.Side.TOP || orientation === St.Side.BOTTOM
        });
        if (this.state.isHorizontal) {
            this.actor.remove_style_class_name('vertical');
        } else {
            this.actor.add_style_class_name('vertical');
            this.actor.set_important(true);
        }
    }

    on_applet_removed_from_panel() {
        this.state.set({willUnmount: true});
        this.unbindAppKeys();
        this.signals.disconnectAllSignals();
        for (let i = 0, len = this.appLists.length; i < len; i++) {
            if (this.appLists[i]) {
                this.appLists[i].destroy();
            }
        }
        this.settings.finalize();
        unref(this, RESERVE_KEYS);
    }

    on_panel_icon_size_changed(iconSize) {
        this.updateActorAttributes(iconSize);
    }

    // Override Applet._onButtonPressEvent due to the applet menu being replicated in AppMenuButtonRightClickMenu.
    _onButtonPressEvent(actor, event) {
        if (this.state.panelEditMode) {
            super._onButtonPressEvent(actor, event);
        }
        return false;
    }

    onWindowMonitorChanged(screen, metaWindow, metaWorkspace) {
        if (this.state.settings.listMonitorWindows
            && this.state.monitorWatchList.length !== this.numberOfMonitors) {
            let appList = this.getCurrentAppList();
            appList.windowRemoved(metaWorkspace, metaWindow);
            appList.windowAdded(metaWorkspace, metaWindow);
        }
    }

    bindAppKeys() {
        this.unbindAppKeys();

        for (let i = 1; i < 10; i++) {
            this.bindAppKey(i);
        }
        Main.keybindingManager.addHotKey('launch-show-apps-order', this.state.settings.showAppsOrderHotkey, () =>
            this.showAppsOrder()
        );
        Main.keybindingManager.addHotKey('launch-cycle-menus', this.state.settings.cycleMenusHotkey, () =>
            this.cycleMenus()
        );
    }

    unbindAppKeys() {
        for (let i = 1; i < 10; i++) {
            Main.keybindingManager.removeHotKey('launch-app-key-' + i);
            Main.keybindingManager.removeHotKey('launch-new-app-key-' + i);
        }
        Main.keybindingManager.removeHotKey('launch-show-apps-order');
        Main.keybindingManager.removeHotKey('launch-cycle-menus');
    }

    bindAppKey(i) {
        Main.keybindingManager.addHotKey('launch-app-key-' + i, '<Super>' + i, () => this.onAppKeyPress(i));
        Main.keybindingManager.addHotKey('launch-new-app-key-' + i, '<Super><Shift>' + i, () =>
            this.onNewAppKeyPress(i)
        );
    }

    onAppKeyPress(number) {
        this.getCurrentAppList().onAppKeyPress(number);
    }

    onNewAppKeyPress(number) {
        this.getCurrentAppList().onNewAppKeyPress(number);
    }

    showAppsOrder() {
        this.getCurrentAppList().showAppsOrder();
    }

    cycleMenus() {
        this.getCurrentAppList().cycleMenus();
    }

    handleMonitorWindowsPrefsChange(value) {
        let instances = Main.AppletManager.getRunningInstancesForUuid(this.state.uuid);
        for (let i = 0; i < instances.length; i++) {
            if (!instances[i]) {
                continue;
            }
            instances[i].updateMonitorWatchlist();
            if (instances[i].panel.monitorIndex !== this.panel.monitorIndex) {
                instances[i].state.settings.listMonitorWindows = this.state.settings.listMonitorWindows;
            }
            instances[i].refreshCurrentAppList();
        }
    }

    updateMonitorWatchlist() {
        if (!this.numberOfMonitors) {
            this.numberOfMonitors = Gdk.Screen.get_default().get_n_monitors();
        }
        let onPrimary = this.panel.monitorIndex === Main.layoutManager.primaryIndex;
        let instances = Main.AppletManager.getRunningInstancesForUuid(this.state.uuid);
        let {monitorWatchList} = this.state;
        /* Simple cases */
        if (this.numberOfMonitors === 1) {
            monitorWatchList = [Main.layoutManager.primaryIndex];
        } else if (instances.length > 1 && !onPrimary) {
            monitorWatchList = [this.panel.monitorIndex];
        } else {
           /* This is an instance on the primary monitor - it will be
            * responsible for any monitors not covered individually.  First
            * convert the instances list into a list of the monitor indices,
            * and then add the monitors not present to the monitor watch list
            * */
            monitorWatchList = [this.panel.monitorIndex];
            for (let i = 0; i < instances.length; i++) {
                if (!instances[i]) {
                    continue;
                }
                instances[i] = instances[i].panel.monitorIndex;
            }

            for (let i = 0; i < this.numberOfMonitors; i++) {
                if (instances.indexOf(i) === -1) {
                    monitorWatchList.push(i);
                }
            }
        }
        this.state.set({monitorWatchList});
    }

    refreshCurrentAppList() {
        let appList = this.appLists[this.state.currentWs];
        if (appList) setTimeout(() => appList.refreshList(), 0);
    }

    refreshAllAppLists() {
        each(this.appLists, function(appList) {
            setTimeout(() => appList.refreshList(), 0);
        });
    }

    updateFavorites() {
        this.pinnedFavorites.reload();
        this.refreshCurrentAppList();
    }

    updateThumbnailSize() {
        each(this.appLists, (workspace) => {
            each(workspace.appList, (appGroup) => {
                if (appGroup.hoverMenu) appGroup.hoverMenu.updateThumbnailSize();
            });
        });
    }

    updateActorAttributes(iconSize) {
        each(this.appLists, (workspace) => {
            if (!workspace) return;

            each(workspace.appList, (appGroup) => {
                appGroup.setActorAttributes(iconSize);
            });
        });
    }

    updateSpacing() {
        each(this.appLists, (workspace) => {
            workspace.updateSpacing();
        });
    }

    updateWindowNumberState() {
        each(this.appLists, (workspace) => {
            workspace.calcAllWindowNumbers();
        });
    }

    updateAttentionState(display, window) {
        if (!this.state.settings.showAlerts) {
            return false;
        }
        each(this.appLists, (workspace) => {
            workspace.updateAttentionState(display, window);
        });
    }

    updateVerticalThumbnailState() {
        each(this.appLists, (workspace) => {
            each(workspace.appList, (appGroup) => {
                if (appGroup && appGroup.hoverMenu) {
                    appGroup.hoverMenu.setVerticalSetting();
                }
            });
        });
    }

    updateTitleDisplay(titleDisplay) {
        if (titleDisplay === TitleDisplay.None
            || this.state.lastTitleDisplay === TitleDisplay.None) {
            this.refreshCurrentAppList();
        }
        let appList = this.getCurrentAppList().appList;
        each(appList, (appGroup) => {
            if (titleDisplay === TitleDisplay.Focused) {
                appGroup.hideLabel(false);
            }
            appGroup.handleTitleDisplayChange();
        });
        this.state.set({lastTitleDisplay: titleDisplay});
    }

    getAppFromWMClass(specialApps, metaWindow) {
        let startupClass = (wmClass) => {
            let app = null;
            for (let i = 0, len = specialApps.length; i < len; i++) {
                if (specialApps[i].wmClass === wmClass) {
                    app = this.appSystem.lookup_app(specialApps[i].id);
                    if (!app) {
                        app = this.appSystem.lookup_settings_app(specialApps[i].id);
                    }
                    if (app) {
                        app.wmClass = wmClass;
                    }
                }
            }
            return app;
        };
        return startupClass(metaWindow.get_wm_class_instance());
    }

    getCurrentAppList() {
        if (typeof this.appLists[this.state.currentWs] !== 'undefined') {
            return this.appLists[this.state.currentWs];
        } else if (typeof this.appLists[0] !== 'undefined') {
            return this.appLists[0];
        } else {
            return null;
        }
    }

    getAutoStartApps() {
        let info, autoStartDir;

        let getChildren = () => {
            let children = autoStartDir.enumerate_children(
                'standard::name,standard::type,time::modified',
                Gio.FileQueryInfoFlags.NONE,
                null
            );
            while ((info = children.next_file(null)) !== null) {
                if (info.get_file_type() === Gio.FileType.REGULAR) {
                    let name = info.get_name();
                    let file = Gio.file_new_for_path(autoStartStrDir + '/' + name);
                    this.state.autoStartApps.push({id: name, file: file});
                }
            }
            this.state.set({autoStartApps: this.state.autoStartApps});
        };

        autoStartDir = Gio.file_new_for_path(autoStartStrDir);

        if (autoStartDir.query_exists(null)) {
            getChildren();
        } else {
            trySpawnCommandLine(`bash -c "mkdir ${autoStartStrDir}"`);
            setTimeout(() => getChildren(), 2000);
        }
    }

    handleScroll(e, sourceFromAppGroup) {
        if ((this.state.settings.scrollBehavior === 1 && this.state.settings.leftClickAction !== 3)
            || (e && sourceFromAppGroup && !this.state.settings.thumbnailScrollBehavior)) {
            return;
        }

        this.state.set({scrollActive: true});

        let isAppScroll = this.state.settings.scrollBehavior === 2;
        let direction, source;

        if (sourceFromAppGroup) {
            isAppScroll = false;
            direction = e ? e.get_scroll_direction() : 1;
            source = sourceFromAppGroup;
        } else {
            direction = e.get_scroll_direction();
            source = e.get_source()._delegate;
        }
        let lastFocusedApp, z, count

        if (isAppScroll) {
            lastFocusedApp = this.appLists[this.state.currentWs].listState.lastFocusedApp;
            if (!lastFocusedApp) {
                lastFocusedApp = this.appLists[this.state.currentWs].appList[0].groupState.appId
            }
            let focusedIndex = findIndex(this.appLists[this.state.currentWs].appList, function(appGroup) {
                return appGroup.groupState.metaWindows.length > 0 && appGroup.groupState.appId === lastFocusedApp;
            });
            z = direction === 0 ? focusedIndex - 1 : focusedIndex + 1;
            count = this.appLists[this.state.currentWs].appList.length - 1;
        } else {
            if (!source.groupState || source.groupState.metaWindows.length < 1) {
                return;
            }
            let focusedIndex = findIndex(source.groupState.metaWindows, function(metaWindow) {
                return metaWindow === source.groupState.lastFocused;
            });
            z = direction === 0 ? focusedIndex - 1 : focusedIndex + 1;
            count = source.groupState.metaWindows.length - 1;
        }

        let limit = count * 2;

        while ((isAppScroll
            && (!this.appLists[this.state.currentWs].appList[z]
                || !this.appLists[this.state.currentWs].appList[z].groupState.lastFocused))
            || (!isAppScroll &&
                (!source.groupState.metaWindows[z]
                    || source.groupState.metaWindows[z] === source.groupState.lastFocused))) {
            limit--;
            if (direction === 0) {
                z -= 1;
            } else {
                z += 1;
            }
            if (limit < 0) {
                if (count === 0) {
                    z = 0;
                }
                break;
            } else if (z < 0) {
                z = count;
            } else if (z > count) {
                z = 0;
            }
        }

        let _window = isAppScroll ?
            this.appLists[this.state.currentWs].appList[z].groupState.lastFocused
            : source.groupState.metaWindows[z];
        Main.activateWindow(_window, global.get_current_time());
        setTimeout(() => this.state.set({scrollActive: false}, 4000));
    }

    handleDragOver(source, actor, x, y) {
        if (!this.state.settings.enableDragging || this.state.panelEditMode) {
            return DND.DragMotionResult.NO_DROP;
        }

        if (!source.actor) return DND.DragMotionResult.CONTINUE;

        let appList = this.appLists[this.state.currentWs];
        let children = appList.actor.get_children();
        let windowPos = children.indexOf(source.actor);
        let isForeign = typeof source.groupState === 'undefined';

        let pos = 0;

        let isHorizontal = appList.actor.height > appList.actor.width;
        let axis = isHorizontal ? [y, 'y1'] : [x, 'x1'];
        each(children, (child, i) => {
            if (axis[0] > children[i].get_allocation_box()[axis[1]] + children[i].width / 2) {
                pos = i;
            }
        });

        if (pos !== this.state.dragPlaceholderPos) {
            this.state.dragPlaceholderPos = pos;

            // Don't allow positioning before or after self
            if (windowPos !== -1 && pos === windowPos) {
                if (this.state.dragPlaceholder) {
                    this.state.dragPlaceholder.animateOutAndDestroy();
                    this.state.animatingPlaceholdersCount++;
                    this.state.dragPlaceholder.actor.connect('destroy', () => this.state.animatingPlaceholdersCount--);
                }
                this.state.dragPlaceholder = null;

                return DND.DragMotionResult.CONTINUE;
            }

            // If the placeholder already exists, we just move
            // it, but if we are adding it, expand its size in
            // an animation
            let fadeIn;
            if (this.state.dragPlaceholder) {
                this.state.dragPlaceholder.actor.destroy();
                fadeIn = false;
            } else {
                fadeIn = true;
            }

            let iconSize = this.getPanelIconSize();
            this.state.dragPlaceholder = new DND.GenericDragPlaceholderItem();
            this.state.dragPlaceholder.child.width = iconSize;
            this.state.dragPlaceholder.child.height = iconSize;

            // For menu items, don't insert actors at specific indices,
            // they will get attached to the end of the list anyway.
            if (!isForeign) {
                appList.actor.insert_child_at_index(
                    this.state.dragPlaceholder.actor,
                    this.state.dragPlaceholderPos
                );
            }

            if (fadeIn) this.state.dragPlaceholder.animateIn();
        }

        return DND.DragMotionResult.MOVE_DROP;
    }

    // TODO: Figure out exactly which properties on this applet constructor the Cinnamon APIs needs for all modes of
    // DND, so we can kill the _delegate reference. Long term, a PR to Cinnamon should be opened fixing circular
    // object reference structures for the applet and desklet classes.
    acceptDrop(source, actor, x) {
        if (!this.state.settings.enableDragging || this.state.panelEditMode) {
            return false;
        }
        if (typeof source.groupState === 'undefined') {
            let appId = source.isDraggableApp ? source.get_app_id() : source.getId();
            if (appId) {
                this.acceptNewLauncher(appId);
                return true;
            }
            return false;
        }

        let currentAppList = this.getCurrentAppList();
        let pos = this.state.dragPlaceholderPos;
        this.clearDragPlaceholder();

        // For getting the fallback position, possibly dead code
        if (pos === -1) {
            let children = currentAppList.actor.get_children();
            let _pos = 0;
            for (let i = 0, len = children.length; i < len; i++) {
                if (x > children[i].get_allocation_box().x1 + children[i].width / 2) {
                    _pos = i;
                }
            }
            if (_pos !== this.state.dragPlaceholderPos) {
                pos = _pos;
            }
        }

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
            // Move the button
            currentAppList.actor.set_child_at_index(source.actor, pos);
            currentAppList.updateAppGroupIndexes();
            // Refresh the group's thumbnails so hoverMenu is aware of the position change
            // In the case of dragging a group that has a delay before Cinnamon can grab its
            // thumbnail texture, e.g., LibreOffice, defer the refresh.
            if (source.groupState.metaWindows.length > 0) {
                setTimeout(() => source.groupState.trigger('windowCount'), 0);
            }


            // Handle favoriting if pin on drag is enabled
            if (!source.groupState.app.is_window_backed()) {
                let opts = {
                    appId: source.groupState.appId,
                    app: source.groupState.app,
                    pos
                };
                let refFav = findIndex(this.pinnedFavorites._favorites, (favorite) => favorite.id === source.groupState.appId);
                if (refFav > -1) {
                    this.pinnedFavorites.moveFavoriteToPos(opts);
                }
            }

            return false;
        });

        return true;
    }

    clearDragPlaceholder() {
        if (this.state.dragPlaceholder) {
            this.state.dragPlaceholder.animateOutAndDestroy();
            this.state.dragPlaceholder = null;
            this.state.dragPlaceholderPos = -1;
        }
    }

    acceptNewLauncher(path) {
        this.pinnedFavorites.addFavorite({appId: path, pos: -1});
        // Need to determine why the favorites setting signal doesn't emit outside the applet actions
        this.updateFavorites();
    }

    onWorkspaceRemoved(metaScreen, index) {
        if (this.appLists.length <= index) {
            return;
        }
        let removedLists = [];
        for (let i = 0; i < this.appLists.length; i++) {
            let workspaceIndex = this.appLists[i].metaWorkspace.index();
            if (workspaceIndex === -1) {
                this.appLists[i].destroy();
                this.appLists[i] = null;
                removedLists.push(i);
            } else {
                this.appLists[i].index = workspaceIndex;
            }
        }
        for (let i = 0; i < removedLists.length; i++) {
            this.appLists.splice(removedLists[i], 1);
        }
        this.state.set({currentWs: global.screen.get_active_workspace_index()});
    }

    onSwitchWorkspace() {
        setTimeout(() => this._onSwitchWorkspace(), 0);
    }

    _onSwitchWorkspace() {
        if (!this.state) return;
        this.state.set({currentWs: global.screen.get_active_workspace_index()});
        let metaWorkspace = global.screen.get_workspace_by_index(this.state.currentWs);

        // If the workspace we switched to isn't in our list,
        // we need to create an AppList for it
        let refWorkspace = findIndex(
            this.appLists,
            (item) => item.metaWorkspace && item.metaWorkspace === metaWorkspace
        );

        if (refWorkspace === -1) {
            this.appLists.push(
                new AppList({
                    metaWorkspace: metaWorkspace,
                    state: this.state,
                    index: this.state.currentWs
                })
            );
            refWorkspace = this.appLists.length - 1;
        }

        this.actor.remove_all_children();
        this.actor.add_child(this.appLists[refWorkspace].actor);
    }

    onWindowSkipTaskbarChanged(screen, metaWindow) {
        let appList = this.getCurrentAppList();

        if (metaWindow.is_skip_taskbar()) {
            appList.windowRemoved(appList.metaWorkspace, metaWindow);
            return;
        }

        appList.windowAdded(appList.metaWorkspace, metaWindow);
    }

    onUIScaleChange() {
        this.state.set({thumbnailCloseButtonOffset: global.ui_scale > 1 ? -10 : 0});
        this.refreshAllAppLists();
    }

    onOverviewShow() {
        this.actor.hide();
    }

    onOverviewHide() {
        this.actor.show();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new GroupedWindowListApplet(metadata, orientation, panel_height, instance_id);
}
