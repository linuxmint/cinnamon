const Cinnamon = imports.gi.Cinnamon;
const CMenu = imports.gi.CMenu;

const Util = imports.misc.util;

let appsys = Cinnamon.AppSystem.get_default();

// sort apps by their latinised name
function appSort(a, b) {
    a = Util.latinise(a[0].get_name().toLowerCase());
    b = Util.latinise(b[0].get_name().toLowerCase());
    return a > b;
}

// sort cmenu directories with admin and prefs categories last
function dirSort(a, b) {
    let menuIdA = a.get_menu_id().toLowerCase();
    let menuIdB = b.get_menu_id().toLowerCase();

    let prefCats = ["administration", "preferences"];
    let prefIdA = prefCats.indexOf(menuIdA);
    let prefIdB = prefCats.indexOf(menuIdB);

    if (prefIdA < 0 && prefIdB >= 0) {
        return -1;
    }
    if (prefIdA >= 0 && prefIdB < 0) {
        return 1;
    }

    let nameA = a.get_name().toLowerCase();
    let nameB = b.get_name().toLowerCase();

    if (nameA > nameB) {
        return 1;
    }
    if (nameA < nameB) {
        return -1;
    }
    return 0;
}

/* returns all apps and the categories they belong to, and all top level categories
 *
 * [
 *   [
 *     app 1,
 *     [
 *       top level category 1,
 *       random category,
 *       random category
 *     ]
 *   ],
 *   ...
 * ],
 * [
 *   top level category 1,
 *   top level category 2,
 *   top level category 3,
 *   top level category 4,
 *   ...
 * ] */
function getApps() {
    let apps = new Map();
    let dirs = [];

    let tree = appsys.get_tree();
    let root = tree.get_root_directory();
    let iter = root.iter();
    let nextType;

    while ((nextType = iter.next()) != CMenu.TreeItemType.INVALID) {
        if (nextType == CMenu.TreeItemType.DIRECTORY) {
            let dir = iter.get_directory();
            if (dir.get_is_nodisplay())
                continue;
            if (loadDirectory(dir, dir, apps))
                dirs.push(dir);
        }
    }

    dirs.sort(dirSort);
    let sortedApps = Array.from(apps.entries()).sort(appSort);

    return [sortedApps, dirs];
}

// load all apps and their categories from a cmenu directory
// into 'apps' Map
function loadDirectory(dir, top_dir, apps) {
    let iter = dir.iter();
    let has_entries = false;
    let nextType;
    while ((nextType = iter.next()) != CMenu.TreeItemType.INVALID) {
        if (nextType == CMenu.TreeItemType.ENTRY) {
            let desktopId = iter.get_entry().get_desktop_file_id();
            let app = appsys.lookup_app(desktopId);
            if (!app || app.get_nodisplay())
                continue;

            has_entries = true;
            if (apps.has(app))
                apps.get(app).push(dir.get_menu_id());
            else
                apps.set(app, [top_dir.get_menu_id()]);
        } else if (nextType == CMenu.TreeItemType.DIRECTORY) {
            has_entries = loadDirectory(iter.get_directory(), top_dir, apps);
        }
    }
    return has_entries;
}
