// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported KeyboardManager */

const { Clutter, Gio, GLib, GObject, Meta, St } = imports.gi;
const Signals = imports.signals;

const KeyboardManager = imports.ui.keyboardManager;
const IBusManager = imports.misc.ibusManager;
const BoxPointer = imports.ui.boxpointer;
const Layout = imports.ui.layout;
const Main = imports.ui.main;
const PageIndicators = imports.ui.pageIndicators;
const PopupMenu = imports.ui.popupMenu;

var KEYBOARD_REST_TIME = Layout.KEYBOARD_ANIMATION_TIME * 2;
var KEY_LONG_PRESS_TIME = 250;
var PANEL_SWITCH_ANIMATION_TIME = 500;
var PANEL_SWITCH_RELATIVE_DISTANCE = 1 / 3; /* A third of the actor width */

const A11Y_APPLICATIONS_SCHEMA = 'org.cinnamon.desktop.a11y.applications';
const SHOW_KEYBOARD_KEY = 'screen-keyboard-enabled';

const OSK_SETTINGS = 'org.cinnamon.keyboard';
const ACTIVATION_MODE_KEY = 'activation-mode';
const KEYBOARD_SIZE_KEY = 'keyboard-size';
const KEYBOARD_POSITION_KEY = 'keyboard-position';

/* KeyContainer puts keys in a grid where a 1:1 key takes this size */
const KEY_SIZE = 2;

const defaultKeysPre = [
    [[{ keyval: Clutter.KEY_Escape, label: "Esc" }], [{ keyval: Clutter.KEY_Tab, label: '⇥' }], [{ width: 1.5, level: 1, extraClassName: 'shift-key-lowercase', icon: 'keyboard-shift-filled-symbolic' }], [{ label: '?123', width: 1.5, level: 2 }]],
    [[{ keyval: Clutter.KEY_Escape, label: "Esc" }], [{ keyval: Clutter.KEY_Tab, label: '⇥' }], [{ width: 1.5, level: 0, extraClassName: 'shift-key-uppercase', icon: 'keyboard-shift-filled-symbolic' }], [{ label: '?123', width: 1.5, level: 2 }]],
    [[{ keyval: Clutter.KEY_Escape, label: "Esc" }], [{ keyval: Clutter.KEY_Tab, label: '⇥' }], [{ label: '=/<', width: 1.5, level: 3 }], [{ label: 'ABC', width: 1.5, level: 0 }]],
    [[{ keyval: Clutter.KEY_Escape, label: "Esc" }], [{ keyval: Clutter.KEY_Tab, label: '⇥' }], [{ label: '?123', width: 1.5, level: 2 }], [{ label: 'ABC', width: 1.5, level: 0 }]],
];

const defaultKeysPost = [
    [[{ width: 1.5, keyval: Clutter.KEY_BackSpace, icon: 'edit-clear-symbolic' }, { action: 'hide', extraClassName: 'hide-key', icon: 'input-keyboard-symbolic' }],
     [{ width: 2, keyval: Clutter.KEY_Return, extraClassName: 'enter-key', icon: 'keyboard-enter-symbolic' }],
     [{ width: 1.5, level: 1, right: true, extraClassName: 'shift-key-lowercase', icon: 'keyboard-shift-filled-symbolic' }],
     [{ action: 'emoji', icon: 'face-smile-symbolic' },
         { keyval: Clutter.KEY_Left, action: 'left', label: '←'}, { keyval: Clutter.KEY_Up, label: '↑' },
         { keyval: Clutter.KEY_Down, action: 'left', label: '↓'}, { keyval: Clutter.KEY_Right, label: '→'}]],
    [[{ width: 1.5, keyval: Clutter.KEY_BackSpace, icon: 'edit-clear-symbolic' }, { action: 'hide', extraClassName: 'hide-key', icon: 'input-keyboard-symbolic' }],
     [{ width: 2, keyval: Clutter.KEY_Return, extraClassName: 'enter-key', icon: 'keyboard-enter-symbolic' }],
     [{ width: 1.5, level: 0, right: true, extraClassName: 'shift-key-uppercase', icon: 'keyboard-shift-filled-symbolic' }],
     [{ action: 'emoji', icon: 'face-smile-symbolic' },
         { keyval: Clutter.KEY_Left, action: 'left', label: '←'}, { keyval: Clutter.KEY_Up, label: '↑' },
         { keyval: Clutter.KEY_Down, action: 'left', label: '↓'}, { keyval: Clutter.KEY_Right, label: '→'}]],
    [[{ width: 1.5, keyval: Clutter.KEY_BackSpace, icon: 'edit-clear-symbolic' }, { action: 'hide', extraClassName: 'hide-key', icon: 'input-keyboard-symbolic' }],
     [{ width: 2, keyval: Clutter.KEY_Return, extraClassName: 'enter-key', icon: 'keyboard-enter-symbolic' }],
     [{ label: '=/<', width: 3, level: 3, right: true }],
     [{ action: 'emoji', icon: 'face-smile-symbolic' },
         { keyval: Clutter.KEY_Left, action: 'left', label: '←' }, { keyval: Clutter.KEY_Up, label: '↑' },
         { keyval: Clutter.KEY_Down, action: 'left', label: '↓' }, { keyval: Clutter.KEY_Right, label: '→' }]],
    [[{ width: 1.5, keyval: Clutter.KEY_BackSpace, icon: 'edit-clear-symbolic' }, { action: 'hide', extraClassName: 'hide-key', icon: 'input-keyboard-symbolic' }],
     [{ width: 2, keyval: Clutter.KEY_Return, extraClassName: 'enter-key', icon: 'keyboard-enter-symbolic' }],
     [{ label: '?123', width: 3, level: 2, right: true }],
     [{ action: 'emoji', icon: 'face-smile-symbolic' },
         { keyval: Clutter.KEY_Left, action: 'left', label: '←' }, { keyval: Clutter.KEY_Up, label: '↑' },
         { keyval: Clutter.KEY_Down, action: 'left', label: '↓' }, { keyval: Clutter.KEY_Right, label: '→' }]],
];

var AspectContainer = GObject.registerClass(
class AspectContainer extends St.Widget {
    _init(params) {
        super._init(params);
        this._ratio = 1;
    }

    setRatio(relWidth, relHeight) {
        this._ratio = relWidth / relHeight;
        this.queue_relayout();
    }

    vfunc_get_preferred_width(forHeight) {
        let [min, nat] = super.vfunc_get_preferred_width(forHeight);

        if (forHeight > 0)
            nat = forHeight * this._ratio;

        return [min, nat];
    }

    vfunc_get_preferred_height(forWidth) {
        let [min, nat] = super.vfunc_get_preferred_height(forWidth);

        if (forWidth > 0)
            nat = forWidth / this._ratio;

        return [min, nat];
    }

    vfunc_allocate(box, flags) {
        if (box.get_width() > 0 && box.get_height() > 0) {
            let sizeRatio = box.get_width() / box.get_height();

            if (sizeRatio >= this._ratio) {
                /* Restrict horizontally */
                let width = box.get_height() * this._ratio;
                let diff = box.get_width() - width;

                box.x1 += Math.floor(diff / 2);
                box.x2 -= Math.ceil(diff / 2);
            } else {
                /* Restrict vertically, align to bottom */
                let height = box.get_width() / this._ratio;
                box.y1 = box.y2 - Math.floor(height);
            }
        }

        super.vfunc_allocate(box, flags);
    }
});

