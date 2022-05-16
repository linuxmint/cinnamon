// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { Gio, GObject, Meta } = imports.gi;

class DisplayChangesDialog {
    constructor(wm) {
        this._wm = wm;
        this._countDown = Meta.MonitorManager.get_display_configuration_timeout();
    }

    open() {
        try {
            this.proc = Gio.Subprocess.new(
                [
                "cinnamon-confirm-display-change-dialog",
                 this._countDown.toString()
                ],
                0);

            this.proc.wait_async(null, this._wait_finish.bind(this));
        } catch (e) {
            global.logWarning(`Could not spawn display dialog: ${e}`);

            this.proc = null;
            this._revert();
        }
    }

    _wait_finish(proc, result) {
        try {
            this.proc.wait_finish(result);
        } catch (e) {
            global.logWarning(`Something went wrong with display dialog: ${e}`);
            this._revert();
        }

        if (this.proc.get_status() == 0) {
            this._keep();
        } else {
            this._revert()
        }
    }

    _revert() {
        log("Reverting display changes");
        this._wm.complete_display_change(false);
    }

    _keep() {
        log("Confirm display changes");
        this._wm.complete_display_change(true);
    }
};
