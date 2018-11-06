const Cinnamon = imports.gi.Cinnamon;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const DND = imports.ui.dnd;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const {SignalManager} = imports.misc.signalManager;
const {each, findIndex, unref} = imports.misc.util;
const {createStore} = imports.misc.state;

const {AppMenuButtonRightClickMenu, HoverMenuController, AppThumbnailHoverMenu} = require('./menus');
const {
    FLASH_INTERVAL,
    MAX_BUTTON_WIDTH,
    BUTTON_BOX_ANIMATION_TIME,
    RESERVE_KEYS,
    TitleDisplay
} = require('./constants');

// returns [x1,x2] so that the area between x1 and x2 is
// centered in length

const center = function(length, naturalLength) {
    let maxLength = Math.min(length, naturalLength);
    let x1 = Math.floor((length - maxLength) / 2);
    let x2 = x1 + maxLength;
    return [x1, x2];
};

const getFocusState = function(metaWindow) {
    if (!metaWindow || metaWindow.minimized) {
        return false;
    }

    if (metaWindow.appears_focused) {
        return true;
    }

    let transientHasFocus = false;
    metaWindow.foreach_transient(function(transient) {
        if (transient && transient.appears_focused) {
            transientHasFocus = true;
            return false;
        }
        return true;
    });
    return transientHasFocus;
};

