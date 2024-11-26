const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Gettext = imports.gettext;
const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const DND = imports.ui.dnd;
const {AppletSettings} = imports.ui.settings;
const {SignalManager} = imports.misc.signalManager;
const {throttle, unref, trySpawnCommandLine} = imports.misc.util;

const createStore = require('./state');
const AppGroup = require('./appGroup');
const Workspace = require('./workspace');
const {
  RESERVE_KEYS,
  TitleDisplay,
  autoStartStrDir
}  = require('./constants');

class PinnedFavs {
    constructor(params) {
        this.params = params;
        this.reload();
    }

    reload() {
        const {state, signals, settings} = this.params;
        const appSystem = state.trigger('getAppSystem');
        this._favorites = [];

        settings.getValue('pinned-apps').forEach( id => {
            const refFav = this._favorites.findIndex( item => item.id === id);
            if (refFav === -1) {
                const app = appSystem.lookup_app(id);
                this._favorites.push({
                    id: id,
                    app: app
                });
            }
        });
    }

    triggerUpdate(appId, isFavoriteApp) {
        const currentWorkspace = this.params.state.trigger('getCurrentWorkspace');
        if (!currentWorkspace) return;

        const refApp = currentWorkspace.appGroups.findIndex( appGroup => appGroup.groupState.appId === appId);
        if (refApp === -1) return;

        // A pinned app with no windows open was unpinned - remove it
        if (!isFavoriteApp
            && currentWorkspace.appGroups[refApp]
            && currentWorkspace.appGroups[refApp].groupState.metaWindows.length === 0) {
            currentWorkspace.appGroups[refApp].destroy(true);
            currentWorkspace.appGroups[refApp] = undefined;
            currentWorkspace.appGroups.splice(refApp, 1);
        } else {
            // Otherwise, synchronize its pinned state
            currentWorkspace.appGroups[refApp].groupState.set({isFavoriteApp});
        }
    }

    saveFavorites() {
        const uniqueSet = new Set();
        const ids = [];
        for (let i = 0; i < this._favorites.length; i++) {
            if (uniqueSet.has(this._favorites[i].id) === false) {
                ids.push(this._favorites[i].id);
                uniqueSet.add(this._favorites[i].id);
            }
        }
        this.params.settings.setValue('pinned-apps', ids);
    }

    onFavoritesChange() {
        this.reload();
        this.params.state.trigger('refreshAllWorkspaces');
    }

