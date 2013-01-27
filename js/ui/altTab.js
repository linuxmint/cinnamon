// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const St = imports.gi.St;

const Connector = imports.misc.connector;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const WindowUtils = imports.misc.windowUtils;

const POPUP_APPICON_SIZE = 96;
const POPUP_SCROLL_TIME = 0.10; // seconds
const POPUP_DELAY_TIMEOUT = 150; // milliseconds
const POPUP_FADE_OUT_TIME = 0.1; // seconds

const APP_ICON_HOVER_TIMEOUT = 200; // milliseconds

const DISABLE_HOVER_TIMEOUT = 500; // milliseconds

const THUMBNAIL_DEFAULT_SIZE = 256;
const THUMBNAIL_POPUP_TIME = 180; // milliseconds
const THUMBNAIL_FADE_TIME = 0.1; // seconds

const PREVIEW_DELAY_TIMEOUT = 180; // milliseconds
var PREVIEW_SWITCHER_FADEOUT_TIME = 0.5; // seconds

const iconSizes = [96, 80, 64, 48, 32, 22];

function mod(a, b) {
    return (a + b) % b;
}

function primaryModifier(mask) {
    if (mask == 0)
        return 0;

    let primary = 1;
    while (mask > 1) {
        mask >>= 1;
        primary <<= 1;
    }
    return primary;
}

function AltTabPopup() {
    this._init();
}

var g_allWsMode;