class AppGroup {
    constructor(params) {
        if (DND.LauncherDraggable) {
            DND.LauncherDraggable.prototype._init.call(this);
        }

        this.state = params.state;
        this.listState = params.listState;
        this.groupState = createStore({
            app: params.app,
            appId: params.appId,
            appName: params.app.get_name(),
            appInfo: params.app.get_app_info(),
            metaWindows: params.metaWindows || [],
            lastFocused: params.metaWindow || null,
            isFavoriteApp: !params.metaWindow ? true : params.isFavoriteApp === true,
            autoStartIndex: findIndex(this.state.autoStartApps, (app) => app.id === params.appId),
            willUnmount: false,
            tooltip: null,
            groupReady: false
        });

        this.groupState.connect({
            isFavoriteApp: () => this.handleFavorite(true),
            getActor: () => this.actor,
            launchNewInstance: () => this.launchNewInstance()
        });

        this.signals = new SignalManager(null);

        // TODO: This needs to be in state so it can be updated more reliably.
        this.labelVisible = this.state.settings.titleDisplay !== TitleDisplay.None && this.state.isHorizontal;
        this._progress = 0;
        this.padding = 0;
        this.windowCount = 0;
        this.wasFavapp = false;
        this.time = params.time;
        this.focusedWindow = false;
        this.title = '';

        this.actor = new St.Bin({
            style_class: 'grouped-window-list-item-box',
            important: true,
            reactive: true,
            can_focus: true,
            x_fill: true,
            y_fill: true,
            track_hover: false
        });
        this.actor._delegate = this;
        this.container = new Cinnamon.GenericContainer({
            name: 'iconLabelButton'
        });
        this.actor.set_child(this.container);
        this.progressOverlay = new St.Widget({
            name: 'progressOverlay',
            style_class: 'progress',
            reactive: false,
            important: true,
            show_on_set_parent: false
        });
        this.container.add_child(this.progressOverlay);

        // Create the app button icon, number label, and text label for titleDisplay
        this.iconBox = new St.Bin({name: 'appMenuIcon'});
        this.iconBox.connect('style-changed', (...args) => this.onIconBoxStyleChanged(...args));
        this.iconBottomClip = 0;
        this.container.add_child(this.iconBox);
        this.setActorAttributes();

        this.badge = new St.BoxLayout({
            style_class: 'grouped-window-list-badge',
            important: true,
            height: 12 * global.ui_scale,
            x_align: St.Align.START,
            y_align: St.Align.MIDDLE,
            show_on_set_parent: false,
            anchor_y: -2,
        });
        this.numberLabel = new St.Label({
            style: 'font-size: 10px;color:#fff; padding: 0px;',
            style_class: 'grouped-window-list-number-label',
            important: true,
            text: '',
            anchor_x: -3 * global.ui_scale,
            anchor_y: 1 + (global.ui_scale > 1 ? 2 : 0)
        });
        this.numberLabel.clutter_text.ellipsize = false;
        this.badge.add(this.numberLabel, {
            x_align: St.Align.START,
            y_align: St.Align.START,
        });
        this.container.add_child(this.badge);

        this.label = new St.Label({
            style_class: 'grouped-window-list-button-label',
            important: true,
            text: '',
            show_on_set_parent: this.state.settings.titleDisplay !== 1 && this.state.settings.titleDisplay !== 4
        });
        this.label.x_align = St.Align.START;
        this.container.add_child(this.label);

        this.groupState.set({tooltip: new Tooltips.PanelItemTooltip({actor: this.actor}, '', this.state.orientation)});

        this.rightClickMenu = new AppMenuButtonRightClickMenu({
                state: this.state,
                groupState: this.groupState,
                actor: this.actor
        }, this.state.orientation);

        // Set up the hover menu
        this.hoverMenuManager = new HoverMenuController({actor: this.actor});
        this.rightClickMenuManager = new PopupMenu.PopupMenuManager({actor: this.actor});
        this.hoverMenu = new AppThumbnailHoverMenu(this.state, this.groupState);
        this.hoverMenu.actor.hide();

        Main.layoutManager.addChrome(this.hoverMenu.actor, {});

        this.hoverMenu.setVerticalSetting();
        this.hoverMenu.actor.set_style_class_name('');
        this.hoverMenu.box.set_important(true);
        this.hoverMenu.box.set_style_class_name('grouped-window-list-thumbnail-menu');

        this.hoverMenuManager.addMenu(this.hoverMenu);
        this.rightClickMenuManager.addMenu(this.rightClickMenu);

        this._draggable = new DND._Draggable(this.actor);
        this.signals.connect(this.hoverMenu.actor, 'enter-event',
            (...args) => this.hoverMenu.onMenuEnter.call(this.hoverMenu, ...args));
        this.signals.connect(this.hoverMenu.actor, 'leave-event',
            (...args) => this.hoverMenu.onMenuLeave.call(this.hoverMenu, ...args));
        this.signals.connect(this.hoverMenu.actor, 'key-release-event',
            (...args) => this.hoverMenu.onKeyRelease.call(this.hoverMenu, ...args));
        this.signals.connect(this.hoverMenu.actor, 'scroll-event',
            (c, e) => this.state.trigger('cycleWindows', e, this.actor._delegate));
        this.signals.connect(this.hoverMenu.box, 'key-press-event',
            (...args) => this.hoverMenu.onKeyPress.call(this.hoverMenu, ...args));
        this.signals.connect(this.container, 'get-preferred-width', (...args) => this.getPreferredWidth(...args));
        this.signals.connect(this.container, 'get-preferred-height', (...args) => this.getPreferredHeight(...args));
        this.signals.connect(this.container, 'allocate', (...args) => this.allocate(...args));
        this.signals.connect(this.actor, 'enter-event', (...args) => this.onEnter(...args));
        this.signals.connect(this.actor, 'leave-event', (...args) => this.onLeave(...args));
        this.signals.connect(this.actor, 'button-release-event', (...args) => this.onAppButtonRelease(...args));
        this.signals.connect(this.actor, 'button-press-event', (...args) => this.onAppButtonPress(...args));
        this.signals.connect(this._draggable, 'drag-begin', (...args) => this.onDragBegin(...args));
        this.signals.connect(this._draggable, 'drag-cancelled', (...args) => this.onDragCancelled(...args));
        this.signals.connect(this._draggable, 'drag-end', (...args) => this.onDragEnd(...args));
        this.calcWindowNumber(this.groupState.metaWindows);

        this.on_orientation_changed(true);
        setTimeout(() => {
            if (!this.groupState.set) return;

            this.groupState.set({groupReady: true});
            this.handleFavorite();
        }, 0);
    }

    on_orientation_changed(fromInit) {
        this.actor.set_style_class_name('grouped-window-list-item-box');
        if (this.state.orientation === St.Side.TOP) {
            this.actor.add_style_class_name('top');
        } else if (this.state.orientation === St.Side.BOTTOM) {
            this.actor.add_style_class_name('bottom');
        } else if (this.state.orientation === St.Side.LEFT) {
            this.actor.add_style_class_name('left');
        } else if (this.state.orientation === St.Side.RIGHT) {
            this.actor.add_style_class_name('right');
        }

        if (this.state.appletReady && !fromInit) {
            this.setActorAttributes();
        }
    }

