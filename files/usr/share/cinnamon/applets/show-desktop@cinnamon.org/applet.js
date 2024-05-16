const Applet = imports.ui.applet;
const { AppletSettings } = imports.ui.settings;  // Needed for settings API
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Meta = imports.gi.Meta;
const Lang = imports.lang;
const SignalManager = imports.misc.signalManager;

const PEEK_TRANSPARENCY_FILTER_TYPES = [
    Meta.WindowType.DESKTOP,
    Meta.WindowType.DOCK,
];

class CinnamonShowDesktopApplet extends Applet.IconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.settings = new AppletSettings(this, "show-desktop@cinnamon.org", instance_id);

        this.settings.bind("peek-at-desktop", "peek_at_desktop");
        this.settings.bind("peek-delay", "peek_delay");
        this.settings.bind("peek-opacity", "peek_opacity");
        this.settings.bind("peek-blur", "peek_blur");

        this.signals = new SignalManager.SignalManager(null);
        this.actor.connect('enter-event', Lang.bind(this, this._on_enter));
        this.actor.connect('leave-event', Lang.bind(this, this._on_leave));
        this.signals.connect(global.stage, 'notify::key-focus', this._on_leave, this);

        this._did_peek = false;
        this._peek_timeout_id = 0;

        this.set_applet_icon_name("user-desktop");
        this.set_applet_tooltip(_("Click to show the desktop or middle-click to show the desklets"));

        let showDeskletsOption = new PopupMenu.PopupIconMenuItem(
            _('Show Desklets'),
            'cs-desklets',
            St.IconType.SYMBOLIC
        );
        showDeskletsOption.connect('activate', () => this.toggleShowDesklets());
        this._applet_context_menu.addMenuItem(showDeskletsOption);
    }

    on_applet_removed_from_panel() {
        this.signals.disconnectAllSignals();
    }

    show_all_windows(time) {
        let windows = global.get_window_actors();
        for(let i = 0; i < windows.length; i++){
            let window = windows[i].meta_window;
            let compositor = windows[i];

            compositor.ease(
                {
                    opacity: 255,
                    transition: Clutter.AnimationMode.EASE_OUT_SINE,
                    duration: time,
                }
            );

            if (this.peek_blur && compositor.eff) {
                compositor.remove_effect(compositor.eff);
            }
        }
    }

    _on_enter(event) {
        if (this.peek_at_desktop) {

            if (this._peek_timeout_id > 0) {
                Mainloop.source_remove(this._peek_timeout_id);
                this._peek_timeout_id = 0;
            }

            this._peek_timeout_id = Mainloop.timeout_add(this.peek_delay, Lang.bind(this, function() {
                if (this.actor.hover &&
                    !this._applet_context_menu.isOpen &&
                    !global.settings.get_boolean("panel-edit-mode")) {

                    let windows = global.get_window_actors();

                    for (let i = 0; i < windows.length; i++) {
                        let window = windows[i].meta_window;
                        let compositor = windows[i];

                        if (!PEEK_TRANSPARENCY_FILTER_TYPES.includes(window.get_window_type())) {
                            if (this.peek_blur) {
                                if (!compositor.eff)
                                    compositor.eff = new Clutter.BlurEffect();
                                compositor.add_effect_with_name('peek-blur', compositor.eff);
                            }

                            compositor.ease(
                                {
                                    opacity: this.peek_opacity / 100 * 255,
                                    duration: 275,
                                    transition: Clutter.AnimationMode.EASE_IN_SINE,
                                }
                            );
                        }
                    }

                    this._did_peek = true;
                }
                this._peek_timeout_id = 0;
                return false;
            }));
        }
    }

    _on_leave(event) {
        if (this._did_peek) {
            this.show_all_windows(200);
            this._did_peek = false;
        }
        if (this._peek_timeout_id > 0) {
            Mainloop.source_remove(this._peek_timeout_id);
            this._peek_timeout_id = 0;
        }
    }

    on_applet_clicked(event) {
        global.workspace_manager.toggle_desktop(global.get_current_time());
        this.show_all_windows(0);
        if (this._peek_timeout_id > 0) {
            Mainloop.source_remove(this._peek_timeout_id);
            this._peek_timeout_id = 0;
        }
        this._did_peek = false;
    }

    on_applet_middle_clicked(event) {
        Main.deskletContainer.toggle();
    }

    toggleShowDesklets() {
        if (!Main.deskletContainer.isModal) {
            Main.deskletContainer.raise();
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonShowDesktopApplet(orientation, panel_height, instance_id);
}
