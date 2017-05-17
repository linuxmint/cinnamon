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
const ALIASES_KEY = 'run-dialog-aliases';

const DIALOG_GROW_TIME = 0.1;
const MAX_COMPLETIONS = 40;

const DEVEL_COMMANDS = { 'lg': x => Main.createLookingGlass().open(),
                         'r': x => global.reexec_self(),
                         'restart': x => global.reexec_self(),
                         'debugexit': x => Meta.quit(Meta.ExitCode.ERROR),
                         'rt': x => Main.themeManager._changeTheme() };

/**
 * completeCommand:
 * @text (string): initial string to complete.
 *
 * This function finds possible command completions for @text. @text is first
 * split at whitspaces, and completion is performed on the last segment. Note
 * that this currently does not recognize escaped whitspaces.
 *
 * If the last segment starts with a `/`, then it is considered to be an
 * absolute path. Otherwise, if it is the first segment (ie. there is only one
 * segment), it will be treated as a path relative to the home directory or a
 * path relative to an element of `PATH`.  Finally, if it is not an absolute
 * path and not a first segment, it will be treated as a path relative to the
 * home directory.
 *
 * To perform the completion, first the directory of the last segment is
 * calculated. For example, if the last segment is `/foo/bar/hel`, then the
 * directory is `/foo/bar/`. Then everything in the directory is listed, and
 * it checks which items starts with `hel`. All the items will then be listed
 * in the `completions` array. The common part of all possible completions is
 * put in the `postfix` variable, and the tuple `[postfix, completions]` is
 * returned.
 *
 * It is important to note that the returned variables are just the part added
 * by completion. So if `/foo/bar/hel` completes to `/foo/bar/hello`, then `lo`
 * is returned, instead of `/foo/bar/hello`. This is the case for both the
 * `postfix` and `completions` part.
 *
 * A special case is when the last segment is empty. In this case, an empty
 * tuple is returned.
 *
 * Returns (array): The tuple `[postfix, completions]`.
 */
function completeCommand(text) {
    // Replace an escaped space "\ " with a random unicode character, find the
    // last space, and then restore "\ " since we don't want to split at escaped strings
    let last = text.replace(/\\ /g, '\uf001').match(/[^ ]*$/)[0].replace(/\uf001/g, '\\ ');
    if (last.length == 0)
        return ["",[]];

    let last_path = last.replace(/[^/]*$/, "");
    let paths = [];
    if (last.charAt(0) == '/') {
        // Match absolute path
        paths = [last_path];
    } else if (last.length != text.length) {
        // Match filename in home directory
        paths = [GLib.build_filenamev([GLib.get_home_dir(), last_path])];
    } else {
        // Match file in path or home directory
        paths = GLib.getenv('PATH').split(':');
        paths.push(GLib.get_home_dir());
        paths = paths.map(x => GLib.build_filenamev([x, last_path]));
    }

    let results = [];
    paths.forEach(function(path) {
        try {
            let file = Gio.File.new_for_path(path);
            let fileEnum = file.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
            let info;

            while ((info = fileEnum.next_file(null))) {
                let name = last_path + info.get_name();
                // Escape strings
                name = name.replace(/ /g, "\\ ")

                if (info.get_file_type() == Gio.FileType.DIRECTORY)
                    name += "/";
                else
                    name += " ";

                if (name.slice(0, last.length) == last)
                    results.push(name);
            }
        } catch (e) {
        }
    });

    if (results.length == 0) return ["", []];

    let common = results.reduce(function(s1, s2) {
        let k = last.length;
        let max = Math.min(s1.length, s2.length);

        while (k < max && s1[k] == s2[k]) k++;

        return s1.substr(0, k);
    });

    return [common.substring(last.length, common.length), results.map(x => x.substring(last.length, x.length))];
}

function RunDialog() {
    this._init();
}

