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
 */

const Lang = imports.lang;
const Signals = imports.signals;

const AccountsService = imports.gi.AccountsService;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Pango = imports.gi.Pango;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const GnomeSession = imports.misc.gnomeSession;
const ModalDialog = imports.ui.modalDialog;
const Tweener = imports.ui.tweener;

let _endSessionDialog = null;

const _ITEM_ICON_SIZE = 48;
const _DIALOG_ICON_SIZE = 32;

const GSM_SESSION_MANAGER_LOGOUT_FORCE = 2;
const EndSessionDialogIface = <interface name="org.gnome.SessionManager.EndSessionDialog">
<method name="Open">
    <arg type="u" direction="in" />
    <arg type="u" direction="in" />
    <arg type="u" direction="in" />
    <arg type="ao" direction="in" />
</method>
<signal name="ConfirmedLogout" />
<signal name="ConfirmedReboot" />
<signal name="ConfirmedShutdown" />
<signal name="Canceled" />
<signal name="Closed" />
</interface>;
 
const logoutDialogContent = {
    subjectWithUser: _("Log Out %s"),
    subject: _("Log Out"),
    inhibitedDescription: _("Click Log Out to quit these applications and log out of the system."),
    uninhibitedDescriptionWithUser: function(user, seconds) {
        return ngettext("%s will be logged out automatically in %d second.",
                        "%s will be logged out automatically in %d seconds.",
                        seconds).format(user, seconds);
    },
    uninhibitedDescription: function(seconds) {
        return ngettext("You will be logged out automatically in %d second.",
                        "You will be logged out automatically in %d seconds.",
                        seconds).format(seconds);
    },
    endDescription: _("Logging out of the system."),
    confirmButtons: [{ signal: 'ConfirmedLogout',
                       label:  _("Log Out") }],
    iconStyleClass: 'end-session-dialog-logout-icon'
};

const shutdownDialogContent = {
    subject: _("Power Off"),
    inhibitedDescription: _("Click Power Off to quit these applications and power off the system."),
    uninhibitedDescription: function(seconds) {
        return ngettext("The system will power off automatically in %d second.",
                        "The system will power off automatically in %d seconds.",
                        seconds).format(seconds);
    },
    endDescription: _("Powering off the system."),
    confirmButtons: [{ signal: 'ConfirmedReboot',
                       label:  _("Restart") },
                     { signal: 'ConfirmedShutdown',
                       label:  _("Power Off") }],
    iconName: 'system-shutdown',
    iconStyleClass: 'end-session-dialog-shutdown-icon'
};

const restartDialogContent = {
    subject: _("Restart"),
    inhibitedDescription: _("Click Restart to quit these applications and restart the system."),
    uninhibitedDescription: function(seconds) {
        return ngettext("The system will restart automatically in %d second.",
                        "The system will restart automatically in %d seconds.",
                        seconds).format(seconds);
    },
    endDescription: _("Restarting the system."),
    confirmButtons: [{ signal: 'ConfirmedReboot',
                       label:  _("Restart") }],
    iconName: 'system-shutdown',
    iconStyleClass: 'end-session-dialog-shutdown-icon'
};

const DialogContent = {
    0 /* GSM_CINNAMON_END_SESSION_DIALOG_TYPE_LOGOUT */: logoutDialogContent,
    1 /* GSM_CINNAMON_END_SESSION_DIALOG_TYPE_SHUTDOWN */: shutdownDialogContent,
    2 /* GSM_CINNAMON_END_SESSION_DIALOG_TYPE_RESTART */: restartDialogContent
};

function findAppFromInhibitor(inhibitor) {
    let desktopFile = inhibitor.app_id;

    if (!GLib.str_has_suffix(desktopFile, '.desktop'))
      desktopFile += '.desktop';

    let candidateDesktopFiles = [];

    candidateDesktopFiles.push(desktopFile);
    candidateDesktopFiles.push('gnome-' + desktopFile);

    let appSystem = Cinnamon.AppSystem.get_default();
    let app = null;
    for (let i = 0; i < candidateDesktopFiles.length; i++) {
        try {
            app = appSystem.lookup_app(candidateDesktopFiles[i]);

            if (app)
                break;
        } catch(e) {
            // ignore errors
        }
    }

    return app;
}

