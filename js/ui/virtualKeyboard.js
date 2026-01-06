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

var KEYBOARD_REST_TIME = 50;
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

const escape_key = { keyval: Clutter.KEY_Escape, label: "Esc",                               extraClassName: 'escape-key' };
const tab_key =    { width: 1.5, keyval: Clutter.KEY_Tab,    label: '⇥',                                 extraClassName: 'non-alpha-key' };
const _123_key =   { width: 1.5, level: 2,       label: '?123',                              extraClassName: 'non-alpha-key' };
const abc_key =    { width: 1.5, level: 0,       label: 'ABC',                               extraClassName: 'non-alpha-key' };
const backsp_key = { width: 1.5, keyval: Clutter.KEY_BackSpace, icon: 'xsi-edit-clear-symbolic', extraClassName: 'non-alpha-key' };
const hide_key =   { action: 'hide', icon: 'xsi-input-keyboard-symbolic',                        extraClassName: 'hide-key' };
const return_key = { width: 2, keyval: Clutter.KEY_Return, icon: 'keyboard-enter-symbolic',  extraClassName: 'enter-key' };
const dir_keys =  [{ keyval: Clutter.KEY_Left,   label: '←',                                 extraClassName: 'non-alpha-key'},
                   { keyval: Clutter.KEY_Up,     label: '↑',                                 extraClassName: 'non-alpha-key' },
                   { keyval: Clutter.KEY_Down,   label: '↓',                                 extraClassName: 'non-alpha-key'},
                   { keyval: Clutter.KEY_Right,  label: '→',                                 extraClassName: 'non-alpha-key' }];
const layout_key = { action: 'next-layout',      icon: 'xsi-input-keyboard-symbolic' };
const ctrl_key =   { keyval: Clutter.KEY_Control_L, label: 'Ctrl', width: 1.5, modifier: 'ctrl', extraClassName: 'non-alpha-key' };
const alt_key =    { keyval: Clutter.KEY_Alt_L,     label: 'Alt',  width: 1.5, modifier: 'alt',  extraClassName: 'non-alpha-key' };

const defaultKeysPre = [
    [[escape_key], [tab_key], [layout_key, { width: 1.5, level: 1, extraClassName: 'shift-key-lowercase', icon: 'keyboard-shift-filled-symbolic' }], [ctrl_key, _123_key, alt_key]],
    [[escape_key], [tab_key], [layout_key, { width: 1.5, level: 0, extraClassName: 'shift-key-uppercase', icon: 'keyboard-shift-filled-symbolic' }], [ctrl_key, _123_key, alt_key]],
    [[escape_key], [tab_key], [{ label: '=/<', width: 1.5, level: 3, extraClassName: 'non-alpha-key' }], [ctrl_key, abc_key, alt_key]],
    [[escape_key], [tab_key], [{ label: '?123', width: 1.5, level: 2, extraClassName: 'non-alpha-key' }], [ctrl_key, abc_key, alt_key]],
];

