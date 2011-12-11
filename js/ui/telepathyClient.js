// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const DBus = imports.dbus;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;
const Signals = imports.signals;
const St = imports.gi.St;
const Tpl = imports.gi.TelepathyLogger;
const Tp = imports.gi.TelepathyGLib;

const History = imports.misc.history;
const Params = imports.misc.params;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;


// See Notification.appendMessage
const SCROLLBACK_IMMEDIATE_TIME = 60; // 1 minute
const SCROLLBACK_RECENT_TIME = 15 * 60; // 15 minutes
const SCROLLBACK_RECENT_LENGTH = 20;
const SCROLLBACK_IDLE_LENGTH = 5;

// See Source._displayPendingMessages
const SCROLLBACK_HISTORY_LINES = 10;

// See Notification._onEntryChanged
const COMPOSING_STOP_TIMEOUT = 5;

const NotificationDirection = {
    SENT: 'chat-sent',
    RECEIVED: 'chat-received'
};

let contactFeatures = [Tp.ContactFeature.ALIAS,
                        Tp.ContactFeature.AVATAR_DATA,
                        Tp.ContactFeature.PRESENCE];

// This is GNOME Shell's implementation of the Telepathy 'Client'
// interface. Specifically, the shell is a Telepathy 'Observer', which
// lets us see messages even if they belong to another app (eg,
// Empathy).

function makeMessageFromTpMessage(tpMessage, direction) {
    let [text, flags] = tpMessage.to_text();

    let timestamp = tpMessage.get_sent_timestamp();
    if (timestamp == 0)
        timestamp = tpMessage.get_received_timestamp();

    return {
        messageType: tpMessage.get_message_type(),
        text: text,
        sender: tpMessage.sender.alias,
        timestamp: timestamp,
        direction: direction
    };
}


function makeMessageFromTplEvent(event) {
    let sent = event.get_sender().get_entity_type() == Tpl.EntityType.SELF;
    let direction = sent ? NotificationDirection.SENT : NotificationDirection.RECEIVED;

    return {
        messageType: event.get_message_type(),
        text: event.get_message(),
        sender: event.get_sender().get_alias(),
        timestamp: event.get_timestamp(),
        direction: direction
    };
}

function Client() {
    this._init();
};

