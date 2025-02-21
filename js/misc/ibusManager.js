// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported getIBusManager */

const { Gio, GLib, IBus, Meta } = imports.gi;
const Signals = imports.signals;

const IBusCandidatePopup = imports.ui.ibusCandidatePopup;

// Ensure runtime version matches
_checkIBusVersion(1, 5, 2);

let _ibusManager = null;

function _checkIBusVersion(requiredMajor, requiredMinor, requiredMicro) {
    if ((IBus.MAJOR_VERSION > requiredMajor) ||
        (IBus.MAJOR_VERSION == requiredMajor && IBus.MINOR_VERSION > requiredMinor) ||
        (IBus.MAJOR_VERSION == requiredMajor && IBus.MINOR_VERSION == requiredMinor &&
         IBus.MICRO_VERSION >= requiredMicro))
        return;

    throw "Found IBus version %d.%d.%d but required is %d.%d.%d"
        .format(IBus.MAJOR_VERSION, IBus.MINOR_VERSION, IBus.MINOR_VERSION,
                requiredMajor, requiredMinor, requiredMicro);
}

function getIBusManager() {
    if (_ibusManager == null)
        _ibusManager = new IBusManager();
    return _ibusManager;
}

var IBusManager = class {
    constructor() {
        IBus.init();

        // This is the longest we'll keep the keyboard frozen until an input
        // source is active.
        this._MAX_INPUT_SOURCE_ACTIVATION_TIME = 4000; // ms
        this._PRELOAD_ENGINES_DELAY_TIME = 30; // sec


        this._candidatePopup = new IBusCandidatePopup.CandidatePopup();

        this._panelService = null;
        this._engines = new Map();
        this._ready = false;
        this._registerPropertiesId = 0;
        this._currentEngineName = null;
        this._preloadEnginesId = 0;

        this._ibus = IBus.Bus.new_async();
        this._ibus.connect('connected', this._onConnected.bind(this));
        this._ibus.connect('disconnected', this._clear.bind(this));
        // Need to set this to get 'global-engine-changed' emitions
        this._ibus.set_watch_ibus_signal(true);
        this._ibus.connect('global-engine-changed', this._engineChanged.bind(this));

        this._spawn(Meta.is_wayland_compositor() ? [] : ['--xim']);
    }

    _spawn(extraArgs = []) {
        try {
            let cmdLine = ['ibus-daemon', '--panel', 'disable', ...extraArgs];
            let launcher = Gio.SubprocessLauncher.new(Gio.SubprocessFlags.NONE);
            // Forward the right X11 Display for ibus-x11
            let display = GLib.getenv('GNOME_SETUP_DISPLAY');
            if (display)
                launcher.setenv('DISPLAY', display, true);
            launcher.spawnv(cmdLine);
        } catch (e) {
            log(`Failed to launch ibus-daemon: ${e.message}`);
        }
    }

    restartDaemon(extraArgs = []) {
        this._spawn(['-r', ...extraArgs]);
    }

    _clear() {
        if (this._cancellable) {
            this._cancellable.cancel();
            this._cancellable = null;
        }

        if (this._preloadEnginesId) {
            GLib.source_remove(this._preloadEnginesId);
            this._preloadEnginesId = 0;
        }

        if (this._panelService)
            this._panelService.destroy();

        this._panelService = null;
        this._candidatePopup.setPanelService(null);
        this._engines.clear();
        this._ready = false;
        this._registerPropertiesId = 0;
        this._currentEngineName = null;

        this.emit('ready', false);
    }

    _onConnected() {
        this._cancellable = new Gio.Cancellable();
        this._ibus.list_engines_async(-1, this._cancellable,
            this._initEngines.bind(this));
        this._ibus.request_name_async(IBus.SERVICE_PANEL,
            IBus.BusNameFlag.REPLACE_EXISTING, -1, this._cancellable,
            this._initPanelService.bind(this));
    }

    _initEngines(ibus, result) {
        try {
            let enginesList = this._ibus.list_engines_async_finish(result);
            for (let i = 0; i < enginesList.length; ++i) {
                let name = enginesList[i].get_name();
                this._engines.set(name, enginesList[i]);
            }
            this._updateReadiness();
        } catch (e) {
            if (e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                return;

            logError(e);
            this._clear();
        }
    }

    _initPanelService(ibus, result) {
        try {
            this._ibus.request_name_async_finish(result);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                logError(e);
                this._clear();
            }
            return;
        }

        this._panelService = new IBus.PanelService({
            connection: this._ibus.get_connection(),
            object_path: IBus.PATH_PANEL,
        });
        this._candidatePopup.setPanelService(this._panelService);
        this._panelService.connect('update-property', this._updateProperty.bind(this));
        this._panelService.connect('set-cursor-location', (ps, x, y, w, h) => {
            let cursorLocation = { x, y, width: w, height: h };
            this.emit('set-cursor-location', cursorLocation);
        });
        this._panelService.connect('focus-in', (panel, path) => {
            if (!GLib.str_has_suffix(path, '/InputContext_1'))
                this.emit('focus-in');
        });
        this._panelService.connect('focus-out', () => this.emit('focus-out'));

        try {
            // IBus versions older than 1.5.10 have a bug which
            // causes spurious set-content-type emissions when
            // switching input focus that temporarily lose purpose
            // and hints defeating its intended semantics and
            // confusing users. We thus don't use it in that case.
            _checkIBusVersion(1, 5, 10);
            this._panelService.connect('set-content-type', this._setContentType.bind(this));
        } catch (e) {
        }
        // If an engine is already active we need to get its properties
        this._ibus.get_global_engine_async(-1, this._cancellable, (_bus, res) => {
            let engine;
            try {
                engine = this._ibus.get_global_engine_async_finish(res);
                if (!engine)
                    return;
            } catch (e) {
                return;
            }
            this._engineChanged(this._ibus, engine.get_name());
        });
        this._updateReadiness();
    }

    _updateReadiness() {
        this._ready = this._engines.size > 0 && this._panelService != null;
        this.emit('ready', this._ready);
    }

    _engineChanged(bus, engineName) {
        if (!this._ready)
            return;

        this._currentEngineName = engineName;

        if (this._registerPropertiesId != 0)
            return;

        this._registerPropertiesId =
            this._panelService.connect('register-properties', (p, props) => {
                if (!props.get(0))
                    return;

                this._panelService.disconnect(this._registerPropertiesId);
                this._registerPropertiesId = 0;

                this.emit('properties-registered', this._currentEngineName, props);
            });
    }

    _updateProperty(panel, prop) {
        this.emit('property-updated', this._currentEngineName, prop);
    }

    _setContentType(panel, purpose, hints) {
        this.emit('set-content-type', purpose, hints);
    }

    activateProperty(key, state) {
        this._panelService.property_activate(key, state);
    }

    getEngineDesc(id) {
        if (!this._ready || !this._engines.has(id))
            return null;

        return this._engines.get(id);
    }

    setEngine(id, callback) {
        // Send id even if id == this._currentEngineName
        // because 'properties-registered' signal can be emitted
        // while this._ibusSources == null on a lock screen.
        if (!this._ready) {
            if (callback)
                callback();
            return;
        }

        this._ibus.set_global_engine_async(id,
            this._MAX_INPUT_SOURCE_ACTIVATION_TIME,
            this._cancellable, (_bus, res) => {
                try {
                    this._ibus.set_global_engine_async_finish(res);
                } catch (e) {
                    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        logError(e);
                }
                if (callback)
                    callback();
            });
    }

    preloadEngines(ids) {
        if (!this._ibus || ids.length == 0)
            return;

        if (this._preloadEnginesId != 0) {
            GLib.source_remove(this._preloadEnginesId);
            this._preloadEnginesId = 0;
        }

        this._preloadEnginesId =
            GLib.timeout_add_seconds(
                GLib.PRIORITY_DEFAULT,
                this._PRELOAD_ENGINES_DELAY_TIME,
                () => {
                    this._ibus.preload_engines_async(
                        ids,
                        -1,
                        this._cancellable,
                        null);
                    this._preloadEnginesId = 0;
                    return GLib.SOURCE_REMOVE;
                });
    }
};
Signals.addSignalMethods(IBusManager.prototype);
