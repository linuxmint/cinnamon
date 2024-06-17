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

const Lang = imports.lang;
const Signals = imports.signals;
const Cinnamon = imports.gi.Cinnamon;
const AccountsService = imports.gi.AccountsService;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Pango = imports.gi.Pango;
const Gio = imports.gi.Gio;
const Mainloop = imports.mainloop;
const Polkit = imports.gi.Polkit;
const PolkitAgent = imports.gi.PolkitAgent;

const ModalDialog = imports.ui.modalDialog;
const CinnamonEntry = imports.ui.cinnamonEntry;
const UserWidget = imports.ui.userWidget;

const DIALOG_ICON_SIZE = 64;

function AuthenticationDialog(actionId, message, cookie, userNames) {
    this._init(actionId, message, cookie, userNames);
}

AuthenticationDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(actionId, message, cookie, userNames) {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'polkit-dialog' });

        this.actionId = actionId;
        this.message = message;
        this.userNames = userNames;
        this._wasDismissed = false;
        this._completed = false;

        let mainContentBox = new St.BoxLayout({ style_class: 'polkit-dialog-main-layout',
                                                vertical: true });
        this.contentLayout.add(mainContentBox,
                               { x_fill: true,
                                 y_fill: true });

        this._subjectLabel = new St.Label({ style_class: 'polkit-dialog-headline',
                                            text: _("Authentication Required") });

        mainContentBox.add(this._subjectLabel,
                       { y_fill:  false,
                         y_align: St.Align.MIDDLE });

        this._descriptionLabel = new St.Label({ style_class: 'polkit-dialog-description',
                                                text: message });
        this._descriptionLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._descriptionLabel.clutter_text.line_wrap = true;

        mainContentBox.add(this._descriptionLabel,
                       { y_fill:  true,
                         y_align: St.Align.START });

        if (userNames.length > 1) {
            log('polkitAuthenticationAgent: Received ' + userNames.length +
                ' identities that can be used for authentication. Only ' +
                'considering the first one.');
        }

        let userName = userNames[0];

        this._user = AccountsService.UserManager.get_default().get_user(userName);
        let userRealName = this._user.get_real_name()
        this._userLoadedId = this._user.connect('notify::is_loaded',
                                                Lang.bind(this, this._onUserChanged));
        this._userChangedId = this._user.connect('changed',
                                                 Lang.bind(this, this._onUserChanged));

        // Special case 'root'
        let userIsRoot = false;
        if (userName == 'root') {
            userIsRoot = true;
            userRealName = _("Administrator");
        }

        if (userIsRoot) {
            let userLabel = new St.Label(({ style_class: 'polkit-dialog-user-root-label',
                                            text: userRealName }));
            mainContentBox.add(userLabel);
        } else {
            let userBox = new St.BoxLayout({ style_class: 'polkit-dialog-user-layout',
                                             vertical: true });
            mainContentBox.add(userBox);
            this._userIcon = new UserWidget.Avatar(this._user, { iconSize: DIALOG_ICON_SIZE });
            this._userIcon.hide();
            userBox.add(this._userIcon,
                        { x_fill:  false,
                          y_fill:  true,
                          x_align: St.Align.MIDDLE,
                          y_align: St.Align.START });
            let userLabel = new St.Label(({ style_class: 'polkit-dialog-user-label',
                                            text: userRealName }));
            userBox.add(userLabel,
                        { x_fill:  false,
                          y_fill:  true,
                          x_align: St.Align.MIDDLE,
                          y_align: St.Align.START });
        }

        this._onUserChanged();

        this._passwordBox = new St.BoxLayout({ vertical: false });
        mainContentBox.add(this._passwordBox);
        this._passwordLabel = new St.Label(({ style_class: 'polkit-dialog-password-label' }));
        this._passwordBox.add(this._passwordLabel,
                              { y_align: St.Align.MIDDLE });
        this._passwordEntry = new St.Entry({ style_class: 'polkit-dialog-password-entry',
                                             text: "",
                                             can_focus: true});
        CinnamonEntry.addContextMenu(this._passwordEntry, { isPassword: true });
        this._passwordEntry.clutter_text.connect('activate', Lang.bind(this, this._onEntryActivate));
        this._passwordBox.add(this._passwordEntry,
                              { expand: true,
                                y_align: St.Align.START });
        this.setInitialKeyFocus(this._passwordEntry);
        this._passwordBox.hide();

        this._errorMessageLabel = new St.Label({ style_class: 'polkit-dialog-error-label' });
        this._errorMessageLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._errorMessageLabel.clutter_text.line_wrap = true;
        mainContentBox.add(this._errorMessageLabel);
        this._errorMessageLabel.hide();

        this._infoMessageLabel = new St.Label({ style_class: 'polkit-dialog-info-label' });
        this._infoMessageLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._infoMessageLabel.clutter_text.line_wrap = true;
        mainContentBox.add(this._infoMessageLabel);
        this._infoMessageLabel.hide();

        /* text is intentionally non-blank otherwise the height is not the same as for
         * infoMessage and errorMessageLabel - but it is still invisible because
         * cinnamon.css sets the color to be transparent
         */
        this._nullMessageLabel = new St.Label({ style_class: 'polkit-dialog-null-label',
                                                text: 'abc'});
        this._nullMessageLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._nullMessageLabel.clutter_text.line_wrap = true;
        mainContentBox.add(this._nullMessageLabel);
        this._nullMessageLabel.show();

        this.setButtons([{ label: _("Cancel"),
                           action: Lang.bind(this, this.cancel),
                           key:    Clutter.Escape
                         },
                         { label:  _("Authenticate"),
                           action: Lang.bind(this, this._onAuthenticateButtonPressed)
                         }]);

        this._doneEmitted = false;

        this._identityToAuth = Polkit.UnixUser.new_for_name(userName);
        this._cookie = cookie;

        this._session = new PolkitAgent.Session({ identity: this._identityToAuth,
                                                  cookie: this._cookie });
        this._session.connect('completed', Lang.bind(this, this._onSessionCompleted));
        this._session.connect('request', Lang.bind(this, this._onSessionRequest));
        this._session.connect('show-error', Lang.bind(this, this._onSessionShowError));
        this._session.connect('show-info', Lang.bind(this, this._onSessionShowInfo));
    },

    startAuthentication: function() {
        this._session.initiate();
    },

    _ensureOpen: function() {
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
            this._emitDone(false, true);
        }
    },

    _emitDone: function(keepVisible, dismissed) {
        if (!this._doneEmitted) {
            this._doneEmitted = true;
            this.emit('done', keepVisible, dismissed);
        }
    },

    _onEntryActivate: function() {
        let response = this._passwordEntry.get_text();
        this._session.response(response);
        // When the user responds, dismiss already shown info and
        // error texts (if any)
        this._errorMessageLabel.hide();
        this._infoMessageLabel.hide();
        this._nullMessageLabel.show();
    },

    _onAuthenticateButtonPressed: function() {
        this._onEntryActivate();
    },

    _onSessionCompleted: function(session, gainedAuthorization) {
        if (this._completed)
            return;

        this._completed = true;

        if (!gainedAuthorization) {
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
            }
        }
        this._emitDone(!gainedAuthorization, false);
    },

    _onSessionRequest: function(session, request, echo_on) {
        // Cheap localization trick
        if (request == 'Password:')
            this._passwordLabel.set_text(_("Password:"));
        else
            this._passwordLabel.set_text(request);

        if (echo_on)
            this._passwordEntry.clutter_text.set_password_char('');
        else
            this._passwordEntry.clutter_text.set_password_char('\u25cf'); // ● U+25CF BLACK CIRCLE

        this._passwordBox.show();
        this._passwordEntry.set_text('');
        this._passwordEntry.grab_key_focus();
        this._ensureOpen();
    },

    _onSessionShowError: function(session, text) {
        this._passwordEntry.set_text('');
        this._errorMessageLabel.set_text(text);
        this._errorMessageLabel.show();
        this._infoMessageLabel.hide();
        this._nullMessageLabel.hide();
        this._ensureOpen();
    },

    _onSessionShowInfo: function(session, text) {
        this._passwordEntry.set_text('');
        this._infoMessageLabel.set_text(text);
        this._infoMessageLabel.show();
        this._errorMessageLabel.hide();
        this._nullMessageLabel.hide();
        this._ensureOpen();
    },

    destroySession: function() {
        if (this._session) {
            if (!this._completed)
                this._session.cancel();
            this._session = null;
        }
    },

    _onUserChanged: function() {
        if (this._user.is_loaded) {
            if (this._userIcon) {
                this._userIcon.update();
                this._userIcon.show();
            }
        }
    },

    cancel: function() {
        this._wasDismissed = true;
        this.close(global.get_current_time());
        this._emitDone(false, true);
    },

};
Signals.addSignalMethods(AuthenticationDialog.prototype);