Client.prototype = {
    _init : function() {
        // channel path -> ChatSource
        this._chatSources = {};
        this._chatState = Tp.ChannelChatState.ACTIVE;

        // account path -> AccountNotification
        this._accountNotifications = {};

        // Set up a SimpleObserver, which will call _observeChannels whenever a
        // channel matching its filters is detected.
        // The second argument, recover, means _observeChannels will be run
        // for any existing channel as well.
        this._accountManager = Tp.AccountManager.dup();
        this._tpClient = new Shell.TpClient({ 'account-manager': this._accountManager,
                                              'name': 'GnomeShell',
                                              'uniquify-name': true })
        this._tpClient.set_observe_channels_func(
            Lang.bind(this, this._observeChannels));
        this._tpClient.set_approve_channels_func(
            Lang.bind(this, this._approveChannels));
        this._tpClient.set_handle_channels_func(
            Lang.bind(this, this._handleChannels));

        // Workaround for gjs not supporting GPtrArray in signals.
        // See BGO bug #653941 for context.
        this._tpClient.set_contact_list_changed_func(
            Lang.bind(this, this._contactListChanged));

        // Allow other clients (such as Empathy) to pre-empt our channels if
        // needed
        this._tpClient.set_delegated_channels_callback(
            Lang.bind(this, this._delegatedChannelsCb));

        try {
            this._tpClient.register();
        } catch (e) {
            throw new Error('Couldn\'t register Telepathy client. Error: \n' + e);
        }


        // Watch subscription requests and connection errors
        this._subscriptionSource = null;
        this._accountSource = null;
        let factory = this._accountManager.get_factory();
        factory.add_account_features([Tp.Account.get_feature_quark_connection()]);
        factory.add_connection_features([Tp.Connection.get_feature_quark_contact_list()]);
        factory.add_contact_features([Tp.ContactFeature.SUBSCRIPTION_STATES,
                                      Tp.ContactFeature.ALIAS,
                                      Tp.ContactFeature.AVATAR_DATA]);

        this._accountManager.connect('account-validity-changed',
            Lang.bind(this, this._accountValidityChanged));

        this._accountManager.prepare_async(null, Lang.bind(this, this._accountManagerPrepared));
    },

    _observeChannels: function(observer, account, conn, channels,
                               dispatchOp, requests, context) {
        // If the self_contact doesn't have the ALIAS, make sure
        // to fetch it before trying to grab the channels.
        let self_contact = conn.get_self_contact();
        if (self_contact.has_feature(Tp.ContactFeature.ALIAS)) {
            this._finishObserveChannels(account, conn, channels, context);
        } else {
            Shell.get_self_contact_features(conn,
                                            contactFeatures,
                                            Lang.bind(this, function() {
                                                this._finishObserveChannels(account, conn, channels, context);
                                            }));
            context.delay();
        }
    },

    _finishObserveChannels: function(account, conn, channels, context) {
        let len = channels.length;
        for (let i = 0; i < len; i++) {
            let channel = channels[i];
            let [targetHandle, targetHandleType] = channel.get_handle();

            /* Only observe contact text channels */
            if ((!(channel instanceof Tp.TextChannel)) ||
               targetHandleType != Tp.HandleType.CONTACT)
               continue;

            /* Request a TpContact */
            Shell.get_tp_contacts(conn, [targetHandle],
                    contactFeatures,
                    Lang.bind(this,  function (connection, contacts, failed) {
                        if (contacts.length < 1)
                            return;

                        /* We got the TpContact */
                        this._createChatSource(account, conn, channel, contacts[0]);
                    }), null);
        }

        context.accept();
    },

    _createChatSource: function(account, conn, channel, contact) {
        if (this._chatSources[channel.get_object_path()])
            return;

        let source = new ChatSource(account, conn, channel, contact, this._tpClient);

        this._chatSources[channel.get_object_path()] = source;
        source.connect('destroy', Lang.bind(this,
                       function() {
                           if (this._tpClient.is_handling_channel(channel)) {
                               // The chat box has been destroyed so it can't
                               // handle the channel any more.
                               channel.close_async(function(src, result) {
                                   channel.close_finish(result);
                               });
                           }

                           delete this._chatSources[channel.get_object_path()];
                       }));
    },

    _handleChannels: function(handler, account, conn, channels,
                              requests, user_action_time, context) {
        this._handlingChannels(account, conn, channels);
        context.accept();
    },

    _handlingChannels: function(account, conn, channels) {
        let len = channels.length;
        for (let i = 0; i < len; i++) {
            let channel = channels[i];

            // We can only handle text channel, so close any other channel
            if (!(channel instanceof Tp.TextChannel)) {
                channel.close_async(null);
                continue;
            }

            if (this._tpClient.is_handling_channel(channel)) {
                // We are already handling the channel, display the source
                let source = this._chatSources[channel.get_object_path()];
                if (source)
                    source.notify();
            }
        }
    },

    _displayRoomInvitation: function(conn, channel, dispatchOp, context) {
        // We can only approve the rooms if we have been invited to it
        let selfHandle = channel.group_get_self_handle();
        if (selfHandle == 0) {
            Shell.decline_dispatch_op(context, 'Not invited to the room');
            return;
        }

        let [invited, inviter, reason, msg] = channel.group_get_local_pending_info(selfHandle);
        if (!invited) {
            Shell.decline_dispatch_op(context, 'Not invited to the room');
            return;
        }

        // Request a TpContact for the inviter
        Shell.get_tp_contacts(conn, [inviter],
                contactFeatures,
                Lang.bind(this, this._createRoomInviteSource, channel, context, dispatchOp));

        context.delay();
     },

    _createRoomInviteSource: function(connection, contacts, failed, channel, context, dispatchOp) {
        if (contacts.length < 1) {
            Shell.decline_dispatch_op(context, 'Failed to get inviter');
            return;
        }

        // We got the TpContact

        // FIXME: We don't have a 'chat room' icon (bgo #653737) use
        // system-users for now as Empathy does.
        let source = new ApproverSource(dispatchOp, _("Invitation"),
                                        Gio.icon_new_for_string('system-users'));
        Main.messageTray.add(source);

        let notif = new RoomInviteNotification(source, dispatchOp, channel, contacts[0]);
        source.notify(notif);
        context.accept();
    },

    _approveChannels: function(approver, account, conn, channels,
                               dispatchOp, context) {
        let channel = channels[0];
        let chanType = channel.get_channel_type();

        if (chanType == Tp.IFACE_CHANNEL_TYPE_TEXT)
            this._approveTextChannel(account, conn, channel, dispatchOp, context);
        else if (chanType == Tp.IFACE_CHANNEL_TYPE_STREAMED_MEDIA ||
                 chanType == 'org.freedesktop.Telepathy.Channel.Type.Call.DRAFT')
            this._approveCall(account, conn, channel, dispatchOp, context);
        else if (chanType == Tp.IFACE_CHANNEL_TYPE_FILE_TRANSFER)
            this._approveFileTransfer(account, conn, channel, dispatchOp, context);
    },

    _approveTextChannel: function(account, conn, channel, dispatchOp, context) {
        let [targetHandle, targetHandleType] = channel.get_handle();

        if (targetHandleType == Tp.HandleType.CONTACT) {
            // Approve private text channels right away as we are going to handle it
            dispatchOp.claim_with_async(this._tpClient,
                                        Lang.bind(this, function(dispatchOp, result) {
                try {
                    dispatchOp.claim_with_finish(result);
                    this._handlingChannels(account, conn, [channel]);
                } catch (err) {
                    throw new Error('Failed to Claim channel: ' + err);
                }}));

            context.accept();
        } else {
            this._displayRoomInvitation(conn, channel, dispatchOp, context);
        }
    },

    _approveCall: function(account, conn, channel, dispatchOp, context) {
        let [targetHandle, targetHandleType] = channel.get_handle();

        Shell.get_tp_contacts(conn, [targetHandle],
                contactFeatures,
                Lang.bind(this, this._createAudioVideoSource, channel, context, dispatchOp));

        context.delay();
    },

    _createAudioVideoSource: function(connection, contacts, failed, channel, context, dispatchOp) {
        if (contacts.length < 1) {
            Shell.decline_dispatch_op(context, 'Failed to get inviter');
            return;
        }

        let isVideo = false;

        let props = channel.borrow_immutable_properties();

        if (props['org.freedesktop.Telepathy.Channel.Type.Call.DRAFT.InitialVideo'] ||
            props[Tp.PROP_CHANNEL_TYPE_STREAMED_MEDIA_INITIAL_VIDEO])
          isVideo = true;

        // We got the TpContact
        let source = new ApproverSource(dispatchOp, _("Call"), isVideo ?
                                        Gio.icon_new_for_string('camera-web') :
                                        Gio.icon_new_for_string('audio-input-microphone'));
        Main.messageTray.add(source);

        let notif = new AudioVideoNotification(source, dispatchOp, channel, contacts[0], isVideo);
        source.notify(notif);
        context.accept();
    },

    _approveFileTransfer: function(account, conn, channel, dispatchOp, context) {
        let [targetHandle, targetHandleType] = channel.get_handle();

        Shell.get_tp_contacts(conn, [targetHandle],
                contactFeatures,
                Lang.bind(this, this._createFileTransferSource, channel, context, dispatchOp));

        context.delay();
    },

    _createFileTransferSource: function(connection, contacts, failed, channel, context, dispatchOp) {
        if (contacts.length < 1) {
            Shell.decline_dispatch_op(context, 'Failed to get file sender');
            return;
        }

        // Use the icon of the file being transferred
        let gicon = Gio.content_type_get_icon(channel.get_mime_type());

        // We got the TpContact
        let source = new ApproverSource(dispatchOp, _("File Transfer"), gicon);
        Main.messageTray.add(source);

        let notif = new FileTransferNotification(source, dispatchOp, channel, contacts[0]);
        source.notify(notif);
        context.accept();
    },

    _delegatedChannelsCb: function(client, channels) {
        // Nothing to do as we don't make a distinction between observed and
        // handled channels.
    },

    _accountManagerPrepared: function(am, result) {
        am.prepare_finish(result);

        let accounts = am.get_valid_accounts();
        for (let i = 0; i < accounts.length; i++) {
            this._accountValidityChanged(am, accounts[i], true);
        }
    },

    _accountValidityChanged: function(am, account, valid) {
        if (!valid)
            return;

        // It would be better to connect to "status-changed" but we cannot.
        // See discussion in https://bugzilla.gnome.org/show_bug.cgi?id=654159
        account.connect("notify::connection-status",
                        Lang.bind(this, this._accountConnectionStatusNotifyCb));

        account.connect('notify::connection',
                        Lang.bind(this, this._connectionChanged));
        this._connectionChanged(account);
    },

    _connectionChanged: function(account) {
        let conn = account.get_connection();
        if (conn == null)
            return;

        this._tpClient.grab_contact_list_changed(conn);
        if (conn.get_contact_list_state() == Tp.ContactListState.SUCCESS) {
            this._contactListChanged(conn, conn.dup_contact_list(), []);
        }
    },

    _contactListChanged: function(conn, added, removed) {
        for (let i = 0; i < added.length; i++) {
            let contact = added[i];

            contact.connect('subscription-states-changed',
                            Lang.bind(this, this._subscriptionStateChanged));
            this._subscriptionStateChanged(contact);
        }
    },

    _subscriptionStateChanged: function(contact) {
        if (contact.get_publish_state() != Tp.SubscriptionState.ASK)
            return;

        /* Implicitly accept publish requests if contact is already subscribed */
        if (contact.get_subscribe_state() == Tp.SubscriptionState.YES ||
            contact.get_subscribe_state() == Tp.SubscriptionState.ASK) {

            contact.authorize_publication_async(function(src, result) {
                src.authorize_publication_finish(result)});

            return;
        }

        /* Display notification to ask user to accept/reject request */
        let source = this._ensureSubscriptionSource();

        let notif = new SubscriptionRequestNotification(source, contact);
        source.notify(notif);
    },

    _ensureSubscriptionSource: function() {
        if (this._subscriptionSource == null) {
            this._subscriptionSource = new MultiNotificationSource(
                _("Subscription request"), 'gtk-dialog-question');
            Main.messageTray.add(this._subscriptionSource);
            this._subscriptionSource.connect('destroy', Lang.bind(this, function () {
                this._subscriptionSource = null;
            }));
        }

        return this._subscriptionSource;
    },

    _accountConnectionStatusNotifyCb: function(account) {
        let connectionError = account.connection_error;

        if (account.connection_status != Tp.ConnectionStatus.DISCONNECTED ||
            connectionError == Tp.error_get_dbus_name(Tp.Error.CANCELLED)) {
            return;
        }

        let notif = this._accountNotifications[account.get_object_path()];
        if (notif)
            return;

        /* Display notification that account failed to connect */
        let source = this._ensureAccountSource();

        notif = new AccountNotification(source, account, connectionError);
        this._accountNotifications[account.get_object_path()] = notif;
        notif.connect('destroy', Lang.bind(this, function() {
            delete this._accountNotifications[account.get_object_path()];
        }));
        source.notify(notif);
    },

    _ensureAccountSource: function() {
        if (this._accountSource == null) {
            this._accountSource = new MultiNotificationSource(
                _("Connection error"), 'gtk-dialog-error');
            Main.messageTray.add(this._accountSource);
            this._accountSource.connect('destroy', Lang.bind(this, function () {
                this._accountSource = null;
            }));
        }

        return this._accountSource;
    }
};

