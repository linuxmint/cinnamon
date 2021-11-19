// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const St = imports.gi.St;
const Atk = imports.gi.Atk;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Pango = imports.gi.Pango;

const Params = imports.misc.params;
const Util = imports.misc.util;

const Lightbox = imports.ui.lightbox;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const Gettext = imports.gettext;

const FADE_IN_BUTTONS_TIME = 0.33;
const FADE_OUT_DIALOG_TIME = 1.0;

var OPEN_AND_CLOSE_TIME = 0.1;

var State = {
    OPENED: 0,
    CLOSED: 1,
    OPENING: 2,
    CLOSING: 3,
    FADED_OUT: 4
};

/**
 * #ModalDialog:
 * @short_description: A generic object that displays a modal dialog
 * @state (ModalDialog.State): The state of the modal dialog, which may be
 * `ModalDialog.State.OPENED`, `CLOSED`, `OPENING`, `CLOSING` or `FADED_OUT`.
 * @contentLayout (St.BoxLayout): The box containing the contents of the modal
 * dialog (excluding the buttons)
 *
 * The #ModalDialog object is a generic popup dialog in Cinnamon. It can either
 * be created directly and then manipulated afterwards, or used as a base class
 * for more sophisticated modal dialog.
 *
 * For simple usage such as displaying a message, or asking for confirmation,
 * the #ConfirmDialog and #NotifyDialog classes may be used instead.
 */
function ModalDialog() {
    this._init();
}

