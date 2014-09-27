// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;

const FileUtils = imports.misc.fileUtils;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const CinnamonEntry = imports.ui.cinnamonEntry;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;
const History = imports.misc.history;

const MAX_FILE_DELETED_BEFORE_INVALID = 10;

const HISTORY_KEY = 'command-history';

const LOCKDOWN_SCHEMA = 'org.cinnamon.desktop.lockdown';
const DISABLE_COMMAND_LINE_KEY = 'disable-command-line';

const TERMINAL_SCHEMA = 'org.cinnamon.desktop.default-applications.terminal';
const EXEC_KEY = 'exec';
const EXEC_ARG_KEY = 'exec-arg';

const SHOW_COMPLETIONS_KEY = 'run-dialog-show-completions';

const DIALOG_GROW_TIME = 0.1;

function CommandCompleter() {
    this._init();
}

CommandCompleter.prototype = {
    _init : function() {
        this._changedCount = 0;
        this._paths = GLib.getenv('PATH').split(':');
        this._paths.push(GLib.get_home_dir());
        this._valid = false;
        this._updateInProgress = false;
        this._childs = new Array(this._paths.length);
        this._monitors = new Array(this._paths.length);
        for (let i = 0; i < this._paths.length; i++) {
            this._childs[i] = [];
            let file = Gio.file_new_for_path(this._paths[i]);
            let info;
            try {
                info = file.query_info(Gio.FILE_ATTRIBUTE_STANDARD_TYPE, Gio.FileQueryInfoFlags.NONE, null);
            } catch (e) {
                // FIXME catchall
                this._paths[i] = null;
                continue;
            }

            if (info.get_attribute_uint32(Gio.FILE_ATTRIBUTE_STANDARD_TYPE) != Gio.FileType.DIRECTORY)
                continue;

            this._paths[i] = file.get_path();
            this._monitors[i] = file.monitor_directory(Gio.FileMonitorFlags.NONE, null);
            if (this._monitors[i] != null) {
                this._monitors[i].connect('changed', Lang.bind(this, this._onChanged));
            }
        }
        this._paths = this._paths.filter(function(a) {
            return a != null;
        });
        this._update(0);
    },

    update : function() {
        if (this._valid)
            return;
        this._update(0);
    },

    _update : function(i) {
        if (i == 0 && this._updateInProgress)
            return;
        this._updateInProgress = true;
        this._changedCount = 0;
        this._i = i;
        if (i >= this._paths.length) {
            this._valid = true;
            this._updateInProgress = false;
            return;
        }
        let file = Gio.file_new_for_path(this._paths[i]);
        this._childs[this._i] = [];
        FileUtils.listDirAsync(file, Lang.bind(this, function (files) {
            for (let i = 0; i < files.length; i++) {
                this._childs[this._i].push(files[i].get_name());
            }
            this._update(this._i + 1);
        }));
    },

    _onChanged : function(m, f, of, type) {
        if (!this._valid)
            return;
        let path = f.get_parent().get_path();
        let k = undefined;
        for (let i = 0; i < this._paths.length; i++) {
            if (this._paths[i] == path)
                k = i;
        }
        if (k === undefined) {
            return;
        }
        if (type == Gio.FileMonitorEvent.CREATED) {
            this._childs[k].push(f.get_basename());
        }
        if (type == Gio.FileMonitorEvent.DELETED) {
            this._changedCount++;
            if (this._changedCount > MAX_FILE_DELETED_BEFORE_INVALID) {
                this._valid = false;
            }
            let name = f.get_basename();
            this._childs[k] = this._childs[k].filter(function(e) {
                return e != name;
            });
        }
        if (type == Gio.FileMonitorEvent.UNMOUNTED) {
            this._childs[k] = [];
        }
    },

    getCompletion: function(text) {
        let common = '';
        let notInit = true;
        let completions = [];

        if (!this._valid) {
            this._update(0);
            return common;
        }
        function _getCommon(s1, s2) {
            for (var k = 0; k < s1.length && k < s2.length; k++) {
                if (s1[k] != s2[k])
                    break;
            }
            if (k == 0)
                return '';
            return s1.substr(0, k);
        }
        function _hasPrefix(s1, prefix) {
            return s1.indexOf(prefix) == 0;
        }
        for (let i = 0; i < this._childs.length; i++) {
            for (let k = 0; k < this._childs[i].length; k++) {
                if (!_hasPrefix(this._childs[i][k], text))
                    continue;
                if (notInit) {
                    common = this._childs[i][k];
                    notInit = false;
                }
                common = _getCommon(common, this._childs[i][k]);
                if (completions.indexOf(this._childs[i][k]) == -1) // Don't add duplicates
                    completions.push(this._childs[i][k]);
            }
        }
        if (common.length)
            return [common.substr(text.length).replace(/ /g, "\\ "), completions];
        return [common, completions];
    }
};

