// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const GObject = imports.gi.GObject;

const Params = imports.misc.params;

var State = {
    OPENED: 0,
    CLOSED: 1,
    OPENING: 2,
    CLOSING: 3,
    FADED_OUT: 4
};

var BaseDialog = GObject.registerClass({
    Properties: {
        'state': GObject.ParamSpec.int(
            'state', 'Dialog state', 'state',
            GObject.ParamFlags.READABLE,
            Math.min(...Object.values(State)),
            Math.max(...Object.values(State)),
            State.CLOSED)
    },
    Signals: { 'opened': {}, 'closed': {} }
}, class BaseDialog extends St.Widget {

    _init(stWidgetProps, params) {
        super._init(stWidgetProps);

        params = Params.parse(params, {
            destroyOnClose: true,
        });

        this._state = State.CLOSED;
        this._destroyOnClose = params.destroyOnClose;

        this.openAndCloseTime = 100;
        if (!global.settings.get_boolean("desktop-effects-workspace")) {
            this.openAndCloseTime = 0;
        }

        this._initialKeyFocus = null;
        this._initialKeyFocusDestroyId = 0;
    }

    _initDialogLayout(dialogLayout) {
        this.dialogLayout = dialogLayout;
        this.contentLayout = dialogLayout.contentLayout;
        this.buttonLayout = dialogLayout.buttonLayout;
        global.focus_manager.add_group(dialogLayout);
    }

    get state() {
        return this._state;
    }

    _setState(state) {
        if (this._state == state)
            return;

        this._state = state;
        this.notify('state');
    }

    clearButtons() {
        this.dialogLayout.clearButtons();
    }

    setButtons(buttons) {
        this.clearButtons();

        for (let buttonInfo of buttons) {
            this.addButton(buttonInfo);
        }
    }

    addButton(buttonInfo) {
        return this.dialogLayout.addButton(buttonInfo);
    }

    setInitialKeyFocus(actor) {
        if (this._initialKeyFocusDestroyId)
            this._initialKeyFocus.disconnect(this._initialKeyFocusDestroyId);

        this._initialKeyFocus = actor;

        this._initialKeyFocusDestroyId = actor.connect('destroy', () => {
            this._initialKeyFocus = null;
            this._initialKeyFocusDestroyId = 0;
        });
    }

    _grabInitialKeyFocus() {
        let focus = this._initialKeyFocus || this.dialogLayout.initialKeyFocus;
        focus.grab_key_focus();
    }

    _animateOpen() {
        this._setState(State.OPENING);

        this.dialogLayout.opacity = 255;
        this.opacity = 0;
        this.show();
        this.ease({
            opacity: 255,
            duration: this.openAndCloseTime,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._setState(State.OPENED);
                this.emit('opened');
            }
        });
    }

    _animateClose() {
        this._setState(State.CLOSING);

        this.ease({
            opacity: 0,
            duration: this.openAndCloseTime,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._setState(State.CLOSED);
                this.hide();
                this.emit('closed');

                if (this._destroyOnClose)
                    this.destroy();
            }
        });
    }
});
