// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cinnamon = imports.gi.Cinnamon;
const Meta = imports.gi.Meta;
const Signals = imports.signals;
const Gio = imports.gi.Gio;
const Main = imports.ui.main;

var ScreenRecorder = class ScreenRecorder {
    constructor() {
        this.recorder = null;
        this.recorderSettings = new Gio.Settings({ schema_id: 'org.cinnamon.recorder' });

        Meta.keybindings_set_custom_handler('toggle-recording', () => this.toggle_recording());
    }

    get recording() {
        if (this.recorder === null) {
            return false;
        }
        return this.recorder.is_recording();
    }

    set recording(record) {
        if (record) {
            this._start_recording();
        }
        else
        {
            this._stop_recording();
        }
    }

    _ensure_recorder() {
        if (this.recorder === null) {
            this.recorder = new Cinnamon.Recorder({ stage: global.stage, display: global.display });
        }
    }

    _start_recording() {
        this._ensure_recorder();

        if (this.recorder.is_recording()) {
            return;
        }

        // read the parameters from GSettings always in case they have changed
        this.recorder.set_framerate(this.recorderSettings.get_int('framerate'));
        this.recorder.set_file_template('cinnamon-%Y-%m-%dT%H%M%S%z.' + this.recorderSettings.get_string('file-extension'));
        let pipeline = this.recorderSettings.get_string('pipeline');

        if (Main.layoutManager.monitors.length > 1) {
            let {x, y, width, height} = Main.layoutManager.primaryMonitor;
            this.recorder.set_area(x, y, width, height);
        }

        if (!pipeline.match(/^\s*$/))
            this.recorder.set_pipeline(pipeline);
        else
            this.recorder.set_pipeline(null);

        Meta.disable_unredirect_for_display(global.display);
        this.recorder.record();

        this.emit("recording", true);
    }

    _stop_recording() {
        if (this.recorder === null) {
            return;
        }

        if (this.recorder.is_recording()) {
            this.recorder.close();
            Meta.enable_unredirect_for_display(global.display);
        }

        this.emit("recording", false);
    }

    toggle_recording() {
        if (this.recording) {
            this._stop_recording();
        }
        else
        {
            this._start_recording();
        }
    }
}
Signals.addSignalMethods(ScreenRecorder.prototype);
