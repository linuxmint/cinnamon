const Mainloop = imports.mainloop;
const St = imports.gi.St;
const Applet = imports.ui.applet;
const Main = imports.ui.main;
const Lang = imports.lang;
const Tweener = imports.ui.tweener;

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
        item.connect('button-press-event', Lang.bind(this, this.hide));
        item.connect('button-release-event', Lang.bind(this, this._onReleaseEvent));
        item.connect('destroy', Lang.bind(this, this.destroy));
        item.connect('allocation-changed', Lang.bind(this, function() {
            // An allocation change could mean that the actor has moved,
            // so hide, but wait until after the allocation cycle.
            Mainloop.idle_add(Lang.bind(this, function() {
                this.hide();
            }));
        }));

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
        Tweener.addTween(this, {time: 0.3, onComplete: Lang.bind(this, this._onTimerComplete)});
        this._mousePosition = event.get_coords();
    },

    _onTimerComplete: function(){
        if (this._tooltip && this._tooltip.get_text() != "") {
            this.show();
        }
    },

    _onLeaveEvent: function(actor, event) {
        this.hide();
    },

    _onReleaseEvent: function(actor, event) {
        this.hide();
    },

    hide: function() {
        if (!this._tooltip) {return;}

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
        if (tooltipLeft+tooltipWidth>monitor.x+monitor.width) tooltipLeft = (monitor.x+monitor.width)-tooltipWidth;

        this._tooltip.set_position(tooltipLeft, tooltipTop);

        this._tooltip.show();
        this._tooltip.raise_top();
        this._visible = true;
    },

    set_text: function(text) {
        this._tooltip.set_text(text);
    },

    destroy: function() {
        Tweener.removeTweens(this);
        if (this._tooltip != null) {
            this._tooltip.destroy();
        }
        this._tooltip = null;
    }
};

function PanelItemTooltip(panelItem, initTitle, orientation) {
    this._init(panelItem, initTitle, orientation);
}

PanelItemTooltip.prototype = {
    __proto__: Tooltip.prototype,

    _init: function(panelItem, initTitle, orientation) {
        Tooltip.prototype._init.call(this, panelItem.actor, initTitle);
        this._panelItem = panelItem;
        this.orientation = orientation;
        if (panelItem instanceof Applet.Applet) {
            panelItem.connect("orientation-changed", Lang.bind(this, this._onOrientationChanged));
        }
        else if (panelItem._applet) {
            panelItem._applet.connect("orientation-changed", Lang.bind(this, this._onOrientationChanged));
        }
    },

    show: function() {
        if (this.preventShow || global.menuStackLength > 0) return;

        Tweener.removeTweens(this);

        let tooltipHeight = this._tooltip.get_allocation_box().y2-this._tooltip.get_allocation_box().y1;
        let tooltipWidth = this._tooltip.get_allocation_box().x2-this._tooltip.get_allocation_box().x1;

        let monitor = Main.layoutManager.findMonitorForActor(this._panelItem.actor);
        let tooltipTop;
        if (this.orientation == St.Side.BOTTOM) {
            tooltipTop = monitor.y+monitor.height-tooltipHeight-this._panelItem.actor.get_allocation_box().y2+this._panelItem.actor.get_allocation_box().y1;
        }
        else {
            tooltipTop = monitor.y+this._panelItem.actor.get_allocation_box().y2;
        }
        var tooltipLeft = this._mousePosition[0]- Math.round(tooltipWidth/2);
        if (tooltipLeft<monitor.x) tooltipLeft = monitor.x;
        if (tooltipLeft+tooltipWidth>monitor.x+monitor.width) tooltipLeft = (monitor.x+monitor.width)-tooltipWidth;

        this._tooltip.set_position(tooltipLeft, tooltipTop);

        this._tooltip.show();
        this._visible = true;
    },

    _onOrientationChanged: function(a, orientation) {
        this.orientation = orientation;
    }
};