AltTabPopup.prototype = {
    _init : function() {
        this.actor = new Cinnamon.GenericContainer({ name: 'altTabPopup',
                                                  reactive: true,
                                                  visible: false });

        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));

        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));

        this._haveModal = false;
        this._modifierMask = 0;

        this._thumbnailTimeoutId = 0;
        this._motionTimeoutId = 0;
        this._initialDelayTimeoutId = 0;
        this._displayPreviewTimeoutId = 0;

        // Keeps track of the number of "primary" items, which is the number
        // of windows on the current workspace. This information is used to
        // size the icons to a size that fits the current working set.
        var _numPrimaryItems = 0;

        this.thumbnailsVisible = false;

        // Initially disable hover so we ignore the enter-event if
        // the switcher appears underneath the current pointer location
        this._disableHover();

        this._workspaceConnector = new Connector.Connector();
        for (let i = 0, numws = global.screen.n_workspaces; i < numws; ++i) {
            let workspace = global.screen.get_workspace_by_index(i);
                this._workspaceConnector.addConnection(workspace, 'window-removed', Lang.bind(this, function(ws, metaWindow) {
                    let index = -1;
                    this._appIcons.some(function(ai, ix) {
                        if (ai.window == metaWindow) {
                            index = ix;
                            return true; // break
                        }
                        return false; // continue
                    }, this);
                    if (index >= 0) {
                        if (index == this._currentApp) {
                            this._clearPreview();
                            this._destroyThumbnails();
                        }
                        this._appSwitcher._removeIcon(index);
                        this._select(this._currentApp);
                    }
                }));
        }

        Main.uiGroup.add_actor(this.actor);

        this._previewEnabled = false;
        this._iconsEnabled = false;
        this._thumbnailsEnabled = false;
        let styleSettings = global.settings.get_string("alttab-switcher-style");
        let features = styleSettings.split('+');
        let found = false;
        for (let i in features) {
            if (features[i] === 'icons') {
                this._iconsEnabled = true;
                found = true;
            }
            if (features[i] === 'preview') {
                this._previewEnabled = true;
                found = true;
            }
            if (features[i] === 'thumbnails') {
                this._thumbnailsEnabled = true;
                found = true;
            }
        }
        if (!found) {
            this._iconsEnabled = true;
        }
    },

    _getPreferredWidth: function (actor, forHeight, alloc) {
        alloc.min_size = global.screen_width;
        alloc.natural_size = global.screen_width;
    },

    _getPreferredHeight: function (actor, forWidth, alloc) {
        alloc.min_size = global.screen_height;
        alloc.natural_size = global.screen_height;
    },

    _allocate: function (actor, box, flags) {
        let childBox = new Clutter.ActorBox();
        let primary = Main.layoutManager.primaryMonitor;

        let leftPadding = this.actor.get_theme_node().get_padding(St.Side.LEFT);
        let rightPadding = this.actor.get_theme_node().get_padding(St.Side.RIGHT);
        let bottomPadding = this.actor.get_theme_node().get_padding(St.Side.BOTTOM);
        let vPadding = this.actor.get_theme_node().get_vertical_padding();
        let hPadding = leftPadding + rightPadding;

        // Allocate the appSwitcher
        // We select a size based on an icon size that does not overflow the screen
        let [childMinHeight, childNaturalHeight] = this._appSwitcher.actor.get_preferred_height(primary.width - hPadding);
        let [childMinWidth, childNaturalWidth] = this._appSwitcher.actor.get_preferred_width(childNaturalHeight);
        childBox.x1 = Math.max(primary.x + leftPadding, primary.x + Math.floor((primary.width - childNaturalWidth) / 2));
        childBox.x2 = Math.min(primary.x + primary.width - rightPadding, childBox.x1 + childNaturalWidth);
        childBox.y1 = primary.y + Math.floor((primary.height - childNaturalHeight) / 2);
        childBox.y2 = childBox.y1 + childNaturalHeight;
        this._appSwitcher.actor.allocate(childBox, flags);

        // Allocate the thumbnails
        // We try to avoid overflowing the screen so we base the resulting size on
        // those calculations
        if (this._thumbnails && this._appIcons.length > 0) {
            let icon = this._appIcons[this._currentApp].actor;
            let [posX, posY] = icon.get_transformed_position();
            let thumbnailCenter = posX + icon.width / 2;
            let [childMinWidth, childNaturalWidth] = this._thumbnails.actor.get_preferred_width(-1);
            childBox.x1 = Math.max(primary.x + leftPadding, Math.floor(thumbnailCenter - childNaturalWidth / 2));
            if (childBox.x1 + childNaturalWidth > primary.x + primary.width - hPadding) {
                let offset = childBox.x1 + childNaturalWidth - primary.width + hPadding;
                childBox.x1 = Math.max(primary.x + leftPadding, childBox.x1 - offset - hPadding);
            }

            let spacing = this.actor.get_theme_node().get_length('spacing');

            childBox.x2 = childBox.x1 +  childNaturalWidth;
            if (childBox.x2 > primary.x + primary.width - rightPadding)
                childBox.x2 = primary.x + primary.width - rightPadding;
            childBox.y1 = this._appSwitcher.actor.allocation.y2 + spacing;
            this._thumbnails.addClones(primary.y + primary.height - bottomPadding - childBox.y1);
            let [childMinHeight, childNaturalHeight] = this._thumbnails.actor.get_preferred_height(-1);
            childBox.y2 = childBox.y1 + childNaturalHeight;
            this._thumbnails.actor.allocate(childBox, flags);
        }
    },

    set _currentApp(val) {
        this._appSwitcher._curApp = val;
    },

    get _currentApp() {
        return this._appSwitcher._curApp;
    },

    get _appIcons() {
        return this._appSwitcher.icons;
    },

    refresh : function(binding, backward) {
        if (this._appSwitcher) {
            this._clearPreview();
            this._destroyThumbnails();
            this.actor.remove_actor(this._appSwitcher.actor);
            this._appSwitcher.actor.destroy();
        }
       
        // Find out the currently active window
        let wsWindows = Main.getTabList();
        let currentWindow = wsWindows.length > 0 ? wsWindows[0] : null;

        let windows = [];
        let [currentIndex, forwardIndex, backwardIndex] = [-1, -1, -1];

        g_allWsMode = binding.search(/group/) < 0;
        let activeWsIndex = global.screen.get_active_workspace_index();
        for (let i = 0, numws = global.screen.n_workspaces; i < numws; ++i) {
            let wlist = Main.getTabList(global.screen.get_workspace_by_index(i));
            if (wlist.length && i != activeWsIndex) {
                wlist = wlist.filter(function(window) {
                    // We don't want duplicates
                    return !window.is_on_all_workspaces();
                }, this);
            }
            if (g_allWsMode || i == activeWsIndex) {
                windows = windows.concat(wlist);
            }
            if (i == activeWsIndex && wlist.length) {
                currentIndex = windows.indexOf(currentWindow);
                // Quick alt-tabbing (with no use of the switcher) should only
                // select between the windows of the active workspace.
                forwardIndex = wlist.length > 1 ? currentIndex + 1 : currentIndex;
                backwardIndex = wlist.length > 1 ? currentIndex + wlist.length - 1 : currentIndex;
            }
        }
        // Size the icon bar primarily to fit the windows of the current workspace, with some
        // added space for windows from the other workspaces, if any.
        this._numPrimaryItems = Math.max(2, wsWindows.length + (windows.length > wsWindows.length ? 2 : 0));

        this._appSwitcher = new AppSwitcher(windows, this._showThumbnails, this);
        this.actor.add_actor(this._appSwitcher.actor);
        if (!this._iconsEnabled && !this._thumbnailsEnabled) {
            this._appSwitcher.actor.hide();
        }
        this._appSwitcher.connect('item-activated', Lang.bind(this, this._appActivated));

        // Need to force an allocation so we can figure out whether we
        // need to scroll when selecting
        this._appSwitcher.actor.opacity = 0;
        this.actor.show();
        this.actor.get_allocation_box();

        // Make the initial selection
        if (this._appIcons.length > 0 && currentIndex >= 0) {
            if (binding == 'no-switch-windows') {
                this._select(currentIndex);
            } else if (backward) {
                this._select(backwardIndex);
            } else {
                this._select(forwardIndex);
            }
        }
        // There's a race condition; if the user released Alt before
        // we got the grab, then we won't be notified. (See
        // https://bugzilla.gnome.org/show_bug.cgi?id=596695 for
        // details.) So we check now. (Have to do this after updating
        // selection.)
        if (!this._persistent) {
            let [x, y, mods] = global.get_pointer();
            if (!(mods & this._modifierMask)) {
                this._finish();
                return false;
            }
        }

        if (this._appIcons.length > 0) {
            // We delay showing the popup so that fast Alt+Tab users aren't
            // disturbed by the popup briefly flashing.
            this._initialDelayTimeoutId = Mainloop.timeout_add(POPUP_DELAY_TIMEOUT,
                Lang.bind(this, function () {
                    this._appSwitcher.actor.opacity = 255;
                    this._initialDelayTimeoutId = 0;
                }));
        }
        
        return true;
    },

    show : function(backward, binding, mask) {
        let screen = global.screen;
        let display = screen.get_display();

        this._showThumbnails = (this._thumbnailsEnabled && !this._iconsEnabled) || this._previewEnabled;

        if (!Main.pushModal(this.actor))
            return false;
        this._haveModal = true;
        this._modifierMask = primaryModifier(mask);
        if (!this.refresh(binding, backward)) {
            return false;
        }
        
        this.actor.connect('key-press-event', Lang.bind(this, this._keyPressEvent));
        this.actor.connect('key-release-event', Lang.bind(this, this._keyReleaseEvent));

        this.actor.connect('button-press-event', Lang.bind(this, this._clickedOutside));
        this.actor.connect('scroll-event', Lang.bind(this, this._onScroll));
        return true;
    },

    _nextApp : function() {
        return mod(this._currentApp + 1, this._appIcons.length);
    },
    _previousApp : function() {
        return mod(this._currentApp - 1, this._appIcons.length);
    },

    _keyPressEvent : function(actor, event) {
        let that = this;
        var switchWorkspace = function(direction) {
            if (global.screen.n_workspaces < 2) {
                return false;
            }
            let current = global.screen.get_active_workspace_index();
            let nextIndex = (global.screen.n_workspaces + current + direction) % global.screen.n_workspaces;
            global.screen.get_workspace_by_index(nextIndex).activate(global.get_current_time());
            if (current == global.screen.get_active_workspace_index()) {
                return false;
            }
            Main.wm.showWorkspaceOSD();
            that.refresh('no-switch-windows');
            return true;
        };
        let keysym = event.get_key_symbol();
        let event_state = Cinnamon.get_event_state(event);
        let backwards = event_state & Clutter.ModifierType.SHIFT_MASK;
        let ctrlDown = event_state & Clutter.ModifierType.CONTROL_MASK;
        let action = global.display.get_keybinding_action(event.get_key_code(), event_state);

        this._disableHover();
        const SCROLL_AMOUNT = 5;

        if (keysym == Clutter.Escape) {
            this.destroy();
        } else if (keysym == Clutter.KEY_space && !this._persistent) {
            this._persistent = true;
        } else if (this._persistent && keysym == Clutter.Tab) {
            this._select(this._nextApp());
        } else if (this._persistent && keysym == Clutter.ISO_Left_Tab) {
            this._select(this._previousApp());
        } else if (this._persistent && keysym == Clutter.w && ctrlDown) {
            if (this._currentApp >= 0) {
                this._appIcons[this._currentApp].window.delete(global.get_current_time());
            }
        } else if (keysym == Clutter.Home || keysym == Clutter.KP_Home) {
            this._select(0);
        } else if (keysym == Clutter.End || keysym == Clutter.KP_End) {
            this._select(this._appIcons.length - 1);
        } else if (keysym == Clutter.Page_Down || keysym == Clutter.KP_Page_Down) {
            this._select(Math.min(this._appIcons.length - 1, this._currentApp + SCROLL_AMOUNT));
        } else if (keysym == Clutter.Page_Up || keysym == Clutter.KP_Page_Up) {
            this._select(Math.max(0, this._currentApp - SCROLL_AMOUNT));
        } else if (keysym == Clutter.Return) {
            this._finish();
            return true;
        } else if (action == Meta.KeyBindingAction.SWITCH_GROUP || action == Meta.KeyBindingAction.SWITCH_WINDOWS) {
            this._select(backwards ? this._previousApp() : this._nextApp());
        } else {
            if (keysym == Clutter.Left) {
                if (ctrlDown) {
                    if (switchWorkspace(-1)) {
                        return false;
                    }
                }
                this._select(this._previousApp());
            }
            else if (keysym == Clutter.Right) {
                if (ctrlDown) {
                    if (switchWorkspace(1)) {
                        return false;
                    }
                }
                this._select(this._nextApp());
            }
        }

        return true;
    },

    _keyReleaseEvent : function(actor, event) {
        let [x, y, mods] = global.get_pointer();
        let state = mods & this._modifierMask;

        if (state == 0 && !this._persistent)
            this._finish();

        return true;
    },

    _onScroll : function(actor, event) {
        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.UP) {
            this._select(this._previousApp());
        } else if (direction == Clutter.ScrollDirection.DOWN) {
            this._select(this._nextApp());
        }
    },

    _clickedOutside : function(actor, event) {
        this.destroy();
    },

    _appActivated : function(appSwitcher, n) {
        // If the user clicks on the selected app, activate the
        // selected window; otherwise (e.g., they click on an app while
        // !mouseActive) activate the clicked-on app.
        this._appIcons[n].app.activate_window(this._appIcons[n].window, global.get_current_time());
        this.destroy();
    },

    _windowActivated : function(thumbnailList, n) {
        let appIcon = this._appIcons[this._currentApp];
        Main.activateWindow(appIcon.window);
        this.destroy();
    },

    _windowEntered : function(thumbnailList, n) {
        if (!this._mouseActive)
            return;

        this._select(this._currentApp, n);
    },

    _disableHover : function() {
        this._mouseActive = false;

        if (this._motionTimeoutId != 0)
            Mainloop.source_remove(this._motionTimeoutId);

        this._motionTimeoutId = Mainloop.timeout_add(DISABLE_HOVER_TIMEOUT, Lang.bind(this, this._mouseTimedOut));
    },

    _mouseTimedOut : function() {
        this._motionTimeoutId = 0;
        this._mouseActive = true;
    },

    _finish : function() {
        if (this._appIcons.length > 0 && this._currentApp > -1) {
            let app = this._appIcons[this._currentApp];
            Main.activateWindow(app.window);
        }
        this.destroy();
    },

    _popModal: function() {
        if (this._haveModal) {
            Main.popModal(this.actor);
            this._haveModal = false;
        }
    },

    destroy : function() {
        this._workspaceConnector.destroy();
        var doDestroy = Lang.bind(this, function() {
           Main.uiGroup.remove_actor(this.actor);
           this.actor.destroy();
        });
        
        this._popModal();
        if (this.actor.visible) {
            Tweener.addTween(this.actor,
                             { opacity: 0,
                               time: POPUP_FADE_OUT_TIME,
                               transition: 'easeOutQuad',
                               onComplete: doDestroy
                             });
        } else {
            doDestroy();
        }
    },

    _onDestroy : function() {
        this._popModal();

        if (this._motionTimeoutId)
            Mainloop.source_remove(this._motionTimeoutId);
        if (this._thumbnailTimeoutId)
            Mainloop.source_remove(this._thumbnailTimeoutId);
        if (this._initialDelayTimeoutId)
            Mainloop.source_remove(this._initialDelayTimeoutId);
        if (this._displayPreviewTimeoutId)
            Mainloop.source_remove(this._displayPreviewTimeoutId);
    },
    
    _clearPreview: function() {
        if (this._previewClones) {
            this._previewClones.destroy();
            this._previewClones = null;
        }
    },
    
    _doWindowPreview: function() {
        if (!this._previewEnabled || this._appIcons.length < 1 || this._currentApp < 0)
        {
            return;
        }

        let showPreview = function() {
            this._displayPreviewTimeoutId = null;
            if (this._currentApp < 0) {return;}

            let childBox = new Clutter.ActorBox();

            let window = this._appIcons[this._currentApp].window;
            let previewClones = new St.Group();
            this.actor.add_actor(previewClones);

            let clones = WindowUtils.createWindowClone(window, null, true, false);
            for (let i = 0; i < clones.length; i++) {
                let clone = clones[i];
                previewClones.add_actor(clone.actor);
                let [width, height] = clone.actor.get_size();
                childBox.x1 = clone.x;
                childBox.x2 = clone.x + width;
                childBox.y1 = clone.y;
                childBox.y2 = clone.y + height;
                clone.actor.allocate(childBox, 0);
            }
            previewClones.lower(this._appSwitcher.actor);

            this._clearPreview();
            this._previewClones = previewClones;

            if (!this._previewBackdrop) {
                let backdrop = this._previewBackdrop = new St.Bin();
                this.actor.add_actor(backdrop);
                // Make sure that the backdrop does not overlap the switcher.
                backdrop.lower(this._appSwitcher.actor);
                backdrop.lower(previewClones);
                childBox.x1 = this.actor.x;
                childBox.x2 = this.actor.x + this.actor.width;
                childBox.y1 = this.actor.y;
                childBox.y2 = this.actor.y + this.actor.height;
                backdrop.allocate(childBox, 0);
                backdrop.style = "background-color: rgba(0,0,0,0.9)";
            }
        }; // showPreview

        // Use a cancellable timeout to avoid flickering effect when tabbing rapidly through the set.
        if (this._displayPreviewTimeoutId) {
            Mainloop.source_remove(this._displayPreviewTimeoutId);
        }
        let delay = PREVIEW_DELAY_TIMEOUT;
        this._displayPreviewTimeoutId = Mainloop.timeout_add(delay, Lang.bind(this, showPreview));
    },
    
    /**
     * _select:
     * @app: index of the app to select
     */
    _select : function(app) {
        if (app != this._currentApp) {
            this._destroyThumbnails();
        }

        if (this._thumbnailTimeoutId != 0) {
            Mainloop.source_remove(this._thumbnailTimeoutId);
            this._thumbnailTimeoutId = 0;
        }

        this._currentApp = app;
        if (this._appIcons.length < 1) {
            return;
        }

        this._appSwitcher.highlight(app, false);
        this._doWindowPreview();
        if (this._thumbnailsEnabled && this._iconsEnabled) {
            this._thumbnailTimeoutId = Mainloop.timeout_add(
                THUMBNAIL_POPUP_TIME, Lang.bind(this, function() {
                    if (!this._thumbnails)
                        this._createThumbnails();
                    this._thumbnails.highlight(0, false);
            }));
        }
    },

    _timeoutPopupThumbnails: function() {
        if (!this._thumbnails)
            this._createThumbnails();
        this._thumbnailTimeoutId = 0;
        this._thumbnailsFocused = false;
        return false;
    },

    _destroyThumbnails : function() {
        if (!this._thumbnails) {
            return;
        }
        this.thumbnailsVisible = false;
        this._thumbnails.actor.destroy();
        this._thumbnails = null;
    },

    _createThumbnails : function() {
        this._thumbnails = new ThumbnailList (this._appIcons[this._currentApp].cachedWindows);
        this._thumbnails.connect('item-activated', Lang.bind(this, this._windowActivated));

        this.actor.add_actor(this._thumbnails.actor);

        // Need to force an allocation so we can figure out whether we
        // need to scroll when selecting
        this._thumbnails.actor.get_allocation_box();

        this._thumbnails.actor.opacity = 0;
        Tweener.addTween(this._thumbnails.actor,
                         { opacity: 255,
                           time: THUMBNAIL_FADE_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this, function () { this.thumbnailsVisible = true; })
                         });
    }
};

