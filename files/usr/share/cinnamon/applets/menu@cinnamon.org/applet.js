const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
const Gio = imports.gi.Gio;
const XApp = imports.gi.XApp;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;
const DocInfo = imports.misc.docInfo;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const Pango = imports.gi.Pango;
const SearchProviderManager = imports.ui.searchProviderManager;
const SignalManager = imports.misc.signalManager;
const Params = imports.misc.params;

const INITIAL_BUTTON_LOAD = 30;
const NUM_SYSTEM_BUTTONS = 3;
const MAX_BUTTON_WIDTH = "max-width: 20em;";

const USER_DESKTOP_PATH = FileUtils.getUserDesktopDir();

const PRIVACY_SCHEMA = "org.cinnamon.desktop.privacy";
const REMEMBER_RECENT_KEY = "remember-recent-files";

const AppUtils = require('./appUtils');

let appsys = Cinnamon.AppSystem.get_default();

const RefreshFlags = Object.freeze({
    APP:      0b000001,
    FAV_APP:  0b000010,
    FAV_DOC:  0b000100,
    PLACE:    0b001000,
    RECENT:   0b010000,
    SYSTEM:   0b100000
});
const REFRESH_ALL_MASK = 0b111111;

const NO_MATCH = 99999;
const APP_MATCH_ADDERS = [
    0, // name
    1000, // keywords
    2000, // desc
    3000 // id
];
const RECENT_PLACES_ADDER = 4000;

/* VisibleChildIterator takes a container (boxlayout, etc.)
 * and creates an array of its visible children and their index
 * positions.  We can then work through that list without
 * mucking about with positions and math, just give a
 * child, and it'll give you the next or previous, or first or
 * last child in the list.
 *
 * We could have this object regenerate off a signal
 * every time the visibles have changed in our applicationBox,
 * but we really only need it when we start keyboard
 * navigating, so increase speed, we reload only when we
 * want to use it.
 */

class VisibleChildIterator {
    constructor(container) {
        this.container = container;
        this.reloadVisible();
    }

    reloadVisible() {
        this.array = this.container.get_focus_chain()
        .filter(x => !(x._delegate instanceof PopupMenu.PopupSeparatorMenuItem));
    }

    getNextVisible(curChild) {
        return this.getVisibleItem(this.array.indexOf(curChild) + 1);
    }

    getPrevVisible(curChild) {
        return this.getVisibleItem(this.array.indexOf(curChild) - 1);
    }

    getFirstVisible() {
        return this.array[0];
    }

    getLastVisible() {
        return this.array[this.array.length - 1];
    }

    getVisibleIndex(curChild) {
        return this.array.indexOf(curChild);
    }

    getVisibleItem(index) {
        let len = this.array.length;
        index = ((index % len) + len) % len;
        return this.array[index];
    }

    getNumVisibleChildren() {
        return this.array.length;
    }

    getAbsoluteIndexOfChild(child) {
        return this.container.get_children().indexOf(child);
    }
}

/**
 * SimpleMenuItem type strings in use:
 * -------------------------------------------------
 * app              ApplicationButton
 * category         CategoryButton
 * fav              FavoritesButton
 * no-recent        "No recent documents" button
 * none             Default type
 * place            PlaceButton
 * recent           RecentsButton
 * recent-clear     "Clear recent documents" button
 * search-provider  SearchProviderResultButton
 * system           SystemButton
 * transient        TransientButton
 */

/**
 * SimpleMenuItem default parameters.
 */
const SMI_DEFAULT_PARAMS = Object.freeze({
    name:        '',
    description: '',
    type:        'none',
    styleClass:  'popup-menu-item',
    reactive:    true,
    activatable: true,
    withMenu:    false
});

/**
 * A simpler alternative to PopupBaseMenuItem - does not implement all interfaces of PopupBaseMenuItem. Any
 * additional properties in the params object beyond defaults will also be set on the instance.
 * @param {Object}  applet             - The menu applet instance
 * @param {Object}  params             - Object containing item parameters, all optional.
 * @param {string}  params.name        - The name for the menu item.
 * @param {string}  params.description - The description for the menu item.
 * @param {string}  params.type        - A string describing the type of item.
 * @param {string}  params.styleClass  - The item's CSS style class.
 * @param {boolean} params.reactive    - Item recieves events.
 * @param {boolean} params.activatable - Activates via primary click. Must provide an 'activate' function on
 *                                       the prototype or instance.
 * @param {boolean} params.withMenu    - Shows menu via secondary click. Must provide a 'populateMenu' function
 *                                       on the prototype or instance.
 */
