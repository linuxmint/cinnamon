const St = imports.gi.St;
const Main = imports.ui.main;
const Lang = imports.lang;
const Tweener = imports.ui.tweener;

function PanelItemTooltip(panelItem, initTitle, orientation) {
    this._init(panelItem, initTitle, orientation);
}

PanelItemTooltip.prototype = {
    _init: function(panelItem, initTitle, orientation) {
        this._tooltip = new St.Label({ name: 'Tooltip' });
        this._tooltip.show_on_set_parent = false;
        this.orientation = orientation;
        if (initTitle) this._tooltip.set_text(initTitle);
        Main.uiGroup.add_actor(this._tooltip);

        panelItem.actor.connect('enter-event', Lang.bind(this, this._onEnterEvent));
        panelItem.actor.connect('leave-event', Lang.bind(this, this._onLeaveEvent));
        panelItem.actor.connect('motion-event', Lang.bind(this, this._onMotionEvent));
        panelItem.actor.connect('button-release-event', Lang.bind(this, this._onReleaseEvent));

        this._showTimer = null;
        this._visible = false;
        this._panelItem = panelItem;
        this.preventShow = false;
    },

    _onMotionEvent: function(actor, event) {
        Tweener.removeTweens(this);
        if (!this._visible){
            Tweener.addTween(this, {time: 0.3, onComplete: Lang.bind(this, this._onTimerComplete)});
            this._mousePosition = event.get_coords();
        }
    },

    _onEnterEvent: function(actor, event) {
        this.preventShow = false;
        Tweener.addTween(this, {time: 0.3, onComplete: Lang.bind(this, this._onTimerComplete)});        
        this._mousePosition = event.get_coords();
    },

    _onTimerComplete: function(){
        if (this._tooltip.get_text() != "") {
            this.show();
        }
    },

    _onLeaveEvent: function(actor, event) {
        this.hide();
    },

    _onReleaseEvent: function(actor, event) {
    	this.preventShow = true;
        this.hide();
    },

    hide: function() {
        Tweener.removeTweens(this);
        this._tooltip.hide();
        this._visible = false;
    },

    show: function() {
        //if (this._appButton.rightClickMenu.isOpen) return;
        if (this.preventShow || global.menuStackLength > 0) return;

        Tweener.removeTweens(this);

        let tooltipHeight = this._tooltip.get_allocation_box().y2-this._tooltip.get_allocation_box().y1;
        let tooltipWidth = this._tooltip.get_allocation_box().x2-this._tooltip.get_allocation_box().x1;

        let monitor;
        let tooltipTop;
        if (this.orientation == St.Side.BOTTOM) {
            monitor = Main.layoutManager.bottomMonitor;
            tooltipTop = monitor.y+monitor.height-tooltipHeight-this._panelItem.actor.get_allocation_box().y2+this._panelItem.actor.get_allocation_box().y1;
        }
        else {
            monitor = Main.layoutManager.primaryMonitor;
            tooltipTop = monitor.y+this._panelItem.actor.get_allocation_box().y2;
        }
        var tooltipLeft = this._mousePosition[0]- Math.round(tooltipWidth/2);
        if (tooltipLeft<monitor.x) tooltipLeft = monitor.x;
        if (tooltipLeft+tooltipWidth>monitor.x+monitor.width) tooltipLeft = (monitor.x+monitor.width)-tooltipWidth;

        this._tooltip.set_position(tooltipLeft, tooltipTop);

        this._tooltip.show();
        this._visible = true;
    },

    set_text: function(text) {
        this._tooltip.set_text(text);
    },

    destroy: function() {
       this._tooltip.destroy();
    }
}

function Tooltip(item, initTitle) {
    this._init(item, initTitle);
}

Tooltip.prototype = {
    _init: function(item, initTitle) {
        this._tooltip = new St.Label({ name: 'Tooltip' });
        this._tooltip.show_on_set_parent = false;

        if (initTitle) this._tooltip.set_text(initTitle);
        Main.uiGroup.add_actor(this._tooltip);

        item.connect('enter-event', Lang.bind(this, this._onEnterEvent));
        item.connect('leave-event', Lang.bind(this, this._onLeaveEvent));
        item.connect('motion-event', Lang.bind(this, this._onMotionEvent));
        item.connect('button-release-event', Lang.bind(this, this._onReleaseEvent));

        this._showTimer = null;
        this._visible = false;
        this._item = item;
        this.preventShow = false;
    },

    _onMotionEvent: function(actor, event) {
        Tweener.removeTweens(this);
        if (!this._visible){
            Tweener.addTween(this, {time: 0.3, onComplete: Lang.bind(this, this._onTimerComplete)});
            this._mousePosition = event.get_coords();
        }
    },

    _onEnterEvent: function(actor, event) {
        this.preventShow = false;
        Tweener.addTween(this, {time: 0.3, onComplete: Lang.bind(this, this._onTimerComplete)});
        this._mousePosition = event.get_coords();
    },

    _onTimerComplete: function(){
        if (this._tooltip.get_text() != "") {
            this.show();
        }
    },

    _onLeaveEvent: function(actor, event) {
        this.hide();
    },

    _onReleaseEvent: function(actor, event) {
    	this.preventShow = true;
        this.hide();
    },

    hide: function() {
        Tweener.removeTweens(this);
        this._tooltip.hide();
        this._visible = false;
    },

    show: function() {
        if (this.preventShow) return;

        Tweener.removeTweens(this);

        let tooltipWidth = this._tooltip.get_allocation_box().x2-this._tooltip.get_allocation_box().x1;

        let monitor = Main.layoutManager.findMonitorForActor(this._item);

        let tooltipTop = this._mousePosition[1];
        var tooltipLeft = this._mousePosition[0];

        if (tooltipLeft<0) tooltipLeft = 0;
        if (tooltipLeft+tooltipWidth>monitor.width) tooltipLeft = monitor.width-tooltipWidth;

        this._tooltip.set_position(tooltipLeft, tooltipTop);

        this._tooltip.show();
	this._tooltip.raise_top();
        this._visible = true;
    },

    set_text: function(text) {
        this._tooltip.set_text(text);
    },

    destroy: function() {
       this._tooltip.destroy();
    }
}
