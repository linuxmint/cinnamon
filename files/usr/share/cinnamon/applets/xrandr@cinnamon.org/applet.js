/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const Interfaces = imports.misc.interfaces;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const CinnamonDesktop = imports.gi.CinnamonDesktop;
const Lang = imports.lang;
const Applet = imports.ui.applet;
const PopupMenu = imports.ui.popupMenu;

const N_ = function(e) { return e };

const possibleRotations = [ CinnamonDesktop.RRRotation.ROTATION_0,
			    CinnamonDesktop.RRRotation.ROTATION_90,
			    CinnamonDesktop.RRRotation.ROTATION_180,
			    CinnamonDesktop.RRRotation.ROTATION_270
			  ];

let rotations = [ [ CinnamonDesktop.RRRotation.ROTATION_0, N_("Normal") ],
		  [ CinnamonDesktop.RRRotation.ROTATION_90, N_("Left") ],
		  [ CinnamonDesktop.RRRotation.ROTATION_270, N_("Right") ],
		  [ CinnamonDesktop.RRRotation.ROTATION_180, N_("Upside-down") ]
		];

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {        
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        try {        
            this.set_applet_icon_symbolic_name("preferences-desktop-display");
            this.set_applet_tooltip(_("Display"));
            
            this.menuManager = new PopupMenu.PopupMenuManager(this);
            this.menu = new Applet.AppletPopupMenu(this, orientation);
            this.menuManager.addMenu(this.menu);

            Interfaces.getDBusProxyAsync("org.cinnamon.SettingsDaemon.XRANDR_2", Lang.bind(this, function(proxy, error) {
                this._proxy = proxy;
            }));

            try {
                this._screen = new CinnamonDesktop.RRScreen({ gdk_screen: Gdk.Screen.get_default() });
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
        let config = CinnamonDesktop.RRConfig.new_current(this._screen);
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
        let item = new PopupMenu.PopupMenuItem("%s (%s)".format(output.get_display_name(), output.get_name()));
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

        if (retval.length == 0) {
            // what, no rotation?
            // what's current then?
            retval = current;
        }
        return retval;
    }    
    
};

function main(metadata, orientation, panel_height, instance_id) {  
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;      
}



