// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/**
 * FILE:main.js
 * @short_description: This is the heart of Cinnamon, the mother of everything.
 * @placesManager (PlacesManager.PlacesManager): The places manager
 * @overview (Overview.Overview): The "scale" overview
 * @expo (Expo.Expo): The "expo" overview
 * @runDialog (RunDialog.RunDialog): The run dialog
 * @lookingGlass (LookingGlass.Melange): The looking glass object
 * @wm (WindowManager.WindowManager): The window manager
 * @messageTray (MessageTray.MessageTray): The mesesage tray
 * @notificationDaemon (NotificationDaemon.NotificationDaemon): The notification daemon
 * @windowAttentionHandler (WindowAttentionHandler.WindowAttentionHandler): The window attention handle
 * @recorder (Cinnamon.Recorder): The recorder
 * @cinnamonDBusService (CinnamonDBus.Cinnamon): The cinnamon dbus object
 * @modalCount (int): The number of modals "pushed"
 * @modalActorFocusStack (array): Array of pushed modal actors
 * @uiGroup (Cinnamon.GenericContainer): The group containing all Cinnamon and
 * Muffin actors
 *
 * @magnifier (Magnifier.Magnifier): The magnifier
 * @xdndHandler (XdndHandler.XdndHandler): The X DND handler
 * @statusIconDispatcher (StatusIconDispatcher.StatusIconDispatcher): The status icon dispatcher
 * @keyboard (Keyboard.Keyboard): The keyboard object
 * @layoutManager (Layout.LayoutManager): The layout manager.
 * \
 * All actors that are part of the Cinnamon UI ar handled by the layout
 * manager, which will determine when to show and hide the actors etc.
 *
 * @panelManager (Panel.PanelManager): The panel manager.
 * \
 * This is responsible for handling events relating to panels, eg. showing all
 * panels.
 *
 * @themeManager (ThemeManager.ThemeManager): The theme manager
 * @soundManager (SoundManager.SoundManager): The sound manager
 * @settingsManager (Settings.SettingsManager): The manager of the xlet Settings API
 *
 * @backgroundManager (BackgroundManager.BackgroundManager): The background
 * manager.
 * \
 * This listens to changes in the GNOME background settings and mirrors them to
 * the Cinnamon settings, since many applications have a "Set background"
 * button that modifies the GNOME background settings.
 *
 * @slideshowManager (SlideshowManager.SlideshowManager): The slideshow manager.
 * \
 * This is responsible for managing the background slideshow, since the
 * background "slideshow" is created by cinnamon changing the active background
 * gsetting every x minutes.
 *
 * @keybindingManager (KeybindingManager.KeybindingManager): The keybinding manager
 * @systrayManager (Systray.SystrayManager): The systray manager
 *
 * @osdWindow (OsdWindow.OsdWindow): Osd window that pops up when you use media
 * keys.
 * @tracker (Cinnamon.WindowTracker): The window tracker
 * @workspace_names (array): Names of workspace
 * @deskletContainer (DeskletManager.DeskletContainer): The desklet container.
 * \
 * This is a container that contains all the desklets as childs. Its actor is
 * put between @global.bottom_window_group and @global.uiGroup.
 * @software_rendering (boolean): Whether software rendering is used
 * @popup_rendering_actor (Clutter.Actor): The popup actor that is in the process of rendering
 * @xlet_startup_error (boolean): Whether there was at least one xlet that did
 * not manage to load
 *
 * The main file is responsible for launching Cinnamon as well as creating its
 * components. The C part of cinnamon calls the @start() function, which then
 * initializes all of cinnamon. Most components of Cinnamon can be accessed
 * through main.
 */

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const GObject = imports.gi.GObject;
const XApp = imports.gi.XApp;
const PointerTracker = imports.misc.pointerTracker;

const SoundManager = imports.ui.soundManager;
const BackgroundManager = imports.ui.backgroundManager;
const SlideshowManager = imports.ui.slideshowManager;
var AppletManager = imports.ui.appletManager;
const SearchProviderManager = imports.ui.searchProviderManager;
const DeskletManager = imports.ui.deskletManager;
const ExtensionSystem = imports.ui.extensionSystem;
const Keyboard = imports.ui.keyboard;
const MessageTray = imports.ui.messageTray;
const OsdWindow = imports.ui.osdWindow;
const Overview = imports.ui.overview;
const Expo = imports.ui.expo;
const Panel = imports.ui.panel;
const PlacesManager = imports.ui.placesManager;
const RunDialog = imports.ui.runDialog;
const Layout = imports.ui.layout;
const LookingGlass = imports.ui.lookingGlass;
const NotificationDaemon = imports.ui.notificationDaemon;
const WindowAttentionHandler = imports.ui.windowAttentionHandler;
const CinnamonDBus = imports.ui.cinnamonDBus;
const ThemeManager = imports.ui.themeManager;
const Magnifier = imports.ui.magnifier;
const XdndHandler = imports.ui.xdndHandler;
const StatusIconDispatcher = imports.ui.statusIconDispatcher;
const Util = imports.misc.util;
const Keybindings = imports.ui.keybindings;
const Settings = imports.ui.settings;
const Systray = imports.ui.systray;
const Accessibility = imports.ui.accessibility;
const ModalDialog = imports.ui.modalDialog;
const {readOnlyError} = imports.ui.environment;
const {installPolyfills} = imports.ui.overrides;

var LAYOUT_TRADITIONAL = "traditional";
var LAYOUT_FLIPPED = "flipped";
var LAYOUT_CLASSIC = "classic";

var DEFAULT_BACKGROUND_COLOR = Clutter.Color.from_pixel(0x000000ff);

var panel = null;
var soundManager = null;
var backgroundManager = null;
var slideshowManager = null;
var placesManager = null;
var panelManager = null;
var osdWindowManager = null;
var overview = null;
var expo = null;
var runDialog = null;
var lookingGlass = null;
var wm = null;
var a11yHandler = null;
var messageTray = null;
var notificationDaemon = null;
var windowAttentionHandler = null;
var recorder = null;
var cinnamonDBusService = null;
var modalCount = 0;
var modalActorFocusStack = [];
var uiGroup = null;
var magnifier = null;
var xdndHandler = null;
var statusIconDispatcher = null;
var keyboard = null;
var layoutManager = null;
var themeManager = null;
var keybindingManager = null;
var _errorLogStack = [];
var _startDate;
var _defaultCssStylesheet = null;
var _cssStylesheet = null;
var dynamicWorkspaces = null;
var tracker = null;
var settingsManager = null;
var systrayManager = null;
var wmSettings = null;

