const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const {SignalManager} = imports.misc.signalManager;
const {each, findIndex, find, unref} = imports.misc.util;
const {createStore} = imports.misc.state;

const AppGroup = require('./appGroup');
const {RESERVE_KEYS} = require('./constants');

class AppList {
    constructor(params) {
        this.state = params.state;
        this.state.connect({
            orientation: () => this.on_orientation_changed(false)
        });
        this.listState = createStore({
            workspaceIndex: params.index,
            lastFocusedApp: null
        });
        this.listState.connect({
            getWorkspace: () => this.metaWorkspace,
            updateAppGroupIndexes: () => this.updateAppGroupIndexes(),
            closeAllRightClickMenus: (cb) => this.closeAllRightClickMenus(cb),
            closeAllHoverMenus: (cb) => this.closeAllHoverMenus(cb),
            windowAdded: (win) => this.windowAdded(this.metaWorkspace, win),
            windowRemoved: (win) => this.windowRemoved(this.metaWorkspace, win),
            removeChild: (actor) => {
                if (this.state.willUnmount) {
                    return;
                }
                this.actor.remove_child(actor);
            },
            updateFocusState: (focusedAppId) => {
                each(this.appList, (appGroup) => {
                    if (focusedAppId === appGroup.groupState.appId) return;
                    appGroup.onFocusChange(false);
                });
            }
        });

        this.signals = new SignalManager(null);
        this.metaWorkspace = params.metaWorkspace;

        const managerOrientation = this.state.isHorizontal ? 'HORIZONTAL' : 'VERTICAL';
        this.manager = new Clutter.BoxLayout({orientation: Clutter.Orientation[managerOrientation]});
        this.actor = new Clutter.Actor({layout_manager: this.manager});

        this.appList = [];
        this.lastFocusedApp = null;

        // Connect all the signals
        this.signals.connect(this.metaWorkspace, 'window-added', (...args) => this.windowAdded(...args));
        this.signals.connect(this.metaWorkspace, 'window-removed', (...args) => this.windowRemoved(...args));
        this.on_orientation_changed(null, true);
    }

    on_orientation_changed() {
        if (!this.manager) return;

        if (!this.state.isHorizontal) {
            this.manager.set_orientation(Clutter.Orientation.VERTICAL);
            this.actor.set_x_align(Clutter.ActorAlign.CENTER);
        } else {
            this.manager.set_orientation(Clutter.Orientation.HORIZONTAL);
        }
        this.refreshList();
    }

    closeAllHoverMenus(cb) {
        for (let i = 0, len = this.appList.length; i < len; i++) {
            let {hoverMenu, groupState} = this.appList[i];
            if (hoverMenu && hoverMenu.isOpen) {
                groupState.set({thumbnailMenuEntered: false});
                hoverMenu.close(true);
            }
        }
        if (typeof cb === 'function') cb();
    }

    closeAllRightClickMenus(cb) {
        for (let i = 0, len = this.appList.length; i < len; i++) {
            if (typeof this.appList[i].rightClickMenu !== 'undefined' && this.appList[i].rightClickMenu.isOpen) {
                this.appList[i].rightClickMenu.close();
            }
        }
        if (typeof cb === 'function') cb();
    }

    onAppKeyPress(number) {
        if (!this.appList[number - 1]) return;
        this.appList[number - 1].onAppKeyPress(number);
    }

    onNewAppKeyPress(number) {
        if (number > this.appList.length) return;
        this.appList[number - 1].launchNewInstance();
    }

    showAppsOrder() {
        for (let i = 0, len = this.appList.length; i < len; i++) {
            this.appList[i].showOrderLabel(i);
        }
        setTimeout(() => this.calcAllWindowNumbers(), this.state.settings.showAppsOrderTimeout);
    }

    cycleMenus(r = 0) {
        if (r > this.appList.length) {
            this.state.set({lastCycled: -1});
            return;
        }

        let {lastCycled} = this.state;
        this.lastCycledTime = Date.now();
        this.closeAllHoverMenus();

        if (lastCycled < 0) {
            lastCycled = findIndex(this.appList, (app) => {
                return app.groupState.appId === this.listState.lastFocusedApp;
            });
        }

        if (lastCycled < 0 || lastCycled > this.appList.length - 1) lastCycled = 0;

        this.appList[lastCycled].groupState.set({thumbnailMenuEntered: true});
        if (!this.appList[lastCycled].hoverMenu) this.appList[lastCycled].initThumbnailMenu();
        this.appList[lastCycled].hoverMenu.open(true);

        lastCycled++;
        this.state.set({lastCycled});

        if (this.appList[lastCycled - 1].groupState.metaWindows.length === 0) {
            this.cycleMenus(r + 1);
        }


        let lastCycledTime = this.lastCycledTime;
        setTimeout(() => {
            if (lastCycledTime === this.lastCycledTime) {
                this.state.set({lastCycled: -1});
            }
        }, 2000)
    }

