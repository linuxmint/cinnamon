// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

/**
 * FILE:chromeRaise.js
 * @short_description: Temporarily raises panels over a focused fullscreen window
 */
const Clutter = imports.gi.Clutter;
const Cinnamon = imports.gi.Cinnamon;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const SignalManager = imports.misc.signalManager;

const KEYBINDING_SCHEMA = "org.cinnamon.desktop.keybindings";
const SHOW_PANELS_KEY = "show-panels";

var ChromeRaiseManager = class ChromeRaiseManager {
    constructor() {
        this._raisedMonitor = -1;
        this._escapePressed = false;

        this._signals = new SignalManager.SignalManager(null);

        // A dedicated, otherwise-unused actor owns our modal grab. Reusing a real
        // Panel would alias with that panel's own context-menu grab (a Panel is
        // its own actor), which corrupts popModal targeting, menu key focus and
        // topmost detection - and it can't be destroyed out from under us.
        this._grabActor = new Clutter.Actor({ width: 0, height: 0 });
        Main.uiGroup.add_actor(this._grabActor);

        this._grabActor.connect("destroy", () => this.dismiss());

        // Shortcut to peek the panels over a focused fullscreen window - empty by default,
        // useful if not utilizing the typical 'super to open the start menu' arrangement.
        this._kbSettings = new Gio.Settings({ schema_id: KEYBINDING_SCHEMA });
        this._kbSettings.connect(`changed::${SHOW_PANELS_KEY}`, () => this._applyKeybinding());
        this._applyKeybinding();
    }

    _applyKeybinding() {
        Main.keybindingManager.addHotKeyArray(
            SHOW_PANELS_KEY,
            this._kbSettings.get_strv(SHOW_PANELS_KEY),
            () => this.toggleForFullscreen()
        );
    }

    // With a menu (or other modal) stacked on our raise, do nothing - the menu
    // owns the interaction.
    toggleForFullscreen() {
        if (this._raisedMonitor >= 0) {
            if (this._isTopmostModal())
                this.dismiss();
            return;
        }

        let focus = global.display.get_focus_window();
        if (focus && focus.is_fullscreen())
            this.raise(focus.get_monitor());
    }

    // Raise for the panel an actor belongs to. Called when any popup menu
    // grabs, so opening an applet menu over a fullscreen window elevates the
    // whole panel (not just that applet's own grab).
    ensureRaisedForActor(actor) {
        if (this._raisedMonitor >= 0)
            return;

        let panel = Main.panelManager.getPanelForActor(actor);
        if (panel)
            this.raise(panel.monitorIndex);
    }

    isPanelRaised(actor) {
        return this._raisedMonitor >= 0 &&
               Main.panelManager.getPanelsInMonitor(this._raisedMonitor).includes(actor);
    }

    // Called from the modal keybinding dispatch after a shortcut fires while
    // peeking. If that shortcut closed the last menu - leaving only our raise -
    // collapse back to the fullscreen content, so re-pressing the shortcut that
    // opened the peek (Super, Super+C, ...) closes it too. If a menu is still
    // open (the shortcut opened another), leave the raise alone.
    collapseIfBare() {
        if (this._raisedMonitor >= 0 && this._isTopmostModal())
            this.dismiss();
    }

    raise(monitorIndex) {
        if (this._raisedMonitor >= 0)
            return;

        if (monitorIndex < 0 || monitorIndex >= global.display.get_n_monitors() ||
            !global.display.get_monitor_in_fullscreen(monitorIndex))
            return;

        // The raise is only ever the base modal layer.
        if (Main.modalActorFocusStack.length > 0)
            return;

        if (Main.panelManager.getPanelsInMonitor(monitorIndex).length === 0)
            return;

        // Park the grab actor on the target monitor so it resolves there for the
        // fullscreen visibility check in layout.js's _updateVisibility.
        let geo = global.display.get_monitor_geometry(monitorIndex);
        this._grabActor.set_position(geo.x, geo.y);

        // NORMAL mode: the raised chrome is ordinary interaction floating over
        // a fullscreen window, so a second Super tap (and other bindings) keep
        // working - the menu opens on top of the still-revealed panels.
        if (!Main.pushModal(this._grabActor, global.get_current_time(), 0,
                            Cinnamon.ActionMode.NORMAL, () => this.dismiss())) {
            return;
        }

        this._raisedMonitor = monitorIndex;

        this._signals.connect(global.stage, "captured-event",
            (actor, event) => this._onCapturedEvent(event));

        // The raise lives as long as the monitor stays fullscreen. Losing that
        // (window closed, un-fullscreened, switched away, workspace change) ends
        // it - but workspace switches while overview/expo are up flip it
        // transiently, so we only act on the change when neither is up, and
        // re-check when they hide.
        this._signals.connect(global.display, "in-fullscreen-changed",
            () => this._onFullscreenChanged());
        this._signals.connect(Main.overview, "hidden", () => this._onOverlayHidden());
        this._signals.connect(Main.expo, "hidden", () => this._onOverlayHidden());

        // Monitor layout changes renumber monitors and can rebuild panels,
        // invalidating our monitor index - just end the raise. Same for any
        // panels-enabled change (panel added, removed or moved).
        this._signals.connect(Main.layoutManager, "monitors-changed",
            () => this.dismiss());
        this._signals.connect(global.settings, "changed::panels-enabled",
            () => this.dismiss());

        this._reveal();
    }

    dismiss() {
        if (this._raisedMonitor < 0)
            return;

        this._signals.disconnectAllSignals();

        // Capture our panels before clearing _raisedMonitor: the visibility
        // recalculations below must see isPanelRaised() as false, or auto-hide
        // panels would stay pinned visible.
        let panels = Main.panelManager.getPanelsInMonitor(this._raisedMonitor);

        this._raisedMonitor = -1;
        this._escapePressed = false;

        // Our record can already be off the stack if popModal happened on our
        // behalf (grab-actor destruction, dismissInternalModals' failure
        // fallback) - popping again would throw and skip the cleanup below,
        // leaving the panels stuck revealed.
        if (Main.modalActorFocusStack.some(record => record.actor === this._grabActor))
            Main.popModal(this._grabActor, global.get_current_time());
        Main.layoutManager.updateChrome(true);

        panels.forEach(panel => panel._updatePanelVisibility());
    }

    // Show our panels: enable() clears a leftover overview/expo
    // disablePanels() - they normally re-enable before emitting "hidden", but
    // expo's hide-into-scale path doesn't - without which revealPanel's
    // _showPanel would no-op. Then slide auto-hidden panels back onto the
    // monitor and let _updateVisibility keep them painted.
    _reveal() {
        Main.panelManager.getPanelsInMonitor(this._raisedMonitor).forEach(panel => {
            panel.enable();
            panel.revealPanel();
        });
        Main.layoutManager.updateChrome(true);
    }

    _monitorStillFullscreen() {
        return this._raisedMonitor >= 0 &&
               global.display.get_monitor_in_fullscreen(this._raisedMonitor);
    }

    _onFullscreenChanged() {
        // Workspace switches while overview/expo are up make the monitor
        // transiently non-fullscreen; ignore until they hide (handled by
        // _onOverlayHidden).
        if (Main.overview.visible || Main.expo.visible)
            return;

        if (!this._monitorStillFullscreen())
            this.dismiss();
    }

    _onOverlayHidden() {
        if (this._raisedMonitor < 0)
            return;

        if (!this._monitorStillFullscreen()) {
            this.dismiss();
            return;
        }

        // Still over a fullscreen window - overview/expo clobbered the panels'
        // visibility, so re-assert our reveal.
        this._reveal();
    }

    _onCapturedEvent(event) {
        let type = event.type();

        // A press on a client window ends the whole raised session, even with a
        // menu stacked on top: we dismiss, and any open menu closes via its own
        // capture handler (stacked menus can only grab after we raise, so their
        // handlers connect - and run - after ours).
        if (type === Clutter.EventType.BUTTON_PRESS && this._eventOnWindow(event)) {
            this.dismiss();
            return Clutter.EVENT_PROPAGATE;
        }

        // Otherwise only act while our grab is topmost; a stacked menu handles
        // its own Escape and clicks.
        if (!this._isTopmostModal())
            return Clutter.EVENT_PROPAGATE;

        // Dismiss on Escape's release, consuming both halves of the pair -
        // dismissing on the press would pop the grab and leak the bare release
        // to the fullscreen window.
        if (type === Clutter.EventType.KEY_PRESS &&
            event.get_key_symbol() === Clutter.KEY_Escape) {
            this._escapePressed = true;
            return Clutter.EVENT_STOP;
        }
        if (type === Clutter.EventType.KEY_RELEASE &&
            event.get_key_symbol() === Clutter.KEY_Escape &&
            this._escapePressed) {
            this.dismiss();
            return Clutter.EVENT_STOP;
        }

        // A press anywhere else - another monitor's panel, a desklet - ends the
        // raise but still propagates, so the target gets the full press/release
        // pair (context menus open on press; swallowing it would half-deliver
        // the click).
        if (type === Clutter.EventType.BUTTON_PRESS && !this._eventOnRaisedPanel(event)) {
            this.dismiss();
            return Clutter.EVENT_PROPAGATE;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _eventOnWindow(event) {
        let source = event.get_source();
        return source && global.window_group.contains(source);
    }

    _eventOnRaisedPanel(event) {
        let source = event.get_source();
        return source && Main.panelManager.getPanelsInMonitor(this._raisedMonitor).some(
            panel => panel.contains(source));
    }

    _isTopmostModal() {
        let stack = Main.modalActorFocusStack;
        return stack.length > 0 && stack[stack.length - 1].actor === this._grabActor;
    }

    // True while raised with a menu (or other modal) stacked on top of our grab.
    hasStackedModal() {
        return this._raisedMonitor >= 0 && !this._isTopmostModal();
    }
};