var workspace_names = [];

var applet_side = St.Side.TOP; // Kept to maintain compatibility. Doesn't seem to be used anywhere
var deskletContainer = null;

var software_rendering = false;

var popup_rendering_actor = null;

var xlet_startup_error = false;

var gpu_offload_supported = false;

var RunState = {
    INIT : 0,
    STARTUP : 1,
    RUNNING : 2
}

var runState = RunState.INIT;

// Override Gettext localization
const Gettext = imports.gettext;
Gettext.bindtextdomain('cinnamon', '/usr/share/locale');
Gettext.textdomain('cinnamon');
const _ = Gettext.gettext;

function setRunState(state) {
    let oldState = runState;

    if (state != oldState) {
        runState = state;
        cinnamonDBusService.EmitRunStateChanged();
    }
}

function _initRecorder() {
    let recorderSettings = new Gio.Settings({ schema_id: 'org.cinnamon.recorder' });

    global.screen.connect('toggle-recording', function() {
        if (recorder == null) {
            recorder = new Cinnamon.Recorder({ stage: global.stage });
        }

        if (recorder.is_recording()) {
            recorder.pause();
            Meta.enable_unredirect_for_screen(global.screen);
        } else {
            // read the parameters from GSettings always in case they have changed
            recorder.set_framerate(recorderSettings.get_int('framerate'));
            recorder.set_filename('cinnamon-%d%u-%c.' + recorderSettings.get_string('file-extension'));
            let pipeline = recorderSettings.get_string('pipeline');

            if (layoutManager.monitors.length > 1) {
                let {x, y, width, height} = layoutManager.primaryMonitor;
                recorder.set_area(x, y, width, height);
            }

            if (!pipeline.match(/^\s*$/))
                recorder.set_pipeline(pipeline);
            else
                recorder.set_pipeline(null);

            Meta.disable_unredirect_for_screen(global.screen);
            recorder.record();
        }
    });
}

function _addXletDirectoriesToSearchPath() {
    imports.searchPath.unshift(global.datadir);
    imports.searchPath.unshift(global.userdatadir);
    // Including the system data directory also includes unnecessary system utilities,
    // so we are making sure they are removed.
    let types = ['applets', 'desklets', 'extensions', 'search_providers'];
    let importsCache = {};
    for (let i = 0; i < types.length; i++) {
        // Cache our existing xlet GJS importer objects
        importsCache[types[i]] = imports[types[i]];
    }
    // Remove the two paths we added to the beginning of the array.
    imports.searchPath.splice(0, 2);
    for (let i = 0; i < types.length; i++) {
        // Re-add cached xlet objects
        imports[types[i]] = importsCache[types[i]];
        importsCache[types[i]] = undefined;
    }
}

function _initUserSession() {
    _initRecorder();

    global.screen.override_workspace_layout(Meta.ScreenCorner.TOPLEFT, false, 1, -1);

    systrayManager = new Systray.SystrayManager();

    Meta.keybindings_set_custom_handler('panel-run-dialog', function() {
        getRunDialog().open();
    });
}

function do_shutdown_sequence() {
    panelManager.panels.forEach(function (panel) {
        panel.actor.hide();
    });
}

function _reparentActor(actor, newParent) {
    let parent = actor.get_parent();
    if (parent)
        parent.remove_actor(actor);
    if(newParent)
        newParent.add_actor(actor);
}

/**
 * start:
 *
 * Starts cinnamon. Should not be called in JavaScript code
 */
