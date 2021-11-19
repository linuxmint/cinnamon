const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Interfaces = imports.misc.interfaces
const Lang = imports.lang;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const Settings = imports.ui.settings;

const BrightnessBusName = "org.cinnamon.SettingsDaemon.Power.Screen";
const KeyboardBusName = "org.cinnamon.SettingsDaemon.Power.Keyboard";

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";
// TODO: why aren't we using introspection - upower-glib?
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

const UPDeviceLevel = {
    UNKNOWN: 0,
    NONE: 1,
    LOW: 3,
    CRITICAL: 4,
    NORMAL: 6,
    HIGH: 7,
    FULL: 8
};

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

function deviceTypeToString(type) {
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

function deviceToIcon(type, icon) {
    switch (type) {
        case UPDeviceType.MONITOR:
            return ("video-display");
        case UPDeviceType.MOUSE:
            return ("input-mouse");
        case UPDeviceType.KEYBOARD:
            return ("input-keyboard");
        case UPDeviceType.PHONE:
        case UPDeviceType.MEDIA_PLAYER:
            return ("phone-apple-iphone");
        case UPDeviceType.TABLET:
            return ("input-tablet");
        case UPDeviceType.COMPUTER:
            return ("computer");
        default:
            if (icon) {
                return icon;
            }
            else {
                return ("battery-full");
            }
    }
}

function reportsPreciseLevels(battery_level)
{
    return battery_level == UPDeviceLevel.NONE;
}

class DeviceItem extends PopupMenu.PopupBaseMenuItem {
    constructor(device, status, aliases) {
        super({reactive: false});

        let [device_id, vendor, model, device_type, icon, percentage, state, battery_level, time] = device;

        this._box = new St.BoxLayout({ style_class: 'popup-device-menu-item' });
        this._vbox = new St.BoxLayout({ style_class: 'popup-device-menu-item', vertical: true});

        let description = deviceTypeToString(device_type);
        if (vendor != "" || model != "") {
            description = "%s %s".format(vendor, model);
        }

        for ( let i = 0; i < aliases.length; ++i ) {
            let alias = aliases[i];
            try{
                let parts = alias.split(':=');
                if (parts[0] == device_id) {
                    description = parts[1];
                }
            }
            catch(e) {
                // ignore malformed aliases
                global.logError(alias);
            }
        }

        let statusLabel = null;

        if (battery_level == UPDeviceLevel.NONE) {
            this.label = new St.Label({ text: "%s %d%%".format(description, Math.round(percentage)) });
            statusLabel = new St.Label({ text: "%s".format(status), style_class: 'popup-inactive-menu-item' });
        } else {
            this.label = new St.Label({ text: "%s".format(description) });
            statusLabel = new St.Label({ text: "%s".format(deviceLevelToString(battery_level)), style_class: 'popup-inactive-menu-item' });
        }

        let device_icon = deviceToIcon(device_type, icon);
        if (device_icon == icon) {
            this._icon = new St.Icon({ gicon: Gio.icon_new_for_string(icon), icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
        }
        else {
            this._icon = new St.Icon({icon_name: device_icon, icon_type: St.IconType.SYMBOLIC, icon_size: 16});
        }

        this._box.add_actor(this._icon);
        this._box.add_actor(this.label);

        this._vbox.add_actor(this._box);
        this._vbox.add_actor(statusLabel);

        this.addActor(this._vbox);

    }
}

class BrightnessSlider extends PopupMenu.PopupSliderMenuItem {
    constructor(applet, label, icon, busName, minimum_value) {
        super(0);
        this.actor.hide();

        this._applet = applet;
        this._seeking = false;
        this._minimum_value = minimum_value;
        this._step = .05;

        this.connect("drag-begin", Lang.bind(this, function() {
            this._seeking = true;
        }));
        this.connect("drag-end", Lang.bind(this, function() {
            this._seeking = false;
        }));

        this.icon = new St.Icon({icon_name: icon, icon_type: St.IconType.SYMBOLIC, icon_size: 16});
        this.removeActor(this._slider);
        this.addActor(this.icon, {span: 0});
        this.addActor(this._slider, {span: -1, expand: true});

        this.label = label;
        this.tooltipText = label;
        this.tooltip = new Tooltips.Tooltip(this.actor, this.tooltipText);

        Interfaces.getDBusProxyAsync(busName, Lang.bind(this, function(proxy, error) {
            this._proxy = proxy;
            this._proxy.GetPercentageRemote(Lang.bind(this, this._dbusAcquired));

            try {
                this._proxy.GetStepRemote((step) => {
                    this._step = (step / 100);
                });
            } catch(e) {
                this._step = .05;
            }
        }));
    }

    _dbusAcquired(b, error) {
        if(error)
            return;

        this._updateBrightnessLabel(b);
        this.setValue(b / 100);
        this.connect("value-changed", Lang.bind(this, this._sliderChanged));

        this.actor.show();

        //get notified
        this._proxy.connectSignal('Changed', Lang.bind(this, this._getBrightness));
        this._applet.menu.connect("open-state-changed", Lang.bind(this, this._getBrightnessForcedUpdate));
    }

    _sliderChanged(slider, value) {
        if (value < this._minimum_value) {
            value = this._minimum_value;
        }

        let i = this._minimum_value;
        let v = value;
        let step = this._step;

        while (i < 1.0) {
            if (v > (i + step)) {
                i = i + step;
                continue;
            }

            if (((i + step) - v) < (v - i)) {
                v = i + step;
            } else {
                v = i;
            }

            break;
        }

        this.setValue(v);

        // A non-zero minimum brightness can cause our stepped value
        // to exceed 100, making the slider jitter (because c-s-d rejects
        // the value)
        this._setBrightness(Math.min(100, Math.round(v * 100)));
    }

    _getBrightness() {
        //This func is called when dbus signal is received.
        //Only update items value when slider is not used
        if (!this._seeking)
            this._getBrightnessForcedUpdate();
    }

    _getBrightnessForcedUpdate() {
        this._proxy.GetPercentageRemote(Lang.bind(this, function(b) {
            this._updateBrightnessLabel(b);
            this.setValue(b / 100);
        }));
    }

    _setBrightness(value) {
        this._proxy.SetPercentageRemote(value, Lang.bind(this, function(b) {
            this._updateBrightnessLabel(b);
        }));
    }

    _updateBrightnessLabel(value) {
        this.tooltipText = this.label;
        if(value)
            this.tooltipText += ": " + value + "%";

        this.tooltip.set_text(this.tooltipText);
    }

    /* Overriding PopupSliderMenuItem so we can modify the scroll step */
    _onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();

        if (direction == Clutter.ScrollDirection.DOWN) {
            this._value = Math.max(0, this._value - this._step);
        }
        else if (direction == Clutter.ScrollDirection.UP) {
            this._value = Math.min(1, this._value + this._step);
        }

        this._slider.queue_repaint();
        this.emit('value-changed', this._value);
    }
}

class CinnamonPowerApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.metadata = metadata;

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);

        Main.systrayManager.registerRole("power", metadata.uuid);
        Main.systrayManager.registerRole("battery", metadata.uuid);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.aliases = global.settings.get_strv("device-aliases");

        this._deviceItems = [ ];
        this._devices = [ ];
        this._primaryDeviceId = null;
        this.panel_icon_name = ''; // remember the panel icon name (so we only set it when it actually changes)

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.brightness = new BrightnessSlider(this, _("Brightness"), "display-brightness", BrightnessBusName, 0.01);
        this.keyboard = new BrightnessSlider(this, _("Keyboard backlight"), "keyboard-brightness", KeyboardBusName, 0);
        this.menu.addMenuItem(this.brightness);
        this.menu.addMenuItem(this.keyboard);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this.menu.addSettingsAction(_("Power Settings"), 'power');

        this.actor.connect("scroll-event", Lang.bind(this, this._onScrollEvent));

        this._proxy = null;

        global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._onPanelEditModeChanged));

        Interfaces.getDBusProxyAsync("org.cinnamon.SettingsDaemon.Power", Lang.bind(this, function(proxy, error) {
            this._proxy = proxy;

            this._proxy.connect("g-properties-changed", Lang.bind(this, this._devicesChanged));
            global.settings.connect('changed::device-aliases', Lang.bind(this, this._on_device_aliases_changed));
            this.settings.bind("labelinfo", "labelinfo", this._devicesChanged);
            this.settings.bind("showmulti", "showmulti", this._devicesChanged);

            this._devicesChanged();
        }));

        this.set_show_label_in_vertical_panels(false);
    }

    _onPanelEditModeChanged() {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            if (!this.actor.visible) {
                this.set_applet_icon_symbolic_name("battery-missing");
                this.set_applet_enabled(true);
            }
        }
        else {
            this._devicesChanged();
        }
    }

    _on_device_aliases_changed() {
        this.aliases = global.settings.get_strv("device-aliases");
        this._devicesChanged();
    }

    _onButtonPressEvent(actor, event) {
        //toggle keyboard brightness on middle click
        if(event.get_button() === 2) {
            this.keyboard._proxy.ToggleRemote(function() {});
        }
        return Applet.Applet.prototype._onButtonPressEvent.call(this, actor, event);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    _onScrollEvent(actor, event) {
        //adjust screen brightness on scroll
        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.UP) {
            this.brightness._proxy.StepUpRemote(function() {});
        } else if (direction == Clutter.ScrollDirection.DOWN) {
            this.brightness._proxy.StepDownRemote(function() {});
        }
        this.brightness._getBrightnessForcedUpdate();
    }

    _getDeviceStatus(device) {
        let status = ""
        let [device_id, vendor, model, device_type, icon, percentage, state, battery_level, seconds] = device;

        let time = Math.round(seconds / 60);
        let minutes = time % 60;
        let hours = Math.floor(time / 60);

        if (state == UPDeviceState.CHARGING) {
            if (time == 0) {
                status = _("Charging");
            }
            else if (time > 60) {
                if (minutes == 0) {
                    status = ngettext("Charging - %d hour until fully charged", "Charging - %d hours until fully charged", hours).format(hours);
                }
                else {
                    /* TRANSLATORS: this is a time string, as in "%d hours %d minutes remaining" */
                    let template = _("Charging - %d %s %d %s until fully charged");
                    status = template.format (hours, ngettext("hour", "hours", hours), minutes, ngettext("minute", "minutes", minutes));
                }
            }
            else {
                status = ngettext("Charging - %d minute until fully charged", "Charging - %d minutes until fully charged", minutes).format(minutes);
            }
        }
        else if (state == UPDeviceState.FULLY_CHARGED) {
            status = _("Fully charged");
        }
        else {
            if (time == 0) {
                status = _("Using battery power");
            }
            else if (time > 60) {
                if (minutes == 0) {
                    status = ngettext("Using battery power - %d hour remaining", "Using battery power - %d hours remaining", hours).format(hours);
                }
                else {
                    /* TRANSLATORS: this is a time string, as in "%d hours %d minutes remaining" */
                    let template = _("Using battery power - %d %s %d %s remaining");
                    status = template.format (hours, ngettext("hour", "hours", hours), minutes, ngettext("minute", "minutes", minutes));
                }
            }
            else {
                status = ngettext("Using battery power - %d minute remaining", "Using battery power - %d minutes remaining", minutes).format(minutes);
            }
        }

        return status;
    }

    on_panel_height_changed() {
        if (this._proxy)
            this._devicesChanged();
    }

    showDeviceInPanel(device) {
        let [device_id, vendor, model, device_type, icon, percentage, state, battery_level, seconds] = device;
        let status = this._getDeviceStatus(device);
        this.set_applet_tooltip(status);
        let labelText = "";
        if (this.labelinfo == "nothing") {
            ;
        }
        else if (this.labelinfo == "time" && seconds != 0) {
            let time = Math.round(seconds / 60);
            let minutes = time % 60;
            let hours = Math.floor(time / 60);
            labelText = C_("time of battery remaining", "%d:%02d").format(hours, minutes);
        }
        else if (this.labelinfo == "percentage" || (this.labelinfo == "percentage_time" && seconds == 0)) {
            labelText = C_("percent of battery remaining", "%d%%").format(Math.round(percentage));
        }
        else if (this.labelinfo == "percentage_time") {
            let time = Math.round(seconds / 60);
            let minutes = Math.floor(time % 60);
            let hours = Math.floor(time / 60);
            labelText = C_("percent of battery remaining", "%d%%").format(Math.round(percentage)) + " (" +
                C_("time of battery remaining", "%d:%02d").format(hours, minutes) + ")";
        }
        this.set_applet_label(labelText);

        if (icon) {
            if(this.panel_icon_name != icon) {
                this.panel_icon_name = icon;
                this.set_applet_icon_symbolic_name('battery-full');
                let gicon = Gio.icon_new_for_string(icon);
                this._applet_icon.gicon = gicon;
            }
        }
        else {
            if (this.panel_icon_name != 'battery-full') {
                this.panel_icon_name = 'battery-full';
                this.set_applet_icon_symbolic_name('battery-full');
            }
        }

        this._applet_icon.set_style_class_name ('system-status-icon');
    }

    _devicesChanged() {

        this._devices = [];
        this._primaryDevice = null;
        this._primaryDeviceId = null;

        if (!this._proxy)
            return;

        // Identify the primary battery device
        this._proxy.GetPrimaryDeviceRemote(Lang.bind(this, function(device, error) {
            if (error) {
                this._primaryDeviceId = null;
            }
            else {
                if (device.length == 1) {
                    // Primary Device can be an array of primary devices rather than a single device, in that case, take the first one.
                    device = device[0];
                }
                let [device_id, vendor, model, device_type, icon, percentage, state, battery_level, seconds] = device
                this._primaryDeviceId = device_id;
            }

            // Scan battery devices
            this._proxy.GetDevicesRemote(Lang.bind(this, function(result, error) {
                this._deviceItems.forEach(function(i) { i.destroy(); });
                this._deviceItems = [];
                let devices_stats = [];
                let pct_support_count = 0;

                if (!error) {
                    let devices = result[0];
                    let position = 0;
                    for (let i = 0; i < devices.length; i++) {
                        let [device_id, vendor, model, device_type, icon, percentage, state, battery_level, seconds] = devices[i];

                        // Ignore AC_POWER devices
                        if (device_type == UPDeviceType.AC_POWER)
                            continue;

                        // Ignore devices which state is unknown
                        if (state == UPDeviceState.UNKNOWN)
                            continue;

                        if (reportsPreciseLevels(battery_level)) {
                            // Devices that give accurate % charge will return this for battery level.
                            pct_support_count++;
                        }

                        let stats = "%s (%d%%)".format(deviceTypeToString(device_type), percentage);
                        devices_stats.push(stats);
                        this._devices.push(devices[i]);

                        if (this._primaryDeviceId == null || this._primaryDeviceId == device_id) {
                            // Info for the primary battery (either the primary device, or any battery device if there is no primary device)
                            if (device_type == UPDeviceType.BATTERY && this._primaryDevice == null) {
                                this._primaryDevice = devices[i];
                            }
                        }

                        let status = this._getDeviceStatus(devices[i]);
                        let item = new DeviceItem (devices[i], status, this.aliases);
                        this.menu.addMenuItem(item, position);
                        this._deviceItems.push(item);
                        position++;
                    }
                }
                else {
                    global.log(error);
                }

                // The menu is built. Below, we update the information present in the panel (icon, tooltip and label)
                this.set_applet_enabled(true);
                let panel_device = null;

                // Things should only ever be in the panel if they provide accurate reporting (percentages), otherwise
                // they're probably not likely to drain quickly enough to merit showing except on demand, in the popup menu.

                // One or more devices, one is a real battery, and multi-device is disabled
                if (this._primaryDevice != null && (!this.showmulti || (this._devices.length === 1) && pct_support_count === 1)) {
                    this.showDeviceInPanel(this._primaryDevice);
                }
                else {
                    // One device, not marked primary, but has accurate reporting (not sure this will ever happen).
                    if (this._devices.length === 1 && pct_support_count === 1) {
                        this.showDeviceInPanel(this._devices[0]);
                    }
                    else if (this._devices.length > 1) {
                        // Show a summary
                        let labelText = "";
                        if (this.labelinfo !== "nothing") {
                            let num = 0;

                            for (let i = 0; i < this._devices.length; i++) {
                                let [, , , , , percentage, , battery_level, seconds] = this._devices[i];

                                // Skip devices without accurate reporting
                                if (!reportsPreciseLevels(battery_level)) {
                                    continue;
                                }

                                // Only number them if we'll have multiple items
                                if (pct_support_count > 1) {
                                    labelText += (num++) + ': ';
                                }

                                if (this.labelinfo == "time" && seconds !== 0) {
                                    let time = Math.round(seconds / 60);
                                    let minutes = time % 60;
                                    let hours = Math.floor(time / 60);
                                    labelText += C_("time of battery remaining", "%d:%02d").format(hours, minutes);
                                }
                                else if (this.labelinfo == "percentage" || (this.labelinfo == "percentage_time" && seconds === 0)) {
                                    labelText += C_("percent of battery remaining", "%d%%").format(Math.round(percentage));
                                }
                                else if (this.labelinfo == "percentage_time") {
                                    let time = Math.round(seconds / 60);
                                    let minutes = Math.floor(time % 60);
                                    let hours = Math.floor(time / 60);
                                    labelText += C_("percent of battery remaining", "%d%%").format(Math.round(percentage)) + " (" +
                                        C_("time of battery remaining", "%d:%02d").format(hours, minutes) + ")";
                                }

                                // Only add a gap if we have remaining valid devices to show.
                                if (num < pct_support_count) {
                                    labelText += '  ';
                                }
                            }
                        }

                        this.set_applet_tooltip(devices_stats.join(", "));
                        this.set_applet_label(labelText);
                        let icon = this._proxy.Icon;
                        if(icon) {
                            if (icon != this.panel_icon_name) {
                                this.panel_icon_name = icon;
                                this.set_applet_icon_symbolic_name('battery-full');
                                let gicon = Gio.icon_new_for_string(icon);
                                this._applet_icon.gicon = gicon;
                            }
                        }
                        else {
                            if (this.panel_icon_name != 'battery-full') {
                                this.panel_icon_name = 'battery-full';
                                this.set_applet_icon_symbolic_name('battery-full');
                            }
                        }
                    }
                    else {
                        // If there are no battery devices, show brightness info or disable the applet
                        this.set_applet_label("");
                        if (this.brightness.actor.visible) {
                            // Show the brightness info
                            this.set_applet_tooltip(_("Brightness"));
                            this.panel_icon_name = 'display-brightness';
                            this.set_applet_icon_symbolic_name('display-brightness');
                        }
                        else if (this.keyboard.actor.visible) {
                            // Show the brightness info
                            this.set_applet_tooltip(_("Keyboard backlight"));
                            this.panel_icon_name = 'keyboard-brightness';
                            this.set_applet_icon_symbolic_name('keyboard-brightness');
                        }
                        else {
                            // Disable the applet
                            this.set_applet_enabled(false);
                        }
                    }
                }
            }));
        }));
    }

    on_applet_removed_from_panel() {
        Main.systrayManager.unregisterId(this.metadata.uuid);
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new CinnamonPowerApplet(metadata, orientation, panel_height, instanceId);
}
