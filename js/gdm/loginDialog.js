// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/*
 * Copyright 2011 Red Hat, Inc
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
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA
 * 02111-1307, USA.
 */

const AccountsService = imports.gi.AccountsService;
const Clutter = imports.gi.Clutter;
const CtrlAltTab = imports.ui.ctrlAltTab;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Pango = imports.gi.Pango;
const Signals = imports.signals;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const GdmGreeter = imports.gi.GdmGreeter;

const Batch = imports.gdm.batch;
const DBus = imports.dbus;
const Fprint = imports.gdm.fingerprint;
const Lightbox = imports.ui.lightbox;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const Tweener = imports.ui.tweener;

const _PASSWORD_SERVICE_NAME = 'gdm-password';
const _FINGERPRINT_SERVICE_NAME = 'gdm-fingerprint';
const _FADE_ANIMATION_TIME = 0.16;
const _RESIZE_ANIMATION_TIME = 0.25;
const _SCROLL_ANIMATION_TIME = 2.0;
const _TIMED_LOGIN_IDLE_THRESHOLD = 5.0;
const _LOGO_ICON_NAME_SIZE = 48;

const _LOGIN_SCREEN_SCHEMA = 'org.gnome.login-screen';
const _FINGERPRINT_AUTHENTICATION_KEY = 'enable-fingerprint-authentication';

const _LOGO_KEY = 'logo';

let _loginDialog = null;

function _fadeInActor(actor) {
    let hold = new Batch.Hold();

    if (actor.opacity == 255 && actor.visible)
        return null;

    actor.show();
    let [minHeight, naturalHeight] = actor.get_preferred_height(-1);

    actor.opacity = 0;
    actor.set_height(0);
    Tweener.addTween(actor,
                     { opacity: 255,
                       height: naturalHeight,
                       time: _FADE_ANIMATION_TIME,
                       transition: 'easeOutQuad',
                       onComplete: function() {
                           actor.set_height(-1);
                           hold.release();
                       },
                       onCompleteScope: this
                     });
    return hold;
}

function _fadeOutActor(actor) {
    let hold = new Batch.Hold();

    if (!actor.visible) {
        actor.opacity = 0;
        return null;
    }

    if (actor.opacity == 0) {
        actor.hide();
        return null;
    }

    Tweener.addTween(actor,
                     { opacity: 0,
                       height: 0,
                       time: _FADE_ANIMATION_TIME,
                       transition: 'easeOutQuad',
                       onComplete: function() {
                           actor.hide();
                           actor.set_height(-1);
                           hold.release();
                       },
                       onCompleteScope: this
                     });
    return hold;
}

function _smoothlyResizeActor(actor, width, height) {
    let finalWidth;
    let finalHeight;

    if (width < 0)
        finalWidth = actor.width;
    else
        finalWidth = width;

    if (height < 0)
        finalHeight = actor.height;
    else
        finalHeight = height;

    actor.set_size(actor.width, actor.height);

    if (actor.width == finalWidth && actor.height == finalHeight)
        return null;

    let hold = new Batch.Hold();

    Tweener.addTween(actor,
                     { width: finalWidth,
                       height: finalHeight,
                       time: _RESIZE_ANIMATION_TIME,
                       transition: 'easeOutQuad',
                       onComplete: Lang.bind(this, function() {
                                       hold.release();
                                   })
                     });
    return hold;
}

function UserListItem(user, reason) {
    this._init(user, reason);
}

