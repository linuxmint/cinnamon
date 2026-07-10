// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported FcitxInputMethod */

// Clutter.InputMethod backend that feeds Cinnamon's own Clutter actors (menu
// search, run dialog, Looking Glass, ...) through fcitx5 instead of ibus, used
// when fcitx is the active framework on X11 (see misc/imFramework.js).
//
// This mirrors misc/inputMethod.js (the ibus backend) one-to-one, but talks to
// fcitx's dbusfrontend over plain Gio DBus (there is no fcitx gobject-
// introspection binding the way there is for IBus):
//
//   service    org.fcitx.Fcitx5
//   InputMethod1  /org/freedesktop/portal/inputmethod  org.fcitx.Fcitx.InputMethod1
//   InputContext1 (path returned by CreateInputContext) org.fcitx.Fcitx.InputContext1
//
// fcitx draws its own candidate popup; we only bridge input and report the
// caret rectangle so that popup lands in the right place. We deliberately do
// NOT request ClientSideInputPanel, so candidates are never drawn in-process.

const { Clutter, Gio, GLib, GObject } = imports.gi;

const KeyboardManager = imports.ui.keyboardManager;

var HIDE_PANEL_TIME = 50;

const FCITX_SERVICE = 'org.fcitx.Fcitx5';
const FCITX_IM_PATH = '/org/freedesktop/portal/inputmethod';
const FCITX_IM_IFACE = 'org.fcitx.Fcitx.InputMethod1';
const FCITX_IC_IFACE = 'org.fcitx.Fcitx.InputContext1';

// fcitx CapabilityFlag bits (src/lib/fcitx-utils/capabilityflags.h)
const CAP_PASSWORD = 1 << 3;
const CAP_PREEDIT = 1 << 1;
const CAP_FORMATTED_PREEDIT = 1 << 4;
const CAP_SURROUNDING_TEXT = 1 << 6;

