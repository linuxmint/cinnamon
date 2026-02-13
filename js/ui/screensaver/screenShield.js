// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const LoginManager = imports.misc.loginManager;
const Util = imports.misc.util;
const Main = imports.ui.main;
const UnlockDialog = imports.ui.screensaver.unlockDialog;
const AwayMessageDialog = imports.ui.screensaver.awayMessageDialog;
const ClockWidget = imports.ui.screensaver.clockWidget;
const AlbumArtWidget = imports.ui.screensaver.albumArtWidget;
const InfoPanel = imports.ui.screensaver.infoPanel;

const CINNAMON_SCHEMA = 'org.cinnamon';
const SCREENSAVER_SCHEMA = 'org.cinnamon.desktop.screensaver';
const POWER_SCHEMA = 'org.cinnamon.settings-daemon.plugins.power';
const FADE_TIME = 200;
const MOTION_THRESHOLD = 100;

const FLOAT_TIMER_INTERVAL = 30;
const DEBUG_FLOAT = false;  // Set to true for 5-second intervals during development

const MAX_SCREENSAVER_WIDGETS = 3;
const WIDGET_LOAD_DELAY = 1000;

var _debug = true;

function _log(msg) {
    if (_debug)
        global.log(msg);
}

var _widgetRegistry = [];

/**
 * registerScreensaverWidget:
 * @widgetClass: Widget class to register (must extend ScreensaverWidget)
 *
 * Register a screensaver widget. Extensions can use this to add custom widgets.
 * Returns true if registered, false if registry is full or already registered.
 */
function registerScreensaverWidget(widgetClass) {
    if (_widgetRegistry.length >= MAX_SCREENSAVER_WIDGETS) {
        if (global.logWarning) {
            global.logWarning(`ScreenShield: Cannot register widget - registry full (max ${MAX_SCREENSAVER_WIDGETS})`);
        }
        return false;
    }

    if (_widgetRegistry.includes(widgetClass)) {
        if (global.logWarning) {
            global.logWarning('ScreenShield: Widget class already registered');
        }
        return false;
    }

    _widgetRegistry.push(widgetClass);
    if (global.log) {
        _log(`ScreenShield: Registered widget class (total: ${_widgetRegistry.length})`);
    }
    return true;
}

/**
 * deregisterScreensaverWidget:
 * @widgetClass: Widget class to deregister
 *
 * Deregister a screensaver widget. Extensions can use this to remove/replace widgets.
 * Returns true if deregistered, false if not found.
 */
function deregisterScreensaverWidget(widgetClass) {
    let index = _widgetRegistry.indexOf(widgetClass);
    if (index === -1) {
        if (global.logWarning) {
            global.logWarning('ScreenShield: Widget class not found in registry');
        }
        return false;
    }

    _widgetRegistry.splice(index, 1);
    if (global.log) {
        _log(`ScreenShield: Deregistered widget class (total: ${_widgetRegistry.length})`);
    }
    return true;
}

const State = {
    HIDDEN: 0,      // Screensaver not active
    FADING: 1,      // Idle fade in progress
    SHOWN: 2,       // Screensaver visible but not locked
    LOCKED: 3,      // Locked state (dialog hidden)
    UNLOCKING: 4    // Unlock dialog visible
};

