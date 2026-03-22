// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Atk = imports.gi.Atk;
const GObject = imports.gi.GObject;

const Params = imports.misc.params;

const BaseDialog = imports.ui.baseDialog;
const Dialog = imports.ui.dialog;
const Main = imports.ui.main;

var State = BaseDialog.State;

var PopupDialog = GObject.registerClass(
class PopupDialog extends BaseDialog.BaseDialog {

    _init(params) {
        params = Params.parse(params, {
            styleClass: null,
            destroyOnClose: true,
        });

        super._init({
            visible: false,
            reactive: true,
            accessible_role: Atk.Role.DIALOG,
            layout_manager: new Clutter.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL
            }),
            style_class: 'popup-dialog',
        }, {
            destroyOnClose: params.destroyOnClose,
        });

        this._windowFocusChangedId = 0;
        this._dragCaptureId = 0;
        this._savedKeyFocus = null;
        this._savedKeyFocusDestroyId = 0;

        this.dialogLayout = new Dialog.Dialog(this, params.styleClass);
        this._initDialogLayout(this.dialogLayout);

        Main.uiGroup.add_actor(this);

        this._setupDragging();

        this.connect('destroy', () => {
            if (this._dragCaptureId)
                this._endDrag();

            if (this._windowFocusChangedId) {
                global.display.disconnect(this._windowFocusChangedId);
                this._windowFocusChangedId = 0;
            }

            this._clearSavedKeyFocus();
        });
    }

    open() {
        if (this.state == State.OPENED || this.state == State.OPENING)
            return true;

        this._centerOnMonitor();

        Main.layoutManager.trackChrome(this, { affectsInputRegion: true });

        this._focusStage();
        this._grabInitialKeyFocus();

        this._windowFocusChangedId = global.display.connect(
            'notify::focus-window', this._onWindowFocusChanged.bind(this)
        );

        this._animateOpen();
        return true;
    }

    close() {
        if (this.state == State.CLOSED || this.state == State.CLOSING)
            return;

        if (this._dragCaptureId)
            this._endDrag();

        if (this._windowFocusChangedId) {
            global.display.disconnect(this._windowFocusChangedId);
            this._windowFocusChangedId = 0;
        }

        this._clearSavedKeyFocus();

        Main.layoutManager.untrackChrome(this);
        global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
        this._animateClose();
    }

    _centerOnMonitor() {
        this.translation_x = 0;
        this.translation_y = 0;

        let monitor = Main.layoutManager.monitors[
            global.display.get_current_monitor()
        ];

        this.opacity = 0;
        this.show();

        let x = monitor.x + Math.round((monitor.width - this.width) / 2);
        let y = monitor.y + Math.round((monitor.height - this.height) / 2);
        this.set_position(x, y);
    }

    _focusStage() {
        global.set_stage_input_mode(Cinnamon.StageInputMode.FOCUSED);
    }

    _clearSavedKeyFocus() {
        if (this._savedKeyFocusDestroyId) {
            this._savedKeyFocus.disconnect(this._savedKeyFocusDestroyId);
            this._savedKeyFocusDestroyId = 0;
        }
        this._savedKeyFocus = null;
    }

    _saveAndClearFocus() {
        this._clearSavedKeyFocus();

        let focus = global.stage.key_focus;
        if (focus && this.contains(focus)) {
            this._savedKeyFocus = focus;
            this._savedKeyFocusDestroyId = focus.connect('destroy', () => {
                this._savedKeyFocus = null;
                this._savedKeyFocusDestroyId = 0;
            });
        }

        global.stage.set_key_focus(null);
    }

    _restoreFocus() {
        this._focusStage();

        if (this._savedKeyFocus) {
            let actor = this._savedKeyFocus;
            this._clearSavedKeyFocus();
            actor.grab_key_focus();
        } else {
            this._grabInitialKeyFocus();
        }
    }

    _onWindowFocusChanged() {
        if (global.display.focus_window)
            this._saveAndClearFocus();
    }

    _setupDragging() {
        this.connect('button-press-event', (actor, event) => {
            if (event.get_button() !== 1)
                return Clutter.EVENT_PROPAGATE;

            let source = event.get_source();
            if (this._isInteractiveActor(source)) {
                this._restoreFocus();
                return Clutter.EVENT_PROPAGATE;
            }

            this._startDrag(event);
            return Clutter.EVENT_STOP;
        });
    }

    _isInteractiveActor(actor) {
        let boundary = this.dialogLayout._dialog;
        while (actor && actor !== boundary) {
            if (actor instanceof St.Button ||
                actor instanceof St.Entry ||
                actor.track_hover)
                return true;
            actor = actor.get_parent();
        }
        return false;
    }

    _startDrag(event) {
        let [stageX, stageY] = event.get_coords();

        this._dragStartX = stageX;
        this._dragStartY = stageY;
        this._dragOrigTransX = this.translation_x;
        this._dragOrigTransY = this.translation_y;

        this._saveAndClearFocus();

        this._dragGrabbed = global.begin_modal(global.get_current_time(), 0);
        if (!this._dragGrabbed) {
            this._restoreFocus();
            return;
        }

        global.display.set_cursor(Meta.Cursor.GRABBING);

        this._dragCaptureId = global.stage.connect('captured-event', (stageActor, ev) => {
            return this._onDragEvent(ev);
        });
    }

    _onDragEvent(event) {
        if (event.type() === Clutter.EventType.MOTION) {
            let [stageX, stageY] = event.get_coords();

            this.translation_x = this._dragOrigTransX + (stageX - this._dragStartX);
            this.translation_y = this._dragOrigTransY + (stageY - this._dragStartY);

            return Clutter.EVENT_STOP;
        }

        if (event.type() === Clutter.EventType.BUTTON_RELEASE) {
            this._endDrag();
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _endDrag() {
        global.display.set_cursor(Meta.Cursor.DEFAULT);

        if (this._dragCaptureId) {
            global.stage.disconnect(this._dragCaptureId);
            this._dragCaptureId = 0;
        }

        if (this._dragGrabbed) {
            global.end_modal(global.get_current_time());
            this._dragGrabbed = false;
        }

        this._restoreFocus();
        Main.layoutManager.updateChrome();
    }
});