function SwitcherList(squareItems) {
    this._init(squareItems);
}

SwitcherList.prototype = {
    _init : function(squareItems) {
        this.actor = new Cinnamon.GenericContainer({ style_class: 'switcher-list' });
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocateTop));
        this.actor.connect('destroy', Lang.bind(this, function() {
            if (this._highlightTimeout) {Mainloop.source_remove(this._highlightTimeout);}
        }));

        // Here we use a GenericContainer so that we can force all the
        // children except the separator to have the same width.
        this._list = new Cinnamon.GenericContainer({ style_class: 'switcher-list-item-container' });
        this._list.spacing = 0;
        this._list.connect('style-changed', Lang.bind(this, function() {
                                                        this._list.spacing = this._list.get_theme_node().get_length('spacing');
                                                     }));

        this._list.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this._list.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this._list.connect('allocate', Lang.bind(this, this._allocate));

        this._clipBin = new St.Bin({style_class: 'cbin'});
        this._clipBin.child = this._list;
        this.actor.add_actor(this._clipBin);

        this._leftGradient = new St.BoxLayout({style_class: 'thumbnail-scroll-gradient-left', vertical: true});
        this._rightGradient = new St.BoxLayout({style_class: 'thumbnail-scroll-gradient-right', vertical: true});
        this.actor.add_actor(this._leftGradient);
        this.actor.add_actor(this._rightGradient);

        // Those arrows indicate whether scrolling in one direction is possible
        this._leftArrow = new St.DrawingArea({ style_class: 'switcher-arrow',
                                               pseudo_class: 'highlighted' });
        this._leftArrow.connect('repaint', Lang.bind(this,
            function() { _drawArrow(this._leftArrow, St.Side.LEFT); }));
        this._rightArrow = new St.DrawingArea({ style_class: 'switcher-arrow',
                                                pseudo_class: 'highlighted' });
        this._rightArrow.connect('repaint', Lang.bind(this,
            function() { _drawArrow(this._rightArrow, St.Side.RIGHT); }));

        this.actor.add_actor(this._leftArrow);
        this.actor.add_actor(this._rightArrow);

        this._items = [];
        this._highlighted = -1;
        this._separators = [];
        this._squareItems = squareItems;
        this._minSize = 0;
        this._scrollableRight = true;
        this._scrollableLeft = false;
    },

    _allocateTop: function(actor, box, flags) {
        let leftPadding = this.actor.get_theme_node().get_padding(St.Side.LEFT);
        let rightPadding = this.actor.get_theme_node().get_padding(St.Side.RIGHT);

        let childBox = new Clutter.ActorBox();
        let scrollable = this._minSize > box.x2 - box.x1;

        this._clipBin.allocate(box, flags);

        childBox.x1 = 0;
        childBox.y1 = 0;
        childBox.x2 = this._leftGradient.width;
        childBox.y2 = this.actor.height;
        this._leftGradient.allocate(childBox, flags);
        this._leftGradient.opacity = (this._scrollableLeft && scrollable) ? 255 : 0;

        childBox.x1 = (this.actor.allocation.x2 - this.actor.allocation.x1) - this._rightGradient.width;
        childBox.y1 = 0;
        childBox.x2 = childBox.x1 + this._rightGradient.width;
        childBox.y2 = this.actor.height;
        this._rightGradient.allocate(childBox, flags);
        this._rightGradient.opacity = (this._scrollableRight && scrollable) ? 255 : 0;

        let arrowWidth = Math.floor(leftPadding / 3);
        let arrowHeight = arrowWidth * 2;
        childBox.x1 = leftPadding / 2;
        childBox.y1 = this.actor.height / 2 - arrowWidth;
        childBox.x2 = childBox.x1 + arrowWidth;
        childBox.y2 = childBox.y1 + arrowHeight;
        this._leftArrow.allocate(childBox, flags);
        this._leftArrow.opacity = this._leftGradient.opacity;

        arrowWidth = Math.floor(rightPadding / 3);
        arrowHeight = arrowWidth * 2;
        childBox.x1 = this.actor.width - arrowWidth - rightPadding / 2;
        childBox.y1 = this.actor.height / 2 - arrowWidth;
        childBox.x2 = childBox.x1 + arrowWidth;
        childBox.y2 = childBox.y1 + arrowHeight;
        this._rightArrow.allocate(childBox, flags);
        this._rightArrow.opacity = this._rightGradient.opacity;
    },

    addItem : function(item, label, extra_style) {
        let bbox = new St.Button({ style_class: 'item-box',
                                   reactive: true });
        if (extra_style) {
            bbox.add_style_class_name(extra_style);
        }

        bbox.set_child(item);
        this._list.add_actor(bbox);

        let n = this._items.length;
        bbox.connect('clicked', Lang.bind(this, function() { this._onItemClicked(n); }));

        bbox.label_actor = label;

        this._items.push(bbox);
    },

    _onItemClicked: function (index) {
        this._itemActivated(index);
    },

    addSeparator: function () {
        let box = new St.Bin({ style_class: 'separator' });
        this._separators.push(box);
        this._list.add_actor(box);
    },

    highlight: function(index, justOutline) {
        if (this._highlightTimeout) {
            Mainloop.source_remove(this._highlightTimeout); this._highlightTimeout = 0;
        }
        this._highlightTimeout = Mainloop.timeout_add(25, Lang.bind(this, function() {
            this._highlightTimeout = 0;

            let prevIndex = this._highlighted;
            // If previous index is negative, we are probably initializing, and we want
            // to show as many of the current workspace's windows as possible.

            let direction = prevIndex == -1 ? 1 : index - prevIndex;
            if (this._highlighted != -1) {
                this._items[this._highlighted].remove_style_pseudo_class('outlined');
                this._items[this._highlighted].remove_style_pseudo_class('selected');
            }
            this._highlighted = index;
            if (this._highlighted != -1) {
                if (justOutline)
                    this._items[this._highlighted].add_style_pseudo_class('outlined');
                else
                    this._items[this._highlighted].add_style_pseudo_class('selected');
            }
            // If we're close to either the left or the right edge, we want to scroll
            // the edge-most items into view.
            let scrollMax = prevIndex == -1 && this._altTabPopup ? this._altTabPopup._numPrimaryItems : Math.min(5, Math.floor(this._items.length/4));
            let ixScroll = direction > 0 ?
                Math.min(index + scrollMax, this._items.length - 1) : // right
                Math.max(index - scrollMax, 0); // left

            let [absItemX, absItemY] = this._items[ixScroll].get_transformed_position();
            let [result, posX, posY] = this.actor.transform_stage_point(absItemX, 0);
            let [containerWidth, containerHeight] = this.actor.get_transformed_size();

            if (direction > 0) {
                if (ixScroll == this._items.length - 1) {
                    this._scrollableRight = false;
                    this._rightArrow.opacity = this._rightGradient.opacity = 0;
                }
                if (posX + this._items[ixScroll].get_width() >= containerWidth) {
                    Tweener.removeTweens(this._list);
                    this._scrollableLeft = true;
                    let monitor = Main.layoutManager.primaryMonitor;
                    let padding = this.actor.get_theme_node().get_horizontal_padding();
                    let parentPadding = this.actor.get_parent().get_theme_node().get_horizontal_padding();
                    let x = this._items[ixScroll].allocation.x2 - monitor.width + padding + parentPadding;
                    Tweener.addTween(this._list, { anchor_x: x,
                        time: prevIndex < 0 ? 0 : POPUP_SCROLL_TIME,
                        transition: 'linear'
                    });
                }
            }
            else if (direction < 0) {
                if (ixScroll == 0) {
                    this._scrollableLeft = false;
                    this._leftArrow.opacity = this._leftGradient.opacity = 0;
                }
                let padding = this.actor.get_theme_node().get_horizontal_padding();
                if (posX <= padding) {
                    Tweener.removeTweens(this._list);
                    this._scrollableRight = true;
                    let x = (ixScroll == 0 ? this._list.get_children() : this._items)[ixScroll].allocation.x1;
                    Tweener.addTween(this._list, { anchor_x: x,
                        time: prevIndex < 0 ? 0 : POPUP_SCROLL_TIME,
                        transition: 'linear'
                    });
                }
            }
        }));
    },

    _itemActivated: function(n) {
        this.emit('item-activated', n);
    },

    _maxChildWidth: function (forHeight) {
        let maxChildMin = 0;
        let maxChildNat = 0;

        for (let i = 0; i < this._items.length; i++) {
            let [childMin, childNat] = this._items[i].get_preferred_width(forHeight);
            maxChildMin = Math.max(childMin, maxChildMin);
            maxChildNat = Math.max(childNat, maxChildNat);

            if (this._squareItems) {
                let [childMin, childNat] = this._items[i].get_preferred_height(-1);
                maxChildMin = Math.max(childMin, maxChildMin);
                maxChildNat = Math.max(childNat, maxChildNat);
            }
        }

        return [maxChildMin, maxChildNat];
    },

    _getPreferredWidth: function (actor, forHeight, alloc) {
        let [maxChildMin, maxChildNat] = this._maxChildWidth(forHeight);

        let separatorWidth = 0;
        if (this._separators.length) {
            let [sepMin, sepNat] = this._separators[0].get_preferred_width(forHeight);
            separatorWidth = Math.max(1, this._separators.length - 1) * (sepNat + this._list.spacing);
        }

        let totalSpacing = this._list.spacing * Math.max(1, (this._items.length - 1));
        alloc.min_size = this._items.length * maxChildMin + separatorWidth + totalSpacing;
        alloc.natural_size = alloc.min_size;
        this._minSize = alloc.min_size;
    },

    _getPreferredHeight: function (actor, forWidth, alloc) {
        let maxChildMin = 0;
        let maxChildNat = 0;

        for (let i = 0; i < this._items.length; i++) {
            let [childMin, childNat] = this._items[i].get_preferred_height(-1);
            maxChildMin = Math.max(childMin, maxChildMin);
            maxChildNat = Math.max(childNat, maxChildNat);
        }

        if (this._squareItems) {
            let [childMin, childNat] = this._maxChildWidth(-1);
            maxChildMin = Math.max(childMin, maxChildMin);
            maxChildNat = maxChildMin;
        }

        alloc.min_size = maxChildMin;
        alloc.natural_size = maxChildNat;
    },

    _allocate: function (actor, box, flags) {
        let childHeight = box.y2 - box.y1;

        let [maxChildMin, maxChildNat] = this._maxChildWidth(childHeight);
        let totalSpacing = this._list.spacing * (this._items.length - 1);

        let separatorWidth = 0;
        if (this._separators.length) {
            let [sepMin, sepNat] = this._separators[0].get_preferred_width(childHeight);
            separatorWidth = sepNat;
            totalSpacing += Math.max(1, this._separators.length - 1) * this._list.spacing;
        }

        let childWidth = Math.floor(Math.max(0, box.x2 - box.x1 - totalSpacing - separatorWidth) / this._items.length);

        let x = 0;
        let children = this._list.get_children();
        let childBox = new Clutter.ActorBox();

        let primary = Main.layoutManager.primaryMonitor;
        let parentRightPadding = this.actor.get_parent().get_theme_node().get_padding(St.Side.RIGHT);
        if (this.actor.allocation.x2 == primary.x + primary.width - parentRightPadding) {
            if (this._squareItems)
                childWidth = childHeight;
            else {
                let ixxi = (this._highlighted + this._items.length) % this._items.length;
                let [childMin, childNat] = this._items[ixxi].get_preferred_width(childHeight);
                childWidth = childMin;
            }
        }

        for (let i = 0; i < children.length; i++) {
            if (this._items.indexOf(children[i]) != -1) {
                let [childMin, childNat] = children[i].get_preferred_height(childWidth);
                let vSpacing = (childHeight - childNat) / 2;
                childBox.x1 = x;
                childBox.y1 = vSpacing;
                childBox.x2 = x + childWidth;
                childBox.y2 = childBox.y1 + childNat;
                children[i].allocate(childBox, flags);

                x += this._list.spacing + childWidth;
            } else if (this._separators.indexOf(children[i]) != -1) {
                // We want the separator to be more compact than the rest.
                childBox.x1 = x;
                childBox.y1 = 0;
                childBox.x2 = x + separatorWidth;
                childBox.y2 = childHeight;
                children[i].allocate(childBox, flags);
                x += this._list.spacing + separatorWidth;
            } else {
                // Something else, eg, AppSwitcher's arrows;
                // we don't allocate it.
            }
        }

        let leftPadding = this.actor.get_theme_node().get_padding(St.Side.LEFT);
        let rightPadding = this.actor.get_theme_node().get_padding(St.Side.RIGHT);
        let topPadding = this.actor.get_theme_node().get_padding(St.Side.TOP);
        let bottomPadding = this.actor.get_theme_node().get_padding(St.Side.BOTTOM);

        // Clip the area for scrolling
        this._clipBin.set_clip(0, -topPadding, (this.actor.allocation.x2 - this.actor.allocation.x1) - leftPadding - rightPadding, this.actor.height + bottomPadding);
    }
};

