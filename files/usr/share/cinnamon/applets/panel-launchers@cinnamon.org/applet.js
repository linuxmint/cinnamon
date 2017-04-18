const Applet = imports.ui.applet;
const AppletManager = imports.ui.appletManager;

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const GLib = imports.gi.GLib;
const Tooltips = imports.ui.tooltips;
const DND = imports.ui.dnd;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const Signals = imports.signals;

const DEFAULT_ICON_SIZE = 20;
const ICON_HEIGHT_FACTOR = .8;

const PANEL_EDIT_MODE_KEY = 'panel-edit-mode';
const PANEL_LAUNCHERS_KEY = 'panel-launchers';
const PANEL_LAUNCHERS_DRAGGABLE_KEY = 'panel-launchers-draggable';

const CUSTOM_LAUNCHERS_PATH = GLib.get_home_dir() + '/.cinnamon/panel-launchers';

let pressLauncher = null;

function PanelAppLauncherMenu(launcher, orientation) {
    this._init(launcher, orientation);
}

PanelAppLauncherMenu.prototype = {
    __proto__: Applet.AppletPopupMenu.prototype,

    _init: function(launcher, orientation) {
        this._launcher = launcher;

        Applet.AppletPopupMenu.prototype._init.call(this, launcher, orientation);

        let appinfo = this._launcher.getAppInfo();

        this._actions = appinfo.list_actions();
        if (this._actions.length > 0) {
            for (let i = 0; i < this._actions.length; i++) {
                let actionName = this._actions[i];
                this.addAction(appinfo.get_action_name(actionName), Lang.bind(this, this._launchAction, actionName));
            }

            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }

        let subMenu = new PopupMenu.PopupSubMenuMenuItem(_("Options"));
        this.addMenuItem(subMenu);

        let item = new PopupMenu.PopupIconMenuItem(_("Launch"), "media-playback-start", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, this._onLaunchActivate));
        subMenu.menu.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Add"), "list-add", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, this._onAddActivate));
        subMenu.menu.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Edit"), "document-properties", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, this._onEditActivate));
        subMenu.menu.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Remove"), "window-close", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, this._onRemoveActivate));
        subMenu.menu.addMenuItem(item);

        subMenu = new PopupMenu.PopupSubMenuMenuItem(_("Preferences"));
        this.addMenuItem(subMenu);

        item = new PopupMenu.PopupIconMenuItem(_("About..."), "dialog-question", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this._launcher._applet, this._launcher._applet.openAbout));
        subMenu.menu.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Configure..."), "system-run", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this._launcher._applet, this._launcher._applet.configureApplet));
        subMenu.menu.addMenuItem(item);

        item = new PopupMenu.PopupIconMenuItem(_("Remove 'Panel launchers'"), "edit-delete", St.IconType.SYMBOLIC);
        item.connect('activate', Lang.bind(this, function() {
            AppletManager._removeAppletFromPanel(this._launcher._applet._uuid, this._launcher._applet.instance_id);
        }));
        subMenu.menu.addMenuItem(item);
    },

    _onLaunchActivate: function(item, event) {
        this._launcher.launch();
    },

    _onRemoveActivate: function(item, event) {
        this.close();
        this._launcher.launchersBox.removeLauncher(this._launcher, this._launcher.isCustom());
        this._launcher.actor.destroy();
    },

    _onAddActivate: function(item, event) {
        this._launcher.launchersBox.showAddLauncherDialog(event.get_time());
    },

    _onEditActivate: function(item, event) {
        this._launcher.launchersBox.showAddLauncherDialog(event.get_time(), this._launcher);
    },

    _launchAction: function(event, name) {
        this._launcher.launchAction(name);
    }
}

function PanelAppLauncher(launchersBox, app, appinfo, orientation, panel_height, scale) {
    this._init(launchersBox, app, appinfo, orientation, panel_height, scale);
}