function ChatSource(account, conn, channel, contact, client) {
    this._init(account, conn, channel, contact, client);
}

ChatSource.prototype = {
    __proto__:  MessageTray.Source.prototype,

    _init: function(account, conn, channel, contact, client) {
        MessageTray.Source.prototype._init.call(this, contact.get_alias());

        this.isChat = true;

        this._account = account;
        this._contact = contact;
        this._client = client;

        this._pendingMessages = [];

        this._conn = conn;
        this._channel = channel;
        this._closedId = this._channel.connect('invalidated', Lang.bind(this, this._channelClosed));

        this._notification = new ChatNotification(this);
        this._notification.setUrgency(MessageTray.Urgency.HIGH);
        this._notifyTimeoutId = 0;

        // We ack messages when the message box is collapsed if user has
        // interacted with it before and so read the messages:
        // - user clicked on it the tray
        // - user expanded the notification by hovering over the toaster notification
        this._shouldAck = false;

        this.connect('summary-item-clicked', Lang.bind(this, this._summaryItemClicked));
        this._notification.connect('expanded', Lang.bind(this, this._notificationExpanded));
        this._notification.connect('collapsed', Lang.bind(this, this._notificationCollapsed));

        this._presence = contact.get_presence_type();

        this._sentId = this._channel.connect('message-sent', Lang.bind(this, this._messageSent));
        this._receivedId = this._channel.connect('message-received', Lang.bind(this, this._messageReceived));
        this._pendingId = this._channel.connect('pending-message-removed', Lang.bind(this, this._pendingRemoved));

        this._setSummaryIcon(this.createNotificationIcon());

        this._notifyAliasId = this._contact.connect('notify::alias', Lang.bind(this, this._updateAlias));
        this._notifyAvatarId = this._contact.connect('notify::avatar-file', Lang.bind(this, this._updateAvatarIcon));
        this._presenceChangedId = this._contact.connect('presence-changed', Lang.bind(this, this._presenceChanged));

        // Add ourselves as a source.
        Main.messageTray.add(this);
        this.pushNotification(this._notification);

        this._getLogMessages();
    },

    _updateAlias: function() {
        let oldAlias = this.title;
        let newAlias = this._contact.get_alias();

        if (oldAlias == newAlias)
            return;

        this.setTitle(newAlias);
        this._notification.appendAliasChange(oldAlias, newAlias);
    },

    createNotificationIcon: function() {
        this._iconBox = new St.Bin({ style_class: 'avatar-box' });
        this._iconBox._size = this.ICON_SIZE;
        let textureCache = St.TextureCache.get_default();
        let file = this._contact.get_avatar_file();

        if (file) {
            let uri = file.get_uri();
            this._iconBox.child = textureCache.load_uri_async(uri, this._iconBox._size, this._iconBox._size);
        } else {
            this._iconBox.child = new St.Icon({ icon_name: 'avatar-default',
                                                icon_type: St.IconType.FULLCOLOR,
                                                icon_size: this._iconBox._size });
        }

        return this._iconBox;
    },

    _updateAvatarIcon: function() {
        this._setSummaryIcon(this.createNotificationIcon());
        this._notification.update(this._notification.title, null, { customContent: true, icon: this.createNotificationIcon() });
    },

    open: function(notification) {
          if (this._client.is_handling_channel(this._channel)) {
              // We are handling the channel, try to pass it to Empathy
              this._client.delegate_channels_async([this._channel], global.get_current_time(), '', null);
          }
          else {
              // We are not the handler, just ask to present the channel
              let dbus = Tp.DBusDaemon.dup();
              let cd = Tp.ChannelDispatcher.new(dbus);

              cd.present_channel_async(this._channel, global.get_current_time(), null);
          }
    },

    _getLogMessages: function() {
        let logManager = Tpl.LogManager.dup_singleton();
        let entity = Tpl.Entity.new_from_tp_contact(this._contact, Tpl.EntityType.CONTACT);
        Shell.get_contact_events(logManager,
                                 this._account, entity,
                                 SCROLLBACK_HISTORY_LINES,
                                 Lang.bind(this, this._displayPendingMessages));
    },

    _displayPendingMessages: function(logManager, result) {
        let [success, events] = logManager.get_filtered_events_finish(result);

        let logMessages = events.map(makeMessageFromTplEvent);

        let pendingTpMessages = this._channel.get_pending_messages();
        let pendingMessages = [];

        for (let i = 0; i < pendingTpMessages.length; i++) {
            let message = pendingTpMessages[i];

            if (message.get_message_type() == Tp.ChannelTextMessageType.DELIVERY_REPORT)
                continue;

            pendingMessages.push(makeMessageFromTpMessage(message, NotificationDirection.RECEIVED));

            this._pendingMessages.push(message);
        }

        this._updateCount();

        let showTimestamp = false;

        for (let i = 0; i < logMessages.length; i++) {
            let logMessage = logMessages[i];
            let isPending = false;

            // Skip any log messages that are also in pendingMessages
            for (let j = 0; j < pendingMessages.length; j++) {
                let pending = pendingMessages[j];
                if (logMessage.timestamp == pending.timestamp && logMessage.text == pending.text) {
                    isPending = true;
                    break;
                }
            }

            if (!isPending) {
                showTimestamp = true;
                this._notification.appendMessage(logMessage, true, ['chat-log-message']);
            }
        }

        if (showTimestamp)
            this._notification.appendTimestamp();

        for (let i = 0; i < pendingMessages.length; i++)
            this._notification.appendMessage(pendingMessages[i], true);

        if (pendingMessages.length > 0)
            this.notify();
    },

    _channelClosed: function() {
        this._channel.disconnect(this._closedId);
        this._channel.disconnect(this._receivedId);
        this._channel.disconnect(this._pendingId);
        this._channel.disconnect(this._sentId);

        this._contact.disconnect(this._notifyAliasId);
        this._contact.disconnect(this._notifyAvatarId);
        this._contact.disconnect(this._presenceChangedId);

        this.destroy();
    },

    _updateCount: function() {
        this._setCount(this._pendingMessages.length, this._pendingMessages.length > 0);
    },

    _messageReceived: function(channel, message) {
        if (message.get_message_type() == Tp.ChannelTextMessageType.DELIVERY_REPORT)
            return;

        this._pendingMessages.push(message);
        this._updateCount();

        message = makeMessageFromTpMessage(message, NotificationDirection.RECEIVED);
        this._notification.appendMessage(message);

        // Wait a bit before notifying for the received message, a handler
        // could ack it in the meantime.
        if (this._notifyTimeoutId != 0)
            Mainloop.source_remove(this._notifyTimeoutId);
        this._notifyTimeoutId = Mainloop.timeout_add(500,
            Lang.bind(this, this._notifyTimeout));
    },

    _notifyTimeout: function() {
        if (this._pendingMessages.length != 0)
            this.notify();

        this._notifyTimeoutId = 0;

        return false;
    },

    // This is called for both messages we send from
    // our client and other clients as well.
    _messageSent: function(channel, message, flags, token) {
        message = makeMessageFromTpMessage(message, NotificationDirection.SENT);
        this._notification.appendMessage(message);
    },

    notify: function() {
        MessageTray.Source.prototype.notify.call(this, this._notification);
    },

    respond: function(text) {
        let type;
        if (text.slice(0, 4) == '/me ') {
            type = Tp.ChannelTextMessageType.ACTION;
            text = text.slice(4);
        } else {
            type = Tp.ChannelTextMessageType.NORMAL;
        }

        let msg = Tp.ClientMessage.new_text(type, text);
        this._channel.send_message_async(msg, 0, Lang.bind(this, function (src, result) {
            this._channel.send_message_finish(result); 
        }));
    },

    setChatState: function(state) {
        // We don't want to send COMPOSING every time a letter is typed into
        // the entry. We send the state only when it changes. Telepathy/Empathy
        // might change it behind our back if the user is using both
        // gnome-shell's entry and the Empathy conversation window. We could
        // keep track of it with the ChatStateChanged signal but it is good
        // enough right now.
        if (state != this._chatState) {
          this._chatState = state;
          this._channel.set_chat_state_async(state, null);
        }
    },

    _presenceChanged: function (contact, presence, status, message) {
        let msg, shouldNotify, title;

        if (this._presence == presence)
          return;

        title = GLib.markup_escape_text(this.title, -1);

        if (presence == Tp.ConnectionPresenceType.AVAILABLE) {
            msg = _("%s is online.").format(title);
            shouldNotify = (this._presence == Tp.ConnectionPresenceType.OFFLINE);
        } else if (presence == Tp.ConnectionPresenceType.OFFLINE ||
                   presence == Tp.ConnectionPresenceType.EXTENDED_AWAY) {
            presence = Tp.ConnectionPresenceType.OFFLINE;
            msg = _("%s is offline.").format(title);
            shouldNotify = (this._presence != Tp.ConnectionPresenceType.OFFLINE);
        } else if (presence == Tp.ConnectionPresenceType.AWAY) {
            msg = _("%s is away.").format(title);
            shouldNotify = false;
        } else if (presence == Tp.ConnectionPresenceType.BUSY) {
            msg = _("%s is busy.").format(title);
            shouldNotify = false;
        } else
            return;

        this._presence = presence;

        if (message)
            msg += ' <i>(' + GLib.markup_escape_text(message, -1) + ')</i>';

        this._notification.appendPresence(msg, shouldNotify);
        if (shouldNotify)
            this.notify();
    },

    _pendingRemoved: function(channel, message) {
        let idx = this._pendingMessages.indexOf(message);

        if (idx >= 0) {
            this._pendingMessages.splice(idx, 1);
            this._updateCount();
        }
        else
            throw new Error('Message not in our pending list: ' + message);
    },

    _ackMessages: function() {
        // Don't clear our messages here, tp-glib will send a
        // 'pending-message-removed' for each one.
        this._channel.ack_all_pending_messages_async(Lang.bind(this, function(src, result) {
            this._channel.ack_all_pending_messages_finish(result);}));
    },

    _summaryItemClicked: function(source, button) {
        if (button != 1)
            return;

        this._shouldAck = true;
    },

    _notificationExpanded: function() {
        this._shouldAck = true;
    },

    _notificationCollapsed: function() {
        if (this._shouldAck)
            this._ackMessages();

        this._shouldAck = false;
    }
};

