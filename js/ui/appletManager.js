// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;

const Main = imports.ui.main;
const Applet = imports.ui.applet;
const Extension = imports.ui.extension;
const ModalDialog = imports.ui.modalDialog;
const Gettext = imports.gettext;

// Maps uuid -> metadata object
var appletMeta;
// Maps uuid -> importer object (applet directory tree)
var applets;
// Maps applet_id -> applet objects
const appletObj = [];
var appletsLoaded = false;

// An applet can assume a role
// Instead of hardcoding looking for a particular applet,
// We let applets announce that they can fill a particular
// role, using the 'role' metadata entry.
// For now, just notifications, but could be expanded.
// question - should multiple applets be able to fill
// the same role?
const Roles = {
    NOTIFICATIONS: 'notifications',
    PANEL_LAUNCHER: 'panellauncher'
};

let enabledAppletDefinitions;
let clipboard = [];

function init() {
    applets = Extension.Type.APPLET.maps.importObjects;
    appletMeta = Extension.Type.APPLET.maps.meta;

    appletsLoaded = false;

    // Load all applet extensions, the applets themselves will be added in finishExtensionLoad
    enabledAppletDefinitions = getEnabledAppletDefinitions();
    for (let uuid in enabledAppletDefinitions.uuidMap) {
        Extension.loadExtension(uuid, Extension.Type.APPLET);
    }
    appletsLoaded = true;

    global.settings.connect('changed::enabled-applets', onEnabledAppletsChanged);
}

// Callback for extension.js
function finishExtensionLoad(extension) {
    // Add all applet instances for this extension
    let definitions = enabledAppletDefinitions.uuidMap[extension.uuid];
    if (definitions) {
        for(let i=0; i<definitions.length; i++) {
            if (!addAppletToPanels(extension, definitions[i]))
                return false;
        }
    }
    return true;
}

// Callback for extension.js
function prepareExtensionUnload(extension, deleteConfig) {
    // Remove all applet instances for this extension
    for(let applet_id in extension._loadedDefinitions) {
        removeAppletFromPanels(extension._loadedDefinitions[applet_id], deleteConfig);
    }
}

function getEnabledAppletDefinitions() {
    let result = {
        // the raw list from gsettings
        raw: global.settings.get_strv('enabled-applets'),
        // maps uuid -> list of applet definitions
        uuidMap: {},
        // maps applet_id -> single applet definition
        idMap: []
    };

    // Upgrade settings if required
    checkForUpgrade(result.raw);

    // Parse all definitions
    for (let i=0; i<result.raw.length; i++) {
        let appletDefinition = getAppletDefinition(result.raw[i]);
        if(appletDefinition) {
            if(!result.uuidMap[appletDefinition.uuid])
                result.uuidMap[appletDefinition.uuid] = [];
            result.uuidMap[appletDefinition.uuid].push(appletDefinition);
            result.idMap[appletDefinition.applet_id] = appletDefinition;
        }
    }

    return result;
}

function getAppletDefinition(definition) {
    // format used in gsettings is 'panel:location:order:uuid:applet_id' where:
    // - panel is something like 'panel1',
    // - location is either 'left', 'center' or 'right',
    // - order is an integer representing the order of the applet within the panel/location (i.e. 1st, 2nd etc..).
    // - applet_id is a unique id assigned to the applet instance when added.
    let elements = definition.split(":");
    if (elements.length > 4) {
        let panelId = parseInt(elements[0].slice(5));
        let panel = Main.panelManager.panels[panelId];
        let orientation;
        let order;
        try { order = parseInt(elements[2]); } catch(e) { order = 0; }

        // Panel might not exist. Still keep definition for future use.
        let location;
        if (panel) {
            orientation = setOrientationForPanel(panel.panelPosition);
            location = getLocation(panel, elements[1]);
        }

        let appletDefinition = {
            panel: panel,
            panelId: panelId,
            orientation: orientation,
            location: location,
            location_label: elements[1],
            center: elements[1] == "center",
            order: order,
            uuid: elements[3],
            applet_id: elements[4]
        };

        if (elements.length > 5) appletDefinition.overrides = elements[5].split(',');
        return appletDefinition;
    }

    global.logError("Bad applet definition: " + definition);
    return null;
}

