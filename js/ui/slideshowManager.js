// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const CinnamonBg = imports.gi.CinnamonBg;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

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
        this._hadSlideshow = false;

        // The key, not a model: this only decides whether to start the daemon,
        // which watches the configuration itself from there and exits when the
        // last slideshow is switched off.
        this._settings = new Gio.Settings({ schema_id: "org.cinnamon.desktop.background" });
        this._settings.connect("changed::picture-uri-list", () => this._sync());

        new proxy(Gio.DBus.session, 'org.Cinnamon.Slideshow', '/org/Cinnamon/Slideshow',
                  (obj, error) => {
                      if (error) {
                          global.logWarning("SlideshowManager: could not reach the slideshow daemon: "
                                            + error.message);
                          return;
                      }
                      this.proxy = obj;
                      this._sync();
                  },
                  null,
                  Gio.DBusProxyFlags.DO_NOT_AUTO_START_AT_CONSTRUCTION);
    },

    // Only ever starts the daemon; it quits on its own if it has nothing to do.
    // Every rotation rewrites picture-uri-list, so act on the transition rather
    // than the signal: a tick cannot switch a slideshow on.
    _sync: function() {
        // Nothing can be started yet, and latching below would consume the
        // transition that starting depends on.
        if (!this.proxy)
            return;

        let hasSlideshow = CinnamonBg.List.has_slideshow();

        if (hasSlideshow && !this._hadSlideshow)
            this.begin();

        this._hadSlideshow = hasSlideshow;
    },

    _logRemoteError: function(method) {
        return (result, error) => {
            if (error)
                global.logWarning("SlideshowManager: " + method + " failed: " + error.message);
        };
    },

    begin: function() {
        if (this.proxy)
            this.proxy.beginRemote(this._logRemoteError("begin"));
    },

    end: function() {
        if (this.proxy)
            this.proxy.endRemote(this._logRemoteError("end"));
    },

    getNextImage: function() {
        if (this.proxy)
            this.proxy.getNextImageRemote(this._logRemoteError("getNextImage"));
    }
};
