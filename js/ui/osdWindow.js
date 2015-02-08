const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Tweener = imports.ui.tweener;
const Gio = imports.gi.Gio;

const LEVEL_ANIMATION_TIME = 0.1;
const FADE_TIME = 0.1;
const HIDE_TIMEOUT = 1500;

const OSD_SIZE = 110;

function LevelBar() {
    this._init();
}

LevelBar.prototype = {
    _init: function() {
        this._level = 0;

        this.actor = new St.Bin({ style_class: 'level',
                                  x_fill: true,
                                  y_fill: true,
                                  important: true });
        this._bar = new St.DrawingArea();
        this._bar.connect('repaint', Lang.bind(this, this._repaint));

        this.actor.set_child(this._bar);
    },

    get level() {
        return this._level;
    },

    set level(value) {
        let newValue = Math.max(0, Math.min(value, 100));
        if (newValue == this._level)
            return;
        this._level = newValue;
        this._bar.queue_repaint();
    },

    setLevelBarHeight: function(sizeMultiplier) {
        let themeNode = this.actor.get_theme_node();
        let height = themeNode.get_height();
        let newHeight = Math.floor(height * sizeMultiplier);
        this.actor.set_height(newHeight);
    },

    _repaint:function() {
        let cr = this._bar.get_context();

        let node = this.actor.get_theme_node();
        let radius = node.get_border_radius(0);
        Clutter.cairo_set_source_color(cr, node.get_foreground_color());

        let [w, h] = this._bar.get_surface_size();
        w *= (this._level / 100.0);

        if (w == 0)
            return;

        cr.moveTo(radius, 0);
        if (w >= radius)
            cr.arc(w - radius, radius, radius, 1.5 * Math.PI, 2.0 * Math.PI);
        else
            cr.lineTo(w, 0);
        if (w >= radius)
            cr.arc(w - radius, h - radius, radius, 0, 0.5 * Math.PI);
        else
            cr.lineTo(w, h);
        cr.arc(radius, h - radius, radius, 0.5 * Math.PI, Math.PI);
        cr.arc(radius, radius, radius, Math.PI, 1.5 * Math.PI);
        cr.fill();
        cr.$dispose();
    }
};

function OsdWindow() {
    this._init();
}

OsdWindow.prototype = {
    _init: function() {
        this._popupSize = 0;

        this._osdSettings = new Gio.Settings({ schema: "org.cinnamon" });
        this._osdSettings.connect("changed::show-media-keys-osd", Lang.bind(this, this._onOsdSettingsChanged));

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

        Main.layoutManager.addChrome(this.actor, { affectsInputRegion: false });
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
            this._level.setLevelBarHeight(this._sizeMultiplier);
            this.actor.show();
            this.actor.raise_top();
            this.actor.opacity = 0;

            Tweener.addTween(this.actor,
                             { opacity: 255,
                               time: FADE_TIME,
                               transition: 'easeOutQuad' });
        }

        if (this._hideTimeoutId)
            Mainloop.source_remove(this._hideTimeoutId);
        this._hideTimeoutId = Mainloop.timeout_add(HIDE_TIMEOUT, Lang.bind(this, this._hide));
    },

    _hide: function() {
        this._hideTimeoutId = 0;
        Tweener.addTween(this.actor,
                         { opacity: 0,
                           time: FADE_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this, this._reset) });
    },

    _reset: function() {
        this.actor.hide();
        this.setLevel(null);
    },

    _monitorsChanged: function() {
        let monitor = Main.layoutManager.primaryMonitor;
        let scaleW = monitor.width / 640.0;
        let scaleH = monitor.height / 480.0;
        let scale = Math.min(scaleW, scaleH);
        this._popupSize = this._osdBaseSize * Math.max(1, scale);

        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this._icon.icon_size = this._popupSize / (2 * scaleFactor);
        this.actor.set_size(this._popupSize, this._popupSize);
        this.actor.translation_y = monitor.height - (this._popupSize + (50 * scaleFactor));
        this.actor.translation_x = (monitor.width / 2) - (this._popupSize / 2);
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