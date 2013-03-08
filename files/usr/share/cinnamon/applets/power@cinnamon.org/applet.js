const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const DBus = imports.dbus;
const Lang = imports.lang;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Pango = imports.gi.Pango;

const POWER_SCHEMA = "org.cinnamon.power"
const SHOW_PERCENTAGE_KEY = "power-label";
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

const LabelDisplay = {
    NONE: 'none',
    PERCENT: 'percent',
    TIME: 'time'
};

const PowerManagerInterface = {
    name: 'org.gnome.SettingsDaemon.Power',
    methods: [
        { name: 'GetDevices', inSignature: '', outSignature: 'a(susdut)' },
        { name: 'GetPrimaryDevice', inSignature: '', outSignature: '(susdut)' },
        ],
    signals: [
        { name: 'PropertiesChanged', inSignature: 's,a{sv},a[s]' },
        ],
    properties: [
        { name: 'Icon', signature: 's', access: 'read' },
        ]
};
let PowerManagerProxy = DBus.makeProxyClass(PowerManagerInterface);

const SettingsManagerInterface = {
	name: 'org.freedesktop.DBus.Properties',
	methods: [
		{ name: 'Get', inSignature: 's,s', outSignature: 'v' },
		{ name: 'GetAll', inSignature: 's', outSignature: 'a{sv}' },
		{ name: 'Set', inSignature: 's,s,v', outSignature: '' }
	],
	signals: [
	{name: 'PropertiesChanged', inSignature:'s,a{sv},a[s]', outSignature:''}
	]
};

let SettingsManagerProxy = DBus.makeProxyClass(SettingsManagerInterface);

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

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}


MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height) {        
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height);
        
        try {                                
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);            
            
            this.set_applet_icon_symbolic_name('battery-missing');            
            this._proxy = new PowerManagerProxy(DBus.session, BUS_NAME, OBJECT_PATH);
            this._smProxy = new SettingsManagerProxy(DBus.session, BUS_NAME, OBJECT_PATH);
            
            let icon = this.actor.get_children()[0];
            this.actor.remove_actor(icon);
            let box = new St.BoxLayout({ name: 'batteryBox' });
            this.actor.add_actor(box);
            let iconBox = new St.Bin();
            box.add(iconBox, { y_align: St.Align.MIDDLE, y_fill: false });
            this._mainLabel = new St.Label();
            this._mainLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
            box.add(this._mainLabel, { y_align: St.Align.MIDDLE, y_fill: false });
            iconBox.child = icon;

            this._deviceItems = [ ];
            this._hasPrimary = false;
            this._primaryDeviceId = null;
            
            let settings = new Gio.Settings({ schema: POWER_SCHEMA }); 
            this._labelDisplay = settings.get_string(SHOW_PERCENTAGE_KEY);
            let applet = this;
            settings.connect('changed::'+SHOW_PERCENTAGE_KEY, function() {
                applet._switchLabelDisplay(settings.get_string(SHOW_PERCENTAGE_KEY));
            });

            this._batteryItem = new PopupMenu.PopupMenuItem('', { reactive: false });
            this._primaryPercentage = new St.Label();
            this._batteryItem.addActor(this._primaryPercentage, { align: St.Align.END });
            this.menu.addMenuItem(this._batteryItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this._otherDevicePosition = 2;
            
            // Setup label display settings
            this._displayItem = new PopupMenu.PopupSubMenuMenuItem(_("Display"));
            this.menu.addMenuItem(this._displayItem);
            this._displayPercentageItem = new PopupMenu.PopupMenuItem(_("Show percentage"));
            this._displayPercentageItem.connect('activate', Lang.bind(this, function() {
                settings.set_string(SHOW_PERCENTAGE_KEY, LabelDisplay.PERCENT);
            }));
            this._displayItem.menu.addMenuItem(this._displayPercentageItem);
            this._displayTimeItem = new PopupMenu.PopupMenuItem(_("Show time remaining"));
            this._displayTimeItem.connect('activate', Lang.bind(this, function() {
                settings.set_string(SHOW_PERCENTAGE_KEY, LabelDisplay.TIME);
            }));
            this._displayItem.menu.addMenuItem(this._displayTimeItem);
            this._displayNoneItem = new PopupMenu.PopupMenuItem(_("Hide label"));
            this._displayNoneItem.connect('activate', Lang.bind(this, function() {
                settings.set_string(SHOW_PERCENTAGE_KEY, LabelDisplay.NONE);
            }));
            this._displayItem.menu.addMenuItem(this._displayNoneItem);
            this._switchLabelDisplay(this._labelDisplay);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addSettingsAction(_("Power Settings"), 'power');

            this._smProxy.connect('PropertiesChanged', Lang.bind(this, this._devicesChanged));
            this._devicesChanged();            
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },

    _switchLabelDisplay: function(display) {
            this._labelDisplay = display;

            this._displayPercentageItem.setShowDot(false);
            this._displayNoneItem.setShowDot(false);
            this._displayTimeItem.setShowDot(false);

            if (this._labelDisplay == LabelDisplay.PERCENT) {
                this._displayPercentageItem.setShowDot(true);
            }
            else if (this._labelDisplay == LabelDisplay.TIME) {
                this._displayTimeItem.setShowDot(true);
            }
            else {
                this._displayNoneItem.setShowDot(true);
            }

            this._updateLabel();
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
                    this.set_applet_tooltip(timestring);
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
                this.set_applet_tooltip(item._label.text);
                this._deviceItems.push(item);
                this.menu.addMenuItem(item, this._otherDevicePosition + position);
                position++;
            }
        }));
    },

    on_panel_height_changed: function() {
        this._devicesChanged();
    },

    _devicesChanged: function() {
        this.set_applet_icon_symbolic_name('battery-missing');
        this._proxy.GetRemote('Icon', Lang.bind(this, function(icon, error) {
            if (icon) {    
                let gicon = Gio.icon_new_for_string(icon);
                this._applet_icon.gicon = gicon;
                this.actor.show();
            } else {
                this.menu.close();
                this.actor.hide();
            }
        }));
        this._readPrimaryDevice();
        this._readOtherDevices();
        this._updateLabel();
    },
    
    _updateLabel: function() {
        this._proxy.GetDevicesRemote(Lang.bind(this, function(devices, error) {
            if (error) {
                this._mainLabel.set_text("");
                return;
            }

            if (this._labelDisplay != LabelDisplay.NONE) {
                for (let i = 0; i < devices.length; i++) {
                    let [device_id, device_type, icon, percentage, state, time] = devices[i];
                    if (device_type == UPDeviceType.BATTERY || device_id == this._primaryDeviceId) {
                        let labelText = "";

                        if (this._labelDisplay == LabelDisplay.PERCENT || time == 0) {
                            labelText = C_("percent of battery remaining", "%d%%").format(Math.round(percentage));
                        }
                        else if (this._labelDisplay == LabelDisplay.TIME) {
                            let seconds = time / 60;
                            let minutes = Math.floor(seconds % 60);
                            let hours = Math.floor(seconds / 60);
                            labelText = C_("time of battery remaining", "%d:%02d").format(hours,minutes);
                        }

                        this._mainLabel.set_text(labelText);
                        return;
                    }
                }
            }
            // Display disabled or no battery found... hot-unplugged?
            this._mainLabel.set_text("");
        }));
    }
    
};

function main(metadata, orientation, panel_height) {  
    let myApplet = new MyApplet(orientation, panel_height);
    return myApplet;      
}
