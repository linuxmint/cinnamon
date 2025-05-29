// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported SwitcherPopup, SwitcherList */

const { Clutter, GLib, GObject, Meta, St } = imports.gi;

const Main = imports.ui.main;

var POPUP_DELAY_TIMEOUT = 150; // milliseconds

var POPUP_SCROLL_TIME = 100; // milliseconds
var POPUP_FADE_OUT_TIME = 100; // milliseconds

var DISABLE_HOVER_TIMEOUT = 500; // milliseconds
var NO_MODS_TIMEOUT = 1500; // milliseconds

function mod(a, b) {
    return (a + b) % b;
}

function primaryModifier(mask) {
    if (mask == 0)
        return 0;

    let primary = 1;
    while (mask > 1) {
        mask >>= 1;
        primary <<= 1;
    }
    return primary;
}

var SwitcherPopup = GObject.registerClass({
    GTypeFlags: GObject.TypeFlags.ABSTRACT,
}, class SwitcherPopup extends St.Widget {
    _init(items) {
        super._init({ style_class: 'input-switcher-popup',
                      reactive: true,
                      important: true,
                      visible: false });

        this._switcherList = null;

        this._items = items || [];
        this._selectedIndex = 0;

        this.connect('destroy', this._onDestroy.bind(this));

        Main.uiGroup.add_actor(this);

        this._systemModalOpenedId =
            Main.layoutManager.connect('system-modal-opened', () => this.destroy());

        this._haveModal = false;
        this._modifierMask = 0;

        this._motionTimeoutId = 0;
        this._initialDelayTimeoutId = 0;
        this._noModsTimeoutId = 0;

        this.add_constraint(new Clutter.BindConstraint({
            source: global.stage,
            coordinate: Clutter.BindCoordinate.ALL,
        }));

        // Initially disable hover so we ignore the enter-event if
        // the switcher appears underneath the current pointer location
        this._disableHover();
    }

    vfunc_allocate(box, flags) {
        this.set_allocation(box, flags);

        let childBox = new Clutter.ActorBox();
        let primary = Main.layoutManager.primaryMonitor;

        let leftPadding = this.get_theme_node().get_padding(St.Side.LEFT);
        let rightPadding = this.get_theme_node().get_padding(St.Side.RIGHT);
        let hPadding = leftPadding + rightPadding;

        // Allocate the switcherList
        // We select a size based on an icon size that does not overflow the screen
        let [, childNaturalHeight] = this._switcherList.get_preferred_height(primary.width - hPadding);
        let [, childNaturalWidth] = this._switcherList.get_preferred_width(childNaturalHeight);
        childBox.x1 = Math.max(primary.x + leftPadding, primary.x + Math.floor((primary.width - childNaturalWidth) / 2));
        childBox.x2 = Math.min(primary.x + primary.width - rightPadding, childBox.x1 + childNaturalWidth);
        childBox.y1 = primary.y + Math.floor((primary.height - childNaturalHeight) / 2);
        childBox.y2 = childBox.y1 + childNaturalHeight;
        this._switcherList.allocate(childBox, flags);
    }

    _initialSelection(backward, _binding) {
        if (backward)
            this._select(this._items.length - 1);
        else if (this._items.length == 1)
            this._select(0);
        else
            this._select(1);
    }

    show(backward, binding, mask) {
        if (this._items.length == 0)
            return false;

        if (!Main.pushModal(this)) {
            // Probably someone else has a pointer grab, try again with keyboard only
            if (!Main.pushModal(this, { options: Meta.ModalOptions.POINTER_ALREADY_GRABBED }))
                return false;
        }
        this._haveModal = true;
        this._modifierMask = primaryModifier(mask);

        this.add_actor(this._switcherList);
        this._switcherList.connect('item-activated', this._itemActivated.bind(this));
        this._switcherList.connect('item-entered', this._itemEntered.bind(this));
        this._switcherList.connect('item-removed', this._itemRemoved.bind(this));

        // Need to force an allocation so we can figure out whether we
        // need to scroll when selecting
        this.opacity = 0;
        this.visible = true;
        this.get_allocation_box();

        this._initialSelection(backward, binding);

        // There's a race condition; if the user released Alt before
        // we got the grab, then we won't be notified. (See
        // https://bugzilla.gnome.org/show_bug.cgi?id=596695 for
        // details.) So we check now. (Have to do this after updating
        // selection.)
        if (this._modifierMask) {
            let [x_, y_, mods] = global.get_pointer();
            if (!(mods & this._modifierMask)) {
                this._finish(global.get_current_time());
                return true;
            }
        } else {
            this._resetNoModsTimeout();
        }

        // We delay showing the popup so that fast Alt+Tab users aren't
        // disturbed by the popup briefly flashing.
        this._initialDelayTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            POPUP_DELAY_TIMEOUT,
            () => {
                this._showImmediately();
                return GLib.SOURCE_REMOVE;
            });
        GLib.Source.set_name_by_id(this._initialDelayTimeoutId, '[gnome-shell] Main.osdWindow.cancel');
        return true;
    }

    _showImmediately() {
        if (this._initialDelayTimeoutId === 0)
            return;

        GLib.source_remove(this._initialDelayTimeoutId);
        this._initialDelayTimeoutId = 0;

        Main.osdWindowManager.hideAll();
        this.opacity = 255;
    }

    _next() {
        return mod(this._selectedIndex + 1, this._items.length);
    }

    _previous() {
        return mod(this._selectedIndex - 1, this._items.length);
    }

    _keyPressHandler(_keysym, _action) {
        throw new GObject.NotImplementedError(`_keyPressHandler in ${this.constructor.name}`);
    }

    vfunc_key_press_event(keyEvent) {
        let keysym = keyEvent.keyval;
        let action = global.display.get_keybinding_action(
            keyEvent.hardware_keycode, keyEvent.modifier_state);

        this._disableHover();

        if (this._keyPressHandler(keysym, action) != Clutter.EVENT_PROPAGATE) {
            this._showImmediately();
            return Clutter.EVENT_STOP;
        }

        // Note: pressing one of the below keys will destroy the popup only if
        // that key is not used by the active popup's keyboard shortcut
        if (keysym === Clutter.KEY_Escape || keysym === Clutter.KEY_Tab)
            this.fadeAndDestroy();

        // Allow to explicitly select the current item; this is particularly
        // useful for no-modifier popups
        if (keysym === Clutter.KEY_space ||
            keysym === Clutter.KEY_Return ||
            keysym === Clutter.KEY_KP_Enter ||
            keysym === Clutter.KEY_ISO_Enter)
            this._finish(keyEvent.time);

        return Clutter.EVENT_STOP;
    }

    vfunc_key_release_event(keyEvent) {
        if (this._modifierMask) {
            let [x_, y_, mods] = global.get_pointer();
            let state = mods & this._modifierMask;

            if (state == 0)
                this._finish(keyEvent.time);
        } else {
            this._resetNoModsTimeout();
        }

        return Clutter.EVENT_STOP;
    }

    vfunc_button_press_event() {
        /* We clicked outside */
        this.fadeAndDestroy();
        return Clutter.EVENT_PROPAGATE;
    }

    _scrollHandler(direction) {
        if (direction == Clutter.ScrollDirection.UP)
            this._select(this._previous());
        else if (direction == Clutter.ScrollDirection.DOWN)
            this._select(this._next());
    }

    vfunc_scroll_event(scrollEvent) {
        this._disableHover();

        this._scrollHandler(scrollEvent.direction);
        return Clutter.EVENT_PROPAGATE;
    }

    _itemActivatedHandler(n) {
        this._select(n);
    }

    _itemActivated(switcher, n) {
        this._itemActivatedHandler(n);
        this._finish(global.get_current_time());
    }

    _itemEnteredHandler(n) {
        this._select(n);
    }

    _itemEntered(switcher, n) {
        if (!this.mouseActive)
            return;
        this._itemEnteredHandler(n);
    }

    _itemRemovedHandler(n) {
        if (this._items.length > 0) {
            let newIndex;

            if (n < this._selectedIndex)
                newIndex = this._selectedIndex - 1;
            else if (n === this._selectedIndex)
                newIndex = Math.min(n, this._items.length - 1);
            else if (n > this._selectedIndex)
                return; // No need to select something new in this case

            this._select(newIndex);
        } else {
            this.fadeAndDestroy();
        }
    }

    _itemRemoved(switcher, n) {
        this._itemRemovedHandler(n);
    }

    _disableHover() {
        this.mouseActive = false;

        if (this._motionTimeoutId != 0)
            GLib.source_remove(this._motionTimeoutId);

        this._motionTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DISABLE_HOVER_TIMEOUT, this._mouseTimedOut.bind(this));
        GLib.Source.set_name_by_id(this._motionTimeoutId, '[gnome-shell] this._mouseTimedOut');
    }

    _mouseTimedOut() {
        this._motionTimeoutId = 0;
        this.mouseActive = true;
        return GLib.SOURCE_REMOVE;
    }

    _resetNoModsTimeout() {
        if (this._noModsTimeoutId != 0)
            GLib.source_remove(this._noModsTimeoutId);

        this._noModsTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            NO_MODS_TIMEOUT,
            () => {
                this._finish(global.display.get_current_time_roundtrip());
                this._noModsTimeoutId = 0;
                return GLib.SOURCE_REMOVE;
            });
    }

    _popModal() {
        if (this._haveModal) {
            Main.popModal(this);
            this._haveModal = false;
        }
    }

    fadeAndDestroy() {
        this._popModal();
        if (this.opacity > 0) {
            this.ease({
                opacity: 0,
                duration: POPUP_FADE_OUT_TIME,
                mode: Clutter.Animation.EASE_OUT_QUAD,
                onComplete: () => this.destroy(),
            });
        } else {
            this.destroy();
        }
    }

    _finish(_timestamp) {
        this.fadeAndDestroy();
    }

    _onDestroy() {
        this._popModal();

        Main.layoutManager.disconnect(this._systemModalOpenedId);

        if (this._motionTimeoutId != 0)
            GLib.source_remove(this._motionTimeoutId);
        if (this._initialDelayTimeoutId != 0)
            GLib.source_remove(this._initialDelayTimeoutId);
        if (this._noModsTimeoutId != 0)
            GLib.source_remove(this._noModsTimeoutId);

        // Make sure the SwitcherList is always destroyed, it may not be
        // a child of the actor at this point.
        if (this._switcherList)
            this._switcherList.destroy();
    }

    _select(num) {
        this._selectedIndex = num;
        this._switcherList.highlight(num);
    }
});