const defaultKeysPost = [
    [[backsp_key, hide_key],
     [return_key],
     [{ width: 1.5, level: 1, right: true, extraClassName: 'shift-key-lowercase', icon: 'keyboard-shift-filled-symbolic' }],
     dir_keys],
    [[backsp_key, hide_key],
     [return_key],
     [{ width: 1.5, level: 0, right: true, extraClassName: 'shift-key-uppercase', icon: 'keyboard-shift-filled-symbolic' }],
     dir_keys],
    [[backsp_key, hide_key],
     [return_key],
     [{ label: '=/<', width: 1.5, level: 3, right: true, extraClassName: 'non-alpha-key' }],
     dir_keys],
    [[backsp_key, hide_key],
     [return_key],
     [{ label: '?123', width: 1.5, level: 2, right: true, extraClassName: 'non-alpha-key' }],
     dir_keys],
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
        this.shiftKeys = [];
        this.modifierKeys = {};
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

var Key = GObject.registerClass({
    Signals: {
        'activated': {},
        'long-press': {},
        'pressed': { param_types: [GObject.TYPE_UINT, GObject.TYPE_STRING] },
        'released': { param_types: [GObject.TYPE_UINT, GObject.TYPE_STRING] },
    },
}, class Key extends St.BoxLayout {
    _init(key, extendedKeys, icon = null) {
        super._init({ style_class: 'vkeyboard-key-container', important: true });

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
    }

    updateKey(label, icon = null) {
        this.key = label || "";
        this.keyButton.destroy();
        this.keyButton = this._makeKey(this.key, icon);
        this.add_child(this.keyButton);
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
        this._boxPointer.add_style_class_name('vkeyboard-subkeys');
        this._getExtendedKeys();
        this.keyButton._extendedKeys = this._extendedKeyboard;
    }

    _getKeyval(key) {
        let unicode = key.charCodeAt(0);
        return Clutter.unicode_to_keysym(unicode);
    }

    _press(key) {
        this.emit('activated');

        if (this._extendedKeys.length === 0)
            this.emit('pressed', this._getKeyval(key), key);

        if (key == this.key) {
            this._pressTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT,
                KEY_LONG_PRESS_TIME,
                () => {
                    this._pressTimeoutId = 0;

                    this.emit('long-press');

                    if (this._extendedKeys.length > 0) {
                        this._touchPressSlot = null;
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

        if (this._extendedKeys.length > 0)
            this.emit('pressed', this._getKeyval(key), key);

        this.emit('released', this._getKeyval(key), key);
        this._hideSubkeys();
    }

    cancel() {
        if (this._pressTimeoutId != 0) {
            GLib.source_remove(this._pressTimeoutId);
            this._pressTimeoutId = 0;
        }
        this._touchPressSlot = null;
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
            style_class: 'vkeyboard-key',
            x_expand: true,
            important: true
        });

        if (icon) {
            if (icon instanceof Clutter.Actor) {
                button.set_child(icon);
                this._icon = icon;
            } else {
                let child = new St.Icon({ icon_name: icon });
                button.set_child(child);
                this._icon = child;
            }
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

            const slot = event.get_event_sequence().get_slot();

            if (!this._touchPressSlot &&
                event.type() == Clutter.EventType.TOUCH_BEGIN) {
                this._touchPressSlot = slot;
                this._press(key);
            } else if (event.type() === Clutter.EventType.TOUCH_END) {
                if (!this._touchPressSlot ||
                    this._touchPressSlot === slot)
                    this._release(key);

                if (this._touchPressSlot === slot)
                    this._touchPressSlot = null;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        return button;
    }

    _getExtendedKeys() {
        this._extendedKeyboard = new St.BoxLayout({
            style_class: 'vkeyboard-key-container',
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

    setLatched(latched, modifierType = 'shift') {
        const is_shift = modifierType === 'shift';
        if (!this._icon && is_shift)
            return;

        if (latched) {
            this.keyButton.add_style_pseudo_class('latched');
            if (is_shift && this._icon) {
                this._icon.icon_name = 'keyboard-caps-lock-filled-symbolic';
            } else {
                this.keyButton.add_style_class_name('shift-key-uppercase');
            }
        } else {
            this.keyButton.remove_style_pseudo_class('latched');
            if (is_shift && this._icon) {
                this._icon.icon_name = 'keyboard-shift-filled-symbolic';
            } else {
                this.keyButton.remove_style_class_name('shift-key-uppercase');
            }
        }
    }
});

var ActiveGroupKey = GObject.registerClass({}, class ActiveGroupKey extends Key {
    _init(controller) {
        this._controller = controller;
        let [shortName, icon] = this._controller.getCurrentGroupLabelIcon();

        super._init(shortName, [], icon);
        this._groupChangedId = this._controller.connect('active-group', this._onGroupChanged.bind(this));
        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onGroupChanged(id) {
        let [shortName, icon] = this._controller.getCurrentGroupLabelIcon();
        this.updateKey(shortName, icon);
        this.keyButton.add_style_class_name("non-alpha-key");
    }

    _onDestroy() {
        if (this._groupChangedId > 0) {
            this._controller.disconnect(this._groupChangedId);
            this._groupChangedId = 0;
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
            { keyval: Clutter.KEY_BackSpace, icon: 'xsi-edit-clear-symbolic', left: 3, top: 0 },
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

var VirtualKeyboardManager = GObject.registerClass({
    Signals: { 'enabled-changed': {} }
}, class VirtualKeyboardManager extends GObject.Object {
    constructor() {
        super();
        this._keyboard = null;
        this._a11yApplicationsSettings = new Gio.Settings({ schema_id: A11Y_APPLICATIONS_SCHEMA });
        this._a11yApplicationsSettings.connect('changed::screen-keyboard-enabled', this._keyboardEnabledChanged.bind(this));

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

    _keyboardEnabledChanged() {
        this._syncEnabled();
        this.emit('enabled-changed');
    }

    _keyboardSettingsChanged() {
        this.destroyKeyboard();
        this._syncEnabled();
    }

    _shouldEnable() {
        let enableKeyboard = this._a11yApplicationsSettings.get_boolean(SHOW_KEYBOARD_KEY);
        let autoEnabled = this._seat.get_touch_mode() && this._lastDeviceIsTouchscreen();
        return enableKeyboard || autoEnabled;
    }

    _syncEnabled() {
        let enabled = this._shouldEnable();
        if (!enabled && !this._keyboard)
            return;

        if (enabled && !this._keyboard) {
            this._keyboard = new Keyboard(this._keyboardSettings.get_string(ACTIVATION_MODE_KEY) === "on-demand");
        } else if (!enabled && this._keyboard) {
            this.destroyKeyboard();
        }
    }

    destroyKeyboard() {
        if (this._keyboard == null) {
            return;
        }

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
        return this._shouldEnable();
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
});

var Keyboard = GObject.registerClass(
class Keyboard extends St.BoxLayout {
    _init(onDemand) {
        super._init({ name: 'virtual-keyboard', vertical: true, important: true });
        this._focusInExtendedKeys = false;
        this._onDemand = onDemand;

        this._languagePopup = null;
        this._currentFocusWindow = null;

        this._latched = false; // current level is latched
        this._currentLevel = 0; // track current level for modifier handling

        this._latchedModifiers = {
            ctrl: false,
            alt: false
        };
        this._pressedModifierKeyvals = {
            ctrl: 0,
            alt: 0
        };

        this._suggestions = null;

        if (!this._onDemand) {
            this._focusTracker = new FocusTracker();
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

    _onDestroy() {
        for (let [obj, id] of this._connectionsIDs)
            obj.disconnect(id);
        delete this._connectionsIDs;

        this._clearShowIdle();
        this._releaseAllModifiers();

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

        this._suggestions = new Suggestions();
        this.add_child(this._suggestions);
        this._suggestions.visible = this._keyboardController.getIbusInputActive();

        this._aspectContainer = new AspectContainer({
            layout_manager: new Clutter.BinLayout(),
            y_expand: true,
        });
        this.add_child(this._aspectContainer);

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
        if (!this._onDemand) {
            this._connectSignal(global.stage, 'notify::key-focus',
                this._onKeyFocusChanged.bind(this));
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

                this._releaseAllModifiers();

                if (!this._latched)
                    this._setActiveLayer(0);
            });

            layout.appendKey(button, button.keyButton.keyWidth);
        }
    }

    _loadDefaultKeys(keys, layout, numLevels, numKeys) {
        let extraButton;
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let keyval = key.keyval;
            let switchToLevel = key.level;
            let action = key.action;
            let icon = key.icon;
            let modifier = key.modifier;

            if (action === 'next-layout') {
                let groups = this._keyboardController.getGroups();
                if (groups.length > 1) {
                    extraButton = new ActiveGroupKey(this._keyboardController);
                } else {
                    continue;
                }
            } else {
                extraButton = new Key(key.label || '', [], icon);
            }

            // extraButton.keyButton.add_style_class_name('default-key');
            if (key.extraClassName != null)
                extraButton.keyButton.add_style_class_name(key.extraClassName);
            if (key.width != null)
                extraButton.setWidth(key.width);

            let actor = extraButton.keyButton;

            extraButton.connect('pressed', () => {
                if (switchToLevel != null && (switchToLevel === 0 || switchToLevel === 1) &&
                    (this._currentLevel === 0 || this._currentLevel === 1) &&
                    (this._latchedModifiers.ctrl || this._latchedModifiers.alt)) {
                    this._keyboardController.keyvalPress(Clutter.KEY_Shift_L);
                    extraButton._shiftPressed = true;
                    return;
                }

                if (switchToLevel != null) {
                    this._setActiveLayer(switchToLevel);
                    this._latched = switchToLevel != 1;
                } else if (modifier != null) {
                    this._toggleModifier(modifier, keyval, extraButton);
                } else if (keyval != null) {
                    this._keyboardController.keyvalPress(keyval);
                }
            });
            extraButton.connect('released', () => {
                if (extraButton._shiftPressed) {
                    this._keyboardController.keyvalRelease(Clutter.KEY_Shift_L);
                    this._releaseAllModifiers();
                    extraButton._shiftPressed = false;
                    return;
                }

                if (keyval != null && modifier == null) {
                    this._keyboardController.keyvalRelease(keyval);
                    this._releaseAllModifiers();
                } else if (action == 'hide')
                    this.close();
                else if (action == 'next-layout')
                    this._keyboardController.activateNextGroup();
            });

            if (switchToLevel == 0) {
                layout.shiftKeys.push(extraButton);
            } else if (switchToLevel == 1) {
                extraButton.connect('long-press', () => {
                    this._latched = true;
                    this._setCurrentLevelLatched(this._currentPage, this._latched);
                });
            } else if (modifier != null) {
                if (!layout.modifierKeys[modifier])
                    layout.modifierKeys[modifier] = [];
                layout.modifierKeys[modifier].push(extraButton);
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
            }

            layout.appendKey(extraButton, extraButton.keyButton.keyWidth);
        }
    }

    _updateCurrentPageVisible() {
        if (this._currentPage)
            this._currentPage.visible = !this._keypadVisible;
    }

    _setCurrentLevelLatched(layout, latched) {
        for (let i = 0; i < layout.shiftKeys.length; i++) {
            let key = layout.shiftKeys[i];
            key.setLatched(latched);
        }
    }

    _toggleModifier(modifier, keyval, keyButton) {
        if (this._latchedModifiers[modifier]) {
            this._releaseModifier(modifier);
        } else {
            this._latchedModifiers[modifier] = true;
            this._pressedModifierKeyvals[modifier] = keyval;
            this._keyboardController.keyvalPress(keyval);
            this._setModifierLatchedAllLayers(modifier, true);
        }
    }

    _setModifierLatched(layout, modifier, latched) {
        if (!layout?.modifierKeys?.[modifier])
            return;

        for (let i = 0; i < layout.modifierKeys[modifier].length; i++) {
            let key = layout.modifierKeys[modifier][i];
            key.setLatched(latched, modifier);
        }
    }

    _setModifierLatchedAllLayers(modifier, latched) {
        let activeGroupName = this._keyboardController.getCurrentGroup();
        let layers = this._groups[activeGroupName];

        for (let level in layers) {
            this._setModifierLatched(layers[level], modifier, latched);
        }
    }

    _releaseModifier(modifier) {
        if (!this._latchedModifiers[modifier])
            return;

        let keyval = this._pressedModifierKeyvals[modifier];
        if (keyval != 0) {
            this._keyboardController.keyvalRelease(keyval);
        }

        this._latchedModifiers[modifier] = false;
        this._pressedModifierKeyvals[modifier] = 0;
        this._setModifierLatchedAllLayers(modifier, false);
    }

    _releaseAllModifiers() {
        for (let modifier in this._latchedModifiers) {
            if (this._latchedModifiers[modifier]) {
                this._releaseModifier(modifier);
            }
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
        this._suggestions.visible = this._keyboardController.getIbusInputActive();

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
        if (this._keyboardController.getIbusInputActive()) {
            if (!this._suggestions.visible) {
                this._suggestions.visible = true;
                this._relayout();
            }
        } else {
            if (this._suggestions.visible) {
                this._suggestions.visible = false;
                this._relayout();
            }
        }

        this._ensureKeysForGroup(this._keyboardController.getCurrentGroup());
        this._setActiveLayer(0);
    }

    _onKeyboardGroupsChanged() {
        let nonGroupActors = [this._keypad];
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

        if (this._onDemand)
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

        this._currentLevel = activeLevel;
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
        this._releaseAllModifiers();
        Main.layoutManager.hideKeyboard();
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
        let keypadVisible = false;

        if (purpose == Clutter.InputContentPurpose.DIGITS ||
            purpose == Clutter.InputContentPurpose.NUMBER ||
            purpose == Clutter.InputContentPurpose.PHONE)
            keypadVisible = true;

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
        let inputSources = this._inputSourceManager.inputSources;

        for (let i in inputSources) {
            if (inputSources[i].type === "ibus")
                return true;
        }

        return false;
    }

    activateNextGroup() {
        let new_index = this._inputSourceManager.currentSource.index + 1;
        if (new_index == this._inputSourceManager.numInputSources) {
            new_index = 0;
        }

        this._inputSourceManager.activateInputSourceIndex(new_index);
    }

    getCurrentGroupLabelIcon() {
        let actor = null;

        if (this._inputSourceManager.showFlags) {
            actor = this._inputSourceManager.createFlagIcon(this._currentSource, null, 16);
        }

        if (actor == null) {
            return [this._currentSource.shortName, null];
        }
        return [null, actor];
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
