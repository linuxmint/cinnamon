const Applet = imports.ui.applet;
const Lang = imports.lang;
const Main = imports.ui.main;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Urgency = imports.ui.messageTray.Urgency;
const MessageTray = imports.ui.messageTray;
const NotificationDestroyedReason = imports.ui.messageTray.NotificationDestroyedReason;
const Settings = imports.ui.settings;
const Gettext = imports.gettext.domain("cinnamon-applets");
const Util = imports.misc.util;
const SignalManager = imports.misc.signalManager;

const PANEL_EDIT_MODE_KEY = "panel-edit-mode";

// Stands in for a row's height until any row has been measured.
const FALLBACK_ROW_HEIGHT = 64;
// Rows kept attached beyond the viewport on each side.
const OVERSCAN_ROWS = 10;
// Floor for the attached-row cap. The cap itself scales with the viewport: a menu on a rotated
// monitor is tall enough to show more rows than any fixed number worth picking.
const MIN_ATTACHED = 60;
// Delay before the idle attach pass starts, so an open-then-close costs nothing.
const IDLE_START_DELAY_MS = 300;
// Per-turn time budget for the idle pass, so cost never depends on per-row cost.
const IDLE_BUDGET_US = 5000;

class CinnamonNotificationsApplet extends Applet.TextIconApplet {
    constructor(metadata, orientation, panel_height, instanceId) {
        super(orientation, panel_height, instanceId);

        this.setAllowedLayout(Applet.AllowedLayout.BOTH);

        this.settings = new Settings.AppletSettings(this, metadata.uuid, instanceId);
        this._interfaceSettings = new Gio.Settings({schema_id: 'org.cinnamon.desktop.interface'});
        this.settings.bind("ignoreTransientNotifications", "ignoreTransientNotifications");
        this.settings.bind("showEmptyTray", "showEmptyTray", this._show_hide_tray);
        this.settings.bind("keyOpen", "keyOpen", this._setKeybinding);
        this.settings.bind("keyClear", "keyClear", this._setKeybinding);
        this.settings.bind("showNotificationCount", "showNotificationCount", this.update_list);
        this.settings.bind("showNewestFirst", "showNewestFirst", this.update_list);
        this._setKeybinding();

        this._orientation = orientation;
        this.menuManager = new PopupMenu.PopupMenuManager(this);
        this.menu = new Applet.AppletPopupMenu(this, orientation);
        this.menuManager.addMenu(this.menu);

        this.notifications = [];    // The list of notifications, in order from oldest to newest.

        this.signals = new SignalManager.SignalManager(null);
        this.signals.connect(Main.messageTray, 'notify-applet-update', this._notification_added.bind(this));
        this.signals.connect(global.settings, 'changed::' + PANEL_EDIT_MODE_KEY, this._on_panel_edit_mode_changed.bind(this));

        this._blinking = false;
        this._blink_toggle = false;
        this._blinkTimeoutId = 0;

        this._display();
    }

    _setKeybinding() {
        Main.keybindingManager.addXletHotKey(this, "notification-open", this.keyOpen, Lang.bind(this, this._openMenu));
        Main.keybindingManager.addXletHotKey(this, "notification-clear", this.keyClear, Lang.bind(this, this._clear_all));
    }

    on_applet_removed_from_panel () {
        this._stop_blinking();
        Main.keybindingManager.removeXletHotKey(this, "notification-open");
        Main.keybindingManager.removeXletHotKey(this, "notification-clear");

        MessageTray.extensionsHandlingNotifications--;
        try {
            if (MessageTray.extensionsHandlingNotifications === 0) {
                this._clear_all();
            }
        } finally {
            // Every teardown step below runs even if _clear_all() threw. Removal has to be
            // total: leaving the menu behind here is the leak this applet used to have.
            // Left connected, a later destroy() would re-enter update_list() on a destroyed list.
            for (let n of this.notifications)
                this._disconnectNotificationSignals(n);
            // Unconditional, and after _clear_all(), which still needs the list alive.
            this._notificationList.destroy();

            this.signals.disconnectAllSignals();
            this.settings.finalize();
            this._crit_icon.destroy();
            this._alt_crit_icon.destroy();

            this.menuManager.removeMenu(this.menu);
            this.menu.destroy();
        }
    }

