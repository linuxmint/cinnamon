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

function fill(n) {
    let applet = _applet();

    for (let i = 0; i < n; i++) {
        let source = new MessageTray.SystemNotificationSource("Test");
        Main.messageTray.add(source);
        sources.push(source);

        let notification = new MessageTray.Notification(
            source, `Test notification ${i}`, `Body text for notification ${i}.`);
        source.pushNotification(notification);
        applet._notification_added(Main.messageTray, notification);
    }
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

function _newSource(title) {
    let source = new MessageTray.SystemNotificationSource(title || "Test");
    Main.messageTray.add(source);
    sources.push(source);
    return source;
}

function _notify(applet, source, title, urgency) {
    let notification = new MessageTray.Notification(source, title, "body");
    if (urgency !== undefined)
        notification.setUrgency(urgency);
    source.pushNotification(notification);
    applet._notification_added(Main.messageTray, notification);
    return notification;
}

function _rowActors(applet) {
    return applet._notificationbin.get_children();
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

function checkFailedClear() {
    let applet = _applet();
    let failures = 0;

    try {
        applet.menu.close();
        applet._clear_all();
        fill(5);
        applet._openMenu();

        // Index 2 throws, and _clear_all() destroys back-to-front, so 0 and 1 are never
        // attempted. All three should survive, then die on a retry without the fault.
        let survivors = applet.notifications.slice(0, 3);
        let victim = applet.notifications[2];
        let realDestroy = victim.destroy;
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

        victim.destroy = realDestroy;
        applet._clear_all();

        let stillUndestroyed = survivors.filter(n => !n._destroyed);
        if (stillUndestroyed.length !== 0) {
            failures++;
            log(`[testNotificationsApplet] FAIL failed-clear: retry did not finish the job -- ${stillUndestroyed.length} survivor(s) were never destroyed`);
        } else {
            log("[testNotificationsApplet] ok   retry destroyed the survivors");
        }
    } finally {
        cleanup();
    }

    log(`[testNotificationsApplet] checkFailedClear: ${failures === 0 ? "passed" : failures + " failures"}`);
    return failures === 0;
}

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

const Extension = imports.ui.extension;

function _sourceIsLive(id) {
    if (!id)
        return false;
    return GLib.MainContext.default().find_source_by_id(id) !== null;
}

function _blinkNotify(applet, urgency) {
    let source = new MessageTray.SystemNotificationSource();
    Main.messageTray.add(source);
    sources.push(source);
    let notification = new MessageTray.Notification(source, "blink test", "body");
    notification.setUrgency(urgency);
    source.pushNotification(notification);
    applet._notification_added(Main.messageTray, notification);
    return notification;
}

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

// AppletPopupMenu parents its actor into Main.uiGroup, so a menu that outlived its applet is a
// stray direct child of it. By actor identity, so the session language does not matter.
function _liveMenus(actors) {
    let kids = Main.uiGroup.get_children();
    return actors.filter(actor => actor !== null && kids.indexOf(actor) !== -1);
}

function _reloadAndWaitForApplet(maxRounds) {
    Extension.reloadExtension(UUID, Extension.Type.APPLET);
    let back = _pumpUntil(() => AppletManager.getRunningInstancesForUuid(UUID).length > 0, maxRounds);
    return back ? _applet() : null;
}

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
