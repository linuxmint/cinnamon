const Applet = imports.ui.applet;
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
const DEFAULT_ANIM_SIZE = 13;
const ICON_HEIGHT_FACTOR = .8;
const ICON_ANIM_FACTOR = .65;

const PANEL_EDIT_MODE_KEY = 'panel-edit-mode';
const PANEL_LAUNCHERS_KEY = 'panel-launchers';
const PANEL_LAUNCHERS_DRAGGABLE_KEY = 'panel-launchers-draggable';
const PANEL_RESIZABLE_KEY = 'panel-resizable';
const PANEL_SCALE_TEXT_ICONS_KEY = 'panel-scale-text-icons';

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

        this.launchItem = new PopupMenu.PopupMenuItem(_("Launch"));
        this.addMenuItem(this.launchItem);
        this.launchItem.connect('activate', Lang.bind(this, this._onLaunchActivate));

        this.addItem = new PopupMenu.PopupMenuItem(_("Add"));
        this.addMenuItem(this.addItem);
        this.addItem.connect('activate', Lang.bind(this, this._onAddActivate));

        this.editItem = new PopupMenu.PopupMenuItem(_("Edit"));
        this.addMenuItem(this.editItem);
        this.editItem.connect('activate', Lang.bind(this, this._onEditActivate));

        this.removeItem = new PopupMenu.PopupMenuItem(_("Remove"));
        this.addMenuItem(this.removeItem);
        this.removeItem.connect('activate', Lang.bind(this, this._onRemoveActivate));
    },

    _onLaunchActivate: function(actor, event) {
        this._launcher.launch();
    },

    _onRemoveActivate: function(actor, event) {
        this._launcher.launchersBox.removeLauncher(this._launcher, this._launcher.isCustom());
        this._launcher.actor.destroy();
    },

    _onAddActivate: function(actor, event) {
        this._launcher.launchersBox.showAddLauncherDialog(event.get_time());
    },

    _onEditActivate: function(actor, event) {
        this._launcher.launchersBox.showAddLauncherDialog(event.get_time(), this._launcher);
    }
}

function PanelAppLauncher(launchersBox, app, appinfo, orientation, panel_height) {
    this._init(launchersBox, app, appinfo, orientation, panel_height);
}

