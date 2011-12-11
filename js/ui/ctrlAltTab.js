// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Gdk = imports.gi.Gdk;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const AltTab = imports.ui.altTab;
const Main = imports.ui.main;
const Params = imports.misc.params;
const Tweener = imports.ui.tweener;

const POPUP_APPICON_SIZE = 96;
const POPUP_FADE_TIME = 0.1; // seconds

const SortGroup = {
    TOP:    0,
    MIDDLE: 1,
    BOTTOM: 2
};

function CtrlAltTabManager() {
    this._init();
}

CtrlAltTabManager.prototype = {
    _init: function() {
        this._items = [];
        this._focusManager = St.FocusManager.get_for_stage(global.stage);
    },

    addGroup: function(root, name, icon, params) {
        let item = Params.parse(params, { sortGroup: SortGroup.MIDDLE,
                                          proxy: root,
                                          focusCallback: null });

        item.root = root;
        item.name = name;
        item.iconName = icon;

        this._items.push(item);
        root.connect('destroy', Lang.bind(this, function() { this.removeGroup(root); }));
        this._focusManager.add_group(root);
    },

    removeGroup: function(root) {
        this._focusManager.remove_group(root);
        for (let i = 0; i < this._items.length; i++) {
            if (this._items[i].root == root) {
                this._items.splice(i, 1);
                return;
            }
        }
    },

    focusGroup: function(item) {
        if (global.stage_input_mode == Shell.StageInputMode.NONREACTIVE ||
            global.stage_input_mode == Shell.StageInputMode.NORMAL)
            global.set_stage_input_mode(Shell.StageInputMode.FOCUSED);

        if (item.window)
            Main.activateWindow(item.window);
        else if (item.focusCallback)
            item.focusCallback();
        else
            item.root.navigate_focus(null, Gtk.DirectionType.TAB_FORWARD, false);
    },

    // Sort the items into a consistent order; panel first, tray last,
    // and everything else in between, sorted by X coordinate, so that
    // they will have the same left-to-right ordering in the
    // Ctrl-Alt-Tab dialog as they do onscreen.
    _sortItems: function(a, b) {
        if (a.sortGroup != b.sortGroup)
            return a.sortGroup - b.sortGroup;

        let y;
        if (a.x == undefined) {
            if (a.window)
                a.x = a.window.get_compositor_private().x;
            else
                [a.x, y] = a.proxy.get_transformed_position();
        }
        if (b.x == undefined) {
            if (b.window)
                b.x = b.window.get_compositor_private().x;
            else
                [b.x, y] = b.proxy.get_transformed_position();
        }

        return a.x - b.x;
    },

    popup: function(backwards, mask) {
        // Start with the set of focus groups that are currently mapped
        let items = this._items.filter(function (item) { return item.proxy.mapped; });

        // And add the windows metacity would show in its Ctrl-Alt-Tab list
        if (!Main.overview.visible) {
            let screen = global.screen;
            let display = screen.get_display();
            let windows = display.get_tab_list(Meta.TabList.DOCKS, screen, screen.get_active_workspace ());
            let windowTracker = Shell.WindowTracker.get_default();
            let textureCache = St.TextureCache.get_default();
            for (let i = 0; i < windows.length; i++) {
                let icon;
                let app = windowTracker.get_window_app(windows[i]);
                if (app)
                    icon = app.create_icon_texture(POPUP_APPICON_SIZE);
                else
                    icon = textureCache.bind_pixbuf_property(windows[i], 'icon');
                items.push({ window: windows[i],
                             name: windows[i].title,
                             iconActor: icon,
                             sortGroup: SortGroup.MIDDLE });
            }
        }

        if (!items.length)
            return;

        items.sort(Lang.bind(this, this._sortItems));

        if (!this._popup) {
            this._popup = new CtrlAltTabPopup();
            this._popup.show(items, backwards, mask);

            this._popup.actor.connect('destroy',
                                      Lang.bind(this, function() {
                                          this._popup = null;
                                      }));
        }
    }
};

function mod(a, b) {
    return (a + b) % b;
}

function CtrlAltTabPopup() {
    this._init();
}

