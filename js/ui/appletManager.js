// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Signals = imports.signals;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Config = imports.misc.config;
const Main = imports.ui.main;
const Applet = imports.ui.applet;
const Gtk = imports.gi.Gtk;
const PopupMenu = imports.ui.popupMenu;

// Maps uuid -> metadata object
const appletMeta = {};
// Maps uuid -> applet objects
const appletObj = {};
// Maps uuid -> importer object (applet directory tree)
const applets = {};

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
                            let applet = loadApplet(uuid, directory);
                            if (applet._panelLocation != null) {
                                applet._panelLocation.remove_actor(applet.actor);
                                applet._panelLocation = null;
                            }
                        }        
                    }
                }                                                         
            }            
        }
           
        enabledApplets = newEnabledApplets;
    }
    catch(e) {
        global.logError('Failed to refresh list of applets ' + e); 
    }
}

function loadApplets() {    
    for (let i=0; i<enabledApplets.length; i++) {        
        add_applet_to_panels(enabledApplets[i]);
    }        
}

function add_applet_to_panels(appletDefinition) {
    try { 
        // format used in gsettings is 'panel:location:order:uuid' where panel is something like 'panel1', location is
        // either 'left', 'center' or 'right' and order is an integer representing the order of the applet within the panel/location (i.e. 1st, 2nd etc..).                     
        let elements = appletDefinition.split(":");
        if (elements.length == 4) {
            let panel = Main.panel;
            if (elements[0] == "panel2") {
                panel = Main.panel2;
            }
            let location = panel._leftBox;
            if (elements[1] == "center") {
                location = panel._centerBox;
            }
            else if (elements[1] == "right") {
                location = panel._rightBox;
            }
            let order = elements[2];
            let uuid = elements[3];
            let directory = _find_applet(uuid);
            if (directory != null) {
                // Load the applet
                let applet = loadApplet(uuid, directory);
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
                location.add(applet.actor);  
                applet._panelLocation = location;                  
                for (let i=0; i<appletsToMove.length; i++) {
                    location.add(appletsToMove[i]);
                }                    
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

function loadApplet(uuid, dir) {    
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

    let requiredProperties = ['uuid', 'name', 'description', 'icon'];
    for (let i = 0; i < requiredProperties.length; i++) {
        let prop = requiredProperties[i];
        if (!meta[prop]) {
            global.logError(uuid + ' missing "' + prop + '" property in metadata.json');
            return null;
        }
    }

    if (applets[uuid] != undefined) {
        log(uuid + ' applet already loaded');        
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
        if (Main.desktop_layout == Main.LAYOUT_TRADITIONAL) {
            applet = appletModule.main(meta, St.Side.BOTTOM);        
        }
        else {
            applet = appletModule.main(meta, St.Side.TOP);
        }
        global.log('Loaded applet ' + meta.uuid);        
    } catch (e) {
        if (stylesheetPath != null)
            theme.unload_stylesheet(stylesheetPath);
        global.logError(uuid + ' failed to evaluate main function:' + e);
        return null;
    }        
    
    appletObj[uuid] = applet;  
    applet._uuid = uuid;
    
    // Add default context menus
    if (applet._applet_context_menu._getMenuItems().length > 0) {
        applet._applet_context_menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }
    context_menu_item_remove = new Applet.MenuItem(_('Remove from Panel'), Gtk.STOCK_REMOVE, Lang.bind(null, _removeAppletFromPanel, applet._uuid));
    applet._applet_context_menu.addMenuItem(context_menu_item_remove);
    
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







