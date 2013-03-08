// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const Applet = imports.ui.applet;
const Extension = imports.ui.extension;
const DBus = imports.dbus;

// Maps uuid -> metadata object
var appletMeta;
// Maps uuid -> importer object (applet directory tree)
var applets;
// Maps applet_id -> applet objects
const appletObj = {};
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
    WINDOWLIST: 'windowlist'
}

var enabledAppletDefinitions;

function init() {
    appletMeta = Extension.meta;
    applets = Extension.importObjects;

    let foundAtLeastOneApplet = false;
    appletsLoaded = false;
    
    // Load all applet extensions, the applets themselves will be added in finishExtensionLoad
    enabledAppletDefinitions = getEnabledAppletDefinitions();
    for (let uuid in enabledAppletDefinitions.uuidMap) {
        Extension.loadExtension(uuid, Extension.Type.APPLET);
        foundAtLeastOneApplet = true;
    }
    appletsLoaded = true;
    
    global.settings.connect('changed::enabled-applets', onEnabledAppletsChanged);
    
    if (!foundAtLeastOneApplet) {
        global.settings.reset('enabled-applets');
    }
}

// Callback for extension.js
function finishExtensionLoad(extension) {
    // Add all applet instances for this extension
    let definitions = enabledAppletDefinitions.uuidMap[extension.uuid];
    if (definitions) {
        for(let i=0; i<definitions.length; i++) {
            addAppletToPanels(extension, definitions[i]);
        }
    }
    return true;
}

// Callback for extension.js
function prepareExtensionUnload(extension) {
    // Remove all applet instances for this extension
    for(let applet_id in extension._loadedDefinitions) {
        removeAppletFromPanels(extension._loadedDefinitions[applet_id]);
    }
}

