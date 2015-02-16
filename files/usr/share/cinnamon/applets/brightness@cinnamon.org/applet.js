const Applet = imports.ui.applet;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Interfaces = imports.misc.interfaces;

/* constants */
const DimSettingsSchema = "org.cinnamon.settings-daemon.plugins.power";
const DimSettingsAc = "idle-dim-ac";
const DimSettingsBattery = "idle-dim-battery";
const PowerBusName = 'org.cinnamon.SettingsDaemon';
const PowerObjectPath = '/org/cinnamon/SettingsDaemon/Power';

/* TextImageMenuItem taken from sound@cinnamon.org applet */
let icon_path = "/usr/share/cinnamon/theme/";

function TextImageMenuItem() {
    this._init.apply(this, arguments);
}

TextImageMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(text, icon, image, align, style) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this.actor = new St.BoxLayout({style_class: style});
        this.actor.add_style_pseudo_class('active');
        if (icon) {
            this.icon = new St.Icon({icon_name: icon});
        }
        if (image) {
            this.icon = new St.Bin();
            this.icon.set_child(this._getIconImage(image));
        }
        this.text = new St.Label({text: text});
        if (align === "left") {
            this.actor.add_actor(this.icon, { span: 0 });
            this.actor.add_actor(this.text, { span: -1 });
        }
        else {
            this.actor.add_actor(this.text, { span: 0 });
            this.actor.add_actor(this.icon, { span: -1 });
        }
    },

    setText: function(text) {
        this.text.text = text;
    },

    setIcon: function(icon) {
        this.icon.icon_name = icon;
    },

    setImage: function(image) {
        this.icon.set_child(this._getIconImage(image));
    },

    // retrieve an icon image
    _getIconImage: function(icon_name) {
         let icon_file = icon_path + icon_name + ".svg";
         let file = Gio.file_new_for_path(icon_file);
         let icon_uri = file.get_uri();
 
         return St.TextureCache.get_default().load_uri_async(icon_uri, 16, 16);
    },
}
/* end of TextImageMenuItem */

function MyApplet(orientation, panel_height, applet_id) {
    this._init(orientation, panel_height, applet_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, applet_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height);
        
        try {
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);            
            
            this.set_applet_icon_symbolic_name('display-brightness-symbolic');

            //this is exactly the same type of label as in sound@cinnamon.org, it uses the same style.
            this._brightnessTitle = new TextImageMenuItem(_("Brightness"), "display-brightness-symbolic", false, "right", "sound-volume-menu-item");
            
            this._brightnessSlider = new PopupMenu.PopupSliderMenuItem(100);
            this._brightnessSlider.connect('value-changed', Lang.bind(this, this._sliderChanged));
            
            this._settingsMenu = new PopupMenu.PopupSubMenuMenuItem(_("Dimming settings"));
            
            let dimSwitchAc = this._buildItem(_("Dim screen on AC power"), DimSettingsSchema, DimSettingsAc);
            this._settingsMenu.menu.addMenuItem(dimSwitchAc);
            let dimSwitchBattery = this._buildItem(_("Dim screen on battery"), DimSettingsSchema, DimSettingsBattery);
            this._settingsMenu.menu.addMenuItem(dimSwitchBattery);

            Interfaces.getDBusProxyAsync("org.cinnamon.SettingsDaemon.Power.Screen", Lang.bind(this, function(proxy, error) {
                this._proxy = proxy;
                this._proxy.GetPercentageRemote(Lang.bind(this, function(b, error) {
                    if (b != undefined) {
                        this._updateBrightnessLabel(b);
                        this._brightnessSlider.setValue(b / 100);
                        
                        //add menu items to menu
                        this.menu.addMenuItem(this._brightnessTitle);
                        this.menu.addMenuItem(this._brightnessSlider);
                        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                        this.menu.addMenuItem(this._settingsMenu);
                    
                        //get notified
                        this._proxy.connectSignal('Changed', Lang.bind(this, this._getBrightness));
                        this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
                    } else {
                        this.set_applet_tooltip(_("Brightness"));
                        this.menu.addMenuItem(new PopupMenu.PopupMenuItem(_("Brightness not available"), { reactive: false }));
                        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                    }
                    this.menu.addSettingsAction(_("Settings"), "power");
                }));
            }));
        }
        catch (e) {
            global.logError(e);
        }
    },

    on_applet_clicked: function(event) {
        this._getBrightnessForcedUpdate();
        this.menu.toggle();        
    },
    
    /* taken from a11y@cinnamon.org */
    _buildItem: function(string, schema, key) {
        let settings = new Gio.Settings({ schema: schema });
        let widget = this._buildItemExtended(string,
            settings.get_boolean(key),
            settings.is_writable(key),
            function(enabled) {
                return settings.set_boolean(key, enabled);
            });
        settings.connect('changed::'+key, function() {
            widget.setToggleState(settings.get_boolean(key));
        });
        return widget;
    },
    
    _buildItemExtended: function(string, initial_value, writable, on_set) {
        let widget = new PopupMenu.PopupSwitchMenuItem(string, initial_value);
        if (!writable)
            widget.actor.reactive = false;
        else
            widget.connect('toggled', function(item) {
                on_set(item.state);
            });
        return widget;
    },
    /* end taken from a11y@cinnamon.org */
    
    _onScrollEvent: function(actor, event) {
        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.UP) {
                this._proxy.StepUpRemote(Lang.bind(this, function(b) {}));
        }
        else if (direction == Clutter.ScrollDirection.DOWN) {
                this._proxy.StepDownRemote(Lang.bind(this, function(b) {}));
        }
        this._getBrightnessForcedUpdate();
    },
   
    _sliderChanged: function(slider, value) {
        this._setBrightness(Math.floor(value * 100));
    },

    _getBrightness: function() {
        //This func is called when dbus signal is received.
        //Only update slider value when menu is NOT visible to prevent slider jumping
        if (!this.menu.isOpen) {
            this._getBrightnessForcedUpdate();
		}
    },
    
    _getBrightnessForcedUpdate: function() {
            this._proxy.GetPercentageRemote(Lang.bind(this, function(b) {
            this._updateBrightnessLabel(b);
            this._brightnessSlider.setValue(b / 100);
		}));
    },

    _setBrightness: function(value) {
        this._proxy.SetPercentageRemote(value, Lang.bind(this, function(b) {
            this._updateBrightnessLabel(b);
        }));
    },

    _updateBrightnessLabel: function(value) {
        this._brightnessTitle.setText(_("Brightness") + ": " + value + "%");
        
        if (value != undefined)
            this.set_applet_tooltip(_("Brightness") + ": " + value + "%");
        else
            this.set_applet_tooltip(_("Brightness"));
    }
};

function main(metadata, orientation, panel_height, applet_id) {  
    let myApplet = new MyApplet(orientation, panel_height, applet_id);
    return myApplet;      
}