function start() {
    global.reparentActor = _reparentActor;

    // Monkey patch utility functions into the global proxy;
    // This is easier and faster than indirecting down into global
    // if we want to call back up into JS.
    global.logTrace = _logTrace;
    global.logWarning = _logWarning;
    global.logError = _logError;
    global.log = _logInfo;

    installPolyfills(readOnlyError, _log);

    let cinnamonStartTime = new Date().getTime();

    log("About to start Cinnamon");
    if (GLib.getenv('CINNAMON_SOFTWARE_RENDERING')) {
        log("ACTIVATING SOFTWARE RENDERING");
        global.logError("Cinnamon Software Rendering mode enabled");
        software_rendering = true;
    }

    // Chain up async errors reported from C
    global.connect('notify-error', function (global, msg, detail) { notifyError(msg, detail); });

    Gio.DesktopAppInfo.set_desktop_env('X-Cinnamon');

    cinnamonDBusService = new CinnamonDBus.CinnamonDBus();
    setRunState(RunState.STARTUP);

    // Ensure CinnamonWindowTracker and CinnamonAppUsage are initialized; this will
    // also initialize CinnamonAppSystem first.  CinnamonAppSystem
    // needs to load all the .desktop files, and CinnamonWindowTracker
    // will use those to associate with windows.  Right now
    // the Monitor doesn't listen for installed app changes
    // and recalculate application associations, so to avoid
    // races for now we initialize it here.  It's better to
    // be predictable anyways.
    tracker = Cinnamon.WindowTracker.get_default();

    let startTime = new Date().getTime();
    Cinnamon.AppSystem.get_default();
    global.log('Cinnamon.AppSystem.get_default() started in %d ms'.format(new Date().getTime() - startTime));

    // The stage is always covered so Clutter doesn't need to clear it; however
    // the color is used as the default contents for the Muffin root background
    // actor so set it anyways.
    global.stage.background_color = DEFAULT_BACKGROUND_COLOR;
    global.stage.no_clear_hint = true;

    Gtk.IconTheme.get_default().append_search_path("/usr/share/cinnamon/icons/");
    _defaultCssStylesheet = global.datadir + '/theme/cinnamon.css';

    soundManager = new SoundManager.SoundManager();

    /* note: This call will initialize St.TextureCache */
    themeManager = new ThemeManager.ThemeManager();

    settingsManager = new Settings.SettingsManager();

    backgroundManager = new BackgroundManager.BackgroundManager();

    slideshowManager = new SlideshowManager.SlideshowManager();

    keybindingManager = new Keybindings.KeybindingManager();
    deskletContainer = new DeskletManager.DeskletContainer();

    // Set up stage hierarchy to group all UI actors under one container.
    uiGroup = new Cinnamon.GenericContainer({ name: 'uiGroup' });
    uiGroup.connect('allocate',
                    function (actor, box, flags) {
                        let children = uiGroup.get_children();
                        for (let i = 0; i < children.length; i++)
                            children[i].allocate_preferred_size(flags);
                    });
    uiGroup.connect('get-preferred-width',
                    function(actor, forHeight, alloc) {
                        let width = global.stage.width;
                        [alloc.min_size, alloc.natural_size] = [width, width];
                    });
    uiGroup.connect('get-preferred-height',
                    function(actor, forWidth, alloc) {
                        let height = global.stage.height;
                        [alloc.min_size, alloc.natural_size] = [height, height];
                    });

    global.reparentActor(global.background_actor, uiGroup);
    global.background_actor.hide();
    global.reparentActor(global.bottom_window_group, uiGroup);
    uiGroup.add_actor(deskletContainer.actor);
    global.reparentActor(global.window_group, uiGroup);
    global.reparentActor(global.overlay_group, uiGroup);

    let stage_bg = new Clutter.Actor();
    let constraint = new Clutter.BindConstraint({ source: global.stage, coordinate: Clutter.BindCoordinate.ALL, offset: 0 })
    stage_bg.add_constraint(constraint);
    stage_bg.set_background_color(new Clutter.Color({red: 0, green: 0, blue: 0, alpha: 255}));
    stage_bg.set_size(global.screen_width, global.screen_height);
    global.stage.add_actor(stage_bg);

    stage_bg.add_actor(uiGroup);

    global.reparentActor(global.top_window_group, global.stage);

    global.menuStackLength = 0;

    layoutManager = new Layout.LayoutManager();

    Panel.checkPanelUpgrade();

    panelManager = new Panel.PanelManager();

    let startupAnimationEnabled = global.settings.get_boolean("startup-animation");

    let do_animation = !global.session_running &&
                        startupAnimationEnabled &&
                       !GLib.getenv('CINNAMON_SOFTWARE_RENDERING') &&
                       !GLib.getenv('CINNAMON_2D');

    if (do_animation) {
        layoutManager._prepareStartupAnimation();
    }

    let pointerTracker = new PointerTracker.PointerTracker();
    pointerTracker.setPosition(layoutManager.primaryMonitor.x + layoutManager.primaryMonitor.width/2,
        layoutManager.primaryMonitor.y + layoutManager.primaryMonitor.height/2);

    xdndHandler = new XdndHandler.XdndHandler();
    osdWindowManager = new OsdWindow.OsdWindowManager();
    // This overview object is just a stub for non-user sessions
    overview = new Overview.Overview();
    expo = new Expo.Expo();

    statusIconDispatcher = new StatusIconDispatcher.StatusIconDispatcher();

    layoutManager._updateBoxes();

    wm = new imports.ui.windowManager.WindowManager();
    messageTray = new MessageTray.MessageTray();
    keyboard = new Keyboard.Keyboard();
    notificationDaemon = new NotificationDaemon.NotificationDaemon();
    windowAttentionHandler = new WindowAttentionHandler.WindowAttentionHandler();
    placesManager = new PlacesManager.PlacesManager();

    magnifier = new Magnifier.Magnifier();

    layoutManager.init();
    keyboard.init();
    overview.init();
    expo.init();

    _addXletDirectoriesToSearchPath();
    _initUserSession();

    // Provide the bus object for gnome-session to
    // initiate logouts.
    //EndSessionDialog.init();

    _startDate = new Date();

    global.stage.connect('captured-event', _stageEventHandler);

    global.log('loaded at ' + _startDate);
    log('Cinnamon started at ' + _startDate);

    wmSettings = new Gio.Settings({schema_id: "org.cinnamon.desktop.wm.preferences"})
    workspace_names = wmSettings.get_strv("workspace-names");

    global.display.connect('gl-video-memory-purged', loadTheme);

    try {
        gpu_offload_supported = XApp.util_gpu_offload_supported()
    } catch (e) {
        global.logWarning("Could not check for gpu offload support - maybe xapps isn't up to date.");
        gpu_offload_supported = false;
    }

    Promise.all([
        AppletManager.init(),
        ExtensionSystem.init(),
        DeskletManager.init(),
        SearchProviderManager.init()
    ]).then(function() {
        createLookingGlass();

        a11yHandler = new Accessibility.A11yHandler();

        if (software_rendering && !GLib.getenv('CINNAMON_2D')) {
            if (GLib.file_test("/proc/cmdline", GLib.FileTest.EXISTS)) {
                let content = Cinnamon.get_file_contents_utf8_sync("/proc/cmdline");
                if (!content.match("boot=casper") && !content.match("boot=live")) {
                    notifyCinnamon2d();
                }
            }
        }

        if (xlet_startup_error)
            Mainloop.timeout_add_seconds(3, notifyXletStartupError);

        let sound_settings = new Gio.Settings( {schema_id: "org.cinnamon.sounds"} );
        let do_login_sound = sound_settings.get_boolean("login-enabled");

        // We're mostly prepared for the startup animation
        // now, but since a lot is going on asynchronously
        // during startup, let's defer the startup animation
        // until the event loop is uncontended and idle.
        // This helps to prevent us from running the animation
        // when the system is bogged down
        if (do_animation) {
            let id = GLib.idle_add(GLib.PRIORITY_LOW, () => {
                if (do_login_sound)
                    soundManager.play_once_per_session('login');
                layoutManager._doStartupAnimation();
                return GLib.SOURCE_REMOVE;
            });
        } else {
            global.background_actor.show();
            setRunState(RunState.RUNNING);

            if (do_login_sound)
                soundManager.play_once_per_session('login');
        }

        // Disable panel edit mode when Cinnamon starts
        if (global.settings.get_boolean("panel-edit-mode")) {
            global.settings.set_boolean("panel-edit-mode", false);
        }

        global.connect('shutdown', do_shutdown_sequence);

        global.log('Cinnamon took %d ms to start'.format(new Date().getTime() - cinnamonStartTime));
    });
}

