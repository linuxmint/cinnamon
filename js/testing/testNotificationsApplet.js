// Test helpers for the notifications applet. From Looking Glass:
//
//   let t = imports.testing.testNotificationsApplet;
//   t.checkOrder(); t.benchmark(200); t.fill(50); t.cleanup();
//
// Every check clears the tray first, destroying any notifications you had. fill() adds to it.
// benchmark() stalls the session while it runs.

const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const AppletManager = imports.ui.appletManager;

const UUID = "notifications@cinnamon.org";

let sources = [];

function _applet() {
    let instances = AppletManager.getRunningInstancesForUuid(UUID);
    if (instances.length === 0)
        throw new Error(`${UUID} is not on a panel`);
    return instances[0];
}

// One source per notification: a single source keeps only MAX_NOTIFICATIONS.
function fill(n) {
    let applet = _applet();

    for (let i = 0; i < n; i++)
        _notify(applet, _newSource(), `Test notification ${i}`, undefined,
                `Body text for notification ${i}.`);
    return applet.notifications.length;
}

function cleanup() {
    let applet = _applet();
    applet.menu.close();
    applet._clear_all();
    // Let in-flight banner transitions finish while their actors are alive. One completing
    // after a later check has torn the applet down is reported as a critical.
    _pumpUntil(() => false, 150);
    sources.forEach(source => {
        try { source.destroy(); } catch (e) {}
    });
    sources = [];
    log(`[testNotificationsApplet] cleaned up, ${applet.notifications.length} left`);
}

// By identity, not position: an actor a caller parented itself is not mistaken for a row.
function _rowActors(applet) {
    let list = applet._notificationList;
    return applet._notificationbin.get_children().filter(k =>
        k !== list._topSpacer && k !== list._bottomSpacer &&
        list._fillers.indexOf(k) === -1);
}

function _activeFillers(applet) {
    return applet._notificationList._fillers.filter(
        filler => filler.get_parent() === applet._notificationbin);
}

// The order update_list() renders in: the applet's list, reversed when showNewestFirst is set.
function _displayOrder(applet, notifications) {
    let order = applet.notifications.filter(n => notifications.indexOf(n) !== -1);
    return applet.showNewestFirst ? order.reverse() : order;
}

function _orderMatches(applet) {
    let wanted = _displayOrder(applet, applet.notifications);

    let children = _rowActors(applet);
    if (children.length !== wanted.length)
        return `bin has ${children.length} row actors, list has ${wanted.length}`;

    for (let i = 0; i < wanted.length; i++) {
        if (children[i] !== wanted[i].actor)
            return `actor at index ${i} is not the expected notification`;
    }
    return null;
}

function checkOrder() {
    let applet = _applet();
    let failures = 0;

    let check = (label) => {
        let problem = _orderMatches(applet);
        if (problem) {
            failures++;
            log(`[testNotificationsApplet] FAIL ${label}: ${problem}`);
        } else {
            log(`[testNotificationsApplet] ok   ${label}`);
        }
    };

    let original = applet.showNewestFirst;
    try {

    for (let newestFirst of [false, true]) {
        applet.menu.close();
        applet._clear_all();
        applet.showNewestFirst = newestFirst;

        // Order is only guaranteed once the menu opens: layout runs only while it is active.
        fill(5);

        applet._openMenu();
        check(`newestFirst=${newestFirst}, after opening the menu`);

        applet.showNewestFirst = !newestFirst;
        applet.update_list();
        check(`newestFirst=${!newestFirst}, after flipping the setting`);

        applet.showNewestFirst = newestFirst;
        applet.update_list();
        check(`newestFirst=${newestFirst}, after flipping back`);

        applet.notifications[2].destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
        check(`newestFirst=${newestFirst}, after dismissing one`);

        applet.menu.close();
        applet._clear_all();
        if (_rowActors(applet).length !== 0) {
            failures++;
            log(`[testNotificationsApplet] FAIL newestFirst=${newestFirst}: bin not empty after clear`);
        }
    }

    } finally {
        applet.showNewestFirst = original;
        cleanup();
    }
    log(`[testNotificationsApplet] checkOrder: ${failures === 0 ? "passed" : failures + " failures"}`);
    return failures === 0;
}

// The spacers are permanent first and last bin children, so the pseudo classes land on them.
function checkPseudoClasses() {
    let applet = _applet();
    let list = applet._notificationList;
    let failures = 0;

    let hasClass = (actor, name) => {
        let classes = actor.get_style_pseudo_class();
        return classes ? classes.split(/\s+/).indexOf(name) !== -1 : false;
    };

    let check = (label, expectedRows) => {
        let rows = _rowActors(applet);
        if (rows.length !== expectedRows) {
            failures++;
            log(`[testNotificationsApplet] FAIL ${label}: ${rows.length} rows, expected ${expectedRows}`);
            return;
        }

        let problems = [];
        if (!hasClass(list._topSpacer, "first-child"))
            problems.push("first-child is not on the top spacer");
        if (!hasClass(list._bottomSpacer, "last-child"))
            problems.push("last-child is not on the bottom spacer");
        for (let i = 0; i < rows.length; i++) {
            if (hasClass(rows[i], "first-child"))
                problems.push(`row ${i} wrongly carries first-child`);
            if (hasClass(rows[i], "last-child"))
                problems.push(`row ${i} wrongly carries last-child`);
        }

        if (problems.length) {
            failures++;
            log(`[testNotificationsApplet] FAIL ${label}: ${problems.join(", ")}`);
        } else {
            log(`[testNotificationsApplet] ok   ${label} (${rows.length} rows)`);
        }
    };

    let original = applet.showNewestFirst;
    try {

    applet.menu.close();
    applet._clear_all();

    // The classes only get applied to mapped actors, so open the menu first.
    applet._openMenu();
    fill(6);
    check("after arrivals", 6);

    let listed = applet.notifications.slice();
    listed[3].destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
    check("after destroying one from the middle", 5);
    listed[0].destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
    check("after destroying the first", 4);
    listed[5].destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
    check("after destroying the last", 3);

    applet.showNewestFirst = !applet.showNewestFirst;
    applet.update_list();
    check("after flipping the sort order", 3);
    applet.showNewestFirst = !applet.showNewestFirst;
    applet.update_list();
    check("after flipping back", 3);

    fill(4);
    check("after more arrivals", 7);

    } finally {
        applet.showNewestFirst = original;
        cleanup();
    }
    log(`[testNotificationsApplet] checkPseudoClasses: ${failures === 0 ? "passed" : failures + " failures"}`);
    return failures === 0;
}