ModalDialog.prototype = {
    /**
     * _init:
     * @params (JSON): parameters for the modal dialog. Options include
     * @cinnamonReactive, which determines whether the modal dialog should
     * block Cinnamon input, and @styleClass, which is the style class the
     * modal dialog should use.
     */
    _init: function(params) {
        params = Params.parse(params, { cinnamonReactive: false,
                                        styleClass: null });

        this.state = State.CLOSED;
        this._hasModal = false;
        this._cinnamonReactive = params.cinnamonReactive;

        this._group = new St.Widget({ visible: false,
                                      x: 0,
                                      y: 0,
                                      accessible_role: Atk.Role.DIALOG });
        Main.uiGroup.add_actor(this._group);

        let constraint = new Clutter.BindConstraint({ source: global.stage,
                                                      coordinate: Clutter.BindCoordinate.POSITION | Clutter.BindCoordinate.SIZE });
        this._group.add_constraint(constraint);

        this._group.connect('destroy', Lang.bind(this, this._onGroupDestroy));

        this._actionKeys = {};
        this._group.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));

        this._backgroundBin = new St.Bin();
        this._group.add_actor(this._backgroundBin);

        this._dialogLayout = new St.BoxLayout({ style_class: 'modal-dialog',
                                                vertical:    true });
        if (params.styleClass != null) {
            this._dialogLayout.add_style_class_name(params.styleClass);
        }

        if (!this._cinnamonReactive) {
            this._lightbox = new Lightbox.Lightbox(this._group,
                                                   { inhibitEvents: true,
                                                     radialEffect: true });
            this._lightbox.highlight(this._backgroundBin);

            let stack = new Cinnamon.Stack();
            this._backgroundBin.child = stack;

            this._eventBlocker = new Clutter.Group({ reactive: true });
            stack.add_actor(this._eventBlocker);
            stack.add_actor(this._dialogLayout);
        } else {
            this._backgroundBin.child = this._dialogLayout;
        }


        this.contentLayout = new St.BoxLayout({ vertical: true });
        this._dialogLayout.add(this.contentLayout,
                               { x_fill:  true,
                                 y_fill:  true,
                                 x_align: St.Align.MIDDLE,
                                 y_align: St.Align.START });

        this._buttonLayout = new St.BoxLayout({ style_class: 'modal-dialog-button-box',
                                                vertical:    false });
        this._dialogLayout.add(this._buttonLayout,
                               { expand:  true,
                                 x_align: St.Align.MIDDLE,
                                 y_align: St.Align.END });

        global.focus_manager.add_group(this._dialogLayout);
        this._initialKeyFocus = this._dialogLayout;
        this._savedKeyFocus = null;
    },

    /**
     * destroy:
     *
     * Destroys the modal dialog
     */
    destroy: function() {
        this._group.destroy();
    },

    /**
     * setButtons:
     * @buttons (array): the buttons to display in the modal dialog
     *
     * This sets the buttons in the modal dialog. The buttons is an array of
     * JSON objects, each of which corresponds to one button.
     *
     * Each JSON object *must* contain @label and @action, which are the text
     * displayed on the button and the callback function to use when the button
     * is clicked respectively.
     *
     * Optional arguments include @focused, which determines whether the button
     * is initially focused, and @key, which is a keybinding associated with
     * the button press such that pressing the keybinding will have the same
     * effect as clicking the button.
     *
     * An example usage is
     * ```
     * dialog.setButtons([
     *     {
     *         label: _("Cancel"),
     *         action: Lang.bind(this, this.callback),
     *         key: Clutter.KEY_Escape
     *     },
     *     {
     *         label: _("OK"),
     *         action: Lang.bind(this, this.destroy),
     *         key: Clutter.KEY_Return
     *     }
     * ]);
     * ```
     */
    setButtons: function(buttons) {
        let hadChildren = this._buttonLayout.get_n_children() > 0;

        this._buttonLayout.destroy_all_children();
        this._actionKeys = {};
        let focusSetExplicitly = false;

        for (let i = 0; i < buttons.length; i ++) {
            let buttonInfo = buttons[i];
            if (!buttonInfo.focused) {
                buttonInfo.focused = false;
            }
            let label = buttonInfo['label'];
            let action = buttonInfo['action'];
            let key = buttonInfo['key'];
            let wantsfocus = buttonInfo['focused'] === true;
            let nofocus = buttonInfo['focused'] === false;
            buttonInfo.button = new St.Button({ style_class: 'modal-dialog-button',
                                                reactive:    true,
                                                can_focus:   true,
                                                label:       label });

            let x_alignment;
            if (buttons.length == 1)
                x_alignment = St.Align.END;
            else if (i == 0)
                x_alignment = St.Align.START;
            else if (i == buttons.length - 1)
                x_alignment = St.Align.END;
            else
                x_alignment = St.Align.MIDDLE;

            if (wantsfocus) {
                this._initialKeyFocus = buttonInfo.button;
                focusSetExplicitly = true;
            }

            if (!focusSetExplicitly && !nofocus && (this._initialKeyFocus == this._dialogLayout ||
                this._buttonLayout.contains(this._initialKeyFocus)))
            {
                this._initialKeyFocus = buttonInfo.button;
            }
            this._buttonLayout.add(buttonInfo.button,
                                   { expand: true,
                                     x_fill: false,
                                     y_fill: false,
                                     x_align: x_alignment,
                                     y_align: St.Align.MIDDLE });

            buttonInfo.button.connect('clicked', action);

            if (key)
                this._actionKeys[key] = action;
        }

        // Fade in buttons if there weren't any before
        if (!hadChildren && buttons.length > 0) {
            this._buttonLayout.opacity = 0;
            Tweener.addTween(this._buttonLayout,
                             { opacity: 255,
                               time: FADE_IN_BUTTONS_TIME,
                               transition: 'easeOutQuad',
                               onComplete: Lang.bind(this, function() {
                                   this.emit('buttons-set');
                               })
                             });
        } else {
            this.emit('buttons-set');
        }

    },

    _onKeyPressEvent: function(object, keyPressEvent) {
        let modifiers = Cinnamon.get_event_state(keyPressEvent);
        let ctrlAltMask = Clutter.ModifierType.CONTROL_MASK | Clutter.ModifierType.MOD1_MASK;
        let symbol = keyPressEvent.get_key_symbol();
        if (symbol === Clutter.KEY_Escape && !(modifiers & ctrlAltMask)) {
            this.close();
            return;
        }

        let action = this._actionKeys[symbol];

        if (action)
            action();
    },

    _onGroupDestroy: function() {
        this.emit('destroy');
    },

    _fadeOpen: function() {
        let monitor = Main.layoutManager.currentMonitor;

        this._backgroundBin.set_position(monitor.x, monitor.y);
        this._backgroundBin.set_size(monitor.width, monitor.height);

        this.state = State.OPENING;

        this._dialogLayout.opacity = 255;
        if (this._lightbox)
            this._lightbox.show();
        this._group.opacity = 0;
        this._group.show();
        Tweener.addTween(this._group,
                         { opacity: 255,
                           time: OPEN_AND_CLOSE_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this,
                               function() {
                                   this.state = State.OPENED;
                                   this.emit('opened');
                               })
                         });
    },

    setInitialKeyFocus: function(actor) {
        this._initialKeyFocus = actor;
    },

    /**
     * open:
     * @timestamp (int): (optional) timestamp optionally used to associate the
     * call with a specific user initiated event
     *
     * Opens and displays the modal dialog.
     */
    open: function(timestamp) {
        if (this.state == State.OPENED || this.state == State.OPENING)
            return true;

        if (!this.pushModal(timestamp))
            return false;

        this._fadeOpen();
        return true;
    },

    /**
     * close:
     * @timestamp (int): (optional) timestamp optionally used to associate the
     * call with a specific user initiated event
     *
     * Closes the modal dialog.
     */
    close: function(timestamp) {
        if (this.state == State.CLOSED || this.state == State.CLOSING)
            return;

        this.state = State.CLOSING;
        this.popModal(timestamp);
        this._savedKeyFocus = null;

        Tweener.addTween(this._group,
                         { opacity: 0,
                           time: OPEN_AND_CLOSE_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this,
                               function() {
                                   this.state = State.CLOSED;
                                   this._group.hide();
                               })
                         });
    },

    /**
     * popModal:
     * @timestamp (int): (optional) timestamp optionally used to associate the
     * call with a specific user initiated event
     *
     * Drop modal status without closing the dialog; this makes the
     * dialog insensitive as well, so it needs to be followed shortly
     * by either a %close() or a %pushModal()
     */
    popModal: function(timestamp) {
        if (!this._hasModal)
            return;

        let focus = global.stage.key_focus;
        if (focus && this._group.contains(focus))
            this._savedKeyFocus = focus;
        else
            this._savedKeyFocus = null;
        Main.popModal(this._group, timestamp);
        global.gdk_screen.get_display().sync();
        this._hasModal = false;

        if (!this._cinnamonReactive)
            this._eventBlocker.raise_top();
    },

    /**
     * pushModal:
     * @timestamp (int): (optional) timestamp optionally used to associate the
     * call with a specific user initiated event
     *
     * Pushes the modal to the modal stack so that it grabs the required
     * inputs.
     */
    pushModal: function (timestamp) {
        if (this._hasModal)
            return true;
        if (!Main.pushModal(this._group, timestamp))
            return false;

        this._hasModal = true;
        if (this._savedKeyFocus) {
            this._savedKeyFocus.grab_key_focus();
            this._savedKeyFocus = null;
        } else
            this._initialKeyFocus.grab_key_focus();

        if (!this._cinnamonReactive)
            this._eventBlocker.lower_bottom();
        return true;
    },

    /**
     * _fadeOutDialog:
     * @timestamp (int): (optional) timestamp optionally used to associate the
     * call with a specific user initiated event
     *
     * This method is like %close(), but fades the dialog out much slower,
     * and leaves the lightbox in place. Once in the faded out state,
     * the dialog can be brought back by an open call, or the lightbox
     * can be dismissed by a close call.
     *
     * The main point of this method is to give some indication to the user
     * that the dialog response has been acknowledged but will take a few
     * moments before being processed.
     *
     * e.g., if a user clicked "Log Out" then the dialog should go away
     * immediately, but the lightbox should remain until the logout is
     * complete.
     */
    _fadeOutDialog: function(timestamp) {
        if (this.state == State.CLOSED || this.state == State.CLOSING)
            return;

        if (this.state == State.FADED_OUT)
            return;

        this.popModal(timestamp);
        Tweener.addTween(this._dialogLayout,
                         { opacity: 0,
                           time:    FADE_OUT_DIALOG_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this,
                               function() {
                                   this.state = State.FADED_OUT;
                               })
                         });
    }
};
Signals.addSignalMethods(ModalDialog.prototype);

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
function ConfirmDialog(label, callback){
    this._init(label, callback);
}