function setOrientationForPanel(panelPos) {
    let orientation;
    switch (panelPos)
    {
        case 0:
                orientation = St.Side.TOP;
        break;
        case 1:
                orientation = St.Side.BOTTOM;
        break;
        case 2:
                orientation = St.Side.LEFT;
        break;
        case 3:
                orientation = St.Side.RIGHT;
        break;
    }

    return orientation;
}

function setHeightForPanel(panelObj, panelPos) {
    let height;
    switch (panelPos)  // for vertical panels use the width instead of the height
    {
        case 0:
        case 1:
                height = panelObj.actor.get_height();
        break;
        case 2:
        case 3:
                height = panelObj.actor.get_width();
        break;
    }
    return height;
}

function checkForUpgrade(newEnabledApplets) {
    // upgrade if old version
    let nextAppletId = global.settings.get_int("next-applet-id");
    for (let i=0; i<newEnabledApplets.length; i++) {
        let elements = newEnabledApplets[i].split(":");
        if (elements.length == 4) {
            newEnabledApplets[i] += ":" + nextAppletId;
            nextAppletId++;
        }
    }

    if(nextAppletId != global.settings.get_int("next-applet-id")) {
        global.settings.set_int("next-applet-id", nextAppletId);
        global.settings.set_strv('enabled-applets', newEnabledApplets);
        return true;
    }

    return false;
}

function appletDefinitionsEqual(a, b) {
    return ( a.panel == b.panel && a.orientation == b.orientation && a.location == b.location && a.order == b.order);
}

function onEnabledAppletsChanged() {
    try {
        let oldEnabledAppletDefinitions = enabledAppletDefinitions;
        enabledAppletDefinitions = getEnabledAppletDefinitions();
        // Remove all applet instances that do not exist in the definition anymore.
        for (let applet_id in oldEnabledAppletDefinitions.idMap) {
            if(!enabledAppletDefinitions.idMap[applet_id]) {
                let removeConfig = Extension.get_max_instances(oldEnabledAppletDefinitions.idMap[applet_id].uuid, Extension.Type.APPLET) != 1;
                removeAppletFromPanels(oldEnabledAppletDefinitions.idMap[applet_id], removeConfig);
            }
        }

        // Unload all applet extensions that do not exist in the definition anymore.
        for (let uuid in oldEnabledAppletDefinitions.uuidMap) {
            if(!enabledAppletDefinitions.uuidMap[uuid]) {
                Extension.unloadExtension(uuid, Extension.Type.APPLET);
            }
        }

        // Add or move applet instances of already loaded applet extensions
        for (let applet_id in enabledAppletDefinitions.idMap) {
            let newDef = enabledAppletDefinitions.idMap[applet_id];
            let oldDef = oldEnabledAppletDefinitions.idMap[applet_id];

            if(!oldDef || !appletDefinitionsEqual(newDef, oldDef)) {
                let extension = Extension.Type.APPLET.maps.objects[newDef.uuid];
                if(extension) {
                    addAppletToPanels(extension, newDef);
                }
            }
        }

        // Make sure all applet extensions are loaded.
        // Once loaded, the applets will add themselves via finishExtensionLoad
        for (let uuid in enabledAppletDefinitions.uuidMap) {
            Extension.loadExtension(uuid, Extension.Type.APPLET);
        }
    }
    catch(e) {
        global.logError('Failed to refresh list of applets', e);
    }

    Main.statusIconDispatcher.redisplay();
}

