// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Pango = imports.gi.Pango;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Signals = imports.signals;

const DND = imports.ui.dnd;
const Lightbox = imports.ui.lightbox;
const Main = imports.ui.main;
const Overview = imports.ui.overview;
const PopupMenu = imports.ui.popupMenu;
const Tweener = imports.ui.tweener;
const PointerTracker = imports.misc.pointerTracker;
const GridNavigator = imports.misc.gridNavigator;
const WindowUtils = imports.misc.windowUtils;

const FOCUS_ANIMATION_TIME = 0.15;

const WINDOW_DND_SIZE = 256;

const SCROLL_SCALE_AMOUNT = 50;

const LIGHTBOX_FADE_TIME = 0.1;
const CLOSE_BUTTON_FADE_TIME = 0.1;

const BUTTON_LAYOUT_SCHEMA = 'org.cinnamon.muffin';
const BUTTON_LAYOUT_KEY = 'button-layout';

const DEMANDS_ATTENTION_CLASS_NAME = "window-list-item-demands-attention";

// Define a layout scheme for small window counts. For larger
// counts we fall back to an algorithm. We need more schemes here
// unless we have a really good algorithm.

// Each triplet is [xCenter, yCenter, scale] where the scale
// is relative to the width of the workspace.
const POSITIONS = {
        1: [[0.5, 0.525, 0.875]],
        2: [[0.25, 0.525, 0.48], [0.75, 0.525, 0.48]],
        3: [[0.25, 0.275, 0.48],  [0.75, 0.275, 0.48],  [0.5, 0.75, 0.48]],
        4: [[0.25, 0.275, 0.47],   [0.75, 0.275, 0.47], [0.25, 0.75, 0.47], [0.75, 0.75, 0.47]],
        5: [[0.165, 0.25, 0.32], [0.495, 0.25, 0.32], [0.825, 0.25, 0.32], [0.25, 0.75, 0.32], [0.75, 0.75, 0.32]],
        6: [[0.165, 0.25, 0.32], [0.495, 0.25, 0.32], [0.825, 0.25, 0.32], [0.165, 0.75, 0.32], [0.495, 0.75, 0.32], [0.825, 0.75, 0.32]]
};

const DEFAULT_SLOT_FRACTION = 0.825;
const WINDOWOVERLAY_ICON_SIZE = 32;

function _interpolate(start, end, step) {
    return start + (end - start) * step;
}

function _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


function ScaledPoint(x, y, scaleX, scaleY) {
    [this.x, this.y, this.scaleX, this.scaleY] = arguments;
}

ScaledPoint.prototype = {
    getPosition : function() {
        return [this.x, this.y];
    },

    getScale : function() {
        return [this.scaleX, this.scaleY];
    },

    setPosition : function(x, y) {
        [this.x, this.y] = arguments;
    },

    setScale : function(scaleX, scaleY) {
        [this.scaleX, this.scaleY] = arguments;
    },

    interpPosition : function(other, step) {
        return [_interpolate(this.x, other.x, step),
                _interpolate(this.y, other.y, step)];
    },

    interpScale : function(other, step) {
        return [_interpolate(this.scaleX, other.scaleX, step),
                _interpolate(this.scaleY, other.scaleY, step)];
    }
};

var menuShowing = null;
var menuClone = null;
function closeContextMenu(requestor) {
    let requestorShowingMenu = menuClone && menuClone === requestor;
    if (menuShowing) {
        menuShowing.close();
    }
    return requestorShowingMenu;
}

function WindowClone() {
    this._init.apply(this, arguments);
}