function notifyCinnamon2d() {
    let icon = new St.Icon({ icon_name: 'driver-manager',
                             icon_type: St.IconType.FULLCOLOR,
                             icon_size: 36 });
    let notification =
        criticalNotify(_("Check your video drivers"),
                       _("Your system is currently running without video hardware acceleration.") +
                       "\n\n" +
                       _("You may experience poor performance and high CPU usage."),
                       icon);

    if (GLib.file_test("/usr/bin/cinnamon-driver-manager", GLib.FileTest.EXISTS)) {
        notification.addButton("driver-manager", _("Launch Driver Manager"));
        notification.connect("action-invoked", this.launchDriverManager);
    }
}

function notifyXletStartupError() {
    let icon = new St.Icon({ icon_name: 'dialog-warning',
                             icon_type: St.IconType.FULLCOLOR,
                             icon_size: 36 });
    warningNotify(_("Problems during Cinnamon startup"),
                  _("Cinnamon started successfully, but one or more applets, desklets or extensions failed to load.\n\n") +
                  _("Check your system log and the Cinnamon LookingGlass log for any issues.  ") +
                  _("You can disable the offending extension(s) in Cinnamon Settings to prevent this message from recurring.  ") +
                  _("Please contact the developer."), icon);

}

/* Provided by panelManager now, but kept here for xlet compatibility */

function enablePanels() {
    panelManager.enablePanels();
}

function disablePanels() {
    panelManager.disablePanels();
}

function getPanels() {
    return panelManager.getPanels();
}

let _workspaces = [];
let _checkWorkspacesId = 0;

/*
 * When the last window closed on a workspace is a dialog or splash
 * screen, we assume that it might be an initial window shown before
 * the main window of an application, and give the app a grace period
 * where it can map another window before we remove the workspace.
 */
const LAST_WINDOW_GRACE_TIME = 1000;

function _fillWorkspaceNames(index) {
    // ensure that we have workspace names up to index
    for (let i = index - workspace_names.length; i > 0; --i) {
        workspace_names.push('');
    }
}

function _shouldTrimWorkspace(i) {
    return i >= 0 && (i >= global.screen.n_workspaces || !workspace_names[i].length);
}

function _trimWorkspaceNames() {
    // trim empty or out-of-bounds names from the end.
    let i = workspace_names.length - 1;
    while (_shouldTrimWorkspace(i)) {
        workspace_names.pop();
        i--;
    }
}

function _makeDefaultWorkspaceName(index) {
    return _("Workspace") + " " + (index + 1).toString();
}

/**
 * setWorkspaceName:
 * @index (int): index of workspace
 * @name (string): name of workspace
 *
 * Sets the name of the workspace @index to @name
 */
function setWorkspaceName(index, name) {
    name.trim();
    if (name != getWorkspaceName(index)) {
        _fillWorkspaceNames(index);
        workspace_names[index] = (name == _makeDefaultWorkspaceName(index) ?
            "" :
            name);
        _trimWorkspaceNames();
        wmSettings.set_strv("workspace-names", workspace_names);
    }
}

/**
 * getWorkspaceName:
 * @index (int): index of workspace
 *
 * Retrieves the name of the workspace @index
 *
 * Returns (string): name of workspace
 */
function getWorkspaceName(index) {
    let wsName = index < workspace_names.length ?
        workspace_names[index] :
        "";
    wsName.trim();
    return wsName.length > 0 ?
        wsName :
        _makeDefaultWorkspaceName(index);
}

/**
 * hasDefaultWorkspaceName:
 * @index (int): index of workspace
 *
 * Whether the workspace uses the default name
 *
 * Returns (boolean): whether the workspace uses the default name
 */
function hasDefaultWorkspaceName(index) {
    return getWorkspaceName(index) == _makeDefaultWorkspaceName(index);
}

function _addWorkspace() {
    global.screen.append_new_workspace(false, global.get_current_time());
    return true;
}

function _removeWorkspace(workspace) {
    if (global.screen.n_workspaces == 1)
        return false;
    let index = workspace.index();
    if (index < workspace_names.length) {
        workspace_names.splice (index, 1);
    }
    _trimWorkspaceNames();
    wmSettings.set_strv("workspace-names", workspace_names);
    global.screen.remove_workspace(workspace, global.get_current_time());
    return true;
}

/**
 * moveWindowToNewWorkspace:
 * @metaWindow (Meta.Window): the window to be moved
 * @switchToNewWorkspace (boolean): whether or not to switch to the
 *                                  new created workspace
 *
 * Moves the window to a new workspace.
 *
 * If @switchToNewWorkspace is true, it will switch to the new workspace
 * after moving the window
 */
function moveWindowToNewWorkspace(metaWindow, switchToNewWorkspace) {
    if (switchToNewWorkspace) {
        let targetCount = global.screen.n_workspaces + 1;
        let nnwId = global.screen.connect('notify::n-workspaces', function() {
            global.screen.disconnect(nnwId);
            if (global.screen.n_workspaces === targetCount) {
                let newWs = global.screen.get_workspace_by_index(global.screen.n_workspaces - 1);
                newWs.activate(global.get_current_time());
            }
        });
    }
    metaWindow.change_workspace_by_index(global.screen.n_workspaces, true, global.get_current_time());
}

/**
 * getThemeStylesheet:
 *
 * Get the theme CSS file that Cinnamon will load
 *
 * Returns (string): A file path that contains the theme CSS,
 *                   null if using the default
 */
function getThemeStylesheet()
{
    return _cssStylesheet;
}

/**
 * setThemeStylesheet:
 * @cssStylesheet (string): A file path that contains the theme CSS,
 *                         set it to null to use the default
 *
 * Set the theme CSS file that Cinnamon will load
 */
function setThemeStylesheet(cssStylesheet)
{
    _cssStylesheet = cssStylesheet;
}

/**
 * loadTheme:
 *
 * Reloads the theme CSS file
 */
