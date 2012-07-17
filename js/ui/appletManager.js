// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Main = imports.ui.main;
const Applet = imports.ui.applet;

// Maps uuid -> metadata object
const appletMeta = {};
// Maps uuid -> applet objects
const appletObj = {};
// Maps uuid -> importer object (applet directory tree)
const applets = {};

// An applet can assume a role
// Instead of hardcoding looking for a particular applet,
// We let applets announce that they can fill a particular
// role, using the 'hook' metadata entry.
// For now, just notifications, but could be expanded.
// question - should multiple applets be able to fill
// the same role?
const Roles = {
    NOTIFICATIONS: 'notifications'
}

let AppletHooks = {
    notifications: false
}

var enabledApplets;
var appletsCurrentlyInPanel = [];
var userAppletsDir = null;

function init() {
    let userAppletsPath = GLib.build_filenamev([global.userdatadir, 'applets']);
    userAppletsDir = Gio.file_new_for_path(userAppletsPath);
    try {
        if (!userAppletsDir.query_exists(null))
            userAppletsDir.make_directory_with_parents(null);
    } catch (e) {
        global.logError('' + e);
    }
            
    global.settings.connect('changed::enabled-applets', onEnabledAppletsChanged);
    enabledApplets = global.settings.get_strv('enabled-applets');
}

function onEnabledAppletsChanged() {
    try {    
        let newEnabledApplets = global.settings.get_strv('enabled-applets');        
    
        for (let i=0; i<newEnabledApplets.length; i++) {
            let appletDefinition = newEnabledApplets[i];   
            if (enabledApplets.indexOf(appletDefinition) == -1) {                    
                // New applet or changed definition
                add_applet_to_panels(appletDefinition);                                                
            }            
        }
        
        for (let i=0; i<enabledApplets.length; i++) {
            let appletDefinition = enabledApplets[i];   
            if (newEnabledApplets.indexOf(appletDefinition) == -1) {                    
                // Applet was removed or definition was changed...
                let elements = appletDefinition.split(":");
                if (elements.length == 4) {
                    let uuid = elements[3];
                    let panel = Main.panel;
                    if (elements[0] == "panel2") {
                        panel = Main.panel2;
                    }
                    let orientation = St.Side.TOP;
                    if (panel.bottomPosition) {
                        orientation = St.Side.BOTTOM;
                    }
                    let uuidIsStillPresent = false;
                    for (let j=0; j<newEnabledApplets.length; j++) {
                        if (newEnabledApplets[j].match(uuid)) {
                            uuidIsStillPresent = true;
                            break;
                        }
                    }
                    if (!uuidIsStillPresent) {
                        // Applet was removed                        
                        let directory = _find_applet(uuid);
                        if (directory != null) {
                            let applet = loadApplet(uuid, directory, orientation);
                            if (applet._panelLocation != null) {
                                applet._panelLocation.remove_actor(applet.actor);
                                applet._panelLocation = null;
                            }
                            if (applet._hook)
                                AppletHooks[applet._hook] = false;
                        }
                        appletsCurrentlyInPanel.splice(appletsCurrentlyInPanel.indexOf(uuid), 1);
                    }
                }                                                         
            }            
        }
           
        enabledApplets = newEnabledApplets;
    }
    catch(e) {
        global.logError('Failed to refresh list of applets ' + e); 
    }
    
    Main.statusIconDispatcher.redisplay();
}

function loadApplets() {    
    let foundAtLeastOneApplet = false;
    for (let i=0; i<enabledApplets.length; i++) {                
        add_applet_to_panels(enabledApplets[i]);
        let elements = enabledApplets[i].split(":");
        if (elements.length == 4) {
            foundAtLeastOneApplet = true;
        }        
    }    
    if (!foundAtLeastOneApplet) {
        global.settings.reset('enabled-applets');
    }
}

