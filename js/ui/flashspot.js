// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const Lightbox = imports.ui.lightbox;
const Main = imports.ui.main;

const FLASHSPOT_ANIMATION_TIME = 200; // seconds

var Flashspot = GObject.registerClass(
class Flashspot extends Lightbox.Lightbox {
    _init(area) {
        super._init(
            Main.uiGroup,
            {
                inhibitEvents: true,
                width: area.width,
                height: area.height
            }
        );

        this.style_class = 'flashspot';
        this.set_position(area.x, area.y);
        if (area.time)
            this.animationTime = area.time;
        else
            this.animationTime = FLASHSPOT_ANIMATION_TIME;
   }

   fire() {
        this.show();
        this.opacity = 255;
        this.ease({
            opacity: 0,
            duration: this.animationTime,
            animationRequired: true,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._onFireShowComplete()
        });
   }

   _onFireShowComplete () {
        this.destroy();
   }
});

