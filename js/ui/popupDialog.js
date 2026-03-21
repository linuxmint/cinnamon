// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
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
        this._dragGrabbed = false;
        this._savedKeyFocus = null;
        this._savedKeyFocusDestroyId = 0;

        this._initDialogLayout(new Dialog.Dialog(this, params.styleClass));

        Main.uiGroup.add_actor(this);

        this._setupDragging();

        this.connect('destroy', () => {
            this._teardownOpenState();

            if (this.state != State.CLOSED) {
                this._setState(State.CLOSED);
                this.emit('closed');
            }
        });
    }

    _teardownOpenState() {
        if (this._dragCaptureId)
            this._endDrag();

        if (this._windowFocusChangedId) {
            global.display.disconnect(this._windowFocusChangedId);
            this._windowFocusChangedId = 0;
        }

        this._clearSavedKeyFocus();

        Main.layoutManager.untrackChrome(this);
        global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);
    }

    open() {
        if (this.state == State.OPENED || this.state == State.OPENING)
            return true;

        try {
            if (this.state == State.CLOSING)
                this.remove_all_transitions();
            else
                this._centerOnMonitor();

            Main.layoutManager.trackChrome(this, { affectsInputRegion: true });

            this._focusStage();
            this._grabInitialKeyFocus();

            this._windowFocusChangedId = global.display.connect(
                'notify::focus-window', this._onWindowFocusChanged.bind(this)
            );

            this._animateOpen();
            return true;
        } catch (e) {
            global.logError('PopupDialog: failed to open dialog', e);

            this._teardownOpenState();
            this._setState(State.CLOSED);
            this.hide();
            this.emit('closed');

            if (this._destroyOnClose)
                this.destroy();

            return false;
        }
    }

    close() {
        if (this.state == State.CLOSED || this.state == State.CLOSING)
            return;

        this._teardownOpenState();
        this._animateClose();
    }

    _centerOnMonitor() {
        this.translation_x = 0;
        this.translation_y = 0;

        let monitor = Main.layoutManager.monitors[
            global.display.get_current_monitor()
        ];
        if (!monitor) {
            global.logWarning('PopupDialog: current monitor index out of range, using primary');
            monitor = Main.layoutManager.primaryMonitor;
        }

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
        let focus = global.stage.key_focus;
        if (focus && this.contains(focus)) {
            this._clearSavedKeyFocus();
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

            Main.uiGroup.set_child_above_sibling(this, null);

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
        while (actor && actor !== this) {
            if (actor.reactive)
                return true;
            actor = actor.get_parent();
        }
        return false;
    }

    _startDrag(event) {
        this._dragGrabbed = global.begin_modal(global.get_current_time(), 0);
        if (!this._dragGrabbed) {
            global.logWarning('PopupDialog: begin_modal failed; drag aborted');
            return;
        }

        let [stageX, stageY] = event.get_coords();

        this._dragStartX = stageX;
        this._dragStartY = stageY;
        this._dragOrigTransX = this.translation_x;
        this._dragOrigTransY = this.translation_y;

        this._saveAndClearFocus();

        global.set_cursor(Cinnamon.Cursor.GRABBING);

        this._dragCaptureId = global.stage.connect('captured-event', (stageActor, ev) => {
            return this._onDragEvent(ev);
        });
    }

    _onDragEvent(event) {
        let type = event.type();

        if (type === Clutter.EventType.MOTION) {
            let [stageX, stageY] = event.get_coords();

            this.translation_x = this._dragOrigTransX + (stageX - this._dragStartX);
            this.translation_y = this._dragOrigTransY + (stageY - this._dragStartY);
        } else if (type === Clutter.EventType.BUTTON_RELEASE) {
            this._endDrag();
        } else if (type === Clutter.EventType.KEY_PRESS &&
                   event.get_key_symbol() === Clutter.KEY_Escape) {
            this.translation_x = this._dragOrigTransX;
            this.translation_y = this._dragOrigTransY;
            this._endDrag();
        }

        // Swallow everything during a drag - keybindings firing mid-drag
        // produce weird behavior (focus jumps, workspace switches, etc.).
        return Clutter.EVENT_STOP;
    }

    _endDrag() {
        global.unset_cursor();

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
