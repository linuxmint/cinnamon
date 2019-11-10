// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const Gio = imports.gi.Gio;
const Tweener = imports.ui.tweener;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Main = imports.ui.main;

function Splash(primaryMonitorInfo, onCompleteFunc) {
    this._init(primaryMonitorInfo, onCompleteFunc);
}

Splash.prototype = {
    _init: function(primaryMonitorInfo, onCompleteFunc) {
        // this is a Monitor object from panel.js, with x, y, width, height, index
        this.primaryMonitorInfo = primaryMonitorInfo;
        this.onCompleteFunc = onCompleteFunc; // This must be run when all finished and cleaned up, this re-enters layout.js
    },

    /* This method is mandatory.  Setup is called prior to the animation being run - here you should construct all
     * of your actors, and add them to the stage. Use Main.layoutManager.addChrome() to do this. */
    setup: function() {
        this.shroud = new Clutter.Actor({ width: global.screen_width,
                                          height: global.screen_height,
                                          reactive: false,
                                          background_color: new Clutter.Color( { red: 0, green: 0, blue: 0, alpha: 255}) });
        Main.layoutManager.addChrome(this.shroud);

        let icon_size = 128 * global.ui_scale;
        let x = this.primaryMonitorInfo.x + this.primaryMonitorInfo.width / 2.0;
        let y = this.primaryMonitorInfo.y + this.primaryMonitorInfo.height / 2.0;

        this.logo = St.TextureCache.get_default().load_icon_name(null, "cinnamon", St.IconType.FULLCOLOR, icon_size);
        this.logo.x = this.logo.x = x - (icon_size / 2);
        this.logo.y = this.logo.y = y - (icon_size / 2);

        Main.layoutManager.addChrome(this.logo);
    },

    /* This method is mandatory.  At the end of startup, run is called - this is where you start
     * your animation or whatever - you can chain into multiple tweens or whatever. */
    run: function() {
        Tweener.addTween(this.logo,
                         { time: .75,
                           opacity: 0,
                           transition: 'easeInExpo',
                           onComplete: this._fade_shroud,
                           onCompleteScope: this });
    },

    _fade_shroud: function() {
        Tweener.addTween(this.shroud,
                         { time: .75,
                           transition: 'easeNone',
                           opacity: 0,
                           onComplete: this._finished,
                           onCompleteScope: this });
    },

    /* Some sort of cleanup/exit function must be called as the last thing, to destroy your actors,
     * then finally call this.onCompleteFunc() */
    _finished: function() {
        this.shroud.destroy();
        this.shroud = null;
        this.logo.destroy();
        this.logo = null;

        /* This is mandatory */
        this.onCompleteFunc();
    }
};