// A rebuild while the tray holds one of the actors.
function checkBannerHandover() {
    let applet = _applet();
    let tray = Main.messageTray;
    let failures = 0;

    try {
        applet.menu.close();
        applet._clear_all();

        let listed = [];
        for (let i = 0; i < 4; i++) {
            fill(1);
            listed.push(applet.notifications[applet.notifications.length - 1]);
        }
        applet._openMenu();

        let borrowed = listed[1];
        tray._notificationQueue.push(borrowed);
        tray._showNotification();

        if (borrowed.actor.get_parent() === applet._notificationbin) {
            failures++;
            log("[testNotificationsApplet] FAIL banner: the tray did not take the actor");
        }

        applet.update_list();

        let rows = _rowActors(applet);
        let wanted = _displayOrder(applet, [listed[0], listed[2], listed[3]]).map(n => n.actor);
        if (rows.length !== wanted.length) {
            failures++;
            log(`[testNotificationsApplet] FAIL banner: ${rows.length} rows, expected ${wanted.length}`);
        } else {
            for (let i = 0; i < wanted.length; i++) {
                if (rows[i] !== wanted[i]) {
                    failures++;
                    log(`[testNotificationsApplet] FAIL banner: actor at index ${i} is not the expected one`);
                    break;
                }
            }
        }
        // The borrowed row sits in the middle, so its gap must become a filler.
        if (_activeFillers(applet).length === 0) {
            failures++;
            log("[testNotificationsApplet] FAIL banner: no filler opened for the borrowed row's gap");
        }
        if (failures === 0)
            log("[testNotificationsApplet] ok   rebuild with an actor on loan to a banner");

        applet._clear_all();
        if (!borrowed._destroyed) {
            failures++;
            log("[testNotificationsApplet] FAIL banner: clear left the borrowed notification alive");
        }
        if (applet.notifications.length !== 0 || _rowActors(applet).length !== 0) {
            failures++;
            log(`[testNotificationsApplet] FAIL banner: clear left list=${applet.notifications.length} bin=${_rowActors(applet).length}`);
        } else {
            log("[testNotificationsApplet] ok   clear with an actor on loan to a banner");
        }

    } finally {
        // Give the actor back and disarm the dwell timer, so nothing is left queued against
        // actors the next check destroys. Never hide mid-show: State.SHOWING is 1.
        _pumpUntil(() => tray._notificationState !== 1, 300);
        // Only if the tray still holds a live one: handing back a destroyed actor is the bug.
        if (tray._notification && !tray._notification._destroyed) {
            try { tray._hideNotificationCompleted(); } catch (e) { /* best effort */ }
        }
        try { tray._notificationQueue.length = 0; } catch (e) { /* best effort */ }
        try { tray._updateNotificationTimeout(0); } catch (e) { /* best effort */ }
        cleanup();
    }

    log(`[testNotificationsApplet] checkBannerHandover: ${failures === 0 ? "passed" : failures + " failures"}`);
    return failures === 0;
}

// The tray hands a notification back even if it was destroyed while shown, once its actor is
// disposed. GJS logs a critical rather than throwing, so watch the property, not an exception.
function checkDestroyedHandback() {
    let applet = _applet();
    let tray = Main.messageTray;
    let failures = 0;

    let handBack = (label, listed) => {
        let source = new MessageTray.SystemNotificationSource("Test");
        Main.messageTray.add(source);
        sources.push(source);
        let notification = new MessageTray.Notification(source, "handback", "body");
        source.pushNotification(notification);
        applet._notification_added(tray, notification);
        if (!listed) {
            let i = applet.notifications.indexOf(notification);
            if (i !== -1)
                applet.notifications.splice(i, 1);
        }

        let realActor = notification.actor;
        notification.destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
        if (listed && applet.notifications.indexOf(notification) === -1)
            applet.notifications.push(notification);

        let touched = false;
        Object.defineProperty(notification, "actor", {
            configurable: true,
            get: () => { touched = true; return realActor; }
        });
        try {
            applet._notification_added(tray, notification);
        } finally {
            delete notification.actor;
            notification.actor = realActor;
        }

        if (touched) {
            failures++;
            log(`[testNotificationsApplet] FAIL handback ${label}: the applet read the actor of a destroyed notification`);
        } else if (applet.notifications.indexOf(notification) !== -1) {
            failures++;
            log(`[testNotificationsApplet] FAIL handback ${label}: a destroyed notification is still tracked`);
        } else {
            log(`[testNotificationsApplet] ok   handback ${label}`);
        }
    };

    try {
        applet.menu.close();
        applet._clear_all();
        handBack("when the applet no longer tracks it", false);
        applet._clear_all();
        handBack("when the applet still tracks it", true);
    } finally {
        cleanup();
    }

    log(`[testNotificationsApplet] checkDestroyedHandback: ${failures === 0 ? "passed" : failures + " failures"}`);
    return failures === 0;
}

// Fault injection. Asserted on each notification's own _destroyed flag, since _clear_all()
// empties the list before the destroy loop runs.
function checkFailedClear() {
    let applet = _applet();
    let failures = 0;
    let victim = null;
    let realDestroy = null;

    try {
        applet.menu.close();
        applet._clear_all();
        fill(5);
        applet._openMenu();

        // Index 2 throws, and _clear_all() destroys back-to-front, so 0 and 1 are never
        // attempted. All three should survive, then die on a retry without the fault.
        let survivors = applet.notifications.slice(0, 3);
        victim = applet.notifications[2];
        realDestroy = victim.destroy;
        victim.destroy = function () { throw new Error("injected destroy failure"); };

        try {
            applet._clear_all();
            failures++;
            log("[testNotificationsApplet] FAIL failed-clear: the injected error did not propagate");
        } catch (e) {
        }

        let destroyedEarly = survivors.filter(n => n._destroyed);
        if (destroyedEarly.length > 0) {
            failures++;
            log(`[testNotificationsApplet] FAIL failed-clear: ${destroyedEarly.length} survivor(s) were destroyed anyway despite the injected failure`);
        } else {
            log("[testNotificationsApplet] ok   survivors were not destroyed by the failed clear");
        }

        let listedSurvivors = survivors.filter(n => applet.notifications.indexOf(n) !== -1);
        if (listedSurvivors.length !== survivors.length) {
            failures++;
            log(`[testNotificationsApplet] FAIL failed-clear: only ${listedSurvivors.length} survivor(s) stayed listed`);
        } else {
            log("[testNotificationsApplet] ok   survivors stayed listed after the failed clear");
        }

        let connectedSurvivors = survivors.filter(
            n => n._appletScrollId !== 0 && n._appletDestroyId !== 0);
        if (connectedSurvivors.length !== survivors.length) {
            failures++;
            log(`[testNotificationsApplet] FAIL failed-clear: only ${connectedSurvivors.length} survivor(s) kept their applet signals`);
        } else {
            log("[testNotificationsApplet] ok   survivors kept their applet signals");
        }

        let renderedSurvivors = _rowActors(applet).filter(
            actor => survivors.some(n => n.actor === actor));
        if (renderedSurvivors.length !== survivors.length) {
            failures++;
            log(`[testNotificationsApplet] FAIL failed-clear: only ${renderedSurvivors.length} survivor(s) were rendered`);
        } else {
            log("[testNotificationsApplet] ok   survivors were rendered after the failed clear");
        }

        victim.destroy = realDestroy;
        realDestroy = null;
        applet._clear_all();

        let stillUndestroyed = survivors.filter(n => !n._destroyed);
        if (stillUndestroyed.length !== 0) {
            failures++;
            log(`[testNotificationsApplet] FAIL failed-clear: retry did not finish the job -- ${stillUndestroyed.length} survivor(s) were never destroyed`);
        } else {
            log("[testNotificationsApplet] ok   retry destroyed the survivors");
        }
    } finally {
        if (victim !== null && realDestroy !== null)
            victim.destroy = realDestroy;
        cleanup();
    }

    log(`[testNotificationsApplet] checkFailedClear: ${failures === 0 ? "passed" : failures + " failures"}`);
    return failures === 0;
}

