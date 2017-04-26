// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cairo = imports.cairo;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Signals = imports.signals;
const St = imports.gi.St;
const Atk = imports.gi.Atk;

const BoxPointer = imports.ui.boxpointer;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const SignalManager = imports.misc.signalManager;
const Tweener = imports.ui.tweener;
const CheckBox = imports.ui.checkBox;
const RadioButton = imports.ui.radioButton;

const Params = imports.misc.params;
const Util = imports.misc.util;

const SLIDER_SCROLL_STEP = 0.05; /* Slider scrolling step in % */

const PanelLoc = {
    top : 0,
    bottom : 1,
    left : 2,
    right : 3
};

const OrnamentType = {
    NONE: 0,
    CHECK: 1,
    DOT: 2,
    ICON: 3
};

const FactoryClassTypes = {
    'RootMenuClass'            : "RootMenuClass",
    'MenuItemClass'            : "MenuItemClass",
    'SubMenuMenuItemClass'     : "SubMenuMenuItemClass",
    'MenuSectionMenuItemClass' : "MenuSectionMenuItemClass",
    'SeparatorMenuItemClass'   : "SeparatorMenuItemClass"
};

const FactoryEventTypes = {
    'opened'    : "opened",
    'closed'    : "closed",
    'clicked'   : "clicked"
};

function _ensureStyle(actor) {
    if (actor.get_children) {
        let children = actor.get_children();
        for (let i = 0; i < children.length; i++)
            _ensureStyle(children[i]);
    }

    if (actor instanceof St.Widget)
        actor.ensure_style();
}

/**
 * @side Side to which the arrow points.
 */
function arrowIcon(side) {
    let iconName;
    switch (side) {
        case St.Side.TOP:
            iconName = 'pan-up';
            break;
        case St.Side.RIGHT:
            iconName = 'pan-end';
            break;
        case St.Side.BOTTOM:
            iconName = 'pan-down';
            break;
        case St.Side.LEFT:
            iconName = 'pan-start';
            break;
    }

    let arrow = new St.Icon({ style_class: 'popup-menu-arrow',
                              icon_name: iconName,
                              icon_type: St.IconType.SYMBOLIC,
                              y_expand: true,
                              y_align: Clutter.ActorAlign.CENTER,
                              important: true });

    return arrow;
}

function PopupBaseMenuItem(params) {
    this._init(params);
}

PopupBaseMenuItem.prototype = {
    _init: function (params) {
        params = Params.parse (params, { reactive: true,
                                         activate: true,
                                         hover: true,
                                         sensitive: true,
                                         style_class: null,
                                         focusOnHover: true
                                       });
        this.actor = new Cinnamon.GenericContainer({ style_class: 'popup-menu-item',
                                                  reactive: params.reactive,
                                                  track_hover: params.reactive,
                                                  can_focus: params.reactive,
                                                  accessible_role: Atk.Role.MENU_ITEM });
        this.actor.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this.actor.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this.actor.connect('allocate', Lang.bind(this, this._allocate));
        this.actor.connect('style-changed', Lang.bind(this, this._onStyleChanged));
        this.actor._delegate = this;

        this._children = [];
        this._dot = null;
        this._columnWidths = null;
        this._spacing = 0;
        this.active = false;
        this._activatable = params.reactive && params.activate;
        this.sensitive = true;
        this.focusOnHover = params.focusOnHover;

        this.setSensitive(this._activatable && params.sensitive);

        if (params.style_class)
            this.actor.add_style_class_name(params.style_class);

        if (this._activatable) {
            this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
            this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
        }
        if (params.reactive && params.hover)
            this.actor.connect('notify::hover', Lang.bind(this, this._onHoverChanged));
        if (params.reactive) {
            this.actor.connect('key-focus-in', Lang.bind(this, this._onKeyFocusIn));
            this.actor.connect('key-focus-out', Lang.bind(this, this._onKeyFocusOut));
        }
    },

    _onStyleChanged: function (actor) {
        this._spacing = Math.round(actor.get_theme_node().get_length('spacing'));
    },

    _onButtonReleaseEvent: function (actor, event) {
        this.activate(event, false);
        return true;
    },

    _onKeyPressEvent: function (actor, event) {
        let symbol = event.get_key_symbol();

        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.activate(event);
            return true;
        }
        return false;
    },

    _onKeyFocusIn: function (actor) {
        this.setActive(true);
    },

    _onKeyFocusOut: function (actor) {
        this.setActive(false);
    },

    _onHoverChanged: function (actor) {
        this.setActive(actor.hover);
    },

    activate: function (event, keepMenu) {
        this.emit('activate', event, keepMenu);
    },

    setActive: function (active) {
        let activeChanged = active != this.active;

        if (activeChanged) {
            this.active = active;
            this.actor.change_style_pseudo_class('active', active);
            if (this.focusOnHover && this.active) this.actor.grab_key_focus();

            this.emit('active-changed', active);
        }
    },

    setSensitive: function(sensitive) {
        if (!this._activatable)
            return;
        if (this.sensitive == sensitive)
            return;

        this.sensitive = sensitive;
        this.actor.reactive = sensitive;
        this.actor.can_focus = sensitive;

        this.actor.change_style_pseudo_class('insensitive', !sensitive);
        this.emit('sensitive-changed', sensitive);
    },

    destroy: function() {
        this.actor.destroy();
        this.emit('destroy');
    },

    // adds an actor to the menu item; @params can contain %span
    // (column span; defaults to 1, -1 means "all the remaining width", 0 means "no new column after this actor"),
    // %expand (defaults to #false), and %align (defaults to
    // #St.Align.START)
    addActor: function(child, params) {
        params = Params.parse(params, { span: 1,
                                        expand: false,
                                        align: St.Align.START });
        params.actor = child;
        this._children.push(params);
        this.actor.connect('destroy', Lang.bind(this, function () { this._removeChild(child); }));
        this.actor.add_actor(child);
    },

    _removeChild: function(child) {
        for (let i = 0; i < this._children.length; i++) {
            if (this._children[i].actor == child) {
                this._children.splice(i, 1);
                return;
            }
        }
    },

    removeActor: function(child) {
        this.actor.remove_actor(child);
        this._removeChild(child);
    },

    setShowDot: function(show) {
        if (show) {
            if (this._dot)
                return;

            this._dot = new St.DrawingArea({ style_class: 'popup-menu-item-dot' });
            this._dot.connect('repaint', Lang.bind(this, this._onRepaintDot));
            this.actor.add_actor(this._dot);
            this.actor.add_accessible_state (Atk.StateType.CHECKED);
        } else {
            if (!this._dot)
                return;

            this._dot.destroy();
            this._dot = null;
            this.actor.remove_accessible_state (Atk.StateType.CHECKED);
        }
    },

    _onRepaintDot: function(area) {
        let cr = area.get_context();
        let [width, height] = area.get_surface_size();
        let color = area.get_theme_node().get_foreground_color();

        cr.setSourceRGBA (
            color.red / 255,
            color.green / 255,
            color.blue / 255,
            color.alpha / 255);
        cr.arc(width / 2, height / 2, width / 3, 0, 2 * Math.PI);
        cr.fill();

        cr.$dispose();
    },

    // This returns column widths in logical order (i.e. from the dot
    // to the image), not in visual order (left to right)
    getColumnWidths: function() {
        let widths = [];
        for (let i = 0, col = 0; i < this._children.length; i++) {
            let child = this._children[i];
            let [min, natural] = child.actor.get_preferred_width(-1);

            if (widths[col])
                widths[col] += this._spacing + natural;
            else
                widths[col] = natural;

            if (child.span > 0) {
                col++;
                for (let j = 1; j < child.span; j++)
                    widths[col++] = 0;
            }
        }
        return widths;
    },

    setColumnWidths: function(widths) {
        this._columnWidths = widths;
    },

    _getPreferredWidth: function(actor, forHeight, alloc) {
        let width = 0;
        if (this._columnWidths) {
            for (let i = 0; i < this._columnWidths.length; i++) {
                if (i > 0)
                    width += this._spacing;
                width += this._columnWidths[i];
            }
        } else {
            for (let i = 0; i < this._children.length; i++) {
                let child = this._children[i];
                if (i > 0)
                    width += this._spacing;
                let [min, natural] = child.actor.get_preferred_width(-1);
                width += natural;
            }
        }
        alloc.min_size = alloc.natural_size = width;
    },

    _getPreferredHeight: function(actor, forWidth, alloc) {
        let height = 0, x = 0, minWidth, childWidth;
        for (let i = 0; i < this._children.length; i++) {
            let child = this._children[i];
            if (this._columnWidths) {
                if (child.span == -1) {
                    childWidth = 0;
                    for (let j = i; j < this._columnWidths.length; j++)
                        childWidth += this._columnWidths[j]
                } else
                    childWidth = this._columnWidths[i];
            } else {
                if (child.span == -1)
                    childWidth = forWidth - x;
                else
                    [minWidth, childWidth] = child.actor.get_preferred_width(-1);
            }
            x += childWidth;

            let [min, natural] = child.actor.get_preferred_height(childWidth);
            if (natural > height)
                height = natural;
        }
        alloc.min_size = alloc.natural_size = height;
    },

    _allocate: function(actor, box, flags) {
        let height = box.y2 - box.y1;
        let direction = this.actor.get_direction();

        if (this._dot) {
            // The dot is placed outside box
            // one quarter of padding from the border of the container
            // (so 3/4 from the inner border)
            // (padding is box.x1)
            let dotBox = new Clutter.ActorBox();
            let dotWidth = Math.round(box.x1 / 2);

            if (direction == St.TextDirection.LTR) {
                dotBox.x1 = Math.round(box.x1 / 4);
                dotBox.x2 = dotBox.x1 + dotWidth;
            } else {
                dotBox.x2 = box.x2 + 3 * Math.round(box.x1 / 4);
                dotBox.x1 = dotBox.x2 - dotWidth;
            }
            dotBox.y1 = Math.round(box.y1 + (height - dotWidth) / 2);
            dotBox.y2 = dotBox.y1 + dotWidth;
            this._dot.allocate(dotBox, flags);
        }

        let x;
        if (direction == St.TextDirection.LTR)
            x = box.x1;
        else
            x = box.x2;

        let cols;
        //clone _columnWidths, if it exists, to be able to modify it without any impact
        if (this._columnWidths instanceof Array)
            cols = this._columnWidths.slice(0);

        // if direction is ltr, x is the right edge of the last added
        // actor, and it's constantly increasing, whereas if rtl, x is
        // the left edge and it decreases
        for (let i = 0, col = 0; i < this._children.length; i++) {
            let child = this._children[i];
            let childBox = new Clutter.ActorBox();

            let [minWidth, naturalWidth] = child.actor.get_preferred_width(-1);
            let availWidth, extraWidth;
            if (cols) {
                if (child.span == -1) {
                    if (direction == St.TextDirection.LTR)
                        availWidth = box.x2 - x;
                    else
                        availWidth = x - box.x1;
                } else if (child.span == 0) {
                    availWidth = naturalWidth;
                    cols[col] -= naturalWidth + this._spacing;
                } else {
                    availWidth = 0;
                    for (let j = 0; j < child.span; j++)
                        availWidth += cols[col++];
                }
                extraWidth = availWidth - naturalWidth;
            } else {
                if (child.span == -1) {
                    if (direction == St.TextDirection.LTR)
                        availWidth = box.x2 - x;
                    else
                        availWidth = x - box.x1;
                } else {
                    availWidth = naturalWidth;
                }
                extraWidth = 0;
            }

            if (direction == St.TextDirection.LTR) {
                if (child.expand) {
                    childBox.x1 = x;
                    childBox.x2 = x + availWidth;
                } else if (child.align === St.Align.MIDDLE) {
                    childBox.x1 = x + Math.round(extraWidth / 2);
                    childBox.x2 = childBox.x1 + naturalWidth;
                } else if (child.align === St.Align.END) {
                    childBox.x2 = x + availWidth;
                    childBox.x1 = childBox.x2 - naturalWidth;
                } else {
                    childBox.x1 = x;
                    childBox.x2 = x + naturalWidth;
                }

                //when somehow the actor is wider than the box, cut it off
                if(childBox.x2 > box.x2)
                    childBox.x2 = box.x2;
            } else {
                if (child.expand) {
                    childBox.x1 = x - availWidth;
                    childBox.x2 = x;
                } else if (child.align === St.Align.MIDDLE) {
                    childBox.x1 = x - Math.round(extraWidth / 2);
                    childBox.x2 = childBox.x1 + naturalWidth;
                } else if (child.align === St.Align.END) {
                    // align to the left
                    childBox.x1 = x - availWidth;
                    childBox.x2 = childBox.x1 + naturalWidth;
                } else {
                    // align to the right
                    childBox.x2 = x;
                    childBox.x1 = x - naturalWidth;
                }

                //when somehow the actor is wider than the box, cut it off
                if(childBox.x1 < box.x1)
                    childBox.x1 = box.x1;
            }

            let [minHeight, naturalHeight] = child.actor.get_preferred_height(childBox.x2 - childBox.x1);
            childBox.y1 = Math.round(box.y1 + (height - naturalHeight) / 2);
            childBox.y2 = childBox.y1 + naturalHeight;

            child.actor.allocate(childBox, flags);

            if (direction == St.TextDirection.LTR)
                x += availWidth + this._spacing;
            else
                x -= availWidth + this._spacing;
        }
    }
};
Signals.addSignalMethods(PopupBaseMenuItem.prototype);