var FcitxInputMethod = GObject.registerClass(
class FcitxInputMethod extends Clutter.InputMethod {
    _init() {
        super._init();
        this._hints = 0;
        this._purpose = 0;
        this._currentFocus = null;
        this._preeditStr = '';
        this._preeditPos = 0;
        this._preeditVisible = false;
        this._hidePanelId = 0;

        this._connection = null;
        this._icPath = null;
        this._signalIds = [];
        this._cancellable = new Gio.Cancellable();

        this.connect('notify::can-show-preedit', this._updateCapabilities.bind(this));

        this._inputSourceManager = KeyboardManager.getInputSourceManager();
        this._sourceChangedId = this._inputSourceManager.connect('current-source-changed',
                                                                 this._onSourceChanged.bind(this));
        this._currentSource = this._inputSourceManager.currentSource;

        this._watchId = Gio.bus_watch_name(Gio.BusType.SESSION, FCITX_SERVICE,
                                           Gio.BusNameWatcherFlags.NONE,
                                           this._onNameAppeared.bind(this),
                                           this._onNameVanished.bind(this));
    }

    get currentFocus() {
        return this._currentFocus;
    }

    _onSourceChanged() {
        this._currentSource = this._inputSourceManager.currentSource;
    }

    _onNameAppeared(connection, _name, _owner) {
        this._connection = connection;
        this._createContext();
    }

    _onNameVanished() {
        this._clear();
    }

    _createContext() {
        // CreateInputContext(a(ss)) -> (o path, ay uuid)
        let args = new GLib.Variant('(a(ss))', [[['program', 'cinnamon']]]);
        this._connection.call(FCITX_SERVICE, FCITX_IM_PATH, FCITX_IM_IFACE,
                              'CreateInputContext', args,
                              new GLib.VariantType('(oay)'),
                              Gio.DBusCallFlags.NONE, -1, this._cancellable,
                              this._onContextCreated.bind(this));
    }

    _onContextCreated(connection, res) {
        let path;
        try {
            [path] = connection.call_finish(res).deepUnpack();
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                logError(e, 'fcitx: CreateInputContext failed');
            return;
        }

        this._icPath = path;

        let subscribe = (signal, callback) => {
            return this._connection.signal_subscribe(FCITX_SERVICE, FCITX_IC_IFACE,
                                                     signal, this._icPath, null,
                                                     Gio.DBusSignalFlags.NONE, callback);
        };
        this._signalIds.push(subscribe('CommitString', this._onCommitString.bind(this)));
        this._signalIds.push(subscribe('UpdateFormattedPreedit', this._onUpdatePreedit.bind(this)));
        this._signalIds.push(subscribe('ForwardKey', this._onForwardKey.bind(this)));
        this._signalIds.push(subscribe('DeleteSurroundingText', this._onDeleteSurrounding.bind(this)));

        this._updateCapabilities();

        if (this._currentFocus)
            this._icCall('FocusIn', null);
    }

    _icCall(method, params, replyType = null, callback = null) {
        if (!this._connection || !this._icPath)
            return;
        this._connection.call(FCITX_SERVICE, this._icPath, FCITX_IC_IFACE, method,
                              params, replyType, Gio.DBusCallFlags.NONE, -1,
                              this._cancellable, callback);
    }

    _updateCapabilities() {
        let caps = CAP_PREEDIT | CAP_FORMATTED_PREEDIT | CAP_SURROUNDING_TEXT;
        // Password fields: tell fcitx to suppress the IME (mirrors the ibus
        // content-type rule), so e.g. mozc doesn't compose into a password entry.
        if (this._purpose == Clutter.InputContentPurpose.PASSWORD)
            caps |= CAP_PASSWORD;

        this._icCall('SetCapability', new GLib.Variant('(t)', [caps]));
    }

    _clear() {
        if (this._connection && this._signalIds.length > 0) {
            for (let id of this._signalIds)
                this._connection.signal_unsubscribe(id);
        }
        this._signalIds = [];

        if (this._connection && this._icPath)
            this._icCall('DestroyIC', null);

        this._icPath = null;
        this._connection = null;
        this._hints = 0;
        this._purpose = 0;
        this._preeditStr = '';
        this._preeditPos = 0;
        this._preeditVisible = false;
    }

    _onCommitString(_conn, _sender, _path, _iface, _signal, params) {
        let [text] = params.deepUnpack();
        if (text)
            this.commit(text);
    }

    _onUpdatePreedit(_conn, _sender, _path, _iface, _signal, params) {
        // UpdateFormattedPreedit(a(si) strings, i cursor)
        let [strings, pos] = params.deepUnpack();
        let preedit = strings.map(s => s[0]).join('');

        if (preedit.length > 0)
            this.set_preedit_text(preedit, pos);
        else if (this._preeditVisible)
            this.set_preedit_text(null, pos);

        this._preeditStr = preedit;
        this._preeditPos = pos;
        this._preeditVisible = preedit.length > 0;
    }

    _onForwardKey(_conn, _sender, _path, _iface, _signal, params) {
        // ForwardKey(u keyval, u state, b isRelease)
        let [keyval, state, isRelease] = params.deepUnpack();
        let press = !isRelease;

        let curEvent = Clutter.get_current_event();
        let time;
        if (curEvent)
            time = curEvent.get_time();
        else
            time = global.display.get_current_time_roundtrip();

        // fcitx doesn't give us a keycode on forwarded keys; 0 is acceptable.
        this.forward_key(keyval, 0, state & Clutter.ModifierType.MODIFIER_MASK, time, press);
    }

    _onDeleteSurrounding(_conn, _sender, _path, _iface, _signal, params) {
        // DeleteSurroundingText(i offset, u nchars)
        let [offset, nchars] = params.deepUnpack();
        try {
            this.delete_surrounding(offset, nchars);
        } catch (e) {
            this.delete_surrounding(0, nchars + offset);
        }
    }

    vfunc_focus_in(focus) {
        this._currentFocus = focus;
        this._icCall('FocusIn', null);

        if (this._hidePanelId) {
            GLib.source_remove(this._hidePanelId);
            this._hidePanelId = 0;
        }
    }

    vfunc_focus_out() {
        // Drop any password purpose while still focused so fcitx re-enables the
        // IME once the field goes away (mirrors the ibus content-type reset).
        if (this._purpose != 0) {
            this._purpose = 0;
            this._updateCapabilities();
        }

        this._currentFocus = null;
        this._icCall('FocusOut', null);

        if (this._preeditStr) {
            this.set_preedit_text(null, 0);
            this._preeditStr = null;
        }

        this._hidePanelId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, HIDE_PANEL_TIME, () => {
            this.set_input_panel_state(Clutter.InputPanelState.OFF);
            this._hidePanelId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    vfunc_reset() {
        this._icCall('Reset', null);

        if (this._preeditStr) {
            this.set_preedit_text(null, 0);
            this._preeditStr = null;
        }
    }

    vfunc_set_cursor_location(rect) {
        // fcitx positions its own candidate popup from this. On X11 the stage
        // covers the screen, so stage coords double as screen coords.
        this._icCall('SetCursorRect',
                     new GLib.Variant('(iiii)', [rect.get_x(), rect.get_y(),
                                                 rect.get_width(), rect.get_height()]));
    }

    vfunc_set_surrounding(text, cursor, anchor) {
        if (!text)
            return;
        // SetSurroundingText(s text, u cursor, u anchor)
        this._icCall('SetSurroundingText',
                     new GLib.Variant('(suu)', [text, cursor, anchor]));
    }

    vfunc_update_content_hints(hints) {
        // Hints (completion, spellcheck, ...) map to fcitx capability flags but
        // aren't acted on yet; track for parity. Purpose is handled separately
        // (see _updateCapabilities) so password fields suppress the IME.
        this._hints = hints;
    }

    vfunc_update_content_purpose(purpose) {
        this._purpose = purpose;
        this._updateCapabilities();
    }

    vfunc_filter_key_event(event) {
        if (!this._connection || !this._icPath)
            return false;
        if (!this._currentSource)
            return false;

        let isRelease = event.type() == Clutter.EventType.KEY_RELEASE;
        let keyval = event.get_key_symbol();
        // fcitx's own GTK frontend passes the X hardware keycode (evdev + 8),
        // which is exactly what Clutter.get_key_code() returns — so no -8 here.
        let keycode = event.get_key_code();
        let state = event.get_state() & Clutter.ModifierType.MODIFIER_MASK;
        let time = event.get_time();

        // ProcessKeyEvent(u keyval, u keycode, u state, b isRelease, u time) -> (b handled)
        this._connection.call(FCITX_SERVICE, this._icPath, FCITX_IC_IFACE,
                              'ProcessKeyEvent',
                              new GLib.Variant('(uuubu)', [keyval, keycode, state, isRelease, time]),
                              new GLib.VariantType('(b)'),
                              Gio.DBusCallFlags.NONE, -1, this._cancellable,
                              (connection, res) => {
                                  let handled = false;
                                  try {
                                      [handled] = connection.call_finish(res).deepUnpack();
                                  } catch (e) {
                                      if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                                          return;
                                      log(`Error processing key on fcitx: ${e.message}`);
                                  }
                                  this.notify_key_event(event, handled);
                              });
        return true;
    }
});