WindowClone.prototype = {
    _init : function(realWindow, myContainer) {
        this.myContainer = myContainer;
        this.realWindow = realWindow;
        this.metaWindow = realWindow.meta_window;
        this.metaWindow._delegate = this;
        this.overlay = null;

        this.origX = realWindow.x;
        this.origY = realWindow.y;

        let outerRect = realWindow.meta_window.get_outer_rect();

        // The MetaShapedTexture that we clone has a size that includes
        // the invisible border; this is inconvenient; rather than trying
        // to compensate all over the place we insert a ClutterGroup into
        // the hierarchy that is sized to only the visible portion.
        this.actor = new Clutter.Group({ reactive: true,
            x: this.origX, y: this.origY,
            width: outerRect.width, height: outerRect.height
            });
        this.refreshClone(true);
        // We expect this.actor to be used for all interaction rather than
        // this.clone; as the former is reactive and the latter
        // is not, this just works for most cases. However, for DND all
        // actors are picked, so DND operations would operate on the clone.
        // To avoid this, we hide it from pick.
        Cinnamon.util_set_hidden_from_pick(this.clone, true);

        this.actor._delegate = this;

        this._stackAbove = null;

        let sizeChangedId = this.realWindow.connect('size-changed',
            Lang.bind(this, this._onRealWindowSizeChanged));
        let workspaceChangedId = this.metaWindow.connect('workspace-changed', Lang.bind(this, function(w, oldws) {
            this.emit('workspace-changed', oldws);
        }));
        let realWindowDestroyId = 0;
        this._disconnectWindowSignals = function() {
            this._disconnectWindowSignals = function() {};            
            this.metaWindow.disconnect(workspaceChangedId);
            this.realWindow.disconnect(sizeChangedId);
            this.realWindow.disconnect(realWindowDestroyId);
        };
        realWindowDestroyId = this.realWindow.connect('destroy',
            Lang.bind(this, this._disconnectWindowSignals));


        this.myContainer.connect('selection-changed', Lang.bind(this, this._zoomEnd));

        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));

        this.actor.connect('scroll-event',
                           Lang.bind(this, this._onScroll));

        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
        this.actor.connect('leave-event',
                           Lang.bind(this, this._onPointerLeave));

        this._windowIsZooming = false;
        this._zooming = false;
        this._selected = false;
    },

    refreshClone: function(withTransients) {
        if (this.clone) {this.clone.destroy();}
        this.clone = new St.Widget({ reactive: false });
        this.actor.add_actor(this.clone);
        let [pwidth, pheight] = [this.realWindow.width, this.realWindow.height];
        let clones = WindowUtils.createWindowClone(this.metaWindow, 0, 0, withTransients);
        for (let i in clones) {
            let clone = clones[i].actor;
            this.clone.add_actor(clone);
            let [width, height] = clone.get_size();
            clone.set_position(Math.round((pwidth - width) / 2), Math.round((pheight - height) / 2));
        }
    },

    setStackAbove: function (actor) {
        this._stackAbove = actor;
        if (this._zooming)
            // We'll fix up the stack after the zooming
            return;
        if (this._stackAbove == null)
            this.actor.lower_bottom();
        else
            this.actor.raise(this._stackAbove);
    },

    destroy: function () {
        this.actor.destroy();
    },

    zoomFromOverview: function() {
        if (this._zooming) {
            // If the user clicked on the zoomed window, or we are
            // returning there anyways, then we can zoom right to the
            // window, but if we are going to some other window, then
            // we need to cancel the zoom before animating, or it
            // will look funny.

            if (!this._selected &&
                this.metaWindow != global.display.focus_window)
                this._zoomEnd();
        }
    },

    _getInvisibleBorderPadding: function() {
        // We need to adjust the position of the actor because of the
        // consequences of invisible borders -- in reality, the texture
        // has an extra set of "padding" around it that we need to trim
        // down.

        // The outer rect paradoxically is the smaller rectangle,
        // containing the positions of the visible frame. The input
        // rect contains everything, including the invisible border
        // padding.
        let outerRect = this.metaWindow.get_outer_rect();
        let inputRect = this.metaWindow.get_input_rect();
        let [borderX, borderY] = [outerRect.x - inputRect.x,
                                  outerRect.y - inputRect.y];

        return [borderX, borderY];
    },

    _onRealWindowSizeChanged: function() {
        let [borderX, borderY] = this._getInvisibleBorderPadding();
        let outerRect = this.metaWindow.get_outer_rect();
        this.actor.set_size(outerRect.width, outerRect.height);
        this.clone.set_position(-borderX, -borderY);
        this.emit('size-changed');
    },

    _onDestroy: function() {
        this._disconnectWindowSignals();

        this.metaWindow._delegate = null;
        this.actor._delegate = null;
        if (this._zoomLightbox)
            this._zoomLightbox.destroy();

        this.disconnectAll();
    },

    _onPointerLeave: function (actor, event) {
        if (this._zoomStep)
            this._zoomEnd();
    },

    scrollZoom: function (direction) {
        if (direction === Clutter.ScrollDirection.UP) {
            if (this._zoomStep == undefined)
                this._zoomStart();
            if (this._zoomStep < 100) {
                this._zoomStep += SCROLL_SCALE_AMOUNT;
                this._zoomUpdate();
            }
        } else if (direction === Clutter.ScrollDirection.DOWN) {
            if (this._zoomStep > 0) {
                this._zoomStep -= SCROLL_SCALE_AMOUNT;
                this._zoomStep = Math.max(0, this._zoomStep);
                this._zoomUpdate();
            }
            if (this._zoomStep <= 0.0) {
                this._zoomEnd();
            }
        } else if (direction < 0) {
            this._zoomEnd();
        }
    },

    _onScroll : function (actor, event) {
        let direction = event.get_scroll_direction();
        this.scrollZoom(direction);
    },

    _zoomUpdate : function () {
        [this.actor.x, this.actor.y] = this._zoomGlobalOrig.interpPosition(this._zoomTarget, this._zoomStep / 100);
        [this.actor.scale_x, this.actor.scale_y] = this._zoomGlobalOrig.interpScale(this._zoomTarget, this._zoomStep / 100);

        let [width, height] = this.actor.get_transformed_size();

        let monitorIndex = this.metaWindow.get_monitor();
        let monitor = Main.layoutManager.monitors[monitorIndex];
        let availArea = new Meta.Rectangle({ x: monitor.x,
                                             y: monitor.y,
                                             width: monitor.width,
                                             height: monitor.height });

        this.actor.x = _clamp(this.actor.x, availArea.x, availArea.x + availArea.width - width);
        this.actor.y = _clamp(this.actor.y, availArea.y, availArea.y + availArea.height - height);
    },

    _zoomStart : function () {
        if (!this._zooming) {
            this.emit('zoom-start');
        }
        this._zooming = true;

        if (!this._zoomLightbox)
            this._zoomLightbox = new Lightbox.Lightbox(Main.uiGroup,
                                                       { fadeTime: LIGHTBOX_FADE_TIME });
        this._zoomLightbox.show();

        this._zoomLocalOrig  = new ScaledPoint(this.actor.x, this.actor.y, this.actor.scale_x, this.actor.scale_y);
        this._zoomGlobalOrig = new ScaledPoint();
        let parent = this._origParent = this.actor.get_parent();
        let [width, height] = this.actor.get_transformed_size();
        this._zoomGlobalOrig.setPosition.apply(this._zoomGlobalOrig, this.actor.get_transformed_position());
        this._zoomGlobalOrig.setScale(width / this.actor.width, height / this.actor.height);

        global.reparentActor(this.actor, Main.uiGroup);
        this._zoomLightbox.highlight(this.actor);

        [this.actor.x, this.actor.y]             = this._zoomGlobalOrig.getPosition();
        [this.actor.scale_x, this.actor.scale_y] = this._zoomGlobalOrig.getScale();

        this.actor.raise_top();

        this._zoomTarget = new ScaledPoint(0, 0, 1.0, 1.0);
        this._zoomTarget.setPosition(this.actor.x - (this.actor.width - width) / 2, this.actor.y - (this.actor.height - height) / 2);
        this._zoomStep = 0;

        this._zoomUpdate();
    },

    _zoomEnd : function () {
        if (!this._zooming) {return;}
        this._zooming = false;
        this.emit('zoom-end');

        global.reparentActor(this.actor, this._origParent);
        if (this._stackAbove == null)
            this.actor.lower_bottom();
        // If the workspace has been destroyed while we were reparented to
        // the stage, _stackAbove will be unparented and we can't raise our
        // actor above it - as we are bound to be destroyed anyway in that
        // case, we can skip that step
        else if (this._stackAbove.get_parent())
            this.actor.raise(this._stackAbove);

        [this.actor.x, this.actor.y]             = this._zoomLocalOrig.getPosition();
        [this.actor.scale_x, this.actor.scale_y] = this._zoomLocalOrig.getScale();

        this._zoomLightbox.hide();

        this._zoomLocalPosition  = undefined;
        this._zoomLocalScale     = undefined;
        this._zoomGlobalPosition = undefined;
        this._zoomGlobalScale    = undefined;
        this._zoomTargetPosition = undefined;
        this._zoomStep           = undefined;
    },

    _onButtonPress: function(actor, event) {
        this.emit('selected', global.get_current_time());
        // a button-press on a clone already showing a menu should
        // not open a new-menu, only close the current menu.
        this.menuCancelled = closeContextMenu(this);
    },

    _onButtonRelease: function(actor, event) {
        if ( event.get_button()==1 ) {
            this._selected = true;
            this.emit('activated', global.get_current_time());
            return true;
        }
        if (event.get_button()==2){
            this.emit('closed', global.get_current_time());
            return true;
        }
        if (event.get_button()==3){
            if (!this.menuCancelled) {
                this.emit('context-menu-requested');
            }
            this.menuCancelled = false;
            return true;
        }
        return false;
    }
};
Signals.addSignalMethods(WindowClone.prototype);


/**
 * @windowClone: Corresponding window clone
 * @parentActor: The actor which will be the parent of all overlay items
 *               such as app icon and window caption
 */
function WindowOverlay(windowClone, parentActor) {
    this._init(windowClone, parentActor);
}

