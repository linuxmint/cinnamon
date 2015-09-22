// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const Lang = imports.lang;
const St = imports.gi.St;
const Signals = imports.signals;

const SLIDER_SCROLL_STEP = 0.05; /* Slider scrolling step in % */

function Slider(value, style_class, flat) {
    this._init(value, style_class, flat);
}

Slider.prototype = {
    _init: function(value, style_class, flat) {
        if (isNaN(value))
            // Avoid spreading NaNs around
            throw TypeError('The slider value must be a number');
        this._value = Math.max(Math.min(value, 1), 0);

        if (style_class == null) {
            style_class = 'slider';
        }

        this.flat = flat; // Don't draw radius on flat sliders

        this.actor = new St.DrawingArea({ style_class: style_class, reactive: true });
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
        let cr = area.get_context();
        let themeNode = area.get_theme_node();
        let [width, height] = area.get_surface_size();

        let handleRadius = themeNode.get_length('-slider-handle-radius');

        let sliderWidth = width - 2 * handleRadius;
        let sliderHeight = themeNode.get_length('-slider-height');

        let sliderBorderWidth = themeNode.get_length('-slider-border-width');
        let sliderBorderRadius = Math.min(width, sliderHeight) / 2;

        let sliderBorderColor = themeNode.get_color('-slider-border-color');
        let sliderColor = themeNode.get_color('-slider-background-color');

        let sliderActiveBorderColor = themeNode.get_color('-slider-active-border-color');
        let sliderActiveColor = themeNode.get_color('-slider-active-background-color');

        const TAU = Math.PI * 2;

        let handleX = handleRadius + (width - 2 * handleRadius) * this._value;

        if (this.flat) {
            // Active part
            cr.rectangle(0, 0, width, height);
            Clutter.cairo_set_source_color(cr, sliderActiveColor);
            cr.fill();
            Clutter.cairo_set_source_color(cr, sliderActiveBorderColor);
            cr.setLineWidth(sliderBorderWidth);
            cr.stroke();

            // Remaining part
            let x = width * this._value;
            cr.rectangle(x, 0, width-x, height);
            Clutter.cairo_set_source_color(cr, sliderColor);
            cr.fill();
            Clutter.cairo_set_source_color(cr, sliderBorderColor);
            cr.setLineWidth(sliderBorderWidth);
            cr.stroke();
        }
        else {
            cr.arc(sliderBorderRadius + sliderBorderWidth, height / 2, sliderBorderRadius, TAU * 1/4, TAU * 3/4);
            cr.lineTo(handleX, (height - sliderHeight) / 2);
            cr.lineTo(handleX, (height + sliderHeight) / 2);
            cr.lineTo(sliderBorderRadius + sliderBorderWidth, (height + sliderHeight) / 2);
            Clutter.cairo_set_source_color(cr, sliderActiveColor);
            cr.fillPreserve();
            Clutter.cairo_set_source_color(cr, sliderActiveBorderColor);
            cr.setLineWidth(sliderBorderWidth);
            cr.stroke();

            cr.arc(width - sliderBorderRadius - sliderBorderWidth, height / 2, sliderBorderRadius, TAU * 3/4, TAU * 1/4);
            cr.lineTo(handleX, (height + sliderHeight) / 2);
            cr.lineTo(handleX, (height - sliderHeight) / 2);
            cr.lineTo(width - sliderBorderRadius - sliderBorderWidth, (height - sliderHeight) / 2);
            Clutter.cairo_set_source_color(cr, sliderColor);
            cr.fillPreserve();
            Clutter.cairo_set_source_color(cr, sliderBorderColor);
            cr.setLineWidth(sliderBorderWidth);
            cr.stroke();
        }

        let handleY = height / 2;

        let color = themeNode.get_foreground_color();
        Clutter.cairo_set_source_color(cr, color);
        cr.arc(handleX, handleY, handleRadius, 0, 2 * Math.PI);
        cr.fill();

        cr.$dispose();
    },

    _startDragging: function(actor, event) {
        if (this._dragging) // don't allow two drags at the same time
            return;

        this.emit('drag-begin');
        this._dragging = true;

        // FIXME: we should only grab the specific device that originated
        // the event, but for some weird reason events are still delivered
        // outside the slider if using clutter_grab_pointer_for_device
        Clutter.grab_pointer(this.actor);
        this._releaseId = this.actor.connect('button-release-event', Lang.bind(this, this._endDragging));
        this._motionId = this.actor.connect('motion-event', Lang.bind(this, this._motionEvent));
        let absX, absY;
        [absX, absY] = event.get_coords();
        this._moveHandle(absX, absY);
    },

    _endDragging: function() {
        if (this._dragging) {
            this.actor.disconnect(this._releaseId);
            this.actor.disconnect(this._motionId);

            Clutter.ungrab_pointer();
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
        let relX, relY, sliderX, sliderY;
        [sliderX, sliderY] = this.actor.get_transformed_position();
        relX = absX - sliderX;
        relY = absY - sliderY;

        let width = this.actor.width;
        let handleRadius = this.actor.get_theme_node().get_length('-slider-handle-radius');

        let newvalue;
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
        let key = event.get_key_symbol();
        if (key == Clutter.KEY_Right || key == Clutter.KEY_Left) {
            let delta = key == Clutter.KEY_Right ? 0.1 : -0.1;
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
