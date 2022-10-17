const Applet = imports.ui.applet;
const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Main = imports.ui.main;
const St = imports.gi.St;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const GnomeSession = imports.misc.gnomeSession;
const Settings = imports.ui.settings;
const Util = imports.misc.util;

const INHIBIT_IDLE_FLAG = 8;
const INHIBIT_SLEEP_FLAG = 4;

class InhibitSwitch extends PopupMenu.PopupBaseMenuItem {
    constructor(applet) {
        super();
        this._applet = applet;

        this.label = new St.Label({ text: _("Power management") });

        this.actor.label_actor = this.label;

        this._statusIcon = new St.Icon({
            style_class: 'popup-menu-icon',
            icon_type: St.IconType.SYMBOLIC,
            icon_name: "dialog-warning-symbolic",
            reactive: true
        });

        this._switch = new PopupMenu.Switch(true);

        this.addActor(this.label);
        this.addActor(this._statusIcon);

        this._statusBin = new St.Bin({ x_align: St.Align.END });
        this.addActor(this._statusBin, { expand: true, span: -1, align: St.Align.END });
        this._statusBin.child = this._switch.actor;

        this.actor.hide();
        this.tooltip = new Tooltips.Tooltip(this._statusIcon, "");

        this.sessionProxy = null;
        this.sessionCookie = null;
        this.sigAddedId = 0;
        this.sigRemovedId = 0;

        GnomeSession.SessionManager(Lang.bind(this, function(proxy, error) {
            if (error)
                return;

            this.sessionProxy = proxy;
            this.actor.show();
            this.updateStatus();

            this.sigAddedId = this.sessionProxy.connectSignal(
                "InhibitorAdded",
                Lang.bind(this, this.updateStatus)
            );

            this.sigRemovedId = this.sessionProxy.connectSignal(
                "InhibitorRemoved",
                Lang.bind(this, this.updateStatus)
            );
        }));
    }

    activate(event) {
        if (this._switch.actor.mapped) {
            this._switch.toggle();
        }

        this.toggled(this._switch.state);

        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this, event, true);
    }

    updateStatus(o) {
        let current_state = this.sessionProxy.InhibitedActions;

        if (current_state & INHIBIT_IDLE_FLAG ||
            current_state & INHIBIT_SLEEP_FLAG) {
            this._applet.set_applet_icon_symbolic_name('inhibit-active');
            this._applet.set_applet_tooltip(_("Power management: inhibited"));
        } else {
            this._applet.set_applet_icon_symbolic_name('inhibit');
            this._applet.set_applet_tooltip(_("Power management: active"));
        }

        if (current_state >= INHIBIT_SLEEP_FLAG && !this.sessionCookie) {
            this.tooltip.set_text(_("Power management is already inhibited by another program"));
            this._applet.set_applet_tooltip(_("Power management: inhibited by another program"));
            this._statusIcon.set_opacity(255);
            this._applet.inhibitors.updateInhibitors(this.sessionProxy);
        } else {
            this.tooltip.set_text("");
            this._statusIcon.set_opacity(0);
            this._applet.inhibitors.resetInhibitors();
        }
    }

    toggled(active) {
        if (!active && !this.sessionCookie) {
            this.sessionProxy.InhibitRemote("inhibit@cinnamon.org",
                0,
                "prevent idle functions like screen blanking and dimming",
                INHIBIT_IDLE_FLAG,
                Lang.bind(this, function(cookie) {
                    this.sessionCookie = cookie;
                    this.updateStatus();
                }));
        } else if (active && this.sessionCookie) {
            this.sessionProxy.UninhibitRemote(this.sessionCookie, Lang.bind(this, this.updateStatus));
            this.sessionCookie = null;
        }
    }

    kill() {
        if (!this.sessionProxy)
            return;

        if (this.sessionCookie) {
            this.sessionProxy.UninhibitRemote(this.sessionCookie);
            this.sessionCookie = null;
        }

        if (this.sigAddedId) {
            this.sessionProxy.disconnectSignal(this.sigAddedId);
        }

        if (this.sigRemovedId) {
            this.sessionProxy.disconnectSignal(this.sigRemovedId);
        }
    }
}

class InhibitingAppMenuItem extends PopupMenu.PopupIconMenuItem {
    constructor(appId) {
        super(
            appId,
            "dialog-information-symbolic",
            St.IconType.SYMBOLIC,
            { activate: false, hover: false }
        );

        this.appId = appId;
        this._reasonsByObjPath = {};
        this._inhibitorCount = 0;
        this._tooltip = new Tooltips.Tooltip(this.actor, "");
    }