function ChatNotification(source) {
    this._init(source);
}

ChatNotification.prototype = {
    __proto__:  MessageTray.Notification.prototype,

    _init: function(source) {
        MessageTray.Notification.prototype._init.call(this, source, source.title, null, { customContent: true });
        this.setResident(true);

        this._responseEntry = new St.Entry({ style_class: 'chat-response',
                                             can_focus: true });
        this._responseEntry.clutter_text.connect('activate', Lang.bind(this, this._onEntryActivated));
        this._responseEntry.clutter_text.connect('text-changed', Lang.bind(this, this._onEntryChanged));
        this.setActionArea(this._responseEntry);

        this._oldMaxScrollAdjustment = 0;
        this._createScrollArea();
        this._lastGroup = null;
        this._lastGroupActor = null;

        this._scrollArea.vscroll.adjustment.connect('changed', Lang.bind(this, function(adjustment) {
            let currentValue = adjustment.value + adjustment.page_size;
            if (currentValue == this._oldMaxScrollAdjustment)
                this.scrollTo(St.Side.BOTTOM);
            this._oldMaxScrollAdjustment = adjustment.upper;
        }));

        this._inputHistory = new History.HistoryManager({ entry: this._responseEntry.clutter_text });

        this._history = [];
        this._timestampTimeoutId = 0;
        this._composingTimeoutId = 0;
    },

    /**
     * appendMessage:
     * @message: An object with the properties:
     *   text: the body of the message,
     *   messageType: a #Tp.ChannelTextMessageType,
     *   sender: the name of the sender,
     *   timestamp: the time the message was sent
     *   direction: a #NotificationDirection
     * 
     * @noTimestamp: Whether to add a timestamp. If %true, no timestamp
     *   will be added, regardless of the difference since the
     *   last timestamp
     */
    appendMessage: function(message, noTimestamp) {
        let messageBody = GLib.markup_escape_text(message.text, -1);
        let styles = [message.direction];

        if (message.messageType == Tp.ChannelTextMessageType.ACTION) {
            let senderAlias = GLib.markup_escape_text(message.sender, -1);
            messageBody = '<i>%s</i> %s'.format(senderAlias, messageBody);
            styles.push('chat-action');
        }

        if (message.direction == NotificationDirection.RECEIVED) {
            this.update(this.source.title, messageBody, { customContent: true,
                                                          bannerMarkup: true });
        }

        let group = (message.direction == NotificationDirection.RECEIVED ?
                     'received' : 'sent');

        this._append({ body: messageBody,
                       group: group,
                       styles: styles,
                       timestamp: message.timestamp,
                       noTimestamp: noTimestamp });
    },

    _filterMessages: function() {
        if (this._history.length < 1)
            return;

        let lastMessageTime = this._history[0].time;
        let currentTime = (Date.now() / 1000);

        // Keep the scrollback from growing too long. If the most
        // recent message (before the one we just added) is within
        // SCROLLBACK_RECENT_TIME, we will keep
        // SCROLLBACK_RECENT_LENGTH previous messages. Otherwise
        // we'll keep SCROLLBACK_IDLE_LENGTH messages.

        let maxLength = (lastMessageTime < currentTime - SCROLLBACK_RECENT_TIME) ?
            SCROLLBACK_IDLE_LENGTH : SCROLLBACK_RECENT_LENGTH;

        let filteredHistory = this._history.filter(function(item) { return item.realMessage });
        if (filteredHistory.length > maxLength) {
            let lastMessageToKeep = filteredHistory[maxLength];
            let expired = this._history.splice(this._history.indexOf(lastMessageToKeep));
            for (let i = 0; i < expired.length; i++)
                expired[i].actor.destroy();
        }

        let groups = this._contentArea.get_children();
        for (let i = 0; i < groups.length; i ++) {
            let group = groups[i];
            if (group.get_children().length == 0)
                group.destroy();
        }
    },

    /**
     * _append:
     * @props: An object with the properties:
     *  body: The text of the message.
     *  group: The group of the message, one of:
     *         'received', 'sent', 'meta'.
     *  styles: Style class names for the message to have.
     *  timestamp: The timestamp of the message.
     *  noTimestamp: suppress timestamp signal?
     *  childProps: props to add the actor with.
     */
    _append: function(props) {
        let currentTime = (Date.now() / 1000);
        props = Params.parse(props, { body: null,
                                      group: null,
                                      styles: [],
                                      timestamp: currentTime,
                                      noTimestamp: false,
                                      childProps: null });

        // Reset the old message timeout
        if (this._timestampTimeoutId)
            Mainloop.source_remove(this._timestampTimeoutId);

        let highlighter = new MessageTray.URLHighlighter(props.body,
                                                         true,  // line wrap?
                                                         true); // allow markup?

        let body = highlighter.actor;

        let styles = props.styles;
        for (let i = 0; i < styles.length; i ++)
            body.add_style_class_name(styles[i]);

        let group = props.group;
        if (group != this._lastGroup) {
            let style = 'chat-group-' + group;
            this._lastGroup = group;
            this._lastGroupActor = new St.BoxLayout({ style_class: style,
                                                      vertical: true });
            this.addActor(this._lastGroupActor);
        }

        this._lastGroupActor.add(body, props.childProps);

        let timestamp = props.timestamp;
        this._history.unshift({ actor: body, time: timestamp,
                                realMessage: group != 'meta' });

        if (!props.noTimestamp) {
            if (timestamp < currentTime - SCROLLBACK_IMMEDIATE_TIME)
                this.appendTimestamp();
            else
                // Schedule a new timestamp in SCROLLBACK_IMMEDIATE_TIME
                // from the timestamp of the message.
                this._timestampTimeoutId = Mainloop.timeout_add_seconds(
                    SCROLLBACK_IMMEDIATE_TIME - (currentTime - timestamp),
                    Lang.bind(this, this.appendTimestamp));
        }

        this._filterMessages();
    },

    _formatTimestamp: function(date) {
        let now = new Date();

        var daysAgo = (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000);

        let format;

        // Show a week day and time if date is in the last week
        if (daysAgo < 1 || (daysAgo < 7 && now.getDay() != date.getDay())) {
            /* Translators: this is a time format string followed by a date.
             If applicable, replace %X with a strftime format valid for your
             locale, without seconds. */
            // xgettext:no-c-format
            format = _("Sent at <b>%X</b> on <b>%A</b>");

        } else if (date.getYear() == now.getYear()) {
            /* Translators: this is a time format in the style of "Wednesday, May 25",
             shown when you get a chat message in the same year. */
            // xgettext:no-c-format
            format = _("Sent on <b>%A</b>, <b>%B %d</b>");
        } else {
            /* Translators: this is a time format in the style of "Wednesday, May 25, 2012",
             shown when you get a chat message in a different year. */
            // xgettext:no-c-format
            format = _("Sent on <b>%A</b>, <b>%B %d</b>, %Y");
        }

        return date.toLocaleFormat(format);
    },

    appendTimestamp: function() {
        let lastMessageTime = this._history[0].time;
        let lastMessageDate = new Date(lastMessageTime * 1000);

        let timeLabel = this._append({ body: this._formatTimestamp(lastMessageDate),
                                       group: 'meta',
                                       styles: ['chat-meta-message'],
                                       childProps: { expand: true, x_fill: false,
                                                     x_align: St.Align.END },
                                       noTimestamp: true,
                                       timestamp: lastMessageTime });

        this._filterMessages();

        return false;
    },

    appendPresence: function(text, asTitle) {
        if (asTitle)
            this.update(text, null, { customContent: true, titleMarkup: true });
        else
            this.update(this.source.title, null, { customContent: true });

        let label = this._append({ body: text,
                                   group: 'meta',
                                   styles: ['chat-meta-message'] });

        this._filterMessages();
    },

    appendAliasChange: function(oldAlias, newAlias) {
        oldAlias = GLib.markup_escape_text(oldAlias, -1);
        newAlias = GLib.markup_escape_text(newAlias, -1);

        /* Translators: this is the other person changing their old IM name to their new
           IM name. */
        let message = '<i>' + _("%s is now known as %s").format(oldAlias, newAlias) + '</i>';

        let label = this._append({ body: message,
                                   group: 'meta',
                                   styles: ['chat-meta-message'] });

        this.update(newAlias, null, { customContent: true });

        this._filterMessages();
    },

    _onEntryActivated: function() {
        let text = this._responseEntry.get_text();
        if (text == '')
            return;

        this._inputHistory.addItem(text);

        // Telepathy sends out the Sent signal for us.
        // see Source._messageSent
        this._responseEntry.set_text('');
        this.source.respond(text);
    },

    _composingStopTimeout: function() {
        this._composingTimeoutId = 0;

        this.source.setChatState(Tp.ChannelChatState.PAUSED);

        return false;
    },

    _onEntryChanged: function() {
        let text = this._responseEntry.get_text();

        // If we're typing, we want to send COMPOSING.
        // If we empty the entry, we want to send ACTIVE.
        // If we've stopped typing for COMPOSING_STOP_TIMEOUT
        //    seconds, we want to send PAUSED.

        // Remove composing timeout.
        if (this._composingTimeoutId > 0) {
            Mainloop.source_remove(this._composingTimeoutId);
            this._composingTimeoutId = 0;
        }

        if (text != '') {
            this.source.setChatState(Tp.ChannelChatState.COMPOSING);

            this._composingTimeoutId = Mainloop.timeout_add_seconds(
                COMPOSING_STOP_TIMEOUT,
                Lang.bind(this, this._composingStopTimeout));
        } else {
            this.source.setChatState(Tp.ChannelChatState.ACTIVE);
        }
    }
};