    setActorAttributes(iconSize) {
        if (!iconSize) {
            iconSize = this.state.trigger('getPanelIconSize');
        }
        this.iconSize = iconSize;

        this.actor.style = null;

        let panelHeight = this.state.trigger('getPanelHeight');

        // TODO: Button width should be applied to buttons if they don't have a label set, not based on
        // mode, but not currently sure how to unset the fixed width on the actor so it revert to a
        // resizable state without destroying it. Otherwise, buttons with labels don't have enough padding set.
        if (!this.state.isHorizontal
            || this.state.settings.titleDisplay === 1
            || this.state.settings.titleDisplay === 3 && !this.labelVisible) {
            this.actor.width = panelHeight;
        }

        if (this.state.isHorizontal) {
            this.actor.height = panelHeight;
        }
        this.setIcon();
        this.updateIconBoxClip();
        this.setIconPadding(panelHeight);
        this.setMargin();
    }

    setIconPadding(panelHeight) {
        if (this.state.settings.titleDisplay > 1 && this.labelVisible) {
            this.iconBox.style = 'padding: 0px;';
            return;
        }

        this.padding = (panelHeight / global.ui_scale) - this.iconSize;

        if (global.ui_scale === 1) {
            this.padding /= 2;
        }

        this.actor.style = `padding-left: ${this.padding / global.ui_scale}px; padding-right: 0px;`;
    }

    setMargin() {
        let direction = this.state.isHorizontal ? 'right' : 'bottom';
        let existingStyle = this.actor.style ? this.actor.style : '';
        this.actor.style = existingStyle + 'margin-' + direction + ': ' + this.state.settings.iconSpacing + 'px;';
    }

    onIconBoxStyleChanged() {
        if (this.state.panelEditMode || this.groupState.metaWindows.length === 0) {
            return;
        }
        let node = this.iconBox.get_theme_node();
        this.iconBottomClip = node.get_length('app-icon-bottom-clip');
        this.updateIconBoxClip();
    }

    updateIconBoxClip() {
        let allocation = this.iconBox.allocation;
        if (this.iconBottomClip > 0) {
            this.iconBox.set_clip(
                0,
                0,
                allocation.x2 - allocation.x1,
                allocation.y2 - allocation.y1 - this.iconBottomClip
            );
        } else {
            this.iconBox.remove_clip();
        }
    }

    setIcon(metaWindow) {
        let icon;

        if (this.groupState.app) {
            if (metaWindow) {
                icon = this.groupState.app.create_icon_texture_for_window(this.iconSize, metaWindow);
            } else {
                icon = this.groupState.app.create_icon_texture(this.iconSize);
            }
        } else {
            icon = new St.Icon({
                icon_name: 'application-default-icon',
                icon_type: St.IconType.FULLCOLOR,
                icon_size: this.iconSize
            });
        }

        let oldChild = this.iconBox.get_child();
        this.iconBox.set_child(icon);

        if (oldChild) oldChild.destroy();
    }

    setText(text) {
        if (text
            && (typeof text === 'string' || text instanceof String)
            && text.length > 0 && this.label) {
            this.label.set_text(text);
        }
    }

    getAttention() {
        if (this._needsAttention) return;

        this._needsAttention = true;
        let counter = 0;
        this.flashButton(counter);
    }

    flashButton(counter) {
        if (!this._needsAttention || !this.actor) return;

        // If the app was closed during a flash sequence, stop looping.
        if (!this.groupState.groupReady && this.groupState.isFavoriteApp) {
            this.actor.remove_style_class_name('grouped-window-list-item-demands-attention');
            return;
        }

        this.actor.remove_style_pseudo_class('active');
        this.actor.add_style_class_name('grouped-window-list-item-demands-attention');
        if (counter < 4) {
            setTimeout(() => {
                if (this.actor && this.actor.has_style_class_name('grouped-window-list-item-demands-attention')) {
                    this.actor.remove_style_class_name('grouped-window-list-item-demands-attention');
                    this.actor.add_style_pseudo_class('active');
                }
                setTimeout(() => {
                    this.flashButton(++counter);
                }, FLASH_INTERVAL);
            }, FLASH_INTERVAL);
        }
    }

    getPreferredWidth(actor, forHeight, alloc) {
        let [iconMinSize, iconNaturalSize] = this.iconBox.get_preferred_width(forHeight);
        let labelNaturalSize = this.label.get_preferred_width(forHeight)[1];
        // The label text starts in the center of the icon, so we should allocate the space
        // needed for the icon plus the space needed for(label - icon/2)
        alloc.min_size = iconMinSize;
        if (this.state.orientation === St.Side.TOP || this.state.orientation === St.Side.BOTTOM) {
            alloc.natural_size = Math.min(iconNaturalSize + Math.max(0, labelNaturalSize), MAX_BUTTON_WIDTH);
        } else {
            alloc.natural_size = this.state.trigger('getPanelHeight');
        }
    }

