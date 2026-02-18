// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const AccountsService = imports.gi.AccountsService;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Pango = imports.gi.Pango;

const AuthClient = imports.misc.authClient;
const CinnamonEntry = imports.ui.cinnamonEntry;
const KeyboardManager = imports.ui.keyboardManager;
const ScreenShield = imports.ui.screensaver.screenShield;
const UserWidget = imports.ui.userWidget;
const Util = imports.misc.util;
const Main = imports.ui.main;

const IDLE_TIMEOUT = 30;  // seconds - hide dialog after this much idle time
const DEBUG_IDLE = false;  // Set to true for 5-second timeout during development

var UnlockDialog = GObject.registerClass(
class UnlockDialog extends St.BoxLayout {
    _init(screenShield) {
        super._init({
            vertical: true,
            reactive: true,
            visible: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            y_expand: true
        });

        this._screenShield = screenShield;
        this._idleMonitor = Meta.IdleMonitor.get_core();
        this._idleWatchId = 0;

        this._dialogBox = new St.BoxLayout({
            style_class: 'dialog prompt-dialog',
            important: true,
            vertical: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER
        });
        this.add_child(this._dialogBox);

        this._contentLayout = new St.BoxLayout({
            style_class: 'dialog-content-box',
            important: true,
            vertical: true
        });
        this._dialogBox.add_child(this._contentLayout);

        let username = GLib.get_user_name();
        this._userManager = AccountsService.UserManager.get_default();
        this._user = this._userManager.get_user(username);

        this._userWidget = new UserWidget.UserWidget(this._user, Clutter.Orientation.VERTICAL);
        this._userWidget.x_align = Clutter.ActorAlign.CENTER;
        this._contentLayout.add_child(this._userWidget);

        let passwordBox = new St.BoxLayout({
            style_class: 'prompt-dialog-password-layout',
            important: true,
            vertical: true
        });
        this._contentLayout.add_child(passwordBox);

        this._passwordEntry = new St.PasswordEntry({
            style_class: 'prompt-dialog-password-entry',
            important: true,
            hint_text: _("Password"),
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER
        });
        passwordBox.add_child(this._passwordEntry);

        this._capsLockWarning = new CinnamonEntry.CapsLockWarning();
        this._capsLockWarning.x_align = Clutter.ActorAlign.CENTER;
        passwordBox.add_child(this._capsLockWarning);

        // Info label (for auth-info messages from PAM)
        this._infoLabel = new St.Label({
            style_class: 'prompt-dialog-info-label',
            important: true,
            text: '',
            x_align: Clutter.ActorAlign.CENTER
        });
        this._infoLabel.clutter_text.line_wrap = true;
        this._infoLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        passwordBox.add_child(this._infoLabel);

        // Message label (for errors)
        this._messageLabel = new St.Label({
            style_class: 'prompt-dialog-error-label',
            important: true,
            text: '',
            x_align: Clutter.ActorAlign.CENTER
        });
        this._messageLabel.clutter_text.line_wrap = true;
        this._messageLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        passwordBox.add_child(this._messageLabel);

        this._sourceChangedId = 0;
        this._inputSourceManager = KeyboardManager.getInputSourceManager();
        this._systemSourceIndex = null;

        if (this._inputSourceManager.multipleSources) {
            this._updateLayoutIndicator();
            this._passwordEntry.connect('primary-icon-clicked', () => {
                let currentIndex = this._inputSourceManager.currentSource.index;
                let nextIndex = (currentIndex + 1) % this._inputSourceManager.numInputSources;
                this._inputSourceManager.activateInputSourceIndex(nextIndex);
            });

            this._sourceChangedId = this._inputSourceManager.connect(
                'current-source-changed', this._updateLayoutIndicator.bind(this));
        }

        this._buttonLayout = new St.Widget({
            style_class: 'dialog-button-box',
            important: true,
            layout_manager: new Clutter.BoxLayout({
                homogeneous: true,
                spacing: 12 * global.ui_scale
            })
        });
        this._dialogBox.add(this._buttonLayout, {
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });

        this._cancelButton = new St.Button({
            style_class: 'dialog-button',
            important: true,
            label: _("Cancel"),
            reactive: true,
            can_focus: true,
            x_expand: true,
            y_expand: true
        });
        this._cancelButton.connect('clicked', this._onCancel.bind(this));
        this._buttonLayout.add_child(this._cancelButton);

        this._screensaverSettings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.screensaver' });
        if (this._screensaverSettings.get_boolean('user-switch-enabled') &&
            !Main.lockdownSettings.get_boolean('disable-user-switching')) {
            this._switchUserButton = new St.Button({
                style_class: 'dialog-button',
                important: true,
                label: _("Switch User"),
                can_focus: true,
                reactive: true,
                x_expand: true,
                y_expand: true
            });
            this._switchUserButton.connect('clicked', this._onSwitchUser.bind(this));
            this._buttonLayout.add_child(this._switchUserButton);
        }

        this._unlockButton = new St.Button({
            style_class: 'dialog-button',
            important: true,
            label: _("Unlock"),
            can_focus: true,
            reactive: false,
            x_expand: true,
            y_expand: true
        });
        this._unlockButton.add_style_pseudo_class('default');
        this._unlockButton.connect('clicked', this._onUnlock.bind(this));
        this._buttonLayout.add_child(this._unlockButton);

        this._passwordEntry.clutter_text.connect('text-changed', text => {
            this._unlockButton.reactive = text.get_text().length > 0;
        });

        this._authClient = new AuthClient.AuthClient();
        this._authClient.connect('auth-success', this._onAuthSuccess.bind(this));
        this._authClient.connect('auth-failure', this._onAuthFailure.bind(this));
        this._authClient.connect('auth-cancel', this._onAuthCancel.bind(this));
        this._authClient.connect('auth-busy', this._onAuthBusy.bind(this));
        this._authClient.connect('auth-prompt', this._onAuthPrompt.bind(this));
        this._authClient.connect('auth-info', this._onAuthInfo.bind(this));
        this._authClient.connect('auth-error', this._onAuthError.bind(this));

        this._passwordEntry.clutter_text.connect('activate', this._onUnlock.bind(this));
        this.connect('key-press-event', this._onKeyPress.bind(this));
    }

    saveSystemLayout() {
        if (!this._inputSourceManager.multipleSources)
            return;

        let currentSource = this._inputSourceManager.currentSource;
        if (currentSource)
            this._systemSourceIndex = currentSource.index;
    }

    _applyLockscreenLayout() {
        if (!this._inputSourceManager.multipleSources)
            return;

        let savedIndex = this._screensaverSettings.get_int('layout-group');

        if (savedIndex < 0) {
            savedIndex = this._inputSourceManager.currentSource.index;
            this._screensaverSettings.set_int('layout-group', savedIndex);
        }

        if (savedIndex !== this._inputSourceManager.currentSource.index)
            this._inputSourceManager.activateInputSourceIndex(savedIndex);
    }

    _saveLockscreenLayout() {
        if (!this._inputSourceManager.multipleSources)
            return;

        let currentSource = this._inputSourceManager.currentSource;
        if (currentSource)
            this._screensaverSettings.set_int('layout-group', currentSource.index);
    }

    restoreSystemLayout() {
        if (!this._inputSourceManager.multipleSources)
            return;

        this._saveLockscreenLayout();

        if (this._systemSourceIndex !== null &&
            this._systemSourceIndex !== this._inputSourceManager.currentSource.index) {
            this._inputSourceManager.activateInputSourceIndex(this._systemSourceIndex);
        }

        this._systemSourceIndex = null;
    }

    _updateLayoutIndicator() {
        let source = this._inputSourceManager.currentSource;
        if (!source)
            return;

        let icon = null;

        if (this._inputSourceManager.showFlags)
            icon = this._inputSourceManager.createFlagIcon(source, null, 16);

        if (!icon)
            icon = new St.Label({ text: source.shortName });

        this._passwordEntry.set_primary_icon(icon);
    }

    _onKeyPress(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Escape) {
            this._onCancel();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onUnlock() {
        let password = this._passwordEntry.get_text();

        if (password.length == 0)
            return;

        this._authClient.sendPassword(password);
        this._passwordEntry.set_text('');
    }

    _onAuthPrompt(authClient, prompt) {
        let hintText;
        if (prompt.toLowerCase().includes('password:')) {
            hintText = _("Please enter your password...");
        } else {
            hintText = prompt.replace(/:$/, '');
        }
        if (ScreenShield._debug)
            global.log(`UnlockDialog: prompt='${prompt}', hintText='${hintText}'`);

        this._infoLabel.text = '';
        this._passwordEntry.hint_text = hintText;
        this._setPasswordEntryVisible(true);
        global.stage.set_key_focus(this._passwordEntry);
    }

    _onAuthInfo(authClient, info) {
        this._infoLabel.text = info;
    }

    _onAuthError(authClient, error) {
        this._messageLabel.text = error;
    }

    _onAuthSuccess() {
        this._setBusy(false);
        this._messageLabel.text = '';
        this._infoLabel.text = '';
        this._screenShield.unlock();
    }

    _onAuthFailure() {
        this._setBusy(false);

        this._infoLabel.text = '';
        this._passwordEntry.set_text('');
        this._setPasswordEntryVisible(false);
        Util.wiggle(this._dialogBox);
    }

    _onAuthCancel() {
        this._setBusy(false);
        this._messageLabel.text = '';
        this._infoLabel.text = '';
    }

    _onAuthBusy(authClient, busy) {
        this._setBusy(busy);
    }

    _setBusy(busy) {
        if (busy) {
            this._messageLabel.text = '';
            this._infoLabel.text = '';

            this._passwordEntry.reactive = false;
            this._passwordEntry.hint_text = _("Checking...");
        } else {
            this._passwordEntry.reactive = true;
        }
    }

    _onCancel() {
        if (this._authClient && this._authClient.initialized) {
            this._authClient.cancel();
        }

        this._screenShield.hideUnlockDialog();
    }

    _onSwitchUser() {
        Util.switchToGreeter();
    }

    initializePam() {
        if (!this._authClient.initialized)
            return this._authClient.initialize();

        return true;
    }

    _setPasswordEntryVisible(visible) {
        if (visible) {
            this._passwordEntry.show();
            this._unlockButton.show();
            this._capsLockWarning.show();
        } else {
            this._passwordEntry.hide();
            this._unlockButton.hide();
            this._capsLockWarning.hide();
        }
    }

    show() {
        this._passwordEntry.text = '';
        this._messageLabel.text = '';
        this._infoLabel.text = '';
        this._passwordEntry.reactive = true;
        this._passwordEntry.hint_text = _("Password");

        this._setPasswordEntryVisible(false);

        this._applyLockscreenLayout();
        this._startIdleWatch();

        super.show();
    }

    hide() {
        if (this._authClient && this._authClient.initialized) {
            this._authClient.cancel();
        }

        this._stopIdleWatch();

        super.hide();
    }

    addCharacter(unichar) {
        // Add a character to the password entry (for forwarding the first keypress)
        this._passwordEntry.clutter_text.insert_unichar(unichar);
    }

    _startIdleWatch() {
        this._stopIdleWatch();
        let timeout = (DEBUG_IDLE ? 5 : IDLE_TIMEOUT) * 1000;
        this._idleWatchId = this._idleMonitor.add_idle_watch(timeout, () => {
            this._screenShield.hideUnlockDialog();
        });
    }

    _stopIdleWatch() {
        if (this._idleWatchId) {
            this._idleMonitor.remove_watch(this._idleWatchId);
            this._idleWatchId = 0;
        }
    }

    vfunc_destroy() {
        if (this._sourceChangedId && this._inputSourceManager) {
            this._inputSourceManager.disconnect(this._sourceChangedId);
            this._sourceChangedId = 0;
        }

        if (this._authClient) {
            if (this._authClient.initialized) {
                this._authClient.cancel();
            }
            this._authClient = null;
        }

        this._stopIdleWatch();

        super.vfunc_destroy();
    }
});
