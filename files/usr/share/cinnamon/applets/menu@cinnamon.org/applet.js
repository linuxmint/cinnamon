const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;
const UserWidget = imports.ui.userWidget;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Atk = imports.gi.Atk;
const Gio = imports.gi.Gio;
const XApp = imports.gi.XApp;
const AccountsService = imports.gi.AccountsService;
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

const USER_DESKTOP_PATH = FileUtils.getUserDesktopDir();

const PRIVACY_SCHEMA = "org.cinnamon.desktop.privacy";
const REMEMBER_RECENT_KEY = "remember-recent-files";

const AppUtils = require('./appUtils');

let appsys = Cinnamon.AppSystem.get_default();

const POPUP_MIN_WIDTH = 500;
const POPUP_MAX_WIDTH = 900;
const POPUP_MIN_HEIGHT = 400;
const POPUP_MAX_HEIGHT = 1400;

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
const MATCH_ADDERS = [
    0, // name
    1000, // keywords
    2000, // desc
    3000 // id
];

function calc_angle(x, y) {
    if (x === 0) { x = .001 }
    if (y === 0) { y = .001 }

    let r = Math.atan2(y, x) * (180 / Math.PI);
    return r;
}

function shorten_path(path, filename) {
    let str = path.replace("file://", "");
    str = str.replace(GLib.get_home_dir(), "~");
    str = str.replace("/" + filename, "");
    return str;
}


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

    next(curChild) {
        return this.getVisibleItem(this.array.indexOf(curChild) + 1);
    }

    prev(curChild) {
        return this.getVisibleItem(this.array.indexOf(curChild) - 1);
    }

    first() {
        return this.array[0];
    }

    last() {
        return this.array[this.array.length - 1];
    }

    getVisibleItem(index) {
        let len = this.array.length;
        index = ((index % len) + len) % len;
        return this.array[index];
    }

}

/**
 * SimpleMenuItem type strings in use:
 * -------------------------------------------------
 * app              ApplicationButton
 * category         CategoryButton
 * fav              FavoritesButton
 * no-recent        "No recent documents" button
 * no-favorites     "No favorite documents" button
 * none             Default type
 * place            PlaceButton
 * favorite         PathButton
 * recent           PathButton
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
 * @param {boolean} params.reactive    - Item receives events.
 * @param {boolean} params.activatable - Activates via primary click. Must provide an 'activate' function on
 *                                       the prototype or instance.
 * @param {boolean} params.withMenu    - Shows menu via secondary click. Must provide a 'populateMenu' function
 *                                       on the prototype or instance.
 */
class SimpleMenuItem {
    constructor(applet, params) {
        params = Params.parse(params, SMI_DEFAULT_PARAMS, true);
        this._signals = new SignalManager.SignalManager();

        this.actor = new St.BoxLayout({
            style_class: params.styleClass,
            reactive: params.reactive,
            accessible_role: Atk.Role.MENU_ITEM,
        });

        this._signals.connect(this.actor, 'destroy', () => this.destroy(true));

        this.actor._delegate = this;
        this.applet = applet;
        this.labelContainer = new St.BoxLayout({
            vertical: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.label = null;
        this.descriptionLabel = null;
        this.icon = null;

        this.matchIndex = NO_MATCH;

        for (let prop in params)
            this[prop] = params[prop];

        if (params.reactive) {
            this._signals.connect(this.actor, 'enter-event', () => applet._buttonEnterEvent(this));
            this._signals.connect(this.actor, 'leave-event', () => applet._buttonLeaveEvent(this));
            if (params.activatable || params.withMenu) {
                this._signals.connect(this.actor, 'button-release-event', this._onButtonReleaseEvent.bind(this));
                this._signals.connect(this.actor, 'key-press-event', this._onKeyPressEvent.bind(this));
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
     * Adds an StIcon as the next child, accessible as `this.icon`.
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

        this.label = new St.Label({ text: label });
        if (styleClass)
            this.label.set_style_class_name(styleClass);
        this.label.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.actor.add_actor(this.labelContainer);
        this.labelContainer.add_actor(this.label);
        this.actor.set_label_actor(this.label);
    }

    addDescription(label='', styleClass=null) {
        if (this.descriptionLabel)
            return;

        if (label === '')
            return;

        this.descriptionLabel = new St.Label({
            text: label,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER
        });

        if (styleClass)
            this.descriptionLabel.set_style_class_name(styleClass);
        this.descriptionLabel.clutter_text.ellipsize = Pango.EllipsizeMode.END;
        this.labelContainer.add_actor(this.descriptionLabel);
    }

    updateAccessibleName() {
        this.actor.set_label_actor(null);

        let name = "";
        if (this.label)
            name += this.label.get_text();
        if (this.descriptionLabel) {
            if (name.length > 0)
                name += ". ";
            name += this.descriptionLabel.get_text();
        }
        this.actor.set_accessible_name(name);
    }

    /**
     * Adds a ClutterActor as the next child.
     *
     * @param {ClutterActor} child
     */
    addActor(child) {
        this.actor.add_actor(child);
    }

    destroy(actorDestroySignal=false) {
        this._signals.disconnectAllSignals();

        if (this.label)
            this.label.destroy();
        if (this.descriptionLabel)
            this.descriptionLabel.destroy();
        if (this.icon)
            this.icon.destroy();
        if (!actorDestroySignal)
            this.actor.destroy();

        delete this.actor._delegate;
        delete this.actor;
        delete this.label;
        delete this.descriptionLabel;
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
            this.icon = new St.Icon({
                icon_name: iconName,
                icon_size: 12,
                icon_type: St.IconType.SYMBOLIC,
            });
            if (this.icon)
                this.addActor(this.icon);
        }

        this.addActor(this.label);
        this.actor.set_label_actor(this.label);

        this._signals.connect(this, "active-changed", () => {
            if (this.active)
                this.actor.add_accessible_state(Atk.StateType.FOCUSED);
            else
                this.actor.remove_accessible_state(Atk.StateType.FOCUSED);
        });
    }

    activate (event) {
        let closeMenu = true;
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
                this.label.set_text(_("Remove from favorites"));
                this.icon.icon_name = "xsi-starred";
                this._action = "remove_from_favorites";
                closeMenu = false;
                break;
            case "remove_from_favorites":
                AppFavorites.getAppFavorites().removeFavorite(this._appButton.app.get_id());
                this.label.set_text(_("Add to favorites"));
                this.icon.icon_name = "xsi-non-starred";
                this._action = "add_to_favorites";
                closeMenu = false;
                break;
            case "app_properties":
                Util.spawnCommandLine("cinnamon-desktop-editor -mlauncher -o" + GLib.shell_quote(this._appButton.app.get_app_info().get_filename()));
                break;
            case "uninstall":
                Util.spawnCommandLine("/usr/bin/cinnamon-remove-application '" + this._appButton.app.get_app_info().get_filename() + "'");
                break;
            case "offload_launch":
                try {
                    this._appButton.app.launch_offloaded(0, [], -1);
                } catch (e) {
                    logError(e, "Could not launch app with dedicated gpu: ");
                }
                break;
            default:
                if (this._action.startsWith("action_")) {
                    let action = this._action.substring(7);
                    this._appButton.app.get_app_info().launch_action(action, global.create_app_launch_context());
                } else return true;
        }
        if (closeMenu) {
            this._appButton.applet.toggleContextMenu(this._appButton);
            this._appButton.applet.menu.close();
        }
        return false;
    }

}

class GenericApplicationButton extends SimpleMenuItem {
    constructor(applet, app, type, withMenu=false, styleClass="") {
        let desc = app.get_description() || "";
        super(applet, {
            name: app.get_name(),
            description: desc.split("\n")[0],
            type: type,
            withMenu: withMenu,
            styleClass: styleClass,
            app: app,
        });
    }

    set_application_icon(icon_size) {
        this.icon = this.app.create_icon_texture(icon_size);
        if (this.icon instanceof St.Icon) {
            let gicon = this.icon.get_gicon();
            if (gicon?.get_names) {
                let iconTheme = Gtk.IconTheme.get_default();
                let hasAnyIcon = gicon.get_names()
                    .some(name => iconTheme.lookup_icon(name, this.icon.icon_size, 0));
                if (!hasAnyIcon) {
                    this.icon = new St.Icon({
                        icon_name: 'application-x-executable',
                        icon_size: icon_size,
                        icon_type: St.IconType.FULLCOLOR
                    });
                }
            }
        }
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
            menuItem = new ApplicationContextMenuItem(this, _("Run with dedicated GPU"), "offload_launch", "xsi-cpu");
            menu.addMenuItem(menuItem);
        }

        menuItem = new ApplicationContextMenuItem(this, _("Add to panel"), "add_to_panel", "xsi-list-add");
        menu.addMenuItem(menuItem);

        if (USER_DESKTOP_PATH){
            menuItem = new ApplicationContextMenuItem(this, _("Add to desktop"), "add_to_desktop", "xsi-computer");
            menu.addMenuItem(menuItem);
        }

        if (AppFavorites.getAppFavorites().isFavorite(this.app.get_id())){
            menuItem = new ApplicationContextMenuItem(this, _("Remove from favorites"), "remove_from_favorites", "xsi-starred");
            menu.addMenuItem(menuItem);
        } else {
            menuItem = new ApplicationContextMenuItem(this, _("Add to favorites"), "add_to_favorites", "xsi-non-starred");
            menu.addMenuItem(menuItem);
        }

        const appinfo = this.app.get_app_info();

        if (appinfo.get_filename() != null) {
            menuItem = new ApplicationContextMenuItem(this, _("Properties"), "app_properties", "xsi-document-properties-symbolic");
            menu.addMenuItem(menuItem);
        }

        if (this.applet._canUninstallApps) {
            menuItem = new ApplicationContextMenuItem(this, _("Uninstall"), "uninstall", "xsi-edit-delete");
            menu.addMenuItem(menuItem);
        }

        for (const action of appinfo.list_actions()) {
            let icon = Util.getDesktopActionIcon(action);
            let label = appinfo.get_action_name(action);
            menuItem = new ApplicationContextMenuItem(this, label, "action_" + action, icon);
            menu.addMenuItem(menuItem);
        }
    }
}

class TransientButton extends SimpleMenuItem {
    constructor(applet, pathOrCommand) {
        super(applet, {
            description: pathOrCommand,
            type: 'transient',
            styleClass: 'appmenu-application-button',
        });

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

        try {
            this.handler = this.file.query_default_handler(null);
            let contentType = Gio.content_type_guess(this.pathOrCommand, null);
            let themedIcon = Gio.content_type_get_icon(contentType[0]);
            this.icon = new St.Icon({
                gicon: themedIcon,
                icon_size: applet.applicationIconSize,
                icon_type: St.IconType.FULLCOLOR,
            });
        } catch (e) {
            this.handler = null;
            let iconName = this.isPath ? 'folder' : 'unknown';
            this.icon = new St.Icon({
                icon_name: iconName,
                icon_size: applet.applicationIconSize,
                icon_type: St.IconType.FULLCOLOR,
            });
            // @todo Would be nice to indicate we don't have a handler for this file.
        }

        this.addActor(this.icon);

        this.addLabel(this.description, 'appmenu-application-button-label');

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
        super(applet, app, 'app', true, 'appmenu-application-button');
        this.category = [];
        this.set_application_icon(applet.applicationIconSize);
        this.addActor(this.icon);

        this.addLabel(this.name, 'appmenu-application-button-label');
        if (applet.showDescription)
            this.addDescription(this.description, 'appmenu-application-button-description');

        this.updateAccessibleName();

        this._draggable = DND.makeDraggable(this.actor);
        this._signals.connect(this._draggable, 'drag-end', this._onDragEnd.bind(this));
        this.isDraggableApp = true;

        this.searchStrings = [
            AppUtils.decomp_string(app.get_name()).replace(/\s/g, ''),
            app.get_keywords() ? AppUtils.decomp_string(app.get_keywords()) : "",
            app.get_description() ? AppUtils.decomp_string(app.get_description()).replace(/\s/g, '') : "",
            app.get_id() ? AppUtils.decomp_string(app.get_id()) : ""
        ];
    }