    addFavorite(opts = {appId: null, app: null, pos: -1}) {
        const appSystem = this.params.state.trigger('getAppSystem');
        let oldIndex = -1;
        if (!opts.app) {
            opts.app = appSystem.lookup_app(opts.appId);
        }
        if (!opts.app) {
            opts.app = appSystem.lookup_desktop_wmclass(opts.appId);
        }
        if (!opts.app) {
            return false;
        }

        const newFavorite = {
            id: opts.appId,
            app: opts.app
        };
        const refFavorite = this._favorites.findIndex( favorite => favorite.id === opts.appId);

        if (refFavorite === -1) {
            // Iterates the app groups in the order they are added as children, this
            // ensures we always get the correct favorites order regardless of whether
            // or not pin on drag is enabled.
            const currentWorkspace = this.params.state.trigger('getCurrentWorkspace');
            const newFavorites = [];
            let refActorFound = false;
            currentWorkspace.actor.get_children().forEach( (actor, i) => {
                const appGroup = currentWorkspace.appGroups.find( appGroup => appGroup.actor === actor );
                if (!appGroup) return;
                const {app, appId, isFavoriteApp} = appGroup.groupState;
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
        this.onFavoritesChange();
        return true;
    }

    moveFavoriteToPos(opts, oldIndex) {
        if (!oldIndex || !this.params.state.settings.groupApps) {
            oldIndex = this._favorites.findIndex( favorite => favorite.id === opts.appId);
        }
        this._favorites.splice(opts.pos, 0, this._favorites.splice(oldIndex, 1)[0]);
        this._favorites = this._favorites.filter( favorite => favorite && favorite.app != null );
        this.saveFavorites();
    }

    removeFavorite(appId) {
        const refFav = this._favorites.findIndex( favorite => favorite.id === appId);
        this.triggerUpdate(appId, false);
        this._favorites.splice(refFav, 1);
        this.saveFavorites();
        this.onFavoritesChange();
        return true;
    }
}

class GroupedWindowListApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.tracker = Cinnamon.WindowTracker.get_default();
        this.recentManager = Gtk.RecentManager.get_default();
        this.workspaces = [];
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
            currentWs: global.workspace_manager.get_active_workspace_index(),
            panelEditMode: global.settings.get_boolean('panel-edit-mode'),
            menuOpen: false,
            dragging: {
                posList: null,
                dragPlaceholder: null,
                pos: -1,
                isForeign: null,
            },
            appletActor: null,
            appletReady: false,
            willUnmount: false,
            settings: {},
            homeDir: GLib.get_home_dir(),
            lastOverlayPreview: null,
            lastCycled: -1,
            lastTitleDisplay: null,
            scrollActive: false,
            thumbnailMenuOpen: false,
            thumbnailCloseButtonOffset: global.ui_scale > 1 ? -10 : 0,
            addingWindowToWorkspaces: false,
            removingWindowFromWorkspaces: false,
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
            getAppFromWindow: (metaWindow) => this.getAppFromWindow(metaWindow),
            getTracker: () => this.tracker,
            addWindowToAllWorkspaces: (win, app, isFavoriteApp) => {
                this.workspaces.forEach( workspace => {
                    workspace.windowAdded(workspace.metaWorkspace, win, app, isFavoriteApp);
                });
                this.state.addingWindowToWorkspaces = false;
            },
            removeWindowFromAllWorkspaces: (win) => {
                this.workspaces.forEach( workspace => {
                    workspace.windowRemoved(workspace.metaWorkspace, win);
                });
                this.state.removingWindowFromWorkspaces = false;
            },
            removeWindowFromOtherWorkspaces: (win) => {
                this.workspaces.forEach( workspace => {
                    if (workspace.workspaceState.workspaceIndex === this.state.currentWs) {
                        return;
                    }
                    workspace.windowRemoved(workspace.metaWorkspace, win);
                });
                this.state.removingWindowFromWorkspaces = false;
            },
            refreshCurrentWorkspace: () => this.refreshCurrentWorkspace(),
            refreshAllWorkspaces: () => this.refreshAllWorkspaces(),
            getCurrentWorkspace: () => this.getCurrentWorkspace(),
            moveLauncher: (source) => this.moveLauncher(source),
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
            removeApplet: (event) => this.confirmRemoveApplet(event),
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

        this.actor.set_style_class_name('grouped-window-list-box');
        this.state.set({appletActor: this.actor});
        this.on_orientation_changed(orientation);

        this.getAutoStartApps();
        this.onSwitchWorkspace = throttle(this.onSwitchWorkspace, 35, false); //Note: causes a 35ms delay in execution
        this.signals.connect(this.actor, 'scroll-event', (c, e) => this.handleScroll(e));
        this.signals.connect(global, 'scale-changed', (...args) => this.onUIScaleChange(...args));
        this.signals.connect(global.window_manager, 'switch-workspace', (...args) => this.onSwitchWorkspace(...args));
        this.signals.connect(global.workspace_manager, 'workspace-removed', (...args) => this.onWorkspaceRemoved(...args));
        this.signals.connect(global.display, 'window-monitor-changed', (...args) => this.onWindowMonitorChanged(...args));
        this.signals.connect(Main.panelManager, 'monitors-changed', (...args) => this._onMonitorsChanged(...args));
        this.signals.connect(global.display, 'window-skip-taskbar-changed', (...args) => this.onWindowSkipTaskbarChanged(...args));
        this.signals.connect(global.display, 'window-marked-urgent', (...args) => this.updateAttentionState(...args));
        this.signals.connect(global.display, 'window-demands-attention', (...args) => this.updateAttentionState(...args));
        this.signals.connect(global.display, 'window-created', (...args) => this.onWindowCreated(...args));
        this.signals.connect(global.settings, 'changed::panel-edit-mode', (...args) => this.on_panel_edit_mode_changed(...args));
        this.signals.connect(Main.themeManager, 'theme-set', (...args) => this.refreshCurrentWorkspace(...args));
    }

    bindSettings() {
        const settingsProps = [
            {key: 'group-apps', value: 'groupApps', cb: this.refreshCurrentWorkspace},
            {key: 'scroll-behavior', value: 'scrollBehavior', cb: null},
            {key: 'left-click-action', value: 'leftClickAction', cb: null},
            {key: 'middle-click-action', value: 'middleClickAction', cb: null},
            {key: 'show-all-workspaces', value: 'showAllWorkspaces', cb: this.refreshAllWorkspaces},
            {key: 'window-display-settings', value: 'windowDisplaySettings', cb: this.reloadAllAppsMonitor},
            {key: 'cycleMenusHotkey', value: 'cycleMenusHotkey', cb: this.bindAppKeys},
            {key: 'show-apps-order-hotkey', value: 'showAppsOrderHotkey', cb: this.bindAppKeys},
            {key: 'show-apps-order-timeout', value: 'showAppsOrderTimeout', cb: null},
            {key: 'super-num-hotkeys', value: 'SuperNumHotkeys', cb: this.bindAppKeys},
            {key: 'title-display', value: 'titleDisplay', cb: this.updateTitleDisplay},
            {key: 'launcher-animation-effect', value: 'launcherAnimationEffect', cb: null},
            {key: 'number-display', value: 'numDisplay', cb: this.updateWindowNumberState},
            {key: 'enable-app-button-dragging', value: 'enableDragging', cb: this.draggableSettingChanged},
            {key: 'thumbnail-scroll-behavior', value: 'thumbnailScrollBehavior', cb: null},
            {key: 'show-thumbnails', value: 'showThumbs', cb: this.updateVerticalThumbnailState},
            {key: 'animate-thumbnails', value: 'animateThumbs', cb: null},
            {key: 'vertical-thumbnails', value: 'verticalThumbs', cb: this.updateVerticalThumbnailState},
            {key: 'sort-thumbnails', value: 'sortThumbs', cb: this.updateVerticalThumbnailState},
            {
                key: 'highlight-last-focused-thumbnail',
                value: 'highlightLastFocusedThumbnail',
                cb: this.updateVerticalThumbnailState
            },
            {key: 'onclick-thumbnails', value: 'onClickThumbs', cb: null},
            {key: 'thumbnail-timeout', value: 'thumbTimeout', cb: null},
            {key: 'thumbnail-size', value: 'thumbSize', cb: this.updateThumbnailSize},
            {key: 'enable-hover-peek', value: 'enablePeek', cb: null},
            {key: 'hover-peek-time-in', value: 'peekTimeIn', cb: null},
            {key: 'hover-peek-time-out', value: 'peekTimeOut', cb: null},
            {key: 'hover-peek-opacity', value: 'peekOpacity', cb: null},
            {key: 'show-recent', value: 'showRecent', cb: null},
            {key: 'autostart-menu-item', value: 'autoStart', cb: null},
            {key: 'monitor-move-all-windows', value: 'monitorMoveAllWindows', cb: null},
            {key: 'pinned-apps', value: 'pinnedApps', cb: null}
        ];

        settingsProps.forEach( setting => {
            this.settings.bind(
                setting.key,
                setting.value,
                setting.cb ? (...args) => setting.cb.call(this, ...args) : null
            );
        });

        this.state.set({lastTitleDisplay: this.state.settings.titleDisplay});
    }

    draggableSettingChanged() {
        this.workspaces.forEach( workspace => {
            workspace.appGroups.forEach( appGroup => {
                appGroup._draggable.inhibit = !this.state.settings.enableDragging;
            });
        });
    }

    on_applet_added_to_panel() {
        if (this.state.appletReady && this.state.panelEditMode) {
            return;
        }
        this.bindAppKeys();
        this.state.set({appletReady: true});
    }

    _updateState(initialUpdate) {
        if (!this.state.appletReady) {
            return;
        }

        this.numberOfMonitors = null;
        this.updateMonitorWatchlist();

        if (initialUpdate) {
            this.onSwitchWorkspace();
        } else {
            this.refreshCurrentWorkspace();
        }
    }

    on_applet_instances_changed(instance) {
        this._updateState(instance?.instance_id === this.instance_id);
    }

    _onMonitorsChanged(panelManager) {
        this._updateState(false);
    }

    on_panel_edit_mode_changed() {
        this.state.set({panelEditMode: !this.state.panelEditMode});
        this.workspaces.forEach( workspace => {
            workspace.appGroups.forEach( appGroup => {
                if (appGroup.hoverMenu) appGroup.hoverMenu.actor.reactive = !this.state.panelEditMode;
                if (appGroup.rightClickMenu) {
                    appGroup.rightClickMenu.actor.reactive = !this.state.panelEditMode;
                }
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
        this.workspaces.forEach( workspace => {
            if (workspace) {
                workspace.destroy();
            }
        });
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

    onWindowMonitorChanged(display, metaWindow, metaWorkspace) {
        if (this.state.monitorWatchList.length !== this.numberOfMonitors) {
            const currentWorkspace = this.getCurrentWorkspace();
            if (currentWorkspace !== null) {
                currentWorkspace.windowRemoved(metaWorkspace, metaWindow);
                currentWorkspace.windowAdded(metaWorkspace, metaWindow);
            }
        }
    }

    bindAppKeys() {
        this.unbindAppKeys();

        if (this.state.settings.SuperNumHotkeys) {
            for (let i = 1; i < 10; i++) {
                this.bindAppKey(i);
                this.bindNewAppKey(i);
            }
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
    }

    bindNewAppKey(i) {
        Main.keybindingManager.addHotKey('launch-new-app-key-' + i, '<Super><Shift>' + i, () =>
            this.onNewAppKeyPress(i)
        );
    }

    onAppKeyPress(number) {
        this.getCurrentWorkspace().onAppKeyPress(number);
    }

    onNewAppKeyPress(number) {
        this.getCurrentWorkspace().onNewAppKeyPress(number);
    }

    showAppsOrder() {
        this.getCurrentWorkspace().showAppsOrder();
    }

    cycleMenus() {
        this.getCurrentWorkspace().cycleMenus();
    }

    reloadAllAppsMonitor(){
        this.refreshAllWorkspaces();
        this.updateMonitorWatchlist();
    }

    updateMonitorWatchlist() {
        if (!this.numberOfMonitors) {
            this.numberOfMonitors = global.display.get_n_monitors();
        }
        const onPrimary = this.panel.monitorIndex === Main.layoutManager.primaryIndex;
        const instances = Main.AppletManager.getRunningInstancesForUuid(this.state.uuid);
        let {monitorWatchList} = this.state;

        // Show all applications from all monitors
        if (this.state.settings.windowDisplaySettings === 2) {
            monitorWatchList = Array.from({ length: this.numberOfMonitors }, (_, i) => i);

        } else {
            // Original logic
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
        }
        this.state.set({ monitorWatchList });
        global.log("Monitor Watch List updated: " + JSON.stringify(monitorWatchList));
    }

    refreshCurrentWorkspace() {
        const currentWorkspace = this.getCurrentWorkspace();
        if (currentWorkspace) currentWorkspace.refreshList();
    }

    refreshAllWorkspaces(options = {exceptCurrentOne: false}) {
        const currentWorkspace = this.getCurrentWorkspace();
        this.workspaces.forEach( workspace => {
            if (options.exceptCurrentOne && currentWorkspace === workspace)
                return;
            setTimeout(() => workspace.refreshList(), 0);
        });
    }

    updateFavorites() {
        this.pinnedFavorites.reload();
        this.refreshAllWorkspaces();
    }

    updateThumbnailSize() {
        this.workspaces.forEach( workspace => {
            workspace.appGroups.forEach( appGroup => {
                if (appGroup.hoverMenu) appGroup.hoverMenu.updateThumbnailSize();
            });
        });
    }

    updateActorAttributes(iconSize) {
        this.workspaces.forEach( workspace => {
            if (!workspace) return;

            workspace.appGroups.forEach(
                appGroup => appGroup.setActorAttributes(iconSize)
            );
        });
    }

    updateWindowNumberState() {
        this.workspaces.forEach(
            workspace => workspace.calcAllWindowNumbers()
        );
    }

    updateAttentionState(display, window) {
        this.workspaces.forEach(
            workspace => workspace.updateAttentionState(display, window)
        );
    }

    onWindowCreated(display, window) {
        this.workspaces.forEach(
            workspace => workspace.windowAdded(window.get_workspace(), window)
        );
    }

    updateVerticalThumbnailState() {
        this.workspaces.forEach( workspace => {
            workspace.appGroups.forEach( appGroup => {
                if (appGroup && appGroup.hoverMenu) {
                    appGroup.hoverMenu.setVerticalSetting();
                }
            });
        });
    }

    updateTitleDisplay(titleDisplay) {
        if (titleDisplay === TitleDisplay.None
            || this.state.lastTitleDisplay === TitleDisplay.None) {
            this.refreshCurrentWorkspace();
        }

        this.workspaces.forEach( workspace => {
            workspace.appGroups.forEach( appGroup => {
                if (titleDisplay === TitleDisplay.Focused) {
                    appGroup.hideLabel();
                }
                appGroup.handleTitleDisplayChange();
            });
        });

        this.state.set({lastTitleDisplay: titleDisplay});
    }

    getAppFromWindow(metaWindow) {
        const tracker = this.state.trigger('getTracker');
        if (!tracker) {
          return null;
        }
        let app = tracker.get_window_app(metaWindow);
        if (!app) {
          app = tracker.get_app_from_pid(metaWindow.get_pid());
        }
        if (!app) {
          app = tracker.get_app_from_pid(metaWindow.get_client_pid());
        }
        return app;
    }

    getCurrentWorkspace() {
        const metaWorkspace = global.workspace_manager.get_workspace_by_index(this.state.currentWs);

        const currentWorkspace = this.workspaces.find(
            workspace => workspace.metaWorkspace && workspace.metaWorkspace === metaWorkspace
        );

        if (currentWorkspace) {
            return currentWorkspace;
        } else if (typeof this.workspaces[this.state.currentWs] !== 'undefined') {
            return this.workspaces[this.state.currentWs];
        } else if (typeof this.workspaces[0] !== 'undefined') {
            return this.workspaces[0];
        } else {
            return null;
        }
    }

    getAutoStartApps() {
        let info, autoStartDir;

        const getChildren = () => {
            const children = autoStartDir.enumerate_children(
                'standard::name,standard::type,time::modified',
                Gio.FileQueryInfoFlags.NONE,
                null
            );
            while ((info = children.next_file(null)) !== null) {
                if (info.get_file_type() === Gio.FileType.REGULAR) {
                    const name = info.get_name();
                    const file = Gio.file_new_for_path(autoStartStrDir + '/' + name);
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
        if (e?.get_scroll_direction() == Clutter.ScrollDirection.SMOOTH)
            return;

        if( (this.state.settings.thumbnailScrollBehavior) || (this.state.settings.scrollBehavior === 2) ||
            (this.state.settings.leftClickAction === 3 && this.state.settings.scrollBehavior !== 3
             && !e && sourceFromAppGroup)  ||
            (this.state.settings.leftClickAction !== 3 && this.state.settings.scrollBehavior === 3               
                        && e && !sourceFromAppGroup)  || 
            (this.state.settings.leftClickAction === 3 && this.state.settings.scrollBehavior === 3)) {

            this.state.set({scrollActive: true});

            const currentWorkspace = this.getCurrentWorkspace();

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
                lastFocusedApp = currentWorkspace.workspaceState.lastFocusedApp;
                if (!lastFocusedApp) {
                    lastFocusedApp = currentWorkspace.appGroups[0].groupState.appId
                }
                const focusedIndex = currentWorkspace.appGroups.findIndex(
                    appGroup => appGroup.groupState.metaWindows.length > 0
                        && appGroup.groupState.appId === lastFocusedApp
                );
                z = direction === 0 ? focusedIndex - 1 : focusedIndex + 1;
                count = currentWorkspace.appGroups.length - 1;
            } else {
                if (!source.groupState || source.groupState.metaWindows.length < 1) {
                    return;
                }
                const focusedIndex = source.groupState.metaWindows.findIndex(
                    metaWindow => metaWindow === source.groupState.lastFocused
                );
                z = direction === 0 ? focusedIndex - 1 : focusedIndex + 1;
                count = source.groupState.metaWindows.length - 1;
            }

            let limit = count * 2;

            while ((isAppScroll
                && (!currentWorkspace.appGroups[z]
                    || !currentWorkspace.appGroups[z].groupState.lastFocused))
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

            const _window = isAppScroll ?
            currentWorkspace.appGroups[z].groupState.lastFocused
                : source.groupState.metaWindows[z];
            Main.activateWindow(_window, global.get_current_time());
            setTimeout(() => this.state.set({scrollActive: false}, 4000));
        }
    }

    handleDragOver(source, actor, x, y) {
        if (!this.state.settings.enableDragging || this.state.panelEditMode)
            return DND.DragMotionResult.NO_DROP;
        if(actor.name === 'xdnd-proxy-actor')
            return DND.DragMotionResult.CONTINUE;

        const currentWorkspace = this.getCurrentWorkspace();
        const rtl_horizontal = this.state.isHorizontal
            && St.Widget.get_default_direction () === St.TextDirection.RTL;

        const axis = this.state.isHorizontal ? [x, 'x2'] : [y, 'y2'];
        if(rtl_horizontal)
            axis[0] = this.actor.width - axis[0];

        // save data on drag start
        if(this.state.dragging.posList === null){
            this.state.dragging.isForeign = !(source instanceof AppGroup);
            this.state.dragging.posList = [];
            currentWorkspace.actor.get_children().forEach( child => {
                let childPos;
                if(rtl_horizontal)
                    childPos = this.actor.width - child.get_allocation_box()['x1'];
                else
                    childPos = child.get_allocation_box()[axis[1]];
                this.state.dragging.posList.push(childPos);
            });
        }

        // get current position
        let pos = 0;
        while(pos < this.state.dragging.posList.length && axis[0] > this.state.dragging.posList[pos])
            pos++;
        
        let favLength = 0;
        for (const appGroup of currentWorkspace.appGroups) {
            if(appGroup.groupState.isFavoriteApp)
                favLength++;
            else break;
        }

        // keep pinned and unpinned items separate
        if((this.state.dragging.isForeign && pos > favLength) ||
            (!this.state.dragging.isForeign && source.groupState.isFavoriteApp && pos >= favLength) ||
            (!this.state.dragging.isForeign && !source.groupState.isFavoriteApp && pos < favLength))
            return DND.DragMotionResult.NO_DROP;

        // handle position change
        if (pos !== this.state.dragging.pos) {
            this.state.dragging.pos = pos;

            if(this.state.dragging.isForeign) {
                if (this.state.dragging.dragPlaceholder)
                    currentWorkspace.actor.set_child_at_index(this.state.dragging.dragPlaceholder.actor, pos);
                else {
                    const iconSize = this.getPanelIconSize() * global.ui_scale;
                    this.state.dragging.dragPlaceholder = new DND.GenericDragPlaceholderItem();
                    this.state.dragging.dragPlaceholder.child.width = iconSize;
                    this.state.dragging.dragPlaceholder.child.height = iconSize;
                    currentWorkspace.actor.insert_child_at_index(
                        this.state.dragging.dragPlaceholder.actor,
                        this.state.dragging.pos
                    );
                    this.state.dragging.dragPlaceholder.animateIn();
                }
            }
            else
                currentWorkspace.actor.set_child_at_index(source.actor, pos);
        }

        if(this.state.dragging.isForeign)
            return DND.DragMotionResult.COPY_DROP;
        return DND.DragMotionResult.MOVE_DROP;
    }

    // TODO: Figure out exactly which properties on this applet constructor the Cinnamon APIs needs for all modes of
    // DND, so we can kill the _delegate reference. Long term, a PR to Cinnamon should be opened fixing circular
    // object reference structures for the applet and desklet classes.
    acceptDrop(source, actor) {
        if (!this.state.settings.enableDragging || this.state.panelEditMode)
            return false;

        // add new launcher
        if (this.state.dragging.isForeign) {
            const pos = this.state.dragging.pos;
            this.clearDragPlaceholder();
            this.clearDragParameters();

            const appId = source.isDraggableApp ? source.get_app_id() : source.getId();
            if (appId) {
                this.acceptNewLauncher(appId, pos);
                return true;
            }
            return false;
        }

        // move existing launcher
        return this.moveLauncher(source);
    }

    clearDragParameters() {
        this.state.dragging.isForeign = null;
        this.state.dragging.posList = null;
        this.state.dragging.pos = -1;
    }

    clearDragPlaceholder(animate = false) {
        if(this.state.dragging.dragPlaceholder) {
            if(animate)
                this.state.dragging.dragPlaceholder.animateOutAndDestroy();
            else
                this.state.dragging.dragPlaceholder.actor.destroy();
            this.state.dragging.dragPlaceholder = null;
        }
    }

    handleDragOut() {
        if(this.state.dragging.isForeign) {
            this.clearDragPlaceholder(true);
            this.clearDragParameters();
        }
    }

    acceptNewLauncher(path, pos = -1) {
        this.pinnedFavorites.addFavorite({appId: path, pos: pos});
        // Need to determine why the favorites setting signal doesn't emit outside the applet actions
        this.updateFavorites();
    }

    moveLauncher(source) {
        const currentWorkspace = this.getCurrentWorkspace();
        this.clearDragParameters();

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
            currentWorkspace.updateAppGroupIndexes();

            // Refresh the group's thumbnails so hoverMenu is aware of the position change
            // In the case of dragging a group that has a delay before Cinnamon can grab its
            // thumbnail texture, e.g., LibreOffice, defer the refresh.
            if (source.groupState.metaWindows.length > 0) {
                setTimeout(() => source.groupState.trigger('windowCount'), 0);
            }

            // Handle favoriting if pin on drag is enabled
            if (!source.groupState.app.is_window_backed()) {

                const refFav = this.pinnedFavorites._favorites.findIndex(
                    favorite => favorite.id === source.groupState.appId
                );
                if (refFav > -1) {
                    
                    const pinned = []; //pinned apps found before source
                    for (const appGroup of currentWorkspace.appGroups) {
                        if(appGroup.groupState.appId == source.groupState.appId)
                            break;
                        if(!pinned.includes(appGroup.groupState.appId))
                            pinned.push(appGroup.groupState.appId);
                    }
   
                    const opts = {
                        appId: source.groupState.appId,
                        app: source.groupState.app,
                        pos : pinned.length
                    };

                    if(pinned.length != refFav)
                        this.pinnedFavorites.moveFavoriteToPos(opts);
                }
            }

            this.refreshAllWorkspaces({ exceptCurrentOne: true });

            return false;
        });

        return true;
    }

    onWorkspaceRemoved(workspaceManager, index) {
        if (this.workspaces.length <= index) {
            return;
        }
        const removedWorkspaces = [];
        for (let i = 0; i < this.workspaces.length; i++) {
            const workspaceIndex = this.workspaces[i].metaWorkspace.index();
            if (workspaceIndex === -1) {
                if (this.workspaces[i] != null) {
                    this.workspaces[i].destroy();
                    this.workspaces[i] = null;
                }
                removedWorkspaces.push(i);
            } else {
                this.workspaces[i].index = workspaceIndex;
            }
        }
        for (let i = removedWorkspaces.length - 1; i >= 0; i--) {
            this.workspaces.splice(removedWorkspaces[i], 1);
        }
        this.state.set({currentWs: global.workspace_manager.get_active_workspace_index()});
    }

    onSwitchWorkspace() {
        setTimeout(() => this._onSwitchWorkspace(), 0);
    }

    _onSwitchWorkspace() {
        if (!this.state) return;
        this.state.set({currentWs: global.workspace_manager.get_active_workspace_index()});
        const metaWorkspace = global.workspace_manager.get_workspace_by_index(this.state.currentWs);

        // If the workspace we switched to isn't in our list,
        // we need to create a Workspace for it
        let refWorkspace = this.workspaces.findIndex(
            workspace => workspace.metaWorkspace && workspace.metaWorkspace === metaWorkspace
        );

        if (refWorkspace === -1) {
            this.workspaces.push(
                new Workspace({
                    metaWorkspace: metaWorkspace,
                    state: this.state,
                    index: this.state.currentWs
                })
            );
            refWorkspace = this.workspaces.length - 1;
        }

        this.actor.remove_all_children();
        this.actor.add_child(this.workspaces[refWorkspace].actor);
        this.actor.queue_relayout();
    }

    onWindowSkipTaskbarChanged(display, metaWindow) {
        const currentWorkspace = this.getCurrentWorkspace();

        if (metaWindow.is_skip_taskbar()) {
            currentWorkspace.windowRemoved(currentWorkspace.metaWorkspace, metaWindow);
            return;
        }
        
        currentWorkspace.windowAdded(currentWorkspace.metaWorkspace, metaWindow);
    }

    onUIScaleChange() {
        this.state.set({thumbnailCloseButtonOffset: global.ui_scale > 1 ? -10 : 0});
        this.refreshAllWorkspaces();
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new GroupedWindowListApplet(metadata, orientation, panel_height, instance_id);
}
