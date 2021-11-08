const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const AppletManager = imports.ui.appletManager;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const PopupMenu = imports.ui.popupMenu;
const Applet = imports.ui.applet;
const SignalManager = imports.misc.signalManager;

const {each, findIndex, tryFn, unref, trySpawnCommandLine, spawn_async} = imports.misc.util;
const {
    CLOSE_BTN_SIZE,
    CLOSED_BUTTON_STYLE,
    OPACITY_OPAQUE,
    RESERVE_KEYS,
    ICON_NAMES,
    FavType,
    autoStartStrDir
} = require('./constants');

const convertRange = function(value, r1, r2) {
    return ((value - r1[0]) * (r2[1] - r2[0])) / (r1[1] - r1[0]) + r2[0];
};

const setOpacity = (peekTime, window_actor, targetOpacity, cb) => {
    const opacity = convertRange(targetOpacity, [0, 100], [0, 255]);

    const tweenConfig = {
        time: peekTime * 0.001,
        transition: 'easeOutQuad',
        opacity: opacity > 255 ? 255 : opacity
    };

    if (typeof cb === 'function') {
        tweenConfig.onComplete = cb;
    }

    Tweener.addTween(window_actor, tweenConfig);
};

class AppMenuButtonRightClickMenu extends Applet.AppletPopupMenu {
    constructor(params, orientation) {
        super(params, orientation);
        this.state = params.state;
        this.groupState = params.groupState;

        this.signals = new SignalManager.SignalManager(null);
        this.signals.connect(this, 'open-state-changed', (...args) => this.onToggled(...args));
    }

    monitorMoveWindows(i) {
        if (this.state.settings.monitorMoveAllWindows) {
            let metaWindows = this.groupState.metaWindows.slice();
            while (metaWindows.length > 0) {
                let metaWindow = metaWindows[0];
                if (metaWindow === this.groupState.lastFocused) {
                    Main.activateWindow(metaWindow, global.get_current_time());
                }
                metaWindow.move_to_monitor(i);
                metaWindows.splice(0, 1);
            }
        } else {
            this.groupState.lastFocused.move_to_monitor(i);
            Main.activateWindow(this.groupState.lastFocused, global.get_current_time());
        }
    }

