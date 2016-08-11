const Applet = imports.ui.applet;
const Gkbd = imports.gi.Gkbd;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const St = imports.gi.St;
const Gtk = imports.gi.Gtk;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;
const Settings = imports.ui.settings;

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

function MyApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(metadata, orientation, panel_height, instance_id) {        
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        try {
            this.metadata = metadata;
            Main.systrayManager.registerRole("keyboard", metadata.uuid);

            this.icon_theme = Gtk.IconTheme.get_default();
            this.icon_theme.append_search_path(metadata.path + "/flags");
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);                            

            this.actor.add_style_class_name('panel-status-button');            

            this._labelActors = [ ];
            this._layoutItems = [ ];

            this.settings = new Settings.AppletSettings(this, metadata["uuid"], this.instance_id);

            this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL,
                                       "use-flags",
                                       "_showFlags",
                                       this._syncConfig,
                                       null);

            this._config = Gkbd.Configuration.get();
            this._config.connect('changed', Lang.bind(this, this._syncConfig));
            this._config.connect('group-changed', Lang.bind(this, this._syncGroup));

            this._config.start_listen();

            this._syncConfig();

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
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },
//
//override getDisplayLayout to declare that this applet is suitable for both horizontal and
// vertical orientations
//
    getDisplayLayout: function() {
        return Applet.DisplayLayout.BOTH;
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

        // Short_names are the raw short language codes
        let short_names = this._config.get_short_group_names();
        // Short_labels are short_names with additional subscripts, if needed
        let short_labels = this._adjustGroupNames(this._config.get_short_group_names());

        this._selectedLayout = null;
        this._layoutItems = [ ];
        this._labelActors = [ ];
        for (let i = 0; i < groups.length; i++) {
            let icon_name = short_names[i];
            let actor;
            if (this._showFlags && this.icon_theme.lookup_icon(icon_name, 20, 0))
                actor = new St.Icon({ icon_name: icon_name, icon_type: St.IconType.FULLCOLOR, style_class: 'popup-menu-icon' });
            else
                actor = new St.Label({ text: short_labels[i] });
            
            let item = new LayoutMenuItem(this._config, i, actor, groups[i]);
            item._short_group_name = short_labels[i];
            item._icon_name = icon_name;
            item._long_name = groups[i];
            this._layoutItems.push(item);
            this.menu.addMenuItem(item, i);

            let shortLabel = new St.Label({ text: short_labels[i] });
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

        this.set_applet_tooltip(item._long_name)
        if (this._showFlags && this.icon_theme.lookup_icon(item._icon_name, 20, 0)) {
            this.set_applet_icon_name(item._icon_name);
            this.set_applet_label("");
        } else {
            this.hide_applet_icon();
            this.set_applet_label(selectedLabel.text);
        }

        this._selectedLayout = item;
    },

    on_applet_removed_from_panel: function() {
        Main.systrayManager.unregisterRole("keyboard", this.metadata.uuid);
    }
};

function main(metadata, orientation, panel_height, instance_id) {  
    let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
    return myApplet;      
}