function add_applet_to_panels(appletDefinition) {
    try {                 
        // format used in gsettings is 'panel:location:order:uuid' where panel is something like 'panel1', location is
        // either 'left', 'center' or 'right' and order is an integer representing the order of the applet within the panel/location (i.e. 1st, 2nd etc..).                     
        let elements = appletDefinition.split(":");
        let center = false;
        if (elements.length == 4) {
            let panel = Main.panel;
            if (elements[0] == "panel2") {
                panel = Main.panel2;
            }
            let location = panel._leftBox;
            if (elements[1] == "center") {
                location = panel._centerBox;
                center = true;
            }
            else if (elements[1] == "right") {
                location = panel._rightBox;
            }
            let order;
            try{
                order = parseInt(elements[2]);
            }catch(e){
                order = 0;
            }
            let uuid = elements[3];
            let orientation = St.Side.TOP;
            if (panel.bottomPosition) {
                orientation = St.Side.BOTTOM;
            }
            let directory = _find_applet(uuid);
            if (directory != null) {
                // Load the applet
                let applet = loadApplet(uuid, directory, orientation);
                applet._order = order;
                
                // Remove it from its previous panel location (if it had one)
                if (applet._panelLocation != null) {
                    applet._panelLocation.remove_actor(applet.actor);
                    applet._panelLocation = null;
                }
                                            
                // Add it to its new panel location
                let children = location.get_children();                    
                let appletsToMove = [];
                for (let i=0; i<children.length;i++) {
                    let child = children[i];
                    if ((typeof child._applet !== "undefined") && (child._applet instanceof Applet.Applet)) {                         
                        if (order < child._applet._order) {                                
                            appletsToMove.push(child);                            
                        }
                    }                    
                }
                                
                for (let i=0; i<appletsToMove.length; i++) {
                    location.remove_actor(appletsToMove[i]);                    
                }

                if (center) {
                    location.add(applet.actor, {x_align: St.Align.CENTER_SPECIAL});
                } else {
                    location.add(applet.actor);    
                }

                applet._panelLocation = location;                  
                for (let i=0; i<appletsToMove.length; i++) {
                    location.add(appletsToMove[i]);
                }
                appletsCurrentlyInPanel.push(uuid);
                if (applet._hook)
                    AppletHooks[applet._hook] = true; 
                applet.on_applet_added_to_panel();
            } 
            else {
                global.logError('Could not find applet ' + uuid + ', make sure its directory is present and matches its UUID');
            }     
        }
        else {
            global.logError('Invalid applet definition: ' + appletDefinition);
        }
    }
    catch(e) {
        global.logError('Failed to load applet ' + appletDefinition + e); 
    }
}

function _find_applet(uuid) {    
    let directory = null;
    directory = _find_applet_in(uuid, userAppletsDir);
    if (directory == null) {
        let systemDataDirs = GLib.get_system_data_dirs();    
        for (let i = 0; i < systemDataDirs.length; i++) {
            let dirPath = systemDataDirs[i] + '/cinnamon/applets';
            let dir = Gio.file_new_for_path(dirPath);
            if (dir.query_exists(null))
                directory = _find_applet_in(uuid, dir);
                if (directory != null) {
                    break;
                }
            }
    }
    return(directory);
}

function _find_applet_in(uuid, dir) {       
    let directory = null;
    let fileEnum;
    let file, info;
    try {
        fileEnum = dir.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
    } catch (e) {
        global.logError('' + e);
       return null;
    }

    while ((info = fileEnum.next_file(null)) != null) {
        let fileType = info.get_file_type();
        if (fileType != Gio.FileType.DIRECTORY)
            continue;
        let name = info.get_name();            
        if (name == uuid) {
            let child = dir.get_child(name);
            directory = child;
            break;
        }
    }
    fileEnum.close(null);    
    return(directory);
}

function get_applet_enabled(uuid) {
    return appletsCurrentlyInPanel.indexOf(uuid) != -1;
}

function get_role_provider_exists(role) {
    if (role in AppletHooks && AppletHooks[role] == true) {
        return true;
    }
    return false;
}