UserListItem.prototype = {
    _init: function(user) {
        this.user = user;
        this._userChangedId = this.user.connect('changed',
                                                 Lang.bind(this, this._onUserChanged));

        this._verticalBox = new St.BoxLayout({ style_class: 'login-dialog-user-list-item-vertical-layout',
                                               vertical: true });

        this.actor = new St.Button({ style_class: 'login-dialog-user-list-item',
                                     can_focus: true,
                                     child: this._verticalBox,
                                     reactive: true,
                                     x_align: St.Align.START,
                                     x_fill: true });
        let layout = new St.BoxLayout({ vertical: false });

        this._verticalBox.add(layout,
                              { y_fill: true,
                                x_fill: true,
                                expand: true });

        this._focusBin = new St.Bin({ style_class: 'login-dialog-user-list-item-focus-bin' });
        this._verticalBox.add(this._focusBin,
                              { x_fill: false,
                                x_align: St.Align.MIDDLE,
                                y_fill: false,
                                expand: true });

        this._iconBin = new St.Bin();
        layout.add(this._iconBin);
        let textLayout = new St.BoxLayout({ style_class: 'login-dialog-user-list-item-text-box',
                                            vertical:    true });
        layout.add(textLayout,
                   { y_fill: false,
                     y_align: St.Align.MIDDLE,
                     expand: true });

        this._nameLabel = new St.Label({ text:        this.user.get_real_name(),
                                         style_class: 'login-dialog-user-list-item-name' });
        textLayout.add(this._nameLabel);

        this._updateIcon();

        this.actor.connect('clicked', Lang.bind(this, this._onClicked));
    },

    _onUserChanged: function() {
        this._nameLabel.set_text(this.user.get_real_name());
        this._updateIcon();
    },

    _setIconFromFile: function(iconFile, styleClass) {
        if (styleClass)
            this._iconBin.set_style_class_name(styleClass);
        this._iconBin.set_style(null);

        this._iconBin.child = null;
        if (iconFile) {
            this._iconBin.show();
            // We use background-image instead of, say, St.TextureCache
            // so the theme writers can add a rounded frame around the image
            // and so theme writers can pick the icon size.
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
            let icon = new St.Icon();
            icon.set_icon_name(iconName)

            this._iconBin.child = icon;
            this._iconBin.show();
        } else {
            this._iconBin.child = null;
            this._iconBin.hide();
        }
    },

    _updateIcon: function() {
        let iconFileName = this.user.get_icon_file();
        let gicon = null;

        if (GLib.file_test(iconFileName, GLib.FileTest.EXISTS))
            this._setIconFromFile(iconFileName, 'login-dialog-user-list-item-icon');
        else
            this._setIconFromName('avatar-default', 'login-dialog-user-list-item-icon');
    },

    _onClicked: function() {
        this.emit('activate');
    },

    fadeOutName: function() {
        return _fadeOutActor(this._nameLabel);
    },

    fadeInName: function() {
        return _fadeInActor(this._nameLabel);
    },

    showFocusAnimation: function(time) {
        let hold = new Batch.Hold();

        let node = this.actor.get_theme_node();
        let padding = node.get_horizontal_padding();

        let box = this._verticalBox.get_allocation_box();

        Tweener.removeTweens(this._focusBin);
        this._focusBin.width = 0;
        Tweener.addTween(this._focusBin,
                         { width: (box.x2 - box.x1 - padding),
                           time: time,
                           transition: 'linear',
                           onComplete: function() {
                               hold.release();
                           },
                           onCompleteScope: this
                         });
        return hold;
    }

};
Signals.addSignalMethods(UserListItem.prototype);

function UserList() {
    this._init.apply(this, arguments);
}

