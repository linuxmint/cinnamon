// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Signals = imports.signals;

const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Shell = imports.gi.Shell;
const Soup = imports.gi.Soup;

const Config = imports.misc.config;
const FileUtils = imports.misc.fileUtils;
const ModalDialog = imports.ui.modalDialog;

const API_VERSION = 1;

const ExtensionState = {
    ENABLED: 1,
    DISABLED: 2,
    ERROR: 3,
    OUT_OF_DATE: 4,
    DOWNLOADING: 5,

    // Used as an error state for operations on unknown extensions,
    // should never be in a real extensionMeta object.
    UNINSTALLED: 99
};

const ExtensionType = {
    SYSTEM: 1,
    PER_USER: 2
};

const REPOSITORY_URL_BASE = 'https://extensions.gnome.org';
const REPOSITORY_URL_DOWNLOAD = REPOSITORY_URL_BASE + '/download-extension/%s.shell-extension.zip';
const REPOSITORY_URL_INFO =     REPOSITORY_URL_BASE + '/extension-info/';

const _httpSession = new Soup.SessionAsync();

// The unfortunate state of gjs, gobject-introspection and libsoup
// means that I have to do a hack to add a feature.
// See: https://bugzilla.gnome.org/show_bug.cgi?id=655189 for context.

if (Soup.Session.prototype.add_feature != null)
    Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

function _getCertFile() {
    let localCert = GLib.build_filenamev([global.userdatadir, 'extensions.gnome.org.crt']);
    if (GLib.file_test(localCert, GLib.FileTest.EXISTS))
        return localCert;
    else
        return Config.SHELL_SYSTEM_CA_FILE;
}

_httpSession.ssl_ca_file = _getCertFile();

// Maps uuid -> metadata object
const extensionMeta = {};
// Maps uuid -> importer object (extension directory tree)
const extensions = {};
// Maps uuid -> extension state object (returned from init())
const extensionStateObjs = {};
// Arrays of uuids
var enabledExtensions;
// GFile for user extensions
var userExtensionsDir = null;

// We don't really have a class to add signals on. So, create
// a simple dummy object, add the signal methods, and export those
// publically.
var _signals = {};
Signals.addSignalMethods(_signals);

const connect = Lang.bind(_signals, _signals.connect);
const disconnect = Lang.bind(_signals, _signals.disconnect);

// UUID => Array of error messages
var errors = {};

const ENABLED_EXTENSIONS_KEY = 'enabled-extensions';

/**
 * versionCheck:
 * @required: an array of versions we're compatible with
 * @current: the version we have
 *
 * Check if a component is compatible for an extension.
 * @required is an array, and at least one version must match.
 * @current must be in the format <major>.<minor>.<point>.<micro>
 * <micro> is always ignored
 * <point> is ignored if <minor> is even (so you can target the
 * whole stable release)
 * <minor> and <major> must match
 * Each target version must be at least <major> and <minor>
 */
function versionCheck(required, current) {
    let currentArray = current.split('.');
    let major = currentArray[0];
    let minor = currentArray[1];
    let point = currentArray[2];
    for (let i = 0; i < required.length; i++) {
        let requiredArray = required[i].split('.');
        if (requiredArray[0] == major &&
            requiredArray[1] == minor &&
            (requiredArray[2] == point ||
             (requiredArray[2] == undefined && parseInt(minor) % 2 == 0)))
            return true;
    }
    return false;
}

function installExtensionFromUUID(uuid, version_tag) {
    let params = { uuid: uuid,
                   version_tag: version_tag,
                   shell_version: Config.PACKAGE_VERSION,
                   api_version: API_VERSION.toString() };

    let message = Soup.form_request_new_from_hash('GET', REPOSITORY_URL_INFO, params);

    _httpSession.queue_message(message,
                               function(session, message) {
                                   let info = JSON.parse(message.response_body.data);
                                   let dialog = new InstallExtensionDialog(uuid, version_tag, info.name);
                                   dialog.open(global.get_current_time());
                               });
}

