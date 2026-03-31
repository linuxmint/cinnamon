const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const Inhibitor = imports.misc.inhibitor;
const Settings = imports.ui.settings;
const Util = imports.misc.util;


function _resolveAppInfo(appId) {
    let appSys = Cinnamon.AppSystem.get_default();

    let app = appSys.lookup_app(`${appId}.desktop`)
           || appSys.lookup_app(appId)
           || appSys.lookup_flatpak_app_id(appId);

    // Try the last segment of a dotted app ID (e.g. "org.x.hypnotix" -> "hypnotix")
    if (!app) {
        let parts = appId.split('.');
        if (parts.length > 1)
            app = appSys.lookup_app(`${parts[parts.length - 1]}.desktop`);
    }

    if (app) {
        let appInfo = app.get_app_info();
        return { name: app.get_name(), gicon: appInfo ? appInfo.get_icon() : null };
    }

    return { name: appId, gicon: null };
}

class InhibitAppletIcon {
    constructor(applet, notificationStatus, inhibitStatus) {
        this._applet = applet;
        this.icon_name = 'inhibit';
        this.notificationStatus = notificationStatus;
        this.inhibitStatus = inhibitStatus;
    }

    setAppletIcon() {
        this._applet.set_applet_icon_symbolic_name(this.getAppletIcon());
    }

    getAppletIcon() {
        let appletIcon = this.icon_name;
        if (this.inhibitStatus) {
            appletIcon += '-active';
        }
        if (this.notificationStatus) {
            appletIcon += '-notifications-disabled';
        }
        return appletIcon;
    }

    toggleNotificationStatus() {
        this.notificationStatus = !this.notificationStatus;
        this.setAppletIcon();
    }

    toggleInhibitStatus(status) {
        this.inhibitStatus = status;
        this.setAppletIcon();
    }
}

class InhibitSwitch extends PopupMenu.PopupBaseMenuItem {
    constructor() {
        super();

        this.label = new St.Label({ text: _("Power management") });

        this.actor.label_actor = this.label;

        this._statusIcon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_type: St.IconType.SYMBOLIC,
            icon_name: "xsi-dialog-warning-symbolic",
            reactive: true
        });

        this._switch = new PopupMenu.Switch(true);

        this.addActor(this.label);
        this.addActor(this._statusIcon);

        this._statusBin = new St.Bin({ x_align: St.Align.END });
        this.addActor(this._statusBin, { expand: true, span: -1, align: St.Align.END });
        this._statusBin.child = this._switch.actor;

        this.tooltip = new Tooltips.Tooltip(this._statusIcon, "");
    }

    activate(event) {
        this.toggle();
        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this, event, true);
    }

    get state() {
        return this._switch.state;
    }

    toggle() {
        this._switch.toggle();
        this.emit('toggled', this._switch.state);
    }

    updateState(active, showWarning) {
        this._switch.setToggleState(active);

        if (showWarning) {
            this.tooltip.set_text(_("Power management is already inhibited by another program"));
            this._statusIcon.set_opacity(255);
        } else {
            this.tooltip.set_text("");
            this._statusIcon.set_opacity(0);
        }
    }
}

class InhibitorMenuSection extends PopupMenu.PopupMenuSection {
    constructor() {
        super();

        this._items = [];

        this._createHeading();

        this.actor.hide();
    }

    _createHeading() {
        let headingText = _("Apps inhibiting power management:");
        this._heading = new PopupMenu.PopupMenuItem(headingText, { reactive: false });
        this.addMenuItem(this._heading);
    }

    update(inhibitors) {
        for (let item of this._items)
            item.destroy();

        this._items = [];

        if (!inhibitors || inhibitors.length === 0) {
            this.actor.hide();
            return;
        }

        for (let { appId, reasons } of inhibitors) {
            let { name, gicon } = _resolveAppInfo(appId);
            let label = name;
            if (reasons.length > 0)
                label += `: ${reasons.join(", ")}`;

            let item = new PopupMenu.PopupIconMenuItem(
                label,
                "application-x-executable",
                St.IconType.FULLCOLOR,
                { activate: false, hover: false, style_class: 'popup-inhibitor-menu-item' }
            );

            if (gicon)
                item.setGIcon(gicon);

            this.addMenuItem(item);
            this._items.push(item);
        }

        this.actor.show();
    }
}

class CinnamonInhibitApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        this.metadata = metadata;
        this._controller = Inhibitor.getController();
        this._controller.register();

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.inhibitSwitch = new InhibitSwitch();
        this.inhibitSwitch.connect('toggled', (sw, state) => {
            if (state)
                this._controller.uninhibit();
            else
                this._controller.inhibit();
        });
        this.menu.addMenuItem(this.inhibitSwitch);

        this.set_applet_tooltip(_("Inhibit applet"));

        this.notif_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.notifications" });
        this.notificationsSwitch = new PopupMenu.PopupSwitchMenuItem(_("Notifications"), this.notif_settings.get_boolean("display-notifications"));

        this.icon = new InhibitAppletIcon(this, !this.notificationsSwitch.state, false);
        this.icon.setAppletIcon();

        this.notif_settings.connectObject('changed::display-notifications', () => {
            let enabled = this.notif_settings.get_boolean("display-notifications");
            this.notificationsSwitch.setToggleState(enabled);
            this.icon.notificationStatus = !enabled;
            this.icon.setAppletIcon();
        }, this);
        this.notificationsSwitch.connect('toggled', () => {
            this.notif_settings.set_boolean("display-notifications", this.notificationsSwitch.state);
            this.icon.toggleNotificationStatus();
        });

        this.menu.addMenuItem(this.notificationsSwitch);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("keyPower", "keyPower", this._setKeybinding);
        this.settings.bind("keyNotifications", "keyNotifications", this._setKeybinding);
        this._setKeybinding();

        this._createInhibitorMenuSection(orientation);

        this._controller.connectObject(
            'status-changed', () => this._onStatusChanged(), this
        );

        this._onStatusChanged();
    }

    _onStatusChanged() {
        if (!this._controller.ready) {
            this.inhibitSwitch.actor.hide();
            return;
        }

        this.inhibitSwitch.actor.show();

        let currentState = this._controller.inhibitedActions;
        let isInhibited = this._controller.isInhibited;

        if (currentState & Inhibitor.INHIBIT_IDLE_FLAG ||
            currentState & Inhibitor.INHIBIT_SLEEP_FLAG) {
            this.icon.toggleInhibitStatus(true);
            this.set_applet_tooltip(_("Power management: Inhibited"));
        } else {
            this.icon.toggleInhibitStatus(false);
            this.set_applet_tooltip(_("Power management: Active"));
        }

        // Only show external inhibitors if we're not doing the inhibiting ourselves.
        // The list is mainly to explain why power management might be inhibited even
        // though the user isn't actively disabling it themselves.

        let hasExternal = !isInhibited && this._controller.hasExternalInhibitors;

        this.inhibitSwitch.updateState(!isInhibited, hasExternal);

        if (hasExternal) {
            this.set_applet_tooltip(_("Power management: inhibited by another program"));
            this._inhibitorMenuSection.update(this._controller.externalInhibitors);
            this._inhibitorSeparator.actor.show();
        } else {
            this._inhibitorMenuSection.update(null);
            this._inhibitorSeparator.actor.hide();
        }
    }

    _createInhibitorMenuSection(orientation) {
        this._inhibitorMenuSection = new InhibitorMenuSection();
        this._inhibitorSeparator = new PopupMenu.PopupSeparatorMenuItem();

        if (orientation == St.Side.BOTTOM) {
            // Add above the switches.
            this.menu.addMenuItem(this._inhibitorSeparator, 0);
            this.menu.addMenuItem(this._inhibitorMenuSection, 0);
        } else {
            // Add below the switches.
            this.menu.addMenuItem(this._inhibitorSeparator);
            this.menu.addMenuItem(this._inhibitorMenuSection);
        }
    }

    _setKeybinding() {
        Main.keybindingManager.addXletHotKey(this, "inhibit-power",
            this.keyPower,
            () => this._toggleInhibitPower());
        Main.keybindingManager.addXletHotKey(this, "inhibit-notifications",
            this.keyNotifications,
            () => this._toggleInhibitNotifications());
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_btn_open_system_power_settings_clicked() {
        Util.spawnCommandLine("cinnamon-settings power");
    }

    on_btn_open_system_notification_settings_clicked() {
        Util.spawnCommandLine("cinnamon-settings notifications");
    }

    on_applet_removed_from_panel() {
        Main.keybindingManager.removeXletHotKey(this, "inhibit-power");
        Main.keybindingManager.removeXletHotKey(this, "inhibit-notifications");

        this.notif_settings.disconnectObject(this);
        this._controller.disconnectObject(this);
        this._controller.unregister();
        this.settings.finalize();
    }

    on_orientation_changed(orientation) {
        this._inhibitorMenuSection.destroy();
        this._inhibitorSeparator.destroy();

        this._createInhibitorMenuSection(orientation);

        this._onStatusChanged();
    }

    _toggleInhibitPower() {
        this.inhibitSwitch.toggle();

        let willBeInhibited = !this.inhibitSwitch.state;

        let symbol = willBeInhibited ?
            "inhibit-active-symbolic" :
            "inhibit-symbolic";

        let text = willBeInhibited ?
            _("Power management: Inhibited") :
            _("Power management: Active");

        Main.osdWindowManager.show(-1, Gio.ThemedIcon.new(symbol), text);
    }

    _toggleInhibitNotifications() {
        this.notificationsSwitch.toggle();

        let symbol = this.notificationsSwitch._switch.state ?
            "inhibit-notification-symbolic" :
            "inhibit-notification-active-symbolic";

        let text = this.notificationsSwitch._switch.state ?
            _("Notifications: Active") :
            _("Notifications: Inhibited");

        Main.osdWindowManager.show(-1, Gio.ThemedIcon.new(symbol), text);
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new CinnamonInhibitApplet(metadata, orientation, panel_height, instanceId);
}
