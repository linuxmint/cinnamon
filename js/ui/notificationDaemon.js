// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const DBus = imports.dbus;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;

const Config = imports.misc.config;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Params = imports.misc.params;

let nextNotificationId = 1;

// Should really be defined in dbus.js
const BusIface = {
    name: 'org.freedesktop.DBus',
    methods: [{ name: 'GetConnectionUnixProcessID',
                inSignature: 's',
                outSignature: 'i' }]
};

const Bus = function () {
    this._init();
};

Bus.prototype = {
     _init: function() {
         DBus.session.proxifyObject(this, 'org.freedesktop.DBus', '/org/freedesktop/DBus');
     }
};

DBus.proxifyPrototype(Bus.prototype, BusIface);

const NotificationDaemonIface = {
    name: 'org.freedesktop.Notifications',
    methods: [{ name: 'Notify',
                inSignature: 'susssasa{sv}i',
                outSignature: 'u'
              },
              { name: 'CloseNotification',
                inSignature: 'u',
                outSignature: ''
              },
              { name: 'GetCapabilities',
                inSignature: '',
                outSignature: 'as'
              },
              { name: 'GetServerInformation',
                inSignature: '',
                outSignature: 'ssss'
              }],
    signals: [{ name: 'NotificationClosed',
                inSignature: 'uu' },
              { name: 'ActionInvoked',
                inSignature: 'us' }]
};

const NotificationClosedReason = {
    EXPIRED: 1,
    DISMISSED: 2,
    APP_CLOSED: 3,
    UNDEFINED: 4
};

const Urgency = {
    LOW: 0,
    NORMAL: 1,
    CRITICAL: 2
};

const rewriteRules = {
    'XChat': [
        { pattern:     /^XChat: Private message from: (\S*) \(.*\)$/,
          replacement: '<$1>' },
        { pattern:     /^XChat: New public message from: (\S*) \((.*)\)$/,
          replacement: '$2 <$1>' },
        { pattern:     /^XChat: Highlighted message from: (\S*) \((.*)\)$/,
          replacement: '$2 <$1>' }
    ]
};

function NotificationDaemon() {
    this._init();
}