    updateSpacing() {
        each(this.appList, function(appGroup) {
            appGroup.setMargin();
        });
    }

    // Gets a list of every app on the current workspace
    getSpecialApps() {
        this.specialApps = [];
        let apps = Gio.app_info_get_all();

        for (let i = 0, len = apps.length; i < len; i++) {
            let wmClass = apps[i].get_startup_wm_class();
            if (wmClass) {
                let id = apps[i].get_id();
                this.specialApps.push({id, wmClass});
            }
        }
    }

    refreshList() {
        for (let i = 0, len = this.appList.length; i < len; i++) {
            this.appList[i].destroy();
            this.appList[i] = null;
        }
        this.appList = [];
        this.getSpecialApps();
        this.loadFavorites();
        this.refreshApps();
    }

    loadFavorites() {
        if (!this.state.settings.showPinned) {
            return;
        }
        const favorites = this.state.trigger('getFavorites');
        const appSystem = this.state.trigger('getAppSystem');
        for (let i = 0; i < favorites.length; i++) {
            let app = appSystem.lookup_app(favorites[i].id);
            if (!app) {
                app = appSystem.lookup_settings_app(favorites[i].id);
            }
            if (!app) continue;

            this.windowAdded(this.metaWorkspace, null, app, true);
        }
    }

    refreshApps() {
        let windows;
        if (this.state.settings.showAllWorkspaces) {
            windows = global.display.list_windows(0);
        } else {
            windows = this.metaWorkspace.list_windows();
        }

        for (let i = 0, len = windows.length; i < len; i++) {
            this.windowAdded(this.metaWorkspace, windows[i]);
        }
    }

    updateAttentionState(display, window) {
        each(this.appList, (appGroup) => {
            if (appGroup.groupState.metaWindows) {
                appGroup.onWindowDemandsAttention(window);
            }
            if (appGroup.hoverMenu && appGroup.hoverMenu.isOpen) {
                each(appGroup.hoverMenu.appThumbnails, (thumbnail) => {
                    thumbnail.onWindowDemandsAttention(window);
                    return false;
                });
            }
        });
    }

    shouldWindowBeAdded(metaWindow) {
        return (this.state.settings.showAllWorkspaces
            || metaWindow.is_on_all_workspaces()
            || metaWindow.get_workspace() === this.metaWorkspace)
        && !metaWindow.is_skip_taskbar()
        && (!this.state.settings.listMonitorWindows
            || this.state.monitorWatchList.indexOf(metaWindow.get_monitor()) > -1);
    }

