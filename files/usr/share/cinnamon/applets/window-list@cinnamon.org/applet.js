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
const Cogl = imports.gi.Cogl;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const AppletManager = imports.ui.appletManager;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Settings = imports.ui.settings;
const SignalManager = imports.misc.signalManager;
const Tooltips = imports.ui.tooltips;
const WindowUtils = imports.misc.windowUtils;

const MAX_TEXT_LENGTH = 1000;
const FLASH_INTERVAL = 500;
const FLASH_MAX_COUNT = 4;

const WINDOW_PREVIEW_WIDTH = 200;
const WINDOW_PREVIEW_HEIGHT = 150;

class WindowPreview extends Tooltips.TooltipBase {
    constructor(item, metaWindow, previewScale, showLabel) {
        super(item.actor);
        this._applet = item._applet;
        this.metaWindow = metaWindow;
        this._windowActor = null;
        this.uiScale = global.ui_scale;
        this.thumbScale = previewScale;

        this._sizeChangedId = 0;
        this.thumbnail = null;

        this.actor = new St.BoxLayout({ vertical: true, style_class: "window-list-preview", important: true });
        this.actor.show_on_set_parent = false;
        Main.uiGroup.add_actor(this.actor);

        this.label = new St.Label();
        this.labelBin = new St.Bin({ y_align: St.Align.MIDDLE });
        this.labelBin.set_width(WINDOW_PREVIEW_WIDTH * this.thumbScale * this.uiScale);
        this.labelBin.add_actor(this.label);
        this.actor.add_actor(this.labelBin);

        if (!showLabel) {
            this.labelBin.hide();
        }

        this.thumbnailBin = new St.Bin();
        this.actor.add_actor(this.thumbnailBin);
    }

    get windowActor() {
        if (this._windowActor) {
            return this._windowActor;
        }

        this._windowActor = this.metaWindow.get_compositor_private();

        if (this._windowActor) {
            return this._windowActor;
        } else {
            log("metaWindow has no actor!");
            return null;
        }
    }

    _onEnterEvent(actor, event) {
        if (this._applet._tooltipShowing)
            this.show();
        else if (!this._showTimer)
            this._showTimer = Mainloop.timeout_add(300, Lang.bind(this, this._onShowTimerComplete));

        this.mousePosition = event.get_coords();
    }

    _getScaledTextureSize(windowTexture) {
        let [width, height] = windowTexture.get_size();
        let scale = this.thumbScale * this.uiScale *
                    Math.min(WINDOW_PREVIEW_WIDTH / width, WINDOW_PREVIEW_HEIGHT / height);
        return [ width * scale,
                 height * scale ];
    }

    _hide(actor, event) {
        super._hide.call(this, actor, event);
        this._applet.erodeTooltip();
    }

    show() {
        if (!this.actor || this._applet._menuOpen)
            return;

        if (this.thumbnail) {
            this.thumbnailBin.set_child(null);
            this.thumbnail.destroy();
            this.thumbnail = null;
        }

        let windowTexture = this.windowActor.get_texture();

        if (!windowTexture) {
            this.actor.hide();
            return;
        }

        let [width, height] = this._getScaledTextureSize(this.windowActor);

        this.thumbnail = WindowUtils.getCloneOrContent(this.windowActor, width, height);

        this._sizeChangedId = this.windowActor.connect('notify::size', () => {
            if (this.thumbnail === null) {
                return;
            }

            let [width, height] = this._getScaledTextureSize(this.windowActor);
            this.thumbnail.set_size(width, height);
            this._set_position();
        });

        this.thumbnailBin.set_child(this.thumbnail);

        this.actor.show();
        this._set_position();

        this.visible = true;
        this._applet.cancelErodeTooltip();
        this._applet._tooltipShowing = true;
    }

    hide() {
        if (this._sizeChangedId > 0) {
            this.windowActor.disconnect(this._sizeChangedId);
            this._sizeChangedId = 0;
        }
        if (this.thumbnail) {
            this.thumbnailBin.set_child(null);
            this.thumbnail.destroy();
            this.thumbnail = null;
        }
        if (this.actor) {
            this.actor.hide();
        }
        this.visible = false;
    }

    _set_position() {
        if (!this.actor || this.actor.is_finalized()) return;
        let allocation = this.actor.get_allocation_box();
        let previewHeight = allocation.y2 - allocation.y1;
        let previewWidth = allocation.x2 - allocation.x1;

        let monitor = Main.layoutManager.findMonitorForActor(this.item);

        let previewTop;
        if (this._applet.orientation === St.Side.BOTTOM) {
            previewTop = this.item.get_transformed_position()[1] - previewHeight - 5;
        } else if (this._applet.orientation === St.Side.TOP) {
            previewTop = this.item.get_transformed_position()[1] + this.item.get_transformed_size()[1] + 5;
        } else {
            previewTop = this.item.get_transformed_position()[1];
        }

        let previewLeft;
        if (this._applet.orientation === St.Side.BOTTOM || this._applet.orientation === St.Side.TOP) {
            // centre the applet on the window list item if window list is on the top or bottom panel
            previewLeft = this.item.get_transformed_position()[0] + this.item.get_transformed_size()[0]/2 - previewWidth/2;
        } else if (this._applet.orientation === St.Side.LEFT) {
            previewLeft = this.item.get_transformed_position()[0] + this.item.get_transformed_size()[0] + 5;
        } else {
            previewLeft = this.item.get_transformed_position()[0] - previewWidth - 5;
        }

        previewLeft = Math.round(previewLeft);
        previewLeft = Math.max(previewLeft, monitor.x);
        previewLeft = Math.min(previewLeft, monitor.x + monitor.width - previewWidth);

        previewTop  = Math.round(previewTop);
        previewTop  = Math.min(previewTop, monitor.y + monitor.height - previewHeight);

        this.actor.set_position(previewLeft, previewTop);
    }