    get_app_id() {
        return this.app.get_id();
    }

    getDragActor() {
        return this.app.create_icon_texture(this.applet.sidebarIconSize);
    }

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource() {
        return this.actor;
    }

    _onDragEnd() {
        this.applet.favoriteAppsBox._delegate._clearDragPlaceholder();
    }

    destroy() {
        delete this._draggable;
        super.destroy();
    }
}

class SearchProviderResultButton extends SimpleMenuItem {
    constructor(applet, provider, result) {
        super(applet, {
            name:result.label,
            description: result.description,
            type: 'search-provider',
            styleClass: 'appmenu-application-button',
            provider: provider,
            result: result,
        });

        if (result.icon) {
            this.icon = result.icon;
        } else if (result.icon_app) {
            this.icon = result.icon_app.create_icon_texture(applet.applicationIconSize);
        } else if (result.icon_filename) {
            this.icon = new St.Icon({
                gicon: new Gio.FileIcon({ file: Gio.file_new_for_path(result.icon_filename) }),
                icon_size: applet.applicationIconSize,
            });
        }

        if (this.icon)
            this.addActor(this.icon);

        this.addLabel(result.label, 'appmenu-application-button-label');
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

        super(applet, {
            name: place.name,
            type: 'place',
            styleClass: 'appmenu-sidebar-button',
            place: place,
        });

        this.icon = place.iconFactory(applet.sidebarIconSize);
        if (this.icon)
            this.addActor(this.icon);
        else
            this.addIcon(applet.applicationIconSize, 'folder');

        this.addLabel(this.name, 'appmenu-application-button-label');
    }

