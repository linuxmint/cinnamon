// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

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

function PanelAppLauncherMenu(launcher) {
    this._init(launcher);
}

const CUSTOM_LAUNCHERS_PATH = GLib.get_home_dir() + '/.cinnamon/panel-launchers';

PanelAppLauncherMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,
    
    _init: function(launcher) {
        this._launcher = launcher;
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, St.Side.BOTTOM, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
        
        this.launchItem = new PopupMenu.PopupMenuItem(_('Launch'));
        this.addMenuItem(this.launchItem);
        this.launchItem.connect('activate', Lang.bind(this, this._onLaunchActivate));
        
        this.addItem = new PopupMenu.PopupMenuItem(_('Add'));
        this.addMenuItem(this.addItem);
        this.addItem.connect('activate', Lang.bind(this, this._onAddActivate));
        
        this.removeItem = new PopupMenu.PopupMenuItem(_('Remove'));
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
    }
}

function PanelAppLauncher(launchersBox, app, appinfo) {
    this._init(launchersBox, app, appinfo);
}

PanelAppLauncher.prototype = {
    _init: function(launchersBox, app, appinfo) {
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
        
        this._iconBox = new Cinnamon.Slicer({ name: 'panel-launcher-icon' });
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClip));
        this.actor.add_actor(this._iconBox);
        this._iconBottomClip = 0;
        let icon;
        if (this.is_custom()) icon = new St.Icon({ gicon: appinfo.get_icon(), icon_size: 20 });
        else icon = this.app.create_icon_texture(20);
        
        this._iconBox.set_child(icon);
        
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = new PanelAppLauncherMenu(this);
        this._menuManager.addMenu(this._menu);
        
        let tooltipText;
        if (this.is_custom()) tooltipText = appinfo.get_name();
        else tooltipText = app.get_name();
        this._tooltip = new Tooltips.PanelItemTooltip(this, tooltipText);
    },
    
    launch: function() {
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
    
    _onButtonRelease: function(actor, event) {
        let button = event.get_button();
        if (button==1) {
            if (this._menu.isOpen) this._menu.toggle();
            else this.launch();
        }else if (button==3) {
            this._menu.toggle();
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
}

function AddLauncherDialog() {
    this._init();
}

AddLauncherDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,
    
    _init: function() {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'add-launcher-dialog' });
        
        let box;
        let label;
        
        box = new St.BoxLayout();
        this.contentLayout.add(box, { y_align: St.Align.START });
        label = new St.Label();
        label.set_text(_("Name"));
        box.add(label, { x_align: St.Align.START, x_fill: true, x_expand: true });
        this._nameEntry = new St.Entry({ styleClass: 'add-launcher-name-entry' });
        box.add(this._nameEntry, { x_align: St.Align.END, x_fill: false, x_expand: false });
        
        box = new St.BoxLayout();
        this.contentLayout.add(box, { y_align: St.Align.START, x_fill: true });
        label = new St.Label();
        label.set_text(_("Command"));
        box.add(label, { x_align: St.Align.START, x_fill: true, x_expand: true });
        this._commandEntry = new St.Entry({ styleClass: 'add-launcher-command-entry' });
        box.add(this._commandEntry, { x_align: St.Align.END, x_fill: false, x_expand: false });
        
        this._errorBox = new St.BoxLayout({ style_class: 'run-dialog-error-box' });
        this.contentLayout.add(this._errorBox, { expand: true });

        let errorIcon = new St.Icon({ icon_name: 'dialog-error', icon_size: 24, style_class: 'run-dialog-error-icon' });

        this._errorBox.add(errorIcon, { y_align: St.Align.MIDDLE });

        this._commandError = false;

        this._errorMessage = new St.Label({ style_class: 'run-dialog-error-label' });
        this._errorMessage.clutter_text.line_wrap = true;

        this._errorBox.add(this._errorMessage, { expand: true,
                                                 y_align: St.Align.MIDDLE,
                                                 y_fill: false });

        this._errorBox.hide();
        
        this.setButtons([
            {
                label: _("Add"),
                action: Lang.bind(this, this._validateAdd)
            },
            {
                label: _("Cancel"),
                key: Clutter.KEY_Escape,
                action: Lang.bind(this, function(){
                    this.close();
                })
            }
        ]);
        
        this.connect('opened', Lang.bind(this, this._onOpened));
    },
    
    _onOpened: function() {
        this._nameEntry.grab_key_focus();
    },
    
    _validateAdd: function() {
        if (this._nameEntry.clutter_text.get_text()==""){
            this._errorMessage.clutter_text.set_text(_('Name cannot be empty !'));
            this._errorBox.show();
            return false;
        }
        if (this._commandEntry.clutter_text.get_text()==""){
            this._errorMessage.clutter_text.set_text(_('Command cannot be empty !'));
            this._errorBox.show();
            return false;
        }
        
        let appid = this._saveNewLauncher(this._nameEntry.clutter_text.get_text(), this._commandEntry.clutter_text.get_text());
        this.close();
        this.emit("launcher-created", appid);
    },
    
    _saveNewLauncher: function(name, command, description, icon){
        let dir = Gio.file_new_for_path(CUSTOM_LAUNCHERS_PATH);
        if (!dir.query_exists(null)) dir.make_directory_with_parents(null);
        let desktopEntry = "[Desktop Entry]\nName="+name+"\nExec="+command+"\nType=Application\n";
        if (description) desktopEntry += "Description="+description+"\n";
        if (icon) desktopEntry += "Icon="+icon+"\n";
        
        let i = 1;
        let file = Gio.file_parse_name(CUSTOM_LAUNCHERS_PATH+'/cinnamon-custom-launcher-'+i+'.desktop');
        while (file.query_exists(null)){
            i++;
            file = Gio.file_parse_name(CUSTOM_LAUNCHERS_PATH+'/cinnamon-custom-launcher-'+i+'.desktop');
        }
        let fp = file.create(0, null);
        fp.write(desktopEntry, null);
        fp.close(null);
        return 'cinnamon-custom-launcher-'+i+'.desktop';
    },
    
    open: function(timestamp) {
        this._commandEntry.clutter_text.set_text('');
        this._nameEntry.clutter_text.set_text('');
        this._errorBox.hide();

        ModalDialog.ModalDialog.prototype.open.call(this, timestamp);
    },
}
Signals.addSignalMethods(AddLauncherDialog.prototype);