WindowOverlay.prototype = {
    _init : function(windowClone, parentActor) {
        let metaWindow = windowClone.metaWindow;

        this._windowClone = windowClone;
        this._parentActor = parentActor;
        this._hidden = false;
        this._hovering = false;
        this._isSelected = null;

        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(metaWindow);
        let icon = null;
        if (app) {
            icon = app.create_icon_texture(WINDOWOVERLAY_ICON_SIZE);
        }
        if (!icon) {
            icon = new St.Icon({ icon_name: 'application-default-icon',
                                 icon_type: St.IconType.FULLCOLOR,
                                 icon_size: WINDOWOVERLAY_ICON_SIZE });
        }
        this.icon = icon;
        icon.width = WINDOWOVERLAY_ICON_SIZE;
        icon.height = WINDOWOVERLAY_ICON_SIZE;
        
        this._applicationIconBox = new St.Bin({ style_class: 'window-iconbox' });
        this._applicationIconBox.set_opacity(255);
        this._applicationIconBox.add_actor(icon);
        parentActor.add_actor(this._applicationIconBox);

        let button = new St.Button({ style_class: 'window-close' });
        this.closeButton = button;
        button._overlap = 0;
        button.hide();
        parentActor.add_actor(button);
        button.connect('style-changed',
                       Lang.bind(this, this._onStyleChanged));
        button.connect('clicked', Lang.bind(this, this.closeWindow));

        this.refreshTitle(metaWindow.title);
        this._updateCaptionId = metaWindow.connect('notify::title',
            Lang.bind(this, function(w) {
                this.refreshTitle(w.title);
            }));

        this._pointerTracker = new PointerTracker.PointerTracker();
        windowClone.actor.connect('motion-event', Lang.bind(this, this._onPointerMotion));
        windowClone.actor.connect('leave-event', Lang.bind(this, this._onPointerLeave));

        this._idleToggleCloseId = 0;
        windowClone.actor.connect('destroy', Lang.bind(this, this._onDestroy));
        windowClone.connect('zoom-start', Lang.bind(this, this.hide));
        windowClone.connect('zoom-end', Lang.bind(this, this.show));

        let attentionId = global.display.connect('window-demands-attention', Lang.bind(this, this._onWindowDemandsAttention));
        let urgentId = global.display.connect('window-marked-urgent', Lang.bind(this, this._onWindowDemandsAttention));
        this.disconnectAttentionSignals = function() {
            global.display.disconnect(attentionId);
            global.display.disconnect(urgentId);
        };

        // force a style change if we are already on a stage - otherwise
        // the signal will be emitted normally when we are added
        if (parentActor.get_stage())
            this._onStyleChanged();
    },

    _onWindowDemandsAttention: function(display, metaWindow) {
        if (metaWindow != this._windowClone.metaWindow) return;

        if (!this.title.has_style_class_name(DEMANDS_ATTENTION_CLASS_NAME)) {
            this.title.add_style_class_name(DEMANDS_ATTENTION_CLASS_NAME);
            this._applicationIconBox.add_style_class_name(DEMANDS_ATTENTION_CLASS_NAME);
        }
    },

    refreshTitle: function(titleText) {
        let name = '';
        if (this.title) {
            name = this.title.name;
            this._parentActor.remove_actor(this.title);
            this.title.destroy();
        }
        let title = new St.Label({ style_class: 'window-caption',
                                   text: titleText });
        this.title = title;
        title.name = name;
        title.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        title._spacing = 0;
        this._parentActor.add_actor(title);
        let mw = this._windowClone.metaWindow
        if (mw.is_urgent && (mw.is_demanding_attention() || mw.is_urgent())) {
            this.title.add_style_class_name(DEMANDS_ATTENTION_CLASS_NAME);
            this._applicationIconBox.add_style_class_name(DEMANDS_ATTENTION_CLASS_NAME);
        }
        title.connect('style-changed',
                      Lang.bind(this, this._onStyleChanged));
        if (this._parentActor.get_stage()) {
            this._onStyleChanged();
        }
    },

    setSelected: function(selected) {
        if (this._isSelected === selected) {
            return;
        }
        this._isSelected = selected;
        this.title.name = selected ? 'selected' : '';
        this.refreshTitle(this.title.text);
        
        if (selected) {
            this._showCloseButton();
        }
        else {
            this.hideCloseButton();
        }
    },

    hide: function() {
        this._hidden = true;
        this.closeButton.hide();
        this.title.hide();
        this._applicationIconBox.hide();
    },

    show: function() {
        this._hidden = false;
        this._hovering = false;
        this.title.show();
        this._applicationIconBox.show();
    },

    fadeIn: function() {
        this.show();
        this.title.opacity = 0;
        this._parentActor.raise_top();
        Tweener.addTween(this.title,
                        { opacity: 255,
                          time: CLOSE_BUTTON_FADE_TIME,
                          transition: 'easeOutQuad' });
    },

    chromeWidth: function () {
        return this.closeButton.width - this.closeButton._overlap;
    },

    chromeHeights: function () {
        return [this.closeButton.height - this.closeButton._overlap,
               this._applicationIconBox.height + this.title._spacing];
    },

    /**
     * @cloneX: x position of windowClone
     * @cloneY: y position of windowClone
     * @cloneWidth: width of windowClone
     * @cloneHeight height of windowClone
     */
    // These parameters are not the values retrieved with
    // get_transformed_position() and get_transformed_size(),
    // as windowClone might be moving.
    // See Workspace._showWindowOverlay
    updatePositions: function(cloneX, cloneY, cloneWidth, cloneHeight, maxWidth) {
        let button = this.closeButton;

        let settings = new Gio.Settings({ schema_id: BUTTON_LAYOUT_SCHEMA });
        let layout = settings.get_string(BUTTON_LAYOUT_KEY);
        let rtl = St.Widget.get_default_direction() == St.TextDirection.RTL;

        let split = layout.split(":");
        let side;
        if (split[0].indexOf("close") > -1)
            side = rtl ? St.Side.RIGHT : St.Side.LEFT;
        else
            side = rtl ? St.Side.LEFT : St.Side.RIGHT;

        let buttonX;
        let buttonY = cloneY - (button.height - button._overlap);
        if (side == St.Side.LEFT)
            buttonX = cloneX - (button.width - button._overlap);
        else
            buttonX = cloneX + (cloneWidth - button._overlap);

        button.set_position(Math.floor(buttonX), Math.floor(buttonY));

        this.updateIconCaptionWidth = Lang.bind(this, function() {
            let title = this.title;
            let iconWidth = this._applicationIconBox.width + title._spacing;
            title.width = Math.min(maxWidth - iconWidth, title.width);
            let titleX = cloneX + (iconWidth + cloneWidth - title.width) / 2;
            let titleY = cloneY + cloneHeight + title._spacing + (WINDOWOVERLAY_ICON_SIZE/2) - (title.height/2);
            title.set_position(Math.floor(titleX), Math.floor(titleY));

            let icon = this._applicationIconBox;

            let iconX = titleX - iconWidth;
            let iconY = cloneY + cloneHeight + title._spacing;

            icon.set_position(Math.floor(iconX), Math.floor(iconY));
        });
        this.updateIconCaptionWidth();
    },

    closeWindow: function() {
        let metaWindow = this._windowClone.metaWindow;
        let workspace = metaWindow.get_workspace();

        if (this._disconnectWindowAdded) {this._disconnectWindowAdded();}
        let windowAddedId = workspace.connect('window-added',Lang.bind(this, function(ws, win){
            if (this._disconnectWindowAdded) {this._disconnectWindowAdded();}
            if (win.get_transient_for() == metaWindow) {

                // use an idle handler to avoid mapping problems -
                // see comment in Workspace._windowAdded
                Mainloop.idle_add(Lang.bind(this,
                                            function() {
                                                this._windowClone.emit('activated');
                                                return false;
                                            }));
            }
        }));

        this._disconnectWindowAdded = Lang.bind(this, function() {
            workspace.disconnect(windowAddedId);
            this._disconnectWindowAdded = 0;
        });

        metaWindow.delete(global.get_current_time());
    },

    _onDestroy: function() {
        if (this._disconnectWindowAdded) {this._disconnectWindowAdded();}
        if (this._idleToggleCloseId > 0) {
            Mainloop.source_remove(this._idleToggleCloseId);
            this._idleToggleCloseId = 0;
        }
        this.disconnectAttentionSignals();
        this._windowClone.metaWindow.disconnect(this._updateCaptionId);
        this.title.destroy();
        this.closeButton.destroy();
        this.icon.destroy();
        this._applicationIconBox.destroy();
    },

    _onPointerMotion: function() {
        if (!this._pointerTracker.hasMoved()) {return;}
        // We might get motion events on the clone while the overlay is
        // hidden, e.g. during animations, we ignore these events,
        // as the close button will be shown as needed when the overlays
        // are shown again
        if (this._hidden) return;
        if (this._hovering) return;
        
        this._hovering = true;
        this._showCloseButton();
    },

    _showCloseButton: function() {
        this._parentActor.raise_top();
        this.closeButton.show();
        this.emit('show-close-button');
    },

    _onPointerLeave: function() {
        if (!this._pointerTracker.hasMoved()) {return;}
        this._hovering = false;
        this._idleHideCloseButton();
    },

    _idleHideCloseButton: function() {
        if (this._idleToggleCloseId == 0)
            this._idleToggleCloseId = Mainloop.timeout_add(750, Lang.bind(this, this._idleToggleCloseButton));
    },

    _idleToggleCloseButton: function() {
        this._idleToggleCloseId = 0;
        if (!this._windowClone.actor.has_pointer && !this.closeButton.has_pointer) {
            this.closeButton.hide();
        }

        return false;
    },

    hideCloseButton: function() {
        if (this._idleToggleCloseId > 0) {
            Mainloop.source_remove(this._idleToggleCloseId);
            this._idleToggleCloseId = 0;
        }
        this.closeButton.hide();
    },

    _onStyleChanged: function() {
        let titleNode = this.title.get_theme_node();
        this.title._spacing = titleNode.get_length('-cinnamon-caption-spacing');

        let closeNode = this.closeButton.get_theme_node();
        this.closeButton._overlap = closeNode.get_length('-cinnamon-close-overlap');

        this._parentActor.queue_relayout();
        if (this.updateIconCaptionWidth) {
            this.updateIconCaptionWidth();
        }
    }
};
Signals.addSignalMethods(WindowOverlay.prototype);

