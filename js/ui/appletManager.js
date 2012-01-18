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
        
    let newEnabledApplets = global.settings.get_strv('enabled-applets');
    
    // Find and disable all the newly disabled applets: UUIDs found in the
    // old setting, but not in the new one.
    enabledApplets.filter(function(item) {
        return newEnabledApplets.indexOf(item) == -1;
    }).forEach(function(uuid) {
        try {
            let directory = _find_applet(uuid);
            if (directory != null) {
                let applet = loadApplet(uuid, directory);
                Main.panel._centerBox.remove_actor(applet.actor);
            }        
        } catch (e) {
            global.logError('Failed to remove applet: ' + uuid + ': ' + e);
        }
    });
            
    // Find and enable all the newly enabled applets: UUIDs found in the
    // new setting, but not in the old one.
    newEnabledApplets.filter(function(uuid) {
        return enabledApplets.indexOf(uuid) == -1;
    }).forEach(function(uuid) {
        try {
            let directory = _find_applet(uuid);
            if (directory != null) {
                let applet = loadApplet(uuid, directory);
                Main.panel._centerBox.add(applet.actor);
            }
        } catch (e) {
            global.logError('Failed to add applet: ' + uuid + ': ' + e);
        }  
    });
    
    enabledApplets = newEnabledApplets;
}

function loadApplets() {    
    for (let i=0; i<enabledApplets.length; i++) {
        let uuid = enabledApplets[i];
        try {            
            let directory = _find_applet(uuid);
            if (directory != null) {
                let applet = loadApplet(uuid, directory);
                Main.panel._centerBox.add(applet.actor);
            } 
            else {
                global.logError('Could not find applet ' + uuid + ', make sure its directory is present and matches its UUID');
            }     
        }
        catch (e) {
            global.logError('Failed to load applet ' + uuid);     
        }
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
       return;
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
        return;
    }

    let metadataContents;
    try {
        metadataContents = Cinnamon.get_file_contents_utf8_sync(metadataFile.get_path());
    } catch (e) {
        global.logError(uuid + ' failed to load metadata.json: ' + e);
        return;
    }
    let meta;
    try {
        meta = JSON.parse(metadataContents);
    } catch (e) {
        global.logError(uuid + ' failed to parse metadata.json: ' + e);
        return;
    }

    let requiredProperties = ['uuid', 'name', 'description', 'icon'];
    for (let i = 0; i < requiredProperties.length; i++) {
        let prop = requiredProperties[i];
        if (!meta[prop]) {
            global.logError(uuid + ' missing "' + prop + '" property in metadata.json');
            return;
        }
    }

    if (applets[uuid] != undefined) {
        log(uuid + ' applet already loaded');        
        return (appletObj[uuid]);
    }
   
    if (uuid != meta.uuid) {
        global.logError(uuid + ' uuid "' + meta.uuid + '" from metadata.json does not match directory name "' + uuid + '"');
        return;
    }
   
    appletMeta[uuid] = meta;    
    meta.path = dir.get_path();
    meta.error = '';    
   
    let appletJs = dir.get_child('applet.js');
    if (!appletJs.query_exists(null)) {
        global.logError(uuid + ' missing applet.js');
        return;
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
            return;
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
        return;
    }

    if (!appletModule.main) {
        global.logError(uuid + ' missing \'main\' function');
        return;
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
        return;
    }        
    
    appletObj[uuid] = applet;  
    return(applet);
}







