// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Signals = imports.signals;
const Clutter = imports.gi.Clutter;
const Params = imports.misc.params;

const DEFAULT_LIMIT = 512;

function HistoryManager(params) {
    this._init(params);
}

HistoryManager.prototype = {
    _init: function(params) {
        params = Params.parse(params, { gsettingsKey: null,
                                        limit: DEFAULT_LIMIT,
                                        entry: null,
                                        deduplicate: false });

        this._key = params.gsettingsKey;
        this._limit = params.limit;

        this._historyIndex = 0;
        if (this._key) {
            this._history = global.settings.get_strv(this._key);
            global.settings.connect('changed::' + this._key,
                                    Lang.bind(this, this._historyChanged));

        } else {
            this._history = [];
        }

        this._entry = params.entry;

        if (this._entry) {
            this._entry.connect('key-press-event', 
                                Lang.bind(this, this._onEntryKeyPress));
        }

        this._deduplicate = params.deduplicate;
    },

    _historyChanged: function() {
        this._history = global.settings.get_strv(this._key);
        this._historyIndex = this._history.length;
    },

    prevItem: function(text) {
        if (this._historyIndex <= 0)
            return text;

        if (text)
            this._history[this._historyIndex] = text;
        this._historyIndex--;
        return this._indexChanged();
    },

    nextItem: function(text) {
        if (this._historyIndex >= this._history.length)
            return text;

        if (text)
            this._history[this._historyIndex] = text;
        this._historyIndex++;
        return this._indexChanged();
    },

    lastItem: function() {
        if (this._historyIndex != this._history.length) {
            this._historyIndex = this._history.length;
            this._indexChanged();
        }

        return this._historyIndex.maybeGet(this._history.length);
    },

    addItem: function(input) {
        if (this._history.length == 0 ||
            this._history[this._history.length - 1] != input) {

            if (this._deduplicate) {
                this._history = this._history.filter(function(x) {
                    return x != input;
                });
            }

            this._history.push(input);
            this._save();
        }
        this._historyIndex = this._history.length;
    },

    _onEntryKeyPress: function(entry, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_Up) {
            this.prevItem(entry.get_text());
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            this.nextItem(entry.get_text());
            return true;
        }
        return false;
    },

    _indexChanged: function() {
        let current = this._history[this._historyIndex] || '';
        this.emit('changed', current);

        if (this._entry)
            this._entry.set_text(current);

        return current;
    },

    _save: function() {
        if (this._history.length > this._limit)
            this._history.splice(0, this._history.length - this._limit);

        if (this._key)
            global.settings.set_strv(this._key, this._history);
    }
};
Signals.addSignalMethods(HistoryManager.prototype);
