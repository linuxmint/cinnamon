const Applet = imports.ui.applet;
const Lang = imports.lang;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;
const MessageTray = imports.ui.messageTray;
const Urgency = imports.ui.messageTray.Urgency;
const NotificationDestroyedReason = imports.ui.messageTray.NotificationDestroyedReason;
const Settings = imports.ui.settings;
const Gettext = imports.gettext.domain("cinnamon-applets");

function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instanceId);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        // Settings
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("ignoreTransientNotifications", "ignoreTransientNotifications");
        this.settings.bind("showEmptyTray", "showEmptyTray", this._show_hide_tray);

        // Layout
        this._orientation = orientation;
        this.menuManager = new PopupMenu.PopupMenuManager(this);

        // Lists
        this.notifications = [];	// The list of notifications, in order from oldest to newest.

        // Events
        Main.messageTray.connect('notify-applet-update', Lang.bind(this, this._notification_added));
        global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));

        // States
        this._blinking = false;
        this._blink_toggle = false;
    },

    _display: function() {
        // Always start the applet empty, void of any notifications.
        this.set_applet_icon_symbolic_name("empty-notif");
        this.set_applet_tooltip(_("Notifications"));

        // Setup the notification container.
        this._maincontainer = new St.BoxLayout({name: 'traycontainer', vertical: true});
        this._notificationbin = new St.BoxLayout({vertical:true});
        this.button_label_box = new St.BoxLayout();

        // Setup the tray icon.
        this.menu_label = new PopupMenu.PopupMenuItem(stringify(this.notifications.length));
        this.menu_label.actor.reactive = false;
        this.menu_label.actor.can_focus = false;
        this.menu_label.label.add_style_class_name('popup-subtitle-menu-item');

        this.clear_separator = new PopupMenu.PopupSeparatorMenuItem();

        this.clear_action = new PopupMenu.PopupMenuItem(_("Clear notifications"));
        this.clear_action.connect('activate', Lang.bind(this, this._clear_all));
        this.clear_action.actor.hide();

        if (this._orientation == St.Side.BOTTOM) {
            this.menu.addMenuItem(this.menu_label);
            this.menu.addActor(this._maincontainer);
            this.menu.addMenuItem(this.clear_separator);
            this.menu.addMenuItem(this.clear_action);
        } else {
            this.menu.addMenuItem(this.clear_action);
            this.menu.addMenuItem(this.clear_separator);
            this.menu.addMenuItem(this.menu_label);
            this.menu.addActor(this._maincontainer);
        }

        this.scrollview = new St.ScrollView({ x_fill: true, y_fill: true, y_align: St.Align.START, style_class: "vfade"});
        this._maincontainer.add(this.scrollview);
        this.scrollview.add_actor(this._notificationbin);
        this.scrollview.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);

        let vscroll = this.scrollview.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, function() {
            this.menu.passEvents = true;
        }));
        vscroll.connect('scroll-stop', Lang.bind(this, function() {
            this.menu.passEvents = false;
        }));

        // Alternative tray icons.
        this._crit_icon = new St.Icon({icon_name: 'critical-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        this._alt_crit_icon = new St.Icon({icon_name: 'alt-critical-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });

        this.update_list();
    },

    _notification_added: function (mtray, notification) {	// Notification event handler.
        // Ignore transient notifications?
        if (this.ignoreTransientNotifications && notification.isTransient) {
            return;
        }

        if (notification.enter_id > 0) {
            notification.actor.disconnect(notification.enter_id);
            notification.enter_id = 0;
        }
        if (notification.leave_id > 0) {
            notification.actor.disconnect(notification.leave_id);
            notification.leave_id = 0;
        }

        notification.actor.opacity = (notification._table.get_theme_node().get_length('opacity') / global.ui_scale) || 255;

        notification.actor.unparent();
        let existing_index = this.notifications.indexOf(notification);
        if (existing_index != -1) {	// This notification is already listed.
            if (notification._destroyed) {
                this.notifications.splice(existing_index, 1);
            } else {
                notification._inNotificationBin = true;
                global.reparentActor(notification.actor, this._notificationbin);
                notification.expand();
                notification._timeLabel.show();
            }
            this.update_list();
            return;
        } else if (notification._destroyed) {
            return;
        }
        // Add notification to list.
        notification._inNotificationBin = true;
        this.notifications.push(notification);
        // Steal the notication panel.
        notification.expand();
        this._notificationbin.add(notification.actor)
        notification.actor._parent_container = this._notificationbin;
        notification.actor.add_style_class_name('notification-applet-padding');
        // Register for destruction.
        notification.connect('clicked', Lang.bind(this, this._item_clicked, false));
        notification.connect('destroy', Lang.bind(this, this._item_clicked, true));
        notification._timeLabel.show();

        this.update_list();
    },

    _item_clicked: function(notification, destroyed) {
        let i = this.notifications.indexOf(notification);
        if (i != -1) {
            this.notifications.splice(i, 1);
            if (!destroyed) {
                notification.destroy(NotificationDestroyedReason.DISMISSED);
            }
        }
        this.update_list();
    },

    update_list: function () {
        try {
            let count = this.notifications.length;
            if (count > 0) {	// There are notifications.
                this.actor.show();
                this.clear_action.actor.show();
                this.set_applet_label(count.toString());
                // Find max urgency and derive list icon.
                let max_urgency = -1;
                for (let i = 0; i < count; i++) {
                    let cur_urgency = this.notifications[i].urgency;
                    if (cur_urgency > max_urgency)
                        max_urgency = cur_urgency;
                }
                switch (max_urgency) {
                    case Urgency.LOW:
                        this._blinking = false;
                        this.set_applet_icon_symbolic_name("low-notif");
                        break;
                    case Urgency.NORMAL:
                    case Urgency.HIGH:
                        this._blinking = false;
                        this.set_applet_icon_symbolic_name("normal-notif");
                        break;
                    case Urgency.CRITICAL:
                        if (!this._blinking) {
                            this._blinking = true;
                            this.critical_blink();
                        }
                        break;
                }
            } else {	// There are no notifications.
                this._blinking = false;
                this.set_applet_label('');
                this.set_applet_icon_symbolic_name("empty-notif");
                this.clear_action.actor.hide();
                if (!this.showEmptyTray) {
                    this.actor.hide();
                }
            }
            this.menu_label.label.set_text(stringify(count));
            this._notificationbin.queue_relayout();
        }
        catch (e) {
            global.logError(e);
        }
    },

    _clear_all: function() {
        let count = this.notifications.length;
        if (count > 0) {
            for (let i = count-1; i >=0; i--) {
                this._notificationbin.remove_actor(this.notifications[i].actor);
                this.notifications[i].destroy(NotificationDestroyedReason.DISMISSED);
            }
        }
        this.notifications = [];
        this.update_list();
    },

    _show_hide_tray: function() {	// Show or hide the notification tray.
        if (this.notifications.length || this.showEmptyTray) {
            this.actor.show();
        } else {
            this.actor.hide();
        }
    },

    on_panel_edit_mode_changed: function () {
    },

    on_applet_added_to_panel: function() {
        this.on_orientation_changed(this._orientation);
    },

    on_orientation_changed: function (orientation) {
        this._orientation = orientation;

        if (this.menu) {
            this.menu.destroy();
        }
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._display();
    },

    on_applet_clicked: function(event) {
        this._update_timestamp();
        this.menu.toggle();
    },

    _update_timestamp: function () {
        let dateFormat = _("%l:%M %p");
        let actors = this._notificationbin.get_children();
        if (actors) {
            for (let i = 0; i < actors.length; i++) {
                let notification = actors[i]._delegate;
                let orig_time = notification._timestamp;
                notification._timeLabel.clutter_text.set_markup(timeify(orig_time));
            }
        }
    },

    critical_blink: function () {
        if (!this._blinking)
            return;
        if (this._blink_toggle) {
            this._applet_icon_box.child = this._crit_icon;
        } else {
            this._applet_icon_box.child = this._alt_crit_icon;
        }
        this._blink_toggle = !this._blink_toggle;
        Mainloop.timeout_add_seconds(1, Lang.bind(this, this.critical_blink));
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;
}

