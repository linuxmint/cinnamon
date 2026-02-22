// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
//
// powerUtils.js - Shared UPower utilities for Cinnamon
//
// Common utility functions for working with UPower devices,
// used by both the power applet and screensaver power widget.
//

const UPowerGlib = imports.gi.UPowerGlib;

// Re-export UPower constants for convenience
var UPDeviceKind = UPowerGlib.DeviceKind;
var UPDeviceState = UPowerGlib.DeviceState;
var UPDeviceLevel = UPowerGlib.DeviceLevel;

/**
 * getBatteryIconName:
 * @percentage: battery percentage (0-100)
 * @state: UPDeviceState value
 *
 * Returns the appropriate xsi-battery-level icon name for the given
 * battery percentage and charging state.
 */
function getBatteryIconName(percentage, state) {
    let charging = (state === UPDeviceState.CHARGING ||
                   state === UPDeviceState.PENDING_CHARGE);
    let fullyCharged = (state === UPDeviceState.FULLY_CHARGED);

    if (fullyCharged) {
        return 'xsi-battery-level-100-charged-symbolic';
    }

    let levelName;
    if (percentage < 10) {
        levelName = 'xsi-battery-level-0';
    } else if (percentage < 20) {
        levelName = 'xsi-battery-level-10';
    } else if (percentage < 30) {
        levelName = 'xsi-battery-level-20';
    } else if (percentage < 40) {
        levelName = 'xsi-battery-level-30';
    } else if (percentage < 50) {
        levelName = 'xsi-battery-level-40';
    } else if (percentage < 60) {
        levelName = 'xsi-battery-level-50';
    } else if (percentage < 70) {
        levelName = 'xsi-battery-level-60';
    } else if (percentage < 80) {
        levelName = 'xsi-battery-level-70';
    } else if (percentage < 90) {
        levelName = 'xsi-battery-level-80';
    } else if (percentage < 99) {
        levelName = 'xsi-battery-level-90';
    } else {
        levelName = 'xsi-battery-level-100';
    }

    if (charging) {
        levelName += '-charging';
    }

    return levelName + '-symbolic';
}

/**
 * deviceLevelToString:
 * @level: UPDeviceLevel value
 *
 * Returns a human-readable string describing the battery level.
 */
function deviceLevelToString(level) {
    switch (level) {
        case UPDeviceLevel.FULL:
            return _("Battery full");
        case UPDeviceLevel.HIGH:
            return _("Battery almost full");
        case UPDeviceLevel.NORMAL:
            return _("Battery good");
        case UPDeviceLevel.LOW:
            return _("Low battery");
        case UPDeviceLevel.CRITICAL:
            return _("Critically low battery");
        default:
            return _("Unknown");
    }
}

/**
 * deviceKindToString:
 * @kind: UPDeviceKind value
 *
 * Returns a human-readable string describing the device type.
 */
function deviceKindToString(kind) {
    switch (kind) {
        case UPDeviceKind.LINE_POWER:
            return _("AC adapter");
        case UPDeviceKind.BATTERY:
            return _("Laptop battery");
        case UPDeviceKind.UPS:
            return _("UPS");
        case UPDeviceKind.MONITOR:
            return _("Monitor");
        case UPDeviceKind.MOUSE:
            return _("Mouse");
        case UPDeviceKind.KEYBOARD:
            return _("Keyboard");
        case UPDeviceKind.PDA:
            return _("PDA");
        case UPDeviceKind.PHONE:
            return _("Cell phone");
        case UPDeviceKind.MEDIA_PLAYER:
            return _("Media player");
        case UPDeviceKind.TABLET:
            return _("Tablet");
        case UPDeviceKind.COMPUTER:
            return _("Computer");
        case UPDeviceKind.GAMING_INPUT:
            return _("Gaming input");
        case UPDeviceKind.PEN:
            return _("Pen");
        case UPDeviceKind.TOUCHPAD:
            return _("Touchpad");
        case UPDeviceKind.MODEM:
            return _("Modem");
        case UPDeviceKind.NETWORK:
            return _("Network");
        case UPDeviceKind.HEADSET:
            return _("Headset");
        case UPDeviceKind.SPEAKERS:
            return _("Speakers");
        case UPDeviceKind.HEADPHONES:
            return _("Headphones");
        case UPDeviceKind.VIDEO:
            return _("Video");
        case UPDeviceKind.OTHER_AUDIO:
            return _("Audio device");
        case UPDeviceKind.REMOTE_CONTROL:
            return _("Remote control");
        case UPDeviceKind.PRINTER:
            return _("Printer");
        case UPDeviceKind.SCANNER:
            return _("Scanner");
        case UPDeviceKind.CAMERA:
            return _("Camera");
        case UPDeviceKind.WEARABLE:
            return _("Wearable");
        case UPDeviceKind.TOY:
            return _("Toy");
        case UPDeviceKind.BLUETOOTH_GENERIC:
            return _("Bluetooth device");
        default: {
            try {
                return UPowerGlib.Device.kind_to_string(kind).replaceAll("-", " ").capitalize();
            } catch {
                return _("Unknown");
            }
        }
    }
}

/**
 * deviceKindToIcon:
 * @kind: UPDeviceKind value
 * @fallbackIcon: icon name to use if no specific icon for this device kind
 *
 * Returns an icon name appropriate for the device kind.
 */
function deviceKindToIcon(kind, fallbackIcon) {
    switch (kind) {
        case UPDeviceKind.MONITOR:
            return ("xsi-video-display");
        case UPDeviceKind.MOUSE:
            return ("xsi-input-mouse");
        case UPDeviceKind.KEYBOARD:
            return ("xsi-input-keyboard");
        case UPDeviceKind.PHONE:
        case UPDeviceKind.MEDIA_PLAYER:
            return ("xsi-phone-apple-iphone");
        case UPDeviceKind.TABLET:
            return ("xsi-input-tablet");
        case UPDeviceKind.COMPUTER:
            return ("xsi-computer");
        case UPDeviceKind.GAMING_INPUT:
            return ("xsi-input-gaming");
        case UPDeviceKind.TOUCHPAD:
            return ("xsi-input-touchpad");
        case UPDeviceKind.HEADSET:
            return ("xsi-audio-headset");
        case UPDeviceKind.SPEAKERS:
            return ("xsi-audio-speakers");
        case UPDeviceKind.HEADPHONES:
            return ("xsi-audio-headphones");
        case UPDeviceKind.PRINTER:
            return ("xsi-printer");
        case UPDeviceKind.SCANNER:
            return ("xsi-scanner");
        case UPDeviceKind.CAMERA:
            return ("xsi-camera-photo");
        default:
            if (fallbackIcon) {
                return fallbackIcon;
            } else {
                return ("xsi-battery-level-100");
            }
    }
}

/**
 * reportsPreciseLevels:
 * @batteryLevel: UPDeviceLevel value
 *
 * Returns true if the device reports precise percentage levels
 * (battery_level == NONE indicates percentage reporting is available).
 */
function reportsPreciseLevels(batteryLevel) {
    return batteryLevel == UPDeviceLevel.NONE;
}