function uninstallExtensionFromUUID(uuid) {
    let meta = extensionMeta[uuid];
    if (!meta)
        return false;

    // Try to disable it -- if it's ERROR'd, we can't guarantee that,
    // but it will be removed on next reboot, and hopefully nothing
    // broke too much.
    disableExtension(uuid);

    // Don't try to uninstall system extensions
    if (meta.type != ExtensionType.PER_USER)
        return false;

    meta.state = ExtensionState.UNINSTALLED;
    _signals.emit('extension-state-changed', meta);

    delete extensionMeta[uuid];

    // Importers are marked as PERMANENT, so we can't do this.
    // delete extensions[uuid];
    extensions[uuid] = undefined;

    delete extensionStateObjs[uuid];
    delete errors[uuid];

    FileUtils.recursivelyDeleteDir(Gio.file_new_for_path(meta.path));

    return true;
}

function gotExtensionZipFile(session, message, uuid) {
    if (message.status_code != Soup.KnownStatusCode.OK) {
        logExtensionError(uuid, 'downloading extension: ' + message.status_code);
        return;
    }

    // FIXME: use a GFile mkstemp-type method once one exists
    let fd, tmpzip;
    try {
        [fd, tmpzip] = GLib.file_open_tmp('XXXXXX.shell-extension.zip');
    } catch (e) {
        logExtensionError(uuid, 'tempfile: ' + e.toString());
        return;
    }

    let stream = new Gio.UnixOutputStream({ fd: fd });
    let dir = userExtensionsDir.get_child(uuid);
    Shell.write_soup_message_to_stream(stream, message);
    stream.close(null);
    let [success, pid] = GLib.spawn_async(null,
                                          ['unzip', '-uod', dir.get_path(), '--', tmpzip],
                                          null,
                                          GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                                          null);

    if (!success) {
        logExtensionError(uuid, 'extract: could not extract');
        return;
    }

    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function(pid, status) {
        GLib.spawn_close_pid(pid);

        // Add extension to 'enabled-extensions' for the user, always...
        let enabledExtensions = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);
        if (enabledExtensions.indexOf(uuid) == -1) {
            enabledExtensions.push(uuid);
            global.settings.set_strv(ENABLED_EXTENSIONS_KEY, enabledExtensions);
        }

        loadExtension(dir, true, ExtensionType.PER_USER);
    });
}

function disableExtension(uuid) {
    let meta = extensionMeta[uuid];
    if (!meta)
        return;

    if (meta.state != ExtensionState.ENABLED)
        return;

    let extensionState = extensionStateObjs[uuid];

    try {
        extensionState.disable();
    } catch(e) {
        logExtensionError(uuid, e.toString());
        return;
    }

    meta.state = ExtensionState.DISABLED;
    _signals.emit('extension-state-changed', meta);
}

function enableExtension(uuid) {
    let meta = extensionMeta[uuid];
    if (!meta)
        return;

    if (meta.state != ExtensionState.DISABLED)
        return;

    let extensionState = extensionStateObjs[uuid];

    try {
        extensionState.enable();
    } catch(e) {
        logExtensionError(uuid, e.toString());
        return;
    }

    meta.state = ExtensionState.ENABLED;
    _signals.emit('extension-state-changed', meta);
}

function logExtensionError(uuid, message, state) {
    if (!errors[uuid]) errors[uuid] = [];
    errors[uuid].push(message);
    global.logError('Extension "%s" had error: %s'.format(uuid, message));
    state = state || ExtensionState.ERROR;
    _signals.emit('extension-state-changed', { uuid: uuid,
                                               error: message,
                                               state: state });
}

