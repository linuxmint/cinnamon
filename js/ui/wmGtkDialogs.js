// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { Clutter, Gio, GLib, GObject, Meta, St } = imports.gi;

const SIGTERM = 15;

var DisplayChangesDialog = class {
    constructor(wm) {
        this._wm = wm;
        this._countDown = Meta.MonitorManager.get_display_configuration_timeout();
    }

    open() {
        try {
            this.proc = Gio.Subprocess.new(
                [
                "cinnamon-display-changes-dialog",
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


var CloseDialog = GObject.registerClass({
    Implements: [Meta.CloseDialog],
    Properties: {
        'window': GObject.ParamSpec.override('window', Meta.CloseDialog),
    },
}, class CloseDialog extends GObject.Object {
    _init(window) {
        super._init();
        this._window = window;

        this.proc = null;
    }

    vfunc_show() {
        try {
            this.proc = Gio.Subprocess.new(
                [
                "cinnamon-close-dialog",
                 global.screen.get_xwindow_for_window(this._window).toString(),
                 this._window.get_title()
                ],
                0);

            this.proc.wait_async(null, this._wait_finish.bind(this));
        } catch (e) {
            global.logWarning(`Could not spawn kill dialog: ${e}`);

            this.proc = null;
            this.response(Meta.CloseDialogResponse.WAIT);
        }
    }

    _wait_finish(proc, result) {
        try {
            this.proc.wait_finish(result);
        } catch (e) {
            global.logWarning(`Something went wrong with kill dialog: ${e}`);
        }

        if (this.proc.get_status() == 0) {
            this.response(Meta.CloseDialogResponse.FORCE_CLOSE);
        } else {
            this.response(Meta.CloseDialogResponse.WAIT);
        }
    }

    vfunc_hide() {
        if (this.proc === null) {
            return;
        }

        this.proc.send_signal(SIGTERM);
    }

    vfunc_focus() {
    }
});

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