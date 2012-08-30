const Applet = imports.ui.applet;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const Signals = imports.signals;
const GLib = imports.gi.GLib;
const Tooltips = imports.ui.tooltips;
const DND = imports.ui.dnd;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;

let pressLauncher = null;

function PanelAppLauncherMenu(launcher, orientation) {
    this._init(launcher, orientation);
}

const APPLET_DIR = imports.ui.appletManager._find_applet('panel-launchers@cinnamon.org');
const CUSTOM_LAUNCHERS_PATH = GLib.get_home_dir() + '/.cinnamon/panel-launchers';

PanelAppLauncherMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,
    
    _init: function(launcher, orientation) {
        this._launcher = launcher;        
                
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, orientation, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
        
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
        this._launcher.launchersBox.removeLauncher(this._launcher, this._launcher.is_custom());
        this._launcher.actor.destroy();
    },
    
    _onAddActivate: function(actor, event) {
        this._launcher.launchersBox.showAddLauncherDialog(event.get_time());
    },
    
    _onEditActivate: function(actor, event) {
        this._launcher.launchersBox.showAddLauncherDialog(event.get_time(), this._launcher);
    }
}

function PanelAppLauncher(launchersBox, app, appinfo, orientation) {
    this._init(launchersBox, app, appinfo, orientation);
}