function ApproverSource(dispatchOp, text, gicon) {
    this._init(dispatchOp, text, gicon);
}

ApproverSource.prototype = {
    __proto__: MessageTray.Source.prototype,

    _init: function(dispatchOp, text, gicon) {
        MessageTray.Source.prototype._init.call(this, text);

        this._gicon = gicon;
        this._setSummaryIcon(this.createNotificationIcon());

        this._dispatchOp = dispatchOp;

        // Destroy the source if the channel dispatch operation is invalidated
        // as we can't approve any more.
        this._invalidId = dispatchOp.connect('invalidated',
                                             Lang.bind(this, function(domain, code, msg) {
            this.destroy();
        }));
    },

    destroy: function() {
        if (this._invalidId != 0) {
            this._dispatchOp.disconnect(this._invalidId);
            this._invalidId = 0;
        }

        MessageTray.Source.prototype.destroy.call(this);
    },

    createNotificationIcon: function() {
        return new St.Icon({ gicon: this._gicon,
                             icon_type: St.IconType.FULLCOLOR,
                             icon_size: this.ICON_SIZE });
    }
}

function RoomInviteNotification(source, dispatchOp, channel, inviter) {
    this._init(source, dispatchOp, channel, inviter);
}

RoomInviteNotification.prototype = {
    __proto__: MessageTray.Notification.prototype,

    _init: function(source, dispatchOp, channel, inviter) {
        MessageTray.Notification.prototype._init.call(this,
                                                      source,
                                                      /* translators: argument is a room name like
                                                       * room@jabber.org for example. */
                                                      _("Invitation to %s").format(channel.get_identifier()),
                                                      null,
                                                      { customContent: true });
        this.setResident(true);

        /* translators: first argument is the name of a contact and the second
         * one the name of a room. "Alice is inviting you to join room@jabber.org
         * for example. */
        this.addBody(_("%s is inviting you to join %s").format(inviter.get_alias(), channel.get_identifier()));

        this.addButton('decline', _("Decline"));
        this.addButton('accept', _("Accept"));

        this.connect('action-invoked', Lang.bind(this, function(self, action) {
            switch (action) {
            case 'decline':
                dispatchOp.leave_channels_async(Tp.ChannelGroupChangeReason.NONE,
                                                '', function(src, result) {
                    src.leave_channels_finish(result)});
                break;
            case 'accept':
                dispatchOp.handle_with_time_async('', global.get_current_time(),
                                                  function(src, result) {
                    src.handle_with_time_finish(result)});
                break;
            }
            this.destroy();
        }));
    }
};

