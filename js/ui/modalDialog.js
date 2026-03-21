// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Atk = imports.gi.Atk;
const Cinnamon = imports.gi.Cinnamon;
const GObject = imports.gi.GObject;
const Meta = imports.gi.Meta;
const Gdk = imports.gi.Gdk;

const Params = imports.misc.params;

const BaseDialog = imports.ui.baseDialog;
const Dialog = imports.ui.dialog;
const Layout = imports.ui.layout;
const Lightbox = imports.ui.lightbox;
const Main = imports.ui.main;

var State = BaseDialog.State;

/**
 * #ModalDialog:
 * @short_description: A generic object that displays a modal dialog
 * @state (ModalDialog.State): The state of the modal dialog, which may be
 * `ModalDialog.State.OPENED`, `CLOSED`, `OPENING` or `CLOSING`.
 * @contentLayout (St.BoxLayout): The box containing the contents of the modal
 * dialog (excluding the buttons)
 *
 * The #ModalDialog object is a generic popup dialog in Cinnamon. It can either
 * be created directly and then manipulated afterwards, or used as a base class
 * for more sophisticated modal dialog.
 *
 * For simple usage such as displaying a message, or asking for confirmation,
 * the #ConfirmDialog and #NotifyDialog classes may be used instead.
 *
 * Inherits: BaseDialog.BaseDialog
 */
var ModalDialog = GObject.registerClass(
class ModalDialog extends BaseDialog.BaseDialog {
    /**
     * _init:
     * @params (JSON): parameters for the modal dialog. Options include
     * @cinnamonReactive, which determines whether the modal dialog should
     * block Cinnamon input, and @styleClass, which is the style class the
     * modal dialog should use.
     */
    _init(params) {
        params = Params.parse(params, {
            cinnamonReactive: Main.virtualKeyboardManager.enabled,
            styleClass: null,
            destroyOnClose: true,
        });

        super._init({
            visible: false,
            x: 0,
            y: 0,
            accessible_role: Atk.Role.DIALOG,
        }, {
            destroyOnClose: params.destroyOnClose,
        });

        this._hasModal = false;
        this._savedKeyFocus = null;
        this._cinnamonReactive = params.cinnamonReactive;

        Main.uiGroup.add_actor(this);

        let constraint = new Clutter.BindConstraint({
            source: global.stage,
            coordinate: Clutter.BindCoordinate.POSITION | Clutter.BindCoordinate.SIZE
        });
        this.add_constraint(constraint);

        this.backgroundStack = new St.Widget({ layout_manager: new Clutter.BinLayout() });
        this._backgroundBin = new St.Bin({
            child: this.backgroundStack,
            x_fill: true,
            y_fill: true
        });
        this._monitorConstraint = new Layout.MonitorConstraint({ work_area: true });
        this._backgroundBin.add_constraint(this._monitorConstraint);
        this.add_actor(this._backgroundBin);

        this._initDialogLayout(new Dialog.Dialog(this.backgroundStack, params.styleClass));

        let enableRadialEffect = true;
        if (!global.settings.get_boolean("desktop-effects-workspace")) {
            enableRadialEffect = false;
        }

        if (!this._cinnamonReactive) {
            this._lightbox = new Lightbox.Lightbox(this,
                                                   { inhibitEvents: true,
                                                     radialEffect: enableRadialEffect });
            this._lightbox.highlight(this._backgroundBin);

            this._eventBlocker = new Clutter.Actor({ reactive: true });
            this.backgroundStack.add_actor(this._eventBlocker);
        }
    }

    _fadeOpen() {
        this._monitorConstraint.index = global.display.get_current_monitor();

        Main.uiGroup.set_child_above_sibling(this, null);

        if (this._lightbox)
            this._lightbox.lightOn();

        this._animateOpen();
    }

    /**
     * open:
     * @timestamp (int): (optional) timestamp optionally used to associate the
     * call with a specific user initiated event
     *
     * Opens and displays the modal dialog.
     */
    open(timestamp) {
        if (this.state == State.OPENED || this.state == State.OPENING)
            return true;

        if (!this.pushModal(timestamp))
            return false;

        this._fadeOpen();

        this._openedId = this.connect('opened', () => {
            this.disconnect(this._openedId);
            this._openedId = 0;
            this._grabInitialKeyFocus();
        });

        return true;
    }

    /**
     * close:
     * @timestamp (int): (optional) timestamp optionally used to associate the
     * call with a specific user initiated event
     *
     * Closes the modal dialog.
     */
    close(timestamp) {
        if (this.state == State.CLOSED || this.state == State.CLOSING)
            return;

        if (this._openedId) {
            this.disconnect(this._openedId);
            this._openedId = 0;
        }

        this.popModal(timestamp);
        this._savedKeyFocus = null;

        this._animateClose();
    }

    /**
     * popModal:
     * @timestamp (int): (optional) timestamp optionally used to associate the
     * call with a specific user initiated event
     *
     * Drop modal status without closing the dialog; this makes the
     * dialog insensitive as well, so it needs to be followed shortly
     * by either a %close() or a %pushModal()
     */
    popModal(timestamp) {
        if (!this._hasModal)
            return;

        let focus = global.stage.key_focus;
        if (focus && this.contains(focus))
            this._savedKeyFocus = focus;
        else
            this._savedKeyFocus = null;
        Main.popModal(this, timestamp);

        if (!Meta.is_wayland_compositor()) {
            Gdk.Display.get_default().sync();
        }

        this._hasModal = false;

        if (!this._cinnamonReactive)
            this._eventBlocker.raise_top();
    }

    /**
     * pushModal:
     * @timestamp (int): (optional) timestamp optionally used to associate the
     * call with a specific user initiated event
     * @mode (Cinnamon.ActionMode): (optional) action mode, defaults to SYSTEM_MODAL
     *
     * Pushes the modal to the modal stack so that it grabs the required
     * inputs.
     */
    pushModal(timestamp, mode) {
        if (this._hasModal)
            return true;
        if (!Main.pushModal(this, timestamp, undefined, mode))
            return false;

        this._hasModal = true;

        if (this._savedKeyFocus) {
            this._savedKeyFocus.grab_key_focus();
            this._savedKeyFocus = null;
        }

        if (!this._cinnamonReactive)
            this._eventBlocker.lower_bottom();
        return true;
    }

});