    _openMenu() {
        this._update_timestamp();
        this.menu.toggle();
    }

    _display() {
        this.set_applet_icon_symbolic_name("empty-notif");
        this.set_applet_tooltip(_("Notifications"));

        this._maincontainer = new St.BoxLayout({name: 'traycontainer', vertical: true});
        this._notificationbin = new St.BoxLayout({vertical:true});

        this.menu_label = new PopupMenu.PopupMenuItem(stringify(this.notifications.length));
        this.menu_label.actor.reactive = false;
        this.menu_label.actor.can_focus = false;
        this.menu_label.label.add_style_class_name('popup-subtitle-menu-item');

        this.clear_separator = new PopupMenu.PopupSeparatorMenuItem();

        this.clear_action = new PopupMenu.PopupMenuItem(_("Clear notifications"));
        this.clear_action.connect('activate', Lang.bind(this, this._clear_all));
        this.clear_action.actor.hide();

        this.menu.addMenuItem(this.clear_action);
        this.menu.addMenuItem(this.clear_separator);
        this.menu.addMenuItem(this.menu_label);
        this.menu.addActor(this._maincontainer);
       
        this.scrollview = new St.ScrollView({ x_fill: true, y_fill: true, y_align: St.Align.START, style_class: "vfade"});
        this._maincontainer.add(this.scrollview);
        this.scrollview.add_actor(this._notificationbin);
        this.scrollview.set_policy(St.PolicyType.NEVER, St.PolicyType.AUTOMATIC);
        this.scrollview.set_clip_to_allocation(true);

        // The callback keeps clock-use-24h out of the list.
        let adjustment = this.scrollview.get_vscroll_bar().get_adjustment();
        this._notificationList = new NotificationList(this._notificationbin, adjustment,
                                                       (notification) => this._formatTimestamp(notification));
        this.menu.connect('open-state-changed', (menu, open) => {
            this._notificationList.setActive(open);
        });

        // Measured heights go stale on a theme, font or display-scale change, and nothing else
        // invalidates them. Routed through this.signals so disconnectAllSignals() tears it down.
        this._themeContext = St.ThemeContext.get_for_stage(global.stage);
        this.signals.connect(this._themeContext, 'changed', () => this._notificationList.invalidateHeights());

        let vscroll = this.scrollview.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, function() {
            this.menu.passEvents = true;
        }));
        vscroll.connect('scroll-stop', Lang.bind(this, function() {
            this.menu.passEvents = false;
        }));

        this._crit_icon = new St.Icon({icon_name: 'critical-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });
        this._alt_crit_icon = new St.Icon({icon_name: 'alt-critical-notif', icon_type: St.IconType.SYMBOLIC, reactive: true, track_hover: true, style_class: 'system-status-icon' });

        this._on_panel_edit_mode_changed();

        this.settingsMenuItem = this.menu.addSettingsAction(_("Notification Settings"), 'notifications');
    }

    _arrangeDisplay() {
        this.menu.box.remove_all_children();
        
        if (this._orientation == St.Side.BOTTOM) {
            this.menu.addActor(this.menu_label.actor);
            this.menu.addActor(this._maincontainer);
            this.menu.addActor(this.clear_separator.actor);
            this.menu.addActor(this.clear_action.actor);
        } else {
            this.menu.addActor(this.clear_action.actor);
            this.menu.addActor(this.clear_separator.actor);
            this.menu.addActor(this.menu_label.actor);
            this.menu.addActor(this._maincontainer);
        }

        this.menu.addActor(this.settingsMenuItem.actor);
    }

    _notification_added (mtray, notification) {
        if (this.ignoreTransientNotifications && notification.isTransient) {
            notification.destroy();
            return;
        }

        // Check _destroyed before touching the actor: the tray hands a notification back after
        // hiding its banner even if it was destroyed while shown, and the actor is gone by then.
        if (notification._destroyed) {
            let destroyed_index = this.notifications.indexOf(notification);
            if (destroyed_index != -1) {
                this.notifications.splice(destroyed_index, 1);
                this.update_list();
            }
            return;
        }

        notification.actor.unparent();
        let existing_index = this.notifications.indexOf(notification);
        if (existing_index != -1) {
            // A revision: content changed and the app still considers it current, so re-attach
            // rather than leave it off-screen.
            notification._inNotificationBin = true;
            this._notificationList.ensureAttached(notification);
            notification._timeLabel.show();
            this.update_list();
            return;
        }
        notification._inNotificationBin = true;
        this.notifications.push(notification);
        this._connectNotificationSignals(notification);
        notification._timeLabel.show();

        this.update_list();
    }

    _connectNotificationSignals(notification) {
        // Ids kept on the notification: one that outlives this applet would otherwise keep a
        // closure re-entering update_list(), and keep the applet alive with it.
        notification._appletScrollId = notification.connect('scrolling-changed',
            (notif, scrolling) => { this.menu.passEvents = scrolling });
        notification._appletDestroyId = notification.connect('destroy', () => {
            this._disconnectNotificationSignals(notification);
            let i = this.notifications.indexOf(notification);
            if (i !== -1)
                this.notifications.splice(i, 1);
            this.update_list();
        });
    }

    // Undoes _connectNotificationSignals(). Clear, destroy and panel removal can each get here first.
    _disconnectNotificationSignals(notification) {
        if (notification._appletScrollId) {
            notification.disconnect(notification._appletScrollId);
            notification._appletScrollId = 0;
        }
        if (notification._appletDestroyId) {
            notification.disconnect(notification._appletDestroyId);
            notification._appletDestroyId = 0;
        }
    }

    update_list () {
        try {
            let count = this.notifications.length;
            if (count > 0) {
                this.actor.show();
                this.clear_action.actor.show();
                this.set_applet_label(count.toString());
                this._renderList();
                let maxUrgency = -1;
                for (let i = 0; i < count; i++)
                    if (this.notifications[i].urgency > maxUrgency)
                        maxUrgency = this.notifications[i].urgency;
                switch (maxUrgency) {
                    case Urgency.LOW:
                        this._stop_blinking();
                        this.set_applet_icon_symbolic_name("low-notif");
                        break;
                    case Urgency.NORMAL:
                    case Urgency.HIGH:
                        this._stop_blinking();
                        this.set_applet_icon_symbolic_name("normal-notif");
                        break;
                    case Urgency.CRITICAL:
                        if (!this._blinking && this._blinkTimeoutId === 0) {
                            this._blinking = true;
                            this.critical_blink();
                        }
                        break;
                }
            } else {
                this._stop_blinking();
                this.set_applet_label('');
                this.set_applet_icon_symbolic_name("empty-notif");
                this.clear_action.actor.hide();
                this._notificationList.setItems([]);
                if (!this.showEmptyTray) {
                    this.actor.hide();
                }
            }

            if (!this.showNotificationCount) {
                this.set_applet_label('');
            }
            this.menu_label.label.set_text(stringify(count));
            this._notificationbin.queue_relayout();
        }
        catch (e) {
            global.logError(e);
        }
    }

    _clear_all() {
        let list = this.notifications;
        this.notifications = [];
        this._notificationList.setItems([]);
        for (let n of list)
            this._disconnectNotificationSignals(n);

        let failed = false;
        let failure;
        try {
            for (let i = list.length - 1; i >= 0; i--)
                list[i].destroy(NotificationDestroyedReason.DISMISSED);
        } catch (e) {
            failed = true;
            failure = e;
        } finally {
            // Keep live rows connected and visible if a destroy() fails.
            let survivors = list.filter(n => !n._destroyed);
            if (survivors.length > 0) {
                for (let n of survivors)
                    this._connectNotificationSignals(n);
                this.notifications = survivors.concat(this.notifications);
            }
            this.update_list();
        }

        if (failed)
            throw failure;
    }

    _renderList() {
        let ordered = this.notifications.slice();
        if (this.showNewestFirst)
            ordered.reverse();
        this._notificationList.setItems(ordered);
    }

    _show_hide_tray() {
        if(!global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            if (this.notifications.length || this.showEmptyTray) {
                this.actor.show();
            } else {
                this.actor.hide();
            }
        }
    }

    _on_panel_edit_mode_changed () {
        if (global.settings.get_boolean(PANEL_EDIT_MODE_KEY)) {
            this.actor.show();
        } else {
            this.update_list();
        }
    }

    on_applet_added_to_panel() {
        this.on_orientation_changed(this._orientation);
        MessageTray.extensionsHandlingNotifications++;
    }

    on_orientation_changed (orientation) {
        this._orientation = orientation;

        this._arrangeDisplay();
    }

    on_applet_clicked(event) {
        this._openMenu();
    }

    on_btn_open_system_settings_clicked() {
        Util.spawnCommandLine("cinnamon-settings notifications");
    }

    // Shared by _update_timestamp() (all attached rows, on open) and NotificationList._attach()
    // (one row, at the moment it attaches).
    _formatTimestamp(notification) {
        let use_24h = this._interfaceSettings.get_boolean('clock-use-24h');
        return timeify(notification._timestamp, use_24h, new Date());
    }

    _update_timestamp() {
        let len = this.notifications.length;
        if (len === 0)
            return;

        let use_24h = this._interfaceSettings.get_boolean('clock-use-24h');
        let now = new Date();

        // Only attached rows are on screen; a row about to attach this open is skipped here, and
        // _attach() sets its timestamp itself instead.
        for (let i = 0; i < len; i++) {
            let notification = this.notifications[i];
            if (!this._notificationList.isAttached(notification))
                continue;
            // set_text no-ops on an unchanged string, true for most rows once the relative suffix stops changing.
            notification._timeLabel.set_text(timeify(notification._timestamp, use_24h, now));
        }
    }

    _stop_blinking () {
        this._blinking = false;
        if (this._blinkTimeoutId > 0) {
            Mainloop.source_remove(this._blinkTimeoutId);
            this._blinkTimeoutId = 0;
        }
    }

    critical_blink () {
        this._blinkTimeoutId = 0;
        if (!this._blinking)
            return;
        if (this._blink_toggle) {
            this._applet_icon_box.child = this._crit_icon;
        } else {
            this._applet_icon_box.child = this._alt_crit_icon;
        }
        this._blink_toggle = !this._blink_toggle;
        this._blinkTimeoutId = Mainloop.timeout_add_seconds(1, Lang.bind(this, this.critical_blink));
    }
}

