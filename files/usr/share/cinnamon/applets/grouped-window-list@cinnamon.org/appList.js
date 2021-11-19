const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const {SignalManager} = imports.misc.signalManager;
const {each, filter, findIndex, find, unref} = imports.misc.util;
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
        this.signals.connect(global.screen, 'window-workspace-changed', (...args) => this.windowWorkspaceChanged(...args));
        // Ugly change: refresh the removed app instances from all workspaces
        this.signals.connect(global.screen, 'window-removed', (...args) => this.windowRemoved(...args));
        this.signals.connect(this.metaWorkspace, 'window-removed', (...args) => this.windowRemoved(...args));
        this.signals.connect(global.window_manager, 'switch-workspace' , (...args) => this.reloadList(...args));
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

    getWindowCount(appId) {
        let windowCount = 0;
        each(this.appList, function(appGroup) {
            if (appGroup.groupState.appId !== appId) return;
            windowCount += appGroup.groupState.metaWindows.length;
        });
        return windowCount;
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

        if (lastCycled < 0) {
            lastCycled = findIndex(this.appList, (app) => {
                return app.groupState.appId === this.listState.lastFocusedApp;
            });
        }

        if (lastCycled < 0 || lastCycled > this.appList.length - 1) {
            lastCycled = 0;
        }

        let refApp = this.appList[lastCycled];

        lastCycled++;
        this.state.set({lastCycled});

        if (refApp.groupState.metaWindows.length !== 0) { // open hoverMenu if app has windows
            this.closeAllHoverMenus()

            refApp.groupState.set({thumbnailMenuEntered: true});
            if (!refApp.hoverMenu) {
                refApp.initThumbnailMenu();
            }
            refApp.hoverMenu.open(true);

            let lastCycledTime = this.lastCycledTime;
            setTimeout(() => {
                if (lastCycledTime === this.lastCycledTime) {
                    if (refApp.hoverMenu.shouldClose) { // do not close hoverMenu if user is using it
                        refApp.hoverMenu.close();
                    }
                    this.state.set({lastCycled: -1});
                }
            }, 2000)
        } else {
            this.cycleMenus(r + 1);
        }
    }

    reloadList() {
        let windows;
        windows = this.metaWorkspace.list_windows();
        for (let i = 0, len = windows.length; i < len; i++) {
            this.windowAdded(this.metaWorkspace, windows[i]);
        }
    }

    refreshList() {
        for (let i = 0, len = this.appList.length; i < len; i++) {
            this.appList[i].destroy();
            this.appList[i] = null;
        }
        this.appList = [];
        this.loadFavorites();
        this.refreshApps();
    }

    loadFavorites() {
        const favorites = this.state.trigger('getFavorites');
        const appSystem = this.state.trigger('getAppSystem');
        for (let i = 0; i < favorites.length; i++) {
            let app = appSystem.lookup_app(favorites[i].id);
            if (!app) continue;

            let appWindows = filter(app.get_windows(), (metaWindow) => this.shouldWindowBeAdded(metaWindow));

            if (appWindows.length === 0) {
                this.windowAdded(this.metaWorkspace, null, app, true);
                continue;
            }

            for (let i = 0; i < appWindows.length; i++) {
                this.windowAdded(this.metaWorkspace, appWindows[i], app, true);
            }
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
        && Main.isInteresting(metaWindow)
        && this.state.monitorWatchList.indexOf(metaWindow.get_monitor()) > -1;
    }

    windowWorkspaceChanged(screen, metaWorkspace, metaWindow) {
        this.windowAdded(metaWindow, metaWorkspace);
    }

    windowAdded(metaWorkspace, metaWindow, app, isFavoriteApp) {
        if (!this.state) return;

        if (metaWindow && !this.shouldWindowBeAdded(metaWindow)) return;

        if (metaWindow
            && this.state.appletReady
            && this.state.settings.showAllWorkspaces
            && !this.state.addingWindowToWorkspaces) {
            this.state.addingWindowToWorkspaces = true;
            this.state.trigger('addWindowToAllWorkspaces', metaWindow, app, isFavoriteApp);
        }
        // Check to see if the window that was added already has an app group.
        // If it does, then we don't need to do anything.  If not, we need to
        // create an app group.
        if (!app) {
            app = this.state.trigger('getAppFromWindow', metaWindow);
        }
        if (!app
            || (!isFavoriteApp
                && metaWindow
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

        let initApp = () => {
            let appGroup = new AppGroup({
                state: this.state,
                listState: this.listState,
                app,
                isFavoriteApp,
                metaWorkspace,
                metaWindow,
                appId
            });
            this.actor.add_child(appGroup.actor);
            this.appList.push(appGroup);
            appGroup.windowAdded(metaWindow);
        };

        if (refApp === -1) {
            initApp(metaWindow);
        } else if (metaWindow) {
            if (this.state.settings.groupApps) {
                this.appList[refApp].windowAdded(metaWindow);
            } else if (transientFavorite && this.appList[refApp].groupState.metaWindows.length === 0) {
                this.appList[refApp].windowAdded(metaWindow);
            } else if (refWindow === -1) {
                initApp();
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

        if ((metaWindow.is_on_all_workspaces() || this.state.settings.showAllWorkspaces
            || !this.state.settings.showAllWorkspaces)
            && !this.state.removingWindowFromWorkspaces) {
            // Abort the remove if the window is just changing workspaces, window
            // should always remain indexed on all workspaces while its mapped.
            // if (!metaWindow.showing_on_its_workspace()) return;
            if ((this.state.settings.showAllWorkspaces) && (metaWindow.has_focus()
            && global.screen.get_active_workspace_index()
            !== metaWorkspace.index())) return;
            this.state.removingWindowFromWorkspaces = true;
            this.state.trigger('removeWindowFromAllWorkspaces', metaWindow);
            return;
        }

        let refApp = -1, refWindow = -1;
        each(this.appList, (appGroup, i) => {
            let shouldReturn = false;
            each(appGroup.groupState.metaWindows, (win, z) => {
                if (win === metaWindow) {
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
                if (isFavoriteApp) {
                    if (this.state.settings.groupApps || this.getWindowCount(appId) === 0) {
                        this.appList[refApp].groupState.set({groupReady: false, lastFocused: null});
                        this.appList[refApp].actor.set_style_pseudo_class('closed');
                        this.appList[refApp].actor.remove_style_class_name('grouped-window-list-item-demands-attention');
                        this.appList[refApp].setActiveStatus(false);
                        if (this.state.settings.titleDisplay > 1) {
                            this.appList[refApp].hideLabel();
                        }
                    } else {
                        // pinned app closed in ungrouped-windows mode and another instance of app already exists in appList
                        // move other instance to original apps' position

                        let refAppId = this.appList[refApp].groupState.appId;

                        this.appList[refApp].destroy(true);
                        this.appList[refApp] = undefined;
                        this.appList.splice(refApp, 1);

                        let otherApp = findIndex(this.appList, (appGroup) => appGroup.groupState.appId === refAppId);
                        let otherAppObject = this.appList[otherApp]

                        // in edge case when multiple apps of the same program are favorited, do not move other app
                        if(!otherAppObject.groupState.isFavoriteApp) {
                            this.appList.splice(otherApp, 1);
                            this.actor.set_child_at_index(otherAppObject.actor, refApp);
                            this.appList.splice(refApp, 0, otherAppObject);

                            // change previously unpinned app status to pinned
                            otherAppObject.groupState.isFavoriteApp = true;
                        }
                    }
                } else {
                    this.appList[refApp].destroy(true);
                    this.appList[refApp] = undefined;
                    this.appList.splice(refApp, 1);
                }
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