const WindowPositionFlags = {
    INITIAL: 1 << 0,
    ANIMATE: 1 << 1
};

function WorkspaceMonitor() {
    this._init.apply(this, arguments);
}

WorkspaceMonitor.prototype = {
    _init : function(metaWorkspace, monitorIndex, workspace, hasFocus) {
        this._myWorkspace = workspace;

        this.metaWorkspace = metaWorkspace;
        this._x = 0;
        this._y = 0;
        this._width = 0;
        this._height = 0;
        this._margin = 0;
        this._slotWidth = 0;

        this.monitorIndex = monitorIndex;
        this._monitor = Main.layoutManager.monitors[this.monitorIndex];
        this._windowOverlaysGroup = new Clutter.Group();
        // Without this the drop area will be overlapped.
        this._windowOverlaysGroup.set_size(0, 0);

        this.actor = new Clutter.Group();
        this.actor.set_size(0, 0);

        this._dropRect = new Clutter.Rectangle({ opacity: 0 });
        this._dropRect._delegate = this;

        this.actor.add_actor(this._dropRect);
        this.actor.add_actor(this._windowOverlaysGroup);

        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
        Main.overview.connect('overview-background-button-press', function() {
            closeContextMenu();
        });

        this.stickyCallbackId = workspace.myView.connect('sticky-detected', Lang.bind(this, function(box, metaWindow) {
            this._doAddWindow(metaWindow);
        }));
        let windows = global.get_window_actors().filter(this._isMyWindow, this);

        // Create clones for windows that should be
        // visible in the Overview
        this._windows = [];
        for (let i = 0; i < windows.length; i++) {
            if (this._isOverviewWindow(windows[i])) {
                this._addWindowClone(windows[i]);
            }
        }

        // Track window changes
        if (this.metaWorkspace) {
            this._windowAddedId = this.metaWorkspace.connect('window-added',
                                                             Lang.bind(this, this._windowAdded));
            this._windowRemovedId = this.metaWorkspace.connect('window-removed',
                                                               Lang.bind(this, this._windowRemoved));
        }
        this._windowEnteredMonitorId = global.screen.connect('window-entered-monitor',
            Lang.bind(this, this._windowEnteredMonitor));
        this._windowLeftMonitorId = global.screen.connect('window-left-monitor',
            Lang.bind(this, this._windowLeftMonitor));
        this._repositionWindowsId = 0;

        this.leavingOverview = false;

        this._kbWindowIndex = 0; // index of the current keyboard-selected window
        if (hasFocus) {
            this.onInitialPositionWindows = Lang.bind(this, function() {
                // default-select the first window
                this.selectAnotherWindow(Clutter.Home);
                Mainloop.idle_add(Lang.bind(this, function() {
                    // if keyboard focus is at the default position,
                    // make sure that the close button is drawn,
                    // which must done a little bit later
                    if (this._kbWindowIndex === 0) {
                        this.selectAnotherWindow(Clutter.Home);
                    }
                }));
            });
        }
    },
    
    selectAnotherWindow: function(symbol) {
        let numWindows = this._windows.length;
        if (numWindows === 0) {
            return false;
        }
        let currentIndex = this._kbWindowIndex;
        let numCols = Math.ceil(Math.sqrt(numWindows));
        let nextIndex = GridNavigator.nextIndex(numWindows, numCols, currentIndex, symbol);
        if (nextIndex < 0) {
            return false; // not handled
        }

        this.selectIndex(nextIndex);
        return true;
    },
    
    showActiveSelection: function() {
        this.selectIndex(this._kbWindowIndex);
    },

    selectIndex: function(index) {
        this._kbWindowIndex = index;
        let activeClone = null;
        if (index > -1 && index < this._windows.length) {
            activeClone = this._windows[this._kbWindowIndex];
        }
        this._myWorkspace.selectActiveClone(activeClone, this);
    },

    selectClone: function(clone) {
        this.selectIndex(this._windows.indexOf(clone));
    },

    _onCloneContextMenuRequested: function(clone) {
        menuShowing = new WindowContextMenu(clone.actor, clone.metaWindow, Lang.bind(this, function() {
            menuShowing = null; menuClone = null;
            this._myWorkspace.emit('focus-refresh-required');
        }));
        menuClone = clone;
        menuShowing.toggle();
    },
    
    showMenuForSelectedWindow: function() {
        if (this._kbWindowIndex > -1 && this._kbWindowIndex < this._windows.length) {
            let window = this._windows[this._kbWindowIndex];
            this._onCloneContextMenuRequested(window);
        }
        return false;
    },

    activateSelectedWindow: function() {
        if (this._kbWindowIndex > -1 && this._kbWindowIndex < this._windows.length) {
            this._onCloneActivated(this._windows[this._kbWindowIndex], global.get_current_time());
            return true;
        }
        return false;
    },

    zoomSelectedWindow: function(direction) {
        if (this._kbWindowIndex > -1 && this._kbWindowIndex < this._windows.length) {
            this._windows[this._kbWindowIndex].scrollZoom(direction);
        }
    },

    closeSelectedWindow: function() {
        if (this._kbWindowIndex > -1 && this._kbWindowIndex < this._windows.length) {
            this._windows[this._kbWindowIndex].overlay.closeWindow();
        }
    },

    moveSelectedWindowToNextMonitor: function() {
        if (this._kbWindowIndex > -1 && this._kbWindowIndex < this._windows.length) {
            let monitorCount = Main.layoutManager.monitors.length;
            if (monitorCount < 2) return;
            let nextIndex = (this._windows[this._kbWindowIndex].metaWindow.get_monitor() + monitorCount + 1) % monitorCount;
            this._windows[this._kbWindowIndex].metaWindow.move_to_monitor(nextIndex);
        }
    },

    setGeometry: function(x, y, width, height, margin) {
        this._x = x;
        this._y = y;
        this._width = width;
        this._height = height;
        this._margin = margin;

        // This is sometimes called during allocation, so we do this later
        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this,
            function () {
                this.positionWindows(WindowPositionFlags.ANIMATE);
                return false;
            }));
    },

    _lookupIndex: function (metaWindow) {
        for (let i = 0; i < this._windows.length; i++) {
            if (this._windows[i].metaWindow == metaWindow) {
                return i;
            }
        }
        return -1;
    },

    isEmpty: function() {
        return this._windows.length === 0;
    },

    /**
     * _getSlotGeometry:
     * @slot: A layout slot
     *
     * Returns: the screen-relative [x, y, width, height]
     * of a given window layout slot.
     */
    _getSlotGeometry: function(slot) {
        let [xCenter, yCenter, fraction] = slot;

        let width = (this._width - this._margin * 2) * fraction;
        let height = (this._height - this._margin * 2) * fraction;

        let x = this._x + this._margin + xCenter * (this._width - this._margin * 2) - width / 2 ;
        let y = this._y + this._margin + yCenter * (this._height - this._margin * 2) - height / 2;

        return [x, y, width, height];
    },

    /**
     * _computeWindowLayout:
     * @metaWindow: A #MetaWindow
     * @slot: A layout slot
     *
     * Given a window and slot to fit it in, compute its
     * screen-relative [x, y, scale] where scale applies
     * to both X and Y directions.
     */
    _computeWindowLayout: function(metaWindow, slot) {
        let [x, y, width, height] = this._getSlotGeometry(slot);

        let rect = metaWindow.get_outer_rect();
        let buttonOuterHeight, captionIconHeight;
        let buttonOuterWidth = 0;

        if (this._windows.length) {
            [buttonOuterHeight, captionIconHeight] = this._windows[0].overlay.chromeHeights();
            buttonOuterWidth = this._windows[0].overlay.chromeWidth();
        } else {
            [buttonOuterHeight, captionIconHeight] = [0, 0];
        }
        let scale = Math.min((width - buttonOuterWidth) / rect.width,
                             (height - buttonOuterHeight - captionIconHeight) / rect.height,
                             1.0);

        x = Math.floor(x + (width - scale * rect.width) / 2);
        y = Math.floor(y + ((height - (scale * rect.height)) / 2) - captionIconHeight);

        return [x, y, scale];
    },

    /**
     * positionWindows:
     * @flags:
     *  INITIAL - this is the initial positioning of the windows.
     *  ANIMATE - Indicates that we need animate changing position.
     */
    positionWindows : function(flags) {
        if (Main.expo.visible)
            return;
        if (this._repositionWindowsId > 0) {
            Mainloop.source_remove(this._repositionWindowsId);
            this._repositionWindowsId = 0;
        }

        closeContextMenu();
        let clones = this._windows.slice();

        let initialPositioning = flags & WindowPositionFlags.INITIAL;
        let animate = flags & WindowPositionFlags.ANIMATE;

        // Start the animations
        let slots = this._computeAllWindowSlots(clones.length);
        //clones = this._orderWindowsByMotionAndStartup(clones, slots);

        let currentWorkspace = global.screen.get_active_workspace();
        let isOnCurrentWorkspace = this.metaWorkspace == null || this.metaWorkspace == currentWorkspace;

        for (let i = 0; i < clones.length; i++) {
            let slot = slots[i];
            let clone = clones[i];
            let metaWindow = clone.metaWindow;
            let mainIndex = this._lookupIndex(metaWindow);
            let overlay = clone.overlay;

            let [x, y, scale] = this._computeWindowLayout(metaWindow, slot);

            if (overlay)
                overlay.hide();
            if (animate && isOnCurrentWorkspace) {
                if (!metaWindow.showing_on_its_workspace()) {
                    /* Hidden windows should fade in and grow
                     * therefore we need to resize them now so they
                     * can be scaled up later */
                     if (initialPositioning) {
                         clone.actor.opacity = 0;
                         clone.actor.scale_x = 0;
                         clone.actor.scale_y = 0;
                         clone.actor.x = x;
                         clone.actor.y = y;
                     }

                     // Make the window slightly transparent to indicate it's hidden
                     Tweener.addTween(clone.actor,
                                      { opacity: 255,
                                        time: Overview.ANIMATION_TIME,
                                        transition: 'easeInQuad'
                                      });
                }

                Tweener.addTween(clone.actor,
                                 { x: x,
                                   y: y,
                                   scale_x: scale,
                                   scale_y: scale,
                                   time: Overview.ANIMATION_TIME,
                                   transition: 'easeOutQuad',
                                   onComplete: Lang.bind(this, function() {
                                      this._showWindowOverlay(clone, true);
                                   })
                                 });
            } else {
                clone.actor.set_position(x, y);
                clone.actor.set_scale(scale, scale);
                this._showWindowOverlay(clone, isOnCurrentWorkspace);
            }
        }
        if (this.onInitialPositionWindows) {
            this.onInitialPositionWindows();
            this.onInitialPositionWindows = null;
        }
    },

    syncStacking: function(stackIndices) {
        // Only on the first invocation do we want to affect the
        // permanent sort order. After that, we don't want major
        // upheavals to the sort order.
        let clones = !this._stackedOnce ? this._windows : this._windows.slice();
        this._stackedOnce = true;

        clones.sort(function (a, b) {
            let minimizedA = a.metaWindow.minimized ? 1 : 0;
            let minimizedB = b.metaWindow.minimized ? 1 : 0;
            let minimizedDiff = minimizedA - minimizedB;
            return minimizedDiff || stackIndices[a.metaWindow.get_stable_sequence()] - stackIndices[b.metaWindow.get_stable_sequence()];
        });

        clones = clones.slice().reverse();
        let below = this._dropRect;
        for (let i = 0; i < clones.length; i++) {
            let clone = clones[i];
            clone.setStackAbove(below);
            below = clone.actor;
        }
    },

    _showWindowOverlay: function(clone, fade) {
        if (this._slotWidth) {
            // This is a little messy and complicated because when we
            // start the fade-in we may not have done the final positioning
            // of the workspaces. (Tweener doesn't necessarily finish
            // all animations before calling onComplete callbacks.)
            // So we need to manually compute where the window will
            // be after the workspace animation finishes.
            let [cloneX, cloneY] = clone.actor.get_position();
            let [cloneWidth, cloneHeight] = clone.actor.get_size();
            cloneWidth = clone.actor.scale_x * cloneWidth;
            cloneHeight = clone.actor.scale_y * cloneHeight;

            clone.overlay.updatePositions(cloneX, cloneY, cloneWidth, cloneHeight, this._slotWidth);
            if (fade)
                clone.overlay.fadeIn();
            else
                clone.overlay.show();
        }
    },

    _showAllOverlays: function() {
        let currentWorkspace = global.screen.get_active_workspace();
        for (let i = 0; i < this._windows.length; i++) {
            let clone = this._windows[i];
            this._showWindowOverlay(clone,
                                    this.metaWorkspace == null || this.metaWorkspace == currentWorkspace);
        }
    },

    _delayedWindowRepositioning: function() {
        if (this._windowIsZooming)
            return true;

        let [x, y, mask] = global.get_pointer();

        let pointerHasMoved = (this._cursorX != x && this._cursorY != y);
        let inWorkspace = (this._x < x && x < this._x + this._width &&
                           this._y < y && y < this._y + this._height);

        if (pointerHasMoved && inWorkspace) {
            // store current cursor position
            this._cursorX = x;
            this._cursorY = y;
            return true;
        }

        this.positionWindows(WindowPositionFlags.ANIMATE);
        this._myWorkspace.emit('focus-refresh-required');
        this._repositionWindowsId = 0;
        return false;
    },

    showWindowsOverlays: function() {
        if (this.leavingOverview)
            return;

        this._windowOverlaysGroup.show();
        this._showAllOverlays();
    },

    hideWindowsOverlays: function() {
        this._windowOverlaysGroup.hide();
    },

    _doRemoveWindow : function(metaWin) {
        let win = metaWin.get_compositor_private();

        // find the position of the window in our list
        let index = this._lookupIndex (metaWin);

        if (index == -1)
            return;

        // Check if window still should be here
        if (win && this._isMyWindow(win))
            return;

        let clone = this._windows[index];

        this._windows.splice(index, 1);

        // If metaWin.get_compositor_private() returned non-NULL, that
        // means the window still exists (and is just being moved to
        // another workspace or something), so set its overviewHint
        // accordingly. (If it returned NULL, then the window is being
        // destroyed; we'd like to animate this, but it's too late at
        // this point.)
        if (win) {
            let [stageX, stageY] = clone.actor.get_transformed_position();
            let [stageWidth, stageHeight] = clone.actor.get_transformed_size();
            win._overviewHint = {
                x: stageX,
                y: stageY,
                scale: stageWidth / clone.actor.width
            };
        }

        if (this._kbWindowIndex >= this._windows.length) {
            this._kbWindowIndex = this._windows.length - 1;
        }
        if (clone === this._myWorkspace._activeClone) {
            this.selectIndex(this._kbWindowIndex);
        }
        
        clone.destroy();


        // We need to reposition the windows; to avoid shuffling windows
        // around while the user is interacting with the workspace, we delay
        // the positioning until the pointer remains still for at least 750 ms
        // or is moved outside the workspace

        // remove old handler
        if (this._repositionWindowsId > 0) {
            Mainloop.source_remove(this._repositionWindowsId);
            this._repositionWindowsId = 0;
        }

        // setup new handler
        let [x, y, mask] = global.get_pointer();
        this._cursorX = x;
        this._cursorY = y;

        this._repositionWindowsId = Mainloop.timeout_add(750,
            Lang.bind(this, this._delayedWindowRepositioning));
    },

    _doAddWindow : function(metaWin) {
        if (this.leavingOverview)
            return;

        let win = metaWin.get_compositor_private();
        if (!win) {
            // Newly-created windows are added to a workspace before
            // the compositor finds out about them...
            Mainloop.idle_add(Lang.bind(this,
                                        function () {
                                            if (this.actor &&
                                                metaWin.get_compositor_private() &&
                                                metaWin.get_workspace() == this.metaWorkspace)
                                                this._doAddWindow(metaWin);
                                            return false;
                                        }));
            return;
        }

        // We might have the window in our list already if it was on all workspaces and
        // now was moved to this workspace
        if (this._lookupIndex (metaWin) != -1) {
            return;
        }

        if (!this._isMyWindow(win) || !this._isOverviewWindow(win)){
            return;
        }
        let clone = this._addWindowClone(win);

        if (win._overviewHint) {
            let x = win._overviewHint.x - this.actor.x;
            let y = win._overviewHint.y - this.actor.y;
            let scale = win._overviewHint.scale;
            delete win._overviewHint;

            clone.actor.set_position (x, y);
            clone.actor.set_scale (scale, scale);
        } else {
            // Position new windows at the top corner of the workspace rather
            // than where they were placed for real to avoid the window
            // being clipped to the workspaceView. Its not really more
            // natural for the window to suddenly appear in the overview
            // on some seemingly random location anyway.
            clone.actor.set_position (this._x, this._y);
        }

        if (this.actor.get_stage()) {
            this.positionWindows(WindowPositionFlags.ANIMATE);
            this._myWorkspace.emit('focus-refresh-required');
        }
    },

    _windowAdded : function(metaWorkspace, metaWin) {
        this._doAddWindow(metaWin);
    },

    _windowRemoved : function(metaWorkspace, metaWin) {
        this._doRemoveWindow(metaWin);
    },

    _windowEnteredMonitor : function(metaScreen, monitorIndex, metaWin) {
        if (monitorIndex == this.monitorIndex) {
            this._doAddWindow(metaWin);
        }
    },

    _windowLeftMonitor : function(metaScreen, monitorIndex, metaWin) {
        if (monitorIndex == this.monitorIndex) {
            this._doRemoveWindow(metaWin);
        }
    },

    // check for maximized windows on the workspace
    hasMaximizedWindows: function() {
        for (let i = 0; i < this._windows.length; i++) {
            let metaWindow = this._windows[i].metaWindow;
            if (metaWindow.showing_on_its_workspace() &&
                metaWindow.maximized_horizontally &&
                metaWindow.maximized_vertically)
                return true;
        }
        return false;
    },

    // Animate the full-screen to Overview transition.
    zoomToOverview : function() {
        // Position and scale the windows.
        if (Main.overview.animationInProgress)
            this.positionWindows(WindowPositionFlags.ANIMATE | WindowPositionFlags.INITIAL);
        else
            this.positionWindows(WindowPositionFlags.INITIAL);
    },

    // Animates the return from Overview mode
    zoomFromOverview : function() {
        let currentWorkspace = global.screen.get_active_workspace();

        this.leavingOverview = true;

        this.hideWindowsOverlays();

        if (this._repositionWindowsId > 0) {
            Mainloop.source_remove(this._repositionWindowsId);
            this._repositionWindowsId = 0;
        }
        this._overviewHiddenId = Main.overview.connect('hidden', Lang.bind(this,
                                                                           this._doneLeavingOverview));

        if (this.metaWorkspace != null && this.metaWorkspace != currentWorkspace)
            return;

        // Position and scale the windows.
        for (let i = 0; i < this._windows.length; i++) {
            let clone = this._windows[i];

            clone.zoomFromOverview();

            if (clone.metaWindow.showing_on_its_workspace()) {
                Tweener.addTween(clone.actor,
                                 { x: clone.origX,
                                   y: clone.origY,
                                   scale_x: 1.0,
                                   scale_y: 1.0,
                                   time: Overview.ANIMATION_TIME,
                                   opacity: 255,
                                   transition: 'easeOutQuad'
                                 });
            } else {
                // The window is hidden, make it shrink and fade it out
                Tweener.addTween(clone.actor,
                                 { scale_x: 0,
                                   scale_y: 0,
                                   opacity: 0,
                                   time: Overview.ANIMATION_TIME,
                                   transition: 'easeOutQuad'
                                 });
            }
        }

    },

    destroy : function() {
        this.actor.destroy();
    },

    _onDestroy: function(actor) {
        closeContextMenu();
        if (this._overviewHiddenId) {
            Main.overview.disconnect(this._overviewHiddenId);
            this._overviewHiddenId = 0;
        }
        Tweener.removeTweens(actor);

        this._myWorkspace.myView.disconnect(this.stickyCallbackId);
        if (this.metaWorkspace) {
            this.metaWorkspace.disconnect(this._windowAddedId);
            this.metaWorkspace.disconnect(this._windowRemovedId);
        }
        global.screen.disconnect(this._windowEnteredMonitorId);
        global.screen.disconnect(this._windowLeftMonitorId);

        if (this._repositionWindowsId > 0) {
            Mainloop.source_remove(this._repositionWindowsId);
            this._repositionWindowsId = 0;
        }

        // Usually, the windows will be destroyed automatically with
        // their parent (this.actor), but we might have a zoomed window
        // which has been reparented to the stage - _windows[0] holds
        // the desktop window, which is never reparented
        for (let w = 0; w < this._windows.length; w++)
            this._windows[w].destroy();
        this._windows = [];
    },

    // Sets this.leavingOverview flag to false.
    _doneLeavingOverview : function() {
        this.leavingOverview = false;
    },

    // Tests if @win belongs to this workspace
    _isMyWindow : function (win) {
        return (this.metaWorkspace == null || Main.isWindowActorDisplayedOnWorkspace(win, this.metaWorkspace.index()) && (!win.get_meta_window() || win.get_meta_window().get_monitor() == this.monitorIndex));
    },

    // Tests if @win should be shown in the Overview
    _isOverviewWindow : function (win) {
        let tracker = Cinnamon.WindowTracker.get_default();
        return Main.isInteresting(win.get_meta_window());
    },

    // Create a clone of a (non-desktop) window and add it to the window list
    _addWindowClone : function(win) {
        let clone = new WindowClone(win, this);
        let overlay = new WindowOverlay(clone, this._windowOverlaysGroup);

        clone.connect('workspace-changed', Lang.bind(this, function() {
            this._doRemoveWindow(clone.metaWindow);
            if (clone.metaWindow.is_on_all_workspaces()) {
                // Muffin appears not to broadcast when a window turns sticky
                this._myWorkspace.myView.emit('sticky-detected', clone.metaWindow);
            }
        }));
        clone.connect('selected',
                      Lang.bind(this, this._onCloneSelected));
        clone.connect('activated',
                      Lang.bind(this, this._onCloneActivated));
        clone.connect('closed',
                      Lang.bind(this, this._onCloneClosed));
        clone.connect('context-menu-requested',
                      Lang.bind(this, this._onCloneContextMenuRequested));
        clone.connect('zoom-start', Lang.bind(this, function(clone) {
            this.selectClone(clone);
            this._windowIsZooming = true;
        }));
        clone.connect('zoom-end',
                      Lang.bind(this, function() {
                          this._windowIsZooming = false;
                      }));
        clone.connect('size-changed',
                      Lang.bind(this, function() {
                          this.positionWindows(0);
                      }));

        this.actor.add_actor(clone.actor);

        overlay.connect('show-close-button', Lang.bind(this, this._onShowOverlayClose));

        this._windows.push(clone);
        clone.overlay = overlay;

        return clone;
    },

    _onShowOverlayClose: function (windowOverlay) {
        for (let i = 0; i < this._windows.length; i++) {
            let overlay = this._windows[i].overlay;
            if (overlay == windowOverlay)
                continue;
            overlay.hideCloseButton();
        }
    },

    _computeAllWindowSlots: function(numberOfWindows) {
        if (!numberOfWindows) return [];
        let gridWidth = Math.ceil(Math.sqrt(numberOfWindows));
        let gridHeight = Math.ceil(numberOfWindows / gridWidth);
        let fraction = DEFAULT_SLOT_FRACTION * (1. / gridWidth);
        this._slotWidth = Math.floor(fraction * this._width);

        let computeWindowSlot = function(windowIndex, numberOfWindows) {
            if (numberOfWindows in POSITIONS)
                return POSITIONS[numberOfWindows][windowIndex];

            // If we don't have a predefined scheme for this window count,
            // arrange the windows in a grid pattern.

            let xCenter = (.5 / gridWidth) + ((windowIndex) % gridWidth) / gridWidth;
            let yCenter = (.5 / gridHeight) + Math.floor((windowIndex / gridWidth)) / gridHeight;
            return [xCenter, yCenter, fraction];
        };
        
        let slots = [];
        for (let i = 0; i < numberOfWindows; i++) {
            slots.push(computeWindowSlot(i, numberOfWindows));
        }
        return slots;
    },

    _onCloneSelected : function (clone, time) {
        this.selectClone(clone);
    },

    _onCloneActivated : function (clone, time) {
        let wsIndex = undefined;
        if (this.metaWorkspace)
            wsIndex = this.metaWorkspace.index();
        Main.activateWindow(clone.metaWindow, time, wsIndex);
    },
    
    _onCloneClosed : function (clone, time) {        
        clone.metaWindow.delete(global.get_current_time());        
    }
};

