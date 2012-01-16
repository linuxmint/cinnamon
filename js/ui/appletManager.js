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
// Maps uuid -> importer object (applet directory tree)
const applets = {};

var enabledApplets;
var loadedApplets = [];
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
    
    enabledApplets = global.settings.get_strv('enabled-applets');
}

function loadApplets() {
    let systemDataDirs = GLib.get_system_data_dirs();    
    for (let i = 0; i < systemDataDirs.length; i++) {
        let dirPath = systemDataDirs[i] + '/cinnamon/applets';
        let dir = Gio.file_new_for_path(dirPath);
        if (dir.query_exists(null))
            _loadAppletsIn(dir);
    }
    _loadAppletsIn(userAppletsDir);
    return loadedApplets;
}

function _loadAppletsIn(dir) {
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
        let child = dir.get_child(name);
        let enabled = enabledApplets.indexOf(name) != -1;
        if (enabled) {
            loadApplet(child);
        }
    }
    fileEnum.close(null);
}

function loadApplet(dir) {
    let info;    
    let uuid = dir.get_basename();

    let metadataFile = dir.get_child('metadata.json');
    if (!metadataFile.query_exists(null)) {
        log(uuid + ' missing metadata.json');
        return;
    }

    let metadataContents;
    try {
        metadataContents = Cinnamon.get_file_contents_utf8_sync(metadataFile.get_path());
    } catch (e) {
        log(uuid + ' failed to load metadata.json: ' + e);
        return;
    }
    let meta;
    try {
        meta = JSON.parse(metadataContents);
    } catch (e) {
        log(uuid + ' failed to parse metadata.json: ' + e);
        return;
    }

    let requiredProperties = ['uuid', 'name', 'description', 'icon'];
    for (let i = 0; i < requiredProperties.length; i++) {
        let prop = requiredProperties[i];
        if (!meta[prop]) {
            log(uuid + ' missing "' + prop + '" property in metadata.json');
            return;
        }
    }

    if (applets[uuid] != undefined) {
        log(uuid + ' applet already loaded');
        return;
    }
   
    if (uuid != meta.uuid) {
        log(uuid + ' uuid "' + meta.uuid + '" from metadata.json does not match directory name "' + uuid + '"');
        return;
    }
   
    appletMeta[uuid] = meta;    
    meta.path = dir.get_path();
    meta.error = '';
   
    let appletJs = dir.get_child('applet.js');
    if (!appletJs.query_exists(null)) {
        log(uuid + ' missing applet.js');
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
            log(uuid + ' stylesheet parse error: ' + e);
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
        log(uuid + " " + e);
        return;
    }

    if (!appletModule.main) {
        log(uuid + ' missing \'main\' function');
        return;
    }

    try {
        let applet = appletModule.main(meta);
        loadedApplets.push(applet);
        global.log('Loaded applet ' + meta.uuid);
    } catch (e) {
        if (stylesheetPath != null)
            theme.unload_stylesheet(stylesheetPath);
        log(uuid + ' failed to evaluate main function:' + e);
        return;
    }        
}