    getPreferredHeight(actor, forWidth, alloc) {
        let [iconMinSize, iconNaturalSize] = this.iconBox.get_preferred_height(forWidth);
        let [labelMinSize, labelNaturalSize] = this.label.get_preferred_height(forWidth);
        alloc.min_size = Math.min(iconMinSize, labelMinSize);
        alloc.natural_size = Math.max(iconNaturalSize, labelNaturalSize);
    }

    allocate(actor, box, flags) {
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;
        let childBox = new Clutter.ActorBox();
        let direction = this.actor.get_text_direction();

        // Set the icon to be left-justified (or right-justified) and centered vertically
        let [iconNaturalWidth, iconNaturalHeight] = this.iconBox.get_preferred_size();
        [childBox.y1, childBox.y2] = center(allocHeight, iconNaturalHeight);
        if (direction === Clutter.TextDirection.LTR) {
            [childBox.x1, childBox.x2] = [0, Math.min(iconNaturalWidth, allocWidth)];
        } else {
            [childBox.x1, childBox.x2] = [Math.max(0, allocWidth - iconNaturalWidth), allocWidth];
        }
        this.iconBox.allocate(childBox, flags);

        // Set the label to start its text in the left of the icon
        let iconWidth = childBox.x2 - childBox.x1;
        let [naturalWidth, naturalHeight] = this.label.get_preferred_size();
        [childBox.y1, childBox.y2] = center(allocHeight, naturalHeight);
        if (direction === Clutter.TextDirection.LTR) {
            childBox.x1 = iconWidth;
            childBox.x2 = Math.min(allocWidth, MAX_BUTTON_WIDTH);
        } else {
            childBox.x2 = Math.min(allocWidth - iconWidth, MAX_BUTTON_WIDTH);
            childBox.x1 = Math.max(0, childBox.x2 - naturalWidth);
        }
        this.label.allocate(childBox, flags);

        let windowCountFactor = this.windowCount > 9 ? 1.5 : 2;
        childBox.x1 = 0;
        childBox.x2 = childBox.x1 + (this.numberLabel.width * windowCountFactor);
        childBox.y1 = box.y1 - 2;
        childBox.y2 = box.y2 - 1;
        this.badge.allocate(childBox, flags);

        // Call set_icon_geometry for support of Cinnamon's minimize animation
        if (this.groupState.metaWindows.length > 0 && this.container.realized) {
            let rect = new Meta.Rectangle();
            [rect.x, rect.y] = this.container.get_transformed_position();
            [rect.width, rect.height] = this.container.get_transformed_size();

            each(this.groupState.metaWindows, (metaWindow) => {
                if (metaWindow) {
                    metaWindow.set_icon_geometry(rect);
                }
            });
        }

        if (this.progressOverlay.visible) {
            childBox.x1 = -this.padding;
            childBox.y1 = 0;
            childBox.y2 = this.container.height;
            childBox.x2 = Math.max(this.container.width * (this._progress / 100.0), 1.0);
            this.progressOverlay.allocate(childBox, flags);
        }
    }

    _showLabel() {
        this.labelVisible = true;
        if (this.label.text == null) {
            this.label.set_text('');
        }
        // TODO: This should be set by the theme.
        this.label.set_style('padding-right: 4px;');

        Tweener.addTween(this.label, {
            width: MAX_BUTTON_WIDTH, // Should probably check preferred width
            time: BUTTON_BOX_ANIMATION_TIME,
            transition: 'easeOutQuad',
            onComplete: () => {
                if (!this.label) return;
                this.label.show();
            }
        });
        return false;
    }

    showLabel() {
        if (!this.label || !this.state.isHorizontal) {
            return false;
        }

        // Fixes 'st_widget_get_theme_node called on the widget which is not in the stage' warnings
        if (!this.label.realized) {
            setTimeout(() => this._showLabel(), 0);
        } else {
            this._showLabel();
        }
    }

    hideLabel(animate) {
        if (!this.label) return false;

        if (this.label.text == null) {
            this.label.set_text('');
        }
        this.labelVisible = false;
        if (!animate) {
            this.label.width = 1;
            this.label.hide();
            return false;
        }

        Tweener.addTween(this.label, {
            width: 1,
            time: BUTTON_BOX_ANIMATION_TIME,
            transition: 'easeOutQuad',
            onCompleteScope: this,
            onComplete() {
                this.label.hide();
                this.label.set_style('padding-right: 0px;');
            }
        });
        return false;
    }