ConfirmDialog.prototype = {
    __proto__: ModalDialog.prototype,

    /**
     * _init:
     * @label (string): label to display on the confirm dialog
     * @callback (function): function to call when user clicks "yes"
     *
     * Constructor function.
     */
    _init: function(label, callback){
        ModalDialog.prototype._init.call(this);
        this.contentLayout.add(new St.Label({ text:        _("Confirm"),
                                              style_class: 'confirm-dialog-title',
                                              important:   true }));
        this.contentLayout.add(new St.Label({text: label}));
        this.callback = callback;

        this.setButtons([
            {
                label: _("No"),
                action: Lang.bind(this, this.destroy)
            },
            {
                label: _("Yes"),
                action: Lang.bind(this, function(){
                    this.destroy();
                    this.callback();
                })
            }
        ]);
    },
};

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
function NotifyDialog(label){
    this._init(label);
}

NotifyDialog.prototype = {
    __proto__: ModalDialog.prototype,

    /**
     * _init:
     * @label (string): label to display on the notify dialog
     *
     * Constructor function.
     */
    _init: function(label){
        ModalDialog.prototype._init.call(this);
        this.contentLayout.add(new St.Label({text: label}));

        this.setButtons([
            {
                label: _("OK"),
                action: Lang.bind(this, this.destroy)
            }
        ]);
    },
};

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
function InfoOSD(text) {
    this._init(text);
}

