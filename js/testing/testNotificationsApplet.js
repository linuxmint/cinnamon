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
