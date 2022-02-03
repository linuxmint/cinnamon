// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported CloseDialog */

const { Clutter, GLib, GObject, Meta, Cinnamon, St } = imports.gi;

const ModalDialog = imports.ui.modalDialog;
const Main = imports.ui.main;

var FROZEN_WINDOW_BRIGHTNESS = -0.3;
var DIALOG_TRANSITION_TIME = 150;
var ALIVE_TIMEOUT = 5000;

var CloseHungWindowDialog = class CloseHungWindowDialog extends ModalDialog.ModalDialog {
    constructor(window) {
        super();

        this._window = window;

        let tracker = Cinnamon.WindowTracker.get_default();
        let app = tracker.get_window_app(this._window);

        /* Translators: %s is an application name */
        let title = _("'%s' is not responding.").format(app.get_name());

        this.contentLayout.add(new St.Label({ text:        title,
                                              style_class: 'confirm-dialog-title',
                                              important:   true }));

        let body = _("You may choose to wait a short while for it to " +
                     "continue or force the application to quit entirely.");
        this.contentLayout.add(new St.Label({text: body}));
    }
};

var CloseDialog = GObject.registerClass({
    Implements: [Meta.CloseDialog],
    Properties: {
        'window': GObject.ParamSpec.override('window', Meta.CloseDialog),
    },
}, class CloseDialog extends GObject.Object {
    _init(window) {
        super._init();
        this._window = window;
        this._dialog = null;
        this._timeoutId = 0;
        this._windowFocusChangedId = 0;
        this._keyFocusChangedId = 0;
    }

    get window() {
        return this._window;
    }

    set window(window) {
        this._window = window;
    }

    _initDialog() {
        if (this._dialog)
            return;

        this._dialog = new CloseHungWindowDialog(this._window);

        this._dialog.setButtons([
            {
                label: _("Wait"),
                action: this._onWait.bind(this),
                key: Clutter.KEY_Escape
            },
            {
                label: _("Force Quit"),
                action: this._onClose.bind(this)
            }
        ]);
    }

    _addWindowEffect() {
        let windowActor = this._window.get_compositor_private();
        let surfaceActor = windowActor.get_first_child();
        let effect = new Clutter.BrightnessContrastEffect();
        effect.set_brightness(FROZEN_WINDOW_BRIGHTNESS);
        surfaceActor.add_effect_with_name("frozen-window", effect);
    }

    _removeWindowEffect() {
        let windowActor = this._window.get_compositor_private();
        let surfaceActor = windowActor.get_first_child();
        surfaceActor.remove_effect_by_name("frozen-window");
    }

    _onWait() {
        this.response(Meta.CloseDialogResponse.WAIT);
    }

    _onClose() {
        this.response(Meta.CloseDialogResponse.FORCE_CLOSE);
    }

    _onFocusChanged() {
        if (Meta.is_wayland_compositor())
            return;

        let focusWindow = global.display.focus_window;
        let keyFocus = global.stage.key_focus;

        let shouldTrack;
        if (focusWindow != null)
            shouldTrack = focusWindow == this._window;
        else
            shouldTrack = keyFocus && this._dialog._group.contains(keyFocus);

        if (this._tracked === shouldTrack)
            return;

        // if (shouldTrack) {
        //     Main.layoutManager.trackChrome(this._dialog._group,
        //                                    { affectsInputRegion: true });
        // } else {
        //     Main.layoutManager.untrackChrome(this._dialog._group);
        // }

        // The buttons are broken when they aren't added to the input region,
        // so disable them properly in that case
        this._dialog._buttonLayout.get_children().forEach(b => {
            b.reactive = shouldTrack;
        });

        this._tracked = shouldTrack;
    }

    vfunc_show() {
        if (this._dialog != null)
            return;

        this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, ALIVE_TIMEOUT,
            () => {
                this._window.check_alive(global.display.get_current_time_roundtrip());
                return GLib.SOURCE_CONTINUE;
            });

        this._windowFocusChangedId =
            global.display.connect('notify::focus-window',
                                   this._onFocusChanged.bind(this));

        this._keyFocusChangedId =
            global.stage.connect('notify::key-focus',
                                 this._onFocusChanged.bind(this));

        // this._addWindowEffect();
        this._initDialog();
        this._dialog.open();
        // this._onFocusChanged();
    }

    vfunc_hide() {
        if (this._dialog == null)
            return;

        GLib.source_remove(this._timeoutId);
        this._timeoutId = 0;

        global.display.disconnect(this._windowFocusChangedId);
        this._windowFocusChangedId = 0;

        global.stage.disconnect(this._keyFocusChangedId);
        this._keyFocusChangedId = 0;

        this._dialog.destroy();
        this._dialog = null;
        // this._removeWindowEffect();
    }

    vfunc_focus() {
        if (this._dialog)
            this._dialog._group.grab_key_focus();
    }
});