function PopupMenuItem() {
    this._init.apply(this, arguments);
}

PopupMenuItem.prototype = {
    __proto__: PopupBaseMenuItem.prototype,

    _init: function (text, params) {
        PopupBaseMenuItem.prototype._init.call(this, params);

        this.label = new St.Label({ text: text });
        this.addActor(this.label);
        this.actor.label_actor = this.label;
    }
};

function PopupSeparatorMenuItem() {
    this._init();
}

PopupSeparatorMenuItem.prototype = {
    __proto__: PopupBaseMenuItem.prototype,

    _init: function () {
        PopupBaseMenuItem.prototype._init.call(this, { reactive: false });

        this._drawingArea = new St.DrawingArea({ style_class: 'popup-separator-menu-item' });
        this.addActor(this._drawingArea, { span: -1, expand: true });
        this._drawingArea.connect('repaint', Lang.bind(this, this._onRepaint));
    },

    _onRepaint: function(area) {
        let cr = area.get_context();
        let themeNode = area.get_theme_node();
        let [width, height] = area.get_surface_size();
        let margin = themeNode.get_length('-margin-horizontal');
        let gradientHeight = themeNode.get_length('-gradient-height');
        let startColor = themeNode.get_color('-gradient-start');
        let endColor = themeNode.get_color('-gradient-end');

        let gradientWidth = (width - margin * 2);
        let gradientOffset = (height - gradientHeight) / 2;
        let pattern = new Cairo.LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight);
        pattern.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        pattern.addColorStopRGBA(0.5, endColor.red / 255, endColor.green / 255, endColor.blue / 255, endColor.alpha / 255);
        pattern.addColorStopRGBA(1, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        cr.setSource(pattern);
        cr.rectangle(margin, gradientOffset, gradientWidth, gradientHeight);
        cr.fill();

        cr.$dispose();
    }
};

const PopupAlternatingMenuItemState = {
    DEFAULT: 0,
    ALTERNATIVE: 1
}

function PopupAlternatingMenuItem() {
    this._init.apply(this, arguments);
}

PopupAlternatingMenuItem.prototype = {
    __proto__: PopupBaseMenuItem.prototype,

    _init: function(text, alternateText, params) {
        PopupBaseMenuItem.prototype._init.call(this, params);
        this.actor.add_style_class_name('popup-alternating-menu-item');

        this._text = text;
        this._alternateText = alternateText;
        this.label = new St.Label({ text: text });
        this.state = PopupAlternatingMenuItemState.DEFAULT;
        this.addActor(this.label);

        this.actor.connect('notify::mapped', Lang.bind(this, this._onMapped));
    },

    _onMapped: function() {
        if (this.actor.mapped) {
            this._capturedEventId = global.stage.connect('captured-event',
                                                         Lang.bind(this, this._onCapturedEvent));
            this._updateStateFromModifiers();
        } else {
            if (this._capturedEventId != 0) {
                global.stage.disconnect(this._capturedEventId);
                this._capturedEventId = 0;
            }
        }
    },

    _setState: function(state) {
        if (this.state != state) {
            if (state == PopupAlternatingMenuItemState.ALTERNATIVE && !this._canAlternate())
                return;

            this.state = state;
            this._updateLabel();
        }
    },

    _updateStateFromModifiers: function() {
        let [x, y, mods] = global.get_pointer();
        let state;

        if ((mods & Clutter.ModifierType.MOD1_MASK) == 0) {
            state = PopupAlternatingMenuItemState.DEFAULT;
        } else {
            state = PopupAlternatingMenuItemState.ALTERNATIVE;
        }

        this._setState(state);
    },

    _onCapturedEvent: function(actor, event) {
        if (event.type() != Clutter.EventType.KEY_PRESS &&
            event.type() != Clutter.EventType.KEY_RELEASE)
            return false;

        let key = event.get_key_symbol();

        if (key == Clutter.KEY_Alt_L || key == Clutter.KEY_Alt_R)
            this._updateStateFromModifiers();

        return false;
    },

    _updateLabel: function() {
        if (this.state == PopupAlternatingMenuItemState.ALTERNATIVE) {
            this.actor.add_style_pseudo_class('alternate');
            this.label.set_text(this._alternateText);
        } else {
            this.actor.remove_style_pseudo_class('alternate');
            this.label.set_text(this._text);
        }
    },

    _canAlternate: function() {
        if (this.state == PopupAlternatingMenuItemState.DEFAULT && !this._alternateText)
            return false;
        return true;
    },

    updateText: function(text, alternateText) {
        this._text = text;
        this._alternateText = alternateText;

        if (!this._canAlternate())
            this._setState(PopupAlternatingMenuItemState.DEFAULT);

        this._updateLabel();
    }
};

function PopupSliderMenuItem() {
    this._init.apply(this, arguments);
}

PopupSliderMenuItem.prototype = {
    __proto__: PopupBaseMenuItem.prototype,

    _init: function(value) {
        PopupBaseMenuItem.prototype._init.call(this, { activate: false });

        this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));

        if (isNaN(value))
            // Avoid spreading NaNs around
            throw TypeError('The slider value must be a number');
        this._value = Math.max(Math.min(value, 1), 0);

        this._slider = new St.DrawingArea({ style_class: 'popup-slider-menu-item', reactive: true });
        this.addActor(this._slider, { span: -1, expand: true });
        this._slider.connect('repaint', Lang.bind(this, this._sliderRepaint));
        this.actor.connect('button-press-event', Lang.bind(this, this._startDragging));
        this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));

        this._releaseId = this._motionId = 0;
        this._dragging = false;
    },

    setValue: function(value) {
        if (isNaN(value))
            throw TypeError('The slider value must be a number');

        this._value = Math.max(Math.min(value, 1), 0);
        this._slider.queue_repaint();
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
        Clutter.grab_pointer(this._slider);
        this._releaseId = this._slider.connect('button-release-event', Lang.bind(this, this._endDragging));
        this._motionId = this._slider.connect('motion-event', Lang.bind(this, this._motionEvent));
        let absX, absY;
        [absX, absY] = event.get_coords();
        this._moveHandle(absX, absY);
    },

    _endDragging: function() {
        if (this._dragging) {
            this._slider.disconnect(this._releaseId);
            this._slider.disconnect(this._motionId);

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

        this._slider.queue_repaint();
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
        [sliderX, sliderY] = this._slider.get_transformed_position();
        relX = absX - sliderX;
        relY = absY - sliderY;

        let width = this._slider.width;
        let handleRadius = this._slider.get_theme_node().get_length('-slider-handle-radius');

        let newvalue;
        if (relX < handleRadius)
            newvalue = 0;
        else if (relX > width - handleRadius)
            newvalue = 1;
        else
            newvalue = (relX - handleRadius) / (width - 2 * handleRadius);
        this._value = newvalue;
        this._slider.queue_repaint();
        this.emit('value-changed', this._value);
    },

    get value() {
        return this._value;
    },

    _onKeyPressEvent: function (actor, event) {
        let key = event.get_key_symbol();
        if (key == Clutter.KEY_Right || key == Clutter.KEY_Left) {
            let delta = key == Clutter.KEY_Right ? 0.1 : -0.1;
            this._value = Math.max(0, Math.min(this._value + delta, 1));
            this._slider.queue_repaint();
            this.emit('value-changed', this._value);
            this.emit('drag-end');
            return true;
        }
        return false;
    }
};

function Switch() {
    this._init.apply(this, arguments);
}

Switch.prototype = {
    _init: function(state) {
        this.actor = new St.Bin({ style_class: 'toggle-switch' ,
                                  accessible_role: Atk.Role.CHECK_BOX});
        // Translators: this MUST be either "toggle-switch-us"
        // (for toggle switches containing the English words
        // "ON" and "OFF") or "toggle-switch-intl" (for toggle
        // switches containing "O" and "|"). Other values will
        // simply result in invisible toggle switches.
        this.actor.add_style_class_name("toggle-switch-us");
        this.setToggleState(state);
    },

    setToggleState: function(state) {
        this.actor.change_style_pseudo_class('checked', state);
        this.state = state;
    },

    toggle: function() {
        this.setToggleState(!this.state);
    }
};

function PopupSwitchMenuItem() {
    this._init.apply(this, arguments);
}

PopupSwitchMenuItem.prototype = {
    __proto__: PopupBaseMenuItem.prototype,

    _init: function(text, active, params) {
        PopupBaseMenuItem.prototype._init.call(this, params);

        this.label = new St.Label({ text: text });
        this._statusLabel = new St.Label({ text: '', style_class: 'popup-inactive-menu-item' });

        this._switch = new Switch(active);

        this.addActor(this.label);
        this.addActor(this._statusLabel);

        this._statusBin = new St.Bin({ x_align: St.Align.END });
        this.addActor(this._statusBin, { expand: true, span: -1, align: St.Align.END });
        this._statusBin.child = this._switch.actor;
    },

    setStatus: function(text) {
        if (text != null) {
            this._statusLabel.set_text(text);
        } else {
            this._statusLabel.set_text('');
        }
    },

    activate: function(event) {
        if (this._switch.actor.mapped) {
            this.toggle();
        }

        PopupBaseMenuItem.prototype.activate.call(this, event, true);
    },

    toggle: function() {
        this._switch.toggle();
        this.emit('toggled', this._switch.state);
    },

    get state() {
        return this._switch.state;
    },

    setToggleState: function(state) {
        this._switch.setToggleState(state);
    }
};

function PopupSwitchIconMenuItem() {
    this._init.apply(this, arguments);
}

PopupSwitchIconMenuItem.prototype = {
    __proto__: PopupBaseMenuItem.prototype,

    /**
     * _init:
     * @text (string): text to display in the label
     * @active: boolean to set switch on or off
     * @iconName (string): name of the icon used
     * @iconType (St.IconType): the type of icon (usually #St.IconType.SYMBOLIC
     * or #St.IconType.FULLCOLOR)
     * @params (JSON): parameters to pass to %PopupMenu.PopupBaseMenuItem._init
     */
    _init: function(text, active, iconName, iconType, params) {
        PopupBaseMenuItem.prototype._init.call(this, params);

        this.label = new St.Label({ text: text });
        this._statusLabel = new St.Label({ text: '', style_class: 'popup-inactive-menu-item' });

        this._icon = new St.Icon({ style_class: 'popup-menu-icon',
            icon_name: iconName,
            icon_type: iconType});

        this._switch = new Switch(active);

        this.addActor(this._icon, {span: 0});
        this.addActor(this.label);
        this.addActor(this._statusLabel);

        this._statusBin = new St.Bin({ x_align: St.Align.END });
        this.addActor(this._statusBin, { expand: true, span: -1, align: St.Align.END });
        this._statusBin.child = this._switch.actor;
    },

    /**
     * setIconSymbolicName:
     * @iconName (string): name of the icon
     *
     * Changes the icon to a symbolic icon with name @iconName.
     */
    setIconSymbolicName: function (iconName) {
        this._icon.set_icon_name(iconName);
        this._icon.set_icon_type(St.IconType.SYMBOLIC);
    },

    /**
     * setIconName:
     * @iconName (string): name of the icon
     *
     * Changes the icon to a full color icon with name @iconName.
     */
    setIconName: function (iconName) {
        this._icon.set_icon_name(iconName);
        this._icon.set_icon_type(St.IconType.FULLCOLOR);
    },

    setStatus: function(text) {
        if (text != null) {
            this._statusLabel.set_text(text);
        } else {
            this._statusLabel.set_text('');
        }
    },

    activate: function(event) {
        if (this._switch.actor.mapped) {
            this.toggle();
        }

        PopupBaseMenuItem.prototype.activate.call(this, event, true);
    },

    toggle: function() {
        this._switch.toggle();
        this.emit('toggled', this._switch.state);
    },

    get state() {
        return this._switch.state;
    },

    setToggleState: function(state) {
        this._switch.setToggleState(state);
    }
};

/**
 * #PopupIconMenuItem:
 * @short_description: A menu item with an icon and a text.
 *
 * This is a popup menu item displaying an icon and a text. The icon is
 * displayed to the left of the text. #PopupImageMenuItem is a similar,
 * deprecated item, that displays the icon to the right of the text, which is
 * ugly in most cases. Do not use it. If you think you need to display the icon
 * on the right, make your own menu item (by copy and pasting the code found
 * below) because PopupImageMenuItem is deprecated and may disappear any time.
 */
function PopupIconMenuItem() {
    this._init.apply(this, arguments);
}