// Audio Video
function AudioVideoNotification(source, dispatchOp, channel, contact, isVideo) {
    this._init(source, dispatchOp, channel, contact, isVideo);
}

AudioVideoNotification.prototype = {
    __proto__: MessageTray.Notification.prototype,

    _init: function(source, dispatchOp, channel, contact, isVideo) {
        let title = '';

        if (isVideo)
             /* translators: argument is a contact name like Alice for example. */
            title = _("Video call from %s").format(contact.get_alias());
        else
             /* translators: argument is a contact name like Alice for example. */
            title = _("Call from %s").format(contact.get_alias());

        MessageTray.Notification.prototype._init.call(this,
                                                      source,
                                                      title,
                                                      null,
                                                      { customContent: true });
        this.setResident(true);

        this.addButton('reject', _("Reject"));
        /* translators: this is a button label (verb), not a noun */
        this.addButton('answer', _("Answer"));

        this.connect('action-invoked', Lang.bind(this, function(self, action) {
            switch (action) {
            case 'reject':
                dispatchOp.leave_channels_async(Tp.ChannelGroupChangeReason.NONE,
                                                '', function(src, result) {
                    src.leave_channels_finish(result)});
                break;
            case 'answer':
                dispatchOp.handle_with_time_async('', global.get_current_time(),
                                                  function(src, result) {
                    src.handle_with_time_finish(result)});
                break;
            }
            this.destroy();
        }));
    }
};