function RunDialog() {
    this._init();
}

RunDialog.prototype = {
__proto__: ModalDialog.ModalDialog.prototype,
    _init : function() {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'run-dialog' });

        this._lockdownSettings = new Gio.Settings({ schema: LOCKDOWN_SCHEMA });
        this._terminalSettings = new Gio.Settings({ schema: TERMINAL_SCHEMA });
        global.settings.connect('changed::development-tools', Lang.bind(this, function () {
            this._enableInternalCommands = global.settings.get_boolean('development-tools');
        }));
        this._enableInternalCommands = global.settings.get_boolean('development-tools');

        this._internalCommands = { 'lg':
                                   Lang.bind(this, function() {
                                       Main.createLookingGlass().open();
                                   }),

                                   'r': Lang.bind(this, function() {
                                       global.reexec_self();
                                   }),

                                   // Developer brain backwards compatibility
                                   'restart': Lang.bind(this, function() {
                                       global.reexec_self();
                                   }),

                                   'debugexit': Lang.bind(this, function() {
                                       Meta.quit(Meta.ExitCode.ERROR);
                                   }),

                                   // rt is short for "reload theme"
                                   'rt': Lang.bind(this, function() {
                                       Main.themeManager._changeTheme();
                                   })
                                 };


        let label = new St.Label({ style_class: 'run-dialog-label',
                                   text: _("Please enter a command:") });

        this.contentLayout.add(label, { y_align: St.Align.START });

        let entry = new St.Entry({ style_class: 'run-dialog-entry' });
        CinnamonEntry.addContextMenu(entry);

        entry.label_actor = label;

        this._entryText = entry.clutter_text;
        this.contentLayout.add(entry, { y_align: St.Align.START });
        this.setInitialKeyFocus(this._entryText);

        this._completionBox = new St.Label({style_class: 'run-dialog-completion-box'});
        this.contentLayout.add(this._completionBox);
        this._completionSelected = 0;

        this._errorBox = new St.BoxLayout({ style_class: 'run-dialog-error-box' });

        this.contentLayout.add(this._errorBox, { expand: true });

        let errorIcon = new St.Icon({ icon_name: 'dialog-error', icon_size: 24, style_class: 'run-dialog-error-icon' });

        this._errorBox.add(errorIcon, { y_align: St.Align.MIDDLE });

        this._commandError = false;

        this._errorMessage = new St.Label({ style_class: 'run-dialog-error-label' });
        this._errorMessage.clutter_text.line_wrap = true;

        this._errorBox.add(this._errorMessage, { expand: true,
                                                 y_align: St.Align.MIDDLE,
                                                 y_fill: false });

        this._errorBox.hide();

        this._pathCompleter = new Gio.FilenameCompleter();
        this._commandCompleter = new CommandCompleter();
        this._group.connect('notify::visible', Lang.bind(this._commandCompleter, this._commandCompleter.update));

        this._history = new History.HistoryManager({ gsettingsKey: HISTORY_KEY,
                                                     entry: this._entryText,
                                                     deduplicate: true });
        this._entryText.connect('key-press-event', Lang.bind(this, function(o, e) {
            let symbol = e.get_key_symbol();
            if (symbol == Clutter.Return || symbol == Clutter.KP_Enter) {
                this.popModal();
                if (Cinnamon.get_event_state(e) & Clutter.ModifierType.CONTROL_MASK)
                    this._run(o.get_text(), true);
                else
                    this._run(o.get_text(), false);
                if (!this._commandError)
                    this.close();
                else {
                    if (!this.pushModal())
                        this.close();
                }
                return true;
            }
            if (symbol == Clutter.Escape) {
                this.close();
                return true;
            }
            if (symbol == Clutter.slash) {
                // Need preload data before get completion. GFilenameCompleter load content of parent directory.
                // Parent directory for /usr/include/ is /usr/. So need to add fake name('a').
                let text = o.get_text().concat('/a');
                let prefix;
                if (text.lastIndexOf(' ') == -1)
                    prefix = text;
                else
                    prefix = text.substr(text.lastIndexOf(' ') + 1);
                this._getCompletion(prefix);
                return false;
            }
            if (symbol == Clutter.Tab) {
                let text = o.get_text();
                text = text.slice(0, text.lastIndexOf(o.get_selection()));
                let prefix;
                if (text.lastIndexOf(' ') == -1)
                    prefix = text;
                else
                    prefix = text.substr(text.lastIndexOf(' ') + 1);
                let [postfix, completions] = this._getCompletion(prefix);
                if (postfix != null && postfix.length > 0) {
                    if (o.get_text() == prefix + postfix) {
                        o.set_selection(o.get_text().length, o.get_text().length);
                    } else {
                        o.insert_text(postfix, -1);
                        o.set_cursor_position(text.length + postfix.length);
                        if (postfix[postfix.length - 1] == '/')
                            this._getCompletion(text + postfix + 'a');
                    }
                }
                if (!postfix && completions.length > 0 && prefix.length > 2 &&
                    global.settings.get_boolean(SHOW_COMPLETIONS_KEY)) {
                    if (this._completionBox.visible) {
                        this._completionSelected ++;
                        this._completionSelected %= completions.length;
                    }
                    this._showCompletions(completions, prefix.length);
                    this._completionBox.show();
                }
                return true;
            }
            if (symbol == Clutter.BackSpace) {
                this._completionSelected = 0;
                this._completionBox.hide();
            }
            if (this._completionBox.get_text() != "" &&
                this._completionBox.visible) {
                Mainloop.timeout_add(500, Lang.bind(this, function() { // Don't do it instantly to avoid "flashing"
                    let text = this._entryText.get_text();
                    text = text.slice(0, text.lastIndexOf(this._entryText.get_selection()));
                    let prefix;
                    if (text.lastIndexOf(' ') == -1)
                        prefix = text;
                    else
                        prefix = text.substr(text.lastIndexOf(' ') + 1);
                    let [postfix, completions] = this._getCompletion(prefix);
                    if (completions.length > 0) {
                        this._completionSelected = 0;
                        this._showCompletions(completions, prefix.length);
                    }
                }));
                return false;
            }
            return false;
        }));
    },

    _showCompletions: function(completions, startpos) {
        let text = "";
        for (let i in completions) {
            if (i == this._completionSelected) {
                text = text + "<b>" + completions[i] + "</b>" + "\n";
                this._entryText.set_text(completions[i]);
            } else {
                text = text + completions[i] + "\n";
            }
        }
        this._completionBox.clutter_text.set_markup(text);
        this._entryText.set_selection(startpos, -1);
    },

    _getCompletion : function(text) {
        if (text.indexOf('/') != -1) {
            return [this._pathCompleter.get_completion_suffix(text), this._pathCompleter.get_completions(text)];
        } else {
            return this._commandCompleter.getCompletion(text);
        }
    },

    _run : function(input, inTerminal) {
        let command = input;

        this._history.addItem(input);
        this._commandError = false;
        let f;
        if (this._enableInternalCommands)
            f = this._internalCommands[input];
        else
            f = null;
        if (f) {
            f();
        } else if (input) {
            try {
                if (inTerminal) {
                    let exec = this._terminalSettings.get_string(EXEC_KEY);
                    let exec_arg = this._terminalSettings.get_string(EXEC_ARG_KEY);
                    command = exec + ' ' + exec_arg + ' ' + input;
                }
                Util.trySpawnCommandLine(command);
            } catch (e) {
                // Mmmh, that failed - see if @input matches an existing file
                let path = null;
                if (input.charAt(0) == '/') {
                    path = input;
                } else {
                    if (input.charAt(0) == '~')
                        input = input.slice(1);
                    path = GLib.get_home_dir() + '/' + input;
                }

                if (GLib.file_test(path, GLib.FileTest.EXISTS)) {
                    let file = Gio.file_new_for_path(path);
                    try {
                        Gio.app_info_launch_default_for_uri(file.get_uri(),
                                                            global.create_app_launch_context());
                    } catch (e) {
                        // The exception from gjs contains an error string like:
                        //     Error invoking Gio.app_info_launch_default_for_uri: No application
                        //     is registered as handling this file
                        // We are only interested in the part after the first colon.
                        let message = e.message.replace(/[^:]*: *(.+)/, '$1');
                        this._showError(message);
                    }
                } else {
                    this._showError(e.message);
                }
            }
        }
    },

    _showError : function(message) {
        this._commandError = true;

        this._errorMessage.set_text(message);

        if (!this._errorBox.visible) {
            let [errorBoxMinHeight, errorBoxNaturalHeight] = this._errorBox.get_preferred_height(-1);

            let parentActor = this._errorBox.get_parent();
            Tweener.addTween(parentActor,
                             { height: parentActor.height + errorBoxNaturalHeight,
                               time: DIALOG_GROW_TIME,
                               transition: 'easeOutQuad',
                               onComplete: Lang.bind(this,
                                                     function() {
                                                         parentActor.set_height(-1);
                                                         this._errorBox.show();
                                                     })
                             });
        }
    },

    open: function() {
        this._history.lastItem();
        this._errorBox.hide();
        this._entryText.set_text('');
        this._completionBox.hide();
        this._commandError = false;

        if (this._lockdownSettings.get_boolean(DISABLE_COMMAND_LINE_KEY))
            return;

        ModalDialog.ModalDialog.prototype.open.call(this);
    },

};
Signals.addSignalMethods(RunDialog.prototype);