PopupIconMenuItem.prototype = {
    __proto__: PopupBaseMenuItem.prototype,

    /**
     * _init:
     * @text (string): text to display in the label
     * @iconName (string): name of the icon used
     * @iconType (St.IconType): the type of icon (usually #St.IconType.SYMBOLIC
     * or #St.IconType.FULLCOLOR)
     * @params (JSON): parameters to pass to %PopupMenu.PopupBaseMenuItem._init
     */
    _init: function (text, iconName, iconType, params) {
        PopupBaseMenuItem.prototype._init.call(this, params);

        this.label = new St.Label({text: text});
        this._icon = new St.Icon({ style_class: 'popup-menu-icon',
            icon_name: iconName,
            icon_type: iconType});
        this.addActor(this._icon, {span: 0});
        this.addActor(this.label);
    },

    /**
     * setIconSymbolicName:
     * @iconName (string): name of the icon
     *
     * Changes the icon to a symbolic icon with name @iconName.
     */
    setIconSymbolicName: function (iconName) {
        this._icon.set_icon_name(iconName);
        this._icon.set_icon_type(St.IconType.SYMBOLIC);
    },

    /**
     * setIconName:
     * @iconName (string): name of the icon
     *
     * Changes the icon to a full color icon with name @iconName.
     */
    setIconName: function (iconName) {
        this._icon.set_icon_name(iconName);
        this._icon.set_icon_type(St.IconType.FULLCOLOR);
    }
}

// Deprecated. Do not use
function PopupImageMenuItem() {
    this._init.apply(this, arguments);
}

PopupImageMenuItem.prototype = {
    __proto__: PopupBaseMenuItem.prototype,

    _init: function (text, iconName, params) {
        PopupBaseMenuItem.prototype._init.call(this, params);

        this.label = new St.Label({ text: text });
        this.addActor(this.label);
        this._icon = new St.Icon({ style_class: 'popup-menu-icon' });
        this.addActor(this._icon, { align: St.Align.END });

        this.setIcon(iconName);
    },

    setIcon: function(name) {
        this._icon.icon_name = name;
    }
};

/**
 * #PopupIndicatorMenuItem:
 * @short_description: A menu item with text, ornaments and accel.
 *
 * This is a popup menu item displaying an text, a accel, and a ornament. The ornament
 * is displayed to the left of the text and the accel will be displayed at the end of
 * the item. The default ornament is an icon,  but can be replace for a check button,
 * a radio button or empty.
 */
function PopupIndicatorMenuItem() {
    this._init.apply(this, arguments);
}

PopupIndicatorMenuItem.prototype = {
    __proto__: PopupBaseMenuItem.prototype,

    _init: function(text, params) {
        PopupBaseMenuItem.prototype._init.call(this, params);
        this.actor._delegate = this;
        this._displayIcon = false;

        this.label = new St.Label({ text: text });
        this._accel = new St.Label({ x_align: St.Align.END });
        this._ornament = new St.Bin();
        this._icon = new St.Icon({ style_class: 'popup-menu-icon', icon_type: St.IconType.FULLCOLOR });

        this._ornament.child = this._icon;
        this.addActor(this._ornament, {span: 0});
        this.addActor(this.label);
        this.addActor(this._accel, { align: St.Align.END });
    },

    setAccel: function(accel) {
        this._accel.set_text(accel);
    },

    haveIcon: function() {
        return ((this._icon)&&((this._icon.icon_name && this._icon.icon_name != "") || (this._icon.gicon)));
    },

    setIconName: function(name) {
        if (this._icon)
            this._icon.icon_name = name;
    },

    setGIcon: function(gicon) {
        if (this._icon)
            this._icon.gicon = gicon;
    },

    setOrnament: function(ornamentType, state) {
        switch (ornamentType) {
        case OrnamentType.CHECK:
            if ((this._ornament.child)&&(!(this._ornament.child._delegate instanceof CheckBox.CheckButton))) {
                this._ornament.child.destroy();
                this._ornament.child = null;
            }
            if (!this._ornament.child) {
                let switchOrn = new CheckBox.CheckButton(state);
                this._ornament.child = switchOrn.actor;
            } else {
                this._ornament.child._delegate.setToggleState(state);
            }
            this._icon = null;
            break;
        case OrnamentType.DOT:
            if ((this._ornament.child)&&(!(this._ornament.child._delegate instanceof RadioButton.RadioBox))) {
                this._ornament.child.destroy();
                this._ornament.child = null;
            }
            if (!this._ornament.child) {
                let radioOrn = new RadioButton.RadioBox(state);
                this._ornament.child = radioOrn.actor;
            } else {
                this._ornament.child._delegate.setToggleState(state);
            }
            this._icon = null;
            break;
        }
    },

    destroy: function() {
        if (this.actor) {
            PopupMenuItem.prototype.destroy.call(this);
            this.actor = null;
        }
    }
};

/**
 * #PopupMenuAbstractItem:
 * @short_description: A class to represent any abstract menu item.
 *
 * This is an abstract class for create a binding between the PopupMenuItem class ,
 * and an abstract representation of a menu item. If you want to create a cinnamon
 * menu structure, you need to inherit from this class and implement the functions
 * getItemById and handleEvent. All instances of this class need to have a unique
 * id to represent a menu item.
 */
function PopupMenuAbstractItem() {
    throw new TypeError('Trying to instantiate abstract class PopupMenuAbstractItem');
}

PopupMenuAbstractItem.prototype = {
    _init: function(id, childrenIds, params) {
        this._id = id;
        this._childrenIds = childrenIds;
        if (!this._childrenIds)
            this._childrenIds = new Array();

        /*this._shellMenuSignalsHandlers = null;
        this._internalSignalsHandlers = new SignalManager.SignalManager(this);
        this._externalSignalsHandlers = new SignalManager.SignalManager(this);*/

        this._internalSignalsHandlers = new Array();
        this._externalSignalsHandlers = new Array();
        this._shellItemSignalsHandlers = null;
        this._shellMenuSignalsHandlers = null;

        this.shellItem = null;
        this.parent = null;

        // Properties
        params = Params.parse (params, { label: "",
                                         accel: "",
                                         sensitive: true,
                                         visible: true,
                                         toggleType: "",
                                         toggleState: false,
                                         iconName: "",
                                         iconData: null,
                                         action:"",
                                         paramType: "", // This is a variant for GTK, better remove it?
                                         type: FactoryClassTypes.MenuItemClass
                                       });
        this._label = params.label;
        this._accel = params.accel;
        this._sensitive = params.sensitive;
        this._visible = params.visible;
        this._toggleType = params.toggleType;
        this._toggleState = params.toggleState;
        this._iconName = params.iconName;
        this._iconData = params.iconData;
        this._type = params.type;
        this._action = params.action;
        this._paramType = params.paramType;
    },

    getItemById: function(id) {throw new Error('Trying to use abstract function getItemById');},
    handleEvent: function(event, params) {throw new Error('Trying to use abstract function handleEvent');},
    //FIXME: Will be intresting this function? We don't use it anyway...
    //is_root: function() {throw new Error('Trying to use abstract function is_root');},

    isVisible: function() {
        return this._visible;
    },

    setVisible: function(visible) {
        if (this._visible != visible) {
            this._visible = visible;
            this._updateVisible();
        }
    },

    isSensitive: function() {
        return this._sensitive;
    },

    setSensitive: function(sensitive) {
        if (this._sensitive != sensitive) {
            this._sensitive = sensitive;
            this._updateSensitive();
        }
    },

    getLabel: function() {
        return this._label;
    },

    setLabel: function(label) {
        if (this._label != label) {
            this._label = label;
            this._updateLabel();
        }
    },

    getAction: function() {
        return this._action;
    },

    setAction: function(action) {
        if (this._action != action) {
            this._action = action;
        }
    },

    getParamType: function() {
        return this._paramType;
    },

    setParamType: function(paramType) {
        if (this._paramType != paramType) {
            this._paramType = paramType;
        }
    },

    getFactoryType: function() {
        return this._type;
    },

    setFactoryType: function(type) {
        if ((type) && (this._type != type)) {
            this._type = type;
            this._updateType();
        }
    },

    getIconName: function() {
        return this._iconName;
    },

    setIconName: function(iconName) {
        if (this._iconName != iconName) {
            this._iconName = iconName;
            this._updateImage();
        }
    },

    getGdkIcon: function() {
        return this._iconData;
    },

    setGdkIcon: function(iconData) {
        if (this._iconData != iconData) {
            this._iconData = iconData;
            this._updateImage();
        }
    },

    getToggleType: function() {
        return this._toggleType;
    },

    setToggleType: function(toggleType) {
        if (this._toggleType != toggleType) {
            this._toggleType = toggleType;
            this._updateOrnament();
        }
    },

    getToggleState: function() {
        return this._toggleState;
    },

    setToggleState: function(toggleState) {
        if (this._toggleState != toggleState) {
            this._toggleState = toggleState;
            this._updateOrnament();
        }
    },

    getAccel: function() {
        return this._accel;
    },

    setAccel: function(accel) {
        if (this._accel != accel) {
            this._accel = accel;
            this._updateAccel();
        }
    },

    setShellItem: function(shellItem, handlers) {
        if (this.shellItem != shellItem) {
            if (this.shellItem) {
                // FIXME: This create problems, why?
                //this.shellItem.destroy();
                global.logWarning("Attempt to override a shellItem, so we automatically destroy our original shellItem.");
            }
            this.shellItem = shellItem;

            if (this.shellItem) {
                // Initialize our state
                this._updateLabel();
                this._updateOrnament();
                this._updateAccel();
                this._updateImage();
                this._updateVisible();
                this._updateSensitive();

                /*for (let signal in handlers) {
                    this._internalSignalsHandlers.connect(this, signal, handlers[signal]);
                }*/
                this._connectAndSaveId(this, handlers, this._internalSignalsHandlers);

                this._shellItemSignalsHandlers = this._connectAndSaveId(this.shellItem, {
                    'activate':  Lang.bind(this, this._onActivate),
                    'destroy' :  Lang.bind(this, this._onShellItemDestroyed)
                });
                /*this._internalSignalsHandlers.connect(this.shellItem, 'activate', this._onActivate);
                this._internalSignalsHandlers.connect(this.shellItem, 'destroy', this._onShellItemDestroyed);*/

                if (this.shellItem.menu) {
                    /*this._shellMenuSignalsHandlers = new SignalManager.SignalManager(this);
                    this._shellMenuSignalsHandlers.connect(this.shellItem.menu, 'open-state-changed', this._onOpenStateChanged);
                    this._shellMenuSignalsHandlers.connect(this.shellItem.menu, 'destroy', this._onShellMenuDestroyed);*/
                    this._shellMenuSignalsHandlers = this._connectAndSaveId(this.shellItem.menu, {
                        'open-state-changed': Lang.bind(this, this._onOpenStateChanged),
                        'destroy'           : Lang.bind(this, this._onShellMenuDestroyed)
                    });
                } else {
                    //this._internalSignalsHandlers.connect(this.shellItem, 'open-state-changed', this._onOpenStateChanged);
                    this._connectAndSaveId(this.shellItem, {
                        'open-state-changed': Lang.bind(this, this._onOpenStateChanged),
                    }, this._shellItemSignalsHandlers);
                }
            }
        }
    },

    _updateLabel: function() {
        if ((this.shellItem)&&(this.shellItem.label)) {
            let label = this.getLabel();
            // The separator item might not even have a hidden label
            if (this.shellItem.label)
                this.shellItem.label.set_text(label);
        }
    },

    _updateOrnament: function() {
        // Separators and alike might not have gotten the setOrnament function
        if ((this.shellItem)&&(this.shellItem.setOrnament)) {
            if (this.getToggleType() == "checkmark") {
                this.shellItem.setOrnament(OrnamentType.CHECK, this.getToggleState());
            } else if (this.getToggleType() == "radio") {
                this.shellItem.setOrnament(OrnamentType.DOT, this.getToggleState());
            } else {
                this.shellItem.setOrnament(OrnamentType.NONE);
            }
        }
    },

    _updateAccel: function() {
        if ((this.shellItem)&&(this.shellItem._accel)) {
            let accel = this.getAccel();
            if (accel) {
                this.shellItem._accel.set_text(accel);
            }
        }
    },

    _updateImage: function() {
        // Might be missing on submenus / separators
        if ((this.shellItem)&&(this.shellItem._icon)) {
            let iconName = this.getIconName();
            if (iconName) {
                if (this.shellItem.setIconName)
                    this.shellItem.setIconName(iconName);
                else if (this.shellItem._icon) {
                    this.shellItem._icon.icon_name = iconName;
                    this.shellItem._icon.show();
                }
            } else {
                let gicon = this.getGdkIcon();
                if (gicon) {
                    if (this.shellItem.setGIcon)
                        this.shellItem.setGIcon(gicon);
                    else if (this.shellItem._icon) {
                        this.shellItem._icon.gicon = gicon;
                        this.shellItem._icon.show();
                    }
                }
            }
        }
    },

    _updateVisible: function() {
        if (this.shellItem) {
            this.shellItem.actor.visible = this.isVisible();
        }
    },

    _updateSensitive: function() {
        if ((this.shellItem)&&(this.shellItem.setSensitive)) {
            this.shellItem.setSensitive(this.isSensitive());
        }
    },

    _updateType: function() {
        this.emit('type-changed');
    },

    getShellItem: function() {
        return this.shellItem;
    },

    getId: function() {
        return this._id;
    },

    getChildrenIds: function() {
        // Clone it!
        return this._childrenIds.concat();
    },

    getChildren: function() {
        return this._childrenIds.map(function(child_id) {
            return this.getItemById(child_id);
        }, this);
    },

    getParent: function() {
        return this.parent;
    },

    setParent: function(parent) {
        this.parent = parent;
    },

    addChild: function(pos, child_id) {
        let factoryItem = this.getItemById(child_id);
        if (factoryItem) {
            // If our item is previusly assigned, so destroy first the shell item.
            factoryItem.destroyShellItem();
            factoryItem.setParent(this);
            this._childrenIds.splice(pos, 0, child_id);
            this.emit('child-added', factoryItem, pos);
        }
    },

    removeChild: function(child_id) {
        // Find it
        let pos = -1;
        for (let i = 0; i < this._childrenIds.length; ++i) {
            if (this._childrenIds[i] == child_id) {
                pos = i;
                break;
            }
        }

        if (pos < 0) {
            global.logError("Trying to remove child which doesn't exist");
        } else {
            this._childrenIds.splice(pos, 1);
            let factoryItem = this.getItemById(child_id);
            if (factoryItem) {
                let shellItem = factoryItem.getShellItem();
                this._destroyShellItem(shellItem);
                factoryItem.setParent(null);
                this.emit('child-removed', factoryItem);
            }
        }
        if (this._childrenIds.length == 0) {
            this.emit('childs-empty');
        }
    },

    moveChild: function(child_id, newpos) {
        // Find the old position
        let oldpos = -1;
        for (let i = 0; i < this._childrenIds.length; ++i) {
            if (this._childrenIds[i] == child_id) {
                oldpos = i;
                break;
            }
        }

        if (oldpos < 0) {
            global.logError("Tried to move child which wasn't in the list");
            return;
        }

        if (oldpos != newpos) {
            this._childrenIds.splice(oldpos, 1);
            this._childrenIds.splice(newpos, 0, child_id);
            this.emit('child-moved', this.getItemById(child_id), oldpos, newpos);
        }
    },

    // handlers = { "signal": handler }
    connectAndRemoveOnDestroy: function(handlers) {
        /*for (let signal in handlers) {
            this._externalSignalsHandlers.connect(this, signal, handlers[signal]);
        }*/
        this._connectAndSaveId(this, handlers, this._externalSignalsHandlers);
    },

    destroyShellItem: function() {
        this._destroyShellItem(this.shellItem);
    },

    // We try to not crash cinnamon if a shellItem will be destroyed and has the focus,
    // then we are moving the focus to the source actor.
    _destroyShellItem: function(shellItem) {
        if (shellItem) {
            let focus = global.stage.key_focus;
            if (shellItem.close)
                shellItem.close();
            if (shellItem.menu)
                shellItem.menu.close();
            if (focus && shellItem.actor && shellItem.actor.contains(focus)) {
                if (shellItem.sourceActor)
                    shellItem.sourceActor.grab_key_focus();
                else if ((shellItem.menu)&&(shellItem.menu.sourceActor))
                    shellItem.menu.sourceActor.grab_key_focus();
                else
                    global.stage.set_key_focus(null);
            }
            shellItem.destroy();
        }
    },

    // handlers = { "signal": handler }
    _connectAndSaveId: function(target, handlers , idArray) {
        idArray = typeof idArray != 'undefined' ? idArray : [];
        for (let signal in handlers) {
            idArray.push(target.connect(signal, handlers[signal]));
        }
        return idArray;
    },

    _disconnectSignals: function(obj, signals_handlers) {
        if ((obj)&&(signals_handlers)) {
            for (let pos in signals_handlers)
                obj.disconnect(signals_handlers[pos]);
        }
    },

    _onActivate: function(shellItem, event, keepMenu) {
        this.handleEvent("clicked");
    },

    _onOpenStateChanged: function(menu, open) {
        if (open) {
            this.handleEvent("opened");
        } else {
            this.handleEvent("closed");
        }
    },

    _onShellItemDestroyed: function(shellItem) {
        if ((this.shellItem)&&(this.shellItem == shellItem)) {
            this.shellItem = null;
            /*if (this._internalSignalsHandlers) {
                this._internalSignalsHandlers.disconnectAllSignals();
            }*/
            if (this._internalSignalsHandlers) {
                this._disconnectSignals(this, this._internalSignalsHandlers);
                this._internalSignalsHandlers = [];
            }
            if (this._shellItemSignalsHandlers) {
                this._disconnectSignals(shellItem, this._shellItemSignalsHandlers);
                this._shellItemSignalsHandlers = null;
            }
        } else if (this.shellItem) {
            global.logError("We are not connected with " + shellItem);
        } else {
            global.logWarning("We are not connected with any shellItem");
        }
    },

    _onShellMenuDestroyed: function(shellMenu) {
        /*if (this._shellMenuSignalsHandlers) {
            this._shellMenuSignalsHandlers.disconnectAllSignals();
            this._shellMenuSignalsHandlers = null;
        }*/
        if (this._shellMenuSignalsHandlers) {
            this._disconnectSignals(shellMenu, this._shellMenuSignalsHandlers);
            this._shellMenuSignalsHandlers = null;
        }
    },

    destroy: function() {
        if (this._externalSignalsHandlers) {
            // Emit the destroy signal first, to allow the external listener know about it,
            // then, disconnect the listener handler.
            this.emit("destroy");
            this.destroyShellItem();
            this.shellItem = null;
            //this._externalSignalsHandlers.disconnectAllSignals();
            this._disconnectSignals(this, this._externalSignalsHandlers);
            this._externalSignalsHandlers = null;
            this._internalSignalsHandlers = null;
        }
    }
};
Signals.addSignalMethods(PopupMenuAbstractItem.prototype);

