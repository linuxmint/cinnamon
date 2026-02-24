// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const ByteArray = imports.byteArray;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Signals = imports.signals;

const Config = imports.misc.config;
const ScreenShield = imports.ui.screensaver.screenShield;

const SIGTERM = 15;

var AuthClient = class {
    constructor() {
        this.reset();
    }

    reset() {
        this.initialized = false;
        this.cancellable = null;
        this.proc = null;
        this.in_pipe = null;
        this.out_pipe = null;
    }

    initialize() {
        if (this.initialized)
            return true;

        this.cancellable = new Gio.Cancellable();

        try {
            let helper_path = GLib.build_filenamev([Config.LIBEXECDIR, 'cinnamon-screensaver-pam-helper']);

            let argv = [helper_path];
            let flags = Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE;

            if (ScreenShield._debug) {
                argv.push('--debug');
            } else {
                flags |= Gio.SubprocessFlags.STDERR_SILENCE;
            }

            this.proc = Gio.Subprocess.new(argv, flags);
        } catch (e) {
            global.logError('authClient: error starting cinnamon-screensaver-pam-helper: ' + e.message);
            return false;
        }

        this.proc.wait_check_async(this.cancellable, this._onProcCompleted.bind(this));

        this.out_pipe = this.proc.get_stdout_pipe();
        this.in_pipe = this.proc.get_stdin_pipe();

        this.initialized = true;

        this._readMessages();

        return true;
    }

    cancel() {
        this._endProc();
    }

    _endProc() {
        if (this.cancellable == null)
            return;

        this.cancellable.cancel();
        if (this.proc != null) {
            this.proc.send_signal(SIGTERM);
        }

        this.reset();
    }

    _onProcCompleted(proc, res) {
        try {
            proc.wait_check_finish(res);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                global.logError('helper process did not exit cleanly: ' + e.message);
            }
        }

        let pipe = proc.get_stdin_pipe();
        if (pipe != null) {
            try {
                pipe.close(null);
            } catch (e) {
                // Ignore pipe close errors
            }
        }

        pipe = proc.get_stdout_pipe();
        if (pipe != null) {
            try {
                pipe.close(null);
            } catch (e) {
                // Ignore pipe close errors
            }
        }

        // Don't just reset - if another proc has been started we don't want to interfere.
        if (this.proc == proc) {
            this.reset();
        }
    }

    sendPassword(password) {
        if (!this.initialized)
            return;

        if (this.cancellable == null || this.cancellable.is_cancelled())
            return;

        try {
            let bytes = ByteArray.fromString(password + '\n');
            let gbytes = GLib.Bytes.new(bytes);
            this.in_pipe.write_bytes(gbytes, this.cancellable);
            this.in_pipe.flush(this.cancellable);
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                global.logError('Error writing to pam helper: ' + e.message);
            }
        }
    }

    _readMessages() {
        if (this.cancellable == null || this.cancellable.is_cancelled())
            return;

        this.out_pipe.read_bytes_async(1024, GLib.PRIORITY_DEFAULT, this.cancellable, this._onMessageFromHelper.bind(this));
    }

    _onMessageFromHelper(pipe, res) {
        if (this.cancellable == null || this.cancellable.is_cancelled())
            return;

        let terminate = false;

        try {
            let bytes_read = pipe.read_bytes_finish(res);

            if (!bytes_read || bytes_read.get_size() === 0) {
                global.logWarning('authClient: PAM helper pipe returned no data, helper may have died');
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    this.emit('auth-cancel');
                    return GLib.SOURCE_REMOVE;
                });
                this._endProc();
                return;
            }

            if (bytes_read.get_size() > 0) {
                let raw_string = ByteArray.toString(bytes_read.toArray());
                let lines = raw_string.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    let output = lines[i];
                    if (output.length > 0) {
                        if (ScreenShield._debug)
                            global.log(`authClient: received: '${output}'`);

                        if (output === 'CS_PAM_AUTH_FAILURE') {
                            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                                this.emit('auth-failure');
                                return GLib.SOURCE_REMOVE;
                            });
                        } else if (output === 'CS_PAM_AUTH_SUCCESS') {
                            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                                this.emit('auth-success');
                                return GLib.SOURCE_REMOVE;
                            });
                            terminate = true;
                        } else if (output === 'CS_PAM_AUTH_CANCELLED') {
                            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                                this.emit('auth-cancel');
                                return GLib.SOURCE_REMOVE;
                            });
                            terminate = true;
                        } else if (output === 'CS_PAM_AUTH_BUSY_TRUE') {
                            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                                this.emit('auth-busy', true);
                                return GLib.SOURCE_REMOVE;
                            });
                        } else if (output === 'CS_PAM_AUTH_BUSY_FALSE') {
                            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                                this.emit('auth-busy', false);
                                return GLib.SOURCE_REMOVE;
                            });
                        } else if (output.startsWith('CS_PAM_AUTH_SET_PROMPT_')) {
                            let match = output.match(/^CS_PAM_AUTH_SET_PROMPT_(.*)_$/);
                            if (match && match[1]) {
                                let prompt = match[1];
                                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                                    this.emit('auth-prompt', prompt);
                                    return GLib.SOURCE_REMOVE;
                                });
                            }
                        } else if (output.startsWith('CS_PAM_AUTH_SET_ERROR_')) {
                            let match = output.match(/^CS_PAM_AUTH_SET_ERROR_(.*)_$/);
                            if (match && match[1]) {
                                let error = match[1];
                                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                                    this.emit('auth-error', error);
                                    return GLib.SOURCE_REMOVE;
                                });
                            }
                        } else if (output.startsWith('CS_PAM_AUTH_SET_INFO_')) {
                            let match = output.match(/^CS_PAM_AUTH_SET_INFO_(.*)_$/);
                            if (match && match[1]) {
                                let info = match[1];
                                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                                    this.emit('auth-info', info);
                                    return GLib.SOURCE_REMOVE;
                                });
                            }
                        }
                    }
                }
            }
        } catch (e) {
            if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED)) {
                global.logError('Error reading message from pam helper: ' + e.message);
            }
            return;
        }

        if (terminate) {
            this._endProc();
            return;
        }

        this._readMessages();
    }
}
Signals.addSignalMethods(AuthClient.prototype);
