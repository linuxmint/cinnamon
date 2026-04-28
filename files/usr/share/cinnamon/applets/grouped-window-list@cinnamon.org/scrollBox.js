const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const { SignalManager } = imports.misc.signalManager;

const EDGE_SCROLL_ZONE_SIZE = 48;
const SLIDE_SPEED = 8;
const SLIDE_INTERVAL = 16;

var ScrollBox = class ScrollBox {
    constructor(state) {
        this.state = state;
        this.signals = new SignalManager(null);

        this.scrollView = new St.ScrollView({
            style_class: 'grouped-window-list-scrollbox-scrollview',
            x_expand: true,
            y_expand: true,
            reactive: true,
        });

        this.scrollView.set_auto_scrolling(false);
        this.scrollView.set_mouse_scrolling(true);
        this.scrollView.set_clip_to_allocation(true);
        this.scrollView.set_policy(St.PolicyType.EXTERNAL, St.PolicyType.EXTERNAL);

        this.container = new St.BoxLayout({
            vertical: !this.state.isHorizontal,
            style_class: 'grouped-window-list-scrollbox-container',
        });

        this.scrollView.add_actor(this.container);

        // Slider buttons
        this.startButton = new St.Bin({
            style_class: 'grouped-window-list-scrollbox-button-start',
            visible: false,
            reactive: true,
            can_focus: true,
            track_hover: true,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });
        this.endButton = new St.Bin({
            style_class: 'grouped-window-list-scrollbox-button-end',
            visible: false,
            reactive: true,
            can_focus: true,
            track_hover: true,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });
        this.startIcon = new St.Icon({
            icon_name: 'xsi-pan-start-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            style_class: 'popup-menu-icon grouped-window-list-scrollbox-button-icon'
        });
        this.endIcon = new St.Icon({
            icon_name: 'xsi-pan-end-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            style_class: 'popup-menu-icon grouped-window-list-scrollbox-button-icon'
        });
        this.startButton.set_child(this.startIcon);
        this.endButton.set_child(this.endIcon);

        // Wrapper actor: [startButton] [scrollView] [endButton]
        const managerOrientation = this.state.isHorizontal
            ? Clutter.Orientation.HORIZONTAL : Clutter.Orientation.VERTICAL;
        this.mainLayout = new Clutter.BoxLayout({ orientation: managerOrientation });
        this.actor = new Clutter.Actor({
            layout_manager: this.mainLayout,
            reactive: true,
            x_expand: true,
            y_expand: true
        });

        this.actor.add_child(this.startButton);
        this.actor.add_child(this.scrollView);
        this.actor.add_child(this.endButton);

        this.slideTimerSourceId = 0;
        this.slideDirection = 0;
        this.scrollActiveTimeoutId = 0;

        // Slider button signals
        this.signals.connect(this.startButton, 'enter-event', () => {
            if (!this.state.settings.enableClickToSlide)
                this._startSlide(-1);
        });
        this.signals.connect(this.startButton, 'leave-event', () => {
            this._stopSlide();
            this.startButton.remove_style_pseudo_class('active');
        });
        this.signals.connect(this.endButton, 'enter-event', () => {
            if (!this.state.settings.enableClickToSlide)
                this._startSlide(1);
        });
        this.signals.connect(this.endButton, 'leave-event', () => {
            this._stopSlide();
            this.endButton.remove_style_pseudo_class('active');
        });
        this.signals.connect(this.startButton, 'button-press-event', (actor, event) => {
            if (event.get_button() !== 1) return Clutter.EVENT_PROPAGATE;
            if (this.state.settings.enableClickToSlide) {
                this.startButton.add_style_pseudo_class('active');
                this._startSlide(-1);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this.signals.connect(this.startButton, 'button-release-event', (actor, event) => {
            if (event.get_button() !== 1) return Clutter.EVENT_PROPAGATE;
            this.startButton.remove_style_pseudo_class('active');
            if (this.state.settings.enableClickToSlide) {
                this._stopSlide();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this.signals.connect(this.endButton, 'button-press-event', (actor, event) => {
            if (event.get_button() !== 1) return Clutter.EVENT_PROPAGATE;
            if (this.state.settings.enableClickToSlide) {
                this.endButton.add_style_pseudo_class('active');
                this._startSlide(1);
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        this.signals.connect(this.endButton, 'button-release-event', (actor, event) => {
            if (event.get_button() !== 1) return Clutter.EVENT_PROPAGATE;
            this.endButton.remove_style_pseudo_class('active');
            if (this.state.settings.enableClickToSlide) {
                this._stopSlide();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        // Scroll view signals
        this.signals.connect(this.scrollView, 'scroll-event', (actor, event) => this._onScroll(actor, event));
        this.signals.connect(this.scrollView, 'motion-event', (actor, event) => this._onMotionEvent(actor, event));
        this.signals.connect(this.scrollView, 'leave-event', () => this._stopSlide());

        // Track content size changes
        this.signals.connect(this.container, 'allocation-changed', () => this.updateScrollButtonVisibility());

        this.stateConnectionID = this.state.connect({
            orientation: (state) => this.on_orientation_changed()
        });

        this.on_orientation_changed();
        this._connectAdjustmentSignals();
    }

    destroy() {
        this._stopSlide();
        this._disconnectAdjustmentSignals();
        if (this.stateConnectionID) {
            this.state.disconnect(this.stateConnectionID);
        }
        this.signals.disconnectAllSignals();
        this.actor.destroy();
    }

    _connectAdjustmentSignals() {
        this._disconnectAdjustmentSignals();

        const adjustment = this._getScrollAdjustment();

        if (!adjustment) return;

        this._currentAdjustment = adjustment;
        this._adjustmentValueSigId = adjustment.connect('notify::value', () => this.updateScrollButtonVisibility());
        this._adjustmentChangedSigId = adjustment.connect('changed', () => this.updateScrollButtonVisibility());
    }

    _disconnectAdjustmentSignals() {
        if (this._adjustmentValueSigId && this._currentAdjustment) {
            this._currentAdjustment.disconnect(this._adjustmentValueSigId);
            this._adjustmentValueSigId = 0;
        }
        if (this._adjustmentChangedSigId && this._currentAdjustment) {
            this._currentAdjustment.disconnect(this._adjustmentChangedSigId);
            this._adjustmentChangedSigId = 0;
        }
        this._currentAdjustment = null;
    }

    on_orientation_changed() {
        this.container.vertical = !this.state.isHorizontal;

        const managerOrientation = this.state.isHorizontal
            ? Clutter.Orientation.HORIZONTAL : Clutter.Orientation.VERTICAL;
        this.mainLayout.set_orientation(managerOrientation);

        if (this.state.isHorizontal) {
            this.scrollView.set_policy(St.PolicyType.EXTERNAL, St.PolicyType.EXTERNAL);
            this.scrollView.remove_style_class_name('vfade');
            this.scrollView.add_style_class_name('hfade');

            this.startIcon.set_icon_name('xsi-pan-start-symbolic');
            this.endIcon.set_icon_name('xsi-pan-end-symbolic');

            this.startButton.set_x_expand(false);
            this.startButton.set_y_expand(true);
            this.startButton.set_y_align(Clutter.ActorAlign.FILL);
            this.endButton.set_x_expand(false);
            this.endButton.set_y_expand(true);
            this.endButton.set_y_align(Clutter.ActorAlign.FILL);
        } else {
            this.scrollView.set_policy(St.PolicyType.NEVER, St.PolicyType.EXTERNAL);
            this.scrollView.remove_style_class_name('hfade');
            this.scrollView.add_style_class_name('vfade');

            this.startIcon.set_icon_name('xsi-pan-up-symbolic');
            this.endIcon.set_icon_name('xsi-pan-down-symbolic');

            this.startButton.set_x_expand(true);
            this.startButton.set_y_expand(false);
            this.startButton.set_x_align(Clutter.ActorAlign.FILL);
            this.endButton.set_x_expand(true);
            this.endButton.set_y_expand(false);
            this.endButton.set_x_align(Clutter.ActorAlign.FILL);
        }

        this._connectAdjustmentSignals();
        this.updateScrollButtonVisibility();
    }

    _getFadeOffset() {
        const fade_eff = this.scrollView.get_effect('fade');

        let fade_offset = 0;
        if (fade_eff) {
            fade_offset = this.state.isHorizontal ? fade_eff.hfade_offset : fade_eff.vfade_offset;
        }

        return fade_offset > 0 ? fade_offset : EDGE_SCROLL_ZONE_SIZE * global.ui_scale;
    }

    scrollToChild(childActor) {
        if (!childActor || !childActor.has_allocation()) return;

        // Get allocation of child relative to container
        const allocation = childActor.get_allocation_box();

        // Child coordinates
        let c1, c2;

        const isHorizontal = this.state.isHorizontal;
        let adjustment;

        if (isHorizontal) {
            c1 = allocation.x1;
            c2 = allocation.x2;
            const hBar = this.scrollView.get_hscroll_bar();
            if (hBar) adjustment = hBar.get_adjustment();
        } else {
            c1 = allocation.y1;
            c2 = allocation.y2;
            const vBar = this.scrollView.get_vscroll_bar();
            if (vBar) adjustment = vBar.get_adjustment();
        }

        if (adjustment) {
            const current = adjustment.value;
            const page_size = adjustment.page_size;

            let fade_offset = this._getFadeOffset() / 2;

            if (c1 < current + fade_offset || c2 > current + page_size - fade_offset) {
                const newValue = (c1 + c2) / 2 - page_size / 2;
                adjustment.value = Math.max(adjustment.lower, Math.min(newValue, adjustment.upper - page_size));
            }
        }
    }

    updateScrollButtonVisibility() {
        const adjustment = this._getScrollAdjustment();
        if (!adjustment) {
            this.startButton.visible = false;
            this.endButton.visible = false;
            return;
        }

        const canScroll = adjustment.upper > adjustment.page_size;
        if (canScroll) {
            // Tolerance of 1 pixel to avoid flickering
            this.startButton.visible = adjustment.value > adjustment.lower + 1;
            this.endButton.visible = adjustment.value < adjustment.upper - adjustment.page_size - 1;
        } else {
            this.startButton.visible = false;
            this.endButton.visible = false;
        }
    }

    _startSlide(direction) {
        if (direction === this.slideDirection || this.state.panelEditMode) return;

        this._stopSlide();
        this.slideDirection = direction;
        this.state.scrollActive = true;

        this.slideTimerSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SLIDE_INTERVAL, () => {
            const adjustment = this._getScrollAdjustment();
            if (!adjustment) {
                this.slideTimerSourceId = 0;
                return GLib.SOURCE_REMOVE;
            }

            const newValue = adjustment.value + (SLIDE_SPEED * this.slideDirection * global.ui_scale);
            adjustment.value = Math.max(adjustment.lower,
                Math.min(newValue, adjustment.upper - adjustment.page_size));

            // Stop if we've reached the bounds
            if (this.slideDirection < 0 && adjustment.value <= adjustment.lower) {
                this.slideTimerSourceId = 0;
                return GLib.SOURCE_REMOVE;
            }
            if (this.slideDirection > 0 && adjustment.value >= adjustment.upper - adjustment.page_size) {
                this.slideTimerSourceId = 0;
                return GLib.SOURCE_REMOVE;
            }

            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopSlide() {
        if (this.slideTimerSourceId > 0) {
            GLib.source_remove(this.slideTimerSourceId);
            this.slideTimerSourceId = 0;
        }
        this.slideDirection = 0;

        if (this.scrollActiveTimeoutId) {
            GLib.source_remove(this.scrollActiveTimeoutId);
        }

        this.scrollActiveTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            if (this.slideDirection === 0) {
                this.state.scrollActive = false;
            }
            this.scrollActiveTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _onMotionEvent(actor, event) {
        if (this.state.panelEditMode || this.state.settings.enableClickToSlide)
            return Clutter.EVENT_PROPAGATE;

        const [x, y] = event.get_coords();
        const [actorX, actorY] = actor.get_transformed_position();
        const [actorWidth, actorHeight] = actor.get_transformed_size();

        // Calculate relative position within the actor
        const relX = x - actorX;
        const relY = y - actorY;

        let scrollDirection = 0;
        const adjustment = this._getScrollAdjustment();

        if (!adjustment) return Clutter.EVENT_PROPAGATE;

        // Check if we can scroll (content is larger than view)
        const canScroll = adjustment.upper > adjustment.page_size;

        if (!canScroll) {
            this._stopSlide();
            return Clutter.EVENT_PROPAGATE;
        }

        const fadeOffset = this._getFadeOffset();

        if (this.state.isHorizontal) {
            // Check left edge
            if (relX < fadeOffset && adjustment.value > adjustment.lower) {
                scrollDirection = -1;
            }
            // Check right edge
            else if (relX > actorWidth - fadeOffset &&
                adjustment.value < adjustment.upper - adjustment.page_size) {
                scrollDirection = 1;
            }
        } else {
            // Check top edge
            if (relY < fadeOffset && adjustment.value > adjustment.lower) {
                scrollDirection = -1;
            }
            // Check bottom edge
            else if (relY > actorHeight - fadeOffset &&
                adjustment.value < adjustment.upper - adjustment.page_size) {
                scrollDirection = 1;
            }
        }

        if (scrollDirection !== 0) {
            this._startSlide(scrollDirection);
        } else {
            this._stopSlide();
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _getScrollAdjustment() {
        if (this.state.isHorizontal) {
            const hBar = this.scrollView.get_hscroll_bar();
            return hBar ? hBar.get_adjustment() : null;
        } else {
            const vBar = this.scrollView.get_vscroll_bar();
            return vBar ? vBar.get_adjustment() : null;
        }
    }

    _onScroll(actor, event) {
        if (this.state.panelEditMode) return Clutter.EVENT_PROPAGATE;

        if (this.state.settings.scrollBehavior !== 4) {
            this.state.trigger('handleScroll', event);
            return Clutter.EVENT_STOP;
        }

        // Handle horizontal scrolling with vertical wheel
        if (this.state.isHorizontal) {
            const direction = event.get_scroll_direction();
            let delta = 0;

            const hBar = this.scrollView.get_hscroll_bar();
            if (!hBar) return Clutter.EVENT_PROPAGATE;

            const adjustment = hBar.get_adjustment();
            if (!adjustment) return Clutter.EVENT_PROPAGATE;

            if (direction === Clutter.ScrollDirection.UP) {
                delta = -10 * global.ui_scale;
            } else if (direction === Clutter.ScrollDirection.DOWN) {
                delta = 10 * global.ui_scale;
            } else if (direction === Clutter.ScrollDirection.SMOOTH) {
                const [dx, dy] = event.get_scroll_delta();
                // If pure vertical scroll, map to horizontal
                if (Math.abs(dy) > Math.abs(dx)) {
                    delta = dy * (16 * global.ui_scale); // Scale factor
                } else {
                    // Let StScrollView handle horizontal smooth scroll naturally if it exists
                    return Clutter.EVENT_PROPAGATE;
                }
            } else {
                return Clutter.EVENT_PROPAGATE;
            }

            if (delta !== 0) {
                // Manually updating adjustment value using property
                adjustment.value = adjustment.value + delta;
                return Clutter.EVENT_STOP;
            } else {
                this.updateScrollButtonVisibility();
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }
}
