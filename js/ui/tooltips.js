const Lang = imports.lang;
const Mainloop = imports.mainloop;
const St = imports.gi.St;

const Applet = imports.ui.applet;
const Main = imports.ui.main;
const SignalManager = imports.misc.signalManager;
const Tweener = imports.ui.tweener;

/**
 * #TooltipBase
 * @item (Clutter.Actor): The object owning the tooltip.
 * @visible (boolean): Whether the tooltip is currently visible
 * @preventShow (boolean): Whether to inhibit the display of the tooltip
 * @mousePosition (array): The coordinates of the event that triggered the
 * show.
 *
 * This is a base class for other tooltip items to inherit. This cannot be
 * instantiated.
 *
 * All other tooltip items inherit this object. This base class is responsible
 * for listening to mouse events and determining when to show the tooltip. When
 * it thinks a tooltip should be shown, it calls `this.show()`. When it thinks
 * it should be hidden, it calls `this.hide()`. When the @item is destroyed, it
 * will call `this._destroy()`;
 *
 * Any object wishing to implement a tooltip should inherit this class, and
 * then implement the three functions above. It should be noted that the sole
 * responsibility of this class is to call the three functions above. It is
 * thus the user's job to create the tooltip actor and position it correctly in
 * the `show` function. Example implementations for reference include the
 * #Tooltips.Tooltip object as well as the `WindowPreview` object in the window
 * list applet.
 *
 * When calling the `show` function, #TooltipBase will set the
 * `this.mousePosition` to the mouse coordinates at which the event is
 * triggered.
 *
 * When implementing the `show` and `hide` functions, the user should set the
 * `this.visible` variable to the visibility state of the tooltip. This is
 * since calling the `show` function does not necessarily actually show the
 * tooltip, eg. when the tooltip text is empty and the tooltip refuses to show.
 * The `this.visible` variable should be set properly to reflect the actual
 * status of the tooltip.
 *
 * Finally, if the user wishes to inhibit the display of a tooltip, eg. when
 * the owner is being dragged, they can set the `this.preventShow` variable to
 * `true`.
 */
function TooltipBase(item) {
    throw new TypeError("Trying to instantiate abstract class TooltipBase");
}

TooltipBase.prototype = {
    _init: function(item) {
        this.signals = new SignalManager.SignalManager(this);

        this.signals.connect(global.stage, 'notify::key-focus', this._hide);
        this.signals.connect(item, 'enter-event', this._onEnterEvent);
        this.signals.connect(item, 'motion-event', this._onMotionEvent);
        this.signals.connect(item, 'leave-event', this._hide);
        this.signals.connect(item, 'button-press-event', this._hide);
        this.signals.connect(item, 'button-release-event', this._hide);
        this.signals.connect(item, 'destroy', this.destroy);
        this.signals.connect(item, 'allocation-changed', function() {
            // An allocation change could mean that the actor has moved,
            // so hide, but wait until after the allocation cycle.
            Mainloop.idle_add(Lang.bind(this, function() {
                this.hide();
            }));
        });

        this._showTimer = null;
        this.visible = false;
        this.item = item;
        this.preventShow = false;
    },

    _onMotionEvent: function(actor, event) {
        if (this._showTimer) {
            Mainloop.source_remove(this._showTimer);
            this._showTimer = null;
        }

        if (!this.visible) {
            this._showTimer = Mainloop.timeout_add(300, Lang.bind(this, this._onTimerComplete));
            this.mousePosition = event.get_coords();
        }
    },

    _onEnterEvent: function(actor, event) {
        if (!this._showTimer) {
            this._showTimer = Mainloop.timeout_add(300, Lang.bind(this, this._onTimerComplete));
            this.mousePosition = event.get_coords();
        }
    },

    _onTimerComplete: function(){
        this._showTimer = null;

        if (!this.preventShow)
            this.show();

        return false;
    },

    _hide: function(actor, event) {
        if (this._showTimer) {
            Mainloop.source_remove(this._showTimer);
            this._showTimer = null;
        }
        this.hide();
    },

    /**
     * destroy:
     *
     * Destroys the tooltip.
     */
    destroy: function() {
        if (this._showTimer) {
            Mainloop.source_remove(this._showTimer);
            this._showTimer = null;
        }
        this.signals.disconnectAllSignals();
        this._destroy();
    }
}

/**
 * #Tooltip:
 * 
 * This is a tooltip item that displays some text. The tooltip will be
 * displayed such that the top left corner of the label is at the mouse
 * position.
 *
 * This is not suitable for use in applets, since in the case of applets, we
 * don't want the tooltip at the position of the mouse. Instead, it should
 * appear above/below the panel without overlapping with the applet. Hence the
 * #PanelItemTooltip class should be used instead.
 *
 * Note that the tooltip refuses to show if the tooltip text is empty.
 *
 * Inherits: Tooltips.TooltipBase
 */
function Tooltip(item, initTitle) {
    this._init(item, initTitle);
}