RunDialog.prototype = {
__proto__: ModalDialog.ModalDialog.prototype,
    _init : function() {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'run-dialog' });

        this._lockdownSettings = new Gio.Settings({ schema_id: LOCKDOWN_SCHEMA });
        this._terminalSettings = new Gio.Settings({ schema_id: TERMINAL_SCHEMA });
        global.settings.connect('changed::development-tools', Lang.bind(this, function () {
            this._enableInternalCommands = global.settings.get_boolean('development-tools');
        }));
        this._enableInternalCommands = global.settings.get_boolean('development-tools');

        let label = new St.Label({ style_class: 'run-dialog-label',
                                   text: _("Please enter a command:") });

        this.contentLayout.add(label, { y_align: St.Align.START });

        let entry = new St.Entry({ style_class: 'run-dialog-entry' });
        CinnamonEntry.addContextMenu(entry);

        entry.label_actor = label;

        this._entryText = entry.clutter_text;
        this._oldText = "";
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

        this._history = new History.HistoryManager({ gsettingsKey: HISTORY_KEY,
                                                     entry: this._entryText,
                                                     deduplicate: true });
        this._entryText.connect('key-press-event', Lang.bind(this, this._onKeyPress));

        this._updateCompletionTimer = 0;
     },

    _onKeyPress: function (o, e) {
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
        if (symbol == Clutter.Tab) {
            this._updateCompletions(true);
            return true;
        }
        if (symbol == Clutter.BackSpace) {
            this._completionSelected = 0;
            this._completionBox.hide();
            this._oldText = "";
        }
        if (this._completionBox.get_text() != "" &&
                this._completionBox.visible) {
            if (this._updateCompletionTimer) {
                Mainloop.source_remove(this._updateCompletionTimer);
                this._updateCompletionTimer = 0;
            }

            this._updateCompletionTimer = Mainloop.timeout_add(200, Lang.bind(this, this._updateCompletions));
            return false;
        }
        return false;
    },

    // There is different behaviour depending on whether this is called due to
    // pressing tab or other keys.
    _updateCompletions: function(tab) {
        this._updateCompletionTimer = 0;

        let text = this._entryText.get_text();

        /* If update is caused by user pressing key, and the user just finished
         * a directory path, don't provide new predictions. For example, the
         * user might have asked for completions when typing /home/us.
         * Completions provided might be /home/user/ and /home/user2/.
         *
         * If user later types "er/" and the text is now /home/user/, then do
         * not perform completions, since completions will list all files in
         * /home/user/, which is unexpected.
         */
        if (!tab && text.charAt(text.length - 1) == "/") {
            this._completionBox.hide();
            this._oldText = "";
            return;
        }

        // Currnet suggested completion is selected. Do not include in query.
        text = text.slice(0, text.lastIndexOf(this._entryText.get_selection()));

        /* If update is caused by user typing "tab" and no text has changed
         * since then, cycle through available completions.
         */
        if (this._oldText == text && tab && this._completionBox.visible) {
            this._completionSelected ++;
            this._completionSelected %= this._completions.length;
            this._showCompletions(text);
            return;
        }
        this._oldText = text;

        let [postfix, completions] = completeCommand(text);
        // Keep completions to use for when scrolling, since reading filesystem
        // every time we scroll lags a lot.
        this._completions = completions;

        /* If tab is pressed and there is a common part among all possible
         * completions, append that common part and stop. Otherwise, list all
         * possible completions. If there is no possible completion, then hide
         * completion box.
         */
        if (postfix.length > 0 && tab) {
            this._entryText.set_text(text + postfix);
        } else if (completions.length > 0 &&
                global.settings.get_boolean(SHOW_COMPLETIONS_KEY)) {
            this._completionSelected = 0;
            this._completionBox.show();
            this._showCompletions(text);
        } else {
            this._completionBox.hide();
            this._oldText = "";
        }
    },

    _showCompletions: function(orig) {
        /* Show a list of possible completions, and allow users to scroll
         * through them. The scrolling mechanism is done in _updateCompletions,
         * which provides the current selected index in
         * this._completionSelected. We simply have to mark this bold in our
         * list to denote selection, and display it in the entryText (and
         * select it).
         *
         * Show at most MAX_COMPLETIONS=40 completions. If there are too many,
         * replace with "...", and display only the 40 elements near the
         * current item. The current item should be 5 items away from the
         * bottom of the list if possible.
         */

        let text = "";
        let i = Math.max(0, Math.min(this._completionSelected - MAX_COMPLETIONS + 5, this._completions.length - MAX_COMPLETIONS));
        let end = Math.min(i + MAX_COMPLETIONS, this._completions.length);

        if (i > 0) {
            text = "...\n";
            i++;
        }

        if (end < this._completions.length)
            end--;

        for (; i < end; i++) {
            if (i == this._completionSelected) {
                text = text + "<b>" + orig + this._completions[i] + "</b>" + "\n";
                this._entryText.set_text(orig + this._completions[i]);
            } else {
                text = text + orig + this._completions[i] + "\n";
            }
        }

        if (end < this._completions.length)
            text += "...\n";

        this._completionBox.clutter_text.set_markup(text);
        this._entryText.set_selection(-1, orig.length);
    },

    _run : function(input, inTerminal) {
        this._history.addItem(input);
        this._commandError = false;
        if (this._enableInternalCommands && input.trim() in DEVEL_COMMANDS) {
            DEVEL_COMMANDS[input.trim()]();
            return;
        }

        // Aliases is a list of strings of the form a:b, where an instance of
        // "a" is to be replaced with "b". Replacement is only performed on the
        // first word
        let aliases = global.settings.get_strv(ALIASES_KEY);
        let split = input.split(" ");
        for (let i = 0; i < aliases.length; i++) {
            if (split[0] == aliases[i].split(":")[0]) {
                split[0] = aliases[i].split(":")[1];
                break;
            }
        }
        let command = split.join(" ");

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
            input = input.trim();
            if (input.charAt(0) == '/') {
                path = input;
            } else {
                if (input.charAt(0) == '~')
                    input = input.slice(1);
                path = GLib.build_filenamev([GLib.get_home_dir(), input]);
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