    onEnter() {
        if (this.state.panelEditMode) return false;

        if (this.actor.has_style_pseudo_class('closed')) {
            this.hadClosedPseudoClass = true;
            this.actor.remove_style_pseudo_class('closed');
        }

        this.actor.add_style_pseudo_class('hover');

        this.hoverMenu.onMenuEnter();
    }

    onLeave() {
        if (this.state.panelEditMode) return false;

        this.resetHoverStatus();

        if (this.hadClosedPseudoClass && this.groupState.metaWindows.length === 0) {
            this.hadClosedPseudoClass = false;
            this.actor.add_style_pseudo_class('closed');
        }

        this.setFavoriteAttributes();
        this.hoverMenu.onMenuLeave();
    }

    resetHoverStatus() {
        if (this.actor.is_finalized()) return;

        let focused = false;
        each(this.groupState.metaWindows, function(metaWindow) {
            if (getFocusState(metaWindow)) {
                focused = true;
                return false;
            }
        });

        if (!focused) {
            this.actor.remove_style_pseudo_class('hover');
        }
    }

    setActiveStatus(state) {
        if (state && !this.actor.has_style_pseudo_class('active')) {
            this.actor.add_style_pseudo_class('active');
        } else {
            this.actor.remove_style_pseudo_class('active');
        }
    }

    onProgressChange(metaWindow) {
        if (metaWindow.progress !== this._progress) {
            this._progress = metaWindow.progress;
            if (this._progress > 0) {
                this.progressOverlay.show();
            } else {
                this.progressOverlay.hide();
            }
            this.container.queue_relayout();
        }
    }

    onFocusChange(hasFocus) {
        // If any of the windows associated with our app have focus,
        // we should set ourselves to active
        if (hasFocus) {
            this.listState.trigger('updateFocusState', this.groupState.appId);
            this.actor.add_style_pseudo_class('focus');
            if (this.actor.has_style_class_name('grouped-window-list-item-demands-attention')) {
                this.actor.remove_style_class_name('grouped-window-list-item-demands-attention');
            }
            this._needsAttention = false;
        } else {
            this.actor.remove_style_pseudo_class('focus');
        }
        if (this.groupState.metaWindows.length > 0) {
            this.actor.add_style_pseudo_class('active');
        }
        this.resetHoverStatus();
    }

    onWindowDemandsAttention(metaWindow) {
        // Prevent apps from indicating attention when they are starting up.
        if (!this.groupState || !this.groupState.groupReady || this.groupState.willUnmount) {
            return;
        }
        let windows = this.groupState.metaWindows;
        for (let i = 0, len = windows.length; i < len; i++) {
            if (windows[i] === metaWindow) {
                // Even though this may not be the last focused window, we want it to be
                // the window that gets focused when a user responds to an alert.
                this.groupState.set({lastFocused: metaWindow});
                this.setText(metaWindow.get_title());
                this.getAttention();
                return true;
            }
        }
        return false;
    }

    onDragBegin() {
        // Keep the drag actor contained within the applet area
        if (this.state.isHorizontal) {
            this._draggable._overrideY = this.actor.get_transformed_position()[1];
            this._draggable._overrideX = null;
        } else {
            this._draggable._overrideX = this.actor.get_transformed_position()[0];
            this._draggable._overrideY = null;
        }
        this.groupState.trigger('hoverMenuClose');
    }

    onDragEnd() {
        this.rightClickMenu.close(false);
        this.hoverMenu.close(false);
        this.listState.trigger('updateAppGroupIndexes', this.groupState.appId);
        this.state.trigger('clearDragPlaceholder');
    }

    onDragCancelled() {
        this.rightClickMenu.close(false);
        this.hoverMenu.close(false);
        this.state.trigger('clearDragPlaceholder');
    }

    handleDragOver(source, actor, x, y, time) {
        if (!this.state.settings.enableDragging
            || source instanceof AppGroup
            || (DND.LauncherDraggable && source instanceof DND.LauncherDraggable)
            || this.state.panelEditMode) {
            return DND.DragMotionResult.CONTINUE;
        }
        if (this.groupState.metaWindows.length > 0 && this.groupState.lastFocused) {
            Main.activateWindow(this.groupState.lastFocused, global.get_current_time());
        }
        return true;
    }

    getDragActor() {
        return this.groupState.app.create_icon_texture(this.state.trigger('getPanelHeight'));
    }

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource() {
        return this.actor;
    }

    showOrderLabel(number) {
        this.numberLabel.text = (number + 1).toString();
        this.badge.show();
    }

    launchNewInstance() {
        this.groupState.app.open_new_window(-1);
        this.animate();
    }