    populateMenu() {
        this.signals.disconnectAllSignals();
        this.signals.connect(this, 'open-state-changed', (...args) => this.onToggled(...args));

        let item;
        let length;
        let hasWindows = this.groupState.metaWindows.length > 0;
        let isWindowBacked = this.groupState.app.is_window_backed();

        let createMenuItem = (opts = {label: '', icon: null}) => {
            if (opts.icon) {
                return new PopupMenu.PopupIconMenuItem(opts.label, opts.icon, St.IconType.SYMBOLIC);
            }
            return new PopupMenu.PopupMenuItem(opts.label);
        };

        // TODO: When no windows exist on the active workspace, but do on another,
        // we should detect those cases and offer workspace options if they are pinned. Otherwise,
        // user needs to switch workspaces just to switch the window back. This should behave this way
        // when showAllWorkspaces is disabled as well since its a UX problem.
        if (hasWindows) {
            // Monitors
            if (Main.layoutManager.monitors.length > 1) {
                let connectMonitorEvent = (item, i) => {
                    this.signals.connect(item, 'activate', () => this.monitorMoveWindows(i));
                };
                for (let i = 0, len = Main.layoutManager.monitors.length; i < len; i++) {
                    if (!this.groupState.lastFocused || i === this.groupState.lastFocused.get_monitor()) {
                        continue;
                    }
                    item = createMenuItem({
                        label: Main.layoutManager.monitors.length === 2 ?
                            _('Move to the other monitor')
                            : _('Move to monitor ') + (i + 1)
                    });
                    connectMonitorEvent(item, i);
                    this.addMenuItem(item);
                }
            }
            // Workspace
            if ((length = global.screen.n_workspaces) > 1) {
                if (this.groupState.lastFocused && this.groupState.lastFocused.is_on_all_workspaces()) {
                    item = createMenuItem({label: _('Only on this workspace')});
                    this.signals.connect(item, 'activate', () => {
                        this.groupState.lastFocused.unstick();
                        // Always index windows from all workspaces while showAllWorkspaces is enabled
                        if (this.state.settings.showAllWorkspaces) return;
                        this.state.removingWindowFromWorkspaces = true;
                        this.state.trigger('removeWindowFromOtherWorkspaces', this.groupState.lastFocused);
                    });
                    this.addMenuItem(item);
                } else {
                    item = createMenuItem({label: _('Visible on all workspaces')});
                    this.signals.connect(item, 'activate', () => {
                        this.groupState.lastFocused.stick();
                        this.state.trigger('addWindowToAllWorkspaces', this.groupState.lastFocused);
                    });
                    this.addMenuItem(item);

                    item = new PopupMenu.PopupSubMenuMenuItem(_('Move to another workspace'));
                    this.addMenuItem(item);

                    let connectWorkspaceEvent = (ws, j) => {
                        this.signals.connect(ws, 'activate', () => {
                            this.groupState.lastFocused.change_workspace(global.screen.get_workspace_by_index(j));
                        });
                    };
                    for (let i = 0; i < length; i++) {
                        // Make the index a local variable to pass to function
                        let j = i;
                        let name = Main.workspace_names[i] ? Main.workspace_names[i] : Main._makeDefaultWorkspaceName(i);
                        let menuItem = createMenuItem({label: _(name)});
                        let ws = this.groupState.lastFocused.get_workspace();

                        if (ws && i === ws.index()) {
                            menuItem.setSensitive(false);
                        }

                        connectWorkspaceEvent(menuItem, j);
                        item.menu.addMenuItem(menuItem);
                    }
                }
            }
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        // Preferences
        let subMenu = new PopupMenu.PopupSubMenuMenuItem(_('Preferences'));
        this.addMenuItem(subMenu);

        item = createMenuItem({label: _('About...'), icon: 'dialog-question'});
        this.signals.connect(item, 'activate', () => this.state.trigger('openAbout'));
        subMenu.menu.addMenuItem(item);

        item = createMenuItem({label: _('Configure...'), icon: 'system-run'});
        this.signals.connect(item, 'activate', () => this.state.trigger('configureApplet'));
        subMenu.menu.addMenuItem(item);

        item = createMenuItem({label: _("Remove '%s'").format(_("Grouped window list")), icon: 'edit-delete'});
        this.signals.connect(item, 'activate', (actor, event) => this.state.trigger('removeApplet', event));

        subMenu.menu.addMenuItem(item);
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        if (this.state.settings.showRecent) {
            // Places
            if (this.groupState.appId === 'nemo.desktop' || this.groupState.appId === 'nemo-home.desktop') {
                let subMenu = new PopupMenu.PopupSubMenuMenuItem(_('Places'));
                this.addMenuItem(subMenu);

                let defualtPlaces = this.listDefaultPlaces();
                let bookmarks = this.listBookmarks();
                let devices = this.listDevices();
                let places = [...defualtPlaces, ...bookmarks, ...devices];
                let handlePlaceLaunch = (item, i) => {
                    this.signals.connect(item, 'activate', () => places[i].launch());
                };
                for (let i = 0, len = places.length; i < len; i++) {
                    item = createMenuItem({label: _(places[i].name), icon: 'folder'});
                    handlePlaceLaunch(item, i);
                    subMenu.menu.addMenuItem(item);
                }
                this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            // Recent Files
            let recentItems = this.state.trigger('getRecentItems');
            let items = [];

            for (let i = 0, len = recentItems.length; i < len; i++) {
                let mimeType = recentItems[i].get_mime_type();
                let appInfo = Gio.app_info_get_default_for_type(mimeType, false);
                if (appInfo && this.groupState.appInfo && appInfo.get_id() === this.groupState.appId) {
                    items.push(recentItems[i]);
                }
            }
            let itemsLength = items.length;

            if (itemsLength > 0) {
                let subMenu = new PopupMenu.PopupSubMenuMenuItem(_('Recent'));
                this.addMenuItem(subMenu);
                let num = 10;
                if (itemsLength > num) {
                    itemsLength = num;
                }
                let handleRecentLaunch = (item, i) => {
                    this.signals.connect(item, 'activate', () => {
                        Gio.app_info_launch_default_for_uri(items[i].get_uri(), global.create_app_launch_context())
                    });
                };
                for (let i = 0; i < itemsLength; i++) {
                    item = createMenuItem({label: _(items[i].get_short_name()), icon: 'list-add'});
                    handleRecentLaunch(item, i);
                    subMenu.menu.addMenuItem(item);
                }
                this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }
        }

        if (Main.gpu_offload_supported && !hasWindows) {
            item = createMenuItem({label: _("Run with NVIDIA GPU"), icon: 'cpu'});

            this.signals.connect(item, 'activate', () => this.groupState.trigger('launchNewInstance', true));

            this.addMenuItem(item);
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        // Actions
        tryFn(() => {
            if (!this.groupState.appInfo) return;
            let actions = this.groupState.appInfo.list_actions();
            if (actions) {
                this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                let handleAction = (action) => {
                    let actionID = '';
                    if (action.toUpperCase() === action) {
                        actionID = action.toLowerCase();
                    } else {
                        // first letter lowercase, replace uppercase with _+lowercase
                        actionID = action.charAt(0).toLowerCase() + action.slice(1);
                        actionID = actionID.replace(/([A-Z])/g, '_$1').toLowerCase();
                    }
                    actionID = actionID.replace(/-/g, '_');

                    let icon = 'application-x-executable';

                    if (ICON_NAMES.hasOwnProperty(actionID)) {
                        icon = ICON_NAMES[actionID];
                    }

                    item = createMenuItem({
                        label: _(this.groupState.appInfo.get_action_name(action)),
                        icon
                    });

                    this.signals.connect(item, 'activate', () => {
                        this.groupState.appInfo.launch_action(action, global.create_app_launch_context());
                    });
                };

                for (let i = 0, len = actions.length; i < len; i++) {
                    handleAction(actions[i]);
                    this.addMenuItem(item);
                }
                this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }
        }, () => {
            if (isWindowBacked) {
                this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }
        });

        // Pin/unpin, shortcut handling
        if (!isWindowBacked) {
            let label, icon;
            if (this.groupState.isFavoriteApp) {
                label = _('Unpin from Panel');
                icon = 'unpin';
            } else {
                label = _('Pin to Panel');
                icon = 'pin';
            }
            this.pinToggleItem = createMenuItem({label, icon});
            this.signals.connect(this.pinToggleItem, 'activate', (...args) => this.toggleFavorite(...args));
            this.addMenuItem(this.pinToggleItem);
            if (this.state.settings.autoStart) {
                let label = this.groupState.autoStartIndex !== -1 ? _('Remove from Autostart') : _('Add to Autostart');
                item = createMenuItem({label: label, icon: 'insert-object'});
                this.signals.connect(item, 'activate', (...args) => this.toggleAutostart(...args));
                this.addMenuItem(item);
            }
        } else {
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            item = createMenuItem({label: _('Create Shortcut'), icon: 'list-add'});
            this.signals.connect(item, 'activate', (...args) => this.createShortcut(...args));
            this.addMenuItem(item);
        }
        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Window controls
        if (hasWindows) {
            let metaWindowActor = this.groupState.lastFocused.get_compositor_private();
            // Miscellaneous
            if (metaWindowActor && metaWindowActor.opacity !== 255) {
                item = createMenuItem({label: _('Restore to full opacity')});
                this.signals.connect(item, 'activate', () => metaWindowActor.set_opacity(255));
                this.addMenuItem(item);
            }

            if (this.groupState.lastFocused.minimized) {
                item = createMenuItem({label: _('Restore'), icon: 'view-sort-descending'});
                this.signals.connect(item, 'activate', () => {
                    Main.activateWindow(this.groupState.lastFocused, global.get_current_time());
                });
            } else {
                item = createMenuItem({label: _('Minimize'), icon: 'view-sort-ascending'});
                this.signals.connect(item, 'activate', () => this.groupState.lastFocused.minimize());
            }
            this.addMenuItem(item);

            if (this.groupState.lastFocused.get_maximized()) {
                item = createMenuItem({label: _('Unmaximize'), icon: 'view-restore'});
                this.signals.connect(item, 'activate', () => {
                    this.groupState.lastFocused.unmaximize(
                        Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL
                    );
                });
            } else {
                item = createMenuItem({label: _('Maximize'), icon: 'view-fullscreen'});
                this.signals.connect(item, 'activate', () => {
                    this.groupState.lastFocused.maximize(
                        Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL
                    );
                });
            }
            this.addMenuItem(item);
            item.setSensitive(this.groupState.lastFocused.can_maximize());

            if (this.groupState.metaWindows && this.groupState.metaWindows.length > 1) {
                // Close others
                item = createMenuItem({label: _('Close others'), icon: 'window-close'});
                this.signals.connect(item, 'activate', () => {
                    each(this.groupState.metaWindows, (metaWindow) => {
                        if (metaWindow !== this.groupState.lastFocused && !metaWindow._needsAttention) {
                            metaWindow.delete(global.get_current_time());
                        }
                    });
                });
                this.addMenuItem(item);
                // Close all
                // TODO: We should detect if windows from this group are on another workspace
                // and close windows across all workspaces while showAllWorkspaces is enabled.
                // Ditto for 'Close others'.
                item = createMenuItem({label: _('Close all'), icon: 'application-exit'});
                this.signals.connect(item, 'activate', () => {
                    if (!this.groupState.isFavoriteApp) {
                        this.groupState.set({willUnmount: true});
                    }
                    this.groupState.app.request_quit();
                });
                this.addMenuItem(item);
                this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            } else {
                item = createMenuItem({label: _('Close'), icon: 'edit-delete'});
                this.signals.connect(item, 'activate', () => {
                    this.groupState.lastFocused.delete(global.get_current_time());
                });
                this.addMenuItem(item);
                this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }
        }
    }

    onToggled(actor, isOpening) {
        this.state.set({menuOpen: this.isOpen});

        if (!isOpening) return;

        this.removeAll();
        this.populateMenu();
    }

    toggleAutostart() {
        if (this.groupState.autoStartIndex !== -1) {
            this.state.autoStartApps[this.groupState.autoStartIndex].file.delete(null);
            this.state.autoStartApps[this.groupState.autoStartIndex] = undefined;
            this.state.autoStartApps.splice(this.groupState.autoStartIndex, 1);
            this.groupState.set({autoStartIndex: -1});
        } else {
            let filePath = this.groupState.appInfo.get_filename();
            trySpawnCommandLine('bash -c "cp ' + filePath + ' ' + autoStartStrDir + '"');
            setTimeout(() => {
                this.state.trigger('getAutoStartApps');
                this.groupState.set({autoStartIndex: this.state.autoStartApps.length - 1});
            }, 500);
        }
    }

    toggleFavorite() {
        if (this.groupState.isFavoriteApp) {
            this.state.trigger('removeFavorite', this.groupState.appId);
        } else if (!this.groupState.app.is_window_backed()) {
            this.state.trigger('addFavorite', {
                appId: this.groupState.appId,
                app: this.groupState.app,
                pos: -1
            });
        }
    }

    createShortcut() {
        let proc = this.groupState.lastFocused.get_pid();
        let cmd = [
            'bash',
            '-c',
            'python3 /usr/share/cinnamon/applets/grouped-window-list@cinnamon.org/utils.py get_process ' + proc.toString()
        ];
        spawn_async(cmd, (stdout) => {
            if (stdout) {
                setTimeout(() => {
                    this.state.trigger('addFavorite', {appId: stdout.trim(), app: null, pos: -1});
                    this.state.trigger('refreshCurrentAppList');
                }, 2000);
            }
        });
    }

    listDefaultPlaces(pattern) {
        let defaultPlaces = Main.placesManager.getDefaultPlaces();
        let res = [];
        for (let i = 0, len = defaultPlaces.length; i < len; i++) {
            if (!pattern || defaultPlaces[i].name.toLowerCase().indexOf(pattern) !== -1) {
                res.push(defaultPlaces[i]);
            }
        }
        return res;
    }

    listBookmarks(pattern) {
        let bookmarks = Main.placesManager.getBookmarks();
        let res = [];
        for (let i = 0, len = bookmarks.length; i < len; i++) {
            if (!pattern || bookmarks[i].name.toLowerCase().indexOf(pattern) !== -1) {
                res.push(bookmarks[i]);
            }
        }
        return res;
    }

    listDevices(pattern) {
        let devices = Main.placesManager.getMounts();
        let res = [];
        for (let i = 0, len = devices.length; i < len; i++) {
            if (!pattern || devices[i].name.toLowerCase().indexOf(pattern) !== -1) {
                res.push(devices[i]);
            }
        }
        return res;
    }

    destroy() {
        this.signals.disconnectAllSignals();
        super.destroy();
        unref(this, RESERVE_KEYS);
    }
}

class HoverMenuController extends PopupMenu.PopupMenuManager {
    constructor(actor, groupState) {
        super({actor}, false); // owner, shouldGrab
        this.groupState = groupState;
        this.connectId = this.groupState.connect({
            thumbnailMenuEntered: ({thumbnailMenuEntered}) => {
                this.shouldGrab = thumbnailMenuEntered;
                this._onMenuOpenState(this._menus[0], this._menus[0].isOpen);
                this.groupState.trigger('checkFocusStyle');
                if (!this.grabbed) return;
                if (!thumbnailMenuEntered) this._ungrab();
            }
        });
    }

    _onEventCapture() {
        return false;
    }

    destroy() {
        this.groupState.disconnect(this.connectId);
        super.destroy();
    }

    _onMenuOpenState(menu, open) {
        if (open) {
            if (this._activeMenu && this._activeMenu.isChildMenu(menu)) {
                this._menuStack.push(this._activeMenu);
            }
            this._activeMenu = menu;
        } else {
            if (this._menuStack.length > 0) {
                this._activeMenu = this._menuStack.pop();
                if (menu.sourceActor)
                    this._didPop = true;
            }
        }
    }
}

class WindowThumbnail {
    constructor(params) {
        this.state = params.state;
        this.stateConnectId = this.state.connect({
            scrollActive: () => {
                this.destroyOverlayPreview();
            },
            thumbnailCloseButtonOffset: ({thumbnailCloseButtonOffset}) => {
                this.button.style = CLOSED_BUTTON_STYLE + `position: ${thumbnailCloseButtonOffset}px -2px;`;
            }
        });
        this.groupState = params.groupState;
        this.connectId = this.groupState.connect({
            isFavoriteApp: () => this.handleFavorite(),
            lastFocused: () => {
                if (!this.groupState || !this.groupState.metaWindows || this.groupState.metaWindows.length === 0) {
                    return;
                }
                this.isFocused = this.groupState.lastFocused === this.metaWindow;
                this.onFocusWindowChange();
            },
            windowCount: () => this.refreshThumbnail()
        });

        this.metaWindow = params.metaWindow;
        this.index = params.index;

        this.metaWindowActor = null;
        this.thumbnailPadding = 16;
        this.willUnmount = false;
        this.stopClick = false;
        this.entered = false;
        this.isFocused = false;
        this.signals = new SignalManager.SignalManager(null);

        // Inherit the theme from the alt-tab menu'
        this.actor = new St.BoxLayout({
            name: 'this.actor',
            style_class: 'item-box',
            important: true,
            reactive: true,
            track_hover: true,
            vertical: true,
            can_focus: true,
            style: 'border-width:2px;padding:' + 3 * global.ui_scale + 'px;'
        });
        this.actor._delegate = null;
        // Override with own theme.
        this.thumbnailActor = new St.Bin({
            style_class: 'thumbnail',
            important: true
        });

        this.container = new St.BoxLayout();

        this.bin = new St.BoxLayout({
            y_expand: false
        });

        let label = new St.Label({
            style_class: 'grouped-window-list-thumbnail-label',
            important: true
        });

        this.labelContainer = new St.Bin({
            y_align: St.Align.MIDDLE,
            x_expand: true,
            child: label
        });
        this.container.add_actor(this.labelContainer);

        this.button = new St.Button({
            style_class: 'window-close',
            reactive: true,
            width: CLOSE_BTN_SIZE,
            height: CLOSE_BTN_SIZE,
            style: CLOSED_BUTTON_STYLE + `position: ${this.state.thumbnailCloseButtonOffset}px -2px;`
        });

        this.button.set_opacity(0);
        this.bin.add_actor(this.container);
        this.bin.add_actor(this.button);
        this.actor.add_actor(this.bin);
        this.actor.add_actor(this.thumbnailActor);

        this.signals.connect(this.actor, 'enter-event', (...args) => this.onEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.onLeave(...args));
        this.signals.connect(this.button, 'button-release-event', (...args) => this.onCloseButtonRelease(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this.connectToWindow(...args));


        this.handleFavorite();
        // Update focused style
        this.onFocusWindowChange();
    }

    onEnter(a, e) {
        this.entered = true;

        // Cluter.CrossingEvent will always fire on every child actor of the actor connected to the signal, so we have
        // to filter the bogus child hover events so the hoverpeek effect only occurs once while inside this.actor.

        this.actor.add_style_pseudo_class('selected');
        this.button.set_opacity(255);

        if (!e) return;

        let actorString = e.get_source().toString();
        if (actorString.indexOf('this.actor') > -1
            && (!this.lastEnterActor
                || (this.lastEnterActor.indexOf('StButton') === -1)
                    && this.lastEnterActor.indexOf('ClutterClone') === -1)) {
            this.destroyOverlayPreview();
            this.hoverPeek(this.state.settings.peekOpacity);
        }
        this.lastEnterActor = actorString;
    }

    onLeave() {
        this.entered = false;
        this.stopClick = false;
        this.actor.remove_style_pseudo_class('selected');
        this.onFocusWindowChange();
        this.button.set_opacity(0);
    }

    onWindowDemandsAttention(window) {
        if (this._needsAttention) {
            return false;
        }
        this._needsAttention = true;
        if (this.metaWindow === window) {
            this.actor.add_style_class_name('grouped-window-list-thumbnail-alert');
            return true;
        }
        return false;
    }

    onFocusWindowChange() {
        if (this.willUnmount) return;
        if (this.isFocused
            && this.state.settings.highlightLastFocusedThumbnail
            && this.groupState.metaWindows.length > 1) {
            this.actor.add_style_pseudo_class('outlined');
        } else {
            this.isFocused = false;
            this.actor.remove_style_pseudo_class('outlined');
        }
    }

    handleFavorite() {
        if (!this.groupState) return;

        if (this.groupState.metaWindows && this.groupState.metaWindows.length > 0) {
            this.refreshThumbnail();
        }
    }

    handleCloseClick() {
        this.onLeave();
        this.stopClick = true;

        this.metaWindow.delete(global.get_current_time());
        if (!this.groupState.metaWindows || this.groupState.metaWindows.length <= 1) {
            this.groupState.trigger('hoverMenuClose');
        } else {
            this.groupState.trigger('checkShouldClose');
        }
    }

    onCloseButtonRelease(actor, event) {
        let button = event.get_button();
        if (button === 1 && actor === this.button) {
            this.handleCloseClick();
        }
    }

    connectToWindow(actor, event) {
        if (!this.metaWindow || !this.groupState.metaWindows || this.groupState.metaWindows.length === 0) {
            this.groupState.trigger('hoverMenuClose');
            return;
        }
        let button = typeof event === 'number' ? event : event.get_button();
        if (button === 1 && !this.stopClick) {
            Main.activateWindow(this.metaWindow, global.get_current_time());
            this.groupState.trigger('hoverMenuClose');
            this.onLeave();
        } else if (button === 2 && !this.stopClick) {
            this.handleCloseClick();
        }
        this.stopClick = false;
    }

    getThumbnail(thumbnailWidth, thumbnailHeight) {
        if (this.groupState.verticalThumbs || !this.state.settings.showThumbs) {
            this.thumbnailActor.hide();
            return null;
        } else if (this.thumbnailActor.realized) {
            this.thumbnailActor.show();
        }
        // Create our own thumbnail if it doesn't exist
        if (this.metaWindowActor) {
            this.signals.disconnect('size-changed', this.metaWindowActor);
        } else {
            this.metaWindowActor = this.metaWindow.get_compositor_private();
        }
        if (this.metaWindowActor && !this.metaWindowActor.is_finalized()) {
            this.signals.connect(this.metaWindowActor, 'size-changed', () => this.refreshThumbnail());

            let windowTexture = this.metaWindowActor.get_texture();
            if (!windowTexture) return;
            let [width, height] = windowTexture.get_size();
            let scale = Math.min(1.0, thumbnailWidth / width, thumbnailHeight / height) * global.ui_scale;
            width = Math.round(width * scale);
            height = Math.round(height * scale);
            if (this.thumbnailActor.child) {
                this.thumbnailActor.height = height;
                this.thumbnailActor.width = width;
                this.thumbnailActor.child.source = windowTexture;
                this.thumbnailActor.child.width = width;
                this.thumbnailActor.child.height = height;
            } else {
                this.thumbnailActor.child = new Clutter.Clone({
                    source: windowTexture,
                    reactive: true,
                    width,
                    height
                });
            }
        } else if (this.groupState.isFavoriteApp) {
            this.groupState.trigger('removeThumbnailFromMenu', this.metaWindow);
        }
    }

    refreshThumbnail() {
        if (this.willUnmount
            || !this.groupState
            || !this.groupState.app
            || !this.groupState.metaWindows
            || !this.metaWindow) {
            return;
        }

        let monitor = this.state.trigger('getPanelMonitor');
        if (!monitor) return;

        if (!this.thumbnailActor || this.thumbnailActor.is_finalized()) return;

        let divider = 80 * global.ui_scale;
        let {thumbSize} = this.state.settings;

        if (monitor.height / global.ui_scale <= 1024) {
            thumbSize += 6;
        } else if (monitor.height / global.ui_scale <= 1200) {
            thumbSize += 3;
        }

        let thumbnailWidth = Math.floor((monitor.width / divider) * thumbSize);
        let thumbnailHeight = Math.floor((monitor.height / divider) * thumbSize);

        let monitorSize, thumbnailSize;
        if (!this.state.isHorizontal) {
            monitorSize = monitor.height;
            thumbnailSize = thumbnailHeight;
        } else {
            monitorSize = monitor.width;
            thumbnailSize = thumbnailWidth;
        }

        let padding = this.thumbnailActor.style_length('padding');
        let margin = this.thumbnailActor.style_length('margin');

        let i = 0;
        while (((thumbnailSize + this.thumbnailPadding + padding + margin) * this.groupState.windowCount > monitorSize)
            && thumbnailWidth > 64
            && thumbnailHeight > 64) {
            thumbnailWidth -= 1;
            thumbnailHeight -= 1;
            thumbnailSize -= 1;
            i++;
            // Bail after 200 iterations
            if (i > 200) {
                break;
            }
        }

        // If we can't fit all the thumbnails, revert to a vertical menu orientation
        // with no thumbnails, which can hold more window selections.
        let verticalThumbs = ((thumbnailSize + this.thumbnailPadding + padding + margin) * this.groupState.windowCount) > monitorSize;
        let currentVerticalThumbsState = this.groupState.verticalThumbs;
        this.groupState.set({verticalThumbs});
        if (verticalThumbs !== currentVerticalThumbsState) return;

        let scaledWidth = thumbnailWidth * global.ui_scale;
        this.thumbnailActor.width = scaledWidth;
        this.container.style = `width: ${Math.floor(thumbnailWidth - 16)}px;`;
        if (this.groupState.verticalThumbs || (this.state.settings.verticalThumbs && this.state.settings.showThumbs)) {
            this.thumbnailActor.height = thumbnailHeight;
        } else if (this.state.settings.verticalThumbs) {
            this.thumbnailActor.height = 0;
        }

        this.labelContainer.child.text = this.metaWindow.title || '';
        this.getThumbnail(thumbnailWidth, thumbnailHeight);
    }

    hoverPeek(opacity) {
        if (!this.state.settings.enablePeek
            || this.state.scrollActive
            || (this.metaWindowActor && this.metaWindowActor.is_finalized())) {
            return;
        }
        if (!this.metaWindowActor) {
            this.metaWindowActor = this.metaWindow.get_compositor_private();
        }
        this.state.set({
            lastOverlayPreview: new Clutter.Clone({
                source: this.metaWindowActor.get_texture(),
                opacity: 0
            })
        });
        let [x, y] = this.metaWindowActor.get_position();
        this.state.lastOverlayPreview.set_position(x, y);
        global.overlay_group.add_child(this.state.lastOverlayPreview);
        global.overlay_group.set_child_above_sibling(this.state.lastOverlayPreview, null);
        setOpacity(this.state.settings.peekTimeIn, this.state.lastOverlayPreview, opacity);
    }

    destroyOverlayPreview() {
        if (!this.state.lastOverlayPreview) return;

        if (this.state.settings.peekTimeOut) {
            let currOverlayPreview = this.state.lastOverlayPreview;
            setOpacity(
                this.state.settings.peekTimeOut,
                currOverlayPreview,
                0,
                () => this._destroyOverlayPreview(currOverlayPreview)
            );
        } else {
            this._destroyOverlayPreview(this.state.lastOverlayPreview);
        }
    }

    _destroyOverlayPreview(overlayPreview) {
        global.overlay_group.remove_child(overlayPreview);
        overlayPreview.destroy();

        if(overlayPreview === this.state.lastOverlayPreview) {
            this.state.set({lastOverlayPreview: null});
        }
    }

    destroy() {
        this.willUnmount = true;
        if (!this.groupState) return;

        this.state.disconnect(this.stateConnectId);
        this.groupState.disconnect(this.connectId);
        this.signals.disconnectAllSignals();
        this.container.destroy();
        this.bin.destroy();
        this.actor.destroy();
        unref(this, RESERVE_KEYS);
    }
}

class AppThumbnailHoverMenu extends PopupMenu.PopupMenu {
    _init(state, groupState) {
        super._init.call(this, groupState.trigger('getActor'), state.orientation, 0.5);
        this.state = state;
        this.groupState = groupState;
        this.shouldClose = true;
        this.isOpen = false;
        this.setCustomStyleClass("grouped-window-list-thumbnail-menu");

        this.connectId = this.groupState.connect({
            hoverMenuClose: () => {
                this.shouldClose = true;
                this.groupState.set({thumbnailMenuEntered: false});
                this.close();
            },
            checkShouldClose: () => {
                // This is called after a close button is clicked. When the menu size changes, it can leave the cursor
                // outside the menu bounds, and no leave event will be able to correct this situation where the menu is
                // dangling open and only closable upon hovering over it again. This checks if the cursor is hovering
                // over the menu and closes it if not.
                setTimeout(() => {
                    let [x, y, mask] = global.get_pointer();
                    let draggedOverActor = global.stage.get_actor_at_pos(Clutter.PickMode.ALL, x, y);
                    let parent = draggedOverActor.get_parent();
                    if (!(parent instanceof St.Widget)) {
                        this.close(true);
                    }
                }, 500);
            },
            addThumbnailToMenu: (win) => {
                if (this.isOpen) {
                    this.addThumbnail(win);
                    return;
                }

                this.queuedWindows.push(win);
            },
            removeThumbnailFromMenu: (win) => {
                let index = findIndex(this.appThumbnails, (item) => item.metaWindow === win);
                if (index > -1) {
                    this.appThumbnails[index].destroy();
                    this.appThumbnails[index] = undefined;
                    this.appThumbnails.splice(index, 1);
                }
                index = this.queuedWindows.indexOf(win);
                if (index > -1) this.queuedWindows.splice(index, 1);
            },
            verticalThumbs: () => {
                // Preserve the menu's open state after refreshing
                let {isOpen} = this;
                this.setVerticalSetting();
                if (isOpen) this.open(true);
            },
            fileDrag: ({fileDrag}) => {
                if (fileDrag) {
                    // When a drag operation from another app is started, no events fire, so we have to grab the
                    // cursor, find the actor by coordinates, and then look up the thumbnail actor. Do this on a
                    // 50ms loop until the menu closes so we continue getting data in the absence of events.
                    this.interval = setInterval(() => {
                        let [x, y, mask] = global.get_pointer();
                        let draggedOverActor = global.stage.get_actor_at_pos(Clutter.PickMode.ALL, x, y);
                        if (draggedOverActor instanceof Meta.ShapedTexture) {
                            this.groupState.set({fileDrag: false});
                            this.close(true);
                            return;
                        }
                        each(this.appThumbnails, function(thumbnail) {
                            if (thumbnail.thumbnailActor === draggedOverActor) {
                                Main.activateWindow(thumbnail.metaWindow, global.get_current_time());
                                return false;
                            }
                        });
                    }, 50);
                } else if (this.interval) {
                    clearInterval(this.interval);
                }
            }
        });

        this.appThumbnails = [];
        this.queuedWindows = [];
        this.fullyRefreshThumbnails();
    }

    addQueuedThumbnails() {
        if (this.queuedWindows.length === 0) return;
        each(this.queuedWindows, (win) => this.addThumbnail(win));
        this.queuedWindows = [];
    }

    onButtonPress() {
        if (this.state.settings.onClickThumbs && this.box.get_children().length > 1) {
            return;
        }
        this.shouldClose = true;
        setTimeout(() => this.close(), this.state.settings.thumbTimeout);
    }

    onMenuEnter(actor) {
        if (this.state.panelEditMode ||
            (!this.isOpen && this.state.settings.onClickThumbs) ||
            this.state.menuOpen) {
            return false;
        }

        this.shouldClose = false;

        let timeout;
        if (this.state.thumbnailMenuOpen) {
            timeout = 50;
        } else {
            timeout = this.state.settings.thumbTimeout;
        }

        this.addQueuedThumbnails();

        if (actor != null) {
            this.groupState.set({thumbnailMenuEntered: this.isOpen});
        }

        setTimeout(() => this.open(), timeout);
    }

    onMenuLeave(actor) {
        if (this.state.menuOpen || this.state.panelEditMode) {
            return false;
        }

        this.shouldClose = true;

        if (actor != null) {
            this.groupState.set({thumbnailMenuEntered: false});
        }

        setTimeout(() => this.close(), 50);
    }

    onKeyRelease(actor, event) {
        let symbol = event.get_key_symbol();
        if (this.isOpen && (symbol === Clutter.KEY_Super_L || symbol === Clutter.KEY_Super_R)) {
            // Close this menu, if opened by super + #
            this.close(true);
        }
        return true;
    }

    open (force) {
        if (!force && (!this.actor
          || this.willUnmount
          || this.isOpen
          || (this.shouldClose && !this.state.settings.onClickThumbs))) {
            return;
        }
        if (!this.groupState.metaWindows || this.groupState.metaWindows.length === 0) {
            this.groupState.tooltip.set_text(this.groupState.appName);
            this.groupState.tooltip.show();
        } else {
            if (force || this.state.settings.onClickThumbs) this.addQueuedThumbnails();
            this.state.set({thumbnailMenuOpen: true});
            super.open(this.state.settings.animateThumbs);
        }
    }

    close (force) {
        if (!force && (!this.shouldClose
            || (!this.shouldClose && this.state.settings.onClickThumbs))
            || !this.groupState
            || !this.groupState.tooltip) {
            return;
        }
        if ((!this.groupState.metaWindows || this.groupState.metaWindows.length === 0)
            && !this.groupState.tooltip._tooltip.is_finalized()) {
            this.groupState.tooltip.set_text('');
            this.groupState.tooltip.hide();
        }
        if (this.isOpen) {
            this.state.set({thumbnailMenuOpen: false});
            if (!this.actor.is_finalized()) super.close(this.state.settings.animateThumbs);
        }
        for (let i = 0; i < this.appThumbnails.length; i++) {
            this.appThumbnails[i].destroyOverlayPreview();
        }

        if (this.groupState.fileDrag) {
            this.groupState.set({fileDrag: false});
        }
    }

    onKeyPress(actor, e) {
        let {orientation} = this.state;
        let {vertical} = this.box;

        let symbol = e.get_key_symbol();
        let i = findIndex(this.appThumbnails, (item) => item.entered === true);
        let entered = i > -1;
        if (!entered) {
            i = findIndex(this.appThumbnails, function(thumbnail) {
                return thumbnail.isFocused;
            });
            if (i === -1) {
                i = 0;
            }
        }
        let args;
        let closeArg;
        if (orientation === St.Side.TOP) {
            closeArg = Clutter.KEY_Up;
            args = [Clutter.KEY_Left, Clutter.KEY_Right];
        } else if (orientation === St.Side.BOTTOM) {
            closeArg = Clutter.KEY_Down;
            args = [Clutter.KEY_Right, Clutter.KEY_Left];
        } else if (orientation === St.Side.LEFT) {
            closeArg = Clutter.KEY_Left;
            args = [Clutter.KEY_Up, Clutter.KEY_Down];
        } else if (orientation === St.Side.RIGHT) {
            closeArg = Clutter.KEY_Right;
            args = [Clutter.KEY_Down, Clutter.KEY_Up];
        }

        // Panel is oriented horizontally, but the menu is vertical
        if (vertical && (orientation === St.Side.TOP || orientation === St.Side.BOTTOM)) {
            args = [Clutter.KEY_Down, Clutter.KEY_Up];
        }

        let index;
        if (symbol === args[0]) {
            if (!entered) {
                index = i;
            } else if (this.appThumbnails[i + 1] !== undefined) {
                index = i + 1;
            } else {
                index = 0;
            }
        } else if (symbol === args[1]) {
            if (!entered) {
                index = i;
            } else if (this.appThumbnails[i - 1] !== undefined) {
                index = i - 1;
            } else {
                index = this.appThumbnails.length - 1;
            }
        } else if ((symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) && entered) {
            this.appThumbnails[i].connectToWindow(null, 1);
        } else if (symbol === closeArg) {
            this.appThumbnails[i].onLeave();
            this.close(true);
        } else return;

        if (this.appThumbnails[index] !== undefined) {
            this.appThumbnails[i].onLeave();
            this.appThumbnails[index].onEnter();
            if (this.appThumbnails[i].isFocused) {
                this.appThumbnails[i].onFocusWindowChange();
            }
        }
    }

    fullyRefreshThumbnails() {
        if (this.appThumbnails.length > 0) {
            this.destroyThumbnails();
        }
        this.addWindowThumbnails(this.groupState.metaWindows);
    }

    destroyThumbnails() {
        this.box.destroy_children();
        for (let i = 0; i < this.appThumbnails.length; i++) {
            this.appThumbnails[i].destroy();
            this.appThumbnails[i] = undefined;
        }
        this.appThumbnails = [];
    }

    updateThumbnails(exceptIndex) {
        for (let i = 0; i < this.appThumbnails.length; i++) {
            if (i !== exceptIndex) {
                this.appThumbnails[i].refreshThumbnail();
                this.box.set_child_at_index(this.appThumbnails[i].actor, i);
            }
        }
    }

    addThumbnail(metaWindow) {
        if (this.state.settings.sortThumbs) {
            this.appThumbnails.sort(function(a, b) {
                if (!a.metaWindow || !b.metaWindow) {
                    return -1;
                }
                return b.metaWindow.user_time - a.metaWindow.user_time;
            });
        }
        let refThumb = findIndex(this.appThumbnails, (thumbnail) => thumbnail.metaWindow === metaWindow);
        if (!this.appThumbnails[refThumb] && refThumb === -1) {
            let thumbnail = new WindowThumbnail({
                state: this.state,
                groupState: this.groupState,
                metaWindow: metaWindow,
                index: this.appThumbnails.length // correct index before actual push
            });
            this.appThumbnails.push(thumbnail);
            this.box.insert_actor(thumbnail.actor, -1);
            // TBD: Update the thumbnail scaling for the other thumbnails belonging to this group.
            // Since the total window count determines the scaling used, this needs to be done
            // each time a window is added.
            this.updateThumbnails(thumbnail.index);
        } else if (this.appThumbnails[refThumb]) {
            this.appThumbnails[refThumb].index = refThumb;
            this.appThumbnails[refThumb].metaWindow = metaWindow;
            this.appThumbnails[refThumb].refreshThumbnail();
            this.box.set_child_at_index(this.appThumbnails[refThumb].actor, refThumb);
        }
    }

    addWindowThumbnails() {
        if (this.willUnmount || !this.box || !this.appThumbnails || !this.groupState || !this.groupState.metaWindows) {
            return;
        }

        for (let i = 0, len = this.groupState.metaWindows.length; i < len; i++) {
            this.addThumbnail(this.groupState.metaWindows[i]);
        }
    }

    setVerticalSetting() {
        if (this.state.orientation === St.Side.TOP || this.state.orientation === St.Side.BOTTOM) {
            this.box.vertical = this.groupState.verticalThumbs || this.state.settings.verticalThumbs;
        } else {
            this.box.vertical = true;
        }

        // Do a full refresh if thumbnails don't exist - this happens when the thumbnail menu
        // initializes vertically from lack of calculated space, or thumbnails are disabled.
        if (!this.appThumbnails[0] || !this.appThumbnails[0].thumbnailActor.child) {
            this.fullyRefreshThumbnails();
        } else {
            this.updateThumbnailSize();
        }
    }

    updateThumbnailSize() {
        for (let i = 0; i < this.appThumbnails.length; i++) {
            if (this.appThumbnails[i]) {
                this.appThumbnails[i].refreshThumbnail();
            }
        }
    }

    destroy() {
        this.willUnmount = true;
        if (!this.box) return;

        if (this.isOpen) this.close();

        for (let w = 0, len = this.appThumbnails.length; w < len; w++) {
            if (this.appThumbnails[w] !== undefined) {
                if (this.appThumbnails[w].entered) {
                    this.appThumbnails[w].onLeave();
                }
                this.appThumbnails[w].destroy(true);
                this.appThumbnails[w] = null;
                this.appThumbnails.splice(w, 1);
            }
        }
        this.removeAll();
        super.destroy();
        this.groupState.disconnect(this.connectId);
        unref(this, RESERVE_KEYS);
    }
}