PanelAppLauncher.prototype = {
    __proto__: DND.LauncherDraggable.prototype,

    _init: function(launchersBox, app, appinfo, orientation, panel_height) {
        DND.LauncherDraggable.prototype._init.call(this);
        this.app = app;
        this.appinfo = appinfo;
        this.launchersBox = launchersBox;
        this._applet = launchersBox;
        this.actor = new St.Bin({ style_class: 'panel-launcher',
                                  reactive: true,
                                  can_focus: true,
                                  x_fill: true,
                                  y_fill: false,
                                  track_hover: true });
        this.actor._delegate = this;
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));

        this._iconBox = new St.Bin({ name: 'panel-launcher-icon' });
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClip));
        this.actor.add_actor(this._iconBox);
        this._iconBottomClip = 0;

        if (global.settings.get_boolean(PANEL_SCALE_TEXT_ICONS_KEY) && global.settings.get_boolean(PANEL_RESIZABLE_KEY)) {
            this.icon_height = Math.floor((panel_height * ICON_HEIGHT_FACTOR) / global.ui_scale);
            this.icon_anim_height = Math.floor((panel_height * ICON_ANIM_FACTOR) / global.ui_scale);
        } else {
            this.icon_height = DEFAULT_ICON_SIZE;
            this.icon_anim_height = DEFAULT_ANIM_SIZE;
        }
        this.icon = this._getIconActor();
        this._iconBox.set_child(this.icon);

        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = new PanelAppLauncherMenu(this, orientation);
        this._menuManager.addMenu(this._menu);

        let tooltipText;
        if (this.isCustom()) tooltipText = appinfo.get_name();
        else tooltipText = app.get_name();
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
        if (this.isCustom()) return St.TextureCache.get_default().load_gicon(null, this.appinfo.get_icon(), this.icon_height);
        else return this.app.create_icon_texture(this.icon_height);
    },

    _animateIcon: function(step){
        if (step>=3) return;
        Tweener.addTween(this.icon,
                         { width: this.icon_anim_height * global.ui_scale,
                           height: this.icon_anim_height * global.ui_scale,
                           time: 0.2,
                           transition: 'easeOutQuad',
                           onComplete: function(){
                               Tweener.addTween(this.icon,
                                                { width: this.icon_height * global.ui_scale,
                                                  height: this.icon_height * global.ui_scale,
                                                  time: 0.2,
                                                  transition: 'easeOutQuad',
                                                  onComplete: function(){
                                                      this._animateIcon(step+1);
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
        if (this.isCustom()) return this.appinfo;
        else return this.app.get_app_info();
    },

    getCommand: function() {
        return this.getAppInfo().get_commandline();
    },

    getAppname: function() {
        return this.getAppInfo().get_name();
    },

    getIcon: function() {
        let icon = this.getAppInfo().get_icon();
        if (icon){
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
        try {
            this.orientation = orientation;
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
            this._animatingPlaceholdersCount = 0;

            this.myactor = new St.BoxLayout({ name: 'panel-launchers-box',
                                              style_class: 'panel-launchers-box' });

            this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "launcherList", "launcherList", this._onSettingsChanged, null);
            this.settings.bindProperty(Settings.BindingDirection.IN, "allow-dragging", "allowDragging", this._updateLauncherDrag, null);

            this.uuid = metadata.uuid;
            this._settings_proxy = new Array();
            this._launchers = new Array();

            this.actor.add(this.myactor);
            this.actor.reactive = global.settings.get_boolean(PANEL_EDIT_MODE_KEY);
            global.settings.connect('changed::' + PANEL_EDIT_MODE_KEY, Lang.bind(this, this._onPanelEditModeChanged));

            this.do_gsettings_import();
            this.reload();

            St.TextureCache.get_default().connect("icon-theme-changed", Lang.bind(this, this.reload));
        }
        catch (e) {
            global.logError(e);
        }
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
        let as = new Array();
        for (let i = 0; i < this._settings_proxy.length; i++) {
            as.push(this._settings_proxy[i].file);
        }
        this.launcherList = as;
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
        let id = launcher.getId();
        let proxy_member;

        for (let i = 0; i < this._settings_proxy.length; i++) {
            if (this._settings_proxy[i].file == id) {
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

    loadApps: function() {
        let desktopFiles = this.launcherList;
        let apps = new Array();
        this._settings_proxy = new Array();
        for (let i = 0; i < desktopFiles.length; i++) {
            let [app, appinfo] = this.loadSingleApp(desktopFiles[i]);
            if (app || appinfo) {
                apps.push([app, appinfo]);
                this._settings_proxy.push( { file: desktopFiles[i], valid: true } );
            } else {
                this._settings_proxy.push( { file: desktopFiles[i], valid: false } );
            }
        }
        return apps;
    },

    on_panel_height_changed: function() {
        this.reload();
    },

    reload: function() {
        this.myactor.destroy_children();
        this._launchers = new Array();

        let apps = this.loadApps();
        for (let i = 0; i < apps.length; i++){
            let app = apps[i];
            let launcher = new PanelAppLauncher(this, app[0], app[1], this.orientation, this._panelHeight);
            this.myactor.add(launcher.actor);
            this._launchers.push(launcher);
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
        this.myactor.insert_actor(this.getDummyLauncher(path), position);
        this._settings_proxy.splice(position, 0, { file: path, valid: true });
        this.sync_settings_proxy_to_settings();
    },

    moveLauncher: function(launcher, pos) {
        let origpos = this._launchers.indexOf(launcher);
        if (origpos >= 0) {
            launcher.actor.destroy();
            this.myactor.insert_actor(this.getDummyLauncher(launcher.getId()), pos);
            this._launchers.splice(origpos, 1);
            this._move_launcher_in_proxy(launcher, pos);
            this.sync_settings_proxy_to_settings();
        }
    },

    showAddLauncherDialog: function(timestamp, launcher){
        let args = this.uuid + " " + this.instance_id + " " + this.settings.get_file_path();
        if (launcher) {
            Util.spawnCommandLine("cinnamon-desktop-editor -mcinnamon-launcher -f" + launcher.getId() + " " + args);
        } else {
            Util.spawnCommandLine("cinnamon-desktop-editor -mcinnamon-launcher " + args);
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
        let boxWidth = this.myactor.width;

        if (this._dragPlaceholder) {
            boxWidth -= this._dragPlaceholder.actor.width;
            numChildren--;
        }

        let launcherPos = this._launchers.indexOf(source);

        let pos = Math.round(x * numChildren / boxWidth);

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
            this.myactor.insert_actor(this._dragPlaceholder.actor,
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
