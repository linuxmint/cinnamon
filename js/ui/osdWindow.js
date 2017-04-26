const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Tweener = imports.ui.tweener;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const Meta = imports.gi.Meta;

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

        this.actor = new St.Bin({ style_class: 'level',
                                  x_align: St.Align.START,
                                  y_fill: true,
                                  important: true });
        this._bar = new St.Widget({ style_class: 'level-bar',
                                    important: true });

        this.actor.set_child(this._bar);
    },

    get level() {
        return this._level;
    },

    set level(value) {
        this._level = Math.max(0, Math.min(value, 100));

        let alloc = this.actor.get_allocation_box();
        let newWidth = Math.round((alloc.x2 - alloc.x1) * this._level / 100);
        if (newWidth != this._bar.width)
        this._bar.width = newWidth;
    },

    setLevelBarHeight: function(sizeMultiplier) {
        let themeNode = this.actor.get_theme_node();
        let height = themeNode.get_height();
        let newHeight = Math.floor(height * sizeMultiplier);
        this.actor.set_height(newHeight);
    }
};

function OsdWindow(monitorIndex) {
    this._init(monitorIndex);
}

OsdWindow.prototype = {
    _init: function(monitorIndex) {
        this._popupSize = 0;

        this._osdSettings = new Gio.Settings({ schema_id: "org.cinnamon" });
        this._osdSettings.connect("changed::show-media-keys-osd", Lang.bind(this, this._onOsdSettingsChanged));

        this._monitorIndex = monitorIndex;

        this.actor = new St.BoxLayout({ style_class: 'osd-window',
                                       vertical: true,
                                       important: true });

        this._icon = new St.Icon();
        this.actor.add(this._icon, { expand: true });

        this._level = new LevelBar();
        this.actor.add(this._level.actor);

        this._hideTimeoutId = 0;
        this._reset();

        Main.layoutManager.connect('monitors-changed', Lang.bind(this, this._monitorsChanged));
        this._onOsdSettingsChanged();

        Main.uiGroup.add_child(this.actor);
    },

    setIcon: function(icon) {
        this._icon.gicon = icon;
    },

    setLevel: function(level) {
        this._level.actor.visible = (level != undefined);
        if (level != undefined) {
            if (this.actor.visible)
                Tweener.addTween(this._level,
                                 { level: level,
                                   time: LEVEL_ANIMATION_TIME,
                                   transition: 'easeOutQuad' });
            else
                this._level.level = level;
        }
    },

    show: function() {
        if (this._osdBaseSize == undefined)
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
                               Meta.enable_unredirect_for_screen(global.screen);
                           })
                         });
    },

    _reset: function() {
        this.actor.hide();
        this.setLevel(null);
    },

    _monitorsChanged: function() {
        let monitor = Main.layoutManager.monitors[this._monitorIndex];
        if (monitor) {
            let scaleW = monitor.width / 640.0;
            let scaleH = monitor.height / 480.0;
            let scale = Math.min(scaleW, scaleH);
            this._popupSize = this._osdBaseSize * Math.max(1, scale);

            let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
            this._icon.icon_size = this._popupSize / (2 * scaleFactor);
            this.actor.set_size(this._popupSize, this._popupSize);
            this.actor.translation_y = (monitor.height + monitor.y) - (this._popupSize + (50 * scaleFactor));
            this.actor.translation_x = ((monitor.width / 2) + monitor.x) - (this._popupSize / 2);
        }
    },

    _onOsdSettingsChanged: function() {
        let currentSize = this._osdSettings.get_string("show-media-keys-osd");

        switch (currentSize) {
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

        this._monitorsChanged();
    }
};

function OsdWindowManager() {
    this._init();
}

OsdWindowManager.prototype = {
    _init: function() {
        this._osdWindows = [];

        Main.layoutManager.connect('monitors-changed',
                                   Lang.bind(this, this._monitorsChanged));
        this._monitorsChanged();
    },

    _monitorsChanged: function() {
        for (let i = 0; i < Main.layoutManager.monitors.length; i++) {
            if (this._osdWindows[i] == undefined)
                this._osdWindows[i] = new OsdWindow(i);
        }

        for (let i = Main.layoutManager.monitors.length; i < this._osdWindows.length; i++) {
            this._osdWindows[i].actor.destroy();
            this._osdWindows[i] = null;
        }

        this._osdWindows.length = Main.layoutManager.monitors.length;
    },

    _showOsdWindow: function(monitorIndex, icon, level) {
        this._osdWindows[monitorIndex].setIcon(icon);
        this._osdWindows[monitorIndex].setLevel(level);
        this._osdWindows[monitorIndex].show();
    },

    show: function(monitorIndex, icon, level, convertIndex) {
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
        for (let i = 0; i < this._osdWindows.length; i++)
            this._osdWindows[i].cancel();
    }
};