// Pumps the main loop until predicate() holds or maxRounds (about 2ms each) is used up.
function _pumpUntil(predicate, maxRounds) {
    let ctx = GLib.MainContext.default();
    for (let i = 0; i < maxRounds; i++) {
        if (predicate())
            return true;
        GLib.usleep(2000);
        while (ctx.iteration(false)) { /* drain everything ready right now */ }
    }
    return predicate();
}

// Waits for the deferred render _onScroll() schedules. The id only goes non-zero once the
// scroll view allocates, so waiting for zero alone would return having waited for nothing.
function _waitForDeferredRender(list) {
    let scheduled = _pumpUntil(() => list._scrollRenderIdleId !== 0, 150);
    let settled = _pumpUntil(() => list._scrollRenderIdleId === 0, 500);
    return scheduled && settled;
}

function _waitForIdlePass(list, wasScheduled) {
    if (!wasScheduled)
        return false;
    return _pumpUntil(() => list._idleDelayId === 0 && list._idleId === 0, 900);
}

function _newCheck(name) {
    let ok = true;
    return {
        check: (label, condition) => {
            global.log(name + ": " + label + ": " + (condition ? "ok" : "FAIL"));
            if (!condition)
                ok = false;
        },
        finish: () => {
            global.log(name + ": " + (ok ? "all checks passed" : "FAILURES above"));
            return ok;
        }
    };
}

// Not a test of how close the estimate lands, only that measured rows report their own height
// and unbuilt ones get the mean.
function checkRowHeights() {
    let applet = _applet();
    let result = _newCheck("checkRowHeights");
    let check = result.check;
    try {
        applet.menu.close();
        applet._clear_all();
        // Enough rows that plenty stay unbuilt: the overscan margin is attached on open.
        fill(200);
        applet._openMenu();

        let list = applet._notificationList;
        let heights = list._heights;
        // The idle pass would keep attaching rows underneath these assertions.
        list._cancelIdlePass();

        let measured = Array.from(heights._measured.keys());
        check("opening the menu measured some rows but not all (" +
              measured.length + " of " + applet.notifications.length + ")",
              measured.length > 0 && measured.length < applet.notifications.length);

        // Without a real height a row falls back to the mean and everything below passes
        // for the wrong reason.
        let attachedUnmeasured = applet.notifications.filter(
            n => list.isAttached(n) && !heights._measured.has(n));
        check("every attached row was measured (" + list.attachedCount() +
              " attached, " + attachedUnmeasured.length + " of them unmeasured)",
              attachedUnmeasured.length === 0);
        let measuredUnattached = measured.filter(n => !list.isAttached(n));
        check("nothing unattached is holding a measured height (" +
              measuredUnattached.length + ")", measuredUnattached.length === 0);

        // Against the height the bin allocated, which is what the user sees and what the
        // spacers and offsets have to agree with. Measuring at natural width instead put this
        // out by up to 10px on a row that wraps.
        _pumpUntil(() => false, 25);
        let allocated = measured.filter(n => n.actor.mapped && n.actor.get_height() > 0);
        let allocWorst = 0;
        let allocWorstAt = -1;
        for (let n of allocated) {
            let err = Math.abs(heights.get(n) - n.actor.get_height());
            if (err > allocWorst) {
                allocWorst = err;
                allocWorstAt = applet.notifications.indexOf(n);
            }
        }
        check("the stored height is the height the bin allocated (" + allocated.length +
              " rows, worst " + allocWorst.toFixed(1) + "px at index " + allocWorstAt + ")",
              allocated.length > 0 && allocWorst < 1);

        let mean = heights.estimate();
        let sum = 0;
        for (let n of measured)
            sum += heights.get(n);
        check("the estimate is the mean of what was measured (" + mean.toFixed(1) +
              " vs " + (sum / measured.length).toFixed(1) + ")",
              Math.abs(mean - sum / measured.length) < 0.01);

        let unmeasured = applet.notifications.find(n => !heights._measured.has(n));
        check("an unbuilt row gets the mean", unmeasured !== undefined &&
              Math.abs(heights.get(unmeasured) - mean) < 0.01);

        let victim = measured[0];
        let was = heights.get(victim);
        heights.record(victim, was + 100);
        check("re-recording a row replaces its height rather than adding one (" +
              heights._measured.size + " entries)", heights._measured.size === measured.length);
        check("the mean moved by the change over the count (" + heights.estimate().toFixed(1) +
              " vs " + (mean + 100 / measured.length).toFixed(1) + ")",
              Math.abs(heights.estimate() - (mean + 100 / measured.length)) < 0.01);

        heights.record(victim, was);
        check("putting the height back restores the mean", Math.abs(heights.estimate() - mean) < 0.01);

        heights.forget(victim);
        check("forgetting a row drops it from the count (" + heights._measured.size + ")",
              heights._measured.size === measured.length - 1);
        check("forgetting a row leaves the mean of the rest",
              Math.abs(heights.estimate() - (sum - was) / (measured.length - 1)) < 0.01);

        // The offsets themselves, not a total recomputed the way _rebuildOffsets() does it.
        list._rebuildOffsets();
        let items = list._items;
        check("the first row sits at zero (" + list._offsets[0] + ")", list._offsets[0] === 0);
        let gaps = 0;
        for (let i = 1; i < items.length; i++) {
            let expected = list._offsets[i - 1] + heights.get(items[i - 1]);
            if (Math.abs(list._offsets[i] - expected) > 0.01)
                gaps++;
        }
        check("each row starts where the one above it ends (" + gaps + " that do not)", gaps === 0);
        let last = items.length - 1;
        check("the last row ends at the total height (" +
              (list._offsets[last] + heights.get(items[last])).toFixed(1) + " vs " +
              list.totalHeight().toFixed(1) + ")",
              Math.abs(list._offsets[last] + heights.get(items[last]) - list.totalHeight()) < 0.01);

        heights.invalidate();
        check("with nothing measured the estimate is the fallback (" + heights.estimate() + ")",
              heights.estimate() === 64);

        // Otherwise a theme, font or scale change leaves the scrollbar on the fallback height.
        list.invalidateHeights();
        let unmeasuredAfterInvalidation = applet.notifications.filter(
            n => list.isAttached(n) && !heights._measured.has(n));
        check("height invalidation remeasured every attached row (" +
              unmeasuredAfterInvalidation.length + " unmeasured)",
              unmeasuredAfterInvalidation.length === 0);
    } finally {
        cleanup();
        applet._notificationList.invalidateHeights();
    }
    return result.finish();
}