function loadExtension(dir, enabled, type) {
    let info;
    let uuid = dir.get_basename();

    let metadataFile = dir.get_child('metadata.json');
    if (!metadataFile.query_exists(null)) {
        logExtensionError(uuid, 'Missing metadata.json');
        return;
    }

    let metadataContents;
    try {
        metadataContents = Shell.get_file_contents_utf8_sync(metadataFile.get_path());
    } catch (e) {
        logExtensionError(uuid, 'Failed to load metadata.json: ' + e);
        return;
    }
    let meta;
    try {
        meta = JSON.parse(metadataContents);
    } catch (e) {
        logExtensionError(uuid, 'Failed to parse metadata.json: ' + e);
        return;
    }

    let requiredProperties = ['uuid', 'name', 'description', 'shell-version'];
    for (let i = 0; i < requiredProperties.length; i++) {
        let prop = requiredProperties[i];
        if (!meta[prop]) {
            logExtensionError(uuid, 'missing "' + prop + '" property in metadata.json');
            return;
        }
    }

    if (extensions[uuid] != undefined) {
        logExtensionError(uuid, 'extension already loaded');
        return;
    }

    // Encourage people to add this
    if (!meta['url']) {
        global.log('Warning: Missing "url" property in metadata.json');
    }

    if (uuid != meta.uuid) {
        logExtensionError(uuid, 'uuid "' + meta.uuid + '" from metadata.json does not match directory name "' + uuid + '"');
        return;
    }

    if (!versionCheck(meta['shell-version'], Config.PACKAGE_VERSION) ||
        (meta['js-version'] && !versionCheck(meta['js-version'], Config.GJS_VERSION))) {
        logExtensionError(uuid, 'extension is not compatible with current GNOME Shell and/or GJS version');
        return;
    }

    extensionMeta[uuid] = meta;
    meta.type = type;
    meta.path = dir.get_path();
    meta.error = '';

    // Default to error, we set success as the last step
    meta.state = ExtensionState.ERROR;

    if (!versionCheck(meta['shell-version'], Config.PACKAGE_VERSION) ||
        (meta['js-version'] && !versionCheck(meta['js-version'], Config.GJS_VERSION))) {
        logExtensionError(uuid, 'extension is not compatible with current GNOME Shell and/or GJS version', ExtensionState.OUT_OF_DATE);
        meta.state = ExtensionState.OUT_OF_DATE;
        return;
    }

    let extensionJs = dir.get_child('extension.js');
    if (!extensionJs.query_exists(null)) {
        logExtensionError(uuid, 'Missing extension.js');
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
            logExtensionError(uuid, 'Stylesheet parse error: ' + e);
            return;
        }
    }

    let extensionModule;
    let extensionState = null;
    try {
        global.add_extension_importer('imports.ui.extensionSystem.extensions', meta.uuid, dir.get_path());
        extensionModule = extensions[meta.uuid].extension;
    } catch (e) {
        if (stylesheetPath != null)
            theme.unload_stylesheet(stylesheetPath);
        logExtensionError(uuid, e);
        return;
    }

    if (!extensionModule.init) {
        logExtensionError(uuid, 'missing \'init\' function');
        return;
    }

    try {
        extensionState = extensionModule.init(meta);
    } catch (e) {
        if (stylesheetPath != null)
            theme.unload_stylesheet(stylesheetPath);
        logExtensionError(uuid, 'Failed to evaluate init function:' + e);
        return;
    }

    if (!extensionState)
        extensionState = extensionModule;
    extensionStateObjs[uuid] = extensionState;

    if (!extensionState.enable) {
        logExtensionError(uuid, 'missing \'enable\' function');
        return;
    }
    if (!extensionState.disable) {
        logExtensionError(uuid, 'missing \'disable\' function');
        return;
    }

    meta.state = ExtensionState.DISABLED;

    if (enabled)
        enableExtension(uuid);

    _signals.emit('extension-loaded', meta.uuid);
    _signals.emit('extension-state-changed', meta);
    global.log('Loaded extension ' + meta.uuid);
}