PanelAppLauncher.prototype = {
    __proto__: DND.LauncherDraggable.prototype,

    _init: function(launchersBox, app, appinfo, orientation, panel_height, scale) {
        DND.LauncherDraggable.prototype._init.call(this);
        this.app = app;
        this.appinfo = appinfo;
        this.launchersBox = launchersBox;
        this._applet = launchersBox;
        this.orientation = orientation;

        this.actor = new St.Bin({ style_class: 'launcher',
                                  important: true,
                                  reactive: true,
                                  can_focus: true,
                                  x_fill: true,
                                  y_fill: true,
                                  track_hover: true });

        this.actor._delegate = this;
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));

        this._iconBox = new St.Bin({ style_class: 'icon-box',
                                     important: true });
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClip));
        this.actor.add_actor(this._iconBox);
        this._iconBottomClip = 0;

        if (scale) {
            this.icon_height = Math.floor((panel_height * ICON_HEIGHT_FACTOR) / global.ui_scale);
        } else {
            this.icon_height = DEFAULT_ICON_SIZE;
        }
        this.icon = this._getIconActor();
        this._iconBox.set_child(this.icon);

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = new PanelAppLauncherMenu(this, orientation);
        this._menuManager.addMenu(this._menu);

        let tooltipText = this.isCustom() ? appinfo.get_name() : app.get_name();
        this._tooltip = new Tooltips.PanelItemTooltip(this, tooltipText, orientation);

        this._dragging = false;
        this._draggable = DND.makeDraggable(this.actor);

        this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
        this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
        this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));

        this._draggable.inhibit = !this.launchersBox.allowDragging || global.settings.get_boolean(PANEL_EDIT_MODE_KEY);
        this.launchersBox.connect("launcher-draggable-setting-changed", Lang.bind(this, this._updateInhibit));
        global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._updateInhibit));
    },

    _onDragBegin: function() {
        this._dragging = true;
        this._tooltip.hide();
        this._tooltip.preventShow = true;
    },

    _onDragEnd: function() {
        this._dragging = false;
        this._tooltip.preventShow = false;
        this._applet._clearDragPlaceholder();
    },

    _onDragCancelled: function() {
        this._dragging = false;
        this._tooltip.preventShow = false;
    },

    _updateInhibit: function(){
        this._draggable.inhibit = !this.launchersBox.allowDragging || global.settings.get_boolean(PANEL_EDIT_MODE_KEY);
    },

    getDragActor: function() {
        return this._getIconActor();
    },

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource: function() {
        return this.icon;
    },

    _getIconActor: function() {
        if (this.isCustom()) {
            let icon = this.appinfo.get_icon();
            if (icon == null)
                icon = new Gio.ThemedIcon({name: "gnome-panel-launcher"});
            return new St.Icon({gicon: icon, icon_size: this.icon_height, icon_type: St.IconType.FULLCOLOR});
        } else {
            return this.app.create_icon_texture(this.icon_height);
        }
    },

    _animateIcon: function(step) {
        if (step >= 3) return;
        this.icon.set_pivot_point(0.5, 0.5);
        Tweener.addTween(this.icon,
                         { scale_x: 0.7,
                           scale_y: 0.7,
                           time: 0.2,
                           transition: 'easeOutQuad',
                           onComplete: function() {
                               Tweener.addTween(this.icon,
                                                { scale_x: 1.0,
                                                  scale_y: 1.0,
                                                  time: 0.2,
                                                  transition: 'easeOutQuad',
                                                  onComplete: function() {
                                                      this._animateIcon(step + 1);
                                                  },
                                                  onCompleteScope: this
                                                });
                           },
                           onCompleteScope: this
                         });
    },

    launch: function() {
        let allocation = this._iconBox.get_allocation_box();
        this._iconBox.width = allocation.x2 - allocation.x1;
        this._iconBox.height = allocation.y2 - allocation.y1;
        this._animateIcon(0);
        if (this.isCustom()) this.appinfo.launch([], null);
        else this.app.open_new_window(-1);
    },

    launchAction: function(name) {
        let allocation = this._iconBox.get_allocation_box();
        this._iconBox.width = allocation.x2 - allocation.x1;
        this._iconBox.height = allocation.y2 - allocation.y1;
        this._animateIcon(0);
        this.getAppInfo().launch_action(name, null);
    },

    getId: function() {
        if (this.isCustom()) return Gio.file_new_for_path(this.appinfo.get_filename()).get_basename();
        else return this.app.get_id();
    },

    isCustom: function() {
        return (this.app==null);
    },

    _onButtonPress: function(actor, event) {
        pressLauncher = this.getAppname();

        if (event.get_button() == 3)
            this._menu.toggle();
    },

    _onButtonRelease: function(actor, event) {
        if (pressLauncher == this.getAppname()){
            let button = event.get_button();
            if (button==1) {
                if (this._menu.isOpen) this._menu.toggle();
                else this.launch();
            }
        }
    },

    _onIconBoxStyleChanged: function() {
        let node = this._iconBox.get_theme_node();
        this._iconBottomClip = node.get_length('panel-launcher-bottom-clip');
        this._updateIconBoxClip();
    },

    _updateIconBoxClip: function() {
        let allocation = this._iconBox.allocation;
        if (this._iconBottomClip > 0)
            this._iconBox.set_clip(0, 0, allocation.x2 - allocation.x1, allocation.y2 - allocation.y1 - this._iconBottomClip);
        else
            this._iconBox.remove_clip();
    },

    getAppInfo: function() {
        return (this.isCustom() ? this.appinfo : this.app.get_app_info());
    },

    getCommand: function() {
        return this.getAppInfo().get_commandline();
    },

    getAppname: function() {
        return this.getAppInfo().get_name();
    },

    getIcon: function() {
        let icon = this.getAppInfo().get_icon();
        if (icon) {
            if (icon instanceof Gio.FileIcon) {
                return icon.get_file().get_path();
            }
            else {
                return icon.get_names().toString();
            }
        }
        return null;
    }
}

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {
        Applet.Applet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.actor.set_track_hover(false);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.orientation = orientation;
        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;

        this.myactor = new St.BoxLayout({ style_class: 'panel-launchers',
                                          important: true });

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        this.settings.bind("launcherList", "launcherList", this._onSettingsChanged);
        this.settings.bind("allow-dragging", "allowDragging", this._updateLauncherDrag);

        this.uuid = metadata.uuid;

        this._settings_proxy = new Array();
        this._launchers = new Array();

        this.actor.add(this.myactor);
        this.actor.reactive = global.settings.get_boolean(PANEL_EDIT_MODE_KEY);
        global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._onPanelEditModeChanged));

        this.do_gsettings_import();

        this.on_orientation_changed(orientation);
    },

    _updateLauncherDrag: function() {
        this.emit("launcher-draggable-setting-changed");
    },

    do_gsettings_import: function() {
        let old_launchers = global.settings.get_strv(PANEL_LAUNCHERS_KEY);
        if (old_launchers.length >= 1 && old_launchers[0] != "DEPRECATED") {
            this.launcherList = old_launchers;
        }

        global.settings.set_strv(PANEL_LAUNCHERS_KEY, ["DEPRECATED"]);
    },

    _onPanelEditModeChanged: function() {
        this.actor.reactive = global.settings.get_boolean(PANEL_EDIT_MODE_KEY);
    },

    _onSettingsChanged: function() {
        this.reload();
    },

    sync_settings_proxy_to_settings: function() {
        this.launcherList = this._settings_proxy.map(x => x.file);
    },

    _remove_launcher_from_proxy: function(visible_index) {
        let j = -1;
        for (let i = 0; i < this._settings_proxy.length; i++) {
            if (this._settings_proxy[i].valid) {
                j++;
                if (j == visible_index) {
                    this._settings_proxy.splice(i, 1);
                    break;
                }
            }
        }
    },

    _move_launcher_in_proxy: function(launcher, new_index) {
        let proxy_member;

        for (let i = 0; i < this._settings_proxy.length; i++) {
            if (this._settings_proxy[i].launcher == launcher) {
                proxy_member = this._settings_proxy.splice(i, 1)[0];
                break;
            }
        }

        if (!proxy_member)
            return;

        let j = -1;
        for (let i = 0; i < this._settings_proxy.length; i++) {
            if (this._settings_proxy[i].valid) {
                j++;
                if (j == new_index) {
                    this._settings_proxy.splice(i, 0, proxy_member);
                    return;
                }
            }
        }

        if (new_index == j + 1)
            this._settings_proxy.push(proxy_member);
    },

    loadSingleApp: function(path) {
        let appSys = Cinnamon.AppSystem.get_default();
        let app = appSys.lookup_app(path);
        let appinfo = null;
        if (!app)
            appinfo = Gio.DesktopAppInfo.new_from_filename(CUSTOM_LAUNCHERS_PATH+"/"+path);
        return [app, appinfo]
    },

    on_panel_height_changed: function() {
        this.reload();
    },

    on_orientation_changed: function(neworientation) {
        this.orientation = neworientation;
        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            this.myactor.remove_style_class_name('vertical');
            this.myactor.set_vertical(false);
            this.myactor.set_x_expand(false);
            this.myactor.set_y_expand(true);
        } else {
            this.myactor.add_style_class_name('vertical');
            this.myactor.set_vertical(true);
            this.myactor.set_x_expand(true);
            this.myactor.set_y_expand(false);
        }
        this.reload();
    },

    reload: function() {
        this.myactor.destroy_all_children();
        this._launchers = new Array();
        this._settings_proxy = new Array();

        for (let file of this.launcherList) {
            let [app, appinfo] = this.loadSingleApp(file);

            if (app || appinfo) {
                let launcher = new PanelAppLauncher(this, app, appinfo,
                        this.orientation, this._panelHeight, this._scaleMode);
                this.myactor.add(launcher.actor);
                this._launchers.push(launcher);

                this._settings_proxy.push({ file: file, valid: true, launcher: launcher });
            } else {
                this._settings_proxy.push({ file: file, valid: false });
            }
        }

    },

    removeLauncher: function(launcher, delete_file) {
        let i = this._launchers.indexOf(launcher);
        if (i >= 0) {
            launcher.actor.destroy();
            this._launchers.splice(i, 1);
            this._remove_launcher_from_proxy(i);
        }
        if (delete_file) {
            let appid = launcher.getId();
            let file = Gio.file_new_for_path(CUSTOM_LAUNCHERS_PATH+"/"+appid);
            if (file.query_exists(null)) file.delete(null);
        }

        this.sync_settings_proxy_to_settings();
    },

    getDummyLauncher: function(path) {
        let [app, appinfo] = this.loadSingleApp(path);
        let dummy;
        if (app || appinfo) {
            dummy = new PanelAppLauncher(this, app, appinfo, this.orientation, this._panelHeight);
        }

        if (dummy && dummy.actor)
            return dummy.actor;
        else
            return null;
    },

    acceptNewLauncher: function(path) {
        this.myactor.add(this.getDummyLauncher(path));
        let launchers = this.launcherList;
        launchers.push(path);
        this.launcherList = launchers;
        this.reload();
    },

    addForeignLauncher: function(path, position, source) {
        this.myactor.insert_child_at_index(this.getDummyLauncher(path), position);
        this._settings_proxy.splice(position, 0, { file: path, valid: true });
        this.sync_settings_proxy_to_settings();
    },

    moveLauncher: function(launcher, pos) {
        let origpos = this._launchers.indexOf(launcher);
        if (origpos >= 0) {
            launcher.actor.destroy();
            this.myactor.insert_child_at_index(this.getDummyLauncher(launcher.getId()), pos);
            this._launchers.splice(origpos, 1);
            this._move_launcher_in_proxy(launcher, pos);
            this.sync_settings_proxy_to_settings();
            this.reload(); // overkill really, but a way of getting the scaled size right
        }
    },

    showAddLauncherDialog: function(timestamp, launcher){
        if (launcher) {
            Util.spawnCommandLine("cinnamon-desktop-editor -mcinnamon-launcher -f" + launcher.getId() + " " + this.settings.file.get_path());
        } else {
            Util.spawnCommandLine("cinnamon-desktop-editor -mcinnamon-launcher " + this.settings.file.get_path());
        }
    },

    _clearDragPlaceholder: function() {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    },

    handleDragOver: function(source, actor, x, y, time) {
        if (!(source.isDraggableApp || (source instanceof DND.LauncherDraggable))) return DND.DragMotionResult.NO_DROP;
        let children = this.myactor.get_children();
        let numChildren = children.length;
        let boxWidth;
        let vertical = false;

        if (this.myactor.height > this.myactor.width) {  // assume oriented vertically
            vertical = true;
            boxWidth = this.myactor.height;

            if (this._dragPlaceholder) {
                boxWidth -= this._dragPlaceholder.actor.height;
                numChildren--;
            }
        } else {
            boxWidth = this.myactor.width;

            if (this._dragPlaceholder) {
                boxWidth -= this._dragPlaceholder.actor.width;
                numChildren--;
            }
        }

        let launcherPos = this._launchers.indexOf(source);
        let pos;

        if (vertical)
            pos = Math.round(y * numChildren / boxWidth);
        else
            pos = Math.round(x * numChildren / boxWidth);

        if (pos != this._dragPlaceholderPos && pos <= numChildren) {
            if (this._animatingPlaceholdersCount > 0) {
                let launchersChildren = children.filter(function(actor) {
                    return actor._delegate instanceof DND.LauncherDraggable;
                });
                this._dragPlaceholderPos = children.indexOf(launchersChildren[pos]);
            } else {
                this._dragPlaceholderPos = pos;
            }

            // Don't allow positioning before or after self
            if (launcherPos != -1 && pos == launcherPos) {
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
            this._dragPlaceholder.child.set_width (20);
            this._dragPlaceholder.child.set_height (10);
            this.myactor.insert_child_at_index(this._dragPlaceholder.actor,
                                   this._dragPlaceholderPos);
            if (fadeIn) this._dragPlaceholder.animateIn();
        }

        return DND.DragMotionResult.MOVE_DROP;
    },

    acceptDrop: function(source, actor, x, y, time) {
        if (!(source.isDraggableApp || (source instanceof DND.LauncherDraggable))) return DND.DragMotionResult.NO_DROP;

        let sourceId;
        if (source instanceof DND.LauncherDraggable) sourceId = source.getId();
        else sourceId = source.get_app_id();

        let launcherPos = 0;
        let children = this.myactor.get_children();
        for (let i = 0; i < this._dragPlaceholderPos; i++) {
            if (this._dragPlaceholder &&
                children[i] == this._dragPlaceholder.actor)
                continue;

            let childId = children[i]._delegate.getId();
            if (source === children[i]._delegate)
                continue;
            launcherPos++;
        }
        if (source instanceof DND.LauncherDraggable && source.launchersBox == this)
            this.moveLauncher(source, launcherPos);
        else {
            if (source instanceof DND.LauncherDraggable)
                source.launchersBox.removeLauncher(source, false);
            this.addForeignLauncher(sourceId, launcherPos, source);
        }
        actor.destroy();
        return true;
    }
};
Signals.addSignalMethods(MyApplet.prototype);

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;
}
