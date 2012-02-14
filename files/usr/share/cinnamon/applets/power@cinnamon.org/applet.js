const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const DBus = imports.dbus;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;
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

function MyMenu(launcher, orientation) {
    this._init(launcher, orientation);
}

MyMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,
    
    _init: function(launcher, orientation) {
        this._launcher = launcher;        
                
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();            
    }
}

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation) {        
        Applet.TextIconApplet.prototype._init.call(this, orientation);
        
        try {                                
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new MyMenu(this, orientation);
            this.menuManager.addMenu(this.menu);            
            
            this.set_applet_icon_symbolic_name('battery-missing');            
            this._proxy = new PowerManagerProxy(DBus.session, BUS_NAME, OBJECT_PATH);
            
            let icon = this.actor.get_children()[0];
            this.actor.remove_actor(icon);
            let box = new St.BoxLayout({ name: 'batteryBox' });
            this.actor.add_actor(box);
            let iconBox = new St.Bin();
            box.add(iconBox, { y_align: St.Align.MIDDLE, y_fill: false });
            this._mainLabel = new St.Label();
            box.add(this._mainLabel, { y_align: St.Align.MIDDLE, y_fill: false });
            iconBox.child = icon;

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
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
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
        this._updateLabel();
    },
    
    _updateLabel: function() {
        this._proxy.GetDevicesRemote(Lang.bind(this, function(devices, error) {
            if (error) {
                this._mainLabel.set_text("");
                return;
            }
            for (let i = 0; i < devices.length; i++) {
                let [device_id, device_type, icon, percentage, state, time] = devices[i];
                if (device_type == UPDeviceType.BATTERY || device_id == this._primaryDeviceId) {
                    let percentageText = C_("percent of battery remaining", "%d%%").format(Math.round(percentage));
                    this._mainLabel.set_text(percentageText);
                    return;
                }
            }
            // no battery found... hot-unplugged?
            this._mainLabel.set_text("");
        }));
    }
    
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