/**
 * #PopupMenuBase
 * @short_description: The base class of all popup menus
 * @sourceActor (St.Widget): The actor that owns the popup menu
 * @box (St.BoxLayout): The box containing the popup menu widgets.
 * @isOpen (boolean): Whether the popup menu is open.
 * @blockSourceEvents (boolean): If set, we don't send events (including
 * crossing events) to the source actor for the menu which causes its prelight
 * state to freeze
 *
 * @passEvents (boolean): Can be set while a menu is up to let all events
 * through without special menu handling useful for scrollbars in menus, and
 * probably not otherwise.
 *
 * @firstMenuItem (PopupMenu.PopupBaseMenuItem): The first item in the popup
 * menu
 * @numMenuItems (int): The number of items in the popup menu.
 *
 * This is a base popup menu class for more sophisticated popup menus to
 * inherit. This cannot be instantiated.
 */
function PopupMenuBase() {
    throw new TypeError('Trying to instantiate abstract class PopupMenuBase');
}

PopupMenuBase.prototype = {
    /**
     * _init:
     * @sourceActor (St.Widget): the actor that owns the popup menu
     * @styleClass (string): (optional) the style class of the popup menu
     */
    _init: function(sourceActor, styleClass) {
        this.sourceActor = sourceActor;

        if (styleClass !== undefined) {
            this.box = new St.BoxLayout({ style_class: styleClass,
                                          vertical: true });
        } else {
            this.box = new St.BoxLayout({ vertical: true });
        }
        this.box.connect_after('queue-relayout', Lang.bind(this, this._menuQueueRelayout));
        this.length = 0;

        this.isOpen = false;
        this.blockSourceEvents = false;
        this.passEvents = false;

        this._activeMenuItem = null;
        this._childMenus = [];
    },

    /**
     * addAction:
     * @title (string): the text to display on the item
     * @callback (function): the function to call when clicked
     *
     * Adds a #PopupMenuItem with label @title to the menu. When the item is
     * clicked, @callback will be called.
     *
     * Returns (PopupMenu.PopupMenuItem): the menu item created.
     */
    addAction: function(title, callback) {
        let menuItem = new PopupMenuItem(title);
        this.addMenuItem(menuItem);
        menuItem.connect('activate', Lang.bind(this, function (menuItem, event) {
            callback(event);
        }));

        return menuItem;
    },

    /**
     * addSettingsAction:
     * @title (string): the text to display on the item
     * @module (string): the module to launch
     *
     * Adds a #PopupMenuItem with label @title to the menu. When the item is
     * clicked, Cinnamon Settings will be launched with the module @module
     * activated.
     *
     * Returns (PopupMenu.PopupMenuItem): the menu item created.
     */
    addSettingsAction: function(title, module) {
        let menuItem = this.addAction(title, function() {
                           Util.spawnCommandLine("cinnamon-settings " + module);
                       });
        return menuItem;
    },

    /**
     * addCommandlineAction:
     * @title (string): the text to display on the item
     * @cmd (string): the command to call
     *
     * Adds a #PopupMenuItem with label @title to the menu. When the item is
     * clicked, the command @cmd will be executed.
     *
     * Returns (PopupMenu.PopupMenuItem): the menu item created.
     */
    addCommandlineAction: function(title, cmd) {
        let menuItem = this.addAction(title, function() {
                           Util.spawnCommandLine(cmd);
                       });
        return menuItem
    },

    /**
     * isChildMenu:
     * @menu (PopupMenu.PopupMenuBase): the menu of interest
     *
     * Returns: whether @menu is a submenu of this menu.
     */
    isChildMenu: function(menu) {
        return this._childMenus.indexOf(menu) != -1;
    },

    /**
     * addChildMenu:
     * @menu (PopupMenu.PopupMenuBase): the menu of interest
     *
     * Makes @menu a submenu of this menu.
     */
    addChildMenu: function(menu) {
        if (this.isChildMenu(menu))
            return;

        this._childMenus.push(menu);
        /**
         * SIGNAL:child-menu-added
         * @menu (PopupMenu.PopupMenuBase): The menu added
         *
         * Emitted when an menu is added as a submenu.
         */
        this.emit('child-menu-added', menu);
    },

    /**
     * removeChildMenu:
     * @menu (PopupMenuBase): the menu of interest
     *
     * Removes @menu from the current menu if it is a child.
     */
    removeChildMenu: function(menu) {
        let index = this._childMenus.indexOf(menu);

        if (index == -1)
            return;

        this._childMenus.splice(index, 1);
        this.emit('child-menu-removed', menu);
        /**
         * SIGNAL:child-menu-removed
         * @menu (PopupMenu.PopupMenuBase): The menu removed
         *
         * Emitted when an submenu is removed.
         */
    },

    _connectSubMenuSignals: function(object, menu) {
        /**
         * SIGNAL:activate
         * @menuItem (PopupBaseMenuItem): the item activated
         * @keepMenu (boolean): whether the menu should remain opened
         *
         * Emitted when an item of the menu is activated.
         */

        /**
         * SIGNAL:active-changed
         * @menuItem (PopupBaseMenuItem): the current active item (possibly null)
         *
         * Emitted when the active item of menu is changed.
         */

        object._subMenuActivateId = menu.connect('activate', Lang.bind(this, function(submenu, submenuItem, keepMenu) {
            this.emit('activate', submenuItem, keepMenu);
            if (!keepMenu){
                this.close(true);
            }
        }));
        object._subMenuActiveChangeId = menu.connect('active-changed', Lang.bind(this, function(submenu, submenuItem) {
            if (this._activeMenuItem && this._activeMenuItem != submenuItem)
                this._activeMenuItem.setActive(false);
            this._activeMenuItem = submenuItem;
            this.emit('active-changed', submenuItem);
        }));
    },

    _connectItemSignals: function(menuItem) {
        menuItem._activeChangeId = menuItem.connect('active-changed', Lang.bind(this, function (menuItem, active) {
            if (active && this._activeMenuItem != menuItem) {
                if (this._activeMenuItem)
                    this._activeMenuItem.setActive(false);
                this._activeMenuItem = menuItem;
                this.emit('active-changed', menuItem);
            } else if (!active && this._activeMenuItem == menuItem) {
                this._activeMenuItem = null;
                this.emit('active-changed', null);
            }
        }));
        menuItem._sensitiveChangeId = menuItem.connect('sensitive-changed', Lang.bind(this, function(menuItem, sensitive) {
            if (!sensitive && this._activeMenuItem == menuItem) {
                if (!this.actor.navigate_focus(menuItem.actor,
                                               Gtk.DirectionType.TAB_FORWARD,
                                               true))
                    this.actor.grab_key_focus();
            } else if (sensitive && this._activeMenuItem == null) {
                if (global.stage.get_key_focus() == this.actor)
                    menuItem.actor.grab_key_focus();
            }
        }));
        menuItem._activateId = menuItem.connect('activate', Lang.bind(this, function (menuItem, event, keepMenu) {
            this.emit('activate', menuItem, keepMenu);
            if (!keepMenu){
                this.close(true);
            }
        }));
        menuItem.connect('destroy', Lang.bind(this, function(emitter) {
            menuItem.disconnect(menuItem._activateId);
            menuItem.disconnect(menuItem._activeChangeId);
            menuItem.disconnect(menuItem._sensitiveChangeId);
            if (menuItem.menu) {
                menuItem.menu.disconnect(menuItem._subMenuActivateId);
                menuItem.menu.disconnect(menuItem._subMenuActiveChangeId);
                this.disconnect(menuItem._closingId);
            }
            if (menuItem == this._activeMenuItem)
                this._activeMenuItem = null;
            this.length--;
        }));
    },

    _updateSeparatorVisibility: function(menuItem) {
        let children = this.box.get_children();

        let index = children.indexOf(menuItem.actor);

        if (index < 0)
            return;

        let childBeforeIndex = index - 1;

        while (childBeforeIndex >= 0 && !children[childBeforeIndex].visible)
            childBeforeIndex--;

        if (childBeforeIndex < 0
            || children[childBeforeIndex].maybeGet("_delegate") instanceof PopupSeparatorMenuItem) {
            menuItem.actor.hide();
            return;
        }

        let childAfterIndex = index + 1;

        while (childAfterIndex < children.length && !children[childAfterIndex].visible)
            childAfterIndex++;

        if (childAfterIndex >= children.length
            || children[childAfterIndex]._delegate instanceof PopupSeparatorMenuItem) {
            menuItem.actor.hide();
            return;
        }

        menuItem.actor.show();
    },

    /**
     * addMenuItem:
     * @menuItem (PopupMenu.PopupBaseMenuItem): the item to include (can also
     * be a #PopupMenuSection)
     * @position (int): (optional) position to add the item at (empty for end
     * of menu)
     *
     * Adds the @menuItem to the menu.
     */
    addMenuItem: function(menuItem, position) {
        let before_item = null;
        if (position == undefined) {
            this.box.add(menuItem.actor);
        } else {
            let items = this._getMenuItems();
            if (position < items.length) {
                before_item = items[position].actor;
                this.box.insert_child_below(menuItem.actor, before_item);
            } else
                this.box.add(menuItem.actor);
        }
        if (menuItem instanceof PopupMenuSection) {
            this._connectSubMenuSignals(menuItem, menuItem);
            menuItem.connect('destroy', Lang.bind(this, function() {
                menuItem.disconnect(menuItem._subMenuActivateId);
                menuItem.disconnect(menuItem._subMenuActiveChangeId);

                this.length--;
            }));
        } else if (menuItem instanceof PopupSubMenuMenuItem) {
            if (before_item == null)
                this.box.add(menuItem.menu.actor);
            else
                this.box.insert_child_below(menuItem.menu.actor, before_item);
            this._connectSubMenuSignals(menuItem, menuItem.menu);
            this._connectItemSignals(menuItem);
            menuItem._closingId = this.connect('open-state-changed', function(self, open) {
                if (!open)
                    menuItem.menu.close(false);
            });
        } else if (menuItem instanceof PopupSeparatorMenuItem) {
            this._connectItemSignals(menuItem);

            // updateSeparatorVisibility needs to get called any time the
            // separator's adjacent siblings change visibility or position.
            // open-state-changed isn't exactly that, but doing it in more
            // precise ways would require a lot more bookkeeping.
            this.connect('open-state-changed', Lang.bind(this, function() { this._updateSeparatorVisibility(menuItem); }));
            this.box.connect('allocation-changed', Lang.bind(this, function() { this._updateSeparatorVisibility(menuItem); }));
        } else if (menuItem instanceof PopupBaseMenuItem)
            this._connectItemSignals(menuItem);
        else
            throw TypeError("Invalid argument to PopupMenuBase.addMenuItem()");

        this.length++;
    },

    /**
     * getColumnWidths:
     *
     * Gets the width of each column this thing has. In popup menus, everything
     * is put into columns, and the columns of all items align. This is used
     * internally and shouldn't be fiddled with unless you are implementing
     * other popup menu items.
     */
    getColumnWidths: function() {
        let columnWidths = [];
        let items = this.box.get_children();
        for (let i = 0; i < items.length; i++) {
            if (!items[i].visible)
                continue;
            if (items[i].maybeGet("_delegate") instanceof PopupBaseMenuItem || items[i].maybeGet("_delegate") instanceof PopupMenuBase) {
                let itemColumnWidths = items[i]._delegate.getColumnWidths();
                for (let j = 0; j < itemColumnWidths.length; j++) {
                    if (j >= columnWidths.length || itemColumnWidths[j] > columnWidths[j])
                        columnWidths[j] = itemColumnWidths[j];
                }
            }
        }
        return columnWidths;
    },

    /**
     * setColumnWidths:
     * @widths (array): the widths of each column
     *
     * Sets the widths of each column according to @widths so that things can
     * align.
     */
    setColumnWidths: function(widths) {
        let items = this.box.get_children();
        for (let i = 0; i < items.length; i++) {
            if (items[i].maybeGet("_delegate") instanceof PopupBaseMenuItem || items[i].maybeGet("_delegate") instanceof PopupMenuBase)
                items[i]._delegate.setColumnWidths(widths);
        }
    },

    // Because of the above column-width funniness, we need to do a
    // queue-relayout on every item whenever the menu itself changes
    // size, to force clutter to drop its cached size requests. (The
    // menuitems will in turn call queue_relayout on their parent, the
    // menu, but that call will be a no-op since the menu already
    // has a relayout queued, so we won't get stuck in a loop.
    _menuQueueRelayout: function() {
        this.box.get_children().map(function (actor) { actor.queue_relayout(); });
    },

    addActor: function(actor) {
        this.box.add(actor);
    },

    _getMenuItems: function() {
        return this.box.get_children().map(function (actor) {
            return actor._delegate;
        }).filter(function(item) {
            return item instanceof PopupBaseMenuItem || item instanceof PopupMenuSection;
        });
    },

    get firstMenuItem() {
        let items = this._getMenuItems();
        if (items.length)
            return items[0];
        else
            return null;
    },

    get numMenuItems() {
        return this._getMenuItems().length;
    },

    /**
     * removeAll:
     *
     * Clears everything inside the menu.
     */
    removeAll: function() {
        let children = this._getMenuItems();
        for (let i = 0; i < children.length; i++) {
            let item = children[i];
            item.destroy();
        }
    },

    /**
     * toggle:
     *
     * Toggles the open/close state of the menu.
     */
    toggle: function() {
        if (this.isOpen)
            this.close(true);
        else
            this.open(true);
    },

    /**
     * toggle_with_options:
     * @animate (boolean): whether or not to animate the open/close.
     * @onComplete (function): the function to call when the toggle action
     * completes.
     *
     * Toggles the open/close state of the menu with extra parameters
     */
    toggle_with_options: function (animate, onComplete) {
        if (this.isOpen) {
            this.close(animate, onComplete);
        } else {
            this.open(animate, onComplete);
        }
    },

    /**
     * destroy:
     *
     * Destroys the popup menu completely.
     */
    destroy: function() {
        this.removeAll();
        this.actor.destroy();
        /**
         * SIGNAL:destroy
         *
         * Emitted when the menu is destroyed.
         */
        this.emit('destroy');
    }
};
Signals.addSignalMethods(PopupMenuBase.prototype);

