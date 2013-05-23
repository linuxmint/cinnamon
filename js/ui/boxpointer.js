// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const St = imports.gi.St;
const Cinnamon = imports.gi.Cinnamon;

const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const POPUP_ANIMATION_TIME = 0.15;

/**
 * BoxPointer:
 * @side: side to draw the arrow on
 * @binProperties: Properties to set on contained bin
 *
 * An actor which displays a triangle "arrow" pointing to a given
 * side.  The .bin property is a container in which content can be
 * placed.  The arrow position may be controlled via setArrowOrigin().
 *
 */
function BoxPointer(side, binProperties) {
    this._init(side, binProperties);
}

BoxPointer.prototype = {
    _init: function(arrowSide, binProperties) {
        this._arrowSide = arrowSide;
        this._arrowOrigin = 0;
        this.actor = new St.Bin({ x_fill: true,
                                  y_fill: true });
        this._container = new Cinnamon.GenericContainer();
        this.actor.set_child(this._container);
        this._container.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this._container.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this._container.connect('allocate', Lang.bind(this, this._allocate));
        this.bin = new St.Bin(binProperties);
        this._container.add_actor(this.bin);
        this._border = new St.DrawingArea();
        this._border.connect('repaint', Lang.bind(this, this._drawBorder));
        this._container.add_actor(this._border);
        this.bin.raise(this._border);
        this._xOffset = 0;
        this._yOffset = 0;
        this._xPosition = 0;
        this._yPosition = 0;
        this._sourceAlignment = 0.5;
    },

    show: function(animate, onComplete) {
        let themeNode = this.actor.get_theme_node();
        let rise = themeNode.get_length('-arrow-rise');

        if (animate) {
            this.opacity = 0;
            this.actor.show();
            switch (this._arrowSide) {
                case St.Side.TOP:
                    this.yOffset = -rise;
                    break;
                case St.Side.BOTTOM:
                    this.yOffset = rise;
                    break;
                case St.Side.LEFT:
                    this.xOffset = -rise;
                    break;
                case St.Side.RIGHT:
                    this.xOffset = rise;
                    break;
            }
            Tweener.addTween(this, { opacity: 255,
                                     xOffset: 0,
                                     yOffset: 0,
                                     transition: 'linear',
                                     onComplete: onComplete,
                                     time: POPUP_ANIMATION_TIME });
        } else {
            this.opacity = 255;
            this.actor.show();
        }
    },

    hide: function(animate, onComplete) {
        let xOffset = 0;
        let yOffset = 0;
        let themeNode = this.actor.get_theme_node();
        let rise = themeNode.get_length('-arrow-rise');

        if (animate) {
            switch (this._arrowSide) {
                case St.Side.TOP:
                    yOffset = rise;
                    break;
                case St.Side.BOTTOM:
                    yOffset = -rise;
                    break;
                case St.Side.LEFT:
                    xOffset = rise;
                    break;
                case St.Side.RIGHT:
                    xOffset = -rise;
                    break;
            }
            Tweener.addTween(this, { opacity: 0,
                                     xOffset: xOffset,
                                     yOffset: yOffset,
                                     transition: 'linear',
                                     time: POPUP_ANIMATION_TIME,
                                     onComplete: Lang.bind(this, function () {
                                         this.actor.hide();
                                         this.xOffset = 0;
                                         this.yOffset = 0;
                                         if (onComplete)
                                             onComplete();
                                         })
                                     });
        } else {
            this.actor.hide();
        }
    },

    /**
     * setArrowSide:
     * @side (St.Side): The new side of the menu
     * 
     * Sets the arrow side of the menu. Note that the side is the side
     * of the source actor, not the menu, e.g. If St.Side.TOP is set, 
     * then the menu will appear below the source actor (the source
     * actor will be on top of the menu)
     */
    setArrowSide: function(side) {
	// Need not trigger any other function. Menu position is
        // recalculated every time it is shown
	this._arrowSide = side;
    },

    _adjustAllocationForArrow: function(isWidth, alloc) {
        let themeNode = this.actor.get_theme_node();
        let borderWidth = themeNode.get_length('-arrow-border-width');
        alloc.min_size += borderWidth * 2;
        alloc.natural_size += borderWidth * 2;
        if ((!isWidth && (this._arrowSide == St.Side.TOP || this._arrowSide == St.Side.BOTTOM))
            || (isWidth && (this._arrowSide == St.Side.LEFT || this._arrowSide == St.Side.RIGHT))) {
            let rise = themeNode.get_length('-arrow-rise');
            alloc.min_size += rise;
            alloc.natural_size += rise;
        }
    },

    _getPreferredWidth: function(actor, forHeight, alloc) {
        let [minInternalSize, natInternalSize] = this.bin.get_preferred_width(forHeight);
        alloc.min_size = minInternalSize;
        alloc.natural_size = natInternalSize;
        this._adjustAllocationForArrow(true, alloc);
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {
        let [minSize, naturalSize] = this.bin.get_preferred_height(forWidth);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
        this._adjustAllocationForArrow(false, alloc);
    },

    _allocate: function(actor, box, flags) {
        let themeNode = this.actor.get_theme_node();
        let borderWidth = themeNode.get_length('-arrow-border-width');
        let rise = themeNode.get_length('-arrow-rise');
        let childBox = new Clutter.ActorBox();
        let availWidth = box.x2 - box.x1;
        let availHeight = box.y2 - box.y1;

        childBox.x1 = 0;
        childBox.y1 = 0;
        childBox.x2 = availWidth;
        childBox.y2 = availHeight;
        this._border.allocate(childBox, flags);

        childBox.x1 = borderWidth;
        childBox.y1 = borderWidth;
        childBox.x2 = availWidth - borderWidth;
        childBox.y2 = availHeight - borderWidth;
        switch (this._arrowSide) {
            case St.Side.TOP:
                childBox.y1 += rise;
                break;
            case St.Side.BOTTOM:
                childBox.y2 -= rise;
                break;
            case St.Side.LEFT:
                childBox.x1 += rise;
                break;
            case St.Side.RIGHT:
                childBox.x2 -= rise;
                break;
        }
        this.bin.allocate(childBox, flags);

        if (this._sourceActor && this._sourceActor.mapped)
            this._reposition(this._sourceActor, this._arrowAlignment);
    },

    _drawBorder: function(area) {
        let themeNode = this.actor.get_theme_node();

        let borderWidth = themeNode.get_length('-arrow-border-width');
        let base = themeNode.get_length('-arrow-base');
        let rise = themeNode.get_length('-arrow-rise');
        let borderRadius = themeNode.get_length('-arrow-border-radius');

        let halfBorder = borderWidth / 2;
        let halfBase = Math.floor(base/2);

        let borderColor = themeNode.get_color('-arrow-border-color');
        let backgroundColor = themeNode.get_color('-arrow-background-color');

        let [width, height] = area.get_surface_size();
        let [boxWidth, boxHeight] = [width, height];
        if (this._arrowSide == St.Side.TOP || this._arrowSide == St.Side.BOTTOM) {
            boxHeight -= rise;
        } else {
            boxWidth -= rise;
        }
        let cr = area.get_context();
        Clutter.cairo_set_source_color(cr, borderColor);

        // Translate so that box goes from 0,0 to boxWidth,boxHeight,
        // with the arrow poking out of that
        if (this._arrowSide == St.Side.TOP) {
            cr.translate(0, rise);
        } else if (this._arrowSide == St.Side.LEFT) {
            cr.translate(rise, 0);
        }

        let [x1, y1] = [halfBorder, halfBorder];
        let [x2, y2] = [boxWidth - halfBorder, boxHeight - halfBorder];

        cr.moveTo(x1 + borderRadius, y1);
        if (this._arrowSide == St.Side.TOP) {
            if (this._arrowOrigin < (x1 + (borderRadius + halfBase))) {
                cr.lineTo(this._arrowOrigin, y1 - rise);
                cr.lineTo(Math.max(x1 + borderRadius, this._arrowOrigin) + halfBase, y1);
            } else if (this._arrowOrigin > (x2 - (borderRadius + halfBase))) {
                cr.lineTo(Math.min(x2 - borderRadius, this._arrowOrigin) - halfBase, y1);
                cr.lineTo(this._arrowOrigin, y1 - rise);
            } else {
                cr.lineTo(this._arrowOrigin - halfBase, y1);
                cr.lineTo(this._arrowOrigin, y1 - rise);
                cr.lineTo(this._arrowOrigin + halfBase, y1);
            }
        }

        cr.lineTo(x2 - borderRadius, y1);

        // top-right corner
        cr.arc(x2 - borderRadius, y1 + borderRadius, borderRadius,
               3*Math.PI/2, Math.PI*2);

        if (this._arrowSide == St.Side.RIGHT) {
            if (this._arrowOrigin < (y1 + (borderRadius + halfBase))) {
                cr.lineTo(x2 + rise, this._arrowOrigin);
                cr.lineTo(x2, Math.max(y1 + borderRadius, this._arrowOrigin) + halfBase);
            } else if (this._arrowOrigin > (y2 - (borderRadius + halfBase))) {
                cr.lineTo(x2, Math.min(y2 - borderRadius, this._arrowOrigin) - halfBase);
                cr.lineTo(x2 + rise, this._arrowOrigin);
            } else {
                cr.lineTo(x2, this._arrowOrigin - halfBase);
                cr.lineTo(x2 + rise, this._arrowOrigin);
                cr.lineTo(x2, this._arrowOrigin + halfBase);
            }
        }

        cr.lineTo(x2, y2 - borderRadius);

        // bottom-right corner
        cr.arc(x2 - borderRadius, y2 - borderRadius, borderRadius,
               0, Math.PI/2);

        if (this._arrowSide == St.Side.BOTTOM) {
            if (this._arrowOrigin < (x1 + (borderRadius + halfBase))) {
                cr.lineTo(Math.max(x1 + borderRadius, this._arrowOrigin) + halfBase, y2);
                cr.lineTo(this._arrowOrigin, y2 + rise);
            } else if (this._arrowOrigin > (x2 - (borderRadius + halfBase))) {
                cr.lineTo(this._arrowOrigin, y2 + rise);
                cr.lineTo(Math.min(x2 - borderRadius, this._arrowOrigin) - halfBase, y2);
            } else {
                cr.lineTo(this._arrowOrigin + halfBase, y2);
                cr.lineTo(this._arrowOrigin, y2 + rise);
                cr.lineTo(this._arrowOrigin - halfBase, y2);
            }
        }

        cr.lineTo(x1 + borderRadius, y2);

        // bottom-left corner
        cr.arc(x1 + borderRadius, y2 - borderRadius, borderRadius,
               Math.PI/2, Math.PI);

        if (this._arrowSide == St.Side.LEFT) {
            if (this._arrowOrigin < (y1 + (borderRadius + halfBase))) {
                cr.lineTo(x1, Math.max(y1 + borderRadius, this._arrowOrigin) + halfBase);
                cr.lineTo(x1 - rise, this._arrowOrigin);
            } else if (this._arrowOrigin > (y2 - (borderRadius + halfBase))) {
                cr.lineTo(x1 - rise, this._arrowOrigin);
                cr.lineTo(x1, Math.min(y2 - borderRadius, this._arrowOrigin) - halfBase);
            } else {
                cr.lineTo(x1, this._arrowOrigin + halfBase);
                cr.lineTo(x1 - rise, this._arrowOrigin);
                cr.lineTo(x1, this._arrowOrigin - halfBase);
            }
        }

        cr.lineTo(x1, y1 + borderRadius);

        // top-left corner
        cr.arc(x1 + borderRadius, y1 + borderRadius, borderRadius,
               Math.PI, 3*Math.PI/2);

        Clutter.cairo_set_source_color(cr, backgroundColor);
        cr.fillPreserve();
        Clutter.cairo_set_source_color(cr, borderColor);
        cr.setLineWidth(borderWidth);
        cr.stroke();
    },

    setPosition: function(sourceActor, alignment) {
        // We need to show it now to force an allocation,
        // so that we can query the correct size.
        this.actor.show();

        this._sourceActor = sourceActor;
        this._arrowAlignment = alignment;

        this._reposition(sourceActor, alignment);
    },

    setSourceAlignment: function(alignment) {
        this._sourceAlignment = alignment;

        if (!this._sourceActor)
            return;

        // We need to show it now to force an allocation,
        // so that we can query the correct size.
        this.actor.show();

        this._reposition(this._sourceActor, this._arrowAlignment);
    },

    _reposition: function(sourceActor, alignment) {
        // Position correctly relative to the sourceActor
        let sourceNode = sourceActor.get_theme_node();
        let sourceContentBox = sourceNode.get_content_box(sourceActor.get_allocation_box());
        let sourceAllocation = Cinnamon.util_get_transformed_allocation(sourceActor);
        let sourceCenterX = sourceAllocation.x1 + sourceContentBox.x1 + (sourceContentBox.x2 - sourceContentBox.x1) * this._sourceAlignment;
        let sourceCenterY = sourceAllocation.y1 + sourceContentBox.y1 + (sourceContentBox.y2 - sourceContentBox.y1) * this._sourceAlignment;
        let [minWidth, minHeight, natWidth, natHeight] = this.actor.get_preferred_size();

        // We also want to keep it onscreen, and separated from the
        // edge by the same distance as the main part of the box is
        // separated from its sourceActor
        let monitor = Main.layoutManager.findMonitorForActor(sourceActor);
        let themeNode = this.actor.get_theme_node();
        let borderWidth = themeNode.get_length('-arrow-border-width');
        let arrowBase = themeNode.get_length('-arrow-base');
        let borderRadius = themeNode.get_length('-arrow-border-radius');
        let margin = (4 * borderRadius + borderWidth + arrowBase);
        let halfMargin = margin / 2;

        let themeNode = this.actor.get_theme_node();
        let gap = themeNode.get_length('-boxpointer-gap');

        let resX, resY;

        switch (this._arrowSide) {
        case St.Side.TOP:
            resY = sourceAllocation.y2 + gap;
            break;
        case St.Side.BOTTOM:
            resY = sourceAllocation.y1 - natHeight - gap;
            break;
        case St.Side.LEFT:
            resX = sourceAllocation.x2 + gap;
            break;
        case St.Side.RIGHT:
            resX = sourceAllocation.x1 - natWidth - gap;
            break;
        }

        // Now align and position the pointing axis, making sure
        // it fits on screen
        switch (this._arrowSide) {
        case St.Side.TOP:
        case St.Side.BOTTOM:
            resX = sourceCenterX - (halfMargin + (natWidth - margin) * alignment);

            resX = Math.max(resX, monitor.x + 10);
            resX = Math.min(resX, monitor.x + monitor.width - (10 + natWidth));
            this.setArrowOrigin(sourceCenterX - resX);
            break;

        case St.Side.LEFT:
        case St.Side.RIGHT:
            resY = sourceCenterY - (halfMargin + (natHeight - margin) * alignment);

            resY = Math.max(resY, monitor.y + 10);
            resY = Math.min(resY, monitor.y + monitor.height - (10 + natHeight));

            this.setArrowOrigin(sourceCenterY - resY);
            break;
        }

        let parent = this.actor.get_parent();
        let success, x, y;
        while (!success) {
            [success, x, y] = parent.transform_stage_point(resX, resY);
            parent = parent.get_parent();
        }

        this._xPosition = Math.floor(x);
        this._yPosition = Math.floor(y);
        this._shiftActor();
    },

    // @origin: Coordinate specifying middle of the arrow, along
    // the Y axis for St.Side.LEFT, St.Side.RIGHT from the top and X axis from
    // the left for St.Side.TOP and St.Side.BOTTOM.
    setArrowOrigin: function(origin) {
        if (this._arrowOrigin != origin) {
            this._arrowOrigin = origin;
            this._border.queue_repaint();
        }
    },

    _shiftActor : function() {
        // Since the position of the BoxPointer depends on the allocated size
        // of the BoxPointer and the position of the source actor, trying
        // to position the BoxPoiner via the x/y properties will result in
        // allocation loops and warnings. Instead we do the positioning via
        // the anchor point, which is independent of allocation, and leave
        // x == y == 0.
        this.actor.set_anchor_point(-(this._xPosition + this._xOffset),
                                    -(this._yPosition + this._yOffset));
    },

    set xOffset(offset) {
        this._xOffset = offset;
        this._shiftActor();
    },

    get xOffset() {
        return this._xOffset;
    },

    set yOffset(offset) {
        this._yOffset = offset;
        this._shiftActor();
    },

    get yOffset() {
        return this._yOffset;
    },

    set opacity(opacity) {
        this.actor.opacity = opacity;
    },

    get opacity() {
        return this.actor.opacity;
    }
};
