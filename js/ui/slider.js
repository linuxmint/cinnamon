// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const St = imports.gi.St;
const Signals = imports.signals;

const SLIDER_SCROLL_STEP = 0.05; /* Slider scrolling step in % */

function Slider(value, flat) {
    this._init(value, flat);
}

Slider.prototype = {
    _init: function(value, flat) {
        if (isNaN(value))
            // Avoid spreading NaNs around
            throw TypeError('The slider value must be a number');
        this._value = Math.max(Math.min(value, 1), 0);

        this.flat = flat; // Don't draw radius on flat sliders

        this.actor = new St.DrawingArea({ style_class: 'slider', reactive: true });
        this.actor.connect('repaint', Lang.bind(this, this._sliderRepaint));
        this.actor.connect('button-press-event', Lang.bind(this, this._startDragging));
        this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));
        this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));

        this._releaseId = this._motionId = 0;
        this._dragging = false;
    },

    setValue: function(value) {
        if (isNaN(value))
            throw TypeError('The slider value must be a number');

        this._value = Math.max(Math.min(value, 1), 0);
        this.actor.queue_repaint();
    },

    _sliderRepaint: function(area) {
        const rtl = this.actor.get_direction() === St.TextDirection.RTL;

        const cr = area.get_context();
        const themeNode = area.get_theme_node();
        const [width, height] = area.get_surface_size();

        const handleRadius = themeNode.get_length('-slider-handle-radius');

        const sliderWidth = width - 2 * handleRadius;
        const sliderHeight = themeNode.get_length('-slider-height');

        const sliderBorderWidth = themeNode.get_length('-slider-border-width');
        const sliderBorderRadius = Math.min(width, sliderHeight) / 2;

        const sliderBorderColor = themeNode.get_color('-slider-border-color');
        const sliderColor = themeNode.get_color('-slider-background-color');

        const sliderActiveBorderColor = themeNode.get_color('-slider-active-border-color');
        const sliderActiveColor = themeNode.get_color('-slider-active-background-color');

        const TAU = Math.PI * 2;

        const handleX = rtl ?
            width - handleRadius - sliderWidth * this._value :
            handleRadius + sliderWidth * this._value;
        const handleY = height / 2;

        let sliderLeftBorderColor = sliderActiveBorderColor;
        let sliderLeftColor = sliderActiveColor;
        let sliderRightBorderColor = sliderBorderColor;
        let sliderRightColor = sliderColor;
        if (rtl) {
            sliderLeftColor = sliderColor;
            sliderLeftBorderColor = sliderBorderColor;
            sliderRightColor = sliderActiveColor;
            sliderRightBorderColor = sliderActiveBorderColor;
        }

        if (this.flat) {
            // Active part
            cr.rectangle(0, 0, width, height);
            Clutter.cairo_set_source_color(cr, sliderLeftColor);
            cr.fill();
            Clutter.cairo_set_source_color(cr, sliderLeftBorderColor);
            cr.setLineWidth(sliderBorderWidth);
            cr.stroke();

            // Remaining part
            const x = rtl ? width * (1 - this._value) : width * this._value;
            cr.rectangle(x, 0, width-x, height);
            Clutter.cairo_set_source_color(cr, sliderRightColor);
            cr.fill();
            Clutter.cairo_set_source_color(cr, sliderRightBorderColor);
            cr.setLineWidth(sliderBorderWidth);
            cr.stroke();
        }
        else {
            cr.arc(sliderBorderRadius + sliderBorderWidth, handleY, sliderBorderRadius, TAU * 1/4, TAU * 3/4);
            cr.lineTo(handleX, (height - sliderHeight) / 2);
            cr.lineTo(handleX, (height + sliderHeight) / 2);
            cr.lineTo(sliderBorderRadius + sliderBorderWidth, (height + sliderHeight) / 2);
            Clutter.cairo_set_source_color(cr, sliderLeftColor);
            cr.fillPreserve();
            Clutter.cairo_set_source_color(cr, sliderLeftBorderColor);
            cr.setLineWidth(sliderBorderWidth);
            cr.stroke();

            cr.arc(width - sliderBorderRadius - sliderBorderWidth, handleY, sliderBorderRadius, TAU * 3/4, TAU * 1/4);
            cr.lineTo(handleX, (height + sliderHeight) / 2);
            cr.lineTo(handleX, (height - sliderHeight) / 2);
            cr.lineTo(width - sliderBorderRadius - sliderBorderWidth, (height - sliderHeight) / 2);
            Clutter.cairo_set_source_color(cr, sliderRightColor);
            cr.fillPreserve();
            Clutter.cairo_set_source_color(cr, sliderRightBorderColor);
            cr.setLineWidth(sliderBorderWidth);
            cr.stroke();
        }

        const color = themeNode.get_foreground_color();
        Clutter.cairo_set_source_color(cr, color);
        cr.arc(handleX, handleY, handleRadius, 0, TAU);
        cr.fill();

        cr.$dispose();
    },

    _startDragging: function(actor, event) {
        if (this._dragging) // don't allow two drags at the same time
            return;

        this.emit('drag-begin');
        this._dragging = true;

        event.get_device().grab(this.actor);
        this._releaseId = this.actor.connect('button-release-event', Lang.bind(this, this._endDragging));
        this._motionId = this.actor.connect('motion-event', Lang.bind(this, this._motionEvent));
        let absX, absY;
        [absX, absY] = event.get_coords();
        this._moveHandle(absX, absY);
    },

    _endDragging: function(actor, event) {
        if (this._dragging) {
            this.actor.disconnect(this._releaseId);
            this.actor.disconnect(this._motionId);

            event.get_device().ungrab();
            this._dragging = false;

            this.emit('drag-end');
        }
        return true;
    },

    _onScrollEvent: function (actor, event) {
        let direction = event.get_scroll_direction();

        if (direction == Clutter.ScrollDirection.DOWN) {
            this._value = Math.max(0, this._value - SLIDER_SCROLL_STEP);
        }
        else if (direction == Clutter.ScrollDirection.UP) {
            this._value = Math.min(1, this._value + SLIDER_SCROLL_STEP);
        }

        this.actor.queue_repaint();
        this.emit('value-changed', this._value);
    },

    _motionEvent: function(actor, event) {
        let absX, absY;
        [absX, absY] = event.get_coords();
        this._moveHandle(absX, absY);
        return true;
    },

    _moveHandle: function(absX, absY) {
        const [sliderX, sliderY] = this.actor.get_transformed_position();
        const relX = absX - sliderX;
        const relY = absY - sliderY;

        const width = this.actor.width;
        const handleRadius = this.actor.get_theme_node().get_length('-slider-handle-radius');

        let newvalue;
        if (this.actor.get_direction() === St.TextDirection.RTL)
            if (relX < handleRadius)
                newvalue = 1;
            else if (relX > width - handleRadius)
                newvalue = 0;
            else
                newvalue = 1 - (relX - handleRadius) / (width - 2 * handleRadius);
        else
            if (relX < handleRadius)
                newvalue = 0;
            else if (relX > width - handleRadius)
                newvalue = 1;
            else
                newvalue = (relX - handleRadius) / (width - 2 * handleRadius);

        this._value = newvalue;
        this.actor.queue_repaint();
        this.emit('value-changed', this._value);
    },

    _onKeyPressEvent: function (actor, event) {
        const key = event.get_key_symbol();
        if (key === Clutter.KEY_Right || key === Clutter.KEY_Left) {
            let delta = key === Clutter.KEY_Right ? 0.1 : -0.1;
            if (this.actor.get_direction() === St.TextDirection.RTL)
                delta = -delta;

            this._value = Math.max(0, Math.min(this._value + delta, 1));
            this.actor.queue_repaint();
            this.emit('value-changed', this._value);
            this.emit('drag-end');
            return true;
        }
        return false;
    },

    get value() {
        return this._value;
    }
};

Signals.addSignalMethods(Slider.prototype);
