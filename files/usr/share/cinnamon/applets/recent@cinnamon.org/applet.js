const DocInfo = imports.misc.docInfo;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const Applet = imports.ui.applet;

const PRIVACY_SCHEMA = "org.cinnamon.desktop.privacy";
const REMEMBER_RECENT_KEY = "remember-recent-files";

function MyPopupMenuItem()
{
    this._init.apply(this, arguments);
}

MyPopupMenuItem.prototype =
{
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,
    _init: function(icon, text, params)
    {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);
        this.box = new St.BoxLayout({ style_class: 'popup-combobox-item' });
        this.icon = icon;
        this.box.add(this.icon);
        this.label = new St.Label({ text: text });
        this.box.add(this.label);
        this.addActor(this.box);
    }
};

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {        
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        try {        
            this.set_applet_icon_symbolic_name("document-open-recent");
            this.set_applet_tooltip(_("Recent documents"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);            
                                                                
            this.RecentManager = new DocInfo.DocManager();
            this.privacy_settings = new Gio.Settings( {schema: PRIVACY_SCHEMA} );

            this._display();

            this.RecentManager.connect('changed', Lang.bind(this, this._redisplay));
            this.privacy_settings.connect("changed::" + REMEMBER_RECENT_KEY, Lang.bind(this, this._redisplay));
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },
    
    _display: function() {
        if (!this.privacy_settings.get_boolean(REMEMBER_RECENT_KEY)) {
            let item = new PopupMenu.PopupMenuItem(_("Recent file tracking is currently disabled."));
            item.actor.reactive = false;
            this.menu.addMenuItem(item);

            let icon = new St.Icon({ icon_name: 'ok', icon_type: St.IconType.FULLCOLOR, icon_size: 16 });
            item = new MyPopupMenuItem(icon, _("Click here to enable it"), {});
            item.connect("activate", Lang.bind(this, function () {
                this.privacy_settings.set_boolean(REMEMBER_RECENT_KEY, true);
            }))
            this.menu.addMenuItem(item);

            return;
        }
        for (let id = 0; id < 15 && id < this.RecentManager._infosByTimestamp.length; id++) {
            let icon = this.RecentManager._infosByTimestamp[id].createIcon(22);
            let menuItem = new MyPopupMenuItem(icon, this.RecentManager._infosByTimestamp[id].name, {});
            this.menu.addMenuItem(menuItem);
            menuItem.connect('activate', Lang.bind(this, this._launchFile, this.RecentManager._infosByTimestamp[id]));
        }
        if (this.RecentManager._infosByTimestamp.length > 0) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let icon = new St.Icon({ icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC, icon_size: 22 });
            let menuItem = new MyPopupMenuItem(icon, _("Clear list"), {});
            this.menu.addMenuItem(menuItem);
            menuItem.connect('activate', Lang.bind(this, this._clearAll));
        } else {
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("No recent documents")));
        }
    },
    
    _redisplay: function() {
        this.menu.removeAll();
        this._display();
    },

    _launchFile: function(a, b, c, docinfo) {
        docinfo.launch();
    },
    
    _clearAll: function() {
        let GtkRecent = new Gtk.RecentManager();
        GtkRecent.purge_items();
    },
    
    destroy: function() {
        this.RecentManager.disconnectAll();
        this.actor._delegate = null;
        this.menu.destroy();
        this.actor.destroy();
        this.emit('destroy');
    }
};

function main(metadata, orientation, panel_height, instance_id) {  
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;      
}
