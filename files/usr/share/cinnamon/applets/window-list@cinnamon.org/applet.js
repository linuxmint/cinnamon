/* Window-list applet
 *
 * The applet code consists of four main object. WindowPreview, AppMenuButton,
 * AppMenuButtonRightClickMenu and the main applet code.
 *
 * The main applet object listens to different events and updates the window
 * list accordingly. Since addition/removal of windows is emitted by the
 * workspace, we have to listen to the changes to the number of workspaces and
 * update our signals accordingly as well. It also listens to the change in
 * window state (eg tile/maximize) since the window titles are displayed
 * differently in the AppMenuButton for each different state, eg minimized
 * windows are shown as [Title].
 *
 * For each window the main applet object wants to show, an AppMenuButton is
 * created. This is created for every window in the monitors it is responsible
 * for, regardless of whether it is on the active workspace.  Individual applet
 * objects are then shown/hidden according to which workspace they are in.
 *
 * The AppMenuButton is responsible for managing its own appearance using a
 * CinnamonGenericContainer.  We manage the allocation ourselves and shrink the
 * label when there isn't enough space in the panel (the space available is
 * divided among all AppMenuButtons and each is told how much space they can
 * use through the "allocate" signal). It also has an onFocus function that the
 * main applet calls when a window is focused.
 *
 * When a window is marked urgent or demand attention ("urgent" windows are not
 * more important that those demanding attention. These are two unrelated
 * notions in different specifications that both mean approximately the same
 * thing), we will ask the AppMenuButton to flash. If the window is from a
 * separate workspace, we generate a new temporary AppMenuButton and add it to
 * our actor box. It stops flashing when the onFocus function is called (and if
 * the window is indeed focused) (destroyed in the case of temporary
 * AppMenuButtons).
 *
 * The AppMenuButtonRightClickMenu is, as the name suggests, the right click
 * menu of the AppMenuButton. The menu is generated every time the button is
 * right-clicked, since this rarely happens and generating all at the beginning
 * would be a waste of time/memory. This also saves us from having to listen to
 * signals for changes in workspace/monitor etc.
 *
 * Finally, the WindowPreview object is a tooltip that shows a preview of the
 * window. Users can opt to show a window preview (using this), or the title
 * (using Tooltips.PanelItemTooltip) in the tooltip. The window preview is
 * generated on the fly when needed instead of cached.
 */

const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const SignalManager = imports.misc.signalManager;
const Tooltips = imports.ui.tooltips;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;

const DEFAULT_ICON_SIZE = 16; // too bad this can't be defined in theme (cinnamon-app.create_icon_texture returns a clutter actor, not a themable object -
                              // probably something that could be addressed
const ICON_HEIGHT_FACTOR = .64;
const MAX_TEXT_LENGTH = 1000;
const FLASH_INTERVAL = 500;

const WINDOW_PREVIEW_WIDTH = 200;
const WINDOW_PREVIEW_HEIGHT = 150;

function WindowPreview(item, metaWindow) {
    this._init(item, metaWindow);
}

