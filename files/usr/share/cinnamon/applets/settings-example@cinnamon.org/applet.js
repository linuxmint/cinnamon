const Applet = imports.ui.applet;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;  // Needed for settings API
const Gio = imports.gi.Gio;
const Tweener = imports.ui.tweener;
const Main = imports.ui.main;
const SearchProviderManager = imports.ui.searchProviderManager;
const St = imports.gi.St;

function SearchProviderResultButton(appsMenuButton, provider, result) {
    this._init(appsMenuButton, provider, result);
}

SearchProviderResultButton.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(appsMenuButton, provider, result) {
        this.provider = provider;
        this.result = result;

        this.appsMenuButton = appsMenuButton;
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, {hover: false});
        this.actor.set_style_class_name('menu-application-button');

        // We need this fake app to help appEnterEvent/appLeaveEvent
        // work with our search result.
        this.app = {
            get_app_info: {
                get_filename: function() {
                    return result.id;
                }
            },
            get_id: function() {
                return -1;
            },
            get_description: function() {
                return result.description;
            },
            get_name: function() {
                return result.label;
            }
        };

        this.icon = null;
        if (result.icon){
            this.icon = result.icon;
        }else if (result.icon_app){
            this.icon = result.icon_app.create_icon_texture(16);
        }else if (result.icon_filename){
            this.icon = new St.Icon({gicon: new Gio.FileIcon({file: Gio.file_new_for_path(result.icon_filename)}), icon_size: 16});
        }

        if (this.icon){
            this.addActor(this.icon);
        }
        this.label = new St.Label({ text: result.label, style_class: 'menu-application-button-label' });
        this.addActor(this.label);
        this.isDraggableApp = false;
        if (this.icon) {
            this.icon.realize();
        }
        this.label.realize();
    },

    _onButtonReleaseEvent: function (actor, event) {
        if (event.get_button() == 1){
            this.activate(event);
        }
        return true;
    },

    activate: function(event) {
        try{
            this.provider.on_result_selected(this.result);
            this.appsMenuButton.menu.close();
        }
        catch(e)
        {
            global.logError(e);
        }
    }
}

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id); // Be sure to pass instanceId from the main function
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        this.instance_id = instance_id;

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        /* Initialize your settings handler instance      this,            the uuid              instance id  */
        this.settings = new Settings.AppletSettings(this, "settings-example@cinnamon.org", instance_id);

        /* Now we'll proceed with setting up individual setting bindings. */

        this.settings.bind("icon-name",                // The setting key, from the setting schema file
                           "icon_name",                // The property to bind the setting to - in this case it will initialize this.icon_name to the setting value
                           this.on_settings_changed,   // The method to call when this.icon_name has changed, so you can update your applet
                           null);                      // Any extra information you want to pass to the callback (optional - pass null or just leave out this last argument)

        this.settings.bind("scale-demo", "scale_val", this.on_settings_changed);
        this.settings.bind("color", "bg_color", this.on_settings_changed);
        this.settings.bind("spinner-number", "spinner_number", this.on_settings_changed);
        this.settings.bind("combo-selection", "combo_choice", this.on_settings_changed);
        this.settings.bind("use-custom-label",  "use_custom", this.on_settings_changed);
        this.settings.bind("custom-label", "custom_label", this.on_settings_changed);
        this.settings.bind("tween-function", "tween_function", this.on_settings_changed);
        this.settings.bind("keybinding-test", "keybinding", this.on_keybinding_changed);
        this.settings.bind("provider", "provider", this.on_providers_changed);
        this.on_providers_changed();

        this.settings.connect("changed::signal-test", Lang.bind(this, this.on_signal_test_fired));

        /* Lets create and add our menu items - we'll set their true values after */

        this.spinner_val_demo = new PopupMenu.PopupMenuItem("");
        this.combo_val_demo = new PopupMenu.PopupMenuItem("");
        this.slider_demo = new PopupMenu.PopupSliderMenuItem(0);
        this.slider_demo.connect("value-changed", Lang.bind(this, this.on_slider_changed));
        this.search_entry = new St.Entry();
        this.search_entry.clutter_text.connect("text-changed", Lang.bind(this, this.search));
        this.results_box = new PopupMenu.PopupMenuSection();

        this.menu.addMenuItem(this.spinner_val_demo);
        this.menu.addMenuItem(this.combo_val_demo);
        this.menu.addMenuItem(this.slider_demo);
        this.menu.addActor(this.search_entry);
        this.menu.addMenuItem(this.results_box);

        /* Let's set up our applet's initial state now that we have our setting properties defined */
        this.on_keybinding_changed();
        this.on_settings_changed();
    },

    on_keybinding_changed: function() {
        Main.keybindingManager.addHotKey("must-be-unique-id", this.keybinding, Lang.bind(this, this.on_hotkey_triggered));
    },

    on_settings_changed: function() {
        if (this.use_custom) {
            this.set_applet_label(this.custom_label)
        } else {
            this.set_applet_label(_("Hi there!"));
        }

        let icon_file = Gio.File.new_for_path(this.icon_name);
        if (icon_file.query_exists(null)) {
            this.set_applet_icon_path(this.icon_name)
        } else {
            this.set_applet_icon_name(this.icon_name)
        }

        this.spinner_val_demo.label.clutter_text.set_text("Spinner value is: " + this.spinner_number);
        this.combo_val_demo.label.clutter_text.set_text("Combo value is: " + this.combo_choice);
        this.slider_demo.setValue(this.scale_val);

        this.actor.style = "background-color:" + this.bg_color + "; width:" + this.spinner_number + "px";

    },

    on_signal_test_fired: function(setting_prov, key, oldval, newval) {
        global.logError("Test signal fired.  Old value for key "+ key + " was " + oldval + ".  New value is " + newval + ".");
    },

    on_slider_changed: function(slider, value) {
        this.scale_val = value;  // This is our BIDIRECTIONAL setting - by updating this.scale_val,
                                               // Our configuration file will also be updated
    },