function AuthenticationAgent() {
    this._init();
}

AuthenticationAgent.prototype = {
    _init: function() {
        this._native = new Cinnamon.PolkitAuthenticationAgent();
        this._native.connect('initiate', Lang.bind(this, this._onInitiate));
        this._native.connect('cancel', Lang.bind(this, this._onCancel));
        // TODO - maybe register probably should wait until later, especially at first login?
        this._native.register();
        this._currentDialog = null;
        this._isCompleting = false;
    },

    _onInitiate: function(nativeAgent, actionId, message, iconName, cookie, userNames) {
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

        this._currentDialog.connect('done', Lang.bind(this, this._onDialogDone));
        this._currentDialog.startAuthentication();
    },

    _onCancel: function(nativeAgent) {
        this._completeRequest(false, false);
    },

    _onDialogDone: function(dialog, keepVisible, dismissed) {
        this._completeRequest(keepVisible, dismissed);
    },

    _reallyCompleteRequest: function(dismissed) {
        this._currentDialog.close();
        this._currentDialog.destroySession();
        this._currentDialog = null;
        this._isCompleting = false;

        this._native.complete(dismissed)
    },

    _completeRequest: function(keepVisible, wasDismissed) {
        if (this._isCompleting)
            return;

        this._isCompleting = true;

        if (keepVisible) {
            // Give the user 2 seconds to read 'Authentication Failure' before
            // dismissing the dialog
            Mainloop.timeout_add(2000,
                                 Lang.bind(this,
                                           function() {
                                               this._reallyCompleteRequest(wasDismissed);
                                           }));
        } else {
            this._reallyCompleteRequest(wasDismissed);
        }
    }
}

function init() {
    let agent = new AuthenticationAgent();
}