function stringify(count) {
    let str;
    switch (true) {
        case (count == 0):
            str = _("No notifications");
            break;
        case (count == 1):
            str = count.toString() + _(" notification");
            break;
        case (count > 1):
            str = count.toString() + _(" notifications");
            break;
        default:
            str = "";
    }
    return str;
}

function timeify(orig_time) {
    let settings = new Gio.Settings({schema_id: 'org.cinnamon.desktop.interface'});
    let use_24h = settings.get_boolean('clock-use-24h');
    let now = new Date();
    let diff = Math.floor((now.getTime() - orig_time.getTime()) / 1000); // get diff in seconds
    let str;
    if (use_24h) {
        str = orig_time.toLocaleFormat('%T');
    } else {
        str = orig_time.toLocaleFormat('%r');
    }
    switch (true) {
        case (diff <= 15):
            str += _(" (Just now)");
            break;
        case (diff > 15 && diff <= 59):
            str += Gettext.ngettext(" (%d second ago)", " (%d seconds ago)", diff).format(diff);
            break;
        case (diff > 59 && diff <= 3540):
            diff_minutes = Math.floor(diff / 60);
            str += Gettext.ngettext(" (%d minute ago)", " (%d minutes ago)", diff_minutes).format(diff_minutes);
            break;
    }
    return str;
}
