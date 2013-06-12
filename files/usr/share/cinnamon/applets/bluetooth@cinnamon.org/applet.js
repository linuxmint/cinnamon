const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const GnomeBluetoothApplet = imports.gi.GnomeBluetoothApplet;
const GnomeBluetooth = imports.gi.GnomeBluetooth;
const Lang = imports.lang;
const St = imports.gi.St;
var ABI=6;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;

const ConnectionState = {
    DISCONNECTED: 0,
    CONNECTED: 1,
    DISCONNECTING: 2,
    CONNECTING: 3
}

 if (!GnomeBluetooth.hasOwnProperty('KillswitchState')){
     ABI=4;
}

function Source() {
    this._init.apply(this, arguments);
}

Source.prototype = {
    __proto__: MessageTray.Source.prototype,

    _init: function() {
        MessageTray.Source.prototype._init.call(this, _("Bluetooth"));

        this._setSummaryIcon(this.createNotificationIcon());
    },

    notify: function(notification) {
        this._private_destroyId = notification.connect('destroy', Lang.bind(this, function(notification) {
            if (this.notification == notification) {
                // the destroyed notification is the last for this source
                this.notification.disconnect(this._private_destroyId);
                this.destroy();
            }
        }));

        MessageTray.Source.prototype.notify.call(this, notification);
    },

    createNotificationIcon: function() {
        return new St.Icon({ icon_name: 'bluetooth-active',
                             icon_type: St.IconType.SYMBOLIC,
                             icon_size: this.ICON_SIZE });
    }
}

function AuthNotification() {
    this._init.apply(this, arguments);
}

AuthNotification.prototype = {
    __proto__: MessageTray.Notification.prototype,

    _init: function(source, applet, device_path, name, long_name, uuid) {
        MessageTray.Notification.prototype._init.call(this,
                                                      source,
                                                      _("Bluetooth"),
                                                      _("Authorization request from %s").format(name),
                                                      { customContent: true });
        this.setResident(true);

        this._applet = applet;
        this._devicePath = device_path;
        this.addBody(_("Device %s wants access to the service '%s'").format(long_name, uuid));

        this.addButton('always-grant', _("Always grant access"));
        this.addButton('grant', _("Grant this time only"));
        this.addButton('reject', _("Reject"));

        this.connect('action-invoked', Lang.bind(this, function(self, action) {
            switch (action) {
            case 'always-grant':
                this._applet.agent_reply_auth(this._devicePath, true, true);
                break;
            case 'grant':
                this._applet.agent_reply_auth(this._devicePath, true, false);
                break;
            case 'reject':
            default:
                this._applet.agent_reply_auth(this._devicePath, false, false);
            }
            this.destroy();
        }));
    }
}

function ConfirmNotification() {
    this._init.apply(this, arguments);
}

ConfirmNotification.prototype = {
    __proto__: MessageTray.Notification.prototype,

    _init: function(source, applet, device_path, name, long_name, pin) {
        MessageTray.Notification.prototype._init.call(this,
                                                      source,
                                                      _("Bluetooth"),
                                                      _("Pairing confirmation for %s").format(name),
                                                      { customContent: true });
        this.setResident(true);

        this._applet = applet;
        this._devicePath = device_path;
        this.addBody(_("Device %s wants to pair with this computer").format(long_name));
        this.addBody(_("Please confirm whether the PIN '%s' matches the one on the device.").format(pin));

        this.addButton('matches', _("Matches"));
        this.addButton('does-not-match', _("Does not match"));

        this.connect('action-invoked', Lang.bind(this, function(self, action) {
            if (action == 'matches')
                this._applet.agent_reply_confirm(this._devicePath, true);
            else
                this._applet.agent_reply_confirm(this._devicePath, false);
            this.destroy();
        }));
    }
}

function PinNotification() {
    this._init.apply(this, arguments);
}