    windowAdded(metaWorkspace, metaWindow, app, isFavoriteApp) {
        if (!this.state) return;

        if (this.state.appletReady && this.state.settings.showAllWorkspaces && metaWindow && !metaWindow.__gwlInit__) {
            metaWindow.__gwlInit__ = true;
            this.state.trigger('addWindowToAllWorkspaces', metaWindow, app, isFavoriteApp);
        }
        // Check to see if the window that was added already has an app group.
        // If it does, then we don't need to do anything.  If not, we need to
        // create an app group.
        if (!app) {
            app = this.state.trigger('getAppFromWMClass', this.specialApps, metaWindow);
        }
        if (!app) {
            let tracker = this.state.trigger('getTracker');
            if (tracker) {
                app = tracker.get_window_app(metaWindow);
            }
        }
        if (!app
            || (!isFavoriteApp
                && metaWindow
                && this.state.settings.listMonitorWindows
                && this.state.monitorWatchList.indexOf(metaWindow.get_monitor()) === -1)) {
            return;
        }

        let appId = app.get_id(),
            refApp = -1,
            refWindow = -1,
            transientFavorite = false;

        each(this.appList, (appGroup, i) => {
            if (app === appGroup.groupState.app) {
                refApp = i;
            }
            let ref = appGroup.groupState.metaWindows.indexOf(metaWindow);
            if (ref > -1) {
                if (refApp === -1 || !this.state.settings.groupApps) {
                    refApp = i;
                }
                refWindow = ref;
                return false;
            }
        });

        if (!this.state.settings.groupApps && !isFavoriteApp) {
            let refFav = findIndex(this.state.trigger('getFavorites'), (favorite) => {
                return favorite.app === app;
            });
            if (refFav > -1) transientFavorite = true;
        }

        let initApp = (metaWindows, window) => {
            let appGroup = new AppGroup({
                state: this.state,
                listState: this.listState,
                app,
                isFavoriteApp,
                metaWorkspace,
                metaWindows,
                metaWindow,
                appId
            });
            this.actor.add_child(appGroup.actor);
            this.appList.push(appGroup);

            if (this.state.settings.groupApps && metaWindows.length > 0) {
                each(metaWindows, (win) => {
                    appGroup.windowAdded(win, metaWindows);
                });
            } else {
                appGroup.windowAdded(window);
            }
        };

        if (refApp === -1) {
            let _appWindows = app.get_windows();
            let appWindows = [];

            for (let i = 0; i < _appWindows.length; i++) {
                if (this.shouldWindowBeAdded(_appWindows[i])) {
                    appWindows.push(_appWindows[i]);
                }
            }

            if (this.state.settings.groupApps) {
                initApp(appWindows);
            } else {
                if (appWindows.length > 0) {
                    each(appWindows, (win) => {
                        initApp([win], win);
                    });
                } else {
                    initApp([], null);
                }
            }
        } else if (metaWindow && this.shouldWindowBeAdded(metaWindow)) {
            if (this.state.settings.groupApps) {
                this.appList[refApp].windowAdded(metaWindow, null);
            } else if (transientFavorite && this.appList[refApp].groupState.metaWindows.length === 0) {
                this.appList[refApp].windowAdded(metaWindow, [metaWindow]);
            } else if (refWindow === -1) {
                initApp([metaWindow], metaWindow);
            }
        }
    }

    calcAllWindowNumbers() {
        for (let i = 0, len = this.appList.length; i < len; i++) {
            this.appList[i].calcWindowNumber(this.appList[i].groupState.metaWindows);
        }
    }

    updateAppGroupIndexes() {
        const newAppList = [];
        let children = this.actor.get_children();
        for (let i = 0; i < children.length; i++) {
            let appGroup = find(this.appList, (appGroup) => appGroup.actor === children[i]);
            if (appGroup) {
                newAppList.push(appGroup);
            }
        }
        this.appList = newAppList;
    }

    windowRemoved(metaWorkspace, metaWindow) {
        if (!this.state) return;

        if ((metaWindow.is_on_all_workspaces() || this.state.settings.showAllWorkspaces)
            && !metaWindow.__gwlFinalize__) {
            metaWindow.__gwlFinalize__ = true;
            this.state.trigger('removeWindowFromAllWorkspaces', metaWindow);
            return;
        }

        let wmClass = metaWindow.get_wm_class(),
            refApp = -1,
            refWindow = -1,
            windowCount = 0;

        each(this.appList, (appGroup, i) => {
            let shouldReturn = false;
            each(appGroup.groupState.metaWindows, (win, z) => {
                if (win.get_wm_class() === wmClass) {
                    ++windowCount;
                }
                if (win === metaWindow) {
                    ++windowCount;
                    refApp = i;
                    refWindow = z;
                    shouldReturn = this.state.settings.groupApps;
                    return false;
                }
            });
            if (shouldReturn) {
                return false;
            }
        });
        if (refApp > -1) {
            this.appList[refApp].windowRemoved(metaWorkspace, metaWindow, refWindow, (appId, isFavoriteApp) => {
                if (isFavoriteApp || (isFavoriteApp && !this.state.settings.groupApps && windowCount === 0)) {
                    this.appList[refApp].groupState.set({groupReady: false});
                    this.appList[refApp].actor.set_style_pseudo_class('closed');
                    this.appList[refApp].actor.remove_style_class_name('grouped-window-list-item-demands-attention');
                    if (this.state.settings.titleDisplay > 1) {
                        this.appList[refApp].hideLabel(true);
                    }
                    return;
                }
                this.appList[refApp].destroy(true);
                this.appList[refApp] = undefined;
                this.appList.splice(refApp, 1);
            });
        }
    }

    destroy() {
        this.signals.disconnectAllSignals();
        for (let i = 0, len = this.appList.length; i < len; i++) {
            this.appList[i].destroy();
        }
        this.listState.destroy();
        this.manager = null;
        this.actor.destroy();
        unref(this, RESERVE_KEYS);
    }
}

module.exports = AppList;