    set_text(text) {
        this.label.set_text(text);
    }

    _destroy() {
        if (this._sizeChangedId > 0) {
            this._windowActor.disconnect(this._sizeChangedId);
            this.sizeChangedId = 0;
        }
        if (this.thumbnail) {
            this.thumbnailBin.set_child(null);
            this.thumbnail.destroy();
            this.thumbnail = null;
        }
        if (this.actor) {
            Main.uiGroup.remove_actor(this.actor);
            this.actor.destroy();
            this.actor = null;
        }
    }
}

class AppMenuButton {
    constructor(applet, metaWindow, transient) {
        this.actor = new Cinnamon.GenericContainer({
            name: 'appMenu',
            style_class: 'window-list-item-box',
            reactive: true,
            can_focus: true,
            track_hover: true });

        this._applet = applet;
        this.metaWindow = metaWindow;
        this.transient = transient;

        let initially_urgent = transient || metaWindow.demands_attention || metaWindow.urgent;
        this.drawLabel = false;
        this.labelVisiblePref = false;
        this._signals = new SignalManager.SignalManager();
        this.xid = metaWindow.get_xwindow();
        this._flashTimer = null;

        if (this._applet.orientation == St.Side.TOP)
            this.actor.add_style_class_name('top');
        else if (this._applet.orientation == St.Side.BOTTOM)
            this.actor.add_style_class_name('bottom');
        else if (this._applet.orientation == St.Side.LEFT)
            this.actor.add_style_class_name('left');
        else if (this._applet.orientation == St.Side.RIGHT)
            this.actor.add_style_class_name('right');

        this.actor._delegate = this;
        this._signals.connect(this.actor, 'button-release-event', Lang.bind(this, this._onButtonRelease));
        this._signals.connect(this.actor, 'button-press-event', Lang.bind(this, this._onButtonPress));

        this._signals.connect(this.actor, 'get-preferred-width',
                Lang.bind(this, this._getPreferredWidth));
        this._signals.connect(this.actor, 'get-preferred-height',
                Lang.bind(this, this._getPreferredHeight));

        this._signals.connect(this.actor, 'notify::allocation',
                              Lang.bind(this, this.updateIconGeometry));
        this._updateIconGeometryTimeoutId = 0;

        this._signals.connect(this.actor, 'allocate', Lang.bind(this, this._allocate));

        this.progressOverlay = new St.Widget({ style_class: "progress", reactive: false, important: true  });

        this.actor.add_actor(this.progressOverlay);

        this._iconBox = new Cinnamon.Slicer({ name: 'appMenuIcon' });
        this.actor.add_actor(this._iconBox);

        this._label = new St.Label();
        this.actor.add_actor(this._label);

        this.updateLabelVisible();

        this._visible = true;

        this._progress = 0;

        if (this.metaWindow.progress !== undefined) {
            this._progress = this.metaWindow.progress;
            if (this._progress > 0) {
                this.progressOverlay.show();
            } else
                this.progressOverlay.hide();
            this._updateProgressId = this._signals.connect(this.metaWindow, "notify::progress", () => {
                if (this.metaWindow.progress != this._progress) {
                    this._progress = this.metaWindow.progress;

                    if (this._progress >0) {
                        this.progressOverlay.show();
                    } else {
                        this.progressOverlay.hide();
                    }

                    this.actor.queue_relayout();
                }
            });
        } else {
            this.progressOverlay.hide();
        }

        /* TODO: this._progressPulse = this.metaWindow.progress_pulse; */

        this.onPreviewChanged();

        if (!this.transient) {
            this._menuManager = new PopupMenu.PopupMenuManager(this);
            this.rightClickMenu = new AppMenuButtonRightClickMenu(this, this.metaWindow, this._applet.orientation);
            this._menuManager.addMenu(this.rightClickMenu);

            this._draggable = DND.makeDraggable(this.actor, null, this._applet.actor);
            this._signals.connect(this._draggable, 'drag-begin', Lang.bind(this, this._onDragBegin));
            this._signals.connect(this._draggable, 'drag-cancelled', Lang.bind(this, this._onDragCancelled));
            this._signals.connect(this._draggable, 'drag-end', Lang.bind(this, this._onDragEnd));
        }

        this.onPanelEditModeChanged();
        this._signals.connect(global.settings, 'changed::panel-edit-mode', Lang.bind(this, this.onPanelEditModeChanged));

        this._windows = this._applet._windows;

        this.scrollConnector = null;
        this.onScrollModeChanged();
        this._needsAttention = false;

        this.setDisplayTitle();
        this.onFocus();
        this.setIcon();

        if (initially_urgent)
            this.getAttention();

        this._signals.connect(this.metaWindow, 'notify::title', this.setDisplayTitle, this);
        this._signals.connect(this.metaWindow, "notify::minimized", this.setDisplayTitle, this);
        this._signals.connect(this.metaWindow, "notify::tile-mode", this.setDisplayTitle, this);
        this._signals.connect(this.metaWindow, "notify::icon", this.setIcon, this);
        this._signals.connect(this.metaWindow, "notify::appears-focused", this.onFocus, this);
        this._signals.connect(this.metaWindow, "unmanaged", this.onUnmanaged, this);
    }

