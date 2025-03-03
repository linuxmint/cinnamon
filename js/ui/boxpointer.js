// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported BoxPointer */

const { Clutter, GObject, Cinnamon, St } = imports.gi;

const Main = imports.ui.main;

var PopupAnimation = {
    NONE:  0,
    SLIDE: 1 << 0,
    FADE:  1 << 1,
    FULL:  ~0,
};

var POPUP_ANIMATION_TIME = 150;

/**
 * BoxPointer:
 * @side: side to draw the arrow on
 * @binProperties: Properties to set on contained bin
 *
 * An actor which displays a triangle "arrow" pointing to a given
 * side.  The .bin property is a container in which content can be
 * placed.  The arrow position may be controlled via
 * setArrowOrigin(). The arrow side might be temporarily flipped
 * depending on the box size and source position to keep the box
 * totally inside the monitor workarea if possible.
 *
 */
var BoxPointer = GObject.registerClass({
    Signals: { 'arrow-side-changed': {} },
}, class BoxPointer extends St.Widget {
    _init(arrowSide, binProperties) {
        super._init();

        this.set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);

        this._arrowSide = arrowSide;
        this._userArrowSide = arrowSide;
        this._arrowOrigin = 0;
        this._arrowActor = null;
        this.bin = new St.Bin(binProperties);
        this.add_actor(this.bin);
        this._border = new St.DrawingArea();
        this._border.connect('repaint', this._drawBorder.bind(this));
        this.add_actor(this._border);
        this.set_child_above_sibling(this.bin, this._border);
        this._sourceAlignment = 0.5;
        this._muteInput = true;

        this.connect('destroy', this._onDestroy.bind(this));
    }

    vfunc_captured_event() {
        if (this._muteInput)
            return Clutter.EVENT_STOP;

        return Clutter.EVENT_PROPAGATE;
    }

    _onDestroy() {
        if (this._sourceActorDestroyId) {
            this._sourceActor.disconnect(this._sourceActorDestroyId);
            delete this._sourceActorDestroyId;
        }
    }

    get arrowSide() {
        return this._arrowSide;
    }

    open(animate, onComplete) {
        let themeNode = this.get_theme_node();
        let rise = themeNode.get_length('-arrow-rise');
        let animationTime = animate & PopupAnimation.FULL ? POPUP_ANIMATION_TIME : 0;

        if (animate & PopupAnimation.FADE)
            this.opacity = 0;
        else
            this.opacity = 255;

        this.show();

        if (animate & PopupAnimation.SLIDE) {
            switch (this._arrowSide) {
            case St.Side.TOP:
                this.translation_y = -rise;
                break;
            case St.Side.BOTTOM:
                this.translation_y = rise;
                break;
            case St.Side.LEFT:
                this.translation_x = -rise;
                break;
            case St.Side.RIGHT:
                this.translation_x = rise;
                break;
            }
        }

        this.ease({
            opacity: 255,
            translation_x: 0,
            translation_y: 0,
            duration: animationTime,
            mode: Clutter.AnimationMode.LINEAR,
            onComplete: () => {
                this._muteInput = false;
                if (onComplete)
                    onComplete();
            },
        });
    }

    close(animate, onComplete) {
        if (!this.visible)
            return;

        let translationX = 0;
        let translationY = 0;
        let themeNode = this.get_theme_node();
        let rise = themeNode.get_length('-arrow-rise');
        let fade = animate & PopupAnimation.FADE;
        let animationTime = animate & PopupAnimation.FULL ? POPUP_ANIMATION_TIME : 0;

        if (animate & PopupAnimation.SLIDE) {
            switch (this._arrowSide) {
            case St.Side.TOP:
                translationY = rise;
                break;
            case St.Side.BOTTOM:
                translationY = -rise;
                break;
            case St.Side.LEFT:
                translationX = rise;
                break;
            case St.Side.RIGHT:
                translationX = -rise;
                break;
            }
        }

        this._muteInput = true;

        this.remove_all_transitions();
        this.ease({
            opacity: fade ? 0 : 255,
            translation_x: translationX,
            translation_y: translationY,
            duration: animationTime,
            mode: Clutter.AnimationMode.LINEAR,
            onComplete: () => {
                this.hide();
                this.opacity = 0;
                this.translation_x = 0;
                this.translation_y = 0;
                if (onComplete)
                    onComplete();
            },
        });
    }

    _adjustAllocationForArrow(isWidth, minSize, natSize) {
        let themeNode = this.get_theme_node();
        let borderWidth = themeNode.get_length('-arrow-border-width');
        minSize += borderWidth * 2;
        natSize += borderWidth * 2;
        if ((!isWidth && (this._arrowSide == St.Side.TOP || this._arrowSide == St.Side.BOTTOM)) ||
            (isWidth && (this._arrowSide == St.Side.LEFT || this._arrowSide == St.Side.RIGHT))) {
            let rise = themeNode.get_length('-arrow-rise');
            minSize += rise;
            natSize += rise;
        }

        return [minSize, natSize];
    }

    vfunc_get_preferred_width(forHeight) {
        let themeNode = this.get_theme_node();
        forHeight = themeNode.adjust_for_height(forHeight);

        let width = this.bin.get_preferred_width(forHeight);
        width = this._adjustAllocationForArrow(true, ...width);

        return themeNode.adjust_preferred_width(...width);
    }

    vfunc_get_preferred_height(forWidth) {
        let themeNode = this.get_theme_node();
        let borderWidth = themeNode.get_length('-arrow-border-width');
        forWidth = themeNode.adjust_for_width(forWidth);

        let height = this.bin.get_preferred_height(forWidth - 2 * borderWidth);
        height = this._adjustAllocationForArrow(false, ...height);

        return themeNode.adjust_preferred_height(...height);
    }

    vfunc_allocate(box, flags) {
        if (this._sourceActor && this._sourceActor.mapped) {
            this._reposition(box);
            this._updateFlip(box);
        }

        this.set_allocation(box, flags);

        let themeNode = this.get_theme_node();
        let borderWidth = themeNode.get_length('-arrow-border-width');
        let rise = themeNode.get_length('-arrow-rise');
        let childBox = new Clutter.ActorBox();
        let [availWidth, availHeight] = themeNode.get_content_box(box).get_size();

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
    }

    _drawBorder(area) {
        let themeNode = this.get_theme_node();

        if (this._arrowActor) {
            let [sourceX, sourceY] = this._arrowActor.get_transformed_position();
            let [sourceWidth, sourceHeight] = this._arrowActor.get_transformed_size();
            let [absX, absY] = this.get_transformed_position();

            if (this._arrowSide == St.Side.TOP ||
                this._arrowSide == St.Side.BOTTOM)
                this._arrowOrigin = sourceX - absX + sourceWidth / 2;
            else
                this._arrowOrigin = sourceY - absY + sourceHeight / 2;
        }

        let borderWidth = themeNode.get_length('-arrow-border-width');
        let base = themeNode.get_length('-arrow-base');
        let rise = themeNode.get_length('-arrow-rise');
        let borderRadius = themeNode.get_length('-arrow-border-radius');

        let halfBorder = borderWidth / 2;
        let halfBase = Math.floor(base / 2);

        let backgroundColor = themeNode.get_color('-arrow-background-color');

        let [width, height] = area.get_surface_size();
        let [boxWidth, boxHeight] = [width, height];
        if (this._arrowSide == St.Side.TOP || this._arrowSide == St.Side.BOTTOM)
            boxHeight -= rise;
        else
            boxWidth -= rise;

        let cr = area.get_context();

        // Translate so that box goes from 0,0 to boxWidth,boxHeight,
        // with the arrow poking out of that
        if (this._arrowSide == St.Side.TOP)
            cr.translate(0, rise);
        else if (this._arrowSide == St.Side.LEFT)
            cr.translate(rise, 0);

        let [x1, y1] = [halfBorder, halfBorder];
        let [x2, y2] = [boxWidth - halfBorder, boxHeight - halfBorder];

        let skipTopLeft = false;
        let skipTopRight = false;
        let skipBottomLeft = false;
        let skipBottomRight = false;

        if (rise) {
            switch (this._arrowSide) {
            case St.Side.TOP:
                if (this._arrowOrigin == x1)
                    skipTopLeft = true;
                else if (this._arrowOrigin == x2)
                    skipTopRight = true;
                break;

            case St.Side.RIGHT:
                if (this._arrowOrigin == y1)
                    skipTopRight = true;
                else if (this._arrowOrigin == y2)
                    skipBottomRight = true;
                break;

            case St.Side.BOTTOM:
                if (this._arrowOrigin == x1)
                    skipBottomLeft = true;
                else if (this._arrowOrigin == x2)
                    skipBottomRight = true;
                break;

            case St.Side.LEFT:
                if (this._arrowOrigin == y1)
                    skipTopLeft = true;
                else if (this._arrowOrigin == y2)
                    skipBottomLeft = true;
                break;
            }
        }

        cr.moveTo(x1 + borderRadius, y1);
        if (this._arrowSide == St.Side.TOP && rise) {
            if (skipTopLeft) {
                cr.moveTo(x1, y2 - borderRadius);
                cr.lineTo(x1, y1 - rise);
                cr.lineTo(x1 + halfBase, y1);
            } else if (skipTopRight) {
                cr.lineTo(x2 - halfBase, y1);
                cr.lineTo(x2, y1 - rise);
                cr.lineTo(x2, y1 + borderRadius);
            } else {
                cr.lineTo(this._arrowOrigin - halfBase, y1);
                cr.lineTo(this._arrowOrigin, y1 - rise);
                cr.lineTo(this._arrowOrigin + halfBase, y1);
            }
        }

        if (!skipTopRight) {
            cr.lineTo(x2 - borderRadius, y1);
            cr.arc(x2 - borderRadius, y1 + borderRadius, borderRadius,
                   3 * Math.PI / 2, Math.PI * 2);
        }

        if (this._arrowSide == St.Side.RIGHT && rise) {
            if (skipTopRight) {
                cr.lineTo(x2 + rise, y1);
                cr.lineTo(x2 + rise, y1 + halfBase);
            } else if (skipBottomRight) {
                cr.lineTo(x2, y2 - halfBase);
                cr.lineTo(x2 + rise, y2);
                cr.lineTo(x2 - borderRadius, y2);
            } else {
                cr.lineTo(x2, this._arrowOrigin - halfBase);
                cr.lineTo(x2 + rise, this._arrowOrigin);
                cr.lineTo(x2, this._arrowOrigin + halfBase);
            }
        }

        if (!skipBottomRight) {
            cr.lineTo(x2, y2 - borderRadius);
            cr.arc(x2 - borderRadius, y2 - borderRadius, borderRadius,
                   0, Math.PI / 2);
        }

        if (this._arrowSide == St.Side.BOTTOM && rise) {
            if (skipBottomLeft) {
                cr.lineTo(x1 + halfBase, y2);
                cr.lineTo(x1, y2 + rise);
                cr.lineTo(x1, y2 - borderRadius);
            } else if (skipBottomRight) {
                cr.lineTo(x2, y2 + rise);
                cr.lineTo(x2 - halfBase, y2);
            } else {
                cr.lineTo(this._arrowOrigin + halfBase, y2);
                cr.lineTo(this._arrowOrigin, y2 + rise);
                cr.lineTo(this._arrowOrigin - halfBase, y2);
            }
        }

        if (!skipBottomLeft) {
            cr.lineTo(x1 + borderRadius, y2);
            cr.arc(x1 + borderRadius, y2 - borderRadius, borderRadius,
                   Math.PI / 2, Math.PI);
        }

        if (this._arrowSide == St.Side.LEFT && rise) {
            if (skipTopLeft) {
                cr.lineTo(x1, y1 + halfBase);
                cr.lineTo(x1 - rise, y1);
                cr.lineTo(x1 + borderRadius, y1);
            } else if (skipBottomLeft) {
                cr.lineTo(x1 - rise, y2);
                cr.lineTo(x1 - rise, y2 - halfBase);
            } else {
                cr.lineTo(x1, this._arrowOrigin + halfBase);
                cr.lineTo(x1 - rise, this._arrowOrigin);
                cr.lineTo(x1, this._arrowOrigin - halfBase);
            }
        }

        if (!skipTopLeft) {
            cr.lineTo(x1, y1 + borderRadius);
            cr.arc(x1 + borderRadius, y1 + borderRadius, borderRadius,
                   Math.PI, 3 * Math.PI / 2);
        }

        Clutter.cairo_set_source_color(cr, backgroundColor);
        cr.fillPreserve();

        if (borderWidth > 0) {
            let borderColor = themeNode.get_color('-arrow-border-color');
            Clutter.cairo_set_source_color(cr, borderColor);
            cr.setLineWidth(borderWidth);
            cr.stroke();
        }

        cr.$dispose();
    }

    setPosition(sourceActor, alignment) {
        if (!this._sourceActor || sourceActor != this._sourceActor) {
            if (this._sourceActorDestroyId) {
                this._sourceActor.disconnect(this._sourceActorDestroyId);
                delete this._sourceActorDestroyId;
            }

            this._sourceActor = sourceActor;

            if (this._sourceActor) {
                this._sourceActorDestroyId = this._sourceActor.connect('destroy', () => {
                    this._sourceActor = null;
                    delete this._sourceActorDestroyId;
                });
            }
        }

        this._arrowAlignment = alignment;

        this.queue_relayout();
    }

    setSourceAlignment(alignment) {
        this._sourceAlignment = alignment;

        if (!this._sourceActor)
            return;

        this.setPosition(this._sourceActor, this._arrowAlignment);
    }

    _reposition(allocationBox) {
        let sourceActor = this._sourceActor;
        let alignment = this._arrowAlignment;

        let monitor = Main.layoutManager.findMonitorForActor(sourceActor);
        this._workArea = {x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height};

        this._sourceAllocation = Cinnamon.util_get_transformed_allocation(sourceActor);
        // Position correctly relative to the sourceActor
        let sourceNode = sourceActor.get_theme_node();
        let sourceContentBox = sourceNode.get_content_box(sourceActor.get_allocation_box());
        let sourceAllocation = this._sourceAllocation;
        let sourceCenterX = sourceAllocation.x1 + sourceContentBox.x1 + (sourceContentBox.x2 - sourceContentBox.x1) * this._sourceAlignment;
        let sourceCenterY = sourceAllocation.y1 + sourceContentBox.y1 + (sourceContentBox.y2 - sourceContentBox.y1) * this._sourceAlignment;
        let [, , natWidth, natHeight] = this.get_preferred_size();

        // We also want to keep it onscreen, and separated from the
        // edge by the same distance as the main part of the box is
        // separated from its sourceActor
        let workarea = this._workArea;
        let themeNode = this.get_theme_node();
        let borderWidth = themeNode.get_length('-arrow-border-width');
        let arrowBase = themeNode.get_length('-arrow-base');
        let borderRadius = themeNode.get_length('-arrow-border-radius');
        let margin = 4 * borderRadius + borderWidth + arrowBase;

        let gap = themeNode.get_length('-boxpointer-gap');
        let padding = themeNode.get_length('-arrow-rise');

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

        // Now align and position the pointing axis, making sure it fits on
        // screen. If the arrowOrigin is so close to the edge that the arrow
        // will not be isosceles, we try to compensate as follows:
        //   - We skip the rounded corner and settle for a right angled arrow
        //     as shown below. See _drawBorder for further details.
        //     |\_____
        //     |
        //     |
        //   - If the arrow was going to be acute angled, we move the position
        //     of the box to maintain the arrow's accuracy.

        let arrowOrigin;
        let halfBase = Math.floor(arrowBase / 2);
        let halfBorder = borderWidth / 2;
        let halfMargin = margin / 2;
        let [x1, y1] = [halfBorder, halfBorder];
        let [x2, y2] = [natWidth - halfBorder, natHeight - halfBorder];

        switch (this._arrowSide) {
        case St.Side.TOP:
        case St.Side.BOTTOM:
            resX = sourceCenterX - (halfMargin + (natWidth - margin) * alignment);

            resX = Math.max(resX, workarea.x + padding);
            resX = Math.min(resX, workarea.x + workarea.width - (padding + natWidth));

            arrowOrigin = sourceCenterX - resX;
            if (arrowOrigin <= (x1 + (borderRadius + halfBase))) {
                if (arrowOrigin > x1)
                    resX += arrowOrigin - x1;
                arrowOrigin = x1;
            } else if (arrowOrigin >= (x2 - (borderRadius + halfBase))) {
                if (arrowOrigin < x2)
                    resX -= x2 - arrowOrigin;
                arrowOrigin = x2;
            }
            break;

        case St.Side.LEFT:
        case St.Side.RIGHT:
            resY = sourceCenterY - (halfMargin + (natHeight - margin) * alignment);

            resY = Math.max(resY, workarea.y + padding);
            resY = Math.min(resY, workarea.y + workarea.height - (padding + natHeight));

            arrowOrigin = sourceCenterY - resY;
            if (arrowOrigin <= (y1 + (borderRadius + halfBase))) {
                if (arrowOrigin > y1)
                    resY += arrowOrigin - y1;
                arrowOrigin = y1;
            } else if (arrowOrigin >= (y2 - (borderRadius + halfBase))) {
                if (arrowOrigin < y2)
                    resX -= y2 - arrowOrigin;
                arrowOrigin = y2;
            }
            break;
        }

        this.setArrowOrigin(arrowOrigin);

        let parent = this.get_parent();
        let success, x, y;
        while (!success) {
            [success, x, y] = parent.transform_stage_point(resX, resY);
            parent = parent.get_parent();
        }

        // Actually set the position
        allocationBox.set_origin(Math.floor(x), Math.floor(y));
    }

    // @origin: Coordinate specifying middle of the arrow, along
    // the Y axis for St.Side.LEFT, St.Side.RIGHT from the top and X axis from
    // the left for St.Side.TOP and St.Side.BOTTOM.
    setArrowOrigin(origin) {
        if (this._arrowOrigin != origin) {
            this._arrowOrigin = origin;
            this._border.queue_repaint();
        }
    }

    // @actor: an actor relative to which the arrow is positioned.
    // Differently from setPosition, this will not move the boxpointer itself,
    // on the arrow
    setArrowActor(actor) {
        if (this._arrowActor != actor) {
            this._arrowActor = actor;
            this._border.queue_repaint();
        }
    }

    _calculateArrowSide(arrowSide) {
        let sourceAllocation = this._sourceAllocation;
        let [, , boxWidth, boxHeight] = this.get_preferred_size();
        let workarea = this._workArea;

        switch (arrowSide) {
        case St.Side.TOP:
            if (sourceAllocation.y2 + boxHeight > workarea.y + workarea.height &&
                boxHeight < sourceAllocation.y1 - workarea.y)
                return St.Side.BOTTOM;
            break;
        case St.Side.BOTTOM:
            if (sourceAllocation.y1 - boxHeight < workarea.y &&
                boxHeight < workarea.y + workarea.height - sourceAllocation.y2)
                return St.Side.TOP;
            break;
        case St.Side.LEFT:
            if (sourceAllocation.x2 + boxWidth > workarea.x + workarea.width &&
                boxWidth < sourceAllocation.x1 - workarea.x)
                return St.Side.RIGHT;
            break;
        case St.Side.RIGHT:
            if (sourceAllocation.x1 - boxWidth < workarea.x &&
                boxWidth < workarea.x + workarea.width - sourceAllocation.x2)
                return St.Side.LEFT;
            break;
        }

        return arrowSide;
    }

    _updateFlip(allocationBox) {
        let arrowSide = this._calculateArrowSide(this._userArrowSide);
        if (this._arrowSide != arrowSide) {
            this._arrowSide = arrowSide;
            this._reposition(allocationBox);

            this.emit('arrow-side-changed');
        }
    }

    updateArrowSide(side) {
        this._arrowSide = side;
        this._border.queue_repaint();

        this.emit('arrow-side-changed');
    }

    getPadding(side) {
        return this.bin.get_theme_node().get_padding(side);
    }

    getArrowHeight() {
        return this.get_theme_node().get_length('-arrow-rise');
    }
});
