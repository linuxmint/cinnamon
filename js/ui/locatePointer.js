// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { Clutter, Gio, GLib, St } = imports.gi;
const Ripples = imports.ui.ripples;
const Lang = imports.lang;
const Main = imports.ui.main;

const LOCATE_POINTER_ENABLED_SCHEMA = "org.cinnamon.desktop.peripherals.mouse"
const LOCATE_POINTER_SCHEMA = "org.cinnamon.muffin"

var locatePointer = class {
    constructor() {
        this._enabledSettings = new Gio.Settings({schema_id: LOCATE_POINTER_ENABLED_SCHEMA});
        this._enabledSettings.connect('changed::locate-pointer', this._updateKey.bind(this));
        this._keySettings = new Gio.Settings({schema_id: LOCATE_POINTER_SCHEMA});
        this._keySettings.connect('changed::locate-pointer-key', this._updateKey.bind(this));
        this._updateKey();

        this._ripples = new Ripples.Ripples(0.5, 0.5, 'ripple-pointer-location');
        this._ripples.addTo(Main.uiGroup);
    }

    _updateKey() {
        if (this._enabledSettings.get_boolean("locate-pointer")) {
            let modifierKeys = this._keySettings.get_strv('locate-pointer-key');
            Main.keybindingManager.addHotKeyArray('locate-pointer', modifierKeys, Lang.bind(this, this.show));
        } else {
            Main.keybindingManager.removeHotKey('locate-pointer');
        }
    }

    show() {
        let [x, y, mods] = global.get_pointer();
        this._ripples.playAnimation(x, y);
    }
};