function loadTheme() {
    let themeContext = St.ThemeContext.get_for_stage (global.stage);
    let theme = new St.Theme ({ fallback_stylesheet: _defaultCssStylesheet });
    let stylesheetLoaded = false;
    if (_cssStylesheet != null) {
        stylesheetLoaded = theme.load_stylesheet(_cssStylesheet);
    }
    if (!stylesheetLoaded) {
        theme.load_stylesheet(_defaultCssStylesheet);
        if (_cssStylesheet != null) {
            global.logError("There was some problem parsing the theme: " + _cssStylesheet + ".  Falling back to the default theme.");
        }
    }

    themeContext.set_theme (theme);
}

/**
 * notify:
 * @msg (string): A message
 * @details (string): Additional information to be
 *
 * Sends a notification
 */
function notify(msg, details) {
    let source = new MessageTray.SystemNotificationSource();
    messageTray.add(source);
    let notification = new MessageTray.Notification(source, msg, details);
    notification.setTransient(true);
    source.notify(notification);
}

/**
 * criticalNotify:
 * @msg: A critical message
 * @details: Additional information
 */
function criticalNotify(msg, details, icon) {
    let source = new MessageTray.SystemNotificationSource();
    messageTray.add(source);
    let notification = new MessageTray.Notification(source, msg, details, { icon: icon });
    notification.setTransient(false);
    notification.setUrgency(MessageTray.Urgency.CRITICAL);
    source.notify(notification);
    return notification;
}

function launchDriverManager() {
    Util.spawnCommandLineAsync("cinnamon-driver-manager", null, null);
}

/**
 * warningNotify:
 * @msg: A warning message
 * @details: Additional information
 */
function warningNotify(msg, details, icon) {
    let source = new MessageTray.SystemNotificationSource();
    messageTray.add(source);
    let notification = new MessageTray.Notification(source, msg, details, { icon: icon });
    notification.setTransient(false);
    notification.setUrgency(MessageTray.Urgency.HIGH);
    source.notify(notification);
}

/**
 * notifyError:
 * @msg (string): An error message
 * @details (string): Additional information
 *
 * See cinnamon_global_notify_problem().
 */
function notifyError(msg, details) {
    // Also print to stderr so it's logged somewhere
    if (details)
        log('error: ' + msg + ': ' + details);
    else
        log('error: ' + msg);
    notify(msg, details);
}

/**
 * formatLogArgument:
 * @arg (any): A single argument.
 * @recursion (int): Keeps track of the number of recursions.
 * @depth (int): Controls how deeply to inspect object structures.
 *
 * Used by _log to handle each argument type and its formatting.
 */
function formatLogArgument(arg = '', recursion = 0, depth = 6) {
    // Make sure falsey values are clearly indicated.
    if (arg === null) {
        arg = 'null';
    } else if (arg === undefined) {
        arg = 'undefined';
    // Ensure strings are distinguishable.
    } else if (typeof arg === 'string' && recursion > 0) {
        arg = '\'' + arg + '\'';
    }
    // Check if we reached the depth threshold
    if (recursion + 1 > depth) {
        try {
            arg = JSON.stringify(arg);
        } catch (e) {
            arg = arg.toString();
        }
        return arg;
    }
    let isGObject = arg instanceof GObject.Object;
    let space = '';
    for (let i = 0; i < recursion + 1; i++) {
        space += '    ';
    }
    if (typeof arg === 'object') {
        let isArray = Array.isArray(arg);
        let brackets = isArray ? ['[', ']'] : ['{', '}'];
        if (isGObject) {
            arg = Util.getGObjectPropertyValues(arg);
            if (Object.keys(arg).length === 0) {
                return arg.toString();
            }
        }
        let array = isArray ? arg : Object.keys(arg);
        // Add beginning bracket with indentation
        let string = brackets[0] + (recursion + 1 > depth ? '' : '\n');
        for (let j = 0, len = array.length; j < len; j++) {
            if (isArray) {
                string += space + formatLogArgument(arg[j], recursion + 1, depth) + ',\n';
            } else {
                string += space + array[j] + ': ' + formatLogArgument(arg[array[j]], recursion + 1, depth) + ',\n';
            }
        }
        // Remove one level of indentation and add the closing bracket.
        space = space.substr(4, space.length);
        arg = string + space + brackets[1];
    // Functions, numbers, etc.
    } else if (typeof arg === 'function') {
        let array = arg.toString().split('\n');
        for (let i = 0; i < array.length; i++) {
            if (i === 0) continue;
            array[i] = space + array[i];
        }
        arg = array.join('\n');
    } else if (typeof arg !== 'string' || isGObject) {
        arg = arg.toString();
    }
    return arg;
}

/**
 * _log:
 * @category (string): string message type ('info', 'error')
 * @msg (string): A message string
 * @...: Any further arguments are converted into JSON notation,
 *       and appended to the log message, separated by spaces.
 *
 * Log a message into the LookingGlass error
 * stream.  This is primarily intended for use by the
 * extension system as well as debugging.
 */
function _log(category = 'info', msg = '') {
    // Convert arguments into an array so it can be iterated.
    let args = Array.prototype.slice.call(arguments);
    // Remove category from the list of loggable arguments
    args.shift();
    let text = '';

    for (let i = 0, len = args.length; i < len; i++) {
        args[i] = formatLogArgument(args[i]);
    }

    if (args.length === 2) {
        text = args[0] + ': ' + args[1];
    } else {
        text = args.join(' ');
    }
    let out = {
        timestamp: new Date().getTime().toString(),
        category: category,
        message: text
    };

    _errorLogStack.push(out);

    if (lookingGlass) {
        lookingGlass.emitLogUpdate();
    }

    log(`[LookingGlass/${category}] ${text}`);
}

/**
 * isError:
 * @obj (Object): the object to be tested
 *
 * Tests whether @obj is an error object
 *
 * Returns (boolean): whether @obj is an error object
 */
function isError(obj) {
    if (obj == undefined) return false;

    let isErr = false;
    if (typeof(obj) == 'object' && 'message' in obj && 'stack' in obj) {
        isErr = true;
    } else if (obj instanceof GLib.Error) {
        // Make existing logging functionality work as expected when passed
        // a GLib.Error which doesn't normally have a stack trace attached.
        let stack = new Error().stack;
        // This is reached the first time isError is called by a _log function,
        // so strip off this function call and the _log function that called us.
        let strPos = stack.indexOf('\n', stack.indexOf('\n') + 1)  + 1;
        stack = stack.substr(strPos);
        obj.stack = stack;
        isErr = true;
    }
    return isErr;
}