Signals.addSignalMethods(WorkspaceMonitor.prototype);

function WindowContextMenu(actor, metaWindow, onClose) {
    this._init(actor, metaWindow, onClose);
}

WindowContextMenu.prototype = {
    __proto__: PopupMenu.PopupComboMenu.prototype,

    _init: function(actor, metaWindow, onClose) {
        PopupMenu.PopupComboMenu.prototype._init.call(this, actor);
        this.name = 'scale-window-context-menu';
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
        let orientation = St.Side.TOP;
        this.onClose = onClose;
        actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
        this.connect('open-state-changed', Lang.bind(this, this._onToggled));

        this.metaWindow = metaWindow;

        this.itemCloseWindow = new PopupMenu.PopupMenuItem(_("Close"));
        this.itemCloseWindow.connect('activate', Lang.bind(this, this._onCloseWindowActivate));

        if (metaWindow.minimized)
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem(_("Restore"));
        else
            this.itemMinimizeWindow = new PopupMenu.PopupMenuItem(_("Minimize"));
        this.itemMinimizeWindow.connect('activate', Lang.bind(this, this._onMinimizeWindowActivate));

        this.itemMaximizeWindow = new PopupMenu.PopupMenuItem(_("Maximize"));
        this.itemMaximizeWindow.connect('activate', Lang.bind(this, this._onMaximizeWindowActivate));

        this.itemMoveToLeftWorkspace = new PopupMenu.PopupMenuItem(_("Move to left workspace"));
        this.itemMoveToLeftWorkspace.connect('activate', Lang.bind(this, this._onMoveToLeftWorkspace));

        this.itemMoveToRightWorkspace = new PopupMenu.PopupMenuItem(_("Move to right workspace"));
        this.itemMoveToRightWorkspace.connect('activate', Lang.bind(this, this._onMoveToRightWorkspace));

        this.itemOnAllWorkspaces = new PopupMenu.PopupMenuItem(_("Visible on all workspaces"));
        this.itemOnAllWorkspaces.connect('activate', Lang.bind(this, this._toggleOnAllWorkspaces));

        let itemMoveToNewWorkspace = new PopupMenu.PopupMenuItem(_("Move to a new workspace"));
        itemMoveToNewWorkspace.connect('activate', Lang.bind(this, function() {
            Main.moveWindowToNewWorkspace(metaWindow, true);
        }));

        let monitorItems = [];
        if (Main.layoutManager.monitors.length > 1) {
            Main.layoutManager.monitors.forEach(function(monitor, index) {
                if (index !== metaWindow.get_monitor()) {
                    let itemChangeMonitor = new PopupMenu.PopupMenuItem(
                        _("Move to monitor %d").format(index + 1));
                    itemChangeMonitor.connect('activate', Lang.bind(this, function() {
                        metaWindow.move_to_monitor(index);
                    }));
                    monitorItems.push(itemChangeMonitor);
                }
            }, this);
            monitorItems.push(new PopupMenu.PopupSeparatorMenuItem());
        }

        let items = monitorItems.concat([
            itemMoveToNewWorkspace,
            this.itemOnAllWorkspaces,
            this.itemMoveToLeftWorkspace,
            this.itemMoveToRightWorkspace,
            new PopupMenu.PopupSeparatorMenuItem(),
            this.itemMinimizeWindow,
            this.itemMaximizeWindow,
            this.itemCloseWindow
        ]);
        (orientation == St.Side.BOTTOM ? items : items.reverse()).forEach(function(item) {
            this.addMenuItem(item);
        }, this);
        this.setActiveItem(0);
     },

     _onToggled: function(actor, opening){
         if (!opening) {
            this.onClose();
            this.destroy();
            return;
         }

        if (this.metaWindow.is_on_all_workspaces()) {
            this.itemOnAllWorkspaces.label.set_text(_("Only on this workspace"));
        } else {
            this.itemOnAllWorkspaces.label.set_text(_("Visible on all workspaces"));
        }
        if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT) != this.metaWindow.get_workspace())
            this.itemMoveToLeftWorkspace.actor.show();
        else
            this.itemMoveToLeftWorkspace.actor.hide();

        if (this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT) != this.metaWindow.get_workspace())
            this.itemMoveToRightWorkspace.actor.show();
        else
            this.itemMoveToRightWorkspace.actor.hide();

        if (this.metaWindow.get_maximized()) {
            this.itemMaximizeWindow.label.set_text(_("Unmaximize"));
        }else{
            this.itemMaximizeWindow.label.set_text(_("Maximize"));
        }
    },

    _onCloseWindowActivate: function(actor, event){
        this.metaWindow.delete(global.get_current_time());
    },

    _onMinimizeWindowActivate: function(actor, event){
        if (this.metaWindow.minimized) {
            this.metaWindow.unminimize(global.get_current_time());
        }
        else {
            this.metaWindow.minimize(global.get_current_time());
        }
    },

    _onMaximizeWindowActivate: function(actor, event){
        if (this.metaWindow.get_maximized()){
            this.metaWindow.unmaximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }else{
            this.metaWindow.maximize(Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL);
        }
    },

    _onMoveToLeftWorkspace: function(actor, event){
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.LEFT);
        if (workspace) {
            this.metaWindow.change_workspace(workspace);
        }
    },

    _onMoveToRightWorkspace: function(actor, event){
        let workspace = this.metaWindow.get_workspace().get_neighbor(Meta.MotionDirection.RIGHT);
        if (workspace) {
            this.metaWindow.change_workspace(workspace);
        }
    },

    _toggleOnAllWorkspaces: function(actor, event) {
        if (this.metaWindow.is_on_all_workspaces())
            this.metaWindow.unstick();
        else
            this.metaWindow.stick();
    },

    _onSourceKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen)
                this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;
    }

};

