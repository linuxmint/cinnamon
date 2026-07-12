// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const St = imports.gi.St;

const NotificationWidget = imports.ui.screensaver.notificationWidget;
const PowerWidget = imports.ui.screensaver.powerWidget;

const SCREENSAVER_SCHEMA = 'org.cinnamon.desktop.screensaver';

var InfoPanel = GObject.registerClass(
class InfoPanel extends St.BoxLayout {
    _init() {
        super._init({
            style_class: 'info-panel',
            x_expand: false,
            y_expand: false,
            vertical: false
        });

        this._awake = false;
        this._enabled = false;
        this._notificationWidget = null;
        this._powerWidget = null;

        let settings = new Gio.Settings({ schema_id: SCREENSAVER_SCHEMA });
        this._enabled = settings.get_boolean('show-info-panel');

        if (!this._enabled) {
            this.hide();
            return;
        }

        this._notificationWidget = new NotificationWidget.NotificationWidget();
        this._notificationWidget.connect('count-changed', this._updateVisibility.bind(this));
        this.add_child(this._notificationWidget);

        this._powerWidget = new PowerWidget.PowerWidget();
        this._powerWidget.connect('power-state-changed', this._updateVisibility.bind(this));
        this.add_child(this._powerWidget);

        this._updateVisibility();
    }

    onScreensaverActivated() {
        if (!this._enabled)
            return;

        if (this._notificationWidget) {
            this._notificationWidget.reset();
            this._notificationWidget.activate();
        }
    }

    onScreensaverDeactivated() {
        if (!this._enabled)
            return;

        if (this._notificationWidget) {
            this._notificationWidget.deactivate();
        }
    }

    onWake() {
        this._awake = true;
        this._updateVisibility();
    }

    onSleep() {
        this._awake = false;
        this._updateVisibility();
    }

    _updateVisibility() {
        if (!this._enabled) {
            this.hide();
            return;
        }

        let hasNotifications = this._notificationWidget && this._notificationWidget.shouldShow();
        let hasPower = this._powerWidget && this._powerWidget.shouldShow();
        let hasCriticalBattery = this._powerWidget && this._powerWidget.isBatteryCritical();

        if (this._awake) {
            // When awake, show panel if either child has content
            if (this._powerWidget)
                this._powerWidget.visible = hasPower;
            if (this._notificationWidget)
                this._notificationWidget.visible = hasNotifications;

            this.visible = hasNotifications || hasPower;
        } else {
            // When sleeping, show notifications always but power only if critical
            if (this._notificationWidget)
                this._notificationWidget.visible = hasNotifications;
            if (this._powerWidget)
                this._powerWidget.visible = hasCriticalBattery;

            this.visible = hasNotifications || hasCriticalBattery;
        }
    }

    destroy() {
        this.onScreensaverDeactivated();

        if (this._notificationWidget) {
            this._notificationWidget.destroy();
            this._notificationWidget = null;
        }

        if (this._powerWidget) {
            this._powerWidget.destroy();
            this._powerWidget = null;
        }

        super.destroy();
    }
});
