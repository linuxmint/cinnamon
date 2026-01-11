const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
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
            orientation: (state) => {
                this.on_orientation_changed(state.orientation);
            }
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
                this.container.remove_child(actor);
                this.updateScrollVisibility();
            },
            updateFocusState: (focusedAppId) => {
                this.appGroups.forEach( appGroup => {
                    if (focusedAppId === appGroup.groupState.appId) {
                        this.scrollToAppGroup(appGroup);
                        return;
                    };
                    appGroup.onFocusChange(false);
                });
            }
        });

        this.signals = new SignalManager(null);
        this.metaWorkspace = params.metaWorkspace;

        const managerOrientation = this.state.isHorizontal ? Clutter.Orientation.HORIZONTAL : Clutter.Orientation.VERTICAL;

        this.manager = new Clutter.BoxLayout({orientation: managerOrientation});
        this.container = new Clutter.Actor({layout_manager: this.manager});

        this.mainLayout = new Clutter.BoxLayout({orientation: managerOrientation});
        this.actor = new Clutter.Actor({ layout_manager: this.mainLayout, reactive: true });

        // TODO: Move to Cinnamon default CSS styling
        const shadeStyle = 'min-width: 15px; min-height: 20px; background-color: rgba(0, 0, 0, 0.25); border: 1px solid rgba(128, 128, 128, 0.2); margin: 0px; padding: 0px;';

        this.startButton = new St.Bin({
            style_class: 'grouped-window-list-scroll-button-start',
            style: shadeStyle,
            visible: false,
            reactive: true,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });
        this.endButton = new St.Bin({
            style_class: 'grouped-window-list-scroll-button-end',
            style: shadeStyle,
            visible: false,
            reactive: true,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });

        // XXX: Use fixed icon size instead of the popup-menu-icon style class? (or maybe set the default in the cinnamon default theme)
        this.startIcon = new St.Icon({
            icon_name: 'pan-start-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            style_class: 'popup-menu-icon grouped-window-list-scroll-button-icon'
        });
        this.endIcon = new St.Icon({
            icon_name: 'pan-end-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            style_class: 'popup-menu-icon grouped-window-list-scroll-button-icon'
        });

        this.startButton.set_child(this.startIcon);
        this.endButton.set_child(this.endIcon);

        this.signals.connect(this.startButton, 'enter-event', () => this.startSlide(-1));
        this.signals.connect(this.startButton, 'leave-event', this.stopSlide, this);
        this.signals.connect(this.endButton, 'enter-event', () => this.startSlide(1));
        this.signals.connect(this.endButton, 'leave-event', this.stopSlide, this);

        this.scrollBox = new Clutter.Actor({ clip_to_allocation: true });
        this.scrollBox.add_child(this.container);

        this.actor.add_child(this.startButton);
        this.actor.add_child(this.scrollBox);
        this.actor.add_child(this.endButton);

        this.scrollBox.set_x_expand(true);
        this.scrollBox.set_y_expand(true);

        this.appGroups = [];
        this.lastFocusedApp = null;
        this.slideTimerSourceId = 0;

        // Connect all the signals
        this.signals.connect(global.display, 'window-workspace-changed', (...args) => this.windowWorkspaceChanged(...args));
        // Ugly change: refresh the removed app instances from all workspaces
        this.signals.connect(this.metaWorkspace, 'window-removed', (...args) => this.windowRemoved(...args));
        this.signals.connect(global.window_manager, 'switch-workspace' , (...args) => this.reloadList(...args));
        this.signals.connect(this.actor, 'allocation-changed', this.updateScrollVisibility, this);
        this.signals.connect(this.container, 'allocation-changed', this.updateScrollVisibility, this);
        this.signals.connect(this.container, 'notify::translation-x', this.updateScrollVisibility, this);
        this.signals.connect(this.container, 'notify::translation-y', this.updateScrollVisibility, this);
        this.signals.connect(this.actor, 'scroll-event', (actor, event) => this.onScroll(event));

        this.on_orientation_changed(this.state.orientation);
    }

    on_orientation_changed(orientation) {
        if (!this.manager) return;

        const managerOrientation = this.state.isHorizontal ? Clutter.Orientation.HORIZONTAL : Clutter.Orientation.VERTICAL;

        this.manager.set_orientation(managerOrientation);
        this.mainLayout.set_orientation(managerOrientation);

        if (this.state.isHorizontal) {
            this.actor.set_x_align(Clutter.ActorAlign.FILL);

            this.startIcon.set_icon_name('pan-start-symbolic');
            this.endIcon.set_icon_name('pan-end-symbolic');

            this.startButton.set_x_expand(false);
            this.startButton.set_y_expand(true);
            this.startButton.set_y_align(Clutter.ActorAlign.FILL);
            this.endButton.set_x_expand(false);
            this.endButton.set_y_expand(true);
            this.endButton.set_y_align(Clutter.ActorAlign.FILL);
        } else {
            this.actor.set_x_align(Clutter.ActorAlign.CENTER);

            this.startIcon.set_icon_name('pan-up-symbolic');
            this.endIcon.set_icon_name('pan-down-symbolic');

            this.startButton.set_x_expand(true);
            this.startButton.set_y_expand(false);
            this.startButton.set_x_align(Clutter.ActorAlign.FILL);
            this.endButton.set_x_expand(true);
            this.endButton.set_y_expand(false);
            this.endButton.set_x_align(Clutter.ActorAlign.FILL);
        }
        this.refreshList();
    }

    startSlide(direction) {
        if (this.slideTimerSourceId > 0) {
            GLib.source_remove(this.slideTimerSourceId);
            this.slideTimerSourceId = 0;
        }

        const scrollFunc = () => {
            this.scroll(direction * 5);
            if (this.slideTimerSourceId === 0) return GLib.SOURCE_REMOVE;

            // Check if reached bounds to stop timer
            let current, min;
            if (this.state.isHorizontal) {
                current = this.container.translation_x;
                min = Math.min(0, this.scrollBox.width - this.container.width);
            } else {
                current = this.container.translation_y;
                min = Math.min(0, this.scrollBox.height - this.container.height);
            }

            if (current >= 0 && direction < 0) return GLib.SOURCE_REMOVE; // At start, trying to go start
            if (current <= min && direction > 0) return GLib.SOURCE_REMOVE; // At end, trying to go end

            return GLib.SOURCE_CONTINUE;
        };

        this.slideTimerSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, scrollFunc);
    }

    stopSlide() {
        if (this.slideTimerSourceId > 0) {
            GLib.source_remove(this.slideTimerSourceId);
            this.slideTimerSourceId = 0;
        }
    }

    onScroll(event) {
        let containerSize, scrollBoxSize;
        if (this.state.isHorizontal) {
            containerSize = this.container.get_preferred_width(-1)[1];
            scrollBoxSize = this.scrollBox.width;
        } else {
            containerSize = this.container.get_preferred_height(-1)[1];
            scrollBoxSize = this.scrollBox.height;
        }

        if (containerSize <= scrollBoxSize) return Clutter.EVENT_PROPAGATE;

        const direction = event.get_scroll_direction();
        let delta = 0;

        if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            delta = this.state.isHorizontal ? dx : dy;
            delta *= 15; // Scale smooth scroll
        } else {
            const step = 20;
            if (direction === Clutter.ScrollDirection.UP || direction === Clutter.ScrollDirection.LEFT) {
                delta = -step;
            } else if (direction === Clutter.ScrollDirection.DOWN || direction === Clutter.ScrollDirection.RIGHT) {
                delta = step;
            }
        }

        if (delta !== 0) {
            this.scroll(delta);
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    scroll(amount) {
        let current, min, next;
        if (this.state.isHorizontal) {
            current = this.container.translation_x;
            min = Math.min(0, this.scrollBox.width - this.container.width);
            next = current - amount;
        } else {
            current = this.container.translation_y;
            min = Math.min(0, this.scrollBox.height - this.container.height);
            next = current - amount;
        }

        if (next > 0) next = 0;
        if (next < min) next = min;

        if (this.state.isHorizontal) this.container.translation_x = next;
        else this.container.translation_y = next;
    }

    scrollToAppGroup(appGroup) {
        if (this.scrollToAppDebounceTimeoutId) GLib.source_remove(this.scrollToAppDebounceTimeoutId);
        this.scrollToAppDebounceTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this._scrollToAppGroup(appGroup);
            return GLib.SOURCE_REMOVE;
        });
    }

    _scrollToAppGroup(appGroup) {
        if (!appGroup || !appGroup.actor) return;

        const index = this.appGroups.indexOf(appGroup);
        if (index === -1) return;

        const isHorizontal = this.state.isHorizontal;
        let itemPos = 0;
        let itemSize = 0;

        for (let i = 0; i <= index; i++) {
            const actor = this.appGroups[i].actor;
            if (isHorizontal) {
                itemSize = actor.width > 0 ? actor.width : actor.get_preferred_width(-1)[1];
            } else {
                itemSize = actor.height > 0 ? actor.height : actor.get_preferred_height(-1)[1];
            }
            itemPos += itemSize;
        }

        const boxSize = isHorizontal ? this.scrollBox.width : this.scrollBox.height;

        let containerSize;
        if (isHorizontal) {
            containerSize = this.container.width > 0 ? this.container.width : this.container.get_preferred_width(-1)[1];
        } else {
            containerSize = this.container.height > 0 ? this.container.height : this.container.get_preferred_height(-1)[1];
        }

        // Subtract half size to get center.
        const targetCenter = itemPos - (itemSize / 2);
        // We want targetCenter to be at boxSize / 2
        let newPos = (boxSize / 2) - targetCenter;

        const minPos = Math.min(0, boxSize - containerSize);
        newPos = Math.round(Math.max(minPos, Math.min(newPos, 0)));

        if (isHorizontal) {
            this.container.translation_x = newPos;
        } else {
            this.container.translation_y = newPos;
        }
    }

    updateScrollVisibility() {
        let containerSize, scrollBoxSize;

        if (this.state.isHorizontal) {
            containerSize = this.container.width > 0 ? this.container.width : this.container.get_preferred_width(-1)[1];
            scrollBoxSize = this.scrollBox.width;
        } else {
            containerSize = this.container.height > 0 ? this.container.height : this.container.get_preferred_height(-1)[1];
            scrollBoxSize = this.scrollBox.height;
        }

        let minTranslation = Math.min(0, scrollBoxSize - containerSize);
        let currentTranslation = this.state.isHorizontal ? this.container.translation_x : this.container.translation_y;

        // Clamp translation if bounds have changed (resizing, etc)
        if (currentTranslation < minTranslation) {
            currentTranslation = minTranslation;
            if (this.state.isHorizontal) this.container.translation_x = currentTranslation;
            else this.container.translation_y = currentTranslation;
        }

        if (containerSize > scrollBoxSize) {
            // Tolerance of 1 pixel to avoid flickering
            this.startButton.visible = currentTranslation < -1;
            this.endButton.visible = currentTranslation > minTranslation + 1;
        } else {
            this.startButton.visible = false;
            this.endButton.visible = false;

            if (currentTranslation !== 0) {
                if (this.state.isHorizontal) this.container.translation_x = 0;
                else this.container.translation_y = 0;
            }
        }
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
        this.scrollToFocusedApp();
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

    scrollToFocusedApp() {
        for (let appGroup of this.appGroups) {
            if (appGroup.groupState.lastFocused && appGroup.groupState.lastFocused.has_focus()) {
                this.scrollToAppGroup(appGroup);
                return;
            }
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
                this.container.insert_child_at_index(appGroup.actor, idx);
                this.appGroups.splice(idx, 0, appGroup);
            }
            else {
                this.container.add_child(appGroup.actor);
                this.appGroups.push(appGroup);
            }
            this.updateScrollVisibility();
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
            appGroup.calcWindowNumber();
        });
    }

    updateAppGroupIndexes() {
        const newAppGroups = [];
        this.container.get_children().forEach( child => {
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
                            this.container.set_child_at_index(otherAppObject.actor, refApp);
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
