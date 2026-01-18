const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const { SignalManager } = imports.misc.signalManager;


class AppGroupListScrollBox {
    constructor(state, container) {
        this.state = state;
        this.container = container;
        this.signals = new SignalManager(null);

        const managerOrientation = this.state.isHorizontal ? Clutter.Orientation.HORIZONTAL : Clutter.Orientation.VERTICAL;

        this.mainLayout = new Clutter.BoxLayout({orientation: managerOrientation});
        this.actor = new Clutter.Actor({ layout_manager: this.mainLayout, reactive: true });

        this.startButton = new St.Bin({
            style_class: 'grouped-window-list-scroll-button',
            visible: false,
            reactive: true,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });
        this.endButton = new St.Bin({
            style_class: 'grouped-window-list-scroll-button',
            visible: false,
            reactive: true,
            x_align: St.Align.MIDDLE,
            y_align: St.Align.MIDDLE
        });
        this.startIcon = new St.Icon({
            icon_name: 'pan-start-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            style_class: 'grouped-window-list-scroll-button-icon'
        });
        this.endIcon = new St.Icon({
            icon_name: 'pan-end-symbolic',
            icon_type: St.IconType.SYMBOLIC,
            style_class: 'grouped-window-list-scroll-button-icon'
        });

        this.startButton.set_child(this.startIcon);
        this.endButton.set_child(this.endIcon);

        this.signals.connect(this.startButton, 'enter-event', () => this.startSlide(-1));
        this.signals.connect(this.startButton, 'leave-event', this.stopSlide, this);
        this.signals.connect(this.endButton, 'enter-event', () => this.startSlide(1));
        this.signals.connect(this.endButton, 'leave-event', this.stopSlide, this);

        this.scrollBox = new Clutter.Actor({ clip_to_allocation: true });
        this.scrollBox.add_child(this.container);

        this.actor.add_child(this.startButton);
        this.actor.add_child(this.scrollBox);
        this.actor.add_child(this.endButton);

        this.scrollBox.set_x_expand(true);
        this.scrollBox.set_y_expand(true);

        this.slideTimerSourceId = 0;
        this.updateScrollVisibilityId = 0;

        // Connect all the signals
        this.signals.connect(this.actor, 'allocation-changed', this.updateScrollVisibility, this);
        this.signals.connect(this.container, 'allocation-changed', this.updateScrollVisibility, this);
        this.signals.connect(this.container, 'notify::translation-x', this.updateScrollVisibility, this);
        this.signals.connect(this.container, 'notify::translation-y', this.updateScrollVisibility, this);
        this.signals.connect(this.scrollBox, 'notify::allocation', this.updateScrollVisibility, this);
        this.signals.connect(this.actor, 'scroll-event', (actor, event) => this.onScroll(event));

        this.on_orientation_changed(this.state.orientation);
    }

    on_orientation_changed(orientation) {
        const managerOrientation = this.state.isHorizontal ? Clutter.Orientation.HORIZONTAL : Clutter.Orientation.VERTICAL;

        this.mainLayout.set_orientation(managerOrientation);

        if (this.state.isHorizontal) {
            this.actor.set_x_align(Clutter.ActorAlign.FILL);
            this.startButton.remove_style_class_name('grouped-window-list-scroll-button-top');
            this.endButton.remove_style_class_name('grouped-window-list-scroll-button-down');
            this.startButton.add_style_class_name('grouped-window-list-scroll-button-left');
            this.endButton.add_style_class_name('grouped-window-list-scroll-button-right');
            this.startIcon.set_icon_name('pan-start-symbolic');
            this.endIcon.set_icon_name('pan-end-symbolic');
            this.startButton.set_x_expand(false);
            this.startButton.set_y_expand(true);
            this.startButton.set_y_align(Clutter.ActorAlign.FILL);
            this.endButton.set_x_expand(false);
            this.endButton.set_y_expand(true);
            this.endButton.set_y_align(Clutter.ActorAlign.FILL);
        } else {
            this.actor.set_x_align(Clutter.ActorAlign.CENTER);
            this.startButton.remove_style_class_name('grouped-window-list-scroll-button-left');
            this.endButton.remove_style_class_name('grouped-window-list-scroll-button-right');
            this.startButton.add_style_class_name('grouped-window-list-scroll-button-top');
            this.endButton.add_style_class_name('grouped-window-list-scroll-button-down');
            this.startIcon.set_icon_name('pan-up-symbolic');
            this.endIcon.set_icon_name('pan-down-symbolic');
            this.startButton.set_x_expand(true);
            this.startButton.set_y_expand(false);
            this.startButton.set_x_align(Clutter.ActorAlign.FILL);
            this.endButton.set_x_expand(true);
            this.endButton.set_y_expand(false);
            this.endButton.set_x_align(Clutter.ActorAlign.FILL);
        }
        this.updateScrollVisibility();
    }

