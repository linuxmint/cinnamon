const Signals = imports.signals;
const Main = imports.ui.main;

function KeybindingManager() {
    this._init();
}

KeybindingManager.prototype = {
    _init: function() {
        this.bindings = [];
    },

    addHotKey: function(name, binding, callback) {
        if (this.bindings[name]) {
            global.display.remove_custom_keybinding(name);
        }
        if (binding == "") {
            global.logError("Empty keybinding set for " + name + ", ignoring");
            if (this.bindings[name]) {
                this.bindings[name] = undefined;
            }
            global.display.rebuild_keybindings();
            return true;
        }
        if (!global.display.add_custom_keybinding(name, binding, callback)) {
            global.logError("Warning, unable to bind hotkey with name '" + name + "'.  The selected keybinding could already be in use.");
            global.display.rebuild_keybindings();
            return false;
        } else {
            this.bindings[name] = binding;
        }
        global.display.rebuild_keybindings();
        return true;
    },

    removeHotKey: function(name) {
        global.display.remove_custom_keybinding(name);
        global.display.rebuild_keybindings();
        this.bindings[name] = undefined;
    }
};
Signals.addSignalMethods(KeybindingManager.prototype);

