// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const GObject = imports.gi.GObject;
const St = imports.gi.St;
const UPowerGlib = imports.gi.UPowerGlib;

const PowerUtils = imports.misc.powerUtils;
const SignalManager = imports.misc.signalManager;

const ICON_SIZE_BASE = 24;
const BATTERY_CRITICAL_PERCENT = 10;

const {
    UPDeviceKind,
    UPDeviceState
} = PowerUtils;

var PowerWidget = GObject.registerClass({
    Signals: { 'power-state-changed': {} }
}, class PowerWidget extends St.BoxLayout {
    _init() {
        super._init({
            style_class: 'power-widget',
            x_expand: false,
            y_expand: false,
            vertical: false
        });

        this._iconSize = ICON_SIZE_BASE * global.ui_scale;
        this._signalManager = new SignalManager.SignalManager(null);
        this._client = null;
        this._devices = [];
        this._batteryCritical = false;

        this._setupUPower();
    }

    _setupUPower() {
        UPowerGlib.Client.new_async(null, (obj, res) => {
            try {
                this._client = UPowerGlib.Client.new_finish(res);
                this._signalManager.connect(this._client, 'device-added', this._onDeviceChanged.bind(this));
                this._signalManager.connect(this._client, 'device-removed', this._onDeviceChanged.bind(this));
                this._updateDevices();
            } catch (e) {
                global.logError(`PowerWidget: Failed to connect to UPower: ${e.message}`);
                this.hide();
            }
        });
    }

    _onDeviceChanged(client, device) {
        this._updateDevices();
    }

    _updateDevices() {
        if (!this._client)
            return;

        for (let device of this._devices) {
            this._signalManager.disconnect('notify', device);
        }
        this._devices = [];

        let devices = this._client.get_devices();
        for (let device of devices) {
            if (device.kind === UPDeviceKind.BATTERY || device.kind === UPDeviceKind.UPS) {
                this._devices.push(device);
                this._signalManager.connect(device, 'notify', this._onDevicePropertiesChanged.bind(this));
            }
        }

        this._updateDisplay();
    }

    _onDevicePropertiesChanged(device, pspec) {
        if (['percentage', 'state', 'icon-name'].includes(pspec.name)) {
            this._updateDisplay();
        }
    }

    _updateDisplay() {
        this.destroy_all_children();
        this._batteryCritical = false;

        if (this._devices.length === 0 || !this._shouldShow()) {
            this.hide();
            this.emit('power-state-changed');
            return;
        }

        for (let device of this._devices) {
            let icon = this._createBatteryIcon(device);
            this.add_child(icon);

            if (device.percentage < BATTERY_CRITICAL_PERCENT) {
                this._batteryCritical = true;
            }
        }

        this.show();
        this.emit('power-state-changed');
    }

    shouldShow() {
        return this._devices.length > 0 && this._shouldShow();
    }

    _shouldShow() {
        for (let device of this._devices) {
            let state = device.state;

            // Always show if discharging
            if (state === UPDeviceState.DISCHARGING ||
                state === UPDeviceState.PENDING_DISCHARGE) {
                return true;
            }

            // Show if charging but not yet full
            if (state === UPDeviceState.CHARGING ||
                state === UPDeviceState.PENDING_CHARGE) {
                return true;
            }

            // Show if critical, regardless of state
            if (device.percentage < BATTERY_CRITICAL_PERCENT) {
                return true;
            }
        }

        // Don't show if fully charged and on AC
        return false;
    }

    _createBatteryIcon(device) {
        let iconName = PowerUtils.getBatteryIconName(device.percentage, device.state);

        let icon = new St.Icon({
            icon_name: iconName,
            icon_type: St.IconType.SYMBOLIC,
            icon_size: this._iconSize,
            y_align: St.Align.MIDDLE,
            style_class: 'power-widget-icon'
        });

        // Add critical styling if battery is low
        if (device.percentage < BATTERY_CRITICAL_PERCENT) {
            icon.add_style_class_name('power-widget-icon-critical');
        }

        return icon;
    }

    isBatteryCritical() {
        return this._batteryCritical;
    }

    destroy() {
        if (this._signalManager) {
            this._signalManager.disconnectAllSignals();
        }
        this._client = null;
        this._devices = [];

        super.destroy();
    }
});