/**
 * #ConfirmDialog
 * @short_description: A simple dialog with a "Yes" and "No" button.
 * @callback (function): Callback when "Yes" is clicked
 *
 * A confirmation dialog that calls @callback and then destroys itself if user
 * clicks "Yes". If the user clicks "No", the dialog simply destroys itself.
 *
 * Inherits: ModalDialog.ModalDialog
 */
var ConfirmDialog = GObject.registerClass(
class ConfirmDialog extends ModalDialog {

    /**
     * _init:
     * @description (string): label to display on the confirm dialog
     * @callback (function): function to call when user clicks "yes"
     *
     * Constructor function.
     */
     _init(description, callback) {
        super._init();

        let title = _("Confirm");

        let content = new Dialog.MessageDialogContent({ title, description });
        this.contentLayout.add_child(content);
        this.callback = callback;

        this.setButtons([
            {
                label: _("No"),
                action: this.destroy.bind(this),
                key: Clutter.KEY_Escape,
            },
            {
                label: _("Yes"),
                action: () => {
                    this.destroy();
                    this.callback();
                },
                destructive_action: true
            }
        ]);
    }
});

/**
 * #NotifyDialog
 * @short_description: A simple dialog that presents a message with an "OK"
 * button.
 *
 * A notification dialog that displays a message to user. Destroys itself after
 * user clicks "OK"
 *
 * Inherits: ModalDialog.ModalDialog
 */
var NotifyDialog = GObject.registerClass(
class NotifyDialog extends ModalDialog {

    /**
     * _init:
     * @description (string): label to display on the notify dialog
     *
     * Constructor function.
     */
    _init(description) {
        super._init();

        let title = _("Attention");

        let content = new Dialog.MessageDialogContent({ title, description });
        this.contentLayout.add_child(content);

        this.setButtons([
            {
                label: _("OK"),
                action: this.destroy.bind(this),
                default: true,
            }
        ]);
    }
});

/**
 * #InfoOSD
 * @short_description: An OSD that displays information to users
 * @actor (St.BoxLayout): actor of the OSD
 *
 * Creates an OSD to show information to user at the center of the screen. Can
 * display texts or a general #St.Widget. This is useful as "hints" to the
 * user, eg. the popup shown when the user clicks the "Add panel" button to
 * guide them how to add a panel.
 *
 * This does not destroy itself, and the caller of this is responsible for
 * destroying it after usage (via the %destroy function), or hiding it with
 * %hide for later reuse.
 */
var InfoOSD = class {

    /**
     * _init:
     * @text (string): (optional) Text to display on the OSD
     *
     * Constructor function. Creates an OSD and adds it to the chrome. Adds a
     * label with text @text if specified.
     */
    constructor(text) {
        this.actor = new St.BoxLayout({
            vertical: true,
            style_class: "info-osd",
            important: true
        });

        if (text) {
            let label = new St.Label({text: text});
            this.actor.add(label);
        }
        Main.layoutManager.addChrome(this.actor, {
            visibleInFullscreen: false,
            affectsInputRegion: false
        });
    }

    /**
     * show:
     * @monitorIndex (int): (optional) Monitor to display OSD on. Default is
     * primary monitor
     *
     * Shows the OSD at the center of monitor @monitorIndex. Shows at the
     * primary monitor if not specified.
     */
    show(monitorIndex) {
        let monitor;

        if (!monitorIndex) {
            monitor = Main.layoutManager.primaryMonitor;
        } else {
            monitor = Main.layoutManager.monitors[monitorIndex];
        }

        // The actor has to be shown first so that the width and height can be calculated properly
        this.actor.opacity = 0;
        this.actor.show();

        let x = monitor.x + Math.round((monitor.width - this.actor.width)/2);
        let y = monitor.y + Math.round((monitor.height - this.actor.height)/2);

        this.actor.set_position(x, y);
        this.actor.opacity = 255;
    }

    /**
     * hide:
     *
     * Hides the OSD.
     */
    hide() {
        this.actor.hide();
    }

    /**
     * destroy:
     *
     * Destroys the OSD
     */
    destroy() {
        this.hide();
        Main.layoutManager.removeChrome(this.actor);
    }

    /**
     * addText:
     * @text (string): text to display
     * @params (JSON): parameters to be used when adding text
     *
     * Adds a text label displaying @text to the OSD
     */
    addText(text, params) {
        let label = new St.Label({text: text});
        this.actor.add(label, params);
    }

    /**
     * addActor:
     * @actor (St.Widget): actor to add
     * @params (JSON): parameters to be used when adding actor
     *
     * Adds the actor @actor to the OSD
     */
    addActor(actor, params) {
        this.actor.add(actor, params);
    }
};