Signals.addSignalMethods(SwitcherList.prototype);

function AppIcon(window, showThumbnail) {
    this._init(window, showThumbnail);
}

AppIcon.prototype = {
    _init: function(window, showThumbnail) {
        this.window = window;
        this.showThumbnail = showThumbnail;
        let tracker = Cinnamon.WindowTracker.get_default();
        this.app = tracker.get_window_app(window);
        this.actor = new St.BoxLayout({ style_class: 'alt-tab-app',
                                         vertical: true });
        this.icon = null;
        this._iconBin = new St.Bin();

        this.actor.add(this._iconBin, { x_fill: false, y_fill: false } );
        let title = window.get_title();
        this.label = new St.Label({ text: typeof(title) != 'undefined' ? title : (this.app ? this.app.get_name() : "")});
        this.label.clutter_text.line_wrap = true;
        this._label_bin = new St.Bin({ x_align: St.Align.MIDDLE });
        this._label_bin.add_actor(this.label);
        this.actor.add(this._label_bin);
    },

    set_size: function(size, focused) {
        if (this.icon) {this.icon.destroy();}
        if (this.showThumbnail) {
            this.icon = new St.Group();
            let clones = WindowUtils.createWindowClone(this.window, size, true, true);
            for (i in clones) {
                let clone = clones[i];
                this.icon.add_actor(clone.actor);
                // the following 2 lines are used when cloning without positions (param #4 = false)
                //let [width, height] = clone.actor.get_size();
                //clone.actor.set_position(Math.round((size - width) / 2), Math.round((size - height) / 2));
                clone.actor.set_position(clone.x, clone.y);
            }
            let [width, height] = clones[0].actor.get_size();
            clones[0].actor.set_position(Math.floor((size - width)/2), 0);
            let isize = Math.max(Math.ceil(size*(!focused?3/4:7/8)), iconSizes[iconSizes.length - 1]);
            let icon = this.app ?
                this.app.create_icon_texture(isize) :
                new St.Icon({ icon_name: 'application-default-icon',
                              icon_type: St.IconType.FULLCOLOR,
                              icon_size: isize });
            this.icon.add_actor(icon);
            icon.set_position(Math.floor((size - isize)/2), size - isize);
        }
        else {
            this.icon = this.app ?
                this.app.create_icon_texture(size) :
                new St.Icon({ icon_name: 'application-default-icon',
                              icon_type: St.IconType.FULLCOLOR,
                              icon_size: size });
        }
        // Make some room for the window title.
        this._label_bin.set_size(Math.floor(size * 1.2), Math.floor(size/2));
        this._iconBin.child = this.icon;
        this._iconBin.set_size(size, size);
    }
};

