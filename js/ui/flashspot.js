// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;

const Lightbox = imports.ui.lightbox;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const FLASHSPOT_ANIMATION_TIME = 0.15; // seconds

function Flashspot(area) {
   this._init(area);
}
Flashspot.prototype = {
   __proto__: Lightbox.Lightbox.prototype,

   _init: function(area) {
      Lightbox.Lightbox.prototype._init.call(this, Main.uiGroup, {
         inhibitEvents: true,
         width: area.width,
         height: area.height
      });
      this.actor.style_class = 'flashspot';
      this.actor.set_position(area.x, area.y);
      if (area.time)
        this.animation_time = area.time;
      else
        this.animation_time = FLASHSPOT_ANIMATION_TIME;
   },

   fire: function() {
      this.actor.opacity = 0;
      Tweener.addTween(this.actor,
                      { opacity: 255,
                        time: this.animation_time,
                        transition: 'linear',
                        onComplete: Lang.bind(this, this._onFireShowComplete)
                      });
      this.actor.show();
   },

   _onFireShowComplete: function() {
      Tweener.addTween(this.actor,
                      { opacity: 0,
                        time: this.animation_time,
                        transition: 'linear',
                        onComplete: Lang.bind(this, function() {
                            this.destroy();
                        })
                      });
   }
};