InfoOSD.prototype = {

    /**
     * _init:
     * @text (string): (optional) Text to display on the OSD
     *
     * Constructor function. Creates an OSD and adds it to the chrome. Adds a
     * label with text @text if specified.
     */
    _init: function(text) {
        this.actor = new St.BoxLayout({vertical: true, style_class: "info-osd", important: true});
        if (text) {
            let label = new St.Label({text: text});
            this.actor.add(label);
        }
        Main.layoutManager.addChrome(this.actor, {visibleInFullscreen: false, affectsInputRegion: false});
    },

    /**
     * show:
     * @monitorIndex (int): (optional) Monitor to display OSD on. Default is
     * primary monitor
     *
     * Shows the OSD at the center of monitor @monitorIndex. Shows at the
     * primary monitor if not specified.
     */
    show: function(monitorIndex) {
        if (!monitorIndex) monitorIndex = 0;
        let monitor = Main.layoutManager.monitors[monitorIndex];

        // The actor has to be shown first so that the width and height can be calculated properly
        this.actor.opacity = 0;
        this.actor.show();

        let x = monitor.x + Math.round((monitor.width - this.actor.width)/2);
        let y = monitor.y + Math.round((monitor.height - this.actor.height)/2);

        this.actor.set_position(x, y);
        this.actor.opacity = 255;
    },

    /**
     * hide:
     *
     * Hides the OSD.
     */
    hide: function() {
        this.actor.hide();
    },

    /**
     * destroy:
     *
     * Destroys the OSD
     */
    destroy: function() {
        this.hide();
        Main.layoutManager.removeChrome(this.actor);
        this.actor.destroy();
    },

    /**
     * addText:
     * @text (string): text to display
     * @params (JSON): parameters to be used when adding text
     *
     * Adds a text label displaying @text to the OSD
     */
    addText: function(text, params) {
        let label = new St.Label({text: text});
        this.actor.add(label, params);
    },

    /**
     * addActor:
     * @actor (St.Widget): actor to add
     * @params (JSON): parameters to be used when adding actor
     *
     * Adds the actor @actor to the OSD
     */
    addActor: function(actor, params) {
        this.actor.add(actor, params);
    }
}
