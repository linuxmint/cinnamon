const St = imports.gi.St;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;

function Applet() {
    this._init();
}

Applet.prototype = {

    _init: function() {
        this.actor = new St.BoxLayout({ name: 'applet-box' });
        this.tooltip = new Tooltips.PanelItemTooltip(this, "");
        this.context_menu = new PopupMenu.PopupSubMenu(this.actor);
        this.context_menu.actor.set_style_class_name('applet-context-menu');                                
        //this.context_menu.actor.add(new St.Label("TEST"));
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));          
    },
            
    _onButtonReleaseEvent: function (actor, event) {
        log("_onButtonReleaseEvent");
        if (event.get_button()==1){
            this.clicked(event);
        }
        if (event.get_button()==3){            
            this.context_menu.toggle();
        }
        return true;
    },
    
    set_tooltip: function (text) {
        this.tooltip.set_text(text);
    },
      
    clicked: function(event) {
        // Implemented by Applets
        log ("SUPER CLICKED");
    }    
    
};

function IconApplet() {
    this._init();
}

IconApplet.prototype = {
    __proto__: Applet.prototype,

    _init: function() {
        Applet.prototype._init.call(this);
        this.iconBox = new St.Bin();
        this.actor.add(this.iconBox, { y_align: St.Align.MIDDLE, y_fill: false });                            
    },
    
    set_icon_name: function (icon_name) {
        this.icon = new St.Icon({icon_name: icon_name, icon_size: 22, icon_type: St.IconType.FULLCOLOR});             
        this.iconBox.child = this.icon;
    },
    
    set_icon_path: function (icon_path) {
        let file = Gio.file_new_for_path(icon_path);
        let icon_uri = file.get_uri();
        this.icon = St.TextureCache.get_default().load_uri_sync(1, icon_uri, 22, 22);
        this.iconBox.child = this.icon;
    },
};

function TextApplet() {
    this._init();
}

TextApplet.prototype = {
    __proto__: Applet.prototype,

    _init: function() {
        Applet.prototype._init.call(this);
        this.label = new St.Label({ track_hover: true, style_class: 'applet-label'});        
        this.actor.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });    
    },
    
    set_label: function (text) {
        this.label.set_text(text);
    }
};

function TextIconApplet() {
    this._init();
}

TextIconApplet.prototype = {
    __proto__: IconApplet.prototype,

    _init: function() {
        IconApplet.prototype._init.call(this);
        this.label = new St.Label({ track_hover: true, style_class: 'applet-label'});        
        this.actor.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
    },
    
    set_label: function (text) {
        this.label.set_text(text);
    }    
};