WindowPreview.prototype = {
    __proto__: Tooltips.TooltipBase.prototype,

    _init: function(item, metaWindow) {
        Tooltips.TooltipBase.prototype._init.call(this, item.actor);
        this._applet = item._applet;

        this.actor = new St.Bin({style_class: "switcher-list", style: "margin: 0px; padding: 8px;"});
        this.actor.show_on_set_parent = false;

        this.scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;

        this.actor.set_size(WINDOW_PREVIEW_WIDTH * 1.3 * this.scaleFactor, WINDOW_PREVIEW_HEIGHT * 1.3 * this.scaleFactor);
        Main.uiGroup.add_actor(this.actor);

        this.metaWindow = metaWindow;
        this.muffinWindow = null;
        this._sizeChangedId = null;

        let box = new St.BoxLayout({ vertical: true });
        let hbox = new St.BoxLayout();

        let iconBox = new St.Bin();
        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(this.metaWindow);
        let icon = app ? app.create_icon_texture(16) : new St.Icon({ icon_name: 'application-default-icon', icon_type: St.IconType.FULLCOLOR, icon_size: 16 });
        iconBox.set_child(icon);
        hbox.add_actor(iconBox);

        this.label = new St.Label();
        this.label.style = "padding: 2px;";
        hbox.add_actor(this.label);

        box.add_actor(hbox);

        this.thumbnailBin = new St.Bin();
        box.add_actor(this.thumbnailBin);

        this.actor.set_child(box);
    },

    _onEnterEvent: function(actor, event) {
        if (this._applet._tooltipShowing)
            this.show();
        else if (!this._showTimer)
            this._showTimer = Mainloop.timeout_add(300, Lang.bind(this, this._onTimerComplete));

        this.mousePosition = event.get_coords();
    },

    _hide: function(actor, event) {
        Tooltips.TooltipBase.prototype._hide.call(this, actor, event);
        this._applet.erodeTooltip();
    },

    show: function() {
        if (!this.actor || this._applet._menuOpen)
            return

        this.muffinWindow = this.metaWindow.get_compositor_private();
        let windowTexture = this.muffinWindow.get_texture();
        let [width, height] = windowTexture.get_size();
        let scale = Math.min(1.0, WINDOW_PREVIEW_WIDTH / width, WINDOW_PREVIEW_HEIGHT / height);

        if (this.thumbnail) {
            this.thumbnailBin.set_child(null);
            this.thumbnail.destroy();
        }

        this.thumbnail = new Clutter.Clone({
            source: windowTexture,
            width: width * scale * this.scaleFactor,
            height: height * scale * this.scaleFactor
        });

        this._setSize = function() {
            [width, height] = windowTexture.get_size();
            scale = Math.min(1.0, WINDOW_PREVIEW_WIDTH / width, WINDOW_PREVIEW_HEIGHT / height);
            this.thumbnail.set_size(width * scale * this.scaleFactor, height * scale * this.scaleFactor);
        };
        this._sizeChangedId = this.muffinWindow.connect('size-changed',
            Lang.bind(this, this._setSize));

        this.thumbnailBin.set_child(this.thumbnail);

        let allocation = this.actor.get_allocation_box();
        let previewHeight = allocation.y2 - allocation.y1;
        let previewWidth = allocation.x2 - allocation.x1;

        let monitor = Main.layoutManager.findMonitorForActor(this.item);
        let previewTop;

        if (this._applet.orientation == St.Side.BOTTOM) {
            previewTop = this.item.get_transformed_position()[1] - previewHeight - 5;
        } else if (this._applet.orientation == St.Side.TOP) {
            previewTop = this.item.get_transformed_position()[1] + this.item.get_transformed_size()[1] + 5;
        } else {
            previewTop = this.item.get_transformed_position()[1];
        }

        let previewLeft;
        if (this._applet.orientation == St.Side.BOTTOM || this._applet.orientation == St.Side.TOP) { 
            // centre the applet on the window list item if window list is on the top or bottom panel
            previewLeft = this.item.get_transformed_position()[0] + this.item.get_transformed_size()[0]/2 - previewWidth/2;
        } else if (this._applet.orientation == St.Side.LEFT) {
            previewLeft = this.item.get_transformed_position()[0] + this.item.get_transformed_size()[0] + 5;
        } else if (this._applet.orientation == St.Side.RIGHT) {
            previewLeft = this.item.get_transformed_position()[0] - previewWidth -5;
        }
        previewLeft = Math.round(previewLeft);
        previewLeft = Math.max(previewLeft, monitor.x);
        previewLeft = Math.min(previewLeft, monitor.x + monitor.width - previewWidth);

        previewTop  = Math.round(previewTop);
        previewTop  = Math.min(previewTop, monitor.y + monitor.height - previewHeight);

        this.actor.set_position(previewLeft, previewTop);

        this.actor.show();
        this.visible = true;
        this._applet.cancelErodeTooltip();
        this._applet._tooltipShowing = true;
    },

    hide: function() {
        if (this._sizeChangedId != null) {
            this.muffinWindow.disconnect(this._sizeChangedId);
            this._sizeChangedId = null;
        }
        if (this.thumbnail) {
            this.thumbnailBin.set_child(null);
            this.thumbnail.destroy();
        }
        if (this.actor) {
            this.actor.hide();
        }
        this.visible = false;
    },

    set_text: function(text) {
        this.label.set_text(text);
    },

    _destroy: function() {
        if (this._sizeChangedId != null) {
            this.muffinWindow.disconnect(this._sizeChangedId);
            this.sizeChangedId = null;
        }
        if (this.thumbnail) {
            this.thumbnailBin.set_child(null);
            this.thumbnail.destroy();
        }
        if (this.actor) {
            this.actor.destroy();
        }
        this.actor = null;
    }
}

function AppMenuButton(applet, metaWindow, alert) {
    this._init(applet, metaWindow, alert);
}