var KeyContainer = GObject.registerClass(
class KeyContainer extends St.Widget {
    _init() {
        let gridLayout = new Clutter.GridLayout({ orientation: Clutter.Orientation.HORIZONTAL,
                                                  column_homogeneous: true,
                                                  row_homogeneous: true });
        super._init({
            layout_manager: gridLayout,
            x_expand: true,
            y_expand: true,
        });
        this._gridLayout = gridLayout;
        this._currentRow = 0;
        this._currentCol = 0;
        this._maxCols = 0;

        this._currentRow = null;
        this._rows = [];
    }

    appendRow() {
        this._currentRow++;
        this._currentCol = 0;

        let row = {
            keys: [],
            width: 0,
        };
        this._rows.push(row);
    }

    appendKey(key, width = 1, height = 1) {
        let keyInfo = {
            key,
            left: this._currentCol,
            top: this._currentRow,
            width,
            height,
        };

        let row = this._rows[this._rows.length - 1];
        row.keys.push(keyInfo);
        row.width += width;

        this._currentCol += width;
        this._maxCols = Math.max(this._currentCol, this._maxCols);
    }

    layoutButtons(container) {
        let nCol = 0, nRow = 0;

        for (let i = 0; i < this._rows.length; i++) {
            let row = this._rows[i];

            /* When starting a new row, see if we need some padding */
            if (nCol == 0) {
                let diff = this._maxCols - row.width;
                if (diff >= 1)
                    nCol = diff * KEY_SIZE / 2;
                else
                    nCol = diff * KEY_SIZE;
            }

            for (let j = 0; j < row.keys.length; j++) {
                let keyInfo = row.keys[j];
                let width = keyInfo.width * KEY_SIZE;
                let height = keyInfo.height * KEY_SIZE;

                this._gridLayout.attach(keyInfo.key, nCol, nRow, width, height);
                nCol += width;
            }

            nRow += KEY_SIZE;
            nCol = 0;
        }

        if (container)
            container.setRatio(this._maxCols, this._rows.length);
    }
});

