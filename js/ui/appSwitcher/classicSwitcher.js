// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Pango = imports.gi.Pango;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const Mainloop = imports.mainloop;

const AppSwitcher = imports.ui.appSwitcher.appSwitcher;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const WindowUtils = imports.misc.windowUtils;

const POPUP_SCROLL_TIME = 0.10; // seconds
const POPUP_DELAY_TIMEOUT = 150; // milliseconds
const POPUP_FADE_OUT_TIME = 0.1; // seconds

const APP_ICON_HOVER_TIMEOUT = 200; // milliseconds

const THUMBNAIL_DEFAULT_SIZE = 256;
const THUMBNAIL_POPUP_TIME = 300; // milliseconds
const THUMBNAIL_FADE_TIME = 0.1; // seconds

const PREVIEW_DELAY_TIMEOUT = 0; // milliseconds
var PREVIEW_SWITCHER_FADEOUT_TIME = 0.2; // seconds

const iconSizes = [96, 64, 48];

function mod(a, b) {
    return (a + b) % b;
}

function ClassicSwitcher() {
    this._init.apply(this, arguments);
}

ClassicSwitcher.prototype = {
    __proto__: AppSwitcher.AppSwitcher.prototype,
    
    _init: function() {
        AppSwitcher.AppSwitcher.prototype._init.apply(this, arguments);

        this.actor = new Cinnamon.GenericContainer({ name: 'altTabPopup',
                                                  reactive: true,
                                                  visible: false });
        
        this._thumbnailTimeoutId = 0;
        this.thumbnailsVisible = false;
        this._displayPreviewTimeoutId = 0;

        Main.uiGroup.add_actor(this.actor);

        if (!this._setupModal())
            return;
            
        let styleSettings = global.settings.get_string("alttab-switcher-style");
        let features = styleSettings.split('+');
        this._iconsEnabled = features.indexOf('icons') !== -1;
        this._previewEnabled = features.indexOf('preview') !== -1;
        this._thumbnailsEnabled = features.indexOf('thumbnails') !== -1;
        if (!this._iconsEnabled && !this._previewEnabled && !this._thumbnailsEnabled)
            this._iconsEnabled = true;

        this._showThumbnails = this._thumbnailsEnabled && !this._iconsEnabled;
        this._showIconAndThumbnails = this._thumbnailsEnabled && this._iconsEnabled;
        
        this._updateList(0);

        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));
        
        this._applist_act_id = 0;
        this._applist_enter_id = 0;

        // Need to force an allocation so we can figure out whether we
        // need to scroll when selecting
        this.actor.opacity = 0;
        this.actor.show();
        this.actor.get_allocation_box();
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
        let monitor = this._activeMonitor;

        let leftPadding = this.actor.get_theme_node().get_padding(St.Side.LEFT);
        let rightPadding = this.actor.get_theme_node().get_padding(St.Side.RIGHT);
        let bottomPadding = this.actor.get_theme_node().get_padding(St.Side.BOTTOM);
        let vPadding = this.actor.get_theme_node().get_vertical_padding();
        let hPadding = leftPadding + rightPadding;

        // Allocate the appSwitcher
        // We select a size based on an icon size that does not overflow the screen
        let [childMinHeight, childNaturalHeight] = this._appList.actor.get_preferred_height(monitor.width - hPadding);
        let [childMinWidth, childNaturalWidth] = this._appList.actor.get_preferred_width(childNaturalHeight);
        childBox.x1 = Math.max(monitor.x + leftPadding, monitor.x + Math.floor((monitor.width - childNaturalWidth) / 2));
        childBox.x2 = Math.min(monitor.x + monitor.width - rightPadding, childBox.x1 + childNaturalWidth);
        childBox.y1 = monitor.y + Math.floor((monitor.height - childNaturalHeight) / 2);
        childBox.y2 = childBox.y1 + childNaturalHeight;
        this._appList.actor.allocate(childBox, flags);

        // Allocate the thumbnails
        // We try to avoid overflowing the screen so we base the resulting size on
        // those calculations
        if (this._thumbnails && this._appIcons.length > 0) {
            let icon = this._appIcons[this._currentIndex].actor;
            let [posX, posY] = icon.get_transformed_position();
            let thumbnailCenter = posX + icon.width / 2;
            let [childMinWidth, childNaturalWidth] = this._thumbnails.actor.get_preferred_width(-1);
            childBox.x1 = Math.max(monitor.x + leftPadding, Math.floor(thumbnailCenter - childNaturalWidth / 2));
            if (childBox.x1 + childNaturalWidth > monitor.x + monitor.width - rightPadding) {
                let offset = (childBox.x1 + childNaturalWidth) - (monitor.x + monitor.width - rightPadding);
                childBox.x1 -= offset;
            }

            let spacing = this.actor.get_theme_node().get_length('spacing');

            childBox.x2 = childBox.x1 +  childNaturalWidth;
            childBox.y1 = this._appList.actor.allocation.y2 + spacing;
            this._thumbnails.addClones(monitor.y + monitor.height - bottomPadding - childBox.y1);
            let [childMinHeight, childNaturalHeight] = this._thumbnails.actor.get_preferred_height(-1);
            childBox.y2 = childBox.y1 + childNaturalHeight;
            this._thumbnails.actor.allocate(childBox, flags);
        }
    },

    _show: function() {
        Main.panelManager.panels.forEach(function(panel) { panel.actor.set_reactive(false); });
        
        this.actor.opacity = 255;
        this._initialDelayTimeoutId = 0;
        this._next();
    },
    
    _hide: function() {
        // window title and icon
        if(this._windowTitle) {
            this._windowTitle.hide();
            this._applicationIconBox.hide();
        }

        // panels
        Main.panelManager.panels.forEach(function(panel) { panel.actor.set_reactive(true); });

        Tweener.addTween(this.actor, { opacity: 0,
            time: POPUP_FADE_OUT_TIME,
            transition: 'easeOutQuad',
            onComplete: Lang.bind(this, this._destroyActors)
        });
    },

    _destroyActors: function() {
        Main.uiGroup.remove_actor(this.actor);
        this.actor.destroy();
    },

    _updateList: function(direction) {
        if(direction !== 0)
            return;
        
        if (this._appList) {
            if (this._applist_act_id !== 0) {
                this._appList.disconnect(this._applist_act_id);
                this._applist_act_id = 0;
            }
            if (this._applist_enter_id !== 0) {
                this._appList.disconnect(this._applist_enter_id);
                this._applist_enter_id = 0;
            }
            this._clearPreview();
            this._destroyThumbnails();
            this.actor.remove_actor(this._appList.actor);
            this._appList.actor.destroy();
        }
        this._appList = new AppList(this._windows, this._showThumbnails, this._activeMonitor);
        this.actor.add_actor(this._appList.actor);
        if (!this._iconsEnabled && !this._thumbnailsEnabled) {
            this._appList.actor.hide();
        }
        this._applist_act_id = this._appList.connect('item-activated', Lang.bind(this, this._appActivated));
        this._applist_enter_id = this._appList.connect('item-entered', Lang.bind(this, this._appEntered));
        
        this._appIcons = this._appList.icons;
        this.actor.get_allocation_box();
    },

    _selectNext: function() {
        if (this._currentIndex == this._windows.length - 1) {
            this._currentIndex = 0;
        } else {
            this._currentIndex = this._currentIndex + 1;
        }
    },

    _selectPrevious: function() {
        if (this._currentIndex == 0) {
            this._currentIndex = this._windows.length-1;
        } else {
            this._currentIndex = this._currentIndex - 1;
        }
    },

    _onWorkspaceSelected: function() {
        this._windows = AppSwitcher.getWindowsForBinding(this._binding);
        this._currentIndex = 0;
        this._updateList(0);
        this._select(0);
    },
    
    _setCurrentWindow: function(window) {
        this._appList.highlight(this._currentIndex, false);
        this._doWindowPreview();
        this._destroyThumbnails();
        
        if (this._thumbnailTimeoutId != 0) {
            Mainloop.source_remove(this._thumbnailTimeoutId);
            this._thumbnailTimeoutId = 0;
        }
        
        if (this._showIconAndThumbnails) {
            this._thumbnailTimeoutId = Mainloop.timeout_add(
                THUMBNAIL_POPUP_TIME, Lang.bind(this, function() {

                    if (!this._thumbnails)
                        this._createThumbnails();
                    this._thumbnails.highlight(0, false);
                    this._thumbnailTimeoutId = 0;
            }));
        }
    },

    _onDestroy: function() {
        if (this._appList !== null) {
            if (this._applist_act_id > 0) {
                this._appList.disconnect(this._applist_act_id);
                this._applist_act_id = 0;
            }

            if (this._applist_enter_id > 0) {
                this._appList.disconnect(this._applist_enter_id);
                this._applist_enter_id = 0;
            }
        }

        if (this._thumbnailTimeoutId != 0) {
            Mainloop.source_remove(this._thumbnailTimeoutId);
            this._thumbnailTimeoutId = 0;
        }
        if (this._displayPreviewTimeoutId != 0) {
            Mainloop.source_remove(this._displayPreviewTimeoutId);
            this._displayPreviewTimeoutId = 0;
        }
    },

    _appActivated : function(appSwitcher, n) {
        this._activateSelected();
    },

    _appEntered : function(appSwitcher, n) {
        if (!this._mouseActive)
            return;

        this._select(n);
    },

    _windowActivated : function(thumbnailList, n) {
        this._activateSelected();
    },
    
    _clearPreview: function() {
        if (this._previewClones) {
            for (let i = 0; i < this._previewClones.length; ++i) {
                let clone = this._previewClones[i];
                Tweener.addTween(clone, {
                    opacity: 0,
                    time: PREVIEW_SWITCHER_FADEOUT_TIME / 4,
                    transition: 'linear',
                    onCompleteScope: this,
                    onComplete: function() {
                        this.actor.remove_actor(clone);
                        clone.destroy();
                    }
                });
            }
            this._previewClones = null;
        }
    },
    
    _doWindowPreview: function() {
        if (!this._previewEnabled || this._windows.length < 1)
        {
            return;
        }

        // Use a cancellable timeout to avoid flickering effect when tabbing rapidly through the set.
        if (this._displayPreviewTimeoutId) {
            Mainloop.source_remove(this._displayPreviewTimeoutId);
            this._displayPreviewTimeoutId = 0;
        }
        let delay = PREVIEW_DELAY_TIMEOUT;
        this._displayPreviewTimeoutId = Mainloop.timeout_add(delay, Lang.bind(this, this._showWindowPreview));
    },
    
    _showWindowPreview: function() {
        this._displayPreviewTimeoutId = 0;

        let childBox = new Clutter.ActorBox();

        let lastClone = null;
        let previewClones = [];
        let window = this._windows[this._currentIndex];
        let clones = WindowUtils.createWindowClone(window, 0, 0, true, false);
        for (let i = 0; i < clones.length; i++) {
            let clone = clones[i];
            previewClones.push(clone.actor);
            this.actor.add_actor(clone.actor);
            let [width, height] = clone.actor.get_size();
            childBox.x1 = clone.x;
            childBox.x2 = clone.x + width;
            childBox.y1 = clone.y;
            childBox.y2 = clone.y + height;
            clone.actor.allocate(childBox, 0);
            clone.actor.lower(this._appList.actor);
            if (lastClone) {
                lastClone.lower(clone.actor);
            }
            lastClone = clone.actor;
        }

        this._clearPreview();
        this._previewClones = previewClones;

        if (!this._previewBackdrop) {
            let backdrop = this._previewBackdrop = new St.Bin({style_class: 'switcher-preview-backdrop'});
            this.actor.add_actor(backdrop);

            // Make sure that the backdrop does not overlap the switcher.
            backdrop.lower(this._appList.actor);
            backdrop.lower(lastClone);
            childBox.x1 = this.actor.x;
            childBox.x2 = this.actor.x + this.actor.width;
            childBox.y1 = this.actor.y;
            childBox.y2 = this.actor.y + this.actor.height;
            backdrop.allocate(childBox, 0);
            backdrop.opacity = 0;
            Tweener.addTween(backdrop,
                            { opacity: 255,
                            time: PREVIEW_SWITCHER_FADEOUT_TIME / 4,
                            transition: 'linear'
                            });
        }
    },

    _destroyThumbnails : function() {
        if (!this._thumbnails) {
            return;
        }
        let thumbnailsActor = this._thumbnails.actor;
        this._thumbnails = null;
        this.actor.remove_actor(thumbnailsActor);
        thumbnailsActor.destroy();
        this.thumbnailsVisible = false;
        
    },

    _createThumbnails : function() {
        this._thumbnails = new ThumbnailList ([this._windows[this._currentIndex]], this._activeMonitor);
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
        if (title) {
            this.label = new St.Label({ text: title });
            if (window.minimized) {
                let contrast_effect = new Clutter.BrightnessContrastEffect();
                contrast_effect.set_brightness_full(-0.5, -0.5, -0.5);
                this.actor.add_effect(contrast_effect);
            }
            let bin = new St.Bin({ x_align: St.Align.MIDDLE });
            bin.add_actor(this.label);
            this.actor.add(bin);
        }
        else {
            this.label = new St.Label({ text: this.app ? this.app.get_name() : window.title });
            this.actor.add(this.label, { x_fill: false });
        }
    },

    set_size: function(size) {
        if (this.showThumbnail){
            this.icon = new St.Widget();
            let clones = WindowUtils.createWindowClone(this.window, size * global.ui_scale, size * global.ui_scale, true, true);
            for (let i in clones) {
                let clone = clones[i];
                this.icon.add_actor(clone.actor);
                // the following 2 lines are used when cloning without positions (param #4 = false)
                //let [width, height] = clone.actor.get_size();
                //clone.actor.set_position(Math.round((size - width) / 2), Math.round((size - height) / 2));
                clone.actor.set_position(clone.x, clone.y);
            }
        } else {
            this.icon = this.app ?
                this.app.create_icon_texture_for_window(size, this.window) :
                new St.Icon({ icon_name: 'application-default-icon',
                              icon_type: St.IconType.FULLCOLOR,
                              icon_size: size });
        }
        size *= global.ui_scale;
        this._iconBin.set_size(size, size);
        this._iconBin.child = this.icon;
    }
};