// Forces a scrollbar jump, which leaves a discontiguous attached set for the fillers to cover.
function checkRenderedGeometry() {
    let applet = _applet();
    let list = applet._notificationList;
    let result = _newCheck("checkRenderedGeometry");
    let check = result.check;
    let idlePassCancelled = false;
    let adjustment = null;
    let oldValue = 0;
    let oldPageSize = 0;
    let oldUpper = 0;
    try {
        applet.menu.close();
        applet._clear_all();
        fill(100);
        applet._openMenu();

        // The idle-fill pass would attach rows on its own. Armed on a delay, so no race.
        list._cancelIdlePass();
        idlePassCancelled = true;

        let bin = applet._notificationbin;
        let notifications = applet.notifications.slice();
        let adj = applet.scrollview.get_vscroll_bar().get_adjustment();
        adjustment = adj;
        oldValue = adj.value;
        oldPageSize = adj.page_size;
        oldUpper = adj.upper;
        // Shared with whatever position an earlier open left: start from a known top.
        adj.value = 0;
        _waitForDeferredRender(list);

        // Heights from the list, what _layoutChildren() sized against, not get_height().
        function heightSum() {
            let sum = 0;
            for (let k of bin.get_children()) {
                if (k === list._topSpacer || k === list._bottomSpacer ||
                    list._fillers.indexOf(k) !== -1) {
                    sum += k.get_height();
                } else {
                    let n = notifications.find(x => x.actor === k);
                    sum += list._heights.get(n);
                }
            }
            return sum;
        }

        function checkGeometry(label) {
            let kids = bin.get_children();
            check(label + ": spacers are the first and last children",
                  kids[0] === list._topSpacer && kids[kids.length - 1] === list._bottomSpacer);

            let actors = _rowActors(applet);
            // list._items, not applet.notifications: showNewestFirst reverses the display order.
            let wanted = list._items.filter(n => list._attached.has(n)).map(n => n.actor);
            let orderOk = actors.length === wanted.length &&
                          actors.every((a, i) => a === wanted[i]);
            check(label + ": attached rows and fillers are in display order", orderOk);

            let sum = heightSum();
            let total = list.totalHeight();
            check(label + ": children heights sum to the list total (" +
                  sum.toFixed(1) + " vs " + total.toFixed(1) + ")", Math.abs(sum - total) < 1);
        }

        check("far fewer rows attached than exist (" + list.attachedCount() + " of " +
              notifications.length + ")", list.attachedCount() < notifications.length);
        check("initial range: no filler needed for one contiguous run",
              _activeFillers(applet).length === 0);
        checkGeometry("initial range");

        // Attachment is grow-only, so a jump leaves two attached runs with a gap between them.
        let attachedBeforeJump = list.attachedCount();
        adj.page_size = adj.page_size || 400;
        adj.upper = list.totalHeight();
        adj.value = list.totalHeight() - adj.page_size;
        let grew = _waitForDeferredRender(list) &&
                   list.attachedCount() > attachedBeforeJump;
        check("scrollbar jump attached new rows near the new position", grew);
        check("discontiguous attached set needs at least one filler",
              _activeFillers(applet).length >= 1);
        checkGeometry("after scrollbar jump");

        // Leave the scrollbar where a real reopen would find it, not stranded mid-jump.
        adj.value = 0;
        _waitForDeferredRender(list);
    } finally {
        if (adjustment !== null) {
            adjustment.upper = oldUpper;
            adjustment.page_size = oldPageSize;
            adjustment.value = oldValue;
        }
        if (idlePassCancelled)
            list._scheduleIdlePass();
        cleanup();
    }
    return result.finish();
}

// Re-attaching costs a full style cascade, so scrolling back detaches nothing. Compares the
// exact set, so a detach masked by an unrelated attach cannot pass.
function checkGrowOnly() {
    let applet = _applet();
    let list = applet._notificationList;
    function sameSet(a, b) {
        if (a.size !== b.size)
            return false;
        for (let x of a)
            if (!b.has(x))
                return false;
        return true;
    }

    function isSupersetOf(a, b) {
        for (let x of b)
            if (!a.has(x))
                return false;
        return true;
    }

    let result = _newCheck("checkGrowOnly");
    let check = result.check;
    let idlePassCancelled = false;
    let adjustment = null;
    let oldValue = 0;
    let oldPageSize = 0;
    let oldUpper = 0;
    try {
        applet.menu.close();
        applet._clear_all();
        fill(150);
        applet._openMenu();

        // Cancelled for the same reason as in checkRenderedGeometry.
        list._cancelIdlePass();
        idlePassCancelled = true;

        let adj = applet.scrollview.get_vscroll_bar().get_adjustment();
        adjustment = adj;
        oldValue = adj.value;
        oldPageSize = adj.page_size;
        oldUpper = adj.upper;
        adj.value = 0;
        _waitForDeferredRender(list);
        let atTop = list.attachedCount();
        let attachedAtTop = new Set(list._attached);

        // About 15 rows: past the 10-row overscan so the range shifts, still under the cap.
        // Scaled from the measured average row height, so it holds on any theme.
        let avgRowHeight = list.totalHeight() / applet.notifications.length;
        let scrollTarget = Math.min(list.totalHeight() - adj.page_size, 15 * avgRowHeight);
        adj.value = Math.max(0, scrollTarget);
        _waitForDeferredRender(list);
        let atScrolled = list.attachedCount();
        let attachedAtScrolled = new Set(list._attached);

        check("scrolling down attached more rows (" + atTop + " -> " + atScrolled + ")",
              atScrolled > atTop);
        check("scrolling down detached nothing (" + attachedAtTop.size + " still attached)",
              isSupersetOf(attachedAtScrolled, attachedAtTop));

        adj.value = 0;
        _waitForDeferredRender(list);
        let attachedBackAtTop = new Set(list._attached);

        check("scrolling back attached nothing new and detached nothing (" +
              attachedAtScrolled.size + " -> " + attachedBackAtTop.size + ", same rows)",
              sameSet(attachedAtScrolled, attachedBackAtTop));

        // Walking the whole list is the only way to reach _trimToCap(): the scrolling above
        // stays under the cap by design.
        let cap = list._attachCap(...list._wantedRange());
        let everAttached = new Set(attachedBackAtTop);
        let steps = 12;
        for (let i = 1; i <= steps; i++) {
            adj.value = (i / steps) * Math.max(0, adj.upper - adj.page_size);
            _waitForDeferredRender(list);
            for (let n of list._attached)
                everAttached.add(n);
        }
        check("walking the list attached more rows than the cap (" + everAttached.size +
              " over the walk, cap " + cap + ")", everAttached.size > cap);
        check("the cap held anyway (" + list.attachedCount() + " attached now)",
              list.attachedCount() <= cap);

        // A cap below the wanted range makes the two fight: the range attaches a row and the cap
        // evicts it on the same pass. The cap has to leave the overscan on top of the range, so
        // a fixed one fails here as soon as a viewport is tall enough. 3800 is a rotated 4K
        // monitor, which is the case that caught the constant this replaced.
        const OVERSCAN_BOTH_SIDES = 20;
        let realPage = adj.page_size;
        let tooTight = [];
        try {
            for (let page of [realPage, 400, 2000, 3800]) {
                adj.page_size = page;
                let [first, last] = list._wantedRange();
                let capHere = list._attachCap(first, last);
                if (capHere < (last - first) + OVERSCAN_BOTH_SIDES)
                    tooTight.push(page + "px: cap " + capHere + " < range " + (last - first));
            }
        } finally {
            adj.page_size = realPage;
        }
        check("the cap leaves the overscan above the wanted range at every viewport (" +
              (tooTight.length > 0 ? tooTight.join("; ") : "400 to 3800px") + ")",
              tooTight.length === 0);
    } finally {
        if (adjustment !== null) {
            adjustment.upper = oldUpper;
            adjustment.page_size = oldPageSize;
            adjustment.value = oldValue;
        }
        if (idlePassCancelled)
            list._scheduleIdlePass();
        cleanup();
    }
    return result.finish();
}