/**
 * _LogTraceFormatted:
 * @stack (string): the stack trace
 *
 * Prints the stack trace to the LookingGlass
 * error stream in a predefined format
 */
function _LogTraceFormatted(stack) {
    _log('trace', '\n<----------------\n' + stack + '---------------->');
}

/**
 * _logTrace:
 * @msg (Error): An error object
 *
 * Prints a stack trace of the given object.
 *
 * If msg is an error, its stack-trace will be
 * printed. Otherwise, a stack-trace of the call
 * will be generated
 *
 * If you want to print the message of an Error
 * as well, use the other log functions instead.
 */
function _logTrace(msg) {
    if(isError(msg)) {
        _LogTraceFormatted(msg.stack);
    } else {
        try {
            throw new Error();
        } catch (e) {
            // e.stack must have at least two lines, with the first being
            // _logTrace() (which we strip off), and the second being
            // our caller.
            let trace = e.stack.substr(e.stack.indexOf('\n') + 1);
            _LogTraceFormatted(trace);
        }
    }
}

/**
 * _logWarning:
 * @msg (Error/string): An error object or the message string
 *
 * Logs the message to the LookingGlass error
 * stream.
 *
 * If msg is an error, its stack-trace will be
 * printed.
 */
function _logWarning(msg) {
    if(isError(msg)) {
        _log('warning', msg.message);
        _LogTraceFormatted(msg.stack);
    } else {
        _log('warning', msg);
    }
}

/**
 * _logError:
 * @msg (string): (optional) The message string
 * @error (Error): (optional) The error object
 *
 * Logs the following (if present) to the
 * LookingGlass error stream:
 * - The message from the error object
 * - The stack trace of the error object
 * - The message @msg
 *
 * It can be called in the form of either _logError(msg),
 * _logError(error) or _logError(msg, error).
 */
function _logError(msg, error) {
    if(error && isError(error)) {
        _log('error', error.message);
        _LogTraceFormatted(error.stack);
        _log('error', msg);
    } else if(isError(msg)) {
        _log('error', msg.message);
        _LogTraceFormatted(msg.stack);
    } else {
        _log('error', msg);
    }
}

// If msg is an Error, its message will be printed as 'info' and its stack-trace will be printed as 'trace'
/**
 * _logInfo:
 * @msg (Error/string): The error object or the message string
 *
 * Logs the message to the LookingGlass
 * error stream. If @msg is an Error object,
 * its stack trace will also be printed
 */

function _logInfo(msg) {
    if (isError(msg)) {
        _log('info', msg.message);
        _LogTraceFormatted(msg.stack);
    } else {
        // Convert arguments to an array, add 'info' to the beginning of it. Invoke _log with apply so
        // unlimited arguments can be passed to it.
        let args = Array.prototype.slice.call(arguments);
        _log.apply(this, ['info', ...args]);
    }
}

/**
 * logStackTrace:
 * @msg (string): message
 *
 * Logs the message @msg to stdout with backtrace
 */
function logStackTrace(msg) {
    try {
        throw new Error();
    } catch (e) {
        // e.stack must have at least two lines, with the first being
        // logStackTrace() (which we strip off), and the second being
        // our caller.
        let trace = e.stack.substr(e.stack.indexOf('\n') + 1);
        log(msg ? (msg + '\n' + trace) : trace);
    }
}

/**
 * isWindowActorDisplayedOnWorkspace:
 * @win (Meta.WindowActor): window actor
 * @workspaceIndex (int): index of workspace
 *
 * Determines whether the window actor belongs to a specific workspace
 *
 * Returns (boolean): whether the window is on the workspace
 */
function isWindowActorDisplayedOnWorkspace(win, workspaceIndex) {
    if (win.get_workspace() == workspaceIndex) {return true;}
    let mwin = win.get_meta_window();
    return mwin && (mwin.is_on_all_workspaces() ||
        (wm.workspacesOnlyOnPrimary && mwin.get_monitor() != layoutManager.primaryIndex)
    );
}

/**
 * getWindowActorsForWorkspace:
 * @workspaceIndex (int): index of workspace
 *
 * Gets a list of actors on a workspace
 *
 * Returns (array): the array of window actors
 */
function getWindowActorsForWorkspace(workspaceIndex) {
    return global.get_window_actors().filter(function (win) {
        return isWindowActorDisplayedOnWorkspace(win, workspaceIndex);
    });
}

// This function encapsulates hacks to make certain global keybindings
// work even when we are in one of our modes where global keybindings
// are disabled with a global grab. (When there is a global grab, then
// all key events will be delivered to the stage, so ::captured-event
// on the stage can be used for global keybindings.)
function _stageEventHandler(actor, event) {
    if (modalCount == 0)
        return false;
    if (event.type() != Clutter.EventType.KEY_PRESS) {
        if(!popup_rendering_actor || event.type() != Clutter.EventType.BUTTON_RELEASE)
            return false;
        return (event.get_source() && popup_rendering_actor.contains(event.get_source()));
    }

    let symbol = event.get_key_symbol();
    let keyCode = event.get_key_code();
    let modifierState = Cinnamon.get_event_state(event);

    // This relies on the fact that Clutter.ModifierType is the same as Gdk.ModifierType
    let action = global.display.get_keybinding_action(keyCode, modifierState);

    if (action == Meta.KeyBindingAction.CUSTOM) {
        global.display.keybinding_action_invoke_by_code(keyCode, modifierState);
    }

    // Other bindings are only available when the overview is up and no modal dialog is present
    if (((!overview.visible && !expo.visible) || modalCount > 1))
        return false;

    // This isn't a Meta.KeyBindingAction yet
    if (symbol === Clutter.KEY_Super_L || symbol === Clutter.KEY_Super_R) {
        if (expo.visible) {
            expo.hide();
            return true;
        }
    }

    if (action == Meta.KeyBindingAction.SWITCH_PANELS) {
        //Used to call the ctrlalttabmanager in Gnome Shell
        return true;
    }

    switch (action) {
        // left/right would effectively act as synonyms for up/down if we enabled them;
        // but that could be considered confusing; we also disable them in the main view.
        case Meta.KeyBindingAction.WORKSPACE_LEFT:
            wm.actionMoveWorkspaceLeft();
            return true;
        case Meta.KeyBindingAction.WORKSPACE_RIGHT:
            wm.actionMoveWorkspaceRight();
            return true;
        case Meta.KeyBindingAction.WORKSPACE_UP:
            overview.hide();
            expo.hide();
            return true;
        case Meta.KeyBindingAction.WORKSPACE_DOWN:
            overview.hide();
            expo.hide();
            return true;
        case Meta.KeyBindingAction.PANEL_RUN_DIALOG:
            getRunDialog().open();
            return true;
    }

    return false;
}