function ListItem(app, reason) {
    this._init(app, reason);
}

ListItem.prototype = {
    _init: function(app, reason) {
        this._app = app;
        this._reason = reason;

        if (this._reason == null)
          this._reason = '';

        let layout = new St.BoxLayout({ vertical: false});

        this.actor = new St.Button({ style_class: 'end-session-dialog-app-list-item',
                                     can_focus:   true,
                                     child:       layout,
                                     reactive:    true,
                                     x_align:     St.Align.START,
                                     x_fill:      true });

        this._icon = this._app.create_icon_texture(_ITEM_ICON_SIZE);

        let iconBin = new St.Bin({ style_class: 'end-session-dialog-app-list-item-icon',
                                   child:       this._icon });
        layout.add(iconBin);

        let textLayout = new St.BoxLayout({ style_class: 'end-session-dialog-app-list-item-text-box',
                                            vertical:    true });
        layout.add(textLayout);

        this._nameLabel = new St.Label({ text:        this._app.get_name(),
                                         style_class: 'end-session-dialog-app-list-item-name' });
        textLayout.add(this._nameLabel,
                       { expand: false,
                         x_fill: true });

        this._descriptionLabel = new St.Label({ text:        this._reason,
                                                style_class: 'end-session-dialog-app-list-item-description' });
        textLayout.add(this._descriptionLabel,
                       { expand: true,
                         x_fill: true });

        this.actor.connect('clicked', Lang.bind(this, this._onClicked));
    },

    _onClicked: function() {
        this.emit('activate');
        this._app.activate();
    }
};
Signals.addSignalMethods(ListItem.prototype);

// The logout timer only shows updates every 10 seconds
// until the last 10 seconds, then it shows updates every
// second.  This function takes a given time and returns
// what we should show to the user for that time.
function _roundSecondsToInterval(totalSeconds, secondsLeft, interval) {
    let time;

    time = Math.ceil(secondsLeft);

    // Final count down is in decrements of 1
    if (time <= interval)
        return time;

    // Round up higher than last displayable time interval
    time += interval - 1;

    // Then round down to that time interval
    if (time > totalSeconds)
        time = Math.ceil(totalSeconds);
    else
        time -= time % interval;

    return time;
}

function _setLabelText(label, text) {
    if (text) {
        label.set_text(text);
        label.show();
    } else {
        label.set_text('');
        label.hide();
    }
}

function EndSessionDialog() {
    if (_endSessionDialog == null) {
        this._init();
        _endSessionDialog = this;
    }

    return _endSessionDialog;
}

function init() {
    // This always returns the same singleton object
    // By instantiating it initially, we register the
    // bus object, etc.
    let dialog = new EndSessionDialog();
}

EndSessionDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function() {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'end-session-dialog' });

        this._user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());

        this._secondsLeft = 0;
        this._totalSecondsToStayOpen = 0;
        this._inhibitors = [];

        this.connect('destroy',
                     Lang.bind(this, this._onDestroy));
        this.connect('opened',
                     Lang.bind(this, this._onOpened));

        this._userLoadedId = this._user.connect('notify::is_loaded',
                                                Lang.bind(this, this._updateContent));

        this._userChangedId = this._user.connect('changed',
                                                 Lang.bind(this, this._updateContent));

        let mainContentLayout = new St.BoxLayout({ vertical: false });
        this.contentLayout.add(mainContentLayout,
                               { x_fill: true,
                                 y_fill: false });

		// Ensure we have some sort of keyboard usability; the keyboard user will have to tab
        // to the button of choice.
        this.setInitialKeyFocus(mainContentLayout);

        this._iconBin = new St.Bin();
        mainContentLayout.add(this._iconBin,
                              { x_fill:  true,
                                y_fill:  false,
                                x_align: St.Align.END,
                                y_align: St.Align.START });

        let messageLayout = new St.BoxLayout({ vertical: true });
        mainContentLayout.add(messageLayout,
                              { y_align: St.Align.START });

        this._subjectLabel = new St.Label({ style_class: 'end-session-dialog-subject' });

        messageLayout.add(this._subjectLabel,
                          { y_fill:  false,
                            y_align: St.Align.START });

        this._descriptionLabel = new St.Label({ style_class: 'end-session-dialog-description' });
        this._descriptionLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        this._descriptionLabel.clutter_text.line_wrap = true;

        messageLayout.add(this._descriptionLabel,
                          { y_fill:  true,
                            y_align: St.Align.START });

        let scrollView = new St.ScrollView({ style_class: 'end-session-dialog-app-list'});
        scrollView.set_policy(Gtk.PolicyType.NEVER,
                              Gtk.PolicyType.AUTOMATIC);
        this.contentLayout.add(scrollView,
                               { x_fill: true,
                                 y_fill: true });
        scrollView.hide();

        this._applicationList = new St.BoxLayout({ vertical: true });
        scrollView.add_actor(this._applicationList,
                             { x_fill:  true,
                               y_fill:  true,
                               x_align: St.Align.START,
                               y_align: St.Align.MIDDLE });

        this._applicationList.connect('actor-added',
                                      Lang.bind(this, function() {
                                          if (this._applicationList.get_children().length == 1)
                                              scrollView.show();
                                      }));

        this._applicationList.connect('actor-removed',
                                      Lang.bind(this, function() {
                                          if (this._applicationList.get_children().length == 0)
                                              scrollView.hide();
                                      }));

        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(EndSessionDialogIface, this);
        this._dbusImpl.export(Gio.DBus.session, '/org/gnome/SessionManager/EndSessionDialog');
    },

    _onDestroy: function() {
        this._user.disconnect(this._userLoadedId);
        this._user.disconnect(this._userChangedId);
    },

    _setIconFromFile: function(iconFile, styleClass) {
        if (styleClass)
            this._iconBin.set_style_class_name(styleClass);
        this._iconBin.set_style(null);

        this._iconBin.child = null;
        if (iconFile) {
            this._iconBin.show();
            this._iconBin.set_style('background-image: url("' + iconFile + '");');
        } else {
            this._iconBin.hide();
        }
    },

    _setIconFromName: function(iconName, styleClass) {
        if (styleClass)
            this._iconBin.set_style_class_name(styleClass);
        this._iconBin.set_style(null);

        if (iconName != null) {
            let textureCache = St.TextureCache.get_default();
            let icon = textureCache.load_icon_name(this._iconBin.get_theme_node(),
                                                   iconName,
                                                   St.IconType.SYMBOLIC,
                                                   _DIALOG_ICON_SIZE);

            this._iconBin.child = icon;
            this._iconBin.show();
        } else {
            this._iconBin.child = null;
            this._iconBin.hide();
        }
    },

    _updateContent: function() {
        if (this.state != ModalDialog.State.OPENING &&
            this.state != ModalDialog.State.OPENED)
            return;

        let dialogContent = DialogContent[this._type];

        let subject = dialogContent.subject;
        let description;

        if (this._user.is_loaded && !dialogContent.iconName) {
            let iconFile = this._user.get_icon_file();
            if (GLib.file_test(iconFile, GLib.FileTest.EXISTS))
                this._setIconFromFile(iconFile, dialogContent.iconStyleClass);
            else
                this._setIconFromName('avatar-default', dialogContent.iconStyleClass);
        } else if (dialogContent.iconName) {
            this._setIconFromName(dialogContent.iconName,
                                  dialogContent.iconStyleClass);
        }

        if (this._inhibitors.length > 0) {
            this._stopTimer();
            description = dialogContent.inhibitedDescription;
        } else if (this._secondsLeft > 0 && this._inhibitors.length == 0) {
            let displayTime = _roundSecondsToInterval(this._totalSecondsToStayOpen,
                                                      this._secondsLeft,
                                                      10);

            if (this._user.is_loaded) {
                let realName = this._user.get_real_name();

                if (realName != null) {
                    if (dialogContent.subjectWithUser)
                        subject = dialogContent.subjectWithUser.format(realName);

                    if (dialogContent.uninhibitedDescriptionWithUser)
                        description = dialogContent.uninhibitedDescriptionWithUser(realName, displayTime);
                    else
                        description = dialogContent.uninhibitedDescription(displayTime);
                }
            }

            if (!description)
                description = dialogContent.uninhibitedDescription(displayTime);
        } else {
            description = dialogContent.endDescription;
        }

        _setLabelText(this._subjectLabel, subject);
        _setLabelText(this._descriptionLabel, description);
    },

    _updateButtons: function() {
        let dialogContent = DialogContent[this._type];
        let buttons = [{ action: Lang.bind(this, this.cancel),
                         label:  _("Cancel"),
                         key:    Clutter.Escape }];

        for (let i = 0; i < dialogContent.confirmButtons.length; i++) {
            let signal = dialogContent.confirmButtons[i].signal;
            let label = dialogContent.confirmButtons[i].label;
            buttons.push({ action: Lang.bind(this, function() {
                                       this._confirm(signal);
                                   }),
                           label: label });
        }

        this.setButtons(buttons);
    },

    close: function() {
        ModalDialog.ModalDialog.prototype.close.call(this);
        this._dbusImpl.emit_signal('Closed', null);
    },

    cancel: function() {
        this._stopTimer();
        this._dbusImpl.emit_signal('Canceled', null);
        this.close(global.get_current_time());
    },

    _confirm: function(signal) {
        this._fadeOutDialog();
        this._stopTimer();
        this._dbusImpl.emit_signal(signal, null);
    },

    _onOpened: function() {
        if (this._inhibitors.length == 0)
            this._startTimer();
    },

    _startTimer: function() {
        this._secondsLeft = this._totalSecondsToStayOpen;
        Tweener.addTween(this,
                         { _secondsLeft: 0,
                           time: this._secondsLeft,
                           transition: 'linear',
                           onUpdate: Lang.bind(this, this._updateContent),
                           onComplete: Lang.bind(this, function() {
                                           let dialogContent = DialogContent[this._type];
                                           let button = dialogContent.confirmButtons[dialogContent.confirmButtons.length - 1];
                                           this._confirm(button.signal);
                                       }),
                         });
    },

    _stopTimer: function() {
        Tweener.removeTweens(this);
        this._secondsLeft = 0;
    },

    _onInhibitorLoaded: function(inhibitor) {
        if (this._inhibitors.indexOf(inhibitor) < 0) {
            // Stale inhibitor
            return;
        }

        let app = findAppFromInhibitor(inhibitor);

        if (app) {
            let item = new ListItem(app, inhibitor.reason);
            item.connect('activate',
                         Lang.bind(this, function() {
                             this.close(global.get_current_time());
                         }));
            this._applicationList.add(item.actor, { x_fill: true });
            this._stopTimer();
        } else {
            // inhibiting app is a service, not an application
            this._inhibitors.splice(this._inhibitors.indexOf(inhibitor), 1);
        }

        this._updateContent();
    },

    OpenAsync: function(parameters, invocation) {
        let [type, timestamp, totalSecondsToStayOpen, inhibitorObjectPaths] = parameters;
        this._totalSecondsToStayOpen = totalSecondsToStayOpen;
        this._inhibitors = [];
        this._applicationList.destroy_children();
        this._type = type;

        if (!(this._type in DialogContent)) {
            invocation.report_dbus_error('org.Cinnamon.ModalDialog.TypeError',
                                         "Unknown dialog type requested");
            return;
        }

        for (let i = 0; i < inhibitorObjectPaths.length; i++) {
            let inhibitor = new GnomeSession.Inhibitor(inhibitorObjectPaths[i], Lang.bind(this, function(proxy, error) {
                this._onInhibitorLoaded(proxy);
            }));

            this._inhibitors.push(inhibitor);
        }

        this._updateButtons();

        if (!this.open(timestamp)) {
            invocation.report_dbus_error('org.Cinnamon.ModalDialog.GrabError',
                                         "Cannot grab pointer and keyboard");
            return;
        }

        this._updateContent();

        let signalId = this.connect('opened',
                                    Lang.bind(this, function() {
                                        invocation.return_value(null);
                                        this.disconnect(signalId);
                                    }));
    }
};