UserList.prototype = {
    _init: function() {
        this.actor = new St.ScrollView({ style_class: 'login-dialog-user-list-view'});
        this.actor.set_policy(Gtk.PolicyType.NEVER,
                              Gtk.PolicyType.AUTOMATIC);

        this._box = new St.BoxLayout({ vertical: true,
                                       style_class: 'login-dialog-user-list' });

        this.actor.add_actor(this._box,
                             { x_fill: true,
                               y_fill: true,
                               x_align: St.Align.START,
                               y_align: St.Align.MIDDLE });
        this._items = {};

        this.actor.connect('key-focus-in', Lang.bind(this, this._moveFocusToItems));
    },

    _moveFocusToItems: function() {
        let hasItems = Object.keys(this._items).length > 0;

        if (!hasItems)
            return;

        if (global.stage.get_key_focus() != this.actor)
            return;

        this.actor.navigate_focus(null, Gtk.DirectionType.TAB_FORWARD, false);
    },

    _showItem: function(item) {
        let tasks = [function() {
                         return _fadeInActor(item.actor);
                     },

                     function() {
                         return item.fadeInName();
                     }];

        let batch = new Batch.ConsecutiveBatch(this, tasks);
        return batch.run();
    },

    _onItemActivated: function(activatedItem) {
        this.emit('activate', activatedItem);
    },

    giveUpWhitespace: function() {
        let container = this.actor.get_parent();

        container.child_set(this.actor, { expand: false });
    },

    takeOverWhitespace: function() {
        let container = this.actor.get_parent();

        container.child_set(this.actor, { expand: true });
    },

    pinInPlace: function() {
        this._box.set_size(this._box.width, this._box.height);
    },

    shrinkToNaturalHeight: function() {
        let oldWidth = this._box.width;
        let oldHeight = this._box.height;
        this._box.set_size(-1, -1);
        let [minHeight, naturalHeight] = this._box.get_preferred_height(-1);
        this._box.set_size(oldWidth, oldHeight);

        let batch = new Batch.ConsecutiveBatch(this,
                                               [function() {
                                                    return _smoothlyResizeActor(this._box, -1, naturalHeight);
                                                },

                                                function() {
                                                    this._box.set_size(-1, -1);
                                                }
                                               ]);

        return batch.run();
    },

    hideItemsExcept: function(exception) {
        let tasks = [];

        for (let userName in this._items) {
            let item = this._items[userName];

            item.actor.can_focus = false;
            item._focusBin.width = 0;
            if (item != exception)
                tasks.push(function() {
                    return _fadeOutActor(item.actor);
                });
        }

        let batch = new Batch.ConsecutiveBatch(this,
                                               [function() {
                                                    return _fadeOutActor(this.actor.vscroll);
                                                },

                                                new Batch.ConcurrentBatch(this, tasks)
                                               ]);

        return batch.run();
    },

    hideItems: function() {
        return this.hideItemsExcept(null);
    },

    _getExpandedHeight: function() {
        let hiddenActors = [];
        for (let userName in this._items) {
            let item = this._items[userName];
            if (!item.actor.visible) {
                item.actor.show();
                hiddenActors.push(item.actor);
            }
        }

        if (!this._box.visible) {
            this._box.show();
            hiddenActors.push(this._box);
        }

        this._box.set_size(-1, -1);
        let [minHeight, naturalHeight] = this._box.get_preferred_height(-1);

        for (let i = 0; i < hiddenActors.length; i++) {
            let actor = hiddenActors[i];
            actor.hide();
        }

        return naturalHeight;
    },

    showItems: function() {
        let tasks = [];

        for (let userName in this._items) {
            let item = this._items[userName];
            item.actor.can_focus = true;
            tasks.push(function() {
                return this._showItem(item);
            });
        }

        let batch = new Batch.ConsecutiveBatch(this,
                                               [function() {
                                                    this.takeOverWhitespace();
                                                },

                                                function() {
                                                    let fullHeight = this._getExpandedHeight();
                                                    return _smoothlyResizeActor(this._box, -1, fullHeight);
                                                },

                                                new Batch.ConcurrentBatch(this, tasks),

                                                function() {
                                                    this.actor.set_size(-1, -1);
                                                },

                                                function() {
                                                    return _fadeInActor(this.actor.vscroll);
                                                }]);
        return batch.run();
    },

    scrollToItem: function(item) {
        let box = item.actor.get_allocation_box();

        let adjustment = this.actor.get_vscroll_bar().get_adjustment();

        let value = (box.y1 + adjustment.step_increment / 2.0) - (adjustment.page_size / 2.0);
        Tweener.removeTweens(adjustment);
        Tweener.addTween (adjustment,
                          { value: value,
                            time: _SCROLL_ANIMATION_TIME,
                            transition: 'linear' });
    },

    jumpToItem: function(item) {
        let box = item.actor.get_allocation_box();

        let adjustment = this.actor.get_vscroll_bar().get_adjustment();

        let value = (box.y1 + adjustment.step_increment / 2.0) - (adjustment.page_size / 2.0);

        adjustment.set_value(value);
    },

    getItemFromUserName: function(userName) {
        let item = this._items[userName];

        if (!item)
            return null;

        return item;
    },

    addUser: function(user) {
        if (!user.is_loaded)
            return;

        if (user.is_system_account())
            return;

        let userName = user.get_user_name();

        if (!userName)
            return;

        this.removeUser(user);

        let item = new UserListItem(user);
        this._box.add(item.actor, { x_fill: true });

        this._items[userName] = item;

        item.connect('activate',
                     Lang.bind(this, this._onItemActivated));

        // Try to keep the focused item front-and-center
        item.actor.connect('key-focus-in',
                           Lang.bind(this,
                                     function() {
                                         this.scrollToItem(item);
                                         item.showFocusAnimation(0);
                                     }));

        this._moveFocusToItems();

        this.emit('item-added', item);
    },

    removeUser: function(user) {
        if (!user.is_loaded)
            return;

        let userName = user.get_user_name();

        if (!userName)
            return;

        let item = this._items[userName];

        if (!item)
            return;

        item.actor.destroy();
        delete this._items[userName];
    }
};
Signals.addSignalMethods(UserList.prototype);

function SessionListItem(id, name) {
    this._init(id, name);
}

SessionListItem.prototype = {
    _init: function(id, name) {
        this.id = id;

        this.actor = new St.Button({ style_class: 'login-dialog-session-list-item',
                                     can_focus: true,
                                     reactive: true,
                                     x_fill: true,
                                     x_align: St.Align.START });

        this._box = new St.BoxLayout({ style_class: 'login-dialog-session-list-item-box' });

        this.actor.add_actor(this._box,
                             { expand: true,
                               x_fill: true,
                               y_fill: true });
        this.actor.connect('clicked', Lang.bind(this, this._onClicked));

        this._dot = new St.DrawingArea({ style_class: 'login-dialog-session-list-item-dot' });
        this._dot.connect('repaint', Lang.bind(this, this._onRepaintDot));
        this._box.add_actor(this._dot);
        this.setShowDot(false);

        let label = new St.Label({ style_class: 'login-dialog-session-list-item-label',
                                   text: name });

        this._box.add_actor(label,
                            { expand: true,
                              x_fill: true,
                              y_fill: true });
    },

    setShowDot: function(show) {
        if (show)
            this._dot.opacity = 255;
        else
            this._dot.opacity = 0;
    },

    _onRepaintDot: function(area) {
        let cr = area.get_context();
        let [width, height] = area.get_surface_size();
        let color = area.get_theme_node().get_foreground_color();

        cr.setSourceRGBA (color.red / 255,
                          color.green / 255,
                          color.blue / 255,
                          color.alpha / 255);
        cr.arc(width / 2, height / 2, width / 3, 0, 2 * Math.PI);
        cr.fill();
    },

    _onClicked: function() {
        this.emit('activate');
    }
};
Signals.addSignalMethods(SessionListItem.prototype);

