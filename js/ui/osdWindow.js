const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Tweener = imports.ui.tweener;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const Meta = imports.gi.Meta;
const Cinnamon = imports.gi.Cinnamon;

const LEVEL_ANIMATION_TIME = 0.1;
const FADE_TIME = 0.1;
const HIDE_TIMEOUT = 1500;

const OSD_SIZE = 110;

function convertGdkIndex(monitorIndex) {
    let screen = Gdk.Screen.get_default();
    let rect = screen.get_monitor_geometry(monitorIndex);
    let cx = rect.x + rect.width / 2;
    let cy = rect.y + rect.height / 2;
    for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
        let monitor = Main.layoutManager.monitors[i];
        if (cx >= monitor.x && cx < monitor.x + monitor.width &&
            cy >= monitor.y && cy < monitor.y + monitor.height)
            monitorIndex = i;
    }

    return monitorIndex;
};

function LevelBar() {
    this._init();
}

LevelBar.prototype = {
    _init: function() {
        this._level = 0;

        this.initial = true;

        this.actor = new Cinnamon.GenericContainer({ style_class: 'level',
                                                     x_align: St.Align.START,
                                                     important: true });
        this.actor.connect("allocate", this._allocate_bar.bind(this));

        this._bar = new St.Widget({ style_class: 'level-bar',
                                    important: true });
        this.actor.add_actor(this._bar);
    },

    _allocate_bar: function(actor, box, flags) {
        let level_box = box.copy();

        let new_width = (level_box.x2 - level_box.x1) * (this._level / 100);
        level_box.x2 = Math.min((level_box.x1 + new_width), box.x2);
        this._bar.allocate(level_box, flags);
    },

    get level() {
        return this._level;
    },

    set level(value) {
        this._level = Math.max(0, Math.min(value, 100));

        let newWidth = this.actor.width * (this._level / 100);

        if (newWidth != this._bar.width) {
            this._bar.width = newWidth;
        }

        this.actor.queue_redraw();
    },

    setLevelBarHeight: function(sizeMultiplier) {
        let themeNode = this.actor.get_theme_node();
        let height = themeNode.get_height();
        let newHeight = Math.floor(height * sizeMultiplier);
        this.actor.set_height(newHeight);
    }
};

function OsdWindow(monitorIndex, size) {
    this._init(monitorIndex, size);
}

