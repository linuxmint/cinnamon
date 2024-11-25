// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/*
 * Copyright 2010 Red Hat, Inc
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street - Suite 500, Boston, MA
 * 02110-1335, USA.
*
 * Author: David Zeuthen <davidz@redhat.com>
 */

const Signals = imports.signals;
const Cinnamon = imports.gi.Cinnamon;
const AccountsService = imports.gi.AccountsService;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Pango = imports.gi.Pango;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Polkit = imports.gi.Polkit;
const PolkitAgent = imports.gi.PolkitAgent;

const Dialog = imports.ui.dialog;
const ModalDialog = imports.ui.modalDialog;
const CinnamonEntry = imports.ui.cinnamonEntry;
const UserWidget = imports.ui.userWidget;
const Util = imports.misc.util;

const DIALOG_ICON_SIZE = 64;
const DELAYED_RESET_TIMEOUT = 200;

var AuthenticationDialog = GObject.registerClass({
    Signals: { 'done': { param_types: [GObject.TYPE_BOOLEAN] } }
}, class AuthenticationDialog extends ModalDialog.ModalDialog {
    _init(actionId, description, cookie, userNames) {
        super._init({ styleClass: 'prompt-dialog' });

        this.actionId = actionId;
        this.message = description;
        this.userNames = userNames;
        this._wasDismissed = false;

        this.connect('closed', this._onDialogClosed.bind(this));

        let title = _("Authentication Required");

        let headerContent = new Dialog.MessageDialogContent({ title, description });
        this.contentLayout.add_child(headerContent);

        let bodyContent = new Dialog.MessageDialogContent();

        if (userNames.length > 1) {
            log('polkitAuthenticationAgent: Received ' + userNames.length +
                ' identities that can be used for authentication. Only ' +
                'considering the first one.');
        }

        let userName = GLib.get_user_name();
        if (!userNames.includes(userName))
            userName = 'root';
        if (!userNames.includes(userName))
            userName = userNames[0];

        this._user = AccountsService.UserManager.get_default().get_user(userName);

        let userBox = new St.BoxLayout({
            style_class: 'polkit-dialog-user-layout',
            important: true,
            vertical: true,
        });
        bodyContent.add_child(userBox);

        this._userAvatar = new UserWidget.Avatar(this._user, {
            iconSize: DIALOG_ICON_SIZE,
        });
        this._userAvatar.x_align = Clutter.ActorAlign.CENTER;
        userBox.add(this._userAvatar, { x_fill: false });

        this._userLabel = new St.Label({
            style_class: userName === 'root'
                ? 'polkit-dialog-user-root-label'
                : 'polkit-dialog-user-label',
        });

        if (userName === 'root')
            this._userLabel.text = _('Administrator');

        userBox.add_child(this._userLabel);

        let passwordBox = new St.BoxLayout({
            style_class: 'prompt-dialog-password-layout',
            vertical: true,
        });

        this._passwordEntry = new St.PasswordEntry({
            style_class: 'prompt-dialog-password-entry',
            text: "",
            can_focus: true,
            visible: false,
            x_align: Clutter.ActorAlign.CENTER,
        });
        CinnamonEntry.addContextMenu(this._passwordEntry);
        this._passwordEntry.clutter_text.connect('activate', this._onEntryActivate.bind(this));
        this._passwordEntry.bind_property('reactive',
            this._passwordEntry.clutter_text, 'editable',
            GObject.BindingFlags.SYNC_CREATE);
        passwordBox.add_child(this._passwordEntry);

        let warningBox = new St.BoxLayout({ vertical: true });

        let capsLockWarning = new CinnamonEntry.CapsLockWarning();
        this._passwordEntry.bind_property('visible',
            capsLockWarning, 'visible',
            GObject.BindingFlags.SYNC_CREATE);
        warningBox.add_child(capsLockWarning);

        this._errorMessageLabel = new St.Label({
            style_class: 'prompt-dialog-error-label',
            visible: false,
        });
        this._errorMessageLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._errorMessageLabel.clutter_text.line_wrap = true;

        warningBox.add_child(this._errorMessageLabel);

        this._infoMessageLabel = new St.Label({
            style_class: 'prompt-dialog-info-label',
            visible: false,
        });
        this._infoMessageLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._infoMessageLabel.clutter_text.line_wrap = true;

        warningBox.add_child(this._infoMessageLabel);

        /* text is intentionally non-blank otherwise the height is not the same as for
         * infoMessage and errorMessageLabel - but it is still invisible because
         * cinnamon.css sets the color to be transparent
         */
        this._nullMessageLabel = new St.Label({ style_class: 'prompt-dialog-null-label' });
        this._nullMessageLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._nullMessageLabel.clutter_text.line_wrap = true;

        warningBox.add_child(this._nullMessageLabel);

        passwordBox.add_child(warningBox);
        bodyContent.add_child(passwordBox);

        this._cancelButton = this.addButton({
            label: _("Cancel"),
            action: this.cancel.bind(this),
            key: Clutter.Escape
        });
        this._okButton = this.addButton({
            label:  _("Authenticate"),
            action: this._onAuthenticateButtonPressed.bind(this),
            reactive: false,
            default: true
        });
        this._okButton.bind_property('reactive',
            this._okButton, 'can-focus',
            GObject.BindingFlags.SYNC_CREATE);

        this._passwordEntry.clutter_text.connect('text-changed', text => {
            this._okButton.reactive = text.get_text().length > 0;
        });

        this.contentLayout.add_child(bodyContent);

        this._doneEmitted = false;

        this._identityToAuth = Polkit.UnixUser.new_for_name(userName);
        this._cookie = cookie;

        this._userLoadedId = this._user.connect('notify::is-loaded',
            this._onUserChanged.bind(this));
        this._userChangedId = this._user.connect('changed',
            this._onUserChanged.bind(this));
        this._onUserChanged();
    }

    performAuthentication() {
        this._destroySession(DELAYED_RESET_TIMEOUT);
        this._session = new PolkitAgent.Session({
            identity: this._identityToAuth,
            cookie: this._cookie
        });
        this._sessionCompletedId = this._session.connect('completed', this._onSessionCompleted.bind(this));
        this._sessionRequestId = this._session.connect('request', this._onSessionRequest.bind(this));
        this._sessionShowErrorId = this._session.connect('show-error', this._onSessionShowError.bind(this));
        this._sessionShowInfoId = this._session.connect('show-info', this._onSessionShowInfo.bind(this));
        this._session.initiate();
    }

    _ensureOpen() {
        // NOTE: ModalDialog.open() is safe to call if the dialog is
        // already open - it just returns true without side-effects
        if (!this.open(global.get_current_time())) {
            // This can fail if e.g. unable to get input grab
            //
            // In an ideal world this wouldn't happen (because the
            // Cinnamon is in complete control of the session) but that's
            // just not how things work right now.
            //
            // One way to make this happen is by running 'sleep 3;
            // pkexec bash' and then opening a popup menu.
            //
            // We could add retrying if this turns out to be a problem

            log('polkitAuthenticationAgent: Failed to show modal dialog.' +
                ' Dismissing authentication request for action-id ' + this.actionId +
                ' cookie ' + this._cookie);
            this._emitDone(true);
        }
    }

    _emitDone(dismissed) {
        if (!this._doneEmitted) {
            this._doneEmitted = true;
            this.emit('done', dismissed);
        }
    }

    _onEntryActivate() {
        let response = this._passwordEntry.get_text();
        if (response.length === 0)
            return;

        this._passwordEntry.reactive = false;
        this._okButton.reactive = false;

        this._session.response(response);
        // When the user responds, dismiss already shown info and
        // error texts (if any)
        this._errorMessageLabel.hide();
        this._infoMessageLabel.hide();
        this._nullMessageLabel.show();
    }

    _onAuthenticateButtonPressed() {
        this._onEntryActivate();
    }

    _onSessionCompleted(session, gainedAuthorization) {
        if (this._completed || this._doneEmitted)
            return;

        this._completed = true;

        if (gainedAuthorization) {
            this._emitDone(false);

        } else {
            /* Unless we are showing an existing error message from the PAM
             * module (the PAM module could be reporting the authentication
             * error providing authentication-method specific information),
             * show "Sorry, that didn't work. Please try again."
             */
            if (!this._errorMessageLabel.visible && !this._wasDismissed) {
                /* Translators: "that didn't work" refers to the fact that the
                 * requested authentication was not gained; this can happen
                 * because of an authentication error (like invalid password),
                 * for instance. */
                this._errorMessageLabel.set_text(_("Sorry, that didn\'t work. Please try again."));
                this._errorMessageLabel.show();
                this._infoMessageLabel.hide();
                this._nullMessageLabel.hide();

                Util.wiggle(this._passwordEntry);
            }

            /* Try and authenticate again */
            this.performAuthentication();
        }
    }

    _onSessionRequest(session, request, echoOn) {
        if (this._sessionRequestTimeoutId) {
            GLib.source_remove(this._sessionRequestTimeoutId);
            this._sessionRequestTimeoutId = 0;
        }

        // Cheap localization trick
        if (request === 'Password:' || request === 'Password: ')
            this._passwordEntry.hint_text = _("Password");
        else
            this._passwordEntry.hint_text = request;

        this._passwordEntry.password_visible = echoOn;

        this._passwordEntry.show();
        this._passwordEntry.set_text('');
        this._passwordEntry.reactive  = true;
        this._okButton.reactive = false;

        this._ensureOpen();
        this._passwordEntry.grab_key_focus();
    }

    _onSessionShowError(session, text) {
        this._passwordEntry.set_text('');
        this._errorMessageLabel.set_text(text);
        this._errorMessageLabel.show();
        this._infoMessageLabel.hide();
        this._nullMessageLabel.hide();
        this._ensureOpen();
    }

    _onSessionShowInfo(session, text) {
        this._passwordEntry.set_text('');
        this._infoMessageLabel.set_text(text);
        this._infoMessageLabel.show();
        this._errorMessageLabel.hide();
        this._nullMessageLabel.hide();
        this._ensureOpen();
    }

    _destroySession(delay = 0) {
        if (this._session) {
            if (!this._completed)
                this._session.cancel();
            this._completed = false;

            this._session.disconnect(this._sessionCompletedId);
            this._session.disconnect(this._sessionRequestId);
            this._session.disconnect(this._sessionShowErrorId);
            this._session.disconnect(this._sessionShowInfoId);
            this._session = null;
        }

        if (this._sessionRequestTimeoutId) {
            GLib.source_remove(this._sessionRequestTimeoutId);
            this._sessionRequestTimeoutId = 0;
        }

        let resetDialog = () => {
            if (this.state != ModalDialog.State.OPENED)
                return;

            this._passwordEntry.hide();
            this._cancelButton.grab_key_focus();
            this._okButton.reactive = false;
        };

        if (delay) {
            this._sessionRequestTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, resetDialog);
            GLib.Source.set_name_by_id(this._sessionRequestTimeoutId, '[cinnamon] this._sessionRequestTimeoutId');
        } else {
            resetDialog();
        }
    }

    _onUserChanged() {
        if (!this._user.is_loaded)
            return;

        let userName = this._user.get_user_name();
        let realName = this._user.get_real_name();

        if (userName !== 'root')
            this._userLabel.set_text(realName);

        this._userAvatar.update();
    }

    cancel() {
        this._wasDismissed = true;
        this.close(global.get_current_time());
        this._emitDone(true);
    }

    _onDialogClosed() {
        if (this._sessionRequestTimeoutId)
            GLib.source_remove(this._sessionRequestTimeoutId);
        this._sessionRequestTimeoutId = 0;

        if (this._user) {
            this._user.disconnect(this._userLoadedId);
            this._user.disconnect(this._userChangedId);
            this._user = null;
        }

        this._destroySession();
    }

});