// These run on the main loop the compositor shares, so the numbers are how long the desktop
// stops repainting and dispatching input.
function benchmark(count) {
    let applet = _applet();
    let n = count || 100;
    let ms = (start, end) => ((end - start) / 1000).toFixed(1);
    let results = {};
    let original = applet.showNewestFirst;
    try {

    let timed = (label, setup, action) => {
        applet.menu.close();
        applet._clear_all();
        setup();
        let start = GLib.get_monotonic_time();
        action();
        results[label] = ms(start, GLib.get_monotonic_time());
    };

    timed("arrive", () => applet._openMenu(), () => fill(n));

    timed("clear", () => { fill(n); applet._openMenu(); },
          () => applet._clear_all());

    timed("dismiss one", () => { fill(n); applet._openMenu(); },
          () => applet.notifications[Math.floor(n / 2)].destroy(
              MessageTray.NotificationDestroyedReason.DISMISSED));

    // Flip outside the timed region: the setter writes the settings file.
    timed("reorder", () => { fill(n); applet._openMenu(); applet.showNewestFirst = !original; },
          () => applet.update_list());

    timed("open the menu", () => fill(n), () => applet._openMenu());

    // Reopening, where the rows have been built once already. "open the menu" above cannot
    // show this: it only ever measures the first open.
    timed("reopen the menu", () => { fill(n); applet._openMenu(); applet.menu.close(); },
          () => applet._openMenu());

    } finally {
        applet.showNewestFirst = original;
        cleanup();
    }
    for (let label in results)
        log(`[testNotificationsApplet] ${n} notifications, ${label}: ${results[label]} ms`);
    return results;
}

const Extension = imports.ui.extension;

// True while GLib still holds the source. Asserting on _blinkTimeoutId alone cannot tell a
// cancelled timer from one still queued against a torn-down applet.
function _sourceIsLive(id) {
    if (!id)
        return false;
    return GLib.MainContext.default().find_source_by_id(id) !== null;
}

function _blinkNotify(applet, urgency) {
    return _notify(applet, _newSource(), "blink test", urgency);
}

// The blink re-arms a one second timeout while a critical notification is listed.
function checkCriticalBlink() {
    let applet = _applet();
    if (!applet) {
        global.log("checkCriticalBlink: applet not running");
        return false;
    }

    let ok = true;
    function check(label, condition) {
        global.log("checkCriticalBlink: " + label + ": " + (condition ? "ok" : "FAIL"));
        if (!condition)
            ok = false;
    }

    try {

    applet.menu.close();
    applet._clear_all();
    check("idle: no timeout armed", applet._blinkTimeoutId === 0);

    let critical = _blinkNotify(applet, MessageTray.Urgency.CRITICAL);
    check("critical: blinking", applet._blinking === true);
    check("critical: timeout armed", applet._blinkTimeoutId > 0);

    let armed = applet._blinkTimeoutId;
    applet.update_list();
    check("re-entry: same timeout, not forked", applet._blinkTimeoutId === armed);

    check("critical: the source is really queued", _sourceIsLive(armed));

    critical.destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
    _blinkNotify(applet, MessageTray.Urgency.NORMAL);
    check("below critical: not blinking", applet._blinking === false);
    check("below critical: timeout removed", applet._blinkTimeoutId === 0);
    check("below critical: the source is really gone", !_sourceIsLive(armed));

    _blinkNotify(applet, MessageTray.Urgency.CRITICAL);
    let armedAgain = applet._blinkTimeoutId;
    applet._clear_all();
    check("cleared: chain was running first", armedAgain > 0);
    check("cleared: timeout removed", applet._blinkTimeoutId === 0);
    check("cleared: the source is really gone", !_sourceIsLive(armedAgain));

    // Removal is covered by checkSignalsDisconnected. Doing it here would trip on handlers a
    // later commit disconnects, and report that as this check's own failure.

    } finally {
        try { cleanup(); } catch (e) { /* best effort */ }
    }

    global.log("checkCriticalBlink: " + (ok ? "all checks passed" : "FAILURES above"));
    return ok;
}

// AppletPopupMenu parents its actor into Main.uiGroup, so a menu that outlived its applet is a
// stray direct child of it. By actor identity, so the session language does not matter.
function _liveMenus(actors) {
    let kids = Main.uiGroup.get_children();
    return actors.filter(actor => actor !== null && kids.indexOf(actor) !== -1);
}

// Reloads the way a theme change or a panel move would. reloadExtension() returns long before
// the applet exists, since Extension._init() is async, so pump rather than sleep.
function _reloadAndWaitForApplet(maxRounds) {
    Extension.reloadExtension(UUID, Extension.Type.APPLET);
    let back = _pumpUntil(() => AppletManager.getRunningInstancesForUuid(UUID).length > 0, maxRounds);
    return back ? _applet() : null;
}

// on_applet_removed_from_panel() used to leave the menu in Main.uiGroup, drawable above a dead
// applet. Reloads the extension rather than calling that by hand, which would stage the bug.
function checkMenuNotLeaked() {
    let ok = true;
    function check(label, condition) {
        global.log("checkMenuNotLeaked: " + label + ": " + (condition ? "ok" : "FAIL"));
        if (!condition)
            ok = false;
    }

    // One reload settles it. More are not more conclusive, and each tears the shell's applets
    // down while this call is still pumping the main loop, which has killed the session.
    const RELOADS = 1;
    // About 10s of pumping, a bound rather than a wait; the reload usually lands in under 50ms.
    const MAX_WAIT_ROUNDS = 5000;

    let applet = _applet();
    applet.menu.close();
    applet._clear_all();

    // A reload must destroy the menu before it, so exactly one of these stays parented.
    let seen = [applet.menu.actor];
    check("exactly one menu before reloading (" + _liveMenus(seen).length + ")",
          _liveMenus(seen).length === 1);

    let allCameBack = true;
    for (let i = 0; i < RELOADS; i++) {
        let reloaded = _reloadAndWaitForApplet(MAX_WAIT_ROUNDS);
        if (!reloaded) {
            allCameBack = false;
            check("the applet came back after reload " + (i + 1), false);
            break;
        }
        applet = reloaded;
        seen.push(applet.menu.actor);
    }
    check("the applet came back after reloading", allCameBack);

    // Exactly one, not "no more than before": zero is a failure this used to pass.
    let live = _liveMenus(seen);
    check("exactly one menu left after reloading (" + live.length + " of " + seen.length +
          " seen)", live.length === 1);
    check("the one left is the reloaded applet's own menu",
          applet !== null && live.length === 1 && live[0] === applet.menu.actor);

    // Leave a working applet regardless of the outcome above.
    if (!applet)
        applet = _reloadAndWaitForApplet(MAX_WAIT_ROUNDS);
    if (!applet)
        global.log("checkMenuNotLeaked: FAIL the applet did not come back; the panel is missing it");
    else
        try { cleanup(); } catch (e) { /* best effort */ }

    global.log("checkMenuNotLeaked: " + (ok ? "all checks passed" : "FAILURES above"));
    return ok;
}

