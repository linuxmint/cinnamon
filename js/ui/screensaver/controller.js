// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const St = imports.gi.St;

const Main = imports.ui.main;
const ScreenShield = imports.ui.screensaver.screenShield;
const ScreenSaver = imports.misc.screenSaver;
const AwayMessageDialog = imports.ui.screensaver.awayMessageDialog;

var ScreensaverController = class {
    #screenShield = null;
    #screenSaverProxy = null;
    #locked = false;
    #settings;

    constructor() {
        this.#settings = new Gio.Settings({ schema_id: 'org.cinnamon.desktop.screensaver' });

        if (!global.session_running || Meta.is_wayland_compositor()) {
            // If the session is *not* already running, clear the internal locked
            // state. This is used in x11 sessions to restore the screensaver after
            // cinnamon restarts. Wayland doesn't support restarts (yet) so it should
            // always be false.
            global.settings.set_boolean("session-locked-state", false);
        }

        this.#screenSaverProxy = new ScreenSaver.ScreenSaverProxy();

        // The internal screensaver is the only option for wayland sessions. X11 sessions can use either
        // the internal one or cinnamon-screensaver (>= 6.7).
        if (Meta.is_wayland_compositor() || global.settings.get_boolean('internal-screensaver-enabled')) {
            let screenShieldGroup = new St.Widget({
                name: 'screenShieldGroup',
                visible: false,
                clip_to_allocation: true,
                layout_manager: new Clutter.BinLayout()
            });
            screenShieldGroup.add_constraint(new Clutter.BindConstraint({
                source: global.stage,
                coordinate: Clutter.BindCoordinate.ALL
            }));
            global.stage.add_actor(screenShieldGroup);

            this.#screenShield = new ScreenShield.ScreenShield(screenShieldGroup);
            new ScreenSaver.ScreenSaverService(this.#screenShield);

            this.#screenShield.connect('locked', () => {
                this.#locked = true;
                this.emit('locked-changed', true);
            });
            this.#screenShield.connect('unlocked', () => {
                this.#locked = false;
                this.emit('locked-changed', false);
            });
        } else {
            this.#screenSaverProxy.connectSignal('ActiveChanged', (proxy, senderName, [isActive]) => {
                this.#locked = isActive;
                this.emit('locked-changed', isActive);
            });

            this.#screenSaverProxy.connect('notify::g-name-owner', () => {
                if (this.#screenSaverProxy.g_name_owner) {
                    this.#screenSaverProxy.GetActiveRemote((result, error) => {
                        if (result) {
                            let [isActive] = result;
                            this.#locked = isActive;
                            this.emit('locked-changed', isActive);
                        }
                    });
                } else {
                    this.#locked = false;
                    this.emit('locked-changed', false);
                }
            });
        }
    }

    get locked() {
        return this.#locked;
    }

    get allowKeyboardShortcuts() {
        return this.#settings.get_boolean('allow-keyboard-shortcuts');
    }

    lockScreen(askForAwayMessage) {
        if (Main.lockdownSettings.get_boolean('disable-lock-screen'))
            return;

        if (askForAwayMessage && this.#settings.get_boolean('ask-for-away-message')) {
            let dialog = new AwayMessageDialog.AwayMessageDialog((message) => {
                this.#doLock(message);
            });
            dialog.open();
            return;
        }

        this.#doLock(null);
    }

    #doLock(awayMessage) {
        if (this.#screenShield) {
            this.#screenShield.lock(false, awayMessage);
            return;
        }

        this.#screenSaverProxy.LockRemote(awayMessage || "");
    }

    hideKeyboard() {
        this.#screenShield?._hideScreensaverKeyboard();
    }

    toggleScreensaverKeyboard() {
        if (this.#screenShield?.visible) {
            this.#screenShield._toggleScreensaverKeyboard();
            return true;
        }
        return false;
    }
};
Signals.addSignalMethods(ScreensaverController.prototype);