// File Transfer
function FileTransferNotification(source, dispatchOp, channel, contact) {
    this._init(source, dispatchOp, channel, contact);
}

FileTransferNotification.prototype = {
    __proto__: MessageTray.Notification.prototype,

    _init: function(source, dispatchOp, channel, contact) {
        MessageTray.Notification.prototype._init.call(this,
                                                      source,
                                                      /* To translators: The first parameter is
                                                       * the contact's alias and the second one is the
                                                       * file name. The string will be something
                                                       * like: "Alice is sending you test.ogg"
                                                       */
                                                      _("%s is sending you %s").format(contact.get_alias(),
                                                                                       channel.get_filename()),
                                                      null,
                                                      { customContent: true });
        this.setResident(true);

        this.addButton('decline', _("Decline"));
        this.addButton('accept', _("Accept"));

        this.connect('action-invoked', Lang.bind(this, function(self, action) {
            switch (action) {
            case 'decline':
                dispatchOp.leave_channels_async(Tp.ChannelGroupChangeReason.NONE,
                                                '', function(src, result) {
                    src.leave_channels_finish(result)});
                break;
            case 'accept':
                dispatchOp.handle_with_time_async('', global.get_current_time(),
                                                  function(src, result) {
                    src.handle_with_time_finish(result)});
                break;
            }
            this.destroy();
        }));
    }
};

// A notification source that can embed multiple notifications
function MultiNotificationSource(title, icon) {
    this._init(title, icon);
}

MultiNotificationSource.prototype = {
    __proto__: MessageTray.Source.prototype,

    _init: function(title, icon) {
        MessageTray.Source.prototype._init.call(this, title);

        this._icon = icon;
        this._setSummaryIcon(this.createNotificationIcon());
        this._nbNotifications = 0;
    },

    notify: function(notification) {
        MessageTray.Source.prototype.notify.call(this, notification);

        this._nbNotifications += 1;

        // Display the source while there is at least one notification
        notification.connect('destroy', Lang.bind(this, function () {
            this._nbNotifications -= 1;

            if (this._nbNotifications == 0)
                this.destroy();
        }));
    },

    createNotificationIcon: function() {
        return new St.Icon({ gicon: Shell.util_icon_from_string(this._icon),
                             icon_type: St.IconType.FULLCOLOR,
                             icon_size: this.ICON_SIZE });
    }
};

// Subscription request
function SubscriptionRequestNotification(source, contact) {
    this._init(source, contact);
}