// Connected through raw connect(), not this.signals, so disconnectAllSignals() never touches
// them. What leaks is whatever is still listed when the applet is removed.
function checkSignalsDisconnected() {
    let applet = _applet();
    let ok = true;
    function check(label, condition) {
        global.log("checkSignalsDisconnected: " + label + ": " + (condition ? "ok" : "FAIL"));
        if (!condition)
            ok = false;
    }

    try {
        applet.menu.close();
        applet._clear_all();
        fill(6);

        // Emitting 'destroy' on a listed notification drops it from the applet's list. The
        // tray destroys them of its own accord, so always pick one listed right now.
        let before = applet.notifications.length;
        check("something is listed to begin with (" + before + ")", before > 0);
        applet.notifications[0].emit('destroy', MessageTray.NotificationDestroyedReason.DISMISSED);
        check("the destroy handler is connected on arrival (" + before + " -> " +
              applet.notifications.length + ")", applet.notifications.length === before - 1);

        // Reload rather than calling on_applet_removed_from_panel() by hand, so the manager
        // tears it down the way a theme change would. Held above zero so the applet's decrement
        // does not reach 0 and clear the tray, which is what would leave nothing to leak.
        let counter = MessageTray.extensionsHandlingNotifications;
        MessageTray.extensionsHandlingNotifications = 2;
        _reloadAndWaitForApplet(5000);
        MessageTray.extensionsHandlingNotifications = counter;

        let listed = applet.notifications.length;
        check("removal left notifications listed, so there is something to leak (" +
              listed + ")", listed > 0);
        if (listed > 0) {
            let target = applet.notifications[0];
            target.emit('destroy', MessageTray.NotificationDestroyedReason.DISMISSED);
            check("a listed notification no longer reaches the removed applet (" + listed +
                  " -> " + applet.notifications.length + ")",
                  applet.notifications.length === listed);
        }
    } finally {
        try { cleanup(); } catch (e) { /* best effort */ }
    }

    global.log("checkSignalsDisconnected: " + (ok ? "all checks passed" : "FAILURES above"));
    return ok;
}

// Urgency is set before the applet sees it, as notificationDaemon.js does.
function _notify(applet, source, title, urgency, body) {
    let notification = new MessageTray.Notification(
        source, title, body === undefined ? "body" : body);
    if (urgency !== undefined)
        notification.setUrgency(urgency);
    source.pushNotification(notification);
    applet._notification_added(Main.messageTray, notification);
    return notification;
}

function _newSource(title) {
    let source = new MessageTray.SystemNotificationSource(title || "Test");
    Main.messageTray.add(source);
    sources.push(source);
    return source;
}

// _hideNotificationCompleted() is called directly: the real cycle ends in a Clutter callback
// a synchronous D-Bus call cannot wait for.
function checkHandback() {
    let applet = _applet();
    let tray = Main.messageTray;
    let ok = true;
    function check(label, condition) {
        global.log("checkHandback: " + label + ": " + (condition ? "ok" : "FAIL"));
        if (!condition)
            ok = false;
    }

    try {
        applet.menu.close();
        applet._clear_all();
        fill(4);
        applet._openMenu();

        let listed = applet.notifications.slice();
        let borrowed = listed[1];
        let wasAt = _rowActors(applet).indexOf(borrowed.actor);

        tray._notificationQueue.push(borrowed);
        tray._showNotification();
        // Hiding first makes the tray throw: _showNotificationCompleted() reads
        // this._notification without a null check. See docs/issues/messagetray-issues.md.
        _pumpUntil(() => tray._notificationState === 2, 200);
        check("the tray took the actor", borrowed.actor.get_parent() !== applet._notificationbin);

        tray._hideNotificationCompleted();

        check("the actor came back to the bin",
              borrowed.actor.get_parent() === applet._notificationbin);
        check("it is marked as living in the bin again", borrowed._inNotificationBin === true);
        check("its timestamp is visible again", borrowed._timeLabel.visible === true);
        check("the list is unchanged (" + applet.notifications.length + " of " +
              listed.length + ")", applet.notifications.length === listed.length);
        check("it is back at the same position (" + wasAt + ")",
              _rowActors(applet).indexOf(borrowed.actor) === wasAt);
    } finally {
        // Never hide mid-show: the completion callback reads this._notification, which hiding
        // sets to null. State.SHOWING is 1.
        _pumpUntil(() => tray._notificationState !== 1, 300);
        try { tray._notificationQueue.length = 0; } catch (e) { /* best effort */ }
        // The dwell timeout outlives _hideNotificationCompleted(); left armed it fires
        // inside a later check, against a notification already destroyed.
        try { tray._updateNotificationTimeout(0); } catch (e) { /* best effort */ }
        cleanup();
    }

    global.log("checkHandback: " + (ok ? "all checks passed" : "FAILURES above"));
    return ok;
}

// A revision while the banner is up clears _inNotificationBin and hides the timestamp.
function checkRevisedWhileShowing() {
    let applet = _applet();
    let tray = Main.messageTray;
    let ok = true;
    function check(label, condition) {
        global.log("checkRevisedWhileShowing: " + label + ": " + (condition ? "ok" : "FAIL"));
        if (!condition)
            ok = false;
    }

    try {
        applet.menu.close();
        applet._clear_all();
        fill(3);
        applet._openMenu();

        let borrowed = applet.notifications[1];
        tray._notificationQueue.push(borrowed);
        tray._showNotification();
        _pumpUntil(() => tray._notificationState === 2, 200);

        borrowed.update("revised title", "revised body");
        check("the revision cleared the in-bin flag", borrowed._inNotificationBin === false);

        tray._hideNotificationCompleted();

        check("the actor came back", borrowed.actor.get_parent() === applet._notificationbin);
        check("the in-bin flag was restored", borrowed._inNotificationBin === true);
        check("the timestamp is visible again", borrowed._timeLabel.visible === true);
        check("the list did not grow (" + applet.notifications.length + ")",
              applet.notifications.length === 3);
    } finally {
        try { tray._notificationQueue.length = 0; } catch (e) { /* best effort */ }
        // The dwell timeout outlives _hideNotificationCompleted(); left armed it fires
        // inside a later check, against a notification already destroyed.
        try { tray._updateNotificationTimeout(0); } catch (e) { /* best effort */ }
        cleanup();
    }

    global.log("checkRevisedWhileShowing: " + (ok ? "all checks passed" : "FAILURES above"));
    return ok;
}

