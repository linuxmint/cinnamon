// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Lang = imports.lang;

const dbusIFace =
    '<node> \
        <interface name="org.Cinnamon.Slideshow"> \
            <method name="begin" /> \
            <method name="end" /> \
            <method name="getNextImage" /> \
        </interface> \
    </node>';

const proxy = Gio.DBusProxy.makeProxyWrapper(dbusIFace);

function SlideshowManager() {
    this._init();
}

SlideshowManager.prototype = {

    _init: function() {
        this.proxy = null;
        this._slideshowSettings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.background.slideshow" });
        this._slideshowSettings.connect("changed::slideshow-enabled", Lang.bind(this, this._onSlideshowEnabledChanged));

        if (this._slideshowSettings.get_boolean("slideshow-enabled")) {
            this.begin();
        }
    },

    _onSlideshowEnabledChanged: function() {
        if (this._slideshowSettings.get_boolean("slideshow-enabled"))
            this.begin();
        else
            this.end();
    },

    ensureProxy: function() {
        if (!this.proxy)
            this.proxy = new proxy(Gio.DBus.session, 'org.Cinnamon.Slideshow', '/org/Cinnamon/Slideshow');
    },

    begin: function() {
        this.ensureProxy();
        this.proxy.beginRemote();
    },

    end: function() {
        this.ensureProxy();
        this.proxy.endRemote();
    },

    getNextImage: function() {
        this.ensureProxy();
        this.proxy.getNextImageRemote();
    }
};
