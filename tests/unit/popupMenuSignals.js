// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Environment = imports.ui.environment;
if (typeof global === 'undefined')
    Environment.init();

const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Main = imports.ui.main;
if (GLib.getenv('CINNAMON_POPUP_MENU_TEST_MASTER_COMPAT')) {
    imports.ui.separator.Separator = function() {
        return new St.DrawingArea({ style_class: 'separator' });
    };
}
const PopupMenu = GLib.getenv('CINNAMON_POPUP_MENU_TEST_MODULE')
    ? imports.popupMenuUnderTest
    : imports.ui.popupMenu;
const ITERATIONS = 1000;

function assertEquals(message, expected, actual) {
    if (actual !== expected)
        throw Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertFalse(message, actual) {
    assertEquals(message, false, actual);
}

function assertTrue(message, actual) {
    assertEquals(message, true, actual);
}

function createMenu() {
    let sourceActor = new St.Widget({ width: 1, height: 1 });
    let menu = new PopupMenu.PopupMenu(sourceActor, St.Side.TOP);
    if (GLib.getenv('CINNAMON_POPUP_MENU_TEST_MASTER_COMPAT')) {
        menu.getPanel = () => null;
        menu.setMaxHeight = () => {};
        menu._calculatePosition = () => [0, 0];
    }
    Main.uiGroup.add_actor(menu.actor);
    return [menu, sourceActor];
}

function destroyMenu(menu, sourceActor) {
    menu.destroy();
    sourceActor.destroy();
}

function testDestroyedItemsReleaseManagedSignals(name, createItem) {
    let [menu, sourceActor] = createMenu();
    try {
        // White-box assertion: this regression is retained SignalManager
        // ownership, which has no stable public counter.
        let baseline = menu._signals._storage.length;

        for (let i = 0; i < ITERATIONS; i++) {
            let item = createItem();
            let childMenu = item.menu;
            menu.addMenuItem(item);
            item.destroy();

            assertEquals(`${name} signal count after cycle ${i}`, baseline,
                menu._signals._storage.length);
            assertFalse(`${name} retained after cycle ${i}`,
                menu._signals._storage.some(signal => signal[1] === item));
            if (childMenu) {
                assertFalse(`${name} child menu retained after cycle ${i}`,
                    menu._signals._storage.some(signal => signal[1] === childMenu));
            }
            assertEquals(`${name} length after cycle ${i}`, 0, menu.length);
        }
    } finally {
        destroyMenu(menu, sourceActor);
    }
}

function testParentCloseReachesSubmenuInsideSection() {
    let [menu, sourceActor] = createMenu();
    try {
        let section = new PopupMenu.PopupMenuSection();
        let submenu = new PopupMenu.PopupSubMenuMenuItem('nested');

        section.addMenuItem(submenu);
        menu.addMenuItem(section);
        menu.open(false);
        submenu.menu.open(false);

        menu.close(false);
        assertFalse('submenu inside section stays open after parent closes',
            submenu.menu.isOpen);
    } finally {
        destroyMenu(menu, sourceActor);
    }
}

function testDestroyingSubmenuPreservesSiblingCloseHandling() {
    let [menu, sourceActor] = createMenu();
    try {
        let first = new PopupMenu.PopupSubMenuMenuItem('first');
        let second = new PopupMenu.PopupSubMenuMenuItem('second');

        menu.addMenuItem(first);
        menu.addMenuItem(second);
        menu.open(false);
        first.destroy();

        second.menu.open(false);
        menu.close(false);
        assertFalse('remaining submenu stays open after parent closes',
            second.menu.isOpen);
    } finally {
        destroyMenu(menu, sourceActor);
    }
}

function testDestroyingSubmenuPreservesSeparatorUpdates() {
    let [menu, sourceActor] = createMenu();
    try {
        let submenu = new PopupMenu.PopupSubMenuMenuItem('first');
        let separator = new PopupMenu.PopupSeparatorMenuItem();
        let tail = new PopupMenu.PopupMenuItem('tail');

        menu.addMenuItem(submenu);
        menu.addMenuItem(separator);
        menu.addMenuItem(tail);
        menu.open(false);
        assertTrue('separator between visible items was hidden',
            separator.actor.visible);
        menu.close(false);

        submenu.destroy();
        menu.open(false);
        assertFalse('leading separator stayed visible after submenu destroy',
            separator.actor.visible);
    } finally {
        destroyMenu(menu, sourceActor);
    }
}

function testAnimatedParentCloseClosesSubmenu() {
    let [menu, sourceActor] = createMenu();
    let effectsEnabled = Main.wm.desktop_effects_menus;
    try {
        let submenu = new PopupMenu.PopupSubMenuMenuItem('animated');
        menu.addMenuItem(submenu);
        menu.open(false);
        submenu.menu.open(false);

        Main.wm.desktop_effects_menus = true;
        menu.close(true);
        assertTrue('parent close did not enter animation', menu.animating);

        let transition = menu.actor.get_transition('opacity');
        assertTrue('parent close did not create an opacity transition',
            transition !== null);
        assertTrue('submenu actor was not mapped before parent unmap',
            submenu.menu.actor.mapped);
        assertTrue('submenu did not install deferred unmap handling',
            submenu.menu.unmapId !== 0);
        transition.stop();

        // Xvfb does not drive Mutter's frame clock. close(true) above must
        // create the real transition; hiding the parent reproduces its final
        // unmap and exercises PopupSubMenu.closeAfterUnmap().
        menu.actor.hide();
        assertFalse('submenu actor stayed mapped after parent hide',
            submenu.menu.actor.mapped);
        assertEquals('submenu deferred unmap handler was not cleared', 0,
            submenu.menu.unmapId);
        assertFalse('submenu stays open after animated parent close',
            submenu.menu.isOpen);
    } finally {
        Main.wm.desktop_effects_menus = effectsEnabled;
        destroyMenu(menu, sourceActor);
    }
}

var run = function() {
    testDestroyedItemsReleaseManagedSignals('menu item',
        () => new PopupMenu.PopupMenuItem('item'));
    testDestroyedItemsReleaseManagedSignals('separator',
        () => new PopupMenu.PopupSeparatorMenuItem());
    testDestroyedItemsReleaseManagedSignals('submenu item',
        () => new PopupMenu.PopupSubMenuMenuItem('submenu'));
    testDestroyedItemsReleaseManagedSignals('section',
        () => new PopupMenu.PopupMenuSection());
    testDestroyingSubmenuPreservesSiblingCloseHandling();
    testDestroyingSubmenuPreservesSeparatorUpdates();
    testParentCloseReachesSubmenuInsideSection();
    testAnimatedParentCloseClosesSubmenu();
};