function _findModal(actor) {
    for (let i = 0; i < modalActorFocusStack.length; i++) {
        if (modalActorFocusStack[i].actor == actor)
            return i;
    }
    return -1;
}

/**
 * pushModal:
 * @actor (Clutter.Actor): actor which will be given keyboard focus
 * @timestamp (int): optional timestamp
 * @options (Meta.ModalOptions): (optional) flags to indicate that the pointer
 * is alrady grabbed
 *
 * Ensure we are in a mode where all keyboard and mouse input goes to
 * the stage, and focus @actor. Multiple calls to this function act in
 * a stacking fashion; the effect will be undone when an equal number
 * of popModal() invocations have been made.
 *
 * Next, record the current Clutter keyboard focus on a stack. If the
 * modal stack returns to this actor, reset the focus to the actor
 * which was focused at the time pushModal() was invoked.
 *
 * @timestamp is optionally used to associate the call with a specific user
 * initiated event.  If not provided then the value of
 * global.get_current_time() is assumed.
 *
 * Returns (boolean): true iff we successfully acquired a grab or already had one
 */
function pushModal(actor, timestamp, options) {
    if (timestamp == undefined)
        timestamp = global.get_current_time();

    if (modalCount == 0) {
        if (!global.begin_modal(timestamp, options ? options : 0)) {
            log('pushModal: invocation of begin_modal failed');
            return false;
        }
        Meta.disable_unredirect_for_screen(global.screen);
    }

    global.set_stage_input_mode(Cinnamon.StageInputMode.FULLSCREEN);

    modalCount += 1;
    let actorDestroyId = actor.connect('destroy', function() {
        let index = _findModal(actor);
        if (index >= 0)
            popModal(actor);
    });

    let record = {
        actor: actor,
        focus: global.stage.get_key_focus(),
        destroyId: actorDestroyId
    };
    if (record.focus != null) {
        record.focusDestroyId = record.focus.connect('destroy', function() {
            record.focus = null;
            record.focusDestroyId = null;
        });
    }
    modalActorFocusStack.push(record);

    global.stage.set_key_focus(actor);

    layoutManager.updateChrome(true);
    return true;
}

/**
 * popModal:
 * @actor (Clutter.Actor): actor passed to original invocation of pushModal().
 * @timestamp (int): optional timestamp
 *
 * Reverse the effect of pushModal().  If this invocation is undoing
 * the topmost invocation, then the focus will be restored to the
 * previous focus at the time when pushModal() was invoked.
 *
 * @timestamp is optionally used to associate the call with a specific user
 * initiated event.  If not provided then the value of
 * global.get_current_time() is assumed.
 */
function popModal(actor, timestamp) {
    if (timestamp == undefined)
        timestamp = global.get_current_time();

    let focusIndex = _findModal(actor);
    if (focusIndex < 0) {
        global.stage.set_key_focus(null);
        global.end_modal(timestamp);
        global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);

        throw new Error('incorrect pop');
    }

    modalCount -= 1;

    let record = modalActorFocusStack[focusIndex];
    if (record.destroyId) record.actor.disconnect(record.destroyId);
    record.destroyId = 0;

    if (focusIndex == modalActorFocusStack.length - 1) {
        if (record.focusDestroyId) {
            record.focus.disconnect(record.focusDestroyId);
            record.focusDestroyId = 0;
        }
        global.stage.set_key_focus(record.focus);
    } else {
        let t = modalActorFocusStack[modalActorFocusStack.length - 1];
        if (t.focus)
            t.focus.disconnect(t.focusDestroyId);
        // Remove from the middle, shift the focus chain up
        for (let i = modalActorFocusStack.length - 1; i > focusIndex; i--) {
            modalActorFocusStack[i].focus = modalActorFocusStack[i - 1].focus;
            modalActorFocusStack[i].focusDestroyId = modalActorFocusStack[i - 1].focusDestroyId;
        }
    }
    modalActorFocusStack.splice(focusIndex, 1);

    if (modalCount > 0)
        return;

    global.end_modal(timestamp);
    global.set_stage_input_mode(Cinnamon.StageInputMode.NORMAL);

    layoutManager.updateChrome(true);

    Meta.enable_unredirect_for_screen(global.screen);
}

/**
 * createLookingGlass:
 *
 * Obtains the looking glass object. Create if it does not exist
 *
 * Returns (LookingGlass.Melange): looking glass object
 */
function createLookingGlass() {
    if (lookingGlass == null) {
        lookingGlass = new LookingGlass.Melange();
    }
    return lookingGlass;
}

/**
 * getRunDialog:
 *
 * Obtains the run dialog object. Create if it does not exist
 *
 * Returns (RunDialog.RunDialog): run dialog object
 */
function getRunDialog() {
    if (runDialog == null) {
        runDialog = new RunDialog.RunDialog();
    }
    return runDialog;
}

/**
 * activateWindow:
 * @window (Meta.Window): the Meta.Window to activate
 * @time (int): (optional) current event time
 * @workspaceNum (int): (optional) workspace number to switch to
 *
 * Activates @window, switching to workspaceNum first if provided,
 * and switching out of the overview if it's currently active. If
 * no workspace is provided, workspace-related behavior during
 * activation will be handled in muffin.
 */
function activateWindow(window, time, workspaceNum) {
    let activeWorkspaceNum = global.screen.get_active_workspace_index();

    if (!time)
        time = global.get_current_time();

    if ((workspaceNum !== undefined) && activeWorkspaceNum !== workspaceNum) {
        let workspace = global.screen.get_workspace_by_index(workspaceNum);
        workspace.activate_with_focus(window, time);
        return;
    }

    window.activate(time);
    Mainloop.idle_add(function() {
        window.foreach_transient(function(win) {
            win.activate(time);
        });
    });

    overview.hide();
    expo.hide();
}

