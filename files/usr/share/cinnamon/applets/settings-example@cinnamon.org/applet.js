// Use destructuring assignment for imports, this reduces inefficient property access.
const {TextIconApplet, AppletPopupMenu} = imports.ui.applet;
const {PopupMenuManager, PopupMenuItem, PopupSliderMenuItem} = imports.ui.popupMenu;
const {AppletSettings} = imports.ui.settings;  // Needed for settings API
const {File} = imports.gi.Gio;
const {addTween} = imports.ui.tweener;
const {keybindingManager} = imports.ui.main;

class CinnamonSettingsExampleApplet extends TextIconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.menuManager = new PopupMenuManager(this);
        this.menu = new AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        // Passing a separate state object to the settings constructor will prevent circular references,
        // which results in better memory management and CPU usage by the JS engine.
        this.state = {};

        /* Initialize your settings handler instance */
        let settings = new AppletSettings(
            this.state, // State object
            'settings-example@cinnamon.org', // UUID
            instance_id, // Instance ID
            true // Async enabled
        );
        settings.promise.then(() => {
            /* Now we'll proceed with setting up individual setting bindings. */

            settings.bind(
                'icon-name', // The setting key, from the setting schema file
                'icon_name', // The property to bind the setting to - in this case it will initialize this.state.icon_name to the setting value
                this.on_settings_changed.bind(this), // The method to call when this.state.icon_name has changed, so you can update your applet
                null  // Any extra information you want to pass to the callback (optional - pass null or just leave out this last argument)
            );

            settings.bind('scale-demo', 'scale_val', (...args) => this.on_settings_changed(...args));
            settings.bind('color', 'bg_color', (...args) => this.on_settings_changed);
            settings.bind('spinner-number', 'spinner_number', (...args) => this.on_settings_changed(...args));
            settings.bind('combo-selection', 'combo_choice', (...args) => this.on_settings_changed(...args));
            settings.bind('use-custom-label',  'use_custom', (...args) => this.on_settings_changed(...args));
            settings.bind('custom-label', 'custom_label', (...args) => this.on_settings_changed(...args));
            settings.bind('tween-function', 'tween_function', (...args) => this.on_settings_changed(...args));
            settings.bind('keybinding-test', 'keybinding', (...args) => this.on_keybinding_changed(...args));

            settings.connect('changed::signal-test', (...args) => this.on_signal_test_fired(...args));

            /* Lets create and add our menu items - we'll set their true values after */
            this.sliderValDemo = new PopupMenuItem('');
            this.spinner_val_demo = new PopupMenuItem('');
            this.combo_val_demo = new PopupMenuItem('');
            this.slider_demo = new PopupSliderMenuItem(0);
            this.slider_demo.connect('value-changed', (...args) => this.on_slider_changed(...args));

            this.menu.addMenuItem(this.sliderValDemo);
            this.menu.addMenuItem(this.spinner_val_demo);
            this.menu.addMenuItem(this.combo_val_demo);
            this.menu.addMenuItem(this.slider_demo);


            /* Let's set up our applet's initial state now that we have our setting properties defined */
            this.on_keybinding_changed();
            this.on_settings_changed();
            this.settings = settings;
        });
    }

    on_keybinding_changed() {
        keybindingManager.addHotKey('must-be-unique-id', this.state.keybinding, () => this.on_hotkey_triggered());
    }

    on_settings_changed() {
        if (this.state.use_custom) {
            this.set_applet_label(this.state.custom_label);
        } else {
            this.set_applet_label(_('Hi there!'));
        }

        let icon_file = File.new_for_path(this.state.icon_name);
        if (icon_file.query_exists(null)) {
            this.set_applet_icon_path(this.state.icon_name);
        } else {
            this.set_applet_icon_name(this.state.icon_name);
        }

        this.sliderValDemo.label.clutter_text.set_text('Slider value is: ' + this.state.scale_val);
        this.spinner_val_demo.label.clutter_text.set_text('Spinner value is: ' + this.state.spinner_number);
        this.combo_val_demo.label.clutter_text.set_text('Combo value is: ' + this.state.combo_choice);
        this.slider_demo.setValue(this.state.scale_val);

        this.actor.style = 'background-color:' + this.state.bg_color + '; width:' + this.state.spinner_number + 'px';

    }

    on_signal_test_fired(setting_prov, key, oldval, newval) {
        global.logError('Test signal fired.  Old value for key '+ key + ' was ' + oldval + '.  New value is ' + newval + '.');
    }

    on_slider_changed(slider, value) {
        this.state.scale_val = value;  // This is our BIDIRECTIONAL setting - by updating this.state.scale_val,
                                       // Our configuration file will also be updated
        this.settings.setValue('scale-demo', value); // Update the slider value being set through the panel widget
        this.on_settings_changed(); // setValue doesn't cause the value-changed signal to be emitted
    }


/* This method is a callback that is defined by a button type in our settings file
 * This button will appear in the configuration dialog, and pressing it will call this method
 * This could useful to open a link to your web page, or just about anything you want
 */
    on_config_button_pressed() {
        this.set_applet_label(_('YOU PRESSED THE BUTTON!!!'));

        setTimeout(() => this.on_settings_changed(), 3000);

        //animate icon
        addTween(this._applet_icon, {
            margin_left: 10,
            time: 0.5,
            transition: this.state.tween_function,
            onComplete() {
                addTween(this._applet_icon, {
                    margin_left: 0,
                    time: 0.5,
                    transition: this.state.tween_function
                });
            },
            onCompleteScope: this
        });
    }

    on_hotkey_triggered() {
        this.set_applet_label(_('YOU USED THE HOTKEY!!!'));

        setTimeout(() => this.on_settings_changed(), 3000);
    }

    on_applet_clicked(event) {
        this.menu.toggle();
    }

    on_applet_removed_from_panel() {
        this.settings.finalize();    // This is called when a user removes the applet from the panel.. we want to
                                     // Remove any connections and file listeners here, which our settings object
                                     // has a few of
    }
}

function main(metadata, orientation, panel_height, instance_id) {  // Make sure you collect and pass on instanceId
    return new CinnamonSettingsExampleApplet(orientation, panel_height, instance_id);
}