function removeAppletFromPanels(appletDefinition, deleteConfig) {
    let applet = appletObj[appletDefinition.applet_id];
    if (applet) {
        try {
            applet._onAppletRemovedFromPanel(deleteConfig);
        } catch (e) {
            global.logError("Error during on_applet_removed_from_panel() call on applet: " + appletDefinition.uuid + "/" + appletDefinition.applet_id, e);
        }

        if (applet._panelLocation != null) {
            applet._panelLocation.remove_actor(applet.actor);
            applet._panelLocation = null;
        }

        if (applet._extension) {
           delete applet._extension._loadedDefinitions[appletDefinition.applet_id];
        }

        delete appletObj[appletDefinition.applet_id];

        if (deleteConfig)
            _removeAppletConfigFile(appletDefinition.uuid, appletDefinition.applet_id);

        /* normal occurs during _onAppletRemovedFromPanel, but when a panel is removed,
         * appletObj hasn't had the instance removed yet, so let's run it one more time
         * here when everything has been updated.
         */
        callAppletInstancesChanged(appletDefinition.uuid);
    }
}

function _removeAppletConfigFile(uuid, instanceId) {
    let config_path = (GLib.get_home_dir() + "/" +
                               ".cinnamon" + "/" +
                                 "configs" + "/" +
                                      uuid + "/" +
                                instanceId + ".json");
    let file = Gio.File.new_for_path(config_path);
    if (file.query_exists(null)) {
        try {
            file.delete(null);
        } catch (e) {
            global.logError("Problem removing applet config file during cleanup.  UUID is " + uuid + " and filename is " + config_path);
        }
    }
}

function addAppletToPanels(extension, appletDefinition) {
    if (!appletDefinition.panel) return true;

    try {
        // Create the applet
        let applet = createApplet(extension, appletDefinition);
        if(applet == null)
            return false;

        // Now actually lock the applets role and set the provider
        extension.lockRole(applet);

        applet._order = appletDefinition.order;
        applet._extension = extension;

        // Remove it from its previous panel location (if it had one)
        if (applet._panelLocation != null) {
            applet._panelLocation.remove_actor(applet.actor);
            applet._panelLocation = null;
        }

        let location = appletDefinition.location;

        let before = location.get_children()
            .find(x => {
                return x._applet && (x._applet instanceof Applet.Applet) && (appletDefinition.order < x._applet._order)
            });

        if (before)
            location.insert_child_below(applet.actor, before);
        else
            location.add_actor(applet.actor);

        applet._panelLocation = location;

        if(!extension._loadedDefinitions) {
            extension._loadedDefinitions = {};
        }
        extension._loadedDefinitions[appletDefinition.applet_id] = appletDefinition;

        applet.on_applet_added_to_panel_internal(appletsLoaded);

        removeAppletFromInappropriatePanel (extension, applet, appletDefinition);

        return true;
    } catch(e) {
        extension.unlockRole();
        extension.logError('Failed to load applet: ' + appletDefinition.uuid + "/" + appletDefinition.applet_id, e);
        return false;
    }
}

