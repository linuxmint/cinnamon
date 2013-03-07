const Applet = imports.ui.applet;
const Lang = imports.lang;
const PopupMenu = imports.ui.popupMenu;
const Mainloop = imports.mainloop;
const Settings = imports.ui.settings;  // Needed for settings API
const Gio = imports.gi.Gio

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id); // Be sure to pass instanceId from the main function
}

MyApplet.prototype = {
    __proto__: Applet.TextIconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.TextIconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        /* Initialize your settings handler instance      this,            the uuid              instance id  */
        this.settings = new Settings.AppletSettings(this, "settings-example@cinnamon.org", instance_id);

        /* Now we'll proceed with setting up individual setting bindings. */

        this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,   // The binding direction - ONE_WAY means we only listen for changes from this applet
                                 "icon-name",                               // The setting key, from the setting schema file
                                 "icon_name",                               // The property to bind the setting to - in this case it will initialize this.icon_name to the setting value
                                 this.on_settings_changed,                  // The method to call when this.icon_name has changed, so you can update your applet
                                 null);                                     // Any extra information you want to pass to the callback (optional - pass null or just leave out this last argument)
        this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,
                                 "color",
                                 "bg_color",
                                 this.on_settings_changed,
                                 null);
        this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,
                                 "spinner-number",
                                 "spinner_number",
                                 this.on_settings_changed,
                                 null);
        this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,
                                 "combo-selection",
                                 "combo_choice",
                                 this.on_settings_changed,
                                 null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, // BIDIRECTIONAL means the applet will listen
                                 "scale-demo",                                  // for changes to the stored setting, AND the
                                 "scale_val",                                   // settings daemon will listen for changes made
                                 this.on_settings_changed,                      // to this.scale_val by the APPLET
                                 null);
        this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,
                                  "use-custom-label",
                                  "use_custom",
                                  this.on_settings_changed,
                                  null);
        this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,
                                 "custom-label",
                                 "custom_label",
                                 this.on_settings_changed,
                                 null);

        this.settings.connect("changed::signal-test", Lang.bind(this, this.on_signal_test_fired));

        /* Lets create and add our menu items - we'll set their true values after */

        this.spinner_val_demo = new PopupMenu.PopupMenuItem("");
        this.combo_val_demo = new PopupMenu.PopupMenuItem("");
        this.slider_demo = new PopupMenu.PopupSliderMenuItem(0);
        this.slider_demo.connect("value-changed", Lang.bind(this, this.on_slider_changed));

        this.menu.addMenuItem(this.spinner_val_demo);
        this.menu.addMenuItem(this.combo_val_demo);
        this.menu.addMenuItem(this.slider_demo);


        /* Let's set up our applet's initial state now that we have our setting properties defined */
        this.on_settings_changed()
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
    },

    on_applet_clicked: function(event) {
        this.menu.toggle();
    },
};

function main(metadata, orientation, panel_height, instance_id) {  // Make sure you collect and pass on instanceId
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}