/**
 * #PopupMenu
 * @short_description: An actual popup menu
 * @actor (St.Bin): The actor of the popup menu.
 * @animating (boolean): Whether the popup menu is currently performing the
 * open/close animation.
 * @slidePosition (number): Position relative to the @sourceActor of the menu upon which the menu will be centered
 * (if possible). If -1, the menu will be centered on the @sourceActor. See %shiftToPosition for more details.
 */
function PopupMenu() {
    // orientation used to be passed as the third argument, but now we only have 2 args so if we get 3, we assume
    // that it's old code and only grab the ones we need
    if (arguments.length > 2) {
        this._init(arguments[0], arguments[2]);
    }
    else {
        this._init.apply(this, arguments);
    }
}

PopupMenu.prototype = {
    __proto__: PopupMenuBase.prototype,

    /**
     * _init:
     * @sourceActor (St.Widget): the actor that owns the popup menu
     * @orientation (St.Side): the side of the menu that will be attached to @sourceActor. See %setOrientation() for details
     */
    _init: function(sourceActor, orientation) {
        PopupMenuBase.prototype._init.call (this, sourceActor, 'popup-menu-content');

        this.paint_id = 0;
        this.paint_count = 0;
        this.animating = false;
        this._slidePosition = -1;

        this.actor = new St.Bin({ style_class: 'menu',
                                  important: true });
        this.actor._delegate = this;
        this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));

        this.setOrientation(orientation);

        this._boxWrapper = new Cinnamon.GenericContainer();
        this._boxWrapper.connect('get-preferred-width', Lang.bind(this, this._boxGetPreferredWidth));
        this._boxWrapper.connect('get-preferred-height', Lang.bind(this, this._boxGetPreferredHeight));
        this._boxWrapper.connect('allocate', Lang.bind(this, this._boxAllocate));
        this.actor.set_child(this._boxWrapper);
        this._boxWrapper.add_actor(this.box);

        global.focus_manager.add_group(this.actor);
        this.actor.reactive = true;
    },

    /**
     * setArrowSide:
     * @side (St.Side): The new side of the menu
     *
     * Sets the orientation of the @sourceActor with respect to the menu. This function is deprecated and kept
     * for compatibility with older code. Please use %setOrientation instead.
     */
    setArrowSide: function(side) {
        this.setOrientation(side);
    },

    /**
     * setOrientation:
     * @orientation (St.Side): The new orientation of the menu
     *
     * Sets the orientation of the @sourceActor with respect to the menu. For example, if you use St.Side.TOP,
     * the menu will try to place itself below the @sourcActor unless there is not enough room for it.
     */
    setOrientation: function(orientation) {
        this._orientation = orientation;
    },

    /**
     * setCustomStyleClass:
     * @className (string): the custom class name to add
     *
     * Adds a custom class name to the menu which allows it to be styled separately from other menus.
     */
    setCustomStyleClass: function(className) {
        this.customStyleClass = className;
        if (this.actor.get_style_class_name()) {
            this.actor.set_style_class_name(this.actor.get_style_class_name() + "" + className)
        } else {
            this.actor.set_style_class_name(className);
        }
    },

    /**
     * setSourceAlignment:
     * @alignment (real): the position of the arrow relative to the source
     * actor.
     *
     * Since the boxpointer was removed from the menu, this function now does nothing. Please do not use this
     * function in new code.
     */
    setSourceAlignment: function(alignment) {},

    /**
     * open:
     * @animate (boolean): whether to animate the open effect or not
     *
     * Opens the popup menu
     */
    open: function(animate) {
        if (this.isOpen)
            return;

        Main.popup_rendering_actor = this.actor;

        this.setMaxHeight();

        this.isOpen = true;
        if (global.menuStackLength == undefined)
            global.menuStackLength = 0;
        global.menuStackLength += 1;

        this.paint_id = this.actor.connect("paint", Lang.bind(this, this.on_paint));

        /* If the sourceActor of our menu is located on a panel or from the panel itself, we want to position it just
           below the panel actors. This prevents some cases where the menu will otherwise partially overlap the panel
           and look strange visually */
        let parentPanel = null;
        if (this.sourceActor.get_name() == "panel") {
            parentPanel = this.sourceActor;
        } else {
            let parent = this.sourceActor.get_parent();
            while (parent) {
                if (parent.get_name() == "panel") {
                    parentPanel = parent;
                    break;
                }
                parent = parent.get_parent();
            }
        }

        if (parentPanel) {
            let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor)
            let panels = Main.panelManager.getPanelsInMonitor(Main.layoutManager.monitors.indexOf(monitor));
            let children = Main.uiGroup.get_children();
            let panelIndex = children.indexOf(parentPanel);

            for (let i = 0; i < panels.length; i++) {
                let idx = children.indexOf(panels[i].actor);
                if (idx < panelIndex)
                    panelIndex = idx;
            }

            Main.uiGroup.set_child_below_sibling(this.actor, Main.uiGroup.get_child_at_index(panelIndex));
        } else {
            Main.uiGroup.set_child_above_sibling(this.actor, null);
        }

        if (animate && global.settings.get_boolean("desktop-effects-on-menus")) {
            this.animating = true;

            // the actor is going to be painted before we set the right position for animation so we set the opacity
            // to 0 in order to prevent flashing in the wrong position
            this.actor.opacity = 0;
            this.actor.show();

            // we need to give the actors a chance to allocate before animating so we get the correct values
            Mainloop.idle_add(Lang.bind(this, function() {
                let tweenParams = {
                    transition: "easeOutQuad",
                    time: .15,
                    onUpdate: Lang.bind(this, function(dest) {
                        let clipY = 0;
                        let clipX = 0;
                        switch (this._orientation) {
                            case St.Side.TOP:
                            case St.Side.BOTTOM:
                                clipY = dest - this.actor.y;
                                break;
                            case St.Side.LEFT:
                            case St.Side.RIGHT:
                                clipX = dest - this.actor.x;
                                break;
                        }
                        this.actor.set_clip(clipX, clipY, this.actor.width, this.actor.height);
                    }),
                    opacity: 255,
                    onCompleteScope: this,
                    onComplete: function() {
                        this.animating = false;
                        this.actor.remove_clip();
                    }
                }

                let [xPos, yPos] = this._calculatePosition();

                switch (this._orientation) {
                    case St.Side.TOP:
                    case St.Side.BOTTOM:
                        this.actor["x"] = xPos;
                        tweenParams["y"] = yPos;
                        tweenParams["onUpdateParams"] = [yPos];
                        if (this.sideFlipped)
                            this.actor["y"] = yPos + this.actor.height;
                        else
                            this.actor["y"] = yPos - this.actor.height;
                        break;
                    case St.Side.LEFT:
                    case St.Side.RIGHT:
                        this.actor["y"] = yPos;
                        tweenParams["x"] = xPos;
                        tweenParams["onUpdateParams"] = [xPos];
                        if (this.sideFlipped)
                            this.actor["x"] = xPos + this.actor.width;
                        else
                            this.actor["x"] = xPos - this.actor.width;
                        break;
                }
                this.actor.opacity = 0;
                Tweener.addTween(this.actor, tweenParams);
            }));
        }
        else {
            this.animating = false;
            this.actor.show();
        }

        this.emit('open-state-changed', true);
    },

    /**
     * close:
     * @animate (boolean): whether to animate the close effect or not
     *
     * Closes the popup menu.
     */
    close: function(animate) {
        if (!this.isOpen)
            return;

        this.isOpen = false;
        global.menuStackLength -= 1;

        Main.panelManager.updatePanelsVisibility();

        if (this._activeMenuItem)
            this._activeMenuItem.setActive(false);

        if (animate && global.settings.get_boolean("desktop-effects-on-menus")) {
            this.animating = true;
            let tweenParams = {
                transition: "easeInQuad",
                time: .15,
                onUpdate: Lang.bind(this, function(dest) {
                        let clipY = 0;
                        let clipX = 0;
                        switch (this._orientation) {
                            case St.Side.TOP:
                            case St.Side.BOTTOM:
                                clipY = dest - this.actor.y;
                                break;
                            case St.Side.LEFT:
                            case St.Side.RIGHT:
                                clipX = dest - this.actor.x;
                                break;
                        }
                        this.actor.set_clip(clipX, clipY, this.actor.width, this.actor.height);
                    }),
                onCompleteScope: this,
                opacity: 0,
                onComplete: function() {
                    this.animating = false;
                    this.actor.hide();
                    this.actor.remove_clip();
                    this.actor.opacity = 255;
                }
            }

            switch (this._orientation) {
                case St.Side.TOP:
                case St.Side.BOTTOM:
                    let yPos = this.actor.y;
                    tweenParams["onUpdateParams"] = [yPos];
                    if (this.sideFlipped)
                        tweenParams["y"] = this.actor.y + this.actor.height;
                    else
                        tweenParams["y"] = this.actor.y - this.actor.height;
                    break;
                case St.Side.LEFT:
                case St.Side.RIGHT:
                    let xPos = this.actor.x;
                    tweenParams["onUpdateParams"] = [xPos];
                    if (this.sideFlipped)
                        tweenParams["x"] = this.actor.x + this.actor.width;
                    else
                        tweenParams["x"] = this.actor.x - this.actor.width;
                    break;
            }
            Tweener.addTween(this.actor, tweenParams);
        }
        else {
            this.animating = false;
            this.actor.hide();
        }
        this.emit('open-state-changed', false);
    },

    /**
     * shiftToPosition:
     * @slidePosition (number): Position relative to the @sourceActor of the menu upon which the menu will be centered
     * (if possible). If -1, the menu will be centered on the @sourceActor.
     *
     * This function specifies a new position at which to center the menu. The position is given in coordinates
     * relative to the @sourceActor, and as such should always be positive. This is useful if, for example, you want
     * the menu to open at the location of a mouse click rather than at the center of the actor. This function only
     * moves the menu along one axis as determined by the orientation of the menu, so that the menu is always attached
     * to the @sourceActor. For example, if the orientation is set to St.Side.TOP, this function will move the center
     * along the x axis. If you have set the @slidePosition using this function and then wish to return to centering
     * the menu on the center of the @sourceActor, you can do so by setting it to -1.
     */
    shiftToPosition: function(slidePosition) {
        this._slidePosition = slidePosition;
        let [xPos, yPos] = this._calculatePosition();
        this.actor.set_position(xPos, yPos);
    },

    /**
     * setMaxHeight:
     *
     * This function is called internally to set the max-height and max-width
     * properties of the popup menu such that it does not grow to a size larger
     * than the monitor. Individual popup menus can override this method to
     * change the max height/width if they really want to.
     *
     * Note that setting the max-height won't do any good if the minimum height
     * of the menu is higher then the screen; it's useful if part of the menu
     * is scrollable so the minimum height is smaller than the natural height.
     */
    setMaxHeight: function() {
        let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor)

        let maxHeight = monitor.height;
        let maxWidth = monitor.width;

        let panels = Main.panelManager.getPanelsInMonitor(Main.layoutManager.monitors.indexOf(monitor));

        for (let panel of panels) {
            if (panel.panelPosition == PanelLoc.top || panel.panelPosition == PanelLoc.bottom) {
                maxHeight -= panel.actor.height;
            }
            else {
                maxWidth -= panel.actor.width;
            }
        }

        let themeNode = this.actor.get_theme_node();
        maxHeight -= (themeNode.get_border_width(St.Side.TOP) + themeNode.get_border_width(St.Side.BOTTOM));
        maxWidth -= (themeNode.get_border_width(St.Side.LEFT) + themeNode.get_border_width(St.Side.RIGHT));

        this.actor.style = 'max-height: ' + Math.floor(maxHeight / global.ui_scale) + 'px; ' +
                           'max-width: ' + Math.floor(maxWidth / global.ui_scale) + 'px;';
    },

    _calculatePosition: function() {
        if (!this.actor.visible) {
            this.box.show();
        }
        let sourceBox = Cinnamon.util_get_transformed_allocation(this.sourceActor);
        let [minWidth, minHeight, natWidth, natHeight] = this.actor.get_preferred_size();
        let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor);
        let x1 = monitor.x;
        let x2 = x1 + monitor.width;
        let y1 = monitor.y;
        let y2 = y1 + monitor.height;

        // remove panels from workable area to avoid overlapping them
        let panels = Main.panelManager.getPanelsInMonitor(Main.layoutManager.monitors.indexOf(monitor));

        for (let panel of panels) {
            switch (panel.panelPosition) {
                case PanelLoc.top:
                    y1 += panel.actor.height;
                    break;
                case PanelLoc.bottom:
                    y2 -= panel.actor.height;
                    break;
                case PanelLoc.left:
                    x1 += panel.actor.width;
                    break;
                case PanelLoc.right:
                    x2 -= panel.actor.width;
                    break;
            }
        }

        let xPos, yPos;
        let styleClasses = ["menu"];
        switch (this._orientation) {
            case St.Side.TOP:
            case St.Side.BOTTOM:
                // get center position of the actor and calculate the position needed to center the menu on the actor
                let xCenter = (this._slidePosition == -1) ? sourceBox.x1 + (sourceBox.x2 - sourceBox.x1) / 2 : this._slidePosition;
                xPos = xCenter - (natWidth / 2);

                // we don't want to go off the screen so we adjust if needed
                if (xPos < x1) xPos = x1;
                else if (xPos + natWidth > x2) xPos = x2 - natWidth;

                // now we calculate the x postion based on the orientation
                if (this._orientation == St.Side.BOTTOM) {
                    this.sideFlipped = true;
                    yPos = sourceBox.y1 - natHeight;
                    styleClasses.push("bottom");
                }
                else {
                    this.sideFlipped = false;
                    yPos = sourceBox.y2;
                    styleClasses.push("top");
                }
                break;
            case St.Side.LEFT:
            case St.Side.RIGHT:
                // align the top of the menu with the top of the source
                yPos = (this._slidePosition == -1) ? sourceBox.y1 : this._slidePosition;

                // we don't want to go off the screen so we adjust if needed
                if (yPos < y1) yPos = y1;
                else if (yPos + natHeight > y2) yPos = y2 - natHeight;

                // now we calculate the x postion based on the orientation
                // if the menu opens to the right, we also need to make sure we have room for it on that side
                if (this._orientation == St.Side.RIGHT || x2 - sourceBox.x2 < natWidth) {
                    this.sideFlipped = true;
                    xPos = sourceBox.x1 - natWidth;
                    styleClasses.push("right");
                }
                else {
                    this.sideFlipped = false;
                    xPos = sourceBox.x2;
                    styleClasses.push("left");
                }
                break;
        }
        if (this.customStyleClass) styleClasses.push(this.customStyleClass);
        this.actor.set_style_class_name(styleClasses.join(" "));
        return [Math.round(xPos), Math.round(yPos)];
    },

    _boxGetPreferredWidth: function (actor, forHeight, alloc) {
        let columnWidths = this.getColumnWidths();
        this.setColumnWidths(columnWidths);

        // Now they will request the right sizes
        [alloc.min_size, alloc.natural_size] = this.box.get_preferred_width(forHeight);
    },

    _boxGetPreferredHeight: function (actor, forWidth, alloc) {
        [alloc.min_size, alloc.natural_size] = this.box.get_preferred_height(forWidth);
    },

    _boxAllocate: function (actor, box, flags) {
        this.box.allocate(box, flags);
        if (!this.animating && this.sourceActor.get_stage() != null) {
            let [xPos, yPos] = this._calculatePosition();
            this.actor.set_position(xPos, yPos);
        }
    },

    _onKeyPressEvent: function(actor, event) {
        if (event.get_key_symbol() == Clutter.Escape) {
            this.close(true);
            return true;
        }

        return false;
    },

    on_paint: function(actor) {
        if (this.paint_count < 2 || this.animating) {
            this.paint_count++;
            return;
        }

        if (this.paint_id > 0) {
            this.actor.disconnect(this.paint_id);
            this.paint_id = 0;
        }

        this.paint_count = 0;
        Main.popup_rendering_actor = null;
    }
};