    onUnmanaged() {
        this.destroy();
        this._windows.splice(this._windows.indexOf(this), 1);
    }

    onPreviewChanged() {
        if (this._tooltip)
            this._tooltip.destroy();

        if (this._applet.windowHover == "thumbnail")
            this._tooltip = new WindowPreview(this, this.metaWindow, this._applet.previewScale, this._applet.showLabel);
        else
            this._tooltip = new Tooltips.PanelItemTooltip(this, "", this._applet.orientation);

        this.setDisplayTitle();
    }

    onPanelEditModeChanged() {
        let editMode = global.settings.get_boolean("panel-edit-mode");
        if (this._draggable)
            this._draggable.inhibit = editMode;
        this.actor.reactive = !editMode;
    }

    onScrollModeChanged() {
        if (this._applet.scrollable) {
            this.scrollConnector = this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
        } else {
            if (this.scrollConnector) {
                this.actor.disconnect(this.scrollConnector);
                this.scrollConnector = null;
            }
        }
    }

    _onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();

        if (direction === Clutter.ScrollDirection.SMOOTH) {
            return Clutter.EVENT_STOP;
        }

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
    }

    _onDragBegin() {
        if (this._applet.orientation == St.Side.TOP || this._applet.orientation == St.Side.BOTTOM) {
            this._draggable._overrideY = this.actor.get_transformed_position()[1];
            this._draggable._overrideX = null;
        } else {
            this._draggable._overrideX = this.actor.get_transformed_position()[0];
            this._draggable._overrideY = null;
        }

        this._tooltip.hide();
        this._tooltip.preventShow = true;
    }

    _onDragEnd() {
        this.actor.show();
        this._applet.clearDragPlaceholder();
        this._tooltip.preventShow = false;
    }

    _onDragCancelled() {
        this.actor.show();
        this._applet.clearDragPlaceholder();
        this._tooltip.preventShow = false;
    }

    getDragActor() {
        let clone    = new Clutter.Clone({ source: this.actor });
        clone.width  = this.actor.width;
        clone.height = this.actor.height;
        return clone;
    }

    getDragActorSource() {
        return this.actor;
    }

    handleDragOver(source, actor, x, y, time) {
        if (this._draggable && this._draggable.inhibit) {
            return DND.DragMotionResult.CONTINUE;
        }

        if (source instanceof AppMenuButton)
            return DND.DragMotionResult.CONTINUE;

        /* Users can drag things from one window to another window (eg drag an
         * image from Firefox to LibreOffice). However, if the target window is
         * hidden, they will drag to the AppWindowButton of the target window,
         * and we will open the window for them. */
        this._toggleWindow(true);
        return DND.DragMotionResult.NO_DROP;
    }

    acceptDrop(source, actor, x, y, time) {
        return false;
    }

    setDisplayTitle() {
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

        if (this._tooltip && this._applet.windowHover != "nothing" && this._tooltip.set_text)
            this._tooltip.set_text(title);

        this._label.set_text(title);
    }

    destroy() {
        if (this._flashTimer) {
            Mainloop.source_remove(this._flashTimer);
            this._flashTimer = null;
        }
        if (this._updateIconGeometryTimeoutId > 0) {
            Mainloop.source_remove(this._updateIconGeometryTimeoutId);
            this._updateIconGeometryTimeoutId = 0;
        }

        this._signals.disconnectAllSignals();
        this._tooltip.destroy();
        if (!this.transient) {
            this.rightClickMenu.destroy();
            this._menuManager.destroy();
        }
        this.actor.destroy();
    }

    _hasFocus() {
        if (!this.metaWindow || this.metaWindow.minimized)
            return false;

        if (this.metaWindow.has_focus())
            return true;

        if (global.display.focus_window && this.metaWindow.is_ancestor_of_transient(global.display.focus_window))
            return true;

        return false
    }

    onFocus() {
        if (this._hasFocus()) {
            this.actor.add_style_pseudo_class('focus');
            this.actor.remove_style_class_name("window-list-item-demands-attention");
            this.actor.remove_style_class_name("window-list-item-demands-attention-top");
            this._needsAttention = false;

            if (this.transient) {
                this.destroy();
                this._windows.splice(this._windows.indexOf(this), 1);
            }
        } else {
            this.actor.remove_style_pseudo_class('focus');
        }
    }

    _onButtonRelease(actor, event) {
        this._tooltip.hide();
        if (this.transient) {
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
    }

    _onButtonPress(actor, event) {
        this._tooltip.hide();
        if (!this.transient && event.get_button() == 3) {
            this.rightClickMenu.mouseEvent = event;
            this.rightClickMenu.toggle();

            if (this._hasFocus()) {
                this.actor.add_style_pseudo_class('focus');
            }
        }
    }

    _toggleWindow(fromDrag){
        if (!this._hasFocus()) {
            Main.activateWindow(this.metaWindow, global.get_current_time());
            this.actor.add_style_pseudo_class('focus');
        } else if (!fromDrag && this._applet.leftClickMinimize) {
            this.metaWindow.minimize();
            this.actor.remove_style_pseudo_class('focus');
        }
    }

    updateIconGeometry() {
        if (this._updateIconGeometryTimeoutId > 0) {
            Mainloop.source_remove(this._updateIconGeometryTimeoutId);
        }

        this._updateIconGeometryTimeoutId = Mainloop.timeout_add(50, Lang.bind(this, this._updateIconGeometryTimeout));
    }

    _updateIconGeometryTimeout() {
        this._updateIconGeometryTimeoutId = 0;

        let rect = new Meta.Rectangle();
        [rect.x, rect.y] = this.actor.get_transformed_position();
        [rect.width, rect.height] = this.actor.get_transformed_size();

        this.metaWindow.set_icon_geometry(rect);

        return GLib.SOURCE_REMOVE;
    }

    _getPreferredWidth(actor, forHeight, alloc) {
        let [minSize, naturalSize] = this._iconBox.get_preferred_width(forHeight);

        alloc.min_size = 1 * global.ui_scale;

        if (this._applet.orientation == St.Side.TOP || this._applet.orientation == St.Side.BOTTOM ) {
        // the 'buttons use entire space' option only makes sense on horizontal panels with labels
            if (this.labelVisiblePref) {
                if (this._applet.buttonsUseEntireSpace) {
                    let [lminSize, lnaturalSize] = this._label.get_preferred_width(forHeight);
                    let spacing = this.actor.get_theme_node().get_length('spacing');
                    alloc.natural_size = Math.max(this._applet.buttonWidth * global.ui_scale,
                            naturalSize + spacing + lnaturalSize);
                } else {
                    alloc.natural_size = this._applet.buttonWidth * global.ui_scale;
                }
            } else {
                alloc.natural_size = naturalSize
            }
        } else {
            alloc.natural_size = this._applet._panelHeight;
        }
    }

    _getPreferredHeight(actor, forWidth, alloc) {
        let [minSize1, naturalSize1] = this._iconBox.get_preferred_height(forWidth);

        if (this.labelVisiblePref) {
            let [minSize2, naturalSize2] = this._label.get_preferred_height(forWidth);
            alloc.min_size = Math.max(minSize1, minSize2);
        } else {
            alloc.min_size = minSize1;
        }

        if (this._applet.orientation == St.Side.TOP || this._applet.orientation == St.Side.BOTTOM ) {
            /* putting a container around the actor for layout management reasons affects the allocation,
               causing the visible border to pull in close around the contents which is not the desired
               (pre-existing) behaviour, so need to push the visible border back towards the panel edge.
               Assigning the natural size to the full panel height used to cause recursion errors but seems fine now.
               If this happens to avoid this you can subtract 1 or 2 pixels, but this will give an unreactive
               strip at the edge of the screen */
            alloc.natural_size = this._applet._panelHeight;
        } else {
            alloc.natural_size = naturalSize1;
        }
    }

    _allocate(actor, box, flags) {
        let allocWidth = box.x2 - box.x1;
        let allocHeight = box.y2 - box.y1;

        let childBox = new Clutter.ActorBox();

        let [minWidth, minHeight, naturalWidth, naturalHeight] = this._iconBox.get_preferred_size();

        let direction = this.actor.get_text_direction();
        let spacing = Math.floor(this.actor.get_theme_node().get_length('spacing'));
        let yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);

        childBox.y1 = box.y1 + yPadding;
        childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);

        if (allocWidth < naturalWidth) {
            this.labelVisible = false;
        } else {
            this.labelVisible = this.labelVisiblePref;
        }

        if (this.drawLabel) {
            if (direction === Clutter.TextDirection.LTR) {
                childBox.x1 = box.x1;
            } else {
                childBox.x1 = Math.max(box.x1, box.x2 - naturalWidth);
            }
            childBox.x2 = Math.min(childBox.x1 + naturalWidth, box.x2);
        } else {
            childBox.x1 = box.x1 + Math.floor(Math.max(0, allocWidth - naturalWidth) / 2);
            childBox.x2 = Math.min(childBox.x1 + naturalWidth, box.x2);
        }
        this._iconBox.allocate(childBox, flags);

        if (this.drawLabel) {
            [minWidth, minHeight, naturalWidth, naturalHeight] = this._label.get_preferred_size();

            yPadding = Math.floor(Math.max(0, allocHeight - naturalHeight) / 2);
            childBox.y1 = box.y1 + yPadding;
            childBox.y2 = childBox.y1 + Math.min(naturalHeight, allocHeight);
            if (direction === Clutter.TextDirection.LTR) {
                // Reuse the values from the previous allocation
                childBox.x1 = Math.min(childBox.x2 + spacing, box.x2);
                childBox.x2 = box.x2;
            } else {
                childBox.x2 = Math.max(childBox.x1 - spacing, box.x1);
                childBox.x1 = box.x1;
            }

            this._label.allocate(childBox, flags);
        }

        if (!this.progressOverlay.visible) {
            return;
        }

        childBox.x1 = 0;
        childBox.y1 = 0;
        childBox.x2 = this.actor.width;
        childBox.y2 = this.actor.height;

        this.progressOverlay.allocate(childBox, flags);

        let clip_width = Math.max((this.actor.width) * (this._progress / 100.0), 1.0);
        this.progressOverlay.set_clip(0, 0, clip_width, this.actor.height);
    }

    updateLabelVisible() {
        if (this._applet.showLabelPanel) {
            this._label.show();
            this.labelVisiblePref = true;
            this.drawLabel = true;
        } else {
            this._label.hide();
            this.labelVisiblePref = false;
            this.drawLabel = false;
        }
    }

    setIcon() {
        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(this.metaWindow);

        this.icon_size = this._applet.icon_size;

        let icon = app ?
            app.create_icon_texture_for_window(this.icon_size, this.metaWindow) :
            new St.Icon({ icon_name: 'application-default-icon',
                icon_type: St.IconType.FULLCOLOR,
                icon_size: this.icon_size });

        let old_child = this._iconBox.get_child();
        this._iconBox.set_child(icon);

        if (old_child)
            old_child.destroy();
    }

    getAttention() {
        if (this._needsAttention)
            return false;

        this._needsAttention = true;
        this._flashButton();
        return true;
    }

    _flashButton() {
        if (!this._needsAttention || this._flashTimer)
            return;

        let counter = 0;
        const sc = "window-list-item-demands-attention";

        this._flashTimer = Mainloop.timeout_add(FLASH_INTERVAL, () => {
            if (!this._needsAttention) {
                this._flashTimer = null;
                return false;
            }

            if (this.actor.has_style_class_name(sc))
                this.actor.remove_style_class_name(sc);
            else
                this.actor.add_style_class_name(sc);

            const continueFlashing = (counter++ < FLASH_MAX_COUNT);
            if (!continueFlashing) {
                this._flashTimer = null;
            }
            return continueFlashing;
        });
    }
};

