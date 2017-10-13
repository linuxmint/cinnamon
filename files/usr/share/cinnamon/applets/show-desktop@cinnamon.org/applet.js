const Applet = imports.ui.applet;
const Settings = imports.ui.settings;  // Needed for settings API
const Mainloop = imports.mainloop;
const Tweener = imports.ui.tweener;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const SignalManager = imports.misc.signalManager;

function MyApplet(orientation, panel_height, instance_id) {
    this._init(orientation, panel_height, instance_id);
}

MyApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function(orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);

        this.settings = new Settings.AppletSettings(this, "show-desktop@cinnamon.org", instance_id);

        this.settings.bindProperty(Settings.BindingDirection.IN, "peek-at-desktop", "peek_at_desktop", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "peek-delay", "peek_delay", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "peek-opacity", "peek_opacity", null, null);
        this.settings.bindProperty(Settings.BindingDirection.IN, "peek-blur", "peek_blur", null, null);

        this.signals = new SignalManager.SignalManager(null);
        this.actor.connect('enter-event', Lang.bind(this, this._on_enter));
        this.actor.connect('leave-event', Lang.bind(this, this._on_leave));
        this.signals.connect(global.stage, 'notify::key-focus', this._on_leave, this);

        this._did_peek = false;
        this._peek_timeout_id = 0;

        this.set_applet_icon_name("user-desktop");
        this.set_applet_tooltip(_("Show desktop"));
    },

    on_applet_removed_from_panel: function() {
        this.signals.disconnectAllSignals();
    },

    show_all_windows: function(time) {
        let windows = global.get_window_actors();
        for(let i = 0; i < windows.length; i++){
            let window = windows[i].meta_window;
            let compositor = windows[i];
            if(window.get_title() == "Desktop"){
                Tweener.addTween(compositor, { opacity: 255, time: time, transition: "easeOutSine" });
            }
            if (this.peek_blur && compositor.eff) {
                compositor.remove_effect(compositor.eff);
            }
        }
        Tweener.addTween(global.window_group, { opacity: 255, time: time, transition: "easeOutSine" });
    },

    _on_enter: function(event) {
        if (this.peek_at_desktop) {

            if (this._peek_timeout_id > 0) {
                Mainloop.source_remove(this._peek_timeout_id);
                this._peek_timeout_id = 0;
            }

            this._peek_timeout_id = Mainloop.timeout_add(this.peek_delay, Lang.bind(this, function() {
                if (this.actor.hover &&
                    !this._applet_context_menu.isOpen &&
                    !global.settings.get_boolean("panel-edit-mode")) {

                    Tweener.addTween(global.window_group,
                                     {opacity: this.peek_opacity, time: 0.275, transition: "easeInSine"});

                    let windows = global.get_window_actors();
                    for (let i = 0; i < windows.length; i++) {
                        let compositor = windows[i];

                        if (this.peek_blur) {
                            if (!compositor.eff)
                                compositor.eff = new Clutter.BlurEffect();
                            compositor.add_effect_with_name('peek-blur', compositor.eff);
                        }
                    }
                    this._did_peek = true;
                }
                this._peek_timeout_id = 0;
                return false;
            }));
        }
    },

    _on_leave: function(event) {
        if (this._did_peek) {
            this.show_all_windows(0.2);
            this._did_peek = false;
        }
        if (this._peek_timeout_id > 0) {
            Mainloop.source_remove(this._peek_timeout_id);
            this._peek_timeout_id = 0;
        }
    },

    on_applet_clicked: function(event) {
        global.screen.toggle_desktop(global.get_current_time());
        this.show_all_windows(0);
        if (this._peek_timeout_id > 0) {
            Mainloop.source_remove(this._peek_timeout_id);
            this._peek_timeout_id = 0;
        }
        this._did_peek = false;
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    let myApplet = new MyApplet(orientation, panel_height, instance_id);
    return myApplet;
}
