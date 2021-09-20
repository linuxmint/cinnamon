// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;

const Config = imports.misc.config;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Params = imports.misc.params;
const Mainloop = imports.mainloop;

// don't automatically clear these apps' notifications on window focus
// lowercase only
const AUTOCLEAR_BLACKLIST = ['chromium', 'firefox', 'google chrome'];

let nextNotificationId = 1;

// Should really be defined in Gio.js
const BusIface =
    '<node> \
        <interface name="org.freedesktop.DBus"> \
            <method name="GetConnectionUnixProcessID"> \
                <arg type="s" direction="in" /> \
                <arg type="u" direction="out" /> \
            </method> \
        </interface> \
    </node>';

var BusProxy = Gio.DBusProxy.makeProxyWrapper(BusIface);
function Bus() {
    return new BusProxy(Gio.DBus.session, 'org.freedesktop.DBus', '/org/freedesktop/DBus');
}

const NotificationDaemonIface =
    '<node> \
        <interface name="org.freedesktop.Notifications"> \
            <method name="Notify"> \
                <arg type="s" direction="in"/> \
                <arg type="u" direction="in"/> \
                <arg type="s" direction="in"/> \
                <arg type="s" direction="in"/> \
                <arg type="s" direction="in"/> \
                <arg type="as" direction="in"/> \
                <arg type="a{sv}" direction="in"/> \
                <arg type="i" direction="in"/> \
                <arg type="u" direction="out"/> \
            </method> \
            <method name="CloseNotification"> \
                <arg type="u" direction="in"/> \
            </method> \
            <method name="GetCapabilities"> \
                <arg type="as" direction="out"/> \
            </method> \
            <method name="GetServerInformation"> \
                <arg type="s" direction="out"/> \
                <arg type="s" direction="out"/> \
                <arg type="s" direction="out"/> \
                <arg type="s" direction="out"/> \
            </method> \
            <signal name="NotificationClosed"> \
                <arg type="u"/> \
                <arg type="u"/> \
            </signal> \
            <signal name="ActionInvoked"> \
                <arg type="u"/> \
                <arg type="s"/> \
            </signal> \
        </interface> \
    </node>';

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
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(NotificationDaemonIface, this);
        this._dbusImpl.export(Gio.DBus.session, '/org/freedesktop/Notifications');

        this._sources = [];
        this._senderToPid = {};
        this._notifications = {};
        this._expireNotifications = []; // List of expiring notifications in order from first to last to expire.
        this._busProxy = new Bus();

        this._expireTimer = 0;

        Main.statusIconDispatcher.connect('message-icon-added', Lang.bind(this, this._onTrayIconAdded));
        Main.statusIconDispatcher.connect('message-icon-removed', Lang.bind(this, this._onTrayIconRemoved));

