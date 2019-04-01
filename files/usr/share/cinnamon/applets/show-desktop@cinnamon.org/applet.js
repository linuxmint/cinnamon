const {IconApplet} = imports.ui.applet;
const {AppletSettings} = imports.ui.settings;  // Needed for settings API
const {addTween} = imports.ui.tweener;
const {deskletContainer} = imports.ui.main;
const {PopupIconMenuItem} = imports.ui.popupMenu;
const {IconType} = imports.gi.St;
const {BlurEffect} = imports.gi.Clutter;
const {SignalManager} = imports.misc.signalManager;

class CinnamonShowDesktopApplet extends IconApplet {
    constructor(orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this.settings = new AppletSettings(this, "show-desktop@cinnamon.org", instance_id, true);
        this.settings.promise.then(() => this.settingsInit());
    }

    settingsInit() {
        this.settings.bind('peek-at-desktop', 'peek_at_desktop');
        this.settings.bind('peek-delay', 'peek_delay');
        this.settings.bind('peek-opacity', 'peek_opacity');
        this.settings.bind('peek-blur', 'peek_blur');

        this.signals = new SignalManager(null);
        this.actor.connect('enter-event', () => this._on_enter());
        this.actor.connect('leave-event', () => this._on_leave());
        this.signals.connect(global.stage, 'notify::key-focus', () => this._on_leave());

        this._did_peek = false;

        this.set_applet_icon_name("user-desktop");
        this.set_applet_tooltip(_("Click to show the desktop or middle-click to show the desklets"));

        let showDeskletsOption = new PopupIconMenuItem(
            _('Show Desklets'),
            'cs-desklets',
            IconType.SYMBOLIC
        );
        showDeskletsOption.connect('activate', () => this.toggleShowDesklets());
        this._applet_context_menu.addMenuItem(showDeskletsOption);
    }

    on_applet_removed_from_panel() {
        this.signals.disconnectAllSignals();
        this.settings.finalize();
    }

    show_all_windows(time) {
        let windows = global.get_window_actors();
        for(let i = 0; i < windows.length; i++){
            let window = windows[i].meta_window;
            let compositor = windows[i];
            if(window.get_title() == "Desktop"){
                addTween(compositor, { opacity: 255, time: time, transition: "easeOutSine" });
            }
            if (this.peek_blur && compositor.eff) {
                compositor.remove_effect(compositor.eff);
            }
        }
        addTween(global.window_group, { opacity: 255, time: time, transition: "easeOutSine" });
    }

    _on_enter() {
        if (this.peek_at_desktop) {
            setTimeout(() => {
                if (this.actor.hover &&
                    !this._applet_context_menu.isOpen &&
                    !global.settings.get_boolean("panel-edit-mode")) {

                    addTween(global.window_group,
                                     {opacity: this.peek_opacity, time: 0.275, transition: "easeInSine"});

                    let windows = global.get_window_actors();
                    for (let i = 0; i < windows.length; i++) {
                        let compositor = windows[i];

                        if (this.peek_blur) {
                            if (!compositor.eff)
                                compositor.eff = new BlurEffect();
                            compositor.add_effect_with_name('peek-blur', compositor.eff);
                        }
                    }
                    this._did_peek = true;
                }
            }, this.peek_delay);
        }
    }

    _on_leave() {
        if (this._did_peek) {
            this.show_all_windows(0.2);
            this._did_peek = false;
        }
    }

    on_applet_clicked(event) {
        global.screen.toggle_desktop(global.get_current_time());
        this.show_all_windows(0);
        this._did_peek = false;
    }

    on_applet_middle_clicked(event) {
        deskletContainer.toggle();
    }

    toggleShowDesklets() {
        if (!deskletContainer.isModal) {
            deskletContainer.get_parent().set_child_above_sibling(deskletContainer, null)
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new CinnamonShowDesktopApplet(orientation, panel_height, instance_id);
}
