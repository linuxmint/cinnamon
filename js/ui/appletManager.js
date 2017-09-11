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
const {getModuleByIndex} = imports.misc.fileUtils;
const Gettext = imports.gettext;

// Maps uuid -> importer object (applet directory tree)
let applets;
// Kept for compatibility
let appletMeta;
// Maps applet_id -> applet objects
const appletObj = [];
let appletsLoaded = false;

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

let rawDefinitions;
let definitions = [];
let clipboard = [];
let promises = [];

function initEnabledApplets() {
    for (let i = 0; i < definitions.length; i++) {
        promises.push(Extension.loadExtension(definitions[i].uuid, Extension.Type.APPLET))
    }
    return Promise.all(promises).then(function() {
        promises = [];
    });
}

function unloadRemovedApplets(removedAppletUUIDs) {
    for (let i = 0; i < removedAppletUUIDs.length; i++) {
         promises.push(Extension.unloadExtension(removedAppletUUIDs[i], Extension.Type.APPLET));
    }
    return Promise.all(promises).then(function() {
        promises = [];
    });
}

function init(startTime) {
    applets = imports.applets;
    appletMeta = Extension.Type.APPLET.legacyMeta;
    appletsLoaded = false;

    // Load all applet extensions, the applets themselves will be added in finishExtensionLoad
    definitions = getDefinitions();

    return initEnabledApplets().then(function() {
        appletsLoaded = true;
        global.settings.connect('changed::enabled-applets', onEnabledAppletsChanged);
        global.log('AppletManager.init() started in %d ms'.format(new Date().getTime() - startTime));
    });
}

function getAppletDefinition({uuid, applet_id, location_label}) {
    let index = definitions.findIndex(function(definition) {
        return (definition.uuid === uuid
            && definition.applet_id === applet_id
            && definition.location_label === location_label
            || (!uuid && !location_label && definition.applet_id === applet_id));
    });
    if (!definitions[index]) {
        return null;
    }
    return definitions[index];
}

// Callback for extension.js
function finishExtensionLoad(extensionIndex) {
    // Add all applet instances for this extension
    let extension = Extension.extensions[extensionIndex];
    for (let i = 0; i < definitions.length; i++) {
        if (definitions[i].uuid !== extension.uuid) {
            continue;
        }
        if (!addAppletToPanels(extension, definitions[i])) {
            return false;
        }
    }
    return true;
}

// Callback for extension.js
function prepareExtensionUnload(extension, deleteConfig) {
    // Remove all applet instances for this extension
    for (var i = 0; i < definitions.length; i++) {
        if (extension.uuid !== definitions[i].uuid) {
            continue;
        }
        removeAppletFromPanels(definitions[i], deleteConfig);
    }
}

function getDefinitions() {
    let _definitions = [];
    rawDefinitions = global.settings.get_strv('enabled-applets');

    // Upgrade settings if required
    checkForUpgrade(rawDefinitions);
    // Parse all definitions
    for (let i = 0; i < rawDefinitions.length; i++) {
        let appletDefinition = createAppletDefinition(rawDefinitions[i]);
        if (appletDefinition) {
            _definitions.push(appletDefinition);
        }
    }

    return _definitions;
}

