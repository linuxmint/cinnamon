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
        let icon = new Gio.FileIcon({file: Gio.File.new_for_path("/usr/share/plymouth/themes/mint-logo/spinner.png") });
        this.spinner = St.TextureCache.get_default().load_gicon(null, icon, icon_size);

        icon = new Gio.FileIcon({file: Gio.File.new_for_path("/usr/share/plymouth/themes/mint-logo/logo.png") });
        this.logo = St.TextureCache.get_default().load_gicon(null, icon, icon_size);

        Main.layoutManager.addChrome(this.spinner);
        Main.layoutManager.addChrome(this.logo);

        let monitor = this.primaryMonitorInfo;

        let x = monitor.x + monitor.width / 2.0;
        let y = monitor.y + monitor.height / 2.0;

        this.logo.x = this.spinner.x = x - (icon_size / 2);
        this.logo.y = this.spinner.y = y - (icon_size / 2);

        this.spinner.rotation_angle_z = 360.0 * 4
        this.spinner.set_pivot_point(.5, .5);
    },

    run: function() {
        Tweener.addTween(this.spinner,
                         { time: 0.7,
                           transition: 'easeNone',
                           rotation_angle_z: 0,
                           onComplete: this._logo_fade,
                           onCompleteScope: this });
    },

    _logo_fade: function() {
        Tweener.addTween(this.spinner,
                         { time: 0.7,
                           transition: 'easeInExpo',
                           opacity: 0,
                           onUpdate: ()=>{
                               this.logo.opacity = this.spinner.opacity;
                           },
                           onComplete: this._all_fade,
                           onCompleteScope: this });
    },

    _all_fade: function() {
        Tweener.addTween(this.shroud,
                         { time: 0.5,
                           transition: 'easeNone',
                           opacity: 0,
                           onComplete: this._finished,
                           onCompleteScope: this });
    },

    _finished: function() {
        this.logo.destroy();
        this.spinner.destroy();
        this.shroud.destroy();

        this.logo = null;
        this.spinner = null;
        this.shroud = null;

        this.onCompleteFunc();
    }
};
