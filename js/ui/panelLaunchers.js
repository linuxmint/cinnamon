// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;

function PanelAppLauncherMenu(launcher) {
    this._init(launcher);
}

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
        this._launcher.app.open_new_window(-1);
    },
    
    _onRemoveActivate: function(actor, event) {
        this._launcher.launchersBox.removeLauncher(this._launcher.app.get_id());
        this._launcher.actor.destroy();
    },
    
    _onAddActivate: function(actor, event) {
        this._launcher.launchersBox.showAddLauncherDialog(event.get_time());
    }
}

function PanelAppLauncher(launchersBox, app) {
    this._init(launchersBox, app);
}

PanelAppLauncher.prototype = {
    _init: function(launchersBox, app) {
        this.app = app;
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
        let icon = this.app.create_icon_texture(20);
        this._iconBox.set_child(icon);
        
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._menu = new PanelAppLauncherMenu(this);
        this._menuManager.addMenu(this._menu);
    },
    
    _onButtonRelease: function(actor, event) {
        let button = event.get_button();
        if (button==1) {
            if (this._menu.isOpen) this._menu.toggle();
            else this.app.open_new_window(-1);
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
        label.set_text(_("Description"));
        box.add(label, { x_align: St.Align.START, x_fill: true, x_expand: true });
        this._descriptionEntry = new St.Entry({ styleClass: 'add-launcher-description-entry' });
        box.add(this._descriptionEntry, { x_align: St.Align.END, x_fill: false, x_expand: false });
        
        box = new St.BoxLayout();
        this.contentLayout.add(box, { y_align: St.Align.START, x_fill: true });
        label = new St.Label();
        label.set_text(_("Command"));
        box.add(label, { x_align: St.Align.START, x_fill: true, x_expand: true });
        this._commandEntry = new St.Entry({ styleClass: 'add-launcher-command-entry' });
        box.add(this._commandEntry, { x_align: St.Align.END, x_fill: false, x_expand: false });
        
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
        this._descriptionEntry.grab_key_focus();
    },
    
    _validateAdd: function() {
    },
    
    open: function(timestamp) {
        this._commandEntry.clutter_text.set_text('');
        this._descriptionEntry.clutter_text.set_text('');

        ModalDialog.ModalDialog.prototype.open.call(this, timestamp);
    },
}

function PanelLaunchersBox() {
    this._init();
}

PanelLaunchersBox.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout({ name: 'panel-launchers-box',
                                        style_class: 'panel-launchers-box' });
        this.actor._delegate = this;
        
        this._addLauncherDialog = new AddLauncherDialog();
        
        this.reload();
    },
    
    loadApps: function() {
        let settings = new Gio.Settings({ schema: 'org.cinnamon' });
        let desktopFiles = settings.get_strv('panel-launchers');
        let appSys = Cinnamon.AppSystem.get_default();
        let apps = new Array();
        for (var i in desktopFiles){
            let app = appSys.lookup_app(desktopFiles[i]);
            if (app) apps.push(app);
        }
        return apps;
    },
    
    reload: function() {
        this.actor.destroy_children();
        
        let apps = this.loadApps();
        for (var i in apps){
            let app = apps[i];
            let launcher = new PanelAppLauncher(this, app);
            this.actor.add(launcher.actor);
        }
    },
    
    removeLauncher: function(appid) {
        let settings = new Gio.Settings({ schema: 'org.cinnamon' });
        let desktopFiles = settings.get_strv('panel-launchers');
        let i = desktopFiles.indexOf(appid);
        if (i>=0){
            desktopFiles.splice(i, 1);
            settings.set_strv('panel-launchers', desktopFiles);
        }
    },
    
    showAddLauncherDialog: function(timestamp){
        this._addLauncherDialog.open(timestamp);
    }
}