function Workspace() {
    this._init.apply(this, arguments);
}

Workspace.prototype = {
    _init : function(metaWorkspace, view) {
        this.metaWorkspace = metaWorkspace;
        this.myView = view;
        this.actor = new Clutter.Group();
        this.actor.set_size(0, 0);
        this._monitors = [];
        this._activeClone = null;
        this.currentMonitorIndex = Main.layoutManager.primaryIndex;
        Main.layoutManager.monitors.forEach(function(monitor, ix) {
            let m = new WorkspaceMonitor(metaWorkspace, ix, this, ix === this.currentMonitorIndex)
            m.setGeometry(monitor.x, monitor.y, monitor.width, monitor.height, 0);
            this._monitors.push(m);
            this.actor.add_actor(m.actor);
        }, this);
        this.connect('focus-refresh-required', Lang.bind(this, function() {
            this.selectNextNonEmptyMonitor(this.currentMonitorIndex - 1, 1);
        }));
    },

    findNextNonEmptyMonitor: function(start, increment) {
        let pos = start;
        for (let i = 0; i < this._monitors.length; ++i) {
            pos = (this._monitors.length + pos + increment) % this._monitors.length;
            if (!this._monitors[pos].isEmpty()) {
                return pos;
            }
        }
        return this.currentMonitorIndex || 0;
    },

    selectNextNonEmptyMonitor: function(start, increment) {
        this.selectMonitor(this.findNextNonEmptyMonitor(start || 0, increment));
    },

    selectMonitor: function(index) {
        this.currentMonitorIndex = index;
        this._monitors[this.currentMonitorIndex].showActiveSelection();
    },

    selectActiveClone: function(clone, wsMonitor) {
        let current = this._activeClone;
        if (clone) {
            this.currentMonitorIndex = wsMonitor.monitorIndex;
        }
        this._activeClone = clone;

        if (current !== this._activeClone) {
            if (current) {
                current.overlay.setSelected(false);
            }
            if (this._activeClone) {
                this._activeClone.overlay.setSelected(true);
            }
            wsMonitor.emit('selection-changed');
        }
    },

    _onKeyPress: function(actor, event) {
        let modifiers = Cinnamon.get_event_state(event);
        let symbol = event.get_key_symbol();
        let ctrlAltMask = Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD1_MASK;

        if ((symbol === Clutter.ISO_Left_Tab || symbol === Clutter.Tab)  && !(modifiers & ctrlAltMask)) {
            let increment = symbol === Clutter.ISO_Left_Tab ? -1 : 1;
            this.selectNextNonEmptyMonitor(this.currentMonitorIndex, increment);
            return true;
        }

        let activeMonitor = this._monitors[this.currentMonitorIndex];

        if ((symbol === Clutter.m  || symbol === Clutter.M || symbol === Clutter.KEY_space) &&
            (modifiers & Clutter.ModifierType.MOD1_MASK) && !(modifiers & Clutter.ModifierType.CONTROL_MASK))
        {
            activeMonitor.showMenuForSelectedWindow();
            return true;
        }

        if (symbol === Clutter.w && modifiers & Clutter.ModifierType.CONTROL_MASK) {
            activeMonitor.closeSelectedWindow();
            return true;
        }

        if ((symbol === Clutter.m || symbol === Clutter.M) && modifiers & Clutter.ModifierType.CONTROL_MASK) {
            activeMonitor.moveSelectedWindowToNextMonitor();
            return true;
        }

        if (symbol === Clutter.Return || symbol === Clutter.KEY_space || symbol === Clutter.KP_Enter) {
            if (activeMonitor.activateSelectedWindow()) {
                return true;
            }
            Main.overview.hide();
            return true;
        }
        if (symbol === Clutter.plus && modifiers & Clutter.ModifierType.CONTROL_MASK) {
            activeMonitor.zoomSelectedWindow(Clutter.ScrollDirection.UP);
            return true;
        }
        if (symbol === Clutter.minus && modifiers & Clutter.ModifierType.CONTROL_MASK) {
            activeMonitor.zoomSelectedWindow(Clutter.ScrollDirection.DOWN);
            return true;
        }
        if (symbol - '48' === 0 && modifiers & Clutter.ModifierType.CONTROL_MASK) {
            activeMonitor.zoomSelectedWindow(-1); // end zoom
            return true;
        }
        if (modifiers & ctrlAltMask) {
            return false;
        }
        return activeMonitor.selectAnotherWindow(symbol);
    },

    destroy: function() {
        this._monitors.forEach(function(monitor) {
            monitor.destroy();
        }, this);
        this.actor.destroy();
    },

    selectAnotherWindow: function(symbol) {
        this._monitors[this.currentMonitorIndex].selectAnotherWindow(symbol);
    },

    zoomFromOverview: function() {
        this._monitors.forEach(function(monitor) {
            monitor.zoomFromOverview();
        }, this);
    },

    zoomToOverview: function() {
        this._monitors.forEach(function(monitor) {
            monitor.zoomToOverview();
        }, this);
        this.emit('focus-refresh-required');
    },

    hasMaximizedWindows: function() {
        let has = false;
        this._monitors.forEach(function(monitor) {
            has = has || monitor.hasMaximizedWindows();
        }, this);
        return has;
    },

    isEmpty: function() {
        let hasWindows = false;
        this._monitors.forEach(function(monitor) {
            hasWindows = hasWindows || !monitor.isEmpty();
        }, this);
        return !hasWindows;
    },

    showWindowsOverlays: function() {
        this._monitors.forEach(function(monitor) {
            monitor.showWindowsOverlays();
        }, this);
    },
    
    hideWindowsOverlays: function() {
        this._monitors.forEach(function(monitor) {
            monitor.hideWindowsOverlays();
        }, this);
    },

    syncStacking: function(arg1) {
        this._monitors.forEach(function(monitor) {
            monitor.syncStacking(arg1);
        }, this);
    }
};
Signals.addSignalMethods(Workspace.prototype);