function main(metadata, orientation, panel_height, instanceId) {
    return new CinnamonNotificationsApplet(metadata, orientation, panel_height, instanceId);
}

function stringify(count) {
    if (count === 0) {
        return _("No notifications");
    } else {
        return ngettext("%d notification", "%d notifications", count).format(count);
    }
}

function timeify(orig_time, use_24h, now) {
    let diff = Math.floor((now.getTime() - orig_time.getTime()) / 1000);
    let str;
    if (use_24h) {
        str = orig_time.toLocaleFormat('%x, %T');
    } else {
        str = orig_time.toLocaleFormat('%x, %r');
    }
    switch (true) {
        case (diff <= 15): {
            str += " (" + _("just now") + ")";
            break;
        } case (diff > 15 && diff <= 59): {
            str += " (" + ngettext("%d second ago", "%d seconds ago", diff).format(diff) + ")";
            break;
        } case (diff > 59 && diff <= 3540): {
            let diff_minutes = Math.floor(diff / 60);
            str += " (" + ngettext("%d minute ago", "%d minutes ago", diff_minutes).format(diff_minutes) + ")";
            break;
        }
    }
    return str;
}

// Height of every row built so far, and the mean of those for the rest. Predicting an unbuilt
// row exactly needs the theme's metrics and a Pango layout per row; the mean costs nothing and
// converges as rows get built, which is enough to size a scrollbar.
var RowHeights = class RowHeights {
    constructor() {
        this._measured = new Map();
        this._sum = 0;
    }

    invalidate() {
        this._measured.clear();
        this._sum = 0;
    }

    record(notification, px) {
        if (px <= 0)
            return;
        this.forget(notification);
        this._measured.set(notification, px);
        this._sum += px;
    }

    forget(notification) {
        let px = this._measured.get(notification);
        if (px === undefined)
            return;
        this._measured.delete(notification);
        this._sum -= px;
    }

    estimate() {
        return this._measured.size > 0 ? this._sum / this._measured.size : FALLBACK_ROW_HEIGHT;
    }

    get(notification) {
        let px = this._measured.get(notification);
        return px !== undefined ? px : this.estimate();
    }

    offsets(notifications) {
        let offsets = new Array(notifications.length + 1);
        let estimate = this.estimate();
        let y = 0;
        for (let i = 0; i < notifications.length; i++) {
            offsets[i] = y;
            let px = this._measured.get(notifications[i]);
            y += px !== undefined ? px : estimate;
        }
        offsets[notifications.length] = y;
        return offsets;
    }
};