class AppMenuButtonRightClickMenu extends Applet.AppletPopupMenu {
    constructor(launcher, metaWindow, orientation) {
        super(launcher, orientation);

        this._launcher = launcher;
        this._windows = launcher._applet._windows;
        this._signals.connect(this, 'open-state-changed', Lang.bind(this, this._onToggled));

        this.orientation = orientation;
        this.metaWindow = metaWindow;
    }

    _populateMenu() {
        let mw = this.metaWindow;
        let item;
        let length;

        // Move to monitor
        if ((length = Main.layoutManager.monitors.length) == 2) {
            Main.layoutManager.monitors.forEach(function (monitor, index) {
                if (index === mw.get_monitor()) return;
                item = new PopupMenu.PopupMenuItem(_("Move to the other monitor"));
                this._signals.connect(item, 'activate', function() {
                    mw.move_to_monitor(index);
                });
                this.addMenuItem(item);
            }, this);
        }
        else if ((length = Main.layoutManager.monitors.length) > 2) {
            Main.layoutManager.monitors.forEach(function (monitor, index) {
                if (index === mw.get_monitor()) return;
                item = new PopupMenu.PopupMenuItem(_("Move to monitor %d").format(index + 1));
                this._signals.connect(item, 'activate', function() {
                    mw.move_to_monitor(index);
                });
                this.addMenuItem(item);
            }, this);
        }

        // Move to workspace
        if ((length = global.workspace_manager.n_workspaces) > 1) {
            if (mw.is_on_all_workspaces()) {
                item = new PopupMenu.PopupMenuItem(_("Only on this workspace"));
                this._signals.connect(item, 'activate', function() {
                    mw.unstick();
                });
                this.addMenuItem(item);
            } else {
                item = new PopupMenu.PopupMenuItem(_("Visible on all workspaces"));
                this._signals.connect(item, 'activate', function() {
                    mw.stick();
                });
                this.addMenuItem(item);

                item = new PopupMenu.PopupSubMenuMenuItem(_("Move to another workspace"));
                this.addMenuItem(item);

                let curr_index = mw.get_workspace().index();
                for (let i = 0; i < length; i++) {
                    // Make the index a local variable to pass to function
                    let j = i;
                    let name = Main.workspace_names[i] ? Main.workspace_names[i] : Main._makeDefaultWorkspaceName(i);
                    let ws = new PopupMenu.PopupMenuItem(name);

                    if (i == curr_index)
                        ws.setSensitive(false);

                    this._signals.connect(ws, 'activate', function() {
                        mw.change_workspace(global.workspace_manager.get_workspace_by_index(j));
                    });
                    item.menu.addMenuItem(ws);
                }

            }
        }

        // Preferences
        let subMenu = new PopupMenu.PopupSubMenuMenuItem(_("Applet preferences"));
        this.addMenuItem(subMenu);

        item = new PopupMenu.PopupIconMenuItem(_("About..."), "dialog-question", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this._launcher._applet, this._launcher._applet.openAbout));
        subMenu.menu.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Configure..."), "system-run", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this._launcher._applet, this._launcher._applet.configureApplet));
        subMenu.menu.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Remove 'Window list'"), "edit-delete", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', (actor, event) => this._launcher._applet.confirmRemoveApplet(event));
        subMenu.menu.addMenuItem(item);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Close all/others
        item = new PopupMenu.PopupIconMenuItem(_("Close all"), "application-exit", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this, function() {
            for (let window of this._windows)
                if (window.actor.visible &&
                   !window._needsAttention)
                    window.metaWindow.delete(global.get_current_time());
        }));
        this.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Close others"), "window-close", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', Lang.bind(this, function() {
            for (let window of this._windows)
                if (window.actor.visible &&
                    window.metaWindow != this.metaWindow &&
                   !window._needsAttention)
                    window.metaWindow.delete(global.get_current_time());
        }));
        this.addMenuItem(item);

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Miscellaneous
        if (mw.get_compositor_private().opacity != 255) {
            item = new PopupMenu.PopupMenuItem(_("Restore to full opacity"));
            this._signals.connect(item, 'activate', function() {
                mw.get_compositor_private().set_opacity(255);
            });
            this.addMenuItem(item);
        }

        if (mw.minimized) {
            item = new PopupMenu.PopupIconMenuItem(_("Restore"), "view-sort-descending", St.IconType.SYMBOLIC);
            this._signals.connect(item, 'activate', function() {
                Main.activateWindow(mw, global.get_current_time());
            });
        } else {
            item = new PopupMenu.PopupIconMenuItem(_("Minimize"), "view-sort-ascending", St.IconType.SYMBOLIC);
            this._signals.connect(item, 'activate', function() {
                mw.minimize();
            });
        }
        this.addMenuItem(item);

        if (mw.get_maximized()) {
            item = new PopupMenu.PopupIconMenuItem(_("Unmaximize"), "view-restore", St.IconType.SYMBOLIC);
            this._signals.connect(item, 'activate', function() {
                mw.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
            });
        } else {
            item = new PopupMenu.PopupIconMenuItem(_("Maximize"), "view-fullscreen", St.IconType.SYMBOLIC);
            this._signals.connect(item, 'activate', function() {
                mw.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
            });
        }
        this.addMenuItem(item);
        item.setSensitive(mw.can_maximize())

        item = new PopupMenu.PopupIconMenuItem(_("Close"), "edit-delete", St.IconType.SYMBOLIC);
        this._signals.connect(item, 'activate', function() {
            mw.delete(global.get_current_time());
        });
        this.addMenuItem(item);
    }

    _onToggled(actor, isOpening){
        if (this.isOpen)
            this._launcher._applet._menuOpen = true;
        else
            this._launcher._applet._menuOpen = false;
    }

    toggle() {
        if (!this.isOpen) {
            this.removeAll();
            this._populateMenu();
        }

        Applet.AppletPopupMenu.prototype.toggle.call(this);
    }
}