function getEnabledAppletDefinitions() {
    let result = {
        // the raw list from gsettings
        raw: global.settings.get_strv('enabled-applets'),
        // maps uuid -> list of applet definitions
        uuidMap: {},
        // maps applet_id -> single applet definition
        idMap: {}
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
    if (elements.length == 5) {
        let panel = elements[0] == "panel2" ? Main.panel2 : Main.panel;
        let orientation = panel.bottomPosition ? St.Side.BOTTOM : St.Side.TOP;
        let order;
        try { order = parseInt(elements[2]); } catch(e) { order = 0; }
        
        let location = panel._leftBox;
        let center = elements[1] == "center";
        if (center)
            location = panel._centerBox;
        else if (elements[1] == "right")
            location = panel._rightBox;
        
        return {
            panel: panel,
            orientation: orientation,
            location: location,
            center: center,
            order: order,
            uuid: elements[3],
            applet_id: elements[4]
        };
    }

    global.logError("Bad applet definition: " + definition);
    return null;
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
        let newEnabledAppletDefinitions = getEnabledAppletDefinitions();
        // Remove all applet instances that do not exist in the definition anymore.
        for (let applet_id in enabledAppletDefinitions.idMap) {
            if(!newEnabledAppletDefinitions.idMap[applet_id]) {
                removeAppletFromPanels(enabledAppletDefinitions.idMap[applet_id]);
            }
        }
        
        // Unload all applet extensions that do not exist in the definition anymore.
        for (let uuid in enabledAppletDefinitions.uuidMap) {
            if(!newEnabledAppletDefinitions.uuidMap[uuid]) {
                Extension.unloadExtension(uuid);
            }
        }
        
        // Add or move applet instances of already loaded applet extensions
        for (let applet_id in newEnabledAppletDefinitions.idMap) {
            let newDef = newEnabledAppletDefinitions.idMap[applet_id];
            let oldDef = enabledAppletDefinitions.idMap[applet_id];
            
            if(!oldDef || !appletDefinitionsEqual(newDef, oldDef)) {
                let extension = Extension.objects[newDef.uuid];
                if(extension) {
                    addAppletToPanels(extension, newDef);
                }
            }
        }
        
        enabledAppletDefinitions = newEnabledAppletDefinitions;
        
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

function removeAppletFromPanels(appletDefinition) {
    let applet = appletObj[appletDefinition.applet_id];
    if (applet) {
        try {
            applet._onAppletRemovedFromPanel();
        } catch (e) {
            global.logError("Error during on_applet_removed_from_panel() call on applet: " + appletDefinition.uuid + "/" + appletDefinition.applet_id, e);
        }

        if (applet._panelLocation != null) {
            applet._panelLocation.remove_actor(applet.actor);
            applet._panelLocation = null;
        }

        delete applet._extension._loadedDefinitions[appletDefinition.applet_id];
        delete appletObj[appletDefinition.applet_id];

        _removeAppletConfigFile(appletDefinition.uuid, appletDefinition.applet_id);

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
            file.delete(null, null);
        } catch (e) {
            global.logError("Problem removing applet config file during cleanup.  UUID is " + uuid + " and filename is " + config_path);
        }
    }
}

function addAppletToPanels(extension, appletDefinition) {
    // Try to lock the applets role
    if(!extension.lockRole(null))
        return;
    
    try {
        // Create the applet
        let applet = createApplet(extension, appletDefinition);
        if(applet == null)
            return;
        
        // Now actually lock the applets role and set the provider
        if(!extension.lockRole(applet))
            return;

        applet._order = appletDefinition.order;
        applet._extension = extension;

        // Remove it from its previous panel location (if it had one)
        if (applet._panelLocation != null) {
            applet._panelLocation.remove_actor(applet.actor);
            applet._panelLocation = null;
        }

        // Add it to its new panel location
        let children = appletDefinition.location.get_children();
        let appletsToMove = [];
        for (let i=0; i<children.length;i++) {
            let child = children[i];
            if ((typeof child._applet !== "undefined") && (child._applet instanceof Applet.Applet)) {
                if (appletDefinition.order < child._applet._order) {
                    appletsToMove.push(child);
                }
            }
        }

        for (let i=0; i<appletsToMove.length; i++) {
            appletDefinition.location.remove_actor(appletsToMove[i]);
        }

        if (appletDefinition.center) {
            appletDefinition.location.add(applet.actor, {x_align: St.Align.CENTER_SPECIAL});
        } else {
            appletDefinition.location.add(applet.actor);
        }

        applet._panelLocation = appletDefinition.location;
        for (let i=0; i<appletsToMove.length; i++) {
            appletDefinition.location.add(appletsToMove[i]);
        }
        
        if(!extension._loadedDefinitions) {
            extension._loadedDefinitions = {};
        }
        extension._loadedDefinitions[appletDefinition.applet_id] = appletDefinition;
        
        applet.on_applet_added_to_panel(appletsLoaded);
    }
    catch(e) {
        extension.unlockRole();
        extension.logError('Failed to load applet: ' + appletDefinition.uuid + "/" + appletDefinition.applet_id, e);
    }
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
    let applet_id = appletDefinition.applet_id;
    let orientation = appletDefinition.orientation;
    let panel_height =  appletDefinition.panel.actor.get_height();
    
    if (appletObj[applet_id] != undefined) {
        global.log(applet_id + ' applet already loaded');
        if (appletObj[applet_id]._panelHeight != panel_height) {
            appletObj[applet_id].setPanelHeight(panel_height);
        }
        appletObj[applet_id].setOrientation(orientation);
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
    applet.instance_id = applet_id;

    applet.finalizeContextMenu();

    return(applet);
}

function _removeAppletFromPanel(menuitem, event, uuid, applet_id) {
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
    let panels = [Main.panel, Main.panel2];
    let zones_strings = ["left", "center", "right"];
    let allApplets = new Array();
    for (var i in panels){
        let panel = panels[i];
        if (!panel) continue;
        for (var j in zones_strings){
            let zone_string = zones_strings[j];
            let zone = panel["_"+zone_string+"Box"];
            let children = zone.get_children();
            for (var k in children) if (children[k]._applet) allApplets.push(children[k]._applet);
        }
    }
    let applets = new Array();
    for (var i in panels){
        let panel = panels[i];
        if (!panel) continue;
        let panel_string;
        if (panel == Main.panel) panel_string = "panel1";
        else panel_string = "panel2";
        for (var j in zones_strings){
            let zone_string = zones_strings[j];
            let zone = panel["_"+zone_string+"Box"];
            for (var k in allApplets){
                let applet = allApplets[k];
                let appletZone;
                if (applet._newPanelLocation != null) appletZone = applet._newPanelLocation;
                else appletZone = applet._panelLocation;
                let appletOrder;
                if (applet._newOrder != null) appletOrder = applet._newOrder;
                else appletOrder = applet._order;

                if (appletZone == zone) applets.push(panel_string+":"+zone_string+":"+appletOrder+":"+applet._uuid+":"+applet.instance_id);
            }
        }
    }
    for (var i in allApplets){
        allApplets[i]._newPanelLocation = null;
        allApplets[i]._newOrder = null;
    }
    global.settings.set_strv('enabled-applets', applets);
}

function updateAppletPanelHeights(force_recalc) {
    if(!enabledAppletDefinitions)
        return;
    
    for (let applet_id in enabledAppletDefinitions.idMap) {
        if (appletObj[applet_id]) {
            let appletDefinition = enabledAppletDefinitions.idMap[applet_id];
            let newheight = appletDefinition.panel.actor.get_height();
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

function get_object_for_uuid (uuid) {
    for (let instanceid in appletObj) {
        if (appletObj[instanceid]._uuid == uuid) {
            return appletObj[instanceid]
        }
    }
    return null;
}

function get_num_instances_for_applet (uuid) {
    if (uuid in appletMeta) {
        if ("max-instances" in appletMeta[uuid]) {
            return parseInt(appletMeta[uuid]["max-instances"]);
       }
    }
    return 1;
}
