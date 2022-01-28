// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Signals = imports.signals
const Gio = imports.gi.Gio;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const XApp = imports.gi.XApp;
const CinnamonDesktop = imports.gi.CinnamonDesktop;
const Meta = imports.gi.Meta;

var InputGroup = class {
    constructor(source, display_name, short_name, layout_name, variant) {
        this.display_name = display_name;
        this.short_name = short_name;
        this.layout_name = layout_name;
        this.variant = variant;
        this.source = source;

        // TODO: deduplication
    }
}

var KeyboardLayoutManager = class {
    constructor() {
        this.input_settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.input-sources" });
        this.xkbinfo = new CinnamonDesktop.XkbInfo();

        this.groups = [];

        this.input_settings.connect("changed::sources", this._refresh_keymap.bind(this));
        this.input_settings.connect("changed::xkb-options", this._refresh_keymap.bind(this));

        this.ibus_active = false;
        Gio.DBus.session.watch_name(
            "org.fcitx.Fcitx",
            Gio.BusNameWatcherFlags.NONE,
            this._ibus_appeared.bind(this),
            this._ibus_vanished.bind(this)
        );

        this._refresh_keymap();

        this._current_group_idx = this.input_settings.get_uint("current");

        this.set_current_group(this._current_group_idx);
    }

    _refresh_keymap(controller) {
        let sources = this.input_settings.get_value("sources");
        let options = this.input_settings.get_strv("xkb-options");
        let layouts = [];
        let variants = [];

        let new_groups = [];

        let i = 0;

        for (let i = 0; i < sources.n_children(); i++) {
            let [source, id] = sources.get_child_value(i).deep_unpack();
            let [success, display_name, short_name, layout, variant] = this.xkbinfo.get_layout_info(id);

            if (success) {
                new_groups.push(new InputGroup(source, display_name, short_name, layout, variant));
            }

            layouts.push(layout);
            variants.push(variant);
        }

        let layouts_str = layouts.join(",");
        let variants_str = variants.join(",");
        let options_str = options.join(",");

        if (layouts_str === this.current_layouts_str &&
            variants_str === this.current_variants_str &&
            options_str === this.current_options_str) {
            return;
        }

        this.groups = new_groups;
        Meta.get_backend().set_keymap(layouts_str, variants_str, options_str);

        this.emit("config-changed");
    }

    set_current_group(idx) {
        if (idx < 0 || idx >= this.groups.length) {
            global.logError(`KeyboardLayoutManager.set_current_group() invalid index: ${idx}`)
            return;
        }

        if (idx === this._current_group_idx) {
            return;
        }

        this._current_group_idx = idx;

        this.input_settings.set_uint("current", idx);

        Meta.get_backend().lock_layout_group(idx);
        this.emit("layout-changed", idx);
    }

    get_current_group_idx() {
        return this._current_group_idx;
    }

    get_layout_name(idx) {
        let group = this.groups[idx];

        if (group === undefined) {
            return null
        }

        return group.layout_name;
    }

    get_group_display_name(idx) {
        let group = this.groups[idx];

        if (group === undefined) {
            return null
        }

        return group.display_name;
    }

    get_group_variant_name(idx) {
        let group = this.groups[idx];

        if (group === undefined) {
            return null
        }

        return group.short_name;
    }

    get_group_short_name(idx) {
        let group = this.groups[idx];

        if (group === undefined) {
            return null
        }

        return group.short_name;
    }

    have_multiple_layouts() {
        return this.groups.length > 1;
    }

    get_n_layouts() {
        return this.groups.length;
    }

    get_ibus_active() {
        return this.ibus_active;
    }

    _ibus_appeared(connection, name, owner) {
        this.ibus_active = true;
        this.emit("layout-changed");
    }

    _ibus_vanished(connection, name) {
        this.ibus_active = false;
        this.emit("layout-changed");
    }
}
Signals.addSignalMethods(KeyboardLayoutManager.prototype);