function removeAppletFromInappropriatePanel (extension, applet, appletDefinition) {
    //  We want to ensure that applets placed in a panel can be shown correctly
    //  - particularly because wide applets will not fit in a vertical panel unless
    //  they have logic to manage this explicitly.
    //
    //  If the applet is of type IconApplet (and not a TextIconApplet) then it should be fine.
    //  If not, we check if the user has previously opted to leave it there anyway.
    //  Then we look to see if it has declared itself suitable via a call to applet.getAllowedLayout().
    //
    //  If the applet turns out to be unsuitable the user is then asked if they want to keep it anyway,
    //  remove it, or try to find another panel that supports it.
    if (applet instanceof Applet.IconApplet && !(applet instanceof Applet.TextIconApplet)) return;
    if (appletDefinition.overrides && appletDefinition.overrides.indexOf('orient') != -1) return;

    let allowedLayout = applet.getAllowedLayout();

    if ((allowedLayout == Applet.AllowedLayout.HORIZONTAL && [St.Side.LEFT, St.Side.RIGHT].indexOf(appletDefinition.orientation) != -1) ||
        (allowedLayout == Applet.AllowedLayout.VERTICAL && [St.Side.TOP, St.Side.BOTTOM].indexOf(appletDefinition.orientation) != -1)) {

        global.logWarning((allowedLayout == Applet.AllowedLayout.HORIZONTAL)+", "+[St.Side.LEFT, St.Side.RIGHT].indexOf(appletDefinition.orientation));

        let label_text = "<b>" + extension.meta.name + "</b>\n" +
                         _("This applet does not support panels of that type. This can cause visual glitches in the panel.") + "\n" +
                         _("Would you like to continue using it anyway, remove it from the panel, or try to move it to a different panel?");
        let label = new St.Label({text: label_text});
        label.clutter_text.set_use_markup(true);

        let dialog = new ModalDialog.ModalDialog();
        dialog.contentLayout.add(label);

        dialog.setButtons([
            {
                label: _("Leave it"),
                action: function() {
                    dialog.destroy();
                    verticalPanelOverride(appletDefinition);
                }
            },
            {
                label: _("Remove it"),
                action: function() {
                    dialog.destroy();
                    removeApplet(appletDefinition);
                }
            },
            {
                label: _("Move to another panel"),
                action: function() {
                    dialog.destroy();
                    moveApplet(appletDefinition, allowedLayout);
                }
            }
        ]);

        dialog.open();
    }
}

function verticalPanelOverride(appletDefinition) {
    let list = global.settings.get_strv('enabled-applets');
    for (let i = 0; i < list.length; i++) {
        let info = list[i].split(':');
        if (info[3] == appletDefinition.uuid && info[4] == appletDefinition.applet_id) {
            let overrides;
            if (info.length > 5) overrides = info[5].split;
            else overrides = [];
            overrides.push('orient');
            info[5] = overrides.join(',');
            list[i] = info.join(':');
            break;
        }
    }

    global.settings.set_strv('enabled-applets', list);
}

function removeApplet(appletDefinition) {
    let oldList = global.settings.get_strv('enabled-applets');
    let newList = []

    for (let i = 0; i < oldList.length; i++) {
        let info = oldList[i].split(':');
        if (info[3] != appletDefinition.uuid || info[4] != appletDefinition.applet_id) {
            newList.push(oldList[i]);
        }
    }

    global.settings.set_strv('enabled-applets', newList);
}

function moveApplet(appletDefinition, allowedLayout) {
    let panelId = null;
    let panels = global.settings.get_strv('panels-enabled');
    for (let i = 0; i < panels.length; i++) {
        let panelInfo = panels[i].split(':');
        global.logWarning(allowedLayout==Applet.AllowedLayout.HORIZONTAL);
        if ((allowedLayout == Applet.AllowedLayout.HORIZONTAL && ['top', 'bottom'].indexOf(panelInfo[2]) != -1) ||
            (allowedLayout == Applet.AllowedLayout.VERTICAL && ['left', 'right'].indexOf(panelInfo[2]) != -1)) {
            panelId = 'panel' + panelInfo[0];
            break;
        }
    }

    if (panelId == null) {
        removeApplet(appletDefinition);
        let dialog = new ModalDialog.NotifyDialog(_("A suitable panel could not be found. The applet has been removed instead.") + "\n\n");
        dialog.open();
        return;
    }

    let list = global.settings.get_strv('enabled-applets');
    for (let i = 0; i < list.length; i++) {
        let info = list[i].split(':');
        if (info[3] == appletDefinition.uuid && info[4] == appletDefinition.applet_id) {
            info[0] = panelId;
            list[i] = info.join(':');
            break;
        }
    }

    global.settings.set_strv('enabled-applets', list);
}

function get_role_provider(role) {
    if (Extension.Type.APPLET.roles[role]) {
        return Extension.Type.APPLET.roles[role].roleProvider;
    }
    return null;
}

function get_role_provider_exists(role) {
    return get_role_provider(role) != null;
}

