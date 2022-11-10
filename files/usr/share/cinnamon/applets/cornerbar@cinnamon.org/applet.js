const Applet = imports.ui.applet;
const St = imports.gi.St;
const Lang = imports.lang;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const Settings = imports.ui.settings;
const PopupMenu = imports.ui.popupMenu;
const SignalManager = imports.misc.signalManager;
const Mainloop = imports.mainloop;
const Tweener = imports.ui.tweener;

class CinnamonBarApplet extends Applet.Applet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);
        this.settings = new Settings.AppletSettings(this, "cornerbar@cinnamon.org", instance_id);

        this.settings.bind("peek-at-desktop", "peek_at_desktop");
        this.settings.bind("peek-delay", "peek_delay");
        this.settings.bind("peek-opacity", "peek_opacity");
        this.settings.bind("peek-blur", "peek_blur");
        this.settings.bind("click-action", "click_action");
        this.settings.bind("middle-click-action", "middle_click_action");

        this.signals = new SignalManager.SignalManager(null);
        this.actor.connect('enter-event', Lang.bind(this, this._on_enter));
        this.actor.connect('leave-event', Lang.bind(this, this._on_leave));
        this.signals.connect(global.stage, 'notify::key-focus', this._on_leave, this);

        this._did_peek = false;
        this._peek_timeout_id = 0;

        this.actor.style_class = 'applet-cornerbar-box';
        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.settings.connect("settings-changed", () => {
            this.set_tooltip();
        });
        this.set_tooltip();

        this.on_orientation_changed(orientation);

        // Context menu
        let desktop_option = new PopupMenu.PopupMenuItem(_('Show the desktop'));
        desktop_option.connect('activate', () => this.show_desktop());
        this._applet_context_menu.addMenuItem(desktop_option);
        let desklet_option = new PopupMenu.PopupMenuItem(_('Show the desklets'));
        desklet_option.connect('activate', () => this.show_desklets());
        this._applet_context_menu.addMenuItem(desklet_option);
        let expo_option = new PopupMenu.PopupMenuItem(_('Show the workspace selector (Expo)'));
        expo_option.connect('activate', () => this.expo());
        this._applet_context_menu.addMenuItem(expo_option);
        let scale_option = new PopupMenu.PopupMenuItem(_('Show the window selector (Scale)'));
        scale_option.connect('activate', () => this.scale());
        this._applet_context_menu.addMenuItem(scale_option);
    }

    set_tooltip() {
        if (this.click_action == "show_desktop")
            this.set_applet_tooltip(_("Show the desktop"));
        else if (this.click_action == "show_desklets")
            this.set_applet_tooltip(_('Show the desklets'));
        else if (this.click_action == "show_expo")
            this.set_applet_tooltip(_('Show the workspace selector (Expo)'));
        else if (this.click_action == "show_scale")
            this.set_applet_tooltip(_('Show the window selector (Scale)'));
    }

    handleDragOver(source, actor, x, y, time){
        this.show_desktop();
    }

    on_panel_height_changed() {
        this.on_orientation_changed(this.orientation);
    }

    on_orientation_changed(neworientation) {
        this.orientation = neworientation;

        if (this.orientation == St.Side.TOP || this.orientation == St.Side.BOTTOM) {
            if (this._line) {
                this._line.destroy();
            }

            this.actor.remove_style_class_name('vertical');

            this._line = new St.BoxLayout({ style_class: 'applet-cornerbar' });
            this.actor.add(this._line, { y_align: Clutter.ActorAlign.CENTER, x_align: Clutter.ActorAlign.CENTER, y_fill: true, y_expand: true});
        } else {
            if (this._line) {
                this._line.destroy();
            }

            this.actor.add_style_class_name('vertical');

            this._line = new St.BoxLayout({ style_class: 'applet-cornerbar', reactive: true, track_hover: true });
            this._line.add_style_class_name('vertical');
            this._line.set_important(true);
            this.actor.add(this._line, { y_align: Clutter.ActorAlign.CENTER, x_align: Clutter.ActorAlign.CENTER});
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

                        if (window.get_title() !== "Desktop") {
                            if (this.peek_blur) {
                                if (!compositor.eff)
                                    compositor.eff = new Clutter.BlurEffect();
                                compositor.add_effect_with_name('peek-blur', compositor.eff);
                            }

                            Tweener.addTween(compositor,
                                {
                                    opacity: this.peek_opacity / 100 * 255,
                                    time: 0.275,
                                    transition: "easeInSine"
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
            this.show_all_windows(0.2);
            this._did_peek = false;
        }
        if (this._peek_timeout_id > 0) {
            Mainloop.source_remove(this._peek_timeout_id);
            this._peek_timeout_id = 0;
        }
    }

    show_all_windows(time) {
        let windows = global.get_window_actors();
        for(let i = 0; i < windows.length; i++){
            let window = windows[i].meta_window;
            let compositor = windows[i];

            Tweener.addTween(compositor,
                {
                    opacity: 255,
                    time: time,
                    transition: "easeOutSine"
                }
            );

            if (this.peek_blur && compositor.eff) {
                compositor.remove_effect(compositor.eff);
            }
        }
    }

    on_applet_clicked(event) {
        this.perform_action(this.click_action);
    }

    on_applet_middle_clicked(event) {
        this.perform_action(this.middle_click_action);
    }

    perform_action(action) {
        if (action == "show_desktop")
            this.show_desktop();
        else if (action == "show_desklets")
            this.show_desklets();
        else if (action == "show_expo")
            this.expo();
        else if (action == "show_scale")
            this.scale();
    }

    show_desktop() {
        global.workspace_manager.toggle_desktop(global.get_current_time());
        this.show_all_windows(0);
        if (this._peek_timeout_id > 0) {
            Mainloop.source_remove(this._peek_timeout_id);
            this._peek_timeout_id = 0;
        }
        this._did_peek = false;
    }

    show_desklets() {
        Main.deskletContainer.toggle();
    }

    expo() {
        if (!Main.expo.animationInProgress)
            Main.expo.toggle();
    }

    scale() {
        if (!Main.overview.animationInProgress)
            Main.overview.toggle();
    }

}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonBarApplet(orientation, panel_height, instance_id);
}
