const Applet = imports.ui.applet;
const XApp = imports.gi.XApp;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;

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
        this._config.set_current_group(this._id);
    }
};

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {        
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);
        
        try {
            this.metadata = metadata;
            Main.systrayManager.registerRole("keyboard", metadata.uuid);

            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);                            

            this.actor.add_style_class_name('panel-status-button');            

            this._layoutItems = [ ];

            this.settings = new Settings.AppletSettings(this, metadata["uuid"], this.instance_id);

            this.settings.bind("use-letters", "_showLetters", this._syncConfig);
            this.settings.bind("use-uppercase", "_useUpperCase", this._syncConfig);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addAction(_("Show Keyboard Layout"), Lang.bind(this, function() {
                Main.overview.hide();
                Util.spawn(['gkbd-keyboard-display', '-g', String(this._config.get_current_group() + 1)]);
            }));                                
            this.menu.addAction(_("Show Character Table"), Lang.bind(this, function() {
                Main.overview.hide();
                Util.spawn(['gucharmap']);
            }));
            this.menu.addSettingsAction(_("Keyboard Settings"), 'keyboard');
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_added_to_panel: function() {
        this._config = new XApp.KbdLayoutController();

        this._syncConfig();

        this._config.connect('layout-changed', Lang.bind(this, this._syncGroup));
        this._config.connect('config-changed', Lang.bind(this, this._syncConfig));
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },

    _syncConfig: function() {
        for (let i = 0; i < this._layoutItems.length; i++)
            this._layoutItems[i].destroy();

        this._selectedLayout = null;
        this._layoutItems = [ ];

        if (!this._config.get_enabled()) {
            this.menu.close();
            this.actor.hide();
            return;
        }

        this.actor.show();

        let groups = this._config.get_all_names();

        for (let i = 0; i < groups.length; i++) {
            let handled = false;
            let actor = null;

            if (!this._showLetters) {
                let name = this._config.get_icon_name_for_group(i);

                if (name != null) {
                    actor = new St.Icon({ icon_name: name, icon_type: St.IconType.FULLCOLOR, style_class: 'popup-menu-icon' });
                    handled = true;
                }
            }

            if (!handled) {
                let name = this._config.get_short_name_for_group(i);
                name = this._useUpperCase ? name.toUpperCase() : name.toLowerCase();
                actor = new St.Label({ text: name })
            }

            let item = new LayoutMenuItem(this._config, i, actor, groups[i]);
            this._layoutItems.push(item);
            this.menu.addMenuItem(item, i);
        }

        Mainloop.idle_add(Lang.bind(this, this._syncGroup));
    },

    _syncGroup: function() {
        let selected = this._config.get_current_group();

        if (this._selectedLayout) {
            this._selectedLayout.setShowDot(false);
            this._selectedLayout = null;
        }

        let item = this._layoutItems[selected];
        item.setShowDot(true);

        this._selectedLayout = item;

        this.set_applet_tooltip(this._config.get_current_name());

        let handled = false;

        if (!this._showLetters) {
            let name = this._config.get_current_icon_name();

            if (name != null) {
                this.set_applet_icon_name(name);
                this.set_applet_label("");
                handled = true;
            }
        }

        if (!handled) {
            let name = this._config.get_short_name();
            name = this._useUpperCase ? name.toUpperCase() : name.toLowerCase();
            this.set_applet_label(name)
            this.hide_applet_icon()
        }
    },

    on_applet_removed_from_panel: function() {
        Main.systrayManager.unregisterRole("keyboard", this.metadata.uuid);
    }
};

function main(metadata, orientation, panel_height, instance_id) {  
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;      
}