AppMenuButton.prototype = {
    _init: function(applet, metaWindow, alert) {

	this.actor = new Cinnamon.GenericContainer({
	    name: 'appMenu',
	    style_class: 'window-list-item-box',
	    reactive: true,
	    can_focus: true,
	    track_hover: true });

        this._applet = applet;
        this.metaWindow = metaWindow;
        this.alert = alert;

        if (this._applet.orientation == St.Side.TOP)
            this.actor.add_style_class_name('top');
        else if (this._applet.orientation == St.Side.BOTTOM)
            this.actor.add_style_class_name('bottom');
        else if (this._applet.orientation == St.Side.LEFT)
            this.actor.add_style_class_name('left');
        else if (this._applet.orientation == St.Side.RIGHT)
            this.actor.add_style_class_name('right');

        this.actor._delegate = this;
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));

        this.actor.connect('get-preferred-width',
                Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height',
                Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));

        this._iconBox = new Cinnamon.Slicer({ name: 'appMenuIcon'});
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClipAndGeometry));
        this.actor.add_actor(this._iconBox);
        this._label = new St.Label();
        this.actor.add_actor(this._label);

        this._iconBottomClip = 0;
        this._visible = true;

        this._updateCaptionId = this.metaWindow.connect('notify::title',
                Lang.bind(this, this.setDisplayTitle));
        this._updateTileTypeId = this.metaWindow.connect('notify::tile-type',
                Lang.bind(this, this.setDisplayTitle));

        this.onPreviewChanged();

        if (!this.alert) {
            this._menuManager = new PopupMenu.PopupMenuManager(this);
            this.rightClickMenu = new AppMenuButtonRightClickMenu(this, this.metaWindow, this._applet.orientation);
            this._menuManager.addMenu(this.rightClickMenu);

            this._draggable = DND.makeDraggable(this.actor, null, this._applet.actor);
            this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
            this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
            this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));
        }

        this.onPanelEditModeChanged();
        global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.onPanelEditModeChanged));

        this._windows = this._applet._windows;
        this.scrollConnector = null;
        this.onScrollModeChanged();
        this._needsAttention = false;

        this.setDisplayTitle();
        this.onFocus()

        if (this.alert)
            this.getAttention();
    },

    onPreviewChanged: function() {
        if (this._tooltip)
            this._tooltip.destroy();

        if (this._applet.usePreview)
            this._tooltip = new WindowPreview(this, this.metaWindow, this._applet.orientation);
        else
            this._tooltip = new Tooltips.PanelItemTooltip(this, "", this._applet.orientation);
        
        this.setDisplayTitle();
    },

    onPanelEditModeChanged: function() {
        if (this._draggable)
            this._draggable.inhibit = global.settings.get_boolean("panel-edit-mode");
    },

    onScrollModeChanged: function() {
        if (this._applet.scrollable) {
            this.scrollConnector = this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
        } else {
            if (this.scrollConnector) {
                this.actor.disconnect(this.scrollConnector);
                this.scrollConnector = null;
            }
        }
    },

    _onScrollEvent: function(actor, event) {
        let direction = event.get_scroll_direction();

        // Find the current focused window
        let windows = this.actor.get_parent().get_children()
            .filter(function(item) {
                return item.visible;
            }).map(function(item) {
                return item._delegate;
            });

            windows = windows.reverse();

        let i = windows.length;
        while (i-- && !windows[i].metaWindow.has_focus());

        if (i == -1)
            return;

        //                   v   home-made xor
        if ((direction == 0) != this._applet.reverseScroll)
            i++;
        else
            i--;

        if (i == windows.length)
            i = 0;
        else if (i == -1)
            i = windows.length - 1;

        Main.activateWindow(windows[i].metaWindow, global.get_current_time());
    },

    _onDragBegin: function() {
        this._draggable._overrideY = this.actor.get_transformed_position()[1];
        this._tooltip.hide();
        this._tooltip.preventShow = true;
    },

    _onDragEnd: function() {
        this.actor.show();
        this._applet.clearDragPlaceholder();
        this._tooltip.preventShow = false;
    },

    _onDragCancelled: function() {
        this.actor.show();
        this._applet.clearDragPlaceholder();
        this._tooltip.preventShow = false;
    },

    getDragActor: function() {
        let clone    = new Clutter.Clone({ source: this.actor });
        clone.width  = this.actor.width;
        clone.height = this.actor.height;
        return clone;
    },

    getDragActorSource: function() {
        return this.actor;
    },

    handleDragOver: function(source, actor, x, y, time) {
        if (this._draggable && this._draggable.inhibit)
            return DND.DragMotionResult.MOVE_DROP;

        if (source instanceof AppMenuButton)
            return DND.DragMotionResult.CONTINUE;

        /* Users can drag things from one window to another window (eg drag an
         * image from Firefox to LibreOffice). However, if the target window is
         * hidden, they will drag to the AppWindowButton of the target window,
         * and we will open the window for them. */
        this._toggleWindow(true);
        return DND.DragMotionResult.NO_DROP;
    },

    acceptDrop: function(source, actor, x, y, time) {
        return false;
    },

    setDisplayTitle: function() {
        let title   = this.metaWindow.get_title();
        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(this.metaWindow);

        if (!title) title = app ? app.get_name() : '?';

        /* Sanitize the window title to prevent dodgy window titles such as
         * "); DROP TABLE windows; --. Turn all whitespaces into " " because
         * newline characters are known to cause trouble. Also truncate the
         * title when necessary or else cogl might get unhappy and crash
         * Cinnamon. */
        title = title.replace(/\s/g, " ");
        if (title.length > MAX_TEXT_LENGTH)
            title = title.substr(0, MAX_TEXT_LENGTH);

        if (this._tooltip  && this._tooltip.set_text)
            this._tooltip.set_text(title);

        if (this.metaWindow.minimized) {
            title = "["+ title +"]";
        } else if (this.metaWindow.tile_type == Meta.WindowTileType.TILED) {
            title = "|"+ title;
        }
        else if (this.metaWindow.tile_type == Meta.WindowTileType.SNAPPED) {
            title = "||"+ title;
        }
        if (this._applet.orientation == St.Side.TOP || this._applet.orientation == St.Side.BOTTOM) {
            this._label.set_text(title);
        }
        else {
            this._label.set_text(""); // no space to show title on vertical panels
        }

        this._label.set_text(title);
    },

    destroy: function() {
        this.metaWindow.disconnect(this._updateCaptionId);
        this.metaWindow.disconnect(this._updateTileTypeId);
        this._tooltip.destroy();
        if (this.rightClickMenu) {
            this.rightClickMenu.destroy();
        }
        this.actor.destroy();
    },

    _hasFocus: function() {
        if (this.metaWindow.minimized)
            return false;

        if (this.metaWindow.has_focus())
            return true;

        let transientHasFocus = false;
        this.metaWindow.foreach_transient(function(transient) {
            if (transient.has_focus()) {
                transientHasFocus = true;
                return false;
            }
            return true;
        });
        return transientHasFocus;
    },

    onFocus: function() {
        if (this._hasFocus()) {
            this.actor.add_style_pseudo_class('focus');
            this.actor.remove_style_class_name("window-list-item-demands-attention");
            this.actor.remove_style_class_name("window-list-item-demands-attention-top");
            this._needsAttention = false;

            if (this.alert) {
                this.destroy();
                this._windows.splice(this._windows.indexOf(this), 1);
            }
        } else {
            this.actor.remove_style_pseudo_class('focus');
        }
        this.setIcon();
    },

    _onButtonRelease: function(actor, event) {
        this._tooltip.hide();
        if (this.alert) {
            if (event.get_button() == 1)
                this._toggleWindow(false);
            return false;
        }

        if (event.get_button() == 1) {
            if (this.rightClickMenu.isOpen)
                this.rightClickMenu.toggle();

            this._toggleWindow(false);
        } else if (event.get_button() == 2 && this._applet.middleClickClose) {
            this.metaWindow.delete(global.get_current_time());
        }
        return true;
    },

    _onButtonPress: function(actor, event) {
        this._tooltip.hide();
        if (!this.alert && event.get_button() == 3) {
            this.rightClickMenu.mouseEvent = event;
            this.rightClickMenu.toggle();
        }
    },

    _toggleWindow: function(fromDrag){
        if (!this._hasFocus()) {
            Main.activateWindow(this.metaWindow, global.get_current_time());
            this.actor.add_style_pseudo_class('focus');
        } else if (!fromDrag) {
            this.metaWindow.minimize(global.get_current_time());
            this.actor.remove_style_pseudo_class('focus');
        }
    },

    _onIconBoxStyleChanged: function() {
        let node = this._iconBox.get_theme_node();
        this._iconBottomClip = node.get_length('app-icon-bottom-clip');
        this._updateIconBoxClipAndGeometry();
    },

    _updateIconBoxClipAndGeometry: function() {
        let allocation = this._iconBox.allocation;
        if (this._iconBottomClip > 0)
            this._iconBox.set_clip(0, 0,
                   allocation.x2 - allocation.x1,
                   allocation.y2 - allocation.y1 - this._iconBottomClip);
        else
            this._iconBox.remove_clip();

        let rect = new Meta.Rectangle();
        [rect.x, rect.y] = this.actor.get_transformed_position();
        [rect.width, rect.height] = this.actor.get_transformed_size();

        this.metaWindow.set_icon_geometry(rect);
    },

    _getPreferredWidth: function(actor, forHeight, alloc) {
        let [minSize, naturalSize] = this._iconBox.get_preferred_width(forHeight);
        // minimum size just enough for icon if we ever get that many apps going

        alloc.min_size = naturalSize + 2 * 3 * global.ui_scale;

        if (this._applet.orientation == St.Side.TOP || this._applet.orientation == St.Side.BOTTOM ) {
        // the 'buttons use entire space' option only makes sense on horizontal panels
            if (this._applet.buttonsUseEntireSpace) {
                let [lminSize, lnaturalSize] = this._label.get_preferred_width(forHeight);
                alloc.natural_size = Math.max(150 * global.ui_scale,
                        lnaturalSize + naturalSize + 3 * 3 * global.ui_scale);
            } else {
                alloc.natural_size = 150 * global.ui_scale;
            }
        }
        else {    // on vertical panels just use the minimum size
            alloc.natural_size = alloc.min_size;
        }
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {
        let [minSize1, naturalSize1] = this._iconBox.get_preferred_height(forWidth); 
        let [minSize2, naturalSize2] = this._label.get_preferred_height(forWidth);
        let pheight  = this._applet._panelHeight;

        alloc.min_size = Math.max(minSize1, minSize2);

        if (this._applet.orientation == St.Side.TOP || this._applet.orientation == St.Side.BOTTOM )

            alloc.natural_size = pheight - 2; // putting a container around the actor for layout management reasons 
                                              // affects the allocation,causing the visible border to pull in close around the contents
                                              // which is not the desired (pre-existing) behaviour on top and bottom panels, 
                                              // so need to push the visible border back towards the panel edge.
                                              // Using the actor size will cause recursion errors as clutter tries
                                              // to make everything fit, so am using the panel height minus a minimal wodge
                                              // I have had no joy using the ways I would have expected to work - fill and expand
                                              // but perhaps I have just not got the right combo of parameters on the right actor
        else
            alloc.natural_size = Math.max(naturalSize1, naturalSize2);
    },

    _allocate: function(actor, box, flags) {
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;

        let childBox = new Clutter.ActorBox();

        let [minWidth, minHeight, naturalWidth, naturalHeight] = this._iconBox.get_preferred_size();

        let direction = this.actor.get_text_direction();
        let xPadding = 3 * global.ui_scale;
        let yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);

        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);
        if (direction == Clutter.TextDirection.LTR) {
            if (allocWidth < naturalWidth + xPadding * 2)
                childBox.x1 = Math.max(0, (allocWidth - naturalWidth) / 2)
            else
                childBox.x1 = Math.min(allocWidth, xPadding);
            childBox.x2 = Math.min(childBox.x1 + naturalWidth, allocWidth);
        } else {
            if (allocWidth < naturalWidth + xPadding * 2)
                childBox.x1 = Math.max(0, (allocWidth - naturalWidth)/2);
            else
                childBox.x1 = allocWidth - naturalWidth - xPadding;
            childBox.x2 = Math.min(childBox.x1 + naturalWidth, allocWidth);
        }

        this._iconBox.allocate(childBox, flags);

        [minWidth, minHeight, naturalWidth, naturalHeight] = this._label.get_preferred_size();

        yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
        childBox.y1 = yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);
        if (direction == Clutter.TextDirection.LTR) {
            // Reuse the values from the previous allocation
            childBox.x1 = Math.min(childBox.x2 + xPadding, Math.max(0, allocWidth - xPadding));
            childBox.x2 = Math.max(childBox.x1, allocWidth - xPadding);
        } else {
            childBox.x2 = Math.max(childBox.x1 - xPadding, 0);
            childBox.x1 = Math.min(childBox.x2, xPadding);
        }

        this._label.allocate(childBox, flags);
    },

    setIcon: function() {
        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(this.metaWindow);

        if (this._applet._scaleMode)
            this.iconSize = Math.round(this._applet._panelHeight * ICON_HEIGHT_FACTOR / global.ui_scale);
        else
            this.iconSize = DEFAULT_ICON_SIZE;

        let icon = app ?
            app.create_icon_texture(this.iconSize) :
            new St.Icon({ icon_name: 'application-default-icon',
                icon_type: St.IconType.FULLCOLOR,
                icon_size: this.iconSize });

        let old_child = this._iconBox.get_child();
        this._iconBox.set_child(icon);

        if (old_child)
            old_child.destroy();
    },

    getAttention: function() {
        if (this._needsAttention)
            return false;

        this._needsAttention = true;
        let counter = 0;
        this._flashButton(counter);
        return true;
    },

    _flashButton: function(counter) {
        if (!this._needsAttention)
            return;

        this.actor.add_style_class_name("window-list-item-demands-attention");
        if (counter < 4) {
            Mainloop.timeout_add(FLASH_INTERVAL, Lang.bind(this, function () {
                if (this.actor.has_style_class_name("window-list-item-demands-attention")) {
                    this.actor.remove_style_class_name("window-list-item-demands-attention");
                }
                Mainloop.timeout_add(FLASH_INTERVAL, Lang.bind(this, function () {
                    this._flashButton(++counter);
                }));
            }));
        }
    }
};