CtrlAltTabPopup.prototype = {
    _init : function() {
        this.actor = new Shell.GenericContainer({ name: 'ctrlAltTabPopup',
                                                  reactive: true });

        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));

        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));

        this._haveModal = false;
        this._modifierMask = 0;
        this._selection = 0;

        Main.uiGroup.add_actor(this.actor);
    },

    _getPreferredWidth: function (actor, forHeight, alloc) {
        let primary = Main.layoutManager.primaryMonitor;

        alloc.min_size = primary.width;
        alloc.natural_size = primary.width;
    },

    _getPreferredHeight: function (actor, forWidth, alloc) {
        let primary = Main.layoutManager.primaryMonitor;

        alloc.min_size = primary.height;
        alloc.natural_size = primary.height;
    },

    _allocate: function (actor, box, flags) {
        let childBox = new Clutter.ActorBox();
        let primary = Main.layoutManager.primaryMonitor;

        let leftPadding = this.actor.get_theme_node().get_padding(St.Side.LEFT);
        let vPadding = this.actor.get_theme_node().get_vertical_padding();
        let hPadding = this.actor.get_theme_node().get_horizontal_padding();

        let [childMinHeight, childNaturalHeight] = this._switcher.actor.get_preferred_height(primary.width - hPadding);
        let [childMinWidth, childNaturalWidth] = this._switcher.actor.get_preferred_width(childNaturalHeight);
        childBox.x1 = Math.max(primary.x + leftPadding, primary.x + Math.floor((primary.width - childNaturalWidth) / 2));
        childBox.x2 = Math.min(primary.width - hPadding, childBox.x1 + childNaturalWidth);
        childBox.y1 = primary.y + Math.floor((primary.height - childNaturalHeight) / 2);
        childBox.y2 = childBox.y1 + childNaturalHeight;
        this._switcher.actor.allocate(childBox, flags);
    },

    show : function(items, startBackwards, mask) {
        if (!Main.pushModal(this.actor))
            return false;
        this._haveModal = true;
        this._modifierMask = AltTab.primaryModifier(mask);

        this._keyPressEventId = this.actor.connect('key-press-event', Lang.bind(this, this._keyPressEvent));
        this._keyReleaseEventId = this.actor.connect('key-release-event', Lang.bind(this, this._keyReleaseEvent));

        this._items = items;
        this._switcher = new CtrlAltTabSwitcher(items);
        this.actor.add_actor(this._switcher.actor);

        if (startBackwards)
            this._selection = this._items.length - 1;
        this._select(this._selection);

        let [x, y, mods] = global.get_pointer();
        if (!(mods & this._modifierMask)) {
            this._finish();
            return false;
        }

        this.actor.opacity = 0;
        this.actor.show();
        Tweener.addTween(this.actor,
                         { opacity: 255,
                           time: POPUP_FADE_TIME,
                           transition: 'easeOutQuad'
                         });

        return true;
    },

    _next : function() {
        return mod(this._selection + 1, this._items.length);
    },

    _previous : function() {
        return mod(this._selection - 1, this._items.length);
    },

    _keyPressEvent : function(actor, event) {
        let keysym = event.get_key_symbol();
        let shift = (Shell.get_event_state(event) & Clutter.ModifierType.SHIFT_MASK);
        if (shift && keysym == Clutter.KEY_Tab)
            keysym = Clutter.ISO_Left_Tab;

        if (keysym == Clutter.KEY_Escape)
            this.destroy();
        else if (keysym == Clutter.KEY_Tab)
            this._select(this._next());
        else if (keysym == Clutter.KEY_ISO_Left_Tab)
            this._select(this._previous());
        else if (keysym == Clutter.KEY_Left)
            this._select(this._previous());
        else if (keysym == Clutter.KEY_Right)
            this._select(this._next());

        return true;
    },

    _keyReleaseEvent : function(actor, event) {
        let [x, y, mods] = global.get_pointer();
        let state = mods & this._modifierMask;

        if (state == 0)
            this._finish();

        return true;
    },

    _finish : function() {
        this.destroy();

        Main.ctrlAltTabManager.focusGroup(this._items[this._selection]);
    },

    _popModal: function() {
        if (this._haveModal) {
            Main.popModal(this.actor);
            this._haveModal = false;
        }
    },

    destroy : function() {
        this._popModal();
        Tweener.addTween(this.actor,
                         { opacity: 0,
                           time: POPUP_FADE_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this,
                               function() {
                                   this.actor.destroy();
                               })
                         });
    },

    _onDestroy : function() {
        this._popModal();
        if (this._keyPressEventId)
            this.actor.disconnect(this._keyPressEventId);
        if (this._keyReleaseEventId)
            this.actor.disconnect(this._keyReleaseEventId);
    },

    _select : function(num) {
        this._selection = num;
        this._switcher.highlight(num);
    }
};

function CtrlAltTabSwitcher(items) {
    this._init(items);
}

CtrlAltTabSwitcher.prototype = {
    __proto__ : AltTab.SwitcherList.prototype,

    _init : function(items) {
        AltTab.SwitcherList.prototype._init.call(this, true);

        for (let i = 0; i < items.length; i++)
            this._addIcon(items[i]);
    },

    _addIcon : function(item) {
        let box = new St.BoxLayout({ style_class: 'alt-tab-app',
                                     vertical: true });

        let icon = item.iconActor;
        if (!icon) {
            icon = new St.Icon({ icon_name: item.iconName,
                                 icon_type: St.IconType.SYMBOLIC,
                                 icon_size: POPUP_APPICON_SIZE });
        }
        box.add(icon, { x_fill: false, y_fill: false } );

        let text = new St.Label({ text: item.name });
        box.add(text, { x_fill: false });

        this.addItem(box, text);
    }
};