class SimpleMenuItem {
    constructor(applet, params) {
        params = Params.parse(params, SMI_DEFAULT_PARAMS, true);
        this._signals = new SignalManager.SignalManager();

        this.actor = new St.BoxLayout({ style_class: params.styleClass,
                                        style: MAX_BUTTON_WIDTH,
                                        reactive: params.reactive,
                                        accessible_role: Atk.Role.MENU_ITEM });

        this._signals.connect(this.actor, 'destroy', () => this.destroy(true));

        this.actor._delegate = this;
        this.applet = applet;
        this.label = null;
        this.icon = null;

        this.matchIndex = NO_MATCH;

        for (let prop in params)
            this[prop] = params[prop];

        if (params.reactive) {
            this._signals.connect(this.actor, 'enter-event', () => applet._buttonEnterEvent(this));
            this._signals.connect(this.actor, 'leave-event', () => applet._buttonLeaveEvent(this));
            if (params.activatable || params.withMenu) {
                this._signals.connect(this.actor, 'button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
                this._signals.connect(this.actor, 'key-press-event', Lang.bind(this, this._onKeyPressEvent));
            }
        }
    }

    _onButtonReleaseEvent(actor, event) {
        let button = event.get_button();
        if (this.activate && button === Clutter.BUTTON_PRIMARY) {
            this.activate();
            return Clutter.EVENT_STOP;
        } else if (this.populateMenu && button === Clutter.BUTTON_SECONDARY) {
            this.applet.toggleContextMenu(this);
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onKeyPressEvent(actor, event) {
        let symbol = event.get_key_symbol();
        if (this.activate &&
            (symbol === Clutter.KEY_space ||
             symbol === Clutter.KEY_Return ||
             symbol === Clutter.KEY_KP_Enter)) {
            this.activate();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    /**
     * Adds an StIcon as the next child, acessible as `this.icon`.
     *
     * Either an icon name or gicon is required. Only one icon is supported by the
     * base SimpleMenuItem.
     *
     * @param {number}  iconSize - The icon size in px.
     * @param {string}  iconName - (optional) The icon name string.
     * @param {object}  gicon    - (optional) A gicon.
     * @param {boolean} symbolic - (optional) Whether the icon should be symbolic. Default: false.
     */
    addIcon(iconSize, iconName='', gicon=null, symbolic=false) {
        if (this.icon)
            return;

        let params = { icon_size: iconSize };

        if (iconName)
            params.icon_name = iconName;
        else if (gicon)
            params.gicon = gicon;

        params.icon_type = symbolic ? St.IconType.SYMBOLIC : St.IconType.FULLCOLOR;

        this.icon = new St.Icon(params);
        this.actor.add_actor(this.icon);
    }

    /**
     * Removes the icon previously added with addIcon()
     */
    removeIcon() {
        if (!this.icon)
            return;
        this.icon.destroy();
        this.icon = null;
    }

    /**
     * Adds an StLabel as the next child, accessible as `this.label`.
     *
     * Only one label is supported by the base SimpleMenuItem prototype.
     *
     * @param {string} label      - (optional) An unformatted string. If markup is required, use
     *                               native methods directly: `this.label.clutter_text.set_markup()`.
     * @param {string} styleClass - (optional) A style class for the label.
     */
    addLabel(label='', styleClass=null) {
        if (this.label)
            return;

        this.label = new St.Label({ text: label, y_expand: true, y_align: Clutter.ActorAlign.CENTER });
        if (styleClass)
            this.label.set_style_class_name(styleClass);
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.actor.add_actor(this.label);
    }

    /**
     * Removes the label previously added with addLabel()
     */
    removeLabel() {
        if (!this.label)
            return;
        this.label.destroy();
        this.label = null;
    }

    /**
     * Adds a ClutterActor as the next child.
     *
     * @param {ClutterActor} child
     */
    addActor(child) {
        this.actor.add_actor(child);
    }

    /**
     * Removes a ClutterActor.
     *
     * @param {ClutterActor} child
     */
    removeActor(child) {
        this.actor.remove_actor(child);
    }

    destroy(actorDestroySignal=false) {
        this._signals.disconnectAllSignals();

        if (this.label)
            this.label.destroy();
        if (this.icon)
            this.icon.destroy();
        if (!actorDestroySignal)
            this.actor.destroy();

        delete this.actor._delegate;
        delete this.actor;
        delete this.label;
        delete this.icon;
    }
}

class ApplicationContextMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(appButton, label, action, iconName) {
        super({focusOnHover: false});

        this._appButton = appButton;
        this._action = action;
        this.label = new St.Label({ text: label });

        if (iconName != null) {
            this.icon = new St.Icon({ icon_name: iconName, icon_size: 12, icon_type: St.IconType.SYMBOLIC });
            if (this.icon)
                this.addActor(this.icon);
        }

        this.addActor(this.label);
    }

    activate (event) {
        switch (this._action) {
            case "add_to_panel":
                if (!Main.AppletManager.get_role_provider_exists(Main.AppletManager.Roles.PANEL_LAUNCHER)) {
                    let new_applet_id = global.settings.get_int("next-applet-id");
                    global.settings.set_int("next-applet-id", (new_applet_id + 1));
                    let enabled_applets = global.settings.get_strv("enabled-applets");
                    enabled_applets.push("panel1:right:0:panel-launchers@cinnamon.org:" + new_applet_id);
                    global.settings.set_strv("enabled-applets", enabled_applets);
                }
                // wait until the panel launchers instance is actually loaded
                // 10 tries, delay 100ms
                let retries = 10;
                Mainloop.timeout_add(100, () => {
                    if (retries--) {
                        let launcherApplet = Main.AppletManager.get_role_provider(Main.AppletManager.Roles.PANEL_LAUNCHER);
                        if (!launcherApplet)
                            return true;
                        launcherApplet.acceptNewLauncher(this._appButton.app.get_id());
                    }
                    return false;
                });
                break;
            case "add_to_desktop":
                let file = Gio.file_new_for_path(this._appButton.app.get_app_info().get_filename());
                let destFile = Gio.file_new_for_path(USER_DESKTOP_PATH+"/"+file.get_basename());
                try{
                    file.copy(destFile, 0, null, function(){});
                    FileUtils.changeModeGFile(destFile, 755);
                }catch(e){
                    global.log(e);
                }
                break;
            case "add_to_favorites":
                AppFavorites.getAppFavorites().addFavorite(this._appButton.app.get_id());
                break;
            case "remove_from_favorites":
                AppFavorites.getAppFavorites().removeFavorite(this._appButton.app.get_id());
                break;
            case "uninstall":
                Util.spawnCommandLine("/usr/bin/cinnamon-remove-application '" + this._appButton.app.get_app_info().get_filename() + "'");
                break;
            case "run_with_nvidia_gpu":
                Util.spawnCommandLine("optirun gtk-launch " + this._appButton.app.get_id());
                break;
            case "offload_launch":
                try {
                    this._appButton.app.launch_offloaded(0, [], -1);
                } catch (e) {
                    logError(e, "Could not launch app with dedicated gpu: ");
                }
                break;
            default:
                return true;
        }
        this._appButton.applet.toggleContextMenu(this._appButton);
        this._appButton.applet.menu.close();
        return false;
    }

}

class GenericApplicationButton extends SimpleMenuItem {
    constructor(applet, app, type, withMenu=false, styleClass="") {
        let desc = app.get_description() || "";
        super(applet, { name: app.get_name(),
                        description: desc.split("\n")[0],
                        type: type,
                        withMenu: withMenu,
                        styleClass: styleClass,
                        app: app });
    }

    highlight() {
        if (this.actor.has_style_pseudo_class('highlighted'))
            return;

        this.actor.add_style_pseudo_class('highlighted');
    }

    unhighlight() {
        if (!this.actor.has_style_pseudo_class('highlighted'))
            return;

        let appKey = this.app.get_id() || `${this.name}:${this.description}`;
        this.applet._knownApps.add(appKey);
        this.actor.remove_style_pseudo_class('highlighted');
    }

    activate() {
        this.unhighlight();
        this.app.open_new_window(-1);
        this.applet.menu.close();
    }

    populateMenu(menu) {
        let menuItem;
        if (Main.gpu_offload_supported) {
            menuItem = new ApplicationContextMenuItem(this, _("Run with NVIDIA GPU"), "offload_launch", "cpu");
            menu.addMenuItem(menuItem);
        } else if (this.applet._isBumblebeeInstalled) {
            menuItem = new ApplicationContextMenuItem(this, _("Run with NVIDIA GPU"), "run_with_nvidia_gpu", "cpu");
            menu.addMenuItem(menuItem);
        }

        menuItem = new ApplicationContextMenuItem(this, _("Add to panel"), "add_to_panel", "list-add");
        menu.addMenuItem(menuItem);

        if (USER_DESKTOP_PATH){
            menuItem = new ApplicationContextMenuItem(this, _("Add to desktop"), "add_to_desktop", "computer");
            menu.addMenuItem(menuItem);
        }

        if (AppFavorites.getAppFavorites().isFavorite(this.app.get_id())){
            menuItem = new ApplicationContextMenuItem(this, _("Remove from favorites"), "remove_from_favorites", "starred");
            menu.addMenuItem(menuItem);
        } else {
            menuItem = new ApplicationContextMenuItem(this, _("Add to favorites"), "add_to_favorites", "non-starred");
            menu.addMenuItem(menuItem);
        }

        if (this.applet._canUninstallApps) {
            menuItem = new ApplicationContextMenuItem(this, _("Uninstall"), "uninstall", "edit-delete");
            menu.addMenuItem(menuItem);
        }
    }
}

class TransientButton extends SimpleMenuItem {
    constructor(applet, pathOrCommand) {
        super(applet, { description: pathOrCommand,
                        type: 'transient',
                        styleClass: 'menu-application-button' });
        if (pathOrCommand.startsWith('~')) {
            pathOrCommand = pathOrCommand.slice(1);
            pathOrCommand = GLib.get_home_dir() + pathOrCommand;
        }

        this.isPath = pathOrCommand.substr(pathOrCommand.length - 1) == '/';
        if (this.isPath) {
            this.path = pathOrCommand;
        } else {
            let n = pathOrCommand.lastIndexOf('/');
            if (n != 1) {
                this.path = pathOrCommand.substr(0, n);
            }
        }

        this.pathOrCommand = pathOrCommand;

        this.file = Gio.file_new_for_path(this.pathOrCommand);

        if (applet.showApplicationIcons) {
            try {
                this.handler = this.file.query_default_handler(null);
                let contentType = Gio.content_type_guess(this.pathOrCommand, null);
                let themedIcon = Gio.content_type_get_icon(contentType[0]);
                this.icon = new St.Icon({gicon: themedIcon, icon_size: applet.applicationIconSize, icon_type: St.IconType.FULLCOLOR });
            } catch (e) {
                this.handler = null;
                let iconName = this.isPath ? 'folder' : 'unknown';
                this.icon = new St.Icon({icon_name: iconName, icon_size: applet.applicationIconSize, icon_type: St.IconType.FULLCOLOR});
                // @todo Would be nice to indicate we don't have a handler for this file.
            }

            this.addActor(this.icon);
        }

        this.addLabel(this.description, 'menu-application-button-label');

        this.isDraggableApp = false;
    }

    activate() {
        if (this.handler != null) {
            this.handler.launch([this.file], null);
        } else {
            // Try anyway, even though we probably shouldn't.
            try {
                Util.spawn(['gio', 'open', this.file.get_uri()]);
            } catch (e) {
                global.logError("No handler available to open " + this.file.get_uri());
            }
        }

        this.applet.menu.close();
    }
}

class ApplicationButton extends GenericApplicationButton {
    constructor(applet, app) {
        super(applet, app, 'app', true, 'menu-application-button');
        this.category = [];

        this.icon = this.app.create_icon_texture(applet.applicationIconSize);
        this.addActor(this.icon);
        if (!applet.showApplicationIcons)
            this.icon.visible = false;

        this.addLabel(this.name, 'menu-application-button-label');

        this._draggable = DND.makeDraggable(this.actor);
        this._signals.connect(this._draggable, 'drag-end', Lang.bind(this, this._onDragEnd));
        this.isDraggableApp = true;

        this.searchStrings = [
            Util.latinise(app.get_name().toLowerCase()),
            app.get_keywords() ? Util.latinise(app.get_keywords().toLowerCase()) : "",
            app.get_description() ? Util.latinise(app.get_description().toLowerCase()) : "",
            app.get_id() ? Util.latinise(app.get_id().toLowerCase()) : ""
        ];
    }

    get_app_id() {
        return this.app.get_id();
    }

    getDragActor() {
        return this.app.create_icon_texture(this.applet.favIconSize);
    }

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource() {
        return this.actor;
    }

    _onDragEnd() {
        this.applet.favoritesBox._delegate._clearDragPlaceholder();
    }
    destroy() {
        delete this._draggable;
        super.destroy();
    }
}

class SearchProviderResultButton extends SimpleMenuItem {
    constructor(applet, provider, result) {
        super(applet, { name:result.label,
                        description: result.description,
                        type: 'search-provider',
                        styleClass: 'menu-application-button',
                        provider: provider,
                        result: result });

        if (applet.showApplicationIcons) {
            if (result.icon) {
                this.icon = result.icon;
            } else if (result.icon_app) {
                this.icon = result.icon_app.create_icon_texture(applet.applicationIconSize);
            } else if (result.icon_filename) {
                this.icon = new St.Icon({gicon: new Gio.FileIcon({file: Gio.file_new_for_path(result.icon_filename)}), icon_size: applet.applicationIconSize});
            }

            if (this.icon)
                this.addActor(this.icon);
        }

        this.addLabel(result.label, 'menu-application-button-label');
    }

    activate() {
        try {
            this.provider.on_result_selected(this.result);
            this.applet.menu.close();
        } catch(e) {
            global.logError(e);
        }
    }

    destroy() {
        delete this.provider;
        delete this.result;
        super.destroy();
    }
}

class PlaceButton extends SimpleMenuItem {
    constructor(applet, place) {
        let selectedAppId = place.idDecoded.substr(place.idDecoded.indexOf(':') + 1);
        let fileIndex = selectedAppId.indexOf('file:///');
        if (fileIndex !== -1)
            selectedAppId = selectedAppId.substr(fileIndex + 7);

        if (selectedAppId === "home" || selectedAppId === "desktop" || selectedAppId === "connect") {
            selectedAppId = place.name
        }

        super(applet, { name: place.name,
                        description: selectedAppId,
                        type: 'place',
                        styleClass: 'menu-application-button',
                        place: place });

        this.icon = place.iconFactory(applet.applicationIconSize);
        if (this.icon)
            this.addActor(this.icon);
        else
            this.addIcon(applet.applicationIconSize, 'folder');

        if (!applet.showApplicationIcons)
            this.icon.visible = false;

        this.addLabel(this.name, 'menu-application-button-label');

        this.searchStrings = [
            Util.latinise(place.name.toLowerCase())
        ];
    }

    activate() {
        this.place.launch();
        this.applet.menu.close();
    }
}

class UserfileContextMenuItem extends PopupMenu.PopupBaseMenuItem {
    constructor(button, label, is_default, cbParams, callback) {
        super({focusOnHover: false});

        this._button = button;
        this._cbParams = cbParams;
        this._callback = callback;
        this.label = new St.Label({ text: label });
        this.addActor(this.label);

        if (is_default)
            this.label.style = "font-weight: bold;";
    }

    activate (event) {
        this._callback(...this._cbParams);
        return false;
    }
}

class RecentButton extends SimpleMenuItem {
    constructor(applet, recent) {
        let fileIndex = recent.uriDecoded.indexOf("file:///");
        let selectedAppUri = fileIndex === -1 ? "" : recent.uriDecoded.substr(fileIndex + 7);

        super(applet, { name: recent.name,
                        description: selectedAppUri,
                        type: 'recent',
                        styleClass: 'menu-application-button',
                        withMenu: true,
                        mimeType: recent.mimeType,
                        uri: recent.uri,
                        uriDecoded: recent.uriDecoded });

        this.icon = recent.createIcon(applet.applicationIconSize);
        this.addActor(this.icon);
        if (!applet.showApplicationIcons)
            this.icon.visible = false;

        this.addLabel(this.name, 'menu-application-button-label');

        this.searchStrings = [
            Util.latinise(recent.name.toLowerCase())
        ];
    }

    activate() {
        try {
            Gio.app_info_launch_default_for_uri(this.uri, global.create_app_launch_context());
            this.applet.menu.close();
        } catch (e) {
            let source = new MessageTray.SystemNotificationSource();
            Main.messageTray.add(source);
            let notification = new MessageTray.Notification(source,
                                                            _("This file is no longer available"),
                                                            e.message);
            notification.setTransient(true);
            notification.setUrgency(MessageTray.Urgency.NORMAL);
            source.notify(notification);
        }
    }

    hasLocalPath(file) {
        return file.is_native() || file.get_path() != null;
    }

    populateMenu(menu) {
        let menuItem;
        menuItem = new PopupMenu.PopupMenuItem(_("Open with"), { reactive: false });
        menuItem.actor.style = "font-weight: bold";
        menu.addMenuItem(menuItem);

        let file = Gio.File.new_for_uri(this.uri);

        let default_info = Gio.AppInfo.get_default_for_type(this.mimeType, !this.hasLocalPath(file));

        let infoLaunchFunc = (info, file) => {
            info.launch([file], null);
            this.applet.toggleContextMenu(this);
            this.applet.menu.close();
        };

        if (default_info) {
            menuItem = new UserfileContextMenuItem(this,
                                                   default_info.get_display_name(),
                                                   false,
                                                   [default_info, file],
                                                   infoLaunchFunc);
            menu.addMenuItem(menuItem);
        }

        let infos = Gio.AppInfo.get_all_for_type(this.mimeType);

        for (let i = 0; i < infos.length; i++) {
            let info = infos[i];

            file = Gio.File.new_for_uri(this.uri);

            if (!this.hasLocalPath(file) && !info.supports_uris())
                continue;

            if (info.equal(default_info))
                continue;

            menuItem = new UserfileContextMenuItem(this,
                                                   info.get_display_name(),
                                                   false,
                                                   [info, file],
                                                   infoLaunchFunc);
            menu.addMenuItem(menuItem);
        }

        if (GLib.find_program_in_path ("nemo-open-with") != null) {
            menuItem = new UserfileContextMenuItem(this,
                                                 _("Other application..."),
                                                 false,
                                                 [],
                                                 () => {
                                                     Util.spawnCommandLine("nemo-open-with " + this.uri);
                                                     this.applet.toggleContextMenu(this);
                                                     this.applet.menu.close();
                                                 });
            menu.addMenuItem(menuItem);
        }
    }
}

class FavoriteButton extends SimpleMenuItem {
    constructor(applet, favoriteInfo) {
        super(applet, { name: favoriteInfo.display_name,
                        description: favoriteInfo.uri,
                        type: 'favorite',
                        styleClass: 'menu-application-button',
                        withMenu: true,
                        mimeType: favoriteInfo.cached_mimetype,
                        uri: favoriteInfo.uri });

        this.favoriteInfo = favoriteInfo;

        let gicon = Gio.content_type_get_icon(favoriteInfo.cached_mimetype);
        this.icon = new St.Icon({ gicon: gicon, icon_size: applet.applicationIconSize })

        this.addActor(this.icon);

        if (!applet.showApplicationIcons)
            this.icon.visible = false;

        this.addLabel(this.name, 'menu-application-button-label');

        this.searchStrings = [
            Util.latinise(favoriteInfo.display_name.toLowerCase())
        ];
    }

    activate() {
        try {
            XApp.Favorites.get_default().launch(this.uri, 0);
            this.applet.menu.close();
        } catch (e) {
            let source = new MessageTray.SystemNotificationSource();
            Main.messageTray.add(source);
            let notification = new MessageTray.Notification(source,
                                                            _("This file is no longer available"),
                                                            e.message);
            notification.setTransient(true);
            notification.setUrgency(MessageTray.Urgency.NORMAL);
            source.notify(notification);
        }
    }

    hasLocalPath(file) {
        return file.is_native() || file.get_path() != null;
    }

    populateMenu(menu) {
        let menuItem;
        menuItem = new PopupMenu.PopupMenuItem(_("Open with"), { reactive: false });
        menuItem.actor.style = "font-weight: bold";
        menu.addMenuItem(menuItem);

        let file = Gio.File.new_for_uri(this.uri);

        let default_info = Gio.AppInfo.get_default_for_type(this.mimeType, !this.hasLocalPath(file));

        let infoLaunchFunc = (info, file) => {
            info.launch([file], null);
            this.applet.toggleContextMenu(this);
            this.applet.menu.close();
        };

        if (default_info) {
            menuItem = new UserfileContextMenuItem(this,
                                                   default_info.get_display_name(),
                                                   false,
                                                   [default_info, file],
                                                   infoLaunchFunc);
            menu.addMenuItem(menuItem);
        }

        let infos = Gio.AppInfo.get_all_for_type(this.mimeType);

        for (let i = 0; i < infos.length; i++) {
            let info = infos[i];

            file = Gio.File.new_for_uri(this.uri);

            if (!this.hasLocalPath(file) && !info.supports_uris())
                continue;

            if (info.equal(default_info))
                continue;

            menuItem = new UserfileContextMenuItem(this,
                                                   info.get_display_name(),
                                                   false,
                                                   [info, file],
                                                   infoLaunchFunc);
            menu.addMenuItem(menuItem);
        }

        if (GLib.find_program_in_path ("nemo-open-with") != null) {
            menuItem = new UserfileContextMenuItem(this,
                                                   _("Other application..."),
                                                   false,
                                                   [],
                                                   () => {
                                                       Util.spawnCommandLine("nemo-open-with " + this.uri);
                                                       this.applet.toggleContextMenu(this);
                                                       this.applet.menu.close();
                                                   });
            menu.addMenuItem(menuItem);
        }
    }
}

class CategoryButton extends SimpleMenuItem {
    constructor(applet, categoryId, label, icon) {
        super(applet, { name: label || _("All Applications"),
                        type: 'category',
                        styleClass: 'menu-category-button',
                        categoryId: categoryId });
        this.actor.accessible_role = Atk.Role.LIST_ITEM;

        if (typeof icon === 'string')
            this.addIcon(applet.categoryIconSize, icon);
        else if (icon)
            this.addIcon(applet.categoryIconSize, null, icon);

        if (this.icon && !applet.showCategoryIcons)
            this.icon.visible = false;

        this.addLabel(this.name, 'menu-category-button-label');
    }
}

class FavoritesButton extends GenericApplicationButton {
    constructor(applet, app) {
        super(applet, app, 'fav', false, 'menu-favorites-button');
        this.icon = app.create_icon_texture(applet.favIconSize);
        this.addActor(this.icon);

        this._draggable = DND.makeDraggable(this.actor);
        this._signals.connect(this._draggable, 'drag-end', Lang.bind(this, this._onDragEnd));
        this.isDraggableApp = true;
    }

    _onDragEnd() {
        this.actor.get_parent()._delegate._clearDragPlaceholder();
    }

    get_app_id() {
        return this.app.get_id();
    }

    getDragActor() {
        return new Clutter.Clone({ source: this.actor });
    }

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource() {
        return this.actor;
    }

    destroy() {
        delete this._draggable;
        super.destroy();
    }
}

class SystemButton extends SimpleMenuItem {
    constructor(applet, iconName, name, desc) {
        super(applet, { name: name,
                        description: desc,
                        type: 'system',
                        styleClass: 'menu-favorites-button' });
        this.addIcon(applet.favIconSize, iconName);
    }
}

class CategoriesApplicationsBox {
    constructor() {
        this.actor = new St.BoxLayout();
        this.actor._delegate = this;
    }

    acceptDrop (source, actor, x, y, time) {
        if (source instanceof FavoritesButton){
            source.actor.destroy();
            actor.destroy();
            AppFavorites.getAppFavorites().removeFavorite(source.app.get_id());
            return true;
        }
        return false;
    }

    handleDragOver (source, actor, x, y, time) {
        if (source instanceof FavoritesButton)
            return DND.DragMotionResult.POINTING_DROP;

        return DND.DragMotionResult.CONTINUE;
    }
}

class FavoritesBox {
    constructor() {
        this.actor = new St.BoxLayout({ vertical: true });
        this.actor._delegate = this;

        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;
    }

    _clearDragPlaceholder() {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    }

    handleDragOver (source, actor, x, y, time) {
        let app = source.app;

        let favorites = AppFavorites.getAppFavorites().getFavorites();
        let numFavorites = favorites.length;

        let favPos = favorites.indexOf(app);

        let children = this.actor.get_children();
        let numChildren = children.length;
        let boxHeight = this.actor.height;

        // Keep the placeholder out of the index calculation; assuming that
        // the remove target has the same size as "normal" items, we don't
        // need to do the same adjustment there.
        if (this._dragPlaceholder) {
            boxHeight -= this._dragPlaceholder.actor.height;
            numChildren--;
        }

        let pos = Math.round(y * numChildren / boxHeight);

        if (pos != this._dragPlaceholderPos && pos <= numFavorites) {
            if (this._animatingPlaceholdersCount > 0) {
                let appChildren = children.filter(function(actor) {
                    return (actor._delegate instanceof FavoritesButton);
                });
                this._dragPlaceholderPos = children.indexOf(appChildren[pos]);
            } else {
                this._dragPlaceholderPos = pos;
            }

            // Don't allow positioning before or after self
            if (favPos != -1 && (pos == favPos || pos == favPos + 1)) {
                if (this._dragPlaceholder) {
                    this._dragPlaceholder.animateOutAndDestroy();
                    this._animatingPlaceholdersCount++;
                    this._dragPlaceholder.actor.connect('destroy',
                        Lang.bind(this, function() {
                            this._animatingPlaceholdersCount--;
                        }));
                }
                this._dragPlaceholder = null;

                return DND.DragMotionResult.CONTINUE;
            }

            // If the placeholder already exists, we just move
            // it, but if we are adding it, expand its size in
            // an animation
            let fadeIn;
            if (this._dragPlaceholder) {
                this._dragPlaceholder.actor.destroy();
                fadeIn = false;
            } else {
                fadeIn = true;
            }

            this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
            this._dragPlaceholder.child.set_width (source.actor.height);
            this._dragPlaceholder.child.set_height (source.actor.height);
            this.actor.insert_child_at_index(this._dragPlaceholder.actor,
                                             this._dragPlaceholderPos);
            if (fadeIn)
                this._dragPlaceholder.animateIn();
        }

        let id = app.get_id();
        let favoritesMap = AppFavorites.getAppFavorites().getFavoriteMap();
        let srcIsFavorite = (id in favoritesMap);

        if (!srcIsFavorite)
            return DND.DragMotionResult.COPY_DROP;

        return DND.DragMotionResult.MOVE_DROP;
    }

    // Draggable target interface
    acceptDrop (source, actor, x, y, time) {
        let app = source.app;

        let id = app.get_id();

        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        let srcIsFavorite = (id in favorites);

        let favPos = 0;
        let children = this.actor.get_children();
        for (let i = 0; i < this._dragPlaceholderPos; i++) {
            if (this._dragPlaceholder &&
                children[i] == this._dragPlaceholder.actor)
                continue;

            if (!(children[i]._delegate instanceof FavoritesButton)) continue;

            let childId = children[i]._delegate.app.get_id();
            if (childId == id)
                continue;
            if (childId in favorites)
                favPos++;
        }

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this,
            function () {
                let appFavorites = AppFavorites.getAppFavorites();
                if (srcIsFavorite)
                    appFavorites.moveFavoriteToPos(id, favPos);
                else
                    appFavorites.addFavoriteAtPos(id, favPos);
                return false;
            }));

        return true;
    }
}

/* This is so we can override the default key-press-event handler in PopupMenu.PopupMenu
 * and prevent animation when the menu via Escape. */
class Menu extends Applet.AppletPopupMenu {
    constructor(launcher, orientation) {
        super(launcher, orientation);
    }

    _onKeyPressEvent(actor, event) {
        if (event.get_key_symbol() === Clutter.KEY_Escape) {
            this.close(false);
            return true;
        }

        return false;
    }
}

class CinnamonMenuApplet extends Applet.TextIconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.set_applet_tooltip(_("Menu"));
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Menu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.settings = new Settings.AppletSettings(this, "menu@cinnamon.org", instance_id);

        this.settings.bind("show-favorites", "showFavorites", () => this.queueRefresh(RefreshFlags.FAV_DOC));
        this.settings.bind("show-places", "showPlaces", () => this.queueRefresh(RefreshFlags.PLACE));
        this.settings.bind("show-recents", "showRecents", () => this.queueRefresh(RefreshFlags.RECENT));

        this._appletEnterEventId = 0;
        this._appletLeaveEventId = 0;
        this._appletHoverDelayId = 0;

        this.settings.bind("hover-delay", "hover_delay_ms", this._updateActivateOnHover);
        this.settings.bind("activate-on-hover", "activateOnHover", this._updateActivateOnHover);
        this._updateActivateOnHover();

        this.menu.setCustomStyleClass('menu-background');
        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));

        this.settings.bind("menu-custom", "menuCustom", this._updateIconAndLabel);
        this.settings.bind("menu-icon", "menuIcon", this._updateIconAndLabel);
        this.settings.bind("menu-icon-size", "menuIconSize", this._updateIconAndLabel);
        this.settings.bind("menu-label", "menuLabel", this._updateIconAndLabel);
        this.settings.bind("overlay-key", "overlayKey", this._updateKeybinding);
        this.settings.bind("show-category-icons", "showCategoryIcons", () => this._updateShowIcons(this.categoriesBox, this.showCategoryIcons));
        this.settings.bind("category-icon-size", "categoryIconSize", () => this.queueRefresh(RefreshFlags.PLACE | RefreshFlags.RECENT | RefreshFlags.APP));
        this.settings.bind("show-application-icons", "showApplicationIcons", () => this._updateShowIcons(this.applicationsBox, this.showApplicationIcons));
        this.settings.bind("application-icon-size", "applicationIconSize", () => this.queueRefresh(RefreshFlags.PLACE | RefreshFlags.RECENT | RefreshFlags.APP));
        this.settings.bind("favbox-show", "favBoxShow", this._favboxtoggle);
        this.settings.bind("fav-icon-size", "favIconSize", () => this.queueRefresh(RefreshFlags.FAV_APP | RefreshFlags.SYSTEM));
        this.settings.bind("enable-animation", "enableAnimation", null);
        this.settings.bind("favbox-min-height", "favBoxMinHeight", this._recalc_height);

        this._updateKeybinding();

        Main.themeManager.connect("theme-set", Lang.bind(this, this._updateIconAndLabel));
        this._updateIconAndLabel();

        this._searchInactiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
            icon_name: 'edit-find',
            icon_type: St.IconType.SYMBOLIC });
        this._searchActiveIcon = new St.Icon({ style_class: 'menu-search-entry-icon',
            icon_name: 'edit-clear',
            icon_type: St.IconType.SYMBOLIC });
        this._searchIconClickedId = 0;
        this._applicationsButtons = [];
        this._favoriteAppButtons = [];
        this._placesButtons = [];
        this._transientButtons = [];
        this.recentButton = null;
        this._recentButtons = [];
        this.favoriteDocsButton = null;
        this._favoriteDocButtons = [];
        this._categoryButtons = [];
        this._searchProviderButtons = [];
        this._selectedItemIndex = null;
        this._previousSelectedActor = null;
        this._previousVisibleIndex = null;
        this._previousTreeSelectedActor = null;
        this._activeContainer = null;
        this._activeActor = null;
        this._knownApps = new Set(); // Used to keep track of apps that are already installed, so we can highlight newly installed ones
        this._appsWereRefreshed = false;
        this._canUninstallApps = GLib.file_test("/usr/bin/cinnamon-remove-application", GLib.FileTest.EXISTS);
        this._isBumblebeeInstalled = GLib.file_test("/usr/bin/optirun", GLib.FileTest.EXISTS);
        this.RecentManager = DocInfo.getDocManager();
        this.privacy_settings = new Gio.Settings( {schema_id: PRIVACY_SCHEMA} );
        this.noRecentDocuments = true;
        this._activeContextMenuParent = null;
        this._activeContextMenuItem = null;
        this._display();
        appsys.connect('installed-changed', () => this.queueRefresh(RefreshFlags.APP | RefreshFlags.FAV_APP));
        AppFavorites.getAppFavorites().connect('changed', () => this.queueRefresh(RefreshFlags.FAV_APP));
        Main.placesManager.connect('places-updated', () => this.queueRefresh(RefreshFlags.PLACE));
        this.RecentManager.connect('changed', () => this.queueRefresh(RefreshFlags.RECENT));
        this.privacy_settings.connect("changed::" + REMEMBER_RECENT_KEY, () => this.queueRefresh(RefreshFlags.RECENT));
        XApp.Favorites.get_default().connect("changed", () => this.queueRefresh(RefreshFlags.FAV_DOC));
        this._fileFolderAccessActive = false;
        this._pathCompleter = new Gio.FilenameCompleter();
        this._pathCompleter.set_dirs_only(false);
        this.lastAcResults = [];
        this.settings.bind("search-filesystem", "searchFilesystem");
        this.contextMenu = null;
        this.lastSelectedCategory = null;
        this.settings.bind("force-show-panel", "forceShowPanel");

        this.orderDirty = false;

        // We shouldn't need to call refreshAll() here... since we get a "icon-theme-changed" signal when CSD starts.
        // The reason we do is in case the Cinnamon icon theme is the same as the one specificed in GTK itself (in .config)
        // In that particular case we get no signal at all.
        this.refreshId = 0;
        this.refreshMask = REFRESH_ALL_MASK;
        this._doRefresh();

        this.set_show_label_in_vertical_panels(false);
    }

    _updateShowIcons(container, show) {
        Util.each(container.get_children(), c => {
            let b = c._delegate;
            if (!(b instanceof SimpleMenuItem))
                return;
            if (b.icon)
                b.icon.visible = show;
        })
    }

    _updateKeybinding() {
        Main.keybindingManager.addHotKey("overlay-key-" + this.instance_id, this.overlayKey, Lang.bind(this, function() {
            if (!Main.overview.visible && !Main.expo.visible)
                this.menu.toggle_with_options(this.enableAnimation);
        }));
    }

    queueRefresh(refreshFlags) {
        if (!refreshFlags)
            return;
        this.refreshMask |= refreshFlags;
        if (this.refreshId)
            Mainloop.source_remove(this.refreshId);
        this.refreshId = Mainloop.timeout_add(500, () => this._doRefresh(), Mainloop.PRIORITY_LOW);
    }

    _doRefresh() {
        this.refreshId = 0;
        if (this.refreshMask === 0)
            return;

        let m = this.refreshMask;
        if ((m & RefreshFlags.APP) === RefreshFlags.APP)
            this._refreshApps();
        if ((m & RefreshFlags.FAV_APP) === RefreshFlags.FAV_APP)
            this._refreshFavApps();
        if ((m & RefreshFlags.SYSTEM) === RefreshFlags.SYSTEM)
            this._refreshSystemButtons();
        if ((m & RefreshFlags.FAV_DOC) === RefreshFlags.FAV_DOC)
            this._refreshFavDocs();
        if ((m & RefreshFlags.PLACE) === RefreshFlags.PLACE)
            this._refreshPlaces();
        if ((m & RefreshFlags.RECENT) === RefreshFlags.RECENT)
            this._refreshRecent();

        this.refreshMask = 0;

        // Repack the three special categories at the bottom of the category list.
        if (this.favoriteDocsButton) {
            this.categoriesBox.set_child_at_index(this.favoriteDocsButton.actor, -1);
        }

        if (this.placesButton) {
            this.categoriesBox.set_child_at_index(this.placesButton.actor, -1);
        }

        if (this.recentButton) {
            this.categoriesBox.set_child_at_index(this.recentButton.actor, -1);
        }

        this._resizeApplicationsBox();
    }

    openMenu() {
        if (!this._applet_context_menu.isOpen) {
            this.menu.open(this.enableAnimation);
        }
    }

    _clearDelayCallbacks() {
        if (this._appletHoverDelayId > 0) {
            Mainloop.source_remove(this._appletHoverDelayId);
            this._appletHoverDelayId = 0;
        }
        if (this._appletLeaveEventId > 0) {
            this.actor.disconnect(this._appletLeaveEventId);
            this._appletLeaveEventId = 0;
        }

        return false;
    }

    _updateActivateOnHover() {
        if (this._appletEnterEventId > 0) {
            this.actor.disconnect(this._appletEnterEventId);
            this._appletEnterEventId = 0;
        }

        this._clearDelayCallbacks();

        if (!this.activateOnHover)
            return;

        this._appletEnterEventId = this.actor.connect('enter-event', () => {
            if (this.hover_delay_ms > 0) {
                this._appletLeaveEventId = this.actor.connect('leave-event', () => { this._clearDelayCallbacks });
                this._appletHoverDelayId = Mainloop.timeout_add(this.hover_delay_ms,
                    () => {
                        this.openMenu();
                        this._clearDelayCallbacks();
                    });
            } else {
                this.openMenu();
            }
        });
    }

    _recalc_height() {
        let scrollBoxHeight = (this.leftBox.get_allocation_box().y2-this.leftBox.get_allocation_box().y1) -
                               (this.searchBox.get_allocation_box().y2-this.searchBox.get_allocation_box().y1);

        this.applicationsScrollBox.style = "height: "+scrollBoxHeight / global.ui_scale +"px;";
        this.categoriesScrollBox.style = "height: "+scrollBoxHeight / global.ui_scale +"px;";
        let monitor = Main.layoutManager.monitors[this.panel.monitorIndex];
        let minSize = this.favBoxMinHeight * global.ui_scale;
        let maxSize = monitor.height - (this.systemButtonsBox.height * 2);
        let size = Math.min(minSize, maxSize);
        this.favoritesScrollBox.set_height(size);
    }

    on_orientation_changed (orientation) {
        this._updateIconAndLabel();
    }

    on_applet_removed_from_panel () {
        Main.keybindingManager.removeHotKey("overlay-key-" + this.instance_id);
    }

    // settings button callback
    _launch_editor() {
        Util.spawnCommandLine("cinnamon-menu-editor");
    }

    on_applet_clicked(event) {
        this.menu.toggle_with_options(this.enableAnimation);
    }

    _onOpenStateChanged(menu, open) {
        if (open) {
            this.actor.add_style_pseudo_class('active');
            global.stage.set_key_focus(this.searchEntry);
            this._selectedItemIndex = null;
            this._activeContainer = null;
            this._activeActor = null;

            this.lastSelectedCategory = null;

            /* This is a workaround to prevent selectedAppBox from changing height when no height value is set
             * in the .css style and thus causing the menu above to jump up and down. This has no effect when a
             * height value is set in the .css style as get_preferred_height() returns this value in this case*/
            this.selectedAppBox.set_height(-1); //unset previously set height
            this.selectedAppBox.set_height(this.selectedAppBox.get_preferred_height(-1)[1]);
            
            let n = Math.min(this._applicationsButtons.length,
                             INITIAL_BUTTON_LOAD);
            for (let i = 0; i < n; i++) {
                this._applicationsButtons[i].actor.show();
            }
            this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";

            Mainloop.idle_add(Lang.bind(this, this._initial_cat_selection, n));

            if (this.forceShowPanel) {
                this.panel.peekPanel();
            }
        } else {
            this.actor.remove_style_pseudo_class('active');
            if (this.searchActive) {
                this.resetSearch();
            }
            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");
            this._previousTreeSelectedActor = null;
            this._previousSelectedActor = null;
            this.closeContextMenu(false);
            this._previousVisibleIndex = null;

            this._clearAllSelections(true);
            this._scrollToButton(null, this.applicationsScrollBox);
            this._scrollToButton(null, this.categoriesScrollBox);
            this._scrollToButton(null, this.favoritesScrollBox);
            this.destroyVectorBox();
        }
    }

    _initial_cat_selection (start_index) {
        if(this.lastSelectedCategory !== null) //if a category is already selected
            return;
        let n = this._applicationsButtons.length;
        for (let i = start_index; i < n; i++) {
            this._applicationsButtons[i].actor.show();
        }
    }

    destroy() {
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this.emit('destroy');
    }

    _favboxtoggle() {
        if (!this.favBoxShow) {
            this.leftPane.hide();
        } else {
            this.leftPane.show();
        }
    }

    // Override js/applet.js so _updateIconAndLabel doesn't have to fight with size changes
    // from the panel configuration. This gets called any time set_applet_icon() variants are
    // called.
    _setStyle() {
        let icon_type = this._applet_icon.get_icon_type();
        let size;

        if (this.menuCustom) {
            size = Math.min(this.menuIconSize, this.panel.height);
        } else {
            size = this.getPanelIconSize(icon_type);
        }

        if (icon_type === St.IconType.FULLCOLOR) {
            this._applet_icon.set_style_class_name('applet-icon');
        } else {
            this._applet_icon.set_style_class_name('system-status-icon');
        }

        this._applet_icon.set_icon_size(size);
    }

    on_panel_icon_size_changed() {
        this._updateIconAndLabel();
    }

    _updateIconAndLabel(){
        try {
            if (this.menuCustom) {
                if (this.menuIcon == "") {
                    this.set_applet_icon_name("");
                } else if (GLib.path_is_absolute(this.menuIcon) && GLib.file_test(this.menuIcon, GLib.FileTest.EXISTS)) {
                    if (this.menuIcon.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_path(this.menuIcon);
                    else
                        this.set_applet_icon_path(this.menuIcon);
                } else if (Gtk.IconTheme.get_default().has_icon(this.menuIcon)) {
                    if (this.menuIcon.search("-symbolic") != -1)
                        this.set_applet_icon_symbolic_name(this.menuIcon);
                    else
                        this.set_applet_icon_name(this.menuIcon);
                }
            } else {
                let icon_name = global.settings.get_string('app-menu-icon-name');
                if (icon_name.search("-symbolic") != -1) {
                    this.set_applet_icon_symbolic_name(icon_name);
                }
                else {
                    this.set_applet_icon_name(icon_name);
                }
            }
        } catch(e) {
            global.logWarning("Could not load icon file \""+this.menuIcon+"\" for menu button");
        }

        // Hide the icon box if the icon name/path is empty
        if ((this.menuCustom && this.menuIcon == "") || (!this.menuCustom && global.settings.get_string('app-menu-icon-name') == "")){
            this._applet_icon_box.hide();
        } else {
            this._applet_icon_box.show();
        }

        // Hide the menu label in vertical panels
        if (this._orientation == St.Side.LEFT || this._orientation == St.Side.RIGHT)
        {
            this.set_applet_label("");
        }
        else {
            if (this.menuCustom) {
                if (this.menuLabel != "")
                    this.set_applet_label(_(this.menuLabel));
                else
                    this.set_applet_label("");
            }
            else {
                this.set_applet_label(global.settings.get_string('app-menu-label'));
            }
        }
    }

    _contextMenuOpenStateChanged(menu) {
        if (menu.isOpen) {
            this._activeContextMenuParent = menu.sourceActor._delegate;
            this._scrollToButton(menu);
        } else {
            this._activeContextMenuItem = null;
            this._activeContextMenuParent = null;
            menu.sourceActor = null;
        }
    }

    toggleContextMenu(button) {
        if (!button.withMenu)
            return;

        if (!this.contextMenu) {
            let menu = new PopupMenu.PopupSubMenu(null); // hack: creating without actor
            menu.actor.set_style_class_name('menu-context-menu');
            menu.connect('open-state-changed', Lang.bind(this, this._contextMenuOpenStateChanged));
            this.contextMenu = menu;
            this.applicationsBox.add_actor(menu.actor);
        } else if (this.contextMenu.isOpen &&
                   this.contextMenu.sourceActor != button.actor) {
            this.contextMenu.close();
        }

        if (!this.contextMenu.isOpen) {
            this.contextMenu.box.destroy_all_children();
            this.applicationsBox.set_child_above_sibling(this.contextMenu.actor, button.actor);
            this.contextMenu.sourceActor = button.actor;
            button.populateMenu(this.contextMenu);
        }

        this.contextMenu.toggle();
    }

    _navigateContextMenu(button, symbol, ctrlKey) {
        if (symbol === Clutter.KEY_Menu || symbol === Clutter.KEY_Escape ||
            (ctrlKey && (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter))) {
            this.toggleContextMenu(button);
            return;
        }

        let minIndex = 0;
        let goUp = symbol === Clutter.KEY_Up;
        let nextActive = null;
        let menuItems = this.contextMenu._getMenuItems(); // The context menu items

        // The first context menu item of a RecentButton is used just as a label.
        // So remove it from the iteration.
        if (button && button instanceof RecentButton) {
            minIndex = 1;
        }

        let menuItemsLength = menuItems.length;

        switch (symbol) {
            case Clutter.KEY_Page_Up:
                this._activeContextMenuItem = menuItems[minIndex];
                this._activeContextMenuItem.setActive(true);
                return;
            case Clutter.KEY_Page_Down:
                this._activeContextMenuItem = menuItems[menuItemsLength - 1];
                this._activeContextMenuItem.setActive(true);
                return;
        }

        if (!this._activeContextMenuItem) {
            if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                button.activate();
            } else {
                this._activeContextMenuItem = menuItems[goUp ? menuItemsLength - 1 : minIndex];
                this._activeContextMenuItem.setActive(true);
            }
            return;
        } else if (this._activeContextMenuItem &&
            (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter)) {
            this._activeContextMenuItem.activate();
            this._activeContextMenuItem = null;
            return;
        }

        for (let i = minIndex; i < menuItemsLength; i++) {
            if (menuItems[i] === this._activeContextMenuItem) {
                let nextActiveIndex = (goUp ? i - 1 : i + 1);

                if (nextActiveIndex < minIndex) {
                    nextActiveIndex = menuItemsLength - 1;
                } else if (nextActiveIndex > menuItemsLength - 1) {
                    nextActiveIndex = minIndex;
                }

                nextActive = menuItems[nextActiveIndex];
                nextActive.setActive(true);
                this._activeContextMenuItem = nextActive;

                break;
            }
        }
    }

    _onMenuKeyPress(actor, event) {
        let symbol = event.get_key_symbol();
        let item_actor;
        let index = 0;
        this.appBoxIter.reloadVisible();
        this.catBoxIter.reloadVisible();
        this.favBoxIter.reloadVisible();
        this.sysBoxIter.reloadVisible();

        let keyCode = event.get_key_code();
        let modifierState = Cinnamon.get_event_state(event);

        /* check for a keybinding and quit early, otherwise we get a double hit
           of the keybinding callback */
        let action = global.display.get_keybinding_action(keyCode, modifierState);

        if (action == Meta.KeyBindingAction.CUSTOM) {
            return true;
        }

        index = this._selectedItemIndex;

        let ctrlKey = modifierState & Clutter.ModifierType.CONTROL_MASK;

        // If a context menu is open, hijack keyboard navigation and concentrate on the context menu.
        if (this._activeContextMenuParent &&
            this._activeContainer === this.applicationsBox) {
            let continueNavigation = false;
            switch (symbol) {
                case Clutter.KEY_Up:
                case Clutter.KEY_Down:
                case Clutter.KEY_Return:
                case Clutter.KEY_KP_Enter:
                case Clutter.KEY_Menu:
                case Clutter.KEY_Page_Up:
                case Clutter.KEY_Page_Down:
                case Clutter.KEY_Escape:
                    this._navigateContextMenu(this._activeContextMenuParent, symbol, ctrlKey);
                    break;
                case Clutter.KEY_Right:
                case Clutter.KEY_Left:
                case Clutter.KEY_Tab:
                case Clutter.KEY_ISO_Left_Tab:
                    continueNavigation = true;
                    break;
            }
            if (!continueNavigation)
                return true;
        }

        let navigationKey = true;
        let whichWay = "none";

        switch (symbol) {
            case Clutter.KEY_Up:
                whichWay = "up";
                if (this._activeContainer === this.favoritesBox && ctrlKey &&
                    (this.favoritesBox.get_child_at_index(index))._delegate instanceof FavoritesButton)
                    navigationKey = false;
                break;
            case Clutter.KEY_Down:
                whichWay = "down";
                if (this._activeContainer === this.favoritesBox && ctrlKey &&
                    (this.favoritesBox.get_child_at_index(index))._delegate instanceof FavoritesButton)
                    navigationKey = false;
                break;
            case Clutter.KEY_Page_Up:
                whichWay = "top"; break;
            case Clutter.KEY_Page_Down:
                whichWay = "bottom"; break;
            case Clutter.KEY_Right:
                if (!this.searchActive)
                    whichWay = "right";
                if (this._activeContainer === this.applicationsBox)
                    whichWay = "none";
                else if (this._activeContainer === this.categoriesBox && this.noRecentDocuments &&
                         (this.categoriesBox.get_child_at_index(index))._delegate.categoryId === "recent")
                    whichWay = "none";
                break;
            case Clutter.KEY_Left:
                if (!this.searchActive)
                    whichWay = "left";
                if (this._activeContainer === this.favoritesBox || this._activeContainer === this.systemButtonsBox)
                    whichWay = "none";
                else if (!this.favBoxShow &&
                            (this._activeContainer === this.categoriesBox || this._activeContainer === null))
                    whichWay = "none";
                break;
            case Clutter.KEY_Tab:
                if (!this.searchActive)
                    whichWay = "right";
                else
                    navigationKey = false;
                break;
            case Clutter.KEY_ISO_Left_Tab:
                if (!this.searchActive)
                    whichWay = "left";
                else
                    navigationKey = false;
                break;
            default:
                navigationKey = false;
        }

        if (navigationKey) {
            switch (this._activeContainer) {
                case null:
                    switch (whichWay) {
                        case "up":
                            this._activeContainer = this.categoriesBox;
                            item_actor = this.catBoxIter.getLastVisible();
                            this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
                            break;
                        case "down":
                            this._activeContainer = this.categoriesBox;
                            item_actor = this.catBoxIter.getFirstVisible();
                            item_actor = this.catBoxIter.getNextVisible(item_actor);
                            this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
                            break;
                        case "right":
                            this._activeContainer = this.applicationsBox;
                            item_actor = this.appBoxIter.getFirstVisible();
                            this._scrollToButton();
                            break;
                        case "left":
                            if (this.favBoxShow) {
                                this._activeContainer = this.favoritesBox;
                                item_actor = this.favBoxIter.getFirstVisible();
                            } else {
                                this._activeContainer = this.applicationsBox;
                                item_actor = this.appBoxIter.getFirstVisible();
                                this._scrollToButton();
                            }
                            break;
                        case "top":
                            this._activeContainer = this.categoriesBox;
                            item_actor = this.catBoxIter.getFirstVisible();
                            this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
                            break;
                        case "bottom":
                            this._activeContainer = this.categoriesBox;
                            item_actor = this.catBoxIter.getLastVisible();
                            this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
                            break;
                    }
                    break;
                case this.categoriesBox:
                    switch (whichWay) {
                        case "up":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getPrevVisible(this._activeActor);
                            this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
                            break;
                        case "down":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getNextVisible(this._activeActor);
                            this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
                            break;
                        case "right":
                            if ((this.categoriesBox.get_child_at_index(index))._delegate.categoryId === "recent" &&
                                this.noRecentDocuments) {
                                if(this.favBoxShow) {
                                    this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                                    item_actor = this.favBoxIter.getFirstVisible();
                                } else {
                                    item_actor = this.categoriesBox.get_child_at_index(index);
                                }
                            }
                            else {
                                item_actor = (this._previousVisibleIndex != null) ?
                                    this.appBoxIter.getVisibleItem(this._previousVisibleIndex) :
                                    this.appBoxIter.getFirstVisible();
                            }
                            break;
                        case "left":
                            if(this.favBoxShow) {
                                this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                                item_actor = this.favBoxIter.getFirstVisible();
                                this._scrollToButton(null, this.favoritesScrollBox);
                            } else {
                                if ((this.categoriesBox.get_child_at_index(index))._delegate.categoryId === "recent" &&
                                    this.noRecentDocuments) {
                                    item_actor = this.categoriesBox.get_child_at_index(index);
                                } else {
                                    item_actor = (this._previousVisibleIndex != null) ?
                                        this.appBoxIter.getVisibleItem(this._previousVisibleIndex) :
                                        this.appBoxIter.getFirstVisible();
                                }
                            }
                            break;
                        case "top":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getFirstVisible();
                            this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
                            break;
                        case "bottom":
                            this._previousTreeSelectedActor = this.categoriesBox.get_child_at_index(index);
                            this._previousTreeSelectedActor._delegate.isHovered = false;
                            item_actor = this.catBoxIter.getLastVisible();
                            this._scrollToButton(item_actor._delegate, this.categoriesScrollBox);
                            break;
                    }
                    break;
                case this.applicationsBox:
                    switch (whichWay) {
                        case "up":
                            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                            item_actor = this.appBoxIter.getPrevVisible(this._previousSelectedActor);
                            this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
                            this._scrollToButton(item_actor._delegate);
                            break;
                        case "down":
                            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                            item_actor = this.appBoxIter.getNextVisible(this._previousSelectedActor);
                            this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
                            this._scrollToButton(item_actor._delegate);
                            break;
                        case "right":
                            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                            item_actor = (this._previousTreeSelectedActor != null) ?
                                this._previousTreeSelectedActor :
                                this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);

                            if (this.favBoxShow) {
                                this._buttonEnterEvent(item_actor._delegate);
                                this._previousSelectedActor = this.categoriesBox.get_child_at_index(index);
                                item_actor = this.favBoxIter.getFirstVisible();
                            }
                            break;
                        case "left":
                            this._previousSelectedActor = this.applicationsBox.get_child_at_index(index);
                            item_actor = (this._previousTreeSelectedActor != null) ?
                                this._previousTreeSelectedActor :
                                this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            break;
                        case "top":
                            item_actor = this.appBoxIter.getFirstVisible();
                            this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
                            this._scrollToButton(item_actor._delegate);
                            break;
                        case "bottom":
                            item_actor = this.appBoxIter.getLastVisible();
                            this._previousVisibleIndex = this.appBoxIter.getVisibleIndex(item_actor);
                            this._scrollToButton(item_actor._delegate);
                            break;
                    }
                    break;
                case this.favoritesBox:
                    switch (whichWay) {
                        case "up":
                            this._previousSelectedActor = this.favoritesBox.get_child_at_index(index);
                            if (this._previousSelectedActor === this.favBoxIter.getFirstVisible()) {
                                item_actor = this.sysBoxIter.getLastVisible();
                            } else {
                                item_actor = this.favBoxIter.getPrevVisible(this._previousSelectedActor);
                                this._scrollToButton(item_actor._delegate, this.favoritesScrollBox);
                            }
                            break;
                        case "down":
                            this._previousSelectedActor = this.favoritesBox.get_child_at_index(index);
                            if (this._previousSelectedActor === this.favBoxIter.getLastVisible()) {
                                item_actor = this.sysBoxIter.getFirstVisible();
                            } else {
                                item_actor = this.favBoxIter.getNextVisible(this._previousSelectedActor);
                                this._scrollToButton(item_actor._delegate, this.favoritesScrollBox);
                            }
                            break;
                        case "right":
                            item_actor = (this._previousTreeSelectedActor != null) ?
                                this._previousTreeSelectedActor :
                                this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            break;
                        case "left":
                            item_actor = (this._previousTreeSelectedActor != null) ?
                                this._previousTreeSelectedActor :
                                this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);

                            this._buttonEnterEvent(item_actor._delegate);
                            item_actor = (this._previousVisibleIndex != null) ?
                                this.appBoxIter.getVisibleItem(this._previousVisibleIndex) :
                                this.appBoxIter.getFirstVisible();
                            break;
                        case "top":
                            item_actor = this.favBoxIter.getFirstVisible();
                            break;
                        case "bottom":
                            item_actor = this.favBoxIter.getLastVisible();
                            break;
                    }
                    break;
                case this.systemButtonsBox:
                    switch (whichWay) {
                        case "up":
                            this._previousSelectedActor = this.systemButtonsBox.get_child_at_index(index);
                            if (this._previousSelectedActor === this.sysBoxIter.getFirstVisible()) {
                                item_actor = this.favBoxIter.getLastVisible();
                                this._scrollToButton(item_actor._delegate, this.favoritesScrollBox);
                            } else {
                                item_actor = this.sysBoxIter.getPrevVisible(this._previousSelectedActor);
                            }
                            break;
                        case "down":
                            this._previousSelectedActor = this.systemButtonsBox.get_child_at_index(index);
                            if (this._previousSelectedActor === this.sysBoxIter.getLastVisible()) {
                                item_actor = this.favBoxIter.getFirstVisible();
                                this._scrollToButton(null, this.favoritesScrollBox);
                            } else {
                                item_actor = this.sysBoxIter.getNextVisible(this._previousSelectedActor);
                            }
                            break;
                        case "right":
                            item_actor = (this._previousTreeSelectedActor != null) ?
                                this._previousTreeSelectedActor :
                                this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            break;
                        case "left":
                            item_actor = (this._previousTreeSelectedActor != null) ?
                                this._previousTreeSelectedActor :
                                this.catBoxIter.getFirstVisible();
                            this._previousTreeSelectedActor = item_actor;
                            index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);

                            this._buttonEnterEvent(item_actor._delegate);
                            item_actor = (this._previousVisibleIndex != null) ?
                                this.appBoxIter.getVisibleItem(this._previousVisibleIndex) :
                                this.appBoxIter.getFirstVisible();
                            break;
                        case "top":
                            item_actor = this.sysBoxIter.getFirstVisible();
                            break;
                        case "bottom":
                            item_actor = this.sysBoxIter.getLastVisible();
                            break;
                    }
                    break;
                default:
                    break;
            }
            if (!item_actor)
                return false;
            index = item_actor.get_parent()._vis_iter.getAbsoluteIndexOfChild(item_actor);
        } else {
            if ((this._activeContainer && this._activeContainer !== this.categoriesBox) &&
                (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter)) {
                if (!ctrlKey) {
                    item_actor = this._activeContainer.get_child_at_index(this._selectedItemIndex);
                    item_actor._delegate.activate();
                } else if (ctrlKey && this._activeContainer === this.applicationsBox) {
                    item_actor = this.applicationsBox.get_child_at_index(this._selectedItemIndex);
                    this.toggleContextMenu(item_actor._delegate);
                }
                return true;
            } else if (this._activeContainer === this.applicationsBox && symbol === Clutter.KEY_Menu) {
                item_actor = this.applicationsBox.get_child_at_index(this._selectedItemIndex);
                this.toggleContextMenu(item_actor._delegate);
                return true;
            } else if (!this.searchActive && this._activeContainer === this.favoritesBox && symbol === Clutter.KEY_Delete) {
                item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
                if (item_actor._delegate instanceof FavoritesButton) {
                    let favorites = AppFavorites.getAppFavorites().getFavorites();
                    let numFavorites = favorites.length;
                    AppFavorites.getAppFavorites().removeFavorite(item_actor._delegate.app.get_id());
                    if (this._selectedItemIndex == (numFavorites-1))
                        item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex-1);
                    else
                        item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
                }
            } else if (this._activeContainer === this.favoritesBox &&
                        (symbol === Clutter.KEY_Down || symbol === Clutter.KEY_Up) && ctrlKey &&
                        (this.favoritesBox.get_child_at_index(index))._delegate instanceof FavoritesButton) {
                item_actor = this.favoritesBox.get_child_at_index(this._selectedItemIndex);
                let id = item_actor._delegate.app.get_id();
                let appFavorites = AppFavorites.getAppFavorites();
                let favorites = appFavorites.getFavorites();
                let numFavorites = favorites.length;
                let favPos = 0;
                if (this._selectedItemIndex == (numFavorites-1) && symbol === Clutter.KEY_Down)
                    favPos = 0;
                else if (this._selectedItemIndex == 0 && symbol === Clutter.KEY_Up)
                    favPos = numFavorites-1;
                else if (symbol === Clutter.KEY_Down)
                    favPos = this._selectedItemIndex + 1;
                else
                    favPos = this._selectedItemIndex - 1;
                appFavorites.moveFavoriteToPos(id, favPos);
                item_actor = this.favoritesBox.get_child_at_index(favPos);
                this._scrollToButton(item_actor._delegate, this.favoritesScrollBox);
            } else if (this.searchFilesystem && (this._fileFolderAccessActive || symbol === Clutter.KEY_slash)) {
                if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
                    if (this._run(this.searchEntry.get_text())) {
                        this.menu.close();
                    }
                    return true;
                }
                if (symbol === Clutter.KEY_Escape) {
                    this.searchEntry.set_text('');
                    this._fileFolderAccessActive = false;
                }
                if (symbol === Clutter.KEY_slash) {
                    // Need preload data before get completion. GFilenameCompleter load content of parent directory.
                    // Parent directory for /usr/include/ is /usr/. So need to add fake name('a').
                    let text = this.searchEntry.get_text().concat('/a');
                    let prefix;
                    if (!text.includes(' '))
                        prefix = text;
                    else
                        prefix = text.substr(text.lastIndexOf(' ') + 1);
                    this._getCompletion(prefix);

                    return false;
                }
                if (symbol === Clutter.KEY_Tab) {
                    let text = actor.get_text();
                    let prefix;
                    if (!text.includes(' '))
                        prefix = text;
                    else
                        prefix = text.substr(text.lastIndexOf(' ') + 1);
                    let postfix = this._getCompletion(prefix);
                    if (postfix != null && postfix.length > 0) {
                        actor.insert_text(postfix, -1);
                        actor.set_cursor_position(text.length + postfix.length);
                        if (postfix[postfix.length - 1] == '/')
                            this._getCompletion(text + postfix + 'a');
                    }
                    return true;
                }
                if (symbol === Clutter.KEY_ISO_Left_Tab) {
                    return true;
                }
                return false;
            } else if (symbol === Clutter.KEY_Tab || symbol === Clutter.KEY_ISO_Left_Tab) {
                return true;
            } else {
                return false;
            }
        }

        this.selectedAppTitle.set_text("");
        this.selectedAppDescription.set_text("");

        this._selectedItemIndex = index;
        if (!item_actor || item_actor === this.searchEntry) {
            return false;
        }
        this._buttonEnterEvent(item_actor._delegate);
        return true;
    }

    _buttonEnterEvent(button) {
        let parent = button.actor.get_parent();
        if (this._activeContainer === this.categoriesBox && parent !== this._activeContainer) {
            this._previousTreeSelectedActor = this._activeActor;
            this._previousSelectedActor = null;
        }
        if (this._previousTreeSelectedActor && this._activeContainer !== this.categoriesBox &&
                parent !== this._activeContainer && button !== this._previousTreeSelectedActor && !this.searchActive) {
            this._previousTreeSelectedActor.style_class = "menu-category-button";
        }
        if (parent != this._activeContainer && parent._vis_iter) {
            parent._vis_iter.reloadVisible();
        }
        let _maybePreviousActor = this._activeActor;
        if (_maybePreviousActor && this._activeContainer !== this.categoriesBox) {
            this._previousSelectedActor = _maybePreviousActor;
            this._clearPrevSelection();
        }
        if (parent === this.categoriesBox && !this.searchActive) {
            this._previousSelectedActor = _maybePreviousActor;
            this._clearPrevCatSelection();
        }
        this._activeContainer = parent;
        this._activeActor = button.actor;

        if (this._activeContainer._vis_iter) {
            this._selectedItemIndex = this._activeContainer._vis_iter.getAbsoluteIndexOfChild(this._activeActor);
        }

        let isFav = false;
        if (button instanceof CategoryButton) {
            if (this.searchActive)
                return;
            button.isHovered = true;
            this._clearPrevCatSelection(button.actor);
            this._select_category(button.categoryId);
            this.makeVectorBox(button.actor);
        } else {
            this._previousVisibleIndex = parent._vis_iter.getVisibleIndex(button.actor);

            isFav = button instanceof FavoritesButton || button instanceof SystemButton;
            if (!isFav)
                this._clearPrevSelection(button.actor);
            this.selectedAppTitle.set_text(button.name);
            this.selectedAppDescription.set_text(button.description);
        }

        if (isFav)
            button.actor.add_style_pseudo_class("hover");
        else
            button.actor.set_style_class_name(`${button.styleClass}-selected`);
    }

    _buttonLeaveEvent (button) {
        if (button instanceof CategoryButton) {
            if (this._previousTreeSelectedActor === null) {
                this._previousTreeSelectedActor = button.actor;
            } else {
                let prevIdx = this.catBoxIter.getVisibleIndex(this._previousTreeSelectedActor);
                let nextIdx = this.catBoxIter.getVisibleIndex(button.actor);

                if (Math.abs(prevIdx - nextIdx) <= 1) {
                    this._previousTreeSelectedActor = button.actor;
                }
            }
            button.isHovered = false;
        } else {
            this._previousSelectedActor = button.actor;
            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");

            // category unselects are handled when the category actually changes
            if (button instanceof FavoritesButton || button instanceof SystemButton)
                button.actor.remove_style_pseudo_class("hover");
            else
                button.actor.set_style_class_name(button.styleClass);
        }
    }

    _clearPrevSelection(actor) {
        if (this._previousSelectedActor
            && !this._previousSelectedActor.is_finalized()
            && this._previousSelectedActor != actor) {
            if (this._previousSelectedActor._delegate instanceof FavoritesButton ||
                this._previousSelectedActor._delegate instanceof SystemButton)
                this._previousSelectedActor.remove_style_pseudo_class("hover");
            else if (!(this._previousSelectedActor._delegate instanceof CategoryButton))
                this._previousSelectedActor.style_class = "menu-application-button";
        }
    }

    _clearPrevCatSelection(actor) {
        if (this._previousTreeSelectedActor && this._previousTreeSelectedActor != actor) {
            this._previousTreeSelectedActor.style_class = "menu-category-button";

            if (this._previousTreeSelectedActor._delegate) {
                this._buttonLeaveEvent(this._previousTreeSelectedActor._delegate);
            }

            if (actor !== undefined) {
                this._previousVisibleIndex = null;
                this._previousTreeSelectedActor = actor;
            }
        } else {
            this.categoriesBox.get_children().forEach(child => child.style_class = "menu-category-button");
        }
    }

    /*
     * The vectorBox overlays the the categoriesBox to aid in navigation from categories to apps
     * by preventing misselections. It is set to the same size as the categoriesOverlayBox and
     * categoriesBox.
     *
     * The actor is a quadrilateral that we turn into a triangle by setting the A and B vertices to
     * the same position. The size and origin of the vectorBox are calculated in _getVectorInfo().
     * Using those properties, the bounding box is sized as (w, h) and the triangle is defined as
     * follows:
     *   _____
     *  |    /|D
     *  |   / |     AB: (mx, my)
     *  | A/  |      C: (w, h)
     *  | B\  |      D: (w, 0)
     *  |   \ |
     *  |____\|C
     */

    _getVectorInfo() {
        let [mx, my, mask] = global.get_pointer();
        let [bx, by] = this.categoriesOverlayBox.get_transformed_position();
        let [bw, bh] = this.categoriesOverlayBox.get_transformed_size();

        let xformed_mx = mx - bx;
        let xformed_my = my - by;

        if (xformed_mx < 0 || xformed_mx > bw || xformed_my < 0 || xformed_my > bh) {
            return null;
        }

        return { mx: xformed_mx,
                 my: xformed_my,
                 w: this.categoriesOverlayBox.width,
                 h: this.categoriesOverlayBox.height };
    }

    makeVectorBox(actor) {
        this.destroyVectorBox(actor);
        let vi = this._getVectorInfo();
        if (!vi)
            return;

        if (this.vectorBox) {
            this.vectorBox.visible = true;
        } else {
            this.vectorBox = new St.Polygon({ debug: false,  reactive: true });

            this.categoriesOverlayBox.add_actor(this.vectorBox);

            this.vectorBox.connect("leave-event", Lang.bind(this, this.destroyVectorBox));
            this.vectorBox.connect("motion-event", Lang.bind(this, this.maybeUpdateVectorBox));
        }

        Object.assign(this.vectorBox, { width: vi.w,   height:   vi.h,
                                        ulc_x: vi.mx,  ulc_y:    vi.my,
                                        llc_x: vi.mx,  llc_y:    vi.my,
                                        urc_x: vi.w,   urc_y:    0,
                                        lrc_x: vi.w,   lrc_y:    vi.h });

        this.actor_motion_id = actor.connect("motion-event", Lang.bind(this, this.maybeUpdateVectorBox));
        this.current_motion_actor = actor;
    }

    maybeUpdateVectorBox() {
        if (this.vector_update_loop) {
            Mainloop.source_remove(this.vector_update_loop);
            this.vector_update_loop = 0;
        }
        this.vector_update_loop = Mainloop.timeout_add(50, Lang.bind(this, this.updateVectorBox));
    }

    updateVectorBox(actor) {
        if (!this.current_motion_actor)
            return;
        let vi = this._getVectorInfo();
        if (vi) {
            this.vectorBox.ulc_x = vi.mx;
            this.vectorBox.llc_x = vi.mx;
            this.vectorBox.queue_repaint();
        } else {
            this.destroyVectorBox(actor);
        }
        this.vector_update_loop = 0;
        return false;
    }

    destroyVectorBox(actor) {
        if (!this.vectorBox)
            return;

        if (this.vector_update_loop) {
            Mainloop.source_remove(this.vector_update_loop);
            this.vector_update_loop = 0;
        }

        if (this.actor_motion_id > 0 && this.current_motion_actor != null) {
            this.current_motion_actor.disconnect(this.actor_motion_id);
            this.actor_motion_id = 0;
            this.current_motion_actor = null;
            this.vectorBox.visible = false;
        }
    }

    _refreshPlaces () {
        for (let i = 0; i < this._placesButtons.length; i ++) {
            this._placesButtons[i].actor.destroy();
        }

        this._placesButtons = [];

        for (let i = 0; i < this._categoryButtons.length; i++) {
            if (this._categoryButtons[i].categoryId === 'place') {
                this._categoryButtons[i].destroy();
                this._categoryButtons.splice(i, 1);
                this.placesButton = null;
                break;
            }
        }
        
        if (!this.showPlaces) {
            return;
        }

        // Now generate Places category and places buttons and add to the list
        if (!this.placesButton) {
            this.placesButton = new CategoryButton(this, 'place', _('Places'),  'folder');
            this._categoryButtons.push(this.placesButton);
            this.categoriesBox.add_actor(this.placesButton.actor);
        }

        // places go after applications. we add them in reverse starting below the last ApplicationButton
        let sibling = this._applicationsButtons[this._applicationsButtons.length - 1].actor;
        let places = Main.placesManager.getAllPlaces();
        for (let i = places.length - 1; i >= 0; i--) {
            let button = new PlaceButton(this, places[i]);
            this._placesButtons.push(button);
            this.applicationsBox.insert_child_below(button.actor, sibling);
            button.actor.visible = this.menu.isOpen;
            sibling = button.actor;
        }

        this._resizeApplicationsBox();
    }

    _refreshRecent () {
        for (let i = 0; i < this._recentButtons.length; i++) {
            this._recentButtons[i].destroy();
        }

        this._recentButtons = [];
        
        for (let i = 0; i < this._categoryButtons.length; i++) {
            if (this._categoryButtons[i].categoryId === 'recent') {
                this._categoryButtons[i].destroy();
                this._categoryButtons.splice(i, 1);
                this.recentButton = null;
                break;
            }
        }
            
        if (!this.showRecents || !this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY)) {
            return;
        }

        if (!this.recentButton) {
            this.recentButton = new CategoryButton(this, 'recent', _('Recent Files'), 'folder-recent');
            this._categoryButtons.push(this.recentButton);
            this.categoriesBox.add_actor(this.recentButton.actor);
        }

        let recents = this.RecentManager._infosByTimestamp.filter(info => !info.name.startsWith("."));
        if (recents.length > 0) {
            this.noRecentDocuments = false;
            Util.each(recents, (info) => {
                let button = new RecentButton(this, info);
                this._recentButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
                button.actor.visible = this.menu.isOpen;
            });

            let button = new SimpleMenuItem(this, { name: _("Clear list"),
                                                    description: _("Clear all recent documents"),
                                                    type: 'recent-clear',
                                                    styleClass: 'menu-application-button' });
            button.addIcon(22, 'edit-clear', null, true);
            button.addLabel("", 'menu-application-button-label');
            button.label.clutter_text.set_markup(`<b>${button.name}</b>`);
            button.activate = () => {
                this.menu.close();
                (new Gtk.RecentManager()).purge_items();
            };

            if (!this.showApplicationIcons)
                button.icon.visible = false;

            this._recentButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
            button.actor.visible = this.menu.isOpen;
        } else {
            this.noRecentDocuments = true;
            let button = new SimpleMenuItem(this, { name: _("No recent documents"),
                                                    type: 'no-recent',
                                                    styleClass: 'menu-application-button',
                                                    reactive: false,
                                                    activatable: false });
            button.addLabel(button.name, 'menu-application-button-label');
            this._recentButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
            button.actor.visible = this.menu.isOpen;
        }

        this._resizeApplicationsBox();
    }

    _refreshFavDocs() {
        for (let i = 0; i < this._favoriteDocButtons.length; i++) {
            this._favoriteDocButtons[i].destroy();
        }

        this._favoriteDocButtons = [];

        for (let i = 0; i < this._categoryButtons.length; i++) {
            if (this._categoryButtons[i].categoryId === 'favorite') {
                this._categoryButtons[i].destroy();
                this._categoryButtons.splice(i, 1);
                this.favoriteDocsButton = null;
                break;
            }
        }

        let favorite_infos = XApp.Favorites.get_default().get_favorites(null);

        if (!this.showFavorites || favorite_infos.length == 0) {
            return;
        }

        if (!this.favoriteDocsButton) {
            this.favoriteDocsButton = new CategoryButton(this, 'favorite', _('Favorites'), 'xapp-user-favorites');
            this._categoryButtons.push(this.favoriteDocsButton);
            this.categoriesBox.add_actor(this.favoriteDocsButton.actor);
        }

        Util.each(favorite_infos, (info) => {
            let button = new FavoriteButton(this, info);
            this._favoriteDocButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
            button.actor.visible = this.menu.isOpen;
        });

        this._resizeApplicationsBox();
    }

    _refreshApps() {
        /* iterate in reverse, so multiple splices will not upset
         * the remaining elements */
        for (let i = this._categoryButtons.length - 1; i > -1; i--) {
            let b = this._categoryButtons[i];
            if (b === this._allAppsCategoryButton ||
                ['place', 'recent', 'favorite'].includes(b.categoryId))
                continue;
            this._categoryButtons[i].destroy();
            this._categoryButtons.splice(i, 1);
        }

        this._applicationsButtons.forEach(button => button.destroy());
        this._applicationsButtons = [];

        if (!this._allAppsCategoryButton) {
            this._allAppsCategoryButton = new CategoryButton(this);
            this.categoriesBox.add_actor(this._allAppsCategoryButton.actor);
            this._categoryButtons.push(this._allAppsCategoryButton);
        }

        // grab top level directories and all apps in them
        let [apps, dirs] = AppUtils.getApps();

        // generate all category buttons from top-level directories
        Util.each(dirs, (d) => {
            let categoryButton = new CategoryButton(this, d.get_menu_id(), d.get_name(), d.get_icon());
            this._categoryButtons.push(categoryButton);
            this.categoriesBox.add_actor(categoryButton.actor);
        });

        /* we add them in reverse at index 0 so they are always above places and
         * recent buttons, and below */
        for (let i = apps.length - 1; i > -1; i--) {
            let app = apps[i][0];
            let button = new ApplicationButton(this, app);
            button.category = apps[i][1];
            let appKey = app.get_id() || `${app.get_name()}:${app.get_description()}`;

            // appsWereRefreshed if this is not initial load. on initial load every
            // app is marked known.
            if (this._appsWereRefreshed && !this._knownApps.has(appKey))
                button.highlight();
            else
                this._knownApps.add(appKey);

            this._applicationsButtons.push(button);
            this.applicationsBox.insert_child_at_index(button.actor, 0);
            button.actor.visible = this.menu.isOpen;
        }

        // we expect this array to be in the same order as the child list
        this._applicationsButtons.reverse();
        this._appsWereRefreshed = true;
    }

    _refreshFavApps() {
        //Remove all favorites
        this.favoritesBox.destroy_all_children();

        //Load favorites again
        this._favoriteAppButtons = [];
        let launchers = global.settings.get_strv('favorite-apps');
        for ( let i = 0; i < launchers.length; ++i ) {
            let app = appsys.lookup_app(launchers[i]);
            if (app) {
                let button = new FavoritesButton(this, app);
                this._favoriteAppButtons[app] = button;
                this.favoritesBox.add(button.actor, { y_align: St.Align.END, y_fill: false });
            }
        }
    }

    _refreshSystemButtons() {
        // Remove all system buttons
        this.systemButtonsBox.destroy_all_children();

        // Load system buttons again
        let button;

        //Lock screen
        button = new SystemButton(this, "system-lock-screen",
                                  _("Lock screen"),
                                  _("Lock the screen"));

        button.activate = () => {
            this.menu.close();

            let screensaver_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.screensaver" });
            let screensaver_dialog = Gio.file_new_for_path("/usr/bin/cinnamon-screensaver-command");
            if (screensaver_dialog.query_exists(null)) {
                if (screensaver_settings.get_boolean("ask-for-away-message")) {
                    Util.spawnCommandLine("cinnamon-screensaver-lock-dialog");
                }
                else {
                    Util.spawnCommandLine("cinnamon-screensaver-command --lock");
                }
            }
            else {
                this._screenSaverProxy.LockRemote("");
            }
        };

        this.systemButtonsBox.add(button.actor, { y_align: St.Align.END, y_fill: false });

        //Logout button
        button = new SystemButton(this, "system-log-out",
                                  _("Logout"),
                                  _("Leave the session"));

        button.activate = () => {
            this.menu.close();
            this._session.LogoutRemote(0);
        };

        this.systemButtonsBox.add(button.actor, { y_align: St.Align.END, y_fill: false });

        //Shutdown button
        button = new SystemButton(this, "system-shutdown",
                                  _("Quit"),
                                  _("Shut down the computer"));

        button.activate = () => {
            this.menu.close();
            this._session.ShutdownRemote();
        };

        this.systemButtonsBox.add(button.actor, { y_align: St.Align.END, y_fill: false });
    }

    _scrollToButton(button, scrollBox = null) {
        if (!scrollBox)
            scrollBox = this.applicationsScrollBox;

        let adj = scrollBox.get_vscroll_bar().get_adjustment();
        if (button) {
            let box = scrollBox.get_allocation_box();
            let boxHeight = box.y2 - box.y1;
            let actorBox = button.actor.get_allocation_box();
            let currentValue = adj.get_value();
            let newValue = currentValue;

            if (currentValue > actorBox.y1 - 10)
                newValue = actorBox.y1 - 10;
            if (boxHeight + currentValue < actorBox.y2 + 10)
                newValue = actorBox.y2 - boxHeight + 10;

            if (newValue != currentValue)
                adj.set_value(newValue);
        } else {
            adj.set_value(0);
        }
    }

    _display() {
        this._activeContainer = null;
        this._activeActor = null;
        this.vectorBox = null;
        this.actor_motion_id = 0;
        this.vector_update_loop = null;
        this.current_motion_actor = null;
        let section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);

        this.leftPane = new St.BoxLayout({ vertical: true });

        this.leftBox = new St.BoxLayout({ style_class: 'menu-favorites-box', vertical: true });

        this._session = new GnomeSession.SessionManager();
        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();

        this.leftPane.add(this.leftBox, { y_align: St.Align.END, y_fill: false });
        this._favboxtoggle();

        let rightPane = new St.BoxLayout({ vertical: true });

        this.searchBox = new St.BoxLayout({ style_class: 'menu-search-box' });

        this.searchEntry = new St.Entry({ name: 'menu-search-entry',
                                     hint_text: _("Type to search..."),
                                     track_hover: true,
                                     can_focus: true });
        this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
        this.searchBox.add(this.searchEntry, {x_fill: true, x_align: St.Align.START, y_align: St.Align.MIDDLE, y_fill: false, expand: true});
        this.searchActive = false;
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
        this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));
        this._previousSearchPattern = "";

        this.categoriesApplicationsBox = new CategoriesApplicationsBox();
        rightPane.add_actor(this.searchBox);
        rightPane.add_actor(this.categoriesApplicationsBox.actor);

        this.categoriesOverlayBox = new Clutter.Actor();
        this.categoriesBox = new St.BoxLayout({ style_class: 'menu-categories-box',
                                                vertical: true,
                                                accessible_role: Atk.Role.LIST });
        this.categoriesScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox' });
        this.categoriesOverlayBox.add_actor(this.categoriesScrollBox);

        this.applicationsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade menu-applications-scrollbox' });
        this.favoritesScrollBox = new St.ScrollView({
            x_fill: true,
            y_fill: false,
            y_align: St.Align.START,
            style_class: 'vfade menu-favorites-scrollbox'
        });

        this.a11y_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.a11y.applications" });
        this.a11y_settings.connect("changed::screen-magnifier-enabled", Lang.bind(this, this._updateVFade));
        this.a11y_mag_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.a11y.magnifier" });
        this.a11y_mag_settings.connect("changed::mag-factor", Lang.bind(this, this._updateVFade));

        this._updateVFade();

        this.settings.bind("enable-autoscroll", "autoscroll_enabled", this._update_autoscroll);
        this._update_autoscroll();

        let vscroll = this.applicationsScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start',
                        Lang.bind(this, function() {
                            this.menu.passEvents = true;
                        }));
        vscroll.connect('scroll-stop',
                        Lang.bind(this, function() {
                            this.menu.passEvents = false;
                        }));

        let vscrollCat = this.categoriesScrollBox.get_vscroll_bar();
        vscrollCat.connect('scroll-start',
                        Lang.bind(this, function() {
                            this.menu.passEvents = true;
                        }));
        vscrollCat.connect('scroll-stop',
                        Lang.bind(this, function() {
                            this.menu.passEvents = false;
                        }));

        this.applicationsBox = new St.BoxLayout({ style_class: 'menu-applications-inner-box', vertical:true });
        this.applicationsBox.add_style_class_name('menu-applications-box'); //this is to support old themes
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this.categoriesScrollBox.add_actor(this.categoriesBox);
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.categoriesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.categoriesApplicationsBox.actor.add_actor(this.categoriesOverlayBox);
        this.categoriesApplicationsBox.actor.add_actor(this.applicationsScrollBox);

        this.favoritesBox = new FavoritesBox().actor;
        this.favoritesScrollBox.add_actor(this.favoritesBox);
        this.favoritesScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.NEVER);

        this.leftBox.add(this.favoritesScrollBox, {
            y_align: St.Align.END,
            y_fill: false
        });

        this.systemButtonsBox = new St.BoxLayout({ vertical: true });
        this.leftBox.add(this.systemButtonsBox, { y_align: St.Align.END, y_fill: false });

        this.mainBox = new St.BoxLayout({ style_class: 'menu-applications-outer-box', vertical:false });
        this.mainBox.add_style_class_name('menu-applications-box'); //this is to support old themes

        this.mainBox.add(this.leftPane, { span: 1 });
        this.mainBox.add(rightPane, { span: 1 });
        this.mainBox._delegate = null;

        this.selectedAppBox = new St.BoxLayout({ style_class: 'menu-selected-app-box', vertical: true });
        this.selectedAppTitle = new St.Label({ style_class: 'menu-selected-app-title', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppTitle);
        this.selectedAppDescription = new St.Label({ style_class: 'menu-selected-app-description', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppDescription);
        this.selectedAppBox._delegate = null;

        section.actor.add(this.mainBox);
        section.actor.add_actor(this.selectedAppBox);

        this.appBoxIter = new VisibleChildIterator(this.applicationsBox);
        this.applicationsBox._vis_iter = this.appBoxIter;
        this.catBoxIter = new VisibleChildIterator(this.categoriesBox);
        this.categoriesBox._vis_iter = this.catBoxIter;
        this.favBoxIter = new VisibleChildIterator(this.favoritesBox);
        this.favoritesBox._vis_iter = this.favBoxIter;
        this.sysBoxIter = new VisibleChildIterator(this.systemButtonsBox);
        this.systemButtonsBox._vis_iter = this.sysBoxIter;

        Mainloop.idle_add(Lang.bind(this, function() {
            this._clearAllSelections(true);
        }));

        this.menu.actor.connect("allocation-changed", Lang.bind(this, this._on_allocation_changed));
    }

    _updateVFade() {
        let mag_on = this.a11y_settings.get_boolean("screen-magnifier-enabled") &&
                     this.a11y_mag_settings.get_double("mag-factor") > 1.0;
        if (mag_on) {
            this.applicationsScrollBox.style_class = "menu-applications-scrollbox";
            this.categoriesScrollBox.style_class = "menu-applications-scrollbox";
            this.favoritesScrollBox.style_class = "menu-favorites-scrollbox";
        } else {
            this.applicationsScrollBox.style_class = "vfade menu-applications-scrollbox";
            this.categoriesScrollBox.style_class = "vfade menu-applications-scrollbox";
            this.favoritesScrollBox.style_class = "vfade menu-favorites-scrollbox";
        }
    }

    _update_autoscroll() {
        this.applicationsScrollBox.set_auto_scrolling(this.autoscroll_enabled);
        this.categoriesScrollBox.set_auto_scrolling(this.autoscroll_enabled);
        this.favoritesScrollBox.set_auto_scrolling(this.autoscroll_enabled);
    }

    _on_allocation_changed(box, flags, data) {
        this._recalc_height();
    }

    _clearAllSelections(hide_apps) {
        let actors = this.applicationsBox.get_children();
        for (let i = 0; i < actors.length; i++) {
            let actor = actors[i];
            actor.style_class = "menu-application-button";
            if (hide_apps) {
                actor.hide();
            }
        }
        actors = this.categoriesBox.get_children();
        for (let i = 0; i < actors.length; i++){
            let actor = actors[i];
            actor.style_class = "menu-category-button";
            actor.show();
        }
        actors = this.favoritesBox.get_children();
        for (let i = 0; i < actors.length; i++){
            let actor = actors[i];
            actor.remove_style_pseudo_class("hover");
            actor.show();
        }
        actors = this.systemButtonsBox.get_children();
        for (let i = 0; i < actors.length; i++){
            let actor = actors[i];
            actor.remove_style_pseudo_class("hover");
            actor.show();
        }
    }

    _resetSortOrder() {
        let pos = 0;

        for (let i = 0; i < this._applicationsButtons.length; i++) {
            this.applicationsBox.set_child_at_index(this._applicationsButtons[i].actor, pos++);
        }

        for (let i = 0; i < this._favoriteDocButtons.length; i++) {
            this.applicationsBox.set_child_at_index(this._favoriteDocButtons[i].actor, pos++);
        }

        for (let i = 0; i < this._placesButtons.length; i++) {
            this.applicationsBox.set_child_at_index(this._placesButtons[i].actor, pos++);
        }

        for (let i = 0; i < this._recentButtons.length; i++) {
            this.applicationsBox.set_child_at_index(this._recentButtons[i].actor, pos++);
        }
    }

    _select_category (name) {
        if (name === this.lastSelectedCategory)
            return;
        this.lastSelectedCategory = name;
        this._displayButtons(name || 'app');
        this.closeContextMenu(false);
    }

    closeContextMenu(animate) {
        if (!this.contextMenu || !this.contextMenu.isOpen)
            return;

        if (animate)
            this.contextMenu.toggle();
        else
            this.contextMenu.close();
    }

    _resizeApplicationsBox() {
        let width = -1;
        Util.each(this.applicationsBox.get_children(), c => {
            let [min, nat] = c.get_preferred_width(-1.0);
            if (nat > width)
                width = nat;
        });
        this.applicationsBox.set_width(width + 42); // The answer to life...
    }

    /**
     * Reset the ApplicationsBox to a specific category or list of buttons.
     * @param {String} category     (optional) The button type or application category to be displayed.
     * @param {Array} buttons       (optional) A list of existing buttons to show.
     * @param {Array} autoCompletes (optional) A list of autocomplete strings to add buttons for and show.
     */
    _displayButtons(category, buttons=[], autoCompletes=[]){
        /* We only operate on SimpleMenuItems here. If any other menu item types
         * are added, they should be managed independently. */
        if (category) {
            if (this.orderDirty) {
                this._resetSortOrder();
                this.orderDirty = false;
            }

            Util.each(this.applicationsBox.get_children(), c => {
                let b = c._delegate;
                if (!(b instanceof SimpleMenuItem))
                    return;

                // destroy temporary buttons
                if (b.type === 'transient' || b.type === 'search-provider') {
                    b.destroy();
                    return;
                }

                c.visible = b.type.includes(category) || b.type === 'app' && b.category.includes(category);
            });
        } else {
            this.orderDirty = true;

            Util.each(this.applicationsBox.get_children(), c => {
                let b = c._delegate;
                if (!(b instanceof SimpleMenuItem))
                    return;

                // destroy temporary buttons
                if (b.type === 'transient' || b.type === 'search-provider' || b.type === 'search-result') {
                    b.destroy();
                    return;
                }

                c.visible = false;
            });

            buttons.sort((ba, bb) => {
                if (ba.matchIndex < bb.matchIndex) {
                    return -1;
                } else
                if (bb.matchIndex < ba.matchIndex) {
                    return 1;
                }

                return ba.searchStrings < bb.searchStrings ? -1 : 1;
            });

            for (let i = 0; i < buttons.length; i++) {
                this.applicationsBox.set_child_at_index(buttons[i].actor, i);
                buttons[i].actor.visible = true;
            }
        }

        // reset temporary button storage
        this._transientButtons = [];
        this._searchProviderButtons = [];

        if (autoCompletes) {
            Util.each(autoCompletes, item => {
                let button = new TransientButton(this, item);
                this._transientButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
            });
        }
    }

    _setCategoriesButtonActive(active) {
        try {
            let categoriesButtons = this.categoriesBox.get_children();
            for (var i in categoriesButtons) {
                let button = categoriesButtons[i];
                let icon = button._delegate.icon;
                if (active){
                    button.set_style_class_name("menu-category-button");
                    if (icon) {
                        icon.set_opacity(255);
                    }
                } else {
                    button.set_style_class_name("menu-category-button-greyed");
                    if (icon) {
                        let icon_opacity = icon.get_theme_node().get_double('opacity');
                        icon_opacity = Math.min(Math.max(0, icon_opacity), 1);
                        if (icon_opacity) // Don't set opacity to 0 if not defined
                            icon.set_opacity(icon_opacity * 255);
                    }
                }
            }
        } catch (e) {
            global.log(e);
        }
    }

    resetSearch(){
        this.searchEntry.set_text("");
    }

    _onSearchTextChanged (se, prop) {
        let searchString = this.searchEntry.get_text().trim();
        let searchActive = !(searchString == '' || searchString == this.searchEntry.hint_text);
        if (!this.searchActive && !searchActive)
            return;

        if (searchString == this._previousSearchPattern)
            return;
        this._previousSearchPattern = searchString;

        this.searchActive = searchActive;
        this._fileFolderAccessActive = searchActive && this.searchFilesystem;
        this._clearAllSelections();

        if (searchActive) {
            this.searchEntry.set_secondary_icon(this._searchActiveIcon);
            if (!this._searchIconClickedId) {
                this._searchIconClickedId =
                    this.searchEntry.connect('secondary-icon-clicked', () => {
                        this.resetSearch();
                        this._select_category();
                    });
            }
            this._setCategoriesButtonActive(false);
            this.lastSelectedCategory = "search"

            this._doSearch(searchString);
        } else {
            if (this._searchIconClickedId > 0)
                this.searchEntry.disconnect(this._searchIconClickedId);
            this._searchIconClickedId = 0;
            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
            this._previousSearchPattern = "";
            this._setCategoriesButtonActive(true);
            this._select_category();
            this._allAppsCategoryButton.actor.style_class = "menu-category-button-selected";
            this._activeContainer = null;
            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");
        }
    }

    _matchNames(buttons, pattern){
        let ret = [];
        let regexpPattern = new RegExp(Util.escapeRegExp(pattern));

        for (let i = 0; i < buttons.length; i++) {
            if (buttons[i].type == "recent-clear" || buttons[i].type == "no-recent") {
                continue;
            }
            let res = buttons[i].searchStrings[0].match(regexpPattern);
            if (res) {
                buttons[i].matchIndex = res.index + RECENT_PLACES_ADDER;
                ret.push(buttons[i]);
            } else {
                buttons[i].matchIndex = NO_MATCH;
            }
        }

        return ret;
    }

    _listApplications(pattern){
        if (!pattern)
            return [];

        let apps = [];
        let regexpPattern = new RegExp(Util.escapeRegExp(pattern));

        for (let i in this._applicationsButtons) {
            let button = this._applicationsButtons[i];

            for (let j = 0; j < button.searchStrings.length; j++) {
                let res = button.searchStrings[j].match(regexpPattern);
                if (res) {
                    button.matchIndex = res.index + APP_MATCH_ADDERS[j];
                    apps.push(button);
                    break;
                } else {
                    button.matchIndex = NO_MATCH;
                }
            }
        }

        return apps;
    }

    _doSearch(rawPattern){
        let pattern = Util.latinise(rawPattern.toLowerCase());

        this._searchTimeoutId = 0;
        this._activeContainer = null;
        this._activeActor = null;
        this._selectedItemIndex = null;
        this._previousTreeSelectedActor = null;
        this._previousSelectedActor = null;

        let buttons = this._listApplications(pattern);

        let result = this._matchNames(this._favoriteDocButtons, pattern);
        buttons = buttons.concat(result);

        result = this._matchNames(this._placesButtons, pattern);
        buttons = buttons.concat(result);

        result = this._matchNames(this._recentButtons, pattern);
        buttons = buttons.concat(result);

        var acResults = []; // search box autocompletion results
        if (this.searchFilesystem) {
            // Don't use the pattern here, as filesystem is case sensitive
            acResults = this._getCompletions(rawPattern);
        }

        this._displayButtons(null, buttons, acResults);

        if (buttons.length || acResults.length) {
            this.appBoxIter.reloadVisible();
            let item_actor = this.appBoxIter.getFirstVisible();
            this._selectedItemIndex = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
            this._activeContainer = this.applicationsBox;
            this._scrollToButton(item_actor._delegate);
            this._buttonEnterEvent(item_actor._delegate);
        } else {
            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");
        }

        SearchProviderManager.launch_all(pattern, Lang.bind(this, function(provider, results) {
            try {
                for (var i in results) {
                    if (results[i].type != 'software')
                    {
                        let button = new SearchProviderResultButton(this, provider, results[i]);
                        this._searchProviderButtons.push(button);
                        this.applicationsBox.add_actor(button.actor);
                        if (this._selectedItemIndex === null) {
                            this.appBoxIter.reloadVisible();
                            let item_actor = this.appBoxIter.getFirstVisible();
                            this._selectedItemIndex = this.appBoxIter.getAbsoluteIndexOfChild(item_actor);
                            this._activeContainer = this.applicationsBox;
                            if (item_actor && item_actor != this.searchEntry) {
                                this._buttonEnterEvent(item_actor._delegate);
                            }
                        }
                    }
                }
            } catch(e) {
                global.log(e);
            }
        }));

        return false;
    }

    _getCompletion (text) {
        if (!text.includes('/') || text.endsWith('/'))
            return '';
        return this._pathCompleter.get_completion_suffix(text);
    }

    _getCompletions (text) {
        if (!text.includes('/'))
            return [];
        return this._pathCompleter.get_completions(text);
    }

    _run (input) {
        this._commandError = false;
        if (input) {
            let path = null;
            if (input.startsWith('/')) {
                path = input;
            } else {
                if (input.startsWith('~'))
                    input = input.slice(1);
                path = GLib.get_home_dir() + '/' + input;
            }

            if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                let file = Gio.file_new_for_path(path);
                try {
                    Gio.app_info_launch_default_for_uri(file.get_uri(),
                                                        global.create_app_launch_context());
                } catch (e) {
                    // The exception from gjs contains an error string like:
                    //     Error invoking Gio.app_info_launch_default_for_uri: No application
                    //     is registered as handling this file
                    // We are only interested in the part after the first colon.
                    //let message = e.message.replace(/[^:]*: *(.+)/, '$1');
                    return false;
                }
            } else {
                return false;
            }
        }

        return true;
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonMenuApplet(orientation, panel_height, instance_id);
}
