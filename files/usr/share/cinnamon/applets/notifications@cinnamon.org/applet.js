const Applet = imports.ui.applet;
const Lang = imports.lang;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const Mainloop = imports.mainloop;
const MessageTray = imports.ui.messageTray;
const Urgency = imports.ui.messageTray.Urgency;
const NotificationDestroyedReason = imports.ui.messageTray.NotificationDestroyedReason;

function MyApplet(metadata, orientation, panel_height) {
    this._init(metadata, orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height);

        Gtk.IconTheme.get_default().append_search_path(metadata.path);
        this._orientation = orientation;
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.notif_count = 0;
        this.notifications = [];
        Main.messageTray.connect('notify-applet-update', Lang.bind(this, this._notification_added));
        global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed));
        this._calendarSettings = new Gio.Settings({ schema: 'org.cinnamon.calendar' });
        this._calendarSettings.connect('changed', Lang.bind(this, this._update_timestamp));
        this._blinking = false;
        this._blink_toggle = false;
    },

    _display: function() {
        this.set_applet_icon_symbolic_name("empty-notif");
        this.set_applet_tooltip(_("Notifications"));
        this._maincontainer = new St.BoxLayout({name: 'traycontainer', vertical: true});
        this._notificationbin = new St.BoxLayout({vertical:true});
        this.button_label_box = new St.BoxLayout();
        this.menu_text = stringify(this.notif_count);
        this.menu_label = new PopupMenu.PopupMenuItem(this.menu_text);
        this.menu_label.actor.reactive = false;
        this.menu_label.actor.can_focus = false;
        this.menu_label.label.add_style_class_name('popup-subtitle-menu-item');
        this.menu.addMenuItem(this.menu_label);
        this.menu.addActor(this._maincontainer);
        this.clear_separator = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this.clear_separator);
        this.clear_action = new PopupMenu.PopupMenuItem(_("Clear notifications"));
        this.menu.addMenuItem(this.clear_action);
        this.clear_action.connect('activate', Lang.bind(this, this._clear_all));
        this.clear_action.actor.hide();
        this.scrollview = new St.ScrollView({ x_fill: true, y_fill: true, y_align: St.Align.START});
        this._maincontainer.add(this.scrollview);
        this.scrollview.add_actor(this._notificationbin);
        this.scrollview.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this._crit_icon = new St.Icon({icon_name: 'critical-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        this._alt_crit_icon = new St.Icon({icon_name: 'alt-critical-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        this.update_list();
    },

    _notification_added: function (mtray, notification) {
        notification.actor.unparent();
        let existing_index = this.notifications.indexOf(notification);
        if (existing_index != -1) {
            notification._inNotificationBin = true;
            notification.actor.reparent(this._notificationbin);
            notification.expand();
            notification._timeLabel.show();
            this.update_list();
            return;
        }
        notification._inNotificationBin = true;
        this.notifications.push(notification);
        notification.expand();
        this._notificationbin.add(notification.actor)
        notification.actor._parent_container = this._notificationbin;
        notification.actor.add_style_class_name('notification-applet-padding');
        notification.connect('clicked', Lang.bind(this, this._item_clicked));
        notification.connect('destroy', Lang.bind(this, this._item_clicked));
        notification._timeLabel.show();
        this.update_list();
    },

    _item_clicked: function(notification) {
        let i = this.notifications.indexOf(notification);
        if (i != -1) {
            this.notifications.splice(i, 1);
            notification.destroy(NotificationDestroyedReason.DISMISSED);
        }
        this.update_list();
    },

    update_list: function () {
        try {
            this.notif_count = this.notifications.length;
            if (this.notif_count > 0) {
                //this.clear_separator.actor.show();
                this.clear_action.actor.show();
                this.set_applet_label(this.notif_count.toString());
                let max_urgency = -1;
                for (let i = 0; i < this.notif_count; i++) {
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
            } else {
                this._blinking = false;
                this.set_applet_label('');
                this.set_applet_icon_symbolic_name("empty-notif");
                //this.clear_separator.actor.hide();
                this.clear_action.actor.hide();
            }
            this.menu_label.label.set_text(stringify(this.notif_count));
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
        let dateFormat = this._calendarSettings.get_string('date-format');       
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

function main(metadata, orientation, panel_height) {
    let myApplet = new MyApplet(metadata, orientation, panel_height);
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
    let now = new Date();
    let diff = Math.floor((now.getTime() - orig_time.getTime()) / 1000); // get diff in seconds
    let str = orig_time.toLocaleTimeString();
    switch (true) {
        case (diff <= 15):
            str += _(" (Just now)");
            break;
        case (diff > 15 && diff <= 59):
            str += _(" (%s seconds ago)").format(diff.toString());
            break;
        case (diff > 59 && diff <= 119):
            str += _(" (%s minute ago)").format(Math.floor(diff / 60).toString());
            break;
        case (diff > 119 && diff <= 3540):
            str += _(" (%s minutes ago)").format(Math.floor(diff / 60).toString());
            break;
    }
    return str;
}