// The highest urgency in the list picks the panel icon, and a critical one starts the blink.
function checkUrgency() {
    let applet = _applet();
    let ok = true;
    function check(label, condition) {
        global.log("checkUrgency: " + label + ": " + (condition ? "ok" : "FAIL"));
        if (!condition)
            ok = false;
    }
    let iconName = () => applet._applet_icon.get_icon_name();

    try {
        applet.menu.close();
        applet._clear_all();
        check("empty: icon is empty-notif (" + iconName() + ")", iconName() === "empty-notif");
        check("empty: not blinking", applet._blinking === false);

        let source = _newSource();
        _notify(applet, source, "low", MessageTray.Urgency.LOW);
        check("low: icon is low-notif (" + iconName() + ")", iconName() === "low-notif");

        _notify(applet, source, "normal", MessageTray.Urgency.NORMAL);
        check("normal outranks low (" + iconName() + ")", iconName() === "normal-notif");
        check("normal: not blinking", applet._blinking === false);

        let critical = _notify(applet, source, "critical", MessageTray.Urgency.CRITICAL);
        check("critical: blinking", applet._blinking === true);

        // Nothing stops a caller raising urgency after listing, and the icon has to follow.
        critical.destroy(MessageTray.NotificationDestroyedReason.DISMISSED);
        let late = _notify(applet, source, "late");
        late.setUrgency(MessageTray.Urgency.CRITICAL);
        applet.update_list();
        check("urgency raised after arrival: blinking", applet._blinking === true);
        late.destroy(MessageTray.NotificationDestroyedReason.DISMISSED);

        check("after the criticals go: not blinking", applet._blinking === false);
        check("after the critical goes: icon is normal-notif (" + iconName() + ")",
              iconName() === "normal-notif");

        applet._clear_all();
        check("cleared: icon is empty-notif (" + iconName() + ")", iconName() === "empty-notif");
        check("cleared: not blinking", applet._blinking === false);
    } finally {
        cleanup();
    }

    global.log("checkUrgency: " + (ok ? "all checks passed" : "FAILURES above"));
    return ok;
}

// A notification arriving while the menu is open has to land in the bin straight away.
function checkArrivalWhileOpen() {
    let applet = _applet();
    let ok = true;
    function check(label, condition) {
        global.log("checkArrivalWhileOpen: " + label + ": " + (condition ? "ok" : "FAIL"));
        if (!condition)
            ok = false;
    }

    let original = applet.showNewestFirst;
    try {
        for (let newestFirst of [false, true]) {
            applet.menu.close();
            applet._clear_all();
            applet.showNewestFirst = newestFirst;
            fill(3);
            applet._openMenu();

            let source = _newSource();
            let arrived = _notify(applet, source, "arrived while open");

            let rows = _rowActors(applet);
            check("newestFirst=" + newestFirst + ": it is listed (" +
                  applet.notifications.length + ")", applet.notifications.length === 4);
            check("newestFirst=" + newestFirst + ": its actor is in the bin",
                  rows.indexOf(arrived.actor) !== -1);
            check("newestFirst=" + newestFirst + ": it is at the end the setting asks for",
                  rows.indexOf(arrived.actor) === (newestFirst ? 0 : rows.length - 1));
            // The heading is translated: look for the number, not the wording.
            check("newestFirst=" + newestFirst + ": the heading followed (" +
                  applet.menu_label.label.get_text() + ")",
                  applet.menu_label.label.get_text().indexOf("4") !== -1);
        }
    } finally {
        applet.showNewestFirst = original;
        cleanup();
    }

    global.log("checkArrivalWhileOpen: " + (ok ? "all checks passed" : "FAILURES above"));
    return ok;
}

// With the setting on, a transient notification is destroyed instead of listed.
function checkTransient() {
    let applet = _applet();
    let ok = true;
    function check(label, condition) {
        global.log("checkTransient: " + label + ": " + (condition ? "ok" : "FAIL"));
        if (!condition)
            ok = false;
    }

    let original = applet.ignoreTransientNotifications;
    try {
        applet.menu.close();
        applet._clear_all();

        applet.ignoreTransientNotifications = false;
        let kept = new MessageTray.Notification(_newSource(), "transient", "body");
        kept.setTransient(true);
        applet._notification_added(Main.messageTray, kept);
        check("setting off: a transient is listed (" + applet.notifications.length + ")",
              applet.notifications.indexOf(kept) !== -1);

        applet._clear_all();
        applet.ignoreTransientNotifications = true;
        let dropped = new MessageTray.Notification(_newSource(), "transient", "body");
        dropped.setTransient(true);
        applet._notification_added(Main.messageTray, dropped);
        check("setting on: a transient is not listed (" + applet.notifications.length + ")",
              applet.notifications.indexOf(dropped) === -1);
        check("setting on: a transient was destroyed", dropped._destroyed === true);

        let normal = _notify(applet, _newSource(), "normal");
        check("setting on: a normal notification is still listed",
              applet.notifications.indexOf(normal) !== -1);
    } finally {
        applet.ignoreTransientNotifications = original;
        cleanup();
    }

    global.log("checkTransient: " + (ok ? "all checks passed" : "FAILURES above"));
    return ok;
}

// showEmptyTray decides whether an empty applet stays on the panel.
function checkTrayChrome() {
    let applet = _applet();
    let ok = true;
    function check(label, condition) {
        global.log("checkTrayChrome: " + label + ": " + (condition ? "ok" : "FAIL"));
        if (!condition)
            ok = false;
    }
    let panelLabel = () => applet._applet_label.get_text();
    let heading = () => applet.menu_label.label.get_text();

    let originalEmpty = applet.showEmptyTray;
    let originalCount = applet.showNotificationCount;
    try {
        // Assigning these directly skips the settings binding, so call what it would have called.
        applet.showEmptyTray = true;
        applet.showNotificationCount = true;

        applet.menu.close();
        applet._clear_all();
        applet._show_hide_tray();
        check("empty: no panel label (" + panelLabel() + ")", panelLabel() === "");
        // The heading is translated: assert it changes, not its wording.
        let emptyHeading = heading();
        check("empty: the heading is not blank (" + emptyHeading + ")", emptyHeading.length > 0);
        check("empty: the clear item is hidden", applet.clear_action.actor.visible === false);
        check("empty: showEmptyTray keeps the applet on the panel", applet.actor.visible === true);

        fill(3);
        check("3 listed: panel label is the count (" + panelLabel() + ")", panelLabel() === "3");
        check("3 listed: the heading has the count in it (" + heading() + ")",
              heading().indexOf("3") !== -1);
        check("3 listed: the heading changed from empty", heading() !== emptyHeading);
        check("3 listed: the clear item is shown", applet.clear_action.actor.visible === true);

        applet.showNotificationCount = false;
        applet.update_list();
        check("count off: the panel label is empty (" + panelLabel() + ")", panelLabel() === "");
        check("count off: the heading still has it (" + heading() + ")",
              heading().indexOf("3") !== -1);

        applet.showNotificationCount = true;
        applet.showEmptyTray = false;
        applet._clear_all();
        applet._show_hide_tray();
        check("empty with showEmptyTray off: the applet leaves the panel",
              applet.actor.visible === false);

        fill(1);
        check("an arrival brings it back", applet.actor.visible === true);
    } finally {
        applet.showEmptyTray = originalEmpty;
        applet.showNotificationCount = originalCount;
        cleanup();
        // A blanket show() would strand an empty applet on the panel for the next check.
        applet._show_hide_tray();
    }

    global.log("checkTrayChrome: " + (ok ? "all checks passed" : "FAILURES above"));
    return ok;
}