PanelAppLauncher.prototype = {
    _init: function(launchersBox, app, appinfo, orientation) {
        this.app = app;
        this.appinfo = appinfo;
        this.launchersBox = launchersBox;
        this.actor = new St.Bin({ style_class: 'panel-launcher',
                                      reactive: true,
                                      can_focus: true,
                                      x_fill: true,
                                      y_fill: false,
                                      track_hover: true });
        this.actor._delegate = this;
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        
        this._iconBox = new Cinnamon.Slicer({ name: 'panel-launcher-icon' });
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClip));
        this.actor.add_actor(this._iconBox);
        this._iconBottomClip = 0;
        
        this.icon = this._getIconActor();
        this._iconBox.set_child(this.icon);
        
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = new PanelAppLauncherMenu(this, orientation);
        this._menuManager.addMenu(this._menu);
        
        let tooltipText;
        if (this.is_custom()) tooltipText = appinfo.get_name();
        else tooltipText = app.get_name();
        this._tooltip = new Tooltips.PanelItemTooltip(this, tooltipText, orientation);
        
        this._dragging = false;
        let settings = new Gio.Settings({ schema: 'org.cinnamon'});
    	if (settings.get_boolean('panel-launchers-draggable')){
    	    this._draggable = DND.makeDraggable(this.actor);
            this._draggable.connect('drag-begin', Lang.bind(this, this._onDragBegin));
            this._draggable.connect('drag-cancelled', Lang.bind(this, this._onDragCancelled));
            this._draggable.connect('drag-end', Lang.bind(this, this._onDragEnd));
    	}
    },
    
    _onDragBegin: function() {
        this._dragging = true;
        this._tooltip.hide();
        this._tooltip.preventShow = true;
    },
    
    _onDragEnd: function() {
        this._dragging = false;
        this._tooltip.preventShow = false;
    },
    
    _onDragCancelled: function() {
        this._dragging = false;
        this._tooltip.preventShow = false;
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
        if (this.is_custom()) return St.TextureCache.get_default().load_gicon(null, this.appinfo.get_icon(), 20);
        else return this.app.create_icon_texture(20);
    },
    
    _animateIcon: function(step){
        if (step>=3) return;
        Tweener.addTween(this.icon,
                         { width: 13,
                           height: 13,
                           time: 0.2,
                           transition: 'easeOutQuad',
                           onComplete: function(){
                               Tweener.addTween(this.icon,
                                                 { width: 20,
                                                   height: 20,
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
        if (this.is_custom()) this.appinfo.launch([], null);
        else this.app.open_new_window(-1);
    },
    
    get_id: function() {
        if (this.is_custom()) return Gio.file_new_for_path(this.appinfo.get_filename()).get_basename();
        else return this.app.get_id();
    },
    
    is_custom: function() {
        return (this.app==null);
    },
    
    _onButtonPress: function(actor, event) {
        pressLauncher = this.get_appname();
    },
   
    _onButtonRelease: function(actor, event) {
        if (pressLauncher == this.get_appname()){
	        let button = event.get_button();
            if (button==1) {
		        if (this._menu.isOpen) this._menu.toggle();
		        else this.launch();
            }else if (button==3) {
		        this._menu.toggle();
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
    
    get_appinfo: function() {
        if (this.is_custom()) return this.appinfo;
        else return this.app.get_app_info();
    },
    
    get_command: function() {
        return this.get_appinfo().get_commandline();
    },
    
    get_appname: function() {
        return this.get_appinfo().get_name();
    },
    
    get_icon: function() {
        let icon = this.get_appinfo().get_icon();
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

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.Applet.prototype,

    _init: function(orientation) {        
        Applet.Applet.prototype._init.call(this, orientation);
        
        try {                    
            this.orientation = orientation;
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
            this._animatingPlaceholdersCount = 0;
                                    
            this.myactor = new St.BoxLayout({ name: 'panel-launchers-box',
                                            style_class: 'panel-launchers-box' });           
            
            this._settings = new Gio.Settings({ schema: 'org.cinnamon' });
            this._settings.connect('changed::panel-launchers', Lang.bind(this, this._onSettingsChanged));

            this._launchers = new Array();
            
            this.reload();
            
            this.actor.add(this.myactor);  
            this.actor.reactive = global.settings.get_boolean("panel-edit-mode");            
            global.settings.connect('changed::panel-edit-mode', Lang.bind(this, this.on_panel_edit_mode_changed)); 
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        
    },
    
    on_panel_edit_mode_changed: function() {
        this.actor.reactive = global.settings.get_boolean("panel-edit-mode");
    }, 
    
    _onSettingsChanged: function() {
        this.reload();
    },
    
    loadApps: function() {
        let desktopFiles = this._settings.get_strv('panel-launchers');
        let appSys = Cinnamon.AppSystem.get_default();
        let apps = new Array();
        for (var i in desktopFiles){
            let app = appSys.lookup_app(desktopFiles[i]);
            if (!app) app = appSys.lookup_settings_app(desktopFiles[i]);
            let appinfo;
            if (!app) appinfo = Gio.DesktopAppInfo.new_from_filename(CUSTOM_LAUNCHERS_PATH+"/"+desktopFiles[i]);
            if (app || appinfo) apps.push([app, appinfo]);
        }
        return apps;
    },
    
    reload: function() {
        this.myactor.destroy_children();
        this._launchers = new Array();
        
        let apps = this.loadApps();
        for (var i in apps){
            let app = apps[i];
            let launcher = new PanelAppLauncher(this, app[0], app[1], this.orientation);
            this.myactor.add(launcher.actor);
            this._launchers.push(launcher);
        }
    },
    
    removeLauncher: function(launcher, delete_file) {
        let desktopFiles = this._settings.get_strv('panel-launchers');
        let i = this._launchers.indexOf(launcher);
        if (i>=0){
            this._launchers.splice(i, 1);
            desktopFiles.splice(i, 1);
            this._settings.set_strv('panel-launchers', desktopFiles);
        }
        if (delete_file){
            let appid = launcher.get_id();
            let file = new Gio.file_new_for_path(CUSTOM_LAUNCHERS_PATH+"/"+appid);
            if (file.query_exists(null)) file.delete(null);
        }
    },
    
    moveLauncher: function(launcher, pos) {
        let desktopFiles = this._settings.get_strv('panel-launchers');
        let origpos = this._launchers.indexOf(launcher);
        if (origpos>=0){
            this._launchers.splice(origpos, 1);
            desktopFiles.splice(origpos, 1);
            desktopFiles.splice(pos, 0, launcher.get_id());
            this._settings.set_strv('panel-launchers', desktopFiles);
        }
    },
    
    showAddLauncherDialog: function(timestamp, launcher){
        if (launcher) {
            let cl = APPLET_DIR.get_child('add-panel-launcher.py').get_path() + ' ';
            cl += '"' + launcher.get_id() + '" ';
            cl += '"' + launcher.get_appname() + '" ';
            cl += '"' + launcher.get_command() + '" ';
            cl += '"' + launcher.get_icon() + '"';
            Util.spawnCommandLine(cl);
        } else {
            Util.spawnCommandLine(APPLET_DIR.get_child('add-panel-launcher.py').get_path());
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
        if (!(source.isDraggableApp || (source instanceof PanelAppLauncher))) return DND.DragMotionResult.NO_DROP;
        
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
                    return actor._delegate instanceof PanelAppLauncher;
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
            if (fadeIn)
                this._dragPlaceholder.animateIn();
        }
        
        return DND.DragMotionResult.MOVE_DROP;
    },
    
    acceptDrop: function(source, actor, x, y, time) {
        if (!(source.isDraggableApp || (source instanceof PanelAppLauncher))) return DND.DragMotionResult.NO_DROP;
        
        let sourceId;
        if (source instanceof PanelAppLauncher) sourceId = source.get_id();
        else sourceId = source.get_app_id();
        
        let launcherPos = 0;
        let children = this.myactor.get_children();
        for (let i = 0; i < this._dragPlaceholderPos; i++) {
            if (this._dragPlaceholder &&
                children[i] == this._dragPlaceholder.actor)
                continue;

            let childId = children[i]._delegate.get_id();
            if (childId == sourceId)
                continue;
            launcherPos++;
        }
        if (source instanceof PanelAppLauncher) this.moveLauncher(source, launcherPos);
        else{
            let desktopFiles = this._settings.get_strv('panel-launchers');
            desktopFiles.splice(launcherPos, 0, sourceId);
            this._settings.set_strv('panel-launchers', desktopFiles);
        }
        this._clearDragPlaceholder();
        actor.destroy();
        return true;
    }
    
     
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