function AppSwitcher() {
    this._init.apply(this, arguments);
}

AppSwitcher.prototype = {
    __proto__ : SwitcherList.prototype,

    _init : function(windows, showThumbnails, altTabPopup) {
        SwitcherList.prototype._init.call(this, false);

        // Construct the AppIcons, add to the popup
        let activeWorkspace = global.screen.get_active_workspace();
        let workspaceIcons = [];
        for (let i = 0; i < windows.length; i++) {
            let appIcon = new AppIcon(windows[i], showThumbnails);
            // Cache the window list now; we don't handle dynamic changes here,
            // and we don't want to be continually retrieving it
            appIcon.cachedWindows = [windows[i]];
            workspaceIcons.push(appIcon);
        }

        this.icons = [];
        this._arrows = [];
        let lastWsIndex = 0;
        workspaceIcons.forEach(function(icon) {
            let wsIndex = icon.window.get_workspace().index();
            for (let i = wsIndex - lastWsIndex; g_allWsMode && i > 0; --i) {
                this.addSeparator();
                lastWsIndex = wsIndex;
            }
            this._addIcon(icon);
        }, this);

        this._prevApp = this._curApp = -1;
        this._iconSize = 0;
        this._altTabPopup = altTabPopup;
        this._mouseTimeOutId = 0;
    },

    _getPreferredHeight: function (actor, forWidth, alloc) {
        if (this._items.length < 1) {
            alloc.min_size = alloc.natural_size = 32;
            return;
        }
        let modelIndex = 0;
        for (let i = 0; i <  this._items.length && this._items.length > 1; ++i) {
            // We don't want the model index to be the currently selected index,
            // or the previous index, since that may lead to differing sizes on
            // scrolling through the set.
            let ii = (this._curApp + 2 + i + this._items.length) % this._items.length;
            if (this._items[ii].style_class == 'item-box') {
                modelIndex = ii;
                break;
            }
        }
        let themeNode = this._items[modelIndex].get_theme_node();
        let iconPadding = themeNode.get_horizontal_padding();
        let iconBorder = themeNode.get_border_width(St.Side.LEFT) + themeNode.get_border_width(St.Side.RIGHT);
        let [iconMinHeight, iconNaturalHeight] = this.icons[modelIndex].label.get_preferred_height(-1);
        let iconSpacing = iconNaturalHeight + iconPadding + iconBorder;
        let totalSpacing = this._list.spacing * (this._items.length - 1);
        if (this._separators.length)
           totalSpacing += Math.max(1, this._separators.length - 1) * (this._separators[0].width + this._list.spacing);

        // We just assume the whole screen here due to weirdness happing with the passed width
        let primary = Main.layoutManager.primaryMonitor;
        let parentPadding = this.actor.get_parent().get_theme_node().get_horizontal_padding();
        let availWidth = primary.width - parentPadding - this.actor.get_theme_node().get_horizontal_padding();
        let height = 0;

        for(let i =  0; i < iconSizes.length; i++) {
                this._iconSize = iconSizes[i];
                height = iconSizes[i] + iconSpacing;
                let w = height * this._altTabPopup._numPrimaryItems + totalSpacing;
                if (w <= availWidth)
                        break;
        }

        if (this._items.length == 1) {
            this._iconSize = iconSizes[0];
            height = iconSizes[0] + iconSpacing;
        }

        for(let i = 0; i < this.icons.length; i++) {
            if (this.icons[i].icon != null)
                break;
            this.icons[i].set_size(this._iconSize);
        }

        alloc.min_size = height;
        alloc.natural_size = height;
    },

    _allocate: function (actor, box, flags) {
        // Allocate the main list items
        SwitcherList.prototype._allocate.call(this, actor, box, flags);

        let arrowHeight = Math.floor(this.actor.get_theme_node().get_padding(St.Side.BOTTOM) / 3);
        let arrowWidth = arrowHeight * 2;

        // Now allocate each arrow underneath its item
        let childBox = new Clutter.ActorBox();
        for (let i = 0; i < this._items.length; i++) {
            let itemBox = this._items[i].allocation;
            childBox.x1 = Math.floor(itemBox.x1 + (itemBox.x2 - itemBox.x1 - arrowWidth) / 2);
            childBox.x2 = childBox.x1 + arrowWidth;
            childBox.y1 = itemBox.y2 + arrowHeight;
            childBox.y2 = childBox.y1 + arrowHeight;
            this._arrows[i].allocate(childBox, flags);
        }
    },

    // We override SwitcherList's highlight() method to also deal with
    // the AppSwitcher->ThumbnailList arrows.
    highlight : function(n, justOutline) {
        if (this._prevApp != -1) {
            this._arrows[this._prevApp].hide();
            this.icons[this._prevApp].set_size(this._iconSize);
        }

        SwitcherList.prototype.highlight.call(this, n, justOutline);
        this._prevApp = this._curApp = n;
 
        if (this._curApp != -1 && this._altTabPopup._iconsEnabled) {
            this.icons[this._curApp].set_size(this._iconSize, true);
            this._arrows[this._curApp].show();
        }
    },

    _removeIcon : function(index) {
        let icon = this.icons[index];
        this.icons.splice(index, 1);
        this._items[index].destroy();
        this._items.splice(index, 1);
        this._arrows[index].destroy();
        this._arrows.splice(index, 1);
        if (index < this._prevApp) {
            this._prevApp = this._prevApp - 1;
        }
        else if (index == this._prevApp) {
            this._prevApp = -1;
        }
        
        if (index < this._curApp) {
            this._highlighted = this._curApp = this._curApp - 1;
        }
        else if (index == this._curApp) {
            this._curApp = Math.min(this._curApp, this.icons.length - 1);
            this._highlighted = -1;
        }
        icon.actor.destroy();
    },

    _addIcon : function(appIcon) {
        this.icons.push(appIcon);
        let is_urgent = appIcon.window.is_demanding_attention() || appIcon.window.is_urgent();
        let style = is_urgent ? "window-list-item-demands-attention" : null;
        this.addItem(appIcon.actor, appIcon.label, style);

        let n = this._arrows.length;
        let arrow = new St.DrawingArea({ style_class: 'switcher-arrow' });
        arrow.connect('repaint', Lang.bind(this, function() {
            _drawArrow(arrow, this._altTabPopup._thumbnailsEnabled ? St.Side.BOTTOM : St.Side.TOP);
        }));
        this._list.add_actor(arrow);
        this._arrows.push(arrow);

        if (appIcon.cachedWindows.length == 1) {
            arrow.hide();
        }
    }
};

