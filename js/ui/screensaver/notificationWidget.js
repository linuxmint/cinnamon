// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const GObject = imports.gi.GObject;
const St = imports.gi.St;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;

const ICON_SIZE_BASE = 24;

var NotificationWidget = GObject.registerClass({
    Signals: { 'count-changed': {} }
}, class NotificationWidget extends St.BoxLayout {
    _init() {
        super._init({
            style_class: 'notification-widget',
            x_expand: false,
            y_expand: false,
            vertical: false
        });

        this._count = 0;
        this._seenNotifications = new Set();
        this._signalId = 0;

        let iconSize = ICON_SIZE_BASE;

        this._label = new St.Label({
            style_class: 'notification-widget-label',
            y_align: St.Align.MIDDLE
        });
        this.add_child(this._label);

        this._icon = new St.Icon({
            icon_name: 'xsi-notifications-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            icon_size: iconSize,
            style_class: 'notification-widget-icon',
            y_align: St.Align.MIDDLE
        });
        this.add_child(this._icon);

        this.hide();
    }

    activate() {
        MessageTray.extensionsHandlingNotifications++;
        this._signalId = Main.messageTray.connect(
            'notify-applet-update', this._onNotification.bind(this)
        );
    }

    deactivate() {
        if (this._signalId) {
            Main.messageTray.disconnect(this._signalId);
            this._signalId = 0;

            MessageTray.extensionsHandlingNotifications =
                Math.max(0, MessageTray.extensionsHandlingNotifications - 1);
        }

        this.reset();
    }

    reset() {
        this._count = 0;
        this._seenNotifications.clear();
        this._updateDisplay();
    }

    _onNotification(tray, notification) {
        if (notification.isTransient)
            return;

        if (this._seenNotifications.has(notification))
            return;

        this._seenNotifications.add(notification);
        this._count++;
        this._updateDisplay();
    }

    _updateDisplay() {
        if (this._count > 0) {
            this._label.text = this._count.toString();
            this.show();
        } else {
            this.hide();
        }

        this.emit('count-changed');
    }

    shouldShow() {
        return this._count > 0;
    }

    destroy() {
        this.deactivate();
        super.destroy();
    }
});
