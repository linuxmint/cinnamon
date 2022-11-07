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
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Gir = imports.gi.GIRepository;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;

// http://daringfireball.net/2010/07/improved_regex_for_matching_urls
const _balancedParens = '\\([^\\s()<>]+\\)';
const _leadingJunk = '[\\s`(\\[{\'\\"<\u00AB\u201C\u2018]';
const _notTrailingJunk = '[^\\s`!()\\[\\]{};:\'\\".,<>?\u00AB\u00BB\u201C\u201D\u2018\u2019]';

export function decodeHTML(str: string | null = null): string | null {
    if (str === null) {
        return null;
    }

    return str.replace(/&#(\d+);/g, function (match, dec) {
        return String.fromCharCode(dec);
    });
}

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
 * escapeRegExp:
 * @str: (String) a string to escape
 *
 * Escapes a string for use within a regular expression.
 *
 * Returns: (String) the escaped string
 */
export function escapeRegExp(str: string): string {
    // from: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

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
export function findUrls(str: string): { url: string; pos: number; }[] {
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
export function spawn(argv: string[]): number | null {
    let pid: number | null = null;

    try {
        pid = trySpawn(argv);
    } catch (err) {
        // TODO: Assert this properly if needed
        _handleSpawnError(argv[0], err as Error);
    }

    return pid;
}

let subprocess_id = 0;
var subprocess_callbacks: Record<number, (stdout: string) => void> = {};
/**
 * spawn_async:
 * @args: an array containing all arguments of the command to be run
 * @callback: the callback to run when the command has completed
 *
 * Asynchronously Runs the command passed to @args. When the command is complete, the callback will
 * be called with the contents of stdout from the command passed as the only argument.
 */
export function spawn_async(args: string[], callback: (stdout: string) => void): void {
    subprocess_id++;
    subprocess_callbacks[subprocess_id] = callback;
    spawn(["cinnamon-subprocess-wrapper", subprocess_id.toString(), ...args]);
}

/**
 * spawnCommandLine:
 * @command_line: a command line
 *
 * Runs @command_line in the background, handling any errors that
 * occur when trying to parse or start the program.
 */
export function spawnCommandLine(command_line: string): number | null {
    let pid: number | null = null;

    try {
        let [success, argv] = GLib.shell_parse_argv(command_line);
        pid = trySpawn(argv);
    } catch (err) {
        // TODO: Assert this properly if needed
        _handleSpawnError(command_line, err as Error);
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
export function trySpawn(argv: string[], doNotReap?: boolean): number | null {
    let spawn_flags = GLib.SpawnFlags.SEARCH_PATH
        | GLib.SpawnFlags.STDOUT_TO_DEV_NULL
        | GLib.SpawnFlags.STDERR_TO_DEV_NULL;

    if (doNotReap) {
        spawn_flags |= GLib.SpawnFlags.DO_NOT_REAP_CHILD;
    }

    let [success, pid] = GLib.spawn_async(null, argv, null, spawn_flags, null);
    return pid;
}

/**
 * trySpawnCommandLine:
 * @command_line: a command line
 *
 * Runs @command_line in the background. If launching @command_line
 * fails, this will throw an error.
 */
export function trySpawnCommandLine(command_line: string): number | null {
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
export function spawnCommandLineAsync(command_line: string, callback?: () => void, errback?: () => void ): void {
    let pid;

    let [success, argv] = GLib.shell_parse_argv(command_line);

    pid = trySpawn(argv, true);

    GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function (pid: number, status: number) {
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

export interface CommandLineAsyncIOOptions {
    argv?: string[],
    flags?: string[],
    input?: any
}

/**
 * spawnCommandLineAsyncIO:
 * @command: a command
 * @callback (function): called on success or failure
 * @opts (object): options: argv, flags, input
 *
 * Runs @command in the background. Callback has three arguments -
 * stdout, stderr, and exitCode.
 *
 * Returns (object): a Gio.Subprocess instance
 */
export function spawnCommandLineAsyncIO(command: string, callback: (stdout: string | null, stderr: string | null, exitCode: number) => void, opts: CommandLineAsyncIOOptions = {}): imports.gi.Gio.Subprocess {
    let { argv, flags, input } = opts;
    if (!input) input = null;

    let subprocess = new Gio.Subprocess({
        argv: argv ? argv : ['bash', '-c', command],
        flags: flags ? flags
            : Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
    // we injecting cancellable to the subprocess itself so we extend it's type 
    }) as imports.gi.Gio.Subprocess & {cancellable: imports.gi.Gio.Cancellable | null};

    subprocess.init(null);
    let cancellable = new Gio.Cancellable();

    // TODO: fix AsyncReadyCallback signature
    subprocess.communicate_utf8_async(input, cancellable, (obj, res) => {
        let success: boolean = false;
        let stdout: string | null = null;
        let stderr: string | null = null;
        let exitCode: number = -1;
        // This will throw on cancel with "Gio.IOErrorEnum: Operation was cancelled"
        tryFn(() => [success, stdout, stderr] = (obj as any as imports.gi.Gio.Subprocess).communicate_utf8_finish(res));

        if (typeof callback === 'function' && !cancellable.is_cancelled()) {
            // TODO: TryFn breaks typechecking
            if (stderr && (stderr as string).indexOf('bash: ') > -1) {
                stderr = (stderr as string).replace(/bash: /, '');
            }
            exitCode = success ? subprocess.get_exit_status() : -1;
            callback(stdout, stderr, exitCode);
        }
        subprocess.cancellable = null;
    });
    subprocess.cancellable = cancellable;

    return subprocess;
}

export function _handleSpawnError(command: string, err: Error) {
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
export function killall(processName: string): void {
    try {
        // pkill is more portable than killall, but on Linux at least
        // it won't match if you pass more than 15 characters of the
        // process name... However, if you use the '-f' flag to match
        // the entire command line, it will work, but we have to be
        // careful in that case that we can match
        // '/usr/bin/processName' but not 'gedit processName.c' or
        // whatever...

        let argv = ['pkill', '-f', '^([^ ]*/)?' + processName + '($| )'];
        GLib.spawn_sync(null, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);
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

export function fixupPCIDescription(desc: string): string {
    desc = desc.replace(/[_,]/, ' ');

    /* Remove any parenthesized info longer than 2 chars (which
       may be disambiguating numbers if there are multiple identical
       cards present) */
    desc = desc.replace(/\([\s\S][^\(\)]{2,}\)/, '');

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
    let out: string[] = [];
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
    L: /[\u0139\u013B\u013D\u013F\u0141]/g,
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
export function latinise(string: string): string {
    //call every regex to replace chars
    let i: keyof typeof _LATINISE_REGEX;
    for (i in _LATINISE_REGEX) {
        string = string.replace(_LATINISE_REGEX[i], i);
    }
    return string;
}

//TODO: convert this to a generic type
/**
 * queryCollection:
 * @collection (array): an array of objects to query
 * @query (object): key-value pairs to find in the collection
 * @indexOnly (boolean): defaults to false, returns only the matching
 * object's index if true.
 *
 * Returns (object|null): the matched object, or null if no object
 * in the collection matches all conditions of the query.
 */
export function queryCollection(collection: any[], query: any, indexOnly: boolean = false): any | number | null {
    let queryKeys = Object.keys(query);
    for (let i = 0; i < collection.length; i++) {
        let matches = 0;
        for (let z = 0; z < queryKeys.length; z++) {
            if (collection[i][queryKeys[z]] === query[queryKeys[z]]) {
                matches += 1;
            }
        }
        if (matches === queryKeys.length) {
            return indexOnly ? i : collection[i];
        }
    }
    return indexOnly ? -1 : null;
}

/**
 * findIndex:
 * @array (array): Array to be iterated.
 * @callback (function): The function to call on every iteration,
 * should return a boolean value.
 *
 * Returns (number): the index of @array, else -1.
 */
export function findIndex<T>(array: T[], callback: (item: T, i: number, array: T[]) => boolean): number {
    for (let i = 0, len = array.length; i < len; i++) {
        if (array[i] && callback(array[i], i, array)) {
            return i;
        }
    }
    return -1;
}

/**
 * find:
 * @array (array): Array to be iterated.
 * @callback (function): The function to call on every iteration,
 * should return a boolean value.
 *
 * Returns (any): Returns the matched element, else null.
 */
export function find<T>(arr: T[], callback: (item: T, i: number, array: T[]) => boolean): T | null {
    for (let i = 0, len = arr.length; i < len; i++) {
        if (callback(arr[i], i, arr)) {
            return arr[i];
        }
    }
    return null;
};

/**
 * each:
 * @array (array|object): Array or object to be iterated.
 * @callback (function): The function to call on every iteration.
 *
 * Iteratee functions may exit iteration early by explicitly returning false.
 */
// export function each<T extends {}>(obj: T, callback: (item: T[keyof T], i: string) => void): void;
// export function each<T extends any[]>(obj: T, callback: (item: T[keyof T], i: number) => boolean | void): void;
export function each<T extends {} | any[]>(obj: T, callback: (item: T[keyof T], i: number | string | symbol) => boolean | void): void {
    if (Array.isArray(obj)) {
        for (let i = 0, len = obj.length; i < len; i++) {
            if (callback(obj[i], i) === false) {
                return;
            }
        }
    } else {
        let keys = Object.keys(obj) as (keyof T)[];
        for (let i = 0, len = keys.length; i < len; i++) {
            let key = keys[i];
            callback(obj[key], key);
        }
    }
};

/**
 * filter:
 * @array (array): Array to be iterated.
 * @callback (function): The function to call on every iteration.
 *
 * Returns (array): Returns the new filtered array.
 */
export function filter<T>(arr: T[], callback: (item: T, i: number, array: T[]) => boolean): T[] {
    let result: T[] = [];
    for (let i = 0, len = arr.length; i < len; i++) {
        if (callback(arr[i], i, arr)) {
            result.push(arr[i]);
        }
    }
    return result;
};

/**
 * map:
 * @array (array): Array to be iterated.
 * @callback (function): The function to call on every iteration.
 *
 * Returns (array): Returns the new mapped array.
 */
export function map<T, TT>(arr: T[] | null, callback: (item: T, i: number, array: T[]) => TT): TT[] {
    if (arr == null) {
        return [];
    }

    let len = arr.length;
    let out: TT[] = Array(len);

    for (let i = 0; i < len; i++) {
        out[i] = callback(arr[i], i, arr);
    }

    return out;
};

/**
 * tryFn:
 * @callback (function): Function to wrap in a try-catch block.
 * @errCallback (function): The function to call on error.
 *
 * Try-catch can degrade performance in the function scope it is
 * called in. By using a wrapper for try-catch, the function scope is
 * reduced to the wrapper and not a potentially performance critical
 * function calling the wrapper. Use of try-catch in any form will
 * be slower than writing defensive code.
 *
 * Returns (any): The output of whichever callback gets called.
 */
export function tryFn(callback: () => void, errCallback?: (err: unknown) => void) {
    try {
        return callback();
    } catch (e) {
        if (typeof errCallback === 'function') {
            return errCallback(e);
        }
    }
};

/**
 * setTimeout:
 * @callback (function): Function to call at the end of the timeout.
 * @ms (number): Milliseconds until the timeout expires.
 *
 * Convenience wrapper for a Mainloop.timeout_add loop that
 * returns false.
 *
 * Returns (number): The ID of the loop.
 */
export function setTimeout(callback: (...args: any[]) => void, ms: number): number {
    let args: any[] = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }

    let id = Mainloop.timeout_add(ms, () => {
        callback.call(null, ...args);
        return false; // Stop repeating
    });

    return id;
};

/**
 * clearTimeout:
 * @id (number): The ID of the loop to remove.
 *
 * Convenience wrapper for Mainloop.source_remove.
 */
export function clearTimeout(id: number): void {
    if (id) Mainloop.source_remove(id);
};


/**
 * setInterval:
 * @callback (function): Function to call on every interval.
 * @ms (number): Milliseconds between invocations.
 *
 * Convenience wrapper for a Mainloop.timeout_add loop that
 * returns true.
 *
 * Returns (number): The ID of the loop.
 */
export function setInterval(callback: (...args: any[]) => void, ms: number): number {
    let args: any[] = [];
    if (arguments.length > 2) {
        args = args.slice.call(arguments, 2);
    }

    let id = Mainloop.timeout_add(ms, () => {
        callback.call(null, ...args);
        return true; // Repeat
    });

    return id;
};

/**
 * clearInterval:
 * @id (number): The ID of the loop to remove.
 *
 * Convenience wrapper for Mainloop.source_remove.
 */
export function clearInterval(id: number): void {
    if (id) Mainloop.source_remove(id);
};

/**
 * throttle:
 * @callback (function): Function to throttle.
 * @interval (number): Milliseconds to throttle invocations to.
 * @callFirst (boolean): Specify invoking on the leading edge of the timeout.
 *
 * Returns (any): The output of @callback.
 */
export function throttle<T, TT extends any[]>(callback: (...arg: TT) => T, interval: number, callFirst: boolean): (...arg: TT) => T | undefined {
    let wait = false;
    let callNow = false;
    return function (this: any, ...args: TT) {
        callNow = callFirst && !wait;
        let context = this;
        if (!wait) {
            wait = true;
            setTimeout(function () {
                wait = false;
                if (!callFirst) {
                    return callback.apply(context, args);
                }
            }, interval);
        }
        if (callNow) {
            callNow = false;
            return callback.apply(this, args);
        }
    };
}

/**
 * unref:
 * @object (object): Object to be nullified.
 * @reserved (array): List of special keys (string) that should not be assigned null.
 *
 * This will iterate @object and assign null to every property
 * value except for keys specified in the @reserved array. Calling unref()
 * in an object that has many references can make garbage collection easier
 * for the engine. This should be used at the end of the lifecycle for
 * classes that do not reconstruct very frequently, as GC thrashing can
 * reduce performance.
 */
export function unref(object: any, reserved: string[] = []): void {
    // Some actors being destroyed have a cascading effect (e.g. PopupMenu items),
    // so it is safest to wait for the next 'tick' before removing references.
    setTimeout(() => {
        let keys = Object.keys(object);
        for (let i = 0; i < keys.length; i++) {
            if (!reserved.includes(keys[i])) {
                object[keys[i]] = null;
            }
        }
    }, 0);
};

// MIT © Petka Antonov, Benjamin Gruenbaum, John-David Dalton, Sindre Sorhus
// https://github.com/sindresorhus/to-fast-properties
let fastProto: any | null = null;
const FastObject: any = function (o?: any) {
    if (fastProto !== null && typeof fastProto.property) {
        const result = fastProto;
        fastProto = FastObject.prototype = null;
        return result;
    }
    fastProto = FastObject.prototype = o == null ? Object.create(null) : o;
    return new FastObject;
}
FastObject();
export function toFastProperties<T extends object>(obj: T): void {
    each(obj, function (value) {
        if (value && !Array.isArray(value)) FastObject(value);
    });
};

const READWRITE = GObject.ParamFlags.READABLE | GObject.ParamFlags.WRITABLE;

// Based on https://gist.github.com/ptomato/c4245c77d375022a43c5
function _getWritablePropertyNamesForObjectInfo(info: imports.gi.GIRepository.BaseInfo): string[] {
    let propertyNames: string[] = [];
    let propertyCount = Gir.object_info_get_n_properties(info);
    for (let i = 0; i < propertyCount; i++) {
        let propertyInfo = Gir.object_info_get_property(info, i);
        let flags = Gir.property_info_get_flags(propertyInfo);
        if ((flags & READWRITE) == READWRITE) {
            propertyNames.push(propertyInfo.get_name());

        }
    }
    return propertyNames;
}

/**
 * getGObjectPropertyValues:
 * @object (GObject.Object): GObject to inspect
 *
 * Returns (object): JS representation of the passed GObject
 */
export function getGObjectPropertyValues<T extends imports.gi.GObject.Object>(obj: T, r: number = 0): any {
    let repository = Gir.Repository.get_default();
    // TODO: inject find %gtype
    let baseInfo = repository.find_by_gtype(obj.constructor.$gtype);
    let propertyNames: (keyof T)[] = [];
    for (let info = baseInfo; info !== null; info = Gir.object_info_get_parent(info)!) {
        propertyNames = [...propertyNames, ..._getWritablePropertyNamesForObjectInfo(info) as (keyof T)[]];
    }
    if (r > 0 && propertyNames.length === 0) {
        return obj.toString();
    }
    let jsRepresentation: any = {};
    for (let i = 0; i < propertyNames.length; i++) {
        try {
            let value = obj[propertyNames[i]];
            if ((value instanceof GObject.Object) && r < 4) {
                value = getGObjectPropertyValues(value, r + 1);
            }
            jsRepresentation[propertyNames[i]] = value;
        } catch (e) {
            /* Error: Can't convert non-null pointer to JS value */
            jsRepresentation[propertyNames[i]] = '<non-null pointer>';
        }
    }
    return jsRepresentation;
}

export function version_exceeds(version: string, min_version: string): boolean {
    let our_version = version.split(".");
    let cmp_version = min_version.split(".");
    let i;

    for (i = 0; i < our_version.length && i < cmp_version.length; i++) {
        let our_part = parseInt(our_version[i]);
        let cmp_part = parseInt(cmp_version[i]);

        if (isNaN(our_part) || isNaN(cmp_part)) {
            return false;
        }

        if (our_part < cmp_part) {
            return false;
        } else
            if (our_part > cmp_part) {
                return true;
            }
    }

    if (our_version.length < cmp_version.length) {
        return false;
    } else {
        return true;
    }
}

// Maps .desktop action name to an icon
const DESKTOP_ACTION_ICON_NAMES = {
    area_shot: 'screenshot-area',
    base: 'x-office-database',
    big_picture: 'view-fullscreen',
    calc: 'x-office-spreadsheet',
    community: 'system-users',
    compose: 'text-editor',
    contacts: 'x-office-address-book',
    document: 'document-new',
    draw: 'x-office-drawing',
    friends: 'user-available',
    fullscreen: 'view-fullscreen',
    impress: 'x-office-presentation',
    library: 'accessories-dictionary',
    math: 'x-office-math',
    mute: 'audio-volume-muted',
    new_document: 'document-new',
    new_private_window: 'view-private',
    new_root_window: 'dialog-password',
    news: 'news',
    new_session: 'tab-new-symbolic',
    new_window: 'window-new',
    next: 'media-skip-forward',
    open_computer: 'computer',
    open_home: 'user-home',
    open_trash: 'user-trash',
    play: 'media-playback-start',
    play_pause: 'media-playback-start',
    preferences: 'preferences-other',
    prefs: 'preferences-other',
    previous: 'media-skip-backward',
    screen_shot: 'screenshot-fullscreen',
    screenshots: 'applets-screenshooter',
    servers: 'network-server',
    settings: 'preferences-other',
    ssa: 'screenshot-area',
    ssf: 'screenshot-fullscreen',
    ssw: 'screenshot-window',
    stop_quit: 'media-playback-stop',
    store: 'store',
    window: 'window-new',
    window_shot: 'screenshot-window',
    writer: 'x-office-document',
};

/**
 * getDesktopActionIcon:
 * @action (string): Action name
 *
 * Returns (string|null): Name of the icon associated with this action or null if not found
 */
export function getDesktopActionIcon(action: string) {
    let actionID = '';
    if (action.toUpperCase() === action) {
        actionID = action.toLowerCase();
    } else {
        // first letter lowercase, replace uppercase with _+lowercase
        actionID = action.charAt(0).toLowerCase() + action.slice(1);
        actionID = actionID.replace(/([A-Z])/g, '_$1').toLowerCase();
    }
    actionID = actionID.replace(/-/g, '_');

    if (DESKTOP_ACTION_ICON_NAMES.hasOwnProperty(actionID))
        return DESKTOP_ACTION_ICON_NAMES[actionID as keyof typeof DESKTOP_ACTION_ICON_NAMES];
    else return null;
}