function SessionList() {
    this._init();
}

SessionList.prototype = {
    _init: function() {
        this.actor = new St.Bin();

        this._box = new St.BoxLayout({ style_class: 'login-dialog-session-list',
                                       vertical: true});
        this.actor.child = this._box;

        this._button = new St.Button({ style_class: 'login-dialog-session-list-button',
                                       can_focus: true,
                                       x_fill: true,
                                       y_fill: true });
        let box = new St.BoxLayout();
        this._button.add_actor(box,
                               { x_fill: true,
                                 y_fill: true,
                                 expand: true });

        this._triangle = new St.Label({ style_class: 'login-dialog-session-list-triangle',
                                        text: '\u25B8' });
        box.add_actor(this._triangle);

        let label = new St.Label({ style_class: 'login-dialog-session-list-label',
                                   text: _("Session...") });
        box.add_actor(label,
                      { x_fill: true,
                        y_fill: true,
                        expand: true });

        this._button.connect('clicked',
                             Lang.bind(this, this._onClicked));
        this._box.add_actor(this._button,
                            { x_fill: true,
                              y_fill: true,
                              expand: true });
        this._scrollView = new St.ScrollView({ style_class: 'login-dialog-session-list-scroll-view'});
        this._scrollView.set_policy(Gtk.PolicyType.NEVER,
                                    Gtk.PolicyType.AUTOMATIC);
        this._box.add_actor(this._scrollView,
                            { x_fill: true,
                              y_fill: true,
                              expand: true });
        this._itemList = new St.BoxLayout({ style_class: 'login-dialog-session-item-list',
                                            vertical: true });
        this._scrollView.add_actor(this._itemList,
                                   { x_fill: true,
                                     y_fill: true,
                                     expand: true });
        this._scrollView.hide();
        this.isOpen = false;
        this._populate();
    },

    open: function() {
        if (this.isOpen)
            return;

        this._button.add_style_pseudo_class('open');
        this._scrollView.show();
        this._triangle.set_text('\u25BE');

        this.isOpen = true;
    },

    close: function() {
        if (!this.isOpen)
            return;

        this._button.remove_style_pseudo_class('open');
        this._scrollView.hide();
        this._triangle.set_text('\u25B8');

        this.isOpen = false;
    },

    _onClicked: function() {
        if (!this.isOpen)
            this.open();
        else
            this.close();
    },

    setActiveSession: function(sessionId) {
         if (sessionId == this._activeSessionId)
             return;

         if (this._activeSessionId)
             this._items[this._activeSessionId].setShowDot(false);

         this._items[sessionId].setShowDot(true);
         this._activeSessionId = sessionId;

         this.emit('session-activated', this._activeSessionId);
    },

    _populate: function() {
        this._itemList.destroy_children();
        this._activeSessionId = null;
        this._items = {};

        let ids = GdmGreeter.get_session_ids();
        ids.sort();

        if (ids.length <= 1) {
            this._box.hide();
            this._button.hide();
        } else {
            this._button.show();
            this._box.show();
        }

        for (let i = 0; i < ids.length; i++) {
            let [sessionName, sessionDescription] = GdmGreeter.get_session_name_and_description(ids[i]);

            let item = new SessionListItem(ids[i], sessionName);
            this._itemList.add_actor(item.actor,
                              { x_align: St.Align.START,
                                y_align: St.Align.START,
                                x_fill: true,
                                y_fill: true });
            this._items[ids[i]] = item;

            if (!this._activeSessionId)
                this.setActiveSession(ids[i]);

            item.connect('activate',
                         Lang.bind(this, function() {
                             this.setActiveSession(item.id);
                         }));
        }
    }
};
Signals.addSignalMethods(SessionList.prototype);

function LoginDialog() {
    if (_loginDialog == null) {
        this._init();
        _loginDialog = this;
    }

    return _loginDialog;
}

LoginDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function() {
        ModalDialog.ModalDialog.prototype._init.call(this, { shellReactive: true,
                                                             styleClass: 'login-dialog' });
        this.connect('destroy',
                     Lang.bind(this, this._onDestroy));
        this.connect('opened',
                     Lang.bind(this, this._onOpened));

        this._userManager = AccountsService.UserManager.get_default()
        this._greeterClient = new GdmGreeter.Client();

        this._greeterClient.open_connection();

        this._greeterClient.call_start_conversation(_PASSWORD_SERVICE_NAME);

        this._greeterClient.connect('reset',
                                    Lang.bind(this, this._onReset));
        this._greeterClient.connect('default-session-changed',
                                    Lang.bind(this, this._onDefaultSessionChanged));
        this._greeterClient.connect('info',
                                    Lang.bind(this, this._onInfo));
        this._greeterClient.connect('problem',
                                    Lang.bind(this, this._onProblem));
        this._greeterClient.connect('info-query',
                                    Lang.bind(this, this._onInfoQuery));
        this._greeterClient.connect('secret-info-query',
                                    Lang.bind(this, this._onSecretInfoQuery));
        this._greeterClient.connect('session-opened',
                                    Lang.bind(this, this._onSessionOpened));
        this._greeterClient.connect('timed-login-requested',
                                    Lang.bind(this, this._onTimedLoginRequested));
        this._greeterClient.connect('authentication-failed',
                                    Lang.bind(this, this._onAuthenticationFailed));
        this._greeterClient.connect('conversation-stopped',
                                    Lang.bind(this, this._onConversationStopped));

        this._settings = new Gio.Settings({ schema: _LOGIN_SCREEN_SCHEMA });

        this._fprintManager = new Fprint.FprintManager();
        this._startFingerprintConversationIfNeeded();
        this._settings.connect('changed::' + _LOGO_KEY,
                               Lang.bind(this, this._updateLogo));

        this._logoBox = new St.Bin({ style_class: 'login-dialog-logo-box' });
        this.contentLayout.add(this._logoBox);
        this._updateLogo();

        this._titleLabel = new St.Label({ style_class: 'login-dialog-title',
                                          text: C_("title", "Sign In") });

        this.contentLayout.add(this._titleLabel,
                              { y_fill: false,
                                y_align: St.Align.START });

        let mainContentBox = new St.BoxLayout({ vertical: false });
        this.contentLayout.add(mainContentBox,
                               { expand: true,
                                 x_fill: true,
                                 y_fill: false });

        this._userList = new UserList();
        mainContentBox.add(this._userList.actor,
                           { expand: true,
                             x_fill: true,
                             y_fill: true });

        this.setInitialKeyFocus(this._userList.actor);

        this._promptBox = new St.BoxLayout({ style_class: 'login-dialog-prompt-layout',
                                             vertical: true });
        mainContentBox.add(this._promptBox,
                           { expand: true,
                             x_fill: true,
                             y_fill: true,
                             x_align: St.Align.START });
        this._promptLabel = new St.Label({ style_class: 'login-dialog-prompt-label' });

        this._mainContentBox = mainContentBox;

        this._promptBox.add(this._promptLabel,
                            { expand: true,
                              x_fill: true,
                              y_fill: true,
                              x_align: St.Align.START });
        this._promptEntry = new St.Entry({ style_class: 'login-dialog-prompt-entry',
                                           can_focus: true });
        this._promptBox.add(this._promptEntry,
                            { expand: true,
                              x_fill: true,
                              y_fill: false,
                              x_align: St.Align.START });
        // translators: this message is shown below the password entry field
        // to indicate the user can swipe their finger instead
        this._promptFingerprintMessage = new St.Label({ text: _("(or swipe finger)"),
                                                        style_class: 'login-dialog-prompt-fingerprint-message' });
        this._promptFingerprintMessage.hide();
        this._promptBox.add(this._promptFingerprintMessage);

        this._sessionList = new SessionList();
        this._sessionList.connect('session-activated',
                                  Lang.bind(this, function(list, sessionId) {
                                                this._greeterClient.call_select_session (sessionId);
                                            }));

        this._promptBox.add(this._sessionList.actor,
                            { expand: true,
                              x_fill: false,
                              y_fill: true,
                              x_align: St.Align.START });
        this._promptBox.hide();

        let notListedLabel = new St.Label({ text: _("Not listed?"),
                                            style_class: 'login-dialog-not-listed-label' });
        this._notListedButton = new St.Button({ style_class: 'login-dialog-not-listed-button',
                                                can_focus: true,
                                                child: notListedLabel,
                                                reactive: true,
                                                x_align: St.Align.START,
                                                x_fill: true });

        this._notListedButton.connect('clicked', Lang.bind(this, this._onNotListedClicked));

        this.contentLayout.add(this._notListedButton,
                               { expand: false,
                                 x_align: St.Align.START,
                                 x_fill: true });

        if (!this._userManager.is_loaded)
            this._userManagerLoadedId = this._userManager.connect('notify::is-loaded',
                                                                  Lang.bind(this, function() {
                                                                      if (this._userManager.is_loaded) {
                                                                          this._loadUserList();
                                                                          this._userManager.disconnect(this._userManagerLoadedId);
                                                                          this._userManagerLoadedId = 0;
                                                                      }
                                                                  }));
        else
            this._loadUserList();

        this._userList.connect('activate',
                               Lang.bind(this, function(userList, item) {
                                   this._onUserListActivated(item);
                               }));

   },

   _startFingerprintConversationIfNeeded: function() {
        this._haveFingerprintReader = false;

        if (!this._settings.get_boolean(_FINGERPRINT_AUTHENTICATION_KEY))
            return;

        this._fprintManager.GetDefaultDeviceRemote(DBus.CALL_FLAG_START, Lang.bind(this,
            function(device, error) {
                if (!error && device)
                    this._haveFingerprintReader = true;

                if (this._haveFingerprintReader)
                    this._greeterClient.call_start_conversation(_FINGERPRINT_SERVICE_NAME);
            }));
    },

    _updateLogo: function() {
        this._logoBox.child = null;
        let path = this._settings.get_string(_LOGO_KEY);

        if (path) {
            let file = Gio.file_new_for_path(path);
            let uri = file.get_uri();

            let textureCache = St.TextureCache.get_default();
            this._logoBox.child = textureCache.load_uri_async(uri, -1, _LOGO_ICON_NAME_SIZE);
        }

    },

    _onReset: function(client, serviceName) {
        this._greeterClient.call_start_conversation(_PASSWORD_SERVICE_NAME);
        this._startFingerprintConversationIfNeeded();

        let tasks = [this._hidePrompt,

                     new Batch.ConcurrentBatch(this, [this._fadeInTitleLabel,
                                                      this._fadeInNotListedButton,
                                                      this._fadeInLogo]),

                     function() {
                         this._sessionList.close();
                         this._promptFingerprintMessage.hide();
                         this._userList.actor.show();
                         this._userList.actor.opacity = 255;
                         return this._userList.showItems();
                     },

                     function() {
                         this._userList.actor.reactive = true;
                         this._userList.actor.grab_key_focus();
                     }];

        this._user = null;

        let batch = new Batch.ConsecutiveBatch(this, tasks);
        batch.run();
    },

    _onDefaultSessionChanged: function(client, sessionId) {
        this._sessionList.setActiveSession(sessionId);
    },

    _onInfo: function(client, serviceName, info) {
        // We don't display fingerprint messages, because they
        // have words like UPEK in them. Instead we use the messages
        // as a cue to display our own message.
        if (serviceName == _FINGERPRINT_SERVICE_NAME &&
            this._haveFingerprintReader &&
            (!this._promptFingerprintMessage.visible ||
             this._promptFingerprintMessage.opacity != 255)) {

            _fadeInActor(this._promptFingerprintMessage);
            return;
        }

        if (serviceName != _PASSWORD_SERVICE_NAME)
            return;
        Main.notifyError(info);
    },

    _onProblem: function(client, serviceName, problem) {
        // we don't want to show auth failed messages to
        // users who haven't enrolled their fingerprint.
        if (serviceName != _PASSWORD_SERVICE_NAME)
            return;
        Main.notifyError(problem);
    },

    _onCancel: function(client) {
        this._greeterClient.call_cancel();
    },

    _fadeInPrompt: function() {
        let tasks = [function() {
                         return _fadeInActor(this._promptLabel);
                     },

                     function() {
                         return _fadeInActor(this._promptEntry);
                     },

                     function() {
                         // Show it with 0 opacity so we preallocate space for it
                         // in the event we need to fade in the message
                         this._promptFingerprintMessage.opacity = 0;
                         this._promptFingerprintMessage.show();
                     },

                     function() {
                         return _fadeInActor(this._promptBox);
                     },

                     function() {
                         if (this._user && this._user.is_logged_in())
                             return null;

                         return _fadeInActor(this._sessionList.actor);
                     },

                     function() {
                         this._promptEntry.grab_key_focus();
                     }];

        this._sessionList.actor.hide();
        let batch = new Batch.ConcurrentBatch(this, tasks);
        return batch.run();
    },

    _showPrompt: function() {
        let hold = new Batch.Hold();

        let buttons = [{ action: Lang.bind(this, this._onCancel),
                         label: _("Cancel"),
                         key: Clutter.Escape },
                       { action: Lang.bind(this, function() {
                                     hold.release();
                                 }),
                         label: C_("button", "Sign In") }];

        this._promptEntryActivateCallbackId = this._promptEntry.clutter_text.connect('activate',
                                                                                     Lang.bind(this, function() {
                                                                                         hold.release();
                                                                                     }));
        hold.connect('release', Lang.bind(this, function() {
                         this._promptEntry.clutter_text.disconnect(this._promptEntryActivateCallbackId);
                         this._promptEntryActivateCallbackId = null;
                     }));

        let tasks = [function() {
                         return this._fadeInPrompt();
                     },

                     function() {
                         this.setButtons(buttons);
                     },

                     hold];

        let batch = new Batch.ConcurrentBatch(this, tasks);

        return batch.run();
    },

    _hidePrompt: function() {
        if (this._promptEntryActivateCallbackId) {
            this._promptEntry.clutter_text.disconnect(this._promptEntryActivateCallbackId);
            this._promptEntryActivateCallbackId = null;
        }

        this.setButtons([]);

        let tasks = [function() {
                         return _fadeOutActor(this._promptBox);
                     },

                     function() {
                         this._promptFingerprintMessage.hide();
                         this._promptEntry.reactive = true;
                         this._promptEntry.remove_style_pseudo_class('insensitive');
                         this._promptEntry.set_text('');
                     }];

        let batch = new Batch.ConsecutiveBatch(this, tasks);

        return batch.run();
    },

    _askQuestion: function(serviceName, question) {
        this._promptLabel.set_text(question);

        let tasks = [this._showPrompt,

                     function() {
                         let _text = this._promptEntry.get_text();
                         this._promptEntry.reactive = false;
                         this._promptEntry.add_style_pseudo_class('insensitive');
                         this._greeterClient.call_answer_query(serviceName, _text);
                     }];

        let batch = new Batch.ConsecutiveBatch(this, tasks);
        return batch.run();
    },
    _onInfoQuery: function(client, serviceName, question) {
        // We only expect questions to come from the main auth service
        if (serviceName != _PASSWORD_SERVICE_NAME)
            return;

        this._promptEntry.set_text('');
        this._promptEntry.clutter_text.set_password_char('');
        this._askQuestion(serviceName, question);
    },

    _onSecretInfoQuery: function(client, serviceName, secretQuestion) {
        // We only expect secret requests to come from the main auth service
        if (serviceName != _PASSWORD_SERVICE_NAME)
            return;

        this._promptEntry.set_text('');
        this._promptEntry.clutter_text.set_password_char('\u25cf');
        this._askQuestion(serviceName, secretQuestion);
    },

    _onSessionOpened: function(client, serviceName) {
        this._greeterClient.call_start_session_when_ready(serviceName, true);
    },

    _waitForItemForUser: function(userName) {
        let item = this._userList.getItemFromUserName(userName);

        if (item)
          return null;

        let hold = new Batch.Hold();
        let signalId = this._userList.connect('item-added',
                                              Lang.bind(this, function() {
                                                  let item = this._userList.getItemFromUserName(userName);

                                                  if (item)
                                                      hold.release();
                                              }));

        hold.connect('release', Lang.bind(this, function() {
                         this._userList.disconnect(signalId);
                     }));

        return hold;
    },

    _showTimedLoginAnimation: function() {
        this._timedLoginItem.actor.grab_key_focus();
        return this._timedLoginItem.showFocusAnimation(this._timedLoginAnimationTime);
    },

    _blockTimedLoginUntilIdle: function() {
        // This blocks timed login from starting until a few
        // seconds after the user stops interacting with the
        // login screen.
        //
        // We skip this step if the timed login delay is very
        // short.
        if ((this._timedLoginDelay - _TIMED_LOGIN_IDLE_THRESHOLD) <= 0)
          return null;

        let hold = new Batch.Hold();

        this._timedLoginIdleTimeOutId = Mainloop.timeout_add_seconds(_TIMED_LOGIN_IDLE_THRESHOLD,
                                                                     function() {
                                                                         this._timedLoginAnimationTime -= _TIMED_LOGIN_IDLE_THRESHOLD;
                                                                         hold.release();
                                                                     });
        return hold;
    },

    _startTimedLogin: function(userName, delay) {
        this._timedLoginItem = null;
        this._timedLoginDelay = delay;
        this._timedLoginAnimationTime = delay;

        let tasks = [function() {
                         return this._waitForItemForUser(userName);
                     },

                     function() {
                         this._timedLoginItem = this._userList.getItemFromUserName(userName);
                     },

                     function() {
                         // If we're just starting out, start on the right
                         // item.
                         if (!this.is_loaded) {
                             this._userList.jumpToItem(this._timedLoginItem);
                             this._timedLoginItem.showFocusAnimation(0);
                         }
                     },

                     this._blockTimedLoginUntilIdle,

                     function() {
                         this._userList.scrollToItem(this._timedLoginItem);
                     },

                     this._showTimedLoginAnimation,

                     function() {
                         this._timedLoginBatch = null;
                         this._greeterClient.call_begin_auto_login(userName);
                     }];

        this._timedLoginBatch = new Batch.ConsecutiveBatch(this, tasks);

        return this._timedLoginBatch.run();
    },

    _resetTimedLogin: function() {
        if (this._timedLoginBatch) {
            this._timedLoginBatch.cancel();
            this._timedLoginBatch = null;
        }

        let userName = this._timedLoginItem.user.get_user_name();

        if (userName)
            this._startTimedLogin(userName, this._timedLoginDelay);
    },

    _onTimedLoginRequested: function(client, userName, seconds) {
        this._startTimedLogin(userName, seconds);

        global.stage.connect('captured-event',
                             Lang.bind(this, function(actor, event) {
                                if (this._timedLoginDelay == undefined)
                                    return false;

                                if (event.type() == Clutter.EventType.KEY_PRESS ||
                                    event.type() == Clutter.EventType.BUTTON_PRESS) {
                                    if (this._timedLoginBatch) {
                                        this._timedLoginBatch.cancel();
                                        this._timedLoginBatch = null;
                                    }
                                } else if (event.type() == Clutter.EventType.KEY_RELEASE ||
                                           event.type() == Clutter.EventType.BUTTON_RELEASE) {
                                    this._resetTimedLogin();
                                }

                                return false;
                             }));
    },

    _onAuthenticationFailed: function(client) {
        this._greeterClient.call_cancel();
    },

    _onConversationStopped: function(client, serviceName) {
        // if the password service fails, then cancel everything.
        // But if, e.g., fingerprint fails, still give
        // password authentication a chance to succeed
        if (serviceName == _PASSWORD_SERVICE_NAME) {
            this._greeterClient.call_cancel();
        } else if (serviceName == _FINGERPRINT_SERVICE_NAME) {
            _fadeOutActor(this._promptFingerprintMessage);
        }
    },

    _onNotListedClicked: function(user) {
        let tasks = [function() {
                         return this._userList.hideItems();
                     },

                     function() {
                         return this._userList.giveUpWhitespace();
                     },

                     function() {
                         this._userList.actor.hide();
                     },

                     new Batch.ConcurrentBatch(this, [this._fadeOutTitleLabel,
                                                      this._fadeOutNotListedButton,
                                                      this._fadeOutLogo]),

                     function() {
                         this._greeterClient.call_begin_verification(_PASSWORD_SERVICE_NAME);
                     }];

        let batch = new Batch.ConsecutiveBatch(this, tasks);
        batch.run();
    },

    _fadeInLogo: function() {
        return _fadeInActor(this._logoBox);
    },

    _fadeOutLogo: function() {
        return _fadeOutActor(this._logoBox);
    },

    _fadeInTitleLabel: function() {
        return _fadeInActor(this._titleLabel);
    },

    _fadeOutTitleLabel: function() {
        return _fadeOutActor(this._titleLabel);
    },

    _fadeInNotListedButton: function() {
        return _fadeInActor(this._notListedButton);
    },

    _fadeOutNotListedButton: function() {
        return _fadeOutActor(this._notListedButton);
    },

    _onUserListActivated: function(activatedItem) {
        let tasks = [function() {
                         this._userList.actor.reactive = false;
                         return this._userList.pinInPlace();
                     },

                     function() {
                         return this._userList.hideItemsExcept(activatedItem);
                     },

                     function() {
                         return this._userList.giveUpWhitespace();
                     },

                     function() {
                         return activatedItem.fadeOutName();
                     },

                     new Batch.ConcurrentBatch(this, [this._fadeOutTitleLabel,
                                                      this._fadeOutNotListedButton,
                                                      this._fadeOutLogo]),

                     function() {
                         return this._userList.shrinkToNaturalHeight();
                     },

                     function() {
                         let userName = activatedItem.user.get_user_name();
                         this._greeterClient.call_begin_verification_for_user(_PASSWORD_SERVICE_NAME,
                                                                              userName);

                         if (this._haveFingerprintReader)
                             this._greeterClient.call_begin_verification_for_user(_FINGERPRINT_SERVICE_NAME, userName);
                     }];

        this._user = activatedItem.user;

        let batch = new Batch.ConsecutiveBatch(this, tasks);
        batch.run();
    },

    _onDestroy: function() {
        if (this._userManagerLoadedId) {
            this._userManager.disconnect(this._userManagerLoadedId);
            this._userManagerLoadedId = 0;
        }
    },

    _loadUserList: function() {
        let users = this._userManager.list_users();

        for (let i = 0; i < users.length; i++) {
            this._userList.addUser(users[i]);
        }

        this._userManager.connect('user-added',
                                  Lang.bind(this, function(userManager, user) {
                                      this._userList.addUser(user);
                                  }));

        this._userManager.connect('user-removed',
                                  Lang.bind(this, function(userManager, user) {
                                      this._userList.removeUser(user);
                                  }));

        // emitted in idle so caller doesn't have to explicitly check if
        // it's loaded immediately after construction
        // (since there's no way the caller could be listening for
        // 'loaded' yet)
        Mainloop.idle_add(Lang.bind(this, function() {
            this.emit('loaded');
            this.is_loaded = true;
        }));
    },

    _onOpened: function() {
        Main.ctrlAltTabManager.addGroup(this._mainContentBox,
                                        _("Login Window"),
                                        'dialog-password',
                                        { sortGroup: CtrlAltTab.SortGroup.MIDDLE });

    },

    close: function() {
        ModalDialog.ModalDialog.prototype.close.call(this);

        Main.ctrlAltTabManager.removeGroup(this._group);
    }
};