    activate() {
        this.place.launch();
        this.applet.menu.close();
    }
}

class RecentButton extends SimpleMenuItem {
    constructor(applet, recent) {
        let path = recent.uriDecoded.replace("file://", "");
        path = path.replace(GLib.get_home_dir(), "~").replace("/" + recent.name, "");

        super(applet, {
            name: recent.name,
            description: path,
            type: 'recent',
            styleClass: 'appmenu-application-button',
            withMenu: true,
            uri: recent.uri,
        });

        this.icon = recent.createIcon(applet.applicationIconSize);
        this.addActor(this.icon);

        this.addLabel(this.name, 'appmenu-application-button-label');
        if (applet.showDescription)
            this.addDescription(this.description, 'appmenu-application-button-description');

        this.searchStrings = [
            AppUtils.decomp_string(recent.name).replace(/\s/g, '')
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
}

class PathButton extends SimpleMenuItem {
    constructor(applet, type, name, uri, icon) {
        super(applet, {
            name: name,
            description: shorten_path(uri, name),
            type: type,
            styleClass: 'appmenu-application-button',
            withMenu: false,
            uri: uri,
        });

        this.icon = icon;
        this.addActor(this.icon);

        this.addLabel(name, 'appmenu-application-button-label');

        if (applet.showDescription)
            this.addDescription(this.description, 'appmenu-application-button-description');

        this.searchStrings = [
            AppUtils.decomp_string(name).replace(/\s/g, '')
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
}

class CategoryButton extends SimpleMenuItem {
    constructor(applet, categoryId, label, icon, symbolic=false) {
        super(applet, {
            name: label,
            type: 'category',
            styleClass: 'appmenu-category-button',
            categoryId: categoryId,
        });

        let size = applet.categoryIconSize;
        if (applet.symbolicCategoryIcons) {
            symbolic = true;
            if (typeof icon !== 'string')
                if (icon?.get_names)
                    icon = icon.get_names()[0];
                else
                    icon = "";
            if (icon.startsWith("applications-") || icon === "folder-recent")
                icon = "xsi-" + icon;
            else if (icon == "xapp-user-favorites")
                icon = "xsi-user-favorites-symbolic";
            else if (icon == "preferences-system")
                icon = "xsi-applications-administration";
            else if (icon == "preferences-desktop")
                icon = "xsi-applications-preferences";
            else if (icon == "wine")
                icon = "xsi-applications-wine";
            else
                icon = "xsi-applications-other";
        }

        if (typeof icon === 'string')
            this.addIcon(size, icon, null, symbolic);
        else if (icon)
            this.addIcon(size, null, icon, symbolic);

        this.addLabel(this.name, 'appmenu-category-button-label');

        this.actor_motion_id = 0;
    }

    activate() {
        if(this.applet.searchActive || this.categoryId === this.applet.lastSelectedCategory)
            return;
        this.applet._select_category(this.categoryId);
        this.applet.hoveredApp = null;
        this.applet.categoriesBox.get_children().forEach(child =>
            child.set_style_class_name("appmenu-category-button"));
        this.actor.style_class = "appmenu-category-button-selected";
    }
}

class FavoritesButton extends GenericApplicationButton {
    constructor(applet, app) {
        super(applet, app, 'fav', false, 'appmenu-sidebar-button');
        this.set_application_icon(applet.sidebarIconSize);
        this.addActor(this.icon);
        this.addLabel(this.name, 'appmenu-application-button-label');

        this._draggable = DND.makeDraggable(this.actor);
        this._signals.connect(this._draggable, 'drag-end', this._onDragEnd.bind(this));
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
        super(applet, {
            name: name,
            description: desc,
            type: 'system',
            styleClass: 'appmenu-system-button',
        });
        this.addIcon(16, iconName, null, true);
        this.actor.set_accessible_name(name);
        this.actor.set_accessible_role(Atk.Role.BUTTON);
    }
}

class CategoriesApplicationsBox {
    constructor() {
        this.actor = new St.BoxLayout({ vertical: false, style_class: 'appmenu-categories-applications-box' });
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

class SidebarScrollBox {
    constructor() {
        this.actor = new St.BoxLayout({
            vertical: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: 'appmenu-sidebar-scrollbox'
        });
        this.actor._delegate = this;
    }
}

class FavoriteAppsBox {
    constructor() {
        this.actor = new St.BoxLayout({
            vertical: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            style_class: 'appmenu-favs-box'
        });
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
                    this._dragPlaceholder.actor.connect('destroy', () => {
                        this._animatingPlaceholdersCount--;
                    });
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

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, () => {
                let appFavorites = AppFavorites.getAppFavorites();
                if (srcIsFavorite)
                    appFavorites.moveFavoriteToPos(id, favPos);
                else
                    appFavorites.addFavoriteAtPos(id, favPos);
                return false;
            });

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

        const edit_item = new PopupMenu.PopupIconMenuItem(_("Edit menu"), "xsi-document-edit", St.IconType.SYMBOLIC);
        edit_item.connect("activate", () => Util.spawnCommandLine("cinnamon-menu-editor"));
        this._applet_context_menu.addMenuItem(edit_item);

        this.settings = new Settings.AppletSettings(this, "menu@cinnamon.org", instance_id);
        this.settings.connect("settings-changed", () => {
            this._size_dirty = true;
        });

        global.connect("scale-changed", () => {
            this._size_dirty = true;
        })

        this._resizer = new Applet.PopupResizeHandler(this.menu.actor,
            () => this._orientation,
            (w,h) => this._onBoxResized(w,h),
            () => this.popup_width * global.ui_scale,
            () => this.popup_height * global.ui_scale);

        this.settings.bind("show-favorites", "showFavorites", () => this.queueRefresh(RefreshFlags.FAV_DOC));
        this.settings.bind("show-recents", "showRecents", () => this.queueRefresh(RefreshFlags.RECENT));

        this._appletEnterEventId = 0;
        this._appletLeaveEventId = 0;
        this._appletHoverDelayId = 0;

        this.settings.bind("hover-delay", "hover_delay_ms", this._updateActivateOnHover);
        this.settings.bind("activate-on-hover", "activateOnHover", this._updateActivateOnHover);
        this._updateActivateOnHover();

        this.menu.setCustomStyleClass('appmenu-background');
        this.menu.connect('open-state-changed', this._onOpenStateChanged.bind(this));
        this.menu.connect('menu-animated-closed', () => {
            this._clearAllSelections();
            this._hideAllAppActors();
        });

        this.settings.bind("menu-custom", "menuCustom", this._updateIconAndLabel);
        this.settings.bind("menu-icon", "menuIcon", this._updateIconAndLabel);
        this.settings.bind("menu-icon-size", "menuIconSize", this._updateIconAndLabel);
        this.settings.bind("menu-label", "menuLabel", this._updateIconAndLabel);
        this.settings.bind("overlay-key", "overlayKey", this._updateKeybinding);
        this.settings.bind("symbolic-category-icons", "symbolicCategoryIcons", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("category-icon-size", "categoryIconSize", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("category-hover", "categoryHover", this._updateCategoryHover);
        this.settings.bind("application-icon-size", "applicationIconSize", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("search-position", "searchPosition", () => this._layout());
        this.settings.bind("system-position", "systemPosition", () => this._layout());
        this.settings.bind("show-description", "showDescription", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-sidebar", "showSidebar", this._sidebarToggle);
        this.settings.bind("sidebar-max-width", "sidebarMaxWidth", this._sidebarToggle);
        this.settings.bind("show-avatar", "showAvatar", this._avatarToggle);
        this.settings.bind("show-home", "showHome", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-desktop", "showDesktop", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-downloads", "showDownloads", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-documents", "showDocuments", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-music", "showMusic", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-pictures", "showPictures", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-videos", "showVideos", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("show-bookmarks", "showBookmarks", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("sidebar-icon-size", "sidebarIconSize", () => this.queueRefresh(REFRESH_ALL_MASK));
        this.settings.bind("enable-animation", "enableAnimation", null);
        this.settings.bind("popup-width", "popup_width");
        this.settings.bind("popup-height", "popup_height");

        this._updateKeybinding();

        Main.themeManager.connect("theme-set", this._theme_set.bind(this));
        this._updateIconAndLabel();

        this._searchInactiveIcon = new St.Icon({
            style_class: 'appmenu-search-entry-icon',
            icon_name: 'xsi-edit-find',
            icon_type: St.IconType.SYMBOLIC,
        });
        this._searchActiveIcon = new St.Icon({
            style_class: 'appmenu-search-entry-icon',
            icon_name: 'xsi-edit-clear',
            icon_type: St.IconType.SYMBOLIC,
        });
        this._searchIconClickedId = 0;
        this._applicationsButtons = [];
        this._placesButtons = [];
        this._transientButtons = [];
        this.recentButton = null;
        this._recentButtons = [];
        this.favoriteDocsButton = null;
        this._favoriteDocButtons = [];
        this._categoryButtons = [];
        this._searchProviderButtons = [];
        this.hoveredApp = null;
        this.hoveredCategory = null;
        this._activeContainer = null;
        this._activeActor = null;
        this._knownApps = new Set(); // Used to keep track of apps that are already installed, so we can highlight newly installed ones
        this._appsWereRefreshed = false;
        this._canUninstallApps = GLib.file_test("/usr/bin/cinnamon-remove-application", GLib.FileTest.EXISTS);
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
        this._pathCompleter = new Gio.FilenameCompleter();
        this._pathCompleter.set_dirs_only(false);
        this.contextMenu = null;
        this.lastSelectedCategory = null;

        this.orderDirty = false;

        this._session = new GnomeSession.SessionManager();
        this._screenSaverProxy = new ScreenSaver.ScreenSaverProxy();

        // We shouldn't need to call refreshAll() here... since we get a "icon-theme-changed" signal when CSD starts.
        // The reason we do is in case the Cinnamon icon theme is the same as the one specified in GTK itself (in .config)
        // In that particular case we get no signal at all.
        this.refreshId = 0;
        this.refreshMask = REFRESH_ALL_MASK;
        this._doRefresh();

        this.set_show_label_in_vertical_panels(false);
    }

    _onBoxResized(width, height) {
        width = (width / global.ui_scale).clamp(POPUP_MIN_WIDTH, POPUP_MAX_WIDTH);
        height = (height / global.ui_scale).clamp(POPUP_MIN_HEIGHT, POPUP_MAX_HEIGHT);

        //Only update settings when resizing is completed to avoid excessive disk writes.
        if (!this._resizer.resizingInProgress) {
            this.popup_width = width;
            this.popup_height = height;
        }

        this._setMenuSize(width, height);
    }

    _updateKeybinding() {
        Main.keybindingManager.addXletHotKey(this, "overlay-key", this.overlayKey, () => {
            if (!Main.overview.visible && !Main.expo.visible) {
                this.menu.toggle_with_options(this.enableAnimation);
            }
        });
    }

    _updateCategoryHover() {
        this.categoriesBox.get_children().forEach(child => {
            if (child._delegate.actor_motion_id > 0) {
                child.disconnect(child._delegate.actor_motion_id);
                child._delegate.actor_motion_id = 0;
            }

            if (this.categoryHover) {
                child._delegate.actor_motion_id = child.connect("motion-event", this._categoryMotionEvent.bind(this));
            }
        }, this);
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
        if ((m & RefreshFlags.SYSTEM) === RefreshFlags.SYSTEM)
            this._refreshSystemButtons();
        if ((m & RefreshFlags.FAV_DOC) === RefreshFlags.FAV_DOC)
            this._refreshFavDocs();
        if ((m & RefreshFlags.PLACE) === RefreshFlags.PLACE)
            this._refreshSidebar();
        if ((m & RefreshFlags.FAV_APP) === RefreshFlags.FAV_APP)
            this._refreshSidebar();
        if ((m & RefreshFlags.RECENT) === RefreshFlags.RECENT)
            this._refreshRecent();

        this.refreshMask = 0;

        // Repack the three special categories at the bottom of the category list.
        if (this.favoriteDocsButton) {
            this.categoriesBox.set_child_at_index(this.favoriteDocsButton.actor, -1);
        }

        if (this.recentButton) {
            this.categoriesBox.set_child_at_index(this.recentButton.actor, -1);
        }

        this._size_dirty = true;

        this._updateCategoryHover();
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

    _setMenuSize(width, height) {
        this.main_container.natural_height = (height * global.ui_scale);
        this.main_container.natural_width = (width * global.ui_scale);
        this._size_dirty = false;
    }

    on_orientation_changed (orientation) {
        this._updateIconAndLabel();
        this._size_dirty = true;
    }

    on_applet_removed_from_panel () {
        Main.keybindingManager.removeXletHotKey(this, "overlay-key");
    }

    // settings button callbacks
    _launch_editor() {
        Util.spawnCommandLine("cinnamon-menu-editor");
    }

    _reset_menu_size() {
        this.popup_width = this.settings.getDefaultValue("popup-width");
        this.popup_height = this.settings.getDefaultValue("popup-height");

        this._setMenuSize(this.popup_width, this.popup_height);
    }

    on_applet_clicked(event) {
        this.menu.toggle_with_options(this.enableAnimation);
    }

    _onOpenStateChanged(menu, open) {
        if (open) {
            this.actor.add_style_pseudo_class('active');
            global.stage.set_key_focus(this.searchEntry);
            this._activeContainer = null;
            this._activeActor = null;

            this.lastSelectedCategory = null;

            if (this._size_dirty) {
                this._setMenuSize(this.popup_width, this.popup_height);
            }

            let n = Math.min(this._applicationsButtons.length,
                             INITIAL_BUTTON_LOAD);
            for (let i = 0; i < n; i++) {
                this._applicationsButtons[i].actor.show();
            }
            this._allAppsCategoryButton.actor.style_class = "appmenu-category-button-selected";

            Mainloop.idle_add(() => {
                if(this.lastSelectedCategory !== null) //if a category is already selected
                    return;
                for (let i = n; i < this._applicationsButtons.length; i++)
                    this._applicationsButtons[i].actor.show();
            });
        } else {
            this.actor.remove_style_pseudo_class('active');
            if (this.searchActive) {
                this.resetSearch();
            }

            this.hoveredCategory = null;
            this.hoveredApp = null;
            this.closeContextMenu(false);

            this._disableVectorMask();
            this._scrollToButton(null, this.applicationsScrollView);
            this._scrollToButton(null, this.categoriesScrollView);
            this._scrollToButton(null, this.sidebarScrollView);
        }
    }

    destroy() {
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this.emit('destroy');
    }

    _sidebarToggle() {
        if (!this.showSidebar)
            this.sidebar.hide();
        else {
            this.sidebar.show();
            this.sidebar.set_style(`max-width: ${this.sidebarMaxWidth}px;`);
        }

        this.updateNavigation();
    }

    _avatarToggle() {
        if (!this.showAvatar) {
            this.userIcon.hide();
            this.avatarSeparator.hide();
        }
        else {
            this.userIcon.show();
            this.avatarSeparator.show();
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

    _theme_set() {
        this._size_dirty = true;
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

            // More hack! Let the application box adjust its scrollbar instead of allowing this
            // context menu to have one (which ends up with a tiny allocation) - this occurs when
            // the menu is restrained by the work area.
            menu._needsScrollbar = function() {
                return false;
            };

            menu.actor.set_style_class_name('appmenu-context-menu');
            menu.connect('open-state-changed', this._contextMenuOpenStateChanged.bind(this));
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
        let goUp = symbol === Clutter.KEY_Up || symbol === Clutter.KEY_KP_Up;
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
        this.appBoxIter.reloadVisible();
        this.catBoxIter.reloadVisible();
        this.placesBoxIter.reloadVisible();
        this.favBoxIter.reloadVisible();
        this.sysBoxIter.reloadVisible();

        let keyCode = event.get_key_code();
        let modifierState = Cinnamon.get_event_state(event);

        /* Accounts for mirrored RTL layout.
           Switches between left/right key presses */
        if(St.Widget.get_default_direction() === St.TextDirection.RTL) {
            switch(symbol) {
                case Clutter.KEY_Right:
                    symbol = Clutter.KEY_Left;
                    break;
                case Clutter.KEY_KP_Right:
                    symbol = Clutter.KEY_RP_Left;
                    break;
                case Clutter.KEY_Left:
                    symbol = Clutter.KEY_Right;
                    break;
                case Clutter.KEY_KP_Left:
                    symbol = Clutter.KEY_KP_Right;
                    break;
            }
        }

        /* check for a keybinding and quit early, otherwise we get a double hit
           of the keybinding callback */
        let action = global.display.get_keybinding_action(keyCode, modifierState);

        if (action == Meta.KeyBindingAction.CUSTOM) {
            return Clutter.EVENT_STOP;
        }

        if (this.searchEntryText.has_preedit()) {
            // There is an uncommitted text in the search box, let the input method to handle this.
            return Clutter.EVENT_PROPAGATE;
        }

        let ctrlKey = modifierState & Clutter.ModifierType.CONTROL_MASK;

        // If a context menu is open, hijack keyboard navigation and concentrate on the context menu.
        if (this._activeContextMenuParent &&
            this._activeContainer === this.applicationsBox) {
            let continueNavigation = false;
            switch (symbol) {
                case Clutter.KEY_Up:
                case Clutter.KEY_KP_Up:
                case Clutter.KEY_Down:
                case Clutter.KEY_KP_Down:
                case Clutter.KEY_Return:
                case Clutter.KEY_KP_Enter:
                case Clutter.KEY_Menu:
                case Clutter.KEY_Page_Up:
                case Clutter.KEY_Page_Down:
                case Clutter.KEY_Escape:
                    this._navigateContextMenu(this._activeContextMenuParent, symbol, ctrlKey);
                    break;
                case Clutter.KEY_Right:
                case Clutter.KEY_KP_Right:
                case Clutter.KEY_Left:
                case Clutter.KEY_KP_Left:
                case Clutter.KEY_Tab:
                case Clutter.KEY_ISO_Left_Tab:
                    continueNavigation = true;
                    break;
            }
            if (!continueNavigation)
                return Clutter.EVENT_STOP;
        }

        if (this._activeContainer === null) {
            this._setKeyFocusToCurrentCategoryButton();
        }

        if (this._activeContainer === null) {
            // Likely there are no categories or apps visible due to a bad search, let the key event
            // event continue to the search entry.
            return Clutter.EVENT_PROPAGATE;
        }

        let iter = this._activeContainer._vis_iter;
        let active = this._activeActor;
        switch (symbol) {
            case Clutter.KEY_Up:
            case Clutter.KEY_KP_Up:
                item_actor = iter.prev(active);
                if (iter.up && active === iter.first())
                    item_actor = iter.up.last();
                break;
            case Clutter.KEY_Down:
            case Clutter.KEY_KP_Down:
                item_actor = iter.next(active);
                if (iter.down && active === iter.last())
                    item_actor = iter.down.first();
                break;
            case Clutter.KEY_Right:
            case Clutter.KEY_KP_Right:
            case Clutter.KEY_Tab:
                if (!this.searchActive) {
                    item_actor = iter.right.first();
                    if (iter.right === this.catBoxIter)
                        item_actor = this.hoveredCategory || iter.right.first();
                    else if (iter.right === this.appBoxIter)
                        item_actor = this.hoveredApp || iter.right.first();
                    if (this._activeContainer === this.systemBox) {
                        if (active === iter.last())
                            item_actor = iter.right.first();
                        else
                            item_actor = iter.next(active);
                    }
                }
                break;
            case Clutter.KEY_Left:
            case Clutter.KEY_KP_Left:
            case Clutter.KEY_ISO_Left_Tab:
                if (!this.searchActive)  {
                    item_actor = iter.left.first();
                    if (iter.left === this.catBoxIter)
                        item_actor = this.hoveredCategory || iter.left.first();
                    else if (iter.left === this.appBoxIter)
                        item_actor = this.hoveredApp || iter.left.first();
                    else if (iter.left === this.sysBoxIter)
                        item_actor = iter.left.last();
                    if (this._activeContainer === this.systemBox) {
                        if (active === iter.first())
                            item_actor = iter.left.first();
                        else
                            item_actor = iter.prev(active);
                    }
                }
                break;
            case Clutter.KEY_Return:
            case Clutter.KEY_KP_Enter:
                if (ctrlKey && this._activeContainer === this.applicationsBox) {
                    this.toggleContextMenu(active._delegate);
                    return Clutter.EVENT_STOP;
                }
                else {
                    active._delegate.activate();
                    return Clutter.EVENT_STOP;
                }
                break;
            case Clutter.KEY_Menu:
                if (this._activeContainer === this.applicationsBox) {
                    this.toggleContextMenu(active._delegate);
                    return Clutter.EVENT_STOP;
                }
            default:
                break;
        }

        if (!item_actor || item_actor === this.searchEntry) {
            return Clutter.EVENT_PROPAGATE;
        }

        if (item_actor._delegate instanceof CategoryButton)
            this._scrollToButton(item_actor._delegate, this.categoriesScrollView);
        else if (item_actor._delegate instanceof FavoritesButton)
            this._scrollToButton(item_actor._delegate, this.sidebarScrollView);
        else if (item_actor.get_parent() === this.applicationsBox)
            this._scrollToButton(item_actor._delegate, this.applicationsScrollView);

        this._buttonEnterEvent(item_actor._delegate);
        return Clutter.EVENT_STOP;
    }

    _buttonEnterEvent(button) {
        this.categoriesBox.get_children().forEach(child => child.remove_style_pseudo_class("hover"));
        this.categoriesBox.get_children().forEach(child => child.remove_accessible_state(Atk.StateType.FOCUSED));
        this.applicationsBox.get_children().forEach(child => child.set_style_class_name("appmenu-application-button"));
        this.favoriteAppsBox.get_children().forEach(child => child.remove_style_pseudo_class("hover"));
        this.placesBox.get_children().forEach(child => child.remove_style_pseudo_class("hover"));
        this.systemBox.get_children().forEach(child => child.remove_style_pseudo_class("hover"));

        if (button instanceof CategoryButton) {
            if (this.searchActive)
                return;

            if (button.categoryId !== this.lastSelectedCategory) {
                if (this.categoryHover) {
                    this.categoriesBox.get_children().forEach(child =>
                        child.set_style_class_name("appmenu-category-button"));
                    button.activate();
                } else {
                    button.actor.add_style_pseudo_class("hover");
                }
            }
            this.hoveredCategory = button.actor;
        } else {
            const isFav = button instanceof FavoritesButton || button instanceof SystemButton || button instanceof PlaceButton;
            if (isFav) {
                button.actor.add_style_pseudo_class("hover");
            } else {
                button.actor.set_style_class_name(`${button.styleClass}-selected`);
                this.hoveredApp = button.actor;
            }
        }

        button.actor.add_accessible_state(Atk.StateType.FOCUSED);

        let parent = button.actor.get_parent();
        this._activeContainer = parent;
        this._activeActor = button.actor;
    }

    _buttonLeaveEvent (button) {
        if (button instanceof CategoryButton) {
            if (button.categoryId !== this.lastSelectedCategory && !this.searchActive) {
                button.actor.set_style_class_name("appmenu-category-button");
                if (button.actor.has_style_pseudo_class("hover")) {
                    button.actor.remove_style_pseudo_class("hover");
                }
            }
        } else {
            if (button instanceof FavoritesButton || button instanceof SystemButton)
                button.actor.remove_style_pseudo_class("hover");
            else
                button.actor.set_style_class_name(button.styleClass);
        }

        button.actor.remove_accessible_state(Atk.StateType.FOCUSED);

        // This method is only called on mouse leave so return key focus to the
        // currently active category button.
        this._setKeyFocusToCurrentCategoryButton();
    }

    _setKeyFocusToCurrentCategoryButton() {
        const currentSelectedCategoryActor = this.categoriesBox.get_children().find(child =>
            child._delegate.categoryId === this.lastSelectedCategory);
        if (currentSelectedCategoryActor) {
            this._activeContainer = this.categoriesBox;
            this._activeActor = currentSelectedCategoryActor;
        }
    }

     /* Category Box
     *   _____
     *  |    /|T
     *  |   / |
     *  |  /__|__________pointer Y
     *  | |\  |
     *  | | \ |
     *  |_|__\|B
     *    |
     *    |
     *    |pointer X
     */

    /*
     * The vector mask activates on any motion from a category button. At this point, all
     * category buttons are made non-reactive.
     *
     * The starting point and two corners of the category box are taken, and two angles are
     * calculated to intersect with the right box corners. If a movement is within those two
     * angles, the current position is made the last position and used on the next interval.
     *
     * In this manner the left vertex of the triangle follows the mouse and category-switching
     * is disabled as long as the pointer stays in bounds.
     *
     * If the poll interval is made too large, category switching will become sluggish. Polling
     * stops when there is no movement.
     */

    static DEBUG_VMASK = false;
    static POLL_INTERVAL = 30;
    static MIN_MOVEMENT = 2; // Movement smaller than this disables the mask.

    _getNewVectorInfo() {
        let [mx, my, mask] = global.get_pointer();
        let [bx, by] = this.categoriesScrollView.get_transformed_position();

        // The allocation is the only thing that works here - the 'height'
        // property (and natural height) are the size of the entire scrollable
        // area (the inner categoriesBox), which is weird...
        let alloc = this.categoriesScrollView.get_allocation_box();
        let bw = alloc.x2 - alloc.x1;
        let bh = alloc.y2 - alloc.y1;

        let x_dist = bx + bw - mx;
        let y_dist = my - by;

        // Calculate their angle from 3 o'clock.
        let top_angle = calc_angle(x_dist, y_dist);
        y_dist -= bh;
        let bottom_angle = calc_angle(x_dist, y_dist);

        let debug_actor = null;

        if (CinnamonMenuApplet.DEBUG_VMASK) {
            debug_actor = new St.Polygon({
                ulc_x: mx,        ulc_y: my,
                llc_x: mx,        llc_y: my,
                urc_x: bx + bw,   urc_y: by,
                lrc_x: bx + bw,   lrc_y: by + bh,
                reactive: false,
                debug: true
            });

            global.stage.add_actor(debug_actor);
        }

        return {
            start_x: mx,
            start_y: my,
            bx: bx,
            by1: by,
            by2: by + bh,
            bw: bw,
            bh: bh,
            top_angle: top_angle,
            bottom_angle: bottom_angle,
            debug_actor: debug_actor
        };
    }

    _updateVectorInfo(mx, my) {
        let bx = this.vector_mask_info.bx;
        let by = this.vector_mask_info.by1;
        let bw = this.vector_mask_info.bw;
        let bh = this.vector_mask_info.bh;

        let x_dist = bx + bw - mx;
        let y_dist = my - by;

        // Calculate their angle from 3 o'clock.
        let top_angle = calc_angle(x_dist, y_dist);
        y_dist -= bh;

        let bottom_angle = calc_angle(x_dist, y_dist);

        // Padding moves the saved x position slightly left, this makes the mask
        // more forgiving of random small movement when starting to choose an
        // app button.
        this.vector_mask_info.start_x = mx;
        this.vector_mask_info.start_y = my;
        this.vector_mask_info.top_angle = top_angle;
        this.vector_mask_info.bottom_angle = bottom_angle;

        if (CinnamonMenuApplet.DEBUG_VMASK) {
            this.vector_mask_info.debug_actor.ulc_x = mx;
            this.vector_mask_info.debug_actor.llc_x = mx;
            this.vector_mask_info.debug_actor.ulc_y = my;
            this.vector_mask_info.debug_actor.llc_y = my;
        }
    }

    _keepMaskActive() {
        let ret = false;
        let angle = 0;

        let [mx, my, mask] = global.get_pointer();

        // Check for out of range entirely.
        if (mx >= this.vector_mask_info.bx + this.vector_mask_info.bw ||
            my < this.vector_mask_info.by1 ||
            my > this.vector_mask_info.by2) {
            return false;
        }

        let x_dist = mx - this.vector_mask_info.start_x;
        let y_dist = this.vector_mask_info.start_y - my;

        if (Math.abs(Math.hypot(x_dist, y_dist)) < CinnamonMenuApplet.MIN_MOVEMENT) {
            return false;
        }

        angle = calc_angle(x_dist, y_dist);

        ret = angle <= this.vector_mask_info.top_angle &&
              angle >= this.vector_mask_info.bottom_angle;

        this._updateVectorInfo(mx, my);

        if (CinnamonMenuApplet.DEBUG_VMASK) {
            log(`${this.vector_mask_info.top_angle.toFixed()} <---${angle.toFixed()}---> ${this.vector_mask_info.bottom_angle.toFixed()} - Continue? ${ret}`);
        }

        return ret;
    }

    _enableVectorMask(actor) {
        this._disableVectorMask();

        this.vector_mask_info = this._getNewVectorInfo(actor);

        // While the mask is active, disable category buttons.
        this._setCategoryButtonsReactive(false);

        this.vector_update_loop = Mainloop.timeout_add(CinnamonMenuApplet.POLL_INTERVAL, this._maskPollTimeout.bind(this));
    }

    _maskPollTimeout() {
        if (this._keepMaskActive()) {
            return GLib.SOURCE_CONTINUE;
        }

        this._disableVectorMask();
        return GLib.SOURCE_REMOVE;
    }

    _categoryMotionEvent(actor, event) {
        // Always keep the mask engaged - motion-events on the category buttons
        // trigger this.

        if (this.vector_update_loop == 0) {
            this._enableVectorMask(actor);
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _disableVectorMask() {
        if (this.vector_update_loop > 0) {
            this._setCategoryButtonsReactive(true);
            Mainloop.source_remove(this.vector_update_loop);
            this.vector_update_loop = 0;

            if (CinnamonMenuApplet.DEBUG_VMASK) {
                this.vector_mask_info.debug_actor.destroy();
            }
        }
    }

    _setCategoryButtonsReactive(active) {
        for (let button of this._categoryButtons) {
            button.actor.reactive = active;
            button.actor.queue_redraw();
        }
    }

    _refreshSidebar() {
        //Remove all places
        this.placesBox.destroy_all_children();

        //Load places again
        this._placesButtons = [];

        let places = [...Main.placesManager.getDefaultPlaces(), ...Main.placesManager.getBookmarks()];
        for (let place of places) {
            let path = place.idDecoded.replace("bookmark:file://", "")
            switch (path) {
                case "special:home":
                    if (!this.showHome)
                        continue;
                    break;
                case "special:desktop":
                     if (!this.showDesktop)
                        continue;
                    break;
                case GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD):
                    if (!this.showDownloads)
                        continue;
                    break;
                case GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOCUMENTS):
                    if (!this.showDocuments)
                        continue;
                    break;
                case GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_MUSIC):
                    if (!this.showMusic)
                        continue;
                    break;
                case GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES):
                    if (!this.showPictures)
                        continue;
                    break;
                case GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_VIDEOS):
                    if (!this.showVideos)
                        continue;
                    break;
                default:
                    if (!this.showBookmarks)
                        continue;
                    break;
            }
            let button = new PlaceButton(this, place);
            this._placesButtons.push(button);
            this.placesBox.add(button.actor, {
                y_align: St.Align.END,
                y_fill: false
            });
        }
        this.placesBox.queue_relayout();

        // Update navigation because the presence/absence of places
        // can impact it.
        this.updateNavigation();

        // FAV APPS
        this.favoriteAppsBox.destroy_all_children();
        let showingSomeFavorites = false;
        let launchers = global.settings.get_strv('favorite-apps');
        for (let launcher of launchers) {
            let app = appsys.lookup_app(launcher);
            if (app) {
                let button = new FavoritesButton(this, app);
                showingSomeFavorites = true;
                this.favoriteAppsBox.add(button.actor, { y_align: St.Align.END, y_fill: false });
            }
        }
        this.favoriteAppsBox.queue_relayout();

        // Separator between favs and places
        if (this._placesButtons.length > 0 && showingSomeFavorites)
            this.placesSeparator.show();
        else
            this.placesSeparator.hide();
        this.sidebarScrollBox.queue_relayout();
    }

    _refreshRecent () {
        this._recentButtons.forEach(button => button.destroy());
        this._recentButtons = [];

        const index = this._categoryButtons.findIndex(button => button.categoryId === 'recent');
        if (index !== -1) {
            this._categoryButtons[index].destroy();
            this._categoryButtons.splice(index, 1);
            this.recentButton = null;
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
            recents.forEach( info => {
                let icon = info.createIcon(this.applicationIconSize);
                let button = new PathButton(this, 'recent', info.name, info.uri, icon);
                this._recentButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
                button.actor.visible = this.menu.isOpen && this.lastSelectedCategory === "recent";
            });

            let button = new SimpleMenuItem(this, { name: _("Clear list"),
                                                    description: _("Clear all recent documents"),
                                                    type: 'recent-clear',
                                                    styleClass: 'appmenu-application-button' });
            button.addIcon(22, 'edit-clear', null, true);
            button.addLabel(button.name, 'appmenu-application-button-label');
            button.label.set_style('font-weight: bold;');
            button.activate = () => {
                this.menu.close();
                (new Gtk.RecentManager()).purge_items();
            };

            this._recentButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
            button.actor.visible = this.menu.isOpen && this.lastSelectedCategory === "recent";
        } else {
            this.noRecentDocuments = true;
            let button = new SimpleMenuItem(this, { name: _("No recent documents"),
                                                    type: 'no-recent',
                                                    styleClass: 'appmenu-application-button',
                                                    reactive: false,
                                                    activatable: false });
            button.addLabel(button.name, 'appmenu-application-button-label');
            this._recentButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
            button.actor.visible = this.menu.isOpen && this.lastSelectedCategory === "recent";
        }
    }

    _refreshFavDocs() {
        this._favoriteDocButtons.forEach(button => button.destroy());
        this._favoriteDocButtons = [];

        const index = this._categoryButtons.findIndex(button => button.categoryId === 'favorite');
        if (index !== -1) {
            this._categoryButtons[index].destroy();
            this._categoryButtons.splice(index, 1);
            this.favoriteDocsButton = null;
        }

        let favorite_infos = XApp.Favorites.get_default().get_favorites(null);

        if (!this.showFavorites) {
            return;
        }

        if (!this.favoriteDocsButton) {
            this.favoriteDocsButton = new CategoryButton(this, 'favorite', _('Favorites'), 'xapp-user-favorites');
            this._categoryButtons.push(this.favoriteDocsButton);
            this.categoriesBox.add_actor(this.favoriteDocsButton.actor);
        }

        if (favorite_infos.length > 0) {
            favorite_infos.forEach( info => {
                let icon = new St.Icon({
                    gicon: Gio.content_type_get_icon(info.cached_mimetype),
                    icon_size: this.applicationIconSize
                });
                let button = new PathButton(this, 'favorite', info.display_name, info.uri, icon);
                this._favoriteDocButtons.push(button);
                this.applicationsBox.add_actor(button.actor);
                button.actor.visible = this.menu.isOpen && this.lastSelectedCategory === "favorite";
            });
        }
        else {
            let button = new SimpleMenuItem(this, { name: _("No favorite documents"),
                                                    type: 'no-favorites',
                                                    styleClass: 'appmenu-application-button',
                                                    reactive: false,
                                                    activatable: false });
            button.addLabel(button.name, 'appmenu-application-button-label');
            this._favoriteDocButtons.push(button);
            this.applicationsBox.add_actor(button.actor);
            button.actor.visible = this.menu.isOpen && this.lastSelectedCategory === "favorite";
        }
    }

    _refreshApps() {
        /* iterate in reverse, so multiple splices will not upset
         * the remaining elements */
        for (let i = this._categoryButtons.length - 1; i > -1; i--) {
            let b = this._categoryButtons[i];
            if (['recent', 'favorite'].includes(b.categoryId))
                continue;
            this._categoryButtons[i].destroy();
            this._categoryButtons.splice(i, 1);
        }

        this._applicationsButtons.forEach(button => button.destroy());
        this._applicationsButtons = [];

        const index = this._categoryButtons.findIndex(button => button.categoryId == null);
        if (index !== -1) {
            this._categoryButtons[index].destroy();
            this._categoryButtons.splice(index, 1);
            this._allAppsCategoryButton = null;
        }
        this._allAppsCategoryButton = new CategoryButton(this, null, _("All Applications"), "cinnamon-all-applications", true);
        this.categoriesBox.add_actor(this._allAppsCategoryButton.actor);
        this._categoryButtons.push(this._allAppsCategoryButton);

        // grab top level directories and all apps in them
        let [apps, dirs] = AppUtils.getApps();

        // generate all category buttons from top-level directories
        dirs.forEach( d => {
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
            button.actor.visible = this.menu.isOpen &&
                                   (this.lastSelectedCategory === button.category ||
                                   this.lastSelectedCategory == null);
        }

        // we expect this array to be in the same order as the child list
        this._applicationsButtons.reverse();
        this._appsWereRefreshed = true;
    }

    _refreshSystemButtons() {
        // Remove all system buttons
        this.systemBox.destroy_all_children();

        // Load system buttons again
        let button;

        //Lock screen
        button = new SystemButton(this, "xsi-lock-screen",
                                  _("Lock Screen"),
                                  _("Lock the screen"));
        button.actor.add_style_class_name("appmenu-system-button-lock");

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

        this.systemBox.add(button.actor, { y_align: St.Align.MIDDLE, y_fill: false });

        //Logout button
        button = new SystemButton(this, "xsi-log-out",
                                  _("Log Out"),
                                  _("Leave the session"));
        button.actor.add_style_class_name("appmenu-system-button-logout");

        button.activate = () => {
            this.menu.close();
            this._session.LogoutRemote(0);
        };

        this.systemBox.add(button.actor, { y_align: St.Align.MIDDLE, y_fill: false });

        //Shutdown button
        button = new SystemButton(this, "xsi-shutdown",
                                  _("Shut Down"),
                                  _("Shut down the computer"));
        button.actor.add_style_class_name("appmenu-system-button-shutdown");

        button.activate = () => {
            this.menu.close();
            this._session.ShutdownRemote();
        };

        this.systemBox.add(button.actor, { y_align: St.Align.MIDDLE, y_fill: false });
    }

    _scrollToButton(button, scrollBox = this.applicationsScrollView) {
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

    _layout() {
        // Position the search bar
        this.right_box.remove_all_children();
        if (this.searchPosition == "top") {
            this.right_box.add(this.searchBox, {span: 1});
            this.right_box.add(this.searchSeparator);
            this.right_box.add(this.categoriesApplicationsBox.actor, {
                expand: true,
                span: 1,
            });
            this.categoriesApplicationsBox.actor.remove_style_pseudo_class("top");
        }
        else {
            this.right_box.add(this.categoriesApplicationsBox.actor, {
                expand: true,
                span: 1,
            });
            this.categoriesApplicationsBox.actor.add_style_pseudo_class("top");
            this.right_box.add(this.searchSeparator);
            this.right_box.add(this.searchBox, {span: 1});
        }

        // Position the system box
        if (this.systemPosition == "sidebar")
            global.reparentActor(this.systemBox, this.sidebar);
        else
            global.reparentActor(this.systemBox, this.searchBox);
    }

    _buildSidebar() {
        this.sidebar = new St.BoxLayout({
            style_class: 'appmenu-sidebar',
            vertical: true
        });

        this.userBox = new St.BoxLayout({
            style_class: 'appmenu-sidebar-user-box',
            vertical: true,
            reactive: false
        });

        let user = AccountsService.UserManager.get_default().get_user(GLib.get_user_name());
        this.userIcon = new UserWidget.UserWidget(user, Clutter.Orientation.VERTICAL, false);
        this.userIcon.set_reactive(true);
        this.userIcon.track_hover = true;
        this.userIcon.set_accessible_role(Atk.Role.BUTTON);
        this.userIcon.set_accessible_name(_("Account details"));
        this.userIcon.connect('button-press-event', () => {
            this.menu.toggle();
            Util.spawnCommandLine("cinnamon-settings user");
        });

        this.userBox.add(this.userIcon);

        this.avatarSeparator = new PopupMenu.PopupSeparatorMenuItem().actor;
        this.placesSeparator = new PopupMenu.PopupSeparatorMenuItem().actor;

        this.sidebarScrollBox = new SidebarScrollBox().actor;
        this.sidebarScrollView = new St.ScrollView({
            y_align: St.Align.START,
            style_class: 'appmenu-sidebar-scrollview'
        });
        this.sidebarScrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.sidebarScrollView.add_actor(this.sidebarScrollBox);
        this.sidebarScrollView.get_vscroll_bar().hide();

        this.placesBox = new St.BoxLayout({
            vertical: true,
            y_align: Clutter.ActorAlign.START,
            style_class: 'appmenu-places-box'
        });

        this.favoriteAppsBox = new FavoriteAppsBox().actor;

        this.main_container.add(this.sidebar, { span: 1 });

        this.sidebar.add(this.userBox, {
            x_fill:  true,
            y_fill:  true,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.START
        });
        this.sidebar.add(this.avatarSeparator);
        this.sidebar.add(this.sidebarScrollView, { expand: true });
        this.sidebarScrollBox.add(this.placesBox);
        this.sidebarScrollBox.add(this.placesSeparator);
        this.sidebarScrollBox.add(this.favoriteAppsBox);
    }

    _display() {
        this._activeContainer = null;
        this._activeActor = null;
        this.actor_motion_id = 0;
        this.vector_update_loop = 0;
        let section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);

        this.main_container = new St.BoxLayout({
            vertical: false,
            style_class: 'appmenu-main-box'
        });
        this.main_container._delegate = null;
        section.addActor(this.main_container, {
            expand: true,
            span: -1,
            align: St.Align.START,
        });

        this._buildSidebar();

        this.right_box = new St.BoxLayout({ vertical: true, style_class: 'appmenu-right-box'});
        this.main_container.add(this.right_box, { expand: true });

        this.searchBox = new St.BoxLayout({
            style_class: 'appmenu-search-box',
            vertical: false,
        });
        this.searchEntry = new St.Entry({
            name: 'appmenu-search-entry',
            track_hover: true,
            can_focus: true,
            accessible_name: _("Search"),
            accessible_role: Atk.Role.ENTRY,
        });
        this.searchEntry.add_accessible_state(Atk.StateType.EDITABLE);

        this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
        this.searchActive = false;
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntryText.connect('text-changed', this._onSearchTextChanged.bind(this));
        this.searchEntryText.connect('key-press-event', this._onMenuKeyPress.bind(this));
        this._previousSearchPattern = "";

        this.categoriesApplicationsBox = new CategoriesApplicationsBox();

        this.categoriesBox = new St.BoxLayout({
            style_class: 'appmenu-categories-box',
            vertical: true,
            accessible_role: Atk.Role.LIST
        });

        this.categoriesScrollView = new St.ScrollView({ style_class: 'appmenu-categories-scrollview' });
        this.categoriesScrollView.add_actor(this.categoriesBox);
        this.categoriesScrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.categoriesScrollView.set_clip_to_allocation(true);
        this.categoriesScrollView.get_vscroll_bar().hide();

        this.categoriesApplicationsBox.actor.add(this.categoriesScrollView);

        this.applicationsBox = new St.BoxLayout({
            style_class: 'appmenu-applications-box',
            vertical:true
        });
        this.applicationsScrollView = new St.ScrollView({ style_class: 'vfade appmenu-applications-scrollview'});
        this.applicationsScrollView.add_actor(this.applicationsBox);
        this.applicationsScrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.applicationsScrollView.set_clip_to_allocation(true);

        let vscroll = this.applicationsScrollView.get_vscroll_bar();
        vscroll.connect('scroll-start', () => {
            this.menu.passEvents = true;
        });
        vscroll.connect('scroll-stop', () => {
            this.menu.passEvents = false;
        });

        let vscrollCat = this.categoriesScrollView.get_vscroll_bar();
        vscrollCat.connect('scroll-start', () => {
            this.menu.passEvents = true;
        });
        vscrollCat.connect('scroll-stop', () => {
            this.menu.passEvents = false;
        });

        this.categoriesApplicationsBox.actor.add(this.applicationsScrollView, {span: -1, expand: true});

        this.systemBox = new St.BoxLayout({
            style_class: 'appmenu-system-box',
            y_expand: false,
            x_expand: false,
            x_align: Clutter.ActorAlign.CENTER
        });

        this.searchSeparator = new PopupMenu.PopupSeparatorMenuItem().actor;

        this.searchBox.add(this.searchEntry, {
            x_align: St.Align.START,
            y_align: St.Align.MIDDLE,
            expand: true,
        });

        this._layout();

        this.appBoxIter = new VisibleChildIterator(this.applicationsBox);
        this.applicationsBox._vis_iter = this.appBoxIter;
        this.catBoxIter = new VisibleChildIterator(this.categoriesBox);
        this.categoriesBox._vis_iter = this.catBoxIter;
        this.placesBoxIter = new VisibleChildIterator(this.placesBox);
        this.placesBox._vis_iter = this.placesBoxIter;
        this.favBoxIter = new VisibleChildIterator(this.favoriteAppsBox);
        this.favoriteAppsBox._vis_iter = this.favBoxIter;
        this.sysBoxIter = new VisibleChildIterator(this.systemBox);
        this.systemBox._vis_iter = this.sysBoxIter;

        this.updateNavigation();

        Mainloop.idle_add(() => {
            this._clearAllSelections();
            this._hideAllAppActors();
        });

        this.a11y_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.a11y.applications" });
        this.a11y_settings.connect("changed::screen-magnifier-enabled", this._updateVFade.bind(this));
        this.a11y_mag_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.a11y.magnifier" });
        this.a11y_mag_settings.connect("changed::mag-factor", this._updateVFade.bind(this));
        this._updateVFade();

        this.settings.bind("enable-autoscroll", "autoscroll_enabled", this._update_autoscroll);
        this._update_autoscroll();

        this._sidebarToggle();
        this._avatarToggle();
    }

    updateNavigation() {
        this.placesBoxIter.left = this.sysBoxIter;
        this.placesBoxIter.right = this.catBoxIter;
        this.placesBoxIter.up = this.favBoxIter;
        this.placesBoxIter.down = this.favBoxIter;
        this.favBoxIter.left = this.sysBoxIter;
        this.favBoxIter.right = this.catBoxIter;
        this.favBoxIter.up = null;
        this.favBoxIter.down = null;
        this.catBoxIter.right = this.appBoxIter;
        this.catBoxIter.left = this.sysBoxIter;
        this.appBoxIter.left = this.catBoxIter;
        this.appBoxIter.right = this.sysBoxIter;
        this.sysBoxIter.left = this.appBoxIter;
        this.sysBoxIter.right = this.catBoxIter;
        if (this.showSidebar) {
            if (this._placesButtons.length > 0) {
                this.favBoxIter.up = this.placesBoxIter;
                this.favBoxIter.down = this.placesBoxIter;
                this.catBoxIter.left = this.placesBoxIter;
                this.sysBoxIter.right = this.placesBoxIter;
            }
            else {
                this.catBoxIter.left = this.favBoxIter;
                this.sysBoxIter.right = this.favBoxIter;
            }
        }
    }

    _updateVFade() {
        let mag_on = this.a11y_settings.get_boolean("screen-magnifier-enabled") &&
                     this.a11y_mag_settings.get_double("mag-factor") > 1.0;
        if (mag_on) {
            this.applicationsScrollView.style_class = "appmenu-applications-scrollbox";
        } else {
            this.applicationsScrollView.style_class = "vfade appmenu-applications-scrollbox";
        }
    }

    _update_autoscroll() {
        this.applicationsScrollView.set_auto_scrolling(this.autoscroll_enabled);
        this.categoriesScrollView.set_auto_scrolling(this.autoscroll_enabled);
        this.sidebarScrollView.set_auto_scrolling(this.autoscroll_enabled);
    }

    _hideAllAppActors() {
        this.applicationsBox.get_children().forEach(actor => {
            actor.hide();
        });
    }

    _clearAllSelections() {
        this.applicationsBox.get_children().forEach(actor => {
            actor.style_class = "appmenu-application-button";
        });
        this.categoriesBox.get_children().forEach(actor => {
            actor.remove_style_pseudo_class("hover")
            actor.style_class = "appmenu-category-button";
            actor.show();
        });
        this.placesBox.get_children().forEach(actor => {
            actor.remove_style_pseudo_class("hover");
            actor.show();
        });
        this.favoriteAppsBox.get_children().forEach(actor => {
            actor.remove_style_pseudo_class("hover");
            actor.show();
        });
        this.systemBox.get_children().forEach(actor => {
            actor.remove_style_pseudo_class("hover");
            actor.show();
        });
    }

    _resetSortOrder() {
        let pos = 0;

        for (let i = 0; i < this._applicationsButtons.length; i++) {
            this.applicationsBox.set_child_at_index(this._applicationsButtons[i].actor, pos++);
        }

        for (let i = 0; i < this._favoriteDocButtons.length; i++) {
            this.applicationsBox.set_child_at_index(this._favoriteDocButtons[i].actor, pos++);
        }

        for (let i = 0; i < this._recentButtons.length; i++) {
            this.applicationsBox.set_child_at_index(this._recentButtons[i].actor, pos++);
        }
    }

    _select_category (name = null) {
        if (name === this.lastSelectedCategory){
            return;
        }
        this.lastSelectedCategory = name;
        this._displayButtons(name || 'app');
        this.closeContextMenu(false);
        this._scrollToButton(null);
    }

    closeContextMenu(animate) {
        if (!this.contextMenu || !this.contextMenu.isOpen)
            return;

        if (animate)
            this.contextMenu.toggle();
        else
            this.contextMenu.close();
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

            this.applicationsBox.get_children().forEach( c => {
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

            this.applicationsBox.get_children().forEach( c => {
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

                return ba.name.localeCompare(bb.name);
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
            autoCompletes.forEach( item => {
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
                    button.set_style_class_name("appmenu-category-button");
                    if (icon) {
                        icon.set_opacity(255);
                    }
                } else {
                    button.set_style_class_name("appmenu-category-button-greyed");
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
        let searchActive = !(searchString == '');
        if (!this.searchActive && !searchActive)
            return;

        if (searchString == this._previousSearchPattern)
            return;
        this._previousSearchPattern = searchString;

        this.searchActive = searchActive;
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
            this._allAppsCategoryButton.actor.style_class = "appmenu-category-button-selected";
            this._activeContainer = null;
        }
    }

    _matchNames(buttons, pattern){
        let ret = [];
        let regexpPattern = new RegExp(Util.escapeRegExp(pattern));

        for (let button of buttons) {
            if (button.type == "recent-clear" || button.type == "no-recent" || button.type == "no-favorites") {
                continue;
            }
            let res = button.searchStrings[0].match(regexpPattern);
            if (res) {
                button.matchIndex = res.index;
                ret.push(button);
            } else {
                button.matchIndex = NO_MATCH;
            }
        }

        return ret;
    }

    _listApplications(pattern){
        if (!pattern)
            return [];

        let apps = [];
        let regexpPattern = new RegExp(Util.escapeRegExp(pattern));

        for (let button of this._applicationsButtons) {
            for (let i = 0; i < button.searchStrings.length; i++) {
                let res = button.searchStrings[i].match(regexpPattern);
                if (res) {
                    button.matchIndex = res.index + MATCH_ADDERS[i];
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
        let lowerPattern = AppUtils.decomp_unstripped(rawPattern);
        let pattern = AppUtils.decomp_stripped(rawPattern);

        this._searchTimeoutId = 0;
        this._activeContainer = null;
        this._activeActor = null;
        this.hoveredCategory = null;

        var acResultButtons = []; // search box autocompletion results
        var buttons = []

        buttons = this._listApplications(pattern);

        let result = this._matchNames(this._favoriteDocButtons, pattern);
        buttons = [...buttons, ...result];

        result = this._matchNames(this._recentButtons, pattern);
        buttons = [...buttons, ...result];

        this._displayButtons(null, buttons, acResultButtons);

        if (buttons.length || acResultButtons.length) {
            this.appBoxIter.reloadVisible();
            this._activeActor = this.appBoxIter.first();
            this._activeContainer = this.applicationsBox;
            this._scrollToButton(this._activeActor._delegate);
            this._buttonEnterEvent(this._activeActor._delegate);
        }

        SearchProviderManager.launch_all(lowerPattern, (provider, results) => {
            try {
                for (let result of results) {
                    if (result.type != 'software') {
                        let button = new SearchProviderResultButton(this, provider, result);
                        this._searchProviderButtons.push(button);
                        this.applicationsBox.add_actor(button.actor);
                        if (this._activeActor === null) {
                            this.appBoxIter.reloadVisible();
                            this._activeActor = this.appBoxIter.first();
                            this._activeContainer = this.applicationsBox;
                            if (this._activeActor && this._activeActor != this.searchEntry) {
                                this._buttonEnterEvent(this._activeActor._delegate);
                            }
                        }
                    }
                }
            } catch(e) {
                global.log(e);
            }
        });

        return false;
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonMenuApplet(orientation, panel_height, instance_id);
}