var Suggestions = GObject.registerClass(
class Suggestions extends St.BoxLayout {
    _init() {
        super._init({
            style_class: 'word-suggestions',
            vertical: false,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this.show();
    }

    addNew(word, callback) {
        let button = new St.Button({ label: word });
        button.connect('clicked', callback);
        this.add(button);
    }

    clear() {
        this.remove_all_children();
    }
});

var LanguageSelectionPopup = class extends PopupMenu.PopupMenu {
    constructor(actor) {
        super(actor, St.Side.TOP);

        let inputSourceManager = KeyboardManager.getInputSourceManager();
        let inputSources = inputSourceManager.inputSources;

        let item;
        for (let i in inputSources) {
            let is = inputSources[i];

            item = this.addAction(is.displayName, () => {
                inputSourceManager.activateInputSource(is, true);
            });
            item.can_focus = false;
        }

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        item = this.addSettingsAction(_("Keyboard Settings"), 'keyboard');
        item.can_focus = false;

        this._capturedEventId = 0;

        this._unmapId = actor.connect('notify::mapped', () => {
            if (!actor.is_mapped())
                this.close(true);
        });
    }

    _onCapturedEvent(actor, event) {
        if (event.get_source() == this.actor ||
            this.actor.contains(event.get_source()))
            return Clutter.EVENT_PROPAGATE;

        if (event.type() == Clutter.EventType.BUTTON_RELEASE || event.type() == Clutter.EventType.TOUCH_END)
            this.close(true);

        return Clutter.EVENT_STOP;
    }

    open(animate) {
        super.open(animate);
        this._capturedEventId = global.stage.connect('captured-event',
                                                     this._onCapturedEvent.bind(this));
    }

    close(animate) {
        super.close(animate);
        if (this._capturedEventId != 0) {
            global.stage.disconnect(this._capturedEventId);
            this._capturedEventId = 0;
        }
    }

    destroy() {
        if (this._capturedEventId != 0)
            global.stage.disconnect(this._capturedEventId);
        if (this._unmapId != 0)
            this.sourceActor.disconnect(this._unmapId);
        super.destroy();
    }
};

var Key = GObject.registerClass({
    Signals: {
        'activated': {},
        'long-press': {},
        'pressed': { param_types: [GObject.TYPE_UINT, GObject.TYPE_STRING] },
        'released': { param_types: [GObject.TYPE_UINT, GObject.TYPE_STRING] },
    },
}, class Key extends St.BoxLayout {
    _init(key, extendedKeys, icon = null) {
        super._init({ style_class: 'key-container' });

        this.key = key || "";
        this.keyButton = this._makeKey(this.key, icon);

        /* Add the key in a container, so keys can be padded without losing
         * logical proportions between those.
         */
        this.add_child(this.keyButton);
        this.connect('destroy', this._onDestroy.bind(this));

        this._extendedKeys = extendedKeys;
        this._extendedKeyboard = null;
        this._pressTimeoutId = 0;
        this._capturedPress = false;

        this._capturedEventId = 0;
        this._unmapId = 0;
        this._longPress = false;
    }

    _onDestroy() {
        if (this._boxPointer) {
            this._boxPointer.destroy();
            this._boxPointer = null;
        }

        this.cancel();
    }

    _ensureExtendedKeysPopup() {
        if (this._extendedKeys.length === 0)
            return;

        if (this._boxPointer)
            return;

        this._boxPointer = new BoxPointer.BoxPointer(St.Side.BOTTOM);
        this._boxPointer.hide();
        Main.layoutManager.addChrome(this._boxPointer);
        this._boxPointer.setPosition(this.keyButton, 0.5);

        // Adds style to existing keyboard style to avoid repetition
        this._boxPointer.add_style_class_name('keyboard-subkeys');
        this._getExtendedKeys();
        this.keyButton._extendedKeys = this._extendedKeyboard;
    }

    _getKeyval(key) {
        let unicode = key.charCodeAt(0);
        return Clutter.unicode_to_keysym(unicode);
    }

    _press(key) {
        this.emit('activated');

        if (key !== this.key || this._extendedKeys.length === 0)
            this.emit('pressed', this._getKeyval(key), key);

        if (key == this.key) {
            this._pressTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
                KEY_LONG_PRESS_TIME,
                () => {
                    this._longPress = true;
                    this._pressTimeoutId = 0;

                    this.emit('long-press');

                    if (this._extendedKeys.length > 0) {
                        this._touchPressed = false;
                        this._ensureExtendedKeysPopup();
                        this.keyButton.set_hover(false);
                        this.keyButton.fake_release();
                        this._showSubkeys();
                    }

                    return GLib.SOURCE_REMOVE;
                });
        }
    }

    _release(key) {
        if (this._pressTimeoutId != 0) {
            GLib.source_remove(this._pressTimeoutId);
            this._pressTimeoutId = 0;
        }

        if (!this._longPress && key === this.key && this._extendedKeys.length > 0)
            this.emit('pressed', this._getKeyval(key), key);

        this.emit('released', this._getKeyval(key), key);
        this._hideSubkeys();
        this._longPress = false;
    }

    cancel() {
        if (this._pressTimeoutId != 0) {
            GLib.source_remove(this._pressTimeoutId);
            this._pressTimeoutId = 0;
        }
        this._touchPressed = false;
        this.keyButton.set_hover(false);
        this.keyButton.fake_release();
    }

    _onCapturedEvent(actor, event) {
        let type = event.type();
        let press = type == Clutter.EventType.BUTTON_PRESS || type == Clutter.EventType.TOUCH_BEGIN;
        let release = type == Clutter.EventType.BUTTON_RELEASE || type == Clutter.EventType.TOUCH_END;

        if (event.get_source() == this._boxPointer.bin ||
            this._boxPointer.bin.contains(event.get_source()))
            return Clutter.EVENT_PROPAGATE;

        if (press)
            this._capturedPress = true;
        else if (release && this._capturedPress)
            this._hideSubkeys();

        return Clutter.EVENT_STOP;
    }

    _showSubkeys() {
        this._boxPointer.open(BoxPointer.PopupAnimation.FULL);
        this._capturedEventId = global.stage.connect('captured-event',
                                                     this._onCapturedEvent.bind(this));
        this._unmapId = this.keyButton.connect('notify::mapped', () => {
            if (!this.keyButton.is_mapped())
                this._hideSubkeys();
        });
    }

    _hideSubkeys() {
        if (this._boxPointer)
            this._boxPointer.close(BoxPointer.PopupAnimation.FULL);
        if (this._capturedEventId) {
            global.stage.disconnect(this._capturedEventId);
            this._capturedEventId = 0;
        }
        if (this._unmapId) {
            this.keyButton.disconnect(this._unmapId);
            this._unmapId = 0;
        }
        this._capturedPress = false;
    }

    _makeKey(key, icon) {
        let button = new St.Button({
            style_class: 'keyboard-key',
            x_expand: true,
        });

        if (icon) {
            let child = new St.Icon({ icon_name: icon });
            button.set_child(child);
            this._icon = child;
        } else {
            let label = GLib.markup_escape_text(key, -1);
            button.set_label(label);
        }

        button.keyWidth = 1;
        button.connect('button-press-event', () => {
            this._press(key);
            return Clutter.EVENT_PROPAGATE;
        });
        button.connect('button-release-event', () => {
            this._release(key);
            return Clutter.EVENT_PROPAGATE;
        });
        button.connect('touch-event', (actor, event) => {
            // We only handle touch events here on wayland. On X11
            // we do get emulated pointer events, which already works
            // for single-touch cases. Besides, the X11 passive touch grab
            // set up by Mutter will make us see first the touch events
            // and later the pointer events, so it will look like two
            // unrelated series of events, we want to avoid double handling
            // in these cases.
            if (!Meta.is_wayland_compositor())
                return Clutter.EVENT_PROPAGATE;

            if (!this._touchPressed &&
                event.type() == Clutter.EventType.TOUCH_BEGIN) {
                this._touchPressed = true;
                this._press(key);
            } else if (this._touchPressed &&
                       event.type() == Clutter.EventType.TOUCH_END) {
                this._touchPressed = false;
                this._release(key);
            }
            return Clutter.EVENT_PROPAGATE;
        });

        return button;
    }

    _getExtendedKeys() {
        this._extendedKeyboard = new St.BoxLayout({
            style_class: 'key-container',
            vertical: false,
        });
        for (let i = 0; i < this._extendedKeys.length; ++i) {
            let extendedKey = this._extendedKeys[i];
            let key = this._makeKey(extendedKey);

            key.extendedKey = extendedKey;
            this._extendedKeyboard.add(key);

            key.set_size(...this.keyButton.allocation.get_size());
            this.keyButton.connect('notify::allocation',
                () => key.set_size(...this.keyButton.allocation.get_size()));
        }
        this._boxPointer.bin.add_actor(this._extendedKeyboard);
    }

    get subkeys() {
        return this._boxPointer;
    }

    setWidth(width) {
        this.keyButton.keyWidth = width;
    }

    setLatched(latched) {
        if (!this._icon)
            return;

        if (latched) {
            this.keyButton.add_style_pseudo_class('latched');
            this._icon.icon_name = 'keyboard-caps-lock-filled-symbolic';
        } else {
            this.keyButton.remove_style_pseudo_class('latched');
            this._icon.icon_name = 'keyboard-shift-filled-symbolic';
        }
    }
});

var KeyboardModel = class {
    constructor(groupName) {
        let names = [groupName];
        if (groupName.includes('+'))
            names.push(groupName.replace(/\+.*/, ''));
        names.push('us');

        for (let i = 0; i < names.length; i++) {
            try {
                this._model = this._loadModel(names[i]);
                break;
            } catch (e) {
            }
        }
    }

    _loadModel(groupName) {
        let file = Gio.File.new_for_uri('resource:///org/cinnamon/osk-layouts/%s.json'.format(groupName));
        let [success_, contents] = file.load_contents(null);
        if (contents instanceof Uint8Array)
            contents = imports.byteArray.toString(contents);

        return JSON.parse(contents);
    }

    getLevels() {
        return this._model.levels;
    }

    getKeysForLevel(levelName) {
        return this._model.levels.find(level => level == levelName);
    }
};

var FocusTracker = class {
    constructor() {
        this._currentWindow = null;
        this._rect = null;

        global.display.connect('notify::focus-window', () => {
            this._setCurrentWindow(global.display.focus_window);
            this.emit('window-changed', this._currentWindow);
        });

        global.display.connect('grab-op-begin', (display, window, op) => {
            if (window == this._currentWindow &&
                (op == Meta.GrabOp.MOVING || op == Meta.GrabOp.KEYBOARD_MOVING))
                this.emit('reset');
        });

        /* Valid for wayland clients */
        Main.inputMethod.connect('cursor-location-changed', (o, rect) => {
            let newRect = { x: rect.get_x(), y: rect.get_y(), width: rect.get_width(), height: rect.get_height() };
            this._setCurrentRect(newRect);
        });

        this._ibusManager = IBusManager.getIBusManager();
        this._ibusManager.connect('set-cursor-location', (manager, rect) => {
            /* Valid for X11 clients only */
            if (Main.inputMethod.currentFocus)
                return;

            this._setCurrentRect(rect);
        });
        this._ibusManager.connect('focus-in', () => {
            this.emit('focus-changed', true);
        });
        this._ibusManager.connect('focus-out', () => {
            this.emit('focus-changed', false);
        });
    }

    get currentWindow() {
        return this._currentWindow;
    }

    _setCurrentWindow(window) {
        this._currentWindow = window;
    }

    _setCurrentRect(rect) {
        if (this._currentWindow) {
            let frameRect = this._currentWindow.get_frame_rect();
            rect.x -= frameRect.x;
            rect.y -= frameRect.y;
        }

        if (this._rect &&
            this._rect.x == rect.x &&
            this._rect.y == rect.y &&
            this._rect.width == rect.width &&
            this._rect.height == rect.height)
            return;

        this._rect = rect;
        this.emit('position-changed');
    }

    getCurrentRect() {
        let rect = { x: this._rect.x, y: this._rect.y,
                     width: this._rect.width, height: this._rect.height };

        if (this._currentWindow) {
            let frameRect = this._currentWindow.get_frame_rect();
            rect.x += frameRect.x;
            rect.y += frameRect.y;
        }

        return rect;
    }
};
Signals.addSignalMethods(FocusTracker.prototype);

var EmojiPager = GObject.registerClass({
    Properties: {
        'delta': GObject.ParamSpec.int(
            'delta', 'delta', 'delta',
            GObject.ParamFlags.READWRITE,
            GLib.MININT32, GLib.MAXINT32, 0),
    },
    Signals: {
        'emoji': { param_types: [GObject.TYPE_STRING] },
        'page-changed': {
            param_types: [GObject.TYPE_INT, GObject.TYPE_INT, GObject.TYPE_INT],
        },
    },
}, class EmojiPager extends St.Widget {
    _init(sections, nCols, nRows) {
        super._init({
            layout_manager: new Clutter.BinLayout(),
            reactive: true,
            clip_to_allocation: true,
            y_expand: true,
        });
        this._sections = sections;
        this._nCols = nCols;
        this._nRows = nRows;

        this._pages = [];
        this._panel = null;
        this._curPage = null;
        this._followingPage = null;
        this._followingPanel = null;
        this._currentKey = null;
        this._delta = 0;
        this._width = null;

        this._initPagingInfo();

        let panAction = new Clutter.PanAction({ interpolate: false });
        panAction.connect('pan', this._onPan.bind(this));
        panAction.connect('gesture-begin', this._onPanBegin.bind(this));
        panAction.connect('gesture-cancel', this._onPanCancel.bind(this));
        panAction.connect('gesture-end', this._onPanEnd.bind(this));
        this._panAction = panAction;
        this.add_action(panAction);
    }

    get delta() {
        return this._delta;
    }

    set delta(value) {
        if (value > this._width)
            value = this._width;
        else if (value < -this._width)
            value = -this._width;

        if (this._delta == value)
            return;

        this._delta = value;
        this.notify('delta');

        if (value == 0)
            return;

        let relValue = Math.abs(value / this._width);
        let followingPage = this.getFollowingPage();

        if (this._followingPage != followingPage) {
            if (this._followingPanel) {
                this._followingPanel.destroy();
                this._followingPanel = null;
            }

            if (followingPage != null) {
                this._followingPanel = this._generatePanel(followingPage);
                this._followingPanel.set_pivot_point(0.5, 0.5);
                this.add_child(this._followingPanel);
                this.set_child_below_sibling(this._followingPanel, this._panel);
            }

            this._followingPage = followingPage;
        }

        this._panel.translation_x = value;
        this._panel.opacity = 255 * (1 - Math.pow(relValue, 3));

        if (this._followingPanel) {
            this._followingPanel.scale_x = 0.8 + (0.2 * relValue);
            this._followingPanel.scale_y = 0.8 + (0.2 * relValue);
            this._followingPanel.opacity = 255 * relValue;
        }
    }

    _prevPage(nPage) {
        return (nPage + this._pages.length - 1) % this._pages.length;
    }

    _nextPage(nPage) {
        return (nPage + 1) % this._pages.length;
    }

    getFollowingPage() {
        if (this.delta == 0)
            return null;

        if ((this.delta < 0 && global.stage.text_direction == Clutter.TextDirection.LTR) ||
            (this.delta > 0 && global.stage.text_direction == Clutter.TextDirection.RTL))
            return this._nextPage(this._curPage);
        else
            return this._prevPage(this._curPage);
    }

    _onPan(action) {
        let [dist_, dx, dy_] = action.get_motion_delta(0);
        this.delta = this.delta + dx;

        if (this._currentKey != null) {
            this._currentKey.cancel();
            this._currentKey = null;
        }

        return false;
    }

    _onPanBegin() {
        this._width = this.width;
        return true;
    }

    _onPanEnd() {
        if (Math.abs(this._delta) < this.width * PANEL_SWITCH_RELATIVE_DISTANCE) {
            this._onPanCancel();
        } else {
            let value;
            if (this._delta > 0)
                value = this._width;
            else if (this._delta < 0)
                value = -this._width;

            let relDelta = Math.abs(this._delta - value) / this._width;
            let time = PANEL_SWITCH_ANIMATION_TIME * Math.abs(relDelta);

            this.remove_all_transitions();
            this.ease_property('delta', value, {
                duration: time,
                onComplete: () => {
                    this.setCurrentPage(this.getFollowingPage());
                },
            });
        }
    }

    _onPanCancel() {
        let relDelta = Math.abs(this._delta) / this.width;
        let time = PANEL_SWITCH_ANIMATION_TIME * Math.abs(relDelta);

        this.remove_all_transitions();
        this.ease_property('delta', 0, {
            duration: time,
        });
    }

    _initPagingInfo() {
        for (let i = 0; i < this._sections.length; i++) {
            let section = this._sections[i];
            let itemsPerPage = this._nCols * this._nRows;
            let nPages = Math.ceil(section.keys.length / itemsPerPage);
            let page = -1;
            let pageKeys;

            for (let j = 0; j < section.keys.length; j++) {
                if (j % itemsPerPage == 0) {
                    page++;
                    pageKeys = [];
                    this._pages.push({ pageKeys, nPages, page, section: this._sections[i] });
                }

                pageKeys.push(section.keys[j]);
            }
        }
    }

    _lookupSection(section, nPage) {
        for (let i = 0; i < this._pages.length; i++) {
            let page = this._pages[i];

            if (page.section == section && page.page == nPage)
                return i;
        }

        return -1;
    }

    _generatePanel(nPage) {
        let gridLayout = new Clutter.GridLayout({ orientation: Clutter.Orientation.HORIZONTAL,
                                                  column_homogeneous: true,
                                                  row_homogeneous: true });
        let panel = new St.Widget({ layout_manager: gridLayout,
                                    style_class: 'emoji-page',
                                    x_expand: true,
                                    y_expand: true });

        /* Set an expander actor so all proportions are right despite the panel
         * not having all rows/cols filled in.
         */
        let expander = new Clutter.Actor();
        gridLayout.attach(expander, 0, 0, this._nCols, this._nRows);

        let page = this._pages[nPage];
        let col = 0;
        let row = 0;

        for (let i = 0; i < page.pageKeys.length; i++) {
            let modelKey = page.pageKeys[i];
            let key = new Key(modelKey.label, modelKey.variants);

            key.keyButton.set_button_mask(0);

            key.connect('activated', () => {
                this._currentKey = key;
            });
            key.connect('long-press', () => {
                this._panAction.cancel();
            });
            key.connect('released', (actor, keyval, str) => {
                if (this._currentKey != key)
                    return;
                this._currentKey = null;
                this.emit('emoji', str);
            });

            gridLayout.attach(key, col, row, 1, 1);

            col++;
            if (col >= this._nCols) {
                col = 0;
                row++;
            }
        }

        return panel;
    }

    setCurrentPage(nPage) {
        if (this._curPage == nPage)
            return;

        this._curPage = nPage;

        if (this._panel) {
            this._panel.destroy();
            this._panel = null;
        }

        /* Reuse followingPage if possible */
        if (nPage == this._followingPage) {
            this._panel = this._followingPanel;
            this._followingPanel = null;
        }

        if (this._followingPanel)
            this._followingPanel.destroy();

        this._followingPanel = null;
        this._followingPage = null;
        this._delta = 0;

        if (!this._panel) {
            this._panel = this._generatePanel(nPage);
            this.add_child(this._panel);
        }

        let page = this._pages[nPage];
        this.emit('page-changed', page.section.label, page.page, page.nPages);
    }

    setCurrentSection(section, nPage) {
        for (let i = 0; i < this._pages.length; i++) {
            let page = this._pages[i];

            if (page.section == section && page.page == nPage) {
                this.setCurrentPage(i);
                break;
            }
        }
    }
});

var EmojiSelection = GObject.registerClass({
    Signals: {
        'emoji-selected': { param_types: [GObject.TYPE_STRING] },
        'close-request': {},
        'toggle': {},
    },
}, class EmojiSelection extends St.BoxLayout {
    _init() {
        super._init({
            style_class: 'emoji-panel',
            x_expand: true,
            y_expand: true,
            vertical: true,
        });

        this._sections = [
            { first: 'grinning face', label: '🙂️' },
            { first: 'selfie', label: '👍️' },
            { first: 'monkey face', label: '🌷️' },
            { first: 'grapes', label: '🍴️' },
            { first: 'globe showing Europe-Africa', label: '✈️' },
            { first: 'jack-o-lantern', label: '🏃️' },
            { first: 'muted speaker', label: '🔔️' },
            { first: 'ATM sign', label: '❤️' },
            { first: 'chequered flag', label: '🚩️' },
        ];

        this._populateSections();

        this._emojiPager = new EmojiPager(this._sections, 11, 3);
        this._emojiPager.connect('page-changed', (pager, sectionLabel, page, nPages) => {
            this._onPageChanged(sectionLabel, page, nPages);
        });
        this._emojiPager.connect('emoji', (pager, str) => {
            this.emit('emoji-selected', str);
        });
        this.add_child(this._emojiPager);

        this._pageIndicator = new PageIndicators.PageIndicators(
            Clutter.Orientation.HORIZONTAL
        );
        this.add_child(this._pageIndicator);
        this._pageIndicator.setReactive(false);

        this._emojiPager.connect('notify::delta', () => {
            this._updateIndicatorPosition();
        });

        let bottomRow = this._createBottomRow();
        this.add_child(bottomRow);

        this._curPage = 0;
    }

    vfunc_map() {
        this._emojiPager.setCurrentPage(0);
        super.vfunc_map();
    }

    _onPageChanged(sectionLabel, page, nPages) {
        this._curPage = page;
        this._pageIndicator.setNPages(nPages);
        this._updateIndicatorPosition();

        for (let i = 0; i < this._sections.length; i++) {
            let sect = this._sections[i];
            sect.button.setLatched(sectionLabel == sect.label);
        }
    }

    _updateIndicatorPosition() {
        this._pageIndicator.setCurrentPosition(this._curPage -
            this._emojiPager.delta / this._emojiPager.width);
    }

    _findSection(emoji) {
        for (let i = 0; i < this._sections.length; i++) {
            if (this._sections[i].first == emoji)
                return this._sections[i];
        }

        return null;
    }

    _populateSections() {
        let file = Gio.File.new_for_uri('resource:///org/cinnamon/osk-layouts/emoji.json');
        let [success_, contents] = file.load_contents(null);

        if (contents instanceof Uint8Array)
            contents = imports.byteArray.toString(contents);
        let emoji = JSON.parse(contents);

        let variants = [];
        let currentKey = 0;
        let currentSection = null;

        for (let i = 0; i < emoji.length; i++) {
            /* Group variants of a same emoji so they appear on the key popover */
            if (emoji[i].name.startsWith(emoji[currentKey].name)) {
                variants.push(emoji[i].char);
                if (i < emoji.length - 1)
                    continue;
            }

            let newSection = this._findSection(emoji[currentKey].name);
            if (newSection != null) {
                currentSection = newSection;
                currentSection.keys = [];
            }

            /* Create the key */
            let label = emoji[currentKey].char + String.fromCharCode(0xFE0F);
            currentSection.keys.push({ label, variants });
            currentKey = i;
            variants = [];
        }
    }

    _createBottomRow() {
        let row = new KeyContainer();
        let key;

        row.appendRow();

        key = new Key('ABC', []);
        key.keyButton.add_style_class_name('default-key');
        key.connect('released', () => this.emit('toggle'));
        row.appendKey(key, 1.5);

        for (let i = 0; i < this._sections.length; i++) {
            let section = this._sections[i];

            key = new Key(section.label, []);
            key.connect('released', () => this._emojiPager.setCurrentSection(section, 0));
            row.appendKey(key);

            section.button = key;
        }

        key = new Key(null, [], 'go-down-symbolic');
        key.keyButton.add_style_class_name('default-key');
        key.keyButton.add_style_class_name('hide-key');
        key.connect('released', () => {
            this.emit('close-request');
        });
        row.appendKey(key);
        row.layoutButtons();

        let actor = new AspectContainer({ layout_manager: new Clutter.BinLayout(),
                                          x_expand: true, y_expand: true });
        actor.add_child(row);
        /* Regular keyboard layouts are 11.5×4 grids, optimize for that
         * at the moment. Ideally this should be as wide as the current
         * keymap.
         */
        actor.setRatio(11.5, 1);

        return actor;
    }
});

var Keypad = GObject.registerClass({
    Signals: {
        'keyval': { param_types: [GObject.TYPE_UINT] },
    },
}, class Keypad extends AspectContainer {
    _init() {
        let keys = [
            { label: '1', keyval: Clutter.KEY_1, left: 0, top: 0 },
            { label: '2', keyval: Clutter.KEY_2, left: 1, top: 0 },
            { label: '3', keyval: Clutter.KEY_3, left: 2, top: 0 },
            { label: '4', keyval: Clutter.KEY_4, left: 0, top: 1 },
            { label: '5', keyval: Clutter.KEY_5, left: 1, top: 1 },
            { label: '6', keyval: Clutter.KEY_6, left: 2, top: 1 },
            { label: '7', keyval: Clutter.KEY_7, left: 0, top: 2 },
            { label: '8', keyval: Clutter.KEY_8, left: 1, top: 2 },
            { label: '9', keyval: Clutter.KEY_9, left: 2, top: 2 },
            { label: '0', keyval: Clutter.KEY_0, left: 1, top: 3 },
            { keyval: Clutter.KEY_BackSpace, icon: 'edit-clear-symbolic', left: 3, top: 0 },
            { keyval: Clutter.KEY_Return, extraClassName: 'enter-key', icon: 'keyboard-enter-symbolic', left: 3, top: 1, height: 2 },
        ];

        super._init({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
        });

        let gridLayout = new Clutter.GridLayout({ orientation: Clutter.Orientation.HORIZONTAL,
                                                  column_homogeneous: true,
                                                  row_homogeneous: true });
        this._box = new St.Widget({ layout_manager: gridLayout, x_expand: true, y_expand: true });
        this.add_child(this._box);

        for (let i = 0; i < keys.length; i++) {
            let cur = keys[i];
            let key = new Key(cur.label || "", [], cur.icon);

            if (keys[i].extraClassName)
                key.keyButton.add_style_class_name(cur.extraClassName);

            let w, h;
            w = cur.width || 1;
            h = cur.height || 1;
            gridLayout.attach(key, cur.left, cur.top, w, h);

            key.connect('released', () => {
                this.emit('keyval', cur.keyval);
            });
        }
    }
});

var VirtualKeyboardManager = class VirtualKeyBoardManager {
    constructor() {
        this._keyboard = null;
        this._a11yApplicationsSettings = new Gio.Settings({ schema_id: A11Y_APPLICATIONS_SCHEMA });
        this._a11yApplicationsSettings.connect('changed', this._syncEnabled.bind(this));

        this._keyboardSettings = new Gio.Settings({ schema_id: OSK_SETTINGS });
        this._keyboardSettings.connect('changed', this._keyboardSettingsChanged.bind(this));

        this._seat = Clutter.get_default_backend().get_default_seat();
        this._seat.connect('notify::touch-mode', this._syncEnabled.bind(this));

        this._lastDevice = null;
        Meta.get_backend().connect('last-device-changed', (backend, device) => {
            if (device.device_type === Clutter.InputDeviceType.KEYBOARD_DEVICE)
                return;

            this._lastDevice = device;
            this._syncEnabled();
        });
        this._syncEnabled();
    }

    _lastDeviceIsTouchscreen() {
        if (!this._lastDevice)
            return false;

        let deviceType = this._lastDevice.get_device_type();
        return deviceType == Clutter.InputDeviceType.TOUCHSCREEN_DEVICE;
    }

    _keyboardSettingsChanged() {
        this._destroyKeyboard();

        this._syncEnabled();
    }

    _syncEnabled() {
        let enableKeyboard = this._a11yApplicationsSettings.get_boolean(SHOW_KEYBOARD_KEY);
        let autoEnabled = this._seat.get_touch_mode() && this._lastDeviceIsTouchscreen();
        let enabled = enableKeyboard || autoEnabled;

        if (!enabled && !this._keyboard)
            return;

        if (enabled && !this._keyboard) {
            this._keyboard = new Keyboard(this._keyboardSettings);
        } else if (!enabled && this._keyboard) {
            this._destroyKeyboard();
        }
    }

    _destroyKeyboard() {
        if (this._keyboard == null) {
            return;
        }
        this._keyboard.setCursorLocation(null);
        this._keyboard.destroy();
        this._keyboard = null;
        Main.layoutManager.hideKeyboard(true);
    }

    getKeyboardSize() {
        return this._keyboardSettings.get_int(KEYBOARD_SIZE_KEY);
    }

    getKeyboardPosition() {
        return this._keyboardSettings.get_string(KEYBOARD_POSITION_KEY);
    }

    get keyboardActor() {
        return this._keyboard;
    }

    get visible() {
        return this._keyboard && this._keyboard.visible;
    }

    get enabled() {
        return !!this._keyboard;
    }

    manualToggle() {
        if (this.visible) {
            this.close();
        } else {
            this._a11yApplicationsSettings.set_boolean(SHOW_KEYBOARD_KEY, true);
            this.open(Main.layoutManager.focusIndex);
        }
    }

    open(monitor) {
        if (this._keyboard)
            this._keyboard.open(monitor);
    }

    close() {
        if (this._keyboard)
            this._keyboard.close();
    }

    addSuggestion(text, callback) {
        if (this._keyboard)
            this._keyboard.addSuggestion(text, callback);
    }

    resetSuggestions() {
        if (this._keyboard)
            this._keyboard.resetSuggestions();
    }

    shouldTakeEvent(event) {
        if (!this._keyboard)
            return false;

        let actor = event.get_source();
        return Main.layoutManager.keyboardBox.contains(actor) ||
               !!actor._extendedKeys || !!actor.extendedKey;
    }
};

var Keyboard = GObject.registerClass(
class Keyboard extends St.BoxLayout {
    _init(kbSettings) {
        super._init({ name: 'keyboard', vertical: true });
        this._focusInExtendedKeys = false;
        this._emojiActive = false;

        this._languagePopup = null;
        this._currentFocusWindow = null;
        this._animFocusedWindow = null;
        this._delayedAnimFocusWindow = null;

        this._latched = false; // current level is latched

        this._suggestions = null;
        this._emojiKeyVisible = Meta.is_wayland_compositor();

        if (kbSettings.get_string(ACTIVATION_MODE_KEY) === "accessible") {
            this._focusTracker = new FocusTracker();
            this._connectSignal(this._focusTracker, 'position-changed',
                this._onFocusPositionChanged.bind(this));
            this._connectSignal(this._focusTracker, 'reset', () => {
                this._delayedAnimFocusWindow = null;
                this._animFocusedWindow = null;
                this._oskFocusWindow = null;
            });
            // Valid only for X11
            if (!Meta.is_wayland_compositor()) {
                this._connectSignal(this._focusTracker, 'focus-changed', (_tracker, focused) => {
                    if (focused)
                        this.open(Main.layoutManager.focusIndex);
                    else
                        this.close();
                });
            }
        }

        this._showIdleId = 0;

        this._keyboardVisible = false;
        this._connectSignal(Main.layoutManager, 'keyboard-visible-changed', (_lm, visible) => {
            this._keyboardVisible = visible;
        });
        this._keyboardRequested = false;
        this._keyboardRestingId = 0;

        this._connectSignal(Main.layoutManager, 'monitors-changed', this._relayout.bind(this));

        this._setupKeyboard();

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _connectSignal(obj, signal, callback) {
        if (!this._connectionsIDs)
            this._connectionsIDs = [];

        let id = obj.connect(signal, callback);
        this._connectionsIDs.push([obj, id]);
        return id;
    }

    get visible() {
        return this._keyboardVisible && super.visible;
    }

    set visible(visible) {
        super.visible = visible;
    }

    _onFocusPositionChanged(focusTracker) {
        let rect = focusTracker.getCurrentRect();
        this.setCursorLocation(focusTracker.currentWindow, rect.x, rect.y, rect.width, rect.height);
    }

    _onDestroy() {
        for (let [obj, id] of this._connectionsIDs)
            obj.disconnect(id);
        delete this._connectionsIDs;

        this._clearShowIdle();

        this._keyboardController.destroy();

        Main.layoutManager.untrackChrome(this);
        Main.layoutManager.keyboardBox.remove_actor(this);

        if (this._languagePopup) {
            this._languagePopup.destroy();
            this._languagePopup = null;
        }
    }

    _setupKeyboard() {
        Main.layoutManager.keyboardBox.add_actor(this);
        Main.layoutManager.trackChrome(this);

        this._keyboardController = new KeyboardController();

        this._groups = {};
        this._currentPage = null;

        if (this._keyboardController.getIbusInputActive()) {
            this._suggestions = new Suggestions();
            this.add_child(this._suggestions);
        }

        this._aspectContainer = new AspectContainer({
            layout_manager: new Clutter.BinLayout(),
            y_expand: true,
        });
        this.add_child(this._aspectContainer);

        this._emojiSelection = new EmojiSelection();
        this._emojiSelection.connect('toggle', this._toggleEmoji.bind(this));
        this._emojiSelection.connect('close-request', () => this.close());
        this._emojiSelection.connect('emoji-selected', (selection, emoji) => {
            this._keyboardController.commitString(emoji);
        });

        this._aspectContainer.add_child(this._emojiSelection);
        this._emojiSelection.hide();

        this._keypad = new Keypad();
        this._connectSignal(this._keypad, 'keyval', (_keypad, keyval) => {
            this._keyboardController.keyvalPress(keyval);
            this._keyboardController.keyvalRelease(keyval);
        });
        this._aspectContainer.add_child(this._keypad);
        this._keypad.hide();
        this._keypadVisible = false;

        this._ensureKeysForGroup(this._keyboardController.getCurrentGroup());
        this._setActiveLayer(0);

        // Keyboard models are defined in LTR, we must override
        // the locale setting in order to avoid flipping the
        // keyboard on RTL locales.
        this.text_direction = Clutter.TextDirection.LTR;

        this._connectSignal(this._keyboardController, 'active-group',
            this._onGroupChanged.bind(this));
        this._connectSignal(this._keyboardController, 'groups-changed',
            this._onKeyboardGroupsChanged.bind(this));
        this._connectSignal(this._keyboardController, 'panel-state',
            this._onKeyboardStateChanged.bind(this));
        this._connectSignal(this._keyboardController, 'keypad-visible',
            this._onKeypadVisible.bind(this));
        this._connectSignal(global.stage, 'notify::key-focus',
            this._onKeyFocusChanged.bind(this));

        if (Meta.is_wayland_compositor()) {
            this._connectSignal(this._keyboardController, 'emoji-visible',
                this._onEmojiKeyVisible.bind(this));
        }

        this._relayout();
    }

    _onKeyFocusChanged() {
        let focus = global.stage.key_focus;

        // Showing an extended key popup and clicking a key from the extended keys
        // will grab focus, but ignore that
        let extendedKeysWereFocused = this._focusInExtendedKeys;
        this._focusInExtendedKeys = focus && (focus._extendedKeys || focus.extendedKey);
        if (this._focusInExtendedKeys || extendedKeysWereFocused)
            return;

        if (!(focus instanceof Clutter.Text)) {
            this.close();
            return;
        }

        if (!this._showIdleId) {
            this._showIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                this.open(Main.layoutManager.focusIndex);
                this._showIdleId = 0;
                return GLib.SOURCE_REMOVE;
            });
            GLib.Source.set_name_by_id(this._showIdleId, '[cinnamon] this.open');
        }
    }

    _createLayersForGroup(groupName) {
        let keyboardModel = new KeyboardModel(groupName);
        let layers = {};
        let levels = keyboardModel.getLevels();
        for (let i = 0; i < levels.length; i++) {
            let currentLevel = levels[i];
            /* There are keyboard maps which consist of 3 levels (no uppercase,
             * basically). We however make things consistent by skipping that
             * second level.
             */
            let level = i >= 1 && levels.length == 3 ? i + 1 : i;

            let layout = new KeyContainer();
            layout.shiftKeys = [];

            this._loadRows(currentLevel, level, levels.length, layout);
            layers[level] = layout;
            this._aspectContainer.add_child(layout);
            layout.layoutButtons(this._aspectContainer);

            layout.hide();
        }

        return layers;
    }

    _ensureKeysForGroup(group) {
        if (!this._groups[group])
            this._groups[group] = this._createLayersForGroup(group);
    }

    _addRowKeys(keys, layout) {
        for (let i = 0; i < keys.length; ++i) {
            let key = keys[i];
            let button = new Key(key.shift(), key);

            /* Space key gets special width, dependent on the number of surrounding keys */
            if (button.key == ' ')
                button.setWidth(keys.length <= 3 ? 6 : 5);

            button.connect('pressed', (actor, keyval, str) => {
                if (!Main.inputMethod.currentFocus ||
                    !this._keyboardController.commitString(str, true)) {
                    if (keyval != 0) {
                        this._keyboardController.keyvalPress(keyval);
                        button._keyvalPress = true;
                    }
                }
            });
            button.connect('released', (actor, keyval, _str) => {
                if (keyval != 0) {
                    if (button._keyvalPress)
                        this._keyboardController.keyvalRelease(keyval);
                    button._keyvalPress = false;
                }

                if (!this._latched)
                    this._setActiveLayer(0);
            });

            layout.appendKey(button, button.keyButton.keyWidth);
        }
    }

    _popupLanguageMenu(keyActor) {
        if (this._languagePopup)
            this._languagePopup.destroy();

        this._languagePopup = new LanguageSelectionPopup(keyActor);
        Main.layoutManager.addChrome(this._languagePopup.actor);
        this._languagePopup.open(true);
    }

    _loadDefaultKeys(keys, layout, numLevels, numKeys) {
        let extraButton;
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let keyval = key.keyval;
            let switchToLevel = key.level;
            let action = key.action;
            let icon = key.icon;

            /* Skip emoji button if necessary */
            if (!this._emojiKeyVisible && action == 'emoji')
                continue;

            extraButton = new Key(key.label || '', [], icon);

            extraButton.keyButton.add_style_class_name('default-key');
            if (key.extraClassName != null)
                extraButton.keyButton.add_style_class_name(key.extraClassName);
            if (key.width != null)
                extraButton.setWidth(key.width);

            let actor = extraButton.keyButton;

            extraButton.connect('pressed', () => {
                if (switchToLevel != null) {
                    this._setActiveLayer(switchToLevel);
                    // Shift only gets latched on long press
                    this._latched = switchToLevel != 1;
                } else if (keyval != null) {
                    this._keyboardController.keyvalPress(keyval);
                }
            });
            extraButton.connect('released', () => {
                if (keyval != null)
                    this._keyboardController.keyvalRelease(keyval);
                else if (action == 'hide')
                    this.close();
                else if (action == 'languageMenu')
                    this._popupLanguageMenu(actor);
                else if (action == 'emoji')
                    this._toggleEmoji();
            });

            if (switchToLevel == 0) {
                layout.shiftKeys.push(extraButton);
            } else if (switchToLevel == 1) {
                extraButton.connect('long-press', () => {
                    this._latched = true;
                    this._setCurrentLevelLatched(this._currentPage, this._latched);
                });
            }

            /* Fixup default keys based on the number of levels/keys */
            if (switchToLevel == 1 && numLevels == 3) {
                // Hide shift key if the keymap has no uppercase level
                if (key.right) {
                    /* Only hide the key actor, so the container still takes space */
                    extraButton.keyButton.hide();
                } else {
                    extraButton.hide();
                }
                extraButton.setWidth(1.5);
            } else if (key.right && numKeys > 8) {
                extraButton.setWidth(2);
            } else if (keyval == Clutter.KEY_Return && numKeys > 9) {
                extraButton.setWidth(1.5);
            } else if (!this._emojiKeyVisible && (action == 'hide' || action == 'languageMenu')) {
                extraButton.setWidth(1.5);
            }

            layout.appendKey(extraButton, extraButton.keyButton.keyWidth);
        }
    }

    _updateCurrentPageVisible() {
        if (this._currentPage)
            this._currentPage.visible = !this._emojiActive && !this._keypadVisible;
    }

    _setEmojiActive(active) {
        this._emojiActive = active;
        this._emojiSelection.visible = this._emojiActive;
        this._updateCurrentPageVisible();
    }

    _toggleEmoji() {
        this._setEmojiActive(!this._emojiActive);
    }

    _setCurrentLevelLatched(layout, latched) {
        for (let i = 0; i < layout.shiftKeys.length; i++) {
            let key = layout.shiftKeys[i];
            key.setLatched(latched);
        }
    }

    _getDefaultKeysForRow(row, numRows, level) {
        /* The first 2 rows in defaultKeysPre/Post belong together with
         * the first 2 rows on each keymap. On keymaps that have more than
         * 4 rows, the last 2 default key rows must be respectively
         * assigned to the 2 last keymap ones.
         */
        if (row < 2) {
            return [defaultKeysPre[level][row], defaultKeysPost[level][row]];
        } else if (row >= numRows - 2) {
            let defaultRow = row - (numRows - 2) + 2;
            return [defaultKeysPre[level][defaultRow], defaultKeysPost[level][defaultRow]];
        } else {
            return [null, null];
        }
    }

    _mergeRowKeys(layout, pre, row, post, numLevels) {
        if (pre != null)
            this._loadDefaultKeys(pre, layout, numLevels, row.length);

        this._addRowKeys(row, layout);

        if (post != null)
            this._loadDefaultKeys(post, layout, numLevels, row.length);
    }

    _loadRows(model, level, numLevels, layout) {
        let rows = model.rows;
        for (let i = 0; i < rows.length; ++i) {
            layout.appendRow();
            let [pre, post] = this._getDefaultKeysForRow(i, rows.length, level);
            this._mergeRowKeys(layout, pre, rows[i], post, numLevels);
        }
    }

    _getGridSlots() {
        let numOfHorizSlots = 0, numOfVertSlots;
        let rows = this._currentPage.get_children();
        numOfVertSlots = rows.length;

        for (let i = 0; i < rows.length; ++i) {
            let keyboardRow = rows[i];
            let keys = keyboardRow.get_children();

            numOfHorizSlots = Math.max(numOfHorizSlots, keys.length);
        }

        return [numOfHorizSlots, numOfVertSlots];
    }

    _relayout() {
        let monitor = Main.layoutManager.keyboardMonitor;

        if (!monitor)
            return;

        let maxHeight = monitor.height / 3;
        this.width = monitor.width;

        if (monitor.width > monitor.height) {
            this.height = maxHeight;
        } else {
            /* In portrait mode, lack of horizontal space means we won't be
             * able to make the OSK that big while keeping size ratio, so
             * we allow the OSK being smaller than 1/3rd of the monitor height
             * there.
             */
            const forWidth = this.get_theme_node().adjust_for_width(monitor.width);
            const [, natHeight] = this.get_preferred_height(forWidth);
            this.height = Math.min(maxHeight, natHeight);
        }
    }

    _onGroupChanged() {
        this._ensureKeysForGroup(this._keyboardController.getCurrentGroup());
        this._setActiveLayer(0);
    }

    _onKeyboardGroupsChanged() {
        let nonGroupActors = [this._emojiSelection, this._keypad];
        this._aspectContainer.get_children().filter(c => !nonGroupActors.includes(c)).forEach(c => {
            c.destroy();
        });

        this._groups = {};
        this._onGroupChanged();
    }

    _onKeypadVisible(controller, visible) {
        if (visible == this._keypadVisible)
            return;

        this._keypadVisible = visible;
        this._keypad.visible = this._keypadVisible;
        this._updateCurrentPageVisible();
    }

    _onEmojiKeyVisible(controller, visible) {
        if (visible == this._emojiKeyVisible)
            return;

        this._emojiKeyVisible = visible;
        /* Rebuild keyboard widgetry to include emoji button */
        this._onKeyboardGroupsChanged();
    }

    _onKeyboardStateChanged(controller, state) {
        let enabled;
        if (state == Clutter.InputPanelState.OFF)
            enabled = false;
        else if (state == Clutter.InputPanelState.ON)
            enabled = true;
        else if (state == Clutter.InputPanelState.TOGGLE)
            enabled = this._keyboardVisible == false;
        else
            return;

        if (enabled)
            this.open(Main.layoutManager.focusIndex);
        else
            this.close();
    }

    _setActiveLayer(activeLevel) {
        let activeGroupName = this._keyboardController.getCurrentGroup();
        let layers = this._groups[activeGroupName];
        let currentPage = layers[activeLevel];

        if (this._currentPage == currentPage) {
            this._updateCurrentPageVisible();
            return;
        }

        if (this._currentPage != null) {
            this._setCurrentLevelLatched(this._currentPage, false);
            this._currentPage.disconnect(this._currentPage._destroyID);
            this._currentPage.hide();
            delete this._currentPage._destroyID;
        }

        this._currentPage = currentPage;
        this._currentPage._destroyID = this._currentPage.connect('destroy', () => {
            this._currentPage = null;
        });
        this._updateCurrentPageVisible();
    }

    _clearKeyboardRestTimer() {
        if (!this._keyboardRestingId)
            return;
        GLib.source_remove(this._keyboardRestingId);
        this._keyboardRestingId = 0;
    }

    open(monitor) {
        this._clearShowIdle();
        this._keyboardRequested = true;

        if (this._keyboardVisible) {
            if (monitor != Main.layoutManager.keyboardIndex) {
                Main.layoutManager.keyboardIndex = monitor;
                this._relayout();
            }
            return;
        }

        this._clearKeyboardRestTimer();
        this._keyboardRestingId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            KEYBOARD_REST_TIME,
            () => {
                this._clearKeyboardRestTimer();
                this._open(monitor);
                return GLib.SOURCE_REMOVE;
            });
        GLib.Source.set_name_by_id(this._keyboardRestingId, '[cinnamon] this._clearKeyboardRestTimer');
    }

    _open(monitor) {
        if (!this._keyboardRequested)
            return;

        Main.layoutManager.keyboardIndex = monitor;
        this._relayout();
        Main.layoutManager.showKeyboard();

        this._setEmojiActive(false);

        if (this._delayedAnimFocusWindow) {
            this._setAnimationWindow(this._delayedAnimFocusWindow);
            this._delayedAnimFocusWindow = null;
        }
    }

    close() {
        this._clearShowIdle();
        this._keyboardRequested = false;

        if (!this._keyboardVisible)
            return;

        this._clearKeyboardRestTimer();
        this._keyboardRestingId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
            KEYBOARD_REST_TIME,
            () => {
                this._clearKeyboardRestTimer();
                this._close();
                return GLib.SOURCE_REMOVE;
            });
        GLib.Source.set_name_by_id(this._keyboardRestingId, '[cinnamon] this._clearKeyboardRestTimer');
    }

    _close() {
        if (this._keyboardRequested)
            return;
        Main.layoutManager.hideKeyboard();
        this.setCursorLocation(null);
    }

    resetSuggestions() {
        if (this._suggestions)
            this._suggestions.clear();
    }

    addSuggestion(text, callback) {
        if (!this._suggestions)
            return;

        this._suggestions.addNew(text, callback);
        this._suggestions.show();
    }

    _clearShowIdle() {
        if (!this._showIdleId)
            return;
        GLib.source_remove(this._showIdleId);
        this._showIdleId = 0;
    }

    _windowSlideAnimationComplete(window, delta) {
        // Synchronize window positions again.
        let frameRect = window.get_frame_rect();
        frameRect.y += delta;
        window.move_frame(true, frameRect.x, frameRect.y);
    }

    _animateWindow(window, show) {
        let windowActor = window.get_compositor_private();
        let deltaY = Main.layoutManager.keyboardBox.height;
        if (!windowActor)
            return;

        if (show) {
            windowActor.ease({
                y: windowActor.y - deltaY,
                duration: Layout.KEYBOARD_ANIMATION_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    this._windowSlideAnimationComplete(window, -deltaY);
                },
            });
        } else {
            windowActor.ease({
                y: windowActor.y + deltaY,
                duration: Layout.KEYBOARD_ANIMATION_TIME,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onComplete: () => {
                    this._windowSlideAnimationComplete(window, deltaY);
                },
            });
        }
    }

    _setAnimationWindow(window) {
        if (this._animFocusedWindow == window)
            return;

        if (this._animFocusedWindow)
            this._animateWindow(this._animFocusedWindow, false);
        if (window)
            this._animateWindow(window, true);

        this._animFocusedWindow = window;
    }

    setCursorLocation(window, x, y, w, h) {
        let monitor = Main.layoutManager.keyboardMonitor;

        if (window && monitor) {
            let keyboardHeight = Main.layoutManager.keyboardBox.height;

            if (y + h >= monitor.y + monitor.height - keyboardHeight) {
                if (this._keyboardVisible)
                    this._setAnimationWindow(window);
                else
                    this._delayedAnimFocusWindow = window;
            } else if (y < keyboardHeight) {
                this._delayedAnimFocusWindow = null;
                this._setAnimationWindow(null);
            }
        } else {
            this._setAnimationWindow(null);
        }

        this._oskFocusWindow = window;
    }
});

