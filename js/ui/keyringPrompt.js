const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Pango = imports.gi.Pango;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gcr = imports.gi.Gcr;

const Dialog = imports.ui.dialog;
const ModalDialog = imports.ui.modalDialog;
const CinnamonEntry = imports.ui.cinnamonEntry;
const CheckBox = imports.ui.checkBox;
const Util = imports.misc.util;

var KeyringDialog = GObject.registerClass(
class KeyringDialog extends ModalDialog.ModalDialog {
    _init() {
        super._init({ styleClass: 'prompt-dialog' });

        this.prompt = new Cinnamon.KeyringPrompt();
        this.prompt.connect('show-password', this._onShowPassword.bind(this));
        this.prompt.connect('show-confirm', this._onShowConfirm.bind(this));
        this.prompt.connect('prompt-close', this._onHidePrompt.bind(this));

        let content = new Dialog.MessageDialogContent();

        this.prompt.bind_property('message',
            content, 'title', GObject.BindingFlags.SYNC_CREATE);
        this.prompt.bind_property('description',
            content, 'description', GObject.BindingFlags.SYNC_CREATE);

        let passwordBox = new St.BoxLayout({
            style_class: 'prompt-dialog-password-layout',
            vertical: true,
        });

        this._passwordEntry = new St.PasswordEntry({
            style_class: 'prompt-dialog-password-entry',
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        CinnamonEntry.addContextMenu(this._passwordEntry);
        this._passwordEntry.clutter_text.connect('activate', this._onPasswordActivate.bind(this));
        this.prompt.bind_property('password-visible',
            this._passwordEntry, 'visible', GObject.BindingFlags.SYNC_CREATE);
        passwordBox.add_child(this._passwordEntry);

        this._confirmEntry = new St.PasswordEntry({
            style_class: 'prompt-dialog-password-entry',
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        CinnamonEntry.addContextMenu(this._confirmEntry);
        this._confirmEntry.clutter_text.connect('activate', this._onConfirmActivate.bind(this));
        this.prompt.bind_property('confirm-visible',
            this._confirmEntry, 'visible', GObject.BindingFlags.SYNC_CREATE);
        passwordBox.add_child(this._confirmEntry);

        this.prompt.set_password_actor(this._passwordEntry.clutter_text);
        this.prompt.set_confirm_actor(this._confirmEntry.clutter_text);

        let warningBox = new St.BoxLayout({ vertical: true });

        let capsLockWarning = new CinnamonEntry.CapsLockWarning();
        let syncCapsLockWarningVisibility = () => {
            capsLockWarning.visible =
                this.prompt.password_visible || this.prompt.confirm_visible;
        };
        this.prompt.connect('notify::password-visible', syncCapsLockWarningVisibility);
        this.prompt.connect('notify::confirm-visible', syncCapsLockWarningVisibility);
        warningBox.add_child(capsLockWarning);

        let warning = new St.Label({ style_class: 'prompt-dialog-error-label' });
        warning.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        warning.clutter_text.line_wrap = true;
        this.prompt.bind_property('warning',
            warning, 'text', GObject.BindingFlags.SYNC_CREATE);
        this.prompt.connect('notify::warning-visible', () => {
            warning.opacity = this.prompt.warning_visible ? 255 : 0;
        });
        this.prompt.connect('notify::warning', () => {
            if (this._passwordEntry && this.prompt.warning !== '')
                Util.wiggle(this._passwordEntry);
        });
        warningBox.add_child(warning);

        passwordBox.add_child(warningBox);
        content.add_child(passwordBox);

        this._choice = new CheckBox.CheckBox2();
        this.prompt.bind_property('choice-label', this._choice.getLabelActor(),
            'text', GObject.BindingFlags.SYNC_CREATE);
        this.prompt.bind_property('choice-chosen', this._choice,
            'checked', GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.BIDIRECTIONAL);
        this.prompt.bind_property('choice-visible', this._choice,
            'visible', GObject.BindingFlags.SYNC_CREATE);
        content.add_child(this._choice);

        this.contentLayout.add_child(content);

        this._cancelButton = this.addButton({
            label: '',
            action: this._onCancelButton.bind(this),
            key: Clutter.KEY_Escape,
        });
        this._continueButton = this.addButton({
            label: '',
            action: this._onContinueButton.bind(this),
            default: true,
        });

        this.prompt.bind_property('cancel-label', this._cancelButton,
            'label', GObject.BindingFlags.SYNC_CREATE);
        this.prompt.bind_property('continue-label', this._continueButton,
            'label', GObject.BindingFlags.SYNC_CREATE);
    }

    _updateSensitivity(sensitive) {
        if (this._passwordEntry)
            this._passwordEntry.reactive = sensitive;

        if (this._confirmEntry)
            this._confirmEntry.reactive = sensitive;

        this._continueButton.can_focus = sensitive;
        this._continueButton.reactive = sensitive;
    }

    _ensureOpen() {
        // NOTE: ModalDialog.open() is safe to call if the dialog is
        // already open - it just returns true without side-effects
        if (this.open())
            return true;

        // The above fail if e.g. unable to get input grab
        //
        // In an ideal world this wouldn't happen (because
        // Cinnamon is in complete control of the session) but that's
        // just not how things work right now.

        log('keyringPrompt: Failed to show modal dialog.' +
            ' Dismissing prompt request');
        this.prompt.cancel();
        return false;
    }

    _onShowPassword() {
        this._ensureOpen();
        this._updateSensitivity(true);
        this._passwordEntry.text = '';
        this._passwordEntry.grab_key_focus();
    }

    _onShowConfirm() {
        this._ensureOpen();
        this._updateSensitivity(true);
        this._confirmEntry.text = '';
        this._continueButton.grab_key_focus();
    }

    _onHidePrompt() {
        this.close();
    }

    _onPasswordActivate() {
        if (this.prompt.confirm_visible)
            this._confirmEntry.grab_key_focus();
        else
            this._onContinueButton();
    }

    _onConfirmActivate() {
        this._onContinueButton();
    }

    _onContinueButton() {
        this._updateSensitivity(false);
        this.prompt.complete();
    }

    _onCancelButton() {
        this.prompt.cancel();
    }
});

function init() {
    prompter = new Gcr.SystemPrompter();
    prompter.connect('new-prompt', () => {
        let dialog = new KeyringDialog();
        return dialog.prompt;
    });

    let connection = Gio.DBus.session;
    prompter.register(connection);
    Gio.bus_own_name_on_connection (connection, 'org.gnome.keyring.SystemPrompter',
                                    Gio.BusNameOwnerFlags.ALLOW_REPLACEMENT, null, null);
}
