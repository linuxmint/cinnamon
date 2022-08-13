// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const { Clutter, Gio, GLib, St } = imports.gi;
const Ripples = imports.ui.ripples;
const Main = imports.ui.main;

const LOCATE_POINTER_ENABLED_SCHEMA = "org.cinnamon.desktop.peripherals.mouse"
const LOCATE_POINTER_SCHEMA = "org.cinnamon.muffin"

var locatePointer = class {
    constructor() {
        this._enabledSettings = new Gio.Settings({schema_id: LOCATE_POINTER_ENABLED_SCHEMA});
        this._keySettings = new Gio.Settings({schema_id: LOCATE_POINTER_SCHEMA});
        this._keySettings.connect('changed::locate-pointer-key', this._updateKey.bind(this));
        this._updateKey();

        this._ripples = new Ripples.Ripples(0.5, 0.5, 'ripple-pointer-location');
        this._ripples.addTo(Main.uiGroup);
    }

    _updateKey() {
        let modifierKey = this._keySettings.get_string('locate-pointer-key');
        Main.keybindingManager.addHotKey('locate-pointer', modifierKey, () => { this.show() });
    }

    show() {
        if (!this._enabledSettings.get_boolean("locate-pointer"))
            return;

        let [x, y, mods] = global.get_pointer();
        this._ripples.playAnimation(x, y);
    }
};