function createApplet(extension, appletDefinition) {
    if (!appletDefinition.panel) return null;

    let applet_id = appletDefinition.applet_id;
    let orientation = appletDefinition.orientation;
    let panel_height;

    panel_height = setHeightForPanel(appletDefinition.panel, appletDefinition.panel.panelPosition);

    if (appletObj[applet_id] != undefined) {
        global.log(applet_id + ' applet already loaded');
        appletObj[applet_id].setOrientation(orientation);
        if (appletObj[applet_id]._panelHeight != panel_height) {
            appletObj[applet_id].setPanelHeight(panel_height);
        }

        return appletObj[applet_id];
    }

    let applet;
    try {
        applet = extension.module.main(extension.meta, orientation, panel_height, applet_id);
    } catch (e) {
        extension.logError('Failed to evaluate \'main\' function on applet: ' + appletDefinition.uuid + "/" + appletDefinition.applet_id, e);
        return null;
    }

    appletObj[applet_id] = applet;
    applet._uuid = extension.uuid;
    applet._meta = extension.meta;
    applet.instance_id = applet_id;
    applet.panel = appletDefinition.panel;

    Gettext.bindtextdomain(applet._uuid, GLib.get_home_dir() + "/.local/share/locale");

    applet.finalizeContextMenu();

    return(applet);
}

function _removeAppletFromPanel(uuid, applet_id) {
    let enabledApplets = enabledAppletDefinitions.raw;
    for (let i=0; i<enabledApplets.length; i++) {
        let appletDefinition = getAppletDefinition(enabledApplets[i]);
        if (appletDefinition) {
            if (uuid == appletDefinition.uuid && applet_id == appletDefinition.applet_id) {
                let newEnabledApplets = enabledApplets.slice(0);
                newEnabledApplets.splice(i, 1);
                global.settings.set_strv('enabled-applets', newEnabledApplets);
                break;
            }
        }
    }
}

function saveAppletsPositions() {
    let enabled = global.settings.get_strv('enabled-applets');
    let newEnabled = [];

    for (let i = 0; i < enabled.length; i++) {
        let info = enabled[i].split(':');
        let applet = appletObj[info[4]];
        if (!applet) {
            continue;
        }
        if (applet._newOrder !== null) {
            if (applet._newPanelId !== null) {
                info[0] = 'panel' + applet._newPanelId;
                info[1] = applet._zoneString;
                applet._newPanelId = null;
            }
            info[2] = applet._newOrder;
            applet._newOrder = null;
            newEnabled.push(info.join(':'));
        }
        else {
            newEnabled.push(enabled[i]);
        }
    }

    global.settings.set_strv('enabled-applets', newEnabled);
}

function updateAppletPanelHeights(force_recalc) {
    if(!enabledAppletDefinitions)
        return;

    for (let applet_id in enabledAppletDefinitions.idMap) {
        if (appletObj[applet_id]) {
            let appletDefinition = enabledAppletDefinitions.idMap[applet_id];
            let newheight;
            newheight = setHeightForPanel(appletDefinition.panel, appletDefinition.panel.panelPosition);

            if (appletObj[applet_id]._panelHeight != newheight || force_recalc) {
                appletObj[applet_id].setPanelHeight(newheight);
            }
        }
    }
}

// Deprecated, kept for compatibility reasons
function _find_applet(uuid) {
    return Extension.findExtensionDirectory(uuid, Extension.Type.APPLET);
}

function get_object_for_instance (appletId) {
    if (appletId in appletObj) {
        return appletObj[appletId];
    } else {
        return null;
    }
}

function get_object_for_uuid (uuid, instanceId) {
    return appletObj.find(x => x && x._uuid == uuid &&
                               (x.instance_id == instanceId || instanceId == uuid));
}


/**
 * loadAppletsOnPanel:
 * @panel (Panel.Panel): The panel
 *
 * Loads all applets on the panel if not loaded
 */
