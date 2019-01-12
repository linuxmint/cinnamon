const {TextIconApplet, AppletPopupMenu, AllowedLayout} = imports.ui.applet;
const {messageTray} = imports.ui.main;
const {PolicyType} = imports.gi.Gtk;
const {Settings} = imports.gi.Gio;
const {PopupMenuManager, PopupMenuItem, PopupSeparatorMenuItem} = imports.ui.popupMenu;
const {BoxLayout, ScrollView, Icon, IconType, Align, Side} = imports.gi.St;
const {Urgency, NotificationDestroyedReason} = imports.ui.messageTray;
const {AppletSettings} = imports.ui.settings;
const {ngettext} = imports.gettext.domain("cinnamon-applets");

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

class CinnamonNotificationsApplet extends TextIconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        this.setAllowedLayout(AllowedLayout.BOTH);

        this.state = {};

        // Layout
        this._orientation = orientation;

        // Lists
        this.notifications = [];	// The list of notifications, in order from oldest to newest.

        // Settings
        this.settings = new AppletSettings(this.state, metadata.uuid, instanceId, true);
        this.settings.promise.then(() => this.settingsInit(orientation));
    }

    settingsInit(orientation) {
        this.settings.bind("ignoreTransientNotifications", "ignoreTransientNotifications");
        this.settings.bind("showEmptyTray", "showEmptyTray", () => this._show_hide_tray());

        this.menuManager = new PopupMenuManager(this);

        // Events
        this.trayId = messageTray.connect('notify-applet-update', (m, n) => this._notification_added(m, n));
        global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, () => this._on_panel_edit_mode_changed());

        // States
        this._blinking = false;
        this._blink_toggle = false;

        this.on_orientation_changed(this._orientation);
        this._show_hide_tray();
    }

    _display() {
        // Always start the applet empty, void of any notifications.
        this.set_applet_icon_symbolic_name("empty-notif");
        this.set_applet_tooltip(_("Notifications"));

        // Setup the notification container.
        this._maincontainer = new BoxLayout({name: 'traycontainer', vertical: true});
        this._notificationbin = new BoxLayout({vertical:true});
        this.button_label_box = new BoxLayout();

        // Setup the tray icon.
        this.menu_label = new PopupMenuItem(stringify(this.notifications.length));
        this.menu_label.actor.reactive = false;
        this.menu_label.actor.can_focus = false;
        this.menu_label.label.add_style_class_name('popup-subtitle-menu-item');

        this.clear_separator = new PopupSeparatorMenuItem();

        this.clear_action = new PopupMenuItem(_("Clear notifications"));
        this.clear_action.connect('activate', () => this._clear_all());
        this.clear_action.actor.hide();

        if (this._orientation == Side.BOTTOM) {
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

        this.scrollview = new ScrollView({ x_fill: true, y_fill: true, y_align: Align.START, style_class: "vfade"});
        this._maincontainer.add(this.scrollview);
        this.scrollview.add_actor(this._notificationbin);
        this.scrollview.set_policy(PolicyType.NEVER, PolicyType.AUTOMATIC);

        let vscroll = this.scrollview.get_vscroll_bar();
        vscroll.connect('scroll-start', () => this.menu.passEvents = true);
        vscroll.connect('scroll-stop', () => this.menu.passEvents = false);

        // Alternative tray icons.
        this._crit_icon = new Icon({icon_name: 'critical-notif', icon_type: IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        this._alt_crit_icon = new Icon({icon_name: 'alt-critical-notif', icon_type: IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });

        this._on_panel_edit_mode_changed();
    }

    _notification_added (mtray, notification) {	// Notification event handler.
        // Ignore transient notifications?
        if (this.state.ignoreTransientNotifications && notification.isTransient) {
            notification.destroy();
            return;
        }

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
        this._notificationbin.add(notification.actor);
        notification.actor._parent_container = this._notificationbin;
        notification.actor.add_style_class_name('notification-applet-padding');
        // Register for destruction.
        notification.connect('clicked', (n) => this._item_clicked(n, false));
        notification.connect('destroy', (n) => this._item_clicked(n, true));
        notification._timeLabel.show();

        this.update_list();
    }

    _item_clicked(notification, destroyed) {
        let i = this.notifications.indexOf(notification);
        if (i != -1) {
            this.notifications.splice(i, 1);
            if (!destroyed) {
                notification.destroy(NotificationDestroyedReason.DISMISSED);
            }
        }
        this.update_list();
    }

    update_list () {
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
                if (!this.state.showEmptyTray) {
                    this.actor.hide();
                }
            }
            this.menu_label.label.set_text(stringify(count));
            this._notificationbin.queue_relayout();
        }
        catch (e) {
            global.logError(e);
        }
    }

    _clear_all() {
        let count = this.notifications.length;
        if (count > 0) {
            for (let i = count-1; i >=0; i--) {
                this._notificationbin.remove_actor(this.notifications[i].actor);
                this.notifications[i].destroy(NotificationDestroyedReason.DISMISSED);
            }
        }
        this.notifications = [];
        this.update_list();
    }

    _show_hide_tray() {	// Show or hide the notification tray.
        if (this.notifications.length || this.state.showEmptyTray) {
            this.actor.show();
        } else {
            this.actor.hide();
        }
    }

    _on_panel_edit_mode_changed () {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this.actor.show();
        } else {
            this.update_list();
        }
    }

    on_orientation_changed (orientation) {
        this._orientation = orientation;

        if (this.menu) {
            this.menu.destroy();
        }
        this.menu = new AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);
        this._display();
    }

    on_applet_clicked(event) {
        this._update_timestamp();
        this.menu.toggle();
    }

    on_applet_reloaded() {
        global.notificationsAppletReloading = true;
    }

    on_applet_removed_from_panel() {
        if (this.trayId && !global.notificationsAppletReloading) {
            messageTray.disconnect('notify-applet-update', this.trayId);
            this.trayId = 0;
        }
        this.settings.finalize();
        global.notificationsAppletReloading = false;
    }

    _update_timestamp() {
        let len = this.notifications.length;
        if (len > 0) {
            for (let i = 0; i < len; i++) {
                let notification = this.notifications[i];
                let orig_time = notification._timestamp;
                notification._timeLabel.clutter_text.set_markup(timeify(orig_time));
            }
        }
    }

    critical_blink () {
        if (!this._blinking)
            return;
        if (this._blink_toggle) {
            this._applet_icon_box.child = this._crit_icon;
        } else {
            this._applet_icon_box.child = this._alt_crit_icon;
        }
        this._blink_toggle = !this._blink_toggle;
        setTimeout(() => this.critical_blink(), 1000);
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new CinnamonNotificationsApplet(metadata, orientation, panel_height, instanceId);
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
    let settings = new Settings({schema_id: 'org.cinnamon.desktop.interface'});
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
        case (diff <= 15): {
            str += " (" + _("just now") + ")";
            break;
        } case (diff > 15 && diff <= 59): {
            str += " (" + ngettext("%d second ago", "%d seconds ago", diff).format(diff) + ")";
            break;
        } case (diff > 59 && diff <= 3540): {
            let diff_minutes = Math.floor(diff / 60);
            str += " (" + ngettext("%d minute ago", "%d minutes ago", diff_minutes).format(diff_minutes) + ")";
            break;
        }
    }
    return str;
}
