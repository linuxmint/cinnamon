/**
 * FILE:util.js
 * @short_description: File providing certain utility functions
 *
 * This file includes certain useful utility functions such as running external
 * commands. It is generally a good idea to use the functions defined here
 * instead of tapping into GLib directly since this adds some wrappers around
 * the functions that make them more Cinnamon-friendly and provides helpful
 * error messages.
 */

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

/**
 * findUrls:
 * @str: string to find URLs in
 *
 * Searches @str for URLs and returns an array of objects with %url
 * properties showing the matched URL string, and %pos properties indicating
 * the position within @str where the URL was found.
 *
 * Returns: the list of match objects, as described above
 */
function findUrls(str) {
    let res = [], match;
    while ((match = _urlRegexp.exec(str)))
        res.push({ url: match[2], pos: match.index + match[1].length });
    return res;
}

/**
 * spawn:
 * @argv: an argv array
 *
 * Runs @argv in the background, handling any errors that occur
 * when trying to start the program.
 */
function spawn(argv) {
    let pid;

    try {
        pid = trySpawn(argv);
    } catch (err) {
        _handleSpawnError(argv[0], err);
    }

    return pid;
}

let subprocess_id = 0;
let subprocess_callbacks = {};
function spawn_async(args, callback) {
    subprocess_id++;
    subprocess_callbacks[subprocess_id] = callback;
    spawn(new Array("cinnamon-subprocess-wrapper", subprocess_id.toString()).concat(args));
}

/**
 * spawnCommandLine:
 * @command_line: a command line
 *
 * Runs @command_line in the background, handling any errors that
 * occur when trying to parse or start the program.
 */
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

/**
 * trySpawn:
 * @argv: an argv array
 * @doNotReap: whether to set the DO_NOT_REAP_CHILD flag
 *
 * Runs @argv in the background. If launching @argv fails,
 * this will throw an error.
 */
function trySpawn(argv, doNotReap)
{
    let spawn_flags = GLib.SpawnFlags.SEARCH_PATH
                      | GLib.SpawnFlags.STDOUT_TO_DEV_NULL
                      | GLib.SpawnFlags.STDERR_TO_DEV_NULL;

    if (doNotReap) {
        spawn_flags |= GLib.SpawnFlags.DO_NOT_REAP_CHILD;
    }

    let [success, pid] = GLib.spawn_async(null, argv, null, spawn_flags, null, null);
    return pid;
}

/**
 * trySpawnCommandLine:
 * @command_line: a command line
 *
 * Runs @command_line in the background. If launching @command_line
 * fails, this will throw an error.
 */
function trySpawnCommandLine(command_line) {
    let pid;

    let [success, argv] = GLib.shell_parse_argv(command_line);
    pid = trySpawn(argv);

    return pid;
}

/**
 * spawnCommandLineAsync:
 * @command_line: a command line
 * @callback (function): called on success
 * @errback (function): called on error
 *
 * Runs @command_line in the background. If the process exits without
 * error, a callback will be called, or an error callback will be
 * called if one is provided.
 */
function spawnCommandLineAsync(command_line, callback, errback) {
    let pid;

    let [success, argv] = GLib.shell_parse_argv(command_line);
    pid = trySpawn(argv, true);

    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function(pid, status) {
        GLib.spawn_close_pid(pid);

        if (status !== 0) {
            if (typeof errback === 'function') {
                errback();
            }
        } else {
            if (typeof callback === 'function') {
                callback();
            }
        }
    });
}

function _handleSpawnError(command, err) {
    let title = _("Execution of '%s' failed:").format(command);
    Main.notifyError(title, err.message);
}

/**
 * killall:
 * @processName: a process name
 *
 * Kills @processName. If no process with the given name is found,
 * this will fail silently.
 */
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

// key: normal char, value: regex containing all chars with accents
const _LATINISE_REGEX = {
    //uppercase
    A: /[\xC0-\xC5\u0100\u0102\u0104]/g,
    AE: /\xC6/g,
    C: /[\xC7\u0106\u0108\u010A\u010C]/g,
    D: /[\xD0\u010E\u0110]/g,
    E: /[\xC8-\xCB\u0112\u0114\u0116\u0118\u011A]/g,
    G: /[\u011C\u011E\u0120\u0122]/g,
    H: /[\u0124\u0126]/g,
    I: /[\xCC-\xCF\u0128\u012A\u012C\u0130]/g,
    IJ: /\u0132/g,
    J: /[\u012E\u0134]/g,
    K: /\u0136/g,
    L: /[\u0139\u013B\u013D\u0130F\u0141]/g,
    N: /[\xD1\u0143\u0145\u0147\u014A]/g,
    O: /[\xD2-\xD6\xD8\u014C\u014E\u0150]/g,
    OE: /\u0152/g,
    R: /[\u0154\u0156\u0158]/g,
    S: /[\u015A\u015C\u015E\u0160]/g,
    T: /[\u0162\u0164\u0166]/g,
    U: /[\xD9-\xDC\u0168\u016A\u016C\u016E\u0170\u0172]/g,
    W: /\u0174/g,
    Y: /[\xDD\u0176\u0178]/g,
    Z: /[\u0179\u017B\u017D]/g,

    //lowercase
    a: /[\xE0-\xE5\u0101\u0103\u0105]/g,
    ae: /\xE6/g,
    c: /[\xE7\u0107\u0109\u010B\u010D]/g,
    d: /[\u010F\u0111]/g,
    e: /[\xE8-\xEB\u0113\u0115\u0117\u0119\u011B]/g,
    g: /[\u011D\u011F\u0121\u0123]/g,
    h: /[\u0125\u0127]/g,
    i: /[\xEC-\xEF\u0129\u012B\u012D\u0131]/g,
    ij: /\u0133/g,
    j: /[\u012F\u0135]/g,
    k: /[\u0137\u0138]/g,
    l: /[\u013A\u013C\u013E\u0140\u0142]/g,
    n: /[\xF1\u0144\u0146\u0148\u0149\u014B]/g,
    o: /[\xF2-\xF6\xF8\u014D\u014F\u0151]/g,
    oe: /\u0153/g,
    r: /[\u0155\u0157\u0159]/g,
    s: /[\u015B\u015D\u015F\u0161]/g,
    t: /[\u0163\u0165\u0167]/g,
    u: /[\xF9-\xFC\u0169\u016B\u016D\u016F\u0171\u0173]/g,
    w: /\u0175/g,
    y: /[\xFD\xFF\u0177]/g,
    z: /[\u017A\u017C\u017E]/g
};


/**
 * latinise:
 * @string (string): a string
 *
 * Returns (string): @string, replaced accented chars
 */
function latinise(string){
    //call every regex to replace chars
    for(var i in _LATINISE_REGEX){
        string = string.replace(_LATINISE_REGEX[i], i);
    }
    return string;
}
