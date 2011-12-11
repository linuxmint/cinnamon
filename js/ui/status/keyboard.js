// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gkbd = imports.gi.Gkbd;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const Util = imports.misc.util;

function LayoutMenuItem() {
    this._init.apply(this, arguments);
}

LayoutMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(config, id, indicator, long_name) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);

        this._config = config;
        this._id = id;
        this.label = new St.Label({ text: long_name });
        this.indicator = indicator;
        this.addActor(this.label);
        this.addActor(this.indicator);
    },

    activate: function(event) {
        PopupMenu.PopupBaseMenuItem.prototype.activate.call(this);
        this._config.lock_group(this._id);
    }
};

function XKBIndicator() {
    this._init.call(this);
}

XKBIndicator.prototype = {
    __proto__: PanelMenu.Button.prototype,

    _init: function() {
        PanelMenu.Button.prototype._init.call(this, St.Align.START);

        this._container = new Shell.GenericContainer();
        this._container.connect('get-preferred-width', Lang.bind(this, this._containerGetPreferredWidth));
        this._container.connect('get-preferred-height', Lang.bind(this, this._containerGetPreferredHeight));
        this._container.connect('allocate', Lang.bind(this, this._containerAllocate));
        this.actor.add_actor(this._container);
        this.actor.add_style_class_name('panel-status-button');

        this._iconActor = new St.Icon({ icon_name: 'keyboard', icon_type: St.IconType.SYMBOLIC, style_class: 'system-status-icon' });
        this._container.add_actor(this._iconActor);
        this._labelActors = [ ];
        this._layoutItems = [ ];

        this._showFlags = false;
        this._config = Gkbd.Configuration.get();
        this._config.connect('changed', Lang.bind(this, this._syncConfig));
        this._config.connect('group-changed', Lang.bind(this, this._syncGroup));
        this._config.start_listen();

        this._syncConfig();

        if (global.session_type == Shell.SessionType.USER) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            this.menu.addAction(_("Show Keyboard Layout"), Lang.bind(this, function() {
                Main.overview.hide();
                Util.spawn(['gkbd-keyboard-display', '-g', String(this._config.get_current_group() + 1)]);
            }));
        }
        this.menu.addSettingsAction(_("Region and Language Settings"), 'gnome-region-panel.desktop');
    },

    _adjustGroupNames: function(names) {
        // Disambiguate duplicate names with a subscript
        // This is O(N^2) to avoid sorting names
        // but N <= 4 so who cares?

        for (let i = 0; i < names.length; i++) {
            let name = names[i];
            let cnt = 0;
            for (let j = i + 1; j < names.length; j++) {
                if (names[j] == name) {
                    cnt++;
                    // U+2081 SUBSCRIPT ONE
                    names[j] = name + String.fromCharCode(0x2081 + cnt);
                }
            }
            if (cnt != 0)
                names[i] = name + '\u2081';
        }

        return names;
    },

    _syncConfig: function() {
        this._showFlags = this._config.if_flags_shown();
        if (this._showFlags) {
            this._container.set_skip_paint(this._iconActor, false);
        } else {
            this._container.set_skip_paint(this._iconActor, true);
        }

        let groups = this._config.get_group_names();
        if (groups.length > 1) {
            this.actor.show();
        } else {
            this.menu.close();
            this.actor.hide();
        }

        for (let i = 0; i < this._layoutItems.length; i++)
            this._layoutItems[i].destroy();

        for (let i = 0; i < this._labelActors.length; i++)
            this._labelActors[i].destroy();

        let short_names = this._adjustGroupNames(this._config.get_short_group_names());

        this._selectedLayout = null;
        this._layoutItems = [ ];
        this._selectedLabel = null;
        this._labelActors = [ ];
        for (let i = 0; i < groups.length; i++) {
            let icon_name = this._config.get_group_name(i);
            let actor;
            if (this._showFlags)
                actor = new St.Icon({ icon_name: icon_name, icon_type: St.IconType.SYMBOLIC, style_class: 'popup-menu-icon' });
            else
                actor = new St.Label({ text: short_names[i] });
            let item = new LayoutMenuItem(this._config, i, actor, groups[i]);
            item._short_group_name = short_names[i];
            item._icon_name = icon_name;
            this._layoutItems.push(item);
            this.menu.addMenuItem(item, i);

            let shortLabel = new St.Label({ text: short_names[i] });
            this._labelActors.push(shortLabel);
            this._container.add_actor(shortLabel);
            this._container.set_skip_paint(shortLabel, true);
        }

        this._syncGroup();
    },

    _syncGroup: function() {
        let selected = this._config.get_current_group();

        if (this._selectedLayout) {
            this._selectedLayout.setShowDot(false);
            this._selectedLayout = null;
        }

        if (this._selectedLabel) {
            this._container.set_skip_paint(this._selectedLabel, true);
            this._selectedLabel = null;
        }

        let item = this._layoutItems[selected];
        item.setShowDot(true);

        this._iconActor.icon_name = item._icon_name;
        this._selectedLabel = this._labelActors[selected];
        this._container.set_skip_paint(this._selectedLabel, this._showFlags);

        this._selectedLayout = item;
    },

    _containerGetPreferredWidth: function(container, for_height, alloc) {
        // Here, and in _containerGetPreferredHeight, we need to query
        // for the height of all children, but we ignore the results
        // for those we don't actually display.
        let max_min_width = 0, max_natural_width = 0;
        if (this._showFlags)
            [max_min_width, max_natural_width] = this._iconActor.get_preferred_width(for_height);

        for (let i = 0; i < this._labelActors.length; i++) {
            let [min_width, natural_width] = this._labelActors[i].get_preferred_width(for_height);
            if (!this._showFlags) {
                max_min_width = Math.max(max_min_width, min_width);
                max_natural_width = Math.max(max_natural_width, natural_width);
            }
        }

        alloc.min_size = max_min_width;
        alloc.natural_size = max_natural_width;
    },

    _containerGetPreferredHeight: function(container, for_width, alloc) {
        let max_min_height = 0, max_natural_height = 0;
        if (this._showFlags)
            [max_min_height, max_natural_height] = this._iconActor.get_preferred_height(for_width);
        
        for (let i = 0; i < this._labelActors.length; i++) {
            let [min_height, natural_height] = this._labelActors[i].get_preferred_height(for_width);
            if (!this._showFlags) {
                max_min_height = Math.max(max_min_height, min_height);
                max_natural_height = Math.max(max_natural_height, natural_height);
            }
        }

        alloc.min_size = max_min_height;
        alloc.natural_size = max_natural_height;
    },

    _containerAllocate: function(container, box, flags) {
        // translate box to (0, 0)
        box.x2 -= box.x1;
        box.x1 = 0;
        box.y2 -= box.y1;
        box.y1 = 0;

        this._iconActor.allocate_align_fill(box, 0.5, 0, false, false, flags);
        for (let i = 0; i < this._labelActors.length; i++)
            this._labelActors[i].allocate_align_fill(box, 0.5, 0, false, false, flags);
    }
};
