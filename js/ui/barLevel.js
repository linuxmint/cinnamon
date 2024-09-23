// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Clutter = imports.gi.Clutter;
const GObject = imports.gi.GObject;
const St = imports.gi.St;

var BarLevel = GObject.registerClass({
    Properties: {
        'value': GObject.ParamSpec.double(
            'value', 'value', 'value',
            GObject.ParamFlags.READWRITE,
            0, 2, 0),
        'maximum-value': GObject.ParamSpec.double(
            'maximum-value', 'maximum-value', 'maximum-value',
            GObject.ParamFlags.READWRITE,
            1, 2, 1),
        'amplify-start': GObject.ParamSpec.double(
            'amplify-start', 'amplify-start', 'amplify-start',
            GObject.ParamFlags.READWRITE,
            1, 2, 1),
    },
}, class BarLevel extends St.DrawingArea {
    _init(params) {
        this._maxValue = 1;
        this._value = 0;
        this._amplifyStart = 1;
        this._barLevelWidth = 0;
        this._barLevelHeight = 0;

        this._amplifySeparatorWidth = 0;

        this._barLevelColor = null;
        this._barLevelActiveColor = null;
        this._barLevelAmplifyColor = null;

        let defaultParams = {
            style_class: 'barlevel',
        };
        super._init(Object.assign(defaultParams, params));
        this.connect('notify::allocation', () => {
            this._barLevelWidth = this.allocation.get_width();
        });
    }

    get value() {
        return this._value;
    }

    set value(value) {
        value = Math.max(Math.min(value, this._maxValue), 0);

        if (this._value == value)
            return;

        this._value = value;
        this.notify('value');
        this.queue_repaint();
    }

    get maximum_value() {
        return this._maxValue;
    }

    set maximum_value(value) {
        value = Math.max(value, 1);

        if (this._maxValue == value)
            return;

        this._maxValue = value;
        this._amplifyStart = Math.min(this._amplifyStart, this._maxValue);
        this.notify('maximum-value');
        this.queue_repaint();
    }

    get amplify_start() {
        return this._amplifyStart;
    }

    set amplify_start(value) {
        if (this._amplifyStart == value)
            return;

        if (value > this._maxValue) {
            throw new Error(`Tried to set amplify value to ${value}, ` +
                `which is a number greater than the maximum allowed value ${this._maxValue}`);
        }

        this._amplifyStart = value;
        this.notify('amplify-start');
        this.queue_repaint();
    }

    vfunc_style_changed() {
        const themeNode = this.get_theme_node();
        this._barLevelHeight = themeNode.get_length('-barlevel-height');
        this._amplifySeparatorWidth =
            themeNode.get_length('-barlevel-amplify-separator-width');

        this._barLevelColor = themeNode.get_color('-barlevel-background-color');
        this._barLevelActiveColor = themeNode.get_color('-barlevel-active-background-color');
        this._barLevelAmplifyColor = themeNode.get_color('-barlevel-amplify-color');

        super.vfunc_style_changed();
    }

    vfunc_repaint() {
        let cr = this.get_context();
        let themeNode = this.get_theme_node();
        let [width, height] = this.get_surface_size();
        const rtl = this.get_direction() === St.TextDirection.RTL;

        const barLevelBorderRadius = Math.min(width, this._barLevelHeight) / 2;
        let fgColor = themeNode.get_foreground_color();

        const TAU = Math.PI * 2;

        let endX = 0;
        if (this._maxValue > 0) {
            let progress = this._value / this._maxValue;
            if (rtl)
                progress = 1 - progress;
            endX = barLevelBorderRadius + (width - 2 * barLevelBorderRadius) * progress;
        }

        let amplifyRatio = this._amplifyStart / this._maxValue;
        if (rtl)
            amplifyRatio = 1 - amplifyRatio;
        let amplifySeparatorX = barLevelBorderRadius + (width - 2 * barLevelBorderRadius) * amplifyRatio;

        let amplifyActive = this._amplifyStart !== this._maxValue;
        const amplifySeparatorWidth = amplifyActive
            ? this._amplifySeparatorWidth : 0;

        let xcArcStart = barLevelBorderRadius;
        let xcArcEnd = width - xcArcStart;
        if (rtl)
            [xcArcStart, xcArcEnd] = [xcArcEnd, xcArcStart];

        /* background bar */
        if (!rtl)
            cr.arc(xcArcEnd, height / 2, barLevelBorderRadius, TAU * (3 / 4), TAU * (1 / 4));
        else
            cr.arcNegative(xcArcEnd, height / 2, barLevelBorderRadius, TAU * (3 / 4), TAU * (1 / 4));
        cr.lineTo(endX, (height + this._barLevelHeight) / 2);
        cr.lineTo(endX, (height - this._barLevelHeight) / 2);
        cr.lineTo(xcArcEnd, (height - this._barLevelHeight) / 2);
        Clutter.cairo_set_source_color(cr, this._barLevelColor);
        cr.fillPreserve();
        cr.fill();

        /* normal progress bar */
        let x = 0;
        if (!rtl) {
            x = Math.min(endX, amplifySeparatorX - amplifySeparatorWidth / 2);
            cr.arc(xcArcStart, height / 2, barLevelBorderRadius, TAU * (1 / 4), TAU * (3 / 4));
        } else {
            x = Math.max(endX, amplifySeparatorX + amplifySeparatorWidth / 2);
            cr.arcNegative(xcArcStart, height / 2, barLevelBorderRadius, TAU * (1 / 4), TAU * (3 / 4));
        }
        cr.lineTo(x, (height - this._barLevelHeight) / 2);
        cr.lineTo(x, (height + this._barLevelHeight) / 2);
        cr.lineTo(xcArcStart, (height + this._barLevelHeight) / 2);
        if (this._value > 0)
            Clutter.cairo_set_source_color(cr, this._barLevelActiveColor);
        cr.fillPreserve();
        cr.fill();

        /* amplify progress barLevel */
        if (!rtl)
            x = Math.min(endX, amplifySeparatorX) + amplifySeparatorWidth / 2;
        else
            x = Math.max(endX, amplifySeparatorX) - amplifySeparatorWidth / 2;
        if (this._value > this._amplifyStart) {
            cr.moveTo(x, (height - this._barLevelHeight) / 2);
            cr.lineTo(endX, (height - this._barLevelHeight) / 2);
            cr.lineTo(endX, (height + this._barLevelHeight) / 2);
            cr.lineTo(x, (height + this._barLevelHeight) / 2);
            cr.lineTo(x, (height - this._barLevelHeight) / 2);
            Clutter.cairo_set_source_color(cr, this._barLevelAmplifyColor);
            cr.fillPreserve();
            cr.fill();
        }

        /* end progress bar arc */
        if (this._value > 0) {
            if (this._value <= this._amplifyStart)
                Clutter.cairo_set_source_color(cr, this._barLevelActiveColor);
            else
                Clutter.cairo_set_source_color(cr, this._barLevelAmplifyColor);
            if (!rtl) {
                cr.arc(endX, height / 2, barLevelBorderRadius, TAU * (3 / 4), TAU * (1 / 4));
                cr.lineTo(Math.floor(endX), (height + this._barLevelHeight) / 2);
                cr.lineTo(Math.floor(endX), (height - this._barLevelHeight) / 2);
            } else {
                cr.arcNegative(endX, height / 2, barLevelBorderRadius, TAU * (3 / 4), TAU * (1 / 4));
                cr.lineTo(Math.ceil(endX), (height + this._barLevelHeight) / 2);
                cr.lineTo(Math.ceil(endX), (height - this._barLevelHeight) / 2);
            }
            cr.lineTo(endX, (height - this._barLevelHeight) / 2);
            cr.fillPreserve();
        }

        /* draw amplify separator */
        if (amplifyActive) {
            cr.moveTo(amplifySeparatorX - amplifySeparatorWidth / 2, (height - this._barLevelHeight) / 2);
            cr.lineTo(amplifySeparatorX + amplifySeparatorWidth / 2, (height - this._barLevelHeight) / 2);
            cr.lineTo(amplifySeparatorX + amplifySeparatorWidth / 2, (height + this._barLevelHeight) / 2);
            cr.lineTo(amplifySeparatorX - amplifySeparatorWidth / 2, (height + this._barLevelHeight) / 2);
            cr.lineTo(amplifySeparatorX - amplifySeparatorWidth / 2, (height - this._barLevelHeight) / 2);
            if (this._value <= this._amplifyStart)
                Clutter.cairo_set_source_color(cr, fgColor);
            else
                Clutter.cairo_set_source_color(cr, this._barLevelColor);
            cr.fill();
        }

        cr.$dispose();
    }

    vfunc_get_preferred_height(_forWidth) {
        const themeNode = this.get_theme_node();
        const height = this._getPreferredHeight();
        return themeNode.adjust_preferred_height(height, height);
    }

    vfunc_get_preferred_width(_forHeight) {
        const themeNode = this.get_theme_node();
        const width = this._getPreferredWidth();
        return themeNode.adjust_preferred_width(width, width);
    }

    _getPreferredHeight() {
        return this._barLevelHeight;
    }

    _getPreferredWidth() {
        return this._amplifySeparatorWidth;
    }

    _getCurrentValue() {
        return this._value;
    }

    _getAmplifyStart() {
        return this._amplifyStart;
    }

    _getMinimumValue() {
        return 0;
    }

    _getMaximumValue() {
        return this._maxValue;
    }

    _setCurrentValue(_actor, value) {
        this._value = value;
    }
});