/**
 * #PopupSubMenu
 * @short_description: A submenu that can show and hide
 * @actor (St.ScrollView): The actor of the submenu.
 *
 * A submenu to be included in #PopupMenus/#PopupMenuSections. You usually
 * don't want to create these manually. Instead you want to create a
 * #PopupSubMenuMenuItem, which creates a #PopupSubMenu, and shows/hides the
 * menu when clicked.
 *
 * Since submenus are usually used to hide long lists of things, they are
 * automatically put into a #St.ScrollView such that their height will be limited
 * by the css max-height property.
 *
 * Inherits: PopupMenu.PopupMenuBase
 */
function PopupSubMenu() {
    this._init.apply(this, arguments);
}

PopupSubMenu.prototype = {
    __proto__: PopupMenuBase.prototype,

    /**
     * _init:
     * @sourceActor (St.Widget): the actor that owns the popup menu
     * @sourceArrow (St.Icon): (optional) a little arrow object inside the
     * #PopupSubMenuMenuItem. When the submenu opens, the arrow is rotated by
     * pi/2 clockwise to denote the status of the submenu.
     */
    _init: function(sourceActor, sourceArrow) {
        PopupMenuBase.prototype._init.call(this, sourceActor);

        this._arrow = sourceArrow;

        this.actor = new St.ScrollView({ style_class: 'popup-sub-menu',
                                         hscrollbar_policy: Gtk.PolicyType.NEVER,
                                         vscrollbar_policy: Gtk.PolicyType.NEVER });

        // StScrollbar plays dirty tricks with events, calling
        // clutter_set_motion_events_enabled (FALSE) during the scroll; this
        // confuses our event tracking, so we just turn it off during the
        // scroll.
        let vscroll = this.actor.get_vscroll_bar();
        vscroll.connect('scroll-start',
                        Lang.bind(this, function() {
                                      let topMenu = this._getTopMenu();
                                      if (topMenu)
                                          topMenu.passEvents = true;
                                  }));
        vscroll.connect('scroll-stop',
                        Lang.bind(this, function() {
                                      let topMenu = this._getTopMenu();
                                      if (topMenu)
                                          topMenu.passEvents = false;
                                  }));

        this.actor.add_actor(this.box);
        this.actor._delegate = this;
        this.actor.clip_to_allocation = true;
        this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
        this.actor.hide();
    },

    _getTopMenu: function() {
        let actor = this.actor.get_parent();
        while (actor) {
            if (actor._delegate && actor._delegate instanceof PopupMenu)
                return actor._delegate;

            actor = actor.get_parent();
        }

        return null;
    },

    _needsScrollbar: function() {
        let topMenu = this._getTopMenu();
        if(!topMenu)
            return false;
        let [topMinHeight, topNaturalHeight] = topMenu.actor.get_preferred_height(-1);
        let topThemeNode = topMenu.actor.get_theme_node();

        let topMaxHeight = topThemeNode.get_max_height();
        return topMaxHeight >= 0 && topNaturalHeight >= topMaxHeight;
    },

    /**
     * open:
     * @animate (boolean): whether the animate the open effect
     *
     * Opens the submenu
     */
    open: function(animate) {
        if (this.isOpen)
            return;

        this.isOpen = true;

        this.actor.show();

        let needsScrollbar = this._needsScrollbar();

        // St.ScrollView always requests space horizontally for a possible vertical
        // scrollbar if in AUTOMATIC mode. Doing better would require implementation
        // of width-for-height in St.BoxLayout and St.ScrollView. This looks bad
        // when we *don't* need it, so turn off the scrollbar when that's true.
        // Dynamic changes in whether we need it aren't handled properly.
        this.actor.vscrollbar_policy =
            needsScrollbar ? Gtk.PolicyType.AUTOMATIC : Gtk.PolicyType.NEVER;

        // It looks funny if we animate with a scrollbar (at what point is
        // the scrollbar added?) so just skip that case
        animate = animate && !needsScrollbar

        let targetAngle = this.actor.text_direction == Clutter.TextDirection.RTL ? -90 : 90;

        if (animate) {
            let [minHeight, naturalHeight] = this.actor.get_preferred_height(-1);
            this.actor.height = 0;
            if (this._arrow)
                this.actor._arrowRotation = this._arrow.rotation_angle_z;
            else
                this.actor._arrowRotation = targetAngle;
            Tweener.addTween(this.actor,
                             { _arrowRotation: targetAngle,
                               height: naturalHeight,
                               time: 0.25,
                               onUpdateScope: this,
                               onUpdate: function() {
                                   if (this._arrow)
                                       this._arrow.rotation_angle_z = this.actor._arrowRotation;
                               },
                               onCompleteScope: this,
                               onComplete: function() {
                                   this.actor.set_height(-1);
                                   this.emit('open-state-changed', true);
                               }
                             });
        } else {
            if (this._arrow)
                this._arrow.rotation_angle_z = targetAngle;
            this.emit('open-state-changed', true);
        }
    },

    /**
     * close:
     * @animate (boolean): whether the animate the close effect
     *
     * Closes the submenu
     */
    close: function(animate) {
        if (!this.isOpen)
            return;

        this.isOpen = false;

        if (this._activeMenuItem)
            this._activeMenuItem.setActive(false);

        animate = animate && !this._needsScrollbar();

        if (animate) {
            if (this._arrow)
                this.actor._arrowRotation = this._arrow.rotation_angle_z;
            Tweener.addTween(this.actor,
                             { _arrowRotation: 0,
                               height: 0,
                               time: 0.25,
                               onCompleteScope: this,
                               onComplete: function() {
                                   this.actor.hide();
                                   this.actor.set_height(-1);

                                   this.emit('open-state-changed', false);
                               },
                               onUpdateScope: this,
                               onUpdate: function() {
                                   if (this._arrow)
                                       this._arrow.rotation_angle_z = this.actor._arrowRotation;
                               }
                             });
            } else {
                if (this._arrow)
                    this._arrow.rotation_angle_z = 0;
                this.actor.hide();

                this.isOpen = false;
                this.emit('open-state-changed', false);
            }
    },

    _onKeyPressEvent: function(actor, event) {
        // Move focus back to parent menu if the user types Left.

        if (this.isOpen && event.get_key_symbol() == Clutter.KEY_Left) {
            this.close(true);
            this.sourceActor._delegate.setActive(true);
            return true;
        }

        return false;
    }
};