var ScreenShield = GObject.registerClass({
    Signals: {
        'locked': {},
        'unlocked': {},
        'state-changed': { param_types: [GObject.TYPE_INT, GObject.TYPE_INT] }
    }
}, class ScreenShield extends St.Widget {
    _init() {
        super._init({
            name: 'screenShield',
            style_class: 'screen-shield',
            important: true,
            visible: false,
            reactive: true,
            x: 0,
            y: 0,
            layout_manager: new Clutter.FixedLayout()
        });

        // Register stock widgets (only do this once, on first init)
        if (_widgetRegistry.length === 0) {
            registerScreensaverWidget(ClockWidget.ClockWidget);
            registerScreensaverWidget(AlbumArtWidget.AlbumArtWidget);
        }

        this._state = State.HIDDEN;
        this._isModal = false;
        this._currentActionMode = null;
        this._lockTimeoutId = 0;
        this._backgrounds = [];  // Array of background actors, one per monitor
        this._lastPointerMonitor = -1;  // Track which monitor pointer is on
        this._monitorsChangedId = 0;
        this._widgets = [];  // Array of screensaver widgets
        this._awayMessage = null;
        this._floatTimerId = 0;
        this._floatersNeedUpdate = false;
        this._usedAwakePositions = new Set();  // Track used awake positions (as "halign:valign" keys)
        this._usedAwakePositions.add(`${St.Align.MIDDLE}:${St.Align.MIDDLE}`);  // Reserved for unlock dialog
        this._usedFloatPositions = new Set();  // Track currently used float positions
        this._widgetLoadTimeoutId = 0;
        this._widgetLoadIdleId = 0;
        this._infoPanel = null;
        this._inhibitor = null;
        this._cinnamonSettings = new Gio.Settings({ schema_id: CINNAMON_SCHEMA });
        _debug = this._cinnamonSettings.get_boolean('debug-screensaver');

        this._settings = new Gio.Settings({ schema_id: SCREENSAVER_SCHEMA });
        this._powerSettings = new Gio.Settings({ schema_id: POWER_SCHEMA });
        this._allowFloating = this._settings.get_boolean('floating-widgets');

        let constraint = new Clutter.BindConstraint({
            source: global.stage,
            coordinate: Clutter.BindCoordinate.ALL
        });
        this.add_constraint(constraint);

        Main.layoutManager.screenShieldGroup.add_actor(this);

        this._backgroundLayer = new St.Widget({
            name: 'screenShieldBackground',
            style_class: 'screen-shield-background',
            important: true,
            reactive: false,
            x_expand: true,
            y_expand: true
        });
        this.add_child(this._backgroundLayer);

        this._dialog = new UnlockDialog.UnlockDialog(this);
        this.add_child(this._dialog);

        this._capturedEventId = 0;
        this._lastMotionX = -1;
        this._lastMotionY = -1;

        this._loginManager = LoginManager.getLoginManager();
        this._loginManager.connectPrepareForSleep(this._prepareForSleep.bind(this));

        this._loginManager.connect('lock', this._onSessionLock.bind(this));
        this._loginManager.connect('unlock', this._onSessionUnlock.bind(this));
        this._loginManager.connect('active', this._onSessionActive.bind(this));

        this._monitorsChangedId = Main.layoutManager.connect('monitors-changed',
            this._onMonitorsChanged.bind(this));

        if (this._cinnamonSettings.get_boolean('session-locked-state')) {
            _log('ScreenShield: Restoring locked state from previous session');
            this._backupLockerCall('ReleaseGrabs', null, () => {
                this.lock(false, true);
            }, true);
        }
    }

    _setState(newState) {
        if (this._state === newState)
            return;

        const validTransitions = {
            [State.HIDDEN]: [State.FADING, State.SHOWN, State.LOCKED],
            [State.FADING]: [State.SHOWN, State.HIDDEN],
            [State.SHOWN]: [State.LOCKED, State.HIDDEN],
            [State.LOCKED]: [State.UNLOCKING, State.HIDDEN],
            [State.UNLOCKING]: [State.LOCKED, State.HIDDEN]
        };

        if (!validTransitions[this._state] || !validTransitions[this._state].includes(newState)) {
            global.logError(`ScreenShield: Invalid state transition ${this._state} -> ${newState}`);
            return;
        }

        let oldState = this._state;
        this._state = newState;
        _log(`ScreenShield: State ${oldState} -> ${newState}`);
        this.emit('state-changed', oldState, newState);

        let locked = newState === State.LOCKED || newState === State.UNLOCKING;
        let wasLocked = oldState === State.LOCKED || oldState === State.UNLOCKING;
        if (locked !== wasLocked) {
            this._cinnamonSettings.set_boolean('session-locked-state', locked);
        }

        this._syncInhibitor();
    }

    _pushModal(actionMode) {
        if (this._isModal)
            return true;

        if (!Main.pushModal(this, global.get_current_time(), 0, actionMode)) {
            global.logError('ScreenShield: Failed to acquire modal grab');
            return false;
        }

        this._isModal = true;
        this._currentActionMode = actionMode;
        return true;
    }

    _popModal() {
        if (!this._isModal)
            return;

        Main.popModal(this);
        this._isModal = false;
        this._currentActionMode = null;
    }

    _changeActionMode(newMode) {
        if (!this._isModal) {
            global.logWarning('ScreenShield: Cannot change ActionMode - not modal');
            return;
        }

        if (this._currentActionMode === newMode)
            return;

        // Pop and re-push with new mode
        this._popModal();
        this._pushModal(newMode);
    }

    /**
     * _onCapturedEvent:
     *
     * Handle all input events via stage capture.
     * This is connected to global.stage's captured-event signal when active.
     */
    _onCapturedEvent(actor, event) {
        let type = event.type();

        if (type !== Clutter.EventType.MOTION &&
            type !== Clutter.EventType.BUTTON_PRESS &&
            type !== Clutter.EventType.KEY_PRESS) {
            return Clutter.EVENT_PROPAGATE;
        }

        // Apply motion threshold when not awake to prevent accidental wakeups
        if (type === Clutter.EventType.MOTION) {
            this._updatePointerMonitor();

            if (!this.isAwake()) {
                let [x, y] = event.get_coords();

                if (this._lastMotionX < 0 || this._lastMotionY < 0) {
                    this._lastMotionX = x;
                    this._lastMotionY = y;
                    return Clutter.EVENT_PROPAGATE;
                }

                let distance = Math.max(Math.abs(this._lastMotionX - x),
                                        Math.abs(this._lastMotionY - y));
                if (distance < MOTION_THRESHOLD)
                    return Clutter.EVENT_PROPAGATE;
            }
        }

        if (type === Clutter.EventType.KEY_PRESS) {
            let symbol = event.get_key_symbol();

            // Escape key cancels if not locked
            if (symbol === Clutter.KEY_Escape && !this.isLocked()) {
                this.deactivate();
                return Clutter.EVENT_STOP;
            }
        }

        // Wake up on user activity
        if (this._state === State.LOCKED) {
            this.showUnlockDialog();

            // Forward printable characters to the password entry
            if (type === Clutter.EventType.KEY_PRESS) {
                let unichar = event.get_key_unicode();
                if (GLib.unichar_isprint(unichar)) {
                    this._dialog.addCharacter(unichar);
                }
            }
        } else if (this._state === State.SHOWN) {
            this.deactivate();
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    showUnlockDialog() {
        if (this._state !== State.LOCKED)
            return;

        _log('ScreenShield: Showing unlock dialog');

        this._clearClipboards();

        this._setState(State.UNLOCKING);

        this._lastPointerMonitor = global.display.get_current_monitor();
        this._changeActionMode(Cinnamon.ActionMode.UNLOCK_SCREEN);

        global.stage.show_cursor();

        this._dialog.opacity = 0;
        this._dialog.show();

        this._positionUnlockDialog();

        this._dialog.ease({
            opacity: 255,
            duration: FADE_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD
        });

        this._onWake();
    }

    hideUnlockDialog() {
        if (this._state !== State.UNLOCKING)
            return;

        _log('ScreenShield: Hiding unlock dialog');

        this._clearClipboards();
        this._lastMotionX = -1;
        this._lastMotionY = -1;

        this._dialog.ease({
            opacity: 0,
            duration: FADE_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._dialog.hide();

                this._setState(State.LOCKED);

                this._changeActionMode(Cinnamon.ActionMode.LOCK_SCREEN);

                global.stage.hide_cursor();
                this._onSleep();
            }
        });
    }

    _clearClipboards() {
        let clipboard = St.Clipboard.get_default();
        clipboard.set_text(St.ClipboardType.PRIMARY, '');
        clipboard.set_text(St.ClipboardType.CLIPBOARD, '');
    }

    lock(askForAwayMessage, immediate = false) {
        if (this.isLocked())
            return;

        if (askForAwayMessage && this._settings.get_boolean('ask-for-away-message')) {
            this._showAwayMessageDialog();
            return;
        }

        _log(`ScreenShield: Locking screen (immediate=${immediate})`);

        if (this._state === State.HIDDEN) {
            this.activate(immediate);
        }

        this._stopLockDelay();
        this._setLocked(true);
    }

    _showAwayMessageDialog() {
        if (this._awayMessageDialog) {
            return;
        }

        this._awayMessageDialog = new AwayMessageDialog.AwayMessageDialog((message) => {
            this._awayMessageDialog = null;
            this._awayMessage = message;
            this.lock(false);
        });

        this._awayMessageDialog.connect('closed', () => {
            this._awayMessageDialog = null;
        });

        this._awayMessageDialog.open();
    }

    _setLocked(locked) {
        if (locked === this.isLocked())
            return;

        if (locked) {
            this._setState(State.LOCKED);

            let stageXid = global.get_stage_xwindow();
            let [termTty, sessionTty] = Util.getTtyVals(_debug);
            this._backupLockerCall('Lock',
                GLib.Variant.new('(tuu)', [stageXid, parseInt(termTty), parseInt(sessionTty)]));

            this.emit('locked');
        } else {
            this._setState(State.SHOWN);
        }
    }

    unlock() {
        if (!this.isLocked())
            return;

        _log('ScreenShield: Unlocking screen');

        if (this._state === State.UNLOCKING) {
            this._dialog.hide();
        }

        this._hideShield(true);
    }

    activate(immediate = false) {
        if (this._state !== State.HIDDEN) {
            _log('ScreenShield: Already active');
            return;
        }

        _log(`ScreenShield: Activating screensaver (immediate=${immediate})`);

        this._lastMotionX = -1;
        this._lastMotionY = -1;

        this._setState(State.SHOWN);

        this._createBackgrounds();
        if (!this._pushModal(Cinnamon.ActionMode.LOCK_SCREEN)) {
            global.logError('ScreenShield: Failed to acquire modal grab');
            return;
        }

        this._capturedEventId = global.stage.connect('captured-event',
            this._onCapturedEvent.bind(this));

        global.stage.hide_cursor();

        if (Main.deskletContainer)
            Main.deskletContainer.actor.hide();

        Main.layoutManager.screenShieldGroup.show();
        this.show();

        if (immediate) {
            this.opacity = 255;
            this._scheduleWidgetLoading();
        } else {
            this.opacity = 0;
            this.ease({
                opacity: 255,
                duration: FADE_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    this._scheduleWidgetLoading();
                }
            });
        }

        this._startLockDelay();
    }

    _startLockDelay() {
        this._stopLockDelay();

        if (!this._settings.get_boolean('lock-enabled'))
            return;

        let lockDelay = this._settings.get_uint('lock-delay');

        if (lockDelay === 0) {
            this._setLocked(true);
        } else {
            this._lockTimeoutId = GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                lockDelay,
                this._onLockDelayTimeout.bind(this)
            );
        }
    }

    _stopLockDelay() {
        if (this._lockTimeoutId) {
            GLib.source_remove(this._lockTimeoutId);
            this._lockTimeoutId = 0;
        }
    }

    _onLockDelayTimeout() {
        this._lockTimeoutId = 0;
        this._setLocked(true);
        return GLib.SOURCE_REMOVE;
    }

    deactivate() {
        if (this.isLocked()) {
            _log('ScreenShield: Cannot deactivate while locked');
            return;
        }

        this._stopLockDelay();
        this._hideShield(false);
    }

    _hideShield(emitUnlocked) {
        this._backupLockerCall('Unlock', null);

        if (this._capturedEventId) {
            global.stage.disconnect(this._capturedEventId);
            this._capturedEventId = 0;
        }

        this.ease({
            opacity: 0,
            duration: FADE_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._popModal();
                this.hide();
                Main.layoutManager.screenShieldGroup.hide();
                this._destroyAllWidgets();
                global.stage.show_cursor();

                if (Main.deskletContainer)
                    Main.deskletContainer.actor.show();

                this._setState(State.HIDDEN);

                if (emitUnlocked)
                    this.emit('unlocked');
            }
        });
    }

    isLocked() {
        return this._state === State.LOCKED || this._state === State.UNLOCKING;
    }

    isAwake() {
        return this._state === State.UNLOCKING;
    }

    _syncInhibitor() {
        let lockEnabled = this._settings.get_boolean('lock-enabled');
        // Inhibit sleep when: screensaver is active but not yet locked, and lock is enabled.
        // This prevents suspending before the lock completes.
        let shouldInhibit = lockEnabled && this._state === State.SHOWN;

        if (shouldInhibit && !this._inhibitor) {
            _log('ScreenShield: Acquiring sleep inhibitor');
            this._loginManager.inhibit('Cinnamon needs to lock the screen', (inhibitor) => {
                if (!inhibitor) {
                    _log('ScreenShield: Failed to acquire sleep inhibitor');
                    return;
                }

                // Check if we still need it - state may have changed during async request
                let stillNeeded = this._settings.get_boolean('lock-enabled') &&
                                  this._state === State.SHOWN;
                if (stillNeeded) {
                    this._inhibitor = inhibitor;
                    _log('ScreenShield: Sleep inhibitor acquired');
                } else {
                    _log('ScreenShield: Sleep inhibitor no longer needed, releasing immediately');
                    inhibitor.close(null);
                }
            });
        } else if (!shouldInhibit && this._inhibitor) {
            _log('ScreenShield: Releasing sleep inhibitor');
            this._inhibitor.close(null);
            this._inhibitor = null;
        }
    }

    _prepareForSleep(aboutToSuspend) {
        if (aboutToSuspend) {
            _log('ScreenShield: System suspending');

            // Lock before suspend if lock-on-suspend is enabled in power settings
            let lockOnSuspend = this._powerSettings.get_boolean('lock-on-suspend');
            if (lockOnSuspend && !this.isLocked()) {
                this.lock(false, true);
            }
        } else {
            _log('ScreenShield: System resuming');

            // Show unlock dialog immediately on resume if locked
            if (this._state === State.LOCKED) {
                this.showUnlockDialog();
            }
        }
    }

    _onSessionLock() {
        _log('ScreenShield: Received lock signal from LoginManager');
        this.lock(false, true);
    }

    _onSessionUnlock() {
        _log(`ScreenShield: Received unlock signal from LoginManager (state=${this._state}, isLocked=${this.isLocked()})`);
        if (this.isLocked()) {
            this.unlock();
        } else if (this._state !== State.HIDDEN) {
            this.deactivate();
        }
    }

    _onSessionActive() {
        _log(`ScreenShield: Received active signal from LoginManager (state=${this._state})`);
        if (this._state === State.LOCKED) {
            this.showUnlockDialog();
        }
    }

    _updatePointerMonitor() {
        let currentMonitor = global.display.get_current_monitor();

        if (this._lastPointerMonitor !== currentMonitor) {
            this._lastPointerMonitor = currentMonitor;

            if (this._state === State.UNLOCKING && this._dialog.visible) {
                this._positionUnlockDialog();
            }

            if (this.isAwake()) {
                _log(`ScreenShield: Repositioning ${this._widgets.length} widgets to monitor ${currentMonitor}`);
                for (let widget of this._widgets) {
                    widget.applyAwakePosition(currentMonitor);
                    this._positionWidgetByState(widget);
                }
            }

            this._positionInfoPanel();
        }
    }

    _positionUnlockDialog() {
        if (!this._dialog)
            return;

        // Get current monitor geometry
        let monitorIndex = global.display.get_current_monitor();
        let monitor = Main.layoutManager.monitors[monitorIndex];

        // Get dialog's preferred size
        let [minWidth, natWidth] = this._dialog.get_preferred_width(-1);
        let [minHeight, natHeight] = this._dialog.get_preferred_height(natWidth);

        // Center on monitor
        let x = monitor.x + (monitor.width - natWidth) / 2;
        let y = monitor.y + (monitor.height - natHeight) / 2;

        this._dialog.set_position(x, y);
        this._dialog.set_size(natWidth, natHeight);

        _log(`ScreenShield: Positioned unlock dialog at ${x},${y} (${natWidth}x${natHeight}) on monitor ${monitorIndex}`);
    }

    _onMonitorsChanged() {
        if (this._state === State.HIDDEN)
            return;

        _log('ScreenShield: Monitors changed, updating backgrounds and layout');

        this._createBackgrounds();

        this._positionInfoPanel();

        if (this._state === State.UNLOCKING && this._dialog.visible) {
            this._lastPointerMonitor = -1;
            this._updatePointerMonitor();
        }
    }

    _positionWidget(widget, monitor, position) {
        widget._isBeingPositioned = true;

        // Divide monitor into 3x3 grid
        let sectorWidth = monitor.width / 3;
        let sectorHeight = monitor.height / 3;

        // St.Align values map directly to sector indices (START=0, MIDDLE=1, END=2)
        let sectorX = position.halign;
        let sectorY = position.valign;

        // Calculate sector bounds
        let sectorLeft = monitor.x + (sectorX * sectorWidth);
        let sectorTop = monitor.y + (sectorY * sectorHeight);

        // Get widget's preferred size
        let [minWidth, natWidth] = widget.get_preferred_width(-1);
        let [minHeight, natHeight] = widget.get_preferred_height(natWidth);

        // Constrain widget size to fit within sector
        let widgetWidth = Math.min(natWidth, sectorWidth);
        let widgetHeight = Math.min(natHeight, sectorHeight);

        // If we constrained width, recalculate height with new width
        if (widgetWidth < natWidth) {
            [minHeight, natHeight] = widget.get_preferred_height(widgetWidth);
            widgetHeight = Math.min(natHeight, sectorHeight);
        }

        let x = sectorLeft + (sectorWidth - widgetWidth) / 2;
        let y = sectorTop + (sectorHeight - widgetHeight) / 2;

        widget.set_position(Math.floor(x), Math.floor(y));
        widget._isBeingPositioned = false;
    }

    _scheduleWidgetLoading() {
        this._cancelWidgetLoading();

        this._widgetLoadTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            WIDGET_LOAD_DELAY,
            () => {
                this._widgetLoadTimeoutId = 0;
                this._startLoadingWidgets();
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _startLoadingWidgets() {
        this._createInfoPanel();

        if (_widgetRegistry.length === 0) {
            _log('ScreenShield: No widgets to load');
            return;
        }

        let widgetIndex = 0;

        this._widgetLoadIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            if (widgetIndex >= _widgetRegistry.length) {
                this._widgetLoadIdleId = 0;
                return GLib.SOURCE_REMOVE;
            }

            try {
                let widgetClass = _widgetRegistry[widgetIndex];
                let widget = new widgetClass(this._awayMessage);
                this._addScreenShieldWidget(widget);
            } catch (e) {
                global.logError(`ScreenShield: Failed to load widget ${widgetIndex}: ${e.message}`);
            }

            widgetIndex++;
            return GLib.SOURCE_CONTINUE;
        });
    }

    _cancelWidgetLoading() {
        if (this._widgetLoadTimeoutId) {
            GLib.source_remove(this._widgetLoadTimeoutId);
            this._widgetLoadTimeoutId = 0;
        }

        if (this._widgetLoadIdleId) {
            GLib.source_remove(this._widgetLoadIdleId);
            this._widgetLoadIdleId = 0;
        }
    }

    _addScreenShieldWidget(widget) {
        this._validateAwakePosition(widget);

        if (this.isAwake() || !this._allowFloating) {
            let currentMonitor = global.display.get_current_monitor();
            widget.applyAwakePosition(currentMonitor);
            if (this.isAwake()) {
                widget.onAwake();
            }
        } else {
            this._assignRandomPositionToWidget(widget);
            widget.applyNextPosition();

            if (this._widgets.length === 0) {
                this._startFloatTimer();
            }
        }

        widget._allocationChangedId = widget.connect('allocation-changed',
            this._onWidgetAllocationChanged.bind(this, widget));

        this._widgets.push(widget);

        this.add_child(widget);

        widget.onScreensaverActivated();
    }

    _onWidgetAllocationChanged(widget) {
        if (widget._isBeingPositioned)
            return;

        this._positionWidgetByState(widget);
    }

    _validateAwakePosition(widget) {
        let pos = widget.getAwakePosition();
        let posKey = `${pos.halign}:${pos.valign}`;

        if (this._usedAwakePositions.has(posKey)) {
            let newPos = this._findAvailableAwakePosition();
            if (newPos) {
                global.logWarning(`ScreenShield: Widget awake position ${posKey} conflicts, ` +
                    `reassigning to ${newPos.halign}:${newPos.valign}`);
                widget.setAwakePosition(0, newPos.halign, newPos.valign);
                posKey = `${newPos.halign}:${newPos.valign}`;
            } else {
                global.logWarning(`ScreenShield: No available awake position for widget, ` +
                    `using conflicting position ${posKey}`);
            }
        }

        this._usedAwakePositions.add(posKey);
    }

    _findAvailableAwakePosition() {
        let alignments = [St.Align.START, St.Align.MIDDLE, St.Align.END];

        for (let halign of alignments) {
            for (let valign of alignments) {
                let posKey = `${halign}:${valign}`;
                if (!this._usedAwakePositions.has(posKey)) {
                    return { halign, valign };
                }
            }
        }

        return null;
    }

    _destroyAllWidgets() {
        this._cancelWidgetLoading();

        this._stopFloatTimer();
        this._destroyInfoPanel();
        for (let widget of this._widgets) {
            if (widget._allocationChangedId) {
                widget.disconnect(widget._allocationChangedId);
                widget._allocationChangedId = 0;
            }
            widget.onScreensaverDeactivated();
            widget.destroy();
        }

        this._widgets = [];

        this._usedAwakePositions.clear();
        this._usedAwakePositions.add(`${St.Align.MIDDLE}:${St.Align.MIDDLE}`);  // Reserved for unlock dialog
        this._usedFloatPositions.clear();
    }

    _createInfoPanel() {
        if (this._infoPanel)
            return;

        this._infoPanel = new InfoPanel.InfoPanel();
        this._infoPanel.connect('allocation-changed', this._positionInfoPanel.bind(this));
        this.add_child(this._infoPanel);
        this._infoPanel.onScreensaverActivated();
    }

    _destroyInfoPanel() {
        if (this._infoPanel) {
            this._infoPanel.onScreensaverDeactivated();
            this._infoPanel.destroy();
            this._infoPanel = null;
        }
    }

    _positionInfoPanel() {
        if (!this._infoPanel)
            return;

        let currentMonitor = global.display.get_current_monitor();
        let monitor = Main.layoutManager.monitors[currentMonitor];
        if (!monitor)
            monitor = Main.layoutManager.primaryMonitor;

        let [, natWidth] = this._infoPanel.get_preferred_width(-1);
        let [, natHeight] = this._infoPanel.get_preferred_height(natWidth);

        let padding = 12 * global.ui_scale;
        let x = monitor.x + monitor.width - natWidth - padding;
        let y = monitor.y + padding;

        this._infoPanel.set_position(Math.floor(x), Math.floor(y));
    }

    _positionWidgetByState(widget) {
        let pos = widget.getCurrentPosition();
        let monitor = Main.layoutManager.monitors[pos.monitor];

        if (!monitor) {
            monitor = Main.layoutManager.primaryMonitor;
        }

        this._positionWidget(widget, monitor, pos);
    }

    _startFloatTimer() {
        this._stopFloatTimer();

        // Don't start if floating is disabled or no floating widgets
        if (!this._allowFloating || this._widgets.length === 0)
            return;

        let interval = DEBUG_FLOAT ? 5 : FLOAT_TIMER_INTERVAL;

        this._floatTimerId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            interval,
            this._onFloatTimer.bind(this)
        );

        _log(`ScreenShield: Started float timer (${interval} seconds)`);
    }

    _stopFloatTimer() {
        if (this._floatTimerId) {
            GLib.source_remove(this._floatTimerId);
            this._floatTimerId = 0;
        }
    }

    _onFloatTimer() {
        this._floatersNeedUpdate = true;
        this._updateFloaters();
        return GLib.SOURCE_CONTINUE;
    }

    _updateFloaters() {
        if (!this._floatersNeedUpdate || this._widgets.length === 0)
            return;

        if (this.isAwake() || !this._allowFloating) {
            this._floatersNeedUpdate = false;
            return;
        }

        this._assignRandomPositions();

        for (let widget of this._widgets) {
            widget.applyNextPosition();
            this._positionWidgetByState(widget);
        }

        this._floatersNeedUpdate = false;
    }

    _assignRandomPositionToWidget(widget) {
        // Build list of available positions (excluding already used)
        let availablePositions = [];
        let nMonitors = Main.layoutManager.monitors.length;
        let alignments = [St.Align.START, St.Align.MIDDLE, St.Align.END];

        for (let monitor = 0; monitor < nMonitors; monitor++) {
            for (let halign of alignments) {
                for (let valign of alignments) {
                    let posKey = `${monitor}:${halign}:${valign}`;
                    if (!this._usedFloatPositions.has(posKey)) {
                        availablePositions.push({ monitor, halign, valign, key: posKey });
                    }
                }
            }
        }

        if (availablePositions.length === 0) {
            // All positions used, just pick a random one
            let monitor = Math.floor(Math.random() * nMonitors);
            let halign = alignments[Math.floor(Math.random() * 3)];
            let valign = alignments[Math.floor(Math.random() * 3)];
            widget.setNextPosition(monitor, halign, valign);
            return;
        }

        let idx = Math.floor(Math.random() * availablePositions.length);
        let pos = availablePositions[idx];
        widget.setNextPosition(pos.monitor, pos.halign, pos.valign);
        this._usedFloatPositions.add(pos.key);
    }

    _assignRandomPositions() {
        this._usedFloatPositions.clear();

        for (let widget of this._widgets) {
            this._assignRandomPositionToWidget(widget);
        }
    }

    _onWake() {
        _log('ScreenShield: Waking up');

        this._stopFloatTimer();

        let currentMonitor = global.display.get_current_monitor();
        for (let widget of this._widgets) {
            widget.applyAwakePosition(currentMonitor);
            widget.onAwake();
            this._positionWidgetByState(widget);
        }

        if (this._infoPanel)
            this._infoPanel.onWake();
    }

    _onSleep() {
        _log('ScreenShield: Going to sleep');

        for (let widget of this._widgets) {
            widget.onSleep();
        }

        if (this._infoPanel)
            this._infoPanel.onSleep();

        this._startFloatTimer();
        this._floatersNeedUpdate = true;
        this._updateFloaters();
    }

    _backupLockerCall(method, params, callback, noAutoStart = false) {
        Gio.DBus.session.call(
            'org.cinnamon.BackupLocker',
            '/org/cinnamon/BackupLocker',
            'org.cinnamon.BackupLocker',
            method,
            params,
            null,
            noAutoStart ? Gio.DBusCallFlags.NO_AUTO_START : Gio.DBusCallFlags.NONE,
            5000,
            null,
            (connection, result) => {
                try {
                    connection.call_finish(result);
                } catch (e) {
                    _log(`ScreenShield: BackupLocker.${method} failed: ${e.message}`);
                }
                if (callback)
                    callback();
            }
        );
    }

    _createBackgrounds() {
        this._destroyBackgrounds();

        if (Meta.is_wayland_compositor()) {
            // TODO
            return;
        }

        let nMonitors = Main.layoutManager.monitors.length;

        for (let i = 0; i < nMonitors; i++) {
            let monitor = Main.layoutManager.monitors[i];
            let background = Meta.X11BackgroundActor.new_for_display(global.display);

            background.reactive = false;

            background.set_position(monitor.x, monitor.y);
            background.set_size(monitor.width, monitor.height);

            let effect = new Clutter.BrightnessContrastEffect();
            effect.set_brightness(-0.7);  // Darken by 70%
            background.add_effect(effect);

            this._backgroundLayer.add_child(background);

            this._backgrounds.push(background);
        }
    }

    _destroyBackgrounds() {
        for (let bg of this._backgrounds) {
            bg.destroy();
        }
        this._backgrounds = [];
    }

    vfunc_destroy() {
        this._cancelWidgetLoading();
        this._backupLockerCall('Unlock', null);

        if (this._inhibitor) {
            this._inhibitor.close(null);
            this._inhibitor = null;
        }

        if (this._capturedEventId) {
            global.stage.disconnect(this._capturedEventId);
            this._capturedEventId = 0;
        }

        if (this._monitorsChangedId) {
            Main.layoutManager.disconnect(this._monitorsChangedId);
            this._monitorsChangedId = 0;
        }

        this._destroyBackgrounds();
        this._destroyAllWidgets();

        super.vfunc_destroy();
    }
});