function loadApplet(uuid, dir, orientation) {    
    let info;    
    let applet = null;
    
    let metadataFile = dir.get_child('metadata.json');
    if (!metadataFile.query_exists(null)) {
        global.logError(uuid + ' missing metadata.json');
        return null;
    }

    let metadataContents;
    try {
        metadataContents = Cinnamon.get_file_contents_utf8_sync(metadataFile.get_path());
    } catch (e) {
        global.logError(uuid + ' failed to load metadata.json: ' + e);
        return null;
    }
    let meta;
    try {
        meta = JSON.parse(metadataContents);
    } catch (e) {
        global.logError(uuid + ' failed to parse metadata.json: ' + e);
        return null;
    }

    let requiredProperties = ['uuid', 'name', 'description'];
    for (let i = 0; i < requiredProperties.length; i++) {
        let prop = requiredProperties[i];
        if (!meta[prop]) {
            global.logError(uuid + ' missing "' + prop + '" property in metadata.json');
            return null;
        }
    }

    let hook = meta['role'];
    if (hook) {
        if (!(hook in AppletHooks)) {
            global.logError('Unknown hook definition: ' + hook + ' in metadata.json of applet ' + uuid);
            return null;
        }
    }

    if (applets[uuid] != undefined) {
        log(uuid + ' applet already loaded');        
        appletObj[uuid].setOrientation(orientation);
        return (appletObj[uuid]);
    }
   
    if (uuid != meta.uuid) {
        global.logError(uuid + ' uuid "' + meta.uuid + '" from metadata.json does not match directory name "' + uuid + '"');
        return null;
    }
   
    appletMeta[uuid] = meta;    
    meta.path = dir.get_path();
    meta.error = '';    
   
    let appletJs = dir.get_child('applet.js');
    if (!appletJs.query_exists(null)) {
        global.logError(uuid + ' missing applet.js');
        return null;
    }
    let stylesheetPath = null;
    let themeContext = St.ThemeContext.get_for_stage(global.stage);
    let theme = themeContext.get_theme();
    let stylesheetFile = dir.get_child('stylesheet.css');
    if (stylesheetFile.query_exists(null)) {
        try {
            theme.load_stylesheet(stylesheetFile.get_path());
        } catch (e) {
            global.logError(uuid + ' stylesheet parse error: ' + e);
            return null;
        }
    }

    let appletModule;
    try {
        global.add_extension_importer('imports.ui.appletManager.applets', meta.uuid, dir.get_path());
        appletModule = applets[meta.uuid].applet;
    } catch (e) {
        if (stylesheetPath != null)
            theme.unload_stylesheet(stylesheetPath);
        global.logError(uuid + " " + e);
        return null;
    }

    if (!appletModule.main) {
        global.logError(uuid + ' missing \'main\' function');
        return null;
    }

    try {        
        applet = appletModule.main(meta, orientation);                
        global.log('Loaded applet ' + meta.uuid);        
    } catch (e) {
        if (stylesheetPath != null)
            theme.unload_stylesheet(stylesheetPath);
        global.logError(uuid + ' failed to evaluate main function:' + e);
        return null;
    }        
    
    if (hook) {
         applet._hook = hook;
    }

    appletObj[uuid] = applet;  
    applet._uuid = uuid;
    
    applet.finalizeContextMenu();
    
    return(applet);
}

function _removeAppletFromPanel(menuitem, event, uuid) {     
    for (let i=0; i<enabledApplets.length; i++) {
        let appletDefinition = enabledApplets[i];           
        let elements = appletDefinition.split(":");
        if (elements.length == 4) {
            let applet_uuid = elements[3];                
            if (uuid == applet_uuid) {   
                newEnabledApplets = enabledApplets.slice(0);             
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
                if (appletZone == zone) applets.push(panel_string+":"+zone_string+":"+appletOrder+":"+applet._uuid);
            }
        }
    }
    for (var i in allApplets){
        allApplets[i]._newPanelLocation = null;
        allApplets[i]._newOrder = null;
    }
    global.settings.set_strv('enabled-applets', applets);
}