/* This method is a callback that is defined by a button type in our settings file
 * This button will appear in the configuration dialog, and pressing it will call this method
 * This could useful to open a link to your web page, or just about anything you want
 */
    on_config_button_pressed: function() {
        this.set_applet_label(_("YOU PRESSED THE BUTTON!!!"));

        let timeoutId = Mainloop.timeout_add(3000, Lang.bind(this, function() {
            this.on_settings_changed();
        }));

        //animate icon
        Tweener.addTween(this._applet_icon, {
            margin_left: 10,
            time: .5,
            transition: this.tween_function,
            onComplete: function(){
                Tweener.addTween(this._applet_icon, {
                    margin_left: 0,
                    time: .5,
                    transition: this.tween_function
                });
            },
           onCompleteScope: this
        });
    },

    on_hotkey_triggered: function() {
        this.set_applet_label(_("YOU USED THE HOTKEY!!!"));

        let timeoutId = Mainloop.timeout_add(3000, Lang.bind(this, function() {
            this.on_settings_changed();
        }));
    },

    on_providers_changed: function() {
        SearchProviderManager.register(this._uuid+this.instance_id, this.provider);
    },

    search: function() {
        this.results_box.removeAll();
        SearchProviderManager.launch_from_list(this.provider, this.search_entry.text, Lang.bind(this, function(provider, results) {
            try {
                for (let i in results){
                    if (!results[i].type || results[i].type != 'software') {
                        let button = new SearchProviderResultButton(this, provider, results[i]);
                        this.results_box.addMenuItem(button);
                        // button.actor.connect('leave-event', Lang.bind(this, this._appLeaveEvent, button));
                        // this._addEnterEvent(button, Lang.bind(this, this._appEnterEvent, button));
                        // this._searchProviderButtons.push(button);
                        // this.applicationsBox.add_actor(button.actor);
                        // button.actor.realize();
                    }
                }
            } catch(e) {
                global.log(e);
            }

        }));
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },

    on_applet_removed_from_panel: function() {
        this.settings.finalize();    // This is called when a user removes the applet from the panel.. we want to
                                     // Remove any connections and file listeners here, which our settings object
                                     // has a few of
        SearchProviderManager.unregister(this._uuid+this.instance_id);
    }
};

function main(metadata, orientation, panel_height, instance_id) {  // Make sure you collect and pass on instanceId
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}