var AuthenticationAgent = class {
    constructor() {
        this._native = new Cinnamon.PolkitAuthenticationAgent();
        this._native.connect('initiate', this._onInitiate.bind(this));
        this._native.connect('cancel', this._onCancel.bind(this));
        // TODO - maybe register probably should wait until later, especially at first login?
        this._native.register();
        this._currentDialog = null;
    }

    _onInitiate(nativeAgent, actionId, message, iconName, cookie, userNames) {
        this._currentDialog = new AuthenticationDialog(actionId, message, cookie, userNames);

        // We actually don't want to open the dialog until we know for
        // sure that we're going to interact with the user. For
        // example, if the password for the identity to auth is blank
        // (which it will be on a live CD) then there will be no
        // conversation at all... of course, we don't *know* that
        // until we actually try it.
        //
        // See https://bugzilla.gnome.org/show_bug.cgi?id=643062 for more
        // discussion.

        this._currentDialog.connect('done', this._onDialogDone.bind(this));
        this._currentDialog.performAuthentication();
    }

    _onCancel(nativeAgent) {
        this._completeRequest(false);
    }

    _onDialogDone(dialog, dismissed) {
        this._completeRequest(dismissed);
    }

    _completeRequest(dismissed) {
        this._currentDialog.close();
        this._currentDialog = null;

        this._native.complete(dismissed);
    }
}

function init() {
    let agent = new AuthenticationAgent();
}
