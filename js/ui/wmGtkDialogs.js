// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;

const SIGTERM = 15;

var HoverClickHelper = class {
    constructor(wm) {
        this.proc = null;
    }

    set_active(active) {
        if (active) {
            this.open();
        } else {
            this.close();
        }
    }

    open() {
        try {
            this.proc = Gio.Subprocess.new(
                [
                "cinnamon-hover-click"
                ],
                0);

            this.proc.wait_async(null, this._wait_finish.bind(this));
        } catch (e) {
            global.logWarning(`Could not spawn hover click window: ${e}`);

            this.proc = null;
        }
    }

    close() {
        if (this.proc !== null) {
            this.proc.send_signal(SIGTERM);
        }
    }

    _wait_finish(proc, result) {
        try {
            this.proc.wait_finish(result);
        } catch (e) {
            global.logWarning(`Problem with hover click window: ${e}`);
        }

        this.proc = null;
    }


};