    onAppButtonRelease(actor, event) {
        this.state.trigger('clearDragPlaceholder');

        let button = event.get_button();
        let nWindows = this.groupState.metaWindows.length;

        let shouldStartInstance = (
            (button === 1
                && this.groupState.isFavoriteApp
                && nWindows === 0
                && (this.state.settings.leftClickAction === 2 || nWindows < 1))
            || (button === 2
                && this.state.settings.middleClickAction === 2)
        );

        let shouldEndInstance = button === 2
            && this.state.settings.middleClickAction === 3
            && this.groupState.lastFocused;

        if (shouldStartInstance) {
            this.launchNewInstance();
            return;
        }

        if (shouldEndInstance) {
            this.groupState.lastFocused.delete(global.get_current_time());
            return;
        }

        let handleMinimizeToggle = (win) => {
            if (this.state.settings.onClickThumbs && nWindows > 1) {
                if (this.hoverMenu.isOpen) {
                    this.hoverMenu.close();
                } else {
                    this.hoverMenu.open();
                }
                if (this.state.overlayPreview) {
                    this.hoverMenu.appThumbnails[0].destroyOverlayPreview();
                    this.hoverMenu.close(true);
                }
                return;
            }
            if (win.appears_focused) {
                win.minimize();
            } else {
                Main.activateWindow(win, global.get_current_time());
            }
        };

        if (button === 1) {
            if (this.state.settings.leftClickAction === 1) {
                return;
            }
            if (this.state.settings.leftClickAction === 3 && nWindows > 1) {
                this.state.trigger('cycleWindows', null, this.actor._delegate);
                return;
            }
            this.hoverMenu.shouldOpen = false;
            if (this.rightClickMenu.isOpen) {
                this.rightClickMenu.toggle();
            }
            if (nWindows === 1) {
                handleMinimizeToggle(this.groupState.metaWindows[0]);
            } else {
                let actionTaken = false;
                for (let i = 0, len = nWindows; i < len; i++) {
                    if (this.groupState.lastFocused && this.groupState.metaWindows[i] === this.groupState.lastFocused) {
                        handleMinimizeToggle(this.groupState.metaWindows[i]);
                        actionTaken = true;
                        break;
                    }
                }
                if (!actionTaken) {
                    handleMinimizeToggle(this.groupState.metaWindows[0]);
                }
            }
        } else if (button === 3) {
            if (!this.rightClickMenu.isOpen) {
                this.listState.trigger('closeAllRightClickMenus', () => {
                    this.listState.trigger('closeAllHoverMenus', () => {
                        this.rightClickMenu.open();
                    });
                });
            } else {
                this.listState.trigger('closeAllRightClickMenus', this.listState.trigger('closeAllHoverMenus'));
            }
        }
        this.hoverMenu.onButtonPress();
    }

    onAppButtonPress(actor, event) {
        let button = event.get_button();

        if (button === 3) return true;
        return false;
    }

    onAppKeyPress() {
        if (this.groupState.isFavoriteApp && this.groupState.metaWindows.length === 0) {
            this.launchNewInstance();
        } else {
            if (this.groupState.metaWindows.length > 1) {
                this.hoverMenu.open(true);
            } else {
                this.listState.trigger('closeAllHoverMenus');
            }
            this.windowHandle(false);
        }
    }

    windowHandle() {
        if (this.groupState.lastFocused.appears_focused) {
            if (this.groupState.metaWindows.length > 1) {
                let nextWindow = null;
                for (let i = 0, max = this.groupState.metaWindows.length - 1; i < max; i++) {
                    if (this.groupState.metaWindows[i] === this.groupState.lastFocused) {
                        nextWindow = this.groupState.metaWindows[i + 1];
                        break;
                    }
                }
                if (nextWindow === null) {
                    nextWindow = this.groupState.metaWindows[0];
                }
                Main.activateWindow(nextWindow, global.get_current_time());
            } else {
                this.groupState.lastFocused.minimize();
                this.actor.remove_style_pseudo_class('focus');
            }
        } else {
            if (this.groupState.lastFocused.minimized) {
                this.groupState.lastFocused.unminimize();
            }
            let ws = this.groupState.lastFocused.get_workspace().index();
            if (ws !== global.screen.get_active_workspace_index()) {
                global.screen.get_workspace_by_index(ws).activate(global.get_current_time());
            }
            Main.activateWindow(this.groupState.lastFocused, global.get_current_time());
            this.actor.add_style_pseudo_class('focus');
        }
    }