var SwitcherButton = GObject.registerClass(
class SwitcherButton extends St.Button {
    _init(square) {
        super._init({ style_class: 'item-box',
                      important: true,
                      reactive: true });

        this._square = square;
    }

    vfunc_get_preferred_width(forHeight) {
        if (this._square)
            return this.get_preferred_height(-1);
        else
            return super.vfunc_get_preferred_width(forHeight);
    }
});

var SwitcherList = GObject.registerClass({
    Signals: { 'item-activated': { param_types: [GObject.TYPE_INT] },
               'item-entered': { param_types: [GObject.TYPE_INT] },
               'item-removed': { param_types: [GObject.TYPE_INT] } },
}, class SwitcherList extends St.Widget {
    _init(squareItems) {
        super._init({ style_class: 'input-switcher-list',
                      important: true,
        });

        this._list = new St.BoxLayout({ style_class: 'input-switcher-list-item-container',
                                        vertical: false,
                                        important: true,
                                        x_expand: true,
                                        y_expand: true });

        let layoutManager = this._list.get_layout_manager();

        this._list.spacing = 0;
        this._list.connect('style-changed', () => {
            this._list.spacing = this._list.get_theme_node().get_length('spacing');
        });

        this._scrollView = new St.ScrollView({ style_class: 'hfade',
                                               enable_mouse_scrolling: false });
        this._scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.NEVER);

        this._scrollView.add_actor(this._list);
        this.add_actor(this._scrollView);

        // Those arrows indicate whether scrolling in one direction is possible
        this._leftArrow = new St.DrawingArea({ style_class: 'switcher-arrow',
                                               pseudo_class: 'highlighted' });
        this._leftArrow.connect('repaint', () => {
            drawArrow(this._leftArrow, St.Side.LEFT);
        });
        this._rightArrow = new St.DrawingArea({ style_class: 'switcher-arrow',
                                                pseudo_class: 'highlighted' });
        this._rightArrow.connect('repaint', () => {
            drawArrow(this._rightArrow, St.Side.RIGHT);
        });

        this.add_actor(this._leftArrow);
        this.add_actor(this._rightArrow);

        this._items = [];
        this._highlighted = -1;
        this._squareItems = squareItems;
        this._scrollableRight = true;
        this._scrollableLeft = false;

        layoutManager.homogeneous = squareItems;
    }

    addItem(item, label) {
        let bbox = new SwitcherButton(this._squareItems);

        bbox.set_child(item);
        this._list.add_actor(bbox);

        bbox.connect('clicked', () => this._onItemClicked(bbox));
        bbox.connect('motion-event', () => this._onItemEnter(bbox));

        bbox.label_actor = label;

        this._items.push(bbox);

        return bbox;
    }

    removeItem(index) {
        let item = this._items.splice(index, 1);
        item[0].destroy();
        this.emit('item-removed', index);
    }

    addAccessibleState(index, state) {
        this._items[index].add_accessible_state(state);
    }

    removeAccessibleState(index, state) {
        this._items[index].remove_accessible_state(state);
    }

    _onItemClicked(item) {
        this._itemActivated(this._items.indexOf(item));
    }

    _onItemEnter(item) {
        // Avoid reentrancy
        if (item !== this._items[this._highlighted])
            this._itemEntered(this._items.indexOf(item));

        return Clutter.EVENT_PROPAGATE;
    }

    highlight(index, justOutline) {
        if (this._items[this._highlighted]) {
            this._items[this._highlighted].remove_style_pseudo_class('outlined');
            this._items[this._highlighted].remove_style_pseudo_class('selected');
        }

        if (this._items[index]) {
            if (justOutline)
                this._items[index].add_style_pseudo_class('outlined');
            else
                this._items[index].add_style_pseudo_class('selected');
        }

        this._highlighted = index;

        let adjustment = this._scrollView.hscroll.adjustment;
        let [value] = adjustment.get_values();
        let [absItemX] = this._items[index].get_transformed_position();
        let [result_, posX, posY_] = this.transform_stage_point(absItemX, 0);
        let [containerWidth] = this.get_transformed_size();
        if (posX + this._items[index].get_width() > containerWidth)
            this._scrollToRight(index);
        else if (this._items[index].allocation.x1 - value < 0)
            this._scrollToLeft(index);

    }

    _scrollToLeft(index) {
        let adjustment = this._scrollView.hscroll.adjustment;
        let [value, lower_, upper, stepIncrement_, pageIncrement_, pageSize] = adjustment.get_values();

        let item = this._items[index];

        if (item.allocation.x1 < value)
            value = Math.max(0, item.allocation.x1);
        else if (item.allocation.x2 > value + pageSize)
            value = Math.min(upper, item.allocation.x2 - pageSize);

        this._scrollableRight = true;
        adjustment.ease(value, {
            progress_mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            duration: POPUP_SCROLL_TIME,
            onComplete: () => {
                if (index === 0)
                    this._scrollableLeft = false;
                this.queue_relayout();
            },
        });
    }

    _scrollToRight(index) {
        let adjustment = this._scrollView.hscroll.adjustment;
        let [value, lower_, upper, stepIncrement_, pageIncrement_, pageSize] = adjustment.get_values();

        let item = this._items[index];

        if (item.allocation.x1 < value)
            value = Math.max(0, item.allocation.x1);
        else if (item.allocation.x2 > value + pageSize)
            value = Math.min(upper, item.allocation.x2 - pageSize);

        this._scrollableLeft = true;
        adjustment.ease(value, {
            progress_mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            duration: POPUP_SCROLL_TIME,
            onComplete: () => {
                if (index === this._items.length - 1)
                    this._scrollableRight = false;
                this.queue_relayout();
            },
        });
    }

    _itemActivated(n) {
        this.emit('item-activated', n);
    }

    _itemEntered(n) {
        this.emit('item-entered', n);
    }

    _maxChildWidth(forHeight) {
        let maxChildMin = 0;
        let maxChildNat = 0;

        for (let i = 0; i < this._items.length; i++) {
            let [childMin, childNat] = this._items[i].get_preferred_width(forHeight);
            maxChildMin = Math.max(childMin, maxChildMin);
            maxChildNat = Math.max(childNat, maxChildNat);

            if (this._squareItems) {
                [childMin, childNat] = this._items[i].get_preferred_height(-1);
                maxChildMin = Math.max(childMin, maxChildMin);
                maxChildNat = Math.max(childNat, maxChildNat);
            }
        }

        return [maxChildMin, maxChildNat];
    }

    vfunc_get_preferred_width(forHeight) {
        let themeNode = this.get_theme_node();
        let [maxChildMin] = this._maxChildWidth(forHeight);
        let [minListWidth] = this._list.get_preferred_width(forHeight);

        return themeNode.adjust_preferred_width(maxChildMin, minListWidth);
    }

    vfunc_get_preferred_height(_forWidth) {
        let maxChildMin = 0;
        let maxChildNat = 0;

        for (let i = 0; i < this._items.length; i++) {
            let [childMin, childNat] = this._items[i].get_preferred_height(-1);
            maxChildMin = Math.max(childMin, maxChildMin);
            maxChildNat = Math.max(childNat, maxChildNat);
        }

        if (this._squareItems) {
            let [childMin] = this._maxChildWidth(-1);
            maxChildMin = Math.max(childMin, maxChildMin);
            maxChildNat = maxChildMin;
        }

        let themeNode = this.get_theme_node();
        return themeNode.adjust_preferred_height(maxChildMin, maxChildNat);
    }

    vfunc_allocate(box, flags) {
        this.set_allocation(box, flags);

        let contentBox = this.get_theme_node().get_content_box(box);
        let width = contentBox.x2 - contentBox.x1;
        let height = contentBox.y2 - contentBox.y1;

        let leftPadding = this.get_theme_node().get_padding(St.Side.LEFT);
        let rightPadding = this.get_theme_node().get_padding(St.Side.RIGHT);

        let [minListWidth] = this._list.get_preferred_width(height);

        let childBox = new Clutter.ActorBox();
        let scrollable = minListWidth > width;

        this._scrollView.allocate(contentBox, flags);

        let arrowWidth = Math.floor(leftPadding / 3);
        let arrowHeight = arrowWidth * 2;
        childBox.x1 = leftPadding / 2;
        childBox.y1 = this.height / 2 - arrowWidth;
        childBox.x2 = childBox.x1 + arrowWidth;
        childBox.y2 = childBox.y1 + arrowHeight;
        this._leftArrow.allocate(childBox, flags);
        this._leftArrow.opacity = this._scrollableLeft && scrollable ? 255 : 0;

        arrowWidth = Math.floor(rightPadding / 3);
        arrowHeight = arrowWidth * 2;
        childBox.x1 = this.width - arrowWidth - rightPadding / 2;
        childBox.y1 = this.height / 2 - arrowWidth;
        childBox.x2 = childBox.x1 + arrowWidth;
        childBox.y2 = childBox.y1 + arrowHeight;
        this._rightArrow.allocate(childBox, flags);
        this._rightArrow.opacity = this._scrollableRight && scrollable ? 255 : 0;
    }
});

function drawArrow(area, side) {
    let themeNode = area.get_theme_node();
    let borderColor = themeNode.get_border_color(side);
    let bodyColor = themeNode.get_foreground_color();

    let [width, height] = area.get_surface_size();
    let cr = area.get_context();

    cr.setLineWidth(1.0);
    Clutter.cairo_set_source_color(cr, borderColor);

    switch (side) {
    case St.Side.TOP:
        cr.moveTo(0, height);
        cr.lineTo(Math.floor(width * 0.5), 0);
        cr.lineTo(width, height);
        break;

    case St.Side.BOTTOM:
        cr.moveTo(width, 0);
        cr.lineTo(Math.floor(width * 0.5), height);
        cr.lineTo(0, 0);
        break;

    case St.Side.LEFT:
        cr.moveTo(width, height);
        cr.lineTo(0, Math.floor(height * 0.5));
        cr.lineTo(width, 0);
        break;

    case St.Side.RIGHT:
        cr.moveTo(0, 0);
        cr.lineTo(width, Math.floor(height * 0.5));
        cr.lineTo(0, height);
        break;
    }

    cr.strokePreserve();

    Clutter.cairo_set_source_color(cr, bodyColor);
    cr.fill();
    cr.$dispose();
}