NotificationDaemon.prototype = {
    _init: function() {
        DBus.session.exportObject('/org/freedesktop/Notifications', this);

        this._sources = [];
        this._senderToPid = {};
        this._notifications = {};
        this._busProxy = new Bus();

        Main.statusIconDispatcher.connect('message-icon-added', Lang.bind(this, this._onTrayIconAdded));
        Main.statusIconDispatcher.connect('message-icon-removed', Lang.bind(this, this._onTrayIconRemoved));

        Cinnamon.WindowTracker.get_default().connect('notify::focus-app',
            Lang.bind(this, this._onFocusAppChanged));
        Main.overview.connect('hidden',
            Lang.bind(this, this._onFocusAppChanged));
    },

    _iconForNotificationData: function(icon, hints, size) {
        let textureCache = St.TextureCache.get_default();

        // If an icon is not specified, we use 'image-data' or 'image-path' hint for an icon
        // and don't show a large image. There are currently many applications that use
        // notify_notification_set_icon_from_pixbuf() from libnotify, which in turn sets
        // the 'image-data' hint. These applications don't typically pass in 'app_icon'
        // argument to Notify() and actually expect the pixbuf to be shown as an icon.
        // So the logic here does the right thing for this case. If both an icon and either
        // one of 'image-data' or 'image-path' are specified, we show both an icon and
        // a large image.
        if (icon) {
            if (icon.substr(0, 7) == 'file://')
                return textureCache.load_uri_async(icon, size, size);
            else if (icon[0] == '/') {
                let uri = GLib.filename_to_uri(icon, null);
                return textureCache.load_uri_async(uri, size, size);
            } else
                return new St.Icon({ icon_name: icon,
                                     icon_type: St.IconType.FULLCOLOR,
                                     icon_size: size });
        } else if (hints['image-data']) {
            let [width, height, rowStride, hasAlpha,
                 bitsPerSample, nChannels, data] = hints['image-data'];
            return textureCache.load_from_raw(data, hasAlpha, width, height, rowStride, size);
        } else if (hints['image-path']) {
            return textureCache.load_uri_async(GLib.filename_to_uri(hints['image-path'], null), size, size);
        } else {
            let stockIcon;
            switch (hints.urgency) {
                case Urgency.LOW:
                case Urgency.NORMAL:
                    stockIcon = 'gtk-dialog-info';
                    break;
                case Urgency.CRITICAL:
                    stockIcon = 'gtk-dialog-error';
                    break;
            }
            return new St.Icon({ icon_name: stockIcon,
                                 icon_type: St.IconType.FULLCOLOR,
                                 icon_size: size });
        }
    },

    _lookupSource: function(title, pid, trayIcon) {
        for (let i = 0; i < this._sources.length; i++) {
            let source = this._sources[i];
            if (source.pid == pid &&
                (source.initialTitle == title || source.trayIcon == trayIcon))
                return source;
        }
        return null;
    },

    // Returns the source associated with ndata.notification if it is set.
    // Otherwise, returns the source associated with the title and pid if
    // such source is stored in this._sources and the notification is not
    // transient. If the existing or requested source is associated with
    // a tray icon and passed in pid matches a pid of an existing source,
    // the title match is ignored to enable representing a tray icon and
    // notifications from the same application with a single source.
    //
    // If no existing source is found, a new source is created as long as
    // pid is provided.
    //
    // Either a pid or ndata.notification is needed to retrieve or
    // create a source.
    _getSource: function(title, pid, ndata, sender, trayIcon) {
        if (!pid && !(ndata && ndata.notification))
            return null;

        // We use notification's source for the notifications we still have
        // around that are getting replaced because we don't keep sources
        // for transient notifications in this._sources, but we still want
        // the notification associated with them to get replaced correctly.
        if (ndata && ndata.notification)
            return ndata.notification.source;

        let isForTransientNotification = (ndata && ndata.hints['transient'] == true);

        // We don't want to override a persistent notification
        // with a transient one from the same sender, so we
        // always create a new source object for new transient notifications
        // and never add it to this._sources .
        if (!isForTransientNotification) {
            let source = this._lookupSource(title, pid, trayIcon);
            if (source) {
                source.setTitle(title);
                return source;
            }
        }

        let source = new Source(title, pid, sender, trayIcon);
        source.setTransient(isForTransientNotification);

        if (!isForTransientNotification) {
            this._sources.push(source);
            source.connect('destroy', Lang.bind(this,
                function() {
                    let index = this._sources.indexOf(source);
                    if (index >= 0)
                        this._sources.splice(index, 1);
                }));
        }

        if (Main.messageTray) Main.messageTray.add(source);
        return source;
    },

    Notify: function(appName, replacesId, icon, summary, body,
                     actions, hints, timeout) {
        let id;
        
        let rewrites = rewriteRules[appName];
        if (rewrites) {
            for (let i = 0; i < rewrites.length; i++) {
                let rule = rewrites[i];
                if (summary.search(rule.pattern) != -1)
                    summary = summary.replace(rule.pattern, rule.replacement);
            }
        }

        hints = Params.parse(hints, { urgency: Urgency.NORMAL }, true);

        // Be compatible with the various hints for image data and image path
        // 'image-data' and 'image-path' are the latest name of these hints, introduced in 1.2

        if (!hints['image-path'] && hints['image_path'])
            hints['image-path'] = hints['image_path']; // version 1.1 of the spec

        if (!hints['image-data'])
            if (hints['image_data'])
                hints['image-data'] = hints['image_data']; // version 1.1 of the spec
            else if (hints['icon_data'] && !hints['image-path'])
                // early versions of the spec; 'icon_data' should only be used if 'image-path' is not available
                hints['image-data'] = hints['icon_data'];

        let ndata = { appName: appName,
                      icon: icon,
                      summary: summary,
                      body: body,
                      actions: actions,
                      hints: hints,
                      timeout: timeout };
        if (replacesId != 0 && this._notifications[replacesId]) {
            ndata.id = id = replacesId;
            ndata.notification = this._notifications[replacesId].notification;
        } else {
            replacesId = 0;
            ndata.id = id = nextNotificationId++;
        }
        this._notifications[id] = ndata;

        let sender = DBus.getCurrentMessageContext().sender;
        let pid = this._senderToPid[sender];

        let source = this._getSource(appName, pid, ndata, sender, null);

        if (source) {
            this._notifyForSource(source, ndata);
            return id;
        }

        if (replacesId) {
            // There's already a pending call to GetConnectionUnixProcessID,
            // which will see the new notification data when it finishes,
            // so we don't have to do anything.
            return id;
        }

        this._busProxy.GetConnectionUnixProcessIDRemote(sender, Lang.bind(this,
            function (pid, ex) {
                // The app may have updated or removed the notification
                ndata = this._notifications[id];
                if (!ndata)
                    return;

                source = this._getSource(appName, pid, ndata, sender, null);

                // We only store sender-pid entries for persistent sources.
                // Removing the entries once the source is destroyed
                // would result in the entries associated with transient
                // sources removed once the notification is shown anyway.
                // However, keeping these pairs would mean that we would
                // possibly remove an entry associated with a persistent
                // source when a transient source for the same sender is
                // distroyed.
                if (!source.isTransient) {
                    this._senderToPid[sender] = pid;
                    source.connect('destroy', Lang.bind(this,
                        function() {
                            delete this._senderToPid[sender];
                        }));
                }
                this._notifyForSource(source, ndata);
            }));

        return id;
    },

    _notifyForSource: function(source, ndata) {
        let [id, icon, summary, body, actions, hints, notification] =
            [ndata.id, ndata.icon, ndata.summary, ndata.body,
             ndata.actions, ndata.hints, ndata.notification];

        let iconActor = this._iconForNotificationData(icon, hints, source.ICON_SIZE);

        if (notification == null) {
            notification = new MessageTray.Notification(source, summary, body,
                                                        { icon: iconActor,
                                                          bannerMarkup: true });
            ndata.notification = notification;
            notification.connect('destroy', Lang.bind(this,
                function(n, reason) {
                    delete this._notifications[ndata.id];
                    let notificationClosedReason;
                    switch (reason) {
                        case MessageTray.NotificationDestroyedReason.EXPIRED:
                            notificationClosedReason = NotificationClosedReason.EXPIRED;
                            break;
                        case MessageTray.NotificationDestroyedReason.DISMISSED:
                            notificationClosedReason = NotificationClosedReason.DISMISSED;
                            break;
                        case MessageTray.NotificationDestroyedReason.SOURCE_CLOSED:
                            notificationClosedReason = NotificationClosedReason.APP_CLOSED;
                            break;
                    }
                    this._emitNotificationClosed(ndata.id, notificationClosedReason);
                }));
            notification.connect('action-invoked', Lang.bind(this,
                function(n, actionId) {
                    this._emitActionInvoked(ndata.id, actionId);
                }));
        } else {
            notification.update(summary, body, { icon: iconActor,
                                                 bannerMarkup: true,
                                                 clear: true });
        }

        // We only display a large image if an icon is also specified.
        if (icon && (hints['image-data'] || hints['image-path'])) {
            let image = null;
            if (hints['image-data']) {
                let [width, height, rowStride, hasAlpha,
                 bitsPerSample, nChannels, data] = hints['image-data'];
                image = St.TextureCache.get_default().load_from_raw(data, hasAlpha,
                                                                    width, height, rowStride, notification.IMAGE_SIZE);
            } else if (hints['image-path']) {
                image = St.TextureCache.get_default().load_uri_async(GLib.filename_to_uri(hints['image-path'], null),
                                                                     notification.IMAGE_SIZE,
                                                                     notification.IMAGE_SIZE);
            }
            notification.setImage(image);
        } else {
            notification.unsetImage();
        }

        if (actions.length) {
            notification.setUseActionIcons(hints['action-icons'] == true);
            for (let i = 0; i < actions.length - 1; i += 2) {
                if (actions[i] == 'default')
                    notification.connect('clicked', Lang.bind(this,
                        function() {
                            this._emitActionInvoked(ndata.id, "default");
                        }));
                else
                    notification.addButton(actions[i], actions[i + 1]);
            }
        }
        switch (hints.urgency) {
            case Urgency.LOW:
                notification.setUrgency(MessageTray.Urgency.LOW);
                break;
            case Urgency.NORMAL:
                notification.setUrgency(MessageTray.Urgency.NORMAL);
                break;
            case Urgency.CRITICAL:
                notification.setUrgency(MessageTray.Urgency.CRITICAL);
                break;
        }
        notification.setResident(hints.resident == true);
        // 'transient' is a reserved keyword in JS, so we have to retrieve the value
        // of the 'transient' hint with hints['transient'] rather than hints.transient
        notification.setTransient(hints['transient'] == true);

        let sourceIconActor = source.useNotificationIcon ? this._iconForNotificationData(icon, hints, source.ICON_SIZE) : null;
        source.processNotification(notification, sourceIconActor);
    },

    CloseNotification: function(id) {
        let ndata = this._notifications[id];
        if (ndata) {
            if (ndata.notification)
                ndata.notification.destroy(MessageTray.NotificationDestroyedReason.SOURCE_CLOSED);
            delete this._notifications[id];
        }
    },

    GetCapabilities: function() {
        return [
            'actions',
            'action-icons',
            'body',
            // 'body-hyperlinks',
            // 'body-images',
            'body-markup',
            // 'icon-multi',
            'icon-static',
            'persistence',
            // 'sound',
        ];
    },

    GetServerInformation: function() {
        return [
            Config.PACKAGE_NAME,
            'GNOME',
            Config.PACKAGE_VERSION,
            '1.2'
        ];
    },

    _onFocusAppChanged: function() {
        let tracker = Cinnamon.WindowTracker.get_default();
        if (!tracker.focus_app)
            return;

        for (let i = 0; i < this._sources.length; i++) {
            let source = this._sources[i];
            if (source.app == tracker.focus_app) {
                source.destroyNonResidentNotifications();
                return;
            }
        }
    },

    _emitNotificationClosed: function(id, reason) {
        DBus.session.emit_signal('/org/freedesktop/Notifications',
                                 'org.freedesktop.Notifications',
                                 'NotificationClosed', 'uu',
                                 [id, reason]);
    },

    _emitActionInvoked: function(id, action) {
        DBus.session.emit_signal('/org/freedesktop/Notifications',
                                 'org.freedesktop.Notifications',
                                 'ActionInvoked', 'us',
                                 [id, action]);
    },

    _onTrayIconAdded: function(o, icon) {
        let source = this._getSource(icon.title || icon.wm_class || _("Unknown"), icon.pid, null, null, icon);
    },

    _onTrayIconRemoved: function(o, icon) {
        let source = this._lookupSource(null, icon.pid, true);
        if (source)
            source.destroy();
    }
};