/**
 * #PopupMenuSection:
 * @short_description: A section of a #PopupMenu that is transparent to user
 *
 * A section of a PopupMenu which is handled like a submenu (you can add and
 * remove items, you can destroy it, you can add it to another menu), but is
 * completely transparent to the user. This is helpful for grouping things
 * together so that you can manage them in bulk. A common use case might be to
 * let an object inherit a #PopupMenuSection and then add the whole object to a
 * popup menu.
 *
 * Note that you cannot close a #PopupMenuSection.
 *
 * Inherits: PopupMenu.PopupMenuBase
 */
function PopupMenuSection() {
    this._init.apply(this, arguments);
}

PopupMenuSection.prototype = {
    __proto__: PopupMenuBase.prototype,

    _init: function() {
        PopupMenuBase.prototype._init.call(this);

        this.actor = this.box;
        this.actor._delegate = this;
        this.isOpen = true;
    },

    // deliberately ignore any attempt to open() or close()
    open: function(animate) { },
    close: function() { },

}

function PopupSubMenuMenuItem() {
    this._init.apply(this, arguments);
}

PopupSubMenuMenuItem.prototype = {
    __proto__: PopupBaseMenuItem.prototype,

    _init: function(text) {
        PopupBaseMenuItem.prototype._init.call(this);

        this.actor.add_style_class_name('popup-submenu-menu-item');

        this.label = new St.Label({ text: text,
                                    y_expand: true,
                                    y_align: Clutter.ActorAlign.CENTER });
        this.addActor(this.label);
        this.actor.label_actor = this.label;

        this._triangleBin = new St.Bin({ x_align: St.Align.END });
        this.addActor(this._triangleBin, { expand: true,
                                           span: -1,
                                           align: St.Align.END });

        this._triangle = arrowIcon(St.Side.RIGHT);
        this._triangle.pivot_point = new Clutter.Point({ x: 0.5, y: 0.6 });
        this._triangleBin.child = this._triangle;

        this.menu = new PopupSubMenu(this.actor, this._triangle);
        this.menu.connect('open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));
    },

    _subMenuOpenStateChanged: function(menu, open) {
        this.actor.change_style_pseudo_class('open', open);
    },

    destroy: function() {
        this.menu.destroy();
        PopupBaseMenuItem.prototype.destroy.call(this);
    },

    _onKeyPressEvent: function(actor, event) {
        let symbol = event.get_key_symbol();

        if (symbol == Clutter.KEY_Right) {
            this.menu.open(true);
            this.menu.actor.navigate_focus(null, Gtk.DirectionType.DOWN, false);
            return true;
        } else if (symbol == Clutter.KEY_Left && this.menu.isOpen) {
            this.menu.close();
            return true;
        }

        return PopupBaseMenuItem.prototype._onKeyPressEvent.call(this, actor, event);
    },

    activate: function(event) {
        this.menu.open(true);
    },

    _onButtonReleaseEvent: function(actor) {
        this.menu.toggle();
    }
};

function PopupComboMenu() {
    this._init.apply(this, arguments);
}

PopupComboMenu.prototype = {
    __proto__: PopupMenuBase.prototype,

    _init: function(sourceActor) {
        PopupMenuBase.prototype._init.call(this,
                                           sourceActor, 'popup-combo-menu');
        this.actor = this.box;
        this.actor._delegate = this;
        this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
        this.actor.connect('key-focus-in', Lang.bind(this, this._onKeyFocusIn));
        this._activeItemPos = -1;
        global.focus_manager.add_group(this.actor);
    },

    _onKeyPressEvent: function(actor, event) {
        if (event.get_key_symbol() == Clutter.Escape) {
            this.close(true);
            return true;
        }

        return false;
    },

    _onKeyFocusIn: function(actor) {
        let items = this._getMenuItems();
        let activeItem = items[this._activeItemPos];
        activeItem.actor.grab_key_focus();
    },

    open: function() {
        if (this.isOpen)
            return;

        this.isOpen = true;

        let activeItem = this._getMenuItems()[this._activeItemPos];

        let [sourceX, sourceY] = this.sourceActor.get_transformed_position();
        this.actor.set_position(Math.round(sourceX), Math.round(sourceY - activeItem.actor.y));

        this.actor.raise_top();

        this.actor.opacity = 0;
        this.actor.show();

        Tweener.addTween(this.actor,
                         { opacity: 255,
                           transition: 'linear',
                           time: BoxPointer.POPUP_ANIMATION_TIME });

        this.savedFocusActor = global.stage.get_key_focus();
        global.stage.set_key_focus(this.actor);
        this.emit('open-state-changed', true);
    },

    close: function() {
        if (!this.isOpen)
            return;

        this.isOpen = false;
        Tweener.addTween(this.actor,
                         { opacity: 0,
                           transition: 'linear',
                           time: BoxPointer.POPUP_ANIMATION_TIME,
                           onComplete: Lang.bind(this,
                               function() {
                                   this.actor.hide();
                               })
                         });

        this.emit('open-state-changed', false);
        global.stage.set_key_focus(this.savedFocusActor);
    },

    setActiveItem: function(position) {
        this._activeItemPos = position;
    },

    setItemVisible: function(position, visible) {
        if (!visible && position == this._activeItemPos) {
            log('Trying to hide the active menu item.');
            return;
        }

        this._getMenuItems()[position].actor.visible = visible;
    },

    getItemVisible: function(position) {
        return this._getMenuItems()[position].actor.visible;
    }
};

function PopupComboBoxMenuItem() {
    this._init.apply(this, arguments);
}

PopupComboBoxMenuItem.prototype = {
    __proto__: PopupBaseMenuItem.prototype,

    _init: function (params) {
        PopupBaseMenuItem.prototype._init.call(this, params);

        this._itemBox = new Cinnamon.Stack();

        this.actor.accessible_role = Atk.Role.COMBO_BOX;

        this.addActor(this._itemBox);

        let expander = new St.Label({ text: '\u2304' });
        this.addActor(expander, { align: St.Align.END,
                                  span: -1 });

        this._menu = new PopupComboMenu(this.actor);
        Main.uiGroup.add_actor(this._menu.actor);
        this._menu.actor.hide();

        if (params.style_class)
            this._menu.actor.add_style_class_name(params.style_class);

        this.actor.connect('scroll-event', Lang.bind(this, this._onScrollEvent));

        this._activeItemPos = -1;
        this._items = [];
    },

    _getTopMenu: function() {
        let actor = this.actor.get_parent();
        while (actor) {
            if (actor._delegate &&
                (actor._delegate instanceof PopupMenu ||
                 actor._delegate instanceof PopupComboMenu))
                return actor._delegate;

            actor = actor.get_parent();
        }

        return null;
    },

    _onScrollEvent: function(actor, event) {
        if (this._activeItemPos == -1)
            return;

        let position = this._activeItemPos;
        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.DOWN) {
            while (position < this._items.length - 1) {
                position++;
                if (this._menu.getItemVisible(position))
                    break;
            }
        } else if (direction == Clutter.ScrollDirection.UP) {
            while (position > 0) {
                position--;
                if (this._menu.getItemVisible(position))
                    break;
            }
        }

        if (position == this._activeItemPos)
            return;

        this.setActiveItem(position);
        this.emit('active-item-changed', position);
    },

    activate: function(event) {
        let topMenu = this._getTopMenu();
        if (!topMenu)
            return;

        topMenu.addChildMenu(this._menu);
        this._menu.toggle();
    },

    addMenuItem: function(menuItem, position) {
        if (position === undefined)
            position = this._menu.numMenuItems;

        this._menu.addMenuItem(menuItem, position);
        _ensureStyle(this._menu.actor);

        let item = new St.BoxLayout({ style_class: 'popup-combobox-item' });

        let children = menuItem.actor.get_children();
        for (let i = 0; i < children.length; i++) {
            let clone = new Clutter.Clone({ source: children[i] });
            item.add(clone, { y_fill: false });
        }

        let oldItem = this._items[position];
        if (oldItem)
            this._itemBox.remove_actor(oldItem);

        this._items[position] = item;
        this._itemBox.add_actor(item);

        menuItem.connect('activate',
                         Lang.bind(this, this._itemActivated, position));
    },

    checkAccessibleLabel: function() {
        let activeItem = this._menu.getActiveItem();
        this.actor.label_actor = activeItem.label;
    },

    setActiveItem: function(position) {
        let item = this._items[position];
        if (!item)
            return;
        if (this._activeItemPos == position)
            return;
        this._menu.setActiveItem(position);
        this._activeItemPos = position;
        for (let i = 0; i < this._items.length; i++)
            this._items[i].visible = (i == this._activeItemPos);

        this.checkAccessibleLabel();
    },

    setItemVisible: function(position, visible) {
        this._menu.setItemVisible(position, visible);
    },

    _itemActivated: function(menuItem, event, position) {
        this.setActiveItem(position);
        this.emit('active-item-changed', position);
    }
};

/**
 * #PopupMenuFactory:
 * @short_description: A class to build a cinnamon menu using some abstract menu items.
 *
 * This class can build a cinnamon menu, using the instances of a heir of the
 * PopupMenuAbstractItem class. Please see the description of the PopupMenuAbstractItem
 * class to more details. To initialize the construction you need to provide the root
 * instance of your abstract menu items.
 */
function PopupMenuFactory() {
    this._init.apply(this, arguments);
}