OsdWindow.prototype = {
    _init: function(monitorIndex, size) {
        this._popupSize = 0;
        this._osdBaseSize = null;

        this._monitorIndex = monitorIndex;

        this.actor = new St.BoxLayout({ style_class: 'osd-window',
                                       vertical: true,
                                       important: true });

        this._icon = new St.Icon();
        this.actor.add(this._icon, { expand: true });

        this._level = new LevelBar();
        this.actor.add(this._level.actor);
        
        this._label = new St.Label();
        this._label.style = 'font-size: 1.2em; text-align: center;'
        this.actor.add(this._label);

        this._hideTimeoutId = 0;
        this._reset();

        Main.uiGroup.add_child(this.actor);

        this._sizeAndPosition(size);
    },

    setIcon: function(icon) {
        this._icon.gicon = icon;
    },

    setLevel: function(level) {
        if (level != undefined) {
            this._label.set_text(String(level) + " %");
            this._label.visible = this._level.actor.visible = true;

            if (this.actor.visible)
                Tweener.addTween(this._level,
                                 { level: level,
                                   time: LEVEL_ANIMATION_TIME,
                                   transition: 'easeOutQuad' });
            else
                this._level.level = level;
        } else {
            this._label.set_text("");
            this._label.visible = this._level.actor.visible = false;
        }
    },

    show: function() {
        if (this._osdBaseSize == null)
            return;

        if (!this._icon.gicon)
            return;

        if (!this.actor.visible) {
            Meta.disable_unredirect_for_screen(global.screen);
            this._level.setLevelBarHeight(this._sizeMultiplier);
            this.actor.show();
            this.actor.opacity = 0;
            this.actor.raise_top();

            Tweener.addTween(this.actor,
                             { opacity: 255,
                               time: FADE_TIME,
                               transition: 'easeOutQuad' });
        }

        if (this._hideTimeoutId)
            Mainloop.source_remove(this._hideTimeoutId);
        this._hideTimeoutId = Mainloop.timeout_add(HIDE_TIMEOUT, Lang.bind(this, this._hide));
    },

    cancel: function() {
        if (!this._hideTimeoutId)
            return;

        Mainloop.source_remove(this._hideTimeoutId);
        this._hide();
    },

    _hide: function() {
        this._hideTimeoutId = 0;
        Tweener.addTween(this.actor,
                         { opacity: 0,
                           time: FADE_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this, function() {
                               this._reset();
                               Meta.enable_unredirect_for_display(global.display);
                           })
                         });
    },

    _reset: function() {
        this.actor.hide();
    },

    destroy: function() {
        Main.uiGroup.remove_child(this.actor);
        this.actor.destroy();
    },

    _sizeAndPosition: function(sizeFromSettings) {
        switch (sizeFromSettings) {
            case "disabled":
                this._osdBaseSize = null;
                break;
            case "small":
                this._sizeMultiplier = 0.7;
                this._osdBaseSize = Math.floor(OSD_SIZE * this._sizeMultiplier);
                break;
            case "large":
                this._sizeMultiplier = 1.0;
                this._osdBaseSize = OSD_SIZE;
                break;
            default:
                this._sizeMultiplier = 0.85;
                this._osdBaseSize = Math.floor(OSD_SIZE * this._sizeMultiplier);
        }

        let monitor = Main.layoutManager.monitors[this._monitorIndex];
        if (monitor) {
            let scaleW = monitor.width / 640.0;
            let scaleH = monitor.height / 480.0;
            let scale = Math.min(scaleW, scaleH);
            this._popupSize = this._osdBaseSize * Math.max(1, scale);

            let scaleFactor = global.ui_scale;
            this._icon.icon_size = this._popupSize / (2 * scaleFactor);
            this.actor.set_size(this._popupSize, this._popupSize);
            this.actor.translation_y = (monitor.height + monitor.y) - (this._popupSize + (50 * scaleFactor));
            this.actor.translation_x = ((monitor.width / 2) + monitor.x) - (this._popupSize / 2);

            if (monitor.height < 900 && ["small", "medium"].includes(sizeFromSettings)) {
                let spacing = this.actor.get_theme_node().get_length ("spacing");
                let multiplier = 1.0;

                if (sizeFromSettings === "small") {
                    this._label.style = 'font-size: 0.8em; text-align: center;'
                    multiplier = 0.6;
                } else
                if (sizeFromSettings === "medium") {
                    this._label.style = 'font-size: 1.0em; text-align: center;'
                    multiplier = 0.8;
                }

                this.actor.style = `spacing: ${Math.floor(spacing * multiplier)}px;`;
            } else {
                this._label.style = 'font-size: 1.2em; text-align: center;'
                this.actor.style = null;
            }
        }
    }
};

function OsdWindowManager() {
    this._init();
}

OsdWindowManager.prototype = {
    _init: function() {
        this._osdWindows = [];

        Main.layoutManager.connect('monitors-changed', Lang.bind(this, this._layoutChanged));
        this._osdSettings = new Gio.Settings({ schema_id: "org.cinnamon" });
        this._osdSettings.connect("changed::show-media-keys-osd", Lang.bind(this, this._layoutChanged));

        this._layoutChanged();
    },

    _layoutChanged: function() {
        this._osdWindows.forEach((osd) => {
            osd.destroy();
        })

        this._osdWindows = [];
        let size = this._osdSettings.get_string("show-media-keys-osd");

        if (size === "disabled")
            return;

        for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
            if (this._osdWindows[i] == undefined)
                this._osdWindows[i] = new OsdWindow(i, size);
        }
    },

    _showOsdWindow: function(monitorIndex, icon, level) {
        this._osdWindows[monitorIndex].setIcon(icon);
        this._osdWindows[monitorIndex].setLevel(level);
        this._osdWindows[monitorIndex].show();
    },

    show: function(monitorIndex, icon, level, convertIndex) {
        if (this._osdWindows.length === 0)
            return;

        if (monitorIndex != -1) {
            if (convertIndex)
                monitorIndex = convertGdkIndex(monitorIndex);
            for (let i = 0; i < this._osdWindows.length; i++) {
                if (i == monitorIndex)
                    this._showOsdWindow(i, icon, level);
                else
                    this._osdWindows[i].cancel();
            }
        } else {
            for (let i = 0; i < this._osdWindows.length; i++)
                this._showOsdWindow(i, icon, level);
        }
    },

    hideAll: function() {
        if (this._osdWindows.length === 0)
            return;

        for (let i = 0; i < this._osdWindows.length; i++)
            this._osdWindows[i].cancel();
    }
};