function AppMenuButtonRightClickMenu(launcher, metaWindow, orientation) {
    this._init(launcher, metaWindow, orientation);
}

AppMenuButtonRightClickMenu.prototype = {
    __proto__: Applet.AppletPopupMenu.prototype,

    _init: function(launcher, metaWindow, orientation) {
        Applet.AppletPopupMenu.prototype._init.call(this, launcher, orientation);

        this._launcher = launcher;
        this._windows = launcher._applet._windows;
        this.connect('open-state-changed', Lang.bind(this, this._onToggled));

        this.orientation = orientation;
        this.metaWindow = metaWindow;
    },

    _populateMenu: function(){
        this.box.pack_start = this.orientation == St.Side.TOP;

        let mw = this.metaWindow;
        let item;
        let length;
        item = new PopupMenu.PopupIconMenuItem(_("Configure the window list"), "system-run", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this._launcher._applet, this._launcher._applet.configureApplet));
        this.addMenuItem(item);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Move to monitor
        if ((length = Main.layoutManager.monitors.length) == 2) {
            Main.layoutManager.monitors.forEach(function (monitor, index) {
                if (index === mw.get_monitor()) return;
                item = new PopupMenu.PopupMenuItem(_("Move to the other monitor"));
                item.connect('activate', function() {
                    mw.move_to_monitor(index);
                });
                this.addMenuItem(item);
            }, this);
        }
        else if ((length = Main.layoutManager.monitors.length) > 2) {
            Main.layoutManager.monitors.forEach(function (monitor, index) {
                if (index === mw.get_monitor()) return;
                item = new PopupMenu.PopupMenuItem(_("Move to monitor %d").format(index + 1));
                item.connect('activate', function() {
                    mw.move_to_monitor(index);
                });
                this.addMenuItem(item);
            }, this);
        }

        // Move to workspace
        if ((length = global.screen.n_workspaces) > 1) {
            if (mw.is_on_all_workspaces()) {
                item = new PopupMenu.PopupMenuItem(_("Only on this workspace"));
                item.connect('activate', function() {
                    mw.unstick();
                });
                this.addMenuItem(item);
            } else {
                item = new PopupMenu.PopupMenuItem(_("Visible on all workspaces"));
                item.connect('activate', function() {
                    mw.stick();
                });
                this.addMenuItem(item);

                item = new PopupMenu.PopupSubMenuMenuItem(_("Move to another workspace"));
                this.addMenuItem(item);

                let curr_index = mw.get_workspace().index();
                for (let i = 0; i < length; i++) {
                    if (i == curr_index) continue;

                    // Make the index a local variable to pass to function
                    let j = i;
                    item.menu.addAction(
                            Main.workspace_names[i] ? Main.workspace_names[i] : Main._makeDefaultWorkspaceName(i),
                            function() {
                                mw.change_workspace(global.screen.get_workspace_by_index(j));
                            });
                }

            }
        }

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Close all/others
        item = new PopupMenu.PopupMenuItem(_("Close all"));
        item.connect('activate', Lang.bind(this, function() {
            for (let window of this._windows)
                if (window.actor.visible &&
                   !window._needsAttention)
                    window.metaWindow.delete(global.get_current_time);
        }));
        this.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Close others"));
        item.connect('activate', Lang.bind(this, function() {
            for (let window of this._windows)
                if (window.actor.visible &&
                    window.metaWindow != this.metaWindow &&
                   !window._needsAttention)
                    window.metaWindow.delete(global.get_current_time);
        }));
        this.addMenuItem(item);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Miscellaneous
        if (mw.get_compositor_private().opacity != 255) {
            item = new PopupMenu.PopupMenuItem(_("Restore to full opacity"));
            item.connect('activate', function() {
                mw.get_compositor_private().set_opacity(255);
            });
            this.addMenuItem(item);
        }

        if (mw.minimized) {
            item = new PopupMenu.PopupMenuItem(_("Restore"));
            item.connect('activate', function() {
                Main.activateWindow(mw, global.get_current_time());
            });
        } else {
            item = new PopupMenu.PopupMenuItem(_("Minimize"));
            item.connect('activate', function() {
                mw.minimize(global.get_current_time());
            });
        }
        this.addMenuItem(item);

        if (mw.get_maximized()) {
            item = new PopupMenu.PopupMenuItem(_("Unmaximize"));
            item.connect('activate', function() {
                mw.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
            });
        } else {
            item = new PopupMenu.PopupMenuItem(_("Maximize"));
            item.connect('activate', function() {
                mw.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
            });
        }
        this.addMenuItem(item);

        item = new PopupMenu.PopupMenuItem(_("Close"));
        item.connect('activate', function() {
            mw.delete(global.get_current_time());
        });
        this.addMenuItem(item);
    },

    _onToggled: function(actor, isOpening){
        if (this.isOpen)
            this._launcher._applet._menuOpen = true;
        else
            this._launcher._applet._menuOpen = false;

        if (!isOpening) {
            return;
        }
        this.removeAll();
        this._populateMenu();
    },
};

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.actor.set_track_hover(false);
        this.actor.set_style_class_name("window-list-box");
        this.orientation = orientation;