    startSlide(direction) {
        if (this.slideTimerSourceId > 0) {
            GLib.source_remove(this.slideTimerSourceId);
            this.slideTimerSourceId = 0;
        }

        if (this.state.panelEditMode) return;

        const scrollFunc = () => {
            this.scroll(direction * 5);
            if (this.slideTimerSourceId === 0) return GLib.SOURCE_REMOVE;

            // Check if reached bounds to stop timer
            let current, min;
            if (this.state.isHorizontal) {
                current = this.container.translation_x;
                min = Math.min(0, this.scrollBox.width - this.container.width);
            } else {
                current = this.container.translation_y;
                min = Math.min(0, this.scrollBox.height - this.container.height);
            }

            // At start, trying to go start
            if (current >= 0 && direction < 0) {
                this.slideTimerSourceId = 0;
                return GLib.SOURCE_REMOVE;
            }

            // At end, trying to go end
            if (current <= min && direction > 0) {
                this.slideTimerSourceId = 0;
                return GLib.SOURCE_REMOVE;
            }

            return GLib.SOURCE_CONTINUE;
        };

        this.slideTimerSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, scrollFunc);
    }

    stopSlide() {
        if (this.slideTimerSourceId > 0) {
            GLib.source_remove(this.slideTimerSourceId);
            this.slideTimerSourceId = 0;
        }
    }

    onScroll(event) {
        if (this.state.panelEditMode) return;

        if (this.state.settings.scrollBehavior !== 4) {
            return Clutter.EVENT_PROPAGATE;
        }

        let containerSize, scrollBoxSize;
        if (this.state.isHorizontal) {
            containerSize = this.container.width || this.container.get_preferred_width(-1)[1];
            scrollBoxSize = this.scrollBox.width;
        } else {
            containerSize = this.container.height || this.container.get_preferred_height(-1)[1];
            scrollBoxSize = this.scrollBox.height;
        }

        if (containerSize <= scrollBoxSize) return Clutter.EVENT_PROPAGATE;

        const direction = event.get_scroll_direction();
        let delta = 0;

        if (direction === Clutter.ScrollDirection.SMOOTH) {
            const [dx, dy] = event.get_scroll_delta();
            delta = this.state.isHorizontal ? dx : dy;
            delta *= 15; // Scale smooth scroll
        } else {
            const step = 20;
            if (direction === Clutter.ScrollDirection.UP || direction === Clutter.ScrollDirection.LEFT) {
                delta = -step;
            } else if (direction === Clutter.ScrollDirection.DOWN || direction === Clutter.ScrollDirection.RIGHT) {
                delta = step;
            }
        }

        if (delta !== 0) {
            this.scroll(delta);
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    scroll(amount) {
        let current, min, next;
        if (this.state.isHorizontal) {
            current = this.container.translation_x;
            min = Math.min(0, this.scrollBox.width - this.container.width);
            next = current - amount;
        } else {
            current = this.container.translation_y;
            min = Math.min(0, this.scrollBox.height - this.container.height);
            next = current - amount;
        }

        if (next > 0) next = 0;
        if (next < min) next = min;

        if (this.state.isHorizontal) this.container.translation_x = next;
        else this.container.translation_y = next;
    }

    updateScrollVisibility() {
        if (this.updateScrollVisibilityId > 0) return;
        this.updateScrollVisibilityId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this._updateScrollVisibility();
            this.updateScrollVisibilityId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    _updateScrollVisibility() {
        if (this.state.panelEditMode) return;

        let containerSize, scrollBoxSize;

        if (this.state.isHorizontal) {
            containerSize = this.container.width > 0 ? this.container.width : this.container.get_preferred_width(-1)[1];
            scrollBoxSize = this.scrollBox.width;
        } else {
            containerSize = this.container.height > 0 ? this.container.height : this.container.get_preferred_height(-1)[1];
            scrollBoxSize = this.scrollBox.height;
        }

        let minTranslation = Math.min(0, scrollBoxSize - containerSize);
        let currentTranslation = this.state.isHorizontal ? this.container.translation_x : this.container.translation_y;

        // Clamp translation if bounds have changed (resizing, etc)
        if (currentTranslation < minTranslation) {
            currentTranslation = minTranslation;
            if (this.state.isHorizontal) this.container.translation_x = currentTranslation;
            else this.container.translation_y = currentTranslation;
        }

        if (containerSize > scrollBoxSize) {
            // Some tolerance to avoid flickering
            this.startButton.visible = currentTranslation < -0.1;
            this.endButton.visible = currentTranslation > minTranslation + 0.1;
        } else {
            this.startButton.visible = false;
            this.endButton.visible = false;

            if (currentTranslation !== 0) {
                if (this.state.isHorizontal) this.container.translation_x = 0;
                else this.container.translation_y = 0;
            }
        }
    }

    scrollToChild(childActor) {
        if (this.state.panelEditMode) return;

        if (!childActor || childActor.get_parent() !== this.container) return;

        const isHorizontal = this.state.isHorizontal;

        let containerSize, boxSize;
        if (isHorizontal) {
            containerSize = this.container.width > 0 ? this.container.width : this.container.get_preferred_width(-1)[1];
            boxSize = this.scrollBox.width;
        } else {
            containerSize = this.container.height > 0 ? this.container.height : this.container.get_preferred_height(-1)[1];
            boxSize = this.scrollBox.height;
        }

        if (containerSize <= boxSize) return;

        let targetCenter = 0;
        let allocationValid = false;

        if (childActor.has_allocation()) {
            const box = childActor.get_allocation_box();
            const size = isHorizontal ? box.get_width() : box.get_height();

            if (size > 0) {
                targetCenter = (isHorizontal ? box.x1 : box.y1) + (size / 2);
                allocationValid = true;
            }
        }

        if (!allocationValid) {
            const children = this.container.get_children();
            const index = children.indexOf(childActor);

            if (index === -1) return;

            let itemPos = 0;
            let itemSize = 0;

            for (let i = 0; i <= index; i++) {
                const actor = children[i];

                if (isHorizontal) {
                    itemSize = actor.width > 0 ? actor.width : actor.get_preferred_width(-1)[1];
                } else {
                    itemSize = actor.height > 0 ? actor.height : actor.get_preferred_height(-1)[1];
                }

                itemPos += itemSize;
            }

            targetCenter = itemPos - (itemSize / 2);
        }

        // We want targetCenter to be at boxSize / 2
        let newPos = (boxSize / 2) - targetCenter;

        const minPos = Math.min(0, boxSize - containerSize);
        newPos = Math.round(Math.max(minPos, Math.min(newPos, 0)) * 100) / 100;

        if (isHorizontal) {
            this.container.translation_x = newPos;
        } else {
            this.container.translation_y = newPos;
        }
    }

    destroy() {
        this.signals.disconnectAllSignals();
        if (this.slideTimerSourceId > 0) {
            GLib.source_remove(this.slideTimerSourceId);
            this.slideTimerSourceId = 0;
        }

        if (this.updateScrollVisibilityId > 0) {
            GLib.source_remove(this.updateScrollVisibilityId);
            this.updateScrollVisibilityId = 0;
        }

        this.actor.destroy();
    }
}

module.exports = AppGroupListScrollBox;