// TODO - replace this timeout with some system to guess when the user might
// be e.g. just reading the screen and not likely to interact.
const DEFERRED_TIMEOUT_SECONDS = 20;
var _deferredWorkData = {};
// Work scheduled for some point in the future
var _deferredWorkQueue = [];
// Work we need to process before the next redraw
var _beforeRedrawQueue = [];
// Counter to assign work ids
var _deferredWorkSequence = 0;
var _deferredTimeoutId = 0;

function _runDeferredWork(workId) {
    if (!_deferredWorkData[workId])
        return;
    let index = _deferredWorkQueue.indexOf(workId);
    if (index < 0)
        return;

    _deferredWorkQueue.splice(index, 1);
    _deferredWorkData[workId].callback();
    if (_deferredWorkQueue.length == 0 && _deferredTimeoutId > 0) {
        Mainloop.source_remove(_deferredTimeoutId);
        _deferredTimeoutId = 0;
    }
}

function _runAllDeferredWork() {
    while (_deferredWorkQueue.length > 0)
        _runDeferredWork(_deferredWorkQueue[0]);
}

function _runBeforeRedrawQueue() {
    for (let i = 0; i < _beforeRedrawQueue.length; i++) {
        let workId = _beforeRedrawQueue[i];
        _runDeferredWork(workId);
    }
    _beforeRedrawQueue = [];
}

function _queueBeforeRedraw(workId) {
    _beforeRedrawQueue.push(workId);
    if (_beforeRedrawQueue.length == 1) {
        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, function () {
            _runBeforeRedrawQueue();
            return false;
        });
    }
}

/**
 * initializeDeferredWork:
 * @actor (Clutter.Actor): A #ClutterActor
 * @callback (function): Function to invoke to perform work
 *
 * This function sets up a callback to be invoked when either the
 * given actor is mapped, or after some period of time when the machine
 * is idle.  This is useful if your actor isn't always visible on the
 * screen (for example, all actors in the overview), and you don't want
 * to consume resources updating if the actor isn't actually going to be
 * displaying to the user.
 *
 * Note that queueDeferredWork is called by default immediately on
 * initialization as well, under the assumption that new actors
 * will need it.
 *
 * Returns (string): A string work identifer
 */
function initializeDeferredWork(actor, callback, props) {
    // Turn into a string so we can use as an object property
    let workId = '' + (++_deferredWorkSequence);
    _deferredWorkData[workId] = { 'actor': actor,
                                  'callback': callback };
    actor.connect('notify::mapped', function () {
        if (!(actor.mapped && _deferredWorkQueue.indexOf(workId) >= 0))
            return;
        _queueBeforeRedraw(workId);
    });
    actor.connect('destroy', function() {
        let index = _deferredWorkQueue.indexOf(workId);
        if (index >= 0)
            _deferredWorkQueue.splice(index, 1);
        delete _deferredWorkData[workId];
    });
    queueDeferredWork(workId);
    return workId;
}

/**
 * queueDeferredWork:
 * @workId (string): work identifier
 *
 * Ensure that the work identified by @workId will be
 * run on map or timeout.  You should call this function
 * for example when data being displayed by the actor has
 * changed.
 */
function queueDeferredWork(workId) {
    let data = _deferredWorkData[workId];
    if (!data) {
        global.logError('invalid work id: ' +  workId);
        return;
    }
    if (_deferredWorkQueue.indexOf(workId) < 0)
        _deferredWorkQueue.push(workId);
    if (data.actor.mapped) {
        _queueBeforeRedraw(workId);
        return;
    } else if (_deferredTimeoutId == 0) {
        _deferredTimeoutId = Mainloop.timeout_add_seconds(DEFERRED_TIMEOUT_SECONDS, function () {
            _runAllDeferredWork();
            _deferredTimeoutId = 0;
            return false;
        });
    }
}

/**
 * isInteresting:
 * @metaWindow (Meta.Window): the window to be tested
 *
 * Determines whether a window is "interesting", i.e.
 * ones to be displayed in alt-tab, window list etc.
 *
 * Returns (boolean): whether the window is interesting
 */
function isInteresting(metaWindow) {

    if (metaWindow.get_title() == "JavaEmbeddedFrame")
        return false;

    // Include any window the tracker finds interesting
    if (metaWindow.is_interesting()) {
        return true;
    }

    // Include app-less dialogs
    let type = metaWindow.get_window_type();
    if (!tracker.get_window_app(metaWindow) && (type === Meta.WindowType.DIALOG || type === Meta.WindowType.MODAL_DIALOG)) {
        return true;
    }

    return false;
}

/**
 * getTabList:
 * @workspaceOpt (Meta.Workspace): (optional) workspace, defaults to global.screen.get_active_workspace()
 * @screenOpt (Meta.Screen): (optional) screen, defaults to global.screen
 *
 * Return a list of the interesting windows on a workspace (by default,
 * the active workspace).
 * The list will include app-less dialogs.
 *
 * Returns (array): list of windows
 */
function getTabList(workspaceOpt, screenOpt) {
    let screen = screenOpt || global.screen;
    let display = screen.get_display();
    let workspace = workspaceOpt || screen.get_active_workspace();

    let windows = []; // the array to return

    let allwindows = display.get_tab_list(Meta.TabList.NORMAL_ALL, screen,
                                       workspace);
    let registry = {}; // to avoid duplicates

    for (let i = 0; i < allwindows.length; ++i) {
        let window = allwindows[i];
        if (isInteresting(window)) {
            let seqno = window.get_stable_sequence();
            if (!registry[seqno]) {
                windows.push(window);
                registry[seqno] = true; // there may be duplicates in the list (rare)
            }
        }
    }
    return windows;
}

function restartCinnamon(showOsd = false) {
    if (showOsd) {
        let dialog = new ModalDialog.InfoOSD(_("Restarting Cinnamon..."));
        dialog.actor.add_style_class_name('restart-osd');
        dialog.show();
    }

    global.reexec_self();
}
