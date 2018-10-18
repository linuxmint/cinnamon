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

const {each, find, findIndex, tryFn, unref, trySpawnCommandLine, spawn_async} = imports.misc.util;
const {
    OPACITY_OPAQUE,
    RESERVE_KEYS,
    menuItemTypeOptions,
    ffOptions,
    FavType,
    autoStartStrDir
} = require('./constants');

const getFirefoxHistory = require('./firefox');

const convertRange = function(value, r1, r2) {
    return ((value - r1[0]) * (r2[1] - r2[0])) / (r1[1] - r1[0]) + r2[0];
};

const setOpacity = (peekTime, window_actor, targetOpacity) => {
    const opacity = convertRange(targetOpacity, [0, 100], [0, 255]);
    Tweener.addTween(window_actor, {
        time: peekTime * 0.001,
        transition: 'easeOutQuad',
        opacity: opacity > 255 ? 255 : opacity
    });
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
            for (let z = 0, len = this.groupState.metaWindows.length; z < len; z++) {
                if (!this.groupState.metaWindows[z]) {
                    continue;
                }
                let focused = 0;
                if (this.groupState.metaWindows[z].has_focus()) {
                    ++focused;
                }
                if (z === len - 1 && focused === 0) {
                    Main.activateWindow(this.groupState.metaWindows[z], global.get_current_time());
                }
                this.groupState.metaWindows[z].move_to_monitor(i);
            }
        } else {
            this.groupState.lastFocused.move_to_monitor(i);
            Main.activateWindow(this.groupState.lastFocused, global.get_current_time());
        }
    }

    populateMenu() {
        this.signals.disconnectAllSignals();
        this.signals.connect(
            this,
            'open-state-changed',
            (...args) => this.onToggled(...args)
        );

        let item;
        let length;
        let hasWindows = this.groupState.metaWindows.length > 0;
        let isWindowBacked = this.groupState.app.is_window_backed();

        let createMenuItem = (opts = {label: '', icon: null}) => {
            if (this.state.settings.menuItemType < 3 && opts.icon) {
                let refMenuType = find(
                    menuItemTypeOptions,
                    (item) => item.id === this.state.settings.menuItemType
                );
                return new PopupMenu.PopupIconMenuItem(opts.label, opts.icon, St.IconType[refMenuType.label]);
            } else {
                return new PopupMenu.PopupMenuItem(opts.label);
            }
        };

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
                        // Make the index a local letiable to pass to function
                        let j = i;
                        let name = Main.workspace_names[i] ? Main.workspace_names[i] : Main._makeDefaultWorkspaceName(i);
                        let ws = createMenuItem({label: _(name)});

                        if (i === this.state.currentWs) {
                            ws.setSensitive(false);
                        }

                        connectWorkspaceEvent(ws, j);
                        item.menu.addMenuItem(ws);
                    }
                }
            }
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        if (this.state.settings.showRecent) {
            // Places
            if (this.groupState.appId === 'nemo.desktop' || this.groupState.appId === 'nemo-home.desktop') {
                let subMenu = new PopupMenu.PopupSubMenuMenuItem(_('Places'));
                this.addMenuItem(subMenu);

                let defualtPlaces = this.listDefaultPlaces();
                let bookmarks = this.listBookmarks();
                let devices = this.listDevices();
                let places = defualtPlaces.concat(bookmarks).concat(devices);
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

            // History
            if (
                this.groupState.appId === 'firefox.desktop' ||
                this.groupState.appId === 'firefox web browser.desktop'
            ) {
                let histories = null;
                tryFn(() => {
                    histories = getFirefoxHistory(this.state.settings);
                });
                let subMenu;

                if (histories) {
                    subMenu = new PopupMenu.PopupSubMenuMenuItem(
                        _(ffOptions.find((ffOption) => ffOption.id === this.state.settings.firefoxMenu).label)
                    );
                    tryFn(() => {
                        let handleHistoryLaunch = (item, i) => {
                            this.signals.connect(item, 'activate', () => {
                                Gio.app_info_launch_default_for_uri(
                                    histories[i].uri,
                                    global.create_app_launch_context()
                                )
                            });
                        };
                        for (let i = 0, len = histories.length; i < len; i++) {
                            item = createMenuItem({label: _(histories[i].title), icon: 'go-next'});
                            handleHistoryLaunch(item, i);
                            subMenu.menu.addMenuItem(item);
                        }
                    });
                } else {
                    subMenu = createMenuItem({
                        label: _('Bookmarks/History requires gir1.2-gda-5.0'),
                        icon: 'help-about'
                    });
                }
                this.addMenuItem(subMenu);
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

        // Preferences
        let subMenu = new PopupMenu.PopupSubMenuMenuItem(_('Preferences'));
        this.addMenuItem(subMenu);

        item = createMenuItem({label: _('About...'), icon: 'dialog-question'});
        this.signals.connect(item, 'activate', () => this.state.trigger('openAbout'));
        subMenu.menu.addMenuItem(item);

        item = createMenuItem({label: _('Configure...'), icon: 'system-run'});
        this.signals.connect(item, 'activate', () => this.state.trigger('configureApplet'));
        subMenu.menu.addMenuItem(item);

        item = createMenuItem({label: _('Remove') + " 'Icing Task Manager'", icon: 'edit-delete'});
        this.signals.connect(item, 'activate', () => {
            AppletManager._removeAppletFromPanel(this.state.uuid, this.state.instance_id);
        });
        subMenu.menu.addMenuItem(item);

        // Actions
        tryFn(() => {
            if (!this.groupState.appInfo) return;
            let actions = this.groupState.appInfo.list_actions();
            if (actions) {
                this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                let handleAction = (action) => {
                    item = createMenuItem({
                        label: _(this.groupState.appInfo.get_action_name(action)),
                        icon: 'document-new'
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
            if (this.state.settings.launchNewInstance && (!actions || actions.length === 0) && !isWindowBacked) {
                item = createMenuItem({label: _('New Window'), icon: 'document-new'});
                this.signals.connect(item, 'activate', () => this.groupState.trigger('launchNewInstance'));
                this.addMenuItem(item);
                if (!actions || actions.length === 0) {
                    this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                }
            }
        }, () => {
            if (isWindowBacked) {
                this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }
        });

        // Pin/unpin, shortcut handling
        if (!isWindowBacked) {
            if (this.state.settings.showPinned !== FavType.none) {
                let label = this.groupState.isFavoriteApp ? _('Unpin from Panel') : _('Pin to Panel');
                this.pinToggleItem = createMenuItem({label: label, icon: 'bookmark-new'});
                this.signals.connect(this.pinToggleItem, 'activate', (...args) => this.toggleFavorite(...args));
                this.addMenuItem(this.pinToggleItem);
            }
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
            if (metaWindowActor.opacity !== 255) {
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

            if (this.groupState.metaWindows && this.groupState.metaWindows.length > 1) {
                // Close others
                item = createMenuItem({label: _('Close others'), icon: 'window-close'});
                this.signals.connect(item, 'activate', () => {
                    each(this.groupState.metaWindows, (metaWindow) => {
                        if (!metaWindow === this.groupState.lastFocused && !metaWindow._needsAttention) {
                            metaWindow.delete(global.get_current_time());
                        }
                    });
                });
                this.addMenuItem(item);
                // Close all
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
            'python3 ~/.local/share/cinnamon/applets/IcingTaskManager@json/3.8/utils.py get_process ' + proc.toString()
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
        Applet.AppletPopupMenu.prototype.destroy.call(this);
        unref(this, RESERVE_KEYS);
    }
}

class HoverMenuController extends PopupMenu.PopupMenuManager {
    _onEventCapture() {
        return false;
    }
}

class WindowThumbnail {
    constructor(params) {
        this.state = params.state;
        this.stateConnectId = this.state.connect({
            scrollActive: () => {
                if (this.state.overlayPreview) {
                    this.destroyOverlayPreview();
                }
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
            refreshThumbnails: () => this.refreshThumbnail()
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
            reactive: true,
            track_hover: true,
            vertical: true,
            can_focus: true
        });
        this.state.trigger('setThumbnailActorStyle', this.actor);
        this.actor._delegate = null;
        // Override with own theme.
        this.actor.add_style_class_name('thumbnail-box');
        this.thumbnailActor = new St.Bin({
            style_class: 'thumbnail'
        });

        this.container = new St.BoxLayout();

        this.bin = new St.BoxLayout({
            y_expand: false
        });

        this.label = new St.Label({
            style_class: this.icon ? 'thumbnail-label' : 'thumbnail-label-no-icon'
        });

        if (this.state.settings.showIcons) {
            this.icon = this.groupState.app.create_icon_texture(16);
            this.themeIcon = new St.BoxLayout({
                style_class: 'thumbnail-icon'
            });
            this.themeIcon.add_actor(this.icon);
            this.container.add_actor(this.themeIcon);
            this.container.add_actor(this.label);
        } else {
            this.labelContainer = new St.Bin({
                y_align: this.icon ? St.Align.START : St.Align.MIDDLE
            });
            this.labelContainer.add_actor(this.label);
            this.container.add_actor(this.labelContainer);
        }

        this.button = new St.Button({
            reactive: true
        });

        this.state.trigger('setThumbnailCloseButtonStyle', this.button);

        this.button.set_opacity(0);
        this.bin.add_actor(this.container);
        this.bin.add_actor(this.button);
        this.actor.add_actor(this.bin);
        this.actor.add_actor(this.thumbnailActor);

        setTimeout(() => this.handleFavorite(), 0);

        this.signals.connect(this.actor, 'enter-event', (...args) => this.onEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.onLeave(...args));
        this.signals.connect(this.button, 'button-release-event', (...args) => this.onCloseButtonRelease(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this.connectToWindow(...args));
        //update focused style
        this.onFocusWindowChange();
    }

    onEnter(a, e) {
        this.entered = true;
        this.state.trigger('setThumbnailActorStyle', this.actor);
        this.state.trigger('setThumbnailCloseButtonStyle', this.button);

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
            if (this.state.overlayPreview) {
                this.destroyOverlayPreview();
            }
            this.hoverPeek(this.state.settings.peekOpacity);
        }
        this.lastEnterActor = actorString;
    }

    onLeave() {
        this.entered = false;
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
            this.actor.add_style_class_name('thumbnail-alerts');
            return true;
        }
        return false;
    }

    onFocusWindowChange() {
        if (this.willUnmount) return;
        if (
            this.isFocused &&
            this.state.settings.highlightLastFocusedThumbnail &&
            this.groupState.metaWindows.length > 1
        ) {
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

    thumbnailIconSize() {
        let thumbnailTheme = this.themeIcon.peek_theme_node();
        if (thumbnailTheme) {
            let width = thumbnailTheme.get_width();
            let height = thumbnailTheme.get_height();
            this.icon.set_size(width, height);
        }
    }

    handleCloseClick() {
        this.onLeave();
        this.stopClick = true;
        this.groupState.trigger('removeThumbnailFromMenu', this.metaWindow);
        this.hoverPeek(OPACITY_OPAQUE);

        this.metaWindow.delete(global.get_current_time());
        if (!this.groupState.metaWindows || this.groupState.metaWindows.length <= 1) {
            this.groupState.trigger('hoverMenuClose');
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

    getThumbnail() {
        if (!this.state.settings.showThumbs) {
            return null;
        }
        // Create our own thumbnail if it doesn't exist
        let isUpdate = false;
        if (this.metaWindowActor) {
            isUpdate = true;
            this.signals.disconnect('size-changed', this.metaWindowActor);
        }
        this.metaWindowActor = this.metaWindow.get_compositor_private();
        if (this.metaWindowActor) {
            let windowTexture = this.metaWindowActor.get_texture();
            let [width, height] = windowTexture.get_size();
            this.signals.connect(this.metaWindowActor, 'size-changed', () => this.refreshThumbnail());
            this.signals.connect(this.metaWindowActor, 'destroy', () => {
                if (this.willUnmount || !this.groupState.trigger) return;
                this.groupState.trigger('removeThumbnailFromMenu', this.metaWindow);
                this.metaWindowActor = null;
            });
            let scale = Math.min(1.0, this.thumbnailWidth / width, this.thumbnailHeight / height);
            if (isUpdate) {
                this.thumbnailActor.child.source = windowTexture;
                this.thumbnailActor.child.width = width * scale;
                this.thumbnailActor.child.height = height * scale;
            } else {
                this.thumbnailActor.child = new Clutter.Clone({
                    source: windowTexture,
                    reactive: true,
                    width: width * scale,
                    height: height * scale
                });
            }
        } else {
            this.groupState.trigger('removeThumbnailFromMenu', this.metaWindow);
        }
    }

    refreshThumbnail() {
        if (this.willUnmount ||
            !this.groupState ||
            !this.groupState.app ||
            !this.groupState.metaWindows ||
            !this.metaWindow) {
            return;
        }

        let monitor = Main.layoutManager.primaryMonitor;

        let setThumbSize = (divider = 70, offset = 16) => {
            this.thumbnailWidth = Math.floor((monitor.width / divider) * this.state.settings.thumbSize) + offset;
            this.thumbnailHeight = Math.floor((monitor.height / divider) * this.state.settings.thumbSize) + offset;

            let monitorSize, thumbnailSize, thumbMultiplier;
            if (!this.state.isHorizontal) {
                thumbMultiplier = 1.5;
                monitorSize = monitor.height;
                thumbnailSize = this.thumbnailHeight;
            } else {
                thumbMultiplier = 1;
                monitorSize = monitor.width;
                thumbnailSize = this.thumbnailWidth;
            }

            if (((thumbnailSize * thumbMultiplier) * this.groupState.metaWindows.length) + thumbnailSize > monitorSize) {
                let divideMultiplier = !this.state.isHorizontal ? 4.5 : 1.1;
                setThumbSize(divider * divideMultiplier, 16);
                return;
            } else {
                this.thumbnailActor.width = this.thumbnailWidth;
                this.container.style = `width: ${Math.floor(this.thumbnailWidth - 16)}px;`;
                if (this.state.settings.verticalThumbs && this.state.settings.showThumbs) {
                    this.thumbnailActor.height = this.thumbnailHeight;
                } else if (this.state.settings.verticalThumbs) {
                    this.thumbnailActor.height = 0;
                }

                // Replace the old thumbnail
                if (this.labelContainer) {
                    this.labelContainer.set_width(this.thumbnailWidth);
                }
                this.label.text = this.metaWindow.title || '';
                this.getThumbnail();
            }
        };

        setThumbSize();
    }

    hoverPeek(opacity) {
        if (!this.state.settings.enablePeek || this.state.overlayPreview || this.state.scrollActive) {
            return;
        }
        if (!this.metaWindowActor) {
            this.metaWindowActor = this.metaWindow.get_compositor_private();
        }
        this.state.set({
            overlayPreview: new Clutter.Clone({
                source: this.metaWindowActor.get_texture(),
                opacity: 0
            })
        });
        let [x, y] = this.metaWindowActor.get_position();
        this.state.overlayPreview.set_position(x, y);
        global.overlay_group.add_child(this.state.overlayPreview);
        global.overlay_group.set_child_above_sibling(this.state.overlayPreview, null);
        setOpacity(this.state.settings.peekTime, this.state.overlayPreview, opacity);
    }

    destroyOverlayPreview() {
        if (!this.state.overlayPreview) return;

        global.overlay_group.remove_child(this.state.overlayPreview);
        this.state.overlayPreview.destroy();
        this.state.set({overlayPreview: null});
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

        this.connectId = this.groupState.connect({
            hoverMenuClose: () => {
                this.shouldClose = true;
                this.close();
            },
            addThumbnailToMenu: (win) => this.addThumbnail(win),
            removeThumbnailFromMenu: (win) => {
                let index = findIndex(this.appThumbnails, (item) => item.metaWindow === win);
                if (index > -1) {
                    this.appThumbnails[index].destroy();
                    this.appThumbnails[index] = undefined;
                    this.appThumbnails.splice(index, 1);
                }
            }
        });

        this.appThumbnails = [];
    }

    onButtonPress() {
        if (this.state.settings.onClickThumbs && this.box.get_children().length > 1) {
            return;
        }
        this.shouldClose = true;
        setTimeout(() => this.close(), this.state.settings.thumbTimeout);
    }

    onMenuEnter() {
        if (this.state.panelEditMode ||
            (!this.isOpen && this.state.settings.onClickThumbs) ||
            this.state.menuOpen) {
            return false;
        }
        this.shouldClose = false;
        setTimeout(() => this.open(), this.state.settings.thumbTimeout);
    }

    onMenuLeave() {
        if (this.state.menuOpen || this.state.panelEditMode) {
            return false;
        }
        this.shouldClose = true;
        setTimeout(() => this.close(), this.state.settings.thumbTimeout);
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
            PopupMenu.PopupMenu.prototype.open.call(this, this.state.settings.animateThumbs);
        }
    }

    close (force) {
        if (!force && (!this.shouldClose
            || (!this.shouldClose && this.state.settings.onClickThumbs))
            || !this.groupState
            || !this.groupState.tooltip) {
            return;
        }
        if (!this.groupState.metaWindows || this.groupState.metaWindows.length === 0) {
            this.groupState.tooltip.set_text('');
            this.groupState.tooltip.hide();
        }
        if (this.isOpen) {
            PopupMenu.PopupMenu.prototype.close.call(this, this.state.settings.animateThumbs);
        }
        for (let i = 0; i < this.appThumbnails.length; i++) {
            this.appThumbnails[i].destroyOverlayPreview();
        }
    }

    onKeyPress(actor, e) {
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
        if (this.state.orientation === St.Side.TOP) {
            closeArg = Clutter.KEY_Up;
            args = [Clutter.KEY_Left, Clutter.KEY_Right];
        } else if (this.state.orientation === St.Side.BOTTOM) {
            closeArg = Clutter.KEY_Down;
            args = [Clutter.KEY_Right, Clutter.KEY_Left];
        } else if (this.state.orientation === St.Side.LEFT) {
            closeArg = Clutter.KEY_Left;
            args = [Clutter.KEY_Up, Clutter.KEY_Down];
        } else if (this.state.orientation === St.Side.RIGHT) {
            closeArg = Clutter.KEY_Right;
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
        } else if (symbol === Clutter.KEY_Return && entered) {
            this.appThumbnails[i].connectToWindow(null, 1);
        } else if (symbol === closeArg) {
            this.appThumbnails[i].onLeave();
            this.close(true);
        } else {
            return;
        }
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
        this.setStyleOptions(false);
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

    setStyleOptions(skipThumbnailIconResize) {
        if (this.willUnmount || !this.box) return;

        // The styling cannot be set correctly unless the menu is closed. Fortunately this
        // can be closed and reopened too quickly for the user to notice.
        if (this.isOpen) this.close(true);

        this.box.show();
        this.box.style = null;

        let thumbnailTheme = this.box.peek_theme_node();
        let padding = thumbnailTheme ? thumbnailTheme.get_horizontal_padding() : null;
        let thumbnailPadding = padding && (padding > 1 && padding < 21) ? padding : 10;
        this.box.style = `padding: ${thumbnailPadding / 2}px`;
        let boxTheme = this.box.peek_theme_node();
        padding = boxTheme ? boxTheme.get_vertical_padding() : null;
        let boxPadding = padding && padding > 0 ? padding : 3;
        this.box.style = `padding: ${boxPadding}px;`;

        if (skipThumbnailIconResize) return;

        if (this.state.settings.showIcons) {
            for (let i = 0; i < this.appThumbnails.length; i++) {
                if (this.appThumbnails[i]) {
                    this.appThumbnails[i].thumbnailIconSize();
                }
            }
        }
        if (this.isOpen) this.open();
    }

    setVerticalSetting() {
        if (this.state.orientation === St.Side.TOP || this.state.orientation === St.Side.BOTTOM) {
            this.box.vertical = this.state.settings.verticalThumbs;
        } else {
            this.box.vertical = true;
        }
        this.fullyRefreshThumbnails();
    }

    updateThumbnailPadding() {
        for (let i = 0; i < this.appThumbnails.length; i++) {
            if (this.appThumbnails[i]) {
                this.state.trigger('setThumbnailActorStyle', this.appThumbnails[i].actor);
            }
        }
    }

    updateThumbnailCloseButtonSize() {
        for (let i = 0; i < this.appThumbnails.length; i++) {
            if (this.appThumbnails[i]) {
                this.state.trigger('setThumbnailCloseButtonStyle', this.appThumbnails[i].button);
            }
        }
    }

    destroy() {
        this.willUnmount = true;
        if (!this.box) {
            return;
        }
        if (this.isOpen) {
            this.close();
        }
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
        PopupMenu.PopupMenu.prototype.destroy.call(this);
        this.groupState.disconnect(this.connectId);
        unref(this, RESERVE_KEYS);
    }
}

