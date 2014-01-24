// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const GLib = imports.gi.GLib;

const Main = imports.ui.main;

// http://daringfireball.net/2010/07/improved_regex_for_matching_urls
const _balancedParens = '\\((?:[^\\s()<>]+|(?:\\(?:[^\\s()<>]+\\)))*\\)';
const _leadingJunk = '[\\s`(\\[{\'\\"<\u00AB\u201C\u2018]';
const _notTrailingJunk = '[^\\s`!()\\[\\]{};:\'\\".,<>?\u00AB\u00BB\u201C\u201D\u2018\u2019]';

const _urlRegexp = new RegExp(
    '(^|' + _leadingJunk + ')' +
    '(' +
        '(?:' +
            '[a-z][\\w-]+://' +                   // scheme://
            '|' +
            'www\\d{0,3}[.]' +                    // www.
            '|' +
            '[a-z0-9.\\-]+[.][a-z]{2,4}/' +       // foo.xx/
        ')' +
        '(?:' +                                   // one or more:
            '[^\\s()<>]+' +                       // run of non-space non-()
            '|' +                                 // or
            _balancedParens +                     // balanced parens
        ')+' +
        '(?:' +                                   // end with:
            _balancedParens +                     // balanced parens
            '|' +                                 // or
            _notTrailingJunk +                    // last non-junk char
        ')' +
    ')', 'gi');

// findUrls:
// @str: string to find URLs in
//
// Searches @str for URLs and returns an array of objects with %url
// properties showing the matched URL string, and %pos properties indicating
// the position within @str where the URL was found.
//
// Return value: the list of match objects, as described above
function findUrls(str) {
    let res = [], match;
    while ((match = _urlRegexp.exec(str)))
        res.push({ url: match[2], pos: match.index + match[1].length });
    return res;
}

// spawn:
// @argv: an argv array
//
// Runs @argv in the background, handling any errors that occur
// when trying to start the program.
function spawn(argv) {
    let pid;

    try {
        pid = trySpawn(argv);
    } catch (err) {
        _handleSpawnError(argv[0], err);
    }

    return pid;
}

// spawnCommandLine:
// @command_line: a command line
//
// Runs @command_line in the background, handling any errors that
// occur when trying to parse or start the program.
function spawnCommandLine(command_line) {
    let pid;

    try {
        let [success, argv] = GLib.shell_parse_argv(command_line);
        pid = trySpawn(argv);
    } catch (err) {
        _handleSpawnError(command_line, err);
    }

    return pid;
}

// trySpawn:
// @argv: an argv array
//
// Runs @argv in the background. If launching @argv fails,
// this will throw an error.
function trySpawn(argv)
{
    try {
        let [success, pid]  = GLib.spawn_async(null, argv, null,
                         GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.STDOUT_TO_DEV_NULL  | GLib.SpawnFlags.STDERR_TO_DEV_NULL,
                         null, null);
        return pid;
    } catch (err) {
        if (err.code == GLib.SpawnError.G_SPAWN_ERROR_NOENT) {
            err.message = _("Command not found");
        } else {
            // The exception from gjs contains an error string like:
            //   Error invoking GLib.spawn_command_line_async: Failed to
            //   execute child process "foo" (No such file or directory)
            // We are only interested in the part in the parentheses. (And
            // we can't pattern match the text, since it gets localized.)
            err.message = err.message.replace(/.*\((.+)\)/, '$1');
        }

        throw err;
    }
}

// trySpawnCommandLine:
// @command_line: a command line
//
// Runs @command_line in the background. If launching @command_line
// fails, this will throw an error.
function trySpawnCommandLine(command_line) {
    let pid;

    try {
        let [success, argv] = GLib.shell_parse_argv(command_line);
        pid = trySpawn(argv); 
    } catch (err) {
        // Replace "Error invoking GLib.shell_parse_argv: " with
        // something nicer
        err.message = err.message.replace(/[^:]*: /, _("Could not parse command:") + "\n");
        throw err;
    }

    return pid;
}

function _handleSpawnError(command, err) {
    let title = _("Execution of '%s' failed:").format(command);
    Main.notifyError(title, err.message);
}

// killall:
// @processName: a process name
//
// Kills @processName. If no process with the given name is found,
// this will fail silently.
function killall(processName) {
    try {
        // pkill is more portable than killall, but on Linux at least
        // it won't match if you pass more than 15 characters of the
        // process name... However, if you use the '-f' flag to match
        // the entire command line, it will work, but we have to be
        // careful in that case that we can match
        // '/usr/bin/processName' but not 'gedit processName.c' or
        // whatever...

        let argv = ['pkill', '-f', '^([^ ]*/)?' + processName + '($| )'];
        GLib.spawn_sync(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null, null);
        // It might be useful to return success/failure, but we'd need
        // a wrapper around WIFEXITED and WEXITSTATUS. Since none of
        // the current callers care, we don't bother.
    } catch (e) {
        logError(e, 'Failed to kill ' + processName);
    }
}

// This was ported from network-manager-applet
// Copyright 2007 - 2011 Red Hat, Inc.
// Author: Dan Williams <dcbw@redhat.com>

const _IGNORED_WORDS = [
        'Semiconductor',
        'Components',
        'Corporation',
        'Communications',
        'Company',
        'Corp.',
        'Corp',
        'Co.',
        'Inc.',
        'Inc',
        'Incorporated',
        'Ltd.',
        'Limited.',
        'Intel',
        'chipset',
        'adapter',
        '[hex]',
        'NDIS',
        'Module'
];

const _IGNORED_PHRASES = [
        'Multiprotocol MAC/baseband processor',
        'Wireless LAN Controller',
        'Wireless LAN Adapter',
        'Wireless Adapter',
        'Network Connection',
        'Wireless Cardbus Adapter',
        'Wireless CardBus Adapter',
        '54 Mbps Wireless PC Card',
        'Wireless PC Card',
        'Wireless PC',
        'PC Card with XJACK(r) Antenna',
        'Wireless cardbus',
        'Wireless LAN PC Card',
        'Technology Group Ltd.',
        'Communication S.p.A.',
        'Business Mobile Networks BV',
        'Mobile Broadband Minicard Composite Device',
        'Mobile Communications AB',
        '(PC-Suite Mode)'
];

function fixupPCIDescription(desc) {
    desc = desc.replace(/[_,]/, ' ');

    /* Attempt to shorten ID by ignoring certain phrases */
    for (let i = 0; i < _IGNORED_PHRASES.length; i++) {
        let item = _IGNORED_PHRASES[i];
        let pos = desc.indexOf(item);
        if (pos != -1) {
            let before = desc.substring(0, pos);
            let after = desc.substring(pos + item.length, desc.length);
            desc = before + after;
        }
    }

    /* Attmept to shorten ID by ignoring certain individual words */
    let words = desc.split(' ');
    let out = [ ];
    for (let i = 0; i < words.length; i++) {
        let item = words[i];

        // skip empty items (that come out from consecutive spaces)
        if (item.length == 0)
            continue;

        if (_IGNORED_WORDS.indexOf(item) == -1) {
            out.push(item);
        }
    }

    return out.join(' ');
}