    addInhibitor(objectPath, reason) {
        if (!(objectPath in this._reasonsByObjPath)) {
            this._reasonsByObjPath[objectPath] = reason;
            this._inhibitorCount++;
            this._updateTooltip();
        }
    }

    updateInhibitor(objectPath, reason) {
        if (objectPath in this._reasonsByObjPath) {
            this._reasonsByObjPath[objectPath] = reason;
            this._updateTooltip();
        }
    }

    removeInhibitor(objectPath) {
        if (objectPath in this._reasonsByObjPath) {
            delete this._reasonsByObjPath[objectPath];
            this._inhibitorCount--;
            this._updateTooltip();
        }
    }

    hasInhibitor() {
        return !!this._inhibitorCount;
    }

    _updateTooltip() {
        let reasons = Object.values(this._reasonsByObjPath)
            .map(r => r && r.trim()) // Remove extraneous whitespace.
            .filter(Boolean); // Discard null/empty reasons.

        reasons = Array.from(new Set(reasons)); // Keep only unique reasons.

        this._tooltip.set_text(reasons.join("\n"));
    }
}

class InhibitorMenuSection extends PopupMenu.PopupMenuSection {
    constructor() {
        super();

        // Menu items indexed by app ID e.g. "org.gnome.Rhythmbox3".
        // Each menu item is associated with exactly one app ID and vice versa.
        this._itemsByAppId = {};

        // Menu items indexed by object path e.g. "/org/gnome/SessionManager/Inhibitor42".
        // Multiple paths may point to the same item if an app creates multiple inhibitors.
        this._itemsByObjPath = {};

        this._itemCount = 0;
        this._updateId = 0; // light-weight way to abort an in-progress update (by incrementing)

        this._createHeading();

        this.actor.hide();
    }

    _createHeading() {
        let headingText = _("Apps inhibiting power management:");
        let heading = new PopupMenu.PopupMenuItem(headingText, { reactive: false });
        this.addMenuItem(heading);
    }

    resetInhibitors() {
        // Abort any in-progress update or else it may continue to add menu items 
        // even after we've cleared them.
        this._updateId++;

        if (this._itemCount) {
            this._itemsByAppId = {};
            this._itemsByObjPath = {};
            this._itemCount = 0;

            // Clear all, but make sure we still have a heading for next time we're shown.
            this.removeAll();
            this._createHeading();

            this.actor.hide();
        }
    }

    updateInhibitors(sessionProxy) {
        // Grab a new ID for this update while at the same time aborting any other in-progress 
        // update. We don't want to end up with duplicate menu items!
        let updateId = ++this._updateId;

        sessionProxy.GetInhibitorsRemote(Lang.bind(this, function(objectPaths) {
            if (updateId != this._updateId) {
                return;
            }

            objectPaths = String(objectPaths).split(','); // Given object, convert to string[].

            // Add menu items for any paths we haven't seen before, and keep track of the paths
            // iterated so we can figure out which of our existing paths are no longer present.

            let pathsPresent = {};

            for (let objectPath of objectPaths) {
                if (objectPath) {
                    pathsPresent[objectPath] = true;

                    if (!(objectPath in this._itemsByObjPath)) {
                        this._addInhibitor(objectPath, updateId);
                    }
                }
            }

            // Remove menu items for those paths no longer present.
            for (let objectPath in this._itemsByObjPath) {
                if (!(objectPath in pathsPresent)) {
                    this._removeInhibitor(objectPath);
                }
            }
        }));
    }

