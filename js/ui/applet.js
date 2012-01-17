const St = imports.gi.St;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;

function AppletContextMenu(launcher) {
    this._init(launcher);
}

AppletContextMenu.prototype = {
    __proto__: PopupMenu.PopupMenu.prototype,
    
    _init: function(launcher) {
        this._launcher = launcher;        
        PopupMenu.PopupMenu.prototype._init.call(this, launcher.actor, 0.0, Main.applet_side, 0);
        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();                    
    }    
}

function Applet() {
    this._init();
}

Applet.prototype = {

    _init: function() {
        this.actor = new St.BoxLayout({ name: 'applet-box', reactive: true });        
        this._applet_tooltip = new Tooltips.PanelItemTooltip(this, "");                                        
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));  
        
        this._menuManager = new PopupMenu.PopupMenuManager(this);
        this._applet_context_menu = new AppletContextMenu(this);
        this._menuManager.addMenu(this._applet_context_menu);                                              
    },
            
    _onButtonReleaseEvent: function (actor, event) {
        log("_onButtonReleaseEvent");
        if (event.get_button()==1){
            this.on_applet_clicked(event);
        }
        if (event.get_button()==3){            
            this._applet_context_menu.toggle();
        }
        return true;
    },
    
    set_applet_tooltip: function (text) {
        this._applet_tooltip.set_text(text);
    },
      
    on_applet_clicked: function(event) {
        // Implemented by Applets        
    }    
    
};

function IconApplet() {
    this._init();
}

IconApplet.prototype = {
    __proto__: Applet.prototype,

    _init: function() {
        Applet.prototype._init.call(this);
        this._applet_icon_box = new St.Bin();
        this.actor.add(this._applet_icon_box, { y_align: St.Align.MIDDLE, y_fill: false });                            
    },
    
    set_applet_icon_name: function (icon_name) {
        this._applet_icon = new St.Icon({icon_name: icon_name, icon_size: 22, icon_type: St.IconType.FULLCOLOR});             
        this._applet_icon_box.child = this._applet_icon;
    },
    
    set_applet_icon_path: function (icon_path) {
        let file = Gio.file_new_for_path(icon_path);
        let icon_uri = file.get_uri();
        this._applet_icon = St.TextureCache.get_default().load_uri_sync(1, icon_uri, 22, 22);
        this._applet_icon_box.child = this._applet_icon;
    },
};

function TextApplet() {
    this._init();
}

TextApplet.prototype = {
    __proto__: Applet.prototype,

    _init: function() {
        Applet.prototype._init.call(this);
        this._applet_label = new St.Label({ track_hover: true, style_class: 'applet-label'});        
        this.actor.add(this._applet_label, { y_align: St.Align.MIDDLE, y_fill: false });    
    },
    
    set_applet_label: function (text) {
        this._applet_label.set_text(text);
    }
};

function TextIconApplet() {
    this._init();
}

TextIconApplet.prototype = {
    __proto__: IconApplet.prototype,

    _init: function() {
        IconApplet.prototype._init.call(this);
        this._applet_label = new St.Label({ track_hover: true, style_class: 'applet-label'});        
        this.actor.add(this._applet_label, { y_align: St.Align.MIDDLE, y_fill: false });
    },
    
    set_applet_label: function (text) {
        this._applet_label.set_text(text);
    }    
};
