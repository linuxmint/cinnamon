const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const { SignalManager } = imports.misc.signalManager;

const EDGE_SCROLL_ZONE_SIZE = 68;
const EDGE_SCROLL_SPEED = 8;
const EDGE_SCROLL_INTERVAL = 16;

class ScrollBox {
    constructor(state) {
        this.state = state;
        this.signals = new SignalManager(null);

        this.actor = new St.ScrollView({
            x_expand: true,
            y_expand: true,
            reactive: true
        });

        this.actor.set_auto_scrolling(false);
        this.actor.set_mouse_scrolling(true);
        this.actor.set_clip_to_allocation(true);
        this.actor.set_policy(St.PolicyType.EXTERNAL, St.PolicyType.EXTERNAL);

        this.box = new St.BoxLayout({
            vertical: !this.state.isHorizontal,
            style_class: 'grouped-window-list-scrollbox-container'
        });

        this.actor.add_actor(this.box);

        this.edgeScrollTimeoutId = 0;
        this.edgeScrollDirection = 0;
        this.scrollActiveTimeoutId = 0;

        this.signals.connect(this.actor, 'scroll-event', (actor, event) => this._onScroll(actor, event));

        this.signals.connect(this.actor, 'motion-event', (actor, event) => this._onMotionEvent(actor, event));
        this.signals.connect(this.actor, 'leave-event', () => this._stopEdgeScroll());

        this.stateConnectionID = this.state.connect({
            orientation: (state) => this.on_orientation_changed()
        });

        this.on_orientation_changed();
    }

    destroy() {
        this._stopEdgeScroll();
        if (this.stateConnectionID) {
            this.state.disconnect(this.stateConnectionID);
        }
        this.signals.disconnectAllSignals();
        this.actor.destroy();
    }

    on_orientation_changed() {
        this.box.vertical = !this.state.isHorizontal;
        if (this.state.isHorizontal) {
            this.actor.set_policy(St.PolicyType.EXTERNAL, St.PolicyType.EXTERNAL);
            this.actor.style_class = 'grouped-window-list-scrollbox hfade';
        } else {
            this.actor.set_policy(St.PolicyType.NEVER, St.PolicyType.EXTERNAL);
            this.actor.style_class = 'grouped-window-list-scrollbox vfade';
        }
    }

    scrollToChild(childActor) {
        if (!childActor) return;

        // Get allocation of child relative to container
        const allocation = childActor.get_allocation_box();

        // Child coordinates
        let c1, c2;

        const isHorizontal = this.state.isHorizontal;
        let adjustment;

        if (isHorizontal) {
            c1 = allocation.x1;
            c2 = allocation.x2;
            const hBar = this.actor.get_hscroll_bar();
            if (hBar) adjustment = hBar.get_adjustment();
        } else {
            c1 = allocation.y1;
            c2 = allocation.y2;
            const vBar = this.actor.get_vscroll_bar();
            if (vBar) adjustment = vBar.get_adjustment();
        }

        if (adjustment) {
            const current = adjustment.value;
            const page_size = adjustment.page_size;

            let fade_offset = 30;

            const fade_eff = this.actor.get_effect('fade');

            if (fade_eff) {
                fade_offset = this.state.isHorizontal ? fade_eff.hfade_offset : fade_eff.vfade_offset;
            }

            if (c1 < current + fade_offset || c2 > current + page_size - fade_offset) {
                const newValue = (c1 + c2) / 2 - page_size / 2;
                adjustment.value = Math.max(adjustment.lower, Math.min(newValue, adjustment.upper - page_size));
            }
        }
    }

    _onMotionEvent(actor, event) {
        if (this.state.panelEditMode) return Clutter.EVENT_PROPAGATE;

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
            this._stopEdgeScroll();
            return Clutter.EVENT_PROPAGATE;
        }

        if (this.state.isHorizontal) {
            // Check left edge
            if (relX < EDGE_SCROLL_ZONE_SIZE && adjustment.value > adjustment.lower) {
                scrollDirection = -1;
            }
            // Check right edge
            else if (relX > actorWidth - EDGE_SCROLL_ZONE_SIZE &&
                adjustment.value < adjustment.upper - adjustment.page_size) {
                scrollDirection = 1;
            }
        } else {
            // Check top edge
            if (relY < EDGE_SCROLL_ZONE_SIZE && adjustment.value > adjustment.lower) {
                scrollDirection = -1;
            }
            // Check bottom edge
            else if (relY > actorHeight - EDGE_SCROLL_ZONE_SIZE &&
                adjustment.value < adjustment.upper - adjustment.page_size) {
                scrollDirection = 1;
            }
        }

        if (scrollDirection !== 0 && scrollDirection !== this.edgeScrollDirection) {
            this._startEdgeScroll(scrollDirection);
        } else if (scrollDirection === 0) {
            this._stopEdgeScroll();
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _getScrollAdjustment() {
        if (this.state.isHorizontal) {
            const hBar = this.actor.get_hscroll_bar();
            return hBar ? hBar.get_adjustment() : null;
        } else {
            const vBar = this.actor.get_vscroll_bar();
            return vBar ? vBar.get_adjustment() : null;
        }
    }

    _startEdgeScroll(direction) {
        this._stopEdgeScroll();
        this.edgeScrollDirection = direction;
        this.state.scrollActive = true;

        this.edgeScrollTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, EDGE_SCROLL_INTERVAL, () => {
            const adjustment = this._getScrollAdjustment();
            if (!adjustment) {
                this.edgeScrollTimeoutId = 0;
                return GLib.SOURCE_REMOVE;
            }

            const newValue = adjustment.value + (EDGE_SCROLL_SPEED * this.edgeScrollDirection * global.ui_scale);

            // Clamp value to valid range
            adjustment.value = Math.max(adjustment.lower,
                Math.min(newValue, adjustment.upper - adjustment.page_size));

            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopEdgeScroll() {
        if (this.edgeScrollTimeoutId > 0) {
            GLib.source_remove(this.edgeScrollTimeoutId);
            this.edgeScrollTimeoutId = 0;
        }
        this.edgeScrollDirection = 0;

        if (this.scrollActiveTimeoutId) {
            GLib.source_remove(this.scrollActiveTimeoutId);
        }

        this.scrollActiveTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            if (this.edgeScrollDirection === 0) {
                this.state.scrollActive = false;
            }
            this.scrollActiveTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _onScroll(actor, event) {
        if (this.state.panelEditMode) return Clutter.EVENT_PROPAGATE;

        // Handle horizontal scrolling with vertical wheel
        if (this.state.isHorizontal) {
            const direction = event.get_scroll_direction();
            let delta = 0;

            const hBar = this.actor.get_hscroll_bar();
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
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }
}

module.exports = ScrollBox;