//
// A layout manager is used to cater for vertical panels as well as horizontal
//
        let manager;
	if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM)
	{
            manager = new Clutter.BoxLayout( { spacing: 2 * global.ui_scale,
		                               orientation: Clutter.Orientation.HORIZONTAL});
	}
	else
	{
            manager = new Clutter.BoxLayout( { spacing: 2 * global.ui_scale,
		                               orientation: Clutter.Orientation.VERTICAL});
            this.actor.add_style_class_name("vertical");
	}

        this.manager = manager;
        this.manager_container = new Clutter.Actor( { layout_manager: manager } );
        this.actor.add_actor (this.manager_container);
        //this.manager_container.show();

        this.dragInProgress = false;
        this._tooltipShowing = false;
        this._tooltipErodeTimer = null;
        this._menuOpen = false;
        this._urgentSignal = null;
        this._windows = [];
        this._monitorWatchList = [];

        this.settings = new Settings.AppletSettings(this, "window-list@cinnamon.org", this.instance_id);

        this.settings.bindProperty(Settings.BindingDirection.IN,
                "enable-alerts",
                "enableAlerts",
                this._updateAttentionGrabber,
                null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
                "enable-scrolling",
                "scrollable",
                this._onEnableScrollChanged,
                null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
                "reverse-scrolling",
                "reverseScroll",
                null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
                "middle-click-close",
                "middleClickClose",
                null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
                "buttons-use-entire-space",
                "buttonsUseEntireSpace",
                this._refreshItems, null);
        this.settings.bindProperty(Settings.BindingDirection.IN,
                "window-preview",
                "usePreview",
                this._onPreviewChanged, null);

        this.signals = new SignalManager.SignalManager(this);

        let tracker = Cinnamon.WindowTracker.get_default();
        this.signals.connect(tracker, "notify::focus-app", this._onFocus);
        this.signals.connect(global.screen, 'window-added', this._onWindowAdded);
        this.signals.connect(global.screen, 'window-removed', this._onWindowRemoved);
        this.signals.connect(global.screen, 'window-monitor-changed', this._onWindowMonitorChanged);
        this.signals.connect(global.screen, 'window-workspace-changed', this._onWindowWorkspaceChanged);
        this.signals.connect(global.screen, 'monitors-changed', this._updateWatchedMonitors);
        this.signals.connect(global.window_manager, 'switch-workspace', this._refreshAllItems);

        this.signals.connect(global.window_manager, 'minimize', this._onWindowStateChange);
        this.signals.connect(global.window_manager, 'maximize', this._onWindowStateChange);
        this.signals.connect(global.window_manager, 'unmaximize', this._onWindowStateChange);
        this.signals.connect(global.window_manager, 'map', this._onWindowStateChange);
        this.signals.connect(global.window_manager, 'tile', this._onWindowStateChange);

        global.settings.bind("panel-edit-mode", this.actor, "reactive", Gio.SettingsBindFlags.DEFAULT);

        this.on_orientation_changed(orientation);
        this._updateAttentionGrabber();
    },

    on_applet_removed_from_panel: function() {
        this.signals.disconnectAllSignals();
    },

    on_applet_instances_changed: function() {
        this._updateWatchedMonitors();
    },

    on_panel_height_changed: function() {
        this._refreshAllItems();
    },