function ThumbnailList(windows) {
    this._init(windows);
}

ThumbnailList.prototype = {
    __proto__ : SwitcherList.prototype,

    _init : function(windows) {
        SwitcherList.prototype._init.call(this);

        let activeWorkspace = global.screen.get_active_workspace();

        // We fake the value of 'separatorAdded' when the app has no window
        // on the current workspace, to avoid displaying a useless separator in
        // that case.
        let separatorAdded = windows.length == 0 || windows[0].get_workspace() != activeWorkspace;

        this._labels = new Array();
        this._thumbnailBins = new Array();
        this._clones = new Array();
        this._windows = windows;

        for (let i = 0; i < windows.length; i++) {
            if (!separatorAdded && windows[i].get_workspace() != activeWorkspace) {
              this.addSeparator();
              separatorAdded = true;
            }

            let box = new St.BoxLayout({ style_class: 'thumbnail-box',
                                         vertical: true });

            let bin = new St.Bin({ style_class: 'thumbnail' });

            box.add_actor(bin);
            this._thumbnailBins.push(bin);

            let title = windows[i].get_title();
            if (title) {
                let name = new St.Label({ text: title });
                // St.Label doesn't support text-align so use a Bin
                let bin = new St.Bin({ x_align: St.Align.MIDDLE });
                this._labels.push(bin);
                bin.add_actor(name);
                box.add_actor(bin);

                this.addItem(box, name);
            } else {
                this.addItem(box, null);
            }

        }
    },

    addClones : function (availHeight) {
        if (!this._thumbnailBins.length)
            return;
        let totalPadding = this._items[0].get_theme_node().get_horizontal_padding() + this._items[0].get_theme_node().get_vertical_padding();
        totalPadding += this.actor.get_theme_node().get_horizontal_padding() + this.actor.get_theme_node().get_vertical_padding();
        let [labelMinHeight, labelNaturalHeight] = this._labels.length > 0 ?
            this._labels[0].get_preferred_height(-1) : [0, 0];
        let spacing = this._items[0].child.get_theme_node().get_length('spacing');

        availHeight = Math.min(availHeight - labelNaturalHeight - totalPadding - spacing, THUMBNAIL_DEFAULT_SIZE);
        let binHeight = availHeight + this._items[0].get_theme_node().get_vertical_padding() + this.actor.get_theme_node().get_vertical_padding() - spacing;
        binHeight = Math.min(THUMBNAIL_DEFAULT_SIZE, binHeight);

        for (let i = 0; i < this._thumbnailBins.length; i++) {
            let metaWindow = this._windows[i];
            let container = new St.Group();
            let clones = WindowUtils.createWindowClone(metaWindow, availHeight, true, true);
            for (let j = 0; j < clones.length; j++) {
              let clone = clones[j];
              container.add_actor(clone.actor);
              clone.actor.set_position(clone.x, clone.y);
            }
            this._thumbnailBins[i].set_height(binHeight);
            this._thumbnailBins[i].add_actor(container);
            this._clones.push(container);
        }

        // Make sure we only do this once
        this._thumbnailBins = new Array();
    }
};

function _drawArrow(area, side) {
    let themeNode = area.get_theme_node();
    let borderColor = themeNode.get_border_color(side);
    let bodyColor = themeNode.get_foreground_color();

    let [width, height] = area.get_surface_size ();
    let cr = area.get_context();

    cr.setLineWidth(1.0);
    Clutter.cairo_set_source_color(cr, borderColor);

    switch (side) {
    case St.Side.TOP:
        cr.moveTo(0, height);
        cr.lineTo(Math.floor(width * 0.5), 0);
        cr.lineTo(width, height);
        break;

    case St.Side.BOTTOM:
        cr.moveTo(width, 0);
        cr.lineTo(Math.floor(width * 0.5), height);
        cr.lineTo(0, 0);
        break;

    case St.Side.LEFT:
        cr.moveTo(width, height);
        cr.lineTo(0, Math.floor(height * 0.5));
        cr.lineTo(width, 0);
        break;

    case St.Side.RIGHT:
        cr.moveTo(0, 0);
        cr.lineTo(width, Math.floor(height * 0.5));
        cr.lineTo(0, height);
        break;
    }

    cr.strokePreserve();

    Clutter.cairo_set_source_color(cr, bodyColor);
    cr.fill();
}