var KeyboardController = class {
    constructor() {
        let seat = Clutter.get_default_backend().get_default_seat();
        this._virtualDevice = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);

        this._inputSourceManager = KeyboardManager.getInputSourceManager();
        this._sourceChangedId = this._inputSourceManager.connect('current-source-changed',
                                                                 this._onSourceChanged.bind(this));
        this._sourcesModifiedId = this._inputSourceManager.connect('sources-changed',
                                                                   this._onSourcesModified.bind(this));
        this._currentSource = this._inputSourceManager.currentSource;

        this._notifyContentPurposeId = Main.inputMethod.connect(
            'notify::content-purpose', this._onContentPurposeHintsChanged.bind(this));
        this._notifyContentHintsId = Main.inputMethod.connect(
            'notify::content-hints', this._onContentPurposeHintsChanged.bind(this));
        this._notifyInputPanelStateId = Main.inputMethod.connect(
            'input-panel-state', (o, state) => this.emit('panel-state', state));
    }

    destroy() {
        this._inputSourceManager.disconnect(this._sourceChangedId);
        this._inputSourceManager.disconnect(this._sourcesModifiedId);
        Main.inputMethod.disconnect(this._notifyContentPurposeId);
        Main.inputMethod.disconnect(this._notifyContentHintsId);
        Main.inputMethod.disconnect(this._notifyInputPanelStateId);

        // Make sure any buttons pressed by the virtual device are released
        // immediately instead of waiting for the next GC cycle
        this._virtualDevice.run_dispose();
    }

    _onSourcesModified() {
        this.emit('groups-changed');
    }

    _onSourceChanged(inputSourceManager, _oldSource) {
        let source = inputSourceManager.currentSource;
        this._currentSource = source;
        this.emit('active-group', source.id);
    }

    _onContentPurposeHintsChanged(method) {
        let purpose = method.content_purpose;
        let emojiVisible = false;
        let keypadVisible = false;

        if (purpose == Clutter.InputContentPurpose.NORMAL ||
            purpose == Clutter.InputContentPurpose.ALPHA ||
            purpose == Clutter.InputContentPurpose.PASSWORD ||
            purpose == Clutter.InputContentPurpose.TERMINAL)
            emojiVisible = true;
        if (purpose == Clutter.InputContentPurpose.DIGITS ||
            purpose == Clutter.InputContentPurpose.NUMBER ||
            purpose == Clutter.InputContentPurpose.PHONE)
            keypadVisible = true;

        this.emit('emoji-visible', emojiVisible);
        this.emit('keypad-visible', keypadVisible);
    }

    getGroups() {
        let inputSources = this._inputSourceManager.inputSources;
        let groups = [];

        for (let i in inputSources) {
            let is = inputSources[i];
            groups[is.index] = is.xkbId;
        }

        return groups;
    }

    getCurrentGroup() {
        return this._currentSource.xkbId;
    }

    getIbusInputActive() {
        return this._currentSource.type === "ibus";
    }

    commitString(string, fromKey) {
        if (string == null)
            return false;
        /* Let ibus methods fall through keyval emission */
        if (fromKey && this._currentSource.type == KeyboardManager.INPUT_SOURCE_TYPE_IBUS)
            return false;

        Main.inputMethod.commit(string);
        return true;
    }

    keyvalPress(keyval) {
        this._virtualDevice.notify_keyval(Clutter.get_current_event_time(),
                                          keyval, Clutter.KeyState.PRESSED);
    }

    keyvalRelease(keyval) {
        this._virtualDevice.notify_keyval(Clutter.get_current_event_time(),
                                          keyval, Clutter.KeyState.RELEASED);
    }
};
Signals.addSignalMethods(KeyboardController.prototype);
