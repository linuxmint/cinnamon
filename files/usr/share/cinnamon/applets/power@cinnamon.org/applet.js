const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Interfaces = imports.misc.interfaces
const Lang = imports.lang;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const Pango = imports.gi.Pango;
const Main = imports.ui.main;
const Settings = imports.ui.settings;

const DimSettingsSchema = "org.cinnamon.settings-daemon.plugins.power";
const DimSettingsAc = "idle-dim-ac";
const DimSettingsBattery = "idle-dim-battery";
const BrightnessBusName = "org.cinnamon.SettingsDaemon.Power.Screen";
const KeyboardBusName = "org.cinnamon.SettingsDaemon.Power.Keyboard";

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

function DeviceItem() {
    this._init.apply(this, arguments);
}

DeviceItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(device) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, { reactive: false });

        let [device_id, device_type, icon, percentage, state, time, timepercentage] = device;

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

function BrightnessSlider(applet, label, icon, busName){
    this._init(applet, label, icon, busName);
}

BrightnessSlider.prototype = {
    __proto__: PopupMenu.PopupSliderMenuItem.prototype,

    _init: function(applet, label, icon, busName){
        PopupMenu.PopupSliderMenuItem.prototype._init.call(this, 0);
        this.actor.hide();

        this._applet = applet;
        this._seeking = false;

        this.connect("drag-begin", Lang.bind(this, function(){
            this._seeking = true;
        }));
        this.connect("drag-end", Lang.bind(this, function(){
            this._seeking = false;
        }));

        this.icon = new St.Icon({icon_name: icon, icon_type: St.IconType.SYMBOLIC, icon_size: 16});
        this.removeActor(this._slider);
        this.addActor(this.icon, {span: 0});
        this.addActor(this._slider, {span: -1, expand: true});

        this.label = label;
        this.toolTipText = label;
        this.tooltip = new Tooltips.Tooltip(this.actor, this.tooltipText);

        Interfaces.getDBusProxyAsync(busName, Lang.bind(this, function(proxy, error) {
            this._proxy = proxy;
            this._proxy.GetPercentageRemote(Lang.bind(this, this._dbusAcquired));
        }));
    },

    _dbusAcquired: function(b, error){
        if(error)
            return;

        this._updateBrightnessLabel(b);
        this.setValue(b / 100);
        this.connect("value-changed", Lang.bind(this, this._sliderChanged));

        this.actor.show();

        //get notified
        this._proxy.connectSignal('Changed', Lang.bind(this, this._getBrightness));
        this._applet.menu.connect("open-state-changed", Lang.bind(this, this._getBrightnessForcedUpdate));
    },

    _sliderChanged: function(slider, value) {
        this._setBrightness(Math.round(value * 100));
    },

    _getBrightness: function() {
        //This func is called when dbus signal is received.
        //Only update items value when slider is not used
        if (!this._seeking)
            this._getBrightnessForcedUpdate();
    },

    _getBrightnessForcedUpdate: function() {
        this._proxy.GetPercentageRemote(Lang.bind(this, function(b) {
            this._updateBrightnessLabel(b);
            this.setValue(b / 100);
        }));
    },

    _setBrightness: function(value) {
        this._proxy.SetPercentageRemote(value, Lang.bind(this, function(b) {
            this._updateBrightnessLabel(b);
        }));
    },

    _updateBrightnessLabel: function(value) {
        this.tooltipText = this.label;
        if(value)
            this.tooltipText += ": " + value + "%";

        this.tooltip.set_text(this.tooltipText);
        this._applet.updateTooltip();
    }
};

function MyApplet(metadata, orientation, panel_height, instanceId) {
    this._init(metadata, orientation, panel_height, instanceId);
}


MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instanceId) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instanceId);

        try {
            this.metadata = metadata;

            this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
            this.settings.bindProperty(Settings.BindingDirection.IN, "labelinfo", "labelinfo", Lang.bind(this, this._updateLabel), null);

            Main.systrayManager.registerRole("power", metadata.uuid);
            Main.systrayManager.registerRole("battery", metadata.uuid);

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            this.brightness = new BrightnessSlider(this, _("Brightness"), "display-brightness", BrightnessBusName);
            this.keyboard = new BrightnessSlider(this, _("Keyboard"), "keyboard-brightness", KeyboardBusName);
            this.menu.addMenuItem(this.brightness);
            this.menu.addMenuItem(this.keyboard);

            this._deviceItems = [ ];
            this._hasPrimary = false;
            this._primaryDeviceId = null;

            this._batteryItem = new PopupMenu.PopupMenuItem('', { reactive: false });
            this._primaryPercentage = new St.Label();
            this._batteryItem.addActor(this._primaryPercentage, { align: St.Align.END });
            this.menu.addMenuItem(this._batteryItem);

            this._otherDevicePosition = 3;

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let settingsMenu = new PopupMenu.PopupSubMenuMenuItem(_("Dimming settings"));

            let dimSwitchAc = this._buildItem(_("Dim screen on AC power"), DimSettingsSchema, DimSettingsAc);
            settingsMenu.menu.addMenuItem(dimSwitchAc);
            let dimSwitchBattery = this._buildItem(_("Dim screen on battery"), DimSettingsSchema, DimSettingsBattery);
            settingsMenu.menu.addMenuItem(dimSwitchBattery);

            this.menu.addMenuItem(settingsMenu);
            this.menu.addSettingsAction(_("Power Settings"), 'power');

            this.actor.connect("scroll-event", Lang.bind(this, this._onScrollEvent));

            Interfaces.getDBusProxyAsync("org.cinnamon.SettingsDaemon.Power", Lang.bind(this, function(proxy, error) {
                this._proxy = proxy;
                this._proxy.connect("g-properties-changed", Lang.bind(this, this._devicesChanged));
                this._devicesChanged();
            }));
        }
        catch (e) {
            global.logError(e);
        }
    },

    updateTooltip: function(){
        let tooltip = [];

        //show brightness and keyboard information in the tooltip only if they are also visible in the menu
        if(this.brightness.actor.visible)
            tooltip.push(this.brightness.tooltipText);

        if(this.keyboard.actor.visible)
            tooltip.push(this.keyboard.tooltipText);

        tooltip.push(this.tooltipText);

        this.set_applet_tooltip(tooltip.join("\n"));
    },

    _onButtonPressEvent: function(actor, event){
        //toggle keyboard brightness on middle click
        if(event.get_button() === 2){
            this.keyboard._proxy.ToggleRemote(function(){});
        }
        return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    _onScrollEvent: function(actor, event) {
        //adjust screen brightness on scroll
        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.UP) {
            this.brightness._proxy.StepUpRemote(function(){});
        } else if (direction == Clutter.ScrollDirection.DOWN) {
            this.brightness._proxy.StepDownRemote(function(){});
        }
        this.brightness._getBrightnessForcedUpdate();
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
                    this.tooltipText = timestring;
                    this.updateTooltip();
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
        this._proxy.GetDevicesRemote(Lang.bind(this, function(result, error) {
            this._deviceItems.forEach(function(i) { i.destroy(); });
            this._deviceItems = [];

            if (error) {
                return;
            }
            let devices = result[0];
            let position = 0;
            for (let i = 0; i < devices.length; i++) {
                let [device_id, device_type] = devices[i];

                if (this._hasPrimary == false) {
                    if (device_type == UPDeviceType.AC_POWER) {
                        this.tooltipText = _("AC adapter");
                        this.updateTooltip();
                    }
                    else if (device_type == UPDeviceType.BATTERY) {
                        this.tooltipText = _("Laptop battery");
                        this.updateTooltip();
                    }
                }

                if (device_type == UPDeviceType.AC_POWER || (this._hasPrimary && device_id == this._primaryDeviceId))
                    continue;

                let item = new DeviceItem (devices[i]);
                this._deviceItems.push(item);
                this.menu.addMenuItem(item, this._otherDevicePosition + position);
                position++;
            }
        }));
    },

    on_panel_height_changed: function() {
        if (this._proxy)
            this._devicesChanged();
    },

    _devicesChanged: function() {
        this._readPrimaryDevice();
        this._readOtherDevices();
        this._updateIcon();
        this._updateLabel();
    },

    _updateIcon: function(){
        let icon = this._proxy.Icon;
        if(icon){
            this.set_applet_icon_symbolic_name('battery-missing');
            let gicon = Gio.icon_new_for_string(icon);
            this._applet_icon.gicon = gicon;
        }
    },

    _updateLabel: function() {
        this._proxy.GetDevicesRemote(Lang.bind(this, function(results, error) {
            if (error) {
                this.set_applet_label("");
                return;
            }
            let devices = results[0];
            for (let i = 0; i < devices.length; i++) {
                let [device_id, device_type, icon, percentage, state, time] = devices[i];
                if (device_type == UPDeviceType.BATTERY || device_id == this._primaryDeviceId) {
                    let labelText = "";
                    if (this.labelinfo == "nothing") {
                        ;
                    }
                    else if (this.labelinfo == "time" && time != 0) {
                        let seconds = Math.round(time / 60);
                        let minutes = Math.floor(seconds % 60);
                        let hours = Math.floor(seconds / 60);
                        labelText = C_("time of battery remaining", "%d:%02d").format(hours,minutes);
                    }
                    else if (this.labelinfo == "percentage" ||
                             (this.labelinfo == "percentage_time" && time == 0)) {
                        labelText = C_("percent of battery remaining", "%d%%").format(Math.round(percentage));
                    }

                    else if (this.labelinfo == "percentage_time") {
                        let seconds = Math.round(time / 60);
                        let minutes = Math.floor(seconds % 60);
                        let hours = Math.floor(seconds / 60);
                        labelText = C_("percent of battery remaining", "%d%%").format(Math.round(percentage)) + " (" +
                                    C_("time of battery remaining", "%d:%02d").format(hours,minutes) + ")";
                    }
                    this.set_applet_label(labelText);
                    if (device_id == this._primaryDeviceId) {
                        return;
                    }
                }
            }
        }));
    },

    on_applet_removed_from_panel: function() {
        Main.systrayManager.unregisterId(this.metadata.uuid);
    },

    /* both methods are taken from a11y@cinnamon.org */
    _buildItem: function(string, schema, key) {
        let settings = new Gio.Settings({ schema: schema });
        let widget = this._buildItemExtended(string,
            settings.get_boolean(key),
            settings.is_writable(key),
            function(enabled) {
                return settings.set_boolean(key, enabled);
            });
        settings.connect('changed::'+key, function() {
            widget.setToggleState(settings.get_boolean(key));
        });
        return widget;
    },

    _buildItemExtended: function(string, initial_value, writable, on_set) {
        let widget = new PopupMenu.PopupSwitchMenuItem(string, initial_value);
        if (!writable)
            widget.actor.reactive = false;
        else
            widget.connect('toggled', function(item) {
                on_set(item.state);
            });
        return widget;
    }
};

function main(metadata, orientation, panel_height, instanceId) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instanceId);
    return myApplet;
}