function PanelLaunchersBox() {
    this._init();
}

PanelLaunchersBox.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout({ name: 'panel-launchers-box',
                                        style_class: 'panel-launchers-box' });
        this.actor._delegate = this;
        
        this._settings = new Gio.Settings({ schema: 'org.cinnamon' });
        this._settings.connect('changed', Lang.bind(this, this._onSettingsChanged));
        
        this._addLauncherDialog = new AddLauncherDialog();
        this._addLauncherDialog.connect("launcher-created", Lang.bind(this, this._onLauncherCreated));
        
        this._launchers = new Array();
        
        this.reload();
    },
    
    _onSettingsChanged: function() {
        this.reload();
    },
    
    _onLauncherCreated: function(obj, appid){
        if (appid){
            let desktopFiles = this._settings.get_strv('panel-launchers');
            desktopFiles.push(appid);
            this._settings.set_strv('panel-launchers', desktopFiles);
            this.reload();
        }
    },
    
    loadApps: function() {
        let desktopFiles = this._settings.get_strv('panel-launchers');
        let appSys = Cinnamon.AppSystem.get_default();
        let apps = new Array();
        for (var i in desktopFiles){
            let app = appSys.lookup_app(desktopFiles[i]);
            let appinfo;
            if (!app) appinfo = Gio.DesktopAppInfo.new_from_filename(CUSTOM_LAUNCHERS_PATH+"/"+desktopFiles[i]);
            if (app || appinfo) apps.push([app, appinfo]);
        }
        return apps;
    },
    
    reload: function() {
        this.actor.destroy_children();
        this._launchers = new Array();
        
        let apps = this.loadApps();
        for (var i in apps){
            let app = apps[i];
            let launcher = new PanelAppLauncher(this, app[0], app[1]);
            this.actor.add(launcher.actor);
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
    
    showAddLauncherDialog: function(timestamp){
        this._addLauncherDialog.open(timestamp);
    }
}