    // Precondition: objectPath not already in _itemsByObjPath
    _addInhibitor(objectPath, updateId) {
        GnomeSession.Inhibitor(objectPath, Lang.bind(this, function(inhibitorProxy, error) {
            if (error || updateId != this._updateId) {
                return;
            }

            inhibitorProxy.GetFlagsRemote(Lang.bind(this, function(flags) {
                if (updateId != this._updateId) {
                    return;
                }

                flags = parseInt(flags, 10); // Given object, convert to integer.

                // Only include those inhibiting sleep, idle, or both.
                if (flags < INHIBIT_SLEEP_FLAG) {
                    return;
                }

                inhibitorProxy.GetAppIdRemote(Lang.bind(this, function(appId) {
                    if (updateId != this._updateId) {
                        return;
                    }

                    appId = String(appId); // Given object, convert to string.

                    // Get/create the menu item for this app.
                    let menuItem;
                    if (appId in this._itemsByAppId) {
                        menuItem = this._itemsByAppId[appId];
                    } else {
                        menuItem = new InhibitingAppMenuItem(appId);
                        this._itemsByAppId[appId] = menuItem;
                        this.addMenuItem(menuItem);

                        // Show the menu section upon adding the first menu item.
                        if (!(this._itemCount++)) {
                            this.actor.show();
                        }
                    }

                    this._itemsByObjPath[objectPath] = menuItem;

                    // Go ahead and add the inhibitor to the item now and fill in the reason later.
                    menuItem.addInhibitor(objectPath);

                    inhibitorProxy.GetReasonRemote(Lang.bind(this, function(reason) {
                        if (updateId != this._updateId) {
                            return;
                        }

                        reason = String(reason); // Given object, convert to string.
                        menuItem.updateInhibitor(objectPath, reason);
                    }));
                }));
            }));
        }));
    }

    // Precondition: objectPath already in _itemsByObjPath
    _removeInhibitor(objectPath) {
        let menuItem = this._itemsByObjPath[objectPath];
        delete this._itemsByObjPath[objectPath];
        menuItem.removeInhibitor(objectPath);

        // Remove the menu item if the last inhibitor for the app has been removed.
        if (!menuItem.hasInhibitor()) {
            delete this._itemsByAppId[menuItem.appId];
            menuItem.destroy();

            // Hide the menu section upon removing the last menu item.
            if (!(--this._itemCount)) {
                this.actor.hide();
            }
        }
    }
}

class CinnamonInhibitApplet extends Applet.IconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        this.metadata = metadata;

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.inhibitSwitch = new InhibitSwitch(this);
        this.menu.addMenuItem(this.inhibitSwitch);

        this.set_applet_icon_symbolic_name('inhibit');
        this.set_applet_tooltip(_("Inhibit applet"));

        this.notif_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.notifications" });
        this.notificationsSwitch = new PopupMenu.PopupSwitchMenuItem(_("Notifications"), this.notif_settings.get_boolean("display-notifications"));

        this.notif_settings.connect('changed::display-notifications', Lang.bind(this, function() {
            this.notificationsSwitch.setToggleState(this.notif_settings.get_boolean("display-notifications"));
        }));
        this.notificationsSwitch.connect('toggled', Lang.bind(this, function() {
            this.notif_settings.set_boolean("display-notifications", this.notificationsSwitch.state);
        }));

        this.menu.addMenuItem(this.notificationsSwitch);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this.settings.bind("keyPower", "keyPower", this._setKeybinding);
        this.settings.bind("keyNotifications", "keyNotifications", this._setKeybinding);
        this._setKeybinding();

        this._createInhibitorMenuSection(orientation);
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
        Main.keybindingManager.addHotKey("inhibit-power-" + this.instance_id,
            this.keyPower,
            Lang.bind(this, this.toggle_inhibit_power));
        Main.keybindingManager.addHotKey("inhibit-notifications-" + this.instance_id,
            this.keyNotifications,
            Lang.bind(this, this.toggle_inhibit_notifications));
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
        Main.keybindingManager.removeHotKey("inhibit-power-" + this.instance_id);
        Main.keybindingManager.removeHotKey("inhibit-notifications-" + this.instance_id);
        this.inhibitSwitch.kill();
    }

    on_orientation_changed(orientation) {
        this._inhibitorMenuSection.destroy();
        this._inhibitorSeparator.destroy();

        this._createInhibitorMenuSection(orientation);

        // Will put the inhibitor menu section into the correct state.
        this.inhibitSwitch.updateStatus();
    }

    toggle_inhibit_power() {
        this.inhibitSwitch._switch.toggle();
        this.inhibitSwitch.toggled(this.inhibitSwitch._switch.state);

        let _symbol = this.inhibitSwitch._switch.state ?
            "inhibit-symbolic" :
            "inhibit-active-symbolic";

        Main.osdWindowManager.show(-1, Gio.ThemedIcon.new(_symbol));
    }

    toggle_inhibit_notifications() {
        this.notificationsSwitch.toggle();

        let _symbol = this.notificationsSwitch._switch.state ?
            "inhibit-notification-symbolic" :
            "inhibit-notification-active-symbolic";

        Main.osdWindowManager.show(-1, Gio.ThemedIcon.new(_symbol));
    }

    get inhibitors() {
        return this._inhibitorMenuSection;
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new CinnamonInhibitApplet(metadata, orientation, panel_height, instanceId);
}
