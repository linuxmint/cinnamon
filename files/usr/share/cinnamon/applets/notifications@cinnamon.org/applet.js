const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Urgency = imports.ui.messageTray.Urgency;
const NotificationDestroyedReason = imports.ui.messageTray.NotificationDestroyedReason;
const Settings = imports.ui.settings;
const Gettext = imports.gettext.domain("cinnamon-applets");
const Util = imports.misc.util;
const SignalManager = imports.misc.signalManager;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

class CinnamonNotificationsApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        // Settings
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("ignoreTransientNotifications", "ignoreTransientNotifications");
        this.settings.bind("showEmptyTray", "showEmptyTray", this._show_hide_tray);
        this.settings.bind("keyOpen", "keyOpen", this._setKeybinding);
        this.settings.bind("keyClear", "keyClear", this._setKeybinding);
        this.settings.bind("showNotificationCount", "showNotificationCount", this.update_list);
        this._setKeybinding();

        // Layout
        this._orientation = orientation;
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Lists
        this.notifications = [];    // The list of notifications, in order from oldest to newest.

        // Events
        this.signals = new SignalManager.SignalManager(null);
        this.signals.connect(Main.messageTray, 'notify-applet-update', this._notification_added.bind(this));
        this.signals.connect(global.settings, 'changed::' + PANEL_EDIT_MODE_KEY, this._on_panel_edit_mode_changed.bind(this));
        this.signals.connect(this.menu, 'menu-animated-closed', this._onMenuClosed.bind(this));

        // States
        this._blinking = false;
        this._blink_toggle = false;

        this._display();
    }

    _setKeybinding() {
        Main.keybindingManager.addHotKey("notification-open-" + this.instance_id, this.keyOpen, this._openMenu.bind(this));
        Main.keybindingManager.addHotKey("notification-clear-" + this.instance_id, this.keyClear, this._clear_all.bind(this));
    }

    on_applet_removed_from_panel () {
        Main.keybindingManager.removeHotKey("notification-open-" + this.instance_id);
        Main.keybindingManager.removeHotKey("notification-clear-" + this.instance_id);

        this.destroy();
    }

    _openMenu() {
        this._update_timestamp();

        this.notifications.forEach(notification => {
            global.reparentActor(notification.actor, this._notificationbin);
        });

        this.menu.toggle();
    }

    _onMenuClosed() {
        this._notificationbin.remove_all_children();
    }

    _display() {
        // Always start the applet empty, void of any notifications.
        this.set_applet_icon_symbolic_name("empty-notif");
        this.set_applet_tooltip(_("Notifications"));

        // Setup the notification container.
        this._maincontainer = new St.BoxLayout({name: 'traycontainer', vertical: true});
        this._notificationbin = new St.BoxLayout({vertical:true});

        // Setup the tray icon.
        this.menu_label = new PopupMenu.PopupMenuItem(stringify(this.notifications.length));
        this.menu_label.actor.reactive = false;
        this.menu_label.actor.can_focus = false;
        this.menu_label.label.add_style_class_name('popup-subtitle-menu-item');

        this.clear_separator = new PopupMenu.PopupSeparatorMenuItem();

        this.clear_action = new PopupMenu.PopupMenuItem(_("Clear notifications"));
        this.clear_action.connect('activate', this._clear_all.bind(this));
        this.clear_action.actor.hide();

        this.menu.addMenuItem(this.clear_action);
        this.menu.addMenuItem(this.clear_separator);
        this.menu.addMenuItem(this.menu_label);
        this.menu.addActor(this._maincontainer);
       
        this.scrollview = new St.ScrollView({ x_fill: true, y_fill: true, y_align: St.Align.START, style_class: "vfade"});
        this._maincontainer.add(this.scrollview);
        this.scrollview.add_actor(this._notificationbin);
        this.scrollview.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.scrollview.set_clip_to_allocation(true);

        let vscroll = this.scrollview.get_vscroll_bar();
        vscroll.connect('scroll-start', () => this.menu.passEvents = true);
        vscroll.connect('scroll-stop', () => this.menu.passEvents = false);

        // Alternative tray icons.
        this._crit_icon = new St.Icon({icon_name: 'critical-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        this._alt_crit_icon = new St.Icon({icon_name: 'alt-critical-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });

        this._on_panel_edit_mode_changed();

        this.settingsMenuItem = this.menu.addSettingsAction(_("Notification Settings"), 'notifications');
    }

    _arrangeDisplay() {
        // Remove menu actors so we can put tham back in a different order according
        // to orientation
        this.menu.box.remove_all_children();
        
        if (this._orientation == St.Side.BOTTOM) {
            this.menu.box.add(this.menu_label.actor);
            this.menu.addActor(this._maincontainer);
            this.menu.box.add(this.clear_separator.actor);
            this.menu.box.add(this.clear_action.actor);
        } else {
            this.menu.box.add(this.clear_action.actor);
            this.menu.box.add(this.clear_separator.actor);
            this.menu.box.add(this.menu_label.actor);
            this.menu.addActor(this._maincontainer);
        }

        this.menu.box.add(this.settingsMenuItem.actor);
    }

    _notification_added (mtray, notification) { // Notification event handler.
        // Ignore transient notifications?
        if (this.ignoreTransientNotifications && notification.isTransient) {
            notification.destroy();
            return;
        }

        notification.actor.unparent();
        let existing_index = this.notifications.indexOf(notification);
        if (existing_index != -1) { // This notification is already listed.
            if (notification._destroyed) {
                this.notifications.splice(existing_index, 1);
            } else {
                notification._timeLabel.show();
            }
            this.update_list();
            return;
        } else if (notification._destroyed) {
            return;
        }
        // Add notification to list.
        this.notifications.push(notification);

        notification.actor.add_style_class_name('notification-applet-padding');
        // Register for destruction.
        notification.connect('scrolling-changed', (notif, scrolling) => { this.menu.passEvents = scrolling });
        notification.connect('destroy', () => {
            let i = this.notifications.indexOf(notification);
            if (i != -1)
                this.notifications.splice(i, 1);
            this.update_list();
        });
        notification._timeLabel.show();

        this.update_list();
    }

    update_list () {
        try {
            const count = this.notifications.length;
            if (count > 0) {    // There are notifications.
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
            } else {    // There are no notifications.
                this._blinking = false;
                this.set_applet_label('');
                this.set_applet_icon_symbolic_name("empty-notif");
                this.clear_action.actor.hide();
                if (!this.showEmptyTray) {
                    this.actor.hide();
                }
            }

            if (!this.showNotificationCount) {  // Don't show notification count
                this.set_applet_label('');
                // this.clear_action.actor.hide();
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

    _show_hide_tray() { // Show or hide the notification tray.
        if(!global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            if (this.notifications.length || this.showEmptyTray) {
                this.actor.show();
            } else {
                this.actor.hide();
            }
        }
    }

    _on_panel_edit_mode_changed () {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this.actor.show();
        } else {
            this.update_list();
        }
    }

    on_applet_added_to_panel() {
        this.on_orientation_changed(this._orientation);
    }

    on_orientation_changed (orientation) {
        this._orientation = orientation;

        this._arrangeDisplay();
    }

    on_applet_clicked(event) {
        this._openMenu();
    }

    on_btn_open_system_settings_clicked() {
        Util.spawnCommandLine("cinnamon-settings notifications");
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
        Mainloop.timeout_add_seconds(1, this.critical_blink.bind(this));
    }

    destroy() {
        this.signals.disconnectAllSignals();
        this._crit_icon.destroy();
        this._alt_crit_icon.destroy();
        this.menu.destroy();
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new CinnamonNotificationsApplet(metadata, orientation, panel_height, instanceId);
}

function stringify(count) {
    if (count === 0) {
        return _("No notifications");
    } else {
        return ngettext("%d notification", "%d notifications", count).format(count);
    }
}

function timeify(orig_time) {
    let settings = new Gio.Settings({schema_id: 'org.cinnamon.desktop.interface'});
    let use_24h = settings.get_boolean('clock-use-24h');
    let now = new Date();
    let diff = Math.floor((now.getTime() - orig_time.getTime()) / 1000); // get diff in seconds
    let str;
    if (use_24h) {
        str = orig_time.toLocaleFormat('%x, %T');
    } else {
        str = orig_time.toLocaleFormat('%x, %r');
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
