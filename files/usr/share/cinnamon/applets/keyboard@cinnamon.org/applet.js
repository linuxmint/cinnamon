const Applet = imports.ui.applet;
const Gkbd = imports.gi.Gkbd;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;

const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

function LayoutMenuItem() {
    this._init.apply(this, arguments);
}

LayoutMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(config, id, indicator, long_name) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this._config = config;
        this._id = id;
        this.label = new St.Label({ text: long_name });
        this.indicator = indicator;
        this.addActor(this.label);
        this.addActor(this.indicator);
    },

    activate: function(event) {
        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this);
        this._config.lock_group(this._id);
    }
};

function MyApplet(orientation) {
    this._init(orientation);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation) {        
        Applet.TextIconApplet.prototype._init.call(this, orientation);
        
        try {                                
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);                            

            this.actor.add_style_class_name('panel-status-button');

            this.set_applet_icon_name('keyboard');

            this._labelActors = [ ];
            this._layoutItems = [ ];

            this._showFlags = false;
            this._config = Gkbd.Configuration.get();
            this._config.connect('changed', Lang.bind(this, this._syncConfig));
            this._config.connect('group-changed', Lang.bind(this, this._syncGroup));
            this._config.start_listen();

            this._syncConfig();

            if (global.session_type == Cinnamon.SessionType.USER) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                this.menu.addAction(_("Show Keyboard Layout"), Lang.bind(this, function() {
                    Main.overview.hide();
                    Util.spawn(['gkbd-keyboard-display', '-g', String(this._config.get_current_group() + 1)]);
                }));
            }
            this.menu.addSettingsAction(_("Region and Language Settings"), 'gnome-region-panel.desktop'); 
                      
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },
    
   _adjustGroupNames: function(names) {
        // Disambiguate duplicate names with a subscript
        // This is O(N^2) to avoid sorting names
        // but N <= 4 so who cares?

        for (let i = 0; i < names.length; i++) {
            let name = names[i];
            let cnt = 0;
            for (let j = i + 1; j < names.length; j++) {
                if (names[j] == name) {
                    cnt++;
                    // U+2081 SUBSCRIPT ONE
                    names[j] = name + String.fromCharCode(0x2081 + cnt);
                }
            }
            if (cnt != 0)
                names[i] = name + '\u2081';
        }

        return names;
    },

    _syncConfig: function() {
        this._showFlags = this._config.if_flags_shown();

        let groups = this._config.get_group_names();
        if (groups.length > 1) {
            this.actor.show();
        } else {
            this.menu.close();
            this.actor.hide();
        }

        for (let i = 0; i < this._layoutItems.length; i++)
            this._layoutItems[i].destroy();

        for (let i = 0; i < this._labelActors.length; i++)
            this._labelActors[i].destroy();

        let short_names = this._adjustGroupNames(this._config.get_short_group_names());

        this._selectedLayout = null;
        this._layoutItems = [ ];
        this._labelActors = [ ];
        for (let i = 0; i < groups.length; i++) {
            let icon_name = this._config.get_group_name(i);
            let actor;
            if (this._showFlags)
                actor = new St.Icon({ icon_name: icon_name, icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
            else
                actor = new St.Label({ text: short_names[i] });
            let item = new LayoutMenuItem(this._config, i, actor, groups[i]);
            item._short_group_name = short_names[i];
            item._icon_name = icon_name;
            this._layoutItems.push(item);
            this.menu.addMenuItem(item, i);

            let shortLabel = new St.Label({ text: short_names[i] });
            this._labelActors.push(shortLabel);
        }

        this._syncGroup();
    },

    _syncGroup: function() {
        let selected = this._config.get_current_group();

        if (this._selectedLayout) {
            this._selectedLayout.setShowDot(false);
            this._selectedLayout = null;
        }

        let item = this._layoutItems[selected];
        item.setShowDot(true);

        let selectedLabel = this._labelActors[selected];

        if (this._showFlags) {
            this.set_applet_icon_symbolic_name(item._icon_name);
            this.set_applet_label("");
        } else {
            this.hide_applet_icon();
            this.set_applet_label(selectedLabel.text);
        }       

        this._selectedLayout = item;
    }    
};

function main(metadata, orientation) {  
    let myApplet = new MyApplet(orientation);
    return myApplet;      
}