function createAppletDefinition(definition) {
    // format used in gsettings is 'panel:location:order:uuid:applet_id' where:
    // - panel is something like 'panel1',
    // - location is either 'left', 'center' or 'right',
    // - order is an integer representing the order of the applet within the panel/location (i.e. 1st, 2nd etc..).
    // - applet_id is a unique id assigned to the applet instance when added.
    let elements = definition.split(":");
    if (elements.length > 4) {
        // Its important we check if the definition object already exists before creating a new object, otherwise we are
        // creating duplicate references that could cause memory leaks.
        let existingDefinition = getAppletDefinition({
            uuid: elements[3],
            applet_id: elements[4],
            location_label: elements[1]
        });
        if (existingDefinition) {
            return existingDefinition;
        }
        let panelId = parseInt(elements[0].slice(5));
        // When copying an applet configuration and pasting it to a new panel, then removing the old panel,
        // the applet's ID doesn't get updated. Straight forward sanity check here.
        if (panelId > Main.panelManager.panels.length - 1) {
            panelId = Main.panelManager.panels.length - 1;
        }
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
            panelId: panelId,
            orientation: orientation,
            location: location,
            location_label: elements[1],
            center: elements[1] == "center",
            order: order,
            uuid: elements[3],
            applet_id: elements[4],
            applet: null
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

function setHeightForPanel(panel) {
    let height;
    switch (panel.panelPosition)  // for vertical panels use the width instead of the height
    {
        case 0:
        case 1:
                height = panel.actor.get_height();
        break;
        case 2:
        case 3:
                height = panel.actor.get_width();
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
    return ( a.panelId === b.panelId && a.orientation === b.orientation && a.location == b.location && a.order == b.order);
}

function onEnabledAppletsChanged() {
    try {
        let oldDefinitions = definitions;
        definitions = getDefinitions();
        let removedAppletUUIDs = [];
        // Remove all applet instances that do not exist in the definition anymore.
        for (let i = 0; i < oldDefinitions.length; i++) {
            let appletDefinition = getAppletDefinition({
                applet_id: oldDefinitions[i].applet_id,
                uuid: oldDefinitions[i].uuid,
                location_label: oldDefinitions[i].location_label
            });
            if (!appletDefinition) {
                removedAppletUUIDs.push(oldDefinitions[i].uuid);
                removeAppletFromPanels(
                    oldDefinitions[i],
                    Extension.get_max_instances(oldDefinitions[i].uuid, Extension.Type.APPLET) !== 1
                );
            }
        }
        // Make a unique array of removed UUIDs
        let uniqueSet = new Set();
        let uniqueRemovedUUIDs = [];
        for (let i = 0; i < removedAppletUUIDs.length; i++) {
          if (uniqueSet.has(removedAppletUUIDs[i]) === false) {
            uniqueRemovedUUIDs.push(removedAppletUUIDs[i]);
            uniqueSet.add(removedAppletUUIDs[i]);
          }
        }
        // Unload all applet extensions that do not exist in the definition anymore.
        unloadRemovedApplets(uniqueRemovedUUIDs).then(function() {
            // Add or move applet instances of already loaded applet extensions
            const getOldAppletDefinition = function(applet_id) {
                let index = oldDefinitions.findIndex(function(definition) {
                    return definition.applet_id === applet_id;
                });
                if (index === -1) {
                    return null;
                }
                return oldDefinitions[index];
            };
            for (let i = 0; i < definitions.length; i++) {
                let newDefinition = getAppletDefinition({
                    applet_id: definitions[i].applet_id,
                    uuid: definitions[i].uuid,
                    location_label:definitions[i].location_label
                });
                let oldDefinition = getOldAppletDefinition(definitions[i].applet_id);

                if (!oldDefinition || !appletDefinitionsEqual(newDefinition, oldDefinition)) {
                    let extension = Extension.getExtension(newDefinition.uuid);
                    if (extension) {
                        addAppletToPanels(extension, newDefinition);
                    }
                }
            }

            // Make sure all applet extensions are loaded.
            // Once loaded, the applets will add themselves via finishExtensionLoad
            initEnabledApplets();
            Main.statusIconDispatcher.redisplay();
        });
    } catch(e) {
        global.logError('Failed to refresh list of applets', e);
    }
}

function removeAppletFromPanels(appletDefinition, deleteConfig) {
    let {applet, uuid, applet_id} = appletDefinition;
    if (applet) {
        try {
            applet._onAppletRemovedFromPanel(deleteConfig);
        } catch (e) {
            global.logError(`Error during on_applet_removed_from_panel() call on applet: ${uuid}/${applet_id}`, e);
        }

        if (applet._panelLocation != null) {
            applet._panelLocation.remove_actor(applet.actor);
            applet._panelLocation = null;
        }
        appletDefinition.applet = null;

        if (deleteConfig) {
            _removeAppletConfigFile(uuid, applet_id);
        }

        /* normal occurs during _onAppletRemovedFromPanel, but when a panel is removed,
         * the applet object hasn't had the instance removed yet, so let's run it one more time
         * here when everything has been updated.
         */
        callAppletInstancesChanged(uuid);
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
    if (!appletDefinition.panelId) return true;

    try {
        // Create the applet
        let applet = createApplet(extension, appletDefinition);
        if(applet == null)
            return false;

        // Now actually lock the applets role and set the provider
        extension.lockRole(applet);

        applet._order = appletDefinition.order;

        let location = appletDefinition.location;

        // Remove it from its previous panel location (if it had one)
        if (applet._panelLocation != null && location != applet._panelLocation) {
            applet._panelLocation.remove_actor(applet.actor);
            applet._panelLocation = null;
        }

        let before = location.get_children()
            .find(x => {
                return x._applet && (x._applet instanceof Applet.Applet) && (appletDefinition.order < x._applet._order)
            });

        if (before) {
            if (applet._panelLocation == null) {
                location.insert_child_below(applet.actor, before);
            } else {
                location.set_child_below_sibling(applet.actor, before);
            }
        } else {
            if (applet._panelLocation == null) {
                location.add_actor(applet.actor);
            } else {
                location.set_child_above_sibling(applet.actor, null);
            }
        }

        applet._panelLocation = location;

        applet.on_applet_added_to_panel_internal(appletsLoaded);

        removeAppletFromInappropriatePanel (extension, appletDefinition);

        return true;
    } catch(e) {
        extension.unlockRole();
        Extension.logError('Failed to load applet: ' + appletDefinition.uuid + "/" + appletDefinition.applet_id, extension.uuid, e);
        return false;
    }
}

function removeAppletFromInappropriatePanel (extension, appletDefinition) {
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
    if (appletDefinition.applet instanceof Applet.IconApplet && !(appletDefinition.applet instanceof Applet.TextIconApplet)) return;
    if (appletDefinition.overrides && appletDefinition.overrides.indexOf('orient') != -1) return;

    let allowedLayout = appletDefinition.applet.getAllowedLayout();

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
    if (Extension.Type.APPLET.roles[role]
        && Extension.Type.APPLET.roles[role].roleProvider) {
        return Extension.Type.APPLET.roles[role].roleProvider;
    }
    return null;
}

function get_role_provider_exists(role) {
    return get_role_provider(role) != null;
}

function createApplet(extension, appletDefinition) {
    if (!appletDefinition.panelId) return null;

    let {applet_id, uuid, orientation} = appletDefinition;

    let panel = Main.panelManager.panels[appletDefinition.panelId];
    let panel_height = setHeightForPanel(panel);

    if (appletDefinition.applet != null) {
        global.log(`${uuid}/${applet_id} applet already loaded`);
        appletDefinition.applet.setOrientation(orientation);
        if (appletDefinition.applet._panelHeight !== panel_height) {
            appletDefinition.applet.setPanelHeight(panel_height);
        }

        return appletDefinition.applet;
    }

    let applet;
    try {
        applet = getModuleByIndex(extension.moduleIndex).main(extension.meta, orientation, panel_height, applet_id);
    } catch (e) {
        Extension.logError(`Failed to evaluate 'main' function on applet: ${uuid}/${applet_id}`, uuid, e);
        return null;
    }

    applet._uuid = extension.uuid;
    applet._meta = extension.meta;
    applet.instance_id = applet_id;
    applet.panel = panel;
    appletDefinition.applet = applet;

    Gettext.bindtextdomain(applet._uuid, GLib.get_home_dir() + "/.local/share/locale");

    applet.finalizeContextMenu();

    return applet;
}

function _removeAppletFromPanel(uuid, applet_id) {

    for (let i=0; i < rawDefinitions.length; i++) {
        let appletDefinition = createAppletDefinition(rawDefinitions[i]);
        if (appletDefinition) {
            if (uuid == appletDefinition.uuid && applet_id == appletDefinition.applet_id) {
                let newEnabledApplets = rawDefinitions.slice(0);
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
        let {applet} = getAppletDefinition({
            uuid: info[3],
            applet_id: info[4],
            location_label: info[1]
        });
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
    if(!definitions || definitions.length === 0)
        return;

    for (let i = 0; i < definitions.length; i++) {
        if (definitions[i] && definitions[i].applet) {
            let newheight = setHeightForPanel(definitions[i].applet.panel);
            if (definitions[i].applet._panelHeight !== newheight || force_recalc) {
                definitions[i].applet.setPanelHeight(newheight);
            }
        }
    }
}

// Deprecated, kept for compatibility reasons
function _find_applet(uuid) {
    const {userDir, folder} = Extension.Type.APPLET;
    return Extension.findExtensionDirectory(uuid, userDir, folder);
}

function get_object_for_instance (appletId) {
    let {applet} = getAppletDefinition({applet_id: appletId});
    if (!applet) {
        return null;
    }
    return applet;
}

function get_object_for_uuid (uuid, instanceId) {
    let index = definitions.findIndex(function(definition) {
        return (definition
            && definition.applet
            && definition.applet._uuid === uuid
            && (definition.applet_id === instanceId || instanceId === uuid));
    });
    if (index === -1) {
        return null;
    }
    return definitions[index].applet;
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

    for (var i = 0; i < definitions.length; i++) {
        if (definitions[i].panelId === panel.panelId) {
            definitions[i].panelId = panel.panelId;
            definitions[i].location = getLocation(panel, definition.location_label);
            definitions[i].orientation = orientation;
            let extension = Extension.getExtension(definition.uuid);
            if (extension) {
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
    height = setHeightForPanel(panel);

    for (let i = 0; i < definitions.length; i++) {
        if (definitions[i].panelId === panel.panelId) {
            definitions[i].orientation = orientation;

            if (definitions[i].applet) {
                definitions[i].location = getLocation(definitions[i].applet.panel, definitions[i].location_label);
                try {
                    definitions[i].applet.setOrientation(orientation);
                    definitions[i].applet.setPanelHeight(height);
                } catch (e) {
                    global.logError("Error during setPanelHeight() and setOrientation() call on applet: " + definitions[i].uuid + "/" + definitions[i].applet_id, e);
                }
                removeAppletFromInappropriatePanel(Extension.getExtension(definitions[i].uuid), definitions[i]);
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
function unloadAppletsOnPanel (panelId) {
    for (let i = 0; i < definitions.length; i++) {
        if (definitions[i].panelId !== panelId) {
            continue;
        }
        removeAppletFromPanels(definitions[i], false);
    }
}

function copyAppletConfiguration(panelId) {
    clipboard = definitions.filter(definition => definition.panelId === panelId);
}

function clearAppletConfiguration(panelId) {
    rawDefinitions = global.settings.get_strv("enabled-applets");
    let removedDefinitions = [];
    for (let i = 0; i < rawDefinitions.length; i++) {
        let rawDefinition = rawDefinitions[i].split(':');
        if (parseInt(rawDefinition[0].split('panel')[1]) === panelId) {
            removedDefinitions.push(i);
        }
    }
    for (var i = 0; i < removedDefinitions.length; i++) {
        rawDefinitions.splice(removedDefinitions[i], 1);
    }
    global.settings.set_strv("enabled-applets", rawDefinitions);
}

function pasteAppletConfiguration(panelId) {
    clearAppletConfiguration(panelId);

    let skipped = false;

    rawDefinitions = global.settings.get_strv("enabled-applets");
    let nextId = global.settings.get_int("next-applet-id");

    for (let i = 0; i < clipboard.length; i++) {
        let {uuid, location_label, order} = clipboard[i];
        let max = Extension.get_max_instances(uuid, Extension.Type.APPLET);
        if (max === -1 || rawDefinitions.filter(a => a.split(":")[3] === uuid).length < max) {
            rawDefinitions.push(`panel${panelId}:${location_label}:${order}:${uuid}:${nextId}`);
            nextId ++;
        } else {
            skipped = true;
        }
    }

    global.settings.set_int("next-applet-id", nextId);
    global.settings.set_strv("enabled-applets", rawDefinitions);

    if (skipped) {
        let dialog = new ModalDialog.NotifyDialog(_("Certain applets do not allow multiple instances or were at their max number of instances so were not copied") + "\n\n");
        dialog.open();
    }
}

function getRunningInstancesForUuid(uuid) {
    return definitions.filter(function(definition) {
        return definition.uuid === uuid;
    }).map(function(definition) {
        return definition.applet;
    });
}

function callAppletInstancesChanged(uuid) {
    for (var i = 0; i < definitions.length; i++) {
        if (definitions[i]
            && definitions[i].applet
            && uuid === definitions[i].uuid) {
            definitions[i].applet.on_applet_instances_changed();
        }
    }
}

function getLocation(panel, location) {
    return {"center": panel._centerBox,
            "right" : panel._rightBox,
            "left"  : panel._leftBox}[location];
}
