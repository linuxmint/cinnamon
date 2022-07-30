// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Cairo = imports.cairo;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;
const Graphene = imports.gi.Graphene;
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

var SLIDER_SCROLL_STEP = 0.05; /* Slider scrolling step in % */
var MENU_ANIMATION_OFFSET = 0.1;

var PanelLoc = {
    top : 0,
    bottom : 1,
    left : 2,
    right : 3
};

var OrnamentType = {
    NONE: 0,
    CHECK: 1,
    DOT: 2,
    ICON: 3
};

var FactoryClassTypes = {
    'RootMenuClass'            : "RootMenuClass",
    'MenuItemClass'            : "MenuItemClass",
    'SubMenuMenuItemClass'     : "SubMenuMenuItemClass",
    'MenuSectionMenuItemClass' : "MenuSectionMenuItemClass",
    'SeparatorMenuItemClass'   : "SeparatorMenuItemClass"
};

var FactoryEventTypes = {
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

var PopupBaseMenuItem = class PopupBaseMenuItem {
    constructor() {
        return this._init.apply(this, arguments);
    }

    _init(params) {
        params = Params.parse (params, { reactive: true,
                                         activate: true,
                                         hover: true,
                                         sensitive: true,
                                         style_class: null,
                                         focusOnHover: true
                                       });
        this._signals = new SignalManager.SignalManager(null);
        this.actor = new Cinnamon.GenericContainer({ style_class: 'popup-menu-item',
                                                  reactive: params.reactive,
                                                  track_hover: params.reactive,
                                                  can_focus: params.reactive,
                                                  accessible_role: Atk.Role.MENU_ITEM });
        this._signals.connect(this.actor, 'get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this._signals.connect(this.actor, 'get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this._signals.connect(this.actor, 'allocate', Lang.bind(this, this._allocate));
        this._signals.connect(this.actor, 'style-changed', Lang.bind(this, this._onStyleChanged));
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
            this._signals.connect(this.actor, 'button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
            this._signals.connect(this.actor, 'key-press-event', Lang.bind(this, this._onKeyPressEvent));
        }
        if (params.reactive && params.hover)
            this._signals.connect(this.actor, 'notify::hover', Lang.bind(this, this._onHoverChanged));
        if (params.reactive) {
            this._signals.connect(this.actor, 'key-focus-in', Lang.bind(this, this._onKeyFocusIn));
            this._signals.connect(this.actor, 'key-focus-out', Lang.bind(this, this._onKeyFocusOut));
        }
    }

    _onStyleChanged(actor) {
        this._spacing = Math.round(actor.get_theme_node().get_length('spacing'));
    }

    _onButtonReleaseEvent(actor, event) {
        this.activate(event, false);
        return true;
    }

    _onKeyPressEvent(actor, event) {
        let symbol = event.get_key_symbol();

        if (symbol === Clutter.KEY_space ||
            symbol === Clutter.KEY_Return ||
            symbol === Clutter.KEY_KP_Enter) {
            this.activate(event);
            return true;
        }
        return false;
    }

    _onKeyFocusIn(actor) {
        this.setActive(true);
    }

    _onKeyFocusOut(actor) {
        this.setActive(false);
    }

    _onHoverChanged(actor) {
        this.setActive(actor.hover);
    }

    activate(event, keepMenu) {
        this.emit('activate', event, keepMenu);
    }

    setActive(active) {
        let activeChanged = active != this.active;

        if (activeChanged) {
            this.active = active;
            this.actor.change_style_pseudo_class('active', active);
            if (this.focusOnHover && this.active) this.actor.grab_key_focus();

            this.emit('active-changed', active);
        }
    }

    setSensitive(sensitive) {
        if (!this._activatable)
            return;
        if (this.sensitive == sensitive)
            return;

        this.sensitive = sensitive;
        this.actor.reactive = sensitive;
        this.actor.can_focus = sensitive;

        this.actor.change_style_pseudo_class('insensitive', !sensitive);
        this.emit('sensitive-changed', sensitive);
    }

    destroy() {
        this._signals.disconnectAllSignals();
        this.actor.destroy();
        this.emit('destroy');
    }

    // adds an actor to the menu item; @params can contain %span
    // (column span; defaults to 1, -1 means "all the remaining width", 0 means "no new column after this actor"),
    // %expand (defaults to #false), and %align (defaults to
    // #St.Align.START)
    addActor(child, params) {
        params = Params.parse(params, { span: 1,
                                        expand: false,
                                        align: St.Align.START,
                                        position: -1 });
        params.actor = child;
        this._children.splice(params.position >= 0 ? params.position : Number.MAX_SAFE_INTEGER, 0, params);
        this._signals.connect(this.actor, 'destroy', this._removeChild.bind(this, child));
        this.actor.insert_child_at_index(child, params.position);
    }

    _removeChild(child) {
        for (let i = 0; i < this._children.length; i++) {
            if (this._children[i].actor == child) {
                this._children.splice(i, 1);
                return;
            }
        }
    }

    removeActor(child) {
        this.actor.remove_actor(child);
        this._removeChild(child);
    }

    setShowDot(show) {
        if (show) {
            if (this._dot)
                return;

            this._dot = new St.DrawingArea({ style_class: 'popup-menu-item-dot' });
            this._signals.connect(this._dot, 'repaint', Lang.bind(this, this._onRepaintDot));
            this.actor.add_actor(this._dot);
            this.actor.add_accessible_state (Atk.StateType.CHECKED);
        } else {
            if (!this._dot)
                return;

            this._dot.destroy();
            this._dot = null;
            this.actor.remove_accessible_state (Atk.StateType.CHECKED);
        }
    }

    _onRepaintDot(area) {
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
    }

    // This returns column widths in logical order (i.e. from the dot
    // to the image), not in visual order (left to right)
    getColumnWidths() {
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
    }

    setColumnWidths(widths) {
        this._columnWidths = widths;
    }

    _getPreferredWidth(actor, forHeight, alloc) {
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
    }

    _getPreferredHeight(actor, forWidth, alloc) {
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
    }

    _allocate(actor, box, flags) {
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
}
Signals.addSignalMethods(PopupBaseMenuItem.prototype);

var PopupMenuItem = class PopupMenuItem extends PopupBaseMenuItem {
    _init (text, params) {
        super._init.call(this, params);

        this.label = new St.Label({ text: text });
        this.addActor(this.label);
        this.actor.label_actor = this.label;

        this._ornament = new St.Bin();
        this._icon = new St.Icon({ style_class: 'popup-menu-icon', icon_type: St.IconType.FULLCOLOR });

        this._ornament.child = this._icon;
        this._ornament.child._delegate = this._ornament;
        this.addActor(this._ornament, {span: 0});
    }

    setLabel(label) {
        this.label.set_text(label);
    }

    setOrnament(ornamentType, state) {
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
    }
}

var PopupSeparatorMenuItem = class PopupSeparatorMenuItem extends PopupBaseMenuItem {
    _init () {
        super._init.call(this, { reactive: false });

        this._drawingArea = new St.DrawingArea({ style_class: 'popup-separator-menu-item' });
        this.addActor(this._drawingArea, { span: -1, expand: true });
        this._signals.connect(this._drawingArea, 'repaint', Lang.bind(this, this._onRepaint));
    }

    _onRepaint(area) {
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
}

const PopupAlternatingMenuItemState = {
    DEFAULT: 0,
    ALTERNATIVE: 1
}

var PopupAlternatingMenuItem = class PopupAlternatingMenuItem extends PopupBaseMenuItem {
    _init(text, alternateText, params) {
        super._init.call(this, params);
        this.actor.add_style_class_name('popup-alternating-menu-item');

        this._text = text;
        this._alternateText = alternateText;
        this.label = new St.Label({ text: text });
        this.state = PopupAlternatingMenuItemState.DEFAULT;
        this.addActor(this.label);

        this._signals.connect(this.actor, 'notify::mapped', Lang.bind(this, this._onMapped));
    }

    _onMapped() {
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
    }

    _setState(state) {
        if (this.state != state) {
            if (state == PopupAlternatingMenuItemState.ALTERNATIVE && !this._canAlternate())
                return;

            this.state = state;
            this._updateLabel();
        }
    }

    _updateStateFromModifiers() {
        let [x, y, mods] = global.get_pointer();
        let state;

        if ((mods & Clutter.ModifierType.MOD1_MASK) == 0) {
            state = PopupAlternatingMenuItemState.DEFAULT;
        } else {
            state = PopupAlternatingMenuItemState.ALTERNATIVE;
        }

        this._setState(state);
    }

    _onCapturedEvent(actor, event) {
        if (event.type() != Clutter.EventType.KEY_PRESS &&
            event.type() != Clutter.EventType.KEY_RELEASE)
            return false;

        let key = event.get_key_symbol();

        if (key === Clutter.KEY_Alt_L || key === Clutter.KEY_Alt_R)
            this._updateStateFromModifiers();

        return false;
    }

    _updateLabel() {
        if (this.state == PopupAlternatingMenuItemState.ALTERNATIVE) {
            this.actor.add_style_pseudo_class('alternate');
            this.label.set_text(this._alternateText);
        } else {
            this.actor.remove_style_pseudo_class('alternate');
            this.label.set_text(this._text);
        }
    }

    _canAlternate() {
        if (this.state == PopupAlternatingMenuItemState.DEFAULT && !this._alternateText)
            return false;
        return true;
    }

    updateText(text, alternateText) {
        this._text = text;
        this._alternateText = alternateText;

        if (!this._canAlternate())
            this._setState(PopupAlternatingMenuItemState.DEFAULT);

        this._updateLabel();
    }
}

var PopupSliderMenuItem = class PopupSliderMenuItem extends PopupBaseMenuItem {
    _init(value) {
        super._init.call(this, { activate: false });

        this._signals.connect(this.actor, 'key-press-event', Lang.bind(this, this._onKeyPressEvent));

        if (isNaN(value))
            // Avoid spreading NaNs around
            throw TypeError('The slider value must be a number');
        this._value = Math.max(Math.min(value, 1), 0);

        this._slider = new St.DrawingArea({ style_class: 'popup-slider-menu-item', reactive: true });
        this.addActor(this._slider, { span: -1, expand: true });
        this._signals.connect(this._slider, 'repaint', Lang.bind(this, this._sliderRepaint));
        this._signals.connect(this.actor, 'button-press-event', Lang.bind(this, this._startDragging));
        this._signals.connect(this.actor, 'scroll-event', Lang.bind(this, this._onScrollEvent));

        this._releaseId = this._motionId = 0;
        this._dragging = false;
        this._mark_position = 0; // 0 means no mark
    }

    setValue(value) {
        if (isNaN(value))
            throw TypeError('The slider value must be a number');

        this._value = Math.max(Math.min(value, 1), 0);
        this._slider.queue_repaint();
    }

    _sliderRepaint(area) {
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

        const color = themeNode.get_foreground_color();
        Clutter.cairo_set_source_color(cr, color);
        cr.arc(handleX, handleY, handleRadius, 0, TAU);
        cr.fill();

        // Draw a mark to indicate a certain value
        if (this._mark_position > 0) {
            const markWidth = 2;
            const markHeight = sliderHeight + 4;
            const xMark = rtl ?
                width - sliderWidth * this._mark_position - markWidth / 2 :
                sliderWidth * this._mark_position + markWidth / 2;
            const yMark = height / 2 - markHeight / 2;
            cr.rectangle(xMark, yMark, markWidth, markHeight);
            cr.fill();
        }

        cr.$dispose();
    }

    _startDragging(actor, event) {
        if (this._dragging) // don't allow two drags at the same time
            return;

        this.emit('drag-begin');
        this._dragging = true;

        // FIXME: we should only grab the specific device that originated
        // the event, but for some weird reason events are still delivered
        // outside the slider if using clutter_grab_pointer_for_device
        event.get_device().grab(this._slider);
        this._signals.connect(this._slider, 'button-release-event', Lang.bind(this, this._endDragging));
        this._signals.connect(this._slider, 'motion-event', Lang.bind(this, this._motionEvent));
        let absX, absY;
        [absX, absY] = event.get_coords();
        this._moveHandle(absX, absY);
    }

    _endDragging(actor, event) {
        if (this._dragging) {
            this._signals.disconnect('button-release-event', this._slider);
            this._signals.disconnect('motion-event', this._slider);

            event.get_device().ungrab();
            this._dragging = false;

            this.emit('drag-end');
        }
        return true;
    }

    _onScrollEvent (actor, event) {
        let direction = event.get_scroll_direction();
        if (direction == Clutter.ScrollDirection.SMOOTH) {
            return;
        }

        if (direction == Clutter.ScrollDirection.DOWN) {
            this._value = Math.max(0, this._value - SLIDER_SCROLL_STEP);
        }
        else if (direction == Clutter.ScrollDirection.UP) {
            this._value = Math.min(1, this._value + SLIDER_SCROLL_STEP);
        }

        this._slider.queue_repaint();
        this.emit('value-changed', this._value);
    }

    _motionEvent(actor, event) {
        let absX, absY;
        [absX, absY] = event.get_coords();
        this._moveHandle(absX, absY);
        return true;
    }

    _moveHandle(absX, absY) {
        const [sliderX, sliderY] = this._slider.get_transformed_position();
        const relX = absX - sliderX;
        const relY = absY - sliderY;

        const width = this._slider.width;
        const handleRadius = this._slider.get_theme_node().get_length('-slider-handle-radius');

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
        this._slider.queue_repaint();
        this.emit('value-changed', this._value);
    }

    get value() {
        return this._value;
    }

    set_mark (value) {
        this._mark_position = value;
    }

    _onKeyPressEvent (actor, event) {
        const key = event.get_key_symbol();
        if (key === Clutter.KEY_Right || key === Clutter.KEY_Left) {
            let delta = key === Clutter.KEY_Right ? 0.1 : -0.1;
            if (this.actor.get_direction() === St.TextDirection.RTL)
                delta = -delta;

            this._value = Math.max(0, Math.min(this._value + delta, 1));
            this._slider.queue_repaint();
            this.emit('value-changed', this._value);
            this.emit('drag-end');
            return true;
        }
        return false;
    }
}

var Switch = class Switch {
    constructor() {
        return this._init.apply(this, arguments);
    }

    _init(state) {
        this.actor = new St.Bin({ style_class: 'toggle-switch' ,
                                  accessible_role: Atk.Role.CHECK_BOX});
        // Translators: this MUST be either "toggle-switch-us"
        // (for toggle switches containing the English words
        // "ON" and "OFF") or "toggle-switch-intl" (for toggle
        // switches containing "O" and "|"). Other values will
        // simply result in invisible toggle switches.
        this.actor.add_style_class_name("toggle-switch-us");
        this.setToggleState(state);
    }

    setToggleState(state) {
        if (this.actor.is_finalized()) return;
        this.actor.change_style_pseudo_class('checked', state);
        this.state = state;
    }

    toggle() {
        this.setToggleState(!this.state);
    }
}

var PopupSwitchMenuItem = class PopupSwitchMenuItem extends PopupBaseMenuItem {
    _init(text, active, params) {
        super._init.call(this, params);

        this.label = new St.Label({ text: text });
        this._statusLabel = new St.Label({ text: '', style_class: 'popup-inactive-menu-item' });

        this.actor.label_actor = this.label;

        this._switch = new Switch(active);

        this.addActor(this.label);
        this.addActor(this._statusLabel);

        this._statusBin = new St.Bin({ x_align: St.Align.END });
        this.addActor(this._statusBin, { expand: true, span: -1, align: St.Align.END });
        this._statusBin.child = this._switch.actor;
    }

    setStatus(text) {
        if (text != null) {
            this._statusLabel.set_text(text);
        } else {
            this._statusLabel.set_text('');
        }
    }

    activate(event) {
        if (this._switch.actor.mapped) {
            this.toggle();
        }

        PopupBaseMenuItem.prototype.activate.call(this, event, true);
    }

    toggle() {
        this._switch.toggle();
        this.emit('toggled', this._switch.state);
    }

    get state() {
        return this._switch.state;
    }

    setToggleState(state) {
        this._switch.setToggleState(state);
    }
}

var PopupSwitchIconMenuItem = class PopupSwitchIconMenuItem extends PopupBaseMenuItem {

    /**
     * _init:
     * @text (string): text to display in the label
     * @active: boolean to set switch on or off
     * @iconName (string): name of the icon used
     * @iconType (St.IconType): the type of icon (usually #St.IconType.SYMBOLIC
     * or #St.IconType.FULLCOLOR)
     * @params (JSON): parameters to pass to %PopupMenu.PopupBaseMenuItem._init
     */
    _init(text, active, iconName, iconType, params) {
        super._init.call(this, params);

        this.label = new St.Label({ text: text });
        this._statusLabel = new St.Label({ text: '', style_class: 'popup-inactive-menu-item' });

        this.actor.label_actor = this.label;

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
    }

    /**
     * setIconSymbolicName:
     * @iconName (string): name of the icon
     *
     * Changes the icon to a symbolic icon with name @iconName.
     */
    setIconSymbolicName (iconName) {
        this._icon.set_icon_name(iconName);
        this._icon.set_icon_type(St.IconType.SYMBOLIC);
    }

    /**
     * setIconName:
     * @iconName (string): name of the icon
     *
     * Changes the icon to a full color icon with name @iconName.
     */
    setIconName (iconName) {
        this._icon.set_icon_name(iconName);
        this._icon.set_icon_type(St.IconType.FULLCOLOR);
    }

    setStatus(text) {
        if (text != null) {
            this._statusLabel.set_text(text);
        } else {
            this._statusLabel.set_text('');
        }
    }

    activate(event) {
        if (this._switch.actor.mapped) {
            this.toggle();
        }

        PopupBaseMenuItem.prototype.activate.call(this, event, true);
    }

    toggle() {
        this._switch.toggle();
        this.emit('toggled', this._switch.state);
    }

    get state() {
        return this._switch.state;
    }

    setToggleState(state) {
        this._switch.setToggleState(state);
    }
}

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

var PopupIconMenuItem = class PopupIconMenuItem extends PopupBaseMenuItem {

    /**
     * _init:
     * @text (string): text to display in the label
     * @iconName (string): name of the icon used
     * @iconType (St.IconType): the type of icon (usually #St.IconType.SYMBOLIC
     * or #St.IconType.FULLCOLOR)
     * @params (JSON): parameters to pass to %PopupMenu.PopupBaseMenuItem._init
     */
    _init (text, iconName, iconType, params) {
        super._init.call(this, params);

        this.label = new St.Label({text: text});
        this.actor.label_actor = this.label;
        this._icon = new St.Icon({ style_class: 'popup-menu-icon',
            icon_name: iconName,
            icon_type: iconType});
        this.addActor(this._icon, {span: 0});
        this.addActor(this.label);
    }

    /**
     * setIconSymbolicName:
     * @iconName (string): name of the icon
     *
     * Changes the icon to a symbolic icon with name @iconName.
     */
    setIconSymbolicName (iconName) {
        this._icon.set_icon_name(iconName);
        this._icon.set_icon_type(St.IconType.SYMBOLIC);
    }

    /**
     * setIconName:
     * @iconName (string): name of the icon
     *
     * Changes the icon to a full color icon with name @iconName.
     */
    setIconName (iconName) {
        this._icon.set_icon_name(iconName);
        this._icon.set_icon_type(St.IconType.FULLCOLOR);
    }
}

// Deprecated. Do not use
var PopupImageMenuItem = class PopupImageMenuItem extends PopupBaseMenuItem {
    _init (text, iconName, params) {
        super._init.call(this, params);

        this.label = new St.Label({ text: text });
        this.actor.label_actor = this.label;
        this.addActor(this.label);
        this._icon = new St.Icon({ style_class: 'popup-menu-icon' });
        this.addActor(this._icon, { align: St.Align.END });

        this.setIcon(iconName);
    }

    setIcon(name) {
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

var PopupIndicatorMenuItem = class PopupIndicatorMenuItem extends PopupBaseMenuItem {
    _init(text, params) {
        super._init.call(this, params);
        this.actor._delegate = this;
        this._displayIcon = false;

        this.label = new St.Label({ text: text });
        this.actor.label_actor = this.label;
        this._accel = new St.Label({ x_align: St.Align.END });
        this._ornament = new St.Bin();
        this._icon = new St.Icon({ style_class: 'popup-menu-icon', icon_type: St.IconType.FULLCOLOR });

        this._ornament.child = this._icon;
        this._ornament.child._delegate = this._ornament;
        this.addActor(this._ornament, {span: 0});
        this.addActor(this.label);
        this.addActor(this._accel, { align: St.Align.END });
    }

    setAccel(accel) {
        this._accel.set_text(accel);
    }

    haveIcon() {
        return ((this._icon)&&((this._icon.icon_name && this._icon.icon_name != "") || (this._icon.gicon)));
    }

    setIconName(name) {
        if (this._icon)
            this._icon.icon_name = name;
    }

    setGIcon(gicon) {
        if (this._icon)
            this._icon.gicon = gicon;
    }

    setOrnament(ornamentType, state) {
        switch (ornamentType) {
        case OrnamentType.CHECK:
            if ((this._ornament.child)&&(!(this._ornament.child._delegate instanceof CheckBox.CheckButton))) {
                this._ornament.child.destroy();
                this._ornament.child = null;
            }
            if (!this._ornament.child) {
                let switchOrn = new CheckBox.CheckButton(null, {}, state);
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
    }

    destroy() {
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

var PopupMenuAbstractItem = class PopupMenuAbstractItem {
    constructor() {
        return this._init.apply(this, arguments);
    }

    _init(id, childrenIds, params) {
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
    }

    getItemById(id) {throw new Error('Trying to use abstract function getItemById');}
    handleEvent(event, params) {throw new Error('Trying to use abstract function handleEvent');}
    //FIXME: Will be intresting this function? We don't use it anyway...
    //is_root() {throw new Error('Trying to use abstract function is_root');},

    isVisible() {
        return this._visible;
    }

    setVisible(visible) {
        if (this._visible != visible) {
            this._visible = visible;
            this._updateVisible();
        }
    }

    isSensitive() {
        return this._sensitive;
    }

    setSensitive(sensitive) {
        if (this._sensitive != sensitive) {
            this._sensitive = sensitive;
            this._updateSensitive();
        }
    }

    getLabel() {
        return this._label;
    }

    setLabel(label) {
        if (this._label != label) {
            this._label = label;
            this._updateLabel();
        }
    }

    getAction() {
        return this._action;
    }

    setAction(action) {
        if (this._action != action) {
            this._action = action;
        }
    }

    getParamType() {
        return this._paramType;
    }

    setParamType(paramType) {
        if (this._paramType != paramType) {
            this._paramType = paramType;
        }
    }

    getFactoryType() {
        return this._type;
    }

    setFactoryType(type) {
        if ((type) && (this._type != type)) {
            this._type = type;
            this._updateType();
        }
    }

    getIconName() {
        return this._iconName;
    }

    setIconName(iconName) {
        if (this._iconName != iconName) {
            this._iconName = iconName;
            this._updateImage();
        }
    }

    getGdkIcon() {
        return this._iconData;
    }

    setGdkIcon(iconData) {
        if (this._iconData != iconData) {
            this._iconData = iconData;
            this._updateImage();
        }
    }

    getToggleType() {
        return this._toggleType;
    }

    setToggleType(toggleType) {
        if (this._toggleType != toggleType) {
            this._toggleType = toggleType;
            this._updateOrnament();
        }
    }

    getToggleState() {
        return this._toggleState;
    }

    setToggleState(toggleState) {
        if (this._toggleState != toggleState) {
            this._toggleState = toggleState;
            this._updateOrnament();
        }
    }

    getAccel() {
        return this._accel;
    }

    setAccel(accel) {
        if (this._accel != accel) {
            this._accel = accel;
            this._updateAccel();
        }
    }

    setShellItem(shellItem, handlers) {
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
    }

    _updateLabel() {
        if ((this.shellItem)&&(this.shellItem.label)) {
            let label = this.getLabel();
            // The separator item might not even have a hidden label
            if (this.shellItem.label)
                this.shellItem.label.set_text(label);
        }
    }

    _updateOrnament() {
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
    }

    _updateAccel() {
        if ((this.shellItem)&&(this.shellItem._accel)) {
            let accel = this.getAccel();
            if (accel) {
                this.shellItem._accel.set_text(accel);
            }
        }
    }

    _updateImage() {
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
    }

    _updateVisible() {
        if (this.shellItem) {
            this.shellItem.actor.visible = this.isVisible();
        }
    }

    _updateSensitive() {
        if ((this.shellItem)&&(this.shellItem.setSensitive)) {
            this.shellItem.setSensitive(this.isSensitive());
        }
    }

    _updateType() {
        this.emit('type-changed');
    }

    getShellItem() {
        return this.shellItem;
    }

    getId() {
        return this._id;
    }

    getChildrenIds() {
        // Clone it!
        return this._childrenIds.slice();
    }

    getChildren() {
        return this._childrenIds.map(child_id => this.getItemById(child_id));
    }

    getParent() {
        return this.parent;
    }

    setParent(parent) {
        this.parent = parent;
    }

    addChild(pos, child_id) {
        let factoryItem = this.getItemById(child_id);
        if (factoryItem) {
            // If our item is previusly assigned, so destroy first the shell item.
            factoryItem.destroyShellItem();
            factoryItem.setParent(this);
            this._childrenIds.splice(pos, 0, child_id);
            this.emit('child-added', factoryItem, pos);
        }
    }

    removeChild(child_id) {
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
    }

    moveChild(child_id, newpos) {
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
    }

    // handlers = { "signal": handler }
    connectAndRemoveOnDestroy(handlers) {
        /*for (let signal in handlers) {
            this._externalSignalsHandlers.connect(this, signal, handlers[signal]);
        }*/
        this._connectAndSaveId(this, handlers, this._externalSignalsHandlers);
    }

    destroyShellItem() {
        this._destroyShellItem(this.shellItem);
    }

    // We try to not crash cinnamon if a shellItem will be destroyed and has the focus,
    // then we are moving the focus to the source actor.
    _destroyShellItem(shellItem) {
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
    }

    // handlers = { "signal": handler }
    _connectAndSaveId(target, handlers, idArray) {
        idArray = typeof idArray != 'undefined' ? idArray : [];
        for (let signal in handlers) {
            idArray.push(target.connect(signal, handlers[signal]));
        }
        return idArray;
    }

    _disconnectSignals(obj, signals_handlers) {
        if ((obj)&&(signals_handlers)) {
            for (let pos in signals_handlers)
                obj.disconnect(signals_handlers[pos]);
        }
    }

    _onActivate(shellItem, event, keepMenu) {
        this.handleEvent("clicked");
    }

    _onOpenStateChanged(menu, open) {
        if (open) {
            this.handleEvent("opened");
        } else {
            this.handleEvent("closed");
        }
    }

    _onShellItemDestroyed(shellItem) {
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
    }

    _onShellMenuDestroyed(shellMenu) {
        /*if (this._shellMenuSignalsHandlers) {
            this._shellMenuSignalsHandlers.disconnectAllSignals();
            this._shellMenuSignalsHandlers = null;
        }*/
        if (this._shellMenuSignalsHandlers) {
            this._disconnectSignals(shellMenu, this._shellMenuSignalsHandlers);
            this._shellMenuSignalsHandlers = null;
        }
    }

    destroy() {
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

var PopupMenuBase = class PopupMenuBase {
    constructor() {
        return this._init.apply(this, arguments);
    }
    /**
     * _init:
     * @sourceActor (St.Widget): the actor that owns the popup menu
     * @styleClass (string): (optional) the style class of the popup menu
     */
    _init(sourceActor, styleClass) {
        this.sourceActor = sourceActor;

        this._signals = new SignalManager.SignalManager(null);
        if (styleClass !== undefined) {
            this.box = new St.BoxLayout({ style_class: styleClass,
                                          vertical: true });
        } else {
            this.box = new St.BoxLayout({ vertical: true });
        }
        this._signals.connect_after(this.box, 'queue-relayout', Lang.bind(this, this._menuQueueRelayout));
        this.length = 0;

        this.isOpen = false;
        this.blockSourceEvents = false;
        this.passEvents = false;

        this._activeMenuItem = null;
        this._childMenus = [];
    }

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
    addAction(title, callback) {
        let menuItem = new PopupMenuItem(title);
        this.addMenuItem(menuItem);

        menuItem.connect('activate', (o, event) => {
            callback(event);
        });

        return menuItem;
    }

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
    addSettingsAction(title, module) {
        let menuItem = this.addAction(title, function() {
                           Util.spawnCommandLine("cinnamon-settings " + module);
                       });
        return menuItem;
    }

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
    addCommandlineAction(title, cmd) {
        let menuItem = this.addAction(title, function() {
                           Util.spawnCommandLine(cmd);
                       });
        return menuItem
    }

    /**
     * isChildMenu:
     * @menu (PopupMenu.PopupMenuBase): the menu of interest
     *
     * Returns: whether @menu is a submenu of this menu.
     */
    isChildMenu(menu) {
        return this._childMenus.indexOf(menu) != -1;
    }

    /**
     * addChildMenu:
     * @menu (PopupMenu.PopupMenuBase): the menu of interest
     *
     * Makes @menu a submenu of this menu.
     */
    addChildMenu(menu) {
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
    }

    /**
     * removeChildMenu:
     * @menu (PopupMenuBase): the menu of interest
     *
     * Removes @menu from the current menu if it is a child.
     */
    removeChildMenu(menu) {
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
    }

    _connectSubMenuSignals(object, menu) {
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

        this._signals.connect(menu, 'activate', (submenu, submenuItem, keepMenu) => {
            this.emit('activate', submenuItem, keepMenu);
            if (!keepMenu){
                this.close(true);
            }
        });
        this._signals.connect(menu, 'active-changed', (submenu, submenuItem) => {
            if (this._activeMenuItem && this._activeMenuItem != submenuItem)
                this._activeMenuItem.setActive(false);
            this._activeMenuItem = submenuItem;
            this.emit('active-changed', submenuItem);
        });
    }

    _connectItemSignals(menuItem) {
        this._signals.connect(menuItem, 'active-changed', (menuItem, active) => {
            if (active && this._activeMenuItem != menuItem) {
                if (this._activeMenuItem)
                    this._activeMenuItem.setActive(false);
                this._activeMenuItem = menuItem;
                this.emit('active-changed', menuItem);
            } else if (!active && this._activeMenuItem == menuItem) {
                this._activeMenuItem = null;
                this.emit('active-changed', null);
            }
        });
        this._signals.connect(menuItem, 'sensitive-changed', (menuItem, sensitive) => {
            if (!sensitive && this._activeMenuItem == menuItem) {
                if (!this.actor.navigate_focus(menuItem.actor,
                                               Gtk.DirectionType.TAB_FORWARD,
                                               true))
                    this.actor.grab_key_focus();
            } else if (sensitive && this._activeMenuItem == null) {
                if (global.stage.get_key_focus() == this.actor)
                    menuItem.actor.grab_key_focus();
            }
        });
        this._signals.connect(menuItem, 'activate', (menuItem, event, keepMenu) => {
            this.emit('activate', menuItem, keepMenu);
            if (!keepMenu){
                this.close(true);
            }
        });
        this._signals.connect(menuItem, 'destroy', (emitter) => {
            this._signals.disconnect('activate', menuItem);
            this._signals.disconnect('active-changed', menuItem);
            this._signals.disconnect('sensitive-changed', menuItem);
            if (menuItem.menu) {
                this._signals.disconnect('activate', menuItem.menu);
                this._signals.disconnect('active-changed', menuItem.menu);
                this._signals.disconnect('open-state-changed', this);
            }
            if (menuItem == this._activeMenuItem)
                this._activeMenuItem = null;
            this.length--;
        });
    }

    _updateSeparatorVisibility(menuItem) {
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
    }

    _updateAllSeparatorVisibility() {
        let children = this.box.get_children();

        for (let child of children) {
            if (child._delegate instanceof PopupSeparatorMenuItem) {
                this._updateSeparatorVisibility(child._delegate);
            }
        }
    }

    /**
     * addMenuItem:
     * @menuItem (PopupMenu.PopupBaseMenuItem): the item to include (can also
     * be a #PopupMenuSection)
     * @position (int): (optional) position to add the item at (empty for end
     * of menu)
     *
     * Adds the @menuItem to the menu.
     */
    addMenuItem(menuItem, position) {
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
            this._signals.connect(menuItem, 'destroy', () => {
                this._signals.disconnect('activate', menuItem);
                this._signals.disconnect('active-changed', menuItem);

                this.length--;
            });
        } else if (menuItem instanceof PopupSubMenuMenuItem) {
            if (before_item == null)
                this.box.add(menuItem.menu.actor);
            else
                this.box.insert_child_below(menuItem.menu.actor, before_item);
            this._connectSubMenuSignals(menuItem, menuItem.menu);
            this._connectItemSignals(menuItem);
            this._signals.connect(this, 'open-state-changed', function(self, open) {
                if (!open && menuItem.menu.isOpen) {
                    if (this.animating) {
                        menuItem.menu.closeAfterUnmap();
                    } else {
                        menuItem.menu.close(false);
                    }
                }
            }, this);
        } else if (menuItem instanceof PopupSeparatorMenuItem) {
            this._connectItemSignals(menuItem);

            // updateSeparatorVisibility needs to get called any time the
            // separator's adjacent siblings change visibility or position.
            // open-state-changed isn't exactly that, but doing it in more
            // precise ways would require a lot more bookkeeping.
            let updateSeparatorVisibility = this._updateSeparatorVisibility.bind(this, menuItem);
            this._signals.connect(this, 'open-state-changed', updateSeparatorVisibility);
        } else if (menuItem instanceof PopupBaseMenuItem)
            this._connectItemSignals(menuItem);
        else
            throw TypeError("Invalid argument to PopupMenuBase.addMenuItem()");

        this.length++;
    }

    /**
     * getColumnWidths:
     *
     * Gets the width of each column this thing has. In popup menus, everything
     * is put into columns, and the columns of all items align. This is used
     * internally and shouldn't be fiddled with unless you are implementing
     * other popup menu items.
     */
    getColumnWidths() {
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
    }

    /**
     * setColumnWidths:
     * @widths (array): the widths of each column
     *
     * Sets the widths of each column according to @widths so that things can
     * align.
     */
    setColumnWidths(widths) {
        let items = this.box.get_children();
        for (let i = 0; i < items.length; i++) {
            if (items[i].maybeGet("_delegate") instanceof PopupBaseMenuItem || items[i].maybeGet("_delegate") instanceof PopupMenuBase)
                items[i]._delegate.setColumnWidths(widths);
        }
    }

    // Because of the above column-width funniness, we need to do a
    // queue-relayout on every item whenever the menu itself changes
    // size, to force clutter to drop its cached size requests. (The
    // menuitems will in turn call queue_relayout on their parent, the
    // menu, but that call will be a no-op since the menu already
    // has a relayout queued, so we won't get stuck in a loop.
    _menuQueueRelayout() {
        let node = this.actor.peek_theme_node();
        if (node && node.get_background_image()) {
            Util.each(this.box.get_children(), (actor) => actor.queue_relayout());
        }
    }

    addActor(actor) {
        this.box.add(actor);
    }

    _getMenuItems() {
        return this.box.get_children().reduce((children, actor) => {
            if (actor._delegate &&
                (actor._delegate instanceof PopupBaseMenuItem || actor._delegate instanceof PopupMenuSection))
                children.push(actor._delegate);
            return children;
        }, []);
    }

    get firstMenuItem() {
        let items = this._getMenuItems();
        if (items.length)
            return items[0];
        else
            return null;
    }

    get numMenuItems() {
        return this._getMenuItems().length;
    }

    /**
     * removeAll:
     *
     * Clears everything inside the menu.
     */
    removeAll() {
        let children = this._getMenuItems();
        for (let i = 0; i < children.length; i++) {
            let item = children[i];
            item.destroy();
        }
    }

    /**
     * toggle:
     *
     * Toggles the open/close state of the menu.
     */
    toggle() {
        if (this.isOpen)
            this.close(true);
        else
            this.open(true);
    }

    /**
     * toggle_with_options:
     * @animate (boolean): whether or not to animate the open/close.
     * @onComplete (function): the function to call when the toggle action
     * completes.
     *
     * Toggles the open/close state of the menu with extra parameters
     */
    toggle_with_options (animate, onComplete) {
        if (this.isOpen) {
            this.close(animate, onComplete);
        } else {
            this.open(animate, onComplete);
        }
    }

    /**
     * destroy:
     *
     * Destroys the popup menu completely.
     */
    destroy() {
        this._signals.disconnectAllSignals();
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

var PopupMenu = class PopupMenu extends PopupMenuBase {
    /**
     * _init:
     * @sourceActor (St.Widget): the actor that owns the popup menu
     * @orientation (St.Side): the side of the menu that will be attached to @sourceActor. See %setOrientation() for details
     */
    _init(sourceActor, orientation) {
        super._init.call(this, sourceActor, 'popup-menu-content');

        this.paint_count = 0;
        this.animating = false;
        this._slidePosition = -1;

        this.actor = new St.Bin({ style_class: 'menu',
                                  important: true });
        this.actor._delegate = this;
        this._signals.connect(this.actor, 'key-press-event', Lang.bind(this, this._onKeyPressEvent));

        this.setOrientation(orientation);

        this._boxWrapper = new Cinnamon.GenericContainer();
        this._signals.connect(this._boxWrapper, 'get-preferred-width', Lang.bind(this, this._boxGetPreferredWidth));
        this._signals.connect(this._boxWrapper, 'get-preferred-height', Lang.bind(this, this._boxGetPreferredHeight));
        this._signals.connect(this._boxWrapper, 'allocate', Lang.bind(this, this._boxAllocate));
        this._signals.connect(this.actor, 'notify::allocation', Lang.bind(this, this._allocationChanged));
        this.actor.set_child(this._boxWrapper);
        this._boxWrapper.add_actor(this.box);

        global.focus_manager.add_group(this.actor);
        this.actor.reactive = true;
    }

    /**
     * setArrowSide:
     * @side (St.Side): The new side of the menu
     *
     * Sets the orientation of the @sourceActor with respect to the menu. This function is deprecated and kept
     * for compatibility with older code. Please use %setOrientation instead.
     */
    setArrowSide(side) {
        this.setOrientation(side);
    }

    _updateStyleClassName() {
        let styleClasses = ["menu"];
        if (this.customStyleClass) {
            styleClasses.push(this.customStyleClass);
        }

        switch(this.orientation) {
            case St.Side.TOP:
                styleClasses.push("top");
            case St.Side.BOTTOM:
                styleClasses.push("bottom");
            case St.Side.LEFT:
                styleClasses.push("left");
            case St.Side.RIGHT:
                styleClasses.push("right");
        }
        this.actor.set_style_class_name(styleClasses.join(" "));
    }

    /**
     * setOrientation:
     * @orientation (St.Side): The new orientation of the menu
     *
     * Sets the orientation of the @sourceActor with respect to the menu. For example, if you use St.Side.TOP,
     * the menu will try to place itself below the @sourcActor unless there is not enough room for it.
     */
    setOrientation(orientation) {
        this._orientation = orientation;
        this._updateStyleClassName();
    }

    /**
     * setCustomStyleClass:
     * @className (string): the custom class name to add
     *
     * Adds a custom class name to the menu which allows it to be styled separately from other menus.
     */
    setCustomStyleClass(className) {
        this.customStyleClass = className;
        this._updateStyleClassName();
    }

    /**
     * setSourceAlignment:
     * @alignment (real): the position of the arrow relative to the source
     * actor.
     *
     * Since the boxpointer was removed from the menu, this function now does nothing. Please do not use this
     * function in new code.
     */
    setSourceAlignment(alignment) {}

    /**
     * open:
     * @animate (boolean): whether to animate the open effect or not
     *
     * Opens the popup menu
     */
    open(animate) {
        if (this.isOpen || this.actor.is_finalized())
            return;

        Main.popup_rendering_actor = this.actor;

        this.setMaxHeight();
        this._updateAllSeparatorVisibility();

        /* I'd rather this be inside the active tween scope as an onUpdate param, but how do you modify
         * a tweens own parameters during said tweening? */
        this._breadth = 0;

        this.isOpen = true;
        if (global.menuStackLength == undefined)
            global.menuStackLength = 0;
        global.menuStackLength += 1;

        this._signals.connect(this.actor, "paint", Lang.bind(this, this.on_paint));

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
            let panels = Main.panelManager.getPanelsInMonitor(monitor.index);
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

        if (animate && Main.wm.desktop_effects_menus) {
            this.animating = true;
            this.actor.show();
            this.actor.opacity = 0;

            let tweenParams = {
                transition: "easeOutQuad",
                time: Main.wm.MENU_ANIMATION_TIME,
                opacity: 255,
                onUpdate: dest => {
                    let clipY = 0;
                    let clipX = 0;
                    let xUpdate = 0;
                    let yUpdate = 0;

                    switch (this._orientation) {
                        case St.Side.TOP:
                        case St.Side.BOTTOM:
                            clipY = dest - this.actor.y;

                            if (this.actor.width != this._breadth) {
                                [xUpdate, yUpdate] = this._calculatePosition();
                                this.actor.x = xUpdate;
                                this._breadth = this.actor.width;
                            }

                            break;
                        case St.Side.LEFT:
                        case St.Side.RIGHT:
                            clipX = dest - this.actor.x;

                            if (this.actor.height != this._breadth) {
                                [xUpdate, yUpdate] = this._calculatePosition();
                                this.actor.y = yUpdate;
                                this._breadth = this.actor.height;
                            }

                            break;
                    }

                    this.actor.set_clip(clipX, clipY, this.actor.width, this.actor.height);
                },
                onComplete: () => {
                    this.animating = false;
                    this.actor.remove_clip();
                }
            }

            let [xPos, yPos] = this._calculatePosition();

            switch (this._orientation) {
                case St.Side.TOP:
                case St.Side.BOTTOM:
                    this.actor.x = xPos;
                    this._breadth = this.actor.width;
                    tweenParams["y"] = yPos;
                    yPos -= this.actor.margin_top;
                    tweenParams["onUpdateParams"] = [yPos];
                    if (this.sideFlipped) // Bottom
                        this.actor.y = yPos + (this.actor.height * MENU_ANIMATION_OFFSET) - this.actor.margin_top;
                    else // Top
                        this.actor.y = yPos - (this.actor.height * MENU_ANIMATION_OFFSET) + this.actor.margin_bottom;
                    break;
                case St.Side.LEFT:
                case St.Side.RIGHT:
                    this.actor.y = yPos;
                    this._breadth = this.actor.height;
                    tweenParams["x"] = xPos;
                    xPos -= this.actor.margin_left;
                    tweenParams["onUpdateParams"] = [xPos];
                    if (this.sideFlipped) // Right
                        this.actor.x = xPos + (this.actor.width * MENU_ANIMATION_OFFSET) - this.actor.margin_left;
                    else // Left
                        this.actor.x = xPos - (this.actor.width * MENU_ANIMATION_OFFSET) + this.actor.margin_right;
                    break;
            }

            Tweener.addTween(this.actor, tweenParams);
        } else {
            this.animating = false;

            let [xPos, yPos] = this._calculatePosition(); // should this be conditional on this._slidePosition being -1?
            this.actor.x = xPos;
            this.actor.y = yPos;

            this.actor.show();
        }

        this.emit('open-state-changed', true);
    }

    /**
     * close:
     * @animate (boolean): whether to animate the close effect or not
     *
     * Closes the popup menu.
     */
    close(animate) {
        if (!this.isOpen)
            return;

        this.isOpen = false;
        global.menuStackLength -= 1;

        Main.panelManager.updatePanelsVisibility();

        if (this._activeMenuItem)
            this._activeMenuItem.setActive(false);

        let did_animate = false;

        if (animate && Main.wm.desktop_effects_menus) {
            did_animate = true;

            this.actor.set_position(...this._calculatePosition());
            this.actor.set_size(...this.actor.get_size());
            this.animating = true;
            let tweenParams = {
                transition: "easeInQuad",
                time: Main.wm.MENU_ANIMATION_TIME,
                opacity: 0,
                onUpdate: dest => {
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
                    },
                onComplete: () => {
                    this.animating = false;
                    this.actor.hide();
                    this.actor.remove_clip();
                    this.actor.set_size(-1, -1);
                    this.actor.opacity = 255;
                    this.emit("menu-animated-closed");
                }
            }

            switch (this._orientation) {
                case St.Side.TOP:
                case St.Side.BOTTOM:
                    let yPos = this.actor.y - this.actor.margin_top;
                    tweenParams["onUpdateParams"] = [yPos - this.actor.margin_top];
                    if (this.sideFlipped) // Botton
                        tweenParams["y"] = yPos + (this.actor.height * MENU_ANIMATION_OFFSET) + this.actor.margin_bottom;
                    else // Top
                        tweenParams["y"] = yPos - (this.actor.height * MENU_ANIMATION_OFFSET) - this.actor.margin_top;
                    break;
                case St.Side.LEFT:
                case St.Side.RIGHT:
                    let xPos = this.actor.x - this.actor.margin_left;
                    tweenParams["onUpdateParams"] = [xPos - this.actor.margin_left];
                    if (this.sideFlipped) // Right
                        tweenParams["x"] = xPos + (this.actor.width * MENU_ANIMATION_OFFSET) + this.actor.margin_right;
                    else // Left
                        tweenParams["x"] = xPos - (this.actor.width * MENU_ANIMATION_OFFSET) - this.actor.margin_left;
                    break;
            }

            Tweener.addTween(this.actor, tweenParams);
        }
        else {
            this.animating = false;
            this.actor.hide();
        }
        this.emit('open-state-changed', false);

        // keep the order of open-state-changed -> menu-animated-closed in case it matters.
        if (!did_animate) {
            this.emit("menu-animated-closed");
        }
    }

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
    shiftToPosition(slidePosition) {
        this._slidePosition = slidePosition;
        let [xPos, yPos] = this._calculatePosition();
        this.actor.set_position(xPos, yPos);
    }

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
    setMaxHeight() {
        let monitor = Main.layoutManager.findMonitorForActor(this.sourceActor)

        let maxHeight = monitor.height;
        let maxWidth = monitor.width;

        let panels = Main.panelManager.getPanelsInMonitor(monitor.index);

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
    }

    _calculatePosition() {
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

        // remove visible panels from workable area to avoid overlapping them
        let panels = Main.panelManager.getPanelsInMonitor(monitor.index);

        for (let panel of panels) {
            if (!panel.getIsVisible()) continue;
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
                if (this._orientation === St.Side.BOTTOM || (y2 - sourceBox.y2) < natHeight) {
                    this.sideFlipped = true;
                    yPos = y2 - natHeight;
                }
                else {
                    this.sideFlipped = false;
                    yPos = Math.max(sourceBox.y2, y1);
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
                if (this._orientation === St.Side.RIGHT || x2 - sourceBox.x2 < natWidth) {
                    this.sideFlipped = true;
                    xPos = Math.min(sourceBox.x1, x2) - natWidth;
                }
                else {
                    this.sideFlipped = false;
                    xPos = Math.max(sourceBox.x2, x1);
                }
                break;
        }
        return [Math.round(xPos), Math.round(yPos)];
    }

    _boxGetPreferredWidth (actor, forHeight, alloc) {
        let columnWidths = this.getColumnWidths();
        this.setColumnWidths(columnWidths);

        // Now they will request the right sizes
        [alloc.min_size, alloc.natural_size] = this.box.get_preferred_width(forHeight);
    }

    _boxGetPreferredHeight (actor, forWidth, alloc) {
        [alloc.min_size, alloc.natural_size] = this.box.get_preferred_height(forWidth);
    }

    _boxAllocate (actor, box, flags) {
        this.box.allocate(box, flags);
    }

    _allocationChanged (actor, pspec) {
        if (!this.animating && !this.sourceActor.is_finalized() && this.sourceActor.get_stage() != null) {
            let [xPos, yPos] = this._calculatePosition();
            this.actor.set_position(xPos, yPos);
        }
    }

    _onKeyPressEvent(actor, event) {
        if (event.get_key_symbol() === Clutter.KEY_Escape) {
            this.close(true);
            return true;
        }

        return false;
    }

    on_paint(actor) {
        if (this.paint_count < 2 || this.animating) {
            this.paint_count++;
            return;
        }

        if (this._signals.isConnected('paint', this.actor)) {
            this._signals.disconnect('paint', this.actor);
        }

        this.paint_count = 0;
        Main.popup_rendering_actor = null;
    }
}

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

var PopupSubMenu = class PopupSubMenu extends PopupMenuBase {

    /**
     * _init:
     * @sourceActor (St.Widget): the actor that owns the popup menu
     * @sourceArrow (St.Icon): (optional) a little arrow object inside the
     * #PopupSubMenuMenuItem. When the submenu opens, the arrow is rotated by
     * pi/2 clockwise to denote the status of the submenu.
     */
    _init(sourceActor, sourceArrow) {
        super._init.call(this, sourceActor);
        this.unmapId = 0;

        if (sourceArrow) {
            this._arrow = sourceArrow;
        }

        this.actor = new St.ScrollView({ style_class: 'popup-sub-menu',
                                         hscrollbar_policy: St.PolicyType.NEVER,
                                         vscrollbar_policy: St.PolicyType.NEVER });

        // StScrollbar plays dirty tricks with events, calling
        // clutter_set_motion_events_enabled (FALSE) during the scroll; this
        // confuses our event tracking, so we just turn it off during the
        // scroll.
        let vscroll = this.actor.get_vscroll_bar();
        this._signals.connect(vscroll, 'scroll-start',
                        () => {
                            let topMenu = this._getTopMenu();
                            if (topMenu)
                                topMenu.passEvents = true;
                        });
        this._signals.connect(vscroll, 'scroll-stop',
                        () => {
                            let topMenu = this._getTopMenu();
                            if (topMenu)
                                topMenu.passEvents = false;
                        });

        this.actor.add_actor(this.box);
        this.actor._delegate = this;
        this.actor.clip_to_allocation = true;
        this._signals.connect(this.actor, 'key-press-event', Lang.bind(this, this._onKeyPressEvent));
        this.actor.hide();
    }

    _getTopMenu() {
        let actor = this.actor.get_parent();
        while (actor) {
            if (actor._delegate && actor._delegate instanceof PopupMenu)
                return actor._delegate;

            actor = actor.get_parent();
        }

        return null;
    }

    _needsScrollbar() {
        let topMenu = this._getTopMenu();
        if(!topMenu)
            return false;
        let [topMinHeight, topNaturalHeight] = topMenu.actor.get_preferred_height(-1);
        let topThemeNode = topMenu.actor.get_theme_node();

        let topMaxHeight = topThemeNode.get_max_height();
        return topMaxHeight >= 0 && topNaturalHeight >= topMaxHeight;
    }

    /**
     * open:
     * @animate (boolean): whether the animate the open effect
     *
     * Opens the submenu
     */
    open(animate) {
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
            needsScrollbar ? St.PolicyType.AUTOMATIC : St.PolicyType.NEVER;

        // It looks funny if we animate with a scrollbar (at what point is
        // the scrollbar added?) so just skip that case
        animate = animate && !needsScrollbar

        const targetAngle = this.actor.get_direction() === St.TextDirection.RTL ? -90 : 90;

        if (animate && Main.wm.desktop_effects_menus) {
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
                               onUpdate: () => {
                                   if (this._arrow)
                                       this._arrow.rotation_angle_z = this.actor._arrowRotation;
                               },
                               onComplete: () => {
                                   this.actor.set_height(-1);
                                   this.emit('open-state-changed', true);
                               }
                             });
        } else {
            if (this._arrow)
                this._arrow.rotation_angle_z = targetAngle;
            this.emit('open-state-changed', true);
        }
    }

    /**
     * close:
     * @animate (boolean): whether the animate the close effect
     *
     * Closes the submenu
     */
    close(animate) {
        if (!this.isOpen)
            return;

        this.isOpen = false;

        if (this._activeMenuItem)
            this._activeMenuItem.setActive(false);

        animate = animate && !this._needsScrollbar();

        if (animate && Main.wm.desktop_effects_menus) {
            if (this._arrow)
                this.actor._arrowRotation = this._arrow.rotation_angle_z;
            Tweener.addTween(this.actor,
                             { _arrowRotation: 0,
                               height: 0,
                               time: 0.25,
                               onComplete: () => {
                                   this.actor.hide();
                                   this.actor.set_height(-1);

                                   this.emit('open-state-changed', false);
                               },
                               onUpdate: () => {
                                   if (this._arrow)
                                       this._arrow.rotation_angle_z = this.actor._arrowRotation;
                               }
                             });
        } else {
            if (this._arrow) this._arrow.rotation_angle_z = 0;
            this.actor.hide();
            this.isOpen = false;
            this.emit('open-state-changed', false);
        }
    }

    //Closes the submenu after it has been unmapped. Used to prevent size changes
    //when the parent is closing at the same time and may be tweening.
    closeAfterUnmap() {
        if (this.isOpen && this.actor.mapped) {
            if (!this.unmapId) {
                this.unmapId = this.actor.connect("notify::mapped", () => {
                    this.actor.disconnect(this.unmapId);
                    this.unmapId = 0;
                    this.close(false);
                });
            }
        } else {
            this.close(false);
        }
    }

    _onKeyPressEvent(actor, event) {
        if(!this.isOpen) return false;

        const rtl = this.actor.get_direction() === St.TextDirection.RTL;

        // Move focus back to parent menu if the user
        // types Left on ltr, or Right on rtl layout.
        if ((event.get_key_symbol() === Clutter.KEY_Left && !rtl) ||
            (event.get_key_symbol() === Clutter.KEY_Right && rtl)) {
            this.sourceActor._delegate.setActive(true);
            this.close(true);
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
var PopupMenuSection = class PopupMenuSection extends PopupMenuBase {
    _init() {
        super._init.call(this);

        this.actor = this.box;
        this.actor._delegate = this;
        this.isOpen = true;
    }

    // deliberately ignore any attempt to open() or close()
    open(animate) { }
    close() { }
}

var PopupSubMenuMenuItem = class PopupSubMenuMenuItem extends PopupBaseMenuItem {
    _init(text) {
        super._init.call(this);

        this._triangle = null;

        // This check allows PopupSubMenu to be used as a generic scrollable container.
        if (typeof text === 'string') {
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
            this._triangle.pivot_point = new Graphene.Point({ x: 0.5, y: 0.5 });
            this._triangleBin.child = this._triangle;
        }

        this.menu = new PopupSubMenu(this.actor, this._triangle);
        this._signals.connect(this.menu, 'open-state-changed', Lang.bind(this, this._subMenuOpenStateChanged));
    }

    _subMenuOpenStateChanged(menu, open) {
        this.actor.change_style_pseudo_class('open', open);
    }

    destroy() {
        this.menu.destroy();
        PopupBaseMenuItem.prototype.destroy.call(this);
    }

    _onKeyPressEvent(actor, event) {
        const symbol = event.get_key_symbol();
        const rtl = this.actor.get_direction() === St.TextDirection.RTL;
        const shouldOpen = (symbol === Clutter.KEY_Right && !rtl) || (symbol === Clutter.KEY_Left && rtl);
        const shouldClose = (symbol === Clutter.KEY_Left && !rtl) || (symbol === Clutter.KEY_Right && rtl);

        if (shouldOpen) {
            this.menu.open(true);
            this.menu.actor.navigate_focus(null, Gtk.DirectionType.DOWN, false);
            return true;
        } else if (shouldClose && this.menu.isOpen) {
            this.menu.close();
            return true;
        }

        return PopupBaseMenuItem.prototype._onKeyPressEvent.call(this, actor, event);
    }

    activate(event) {
        this.menu.open(true);
    }

    _onButtonReleaseEvent(actor) {
        this.menu.toggle();
    }
}

var PopupComboMenu = class PopupComboMenu extends PopupMenuBase {
    _init(sourceActor) {
        super._init.call(this,
                                           sourceActor, 'popup-combo-menu');
        this.actor = this.box;
        this.actor._delegate = this;
        this._signals.connect(this.actor, 'key-press-event', Lang.bind(this, this._onKeyPressEvent));
        this._signals.connect(this.actor, 'key-focus-in', Lang.bind(this, this._onKeyFocusIn));
        this._activeItemPos = -1;
        global.focus_manager.add_group(this.actor);
    }

    _onKeyPressEvent(actor, event) {
        if (event.get_key_symbol() === Clutter.KEY_Escape) {
            this.close(true);
            return true;
        }

        return false;
    }

    _onKeyFocusIn(actor) {
        let items = this._getMenuItems();
        let activeItem = items[this._activeItemPos];
        activeItem.actor.grab_key_focus();
    }

    open() {
        if (this.isOpen)
            return;

        this.isOpen = true;

        let activeItem = this._getMenuItems()[this._activeItemPos];

        let [sourceX, sourceY] = this.sourceActor.get_transformed_position();
        this.actor.set_position(Math.round(sourceX), Math.round(sourceY - activeItem.actor.y));

        this.actor.raise_top();

        this.actor.opacity = 0;
        this.actor.show();

        if (Main.wm.desktop_effects_menus) {
            Tweener.addTween(this.actor,
                             { opacity: 255,
                               transition: 'linear',
                               time: BoxPointer.POPUP_ANIMATION_TIME });
        }

        this.savedFocusActor = global.stage.get_key_focus();
        global.stage.set_key_focus(this.actor);
        this.emit('open-state-changed', true);
    }

    close() {
        if (!this.isOpen)
            return;

        this.isOpen = false;
        if (Main.wm.desktop_effects_menus) {
            Tweener.addTween(this.actor,
                             { opacity: 0,
                               transition: 'linear',
                               time: BoxPointer.POPUP_ANIMATION_TIME,
                               onComplete: () => { this.actor.hide() }
                             });
        } else {
            this.actor.hide();
        }
        this.emit('open-state-changed', false);
        global.stage.set_key_focus(this.savedFocusActor);
    }

    setActiveItem(position) {
        this._activeItemPos = position;
    }

    setItemVisible(position, visible) {
        if (!visible && position == this._activeItemPos) {
            log('Trying to hide the active menu item.');
            return;
        }

        this._getMenuItems()[position].actor.visible = visible;
    }

    getItemVisible(position) {
        return this._getMenuItems()[position].actor.visible;
    }
}

var PopupComboBoxMenuItem = class PopupComboBoxMenuItem extends PopupBaseMenuItem {
    _init (params) {
        super._init.call(this, params);

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

        this._signals.connect(this.actor, 'scroll-event', Lang.bind(this, this._onScrollEvent));

        this._activeItemPos = -1;
        this._items = [];
    }

    _getTopMenu() {
        let actor = this.actor.get_parent();
        while (actor) {
            if (actor._delegate &&
                (actor._delegate instanceof PopupMenu ||
                 actor._delegate instanceof PopupComboMenu))
                return actor._delegate;

            actor = actor.get_parent();
        }

        return null;
    }

    _onScrollEvent(actor, event) {
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
    }

    activate(event) {
        let topMenu = this._getTopMenu();
        if (!topMenu)
            return;

        topMenu.addChildMenu(this._menu);
        this._menu.toggle();
    }

    addMenuItem(menuItem, position) {
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

        this._signals.connect(menuItem, 'activate',
                        this._itemActivated.bind(this, position));
    }

    checkAccessibleLabel() {
        let activeItem = this._menu.getActiveItem();
        this.actor.label_actor = activeItem.label;
    }

    setActiveItem(position) {
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
    }

    setItemVisible(position, visible) {
        this._menu.setItemVisible(position, visible);
    }

    _itemActivated(menuItem, event, position) {
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
var PopupMenuFactory = class PopupMenuFactory {
    constructor() {
        return this._init.apply(this, arguments);
    }

    _init() {
        this._menuLikend = new Array();
    }

    _createShellItem(factoryItem, launcher, orientation) {
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
    }

    getShellMenu(factoryMenu) {
        let index = this._menuLikend.indexOf(factoryMenu);
        if (index != -1) {
            return factoryMenu.getShellItem();
        }
        return null;
    }

    buildShellMenu(client, launcher, orientation) {
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
    }

    // This will attach the root factoryItem to an already existing menu that will be used as the root menu.
    // it will also connect the factoryItem to be automatically destroyed when the menu dies.
    _attachToMenu(shellItem, factoryItem) {
        // Cleanup: remove existing childs (just in case)
        shellItem.removeAll();

        // Fill the menu for the first time
        factoryItem.getChildren().forEach(child => {
            shellItem.addMenuItem(this._createItem(child));
        });

        factoryItem.setShellItem(shellItem, {
            'child-added'   : Lang.bind(this, this._onChildAdded),
            'child-moved'   : Lang.bind(this, this._onChildMoved)
        });
        this._menuLikend.push(factoryItem);
        factoryItem.connectAndRemoveOnDestroy({
            'destroy'           : Lang.bind(this, this._onDestroyMainMenu)
        });
    }

    _onDestroyMainMenu(factoryItem) {
        let index = this._menuLikend.indexOf(factoryItem);
        if (index != -1) {
            this._menuLikend.splice(index, 1);
        }
    }

    _createItem(factoryItem) {
        // Don't allow to override previusly preasigned items, destroy the shell item first.
        factoryItem.destroyShellItem();
        let shellItem = this._createShellItem(factoryItem);

        // Initially create children on idle, to not stop cinnamon mainloop.
        Mainloop.idle_add(() => this._createChildrens(factoryItem));

        // Now, connect various events
        factoryItem.setShellItem(shellItem, {
            'type-changed':       Lang.bind(this, this._onTypeChanged),
            'child-added':        Lang.bind(this, this._onChildAdded),
            'child-moved':        Lang.bind(this, this._onChildMoved)
        });
        return shellItem;
    }

    _createChildrens(factoryItem) {
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
    }

    _onChildAdded(factoryItem, child, position) {
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
    }

    _onChildMoved(factoryItem, child, oldpos, newpos) {
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
    }

    // FIXME: If this function it is applied, this mean that our old shell Item
    // is not valid right now, so we can destroy it with all the obsolete submenu
    // structure and then create again for the new factoryItems source. Anyway
    // there are a lot of possible scenarios when this was called, sure we are
    // missing some of them.
    _onTypeChanged(factoryItem) {
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
    }

    // FIXME: This is a HACK. We're really getting into the internals of the PopupMenu implementation.
    // First, find our wrapper. Children tend to lie. We do not trust the old positioning.
    // Will be better add this function inside the PopupMenuBase class?
    _moveItemInMenu(menu, factoryItem, newpos) {
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
}

/* Basic implementation of a menu manager.
 * Call addMenu to add menus
 */
var PopupMenuManager = class PopupMenuManager {
    constructor() {
        return this._init.apply(this, arguments);
    }

    _init(owner, shouldGrab = true) {
        this._owner = owner;
        this.grabbed = false;
        this.shouldGrab = shouldGrab;

        this._eventCaptureId = 0;
        this._enterEventId = 0;
        this._leaveEventId = 0;
        this._keyFocusNotifyId = 0;
        this._activeMenu = null;
        this._menus = [];
        this._menuStack = [];
        this._preGrabInputMode = null;
        this._grabbedFromKeynav = false;
        this._signals = new SignalManager.SignalManager(null);
    }

    addMenu(menu, position) {
        this._signals.connect(menu, 'open-state-changed', this._onMenuOpenState, this);
        this._signals.connect(menu, 'child-menu-added', this._onChildMenuAdded, this);
        this._signals.connect(menu, 'child-menu-removed', this._onChildMenuRemoved, this);
        this._signals.connect(menu, 'destroy', this._onMenuDestroy, this);

        let source = menu.sourceActor;

        if (source) {
            let onMenuSourceEnter = this._onMenuSourceEnter.bind(this, menu);
            this._signals.connect(source, 'enter-event', onMenuSourceEnter);
            this._signals.connect(source, 'key-focus-in', onMenuSourceEnter);
        }

        if (position == undefined)
            this._menus.push(menu);
        else
            this._menus.splice(position, 0, menu);
    }

    removeMenu(menu) {
        if (menu == this._activeMenu)
            this._closeMenu();

        let position = this._menus.indexOf(menu);

        if (position == -1) // not a menu we manage
            return;

        this._signals.disconnect(null, menu);

        if (menu.sourceActor)
            this._signals.disconnect(null, menu.sourceActor);

        this._menus.splice(position, 1);

        // Make sure destroy is called after the last menu is removed/destroyed.
        if (this._menus.length === 0) this.destroy();
    }

    _grab() {
        if (!Main.pushModal(this._owner.actor)) {
            return;
        }
        this._signals.connect(global.stage, 'captured-event', this._onEventCapture, this);
        // captured-event doesn't see enter/leave events
        this._signals.connect(global.stage, 'enter-event', this._onEventCapture, this);
        this._signals.connect(global.stage, 'leave-event', this._onEventCapture, this);
        this._signals.connect(global.stage, 'notify::key-focus', this._onKeyFocusChanged, this);

        this.grabbed = true;
    }

    _ungrab() {
        if (!this.grabbed) {
            return;
        }

        this._signals.disconnect(null, global.stage);

        this.grabbed = false;
        Main.popModal(this._owner.actor);
    }

    _onMenuOpenState(menu, open) {
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

        if (!this.shouldGrab) return;

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
    }

    _onChildMenuAdded(menu, childMenu) {
        this.addMenu(childMenu);
    }

    _onChildMenuRemoved(menu, childMenu) {
        this.removeMenu(childMenu);
    }

    // change the currently-open menu without dropping grab
    _changeMenu(newMenu) {
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
    }

    _onMenuSourceEnter(menu) {
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
    }

    _onKeyFocusChanged() {
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
    }

    _onMenuDestroy(menu) {
        this.removeMenu(menu);
    }

    _activeMenuContains(actor) {
        return !actor.is_finalized()
                && this._activeMenu != null
                && (this._activeMenu.actor.contains(actor) ||
                    (this._activeMenu.sourceActor && this._activeMenu.sourceActor.contains(actor)));
    }

    _eventIsOnActiveMenu(event) {
        return this._activeMenuContains(event.get_source());
    }

    _shouldBlockEvent(event) {
        let src = event.get_source();

        if (src.is_finalized() || (this._activeMenu != null && this._activeMenu.actor.contains(src)))
            return false;

        return (this._menus.find(x => x.sourceActor &&
                                      !x.blockSourceEvents &&
                                      x.sourceActor.contains(src)) === undefined);
    }

    _onEventCapture(actor, event) {
        if (!this.grabbed)
            return false;

        if (Main.virtualKeyboard.shouldTakeEvent(event))
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
    }

    _closeMenu() {
        if (this._activeMenu != null)
            this._activeMenu.close(true);
    }

    destroy() {
        this._signals.disconnectAllSignals();
        this.emit('destroy');
    }
}
Signals.addSignalMethods(PopupMenuManager.prototype);