Tooltip.prototype = {
    __proto__: TooltipBase.prototype,

    /**
     * _init:
     * @item (Clutter.Actor): the actor owning the tooltip
     * @initTitle (string): the string to display initially
     */
    _init: function(item, initTitle) {
        TooltipBase.prototype._init.call(this, item);
        this._tooltip = new St.Label({ name: 'Tooltip' });
        this._tooltip.show_on_set_parent = false;

        if (initTitle) this._tooltip.set_text(initTitle);
        Main.uiGroup.add_actor(this._tooltip);
    },

    hide: function() {
        this._tooltip.hide();

        this.visible = false;
    },

    show: function() {
        if (this._tooltip.get_text() == "")
            return;

        let tooltipWidth = this._tooltip.get_allocation_box().x2-this._tooltip.get_allocation_box().x1;

        let monitor = Main.layoutManager.findMonitorForActor(this.item);

        let tooltipTop = this.mousePosition[1];
        var tooltipLeft = this.mousePosition[0];

        tooltipLeft = Math.max(tooltipLeft, monitor.x);
        tooltipLeft = Math.min(tooltipLeft, monitor.x + monitor.width - tooltipWidth);

        this._tooltip.set_position(tooltipLeft, tooltipTop);

        this._tooltip.show();
        this._tooltip.raise_top();
        this.visible = true;
    },

    /**
     * set_text:
     * @text (string): new text to display
     *
     * Sets the text to display to @text.
     */
    set_text: function(text) {
        this._tooltip.set_text(text);
    },

    _destroy: function() {
        this._tooltip.destroy();
    }
};

/**
 * #PanelItemTooltip
 * @_panelItem (Applet.Applet): The applet owning the tooltip
 * @orientation (St.Side): The orientation of the applet
 *
 * A tooltip for panel applets. This is displayed above/below the panel instead
 * of at exactly the mouse position to avoid covering the applet.
 *
 * It is possible that @panelItem is not an applet, but a child of an applet.
 * An immediate example is for use in the window list, where each individual
 * item, instead of the applet,  has its own tooltip. These objects must have
 * `panelItem._applet` set as the actual applet, since we need to access the
 * applet to listen to orientation changes.
 *
 * Inherits: Tooltips.Tooltip
 */
function PanelItemTooltip(panelItem, initTitle, orientation) {
    this._init(panelItem, initTitle, orientation);
}

PanelItemTooltip.prototype = {
    __proto__: Tooltip.prototype,

    /**
     * _init:
     * @panelItem (Applet.Applet): the applet owning the tooltip
     * @initTitle (string): the initial string of the tooltip
     * @orientation (St.Side): the orientation of the applet.
     *
     * It should be noted that @panelItem is the *applet* owning the tooltip,
     * while that usually passed to #Tooltips.Tooltip is the *actor*. These are
     * different objects.
     */
    _init: function(panelItem, initTitle, orientation) {
        Tooltip.prototype._init.call(this, panelItem.actor, initTitle);
        this._panelItem = panelItem;
        this.orientation = orientation;
        if (this._panelItem instanceof Applet.Applet) {
            this._panelItem.connect("orientation-changed", Lang.bind(this, this._onOrientationChanged));
        } else if (this._panelItem._applet) {
            this._panelItem._applet.connect("orientation-changed", Lang.bind(this, this._onOrientationChanged));
        }
    },

    show: function() {
        if (this._tooltip.get_text() == "" || global.menuStackLength > 0)
            return;

        let tooltipHeight = this._tooltip.get_allocation_box().y2-this._tooltip.get_allocation_box().y1;
        let tooltipWidth = this._tooltip.get_allocation_box().x2-this._tooltip.get_allocation_box().x1;

        let monitor = Main.layoutManager.findMonitorForActor(this._panelItem.actor);
        let tooltipTop = 0;
	let tooltipLeft = 0;

        if (this.orientation == St.Side.BOTTOM) {
            tooltipTop = this.item.get_transformed_position()[1] - tooltipHeight;
            tooltipLeft = this.mousePosition[0]- Math.round(tooltipWidth/2);
            tooltipLeft = Math.max(tooltipLeft, monitor.x);
            tooltipLeft = Math.min(tooltipLeft, monitor.x + monitor.width - tooltipWidth);
        }
        else if (this.orientation == St.Side.TOP) {
            tooltipTop = this.item.get_transformed_position()[1] + this.item.get_transformed_size()[1];
            tooltipLeft = this.mousePosition[0]- Math.round(tooltipWidth/2);
            tooltipLeft = Math.max(tooltipLeft, monitor.x);
            tooltipLeft = Math.min(tooltipLeft, monitor.x + monitor.width - tooltipWidth);
        }
	else if (this.orientation == St.Side.LEFT)
	{
                let [x, y] = this._panelItem.actor.get_transformed_position();

		tooltipTop = y 
			+ Math.round((this._panelItem.actor.get_allocation_box().y2 - this._panelItem.actor.get_allocation_box().y1)/2)
			- Math.round(tooltipHeight/2);
		tooltipLeft = x + this._panelItem.actor.get_allocation_box().x2 - this._panelItem.actor.get_allocation_box().x1;
	}
	else				// Right side
	{
                let [x, y] = this._panelItem.actor.get_transformed_position();

		tooltipTop = y  
			+ Math.round((this._panelItem.actor.get_allocation_box().y2 - this._panelItem.actor.get_allocation_box().y1)/2)
			- Math.round(tooltipHeight/2);
		tooltipLeft = x - tooltipWidth;
	}
  	this._tooltip.set_position(tooltipLeft, tooltipTop);

        this._tooltip.show();
        this.visible = true;
    },

    _onOrientationChanged: function(a, orientation) {
        this.orientation = orientation;
    }
};