// One source can hold several notifications, and destroying it takes all of them with it.
function checkSourceCascade() {
    let applet = _applet();
    let ok = true;
    function check(label, condition) {
        global.log("checkSourceCascade: " + label + ": " + (condition ? "ok" : "FAIL"));
        if (!condition)
            ok = false;
    }

    try {
        applet.menu.close();
        applet._clear_all();

        let source = _newSource("Shared");
        for (let i = 0; i < 3; i++)
            _notify(applet, source, "shared " + i);
        check("one source holds all three (" + source.notifications.length + ")",
              source.notifications.length === 3);
        check("the applet lists all three (" + applet.notifications.length + ")",
              applet.notifications.length === 3);

        source.destroy();
        check("destroying the source empties the applet (" + applet.notifications.length + ")",
              applet.notifications.length === 0);
        check("and empties the bin (" + _rowActors(applet).length + ")",
              _rowActors(applet).length === 0);

        let capped = _newSource("Capped");
        for (let i = 0; i < 25; i++)
            _notify(applet, capped, "capped " + i);
        check("the source capped itself at 20 (" + capped.notifications.length + ")",
              capped.notifications.length === 20);
        check("the applet followed it down (" + applet.notifications.length + ")",
              applet.notifications.length === 20);
    } finally {
        cleanup();
    }

    global.log("checkSourceCascade: " + (ok ? "all checks passed" : "FAILURES above"));
    return ok;
}

// Counts Gio.Settings constructions by swapping in a wrapper across the one call: applet.js
// reads imports.gi.Gio.Settings at call time, so it sees it.
function checkClockSettings() {
    let applet = _applet();
    const Gio = imports.gi.Gio;
    let ok = true;
    function check(label, condition) {
        global.log("checkClockSettings: " + label + ": " + (condition ? "ok" : "FAIL"));
        if (!condition)
            ok = false;
    }

    const ROWS = 12;
    let real = Gio.Settings;
    let built = 0;

    try {
        applet.menu.close();
        applet._clear_all();
        fill(ROWS);
        applet._openMenu();

        Gio.Settings = function (params) { built++; return new real(params); };
        try {
            applet._update_timestamp();
        } finally {
            Gio.Settings = real;
        }

        check("refreshing " + ROWS + " timestamps built no settings object (" + built + ")",
              built === 0);

        // The timestamps still say something, so the count above is not zero by accident.
        let blank = applet.notifications.filter(n => !n._timeLabel.get_text()).length;
        check("every row still has timestamp text (" + blank + " blank)", blank === 0);
    } finally {
        Gio.Settings = real;
        cleanup();
    }

    global.log("checkClockSettings: " + (ok ? "all checks passed" : "FAILURES above"));
    return ok;
}

// Adding an actor that still has a parent, and removing one that is not a child, are Clutter
// errors rather than exceptions, so count the calls instead of waiting for a throw.
function checkBorrowedActor() {
    let applet = _applet();
    let tray = Main.messageTray;
    let bin = applet._notificationbin;
    let ok = true;
    function check(label, condition) {
        global.log("checkBorrowedActor: " + label + ": " + (condition ? "ok" : "FAIL"));
        if (!condition)
            ok = false;
    }

    let addToParented = 0;
    let removeNonChild = 0;
    let realAdd = bin.add_child;
    let realInsert = bin.insert_child_at_index;
    let realRemoveActor = bin.remove_actor;
    let realRemoveChild = bin.remove_child;

    try {
        applet.menu.close();
        applet._clear_all();
        fill(4);
        applet._openMenu();

        let borrowed = applet.notifications[1];
        tray._notificationQueue.push(borrowed);
        tray._showNotification();
        _pumpUntil(() => tray._notificationState === 2, 200);
        check("the tray took the actor", borrowed.actor.get_parent() !== bin);

        bin.add_child = function (actor) {
            if (actor.get_parent() !== null) addToParented++;
            return realAdd.call(this, actor);
        };
        bin.insert_child_at_index = function (actor, i) {
            if (actor.get_parent() !== null) addToParented++;
            return realInsert.call(this, actor, i);
        };
        bin.remove_actor = function (actor) {
            if (actor.get_parent() !== this) removeNonChild++;
            return realRemoveActor.call(this, actor);
        };
        bin.remove_child = function (actor) {
            if (actor.get_parent() !== this) removeNonChild++;
            return realRemoveChild.call(this, actor);
        };

        applet.update_list();
        check("rebuilding did not add an actor that already had a parent (" +
              addToParented + ")", addToParented === 0);

        applet._clear_all();
        check("clearing did not remove an actor from a container that is not its parent (" +
              removeNonChild + ")", removeNonChild === 0);
    } finally {
        bin.add_child = realAdd;
        bin.insert_child_at_index = realInsert;
        bin.remove_actor = realRemoveActor;
        bin.remove_child = realRemoveChild;
        _pumpUntil(() => tray._notificationState !== 1, 300);
        if (tray._notification && !tray._notification._destroyed) {
            try { tray._hideNotificationCompleted(); } catch (e) { /* best effort */ }
        }
        try { tray._notificationQueue.length = 0; } catch (e) { /* best effort */ }
        try { tray._updateNotificationTimeout(0); } catch (e) { /* best effort */ }
        cleanup();
    }

    global.log("checkBorrowedActor: " + (ok ? "all checks passed" : "FAILURES above"));
    return ok;
}

// Differing heights on purpose: with a uniform list the mean never moves, and a stale prefix
// sum looks identical to a current one.
function _fillVaried(n) {
    let applet = _applet();
    for (let i = 0; i < n; i++)
        _notify(applet, _newSource(), `Varied ${i}`, undefined,
                "word ".repeat(1 + (i % 9) * 6));
    return applet.notifications.length;
}

// Measuring one row moves the mean, and so every offset. The idle fill measures as it attaches,
// so it has to rebuild the offsets before anything reads them.
function checkOffsetsCurrent() {
    let applet = _applet();
    let result = _newCheck("checkOffsetsCurrent");
    let check = result.check;
    try {
        applet.menu.close();
        applet._clear_all();
        _fillVaried(200);
        applet._openMenu();

        let list = applet._notificationList;
        let heights = list._heights;
        let sum = () => list._items.reduce((t, n) => t + heights.get(n), 0);
        let idleWasScheduled = list._idleDelayId !== 0 || list._idleId !== 0;

        _pumpUntil(() => false, 60);
        check("rows really do differ in height (" + heights._measured.size + " measured, " +
              new Set(Array.from(heights._measured.values())).size + " distinct)",
              new Set(Array.from(heights._measured.values())).size > 1);
        check("the total matches the heights after opening (" + list.totalHeight().toFixed(0) +
              " vs " + sum().toFixed(0) + ")", Math.abs(list.totalHeight() - sum()) < 1);

        // Most rows are unbuilt, so the mean sizes them and moving it must reach the offsets.
        check("most rows are still sized from the mean (" + heights._measured.size + " of " +
              list._items.length + " measured)", heights._measured.size < list._items.length);

        check("the idle fill completed", _waitForIdlePass(list, idleWasScheduled));
        check("the total still matches the heights (" + list.totalHeight().toFixed(0) +
              " vs " + sum().toFixed(0) + ")", Math.abs(list.totalHeight() - sum()) < 1);

        let gaps = 0;
        for (let i = 1; i < list._items.length; i++) {
            let expected = list._offsets[i - 1] + heights.get(list._items[i - 1]);
            if (Math.abs(list._offsets[i] - expected) > 0.01)
                gaps++;
        }
        check("each row still starts where the one above it ends (" + gaps + " that do not)",
              gaps === 0);
    } finally {
        cleanup();
    }
    return result.finish();
}
