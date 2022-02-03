// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported CloseDialog */

const { Gio, GObject, Meta } = imports.gi;

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

        this.proc.send_signal(15);
    }

    vfunc_focus() {
    }
});
