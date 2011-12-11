// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const DBus = imports.dbus;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

const BUS_NAME = 'org.gnome.SettingsDaemon';
const OBJECT_PATH = '/org/gnome/SettingsDaemon/Power';

const UPDeviceType = {
    UNKNOWN: 0,
    AC_POWER: 1,
    BATTERY: 2,
    UPS: 3,
    MONITOR: 4,
    MOUSE: 5,
    KEYBOARD: 6,
    PDA: 7,
    PHONE: 8,
    MEDIA_PLAYER: 9,
    TABLET: 10,
    COMPUTER: 11
};

const UPDeviceState = {
    UNKNOWN: 0,
    CHARGING: 1,
    DISCHARGING: 2,
    EMPTY: 3,
    FULLY_CHARGED: 4,
    PENDING_CHARGE: 5,
    PENDING_DISCHARGE: 6
};

const PowerManagerInterface = {
    name: 'org.gnome.SettingsDaemon.Power',
    methods: [
        { name: 'GetDevices', inSignature: '', outSignature: 'a(susdut)' },
        { name: 'GetPrimaryDevice', inSignature: '', outSignature: '(susdut)' },
        ],
    signals: [
        { name: 'Changed', inSignature: '' },
        ],
    properties: [
        { name: 'Icon', signature: 's', access: 'read' },
        ]
};
let PowerManagerProxy = DBus.makeProxyClass(PowerManagerInterface);

function Indicator() {
    this._init.apply(this, arguments);
}

Indicator.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'battery-missing');
        this._proxy = new PowerManagerProxy(DBus.session, BUS_NAME, OBJECT_PATH);

        this._deviceItems = [ ];
        this._hasPrimary = false;
        this._primaryDeviceId = null;

        this._batteryItem = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._primaryPercentage = new St.Label();
        this._batteryItem.addActor(this._primaryPercentage, { align: St.Align.END });
        this.menu.addMenuItem(this._batteryItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._otherDevicePosition = 2;

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addSettingsAction(_("Power Settings"), 'gnome-power-panel.desktop');

        this._proxy.connect('Changed', Lang.bind(this, this._devicesChanged));
        this._devicesChanged();
    },

    _readPrimaryDevice: function() {
        this._proxy.GetPrimaryDeviceRemote(Lang.bind(this, function(device, error) {
            if (error) {
                this._hasPrimary = false;
                this._primaryDeviceId = null;
                this._batteryItem.actor.hide();
                return;
            }
            let [device_id, device_type, icon, percentage, state, seconds] = device;
            if (device_type == UPDeviceType.BATTERY) {
                this._hasPrimary = true;
                let time = Math.round(seconds / 60);
                if (time == 0) {
                    // 0 is reported when UPower does not have enough data
                    // to estimate battery life
                    this._batteryItem.label.text = _("Estimating...");
                } else {
                    let minutes = time % 60;
                    let hours = Math.floor(time / 60);
                    let timestring;
                    if (time > 60) {
                        if (minutes == 0) {
                            timestring = ngettext("%d hour remaining", "%d hours remaining", hours).format(hours);
                        } else {
                            /* TRANSLATORS: this is a time string, as in "%d hours %d minutes remaining" */
                            let template = _("%d %s %d %s remaining");

                            timestring = template.format (hours, ngettext("hour", "hours", hours), minutes, ngettext("minute", "minutes", minutes));
                        }
                    } else
                        timestring = ngettext("%d minute remaining", "%d minutes remaining", minutes).format(minutes);
                    this._batteryItem.label.text = timestring;
                }
                this._primaryPercentage.text = C_("percent of battery remaining", "%d%%").format(Math.round(percentage));
                this._batteryItem.actor.show();
            } else {
                this._hasPrimary = false;
                this._batteryItem.actor.hide();
            }

            this._primaryDeviceId = device_id;
        }));
    },

    _readOtherDevices: function() {
        this._proxy.GetDevicesRemote(Lang.bind(this, function(devices, error) {
            this._deviceItems.forEach(function(i) { i.destroy(); });
            this._deviceItems = [];

            if (error) {
                return;
            }

            let position = 0;
            for (let i = 0; i < devices.length; i++) {
                let [device_id, device_type] = devices[i];
                if (device_type == UPDeviceType.AC_POWER || device_id == this._primaryDeviceId)
                    continue;

                let item = new DeviceItem (devices[i]);
                this._deviceItems.push(item);
                this.menu.addMenuItem(item, this._otherDevicePosition + position);
                position++;
            }
        }));
    },

    _devicesChanged: function() {
        this._proxy.GetRemote('Icon', Lang.bind(this, function(icon, error) {
            if (icon) {
                let gicon = Gio.icon_new_for_string(icon);
                this.setGIcon(gicon);
                this.actor.show();
            } else {
                this.menu.close();
                this.actor.hide();
            }
        }));
        this._readPrimaryDevice();
        this._readOtherDevices();
    }
};

function DeviceItem() {
    this._init.apply(this, arguments);
}

DeviceItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(device) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, { reactive: false });

        let [device_id, device_type, icon, percentage, state, time] = device;

        this._box = new St.BoxLayout({ style_class: 'popup-device-menu-item' });
        this._label = new St.Label({ text: this._deviceTypeToString(device_type) });

        this._icon = new St.Icon({ gicon: Gio.icon_new_for_string(icon),
                                   icon_type: St.IconType.SYMBOLIC,
                                   style_class: 'popup-menu-icon' });

        this._box.add_actor(this._icon);
        this._box.add_actor(this._label);
        this.addActor(this._box);

        let percentLabel = new St.Label({ text: C_("percent of battery remaining", "%d%%").format(Math.round(percentage)) });
        this.addActor(percentLabel, { align: St.Align.END });
    },

    _deviceTypeToString: function(type) {
	switch (type) {
	case UPDeviceType.AC_POWER:
            return _("AC adapter");
        case UPDeviceType.BATTERY:
            return _("Laptop battery");
        case UPDeviceType.UPS:
            return _("UPS");
        case UPDeviceType.MONITOR:
            return _("Monitor");
        case UPDeviceType.MOUSE:
            return _("Mouse");
        case UPDeviceType.KEYBOARD:
            return _("Keyboard");
        case UPDeviceType.PDA:
            return _("PDA");
        case UPDeviceType.PHONE:
            return _("Cell phone");
        case UPDeviceType.MEDIA_PLAYER:
            return _("Media player");
        case UPDeviceType.TABLET:
            return _("Tablet");
        case UPDeviceType.COMPUTER:
            return _("Computer");
        default:
            return _("Unknown");
        }
    }
}
