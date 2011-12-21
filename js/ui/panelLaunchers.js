// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;

function PanelAppLauncher(app) {
    this._init(app);
}

PanelAppLauncher.prototype = {
    _init: function(app) {
        this.app = app;
        this.actor = new St.Bin({ style_class: 'panel-launcher',
                                      reactive: true,
                                      can_focus: true,
                                      x_fill: true,
                                      y_fill: false,
                                      track_hover: true });
        this.actor._delegate = this;
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        
        this._iconBox = new Cinnamon.Slicer({ name: 'appMenuIcon' });
        this._iconBox.connect('style-changed',
                              Lang.bind(this, this._onIconBoxStyleChanged));
        this._iconBox.connect('notify::allocation',
                              Lang.bind(this, this._updateIconBoxClip));
        this.actor.add_actor(this._iconBox);
        this._iconBottomClip = 0;
        let icon = this.app.create_icon_texture(16);
        this._iconBox.set_child(icon);
    },
    
    _onButtonRelease: function(actor, event) {
        if ( Cinnamon.get_event_state(event) & Clutter.ModifierType.BUTTON1_MASK ) {
            this.app.open_new_window(-1);
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

function PanelLaunchersBox() {
    this._init();
}

PanelLaunchersBox.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout({ name: 'panel-launchers-box',
                                        style_class: 'panel-launchers-box' });
        this.actor._delegate = this;
        
        this.reload();
    },
    
    loadApps: function() {
        let desktopFiles = ["gnome-terminal.desktop"];
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
            let launcher = new PanelAppLauncher(app);
            this.actor.add(launcher.actor);
        }
    }
}