PinNotification.prototype = {
    __proto__: MessageTray.Notification.prototype,

    _init: function(source, applet, device_path, name, long_name, numeric) {
        MessageTray.Notification.prototype._init.call(this,
                                                      source,
                                                      _("Bluetooth"),
                                                      _("Pairing request for %s").format(name),
                                                      { customContent: true });
        this.setResident(true);

        this._applet = applet;
        this._devicePath = device_path;
        this._numeric = numeric;
        this.addBody(_("Device %s wants to pair with this computer").format(long_name));
        this.addBody(_("Please enter the PIN mentioned on the device."));

        this._entry = new St.Entry();
        this._entry.connect('key-release-event', Lang.bind(this, function(entry, event) {
            let key = event.get_key_symbol();
            if (key == Clutter.KEY_Return) {
                this.emit('action-invoked', 'ok');
                return true;
            } else if (key == Clutter.KEY_Escape) {
                this.emit('action-invoked', 'cancel');
                return true;
            }
            return false;
        }));
        this.addActor(this._entry);

        this.addButton('ok', _("OK"));
        this.addButton('cancel', _("Cancel"));

        this.connect('action-invoked', Lang.bind(this, function(self, action) {
            if (action == 'ok') {
                if (this._numeric) {
                    let num = parseInt(this._entry.text);
                    if (isNaN(num)) {
                        // user reply was empty, or was invalid
                        // cancel the operation
                        num = -1;
                    }
                    this._applet.agent_reply_passkey(this._devicePath, num);
                } else
                    this._applet.agent_reply_pincode(this._devicePath, this._entry.text);
            } else {
                if (this._numeric)
                    this._applet.agent_reply_passkey(this._devicePath, -1);
                else
                    this._applet.agent_reply_pincode(this._devicePath, null);
            }
            this.destroy();
        }));
    },

    grabFocus: function(lockTray) {
        MessageTray.Notification.prototype.grabFocus.call(this, lockTray);
        global.stage.set_key_focus(this._entry);
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
            
            this.set_applet_icon_symbolic_name('bluetooth-disabled');
            this.set_applet_tooltip(_("Bluetooth"));
                        
            GLib.spawn_command_line_sync ('pkill -f "^bluetooth-applet$"');
            this._applet = new GnomeBluetoothApplet.Applet();
            this._killswitch = new PopupMenu.PopupSwitchMenuItem(_("Bluetooth"), false);
            this._applet.connect('notify::killswitch-state', Lang.bind(this, this._updateKillswitch));
            this._killswitch.connect('toggled', Lang.bind(this, function() {
                let current_state = this._applet.killswitch_state;
		if (ABI==6){
			if (current_state != GnomeBluetooth.KillswitchState.HARD_BLOCKED &&
			    current_state != GnomeBluetooth.KillswitchState.NO_ADAPTER) {
			    this._applet.killswitch_state = this._killswitch.state ?
				GnomeBluetooth.KillswitchState.UNBLOCKED:
			        GnomeBluetooth.KillswitchState.SOFT_BLOCKED;
			} else
				this._killswitch.setToggleState(false);
		} else {
			if (current_state != GnomeBluetoothApplet.KillswitchState.HARD_BLOCKED &&
			    current_state != GnomeBluetoothApplet.KillswitchState.NO_ADAPTER) {
			    this._applet.killswitch_state = this._killswitch.state ?
				GnomeBluetoothApplet.KillswitchState.UNBLOCKED:
			        GnomeBluetoothApplet.KillswitchState.SOFT_BLOCKED;
			} else
				this._killswitch.setToggleState(false);
		}
		global.logError(this._killswitch.state)
            }));

            this._discoverable = new PopupMenu.PopupSwitchMenuItem(_("Visibility"), this._applet.discoverable);
            this._applet.connect('notify::discoverable', Lang.bind(this, function() {
                this._discoverable.setToggleState(this._applet.discoverable);
            }));
            this._discoverable.connect('toggled', Lang.bind(this, function() {
                this._applet.discoverable = this._discoverable.state;
            }));

            this._updateKillswitch();
            this.menu.addMenuItem(this._killswitch);
            this.menu.addMenuItem(this._discoverable);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            this._fullMenuItems = [new PopupMenu.PopupSeparatorMenuItem(),
                                   new PopupMenu.PopupMenuItem(_("Send Files to Device...")),
                                   new PopupMenu.PopupMenuItem(_("Set up a New Device...")),
                                   new PopupMenu.PopupSeparatorMenuItem()];
            this._hasDevices = false;

            this._fullMenuItems[1].connect('activate', function() {
                GLib.spawn_command_line_async('bluetooth-sendto');
            });
            this._fullMenuItems[2].connect('activate', function() {
                GLib.spawn_command_line_async('bluetooth-wizard');
            });

            for (let i = 0; i < this._fullMenuItems.length; i++) {
                let item = this._fullMenuItems[i];
                this.menu.addMenuItem(item);
            }

            this._deviceItemPosition = 3;
            this._deviceItems = [];
            this._applet.connect('devices-changed', Lang.bind(this, this._updateDevices));
            this._updateDevices();

            this._applet.connect('notify::show-full-menu', Lang.bind(this, this._updateFullMenu));
            this._updateFullMenu();

            this.menu.addSettingsAction(_("Bluetooth Settings"), 'bluetooth');

            this._applet.connect('pincode-request', Lang.bind(this, this._pinRequest));
            this._applet.connect('confirm-request', Lang.bind(this, this._confirmRequest));
            this._applet.connect('auth-request', Lang.bind(this, this._authRequest));
            this._applet.connect('cancel-request', Lang.bind(this, this._cancelRequest));     
                      
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },
    
   
    _updateKillswitch: function() {
        let current_state = this._applet.killswitch_state;
	let on;
	let has_adapter;
	let can_toggle;
	if (ABI==6){
		on = current_state == GnomeBluetooth.KillswitchState.UNBLOCKED;
		has_adapter = current_state != GnomeBluetooth.KillswitchState.NO_ADAPTER;
		can_toggle = current_state != GnomeBluetooth.KillswitchState.NO_ADAPTER &&
			         current_state != GnomeBluetooth.KillswitchState.HARD_BLOCKED;
	} else {
		on = current_state == GnomeBluetoothApplet.KillswitchState.UNBLOCKED;
		has_adapter = current_state != GnomeBluetoothApplet.KillswitchState.NO_ADAPTER;
		can_toggle = current_state != GnomeBluetoothApplet.KillswitchState.NO_ADAPTER &&
			         current_state != GnomeBluetoothApplet.KillswitchState.HARD_BLOCKED;
	}
        this._killswitch.setToggleState(on);
        if (can_toggle)
            this._killswitch.setStatus(null);
        else
            /* TRANSLATORS: this means that bluetooth was disabled by hardware rfkill */
            this._killswitch.setStatus(_("hardware disabled"));

        if (has_adapter)
            this.actor.show();
        else
            this.actor.hide();

        if (on) {
            this._discoverable.actor.show();
            this.set_applet_icon_symbolic_name('bluetooth-active');
        } else {
            this._discoverable.actor.hide();
            this.set_applet_icon_symbolic_name('bluetooth-disabled');
        }
    },

    _updateDevices: function() {
        let devices = this._applet.get_devices();

        let newlist = [ ];
        for (let i = 0; i < this._deviceItems.length; i++) {
            let item = this._deviceItems[i];
            let destroy = true;
            for (let j = 0; j < devices.length; j++) {
                if (item._device.device_path == devices[j].device_path) {
                    this._updateDeviceItem(item, devices[j]);
                    destroy = false;
                    break;
                }
            }
            if (destroy)
                item.destroy();
            else
                newlist.push(item);
        }

        this._deviceItems = newlist;
        this._hasDevices = newlist.length > 0;
        for (let i = 0; i < devices.length; i++) {
            let d = devices[i];
            if (d._item)
                continue;
            let item = this._createDeviceItem(d);
            if (item) {
                this.menu.addMenuItem(item, this._deviceItemPosition + this._deviceItems.length);
                this._deviceItems.push(item);
                this._hasDevices = true;
            }
        }
    },

    _updateDeviceItem: function(item, device) {
        if (!device.can_connect && device.capabilities == GnomeBluetoothApplet.Capabilities.NONE) {
            item.destroy();
            return;
        }

        let prevDevice = item._device;
        let prevCapabilities = prevDevice.capabilities;
        let prevCanConnect = prevDevice.can_connect;

        // adopt the new device object
        item._device = device;
        device._item = item;

        // update properties
        item.label.text = device.alias;

        if (prevCapabilities != device.capabilities ||
            prevCanConnect != device.can_connect) {
            // need to rebuild the submenu
            item.menu.removeAll();
            this._buildDeviceSubMenu(item, device);
        }

        // update connected property
        if (device.can_connect)
            item._connectedMenuitem.setToggleState(device.connected);
    },

    _createDeviceItem: function(device) {
        if (!device.can_connect && device.capabilities == GnomeBluetoothApplet.Capabilities.NONE)
            return null;
        let item = new PopupMenu.PopupSubMenuMenuItem(device.alias);

        // adopt the device object, and add a back link
        item._device = device;
        device._item = item;

        this._buildDeviceSubMenu(item, device);

        return item;
    },

    _buildDeviceSubMenu: function(item, device) {
        if (device.can_connect) {
            item._connected = device.connected;
            item._connectedMenuitem = new PopupMenu.PopupSwitchMenuItem(_("Connection"), device.connected);
            item._connectedMenuitem.connect('toggled', Lang.bind(this, function() {
                if (item._connected > ConnectionState.CONNECTED) {
                    // operation already in progress, revert
                    // (should not happen anyway)
                    menuitem.setToggleState(menuitem.state);
                }
                if (item._connected) {
                    item._connected = ConnectionState.DISCONNECTING;
                    menuitem.setStatus(_("disconnecting..."));
                    this._applet.disconnect_device(item._device.device_path, function(applet, success) {
                        if (success) { // apply
                            item._connected = ConnectionState.DISCONNECTED;
                            menuitem.setToggleState(false);
                        } else { // revert
                            item._connected = ConnectionState.CONNECTED;
                            menuitem.setToggleState(true);
                        }
                        menuitem.setStatus(null);
                    });
                } else {
                    item._connected = ConnectionState.CONNECTING;
                    menuitem.setStatus(_("connecting..."));
                    this._applet.connect_device(item._device.device_path, function(applet, success) {
                        if (success) { // apply
                            item._connected = ConnectionState.CONNECTED;
                            menuitem.setToggleState(true);
                        } else { // revert
                            item._connected = ConnectionState.DISCONNECTED;
                            menuitem.setToggleState(false);
                        }
                        menuitem.setStatus(null);
                    });
                }
            }));

            item.menu.addMenuItem(item._connectedMenuitem);
        }

        if (device.capabilities & GnomeBluetoothApplet.Capabilities.OBEX_PUSH) {
            item.menu.addAction(_("Send Files..."), Lang.bind(this, function() {
                this._applet.send_to_address(device.bdaddr, device.alias);
            }));
        }
        if (device.capabilities & GnomeBluetoothApplet.Capabilities.OBEX_FILE_TRANSFER) {
            item.menu.addAction(_("Browse Files..."), Lang.bind(this, function(event) {
                this._applet.browse_address(device.bdaddr, event.get_time(),
                    Lang.bind(this, function(applet, result) {
                        try {
                            applet.browse_address_finish(result);
                        } catch (e) {
                            this._ensureSource();
                            this._source.notify(new MessageTray.Notification(this._source,
                                 _("Bluetooth"),
                                 _("Error browsing device"),
                                 { body: _("The requested device cannot be browsed, error is '%s'").format(e) }));
                        }
                    }));
            }));
        }

        switch (device.type) {
        case GnomeBluetoothApplet.Type.KEYBOARD:
            item.menu.addSettingsAction(_("Keyboard Settings"), 'keyboard');
            break;
        case GnomeBluetoothApplet.Type.MOUSE:
            item.menu.addSettingsAction(_("Mouse Settings"), 'mouse');
            break;
        case GnomeBluetoothApplet.Type.HEADSET:
        case GnomeBluetoothApplet.Type.HEADPHONES:
        case GnomeBluetoothApplet.Type.OTHER_AUDIO:
            item.menu.addSettingsAction(_("Sound Settings"), 'sound');
            break;
        default:
            break;
        }
    },

    _updateFullMenu: function() {
        if (this._applet.show_full_menu) {
            this._showAll(this._fullMenuItems);
            if (this._hasDevices)
                this._showAll(this._deviceItems);
        } else {
            this._hideAll(this._fullMenuItems);
            this._hideAll(this._deviceItems);
        }
    },

    _showAll: function(items) {
        for (let i = 0; i < items.length; i++)
            items[i].actor.show();
    },

    _hideAll: function(items) {
        for (let i = 0; i < items.length; i++)
            items[i].actor.hide();
    },

    _destroyAll: function(items) {
        for (let i = 0; i < items.length; i++)
            items[i].destroy();
    },

    _ensureSource: function() {
        if (!this._source) {
            this._source = new Source();
            if (Main.messageTray) Main.messageTray.add(this._source);
        }
    },

    _authRequest: function(applet, device_path, name, long_name, uuid) {
        this._ensureSource();
        this._source.notify(new AuthNotification(this._source, this._applet, device_path, name, long_name, uuid));
    },

    _confirmRequest: function(applet, device_path, name, long_name, pin) {
        this._ensureSource();
        this._source.notify(new ConfirmNotification(this._source, this._applet, device_path, name, long_name, pin));
    },

    _pinRequest: function(applet, device_path, name, long_name, numeric) {
        this._ensureSource();
        this._source.notify(new PinNotification(this._source, this._applet, device_path, name, long_name, numeric));
    },

    _cancelRequest: function() {
        this._source.destroy();
    }
};

function main(metadata, orientation, panel_height) {  
    let myApplet = new MyApplet(orientation, panel_height);
    return myApplet;      
}