// Settings
        this.settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.notifications" });
        function setting(self, source, type, camelCase, dashed) {
            function updater() { self[camelCase] = source["get_"+type](dashed); }
            source.connect('changed::'+dashed, updater);
            updater();
        }
        setting(this, this.settings, "boolean", "removeOld", "remove-old");
        setting(this, this.settings, "int", "timeout", "timeout");

        Cinnamon.WindowTracker.get_default().connect('notify::focus-app',
            Lang.bind(this, this._onFocusAppChanged));
        Main.overview.connect('hidden',
            Lang.bind(this, this._onFocusAppChanged));
    },

   // Create an icon for a notification from icon string/path.
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
            } else {
                let icon_type = St.IconType.FULLCOLOR;
                if (icon.search("-symbolic") != -1)
                    icon_type = St.IconType.SYMBOLIC;
                return new St.Icon({ icon_name: icon,
                                     icon_type: icon_type,
                                     icon_size: size });
            }
        } else if (hints['image-data']) {
            let [width, height, rowStride, hasAlpha,
                 bitsPerSample, nChannels, data] = hints['image-data'];
            return textureCache.load_from_raw(data, hasAlpha, width, height, rowStride, size);
        } else if (hints['image-path']) {
            let path = hints['image-path'];
            if (GLib.path_is_absolute (path)) {
                return textureCache.load_uri_async(GLib.filename_to_uri(path, null), size, size);
            } else {
                let icon_type = St.IconType.FULLCOLOR;
                if (path.search("-symbolic") != -1) {
                    icon_type = St.IconType.SYMBOLIC;
                }

                return new St.Icon({ icon_name: path,
                                     icon_type: icon_type,
                                     icon_size: size });
            }
        } else {
            let stockIcon;
            switch (hints.urgency) {
                case Urgency.LOW:
                case Urgency.NORMAL:
                    stockIcon = 'dialog-information';
                    break;
                case Urgency.CRITICAL:
                    stockIcon = 'dialog-error';
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

        let isForTransientNotification = (ndata && ndata.hints.maybeGet('transient') == true);

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

    _startExpire: function() {
         if (this.removeOld && this._expireNotifications.length && !this._expireTimer) {
            this._expireTimer = Mainloop.timeout_add_seconds(Math.max((this._expireNotifications[0].expires-Date.now())/1000, 1), Lang.bind(this, this._expireNotification));
        }
    },
    _stopExpire: function() {
         if (this._expireTimer == 0) {
            return;
        }
         Mainloop.source_remove(this._expireTimer);
         this._expireTimer = 0;
    },
    _restartExpire: function() {
         this._stopExpire();
         this._startExpire();
    },
    _expireNotification: function() {
        let ndata = this._expireNotifications[0];

        if (ndata) {
            ndata.notification.destroy(MessageTray.NotificationDestroyedReason.EXPIRED);
        }

        this._expireTimer = 0;
        return false;
    },

    // Sends a notification to the notification daemon. Returns the id allocated to the notification.
    NotifyAsync: function(params, invocation) {
        let [appName, replacesId, icon, summary, body, actions, hints, timeout] = params;
        let id;

        for (let hint in hints) {
            // unpack the variants
            hints[hint] = hints[hint].deep_unpack();
        }

        // Special Cinnamon specific rewrites for message summaries on the fly.
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

        if (!hints['image-data']) // not version 1.2 of the spec?
            if (hints['image_data'])
                hints['image-data'] = hints['image_data']; // version 1.1 of the spec
            else if (hints['icon_data'] && !hints['image-path'])
                // early versions of the spec; 'icon_data' should only be used if 'image-path' is not available
                hints['image-data'] = hints['icon_data'];

        hints['suppress-sound'] = hints.maybeGet('suppress-sound') == true;

        let ndata = { appName: appName,
                      icon: icon,
                      summary: summary,
                      body: body,
                      actions: actions,
                      hints: hints,
                      timeout: timeout };
        // Does this notification replace another?
        if (replacesId != 0 && this._notifications[replacesId]) {
            ndata.id = id = replacesId;
            ndata.notification = this._notifications[replacesId].notification;
        } else {
            replacesId = 0;
            ndata.id = id = nextNotificationId++;
        }
        this._notifications[id] = ndata;

        // Find expiration timestamp.
        let expires;
        if (!timeout || hints.resident || hints.urgency == 2) { // Never expires.
            expires = ndata.expires = 0;
        } else if (timeout == -1) { // Default expiration.
            expires = ndata.expires = Date.now()+this.timeout*1000;
        } else {    // Custom expiration.
             expires = ndata.expires = Date.now()+timeout;
        }

        // Does this notification expire?
        if (expires != 0) {
            // Find place in the notification queue.
            let notifications = this._expireNotifications, i;
            for (i = notifications.length; i > 0; --i) {    // Backwards search, likely to be faster.
                if (expires > notifications[i-1].expires) {
                    notifications.splice(i, 0, ndata);
                    break;
                }
            }
            if (i == 0) notifications.unshift(ndata);
            this._restartExpire()
        }

        let sender = invocation.get_sender();
        let pid = this._senderToPid[sender];

        let source = this._getSource(appName, pid, ndata, sender, null);

        if (source) {
            this._notifyForSource(source, ndata);
            return invocation.return_value(GLib.Variant.new('(u)', [id]));
        }

        if (replacesId) {
            // There's already a pending call to GetConnectionUnixProcessID,
            // which will see the new notification data when it finishes,
            // so we don't have to do anything.
            return invocation.return_value(GLib.Variant.new('(u)', [id]));
        }

        this._busProxy.GetConnectionUnixProcessIDRemote(sender, Lang.bind(this, function (result, excp) {
            // The app may have updated or removed the notification
            ndata = this._notifications[id];
            if (!ndata)
                return;

            if (excp) {
                logError(excp, 'Call to GetConnectionUnixProcessID failed');
                return;
            }

            let [pid] = result;
            source = this._getSource(appName, pid, ndata, sender);

            // We only store sender-pid entries for persistent sources.
            // Removing the entries once the source is destroyed
            // would result in the entries associated with transient
            // sources removed once the notification is shown anyway.
            // However, keeping these pairs would mean that we would
            // possibly remove an entry associated with a persistent
            // source when a transient source for the same sender is
            // destroyed.
            if (!source.isTransient) {
                this._senderToPid[sender] = pid;
                source.connect('destroy', Lang.bind(this, function() {
                    delete this._senderToPid[sender];
                }));
            }
            this._notifyForSource(source, ndata);
        }));

        return invocation.return_value(GLib.Variant.new('(u)', [id]));
    },

    _notifyForSource: function(source, ndata) {
        let [id, icon, summary, body, actions, hints, notification, timeout, expires] =
            [ndata.id, ndata.icon, ndata.summary, ndata.body,
             ndata.actions, ndata.hints, ndata.notification, ndata.timeout, ndata.expires];

        let iconActor = this._iconForNotificationData(icon, hints, source.ICON_SIZE);

        if (notification == null) {    // Create a new notification!
            notification = new MessageTray.Notification(source, summary, body,
                                                        { icon: iconActor,
                                                          bodyMarkup: true,
                                                          silent: hints['suppress-sound'] });
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
                    // Remove from expiring?
                    if (ndata.expires) {
                        let notifications = this._expireNotifications;
                        for (var i = 0, j = notifications.length; i < j; ++i) {
                            if (notifications[i] == ndata) {
                                notifications.splice(i, 1);
                                break;
                             }
                        }
                        this._restartExpire();
                    }
                    this._emitNotificationClosed(ndata.id, notificationClosedReason);
                }));
            notification.connect('action-invoked', Lang.bind(this,
                function(n, actionId) {
                    this._emitActionInvoked(ndata.id, actionId);
                }));
        } else {
            notification.update(summary, body, { icon: iconActor,
                                                 bodyMarkup: true,
                                                 silent: hints['suppress-sound'] });
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

        notification.clearButtons();

        if (actions.length) {
            notification.setUseActionIcons(hints.maybeGet('action-icons') == true);
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
        notification.setResident(hints.maybeGet('resident') == true);
        // 'transient' is a reserved keyword in JS, so we have to retrieve the value
        // of the 'transient' hint with hints['transient'] rather than hints.transient
        notification.setTransient(hints.maybeGet('transient') == true);

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
            'sound',
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
        if (!this._sources.length)
            return;

        let tracker = Cinnamon.WindowTracker.get_default();
        if (!tracker.focus_app)
            return;

        let name = tracker.focus_app.get_name();
        if (name && AUTOCLEAR_BLACKLIST.includes(name.toLowerCase()))
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
        this._dbusImpl.emit_signal('NotificationClosed',
                                   GLib.Variant.new('(uu)', [id, reason]));
    },

    _emitActionInvoked: function(id, action) {
        this._dbusImpl.emit_signal('ActionInvoked',
                                   GLib.Variant.new('(us)', [id, action]));
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
            this._nameWatcherId = Gio.DBus.session.watch_name(sender,
                                                              Gio.BusNameWatcherFlags.NONE,
                                                              null,
                                                              Lang.bind(this, this._onNameVanished));
        else
            this._nameWatcherId = 0;

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
        // of which are removed from DBus immediately.
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

        this.notify(notification);
    },

    _getApp: function() {
        let app;

        app = Cinnamon.WindowTracker.get_default().get_app_from_pid(this.pid);
        if (app != null)
            return app;

        if (this.trayIcon) {
            app = Cinnamon.AppSystem.get_default().lookup_wmclass(this.trayIcon.wmclass);
            if (app != null)
                return app;
        }

        return null;
    },

    _setApp: function() {
        if (this.app)
            return;

        this.app = this._getApp();
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
        if (this._nameWatcherId) {
            Gio.DBus.session.unwatch_name(this._nameWatcherId);
            this._nameWatcherId = 0;
        }
        MessageTray.Source.prototype.destroy.call(this);
    }
};