    windowAdded(metaWindow, metaWindows) {
        if (metaWindows) {
            this.groupState.metaWindows = [];
            for (var i = 0; i < metaWindows.length; i++) {
                this.groupState.metaWindows.push(metaWindows[i]);
            }
        }
        let refWindow = findIndex(this.groupState.metaWindows, (win) => {
            return win === metaWindow;
        });
        if (metaWindow) {
            this.signals.connect(metaWindow, 'notify::title', (...args) => this.onWindowTitleChanged(...args));
            this.signals.connect(metaWindow, 'notify::appears-focused', (...args) => this.onFocusWindowChange(...args));
            this.signals.connect(metaWindow, 'notify::gtk-application-id', (w) => this.onAppChange(w));
            this.signals.connect(metaWindow, 'notify::wm-class', (w) => this.onAppChange(w));
            this.signals.connect(metaWindow, 'notify::icon', (w) => this.setIcon(w));

            if (metaWindow.progress !== undefined) {
                this._progress = metaWindow.progress;
                this.signals.connect(metaWindow, 'notify::progress', () => this.onProgressChange(metaWindow));
            }

            // Set the initial button label as not all windows will get updated via signals initially.
            this.onWindowTitleChanged(metaWindow);
            if (refWindow === -1) {
                this.groupState.metaWindows.push(metaWindow);
                this.groupState.trigger('addThumbnailToMenu', metaWindow);
            }
            this.calcWindowNumber(this.groupState.metaWindows);
            this.onFocusChange();
        }
        this.groupState.set({
            metaWindows: this.groupState.metaWindows,
            lastFocused: metaWindow
        });
        this.handleFavorite();
    }

    windowRemoved(metaWorkspace, metaWindow, refWindow, cb) {
        if (refWindow === -1) return;

        this.signals.disconnect('notify::title', metaWindow);
        this.signals.disconnect('notify::appears-focused', metaWindow);
        this.signals.disconnect('notify::gtk-application-id', metaWindow);
        this.signals.disconnect('notify::wm-class', metaWindow);

        this.groupState.metaWindows.splice(refWindow, 1);
        this.calcWindowNumber(this.groupState.metaWindows);

        if (this.groupState.metaWindows.length > 0 && !this.groupState.willUnmount) {
            if (this.progressOverlay.visible && metaWindow.progress > 0) {
                this._progress = 0;
                this.progressOverlay.visible = false;
            }
            this.onWindowTitleChanged(this.groupState.lastFocused);
            this.groupState.set({
                metaWindows: this.groupState.metaWindows,
                lastFocused: this.groupState.metaWindows[this.groupState.metaWindows.length - 1]
            }, true);
            this.groupState.trigger('removeThumbnailFromMenu', metaWindow);
            this.groupState.trigger('refreshThumbnails');
        } else {
            // This is the last window, so this group needs to be destroyed. We'll call back windowRemoved
            // in appList to put the final nail in the coffin.
            if (typeof cb === 'function') {
                if (this.groupState.isFavoriteApp) {
                    this.groupState.trigger('removeThumbnailFromMenu', metaWindow);
                }
                cb(this.groupState.appId, this.groupState.isFavoriteApp);
                if (this.groupState.isFavoriteApp) this.setActiveStatus(false);
            }
        }
    }

    onAppChange(metaWindow) {
        if (!this.listState) return;

        this.listState.trigger('windowRemoved', metaWindow);
        this.listState.trigger('windowAdded', metaWindow);
    }

    onWindowTitleChanged(metaWindow, refresh) {
        if (this.groupState.willUnmount || !this.state.settings) {
            return;
        }

        let shouldHideLabel = this.state.settings.titleDisplay === TitleDisplay.None
            || !this.state.isHorizontal;

        if (shouldHideLabel) {
            this.setText('');
        }

        if (!refresh
            && (!metaWindow
                || !metaWindow.title
                || (this.groupState.metaWindows.length === 0 && this.groupState.isFavoriteApp)
                    || !this.state.isHorizontal)) {
            this.hideLabel();
            return;
        }

        if ((metaWindow.lastTitle && metaWindow.lastTitle === metaWindow.title)
            && !refresh
            && shouldHideLabel) {
            return;
        }
        metaWindow.lastTitle = metaWindow.title;

        each(this.hoverMenu.appThumbnails, (thumbnail) => {
            if (thumbnail.metaWindow === metaWindow) {
                thumbnail.label.set_text(metaWindow.title);
                return false;
            }
        });

        this.groupState.set({
            appName: this.groupState.app.get_name()
        });
        if (this.state.settings.titleDisplay === TitleDisplay.Title) {
            this.setText(metaWindow.title);
            this.showLabel(true);
        } else if (this.state.settings.titleDisplay === TitleDisplay.App) {
            if (this.groupState.appName) {
                this.setText(this.groupState.appName);
                this.showLabel(true);
            }
        }
    }

