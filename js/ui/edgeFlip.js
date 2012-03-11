const Main = imports.ui.main;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;

function EdgeFlipper(side, func, monitor){
    this._init(side, func, monitor);
}

EdgeFlipper.prototype = {
    _init: function(side, func, monitor){
	this.monitor = monitor;
	this.side = side;
	this.func = func;

	this.actor = new Cinnamon.GenericContainer({reactive: true});
	this.set();

	this.entered = false;
	this.actor.connect('enter-event', Lang.bind(this, this._onMouseEnter));
	this.actor.connect('leave-event', Lang.bind(this, this._onMouseLeave));
    },

    set: function(){
	if (this.side == St.Side.TOP){
	    this.actor.set_size(this.monitor.width, 1);
	} else if (this.side == St.Side.BOTTOM){
	    this.actor.set_size(this.monitor.width, 1);
	    this.actor.set_position(0, this.monitor.height-1);
	} else if (this.side == St.Side.LEFT) {
	    this.actor.set_size(1, this.monitor.height);
	} else if (this.side == St.Side.RIGHT){
	    this.actor.set_size(1, this.monitor.height);
	    this.actor.set_position(this.monitor.width - 1, 0);
	}
    },

    show: function(){
	this.actor.show();
    },

    hide: function(){
	this.actor.hide();
    },

    _onMouseEnter: function(){
	this.entered = true;
	//this.actor.add_style_pseudo_class('hover');
	Mainloop.timeout_add(1000, Lang.bind(this, this._check));
    },

    _check: function(){
	global.logError("Hello World");
	if (this.entered){
	    this.func();
	}
    },

    _onMouseLeave: function(){
	this.entered = false;
    }
};