SubscriptionRequestNotification.prototype = {
    __proto__: MessageTray.Notification.prototype,

    _init: function(source, contact) {
        MessageTray.Notification.prototype._init.call(this, source,
            /* To translators: The parameter is the contact's alias */
            _("%s would like permission to see when you are online").format(contact.get_alias()),
            null, { customContent: true });

        this._contact = contact;
        this._connection = contact.get_connection();

        let layout = new St.BoxLayout({ vertical: false });

        // Display avatar
        let iconBox = new St.Bin({ style_class: 'avatar-box' });
        iconBox._size = 48;

        let textureCache = St.TextureCache.get_default();
        let file = contact.get_avatar_file();

        if (file) {
            let uri = file.get_uri();
            iconBox.child = textureCache.load_uri_async(uri, iconBox._size, iconBox._size);
        }
        else {
            iconBox.child = new St.Icon({ icon_name: 'avatar-default',
                                          icon_type: St.IconType.FULLCOLOR,
                                          icon_size: iconBox._size });
        }

        layout.add(iconBox);

        // subscription request message
        let label = new St.Label({ style_class: 'subscription-message',
                                   text: contact.get_publish_request() });

        layout.add(label);

        this.addActor(layout);

        this.addButton('decline', _("Decline"));
        this.addButton('accept', _("Accept"));

        this.connect('action-invoked', Lang.bind(this, function(self, action) {
            switch (action) {
            case 'decline':
                contact.remove_async(function(src, result) {
                    src.remove_finish(result)});
                break;
            case 'accept':
                // Authorize the contact and request to see his status as well
                contact.authorize_publication_async(function(src, result) {
                    src.authorize_publication_finish(result)});

                contact.request_subscription_async('', function(src, result) {
                    src.request_subscription_finish(result)});
                break;
            }

            // rely on _subscriptionStatesChangedCb to destroy the
            // notification
        }));

        this._changedId = contact.connect('subscription-states-changed',
            Lang.bind(this, this._subscriptionStatesChangedCb));
        this._invalidatedId = this._connection.connect('invalidated',
            Lang.bind(this, this.destroy));
    },

    destroy: function() {
        if (this._changedId != 0) {
            this._contact.disconnect(this._changedId);
            this._changedId = 0;
        }

        if (this._invalidatedId != 0) {
            this._connection.disconnect(this._invalidatedId);
            this._invalidatedId = 0;
        }

        MessageTray.Notification.prototype.destroy.call(this);
    },

    _subscriptionStatesChangedCb: function(contact, subscribe, publish, msg) {
        // Destroy the notification if the subscription request has been
        // answered
        if (publish != Tp.SubscriptionState.ASK)
            this.destroy();
    }
};


function AccountNotification(source, account, connectionError) {
    this._init(source, account, connectionError);
}

// Messages from empathy/libempathy/empathy-utils.c
// create_errors_to_message_hash()

/* Translator note: these should be the same messages that are
 * used in Empathy, so just copy and paste from there. */
let _connectionErrorMessages = {};
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.NETWORK_ERROR)]
  = _("Network error");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.AUTHENTICATION_FAILED)]
  = _("Authentication failed");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.ENCRYPTION_ERROR)]
  = _("Encryption error");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CERT_NOT_PROVIDED)]
  = _("Certificate not provided");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CERT_UNTRUSTED)]
  = _("Certificate untrusted");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CERT_EXPIRED)]
  = _("Certificate expired");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CERT_NOT_ACTIVATED)]
  = _("Certificate not activated");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CERT_HOSTNAME_MISMATCH)]
  = _("Certificate hostname mismatch");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CERT_FINGERPRINT_MISMATCH)]
  = _("Certificate fingerprint mismatch");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CERT_SELF_SIGNED)]
  = _("Certificate self-signed");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CANCELLED)]
  = _("Status is set to offline");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.ENCRYPTION_NOT_AVAILABLE)]
  = _("Encryption is not available");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CERT_INVALID)]
  = _("Certificate is invalid");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CONNECTION_REFUSED)]
  = _("Connection has been refused");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CONNECTION_FAILED)]
  = _("Connection can't be established");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CONNECTION_LOST)]
  = _("Connection has been lost");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.ALREADY_CONNECTED)]
  = _("This resource is already connected to the server");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CONNECTION_REPLACED)]
  = _("Connection has been replaced by a new connection using the same resource");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.REGISTRATION_EXISTS)]
  = _("The account already exists on the server");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.SERVICE_BUSY)]
  = _("Server is currently too busy to handle the connection");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CERT_REVOKED)]
  = _("Certificate has been revoked");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CERT_INSECURE)]
  = _("Certificate uses an insecure cipher algorithm or is cryptographically weak");
_connectionErrorMessages[Tp.error_get_dbus_name(Tp.Error.CERT_LIMIT_EXCEEDED)]
  = _("The length of the server certificate, or the depth of the server certificate chain, exceed the limits imposed by the cryptography library");

AccountNotification.prototype = {
    __proto__: MessageTray.Notification.prototype,

    _init: function(source, account, connectionError) {
        MessageTray.Notification.prototype._init.call(this, source,
            /* translators: argument is the account name, like
             * name@jabber.org for example. */
            _("Connection to %s failed").format(account.get_display_name()),
            null, { customContent: true });

        this._label = new St.Label();
        this.addActor(this._label);
        this._updateMessage(connectionError);

        this._account = account;

        this.addButton('reconnect', _("Reconnect"));
        this.addButton('edit', _("Edit account"));

        this.connect('action-invoked', Lang.bind(this, function(self, action) {
            switch (action) {
            case 'reconnect':
                // If it fails again, a new notification should pop up with the
                // new error.
                account.reconnect_async(null, null);
                break;
            case 'edit':
                let cmd = '/usr/bin/empathy-accounts'
                        + ' --select-account=%s'
                        .format(account.get_path_suffix());
                let app_info = Gio.app_info_create_from_commandline(cmd, null, 0,
                    null);
                app_info.launch([], null, null);
                break;
            }
            this.destroy();
        }));

        this._enabledId = account.connect('notify::enabled',
                                          Lang.bind(this, function() {
                                              if (!account.is_enabled())
                                                  this.destroy();
                                          }));

        this._invalidatedId = account.connect('invalidated',
                                              Lang.bind(this, this.destroy));

        this._connectionStatusId = account.connect('notify::connection-status',
            Lang.bind(this, function() {
                let status = account.connection_status;
                if (status == Tp.ConnectionStatus.CONNECTED) {
                    this.destroy();
                } else if (status == Tp.ConnectionStatus.DISCONNECTED) {
                    this._updateMessage(account.connection_error);
                }
            }));
    },

    _updateMessage: function(connectionError) {
        let message;
        if (connectionError in _connectionErrorMessages) {
            message = _connectionErrorMessages[connectionError];
        } else {
            message = _("Unknown reason");
        }
        this._label.set_text(message);
    },

    destroy: function() {
        if (this._enabledId != 0) {
            this._account.disconnect(this._enabledId);
            this._enabledId = 0;
        }

        if (this._invalidatedId != 0) {
            this._account.disconnect(this._invalidatedId);
            this._invalidatedId = 0;
        }

        if (this._connectionStatusId != 0) {
            this._account.disconnect(this._connectionStatusId);
            this._connectionStatusId = 0;
        }

        MessageTray.Notification.prototype.destroy.call(this);
    }
};
