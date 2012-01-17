const St = imports.gi.St;
const Main = imports.ui.main;
const Lang = imports.lang;
const Tweener = imports.ui.tweener;

function PanelItemTooltip(panelItem, initTitle) {
    this._init(panelItem, initTitle);
}

PanelItemTooltip.prototype = {
    _init: function(panelItem, initTitle) {
        this._tooltip = new St.Tooltip();
        if (initTitle) this._tooltip.set_label(initTitle);
        Main.uiGroup.add_actor(this._tooltip);
        
        panelItem.actor.connect('enter-event', Lang.bind(this, this._onEnterEvent));
        panelItem.actor.connect('leave-event', Lang.bind(this, this._onLeaveEvent));
        panelItem.actor.connect('motion-event', Lang.bind(this, this._onMotionEvent));
        
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
        Tweener.addTween(this, {time: 0.3, onComplete: Lang.bind(this, this._onTimerComplete)});
        this._mousePosition = event.get_coords();
    },
    
    _onTimerComplete: function(){
        if (this._tooltip.get_label() != "") {
            this.show();
        }
    },
    
    _onLeaveEvent: function(actor, event) {
        this.hide();
    },
    
    hide: function() {
        Tweener.removeTweens(this);
        this._tooltip.hide();
        this._visible = false;
    },
    
    show: function() {
        //if (this._appButton.rightClickMenu.isOpen) return;
        if (this.preventShow) return;
        
        Tweener.removeTweens(this);
        
        let tooltipHeight = this._tooltip.get_allocation_box().y2-this._tooltip.get_allocation_box().y1;
        let tooltipWidth = this._tooltip.get_allocation_box().x2-this._tooltip.get_allocation_box().x1;
        
        let monitor;        
        let tooltipTop;
        if (Main.desktop_layout == Main.LAYOUT_TRADITIONAL) {
            monitor = Main.layoutManager.bottomMonitor;
            tooltipTop = monitor.height-tooltipHeight-this._panelItem.actor.get_allocation_box().y2+this._panelItem.actor.get_allocation_box().y1;
        }
        else {    
            monitor = Main.layoutManager.primaryMonitor;
            tooltipTop = this._panelItem.actor.get_allocation_box().y2;
        }
        var tooltipLeft = this._mousePosition[0]- Math.round(tooltipWidth/2);
        if (tooltipLeft<0) tooltipLeft = 0;
        if (tooltipLeft+tooltipWidth>monitor.width) tooltipLeft = monitor.width-tooltipWidth;
        
        this._tooltip.set_position(tooltipLeft, tooltipTop);
        
        this._tooltip.show();
        this._visible = true;
    },
    
    set_text: function(text) {
        this._tooltip.set_label(text);
    },
    
    destroy: function() {
       this._tooltip.destroy();
    }
}