function loadAppletsOnPanel(panel) {
    let orientation;

    orientation = setOrientationForPanel(panel.panelPosition);

    let definition;

    for (let applet_id in enabledAppletDefinitions.idMap){
        definition = enabledAppletDefinitions.idMap[applet_id];
        if(definition.panelId == panel.panelId) {
            definition.panel = panel;
            definition.location = getLocation(panel, definition.location_label);
            definition.orientation = orientation;

            let extension = Extension.Type.APPLET.maps.objects[definition.uuid];
            if(extension) {
                addAppletToPanels(extension, definition);
            }
        }
    }
}

/**
 * updateAppletsOnPanel:
 * @panel (Panel.Panel): The panel
 *
 * Updates the definition, orientation and height of applets on the panel
 */
function updateAppletsOnPanel (panel) {
    let height;
    let orientation;

    orientation = setOrientationForPanel(panel.panelPosition);
    height = setHeightForPanel(panel, panel.panelPosition);

    let definition;

    for (let applet_id in enabledAppletDefinitions.idMap){
        definition = enabledAppletDefinitions.idMap[applet_id];
        if(definition.panel == panel) {
            definition.location = getLocation(panel, definition.location_label);
            definition.orientation = orientation;

            if (appletObj[applet_id]) {
                try {
                    appletObj[applet_id].setOrientation(orientation);
                    appletObj[applet_id].setPanelHeight(height);
                } catch (e) {
                    global.logError("Error during setPanelHeight() and setOrientation() call on applet: " + definition.uuid + "/" + applet_id, e);
                }
                removeAppletFromInappropriatePanel (Extension.Type.APPLET.maps.objects[definition.uuid], appletObj[applet_id], definition);
            }
        }
    }
}

/**
 * unloadAppletsOnPanel:
 * @panel (Panel.Panel): The panel
 *
 * Unloads all applets on the panel
 */
function unloadAppletsOnPanel (panel) {
    let panelApplets = enabledAppletDefinitions.idMap.filter(x => x.panel == panel);
    for (let i in panelApplets)
        removeAppletFromPanels(panelApplets[i], false);
}

function copyAppletConfiguration(panelId) {
    clipboard = enabledAppletDefinitions.idMap.filter(x => x.panelId == panelId);
}

function clearAppletConfiguration(panelId) {
    let raw = global.settings.get_strv("enabled-applets");
    raw = raw.filter(x => x.split(":")[0].slice(5) != panelId);
    global.settings.set_strv("enabled-applets", raw);
}

function pasteAppletConfiguration(panelId) {
    clearAppletConfiguration(panelId);

    let skipped = false;

    let raw = global.settings.get_strv("enabled-applets");
    let nextId = global.settings.get_int("next-applet-id");

    clipboard.forEach(function(x) {
        let uuid = x.uuid;
        let max = Extension.get_max_instances(uuid, Extension.Type.APPLET);
        if (max == -1 || raw.filter(a => a.split(":")[3] == uuid).length < max) {
            raw.push("panel" + panelId + ":" + x.location_label + ":" + x.order + ":" + uuid + ":" + nextId);
            nextId ++;
        } else {
            skipped = true;
        }
    });

    global.settings.set_int("next-applet-id", nextId);
    global.settings.set_strv("enabled-applets", raw);

    if (skipped) {
        let dialog = new ModalDialog.NotifyDialog(_("Certain applets do not allow multiple instances or were at their max number of instances so were not copied") + "\n\n");
        dialog.open();
    }
}

function getRunningInstancesForUuid(uuid) {
    return appletObj.filter(x => x && x._uuid == uuid);
}

function callAppletInstancesChanged(uuid) {
    for (let applet_id in enabledAppletDefinitions.idMap) {
        if (appletObj[applet_id]) {
            if (uuid == appletObj[applet_id]._uuid) {
                appletObj[applet_id].on_applet_instances_changed();
            }
        }
    }
}

function getLocation(panel, location) {
    return {"center": panel._centerBox,
            "right" : panel._rightBox,
            "left"  : panel._leftBox}[location];
}
