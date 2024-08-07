const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const {SignalManager} = imports.misc.signalManager;
const {unref} = imports.misc.util;

const createStore = require('./state');
const AppGroup = require('./appGroup');
const {RESERVE_KEYS} = require('./constants');

class Workspace {
    constructor(params) {
        this.state = params.state;
        this.state.connect({
            orientation: () => this.on_orientation_changed(false)
        });
        this.workspaceState = createStore({
            workspaceIndex: params.index,
            lastFocusedApp: null
        });
        this.workspaceState.connect({
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
                this.appGroups.forEach( appGroup => {
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

        this.appGroups = [];
        this.lastFocusedApp = null;

        // Connect all the signals
        this.signals.connect(global.display, 'window-workspace-changed', (...args) => this.windowWorkspaceChanged(...args));
        // Ugly change: refresh the removed app instances from all workspaces
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
        this.appGroups.forEach( appGroup => {
            if (appGroup.groupState.appId !== appId) return;
            windowCount += appGroup.groupState.metaWindows.length;
        });
        return windowCount;
    }

    closeAllHoverMenus(cb) {
        this.appGroups.forEach( appGroup => {
            const {hoverMenu, groupState} = appGroup;
            if (hoverMenu && hoverMenu.isOpen) {
                groupState.set({thumbnailMenuEntered: false});
                hoverMenu.close(true);
            }
        });
        if (typeof cb === 'function') cb();
    }

    closeAllRightClickMenus(cb) {
        this.appGroups.forEach( appGroup => {
            if (typeof appGroup.rightClickMenu !== 'undefined' && appGroup.rightClickMenu.isOpen) {
                appGroup.rightClickMenu.close();
            }
        });
        if (typeof cb === 'function') cb();
    }

    onAppKeyPress(number) {
        if (!this.appGroups[number - 1]) return;
        this.appGroups[number - 1].onAppKeyPress(number);
    }

    onNewAppKeyPress(number) {
        if (number > this.appGroups.length) return;
        this.appGroups[number - 1].launchNewInstance();
    }

    showAppsOrder() {
        for (let i = 0, len = this.appGroups.length; i < len; i++) {
            this.appGroups[i].showOrderLabel(i);
        }
        setTimeout(() => this.calcAllWindowNumbers(), this.state.settings.showAppsOrderTimeout);
    }

    cycleMenus(r = 0) {
        if (r > this.appGroups.length) {
            this.state.set({lastCycled: -1});
            return;
        }

        let {lastCycled} = this.state;
        this.lastCycledTime = Date.now();

        if (lastCycled < 0) {
            lastCycled = this.appGroups.findIndex(
                appGroup => appGroup.groupState.appId === this.workspaceState.lastFocusedApp
            );
        }

        if (lastCycled < 0 || lastCycled > this.appGroups.length - 1) {
            lastCycled = 0;
        }

        const refApp = this.appGroups[lastCycled];

        lastCycled++;
        this.state.set({lastCycled});

        if (refApp.groupState.metaWindows.length !== 0) { // open hoverMenu if app has windows
            this.closeAllHoverMenus()

            refApp.groupState.set({thumbnailMenuEntered: true});
            if (!refApp.hoverMenu) {
                refApp.initThumbnailMenu();
            }
            refApp.hoverMenu.open(true);

            const lastCycledTime = this.lastCycledTime;
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
        const windows = this.metaWorkspace.list_windows();

        for (let i = 0, len = windows.length; i < len; i++) {
            this.windowAdded(this.metaWorkspace, windows[i]);
        }
    }

    refreshList() {
        this.appGroups.forEach( appGroup => {
            appGroup.destroy();
            appGroup = null;
        });
        this.appGroups = [];
        this.loadFavorites();
        this.refreshApps();
    }

    loadFavorites() {
        const favorites = this.state.trigger('getFavorites');
        const appSystem = this.state.trigger('getAppSystem');
        for (let i = 0; i < favorites.length; i++) {
            const app = appSystem.lookup_app(favorites[i].id);
            if (!app) continue;

            const appWindows = app.get_windows().filter(
                metaWindow => this.shouldWindowBeAdded(metaWindow)
            );

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
        this.appGroups.forEach( appGroup => {
            if (appGroup.groupState.metaWindows) {
                appGroup.onWindowDemandsAttention(window);
            }

            if (appGroup.hoverMenu) {
                const thumbnail = appGroup.hoverMenu.appThumbnails.find(
                    thumbnail => thumbnail.metaWindow === window
                );
                if (thumbnail) {
                    thumbnail.setThumbnailDemandsAttention(true);
                }
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

    windowWorkspaceChanged(display, metaWorkspace, metaWindow) {
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

        let refApp = -1,
            refWindow = -1,
            transientFavorite = false;

        for (let i = 0; i < this.appGroups.length; i++) {
            if (app === this.appGroups[i].groupState.app) {
                refApp = i;
            }
            const ref = this.appGroups[i].groupState.metaWindows.indexOf(metaWindow);
            if (ref > -1) {
                if (refApp === -1 || !this.state.settings.groupApps) {
                    refApp = i;
                }
                refWindow = ref;
                break;
            }
        }

        if (!this.state.settings.groupApps && !isFavoriteApp) {
            const refFav = this.state.trigger('getFavorites').findIndex(
                favorite => favorite.app === app
            );
            if (refFav > -1) {
                isFavoriteApp = true;
                transientFavorite = true; 
            } 
        }

        const initApp = (idx) => { 
            const appGroup = new AppGroup({
                state: this.state,
                workspaceState: this.workspaceState,
                app,
                isFavoriteApp,
                metaWorkspace,
                metaWindow,
                appId: app.get_id()
            });

            if(idx > -1) {
                this.actor.insert_child_at_index(appGroup.actor, idx);
                this.appGroups.splice(idx, 0, appGroup);
            }
            else {
                this.actor.add_child(appGroup.actor);
                this.appGroups.push(appGroup);
            }
            appGroup.windowAdded(metaWindow);
        };

        if (refApp === -1) {
            initApp(-1);
        } else if (metaWindow) {
            if (this.state.settings.groupApps) {
                this.appGroups[refApp].windowAdded(metaWindow);
            } else if (transientFavorite && this.appGroups[refApp].groupState.metaWindows.length === 0) {
                this.appGroups[refApp].windowAdded(metaWindow);
            } else if (refWindow === -1) {
                initApp(refApp+1);
            }
        }
    }

    calcAllWindowNumbers() {
        this.appGroups.forEach( appGroup => {
            appGroup.calcWindowNumber(appGroup.groupState.metaWindows);
        });
    }

    updateAppGroupIndexes() {
        const newAppGroups = [];
        this.actor.get_children().forEach( child => {
            const appGroup = this.appGroups.find( appGroup => appGroup.actor === child);
            if (appGroup) {
                newAppGroups.push(appGroup);
            }
        });
        this.appGroups = newAppGroups;
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
                && global.workspace_manager.get_active_workspace_index()
                !== metaWorkspace.index())) return;
            this.state.removingWindowFromWorkspaces = true;
            this.state.trigger('removeWindowFromAllWorkspaces', metaWindow);
            return;
        }

        let refWindow = -1;
        const refApp = this.appGroups.findIndex( appGroup => {
            const window = appGroup.groupState.metaWindows.findIndex( win => win === metaWindow);
            if (window > -1) {
                refWindow = window;
                return true;
            }
        });

        if (refApp > -1) {
            this.appGroups[refApp].windowRemoved(metaWorkspace, metaWindow, refWindow, (appId, isFavoriteApp) => {
                if (isFavoriteApp) {
                    if (this.state.settings.groupApps || this.getWindowCount(appId) === 0) {
                        this.appGroups[refApp].groupState.set({groupReady: false, lastFocused: null});
                        this.appGroups[refApp].actor.set_style_pseudo_class('closed');
                        this.appGroups[refApp].actor.remove_style_class_name('grouped-window-list-item-demands-attention');
                        this.appGroups[refApp].setActiveStatus(false);
                        if (this.state.settings.titleDisplay > 1) {
                            this.appGroups[refApp].hideLabel();
                        }
                    } else {
                        // pinned app closed in ungrouped-windows mode and another instance of app already exists in appGroups
                        // move other instance to original apps' position

                        const refAppId = this.appGroups[refApp].groupState.appId;

                        this.appGroups[refApp].destroy(true);
                        this.appGroups[refApp] = undefined;
                        this.appGroups.splice(refApp, 1);

                        const otherApp = this.appGroups.findIndex(
                            appGroup => appGroup.groupState.appId === refAppId
                        );
                        const otherAppObject = this.appGroups[otherApp]

                        // in edge case when multiple apps of the same program are favorited, do not move other app
                        if(!otherAppObject.groupState.isFavoriteApp) {
                            this.appGroups.splice(otherApp, 1);
                            this.actor.set_child_at_index(otherAppObject.actor, refApp);
                            this.appGroups.splice(refApp, 0, otherAppObject);

                            // change previously unpinned app status to pinned
                            otherAppObject.groupState.isFavoriteApp = true;
                        }
                    }
                } else {
                    this.appGroups[refApp].destroy(true);
                    this.appGroups[refApp] = undefined;
                    this.appGroups.splice(refApp, 1);
                }
            });
        }
    }

    destroy() {
        this.signals.disconnectAllSignals();
        this.appGroups.forEach( appGroup => appGroup.destroy() );
        this.workspaceState.destroy();
        this.manager = null;
        this.actor.destroy();
        unref(this, RESERVE_KEYS);
    }
}

module.exports = Workspace;