//
//override getDisplayLayout to declare that this applet is suitable for both horizontal and
// vertical orientations
//
    getDisplayLayout: function() {
        return Applet.DisplayLayout.BOTH;
    },

    on_orientation_changed: function(orientation) {

        this.orientation = orientation;
	if (orientation == St.Side.TOP || orientation == St.Side.BOTTOM)
	{
            this.manager.set_vertical(false);
            this._reTitleItems();  //titles stripped out in vertical panels, so restore titles
            this.actor.remove_style_class_name("vertical");
	}
	else		// vertical panels
	{
            this.manager.set_vertical(true);
            this.actor.add_style_class_name("vertical");
            this.actor.set_x_align(Clutter.ActorAlign.CENTER);
            this.actor.set_important(true);
        }

        //
        // For horizontal panels any padding/margin is removed on one side
        // so that the AppMenuButton boxes butt up against the edge of the screen
        //
        if (orientation == St.Side.TOP) {
            for (let child of this.manager_container.get_children()) {
                child.set_style_class_name('window-list-item-box top');
                child.set_style('margin-top: 0px; padding-top: 0px;');
            }
            this.actor.set_style('margin-top: 0px; padding-top: 0px;');
        } else if (orientation == St.Side.BOTTOM) {
            for (let child of this.manager_container.get_children()) {
                child.set_style_class_name('window-list-item-box bottom');
                child.set_style('margin-bottom: 0px; padding-bottom: 0px;');
            }
            this.actor.set_style('margin-bottom: 0px; padding-bottom: 0px;');
        } else if (orientation == St.Side.LEFT) {
            for (let child of this.manager_container.get_children()) {
                child.set_style_class_name('window-list-item-box left');
                child.set_style('margin-left 0px; padding-left: 0px; padding-right: 0px; margin-right: 0px;');
                child.set_x_align(Clutter.ActorAlign.CENTER);
            }
            this.actor.set_style('margin-left: 0px; padding-left: 0px; padding-right: 0px; margin-right: 0px;');
        } else if (orientation == St.Side.RIGHT) {
            for (let child of this.manager_container.get_children()) {
                child.set_style_class_name('window-list-item-box right');
                child.set_style('margin-left: 0px; padding-left: 0px; padding-right: 0px; margin-right: 0px;');
                child.set_x_align(Clutter.ActorAlign.CENTER);
            }
            this.actor.set_style('margin-right: 0px; padding-right: 0px; padding-left: 0px; margin-left: 0px;');
        }
    },

    _onWindowAdded: function(screen, metaWindow, monitor) {
        if (this._shouldAdd(metaWindow))
            this._addWindow(metaWindow);
    },

    _onWindowRemoved: function(screen, metaWindow) {
        this._removeWindow(metaWindow);
    },

    _onWindowMonitorChanged: function(screen, metaWindow, monitor) {
        if (this._shouldAdd(metaWindow))
            this._addWindow(metaWindow);
        else
            this._removeWindow(metaWindow);
    },

    _onWindowWorkspaceChanged: function(screen, metaWindow, metaWorkspace) {
        let window = this._windows.find(win => (win.metaWindow == metaWindow));

        if (window)
            this._refreshItem(window);
    },

    _updateAttentionGrabber: function() {
        if (this.enableAlerts) {
            this.signals.connect(global.display, "window-marked-urgent", this._onWindowDemandsAttention);
            this.signals.connect(global.display, "window-demands-attention", this._onWindowDemandsAttention);
        } else {
            this.signals.disconnect("window-marked-urgent");
            this.signals.disconnect("window-demands-attention");
        }
    },

    _onEnableScrollChanged: function() {
        for (let window of this._windows)
            window.onScrollModeChanged();
    },

    _onPreviewChanged: function() {
        for (let window of this._windows)
            window.onPreviewChanged();
    },

    _onWindowDemandsAttention : function(display, window) {
        // Magic to look for AppMenuButton owning window
        let i = this._windows.length;
        while (i-- && this._windows[i].metaWindow != window);

        // Window is not in our list
        if (i == -1)
            return;

        // Asks AppMenuButton to flash. Returns false if already flashing
        if (!this._windows[i].getAttention())
            return;

        if (window.get_workspace() != global.screen.get_active_workspace())
            this._addWindow(window, true);
    },

    _onFocus: function() {
        for (let window of this._windows)
            window.onFocus();
    },

    _refreshItem: function(window) {
        window.actor.visible =
            (window.metaWindow.get_workspace() == global.screen.get_active_workspace()) ||
            window.metaWindow.is_on_all_workspaces();

        /* The above calculates the visibility if it were the normal
         * AppMenuButton. If this is actually a temporary AppMenuButton for
         * urgent windows on other workspaces, it is shown iff the normal
         * one isn't shown! */
        if (window.alert)
            window.actor.visible = !window.actor.visible;
    },

    _refreshAllItems: function() {
        for (let window of this._windows) {
            this._refreshItem(window);
        }
        this._onFocus();
    },

    _reTitleItems: function() {
        for (let window of this._windows) {
            window.setDisplayTitle();
        }
    },

    _onWindowStateChange: function(cinnamonwm, actor) {
        for (let window of this._windows)
            if (window.metaWindow == actor.metaWindow)
                window.setDisplayTitle();
    },

    // Used by windowManager for traditional minimize and map effect
    getOriginFromWindow: function(metaWindow) {
        for (let window of this._windows)
            if (window.metaWindow == metaWindow)
                return window.actor;

        return false;
    },

    _updateWatchedMonitors: function() {
        let n_mons = Gdk.Screen.get_default().get_n_monitors();
        let on_primary = this.panel.monitorIndex == Main.layoutManager.primaryIndex;
        let instances = Main.AppletManager.getRunningInstancesForUuid(this._uuid);

        /* Simple cases */
        if (n_mons == 1) {
            this._monitorWatchList = [Main.layoutManager.primaryIndex];
        } else if (instances.length > 1 && !on_primary) {
            this._monitorWatchList = [this.panel.monitorIndex];
        } else {
            /* This is an instance on the primary monitor - it will be
             * responsible for any monitors not covered individually.  First
             * convert the instances list into a list of the monitor indices,
             * and then add the monitors not present to the monitor watch list
             * */
            this._monitorWatchList = [this.panel.monitorIndex];

            instances = instances.map(function(x) {
                return x.panel.monitorIndex;
            });

            for (let i = 0; i < n_mons; i++)
                if (instances.indexOf(i) == -1)
                    this._monitorWatchList.push(i);
        }

        // Now track the windows in our favorite monitors
        let windows = global.display.list_windows(0);

        for (let window of windows) {
            if (this._shouldAdd(window))
                this._addWindow(window);
            else
                this._removeWindow(window);
        }
    },

    _addWindow: function(metaWindow, alert) {
        for (let window of this._windows)
            if (window.metaWindow == metaWindow &&
                window.temp == alert)
                return;

        let appButton = new AppMenuButton(this, metaWindow, alert);
        this.manager_container.add_actor(appButton.actor);

        this._windows.push(appButton);
        /* We want to make the AppMenuButtons look like they are ordered by
         * workspace. So if we add an AppMenuButton for a window in another
         * workspace, put it in the right position. It is at the end by
         * default, so move it to the start if needed */
        if (alert) {
            if (metaWindow.get_workspace().index() < global.screen.get_active_workspace_index())
                this.manager_container.set_child_at_index(appButton.actor, 0);
        } else {
            if (metaWindow.get_workspace() != global.screen.get_active_workspace())
                appButton.actor.hide();
        }
    },

    _removeWindow: function(metaWindow) {
        let i = this._windows.length;
        // Do an inverse loop because we might remove some elements
        while (i--) {
            if (this._windows[i].metaWindow == metaWindow) {
                this._windows[i].destroy();
                this._windows.splice(i, 1);
            }
        }
    },

    _shouldAdd: function(metaWindow) {
        return Main.isInteresting(metaWindow) &&
            this._monitorWatchList.indexOf(metaWindow.get_monitor()) != -1;
    },

    handleDragOver: function(source, actor, x, y, time) {
        if (this._inEditMode)
            return DND.DragMotionResult.MOVE_DROP;
        if (!(source instanceof AppMenuButton))
            return DND.DragMotionResult.NO_DROP;

        source.actor.hide();
        let children = this.manager_container.get_children();

        let pos = children.length;
        while (--pos && x < children[pos].get_allocation_box().x1);

        this._dragPlaceholderPos = pos;

        if (this._dragPlaceholder == undefined) {
            this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
            this._dragPlaceholder.child.set_width (source.actor.width);
            this._dragPlaceholder.child.set_height (source.actor.height);

            this.manager_container.insert_child_at_index(this._dragPlaceholder.actor,
                                                         this._dragPlaceholderPos);
        } else {
            this.manager_container.set_child_at_index(this._dragPlaceholder.actor,
                                                         this._dragPlaceholderPos);
        }

        return DND.DragMotionResult.MOVE_DROP;
    },

    acceptDrop: function(source, actor, x, y, time) {
        if (!(source instanceof AppMenuButton)) return false;
        if (this._dragPlaceholderPos == undefined) return false;

        this.manager_container.set_child_at_index(source.actor, this._dragPlaceholderPos);

        return true;
    },

    clearDragPlaceholder: function() {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.actor.destroy();
            this._dragPlaceholder = undefined;
            this._dragPlaceholderPos = undefined;
        }
    },

    erodeTooltip: function() {
        if (this._tooltipErodeTimer) {
            Mainloop.source_remove(this._tooltipErodeTimer);
            this._tooltipErodeTimer = null;
        }

        this._tooltipErodeTimer = Mainloop.timeout_add(300, Lang.bind(this, function() {
            this._tooltipShowing = false;
            this._tooltipErodeTimer = null;
            return false;
        }));
    },

    cancelErodeTooltip: function() {
        if (this._tooltipErodeTimer) {
            Mainloop.source_remove(this._tooltipErodeTimer);
            this._tooltipErodeTimer = null;
        }
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