    onFocusWindowChange(metaWindow) {
        if (this.groupState.metaWindows.length === 0) return;

        let hasFocus = getFocusState(metaWindow);
        if (hasFocus && this.groupState.hasOwnProperty('lastFocused')) {
            this.listState.set({lastFocusedApp: this.groupState.appId});
            this.groupState.set({lastFocused: metaWindow});
        }
        this.onFocusChange(hasFocus);
        if (this.state.settings.titleDisplay > 1) {
            if (hasFocus) {
                this.setText(metaWindow.title);
                this.showLabel(true);
            } else if (this.state.settings.titleDisplay === TitleDisplay.Focused) {
                this.hideLabel(true);
            }
        }
        if (this.state.settings.sortThumbs) {
            this.hoverMenu.addThumbnail(metaWindow);
        }
    }

    handleFavorite(changed) {
        if (this.actor.is_finalized()) return;

        if (changed) {
            setTimeout(() => this.listState.trigger('updateAppGroupIndexes', this.groupState.appId), 0);
        }
        this.setFavoriteAttributes();
        if (this.groupState.metaWindows.length === 0 && this.state.appletReady) {
            this.hoverMenu.close();
            this.onLeave();
            this.actor.add_style_pseudo_class('closed');
            return;
        } else if (this.actor.has_style_pseudo_class('closed')) {
            this.actor.remove_style_pseudo_class('closed');
        }
        this.onWindowTitleChanged(this.groupState.lastFocused);
        this.onFocusChange();
    }

    setFavoriteAttributes() {
        if ((!this.groupState.app || this.groupState.app.state === 0) && this.groupState.isFavoriteApp) {
            this.actor.set_style_pseudo_class('closed');
        }
    }

    calcWindowNumber() {
        if (this.groupState.willUnmount) return;

        this.windowCount = this.groupState.metaWindows ? this.groupState.metaWindows.length : 0;
        this.numberLabel.text = this.windowCount.toString();
        if (this.state.settings.numDisplay) {
            if (this.windowCount <= 1) {
                this.badge.hide();
            } else {
                this.badge.show();
            }
        } else {
            this.badge.hide();
        }
    }

    handleTitleDisplayChange() {
        each(this.groupState.metaWindows, (win) => {
            this.onWindowTitleChanged(win, true);
            if (this.state.settings.titleDisplay !== TitleDisplay.Focused || getFocusState(win)) {
                this.showLabel();
            }
        });
    }

    animate(step = 0) {
        let effect = this.state.settings.launcherAnimationEffect;

        if (effect === 1) return;
        else if (effect === 2) {
            this.iconBox.set_z_rotation_from_gravity(0.0, Clutter.Gravity.CENTER);
            Tweener.addTween(this.iconBox, {
                opacity: 70,
                time: 1.0,
                transition: 'linear',
                onCompleteScope: this,
                onComplete() {
                    Tweener.addTween(this.iconBox, {
                        opacity: 255,
                        time: 0.5,
                        transition: 'linear'
                    });
                }
            });
        } else if (effect === 3) {
            if (step >= 3) return;

            this.iconBox.set_pivot_point(0.5, 0.5);
            Tweener.addTween(this.iconBox, {
                scale_x: 0.7,
                scale_y: 0.7,
                time: 0.2,
                transition: 'easeOutQuad',
                onComplete: () => {
                    Tweener.addTween(this.iconBox, {
                        scale_x: 1.0,
                        scale_y: 1.0,
                        time: 0.2,
                        transition: 'easeOutQuad',
                        onComplete: () => {
                            this.animate(step + 1);
                        }
                    });
                }
            });
        }
    }

    destroy(skipRefCleanup) {
        this.signals.disconnectAllSignals();
        this.groupState.set({willUnmount: true});

        if (this.rightClickMenu) {
            if (this.rightClickMenu.isOpen) {
                this.rightClickMenu.close();
            }
            this.rightClickMenu.destroy();
        }
        this.hoverMenu.destroy();
        this.listState.trigger('removeChild', this.actor);
        this.container.destroy();
        this.actor.destroy();

        if (!skipRefCleanup) {
            this.groupState.destroy();
            unref(this, RESERVE_KEYS);
        }
    }
}

module.exports = AppGroup;
