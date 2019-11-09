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
        this.primaryMonitorInfo = primaryMonitorInfo;
        this.onCompleteFunc = onCompleteFunc;
    },

    setup: function() {
        this.shroud = new Clutter.Actor({ width: global.screen_width,
                                          height: global.screen_height,
                                          reactive: false,
                                          background_color: new Clutter.Color( { red: 0, green: 0, blue: 0, alpha: 255}) });
        Main.layoutManager.addChrome(this.shroud);

        let icon_size = 128 * global.ui_scale;
        let x = this.primaryMonitorInfo.x + this.primaryMonitorInfo.width / 2.0;
        let y = this.primaryMonitorInfo.y + this.primaryMonitorInfo.height / 2.0;

        let node = St.ThemeContext.get_for_stage(global.stage).get_root_node();

        this.logo = St.TextureCache.get_default().load_icon_name(node, "cinnamon", St.IconType.FULLCOLOR, icon_size);
        this.logo.x = this.logo.x = x - (icon_size / 2);
        this.logo.y = this.logo.y = y - (icon_size / 2);

        Main.layoutManager.addChrome(this.logo);
    },

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

    _finished: function() {
        this.shroud.destroy();
        this.shroud = null;
        this.logo.destroy();
        this.logo = null;

        this.onCompleteFunc();
    }
};
