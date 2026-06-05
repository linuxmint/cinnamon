const Signals = imports.signals;


function SystrayManager() {
    this._init();
}

/**
 * #SystrayManager
 * @short_description: Utility class for registering tray icon replacements
 *
 * This allows applets or other extensions to replace an app's legacy tray icon.
 * For instance, the default network applet registers itself to replace network-
 * manager's tray icon.
 * 
 * Tray icons typically show up in .xsession-errors as:
 * ...
 * Adding systray: evolution-alarm-notify (48x48px)
 * ...
 * If you wrote an applet to replace the alarm tray icon, you would register here
 * with the name 'evolution-alarm-notify' and the uuid of your applet. As a result,
 * if your applet is loaded, the tray icon would be removed.
 * 
 * Accessible at runtime as Main.systrayManager.
 */
SystrayManager.prototype = {
    _init: function() {
        this._roles = [];
    },

    /**
     * registerTrayIconReplacement:
     * @role (string): The systray icon name as reported in the logs.
     * @uuid (string): The uuid of the applet, desklet, or extension.
     * @instanceId (int): Optional instance id for multi-instance support.
     *
     * Registers the uuid to replace a tray icon identified by the role.
     */
    registerTrayIconReplacement: function(role, uuid, instanceId) {
        this._roles.push({role: role.toLowerCase(), uuid: uuid, instanceId: instanceId});
        this.emit("changed");
    },

    /**
     * unregisterTrayIconReplacement:
     * @uuid (string): The uuid of the applet, desklet, or extension.
     * @instanceId (int): Optional instance id. If provided, only entries
     * matching both uuid and instanceId are removed. If omitted, all
     * entries for the uuid are removed.
     *
     * Unregisters any roles claimed by uuid (and optionally instanceId).
     */
    unregisterTrayIconReplacement: function(uuid, instanceId) {
        for (let i = this._roles.length - 1; i >= 0; i--) {
            if (this._roles[i].uuid == uuid) {
                if (instanceId === undefined || this._roles[i].instanceId === instanceId) {
                    this._roles.splice(i, 1);
                }
            }
        }
        this.emit("changed");
    },

    /**
     * getRoles:
     *
     * Returns an array of registered roles.
     */
    getRoles: function() {
        let roles = [];
        for (let i = 0; i < this._roles.length; i++) {
            roles.push(this._roles[i].role);
        }

        return roles;
    },

    /* deprecated */
    registerRole: function(role, uuid) {
        this.registerTrayIconReplacement(role, uuid);
    },

    /* deprecated */
    unregisterId: function(uuid) {
        this.unregisterTrayIconReplacement(uuid)
    },

    unregisterRole: function(role, uuid) {
        this.unregisterTrayIconReplacement(uuid)
    }
}
Signals.addSignalMethods(SystrayManager.prototype);
