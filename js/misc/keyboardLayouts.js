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
    constructor(xkbinfo, id, groups) {
        this.id = id;

        let [ret, display_name, short_name, layout, variant] = xkbinfo.get_layout_info(id);

        this.user_label = display_name;

        // TODO: deduplication



        this.group_name = layout;
        this.group_label = layout;
        this.group_dupe_id = 0;

        this.variant_name = variant;
        this.variant_label = variant;
        this.variant_dupe_id = 0;
    }
}

var KeyboardLayoutManager = class {
    constructor() {
        this.layout_controller = new XApp.KbdLayoutController();
        this.gnomekbd_settings = new Gio.Settings({ schema_id: "org.gnome.libgnomekbd.keyboard" });
        this.xkbinfo = new CinnamonDesktop.XkbInfo();

        this.groups = {};

        this.current_layouts_str = null;
        this.current_variants_str = null;
        this.current_options_str = null;

        // this.kbd_settings_id = this.gnomekbd_settings.connect("changed", this._refresh_keymap.bind(this));
        this.kbd_settings_id = this.layout_controller.connect("config-changed", this._refresh_keymap.bind(this));
        // this.kbd_settings_id = this.layout_controller.connect("layout-changed", this._refresh_keymap.bind(this));

        this._refresh_keymap(null);
        this.set_current_group(this.layout_controller.get_current_group());

        // Meta.get_backend().connect("keymap-changed", this._backend_keymap_change_done.bind(this));
        // Meta.get_backend().connect("keymap-layout-group-changed", this._backend_layout_group_change_done.bind(this));
    }

    _refresh_keymap(controller) {
        let options = this.gnomekbd_settings.get_strv("options") || [];
        let ids = this.gnomekbd_settings.get_strv("layouts");

        let layouts = []
        let variants = [];

        for (let id of ids) {
            // let group = new GroupData(this.xkbinfo, id);
            // groups.push(group);
        // }




            let [,,, layout, variant] = this.xkbinfo.get_layout_info(id);

            layouts.push(layout);
            variants.push(variant);
        }

        let layouts_str = layouts.join(",");
        let variants_str = variants.join(",");
        let options_str = options.join(",");

        log("reload")
        log(layouts_str);
        log(variants_str);
        log(options_str);
        log("reload done")

        if (layouts_str === this.current_layouts_str &&
            variants_str === this.current_variants_str &&
            options_str === this.current_options_str) {
            return;
        }

        this.current_layouts_str = layouts_str;
        this.current_variants_str = variants_str;
        this.current_options_str = options_str;

        Meta.get_backend().set_keymap(layouts_str, variants_str, options_str);
    }

    set_current_group(id) {
        Meta.get_backend().lock_layout_group(id);
    }

    _backend_keymap_change_done(backend) {
        log("backend keymap changed");
        this.emit("config-changed");
    }

    _backend_layout_group_change_done(backend, id) {
        log("backend gorup changed");
        this.emit("layout-changed");
    }
}
Signals.addSignalMethods(KeyboardLayoutManager.prototype);
