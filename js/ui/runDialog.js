// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Pango = imports.gi.Pango;
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

const NAVIGATE_TYPE_NONE = 0;
const NAVIGATE_TYPE_TAB = 1;
const NAVIGATE_TYPE_ARROW = 2;

const UP = 1;
const DOWN = 2;

const DEVEL_COMMANDS = { 'lg': x => Main.createLookingGlass().open(),
                         'r': x => Main.restartCinnamon(true),
                         'restart': x => Main.restartCinnamon(true),
                         'debugexit': x => Meta.quit(Meta.ExitCode.ERROR),
                         'rt': x => Main.themeManager._changeTheme() };

/* The modal dialog parent class has a 100ms close animation.  Delay long enough for it
 * to complete before doing something disruptive like restarting cinnamon */
const DEVEL_COMMAND_DELAY =  parseInt(ModalDialog.OPEN_AND_CLOSE_TIME * 1000) + 10;

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

        global.display.connect('restart', () => this.close());

        let label = new St.Label({ style_class: 'run-dialog-label',
                                   text: _("Enter a command") });

        this.contentLayout.set_width(350);

        this.contentLayout.add(label, { x_align: St.Align.MIDDLE });

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

        let defaultDescriptionText = _("Press ESC to close");

        this._descriptionLabel = new St.Label({ style_class: 'run-dialog-description',
                                                text:        defaultDescriptionText });
        this._descriptionLabel.clutter_text.line_wrap = true;
        this._descriptionLabel.clutter_text.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);
        this.contentLayout.add(this._descriptionLabel, { y_align: St.Align.MIDDLE });

        this._commandError = false;

        this._entryText.connect('key-press-event', Lang.bind(this, this._onKeyPress));

        this._history = new History.HistoryManager({ gsettingsKey: HISTORY_KEY,
                                                     entry: this._entryText,
                                                     deduplicate: true });

        this._updateCompletionTimer = 0;
     },

    _onKeyPress: function (o, e) {
        let symbol = e.get_key_symbol();
        if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
            if (o.get_text().trim() == "") {
                return false;
            }

            /* When enter is hit with completions open, if the current selection
             * is a folder, open that folder immediately.  Otherwise, just close
             * the completion box - the user can add an argument to the command
             * they selected (there's already a space provided) */
            if (this._completionBox.visible && !o.get_text().endsWith("/")) {
                this._completionSelected = 0;
                this._completionBox.hide();
                this._entryText.set_selection_bound(-1);
                this._entryText.set_cursor_position(-1);
                this._oldText = "";
                return true;
            }

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
        if (symbol === Clutter.KEY_Escape || symbol === Clutter.KEY_Super_L || symbol === Clutter.KEY_Super_R) {
            this.close();
            return true;
        }
        if (symbol === Clutter.KEY_Tab) {
            this._updateCompletions(NAVIGATE_TYPE_TAB);
            return true;
        }

        if (this._completionBox.visible) {
            if (symbol === Clutter.KEY_Up) {
                this._updateCompletions(NAVIGATE_TYPE_ARROW, UP);
                return true;
            } else if (symbol === Clutter.KEY_Down) {
                this._updateCompletions(NAVIGATE_TYPE_ARROW, DOWN);
                return true;
            }
        }

        if (symbol === Clutter.KEY_BackSpace) {
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
    _updateCompletions: function(nav_type=NAVIGATE_TYPE_NONE, direction=DOWN) {
        this._updateCompletionTimer = 0;

        let text = this._expandHome(this._entryText.get_text());

        /* If update is caused by user pressing key, and the user just finished
         * a directory path, don't provide new predictions. For example, the
         * user might have asked for completions when typing /home/us.
         * Completions provided might be /home/user/ and /home/user2/.
         *
         * If user later types "er/" and the text is now /home/user/, then do
         * not perform completions, since completions will list all files in
         * /home/user/, which is unexpected.
         */
        if (!nav_type && text.charAt(text.length - 1) == "/") {
            this._completionBox.hide();
            this._oldText = "";
            return;
        }

        // Currnet suggested completion is selected. Do not include in query.
        text = text.slice(0, text.lastIndexOf(this._entryText.get_selection()));

        /* If update is caused by user typing "tab" and no text has changed
         * since then, cycle through available completions.
         */
        if (this._oldText == text && nav_type && this._completionBox.visible) {
            if ((nav_type == NAVIGATE_TYPE_ARROW && direction == DOWN) || nav_type == NAVIGATE_TYPE_TAB) {
                this._completionSelected ++;
                this._completionSelected %= this._completions.length;
                this._showCompletions(text);
                return;
            } else { // nav_type was > 0 and not tab, and not down, so navigate UP.
                if (this._completionSelected > 0) {
                    this._completionSelected --;
                }

                this._showCompletions(text);
                return;
            }
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
        if (postfix.length > 0 && nav_type == NAVIGATE_TYPE_TAB) {
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

    _expandHome: function(text) {
        if (text.charAt(0) == '~') {
            text = text.slice(1);
            return GLib.build_filenamev([GLib.get_home_dir(), text]);
        }

        return text;
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
        input = input.trim();
        this._history.addItem(input);
        this._commandError = false;
        if (this._enableInternalCommands && input in DEVEL_COMMANDS) {
            Mainloop.timeout_add(DEVEL_COMMAND_DELAY, ()=>DEVEL_COMMANDS[input]());
            return;
        }

        input = this._expandHome(input);

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
            Util.spawnCommandLineAsync(command, null, null);
        } catch (e) {
            // Mmmh, that failed - see if @input matches an existing file
            let path = null;

            if (input.charAt(0) == '/') {
                path = input;
            } else {
                path = GLib.build_filenamev([GLib.get_home_dir(), input]);
            }

            if (path && GLib.file_test(path, GLib.FileTest.EXISTS)) {
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

        this._descriptionLabel.set_text(message.trim());
        this._descriptionLabel.add_style_class_name('error');
    },

    open: function() {
        this._history.lastItem();
        this._descriptionLabel.set_text(_("Press ESC to close"));
        this._descriptionLabel.remove_style_class_name('error');
        this._entryText.set_text('');
        this._completionBox.hide();
        this._commandError = false;

        if (this._lockdownSettings.get_boolean(DISABLE_COMMAND_LINE_KEY))
            return;

        ModalDialog.ModalDialog.prototype.open.call(this);
    },
};
Signals.addSignalMethods(RunDialog.prototype);