// Keeps only the rows near the viewport parented. Spacers stand in for the rest, so the scrollbar
// is right without building anything.
var NotificationList = class NotificationList {
    constructor(bin, adjustment, formatTimestamp) {
        this._bin = bin;
        this._adjustment = adjustment;
        this._heights = new RowHeights();
        this._formatTimestamp = formatTimestamp;
        // Makes every public method a no-op after destroy(), for callers that still hold a reference.
        this._destroyed = false;

        this._items = [];        // notifications, in display order
        // Prefix sum: _offsets[i] is the top of item i, and the last entry is the total height,
        // so _offsets[i + 1] is where item i ends.
        this._offsets = [0];
        this._attached = new Set();
        this._active = false;

        // Attached while unmapped, so not measurable yet; revisited in _flushPendingMeasurements().
        this._pendingMeasure = new Set();

        // Filler bins stand in for runs of unattached rows. Reused across renders; the ones past
        // what a render used are left unparented rather than destroyed.
        this._fillers = [];

        this._topSpacer = new St.Bin();
        this._bottomSpacer = new St.Bin();
        this._bin.add_actor(this._topSpacer);
        this._bin.add_actor(this._bottomSpacer);

        this._valueId = this._adjustment.connect('notify::value', () => this._onScroll());
        this._pageId = this._adjustment.connect('notify::page-size', () => this._onScroll());
        this._scrollRenderIdleId = 0;
        this._idleId = 0;
        this._idleDelayId = 0;
    }

    attachedCount() {
        return this._attached.size;
    }

    isAttached(notification) {
        return this._attached.has(notification);
    }

    totalHeight() {
        return this._offsets[this._items.length];
    }

    invalidateHeights() {
        if (this._destroyed)
            return;
        this._heights.invalidate();
        for (let n of this._attached)
            this._pendingMeasure.add(n);
        this._rebuildOffsets();
        this._render();
    }

    // Replace the whole list; cheap, since only in-range unattached rows get attached.
    setItems(orderedNotifications) {
        if (this._destroyed)
            return;
        let next = new Set(orderedNotifications);
        // Forget anything that left: RowHeights holds a strong reference, so skipping this would
        // leak most notifications on a virtualized list.
        for (let n of this._items) {
            if (next.has(n))
                continue;
            if (this._attached.has(n))
                this._detach(n);
            this._heights.forget(n);
        }

        this._items = orderedNotifications;
        this._rebuildOffsets();
        this._render();
    }

    _rebuildOffsets() {
        this._offsets = this._heights.offsets(this._items);
    }

    _wantedRange() {
        let n = this._items.length;
        if (n === 0)
            return [0, 0];

        let top = this._adjustment.value;
        // page_size is 0 before the menu has ever laid out; assume a screenful so the first open
        // has something to show.
        let page = this._adjustment.page_size > 0 ? this._adjustment.page_size : 400;

        // First row whose bottom is past the top of the viewport. _offsets is sorted, so this is
        // a binary search rather than a walk from the start of the list.
        let lo = 0;
        let hi = n;
        while (lo < hi) {
            let mid = (lo + hi) >> 1;
            if (this._offsets[mid + 1] <= top)
                lo = mid + 1;
            else
                hi = mid;
        }
        let first = lo;
        // The last is bounded by how many rows fit on a page, so a walk is right here.
        let last = first;
        while (last < n && this._offsets[last] < top + page)
            last++;

        return [Math.max(0, first - OVERSCAN_ROWS), Math.min(n, last + OVERSCAN_ROWS)];
    }

    // Room for the wanted range, plus the same again for the idle pass to fill outward into.
    // Taken from the range rather than from the viewport height, so it cannot come out below
    // the range whatever mix of row heights the tray holds.
    _attachCap(first, last) {
        return Math.max(MIN_ATTACHED, (last - first) + 2 * OVERSCAN_ROWS);
    }

    _attach(notification) {
        let actor = notification.actor;
        if (actor.get_parent() !== null)
            return false;
        // Style class before parenting: St skips the restyle for an unmapped actor anyway.
        actor.add_style_class_name('notification-applet-padding');
        this._bin.insert_child_at_index(actor, 1);
        actor._parent_container = this._bin;
        this._attached.add(notification);
        // Set here as well as in _update_timestamp(): a row attaching during this open's render
        // does so after _update_timestamp() has already run.
        if (notification._timeLabel)
            notification._timeLabel.set_text(this._formatTimestamp(notification));

        // Measure now if it can be, otherwise leave it queued: a row parented this turn has no
        // allocation yet, so _measure() refuses it until the next drain.
        if (!actor.mapped || !this._measure(notification))
            this._pendingMeasure.add(notification);
        return true;
    }

    // get_preferred_height() undercounts an unmapped actor, since St skips the restyle. The parent
    // check catches a row the tray borrowed as a banner between attach and here.
    // Measures a row and pins it to that height. The pin is what makes the measurement true:
    // once the spacers reserve a long list the bin is overcommitted, and StBoxLayout answers
    // that by collapsing every flexible child to its minimum height, 10px under natural here.
    // Unpinned, the offsets would describe rows 10px taller than the ones on screen.
    _measure(notification) {
        let actor = notification.actor;
        if (actor.get_parent() !== this._bin)
            return false;
        let width = this._bin.get_width();
        actor.set_height(-1);
        let px = actor.get_preferred_height(width > 0 ? width : -1)[1];
        if (!(px > 0))
            return false;
        actor.set_height(px);
        this._heights.record(notification, px);
        return true;
    }

    // Runs first in _render(); setActive(true) maps this subtree just before, so a run of
    // closed-menu arrivals all get measured on the next open.
    _flushPendingMeasurements() {
        if (!this._active || this._pendingMeasure.size === 0)
            return;
        let changed = false;
        for (let n of this._pendingMeasure) {
            if (!n.actor.mapped || !this._measure(n))
                continue;
            this._pendingMeasure.delete(n);
            changed = true;
        }
        if (changed)
            this._rebuildOffsets();
    }

    // Detaching never restyles: st_widget_parent_set only fires style_changed for a non-null parent.
    _detach(notification) {
        let actor = notification.actor;
        // Drop the pin _measure() put on it: the tray sizes a borrowed actor itself.
        actor.set_height(-1);
        if (actor.get_parent() === this._bin)
            this._bin.remove_actor(actor);
        if (actor._parent_container === this._bin)
            actor._parent_container = null;
        this._attached.delete(notification);
        this._pendingMeasure.delete(notification);
    }

    // A non-null, non-bin parent means the tray is showing this row as a banner; its height stays
    // reserved so the list does not jump.
    _isBorrowed(notification) {
        let parent = notification.actor.get_parent();
        return parent !== null && parent !== this._bin;
    }

    _render() {
        this._flushPendingMeasurements();
        let [first, last] = this._wantedRange();

        let measuredNew = false;
        for (let i = first; i < last; i++) {
            let n = this._items[i];
            if (!this._attached.has(n) && !this._isBorrowed(n)) {
                if (this._attach(n) && n.actor.mapped)
                    measuredNew = true;
            }
        }
        // A row measured just now moves the mean, and every offset with it.
        if (measuredNew)
            this._rebuildOffsets();

        this._trimToCap(first, last);

        // Nothing is visible while the menu is closed; rows still attach, layout waits for the open.
        if (this._active)
            this._layoutChildren();
    }

    // Over the cap, detaches the rows farthest from the viewport. Rows in range are never
    // evicted: re-attaching costs a full style cascade, detaching costs nothing.
    _trimToCap(first, last) {
        let cap = this._attachCap(first, last);
        if (this._attached.size <= cap)
            return;
        let mid = (first + last) / 2;
        let candidates = [];
        for (let i = 0; i < this._items.length; i++) {
            let n = this._items[i];
            if (this._attached.has(n) && (i < first || i >= last))
                candidates.push({ n: n, d: Math.abs(i - mid) });
        }
        candidates.sort((a, b) => b.d - a.d);
        let excess = this._attached.size - cap;
        for (let i = 0; i < candidates.length && excess > 0; i++, excess--)
            this._detach(candidates[i].n);
    }

    // Walks the list in order: top spacer, each attached row or a filler bin for a gap, bottom
    // spacer. Leading and trailing gaps fold into the spacers rather than becoming fillers, so
    // :first-child and :last-child never flip onto a row.
    _layoutChildren() {
        let used = 0;

        this._bin.set_child_at_index(this._topSpacer, 0);
        let slot = 1;
        let pending = 0;
        let sawAttached = false;
        let leading = 0;

        for (let i = 0; i < this._items.length; i++) {
            let n = this._items[i];
            // The tray may have taken this row since attach; route through _detach() so
            // _parent_container stays consistent.
            if (this._attached.has(n) && n.actor.get_parent() !== this._bin)
                this._detach(n);

            if (this._attached.has(n)) {
                if (!sawAttached) {
                    leading = pending;
                    sawAttached = true;
                } else if (pending > 0) {
                    if (used === this._fillers.length)
                        this._fillers.push(new St.Bin());
                    let f = this._fillers[used++];
                    f.set_height(pending);
                    // set_child_at_index moves an already-parented actor with no restyle; a filler
                    // used for the first time this render needs a real insert.
                    if (f.get_parent() === this._bin)
                        this._bin.set_child_at_index(f, slot);
                    else
                        this._bin.insert_child_at_index(f, slot);
                    slot++;
                }
                pending = 0;
                this._bin.set_child_at_index(n.actor, slot++);
            } else {
                pending += this._offsets[i + 1] - this._offsets[i];
            }
        }

        this._bin.set_child_at_index(this._bottomSpacer, slot);

        // Anything this render did not need stops standing in for a gap.
        for (let i = used; i < this._fillers.length; i++) {
            if (this._fillers[i].get_parent() === this._bin)
                this._bin.remove_actor(this._fillers[i]);
        }
        if (!sawAttached) {
            this._topSpacer.set_height(this.totalHeight());
            this._bottomSpacer.set_height(0);
        } else {
            this._topSpacer.set_height(Math.max(0, leading));
            this._bottomSpacer.set_height(Math.max(0, pending));
        }
    }

    // Rows are not detached on close; their theme nodes stay cached, so the next open costs nothing.
    setActive(isMenuOpen) {
        if (this._destroyed)
            return;
        this._active = isMenuOpen;
        if (isMenuOpen) {
            this._render();
            this._scheduleIdlePass();
        } else {
            this._cancelIdlePass();
        }
    }

    // These come from st_viewport_allocate(), so rendering synchronously would queue a relayout
    // inside the allocation cycle it is still in. Defer to idle, coalescing a burst of scroll
    // notifications into one render.
    _onScroll() {
        if (!this._active)
            return;
        if (this._scrollRenderIdleId !== 0)
            return;
        this._scrollRenderIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._scrollRenderIdleId = 0;
            if (!this._destroyed && this._active)
                this._render();
            return GLib.SOURCE_REMOVE;
        });
    }

    // Fills in the rest of the list after a delay, time-sliced: attaching a row runs a CSS cascade
    // and can eat the whole budget alone, so most turns still do just one row.
    _scheduleIdlePass() {
        if (this._idleDelayId !== 0 || this._idleId !== 0)
            return;
        this._idleDelayId = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE,
                                             IDLE_START_DELAY_MS, () => {
            this._idleDelayId = 0;
            if (this._idleId !== 0 || !this._active)
                return GLib.SOURCE_REMOVE;
            this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                if (!this._active) {
                    this._idleId = 0;
                    return GLib.SOURCE_REMOVE;
                }
                // Yield while a scroll render is pending; that attach matters more than this one.
                if (this._scrollRenderIdleId !== 0)
                    return GLib.SOURCE_CONTINUE;
                let start = GLib.get_monotonic_time();
                let done = false;
                do {
                    if (!this._attachOneMore()) {
                        done = true;
                        break;
                    }
                } while (this._scrollRenderIdleId === 0 &&
                         GLib.get_monotonic_time() - start < IDLE_BUDGET_US);
                // Once per turn, not once per row. Measuring a row moves the mean every unbuilt
                // row is sized from, so the offsets have to be rebuilt before anything reads them.
                this._rebuildOffsets();
                this._layoutChildren();
                if (done) {
                    this._idleId = 0;
                    return GLib.SOURCE_REMOVE;
                }
                return GLib.SOURCE_CONTINUE;
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelIdlePass() {
        if (this._idleDelayId !== 0) {
            GLib.source_remove(this._idleDelayId);
            this._idleDelayId = 0;
        }
        if (this._idleId !== 0) {
            GLib.source_remove(this._idleId);
            this._idleId = 0;
        }
    }

    // Attaches the unattached row nearest the viewport. The caller rebuilds the offsets and lays
    // out once it has finished its turn.
    _attachOneMore() {
        let [first, last] = this._wantedRange();
        if (this._attached.size >= this._attachCap(first, last))
            return false;

        let mid = Math.floor((first + last) / 2);

        let best = -1;
        let bestDistance = Infinity;
        for (let i = 0; i < this._items.length; i++) {
            let item = this._items[i];
            // Attached means its parent is the bin, borrowed means the tray has it. Anything
            // left is unparented, so _attach() cannot refuse it.
            if (this._attached.has(item) || this._isBorrowed(item))
                continue;
            let distance = Math.abs(i - mid);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = i;
            }
        }
        if (best === -1)
            return false;
        return this._attach(this._items[best]);
    }

    // Forces a revised notification attached and drops its measured height.
    // _notification_added() unparents before this runs, which can leave _attached stale-true, so
    // reconcile against the real parent first.
    ensureAttached(notification) {
        if (this._destroyed)
            return;
        this._heights.forget(notification);
        if (notification.actor.get_parent() !== this._bin)
            this._detach(notification);
        if (!this._attached.has(notification) && !this._isBorrowed(notification))
            this._attach(notification);
        this._rebuildOffsets();
        if (this._active)
            this._layoutChildren();
    }

    destroy() {
        if (this._destroyed)
            return;
        this._destroyed = true;
        this._cancelIdlePass();
        if (this._scrollRenderIdleId !== 0) {
            GLib.source_remove(this._scrollRenderIdleId);
            this._scrollRenderIdleId = 0;
        }
        if (this._valueId) {
            this._adjustment.disconnect(this._valueId);
            this._valueId = 0;
        }
        if (this._pageId) {
            this._adjustment.disconnect(this._pageId);
            this._pageId = 0;
        }
        for (let n of Array.from(this._attached))
            this._detach(n);
        for (let f of this._fillers) {
            if (f.get_parent() !== null)
                this._bin.remove_actor(f);
            f.destroy();
        }
        this._fillers = [];
        if (this._topSpacer.get_parent() !== null)
            this._bin.remove_actor(this._topSpacer);
        if (this._bottomSpacer.get_parent() !== null)
            this._bin.remove_actor(this._bottomSpacer);
        this._topSpacer.destroy();
        this._bottomSpacer.destroy();
        this._items = [];
        this._attached.clear();
        this._pendingMeasure.clear();
    }
};
