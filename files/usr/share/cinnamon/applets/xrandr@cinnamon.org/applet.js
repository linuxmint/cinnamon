/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const DBus = imports.dbus;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const GnomeDesktop = imports.gi.GnomeDesktop;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;

const N_ = function(e) { return e };

const possibleRotations = [ GnomeDesktop.RRRotation.ROTATION_0,
			    GnomeDesktop.RRRotation.ROTATION_90,
			    GnomeDesktop.RRRotation.ROTATION_180,
			    GnomeDesktop.RRRotation.ROTATION_270
			  ];

let rotations = [ [ GnomeDesktop.RRRotation.ROTATION_0, N_("Normal") ],
		  [ GnomeDesktop.RRRotation.ROTATION_90, N_("Left") ],
		  [ GnomeDesktop.RRRotation.ROTATION_270, N_("Right") ],
		  [ GnomeDesktop.RRRotation.ROTATION_180, N_("Upside-down") ]
		];

const XRandr2Iface = {
    name: 'org.gnome.SettingsDaemon.XRANDR_2',
    methods: [
	{ name: 'ApplyConfiguration', inSignature: 'xx', outSignature: '' },
    ]
};
let XRandr2 = DBus.makeProxyClass(XRandr2Iface);

function MyApplet(orientation, panel_height) {
    this._init(orientation, panel_height);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height) {        
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height);
        
        try {        
            this.set_applet_icon_symbolic_name("preferences-desktop-display");
            this.set_applet_tooltip(_("Display"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);            
                                
            this._proxy = new XRandr2(DBus.session, 'org.gnome.SettingsDaemon', '/org/gnome/SettingsDaemon/XRANDR');

            try {
                this._screen = new GnomeDesktop.RRScreen({ gdk_screen: Gdk.Screen.get_default() });
                this._screen.init(null);
            } catch(e) {
                // an error means there is no XRandR extension
                global.logError(e);
                this.actor.hide();
                return;
            }

            this._createMenu();
            this._screen.connect('changed', Lang.bind(this, this._randrEvent));
        }
        catch (e) {
            global.logError(e);
        }
    },
    
    on_applet_clicked: function(event) {
        this.menu.toggle();        
    },
    
    _randrEvent: function() {
        this.menu.removeAll();
        this._createMenu();
    },
    
    _createMenu: function() {
        let config = GnomeDesktop.RRConfig.new_current(this._screen);
        let outputs = config.get_outputs();
        for (let i = 0; i < outputs.length; i++) {
            if (outputs[i].is_connected())
                this._addOutputItem(config, outputs[i]);
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction(_("Configure display settings..."), function() {
            GLib.spawn_command_line_async('cinnamon-settings display');
        });
    },

    _addOutputItem: function(config, output) {
        let item = new PopupMenu.PopupMenuItem(output.get_display_name());
        item.label.add_style_class_name('display-subtitle');
        item.actor.reactive = false;
        item.actor.can_focus = false;
        this.menu.addMenuItem(item);

        let allowedRotations = this._getAllowedRotations(config, output);
        let currentRotation = output.get_rotation();
        for (let i = 0; i < rotations.length; i++) {
            let [bitmask, name] = rotations[i];
            if (bitmask & allowedRotations) {
                let item = new PopupMenu.PopupMenuItem(_(name));
                if (bitmask & currentRotation)
                    item.setShowDot(true);
                item.connect('activate', Lang.bind(this, function(item, event) {
                    /* ensure config is saved so we get a backup if anything goes wrong */
                    config.save();

                    output.set_rotation(bitmask);
                    try {
                        config.save();
                        this._proxy.ApplyConfigurationRemote(0, event.get_time());
                    } catch (e) {
                        global.logError('Could not save monitor configuration', e);
                    }
                }));
                this.menu.addMenuItem(item);
            }
        }
    },

    _getAllowedRotations: function(config, output) {
        let retval = 0;

        let current = output.get_rotation();

        for (let i = 0; i < possibleRotations.length; i++) {
            output.set_rotation(possibleRotations[i]);
            if (config.applicable(this._screen)) {
                retval |= possibleRotations[i];
            }
        }

        output.set_rotation(current);

        if (retval.lenght == 0) {
            // what, no rotation?
            // what's current then?
            retval = current;
        }
        return retval;
    }    
    
};

function main(metadata, orientation, panel_height) {  
    let myApplet = new MyApplet(orientation, panel_height);
    return myApplet;      
}