class CinnamonWindowListApplet extends Applet.Applet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.signals = new SignalManager.SignalManager(null);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.actor.set_track_hover(false);
        this.actor.set_style_class_name("window-list-box");
        this.orientation = orientation;
        this.icon_size = this.getPanelIconSize(St.IconType.FULLCOLOR);
        this.appletEnabled = false;
        //
        // A layout manager is used to cater for vertical panels as well as horizontal
        //
        let manager;
        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            manager = new Clutter.BoxLayout( { orientation: Clutter.Orientation.HORIZONTAL });
        } else {
            manager = new Clutter.BoxLayout( { orientation: Clutter.Orientation.VERTICAL });
            this.actor.add_style_class_name("vertical");
        }

        this.manager = manager;
        this.manager_container = new Clutter.Actor( { layout_manager: manager } );
        this.actor.add_actor (this.manager_container);

        this.dragInProgress = false;
        this._tooltipShowing = false;
        this._tooltipErodeTimer = null;
        this._menuOpen = false;
        this._urgentSignal = null;
        this._windows = [];
        this._monitorWatchList = [];

        this.settings = new Settings.AppletSettings(this, "window-list@cinnamon.org", this.instance_id);

        this.settings.bind("show-all-workspaces", "showAllWorkspaces");
        this.settings.bind("enable-alerts", "enableAlerts", this._updateAttentionGrabber);
        this.settings.bind("enable-scrolling", "scrollable", this._onEnableScrollChanged);
        this.settings.bind("reverse-scrolling", "reverseScroll");
        this.settings.bind("left-click-minimize", "leftClickMinimize");
        this.settings.bind("middle-click-close", "middleClickClose");
        this.settings.bind("button-width", "buttonWidth", this._refreshAllItems);
        this.settings.bind("buttons-use-entire-space", "buttonsUseEntireSpace", this._refreshAllItems);
        this.settings.bind("panel-show-label", "showLabelPanel", this._updateLabels);
        this.settings.bind("window-hover", "windowHover", this._onPreviewChanged);
        this.settings.bind("window-preview-show-label", "showLabel", this._onPreviewChanged);
        this.settings.bind("window-preview-scale", "previewScale", this._onPreviewChanged);
        this.settings.bind("last-window-order", "lastWindowOrder", null);

        this.signals.connect(global.display, 'window-created', this._onWindowAddedAsync, this);
        this.signals.connect(global.display, 'window-monitor-changed', this._onWindowMonitorChanged, this);
        this.signals.connect(global.display, 'window-workspace-changed', this._onWindowWorkspaceChanged, this);
        this.signals.connect(global.display, 'window-skip-taskbar-changed', this._onWindowSkipTaskbarChanged, this);
        this.signals.connect(Main.panelManager, 'monitors-changed', this._updateWatchedMonitors, this);
        this.signals.connect(global.window_manager, 'switch-workspace', this._refreshAllItems, this);
        this.signals.connect(Cinnamon.WindowTracker.get_default(), "window-app-changed", this._onWindowAppChanged, this);

        this.signals.connect(this.actor, 'style-changed', Lang.bind(this, this._updateSpacing));

        global.settings.bind("panel-edit-mode", this.actor, "reactive", Gio.SettingsBindFlags.DEFAULT);

        this.on_orientation_changed(orientation);
        this._updateAttentionGrabber();
    }

    on_applet_added_to_panel(userEnabled) {
        this._updateSpacing();
        this.appletEnabled = true;
    }

    on_applet_removed_from_panel() {
        this.signals.disconnectAllSignals();
        this.settings.finalize();
    }

    on_applet_instances_changed() {
        this._updateWatchedMonitors();
    }

    on_panel_height_changed() {
        this.icon_size = this.getPanelIconSize(St.IconType.FULLCOLOR);
        this._refreshAllItems();
    }

    on_panel_icon_size_changed(size) {
        this.icon_size = size;
        this._refreshAllItems();
    }

    on_orientation_changed(orientation) {
        this.orientation = orientation;

        for (let window of this._windows)
            window.updateLabelVisible();

        if (orientation == St.Side.TOP || orientation == St.Side.BOTTOM) {
            this.manager.set_vertical(false);
            this._reTitleItems();
            this.actor.remove_style_class_name("vertical");
        } else {
            this.manager.set_vertical(true);
            this.actor.add_style_class_name("vertical");
            this.actor.set_x_align(Clutter.ActorAlign.CENTER);
            this.actor.set_important(true);
        }

        // Any padding/margin is removed on one side so that the AppMenuButton
        // boxes butt up against the edge of the screen

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

        if (this.appletEnabled) {
            this._updateSpacing();
        }

        this._updateAllIconGeometry()
    }

    _updateSpacing() {
        let themeNode = this.actor.get_theme_node();
        let spacing = themeNode.get_length('spacing');
        this.manager.set_spacing(spacing * global.ui_scale);
    }

    _onWindowAddedAsync(display, metaWindow, monitor) {
        Mainloop.timeout_add(20, Lang.bind(this, this._onWindowAdded, display, metaWindow, monitor));
    }

    _onWindowAdded(display, metaWindow, monitor) {
        if (this._shouldAdd(metaWindow))
            this._addWindow(metaWindow, false);
    }

    _onWindowMonitorChanged(display, metaWindow, monitor) {
        if (this._shouldAdd(metaWindow))
            this._addWindow(metaWindow, false);
        else {
            this.refreshing = true;
            this._removeWindow(metaWindow);
            this.refreshing = false;
        }
    }

    _refreshItemByMetaWindow(metaWindow) {
        let window = this._windows.find(win => (win.metaWindow == metaWindow));

        if (window)
            this._refreshItem(window);
    }

    _onWindowWorkspaceChanged(display, metaWindow, metaWorkspace) {
        this._refreshItemByMetaWindow(metaWindow);
    }

    _onWindowAppChanged(tracker, metaWindow) {
        this._refreshItemByMetaWindow(metaWindow);
    }

    _onWindowSkipTaskbarChanged(display, metaWindow) {
        if (metaWindow && metaWindow.is_skip_taskbar()) {
            this._removeWindow(metaWindow);
            return;
        }

        this._onWindowAdded(display, metaWindow, 0);
    }

    _updateAttentionGrabber() {
        if (this.enableAlerts) {
            this.signals.connect(global.display, "window-marked-urgent", this._onWindowDemandsAttention, this);
            this.signals.connect(global.display, "window-demands-attention", this._onWindowDemandsAttention, this);
        } else {
            this.signals.disconnect("window-marked-urgent");
            this.signals.disconnect("window-demands-attention");
        }
    }

    _onEnableScrollChanged() {
        for (let window of this._windows)
            window.onScrollModeChanged();
    }

    _onPreviewChanged() {
        for (let window of this._windows)
            window.onPreviewChanged();
    }

    _onWindowDemandsAttention (display, window) {
        // Magic to look for AppMenuButton owning window
        let i = this._windows.length;
        while (i-- && this._windows[i].metaWindow != window);

        // Window is not in our list
        if (i == -1)
            return;

        // Window already has focus
        if (this._windows[i]._hasFocus())
            return;

        // Asks AppMenuButton to flash. Returns false if already flashing
        if (!this._windows[i].getAttention())
            return;

        if (window.get_workspace() != global.workspace_manager.get_active_workspace())
            this._addWindow(window, true);
    }

    _refreshItem(window) {
        window.actor.visible =
            (window.metaWindow.get_workspace() == global.workspace_manager.get_active_workspace()) ||
            window.metaWindow.is_on_all_workspaces() ||
            this.showAllWorkspaces;

        /* The above calculates the visibility if it were the normal
         * AppMenuButton. If this is actually a temporary AppMenuButton for
         * urgent windows on other workspaces, it is shown iff the normal
         * one isn't shown! */
        if (window.transient)
            window.actor.visible = !window.actor.visible;

        if (window.actor.visible)
            window.setIcon();

        window.updateIconGeometry();
    }

    _refreshAllItems() {
        for (let window of this._windows) {
            this._refreshItem(window);
        }
    }

    _reTitleItems() {
        for (let window of this._windows) {
            window.setDisplayTitle();
        }
    }
    
    _updateLabels() {
        for (let window of this._windows)
            window.updateLabelVisible();
    }

    _updateWatchedMonitors() {
        // this can be called after our settings are finalized (and those attributes deleted),
        // so lastWindowOrder won't exist anymore. This can happen when panels are removed, for
        // example due to monitor changes.
        if (this.lastWindowOrder === undefined) {
            return;
        }

        let n_mons = global.display.get_n_monitors();
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
        if (this.showAllWorkspaces) {
            for (let wks=0; wks<global.workspace_manager.n_workspaces; wks++) {
                let metaWorkspace = global.workspace_manager.get_workspace_by_index(wks);
                let wks_windows = metaWorkspace.list_windows();
                for (let wks_window of wks_windows) {
                    windows.push(wks_window);
                }
            }
        }

        this.refreshing = true;

        for (let window of windows) {
            if (this._shouldAdd(window))
                this._addWindow(window, false);
            else
                this._removeWindow(window);
        }

        this.refreshing = false;

        this._applySavedOrder();
        this._updateAllIconGeometry();
    }

    _addWindow(metaWindow, transient) {
        for (let window of this._windows)
            if (window.metaWindow == metaWindow &&
                window.transient == transient)
                return;

        let appButton = new AppMenuButton(this, metaWindow, transient);
        this.manager_container.add_actor(appButton.actor);

        this._windows.push(appButton);

        /* We want to make the AppMenuButtons look like they are ordered by
         * workspace. So if we add an AppMenuButton for a window in another
         * workspace, put it in the right position. It is at the end by
         * default, so move it to the start if needed */
        if (transient) {
            if (metaWindow.get_workspace().index() < global.workspace_manager.get_active_workspace_index())
                this.manager_container.set_child_at_index(appButton.actor, 0);
        } else {
            if (metaWindow.get_workspace() != global.workspace_manager.get_active_workspace()) {
                if (!(this.showAllWorkspaces)) {
                    appButton.actor.hide();
                }
            }
        }

        this._saveOrder();
        this._updateAllIconGeometry();
    }

    _removeWindow(metaWindow) {
        let i = this._windows.length;
        // Do an inverse loop because we might remove some elements
        while (i--) {
            if (this._windows[i].metaWindow == metaWindow) {
                this._windows[i].destroy();
                this._windows.splice(i, 1);
            }
        }

        this._saveOrder();
        this._updateAllIconGeometry();
    }

    _shouldAdd(metaWindow) {
        return Main.isInteresting(metaWindow) &&
            !metaWindow.is_skip_taskbar() &&
            this._monitorWatchList.indexOf(metaWindow.get_monitor()) != -1;
    }

    /* Store by Windows (XIDs), a simple list
       xid::xid::xid::xid::xid
    */

    _applySavedOrder() {
        let order = this.lastWindowOrder.split("::");

        order.reverse();

        for (let i = 0; i < order.length; i++) {
            let xid = parseInt(order[i]);

            if (xid === NaN) {
                continue;
            }

            let found = this._windows.find(win => (win.xid == xid));

            if (found) {
                this.manager_container.set_child_at_index(found.actor, 0);
            }
        }

        this._saveOrder();
    }

    _saveOrder() {
        if (this.refreshing) {
            return;
        }

        let new_order = [];
        let actors = this.manager_container.get_children();

        for (let i = 0; i < actors.length; i++) {
            new_order.push(actors[i]._delegate.xid);
        }

        if (new_order.length === 0) {
            this.lastWindowOrder = "";
            return;
        }

        this.lastWindowOrder = new_order.join("::");
    }

    _updateAllIconGeometry() {
        for (let window of this._windows) {
            window.updateIconGeometry();
        }
    }

    handleDragOver(source, actor, x, y, time) {
        if (this._inEditMode)
            return DND.DragMotionResult.MOVE_DROP;
        if (!(source instanceof AppMenuButton))
            return DND.DragMotionResult.NO_DROP;

        let children = this.manager_container.get_children();
        let isVertical = (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT);
        let axis = isVertical ? [y, 'y1'] : [x, 'x1'];

        this._dragPlaceholderPos = -1;
        let minDist = -1;
        for(let i = 0; i < children.length; i++) {
            if (!children[i].visible)
                continue;
            let dim = isVertical ? children[i].height : children[i].width;
            let dist = Math.abs(axis[0] - (children[i].get_allocation_box()[axis[1]] + dim / 2));
            if(dist < minDist || minDist == -1) {
                minDist = dist;
                this._dragPlaceholderPos = i;
            }
        }

        source.actor.hide();
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
    }

    acceptDrop(source, actor, x, y, time) {
        if (!(source instanceof AppMenuButton)) return false;
        if (this._dragPlaceholderPos == undefined) return false;

        this.manager_container.set_child_at_index(source.actor, this._dragPlaceholderPos);

        this._saveOrder();
        this._updateAllIconGeometry();

        return true;
    }

    clearDragPlaceholder() {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.actor.destroy();
            this._dragPlaceholder = undefined;
            this._dragPlaceholderPos = undefined;
        }
    }

    erodeTooltip() {
        if (this._tooltipErodeTimer) {
            Mainloop.source_remove(this._tooltipErodeTimer);
            this._tooltipErodeTimer = null;
        }

        this._tooltipErodeTimer = Mainloop.timeout_add(300, Lang.bind(this, function() {
            this._tooltipShowing = false;
            this._tooltipErodeTimer = null;
            return false;
        }));
    }

    cancelErodeTooltip() {
        if (this._tooltipErodeTimer) {
            Mainloop.source_remove(this._tooltipErodeTimer);
            this._tooltipErodeTimer = null;
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonWindowListApplet(orientation, panel_height, instance_id);
}