function SwitcherList(squareItems, activeMonitor) {
    this._init(squareItems, activeMonitor);
}

SwitcherList.prototype = {
    _init : function(squareItems, activeMonitor) {
        this.actor = new Cinnamon.GenericContainer({ style_class: 'switcher-list' });
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocateTop));

        // Here we use a GenericContainer so that we can force all the
        // children except the separator to have the same width.
        // TODO: Separator is gone, we could use an St.ScrollView now.
        this._list = new Cinnamon.GenericContainer({ style_class: 'switcher-list-item-container' });
        this._list.spacing = -1;
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
        this._squareItems = squareItems;
        this._minSize = 0;
        this._scrollableRight = true;
        this._scrollableLeft = false;
        this._activeMonitor = activeMonitor;
    },

    _allocateTop: function(actor, box, flags) {
        if (this._list.spacing === -1) {
            this._list.spacing = this._list.get_theme_node().get_length('spacing');
        }

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

    addItem : function(item, label) {
        let bbox = new St.Button({ style_class: 'item-box',
                                   reactive: true });

        bbox.set_child(item);
        this._list.add_actor(bbox);

        let n = this._items.length;
        bbox.connect('clicked', Lang.bind(this, function() { this._onItemClicked(n); }));
        bbox.connect('enter-event', Lang.bind(this, function() { this._onItemEnter(n); }));

        bbox.label_actor = label;

        this._items.push(bbox);
    },

    _onItemClicked: function (index) {
        this._itemActivated(index);
    },

    _onItemEnter: function (index) {
        this._itemEntered(index);
    },

    highlight: function(index, justOutline) {
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

        let [absItemX, absItemY] = this._items[index].get_transformed_position();
        let [result, posX, posY] = this.actor.transform_stage_point(absItemX, 0);
        let [containerWidth, containerHeight] = this.actor.get_transformed_size();
        if (posX + this._items[index].get_width() > containerWidth)
            this._scrollToRight();
        else if (posX < 0)
            this._scrollToLeft();

    },

    _scrollToLeft : function() {
        let x = this._items[this._highlighted].allocation.x1;
        this._scrollableRight = true;
        Tweener.addTween(this._list, { anchor_x: x,
                                        time: POPUP_SCROLL_TIME,
                                        transition: 'easeOutQuad',
                                        onComplete: Lang.bind(this, function () {
                                                                        if (this._highlighted == 0) {
                                                                            this._scrollableLeft = false;
                                                                            this.actor.queue_relayout();
                                                                        }
                                                             })
                        });
    },

    _scrollToRight : function() {
        this._scrollableLeft = true;
        let monitor = this._activeMonitor;
        let padding = this.actor.get_theme_node().get_horizontal_padding();
        let parentPadding = this.actor.get_parent().get_theme_node().get_horizontal_padding();
        let x = this._items[this._highlighted].allocation.x2 - monitor.width + padding + parentPadding;
        Tweener.addTween(this._list, { anchor_x: x,
                                        time: POPUP_SCROLL_TIME,
                                        transition: 'easeOutQuad',
                                        onComplete: Lang.bind(this, function () {
                                                                        if (this._highlighted == this._items.length - 1) {
                                                                            this._scrollableRight = false;
                                                                            this.actor.queue_relayout();
                                                                        }
                                                             })
                        });
    },

    _itemActivated: function(n) {
        this.emit('item-activated', n);
    },

    _itemEntered: function(n) {
        this.emit('item-entered', n);
    },

    _maxChildWidth: function () {
        let maxChildMin = 0;
        let maxChildNat = 0;

        if (this._items.length > 0) {
            return this._items[0].get_preferred_width(-1);
        }

        return [0, 0]
    },

    _getPreferredWidth: function (actor, forHeight, alloc) {
        let [maxChildMin, maxChildNat] = this._maxChildWidth();

        let totalSpacing = this._list.spacing * Math.max(1, (this._items.length - 1));
        alloc.min_size = this._items.length * maxChildMin + totalSpacing;
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
            let [childMin, childNat] = this._maxChildWidth();
            maxChildMin = Math.max(childMin, maxChildMin);
            maxChildNat = maxChildMin;
        }

        alloc.min_size = maxChildMin;
        alloc.natural_size = maxChildNat;
    },

    _allocate: function (actor, box, flags) {
        let childHeight = box.y2 - box.y1;

        let [maxChildMin, maxChildNat] = this._maxChildWidth();
        let totalSpacing = this._list.spacing * (this._items.length - 1);

        let childWidth = Math.floor(Math.max(0, box.x2 - box.x1 - totalSpacing) / this._items.length);

        let x = 0;
        let children = this._list.get_children();
        let childBox = new Clutter.ActorBox();

        let monitor = this._activeMonitor;
        let parentRightPadding = this.actor.get_parent().get_theme_node().get_padding(St.Side.RIGHT);
        if (this.actor.allocation.x2 == monitor.x + monitor.width - parentRightPadding) {
            if (this._squareItems)
                childWidth = childHeight;
            else {
                let [childMin, childNat] = children[0].get_preferred_width(childHeight);
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
            } else {
                // Something else, eg, AppList's arrows;
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


function AppList() {
    this._init.apply(this, arguments);
}

AppList.prototype = {
    __proto__ : SwitcherList.prototype,

    _init : function(windows, showThumbnails, activeMonitor) {
        SwitcherList.prototype._init.call(this, true, activeMonitor);

        // Construct the AppIcons, add to the popup
        let activeWorkspace = global.workspace_manager.get_active_workspace();
        let workspaceIcons = [];
        let otherIcons = [];
        for (let i = 0; i < windows.length; i++) {
            workspaceIcons.push(new AppIcon(windows[i], showThumbnails));
        }

        this.icons = [];
        for (let i = 0; i < workspaceIcons.length; i++)
            this._addIcon(workspaceIcons[i]);
        if (workspaceIcons.length > 0 && otherIcons.length > 0)
            this.addSeparator();
        for (let i = 0; i < otherIcons.length; i++)
            this._addIcon(otherIcons[i]);

        this._curApp = -1;
        this._iconSize = 0;
        this._mouseTimeOutId = 0;
        this._activeMonitor = activeMonitor;
    },

    _getPreferredHeight: function (actor, forWidth, alloc) {
        if (this._items.length < 1) {
            alloc.min_size = alloc.natural_size = 32;
            return;
        }
        let j = 0;
        while(this._items.length > 1 && this._items[j].style_class != 'item-box') {
                j++;
        }
        let themeNode = this._items[j].get_theme_node();
        let iconPadding = themeNode.get_horizontal_padding();
        let iconBorder = themeNode.get_border_width(St.Side.LEFT) + themeNode.get_border_width(St.Side.RIGHT);
        let [iconMinHeight, iconNaturalHeight] = this.icons[j].label.get_preferred_height(-1);
        let iconSpacing = iconNaturalHeight + iconPadding + iconBorder;
        let totalSpacing = this._list.spacing * (this._items.length - 1);

        // We just assume the whole screen here due to weirdness happening with the passed width
        let parentPadding = this.actor.get_parent().get_theme_node().get_horizontal_padding();
        let availWidth = this._activeMonitor.width - parentPadding - this.actor.get_theme_node().get_horizontal_padding();
        let height = 0;

        for(let i =  0; i < iconSizes.length; i++) {
                this._iconSize = iconSizes[i];
                height = (iconSizes[i] * global.ui_scale) + iconSpacing;
                let w = height * this._items.length + totalSpacing;
                if (w <= availWidth)
                        break;
        }
        if (this._items.length == 1) {
            this._iconSize = iconSizes[0];
            height = (iconSizes[0] * global.ui_scale) + iconSpacing;
        }

        for(let i = 0; i < this.icons.length; i++) {
            if (this.icons[i].icon != null)
                break;
            this.icons[i].set_size(this._iconSize);
        }

        alloc.min_size = height;
        alloc.natural_size = height;
    },

    // We override SwitcherList's _onItemEnter method to delay
    // activation when the thumbnail list is open
    _onItemEnter: function (index) {
        if (this._mouseTimeOutId != 0)
            Mainloop.source_remove(this._mouseTimeOutId);
        this._itemEntered(index);
    },

    _enterItem: function(index) {
        let [x, y, mask] = global.get_pointer();
        let pickedActor = global.stage.get_actor_at_pos(Clutter.PickMode.ALL, x, y);
        if (this._items[index].contains(pickedActor))
            this._itemEntered(index);
    },

    _addIcon : function(appIcon) {
        this.icons.push(appIcon);
        this.addItem(appIcon.actor, appIcon.label);
    }
};

function ThumbnailList(windows, activeMonitor) {
    this._init(windows, activeMonitor);
}

ThumbnailList.prototype = {
    __proto__ : SwitcherList.prototype,

    _init : function(windows, activeMonitor) {
        SwitcherList.prototype._init.call(this, false, activeMonitor);

        let activeWorkspace = global.workspace_manager.get_active_workspace();

        this._labels = new Array();
        this._thumbnailBins = new Array();
        this._clones = new Array();
        this._windows = windows;

        for (let i = 0; i < windows.length; i++) {
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

        availHeight = Math.min(availHeight - labelNaturalHeight - totalPadding - spacing, THUMBNAIL_DEFAULT_SIZE * global.ui_scale);
        let binHeight = availHeight + this._items[0].get_theme_node().get_vertical_padding() + this.actor.get_theme_node().get_vertical_padding() - spacing;
        binHeight = Math.min(THUMBNAIL_DEFAULT_SIZE * global.ui_scale, binHeight);

        for (let i = 0; i < this._thumbnailBins.length; i++) {
            let metaWindow = this._windows[i];
            let container = new St.Widget();
            let clones = WindowUtils.createWindowClone(metaWindow, availHeight, availHeight, true, true);
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

    cr.$dispose();
}
