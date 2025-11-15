// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lightbox = imports.ui.lightbox;
const Main = imports.ui.main;

const FLASHSPOT_ANIMATION_TIME = 200; // seconds

var Flashspot = class Flashspot extends Lightbox.Lightbox {
    constructor(area) {
        super(
            Main.uiGroup,
            {
                inhibitEvents: true,
                width: area.width,
                height: area.height
            }
        );

        this.actor.style_class = 'flashspot';
        this.actor.set_position(area.x, area.y);
        if (area.time)
            this.animation_time = area.time;
        else
            this.animation_time = FLASHSPOT_ANIMATION_TIME;
   }

   fire() {
        this.actor.show();
        this.actor.opacity = 255;
        this.actor.ease({
            opacity: 0,
            duration: this.animation_time,
            animationRequired: true,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._onFireShowComplete()
        });
   }

   _onFireShowComplete () {
        this.destroy();
   }
};