function onEnabledExtensionsChanged() {
    let newEnabledExtensions = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);

    // Find and enable all the newly enabled extensions: UUIDs found in the
    // new setting, but not in the old one.
    newEnabledExtensions.filter(function(uuid) {
        return enabledExtensions.indexOf(uuid) == -1;
    }).forEach(function(uuid) {
        enableExtension(uuid);
    });

    // Find and disable all the newly disabled extensions: UUIDs found in the
    // old setting, but not in the new one.
    enabledExtensions.filter(function(item) {
        return newEnabledExtensions.indexOf(item) == -1;
    }).forEach(function(uuid) {
        disableExtension(uuid);
    });

    enabledExtensions = newEnabledExtensions;
}

function init() {
    let userExtensionsPath = GLib.build_filenamev([global.userdatadir, 'extensions']);
    userExtensionsDir = Gio.file_new_for_path(userExtensionsPath);
    try {
        if (!userExtensionsDir.query_exists(null))
            userExtensionsDir.make_directory_with_parents(null);
    } catch (e) {
        global.logError('' + e);
    }

    global.settings.connect('changed::' + ENABLED_EXTENSIONS_KEY, onEnabledExtensionsChanged);
    enabledExtensions = global.settings.get_strv(ENABLED_EXTENSIONS_KEY);
}

function _loadExtensionsIn(dir, type) {
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
        let enabled = enabledExtensions.indexOf(name) != -1;
        loadExtension(child, enabled, type);
    }
    fileEnum.close(null);
}

function loadExtensions() {
    let systemDataDirs = GLib.get_system_data_dirs();
    for (let i = 0; i < systemDataDirs.length; i++) {
        let dirPath = systemDataDirs[i] + '/gnome-shell/extensions';
        let dir = Gio.file_new_for_path(dirPath);
        if (dir.query_exists(null))
            _loadExtensionsIn(dir, ExtensionType.SYSTEM);
    }
    _loadExtensionsIn(userExtensionsDir, ExtensionType.PER_USER);
}

function InstallExtensionDialog(uuid, version_tag, name) {
    this._init(uuid, version_tag, name);
}

InstallExtensionDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,

    _init: function(uuid, version_tag, name) {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'extension-dialog' });

        this._uuid = uuid;
        this._version_tag = version_tag;
        this._name = name;

        this.setButtons([{ label: _("Cancel"),
                           action: Lang.bind(this, this._onCancelButtonPressed),
                           key:    Clutter.Escape
                         },
                         { label:  _("Install"),
                           action: Lang.bind(this, this._onInstallButtonPressed)
                         }]);

        let message = _("Download and install '%s' from extensions.gnome.org?").format(name);

        this._descriptionLabel = new St.Label({ text: message });

        this.contentLayout.add(this._descriptionLabel,
                               { y_fill:  true,
                                 y_align: St.Align.START });
    },

    _onCancelButtonPressed: function(button, event) {
        this.close(global.get_current_time());

        // Even though the extension is already "uninstalled", send through
        // a state-changed signal for any users who want to know if the install
        // went through correctly -- using proper async DBus would block more
        // traditional clients like the plugin
        let meta = { uuid: this._uuid,
                     state: ExtensionState.UNINSTALLED,
                     error: '' };

        _signals.emit('extension-state-changed', meta);
    },

    _onInstallButtonPressed: function(button, event) {
        let meta = { uuid: this._uuid,
                     state: ExtensionState.DOWNLOADING,
                     error: '' };

        extensionMeta[this._uuid] = meta;

        _signals.emit('extension-state-changed', meta);

        let params = { version_tag: this._version_tag,
                       shell_version: Config.PACKAGE_VERSION,
                       api_version: API_VERSION.toString() };

        let url = REPOSITORY_URL_DOWNLOAD.format(this._uuid);
        let message = Soup.form_request_new_from_hash('GET', url, params);

        _httpSession.queue_message(message,
                                   Lang.bind(this, function(session, message) {
                                       gotExtensionZipFile(session, message, this._uuid);
                                   }));

        this.close(global.get_current_time());
    }
};
