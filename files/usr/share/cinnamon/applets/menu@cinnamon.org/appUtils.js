const Cinnamon = imports.gi.Cinnamon;
const CMenu = imports.gi.CMenu;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

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

// sort cmenu directories with special categories at the bottom
function dirSort(a, b) {
    const menuIdA = a.get_menu_id().toLowerCase();
    const menuIdB = b.get_menu_id().toLowerCase();

    const bottomOrder = ["development", "other", "preferences", "administration"];

    const idxA = bottomOrder.indexOf(menuIdA);
    const idxB = bottomOrder.indexOf(menuIdB);

    // if neither is in the list, sort alphabetically
    if (idxA < 0 && idxB < 0)
        return a.get_name().localeCompare(b.get_name(), undefined, {sensitivity: "base", ignorePunctuation: true});

    // if only one is in the list, put it AFTER the other
    if (idxA < 0) return -1;
    if (idxB < 0) return 1;

    // if both are in the list, preserve that internal order
    return idxA - idxB;
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

function _launchMintinstall(pkgName) {
    GLib.spawn_command_line_async(`mintinstall show ${pkgName}`);
}

// launch mintinstall on app page
function launchMintinstallForApp(app) {
    if (app.get_is_flatpak()) {
        const pkgName = app.get_flatpak_app_id();
        _launchMintinstall(pkgName);
    } else {
        const filePath = app.desktop_file_path;
        if (!filePath) return;
        
        const proc = Gio.Subprocess.new(
            ['dpkg', '-S', filePath],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
        proc.communicate_utf8_async(null, null, (obj, res) => {
            try {
                let [success, stdout, stderr] = obj.communicate_utf8_finish(res);
                if (success && stdout) {
                    const foundPkg = stdout.split(':')[0].trim();
                    _launchMintinstall(foundPkg);
                }
            } catch (e) {
                global.logError("dpkg check failed: " + e.message);
            }
        });
    }
}

function _launchPamac(pkgName) {
    GLib.spawn_command_line_async(`pamac-manager --details=${pkgName}`);
}

// launch pamac-manager on app page
function launchPamacForApp(app) {
    if (app.get_is_flatpak()) {
        // pamac-manager doesn't open on page of flatpak apps even if flatpak
        // is enabled but let's launch it anyway so user can search for it.
        const pkgName = app.get_flatpak_app_id();
        _launchPamac(pkgName);
    } else {
        const filePath = app.desktop_file_path;
        if (!filePath) return;
        
        const proc = Gio.Subprocess.new(
            ['pacman', '-Qqo', filePath],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
        );
        proc.communicate_utf8_async(null, null, (obj, res) => {
            try {
                let [success, stdout, stderr] = obj.communicate_utf8_finish(res);
                if (success && stdout) {
                    const foundPkg = stdout.trim();
                    _launchPamac(foundPkg);
                }
            } catch (e) {
                global.logError("pacman check failed: " + e.message);
            }
        });
    }
}