PopupMenuFactory.prototype = {

    _init: function() {
        this._menuLikend = new Array();
    },

    _createShellItem: function(factoryItem, launcher, orientation) {
        // Decide whether it's a submenu or not
        let shellItem = null;
        let item_type = factoryItem.getFactoryType();
        if (item_type == FactoryClassTypes.RootMenuClass)
            shellItem = new PopupMenu(launcher.actor, orientation);
        if (item_type == FactoryClassTypes.SubMenuMenuItemClass)
            shellItem = new PopupSubMenuMenuItem("FIXME");
        else if (item_type == FactoryClassTypes.MenuSectionMenuItemClass)
            shellItem = new PopupMenuSection();
        else if (item_type == FactoryClassTypes.SeparatorMenuItemClass)
            shellItem = new PopupSeparatorMenuItem('');
        else if (item_type == FactoryClassTypes.MenuItemClass)
            shellItem = new PopupIndicatorMenuItem("FIXME");
        return shellItem;
    },

    getShellMenu: function(factoryMenu) {
        let index = this._menuLikend.indexOf(factoryMenu);
        if (index != -1) {
            return factoryMenu.getShellItem();
        }
        return null;
    },

    buildShellMenu: function(client, launcher, orientation) {
        let factoryMenu = client.getRoot();
        if (!(factoryMenu instanceof PopupMenuAbstractItem)) {
            throw new Error("MenuFactory: can't construct an instance of \
                PopupMenu using a non instance of the class PopupMenuAbstractItem");
        }

        if (factoryMenu.shellItem)
            return factoryMenu.shellItem;

        // The shell menu
        let shellItem = this._createShellItem(factoryMenu, launcher, orientation);
        this._attachToMenu(shellItem, factoryMenu);
        return shellItem;
    },

    // This will attach the root factoryItem to an already existing menu that will be used as the root menu.
    // it will also connect the factoryItem to be automatically destroyed when the menu dies.
    _attachToMenu: function(shellItem, factoryItem) {
        // Cleanup: remove existing childs (just in case)
        shellItem.removeAll();

        // Fill the menu for the first time
        factoryItem.getChildren().forEach(function(child) {
            shellItem.addMenuItem(this._createItem(child));
        }, this);

        factoryItem.setShellItem(shellItem, {
            'child-added'   : Lang.bind(this, this._onChildAdded),
            'child-moved'   : Lang.bind(this, this._onChildMoved)
        });
        this._menuLikend.push(factoryItem);
        factoryItem.connectAndRemoveOnDestroy({
            'destroy'           : Lang.bind(this, this._onDestroyMainMenu)
        });
    },

    _onDestroyMainMenu: function(factoryItem) {
        let index = this._menuLikend.indexOf(factoryItem);
        if (index != -1) {
            this._menuLikend.splice(index, 1);
        }
    },

    _createItem: function(factoryItem) {
        // Don't allow to override previusly preasigned items, destroy the shell item first.
        factoryItem.destroyShellItem();
        let shellItem = this._createShellItem(factoryItem);

        // Initially create children on idle, to not stop cinnamon mainloop.
        Mainloop.idle_add(Lang.bind(this, this._createChildrens, factoryItem));

        // Now, connect various events
        factoryItem.setShellItem(shellItem, {
            'type-changed':       Lang.bind(this, this._onTypeChanged),
            'child-added':        Lang.bind(this, this._onChildAdded),
            'child-moved':        Lang.bind(this, this._onChildMoved)
        });
        return shellItem;
    },

    _createChildrens: function(factoryItem) {
        if (factoryItem) {
            let shellItem = factoryItem.getShellItem();
            if (shellItem instanceof PopupSubMenuMenuItem) {
                let children = factoryItem.getChildren();
                for (let i = 0; i < children.length; ++i) {
                    let ch_item = this._createItem(children[i]);
                    shellItem.menu.addMenuItem(ch_item);
                }
            } else if (shellItem instanceof PopupMenuSection) {
                let children = factoryItem.getChildren();
                for (let i = 0; i < children.length; ++i) {
                    let ch_item = this._createItem(children[i]);
                    shellItem.addMenuItem(ch_item);
                }
            }
        }
    },

    _onChildAdded: function(factoryItem, child, position) {
        let shellItem = factoryItem.getShellItem();
        if (shellItem) {
            if (shellItem instanceof PopupSubMenuMenuItem) {
                shellItem.menu.addMenuItem(this._createItem(child), position, "factor");
            } else if ((shellItem instanceof PopupMenuSection) ||
                       (shellItem instanceof PopupMenu)) {
                shellItem.addMenuItem(this._createItem(child), position);
            } else {
                global.logWarning("Tried to add a child to non-submenu item. Better recreate it as whole");
                this._onTypeChanged(factoryItem);
            }
        } else {
            global.logWarning("Tried to add a child shell item to non existing shell item.");
        }
    },

    _onChildMoved: function(factoryItem, child, oldpos, newpos) {
        let shellItem = factoryItem.getShellItem();
        if (shellItem) {
            if (shellItem instanceof PopupSubMenuMenuItem) {
                this._moveItemInMenu(shellItem.menu, child, newpos);
            } else if ((shellItem instanceof PopupMenuSection) ||
                       (shellItem instanceof PopupMenu)) {
                this._moveItemInMenu(shellItem, child, newpos);
            } else {
                global.logWarning("Tried to move a child in non-submenu item. Better recreate it as whole");
                this._onTypeChanged(factoryItem);
            }
        } else {
            global.logWarning("Tried to move a child shell item in non existing shell item.");
        }
    },

    // FIXME: If this function it is applied, this mean that our old shell Item
    // is not valid right now, so we can destroy it with all the obsolete submenu
    // structure and then create again for the new factoryItems source. Anyway
    // there are a lot of possible scenarios when this was called, sure we are
    // missing some of them.
    _onTypeChanged: function(factoryItem) {
        let shellItem = factoryItem.getShellItem();
        let factoryItemParent = factoryItem.getParent();
        let parentMenu = null;
        if (factoryItemParent) {
            let shellItemParent = factoryItemParent.getShellItem();
            if (shellItemParent instanceof PopupMenuSection)
                parentMenu = shellItemParent;
            else
                parentMenu = shellItemParent.menu;
        }
        // First, we need to find our old position
        let pos = -1;
        if ((parentMenu)&&(shellItem)) {
            let family = parentMenu._getMenuItems();
            for (let i = 0; i < family.length; ++i) {
                if (family[i] == shellItem)
                    pos = i;
            }
        }
        // if not insert the item in first position.
        if (pos < 0)
            pos = 0;
        // Now destroy our old self
        factoryItem.destroyShellItem();
        if (parentMenu) {
            // Add our new self
            let newShellItem = this._createItem(factoryItem);
            parentMenu.addMenuItem(newShellItem, pos);
        }
    },

    // FIXME: This is a HACK. We're really getting into the internals of the PopupMenu implementation.
    // First, find our wrapper. Children tend to lie. We do not trust the old positioning.
    // Will be better add this function inside the PopupMenuBase class?
    _moveItemInMenu: function(menu, factoryItem, newpos) {
        let shellItem = factoryItem.getShellItem();
        if (shellItem) {
            let family = menu._getMenuItems();
            for (let i = 0; i < family.length; ++i) {
                if (family[i] == shellItem) {
                    // Now, remove it
                    menu.box.remove_child(shellItem.actor);

                    // Add it again somewhere else
                    if (newpos < family.length && family[newpos] != shellItem)
                        menu.box.insert_child_below(shellItem.actor, family[newpos].actor);
                    else
                        menu.box.add(shellItem.actor);

                    // Skip the rest
                    break;
                }
            }
        }
    }
};

/* Basic implementation of a menu manager.
 * Call addMenu to add menus
 */
function PopupMenuManager(owner) {
    this._init(owner);
}

PopupMenuManager.prototype = {
    _init: function(owner) {
        this._owner = owner;
        this.grabbed = false;

        this._eventCaptureId = 0;
        this._enterEventId = 0;
        this._leaveEventId = 0;
        this._keyFocusNotifyId = 0;
        this._activeMenu = null;
        this._menus = [];
        this._menuStack = [];
        this._preGrabInputMode = null;
        this._grabbedFromKeynav = false;
        this._signals = new SignalManager.SignalManager(this);
    },

    addMenu: function(menu, position) {
        this._signals.connect(menu, 'open-state-changed', this._onMenuOpenState);
        this._signals.connect(menu, 'child-menu-added', this._onChildMenuAdded);
        this._signals.connect(menu, 'child-menu-removed', this._onChildMenuRemoved);
        this._signals.connect(menu, 'destroy', this._onMenuDestroy);

        let source = menu.sourceActor;

        if (source) {
            this._signals.connect(source, 'enter-event', function() { this._onMenuSourceEnter(menu); });
            this._signals.connect(source, 'key-focus-in', function() { this._onMenuSourceEnter(menu); });
        }

        if (position == undefined)
            this._menus.push(menu);
        else
            this._menus.splice(position, 0, menu);
    },

    removeMenu: function(menu) {
        if (menu == this._activeMenu)
            this._closeMenu();

        let position = this._menus.indexOf(menu);

        if (position == -1) // not a menu we manage
            return;

        this._signals.disconnect(null, menu);

        if (menu.sourceActor)
            this._signals.disconnect(null, menu.sourceActor);

        this._menus.splice(position, 1);
    },

    _grab: function() {
        if (!Main.pushModal(this._owner.actor)) {
            return;
        }
        this._signals.connect(global.stage, 'captured-event', this._onEventCapture);
        // captured-event doesn't see enter/leave events
        this._signals.connect(global.stage, 'enter-event', this._onEventCapture);
        this._signals.connect(global.stage, 'leave-event', this._onEventCapture);
        this._signals.connect(global.stage, 'notify::key-focus', this._onKeyFocusChanged);

        this.grabbed = true;
    },

    _ungrab: function() {
        if (!this.grabbed) {
            return;
        }

        this._signals.disconnect(null, global.stage);

        this.grabbed = false;
        Main.popModal(this._owner.actor);
    },

    _onMenuOpenState: function(menu, open) {
        if (open) {
            if (this._activeMenu && this._activeMenu.isChildMenu(menu)) {
                this._menuStack.push(this._activeMenu);
                menu.actor.grab_key_focus();
            }
            this._activeMenu = menu;
        } else {
            if (this._menuStack.length > 0) {
                this._activeMenu = this._menuStack.pop();
                if (menu.sourceActor)
                    menu.sourceActor.grab_key_focus();
                this._didPop = true;
            }
        }

        // Check what the focus was before calling pushModal/popModal
        let focus = global.stage.key_focus;
        let hadFocus = focus && this._activeMenuContains(focus);

        if (open) {
            if (!this.grabbed) {
                this._preGrabInputMode = global.stage_input_mode;
                this._grabbedFromKeynav = hadFocus;
                this._grab();
            }

            if (hadFocus)
                focus.grab_key_focus();
            else
                menu.actor.grab_key_focus();
        } else if (menu == this._activeMenu) {
            if (this.grabbed)
                this._ungrab();
            this._activeMenu = null;

            if (this._grabbedFromKeynav) {
                if (this._preGrabInputMode == Cinnamon.StageInputMode.FOCUSED)
                    global.stage_input_mode = Cinnamon.StageInputMode.FOCUSED;
                if (hadFocus && menu.sourceActor)
                    menu.sourceActor.grab_key_focus();
                else if (focus)
                    focus.grab_key_focus();
            }
        }
    },

    _onChildMenuAdded: function(menu, childMenu) {
        this.addMenu(childMenu);
    },

    _onChildMenuRemoved: function(menu, childMenu) {
        this.removeMenu(childMenu);
    },

    // change the currently-open menu without dropping grab
    _changeMenu: function(newMenu) {
        if (this._activeMenu) {
            // _onOpenMenuState will drop the grab if it sees
            // this._activeMenu being closed; so clear _activeMenu
            // before closing it to keep that from happening
            let oldMenu = this._activeMenu;
            this._activeMenu = null;
            for (let i = this._menuStack.length - 1; i >= 0; i--)
                this._menuStack[i].close(false);
            oldMenu.close(false);
            newMenu.open(false);
        } else
            newMenu.open(true);
    },

    _onMenuSourceEnter: function(menu) {
        if (!this.grabbed || menu == this._activeMenu)
            return false;

        if (this._activeMenu && this._activeMenu.isChildMenu(menu))
            return false;

        if (this._menuStack.indexOf(menu) != -1)
            return false;

        if (this._menuStack.length > 0 && this._menuStack[0].isChildMenu(menu))
            return false;

        this._changeMenu(menu);
        return false;
    },

    _onKeyFocusChanged: function() {
        if (!this.grabbed || !this._activeMenu || DND.isDragging())
            return;

        let focus = global.stage.key_focus;
        if (focus) {
            if (this._activeMenuContains(focus))
                return;
            if (this._menuStack.length > 0)
                return;
            if (focus._delegate && focus._delegate.menu &&
                this._menus.indexOf(focus._delegate.menu) != -1)
                return;
        }

        this._closeMenu();
    },

    _onMenuDestroy: function(menu) {
        this.removeMenu(menu);
    },

    _activeMenuContains: function(actor) {
        return this._activeMenu != null
                && (this._activeMenu.actor.contains(actor) ||
                    (this._activeMenu.sourceActor && this._activeMenu.sourceActor.contains(actor)));
    },

    _eventIsOnActiveMenu: function(event) {
        return this._activeMenuContains(event.get_source());
    },

    _shouldBlockEvent: function(event) {
        let src = event.get_source();

        if (this._activeMenu != null && this._activeMenu.actor.contains(src))
            return false;

        return (this._menus.find(x => x.sourceActor &&
                                      !x.blockSourceEvents &&
                                      x.sourceActor.contains(src)) === undefined);
    },

    _onEventCapture: function(actor, event) {
        if (!this.grabbed)
            return false;

        if (Main.keyboard.shouldTakeEvent(event))
            return Clutter.EVENT_PROPAGATE;

        if (this._owner.menuEventFilter &&
            this._owner.menuEventFilter(event))
            return true;

        if (this._activeMenu != null && this._activeMenu.passEvents)
            return false;

        if (this._didPop) {
            this._didPop = false;
            return true;
        }

        let activeMenuContains = this._eventIsOnActiveMenu(event);
        let eventType = event.type();

        if (eventType == Clutter.EventType.BUTTON_RELEASE) {
            if (activeMenuContains) {
                return false;
            } else {
                this._closeMenu();
                return true;
            }
        } else if (eventType == Clutter.EventType.BUTTON_PRESS && !activeMenuContains) {
            this._closeMenu();
            return true;
        } else if (!this._shouldBlockEvent(event)) {
            return false;
        }

        return true;
    },

    _closeMenu: function() {
        if (this._activeMenu != null)
            this._activeMenu.close(true);
    }
};
