const Cinnamon = imports.gi.Cinnamon;
const CMenu = imports.gi.CMenu;

let appsys = Cinnamon.AppSystem.get_default();

function decomp_string(s) {
    return s.normalize('NFKD').replace(/\p{Grapheme_Extend}/gu,"").toLowerCase();
}

function decomp_stripped(s) {
    return decomp_string(s).replace(/[^\p{L}\p{N}]/gu, "");

}

function decomp_unstripped(s) {
    return decomp_string(s);
}

// sort apps by their locale sensitive sort order
function appSort(a, b) {
    const an = a[0].get_name();
    const bn = b[0].get_name();

    return an.localeCompare(bn, undefined, {sensitivity: "base", ignorePunctuation: true});
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

    const nameA = a.get_name();
    const nameB = b.get_name();
    return nameA.localeCompare(nameB, undefined, {sensitivity: "base", ignorePunctuation: true});
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