DBus.conformExport(NotificationDaemon.prototype, NotificationDaemonIface);

function Source(title, pid, sender, trayIcon) {
    this._init(title, pid, sender, trayIcon);
}

Source.prototype = {
    __proto__:  MessageTray.Source.prototype,

    _init: function(title, pid, sender, trayIcon) {
        MessageTray.Source.prototype._init.call(this, title);

        this.initialTitle = title;

        this.pid = pid;
        if (sender)
            // TODO: dbus-glib implementation of watch_name() doesn’t return an id to be used for
            // unwatch_name() or implement unwatch_name(), however when we move to using GDBus implementation,
            // we should save the id here and call unwatch_name() with it in destroy().
            // Moving to GDBus is the work in progress: https://bugzilla.gnome.org/show_bug.cgi?id=648651
            // and https://bugzilla.gnome.org/show_bug.cgi?id=622921 .
            DBus.session.watch_name(sender,
                                    false,
                                    null,
                                    Lang.bind(this, this._onNameVanished));

        this._setApp();
        if (this.app)
            this.title = this.app.get_name();
        else
            this.useNotificationIcon = true;

        this.trayIcon = trayIcon;
        if (this.trayIcon) {
           this._setSummaryIcon(this.trayIcon);
           this.useNotificationIcon = false;
        }
    },

    _onNameVanished: function() {
        // Destroy the notification source when its sender is removed from DBus.
        // Only do so if this.app is set to avoid removing "notify-send" sources, senders
        // of which аre removed from DBus immediately.
        // Sender being removed from DBus would normally result in a tray icon being removed,
        // so allow the code path that handles the tray icon being removed to handle that case.
        if (!this.trayIcon && this.app)
            this.destroy();
    },

    processNotification: function(notification, icon) {
        if (!this.app)
            this._setApp();
        if (!this.app && icon)
            this._setSummaryIcon(icon);

        let tracker = Cinnamon.WindowTracker.get_default();
        if (notification.resident && this.app && tracker.focus_app == this.app)
            this.pushNotification(notification);
        else
            this.notify(notification);
    },

    handleSummaryClick: function() {
        if (!this.trayIcon)
            return false;

        let event = Clutter.get_current_event();
        if (event.type() != Clutter.EventType.BUTTON_RELEASE)
            return false;

        // Left clicks are passed through only where there aren't unacknowledged
        // notifications, so it possible to open them in summary mode; right
        // clicks are always forwarded, as the right click menu is not useful for
        // tray icons
        if (event.get_button() == 1 &&
            this.notifications.length > 0)
            return false;

        if (Main.overview.visible) {
            // We can't just connect to Main.overview's 'hidden' signal,
            // because it's emitted *before* it calls popModal()...
            let id = global.connect('notify::stage-input-mode', Lang.bind(this,
                function () {
                    global.disconnect(id);
                    this.trayIcon.click(event);
                }));
            Main.overview.hide();
        } else {
            this.trayIcon.click(event);
        }
        return true;
    },

    _setApp: function() {
        if (this.app)
            return;

        this.app = Cinnamon.WindowTracker.get_default().get_app_from_pid(this.pid);
        if (!this.app)
            return;

        // Only override the icon if we were previously using
        // notification-based icons (ie, not a trayicon) or if it was unset before
        if (!this.trayIcon) {
            this.useNotificationIcon = false;
            
            let icon = null;                
            if (this.app.get_app_info() != null && this.app.get_app_info().get_icon() != null) {
                icon = new St.Icon({gicon: this.app.get_app_info().get_icon(), icon_size: this.ICON_SIZE, icon_type: St.IconType.FULLCOLOR});
            }
            if (icon == null) {
                icon = new St.Icon({icon_name: "application-x-executable", icon_size: this.ICON_SIZE, icon_type: St.IconType.FULLCOLOR});        
            }            

            this._setSummaryIcon(icon);
        }
    },

    open: function(notification) {
        this.destroyNonResidentNotifications();
        this.openApp();
    },

    _lastNotificationRemoved: function() {
        if (!this.trayIcon)
            this.destroy();
    },

    openApp: function() {
        if (this.app == null)
            return;

        let windows = this.app.get_windows();
        if (windows.length > 0) {
            let mostRecentWindow = windows[0];
            Main.activateWindow(mostRecentWindow);
        }
    },

    destroy: function() {
        MessageTray.Source.prototype.destroy.call(this);
    }
};
